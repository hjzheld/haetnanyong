import { query } from '#server/utils/db';
import { decryptSlackToken } from '#server/utils/slack-oauth';
type SlackResponse = { ok: boolean; error?: string; scheduled_message_id?: string };

// Only explicit rejections prove that scheduling did not create a reservation.
const rejectedCodes = new Set([
  'invalid_auth',
  'not_authed',
  'token_revoked',
  'token_expired',
  'account_inactive',
  'missing_scope',
  'no_permission',
  'channel_not_found',
  'not_in_channel',
  'is_archived',
  'restricted_action',
  'restricted_too_many',
  'ratelimited',
  'time_in_past',
  'time_too_far',
  'invalid_arguments',
  'invalid_arg_name',
  'msg_too_long',
  'no_text',
  'invalid_scheduled_message_id',
]);

export function slackFailure(error: unknown) {
  const value = error as { data?: { slackCode?: string; outcome?: string }; message?: string };
  const code =
    value?.data?.slackCode ||
    value?.message?.match(/failed:\s*([a-z0-9_]+)/i)?.[1] ||
    'request_failed';
  return { code, rejected: value?.data?.outcome === 'rejected' || rejectedCodes.has(code) };
}

export async function slackTokenForChannel(channel: string) {
  const [installation] = await query<{ token: string; workspace: string }>(
    'SELECT i.encrypted_bot_token AS token,i.workspace_id AS workspace FROM slack_channel_installations c JOIN slack_installations i ON i.workspace_id=c.workspace_id WHERE c.channel_id=$1',
    [channel],
  );
  if (installation) return decryptSlackToken(installation.token, installation.workspace);
  return useRuntimeConfig().slackBotToken;
}

export async function callSlack<T extends SlackResponse>(
  method: string,
  body: Record<string, unknown>,
  explicitToken?: string,
): Promise<T> {
  let token = explicitToken;
  if (!token && typeof body.channel === 'string') {
    try {
      token = await slackTokenForChannel(body.channel);
    } catch {
      throw createError({
        statusCode: 503,
        statusMessage: 'Slack installation token is unavailable',
        data: { slackCode: 'installation_unavailable', outcome: 'rejected' },
      });
    }
  }
  token ||= useRuntimeConfig().slackBotToken;
  if (!token)
    throw createError({
      statusCode: 503,
      statusMessage: 'SLACK_BOT_TOKEN is not configured',
      data: { slackCode: 'not_configured', outcome: 'rejected' },
    });
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null) form.set(key, String(value));
  }
  const response = await $fetch<T>(`https://slack.com/api/${method}`, {
    method: 'POST',
    retry: 0,
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
    body: form,
  }).catch((error: { response?: { status?: number; headers?: Headers } }) => {
    const limited = error.response?.status === 429;
    const retryAfter = Number(error.response?.headers?.get('retry-after')) || undefined;
    throw createError({
      statusCode: limited ? 429 : 502,
      statusMessage: limited
        ? `Slack ${method} failed: ratelimited`
        : `Slack ${method} request failed`,
      data: {
        slackCode: limited ? 'ratelimited' : 'request_failed',
        outcome: limited ? 'rejected' : 'unknown',
        retryAfter,
      },
    });
  });
  if (!response.ok)
    throw createError({
      statusCode: 502,
      statusMessage: `Slack ${method} failed: ${response.error || 'unknown_error'}`,
      data: {
        slackCode: response.error || 'unknown_error',
        outcome: rejectedCodes.has(response.error || '') ? 'rejected' : 'unknown',
      },
    });
  return response;
}

export interface ScheduledSlackMessage {
  id: string;
  channel_id: string;
  post_at: number;
  text: string;
}

export async function listScheduledSlackMessages(channel: string) {
  const messages: ScheduledSlackMessage[] = [];
  let cursor = '';
  // Absence is meaningful only after the entire channel's list has been read.
  for (let page = 0; page < 20; page++) {
    const result = await callSlack<
      SlackResponse & {
        scheduled_messages: ScheduledSlackMessage[];
        response_metadata?: { next_cursor?: string };
      }
    >('chat.scheduledMessages.list', { channel, limit: 100, ...(cursor ? { cursor } : {}) });
    if (!Array.isArray(result.scheduled_messages))
      throw createError({ statusCode: 502, statusMessage: 'Slack reservation list is incomplete' });
    messages.push(...result.scheduled_messages);
    cursor = result.response_metadata?.next_cursor?.trim() || '';
    if (!cursor) return messages;
  }
  throw createError({ statusCode: 502, statusMessage: 'Slack reservation list is incomplete' });
}

export function scheduleSlackMessage(channel: string, text: string, postAt: number) {
  return callSlack('chat.scheduleMessage', { channel, text, post_at: postAt });
}
export function cancelSlackMessage(channel: string, scheduledMessageId: string) {
  return callSlack('chat.deleteScheduledMessage', {
    channel,
    scheduled_message_id: scheduledMessageId,
  });
}
