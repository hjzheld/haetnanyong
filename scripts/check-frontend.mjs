import assert from 'node:assert/strict';
const base = process.env.CHECK_BASE_URL || 'http://127.0.0.1:4317';
const landing = await fetch(base + '/');
assert.equal(landing.status, 200);
const html = await landing.text();
assert.ok(html.includes('landing-page'));
assert.ok(html.includes('feature-card-head'));
assert.ok(!html.includes('<header'));
assert.ok(html.includes('🐱 했냐옹 | 오늘 할 일과 리마인드를 한곳에'));
assert.ok(html.includes('rel="canonical"'));
assert.ok(landing.headers.get('content-security-policy'));
assert.ok(landing.headers.get('x-request-id'));
for (const path of ['/login', '/login?mode=register']) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200);
  const content = await response.text();
  assert.ok(content.includes('family=Gowun+Dodum'));
  assert.ok(!content.includes('family=Noto'));
  assert.ok(content.includes('class="auth-fields"'));
  assert.ok(content.includes('class="auth-status"'));
  assert.ok(content.includes('noindex, nofollow'));
  assert.ok(content.indexOf('switch-auth') < content.indexOf('login-intro-link'));
  assert.ok(content.indexOf('login-intro-link') < content.indexOf('</form>'));
  if (path.includes('register')) assert.ok(content.includes('autocomplete="nickname"'));
}
for (const name of [
  'cat.png',
  'cat-sleeping.png',
  'cat-loaf.png',
  'cat-paw-pad.png',
  'cat-stretching.png',
]) {
  const response = await fetch(base + '/images/' + name);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get('content-type')?.includes('image/'));
}
for (const resource of [
  'tasks',
  'events',
  'projects',
  'reminders',
  'account/slack',
  'workspace',
  'items',
]) {
  assert.equal((await fetch(base + '/api/' + resource)).status, 401);
}
for (const resource of ['profile', 'password']) {
  assert.equal(
    (
      await fetch(base + '/api/account/' + resource, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
    ).status,
    401,
  );
}
const redirect = await fetch(base + '/projects', { redirect: 'manual' });
assert.equal(redirect.status, 302);
assert.equal(redirect.headers.get('location'), '/login?redirect=/projects');
const missing = await fetch(base + '/missing-page', { headers: { accept: 'text/html' } });
assert.equal(missing.status, 404);
assert.ok((await missing.text()).includes('noindex, nofollow'));
assert.equal((await fetch(base + '/robots.txt')).status, 200);
assert.equal((await fetch(base + '/sitemap.xml')).status, 200);
assert.equal(
  (
    await fetch(base + '/api/auth/logout', {
      method: 'POST',
      headers: { origin: 'https://cross-site.invalid' },
    })
  ).status,
  403,
);
const schema = await (await fetch(base + '/api/openapi')).json();
assert.ok(schema.paths['/account/password']);
assert.ok(schema.paths['/account/sessions']);
console.log(
  'PASS: landing/login SSR, SEO/noindex, security headers, CSRF guard, images, auth redirect, protected API guards and account API documentation. No writes or Slack messages.',
);
