import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const ids = {
  user: '10000000-0000-4000-8000-000000000001', other: '10000000-0000-4000-8000-000000000002',
  member: '10000000-0000-4000-8000-000000000003', admin: '10000000-0000-4000-8000-000000000004',
  root: '20000000-0000-4000-8000-000000000001', otherRoot: '20000000-0000-4000-8000-000000000002',
  request: '30000000-0000-4000-8000-000000000001', request2: '30000000-0000-4000-8000-000000000002',
};

async function database() {
  const db = await PGlite.create();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    CREATE TABLE public.users(id uuid PRIMARY KEY, is_active boolean DEFAULT true, email text, email_verified boolean DEFAULT true);
    CREATE TABLE public.super_admins(id uuid PRIMARY KEY,is_active boolean DEFAULT true,role text DEFAULT 'compliance');
    CREATE TABLE public.merchants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES users(id),business_name text NOT NULL,
      business_slug text UNIQUE NOT NULL,email text,phone text,address text,category text,logo_url text,
      status text DEFAULT 'active', account_access text DEFAULT 'active',kyc_status text DEFAULT 'not_started',
      kyc_verified_at timestamptz,current_environment text DEFAULT 'test',shopify_review_mode boolean DEFAULT false,
      available_balance numeric DEFAULT 0,pending_balance numeric DEFAULT 0,reserved_balance numeric DEFAULT 0,
      available_balance_usd numeric DEFAULT 0,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE public.merchant_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),merchant_id uuid REFERENCES merchants(id),user_id uuid REFERENCES users(id),
      role text,status text DEFAULT 'active',created_at timestamptz DEFAULT now());
    CREATE TABLE public.kyc_profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),merchant_id uuid UNIQUE REFERENCES merchants(id),status text,
      metadata jsonb,reviewed_by uuid,rejection_reason text,approved_at timestamptz,rejected_at timestamptz);
    CREATE TABLE public.settings(merchant_id uuid UNIQUE REFERENCES merchants(id),security_json jsonb,notifications_json jsonb);
    CREATE TABLE public.audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),merchant_id uuid,user_id uuid,admin_id uuid,action text,
      entity_type text,entity_id uuid,metadata jsonb);
    CREATE TABLE public.payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),merchant_id uuid REFERENCES merchants(id),amount numeric,environment text DEFAULT 'test',status text DEFAULT 'pending');
    CREATE TABLE public.withdrawals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),merchant_id uuid REFERENCES merchants(id),amount numeric,environment text DEFAULT 'test');
    CREATE TABLE public.api_keys(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),merchant_id uuid REFERENCES merchants(id),key_hash text,environment text DEFAULT 'test');
    CREATE FUNCTION public.merchant_has_first_live_payment(p_id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM public.payments WHERE merchant_id=p_id AND amount>0) $$;
    CREATE FUNCTION public.get_current_merchant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM merchants WHERE user_id=auth.uid() LIMIT 1 $$;
    ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.merchant_members ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
    CREATE POLICY owned ON public.merchants FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    CREATE POLICY joined ON public.merchant_members FOR SELECT TO authenticated USING (user_id=auth.uid());
    CREATE POLICY payment_business ON public.payments FOR ALL TO authenticated USING (merchant_id=public.get_current_merchant_id()) WITH CHECK (merchant_id=public.get_current_merchant_id());
    CREATE POLICY key_business ON public.api_keys FOR ALL TO authenticated USING (merchant_id=public.get_current_merchant_id()) WITH CHECK (merchant_id=public.get_current_merchant_id());
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT SELECT ON public.payments TO anon;
  `);
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261023204248_multi_business_accounts.sql', import.meta.url), 'utf8'));
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261023225837_fix_multi_business_live_access.sql', import.meta.url), 'utf8'));
  await db.query('INSERT INTO users(id) VALUES ($1),($2),($3)', [ids.user,ids.other,ids.member]);
  await db.query('UPDATE users SET email=$1 WHERE id=$2',['owner@example.invalid',ids.user]);
  await db.query('INSERT INTO super_admins(id) VALUES ($1)', [ids.admin]);
  await db.query(`INSERT INTO merchants(id,user_id,business_name,business_slug,email,kyc_status,current_environment,available_balance,created_at)
    VALUES ($1,$2,'Academie A','academie-a','owner@example.invalid','approved','live',5000,'2020-01-01'),
      ($3,$4,'Atelier B','atelier-b','other@example.invalid','approved','live',7000,'2020-01-02')`, [ids.root,ids.user,ids.otherRoot,ids.other]);
  return db;
}

async function create(db, requestId=ids.request, user=ids.user, source=ids.root) {
  return (await db.query(`SELECT public.create_additional_business($1,$2,$3,'Academie Express','services','+50940000000',
    'Adresse fictive en Haiti','Formation et services numeriques professionnels','https://example.invalid') AS id`, [user,source,requestId])).rows[0].id;
}
async function identity(db, role, user, business) {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.role',$1,false),set_config('request.jwt.claim.sub',$2,false),set_config('request.headers',$3,false)",
    [role,user || '',JSON.stringify(business ? {'x-kobara-merchant-id':business} : {})]);
  await db.exec(`SET ROLE ${role}`);
}

test('validated legacy live and limited_live owners can create and approve another business without weakening restrictions', async () => {
  for (const access of ['live', 'limited_live']) {
    const db = await database();
    try {
      await db.query('UPDATE merchants SET account_access=$1 WHERE id=$2', [access, ids.root]);
      const id = await create(db);
      await db.query('SELECT review_additional_business($1,$2,true)', [id, ids.admin]);
      await db.query("INSERT INTO payments(merchant_id,environment,amount) VALUES ($1,'live',100)", [id]);
      await db.query('UPDATE merchants SET account_access=$1 WHERE id=$2', [access, ids.root]);
      assert.equal((await db.query('SELECT kyc_status FROM merchants WHERE id=$1', [id])).rows[0].kyc_status, 'approved');
      await db.query("UPDATE merchants SET account_access='reverify_required' WHERE id=$1", [ids.root]);
      await assert.rejects(create(db, ids.request2), /verified_owner_required/);
      assert.equal((await db.query('SELECT kyc_status FROM merchants WHERE id=$1', [id])).rows[0].kyc_status, 'in_review');
    } finally { await db.close(); }
  }
});

test('additional businesses reuse only the owner reference, start pending with zero funds, and creation is idempotent', async () => {
  const db = await database();
  try {
    const id = await create(db);
    assert.equal(await create(db), id);
    const row = (await db.query('SELECT * FROM merchants WHERE id=$1',[id])).rows[0];
    assert.equal(row.identity_owner_merchant_id, ids.root);
    assert.equal(row.business_verification_status,'pending');
    assert.equal(row.kyc_status,'in_review'); assert.equal(row.current_environment,'test');
    assert.equal((await db.query('SELECT merchant_activation_reminder_kind($1) AS kind',[id])).rows[0].kind,null);
    assert.equal(Number(row.available_balance),0); assert.equal(Number(row.available_balance_usd),0);
    assert.equal((await db.query('SELECT * FROM api_keys WHERE merchant_id=$1',[id])).rows.length,0);
    assert.equal((await db.query('SELECT * FROM audit_logs WHERE action=$1',['business.created'])).rows.length,1);
    await assert.rejects(create(db,ids.request2,ids.other,ids.root),/verified_owner_required/);
    await db.query("UPDATE merchants SET account_access='restricted' WHERE id=$1",[ids.root]);
    await assert.rejects(create(db,ids.request2),/verified_owner_required/);
  } finally { await db.close(); }
});

test('compliance approval is separate, checks the owner, and revocation preserves funds and disables linked live access', async () => {
  const db = await database();
  try {
    const id = await create(db);
    await assert.rejects(db.query("UPDATE merchants SET kyc_status='approved' WHERE id=$1",[id]),/verified_owner_and_activity_required/);
    await assert.rejects(db.query('SELECT review_additional_business($1,$2,true)',[id,ids.user]),/compliance_admin_required/);
    await db.query('SELECT review_additional_business($1,$2,true)',[id,ids.admin]);
    assert.equal((await db.query('SELECT kyc_status FROM merchants WHERE id=$1',[id])).rows[0].kyc_status,'approved');
    assert.equal((await db.query('SELECT merchant_activation_reminder_kind($1) AS kind',[id])).rows[0].kind,'first_payment');
    await db.query('UPDATE merchants SET available_balance=250 WHERE id=$1',[id]);
    await db.query("UPDATE merchants SET kyc_status='pending_reverification',account_access='reverify_required' WHERE id=$1",[ids.root]);
    const row = (await db.query('SELECT * FROM merchants WHERE id=$1',[id])).rows[0];
    assert.equal(row.kyc_status,'in_review'); assert.equal(row.business_verification_status,'pending');
    assert.equal(Number(row.available_balance),250);
    await assert.rejects(db.query('SELECT review_additional_business($1,$2,true)',[id,ids.admin]),/verified_owner_required/);
    await db.query("UPDATE merchants SET kyc_status='approved',account_access='active' WHERE id=$1",[ids.root]);
    assert.equal((await db.query('SELECT kyc_status FROM merchants WHERE id=$1',[id])).rows[0].kyc_status,'in_review');
  } finally { await db.close(); }
});

test('RLS switches payments and keys by authorized business, rejects forged context and revoked members', async () => {
  const db = await database();
  try {
    const id = await create(db);
    for (const merchantId of [ids.root,id,ids.otherRoot]) {
      await db.query('INSERT INTO payments(merchant_id,amount) VALUES ($1,100)',[merchantId]);
      await db.query("INSERT INTO api_keys(merchant_id,key_hash) VALUES ($1,'unit-placeholder')",[merchantId]);
    }
    await identity(db,'authenticated',ids.user,id);
    assert.equal((await db.query('SELECT merchant_id FROM payments')).rows[0].merchant_id,id);
    assert.equal((await db.query('SELECT merchant_id FROM api_keys')).rows[0].merchant_id,id);
    assert.equal((await db.query('SELECT * FROM payments')).rows.length,1);
    await assert.rejects(db.query("INSERT INTO payments(merchant_id,environment) VALUES ($1,'test')",[id]),/business_operation_server_only/);
    await assert.rejects(db.query("UPDATE payments SET status='succeeded' WHERE merchant_id=$1",[id]),/business_operation_server_only/);
    await assert.rejects(db.query("UPDATE api_keys SET environment='live' WHERE merchant_id=$1",[id]),/business_operation_server_only/);
    assert.equal((await db.query('UPDATE payments SET amount=999 WHERE merchant_id=$1',[ids.root])).affectedRows,0);
    await assert.rejects(db.query('INSERT INTO payments(merchant_id,amount) VALUES ($1,100)',[ids.otherRoot]),/row-level security/);
    await identity(db,'authenticated',ids.user,ids.otherRoot);
    assert.equal((await db.query('SELECT * FROM payments')).rows.length,0);
    await identity(db,'authenticated',ids.user,'invalid-id');
    assert.equal((await db.query('SELECT * FROM payments')).rows.length,0);
    await identity(db,'authenticated',ids.user);
    assert.equal((await db.query('SELECT merchant_id FROM payments')).rows[0].merchant_id,ids.root);
    await db.exec('RESET ROLE');
    await db.query("INSERT INTO merchant_members(merchant_id,user_id,role,status) VALUES ($1,$2,'developer','active')",[id,ids.member]);
    await identity(db,'authenticated',ids.member,id);
    assert.equal((await db.query('SELECT * FROM payments')).rows.length,1);
    await db.exec('RESET ROLE');
    await db.query("UPDATE merchant_members SET status='revoked' WHERE user_id=$1",[ids.member]);
    await identity(db,'authenticated',ids.member,id);
    assert.equal((await db.query('SELECT * FROM payments')).rows.length,0);
    await identity(db,'anon',null,id);
    assert.equal((await db.query('SELECT public.get_current_merchant_id() AS id')).rows[0].id,null);
  } finally { await db.close(); }
});

test('public clients cannot create or approve businesses nor overwrite linked identity and business review fields', async () => {
  const db = await database();
  try {
    const id = await create(db);
    await identity(db,'authenticated',ids.user,id);
    await assert.rejects(create(db,ids.request2),/permission denied/);
    await assert.rejects(db.query('SELECT review_additional_business($1,$2,true)',[id,ids.admin]),/permission denied/);
    await assert.rejects(db.query("INSERT INTO merchants(user_id,business_name,business_slug) VALUES ($1,'Unlinked business','unit-unlinked')",[ids.user]),/business_management_server_only/);
    await assert.rejects(db.query("UPDATE merchants SET business_verification_status='approved' WHERE id=$1",[id]),/business_management_server_only/);
    await assert.rejects(db.query('UPDATE merchants SET identity_owner_merchant_id=NULL WHERE id=$1',[id]),/business_management_server_only/);
    await assert.rejects(db.query('UPDATE merchants SET user_id=$1 WHERE id=$2',[ids.other,id]),/business_identity_owner_immutable/);
    await identity(db,'anon',null);
    await assert.rejects(create(db),/permission denied/);
  } finally { await db.close(); }
});

test('pending activities cannot insert live payments, keys or withdrawals, while already-started payments can still settle after restriction', async () => {
  const db=await database();
  try {
    const id=await create(db);
    for(const table of ['payments','withdrawals','api_keys']) {
      await assert.rejects(db.query(`INSERT INTO ${table}(merchant_id,environment) VALUES ($1,'live')`,[id]),/business_review_required/);
    }
    await db.query('SELECT review_additional_business($1,$2,true)',[id,ids.admin]);
    const payment=(await db.query("INSERT INTO payments(merchant_id,environment,amount) VALUES ($1,'live',100) RETURNING id",[id])).rows[0];
    await db.query("UPDATE merchants SET account_access='restricted' WHERE id=$1",[ids.root]);
    await assert.rejects(db.query("INSERT INTO payments(merchant_id,environment) VALUES ($1,'live')",[id]),/business_review_required/);
    await db.query("UPDATE payments SET status='succeeded' WHERE id=$1",[payment.id]);
    assert.equal((await db.query('SELECT status FROM payments WHERE id=$1',[payment.id])).rows[0].status,'succeeded');
  } finally {await db.close();}
});
