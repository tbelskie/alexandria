import * as THREE from 'three'
import type { Volume } from '../catalog/types'
import { makeClothTexture, makeCoverTexture, makePaperTexture } from './textures'

export type ShelfMode = 'shelf' | 'inspect'

export interface ShelfEngineOptions {
  container: HTMLElement
  volumes: Volume[]
  initialIndex?: number
  onIndexChange?: (index: number) => void
  onOpenReader?: (volume: Volume) => void
  reducedMotion?: boolean
}

type BookHandle = {
  volume: Volume
  root: THREE.Group
  coverPivot: THREE.Group
  frontCover: THREE.Mesh
}

/**
 * Original Alexandria shelf — continuous hardcover browsing + inspect.
 * Craft checklist inspired by public Complete Shelf briefs; implementation is original.
 */
export class ShelfEngine {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private shelfRoot = new THREE.Group()
  private books: BookHandle[] = []
  private index: number
  private mode: ShelfMode = 'shelf'
  private raf = 0
  private disposed = false
  private coverOpen = 0
  private targetCoverOpen = 0
  private inspectBook: BookHandle | null = null
  private inspectGroup = new THREE.Group()
  private shelfOffset = { current: 0, target: 0 }
  private resizeObs: ResizeObserver
  private opts: ShelfEngineOptions
  private clock = new THREE.Clock()
  private woodMat: THREE.MeshStandardMaterial
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()

  constructor(opts: ShelfEngineOptions) {
    this.opts = opts
    this.index = opts.initialIndex ?? 0

    const w = opts.container.clientWidth || 800
    const h = opts.container.clientHeight || 600

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    opts.container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100)
    this.camera.position.set(0, 1.1, 4.2)

    this.scene.background = new THREE.Color('#0e1016')
    this.scene.fog = new THREE.Fog('#0e1016', 6, 16)

    const amb = new THREE.AmbientLight(0xfff2e0, 0.45)
    const key = new THREE.DirectionalLight(0xffe6c8, 1.35)
    key.position.set(2.5, 4, 3)
    key.castShadow = true
    const fill = new THREE.DirectionalLight(0x88aacc, 0.35)
    fill.position.set(-3, 1, 2)
    this.scene.add(amb, key, fill)

    this.woodMat = new THREE.MeshStandardMaterial({
      color: '#3a2818',
      roughness: 0.85,
      metalness: 0.05,
    })

    this.buildRoom()
    this.scene.add(this.shelfRoot)
    this.scene.add(this.inspectGroup)
    this.buildBooks(opts.volumes)
    this.setIndex(this.index, true)

    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(opts.container)

