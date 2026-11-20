// Type test page: the same specimen in four display fonts, plus the proposed palette.
// A decision page only. Nothing here ships in the real site.
import '@fontsource/fredoka/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/bagel-fat-one/latin-400.css';
import '@fontsource/grandstander/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import './decisionPages.css';
import { palette, applyPalette } from '../styles/palette.js';

export const displayFonts = [
  { id: 'fredoka', label: 'Fredoka', family: 'Fredoka', weight: 600 },
  { id: 'baloo-2', label: 'Baloo 2', family: 'Baloo 2', weight: 700 },
  { id: 'bagel-fat-one', label: 'Bagel Fat One', family: 'Bagel Fat One', weight: 400 },
  { id: 'grandstander', label: 'Grandstander', family: 'Grandstander', weight: 700 },
];

const stickers = [
  { text: 'Truck tracker', face: 'red', tilt: -3 },
  { text: 'Inventory', face: 'orange', tilt: 2 },
  { text: 'Online store', face: 'yellow', tilt: -1.5 },
  { text: 'Pumps store', face: 'green', tilt: 3 },
  { text: 'Coming soon', face: 'blue', tilt: -2 },
  { text: 'Coming soon', face: 'pink', tilt: 1.5 },
];

// Small helper: el('p', { class: 'x', style: {...} }, 'text' | [children])
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'style') Object.assign(node.style, value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) node.append(child);
  return node;
}

function swatchList() {
  const flat = [
    ['ink', palette.ink],
    ['inkDeep', palette.inkDeep],
    ['cream', palette.cream],
    ['moon', palette.moon],
    ['moonShade', palette.moonShade],
    ['outline', palette.outline],
    ...Object.entries(palette.faces).map(([name, hex]) => [`face: ${name}`, hex]),
  ];
  return el(
    'ul',
    { class: 'swatches' },
    flat.map(([name, hex]) =>
      el('li', { class: 'swatch' }, [
        el('div', { class: 'swatch-chip', style: { background: hex } }),
        name,
        el('span', { class: 'swatch-hex' }, hex),
      ]),
    ),
  );
}

function panel(font, tone) {
  const display = {
    fontFamily: `"${font.family}", var(--font-fallback)`,
    fontWeight: font.weight,
  };
  return el('div', { class: `panel panel--${tone}` }, [
    el('p', { class: 'hero-line', style: display }, "Hi, I'm Brendan"),
    el('p', { class: 'subhead', style: display }, "I build tools that make busy teams' days easier."),
    el(
      'p',
      { class: 'body-copy' },
      'I study business and computer science at UBC, and I like sitting between the two. Most of my work starts with watching how people actually get things done, then building something small that helps.',
    ),
    el('p', { class: 'placeholder-note' }, 'Placeholder wording. Body text is Nunito.'),
    el(
      'ul',
      { class: 'stickers' },
      stickers.map((s) =>
        el(
          'li',
          {
            class: 'sticker',
            style: { ...display, background: `var(--face-${s.face})`, transform: `rotate(${s.tilt}deg)` },
          },
          s.text,
        ),
      ),
    ),
    el('p', { class: 'glyphs', style: display }, '0123456789 & ? ! %'),
  ]);
}

function specimen(font, index) {
  const letter = 'ABCD'[index];
  const display = { fontFamily: `"${font.family}", var(--font-fallback)`, fontWeight: font.weight };
  return el('section', { class: 'specimen', id: `font-${font.id}` }, [
    el('div', { class: 'specimen-head' }, [
      el('span', { class: 'specimen-letter', style: display }, letter),
      el('h2', { class: 'specimen-name' }, `${font.label} (weight ${font.weight})`),
    ]),
    panel(font, 'ink'),
    panel(font, 'cream'),
  ]);
}

applyPalette();

const app = document.getElementById('app');
app.classList.add('page');
app.append(
  el(
    'p',
    { class: 'page-intro' },
    'Type test. Pick a display font (A to D) and tell me what you think of the colours.',
  ),
  el('p', { class: 'section-label' }, 'Proposed palette'),
  swatchList(),
  el('p', { class: 'section-label' }, 'Display fonts'),
  ...displayFonts.map(specimen),
);
