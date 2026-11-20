# PRD: Moon Cube Portfolio

> **For Claude Code.** Read this whole file before writing code. Follow the **Working Agreement** (section 1) and the **Questions to Ask Me First** (section 2). Do not guess content. Ask me.

---

## 1. Working Agreement

- I am a UBC business + CS student. I know front-end basics, Git/GitHub, Supabase, and JS. Explain decisions briefly, in plain language.
- Build in the **milestones** order (section 12). Stop after each milestone, show me how to run it, and wait for my feedback before moving on.
- **Never use real company data.** All work shown comes from my job at Concord (internal apps such as the truck production tracker and inventory system). Only use **fake, static prototypes** (section 8). Do not connect to any real database, API, Supabase project, or Google Sheet. Do not ask me to paste real data.
- **Smooth, clean animation is the top priority** (section 9). If a feature hurts smoothness, simplify it.
- Keep code simple and readable. Put all project content in one data file (section 7) so I can add projects without touching scene code.

---

## 2. Questions to Ask Me First

Before building project content, **ask me these questions** (one batch, wait for answers):

1. **Which sites/projects do I want to show?** List the project candidates you can think of from the context (e.g. truck production tracker, inventory system with barcode workflow, any local business websites I built, any other internal tools) and ask me to pick. Also ask if there are any I did not mention.
2. For each chosen project: one-line problem, what I built, my role, tech used, and the result (numbers if safe).
3. For each chosen project, **is it an internal app (needs a fake static prototype) or a public website (can link live)?**
4. Do I have screenshots, or should you design the prototype UI from my description? Remind me to blank out or replace anything real.
5. Is there anything I must not show (client names, part numbers, prices, employee names)? Default: **show none of it**, use invented names.
6. How many cube faces do I want filled at launch (max 6)? Remaining faces say "Coming soon".
7. Contact links: email, GitHub, LinkedIn, resume file.
8. Do I want sound (optional, off by default)?
9. Any font or color preferences after seeing the type test (section 6)?

Do not start Milestone 4 (project content) until I answer 1-3.

---

## 3. Overview

A single-page, scroll-driven 3D portfolio.

1. It opens in space with a short **About Me** floating among cute space objects.
2. Scrolling descends past planets, a satellite, asteroids, and comets to the **moon**.
3. A **scrambled Rubik's cube is wedged in the moon**. Scrolling frees it, floats it upward, and **solves it** (scroll controls the solve).
4. When solved, the visitor can **drag to spin it**. Each colored face is a project.
5. **Clicking a face** makes the cube **explode** into solid cube pieces plus particles in that face's color, then opens that project's page.

Feel: **cute, handmade, smooth, polished.** Not a generic AI-looking site.

---

## 4. Goals and Non-Goals

**Goals**
- Strong first impression in one second.
- Show Concord projects (as safe prototypes) and make future projects easy to add.
- Smooth, clean animation at 60 fps on a mid-range laptop.
- A distinct, human-made look (section 6).

**Non-goals**
- No backend, CMS, login, or real data.
- No game mechanics beyond spinning the cube.
- No photorealism.

---

## 5. Experience Flow

| # | Section | What happens |
|---|---------|--------------|
| 0 | Loader (**conditional**) | Only build if assets are heavy (see 10). A small Rubik's cube solves as real load progress rises, with a percentage. Ends with an "Enter" button. |
| 1 | About (floating in space) | Name, role, 2-3 short lines. Text floats among space objects, gentle drift, subtle cursor parallax. |
| 2 | Descent | Scroll moves the camera past space objects. Short floating notes cover skills/story. No card grids. |
| 3 | Moon + scrambled cube | Camera reaches the moon. Scrambled cube is wedged in a crater. Scroll frees it, floats it up, and plays the solve (the scramble moves in reverse), tied to scroll progress. |
| 4 | Explore mode | Cube solved. Scroll hands off to drag/touch rotation with soft inertia. Hint: "drag to look around". Hover lifts/glows a face and shows its title. |
| 5 | Burst | Click a face: cube splits into **solid cubies** (the 27 small cubes) plus shards and particles in the face color. A little futuristic: clean geometric shards, thin scan lines, a brief HUD-style label. The face color floods the screen and becomes the project theme. |
| 6 | Project view | Title, problem, what I built, tech, my role, result, and the **interactive static prototype** (section 8). Back button reassembles the cube. |
| 7 | Outro | Contact links, resume, "more projects coming". |

---

## 6. Art Direction (important: avoid the AI-generated look)

Use this as a checklist on every change.

**Do not use**
- Purple-to-blue gradients, neon glow on black, glassmorphism/frosted cards, gradient text.
- Inter/Roboto/system fonts, emoji or stock icon sets as decoration.
- Identical rounded-card grids, centered hero with subtitle + two buttons, sparkle icons.
- Generic filler copy. Write microcopy in a friendly first-person voice and ask me for wording.

**Do use**
- **Palette:** deep ink-navy space, warm cream, moon-grey, and 5-6 chunky saturated cube colors. Flat color with subtle grain, not glow.
- **Type:** big, bubbly display font. Candidates: Fredoka, Baloo 2, Bagel Fat One, Grandstander. Body: Nunito or similar. **Build a quick type test page first and let me pick.**
- **Space objects:** cute, chunky, toy-like or low-poly: moon, ringed planet, small planet, satellite, asteroids, comet, stars, dust.
- Hand-made touches: slightly wobbly outlines, sticker-style labels, small imperfections.
- The "futuristic" look appears **only** in the burst.

