const CACHE = 'nimbus-habor-v8';
const ASSETS = ['.', 'index.html', 'privacy.html', 'terms.html', 'cookies.html', 'mission.html', 'styles.css', 'app.js', 'manifest.json'];
const APP_SHELL = new URL('index.html', self.location.href).href;

function assetUrl(path) {
  return new URL(path, self.location.href).href;
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(assetUrl))));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request).catch(() => caches.match(APP_SHELL)))
  );
});
