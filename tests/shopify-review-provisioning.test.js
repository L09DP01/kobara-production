import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Optional isolated PostgreSQL runtime, never a production connection.
test('review provisioning tolerates automatically created settings', { skip: !process.env.PGLITE_TEST_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.PGLITE_TEST_MODULE));
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE users(id uuid primary key,email text unique,password_hash text,email_verified boolean,first_name text,last_name text,role text,is_active boolean);
      CREATE TABLE merchants(id uuid primary key,user_id uuid,email text,business_name text,business_slug text,phone text,category text,status text,kyc_status text,current_environment text,account_access text,plan_slug text,plan_status text,shopify_review_mode boolean,referral_code text,notification_prefs jsonb,available_balance numeric default 0,available_balance_usd numeric default 0);
      CREATE TABLE settings(merchant_id uuid unique,security_json jsonb,notifications_json jsonb);
      CREATE FUNCTION crypt(text,text) RETURNS text LANGUAGE sql AS $$ SELECT 'unit-test-hash'::text $$;
      CREATE FUNCTION gen_salt(text,int) RETURNS text LANGUAGE sql AS $$ SELECT 'unit-test-salt'::text $$;
      CREATE FUNCTION create_settings() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN INSERT INTO settings VALUES(NEW.id,'{"preserved":true}'::jsonb,'{}'::jsonb); RETURN NEW; END; $$;
      CREATE TRIGGER auto_settings AFTER INSERT ON merchants FOR EACH ROW EXECUTE FUNCTION create_settings();
    `);
    const source = fs.readFileSync(new URL('../docs/SHOPIFY_REVIEW_ACCOUNT.sql', import.meta.url), 'utf8')
      .replace("v_password TEXT := 'SET_A_STRONG_PASSWORD_HERE';", "v_password TEXT := 'unit-test-only-password';");
    await db.exec(source);
    const { rows } = await db.query(`SELECT s.security_json, u.role, m.available_balance, m.shopify_review_mode
      FROM settings s JOIN merchants m ON m.id=s.merchant_id JOIN users u ON u.id=m.user_id`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].security_json.two_factor_method, 'none');
    assert.equal(rows[0].security_json.preserved, true);
    assert.equal(rows[0].role, 'merchant');
    assert.equal(Number(rows[0].available_balance), 0);
    assert.equal(rows[0].shopify_review_mode, true);
  } finally {
    await db.close();
  }
});
