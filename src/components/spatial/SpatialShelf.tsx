import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react'
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
          <meshBasicMaterial color="crimson" />
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

/** Camera drifts to the selected volume — shelf geometry never translates. */
function ShelfCamera({
  mode,
  focusX,
  reducedMotion,
}: {
  mode: 'shelf' | 'inspect'
  focusX: number
  reducedMotion: boolean
}) {
  const camera = useThree((s) => s.camera)
  const look = useRef(new THREE.Vector3(0, 0.3, 0))

  useFrame((_, dt) => {
    if (mode === 'inspect') return
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 4.5)
    const targetPos = new THREE.Vector3(focusX * 0.35, 0.42, 2.85)
    camera.position.lerp(targetPos, k)
    look.current.lerp(new THREE.Vector3(focusX, 0.3, 0), k)
    camera.lookAt(look.current)
  })
  return null
}

function BookSlot({
  spec,
  x,
  selected,
  inspect,
  coverOpen,
  onSelect,
  onInspect,
  onRead,
  onHoverOpen,
}: {
  spec: BookVolumeSpec
  x: number
  selected: boolean
  inspect: boolean
  coverOpen: number
  onSelect: () => void
  onInspect: () => void
  onRead: () => void
  onHoverOpen: (n: number) => void
}) {
  const root = useRef<THREE.Group>(null)

  useFrame((_, dt) => {
    if (!root.current) return
    const k = 1 - Math.exp(-dt * 7)
    // Shelf: stay in slot. Inspect: ease to a present pose in front of camera.
    const tx = inspect ? 0.12 : x
    const ty = inspect ? 0.04 : 0
    const tz = inspect ? 0.35 : 0
    const ry = inspect ? -0.48 : 0
    const rx = inspect ? -0.08 : 0
    root.current.position.x += (tx - root.current.position.x) * k
    root.current.position.y += (ty - root.current.position.y) * k
    root.current.position.z += (tz - root.current.position.z) * k
    root.current.rotation.y += (ry - root.current.rotation.y) * k
    root.current.rotation.x += (rx - root.current.rotation.x) * k
  })

  return (
    <group
      ref={root}
      position={[x, 0, 0]}
      onClick={(e) => {
        e.stopPropagation()
        if (!inspect) {
          if (selected) onInspect()
          else onSelect()
        } else if (coverOpen > 0.8) onRead()
        else onHoverOpen(1)
      }}
      onPointerOver={() => {
        if (inspect && coverOpen < 0.9) onHoverOpen(0.22)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        if (inspect && coverOpen < 0.9) onHoverOpen(0)
        document.body.style.cursor = 'default'
      }}
    >
      <BookCoverMesh
        spec={spec}
        selected={selected && !inspect}
        coverOpen={inspect ? coverOpen : 0}
      />
    </group>
  )
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
  const gap = 0.04

  const layout = useMemo(() => {
    const widths = volumes.map((v) => (v.width ?? 0.42) * 0.9)
    const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, volumes.length - 1)
    let x = -total / 2
    return volumes.map((v, i) => {
      const w = widths[i]
      x += w / 2
      const cx = x
      x += w / 2 + gap
      return { spec: v, x: cx, w }
    })
  }, [volumes])

  const focusX = layout[index]?.x ?? 0
  const shelfWidth = useMemo(() => {
    if (!layout.length) return 2.4
    const left = layout[0].x - layout[0].w / 2
    const right = layout[layout.length - 1].x + layout[layout.length - 1].w / 2
    return Math.max(2.4, right - left + 0.35)
  }, [layout])

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
      <ambientLight intensity={1.05} color="#fff1de" />
      <hemisphereLight args={['#fff6ea', '#2a2218', 0.9]} />
      <directionalLight
        castShadow
        intensity={2.8}
        color="#ffe8cc"
        position={[2.2, 3.2, 3.6]}
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight intensity={1.2} color="#b8cce8" position={[-2.8, 2.2, 2.4]} />
      <directionalLight intensity={0.95} color="#ffd7a0" position={[0.4, 1.8, -2.2]} />
      <pointLight intensity={1.35} color="#ffd090" position={[focusX * 0.5, 1.05, 1.35]} distance={5} />

      <SceneErrorBoundary>
        {/* Fixed shelf — never parent-translated with selection */}
        <group>
          <mesh position={[0, -0.03, 0.02]} receiveShadow castShadow>
            <boxGeometry args={[shelfWidth, 0.06, 0.58]} />
            <meshStandardMaterial color="#3a2818" roughness={0.85} metalness={0.05} />
          </mesh>
          <mesh position={[0, 0.01, 0.3]} castShadow>
            <boxGeometry args={[shelfWidth, 0.035, 0.04]} />
            <meshStandardMaterial color="#2a1c12" roughness={0.88} />
          </mesh>

          {layout.map(({ spec, x }, i) => {
            const selected = i === index
            const inspect = mode === 'inspect' && selected
            if (mode === 'inspect' && !selected) return null
            return (
              <BookSlot
                key={spec.id}
                spec={spec}
                x={x}
                selected={selected}
                inspect={inspect}
                coverOpen={coverOpen}
                onSelect={() => onIndexChange(i)}
                onInspect={() => onModeChange('inspect')}
                onRead={() => onRead(spec)}
                onHoverOpen={onCoverOpenChange}
              />
            )
          })}
        </group>
      </SceneErrorBoundary>

      <OrbitControls
        enabled={mode === 'inspect' && !reducedMotion}
        enablePan={false}
        minDistance={1.2}
        maxDistance={3.2}
        target={[0.1, 0.32, 0]}
      />

      <ShelfCamera mode={mode} focusX={focusX} reducedMotion={!!reducedMotion} />
    </>
  )
}

export function SpatialShelf(props: Props) {
  return (
    <Canvas
      className="absolute inset-0 h-full w-full"
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 38, position: [0, 0.42, 2.85], near: 0.05, far: 40 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.35,
      }}
    >
      <ShelfScene {...props} />
    </Canvas>
  )
}