---

## 7. Content and Data

Put everything in one file, for example `src/data/projects.js`:

```
{
  id, title, faceColor, summary,
  problem, built, role, tech: [], result,
  type: "internal-prototype" | "public-site",
  prototype: "path or component name",   // for internal apps
  liveUrl: "..."                          // for public sites only
}
```

Adding a project = add one object. No scene code changes. Unused faces render "Coming soon".

---

## 8. Internal App Prototypes (no real data)

Internal apps (truck production tracker, inventory system, etc.) are shown as **static, front-end-only mock prototypes**.

Rules:
- Build them as plain HTML/CSS/JS (or small components) with **hard-coded fake data**. No network calls, no Supabase client, no keys.
- Use **invented** names, part numbers, truck IDs, quantities, and dates. Do not copy real values from any screenshot I provide. If I give screenshots, recreate the layout and replace all content.
- Keep the real workflow recognizable (e.g. production stages on a board, barcode scan adds stock) but make it clearly a demo.
- Show a small label: "Demo with sample data. Not real company information."
- Make them lightly interactive (click a stage to move a truck, simulated scan adds an item). Keep it simple and smooth.
- Display inside the project view in a clean framed window (browser or tablet mockup in the site's own style, not a generic glossy mockup).
- Before building each prototype, ask me which screens/features to include.

For public websites I built: link live or embed a screenshot/video. Ask me which.

---

## 9. Animation Principles (smooth and clean)

- Animate **only** `transform` and `opacity` for DOM; for 3D, animate object transforms and uniforms. Avoid layout-triggering properties.
- Use **GSAP + ScrollTrigger** with `scrub` (small smoothing value) and a smooth-scroll library (Lenis) synced to GSAP's ticker.
- Prefer **gentle easing** (power2/power3 out, expo for the burst). No jitter, no abrupt jumps, no bouncy overuse.
- One main motion at a time. Stagger text reveals subtly (SplitText-style, or equivalent).
- Cube solve = scramble moves reversed, driven by scroll progress, so scrolling back un-solves smoothly.
- Scroll-to-drag handoff must feel seamless. Prototype this early.
- Burst: cubies get outward velocity + spin with easing out and slight damping; shards and particles fade; reassemble smoothly on Back.
- Cap pixel ratio (about 2), reuse geometries/materials, use instancing for particles, dispose resources on teardown.
- Target 60 fps desktop, 30+ fps recent phones. Add a simple FPS check in dev.

---

## 10. Requirements

**Functional**
- Scroll-scrubbed camera path, moon release, and cube solve.
- Cube made of 27 cubies; six faces mapped to projects from the data file.
- Raycast click/tap, hover states, drag/touch rotation with inertia.
- Burst effect and project view with back-to-cube.
- Space background objects with depth parallax.
- Optional sound toggle (off by default).
- **Loader (conditional):** measure first-load size/time. If assets exceed roughly 5 MB or load takes longer than about 2 s, add the Rubik's cube loader driven by real loading progress (Three.js LoadingManager), not a fake timer. Otherwise skip it and tell me.

**Non-functional**
- **Mobile:** touch drag, fewer particles, shorter descent.
- **Reduced motion:** honor `prefers-reduced-motion` with a simplified version.
- **Accessibility:** real HTML text, keyboard-operable faces, visible focus, a "view projects as a list" link.
- **SEO/sharing:** meta tags, Open Graph image, crawlable text.
- **Performance budget:** compressed glTF (Draco/KTX2), baked lighting where possible, lazy-load project media and prototypes.

---

## 11. Tech Stack

| Area | Choice |
|------|--------|
| 3D | Three.js (vanilla, no React unless I ask) |
| Animation | GSAP + ScrollTrigger, Lenis |
| Build | Vite |
| Models | Blender or procedural geometry; compressed glTF |
| Content | `projects.js` data file |
| Deploy | Vercel or Netlify |

If you want a different choice, explain why and ask me first.

---

## 12. Milestones (stop and check in after each)

1. **Setup + art direction:** Vite project, type test page, palette, storyboard sketch. Ask me questions in section 2 (items 1-3, 9).
2. **About + descent:** floating About text, space objects, scroll-driven camera path.
3. **Moon + cube solve:** wedged scrambled cube, scroll release, scroll-driven solve, drag handoff.
4. **Explore + faces:** hover, click, face-to-project mapping. **Project content starts here, after my answers.**
5. **Burst + project view:** explosion, color flood, project panel, back button. Build static prototypes (section 8).
6. **Polish:** conditional loader, mobile, reduced motion, performance pass.
7. **Launch:** accessibility, SEO, real-device QA, deploy.

---

## 13. Risks

| Risk | Mitigation |
|------|------------|
| Scope creep | Finish milestones 1-5 first. Sound, extra objects, and loader are stretch. |
| Accidentally exposing company info | Fake data only (section 8). Ask me before using any screenshot. |
| Janky animation | Follow section 9. Profile after each milestone. |
| Phone performance | Device-tier particle budgets and a fallback mode. |
| Looks generic | Use the section 6 checklist in every review. |

---

## 14. Definition of Done

- Runs smoothly at target frame rates, with no console errors.
- Every shown project uses fake/static data or is a public site I approved.
- At least the projects I selected are live, and other faces say "Coming soon".
- I can add a new project by editing only the data file.
- Passes the section 6 checklist and the accessibility basics.
