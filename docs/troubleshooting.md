# Troubleshooting log

Problems hit while building this teaser with Claude, with cause, fix and
prevention. Read this before starting a task. The `documentation` agent keeps
it current: search before adding, and update an existing entry rather than
duplicating it.

Entry format:

```
### <symptom>
- **Area:** scene | look | assets | DOM | tooling | git | environment | communication
- **Cause:**
- **Fix:**
- **Prevent:**
```

---

## Environment and tooling

### Figma can't be reached from the cloud container
- **Area:** environment
- **Cause:** figma.com (along with huggingface and jsdelivr) is not on the
  container's network allowlist. npm works there.
- **Fix:** pull the art with the Framelink Figma MCP, which runs on the Mac. It
  writes into the Mac folder, and the files are staged from there.
- **Prevent:** always use Framelink for Figma. Do not retry figma.com from the
  container.

### Framelink returns "Token expired"
- **Area:** environment
- **Cause:** the Figma personal access token behind Framelink expired.
- **Fix:** Sohye renewed the token, then fully quit and restarted the Claude
  app. A new chat alone is not enough.
- **Prevent:** when Framelink fails on auth, ask for a token renewal plus a
  full app restart straight away.

### Figma node IDs not found
- **Area:** assets
- **Cause:** the nodes in "Sohye's Exports" (`XxcK4AVrCry2d4CV7M5p05`) were
  deleted.
- **Fix:** export from the original file, `aGpRsTB8vyqSMYHz7lgtxF` (section
  "Round 3").
- **Prevent:** treat the original file as the source of truth for exports.

### `cv2.Sobel` fails with an unsupported dtype
- **Area:** assets
- **Cause:** a `float64` array was passed; opencv filters want `float32`.
- **Fix:** `.astype(np.float32)` before filtering.
- **Prevent:** keep image math in `float32` in `tools/*.py`.

### `tools/process.py` times out
- **Area:** tooling
- **Cause:** a full rebuild takes longer than the default two-minute command
  limit.
- **Fix:** run it with a longer timeout (around 590 s).
- **Prevent:** always give `process.py` a long timeout.

### Headless tests hang, look half-finished, or show the wrong fonts
- **Area:** tooling
- **Cause:** container quirks, not site bugs:
  - The Playwright browser path isn't the default.
  - The local server dies between calls.
  - `goto` waits for a load event that never settles.
  - SwiftShader is slow, so dt-capped animations appear unfinished.
  - Web fonts are blocked.
- **Fix:**
  - Launch with
    `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`.
  - Restart `python3 -m http.server` when it dies.
  - Use `waitUntil: 'commit'`.
- **Prevent:** read headless results with these limits in mind, and confirm
  timing and type in a real browser.

## Git and GitHub

### Git breaks inside the mounted folder (`index.lock`, garbage objects)
- **Area:** git
- **Cause:** the device shell could not unlink files in the connected folder
  until delete permission was granted, so git left lock files and broken
  objects behind.
- **Fix:** delete permission was granted for the project folder, the broken
  `.git` was removed, and the repo was re-initialised.
- **Prevent:** request delete permission before the first git operation in a
  mounted folder.

### `git push` → 403 "Permission … denied to sohye-k"
- **Area:** git
- **Cause:** the Mac's cached GitHub credential belongs to `sohye-k`, but the
  collaborator on `white64dev/rewind-2026-teaser-test` is `sohyek-wks`.
- **Fix:**
  - Set a per-repo identity (`user.name sohyek-wks`, `user.email
    sohye.wks@gmail.com`).
  - Put the username in the remote URL, and set
    `credential.useHttpPath true` so the credential is scoped per repo.
  - Rewrite the author on the unpushed commits.
  - Sign in as `sohyek-wks` with `gh auth login` plus `gh auth setup-git`, or
    use a classic PAT with `repo` scope.
- **Prevent:** check `git config user.name` and the remote URL before the
  first push in a new repo.

### `gh auth login` looks stuck after the browser says "you're all set"
- **Area:** git
- **Cause:** the terminal was waiting for a keypress, or a different account
  was still active.
