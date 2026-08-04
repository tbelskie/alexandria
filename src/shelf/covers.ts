import type { Volume } from '../catalog/types'

function hex(c: string) {
  return c
}

/** Museum-grade cover / spine / back canvases — covers are the product. */
export function paintCoverSet(volume: Volume): {
  front: THREE_Canvas
  spine: THREE_Canvas
  back: THREE_Canvas
} {
  const W = 1024
  const H = 1536
  const SW = 384
  const SH = 1536

  return {
    front: paintFront(volume, W, H),
    spine: paintSpine(volume, SW, SH),
    back: paintBack(volume, W, H),
  }
}

type THREE_Canvas = HTMLCanvasElement

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function paintFront(volume: Volume, w: number, h: number): THREE_Canvas {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')!
  const board = volume.cloth.board
  const foil = volume.cloth.foil

  // Base cloth field
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, lighten(board, 12))
  g.addColorStop(0.45, board)
  g.addColorStop(1, darken(board, 18))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  drawClothWeave(ctx, w, h, foil, 0.045)

  // Debossed panel
  const m = 72
  ctx.strokeStyle = withAlpha(foil, 0.28)
  ctx.lineWidth = 3
  ctx.strokeRect(m, m, w - m * 2, h - m * 2)
  ctx.strokeStyle = withAlpha(foil, 0.12)
  ctx.lineWidth = 1.5
  ctx.strokeRect(m + 18, m + 18, w - (m + 18) * 2, h - (m + 18) * 2)

  // Motif
  ctx.save()
  ctx.translate(w / 2, h * 0.38)
  drawMotif(ctx, volume.spineMotif, foil, 220)
  ctx.restore()

  // Title block
  ctx.fillStyle = foil
  ctx.textAlign = 'center'
  ctx.font = '600 64px "Cormorant Garamond", Georgia, serif'
  wrapCentered(ctx, volume.title.toUpperCase(), w / 2, h * 0.62, w - 200, 72)

  if (volume.subtitle) {
    ctx.globalAlpha = 0.72
    ctx.font = 'italic 34px "Cormorant Garamond", Georgia, serif'
    wrapCentered(ctx, volume.subtitle, w / 2, h * 0.72, w - 220, 42)
    ctx.globalAlpha = 1
  }

  ctx.globalAlpha = 0.7
  ctx.font = '500 30px "Cormorant Garamond", Georgia, serif'
  ctx.fillText(volume.authors.join(' · ').toUpperCase(), w / 2, h * 0.82)
  ctx.globalAlpha = 0.4
  ctx.font = '500 22px "Source Serif 4", Georgia, serif'
  ctx.letterSpacing = '0.35em'
  ctx.fillText('ALEXANDRIA', w / 2, h * 0.9)
  ctx.letterSpacing = '0px'

  // Soft vignette
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.28)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)

  return c
}

function paintSpine(volume: Volume, w: number, h: number): THREE_Canvas {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')!
  const spine = volume.cloth.spine
  const foil = volume.cloth.foil

  const g = ctx.createLinearGradient(0, 0, w, 0)
  g.addColorStop(0, darken(spine, 10))
  g.addColorStop(0.5, lighten(spine, 8))
  g.addColorStop(1, darken(spine, 14))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  drawClothWeave(ctx, w, h, foil, 0.05)

  // Horizontal rules
  ctx.strokeStyle = withAlpha(foil, 0.55)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(40, h * 0.18)
  ctx.lineTo(w - 40, h * 0.18)
  ctx.moveTo(40, h * 0.82)
  ctx.lineTo(w - 40, h * 0.82)
  ctx.stroke()

  // Vertical title
  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = foil
  ctx.textAlign = 'center'
  ctx.font = '600 42px "Cormorant Garamond", Georgia, serif'
  ctx.fillText(volume.title.toUpperCase(), 0, 8)
  ctx.restore()

  // Motif stamp top
  ctx.save()
  ctx.translate(w / 2, h * 0.12)
  drawMotif(ctx, volume.spineMotif, foil, 48)
  ctx.restore()

  return c
}

function paintBack(volume: Volume, w: number, h: number): THREE_Canvas {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')!
  const board = volume.cloth.board
  const foil = volume.cloth.foil

  ctx.fillStyle = darken(board, 6)
  ctx.fillRect(0, 0, w, h)
  drawClothWeave(ctx, w, h, foil, 0.035)

  const m = 90
  ctx.strokeStyle = withAlpha(foil, 0.2)
  ctx.lineWidth = 2
  ctx.strokeRect(m, m, w - m * 2, h - m * 2)

  ctx.fillStyle = withAlpha(foil, 0.78)
  ctx.font = 'italic 36px "Cormorant Garamond", Georgia, serif'
  ctx.textAlign = 'left'
  wrapText(ctx, volume.blurb.trim(), m + 48, m + 120, w - (m + 48) * 2, 52)

  ctx.globalAlpha = 0.35
  ctx.font = '500 22px "Source Serif 4", Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('WORKING COLLECTION · ALEXANDRIA', w / 2, h - m - 40)
  ctx.globalAlpha = 1

  return c
}

