import { useEffect, useRef, useState } from 'react';

/**
 * Marketing-page custom cursor (design.md §6): 12px gold dot + 36px
 * trailing ring; expands to 64px with a label over [data-cursor] targets.
 * Implemented with rAF + refs (no state per frame).
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    if (!fine) return;
    setEnabled(true);

    const target = { x: -100, y: -100 };
    const ring = { x: -100, y: -100 };
    let hoverLabel: string | null = null;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      const el = (e.target as HTMLElement | null)?.closest?.('[data-cursor]');
      hoverLabel = el ? el.getAttribute('data-cursor') : null;
    };

    const loop = () => {
      ring.x += (target.x - ring.x) * 0.18;
      ring.y += (target.y - ring.y) * 0.18;
      const dot = dotRef.current;
      const ringEl = ringRef.current;
      if (dot) dot.style.transform = `translate(${target.x}px, ${target.y}px) translate(-50%, -50%)`;
      if (ringEl) {
        const size = hoverLabel ? 64 : 36;
        ringEl.style.transform = `translate(${ring.x}px, ${ring.y}px) translate(-50%, -50%)`;
        ringEl.style.width = `${size}px`;
        ringEl.style.height = `${size}px`;
        ringEl.style.borderColor = hoverLabel ? 'rgba(209,184,136,0.9)' : 'rgba(209,184,136,0.5)';
      }
      if (labelRef.current) {
        labelRef.current.textContent = hoverLabel ?? '';
        labelRef.current.style.opacity = hoverLabel ? '1' : '0';
      }
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    document.documentElement.style.cursor = 'none';
    document.body.style.cursor = 'none';

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
      document.documentElement.style.cursor = '';
      document.body.style.cursor = '';
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div
        ref={dotRef}
        className="pointer-events-none fixed left-0 top-0 z-[90] h-3 w-3 rounded-full bg-gold"
        style={{ transform: 'translate(-100px, -100px)' }}
      />
      <div
        ref={ringRef}
        className="pointer-events-none fixed left-0 top-0 z-[89] flex items-center justify-center rounded-full border transition-[width,height,border-color] duration-200"
        style={{ width: 36, height: 36, borderColor: 'rgba(209,184,136,0.5)' }}
      >
        <span
          ref={labelRef}
          className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-gold transition-opacity duration-150"
          style={{ opacity: 0 }}
        />
      </div>
    </>
  );
}
