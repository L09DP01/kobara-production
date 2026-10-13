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
  if (language === 'ht') return `Mwen regrèt pwoblèm sa a. Mwen pa jwenn yon repons ki ase klè nan dokiman Kobara yo. Tikè ${reference} ou a anrejistre pou ekip teknik la ka ede w.`;
  if (language === 'en') return `I’m sorry about this problem. I couldn’t find a sufficiently reliable answer in Kobara’s documentation. Your ticket ${reference} is registered for the technical team to help you.`;
  return `Je suis désolée pour ce problème. Je n’ai pas trouvé de réponse suffisamment fiable dans la documentation Kobara. Votre ticket ${reference} est enregistré pour que l’équipe technique vous aide.`;
}

export function secretSupportWarning(question: string) {
  const language = supportLanguage(question);
  if (language === 'ht') return 'Mesaj ou a sanble gen yon kle oswa yon sekrè. Revoke li touswit, kreye yon nouvo epi pa pataje li nan sipò. ';
  if (language === 'en') return 'Your message appears to contain a key or secret. Revoke it immediately, create a new one, and never share it in support. ';
  return 'Votre message semble contenir une clé ou un secret. Révoquez-le immédiatement, créez-en un nouveau et ne le partagez jamais au support. ';
}
