# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pixel Factory is a pixel art editor and AI generation studio. It features a canvas editor with undo/redo, palette management, animation timeline with onion skinning, AI-powered sprite generation via Gemini, image-to-pixel conversion, PXE protocol import/export, and a local project gallery.

## Commands

- `npm run dev` — Start dev server (Express + Vite HMR) on port 3000
- `npm run build` — Build Vite frontend + esbuild backend bundle
- `npm start` — Run production build from dist/
- `npm run clean` — Remove dist/ and server.js
- `npm run lint` — TypeScript type checking (`tsc --noEmit`)

Set `GEMINI_API_KEY` in `.env.local` for AI generation features.

## Architecture

### Server (server.ts)

Express server with three AI endpoints, all proxying to Gemini 3.5 Flash:

- `POST /api/generate` — Generate pixel art from a text prompt (single RLE string output)
- `POST /api/generate-next-frame` — Generate one animation frame from current frame state
- `POST /api/generate-frame-sequence` — Generate N sequential animation frames from a starting frame

All AI responses are structured JSON with typed schemas via `@google/genai` SDK. In dev mode, Vite middleware handles frontend; in production, Express serves static dist/.

### Frontend (src/)

- **App.tsx** — Root component managing all shared state: grid, palette, frames, undo history, active tool, tabs. Lifts state up so all child components read/write through props.
- **types.ts** — `PixelArtProject`, `CanvasState`, `ToolType`, `PresetTemplate`
- **utils.ts** — RLE encode/decode, ASCII preset parser, CSS/SVG export helpers, 4 built-in pixel art presets (Mario mushroom, space invader, coin, cactus)
- **index.css** — Tailwind v4 with custom fonts (Outfit + JetBrains Mono)

### Component Tree

```
App (state owner — grid, palette, frames, history, tool)
├── GridCanvas — Canvas rendering, mouse drawing, symmetry, flood fill, onion skin overlays
├── PaletteSection — Tool selection (pen/eraser/bucket/picker), grid toggle, symmetry mode, color swatches, palette presets
├── AIGenerator — Prompt input, style/background/size selection, calls POST /api/generate
├── ImagePixelator — Drag-drop image, downscale to pixel grid with configurable brightness/contrast/saturation/dither
├── ImportExport — PXE protocol code display, SVG/CSS/PNG export, PXE code import
├── AnimationStudio — Frame timeline, playback canvas, GIF export (via gifenc), spritesheet PNG export, JSON metadata, AI frame sequence generation
└── ProjectGallery — Save/load from localStorage, preset library thumbnails, saved project management
```

### Data Flow

- Grid data: flat `string[]` of hex colors or `'transparent'`
- Palette: `string[]` where index 0 is always the background/transparent color
- RLE encoding: `"count*index"` pairs (e.g. `"12*0,4*1,2*3,238*0"`), separated by commas. Supports single-string (global) or array-of-strings (per-row) formats.
- Undo: history stack with pointer (`history[]` + `historyPointer`), slices forward on new action
- Animation frames: `frames[][]` — array of frame grids, synced to editor grid via useEffect
- Projects persist via `localStorage` key `pixel_factory_saved_projects`

### Dependencies

- React 19, Vite 6, Tailwind CSS 4, Express 4
- `@google/genai` — Gemini AI SDK
- `lucide-react` — Icons
- `motion` — Animations
- `gifenc` — GIF encoding in the browser