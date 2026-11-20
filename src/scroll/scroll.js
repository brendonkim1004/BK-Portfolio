// Smooth scrolling (Lenis) and the scroll "journey": three numbers from 0 to 1,
// each tied to its own page section, that the 3D scene reads every frame.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);

const SCRUB = 0.6; // seconds of smoothing between the scrollbar and the scene

export function setupScroll() {
  ScrollTrigger.config({ ignoreMobileResize: true });

  const lenis = new Lenis();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const journey = { descent: 0, moon: 0, outro: 0 };

  // Each value runs 0 -> 1 while its section's bottom edge travels up to the bottom of the screen.
  const stretch = (key, selector, startTrigger = selector) =>
    gsap.to(journey, {
      [key]: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: startTrigger,
        endTrigger: selector,
        start: key === 'descent' ? 'top top' : 'top bottom',
        end: 'bottom bottom',
        // The ending follows the scrollbar exactly, so the 3D moon and the contact text that
        // rides over it can never drift apart. (Lenis has already smoothed the scrolling.)
        scrub: key === 'outro' ? true : SCRUB,
      },
    });

  stretch('descent', '#descent', '#about'); // starts with the very first scroll
  stretch('moon', '#moon');
  stretch('outro', '#outro');

  // The hold is the stretch of scroll between the moon section ending and the outro starting.
  const moonEl = document.querySelector('#moon');
  const holdStart = () => moonEl.offsetTop + moonEl.offsetHeight - window.innerHeight;

  // Gentle snap: if scrolling comes to rest just short of the hold, settle onto it.
  // It never traps: any further scroll moves on as normal.
  let settle;
  lenis.on('scroll', () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      const gap = holdStart() - window.scrollY;
      if (gap > 2 && gap < window.innerHeight * 0.35) {
        lenis.scrollTo(holdStart(), { duration: 0.9 });
      }
    }, 160);
  });

  // Where "the work" is: the solved cube, just before the page tips down to the contact links.
  const workSpot = () => holdStart();

  return {
    journey,
    lenis,
    scrollToWork: () => lenis.scrollTo(workSpot(), { duration: 2.2 }),
    // Same place, with no travel: used when a project is opened from a link or from the list.
    jumpToWork: () => lenis.scrollTo(workSpot(), { immediate: true, force: true }),
    // While the cube is still solving, scrolling stops at the cube so the show is not skipped.
    // Called every frame during the solve; it does nothing unless the page has gone past.
    holdAtCube: () => {
      const limit = holdStart();
      if (window.scrollY > limit + 1) lenis.scrollTo(limit, { immediate: true, force: true });
    },
  };
}
