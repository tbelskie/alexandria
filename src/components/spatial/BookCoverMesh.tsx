import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { FoilKey } from '../../styles/tokens'
import { AlexandriaTokens } from '../../styles/tokens'
import type { MotifId } from './coverMaps'

export interface BookVolumeSpec {
  id: string
  title: string
  subtitle?: string
  author: string
  bindingColor: string
  foilKey: FoilKey
  motif: MotifId
  coverArt: {
    front: string
    spine: string
  }
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

function prepMap(tex: THREE.Texture) {
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 16
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}

/** Derive a soft metalness map from warm/cool foil hues in the authored albedo. */
function makeMetalnessFromAlbedo(map: THREE.Texture): THREE.CanvasTexture | null {
  const img = map.image as HTMLImageElement | ImageBitmap | undefined
  if (!img || !('width' in img)) return null
  const w = Math.min(512, img.width)
  const h = Math.min(768, img.height)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img as CanvasImageSource, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h)
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i]
    const g = data.data[i + 1]
    const b = data.data[i + 2]
    // Gold / brass / copper / silver catch
    const warm = r > 140 && g > 90 && b < r * 0.85 && r + g > b * 2.2
    const silver = r > 150 && g > 150 && b > 150 && Math.abs(r - b) < 40
    const m = warm || silver ? Math.min(255, 40 + (r + g) * 0.35) : 12
    data.data[i] = m
    data.data[i + 1] = m
    data.data[i + 2] = m
    data.data[i + 3] = 255
  }
  ctx.putImageData(data, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.needsUpdate = true
  return t
}

function BookBody({ spec, selected = false, coverOpen = 0 }: Props) {
  const group = useRef<THREE.Group>(null)
  const coverPivot = useRef<THREE.Group>(null)

  const w = (spec.width ?? 0.42) * 0.92
  const h = (spec.height ?? 0.64) * 0.92
  const d = (spec.depth ?? 0.07) * 0.95
  const board = 0.011
  const foil = AlexandriaTokens.foils[spec.foilKey]

  const textures = useTexture({
    front: spec.coverArt.front,
    spine: spec.coverArt.spine,
  })

  const { frontMat, spineMat, backMat } = useMemo(() => {
    const frontMap = prepMap(textures.front.clone())
    const spineMap = prepMap(textures.spine.clone())
    const backMap = prepMap(textures.front.clone())
    const frontMetal = makeMetalnessFromAlbedo(frontMap)
    const spineMetal = makeMetalnessFromAlbedo(spineMap)

    const mk = (
      map: THREE.Texture,
      metalMap: THREE.Texture | null,
      roughness: number,
    ) =>
      new THREE.MeshPhysicalMaterial({
        map,
        metalnessMap: metalMap ?? undefined,
        color: '#ffffff',
        metalness: metalMap ? 0.85 : 0.12,
        roughness,
        clearcoat: 0.22,
        clearcoatRoughness: 0.45,
        envMapIntensity: 1.45,
        sheen: 0.4,
        sheenRoughness: 0.65,
        sheenColor: new THREE.Color(spec.bindingColor).multiplyScalar(1.25),
      })

    return {
      frontMat: mk(frontMap, frontMetal, 0.38),
      spineMat: mk(spineMap, spineMetal, 0.44),
      backMat: mk(backMap, frontMetal, 0.48),
    }
  }, [textures.front, textures.spine, spec.bindingColor])

  const gildMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: foil.base,
        emissive: foil.base,
        emissiveIntensity: 0.22,
        metalness: 1,
        roughness: 0.18,
        clearcoat: 0.4,
        envMapIntensity: 1.4,
      }),
    [foil.base],
  )

  const pageMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f3e8d4',
        roughness: 0.92,
        metalness: 0.02,
      }),
    [],
  )

  const ribbonMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#c4a574',
        roughness: 0.55,
        metalness: 0.05,
      }),
    [],
  )

  const bandMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: foil.base,
        metalness: 0.95,
        roughness: 0.25,
        emissive: foil.base,
        emissiveIntensity: 0.12,
      }),
    [foil.base],
  )

  useFrame((_, dt) => {
    if (coverPivot.current) {
      const target = -coverOpen * Math.PI * 0.78
      coverPivot.current.rotation.y +=
        (target - coverPivot.current.rotation.y) * Math.min(1, dt * 9)
    }
    if (group.current) {
      const baseY = h / 2
      const k = 1 - Math.exp(-dt * 8)
      const targetY = selected ? baseY + 0.02 : baseY
      const targetZ = selected ? 0.032 : 0
      group.current.position.y += (targetY - group.current.position.y) * k
      group.current.position.z += (targetZ - group.current.position.z) * k
    }
  })

  const pageD = Math.max(0.02, d - board * 2.1)
  const spineBands = [0.18, 0.34, 0.5, 0.66, 0.82]

  return (
    <group ref={group} position={[0, h / 2, 0]}>
      {/* Text block */}
      <mesh castShadow receiveShadow material={pageMat} position={[board * 0.35, 0, 0]}>
        <boxGeometry args={[w * 0.9, h * 0.955, pageD]} />
      </mesh>

      {/* Gilt fore-edge */}
      <mesh position={[w * 0.455, 0, 0]} castShadow material={gildMat}>
        <boxGeometry args={[0.006, h * 0.95, pageD * 0.96]} />
      </mesh>
      {/* Gilt head / tail */}
      <mesh position={[board * 0.2, h * 0.478, 0]} material={gildMat}>
        <boxGeometry args={[w * 0.88, 0.004, pageD * 0.96]} />
      </mesh>
      <mesh position={[board * 0.2, -h * 0.478, 0]} material={gildMat}>
        <boxGeometry args={[w * 0.88, 0.004, pageD * 0.96]} />
      </mesh>

      {/* Back board */}
      <mesh position={[0, 0, -d / 2 + board / 2]} castShadow receiveShadow material={backMat}>
        <boxGeometry args={[w, h, board]} />
      </mesh>

      {/* Rounded-feel spine board */}
      <mesh position={[-w / 2 + board * 0.55, 0, 0]} castShadow receiveShadow material={spineMat}>
        <boxGeometry args={[board * 1.15, h, d * 0.98]} />
      </mesh>

      {/* Hubbed raised bands */}
      {spineBands.map((t) => (
        <mesh
          key={t}
          position={[-w / 2 + board * 0.55, h * (t - 0.5), 0]}
          castShadow
          material={bandMat}
        >
          <boxGeometry args={[board * 1.35, 0.007, d * 0.92]} />
        </mesh>
      ))}

      {/* Front board (hinged) */}
      <group ref={coverPivot} position={[-w / 2 + board, 0, d / 2 - board / 2]}>
        <mesh position={[(w - board) / 2, 0, 0]} castShadow receiveShadow material={frontMat}>
          <boxGeometry args={[w - board, h, board]} />
        </mesh>
      </group>

      {/* Ribbon bookmark */}
      <mesh position={[-w * 0.06, -h / 2 - 0.05, 0.012]} castShadow material={ribbonMat}>
        <boxGeometry args={[0.016, 0.12, 0.003]} />
      </mesh>

      {/* Contact blob */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -h / 2 - 0.001, 0.01]}>
        <planeGeometry args={[w * 1.1, d * 1.6]} />
        <meshBasicMaterial color="#000" transparent opacity={0.32} depthWrite={false} />
      </mesh>
    </group>
  )
}

export function BookCoverMesh(props: Props) {
  return (
    <Suspense fallback={null}>
      <BookBody {...props} />
    </Suspense>
  )
}
