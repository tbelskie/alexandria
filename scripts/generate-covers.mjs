import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const volumesDir = resolve(root, 'catalog/volumes')
const coversDir = resolve(root, 'catalog/covers')
const publicCovers = resolve(root, 'public/covers')
mkdirSync(coversDir, { recursive: true })
mkdirSync(publicCovers, { recursive: true })

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function motifPaths(motif, foil) {
  switch (motif) {
    case 'lightning':
      return `<path d="M110 70 L95 115 L108 115 L90 170 L130 105 L112 105 L128 70 Z" fill="${foil}" opacity="0.85"/>`
    case 'flourish':
      return `<path d="M70 120 C90 80, 130 80, 150 120 C130 100, 90 100, 70 120 M80 140 C100 160, 120 160, 140 140" stroke="${foil}" fill="none" stroke-width="2"/>`
    case 'cards':
      return `<rect x="85" y="90" width="28" height="40" rx="2" fill="none" stroke="${foil}" stroke-width="2"/><rect x="105" y="105" width="28" height="40" rx="2" fill="none" stroke="${foil}" stroke-width="2" opacity="0.7"/>`
    case 'crest':
      return `<path d="M110 80 L140 100 L140 140 L110 165 L80 140 L80 100 Z" fill="none" stroke="${foil}" stroke-width="2"/><circle cx="110" cy="120" r="10" fill="${foil}" opacity="0.5"/>`
    case 'wave':
      return `<path d="M60 130 C80 110, 100 150, 120 130 S160 110, 180 130" stroke="${foil}" fill="none" stroke-width="2"/><path d="M60 150 C80 130, 100 170, 120 150 S160 130, 180 150" stroke="${foil}" fill="none" stroke-width="1.5" opacity="0.6"/>`
    case 'pipe':
      return `<path d="M70 130 H120 C140 130, 150 115, 145 105" stroke="${foil}" fill="none" stroke-width="3" stroke-linecap="round"/><circle cx="148" cy="100" r="6" fill="none" stroke="${foil}" stroke-width="2"/>`
    case 'guillotine':
      return `<rect x="100" y="70" width="20" height="90" fill="none" stroke="${foil}" stroke-width="2"/><rect x="85" y="95" width="50" height="8" fill="${foil}" opacity="0.7"/>`
    case 'thorn':
      return `<path d="M110 70 C110 110, 90 130, 110 170 C130 130, 110 110, 110 70" fill="none" stroke="${foil}" stroke-width="2"/><path d="M110 100 L95 95 M110 120 L125 115 M110 140 L98 145" stroke="${foil}" stroke-width="1.5"/>`
    case 'crown':
      return `<path d="M70 130 L80 90 L100 120 L110 85 L120 120 L140 90 L150 130 Z" fill="none" stroke="${foil}" stroke-width="2"/>`
    case 'leaf':
      return `<path d="M110 70 C140 100, 140 140, 110 170 C80 140, 80 100, 110 70" fill="none" stroke="${foil}" stroke-width="2"/><path d="M110 80 V160" stroke="${foil}" stroke-width="1"/>`
    case 'grass':
      return `<path d="M80 160 C85 120, 90 100, 95 70 M100 160 C105 110, 110 90, 112 65 M120 160 C125 115, 130 95, 135 70" stroke="${foil}" fill="none" stroke-width="1.5"/>`
    case 'insect':
      return `<ellipse cx="110" cy="120" rx="18" ry="28" fill="none" stroke="${foil}" stroke-width="2"/><path d="M92 110 L70 95 M128 110 L150 95 M92 130 L70 145 M128 130 L150 145" stroke="${foil}" stroke-width="1.5"/>`
    case 'cross':
      return `<circle cx="110" cy="120" r="36" fill="none" stroke="${foil}" stroke-width="2"/><path d="M110 88 V158 M92 108 H128" stroke="${foil}" stroke-width="2.5"/>`
    case 'meander':
      return `<path d="M70 110 H90 V130 H110 V110 H130 V130 H150" fill="none" stroke="${foil}" stroke-width="2"/><path d="M110 85 L118 105 H102 Z" fill="${foil}"/>`
    case 'cave':
      return `<path d="M70 140 A40 40 0 0 1 150 140" fill="none" stroke="${foil}" stroke-width="2"/><circle cx="110" cy="115" r="8" fill="${foil}" opacity="0.7"/>`
    case 'laurel':
      return `<path d="M110 80 V160 M95 100 C80 120 80 140 95 155 M125 100 C140 120 140 140 125 155" fill="none" stroke="${foil}" stroke-width="2"/>`
    case 'flame':
      return `<path d="M110 160 C140 130 130 100 110 80 C90 100 80 130 110 160 Z" fill="none" stroke="${foil}" stroke-width="2"/>`
    default:
      return `<circle cx="110" cy="120" r="24" fill="none" stroke="${foil}" stroke-width="2"/>`
  }
}

function coverSvg(vol) {
  const board = vol.cloth?.board ?? '#2a3340'
  const foil = vol.cloth?.foil ?? '#c9a45c'
  const title = escapeXml(vol.title)
  const author = escapeXml((vol.authors ?? []).join(', '))
  const motif = motifPaths(vol.spineMotif, foil)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 340" width="220" height="340">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${board}"/>
      <stop offset="100%" stop-color="#0a0c10"/>
    </linearGradient>
    <pattern id="cloth" width="4" height="4" patternUnits="userSpaceOnUse">
      <path d="M0 2 H4 M2 0 V4" stroke="${foil}" stroke-opacity="0.06" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="220" height="340" fill="url(#g)"/>
  <rect width="220" height="340" fill="url(#cloth)"/>
  <rect x="14" y="14" width="192" height="312" fill="none" stroke="${foil}" stroke-opacity="0.35" stroke-width="1"/>
  <rect x="20" y="20" width="180" height="300" fill="none" stroke="${foil}" stroke-opacity="0.2" stroke-width="0.5"/>
  ${motif}
  <text x="110" y="230" text-anchor="middle" fill="${foil}" font-family="Georgia, serif" font-size="14" font-weight="600">${title.length > 28 ? title.slice(0, 26) + '…' : title}</text>
  <text x="110" y="255" text-anchor="middle" fill="${foil}" fill-opacity="0.75" font-family="Georgia, serif" font-size="10">${author}</text>
  <text x="110" y="300" text-anchor="middle" fill="${foil}" fill-opacity="0.45" font-family="Georgia, serif" font-size="8" letter-spacing="0.2em">ALEXANDRIA</text>
</svg>
`
}

const files = readdirSync(volumesDir).filter((f) => f.endsWith('.yaml'))
for (const file of files) {
  const vol = parseYaml(readFileSync(join(volumesDir, file), 'utf8'))
  const name = `${vol.id}.svg`
  const svg = coverSvg(vol)
  writeFileSync(join(coversDir, name), svg)
  writeFileSync(join(publicCovers, name), svg)
  // also rewrite cover path expectation
  console.log('cover', name)
}
console.log('Covers written to catalog/covers and public/covers')
