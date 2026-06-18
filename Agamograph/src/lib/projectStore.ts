/**
 * IndexedDB persistence (spec §4 / PRD §5.6). Stores ONE auto-saved "current"
 * project locally so reopening the URL restores the last session. Images are
 * kept as real Blobs (no base64). All operations fail soft — if IndexedDB is
 * unavailable (private mode, disk full), the app just keeps working in memory.
 */

import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'agamograph'
const STORE = 'projects'
const CURRENT_KEY = 'current'
const DB_VERSION = 1

export type PersistedCrop = { offsetX: number; offsetY: number; scale: number }

export type PersistedImage = { blob: Blob; crop: PersistedCrop }

export type PersistedProject = {
  /** Schema version, for future migrations. */
  version: number
  updatedAt: number
  settings: {
    slices: number
    apexAngleDeg: number
    canvasWidth: number
    canvasHeight: number
    unit: 'cm' | 'in'
    dpi: number
    exportFormat: 'png' | 'jpg' | 'pdf'
    // Optional (added in v2): older saves omit these and restore() defaults them.
    margins?: { enabled: boolean; widthCm: number }
    dividers?: { enabled: boolean; widthMm: number; color: string; auto: boolean }
  }
  imageA: PersistedImage | null
  imageB: PersistedImage | null
}

export const PROJECT_SCHEMA_VERSION = 2

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      },
    })
  }
  return dbPromise
}

export async function saveCurrentProject(project: PersistedProject): Promise<void> {
  try {
    const db = await getDb()
    await db.put(STORE, project, CURRENT_KEY)
  } catch {
    /* persistence unavailable — ignore, keep working in memory */
  }
}

export async function loadCurrentProject(): Promise<PersistedProject | null> {
  try {
    const db = await getDb()
    const p = (await db.get(STORE, CURRENT_KEY)) as PersistedProject | undefined
    // Accept the current + any older version (older saves merely lack the
    // margins/dividers fields, which restore() defaults). Reject only unknown
    // future versions so we never misread a newer shape.
    if (!p || p.version > PROJECT_SCHEMA_VERSION) return null
    return p
  } catch {
    return null
  }
}

export async function clearCurrentProject(): Promise<void> {
  try {
    const db = await getDb()
    await db.delete(STORE, CURRENT_KEY)
  } catch {
    /* ignore */
  }
}
