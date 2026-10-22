// Browser-only fixtures: no real account, database writes or Slack calls.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
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
    const page = await browser.newPage();
    const day = '2026-10-22';
    await page.clock.setFixedTime(new Date(day + 'T12:00:00+09:00'));
    const first = day.slice(0, 8) + '01';
    const base = { projectId: null, color: '#8E8AA3', description: null };
    const events = [
      {
        ...base,
        id: '1',
        title: 'A very long ended event title that must not hide its status',
        allDay: false,
        startsAt: first + 'T00:00:00+09:00',
        endsAt: first + 'T00:00:01+09:00',
      },
      { ...base, id: '2', title: 'Ended all-day', allDay: true, startDate: first, endDate: day },
      {
        ...base,
        id: '3',
        projectId: 'archived',
        title: 'Past event in archived project',
        allDay: false,
        startsAt: first + 'T14:00:00+09:00',
        endsAt: first + 'T15:00:00+09:00',
      },
    ];
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
    await page.route('**/api/**', (r) => {
      const p = new URL(r.request().url()).pathname;
      return r.fulfill({
        json: p.startsWith('/api/auth/')
          ? { user: { id: '1', email: 'qa@example.test', nickname: 'QA' } }
          : p === '/api/workspace'
            ? {
                projects: [
                  {
                    id: 'archived',
                    name: 'Archived history',
                    color: '#8E8AA3',
                    archivedAt: day + 'T00:00:00+09:00',
                  },
                ],
                tasks: [],
                events,
                reminders: [],
              }
            : [],
      });
    });
    await page.goto((process.env.CHECK_BASE_URL || 'http://127.0.0.1:4320') + '/login');
    await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
    await page.locator('input[type=email]').fill('qa@example.test');
    await page.locator('input[type=password]').fill('test-password');
    await page.locator('.login-button').click();
    await page.waitForURL((url) => url.pathname === '/');
    await page.evaluate(() =>
      document
        .querySelector('#__nuxt')
        .__vue_app__.config.globalProperties.$router.push('/calendar'),
    );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator('.calendar-item').first().waitFor();
      assert.ok(
        await page.locator('.calendar-item.is-ended-event[href="/items/events/1"]').count(),
      );
      assert.ok(
        await page.locator('.calendar-item.is-ended-event[href="/items/events/2"]').count(),
      );
      assert.ok(
        await page.locator('.calendar-item.is-ended-event[href="/items/events/3"]').count(),
        'Past events must remain visible after their project is archived',
      );
      assert.equal(
        await page.locator('.calendar-ended-label').count(),
        await page.locator('.calendar-item').count(),
      );
      for (const badge of await page.locator('.calendar-ended-label').all()) {
        assert.equal(
          await badge.evaluate((el) => {
            const b = el.getBoundingClientRect(),
              p = el.parentElement.getBoundingClientRect();
            return b.width > 0 && b.right <= p.right && b.left >= p.left;
          }),
          true,
        );
      }
      assert.equal(
        await page
          .locator('.calendar-item.is-ended-event')
          .first()
          .evaluate((el) => getComputedStyle(el).opacity),
        '0.6',
      );
      console.log(`PASS ended calendar entries, labels and muted style at ${width}px`);
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
