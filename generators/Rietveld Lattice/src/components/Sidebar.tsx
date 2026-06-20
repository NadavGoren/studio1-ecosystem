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

export default function Sidebar() {
  const p = useStore((s) => s.params)
  const set = useStore((s) => s.set)
  const [tab, setTab] = useState<Tab>('compose')

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
                  { value: 'architecture', label: 'Architecture' },
                ]}
              />
              <p className="text-[10px] leading-relaxed text-neutral-500">
                <b>Lattice</b> — open thicket round the seat+back. <b>Chair</b> — Red-and-Blue chair. <b>Architecture</b> —
                Schröder-house planes.
              </p>
              <Slider label="Board tilt / recline" value={p.boardTilt} min={0} max={1} step={0.01} onChange={(v) => set('boardTilt', v)} format={(v) => (v < 0.02 ? 'flat' : `${Math.round(v * 100)}%`)} />
              <Slider label="Verticality" value={p.verticality} min={0} max={1} step={0.01} onChange={(v) => set('verticality', v)} format={(v) => (v < 0.4 ? 'horizontal' : v > 0.6 ? 'upright' : 'balanced')} />
              <Slider label="Asymmetry" value={p.asymmetry} min={0} max={1} step={0.01} onChange={(v) => set('asymmetry', v)} format={(v) => (v < 0.02 ? 'centred' : `${Math.round(v * 100)}%`)} />
              <Slider label="Signature ↔ free" value={p.dominance} min={0} max={1} step={0.01} onChange={(v) => set('dominance', v)} format={(v) => (v < 0.5 ? `free ${Math.round((1 - v) * 100)}%` : `signature ${Math.round(v * 100)}%`)} />
              <Slider label="Beam density" value={p.beamCount} min={10} max={200} onChange={(v) => set('beamCount', v)} />
              <Slider label="Overrun (cantilever)" value={p.overrun} min={0} max={4} step={0.1} onChange={(v) => set('overrun', v)} format={(v) => v.toFixed(1)} />
              <Slider label="Extra colour boards" value={p.extraBoards} min={0} max={8} onChange={(v) => set('extraBoards', v)} />
            </div>
            <Section title="More — grid & proportions" defaultOpen={false}>
              <Slider label="Grid — X lanes" value={p.gridX} min={3} max={16} onChange={(v) => set('gridX', v)} />
              <Slider label="Grid — Y lanes" value={p.gridY} min={3} max={18} onChange={(v) => set('gridY', v)} />
              <Slider label="Grid — Z (depth) lanes" value={p.gridZ} min={2} max={12} onChange={(v) => set('gridZ', v)} />
              <Slider label="Beam length — min" value={p.beamLenMin} min={1} max={12} step={0.5} onChange={(v) => set('beamLenMin', Math.min(v, p.beamLenMax))} format={(v) => v.toFixed(1)} />
              <Slider label="Beam length — max" value={p.beamLenMax} min={1} max={16} step={0.5} onChange={(v) => set('beamLenMax', Math.max(v, p.beamLenMin))} format={(v) => v.toFixed(1)} />
              <Slider label="Cross-section" value={p.crossSection} min={0.04} max={0.6} step={0.01} onChange={(v) => set('crossSection', v)} format={(v) => v.toFixed(2)} />
              <Slider label="Board thickness" value={p.boardThickness} min={0.05} max={0.8} step={0.01} onChange={(v) => set('boardThickness', v)} format={(v) => v.toFixed(2)} />
            </Section>
          </>
        )}

        {/* ── LOOK — viewpoint, depth, hatch, colour ─────────────────────── */}
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
              <Slider label="Hatch spacing" value={p.hatchSpacing} min={0.4} max={4} step={0.1} onChange={(v) => set('hatchSpacing', v)} format={(v) => `${v.toFixed(1)} mm`} />
              <Slider label="Depth-falloff" value={p.depthFalloff} min={0} max={2} step={0.05} onChange={(v) => set('depthFalloff', v)} format={(v) => v.toFixed(2)} />
              <Toggle label="Cross-hatch" checked={p.crossHatch} onChange={(v) => set('crossHatch', v)} />
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
              ]}
            />
            <SelectRow<Orientation>
              label="Orientation"
              value={p.orientation}
              onChange={(v) => set('orientation', v)}
              options={[
                { value: 'portrait', label: 'Portrait' },
                { value: 'landscape', label: 'Landscape' },
              ]}
            />
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
