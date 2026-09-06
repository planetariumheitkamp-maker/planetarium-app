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
  /** Register/unregister this layer's video element as the active one (owner = slot key). */
  registerVideo: (el: HTMLVideoElement | null, owner: number) => void;
  onVideoEnded: () => void;
  onVideoPlayState: (paused: boolean) => void;
}

/**
 * A/B crossfade layer (player.md §Zone 2): incoming scales 1.04→1 + fades in,
 * outgoing fades out + scales 1→0.98 — GPU transforms only, expo-out easing.
 */
function MediaLayerInner({
  slot,
  active,
  transitionMs,
  registerVideo,
  onVideoEnded,
  onVideoPlayState,
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
      v.play().catch(() => {
        /* autoplay may be blocked before a user gesture */
      });
    } else {
      v.pause();
      registerVideo(null, owner);
    }
  }, [active, owner, registerVideo]);

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
          preload="auto"
          onEnded={() => {
            if (activeRef.current) onVideoEnded();
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
