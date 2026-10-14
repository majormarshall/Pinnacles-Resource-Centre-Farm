// Pinnacles Farm Service Worker
const CACHE = 'pinnacles-v1';
const STATIC = [
  '/',
  '/css/style.css',
  '/css/chatbot.css',
  '/js/app.js',
  '/js/chatbot.js',
  '/images/farm_hero.png',
  '/images/logo.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network first for API, cache first for static
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })));
  } else {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
  }
});