    const el = this.renderer.domElement
    el.addEventListener('wheel', this.onWheel, { passive: false })
    el.addEventListener('pointerdown', this.onPointerDown)
    el.addEventListener('pointermove', this.onPointerMove)
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
    if (!this.books.length) return
    const n = this.books.length
    this.index = ((i % n) + n) % n
    this.shelfOffset.target = -this.index * 0.55
    if (instant || this.opts.reducedMotion) this.shelfOffset.current = this.shelfOffset.target
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
    this.inspectBook = book
    book.root.visible = false
    const clone = book.root.clone(true)
    // Use live book geometry by reparenting a fresh instance for inspect
    this.inspectGroup.clear()
    const inspect = this.createBook(book.volume, true)
    inspect.root.position.set(0.35, 0.2, 0)
    inspect.root.rotation.set(-0.15, -0.55, 0.05)
    inspect.root.scale.setScalar(1.35)
    this.inspectGroup.add(inspect.root)
    this.inspectBook = inspect
    this.targetCoverOpen = 0
    this.coverOpen = 0
    void clone
  }

  exitInspect() {
    if (this.mode !== 'inspect') return
    this.mode = 'shelf'
    this.inspectGroup.clear()
    if (this.inspectBook) this.inspectBook = null
    this.books.forEach((b) => {
      b.root.visible = true
    })
    this.targetCoverOpen = 0
    this.coverOpen = 0
  }

  crackCover(open: boolean) {
    if (this.mode !== 'inspect') return
    this.targetCoverOpen = open ? 0.35 : 0
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
    window.removeEventListener('keydown', this.onKey)
    this.renderer.dispose()
    el.remove()
  }

  private buildRoom() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 20),
      new THREE.MeshStandardMaterial({ color: '#161018', roughness: 0.95 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.85
    floor.receiveShadow = true

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 12),
      new THREE.MeshStandardMaterial({ color: '#12141c', roughness: 1 }),
    )
    back.position.z = -3
    back.position.y = 2

    const plank = new THREE.Mesh(new THREE.BoxGeometry(20, 0.12, 1.2), this.woodMat)
    plank.position.set(0, -0.55, 0)
    plank.castShadow = true
    plank.receiveShadow = true

    const edge = new THREE.Mesh(new THREE.BoxGeometry(20, 0.08, 0.12), this.woodMat)
    edge.position.set(0, -0.48, 0.55)

    this.shelfRoot.add(floor, back, plank, edge)
  }

  private buildBooks(volumes: Volume[]) {
    volumes.forEach((vol, i) => {
      const book = this.createBook(vol)
      book.root.position.x = i * 0.55
      this.shelfRoot.add(book.root)
      this.books.push(book)
    })
  }

  private createBook(volume: Volume, forInspect = false): BookHandle {
    const root = new THREE.Group()
    const w = 0.38
    const h = 0.58
    const d = 0.08

    const cloth = makeClothTexture(volume.cloth.board, volume.cloth.foil)
    const coverTex = makeCoverTexture(
      volume.title,
      volume.authors.join(', '),
      volume.cloth.board,
      volume.cloth.foil,
    )
    const paperTex = makePaperTexture(volume.readerTheme.paper)

    const boardMat = new THREE.MeshStandardMaterial({
      map: cloth,
      color: volume.cloth.board,
      roughness: 0.78,
      metalness: 0.08,
    })
    const coverMat = new THREE.MeshStandardMaterial({
      map: coverTex,
      roughness: 0.7,
      metalness: 0.05,
    })
    const spineMat = new THREE.MeshStandardMaterial({
      color: volume.cloth.spine,
      roughness: 0.75,
      metalness: 0.1,
    })
    const pageMat = new THREE.MeshStandardMaterial({
      map: paperTex,
      roughness: 0.95,
      metalness: 0,
    })
    const foilMat = new THREE.MeshStandardMaterial({
      color: volume.cloth.foil,
      roughness: 0.35,
      metalness: 0.65,
    })

    const pageBlock = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, h * 0.94, d * 0.7), pageMat)
    pageBlock.position.z = 0
    pageBlock.castShadow = true

    const backBoard = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), boardMat)
    backBoard.position.z = -d * 0.45

    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.014, h, d), spineMat)
    spine.position.x = -w * 0.5

    const coverPivot = new THREE.Group()
    coverPivot.position.set(-w * 0.5, 0, d * 0.45)
    const frontCover = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), coverMat)
    frontCover.position.x = w * 0.5
    frontCover.castShadow = true
    coverPivot.add(frontCover)

    // foil line on spine
    const foil = new THREE.Mesh(new THREE.BoxGeometry(0.016, h * 0.15, d * 0.92), foilMat)
    foil.position.set(-w * 0.5, h * 0.15, 0)

    root.add(pageBlock, backBoard, spine, coverPivot, foil)
    root.position.y = -0.2
    if (!forInspect) {
      root.rotation.y = -0.08
    }

    return { volume, root, coverPivot, frontCover }
  }

  private resize() {
    const { container } = this.opts
    const w = container.clientWidth || 800
    const h = container.clientHeight || 600
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private onWheel = (e: WheelEvent) => {
    if (this.mode === 'inspect') return
    e.preventDefault()
    if (Math.abs(e.deltaY) < 2) return
    if (e.deltaY > 0) this.next()
    else this.prev()
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      if (this.mode === 'shelf') this.next()
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (this.mode === 'shelf') this.prev()
    } else if (e.key === 'Enter') {
      if (this.mode === 'shelf') this.enterInspect()
      else if (this.coverOpen > 0.8) this.openReader()
      else this.openCoverFully()
    } else if (e.key === 'Escape') {
      if (this.mode === 'inspect') this.exitInspect()
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.mode !== 'inspect' || !this.inspectBook) return
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObject(this.inspectBook.frontCover, true)
    if (this.targetCoverOpen < 0.9) {
      this.targetCoverOpen = hits.length ? 0.28 : 0
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.mode === 'shelf') {
      // click selected book to inspect
      if (e.button === 0) this.enterInspect()
      return
    }
    if (!this.inspectBook) return
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObject(this.inspectBook.frontCover, true)
    if (hits.length) {
      if (this.coverOpen > 0.85) this.openReader()
      else this.openCoverFully()
    }
  }

  private tick = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.tick)
    const dt = Math.min(this.clock.getDelta(), 0.05)

    const lerp = this.opts.reducedMotion ? 1 : 1 - Math.pow(0.001, dt)
    this.shelfOffset.current += (this.shelfOffset.target - this.shelfOffset.current) * lerp

    // slide books relative to camera focus
    this.books.forEach((book, i) => {
      const baseX = i * 0.55 + this.shelfOffset.current
      book.root.position.x = baseX
      const dist = Math.abs(i - this.index)
      const focus = dist === 0 ? 1 : Math.max(0.35, 1 - dist * 0.18)
      const targetY = dist === 0 ? -0.08 : -0.2
      book.root.position.y += (targetY - book.root.position.y) * lerp
      book.root.scale.setScalar(0.95 + focus * 0.08)
      book.root.rotation.y += (-0.08 - dist * 0.02 - book.root.rotation.y) * lerp
    })

    this.coverOpen += (this.targetCoverOpen - this.coverOpen) * (this.opts.reducedMotion ? 1 : 6 * dt)
    if (this.inspectBook) {
      this.inspectBook.coverPivot.rotation.y = -this.coverOpen * 1.35
      this.inspectGroup.rotation.y = Math.sin(this.clock.elapsedTime * 0.25) * 0.04
    }

    if (this.mode === 'inspect') {
      this.camera.position.lerp(new THREE.Vector3(0.2, 1.0, 3.2), lerp)
      this.camera.lookAt(0.3, 0.15, 0)
    } else {
      this.camera.position.lerp(new THREE.Vector3(0, 1.05, 4.1), lerp)
      this.camera.lookAt(0, 0.1, 0)
    }

    this.renderer.render(this.scene, this.camera)
  }
}
