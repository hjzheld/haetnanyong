type SlackResponse = { ok: boolean; error?: string; scheduled_message_id?: string };

export async function callSlack<T extends SlackResponse>(
  method: string,
  body: Record<string, unknown>,
) {
  const token = useRuntimeConfig().slackBotToken;
  if (!token)
    throw createError({ statusCode: 503, statusMessage: 'SLACK_BOT_TOKEN is not configured' });
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null) form.set(key, String(value));
  }
  const response = await $fetch<T>(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
    body: form,
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
