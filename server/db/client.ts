import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

let client: NeonQueryFunction<false, false> | undefined

export function sql() {
  if (!client) {
    const config = useRuntimeConfig()
    if (!config.databaseUrl) {
      throw createError({ statusCode: 503, statusMessage: 'DATABASE_URL is not configured' })
    }
    client = neon(config.databaseUrl)
  }
  return client
}

export async function checkDatabaseConnection() {
  const rows = await sql().query('SELECT 1 AS ok') as Array<{ ok: number }>
  return rows[0]?.ok === 1
}
