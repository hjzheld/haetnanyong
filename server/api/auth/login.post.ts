import { inputBody, inputText, inputPassword } from '#server/utils/input'
import { randomBytes } from 'node:crypto'
import { query } from '#server/utils/db'
import { apiError } from '#server/utils/errors'
import { verifyPassword } from '#server/utils/password'
import { hashSessionToken } from '#server/utils/session'

export default defineEventHandler(async (event) => {
  const body = inputBody(await readBody(event))
  const email = inputText(body.email, 'email').toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  const password = inputPassword(body.password)
  if (!email || !password) apiError(400, 'INVALID_INPUT', 'email and password are required')
  const rows = await query<{ id: string; email: string; nickname: string; password_hash: string }>('SELECT id, email, nickname, password_hash FROM users WHERE lower(email) = $1', [email])
  const user = rows[0]
  if (!user || !verifyPassword(password, user.password_hash)) throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  const token = randomBytes(32).toString('hex')
  await query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '7 days')", [user.id, hashSessionToken(token)])
  setCookie(event, 'session', token, { httpOnly: true, sameSite: 'lax', secure: !import.meta.dev, path: '/', maxAge: 604800 })
  return { user: { id: user.id, email: user.email, nickname: user.nickname } }
})