- **Fix:** press Enter in the terminal, then run `gh auth setup-git`. Use
  `gh auth switch` if both accounts are signed in.
- **Prevent:** mention the Enter key and `gh auth switch` when giving login
  steps.

## Scene and look

### The lamp beam disappeared after an edit
- **Area:** look
- **Cause:** a replaced line put a `// comment` in front of
  `desk.add(beam)` on the same line, so the statement was commented out.
- **Fix:** moved the statement before the comment.
- **Prevent:** when editing one-liners, check that no `//` precedes code on the
  same line.

### Opaque meshes drawn in the wrong order (the clock covered or hidden)
- **Area:** look
- **Cause:** the sprites write no depth and are ordered by `renderOrder`. An
  opaque material skips the transparent queue and draws first, under the
  sprites.
- **Fix:** set `transparent: true` and an explicit `renderOrder`, and correct
  the z values of the flip cards.
- **Prevent:** give every new mesh both `transparent` and `renderOrder`.

### Lamp light far too yellow compared with Figma
- **Area:** look
- **Cause:** Figma blends in sRGB; the scene blends in linear, so the same
  opacity comes out stronger and more saturated.
- **Fix:** lowered the opacity and whitened the colour, judged by eye against
  the comp.
- **Prevent:** never copy Figma opacity or blend numbers straight into a
  shader. Match visually.

### A gap between the chair and the desk
- **Area:** scene
- **Cause:** the chair's clip line and its travel did not meet the desk edge.
- **Fix:** tuned `uClipTop` (-865) and the chair's end offset (-152).
- **Prevent:** after moving the chair, check the desk-rest frame at the desk
  edge.

## DOM

### The scene went blank, but the logo, sound button and popups still show
- **Area:** DOM
- **Cause:** `#hint` was commented out in `index.html`, but `main.js` still
  wrote `hint.style` every frame. The error killed the render loop.
- **Fix:** removed `#hint` and its CSS and JS together.
- **Prevent:** when removing an element, search its id across `index.html`,
  `src/*.js` and `src/style.css`. "DOM visible, canvas blank" means read the
  console first.

### The stories modal is cut off at the bottom
- **Area:** DOM
- **Cause:** `max-height: 100%` has no effect on a grid child with start
  alignment, and the padding was generous.
- **Fix:** `#modal{place-items:start center; padding:20px 16px 16px}`,
  `.wrap{max-height:calc(100dvh - 36px)}` and `.sheet{min-height:0}`, plus
  tighter inner spacing.
- **Prevent:** check the modal at a short laptop height (around 700px) and on a
  phone.

## Communication

### "Random 3D effects" meant the generated relief, not the lighting
- **Area:** communication
- **Cause:** relief/emboss from generated normals made objects look unlike the
  comp.
- **Fix:** `uRelief = 0`, and dynamic shadows are off by default. The comp
  layers are shown as drawn, with only light added.
- **Prevent:** default to "like the Figma picture" and add no effect that
  wasn't asked for.

### A design element was removed by mistake (the wall card)
- **Area:** communication
- **Cause:** "Be Part of doesn't need to be a popup" was read as "remove the
  wall card". The card was in the design.
- **Fix:** restored the wall card and the Scroll Down button.
- **Prevent:** when an instruction could remove something that exists in the
  comp, ask first. Remove only what is named.

### Rebuilt assets didn't match the design (clock, subheader)
- **Area:** communication
- **Cause:** the clock and the subheader copy were redrawn in code and drifted
  in colour, frame, spacing and size.
- **Fix:** exported the exact Figma nodes and used them as sprites. Only the
  flipping cards are code.
- **Prevent:** export a node the designer calls out as exact. Don't redraw it.

### Motion that was "too much"
- **Area:** communication
- **Cause:** the first passes used big moves: papers wiggling and rising, a
  metro card rising at the chair's speed, the lamp following the mouse,
  typing carriage travel off the typewriter, and heavy steam.
- **Fix:**
  - Loose papers only rotate slightly.
  - The map taps in with alternating tilts.
  - The lamp stays aimed at the sheet.
  - Carriage travel is capped at ±10%.
  - The steam was halved and slowed.
- **Prevent:** start subtle. This design wants small, tidy motion.
