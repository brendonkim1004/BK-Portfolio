# Milestone 1: Setup + Art Direction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Vite project with a proposed palette, a type test page for choosing fonts, and a visual storyboard, so Brendan can make the art-direction picks before any 3D work starts.

**Architecture:** Hand-written Vite multi-page setup (no scaffolder, so nothing interactive). The palette lives in one JS module that both CSS (as custom properties) and, later, Three.js read from. The type test and storyboard are plain HTML pages that exist only for decisions and are not linked from the real site.

**Tech Stack:** Vite, vanilla JS, Three.js, GSAP, Lenis (installed now, used from Milestone 2), Vitest, `@fontsource` font packages (self-hosted, no third-party requests).

**Spec:** `docs/superpowers/specs/2026-11-19-moon-cube-portfolio-design.md` (and `docs/Moon_Cube_Portfolio_PRD.md`, sections 6 and 12).

## Global Constraints

- Vanilla JS only. No React or other UI framework.
- No network calls to anything but the site's own files. Fonts are self-hosted via `@fontsource`.
- PRD section 6 "do not use" list applies to every page, including the test pages: no purple-to-blue gradients, neon glow, glassmorphism, gradient text, Inter/Roboto/system fonts as the design font, emoji or stock icons, identical rounded-card grids.
- Flat colour only. DOM animation, if any, uses `transform` and `opacity` only.
- No real Concord data, names, or numbers anywhere, including sample copy.
- Sample copy is first-person and friendly, and marked as placeholder wording for Brendan to replace.
- Repo root: `C:\Users\brend\Projects\moon-cube-portfolio`. Commit after each task, ending messages with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Review Focus

1. A font file fails to load: every `font-family` has a rounded fallback stack so the page stays readable (Task 3 checks by blocking fonts in DevTools).
2. Phone width (360 px): type test and storyboard have no horizontal page scroll (Tasks 3 and 4 check in device emulation).
3. Production build drops a page: `npm run build` must emit `index.html`, `type-test.html`, and `storyboard.html` (Task 1 test, re-run in Task 4).
4. A palette colour is edited later and labels become unreadable: the contrast test in Task 2 fails.
5. A stray outbound request (e.g. a Google Fonts link pasted in): the Network tab check in Task 3 shows only localhost.

## File Structure

```
package.json            scripts: dev, build, preview, test
vite.config.js          three HTML entry points
index.html              placeholder landing page linking the two test pages
type-test.html          font comparison page
storyboard.html         seven-panel storyboard
src/styles/palette.js   single source of colour truth + applyPalette()
src/styles/base.css     reset, body background, fallback font stacks
src/pages/typeTest.js   builds the type test page from a font list
src/pages/storyboard.js applies palette to the storyboard page
tests/palette.test.js   contrast checks
tests/build.test.js     build emits all three pages
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `type-test.html`, `storyboard.html`, `src/styles/base.css`, `tests/build.test.js`

**Interfaces:**
- Produces: npm scripts `dev` (`vite`), `build` (`vite build`), `preview` (`vite preview`), `test` (`vitest run`). `vite.config.js` with `build.rollupOptions.input` listing `index.html`, `type-test.html`, `storyboard.html`.

- [ ] **Step 1: Write `package.json`** with `"type": "module"`, `"private": true`, name `moon-cube-portfolio`, and the four scripts above. Then install:

```bash
npm install three gsap lenis
npm install -D vite vitest @fontsource/fredoka @fontsource/baloo-2 @fontsource/bagel-fat-one @fontsource/grandstander @fontsource/nunito
```

- [ ] **Step 2: Write the failing test** `tests/build.test.js`

```js
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { test, expect } from 'vitest';

