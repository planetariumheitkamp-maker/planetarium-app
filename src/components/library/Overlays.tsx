import { AnimatePresence, motion } from 'framer-motion';
import { CircleDot, Download, ListPlus, Trash2, Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { GhostButton } from '@/components/primitives';

/* --------------------------- drag-and-drop overlay --------------------------- */

export function DropOverlay({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="drop-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none fixed inset-0 z-[60] m-3 flex items-center justify-center rounded-2xl border-2 border-dashed border-gold bg-void/80 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-10 w-10 text-gold" />
            <p className="font-display text-lg font-bold uppercase tracking-widest text-gold">
              Release to import into the Vault
            </p>
            <p className="font-mono text-xs text-ink-dim">images + video · stored locally</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------- undo toast --------------------------------- */

export function UndoToast({
  count,
  onUndo,
}: {
  count: number;
  onUndo: () => void;
}) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className="glass-panel fixed bottom-16 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-3 rounded-full py-2.5 pl-1.5 pr-2"
        >
          <span className="ml-1.5 h-6 w-1 rounded-full bg-danger" />
          <span className="whitespace-nowrap text-sm text-ink">
            {count === 1 ? 'Media deleted' : `${count} items deleted`}
          </span>
          <button
            type="button"
            onClick={onUndo}
            className="rounded-full border border-gold/60 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-gold transition-colors hover:bg-gold hover:text-void"
          >
            Undo
          </button>
          <motion.span
            key={count}
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: 5, ease: 'linear' }}
            className="absolute bottom-0 left-6 right-6 h-px origin-left bg-gold/60"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------ bulk action bar ------------------------------ */

export function BulkBar({
  count,
  onSendAll,
  onDownloadAll,
  onDeleteAll,
  onClear,
}: {
  count: number;
  onSendAll: () => void;
  onDownloadAll: () => void;
  onDeleteAll: () => void;
  onClear: () => void;
}) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          key="bulk-bar"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className="glass-panel fixed bottom-14 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-4 rounded-full py-2 pl-5 pr-2"
        >
          <span className="font-mono text-xs text-gold">{count} selected</span>
          <button
            type="button"
            onClick={onSendAll}
            className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 font-display text-[10px] font-bold uppercase tracking-widest text-void transition-colors hover:bg-gold-hi"
          >
            <ListPlus className="h-3.5 w-3.5" />
            Send all to Playlist
          </button>
          <button
            type="button"
            onClick={onDownloadAll}
            className="flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 font-display text-[10px] font-medium uppercase tracking-widest text-ink-dim transition-colors hover:border-violet-hi hover:text-ink"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          <button
            type="button"
            onClick={onDeleteAll}
            className="flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 font-display text-[10px] font-medium uppercase tracking-widest text-ink-dim transition-colors hover:border-danger hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <button
            type="button"
            onClick={onClear}
            title="Clear selection"
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------ welcome banner ------------------------------- */

export function WelcomeBanner({ onImport, onDismiss }: { onImport: () => void; onDismiss: () => void }) {
  const navigate = useNavigate();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass-panel relative col-span-2 rounded-2xl border-l-2 border-l-gold p-6"
    >
      <button
        type="button"
        onClick={onDismiss}
        title="Dismiss"
        className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-ink"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="kicker mb-2">Welcome to the Vault</p>
      <p className="max-w-md text-sm text-ink-dim">
        26 planetary textures are pre-loaded — import your own media or render a dome master in
        the Editor.
      </p>
      <div className="mt-4 flex gap-3">
        <GhostButton size="md" className="px-4 py-1.5 text-[10px]" onClick={onImport}>
          <Upload className="h-3.5 w-3.5" />
          Import media
        </GhostButton>
        <GhostButton
          size="md"
          className="px-4 py-1.5 text-[10px]"
          onClick={() => navigate('/editor')}
        >
          <CircleDot className="h-3.5 w-3.5" />
          Open Editor
        </GhostButton>
      </div>
    </motion.div>
  );
}

/* ------------------------------- empty state --------------------------------- */

export function EmptyOrbit({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center gap-4 py-24"
    >
      {/* Dome wireframe (spec-dome-diagram visual language) */}
      <svg viewBox="0 0 160 100" className="h-28 w-44 text-gold/70" fill="none">
        <path
          d="M16 88 A64 64 0 0 1 144 88"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path d="M16 88 H144" stroke="currentColor" strokeWidth="1.2" />
        <ellipse cx="80" cy="88" rx="64" ry="10" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
        <path d="M80 88 L80 24" stroke="currentColor" strokeWidth="0.6" strokeDasharray="3 3" opacity="0.6" />
        <path d="M80 88 L34 42" stroke="currentColor" strokeWidth="0.6" strokeDasharray="3 3" opacity="0.4" />
        <path d="M80 88 L126 42" stroke="currentColor" strokeWidth="0.6" strokeDasharray="3 3" opacity="0.4" />
        <circle cx="80" cy="24" r="2.5" stroke="currentColor" strokeWidth="1" />
        <circle cx="80" cy="88" r="2" fill="currentColor" />
      </svg>
      <p className="font-display text-sm font-bold uppercase tracking-widest text-ink-dim">
        Nothing in this orbit
      </p>
      <p className="font-mono text-xs text-ink-faint">No media matches the current filters.</p>
      <GhostButton size="md" className="px-4 py-1.5 text-[10px]" onClick={onClearFilters}>
        Clear filters
      </GhostButton>
    </motion.div>
  );
}
