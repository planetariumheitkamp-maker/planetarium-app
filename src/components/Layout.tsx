import type { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

/**
 * Marketing layout wrapper (home page).
 *
 * The Navbar is `fixed top-0` (h-16, overlays full-bleed hero), so this
 * Layout owns the offset: the content slot gets `pt-16`. Full-bleed
 * sections (e.g. the home hero) opt out *inside the page* with `-mt-16`
 * on the section itself — never by removing the Layout offset.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-cosmos text-ink">
      <Navbar />
      <main className="pt-16">{children}</main>
      <Footer />
    </div>
  );
}
