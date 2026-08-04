import * as THREE from 'three'
import type { Volume } from '../catalog/types'
import { createBook, layoutShelfPositions, type BookHandle } from './BookMesh'
import { makeWoodTexture } from './textures'

export type ShelfMode = 'shelf' | 'inspect'

export interface ShelfEngineOptions {
  container: HTMLElement
  volumes: Volume[]
  initialIndex?: number
  onIndexChange?: (index: number) => void
  onModeChange?: (mode: ShelfMode) => void
  onOpenReader?: (volume: Volume) => void
  reducedMotion?: boolean
}

/**
 * Five-volume face-out shelf — craft bar: Complete Shelf.
 * Original implementation; not a copy of third-party source.
 */
export class ShelfEngine {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private shelfRoot = new THREE.Group()
  private inspectRoot = new THREE.Group()
  private books: BookHandle[] = []
  private index: number
  private mode: ShelfMode = 'shelf'
  private raf = 0
  private disposed = false
  private coverOpen = 0
  private targetCoverOpen = 0
  private inspectBook: BookHandle | null = null
  private focusX = { current: 0, target: 0 }
  private resizeObs: ResizeObserver
  private opts: ShelfEngineOptions
  private clock = new THREE.Clock()
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private camShelf = new THREE.Vector3(0, 0.42, 2.35)
  private camInspect = new THREE.Vector3(0.55, 0.38, 1.65)
  private lookShelf = new THREE.Vector3(0, 0.28, 0)
  private lookInspect = new THREE.Vector3(0.15, 0.3, 0)
  private draggingOrbit = false
  private lastPtr = { x: 0, y: 0 }
  private inspectYaw = 0
  private inspectPitch = 0

  constructor(opts: ShelfEngineOptions) {
    this.opts = opts
    this.index = opts.initialIndex ?? 0

    const w = opts.container.clientWidth || 960
    const h = opts.container.clientHeight || 640

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    opts.container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(32, w / h, 0.05, 50)
    this.camera.position.copy(this.camShelf)

    this.scene.background = new THREE.Color('#0a0b0f')
    this.scene.fog = new THREE.Fog('#0a0b0f', 4.5, 10)

    this.buildLights()
    this.buildShelfFurniture()
    this.scene.add(this.shelfRoot)
    this.scene.add(this.inspectRoot)

    opts.volumes.forEach((vol, i) => {
      const book = createBook(vol, i)
      this.shelfRoot.add(book.root)
      this.books.push(book)
    })
    layoutShelfPositions(this.books)
    this.setIndex(this.index, true)

    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(opts.container)

    const el = this.renderer.domElement
    el.style.touchAction = 'none'
    el.addEventListener('wheel', this.onWheel, { passive: false })
    el.addEventListener('pointerdown', this.onPointerDown)
    el.addEventListener('pointermove', this.onPointerMove)
    el.addEventListener('pointerup', this.onPointerUp)
    el.addEventListener('pointerleave', this.onPointerUp)
    window.addEventListener('keydown', this.onKey)

    this.tick()
  }

  getIndex() {
    return this.index
  }

  getMode() {
    return this.mode
  }

  getVolume() {
    return this.books[this.index]?.volume
  }

  setIndex(i: number, instant = false) {
    if (!this.books.length || this.mode === 'inspect') return
    const n = this.books.length
    this.index = ((i % n) + n) % n
    this.focusX.target = this.books[this.index].restPosition.x
    if (instant || this.opts.reducedMotion) this.focusX.current = this.focusX.target
    this.opts.onIndexChange?.(this.index)
  }

  next() {
    this.setIndex(this.index + 1)
  }

  prev() {
    this.setIndex(this.index - 1)
  }

