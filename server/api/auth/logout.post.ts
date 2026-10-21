export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'session');
  if (token) {
    const [{ query }, { hashSessionToken }] = await Promise.all([
      import('#server/utils/db'),
      import('#server/utils/session'),
    ]);
    await query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [
      hashSessionToken(token),
    ]);
  }
  deleteCookie(event, 'session', { httpOnly: true, sameSite: 'lax', path: '/' });
  return { ok: true };
});
