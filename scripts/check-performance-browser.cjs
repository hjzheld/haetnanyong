// All browser API calls are intercepted. No real account/DB writes or Slack calls.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const cache = path.join(process.env.LOCALAPPDATA, 'npm-cache/_npx');
const packagePath = fs
  .readdirSync(cache)
  .map((entry) => path.join(cache, entry, 'node_modules/playwright/package.json'))
  .find((candidate) => fs.existsSync(candidate));
if (!packagePath) throw new Error('Playwright is required for browser checks');
const { chromium } = createRequire(packagePath)('playwright');
const base = process.env.CHECK_BASE_URL || 'http://127.0.0.1:4318';
const user = { id: '1', email: 'qa@example.test', nickname: '테스트냥' };
const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })
  .format(new Date())
  .slice(0, 7);
const projects = [
  { id: '1', name: '공개 프로젝트', color: '#8E8AA3', archivedAt: null },
  { id: '2', name: '보관 프로젝트', color: '#123456', archivedAt: `${month}-01` },
];
const tasks = [
  {
    id: '1',
    projectId: null,
    title: '테스트 마감',
    color: '#C98B8B',
    startDate: `${month}-01`,
    dueDate: `${month}-21`,
    priority: 'MEDIUM',
    status: 'TODO',
    description: null,
  },
];
const events = [
  {
    id: '2',
    projectId: '1',
    title: '프로젝트 약속',
    color: '#8E8AA3',
    allDay: true,
    startDate: `${month}-11`,
    endDate: `${month}-13`,
    startsAt: null,
    endsAt: null,
  },
  {
    id: '3',
    projectId: null,
    title: '개인 약속',
    color: '#8E8AA3',
    allDay: false,
    startsAt: `${month}-21T00:00:00Z`,
    endsAt: `${month}-21T01:00:00Z`,
    startDate: null,
    endDate: null,
  },
  {
    id: '4',
    projectId: '2',
    title: '보관 약속',
    color: '#8E8AA3',
    allDay: true,
    startDate: `${month}-11`,
    endDate: `${month}-12`,
  },
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [],
      calls = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      calls.push({ path: url.pathname, method, eventId: url.searchParams.get('eventId') });
      let data;
      if (url.pathname === '/api/auth/login' || url.pathname === '/api/auth/me') data = { user };
      else if (url.pathname === '/api/workspace') {
        await new Promise((resolve) => setTimeout(resolve, 250));
        data = { projects, tasks, events, reminders: [] };
      } else if (url.pathname === '/api/items')
        data = { tasks, events: events.filter((event) => event.projectId === null) };
      else if (url.pathname === '/api/tasks/1') {
        if (method === 'DELETE') {
          tasks.splice(0, tasks.length);
          return route.fulfill({ json: { ok: true } });
        }
        if (method === 'PATCH') tasks[0].status = route.request().postDataJSON().status;
        data = tasks[0];
      } else if (url.pathname === '/api/events/3') data = events[1];
      else if (url.pathname === '/api/reminders') data = [];
      else if (url.pathname === '/api/account/slack') {
        await new Promise((resolve) => setTimeout(resolve, 800));
        data = { configured: true, connected: false };
      } else if (url.pathname === '/api/auth/logout') data = { ok: true };
      else {
        errors.push(`Unexpected API request: ${method} ${url.pathname}`);
        return route.fulfill({ status: 500, json: {} });
      }
      return route.fulfill({ json: data });
    });
    const count = (pathname) => calls.filter((call) => call.path === pathname).length;
    const navigate = async (url) => {
      await page.evaluate(
        (url) =>
          document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push(url),
        url,
      );
      await page.waitForURL(base + url);
    };
    await page.goto(base + '/login');
    await page.locator('input[type=email]').fill(user.email);
    await page.locator('input[type=password]').fill('test-password');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.locator('.metric-row').waitFor();
    assert.equal(
      count('/api/auth/me'),
      0,
      'Login result must not immediately trigger another session query',
    );
    assert.equal(count('/api/account/slack'), 0, 'Home must not request Slack');

    await navigate('/calendar');
    await page
      .getByRole('status')
      .filter({ hasText: /^불러오는 중…$/ })
      .waitFor();
    assert.equal(
      await page.locator('.calendar').count(),
      0,
      'Loading must hide cached calendar content',
    );
    await page.locator('.calendar').waitFor();
    assert.equal(await page.locator('.calendar-item').count(), 4);
    assert.equal(await page.locator('.calendar-item', { hasText: '보관 약속' }).count(), 0);
    assert.equal(count('/api/account/slack'), 0, 'Calendar must not request Slack');
    await page.locator('.calendar-filter-trigger').click();
    await page.getByRole('option', { name: '프로젝트 없음' }).click();
    assert.equal(await page.locator('.calendar-item').count(), 2);
    await page.getByRole('button', { name: '이전 달' }).click();
    assert.equal(
      await page.locator('.calendar-item').count(),
      0,
      'Changing month must not show previous-month items',
    );

    await navigate('/items/tasks/1');
    await page.getByRole('button', { name: '완료하기', exact: true }).waitFor();
    assert.equal(count('/api/reminders'), 0, 'Task detail must not request reminders');
    assert.equal(count('/api/account/slack'), 0, 'Task detail must not request Slack');
    const taskReads = calls.filter(
      (call) => call.path === '/api/tasks/1' && call.method === 'GET',
    ).length;
    const workspaceReads = count('/api/workspace');
    await page.getByRole('button', { name: '완료하기', exact: true }).click();
    await page.getByRole('button', { name: '완료 취소', exact: true }).waitFor();
    assert.equal(
      calls.filter((call) => call.path === '/api/tasks/1' && call.method === 'GET').length,
      taskReads + 1,
      'Task update refreshes its detail once',
    );
    assert.equal(
      count('/api/workspace'),
      workspaceReads,
      'Task update must not refresh offscreen workspace',
    );

    const beforeDelete = calls.filter(
      (call) => call.path === '/api/tasks/1' && call.method === 'GET',
    ).length;
    await page.getByRole('button', { name: '삭제', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '계속하기', exact: true }).click();
    await page.waitForURL(base + '/items');
    await page.getByRole('button', { name: '태스크 0', exact: true }).waitFor();
    assert.equal(
      calls.filter((call) => call.path === '/api/tasks/1' && call.method === 'GET').length,
      beforeDelete,
      'Deleting an item must not fetch the deleted detail',
    );

    await navigate('/items/events/3');
    await page.getByRole('button', { name: 'Slack 알림 설정', exact: true }).waitFor();
    assert.ok(calls.some((call) => call.path === '/api/reminders' && call.eventId === '3'));
    assert.equal(count('/api/account/slack'), 0, 'Event detail defers Slack until the action');
    await page.getByRole('button', { name: 'Slack 알림 설정', exact: true }).click();
    await page.waitForURL(base + '/mypage#slack');
    assert.ok(count('/api/account/slack') >= 1, 'Reminder action checks Slack before redirecting');

    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await navigate('/items');
      await page.getByRole('button', { name: '일정 1', exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS: mocked login, no eager Slack calls, exclusive loading, calendar/project/date filters, scoped reminders, single detail refresh, deletion navigation and desktop/mobile layout.',
    );
    console.log(
      JSON.stringify({
        apiCalls: calls.length,
        taskDetailReads: calls.filter(
          (call) => call.path === '/api/tasks/1' && call.method === 'GET',
        ).length,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
