import type { H3Event } from 'h3';
import type { AuthUser } from '#server/types/api';
import { query } from '#server/utils/db';
import { hashSessionToken } from '#server/utils/session';

interface SlackAuthUser extends AuthUser {
  workspaceId: string | null;
  memberId: string | null;
  connectedAt: string | null;
}

export function requireUser(event: H3Event): Promise<AuthUser>;
export function requireUser(event: H3Event, includeSlack: true): Promise<SlackAuthUser>;
export async function requireUser(
  event: H3Event,
  includeSlack = false,
): Promise<AuthUser | SlackAuthUser> {
  const key = includeSlack ? 'authenticatedSlackUser' : 'authenticatedUser';
  const cached = event.context[key] as Promise<AuthUser | SlackAuthUser> | undefined;
  if (cached) return cached;
  const pending = loadUser(event, includeSlack);
  event.context[key] = pending;
  return pending;
}

async function loadUser(event: H3Event, includeSlack: boolean): Promise<AuthUser | SlackAuthUser> {
  const token = getCookie(event, 'session');
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Authentication required' });
  const slackColumns = includeSlack
    ? ', u.slack_workspace_id AS "workspaceId", u.slack_user_id AS "memberId", u.slack_connected_at AS "connectedAt"'
    : '';
  const startedAt = performance.now();
  const rows = await query<AuthUser | SlackAuthUser>(
    `SELECT u.id, u.email, u.nickname${slackColumns} FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token_hash = $1 AND s.expires_at > now() AND s.revoked_at IS NULL`,
    [hashSessionToken(token)],
  );
  appendResponseHeader(
    event,
    'Server-Timing',
    `auth_db;dur=${(performance.now() - startedAt).toFixed(1)}`,
  );
  if (!rows[0]) throw createError({ statusCode: 401, statusMessage: 'Session expired' });
  return rows[0];
}

export function assertOwner(userId: string, ownerId: string) {
  if (userId !== ownerId)
    throw createError({ statusCode: 404, statusMessage: 'Resource not found' });
}
