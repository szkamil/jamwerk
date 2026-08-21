// src/pwa.ts — installable-app layer: manifest, icons, service worker.
import { Hono } from 'hono';
import { ICON_PNGS } from './icons';
import type { AppEnv } from './types';

const MANIFEST = JSON.stringify({
  name: 'JamWerk',
  short_name: 'JamWerk',
  description: 'Find a dep, fill a gig — local paid dep booking for musicians.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#16161d',
  theme_color: '#16161d',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
});

// Network-first for navigations so deploys land immediately; the last good
// shell is cached as an offline fallback. API calls are never intercepted.
const SW = `const VERSION = 'jamwerk-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put('/', copy));
        return res;
      })
      .catch(() => caches.match('/'))
  );
});
`;

function pngResponse(b64: string): Response {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
  });
}

const pwa = new Hono<AppEnv>();

pwa.get('/manifest.webmanifest', (c) =>
  c.body(MANIFEST, 200, { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' })
);

pwa.get('/sw.js', (c) =>
  c.body(SW, 200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' })
);

pwa.get('/icons/:file', (c) => {
  const m = c.req.param('file').match(/^icon-(.+)\.png$/);
  const b64 = m ? ICON_PNGS[m[1]] : undefined;
  if (!b64) return c.json({ error: 'Not found' }, 404);
  return pngResponse(b64);
});

pwa.get('/favicon.ico', (c) => pngResponse(ICON_PNGS['192']));

export default pwa;
