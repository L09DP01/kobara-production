
const fs = require("fs");
const path = require("path");

const content = fs.readFileSync("contenudocs.md", "utf8");
const sections = content.split(/^# /m);

const docsDir = path.join("src", "content", "docs");
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// Map headers to file names
const fileMapping = {
  "API Keys": "api-keys.md",
  "Authentication": "authentication.md",
  "JavaScript SDK": "javascript-sdk.md",
  "Node.js SDK": "nodejs-sdk.md",
  "Python SDK": "python-sdk.md",
  "PHP SDK": "php-sdk.md",
  "Integration avec Kobara": "quickstart.md",
  "WordPress Plugin": "wordpress-plugin.md",
  "AI Integration": "ai-integration.md",
  "Payments API": "payments.md",
  "Payment Links API": "payment-links.md",
  "Webhooks": "webhooks.md",
  "Withdrawals API": "withdrawals.md",
  "Metadata Expansion": "metadata.md",
  "Errors API": "errors.md"
};

sections.forEach((section) => {
  if (!section.trim()) return;
  const lines = section.split("\n");
  const title = lines[0].trim();
  
  if (fileMapping[title]) {
    const fileName = fileMapping[title];
    const fileContent = "# " + section;
    fs.writeFileSync(path.join(docsDir, fileName), fileContent);
    console.log("Created", fileName);
  } else {
    console.log("Skipping unknown section:", title);
  }
});

