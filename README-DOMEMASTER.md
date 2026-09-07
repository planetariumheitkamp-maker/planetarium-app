# DOMEMASTER — Planetarium Media Suite

High-end planetarium media production suite (React 19 + TypeScript + Vite + Tailwind + shadcn/ui):

- **Player** (`/player`) — pre-loaded show queue, AUTO mode (timed images, video-to-end, loop) or MANUAL single-button advance, crossfade transitions (0.5/1.2/2.5s), fullscreen Present mode, keyboard transport.
- **Fisheye Editor** (`/editor`) — real-time raw-WebGL equidistant dome-master warp (FOV 30–220°, azimuth, tilt, zoom, offset), live image+video warp, dome wireframe overlay, presets, PNG frame export (up to 2048²) and WebM clip export (captureStream + MediaRecorder).
- **Library** (`/library`) — persistent IndexedDB media vault: import images/videos (drag-drop), thumbnails, search/filter/sort, rename/delete with undo, download, send-to-playlist, storage meter. Renders from the editor are stored here with their fisheye parameters for re-editing.

## Run
```bash
npm install
npm run build   # or: npm run dev
```

## Assets note
The app expects planet textures at `public/media/*.jpg` — these are the same JPGs already at this repo's root (earth.jpg, mars.jpg, ..., bg.jpg, background.jpg). Copy them into `public/media/` before building. Marketing PNGs (hero-dome.png, pillar-*.png, workflow-console.png, og-cover.png) referenced by the home page can be substituted with any dark space imagery.

---

Batch 1/9 file list: README-DOMEMASTER.md, .gitignore, README.md, components.json, eslint.config.js, index.html, package.json, postcss.config.js, public/logo.svg, public/spec-dome-diagram.svg, src/App.tsx, src/components/AppShell.tsx

## v2 Update (fixes + improvements)
- **Editor**: fixed black-stage bug (canvas remount on source select); renderer lifecycle now tied to the canvas node. Auto-loads last-used/first source, persists parameters, JPEG export option (alongside PNG), source info chip, drag hint, graceful decode-failure fallback.
- **Player**: videos start muted with an unmute toggle (M) so autoplay never freezes the show; unplayable videos are skipped in AUTO mode; object-URL leak fixed; queue auto-refreshes on window focus; settings persisted; next-item preload; per-item progress bar; object-contain fit; present-mode vignette + film grain.
- **Library**: hover video previews, persisted sort/tab, "Export all" bulk action, 80%-quota storage warning.
