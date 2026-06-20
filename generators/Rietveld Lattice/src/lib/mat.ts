import type { Mat3, Vec3 } from '../types'

// Minimal 3x3 rotation support, only what tilted boards need.
// Mat3 is row-major: [m00,m01,m02, m10,m11,m12, m20,m21,m22].

export const IDENT3: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

/** Rotation matrix of `angle` radians about a (not-necessarily-unit) axis. */
export function rotAxis(axis: Vec3, angle: number): Mat3 {
  const len = Math.hypot(axis[0], axis[1], axis[2]) || 1
  const x = axis[0] / len
  const y = axis[1] / len
  const z = axis[2] / len
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const t = 1 - c
  return [
    t * x * x + c,
    t * x * y - s * z,
    t * x * z + s * y,
    t * x * y + s * z,
    t * y * y + c,
    t * y * z - s * x,
    t * x * z - s * y,
    t * y * z + s * x,
    t * z * z + c,
  ]
}

export function mulMatVec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ]
}
