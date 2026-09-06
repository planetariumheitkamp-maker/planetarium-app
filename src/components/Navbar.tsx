import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { label: 'Overview', href: '/#overview' },
  { label: 'Player', href: '/#pillars' },
  { label: 'Editor', href: '/#pillars' },
  { label: 'Library', href: '/#pillars' },
  { label: 'Workflow', href: '/#workflow' },
];

/** Marketing navbar (design.md §7.2): fixed top, glass on scroll. */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300 ease-orbital',
        scrolled ? 'glass-panel border-b border-line/60' : 'bg-transparent border-b border-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo.svg" alt="DOMEMASTER" className="h-8 w-8" />
          <span className="font-display text-sm font-bold tracking-[0.25em] text-ink">
            DOMEMASTER
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-ink-dim transition-colors duration-200 hover:text-gold"
            >
              {link.label}
            </a>
          ))}
        </div>

        <button
          onClick={() => navigate('/player')}
          className={cn(
            'rounded-full bg-gold px-5 py-2 font-display text-xs font-bold uppercase tracking-widest text-void',
            'shadow-glow-gold transition-all duration-200 ease-orbital hover:bg-gold-hi hover:shadow-glow-gold-lg',
            'active:scale-[0.97]',
          )}
        >
          Open the Suite →
        </button>
      </nav>
    </header>
  );
}
