import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { inputBody, inputText } from '#server/utils/input';

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
  const [updated] = await query<{ id: string; email: string; nickname: string }>(
    'UPDATE users SET nickname=$1,updated_at=now() WHERE id=$2 RETURNING id,email,nickname',
    [nickname, user.id],
  );
  if (!updated)
    throw createError({
      statusCode: 409,
      statusMessage: '계정 정보가 변경되었어요. 다시 로그인해주세요.',
    });
  return { user: updated };
});
