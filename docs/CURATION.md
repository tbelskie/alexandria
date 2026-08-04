# Curation handbook

Alexandria is a working collection. Incompleteness is intentional.

## Volume YAML

| Field | Purpose |
|---|---|
| `id` | Stable slug (`shelley-frankenstein`) |
| `gutenbergId` | Project Gutenberg ebook number |
| `status` | `draft` (hidden) or `ready` (on shelf) |
| `blurb` | Editorial voice — why this earns a place |
| `shelf` | One of the ids in `shelves.yaml` |
| `cloth` | Board / spine / foil / endpaper colors |
| `spineMotif` | Motif key for generated cover art |
| `readerTheme` | Per-volume typography and paper |
| `samplePages` | Inspection / fallback front matter |

## Pipeline

```bash
npm run covers          # SVG covers from cloth + motif
npm run catalog:fetch   # EPUB → catalog/epubs + public/epubs
npm run catalog:build   # → src/catalog/generated.json
```

## Ready gate

Nothing ships to the shelf until a curator sets `status: ready`. Draft freely; promote sparingly.

## Seed collection

Pride and Prejudice, Frankenstein, Dracula, The Odyssey, Adventures of Sherlock Holmes, A Tale of Two Cities, Jane Eyre, The Prince, Walden, Leaves of Grass, Metamorphosis, Alice’s Adventures in Wonderland.
