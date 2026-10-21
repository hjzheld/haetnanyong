import { requireUser } from '#server/utils/auth';
import { query } from '#server/utils/db';
import { hashSessionToken } from '#server/utils/session';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const token = getCookie(event, 'session');
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Authentication required' });

  const revoked = await query<{ id: string }>(
    'UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND token_hash <> $2 AND revoked_at IS NULL AND expires_at > now() RETURNING id',
    [user.id, hashSessionToken(token)],
  );
  return { revokedCount: revoked.length };
});
