import * as THREE from 'three'

export function makeClothTexture(base: string, foil: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = foil
  ctx.globalAlpha = 0.07
  ctx.lineWidth = 1
  for (let y = 0; y < 256; y += 3) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(256, y)
    ctx.stroke()
  }
  for (let x = 0; x < 256; x += 4) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 256)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function makePaperTexture(paper: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, 256, 256)
  const img = ctx.getImageData(0, 0, 256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18
    img.data[i] = Math.min(255, Math.max(0, img.data[i] + n))
    img.data[i + 1] = Math.min(255, Math.max(0, img.data[i + 1] + n))
    img.data[i + 2] = Math.min(255, Math.max(0, img.data[i + 2] + n))
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function makeCoverTexture(
  title: string,
  author: string,
  board: string,
  foil: string,
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 768
  const ctx = c.getContext('2d')!
  const grd = ctx.createLinearGradient(0, 0, 512, 768)
  grd.addColorStop(0, board)
  grd.addColorStop(1, '#0a0c10')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, 512, 768)
  ctx.strokeStyle = foil
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 2
  ctx.strokeRect(28, 28, 456, 712)
  ctx.globalAlpha = 0.2
  ctx.strokeRect(40, 40, 432, 688)
  ctx.globalAlpha = 1
  ctx.fillStyle = foil
  ctx.textAlign = 'center'
  ctx.font = '600 28px Georgia, serif'
  wrapText(ctx, title, 256, 480, 380, 34)
  ctx.globalAlpha = 0.75
  ctx.font = '18px Georgia, serif'
  ctx.fillText(author, 256, 560)
  ctx.globalAlpha = 0.45
  ctx.font = '12px Georgia, serif'
  ctx.letterSpacing = '4px'
  ctx.fillText('ALEXANDRIA', 256, 680)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ')
  let line = ''
  let yy = y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy)
      line = word
      yy += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, yy)
}
