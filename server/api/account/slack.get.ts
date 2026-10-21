import { requireUser } from '#server/utils/auth';
import { slackOAuthConfigured, slackOAuthIssues } from '#server/utils/slack-oauth';
export default defineEventHandler(async (event) => {
  const { workspaceId, memberId, connectedAt } = await requireUser(event, true);
  return {
    configured: slackOAuthConfigured(),
    oauthConfigured: slackOAuthConfigured(),
    setupIssues: slackOAuthIssues(),
    connected: Boolean(connectedAt),
    workspaceId,
    memberId,
    connectedAt,
  };
});
