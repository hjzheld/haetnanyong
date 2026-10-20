import type { H3Event } from 'h3'
import type { AuthUser } from '#server/types/api'
import { query } from '#server/utils/db'
import { hashSessionToken } from '#server/utils/session'

export async function requireUser(event: H3Event): Promise<AuthUser> {
  const token = getCookie(event, 'session')
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  const rows = await query<AuthUser>('SELECT u.id, u.email, u.nickname FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > now() AND s.revoked_at IS NULL', [hashSessionToken(token)])
  if (!rows[0]) throw createError({ statusCode: 401, statusMessage: 'Session expired' })
  return rows[0]
}

export function assertOwner(userId: string, ownerId: string) {
  if (userId !== ownerId) throw createError({ statusCode: 404, statusMessage: 'Resource not found' })
}
