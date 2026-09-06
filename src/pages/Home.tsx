import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ArrowRight, CircleDot, Play } from 'lucide-react';
import { GoldButton, GhostButton, GoldSlider } from '@/components/primitives';
import CustomCursor from '@/components/home/CustomCursor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

gsap.registerPlugin(ScrollTrigger);

const HeroBackdrop = lazy(() => import('@/components/home/HeroBackdrop'));

export default function Home() {
  // Lenis smooth scrolling for the marketing page (design.md §5)
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="relative">
      <CustomCursor />
      <Hero />
      <Marquee />
      <Pillars />
      <Workflow />
      <Specs />
      <StatsBand />
      <FinalCTA />
    </div>
  );
}

/* ================================ Section 1 — Hero ================================ */

const KICKER = 'PLANETARIUM MEDIA SUITE';

function Hero() {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Load sequence (home.md §1)
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.fromTo(
        canvasWrapRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1.2 },
      )
        .fromTo(
          '.hero-kicker-char',
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, stagger: 0.03 },
          0.2,
        )
        .fromTo(
          '.hero-line',
          { y: 60, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, stagger: 0.15 },
          0.35,
        )
        .fromTo(
          '.hero-sub',
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9 },
          0.75,
        )
        .fromTo(
          '.hero-cta',
          { scale: 0.9, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.6)', stagger: 0.1 },
          0.95,
        )
        .fromTo(
          '.hero-caption',
          { opacity: 0 },
          { opacity: 1, duration: 0.8 },
          1.15,
        )
        .fromTo('.hero-scrollcue', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 1.3);

      // Scroll: content parallaxes up 0.6× and fades; backdrop scales up
      gsap.to(contentRef.current, {
        yPercent: -40,
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '40% top',
          scrub: true,
        },
      });
      gsap.to(canvasWrapRef.current, {
        scale: 1.15,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="overview"
      className="relative -mt-16 flex min-h-[100dvh] items-center justify-center overflow-hidden"
    >
      {/* Backdrop: hero-dome.png at 30% over nebula-radial */}
      <div className="absolute inset-0 bg-nebula-radial" />
      <img
        src="/hero-dome.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-void/40 via-transparent to-cosmos" />

      {/* Three.js starfield + dome wireframe */}
      <div ref={canvasWrapRef} className="absolute inset-0 opacity-0">
        <Suspense fallback={null}>
          <HeroBackdrop />
        </Suspense>
      </div>

      {/* Content */}
      <div ref={contentRef} className="relative z-10 mx-auto max-w-5xl px-6 text-center">
        <p className="hero-kicker kicker" aria-label={KICKER}>
          {KICKER.split('').map((ch, i) => (
            <span key={i} className="hero-kicker-char inline-block">
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </p>

        <h1 className="mt-6 font-display text-6xl font-black uppercase leading-[1.05] tracking-wide md:text-7xl lg:text-8xl">
          <span className="hero-line block">Every Show.</span>
          <span className="hero-line block text-gold-sheen">One Dome.</span>
          <span className="hero-line block">Zero Compromise.</span>
        </h1>

        <p className="hero-sub mx-auto mt-6 max-w-2xl text-lg font-light text-ink-dim md:text-xl">
          A cinematic media player, a real-time fisheye dome-master editor, and a
          persistent media vault — built for operators who run the universe from
          one console.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <span className="hero-cta inline-block" data-cursor="PLAY">
            <GoldButton onClick={() => navigate('/player')}>
              <Play className="h-4 w-4" /> Open the Player
            </GoldButton>
          </span>
          <span className="hero-cta inline-block" data-cursor="WARP">
            <GhostButton onClick={() => navigate('/editor')}>
              <CircleDot className="h-4 w-4" /> Warp your first frame
            </GhostButton>
          </span>
        </div>

        <p className="hero-caption mt-12 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
          180° Fisheye <span className="mx-2 text-gold">·</span> Auto-Advance Playlists
          <span className="mx-2 text-gold">·</span> IndexedDB Vault
          <span className="mx-2 text-gold">·</span> 100% Local
        </p>
      </div>

      {/* Scroll cue */}
      <div className="hero-scrollcue absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
        <div className="relative h-10 w-px overflow-hidden bg-line">
          <span className="absolute left-0 top-0 h-3 w-px animate-scroll-cue bg-gold" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint">
          Scroll
        </span>
      </div>
    </section>
  );
}

/* ============================ Section 2 — Marquee ============================ */

const MARQUEE_ITEMS = [
  'DOME-MASTER PROJECTION',
  'EQUIDISTANT FISHEYE WARP',
  'ONE-BUTTON SHOW CONTROL',
  'CROSSFADE TRANSITIONS',
  'OFFLINE-FIRST VAULT',
  '26 BUNDLED PLANET TEXTURES',
  'WEBM VIDEO EXPORT',
];

function Marquee() {
  const row = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <section className="group border-y border-line bg-void py-4 overflow-hidden">
      <div className="flex w-max animate-marquee gap-8 group-hover:[animation-play-state:paused]">
        {row.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-8 whitespace-nowrap font-display text-xs font-medium uppercase tracking-[0.25em] text-ink-faint transition-colors duration-200 hover:text-gold"
          >
            {item}
            <span className="text-gold">✦</span>
          </span>
        ))}
      </div>
    </section>
  );
}

