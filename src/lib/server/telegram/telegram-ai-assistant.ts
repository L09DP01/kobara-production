import 'server-only';

import { answerWhatsAppSupport as answerKobaraSupport } from '@/lib/server/whatsapp/assistant';
import { aiChatLimiter } from '@/lib/server/security/rate-limit';
import { containsPotentialSecret, redactSecrets } from '@/lib/sensitive-text';
import { isSensitiveSupportRequest, secretSupportWarning } from '@/lib/support-assistant-policy';
import { formatTelegramSupportReply, safeTelegramHistory, telegramSupportOffer, type TelegramSupportHistory } from '@/lib/telegram-support-policy';

export class TelegramAiAssistant {
  static async answerMerchantQuery(userQuery: string, merchantId: string, history: TelegramSupportHistory = []): Promise<string> {
    const question = redactSecrets(userQuery).slice(0, 9000);
    if (containsPotentialSecret(userQuery)) return `${secretSupportWarning(question)}\n\n${telegramSupportOffer(question)}`;
    if (isSensitiveSupportRequest(question)) return formatTelegramSupportReply(question, null);
    try {
      const budget = await aiChatLimiter.limit(`telegram-support:${merchantId}`);
      if (!budget.success) return formatTelegramSupportReply(question, null);
      const result = await answerKobaraSupport({ channel: 'telegram', question, history: safeTelegramHistory(history) });
      return formatTelegramSupportReply(question, result);
    } catch {
      console.error('[TelegramAiAssistant] Support answer unavailable.');
      return formatTelegramSupportReply(question, null);
    }
  }
}
