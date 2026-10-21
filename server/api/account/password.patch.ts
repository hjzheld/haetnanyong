import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { inputBody, inputPassword } from '#server/utils/input';
import { hashPassword, verifyPassword } from '#server/utils/password';
import { hashSessionToken } from '#server/utils/session';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = inputBody(await readBody(event));
  const currentPassword = inputPassword(body.currentPassword);
  const newPassword = inputPassword(body.newPassword);
  if (newPassword.length < 8 || newPassword.length > 200)
    throw createError({ statusCode: 400, statusMessage: '새 비밀번호는 8~200자로 입력해주세요.' });
  const [stored] = await query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id=$1',
    [user.id],
  );
  if (!stored || !(await verifyPassword(currentPassword, stored.password_hash)))
    throw createError({ statusCode: 400, statusMessage: '현재 비밀번호가 일치하지 않아요.' });
  const [updated] = await query<{ id: string }>(
    `WITH updated AS (
    UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2 AND password_hash=$3 RETURNING id
  ), revoked AS (
    UPDATE sessions SET revoked_at=now() WHERE user_id IN (SELECT id FROM updated)
    AND token_hash<>$4 AND revoked_at IS NULL RETURNING id
  ) SELECT id FROM updated`,
    [
      await hashPassword(newPassword),
      user.id,
      stored.password_hash,
      hashSessionToken(getCookie(event, 'session')!),
    ],
  );
  if (!updated)
    throw createError({
      statusCode: 409,
      statusMessage: '계정 정보가 변경되었어요. 다시 로그인해주세요.',
    });
  return { ok: true };
});
