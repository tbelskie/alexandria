# Alexandria

**What Project Gutenberg’s front door should have been** — a curated digital library people actually want to enter.

Free. Open source. No ads. No accounts. A working collection of public-domain classics with a museum-quality shelf and a reading ritual that doesn’t feel like an archive dump.

> Enter the library. Pull a volume. Read.

## Mission

Gutenberg and the Internet Archive solved **access**. Alexandria aims at **desire**: hand-curated volumes, crafted bindings, and a reader that continues the book’s physical language instead of dumping you into generic EPUB chrome.

This is not a search engine over seventy thousand files. Only volumes marked `status: ready` appear on the shelf.

## Quick start

```bash
npm install
npm run catalog:build
npm run catalog:fetch   # downloads EPUBs for ready/draft volumes
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Curation (hands-on)

You own taste. The app only renders what you bless.

```text
catalog/
  shelves.yaml
  volumes/*.yaml
  covers/
corpus/
  epubs/           # downloaded by catalog:fetch (gitignored)
```

1. Add or edit a volume YAML under `catalog/volumes/`
2. Set `status: draft` while polishing
3. Run `npm run catalog:fetch` to pull the Gutenberg EPUB
4. Flip to `status: ready` when the volume earns a place on the shelf
5. Run `npm run catalog:build`

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/CURATION.md](docs/CURATION.md).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Local library |
| `npm run build` | Production static build |
| `npm run catalog:build` | Compile YAML catalog → `src/catalog/generated.json` |
| `npm run catalog:fetch` | Download EPUBs from Project Gutenberg |
| `npm run preview` | Preview production build |

## Stack

- Vite + React + TypeScript
- Three.js shelf (original; Complete Shelf craft bar, not their source)
- Custom EPUB reader (JSZip parse + paginated render surface)
- PWA for offline re-reading
- Static deploy (GitHub Pages)

## License

MIT — see [LICENSE](LICENSE).

Public-domain texts via [Project Gutenberg](https://www.gutenberg.org/). Gutenberg is a trademark of Project Gutenberg Literary Archive Foundation; Alexandria is an independent open-source project and is not affiliated with Project Gutenberg.
