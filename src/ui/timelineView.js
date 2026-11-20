// The career timeline popup: a small card where a pixel student walks along a dotted path,
// each job pops up as a bubble when he reaches it, and he stops at the last one: where I am now.
// Only transform and opacity are animated.
import gsap from 'gsap';
import { palette } from '../styles/palette.js';
import { sprite } from './pixelArt.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// stops: the list in src/data/timeline.js. onOpen / onClose pause and resume the page behind.
// sound is optional: { play(name) }.
export function createTimelineView({ stops, onOpen, onClose, sound }) {
  const view = el('div', 'timeline-view');
  view.hidden = true;
  view.setAttribute('role', 'dialog');
  view.setAttribute('aria-modal', 'true');
  view.setAttribute('aria-labelledby', 'tl-title');
  view.setAttribute('data-lenis-prevent', '');

  const card = el('div', 'tl-card');
  const closeButton = el('button', 'cube-link tl-close', 'Close');
  closeButton.type = 'button';
  const title = el('h2', 'tl-title', 'My timeline'); // draft wording
  title.id = 'tl-title';

  // The scene: the path, the stops along it, and the student who walks it.
  const scene = el('div', 'tl-scene');
  const track = el('div', 'tl-track');
  const trackFill = el('div', 'tl-track-fill');
  track.append(trackFill);

  const list = el('ol', 'tl-stops');
  const parts = stops.map((stop) => {
    const item = el('li', 'tl-stop');
    if (stop.now) item.classList.add('is-now');
    const dot = el('span', 'tl-dot');
    const fill = el('span', 'tl-dot-fill');
    fill.style.backgroundColor = palette.cube[stop.color];
    dot.append(fill);
    const bubble = el('div', 'tl-bubble');
    bubble.append(sprite(stop.prop), el('p', 'tl-role', stop.role), el('p', 'tl-place', stop.place), el('p', 'tl-dates', stop.dates));
    item.append(dot, bubble);
    list.append(item);
    return { dot, fill, bubble };
  });

  const walker = el('div', 'tl-walker');
  const body = el('div', 'tl-walker-body');
  body.append(sprite('studentA'), sprite('studentB'));
  walker.append(body);
  walker.setAttribute('aria-hidden', 'true'); // decoration: the bubbles carry the information

  scene.append(track, list, walker);
  card.append(closeButton, title, scene);
  view.append(card);
  document.body.append(view);

  let isOpen = false;
  let returnFocus = null;
  let story = null; // the running animation

  // Builds the walk from where the dots actually are on screen, so one piece of code covers
  // the sideways layout (wide screens) and the downward one (phones).
  function buildStory() {
    story?.kill();
    const box = scene.getBoundingClientRect();
    const points = parts.map(({ dot }) => {
      const r = dot.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    });
    const first = points[0];
    const last = points[points.length - 1];
    const downward = Math.abs(last.x - first.x) < Math.abs(last.y - first.y);
    const length = downward ? last.y - first.y : last.x - first.x;

    // The dotted path runs from the first dot to the last; its solid "walked" part grows with him.
    Object.assign(track.style, downward
      ? { left: `${first.x}px`, top: `${first.y}px`, width: '', height: `${length}px` }
      : { left: `${first.x}px`, top: `${first.y}px`, width: `${length}px`, height: '' });
    track.classList.toggle('is-downward', downward);
    const grow = downward ? 'scaleY' : 'scaleX';

    // The student stands on top of the dot at each point.
    const lift = parts[0].dot.offsetHeight / 2 - 2;
    const feet = (p) => ({ x: p.x - walker.offsetWidth / 2, y: p.y - walker.offsetHeight - lift });
    const start = downward ? { x: first.x, y: first.y - 56 } : { x: first.x - 80, y: first.y };

    gsap.set(walker, { ...feet(start), opacity: 0 });
    gsap.set(trackFill, { [grow]: 0, [downward ? 'scaleX' : 'scaleY']: 1 });
    gsap.set(parts.map((p) => p.fill), { scale: 0 });
    gsap.set(parts.map((p) => p.bubble), { opacity: 0, scale: 0.6 });

    const walking = (on) => () => walker.classList.toggle('is-walking', on);
    story = gsap.timeline({ delay: 0.35 });
    story.to(walker, { opacity: 1, duration: 0.2 }).call(walking(true));
    points.forEach((point, i) => {
      const travelled = (downward ? point.y - first.y : point.x - first.x) / length;
      const duration = i === 0 ? 0.6 : 1.05;
      story
        .to(walker, { ...feet(point), duration, ease: 'none' })
        .to(trackFill, { [grow]: travelled, duration, ease: 'none' }, '<')
        .call(walking(false))
        .call(() => sound?.play('type'))
        .to(parts[i].fill, { scale: 1, duration: 0.35, ease: 'back.out(3)' })
        .to(parts[i].bubble, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, '<');
      if (i < points.length - 1) story.call(walking(true), null, '+=0.15');
    });
    // Arrived at "now": he bounces on the spot.
    story.call(() => sound?.play('solved')).call(() => walker.classList.add('is-home'));

    // People who ask for less motion see the finished picture straight away.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) story.progress(1);
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    returnFocus = document.activeElement;
    onOpen();
    view.hidden = false;
    card.scrollTop = 0;
    walker.classList.remove('is-walking', 'is-home');
    // Measure and build the walk first, while the card is at its real size; then pop the card in.
    gsap.set(card, { scale: 1, y: 0 });
    buildStory();
    gsap.fromTo(view, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
    gsap.fromTo(card, { scale: 0.92, y: 20 }, { scale: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)' });
    closeButton.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    gsap.to(view, {
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: () => {
        story?.kill();
        view.hidden = true;
        onClose();
        returnFocus?.focus?.({ preventScroll: true });
      },
    });
  }

  closeButton.addEventListener('click', close);
  view.addEventListener('click', (e) => {
    if (e.target === view) close(); // a click on the dimmed area around the card
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) close();
  });
  // If the window changes shape while it is open, lay the path out again and show the end.
  window.addEventListener('resize', () => {
    if (!isOpen) return;
    walker.classList.remove('is-walking');
    buildStory();
    story.progress(1);
  });

  return { open, close, isOpen: () => isOpen };
}
