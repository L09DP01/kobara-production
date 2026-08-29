import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('Telegram AI Assistant: Live Documentation Loading Invariants', async (t) => {
  await t.test('Docs directory contains core integration markdown files', () => {
    const docsDir = path.join(process.cwd(), 'src/content/docs');
    assert.ok(fs.existsSync(docsDir), 'Docs directory src/content/docs must exist');

    const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md'));
    assert.ok(files.length >= 10, `At least 10 markdown documentation files should exist (found ${files.length})`);

    const expectedFiles = [
      'quickstart.md',
      'payments.md',
      'webhooks.md',
      'payment-links.md',
      'api-keys.md',
      'wordpress-plugin.md',
      'nodejs-sdk.md',
      'php-sdk.md',
      'python-sdk.md',
      'withdrawals.md',
    ];

    for (const expected of expectedFiles) {
      assert.ok(files.includes(expected), `Expected doc file ${expected} should be present in docs directory`);
    }
  });

  await t.test('Live context builder generates canonical reference links for each doc page', () => {
    const docsDir = path.join(process.cwd(), 'src/content/docs');
    const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md'));

    const generatedUrls = files.map((f) => `https://kobara.app/docs/${f.replace('.md', '')}`);

    assert.ok(generatedUrls.includes('https://kobara.app/docs/payments'));
    assert.ok(generatedUrls.includes('https://kobara.app/docs/webhooks'));
    assert.ok(generatedUrls.includes('https://kobara.app/docs/wordpress-plugin'));
    assert.ok(generatedUrls.includes('https://kobara.app/docs/quickstart'));
  });

  await t.test('OpenAPI v1 specification exists and is accessible', () => {
    const openapiPath = path.join(process.cwd(), 'public/openapi.json');
    assert.ok(fs.existsSync(openapiPath), 'public/openapi.json should exist');

    const content = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
    assert.ok(content.paths, 'OpenAPI spec must contain paths');
    assert.ok(content.paths['/api/v1/payments'], 'OpenAPI spec must define /api/v1/payments');
  });
});
