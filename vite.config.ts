import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createReadStream, statSync } from 'node:fs'

function alexandriaEpubs(): Plugin {
  const epubRoot = resolve(__dirname, 'corpus/epubs')
  return {
    name: 'alexandria-epubs',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/epubs/')) return next()
        const name = decodeURIComponent(req.url.replace(/^\/epubs\//, '').split('?')[0] ?? '')
        if (!name.endsWith('.epub') || name.includes('..')) {
          res.statusCode = 400
          res.end('Bad request')
          return
        }
        const file = resolve(epubRoot, name)
        if (!file.startsWith(epubRoot) || !existsSync(file)) {
          res.statusCode = 404
          res.end('Not found')
          return
        }
        res.setHeader('Content-Type', 'application/epub+zip')
        res.setHeader('Content-Length', String(statSync(file).size))
        createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      if (!existsSync(epubRoot)) return
      const dest = resolve(__dirname, 'dist/epubs')
      mkdirSync(dest, { recursive: true })
      cpSync(epubRoot, dest, { recursive: true })
    },
  }
}

function alexandriaPwa(): Plugin {
  return {
    name: 'alexandria-pwa',
    closeBundle() {
      const dist = resolve(__dirname, 'dist')
      writeFileSync(
        resolve(dist, 'manifest.webmanifest'),
        JSON.stringify(
          {
            name: 'Alexandria',
            short_name: 'Alexandria',
            description: 'A curated open digital library — enter, pull a volume, read.',
            theme_color: '#0e1016',
            background_color: '#0e1016',
            display: 'standalone',
            start_url: './',
            icons: [
              {
                src: 'favicon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any maskable',
              },
            ],
          },
          null,
          2,
        ),
      )
      // Kill-switch SW: clears legacy cache-first shells that white-screened deploys.
      writeFileSync(
        resolve(dist, 'sw.js'),
        `/* Alexandria SW v2 — unregister legacy caches; EPUB cache only */
const BOOKS = 'alexandria-epubs-v2';
const LEGACY = ['alexandria-shell-v1', 'alexandria-epubs-v1'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => LEGACY.includes(k)).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => LEGACY.includes(k)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!(url.pathname.includes('/epubs/') && url.pathname.endsWith('.epub'))) return;
  event.respondWith(
    caches.open(BOOKS).then(async (cache) => {
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const res = await fetch(event.request);
      if (res.ok) cache.put(event.request, res.clone());
      return res;
    })
  );
});
`,
      )
    },
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `  <link rel="manifest" href="./manifest.webmanifest" />\n  </head>`,
      )
    },
  }
}

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1200,
  },
  plugins: [react(), tailwindcss(), alexandriaEpubs(), alexandriaPwa()],
})
