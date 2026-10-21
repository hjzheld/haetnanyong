// Mocked APIs only: no database writes or real Slack calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
const cache = path.join(process.env.LOCALAPPDATA, 'npm-cache/_npx');
const pkg = fs
  .readdirSync(cache)
  .map((p) => path.join(cache, p, 'node_modules/playwright/package.json'))
  .find((p) => fs.existsSync(p));
const { chromium } = createRequire(pkg)('playwright');
const base = process.env.CHECK_BASE_URL || 'http://127.0.0.1:4318';
const user = { id: '1', email: 'help@example.test', nickname: '검증냥' };
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const event = {
  id: '11',
  projectId: null,
  title: '일정 검증',
  description: '',
  allDay: false,
  startsAt: day + 'T14:00:00+09:00',
  endsAt: day + 'T15:00:00+09:00',
  color: '#C496A1',
};
const project = {
  id: '7',
  name: '여행 준비 프로젝트',
  description: null,
  color: '#919D85',
  archivedAt: null,
};
const projectEvent = { ...event, id: '12', projectId: project.id, title: '프로젝트 일정' };
const reminders = ['SCHEDULED', 'UNKNOWN', 'FAILED', 'ELAPSED', 'CANCEL_PENDING'].map(
  (status, i) => ({
    id: String(i + 1),
    eventId: i % 2 ? '12' : '11',
    status,
    remindAt: day + 'T13:00:00+09:00',
    offsetMinutes: 60,
    errorMessage: status === 'FAILED' ? 'channel_not_found' : null,
  }),
);
async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  try {
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', (r) =>
      r.fulfill({ body: '', contentType: 'text/css' }),
    );
    await page.route('**/api/**', async (r) => {
      const p = new URL(r.request().url()).pathname;
      let data;
      if (p.startsWith('/api/auth/')) data = { user };
      else if (p === '/api/workspace')
        data = { projects: [project], tasks: [], events: [event, projectEvent], reminders };
      else if (p === '/api/items') data = { tasks: [], events: [event] };
      else if (p === '/api/reminders') data = reminders;
      else if (p.startsWith('/api/events')) data = event;
      else if (p.startsWith('/api/account/slack'))
        data = { connected: true, configured: true, oauthConfigured: true };
      else throw new Error('Unexpected API: ' + p);
      await r.fulfill({ json: data });
    });
    await page.goto(base + '/login');
    await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
    await page.locator('input[type=email]').fill(user.email);
    await page.locator('input[type=password]').fill('qa-password');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.waitForURL(base + '/');
    const navigate = async (url) => {
      await page.waitForFunction(
        () =>
          document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.currentRoute
            .value.fullPath ===
          location.pathname + location.search,
      );
      await page.evaluate(
        (url) =>
          document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push(url),
        url,
      );
      await page.waitForURL(base + url);
    };
    const back = () => page.getByRole('button', { name: '← 뒤로가기', exact: true }).click();
    await navigate('/calendar');
    await navigate('/items/events/new');
    await back();
    await page.waitForURL(base + '/calendar');
    await navigate('/items/events/new');
    await page.locator('input').first().fill('저장하지 않은 입력');
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await page.locator('.confirm-dialog[open]').waitFor();
    await page.getByRole('button', { name: '나가기', exact: true }).click();
    await page.waitForURL(base + '/calendar');
    await navigate('/items/events/11');
    await back();
    await page.waitForURL(base + '/calendar');
    await navigate('/items/events/11');
    await navigate('/items/events/11/edit');
    await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
    await page.waitForURL(base + '/items/events/11');
    await back();
    await page.waitForURL(base + '/calendar');
    await navigate('/plans?tab=individual');
    await navigate('/items/events/11');
    await back();
    await page.waitForURL(base + '/plans?tab=individual');
    await navigate('/calendar');
    await navigate('/items/events/new');
    await page.locator('input').first().fill('저장 후 뒤로가기 검증');
    await page.getByRole('button', { name: '일정 추가하기', exact: true }).click();
    await page.waitForURL(base + '/items/events/11');
    await back();
    await page.waitForURL(base + '/calendar');
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const url of [
        '/',
        '/plans',
        '/calendar',
        '/reminders',
        '/mypage',
        '/items/events/new',
        '/items/events/11',
        '/privacy',
        '/terms',
        '/slack/callback?result=failed',
      ]) {
        await navigate(url);
        const trigger = page.getByRole('button', { name: /도움말/ });
        assert.equal(await trigger.count(), 1, url + ' has one help button');
        await trigger.click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        const rect = await dialog.boundingBox();
        assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1, 'Help fits viewport');
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.ok(
          await trigger.evaluate((el) => el === document.activeElement),
          'Help restores focus',
        );
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          url + ' has no horizontal page overflow',
        );
      }
      await navigate('/reminders');
      await page.locator('.reminder-management').first().waitFor();
      assert.equal(await page.locator('.reminder-management').count(), 5);
      assert.equal(
        await page.locator('.reminder-project-badge').count(),
        2,
        'Only project reminders show a badge',
      );
      assert.equal(await page.locator('.reminder-project-badge').first().innerText(), project.name);
      assert.equal(
        await page.locator('.reminder-project-badge').first().getAttribute('href'),
        '/projects/7?tab=events',
      );
      assert.equal(
        await page
          .locator('.reminders-panel tbody tr')
          .first()
          .locator('.reminder-project')
          .count(),
        0,
        'Standalone reminder has no project label or empty wrapper',
      );
      assert.ok(
        await page
          .locator('.reminder-management')
          .evaluateAll((cells) =>
            cells.every((el) => getComputedStyle(el).display === 'table-cell'),
          ),
        'Management retains table layout',
      );
      assert.ok(
        await page
          .locator('.reminder-actions button')
          .evaluateAll((buttons) =>
            buttons.every(
              (el) =>
                getComputedStyle(el).whiteSpace === 'nowrap' &&
                el.getBoundingClientRect().height >= 44,
            ),
          ),
        'Buttons do not wrap and meet touch target',
      );
      await page.screenshot({
        path: path.join(os.tmpdir(), `nyang-reminders-help-${width}.png`),
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS: history back, saved-event back, per-page help/focus, reminder layout at 1440/768/390/320px',
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