/* ========================= Section 3 — Three Pillars ========================= */

const PILLARS = [
  {
    kicker: 'Player',
    title: 'The Show Player',
    image: '/pillar-player.png',
    body: 'Queue your program, press one button — or none. Auto-advance honors per-item durations and video length; manual mode waits for your cue. Every transition is a 1.2-second cinematic crossfade.',
    link: 'Enter the Player',
    to: '/player',
  },
  {
    kicker: 'Fisheye Editor',
    title: 'The Dome-Master Editor',
    image: '/pillar-editor.png',
    body: 'Warp any image or video into true equidistant fisheye in real time. Dial FOV, azimuth, tilt, zoom and offset on live WebGL shaders, overlay a dome wireframe, and export frames or full WebM clips.',
    link: 'Enter the Editor',
    to: '/editor',
  },
  {
    kicker: 'Library',
    title: 'The Vault',
    image: '/pillar-library.png',
    body: 'Everything you import or render persists locally in your vault — 26 planetary textures included. Rename, tag, download, or send any asset straight into the show playlist.',
    link: 'Enter the Library',
    to: '/library',
  },
];

function Pillars() {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.pillars-header',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'expo.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
        },
      );
      gsap.fromTo(
        '.pillar-card',
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          stagger: 0.12,
          ease: 'expo.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%' },
        },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="pillars" className="py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="pillars-header max-w-2xl">
          <p className="kicker">01 / The Suite</p>
          <h2 className="mt-4 font-display text-4xl font-bold uppercase tracking-wide md:text-5xl">
            Three instruments. <span className="text-gold-sheen">One console.</span>
          </h2>
          <p className="mt-4 text-lg font-light text-ink-dim">
            Everything a dome operator needs — from first import to final show —
            living in one dark, precise interface.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {PILLARS.map((p) => (
            <article
              key={p.title}
              data-cursor="OPEN"
              onClick={() => navigate(p.to)}
              className="pillar-card group cursor-pointer overflow-hidden rounded-2xl border border-line bg-nebula transition-all duration-300 ease-orbital hover:-translate-y-1 hover:border-[rgba(209,184,136,0.35)] hover:shadow-glow-violet"
            >
              <div className="h-56 overflow-hidden">
                <img
                  src={p.image}
                  alt={p.title}
                  className="h-full w-full object-cover transition-transform duration-700 ease-orbital group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-8">
                <p className="kicker">{p.kicker}</p>
                <h3 className="mt-3 font-display text-xl font-bold tracking-wide">
                  {p.title}
                </h3>
                <p className="mt-3 text-sm font-light leading-relaxed text-ink-dim">
                  {p.body}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-gold">
                  {p.link}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-orbital group-hover:translate-x-1" />
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================= Section 4 — Workflow Story ========================= */

const WORKFLOW_ACTS = [
  {
    kicker: '02 / Workflow',
    title: 'Load your universe.',
    body: 'Drop images and video into the vault, or start with the bundled solar system — every texture is show-ready.',
  },
  {
    kicker: '02 / Workflow',
    title: 'Warp for the dome.',
    body: 'One slider sweep turns flat media into a 180° dome master. Watch longitude lines bend in real time.',
  },
  {
    kicker: '02 / Workflow',
    title: 'Press one button.',
    body: 'Auto mode runs the whole show; manual mode hands you a single gold button. Fullscreen, crossfaded, flawless.',
  },
];

const WORKFLOW_THUMBS = [
  '/media/earth.jpg',
  '/media/jupiter.jpg',
  '/media/saturn.jpg',
  '/media/moon.jpg',
  '/media/io.jpg',
  '/media/bg.jpg',
];

function Workflow() {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLImageElement>(null);
  const [act, setAct] = useState(0);
  const [fov, setFov] = useState(180);

  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top top',
        end: '+=250%',
        pin: true,
        scrub: true,
        onUpdate: (self) => {
          const next = Math.min(2, Math.floor(self.progress * 3));
          setAct((prev) => (prev === next ? prev : next));
        },
      });
      // background slowly pans up across the whole pin
      gsap.to(bgRef.current, {
        y: -60,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=250%',
          scrub: true,
        },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="workflow" className="relative min-h-[100dvh] overflow-hidden">
      {/* Backdrop */}
      <img
        ref={bgRef}
        src="/workflow-console.png"
        alt=""
        className="absolute inset-0 h-[calc(100%+80px)] w-full object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-cosmos via-cosmos/60 to-cosmos" />

      {/* Act indicator */}
      <div className="absolute left-6 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3 md:left-12">
        {WORKFLOW_ACTS.map((_, i) => (
          <span
            key={i}
            className={
              i === act
                ? 'h-2.5 w-6 rounded-full bg-gold transition-all duration-300 ease-orbital'
                : 'h-2.5 w-2.5 rounded-full bg-gold/30 transition-all duration-300 ease-orbital'
            }
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto grid h-[100dvh] max-w-7xl items-center gap-12 px-6 md:grid-cols-2 md:px-16">
        {/* Text stack */}
        <div className="relative min-h-56">
          {WORKFLOW_ACTS.map((a, i) => (
            <div
              key={a.title}
              className={
                i === act
                  ? 'transition-all duration-500 ease-orbital opacity-100 translate-y-0'
                  : 'pointer-events-none absolute inset-0 transition-all duration-500 ease-orbital opacity-0 translate-y-8'
              }
            >
              <p className="kicker">{a.kicker}</p>
              <h3 className="mt-4 font-display text-3xl font-bold uppercase tracking-wide md:text-4xl">
                {a.title}
              </h3>
              <p className="mt-4 max-w-md text-lg font-light text-ink-dim">{a.body}</p>
            </div>
          ))}
        </div>

        {/* Console panel */}
        <div className="glass-panel mx-auto w-full max-w-md rounded-2xl p-6">
          <div key={act} className="workflow-panel">
            {act === 0 && (
              <div>
                <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                  Vault · 6 of 28
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {WORKFLOW_THUMBS.map((src) => (
                    <div key={src} className="overflow-hidden rounded-lg border border-line">
                      <img src={src} alt="" className="aspect-square h-full w-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {act === 1 && (
              <div>
                <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                  Equidistant warp · live
                </p>
                {/* mini fisheye preview (static approximation) */}
                <div className="relative mx-auto aspect-square w-48 overflow-hidden rounded-full border border-gold/40 bg-nebula">
                  <div className="starfield absolute inset-0 opacity-70" />
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={`spoke-${i}`}
                      className="absolute left-1/2 top-1/2 h-1/2 w-px origin-top bg-gold/25"
                      style={{ transform: `rotate(${i * 30}deg)` }}
                    />
                  ))}
                  {[0.33, 0.66, 1].map((k) => (
                    <div
                      key={`ring-${k}`}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/25"
                      style={{ width: `${k * 100}%`, height: `${k * 100}%` }}
                    />
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-4">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">FOV</span>
                  <GoldSlider
                    value={fov}
                    min={30}
                    max={220}
                    onChange={setFov}
                    formatValue={(v) => `${v}°`}
                    aria-label="Field of view"
                    className="flex-1"
                  />
                  <span className="w-14 text-right font-mono text-sm text-gold">{fov}°</span>
                </div>
              </div>
            )}
            {act === 2 && (
              <div className="flex flex-col items-center py-6">
                <p className="mb-6 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                  Transport · manual mode
                </p>
                <button
                  type="button"
                  data-cursor="PLAY"
                  className="flex h-20 w-20 animate-pulse-gold items-center justify-center rounded-full bg-gold text-void transition-colors hover:bg-gold-hi"
                  aria-label="Advance"
                  onClick={() => navigate('/player')}
                >
                  <Play className="h-8 w-8 fill-current" />
                </button>
                <p className="mt-6 font-mono text-xs text-ink-dim">00:00:08:12 → NEXT ▶</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================= Section 5 — Specs ============================= */

const SPEC_ROWS = [
  { label: 'PROJECTION', text: 'Equidistant fisheye dome master, 30°–220° FOV, square output up to 2048×2048' },
  { label: 'TRANSITIONS', text: 'GPU crossfade, 0.5s / 1.2s / 2.5s presets' },
  { label: 'FORMATS', text: 'Import: JPG, PNG, WebP, MP4, WebM · Export: PNG frame, WebM video' },
  { label: 'STORAGE', text: 'IndexedDB vault, fully offline, zero uploads' },
  { label: 'CONTROL', text: 'Auto-advance playlists · one-button manual mode · keyboard transport (Space, ←, →, F)' },
  { label: 'BUNDLED', text: '26 planetary & lunar textures + 2 deep-space backgrounds' },
];

const SHORTCUTS: Array<[string, string]> = [
  ['Space', 'Play / pause / advance'],
  ['→', 'Next'],
  ['←', 'Previous'],
  ['F', 'Fullscreen'],
  ['A', 'Toggle auto / manual'],
  ['Esc', 'Exit present mode'],
];

function Specs() {
  const sectionRef = useRef<HTMLElement>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.spec-row',
        { x: -30, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.08,
          ease: 'expo.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
        },
      );
      gsap.fromTo(
        '.spec-diagram',
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          delay: 0.2,
          ease: 'expo.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
        },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="specs" className="py-32">
      <div className="mx-auto grid max-w-7xl gap-16 px-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Sticky header */}
        <div className="md:sticky md:top-32 md:self-start">
          <p className="kicker">03 / Specs</p>
          <h2 className="mt-4 font-display text-4xl font-bold uppercase tracking-wide md:text-5xl">
            Engineered for <span className="text-gold-sheen">the dome.</span>
          </h2>
          <p className="mt-4 text-lg font-light text-ink-dim">
            Every number on this sheet was chosen in a projection booth, not a
            boardroom.
          </p>
          <div className="mt-8">
            <GhostButton onClick={() => setShortcutsOpen(true)}>
              Read keyboard shortcuts
            </GhostButton>
          </div>
        </div>

        {/* Spec rows + diagram */}
        <div>
          {SPEC_ROWS.map((row) => (
            <div
              key={row.label}
              className="spec-row grid grid-cols-[auto_1fr] gap-6 border-t border-line py-5"
            >
              <span className="w-28 font-mono text-xs tracking-[0.15em] text-gold">
                {row.label}
              </span>
              <span className="text-sm font-light text-ink-dim">{row.text}</span>
            </div>
          ))}

          <div
            className="spec-diagram group relative mt-10 overflow-hidden rounded-2xl border border-line bg-nebula p-6"
            title="Equidistant dome-master: angular distance from center = angular distance from dome zenith."
          >
            <img
              src="/spec-dome-diagram.svg"
              alt="Dome theater cross-section with 180° fisheye projection angle"
              className="w-full"
              loading="lazy"
            />
            <div className="pointer-events-none absolute inset-x-6 bottom-6 translate-y-3 rounded-xl glass-panel p-3 text-center font-mono text-[11px] text-gold opacity-0 transition-all duration-300 ease-orbital group-hover:translate-y-0 group-hover:opacity-100">
              Equidistant dome-master: angular distance from center = angular distance from dome zenith.
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts modal */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="glass-panel border-line bg-nebula/90 text-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-sm font-bold uppercase tracking-[0.25em] text-gold">
              Keyboard transport
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {SHORTCUTS.map(([key, action]) => (
              <div key={key} className="flex items-center gap-3">
                <kbd className="rounded-md border border-line bg-void px-2 py-1 font-mono text-xs text-gold">
                  {key}
                </kbd>
                <span className="text-sm font-light text-ink-dim">{action}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ============================ Section 6 — Stats ============================ */

const STATS = [
  { value: 28, suffix: '', label: 'bundled media assets' },
  { value: 220, suffix: '°', label: 'maximum fisheye FOV' },
  { value: 2048, suffix: 'px', label: 'max dome-master export' },
  { value: 0, suffix: '', label: 'bytes leave your device' },
];

function StatsBand() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const nodes = sectionRef.current?.querySelectorAll<HTMLElement>('.stat-number') ?? [];
      nodes.forEach((node) => {
        const target = Number(node.dataset.value ?? '0');
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.5,
          ease: 'expo.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
          onUpdate: () => {
            node.textContent = String(Math.round(obj.v));
          },
        });
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="border-y border-line bg-nebula py-20">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-6 md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <p className="font-display text-3xl font-bold text-gold md:text-4xl">
              <span className="stat-number" data-value={s.value}>
                0
              </span>
              {s.suffix}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* =========================== Section 7 — Final CTA =========================== */

const CTA_LINE_1 = 'THE DOME IS DARK.';
const CTA_LINE_2 = 'THE SHOW IS YOURS.';

function FinalCTA() {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.cta-word',
        { y: 40, opacity: 0, rotate: 2 },
        {
          y: 0,
          opacity: 1,
          rotate: 0,
          duration: 0.9,
          stagger: 0.08,
          ease: 'expo.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
        },
      );
      gsap.fromTo(
        '.cta-sub, .cta-button',
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: 'expo.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%' },
        },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden py-40">
      {/* soft radial gold/violet glow */}
      <div className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 animate-breathe rounded-full bg-[radial-gradient(circle,rgba(209,184,136,0.16),rgba(107,79,187,0.18)_45%,transparent_70%)] blur-3xl" />
      {/* rotating orbit ring */}
      <svg
        viewBox="0 0 600 600"
        className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 animate-spin-slow opacity-20"
      >
        <circle cx="300" cy="300" r="280" fill="none" stroke="#D1B888" strokeWidth="1" strokeDasharray="4 10" />
      </svg>

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <p className="kicker">04 / Launch</p>
        <h2 className="mt-6 font-display text-5xl font-black uppercase leading-[1.08] tracking-wide md:text-7xl">
          {CTA_LINE_1.split(' ').map((w, i) => (
            <span key={`a-${i}`} className="cta-word inline-block">
              {w}&nbsp;
            </span>
          ))}
          <br />
          {CTA_LINE_2.split(' ').map((w, i) => (
            <span
              key={`b-${i}`}
              className={
                w === 'YOURS.'
                  ? 'cta-word inline-block text-gold-sheen'
                  : 'cta-word inline-block'
              }
            >
              {w}&nbsp;
            </span>
          ))}
        </h2>
        <p className="cta-sub mx-auto mt-6 max-w-xl text-lg font-light text-ink-dim">
          Open the suite and run your first show in under a minute — no accounts,
          no uploads, no cables.
        </p>
        <div className="cta-button mt-12" data-cursor="PLAY">
          <GoldButton size="lg" onClick={() => navigate('/player')} className="group">
            <Play className="h-5 w-5" /> Launch DOMEMASTER
            <ArrowRight className="h-5 w-5 transition-transform duration-300 ease-orbital group-hover:translate-x-1" />
          </GoldButton>
        </div>
      </div>
    </section>
  );
}
