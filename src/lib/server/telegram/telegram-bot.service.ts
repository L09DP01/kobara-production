import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';
import { TelegramClient, SendMessageOptions } from './telegram-client';
import { WithdrawalOtpService } from '@/lib/server/security/withdrawal-otp';
import { WithdrawalService } from '@/lib/server/withdrawals/withdrawal.service';
import { canCreateWithdrawal } from '@/lib/server/access';
import { getMerchantFundsAvailability } from '@/lib/server/withdrawals/funds-availability';
import { B2BTransferService } from '@/lib/server/transfers/b2b-transfer.service';

export class TelegramBotService {
  /**
   * Clavier principal du Bot Kobara
   */
  private static getMainKeyboard(): SendMessageOptions['reply_markup'] {
    return {
      keyboard: [
        [{ text: '💰 Mon Solde (Live)' }, { text: '🔗 Créer un Lien' }],
        [{ text: '🏦 Transfert B2B' }, { text: '💸 Demander un Retrait' }],
        [{ text: '⭐ Mon Abonnement' }],
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

    if (liveAvailable < 150) {
      if (messageId) {
        await TelegramClient.deleteMessage(chatId, messageId);
      }
      await TelegramClient.sendMessage(
        chatId,
        `⚠️ <b>Solde insuffisant</b>\n\nVotre solde disponible au retrait est de <b>${liveAvailable.toLocaleString('fr-HT')} HTG</b>.\nLe montant minimum de retrait est de <b>150 HTG</b>.`,
        { parse_mode: 'HTML', reply_markup: this.getMainKeyboard() }
      );
      return { success: true };
    }

    const accessCheck = await canCreateWithdrawal(merchant.id, 150);
    if (!accessCheck.allowed) {
      if (messageId) {
        await TelegramClient.deleteMessage(chatId, messageId);
      }
      await TelegramClient.sendMessage(
        chatId,
        `⚠️ <b>Retrait non autorisé</b>\n\n${accessCheck.reason === 'kyc_required' ? 'Vous devez vérifier votre compte (KYC) pour effectuer des retraits réels.' : 'Accès aux retraits restreint.'}\n\nRendez-vous sur votre dashboard : https://kobara.app/dashboard/withdrawals`,
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
    });

    const buttons: any[] = [];
    buttons.push([{ text: '📱 MonCash', callback_data: 'withdraw_method:moncash' }]);
    buttons.push([{ text: '📲 NatCash', callback_data: 'withdraw_method:natcash' }]);
    buttons.push([{ text: '🔙 Retour au Menu Principal', callback_data: 'action:main_menu' }]);

    await this.sendOrEditMessage(
      chatId,
      `💸 <b>Demande de Retrait (Mode Réel)</b>\n\nSolde disponible : <b>${liveAvailable.toLocaleString('fr-HT')} HTG</b>\n\nChoisissez la méthode de réception :`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      },
      messageId
    );

    return { success: true };
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
      await this.sendOrEditMessage(
        chatId,
        `⚠️ <b>Transfert B2B indisponible</b>\n\nVotre compte ne peut pas effectuer ce transfert pour le moment.`,
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
        await TelegramClient.sendMessage(chatId, "⚠️ Ce transfert dépasse une limite ou n'est pas autorisé pour votre compte.");
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

      // Envoyer le code OTP par email via le service de sécurité
      try {
        await WithdrawalOtpService.sendWithdrawalOtp({
          merchantId: merchant.id,
          userEmail: merchant.email,
          amount,
          method: state.method,
        });

        await this.updateSessionState(chatId, {
          ...state,
          step: 'withdraw_otp',
          amount,
        });

        await TelegramClient.sendMessage(
          chatId,
          `🔐 <b>Code de Sécurité Requis</b>\n\nUn code de confirmation à 6 chiffres a été envoyé à votre adresse e-mail (<b>${merchant.email}</b>).\n\nVeuillez saisir le code à 6 chiffres ici pour valider le retrait de <b>${amount.toLocaleString('fr-HT')} HTG</b> vers le <b>${state.receiver}</b> :`,
          { parse_mode: 'HTML' }
        );
      } catch (err: any) {
        await TelegramClient.sendMessage(chatId, `❌ Impossible d'envoyer le code de sécurité : ${err.message}`, { reply_markup: this.getMainKeyboard() });
        await this.updateSessionState(chatId, {});
      }

      return { success: true };
    }

    if (state.step === 'withdraw_otp') {
      const otpCode = text.replace(/[^0-9]/g, '').trim();
      if (otpCode.length !== 6) {
        await TelegramClient.sendMessage(chatId, "⚠️ Le code doit comporter exactement 6 chiffres. Veuillez réessayer :", { parse_mode: 'HTML' });
        return { success: true };
      }

      // Valider le code OTP
      const otpValidation = await WithdrawalOtpService.verifyWithdrawalOtp({
        merchantId: merchant.id,
        code: otpCode,
      });

      if (!otpValidation.success) {
        await TelegramClient.sendMessage(chatId, `❌ <b>Code incorrect ou expiré</b>\n\n${otpValidation.error || "Veuillez recommencer."}`, { parse_mode: 'HTML', reply_markup: this.getMainKeyboard() });
        await this.updateSessionState(chatId, {});
        return { success: true };
      }

      // Exécuter le retrait réel
      await TelegramClient.sendMessage(chatId, "⏳ Traitement du retrait en cours...");

      const withdrawalResult = await WithdrawalService.processWithdrawal({
        merchantId: merchant.id,
        merchantEmail: merchant.email,
        amount: state.amount,
        method: state.method,
        receiver: state.receiver,
        environment: 'live', // STRICTEMENT LIVE
        description: 'Retrait initié via Telegram Bot',
      });

      await this.updateSessionState(chatId, {});

      if (!withdrawalResult.success && !withdrawalResult.requiresManualApproval) {
        await TelegramClient.sendMessage(
          chatId,
          `❌ <b>Échec du retrait</b>\n\n${withdrawalResult.error || "Une erreur est survenue lors du décaissement."}`,
          { parse_mode: 'HTML', reply_markup: this.getMainKeyboard() }
        );
      } else {
        const isInstant = withdrawalResult.status === 'completed';
        await TelegramClient.sendMessage(
          chatId,
          `✅ <b>${isInstant ? 'Retrait Effectué avec Succès !' : 'Demande de Retrait Enregistrée'}</b>\n\n💰 <b>Montant :</b> ${state.amount.toLocaleString('fr-HT')} HTG\n📱 <b>Destinataire :</b> ${state.receiver} (${state.method})\n🆔 <b>Statut :</b> ${isInstant ? 'Complété (Instantané)' : 'En cours de validation'}\n\nVotre solde a été mis à jour.`,
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
      const method = parts[3] === 'natcash' ? 'natcash' : 'moncash';
      return this.generateSubscriptionPaymentLink(chatId, merchant, planSlug, cycle, method, messageId);
    }

    if (data.startsWith('withdraw_method:')) {
      const method = data.split(':')[1];
      const session = (account.link.session_state || {}) as any;

      if (messageId) {
        await TelegramClient.deleteMessage(chatId, messageId);
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

      const buttons = [
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
      ];

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
      const { createPaymReference, normalizePaymAmount } = await import('@/lib/payment-routing');

      const providerConfig = await getPaymentProviderConfig();
      let finalAmount = amount;

      // Normalisation du montant pour NatCash si Pay'm est le fournisseur actif
      if (method === 'natcash' && providerConfig.active_provider === 'paym') {
        finalAmount = normalizePaymAmount('natcash', finalAmount);
      }

      const supabase = createAdminClient();
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'KobaraPayBot';
      const telegramReturnUrl = `https://t.me/${botUsername}`;

      const nowIso = new Date().toISOString();
      const subscriptionMetadata = {
        is_subscription_upgrade: true,
        plan_slug: planSlug,
        billing_cycle: billingCycle,
        merchant_id: merchant.id,
        initiated_from: 'telegram_bot',
        success_url: telegramReturnUrl,
        cancel_url: telegramReturnUrl,
      };

      let payment: any = null;
      let reference = '';

      // Vérifier si un paiement d'abonnement en attente existe déjà pour ce marchand
      const { data: existingSubPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('merchant_id', merchant.id)
        .eq('status', 'pending')
        .gt('expires_at', nowIso)
        .filter('metadata->is_subscription_upgrade', 'eq', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSubPayment) {
        payment = existingSubPayment;
        reference = existingSubPayment.kobara_reference;
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await supabase
          .from('payments')
          .update({
            amount: finalAmount,
            net_amount: finalAmount,
            provider: method,
            payment_method: method,
            expires_at: expiresAt,
            metadata: {
              ...(existingSubPayment.metadata || {}),
              ...subscriptionMetadata,
            },
          })
          .eq('id', existingSubPayment.id);
      } else {
        reference = createPaymReference('SUB');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 heure

        // 1. Créer la transaction de paiement d'abonnement en base côté backend
        const { data: newPayment, error } = await supabase
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
            metadata: subscriptionMetadata,
          })
          .select('*')
          .single();

        if (error || !newPayment) {
          console.error('[TelegramBotService] Failed to create subscription payment:', error);
          await TelegramClient.sendMessage(chatId, `❌ Erreur lors de l'initialisation du paiement : ${error?.message || 'Erreur backend'}`);
          return;
        }

        payment = newPayment;
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
          gatewayPaymentUrl = gatewayRes.paymentUrl;
        }

        if (gatewayRes?.orderId || gatewayRes?.transactionId) {
          await supabase
            .from('payments')
            .update({
              bazik_order_id: gatewayRes.orderId,
              bazik_transaction_id: gatewayRes.transactionId,
            })
            .eq('id', payment.id);
        }
      } catch (gwErr: any) {
        console.warn('[TelegramBotService] Direct gateway initialization note:', gwErr?.message);
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
