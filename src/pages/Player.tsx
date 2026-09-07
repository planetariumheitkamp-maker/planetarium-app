import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Maximize } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GoldButton, useToast } from '@/components/primitives';
import Stage from '@/components/player/Stage';
import type { PlayerMode } from '@/components/player/Stage';
import type { LayerSlot } from '@/components/player/MediaLayer';
import PlaylistRail from '@/components/player/PlaylistRail';
import LibraryDrawer from '@/components/player/LibraryDrawer';
import TransportBar from '@/components/player/TransportBar';
import {
  useQueue,
  getDefaultImageDuration,
  imageDurationSec,
  setDefaultImageDuration,
} from '@/components/player/useQueue';
import type { QueueItem } from '@/components/player/useQueue';

const TRANSITION_PRESETS = [500, 1200, 2500] as const;

const SETTINGS_KEY = 'domemaster.player.settings';

interface PlayerSettings {
  mode?: PlayerMode;
  loop?: boolean;
  transitionMs?: number;
}

function loadSettings(): PlayerSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as PlayerSettings;
  } catch {
    /* storage unavailable / corrupt */
  }
  return {};
}

const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0');

const EMPTY_LAYERS: [LayerSlot, LayerSlot] = [
  { item: null, key: 0 },
  { item: null, key: 0 },
];

/**
 * Player page (/player) — the presentation instrument (player.md).
 * A/B-layer crossfade stage, AUTO/MANUAL advance, show queue rail,
 * fullscreen Present mode with auto-hiding HUD, keyboard transport.
 */
