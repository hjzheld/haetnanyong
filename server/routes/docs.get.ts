export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/html; charset=utf-8');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>API Docs</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>window.onload=()=>SwaggerUIBundle({url:'/api/openapi',dom_id:'#swagger-ui',withCredentials:true,persistAuthorization:true})</script></body></html>`;
});
