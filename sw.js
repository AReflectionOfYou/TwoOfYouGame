/* Two of You: service worker.
 * Caches the app shell so the game works offline after the first visit.
 * Requests go to the network first and fall back to the cache when offline.
 * Add any new app file to SHELL so it is available offline. */
'use strict';

var CACHE = 'two-of-you-v2';
var SHELL = [
  './',
  'index.html',
  'css/styles.css',
  'css/tile-back.css',
  'js/audio.js',
  'js/photos.js',
  'js/layout.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];
var SHELL_URLS = new Set(SHELL.map(function (p) { return new URL(p, self.location).href; }));

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Network first, so updates show up as soon as they are published; the
  // cache is refreshed on every successful fetch and used when offline.
  event.respondWith(
    fetch(req)
      .then(function (res) {
        if (res.ok && SHELL_URLS.has(stripQuery(req.url))) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(stripQuery(req.url), copy); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (cached) {
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match('index.html');
          return Response.error();
        });
      })
  );
});

function stripQuery(url) {
  var u = new URL(url);
  u.search = '';
  u.hash = '';
  return u.href;
}
