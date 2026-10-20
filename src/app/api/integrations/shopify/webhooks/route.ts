import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getActiveShopifyInstallation, normalizeShopDomain, ensureShopifyOrderPaymentLink, verifyShopifyWebhookHmac } from '@/lib/server/shopify';

export async function POST(request: Request) {
  if (!process.env.SHOPIFY_CLIENT_SECRET) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const rawBody = await request.text();
  if (!verifyShopifyWebhookHmac(rawBody, request.headers.get('x-shopify-hmac-sha256'))) {
    return NextResponse.json({ error: 'invalid_hmac' }, { status: 401 });
  }
  const webhookId = request.headers.get('x-shopify-webhook-id');
  const topic = (request.headers.get('x-shopify-topic') || '').toLowerCase();
  const shopHeader = request.headers.get('x-shopify-shop-domain');
  if (!webhookId || !topic || !shopHeader) return NextResponse.json({ error: 'missing_headers' }, { status: 400 });
  let shopDomain: string;
  let payload: Record<string, unknown>;
  try {
    shopDomain = normalizeShopDomain(shopHeader);
    payload = JSON.parse(rawBody);
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new Error('invalid_payload');
  } catch { return NextResponse.json({ error: 'invalid_payload' }, { status: 400 }); }

  const db = createAdminClient();
  let receiptId: string | null = null;
  try {
    let installation = await getActiveShopifyInstallation(shopDomain);
    if (!installation && topic === 'app/uninstalled') {
      const previous = await db.from('shopify_installations')
        .select('id, merchant_id, shop_domain, status, access_token_ciphertext').eq('shop_domain', shopDomain).maybeSingle();
      if (previous.error) throw new Error('installation_lookup_failed');
      installation = previous.data;
    }
    const now = new Date().toISOString();
    const inserted = await db.from('shopify_webhook_receipts').insert({
      installation_id: installation?.id || null, merchant_id: installation?.merchant_id || null,
      webhook_id: webhookId, shop_domain: shopDomain, topic, received_at: now,
    }).select('id').maybeSingle();
    if (inserted.error?.code === '23505') {
      const { data: previous, error } = await db.from('shopify_webhook_receipts')
        .select('id, status, received_at, shop_domain, topic').eq('webhook_id', webhookId).maybeSingle();
      if (error || !previous || previous.shop_domain !== shopDomain || previous.topic !== topic) throw new Error('receipt_conflict');
      if (['processed', 'ignored'].includes(previous.status)) return NextResponse.json({ received: true, duplicate: true });
      if (previous.status === 'processing' && Date.parse(previous.received_at) > Date.now() - 120_000) {
        return NextResponse.json({ error: 'processing' }, { status: 503 });
      }
      const claimed = await db.from('shopify_webhook_receipts').update({ status: 'processing', received_at: now, error_message: null })
        .eq('id', previous.id).eq('status', previous.status).eq('received_at', previous.received_at).select('id').maybeSingle();
      if (claimed.error || !claimed.data) return NextResponse.json({ error: 'processing' }, { status: 503 });
      receiptId = claimed.data.id;
    } else {
      if (inserted.error || !inserted.data) throw new Error('receipt_failed');
      receiptId = inserted.data.id;
    }

    if (topic === 'app/uninstalled' && installation) {
      const result = await db.from('shopify_installations').update({ status: 'uninstalled', access_token_ciphertext: null, oauth_state_hash: null, uninstalled_at: now, updated_at: now }).eq('id', installation.id);
      if (result.error) throw new Error('uninstall_failed');
      const links = await db.from('payment_links').update({ status: 'inactive' }).eq('merchant_id', installation.merchant_id).eq('metadata->>shopify_installation_id', installation.id);
      if (links.error) throw new Error('link_invalidation_failed');
    } else if ((topic === 'orders/create' || topic === 'orders/updated') && installation) {
      await ensureShopifyOrderPaymentLink({ installation, payload });
    } else if (topic === 'shop/redact') {
      const lookup = await db.from('shopify_installations').select('id').eq('shop_domain', shopDomain).maybeSingle();
      if (lookup.error) throw new Error('redaction_lookup_failed');
      if (lookup.data) {
        const result = await db.from('shopify_installations').delete().eq('id', lookup.data.id);
        if (result.error) throw new Error('redaction_failed');
      }
    } else if (topic === 'customers/redact' && installation) {
      const customer = payload.customer as { id?: string | number } | undefined;
      const customerId = String(customer?.id || payload.customer_id || '');
      if (customerId) {
        const rows = await db.from('shopify_orders').select('id, customer').eq('installation_id', installation.id);
        if (rows.error) throw new Error('redaction_lookup_failed');
        const ids = (rows.data || []).filter(row => String(row.customer?.id || '') === customerId).map(row => row.id);
        if (ids.length) {
          const result = await db.from('shopify_orders').update({ customer: {}, raw_order: {} }).in('id', ids);
          if (result.error) throw new Error('redaction_failed');
        }
      }
    } else if (topic === 'customers/data_request' && installation) {
      const result = await db.from('notifications').insert({ merchant_id: installation.merchant_id, type: 'shopify_data_request', title: 'Demande de données Shopify', message: `Une demande de données Shopify nécessite une prise en charge par le support. Référence : ${webhookId}` });
      if (result.error) throw new Error('data_request_notification_failed');
    }

    const completed = await db.from('shopify_webhook_receipts').update({ status: installation ? 'processed' : 'ignored', processed_at: new Date().toISOString() }).eq('id', receiptId);
    if (completed.error) throw new Error('receipt_completion_failed');
    return NextResponse.json({ received: true });
  } catch {
    if (receiptId) await db.from('shopify_webhook_receipts').update({ status: 'failed', error_message: 'processing_failed', processed_at: new Date().toISOString() }).eq('id', receiptId);
    // Keep failures retryable; an acknowledgement is sent only after processing.
    return NextResponse.json({ error: 'processing_failed' }, { status: 503 });
  }
}
