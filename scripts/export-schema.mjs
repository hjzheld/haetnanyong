import { neon } from '@neondatabase/serverless'
process.loadEnvFile()
const db = neon(process.env.DATABASE_URL)
const columns = await db.query("SELECT c.relname AS table_name,a.attname AS column_name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,a.attidentity AS identity,pg_get_expr(d.adbin,d.adrelid) AS default_value FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum")
const constraints = await db.query("SELECT c.relname AS table_name,k.conname AS name,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND k.contype IN ('p','u','f','c') ORDER BY c.relname,k.conname")
const indexes = await db.query("SELECT pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid=i.indexrelid)")
const quote = value => '"' + value.replaceAll('"','""') + '"'
let sql = '-- Read-only snapshot exported from Neon. For a fresh database; not an in-place migration.\n\n'
for (const table of [...new Set(columns.map(c => c.table_name))]) {
  sql += 'CREATE TABLE ' + quote(table) + ' (\n' + columns.filter(c => c.table_name === table).map(c => '  ' + quote(c.column_name) + ' ' + c.type + (c.identity ? ' GENERATED ' + (c.identity === 'a' ? 'ALWAYS' : 'BY DEFAULT') + ' AS IDENTITY' : c.default_value ? ' DEFAULT ' + c.default_value : '') + (c.not_null ? ' NOT NULL' : '')).join(',\n') + '\n);\n\n'
}
for (const c of constraints) sql += 'ALTER TABLE ' + quote(c.table_name) + ' ADD CONSTRAINT ' + quote(c.name) + ' ' + c.definition + ';\n'
for (const i of indexes) sql += i.definition + ';\n'
console.log(sql)
