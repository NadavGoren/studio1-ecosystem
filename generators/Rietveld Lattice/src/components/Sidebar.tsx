import { useStore } from '../store'
import { Section, SelectRow, Slider, Toggle } from './Controls'
import type { ColourStrategy, Orientation, PaperSize } from '../types'

export default function Sidebar() {
  const p = useStore((s) => s.params)
  const set = useStore((s) => s.set)

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <Section title="Lattice">
        <Slider label="Beam count / density" value={p.beamCount} min={10} max={200} onChange={(v) => set('beamCount', v)} />
        <Slider label="Grid — X lanes" value={p.gridX} min={3} max={16} onChange={(v) => set('gridX', v)} />
        <Slider label="Grid — Y lanes" value={p.gridY} min={3} max={18} onChange={(v) => set('gridY', v)} />
        <Slider label="Grid — Z (depth) lanes" value={p.gridZ} min={2} max={12} onChange={(v) => set('gridZ', v)} />
        <Slider label="Beam length — min" value={p.beamLenMin} min={1} max={12} step={0.5} onChange={(v) => set('beamLenMin', Math.min(v, p.beamLenMax))} format={(v) => v.toFixed(1)} />
        <Slider label="Beam length — max" value={p.beamLenMax} min={1} max={16} step={0.5} onChange={(v) => set('beamLenMax', Math.max(v, p.beamLenMin))} format={(v) => v.toFixed(1)} />
        <Slider label="Overrun (cantilever)" value={p.overrun} min={0} max={4} step={0.1} onChange={(v) => set('overrun', v)} format={(v) => v.toFixed(1)} />
        <Slider label="Cross-section" value={p.crossSection} min={0.04} max={0.6} step={0.01} onChange={(v) => set('crossSection', v)} format={(v) => v.toFixed(2)} />
      </Section>

      <Section title="Composition">
        <Slider label="Signature ↔ free lattice" value={p.dominance} min={0} max={1} step={0.01} onChange={(v) => set('dominance', v)} format={(v) => (v < 0.5 ? `free ${Math.round((1 - v) * 100)}%` : `signature ${Math.round(v * 100)}%`)} />
        <Slider label="Board thickness" value={p.boardThickness} min={0.05} max={0.8} step={0.01} onChange={(v) => set('boardThickness', v)} format={(v) => v.toFixed(2)} />
        <Slider label="Extra colour boards" value={p.extraBoards} min={0} max={8} onChange={(v) => set('extraBoards', v)} />
      </Section>

      <Section title="Projection (axonometric)">
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
      </Section>

      <Section title="Colour & pens">
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
        <Toggle label="Hatch beam faces (black)" checked={p.hatchBeams} onChange={(v) => set('hatchBeams', v)} />
      </Section>

      <Section title="Hatch">
        <Slider label="Spacing" value={p.hatchSpacing} min={0.4} max={4} step={0.1} onChange={(v) => set('hatchSpacing', v)} format={(v) => `${v.toFixed(1)} mm`} />
        <Slider label="Angle — X faces" value={p.angleX} min={0} max={180} onChange={(v) => set('angleX', v)} format={(v) => `${v}°`} />
        <Slider label="Angle — Y faces" value={p.angleY} min={0} max={180} onChange={(v) => set('angleY', v)} format={(v) => `${v}°`} />
        <Slider label="Angle — Z faces" value={p.angleZ} min={0} max={180} onChange={(v) => set('angleZ', v)} format={(v) => `${v}°`} />
        <Slider label="Depth-falloff (far = lighter)" value={p.depthFalloff} min={0} max={2} step={0.05} onChange={(v) => set('depthFalloff', v)} format={(v) => v.toFixed(2)} />
        <Toggle label="Cross-hatch" checked={p.crossHatch} onChange={(v) => set('crossHatch', v)} />
      </Section>

      <Section title="Fill occlusion">
        <Slider label="X-ray ↔ solid" value={p.occlusion} min={0} max={100} onChange={(v) => set('occlusion', v)} format={(v) => (v <= 2 ? 'x-ray' : v >= 98 ? 'solid' : `see-thru ${v}`)} />
        <p className="text-[10px] leading-relaxed text-neutral-500">
          Edges always draw. This only clips the colour fills behind nearer faces — left is full x-ray, right is clean occluded colour.
        </p>
      </Section>

      <Section title="Paper & pen" defaultOpen={false}>
        <SelectRow<PaperSize>
          label="Size"
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
      </Section>
    </div>
  )
}
