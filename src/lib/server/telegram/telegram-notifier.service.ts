import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';
import { TelegramClient } from './telegram-client';

export class TelegramNotifierService {
  /**
   * Envoie une notification instantanée de paiement reçu au marchand (STRICTEMENT EN MODE LIVE)
   */
  static async notifyPaymentReceived(paymentId: string) {
    const supabase = createAdminClient();

    // 1. Récupérer les détails du paiement
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*, merchants(id, business_name), customers(name, phone, email)')
      .eq('id', paymentId)
      .single();

    if (error || !payment) return { success: false, reason: 'Payment not found' };

    // RÈGLE STRICTE : AUCUNE DONNÉE DE TEST DANS LE BOT TELEGRAM
    if (payment.environment === 'test') {
      return { success: false, reason: 'Test payments are ignored for Telegram notifications' };
    }

    if (payment.status !== 'succeeded') {
      return { success: false, reason: 'Payment status is not succeeded' };
    }

    // 2. Trouver le chat_id Telegram du marchand
    const { data: telegramAccount } = await supabase
      .from('merchant_telegram_accounts')
      .select('telegram_chat_id, notifications_enabled')
      .eq('merchant_id', payment.merchant_id)
      .maybeSingle();

    if (!telegramAccount || !telegramAccount.notifications_enabled) {
      return { success: false, reason: 'Telegram account not linked or notifications disabled' };
    }

    // 3. Formater la notification de paiement
    const gross = Number(payment.amount || 0);
    const net = Number(payment.net_amount || gross);
    const fee = Number(payment.fee_amount || 0);
    const currency = payment.currency || 'HTG';
    const method = (payment.payment_method || 'Mobile Money').toUpperCase();
    const customerInfo = payment.customers?.name || payment.customers?.phone || payment.metadata?.customer_phone || 'Client Kobara';
    const reference = payment.transaction_reference || payment.external_reference || payment.id.substring(0, 8);

    const message = `
🟢 <b>NOUVEAU PAIEMENT REÇU (LIVE) !</b>

💰 <b>Montant :</b> <code>${gross.toLocaleString('fr-HT')} ${currency}</code>
💵 <b>Net crédité :</b> <code>${net.toLocaleString('fr-HT')} ${currency}</code> ${fee > 0 ? `<i>(Frais : ${fee.toLocaleString('fr-HT')} ${currency})</i>` : ''}
📱 <b>Client :</b> ${customerInfo}
💳 <b>Méthode :</b> ${method}
🆔 <b>Référence :</b> <code>${reference}</code>
📅 <b>Date :</b> ${new Date(payment.created_at).toLocaleString('fr-HT')}

Votre solde disponible réel a été mis à jour.
    `.trim();

    return await TelegramClient.sendMessage(telegramAccount.telegram_chat_id, message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Voir mon solde', callback_data: 'action:balance' }],
        ],
      },
    });
  }

  /**
   * Notifie le marchand du changement de statut d'un retrait (STRICTEMENT EN MODE LIVE)
   */
  static async notifyWithdrawalStatus(withdrawalId: string) {
    const supabase = createAdminClient();

    const { data: withdrawal } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single();

    if (!withdrawal || withdrawal.environment === 'test') return { success: false };

    const { data: telegramAccount } = await supabase
      .from('merchant_telegram_accounts')
      .select('telegram_chat_id, notifications_enabled')
      .eq('merchant_id', withdrawal.merchant_id)
      .maybeSingle();

    if (!telegramAccount || !telegramAccount.notifications_enabled) return { success: false };

    const amount = Number(withdrawal.amount || 0);
    const isCompleted = withdrawal.status === 'completed';
    const isFailed = withdrawal.status === 'failed';

    const icon = isCompleted ? '✅' : isFailed ? '❌' : '⏳';
    const title = isCompleted
      ? 'Retrait Validé et Payé'
      : isFailed
      ? 'Échec du Retrait'
      : 'Retrait en Cours';

    const message = `
${icon} <b>${title.toUpperCase()} (LIVE)</b>

💰 <b>Montant :</b> <code>${amount.toLocaleString('fr-HT')} HTG</code>
📱 <b>Méthode / Destinataire :</b> ${withdrawal.method} (${withdrawal.receiver || 'Compte'})
🆔 <b>Statut :</b> <code>${withdrawal.status}</code>
${withdrawal.error_message ? `⚠️ <b>Motif :</b> ${withdrawal.error_message}\n` : ''}
📅 <b>Date :</b> ${new Date().toLocaleString('fr-HT')}
    `.trim();

    return await TelegramClient.sendMessage(telegramAccount.telegram_chat_id, message, {
      parse_mode: 'HTML',
    });
  }

  /**
   * Diffuse une annonce ou actualité marketing vers :
   * 1. Le canal public / forum de discussion Kobara (TELEGRAM_COMMUNITY_CHANNEL_ID)
   * 2. ET/OU en message privé à tous les marchands connectés
   */
  static async broadcastAnnouncement(params: {
    title: string;
    subject: string;
    content: string;
    sendToChannel?: boolean;
    sendToMerchantsDirect?: boolean;
  }) {
    const supabase = createAdminClient();
    const channelId = process.env.TELEGRAM_COMMUNITY_CHANNEL_ID || '@KobaraCommunity';

    const announcementText = `
📢 <b>NOUVELLE ANNONCE KOBARA</b>

📌 <b>${params.subject}</b>

${params.content}

🌐 <i>L'équipe Kobara — https://kobara.app</i>
    `.trim();

    const results = {
      channelSent: false,
      merchantsCount: 0,
    };

    // 1. Publication sur le Canal public / Forum
    if (params.sendToChannel !== false && channelId) {
      try {
        const res = await TelegramClient.sendMessage(channelId, announcementText, {
          parse_mode: 'HTML',
        });
        results.channelSent = res.success;
      } catch (err) {
        console.error('[TelegramNotifier] Failed to post to channel:', err);
      }
    }

    // 2. Envoi direct en message privé aux marchands connectés
    if (params.sendToMerchantsDirect) {
      const { data: accounts } = await supabase
        .from('merchant_telegram_accounts')
        .select('telegram_chat_id')
        .eq('notifications_enabled', true);

      if (accounts && accounts.length > 0) {
        for (const acc of accounts) {
          try {
            await TelegramClient.sendMessage(acc.telegram_chat_id, announcementText, {
              parse_mode: 'HTML',
            });
            results.merchantsCount++;
            await new Promise((r) => setTimeout(r, 100)); // Throttling
          } catch (err) {
            console.error(`[TelegramNotifier] Failed to send to chat ${acc.telegram_chat_id}:`, err);
          }
        }
      }
    }

    return results;
  }

  /**
   * Notifie le marchand de l'activation ou du renouvellement de son abonnement
   */
  static async notifySubscriptionActivated(merchantId: string, planSlug: string, paymentId?: string) {
    const supabase = createAdminClient();

    const { data: telegramAccount } = await supabase
      .from('merchant_telegram_accounts')
      .select('telegram_chat_id, notifications_enabled')
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (!telegramAccount || !telegramAccount.notifications_enabled) return { success: false };

    try {
      const { getMerchantSubscriptionEntitlement } = await import('@/lib/server/plans');
      const entitlementData = await getMerchantSubscriptionEntitlement(merchantId);

      const planName = entitlementData.plan?.name || planSlug.toUpperCase();
      const expiresAt = entitlementData.subscription?.current_period_end
        ? new Date(entitlementData.subscription.current_period_end).toLocaleDateString('fr-HT')
        : 'Actif';

      const message = `
🎉 <b>ABONNEMENT ACTIVÉ / RENOUVELÉ AVEC SUCCÈS !</b>

⭐ <b>Votre Plan :</b> ${planName}
🟢 <b>Statut :</b> Actif
📅 <b>Date de validité :</b> Jusqu'au ${expiresAt}

Toutes vos fonctionnalités avancées sont désormais prêtes à l'emploi.
      `.trim();

      return await TelegramClient.sendMessage(telegramAccount.telegram_chat_id, message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⭐ Voir mon abonnement', callback_data: 'action:subscription' }],
            [{ text: '💰 Voir mon solde', callback_data: 'action:balance' }],
          ],
        },
      });
    } catch (err) {
      console.error('[TelegramNotifier] Error notifying subscription activation:', err);
      return { success: false };
    }
  }
}
