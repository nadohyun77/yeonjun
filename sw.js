// 오프라인에서도 게임을 할 수 있도록 파일을 저장해 둡니다.
// 게임 파일을 바꾸면 CACHE 버전을 올려 주세요.
const CACHE = 'minigames-v1';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/games/balloon.js',
  'js/games/memory.js',
  'js/games/numbers.js',
  'js/games/reaction.js',
  'js/games/color.js',
  'js/games/tictactoe.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 저장된 파일을 먼저 보여 주고, 뒤에서 새 버전으로 갱신합니다.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
