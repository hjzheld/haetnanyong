import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync('app/plugins/reveal.ts', 'utf8');
function setup(client, reduced = false) {
  let callback, directive;
  const observed = new Set();
  class Observer {
    constructor(fn) {
      callback = fn;
    }
    observe(el) {
      observed.add(el);
    }
    unobserve(el) {
      observed.delete(el);
    }
  }
  const module = { exports: {} };
  const js = ts.transpileModule(source.replaceAll('import.meta.client', String(client)), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, {
    module,
    exports: module.exports,
    defineNuxtPlugin: (fn) => fn,
    IntersectionObserver: Observer,
    ...(client
      ? { window: { IntersectionObserver: Observer, matchMedia: () => ({ matches: reduced }) } }
      : {}),
  });
  module.exports.default({
    vueApp: {
      directive: (_, value) => {
        directive = value;
      },
    },
  });
  return { directive, observed, enter: (el) => callback([{ target: el, isIntersecting: true }]) };
}
const server = setup(false);
assert.equal(Object.keys(server.directive.getSSRProps()).length, 0);
const client = setup(true);
let options,
  canceled = false;
const el = {
  animate: (_, config) => {
    options = config;
    return {
      cancel: () => {
        canceled = true;
      },
    };
  },
};
client.directive.mounted(el, { value: 2 });
assert.ok(client.observed.has(el));
assert.equal(options, undefined);
client.enter(el);
assert.equal(options.delay, 130);
assert.equal(options.fill, 'backwards');
assert.ok(!client.observed.has(el));
client.directive.beforeUnmount(el);
assert.ok(canceled);
const reduced = setup(true, true);
reduced.directive.mounted({ animate: () => assert.fail('Reduced motion must skip animation') }, {});
const reducedEl = [...reduced.observed][0];
reduced.enter(reducedEl);
assert.ok(!reduced.observed.has(reducedEl));
console.log(
  'PASS: reveal SSR safety, viewport trigger, stagger delay, unobserve, animation cleanup and reduced motion.',
);
