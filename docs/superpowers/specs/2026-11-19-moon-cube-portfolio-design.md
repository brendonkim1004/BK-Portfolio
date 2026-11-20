# Moon Cube Portfolio: Design

Source PRD: `C:\Users\brend\OneDrive - UBC\CodingTest\BKProjects\Moon_Cube_Portfolio_PRD.md`. The PRD stays the reference for anything not restated here. Where this doc and the PRD differ, this doc wins (it records decisions made after the PRD).

## Context

Brendan (UBC business + CS) wants a portfolio that lands with **business / product hiring** (PM, ops, consulting-type roles). The site is a scroll journey through toy-like space to the moon, where a scrambled Rubik's cube frees itself and solves as you scroll; each face opens a project. The work shown is from his job at Concord and must only ever appear as fake-data demos. The folder is empty apart from the PRD, so this is a new build.

## Goals, non-goals, anti-goals

- **Goals:** memorable in the first second; smooth 60 fps on a mid-range laptop; a handmade, cute look; a business reader gets to "problem and result" fast; adding a project means editing one data file.
- **Non-goals:** backend, CMS, login, real data, photorealism, game mechanics beyond spinning the cube.
- **Anti-goals (failure even if it works):** any real Concord data on screen; janky or stuttering motion; the generic AI look (PRD section 6 "do not use" list); a visitor in a hurry never reaching the work or the contact links.

## Decisions Brendan made

1. **Audience:** business / product roles.
2. **After the solve, scroll never locks.** The solved cube holds in place for about one screen of scroll while drag spins it. Scrolling on drifts the camera up past the cube to the outro. Scrolling back un-solves it.
3. **3D objects are built in code** (approach A below).
4. **Launch projects:** Truck production tracker, Inventory + barcode system, Concord Online Store, Concord pre-owned pumps store. Remaining faces say "Coming soon".

## Approaches considered (for how the 3D objects get made)

- **A. All in code (chosen).** Objects assembled from simple shapes with flat toy shading. Nothing to download, near-instant load, easy to tweak. Shapes stay simple, which suits the look.
- **B. Blender models.** More character, but about seven objects to model, a few MB of downloads, and a loader becomes necessary.
- **C. Code plus one Blender hero object.** Kept open for later: each object lives in its own module with the same interface, so the moon can be swapped for a glTF without touching anything else.
- Ruled out: pre-rendered video scrub (the cube must be draggable and clickable).

## My calls (not yet confirmed by Brendan; correct any)

- **Project location:** outside OneDrive, e.g. `C:\Users\brend\Projects\moon-cube-portfolio`, as a git repo pushed to GitHub. OneDrive syncs `node_modules` badly and can lock files mid-build. Confirm the path before scaffolding. Copy the PRD and this design in (`docs/`).
- **Project pages lead with the story:** problem and result first, then the demo, with tech as a small footnote.
- **Short descent:** about 4 to 5 screens of scroll before the moon on desktop, about 3 on phones. Floating notes show how he thinks (business plus CS), not a skills list.
- **Always-visible stickers:** "skip to the work" (scrolls to the solved cube) and "view as list".
- **Shareable project links:** opening a project sets `#project/<id>`; loading that URL opens the project directly.
- **Handoff is proven early:** Milestone 2 includes a plain grey box standing in for the cube to test scroll, hold, drag, and outro before any cube art exists (PRD section 9 says to prototype this early).
- **Gentle snap onto the cube:** a fast trackpad flick can carry someone straight past a one-screen hold. The hold is about 1.5 screens and scroll settles softly onto it when it stops nearby. It never traps: any further scroll moves on. Tuned in the Milestone 2 grey-box test; if the snap feels sticky, drop it and lengthen the hold to 2 to 3 screens.
- **Phones have no hover:** on touch, the face turned toward the viewer always shows its title sticker (or "Coming soon"), so a tap opens a project the visitor can already name.
- **Loader:** expected to be skipped, since approach A has almost nothing to download. Measure in Milestone 6 and report.
- **Sound:** stretch, off by default, decided in Milestone 6.

## How it works

**Stack (per PRD):** Vite, vanilla Three.js, GSAP (ScrollTrigger, SplitText), Lenis. No other runtime dependencies.

