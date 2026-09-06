import { AnimatePresence, motion } from 'framer-motion';
import { Check, CircleDot, Download, Info, ListPlus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/lib/types';
import type { LibraryHandlers } from './MediaGrid';
import { formatBytes, formatDate, formatDuration, itemSize } from './utils';

const EXPO = [0.22, 1, 0.36, 1] as [number, number, number, number];

function RowAction({
  title,
  onClick,
  primary,
  danger,
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  primary?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full border transition-colors',
        primary
          ? 'border-gold bg-gold text-void hover:bg-gold-hi'
          : danger
            ? 'border-line text-ink-faint hover:border-danger hover:text-danger'
            : 'border-line text-ink-faint hover:border-gold hover:text-gold',
      )}
    >
      {children}
    </button>
  );
}

export function MediaList({
  items,
  thumbs,
  selectedIds,
  handlers,
}: {
  items: MediaItem[];
  thumbs: Record<string, string>;
  selectedIds: Set<string>;
  handlers: LibraryHandlers;
}) {
  return (
    <motion.div layout className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {items.map((item, i) => {
          const selected = selectedIds.has(item.id);
          const src = thumbs[item.id] ?? item.path;
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{
                layout: { type: 'spring', stiffness: 300, damping: 30 },
                duration: 0.4,
                ease: EXPO,
                delay: Math.min(i, 20) * 0.04,
              }}
              onClick={(e) => handlers.onToggleSelect(item, e.shiftKey)}
              onDoubleClick={() => handlers.onOpenDetail(item)}
              className={cn(
                'group flex h-16 cursor-pointer items-center gap-4 rounded-xl border bg-nebula px-3 transition-colors',
                selected
                  ? 'border-gold ring-1 ring-gold/50'
                  : 'border-line hover:border-[rgba(209,184,136,0.3)]',
              )}
            >
              {/* Thumbnail */}
              <div className="relative h-10 w-24 shrink-0 overflow-hidden rounded-lg bg-void">
                {src ? (
                  <img src={src} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full animate-shimmer shimmer" />
                )}
                {selected && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-void">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
              </div>

              {/* Name */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                {item.fisheyeParams && (
                  <p className="font-mono text-[9px] text-gold">
                    {Math.round(item.fisheyeParams.fov)}° / Z{item.fisheyeParams.zoom.toFixed(1)}
                  </p>
                )}
              </div>

              {/* Columns */}
              <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                {item.source}
              </span>
              <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                {item.type}
              </span>
              <span className="w-20 shrink-0 text-right font-mono text-[10px] text-ink-faint">
                {item.type === 'video' && typeof item.duration === 'number'
                  ? formatDuration(item.duration)
                  : item.blob
                    ? formatBytes(itemSize(item))
                    : '—'}
              </span>
              <span className="w-24 shrink-0 text-right font-mono text-[10px] text-ink-faint">
                {formatDate(item.createdAt)}
              </span>

              {/* Hover actions */}
              <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <RowAction title="Send to Playlist" primary onClick={() => handlers.onSend(item)}>
                  <ListPlus className="h-3 w-3" />
                </RowAction>
                <RowAction title="Open in Editor" onClick={() => handlers.onOpenEditor(item)}>
                  <CircleDot className="h-3 w-3" />
                </RowAction>
                <RowAction title="Download" onClick={() => handlers.onDownload(item)}>
                  <Download className="h-3 w-3" />
                </RowAction>
                <RowAction title="Details" onClick={() => handlers.onOpenDetail(item)}>
                  <Info className="h-3 w-3" />
                </RowAction>
                {item.source !== 'bundled' && (
                  <RowAction title="Delete" danger onClick={() => handlers.onDelete(item)}>
                    <Trash2 className="h-3 w-3" />
                  </RowAction>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
