import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
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
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 4.2)
    camera.position.lerp(new THREE.Vector3(focusX * 0.22, 0.38, 3.05), k)
    look.current.lerp(new THREE.Vector3(focusX, 0.28, 0), k)
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
    const tx = inspect ? 0.1 : x
    const ty = inspect ? 0.05 : 0
    const tz = inspect ? 0.42 : 0
    const ry = inspect ? -0.52 : 0
    const rx = inspect ? -0.06 : 0
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

function MuseumShelf({ width }: { width: number }) {
  const wood = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 128
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#3a2818'
    ctx.fillRect(0, 0, 512, 128)
    for (let i = 0; i < 80; i++) {
      ctx.strokeStyle = `rgba(20,12,6,${0.08 + Math.random() * 0.12})`
      ctx.beginPath()
      const y = Math.random() * 128
      ctx.moveTo(0, y)
      for (let x = 0; x < 512; x += 6) ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 1.5)
      ctx.stroke()
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(2, 1)
    return t
  }, [])

  return (
    <group>
      <mesh position={[0, -0.03, 0.02]} receiveShadow castShadow>
        <boxGeometry args={[width, 0.055, 0.62]} />
        <meshStandardMaterial map={wood} roughness={0.82} metalness={0.04} color="#c4a882" />
      </mesh>
      <mesh position={[0, 0.012, 0.32]} castShadow>
        <boxGeometry args={[width, 0.032, 0.045]} />
        <meshStandardMaterial color="#2a1c12" roughness={0.88} />
      </mesh>
      {/* subtle under-shelf shadow catcher already via ContactShadows */}
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
  const gap = 0.045

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
    if (!layout.length) return 2.6
    const left = layout[0].x - layout[0].w / 2
    const right = layout[layout.length - 1].x + layout[layout.length - 1].w / 2
    return Math.max(2.6, right - left + 0.45)
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
      <color attach="background" args={['#0e1016']} />
      <fog attach="fog" args={['#0e1016', 6, 14]} />

      <ambientLight intensity={0.35} color="#f0e6d8" />
      <hemisphereLight args={['#f7efe4', '#1a1410', 0.55]} />
      <directionalLight
        castShadow
        intensity={2.6}
        color="#ffe4c4"
        position={[2.4, 3.4, 3.8]}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
      />
      <directionalLight intensity={0.85} color="#a8c0e0" position={[-3.2, 2.0, 2.2]} />
      <spotLight
        intensity={2.2}
        color="#ffd9a8"
        position={[focusX * 0.4, 2.2, 2.4]}
        angle={0.55}
        penumbra={0.7}
        castShadow
      />

      <Suspense fallback={null}>
        <Environment resolution={256}>
          <Lightformer intensity={1.6} rotation-x={Math.PI / 2} position={[0, 4, 0]} scale={[8, 8, 1]} />
          <Lightformer
            intensity={2.2}
            color="#ffe0b0"
            rotation-y={Math.PI / 2}
            position={[-4, 1.5, 0]}
            scale={[4, 6, 1]}
          />
          <Lightformer
            intensity={1.4}
            color="#c8d8ff"
            rotation-y={-Math.PI / 2}
            position={[4, 1.2, 0]}
            scale={[4, 6, 1]}
          />
          <Lightformer intensity={0.9} position={[0, 1, -4]} scale={[6, 3, 1]} color="#fff2dd" />
        </Environment>
      </Suspense>

      <SceneErrorBoundary>
        <group>
          <MuseumShelf width={shelfWidth} />

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

      <ContactShadows
        position={[0, -0.055, 0]}
        opacity={0.55}
        scale={10}
        blur={2.8}
        far={2.5}
        color="#0a0604"
      />

      <OrbitControls
        enabled={mode === 'inspect' && !reducedMotion}
        enablePan={false}
        minDistance={1.15}
        maxDistance={3.4}
        target={[0.08, 0.34, 0]}
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
      dpr={[1, 2]}
      camera={{ fov: 34, position: [0, 0.38, 3.05], near: 0.05, far: 40 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.28,
      }}
    >
      <ShelfScene {...props} />
    </Canvas>
  )
}
