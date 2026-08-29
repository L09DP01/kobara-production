const fs = require('fs');
const path = require('path');

console.log("🔍 Démarrage de la vérification des contrats API (SSOT)...");

const openapiPath = path.join(__dirname, '../public/openapi.json');
if (!fs.existsSync(openapiPath)) {
  console.error("❌ ERREUR: public/openapi.json n'existe pas. Veuillez lancer 'npm run generate-openapi' d'abord.");
  process.exit(1);
}

const openapi = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
const paymentSchema = openapi.components?.schemas?.PaymentCreatePayload;

if (!paymentSchema) {
  console.error("❌ ERREUR: PaymentCreatePayload introuvable dans openapi.json");
  process.exit(1);
}

// On vérifie que la source de vérité a bien cancel_url et PAS errorUrl
const properties = paymentSchema.properties || {};
if (!properties.cancel_url) {
  console.error("❌ ERREUR: La source de vérité (OpenAPI) devrait contenir 'cancel_url'.");
  process.exit(1);
}

if (properties.errorUrl) {
  console.error("❌ ERREUR: La source de vérité (OpenAPI) contient 'errorUrl', elle devrait utiliser 'cancel_url'.");
  process.exit(1);
}

// Vérification des SDKs
const filesToCheck = [
  { path: '../kobara-js/src/types/index.ts', name: 'SDK JavaScript' },
  { path: '../kobara-node/src/types.ts', name: 'SDK Node.js' }
];

let hasError = false;

for (const file of filesToCheck) {
  const filePath = path.join(__dirname, file.path);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Avertissement: Fichier SDK introuvable: ${filePath}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Regex simples pour parser l'interface TypeScript sans AST complet
  if (content.includes('errorUrl')) {
    console.error(`❌ ERREUR (${file.name}): Contient la clé obsolète 'errorUrl'. Utilisez 'cancel_url'.`);
    hasError = true;
  }

  if (content.includes('successUrl')) {
    console.error(`❌ ERREUR (${file.name}): Contient la clé obsolète 'successUrl'. Utilisez 'success_url'.`);
    hasError = true;
  }

  if (!content.includes('cancel_url')) {
    console.error(`❌ ERREUR (${file.name}): Il manque la clé 'cancel_url'.`);
    hasError = true;
  }
}

if (hasError) {
  console.error("\n💥 ÉCHEC DE LA VÉRIFICATION. Les SDKs ne sont pas synchronisés avec la Source de Vérité (Backend).");
  process.exit(1);
}

console.log("✅ SUCCÈS: Tous les contrats API sont parfaitement synchronisés !");
process.exit(0);
