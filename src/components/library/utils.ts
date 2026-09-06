import type { MediaItem } from '@/lib/types';

/* --------------------------------- formatting -------------------------------- */

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function itemSize(item: MediaItem): number {
  return (item.blob?.size ?? 0) + (item.thumbnailBlob?.size ?? 0);
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------ import pipeline ------------------------------ */

const THUMB_MAX = 640;

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | undefined> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b ?? undefined), 'image/jpeg', 0.82);
  });
}

function scaledSize(w: number, h: number, max: number): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

async function probeImage(
  file: File,
): Promise<Pick<MediaItem, 'width' | 'height' | 'thumbnailBlob'>> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const { w, h } = scaledSize(img.naturalWidth, img.naturalHeight, THUMB_MAX);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { width: img.naturalWidth, height: img.naturalHeight };
    ctx.drawImage(img, 0, 0, w, h);
    const thumbnailBlob = await canvasToBlob(canvas);
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      ...(thumbnailBlob ? { thumbnailBlob } : {}),
    };
  } catch {
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function probeVideo(
  file: File,
): Promise<Pick<MediaItem, 'width' | 'height' | 'duration' | 'thumbnailBlob'>> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('video metadata timeout')), 8000);
      video.onloadedmetadata = () => {
        window.clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('video load failed'));
      };
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const width = video.videoWidth;
    const height = video.videoHeight;

    // Seek to ~1s (or mid-clip for short videos) and capture a poster frame.
    const target = duration > 2 ? 1 : Math.max(0, duration / 2);
    let thumbnailBlob: Blob | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('seek timeout')), 8000);
        video.onseeked = () => {
          window.clearTimeout(timer);
          resolve();
        };
        video.currentTime = target;
      });
      const { w, h } = scaledSize(width, height, THUMB_MAX);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        thumbnailBlob = await canvasToBlob(canvas);
      }
    } catch {
      /* poster capture failed — fall back to blob-as-thumbnail */
    }

    return {
      width,
      height,
      duration,
      ...(thumbnailBlob ? { thumbnailBlob } : {}),
    };
  } catch {
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Build an imported MediaItem (blob-backed) from a dropped/picked File. */
export async function buildImportedItem(file: File): Promise<MediaItem> {
  const isVideo = file.type.startsWith('video/');
  const now = Date.now();
  const meta = isVideo ? await probeVideo(file) : await probeImage(file);
  return {
    id: newId(),
    name: file.name.replace(/\.[^.]+$/, '') || 'Untitled media',
    type: isVideo ? 'video' : 'image',
    source: 'imported',
    blob: file,
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...meta,
  };
}

/* ------------------------------ count-up hook ------------------------------- */
// Kept here to avoid an extra file; used by the vault stats row.

import { useEffect, useRef, useState } from 'react';

/** Animate a number towards `target` over `duration` seconds (expo-out). */
export function useCountUp(target: number, duration = 0.8): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(from + (target - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
