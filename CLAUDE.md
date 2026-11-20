# Moon Cube Portfolio

Brendon Kim's portfolio site: a scroll-driven 3D journey through toy-like space down to the moon, where a scrambled Rubik's cube frees itself and solves as you scroll. Each solved face opens a project. Brendon studies business + computer science at UBC and knows front-end basics, JS, Git/GitHub and Supabase. The audience is **business / product hiring** (PM, ops, consulting-type roles).

Full reference, read before making design or structure decisions:

- `docs/Moon_Cube_Portfolio_PRD.md` — the original brief (art direction in section 6, animation rules in section 9).
- `docs/superpowers/specs/2026-11-19-moon-cube-portfolio-design.md` — the approved design. Where it differs from the PRD, the design wins.

This file was written on 2026-11-19 as a handoff from an earlier session that ran in a different folder. Check the code before trusting any detail here that could have changed.

## Working rules

- **Never run `git init`, commit, create branches, or push.** Brendon manages git and will set up the GitHub repo. A local `.git` already exists (branch `milestone-1`, Milestone 1 commits only, never pushed); leave it alone unless asked. Just edit files and say what changed.
- **Never use real Concord data.** Work from Brendon's job at Concord appears only as static, fake-data demos with invented names, IDs, quantities and dates. No network calls, no Supabase client, no keys. Do not ask for real data.
- **Smooth, clean animation is the top priority.** Animate only `transform` and `opacity` in the DOM. If a feature hurts smoothness, simplify it.
- **Avoid the generic AI look** (PRD section 6): no purple-to-blue gradients, neon glow, glassmorphism, gradient text, Inter/Roboto, emoji or stock icons, or identical card grids.
- **Stop after each milestone**, show how to run it, and wait for feedback.
- **All wording on the site is a draft** until Brendon rewrites it. Do not ship filler copy.
- Explain decisions briefly, in plain language. Keep code simple and commented.
- Vanilla JS and Three.js only. No React unless asked.

## Decisions made

