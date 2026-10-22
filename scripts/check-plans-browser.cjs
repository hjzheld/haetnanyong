// Mocked API only: no real accounts, database writes or Slack messages.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
const cache = path.join(process.env.LOCALAPPDATA, 'npm-cache/_npx');
const packagePath = fs
  .readdirSync(cache)
  .map((p) => path.join(cache, p, 'node_modules/playwright/package.json'))
  .find((p) => fs.existsSync(p));
const { chromium } = createRequire(packagePath)('playwright');
const base = process.env.CHECK_BASE_URL || 'http://127.0.0.1:4318';
const user = { id: '1', email: 'plans@example.test', nickname: '플랜냥' };
const projects = [
  { id: '1', name: '진행 프로젝트', color: '#919D85', archivedAt: null },
  { id: '2', name: '보관 프로젝트', color: '#C496A1', archivedAt: '2026-10-01' },
];
const tasks = [],
  events = [],
  calls = [],
  errors = [];
let failNextTask = false;
let rejectNextArchive = false;
const screenshots = fs.mkdtempSync(path.join(os.tmpdir(), 'nyang-plans-'));
async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ body: '', contentType: 'text/css' }),
    );
    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const method = route.request().method();
      const body = ['POST', 'PATCH'].includes(method) ? route.request().postDataJSON() : null;
      calls.push({ pathname, method, body });
      let data;
      if (pathname.startsWith('/api/auth/')) data = { user };
      else if (pathname === '/api/workspace') data = { projects, tasks, events, reminders: [] };
      else if (pathname === '/api/items')
        data = {
          tasks: tasks.filter((t) => !t.projectId),
          events: events.filter((e) => !e.projectId),
        };
      else if (pathname === '/api/projects') {
        if (method === 'POST') {
          data = { ...body, id: String(projects.length + 1), archivedAt: null };
          projects.push(data);
        } else data = projects;
      } else if (/^\/api\/projects\/\d+$/.test(pathname) && method === 'PATCH') {
        if (body.onlyIfComplete && rejectNextArchive) {
          rejectNextArchive = false;
          return route.fulfill({
            status: 409,
            json: {
              statusCode: 409,
              statusMessage:
                '프로젝트 상태가 변경되었어요. 모든 일정과 할 일의 완료 여부를 다시 확인해주세요.',
            },
          });
        }
        data = projects.find((project) => project.id === pathname.split('/').pop());
        assert.ok(data);
        data.archivedAt = body.archived ? new Date().toISOString() : null;
      } else if (pathname === '/api/tasks' && method === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 150));
        if (failNextTask) {
          failNextTask = false;
          return route.fulfill({
            status: 503,
            json: { statusCode: 503, message: 'Temporary test failure' },
          });
        }
        data = { ...body, id: String(tasks.length + 10), status: 'TODO' };
        tasks.push(data);
      } else if (pathname === '/api/events' && method === 'POST') {
        data = { ...body, id: String(events.length + 20) };
        events.push(data);
      } else throw new Error('Unexpected API call: ' + pathname);
      return route.fulfill({ json: data });
    });
    const navigate = async (url) => {
      await page.evaluate(
        (url) =>
          document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push(url),
        url,
      );
    };
    await page.goto(base + '/login');
    await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
    await page.locator('input[type=email]').fill(user.email);
    await page.locator('input[type=password]').fill('qa-password');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.locator('.metric-row').waitFor();
    await navigate('/plans');
    await page.getByRole('heading', { name: '플랜', exact: true }).waitFor();
    assert.equal(await page.locator('#primary-navigation a').count(), 5);
    assert.equal(
      await page
        .locator('#primary-navigation')
        .getByRole('link', { name: '프로젝트', exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .locator('#primary-navigation')
        .getByRole('link', { name: '일정·할 일', exact: true })
        .count(),
      0,
    );
    await page.getByRole('button', { name: '보관함', exact: true }).click();
    await page.getByRole('heading', { name: '보관 프로젝트', exact: true }).waitFor();
    await page.locator('.plan-tabs').getByRole('button', { name: '개별', exact: true }).click();
    await page.getByRole('button', { name: '일정 0', exact: true }).waitFor();
    await page.locator('.plan-tabs').getByRole('button', { name: '프로젝트', exact: true }).click();
    await page.getByRole('heading', { name: '보관 프로젝트', exact: true }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: '보관함', exact: true }).getAttribute('aria-pressed'),
      'true',
    );
    await page.getByRole('button', { name: '진행 중', exact: true }).click();
    await page.getByRole('button', { name: '도움말', exact: true }).click();
    await page.getByRole('dialog', { name: '플랜 도움말' }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.plan-help-dialog').isVisible(), false);
    assert.equal(
      await page
        .getByRole('button', { name: '도움말', exact: true })
        .evaluate((e) => e === document.activeElement),
      true,
    );
    const form = page.locator('.plan-create-dialog');
    const open = async () => {
      await page.getByRole('button', { name: '+ 플랜 등록', exact: true }).click();
      await form.getByPlaceholder('예: 발표 자료 준비하기').waitFor();
      assert.equal(await page.locator('.plan-choices').count(), 0);
      assert.ok(
        (await form.getByRole('combobox', { name: '프로젝트 (선택)' }).textContent()).includes(
          '프로젝트 없이 진행',
        ),
      );
    };
    const chooseProject = async (name) => {
      await form.getByRole('combobox', { name: '프로젝트 (선택)' }).click();
      assert.equal(await page.getByRole('option', { name: '보관 프로젝트' }).count(), 0);
      await page.getByRole('option', { name, exact: true }).click();
    };
    await open();
    await form
      .locator('.plan-kind-tabs')
      .getByRole('button', { name: '일정', exact: true })
      .click();
    await form.getByPlaceholder('예: 팀 회의').fill('프로젝트에 추가한 약속');
    await chooseProject('진행 프로젝트');
    assert.equal(
      await form.getByPlaceholder('예: 팀 회의').inputValue(),
      '프로젝트에 추가한 약속',
      'Choosing a project preserves the typed title',
    );
    await form.getByRole('button', { name: '일정 추가하기', exact: true }).click();
    await page.waitForURL(base + '/projects/1?tab=events');
    await page.getByText('프로젝트에 추가한 약속', { exact: true }).waitFor();
    const createdEvent = calls.find((c) => c.pathname === '/api/events' && c.method === 'POST');
    assert.equal(createdEvent.body.projectId, '1');
    assert.equal(createdEvent.body.allDay, false);
    assert.ok(createdEvent.body.startsAt.endsWith('+09:00'));

    await navigate('/plans?tab=individual');
    await open();
    await form.getByPlaceholder('예: 발표 자료 준비하기').fill('개별로 추가한 작업');
    await form.getByRole('button', { name: '할 일 추가하기', exact: true }).dblclick();
    await page.waitForURL(base + '/plans?tab=individual&kind=tasks');
    await page.getByText('개별로 추가한 작업', { exact: true }).waitFor();
    const createdTasks = calls.filter((c) => c.pathname === '/api/tasks' && c.method === 'POST');
    assert.equal(createdTasks.length, 1);
    assert.equal(createdTasks[0].body.projectId, null);

    await open();
    await form.getByPlaceholder('예: 발표 자료 준비하기').fill('저장하지 않은 내용');
    await form.getByRole('button', { name: '취소', exact: true }).click();
    await page
      .locator('.confirm-dialog[open]')
      .getByRole('button', { name: '나가기', exact: true })
      .click();
    await form.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.confirm-dialog[open]').count(), 0);

    await open();
    await form.getByPlaceholder('예: 발표 자료 준비하기').fill('새 프로젝트의 첫 작업');
    await chooseProject('새 프로젝트 등록하기');
    await form
      .getByRole('textbox', { name: '새 프로젝트 이름', exact: true })
      .fill('새로 만든 프로젝트');
    await form.getByLabel('프로젝트 색상', { exact: true }).fill('#C496A1');
    await form.getByRole('button', { name: '할 일 추가하기', exact: true }).click();
    await page.waitForURL(base + '/projects/3?tab=tasks');
    await page.getByRole('heading', { name: '새로 만든 프로젝트', exact: true }).waitFor();
    const projectPost = calls.find((c) => c.pathname === '/api/projects' && c.method === 'POST');
    assert.equal(projectPost.body.color.toUpperCase(), '#C496A1');
    const firstTask = calls.find(
      (c) => c.pathname === '/api/tasks' && c.body?.title === '새 프로젝트의 첫 작업',
    );
    assert.equal(firstTask.body.projectId, '3');
    assert.equal(
      await page
        .locator('.list-row')
        .filter({ hasText: '새 프로젝트의 첫 작업' })
        .locator('.badge')
        .count(),
      0,
      'No duplicate TODO badge beside priority',
    );

    await navigate('/plans');
    await open();
    await form.getByPlaceholder('예: 발표 자료 준비하기').fill('재시도할 작업');
    await chooseProject('새 프로젝트 등록하기');
    await form
      .getByRole('textbox', { name: '새 프로젝트 이름', exact: true })
      .fill('재시도 프로젝트');
    failNextTask = true;
    await form.getByRole('button', { name: '할 일 추가하기', exact: true }).click();
    await form.locator('.form-error').waitFor();
    const projectCount = calls.filter(
      (c) => c.pathname === '/api/projects' && c.method === 'POST',
    ).length;
    assert.ok(
      (await form.getByRole('combobox', { name: '프로젝트 (선택)' }).textContent()).includes(
        '재시도 프로젝트',
      ),
    );
    await form.getByRole('button', { name: '할 일 추가하기', exact: true }).click();
    await page.waitForURL(base + '/projects/4?tab=tasks');
    assert.equal(
      calls.filter((c) => c.pathname === '/api/projects' && c.method === 'POST').length,
      projectCount,
      'Retry reuses an already-created project',
    );

    await navigate('/items');
    await page.waitForURL(/\/plans\?.*tab=individual/);
    await navigate('/projects');
    await page.waitForURL(/\/plans\?.*tab=projects/);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width < 600 ? 740 : 1000 });
      await open();
      await chooseProject('새 프로젝트 등록하기');
      await form.getByRole('textbox', { name: '새 프로젝트 이름', exact: true }).fill('화면 검증');
      await page.screenshot({ path: path.join(screenshots, `plans-${width}.png`) });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      await form.getByRole('button', { name: '취소', exact: true }).click();
      await page
        .locator('.confirm-dialog[open]')
        .getByRole('button', { name: '나가기', exact: true })
        .click();
      await form.waitFor({ state: 'hidden' });
    }
    // Route-query changes must update a still-mounted projects list.
    await navigate('/plans?tab=projects&archived=1');
    await page.getByRole('heading', { name: '보관 프로젝트', exact: true }).waitFor();
    await navigate('/plans?tab=projects');
    await page.getByRole('heading', { name: '진행 프로젝트', exact: true }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: '진행 중', exact: true }).getAttribute('aria-pressed'),
      'true',
    );

    projects.push({ id: '99', name: '완료 프로젝트', color: '#919D85', archivedAt: null });
    tasks.push({
      id: '999',
      projectId: '99',
      title: '완료 작업',
      status: 'DONE',
      startDate: '2026-01-01',
      dueDate: '2026-01-01',
      priority: 'MEDIUM',
    });
    events.push({
      id: '999',
      projectId: '99',
      title: '종료 일정',
      allDay: true,
      startDate: '2026-01-01',
      endDate: '2026-01-02',
    });
    await navigate('/projects/99');
    const archivePrompt = page.getByRole('dialog', { name: '프로젝트를 보관할까요?' });
    await archivePrompt.waitFor();
    rejectNextArchive = true;
    await archivePrompt.getByRole('button', { name: '예, 보관하기', exact: true }).click();
    await archivePrompt.getByRole('alert').waitFor();
    assert.ok(
      (await archivePrompt.getByRole('alert').textContent()).includes('프로젝트 상태가 변경'),
    );
    assert.ok(page.url().endsWith('/projects/99'));
    await archivePrompt.getByRole('button', { name: '예, 보관하기', exact: true }).click();
    await page.waitForURL(base + '/plans?tab=projects&archived=1');
    await page.getByRole('heading', { name: '완료 프로젝트', exact: true }).waitFor();
    assert.ok(
      calls.some(
        (call) => call.pathname === '/api/projects/99' && call.body?.onlyIfComplete === true,
      ),
    );
    await navigate('/projects/99');
    await page.getByRole('button', { name: '복원하기', exact: true }).click();
    await page.getByRole('button', { name: '보관하기', exact: true }).waitFor();
    assert.equal(
      await archivePrompt.isVisible(),
      false,
      'Restoring must not immediately suggest archiving again',
    );
    await navigate('/plans');
    await navigate('/projects/99');
    await archivePrompt.waitFor();
    await archivePrompt.getByRole('button', { name: '취소', exact: true }).click();
    await page.getByRole('button', { name: '일정 1', exact: true }).click();
    assert.equal(
      await archivePrompt.isVisible(),
      false,
      'Dismissal persists during the current visit',
    );
    await navigate('/calendar');
    await page.getByRole('link', { name: '일정 등록 페이지로 이동 →', exact: true }).click();
    await page.waitForURL(base + '/plans?tab=individual&kind=events');
    await page.getByRole('button', { name: /^일정 \d+$/ }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      'PASS: direct plan form, project dropdown, title preservation, inline project creation/color, retry without duplicate project, hidden TODO badge, standalone/existing-project payloads, archive tabs and mobile layout. API mocked.',
    );
    console.log('Screenshots: ' + screenshots);
  } catch (error) {
    console.error({ url: page.url(), errors });
    await page.screenshot({ path: path.join(screenshots, 'failure.png') });
    console.error('Screenshot: ' + path.join(screenshots, 'failure.png'));
    throw error;
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
