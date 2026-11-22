const CACHE = 'sc-offline-17';
const FONTS = 'sc-fonts-1';
const FILES = ['404/dis.html', '404/secured.html', '404/time.html', '404/err.html', '404/update.html', '404/no.html', '404/404.css', '404/404.js', 'one.css', 'one.js', 'img/logo.png'];
const at = path => new URL(path, self.registration.scope).href;
const clean = href => href.split('?')[0].split('#')[0];
async function fill(force) {
  const c = await caches.open(CACHE);
  await Promise.allSettled(FILES.map(async f => {
    if (!force && await c.match(at(f))) return;
    const r = await fetch(at(f), { cache: 'no-cache' });
    if (r.ok) await c.put(at(f), r);
  }));
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
  if (req.mode === 'navigate') {
    const offline = at('404/dis.html');
    e.respondWith(fetch(req).then(r => { e.waitUntil(fill(false)); return r; }).catch(async () => {
      if (clean(url.href) === offline) return (await caches.match(offline)) || Response.error();
      if (FILES.some(f => clean(url.href) === at(f))) return (await caches.match(clean(url.href))) || Response.error();
      return Response.redirect(offline + '?back=' + encodeURIComponent(url.pathname + url.search + url.hash), 302);
    }));
    return;
  }
  if (FILES.some(f => clean(url.href) === at(f))) e.respondWith(fetch(req).catch(async () => (await caches.match(req, { ignoreSearch: true })) || Response.error()));
});