export default function Player() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queue = useQueue();
  const { items, loading } = queue;

  const [mode, setMode] = useState<PlayerMode>(() =>
    loadSettings().mode === 'manual' ? 'manual' : 'auto',
  );
  const [loop, setLoop] = useState(() => loadSettings().loop !== false);
  const [transitionMs, setTransitionMs] = useState<number>(() => {
    const saved = loadSettings().transitionMs;
    return TRANSITION_PRESETS.includes(saved as (typeof TRANSITION_PRESETS)[number])
      ? (saved as number)
      : 1200;
  });
  const [imageDuration, setImageDuration] = useState(() => getDefaultImageDuration());
  const [muted, setMuted] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [layers, setLayers] = useState<[LayerSlot, LayerSlot]>(EMPTY_LAYERS);
  const [activeLayer, setActiveLayer] = useState<0 | 1>(0);
  const [autoHalted, setAutoHalted] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [present, setPresent] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const keyCounter = useRef(0);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoOwnerRef = useRef(-1);

  /* Latest-value refs for stable callbacks / keyboard handler (synced post-render) */
  const itemsRef = useRef<QueueItem[]>(items);
  const currentIdRef = useRef<string | null>(currentId);
  const loopRef = useRef(loop);
  const modeRef = useRef(mode);
  const activeLayerRef = useRef(activeLayer);
  useEffect(() => {
    itemsRef.current = items;
    currentIdRef.current = currentId;
    loopRef.current = loop;
    modeRef.current = mode;
    activeLayerRef.current = activeLayer;
  }, [items, currentId, loop, mode, activeLayer]);

  /* Persist player settings (mode / loop / transition preset). */
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ mode, loop, transitionMs }));
    } catch {
      /* storage unavailable */
    }
  }, [mode, loop, transitionMs]);

  /* ------------------------------ crossfade engine ----------------------------- */

  const showItem = useCallback((item: QueueItem) => {
    const incoming: 0 | 1 = activeLayerRef.current === 0 ? 1 : 0;
    activeLayerRef.current = incoming;
    keyCounter.current += 1;
    const key = keyCounter.current;
    setActiveLayer(incoming);
    setLayers((prev) => {
      const next = [...prev] as [LayerSlot, LayerSlot];
      next[incoming] = { item, key };
      return next;
    });
    setCurrentId(item.entry.id);
    setVideoPaused(false);
  }, []);

  // Release the outgoing layer once its crossfade has finished.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setLayers((prev) => {
        const inactive = activeLayer === 0 ? 1 : 0;
        if (!prev[inactive].item) return prev;
        const next = [...prev] as [LayerSlot, LayerSlot];
        next[inactive] = { item: null, key: 0 };
        return next;
      });
    }, transitionMs + 250);
    return () => window.clearTimeout(t);
  }, [activeLayer, transitionMs]);

  /* --------------------------------- navigation -------------------------------- */

  const navigateBy = useCallback(
    (dir: 1 | -1) => {
      const list = itemsRef.current;
      if (list.length === 0) return;
      const curIdx = list.findIndex((i) => i.entry.id === currentIdRef.current);
      const cur = curIdx >= 0 ? curIdx : 0;
      let next = cur + dir;
      if (next >= list.length) {
        if (!loopRef.current) {
          setAutoHalted(true);
          return;
        }
        next = 0;
      }
      if (next < 0) {
        if (!loopRef.current) return;
        next = list.length - 1;
      }
      if (next === cur) {
        // Single-item queue with loop on: replay a video instead of stalling.
        const v = activeVideoRef.current;
        if (list.length === 1 && loopRef.current && v && list[cur].media.type === 'video') {
          v.currentTime = 0;
          v.play().catch(() => {});
          setElapsedSec(0);
        }
        return;
      }
      setAutoHalted(false);
      showItem(list[next]);
    },
    [showItem],
  );

  const jumpToEntry = useCallback(
    (entryId: string) => {
      if (entryId === currentIdRef.current) return;
      const item = itemsRef.current.find((i) => i.entry.id === entryId);
      if (!item) return;
      setAutoHalted(false);
      showItem(item);
    },
    [showItem],
  );

  // First item in / current removed / queue emptied.
  useEffect(() => {
    if (loading) return;
    if (items.length === 0) {
      if (currentIdRef.current) {
        setCurrentId(null);
        setLayers(EMPTY_LAYERS);
        setAutoHalted(false);
      }
      return;
    }
    if (!items.some((i) => i.entry.id === currentIdRef.current)) {
      showItem(items[0]);
    }
  }, [items, loading, showItem]);

  /* ------------------------------ auto-advance timers ---------------------------- */

  // AUTO mode: images hold for their configured duration, then advance.
  useEffect(() => {
    if (mode !== 'auto' || autoHalted) return;
    const item = itemsRef.current.find((i) => i.entry.id === currentId);
    if (!item || item.media.type !== 'image') return;
    const t = window.setTimeout(() => navigateBy(1), imageDurationSec(item) * 1000);
    return () => window.clearTimeout(t);
  }, [mode, autoHalted, currentId, navigateBy]);

  // Elapsed show timer (auto running, or a video playing in manual).
  const isCurrentVideo = items.find((i) => i.entry.id === currentId)?.media.type === 'video';
  useEffect(() => {
    const running =
      (mode === 'auto' && !autoHalted && currentId !== null) ||
      (isCurrentVideo && !videoPaused);
    if (!running) return;
    const t = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [mode, autoHalted, currentId, isCurrentVideo, videoPaused]);

  /* --------------------------------- video control ------------------------------ */

  const registerVideo = useCallback((el: HTMLVideoElement | null, owner: number) => {
    if (el) {
      videoOwnerRef.current = owner;
      activeVideoRef.current = el;
    } else if (videoOwnerRef.current === owner) {
      videoOwnerRef.current = -1;
      activeVideoRef.current = null;
    }
  }, []);

  const getVideoInfo = useCallback(() => {
    const v = activeVideoRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) {
      return { progress: 0, remaining: Number.POSITIVE_INFINITY };
    }
    return { progress: v.currentTime / v.duration, remaining: v.duration - v.currentTime };
  }, []);

  const handleVideoEnded = useCallback(() => {
    if (modeRef.current === 'auto') navigateBy(1);
    else setVideoPaused(true);
  }, [navigateBy]);

  const toggleVideo = useCallback(() => {
    const v = activeVideoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  // A video failed to load/play. In AUTO the show must go on: skip it after a
  // short beat so a broken file never freezes auto-advance. In MANUAL just
  // surface the problem and stay put.
  const skipTimerRef = useRef<number | undefined>(undefined);
  const handleVideoError = useCallback(() => {
    const name = itemsRef.current.find(
      (i) => i.entry.id === currentIdRef.current,
    )?.media.name;
    if (modeRef.current !== 'auto') {
      toast(`Cannot play “${name ?? 'video'}”`, 'danger');
      setVideoPaused(true);
      return;
    }
    toast(`Skipping unplayable video${name ? ` “${name}”` : ''}`, 'danger');
    window.clearTimeout(skipTimerRef.current);
    skipTimerRef.current = window.setTimeout(() => navigateBy(1), 1200);
  }, [navigateBy, toast]);
  useEffect(() => () => window.clearTimeout(skipTimerRef.current), []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      const v = activeVideoRef.current;
      if (v) v.muted = next;
      return next;
    });
  }, []);

  const changeImageDuration = useCallback((delta: number) => {
    setImageDuration(setDefaultImageDuration(getDefaultImageDuration() + delta));
  }, []);

  /* ------------------------------- mode / presets -------------------------------- */

  const setModeWrapped = useCallback(
    (m: PlayerMode) => {
      setMode(m);
      if (m === 'auto') setAutoHalted(false);
    },
    [],
  );
  const toggleMode = useCallback(() => {
    setModeWrapped(modeRef.current === 'auto' ? 'manual' : 'auto');
  }, [setModeWrapped]);

  const cycleTransition = useCallback(() => {
    setTransitionMs((prev) => {
      const i = TRANSITION_PRESETS.indexOf(prev as (typeof TRANSITION_PRESETS)[number]);
      const next = TRANSITION_PRESETS[(i + 1) % TRANSITION_PRESETS.length];
      toast(`Transition set to ${next / 1000}s`);
      return next;
    });
  }, [toast]);

  /* ------------------------------ present (fullscreen) --------------------------- */

  const enterPresent = useCallback(() => {
    setPresent(true);
    stageRef.current?.requestFullscreen?.().catch(() => {
      /* fall back to fixed-overlay present mode */
    });
  }, []);

  const exitPresent = useCallback(() => {
    setPresent(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const togglePresent = useCallback(() => {
    if (present) exitPresent();
    else enterPresent();
  }, [present, enterPresent, exitPresent]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setPresent(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  /* ---------------------------------- keyboard ----------------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const cur = itemsRef.current.find((i) => i.entry.id === currentIdRef.current);
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (cur?.media.type === 'video') toggleVideo();
          else navigateBy(1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateBy(1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          navigateBy(-1);
          break;
        case 'f':
        case 'F':
          togglePresent();
          break;
        case 'a':
        case 'A':
          toggleMode();
          break;
        case 'l':
        case 'L':
          setLoop((l) => !l);
          break;
        case 'm':
        case 'M':
          if (cur?.media.type === 'video') toggleMute();
          break;
        case 'Escape':
          if (present && !document.fullscreenElement) exitPresent();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigateBy, toggleVideo, togglePresent, toggleMode, toggleMute, present, exitPresent]);

  /* --------------------------------- queue actions ------------------------------- */

  const handleLoadDemo = useCallback(async () => {
    await queue.loadDemo();
    setElapsedSec(0);
    toast('Demo show loaded', 'success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.loadDemo, toast]);

  const handleAdd = useCallback(
    async (mediaId: string) => {
      await queue.add(mediaId);
      toast('Added to queue', 'success');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue.add, toast],
  );

  const handleClear = useCallback(async () => {
    await queue.clear();
    toast('Queue cleared');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.clear, toast]);

  /* ---------------------------------- derived ----------------------------------- */

  const currentIndex = items.findIndex((i) => i.entry.id === currentId);
  const currentItem = currentIndex >= 0 ? items[currentIndex] : null;
  const isLast = currentIndex === items.length - 1;
  const nextItem =
    items.length > 1 && currentIndex >= 0
      ? loop
        ? items[(currentIndex + 1) % items.length]
        : (items[currentIndex + 1] ?? null)
      : null;
  const nextEntryId = nextItem?.entry.id ?? null;
  // Nowhere to go: empty queue, or parked on the last item with loop off.
  const canAdvance = items.length > 1 && !(isLast && !loop);

  const runtimeSec = items.reduce(
    (sum, i) =>
      sum +
      (i.media.type === 'video' ? (i.media.duration ?? 0) : imageDurationSec(i)),
    0,
  );

  const autoRunning = mode === 'auto' && !autoHalted && currentItem !== null;

  /* Preload the NEXT item so crossfades never flash black. */
  const nextItemId = nextItem?.entry.id ?? null;
  useEffect(() => {
    if (!nextItem) return;
    if (nextItem.media.type === 'image') {
      const img = new Image();
      img.decoding = 'async';
      img.src = nextItem.url;
      return () => {
        img.src = '';
      };
    }
    const v = document.createElement('video');
    v.preload = 'auto';
    v.muted = true;
    v.src = nextItem.url;
    v.load();
    return () => {
      v.removeAttribute('src');
      v.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextItemId]);

  /* ------------------------------------ render ----------------------------------- */

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* Player control strip (top-bar config per player.md §Zone 1) */}
      <div className="relative flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <span className="font-display text-xs font-medium uppercase tracking-[0.35em] text-gold">
          Show control
        </span>

        {/* Center: current media name + index */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <AnimatePresence mode="wait">
            <motion.span
              key={currentItem ? currentItem.entry.id : 'empty'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="font-mono text-xs uppercase tracking-wider text-ink-dim"
            >
              {currentItem
                ? `${currentItem.media.name} · ${pad(currentIndex + 1)} / ${pad(items.length)}`
                : 'No media loaded'}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Right: mode badge + fullscreen toggle + Present CTA */}
        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait">
            <motion.span
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className={cn(
                'rounded-full border px-3 py-1 font-display text-[10px] font-bold uppercase tracking-widest',
                mode === 'auto'
                  ? 'border-gold/40 bg-gold/15 text-gold'
                  : 'border-violet-hi/50 bg-brand/40 text-violet-hi',
              )}
            >
              {mode}
            </motion.span>
          </AnimatePresence>
          <button
            type="button"
            onClick={togglePresent}
            title="Fullscreen (F)"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-dim transition-all duration-200 ease-orbital hover:border-violet-hi hover:text-ink"
          >
            <Maximize className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <GoldButton size="md" onClick={enterPresent} className="px-5 py-1.5 text-xs">
            <Maximize className="h-3.5 w-3.5" strokeWidth={2} />
            Present
          </GoldButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Stage column */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex min-w-0 flex-1 flex-col"
        >
          <Stage
            stageRef={stageRef}
            layers={layers}
            activeLayer={activeLayer}
            transitionMs={transitionMs}
            mode={mode}
            count={items.length}
            currentIndex={currentIndex}
            currentItem={currentItem}
            nextItem={nextItem}
            autoHalted={autoHalted}
            present={present}
            muted={muted}
            getVideoInfo={getVideoInfo}
            registerVideo={registerVideo}
            onVideoEnded={handleVideoEnded}
            onVideoPlayState={setVideoPaused}
            onVideoError={handleVideoError}
            onCycleTransition={cycleTransition}
            onAdvance={() => navigateBy(1)}
            onPrev={() => navigateBy(-1)}
            onSetMode={setModeWrapped}
            onExitPresent={exitPresent}
            onReplay={() => {
              const first = itemsRef.current[0];
              if (!first) return;
              setAutoHalted(false);
              setElapsedSec(0);
              showItem(first);
            }}
            onLoadDemo={handleLoadDemo}
            onOpenLibrary={() => navigate('/library')}
          />
          <TransportBar
            mode={mode}
            onSetMode={setModeWrapped}
            onPrev={() => navigateBy(-1)}
            onNext={() => navigateBy(1)}
            canAdvance={canAdvance}
            isVideo={currentItem?.media.type === 'video'}
            videoPaused={videoPaused}
            onToggleVideo={toggleVideo}
            muted={muted}
            onToggleMute={toggleMute}
            imageDurationSec={imageDuration}
            onImageDurationChange={changeImageDuration}
            loop={loop}
            onToggleLoop={() => setLoop((l) => !l)}
            runtimeSec={runtimeSec}
            elapsedSec={elapsedSec}
            autoRunning={autoRunning}
          />
        </motion.div>

        {/* Queue rail */}
        <PlaylistRail
          items={items}
          loading={loading}
          currentEntryId={currentId}
          nextEntryId={nextEntryId}
          onSelect={jumpToEntry}
          onRemove={(id) => void queue.remove(id)}
          onReorder={(ids) => void queue.reorder(ids)}
          onSetDuration={(id, sec) => void queue.setDuration(id, sec)}
          onClear={() => void handleClear()}
          onOpenLibraryDrawer={() => setDrawerOpen(true)}
        />
      </div>

      <LibraryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAdd={(id) => void handleAdd(id)}
      />
    </div>
  );
}
