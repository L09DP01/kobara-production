import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';
import { TelegramClient, SendMessageOptions } from './telegram-client';
import { WithdrawalOtpService } from '@/lib/server/security/withdrawal-otp';
import { WithdrawalService } from '@/lib/server/withdrawals/withdrawal.service';
import { canCreateWithdrawal } from '@/lib/server/access';
import { getMerchantFundsAvailability } from '@/lib/server/withdrawals/funds-availability';
import { B2BTransferService } from '@/lib/server/transfers/b2b-transfer.service';
import speakeasy from 'speakeasy';
import { normalizeSixDigitCode } from '@/lib/two-factor';
import {
  isNowPaymentsPayoutConfigured,
  quoteNowPaymentsPayout,
} from '@/lib/server/payments/nowpayments';
import {
  KOBARA_CRYPTO_CURRENCIES,
  getCryptoWithdrawalMinimumUsd,
  getKobaraCryptoCurrency,
} from '@/lib/nowpayments';
import { getWithdrawalUserMessage } from '@/lib/withdrawal-error-message';

export class TelegramBotService {
  /**
   * Clavier principal du Bot Kobara
   */
  private static getMainKeyboard(): SendMessageOptions['reply_markup'] {
    return {
      keyboard: [
        [{ text: '💰 Mon Solde (Live)' }, { text: '🔗 Créer un Lien' }],
        [{ text: '🏦 Transfert B2B' }, { text: '💸 Demander un Retrait' }],
        [{ text: '⭐ Mon Abonnement' }, { text: '🎁 Recevez 675 Gdes' }],
        [{ text: '🔔 Statut & Paramètres' }, { text: '❓ Aide' }],
      ],
      resize_keyboard: true,
    };
  }

  /**
   * Récupère le compte marchand associé à un chat_id
   */
  private static async getLinkedMerchant(chatId: string | number) {
    const supabase = createAdminClient();
    const { data: link } = await supabase
      .from('merchant_telegram_accounts')
      .select('*, merchants(*)')
      .eq('telegram_chat_id', String(chatId))
      .maybeSingle();

    if (!link || !link.merchants) return null;
    return {
      link,
      merchant: link.merchants,
    };
  }

  /**
   * Point d'entrée principal pour traiter les updates reçues du Webhook Telegram
   */
  static async handleUpdate(update: any) {
    if (update.callback_query) {
      return this.handleCallbackQuery(update.callback_query);
    }

    const message = update.message;
    if (!message || !message.text) return { success: true };

    const chatId = message.chat.id;
    const text = message.text.trim();
    const username = message.from?.username;
    const firstName = message.from?.first_name;

    // 1. Commande /start (avec ou sans jeton de liaison)
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const token = parts[1]?.trim();
      return this.handleStart(chatId, token, username, firstName);
    }

    // 2. Vérifier si le compte est lié
    const account = await this.getLinkedMerchant(chatId);
    if (!account) {
      await TelegramClient.sendMessage(
        chatId,
        `⚠️ <b>Compte non associé</b>\n\nPour utiliser ce bot, veuillez lier votre compte marchand Kobara depuis vos paramètres :\n\n👉 <a href="https://kobara.app/dashboard/settings">https://kobara.app/dashboard/settings</a>\n\nCliquez sur <b>"Connecter mon Telegram"</b> pour générer votre lien sécurisé.`,
        { parse_mode: 'HTML' }
      );
      return { success: true };
    }

    const { link, merchant } = account;
    const sessionState = link.session_state || {};

    // 3. Commande d'annulation / Reset
    if (text === '/cancel' || text.toLowerCase() === 'annuler' || text === '❌ Annuler') {
      await this.updateSessionState(chatId, {});
      await TelegramClient.sendMessage(chatId, '✅ Opération annulée. Retour au menu principal.', {
        reply_markup: this.getMainKeyboard(),
      });
      return { success: true };
    }

    // 4. Gestion des étapes conversationnelles (State Machine)
    if (sessionState.step) {
      return this.handleConversationStep(chatId, text, sessionState, merchant);
    }

    // 5. Gestion des commandes directes ou boutons du clavier
    if (text === '💰 Mon Solde (Live)' || text === '/solde' || text === '/balance') {
      return this.handleBalance(chatId, merchant);
    }

    if (text === '🔗 Créer un Lien' || text === '/lien' || text === '/link') {
      return this.startCreateLinkFlow(chatId);
    }

    if (text === '💸 Demander un Retrait' || text === '/retrait' || text === '/withdraw') {
      return this.startWithdrawFlow(chatId, merchant);
    }

    if (text === '🏦 Transfert B2B' || text === '/b2b' || text === '/transfert' || text === '/transfer') {
      return this.startB2BTransferFlow(chatId, merchant);
    }

    if (text === '⭐ Mon Abonnement' || text === '/abonnement' || text === '/plan') {
      return this.handleSubscription(chatId, merchant);
    }

    if (text === '🎁 Recevez 675 Gdes' || text === '/parrainage' || text === '/invite') {
      return this.handleMerchantReferral(chatId, merchant);
    }

    if (text === '🔔 Statut & Paramètres' || text === '/settings') {
      return this.handleSettings(chatId, link, merchant);
    }

    if (text === '❓ Aide' || text === '/help') {
      return this.handleHelp(chatId, merchant);
    }

    // Commande non reconnue -> Réafficher le menu
    await TelegramClient.sendMessage(
      chatId,
      `👋 Bonjour <b>${merchant.business_name}</b> !\n\nChoisissez une action ci-dessous :`,
      { reply_markup: this.getMainKeyboard() }
    );

