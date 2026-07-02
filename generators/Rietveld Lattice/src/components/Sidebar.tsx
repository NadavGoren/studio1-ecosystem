import { useState } from 'react'
import { useStore } from '../store'
import { Section, SelectRow, Slider, Toggle } from './Controls'
import type { ColourStrategy, Orientation, PaperSize, StructureMode } from '../types'

type Tab = 'compose' | 'look' | 'output'
const TABS: { id: Tab; label: string }[] = [
  { id: 'compose', label: 'Compose' },
  { id: 'look', label: 'Look' },
  { id: 'output', label: 'Output' },
]

/** one honest sentence per mode — what rule builds the composition */
const MODE_LOGIC: Record<StructureMode, string> = {
  lattice:
    'A thicket grown around the seat+back signature. The seat rests on carrier beams and posts; every free stick snaps to the grid and must LAP something already built — nothing floats.',
  chair:
    'The Red-and-Blue chair frame: four posts, side rails lapped on their inner faces, cross rails carrying the overhanging seat, arm rails resting on the post tops, a reclined back.',
  buffet:
    'The 1919 buffet: a symmetric stack — plinth · wide counter · shelf · top — on short posts between tiers, long protruding rails under the slabs, colour panels closing the rear bays.',
  architecture:
    'A Schröder-house corner: three slabs pinwheel around the core, wall planes stand flush with slab edges between storeys, a mast rises past the roof, a balustrade guards the cantilever.',
  tower:
    'A De Stijl high-rise study: floors clamped between four continuous posts. The cantilever rotates a quarter-turn per floor, colour panels close the bays, curb rails read as balconies.',
  joinery:
    'A strict woven cage on a 3D sub-grid: a beam on every grid line, each overrunning its outermost crossing by one constant section width; families lap face-to-face on separate planes.',
}

