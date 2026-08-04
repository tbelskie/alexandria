import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { FoilKey } from '../../styles/tokens'
import { AlexandriaTokens } from '../../styles/tokens'
import {
  makeFoilMask,
  makeLeatherMap,
  makeNormalMap,
  makeSpineMask,
  type MotifId,
} from './coverMaps'

export interface BookVolumeSpec {
  id: string
  title: string
  subtitle?: string
  author: string
  bindingColor: string
  foilKey: FoilKey
  motif: MotifId
  width?: number
  height?: number
  depth?: number
  blurb: string
  gutenbergId: number
  readerTheme: {
    ink: string
    paper: string
    accent: string
    measureCh: number
    dropCaps: boolean
  }
}

interface Props {
  spec: BookVolumeSpec
  selected?: boolean
  coverOpen?: number
}

function maskCanvas(mask: THREE.Texture): HTMLCanvasElement | null {
  const img = mask.image as HTMLCanvasElement | ImageBitmap | HTMLImageElement | undefined
  if (!img) return null
  if (img instanceof HTMLCanvasElement) return img
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img as CanvasImageSource, 0, 0)
  return c
}

/** Bake leather grain + gold foil into a single albedo (no env-map dependent metalness). */
function makeAlbedo(
  leather: THREE.Texture,
  binding: string,
  foilHex: string,
  mask: THREE.Texture,
): THREE.CanvasTexture {
  const W = 512
  const H = 768
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!

  // Lift dark bindings so oxblood/ultramarine read on a monastery background
  ctx.fillStyle = binding
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(255, 230, 200, 0.14)'
  ctx.fillRect(0, 0, W, H)

  const leatherImg = maskCanvas(leather)
  if (leatherImg) {
    ctx.globalAlpha = 0.78
    ctx.drawImage(leatherImg, 0, 0, W, H)
    ctx.globalAlpha = 1
  } else {
    const img = ctx.getImageData(0, 0, W, H)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 18
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + n))
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n * 0.85))
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.7))
    }
    ctx.putImageData(img, 0, 0)
  }

  const mc = maskCanvas(mask)
  if (mc) {
    const foilLayer = document.createElement('canvas')
    foilLayer.width = W
    foilLayer.height = H
    const fctx = foilLayer.getContext('2d')!
    fctx.fillStyle = foilHex
    fctx.fillRect(0, 0, W, H)
    fctx.globalCompositeOperation = 'destination-in'
    const alpha = document.createElement('canvas')
    alpha.width = W
    alpha.height = H
    const actx = alpha.getContext('2d')!
    actx.drawImage(mc, 0, 0, W, H)
    const data = actx.getImageData(0, 0, W, H)
    for (let i = 0; i < data.data.length; i += 4) {
      const a = data.data[i]
      data.data[i] = 255
      data.data[i + 1] = 255
      data.data[i + 2] = 255
      data.data[i + 3] = a
    }
    actx.putImageData(data, 0, 0)
    fctx.drawImage(alpha, 0, 0)
    ctx.drawImage(foilLayer, 0, 0)

    const mixed = ctx.getImageData(0, 0, W, H)
    actx.clearRect(0, 0, W, H)
    actx.drawImage(mc, 0, 0, W, H)
    const raw = actx.getImageData(0, 0, W, H)
    for (let i = 0; i < mixed.data.length; i += 4) {
      const foilA = raw.data[i] / 255
      const emboss = raw.data[i + 1] / 255
      if (emboss > 0.05 && foilA < 0.35) {
        mixed.data[i] *= 1 - emboss * 0.32
        mixed.data[i + 1] *= 1 - emboss * 0.32
        mixed.data[i + 2] *= 1 - emboss * 0.32
      }
      if (foilA > 0.25) {
        mixed.data[i] = Math.min(255, mixed.data[i] + foilA * 36)
        mixed.data[i + 1] = Math.min(255, mixed.data[i + 1] + foilA * 28)
        mixed.data[i + 2] = Math.min(255, mixed.data[i + 2] + foilA * 8)
      }
    }
    ctx.putImageData(mixed, 0, 0)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

function boardMaterial(
  bindingColor: string,
  foilBase: string,
  leather: THREE.Texture,
  mask: THREE.Texture,
  normal: THREE.Texture,
): THREE.MeshStandardMaterial {
  try {
    const albedo = makeAlbedo(leather, bindingColor, foilBase, mask)
    // Foil mask R → emissiveMap so gold catches light without env maps
    const em = document.createElement('canvas')
    em.width = 512
    em.height = 768
    const ectx = em.getContext('2d')!
    ectx.fillStyle = '#000'
    ectx.fillRect(0, 0, 512, 768)
    const mc = maskCanvas(mask)
    if (mc) {
      ectx.drawImage(mc, 0, 0, 512, 768)
      const d = ectx.getImageData(0, 0, 512, 768)
      for (let i = 0; i < d.data.length; i += 4) {
        const a = d.data[i]
        d.data[i] = a
        d.data[i + 1] = Math.round(a * 0.85)
        d.data[i + 2] = Math.round(a * 0.35)
        d.data[i + 3] = 255
      }
      ectx.putImageData(d, 0, 0)
    }
    const emissiveMap = new THREE.CanvasTexture(em)
    emissiveMap.colorSpace = THREE.SRGBColorSpace
    emissiveMap.needsUpdate = true

    return new THREE.MeshStandardMaterial({
      map: albedo,
      normalMap: normal,
      emissiveMap,
      emissive: new THREE.Color(foilBase),
      emissiveIntensity: 0.55,
      color: '#ffffff',
      metalness: 0.15,
      roughness: 0.52,
      normalScale: new THREE.Vector2(0.32, 0.32),
    })
  } catch {
    return new THREE.MeshStandardMaterial({
      color: bindingColor,
      metalness: 0.08,
      roughness: 0.68,
    })
  }
}

export function BookCoverMesh({ spec, selected = false, coverOpen = 0 }: Props) {
  const group = useRef<THREE.Group>(null)
  const coverPivot = useRef<THREE.Group>(null)

  const w = (spec.width ?? 0.42) * 0.92
  const h = (spec.height ?? 0.64) * 0.92
  const d = (spec.depth ?? 0.07) * 0.95
  const board = 0.012
  const foil = AlexandriaTokens.foils[spec.foilKey]

  const materials = useMemo(() => {
    const solid = new THREE.MeshStandardMaterial({
      color: spec.bindingColor,
      metalness: 0.1,
      roughness: 0.7,
    })
    try {
      const input = {
        title: spec.title,
        subtitle: spec.subtitle,
        author: spec.author,
        binding: spec.bindingColor,
        foilKey: spec.foilKey,
        motif: spec.motif,
      }
      const leather = makeLeatherMap(spec.bindingColor)
      const normal = makeNormalMap()
      const frontMask = makeFoilMask(input)
      const spineMask = makeSpineMask(input)
      const backMask = makeFoilMask({ ...input, subtitle: undefined })
      return {
        front: boardMaterial(spec.bindingColor, foil.base, leather, frontMask, normal),
        spine: boardMaterial(spec.bindingColor, foil.base, leather, spineMask, normal),
        back: boardMaterial(spec.bindingColor, foil.base, leather, backMask, normal),
      }
    } catch {
      return { front: solid, spine: solid, back: solid }
    }
  }, [spec, foil.base])

  const gildMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: foil.base,
        emissive: foil.base,
        emissiveIntensity: 0.45,
        metalness: 0.65,
        roughness: 0.22,
      }),
    [foil.base],
  )
  const ribbonMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#c4a574', roughness: 0.65 }),
    [],
  )
  const pageMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#efe4d0', roughness: 0.9 }),
    [],
  )

  useFrame((_, dt) => {
    if (coverPivot.current) {
      const target = -coverOpen * Math.PI * 0.78
      coverPivot.current.rotation.y += (target - coverPivot.current.rotation.y) * Math.min(1, dt * 10)
    }
    if (group.current) {
      const baseY = h / 2
      // Quiet lift — shelf stays put; only the volume eases forward a hair
      const k = 1 - Math.exp(-dt * 8)
      const targetY = selected ? baseY + 0.018 : baseY
      const targetZ = selected ? 0.028 : 0
      group.current.position.y += (targetY - group.current.position.y) * k
      group.current.position.z += (targetZ - group.current.position.z) * k
    }
  })

  return (
    <group ref={group} position={[0, h / 2, 0]}>
      <mesh castShadow receiveShadow material={pageMat}>
        <boxGeometry args={[w * 0.92, h * 0.95, Math.max(0.02, d - board * 2)]} />
      </mesh>
      <mesh position={[w * 0.46, 0, 0]} castShadow material={gildMat}>
        <boxGeometry args={[0.007, h * 0.94, d * 0.9]} />
      </mesh>

      <mesh position={[0, 0, -d / 2 + board / 2]} castShadow material={materials.back}>
        <boxGeometry args={[w, h, board]} />
      </mesh>
      <mesh position={[-w / 2 + board / 2, 0, 0]} castShadow material={materials.spine}>
        <boxGeometry args={[board, h, d]} />
      </mesh>

      <group ref={coverPivot} position={[-w / 2 + board, 0, d / 2 - board / 2]}>
        <mesh position={[(w - board) / 2, 0, 0]} castShadow material={materials.front}>
          <boxGeometry args={[w - board, h, board]} />
        </mesh>
      </group>

      <mesh position={[-w * 0.08, -h / 2 - 0.045, 0.01]} material={ribbonMat} castShadow>
        <boxGeometry args={[0.018, 0.11, 0.004]} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -h / 2 - 0.001, 0.01]}>
        <planeGeometry args={[w * 1.08, d * 1.55]} />
        <meshBasicMaterial color="black" transparent opacity={0.38} depthWrite={false} />
      </mesh>
    </group>
  )
}
