import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';
import { decryptShopifyAccessToken } from '@/lib/server/shopify';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdmin(['super_admin', 'compliance']); }
  catch { return Response.json({ error: 'unauthorized' }, { status: 403 }); }
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'invalid_id' }, { status: 400 });
  const db = createAdminClient();
  const { data: request, error } = await db.from('shopify_privacy_requests').select('*').eq('id', id).maybeSingle();
  if (error || !request?.request_details_ciphertext) return Response.json({ error: 'unavailable' }, { status: 404 });
  const details = JSON.parse(decryptShopifyAccessToken(request.request_details_ciphertext));
  const { data: installation, error: lookupError } = await db.from('shopify_installations').select('id')
    .eq('shop_domain', request.shop_domain).maybeSingle();
  if (lookupError) return Response.json({ error: 'lookup_failed' }, { status: 503 });
  const scopedIds = Array.isArray(details.orders_requested) ? details.orders_requested : [];
  let orders: unknown[] = [];
  if (installation && (details.customer_id || scopedIds.length)) {
    for (let offset = 0; ; offset += 500) {
      let query = db.from('shopify_orders').select('shopify_order_id, order_name, currency, total_amount, financial_status, customer, created_at')
        .eq('installation_id', installation.id).order('id', { ascending: true }).range(offset, offset + 499);
      if (details.customer_id) query = query.eq('customer->>id', details.customer_id);
      if (scopedIds.length) query = query.in('shopify_order_id', scopedIds);
      const result = await query;
      if (result.error) return Response.json({ error: 'export_failed' }, { status: 503 });
      if (offset >= 10000 && result.data?.length) return Response.json({ error: 'manual_export_required' }, { status: 413 });
      orders.push(...(result.data || []));
      if ((result.data?.length || 0) < 500) break;
    }
  }
  const logged = await db.from('audit_logs').insert({ admin_id: session.user.id, merchant_id: request.merchant_id,
    action: 'shopify_privacy.exported', entity_type: 'shopify_privacy_requests', entity_id: id });
  if (logged.error) return Response.json({ error: 'audit_failed' }, { status: 503 });
  return Response.json({ request_id: id, topic: request.topic, shop_domain: request.shop_domain,
    request: details, mirrored_orders: orders, remaining_review: 'Vérifier les données financières, journaux et sauvegardes avant livraison ou clôture.' }, {
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `attachment; filename="shopify-privacy-${id}.json"` },
  });
}
