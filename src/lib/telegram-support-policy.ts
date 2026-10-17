import { appendCodingAssistantGuidance, supportIntent, supportLanguage } from './support-assistant-policy';
import { containsPotentialSecret, redactSecrets } from './sensitive-text';

export type TelegramSupportHistory = Array<{ sender_type: string; body: string }>;
export const TELEGRAM_SUPPORT_URL = 'https://kobara.app/dashboard/support';

export function telegramSupportOffer(question: string) {
  const language = supportLanguage(question);
  if (language === 'ht') return `Pou ekip Kobara a verifye pwen ki poko konfime yo, ou ka voye demann ou an isit la : ${TELEGRAM_SUPPORT_URL}`;
  if (language === 'en') return `For the Kobara team to validate the points not yet confirmed, you can submit your request here: ${TELEGRAM_SUPPORT_URL}`;
  return `Pour faire valider les points non confirmés par l’équipe Kobara, vous pouvez transmettre votre demande ici : ${TELEGRAM_SUPPORT_URL}`;
}

export function formatTelegramSupportReply(question: string, result: {
  answer: string; answerIsGrounded?: boolean; shouldOfferHuman: boolean;
  references: Array<{ title: string; url: string }>;
} | null) {
  const grounded = result?.answerIsGrounded === true && Boolean(result.answer.trim());
  const parts = grounded ? [redactSecrets(result!.answer)] : [];
  if (!grounded) {
    const language = supportLanguage(question);
    const incident = supportIntent(question) === 'incident';
    parts.push(language === 'ht' ? (incident ? 'Mwen regrèt difikilte sa a. Mwen pa ka konfime kòz la ak enfòmasyon ki disponib yo.' : 'Mèsi pou demann ou an. Mwen pa gen ase enfòmasyon verifye pou konfime pwen sa a.')
      : language === 'en' ? (incident ? 'I’m sorry about the difficulty. I cannot confirm the cause from the available information.' : 'Thank you for your request. I do not have enough verified information to confirm this point.')
      : incident ? 'Je suis désolée pour cette difficulté. Je ne peux pas en confirmer la cause avec les informations disponibles.' : 'Merci pour votre demande. Je ne dispose pas d’assez d’informations vérifiées pour confirmer ce point.');
  }
  if (!grounded || result?.shouldOfferHuman) parts.push(telegramSupportOffer(question));
  const answer = appendCodingAssistantGuidance(question, parts.join('\n\n'));
  const references = grounded ? result!.references.filter((source) => !answer.includes(source.url)).slice(0, 2) : [];
  return [answer, ...references.map((source) => `${source.title} : ${source.url}`)].join('\n\n');
}

export function safeTelegramHistory(value: unknown): TelegramSupportHistory {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { sender_type: string; body: string } => item
    && ['merchant', 'assistant'].includes(item.sender_type) && typeof item.body === 'string'
    && !containsPotentialSecret(item.body))
    .slice(-6).map((item) => ({ sender_type: item.sender_type, body: redactSecrets(item.body).slice(0, 3500) }));
}
