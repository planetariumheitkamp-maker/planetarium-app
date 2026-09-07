import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CircleDot, Download, Info, ListPlus, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/lib/types';
import { resolveMediaUrl, revokeMediaUrl } from '@/lib/db';
import { formatBytes, formatDuration, itemSize } from './utils';

export interface LibraryHandlers {
  onToggleSelect: (item: MediaItem, shiftKey: boolean) => void;
  onOpenDetail: (item: MediaItem) => void;
  onSend: (item: MediaItem) => void;
  onOpenEditor: (item: MediaItem) => void;
  onDownload: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
  onRename: (item: MediaItem, name: string) => void;
}

const EXPO = [0.22, 1, 0.36, 1] as [number, number, number, number];

function ActionButton({
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
        'flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-colors',
        primary
          ? 'border-gold bg-gold text-void hover:bg-gold-hi'
          : danger
            ? 'border-line bg-void/70 text-ink-dim hover:border-danger hover:text-danger'
            : 'border-line bg-void/70 text-ink-dim hover:border-gold hover:text-gold',
      )}
    >
      {children}
    </button>
  );
}

function HoverActions({
  item,
  h,
  onRenameClick,
}: {
  item: MediaItem;
  h: LibraryHandlers;
  onRenameClick: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-6 items-center justify-center gap-2 bg-gradient-to-t from-void/80 to-transparent p-3 pt-8 opacity-0 transition-all duration-300 ease-orbital group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
      <ActionButton title="Send to Playlist" primary onClick={() => h.onSend(item)}>
        <ListPlus className="h-3.5 w-3.5" />
      </ActionButton>
      <ActionButton title="Open in Editor" onClick={() => h.onOpenEditor(item)}>
        <CircleDot className="h-3.5 w-3.5" />
      </ActionButton>
      <ActionButton title="Download" onClick={() => h.onDownload(item)}>
        <Download className="h-3.5 w-3.5" />
      </ActionButton>
      <ActionButton title="Rename" onClick={onRenameClick}>
        <Pencil className="h-3.5 w-3.5" />
      </ActionButton>
      <ActionButton title="Details" onClick={() => h.onOpenDetail(item)}>
        <Info className="h-3.5 w-3.5" />
      </ActionButton>
      {item.source !== 'bundled' && (
        <ActionButton title="Delete" danger onClick={() => h.onDelete(item)}>
          <Trash2 className="h-3.5 w-3.5" />
        </ActionButton>
      )}
    </div>
  );
}

function InlineName({
  item,
  onRename,
  editing,
  setEditing,
}: {
  item: MediaItem;
  onRename: (item: MediaItem, name: string) => void;
  editing: boolean;
  setEditing: (v: boolean) => void;
}) {
  const [draft, setDraft] = useState(item.name);

  if (!editing) {
    return (
      <p
        className="cursor-text truncate text-sm font-medium text-ink"
        title="Click to rename"
        onClick={(e) => {
          e.stopPropagation();
          setDraft(item.name);
          setEditing(true);
        }}
      >
        {item.name}
      </p>
    );
  }

  const commit = () => {
    const name = draft.trim();
    if (name && name !== item.name) onRename(item, name);
    setEditing(false);
  };

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
      className="w-full rounded-md border border-gold/60 bg-void px-1.5 py-0.5 text-sm font-medium text-ink outline-none"
    />
  );
}

/**
 * Muted loop preview for video cards: resolves the full media URL lazily on
 * first hover, plays on hover, pauses + rewinds + releases on leave/unmount.
 */
function useHoverPreview(item: MediaItem) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const startPreview = () => {
    if (item.type !== 'video' || urlRef.current) return;
    resolveMediaUrl(item)
      .then((url) => {
        urlRef.current = url;
        setPreviewUrl(url);
      })
      .catch(() => undefined);
  };

  const stopPreview = () => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
    if (urlRef.current) {
      revokeMediaUrl(urlRef.current);
      urlRef.current = null;
    }
    setPreviewUrl(null);
  };

  useEffect(() => {
    if (previewUrl && videoRef.current) {
      videoRef.current.play().catch(() => undefined);
    }
  }, [previewUrl]);

  // Release on unmount.
  useEffect(
    () => () => {
      if (urlRef.current) revokeMediaUrl(urlRef.current);
    },
    [],
  );

  return { previewUrl, videoRef, startPreview, stopPreview };
}

