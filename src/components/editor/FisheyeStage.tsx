import { useRef, useState } from 'react';
import type { RefObject } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router';
import DomeWireframe from '@/components/editor/DomeWireframe';
import { cn } from '@/lib/utils';
import type { FisheyeParams } from '@/lib/types';
import { formatHudReadout } from '@/lib/fisheye';

export interface RecState {
  elapsed: number;
  progress: number;
}

const fmtElapsed = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

export default function FisheyeStage({
  canvasRef,
  params,
  onDragDelta,
  sourceKey,
  hasSource,
  resolution,
  onCycleResolution,
  rec,
  webglError,
  onQuickSample,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  params: FisheyeParams;
  /** (dx, dy, shift) — drag adjusts azimuth/tilt; shift-drag adjusts offset */
  onDragDelta: (dx: number, dy: number, shift: boolean) => void;
  sourceKey: string;
  hasSource: boolean;
  resolution: number;
  onCycleResolution: () => void;
  rec: RecState | null;
  webglError: string | null;
  onQuickSample: (path: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  const size = 'min(70vh, 70vw)';

  return (
    <section className="relative flex flex-1 items-center justify-center overflow-hidden bg-void">
      {/* nebula-radial vignette */}
      <div className="pointer-events-none absolute inset-0 bg-nebula-radial opacity-40" />

      {/* WebGL fallback card */}
      {webglError ? (
        <div className="relative z-10 flex max-w-md flex-col items-center gap-4 rounded-2xl border border-line bg-nebula p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-danger" />
          <h2 className="font-display text-lg font-bold uppercase tracking-widest text-ink">
            WebGL unavailable
          </h2>
          <p className="text-sm text-ink-dim">
            The fisheye editor needs WebGL to warp media in real time. Your
            browser or GPU driver refused a context ({webglError}). Your vault
            is still fully usable.
          </p>
          <Link
            to="/library"
            className="rounded-full border border-line px-5 py-2 font-display text-xs font-medium uppercase tracking-widest text-ink-dim transition-colors hover:border-violet-hi hover:text-ink"
          >
            Open Library →
          </Link>
        </div>
      ) : (
        <motion.div
          key={sourceKey}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-2xl shadow-glow-violet"
          style={{ width: size, height: size }}
        >
          {/* REC progress arc along the top edge */}
          {rec && (
            <div className="absolute inset-x-0 -top-1 z-20 h-[2px] overflow-hidden rounded-full bg-line/50">
              <div
                className="h-full bg-gold transition-[width] duration-200"
                style={{ width: `${rec.progress * 100}%` }}
              />
            </div>
          )}

          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
            className={cn(
              'rounded-2xl bg-void',
              dragging ? 'cursor-grabbing' : 'cursor-crosshair',
            )}
            onPointerDown={(e) => {
              if (!hasSource) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              lastRef.current = { x: e.clientX, y: e.clientY };
              setDragging(true);
            }}
            onPointerMove={(e) => {
              const last = lastRef.current;
              if (!dragging || !last) return;
              onDragDelta(e.clientX - last.x, e.clientY - last.y, e.shiftKey);
              lastRef.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={() => {
              setDragging(false);
              lastRef.current = null;
            }}
            onPointerCancel={() => {
              setDragging(false);
              lastRef.current = null;
            }}
          />

          {/* Dome wireframe overlay */}
          <DomeWireframe visible={params.wireframe} />

          {/* REC chip */}
          {rec && (
            <div className="glass-panel absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full px-3 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-danger shadow-[0_0_8px_rgba(248,113,113,0.9)]" />
              <span className="font-display text-[10px] font-bold uppercase tracking-widest text-danger">
                REC
              </span>
              <span className="font-mono text-[10px] text-gold tabular-nums">
                {fmtElapsed(rec.elapsed)}
              </span>
            </div>
          )}

          {/* HUD: live parameter readout */}
          <div className="glass-panel absolute bottom-3 left-3 z-10 rounded-lg px-3 py-1.5">
            <motion.span
              key={formatHudReadout(params)}
              initial={{ color: '#D1B888' }}
              animate={{ color: '#A79DC4' }}
              transition={{ duration: 0.8 }}
              className="font-mono text-[10px] tabular-nums"
            >
              {formatHudReadout(params)}
            </motion.span>
          </div>

          {/* HUD: render size chip */}
          <button
            type="button"
            onClick={onCycleResolution}
            title="Cycle export resolution"
            className="glass-panel absolute bottom-3 right-3 z-10 rounded-lg px-3 py-1.5 font-mono text-[10px] text-gold transition-colors hover:text-gold-hi"
          >
            {resolution}²
          </button>

          {/* Empty state */}
          {!hasSource && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl">
              <p className="max-w-xs text-center text-sm text-ink-dim">
                Choose a source on the left — try Earth.
              </p>
              <div className="flex gap-3">
                {[
                  { path: '/media/earth.jpg', label: 'Earth' },
                  { path: '/media/bg.jpg', label: 'Space' },
                  { path: '/media/saturn.jpg', label: 'Saturn' },
                ].map((s) => (
                  <button
                    key={s.path}
                    type="button"
                    onClick={() => onQuickSample(s.path)}
                    className="group flex flex-col items-center gap-1"
                  >
                    <img
                      src={s.path}
                      alt={s.label}
                      className="h-14 w-14 rounded-full border border-line object-cover transition-all duration-200 ease-orbital group-hover:scale-110 group-hover:border-gold group-hover:shadow-glow-gold"
                    />
                    <span className="font-mono text-[9px] uppercase tracking-wider text-ink-faint group-hover:text-gold">
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </section>
  );
}
