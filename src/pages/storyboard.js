// Storyboard page: seven rough panels of the scroll journey, drawn as flat SVG in the palette.
// A decision page only. Nothing here ships in the real site.
import '@fontsource/fredoka/600.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import './decisionPages.css';
import './storyboard.css';
import { applyPalette } from '../styles/palette.js';

// ---- small SVG drawing helpers (all return strings) ----

// One 3x3 face of the cube, drawn flat from (x0, y0); the caller skews it into place.
function faceGrid(x0, y0, cell, colors) {
  let out = '';
  for (let i = 0; i < 9; i++) {
    const x = x0 + (i % 3) * cell;
    const y = y0 + Math.floor(i / 3) * cell;
    out += `<rect class="ol thin f-${colors[i]}" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="${cell * 0.18}"/>`;
  }
  return out;
}

// A toy-like cube seen from a corner. (cx, cy) is the near top corner.
// faces = { top, left, right }, each a list of 9 colour names (or one name for a solid face).
function isoCube(cx, cy, cell, faces, extra = '') {
  const side = cell * 3;
  const nine = (c) => (Array.isArray(c) ? c : Array(9).fill(c));
  return `<g transform="translate(${cx} ${cy}) ${extra}">
    <g transform="matrix(0.866 0.5 -0.866 0.5 0 0)">${faceGrid(-side, -side, cell, nine(faces.top))}</g>
    <g transform="matrix(0.866 0.5 0 1 0 0)">${faceGrid(-side, 0, cell, nine(faces.left))}</g>
    <g transform="matrix(0.866 -0.5 0 1 0 0)">${faceGrid(0, 0, cell, nine(faces.right))}</g>
  </g>`;
}

