import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { motion } from 'framer-motion';
import { Eye, Save, HelpCircle } from 'lucide-react';
import SourcePanel from '@/components/editor/SourcePanel';
import FisheyeStage from '@/components/editor/FisheyeStage';
import type { RecState } from '@/components/editor/FisheyeStage';
import ControlDeck from '@/components/editor/ControlDeck';
import type { ExportResolution, ExportFormat } from '@/components/editor/ControlDeck';
import { GhostButton, GoldButton, useToast } from '@/components/primitives';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ensureSeeded, getAllMedia, putMedia, resolveMediaUrl, revokeMediaUrl, addToPlaylist } from '@/lib/db';
import type { MediaItem, FisheyeParams } from '@/lib/types';
import {
  DEFAULT_PARAMS,
  FISHEYE_PRESETS,
  FisheyeRenderer,
  makeThumbnailBlob,
  paramsEqual,
  pickRecorderMimeType,
  renderFrameBlob,
  tweenParams,
} from '@/lib/fisheye';
import type { RenderState } from '@/lib/fisheye';
import { cn } from '@/lib/utils';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const RES_CYCLE: ExportResolution[] = [1024, 1536, 2048];

const LS_PARAMS = 'domemaster:editorParams';
const LS_LAST_SOURCE = 'domemaster:lastSource';

/** Restore persisted editor params, falling back to defaults. */
function loadStoredParams(): FisheyeParams {
  try {
    const raw = localStorage.getItem(LS_PARAMS);
    if (raw) return { ...DEFAULT_PARAMS, ...(JSON.parse(raw) as Partial<FisheyeParams>) };
  } catch {
    /* storage unavailable or corrupt */
  }
  return { ...DEFAULT_PARAMS };
}

/** Display filename for the source chip (bundled path, File name, or title). */
function sourceFileName(item: MediaItem): string {
  const fromPath = item.path?.split('/').pop();
  if (fromPath) return fromPath;
  if (item.blob instanceof File && item.blob.name) return item.blob.name;
  return item.name;
}

interface SourceInfo {
  item: MediaItem | null;
  name: string;
  /** Filename with extension, e.g. `earth.jpg` — shown on the stage chip. */
  fileName: string;
  type: 'image' | 'video';
  width: number;
  height: number;
  /** True when the loaded item carried fisheyeParams we restored. */
  restored: boolean;
}

