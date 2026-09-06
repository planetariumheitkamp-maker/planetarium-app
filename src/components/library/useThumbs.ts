import { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '@/lib/types';
import { resolveThumbnailUrl, revokeMediaUrl } from '@/lib/db';

/**
 * Resolve thumbnail URLs for a set of media items.
 * Object URLs are revoked when superseded or on unmount.
 */
export function useThumbs(items: MediaItem[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const urlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const next: Record<string, string> = {};
    const prev = urlsRef.current;

    (async () => {
      await Promise.all(
        items.map(async (item) => {
          // Reuse an already-resolved URL for unchanged items.
          if (prev[item.id]) {
            next[item.id] = prev[item.id];
            return;
          }
          try {
            next[item.id] = await resolveThumbnailUrl(item);
          } catch {
            /* item has no resolvable source */
          }
        }),
      );
      if (cancelled) {
        Object.values(next).forEach((u) => {
          if (!Object.values(prev).includes(u)) revokeMediaUrl(u);
        });
        return;
      }
      // Revoke URLs that are no longer referenced.
      const keep = new Set(Object.values(next));
      Object.values(prev).forEach((u) => {
        if (!keep.has(u)) revokeMediaUrl(u);
      });
      urlsRef.current = next;
      setUrls(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [items]);

  // Revoke everything on unmount.
  useEffect(() => {
    return () => {
      Object.values(urlsRef.current).forEach(revokeMediaUrl);
      urlsRef.current = {};
    };
  }, []);

  return urls;
}
