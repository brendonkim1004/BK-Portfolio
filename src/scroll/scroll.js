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
        scrub: SCRUB,
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

  return {
    journey,
    lenis,
    scrollToWork: () => lenis.scrollTo(holdStart() + window.innerHeight * 0.3, { duration: 2.2 }),
  };
}
