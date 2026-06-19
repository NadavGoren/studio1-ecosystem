import type { Vec3 } from '../types'

export interface Projected {
  x: number
  y: number
  /** view depth — larger = nearer the viewer (used for sorting & occlusion) */
  depth: number
}

export interface Projector {
  azDeg: number
  elDeg: number
  project(p: Vec3): Projected
  rotate(d: Vec3): Vec3
}

/**
 * Axonometric (parallel) projection. Rotate the world by azimuth about the
 * vertical axis, then tilt by elevation, then drop depth orthographically.
 * Parallel lines stay parallel — no perspective convergence. Isometric is
 * az = 45°, el ≈ 35.26°; any az/el gives a dimetric/trimetric variant.
 *
 * The viewer sits on +z after rotation, so a larger rotated-z means nearer.
 */
export function makeProjector(azDeg: number, elDeg: number): Projector {
  const az = (azDeg * Math.PI) / 180
  const el = (elDeg * Math.PI) / 180
  const ca = Math.cos(az)
  const sa = Math.sin(az)
  const ce = Math.cos(el)
  const se = Math.sin(el)

  const rotate = (p: Vec3): Vec3 => {
    // yaw about vertical (y)
    const x1 = p[0] * ca + p[2] * sa
    const z1 = -p[0] * sa + p[2] * ca
    const y1 = p[1]
    // tilt about horizontal (x)
    const y2 = y1 * ce - z1 * se
    const z2 = y1 * se + z1 * ce
    return [x1, y2, z2]
  }

  return {
    azDeg,
    elDeg,
    rotate,
    project(p: Vec3): Projected {
      const r = rotate(p)
      // screen y grows downward, so flip world-up
      return { x: r[0], y: -r[1], depth: r[2] }
    },
  }
}
