// Read-only browser checks: all authenticated API responses are mocked.
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const cache = path.join(process.env.LOCALAPPDATA, 'npm-cache/_npx');
const packagePath = fs
  .readdirSync(cache)
  .map((p) => path.join(cache, p, 'node_modules/playwright/package.json'))
  .find((p) => fs.existsSync(p));
if (!packagePath)
  throw new Error('Run npm exec --package=playwright -- playwright --version first');
const { chromium } = createRequire(packagePath)('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  fs.mkdirSync('site-qa', { recursive: true });
  let signedIn = false;
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let body = [];
    if (pathname === '/api/auth/me') {
      if (!signedIn) return route.fulfill({ status: 401, json: {} });
      body = { user: { id: '1', email: 'preview@example.com', nickname: '화면확인용고양이' } };
    }
    if (pathname === '/api/account/slack') body = { configured: true, connected: false };
    if (pathname === '/api/calendar') body = [];
    if (pathname === '/api/projects')
      body = [
        {
          id: '1',
          name: '긴 프로젝트 이름도 모바일 화면 안에서 표시되는지 확인합니다',
          description: '레이아웃 확인',
          color: '#8E8AA3',
          archivedAt: null,
        },
      ];
    if (pathname === '/api/dashboard')
      body = {
        today: [],
        tomorrow: [],
        tasks: [],
        events: [],
        projects: [],
        stats: { total: 0, completed: 0, rate: 0 },
      };
    return route.fulfill({ json: body });
  });
  await page.goto('http://localhost:4317/login');
  await page.waitForFunction(() =>
    Boolean(document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$router),
  );
  await page.evaluate(() => {
    window.$nuxt = document.querySelector('#__nuxt').__vue_app__.config.globalProperties;
  });
  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of ['/', '/login', '/privacy', '/terms']) {
      await page.evaluate((url) => window.$nuxt.$router.push(url), url);
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      console.log(JSON.stringify({ width, url, overflow }));
      if (overflow) throw new Error(`Overflow ${url} at ${width}`);
    }
  }
  signedIn = true;
  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of ['/', '/mypage', '/projects', '/items', '/calendar', '/reminders']) {
      await page.evaluate((url) => window.$nuxt.$router.push(url), url);
      await page.waitForTimeout(250);
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        dialogsVisible: [...document.querySelectorAll('dialog:not([open])')].some(
          (el) => el.getBoundingClientRect().height > 0,
        ),
      }));
      console.log(JSON.stringify({ width, url, ...result }));
      await page.screenshot({
        path: `site-qa/layout-${url.replaceAll('/', '') || 'home'}-${width}.png`,
      });
      if (result.overflow || result.dialogsVisible) throw new Error(`Layout ${url} at ${width}`);
      if (url === '/mypage') {
        const toggle = page.getByRole('button', { name: '메뉴 열기', exact: true });
        const nav = page.locator('#primary-navigation');
        if (width < 768) {
          if (await nav.isVisible()) throw new Error('Mobile menu must start closed');
          await toggle.click();
          if (!(await nav.isVisible())) throw new Error('Mobile menu must open');
          if (!(await page.locator('#account-navigation').isVisible())) throw new Error('Account actions must open');
          await page.screenshot({ path: `site-qa/mobile-menu-${width}.png` });
          await page.keyboard.press('Escape');
          if (await nav.isVisible()) throw new Error('Escape must close menu');
          await toggle.click();
          await nav.getByRole('link', { name: '프로젝트', exact: true }).click();
          await page.waitForURL('**/projects');
          if (await nav.isVisible()) throw new Error('Navigation must close menu');
          await page.evaluate(() => window.$nuxt.$router.push('/mypage'));
        } else if (!(await nav.isVisible()) || (await toggle.isVisible())) {
          throw new Error('Desktop navigation must stay visible without mobile toggle');
        }
      }
      if (url === '/mypage') {
        await page.getByRole('button', { name: '비밀번호 변경', exact: true }).click();
        await page.screenshot({ path: `site-qa/account-dialog-${width}.png` });
        await page.getByRole('button', { name: '닫기', exact: true }).click();
      }
    }
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
