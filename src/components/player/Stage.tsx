import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Film, Image as ImageIcon, Play, SkipBack, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GhostButton, GoldButton } from '@/components/primitives';
import MediaLayer from './MediaLayer';
import type { LayerSlot } from './MediaLayer';
import type { QueueItem } from './useQueue';
import { imageDurationSec } from './useQueue';

export type PlayerMode = 'auto' | 'manual';

const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0');

function transitionLabel(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ------------------------------ Countdown ring ----------------------------- */

function CountdownRing({ progress, hot }: { progress: number; hot: boolean }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 -rotate-90">
      <circle cx="10" cy="10" r={r} fill="none" stroke="#2A2050" strokeWidth="2" />
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="none"
        stroke={hot ? '#EBD9AE' : '#D1B888'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * progress}
        className={hot ? 'animate-pulse' : undefined}
      />
    </svg>
  );
}

/* --------------------------------- Stage HUD -------------------------------- */
/* Owns its rAF progress loop (auto mode): top progress arc, top-left glass
   chip with countdown ring, and the "up next" peek. Re-renders are isolated
   to this subtree so the media layers are never disturbed. */

interface StageHudProps {
  mode: PlayerMode;
  hudKey: number;
  item: QueueItem;
  index: number;
  count: number;
  nextItem: QueueItem | null;
  getVideoInfo: () => { progress: number; remaining: number };
}

