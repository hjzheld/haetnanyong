// Mocked APIs only. This check never accesses the database or sends Slack messages.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const cache = path.join(process.env.LOCALAPPDATA, 'npm-cache/_npx');
const pkg = fs
  .readdirSync(cache)
  .map((entry) => path.join(cache, entry, 'node_modules/playwright/package.json'))
  .find((entry) => fs.existsSync(entry));
if (!pkg) throw new Error('Playwright is required for browser checks');
const { chromium } = createRequire(pkg)('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    const updates = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
    const user = { id: '1', email: 'qa@example.test', nickname: 'QA' };
    const baseItem = { color: '#123456', description: null, startDate: '2026-10-22' };
    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.startsWith('/api/auth/')) return route.fulfill({ json: { user } });
      if (pathname === '/api/workspace')
        return route.fulfill({ json: { projects: [], tasks: [], events: [], reminders: [] } });
      if (/^\/api\/(tasks|events)\/\d+$/.test(pathname)) {
        const id = pathname.split('/').pop();
        const item = {
          ...baseItem,
          id,
          projectId: id === '1' ? '10' : null,
          title: id === '1' ? 'Project item' : 'Standalone item',
          ...(pathname.includes('/tasks/')
            ? { dueDate: '2026-10-23', status: 'TODO', priority: 'MEDIUM' }
            : { allDay: true, endDate: '2026-10-23', startsAt: null, endsAt: null }),
        };
        if (route.request().method() === 'PATCH') updates.push(route.request().postDataJSON());
        return route.fulfill({ json: item });
      }
      if (pathname === '/api/reminders') return route.fulfill({ json: [] });
      throw new Error('Unexpected API: ' + pathname);
    });
    const base = process.env.CHECK_BASE_URL || 'http://127.0.0.1:4320';
    await page.goto(base + '/login');
    await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
    await page.locator('input[type=email]').fill(user.email);
    await page.locator('input[type=password]').fill('qa-password');
    await page.locator('.login-button').click();
    await page.locator('.metric-row').waitFor();
    for (const resource of ['tasks', 'events']) {
      for (const id of ['1', '2']) {
        await page.evaluate(
          (url) =>
            document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push(url),
          `/items/${resource}/${id}/edit`,
        );
        const color = page.getByLabel('표시 색상', { exact: true });
        await color.waitFor();
        assert.equal(
          await color.isDisabled(),
          id === '1',
          'Project colors must remain locked on direct edit pages',
        );
        if (id === '2') await color.fill('#ABCDEF');
        await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
        await page.waitForURL(base + `/items/${resource}/${id}`);
        const update = updates.at(-1);
        assert.equal(
          Object.hasOwn(update, 'color'),
          id === '2',
          'Only standalone items may submit a color',
        );
        if (id === '2') assert.equal(update.color.toUpperCase(), '#ABCDEF');
      }
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS: project task/event colors remain locked and omitted from direct edit payloads; standalone item colors remain editable. All APIs mocked.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
