# Agamograph Studio — Product Requirements Document (PRD)

**Version:** 1.0
**Date:** June 2026
**Prepared for:** Studio 1 (client deliverable)
**End user:** A non-technical artist who produces handmade agamographs and wants to automate the design/print step.

---

## 1. Overview

**What it is:** A browser-based tool that turns **two uploaded images** into a **print-ready agamograph** — the lenticular-style artwork made by folding a printed sheet into a triangular accordion so that one image is visible from the left and the other from the right.

**Why:** The artist currently slices photos and folds cardboard entirely by hand. This tool automates all the geometry, slicing, and layout, and outputs a single file ready to send to a print shop. It also shows a realistic 3D preview of the folded result so she can judge the piece before printing.

**Core promise:** Upload two images → adjust a few sliders → see a live 2D and 3D preview → export a print-ready file. No technical knowledge required.

---

## 2. Target user & context

- **Single non-technical user.** No computer experience. The tool must open like a normal website (a bookmarked URL) and work with zero setup, no install, no terminal.
- **Regular use.** She'll produce many pieces over time, so save/resume and a frictionless workflow matter.
- **Privacy-sensitive.** She uploads personal artwork and photos. **Nothing leaves her computer** — see architecture.

---

## 3. Architecture decision (locked)

**Pure front-end, client-side-only web app. No backend server.**

- All image processing, slicing, geometry, 3D rendering, and file export happen **locally in the browser**.
- Uploaded images **never leave the user's machine** — zero privacy risk.
- Hosting is **free** (static hosting on Vercel / Netlify / GitHub Pages). The user just opens a URL.
- See `agamograph-claude-code-kickoff.md` for the deployment walkthrough.

---

## 4. The agamograph, defined

An agamograph is a flat printed sheet divided into thin vertical strips, then folded accordion-style into a row of triangular ridges. Half the strips show **Image A** (visible when viewed from the left), the other half show **Image B** (visible from the right). As the viewer moves, the image "switches."

Key terms used throughout this spec:

- **Slices (N):** number of vertical strips *per image*. Total printed strips = 2N, interleaved A,B,A,B…
- **Apex angle (θ):** the interior angle of each triangular fold (the ridge angle). Default 90°.
- **Canvas / mounted width (W):** the width of the finished piece as it appears head-on, mounted on the wall.
- **Canvas height (H):** the height of the piece (= strip height).
- **Flat sheet:** the actual printed output, which is *wider* than W because folding shortens the visible width.

The exact math is in `agamograph-technical-spec.md`. The app must hide all of this from the user — she thinks only in "final size" and "how many slices."

---

## 5. Functional requirements

### 5.1 Image input
- Upload **two images** (Image A = left view, Image B = right view).
- Accept JPG, PNG, WEBP. Large files OK (handled client-side).
- Each image can be independently **panned, zoomed, and cropped** within the canvas frame.
- A sensible **auto-fit default** (center + cover the canvas aspect ratio) is applied on upload, so the result already looks reasonable before any manual adjustment.
- Clear A / B labelling so she always knows which image is "left" and which is "right."

### 5.2 Controls (all live — preview updates in real time)
- **Number of slices (N):** slider, range **4–60**, default e.g. 24.
- **Apex angle (θ):** slider, default **90°**, range ~60°–120°.
- **Canvas size:** width and height in real-world units (cm and inches toggle). This is the *finished mounted size*.
- **Per-image crop/zoom/pan:** interactive, per image.
- All controls update the 2D and 3D previews live.

### 5.3 Previews
Three coordinated views the user can switch between (or see together — implementer's choice, tabs are fine):

1. **Flat / print preview** — shows the interleaved A/B strips exactly as they will be printed on the flat sheet.
2. **Left view & Right view simulation** — shows how the piece reads as "Image A only" from the left and "Image B only" from the right (flattened reconstruction).
3. **3D preview** — see 5.4.

### 5.4 3D preview (a headline feature)
- Realistic, **real-time** 3D rendering of the folded accordion piece.
- Built as the actual zigzag geometry (2N tilted quads) with Image A on the left-facing faces and Image B on the right-facing faces.
- **Realism: medium** — soft shadows + ambient occlusion, neutral studio backdrop. Looks polished, stays fast.
- **Interaction:** primary = **horizontal sweep** (drag left↔right to "walk past" the artwork — the natural way to experience the effect, roughly 180°). Secondary = slight **vertical tilt**. Smooth, responsive.
- As the viewing angle sweeps, the visible image should naturally transition A → mixed → B, exactly like the real object.
- Performance target: smooth 60fps on a normal laptop, instant response to slider changes.

### 5.5 Export (print-ready)
- One-click **Export**.
- Formats: **JPG, PNG, PDF** (user chooses).
- Output is the **flat sheet** at print resolution (default **300 DPI**, configurable), sized so that when folded it produces the chosen mounted canvas size.
- No crop/bleed marks for now (leave a clean hook to add them later).
- Filename includes the settings (e.g. `agamograph_40x30cm_24slices_90deg.png`) so files are self-documenting.

### 5.6 Save / resume
- Save the current project (both images + all settings) and reload it later.
- Use **IndexedDB** (images are too large for localStorage).
- Simple "Save project" / "Load project" — and ideally auto-save the last session so reopening the URL restores where she left off.

---

## 6. UX principles

- **Radically simple.** Built for someone with no computer experience. Big, obvious controls. Plain language. No jargon ("slices," "size," not "tessellation," "DPI buried in advanced").
- **Forgiving.** Auto-fit defaults mean it looks good immediately. Nothing can break the layout.
- **Live feedback.** Every change is visible instantly in the previews.
- **One clear path:** Upload → Adjust → Preview → Export.
- **No dead ends, no error walls.** If something's wrong (e.g. only one image uploaded), guide gently inline.

---

## 7. Language & branding

- **UI language: English for now.** All user-facing strings kept in a **single strings file** (e.g. `strings.ts`) so the whole UI can be switched to **Hebrew + RTL** later by editing one file and flipping a layout direction flag. Build with this swap in mind from day one.
- **Branding: neutral / white-label.** No logos or brand colors. Clean, quiet, professional.

---

## 8. Out of scope (v1)

- Three or more images (v1 is strictly two).
- Crop/bleed/registration marks (hook for later).
- Hebrew UI (structure for it now, ship English first).
- Any server, account, login, or cloud storage.
- Mobile-first design (desktop browser is the primary target; should still be usable on a tablet).

---

## 9. Success criteria

The tool is a success when the artist can, with no help:
1. Open a URL.
2. Upload two photos.
3. Move a couple of sliders and immediately understand the result via the 2D + 3D previews.
4. Export a file and hand it to a print shop, fold the print, and get a correct, well-aligned agamograph.
