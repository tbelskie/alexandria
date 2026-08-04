import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
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
      writeFileSync(
        resolve(dist, 'sw.js'),
        `/* Alexandria service worker — app shell + on-demand EPUB cache */
const SHELL = 'alexandria-shell-v1';
const BOOKS = 'alexandria-epubs-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(['./', './index.html', './manifest.webmanifest']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.includes('/epubs/') && url.pathname.endsWith('.epub')) {
    event.respondWith(
      caches.open(BOOKS).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      })
    );
    return;
  }
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
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
  plugins: [react(), alexandriaEpubs(), alexandriaPwa()],
})
