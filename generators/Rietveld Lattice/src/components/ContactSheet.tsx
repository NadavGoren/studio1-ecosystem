import { useDeferredValue, useState } from 'react'
import { Shuffle } from 'lucide-react'
import { useStore } from '../store'
import Thumbnail from './Thumbnail'

function randSeeds(n: number): number[] {
  const set = new Set<number>()
  while (set.size < n) set.add(Math.floor(Math.random() * 1_000_000)) // distinct → no duplicate keys
  return [...set]
}

export default function ContactSheet({ onPick }: { onPick: () => void }) {
  const params = useStore((s) => s.params)
  const deferred = useDeferredValue(params) // keep slider edits responsive while 24 thumbs rebuild
  const setSeed = useStore((s) => s.setSeed)
  const [seeds, setSeeds] = useState<number[]>(() => randSeeds(24))

  return (
    <div className="scroll-thin h-full overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="text-xs text-neutral-400">
          Every thumbnail uses your current settings — only the seed changes. Click one to load it.
        </div>
        <button
          onClick={() => setSeeds(randSeeds(24))}
          className="flex shrink-0 items-center gap-1.5 rounded border border-edge px-3 py-1.5 text-xs hover:border-destijl-yellow"
        >
          <Shuffle size={13} /> Shuffle seeds
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {seeds.map((s) => (
          <Thumbnail
            key={s}
            params={{ ...deferred, seed: s }}
            active={s === params.seed}
            onClick={() => {
              setSeed(s)
              onPick()
            }}
          />
        ))}
      </div>
    </div>
  )
}
