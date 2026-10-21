import { query } from '#server/utils/db';
import { decryptSlackToken } from '#server/utils/slack-oauth';
type SlackResponse = { ok: boolean; error?: string; scheduled_message_id?: string };

export async function callSlack<T extends SlackResponse>(
  method: string,
  body: Record<string, unknown>,
  explicitToken?: string,
): Promise<T> {
  let token = explicitToken;
  if (!token && typeof body.channel === 'string') {
    const [installation] = await query<{ token: string; workspace: string }>(
      'SELECT i.encrypted_bot_token AS token,i.workspace_id AS workspace FROM slack_channel_installations c JOIN slack_installations i ON i.workspace_id=c.workspace_id WHERE c.channel_id=$1',
      [body.channel],
    );
    if (installation) token = decryptSlackToken(installation.token, installation.workspace);
  }
  token ||= useRuntimeConfig().slackBotToken;
  if (!token)
    throw createError({ statusCode: 503, statusMessage: 'SLACK_BOT_TOKEN is not configured' });
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
  }).catch(() => {
    throw createError({ statusCode: 502, statusMessage: `Slack ${method} request failed` });
  });
  if (!response.ok)
    throw createError({
      statusCode: 502,
      statusMessage: `Slack ${method} failed: ${response.error || 'unknown_error'}`,
    });
  return response;
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
