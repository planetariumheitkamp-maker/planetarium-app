import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleDot, Download, ListPlus, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/lib/types';
import { resolveMediaUrl, revokeMediaUrl } from '@/lib/db';
import { GhostButton, GoldButton } from '@/components/primitives';
import { formatBytes, formatDate, formatDuration, itemSize } from './utils';

const EXPO = [0.22, 1, 0.36, 1] as [number, number, number, number];

function MetaRow({
  label,
  children,
  index,
}: {
  label: string;
  children: React.ReactNode;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EXPO, delay: 0.15 + index * 0.04 }}
      className="flex items-start justify-between gap-4 border-t border-line py-2"
    >
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
        {label}
      </span>
      <span className="min-w-0 text-right font-mono text-xs text-ink-dim">{children}</span>
    </motion.div>
  );
}

export function DetailDrawer({
  item,
  onClose,
  onSend,
  onOpenEditor,
  onDownload,
  onDelete,
  onRename,
  onTagsChange,
}: {
  item: MediaItem | null;
  onClose: () => void;
  onSend: (item: MediaItem) => void;
  onOpenEditor: (item: MediaItem) => void;
  onDownload: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
  onRename: (item: MediaItem, name: string) => void;
  onTagsChange: (item: MediaItem, tags: string[]) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');

  // Resolve a full-fidelity preview URL for the open item.
  useEffect(() => {
    if (!item) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    resolveMediaUrl(item)
      .then((u) => {
        url = u;
        if (!cancelled) setPreviewUrl(u);
      })
      .catch(() => setPreviewUrl(null));
    return () => {
      cancelled = true;
      if (url) revokeMediaUrl(url);
    };
  }, [item]);

  const addTag = () => {
    if (!item) return;
    const tag = tagDraft.trim().toLowerCase();
    setTagDraft('');
    if (!tag || item.tags.includes(tag)) return;
    onTagsChange(item, [...item.tags, tag]);
  };

  let rowIndex = 0;

  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div
            key="drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-void/60 backdrop-blur-sm"
          />
          <motion.aside
            key="drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 25 }}
            className="fixed inset-y-0 right-0 z-50 flex w-96 max-w-[92vw] flex-col border-l border-line bg-nebula"
          >
            {/* Header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
              <span className="font-display text-xs font-bold uppercase tracking-widest text-gold">
                Asset Detail
              </span>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-faint transition-colors hover:border-gold hover:text-gold"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Preview */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.15, ease: EXPO }}
                className="relative aspect-video w-full bg-void"
              >
                {previewUrl && item.type === 'video' ? (
                  <video
                    src={previewUrl}
                    controls
                    className="h-full w-full object-contain"
                  />
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={item.name}
                    className={cn(
                      'h-full w-full',
                      item.source === 'render' ? 'object-contain' : 'object-cover',
                    )}
                  />
                ) : (
                  <div className="h-full w-full animate-shimmer shimmer" />
                )}
              </motion.div>

              {/* Metadata */}
              <div className="px-5 py-4">
                <input
                  key={item.id}
                  defaultValue={item.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== item.name) onRename(item, name);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="mb-3 w-full rounded-lg border border-transparent bg-void/60 px-3 py-2 font-display text-sm font-bold tracking-wide text-ink outline-none transition-colors focus:border-gold/60"
                />

                <MetaRow label="Source" index={rowIndex++}>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider',
                      item.source === 'render'
                        ? 'border-gold/60 text-gold'
                        : item.source === 'bundled'
                          ? 'border-violet-hi/60 text-violet-hi'
                          : 'border-line text-ink-dim',
                    )}
                  >
                    {item.source}
                  </span>
                </MetaRow>
                <MetaRow label="Type" index={rowIndex++}>
                  {item.type}
                </MetaRow>
                {item.width && item.height && (
                  <MetaRow label="Dimensions" index={rowIndex++}>
                    {item.width}×{item.height}
                  </MetaRow>
                )}
                {typeof item.duration === 'number' && (
                  <MetaRow label="Duration" index={rowIndex++}>
                    {formatDuration(item.duration)}
                  </MetaRow>
                )}
                <MetaRow label="File size" index={rowIndex++}>
                  {item.blob ? formatBytes(itemSize(item)) : 'static asset'}
                </MetaRow>
                <MetaRow label="Created" index={rowIndex++}>
                  {formatDate(item.createdAt)}
                </MetaRow>
                {item.fisheyeParams && (
                  <MetaRow label="Fisheye" index={rowIndex++}>
                    {Math.round(item.fisheyeParams.fov)}° · AZ{' '}
                    {Math.round(item.fisheyeParams.azimuth)}° · TILT{' '}
                    {Math.round(item.fisheyeParams.tilt)}° · Z
                    {item.fisheyeParams.zoom.toFixed(2)}
                  </MetaRow>
                )}

                {/* Tags */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EXPO, delay: 0.15 + rowIndex * 0.04 }}
                  className="border-t border-line py-2"
                >
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                    Tags
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 rounded-full border border-line bg-dusk/60 px-2 py-0.5 font-mono text-[10px] text-ink-dim"
                      >
                        {tag}
                        <button
                          type="button"
                          title={`Remove tag ${tag}`}
                          onClick={() =>
                            onTagsChange(
                              item,
                              item.tags.filter((t) => t !== tag),
                            )
                          }
                          className="text-ink-faint transition-colors hover:text-danger"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                    <span className="flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5">
                      <Plus className="h-2.5 w-2.5 text-ink-faint" />
                      <input
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addTag();
                        }}
                        onBlur={addTag}
                        placeholder="add tag"
                        className="w-16 bg-transparent font-mono text-[10px] text-ink outline-none placeholder:text-ink-faint"
                      />
                    </span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 flex-col gap-2 border-t border-line p-5">
              <GoldButton onClick={() => onSend(item)}>
                <ListPlus className="h-4 w-4" />
                Send to Playlist
              </GoldButton>
              <GhostButton onClick={() => onOpenEditor(item)}>
                <CircleDot className="h-4 w-4" />
                {item.source === 'render' ? 'Re-edit in Editor' : 'Open in Editor'}
              </GhostButton>
              <GhostButton onClick={() => onDownload(item)}>
                <Download className="h-4 w-4" />
                Download
              </GhostButton>
              {item.source === 'bundled' ? (
                <span className="mt-1 self-center rounded-full border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  Bundled — always available
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  className="mt-1 flex items-center justify-center gap-2 py-1 font-mono text-xs text-danger/80 transition-colors hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete from Vault
                </button>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
