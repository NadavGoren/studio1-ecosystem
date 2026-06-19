import type { Axis, Box, Vec3 } from '../types'

const OTHERS: Record<Axis, [Axis, Axis]> = {
  x: ['y', 'z'],
  y: ['x', 'z'],
  z: ['x', 'y'],
}
const AXES: Axis[] = ['x', 'y', 'z']
const IDX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 }

export interface Face {
  axis: Axis // outward normal axis
  sign: number // +1 / -1
  normal: Vec3
  corners: [Vec3, Vec3, Vec3, Vec3] // a simple (convex) quad cycle
  /** is this one of the two faces normal to the beam's run axis (an end-cap)? */
  isCap: boolean
  /** is this one of the two large faces of a board (normal to its thin axis)? */
  isBoardFace: boolean
}

function corner(box: Box, sx: number, sy: number, sz: number): Vec3 {
  return [
    box.center[0] + sx * box.half[0],
    box.center[1] + sy * box.half[1],
    box.center[2] + sz * box.half[2],
  ]
}

export function boxCorners(box: Box): Vec3[] {
  const out: Vec3[] = []
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) out.push(corner(box, sx, sy, sz))
  return out
}

export function boxFaces(box: Box): Face[] {
  const faces: Face[] = []
  for (const axis of AXES) {
    const [u, v] = OTHERS[axis]
    for (const sign of [-1, 1]) {
      const s: Record<Axis, number> = { x: 0, y: 0, z: 0 }
      s[axis] = sign
      const mk = (su: number, sv: number): Vec3 => {
        const t = { ...s }
        t[u] = su
        t[v] = sv
        return [box.center[0] + t.x * box.half[0], box.center[1] + t.y * box.half[1], box.center[2] + t.z * box.half[2]]
      }
      const normal: Vec3 = [0, 0, 0]
      normal[IDX[axis]] = sign
      faces.push({
        axis,
        sign,
        normal,
        corners: [mk(-1, -1), mk(1, -1), mk(1, 1), mk(-1, 1)],
        isCap: box.kind === 'beam' && axis === box.runAxis,
        isBoardFace: box.kind === 'board' && axis === box.thinAxis,
      })
    }
  }
  return faces
}

export function boxEdges(box: Box): [Vec3, Vec3][] {
  const edges: [Vec3, Vec3][] = []
  for (const e of AXES) {
    const [u, v] = OTHERS[e]
    for (const su of [-1, 1]) {
      for (const sv of [-1, 1]) {
        const a: Record<Axis, number> = { x: 0, y: 0, z: 0 }
        a[e] = -1
        a[u] = su
        a[v] = sv
        const b = { ...a }
        b[e] = 1
        edges.push([corner(box, a.x, a.y, a.z), corner(box, b.x, b.y, b.z)])
      }
    }
  }
  return edges
}
