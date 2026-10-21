import { createHash, timingSafeEqual } from 'node:crypto';
import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { inputBody, inputText } from '#server/utils/input';
import {
  assertSlackChangeAllowed,
  readChallenge,
  challengeCookie,
} from '#server/utils/slack-connection';
export default defineEventHandler(async (event) => {
  const user = await requireUser(event),
    body = inputBody(await readBody(event)),
    challenge = readChallenge(event);
  const code = inputText(body.code, 'code').toUpperCase();
  const actual = createHash('sha256').update(code).digest();
  if (
    !challenge ||
    challenge.userId !== user.id ||
    !timingSafeEqual(actual, Buffer.from(challenge.codeHash, 'hex'))
  )
    throw createError({ statusCode: 400, statusMessage: '인증 코드가 틀리거나 만료되었어요.' });
  await assertSlackChangeAllowed(user.id);
  await query(
    'UPDATE users SET slack_workspace_id=$1,slack_user_id=$2,slack_dm_channel_id=$3,slack_connected_at=now(),updated_at=now() WHERE id=$4',
    [challenge.workspaceId, challenge.memberId, challenge.channelId, user.id],
  );
  deleteCookie(event, challengeCookie, { path: '/api/account/slack' });
  return { connected: true };
});
