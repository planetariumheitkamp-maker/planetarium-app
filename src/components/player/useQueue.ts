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

const IMAGE_DURATION_KEY = 'domemaster.player.imageDuration';

/** Session-wide default image duration (persisted); per-entry/media values win. */
let defaultImageDurationSec = (() => {
  try {
    const raw = localStorage.getItem(IMAGE_DURATION_KEY);
    const n = raw === null ? NaN : Number(raw);
    if (Number.isFinite(n)) {
      return Math.min(MAX_IMAGE_DURATION, Math.max(MIN_IMAGE_DURATION, Math.round(n)));
    }
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_IMAGE_DURATION;
})();

export function getDefaultImageDuration(): number {
  return defaultImageDurationSec;
}

export function setDefaultImageDuration(seconds: number): number {
  defaultImageDurationSec = Math.min(
    MAX_IMAGE_DURATION,
    Math.max(MIN_IMAGE_DURATION, Math.round(seconds)),
  );
  try {
    localStorage.setItem(IMAGE_DURATION_KEY, String(defaultImageDurationSec));
  } catch {
    /* storage unavailable */
  }
  return defaultImageDurationSec;
}

export function imageDurationSec(item: QueueItem): number {
  return item.entry.durationOverride ?? item.media.duration ?? defaultImageDurationSec;
}

interface ResolvedUrls {
  url: string;
  thumbUrl: string;
}

/** Delay before revoking object URLs that dropped out of the queue — long
    enough for any in-flight crossfade (max 2.5s + buffer) to finish. */
const RETIRE_MS = 5000;

export function useQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Resolved URLs cached per media identity (id + updatedAt) so reloads don't
  // mint duplicate object URLs for the same blob (the old leak). Entries that
  // fall out of the queue are retired and revoked after a grace period.
  const cacheRef = useRef(new Map<string, ResolvedUrls>());
  const retireRef = useRef(new Map<string, ResolvedUrls>());
  const retireTimerRef = useRef<number | undefined>(undefined);
  const itemsRef = useRef<QueueItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const flushRetired = useCallback(() => {
    retireRef.current.forEach((r) => {
      revokeMediaUrl(r.url);
      revokeMediaUrl(r.thumbUrl);
    });
    retireRef.current.clear();
  }, []);

  const reload = useCallback(async () => {
    const [entries, media] = await Promise.all([getPlaylist(), getAllMedia()]);
    const byId = new Map(media.map((m) => [m.id, m]));
    const cache = cacheRef.current;
    const retire = retireRef.current;
    const usedKeys = new Set<string>();
    const next: QueueItem[] = [];
    for (const entry of entries) {
      const m = byId.get(entry.mediaId);
      if (!m) continue;
      const key = `${m.id}:${m.updatedAt}`;
      usedKeys.add(key);
      let resolved = cache.get(key);
      if (!resolved) {
        // Resurrect from the retire pool when possible (avoids re-minting).
        resolved = retire.get(key);
        if (resolved) {
          retire.delete(key);
          cache.set(key, resolved);
        }
      }
      if (!resolved) {
        const [url, thumbUrl] = await Promise.all([
          resolveMediaUrl(m),
          resolveThumbnailUrl(m),
        ]);
        resolved = { url, thumbUrl };
        cache.set(key, resolved);
      }
      next.push({ entry, media: m, url: resolved.url, thumbUrl: resolved.thumbUrl });
    }
    // Move unreferenced entries to the retire pool (revoked after RETIRE_MS,
    // so an outgoing layer is never cut mid-crossfade). Static bundled paths
    // are unaffected — revokeMediaUrl only touches blob: URLs.
    cache.forEach((r, key) => {
      if (!usedKeys.has(key)) {
        retire.set(key, r);
        cache.delete(key);
      }
    });
    window.clearTimeout(retireTimerRef.current);
    if (retire.size > 0) {
      retireTimerRef.current = window.setTimeout(flushRetired, RETIRE_MS);
    }
    setItems(next);
    setLoading(false);
  }, [flushRetired]);

  useEffect(() => {
    // Deferred to a macrotask: data-load effect (setState happens async after IDB resolves).
    const t = window.setTimeout(() => {
      reload().catch((err) => {
        console.error('[player] failed to load queue', err);
        setLoading(false);
      });
    }, 0);
    // Refresh the queue when the tab regains focus / becomes visible again so
    // playlist edits made elsewhere (Library, another tab) show up without a
    // manual reload.
    const onFocus = () => {
      reload().catch((err) => console.error('[player] focus reload failed', err));
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    const cache = cacheRef.current;
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(retireTimerRef.current);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      cache.forEach((r) => {
        revokeMediaUrl(r.url);
        revokeMediaUrl(r.thumbUrl);
      });
      cache.clear();
      flushRetired();
    };
  }, [reload, flushRetired]);

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
