// Local UI checks; no account changes, database writes or Slack calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const cache = path.join(process.env.LOCALAPPDATA, 'npm-cache/_npx');
const pkg = fs
  .readdirSync(cache)
  .map((x) => path.join(cache, x, 'node_modules/playwright/package.json'))
  .find((x) => fs.existsSync(x));
const { chromium } = createRequire(pkg)('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
    await page.route('**/api/**', (r) =>
      r.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
    );
    await page.goto((process.env.CHECK_BASE_URL || 'http://127.0.0.1:4320') + '/privacy');
    if (process.env.CHECK_LAYOUT_ONLY !== '1')
      await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
    for (const width of [320, 390, 767, 768]) {
      await page.setViewportSize({ width, height: 650 });
      assert.equal(
        await page.locator('.theme-switcher').evaluate((el) => getComputedStyle(el).position),
        'fixed',
      );
      if (width <= 767) {
        assert.equal(
          await page.locator('.theme-switcher').evaluate((el) => {
            const box = el.getBoundingClientRect();
            const background = getComputedStyle(el).backgroundColor;
            return (
              box.left === 0 &&
              box.right >= innerWidth - 20 &&
              box.right <= innerWidth &&
              Math.abs(box.bottom - innerHeight) <= 1 &&
              background !== 'transparent' &&
              !background.includes('rgba(')
            );
          }),
          true,
          'Mobile toolbar must have an opaque full-width fixed background',
        );
        for (const href of ['/privacy', '/terms']) {
          const link = page.locator(`.site-footer a[href="${href}"]`);
          await link.scrollIntoViewIfNeeded();
          assert.equal(
            await link.evaluate((el) => {
              const b = el.getBoundingClientRect();
              return el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
            }),
            true,
            `Footer link must be reachable at ${width}px`,
          );
          await link.click({ trial: true });
        }
      }
      console.log(`PASS layout and footer at ${width}px`);
    }
    if (process.env.CHECK_LAYOUT_ONLY === '1') return;
    await page.setViewportSize({ width: 390, height: 650 });
    await page.evaluate(() =>
      document
        .querySelector('#__nuxt')
        .__vue_app__.config.globalProperties.$router.push('/slack/callback?result=failed'),
    );
    await page.locator('.page-help-button').first().waitFor();
    await page.evaluate(() => window.scrollTo({ top: 180, behavior: 'instant' }));
    const before = await page.evaluate(() => window.scrollY);
    await page
      .getByRole('button', { name: '도움말', exact: true })
      .first()
      .evaluate((el) => el.click());
    await page.waitForFunction(() => document.body.style.position === 'fixed');
    await page.mouse.move(5, 400);
    await page.mouse.wheel(0, 700);
    assert.equal(await page.evaluate(() => window.scrollY), 0);
    assert.equal(await page.evaluate(() => document.body.style.top), `${-before}px`);
    // A second modal must not unlock the first when it closes.
    await page.evaluate(() => {
      const nested = document.createElement('dialog');
      nested.id = 'nested-scroll-check';
      nested.textContent = 'Nested dialog';
      document.body.append(nested);
      nested.showModal();
      nested.close();
      nested.remove();
    });
    assert.equal(await page.evaluate(() => document.body.style.position), 'fixed');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.body.style.position !== 'fixed');
    assert.equal(await page.evaluate(() => window.scrollY), before);
    console.log(
      'PASS modal wheel lock, nested dialogs, scroll restoration, mobile footer links and 767/768px layout boundary',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
