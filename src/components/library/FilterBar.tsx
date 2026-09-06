import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Film, Image, LayoutGrid, List, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SourceTab = 'all' | 'imported' | 'bundled' | 'render';
export type SortKey = 'newest' | 'name' | 'duration' | 'size';
export type ViewMode = 'grid' | 'list';

const SOURCE_TABS: Array<{ key: SourceTab; label: string }> = [
  { key: 'all', label: 'ALL' },
  { key: 'imported', label: 'IMPORTED' },
  { key: 'bundled', label: 'BUNDLED' },
  { key: 'render', label: 'RENDERS' },
];

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'newest', label: 'Newest' },
  { key: 'name', label: 'Name A–Z' },
  { key: 'duration', label: 'Duration' },
  { key: 'size', label: 'Size' },
];

interface FilterBarProps {
  search: string;
  onSearch: (v: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  tab: SourceTab;
  onTab: (t: SourceTab) => void;
  counts: Record<SourceTab, number>;
  showImages: boolean;
  showVideos: boolean;
  onToggleImages: () => void;
  onToggleVideos: () => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
}

export function FilterBar({
  search,
  onSearch,
  searchRef,
  tab,
  onTab,
  counts,
  showImages,
  showVideos,
  onToggleImages,
  onToggleVideos,
  sort,
  onSort,
  view,
  onView,
}: FilterBarProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (sortWrapRef.current && !sortWrapRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [sortOpen]);

  const activeSort = SORT_OPTIONS.find((o) => o.key === sort);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-14 shrink-0 items-center gap-4 border-b border-line px-6"
    >
      {/* Search */}
      <div className="glass-panel flex h-9 w-72 items-center gap-2 rounded-full px-3">
        <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="search the vault…"
          className="w-full bg-transparent font-mono text-xs text-ink outline-none placeholder:text-ink-faint"
        />
      </div>

      {/* Source tabs */}
      <div className="flex items-center gap-1 rounded-full bg-dusk/60 p-1">
        {SOURCE_TABS.map(({ key, label }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onTab(key)}
              className={cn(
                'relative flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[10px] font-medium uppercase tracking-widest transition-colors',
                active ? 'text-void' : 'text-ink-faint hover:text-ink-dim',
              )}
            >
              {active && (
                <motion.span
                  layoutId="library-source-pill"
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className="absolute inset-0 rounded-full bg-gold"
                />
              )}
              <span className="relative z-10">{label}</span>
              <span
                className={cn(
                  'relative z-10 rounded-full px-1 font-mono text-[9px]',
                  active ? 'bg-void/15 text-void' : 'bg-dusk text-ink-faint',
                )}
              >
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Type toggles */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleImages}
          title="Toggle images"
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-full border px-3 font-mono text-[10px] uppercase tracking-wider transition-colors',
            showImages
              ? 'border-gold/50 text-gold'
              : 'border-line text-ink-faint hover:text-ink-dim',
          )}
        >
          <Image className="h-3.5 w-3.5" />
          Images
        </button>
        <button
          type="button"
          onClick={onToggleVideos}
          title="Toggle videos"
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-full border px-3 font-mono text-[10px] uppercase tracking-wider transition-colors',
            showVideos
              ? 'border-gold/50 text-gold'
              : 'border-line text-ink-faint hover:text-ink-dim',
          )}
        >
          <Film className="h-3.5 w-3.5" />
          Videos
        </button>
      </div>

      <div className="flex-1" />

      {/* Sort dropdown */}
      <div ref={sortWrapRef} className="relative">
        <button
          type="button"
          onClick={() => setSortOpen((o) => !o)}
          className="flex h-8 items-center gap-2 rounded-full border border-line px-3 font-mono text-[10px] uppercase tracking-wider text-ink-dim transition-colors hover:border-violet-hi hover:text-ink"
        >
          {activeSort?.label}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', sortOpen && 'rotate-180')}
          />
        </button>
        <AnimatePresence>
          {sortOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="glass-panel absolute right-0 top-10 z-30 w-40 overflow-hidden rounded-xl"
            >
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    onSort(opt.key);
                    setSortOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left font-mono text-[11px] transition-colors',
                    sort === opt.key
                      ? 'bg-dusk/70 text-gold'
                      : 'text-ink-dim hover:bg-dusk/50 hover:text-ink',
                  )}
                >
                  {opt.label}
                  {sort === opt.key && <Check className="h-3 w-3" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 rounded-full bg-dusk/60 p-1">
        {(
          [
            { key: 'grid', icon: LayoutGrid, label: 'Grid view' },
            { key: 'list', icon: List, label: 'List view' },
          ] as const
        ).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onView(key)}
            title={label}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
              view === key ? 'bg-gold text-void' : 'text-ink-faint hover:text-ink-dim',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
