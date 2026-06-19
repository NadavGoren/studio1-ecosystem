import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Params } from '../types'

export interface Favorite {
  id: number // = seed, the natural key
  seed: number
  params: Params
  savedAt: number
}

interface RietveldDB extends DBSchema {
  favorites: {
    key: number
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

export async function listFavorites(): Promise<Favorite[]> {
  const d = await db()
  const all = await d.getAllFromIndex('favorites', 'savedAt')
  return all.reverse() // newest first
}

export async function saveFavorite(params: Params): Promise<void> {
  const d = await db()
  await d.put('favorites', {
    id: params.seed,
    seed: params.seed,
    params: { ...params },
    savedAt: Date.now(),
  })
}

export async function deleteFavorite(seed: number): Promise<void> {
  const d = await db()
  await d.delete('favorites', seed)
}
