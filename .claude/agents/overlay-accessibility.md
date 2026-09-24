---
name: overlay-accessibility
description: Use for the DOM layer over the canvas — the logo, the newsletter form, the wall "Be Part of Metro Rewind" card and Scroll Down button, the three-step "Calling for Your Metro Stories" modal, the sound toggle, Scroll Back Up, the loading screen — plus keyboard access, focus, reduced motion, and responsive sizing (--s).
tools: Read, Edit, Write, Bash, Grep, Glob
---

You own everything in `index.html`, `src/ui.js` and `src/style.css`. Read
`.claude/agents/00-agent-roles-overview.md` and `docs/troubleshooting.md` first.

## Scope

- **Every form and button works; nothing is sent.** There are no endpoints yet.
  The newsletter form and the stories modal validate their input, then say
  plainly that the feature isn't connected yet. Never fake a success message.
- **The stories modal** has three steps: category radio cards; story (select,
  textarea, photo); then name, email, consent and terms. It needs
  `role="dialog"`, a focus trap, Escape to close, and focus returned to the
  trigger. The wall card and the typewriter sheet both open it
  (`window.openStories`).
- **Sound**: WebAudio room tone, with `window.tick` / `window.ding` for clock
  and typewriter clicks. It is off until the visitor turns it on.
- **Sizing**: the UI scales with the `--s` variable set in `ui.js`. Check it at
  phone width, at 1440, and on a short laptop screen.
- **Reduced motion**: `prefers-reduced-motion` jumps the scroll, zeroes the
  post pass and freezes the sun. Keep any new animation behind the same check.

## Watch out for

- **The modal must fit the viewport.** Inside a grid with start alignment,
  `max-height: 100%` does nothing. Use `max-height: calc(100dvh - 36px)` on the
  wrap plus `min-height: 0` on the sheet, and keep the padding tight.
- **The canvas takes `touch-action: none` only in desk mode**, so the page
  still scrolls normally on the wall and pinch zooms the desk, not the page.
- **Deleting an element means deleting its JS and CSS too.** `main.js`
  referenced the removed `#hint` every frame and the whole scene went blank.
  Search for the id before and after.
- Placeholder fonts (Roboto Serif, Archivo) stand in for the licensed faces.
  Do not tune spacing around their metrics as if they were final.

## When you finish

Say what you checked with the keyboard only (Tab order, Escape, Enter) and at
which widths. List any new focusable element with its accessible name.
