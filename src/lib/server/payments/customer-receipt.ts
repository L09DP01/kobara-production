import 'server-only';
import { createAdminClient } from '@/utils/supabase/admin';
import { sendEmail } from '@/lib/server/mail';
import { getPaymentMethodLabel, getSettlementAmounts } from '@/lib/payment-settlement';
import { getPayerReceiptEmail } from '@/lib/payment-notification-policy';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export async function sendCustomerPaymentReceipt(payment: any, businessName?: string | null) {
  if (payment.environment !== 'live' || payment.status !== 'succeeded') return;
  const admin = createAdminClient();
  const metadata = payment.metadata || {};
  if (metadata.customer_receipt_sent_at) return;
  // Never fall back to the merchant's email or an unrelated metadata email.
  let customerEmail: string | null = null;
  if (!Object.prototype.hasOwnProperty.call(metadata, 'customer_email') && payment.customer_id) {
    const { data } = await admin.from('customers').select('email').eq('id', payment.customer_id).eq('merchant_id', payment.merchant_id).maybeSingle();
    customerEmail = data?.email || null;
  }
  const email = getPayerReceiptEmail(metadata, customerEmail);
  if (!email || !businessName) return;
  const claimedAt = new Date().toISOString();
  if (metadata.customer_receipt_claimed_at && Date.now() - Date.parse(metadata.customer_receipt_claimed_at) < 600_000) return;
  const claimedMetadata = { ...metadata, customer_receipt_claimed_at: claimedAt };
  let claim = admin.from('payments').update({ metadata: claimedMetadata }).eq('id', payment.id).eq('status', 'succeeded');
  claim = payment.metadata == null ? claim.is('metadata', null) : claim.eq('metadata', payment.metadata);
  const { data: claimed, error } = await claim.select('id').maybeSingle();
  if (error) throw error;
  if (!claimed) return;
  const amounts = getSettlementAmounts(payment);
  const amount = `${amounts.gross.toLocaleString('fr-FR')} ${amounts.currency}`;
  const reference = String(payment.kobara_reference || payment.id);
  const method = getPaymentMethodLabel(payment);
  const subject = `Paiement confirmé - ${businessName}`;
  const text = `Votre paiement à ${businessName} est confirmé.\nMontant : ${amount}\nMoyen : ${method}\nRéférence : ${reference}\nMerci pour votre achat.`;
  let sent = false;
  try {
    const result = await sendEmail({ to: email.trim(), subject, text, idempotencyKey: `customer-receipt-${payment.id}`, html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#10131D"><h1>${escapeHtml(businessName)}</h1><h2>Paiement confirmé</h2><p>Votre paiement à ${escapeHtml(businessName)} est confirmé.</p><p><strong>${escapeHtml(amount)}</strong></p><p>Moyen : ${escapeHtml(method)}</p><p>Référence : ${escapeHtml(reference)}</p><p>Merci pour votre achat.</p></div>` });
    sent = result.success;
    if (!sent) throw new Error('Envoi du reçu client échoué');
  } finally {
    // Compare-and-set avoids overwriting metadata changed by another handler.
    await admin.from('payments').update({ metadata: { ...claimedMetadata, customer_receipt_claimed_at: null, ...(sent ? { customer_receipt_sent_at: new Date().toISOString() } : {}) } }).eq('id', payment.id).eq('metadata', claimedMetadata);
  }
}
