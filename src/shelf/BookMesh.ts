import * as THREE from 'three'
import type { Volume } from '../catalog/types'
import { texturesForVolume } from './textures'

export type BookHandle = {
  volume: Volume
  root: THREE.Group
  coverPivot: THREE.Group
  frontCover: THREE.Mesh
  slot: number
  restPosition: THREE.Vector3
  restRotation: THREE.Euler
  width: number
  height: number
  thickness: number
}

const BASE_W = 0.42
const BASE_H = 0.62
const BASE_T = 0.062

/**
 * Face-out clothbound hardcover on a shelf (Complete Shelf stance):
 * cover faces the camera (+Z), books stand on Y, arranged along X by cover width.
 * Spine on −X. Thickness along Z into the shelf.
 */
export function createBook(volume: Volume, slot: number): BookHandle {
  const width = BASE_W * (volume.binding?.depth ?? 1)
  const height = BASE_H * (volume.binding?.height ?? 1)
  const thickness = BASE_T * (volume.binding?.thickness ?? 1)

  const maps = texturesForVolume(volume)
  const root = new THREE.Group()
  root.name = volume.id

  const frontMat = new THREE.MeshStandardMaterial({
    map: maps.front,
    roughness: 0.68,
    metalness: 0.07,
  })
  const backMat = new THREE.MeshStandardMaterial({
    map: maps.back,
    roughness: 0.72,
    metalness: 0.05,
  })
  const spineMat = new THREE.MeshStandardMaterial({
    map: maps.spine,
    roughness: 0.7,
    metalness: 0.08,
  })
  const clothMat = new THREE.MeshStandardMaterial({
    color: volume.cloth.board,
    roughness: 0.8,
    metalness: 0.04,
  })
  const pageMat = new THREE.MeshStandardMaterial({
    map: maps.paper,
    roughness: 0.94,
    metalness: 0,
  })
  const edgeMat = new THREE.MeshStandardMaterial({
    color: '#e6d8c4',
    roughness: 0.88,
    metalness: 0,
  })
  const foilMat = new THREE.MeshStandardMaterial({
    color: volume.cloth.foil,
    roughness: 0.3,
    metalness: 0.75,
  })

  const board = 0.011
  const pageW = width * 0.94
  const pageH = height * 0.955
  const pageT = Math.max(0.02, thickness - board * 2)

  // Page block — width X, height Y, thickness Z
  const pages = new THREE.Mesh(new THREE.BoxGeometry(pageW, pageH, pageT), [
    edgeMat, // +X
    edgeMat, // −X
    edgeMat, // +Y
    edgeMat, // −Y
    pageMat, // +Z (toward cover)
    pageMat, // −Z
  ])
  pages.castShadow = true
  pages.receiveShadow = true
  root.add(pages)

  // Back board at −Z — artwork on −Z face only
  const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, board), [
    clothMat,
    clothMat,
    clothMat,
    clothMat,
    clothMat,
    backMat,
  ])
  back.position.z = -thickness / 2 + board / 2
  back.castShadow = true
  root.add(back)

  // Spine along −X — artwork on −X face
  const spine = new THREE.Mesh(new THREE.BoxGeometry(board, height, thickness), [
    clothMat,
    spineMat,
    clothMat,
    clothMat,
    clothMat,
    clothMat,
  ])
  spine.position.x = -width / 2 + board / 2
  spine.castShadow = true
  root.add(spine)

  // Top/bottom cloth edges (shoulders)
  const top = new THREE.Mesh(new THREE.BoxGeometry(width * 0.98, board * 0.6, thickness * 0.92), clothMat)
  top.position.y = height / 2 - board * 0.2
  root.add(top)
  const bottom = top.clone()
  bottom.position.y = -height / 2 + board * 0.2
  root.add(bottom)

  // Front cover hinged at spine (left edge)
  const coverPivot = new THREE.Group()
  coverPivot.position.set(-width / 2 + board, 0, thickness / 2 - board / 2)

  // Cover artwork on +Z (toward camera when closed)
  const frontCover = new THREE.Mesh(new THREE.BoxGeometry(width - board, height, board), [
    clothMat,
    clothMat,
    clothMat,
    clothMat,
    frontMat,
    clothMat,
  ])
  // Pivot at left edge: shift geometry so left sits on hinge
  frontCover.geometry.translate((width - board) / 2, 0, 0)
  frontCover.castShadow = true
  coverPivot.add(frontCover)
  root.add(coverPivot)

  // Headbands
  const hbGeo = new THREE.BoxGeometry(width * 0.15, 0.008, thickness * 0.7)
  const hb = new THREE.Mesh(hbGeo, foilMat)
  hb.position.set(-width * 0.25, height / 2 - 0.004, 0)
  root.add(hb)
  const hb2 = hb.clone()
  hb2.position.y = -height / 2 + 0.004
  root.add(hb2)

  // Spine foil rules
  for (const y of [height * 0.3, -height * 0.3]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(board + 0.003, 0.009, thickness * 0.9), foilMat)
    band.position.set(-width / 2 + board / 2, y, 0)
    root.add(band)
  }

  // Contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 1.05, thickness * 1.4),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.set(0, -height / 2 - 0.002, 0.01)
  root.add(shadow)

  const restPosition = new THREE.Vector3(0, height / 2, 0)
  const restRotation = new THREE.Euler(0, 0, 0)

  return {
    volume,
    root,
    coverPivot,
    frontCover,
    slot,
    restPosition,
    restRotation,
    width,
    height,
    thickness,
  }
}

/** Pack face-out volumes along the shelf with tight gaps. */
export function layoutShelfPositions(books: BookHandle[], gap = 0.018): void {
  const total = books.reduce((a, b) => a + b.width, 0) + gap * Math.max(0, books.length - 1)
  let x = -total / 2
  books.forEach((book, i) => {
    x += book.width / 2
    book.restPosition.set(x, book.height / 2, 0)
    // Whisper of alternate yaw so the row feels set by hand
    book.restRotation.set(0, (i - (books.length - 1) / 2) * 0.012, 0)
    book.root.position.copy(book.restPosition)
    book.root.rotation.copy(book.restRotation)
    x += book.width / 2 + gap
  })
}
