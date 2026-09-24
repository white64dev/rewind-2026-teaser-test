# MTRO-18796 · Metro Rewind Teaser 3D

Prototype of the Round 3 teaser ("The Metro Rewind"): a lettered wall with a flip clock that tilts down, cube-style, to a lamp-lit desk. Built in Three.js from the Figma comps, with no 3D models.

## Run

```bash
npm install
npm run dev       # local dev server
npm run build     # production build → dist/
npm run preview   # serve dist/
```

 

## How it works

- **Transition.** Two faces of a box interior: the wall comp is the back face and the desk comp is the floor. The camera stands half a frame from each face and only pitches, 0° → 90°, with a vertical FOV of 90°. Scroll, drag, swipe, a click on the wall, or the Scroll Down card all drive the same timeline: hold 0–14%, pitch 14–78%, then settle. A fisheye and vertical motion-blur post pass run only mid-move.
- **Layers.** Every desk object is a flat image layer from Figma, placed at its comp position. Layers with height are perspective-corrected so they land exactly on the comp at rest.
- **Lighting.** The lamp is off during the tilt and switches on a beat (0.8 s) after the desk arrives, then the typing starts; clicking the shade toggles it. The beam is a single shader cone that runs white at the lamp and yellow at the pool, aimed at the typewriter sheet. The wall light is the comp's sun patch, animated to breathe, sway and throw dust motes.
- **Arrival choreography.** The chair tucks under the desk. The Metrorail map taps down into the folder with small alternating tilts. Photos, the SmarTrip card and the M puzzle square up from slight rotations. Then the typewriter types "Be Part of Metro Rewind".
- **Wall card.** The "Be Part of Metro Rewind" card tears open from its corner after loading and tears shut (over 1.4 s) once the scroll leaves the top. It uses a clip-path port of the Replica's crumpled-edge reveal (`src/reveal.js`).
- **Owner's Manual.** Clicking the manual on the desk (or its keyboard button) opens a 3D book reader (`src/book.js`, loaded on demand). Each sheet is a bone-skinned box that curls as it turns. Pages are `public/manual/p01–p28.webp`, rendered from the PDF, which is also linked for download.
- **UI.** The newsletter form and the three-step "Calling for Your Metro Stories" modal validate input, then show a "not connected yet" message. Nothing is sent. The sound toggle plays a synthesized room tone with clock and typewriter clicks.

## Layout

```
index.html          markup (forms, modal, overlays)
src/main.js         Three.js scene, transition, lighting, animations
src/ui.js           forms, modal, sound
src/style.css
public/assets/      processed textures (*.webp colour, *_n.webp normal + shadow mask) and manifest.json
tools/              asset pipeline (Python)
raw/                Figma exports — not committed
```

## Rebuilding assets

`raw/` holds the PNG exports from Figma (file `aGpRsTB8vyqSMYHz7lgtxF`, section "Round 3"), downloaded with the Framelink Figma MCP. It is git-ignored because of its size (~70 MB).

```bash
pip install -r tools/requirements.txt
python3 tools/register.py   # locate each desk layer against the reference render → tools/reg.json
python3 tools/process.py    # write public/assets/*.webp + manifest.json
```

Per-object parameters (height, cast shadow, and so on) live in the table at the top of `tools/process.py`.

## Placeholders to replace before launch

- Indexing: the test deploy is `noindex`. At launch, remove the robots meta in `index.html` and the `X-Robots-Tag` header in `vercel.json`.
- Share URLs: set `SITE_URL` (e.g. `https://example.com`) as a build env var so canonical and Open Graph tags are absolute. On Vercel the production domain is used automatically. The share image is `public/og.jpg` (1200×630, cropped from the wall comp).

- Fonts: Roboto Serif (condensed) and Archivo stand in for the licensed New Spirit Compressed and Helvetica Now.
- The category descriptions in the stories modal are draft copy.
- The newsletter and story endpoints are not wired up.
