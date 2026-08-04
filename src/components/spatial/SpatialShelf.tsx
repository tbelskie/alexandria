import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Component, useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { BookCoverMesh, type BookVolumeSpec } from './BookCoverMesh'

class SceneErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null }
  static getDerivedStateFromError(err: Error) {
    return { error: err?.message || 'scene error' }
  }
  componentDidCatch(err: Error) {
    console.error('[SpatialShelf]', err)
  }
  render() {
    if (this.state.error) {
      return (
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshBasicMaterial color="red" />
        </mesh>
      )
    }
    return this.props.children
  }
}

interface Props {
  volumes: BookVolumeSpec[]
  index: number
  onIndexChange: (i: number) => void
  mode: 'shelf' | 'inspect'
  onModeChange: (m: 'shelf' | 'inspect') => void
  onRead: (spec: BookVolumeSpec) => void
  coverOpen: number
  onCoverOpenChange: (n: number) => void
  reducedMotion?: boolean
}

function ShelfCamera({ mode, reducedMotion }: { mode: 'shelf' | 'inspect'; reducedMotion: boolean }) {
  const camera = useThree((s) => s.camera)
  useFrame((_, dt) => {
    // Only drive the camera on the shelf; OrbitControls owns inspect framing
    if (mode === 'inspect') return
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 6)
    const target = new THREE.Vector3(0, 0.4, 3.05)
    camera.position.lerp(target, k)
    camera.lookAt(0, 0.28, 0)
  })
  return null
}

function ShelfScene({
  volumes,
  index,
  onIndexChange,
  mode,
  onModeChange,
  onRead,
  coverOpen,
  onCoverOpenChange,
  reducedMotion,
}: Props) {
  const gap = 0.035

  const layout = useMemo(() => {
    const widths = volumes.map((v) => (v.width ?? 0.42) * 0.92)
    const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, volumes.length - 1)
    let x = -total / 2
    return volumes.map((v, i) => {
      const w = widths[i]
      x += w / 2
      const cx = x
      x += w / 2 + gap
      return { spec: v, x: cx }
    })
  }, [volumes])

  const focusX = layout[index]?.x ?? 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && mode === 'shelf')
        onIndexChange(Math.min(index + 1, volumes.length - 1))
      if (e.key === 'ArrowLeft' && mode === 'shelf') onIndexChange(Math.max(index - 1, 0))
      if (e.key === 'Enter') {
        if (mode === 'shelf') onModeChange('inspect')
        else if (coverOpen > 0.8) onRead(volumes[index])
        else onCoverOpenChange(1)
      }
      if (e.key === 'Escape' && mode === 'inspect') onModeChange('shelf')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    mode,
    index,
    volumes,
    coverOpen,
    onIndexChange,
    onModeChange,
    onRead,
    onCoverOpenChange,
  ])

  return (
    <>
      <color attach="background" args={['#12141a']} />
      <ambientLight intensity={1.15} color="#fff1de" />
      <hemisphereLight args={['#fff6ea', '#2a2218', 0.95]} />
      <directionalLight
        castShadow
        intensity={3.2}
        color="#ffe8cc"
        position={[2.2, 3.2, 3.6]}
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight intensity={1.4} color="#b8cce8" position={[-2.8, 2.2, 2.4]} />
      <directionalLight intensity={1.1} color="#ffd7a0" position={[0.4, 1.8, -2.2]} />
      <pointLight intensity={1.6} color="#ffd090" position={[0.3, 1.1, 1.4]} distance={6} />
      <SceneErrorBoundary>
        <group position={[mode === 'shelf' ? -focusX : 0, 0, 0]}>
          <mesh position={[0, -0.03, 0.02]} receiveShadow castShadow>
            <boxGeometry args={[4.2, 0.06, 0.58]} />
            <meshStandardMaterial color="#3a2818" roughness={0.85} metalness={0.05} />
          </mesh>
          <mesh position={[0, 0.01, 0.3]} castShadow>
            <boxGeometry args={[4.2, 0.035, 0.04]} />
            <meshStandardMaterial color="#2a1c12" roughness={0.88} />
          </mesh>

          {layout.map(({ spec, x }, i) => {
            const selected = i === index
            if (mode === 'inspect' && !selected) return null
            const inspect = mode === 'inspect' && selected
            return (
              <group
                key={spec.id}
                position={inspect ? [0.15, 0.02, 0.1] : [x, 0, 0]}
                rotation={inspect ? [-0.1, -0.5, 0.02] : [0, (i - index) * 0.01, 0]}
                onClick={(e) => {
                  e.stopPropagation()
                  if (mode === 'shelf') {
                    if (selected) onModeChange('inspect')
                    else onIndexChange(i)
                  } else if (coverOpen > 0.8) onRead(spec)
                  else onCoverOpenChange(1)
                }}
                onPointerOver={() => {
                  if (mode === 'inspect' && coverOpen < 0.9) onCoverOpenChange(0.22)
                  document.body.style.cursor = 'pointer'
                }}
                onPointerOut={() => {
                  if (mode === 'inspect' && coverOpen < 0.9) onCoverOpenChange(0)
                  document.body.style.cursor = 'default'
                }}
              >
                <BookCoverMesh
                  spec={spec}
                  selected={selected && mode === 'shelf'}
                  coverOpen={inspect ? coverOpen : 0}
                />
              </group>
            )
          })}
        </group>
      </SceneErrorBoundary>

      <OrbitControls
        enabled={mode === 'inspect' && !reducedMotion}
        enablePan={false}
        minDistance={1.2}
        maxDistance={3.2}
        target={[0.1, 0.28, 0]}
      />

      <ShelfCamera mode={mode} reducedMotion={!!reducedMotion} />
    </>
  )
}

export function SpatialShelf(props: Props) {
  return (
    <Canvas
      className="absolute inset-0 h-full w-full"
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 40, position: [0, 0.4, 3.05], near: 0.05, far: 40 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.45,
      }}
    >
      <ShelfScene {...props} />
    </Canvas>
  )
}
