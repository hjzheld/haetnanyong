import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import ts from 'typescript';

// Compile these pure utility modules without a bundler scanning parent directories.
export async function loadTsModule(file) {
  const cache = new Map();
  function moduleUrl(path) {
    const absolute = resolve(path);
    if (cache.has(absolute)) return cache.get(absolute);
    const code = ts
      .transpileModule(readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
      })
      .outputText.replace(/from\s+(['"])(\.[^'"]+)\1/g, (_match, _quote, specifier) => {
        const dependency = resolve(dirname(absolute), specifier);
        return `from '${moduleUrl(extname(dependency) ? dependency : dependency + '.ts')}'`;
      });
    const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
    cache.set(absolute, url);
    return url;
  }
  return import(moduleUrl(file));
}
