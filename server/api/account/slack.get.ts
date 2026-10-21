import { requireUser } from '#server/utils/auth';
export default defineEventHandler(async (event) => {
  const { workspaceId, memberId, connectedAt } = await requireUser(event, true);
  return {
    configured: Boolean(useRuntimeConfig().slackBotToken),
    connected: Boolean(connectedAt),
    workspaceId,
    memberId,
    connectedAt,
  };
});
