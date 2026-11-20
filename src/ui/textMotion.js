// The opening moment: the name, then the major and the school, "decode" into place.
// Each letter flickers through random symbols for a moment and then locks in as the real
// letter, one after another like text being typed onto the screen: the name first, then the
// major, then the school. Each letter that locks in makes one small click, so the sound runs
// exactly in step with the letters.
//
// How it works: SplitText wraps every letter in its own box. Each box is pinned to the real
// letter's width, so swapping in other symbols never makes the line jiggle. When the wave has
// passed, the wrapping is removed and the text is plain HTML again.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

// selector, when its wave starts (seconds), and the gap between one letter starting and the next.
const LINES = [
// Each line starts after the one before it has finished, so there is only ever one stream of clicks.
  { selector: '.about-name', start: 0.1, gap: 0.08 },
  { selector: '.about-major', start: 1.0, gap: 0.024 },
  { selector: '.about-school', start: 2.1, gap: 0.024 },
];
const SCRAMBLE = 0.22; // how long one letter flickers before it locks in, seconds
const SWAP = 0.05; // how often a flickering letter changes symbol, seconds
const SYMBOLS = '#%&/\\<>[]{}=+*?!01XZNK'; // what a letter flickers through

let running = false;

// How wide each letter really is inside the finished text, measured before the text is split.
// Browsers tuck some letter pairs closer together (kerning), which is lost once every letter
// sits in its own box. Measuring from the start of one letter to the start of the next keeps
// that tucking, so the boxed letters sit exactly where the finished letters will.
function letterWidths(el) {
  const marks = []; // one per visible letter: where it starts and ends, and if a space follows
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (let i = 0; i < node.data.length; i++) {
      if (/\s/.test(node.data[i])) {
        if (marks.length) marks[marks.length - 1].endsWord = true;
        continue;
      }
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const box = range.getBoundingClientRect();
      marks.push({ left: box.left, right: box.right, top: box.top, endsWord: false });
    }
  }
  return marks.map((mark, i) => {
    const next = marks[i + 1];
    const sameWord = next && !mark.endsWord && Math.abs(next.top - mark.top) < 1;
    return (sameWord ? next.left : mark.right) - mark.left;
  });
}

// sound is optional: { play(name, options) }. Safe to call again to replay the intro.
export async function setupTextMotion({ sound } = {}) {
  if (running) return;
  const targets = LINES.map((line) => ({ ...line, el: document.querySelector(line.selector) }));

  // People who ask for less motion just get the text.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  running = true;
  gsap.set(targets.map((t) => t.el), { opacity: 0 }); // hidden straight away, so nothing flashes first
  await document.fonts.ready; // letters must be measured in the real font
  ScrollTrigger.refresh();

  // Small repeatable random numbers, so the intro looks the same on every visit.
  let seed = 19;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const splits = [];
  const letters = [];
  for (const { el, start, gap } of targets) {
    const measured = letterWidths(el); // taken from the finished text, before it is split
    // Splitting by words as well keeps each word in one piece when a line wraps.
    const split = new SplitText(el, { type: 'words,chars' });
    splits.push(split);
    // Pin every letter box to its measured width (or its own width, if the counts ever differ).
    const widths =
      measured.length === split.chars.length
        ? measured
        : split.chars.map((char) => char.getBoundingClientRect().width);
    split.chars.forEach((char, i) => {
      char.style.width = `${widths[i]}px`;
      char.style.textAlign = 'center';
      char.style.opacity = '0';
      letters.push({ el: char, real: char.textContent, begin: start + i * gap, shown: -1, done: false });
    });
    gsap.set(el, { opacity: 1 }); // the line is visible again; its letters are what is hidden now
  }

  const total = Math.max(...letters.map((l) => l.begin)) + SCRAMBLE;
  const clock = { time: 0 };

  function update() {
    for (const letter of letters) {
      if (letter.done) continue;
      const t = clock.time - letter.begin;
      if (t < 0) continue;
      if (t >= SCRAMBLE) {
        letter.el.textContent = letter.real;
        letter.el.style.textAlign = 'left'; // the real letter starts exactly where it will end up
        letter.el.style.opacity = '1';
        letter.done = true;
        // One click per letter, but only while the name is actually on screen.
        if (window.scrollY < window.innerHeight * 0.7) sound?.play('type');
        continue;
      }
      // Still flickering: pick a new symbol every so often, dimmer than the finished letter.
      const tick = Math.floor(t / SWAP);
      if (tick !== letter.shown) {
        letter.shown = tick;
        letter.el.textContent = SYMBOLS[Math.floor(random() * SYMBOLS.length)];
        letter.el.style.opacity = String(0.35 + 0.4 * (t / SCRAMBLE));
      }
    }
  }

  gsap.to(clock, {
    time: total,
    duration: total,
    ease: 'none',
    onUpdate: update,
    // Put the plain text back, so the page is ordinary HTML again and wraps normally on resize.
    onComplete: () => {
      splits.forEach((split) => split.revert());
      running = false;
    },
  });
}
