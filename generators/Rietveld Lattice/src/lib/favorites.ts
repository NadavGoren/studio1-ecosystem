import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Params } from '../types'
import { DEFAULT_PARAMS } from '../store'

export interface Favorite {
  id: string // stable hash of the full params (seed alone is not the artwork)
  seed: number
  params: Params
  savedAt: number
}

interface RietveldDB extends DBSchema {
  favorites: {
    key: string
    value: Favorite
    indexes: { savedAt: number }
  }
}

let dbPromise: Promise<IDBPDatabase<RietveldDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<RietveldDB>('rietveld-lattice', 1, {
      upgrade(database) {
        const store = database.createObjectStore('favorites', { keyPath: 'id' })
        store.createIndex('savedAt', 'savedAt')
      },
    })
  }
  return dbPromise
}

/** stable key for the WHOLE composition — distinct pieces (even same seed) coexist. */
function paramsKey(p: Params): string {
  const s = Object.keys(p)
    .sort()
    .map((k) => `${k}:${(p as unknown as Record<string, unknown>)[k]}`)
    .join('|')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export async function listFavorites(): Promise<Favorite[]> {
  const d = await db()
  const all = await d.getAllFromIndex('favorites', 'savedAt')
  // merge with defaults so favourites saved before newer params still render
  return all.reverse().map((f) => ({ ...f, params: { ...DEFAULT_PARAMS, ...f.params } }))
}

export async function saveFavorite(params: Params): Promise<void> {
  const d = await db()
  await d.put('favorites', {
    id: paramsKey(params),
    seed: params.seed,
    params: { ...params },
    savedAt: Date.now(),
  })
}

export async function deleteFavorite(id: string | number): Promise<void> {
  const d = await db()
  await d.delete('favorites', id as string)
}
