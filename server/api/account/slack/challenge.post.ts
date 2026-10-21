import { randomBytes, createHash } from 'node:crypto';
import { requireUser } from '#server/utils/auth';
import { inputBody, inputText } from '#server/utils/input';
import { callSlack } from '#server/services/slack';
import {
  assertSlackChangeAllowed,
  readChallenge,
  sealChallenge,
  challengeCookie,
} from '#server/utils/slack-connection';
import { hashSessionToken } from '#server/utils/session';
export default defineEventHandler(async (event) => {
  const user = await requireUser(event),
    body = inputBody(await readBody(event));
  const memberId = inputText(body.memberId, 'memberId').toUpperCase();
  if (!/^[UW][A-Z0-9]{8,49}$/.test(memberId))
    throw createError({
      statusCode: 400,
      statusMessage: 'Slack 멤버 ID를 확인해주세요. U 또는 W로 시작합니다.',
    });
  await assertSlackChangeAllowed(user.id);
  const prior = readChallenge(event);
  if (prior && Date.now() - prior.issued < 60000)
    throw createError({ statusCode: 429, statusMessage: '인증 코드 재발송은 1분 후에 가능해요.' });
  const auth = await callSlack<{ ok: boolean; team_id?: string }>('auth.test', {});
  const info = await callSlack<{
    ok: boolean;
    user?: { id: string; team_id: string; is_bot?: boolean; deleted?: boolean };
  }>('users.info', { user: memberId });
  if (!auth.team_id || info.user?.team_id !== auth.team_id || info.user.is_bot || info.user.deleted)
    throw createError({
      statusCode: 400,
      statusMessage: '이 앱이 설치된 워크스페이스의 활성 사용자만 연결할 수 있어요.',
    });
  const dm = await callSlack<{ ok: boolean; channel?: { id: string } }>('conversations.open', {
    users: memberId,
  });
  if (!dm.channel?.id)
    throw createError({ statusCode: 502, statusMessage: 'Slack DM을 열지 못했어요.' });
  const code = randomBytes(6).toString('hex').toUpperCase(),
    issued = Date.now();
  await callSlack('chat.postMessage', {
    channel: dm.channel.id,
    text: `했냐옹 Slack 연결 인증 코드: ${code}\n10분 안에 마이페이지에 입력해주세요. 직접 요청하지 않았다면 이 코드를 공유하지 마세요.`,
    unfurl_links: false,
  });
  setCookie(
    event,
    challengeCookie,
    sealChallenge({
      userId: user.id,
      sessionHash: hashSessionToken(getCookie(event, 'session')!),
      memberId,
      workspaceId: auth.team_id,
      channelId: dm.channel.id,
      codeHash: createHash('sha256').update(code).digest('hex'),
      issued,
      expires: issued + 600000,
    }),
    {
      httpOnly: true,
      secure: !import.meta.dev,
      sameSite: 'strict',
      path: '/api/account/slack',
      maxAge: 600,
    },
  );
  return { sent: true, expiresIn: 600 };
});
