export function getPaymentListStatus(status?: string | null, search?: string | null): string {
  const allowed = ['all', 'succeeded', 'pending', 'failed', 'refunded', 'completed', 'cancelled'];
  if (status && allowed.includes(status)) return status;
  return search?.trim() ? 'all' : 'succeeded';
}
