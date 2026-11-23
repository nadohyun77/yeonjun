// 오프라인에서도 게임을 할 수 있도록 파일을 저장해 둡니다.
// 게임 파일을 바꾸면 CACHE 버전을 올려 주세요.
const CACHE = 'minigames-v3';
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
  // 브라우저 캐시를 건너뛰고 항상 최신 파일을 받아 저장
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 인터넷이 되면 항상 최신 파일을, 안 되면 저장된 파일을 보여 줍니다.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
