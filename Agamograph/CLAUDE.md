# CLAUDE.md — Agamograph Studio

Guidance for Claude Code (and any future agent) working in this repo. Read this
first; it captures the architecture, conventions, and the non-obvious gotchas
that aren't visible from the code alone.

> **What this is:** a 100% client-side web app that turns **two images** into a
> **print-ready agamograph** (folded accordion lenticular art — image A from the
> left, B from the right). Upload two images → adjust sliders → live 2D + 3D
> previews → export a print-ready flat sheet. **No backend, no network, nothing
> leaves the browser.** Live: https://agamograph-eta.vercel.app

The product/eng intent lives in three spec docs in this folder — read them before
changing behavior:
- `agamograph-PRD.md` — product requirements
- `agamograph-technical-spec.md` — **the geometry (authoritative — implement exactly)**
- `agamograph-claude-code-kickoff.md` — original build plan + deploy notes

---

## ⚠️ Critical gotchas (read before editing)

1. **The project path contains Hebrew characters** (`…/סטודיו/…`). The `Write`/`Edit`
   tools intermittently **corrupt the path**, silently creating a look-alike stray
   directory (Greek/Bengali homoglyphs) instead of writing the real file. This has
   bitten this project repeatedly.
   **Workaround that always works:** write the file to an ASCII temp path
   (`/tmp/agamo_build/<name>`) then `cp` it into place with **Bash** — the Bash tool's
   working directory is reliably correct. After any batch of writes, verify with
   `ls -d ~/Desktop/סטוד*/ | wc -l` → must be **1** (only the real dir). If >1, a
   stray was created: recover the file from it and `rm -rf` the stray.

2. **Geometry is the single source of truth.** All fold math lives in the pure,
   unit-tested `src/lib/geometry.ts`. **Never re-derive or duplicate a formula** in a
   component — import from there. If you change geometry, update `geometry.test.ts`.

3. **Offline / privacy is a hard constraint.** No network calls, no analytics, no
   external fonts/HDRIs. In particular the 3D scene uses **only local lights** — do
   NOT add drei `<Environment preset=…>` (it fetches an HDR from a CDN).

4. **Dev server port is pinned to 5180** (`vite.config.ts`, `strictPort`), because
   sibling Studio 1 apps use 5173/5174. Don't change it casually.

