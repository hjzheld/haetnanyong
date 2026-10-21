import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { assertSlackChangeAllowed, challengeCookie } from '#server/utils/slack-connection';
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  await assertSlackChangeAllowed(user.id);
  await query(
    'UPDATE users SET slack_workspace_id=NULL,slack_user_id=NULL,slack_dm_channel_id=NULL,slack_connected_at=NULL,updated_at=now() WHERE id=$1',
    [user.id],
  );
  deleteCookie(event, challengeCookie, { path: '/api/account/slack' });
  return { connected: false };
});
