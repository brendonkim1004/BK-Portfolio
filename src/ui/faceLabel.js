// The preview card for a cube face. It pops up just above the cube (CSS places it there)
// with a small sketch of the project, its title and its one-line summary.
// Faces with no project get a plain "Coming Soon" card.
import { previewSketch } from './previews.js';

export function createFaceLabel(el, { isPhone = false } = {}) {
  const card = document.createElement('div');
  card.className = 'face-card';
  const thumb = document.createElement('div');
  thumb.className = 'face-card-thumb';
  const text = document.createElement('div');
  text.className = 'face-card-text';
  const title = document.createElement('p');
  title.className = 'face-card-title';
  const summary = document.createElement('p');
  summary.className = 'face-card-summary';
  const hint = document.createElement('p');
  hint.className = 'face-card-hint';
  hint.textContent = isPhone ? 'Tap to open' : 'Click to open'; // draft wording
  text.append(title, summary, hint);
  card.append(thumb, text);
  el.append(card);

  let showing = null; // what the card currently holds, so repeat calls while hovering cost nothing

  return {
    // hex: the face colour. project: the face's project, or null for "Coming Soon".
    show(hex, project) {
      const key = project ? project.id : `empty-${hex}`;
      if (showing !== key) {
        showing = key;
        card.style.setProperty('--card-theme', hex);
        card.classList.toggle('is-empty', !project);
        title.textContent = project ? project.title : 'Coming Soon';
        summary.textContent = project ? project.summary : '';
        thumb.innerHTML = project ? previewSketch(project.preview) : '';
      }
      el.classList.add('is-on');
    },
    hide() {
      el.classList.remove('is-on');
    },
  };
}
