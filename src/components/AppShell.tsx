import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { CircleDot, HelpCircle, LayoutGrid, Play, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ensureSeeded, getStorageUsage } from '@/lib/db';

const NAV_ITEMS = [
  { to: '/player', label: 'Player', icon: Play },
  { to: '/editor', label: 'Fisheye Editor', icon: CircleDot },
  { to: '/library', label: 'Library', icon: LayoutGrid },
];

const PAGE_TITLES: Record<string, string> = {
  '/player': 'Show Player',
  '/editor': 'Fisheye Editor',
  '/library': 'Media Library',
};

/**
 * Tool-page shell (design.md §7.1): left icon rail (w-20 → w-60 on hover)
 * + top bar (h-14, glass). Tool pages render into `<Outlet/>`.
 */
export default function AppShell() {
  const location = useLocation();
  const [storagePct, setStoragePct] = useState<number | null>(null);

  useEffect(() => {
    ensureSeeded()
      .then(() => getStorageUsage())
      .then((u) => setStoragePct(Math.min(100, Math.round(u.ratio * 100))))
      .catch(() => setStoragePct(null));
  }, [location.pathname]);

  const title = PAGE_TITLES[location.pathname] ?? 'DOMEMASTER';

  return (
    <div className="flex min-h-[100dvh] bg-void text-ink">
      {/* Left icon rail */}
      <aside
        className={cn(
          'group fixed inset-y-0 left-0 z-40 flex w-20 flex-col border-r border-line',
          'glass-panel transition-all duration-300 ease-orbital hover:w-60',
        )}
      >
        {/* Logo */}
        <Link
          to="/"
          className="flex h-14 items-center gap-3 border-b border-line px-6"
          title="DOMEMASTER — Home"
        >
          <img src="/logo.svg" alt="DOMEMASTER" className="h-7 w-7 shrink-0" />
          <span className="whitespace-nowrap font-display text-xs font-bold tracking-[0.25em] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            DOMEMASTER
          </span>
        </Link>

        {/* Nav */}
        <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-4 rounded-xl px-4 py-3 transition-colors duration-200',
                  isActive
                    ? 'bg-dusk/60 text-gold'
                    : 'text-ink-faint hover:bg-dusk/40 hover:text-ink-dim',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-violet-hi" />
                  )}
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                  <span className="whitespace-nowrap font-display text-xs font-medium uppercase tracking-widest opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: storage meter + settings/help */}
        <div className="flex flex-col gap-1 border-t border-line px-3 py-3">
          <div className="flex items-center gap-4 rounded-xl px-4 py-2.5" title="Vault storage used">
            <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
              <svg viewBox="0 0 20 20" className="h-5 w-5 -rotate-90">
                <circle cx="10" cy="10" r="8" fill="none" stroke="#2A2050" strokeWidth="2.5" />
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  stroke="#D1B888"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 8}
                  strokeDashoffset={2 * Math.PI * 8 * (1 - (storagePct ?? 2) / 100)}
                />
              </svg>
            </span>
            <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-ink-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Vault {storagePct === null ? '—' : `${storagePct}%`}
            </span>
          </div>
          <button
            type="button"
            className="flex items-center gap-4 rounded-xl px-4 py-2.5 text-ink-faint transition-colors hover:text-ink-dim"
            title="Settings"
          >
            <Settings className="h-5 w-5 shrink-0" strokeWidth={1.75} />
            <span className="whitespace-nowrap font-display text-xs font-medium uppercase tracking-widest opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Settings
            </span>
          </button>
          <button
            type="button"
            className="flex items-center gap-4 rounded-xl px-4 py-2.5 text-ink-faint transition-colors hover:text-ink-dim"
            title="Help"
          >
            <HelpCircle className="h-5 w-5 shrink-0" strokeWidth={1.75} />
            <span className="whitespace-nowrap font-display text-xs font-medium uppercase tracking-widest opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Help
            </span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="ml-20 flex min-h-[100dvh] flex-1 flex-col">
        {/* Top bar */}
        <header className="glass-panel sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line px-6">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
              DOMEMASTER /
            </span>
            <h1 className="font-display text-sm font-bold uppercase tracking-widest text-ink">
              {title}
            </h1>
          </div>
          <div className="font-mono text-xs text-ink-faint">100% LOCAL</div>
        </header>

        {/* Tool page content */}
        <main className="flex flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
