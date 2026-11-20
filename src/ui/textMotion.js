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
    // Splitting by words as well keeps each word in one piece when a line wraps.
    const split = new SplitText(el, { type: 'words,chars' });
    splits.push(split);
    // Measure every letter first, then pin the widths (measuring and writing in turns is slow).
    const widths = split.chars.map((char) => char.getBoundingClientRect().width);
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
