import { memo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { QueueItem } from './useQueue';

/** One slot of the A/B crossfade stage. */
export interface LayerSlot {
  item: QueueItem | null;
  key: number;
}

interface MediaLayerProps {
  slot: LayerSlot;
  active: boolean;
  transitionMs: number;
  /** Videos start muted (autoplay-safe); the transport bar toggles this. */
  muted: boolean;
  /** Register/unregister this layer's video element as the active one (owner = slot key). */
  registerVideo: (el: HTMLVideoElement | null, owner: number) => void;
  onVideoEnded: () => void;
  onVideoPlayState: (paused: boolean) => void;
  /** The active video failed to load/play — Player decides how to recover. */
  onVideoError: () => void;
}

/**
 * A/B crossfade layer (player.md §Zone 2): incoming scales 1.04→1 + fades in,
 * outgoing fades out + scales 1→0.98 — GPU transforms only, expo-out easing.
 */
function MediaLayerInner({
  slot,
  active,
  transitionMs,
  muted,
  registerVideo,
  onVideoEnded,
  onVideoPlayState,
  onVideoError,
}: MediaLayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeRef = useRef(active);
  const owner = slot.key;

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      registerVideo(v, owner);
      v.play().catch((err: unknown) => {
        // AbortError = our own pause()/src swap interrupted play — not a failure.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (activeRef.current) onVideoError();
      });
    } else {
      v.pause();
      registerVideo(null, owner);
    }
  }, [active, owner, registerVideo, onVideoError]);

  // Live mute/unmute on the active element (prop alone only sets initial state).
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Unregister on unmount (only if we still own the active slot).
  useEffect(() => {
    return () => {
      registerVideo(null, owner);
    };
  }, [owner, registerVideo]);

  if (!slot.item) return null;
  const { media, url } = slot.item;

  return (
    <motion.div
      key={slot.key}
      initial={{ opacity: 0, scale: 1.04 }}
      animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}
      transition={{
        duration: transitionMs / 1000,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      }}
      className="absolute inset-0 flex items-center justify-center"
      style={{ pointerEvents: active ? 'auto' : 'none', zIndex: active ? 2 : 1 }}
    >
      {media.type === 'video' ? (
        <video
          ref={videoRef}
          src={url}
          className="max-h-full max-w-full object-contain"
          playsInline
          muted={muted}
          preload="auto"
          onEnded={() => {
            if (activeRef.current) onVideoEnded();
          }}
          onError={() => {
            if (activeRef.current) onVideoError();
          }}
          onPlay={() => {
            if (activeRef.current) onVideoPlayState(false);
          }}
          onPause={() => {
            if (activeRef.current) onVideoPlayState(true);
          }}
        />
      ) : (
        <img
          src={url}
          alt={media.name}
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
        />
      )}
    </motion.div>
  );
}

const MediaLayer = memo(MediaLayerInner);
export default MediaLayer;
