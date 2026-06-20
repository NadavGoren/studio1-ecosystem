import { useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Edges, OrbitControls } from '@react-three/drei'
import { Euler, Matrix4 } from 'three'
import type { BeamModel, Box, Mat3 } from '../types'
import { PEN_HEX } from '../lib/palette'

function eulerOf(rot?: Mat3): [number, number, number] | undefined {
  if (!rot) return undefined
  const m = new Matrix4().set(rot[0], rot[1], rot[2], 0, rot[3], rot[4], rot[5], 0, rot[6], rot[7], rot[8], 0, 0, 0, 0, 1)
  const e = new Euler().setFromRotationMatrix(m)
  return [e.x, e.y, e.z]
}

function BoxMesh({ box }: { box: Box }) {
  const color = box.kind === 'board' ? PEN_HEX[box.color] : '#3a3a3a'
  const size: [number, number, number] = [box.half[0] * 2, box.half[1] * 2, box.half[2] * 2]
  return (
    <mesh position={box.center} rotation={eulerOf(box.rot)}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={box.kind === 'board' ? 0.9 : 0.8}
        roughness={0.65}
        metalness={0}
      />
      <Edges color="#161616" />
    </mesh>
  )
}

export default function ThreeViewport({ model }: { model: BeamModel }) {
  const dist = useMemo(() => {
    const { min, max } = model.bounds
    const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 4)
    return extent * 1.9
  }, [model])

  // react-three-fiber measures its container once on mount; if it mounts in a
  // transiently zero-sized box (e.g. a just-revealed tab), nudge a re-measure.
  useEffect(() => {
    const id = setTimeout(() => window.dispatchEvent(new Event('resize')), 60)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className="h-full w-full">
      <Canvas camera={{ position: [dist, dist * 0.78, dist], fov: 35 }} dpr={[1, 2]}>
        <color attach="background" args={['#e9e7e1']} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[10, 18, 12]} intensity={1.1} />
        <directionalLight position={[-12, 6, -8]} intensity={0.4} />
        <group>
          {model.boxes.map((b) => (
            <BoxMesh key={b.id} box={b} />
          ))}
        </group>
        <OrbitControls makeDefault enableDamping />
      </Canvas>
    </div>
  )
}
