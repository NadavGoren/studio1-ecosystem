# Agamograph Studio

A fully client-side web app that turns **two images** into a **print-ready
agamograph** — the folded, accordion-style lenticular artwork where one picture
is visible from the left and another from the right.

Upload two images → adjust a few sliders → see live 2D + 3D previews → export a
print-ready flat sheet to fold. **Everything runs locally in the browser — no
server, no uploads, nothing leaves your computer.**

## Stack

- Vite + React + TypeScript + Tailwind CSS v4
- Three.js via @react-three/fiber + drei (real-time 3D fold preview)
- Canvas 2D for slicing / flat-sheet rendering and export
- IndexedDB (via `idb`) for auto-save / resume
- jsPDF for PDF export
- UI is Hebrew (RTL); all strings live in `src/strings.ts` for easy localization

## Develop

```bash
npm install
npm run dev      # http://localhost:5180
npm test         # geometry unit tests
npm run build    # type-check + production build → dist/
```

## Deploy (Vercel)

This app lives in the `Agamograph/` subdirectory of the repo. On Vercel:

1. Import the GitHub repo.
2. Set **Root Directory** to `Agamograph`.
3. Framework preset auto-detects **Vite**; Build = `npm run build`, Output = `dist`.
4. Deploy. Every push to `main` redeploys automatically.

Hosting is free (static files on a CDN) — there's no backend.

## Geometry

All fold math (slice width, flat-sheet width, fold depth, 3D vertices, UVs,
export pixel sizing) lives in the pure, unit-tested module `src/lib/geometry.ts`,
implemented exactly per `agamograph-technical-spec.md`.
