/**
 * Download Project Gutenberg EPUBs for catalog volumes.
 * Stores under corpus/epubs/<id>.epub (served at /epubs in dev and copied on build).
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const volumesDir = resolve(root, 'catalog/volumes')
const epubDir = resolve(root, 'corpus/epubs')

mkdirSync(epubDir, { recursive: true })

const volumes = readdirSync(volumesDir)
  .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
  .map((file) => parseYaml(readFileSync(join(volumesDir, file), 'utf8')))

async function tryFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AlexandriaLibrary/1.0 (open-source curated reader)' },
    redirect: 'follow',
  })
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 1000) return null
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) return null
  return buf
}

async function fetchVolume(vol) {
  const out = join(epubDir, `${vol.id}.epub`)
  if (existsSync(out) && statSync(out).size > 1000) {
    console.log(`skip  ${vol.id} (cached)`)
    return
  }

  const id = vol.gutenbergId
  const candidates = [
    `https://www.gutenberg.org/ebooks/${id}.epub.noimages`,
    `https://www.gutenberg.org/ebooks/${id}.epub`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}-images.epub`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.epub`,
  ]

  for (const url of candidates) {
    process.stdout.write(`get   ${vol.id} ← ${url} ... `)
    try {
      const buf = await tryFetch(url)
      if (!buf) {
        console.log('no')
        continue
      }
      writeFileSync(out, buf)
      console.log(`ok (${(buf.length / 1024).toFixed(0)} KB)`)
      return
    } catch (err) {
      console.log('err', err instanceof Error ? err.message : err)
    }
  }
  console.error(`FAIL  ${vol.id} — could not download EPUB`)
  process.exitCode = 1
}

for (const vol of volumes) {
  if (!vol.gutenbergId) {
    console.warn(`skip  ${vol.id} (no gutenbergId)`)
    continue
  }
  await fetchVolume(vol)
}

console.log('Done. EPUBs in corpus/epubs')
