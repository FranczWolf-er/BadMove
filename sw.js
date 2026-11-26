// Service worker: aplikace běží i offline.
// Strategie „nejdřív síť“: online se vždy načte aktuální verze, mezipaměť slouží jen bez připojení.
// Při každé změně souborů zvyšte číslo verze, aby zařízení zobrazila upozornění na novou verzi.
const CACHE = 'badmove-v7';
const FILES = ['./', 'index.html', 'config.js', 'cloud.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  // cache: 'reload' obejde HTTP cache prohlížeče, aby se neuložila stará verze
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const key = req.mode === 'navigate' ? './' : req.url.split('?')[0];
  e.respondWith(
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
        return res;
      })
      .catch(() => caches.match(key, { ignoreSearch: true }).then(r => r || caches.match(req, { ignoreSearch: true })))
  );
});