5. **UI is Hebrew / RTL and cm-only.** All user text comes from `src/strings.ts`
   (no hard-coded strings in components). Inches were removed from the UI (the `Unit`
   type still allows `'in'` internally, but it's always `'cm'`).

---

## Commands

```bash
npm install
npm run dev        # http://localhost:5180  (pinned port)
npm test           # Vitest — geometry unit tests (src/lib/geometry.test.ts)
npm run build      # tsc -b && vite build → dist/
npm run typecheck  # types only
```

Verify a change in the browser with the preview tooling, not by asking the user.

---

## Architecture & data flow

One **Zustand store** (`src/store/useProjectStore.ts`) holds everything: the two
images (`A`/`B` as `{ blob, url, natW, natH, crop }`), `slices` (N), `apexAngleDeg`
(θ), `canvas` (`{ width, height, unit }`), `dpi`, `exportFormat`.

Everything downstream is **derived** from that store through the pure geometry:

```
store (N, θ, W, H, crops, images)
        │
        ▼
  geometry.ts  ── computeDimensions / buildStripLayout / buildFaces / computePixelSheet
        │
   ┌────┼─────────────────┬───────────────────────┐
   ▼    ▼                 ▼                       ▼
 2D previews         3D preview              Export
 render2d.ts         three/ (r3f)            exportSheet.ts
 (Flat + L/R)        buildThreeGeometry      (reuses render2d's
                     + croppedCanvas          drawFlatSheet at full DPI)
```

Key consequence: **`render2d.drawFlatSheet` is shared by the flat preview AND the
export**, so what you see is exactly what prints. The 3D mesh and the 2D strips
both come from the same `geometry.ts`, so they can't drift.

### The crop frame aspect — important and counter-intuitive
The crop frame is **not** the canvas W:H. It's `perceivedImageWidth : H` (spec §2.3) —
how each image appears when viewed from its side. Computed by `getFrameAspect()` in
the store. It depends on θ and W/H but **not** on N. The same `computeSourceRect`
(`src/lib/crop.ts`) maps a crop to a source rectangle for the preview, the 3D
texture, and the export — one definition, no drift.

---

## File map

```
src/
  main.tsx                      app entry (wraps <App/> in LanguageProvider)
  App.tsx                       layout (left: controls, right: previews); calls usePersistence()
  strings.ts                    ALL UI text — en + he maps, dir flag, activeLanguage = he
  index.css                     Tailwind v4 entry + focus/selection/slider styles
  i18n/
    LanguageProvider.tsx        provides t() and dir; sets <html lang/dir>
  store/
    useProjectStore.ts          Zustand store (the whole project state) + getFrameAspect()
  lib/
    geometry.ts                 ★ pure fold math — THE source of truth (spec §2–§3)
    geometry.test.ts            Vitest checklist assertions (keep green)
    crop.ts                     pure crop math: CropTransform, computeSourceRect, cropToBackground
    render2d.ts                 Canvas 2D: drawFlatSheet (shared w/ export) + drawReconstruction
    croppedCanvas.ts            cropped image → offscreen canvas (3D texture, downscaled ≤2048)
    buildThreeGeometry.ts       geometry faces → THREE.BufferGeometry (per source A/B)
    exportSheet.ts              PNG/JPG/PDF export (jsPDF lazy-imported); self-documenting filename
    canvasPresets.ts            size presets (A4/A3/A2/30×40…) in cm
    defaultImages.ts            generated A/B sample images (shown on first load)
    image.ts                    upload validation + dimension read
    projectStore.ts             IndexedDB (idb) — saveCurrentProject/load/clear; schema version
  hooks/
    useLoadedImage.ts           object URL → HTMLImageElement
    usePersistence.ts           restore last session (or seed samples) + debounced auto-save
  components/
    Header.tsx, StepIndicator.tsx
    ImageUploadPanel.tsx, ImageCropFrame.tsx     upload + drag/zoom/pan crop
    ControlsPanel.tsx           slices, angle, size dropdown + portrait/landscape
    DimensionsPanel.tsx         finished/flat-sheet/fold-depth/print-file readout
    TriangleProfile.tsx         SVG fold cross-section with dimensions/angle
    PreviewPanel.tsx            composes the three previews
    FlatPreview.tsx, ReconstructionPreview.tsx   Canvas 2D previews
    ExportPanel.tsx             format + DPI + export button
    three/ThreePreview.tsx      r3f <Canvas>, local lights, ContactShadows, constrained OrbitControls
    three/AgamographMesh.tsx    builds + disposes geometries/textures from the store
```

---

## Conventions

- **Strings:** add a key to the `Strings` type in `src/strings.ts`, then fill BOTH
  `en` and `he` maps. Never hard-code user-facing text. `activeLanguage` is `he`.
- **RTL-safe CSS:** use Tailwind **logical** utilities (`ms-`/`me-`/`ps-`/`pe-`, `start`/`end`)
  — avoid hard `left`/`right`. Layout must work in RTL.
- **Units:** cm only in the UI. Convert to inches only inside geometry for DPI math
  (`toInches`). Don't reintroduce an inch toggle without product sign-off.
- **Parity / mirror constants:** `A_FIRST` and `FLIP_U` in `geometry.ts` are the single
  switches for fold-direction parity and image mirroring. If a physical test fold comes
  out A/B-swapped or mirrored, flip one constant — don't patch call sites.
- **3D:** keep it cheap (≤120 quads). Rebuild geometry only on N/θ/W/H; textures only on
  image/crop. Dispose geometries/textures on change (see `AgamographMesh`). Local lights only.
- **Performance:** preview textures are downscaled (≤2048px, `croppedCanvas`); **export uses
  the original full-res blob** via `useLoadedImage`. Keep that split.
- **Persistence:** auto-save is debounced (600ms) and **fails soft** — never throw if
  IndexedDB is unavailable. Bump `PROJECT_SCHEMA_VERSION` if the persisted shape changes
  (old saves with a mismatched version are ignored, not migrated).

---

## Testing

`npm test` runs `src/lib/geometry.test.ts` — it encodes the spec §7 checklist
(θ=90° → flat sheet ≈ 1.414×W, 2N strips fill exactly, reconstruction covers [0,1],
faces normals/UVs, export px sizing, filename). **Keep these green.** Add cases when
you touch geometry. Tests are excluded from the production `tsc` build
(`tsconfig.app.json` `exclude`).

---

## Adding a feature — recipe

1. **State first:** add fields/actions to `useProjectStore.ts` (and to the persisted
   shape in `projectStore.ts` + `usePersistence.ts` if it should survive reload —
   bump the schema version).
2. **Math (if geometric):** add a pure function to `geometry.ts` + a test. Don't compute
   in components.
3. **UI:** new component under `src/components/` (or `three/` for 3D). Wire into
   `App.tsx`/`ControlsPanel`/`PreviewPanel`. All text via `t()` in both `en` + `he`.
4. **Reuse rendering:** for anything that ends up on the print sheet, go through
   `render2d.drawFlatSheet` so preview == export.
5. **Verify:** `npm test`, `npm run build`, then load http://localhost:5180 and check
   in the browser. Watch the stray-dir count (`ls -d ~/Desktop/סטוד*/ | wc -l` → 1).

---

## Deploy

Two options:
- **CLI (current setup):** deployed from inside this folder (project root = the app).
  `npx vercel@latest --prod --yes --scope studio1-nadavgoren` (needs a Vercel token in
  `VERCEL_TOKEN`). Not git-linked, so it does NOT auto-redeploy on push — re-run the CLI.
- **Git-linked (recommended long-term):** in the Vercel dashboard connect the GitHub
  repo `NadavGoren/studio1-ecosystem` with **Root Directory = `Agamograph`**; then every
  push to `main` auto-deploys. Vite preset auto-detected; build `npm run build`, output `dist`.

`.vercelignore` excludes `node_modules`, `dist`, `.claude`. The repo is a **monorepo** —
this app is the `Agamograph/` subdirectory.
```
