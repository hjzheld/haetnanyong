import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const slackOAuthCookie = 'slack_oauth_state';
export const slackScopes = ['users:read', 'chat:write', 'im:write'];
export function slackOAuthIssues(): string[] {
  const c = useRuntimeConfig();
  const issues: string[] = [];
  if (!c.slackClientId?.trim()) issues.push('SLACK_CLIENT_ID');
  if (!c.slackTokenEncryptionKey || c.slackTokenEncryptionKey.length < 32)
    issues.push('SLACK_TOKEN_ENCRYPTION_KEY');
  try {
    const url = new URL(c.slackRedirectUri);
    if (
      url.protocol !== 'https:' ||
      url.pathname !== '/api/account/slack/callback' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      issues.push('SLACK_REDIRECT_URI');
  } catch {
    issues.push('SLACK_REDIRECT_URI');
  }
  return issues;
}
export function slackOAuthConfigured() {
  return slackOAuthIssues().length === 0;
}
export function slackOAuthConfig() {
  if (!slackOAuthConfigured())
    throw createError({ statusCode: 503, statusMessage: 'Slack OAuth is not configured' });
  const c = useRuntimeConfig();
  const url = new URL(c.slackRedirectUri);
  if (
    url.protocol !== 'https:' ||
    url.pathname !== '/api/account/slack/callback' ||
    url.search ||
    url.hash
  )
    throw createError({ statusCode: 503, statusMessage: 'Invalid Slack redirect URI' });
  tokenKey();
  return c;
}
function tokenKey() {
  const secret = useRuntimeConfig().slackTokenEncryptionKey;
  if (secret.length < 32)
    throw createError({
      statusCode: 503,
      statusMessage: 'Slack encryption key must contain at least 32 characters',
    });
  return createHash('sha256')
    .update('slack-installation:' + secret)
    .digest();
}
export function encryptSlackToken(token: string, workspaceId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', tokenKey(), iv);
  cipher.setAAD(Buffer.from(workspaceId));
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function decryptSlackToken(value: string, workspaceId: string) {
  const raw = Buffer.from(value, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', tokenKey(), raw.subarray(0, 12));
  cipher.setAAD(Buffer.from(workspaceId));
  cipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString('utf8');
}
