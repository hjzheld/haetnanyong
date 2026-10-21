export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store');
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer');
  const { error } = getQuery(event);
  // Do not forward authorization codes or arbitrary error text to the browser page.
  const result = error === 'access_denied' ? 'canceled' : 'setup-required';
  return sendRedirect(event, `/slack/callback?result=${result}`, 303);
});
