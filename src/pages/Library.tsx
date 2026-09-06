import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import type { MediaItem, StorageUsage } from '@/lib/types';
import {
  addToPlaylist,
  deleteMedia,
  ensureSeeded,
  getAllMedia,
  getStorageUsage,
  putMedia,
  resolveMediaUrl,
  revokeMediaUrl,
} from '@/lib/db';
import { GoldButton, useToast } from '@/components/primitives';
import { FilterBar } from '@/components/library/FilterBar';
import type { SortKey, SourceTab, ViewMode } from '@/components/library/FilterBar';
import { MediaGrid } from '@/components/library/MediaGrid';
import type { LibraryHandlers } from '@/components/library/MediaGrid';
import { MediaList } from '@/components/library/MediaList';
import { DetailDrawer } from '@/components/library/DetailDrawer';
import { StorageFooter } from '@/components/library/StorageFooter';
import {
  BulkBar,
  DropOverlay,
  EmptyOrbit,
  UndoToast,
  WelcomeBanner,
} from '@/components/library/Overlays';
import { useThumbs } from '@/components/library/useThumbs';
import { buildImportedItem, useCountUp } from '@/components/library/utils';

const VIEW_KEY = 'domemaster.library.view';
const WELCOME_KEY = 'domemaster.library.welcomeDismissed';
const UNDO_WINDOW_MS = 5000;

interface PendingDelete {
  items: MediaItem[];
  timer: number;
}

