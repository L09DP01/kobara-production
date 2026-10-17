import { timingSafeEqual } from 'node:crypto';

export function isTelegramWebhookAuthorized(configured: string | undefined, provided: string | null) {
  if (!configured || !provided) return false;
  const expected = Buffer.from(configured);
  const received = Buffer.from(provided);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function isPrivateTelegramSender(chat: { id?: unknown; type?: unknown } | undefined, sender: { id?: unknown; is_bot?: unknown } | undefined) {
  return chat?.type === 'private' && sender?.is_bot !== true
    && typeof chat.id === 'number' && Number.isSafeInteger(chat.id) && chat.id > 0
    && typeof sender?.id === 'number' && Number.isSafeInteger(sender.id)
    && chat.id === sender.id;
}
