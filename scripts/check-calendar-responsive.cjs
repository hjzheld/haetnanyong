// All APIs are mocked; no account or database data is changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const cache = path.join(process.env.LOCALAPPDATA, 'npm-cache/_npx');
const packagePath = fs
  .readdirSync(cache)
  .map((entry) => path.join(cache, entry, 'node_modules/playwright/package.json'))
  .find((entry) => fs.existsSync(entry));
if (!packagePath) throw new Error('Playwright is required');
const { chromium } = createRequire(packagePath)('playwright');
const base = process.env.CHECK_BASE_URL || 'http://127.0.0.1:4318';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const tomorrow = new Date(Date.parse(today + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
const event = {
  id: '1',
  projectId: null,
  title: '긴 일정 제목도 모바일에서 확인하기',
  description: '첫 번째 설명\n두 번째 설명',
  color: '#8E8AA3',
  allDay: true,
  startDate: today,
  endDate: tomorrow,
  startsAt: null,
  endsAt: null,
};
async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ body: '', contentType: 'text/css' }),
    );
    await page.route('**/api/**', (route) => {
      const url = new URL(route.request().url());
      const json = url.pathname.startsWith('/api/auth/')
        ? { user: { id: '1', email: 'qa@example.test', nickname: '검증냥' } }
        : { projects: [], tasks: [], events: [event], reminders: [] };
      return route.fulfill({ json });
    });
    await page.goto(base + '/login');
    await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
    await page.locator('input[type=email]').fill('qa@example.test');
    await page.locator('input[type=password]').fill('qa-password');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.waitForURL((url) => url.pathname !== '/login');
    await page.evaluate(() =>
      document
        .querySelector('#__nuxt')
        .__vue_app__.config.globalProperties.$router.push('/calendar'),
    );
    await page.locator('.calendar-item').waitFor();
    for (const width of [1440, 767, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const metrics = await page.locator('.calendar').evaluate((calendar) => ({
        width: calendar.getBoundingClientRect().width,
        available: calendar.parentElement.clientWidth,
        height: calendar.querySelector('.day.today').getBoundingClientRect().height,
        pageWidth: document.documentElement.scrollWidth,
      }));
      assert.ok(metrics.width <= metrics.available + 1, `Calendar fits at ${width}px`);
      assert.ok(metrics.pageWidth <= width, `Page fits at ${width}px`);
      if (width <= 767) assert.ok(metrics.height >= 150, 'Mobile rows are taller');
      await page.locator('.day.today .calendar-day-trigger').click({ position: { x: 5, y: 5 } });
      const dialog = page.locator('.calendar-detail-dialog');
      await dialog.waitFor({ state: 'visible' });
      assert.ok((await dialog.textContent()).includes(event.description));
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await page.locator('.calendar-item').click();
      await dialog.waitFor({ state: 'visible' });
      await dialog.getByRole('button', { name: '닫기', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      await page.locator('.day:not(.blank):not(.today) .calendar-day-trigger').first().click();
      assert.ok((await dialog.textContent()).includes('등록된 일정이 없어요.'));
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS: desktop/mobile widths, tall mobile rows, day/event detail modals, empty days, Escape and close.',
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
