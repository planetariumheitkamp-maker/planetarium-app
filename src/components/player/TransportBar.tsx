import { useState } from 'react';
import { motion } from 'framer-motion';
import { Minus, Pause, Play, Plus, Repeat, SkipBack, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlayerMode } from './Stage';

function fmtShow(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface TransportBarProps {
  mode: PlayerMode;
  onSetMode: (mode: PlayerMode) => void;
  onPrev: () => void;
  onNext: () => void;
  canAdvance: boolean;
  /** Current item is a video → play/pause is available */
  isVideo: boolean;
  videoPaused: boolean;
  onToggleVideo: () => void;
  /** Videos start muted (autoplay-safe); user can unmute here. */
  muted: boolean;
  onToggleMute: () => void;
  /** Default hold time for images without an override (persisted). */
  imageDurationSec: number;
  onImageDurationChange: (delta: number) => void;
  loop: boolean;
  onToggleLoop: () => void;
  runtimeSec: number;
  elapsedSec: number;
  /** Auto mode is actively running (drives THE BUTTON's breath pulse) */
  autoRunning: boolean;
}

/**
 * Transport bar (player.md §Zone 4): segmented AUTO|MANUAL toggle, prev,
 * THE BUTTON (one-button advance), video play/pause, loop, runtime estimate
 * + elapsed show timer in JetBrains Mono.
 */
export default function TransportBar({
  mode,
  onSetMode,
  onPrev,
  onNext,
  canAdvance,
  isVideo,
  videoPaused,
  onToggleVideo,
  muted,
  onToggleMute,
  imageDurationSec,
  onImageDurationChange,
  loop,
  onToggleLoop,
  runtimeSec,
  elapsedSec,
  autoRunning,
}: TransportBarProps) {
  const [ripples, setRipples] = useState<number[]>([]);

  const fireNext = () => {
    if (!canAdvance) return;
    setRipples((r) => [...r.slice(-3), Date.now()]);
    onNext();
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass-panel flex h-20 shrink-0 items-center justify-between gap-4 border-t border-line px-4"
    >
      {/* Left cluster: mode toggle + transport */}
      <div className="flex items-center gap-3">
        {/* Segmented AUTO | MANUAL */}
        <div className="flex rounded-full bg-dusk p-1" title="Playback mode (A)">
          {(['auto', 'manual'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onSetMode(m)}
              className="relative rounded-full px-4 py-1.5 font-display text-[10px] font-bold uppercase tracking-widest"
            >
              {mode === m && (
                <motion.span
                  layoutId="player-mode-pill"
                  transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                  className={cn(
                    'absolute inset-0 rounded-full',
                    m === 'auto' ? 'bg-gold' : 'bg-violet-hi',
                  )}
                />
              )}
              <span
                className={cn(
                  'relative z-10 transition-colors',
                  mode === m ? 'text-void' : 'text-ink-dim hover:text-ink',
                )}
              >
                {m}
              </span>
            </button>
          ))}
        </div>

        {/* Prev */}
        <button
          type="button"
          onClick={onPrev}
          title="Previous (←)"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-dim transition-all duration-200 ease-orbital hover:border-violet-hi hover:text-ink hover:shadow-glow-violet"
        >
          <SkipBack className="h-4 w-4" strokeWidth={1.75} />
        </button>

        {/* THE BUTTON — the single advance control */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={fireNext}
          disabled={!canAdvance}
          title="Next (Space)"
          className={cn(
            'relative flex h-14 w-14 items-center justify-center rounded-full bg-gold text-void',
            'shadow-glow-gold transition-colors duration-200 ease-orbital hover:bg-gold-hi',
            'disabled:pointer-events-none disabled:opacity-40',
            autoRunning && 'animate-pulse-gold',
          )}
        >
          {ripples.map((id) => (
            <motion.span
              key={id}
              initial={{ opacity: 0.7, scale: 1 }}
              animate={{ opacity: 0, scale: 1.9 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              onAnimationComplete={() => setRipples((r) => r.filter((x) => x !== id))}
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-gold"
            />
          ))}
          <Play className="ml-0.5 h-6 w-6 fill-current" />
        </motion.button>

        {/* Video play/pause */}
        <button
          type="button"
          onClick={onToggleVideo}
          disabled={!isVideo}
          title={isVideo ? 'Play / pause video (Space)' : 'Play / pause (video items only)'}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-dim transition-all duration-200 ease-orbital hover:border-violet-hi hover:text-ink hover:shadow-glow-violet disabled:pointer-events-none disabled:opacity-30"
        >
          {isVideo && !videoPaused ? (
            <Pause className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <Play className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>

        {/* Video mute/unmute (videos start muted so autoplay is never blocked) */}
        <button
          type="button"
          onClick={onToggleMute}
          disabled={!isVideo}
          title={
            isVideo
              ? muted
                ? 'Unmute video (M)'
                : 'Mute video (M)'
              : 'Mute / unmute (video items only)'
          }
          aria-pressed={!muted}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-200 ease-orbital disabled:pointer-events-none disabled:opacity-30',
            isVideo && !muted
              ? 'border-gold/60 text-gold shadow-glow-gold'
              : 'border-line text-ink-dim hover:border-violet-hi hover:text-ink hover:shadow-glow-violet',
          )}
        >
          {muted ? (
            <VolumeX className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <Volume2 className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>

        {/* Loop toggle */}
        <button
          type="button"
          onClick={onToggleLoop}
          title="Loop playlist (L)"
          aria-pressed={loop}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-200 ease-orbital',
            loop
              ? 'border-gold/60 text-gold shadow-glow-gold'
              : 'border-line text-ink-dim hover:border-violet-hi hover:text-ink',
          )}
        >
          <Repeat className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* Right: default image hold + runtime estimate + elapsed show timer */}
      <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
        <div
          className="glass-panel flex items-center gap-0.5 rounded-full px-1 py-0.5"
          title="Default image hold time in AUTO mode (persisted)"
        >
          <button
            type="button"
            title="Shorter default image hold (−1s)"
            onClick={() => onImageDurationChange(-1)}
            className="flex h-5 w-5 items-center justify-center rounded-full text-ink-dim transition-colors hover:text-gold"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="whitespace-nowrap px-1 text-[10px] text-ink-faint">
            IMG <span className="text-gold">{imageDurationSec}s</span>
          </span>
          <button
            type="button"
            title="Longer default image hold (+1s)"
            onClick={() => onImageDurationChange(1)}
            className="flex h-5 w-5 items-center justify-center rounded-full text-ink-dim transition-colors hover:text-gold"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <span className="text-gold">SHOW {fmtShow(runtimeSec)}</span>
        <span className="text-ink-dim">ELAPSED {fmtShow(elapsedSec)}</span>
      </div>
    </motion.div>
  );
}
