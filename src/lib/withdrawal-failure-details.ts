import { getWithdrawalUserMessage } from './withdrawal-error-message';
import { containsPotentialSecret, redactSecrets } from './sensitive-text';

export type WithdrawalFailureDetails = {
  reason: string;
  providerMessage: string | null;
  providerCode: string | null;
  httpStatus: number | null;
  refundedAt: string | null;
};

export function getWithdrawalFailureDetails(withdrawal: Record<string, unknown>): WithdrawalFailureDetails {
  const response = withdrawal.provider_response && typeof withdrawal.provider_response === 'object'
    ? withdrawal.provider_response as Record<string, unknown> : {};
  const error = response.error && typeof response.error === 'object' ? response.error as Record<string, unknown> : {};
  const message = [response.message, typeof response.error === 'string' ? response.error : error.message, response.reason]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const rawReason = typeof withdrawal.failed_reason === 'string' ? withdrawal.failed_reason : message || '';
  const code = response.error_code ?? response.code ?? error.code;
  const status = response.status_code ?? response.statusCode ?? response.http_status ?? error.status ?? response.status;
  const explicitStatus = Number(status);
  const statusText = `${rawReason} ${message || ''}`;
  const statusInReason = statusText.match(/\b(?:HTTP(?: status)?|status(?: code)?|client error|server error)\s*[:=]?\s*([45]\d{2})\b/i)
    || statusText.match(/\b([45]\d{2})\s+(?:Client Error|Server Error|Unauthorized|Forbidden|Too Many Requests)/i);
  const httpStatus = Number.isInteger(explicitStatus) && explicitStatus >= 400 && explicitStatus <= 599
    ? explicitStatus : statusInReason ? Number(statusInReason[1]) : null;
  return {
    reason: getWithdrawalUserMessage(redactSecrets(rawReason), { fallback: 'Le retrait a échoué. Aucun motif exploitable n’a été enregistré.' }),
    providerMessage: message ? getWithdrawalUserMessage(redactSecrets(message)) : null,
    providerCode: typeof code === 'string' && /^[A-Z0-9_:-]{1,60}$/.test(code) && !containsPotentialSecret(code) ? code : null,
    httpStatus,
    refundedAt: typeof withdrawal.refunded_at === 'string' && Number.isFinite(Date.parse(withdrawal.refunded_at)) ? withdrawal.refunded_at : null,
  };
}
