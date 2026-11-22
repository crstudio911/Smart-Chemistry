const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex'
};
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '') return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
    if (url.pathname.endsWith('/')) {
      const index = await env.ASSETS.fetch(new Request(new URL(url.pathname + 'index.html', url), { method: 'GET' }));
      if (index.ok) return Response.redirect(new URL(url.pathname + 'index.html' + url.search, url).href, 302);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    const page = await env.ASSETS.fetch(new Request(new URL('/404/404.html', url), { method: 'GET' }));
    const accept = request.headers.get('Accept') || '';
    if (!page.ok || (!accept.includes('text/html') && request.headers.get('Sec-Fetch-Mode') !== 'navigate')) return new Response(null, { status: 404, headers: HEADERS });
    return new Response(request.method === 'HEAD' ? null : page.body, { status: 404, headers: HEADERS });
  }
};
