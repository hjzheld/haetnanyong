export function getDatabaseUrl() {
  const config = useRuntimeConfig()
  if (!config.databaseUrl) {
    throw createError({ statusCode: 503, statusMessage: 'DATABASE_URL is not configured' })
  }
  return config.databaseUrl
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const config = useRuntimeConfig()
  if (!config.databaseUrl) throw createError({ statusCode: 503, statusMessage: 'DATABASE_URL is not configured' })
  const { sql } = await import('#server/db/client')
  try {
    return await sql().query(text, params) as T[]
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code === '23505') throw createError({ statusCode: 409, statusMessage: 'A record with the same unique value already exists' })
    if (['23514', '23502', '22P02', '22007', '22008', '22001', '23503'].includes(code || '')) throw createError({ statusCode: 400, statusMessage: 'Input violates a database field or relationship constraint' })
    throw error
  }
}

// Neon/PostgreSQL client는 D04 단계에서 연결합니다.
// DB 접근은 server/utils 아래 한 곳으로 모아 소유권 검사와 트랜잭션 경계를 유지합니다.
