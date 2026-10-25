const { chromium } = require('C:/Users/owner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const screenshots = path.join(process.env.TEMP, 'kobara-email-design');
  await fs.mkdir(screenshots, { recursive: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (let index = 1; index <= 57; index++) {
        const response = await page.goto(`http://127.0.0.1:3041/email/${index}`);
        assert.equal(response.status(), 200);
        const layout = await page.evaluate(() => ({
          width: innerWidth, scroll: document.documentElement.scrollWidth,
          heading: document.querySelector('h1,h2')?.textContent,
          unsafe: !!document.querySelector('script,iframe,form'),
        }));
        assert.ok(layout.heading, `Missing heading: ${index}`);
        assert.ok(layout.scroll <= layout.width + 1, `Overflow at ${width}px: email ${index} (${layout.scroll})`);
        assert.equal(layout.unsafe, false);
        if ([3, 19, 28, 54].includes(index) && width !== 320) {
          await page.screenshot({ path: path.join(screenshots, `email-${index}-${width}.png`), fullPage: true });
        }
      }
    }
    assert.deepEqual(errors, []);
    console.log('171 preview checks passed (57 scenarios x 3 widths). Screenshots: ' + screenshots);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
