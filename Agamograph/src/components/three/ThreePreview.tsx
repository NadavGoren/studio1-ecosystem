import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { useProjectStore } from '../../store/useProjectStore'
import { useLanguage } from '../../i18n/LanguageProvider'
import { AgamographMesh } from './AgamographMesh'

export function ThreePreview() {
  const { t } = useLanguage()
  const canvas = useProjectStore((s) => s.canvas)
  const hasAny = useProjectStore((s) => !!s.images.A.url || !!s.images.B.url)

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
      <div className="relative h-[460px] w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [span * 0.35, span * 0.15, dist], fov: 35, near: 0.1, far: dist * 5 }}
        >
          <color attach="background" args={['#f4f4f5']} />

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
