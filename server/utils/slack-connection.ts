import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { H3Event } from 'h3';
import { hashSessionToken } from '#server/utils/session';
import { hasActiveReminders } from '#server/services/reminders';

export interface SlackChallenge {
  userId: string;
  sessionHash: string;
  memberId: string;
  workspaceId: string;
  channelId: string;
  codeHash: string;
  expires: number;
  issued: number;
}
export const challengeCookie = 'slack_challenge';
const key = () => {
  const secret = useRuntimeConfig().sessionSecret || useRuntimeConfig().slackBotToken;
  if (!secret)
    throw createError({ statusCode: 503, statusMessage: 'Slack 연결이 서버에 설정되지 않았어요.' });
  return createHash('sha256')
    .update('slack-challenge:' + secret)
    .digest();
};
export function sealChallenge(value: SlackChallenge) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function readChallenge(event: H3Event): SlackChallenge | null {
  try {
    const raw = Buffer.from(getCookie(event, challengeCookie) || '', 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const value = JSON.parse(
      Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString(),
    ) as SlackChallenge;
    if (
      value.expires < Date.now() ||
      value.sessionHash !== hashSessionToken(getCookie(event, 'session') || '')
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export async function assertSlackChangeAllowed(userId: string) {
  if (await hasActiveReminders(userId))
    throw createError({
      statusCode: 409,
      statusMessage: '예약 중이거나 결과 확인이 필요한 알림을 먼저 취소·확인해주세요.',
    });
}
