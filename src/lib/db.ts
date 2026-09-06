import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { MediaItem, PlaylistEntry, StorageUsage } from './types';

/**
 * DOMEMASTER media vault — IndexedDB layer (design.md §10).
 * Stores: `media` (keyPath id), `playlist` (keyPath id).
 */

interface DomemasterDB extends DBSchema {
  media: { key: string; value: MediaItem };
  playlist: { key: string; value: PlaylistEntry };
}

const DB_NAME = 'domemaster';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<DomemasterDB>> | null = null;

function getDB(): Promise<IDBPDatabase<DomemasterDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DomemasterDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('playlist')) {
          db.createObjectStore('playlist', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------------------------------- media ---------------------------------- */

export async function getAllMedia(): Promise<MediaItem[]> {
  const db = await getDB();
  const all = await db.getAll('media');
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getMedia(id: string): Promise<MediaItem | undefined> {
  const db = await getDB();
  return db.get('media', id);
}

export async function putMedia(item: MediaItem): Promise<MediaItem> {
  const db = await getDB();
  const stamped = { ...item, updatedAt: Date.now() };
  await db.put('media', stamped);
  return stamped;
}

export async function deleteMedia(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['media', 'playlist'], 'readwrite');
  await tx.objectStore('media').delete(id);
  // also drop any playlist entries referencing this media
  const entries = await tx.objectStore('playlist').getAll();
  for (const e of entries) {
    if (e.mediaId === id) await tx.objectStore('playlist').delete(e.id);
  }
  await tx.done;
}

/* -------------------------------- playlist --------------------------------- */

export async function getPlaylist(): Promise<PlaylistEntry[]> {
  const db = await getDB();
  const all = await db.getAll('playlist');
  return all.sort((a, b) => a.order - b.order);
}

export async function addToPlaylist(
  mediaId: string,
  durationOverride?: number,
): Promise<PlaylistEntry> {
  const db = await getDB();
  const existing = await getPlaylist();
  const maxOrder = existing.reduce((m, e) => Math.max(m, e.order), -1);
  const entry: PlaylistEntry = {
    id: newId(),
    mediaId,
    order: maxOrder + 1,
    ...(durationOverride !== undefined ? { durationOverride } : {}),
  };
  await db.put('playlist', entry);
  return entry;
}

export async function removeFromPlaylist(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('playlist', id);
  // compact ordering
  const remaining = await getPlaylist();
  const tx = db.transaction('playlist', 'readwrite');
  for (let i = 0; i < remaining.length; i++) {
    await tx.store.put({ ...remaining[i], order: i });
  }
  await tx.done;
}

export async function reorderPlaylist(ids: string[]): Promise<void> {
  const db = await getDB();
  const current = await getPlaylist();
  const byId = new Map(current.map((e) => [e.id, e]));
  const tx = db.transaction('playlist', 'readwrite');
  let order = 0;
  for (const id of ids) {
    const entry = byId.get(id);
    if (entry) {
      await tx.store.put({ ...entry, order: order++ });
      byId.delete(id);
    }
  }
  // any entries not mentioned keep their relative order at the end
  for (const entry of byId.values()) {
    await tx.store.put({ ...entry, order: order++ });
  }
  await tx.done;
}

export async function clearPlaylist(): Promise<void> {
  const db = await getDB();
  await db.clear('playlist');
}

/* ------------------------------ bundled seeds ------------------------------ */

const BUNDLED_SEEDS: Array<{ path: string; name: string; tags: string[] }> = [
  { path: '/media/background.jpg', name: 'Deep Space I', tags: ['background', 'space'] },
  { path: '/media/bg.jpg', name: 'Deep Space II', tags: ['background', 'space'] },
  { path: '/media/sun.jpg', name: 'Sun', tags: ['star', 'solar-system'] },
  { path: '/media/mercury.jpg', name: 'Mercury', tags: ['planet', 'solar-system'] },
  { path: '/media/venus.jpg', name: 'Venus', tags: ['planet', 'solar-system'] },
  { path: '/media/earth.jpg', name: 'Earth', tags: ['planet', 'solar-system'] },
  { path: '/media/mars.jpg', name: 'Mars', tags: ['planet', 'solar-system'] },
  { path: '/media/jupiter.jpg', name: 'Jupiter', tags: ['planet', 'solar-system'] },
  { path: '/media/saturn.jpg', name: 'Saturn', tags: ['planet', 'solar-system'] },
  { path: '/media/uranus.jpg', name: 'Uranus', tags: ['planet', 'solar-system'] },
  { path: '/media/neptune.jpg', name: 'Neptune', tags: ['planet', 'solar-system'] },
  { path: '/media/pluto.jpg', name: 'Pluto', tags: ['dwarf-planet', 'solar-system'] },
  { path: '/media/moon.jpg', name: 'Moon', tags: ['moon', 'solar-system'] },
  { path: '/media/io.jpg', name: 'Io', tags: ['moon', 'jupiter'] },
  { path: '/media/europa.jpg', name: 'Europa', tags: ['moon', 'jupiter'] },
  { path: '/media/ganymede.jpg', name: 'Ganymede', tags: ['moon', 'jupiter'] },
  { path: '/media/callisto.jpg', name: 'Callisto', tags: ['moon', 'jupiter'] },
  { path: '/media/titan.jpg', name: 'Titan', tags: ['moon', 'saturn'] },
  { path: '/media/triton.jpg', name: 'Triton', tags: ['moon', 'neptune'] },
  { path: '/media/charon.jpg', name: 'Charon', tags: ['moon', 'pluto'] },
  { path: '/media/enceladus.jpg', name: 'Enceladus', tags: ['moon', 'saturn'] },
  { path: '/media/tethys.jpg', name: 'Tethys', tags: ['moon', 'saturn'] },
  { path: '/media/iapetus.jpg', name: 'Iapetus', tags: ['moon', 'saturn'] },
  { path: '/media/oberon.jpg', name: 'Oberon', tags: ['moon', 'uranus'] },
  { path: '/media/titania.jpg', name: 'Titania', tags: ['moon', 'uranus'] },
  { path: '/media/phobos.jpg', name: 'Phobos', tags: ['moon', 'mars'] },
  { path: '/media/deimos.jpg', name: 'Deimos', tags: ['moon', 'mars'] },
];

function bundledId(path: string): string {
  return `bundled:${path.replace('/media/', '').replace(/\.[^.]+$/, '')}`;
}

/**
 * Seed the bundled `/media/*.jpg` textures as MediaItems (idempotent —
 * existing seeds are left untouched). Usually called via `ensureSeeded()`.
 */
export async function seedBundledMedia(): Promise<number> {
  const db = await getDB();
  const now = Date.now();
  let added = 0;
  const tx = db.transaction('media', 'readwrite');
  for (const seed of BUNDLED_SEEDS) {
    const id = bundledId(seed.path);
    const existing = await tx.store.get(id);
    if (existing) continue;
    const item: MediaItem = {
      id,
      name: seed.name,
      type: 'image',
      source: 'bundled',
      path: seed.path,
      tags: seed.tags,
      createdAt: now,
      updatedAt: now,
    };
    await tx.store.put(item);
    added++;
  }
  await tx.done;
  return added;
}

let seededOnce: Promise<void> | null = null;

/** Run the bundled-media seed exactly once per session. */
export function ensureSeeded(): Promise<void> {
  if (!seededOnce) {
    seededOnce = seedBundledMedia().then(() => undefined);
  }
  return seededOnce;
}

/* --------------------------------- storage --------------------------------- */

export async function getStorageUsage(): Promise<StorageUsage> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      const usage = est.usage ?? 0;
      const quota = est.quota ?? 0;
      return { usage, quota, ratio: quota > 0 ? usage / quota : 0 };
    }
  } catch {
    /* fall through to blob-sum fallback */
  }
  // Fallback: sum stored blob sizes (quota unknown)
  try {
    const all = await getAllMedia();
    const usage = all.reduce(
      (sum, m) => sum + (m.blob?.size ?? 0) + (m.thumbnailBlob?.size ?? 0),
      0,
    );
    return { usage, quota: 0, ratio: 0 };
  } catch {
    return { usage: 0, quota: 0, ratio: 0 };
  }
}

/* ------------------------------ url resolving ------------------------------ */

/**
 * Resolve a playable/displayable URL for a MediaItem:
 * object URL for blob-backed items, static path for bundled items.
 * Object URLs should be released with `revokeMediaUrl` when done.
 */
export async function resolveMediaUrl(item: MediaItem): Promise<string> {
  if (item.blob) {
    return URL.createObjectURL(item.blob);
  }
  if (item.path) {
    return item.path;
  }
  throw new Error(`MediaItem "${item.id}" has neither blob nor path`);
}

/** Resolve a thumbnail URL (thumbnailBlob → blob → path). */
export async function resolveThumbnailUrl(item: MediaItem): Promise<string> {
  if (item.thumbnailBlob) {
    return URL.createObjectURL(item.thumbnailBlob);
  }
  return resolveMediaUrl(item);
}

/** Release an object URL created by resolveMediaUrl/resolveThumbnailUrl. */
export function revokeMediaUrl(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
