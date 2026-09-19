type WithdrawalErrorOptions = {
  refunded?: boolean;
  fallback?: string;
};

function getErrorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return '';

  const value = error as {
    message?: unknown;
    error?: unknown;
    status?: unknown;
    response?: { status?: unknown; data?: unknown };
  };
  const responseData = typeof value.response?.data === 'string'
    ? value.response.data
    : value.response?.data && typeof value.response.data === 'object'
      ? JSON.stringify(value.response.data)
      : '';

  return [value.message, value.error, value.status, value.response?.status, responseData]
    .filter((part) => part !== undefined && part !== null)
    .map(String)
    .join(' ');
}

function withRefund(message: string, refunded: boolean) {
  if (!refunded || /recr[eé]dit[eé]|retourn[eé].*solde/i.test(message)) return message;
  return `${message} Le montant réservé a été recrédité sur votre solde.`;
}

export function getWithdrawalUserMessage(
  error: unknown,
  options: WithdrawalErrorOptions = {},
): string {
  const raw = getErrorText(error).trim();
  const normalized = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
  const lower = normalized.toLowerCase();
  const refunded = Boolean(options.refunded);

  if (/\b429\b|too many requests|rate.?limit|trop de requ[eê]tes/.test(lower)) {
    return withRefund(
      'Le service de retrait est momentanément très sollicité. Attendez quelques minutes puis réessayez.',
      refunded,
    );
  }

  if (/invalid receiver|recipient has to be register|receiver.*register/.test(lower)) {
    return withRefund(
      'Le destinataire n’est pas enregistré pour ce service. Vérifiez le numéro et le moyen de réception sélectionné.',
      refunded,
    );
  }

  if (/insufficient|solde insuffisant|not enough/.test(lower)) {
    return 'Votre solde disponible ne couvre pas le montant et les frais de ce retrait.';
  }

  if (/invalid.*address|address.*invalid|adresse.*invalide/.test(lower)) {
    return 'L’adresse du portefeuille n’est pas valide pour le réseau sélectionné. Vérifiez-la puis réessayez.';
  }

  if (/\b403\b|forbidden|unauthori[sz]ed|authentication|invalid.*token/.test(lower)) {
    return withRefund(
      'Le service de retrait a refusé la demande. Aucun transfert n’a été effectué. Réessayez plus tard ou contactez le support si le problème persiste.',
      refunded,
    );
  }

  if (/timeout|timed out|network|fetch failed|econn|socket|gateway|\b50[234]\b/.test(lower)) {
    return withRefund(
      'Le service de retrait est temporairement indisponible. Réessayez dans quelques minutes.',
      refunded,
    );
  }

  const looksTechnical = !normalized
    || /<html|nginx|client error|server error|\bpost\s+https?:|stack|trace|exception|worker\.js/i.test(raw)
    || /https?:\/\//i.test(normalized)
    || normalized.length > 280;

  if (looksTechnical) {
    return withRefund(
      options.fallback || 'Le retrait n’a pas pu être traité pour le moment. Réessayez dans quelques minutes.',
      refunded,
    );
  }

  return withRefund(normalized, refunded);
}
