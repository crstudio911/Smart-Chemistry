const CACHE = 'sc-offline-13';
const FILES = ['404/dis.html', '404/404.css', '404/404.js', 'one.css', 'one.js', 'img/logo.png'];
const at = path => new URL(path, self.registration.scope).href;
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(at))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    const offline = at('404/dis.html');
    e.respondWith(fetch(req).catch(async () => {
      if (url.href.split('?')[0] === offline) return (await caches.match(offline)) || Response.error();
      return Response.redirect(offline + '?back=' + encodeURIComponent(url.pathname + url.search + url.hash), 302);
    }));
    return;
  }
  if (FILES.some(f => url.href.split('?')[0] === at(f))) e.respondWith(fetch(req).catch(async () => (await caches.match(req, { ignoreSearch: true })) || Response.error()));
});
