// Entry point: wires the page text, the scroll journey and the 3D scene together.
import '@fontsource/fredoka/600.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import gsap from 'gsap';
import { applyPalette } from './styles/palette.js';
import { setupScroll } from './scroll/scroll.js';
import { setupTextMotion } from './ui/textMotion.js';
import { createStage } from './scene/stage.js';
import { createWorld } from './scene/world.js';
import { createFpsMeter } from './dev/fps.js';

applyPalette();

const { journey, scrollToWork } = setupScroll();
setupTextMotion();

document.querySelector('#skip-to-work').addEventListener('click', scrollToWork);

// Raw cursor position, -1..1, for the gentle parallax.
const cursor = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  cursor.x = (e.clientX / window.innerWidth) * 2 - 1;
  cursor.y = -((e.clientY / window.innerHeight) * 2 - 1);
});

try {
  const stage = createStage(document.querySelector('#scene'));
  const world = createWorld(stage, {
    hitEl: document.querySelector('#cube-hit'),
    isPhone: window.matchMedia('(pointer: coarse)').matches,
  });
  stage.resize();

  const tickFps = import.meta.env.DEV ? createFpsMeter() : null;

  // GSAP's ticker drives everything, so scroll smoothing and rendering stay in step.
  gsap.ticker.add((time, deltaMs) => {
    world.update(time, Math.min(deltaMs / 1000, 0.1), journey, cursor);
    stage.render();
    tickFps?.();
  });
} catch (error) {
  // No WebGL: the page text still reads fine on the plain background.
  document.documentElement.classList.add('no-webgl');
  console.warn('3D scene could not start:', error);
}
