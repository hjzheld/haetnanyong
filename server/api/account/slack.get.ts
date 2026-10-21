import { requireUser } from '#server/utils/auth';
import { slackOAuthConfigured } from '#server/utils/slack-oauth';
export default defineEventHandler(async (event) => {
  const { workspaceId, memberId, connectedAt } = await requireUser(event, true);
  return {
    configured: slackOAuthConfigured() || Boolean(useRuntimeConfig().slackBotToken),
    oauthConfigured: slackOAuthConfigured(),
    connected: Boolean(connectedAt),
    workspaceId,
    memberId,
    connectedAt,
  };
});
