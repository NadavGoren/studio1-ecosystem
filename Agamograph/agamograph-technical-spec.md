# Agamograph Studio — Technical Specification

**Companion to:** `agamograph-PRD.md`
**Audience:** Claude Code (the implementer). This document is precise on purpose — especially the geometry, which is the part most likely to be implemented incorrectly.

---

## 1. Recommended stack

A well-trodden, fully client-side path that Claude Code can build reliably:

- **Build tool:** Vite
- **Framework:** React + TypeScript
- **3D:** Three.js via **@react-three/fiber** + **@react-three/drei** (for OrbitControls, soft shadows, environment)
- **Styling:** Tailwind CSS
- **State:** lightweight (Zustand or React context — implementer's choice)
- **Storage:** IndexedDB (via `idb` helper library) for save/resume
- **PDF export:** `jsPDF` (embed the rendered raster into a correctly-sized PDF page)
- **No backend. No external API calls. No analytics. Everything local.**

All processing uses the HTML Canvas 2D API (for slicing/compositing the print sheet) and WebGL (for the 3D preview).

---

## 2. The geometry (CRITICAL — implement exactly)

### 2.1 Concept

A flat sheet is folded accordion-style into a zigzag of triangular ridges. Each flat face of the zigzag is one printed strip. Faces alternate orientation: **left-facing faces show Image A**, **right-facing faces show Image B**. Because each strip is *tilted* relative to the wall, the folded piece is **narrower head-on than the flat printed sheet**.

### 2.2 Parameters

| Symbol | Meaning | Source |
|--------|---------|--------|
| `N` | slices per image | slider (4–60) |
| `theta` (θ) | fold apex/ridge angle, degrees | slider (~60–120), default 90 |
| `W` | finished **mounted** width (what the user picks as "final size") | user input |
| `H` | finished height (= strip height) | user input |
| `DPI` | export resolution | default 300 |

Total printed strips = `2N`, interleaved `A,B,A,B,...`

### 2.3 Core formulas

Define the half-deviation of each face from the wall plane. With apex angle θ between the two faces of a fold, each face deviates from the baseline by `phi = 90° - θ/2`.

Let `s` = the **slant width** of one printed strip (its true width on the flat sheet).

The head-on (mounted) width is the sum of the projected widths of all 2N faces:

```
W = 2 * N * s * sin(theta / 2)
```

Solve for the strip slant width given the user's target mounted width:

```
s = W / (2 * N * sin(theta / 2))
```

Derived quantities:

```
flatSheetWidth = 2 * N * s          // = W / sin(theta/2)   -> the width you actually PRINT
foldDepth      = s * cos(theta / 2)  // how far the piece sticks off the wall
sheetHeight    = H                   // strips are full height
```

**Sanity check (θ = 90°):** `sin(45°) ≈ 0.7071`, so `flatSheetWidth = W / 0.7071 ≈ 1.414 * W`. The printed sheet is ~41% wider than the finished piece. ✔

**Per-image perceived width** (the width Image A appears to have when viewed from its side, i.e. its N strips re-tiled):
```
perceivedImageWidth = N * s = W / (2 * sin(theta/2))
```
Use this to compute the aspect ratio each source image should be cropped/fit to: `perceivedImageWidth : H`.

### 2.4 Strip sampling (how to slice each image)

For image A (and identically for B):
- Strip `i` (i = 0..N-1) samples the vertical band of the **cropped** source image spanning horizontal fraction `[i/N, (i+1)/N]`.
- That band is drawn at physical width `s` and full height `H` on the flat sheet.

On the flat sheet, strips are laid out left-to-right interleaved:
```
position 0: A strip 0
position 1: B strip 0
position 2: A strip 1
position 3: B strip 1
...
position 2k:   A strip k
position 2k+1: B strip k
```
(Confirm interleave order against a physical test fold; the A/B starting parity may be swapped depending on fold direction. Make the start parity a single constant so it's a one-line flip.)

### 2.5 3D model

The 3D preview is the literal zigzag. It is cheap: `2N` quads (≤120 at N=60).

Top-down (looking down the Y axis), the sheet is a triangle wave in the X–Z plane, extruded along Y to height `H`.

- Projected width per face along X: `p = s * sin(theta/2)`  (note `2N * p = W` ✔)
- Depth per face along Z: `d = s * cos(theta/2)`
- Vertices along the ridge line, j = 0..2N:
  - `x_j = j * p`
  - `z_j = (j is odd) ? d : 0`   // valleys on the wall (z=0), ridges out at z=d
  - each vertical edge spans `y = 0..H`
- Face `j` connects vertex column `j` to `j+1` (a quad, two triangles).

Face orientation alternates. Faces whose surface normal points **left** (−X component) are **A-faces**; faces whose normal points **right** (+X component) are **B-faces**. Assign textures accordingly. (If A/B ends up reversed on screen, flip the parity constant — same constant as 2.4.)

**Texturing:** Do **not** cut bitmaps. Apply the cropped Image A as a texture across all A-faces and Image B across all B-faces using UV coordinates: A-face `k` uses `u ∈ [k/N, (k+1)/N]`, `v ∈ [0,1]`. This reconstructs each image correctly across its faces and is GPU-cheap.

**Materials & lighting (medium realism):**
- `MeshStandardMaterial` with the image texture, low roughness-ish matte paper look.
- One key directional light + soft ambient/hemisphere fill.
- Soft contact shadow under the piece (drei `<SoftShadows/>` or a `ContactShadows` plane).
- Neutral studio environment (light grey gradient backdrop, subtle floor). drei `<Environment>` preset "studio" or a plain neutral is fine — keep it light for performance.

**Camera / interaction:**
- Primary: horizontal sweep ≈ ±90° (180° total) around the vertical axis — this is what reveals the A↔B switch.
- Secondary: limited vertical tilt (e.g. ±25°).
- Use OrbitControls with constrained azimuth/polar limits and disabled zoom-pan jank, OR a custom drag handler. Smooth damping on.

### 2.6 Left/right reconstruction preview (2D)

For the flat "what does it look like from the left" view: composite only the A strips, each scaled to its true width, tiled with no gaps → reconstructs Image A. Same with B strips for the right view. This is a quick canvas composite; it confirms each source image reads correctly after slicing.

---

## 3. Export pipeline (print-ready)

1. Compute `flatSheetWidth` and `sheetHeight` in real-world units (from §2.3).
2. Convert to pixels at the chosen DPI:
   ```
   pxWidth  = round(flatSheetWidth_inches  * DPI)
   pxHeight = round(sheetHeight_inches     * DPI)
   ```
   (Convert cm→inches as needed: `inches = cm / 2.54`.)
3. Create an offscreen canvas at `pxWidth × pxHeight`.
4. Draw all `2N` strips in interleaved order, each sampling its source band (§2.4) at high quality (`imageSmoothingQuality = 'high'`). Each printed strip width in px = `pxWidth / (2N)`.
5. Output:
   - **PNG:** `canvas.toBlob('image/png')`.
   - **JPG:** `canvas.toBlob('image/jpeg', 0.95)`.
   - **PDF:** new jsPDF doc sized to the physical sheet (in mm), place the raster to fill the page at 1:1 physical scale so the print shop prints at exact size.
6. Filename: `agamograph_{W}x{H}{unit}_{N}slices_{theta}deg.{ext}`.

**Print correctness note:** the exported flat sheet must, when folded at angle θ, produce a piece of mounted width `W`. Optionally render very thin fold guide lines between strips on a *separate toggle* (off by default, since "no marks" for v1 — but a cheap, valuable later addition).

---

## 4. Data model (for save/resume)

Store one "project" object in IndexedDB:

```ts
type AgamographProject = {
  id: string;
  name: string;
  updatedAt: number;
  settings: {
    slices: number;        // N
    apexAngle: number;     // theta, degrees
    canvasWidth: number;   // W, in `unit`
    canvasHeight: number;  // H
    unit: 'cm' | 'in';
    dpi: number;
    exportFormat: 'png' | 'jpg' | 'pdf';
  };
  imageA: { blob: Blob; crop: CropTransform };
  imageB: { blob: Blob; crop: CropTransform };
};

type CropTransform = { offsetX: number; offsetY: number; scale: number };
```

- Store image **blobs** (not data URLs) for efficiency.
- Auto-save the active project on change (debounced); restore on load.
- "Save as / Load" list for multiple named projects is a nice-to-have.

---

## 5. Internationalization hook

- All visible strings live in `src/strings.ts` as a flat key→string map. No hard-coded English in components.
- A single `dir` flag (`'ltr' | 'rtl'`) drives layout direction. Building Hebrew later = translate `strings.ts` + set `dir='rtl'`. Keep layouts direction-agnostic (use logical CSS / fl\ex, avoid hard left/right where Tailwind logical equivalents exist).

---

## 6. Performance notes

- 3D mesh is tiny (≤120 quads); the only heavy step is generating textures from large uploads — downscale source images to a sensible max (e.g. 2048px on the long edge) for the *preview* textures, while keeping the **original full-res** image for the *export* compositing.
- Throttle/debounce slider→geometry recompute (rebuild the mesh only when N or θ changes; pan/zoom only updates UVs/textures).
- Export at full DPI runs once on click — fine to do synchronously with a brief "Exporting…" state.

---

## 7. Testing checklist (build-time validation)

- [ ] At θ=90°, exported sheet width ≈ 1.414 × mounted width.
- [ ] `2N` strips exactly fill the flat sheet with no gap/overlap.
- [ ] Left reconstruction shows complete, undistorted Image A; right shows Image B.
- [ ] 3D sweep transitions A → B smoothly and matches the left/right 2D previews at the extremes.
- [ ] Changing N rebuilds geometry without distorting images.
- [ ] Save → reload restores both images + every setting exactly.
- [ ] Export filenames encode settings; PDF prints at exact physical size.
