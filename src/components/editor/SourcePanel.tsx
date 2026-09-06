import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ImagePlus, Play, Pause } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GhostButton } from '@/components/primitives';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/lib/types';
import { resolveThumbnailUrl, revokeMediaUrl } from '@/lib/db';

/* --------------------------------- helpers --------------------------------- */

function Thumb({
  item,
  selected,
  onSelect,
  index,
}: {
  item: MediaItem;
  selected: boolean;
  onSelect: (item: MediaItem) => void;
  index: number;
}) {
  const [url, setUrl] = useState<string | null>(item.path ?? null);

  useEffect(() => {
    let alive = true;
    let created: string | null = null;
    if (!item.path) {
      resolveThumbnailUrl(item)
        .then((u) => {
          if (alive) {
            created = u;
            setUrl(u);
          } else {
            revokeMediaUrl(u);
          }
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
      if (created) revokeMediaUrl(created);
    };
  }, [item]);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => onSelect(item)}
      title={item.name}
      className={cn(
        'group relative aspect-square overflow-hidden rounded-lg border border-line bg-void',
        'transition-transform duration-200 ease-orbital hover:scale-105',
        selected && 'ring-2 ring-gold scale-105',
      )}
    >
      {url ? (
        <img src={url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="h-full w-full animate-shimmer shimmer" />
      )}
      {item.type === 'video' && (
        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-void/80">
          <Play className="h-2.5 w-2.5 text-gold" fill="currentColor" />
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-void/90 to-transparent px-1 pb-0.5 pt-3 text-left font-mono text-[8px] uppercase tracking-wider text-ink-dim opacity-0 transition-opacity group-hover:opacity-100">
        {item.name}
      </span>
    </motion.button>
  );
}

/* ------------------------------ video scrub bar ----------------------------- */

function VideoScrubBar({ video }: { video: HTMLVideoElement }) {
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const onTime = () => setTime(video.currentTime);
    const onMeta = () => setDuration(video.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    setDuration(video.duration || 0);
    setPlaying(!video.paused);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [video]);

  const scrubTo = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || !video.duration) return;
      const rect = track.getBoundingClientRect();
      const r = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      video.currentTime = r * video.duration;
      setTime(video.currentTime);
    },
    [video],
  );

  const pct = duration > 0 ? (time / duration) * 100 : 0;
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="rounded-xl border border-line bg-dusk/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-[10px] font-medium uppercase tracking-widest text-ink-dim">
          Source preview
        </span>
        <span className="font-mono text-[10px] text-gold tabular-nums">
          {fmt(time)} / {fmt(duration)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => (video.paused ? void video.play().catch(() => undefined) : video.pause())}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-gold transition-colors hover:border-violet-hi"
          aria-label={playing ? 'Pause preview' : 'Play preview'}
        >
          {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 translate-x-[1px]" />}
        </button>
        <div
          ref={trackRef}
          className="relative h-4 flex-1 cursor-pointer touch-none select-none"
          onPointerDown={(e) => {
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            scrubTo(e.clientX);
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) scrubTo(e.clientX);
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
        >
          <div className="absolute top-1/2 h-[3px] w-full -translate-y-1/2 rounded-full bg-line" />
          <div
            className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gold"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold shadow-glow-gold"
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- source panel ------------------------------ */

const QUICK_SAMPLES = [
  { path: '/media/earth.jpg', label: 'Earth' },
  { path: '/media/bg.jpg', label: 'Deep Space II' },
  { path: '/media/saturn.jpg', label: 'Saturn' },
];

export default function SourcePanel({
  media,
  selectedId,
  onSelectItem,
  onImportFiles,
  videoEl,
}: {
  media: MediaItem[];
  selectedId: string | null;
  onSelectItem: (item: MediaItem) => void;
  onImportFiles: (files: FileList | File[]) => void;
  videoEl: HTMLVideoElement | null;
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bySource = useCallback(
    (source: MediaItem['source']) => media.filter((m) => m.source === source),
    [media],
  );

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line p-4">
      <span className="kicker">Source</span>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) onImportFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex h-28 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-center transition-all duration-200',
          dragOver && 'border-gold shadow-glow-violet',
        )}
      >
        <ImagePlus className="h-5 w-5 text-ink-faint" />
        <p className="text-xs text-ink-dim">Drop image or video here</p>
        <p className="text-[10px] text-ink-faint">or</p>
        <GhostButton
          type="button"
          className="px-4 py-1 text-[10px]"
          onClick={() => fileInputRef.current?.click()}
        >
          Browse files
        </GhostButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onImportFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Library tabs */}
      <Tabs defaultValue="bundled" className="min-h-0">
        <TabsList className="grid w-full grid-cols-3 bg-dusk/60">
          <TabsTrigger
            value="vault"
            className="font-display text-[10px] uppercase tracking-widest data-[state=active]:bg-brand data-[state=active]:text-ink"
          >
            Vault
          </TabsTrigger>
          <TabsTrigger
            value="bundled"
            className="font-display text-[10px] uppercase tracking-widest data-[state=active]:bg-brand data-[state=active]:text-ink"
          >
            Bundled
          </TabsTrigger>
          <TabsTrigger
            value="render"
            className="font-display text-[10px] uppercase tracking-widest data-[state=active]:bg-brand data-[state=active]:text-ink"
          >
            Render
          </TabsTrigger>
        </TabsList>
        {(['imported', 'bundled', 'render'] as const).map((src) => (
          <TabsContent key={src} value={src === 'imported' ? 'vault' : src} className="mt-2">
            {bySource(src).length === 0 ? (
              <p className="rounded-lg border border-line bg-dusk/30 p-3 text-center text-[11px] text-ink-faint">
                {src === 'render'
                  ? 'No renders yet — export a frame to see it here.'
                  : src === 'imported'
                    ? 'Nothing imported yet — drop a file above.'
                    : 'Bundled samples unavailable.'}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {bySource(src).map((item, i) => (
                  <Thumb
                    key={item.id}
                    item={item}
                    index={i}
                    selected={item.id === selectedId}
                    onSelect={onSelectItem}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Video scrub bar when a video source is loaded */}
      {videoEl && <VideoScrubBar video={videoEl} />}

      {/* Quick samples */}
      <div>
        <span className="mb-2 block font-display text-[10px] font-medium uppercase tracking-widest text-ink-faint">
          Quick samples
        </span>
        <div className="flex gap-3">
          {QUICK_SAMPLES.map((s) => (
            <button
              key={s.path}
              type="button"
              title={s.label}
              onClick={() => {
                const item = media.find((m) => m.path === s.path);
                if (item) onSelectItem(item);
              }}
              className="group flex flex-col items-center gap-1"
            >
              <img
                src={s.path}
                alt={s.label}
                className="h-12 w-12 rounded-full border border-line object-cover transition-all duration-200 ease-orbital group-hover:scale-110 group-hover:border-gold"
              />
              <span className="font-mono text-[8px] uppercase tracking-wider text-ink-faint group-hover:text-ink-dim">
                {s.label.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
