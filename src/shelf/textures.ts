import * as THREE from 'three'
import type { Volume } from '../catalog/types'
import { paintCoverSet } from './covers'

export function makePaperTexture(paper: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const ctx = c.getContext('2d')!
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, 512, 512)
  const img = ctx.getImageData(0, 0, 512, 512)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14
    img.data[i] = Math.min(255, Math.max(0, img.data[i] + n))
    img.data[i + 1] = Math.min(255, Math.max(0, img.data[i + 1] + n))
    img.data[i + 2] = Math.min(255, Math.max(0, img.data[i + 2] + n))
  }
  ctx.putImageData(img, 0, 0)
  // page edge lines
  ctx.strokeStyle = 'rgba(80,60,40,0.08)'
  for (let y = 0; y < 512; y += 3) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(512, y)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export function makeWoodTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#2a1c12'
  ctx.fillRect(0, 0, 1024, 256)
  for (let i = 0; i < 80; i++) {
    const y = Math.random() * 256
    ctx.strokeStyle = `rgba(${60 + Math.random() * 40},${40 + Math.random() * 25},${20},0.35)`
    ctx.lineWidth = 1 + Math.random() * 2
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x < 1024; x += 16) {
      ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3)
    }
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

export function texturesForVolume(volume: Volume) {
  const set = paintCoverSet(volume)
  const toTex = (canvas: HTMLCanvasElement) => {
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    tex.needsUpdate = true
    return tex
  }
  return {
    front: toTex(set.front),
    spine: toTex(set.spine),
    back: toTex(set.back),
    paper: makePaperTexture(volume.readerTheme.paper),
  }
}
