import { inputBody, inputText, inputPassword } from '#server/utils/input';
import { query } from '#server/utils/db';
import { apiError } from '#server/utils/errors';
import { hashPassword } from '#server/utils/password';
import { randomBytes } from 'node:crypto';
import { hashSessionToken } from '#server/utils/session';

export default defineEventHandler(async (event) => {
  const body = inputBody(await readBody(event));
  const email = inputText(body.email, 'email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw createError({ statusCode: 400, statusMessage: 'Invalid email' });
  const password = inputPassword(body.password);
  if (!email || !email.includes('@')) apiError(400, 'INVALID_EMAIL', 'A valid email is required');
  if (password.length < 8 || password.length > 200)
    apiError(400, 'WEAK_PASSWORD', 'Password must be between 8 and 200 characters');
  if (body.nickname !== undefined && typeof body.nickname !== 'string')
    throw createError({ statusCode: 400, statusMessage: 'nickname must be a string' });
  const nickname = body.nickname?.trim();
  if (nickname && (nickname.length < 2 || nickname.length > 30))
    apiError(400, 'INVALID_NICKNAME', 'Nickname must be between 2 and 30 characters');
  const existing = await query('SELECT id FROM users WHERE lower(email) = $1', [email]);
  if (existing[0])
    throw createError({ statusCode: 409, statusMessage: 'Email is already registered' });
  const rows = nickname
    ? await query<{ id: string; email: string; nickname: string }>(
        'INSERT INTO users (email, nickname, password_hash) VALUES ($1, $2, $3) RETURNING id, email, nickname',
        [email, nickname, await hashPassword(password)],
      )
    : await query<{ id: string; email: string; nickname: string }>(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, nickname',
        [email, await hashPassword(password)],
      );
  const user = rows[0];
  if (!user) throw createError({ statusCode: 500, statusMessage: 'User registration failed' });
  const token = randomBytes(32).toString('hex');
  await query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '7 days')",
    [user.id, hashSessionToken(token)],
  );
  setCookie(event, 'session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    maxAge: 604800,
  });
  return { user };
});
