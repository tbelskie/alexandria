# Contributing to Alexandria

Alexandria is a **curated** library. Taste is gated. Code improvements are welcome; new volumes need editorial approval.

## Ways to help

1. **Craft** — shelf engine, reader typography, accessibility, performance
2. **Curation proposals** — suggest a public-domain volume with a blurb and shelf placement
3. **Covers** — improve SVG/WebP bindings for ready volumes
4. **Docs** — clarify curation and deployment

## Proposing a volume

1. Fork and add `catalog/volumes/<id>.yaml` with `status: draft`
2. Write an editorial `blurb` (your voice — not a Gutenberg subject dump)
3. Choose `shelf`, `cloth`, `spineMotif`, and `readerTheme`
4. Open a PR titled `Volume proposal: <Title>`
5. Maintainers (curators) decide keep/cut and may flip to `status: ready`

Only `ready` volumes appear on the shelf after `npm run catalog:build`.

## Development

```bash
npm install
npm run catalog:fetch   # once — downloads Gutenberg EPUBs
npm run dev
```

## Code norms

- No ads, analytics, or accounts in the core app
- No copyrighted modern books
- Prefer quiet chrome; the book is the subject
- Respect `prefers-reduced-motion`
- Do not vendor unlicensed third-party demos

## License

By contributing, you agree your code is MIT-licensed. Volume blurbs you submit should be original editorial text you can license under MIT / CC0 for the project.
