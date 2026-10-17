export const DOCS_ASSISTANT_URL = 'https://docs.kobara.app/docs/quickstart';

const normalizedText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function supportIntent(question: string): 'incident' | 'integration' | 'information' {
  const text = normalizedText(question);
  if (/\b(mon|ma|mes|notre|nos|my|our)\b.{0,100}\b(erreur|error|bug|panne|bloque|failed|echoue|rejete|suspendu)\b|\b(erreur|error)\s*[45]\d{2}\b|\b(cannot|pa ka|pa mache)\b|\bje\b.{0,40}(n['’]arrive|ne peux|ne parviens)/.test(text)) return 'incident';
  if (/\b(marketplace|saas|integration|integrer|integrate|entegrasyon|entegre|sdk|webhook|sandbox|api|woocommerce)\b/.test(text)) return 'integration';
  return 'information';
}

export function explicitlyRequestsHuman(question: string): boolean {
  const text = normalizedText(question).trim();
  return /^(agent|humain|human|conseiller|moun reel|equipe technique|support humain)[.!?\s]*$/.test(text)
    || /\b(je (veux|voudrais|souhaite)|i (want|need)|mwen (vle|bezwen))\s+(un |une |a |an |yon )?(agent|humain|human|conseiller|moun)\b/.test(text)
    || /\b(parler|contacter|transferer|transmettre|joindre|speak|talk|connect|pale|kontakte)\b.{0,65}\b(humain|human|agent|conseiller|equipe|team|moun|ekip)\b/.test(text);
}

export function needsCodingSupport(question: string): boolean {
  return /\b(marketplace|integration|integrer|integrate|entegrasyon|entegre|sdk|webhook|api|woocommerce|debug|code|coding|kod)\b/.test(normalizedText(question));
}

export function requiresBusinessReview(question: string): boolean {
  const text = normalizedText(question);
  return /marketplace|multi.vendeur|multi.vendor/.test(text)
    && /conformite|reglement|autorise|tiers|beneficiaire|beneficiary|benefisye|verified|verifye|compliance|legal/.test(text);
}

export function parseSupportAnswer(text: string, sourceCount: number) {
  const safety = text.match(/^SAFETY_SECRET_DETECTED:[ \t]*(true|false)[ \t]*$/im)?.[1]?.toLowerCase();
  const escalation = text.match(/^SUPPORT_ESCALATION_REQUIRED:[ \t]*(true|false)[ \t]*$/im)?.[1]?.toLowerCase();
  const sourceLine = text.match(/^SUPPORT_SOURCE_IDS:[ \t]*([^\r\n]*)$/im)?.[1]?.trim() || '';
  const ids = /^[1-9]\d*(?:\s*,\s*[1-9]\d*){0,9}$/.test(sourceLine)
    ? [...new Set(sourceLine.split(',').map((value) => Number(value.trim()) - 1))] : [];
  const answer = text.replace(/^(?:SAFETY_SECRET_DETECTED|SUPPORT_ESCALATION_REQUIRED|SUPPORT_SOURCE_IDS):[^\r\n]*(?:\r?\n|$)/gim, '')
    // Remove repeated question labels, not the substantive answer or its caveats.
    .replace(/^(\s*\d+[.)])\s+\*\*[^*\r\n]{1,180}\*\*\s*/gm, '$1 ')
    .replace(/\n{3,}/g, '\n\n').trim();
  const grounded = safety === 'false' && Boolean(escalation) && ids.length > 0
    && ids.every((id) => id < sourceCount) && answer.length > 0;
  return { answer, sourceIds: grounded ? ids : [], grounded, shouldOfferHuman: escalation !== 'false' || !grounded };
}

export function composeSupportReply(question: string, reference: string, result: {
  answer: string; answerIsGrounded?: boolean; shouldOfferHuman: boolean;
}) {
  const grounded = result.answerIsGrounded === true && Boolean(result.answer.trim());
  const handoff = result.shouldOfferHuman || !grounded;
  const parts = grounded ? [result.answer.trim()] : [];
  if (handoff) parts.push(technicalHandoffMessage(question, reference));
  return { handoff, answer: appendCodingAssistantGuidance(question, parts.join('\n\n')) };
}

export function appendCodingAssistantGuidance(question: string, answer: string) {
  const parts = [answer];
  if (needsCodingSupport(question) && !(/Kobara AI/i.test(parts.join('\n')) && parts.join('\n').includes(DOCS_ASSISTANT_URL))) {
    const language = supportLanguage(question);
    parts.push(language === 'ht' ? `Pou ede w ekri kòd, ouvri asistan "Kobara AI" nan dokiman yo : ${DOCS_ASSISTANT_URL}. Pa pataje kle sekrè w.`
      : language === 'en' ? `For coding help, open "Kobara AI" in the documentation: ${DOCS_ASSISTANT_URL}. Do not share secret keys.`
      : `Pour l’aide au code, ouvrez l’assistant « Kobara AI » dans la documentation : ${DOCS_ASSISTANT_URL}. Ne partagez pas vos clés secrètes.`);
  }
  return parts.filter(Boolean).join('\n\n');
}

export function isSensitiveSupportRequest(question: string): boolean {
  const normalized = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /\b(immatricul\w*|nif|rccm|ein|tax\s*(id|number)|registration\s*(number|id)|numero\s*(fiscal|de registre)|password|mot de passe|code\s*(otp|pin)|api\s*(key|secret)|cle\s*api)\b/i.test(normalized);
}

export function sensitiveSupportHandoff(question: string, reference: string): string {
  const language = supportLanguage(question);
  if (language === 'ht') return `Mwen pa gen enfomasyon sa a. Tike ${reference} ou a anrejistre pou ekip la ka reponn kesyon sa a.`;
  if (language === 'en') return `I do not have this information. Your ticket ${reference} is registered for the team to answer this question.`;
  return `Je ne dispose pas de cette information. Votre ticket ${reference} est enregistré pour que notre équipe puisse répondre à cette question.`;
}

export function supportLanguage(question: string): 'fr' | 'ht' | 'en' {
  if (/\b(mwen|kijan|poukisa|bonjou|mesi|peman|kont|ede|retrè|mache)\b/i.test(question)) return 'ht';
  if (/\b(my|how|why|please|payment|withdrawal|account|help|hello|cannot)\b/i.test(question)) return 'en';
  return 'fr';
}

export function technicalHandoffMessage(question: string, reference: string) {
  const language = supportLanguage(question);
  if (supportIntent(question) !== 'incident') {
    if (language === 'ht') return `Mèsi pou demann ou an. Ekip Kobara a ap bezwen valide pwen ki poko konfime yo. Demann ${reference} ou a anrejistre pou swivi.`;
    if (language === 'en') return `Thank you for your request. The Kobara team needs to validate the points not yet confirmed. Your request ${reference} is registered for follow-up.`;
    return `Merci pour votre demande. Les points non confirmés nécessitent une validation par notre équipe Kobara. Votre demande ${reference} est enregistrée pour ce suivi.`;
  }
  if (language === 'ht') return `Mwen regrèt pwoblèm sa a. Ekip Kobara a bezwen verifye pwen ki poko konfime yo. Tikè ${reference} ou a anrejistre pou swivi.`;
  if (language === 'en') return `I’m sorry about this problem. The Kobara team needs to check the points not yet confirmed. Your ticket ${reference} is registered for follow-up.`;
  return `Je suis désolée pour ce problème. Les points non confirmés nécessitent une vérification par notre équipe Kobara. Votre ticket ${reference} est enregistré pour ce suivi.`;
}

export function secretSupportWarning(question: string) {
  const language = supportLanguage(question);
  if (language === 'ht') return 'Mesaj ou a sanble gen yon kle oswa yon sekrè. Revoke li touswit, kreye yon nouvo epi pa pataje li nan sipò. ';
  if (language === 'en') return 'Your message appears to contain a key or secret. Revoke it immediately, create a new one, and never share it in support. ';
  return 'Votre message semble contenir une clé ou un secret. Révoquez-le immédiatement, créez-en un nouveau et ne le partagez jamais au support. ';
}
