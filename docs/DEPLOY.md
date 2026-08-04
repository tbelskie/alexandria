# Deploy

Alexandria is a static site.

## GitHub Pages

Workflow: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

1. Push to `main`
2. Actions builds (`catalog:fetch` + `build`) and deploys to GitHub Pages
3. Enable Pages in repo settings → Source: GitHub Actions

For project sites, set `base` in `vite.config.ts` to `/<repo>/` if needed. Default `./` works for user/org pages and many hosts.

## Cloudflare Pages / Netlify

Build command:

```bash
npm ci && npm run catalog:fetch && npm run build
```

Publish directory: `dist`

EPUBs live in `corpus/epubs` (downloaded by `catalog:fetch`) and are copied into `dist/epubs` at build time.

## Offline

`sw.js` caches the app shell and stores EPUBs on first open under `alexandria-epubs-v1`.
