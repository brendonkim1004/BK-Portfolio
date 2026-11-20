// Tiny 8-bit drawings, made in code so there are no image files.
// Each drawing is a grid of letters: one letter is one pixel, "." is empty, and COLOURS says
// which colour each letter stands for. To change a drawing, edit its grid.
import { palette } from '../styles/palette.js';

const COLOURS = {
  k: palette.outline, // dark outline
  h: '#3A2A22', // hair
  s: '#F2C9A0', // skin
  r: palette.cube.red, // hoodie
  b: palette.cube.blue, // backpack
  p: palette.cubeBody, // trousers
  w: palette.white, // shoes, paper, screen glare
  l: '#AEB6C8', // laptop, metal
  d: '#C98B4E', // wood
  n: '#1B2145', // screen
  g: palette.cube.green,
  y: palette.cube.yellow,
  o: palette.cube.orange,
  c: '#E9DFC8', // stone
};

// The student, facing right: hoodie, backpack, laptop under one arm. Two frames for walking.
const STUDENT_TOP = [
  '....kkkkkk......',
  '...khhhhhhk.....',
  '..khhhhhhhhk....',
  '..khhssssssk....',
  '..khssssksk.....',
  '..khssssssk.....',
  '...kssssssk.....',
  '...kkrrrrkk.....',
  '.kkkrrrrrrrk....',
  'kbbkrrrrrrrrk...',
  'kbbkrrrkkkkkkk..',
  'kbbkrrrkllllwk..',
  'kbbkrrrskkkkkk..',
  '.kkkrrrrrrrk....',
  '...kppppppk.....',
  '...kppppppk.....',
];
const LEGS_APART = ['...kppkkppk.....', '..kppk..kppk....', '.kwwwk..kwwwk...', '.kkkkk..kkkkk...'];
const LEGS_TOGETHER = ['...kppppppk.....', '....kppppk......', '....kwwwwwk.....', '....kkkkkkk.....'];

const GRIDS = {
  studentA: [...STUDENT_TOP, ...LEGS_APART],
  studentB: [...STUDENT_TOP, ...LEGS_TOGETHER],
  // A desk with a stack of paper and a mug: the administrative assistant job.
  desk: [
    '................',
    '..kkkkkk........',
    '..kwwwwk....kk..',
    '..kwkkwk...kook.',
    '..kwwwwk...kookk',
    '..kwkkwk...kook.',
    'kkkkkkkkkkkkkkkk',
    'kddddddddddddddk',
    'kkkkkkkkkkkkkkkk',
    '.kdk........kdk.',
    '.kdk........kdk.',
    '.kkk........kkk.',
  ],
  // A monitor showing lines of code: the web developer job.
  monitor: [
    'kkkkkkkkkkkkkkkk',
    'knnnnnnnnnnnnnnk',
    'knyynggggnnnnnnk',
    'knnnnbbbnoonnnnk',
    'knnnnggnnbbbnnnk',
    'knyynnnnnnnnnnnk',
    'knnnnooonggnnnnk',
    'knnnnnnnnnnnnnnk',
    'kkkkkkkkkkkkkkkk',
    '......kllk......',
    '....kkkkkkkk....',
    '....kllllllk....',
  ],
  // A campus building with a flag on top: being a student.
  campus: [
    '.......kgggk....',
    '.......kgggk....',
    '.......k........',
    '......kkk.......',
    '....kkccckk.....',
    '..kkccccccckk...',
    'kkkkkkkkkkkkkkk.',
    'kcckcckcckcckck.',
    'kcckcckcckcckck.',
    'kcckcckcckcckck.',
    'kkkkkkkkkkkkkkk.',
    'kccccccccccccck.',
  ],
};

// Turns a grid into an SVG picture. Runs of the same colour in a row become one rectangle.
export function sprite(name) {
  const grid = GRIDS[name];
  const width = Math.max(...grid.map((row) => row.length));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${grid.length}`);
  svg.setAttribute('shape-rendering', 'crispEdges'); // hard pixel edges at any size
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('pixel-art', `pixel-${name}`);
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const letter = row[x];
      let end = x + 1;
      while (row[end] === letter) end++;
      if (COLOURS[letter]) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', end - x);
        rect.setAttribute('height', 1);
        rect.setAttribute('fill', COLOURS[letter]);
        svg.append(rect);
      }
      x = end;
    }
  });
  return svg;
}