const solved = { top: 'yellow', left: 'red', right: 'blue' };
const scrambled = {
  top: ['red', 'yellow', 'green', 'blue', 'yellow', 'pink', 'orange', 'red', 'yellow'],
  left: ['blue', 'red', 'orange', 'green', 'red', 'yellow', 'pink', 'blue', 'red'],
  right: ['green', 'pink', 'blue', 'yellow', 'blue', 'red', 'orange', 'green', 'pink'],
};
const halfSolved = {
  top: ['yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'green', 'red', 'yellow'],
  left: ['red', 'red', 'orange', 'red', 'red', 'yellow', 'red', 'red', 'pink'],
  right: ['blue', 'blue', 'blue', 'yellow', 'blue', 'blue', 'orange', 'blue', 'blue'],
};

function stars(points) {
  return points.map(([x, y, r]) => `<circle class="f-cream" cx="${x}" cy="${y}" r="${r}"/>`).join('');
}

function sticker(x, y, w, text, color, tilt) {
  return `<g transform="translate(${x} ${y}) rotate(${tilt})">
    <rect class="f-outline" x="3" y="3" width="${w}" height="20" rx="7"/>
    <rect class="ol thin f-${color}" x="0" y="0" width="${w}" height="20" rx="7"/>
    <text class="svg-label" x="${w / 2}" y="14" text-anchor="middle">${text}</text>
  </g>`;
}

// The moon's surface along the bottom of a panel, with one main crater at (cx, 150).
function moonGround(cx) {
  return `<circle class="ol f-moon" cx="160" cy="470" r="340"/>
    <ellipse class="ol thin f-moon-shade" cx="${cx}" cy="150" rx="46" ry="11"/>
    <ellipse class="ol thin f-moon-shade" cx="48" cy="160" rx="15" ry="4"/>
    <ellipse class="ol thin f-moon-shade" cx="282" cy="158" rx="19" ry="5"/>`;
}

// ---- the seven panels (viewBox 320 x 180) ----

const panels = [
  {
    title: 'About',
    scroll: '1 screen',
    caption: 'Name, role, two or three lines. Objects drift; cursor nudges the view.',
    alt: 'Text block on the left; a ringed planet and a small planet float on the right among stars.',
    art: `${stars([[20, 24, 1.5], [70, 150, 1.2], [140, 18, 1], [300, 30, 1.6], [180, 160, 1.2], [250, 150, 1], [120, 110, 1]])}
      <rect class="f-cream" x="26" y="52" width="118" height="24" rx="12"/>
      <rect class="f-cream" x="26" y="88" width="92" height="7" rx="3.5" opacity="0.8"/>
      <rect class="f-cream" x="26" y="102" width="106" height="7" rx="3.5" opacity="0.8"/>
      <rect class="f-cream" x="26" y="116" width="70" height="7" rx="3.5" opacity="0.8"/>
      <g transform="rotate(-18 232 78)">
        <ellipse class="ol f-pink" cx="232" cy="78" rx="62" ry="13"/>
        <circle class="ol f-orange" cx="232" cy="78" r="34"/>
        <path class="ol f-pink" d="M170 78 a62 13 0 0 0 124 0 a62 9 0 0 1 -124 0z"/>
      </g>
      <circle class="ol f-green" cx="176" cy="140" r="13"/>
      <circle class="f-outline" cx="172" cy="137" r="2.5" opacity="0.35"/>`,
  },
  {
    title: 'Descent',
    scroll: 'about 3 screens',
    caption: 'Camera drops past objects. Short notes on how I think float by.',
    alt: 'A satellite, asteroids of different sizes, a comet, and two floating note stickers.',
    art: `${stars([[30, 30, 1.2], [300, 60, 1.4], [150, 170, 1], [210, 20, 1], [90, 95, 1]])}
      <g transform="rotate(-14 84 60)">
        <rect class="ol f-blue" x="32" y="50" width="30" height="20" rx="3"/>
        <rect class="ol f-blue" x="106" y="50" width="30" height="20" rx="3"/>
        <rect class="ol f-moon" x="64" y="42" width="40" height="36" rx="9"/>
        <circle class="ol thin f-yellow" cx="84" cy="60" r="7"/>
      </g>
      <path class="ol f-yellow" d="M214 44 L300 14 L296 26 L310 30 L226 62 z"/>
      <circle class="ol f-cream" cx="218" cy="52" r="13"/>
      <path class="ol f-moon-shade" d="M236 118 l22 -10 l20 8 l6 20 l-14 16 l-24 2 l-14 -16 z"/>
      <path class="ol thin f-moon-shade" d="M150 136 l10 -5 l10 4 l2 10 l-8 7 l-12 -2 z"/>
      <path class="ol thin f-moon" d="M296 92 l7 -3 l6 4 l-1 8 l-8 3 l-6 -5 z"/>
      ${sticker(24, 118, 86, 'business + CS', 'cream', -5)}
      ${sticker(128, 84, 78, 'I like ops', 'pink', 4)}`,
  },
  {
    title: 'Moon',
    scroll: 'about 2 screens (first part)',
    caption: 'Scrambled cube wedged in a crater. Scroll wiggles it free.',
    alt: 'The moon surface with a crater; a scrambled cube is half buried in it.',
    art: `${stars([[40, 30, 1.4], [270, 40, 1.2], [200, 20, 1], [110, 60, 1]])}
      ${moonGround(160)}
      ${isoCube(160, 116, 13, scrambled, 'rotate(14)')}
      <path class="f-moon" d="M92 148 q68 -16 136 0 l0 32 l-136 0 z"/>
      <path class="ol f-none" d="M100 147 q60 -14 120 0"/>
      <path class="s-cream" d="M98 112 q-8 -6 -4 -16 M224 108 q9 -5 6 -16" opacity="0.8"/>`,
  },
  {
    title: 'Solve',
    scroll: 'same stretch (second part)',
    caption: 'Scroll plays the solve. Scroll back and it un-solves.',
    alt: 'The cube floats above the crater, partly solved, with a dust puff below and a turn arrow.',
    art: `${stars([[30, 40, 1.4], [290, 30, 1.2], [70, 90, 1], [250, 100, 1]])}
      ${moonGround(160)}
      <circle class="f-cream" cx="132" cy="140" r="8" opacity="0.5"/>
      <circle class="f-cream" cx="150" cy="134" r="11" opacity="0.5"/>
      <circle class="f-cream" cx="174" cy="136" r="9" opacity="0.5"/>
      <circle class="f-cream" cx="192" cy="142" r="6" opacity="0.5"/>
      ${isoCube(160, 46, 13, halfSolved, 'rotate(-6)')}
      <path class="s-cream" d="M222 34 q26 22 6 52"/>
      <path class="s-cream" d="M238 80 l-10 6 l-2 -12"/>`,
  },
  {
    title: 'Hold',
    scroll: 'about 1.5 screens',
    caption: 'Drag to spin. Each colour is a project. Scroll on to keep going.',
    alt: 'The solved cube in the centre with a curved drag arrow and a project title sticker.',
    art: `${stars([[24, 28, 1.4], [300, 150, 1.2], [60, 150, 1], [280, 24, 1.2], [36, 96, 1]])}
      ${isoCube(160, 62, 17, solved)}
      <path class="s-cream" d="M78 132 q82 46 164 0"/>
      <path class="s-cream" d="M234 124 l10 7 l-12 5"/>
      ${sticker(206, 44, 82, 'Truck tracker', 'red', 5)}
      ${sticker(20, 52, 84, 'drag to look', 'cream', -6)}`,
  },
  {
    title: 'Burst + project',
    scroll: 'on click',
    caption: 'Click a face: the cube bursts, colour floods, the project opens. Back reassembles it.',
    alt: 'Left: small cubes and shards flying outward. Right: a red project page with a framed demo window.',
    art: `<rect class="f-red" x="160" y="0" width="160" height="180"/>
      <line class="ol" x1="160" y1="0" x2="160" y2="180"/>
      ${isoCube(80, 74, 7, { top: 'red', left: 'red', right: 'red' }, 'rotate(20)')}
      ${isoCube(34, 44, 5, solved, 'rotate(-30)')}
      ${isoCube(126, 40, 5, solved, 'rotate(40)')}
      ${isoCube(40, 138, 5, solved, 'rotate(65)')}
      ${isoCube(124, 136, 5, solved, 'rotate(-50)')}
      <path class="ol thin f-red" d="M70 22 l10 4 l-8 8 z M18 96 l12 -2 l-6 10 z M138 92 l10 6 l-12 4 z M84 150 l8 10 l-12 0 z"/>
      <path class="s-cream" d="M12 12 h18 M12 12 v12" opacity="0.7"/>
      <path class="s-cream" d="M148 168 h-18 M148 168 v-12" opacity="0.7"/>
      <rect class="f-cream" x="176" y="18" width="92" height="14" rx="7"/>
      <rect class="f-cream" x="176" y="40" width="64" height="5" rx="2.5" opacity="0.85"/>
      <rect class="f-cream" x="176" y="50" width="76" height="5" rx="2.5" opacity="0.85"/>
      <rect class="ol f-cream" x="176" y="68" width="128" height="94" rx="9"/>
      <path class="ol f-ink" d="M176 77 a9 9 0 0 1 9 -9 h110 a9 9 0 0 1 9 9 v7 h-128 z"/>
      <rect class="ol thin f-yellow" x="186" y="96" width="30" height="56" rx="4"/>
      <rect class="ol thin f-green" x="225" y="96" width="30" height="38" rx="4"/>
      <rect class="ol thin f-blue" x="264" y="96" width="30" height="48" rx="4"/>`,
  },
  {
    title: 'Outro',
    scroll: '1 screen',
    caption: 'Contact links, resume, more projects coming.',
    alt: 'The cube small in the distance with three contact stickers and stars.',
    art: `${stars([[30, 30, 1.6], [290, 40, 1.2], [200, 26, 1], [100, 150, 1.2], [250, 150, 1], [150, 60, 1], [60, 90, 1.2]])}
      ${isoCube(244, 44, 6, solved, 'rotate(-10)')}
      <rect class="f-cream" x="36" y="50" width="130" height="20" rx="10"/>
      ${sticker(36, 92, 62, 'email', 'yellow', -4)}
      ${sticker(110, 96, 76, 'LinkedIn', 'blue', 3)}
      ${sticker(198, 90, 70, 'resume', 'green', -2)}
      <rect class="f-cream" x="36" y="134" width="110" height="6" rx="3" opacity="0.7"/>`,
  },
];

// A static filter that nudges every edge a little, so shapes look hand-cut instead of perfect.
const wobbleFilter = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <filter id="wobble" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="noise"/>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6"/>
  </filter>
</defs></svg>`;

applyPalette();

const app = document.getElementById('app');
app.classList.add('page');
app.innerHTML = `${wobbleFilter}
  <p class="page-intro">Storyboard. The journey top to bottom, in rough panels. Tell me what feels off.</p>
  <ol class="board">
    ${panels
      .map(
        (p, i) => `<li class="board-item">
      <span class="board-number" aria-hidden="true">${i + 1}</span>
      <div class="board-head">
        <h2 class="board-title">${p.title}</h2>
        <span class="board-scroll">${p.scroll}</span>
      </div>
      <svg class="board-panel" viewBox="0 0 320 180" role="img" aria-label="${p.alt}">
        <g filter="url(#wobble)">${p.art}</g>
      </svg>
      <p class="board-caption">${p.caption}</p>
    </li>`,
      )
      .join('')}
  </ol>
  <p class="section-label">Always on screen</p>
  <p class="always-on">
    <span class="sticker" style="transform: rotate(-2deg)">skip to the work</span>
    <span class="sticker" style="transform: rotate(2deg)">view as list</span>
  </p>`;