function drawMotif(ctx: CanvasRenderingContext2D, motif: string, foil: string, size: number) {
  ctx.strokeStyle = foil
  ctx.fillStyle = withAlpha(foil, 0.15)
  ctx.lineWidth = Math.max(2, size * 0.03)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (motif) {
    case 'cross': {
      const a = size * 0.12
      const b = size * 0.55
      ctx.beginPath()
      ctx.moveTo(0, -b)
      ctx.lineTo(0, b * 0.85)
      ctx.moveTo(-a * 1.6, -b * 0.35)
      ctx.lineTo(a * 1.6, -b * 0.35)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'meander': {
      const s = size * 0.18
      ctx.beginPath()
      for (let i = -2; i <= 2; i++) {
        const x = i * s * 1.4
        ctx.moveTo(x - s, -s)
        ctx.lineTo(x + s, -s)
        ctx.lineTo(x + s, s)
        ctx.lineTo(x - s * 0.2, s)
      }
      ctx.stroke()
      // spear tip
      ctx.beginPath()
      ctx.moveTo(0, -size * 0.45)
      ctx.lineTo(size * 0.12, -size * 0.15)
      ctx.lineTo(-size * 0.12, -size * 0.15)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      break
    }
    case 'cave': {
      ctx.beginPath()
      ctx.arc(0, size * 0.1, size * 0.42, Math.PI, 0)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-size * 0.42, size * 0.1)
      ctx.lineTo(-size * 0.2, size * 0.45)
      ctx.lineTo(size * 0.2, size * 0.45)
      ctx.lineTo(size * 0.42, size * 0.1)
      ctx.stroke()
      // sun / good
      ctx.beginPath()
      ctx.arc(0, -size * 0.15, size * 0.1, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'laurel': {
      for (const side of [-1, 1]) {
        ctx.beginPath()
        for (let i = 0; i < 7; i++) {
          const t = i / 6
          const y = -size * 0.4 + t * size * 0.85
          const x = side * (size * 0.12 + Math.sin(t * Math.PI) * size * 0.22)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(0, -size * 0.42)
      ctx.lineTo(0, size * 0.48)
      ctx.stroke()
      break
    }
    case 'flame': {
      ctx.beginPath()
      ctx.moveTo(0, size * 0.4)
      ctx.bezierCurveTo(size * 0.35, size * 0.1, size * 0.2, -size * 0.2, 0, -size * 0.45)
      ctx.bezierCurveTo(-size * 0.2, -size * 0.2, -size * 0.35, size * 0.1, 0, size * 0.4)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, size * 0.25)
      ctx.bezierCurveTo(size * 0.12, 0.05 * size, size * 0.08, -0.1 * size, 0, -size * 0.2)
      ctx.stroke()
      break
    }
    default: {
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

function drawClothWeave(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  foil: string,
  alpha: number,
) {
  ctx.save()
  ctx.strokeStyle = withAlpha(foil, alpha)
  ctx.lineWidth = 1
  for (let y = 0; y < h; y += 3) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  ctx.strokeStyle = withAlpha(foil, alpha * 0.7)
  for (let x = 0; x < w; x += 4) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  ctx.restore()
}

function wrapCentered(
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
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = word
    } else line = test
  }
  if (line) lines.push(line)
  const start = y - ((lines.length - 1) * lh) / 2
  lines.forEach((l, i) => ctx.fillText(l, x, start + i * lh))
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lh: number,
) {
  const words = text.split(/\s+/)
  let line = ''
  let yy = y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy)
      line = word
      yy += lh
    } else line = test
  }
  if (line) ctx.fillText(line, x, yy)
}

function parseHex(c: string): [number, number, number] {
  const h = c.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function lighten(c: string, amt: number) {
  const [r, g, b] = parseHex(hex(c))
  return `rgb(${clamp(r + amt)},${clamp(g + amt)},${clamp(b + amt)})`
}

function darken(c: string, amt: number) {
  return lighten(c, -amt)
}

function withAlpha(c: string, a: number) {
  const [r, g, b] = parseHex(c)
  return `rgba(${r},${g},${b},${a})`
}

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)))
}
