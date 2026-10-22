// All API calls are mocked; no account changes, database writes or Slack calls.
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
const base = process.env.CHECK_BASE_URL || 'http://127.0.0.1:4320';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-22T12:00:00+09:00'));
    const user = { id: '1', email: 'qa@example.test', nickname: 'QA' };
    const project = { id: '1', name: 'Toggle checks', color: '#8E8AA3', archivedAt: null };
    const tasks = [
      { id: '1', title: 'Upcoming', dueDate: '2026-10-23', status: 'TODO' },
      { id: '2', title: 'Overdue', dueDate: '2026-10-21', status: 'TODO' },
      { id: '3', title: 'Already done', dueDate: '2026-10-23', status: 'DONE' },
    ].map((task) => ({
      ...task,
      projectId: '1',
      startDate: '2026-10-20',
      priority: 'MEDIUM',
      description: null,
      color: '#8E8AA3',
    }));
    let rejectChange = true;
    let mutations = 0;
    await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.startsWith('/api/auth/')) return route.fulfill({ json: { user } });
      if (pathname === '/api/workspace')
        return route.fulfill({ json: { projects: [project], tasks, events: [], reminders: [] } });
      if (pathname === '/api/account/slack')
        return route.fulfill({ json: { connected: false, oauthConfigured: true } });
      if (/^\/api\/tasks\/\d+$/.test(pathname) && route.request().method() === 'PATCH') {
        mutations++;
        if (rejectChange)
          return route.fulfill({ status: 500, json: { statusCode: 500, message: 'Test failure' } });
        const task = tasks.find((entry) => entry.id === pathname.split('/').pop());
        task.status = route.request().postDataJSON().status;
        return route.fulfill({ json: task });
      }
      throw new Error('Unexpected API: ' + pathname);
    });
    await page.goto(base + '/login');
    await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
    await page.locator('input[type=email]').fill(user.email);
    await page.locator('input[type=password]').fill('qa-password');
    await page.locator('.login-button').click();
    await page.locator('.metric-row').waitFor();
    async function rejectedToggle(name, initial) {
      const checkbox = page.getByRole('checkbox', { name: name + ' 완료', exact: true });
      assert.equal(await checkbox.isChecked(), initial);
      const before = mutations;
      await checkbox.click();
      await page.waitForFunction(() => !document.querySelector('.operation-status'));
      assert.equal(mutations, before + 1);
      assert.equal(await checkbox.isChecked(), initial, `Failed update must preserve ${name}`);
    }
    await rejectedToggle('Upcoming', false);
    await rejectedToggle('Overdue', false);
    await page.evaluate(() =>
      document
        .querySelector('#__nuxt')
        .__vue_app__.config.globalProperties.$router.push('/projects/1'),
    );
    await page.getByRole('checkbox', { name: 'Already done 완료', exact: true }).waitFor();
    await rejectedToggle('Upcoming', false);
    await rejectedToggle('Already done', true);
    rejectChange = false;
    const checkbox = page.getByRole('checkbox', { name: 'Upcoming 완료', exact: true });
    await checkbox.click();
    await page.waitForFunction(() => !document.querySelector('.operation-status'));
    assert.equal(await checkbox.isChecked(), true, 'Successful update must check the task');
    await checkbox.click();
    await page.waitForFunction(() => !document.querySelector('.operation-status'));
    assert.equal(await checkbox.isChecked(), false, 'Successful undo must uncheck the task');
    assert.deepEqual(errors, []);
    console.log(
      'PASS: rejected task completion/undo preserves checkboxes on Home and project detail; successful changes match server state. All APIs mocked.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
