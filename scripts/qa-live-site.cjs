// Explicit opt-in only. Creates a temporary QA account and deletes only its own records.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
if (process.env.LIVE_QA !== '1') throw new Error('Set LIVE_QA=1 to authorize live QA writes');
const cache = path.join(process.env.LOCALAPPDATA, 'npm-cache/_npx');
const pkg = fs
  .readdirSync(cache)
  .map((p) => path.join(cache, p, 'node_modules/playwright/package.json'))
  .find((p) => fs.existsSync(p));
const { chromium } = createRequire(pkg)('playwright');
const base = 'https://haetnanyong.vercel.app';
const stamp = crypto.randomBytes(6).toString('hex');
const email = `qa-${stamp}@example.test`;
let password = 'Qa!' + crypto.randomBytes(18).toString('base64url');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'nyang-live-qa-'));
const results = [],
  errors = [],
  requests = [];
let browser,
  context,
  page,
  registered = false;
const records = { projects: [], tasks: [], events: [] };
function record(name, pass, details = '') {
  results.push({ name, pass, details });
  console.log(JSON.stringify({ name, pass, details }));
}
async function api(url, method = 'GET', data) {
  const response = await context.request.fetch(base + url, {
    method,
    data,
    headers: { Origin: base },
    timeout: 30000,
  });
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status(), body };
}
async function check(name, fn) {
  try {
    await fn();
  } catch (e) {
    const current = page?.url();
    record(name, false, e.message.split('\n').slice(0, 4).join(' ') + ' URL=' + current);
    if (page)
      await page
        .screenshot({ path: path.join(output, `failure-${results.length}.png`), fullPage: true })
        .catch(() => {});
  }
}
function expect(condition, message) {
  if (!condition) throw Error(message);
}
async function navigate(url) {
  await page.goto(base + url, { waitUntil: 'networkidle', timeout: 45000 });
}
async function run() {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().startsWith(base + '/api/') && r.status() >= 400)
      requests.push({ path: new URL(r.url()).pathname, status: r.status() });
  });
  await check('비로그인 보호 페이지', async () => {
    await navigate('/plans');
    expect(new URL(page.url()).pathname === '/login', '로그인으로 이동하지 않음');
    record('비로그인 보호 페이지', true);
  });
  await check('비인증 API 차단', async () => {
    const r = await api('/api/projects');
    expect(r.status === 401, `HTTP ${r.status}`);
    record('비인증 API 차단', true);
  });
  await check('회원가입 UI·닉네임 자동 생성', async () => {
    await navigate('/login?mode=register');
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(password);
    await page.getByRole('button', { name: /가입하고 시작하기|^회원가입$/ }).click();
    await page.waitForURL(base + '/', { timeout: 30000 });
    const r = await api('/api/auth/me');
    expect(r.body?.user?.email === email, '가입 후 세션 확인 실패');
    registered = true;
    expect(Boolean(r.body.user.nickname), '자동 닉네임 없음');
    record('회원가입 UI·닉네임 자동 생성', true);
  });
  if (!registered) {
    await page.screenshot({ path: path.join(output, 'signup-failed.png'), fullPage: true });
    return;
  }
  if (process.env.LIVE_QA_UI_ONLY === '1') {
    await uiFlows();
    return;
  }
  const date = '2026-10-23',
    endDate = '2026-10-25';
  let project, task, event;
  await check('프로젝트 생성·조회·수정', async () => {
    const r = await api('/api/projects', 'POST', {
      name: 'QA 임시 프로젝트 ' + stamp,
      color: '#919D85',
    });
    expect(r.status < 300 && r.body?.id, `생성 HTTP ${r.status}: ${JSON.stringify(r.body)}`);
    project = r.body;
    records.projects.push(project.id);
    const update = await api('/api/projects/' + project.id, 'PATCH', {
      name: 'QA 수정 ' + stamp,
      color: '#C496A1',
    });
    expect(update.status < 300, `수정 HTTP ${update.status}`);
    const list = await api('/api/projects');
    expect(
      list.status === 200 && list.body.some((p) => String(p.id) === String(project.id)),
      '목록 조회 실패',
    );
    record('프로젝트 생성·조회·수정', true);
  });
  await check('개별 할 일 생성·기간 유지·수정·완료', async () => {
    const r = await api('/api/tasks', 'POST', {
      title: 'QA 개별 할 일 ' + stamp,
      startDate: date,
      dueDate: endDate,
      priority: 'HIGH',
      color: '#C496A1',
    });
    expect(r.status < 300 && r.body?.id, `HTTP ${r.status}: ${JSON.stringify(r.body)}`);
    task = r.body;
    records.tasks.push(task.id);
    expect(
      String(task.startDate).startsWith(date) && String(task.dueDate).startsWith(endDate),
      '입력 기간이 변경됨',
    );
    const u = await api('/api/tasks/' + task.id, 'PATCH', {
      title: 'QA 수정 할 일',
      status: 'DONE',
      priority: 'LOW',
    });
    expect(u.status < 300, `수정 HTTP ${u.status}`);
    record('개별 할 일 생성·기간 유지·수정·완료', true);
  });
  await check('프로젝트 할 일 생성', async () => {
    expect(project, '프로젝트 미생성');
    const r = await api('/api/tasks', 'POST', {
      projectId: project.id,
      title: 'QA 프로젝트 할 일',
      startDate: date,
      dueDate: endDate,
      priority: 'MEDIUM',
    });
    expect(r.status < 300 && r.body?.id, `HTTP ${r.status}`);
    records.tasks.push(r.body.id);
    expect(String(r.body.projectId) === String(project.id), '프로젝트 연결 불일치');
    record('프로젝트 할 일 생성', true);
  });
  await check('시간 일정 생성·수정', async () => {
    const r = await api('/api/events', 'POST', {
      projectId: project?.id,
      title: 'QA 시간 일정 ' + stamp,
      allDay: false,
      startsAt: date + 'T14:00:00+09:00',
      endsAt: date + 'T15:00:00+09:00',
      color: '#8E8AA3',
    });
    expect(r.status < 300 && r.body?.id, `HTTP ${r.status}: ${JSON.stringify(r.body)}`);
    event = r.body;
    records.events.push(event.id);
    const u = await api('/api/events/' + event.id, 'PATCH', {
      title: 'QA 수정 일정',
      color: '#919D85',
    });
    expect(u.status < 300, `수정 HTTP ${u.status}`);
    record('시간 일정 생성·수정', true);
  });
  await check('종일 일정 생성·날짜 유지', async () => {
    const r = await api('/api/events', 'POST', {
      title: 'QA 종일 일정',
      allDay: true,
      startDate: date,
      endDate,
      color: '#C496A1',
    });
    expect(r.status < 300 && r.body?.id, `HTTP ${r.status}`);
    records.events.push(r.body.id);
    expect(String(r.body.startDate).startsWith(date), '등록 날짜가 달라짐');
    record('종일 일정 생성·날짜 유지', true);
  });
  await check('잘못된 입력 검증', async () => {
    for (const [url, body] of [
      ['/api/tasks', { title: 'QA 오류', startDate: endDate, dueDate: date }],
      ['/api/events', { title: 'QA 오류', allDay: true, startDate: endDate, endDate: date }],
      ['/api/projects', { name: 'QA 오류', color: 'blue' }],
    ]) {
      const r = await api(url, 'POST', body);
      expect(r.status === 400, `${url}: HTTP ${r.status}`);
    }
    record('잘못된 입력 검증', true);
  });
  await check('다른 세션의 테스트 데이터 접근 차단', async () => {
    expect(task, '테스트 할 일 없음');
    const guest = await browser.newContext();
    try {
      const r = await guest.request.get(base + '/api/tasks/' + task.id);
      expect(r.status() === 401, `HTTP ${r.status()}`);
    } finally {
      await guest.close();
    }
    record(
      '다른 세션의 테스트 데이터 접근 차단',
      true,
      '비로그인 세션만 검증; 다른 로그인 계정 간 검증은 미실시',
    );
  });
  await check('프로젝트 보관·복원', async () => {
    expect(project, '프로젝트 없음');
    for (const archived of [true, false]) {
      const r = await api('/api/projects/' + project.id, 'PATCH', { archived });
      expect(r.status < 300, `HTTP ${r.status}`);
    }
    record('프로젝트 보관·복원', true);
  });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of [
      '/',
      '/plans',
      '/plans?tab=individual',
      '/calendar',
      '/reminders',
      '/mypage',
      ...(project ? ['/projects/' + project.id] : []),
      ...(event ? ['/items/events/' + event.id] : []),
      ...(task ? ['/items/tasks/' + task.id] : []),
    ]) {
      await check(`화면·도움말 ${width}px ${url}`, async () => {
        await navigate(url);
        expect(new URL(page.url()).pathname !== '/login', '세션이 풀림');
        expect(
          !(await page.getByText('잠시 문제가 생겼어요', { exact: true }).count()),
          '오류 화면',
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          '페이지 가로 넘침',
        );
        const help = page.getByRole('button', { name: /도움말/ });
        expect((await help.count()) === 1, '도움말 버튼 개수 불일치');
        await help.click();
        await page.locator('dialog[open]').waitFor({ timeout: 5000 });
        await page.keyboard.press('Escape');
        await page.screenshot({
          path: path.join(output, `${width}-${url.replace(/[^a-z0-9]/gi, '_') || 'home'}.png`),
          fullPage: true,
        });
        record(`화면·도움말 ${width}px ${url}`, true);
      });
    }
  }
  await check('로그인 후 로그인 페이지 접근 제한', async () => {
    await navigate('/login');
    expect(new URL(page.url()).pathname !== '/login', '로그인 화면으로 진입됨');
    record('로그인 후 로그인 페이지 접근 제한', true);
  });
  await check('없는 페이지 처리', async () => {
    await navigate('/qa-missing-' + stamp);
    expect(
      (await page.getByText('페이지를 찾지 못했어요', { exact: true }).count()) === 1,
      '404 안내 없음',
    );
    record('없는 페이지 처리', true);
  });
  await check('Slack 연결 진입·미연결 예약 차단', async () => {
    const status = await api('/api/account/slack');
    expect(status.status === 200, '연결상태 조회 실패');
    expect(!status.body.connected, '신규 QA 계정이 이미 Slack 연결 상태');
    if (event) {
      const r = await api('/api/reminders', 'POST', {
        eventId: event.id,
        text: 'QA 미연결 차단 검증',
        scheduledAt: date + 'T12:00:00+09:00',
      });
      expect(r.status >= 400 && r.status < 500, `미연결 예약 HTTP ${r.status}`);
    }
    const start = await api('/api/account/slack/start', 'POST', {});
    expect(start.status < 300 && start.body?.url, 'OAuth 진입 실패 HTTP ' + start.status);
    const u = new URL(start.body.url);
    expect(u.origin === 'https://slack.com' && u.searchParams.has('state'), 'OAuth URL 형식 오류');
    expect(
      u.searchParams.get('redirect_uri')?.startsWith(base + '/api/account/slack/callback'),
      '콜백 호스트 불일치',
    );
    record('Slack 연결 진입·미연결 예약 차단', true, '사용자 승인·실제 메시지 발송은 미실시');
  });
  await check('닉네임 변경', async () => {
    const r = await api('/api/account/profile', 'PATCH', { email, nickname: 'QA검증_' + stamp });
    expect(r.status < 300, `HTTP ${r.status}`);
    record('닉네임 변경', true);
  });
  await check('비밀번호 변경·로그아웃·재로그인', async () => {
    const next = 'Qa!' + crypto.randomBytes(18).toString('base64url');
    const r = await api('/api/account/password', 'PATCH', {
      currentPassword: password,
      newPassword: next,
    });
    expect(r.status < 300, `변경 HTTP ${r.status}`);
    password = next;
    const out = await api('/api/auth/logout', 'POST', {});
    expect(out.status < 300, '로그아웃 실패');
    const me = await api('/api/auth/me');
    expect(!me.body?.user, '로그아웃 후 인증 유지');
    const login = await api('/api/auth/login', 'POST', { email, password });
    expect(login.status < 300, '새 비밀번호 로그인 실패');
    record('비밀번호 변경·로그아웃·재로그인', true);
  });
}
async function uiFlows() {
  await page.setViewportSize({ width: 390, height: 900 });
  await check('실제 UI: 새 프로젝트와 할 일 동시 등록', async () => {
    await navigate('/plans');
    await page.getByRole('button', { name: '+ 플랜 등록', exact: true }).click();
    const form = page.locator('.plan-create-dialog');
    await form.getByPlaceholder('예: 발표 자료 준비하기').fill('QA UI 할 일 ' + stamp);
    await form.getByRole('combobox', { name: '프로젝트 (선택)' }).click();
    await page.getByRole('option', { name: '새 프로젝트 등록하기', exact: true }).click();
    await form.getByPlaceholder('예: 제주도 여행').fill('QA UI 프로젝트 ' + stamp);
    await form.getByRole('button', { name: '할 일 추가하기', exact: true }).click();
    await page.waitForURL(/\/projects\/\d+/, { timeout: 20000 });
    const data = await api('/api/workspace');
    const project = data.body.projects.find((p) => p.name === 'QA UI 프로젝트 ' + stamp);
    const task = data.body.tasks.find((t) => t.title === 'QA UI 할 일 ' + stamp);
    expect(
      project && task && String(task.projectId) === String(project.id),
      '생성 또는 프로젝트 연결 실패',
    );
    records.projects.push(project.id);
    records.tasks.push(task.id);
    record('실제 UI: 새 프로젝트와 할 일 동시 등록', true);
    await check('실제 UI: 프로젝트 할 일 상세·수정·완료', async () => {
      await page.locator(`a[href="/items/tasks/${task.id}"]`).click();
      await page.waitForURL(base + '/items/tasks/' + task.id);
      await page.getByRole('link', { name: '수정', exact: true }).click();
      await page.locator('input').first().fill('QA UI 수정된 할 일');
      await page.getByRole('button', { name: '변경사항 저장', exact: true }).click();
      await page.waitForURL(base + '/items/tasks/' + task.id);
      await page.getByRole('button', { name: '완료하기', exact: true }).click();
      await page.getByRole('button', { name: '완료 취소', exact: true }).waitFor();
      record('실제 UI: 프로젝트 할 일 상세·수정·완료', true);
    });
  });
  await check('실제 UI: 캘린더에서 일정 등록 페이지로 이동', async () => {
    await navigate('/calendar');
    console.log(
      JSON.stringify({
        calendarCreateHref: await page
          .getByRole('link', { name: '일정 등록 페이지로 이동 →', exact: true })
          .getAttribute('href'),
      }),
    );
    await page.getByRole('link', { name: '일정 등록 페이지로 이동 →', exact: true }).click();
    await page.waitForURL(base + '/plans?tab=individual&kind=events', { timeout: 7000 });
    await page.getByRole('button', { name: '+ 플랜 등록', exact: true }).waitFor();
    record('실제 UI: 캘린더에서 일정 등록 페이지로 이동', true);
  });
  await check('실제 UI: 플랜 모달 일정 등록·날짜 유지·캘린더 표시', async () => {
    await navigate('/plans');
    await page.getByRole('button', { name: '+ 플랜 등록', exact: true }).click();
    const form = page.locator('.plan-create-dialog');
    await form
      .locator('.plan-kind-tabs')
      .getByRole('button', { name: '일정', exact: true })
      .click();
    await form.getByPlaceholder('예: 팀 회의').fill('QA UI 일정 ' + stamp);
    const inputs = form.locator('input[type=datetime-local]');
    await inputs.nth(0).fill('2026-10-23T14:00');
    await inputs.nth(1).fill('2026-10-23T15:00');
    await form.getByRole('button', { name: '일정 추가하기', exact: true }).click();
    await form.waitFor({ state: 'hidden', timeout: 20000 });
    const workspace = await api('/api/workspace');
    const saved = workspace.body.events.find((e) => e.title === 'QA UI 일정 ' + stamp);
    expect(saved, '등록 일정 조회 실패');
    const id = saved.id;
    records.events.push(id);
    const r = await api('/api/events/' + id);
    expect(
      Date.parse(r.body.startsAt) === Date.parse('2026-10-23T14:00:00+09:00'),
      '입력 날짜·시간 불일치',
    );
    await navigate('/calendar');
    await page.locator('.calendar-item', { hasText: 'QA UI 일정 ' + stamp }).waitFor();
    record('실제 UI: 플랜 모달 일정 등록·날짜 유지·캘린더 표시', true);
    await check('실제 UI: 미연결 Slack 알림 설정 이동', async () => {
      await page.locator('.calendar-item', { hasText: 'QA UI 일정 ' + stamp }).click();
      await page.getByRole('button', { name: 'Slack 알림 설정', exact: true }).click();
      await page.waitForURL(base + '/mypage#slack');
      record('실제 UI: 미연결 Slack 알림 설정 이동', true);
    });
    await check('실제 UI: 일정 상세 삭제·목록에서 제거', async () => {
      await navigate('/items/events/' + id);
      await page.getByRole('button', { name: '삭제', exact: true }).click();
      await page.locator('.confirm-dialog[open]').waitFor();
      await page.getByRole('button', { name: '계속하기', exact: true }).click();
      await page.waitForURL(/\/plans\?/);
      const r = await api('/api/events/' + id);
      expect(r.status === 404, '삭제 후 조회 가능');
      record('실제 UI: 일정 상세 삭제·목록에서 제거', true);
    });
  });
}
async function finish() {
  if (registered) {
    // Collect only this new QA account's own records, including a partially completed UI flow.
    try {
      const workspace = await api('/api/workspace');
      if (workspace.status === 200)
        for (const kind of ['projects', 'tasks', 'events'])
          for (const item of workspace.body[kind] || [])
            if (!records[kind].includes(item.id)) records[kind].push(item.id);
    } catch {}
    for (const kind of ['tasks', 'events', 'projects'])
      for (const id of records[kind]) {
        try {
          const r = await api('/api/' + kind + '/' + id, 'DELETE');
          record(
            `임시 데이터 삭제 ${kind}/${id}`,
            r.status < 300 || r.status === 404,
            `HTTP ${r.status}`,
          );
        } catch (e) {
          record('임시 데이터 정리', false, e.message);
        }
      }
    try {
      const r = await api('/api/account', 'DELETE', { password });
      record('QA 계정 탈퇴·정리', r.status < 300, `HTTP ${r.status}`);
    } catch (e) {
      record('QA 계정 정리', false, e.message);
    }
  }
  if (page) await page.close().catch(() => {});
  if (browser) await browser.close();
  const report = { base, results, errors, requests, registered, artifacts: output };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      summary: {
        passed: results.filter((r) => r.pass).length,
        failed: results.filter((r) => !r.pass).length,
      },
      errors,
      artifacts: output,
    }),
  );
}
run()
  .catch((e) => record('QA 중단', false, e.message))
  .finally(finish);
