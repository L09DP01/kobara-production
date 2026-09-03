const fs = require("fs");
const path = require("path");

const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
};

const read = (relativePath) => {
  const absolutePath = path.join(__dirname, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Missing file: ${absolutePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
};

const readOptional = (relativePath) => {
  const absolutePath = path.join(__dirname, relativePath);
  if (!fs.existsSync(absolutePath)) {
    console.warn(`WARN: SDK source is not checked out next to Production: ${absolutePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
};

const openapi = JSON.parse(read("../public/openapi.json"));
const payment = openapi.components?.schemas?.PaymentCreatePayload;
const withdrawal = openapi.components?.schemas?.WithdrawalCreatePayload;

if (!payment || !withdrawal) {
  fail("PaymentCreatePayload or WithdrawalCreatePayload is missing from OpenAPI.");
} else {
  const expectedProviders = [
    "kobara", "moncash", "moncash_web", "moncash_ussd",
    "natcash", "natcash_web", "natcash_ussd", "card", "carte",
    "paypal", "apple_pay", "google_pay",
  ];
  const actualProviders = payment.properties?.provider?.enum || [];
  for (const provider of expectedProviders) {
    if (!actualProviders.includes(provider)) fail(`OpenAPI payment provider is missing: ${provider}`);
  }
  for (const field of ["amount", "provider", "success_url", "cancel_url"]) {
    if (!payment.properties?.[field]) fail(`OpenAPI payment field is missing: ${field}`);
  }

  const methods = withdrawal.properties?.method?.enum || [];
  if (methods.join(",") !== "moncash,natcash") {
    fail("Public withdrawals must support exactly moncash and natcash.");
  }
  for (const field of ["amount", "method", "account_currency", "wallet"]) {
    if (!withdrawal.properties?.[field]) fail(`OpenAPI withdrawal field is missing: ${field}`);
  }
}

const sources = [
  { name: "JavaScript", file: "../../kobara-js/src/types/index.ts", client: "../../kobara-js/src/client.ts" },
  { name: "Node.js", file: "../../kobara-node/src/types.ts", client: "../../kobara-node/src/client.ts" },
  { name: "Python", file: "../../kobara-python/kobara/types.py", client: "../../kobara-python/kobara/client.py" },
  { name: "PHP", file: "../../kobara-php-sdk/src/Resources/Payments.php", client: "../../kobara-php-sdk/src/KobaraClient.php" },
];

for (const source of sources) {
  const contract = readOptional(source.file);
  const client = readOptional(source.client);
  if (!contract || !client) continue;

  if (!client.includes("https://api.kobara.app/v1")) {
    fail(`${source.name} does not use the canonical Production API base URL.`);
  }
  for (const stale of ["https://api.kobara.app/api/v1", "https://kobara.app/api/v1"]) {
    if (client.includes(stale)) fail(`${source.name} still contains stale base URL ${stale}.`);
  }
  const normalizedContract = contract.toLowerCase();
  for (const field of ["provider", "success_url", "cancel_url"]) {
    if (!normalizedContract.includes(field)) fail(`${source.name} payment contract is missing ${field}.`);
  }
  for (const value of ["moncash", "natcash", "paypal", "apple_pay", "google_pay"]) {
    if (!normalizedContract.includes(value)) fail(`${source.name} payment contract is missing provider ${value}.`);
  }
}

const withdrawalSources = [
  "../../kobara-js/src/types/index.ts",
  "../../kobara-node/src/types.ts",
  "../../kobara-python/README.md",
  "../../kobara-php-sdk/README.md",
];
for (const source of withdrawalSources) {
  const content = readOptional(source).toLowerCase();
  if (!content) continue;
  for (const field of ["moncash", "natcash"]) {
    if (!content.includes(field)) fail(`${source} is missing withdrawal method ${field}.`);
  }
}

const publishedRoutes = Object.keys(openapi.paths || {}).sort();
if (publishedRoutes.join(",") !== "/v1/payments,/v1/withdrawals") {
  fail(`Unexpected public route set: ${publishedRoutes.join(", ")}`);
}

if (!process.exitCode) console.log("API, SDK and OpenAPI contracts are synchronized.");
