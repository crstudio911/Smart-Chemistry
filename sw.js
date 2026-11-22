const CACHE = 'sc-offline-19';
const FONTS = 'sc-fonts-1';
const FILES = ['404/dis.html', '404/secured.html', '404/time.html', '404/err.html', '404/update.html', '404/no.html', '404/404.css', '404/404.js', 'one.css', 'one.js', 'img/logo.png'];
const at = path => new URL(path, self.registration.scope).href;
const clean = href => href.split('?')[0].split('#')[0];
async function fill(force) {
  const c = await caches.open(CACHE);
  await Promise.allSettled(FILES.map(async f => {
    if (!force && await c.match(at(f))) return;
    const r = await fetch(at(f), { cache: 'no-cache' });
    if (r.ok && (f.endsWith('.html') ? (r.headers.get('content-type') || '').includes('text/html') : true)) await c.put(at(f), r);
  }));
  for (const f of FILES.filter(f => f !== 'img/logo.png')) {
    if (!await c.match(at(f))) throw new Error('Missing status asset: ' + f);
  }
}
async function statusPage(page, status) {
  const href = at('404/' + page + '.html');
  let hit = await caches.match(href);
  if (!hit) {
    try { const r = await fetch(href, { cache: 'no-cache' }); if (r.ok) hit = r; } catch {}
  }
  if (!hit) return new Response('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>Smart Chemistry</title><h1>' + (page === 'dis' ? 'انقطع الاتصال بالإنترنت' : 'الصفحة دي مش موجودة') + '</h1></html>', { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  const html = (await hit.text()).replace(/\b(href|src)="([^"#]+)"/g, (all, key, value) => /^(https?:|data:|blob:)/.test(value) ? all : key + '="' + new URL(value, href).href + '"');
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
self.addEventListener('install', e => { e.waitUntil(fill(true).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit || Response.error());
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has('sc-network')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => Response.error()));
    return;
  }
  if (req.mode === 'navigate') {
    if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
    if (self.navigator?.onLine === false) {
      e.respondWith((async () => {
        const hit = FILES.some(f => clean(url.href) === at(f)) ? await caches.match(clean(url.href)) : null;
        return hit || statusPage('dis', 200);
      })());
      return;
    }
    e.respondWith(fetch(req, { cache: 'no-store' }).then(async r => {
      e.waitUntil(fill(false).catch(() => {}));
      if (r.status !== 404) return r;
      const hit = FILES.some(f => clean(url.href) === at(f)) ? await caches.match(clean(url.href)) : null;
      return hit || statusPage('no', 404);
    }).catch(async () => {
      if (FILES.some(f => clean(url.href) === at(f))) {
        const hit = await caches.match(clean(url.href));
        if (hit) return hit;
      }
      return statusPage('dis', 200);
    }));
    return;
  }
  if (FILES.some(f => clean(url.href) === at(f))) e.respondWith(fetch(req).catch(async () => (await caches.match(req, { ignoreSearch: true })) || Response.error()));
});