- **Name:** shown as "Brendon Kim", with no "Hi, I'm" or other greeting. On load the name, major and school decode into place: each letter flickers through random symbols and locks in, in a left-to-right wave (`src/ui/textMotion.js`). Brendon asked for this after the igloo.inc link animation; two earlier tries (debris blocks, wind-blown dust) were dropped.
- **Solved-cube celebration** (Brendon, 2026-11-19): when the solve finishes the cube swells, does one full turn, and a ring of stickers in the six cube colours pops out (`src/scene/cube/celebrate.js`).
- **Type:** Fredoka (weight 600) for display, Nunito for body. Self-hosted through `@fontsource`.
- **Look:** dark, ink-navy space with cream text and chunky saturated cube colours. All colours live in `src/styles/palette.js`.
- **The cube frees and solves itself** (Brendon, 2026-11-19): once scroll reaches the cube it wiggles, lifts and solves on a timer (about 5.6 s), with no further scrolling needed. Scrolling back up above the moon rewinds it into the crater. This replaces the design doc's scroll-driven solve. Timings are the constants at the top of `src/scene/cube/index.js`.
- **Short descent, no floating text** (Brendon, 2026-11-19): the descent is 190svh (160svh on phones) with nothing written over it; Brendon removed the floating notes and the scroll hint. The only loose line left is "Hang on. What's that?" at the moon.
- **Face hover shows a preview card above the cube**: a small drawn sketch (`src/ui/previews.js`, chosen by each project's `preview` field), the title and the summary. Project titles are written in Title Case.
- **Two placeholder puzzles beside the cube** (Brendon, 2026-11-19): a Pyraminx on the left and a Megaminx on the right, each resting flat on the floor of its own crater (nothing buried) and lifting a little on hover (`src/scene/objects/puzzles.js`, placed in `world.js`; craters come from `moon.addCrater`). They only show "Coming Soon" on hover for now; Brendon plans to put more projects in them later.
- **The solved cube is bigger**: it grows to 1.3x on wide screens (1.1x on phones) while it solves (`cubeGrow` in `world.js`).
- **Planets and asteroids spin when clicked** (Brendon, 2026-11-19): each object lists its `spinnables`, and `world.js` handles the click, the slow-down and the hand cursor. The satellite spins too; the comet does not.
- **Puzzles use their standard colour schemes** (Brendon, 2026-11-19): the cube is white top / yellow bottom, green front / blue back, red right / orange left (`palette.cube`, which has white where the site palette has pink); the Pyraminx is yellow underneath with green, red, blue clockwise from above; the Megaminx uses its twelve standard colours (`palette.megaminx`). The solved cube shows its white / red / blue corner. Projects sit on blue (truck tracker), red (inventory), white (online store) and orange (pumps store, on the back).
- **The page ends inside the moon** (Brendon, 2026-11-19): the camera tips down until the surface of the same 3D moon fills the screen (`OUTRO_TILT` in `world.js`), and the last section carries on as that ground, fading in at its top with a few drawn craters (Brendon preferred this to a version where the text sat on the bare 3D moon); it holds a big "Brendon Kim" and the contact links as plain large words on ruled lines. The link addresses are still placeholders in `index.html`.
- **No pills or sticker boxes anywhere** (Brendon found them generic): the major, school, floating notes, hints and "Coming Soon" labels are plain type, and buttons use the `.cube-link` style in `site.css`: plain words led by one small cube-sticker square that makes a quarter turn on hover.
- **The contact section is right after the cube** (Brendon, 2026-11-19): there is no pause section at all (`#hold` has no height): scrolling on from the solved cube tips the page straight down onto the moon, and that ending follows the scrollbar exactly (`scrub: true`) so the 3D moon and the contact text stay together. Scroll is held at the cube only while it is solving (`holdAtCube` in `scroll.js`, called from `main.js`); once solved nothing is locked. Stopping just short of the cube still settles gently onto it.
- **All 3D objects are built in code** (no Blender models). Each object is its own module so one could be swapped for a model later.
- **Launch projects (4 of 6 faces):** truck production tracker, inventory + barcode system, Concord online store, Concord pre-owned pumps store. Other faces say "Coming soon".
- **The two stores** may be linked live (check first that nothing account-specific shows) or shown as demos. Brendon was open to either; settle it when those projects are discussed.
- **Project pages lead with problem and result**, then the demo, with tech as a small footnote.
- **Direct links per project** (`#project/<id>`), and an always-visible "skip to the work" sticker. A "view as list" sticker comes in Milestone 4.

## What is built

- **Milestone 1:** Vite setup, palette with contrast tests, and two decision pages (`/type-test.html`, `/storyboard.html`). The decision pages are throwaway and come out before launch.
- **Milestone 2:** the real page (`index.html`): About screen, space objects, scroll-driven descent, the moon, a grey stand-in box that wiggles free, lifts, and can be dragged during the hold, the outro, and the "skip to the work" sticker. Checked in headless Chrome at desktop and phone sizes; not yet checked on a real phone or approved by Brendon.

- **Visuals for Milestones 3 to 5** (built in one pass on 2026-11-19, at Brendon's request to do all visuals first and details after): the real 27-piece cube with its solve and dust puff, drag, face hover with title stickers, keyboard face buttons, the burst (cubies, shards, scan lines, HUD label, colour flood), the project page layout, `#project/<id>` links, and the "view as list" page. Checked in headless Chrome at desktop and phone sizes only. **Still placeholder:** every line of project text except the titles, the demo window (empty frame), and the contact links.

Where things live:

```
index.html              page text, in scroll order: about, descent, moon, hold, outro
src/main.js             wires text, scroll and scene together
src/styles/             palette.js (colours), base.css, site.css
src/scroll/scroll.js    Lenis smooth scroll + the "journey" values (descent, moon, outro: 0 to 1)
src/data/projects.js    every project's text and which face colour it sits on
src/ui/textMotion.js    name reveal and floating notes
src/ui/projectView.js   burst screen effects (HUD, scan lines, colour flood) and the project page
src/ui/listView.js      "view as list" page
src/ui/faceLabel.js     title sticker for the hovered face
src/ui/faceButtons.js   hidden keyboard buttons, one per face
src/scene/stage.js      renderer, camera, lights
src/scene/materials.js  toon shading and the wobbly outline
src/scene/world.js      places every object and moves the camera from the journey values
src/scene/objects/      planets, satellite, asteroids, comet, moon, stars, dust puff
src/scene/cube/         solve.js (scramble + snapshots), model.js (cubies, face colours),
                        burst.js (shards + particles), index.js (pose, drag, hover, click)
src/dev/fps.js          dev-only frame-rate readout
src/pages/              the two decision pages
tests/                  palette contrast and build checks
```

## What is next

1. **Brendon's feedback on the visuals:** the wording, whether the dark outlines need to be more visible against the navy, whether the snap onto the cube feels helpful or sticky, the speed of the automatic solve, and the burst and project page look.
2. **Content, one item at a time:** each project's one-line problem, what was built, Brendon's role, tech, and result; then contact links (email, GitHub, LinkedIn, resume). Before building each demo, ask which screens to include.
3. Milestone 6 (reduced motion, phone tuning, performance, loader measurement) and Milestone 7 (launch) as listed in the design doc.

## Running it

```
npm run dev      start the site (open the URL it prints)
npm test         palette contrast and build checks
npm run build    production build into dist/
```

## Loose ends

- Decision pages are still part of the production build; remove them before launch.
- `npm test` runs a full build each time; split that out if it gets slow.
- `contrastRatio` in `palette.js` returns NaN for short hex like `#fff`.
- The dark outline colour is nearly invisible on the navy background (a palette choice still open).
- On phones the "Hang on" line runs under the corner stickers during the moon stretch.
- `prefers-reduced-motion` is not handled yet (Milestone 6).
- The production bundle is about 740 kB before compression (207 kB gzipped), mostly Three.js; measure before deciding on a loader (Milestone 6).
