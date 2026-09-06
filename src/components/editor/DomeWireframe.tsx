import { motion, AnimatePresence } from 'framer-motion';

/**
 * Dome wireframe overlay (editor.md Zone 3): concentric altitude rings every
 * 15°, azimuth spokes every 30°, outer horizon circle, zenith crosshair, and
 * mono degree labels at cardinal points. Absolutely positioned over the warp
 * canvas; pointer-events none. Lines draw in (0.6s) / fade out.
 */
export default function DomeWireframe({ visible }: { visible: boolean }) {
  const stroke = 'rgba(209,184,136,0.35)';
  const rings = [15, 30, 45, 60, 75]; // altitude rings from zenith
  const spokes = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <AnimatePresence>
      {visible && (
        <motion.svg
          viewBox="0 0 200 200"
          className="pointer-events-none absolute inset-0 h-full w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          aria-hidden
        >
          {/* horizon circle */}
          <motion.circle
            cx="100" cy="100" r="98"
            fill="none" stroke={stroke} strokeWidth="0.6"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
          {/* altitude rings */}
          {rings.map((a, i) => (
            <motion.circle
              key={a}
              cx="100" cy="100" r={(a / 90) * 98}
              fill="none" stroke={stroke} strokeWidth="0.35"
              strokeDasharray="2 2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.4 }}
            />
          ))}
          {/* azimuth spokes */}
          {spokes.map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const x = 100 + 98 * Math.cos(rad);
            const y = 100 + 98 * Math.sin(rad);
            return (
              <motion.line
                key={deg}
                x1="100" y1="100" x2={x} y2={y}
                stroke={stroke} strokeWidth="0.3"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.05 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            );
          })}
          {/* zenith crosshair */}
          <line x1="94" y1="100" x2="106" y2="100" stroke={stroke} strokeWidth="0.5" />
          <line x1="100" y1="94" x2="100" y2="106" stroke={stroke} strokeWidth="0.5" />
          {/* degree labels at cardinal points */}
          {[
            { t: '0°', x: 196, y: 97, anchor: 'end' as const },
            { t: '90°', x: 100, y: 5.5, anchor: 'middle' as const },
            { t: '180°', x: 4, y: 97, anchor: 'start' as const },
            { t: '270°', x: 100, y: 198, anchor: 'middle' as const },
          ].map((l) => (
            <text
              key={l.t}
              x={l.x} y={l.y}
              textAnchor={l.anchor}
              fill="rgba(209,184,136,0.6)"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 6 }}
            >
              {l.t}
            </text>
          ))}
          <text
            x="100" y="88"
            textAnchor="middle"
            fill="rgba(209,184,136,0.6)"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 5, letterSpacing: '0.2em' }}
          >
            ZENITH
          </text>
        </motion.svg>
      )}
    </AnimatePresence>
  );
}
