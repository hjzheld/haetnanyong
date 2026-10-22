// All API calls are mocked. This check never sends Slack messages or writes to Neon.
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
if (!packagePath) throw new Error('Playwright is required for browser checks');
const { chromium } = createRequire(packagePath)('playwright');
const base = process.env.CHECK_BASE_URL || 'http://127.0.0.1:4318';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const yesterday = new Date(Date.parse(today + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
const tomorrow = new Date(Date.parse(today + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
const user = { id: '1', email: 'qa@example.test', nickname: '검증냥' };
const projects = [
  { id: '1', name: '검증 프로젝트', color: '#8E8AA3', archivedAt: null },
  { id: '2', name: '보관 프로젝트', color: '#123456', archivedAt: yesterday },
];
const tasks = [
  {
    id: '1',
    projectId: '1',
    title: '지연 검증 작업',
    startDate: yesterday,
    dueDate: yesterday,
    priority: 'HIGH',
    status: 'TODO',
    color: '#8E8AA3',
    description: null,
  },
  {
    id: '2',
    projectId: null,
    title: '다가오는 검증 작업',
    startDate: today,
    dueDate: tomorrow,
    priority: 'MEDIUM',
    status: 'TODO',
    color: '#C98B8B',
    description: null,
  },
  {
    id: '3',
    projectId: null,
    title: '낮은 우선순위 작업',
    startDate: today,
    dueDate: today,
    priority: 'LOW',
    status: 'TODO',
    color: '#C98B8B',
    description: null,
  },
];
const events = [
  {
    id: '11',
    projectId: '1',
    title: '보이는 약속',
    allDay: false,
    startsAt: today + 'T14:00:00+09:00',
    endsAt: today + 'T15:00:00+09:00',
    startDate: null,
    endDate: null,
    color: '#8E8AA3',
    description: null,
  },
  {
    id: '12',
    projectId: null,
    title: '개인 약속',
    allDay: true,
    startDate: today,
    endDate: tomorrow,
    startsAt: null,
    endsAt: null,
    color: '#C496A1',
    description: null,
  },
  {
    id: '13',
    projectId: '2',
    title: '보관된 약속',
    allDay: true,
    startDate: today,
    endDate: tomorrow,
    startsAt: null,
    endsAt: null,
    color: '#123456',
    description: null,
  },
];
const screenshots = fs.mkdtempSync(path.join(os.tmpdir(), 'nyang-ui-'));
async function checkAnchor(page, trigger, label) {
  await trigger.click();
  const menu = page.getByRole('listbox', { name: label });
  await menu.waitFor({ state: 'visible' });
  const a = await trigger.boundingBox(),
    b = await menu.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(
    b.x >= 0 && b.x + b.width <= viewport.width + 1,
    'Dropdown stays inside viewport horizontally',
  );
  assert.ok(
    b.y >= 0 && b.y + b.height <= viewport.height + 1,
    'Dropdown stays inside viewport vertically',
  );
  assert.ok(
    Math.abs(b.x - a.x) <= Math.max(1, b.width - a.width),
    'Dropdown remains aligned with its trigger',
  );
  const gap = Math.min(Math.abs(b.y - a.y - a.height), Math.abs(a.y - b.y - b.height));
  assert.ok(gap <= 12, `Dropdown must open next to its trigger, not elsewhere (gap ${gap})`);
  await page.screenshot({ path: path.join(screenshots, `dropdown-${viewport.width}.png`) });
  return menu;
}
async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ body: '', contentType: 'text/css' }),
    );
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      let data;
      if (['/api/auth/me', '/api/auth/login'].includes(url.pathname)) data = { user };
      else if (url.pathname === '/api/workspace') data = { projects, tasks, events, reminders: [] };
      else if (url.pathname === '/api/items')
        data = {
          tasks: tasks.filter((t) => t.projectId === null),
          events: events.filter((e) => e.projectId === null),
        };
      else if (url.pathname === '/api/reminders') data = [];
      else if (/^\/api\/tasks\/\d+$/.test(url.pathname))
        data = tasks.find((t) => t.id === url.pathname.split('/').pop());
      else if (/^\/api\/events\/\d+$/.test(url.pathname))
        data = events.find((e) => e.id === url.pathname.split('/').pop());
      else if (url.pathname === '/api/account/slack')
        data = {
          configured: true,
          oauthConfigured: true,
          connected: true,
          workspaceId: 'T1',
          memberId: 'U1',
          connectedAt: today,
        };
      else if (url.pathname === '/api/account/slack/health') data = { ok: true };
      else throw new Error('Unexpected API: ' + url.pathname);
      return route.fulfill({ json: data });
    });
    await page.goto(base + '/login');
    await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
    await page.locator('input[type=email]').fill(user.email);
    await page.locator('input[type=password]').fill('qa-password');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.locator('.overdue-panel').waitFor();
    assert.equal(await page.locator('.overdue-panel .list-row').count(), 1);
    assert.equal(
      await page.locator('.columns .panel').first().getByText('지연 검증 작업').count(),
      0,
    );
    assert.equal(
      await page.getByRole('button', { name: '+ 프로젝트 만들기', exact: true }).count(),
      0,
    );
    const navigate = async (url) => {
      await page.evaluate(
        (url) =>
          document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push(url),
        url,
      );
      await page.waitForURL(base + url);
    };
    const noOverflow = async () =>
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
        'No page-wide horizontal overflow',
      );
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width < 600 ? 740 : 1000 });
      await navigate('/calendar');
      await page.locator('.calendar-item').first().waitFor();
      assert.equal(
        await page.locator('.calendar-item').count(),
        3,
        'Active, standalone and archived-project events appear',
      );
      assert.equal(await page.locator('.calendar-item', { hasText: '작업' }).count(), 0);
      const filter = page.getByRole('combobox', { name: '프로젝트 필터' });
      const menu = await checkAnchor(page, filter, '프로젝트 필터');
      await menu.getByRole('option', { name: '프로젝트 없음', exact: true }).click();
      assert.equal(await page.locator('.calendar-item').count(), 1);
      await filter.focus();
      await filter.press('ArrowUp');
      await filter.press('Home');
      await filter.press('Enter');
      assert.equal(await filter.textContent().then((t) => t.trim()), '전체 프로젝트');
      await noOverflow();
      await navigate('/projects/1');
      const add = page.getByRole('button', { name: '+ 할 일 추가', exact: true });
      await add.waitFor();
      await add.click();
      const dialog = page.locator('dialog[open]');
      const color = dialog.locator('.color-field');
      assert.ok((await color.textContent()).includes('색상'));
      assert.ok((await color.textContent()).includes('프로젝트 색상을 따라가요.'));
      assert.equal(await color.locator('input[type=color]').isDisabled(), true);
      const priority = dialog.getByRole('combobox', { name: '우선순위', exact: true });
      const choices = await checkAnchor(page, priority, '우선순위');
      await choices.getByRole('option', { name: '높음', exact: true }).click();
      assert.equal(await priority.textContent().then((t) => t.trim()), '높음');
      await priority.press('ArrowDown');
      await priority.press('Escape');
      assert.equal(await dialog.isVisible(), true, 'Escape closes dropdown without closing dialog');
      assert.equal(await priority.getAttribute('aria-expanded'), 'false');
      await dialog.getByRole('button', { name: '취소', exact: true }).click();
      const discard = page.locator('.confirm-dialog[open]');
      await discard.getByRole('button', { name: '나가기', exact: true }).click();
      await page.getByRole('button', { name: '일정 1', exact: true }).click();
      await page.getByRole('button', { name: '+ 일정 추가', exact: true }).click();
      const eventDialog = page.locator('dialog[open]');
      assert.ok((await eventDialog.locator('.color-field').textContent()).includes('색상'));
      assert.ok(
        (await eventDialog.locator('.color-field').textContent()).includes(
          '프로젝트 색상을 따라가요.',
        ),
      );
      const eventKind = eventDialog.getByRole('combobox', { name: '일정 종류' });
      const eventChoices = await checkAnchor(page, eventKind, '일정 종류');
      await eventChoices.getByRole('option', { name: '종일 일정', exact: true }).click();
      assert.equal(
        await eventDialog.locator('input[type=date]').count(),
        2,
        'Boolean select values remain boolean',
      );
      await eventDialog.getByRole('button', { name: '취소', exact: true }).click();
      await page
        .locator('.confirm-dialog[open]')
        .getByRole('button', { name: '나가기', exact: true })
        .click();
      await navigate('/mypage');
      await page.locator('.slack-actions').waitFor();
      for (const selector of ['.account-actions', '.slack-actions']) {
        const sizes = await page
          .locator(selector)
          .locator('button, a')
          .evaluateAll((els) =>
            els.map((e) => ({
              width: e.getBoundingClientRect().width,
              height: e.getBoundingClientRect().height,
            })),
          );
        assert.ok(sizes.length >= 3);
        const container = await page.locator(selector).boundingBox();
        assert.equal(
          await page.locator(selector).evaluate((el) => getComputedStyle(el).display),
          width <= 600 ? 'grid' : 'flex',
        );
        assert.ok(
          sizes.every(
            (s) =>
              Math.abs(s.height - 48) < 0.5 &&
              (width <= 600
                ? Math.abs(s.width - sizes[0].width) < 1
                : s.width < container.width - 1),
          ),
          'Account buttons use desktop content widths and mobile full widths: ' +
            JSON.stringify({ width, selector, sizes }),
        );
      }
      await noOverflow();
      await navigate('/items/tasks/2');
      await page.locator('.item-detail').waitFor();
      assert.equal(
        await page.locator('.item-detail').evaluate((el) => getComputedStyle(el).borderLeftWidth),
        '1px',
        'No decorative colored edge',
      );
      await noOverflow();
      assert.equal(await page.getByText('태스크', { exact: true }).count(), 0);
    }
    await navigate('/');
    await page.locator('.overdue-panel').waitFor();
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
      const colors = await page.locator('.priority-badge').evaluateAll((els) =>
        els.map((e) => ({
          bg: getComputedStyle(e).backgroundColor,
          fg: getComputedStyle(e).color,
        })),
      );
      assert.ok(
        new Set(colors.map((c) => c.bg)).size === 3,
        'All three priority backgrounds differ',
      );
      assert.ok(
        new Set(colors.map((c) => c.fg)).size === 3,
        'All three priority text colors differ',
      );
      const luminance = (color) => {
        const rgb = color
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((n) => n / 255)
          .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      for (const color of colors) {
        const values = [luminance(color.bg), luminance(color.fg)].sort((a, b) => a - b);
        assert.ok(
          (values[1] + 0.05) / (values[0] + 0.05) >= 4.5,
          'Priority text contrast meets 4.5:1 in ' + theme,
        );
      }
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS: events-only calendar, overdue separation, dropdown anchor/selection/keyboard/modal focus, project color labels, desktop inline/mobile full-width account buttons, overflow and priority colors. API mocked.',
    );
    console.log('Screenshots: ' + screenshots);
  } catch (error) {
    console.error('Browser diagnostics', {
      url: page?.url(),
      errors,
      text: await page
        ?.locator('main')
        .innerText()
        .catch(() => ''),
    });
    await page?.screenshot({ path: path.join(screenshots, 'failure.png') });
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
