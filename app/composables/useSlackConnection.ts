export interface SlackConnection {
  configured: boolean;
  connected: boolean;
  workspaceId: string | null;
  memberId: string | null;
  connectedAt: string | null;
}
export function useSlackConnection(options: { lazy?: boolean; immediate?: boolean } = {}) {
  const { request } = useApi();
  return useAsyncData('slack-connection', () => request<SlackConnection>('/api/account/slack'), {
    lazy: options.lazy ?? false,
    immediate: options.immediate ?? true,
  });
}
