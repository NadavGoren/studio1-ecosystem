import { useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { useProjectStore } from '../../store/useProjectStore'
import { useLanguage } from '../../i18n/LanguageProvider'
import { buildFilenameBase } from '../../lib/geometry'
import { downloadBlob } from '../../lib/exportSheet'
import { AgamographMesh } from './AgamographMesh'

type Captured = { gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera }

/** Lifts the renderer/scene/camera out of the Canvas so we can snapshot it. */
function CaptureBridge({ sink }: { sink: { current: Captured | null } }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    sink.current = { gl, scene, camera }
  }, [gl, scene, camera, sink])
  return null
}

export function ThreePreview() {
  const { t } = useLanguage()
  const canvas = useProjectStore((s) => s.canvas)
  const slices = useProjectStore((s) => s.slices)
  const apexAngleDeg = useProjectStore((s) => s.apexAngleDeg)
  const hasAny = useProjectStore((s) => !!s.images.A.url || !!s.images.B.url)

  const captured = useRef<Captured | null>(null)

  function saveJpg() {
    const c = captured.current
    if (!c) return
    // Force a fresh draw so the (preserved) buffer is current, then snapshot.
    c.gl.render(c.scene, c.camera)
    const base = buildFilenameBase({
      width: canvas.width,
      height: canvas.height,
      unit: canvas.unit,
      slices,
      apexAngleDeg,
    })
    c.gl.domElement.toBlob(
      (blob) => {
        if (blob) downloadBlob(blob, `${base}_3d.jpg`)
      },
      'image/jpeg',
      0.95,
    )
  }

  const W = canvas.width
  const H = canvas.height
  const span = Math.max(W, H)
  const dist = span * 1.9 + 8
  const tilt = THREE.MathUtils.degToRad(25)

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-sm font-medium text-neutral-700">
        {t('preview.3d')}
      </figcaption>
      <div className="relative h-[320px] w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true }}
          camera={{ position: [span * 0.35, span * 0.15, dist], fov: 35, near: 0.1, far: dist * 5 }}
        >
          <color attach="background" args={['#f4f4f5']} />
          <CaptureBridge sink={captured} />

          {/* Medium-realism studio lighting — all local, no HDR fetch.
              Low fill + a raking key give the folds real contrast and let the
              V-grooves cast shadows on each other. */}
          <hemisphereLight args={['#ffffff', '#c8c8c8', 0.25]} />
          <ambientLight intensity={0.15} />
          {/* Key — raking from the side so the accordion grooves self-shadow. */}
          <directionalLight
            position={[span * 1.3, span * 1.0, span * 0.9]}
            intensity={2.2}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0004}
            shadow-normalBias={0.02}
            shadow-camera-near={0.1}
            shadow-camera-far={dist * 4}
            shadow-camera-left={-span}
            shadow-camera-right={span}
            shadow-camera-top={span}
            shadow-camera-bottom={-span}
          />
          {/* Soft fill from the opposite side so shadows aren't pure black. */}
          <directionalLight
            position={[-span * 0.9, span * 0.3, span * 0.5]}
            intensity={0.35}
          />

          <AgamographMesh />

          <ContactShadows
            position={[0, -H / 2 - 0.4, 0]}
            scale={span * 2.4}
            blur={2.0}
            far={H * 1.2}
            opacity={0.5}
            color="#1a1a1a"
            resolution={1024}
          />

          <OrbitControls
            enablePan={false}
            enableZoom
            enableDamping
            dampingFactor={0.08}
            target={[0, 0, 0]}
            minAzimuthAngle={-Math.PI / 2}
            maxAzimuthAngle={Math.PI / 2}
            minPolarAngle={Math.PI / 2 - tilt}
            maxPolarAngle={Math.PI / 2 + tilt}
            minDistance={dist * 0.5}
            maxDistance={dist * 1.7}
          />
        </Canvas>

        <button
          type="button"
          onClick={saveJpg}
          disabled={!hasAny}
          title={t('preview.save3d')}
          aria-label={t('preview.save3d')}
          className="absolute end-3 top-3 inline-flex items-center justify-center rounded-md border border-neutral-200 bg-white/85 p-2 text-neutral-700 shadow-sm backdrop-blur transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>

        {!hasAny && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
            {t('preview.needBoth')}
          </div>
        )}
      </div>
      <p className="text-xs text-neutral-400">{t('preview.3dHelp')}</p>
    </figure>
  )
}
