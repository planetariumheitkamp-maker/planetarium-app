import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/lib/types';

/* -------------------------------- GoldButton -------------------------------- */

type GoldButtonProps = HTMLMotionProps<'button'> & {
  size?: 'md' | 'lg';
};

export function GoldButton({ size = 'md', className, children, ...props }: GoldButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-display font-bold uppercase tracking-widest',
        'bg-gold text-void transition-colors duration-200 ease-orbital hover:bg-gold-hi',
        'shadow-glow-gold hover:shadow-glow-gold-lg disabled:opacity-50 disabled:pointer-events-none',
        size === 'md' ? 'px-6 py-2.5 text-sm' : 'px-10 py-4 text-lg',
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}

/* -------------------------------- GhostButton ------------------------------- */

export function GhostButton({ size = 'md', className, children, ...props }: GoldButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full border border-line font-display font-medium uppercase tracking-widest',
        'text-ink-dim transition-all duration-200 ease-orbital',
        'hover:text-ink hover:border-violet-hi hover:shadow-glow-violet',
        'disabled:opacity-50 disabled:pointer-events-none',
        size === 'md' ? 'px-6 py-2.5 text-sm' : 'px-10 py-4 text-lg',
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}

/* --------------------------------- PanelCard -------------------------------- */

export function PanelCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-nebula p-6 transition-all duration-300 ease-orbital',
        'hover:-translate-y-0.5 hover:border-[rgba(209,184,136,0.3)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------- ToggleSwitch ------------------------------- */

export function ToggleSwitch({
  checked,
  onCheckedChange,
  disabled,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-6 w-11 rounded-full transition-colors duration-200 ease-orbital',
        'disabled:opacity-40 disabled:pointer-events-none',
        checked ? 'bg-brand' : 'bg-dusk border border-line',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-gold shadow-glow-gold',
          checked ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </button>
  );
}

/* --------------------------------- GoldSlider ------------------------------- */
/* Custom slider per design.md §7.4: thin line track, gold fill, 14px gold
   thumb with purple glow, mono value tooltip above thumb while dragging. */

export function GoldSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const ratio = max > min ? (value - min) / (max - min) : 0;
  const pct = Math.min(100, Math.max(0, ratio * 100));

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const r = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const raw = min + r * (max - min);
      const stepped = Math.round(raw / step) * step;
      onChange(Math.min(max, Math.max(min, Number(stepped.toFixed(6)))));
    },
    [min, max, step, onChange],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging) setFromClientX(e.clientX);
  };
  const onPointerUp = () => setDragging(false);

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(max, value + step));
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(min, value - step));
      }}
      className={cn(
        'relative h-6 w-full cursor-pointer select-none touch-none',
        disabled && 'opacity-40 pointer-events-none',
        className,
      )}
    >
      {/* track */}
      <div className="absolute top-1/2 h-[3px] w-full -translate-y-1/2 rounded-full bg-line" />
      {/* gold fill */}
      <div
        className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gold"
        style={{ width: `${pct}%` }}
      />
      {/* thumb */}
      <div
        className={cn(
          'absolute top-1/2 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold',
          'shadow-[0_0_12px_rgba(107,79,187,0.8)] transition-transform',
          dragging && 'scale-125',
        )}
        style={{ left: `${pct}%` }}
      />
      {/* value tooltip while dragging */}
      {dragging && (
        <div
          className="absolute -top-6 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-void px-1.5 py-0.5 font-mono text-[10px] text-gold"
          style={{ left: `${pct}%` }}
        >
          {formatValue ? formatValue(value) : String(value)}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- MediaCard -------------------------------- */
/* 16:9 thumbnail card; hover reveals overlay gradient + actions (§7.4). */

export function MediaCard({
  item,
  thumbnailUrl,
  actions,
  onClick,
  className,
}: {
  item: MediaItem;
  /** Resolved via resolveThumbnailUrl(); falls back to item.path */
  thumbnailUrl?: string;
  /** Action buttons (send-to-playlist / download / delete…) slide in on hover */
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const src = thumbnailUrl ?? item.path;
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-line bg-nebula',
        'transition-transform duration-300 ease-orbital hover:scale-[1.03]',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-void">
        {src ? (
          <img
            src={src}
            alt={item.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full animate-shimmer shimmer" />
        )}
        {/* overlay gradient + actions slide in from bottom */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 translate-y-4 bg-gradient-to-t from-void/90 to-transparent opacity-0 transition-all duration-300 ease-orbital group-hover:translate-y-0 group-hover:opacity-100" />
        {actions && (
          <div className="absolute inset-x-0 bottom-0 flex translate-y-6 items-center justify-center gap-2 p-3 opacity-0 transition-all duration-300 ease-orbital group-hover:translate-y-0 group-hover:opacity-100">
            {actions}
          </div>
        )}
        {item.type === 'video' && typeof item.duration === 'number' && (
          <span className="absolute right-2 top-2 rounded-md bg-void/80 px-1.5 py-0.5 font-mono text-[10px] text-gold">
            {formatDuration(item.duration)}
          </span>
        )}
      </div>
      <div className="px-3 py-2">
        <p className="truncate text-sm font-medium text-ink">{item.name}</p>
        <p className="truncate font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          {item.source} · {item.type}
        </p>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ---------------------------------- Timecode -------------------------------- */
/* JetBrains Mono gold digits, HH:MM:SS:FF style (§7.4). */

export function Timecode({
  seconds,
  fps = 30,
  className,
}: {
  seconds: number;
  fps?: number;
  className?: string;
}) {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const f = Math.floor((total % 1) * fps);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    <span className={cn('font-mono text-gold tabular-nums', className)}>
      {p(h)}:{p(m)}:{p(s)}:{p(f)}
    </span>
  );
}

/* ----------------------------------- Toast ---------------------------------- */
/* Bottom-center glass pill, gold left border, Framer Motion slide-up (§7.4). */

export type ToastVariant = 'default' | 'success' | 'danger';

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'default') => {
      const id = nextToastId++;
      setToasts((list) => [...list, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className={cn(
                'glass-panel pointer-events-auto flex w-auto items-center gap-3 rounded-full py-2.5 pl-1.5 pr-5',
              )}
              onClick={() => dismiss(t.id)}
            >
              <span
                className={cn(
                  'h-6 w-1 rounded-full',
                  t.variant === 'success' && 'bg-success',
                  t.variant === 'danger' && 'bg-danger',
                  t.variant === 'default' && 'bg-gold',
                )}
              />
              <span className="text-sm text-ink">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}
