// The burst's screen effects (HUD label, scan lines, colour flood) and the project page
// that the flood turns into. Only transform and opacity are animated.
import gsap from 'gsap';
import { palette } from '../styles/palette.js';

function build(html) {
  const holder = document.createElement('div');
  holder.innerHTML = html.trim();
  return holder.firstElementChild;
}

// burst: shared { value } object the cube reads; this module tweens it 0 <-> 1.
// onOpen / onClosed: the page pauses and resumes scrolling around the project view.
// onCovered(true|false): the 3D scene can stop drawing while the view hides it.
// onRequestClose: the Back button and Escape ask the page to close (it also tidies the URL).
export function createProjectView({ burst, onOpen, onClosed, onCovered, onRequestClose }) {
  const fx = build(`
    <div class="burst-fx" aria-hidden="true">
      <div class="flood"></div>
      <div class="scanlines"></div>
      <p class="hud"><span class="hud-face"></span><span class="hud-title"></span></p>
    </div>`);

  const view = build(`
    <div class="project-view" role="dialog" aria-modal="true" aria-labelledby="pv-title" data-lenis-prevent hidden>
      <button class="cube-link pv-back" type="button">Back to the cube</button>
      <article class="pv-page">
        <header class="pv-head">
          <h2 id="pv-title" class="pv-title"></h2>
          <p class="pv-summary"></p>
        </header>
        <div class="pv-story">
          <section class="pv-problem">
            <h3 class="pv-label">The problem</h3>
            <p data-field="problem"></p>
          </section>
          <section class="pv-result">
            <h3 class="pv-label">The result</h3>
            <p data-field="result"></p>
          </section>
        </div>
        <figure class="pv-demo">
          <div class="demo-frame">
            <div class="demo-screen"><p></p></div>
          </div>
          <figcaption>Demo with sample data. Not real company information.</figcaption>
        </figure>
        <div class="pv-detail">
          <section>
            <h3 class="pv-label">What I built</h3>
            <p data-field="built"></p>
          </section>
          <section>
            <h3 class="pv-label">My role</h3>
            <p data-field="role"></p>
          </section>
        </div>
        <p class="pv-tech"></p>
      </article>
    </div>`);

  document.body.append(fx, view);

  const flood = fx.querySelector('.flood');
  const scan = fx.querySelector('.scanlines');
  const hud = fx.querySelector('.hud');
  const back = view.querySelector('.pv-back');
  const parts = [...view.querySelectorAll('.pv-head, .pv-problem, .pv-result, .pv-demo, .pv-detail, .pv-tech')];
  gsap.set(hud, { xPercent: -50, yPercent: -50 });

  let current = null;
  let timeline = null;
  let returnFocus = null;

  function fill(project, faceNumber) {
    const theme = palette.cube[project.faceColor];
    view.style.setProperty('--theme', theme);
    flood.style.backgroundColor = theme;
    view.querySelector('.pv-title').textContent = project.title;
    view.querySelector('.pv-summary').textContent = project.summary;
    for (const field of ['problem', 'result', 'built', 'role']) {
      view.querySelector(`[data-field="${field}"]`).textContent = project[field];
    }
    // Draft placeholder until each demo's screens are agreed.
    view.querySelector('.demo-screen p').textContent =
      project.type === 'public-site'
        ? 'A live link or screenshots go here.'
        : 'The clickable demo goes here.';
    view.querySelector('.pv-tech').textContent = project.tech.length
      ? `Built with ${project.tech.join(', ')}.`
      : 'Tech list to come.';
    fx.querySelector('.hud-face').textContent = `face 0${faceNumber}`;
    fx.querySelector('.hud-title').textContent = project.title;
  }

  // The flood is a circle centred on the click, just big enough to reach the farthest corner.
  function placeFlood(origin) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const r = Math.hypot(Math.max(origin.x, w - origin.x), Math.max(origin.y, h - origin.y)) + 4;
    flood.style.width = flood.style.height = `${r * 2}px`;
    flood.style.left = `${origin.x - r}px`;
    flood.style.top = `${origin.y - r}px`;
  }

  function showView() {
    view.hidden = false;
    view.scrollTop = 0;
    back.focus({ preventScroll: true });
  }

  // origin: screen point the colour floods out from. instant: skip the burst (direct links, list).
  function open(project, { origin, faceNumber = 1, instant = false } = {}) {
    if (current) return;
    current = project;
    returnFocus = document.activeElement;
    fill(project, faceNumber);
    placeFlood(origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 });
    onOpen();
    timeline?.kill();

    if (instant) {
      burst.value = 1;
      gsap.set(flood, { scale: 1 });
      gsap.set([scan, hud], { opacity: 0 });
      gsap.set([view, ...parts], { opacity: 1, y: 0 });
      showView();
      onCovered(true);
      return;
    }

    timeline = gsap
      .timeline({ onComplete: () => onCovered(true) })
      // Cubies fly out fast and settle: expo reads as speed with damping.
      .to(burst, { value: 1, duration: 1.1, ease: 'expo.out' }, 0)
      .fromTo(scan, { opacity: 0, yPercent: -2 }, { opacity: 0.55, duration: 0.12, ease: 'none' }, 0)
      .to(scan, { opacity: 0, yPercent: 2, duration: 0.5, ease: 'power2.out' }, 0.12)
      .fromTo(hud, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' }, 0.04)
      .to(hud, { opacity: 0, duration: 0.2, ease: 'power1.in' }, 0.72)
      .fromTo(flood, { scale: 0 }, { scale: 1, duration: 0.7, ease: 'power3.inOut' }, 0.28)
      .call(showView, null, 0.9)
      .fromTo(view, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' }, 0.9)
      .fromTo(
        parts,
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.06 },
        0.95,
      );
  }

  // Back: the same things in reverse, and the cube reassembles in the pose it had.
  function close() {
    if (!current) return;
    timeline?.kill();
    onCovered(false);
    gsap.set([scan, hud], { opacity: 0 });
    timeline = gsap
      .timeline({
        onComplete: () => {
          current = null;
          onClosed();
          returnFocus?.focus?.({ preventScroll: true });
        },
      })
      .to(view, { opacity: 0, duration: 0.2, ease: 'none' }, 0)
      .call(() => (view.hidden = true), null, 0.2)
      .to(flood, { scale: 0, duration: 0.65, ease: 'power3.inOut' }, 0.1)
      .to(burst, { value: 0, duration: 1, ease: 'power3.inOut' }, 0.15);
  }

  back.addEventListener('click', onRequestClose);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current) onRequestClose();
  });

  return { open, close, isOpen: () => current !== null, current: () => current };
}
