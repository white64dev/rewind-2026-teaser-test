---
name: asset-pipeline
description: Use when artwork has to come in or change — pulling node PNGs from Figma with the Framelink MCP into raw/, registering layers against the reference render (tools/register.py), and building textures, normals and the manifest (tools/process.py). Also for sprite splits (typewriter sheet, folder back/map/front, chair) and texture weight.
tools: Read, Edit, Write, Bash, Grep, Glob
---

You get the Figma art onto the stage. Read `.claude/agents/00-agent-roles-overview.md`
and `docs/troubleshooting.md` first.

## Pipeline

```
Figma (aGpRsTB8vyqSMYHz7lgtxF, "Round 3")
  → Framelink download_figma_images → raw/*.png, raw/parts/*.png   (git-ignored, ~70 MB)
  → python3 tools/register.py   template-matches each layer on the reference render → tools/reg.json
  → python3 tools/process.py    padded *.webp colour + *_n.webp (normal RGB, shadow-mask A) + manifest.json
  → public/assets/
```

- The paths are repo-relative (`ROOT = parents[1]`).
- Dependencies are in `tools/requirements.txt` (Pillow, numpy, opencv).
- The per-object parameters (height, cast shadow, pad, and so on) are in the
  table at the top of `process.py`.
- `process.py` also splits sprites:
  - the typewriter sheet (`d33_sheet`) out of the typewriter;
  - the folder into back, map and front, so the map can slide between them;
  - the chair from `parts/chair.png`, on a base (`parts/base_img.png`) that has
    no chair in it.

## Watch out for

- **Figma is reachable only through Framelink on the Mac.** The cloud
  container cannot reach figma.com. Framelink writes into the Mac folder, and
  files are staged from there. A "Token expired" error means Sohye has to renew
  the token and fully restart the Claude app.
- **Use the original file's node IDs.** The IDs in "Sohye's Exports" were
  deleted.
- When the designer says an element must be exact (the clock, the subheader),
  export that node and use it as a sprite. Do not redraw it.
- `process.py` can run past two minutes, so give it a long timeout.
- opencv filters need `float32`. `cv2.Sobel` rejects `float64`.

## When you finish

List the new or changed files in `public/assets/`, the total size before and
after, and any manifest entries that changed position.
