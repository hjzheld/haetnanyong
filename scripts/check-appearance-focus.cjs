// Local browser regression: no account changes or real API requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const cache = path.join(process.env.LOCALAPPDATA, 'npm-cache/_npx');
const packagePath = fs
  .readdirSync(cache)
  .map((entry) => path.join(cache, entry, 'node_modules/playwright/package.json'))
  .find((entry) => fs.existsSync(entry));
if (!packagePath) throw new Error('Playwright is required for browser checks');
const { chromium } = createRequire(packagePath)('playwright');
const base = process.env.CHECK_BASE_URL || 'http://127.0.0.1:4320';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const reducedMotion of ['reduce', 'no-preference']) {
      const context = await browser.newContext({ reducedMotion });
      const page = await context.newPage();
      await page.route('**/api/**', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Unauthorized' }),
        }),
      );
      await page.goto(`${base}/login`);
      await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
      for (const [kind, cookie, value] of [
        ['language', 'nyang-locale', 'en'],
        ['theme', 'nyang-theme', 'dark'],
      ]) {
        const trigger = page.locator(`.${kind}-floating-button`);
        const panel = page.locator(`#${kind}-options-panel`);
        await trigger.click();
        await panel.waitFor({ state: 'visible' });
        // Force the suspected blur between pointerdown and the label's click.
        await panel
          .locator(`input[value="${value}"]`)
          .locator('..')
          .evaluate((label) => {
            label.addEventListener(
              'pointerdown',
              () => {
                document.activeElement.dispatchEvent(
                  new FocusEvent('focusout', {
                    bubbles: true,
                    relatedTarget: null,
                  }),
                );
              },
              { once: true },
            );
          });
        await panel.locator(`input[value="${value}"]`).locator('..').click();
        await page.waitForFunction(
          ({ cookie, value }) => document.cookie.split('; ').includes(`${cookie}=${value}`),
          { cookie, value },
        );
        await page.reload();
        await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
        await trigger.click();
        await panel.waitFor({ state: 'visible' });
        assert.equal(await panel.locator(`input[value="${value}"]`).isChecked(), true);
        await page.keyboard.press('Escape');
        await panel.waitFor({ state: 'hidden' });
        assert.equal(await trigger.evaluate((el) => document.activeElement === el), true);
        await trigger.click();
        await page.locator('h1').first().click();
        await panel.waitFor({ state: 'hidden' });
        await trigger.click();
        // A known focus destination outside the widget must still close it.
        await page.locator('input[type="email"]').focus();
        await panel.waitFor({ state: 'hidden' });
      }
      await context.close();
      console.log(
        `PASS appearance focus / ${reducedMotion}: selection, cookies, reload, Escape, outside click and focus`,
      );
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
