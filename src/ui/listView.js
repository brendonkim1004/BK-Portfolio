// "View as list": the same projects as plain HTML, for anyone who would rather not
// play with the cube. It is built from the same data file as the cube faces.
import gsap from 'gsap';
import { palette } from '../styles/palette.js';

// onPick(project) opens a project. onOpen / onClose let the page pause and resume scrolling.
export function createListView({ projects, totalFaces, onPick, onOpen, onClose }) {
  const view = document.createElement('div');
  view.className = 'list-view';
  view.hidden = true;
  view.setAttribute('role', 'dialog');
  view.setAttribute('aria-modal', 'true');
  view.setAttribute('aria-labelledby', 'lv-title');
  view.setAttribute('data-lenis-prevent', '');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'sticker lv-close';
  closeButton.textContent = 'back to space';

  const page = document.createElement('div');
  page.className = 'lv-page';

  const title = document.createElement('h2');
  title.id = 'lv-title';
  title.className = 'lv-title';
  title.textContent = 'The work'; // draft wording

  const list = document.createElement('ol');
  list.className = 'lv-list';
  for (const project of projects) {
    const item = document.createElement('li');
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'lv-row';

    const swatch = document.createElement('span');
    swatch.className = 'lv-swatch';
    swatch.style.backgroundColor = palette.faces[project.faceColor];

    const text = document.createElement('span');
    text.className = 'lv-text';
    const name = document.createElement('span');
    name.className = 'lv-name';
    name.textContent = project.title;
    const summary = document.createElement('span');
    summary.className = 'lv-summary';
    summary.textContent = project.summary;
    text.append(name, summary);

    row.append(swatch, text);
    row.addEventListener('click', () => onPick(project));
    item.append(row);
    list.append(item);
  }

  page.append(title, list);

  const blank = totalFaces - projects.length;
  if (blank > 0) {
    const more = document.createElement('p');
    more.className = 'lv-more';
    more.textContent = `${blank} more ${blank === 1 ? 'face is' : 'faces are'} still blank. Coming soon.`; // draft wording
    page.append(more);
  }

  view.append(closeButton, page);
  document.body.append(view);

  let isOpen = false;
  let returnFocus = null;

  function open() {
    if (isOpen) return;
    isOpen = true;
    returnFocus = document.activeElement;
    onOpen();
    view.hidden = false;
    view.scrollTop = 0;
    gsap.fromTo(view, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
    gsap.fromTo(
      [title, ...list.children],
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger: 0.06, delay: 0.1 },
    );
    closeButton.focus({ preventScroll: true });
  }

  // immediate: skip the fade, used when a project is about to cover the screen anyway.
  function close({ immediate = false } = {}) {
    if (!isOpen) return;
    isOpen = false;
    const done = () => {
      view.hidden = true;
      onClose();
      if (!immediate) returnFocus?.focus?.({ preventScroll: true });
    };
    if (immediate) done();
    else gsap.to(view, { opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: done });
  }

  closeButton.addEventListener('click', () => close());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) close();
  });

  return { open, close, isOpen: () => isOpen };
}