  enterInspect() {
    if (this.mode === 'inspect') return
    const book = this.books[this.index]
    if (!book) return
    this.mode = 'inspect'
    this.opts.onModeChange?.('inspect')

    // Hide shelf copy; build inspect twin at deterministic pose
    book.root.visible = false
    this.inspectRoot.clear()
    const twin = createBook(book.volume, book.slot)
    twin.root.position.set(0.2, twin.height / 2 - 0.05, 0)
    twin.root.rotation.set(-0.08, -0.45, 0.02)
    this.inspectRoot.add(twin.root)
    this.inspectBook = twin
    this.coverOpen = 0
    this.targetCoverOpen = 0
    this.inspectYaw = 0
    this.inspectPitch = 0
  }

  exitInspect() {
    if (this.mode !== 'inspect') return
    this.mode = 'shelf'
    this.opts.onModeChange?.('shelf')
    this.inspectRoot.clear()
    this.inspectBook = null
    this.books.forEach((b) => {
      b.root.visible = true
    })
    this.coverOpen = 0
    this.targetCoverOpen = 0
  }

  openCoverFully() {
    if (this.mode !== 'inspect') return
    this.targetCoverOpen = 1
  }

  openReader() {
    const vol = this.getVolume()
    if (vol) this.opts.onOpenReader?.(vol)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObs.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('wheel', this.onWheel)
    el.removeEventListener('pointerdown', this.onPointerDown)
    el.removeEventListener('pointermove', this.onPointerMove)
    el.removeEventListener('pointerup', this.onPointerUp)
    el.removeEventListener('pointerleave', this.onPointerUp)
    window.removeEventListener('keydown', this.onKey)
    this.renderer.dispose()
    el.remove()
  }

