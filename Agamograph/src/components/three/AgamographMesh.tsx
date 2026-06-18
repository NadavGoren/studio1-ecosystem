import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  useProjectStore,
  getFrameAspect,
  type Slot,
} from '../../store/useProjectStore'
import { useLoadedImage } from '../../hooks/useLoadedImage'
import { buildSourceGeometry } from '../../lib/buildThreeGeometry'
import { makeCroppedCanvas, drawCanvasDividers } from '../../lib/croppedCanvas'
import type { GeometryParams, Source } from '../../lib/geometry'

/** Build a CanvasTexture of the cropped image for one slot; disposes on change. */
function useSourceTexture(slot: Slot): THREE.CanvasTexture | null {
  const image = useProjectStore((s) => s.images[slot])
  const slices = useProjectStore((s) => s.slices)
  const apexAngleDeg = useProjectStore((s) => s.apexAngleDeg)
  const canvas = useProjectStore((s) => s.canvas)
  const dividers = useProjectStore((s) => s.dividers)
  const img = useLoadedImage(image.url)
  const frameAspect = getFrameAspect({ slices, apexAngleDeg, canvas })
  // perceivedImageWidth = frameAspect · H (frameAspect = perceivedImageWidth / H).
  const perceivedImageWidth = frameAspect * canvas.height

  const texture = useMemo(() => {
    if (!img) return null
    const c = makeCroppedCanvas(img, image.natW, image.natH, frameAspect, image.crop)
    // Bake the printed dividers into the texture so the 3D fold matches the print.
    drawCanvasDividers(c, slices, perceivedImageWidth, dividers)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, image.crop, image.natW, image.natH, frameAspect, slices, perceivedImageWidth, dividers])

  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}

/** Build + dispose a per-source BufferGeometry; rebuilds only on N/θ/W/H. */
function useSourceGeometry(
  params: GeometryParams,
  source: Source,
): THREE.BufferGeometry {
  const geo = useMemo(
    () => buildSourceGeometry(params, source),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.slices, params.apexAngleDeg, params.width, params.height, source],
  )
  useEffect(() => () => geo.dispose(), [geo])
  return geo
}

type FaceMaterialProps = { texture: THREE.CanvasTexture | null; fallback: string }

function FaceMaterial({ texture, fallback }: FaceMaterialProps) {
  // KEY on texture presence: a meshStandardMaterial compiled WITHOUT a map will
  // not pick one up later without a shader recompile. Remounting on the
  // null→texture transition guarantees the map is included. (texture→texture
  // swaps, e.g. crop edits, don't need a recompile so the key stays stable.)
  return (
    <meshStandardMaterial
      key={texture ? 'textured' : 'plain'}
      map={texture ?? undefined}
      color={texture ? '#ffffff' : fallback}
      roughness={0.85}
      metalness={0}
      side={THREE.FrontSide}
    />
  )
}

export function AgamographMesh() {
  const slices = useProjectStore((s) => s.slices)
  const apexAngleDeg = useProjectStore((s) => s.apexAngleDeg)
  const canvas = useProjectStore((s) => s.canvas)

  const params: GeometryParams = {
    slices,
    apexAngleDeg,
    width: canvas.width,
    height: canvas.height,
  }

  const geoA = useSourceGeometry(params, 'A')
  const geoB = useSourceGeometry(params, 'B')
  const texA = useSourceTexture('A')
  const texB = useSourceTexture('B')

  return (
    <group>
      <mesh geometry={geoA} castShadow receiveShadow>
        <FaceMaterial texture={texA} fallback="#c2410c" />
      </mesh>
      <mesh geometry={geoB} castShadow receiveShadow>
        <FaceMaterial texture={texB} fallback="#1d4ed8" />
      </mesh>
    </group>
  )
}
