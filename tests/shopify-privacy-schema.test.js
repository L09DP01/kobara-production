import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

test('Shopify schema enforces irreversible redaction and atomic one-use account linking', { skip: !process.env.PGLITE_TEST_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.PGLITE_TEST_MODULE));
  const db = new PGlite();
  const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const merchant = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  const handoff = '00000000-0000-4000-8000-000000000003';
  const order = '00000000-0000-4000-8000-000000000004';
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.merchants(id uuid primary key, kyc_status text);
      CREATE TABLE public.super_admins(id uuid primary key);
      CREATE TABLE public.payments(id uuid primary key);
      CREATE TABLE public.payment_links(id uuid primary key, metadata jsonb, status text);
      INSERT INTO public.merchants VALUES ('${merchant}', 'approved'), ('${other}', 'pending');`);
    await db.exec(read('supabase/migrations/20260828165318_shopify_connect.sql'));
    await db.exec(read('supabase/migrations/20261021230910_shopify_installation_privacy_hardening.sql'));
    await db.query(`INSERT INTO shopify_oauth_handoffs(id,shop_domain,browser_hash,nonce_hash,status,installation_data)
      VALUES ($1,'demo.myshopify.com','test-browser-hash','test-nonce-hash','authorized',$2::jsonb)`,
      [handoff, JSON.stringify({ shop_id: 1, shop_name: 'Demo', access_token_ciphertext: 'unit-test-placeholder', granted_scopes: ['write_orders'] })]);
    await assert.rejects(db.query('SELECT claim_shopify_oauth_handoff($1,$2,$3)', [handoff, 'wrong', merchant]), /invalid_handoff/);
    await assert.rejects(db.query('SELECT claim_shopify_oauth_handoff($1,$2,$3)', [handoff, null, merchant]), /invalid_handoff/);
    await assert.rejects(db.query('SELECT claim_shopify_oauth_handoff($1,$2,$3)', [handoff, 'test-browser-hash', other]), /kyc_required/);
    const claimed = await db.query('SELECT claim_shopify_oauth_handoff($1,$2,$3) AS id', [handoff, 'test-browser-hash', merchant]);
    const installationId = claimed.rows[0].id;
    assert.ok(installationId);
    await assert.rejects(db.query('SELECT claim_shopify_oauth_handoff($1,$2,$3)', [handoff, 'test-browser-hash', merchant]), /invalid_handoff/);
    assert.equal((await db.query('SELECT installation_data FROM shopify_oauth_handoffs WHERE id=$1', [handoff])).rows[0].installation_data, null);
    const reinstall = '00000000-0000-4000-8000-000000000005';
    await db.query(`INSERT INTO shopify_oauth_handoffs(id,shop_domain,browser_hash,nonce_hash,status,installation_data)
      VALUES ($1,'demo.myshopify.com','test-browser-hash','test-nonce-hash','authorized',$2::jsonb)`,
      [reinstall, JSON.stringify({ shop_id: 1, shop_name: 'Demo', access_token_ciphertext: 'refreshed-unit-test-placeholder', granted_scopes: ['write_orders'] })]);
    await db.query(`UPDATE merchants SET kyc_status='approved' WHERE id=$1`, [other]);
    await assert.rejects(db.query('SELECT claim_shopify_oauth_handoff($1,$2,$3)', [reinstall, 'test-browser-hash', other]), /shop_already_linked/);
    await db.query(`UPDATE shopify_installations SET status='uninstalled',access_token_ciphertext=NULL WHERE id=$1`, [installationId]);
    assert.equal((await db.query('SELECT claim_shopify_oauth_handoff($1,$2,$3) AS id', [reinstall, 'test-browser-hash', merchant])).rows[0].id, installationId);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM shopify_installations')).rows[0].count, 1);
    const payload = { id: 42, currency: 'HTG', total_price: '250', financial_status: 'pending', payment_gateway_names: ['Kobara'],
      shipping_address: { address1: 'private' }, customer: { phone: 'private' },
      line_items: [{ title: 'Product', quantity: 1, properties: [{ name: 'private' }] }] };
    await db.query(`INSERT INTO shopify_orders(id,installation_id,merchant_id,shopify_order_id,currency,total_amount,customer,raw_order)
      VALUES ($1,$2,$3,'42','HTG',250,$4::jsonb,$5::jsonb)`, [order, installationId, merchant,
      JSON.stringify({ id: 7, email: 'unit@example.invalid', phone: 'private' }), JSON.stringify(payload)]);
    let row = (await db.query('SELECT customer,raw_order FROM shopify_orders WHERE id=$1', [order])).rows[0];
    assert.doesNotMatch(JSON.stringify(row), /private|shipping_address|properties/);
    assert.equal(row.raw_order.line_items[0].title, 'Product');
    await db.query(`SELECT redact_shopify_customer($1,'7',ARRAY[]::text[])`, [installationId]);
    await db.query(`UPDATE shopify_orders SET privacy_redacted_at=NULL,customer='{"email":"restore@example.invalid"}',raw_order=$2::jsonb WHERE id=$1`, [order, JSON.stringify(payload)]);
    row = (await db.query('SELECT customer,raw_order,privacy_redacted_at FROM shopify_orders WHERE id=$1', [order])).rows[0];
    assert.deepEqual(row.customer, {}); assert.deepEqual(row.raw_order, {}); assert.ok(row.privacy_redacted_at);
    await db.query(`INSERT INTO shopify_orders(installation_id,merchant_id,shopify_order_id,currency,total_amount,customer)
      SELECT $1,$2,(1000+g)::text,'HTG',1,'{"id":9,"email":"large@example.invalid"}'::jsonb
      FROM generate_series(1,1505) g`, [installationId, merchant]);
    await db.query(`SELECT redact_shopify_customer($1,'9',ARRAY[]::text[])`, [installationId]);
    assert.equal((await db.query(`SELECT count(*)::int AS count FROM shopify_orders
      WHERE shopify_order_id::bigint > 1000 AND privacy_redacted_at IS NOT NULL`)).rows[0].count, 1505);
    for (const table of ['shopify_oauth_handoffs', 'shopify_privacy_requests']) {
      assert.equal((await db.query(`SELECT has_table_privilege('anon',$1,'SELECT') AS allowed`, [table])).rows[0].allowed, false);
    }
    await db.query('UPDATE shopify_oauth_handoffs SET expires_at=now()-interval \'1 hour\' WHERE id=$1', [handoff]);
    await db.exec('SELECT purge_expired_shopify_handoffs()');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM shopify_oauth_handoffs')).rows[0].count, 0);
    await db.query(`INSERT INTO payment_links(id,status,metadata) VALUES ($1,'active',$2::jsonb)`, [order,
      JSON.stringify({ shopify_installation_id: installationId })]);
    await db.query('INSERT INTO payments(id) VALUES ($1)', [order]);
    await db.query(`SELECT redact_shopify_shop('demo.myshopify.com')`);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM shopify_orders')).rows[0].count, 0);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM shopify_installations')).rows[0].count, 0);
    assert.equal((await db.query('SELECT status FROM payment_links WHERE id=$1', [order])).rows[0].status, 'inactive');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM payments')).rows[0].count, 1);
  } finally { await db.close(); }
});
