import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GripVertical, Minus, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QueueItem } from './useQueue';
import {
  imageDurationSec,
  MAX_IMAGE_DURATION,
  MIN_IMAGE_DURATION,
} from './useQueue';

const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0');

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const SOURCE_BADGE: Record<string, string> = {
  imported: 'VAULT',
  bundled: 'BUNDLED',
  render: 'RENDER',
};

interface PlaylistRailProps {
  items: QueueItem[];
  loading: boolean;
  currentEntryId: string | null;
  nextEntryId: string | null;
  onSelect: (entryId: string) => void;
  onRemove: (entryId: string) => void;
  onReorder: (ids: string[]) => void;
  onSetDuration: (entryId: string, seconds: number) => void;
  onClear: () => void;
  onOpenLibraryDrawer: () => void;
}

/**
 * Show-queue rail (player.md §Zone 3): HTML5 drag reorder (persists to
 * IndexedDB on drop), per-image duration stepper, remove, clear.
 */
export default function PlaylistRail({
  items,
  loading,
  currentEntryId,
  nextEntryId,
  onSelect,
  onRemove,
  onReorder,
  onSetDuration,
  onClear,
  onOpenLibraryDrawer,
}: PlaylistRailProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDrop = (target: number) => {
    if (dragIdx === null || dragIdx === target) return;
    const ids = items.map((i) => i.entry.id);
    const [moved] = ids.splice(dragIdx, 1);
    ids.splice(target, 0, moved);
    onReorder(ids);
  };

  return (
    <motion.aside
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="hidden w-80 shrink-0 flex-col border-l border-line bg-nebula/60 md:flex"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line p-4">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xs font-medium uppercase tracking-[0.35em] text-gold">
            Show queue
          </span>
          <span className="font-mono text-[10px] text-ink-faint">{pad(items.length)}</span>
        </div>
        <button
          type="button"
          onClick={onOpenLibraryDrawer}
          className="font-mono text-[10px] uppercase tracking-wider text-ink-dim transition-colors hover:text-gold"
        >
          ＋ Add from Library
        </button>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading && items.length === 0 && (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-shimmer rounded-xl shimmer" />
            ))}
          </div>
        )}
        {!loading && items.length === 0 && (
          <p className="p-4 text-center font-mono text-xs text-ink-faint">Queue is empty.</p>
        )}
        <AnimatePresence initial={true}>
          {items.map((item, i) => {
            const isCurrent = item.entry.id === currentEntryId;
            const isNext = item.entry.id === nextEntryId;
            const isImage = item.media.type === 'image';
            const dur = imageDurationSec(item);
            return (
              <motion.div
                key={item.entry.id}
                initial={{ opacity: 0, x: 24, height: 'auto' }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(i * 0.05, 0.5),
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="mb-1 overflow-hidden"
              >
                {/* Inner row carries HTML5 drag (framer-motion owns onDrag* on motion components) */}
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(i));
                    e.dataTransfer.effectAllowed = 'move';
                    setDragIdx(i);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setOverIdx(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(i);
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  onClick={() => onSelect(item.entry.id)}
                  className={cn(
                    'group relative flex cursor-pointer gap-3 rounded-xl border-l-[3px] border-transparent p-3',
                    'transition-all duration-200 ease-orbital hover:-translate-x-0.5 hover:bg-dusk',
                    isCurrent && 'border-l-gold bg-dusk',
                    isNext && !isCurrent && 'border-l-violet-hi',
                    dragIdx === i && 'opacity-40',
                    overIdx === i && dragIdx !== null && dragIdx !== i && 'ring-1 ring-gold/60',
                  )}
                >
                  {/* Drag handle */}
                  <span
                    className="flex shrink-0 cursor-grab items-center text-ink-faint transition-colors group-hover:text-ink-dim active:cursor-grabbing"
                    title="Drag to reorder"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="h-4 w-4" strokeWidth={1.75} />
                  </span>

                  {/* Thumbnail */}
                  <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-void">
                    <img
                      src={item.thumbUrl}
                      alt={item.media.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      draggable={false}
                    />
                    {isCurrent && (
                      <span className="absolute left-1.5 top-1.5 h-2 w-2 animate-pulse rounded-full bg-gold shadow-glow-gold" />
                    )}
                  </div>

                  {/* Meta */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.media.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                      {isImage ? `IMG · ${dur}s` : `VID · ${fmtClock(item.media.duration ?? 0)}`}
                      <span className="ml-2 text-gold/70">
                        {SOURCE_BADGE[item.media.source] ?? item.media.source}
                      </span>
                    </p>
                  </div>

                  {/* Hover actions (slide in from right) */}
                  <div
                    className="absolute right-2 top-1/2 flex -translate-y-1/2 translate-x-3 items-center gap-1 opacity-0 transition-all duration-200 ease-orbital group-hover:translate-x-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isImage && (
                      <div className="glass-panel flex items-center gap-0.5 rounded-full px-1 py-0.5">
                        <button
                          type="button"
                          title="Shorter (−1s)"
                          onClick={() => onSetDuration(item.entry.id, dur - 1)}
                          disabled={dur <= MIN_IMAGE_DURATION}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-ink-dim transition-colors hover:text-gold disabled:opacity-30"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center font-mono text-[10px] tabular-nums text-gold">
                          {dur}s
                        </span>
                        <button
                          type="button"
                          title="Longer (+1s)"
                          onClick={() => onSetDuration(item.entry.id, dur + 1)}
                          disabled={dur >= MAX_IMAGE_DURATION}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-ink-dim transition-colors hover:text-gold disabled:opacity-30"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      title="Remove from queue"
                      onClick={() => onRemove(item.entry.id)}
                      className="glass-panel flex h-7 w-7 items-center justify-center rounded-full text-ink-dim transition-colors hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div className="border-t border-line p-3 text-center">
          <button
            type="button"
            onClick={onClear}
            className="font-mono text-[10px] uppercase tracking-widest text-ink-faint transition-colors hover:text-danger"
          >
            Clear queue
          </button>
        </div>
      )}
    </motion.aside>
  );
}