test('build emits all three pages', () => {
  execSync('npx vite build', { stdio: 'pipe' });
  for (const page of ['index.html', 'type-test.html', 'storyboard.html']) {
    expect(existsSync(`dist/${page}`), page).toBe(true);
  }
}, 60_000);
```

- [ ] **Step 3: Run `npm test`.** Expected: FAIL (no HTML entry points yet).

- [ ] **Step 4: Write `vite.config.js`, the three HTML files, and `src/styles/base.css`.** Each HTML file has `lang="en"`, a viewport meta, a `<title>`, and links `base.css`. `index.html` body is a heading "Moon Cube Portfolio (work in progress)" and two links to the test pages. `type-test.html` and `storyboard.html` are empty shells with a `<main id="app">` for now. `base.css`: box-sizing reset, `margin: 0`, `body { background: #141B3C; color: #FFF4DC; }`, and the fallback stack `ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", sans-serif`.

- [ ] **Step 5: Run `npm test`.** Expected: PASS. Run `npm run dev` and confirm all three URLs load with an empty console.

- [ ] **Step 6: Commit** (`chore: scaffold Vite project with three pages`).

---

### Task 2: Palette

**Files:**
- Create: `src/styles/palette.js`, `tests/palette.test.js`

**Interfaces:**
- Produces:
  - `export const palette` with exactly these keys and proposed values:
    `ink: '#141B3C'`, `inkDeep: '#0C1028'`, `cream: '#FFF4DC'`, `moon: '#C9C6BD'`, `moonShade: '#9A978F'`, `outline: '#0A0D1F'`,
    `faces: { red: '#F2503B', orange: '#FF9A2E', yellow: '#FFD23F', green: '#3DBE7B', blue: '#3D8BF2', pink: '#FF7FB0' }`
  - `export function contrastRatio(hexA: string, hexB: string): number` (WCAG 2 relative-luminance formula)
  - `export function applyPalette(root: HTMLElement = document.documentElement): void` sets `--ink`, `--ink-deep`, `--cream`, `--moon`, `--moon-shade`, `--outline`, and `--face-red` … `--face-pink`.

- [ ] **Step 1: Write the failing test** `tests/palette.test.js`

```js
import { test, expect } from 'vitest';
import { palette, contrastRatio } from '../src/styles/palette.js';

test('contrastRatio matches known values', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
});

test('cream text is readable on ink', () => {
  expect(contrastRatio(palette.cream, palette.ink)).toBeGreaterThanOrEqual(7);
});

test('there are six face colours and ink labels are readable on each', () => {
  const faces = Object.entries(palette.faces);
  expect(faces).toHaveLength(6);
  for (const [name, hex] of faces) {
    expect(contrastRatio(palette.ink, hex), name).toBeGreaterThanOrEqual(4.5);
  }
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL (module missing).
- [ ] **Step 3: Implement `palette.js`** as specified. If a proposed face colour fails the 4.5 check, lighten that colour slightly (keep it saturated) until it passes, and note the change in the commit message.
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Commit** (`feat: add proposed palette with contrast checks`).

---

### Task 3: Type test page

**Files:**
- Create: `src/pages/typeTest.js`
- Modify: `type-test.html` (add `<script type="module" src="/src/pages/typeTest.js">`)

**Interfaces:**
- Consumes: `palette`, `applyPalette` from Task 2.
- Produces: `export const displayFonts = [{ id, label, family, weight }]` with four entries: Fredoka (600), Baloo 2 (700), Bagel Fat One (400), Grandstander (700). Body font is Nunito (400 and 700).

Page content, built from `displayFonts` so each font gets an identical specimen:

- A short intro line at the top: "Type test. Pick a display font (A to D) and tell me what you think of the colours."
- **Palette strip:** one swatch per palette colour with its name and hex, flat fills with a 3 px `--outline` border.
- **One specimen per font, lettered A to D,** each shown twice: on `--ink` with cream text, and on `--cream` with ink text. Every specimen contains:
  - the font's name as a small label
  - a hero line at `clamp(3rem, 10vw, 7rem)`: "Hi, I'm Brendan"
  - a subhead: "I build tools that make busy teams' days easier."
  - a paragraph of Nunito body copy (two sentences, first-person, marked "placeholder wording")
  - a row of six sticker-style labels, one per face colour, ink text, each rotated by a different small amount (between -3 and 3 degrees) with a hard offset shadow in `--outline` (no blur), reading: "Truck tracker", "Inventory", "Online store", "Pumps store", "Coming soon", "Coming soon"
  - the digits and symbols line: "0123456789 & ? ! %"
- Specimens stack in one column; no card grid.

- [ ] **Step 1: Implement `typeTest.js` and update `type-test.html`.** Import each font's CSS from its `@fontsource` package at the weights above. Call `applyPalette()`. Every `font-family` ends with the fallback stack from Task 1.
- [ ] **Step 2: Verify in the browser** (`npm run dev`, open `/type-test.html`):
  - four lettered specimens render, each visibly in a different font, on both backgrounds
  - console is empty
  - Network tab shows requests to localhost only
  - at 360 px width (device emulation) there is no horizontal page scroll
  - with font requests blocked in DevTools, text still renders in the rounded fallback
- [ ] **Step 3: Run `npm test`.** Expected: PASS (build still emits three pages).
- [ ] **Step 4: Commit** (`feat: add type test page`).

---

### Task 4: Storyboard page

**Files:**
- Create: `src/pages/storyboard.js`
- Modify: `storyboard.html`

**Interfaces:**
- Consumes: `applyPalette` from Task 2.

Seven panels in scroll order, stacked vertically and joined by a hand-drawn-looking dashed line down the left with the scroll length beside each. Each panel is a 16:9 inline SVG drawn with flat palette fills and 3 px `--outline` strokes with slightly irregular paths (toy-like, not precise), plus a caption underneath. Shapes are simple: circles, ellipses, rounded rects, a 3x3 grid for cube faces.

| # | Title | Scroll | Drawing | Caption |
|---|-------|--------|---------|---------|
| 1 | About | 1 screen | name text block left, ringed planet and small planet right, stars | "Name, role, two or three lines. Objects drift; cursor nudges the view." |
| 2 | Descent | ~3 screens | satellite, asteroids, comet at different sizes for depth, two small floating note stickers | "Camera drops past objects. Short notes on how I think float by." |
| 3 | Moon | ~2 screens | moon surface arc along the bottom, crater, scrambled cube half-buried | "Scrambled cube wedged in a crater. Scroll wiggles it free." |
| 4 | Solve | (same stretch) | cube floating above the crater mid-turn (one layer rotated), dust puff | "Scroll plays the solve. Scroll back and it un-solves." |
| 5 | Hold | ~1.5 screens | solved cube centred, curved arrow around it, title sticker on front face | "Drag to spin. Each colour is a project. Scroll on to keep going." |
| 6 | Burst + project | on click | left half: cubies and shards flying out; right half: flat face-colour page with title bar and a framed demo window | "Click a face: the cube bursts, colour floods, the project opens. Back reassembles it." |
| 7 | Outro | 1 screen | cube small in the distance, contact stickers | "Contact links, resume, more projects coming." |

Below the panels, one line showing the two always-visible stickers: "skip to the work" and "view as list".

- [ ] **Step 1: Implement `storyboard.html` and `storyboard.js`** (SVG markup lives in the HTML; the script only calls `applyPalette()`). Use the font stack fallback for now; the chosen display font is applied after Brendan picks.
- [ ] **Step 2: Verify in the browser** (`/storyboard.html`): seven panels in order, empty console, no horizontal scroll at 360 px, colours come from the palette variables (change one value in `palette.js`, see it change, revert).
- [ ] **Step 3: Run `npm test`.** Expected: PASS.
- [ ] **Step 4: Commit** (`feat: add storyboard page`).

---

### Task 5: Milestone check-in

- [ ] **Step 1:** Run `npm test` and `npm run build`; both succeed.
- [ ] **Step 2:** Stop and show Brendan how to run it (`npm run dev`, then the two page URLs), and ask in one batch:
  1. Which display font (A to D)? Any colours to change?
  2. Is "Brendan" the name to display, and how should it read?
  3. For each of the four projects: one-line problem, what you built, your role, tech, result (numbers only if safe).
  4. The two stores: public sites to link live, or fake-data demos? One cube face or two?
  5. Screenshots, or design the demo UI from your description? (Blank out anything real.)
  6. Anything that must not be shown? Default: none of it, invented names throughout.
  7. Contact links: email, GitHub, LinkedIn, resume file.
- [ ] **Step 3:** Wait for feedback before planning Milestone 2.
