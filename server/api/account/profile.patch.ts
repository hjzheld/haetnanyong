import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { inputBody, inputText, inputPassword } from '#server/utils/input';
import { verifyPassword } from '#server/utils/password';
import { hashSessionToken } from '#server/utils/session';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = inputBody(await readBody(event));
  const nickname = inputText(body.nickname, 'nickname');
  if (nickname.length < 2 || nickname.length > 30)
    throw createError({ statusCode: 400, statusMessage: '닉네임은 2~30자로 입력해주세요.' });
  const email = inputText(body.email, 'email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw createError({ statusCode: 400, statusMessage: '이메일 형식을 확인해주세요.' });
  if (body.newPassword !== undefined)
    throw createError({ statusCode: 400, statusMessage: '비밀번호 변경 메뉴를 이용해주세요.' });
  const emailChanged = email !== user.email;
  if (emailChanged)
    throw createError({
      statusCode: 409,
      statusMessage: 'Email changes are disabled until new-address verification is available',
    });
  let previousHash: string | null = null;
  if (emailChanged) {
    const currentPassword = inputPassword(body.currentPassword);
    const [stored] = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id=$1',
      [user.id],
    );
    if (!stored || !(await verifyPassword(currentPassword, stored.password_hash)))
      throw createError({ statusCode: 400, statusMessage: '현재 비밀번호가 일치하지 않아요.' });
    previousHash = stored.password_hash;
  }
  const [updated] = await query<{ id: string; email: string; nickname: string }>(
    `WITH updated AS (
    UPDATE users SET nickname=$1,email=$2,updated_at=now() WHERE id=$3 AND ($4::text IS NULL OR password_hash=$4) RETURNING id,email,nickname
  ), revoked AS (
    UPDATE sessions SET revoked_at=now() WHERE user_id IN (SELECT id FROM updated)
    AND $5::boolean AND token_hash<>$6 AND revoked_at IS NULL RETURNING id
  ) SELECT id,email,nickname FROM updated`,
    [
      nickname,
      email,
      user.id,
      previousHash,
      emailChanged,
      hashSessionToken(getCookie(event, 'session')!),
    ],
  );
  if (!updated)
    throw createError({
      statusCode: 409,
      statusMessage: '계정 정보가 변경되었어요. 다시 로그인해주세요.',
    });
  return { user: updated };
});
