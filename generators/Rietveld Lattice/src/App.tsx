import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Box as BoxIcon, Download, Grid3x3, Shuffle, Star } from 'lucide-react'
import { useStore } from './store'
import { buildModel } from './lib/model'
import { renderModel } from './lib/render'
import { buildSVG, downloadSVG } from './lib/svg-export'
import { saveFavorite } from './lib/favorites'
import Sidebar from './components/Sidebar'
import SvgPreview from './components/SvgPreview'
import ThreeViewport from './components/ThreeViewport'
import ContactSheet from './components/ContactSheet'
import Favorites from './components/Favorites'

type View = 'plot' | '3d' | 'contact'

const TABS: { id: View; label: string; icon: typeof Grid3x3 }[] = [
  { id: 'plot', label: 'Plot', icon: Grid3x3 },
  { id: '3d', label: '3D', icon: BoxIcon },
  { id: 'contact', label: 'Seeds', icon: Grid3x3 },
]

function SeedField() {
  const seed = useStore((s) => s.params.seed)
  const setSeed = useStore((s) => s.setSeed)
  const [text, setText] = useState(String(seed))
  // resync when the seed changes elsewhere (randomize, load favourite, pick)
  useEffect(() => setText(String(seed)), [seed])
  return (
    <input
      type="number"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const v = parseInt(e.target.value, 10)
        if (!Number.isNaN(v)) setSeed(v)
      }}
      onBlur={() => {
        if (text.trim() === '' || Number.isNaN(parseInt(text, 10))) setText(String(seed))
      }}
      className="w-24 rounded border border-edge bg-panel2 px-2 py-1 font-mono text-xs text-neutral-200 outline-none focus:border-destijl-yellow"
    />
  )
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#d4202a" />
      <rect x="12" y="1" width="9" height="13" fill="#1d3fb0" />
      <rect x="1" y="12" width="9" height="9" fill="#f4c20d" />
      <rect x="12" y="16" width="9" height="5" fill="#1a1a1a" />
    </svg>
  )
}

export default function App() {
  const params = useStore((s) => s.params)
  const randomizeSeed = useStore((s) => s.randomizeSeed)

  const [view, setView] = useState<View>('plot')
  const [favKey, setFavKey] = useState(0)

  // defer the heavy render so slider drags stay responsive
  const deferred = useDeferredValue(params)
  const model = useMemo(() => buildModel(deferred), [deferred])
  const render = useMemo(() => renderModel(model, deferred), [model, deferred])
  const busy = deferred !== params

  const onExport = () => {
    const m = buildModel(params)
    const r = renderModel(m, params)
    downloadSVG(buildSVG(r, params), `rietveld-${params.seed}.svg`)
  }
  const onSave = async () => {
    await saveFavorite(params)
    setFavKey((k) => k + 1)
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── header ─────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-edge bg-panel px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Logo />
          <div className="leading-tight">
            <h1 className="text-sm font-semibold tracking-wide text-neutral-100">Rietveld Lattice</h1>
            <p className="text-[10px] text-neutral-500">generative plotter lattice</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-neutral-500">seed</span>
          <SeedField />
          <button
            onClick={randomizeSeed}
            title="Randomize seed"
            className="rounded border border-edge p-1.5 text-neutral-300 hover:border-destijl-yellow hover:text-destijl-yellow"
          >
            <Shuffle size={14} />
          </button>
        </div>

        <div className="flex rounded border border-edge p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`rounded px-3 py-1 text-xs transition ${
                view === t.id ? 'bg-panel2 text-destijl-yellow' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <span
            className="hidden font-mono text-[11px] text-neutral-500 sm:inline"
            title={`${render.stats.segments.toLocaleString()} hatch/edge segments drawn`}
          >
            {render.stats.penPaths.toLocaleString()} pen paths · {render.stats.boxes} parts
            {busy ? ' · rendering…' : ''}
          </span>
          <button
            onClick={onSave}
            title="Save to favourites"
            className="flex items-center gap-1.5 rounded border border-edge px-3 py-1.5 text-xs text-neutral-200 hover:border-destijl-yellow hover:text-destijl-yellow"
          >
            <Star size={14} /> Save
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 rounded bg-destijl-yellow px-3 py-1.5 text-xs font-semibold text-black hover:brightness-110"
          >
            <Download size={14} /> Export SVG
          </button>
        </div>
      </header>

      {/* ── body ───────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        <aside className="w-[300px] shrink-0 border-r border-edge bg-panel">
          <Sidebar />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            {view === 'plot' && <SvgPreview render={render} strokeWidth={params.strokeWidth} margin={params.margin} />}
            {view === '3d' && <ThreeViewport model={model} />}
            {view === 'contact' && <ContactSheet onPick={() => setView('plot')} />}
          </div>

          <div className="border-t border-edge bg-panel">
            <div className="px-3 pt-1.5">
              <span className="text-[10px] uppercase tracking-wider text-neutral-600">Favourites</span>
            </div>
            <Favorites refreshKey={favKey} />
          </div>
        </main>
      </div>
    </div>
  )
}