    return { success: true };
  }

  /**
   * Traite la commande /start et associe le compte marchand si un token est fourni
   */
  private static async handleStart(
    chatId: number | string,
    token?: string,
    username?: string,
    firstName?: string
  ) {
    const supabase = createAdminClient();

    if (token) {
      // Vérifier le jeton de liaison
      const { data: linkToken } = await supabase
        .from('telegram_link_tokens')
        .select('*')
        .eq('token', token)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!linkToken) {
        await TelegramClient.sendMessage(
          chatId,
          `❌ <b>Lien de connexion invalide ou expiré</b>\n\nVeuillez générer un nouveau lien depuis votre dashboard Kobara :\n👉 <a href="https://kobara.app/dashboard/settings">Paramètres Kobara</a>`,
          { parse_mode: 'HTML' }
        );
        return { success: true };
      }

      // Récupérer le marchand
      const { data: merchant } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', linkToken.merchant_id)
        .single();

      if (!merchant) {
        await TelegramClient.sendMessage(chatId, "Erreur : Marchand introuvable.");
        return { success: true };
      }

      // Enregistrer ou mettre à jour la liaison
      await supabase.from('merchant_telegram_accounts').upsert(
        {
          merchant_id: merchant.id,
          telegram_chat_id: String(chatId),
          telegram_username: username || null,
          first_name: firstName || null,
          notifications_enabled: true,
          session_state: {},
          linked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'telegram_chat_id' }
      );

      // Marquer le token comme utilisé
      await supabase
        .from('telegram_link_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', linkToken.id);

      // Envoyer un email de sécurité de confirmation au marchand
      if (merchant.email) {
        try {
          const { sendEmail } = await import('@/lib/server/mail');
          const telegramHandle = username ? `@${username}` : (firstName || 'votre compte Telegram');
          const emailSubject = `[Sécurité] Nouveau compte Telegram associé à ${merchant.business_name}`;
          const emailBody = `
Bonjour ${merchant.business_name},

Votre compte Telegram (${telegramHandle}) a été associé avec succès à votre compte Kobara le ${new Date().toLocaleString('fr-HT')}.

Vous bénéficiez désormais :
• Des alertes en direct pour chaque paiement reçu (MonCash & NatCash)
• De la consultation rapide de votre solde et de vos demandes de retrait
• De la création de liens de paiement instantanés

Si vous n'êtes pas à l'origine de cette action, veuillez immédiatement vous connecter à vos paramètres Kobara (https://kobara.app/dashboard/settings) pour dissocier ce compte et contacter notre équipe de support.

Cordialement,
L'équipe de sécurité Kobara — https://kobara.app
          `.trim();

          await sendEmail({
            to: merchant.email,
            subject: emailSubject,
            text: emailBody,
          });
        } catch (emailErr) {
          console.error('[TelegramBotService] Failed to send Telegram linking email notification:', emailErr);
        }
      }

      await TelegramClient.sendMessage(
        chatId,
        `🎉 <b>Félicitations ${firstName || ''} !</b>\n\nVotre compte <b>${merchant.business_name}</b> a été associé avec succès à Kobara Bot.\n\nVous recevrez désormais vos <b>notifications de paiement en temps réel</b> et pourrez gérer vos encaissements et retraits directement ici.\n\n<i>Un email de confirmation vous a également été envoyé.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: this.getMainKeyboard(),
        }
      );

      return { success: true };
    }

    // Si pas de token, vérifier si déjà connecté
    const account = await this.getLinkedMerchant(chatId);
    if (account) {
      await TelegramClient.sendMessage(
        chatId,
        `👋 Bon retour <b>${account.merchant.business_name}</b> !\n\nQue souhaitez-vous faire aujourd'hui ?`,
        {
          parse_mode: 'HTML',
          reply_markup: this.getMainKeyboard(),
        }
      );
    } else {
      await TelegramClient.sendMessage(
        chatId,
        `👋 <b>Bienvenue sur le Bot Kobara</b>\n\nCe bot est réservé aux marchands Kobara pour suivre leurs paiements réels, créer des liens et effectuer des retraits.\n\nPour commencer, connectez-vous sur votre dashboard Kobara :\n👉 <a href="https://kobara.app/dashboard/settings">Lier mon Telegram</a>`,
        { parse_mode: 'HTML' }
      );
    }

    return { success: true };
  }

  /**
   * Affiche le solde réel (Live Only)
   */
  private static async handleBalance(chatId: string | number, merchant: any, messageId?: number) {
    const supabase = createAdminClient();

    // Recharger les données à jour du marchand (Live disponible)
    const { data: freshMerchant } = await supabase
      .from('merchants')
      .select('id, available_balance, pending_balance, available_balance_usd, has_usd_account, paypal_enabled, business_name')
      .eq('id', merchant.id)
      .single();

    const { PayPalService } = await import('@/lib/server/payments/paypal');
    const usdAccount = await PayPalService.getMerchantUsdAccountState(freshMerchant);
    const isPayPalEligible = usdAccount.isEnabled;
    const hasUsd = usdAccount.hasAccount;
    const liveAvailable = Number(freshMerchant?.available_balance || 0);
    const liveAvailableUsd = Number(freshMerchant?.available_balance_usd || 0);
    const htgFunds = await getMerchantFundsAvailability(merchant.id, 'live', 'HTG', liveAvailable);

    let message = `
💰 <b>SOLDE KOBARA (MODE RÉEL)</b>

🏢 <b>Entreprise :</b> ${freshMerchant?.business_name || merchant.business_name}
💼 <b>Solde total (HTG) :</b> <code>${liveAvailable.toLocaleString('fr-HT')} HTG</code>
🟢 <b>Disponible au retrait :</b> <code>${htgFunds.withdrawableBalance.toLocaleString('fr-HT')} HTG</code>
`.trim();

    if (hasUsd && isPayPalEligible) {
      message += `\n💵 <b>Solde disponible (USD) :</b> <code>$${liveAvailableUsd.toFixed(2)} USD</code>`;
    } else if (hasUsd) {
      message += `\n\n⚠️ <b>Compte USD suspendu :</b> <i>Le solde est masqué. Contactez le support Kobara.</i>`;
    } else if (!hasUsd && isPayPalEligible) {
      message += `\n\n💡 <b>Compte USD éligible :</b> <i>Créez votre compte USD pour commencer à recevoir des paiements par Carte Bancaire et PayPal.</i>`;
    }

    message += `\n\n<i>Note : Seules les données réelles (Live) sont affichées dans ce bot.</i>`;

    const inlineKeyboard: any[] = [
      [{ text: '🏦 Transfert B2B', callback_data: 'action:b2b' }],
      [{ text: '💸 Demander un Retrait', callback_data: 'action:withdraw' }],
      [{ text: '🔗 Créer un Lien', callback_data: 'action:create_link' }],
    ];

    if (!hasUsd && isPayPalEligible) {
      inlineKeyboard.unshift([{ text: '➕ Créer mon compte USD', callback_data: 'action:create_usd_account' }]);
    }

    inlineKeyboard.push([{ text: '🔙 Retour au Menu Principal', callback_data: 'action:main_menu' }]);

    await this.sendOrEditMessage(
      chatId,
      message,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      },
      messageId
    );

    return { success: true };
  }

  /**
   * Démarre la création d'un lien de paiement en mode Live
   */
  private static async startCreateLinkFlow(chatId: string | number, messageId?: number) {
    await this.updateSessionState(chatId, { step: 'link_amount' });
    if (messageId) {
      await TelegramClient.deleteMessage(chatId, messageId);
    }
    await TelegramClient.sendMessage(
      chatId,
      `🔗 <b>Création d'un Lien de Paiement (Live)</b>\n\nVeuillez saisir le <b>montant en HTG</b> (ex: <code>500</code> ou <code>2500</code>) :\n\n<i>Tapez /cancel pour annuler.</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [[{ text: '❌ Annuler' }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    );
    return { success: true };
  }

  /**
   * Démarre le flux de retrait sécurisé
   */
  private static async startWithdrawFlow(chatId: string | number, merchant: any, messageId?: number) {
    const totalBalance = Number(merchant.available_balance || 0);
    const htgFunds = await getMerchantFundsAvailability(merchant.id, 'live', 'HTG', totalBalance);
    const liveAvailable = htgFunds.withdrawableBalance;
    const usdFunds = await getMerchantFundsAvailability(
      merchant.id,
      'live',
      'USD',
      Number(merchant.available_balance_usd || 0),
    );
    const liveAvailableUsd = usdFunds.withdrawableBalance;
    const cryptoAvailable = Boolean(merchant.has_usd_account)
      && isNowPaymentsPayoutConfigured()
      && liveAvailableUsd >= 10;

    if (liveAvailable < 150 && !cryptoAvailable) {
      if (messageId) {
        await TelegramClient.deleteMessage(chatId, messageId);
      }
      await TelegramClient.sendMessage(
        chatId,
        `⚠️ <b>Solde insuffisant</b>\n\nSolde retirable : <b>${liveAvailable.toLocaleString('fr-HT')} HTG</b>${merchant.has_usd_account ? ` et <b>${liveAvailableUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</b>` : ''}.`,
        { parse_mode: 'HTML', reply_markup: this.getMainKeyboard() }
      );
      return { success: true };
    }

    const accessCheck = await canCreateWithdrawal(merchant.id, liveAvailable >= 150 ? 150 : 1);
    if (!accessCheck.allowed) {
      const reason = accessCheck.reason === 'kyc_required'
        ? 'Vous devez vérifier votre compte (KYC) pour effectuer des retraits réels.'
        : accessCheck.reason === 'withdrawal_limit_reached'
          ? `Votre limite journalière est atteinte (${accessCheck.used?.toLocaleString('fr-FR')}/${accessCheck.limit?.toLocaleString('fr-FR')} HTG).`
          : 'Accès aux retraits restreint.';
      if (messageId) {
        await TelegramClient.deleteMessage(chatId, messageId);
      }
      await TelegramClient.sendMessage(
        chatId,
        `⚠️ <b>Retrait non autorisé</b>\n\n${reason}\n\nRendez-vous sur votre dashboard : https://kobara.app/dashboard/withdrawals`,
        { parse_mode: 'HTML', reply_markup: this.getMainKeyboard() }
      );
      return { success: true };
    }

    // Récupérer les numéros enregistrés dans les settings
    const supabase = createAdminClient();
    const { data: settings } = await supabase
      .from('settings')
      .select('settings_json')
      .eq('merchant_id', merchant.id)
      .maybeSingle();

    const savedMoncash = settings?.settings_json?.saved_moncash_number;
    const savedNatcash = settings?.settings_json?.saved_natcash_number;

    await this.updateSessionState(chatId, {
      step: 'withdraw_method',
      savedMoncash,
      savedNatcash,
      maxAvailable: liveAvailable,
      maxAvailableUsd: liveAvailableUsd,
    });

    const buttons: any[] = [];
    if (liveAvailable >= 150) {
      buttons.push([{ text: '📱 MonCash', callback_data: 'withdraw_method:moncash' }]);
      buttons.push([{ text: '📲 NatCash', callback_data: 'withdraw_method:natcash' }]);
    }
    if (cryptoAvailable) {
      buttons.push([{ text: 'Crypto (compte USD)', callback_data: 'withdraw_method:crypto' }]);
    }
    buttons.push([{ text: '🔙 Retour au Menu Principal', callback_data: 'action:main_menu' }]);

    await this.sendOrEditMessage(
      chatId,
      `💸 <b>Demande de Retrait (Mode Réel)</b>\n\nCompte HTG : <b>${liveAvailable.toLocaleString('fr-HT')} HTG</b>${merchant.has_usd_account ? `\nCompte USD : <b>${liveAvailableUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</b>` : ''}\n\nChoisissez le compte et la méthode de réception :`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      },
      messageId
    );

    return { success: true };
  }

  private static async beginWithdrawalSecurity(
    chatId: string | number,
    merchant: any,
    state: any,
    summary: string,
  ) {
    const supabase = createAdminClient();
    const { data: settings } = await supabase
      .from('settings')
      .select('security_json')
      .eq('merchant_id', merchant.id)
      .maybeSingle();
    const security = settings?.security_json || {};
    const securityMethod = security.two_factor_method === 'totp' && security.totp_secret
      ? 'totp'
      : 'email';

    if (securityMethod === 'email') {
      const issued = await WithdrawalOtpService.sendWithdrawalOtp({
        merchantId: merchant.id,
        userEmail: merchant.email,
        amount: Number(state.amount),
        method: state.method,
      });
      if (!issued.success) {
        throw new Error(issued.error || "Impossible d'envoyer le code de sécurité.");
      }
    }

    await this.updateSessionState(chatId, {
      ...state,
      step: 'withdraw_otp',
      securityMethod,
    });
    const instruction = securityMethod === 'totp'
      ? 'Saisissez le code à 6 chiffres affiché dans votre application Authenticator.'
      : `Un code à 6 chiffres a été envoyé à <b>${this.escapeHtml(merchant.email)}</b>.`;
    await TelegramClient.sendMessage(
      chatId,
      `🔐 <b>Confirmation requise</b>\n\n${summary}\n\n${instruction}`,
      { parse_mode: 'HTML' },
    );
  }

  private static async startB2BTransferFlow(chatId: string | number, merchant: any, messageId?: number) {
    const supabase = createAdminClient();
    const { data: freshMerchant } = await supabase
      .from('merchants')
      .select('id, email, status, kyc_status, available_balance')
      .eq('id', merchant.id)
      .single();

    if (!freshMerchant
      || freshMerchant.status !== 'active'
      || !['approved', 'verified'].includes(freshMerchant.kyc_status)) {
      await this.sendOrEditMessage(
        chatId,
        `⚠️ <b>Transfert B2B non autorisé</b>\n\nVotre compte Live doit être actif et vérifié avant d'effectuer un transfert.`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Retour au menu', callback_data: 'action:main_menu' }]] } },
        messageId,
      );
      return { success: true };
    }

    const totalBalance = Number(freshMerchant.available_balance || 0);
    const funds = await getMerchantFundsAvailability(merchant.id, 'live', 'HTG', totalBalance);
    if (funds.withdrawableBalance < 1) {
      await this.sendOrEditMessage(
        chatId,
        `⚠️ <b>Solde insuffisant</b>\n\nAucun fonds n'est actuellement disponible pour un transfert B2B.`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Retour au menu', callback_data: 'action:main_menu' }]] } },
        messageId,
      );
      return { success: true };
    }

    const access = await canCreateWithdrawal(merchant.id, 1);
    if (!access.allowed) {
      const reason = access.reason === 'withdrawal_limit_reached'
        ? `Votre limite journalière est atteinte (${access.used?.toLocaleString('fr-FR')}/${access.limit?.toLocaleString('fr-FR')} HTG).`
        : 'Votre compte ne peut pas effectuer ce transfert pour le moment.';
      await this.sendOrEditMessage(
        chatId,
        `⚠️ <b>Transfert B2B indisponible</b>\n\n${reason}`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Retour au menu', callback_data: 'action:main_menu' }]] } },
        messageId,
      );
      return { success: true };
    }

    await this.updateSessionState(chatId, {
      step: 'b2b_receiver',
      maxAvailable: funds.withdrawableBalance,
    });

    if (messageId) await TelegramClient.deleteMessage(chatId, messageId);
    await TelegramClient.sendMessage(
      chatId,
      `🏦 <b>NOUVEAU TRANSFERT B2B</b>\n\nSolde disponible : <b>${funds.withdrawableBalance.toLocaleString('fr-HT')} HTG</b>\n\nSaisissez l'<b>adresse e-mail Kobara du marchand destinataire</b> :\n\n<i>Tapez /cancel pour annuler.</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [[{ text: '❌ Annuler' }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      },
    );
    return { success: true };
  }

  /**
   * Gestion de la machine d'état conversationnelle
   */
  private static async handleConversationStep(
    chatId: string | number,
    text: string,
    state: any,
    merchant: any
  ) {
    const supabase = createAdminClient();

    // --- TRANSFERT B2B ---
    if (state.step === 'b2b_receiver') {
      const receiverEmail = text.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiverEmail)) {
        await TelegramClient.sendMessage(chatId, "⚠️ Adresse e-mail invalide. Saisissez l'adresse utilisée par le marchand sur Kobara.");
        return { success: true };
      }

      const { data: receiver } = await supabase
        .from('merchants')
        .select('id, email, business_name, status, kyc_status')
        .ilike('email', receiverEmail)
        .limit(1)
        .maybeSingle();

      if (!receiver) {
        await TelegramClient.sendMessage(chatId, "⚠️ Aucun marchand Kobara ne correspond à cette adresse e-mail.");
        return { success: true };
      }
      if (receiver.id === merchant.id) {
        await TelegramClient.sendMessage(chatId, "⚠️ Vous ne pouvez pas effectuer un transfert vers votre propre compte.");
        return { success: true };
      }
      if (receiver.status !== 'active' || !['approved', 'verified'].includes(receiver.kyc_status)) {
        await TelegramClient.sendMessage(chatId, "⚠️ Le compte destinataire n'est pas actif et vérifié.");
        return { success: true };
      }

      await this.updateSessionState(chatId, {
        ...state,
        step: 'b2b_amount',
        receiverEmail: receiver.email,
        receiverBusinessName: receiver.business_name,
      });
      await TelegramClient.sendMessage(
        chatId,
        `🏢 Destinataire : <b>${this.escapeHtml(receiver.business_name)}</b>\n📧 <code>${this.escapeHtml(receiver.email)}</code>\n\nSaisissez le <b>montant à transférer</b> en HTG (minimum 1 HTG) :`,
        { parse_mode: 'HTML' },
      );
      return { success: true };
    }

    if (state.step === 'b2b_amount') {
      const amount = Number(text.trim().replace(',', '.'));
      if (!Number.isFinite(amount) || amount < 1 || Math.round(amount * 100) / 100 !== amount) {
        await TelegramClient.sendMessage(chatId, "⚠️ Montant invalide. Saisissez au moins 1 HTG, avec deux décimales maximum.");
        return { success: true };
      }

      const funds = await getMerchantFundsAvailability(
        merchant.id,
        'live',
        'HTG',
        Number(merchant.available_balance || 0),
      );
      if (amount > funds.withdrawableBalance) {
        await TelegramClient.sendMessage(chatId, `⚠️ Votre solde disponible est de <b>${funds.withdrawableBalance.toLocaleString('fr-HT')} HTG</b>.`, { parse_mode: 'HTML' });
        return { success: true };
      }

      const access = await canCreateWithdrawal(merchant.id, amount);
      if (!access.allowed) {
        const reason = access.reason === 'withdrawal_limit_reached'
          ? `Ce transfert dépasse votre limite journalière (${access.used?.toLocaleString('fr-FR')}/${access.limit?.toLocaleString('fr-FR')} HTG utilisés, ${amount.toLocaleString('fr-FR')} HTG demandés).`
          : "Ce transfert n'est pas autorisé pour votre compte.";
        await TelegramClient.sendMessage(chatId, `⚠️ ${reason}`);
        return { success: true };
      }

      const otpIssue = await WithdrawalOtpService.sendWithdrawalOtp({
        merchantId: merchant.id,
        userEmail: merchant.email,
        amount,
        method: `B2B vers ${state.receiverEmail}`,
        operation: 'b2b',
      });
      if (!otpIssue.success) {
        await this.updateSessionState(chatId, {});
        await TelegramClient.sendMessage(chatId, `❌ ${otpIssue.error || "Impossible d'envoyer le code de sécurité."}`, { reply_markup: this.getMainKeyboard() });
        return { success: true };
      }

      await this.updateSessionState(chatId, { ...state, step: 'b2b_otp', amount });
      await TelegramClient.sendMessage(
        chatId,
        `🔐 <b>CONFIRMATION REQUISE</b>\n\nTransfert : <b>${amount.toLocaleString('fr-HT')} HTG</b>\nDestinataire : <b>${this.escapeHtml(state.receiverBusinessName)}</b>\n\nUn code à 6 chiffres a été envoyé à <b>${this.escapeHtml(merchant.email)}</b>. Saisissez-le pour confirmer :`,
        { parse_mode: 'HTML' },
      );
      return { success: true };
    }

    if (state.step === 'b2b_otp') {
      const otpCode = text.replace(/\D/g, '');
      if (otpCode.length !== 6) {
        await TelegramClient.sendMessage(chatId, '⚠️ Le code doit comporter exactement 6 chiffres.');
        return { success: true };
      }

      const otp = await WithdrawalOtpService.verifyWithdrawalOtp({ merchantId: merchant.id, code: otpCode });
      if (!otp.success) {
        await TelegramClient.sendMessage(chatId, `❌ <b>Code refusé</b>\n\n${this.escapeHtml(otp.error || 'Code invalide.')}`, { parse_mode: 'HTML' });
        return { success: true };
      }

      await TelegramClient.sendMessage(chatId, '⏳ Comptabilisation du transfert en cours...');
      const transfer = await B2BTransferService.processTransfer({
        senderId: merchant.id,
        receiverEmail: state.receiverEmail,
        amount: Number(state.amount),
        environment: 'live',
        source: 'telegram',
      });
      await this.updateSessionState(chatId, {});

      if (!transfer.success) {
        await TelegramClient.sendMessage(
          chatId,
          `❌ <b>Transfert non effectué</b>\n\n${this.escapeHtml(transfer.error || 'Le transfert a échoué.')}`,
          { parse_mode: 'HTML', reply_markup: this.getMainKeyboard() },
        );
        return { success: true };
      }

      await TelegramClient.sendMessage(
        chatId,
        `✅ <b>TRANSFERT B2B RÉUSSI</b>\n\n💰 <b>Montant :</b> ${Number(state.amount).toLocaleString('fr-HT')} HTG\n🏢 <b>Destinataire :</b> ${this.escapeHtml(transfer.receiverBusinessName || state.receiverBusinessName)}\n🆔 <b>Référence :</b> <code>${this.escapeHtml(transfer.reference || transfer.transferId || '')}</code>\n💼 <b>Nouveau solde :</b> ${Number(transfer.senderBalanceAfter || 0).toLocaleString('fr-HT')} HTG`,
        { parse_mode: 'HTML', reply_markup: this.getMainKeyboard() },
      );
      return { success: true };
    }

    // --- CRÉATION DE LIEN ---
    if (state.step === 'link_amount') {
      const amount = parseFloat(text.replace(/,/g, '.').replace(/[^0-9.]/g, ''));
      if (isNaN(amount) || amount <= 0) {
        await TelegramClient.sendMessage(chatId, "⚠️ Montant invalide. Veuillez saisir un nombre (ex: <code>1000</code>) :", { parse_mode: 'HTML' });
        return { success: true };
      }

      await this.updateSessionState(chatId, { step: 'link_title', amount });
      await TelegramClient.sendMessage(chatId, `Montant : <b>${amount.toLocaleString('fr-HT')} HTG</b>\n\nSaisissez maintenant le <b>titre ou la description</b> du paiement (ex: <code>Abonnement Mensuel</code> ou <code>Commande #402</code>) :`, { parse_mode: 'HTML' });
      return { success: true };
    }

    if (state.step === 'link_title') {
      const title = text.trim();
      const amount = state.amount;
      const crypto = await import('crypto');
      const slug = crypto.randomUUID().replace(/-/g, '').substring(0, 10);

      // Créer le lien de paiement LIVE en base avec le slug obligatoire
      const { data: newLink, error } = await supabase
        .from('payment_links')
        .insert({
          merchant_id: merchant.id,
          title: title,
          description: `Lien créé via Telegram Bot pour ${merchant.business_name}`,
          amount: amount,
          currency: 'HTG',
          status: 'active',
          slug: slug,
          environment: 'live',
          metadata: {
            created_via: 'telegram_bot',
          },
        })
        .select('*')
        .single();

      await this.updateSessionState(chatId, {});

      if (error || !newLink) {
        console.error('[TelegramBotService] Error creating payment link:', error);
        await TelegramClient.sendMessage(chatId, `❌ Erreur lors de la création du lien : ${error?.message || 'Erreur base de données'}`, { reply_markup: this.getMainKeyboard() });
        return { success: true };
      }

      const payUrl = `https://kobara.app/pay/${newLink.id}`;
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Bonjour, voici votre lien de paiement sécurisé pour ${title} (${amount} HTG) : ${payUrl}`)}`;

      await TelegramClient.sendMessage(
        chatId,
        `✅ <b>Lien de Paiement Créé (Mode Réel) !</b>\n\n📌 <b>Titre :</b> ${title}\n💰 <b>Montant :</b> ${amount.toLocaleString('fr-HT')} HTG\n🔗 <b>Lien :</b> <code>${payUrl}</code>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🟢 Partager sur WhatsApp', url: whatsappUrl }],
              [{ text: '🌐 Ouvrir le lien', url: payUrl }],
            ],
          },
        }
      );

      await TelegramClient.sendMessage(chatId, "Que souhaitez-vous faire d'autre ?", {
        reply_markup: this.getMainKeyboard(),
      });

      return { success: true };
    }

    // --- DEMANDE DE RETRAIT ---
    if (state.step === 'withdraw_crypto_amount') {
      const amount = Number(text.trim().replace(',', '.'));
      const minimumUsd = getCryptoWithdrawalMinimumUsd(state.cryptoCurrency);
      if (!Number.isFinite(amount) || amount < minimumUsd || Math.round(amount * 100) / 100 !== amount) {
        await TelegramClient.sendMessage(chatId, `⚠️ Le montant minimum pour ce réseau est de <b>${minimumUsd} USD</b>. Saisissez un montant avec deux décimales maximum.`, { parse_mode: 'HTML' });
        return { success: true };
      }

      try {
        const quote = await quoteNowPaymentsPayout({ payoutUsd: amount, currency: state.cryptoCurrency });
        if (quote.totalDebitUsd > Number(state.maxAvailableUsd || 0)) {
          await TelegramClient.sendMessage(
            chatId,
            `⚠️ Le total avec les frais est de <b>${quote.totalDebitUsd.toFixed(2)} USD</b>, mais votre solde retirable est de <b>${Number(state.maxAvailableUsd || 0).toFixed(2)} USD</b>.`,
            { parse_mode: 'HTML' },
          );
          return { success: true };
        }
        await this.updateSessionState(chatId, {
          ...state,
          step: 'withdraw_crypto_address',
          amount,
          cryptoQuote: quote,
        });
        const currency = getKobaraCryptoCurrency(state.cryptoCurrency);
        await TelegramClient.sendMessage(
          chatId,
          `💰 <b>Montant :</b> ${amount.toFixed(2)} USD\n🌐 <b>Token et réseau :</b> ${currency?.symbol || state.cryptoCurrency} · ${currency?.network || ''}\n💳 <b>Frais réseau :</b> ${quote.combinedFeeUsd.toFixed(2)} USD\n<b>Total débité :</b> ${quote.totalDebitUsd.toFixed(2)} USD\n\nSaisissez maintenant l'<b>adresse du portefeuille destinataire</b> :`,
          { parse_mode: 'HTML' },
        );
      } catch (error) {
        const message = getWithdrawalUserMessage(error, {
          fallback: 'L’estimation du retrait est temporairement indisponible.',
        });
        await TelegramClient.sendMessage(
          chatId,
          `❌ <b>Estimation indisponible</b>\n\n${this.escapeHtml(message)}\n\nAucun montant n’a été débité.`,
          { parse_mode: 'HTML' },
        );
      }
      return { success: true };
    }

    if (state.step === 'withdraw_crypto_address') {
      const address = text.trim();
      if (address.length < 8 || /\s/.test(address)) {
        await TelegramClient.sendMessage(chatId, '⚠️ Adresse invalide. Vérifiez-la puis réessayez.');
        return { success: true };
      }
      const currency = getKobaraCryptoCurrency(state.cryptoCurrency);
      const nextState = { ...state, receiver: address, method: 'Crypto', sourceCurrency: 'USD' };
      try {
        await this.beginWithdrawalSecurity(
          chatId,
          merchant,
          nextState,
          `Retrait : <b>${Number(state.amount).toFixed(2)} USD</b>\nRéseau : <b>${currency?.symbol || state.cryptoCurrency} · ${currency?.network || ''}</b>\nAdresse : <code>${this.escapeHtml(address)}</code>`,
        );
      } catch (error) {
        await TelegramClient.sendMessage(chatId, `❌ ${this.escapeHtml(error instanceof Error ? error.message : "Impossible d'envoyer le code de sécurité.")}`, { parse_mode: 'HTML' });
      }
      return { success: true };
    }

    if (state.step === 'withdraw_phone') {
      const phone = text.replace(/[^0-9]/g, '');
      if (phone.length < 8) {
        await TelegramClient.sendMessage(chatId, "⚠️ Numéro invalide. Veuillez saisir un numéro haïtien valide à 8 ou 11 chiffres (ex: <code>34567890</code>) :", { parse_mode: 'HTML' });
        return { success: true };
      }

      await this.updateSessionState(chatId, {
        ...state,
        step: 'withdraw_amount',
        receiver: phone,
      });

      await TelegramClient.sendMessage(
        chatId,
        `Numéro de réception : <b>${phone}</b> (${state.method})\nSolde max : <b>${state.maxAvailable.toLocaleString('fr-HT')} HTG</b>\n\nSaisissez le <b>montant à retirer</b> en HTG (minimum 150 HTG) :`,
        { parse_mode: 'HTML' }
      );
      return { success: true };
    }

    if (state.step === 'withdraw_amount') {
      const amount = parseFloat(text.replace(/,/g, '.').replace(/[^0-9.]/g, ''));
      if (isNaN(amount) || amount < 150) {
        await TelegramClient.sendMessage(chatId, "⚠️ Le montant minimum de retrait est de <b>150 HTG</b>.", { parse_mode: 'HTML' });
        return { success: true };
      }

      if (amount > state.maxAvailable) {
        await TelegramClient.sendMessage(chatId, `⚠️ Votre solde disponible est de <b>${state.maxAvailable.toLocaleString('fr-HT')} HTG</b>.`, { parse_mode: 'HTML' });
        return { success: true };
      }

      try {
        await this.beginWithdrawalSecurity(
          chatId,
          merchant,
          { ...state, amount, sourceCurrency: 'HTG' },
          `Retrait : <b>${amount.toLocaleString('fr-HT')} HTG</b>\nDestinataire : <b>${this.escapeHtml(state.receiver)}</b> (${this.escapeHtml(state.method)})`,
        );
      } catch (error) {
        await TelegramClient.sendMessage(chatId, `❌ ${this.escapeHtml(error instanceof Error ? error.message : "Impossible d'envoyer le code de sécurité.")}`, { parse_mode: 'HTML' });
      }

      return { success: true };
    }

    if (state.step === 'withdraw_otp') {
      const otpCode = normalizeSixDigitCode(text);
      if (!otpCode) {
        await TelegramClient.sendMessage(chatId, "⚠️ Le code doit comporter exactement 6 chiffres. Veuillez réessayer :", { parse_mode: 'HTML' });
        return { success: true };
      }

      if (state.securityMethod === 'totp') {
        const { data: settings } = await supabase
          .from('settings')
          .select('security_json')
          .eq('merchant_id', merchant.id)
          .maybeSingle();
        const secret = settings?.security_json?.totp_secret;
        const valid = secret && speakeasy.totp.verify({ secret, encoding: 'base32', token: otpCode, window: 1 });
        if (!valid) {
          await TelegramClient.sendMessage(chatId, '❌ <b>Code Authenticator invalide</b>\n\nVérifiez le code actuel puis réessayez.', { parse_mode: 'HTML' });
          return { success: true };
        }
      } else {
        const otpValidation = await WithdrawalOtpService.verifyWithdrawalOtp({ merchantId: merchant.id, code: otpCode });
        if (!otpValidation.success) {
          await TelegramClient.sendMessage(chatId, `❌ <b>Code incorrect ou expiré</b>\n\n${this.escapeHtml(otpValidation.error || 'Veuillez réessayer.')}`, { parse_mode: 'HTML' });
          return { success: true };
        }
      }

      // Exécuter le retrait réel
      await TelegramClient.sendMessage(chatId, "⏳ Traitement du retrait en cours...");

      const withdrawalResult = await WithdrawalService.processWithdrawal({
        merchantId: merchant.id,
        merchantEmail: merchant.email,
        amount: state.amount,
        method: state.method,
        sourceCurrency: state.sourceCurrency === 'USD' ? 'USD' : 'HTG',
        receiver: state.receiver,
        environment: 'live', // STRICTEMENT LIVE
        description: 'Retrait initié via Telegram Bot',
        cryptoCurrency: state.method === 'Crypto' ? state.cryptoCurrency : undefined,
        cryptoExtraId: state.method === 'Crypto' ? state.cryptoExtraId : undefined,
      });

      await this.updateSessionState(chatId, {});

      if (!withdrawalResult.success && !withdrawalResult.requiresManualApproval) {
        const message = getWithdrawalUserMessage(withdrawalResult.error, {
          refunded: withdrawalResult.refunded,
        });
        await TelegramClient.sendMessage(
          chatId,
          `❌ <b>Retrait non effectué</b>\n\n${this.escapeHtml(message)}`,
          { parse_mode: 'HTML', reply_markup: this.getMainKeyboard() }
        );
      } else {
        const isInstant = withdrawalResult.status === 'completed';
        const isCrypto = state.method === 'Crypto';
        const currency = isCrypto ? getKobaraCryptoCurrency(state.cryptoCurrency) : null;
        await TelegramClient.sendMessage(
          chatId,
          `✅ <b>${isInstant ? 'Retrait effectué avec succès' : 'Demande de retrait enregistrée'}</b>\n\n💰 <b>Montant :</b> ${isCrypto ? `${Number(state.amount).toFixed(2)} USD` : `${Number(state.amount).toLocaleString('fr-HT')} HTG`}\n${isCrypto ? `🌐 <b>Réseau :</b> ${currency?.symbol || state.cryptoCurrency} · ${currency?.network || ''}` : `📱 <b>Destinataire :</b> ${this.escapeHtml(state.receiver)} (${this.escapeHtml(state.method)})`}\n🆔 <b>Statut :</b> ${isInstant ? 'Complété' : 'En traitement'}\n\nVotre solde a été mis à jour.`,
          { parse_mode: 'HTML', reply_markup: this.getMainKeyboard() }
        );
      }

      return { success: true };
    }

    // --- ASSISTANT IA SUPPORT ---
    if (state.step === 'ai_question') {
      await TelegramClient.sendMessage(chatId, "🤖 <i>Recherche de la réponse en cours...</i>", { parse_mode: 'HTML' });
      
      try {
        const { TelegramAiAssistant } = await import('./telegram-ai-assistant');
        const aiResponse = await TelegramAiAssistant.answerMerchantQuery(text, merchant.business_name);

        await this.updateSessionState(chatId, {});

        // Format Markdown to Telegram HTML safely
        const formattedAiResponse = this.formatMarkdownForTelegram(aiResponse);

        await TelegramClient.sendMessage(
          chatId,
          `🤖 <b>RÉPONSE DE L'ASSISTANT IA KOBARA :</b>\n\n${formattedAiResponse}`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💬 Poser une autre question', callback_data: 'action:ask_ai' }],
                [{ text: '🟢 Contacter le Support WhatsApp', url: 'https://wa.me/50940035664?text=Bonjour,%20j%27ai%20besoin%20d%27assistance%20avec%20Kobara' }],
                [{ text: '📢 Rejoindre le Forum / Canal', url: 'https://t.me/KobaraCommunity' }],
              ],
            },
          }
        );
      } catch (aiErr: any) {
        console.error('[TelegramBotService] AI answer error:', aiErr);
        await this.updateSessionState(chatId, {});
        await TelegramClient.sendMessage(
          chatId,
          `🤖 <b>Assistant Kobara :</b>\n\nPour toute assistance immédiate, vous pouvez consulter notre documentation sur https://docs.kobara.app/docs/quickstart ou joindre directement notre équipe technique sur WhatsApp au +509 4003 5664.`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🟢 Support WhatsApp', url: 'https://wa.me/50940035664?text=Bonjour,%20j%27ai%20besoin%20d%27aide%20avec%20Kobara' }],
                [{ text: '🌐 Documentation', url: 'https://docs.kobara.app/docs/quickstart' }],
              ],
            },
          }
        );
      }

      return { success: true };
    }

    return { success: true };
  }

  /**
   * Convertit le Markdown standard de l'IA en balises HTML supportées par Telegram
   */
  private static formatMarkdownForTelegram(text: string): string {
    if (!text) return '';
    return text
      // Convert code blocks ```lang ... ``` -> <pre><code>...</code></pre>
      .replace(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Convert inline code `code` -> <code>code</code>
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Convert bold **text** -> <b>text</b>
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      // Convert italic *text* -> <i>text</i>
      .replace(/\*([^*]+)\*/g, '<i>$1</i>');
  }

  /**
   * Traitement des clics sur les boutons inline
   */
  private static async handleCallbackQuery(callbackQuery: any) {
    const chatId = callbackQuery.message?.chat?.id;
    const data = callbackQuery.data;

    await TelegramClient.answerCallbackQuery(callbackQuery.id);

    const account = await this.getLinkedMerchant(chatId);
    if (!account) return { success: true };

    const { merchant } = account;

    const messageId = callbackQuery.message?.message_id;

    if (data === 'action:main_menu') {
      await this.updateSessionState(chatId, {});
      if (messageId) {
        await TelegramClient.deleteMessage(chatId, messageId);
      }
      await TelegramClient.sendMessage(
        chatId,
        `🏠 <b>MENU PRINCIPAL KOBARA</b>\n\nSélectionnez une option ci-dessous :`,
        {
          parse_mode: 'HTML',
          reply_markup: this.getMainKeyboard(),
        }
      );
      return { success: true };
    }

    if (data === 'action:withdraw') {
      return this.startWithdrawFlow(chatId, merchant, messageId);
    }

    if (data === 'action:b2b') {
      return this.startB2BTransferFlow(chatId, merchant, messageId);
    }

    if (data === 'action:create_link') {
      return this.startCreateLinkFlow(chatId, messageId);
    }

    if (data === 'action:referral') {
      return this.handleMerchantReferral(chatId, merchant, messageId);
    }

    if (data === 'action:create_usd_account') {
      const adminClient = createAdminClient();
      const { PayPalService } = await import('@/lib/server/payments/paypal');
      const isEligible = await PayPalService.isMerchantEligible(merchant);
      if (!isEligible) {
        await TelegramClient.sendMessage(
          chatId,
          `⚠️ <b>Compte USD indisponible</b>\n\nVotre compte n'est pas encore autorisé à recevoir des paiements internationaux. Contactez le support Kobara.`,
          { parse_mode: 'HTML' },
        );
        return { success: true };
      }

      const { error: merchantUpdateError } = await adminClient
        .from('merchants')
        .update({ has_usd_account: true } as any)
        .eq('id', merchant.id);
      if (merchantUpdateError) throw merchantUpdateError;
      
      const { data: curSettings } = await adminClient.from('settings').select('*').eq('merchant_id', merchant.id).maybeSingle();
      const updatedSettings = { ...(curSettings?.settings_json || {}), has_usd_account: true };
      if (curSettings) {
        const { error } = await adminClient.from('settings').update({ settings_json: updatedSettings, updated_at: new Date().toISOString() }).eq('merchant_id', merchant.id);
        if (error) throw error;
      } else {
        const { error } = await adminClient.from('settings').insert({ merchant_id: merchant.id, settings_json: updatedSettings });
        if (error) throw error;
      }

      await adminClient.from('audit_logs').insert({
        merchant_id: merchant.id,
        action: 'merchant.usd_account_created',
        metadata: { source: 'telegram', telegram_chat_id: chatId, timestamp: new Date().toISOString() },
      });

      await TelegramClient.sendMessage(
        chatId,
        `✅ <b>Compte USD activé avec succès !</b>\n\nVotre compte peut désormais recevoir des paiements par <b>Carte Bancaire</b>, <b>Apple Pay</b>, <b>Google Pay</b> et <b>PayPal</b>.`,
        { parse_mode: 'HTML' }
      );
      return this.handleBalance(chatId, merchant, messageId);
    }

    if (data === 'action:balance') {
      return this.handleBalance(chatId, merchant, messageId);
    }

    if (data === 'action:ask_ai') {
      await this.updateSessionState(chatId, { step: 'ai_question' });
      if (messageId) {
        await TelegramClient.deleteMessage(chatId, messageId);
      }
      await TelegramClient.sendMessage(
        chatId,
        `🤖 <b>Assistant IA Kobara (Support 24/7)</b>\n\nPosez votre question ci-dessous (ex: <i>"Comment intégrer l'API MonCash ?"</i>, <i>"Quels sont les frais de retrait ?"</i>, <i>"Comment vérifier mon compte KYC ?"</i>) :\n\n<i>Tapez /cancel pour revenir au menu.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [[{ text: '❌ Annuler' }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
      return { success: true };
    }

    if (data === 'action:subscription') {
      return this.handleSubscription(chatId, merchant, messageId);
    }

    if (data === 'sub:upgrade') {
      return this.showPlanUpgradeList(chatId, merchant, messageId);
    }

    if (data === 'sub:renew') {
      const { getMerchantSubscriptionEntitlement } = await import('@/lib/server/plans');
      const entitlementData = await getMerchantSubscriptionEntitlement(merchant.id);
      const planSlug = entitlementData.plan?.slug && entitlementData.plan.slug !== 'free'
        ? entitlementData.plan.slug
        : 'pro';
      return this.showPlanCycleSelection(chatId, planSlug, true, messageId);
    }

    if (data.startsWith('sub_select:')) {
      const planSlug = data.split(':')[1];
      return this.showPlanCycleSelection(chatId, planSlug, false, messageId);
    }

    if (data.startsWith('sub_cycle:')) {
      const parts = data.split(':');
      const planSlug = parts[1];
      const cycle = parts[2] === 'yearly' ? 'yearly' : 'monthly';
      const isRenew = parts[3] === 'renew';
      return this.showPlanMethodSelection(chatId, planSlug, cycle, isRenew, messageId);
    }

    if (data.startsWith('sub_pay:')) {
      const parts = data.split(':');
      const planSlug = parts[1];
      const cycle = parts[2] === 'yearly' ? 'yearly' : 'monthly';
      if (parts[3] === 'balance') {
        return this.purchaseSubscriptionWithBalance(chatId, merchant, planSlug, cycle, messageId);
      }
      const method = parts[3] === 'natcash' ? 'natcash' : 'moncash';
      return this.generateSubscriptionPaymentLink(chatId, merchant, planSlug, cycle, method, messageId);
    }

    if (data.startsWith('withdraw_method:')) {
      const method = data.split(':')[1];
      const session = (account.link.session_state || {}) as any;

      if (messageId) {
        await TelegramClient.deleteMessage(chatId, messageId);
      }

      if (method === 'crypto') {
        const rows = KOBARA_CRYPTO_CURRENCIES.map((currency) => [{
          text: `${currency.symbol} · ${currency.network} · min. ${getCryptoWithdrawalMinimumUsd(currency.id)} USD`,
          callback_data: `withdraw_crypto:${currency.id}`,
        }]);
        rows.push([{ text: '🔙 Retour', callback_data: 'action:withdraw' }]);
        await this.updateSessionState(chatId, { ...session, method: 'Crypto', sourceCurrency: 'USD' });
        await TelegramClient.sendMessage(
          chatId,
          `Choisissez le <b>token et le réseau</b>.\n\nSolde USD retirable : <b>${Number(session.maxAvailableUsd || 0).toFixed(2)} USD</b>`,
          { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } },
        );
        return { success: true };
      }

      const savedNumber = method === 'moncash' ? session.savedMoncash : session.savedNatcash;

      if (savedNumber) {
        // Proposer d'utiliser le numéro enregistré ou d'en taper un nouveau
        await this.updateSessionState(chatId, {
          ...session,
          method: method.toUpperCase(),
          step: 'withdraw_phone',
        });

        await TelegramClient.sendMessage(
          chatId,
          `📱 Méthode choisie : <b>${method.toUpperCase()}</b>\n\nNuméro habituel détecté : <code>${savedNumber}</code>\n\nTapez <b>${savedNumber}</b> pour l'utiliser, ou saisissez un <b>nouveau numéro</b> :`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [[{ text: savedNumber }], [{ text: '❌ Annuler' }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }
        );
      } else {
        await this.updateSessionState(chatId, {
          ...session,
          method: method.toUpperCase(),
          step: 'withdraw_phone',
        });

        await TelegramClient.sendMessage(
          chatId,
          `📱 Méthode choisie : <b>${method.toUpperCase()}</b>\n\nVeuillez saisir le <b>numéro de téléphone de réception</b> (ex: <code>34567890</code>) :`,
          { parse_mode: 'HTML' }
        );
      }
    }

    if (data.startsWith('withdraw_crypto:')) {
      const currencyId = data.split(':')[1];
      const currency = getKobaraCryptoCurrency(currencyId);
      const session = (account.link.session_state || {}) as any;
      if (!currency) {
        await TelegramClient.sendMessage(chatId, '⚠️ Ce token ou ce réseau n’est pas disponible.');
        return { success: true };
      }
      if (messageId) {
        await TelegramClient.deleteMessage(chatId, messageId);
      }
      await this.updateSessionState(chatId, {
        ...session,
        step: 'withdraw_crypto_amount',
        method: 'Crypto',
        sourceCurrency: 'USD',
        cryptoCurrency: currency.id,
      });
      await TelegramClient.sendMessage(
        chatId,
        `🌐 Réseau choisi : <b>${currency.symbol} · ${currency.network}</b>\nSolde maximum : <b>${Number(session.maxAvailableUsd || 0).toFixed(2)} USD</b>\nMinimum : <b>${getCryptoWithdrawalMinimumUsd(currency.id)} USD</b>\n\nSaisissez le montant du retrait en USD :`,
        { parse_mode: 'HTML' },
      );
      return { success: true };
    }

    return { success: true };
  }

  /**
   * Envoie ou modifie un message en place pour effacer/remplacer le contenu précédent
   */
  private static async sendOrEditMessage(
    chatId: string | number,
    text: string,
    options?: any,
    messageId?: number
  ) {
    if (messageId) {
      const editRes = await TelegramClient.editMessageText(chatId, messageId, text, options);
      if (editRes?.success) return editRes;
    }
    return await TelegramClient.sendMessage(chatId, text, options);
  }

  /**
   * Consultation du plan / abonnement réel du compte marchand
   */
  private static async handleSubscription(chatId: string | number, merchant: any, messageId?: number) {
    try {
      const { getMerchantSubscriptionEntitlement } = await import('@/lib/server/plans');
      const entitlementData = await getMerchantSubscriptionEntitlement(merchant.id);

      const plan = entitlementData.plan;
      const entitlement = entitlementData.entitlement;
      const sub = entitlementData.subscription;

      const planName = plan?.name || 'Starter (Gratuit)';
      const isPaidPlan = plan && plan.slug !== 'free' && Number(plan.price_htg) > 0;

      let statusLabel = '⚪ Gratuit / Starter';
      if (entitlement.status === 'active') {
        statusLabel = '🟢 Actif';
      } else if (entitlement.status === 'grace_period') {
        statusLabel = '🟡 Période de Grâce (Renouvellement requis)';
      } else if (entitlement.status === 'expired') {
        statusLabel = '🔴 Expiré';
      }

      const cycleLabel = sub?.billing_cycle === 'yearly' ? 'Annuel' : 'Mensuel';
      const expiresAt = sub?.current_period_end
        ? new Date(sub.current_period_end).toLocaleDateString('fr-HT')
        : 'Sans date d\'expiration';

      const buttons: any[] = [];

      if (isPaidPlan) {
        buttons.push([{ text: '⬆️ Changer de Plan (Upgrade)', callback_data: 'sub:upgrade' }]);
        // Le bouton renouveler s'affiche pour le plan actif ou s'il est expiré
        buttons.push([{ text: '🔄 Renouveler mon Plan Actif', callback_data: 'sub:renew' }]);
      } else {
        buttons.push([{ text: '⭐ Choisir un Plan Pro ou Business', callback_data: 'sub:upgrade' }]);
      }
      buttons.push([{ text: '🔙 Retour au Menu Principal', callback_data: 'action:main_menu' }]);

      await this.sendOrEditMessage(
        chatId,
        `
⭐ <b>MON ABONNEMENT KOBARA</b>

🏢 <b>Marchand :</b> ${merchant.business_name}
📦 <b>Plan Actif :</b> <b>${planName}</b>
🆔 <b>Statut :</b> ${statusLabel}
${isPaidPlan ? `📅 <b>Date de fin :</b> ${expiresAt}\n💳 <b>Facturation :</b> ${cycleLabel}\n` : ''}
<i>Vous pouvez changer de plan ou le renouveler directement depuis ce bot.</i>
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons },
        },
        messageId
      );
    } catch (err: any) {
      console.error('[TelegramBotService] handleSubscription error:', err);
      await TelegramClient.sendMessage(chatId, "Erreur lors de la récupération de votre abonnement.");
    }
  }

  /**
   * Affiche la liste des plans disponibles pour Upgrade
   */
  private static async showPlanUpgradeList(chatId: string | number, merchant: any, messageId?: number) {
    try {
      const { getPlans } = await import('@/lib/server/plans');
      const allPlans = await getPlans();
      const paidPlans = allPlans.filter((p: any) => p.slug !== 'free' && Number(p.price_htg) > 0);

      const buttons = paidPlans.map((p: any) => [
        {
          text: `🚀 ${p.name} — ${Number(p.price_htg).toLocaleString('fr-HT')} HTG/mois`,
          callback_data: `sub_select:${p.slug}`,
        },
      ]);

      buttons.push([
        { text: '🔙 Retour à mon abonnement', callback_data: 'action:subscription' },
        { text: '🏠 Menu Principal', callback_data: 'action:main_menu' },
      ]);

      await this.sendOrEditMessage(
        chatId,
        `
🚀 <b>CHOISIR UN PLAN KOBARA</b>

Sélectionnez le plan adapté à vos besoins d'encaissement et de gestion :
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons },
        },
        messageId
      );
    } catch (err: any) {
      console.error('[TelegramBotService] showPlanUpgradeList error:', err);
      await TelegramClient.sendMessage(chatId, "Impossible de charger la liste des plans.");
    }
  }

  /**
   * Affiche le choix du cycle de facturation (Mensuel ou Annuel)
   */
  private static async showPlanCycleSelection(
    chatId: string | number,
    planSlug: string,
    isRenew = false,
    messageId?: number
  ) {
    try {
      const { getPlanBySlug } = await import('@/lib/server/plans');
      const plan = await getPlanBySlug(planSlug);

      if (!plan) {
        await TelegramClient.sendMessage(chatId, "Plan introuvable.");
        return;
      }

      const monthlyPrice = Number(plan.price_htg);
      const yearlyPrice = Math.round(monthlyPrice * 0.8 * 12); // -20% discount

      const buttons = [
        [
          {
            text: `📅 Mensuel : ${monthlyPrice.toLocaleString('fr-HT')} HTG/mois`,
            callback_data: `sub_cycle:${plan.slug}:monthly:${isRenew ? 'renew' : 'upgrade'}`,
          },
        ],
        [
          {
            text: `📆 Annuel : ${yearlyPrice.toLocaleString('fr-HT')} HTG/an (-20%)`,
            callback_data: `sub_cycle:${plan.slug}:yearly:${isRenew ? 'renew' : 'upgrade'}`,
          },
        ],
        [
          { text: '🔙 Retour', callback_data: isRenew ? 'action:subscription' : 'sub:upgrade' },
          { text: '🏠 Menu Principal', callback_data: 'action:main_menu' },
        ],
      ];

      await this.sendOrEditMessage(
        chatId,
        `
⭐ <b>${isRenew ? 'RENOUVELLEMENT' : 'PASSAGE AU'} ${plan.name.toUpperCase()}</b>

Choisissez votre période de facturation :
• <b>Mensuel :</b> <code>${monthlyPrice.toLocaleString('fr-HT')} HTG</code> / mois
• <b>Annuel :</b> <code>${yearlyPrice.toLocaleString('fr-HT')} HTG</code> / an <i>(2 mois offerts)</i>
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons },
        },
        messageId
      );
    } catch (err: any) {
      console.error('[TelegramBotService] showPlanCycleSelection error:', err);
      await TelegramClient.sendMessage(chatId, "Erreur lors du choix de cycle.");
    }
  }

  /**
   * Affiche le choix de la méthode de paiement (MonCash ou NatCash)
   */
  private static async showPlanMethodSelection(
    chatId: string | number,
    planSlug: string,
    billingCycle: 'monthly' | 'yearly',
    isRenew = false,
    messageId?: number
  ) {
    try {
      const { getPlanBySlug } = await import('@/lib/server/plans');
      const plan = await getPlanBySlug(planSlug);

      if (!plan) {
        await TelegramClient.sendMessage(chatId, "Plan introuvable.");
        return;
      }

      const monthlyPrice = Number(plan.price_htg);
      const amount = billingCycle === 'yearly' ? Math.round(monthlyPrice * 0.8 * 12) : monthlyPrice;

      const supabase = createAdminClient();
      const linkedAccount = await this.getLinkedMerchant(chatId);
      if (!linkedAccount) {
        await TelegramClient.sendMessage(chatId, '❌ Compte marchand non associé.');
        return;
      }
      const { data: freshMerchant } = await supabase
        .from('merchants')
        .select('available_balance')
        .eq('id', linkedAccount.merchant.id)
        .maybeSingle();
      const accountBalance = Number(freshMerchant?.available_balance || 0);

      const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
      if (accountBalance >= amount) {
        buttons.push([
          {
            text: `💰 Payer avec mon solde (${amount.toLocaleString('fr-HT')} HTG)`,
            callback_data: `sub_pay:${plan.slug}:${billingCycle}:balance`,
          },
        ]);
      }
      buttons.push(
        [
          {
            text: `📱 Payer avec MonCash (${amount.toLocaleString('fr-HT')} HTG)`,
            callback_data: `sub_pay:${plan.slug}:${billingCycle}:moncash`,
          },
        ],
        [
          {
            text: `📲 Payer avec NatCash (${amount.toLocaleString('fr-HT')} HTG)`,
            callback_data: `sub_pay:${plan.slug}:${billingCycle}:natcash`,
          },
        ],
        [
          { text: '🔙 Changer de période', callback_data: `sub_select:${plan.slug}` },
          { text: '🏠 Menu Principal', callback_data: 'action:main_menu' },
        ],
      );

      await this.sendOrEditMessage(
        chatId,
        `
💳 <b>MÉTHODE DE PAIEMENT POUR ${plan.name.toUpperCase()}</b>

📦 <b>Plan :</b> ${plan.name} (${billingCycle === 'yearly' ? 'Annuel' : 'Mensuel'})
💰 <b>Montant :</b> <code>${amount.toLocaleString('fr-HT')} HTG</code>

Choisissez comment vous souhaitez effectuer votre paiement :
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons },
        },
        messageId
      );
    } catch (err: any) {
      console.error('[TelegramBotService] showPlanMethodSelection error:', err);
      await TelegramClient.sendMessage(chatId, "Erreur lors du choix de méthode.");
    }
  }

  /** Débite atomiquement le solde Kobara et active le plan. */
  private static async purchaseSubscriptionWithBalance(
    chatId: string | number,
    merchant: any,
    planSlug: string,
    billingCycle: 'monthly' | 'yearly',
    messageId?: number
  ) {
    try {
      const { getPlanBySlug, notifyMerchantPlanTransition } = await import('@/lib/server/plans');
      const plan = await getPlanBySlug(planSlug);
      if (!plan || plan.slug === 'free' || Number(plan.price_htg) <= 0) {
        await TelegramClient.sendMessage(chatId, '❌ Ce plan ne peut pas être acheté avec le solde.');
        return;
      }

      const amount = billingCycle === 'yearly'
        ? Math.round(Number(plan.price_htg) * 0.8 * 12)
        : Number(plan.price_htg);
      const supabase = createAdminClient();
      const { data: freshMerchant } = await supabase
        .from('merchants')
        .select('email, plan_slug, available_balance')
        .eq('id', merchant.id)
        .maybeSingle();

      if (Number(freshMerchant?.available_balance || 0) < amount) {
        await TelegramClient.sendMessage(
          chatId,
          '⚠️ Votre solde n’est plus suffisant. Choisissez MonCash ou NatCash.',
          { reply_markup: { inline_keyboard: [[{ text: '🔄 Choisir un moyen', callback_data: `sub_cycle:${plan.slug}:${billingCycle}:upgrade` }]] } },
        );
        return;
      }

      const { data: subscriptionId, error } = await supabase.rpc('purchase_subscription_from_balance', {
        p_merchant_id: merchant.id,
        p_plan_id: plan.id,
        p_billing_cycle: billingCycle,
        p_amount_htg: amount,
        p_activation_source: 'balance',
      });
      if (error) {
        const message = error.message.includes('insufficient_balance')
          ? '⚠️ Votre solde n’est plus suffisant. Choisissez un autre moyen de paiement.'
          : '❌ Impossible d’activer le plan avec votre solde. Veuillez réessayer.';
        await TelegramClient.sendMessage(chatId, message);
        return;
      }

      try {
        await notifyMerchantPlanTransition({
          merchantId: merchant.id,
          email: freshMerchant?.email || merchant.email || '',
          previousPlanSlug: freshMerchant?.plan_slug || merchant.plan_slug || null,
          newPlan: plan,
          source: 'balance',
          resourceId: String(subscriptionId),
        });
      } catch (notificationError) {
        console.error('[TelegramBotService] Balance plan notification failed:', notificationError);
      }

      try {
        const { processPartnerPlanActivation } = await import('@/lib/server/partners/program');
        await processPartnerPlanActivation({
          merchantId: merchant.id,
          subscriptionId: String(subscriptionId),
          planSlug: plan.slug,
          promoCodeId: null,
        });
      } catch (partnerError) {
        console.error('[TelegramBotService] Balance partner activation failed:', partnerError);
      }

      await this.sendOrEditMessage(
        chatId,
        `✅ <b>PLAN ACTIVÉ AVEC SUCCÈS</b>\n\n⭐ <b>Plan :</b> ${plan.name}\n💰 <b>Payé avec votre solde :</b> ${amount.toLocaleString('fr-HT')} HTG\n📅 <b>Période :</b> ${billingCycle === 'yearly' ? 'Annuelle' : 'Mensuelle'}`,
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '⭐ Voir mon abonnement', callback_data: 'action:subscription' }], [{ text: '🏠 Menu principal', callback_data: 'action:main_menu' }]] },
        },
        messageId,
      );
    } catch (error) {
      console.error('[TelegramBotService] purchaseSubscriptionWithBalance error:', error);
      await TelegramClient.sendMessage(chatId, '❌ Impossible d’activer le plan avec votre solde.');
    }
  }

  /**
   * Génère le lien de paiement sécurisé MonCash ou NatCash pour l'abonnement
   */
  private static async generateSubscriptionPaymentLink(
    chatId: string | number,
    merchant: any,
    planSlug: string,
    billingCycle: 'monthly' | 'yearly',
    method: 'moncash' | 'natcash' = 'moncash',
    messageId?: number
  ) {
    try {
      const { getPlanBySlug } = await import('@/lib/server/plans');
      const plan = await getPlanBySlug(planSlug);

      if (!plan) {
        await TelegramClient.sendMessage(chatId, "Plan introuvable.");
        return;
      }

      const monthlyPrice = Number(plan.price_htg);
      const amount = billingCycle === 'yearly' ? Math.round(monthlyPrice * 0.8 * 12) : monthlyPrice;

      const { getPaymentProviderConfig, createPaymentGateway } = await import('@/lib/server/payments/gateway');
      const {
        createPaymReference,
        normalizePaymAmount,
        withPaymentRoutingMetadata,
      } = await import('@/lib/payment-routing');

      const providerConfig = await getPaymentProviderConfig();
      let finalAmount = amount;

      // Normalisation du montant pour NatCash si Pay'm est le fournisseur actif
      if (method === 'natcash' && providerConfig.active_provider === 'paym') {
        finalAmount = normalizePaymAmount('natcash', finalAmount);
      }

      const supabase = createAdminClient();
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'KobaraPayBot';
      const telegramReturnUrl = `https://t.me/${botUsername}`;

      const subscriptionMetadata = {
        is_subscription_upgrade: true,
        plan_slug: planSlug,
        billing_cycle: billingCycle,
        merchant_id: merchant.id,
        initiated_from: 'telegram_bot',
        telegram_chat_id: String(chatId),
        expected_amount: finalAmount,
        success_url: telegramReturnUrl,
        cancel_url: telegramReturnUrl,
      };

      // Une nouvelle tentative doit avoir sa propre référence fournisseur. Réutiliser
      // une ancienne référence peut laisser le nouveau paiement bloqué en attente.
      await supabase
        .from('payments')
        .update({ status: 'expired' })
        .eq('merchant_id', merchant.id)
        .eq('status', 'pending')
        .filter('metadata->is_subscription_upgrade', 'eq', true)
        .filter('metadata->initiated_from', 'eq', 'telegram_bot');

      const reference = createPaymReference('SUB');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const { data: payment, error } = await supabase
        .from('payments')
        .insert({
          merchant_id: merchant.id,
          amount: finalAmount,
          net_amount: finalAmount,
          fee_amount: 0,
          currency: 'HTG',
          status: 'pending',
          environment: 'live',
          provider: method,
          payment_method: method,
          kobara_reference: reference,
          expires_at: expiresAt,
          success_url: telegramReturnUrl,
          error_url: telegramReturnUrl,
          metadata: subscriptionMetadata,
        })
        .select('*')
        .single();

      if (error || !payment) {
        console.error('[TelegramBotService] Failed to create subscription payment:', error);
        await TelegramClient.sendMessage(chatId, `❌ Erreur lors de l'initialisation du paiement : ${error?.message || 'Erreur backend'}`);
        return;
      }

      // 2. Initialiser la passerelle de paiement unique (MonCash ou NatCash via Pay'm/Bazik)
      let gatewayPaymentUrl: string | null = null;
      try {
        const gatewayRes = await createPaymentGateway({
          amount: finalAmount,
          reference,
          provider: method,
          description: `Abonnement Kobara - Plan ${plan.name} (${billingCycle === 'yearly' ? 'Annuel' : 'Mensuel'})`,
          environment: 'live',
          successUrl: telegramReturnUrl,
          cancelUrl: telegramReturnUrl,
          errorUrl: telegramReturnUrl,
        });

        if (gatewayRes?.paymentUrl) {
          const directPaymentUrl = new URL(gatewayRes.paymentUrl);
          if (directPaymentUrl.protocol !== 'https:') {
            throw new Error("L’URL directe de paiement n’est pas sécurisée.");
          }
          gatewayPaymentUrl = directPaymentUrl.toString();
        }

        const { error: routingError } = await supabase
          .from('payments')
          .update({
            provider: method,
            payment_method: gatewayRes.paymentMethod,
            bazik_order_id: gatewayRes.processor === 'bazik' ? gatewayRes.orderId : null,
            bazik_transaction_id: gatewayRes.transactionId,
            metadata: {
              ...withPaymentRoutingMetadata(
                subscriptionMetadata,
                gatewayRes.route,
                gatewayRes.transactionId,
              ),
              ...(gatewayRes.processor === 'paym' && gatewayRes.paymentUrl
                ? { provider_checkout_url: gatewayRes.paymentUrl }
                : {}),
            },
          })
          .eq('id', payment.id);
        if (routingError) throw routingError;

      } catch (gwErr: any) {
        console.warn('[TelegramBotService] Direct gateway initialization note:', gwErr?.message);
        await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id).eq('status', 'pending');
        throw gwErr;
      }

      // 3. Déterminer l'URL finale de paiement (Passerelle directe ou Page de paiement sécurisée)
      const finalCheckoutUrl = gatewayPaymentUrl || (method === 'natcash'
        ? `https://kobara.app/pay/checkout/${payment.id}/natcash`
        : `https://kobara.app/pay/checkout/${payment.id}`);

      const methodIcon = method === 'natcash' ? '📲' : '📱';
      const methodName = method === 'natcash' ? 'NatCash' : 'MonCash';

      await this.sendOrEditMessage(
        chatId,
        `
${methodIcon} <b>PAIEMENT ${methodName.toUpperCase()} PRÊT</b>

📦 <b>Plan :</b> ${plan.name} (${billingCycle === 'yearly' ? 'Annuel' : 'Mensuel'})
💰 <b>Montant :</b> <code>${finalAmount.toLocaleString('fr-HT')} HTG</code>
🆔 <b>Réf :</b> <code>${reference}</code>
💳 <b>Mode :</b> ${methodName}

Cliquez ci-dessous pour effectuer votre paiement sur <b>${methodName}</b>. Dès confirmation, votre plan sera mis à niveau instantanément et vous recevrez votre confirmation directement ici !
        `.trim(),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: `${methodIcon} Payer avec ${methodName} (${finalAmount.toLocaleString('fr-HT')} HTG)`, url: finalCheckoutUrl }],
              [{ text: '🔄 Choisir un autre moyen', callback_data: `sub_cycle:${plan.slug}:${billingCycle}:upgrade` }],
              [{ text: '🔙 Retour au Menu Principal', callback_data: 'action:main_menu' }],
            ],
          },
        },
        messageId
      );
    } catch (err: any) {
      console.error('[TelegramBotService] generateSubscriptionPaymentLink error:', err);
      await TelegramClient.sendMessage(chatId, "Erreur lors de la préparation du paiement.");
    }
  }

  /**
   * Paramètres & statut
   */
  private static async handleSettings(chatId: string | number, link: any, merchant: any, messageId?: number) {
    await this.sendOrEditMessage(
      chatId,
      `🔔 <b>PARAMÈTRES TELEGRAM</b>\n\n🏢 <b>Marchand :</b> ${merchant.business_name}\n📧 <b>Email :</b> ${merchant.email}\n🔔 <b>Notifications directes :</b> ${link.notifications_enabled ? 'Activées' : 'Désactivées'}\n\nPour dissocier votre compte Telegram, rendez-vous sur vos paramètres Kobara :\nhttps://kobara.app/dashboard/settings`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌐 Ouvrir mes paramètres Web', url: 'https://kobara.app/dashboard/settings' }],
            [{ text: '🔙 Retour au Menu Principal', callback_data: 'action:main_menu' }],
          ],
        },
      },
      messageId
    );
  }

  /**
   * Parrainage marchand avec statistiques, règles et liens de partage.
   */
  private static async handleMerchantReferral(
    chatId: string | number,
    merchant: any,
    messageId?: number,
  ) {
    const supabase = createAdminClient();
    const [{ data: freshMerchant, error: merchantError }, referrals, rewards, ownPayments] = await Promise.all([
      supabase
        .from('merchants')
        .select('business_name, referral_code')
        .eq('id', merchant.id)
        .maybeSingle(),
      supabase
        .from('merchant_referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_merchant_id', merchant.id),
      supabase
        .from('partner_commission_ledger')
        .select('amount')
        .eq('beneficiary_type', 'merchant_referral')
        .eq('merchant_id', merchant.id)
        .eq('entry_type', 'merchant_referral_reward')
        .eq('currency', 'HTG')
        .eq('status', 'paid'),
      supabase
        .from('payments')
        .select('amount')
        .eq('merchant_id', merchant.id)
        .eq('environment', 'live')
        .eq('currency', 'HTG')
        .in('status', ['succeeded', 'success', 'completed'])
        .or('payment_link_id.not.is.null,api_key_id.not.is.null')
        .or('api_key_origin.is.null,api_key_origin.neq.developer'),
    ]);

    if (merchantError || !freshMerchant?.referral_code) {
      await this.sendOrEditMessage(
        chatId,
        `⚠️ <b>Parrainage indisponible</b>\n\nVotre lien personnel ne peut pas être chargé pour le moment. Réessayez dans quelques instants.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 Retour au Menu Principal', callback_data: 'action:main_menu' }]],
          },
        },
        messageId,
      );
      return { success: true };
    }

    const referralUrl = `https://kobara.app/r/${encodeURIComponent(freshMerchant.referral_code)}`;
    const shareText = `Rejoignez Kobara avec l'invitation de ${freshMerchant.business_name || merchant.business_name}.`;
    const shareUrl = encodeURIComponent(referralUrl);
    const shareMessage = encodeURIComponent(`${shareText} ${referralUrl}`);
    const earnedHtg = (rewards.data ?? []).reduce(
      (sum, entry) => sum + Number(entry.amount || 0),
      0,
    );
    const ownQualifyingHtg = (ownPayments.data ?? []).reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );

    const message = [
      '🎁 <b>RECEVEZ 675 GDES</b>',
      '',
      'Invitez un marchand Kobara avec votre lien personnel :',
      `<code>${this.escapeHtml(referralUrl)}</code>`,
      '',
      `👥 <b>Personnes invitées :</b> ${referrals.count ?? 0}`,
      `💰 <b>Commissions reçues :</b> ${earnedHtg.toLocaleString('fr-HT')} Gdes`,
      `📈 <b>Votre volume admissible :</b> ${ownQualifyingHtg.toLocaleString('fr-HT')} / 1 500 HTG`,
      '',
      '<b>Questions fréquentes</b>',
      '',
      '<b>Quand les 675 Gdes sont-ils versés ?</b>',
      "Après l'activation du plan Pro de votre invité et la réception de 10 000 HTG ou 50 USD de paiements. Votre entreprise doit aussi avoir reçu au moins 1 500 HTG.",
      '',
      '<b>Quels paiements comptent pour vos 1 500 HTG ?</b>',
      'Vos paiements réussis reçus via vos propres liens ou clés API. Les transactions créées avec une clé Developer sont exclues.',
    ].join('\n');

    await this.sendOrEditMessage(
      chatId,
      message,
      {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: '✈️ Partager sur Telegram', url: `https://t.me/share/url?url=${shareUrl}&text=${encodeURIComponent(shareText)}` }],
            [
              { text: 'WhatsApp', url: `https://wa.me/?text=${shareMessage}` },
              { text: 'Facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}` },
            ],
            [{ text: '🔙 Retour au Menu Principal', callback_data: 'action:main_menu' }],
          ],
        },
      },
      messageId,
    );

    return { success: true };
  }

  /**
   * Message d'aide avec redirection IA & Support WhatsApp
   */
  private static async handleHelp(chatId: string | number, merchant: any, messageId?: number) {
    await this.sendOrEditMessage(
      chatId,
      `❓ <b>CENTRE D'AIDE & SUPPORT KOBARA</b>\n\nBesoin d'aide avec votre compte <b>${merchant.business_name}</b> ?\n\n🏦 <b>Transfert B2B :</b> utilisez /b2b pour envoyer des HTG à un autre marchand Kobara vérifié.\n\n🤖 <b>Assistant IA :</b> Posez vos questions sur les paiements, APIs, frais ou retraits pour une réponse immédiate.\n\n🟢 <b>Support WhatsApp :</b> Notre équipe humaine est disponible au +509 4003 5664 (Lun-Ven, 9h-17h).\n\n📢 <b>Forum & Communauté :</b> Rejoignez les marchands et développeurs sur notre canal officiel.`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🤖 Poser une question à l\'IA', callback_data: 'action:ask_ai' }],
            [{ text: '🟢 Contacter le Support WhatsApp', url: 'https://wa.me/50940035664?text=Bonjour,%20j%27ai%20besoin%20d%27aide%20avec%20mon%20compte%20Kobara' }],
            [{ text: '📢 Rejoindre le Forum / Canal Telegram', url: 'https://t.me/KobaraCommunity' }],
            [{ text: '🌐 Documentation API', url: 'https://docs.kobara.app/docs/quickstart' }],
            [{ text: '🔙 Retour au Menu Principal', callback_data: 'action:main_menu' }],
          ],
        },
      },
      messageId
    );
  }

  /**
   * Met à jour la session conversationnelle en base
   */
  private static async updateSessionState(chatId: string | number, state: any) {
    const supabase = createAdminClient();
    await supabase
      .from('merchant_telegram_accounts')
      .update({
        session_state: state,
        updated_at: new Date().toISOString(),
      })
      .eq('telegram_chat_id', String(chatId));
  }

  private static escapeHtml(value: unknown) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
