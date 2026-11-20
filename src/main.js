// Entry point: wires the page text, the scroll journey, the 3D scene and the project views together.
import '@fontsource/fredoka/600.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import gsap from 'gsap';
import { applyPalette, palette } from './styles/palette.js';
import { setupScroll } from './scroll/scroll.js';
import { setupTextMotion } from './ui/textMotion.js';
import { createFaceLabel } from './ui/faceLabel.js';
import { createFaceButtons } from './ui/faceButtons.js';
import { createProjectView } from './ui/projectView.js';
import { createListView } from './ui/listView.js';
import { createStage } from './scene/stage.js';
import { createWorld } from './scene/world.js';
import { FACES } from './scene/cube/model.js';
import { projects, projectForFace, projectById } from './data/projects.js';
import { createFpsMeter } from './dev/fps.js';

applyPalette();

const { journey, lenis, scrollToWork, jumpToWork } = setupScroll();
setupTextMotion();

const isPhone = window.matchMedia('(pointer: coarse)').matches;
// Each cube face with the project it opens (or null for "Coming soon").
const faces = FACES.map((face) => ({ ...face, project: projectForFace(face.color) }));

let world = null; // stays null if WebGL is not available
let covered = false; // true while a project or the list hides the 3D scene
const burst = { value: 0 }; // 0 = whole cube, 1 = fully burst; tweened by the project view

// Everything behind an open overlay is switched off for keyboard and screen readers.
const pageParts = [document.querySelector('main'), document.querySelector('.corner')];
const setPageInert = (inert) => pageParts.forEach((el) => (el.inert = inert));

// ---- face preview card (pops up above the cube) ----
const label = createFaceLabel(document.querySelector('#face-label'), { isPhone });
function showLabel(index) {
  if (index === null) return label.hide();
  const { color, project } = faces[index];
  label.show(palette.cube[color], project);
}

// ---- project view ----
const view = createProjectView({
  burst,
  onOpen: () => {
    lenis.stop();
    setPageInert(true);
    label.hide();
    sideLabel.classList.remove('is-on');
  },
  onClosed: () => {
    lenis.start();
    setPageInert(false);
  },
  onCovered: (value) => (covered = value),
  onRequestClose: closeProject,
});

// origin: where on screen the colour floods from. instant: no burst (links, list, no 3D).
function openProject(project, { origin, instant = false } = {}) {
  if (view.isOpen()) return;
  const faceIndex = faces.findIndex((face) => face.project === project);
  world?.cube.setBurstFace(faceIndex);
  view.open(project, { origin, faceNumber: faceIndex + 1, instant: instant || !world });
  const hash = `#project/${project.id}`;
  if (location.hash !== hash) history.pushState(null, '', hash);
}

function closeProject() {
  view.close();
  if (location.hash.startsWith('#project/')) {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

// Keeps what is on screen in step with the address bar (direct links, browser back/forward).
function syncToAddress() {
  const project = projectById(location.hash.replace('#project/', ''));
  if (project && !view.isOpen()) {
    jumpToWork();
    openProject(project, { instant: true });
  } else if (!project && view.isOpen()) {
    view.close();
  }
}
window.addEventListener('popstate', syncToAddress);
window.addEventListener('load', () => requestAnimationFrame(syncToAddress));

// ---- list view ----
const list = createListView({
  projects,
  onOpen: () => {
    lenis.stop();
    setPageInert(true);
    covered = true;
  },
  onClose: () => {
    lenis.start();
    setPageInert(false);
    covered = false;
  },
  onPick: (project) => {
    list.close({ immediate: true });
    jumpToWork();
    openProject(project, { instant: true });
  },
});
document.querySelector('#view-list').addEventListener('click', list.open);

// Without 3D there is no cube to skip to, so the sticker opens the list instead.
document.querySelector('#skip-to-work').addEventListener('click', () => (world ? scrollToWork() : list.open()));

// ---- keyboard access to the faces ----
const screenCentre = () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
createFaceButtons(document.querySelector('#face-buttons'), faces, {
  onFocus: (index) => {
    if (world && !world.cube.isInHold()) scrollToWork();
    world?.cube.focusFace(index);
    showLabel(index);
  },
  onBlur: () => {
    world?.cube.focusFace(null);
    label.hide();
  },
  onOpen: (index) => {
    const { project } = faces[index];
    if (!project) return;
    const inHold = world?.cube.isInHold();
    if (!inHold) jumpToWork();
    openProject(project, { origin: screenCentre(), instant: !inHold });
  },
});

// Raw cursor position, -1..1, for the gentle parallax.
const cursor = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  cursor.x = (e.clientX / window.innerWidth) * 2 - 1;
  cursor.y = -((e.clientY / window.innerHeight) * 2 - 1);
});

// "Coming Soon" sticker for the two side puzzles. Only its transform changes as it follows them.
const sideLabel = document.querySelector('#side-label');
function showSideLabel(point) {
  if (point) {
    sideLabel.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -100%) rotate(-3deg)`;
  }
  sideLabel.classList.toggle('is-on', point !== null);
}

try {
  const stage = createStage(document.querySelector('#scene'));
  world = createWorld(stage, {
    hitEl: document.querySelector('#cube-hit'),
    isPhone,
    burst,
    onLabel: showLabel,
    onSideLabel: showSideLabel,
    // Returns true if the face opened a project; "Coming soon" faces just give a small nudge.
    onFaceClick: (index, point) => {
      const { project } = faces[index];
      if (!project) return false;
      openProject(project, { origin: point });
      return true;
    },
  });
  stage.resize();

  const tickFps = import.meta.env.DEV ? createFpsMeter() : null;

  // GSAP's ticker drives everything, so scroll smoothing and rendering stay in step.
  gsap.ticker.add((time, deltaMs) => {
    tickFps?.();
    if (covered) return; // nothing to draw while a project or the list covers the scene
    world.update(time, Math.min(deltaMs / 1000, 0.1), journey, cursor);
    stage.render();
  });
} catch (error) {
  // No WebGL: the page text still reads fine on the plain background, and the list has the work.
  world = null;
  document.documentElement.classList.add('no-webgl');
  console.warn('3D scene could not start:', error);
}