**Page structure.** One fixed full-screen canvas behind real HTML. The HTML is ordinary sections in scroll order (about, descent notes, cube hold, outro), so text is crawlable and readable without WebGL. Lenis drives scroll and is synced to GSAP's ticker. Each stretch of the journey (descent, release + solve, hold, drift to outro) is its own scrubbed ScrollTrigger tied to its own HTML section's measured start and end, so the 3D stays lined up with the text on any screen size. Sections are sized in `svh` and ScrollTrigger is set to `ignoreMobileResize`, so the phone URL bar does not shift things. The canvas sits behind the HTML and never receives pointer events itself: hover, click and drag listen on the window and on the cube hit element described below.

**Scroll map (desktop):**

```
about | descent (notes float by) | moon: release + solve | HOLD: drag to spin | outro
 1 screen      ~3 screens              ~2 screens            ~1.5 screens       1 screen
```

**Space objects.** Each object is one module in `src/scene/objects/` exporting `create()` (returns a Group) and an optional `update(time)` for idle drift. Look: flat toon shading with two or three tone steps, a slightly wobbly dark outline (inverted-hull shell with small vertex offsets, built from a copy of the geometry with merged, averaged normals so it does not split at hard corners; cubies are rounded boxes), and a static grain overlay in CSS. Stars and dust are a single Points cloud. Depth parallax comes from real distance along the camera path plus a small cursor offset on the camera.

**Cube.** 27 cubies in a group. The scramble is a fixed list of about 12 to 14 face turns, so the solve is the same every visit. At startup, compute and store every cubie's position and rotation after each move. Solve progress `p` (0 to 1) then maps to "snapshot i, plus the layer for move i turned by an eased fraction of 90 degrees". The turning layer rotates about the cube centre (position and rotation together), and each stored snapshot is rounded to exact quarter-turns so no error builds up. The cube's state is a pure function of scroll progress, so scrolling back un-solves with no extra code and no drift. Release from the crater (wiggle, lift, dust puff) occupies the first part of the same stretch.

**Hold and drag.** Drag is live only while scroll is inside the hold stretch. It rotates a parent group around the cube with soft inertia. Leaving the hold stretch in either direction eases that group back to its rest orientation, so the un-solve and the outro drift always start from a known pose. A pointer that moves less than about 6 px counts as a click, not a drag. On touch, a transparent element sized to the cube's on-screen bounds, sitting above the sections and enabled only during the hold, has `touch-action: none`, so a drag that starts on the cube spins it and a drag anywhere else scrolls the page.

**Faces.** Six face colours map to projects by `faceColor` in the data file. Hover (or keyboard focus) lifts that face's nine stickers slightly and shows an HTML sticker label with the title. A visually hidden list of real buttons, one per face, gives keyboard access: focusing a button turns the cube to that face, Enter opens it. Faces with no project show "Coming soon" and do not burst.

**Burst and project view.** The burst is one tweened value from 0 to 1 layered on top of the cube's scroll pose: each cubie has a precomputed outward direction and spin, so Back is the same tween reversed and a resize or refresh mid-project cannot break it. On click: cubies fly outward with spin (expo ease out, reading as velocity with damping), instanced shards and particles in the face colour fade out, a brief HUD-style label and thin scan lines appear (the only futuristic moment on the site), and a full-screen colour layer scales up using transform only. The project view is an HTML overlay themed with the face colour. Lenis is paused while it is open, and the overlay is its own scroll container marked `data-lenis-prevent` so long project pages still scroll. Back reverses the sequence and reassembles the cube in the pose it had. A direct `#project/<id>` link jumps the page to the hold stretch, shows the project without playing the burst, and plays only the reassembly on Back.

**Project content and demos.** `src/data/projects.js` holds everything in the PRD section 7 shape. Each internal app's demo is a small self-contained module in `src/prototypes/<id>/` with hard-coded invented data, loaded on demand when its project opens, and shown inside a framed window drawn in the site's own style with the label "Demo with sample data. Not real company information." No network calls anywhere in the site. How the two stores appear (live link, screenshot, or fake-data demo) is an open question below.

