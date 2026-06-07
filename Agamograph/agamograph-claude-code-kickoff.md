# Agamograph Studio — Claude Code Kickoff & Deployment Guide

This file has two parts:
- **Part A:** the prompt to paste into Claude Code to start the build.
- **Part B:** how to put the finished app online, for free, so the customer just opens a URL.

---

## PART A — Paste this into Claude Code

> I'm building a fully client-side web app called **Agamograph Studio**. The complete requirements are in `agamograph-PRD.md` and the exact engineering details (especially the geometry) are in `agamograph-technical-spec.md`. Read both before writing code, and follow the geometry formulas in the technical spec **exactly** — they are the heart of the app.
>
> **Stack:** Vite + React + TypeScript + Tailwind, Three.js via @react-three/fiber and @react-three/drei, IndexedDB (via `idb`) for save/resume, jsPDF for PDF export. **No backend, no external API calls, no analytics — everything runs in the browser.**
>
> **What it does:** the user uploads two images (A = left view, B = right view), adjusts sliders (number of slices 4–60, fold apex angle ~60–120° default 90°, finished canvas width/height with cm/inch toggle), and crops/zooms each image. The app shows live previews — a flat print preview, left/right reconstruction previews, and a real-time medium-realism **3D preview** of the folded accordion (soft shadows, neutral studio backdrop, horizontal sweep + slight tilt). It exports a **print-ready flat sheet** as PNG/JPG/PDF at a chosen DPI (default 300), correctly sized so that folding at the chosen angle yields the chosen mounted size.
>
> **Build order — do it in phases and let me test each before moving on:**
> 1. **Project scaffold** — Vite + React + TS + Tailwind, clean folder structure, all UI strings in `src/strings.ts`, a `dir` flag for future Hebrew/RTL. Get a blank styled shell running on localhost.
> 2. **Image upload + crop/zoom/pan** for both images with auto-fit defaults and clear A/B labels.
> 3. **Geometry module** — a pure, well-tested TypeScript module implementing every formula from the technical spec (`s`, `flatSheetWidth`, `foldDepth`, strip sampling, 3D vertex positions, UVs). Include the testing-checklist assertions from the spec as unit tests.
> 4. **Flat print preview + left/right reconstruction previews** (Canvas 2D) wired to live sliders.
> 5. **3D preview** (react-three-fiber) — the zigzag mesh with A on left-facing faces, B on right-facing faces via UVs; medium-realism lighting + soft shadows + neutral studio; constrained orbit (horizontal sweep ±90°, vertical tilt ±25°) with smooth damping.
> 6. **Export** — PNG/JPG/PDF at full DPI from the original full-res images; self-documenting filenames.
> 7. **Save/resume** — IndexedDB project store (image blobs + settings), debounced auto-save, restore on load.
> 8. **Polish** — radically simple UX for a non-technical user: big obvious controls, plain language, one clear path Upload → Adjust → Preview → Export, graceful inline guidance, no error walls.
>
> Keep the 3D mesh efficient (≤120 quads), use downscaled textures for previews but the original full-res for export, and debounce slider recomputes. Confirm the architecture with me, then start with phase 1.

---

## PART B — Getting it online for free (no server, no cost)

Because the app is 100% front-end, you can host it for **free** as a static site. The customer never installs anything — she just opens a URL and (optionally) bookmarks it.

### The simplest path: Vercel (recommended)

1. Put the project in a GitHub repo (Claude Code can initialize git; you push to a new repo under your `NadavGoren` account).
2. Go to **vercel.com**, sign in with GitHub (free "Hobby" plan).
3. Click **New Project**, pick the repo. Vercel auto-detects Vite. Click **Deploy**.
4. You get a URL like `agamograph-studio.vercel.app`. Send it to the customer. Done.
5. Every time you push changes to GitHub, Vercel redeploys automatically.

**Cost:** free. The Hobby plan is fine for a private tool like this — no server costs because there's no server, just static files served from a CDN.

### Alternatives (all free, same idea)

- **Netlify** — same flow as Vercel; drag-and-drop deploy also available.
- **GitHub Pages** — free, slightly more manual with Vite (set `base` in `vite.config.ts`); good if you'd rather keep everything on GitHub.
- **Cloudflare Pages** — also free and fast.

### Optional: custom branded URL

If you want `tool.studio1-design.com` instead of `*.vercel.app`, add your domain in Vercel's dashboard and point a DNS record at it. Domain cost only (a few dollars/year if you don't already own one) — the hosting stays free.

### Privacy reassurance for the customer

Tell her plainly: her photos **stay on her own computer**. The app does the work locally in the browser; nothing is uploaded anywhere. (This is literally true given the architecture — there's no server to upload to.)

### What she does, day to day

1. Open the bookmarked URL.
2. Upload two photos, move the sliders, watch the 3D preview.
3. Click Export, get the print file, send it to the print shop.
4. Reopen the URL later — her last project is still there (auto-saved locally).

---

## Notes for later (not v1, but easy to add)

- Hebrew + RTL: translate `src/strings.ts` and flip the `dir` flag.
- Fold guide lines / crop marks on the export (toggle).
- Three-image agamograph (would extend the geometry to 3 face orientations).
