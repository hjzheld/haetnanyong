import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { neon } from '@neondatabase/serverless'

process.loadEnvFile()
const db = neon(process.env.DATABASE_URL)
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)])
let checked = 0
let failed = 0
for (const file of [...files('server/api'), ...files('server/services'), 'server/utils/auth.ts']) {
  if (!file.endsWith('.ts')) continue
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const queries = []
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'query' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) queries.push(node.arguments[0].text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  for (const sql of queries) {
    const count = Math.max(0, ...[...sql.matchAll(/\$(\d+)/g)].map(match => Number(match[1])))
    try {
      // EXPLAIN without ANALYZE plans statements without executing writes or Slack calls.
      await db.query('EXPLAIN ' + sql, Array(count).fill(null))
      checked++
    } catch (error) {
      failed++
      console.error(file, error.code, error.message)
    }
  }
}
console.log(JSON.stringify({ checked, failed }))
process.exitCode = failed ? 1 : 0