function LibraryCard({
  item,
  index,
  thumbUrl,
  selected,
  flash,
  h,
}: {
  item: MediaItem;
  index: number;
  thumbUrl?: string;
  selected: boolean;
  flash: boolean;
  h: LibraryHandlers;
}) {
  const [renaming, setRenaming] = useState(false);
  const src = thumbUrl ?? item.path;
  const { previewUrl, videoRef, startPreview, stopPreview } = useHoverPreview(item);

  const subline = [
    item.source.toUpperCase(),
    item.blob ? formatBytes(itemSize(item)) : null,
    item.width && item.height ? `${item.width}×${item.height}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: flash
          ? '0 0 0 2px rgba(209,184,136,0.9), 0 0 44px rgba(209,184,136,0.45)'
          : '0 0 0 0px rgba(209,184,136,0)',
      }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{
        layout: { type: 'spring', stiffness: 300, damping: 30 },
        duration: 0.5,
        ease: EXPO,
        delay: Math.min(index, 20) * 0.05,
      }}
      whileHover={{ y: -3 }}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-nebula',
        selected
          ? 'border-gold ring-2 ring-gold/60'
          : 'border-line hover:border-[rgba(209,184,136,0.35)]',
      )}
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-video w-full cursor-pointer overflow-hidden bg-void"
        onClick={(e) => h.onToggleSelect(item, e.shiftKey)}
        onDoubleClick={() => h.onOpenDetail(item)}
        onMouseEnter={startPreview}
        onMouseLeave={stopPreview}
      >
        {src ? (
          <img
            src={src}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-orbital group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full animate-shimmer shimmer" />
        )}

        {/* Hover video preview (muted loop) */}
        {previewUrl && (
          <video
            ref={videoRef}
            src={previewUrl}
            muted
            loop
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* Dome-master badge */}
        {item.source === 'render' && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-gold/50 bg-void/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-gold">
            <CircleDot className="h-2.5 w-2.5" />
            Dome Master
          </span>
        )}

        {/* Video duration badge */}
        {item.type === 'video' && typeof item.duration === 'number' && (
          <span className="absolute bottom-2 right-2 rounded-md bg-void/80 px-1.5 py-0.5 font-mono text-[10px] text-gold">
            ▶ {formatDuration(item.duration)}
          </span>
        )}

        {/* Selection check */}
        {selected && (
          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-void shadow-glow-gold">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}

        <HoverActions item={item} h={h} onRenameClick={() => setRenaming(true)} />
      </div>

      {/* Body */}
      <div className="p-3">
        <InlineName item={item} onRename={h.onRename} editing={renaming} setEditing={setRenaming} />
        <div className="mt-1 flex items-center gap-2">
          <p className="truncate font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {subline}
          </p>
          {item.fisheyeParams && (
            <span className="shrink-0 rounded-full border border-line px-1.5 py-px font-mono text-[9px] text-gold">
              {Math.round(item.fisheyeParams.fov)}°/Z{item.fisheyeParams.zoom.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function MediaGrid({
  items,
  thumbs,
  selectedIds,
  flashIds,
  handlers,
  banner,
}: {
  items: MediaItem[];
  thumbs: Record<string, string>;
  selectedIds: Set<string>;
  flashIds: Set<string>;
  handlers: LibraryHandlers;
  /** Optional full-width welcome banner, rendered as the first grid cell */
  banner?: React.ReactNode;
}) {
  return (
    <motion.div layout className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
      {banner}
      <AnimatePresence mode="popLayout">
        {items.map((item, i) => (
          <LibraryCard
            key={item.id}
            item={item}
            index={i}
            thumbUrl={thumbs[item.id]}
            selected={selectedIds.has(item.id)}
            flash={flashIds.has(item.id)}
            h={handlers}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
