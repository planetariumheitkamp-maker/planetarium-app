import { useCallback, useEffect, useRef, useState } from 'react';
import { openDB } from 'idb';
import type { DBSchema } from 'idb';
import type { MediaItem, PlaylistEntry } from '@/lib/types';
import {
  addToPlaylist,
  clearPlaylist,
  ensureSeeded,
  getAllMedia,
  getMedia,
  getPlaylist,
  removeFromPlaylist,
  reorderPlaylist,
  resolveMediaUrl,
  resolveThumbnailUrl,
  revokeMediaUrl,
} from '@/lib/db';

/** A playlist entry joined with its media + resolved (playable) URLs. */
export interface QueueItem {
  entry: PlaylistEntry;
  media: MediaItem;
  /** Playable URL (object URL for blob-backed items, static path for bundled) */
  url: string;
  /** Thumbnail URL */
  thumbUrl: string;
}

/* The shared db.ts layer has no "update playlist entry" export; persist
   durationOverride edits directly against the same DB (schema-compatible). */
interface PlaylistDB extends DBSchema {
  playlist: { key: string; value: PlaylistEntry };
}

async function persistPlaylistEntry(entry: PlaylistEntry): Promise<void> {
  const db = await openDB<PlaylistDB>('domemaster', 1);
  await db.put('playlist', entry);
}

/** First-run demo show (player.md): 8 bundled textures, 8s image durations. */
const DEMO_SHOW_IDS = [
  'bundled:bg',
  'bundled:sun',
  'bundled:earth',
  'bundled:mars',
  'bundled:jupiter',
  'bundled:saturn',
  'bundled:moon',
  'bundled:neptune',
];

export const MIN_IMAGE_DURATION = 2;
export const MAX_IMAGE_DURATION = 60;
export const DEFAULT_IMAGE_DURATION = 8;

export function imageDurationSec(item: QueueItem): number {
  return item.entry.durationOverride ?? item.media.duration ?? DEFAULT_IMAGE_DURATION;
}

export function useQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Every URL ever resolved this session; revoked only on unmount so an
  // in-flight video stream is never cut by a reload.
  const urlsRef = useRef<string[]>([]);
  const itemsRef = useRef<QueueItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const reload = useCallback(async () => {
    const [entries, media] = await Promise.all([getPlaylist(), getAllMedia()]);
    const byId = new Map(media.map((m) => [m.id, m]));
    const next: QueueItem[] = [];
    for (const entry of entries) {
      const m = byId.get(entry.mediaId);
      if (!m) continue;
      const [url, thumbUrl] = await Promise.all([
        resolveMediaUrl(m),
        resolveThumbnailUrl(m),
      ]);
      urlsRef.current.push(url, thumbUrl);
      next.push({ entry, media: m, url, thumbUrl });
    }
    setItems(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Deferred to a macrotask: data-load effect (setState happens async after IDB resolves).
    const t = window.setTimeout(() => {
      reload().catch((err) => {
        console.error('[player] failed to load queue', err);
        setLoading(false);
      });
    }, 0);
    return () => {
      window.clearTimeout(t);
      urlsRef.current.forEach(revokeMediaUrl);
      urlsRef.current = [];
    };
  }, [reload]);

  /** Persist a new entry order (ids = playlist entry ids). */
  const reorder = useCallback(async (ids: string[]) => {
    setItems((prev) => {
      const byId = new Map(prev.map((i) => [i.entry.id, i]));
      const next: QueueItem[] = [];
      for (const id of ids) {
        const item = byId.get(id);
        if (item) {
          next.push(item);
          byId.delete(id);
        }
      }
      byId.forEach((item) => next.push(item));
      return next;
    });
    await reorderPlaylist(ids);
  }, []);

  const remove = useCallback(
    async (entryId: string) => {
      await removeFromPlaylist(entryId);
      await reload();
    },
    [reload],
  );

  /** Per-image auto-mode duration override (2–60s), persisted. */
  const setDuration = useCallback(async (entryId: string, seconds: number) => {
    const clamped = Math.min(
      MAX_IMAGE_DURATION,
      Math.max(MIN_IMAGE_DURATION, Math.round(seconds)),
    );
    const item = itemsRef.current.find((i) => i.entry.id === entryId);
    if (!item) return;
    const entry: PlaylistEntry = { ...item.entry, durationOverride: clamped };
    setItems((prev) =>
      prev.map((i) => (i.entry.id === entryId ? { ...i, entry } : i)),
    );
    try {
      await persistPlaylistEntry(entry);
    } catch (err) {
      console.error('[player] failed to persist duration override', err);
    }
  }, []);

  const clear = useCallback(async () => {
    await clearPlaylist();
    await reload();
  }, [reload]);

  const add = useCallback(
    async (mediaId: string) => {
      await addToPlaylist(mediaId);
      await reload();
    },
    [reload],
  );

  /** Seed the 8-item demo playlist (first-run / empty-state CTA). */
  const loadDemo = useCallback(async () => {
    await ensureSeeded();
    for (const id of DEMO_SHOW_IDS) {
      if (await getMedia(id)) {
        await addToPlaylist(id, DEFAULT_IMAGE_DURATION);
      }
    }
    await reload();
  }, [reload]);

  return { items, loading, reload, reorder, remove, setDuration, clear, add, loadDemo };
}
