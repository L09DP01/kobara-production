const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL non définie dans .env ou .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('⚡ Connexion à PostgreSQL Supabase réussie !');

    const sqlPath = path.join(__dirname, '../supabase/migrations/20260826180000_paypal_and_usd_multicurrency.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🚀 Exécution de la migration PostgreSQL pour PayPal & USD Multi-devises...');
    await client.query(sql);
    console.log('✅ Migration PostgreSQL appliquée avec SUCCÈS sur Supabase !');
  } catch (err) {
    console.error('❌ Erreur lors de l''exécution de la migration :', err);
  } finally {
    await client.end();
  }
}

runMigration();