function StageHud({ mode, hudKey, item, index, count, nextItem, getVideoInfo }: StageHudProps) {
  const auto = mode === 'auto';
  const isVideo = item.media.type === 'video';
  const durationSec = imageDurationSec(item);
  const [progress, setProgress] = useState(0);
  const [remaining, setRemaining] = useState(durationSec);

  useEffect(() => {
    if (!auto) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (isVideo) {
        const info = getVideoInfo();
        setProgress(Math.min(1, Math.max(0, info.progress)));
        setRemaining(info.remaining);
      } else {
        const p = Math.min(1, (now - start) / Math.max(1, durationSec * 1000));
        setProgress(p);
        setRemaining(Math.max(0, durationSec * (1 - p)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto, hudKey, isVideo, durationSec, getVideoInfo]);

  const hot = auto && remaining <= 3;
  // Peek: always in manual mode; final 3s in auto mode.
  const showPeek = nextItem !== null && (mode === 'manual' ? true : auto && remaining <= 3);

  return (
    <>
      {/* Auto-progress arc along the very top edge */}
      {auto && (
        <div className="absolute inset-x-0 top-0 z-20 h-[2px] bg-line/40">
          <div
            className={cn('h-full transition-colors', hot ? 'bg-gold-hi' : 'bg-gold')}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {/* Top-left HUD chip (re-staggers on item change) */}
      <motion.div
        key={hudKey}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="glass-panel absolute left-4 top-4 z-20 flex items-center gap-3 rounded-full py-2 pl-3 pr-4"
      >
        {auto && !isVideo && <CountdownRing progress={progress} hot={hot} />}
        {isVideo ? (
          <Film className="h-4 w-4 text-gold" strokeWidth={1.75} />
        ) : (
          !auto && <ImageIcon className="h-4 w-4 text-gold" strokeWidth={1.75} />
        )}
        <span className="font-mono text-xs text-ink">{item.media.name}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          {pad(index + 1)} / {pad(count)}
        </span>
        {auto && !isVideo && (
          <span className={cn('font-mono text-[10px] tabular-nums', hot ? 'text-gold-hi' : 'text-ink-faint')}>
            {Math.ceil(remaining)}s
          </span>
        )}
      </motion.div>

      {/* Up-next peek */}
      <AnimatePresence>
        {showPeek && nextItem && (
          <motion.div
            key={`peek-${nextItem.entry.id}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="glass-panel absolute bottom-4 right-4 z-20 w-40 overflow-hidden rounded-xl"
          >
            <div className="aspect-video w-full overflow-hidden bg-void">
              <img
                src={nextItem.thumbUrl}
                alt={nextItem.media.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="px-3 py-2">
              <p className="font-display text-[9px] font-medium uppercase tracking-[0.3em] text-gold">
                Up next
              </p>
              <p className="truncate font-mono text-[10px] text-ink-dim">{nextItem.media.name}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------- Empty state -------------------------------- */

function DomeWireframe() {
  return (
    <svg width="200" height="112" viewBox="0 0 200 112" fill="none" aria-hidden>
      <path d="M12 100 A88 88 0 0 1 188 100" stroke="#D1B888" strokeOpacity="0.55" strokeWidth="1.5" />
      <path d="M44 100 A56 56 0 0 1 156 100" stroke="#6B4FBB" strokeOpacity="0.45" />
      <path d="M72 100 A28 28 0 0 1 128 100" stroke="#6B4FBB" strokeOpacity="0.3" />
      <line x1="4" y1="100" x2="196" y2="100" stroke="#D1B888" strokeOpacity="0.4" />
      <line x1="100" y1="100" x2="100" y2="14" stroke="#D1B888" strokeOpacity="0.25" strokeDasharray="3 4" />
      <line x1="100" y1="100" x2="38" y2="30" stroke="#2A2050" />
      <line x1="100" y1="100" x2="162" y2="30" stroke="#2A2050" />
      <circle cx="100" cy="14" r="2.5" fill="#D1B888" />
    </svg>
  );
}

/* ---------------------------------- Stage ----------------------------------- */

export interface StageProps {
  stageRef: React.RefObject<HTMLDivElement | null>;
  layers: [LayerSlot, LayerSlot];
  activeLayer: number;
  transitionMs: number;
  mode: PlayerMode;
  count: number;
  currentIndex: number;
  currentItem: QueueItem | null;
  nextItem: QueueItem | null;
  autoHalted: boolean;
  present: boolean;
  getVideoInfo: () => { progress: number; remaining: number };
  registerVideo: (el: HTMLVideoElement | null, owner: number) => void;
  onVideoEnded: () => void;
  onVideoPlayState: (paused: boolean) => void;
  onCycleTransition: () => void;
  onAdvance: () => void;
  onPrev: () => void;
  onSetMode: (mode: PlayerMode) => void;
  onExitPresent: () => void;
  onReplay: () => void;
  onLoadDemo: () => void;
  onOpenLibrary: () => void;
}

export default function Stage({
  stageRef,
  layers,
  activeLayer,
  transitionMs,
  mode,
  count,
  currentIndex,
  currentItem,
  nextItem,
  autoHalted,
  present,
  getVideoInfo,
  registerVideo,
  onVideoEnded,
  onVideoPlayState,
  onCycleTransition,
  onAdvance,
  onPrev,
  onSetMode,
  onExitPresent,
  onReplay,
  onLoadDemo,
  onOpenLibrary,
}: StageProps) {
  /* Present-mode HUD: auto-hides after 3s of no mouse movement. */
  const [hudVisible, setHudVisible] = useState(true);
  const hudTimer = useRef<number | undefined>(undefined);
  const pokeHud = useCallback(() => {
    setHudVisible(true);
    window.clearTimeout(hudTimer.current);
    hudTimer.current = window.setTimeout(() => setHudVisible(false), 3000);
  }, []);
  useEffect(() => {
    if (!present) return;
    const t = window.setTimeout(pokeHud, 0);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(hudTimer.current);
    };
  }, [present, pokeHud]);

  /* Present-mode enter animation: fade from black + 0.96→1 settle, 0.6s. */
  const [intro, setIntro] = useState(false);
  const [introScale, setIntroScale] = useState(false);
  useEffect(() => {
    if (!present) return;
    const raf = requestAnimationFrame(() => {
      setIntro(true);
      setIntroScale(true);
      requestAnimationFrame(() => setIntroScale(false));
    });
    const t = window.setTimeout(() => setIntro(false), 700);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [present]);

  const activeKey = layers[activeLayer].key;

  return (
    <div
      ref={stageRef}
      onMouseMove={present ? pokeHud : undefined}
      className={cn(
        'relative min-h-0 flex-1 overflow-hidden bg-void',
        present && 'fixed inset-0 z-[90]',
        present && !hudVisible && 'cursor-none',
      )}
    >
      {/* Soft nebula vignette */}
      <div className="pointer-events-none absolute inset-0 bg-nebula-radial opacity-40" />

      {/* A/B media layers (wrapped for the present-mode scale settle) */}
      <div
        className="absolute inset-0 transition-transform ease-orbital"
        style={{
          transform: introScale ? 'scale(0.96)' : 'scale(1)',
          transitionDuration: '600ms',
        }}
      >
        {layers.map((slot, i) => (
          <MediaLayer
            key={i}
            slot={slot}
            active={i === activeLayer}
            transitionMs={transitionMs}
            registerVideo={registerVideo}
            onVideoEnded={onVideoEnded}
            onVideoPlayState={onVideoPlayState}
          />
        ))}
      </div>

      {/* Fade-from-black overlay on present enter */}
      {intro && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-0 z-40 bg-void"
        />
      )}

      {/* Empty state */}
      {count === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 px-6 text-center">
          <DomeWireframe />
          <div>
            <p className="font-display text-xl font-bold uppercase tracking-widest text-ink">
              Your stage is empty.
            </p>
            <p className="mt-2 text-sm text-ink-dim">
              Queue up media from the vault, or load the bundled demo show.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <GoldButton onClick={onLoadDemo}>Load demo show</GoldButton>
            <GhostButton onClick={onOpenLibrary}>Open Library</GhostButton>
          </div>
        </div>
      )}

      {/* Normal stage HUD (hidden while presenting) */}
      {!present && currentItem && (
        <StageHud
          mode={mode}
          hudKey={activeKey}
          item={currentItem}
          index={currentIndex}
          count={count}
          nextItem={nextItem}
          getVideoInfo={getVideoInfo}
        />
      )}

      {/* Transition preset chip (top-right) */}
      {!present && count > 0 && (
        <button
          type="button"
          onClick={onCycleTransition}
          title="Cycle crossfade duration (0.5s / 1.2s / 2.5s)"
          className="glass-panel absolute right-4 top-4 z-20 rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-dim transition-colors hover:text-gold"
        >
          XFADE <span className="text-gold">{transitionLabel(transitionMs)}</span>
        </button>
      )}

      {/* Auto mode reached the end (loop off) */}
      {autoHalted && count > 0 && (
        <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel flex items-center gap-4 rounded-full py-2.5 pl-6 pr-3"
          >
            <span className="font-display text-[10px] font-medium uppercase tracking-[0.3em] text-gold">
              Show complete
            </span>
            <GoldButton size="md" onClick={onReplay} className="px-5 py-1.5 text-xs">
              Replay
            </GoldButton>
          </motion.div>
        </div>
      )}

      {/* Present-mode minimal HUD */}
      <AnimatePresence>
        {present && hudVisible && currentItem && (
          <>
            <motion.span
              key="present-name"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute left-5 top-5 z-30 font-mono text-xs text-ink"
            >
              {currentItem.media.name}
            </motion.span>
            <div
              key="present-pill"
              className="absolute bottom-8 left-1/2 z-30 -translate-x-1/2"
            >
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.3 }}
                className="glass-panel flex items-center gap-3 rounded-full px-4 py-2.5"
              >
                <button
                  type="button"
                  onClick={onPrev}
                  title="Previous"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim transition-colors hover:text-ink"
                >
                  <SkipBack className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <span className="font-mono text-xs tabular-nums text-ink-dim">
                  {pad(currentIndex + 1)} / {pad(count)}
                </span>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={onAdvance}
                  title="Next (Space)"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-void shadow-glow-gold transition-colors hover:bg-gold-hi"
                >
                  <Play className="ml-0.5 h-4 w-4 fill-current" />
                </motion.button>
                <div className="flex rounded-full bg-dusk p-0.5" title="Auto / Manual (A)">
                  {(['auto', 'manual'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onSetMode(m)}
                      className={cn(
                        'rounded-full px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-widest transition-colors',
                        mode === m ? 'bg-gold text-void' : 'text-ink-faint hover:text-ink-dim',
                      )}
                    >
                      {m === 'auto' ? 'A' : 'M'}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onExitPresent}
                  title="Exit present mode (Esc)"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim transition-colors hover:text-ink"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
