import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const catalogDir = resolve(root, 'catalog')
const volumesDir = resolve(catalogDir, 'volumes')
const outFile = resolve(root, 'src/catalog/generated.json')

const shelvesDoc = parseYaml(readFileSync(resolve(catalogDir, 'shelves.yaml'), 'utf8'))
const shelves = (shelvesDoc.shelves ?? []).slice().sort((a, b) => a.sort - b.sort)

const volumes = readdirSync(volumesDir)
  .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
  .map((file) => {
    const raw = readFileSync(join(volumesDir, file), 'utf8')
    const vol = parseYaml(raw)
    vol._file = file
    return vol
  })
  .sort((a, b) => {
    const shelfA = shelves.findIndex((s) => s.id === a.shelf)
    const shelfB = shelves.findIndex((s) => s.id === b.shelf)
    if (shelfA !== shelfB) return shelfA - shelfB
    return (a.sort ?? 0) - (b.sort ?? 0)
  })

const ready = volumes.filter((v) => v.status === 'ready')
const draft = volumes.filter((v) => v.status === 'draft')

const catalog = {
  generatedAt: new Date().toISOString(),
  shelves,
  volumes: ready,
  allVolumes: volumes,
  stats: {
    ready: ready.length,
    draft: draft.length,
    total: volumes.length,
  },
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, JSON.stringify(catalog, null, 2))
console.log(
  `Catalog built: ${ready.length} ready, ${draft.length} draft → src/catalog/generated.json`,
)
