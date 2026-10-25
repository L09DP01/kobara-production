import 'server-only';
import { createAdminClient } from '@/utils/supabase/admin';
import { sendEmail } from '@/lib/server/mail';
import { getPaymentMethodLabel, getSettlementAmounts } from '@/lib/payment-settlement';
import { getPayerReceiptEmail } from '@/lib/payment-notification-policy';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export async function sendCustomerPaymentReceipt(payment: any, businessName?: string | null) {
  if (payment.environment !== 'live' || payment.status !== 'succeeded' || !payment.payment_link_id) return;
  if (payment.metadata?.customer_receipt_sent_at) return;
  const admin = createAdminClient();
  // Other success handlers may have changed metadata since the initial fetch.
  const { data: current, error: currentError } = await admin.from('payments').select('*')
    .eq('id', payment.id).eq('merchant_id', payment.merchant_id).maybeSingle();
  if (currentError) throw currentError;
  if (!current || current.environment !== 'live' || current.status !== 'succeeded' || !current.payment_link_id) return;
  payment = current;
  const metadata = payment.metadata || {};
  if (metadata.customer_receipt_sent_at) return;
  // Never fall back to the merchant's email or an unrelated metadata email.
  let customerEmail: string | null = null;
  if (!Object.prototype.hasOwnProperty.call(metadata, 'customer_email') && payment.customer_id) {
    const { data } = await admin.from('customers').select('email').eq('id', payment.customer_id).eq('merchant_id', payment.merchant_id).maybeSingle();
    customerEmail = data?.email || null;
  }
  const email = getPayerReceiptEmail(metadata, customerEmail);
  if (!email || !businessName) {
    console.warn('[Email] Customer receipt skipped.', { paymentId: payment.id, reason: !email ? 'payer_email_missing' : 'business_name_missing' });
    return;
  }
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
    const result = await sendEmail({ senderName: businessName, to: email.trim(), subject, text, idempotencyKey: `customer-receipt-${payment.id}`,
      presentation: { type: 'transaction', status: payment.status, amount: amounts.gross, currency: amounts.currency,
        reference, method, merchantName: businessName,
        ...(payment.paid_at && Number.isFinite(Date.parse(payment.paid_at)) ? { date: new Date(payment.paid_at).toLocaleString('fr-FR', { timeZone: 'America/Port-au-Prince' }) } : {}),
      },
      html: `<h1>${escapeHtml(businessName)}</h1><h2>Paiement confirmé</h2><p>Votre paiement à ${escapeHtml(businessName)} est confirmé.</p><p><strong>${escapeHtml(amount)}</strong></p><p>Moyen : ${escapeHtml(method)}</p><p>Référence : ${escapeHtml(reference)}</p><p>Merci pour votre achat.</p>` });
    sent = result.success;
    if (!sent) throw new Error('Envoi du reçu client échoué');
  } finally {
    // Compare-and-set avoids overwriting metadata changed by another handler.
    await admin.from('payments').update({ metadata: { ...claimedMetadata, customer_receipt_claimed_at: null, ...(sent ? { customer_receipt_sent_at: new Date().toISOString() } : {}) } }).eq('id', payment.id).eq('metadata', claimedMetadata);
  }
}
