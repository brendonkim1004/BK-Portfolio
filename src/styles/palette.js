// The one place colours live. CSS reads them as custom properties (applyPalette),
// and the 3D scene will import the same hex values later.
// The six sticker colours used all over the site (notes, planets, labels).
const faces = {
  red: '#F2503B',
  orange: '#FF9A2E',
  yellow: '#FFD23F',
  green: '#3DBE7B',
  blue: '#3D8BF2',
  pink: '#FF7FB0',
};

// A real Rubik's cube has white where the site palette has pink.
const white = '#FFFBF0';

export const palette = {
  ink: '#141B3C', // deep ink-navy space
  inkDeep: '#0C1028', // far background
  cream: '#FFF4DC', // warm text and paper
  moon: '#C9C6BD',
  moonShade: '#9A978F',
  dust: '#E9E5D8', // the puff when the cube pulls free
  cubeBody: '#232B55', // the cube's plastic, a step lighter than space so its shape still reads
  outline: '#0A0D1F', // chunky outlines and hard shadows
  faces,
  // The cube's six faces, in the standard scheme: white opposite yellow, red opposite orange,
  // blue opposite green. projects.js picks a face by these names.
  cube: {
    white,
    yellow: faces.yellow,
    red: faces.red,
    orange: faces.orange,
    green: faces.green,
    blue: faces.blue,
  },
  // The Megaminx's twelve standard colours.
  megaminx: {
    white,
    grey: '#A4A9B8',
    red: faces.red,
    orange: faces.orange,
    yellow: faces.yellow,
    cream: '#FFF1B0',
    green: faces.green,
    lightGreen: '#B4E655',
    blue: faces.blue,
    lightBlue: '#8FD2FF',
    purple: '#9B5DE5',
    pink: faces.pink,
  },
};

// WCAG 2 relative luminance of a "#RRGGBB" colour.
function luminance(hex) {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

// WCAG 2 contrast ratio between two "#RRGGBB" colours (1 = identical, 21 = black on white).
export function contrastRatio(hexA, hexB) {
  const a = luminance(hexA);
  const b = luminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Copies the palette onto an element as CSS variables: --ink, --cream, --face-red, ...
export function applyPalette(root = document.documentElement) {
  const kebab = (key) => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  for (const [key, value] of Object.entries(palette)) {
    if (typeof value === 'string') root.style.setProperty(`--${kebab(key)}`, value);
  }
  for (const [name, hex] of Object.entries(palette.faces)) {
    root.style.setProperty(`--face-${name}`, hex);
  }
}
