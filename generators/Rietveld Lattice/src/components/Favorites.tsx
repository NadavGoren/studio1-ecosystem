import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteFavorite, listFavorites, type Favorite } from '../lib/favorites'
import { useStore } from '../store'
import Thumbnail from './Thumbnail'

export default function Favorites({ refreshKey }: { refreshKey: number }) {
  const [favs, setFavs] = useState<Favorite[]>([])
  const loadParams = useStore((s) => s.loadParams)

  const refresh = () => listFavorites().then(setFavs).catch(() => {})
  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  if (favs.length === 0) {
    return (
      <div className="px-4 py-2.5 text-[11px] text-neutral-600">
        No saved favourites yet — tune a piece you like and hit ★ to keep it across sessions.
      </div>
    )
  }

  return (
    <div className="scroll-thin flex items-center gap-2 overflow-x-auto px-3 py-2">
      {favs.map((f) => (
        <div key={f.id} className="relative w-16 shrink-0">
          <Thumbnail params={f.params} onClick={() => loadParams(f.params)} />
          <button
            onClick={() => deleteFavorite(f.seed).then(refresh)}
            title="Remove"
            className="absolute -right-1.5 -top-1.5 rounded-full bg-black/75 p-1 text-neutral-300 hover:text-destijl-red"
          >
            <Trash2 size={10} />
          </button>
        </div>
      ))}
    </div>
  )
}
