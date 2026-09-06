import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Plus, X } from 'lucide-react';
import type { MediaItem } from '@/lib/types';
import { getAllMedia, resolveThumbnailUrl, revokeMediaUrl } from '@/lib/db';

interface LibraryDrawerProps {
  open: boolean;
  onClose: () => void;
  onAdd: (mediaId: string) => void;
}

interface DrawerItem {
  media: MediaItem;
  thumbUrl: string;
}

/**
 * Right-side drawer (player.md §Zone 3 "＋ Add from Library"): grid of vault
 * thumbnails; click appends to the queue with a gold check flash.
 */
export default function LibraryDrawer({ open, onClose, onAdd }: LibraryDrawerProps) {
  const [items, setItems] = useState<DrawerItem[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const media = await getAllMedia();
      const resolved: DrawerItem[] = [];
      for (const m of media) {
        try {
          const thumbUrl = await resolveThumbnailUrl(m);
          urlsRef.current.push(thumbUrl);
          resolved.push({ media: m, thumbUrl });
        } catch {
          /* skip unresolvable items */
        }
      }
      if (!cancelled) setItems(resolved);
    })().catch(() => setItems([]));
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Revoke thumbnails when the drawer closes for good / unmounts.
  useEffect(() => {
    return () => {
      urlsRef.current.forEach(revokeMediaUrl);
      urlsRef.current = [];
    };
  }, []);

  const handleAdd = (mediaId: string) => {
    onAdd(mediaId);
    setFlashId(mediaId);
    window.setTimeout(() => setFlashId((cur) => (cur === mediaId ? null : cur)), 700);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="drawer-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-void/60"
            onClick={onClose}
          />
          <motion.aside
            key="drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="glass-panel fixed inset-y-0 right-0 z-50 flex w-96 max-w-full flex-col border-l border-line"
          >
            <div className="flex items-center justify-between border-b border-line p-4">
              <span className="font-display text-xs font-medium uppercase tracking-[0.35em] text-gold">
                Add from Library
              </span>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim transition-colors hover:text-ink"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {items.length === 0 && (
                <p className="p-4 text-center font-mono text-xs text-ink-faint">
                  Library is empty.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {items.map(({ media, thumbUrl }) => (
                  <button
                    key={media.id}
                    type="button"
                    onClick={() => handleAdd(media.id)}
                    title={`Add "${media.name}" to queue`}
                    className="group relative overflow-hidden rounded-xl border border-line bg-nebula text-left transition-all duration-300 ease-orbital hover:-translate-y-0.5 hover:border-[rgba(209,184,136,0.3)]"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-void">
                      <img
                        src={thumbUrl}
                        alt={media.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-void/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        {flashId === media.id ? (
                          <Check className="h-6 w-6 text-gold" strokeWidth={2.5} />
                        ) : (
                          <Plus className="h-6 w-6 text-gold" strokeWidth={2} />
                        )}
                      </span>
                      {flashId === media.id && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-void">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="px-3 py-2">
                      <p className="truncate text-xs font-medium text-ink">{media.name}</p>
                      <p className="truncate font-mono text-[9px] uppercase tracking-wider text-ink-faint">
                        {media.source} · {media.type}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