export default function Sidebar() {
  const p = useStore((s) => s.params)
  const set = useStore((s) => s.set)
  const [tab, setTab] = useState<Tab>('compose')

  const m = p.structure
  const asymmetrySlider = (
    <Slider label="Asymmetry" value={p.asymmetry} min={0} max={1} step={0.01} onChange={(v) => set('asymmetry', v)} format={(v) => (v < 0.02 ? 'centred' : `${Math.round(v * 100)}%`)} />
  )
  const overrunSlider = (label = 'Overrun (joint ends)') => (
    <Slider label={label} value={p.overrun} min={0} max={4} step={0.1} onChange={(v) => set('overrun', v)} format={(v) => v.toFixed(1)} />
  )
  const reclineSlider = (
    <Slider label="Back recline" value={p.boardTilt} min={0} max={1} step={0.01} onChange={(v) => set('boardTilt', v)} format={(v) => (v < 0.02 ? 'upright' : `${Math.round(v * 100)}%`)} />
  )

  return (
    <div className="flex h-full flex-col">
      {/* tab bar */}
      <div className="flex gap-1 border-b border-edge p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition ${
              tab === t.id ? 'bg-panel2 text-destijl-yellow' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto pb-6">
        {/* ── COMPOSE — the shape & composition ──────────────────────────── */}
        {tab === 'compose' && (
          <>
            <div className="space-y-3 px-4 pt-3">
              <SelectRow<StructureMode>
                label="Structure"
                value={p.structure}
                onChange={(v) => set('structure', v)}
                options={[
                  { value: 'lattice', label: 'Lattice' },
                  { value: 'chair', label: 'Chair' },
                  { value: 'buffet', label: 'Buffet' },
                  { value: 'architecture', label: 'Architecture' },
                  { value: 'tower', label: 'Tower' },
                  { value: 'joinery', label: 'Joinery' },
                ]}
              />
              <p className="text-[10px] leading-relaxed text-neutral-500">{MODE_LOGIC[m]}</p>

              {m === 'lattice' && (
                <>
                  {reclineSlider}
                  <Slider label="Verticality" value={p.verticality} min={0} max={1} step={0.01} onChange={(v) => set('verticality', v)} format={(v) => (v < 0.4 ? 'horizontal' : v > 0.6 ? 'upright' : 'balanced')} />
                  {asymmetrySlider}
                  <Slider label="Signature ↔ free" value={p.dominance} min={0} max={1} step={0.01} onChange={(v) => set('dominance', v)} format={(v) => (v < 0.5 ? `free ${Math.round((1 - v) * 100)}%` : `signature ${Math.round(v * 100)}%`)} />
                  <Slider label="Beam density" value={p.beamCount} min={10} max={200} onChange={(v) => set('beamCount', v)} />
                  {overrunSlider()}
                  <Slider label="Resting colour boards" value={p.extraBoards} min={0} max={8} onChange={(v) => set('extraBoards', v)} />
                </>
              )}
              {m === 'chair' && (
                <>
                  {reclineSlider}
                  {asymmetrySlider}
                  {overrunSlider('Rail overrun')}
                </>
              )}
              {m === 'buffet' && (
                <>
                  {asymmetrySlider}
                  {overrunSlider('Rail ends / post tips')}
                  <Slider label="Rear colour panels" value={p.extraBoards} min={0} max={3} onChange={(v) => set('extraBoards', v)} />
                </>
              )}
              {m === 'architecture' && (
                <>
                  {asymmetrySlider}
                  <Slider label="Wall planes" value={p.extraBoards} min={0} max={4} onChange={(v) => set('extraBoards', v)} />
                  <Slider label="Accent sticks" value={p.beamCount} min={10} max={200} onChange={(v) => set('beamCount', v)} format={(v) => `${Math.round(v * 0.12)}`} />
                  {overrunSlider('Mast tip / rail overrun')}
                </>
              )}
              {m === 'tower' && (
                <>
                  <Slider label="Floors" value={p.gridLinesY} min={2} max={6} onChange={(v) => set('gridLinesY', v)} />
                  <Slider label="Infill colour panels" value={p.extraBoards} min={0} max={5} onChange={(v) => set('extraBoards', v)} />
                  {asymmetrySlider}
                  {overrunSlider('Post tips')}
                </>
              )}
              {m === 'joinery' && (
                <>
                  <Slider label="Grid lines — X" value={p.gridLinesX} min={2} max={6} onChange={(v) => set('gridLinesX', v)} />
                  <Slider label="Grid lines — Y (tiers)" value={p.gridLinesY} min={2} max={6} onChange={(v) => set('gridLinesY', v)} />
                  <Slider label="Grid lines — Z (depth)" value={p.gridLinesZ} min={2} max={6} onChange={(v) => set('gridLinesZ', v)} />
                  <Slider label="Joint overhang" value={p.jointOverhang} min={0.2} max={3} step={0.1} onChange={(v) => set('jointOverhang', v)} format={(v) => `${v.toFixed(1)}× section`} />
                  <Slider label="Colour panels" value={p.gridPlates} min={0} max={8} onChange={(v) => set('gridPlates', v)} />
                  <Slider label="Asymmetry (panel balance)" value={p.asymmetry} min={0} max={1} step={0.01} onChange={(v) => set('asymmetry', v)} format={(v) => (v < 0.02 ? 'centred' : `${Math.round(v * 100)}%`)} />
                </>
              )}
            </div>
            <Section title="More — grid & proportions" defaultOpen={false}>
              <Slider label="Grid — X lanes" value={p.gridX} min={3} max={16} onChange={(v) => set('gridX', v)} />
              <Slider label="Grid — Y lanes" value={p.gridY} min={3} max={18} onChange={(v) => set('gridY', v)} />
              <Slider label="Grid — Z (depth) lanes" value={p.gridZ} min={2} max={12} onChange={(v) => set('gridZ', v)} />
              {m === 'lattice' && (
                <>
                  <Slider label="Beam length — min" value={p.beamLenMin} min={1} max={12} step={0.5} onChange={(v) => set('beamLenMin', Math.min(v, p.beamLenMax))} format={(v) => v.toFixed(1)} />
                  <Slider label="Beam length — max" value={p.beamLenMax} min={1} max={16} step={0.5} onChange={(v) => set('beamLenMax', Math.max(v, p.beamLenMin))} format={(v) => v.toFixed(1)} />
                </>
              )}
              <Slider label="Cross-section" value={p.crossSection} min={0.04} max={0.6} step={0.01} onChange={(v) => set('crossSection', v)} format={(v) => v.toFixed(2)} />
              <Slider label="Board thickness" value={p.boardThickness} min={0.05} max={0.8} step={0.01} onChange={(v) => set('boardThickness', v)} format={(v) => v.toFixed(2)} />
            </Section>
          </>
        )}

        {/* ── LOOK — viewpoint, light, depth, hatch, colour ───────────────── */}
        {tab === 'look' && (
          <>
            <div className="space-y-3 px-4 pt-3">
              <Slider label="Azimuth" value={p.azimuth} min={0} max={90} onChange={(v) => set('azimuth', v)} format={(v) => `${v}°`} />
              <Slider label="Elevation" value={p.elevation} min={5} max={80} onChange={(v) => set('elevation', v)} format={(v) => `${v}°`} />
              <button
                onClick={() => {
                  set('azimuth', 45)
                  set('elevation', 35)
                }}
                className="text-[11px] text-neutral-500 underline-offset-2 hover:text-destijl-yellow hover:underline"
              >
                reset to isometric (45° / 35°)
              </button>
              <Slider label="Hidden lines (edges)" value={p.hiddenLine} min={0} max={100} onChange={(v) => set('hiddenLine', v)} format={(v) => (v <= 2 ? 'x-ray' : v >= 98 ? 'solid' : `depth ${v}`)} />
              <Slider label="Fill occlusion" value={p.occlusion} min={0} max={100} onChange={(v) => set('occlusion', v)} format={(v) => (v <= 2 ? 'x-ray' : v >= 98 ? 'solid' : `see-thru ${v}`)} />
              <Slider label="Hatch spacing (darkest)" value={p.hatchSpacing} min={0.2} max={4} step={0.05} onChange={(v) => set('hatchSpacing', v)} format={(v) => `${v.toFixed(2)} mm`} />
              <SelectRow<ColourStrategy>
                label="Red/blue order"
                value={p.colourStrategy}
                onChange={(v) => set('colourStrategy', v)}
                options={[
                  { value: 'alternating', label: 'Alternating' },
                  { value: 'weighted', label: 'Weighted' },
                  { value: 'positional', label: 'Positional' },
                ]}
              />
              {p.colourStrategy === 'weighted' && (
                <Slider label="Red share" value={p.redShare} min={0} max={1} step={0.05} onChange={(v) => set('redShare', v)} format={(v) => `${Math.round(v * 100)}%`} />
              )}
              <Toggle label="Yellow end-caps" checked={p.yellowCaps} onChange={(v) => set('yellowCaps', v)} />
            </div>
            <Section title="Light & shade" defaultOpen>
              <p className="text-[10px] leading-relaxed text-neutral-500">
                One world light shades every face by which way it points — tops light, the lit flank mid, the far flank
                dark. Tones snap to discrete bands so each x/y/z region reads as one exact grey.
              </p>
              <Slider label="Light azimuth" value={p.lightAzimuth} min={-180} max={180} onChange={(v) => set('lightAzimuth', v)} format={(v) => `${v}°`} />
              <Slider label="Light elevation" value={p.lightElevation} min={5} max={85} onChange={(v) => set('lightElevation', v)} format={(v) => `${v}°`} />
              <Slider label="Shade contrast" value={p.shadeContrast} min={0} max={1} step={0.01} onChange={(v) => set('shadeContrast', v)} format={(v) => (v < 0.02 ? 'flat' : `${Math.round(v * 100)}%`)} />
              <Slider label="Tone bands" value={p.shadeLevels} min={2} max={8} onChange={(v) => set('shadeLevels', v)} />
              <Toggle label="Lit faces = open paper" checked={p.litWhite} onChange={(v) => set('litWhite', v)} />
              <Toggle label="Cross-hatch the shadow band" checked={p.crossHatch} onChange={(v) => set('crossHatch', v)} />
              <Slider label="Depth-falloff (aerial)" value={p.depthFalloff} min={0} max={2} step={0.05} onChange={(v) => set('depthFalloff', v)} format={(v) => v.toFixed(2)} />
            </Section>
            <Section title="More — hatch detail" defaultOpen={false}>
              <Slider label="Hatch angle — X faces" value={p.angleX} min={0} max={180} onChange={(v) => set('angleX', v)} format={(v) => `${v}°`} />
              <Slider label="Hatch angle — Y faces" value={p.angleY} min={0} max={180} onChange={(v) => set('angleY', v)} format={(v) => `${v}°`} />
              <Slider label="Hatch angle — Z faces" value={p.angleZ} min={0} max={180} onChange={(v) => set('angleZ', v)} format={(v) => `${v}°`} />
              <Toggle label="Hatch beam faces (black)" checked={p.hatchBeams} onChange={(v) => set('hatchBeams', v)} />
            </Section>
          </>
        )}

        {/* ── OUTPUT — paper & pen ───────────────────────────────────────── */}
        {tab === 'output' && (
          <div className="space-y-3 px-4 pt-3">
            <SelectRow<PaperSize>
              label="Paper size"
              value={p.paperSize}
              onChange={(v) => set('paperSize', v)}
              options={[
                { value: 'A2', label: 'A2 (max)' },
                { value: 'A3', label: 'A3 (default)' },
                { value: 'A4', label: 'A4' },
                { value: 'A5', label: 'A5' },
              ]}
            />
            <div>
              <div className="mb-1.5 text-xs text-neutral-300">Orientation</div>
              <div className="flex rounded border border-edge p-0.5">
                {(['portrait', 'landscape'] as Orientation[]).map((o) => (
                  <button
                    key={o}
                    onClick={() => set('orientation', o)}
                    className={`flex-1 rounded px-2 py-1 text-[11px] capitalize transition ${
                      p.orientation === o ? 'bg-panel2 text-destijl-yellow' : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <Slider label="Margin" value={p.margin} min={0} max={40} onChange={(v) => set('margin', v)} format={(v) => `${v} mm`} />
            <Slider label="Stroke width" value={p.strokeWidth} min={0.1} max={1} step={0.05} onChange={(v) => set('strokeWidth', v)} format={(v) => `${v.toFixed(2)} mm`} />
            <p className="pt-1 text-[10px] leading-relaxed text-neutral-500">
              Stroke-only SVG, one Inkscape layer per pen (black structure · red/blue boards · yellow caps). A3 default, A2 max.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
