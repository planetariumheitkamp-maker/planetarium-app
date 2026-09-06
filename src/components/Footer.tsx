import { Link } from 'react-router';

/** Marketing footer (design.md §7.3). */
export default function Footer() {
  return (
    <footer className="border-t border-line bg-void">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="DOMEMASTER" className="h-7 w-7" />
              <span className="font-display text-xs font-bold tracking-[0.25em] text-ink">
                DOMEMASTER
              </span>
            </div>
            <p className="mt-4 text-sm font-light text-ink-dim">
              The fulldome media workbench.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Your media never leaves this device
              </span>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="kicker !tracking-[0.25em]">Product</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/player" className="text-ink-dim transition-colors hover:text-gold">Player</Link></li>
              <li><Link to="/editor" className="text-ink-dim transition-colors hover:text-gold">Fisheye Editor</Link></li>
              <li><Link to="/library" className="text-ink-dim transition-colors hover:text-gold">Library</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="kicker !tracking-[0.25em]">Resources</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><a href="/#specs" className="text-ink-dim transition-colors hover:text-gold">Projection spec cheat-sheet</a></li>
              <li><a href="/#specs" className="text-ink-dim transition-colors hover:text-gold">Keyboard shortcuts</a></li>
              <li><a href="#" className="text-ink-dim transition-colors hover:text-gold">Changelog</a></li>
            </ul>
          </div>

          {/* Status */}
          <div>
            <h4 className="kicker !tracking-[0.25em]">Status</h4>
            <div className="mt-4 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
              <span className="text-sm text-ink-dim">All systems nominal · 100% local</span>
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="mt-14 flex items-center justify-between border-t border-line pt-6">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            © 2025 DOMEMASTER — PLANETARIUM MEDIA SUITE
          </p>
          <div className="relative flex h-9 w-9 items-center justify-center">
            <img src="/logo.svg" alt="" className="h-5 w-5 opacity-70" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="h-1.5 w-1.5 animate-orbit-dot rounded-full bg-gold" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
