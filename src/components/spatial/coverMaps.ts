import * as THREE from 'three'
import type { FoilKey } from '../../styles/tokens'
import { AlexandriaTokens } from '../../styles/tokens'

export type MotifId = 'chi-ro-border' | 'palmette' | 'concentric' | 'laurel' | 'wave-anchor'

export interface CoverPaintInput {
  title: string
  subtitle?: string
  author: string
  binding: string
  foilKey: FoilKey
  motif: MotifId
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function toTex(c: HTMLCanvasElement, anisotropy = 8) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = anisotropy
  t.needsUpdate = true
  return t
}

/** Procedural leather / cloth grain albedo */
export function makeLeatherMap(base: string): THREE.CanvasTexture {
  const S = 512
  const c = canvas(S, S)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = base
  ctx.fillRect(0, 0, S, S)
  const img = ctx.getImageData(0, 0, S, S)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 28
    const pore = Math.random() > 0.992 ? -40 : 0
    img.data[i] = clamp(img.data[i] + n + pore)
    img.data[i + 1] = clamp(img.data[i + 1] + n * 0.9 + pore)
    img.data[i + 2] = clamp(img.data[i + 2] + n * 0.75 + pore)
  }
  ctx.putImageData(img, 0, 0)
  ctx.globalAlpha = 0.04
  for (let i = 0; i < 80; i++) {
    ctx.strokeStyle = '#fff'
    ctx.beginPath()
    const y = Math.random() * S
    ctx.moveTo(0, y)
    for (let x = 0; x < S; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  const tex = toTex(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

export function makeNormalMap(): THREE.CanvasTexture {
  const c = canvas(512, 512)
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(512, 512)
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4
      const nx = 128 + (Math.random() - 0.5) * 18
      const ny = 128 + (Math.random() - 0.5) * 18
      img.data[i] = nx
      img.data[i + 1] = ny
      img.data[i + 2] = 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/**
 * Foil mask: R = foil metal, G = emboss depth (deboss into leather).
 * Painted to evoke heirloom Bible / classical board bindings.
 */
export function makeFoilMask(input: CoverPaintInput): THREE.CanvasTexture {
  const W = 512
  const H = 768
  const c = canvas(W, H)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)

  const foil = AlexandriaTokens.foils[input.foilKey]

  // Emboss channel drawn in green; foil in red — we composite into RG
  const layer = canvas(W, H)
  const l = layer.getContext('2d')!
  l.fillStyle = '#000'
  l.fillRect(0, 0, W, H)
  l.strokeStyle = '#fff'
  l.fillStyle = '#fff'
  l.lineCap = 'round'
  l.lineJoin = 'round'

  drawMotifFrame(l, input.motif, W, H)

  // Title block
  l.textAlign = 'center'
  l.fillStyle = '#fff'
  if (input.motif === 'chi-ro-border') {
    // crown
    l.font = '700 36px Cinzel, serif'
    l.fillText('✝', W / 2, H * 0.48)
    l.font = '600 42px "Cinzel Decorative", Cinzel, serif'
    l.fillText('THE', W / 2, H * 0.54)
    l.font = '700 78px "Cinzel Decorative", Cinzel, serif'
    wrapTitle(l, 'HOLY BIBLE', W / 2, H * 0.6, W * 0.7, 84)
    // flourish under
    l.lineWidth = 3
    l.beginPath()
    l.moveTo(W * 0.35, H * 0.68)
    l.quadraticCurveTo(W * 0.5, H * 0.72, W * 0.65, H * 0.68)
    l.stroke()
  } else {
    l.font = '600 56px Cinzel, "Cormorant Garamond", serif'
    wrapTitle(l, input.title.toUpperCase(), W / 2, H * 0.58, W * 0.72, 64)
    if (input.subtitle) {
      l.font = 'italic 28px "EB Garamond", serif'
      l.globalAlpha = 0.85
      wrapTitle(l, input.subtitle, W / 2, H * 0.66, W * 0.65, 34)
      l.globalAlpha = 1
    }
    l.font = '500 30px Cinzel, serif'
    l.globalAlpha = 0.9
    l.fillText(input.author.toUpperCase(), W / 2, H * 0.78)
    l.globalAlpha = 1
  }

  // Convert white drawing → R foil + G emboss
  const src = l.getImageData(0, 0, W, H)
  const out = ctx.createImageData(W, H)
  for (let i = 0; i < src.data.length; i += 4) {
    const v = src.data[i] // white drawing
    const a = src.data[i + 3]
    const m = (v / 255) * (a / 255)
    out.data[i] = Math.round(m * 255) // R foil
    out.data[i + 1] = Math.round(Math.min(1, m * 1.15) * 200) // G emboss
    out.data[i + 2] = 0
    out.data[i + 3] = 255
  }
  ctx.putImageData(out, 0, 0)

  // Soft dilate glow for foil catchlights
  void foil
  return toTex(c)
}

export function makeSpineMask(input: CoverPaintInput): THREE.CanvasTexture {
  const W = 256
  const H = 768
  const c = canvas(W, H)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#fff'
  ctx.fillStyle = '#fff'
  ctx.lineWidth = 3

  // Raised bands
  const bands = [0.12, 0.28, 0.44, 0.6, 0.76, 0.9]
  for (const b of bands) {
    ctx.fillRect(24, H * b - 3, W - 48, 6)
  }

  ctx.save()
  ctx.translate(W / 2, H * 0.38)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.font = '600 36px Cinzel, serif'
  ctx.fillText(input.title.toUpperCase(), 0, 10)
  ctx.restore()

  ctx.save()
  ctx.translate(W / 2, H * 0.62)
  ctx.rotate(-Math.PI / 2)
  ctx.font = '500 28px Cinzel, serif'
  ctx.fillText(input.author.toUpperCase(), 0, 8)
  ctx.restore()

  // Motif stamps
  ctx.lineWidth = 2
  drawSpineMotif(ctx, input.motif, W / 2, H * 0.18, 36)
  drawSpineMotif(ctx, input.motif, W / 2, H * 0.82, 36)

  const img = ctx.getImageData(0, 0, W, H)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = img.data[i]
    img.data[i] = v
    img.data[i + 1] = Math.round(v * 0.85)
    img.data[i + 2] = 0
  }
  ctx.putImageData(img, 0, 0)
  return toTex(c)
}

function drawMotifFrame(
  ctx: CanvasRenderingContext2D,
  motif: MotifId,
  W: number,
  H: number,
) {
  const m = 70
  ctx.lineWidth = 4

  // Outer plate
  ctx.strokeRect(m, m, W - m * 2, H - m * 2)
  ctx.lineWidth = 2
  ctx.strokeRect(m + 22, m + 22, W - (m + 22) * 2, H - (m + 22) * 2)

  if (motif === 'chi-ro-border' || motif === 'palmette') {
    // Ornate scroll corners + vine border
    const inset = m + 40
    ornateBorder(ctx, inset, inset, W - inset * 2, H - inset * 2, motif)
  } else if (motif === 'concentric') {
    ctx.lineWidth = 3
    for (let i = 0; i < 5; i++) {
      const pad = m + 50 + i * 28
      ctx.beginPath()
      ctx.ellipse(W / 2, H * 0.36, W / 2 - pad, H * 0.18 - i * 8, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(W / 2, H * 0.36, 28, 0, Math.PI * 2)
    ctx.stroke()
  } else if (motif === 'laurel') {
    laurelWreath(ctx, W / 2, H * 0.34, 160)
    ctx.strokeRect(m + 48, m + 48, W - (m + 48) * 2, H - (m + 48) * 2)
  } else if (motif === 'wave-anchor') {
    waveFrame(ctx, m + 36, m + 36, W - (m + 36) * 2, H - (m + 36) * 2)
    // anchor
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(W / 2, H * 0.28)
    ctx.lineTo(W / 2, H * 0.42)
    ctx.moveTo(W / 2 - 40, H * 0.36)
    ctx.lineTo(W / 2 + 40, H * 0.36)
    ctx.moveTo(W / 2 - 50, H * 0.42)
    ctx.quadraticCurveTo(W / 2, H * 0.5, W / 2 + 50, H * 0.42)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(W / 2, H * 0.26, 16, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function ornateBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  motif: MotifId,
) {
  ctx.lineWidth = 2.5
  const step = 28
  // Top / bottom vines
  for (let side = 0; side < 2; side++) {
    const yy = side === 0 ? y : y + h
    ctx.beginPath()
    for (let i = 0; i <= w; i += step) {
      const px = x + i
      const py = yy + Math.sin(i * 0.2) * (side === 0 ? 10 : -10)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
  // Side vines
  for (let side = 0; side < 2; side++) {
    const xx = side === 0 ? x : x + w
    ctx.beginPath()
    for (let i = 0; i <= h; i += step) {
      const py = y + i
      const px = xx + Math.sin(i * 0.2) * (side === 0 ? 10 : -10)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }

  // Corner fleur / palmette
  const corners: [number, number][] = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ]
  for (const [cx, cy] of corners) {
    if (motif === 'palmette') palmette(ctx, cx, cy, 26)
    else fleur(ctx, cx, cy, 22)
  }

  // Inner greek key for republic
  if (motif === 'palmette') {
    greekKey(ctx, x + 36, y + 36, w - 72, h - 72, 16)
  }
}

function fleur(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - s)
  ctx.quadraticCurveTo(x + s, y - s * 0.2, x, y + s * 0.3)
  ctx.quadraticCurveTo(x - s, y - s * 0.2, x, y - s)
  ctx.stroke()
}

function palmette(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + i * s * 0.35, y - s * 0.6, x + i * s * 0.15, y - s)
    ctx.stroke()
  }
}

function greekKey(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  s: number,
) {
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, w, h)
  ctx.beginPath()
  for (let i = 0; i < w; i += s * 2) {
    const px = x + i
    ctx.moveTo(px, y)
    ctx.lineTo(px + s, y)
    ctx.lineTo(px + s, y + s)
    ctx.lineTo(px + s * 2, y + s)
  }
  ctx.stroke()
}

function laurelWreath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.lineWidth = 2.5
  for (const side of [-1, 1]) {
    ctx.beginPath()
    for (let i = 0; i <= 12; i++) {
      const t = i / 12
      const ang = -Math.PI * 0.75 + t * Math.PI * 1.5
      const x = cx + Math.cos(ang) * r * side * 0.35 + side * r * 0.35
      const y = cy + Math.sin(ang) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      // leaf
      if (i % 2 === 0) {
        ctx.moveTo(x, y)
        ctx.quadraticCurveTo(x + side * 18, y - 8, x + side * 6, y - 22)
        ctx.moveTo(x, y)
      }
    }
    ctx.stroke()
  }
}

function waveFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.lineWidth = 3
  ctx.strokeRect(x, y, w, h)
  ctx.beginPath()
  for (let i = 0; i <= w; i += 8) {
    const px = x + i
    const py = y + 18 + Math.sin(i * 0.12) * 6
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.beginPath()
  for (let i = 0; i <= w; i += 8) {
    const px = x + i
    const py = y + h - 18 + Math.sin(i * 0.12 + 1) * 6
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
}

function drawSpineMotif(
  ctx: CanvasRenderingContext2D,
  motif: MotifId,
  x: number,
  y: number,
  s: number,
) {
  ctx.save()
  ctx.translate(x, y)
  if (motif === 'palmette') palmette(ctx, 0, 0, s)
  else if (motif === 'laurel') {
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2)
    ctx.stroke()
  } else if (motif === 'chi-ro-border') {
    ctx.beginPath()
    ctx.moveTo(0, -s)
    ctx.lineTo(0, s)
    ctx.moveTo(-s * 0.6, -s * 0.3)
    ctx.lineTo(s * 0.6, -s * 0.3)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function wrapTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lh: number,
) {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const t = line ? `${line} ${word}` : word
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line)
      line = word
    } else line = t
  }
  if (line) lines.push(line)
  const start = y - ((lines.length - 1) * lh) / 2
  lines.forEach((l, i) => ctx.fillText(l, x, start + i * lh))
}

function clamp(n: number) {
  return Math.max(0, Math.min(255, n))
}
