type RateLimitError = {
  response?: { headers?: { get(name: string): string | null } };
};

export function rateLimitResetAt(error: unknown, now = Date.now()): number | null {
  const headers = (error as RateLimitError | null)?.response?.headers;
  const reset = headers?.get('x-ratelimit-reset');
  if (reset && Number.isFinite(Number(reset)) && Number(reset) > 0) return Number(reset) * 1000;
  const retry = headers?.get('retry-after');
  if (!retry) return null;
  if (Number.isFinite(Number(retry)) && Number(retry) >= 0) return now + Number(retry) * 1000;
  const date = Date.parse(retry);
  return Number.isFinite(date) ? date : null;
}