**List view, reduced motion, no WebGL.** One plain HTML projects list generated from the same data file serves all three: the "view as list" sticker, `prefers-reduced-motion` (static scene, solved cube, no scrub or burst, fades only), and browsers where WebGL fails.

**Performance.** Pixel ratio capped at 2; shared geometries and materials; instancing for particles; rendering paused when the tab is hidden or the project view covers the canvas; phones get fewer particles and stars and a shorter scroll length. A dev-only FPS readout is on from Milestone 2.

**File layout (inside the new project folder):**

```
index.html            type-test.html
src/main.js
src/data/projects.js
src/scroll/           Lenis setup, master timeline
src/scene/            renderer, camera path, materials (toon + outline)
src/scene/objects/    moon, ringedPlanet, smallPlanet, satellite, asteroids, comet, stars
src/scene/cube/       cube model, scramble + snapshots, solve, drag, faces, burst
src/ui/               project view, stickers, list view, demo frame
src/prototypes/       one folder per internal-app demo
src/styles/
```

## Milestones

Same order as PRD section 12, stopping for feedback after each. Changes from the PRD: the grey-box handoff test moves into Milestone 2, and the list view is built in Milestone 4 alongside the faces (it shares their data).

1. **Setup + art direction:** confirm the project path, scaffold Vite, type test page (Fredoka, Baloo 2, Bagel Fat One, Grandstander with Nunito body), palette swatches, storyboard. Ask the open questions below.
2. **About + descent:** floating About text, space objects, scroll-driven camera, grey-box handoff test, FPS readout.
3. **Moon + cube solve:** crater, wedged cube, release, scroll-driven solve, real drag in the hold stretch.
4. **Explore + faces:** hover, focus, click, face mapping, list view, project data.
5. **Burst + project view:** burst, colour flood, project overlay, back, deep links, demos (ask which screens before building each).
6. **Polish:** phones, reduced motion, performance pass, loader measurement, sound decision.
7. **Launch:** accessibility, meta tags and share image, real-device check, deploy to Vercel or Netlify.

## Open questions for Brendan (asked in Milestone 1, needed before Milestone 4)

From PRD section 2, still unanswered:

- For each of the four projects: one-line problem, what he built, his role, tech, result (numbers only if safe).
- **The two stores:** are they public sites that can be linked live, or should they be fake-data demos too? Are they one cube face or two?
- Screenshots, or design the demo UI from description? (Anything real must be blanked or replaced.)
- Anything that must not be shown. Default: none of it, invented names throughout.
- Contact links: email, GitHub, LinkedIn, resume file.
- Font and colour picks after seeing the type test.

## Left to the builder

Exact camera path, object placement and counts, easing values, the scramble move list, particle counts per device tier, palette hex values (proposed in Milestone 1 for approval), and microcopy drafts (written in a friendly first-person voice and shown to Brendan for wording, never shipped as filler).

## Verification

- **Each milestone:** `npm run dev`, walk the full scroll forward and backward, check the FPS readout stays near 60 on the laptop, and check the browser console is empty.
- **Solve:** scrub up and down repeatedly through the solve and hold; the cube must return to exactly the same scrambled and solved poses every time.
- **Handoff:** in the hold stretch, wheel scrolls and drag spins on desktop; in Chrome's phone emulation, drag on the cube spins and drag elsewhere scrolls.
- **Burst:** open and close every filled face several times; the cube reassembles cleanly and "Coming soon" faces do not open.
- **Data safety:** DevTools Network tab shows no requests beyond the site's own files and fonts; every demo shows the sample-data label.
- **Extensibility:** add a fifth object to `projects.js` and confirm a new face fills with no other code changes.
- **Fallbacks:** emulate `prefers-reduced-motion`; tab through faces with the keyboard; open a `#project/<id>` link directly.
- **Before launch:** `npm run build`, check total download size (decides the loader), run Lighthouse, test on a real phone.

## Next step after approval

Save this design into the new repo at `docs/superpowers/specs/2026-11-19-moon-cube-portfolio-design.md`, then write the step-by-step implementation plan for Milestone 1 (and each later milestone as it comes up).
