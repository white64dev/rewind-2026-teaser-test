# Agent roles — overview

Six subagents for **MTRO-18796 Metro Rewind Teaser 3D**: the Round 3 teaser
("The Metro Rewind"). A lettered wall with a flip clock tilts down, cube-style,
to a lamp-lit desk. Plain Three.js + Vite, built from flat Figma layers, with
**no 3D models**. It looks 3D through lighting, shading and perspective, while
the motion itself is 2D (up, down, sideways).

| Agent | Handles | Skip when |
|---|---|---|
| `scene-author` | Camera rig and the scroll timeline, sprite placement, arrival choreography, typing, the clock flip, input (scroll/drag/swipe/zoom) | Pure look or pure DOM work |
| `look-render` | The relight sprite shader, the lamp beam, the wall sun, steam, the fisheye/blur post pass, render order, colour space | Nothing visual changed |
| `asset-pipeline` | Figma exports via Framelink, `raw/`, `tools/register.py` and `tools/process.py`, `public/assets/manifest.json` | No new artwork arrived |
| `overlay-accessibility` | The DOM over the canvas: newsletter form, stories modal, wall card, sound, back button, keyboard, reduced motion | Throwaway experiment |
| `verify-performance` | Browser checks, build, payload, frame time, phone/trackpad input | — |
| `documentation` | `README.md`, `docs/troubleshooting.md` (the problem log), these agent files, commit messages | Trivial one-off tweak |

## What every agent must know

- **Read `docs/troubleshooting.md` before starting.** It is the log of problems
  already hit on this project, with cause and fix. Do not repeat one.
- **Stack**: `three@0.170`, Vite 6 (`target: es2022`, `assetsDir: 'bundle'`,
  because `public/assets/` holds the art), and Vercel (`vercel.json` sends
  `X-Robots-Tag: noindex`). There is no framework and no backend.
- **Files**: `index.html` (markup), `src/main.js` (the scene), `src/ui.js`
  (forms, modal, sound), `src/style.css`, `public/assets/` (generated textures
  and the manifest), `tools/` (the Python asset pipeline), and `raw/` (Figma
  exports; git-ignored).
- **Match the Figma comp, not a guess.** Figma file `aGpRsTB8vyqSMYHz7lgtxF`,
  section "Round 3". When the designer says "like the picture", the comp's own
  layer is the answer. Do not rebuild the clock, subheader or type in code, and
  do not add effects nobody asked for. Generated relief/emboss was removed for
  exactly that reason.
- **Remove only what was asked.** Ask when an instruction is ambiguous; one
  element (the wall card) was deleted by mistake and had to be restored.
- **Language**: code, comments, docs and commits are in English. Chat with
  Sohye is in Korean.
- **Two machines**: the cloud container, and Sohye's Mac through the device
  shell, where the repo lives at `~/Projects/rewind-2026-playground/MTRO-18796-Teaser3D`.
  Edit on the Mac. The container cannot reach figma.com. See the log.
- **Git**: commit only when asked, in English, with the session's attribution
  lines. The repo pushes to `white64dev/rewind-2026-teaser-test` as
  `sohyek-wks` (a per-repo identity; see the log).
- **Ask before** adding a dependency, deleting artwork, or changing the motion
  constants that came from the approved prototype (`HOLD_END`, `MOVE_END`,
  `SMOOTH`, `K_MAX`, the 380vh scroller).

## Setup

1. One file per agent in `.claude/agents/`. Run `/agents` to confirm that they
   load.
2. Call one explicitly (`@scene-author …`), or describe the task and let each
   agent's `description` route it.
3. A typical change runs `asset-pipeline` if new art arrived, then
   `scene-author` and/or `look-render`, then `overlay-accessibility` if DOM
   changed, then `verify-performance`, then `documentation`, which runs last
   and always checks whether a new problem belongs in the log.