export default function Editor() {
  const { toast } = useToast();

  /* ------------------------------ core state ------------------------------ */
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [params, setParams] = useState<FisheyeParams>(loadStoredParams);
  const [horizonMask, setHorizonMask] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [resolution, setResolution] = useState<ExportResolution>(1024);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [activePresetId, setActivePresetId] = useState<string | null>(() =>
    paramsEqual(loadStoredParams(), DEFAULT_PARAMS) ? 'dome180' : null,
  );
  const [source, setSource] = useState<SourceInfo | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [exporting, setExporting] = useState<'frame' | 'clip' | null>(null);
  const [rec, setRec] = useState<RecState | null>(null);

  /* -------------------------------- refs ---------------------------------- */
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<FisheyeRenderer | null>(null);
  const imageElRef = useRef<HTMLImageElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const tweenCancelRef = useRef<(() => void) | null>(null);
  const paramsRef = useRef(params);
  const horizonMaskRef = useRef(horizonMask);
  const comparingRef = useRef(comparing);
  const sourceRef = useRef<SourceInfo | null>(null);
  const mediaRef = useRef<MediaItem[]>(media);
  /** Sources that failed to decode this session — never auto-picked again. */
  const failedSourceIdsRef = useRef<Set<string>>(new Set());
  paramsRef.current = params;
  horizonMaskRef.current = horizonMask;
  comparingRef.current = comparing;
  sourceRef.current = source;
  mediaRef.current = media;

  const refreshMedia = useCallback(async () => {
    try {
      await ensureSeeded();
      setMedia(await getAllMedia());
    } catch {
      /* vault unavailable */
    }
  }, []);

  useEffect(() => {
    void refreshMedia();
  }, [refreshMedia]);

  /* Persist editor params so a reload restores the last framing. A render's
     own fisheyeParams still override these when such an item is loaded. */
  useEffect(() => {
    try {
      localStorage.setItem(LS_PARAMS, JSON.stringify(params));
    } catch {
      /* storage unavailable */
    }
  }, [params]);

  /* --------------------------- renderer + loop ---------------------------- */
  /**
   * Callback ref: (re)create the FisheyeRenderer whenever the canvas NODE
   * changes, disposing the previous context. React calls this with `null` on
   * detach and with the new node on attach, so the renderer can never end up
   * bound to a detached canvas (the "black stage" bug).
   */
  const setCanvasNode = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    rendererRef.current?.dispose();
    rendererRef.current = null;
    if (!node) return;
    try {
      const renderer = new FisheyeRenderer(node, () => setContextLost(true));
      rendererRef.current = renderer;
      setWebglError(null);
      // Fresh GL context lost its texture — re-upload the current source.
      const s = sourceRef.current;
      if (s) {
        const el = s.type === 'video' ? videoElRef.current : imageElRef.current;
        if (el) renderer.uploadSource(el, s.width, s.height);
      }
    } catch (err) {
      setWebglError(err instanceof Error ? err.message : 'context creation failed');
    }
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const r = rendererRef.current;
      if (r) {
        const video = videoElRef.current;
        if (video && video.readyState >= 2) r.updateLiveFrame(video);
        const p = paramsRef.current;
        r.render({
          ...p,
          compare: comparingRef.current,
          horizonMask: horizonMaskRef.current,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ------------------------------ source load ----------------------------- */
  const loadSource = useCallback(
    (item: MediaItem) => {
      void (async () => {
        let url: string;
        try {
          url = await resolveMediaUrl(item);
        } catch {
          toast(`Could not load "${item.name}"`, 'danger');
          return;
        }
        if (sourceUrlRef.current) revokeMediaUrl(sourceUrlRef.current);
        sourceUrlRef.current = url;
        try {
          localStorage.setItem(LS_LAST_SOURCE, item.id);
        } catch {
          /* storage unavailable */
        }

        // tear down previous media element
        videoElRef.current?.pause();
        videoElRef.current = null;
        setVideoEl(null);
        imageElRef.current = null;

        const fileName = sourceFileName(item);

        /** A newer load superseded this one while decoding — drop quietly. */
        const isStale = () => sourceUrlRef.current !== url;

        /** Decode failed — clear the stage, then fall back to another source. */
        const failDecode = () => {
          if (!isStale()) {
            sourceUrlRef.current = null;
            videoElRef.current = null;
            imageElRef.current = null;
            setVideoEl(null);
            rendererRef.current?.clearTexture();
            setSource(null);
            // Never auto-pick this source again this session; if it was the
            // persisted "last source", drop that pointer too.
            failedSourceIdsRef.current.add(item.id);
            try {
              if (localStorage.getItem(LS_LAST_SOURCE) === item.id) {
                localStorage.removeItem(LS_LAST_SOURCE);
              }
            } catch {
              /* storage unavailable */
            }
            // Fall back to the first decodable candidate so the stage is
            // not left empty.
            const fallback = mediaRef.current.find(
              (m) => m.id !== item.id && !failedSourceIdsRef.current.has(m.id),
            );
            if (fallback) loadSourceRef.current(fallback);
          }
          revokeMediaUrl(url);
          toast(`Could not decode ${item.type} "${item.name}"`, 'danger');
        };

        if (item.type === 'video') {
          const video = document.createElement('video');
          video.src = url;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.preload = 'auto';
          video.addEventListener(
            'loadeddata',
            () => {
              if (isStale()) return;
              rendererRef.current?.uploadSource(video, video.videoWidth, video.videoHeight);
              videoElRef.current = video;
              setVideoEl(video);
              setSource({
                item,
                name: item.name,
                fileName,
                type: 'video',
                width: video.videoWidth,
                height: video.videoHeight,
                restored: !!item.fisheyeParams,
              });
              if ((item.blob?.size ?? 0) > 100 * 1024 * 1024) {
                toast('Large source — export may take a while');
              }
            },
            { once: true },
          );
          video.addEventListener('error', failDecode, { once: true });
          video.load();
        } else {
          const img = new Image();
          img.onload = () => {
            if (isStale()) return;
            rendererRef.current?.uploadSource(img, img.naturalWidth, img.naturalHeight);
            imageElRef.current = img;
            setSource({
              item,
              name: item.name,
              fileName,
              type: 'image',
              width: img.naturalWidth,
              height: img.naturalHeight,
              restored: !!item.fisheyeParams,
            });
          };
          img.onerror = failDecode;
          img.src = url;
        }

        // Restore saved fisheye params on renders so they can be re-edited.
        if (item.fisheyeParams) {
          tweenCancelRef.current?.();
          const target = { ...DEFAULT_PARAMS, ...item.fisheyeParams };
          tweenCancelRef.current = tweenParams(paramsRef.current, target, 500, setParams);
          setActivePresetId(null);
        }
      })();
    },
    [toast],
  );

  // Self-reference so decode-failure fallback can trigger a follow-up load.
  const loadSourceRef = useRef<(item: MediaItem) => void>(() => {});
  loadSourceRef.current = loadSource;

  const loadQuickSample = useCallback(
    (path: string) => {
      const item = media.find((m) => m.path === path);
      if (item) loadSource(item);
    },
    [media, loadSource],
  );

  /* ------------------ open-in-editor bridge (from Library) ----------------- */
  const location = useLocation();
  const pendingMediaIdRef = useRef<string | null>(
    (location.state as { mediaId?: string } | null)?.mediaId ?? null,
  );
  const autoLoadTriedRef = useRef(false);
  useEffect(() => {
    if (media.length === 0 || sourceRef.current || autoLoadTriedRef.current) return;
    autoLoadTriedRef.current = true;
    // 1) explicit "open in editor" target
    const pendingId = pendingMediaIdRef.current;
    pendingMediaIdRef.current = null;
    let item = pendingId ? media.find((m) => m.id === pendingId) : undefined;
    // 2) last-used source from a previous session
    if (!item) {
      try {
        const lastId = localStorage.getItem(LS_LAST_SOURCE);
        if (lastId) item = media.find((m) => m.id === lastId);
      } catch {
        /* storage unavailable */
      }
    }
    // 3) first available item — the stage should never open empty
    item ??= media[0];
    if (item) loadSource(item);
  }, [media, loadSource]);

  /* -------------------------------- import -------------------------------- */
  const importFiles = useCallback(
    (files: FileList | File[]) => {
      void (async () => {
        for (const file of Array.from(files)) {
          const isVideo = file.type.startsWith('video/');
          const isImage = file.type.startsWith('image/');
          if (!isVideo && !isImage) continue;
          const url = URL.createObjectURL(file);
          try {
            let width = 0;
            let height = 0;
            let duration: number | undefined;
            let thumbSource: HTMLImageElement | HTMLVideoElement;
            if (isVideo) {
              const video = document.createElement('video');
              video.muted = true;
              video.preload = 'auto';
              video.src = url;
              await new Promise<void>((resolve, reject) => {
                video.addEventListener('loadeddata', () => resolve(), { once: true });
                video.addEventListener('error', () => reject(new Error('decode failed')), { once: true });
              });
              video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
              await new Promise<void>((resolve) =>
                video.addEventListener('seeked', () => resolve(), { once: true }),
              );
              width = video.videoWidth;
              height = video.videoHeight;
              duration = video.duration;
              thumbSource = video;
            } else {
              const img = new Image();
              await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('decode failed'));
                img.src = url;
              });
              width = img.naturalWidth;
              height = img.naturalHeight;
              thumbSource = img;
            }
            const now = Date.now();
            const thumbnailBlob = await makeThumbnailBlob(thumbSource, width, height);
            const item: MediaItem = {
              id: crypto.randomUUID(),
              name: file.name.replace(/\.[^.]+$/, ''),
              type: isVideo ? 'video' : 'image',
              source: 'imported',
              blob: file,
              ...(thumbnailBlob ? { thumbnailBlob } : {}),
              ...(duration !== undefined ? { duration } : {}),
              width,
              height,
              tags: ['imported'],
              createdAt: now,
              updatedAt: now,
            };
            await putMedia(item);
            toast(`Imported "${item.name}"`, 'success');
            await refreshMedia();
            loadSource(item);
          } catch {
            toast(`Could not import "${file.name}"`, 'danger');
          } finally {
            URL.revokeObjectURL(url);
          }
        }
      })();
    },
    [toast, refreshMedia, loadSource],
  );

  /* ------------------------------ param edits ----------------------------- */
  const applyParams = useCallback((p: FisheyeParams) => {
    tweenCancelRef.current?.();
    tweenCancelRef.current = null;
    setParams(p);
    setActivePresetId(null);
  }, []);

  const handleDragDelta = useCallback(
    (dx: number, dy: number, shift: boolean) => {
      const p = paramsRef.current;
      if (shift) {
        applyParams({
          ...p,
          offsetX: clamp(p.offsetX + dx * 0.003, -1, 1),
          offsetY: clamp(p.offsetY + dy * 0.003, -1, 1),
        });
      } else {
        applyParams({
          ...p,
          azimuth: (((p.azimuth + dx * 0.25) % 360) + 360) % 360,
          tilt: clamp(p.tilt - dy * 0.25, -90, 90),
        });
      }
    },
    [applyParams],
  );

  const resetParams = useCallback(() => {
    tweenCancelRef.current?.();
    tweenCancelRef.current = tweenParams(paramsRef.current, { ...DEFAULT_PARAMS }, 400, setParams);
    setActivePresetId('dome180');
  }, []);

  const applyPreset = useCallback((id: string) => {
    const preset = FISHEYE_PRESETS.find((pr) => pr.id === id);
    if (!preset) return;
    tweenCancelRef.current?.();
    const target = { ...DEFAULT_PARAMS, ...preset.params, wireframe: paramsRef.current.wireframe };
    tweenCancelRef.current = tweenParams(paramsRef.current, target, 500, setParams);
    setActivePresetId(id);
  }, []);

  useEffect(() => () => tweenCancelRef.current?.(), []);

  /* ------------------------------- exporting ------------------------------ */
  const currentRenderState = useCallback((): RenderState => {
    return { ...paramsRef.current, compare: false, horizonMask: horizonMaskRef.current };
  }, []);

  const getSourceElement = useCallback((): {
    el: HTMLImageElement | HTMLVideoElement;
    w: number;
    h: number;
  } | null => {
    const s = sourceRef.current;
    if (!s) return null;
    const el = s.type === 'video' ? videoElRef.current : imageElRef.current;
    if (!el) return null;
    return { el, w: s.width, h: s.height };
  }, []);

  const saveRenderToVault = useCallback(
    async (blob: Blob, type: 'image' | 'video', name: string, duration?: number): Promise<MediaItem> => {
      const thumbImg = await new Promise<HTMLImageElement | null>((resolve) => {
        if (type === 'video') return resolve(null);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(blob);
      });
      let thumbnailBlob: Blob | undefined;
      if (thumbImg) {
        thumbnailBlob = await makeThumbnailBlob(thumbImg, thumbImg.naturalWidth, thumbImg.naturalHeight);
        URL.revokeObjectURL(thumbImg.src);
      }
      const now = Date.now();
      const item: MediaItem = {
        id: crypto.randomUUID(),
        name,
        type,
        source: 'render',
        blob,
        ...(thumbnailBlob ? { thumbnailBlob } : {}),
        ...(duration !== undefined ? { duration } : {}),
        width: resolution,
        height: resolution,
        tags: ['fisheye', 'render'],
        fisheyeParams: { ...paramsRef.current },
        createdAt: now,
        updatedAt: now,
      };
      await putMedia(item);
      await refreshMedia();
      return item;
    },
    [refreshMedia, resolution],
  );

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, []);

  const exportFrame = useCallback(() => {
    void (async () => {
      const src = getSourceElement();
      if (!src || exporting) return;
      setExporting('frame');
      try {
        const blob = await renderFrameBlob(src.el, src.w, src.h, resolution, currentRenderState(), format);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const ext = format === 'jpeg' ? 'jpg' : 'png';
        const base = `${sourceRef.current?.name ?? 'dome'}-fisheye-${resolution}`;
        await saveRenderToVault(blob, 'image', `${base}`);
        downloadBlob(blob, `${base}-${stamp}.${ext}`);
        toast('Frame saved to Vault', 'success');
      } catch {
        toast('Frame export failed', 'danger');
      } finally {
        setExporting(null);
      }
    })();
  }, [exporting, getSourceElement, resolution, format, currentRenderState, saveRenderToVault, downloadBlob, toast]);

  /* ------------------------------ clip export ----------------------------- */
  const exportClip = useCallback(() => {
    void (async () => {
      const video = videoElRef.current;
      const src = sourceRef.current;
      if (!video || !src || src.type !== 'video' || exporting) return;
      const mime = pickRecorderMimeType();
      if (!mime) {
        toast('MediaRecorder/WebM not supported in this browser', 'danger');
        return;
      }
      setExporting('clip');
      const canvas = document.createElement('canvas');
      canvas.width = resolution;
      canvas.height = resolution;
      let exportRenderer: FisheyeRenderer | null = null;
      let recorder: MediaRecorder | null = null;
      let raf = 0;
      try {
        exportRenderer = new FisheyeRenderer(canvas);
        exportRenderer.uploadSource(video, src.width, src.height);

        const stream = canvas.captureStream(30);
        recorder = new MediaRecorder(stream, {
          mimeType: mime,
          videoBitsPerSecond: 8_000_000,
        });
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        const stopped = new Promise<void>((resolve) => {
          recorder!.onstop = () => resolve();
        });

        video.currentTime = 0;
        await video.play();
        const startedAt = performance.now();
        recorder.start(250);

        await new Promise<void>((resolve) => {
          const tick = () => {
            if (video.readyState >= 2) exportRenderer!.updateLiveFrame(video);
            exportRenderer!.render(currentRenderState());
            const dur = video.duration || src.item?.duration || 0;
            const progress = dur > 0 ? clamp(video.currentTime / dur, 0, 1) : 0;
            setRec({ elapsed: (performance.now() - startedAt) / 1000, progress });
            if (video.ended || (dur > 0 && video.currentTime >= dur - 0.05)) {
              resolve();
              return;
            }
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        });

        cancelAnimationFrame(raf);
        video.pause();
        recorder.stop();
        await stopped;

        const blob = new Blob(chunks, { type: 'video/webm' });
        const dur = video.duration || 0;
        const base = `${src.name}-fisheye-clip-${resolution}`;
        // thumbnail from the current warped export frame
        const thumb = await makeThumbnailBlob(canvas, resolution, resolution);
        const now = Date.now();
        const item: MediaItem = {
          id: crypto.randomUUID(),
          name: base,
          type: 'video',
          source: 'render',
          blob,
          ...(thumb ? { thumbnailBlob: thumb } : {}),
          duration: dur,
          width: resolution,
          height: resolution,
          tags: ['fisheye', 'render'],
          fisheyeParams: { ...paramsRef.current },
          createdAt: now,
          updatedAt: now,
        };
        await putMedia(item);
        await refreshMedia();
        downloadBlob(blob, `${base}.webm`);
        toast('Clip saved to Vault', 'success');
      } catch {
        toast('Clip export failed', 'danger');
      } finally {
        cancelAnimationFrame(raf);
        try {
          if (recorder && recorder.state !== 'inactive') recorder.stop();
        } catch {
          /* already stopped */
        }
        exportRenderer?.dispose();
        video.pause();
        setRec(null);
        setExporting(null);
      }
    })();
  }, [exporting, resolution, currentRenderState, refreshMedia, downloadBlob, toast]);

  /* --------------------------- save still to vault ------------------------ */
  const dirty = source !== null && !paramsEqual(params, DEFAULT_PARAMS);
  const saveStill = useCallback(() => {
    void (async () => {
      const src = getSourceElement();
      if (!src) return;
      try {
        const blob = await renderFrameBlob(src.el, src.w, src.h, resolution, currentRenderState(), format);
        const base = `${sourceRef.current?.name ?? 'dome'}-fisheye-${resolution}`;
        await saveRenderToVault(blob, 'image', base);
        toast('Render saved to Vault', 'success');
      } catch {
        toast('Save failed', 'danger');
      }
    })();
  }, [getSourceElement, resolution, format, currentRenderState, saveRenderToVault, toast]);

  const sendToPlaylist = useCallback(() => {
    void (async () => {
      const s = sourceRef.current;
      if (!s?.item) {
        toast('Load a vault source first to queue it', 'danger');
        return;
      }
      try {
        await addToPlaylist(s.item.id);
        toast(`"${s.name}" added to Player queue`, 'success');
      } catch {
        toast('Could not update playlist', 'danger');
      }
    })();
  }, [toast]);

  /* ------------------------------ keyboard -------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      switch (e.key.toLowerCase()) {
        case 'r':
          resetParams();
          break;
        case 'w':
          setParams((p) => ({ ...p, wireframe: !p.wireframe }));
          break;
        case 'e':
          exportFrame();
          break;
        case '1':
          setResolution(1024);
          break;
        case '2':
          setResolution(1536);
          break;
        case '3':
          setResolution(2048);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resetParams, exportFrame]);

  /* -------------------------------- render -------------------------------- */
  const sourceChip = source
    ? `${source.fileName.toUpperCase()} · ${source.width}×${source.height} · ${source.type === 'video' ? 'VID' : 'IMG'}`
    : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Zone 1 — editor sub-toolbar */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-line bg-nebula/40 px-4">
        <span className="hidden font-mono text-[10px] uppercase tracking-widest text-ink-faint md:block">
          Dome-master · equidistant
        </span>
        <div className="min-w-0 flex-1 text-center">
          <motion.span
            key={source ? `${source.name}-${source.width}x${source.height}` : 'none'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="truncate font-mono text-xs uppercase tracking-wider text-ink-dim"
          >
            {source
              ? `${source.name} · ${source.width}×${source.height}${source.restored ? ' · params restored' : ''}`
              : 'No source loaded'}
          </motion.span>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                title="What is fisheye?"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-faint transition-colors hover:border-violet-hi hover:text-ink"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="border-line bg-nebula text-ink sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display text-sm font-bold uppercase tracking-widest text-gold">
                  What is fisheye / dome-master?
                </DialogTitle>
              </DialogHeader>
              <img
                src="/spec-dome-diagram.svg"
                alt="Dome projection diagram"
                className="w-full rounded-xl border border-line bg-void"
              />
              <p className="text-sm leading-relaxed text-ink-dim">
                A dome master is a square frame where the center is the dome's
                zenith and the rim is the horizon. The equidistant fisheye
                projection maps every pixel's radius to a viewing angle — FOV
                180° fills the hemisphere, 220° overscans past the horizon for
                tilted domes. Drag the canvas to aim; export frames or clips
                straight into your vault.
              </p>
            </DialogContent>
          </Dialog>
          <GhostButton
            type="button"
            className={cn('px-4 py-1.5 text-[10px]', comparing && 'border-gold text-gold')}
            title="Hold to see original"
            onPointerDown={() => setComparing(true)}
            onPointerUp={() => setComparing(false)}
            onPointerLeave={() => setComparing(false)}
            disabled={!source}
          >
            <Eye className="h-3.5 w-3.5" /> Compare
          </GhostButton>
          <GoldButton
            type="button"
            className={cn('px-4 py-1.5 text-[10px]', dirty && 'animate-pulse-gold')}
            disabled={!dirty || exporting !== null}
            onClick={saveStill}
          >
            <Save className="h-3.5 w-3.5" /> Save render to Vault
          </GoldButton>
        </div>
      </div>

      {contextLost && (
        <div className="border-b border-line bg-danger/10 px-4 py-1.5 text-center font-mono text-[10px] uppercase tracking-widest text-danger">
          WebGL context lost — reload the page to restore the preview
        </div>
      )}

      {/* Three-column workbench */}
      <div className="flex min-h-0 flex-1">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex shrink-0"
        >
          <SourcePanel
            media={media}
            selectedId={source?.item?.id ?? null}
            onSelectItem={loadSource}
            onImportFiles={importFiles}
            videoEl={videoEl}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex min-w-0 flex-1"
        >
          <FisheyeStage
            canvasRef={setCanvasNode}
            params={params}
            onDragDelta={handleDragDelta}
            sourceKey={source?.item?.id ?? 'empty'}
            sourceChip={sourceChip}
            hasSource={source !== null}
            resolution={resolution}
            onCycleResolution={() =>
              setResolution((r) => RES_CYCLE[(RES_CYCLE.indexOf(r) + 1) % RES_CYCLE.length])
            }
            rec={rec}
            webglError={webglError}
            onQuickSample={loadQuickSample}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="flex shrink-0"
        >
          <ControlDeck
            params={params}
            onParams={applyParams}
            onReset={resetParams}
            horizonMask={horizonMask}
            onHorizonMask={setHorizonMask}
            activePresetId={activePresetId}
            onPreset={applyPreset}
            resolution={resolution}
            onResolution={setResolution}
            format={format}
            onFormat={setFormat}
            hasSource={source !== null}
            isVideo={source?.type === 'video'}
            exporting={exporting}
            clipProgress={rec?.progress ?? 0}
            onExportFrame={exportFrame}
            onExportClip={exportClip}
            onSendToPlaylist={sendToPlaylist}
          />
        </motion.div>
      </div>
    </div>
  );
}
