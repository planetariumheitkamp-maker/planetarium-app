import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Trash2 } from 'lucide-react';
import type { StorageUsage } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatBytes } from './utils';

const WARN_RATIO = 0.8;

export function StorageFooter({
  usage,
  clearableCount,
  onClearImported,
}: {
  usage: StorageUsage;
  clearableCount: number;
  onClearImported: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pct = Math.min(100, Math.max(0, usage.ratio * 100));
  const warn = usage.quota > 0 && usage.ratio >= WARN_RATIO;
  const label =
    usage.quota > 0
      ? `${formatBytes(usage.usage)} / ${formatBytes(usage.quota)}`
      : `${formatBytes(usage.usage)} used`;

  return (
    <footer className="flex h-10 shrink-0 items-center justify-between gap-6 border-t border-line px-6">
      {/* Usage bar */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-dusk">
          <motion.div
            className={cn('h-full rounded-full', warn ? 'bg-danger' : 'bg-gold')}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        {warn && (
          <AlertTriangle className="h-3.5 w-3.5 animate-pulse text-danger" strokeWidth={2} />
        )}
        <span
          className={cn(
            'whitespace-nowrap font-mono text-[10px]',
            warn ? 'text-danger' : 'text-ink-faint',
          )}
        >
          {label}
          {warn && ' · storage nearly full'}
        </span>
      </div>

      {/* Status line */}
      <motion.span
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-ink-faint md:block"
      >
        Vault synced · Local only · Nothing uploads
      </motion.span>

      {/* Clear imported */}
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={clearableCount === 0}
        className="flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-ink-faint transition-colors hover:text-danger disabled:pointer-events-none disabled:opacity-40"
      >
        <Trash2 className="h-3 w-3" />
        Clear imported media…
      </button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-line bg-nebula text-ink">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest">
              Clear the vault?
            </DialogTitle>
            <DialogDescription className="text-ink-dim">
              This permanently deletes all {clearableCount} imported and rendered item
              {clearableCount === 1 ? '' : 's'} from local storage. Bundled planet textures are
              untouched and always available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-full border border-line px-5 py-2 font-display text-xs font-medium uppercase tracking-widest text-ink-dim transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                onClearImported();
              }}
              className="rounded-full bg-danger px-5 py-2 font-display text-xs font-bold uppercase tracking-widest text-void transition-opacity hover:opacity-90"
            >
              Delete {clearableCount} item{clearableCount === 1 ? '' : 's'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
