/**
 * Convert the pure geometry faces (spec §2.5) into a Three.js BufferGeometry,
 * one per source image (all A-faces, or all B-faces). Kept separate from the
 * pure `geometry.ts` so that module stays DOM/Three-free and unit-testable.
 *
 * The mesh is centered on the origin so OrbitControls rotates about its middle.
 * Non-indexed triangles → flat shading via computeVertexNormals (correct since
 * A-faces / B-faces never share vertices).
 */

import * as THREE from 'three'
import {
  buildFaces,
  computeDimensions,
  type GeometryParams,
  type Source,
} from './geometry'

export function buildSourceGeometry(
  params: GeometryParams,
  source: Source,
): THREE.BufferGeometry {
  const faces = buildFaces(params).filter((f) => f.source === source)
  const dims = computeDimensions(params)

  // center offsets
  const cx = params.width / 2
  const cy = params.height / 2
  const cz = dims.faceDepth / 2

  const positions = new Float32Array(faces.length * 6 * 3) // 2 tris × 3 verts × xyz
  const uvs = new Float32Array(faces.length * 6 * 2)

  let pi = 0
  let ui = 0
  for (const f of faces) {
    const [bl, br, tr, tl] = f.corners
    const [ubl, ubr, utr, utl] = f.uvs
    // two triangles: (bl,br,tr) and (bl,tr,tl) — winding gives outward normals
    const tri = [bl, br, tr, bl, tr, tl]
    const uvtri = [ubl, ubr, utr, ubl, utr, utl]
    for (const v of tri) {
      positions[pi++] = v[0] - cx
      positions[pi++] = v[1] - cy
      positions[pi++] = v[2] - cz
    }
    for (const uv of uvtri) {
      uvs[ui++] = uv[0]
      uvs[ui++] = uv[1]
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.computeVertexNormals()
  return geo
}