export default function Library() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [items, setItems] = useState<MediaItem[]>([]);
  const [usage, setUsage] = useState<StorageUsage>({ usage: 0, quota: 0, ratio: 0 });
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<SourceTab>('all');
  const [showImages, setShowImages] = useState(true);
  const [showVideos, setShowVideos] = useState(true);
  const [sort, setSort] = useState<SortKey>('newest');
  const [view, setView] = useState<ViewMode>(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem(VIEW_KEY) === 'list'
      ? 'list'
      : 'grid',
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(WELCOME_KEY) === '1',
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastSelectedIdRef = useRef<string | null>(null);
  const pendingRef = useRef<PendingDelete | null>(null);
  useEffect(() => {
    pendingRef.current = pendingDelete;
  }, [pendingDelete]);

  /* ------------------------------ data loading ------------------------------ */

  const refreshUsage = useCallback(() => {
    getStorageUsage().then(setUsage).catch(() => undefined);
  }, []);

  useEffect(() => {
    ensureSeeded()
      .then(getAllMedia)
      .then(setItems)
      .catch(() => toast('Vault failed to load', 'danger'));
    refreshUsage();
  }, [refreshUsage, toast]);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  // Commit any pending delete on unmount.
  useEffect(() => {
    return () => {
      const pending = pendingRef.current;
      if (pending) {
        window.clearTimeout(pending.timer);
        pending.items.forEach((m) => deleteMedia(m.id).catch(() => undefined));
      }
    };
  }, []);

  /* --------------------------- filtering / sorting --------------------------- */

  const counts = useMemo<Record<SourceTab, number>>(
    () => ({
      all: items.length,
      imported: items.filter((m) => m.source === 'imported').length,
      bundled: items.filter((m) => m.source === 'bundled').length,
      render: items.filter((m) => m.source === 'render').length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter((m) => {
      if (tab !== 'all' && m.source !== tab) return false;
      if (m.type === 'image' && !showImages) return false;
      if (m.type === 'video' && !showVideos) return false;
      if (q) {
        const inName = m.name.toLowerCase().includes(q);
        const inTags = m.tags.some((t) => t.toLowerCase().includes(q));
        if (!inName && !inTags) return false;
      }
      return true;
    });
    switch (sort) {
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'duration':
        list.sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0));
        break;
      case 'size':
        list.sort((a, b) => (b.blob?.size ?? 0) - (a.blob?.size ?? 0));
        break;
      case 'newest':
      default:
        list.sort((a, b) => b.createdAt - a.createdAt);
    }
    return list;
  }, [items, tab, showImages, showVideos, search, sort]);

  const thumbs = useThumbs(items);
  const detailItem = detailId ? (items.find((m) => m.id === detailId) ?? null) : null;

  /* --------------------------------- actions -------------------------------- */

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const accepted = Array.from(files).filter(
        (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
      );
      if (accepted.length === 0) {
        toast('No images or videos in that drop', 'danger');
        return;
      }
      const created: MediaItem[] = [];
      for (const file of accepted) {
        try {
          const item = await buildImportedItem(file);
          await putMedia(item);
          created.push(item);
        } catch {
          toast(`Failed to import ${file.name}`, 'danger');
        }
      }
      if (created.length > 0) {
        setItems((prev) => [...prev, ...created]);
        setFlashIds(new Set(created.map((m) => m.id)));
        window.setTimeout(() => setFlashIds(new Set()), 1400);
        toast(
          created.length === 1 ? '1 file imported' : `${created.length} files imported`,
          'success',
        );
        refreshUsage();
      }
    },
    [toast, refreshUsage],
  );

  const handleSend = useCallback(
    (item: MediaItem) => {
      addToPlaylist(item.id)
        .then(() => toast('Sent to show queue', 'success'))
        .catch(() => toast('Could not add to playlist', 'danger'));
    },
    [toast],
  );

  const handleOpenEditor = useCallback(
    (item: MediaItem) => {
      navigate('/editor', { state: { mediaId: item.id } });
    },
    [navigate],
  );

  const handleDownload = useCallback(
    async (item: MediaItem) => {
      try {
        const url = await resolveMediaUrl(item);
        const a = document.createElement('a');
        const ext = item.blob?.type.split('/')[1] ?? 'jpg';
        a.href = url;
        a.download = `${item.name}.${item.path ? item.path.split('.').pop() : ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => revokeMediaUrl(url), 1000);
      } catch {
        toast('Download failed', 'danger');
      }
    },
    [toast],
  );

  /** Soft-delete: hide now, commit to IndexedDB after the undo window. */
  const softDelete = useCallback(
    (victims: MediaItem[]) => {
      const deletable = victims.filter((m) => m.source !== 'bundled');
      if (deletable.length === 0) return;
      // Flush any earlier pending delete immediately.
      if (pendingRef.current) {
        window.clearTimeout(pendingRef.current.timer);
        pendingRef.current.items.forEach((m) => deleteMedia(m.id).catch(() => undefined));
      }
      const ids = new Set(deletable.map((m) => m.id));
      setItems((prev) => prev.filter((m) => !ids.has(m.id)));
      setSelectedIds((prev) => new Set([...prev].filter((id) => !ids.has(id))));
      if (detailId && ids.has(detailId)) setDetailId(null);
      const timer = window.setTimeout(() => {
        deletable.forEach((m) => deleteMedia(m.id).catch(() => undefined));
        setPendingDelete(null);
        refreshUsage();
      }, UNDO_WINDOW_MS);
      setPendingDelete({ items: deletable, timer });
    },
    [detailId, refreshUsage],
  );

  const handleUndo = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    setItems((prev) => [...prev, ...pending.items]);
    setPendingDelete(null);
    toast('Restored to the vault', 'success');
  }, [toast]);

  const handleRename = useCallback(
    (item: MediaItem, name: string) => {
      const next = { ...item, name };
      setItems((prev) => prev.map((m) => (m.id === item.id ? next : m)));
      putMedia(next).catch(() => toast('Rename failed', 'danger'));
    },
    [toast],
  );

  const handleTagsChange = useCallback(
    (item: MediaItem, tags: string[]) => {
      const next = { ...item, tags };
      setItems((prev) => prev.map((m) => (m.id === item.id ? next : m)));
      putMedia(next).catch(() => toast('Tag update failed', 'danger'));
    },
    [toast],
  );

  const handleToggleSelect = useCallback(
    (item: MediaItem, shiftKey: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastSelectedIdRef.current) {
          const ids = filtered.map((m) => m.id);
          const a = ids.indexOf(lastSelectedIdRef.current);
          const b = ids.indexOf(item.id);
          if (a !== -1 && b !== -1) {
            const [lo, hi] = a < b ? [a, b] : [b, a];
            for (let i = lo; i <= hi; i++) next.add(ids[i]);
            return next;
          }
        }
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        lastSelectedIdRef.current = item.id;
        return next;
      });
    },
    [filtered],
  );

  const selectedItems = useMemo(
    () => filtered.filter((m) => selectedIds.has(m.id)),
    [filtered, selectedIds],
  );

  const clearImported = useCallback(async () => {
    const victims = items.filter((m) => m.source !== 'bundled');
    if (victims.length === 0) return;
    for (const m of victims) {
      await deleteMedia(m.id).catch(() => undefined);
    }
    setItems((prev) => prev.filter((m) => m.source === 'bundled'));
    setSelectedIds(new Set());
    setDetailId(null);
    toast('Vault cleared', 'success');
    refreshUsage();
  }, [items, toast, refreshUsage]);

  const clearFilters = useCallback(() => {
    setSearch('');
    setTab('all');
    setShowImages(true);
    setShowVideos(true);
  }, []);

  const handlers: LibraryHandlers = useMemo(
    () => ({
      onToggleSelect: handleToggleSelect,
      onOpenDetail: (item) => setDetailId(item.id),
      onSend: handleSend,
      onOpenEditor: handleOpenEditor,
      onDownload: (item) => void handleDownload(item),
      onDelete: (item) => softDelete([item]),
      onRename: handleRename,
    }),
    [handleToggleSelect, handleSend, handleOpenEditor, handleDownload, softDelete, handleRename],
  );

  /* --------------------------- drag & drop import ---------------------------- */

  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setDragging(true);
    }
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) void importFiles(e.dataTransfer.files);
  };

  /* ------------------------------ keyboard ----------------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing) {
        if (e.key === 'Escape') (target as HTMLInputElement).blur();
        return;
      }
      if (e.key === 'Escape') {
        if (detailId) setDetailId(null);
        else setSelectedIds(new Set());
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        const candidate =
          selectedItems[selectedItems.length - 1] ??
          (lastSelectedIdRef.current
            ? filtered.find((m) => m.id === lastSelectedIdRef.current)
            : filtered[0]);
        if (candidate) setDetailId(candidate.id);
        return;
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedItems.length > 0) {
        e.preventDefault();
        softDelete(selectedItems);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailId, filtered, selectedItems, softDelete]);

  /* --------------------------------- stats ----------------------------------- */

  const totalBytes = useMemo(
    () => items.reduce((sum, m) => sum + (m.blob?.size ?? 0) + (m.thumbnailBlob?.size ?? 0), 0),
    [items],
  );
  const assetCount = useCountUp(items.length);
  const megaBytes = useCountUp(totalBytes / (1024 * 1024));
  const clearableCount = counts.imported + counts.render;
  const showWelcome =
    !welcomeDismissed && counts.imported === 0 && counts.render === 0 && items.length > 0;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Zone 1 — vault header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-6">
        <span className="font-display text-sm font-bold uppercase tracking-[0.25em] text-gold">
          Library
        </span>
        <span className="hidden font-mono text-xs text-ink-faint md:block">
          {Math.round(assetCount)} ASSETS · {megaBytes.toFixed(1)} MB · ALL LOCAL
        </span>
        <div className="flex items-center gap-3">
          <GoldButton onClick={() => fileInputRef.current?.click()}>
            <Plus className="h-4 w-4" />
            Import Media
          </GoldButton>
        </div>
      </div>

      {/* Zone 2 — filter bar */}
      <FilterBar
        search={search}
        onSearch={setSearch}
        searchRef={searchRef}
        tab={tab}
        onTab={setTab}
        counts={counts}
        showImages={showImages}
        showVideos={showVideos}
        onToggleImages={() => setShowImages((v) => !v)}
        onToggleVideos={() => setShowVideos((v) => !v)}
        sort={sort}
        onSort={setSort}
        view={view}
        onView={setView}
      />

      {/* Zone 3 — media grid / list */}
      <main className="min-h-0 flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <EmptyOrbit onClearFilters={clearFilters} />
        ) : view === 'grid' ? (
          <MediaGrid
            items={filtered}
            thumbs={thumbs}
            selectedIds={selectedIds}
            flashIds={flashIds}
            handlers={handlers}
            banner={
              <AnimatePresence>
                {showWelcome && (
                  <WelcomeBanner
                    key="welcome"
                    onImport={() => fileInputRef.current?.click()}
                    onDismiss={() => {
                      setWelcomeDismissed(true);
                      localStorage.setItem(WELCOME_KEY, '1');
                    }}
                  />
                )}
              </AnimatePresence>
            }
          />
        ) : (
          <MediaList
            items={filtered}
            thumbs={thumbs}
            selectedIds={selectedIds}
            handlers={handlers}
          />
        )}
      </main>

      {/* Zone 5 — storage footer */}
      <StorageFooter
        usage={usage}
        clearableCount={clearableCount}
        onClearImported={() => void clearImported()}
      />

      {/* Zone 4 — detail drawer */}
      <DetailDrawer
        item={detailItem}
        onClose={() => setDetailId(null)}
        onSend={handleSend}
        onOpenEditor={handleOpenEditor}
        onDownload={(item) => void handleDownload(item)}
        onDelete={(item) => softDelete([item])}
        onRename={handleRename}
        onTagsChange={handleTagsChange}
      />

      <BulkBar
        count={selectedIds.size}
        onSendAll={() => {
          selectedItems.forEach((m) => addToPlaylist(m.id).catch(() => undefined));
          setSelectedIds(new Set());
          toast(
            selectedItems.length === 1
              ? 'Sent to show queue'
              : `${selectedItems.length} items sent to show queue`,
            'success',
          );
        }}
        onDownloadAll={() => selectedItems.forEach((m) => void handleDownload(m))}
        onDeleteAll={() => softDelete(selectedItems)}
        onClear={() => setSelectedIds(new Set())}
      />

      <UndoToast count={pendingDelete?.items.length ?? 0} onUndo={handleUndo} />
      <DropOverlay active={dragging} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void importFiles(e.target.files);
          e.target.value = '';
        }}
      />

    </div>
  );
}
