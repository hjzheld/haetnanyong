import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const headers = new Map();
function load(file) {
  const module = { exports: {} };
  const code = ts
    .transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    })
    .outputText.replaceAll('import.meta.dev', 'false');
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: () => ({ randomUUID: () => 'test-request-id' }),
    defineEventHandler: (handler) => handler,
    setHeader: (_event, name, value) => headers.set(name.toLowerCase(), value),
    getRequestURL: () => new URL('https://example.test/docs'),
  });
  return module.exports.default;
}
load('server/middleware/01-request-security.ts')({ context: {}, method: 'GET' });
const html = load('server/routes/docs.get.ts')({});
const policy = headers.get('content-security-policy');
for (const [pattern, directive] of [
  [/<script src="([^"]+)"/g, 'script-src'],
  [/<link[^>]+href="([^"]+)"/g, 'style-src'],
]) {
  const allowed = policy
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(directive + ' '))
    .split(/\s+/)
    .slice(1);
  const urls = [...html.matchAll(pattern)].map((match) => match[1]);
  assert.ok(urls.length, `Swagger must load ${directive} assets`);
  for (const url of urls)
    assert.ok(allowed.includes(new URL(url).origin), `${url} must be allowed by ${directive}`);
}
assert.ok(html.includes("url:'/api/openapi'"));
console.log(
  'PASS Swagger script/style CDN matches the application CSP and uses the same-origin API schema',
);
