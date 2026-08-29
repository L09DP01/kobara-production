import 'server-only';

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface SendMessageOptions {
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: {
    inline_keyboard?: InlineKeyboardButton[][];
    keyboard?: Array<Array<{ text: string }>>;
    resize_keyboard?: boolean;
    one_time_keyboard?: boolean;
    remove_keyboard?: boolean;
  };
  disable_web_page_preview?: boolean;
}

export class TelegramClient {
  public static getBotToken(): string | null {
    return process.env.TELEGRAM_BOT_TOKEN || null;
  }

  /**
   * Vérifie le statut du bot auprès de l'API Telegram
   */
  static async getMe() {
    const token = this.getBotToken();
    if (!token) return { success: false, error: 'TELEGRAM_BOT_TOKEN non configuré dans .env' };

    try {
      const response = await fetch(`${TELEGRAM_API_BASE}${token}/getMe`);
      const data = await response.json();
      return { success: data.ok, result: data.result, error: data.description };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Récupère l'état actuel du webhook auprès de Telegram
   */
  static async getWebhookInfo() {
    const token = this.getBotToken();
    if (!token) return { success: false, error: 'TELEGRAM_BOT_TOKEN non configuré dans .env' };

    try {
      const response = await fetch(`${TELEGRAM_API_BASE}${token}/getWebhookInfo`);
      const data = await response.json();
      return { success: data.ok, result: data.result, error: data.description };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Enregistre le Webhook auprès des serveurs Telegram
   */
  static async setWebhook(url: string, secretToken?: string) {
    const token = this.getBotToken();
    if (!token) return { success: false, error: 'TELEGRAM_BOT_TOKEN non configuré dans .env' };

    try {
      const payload: any = { url };
      if (secretToken) payload.secret_token = secretToken;

      const response = await fetch(`${TELEGRAM_API_BASE}${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      return { success: data.ok, result: data.result, description: data.description };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Envoie un message texte à un chat_id donné avec découpage automatique et repli sans parse_mode en cas d'erreur de balisage
   */
  static async sendMessage(chatId: string | number, text: string, options?: SendMessageOptions) {
    const token = this.getBotToken();
    if (!token) {
      console.warn('[TelegramClient] TELEGRAM_BOT_TOKEN non configuré.');
      return { success: false, error: 'TELEGRAM_BOT_TOKEN non configuré' };
    }

    // Telegram a une limite de 4096 caractères par message
    const MAX_LEN = 3900;
    if (text.length > MAX_LEN) {
      const chunks = this.chunkText(text, MAX_LEN);
      let lastResult: any = null;
      for (let i = 0; i < chunks.length; i++) {
        const isLast = i === chunks.length - 1;
        lastResult = await this.sendSingleMessage(chatId, chunks[i], {
          ...options,
          reply_markup: isLast ? options?.reply_markup : undefined,
        });
      }
      return lastResult;
    }

    return this.sendSingleMessage(chatId, text, options);
  }

  private static async sendSingleMessage(
    chatId: string | number,
    text: string,
    options?: SendMessageOptions
  ) {
    const token = this.getBotToken();
    if (!token) return { success: false, error: 'TELEGRAM_BOT_TOKEN non configuré' };

    try {
      const response = await fetch(`${TELEGRAM_API_BASE}${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options?.parse_mode || 'HTML',
          reply_markup: options?.reply_markup,
          disable_web_page_preview: options?.disable_web_page_preview ?? true,
        }),
      });

      const data = await response.json();

      // Si erreur de parsing d'entités HTML/Markdown (ex: balises mal fermées par l'IA), réessayer immédiatement en texte brut
      if (!data.ok) {
        console.warn('[TelegramClient] SendMessage initial attempt failed:', data.description);

        if (
          data.description?.includes("can't parse entities") ||
          data.description?.includes('entity') ||
          data.description?.includes('tag') ||
          options?.parse_mode
        ) {
          const fallbackRes = await fetch(`${TELEGRAM_API_BASE}${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: this.stripHtml(text),
              reply_markup: options?.reply_markup,
              disable_web_page_preview: options?.disable_web_page_preview ?? true,
            }),
          });
          const fallbackData = await fallbackRes.json();
          if (fallbackData.ok) {
            return { success: true, result: fallbackData.result };
          }
        }

        return { success: false, error: data.description || 'Erreur Telegram API' };
      }

      return { success: true, result: data.result };
    } catch (err: any) {
      console.error('[TelegramClient] SendMessage network error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Découpe un texte long pour respecter la limite Telegram
   */
  private static chunkText(str: string, size: number): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < str.length) {
      chunks.push(str.slice(i, i + size));
      i += size;
    }
    return chunks;
  }

  /**
   * Supprime les balises HTML basiques pour le repli en texte brut
   */
  private static stripHtml(html: string): string {
    return html
      .replace(/<b>(.*?)<\/b>/gi, '$1')
      .replace(/<i>(.*?)<\/i>/gi, '$1')
      .replace(/<code>(.*?)<\/code>/gi, '$1')
      .replace(/<pre>(.*?)<\/pre>/gi, '$1')
      .replace(/<[^>]+>/g, '');
  }

  /**
   * Modifie le texte d'un message existant
   */
  static async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    options?: SendMessageOptions
  ) {
    const token = this.getBotToken();
    if (!token) return { success: false, error: 'TELEGRAM_BOT_TOKEN non configuré' };

    try {
      const response = await fetch(`${TELEGRAM_API_BASE}${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: options?.parse_mode || 'HTML',
          reply_markup: options?.reply_markup,
          disable_web_page_preview: options?.disable_web_page_preview ?? true,
        }),
      });

      const data = await response.json();
      return { success: data.ok, result: data.result, error: data.description };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Répond à un clic sur un bouton inline
   */
  static async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false) {
    const token = this.getBotToken();
    if (!token) return { success: false };

    try {
      await fetch(`${TELEGRAM_API_BASE}${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
          show_alert: showAlert,
        }),
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  /**
   * Supprime un message dans le chat Telegram
   */
  static async deleteMessage(chatId: string | number, messageId: number) {
    const token = this.getBotToken();
    if (!token) return { success: false };

    try {
      const response = await fetch(`${TELEGRAM_API_BASE}${token}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
        }),
      });
      const data = await response.json();
      return { success: data.ok };
    } catch {
      return { success: false };
    }
  }
}