  private buildLights() {
    this.scene.add(new THREE.AmbientLight(0xf2e6d4, 0.32))
    const key = new THREE.DirectionalLight(0xffe4c8, 1.55)
    key.position.set(2.2, 3.4, 3.2)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 12
    key.shadow.camera.left = -3
    key.shadow.camera.right = 3
    key.shadow.camera.top = 3
    key.shadow.camera.bottom = -2
    this.scene.add(key)
    const fill = new THREE.DirectionalLight(0x9bb4d4, 0.4)
    fill.position.set(-2.8, 1.6, 2.2)
    this.scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffd7a0, 0.35)
    rim.position.set(0.2, 1.2, -2.5)
    this.scene.add(rim)
  }

  private buildShelfFurniture() {
    const wood = makeWoodTexture()
    wood.repeat.set(3, 1)
    const woodMat = new THREE.MeshStandardMaterial({
      map: wood,
      roughness: 0.82,
      metalness: 0.04,
      color: '#4a3424',
    })

    // Plank
    const plank = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.06, 0.55), woodMat)
    plank.position.set(0, -0.03, 0.02)
    plank.castShadow = true
    plank.receiveShadow = true
    this.shelfRoot.add(plank)

    // Front lip
    const lip = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.035, 0.04), woodMat)
    lip.position.set(0, 0.01, 0.28)
    lip.castShadow = true
    this.shelfRoot.add(lip)

    // Back rail
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 0.04), woodMat)
    rail.position.set(0, 0.03, -0.24)
    this.shelfRoot.add(rail)

    // Ground fade plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 12),
      new THREE.MeshStandardMaterial({ color: '#07080c', roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.06
    ground.receiveShadow = true
    this.scene.add(ground)
  }

  private resize() {
    const { container } = this.opts
    const w = container.clientWidth || 960
    const h = container.clientHeight || 640
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private onWheel = (e: WheelEvent) => {
    if (this.mode === 'inspect') return
    e.preventDefault()
    if (Math.abs(e.deltaY) < 4 && Math.abs(e.deltaX) < 4) return
    const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    if (delta > 0) this.next()
    else this.prev()
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      if (this.mode === 'shelf') this.next()
    } else if (e.key === 'ArrowLeft') {
      if (this.mode === 'shelf') this.prev()
    } else if (e.key === 'Enter') {
      if (this.mode === 'shelf') this.enterInspect()
      else if (this.coverOpen > 0.85) this.openReader()
      else this.openCoverFully()
    } else if (e.key === 'Escape') {
      if (this.mode === 'inspect') this.exitInspect()
    }
  }

  private setPointer(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }

  private onPointerDown = (e: PointerEvent) => {
    this.setPointer(e)
    if (this.mode === 'shelf') {
      // Hit-test books for direct select
      this.raycaster.setFromCamera(this.pointer, this.camera)
      const hits = this.raycaster.intersectObjects(
        this.books.map((b) => b.root),
        true,
      )
      if (hits[0]) {
        let obj: THREE.Object3D | null = hits[0].object
        while (obj && !this.books.find((b) => b.root === obj)) obj = obj.parent
        const book = this.books.find((b) => b.root === obj)
        if (book) {
          if (book.slot === this.index) this.enterInspect()
          else this.setIndex(book.slot)
          return
        }
      }
      this.enterInspect()
      return
    }

    // Inspect: cover vs orbit background
    if (!this.inspectBook) return
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const coverHits = this.raycaster.intersectObject(this.inspectBook.frontCover, true)
    if (coverHits.length) {
      if (this.coverOpen > 0.85) this.openReader()
      else this.openCoverFully()
      return
    }
    this.draggingOrbit = true
    this.lastPtr = { x: e.clientX, y: e.clientY }
    this.renderer.domElement.setPointerCapture(e.pointerId)
  }

  private onPointerMove = (e: PointerEvent) => {
    this.setPointer(e)
    if (this.mode === 'inspect' && this.inspectBook && !this.draggingOrbit) {
      this.raycaster.setFromCamera(this.pointer, this.camera)
      const hits = this.raycaster.intersectObject(this.inspectBook.frontCover, true)
      if (this.targetCoverOpen < 0.9) this.targetCoverOpen = hits.length ? 0.22 : 0
    }
    if (this.draggingOrbit) {
      const dx = e.clientX - this.lastPtr.x
      const dy = e.clientY - this.lastPtr.y
      this.lastPtr = { x: e.clientX, y: e.clientY }
      this.inspectYaw += dx * 0.005
      this.inspectPitch = Math.max(-0.4, Math.min(0.35, this.inspectPitch + dy * 0.004))
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    this.draggingOrbit = false
    try {
      this.renderer.domElement.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  private tick = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.tick)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    const k = this.opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 8)

    this.focusX.current += (this.focusX.target - this.focusX.current) * k
    this.shelfRoot.position.x = -this.focusX.current

    // Selected book: lift slightly forward; neighbors settle
    this.books.forEach((book, i) => {
      const selected = i === this.index && this.mode === 'shelf'
      const targetPos = book.restPosition.clone()
      if (selected) {
        targetPos.y += 0.03
        targetPos.z += 0.06
      }
      book.root.position.lerp(targetPos, k)
      const targetRotY = book.restRotation.y + (selected ? 0 : 0)
      book.root.rotation.y += (targetRotY - book.root.rotation.y) * k
      const s = selected ? 1.02 : 1
      book.root.scale.setScalar(book.root.scale.x + (s - book.root.scale.x) * k)
    })

    this.coverOpen += (this.targetCoverOpen - this.coverOpen) * (this.opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 10))
    if (this.inspectBook) {
      this.inspectBook.coverPivot.rotation.y = -this.coverOpen * (Math.PI * 0.78)
      this.inspectRoot.rotation.y = this.inspectYaw
      this.inspectRoot.rotation.x = this.inspectPitch
    }

    const camTarget = this.mode === 'inspect' ? this.camInspect : this.camShelf
    const lookTarget = this.mode === 'inspect' ? this.lookInspect : this.lookShelf
    this.camera.position.lerp(camTarget, k * 0.85)
    this.camera.lookAt(lookTarget)

    this.renderer.render(this.scene, this.camera)
  }
}
