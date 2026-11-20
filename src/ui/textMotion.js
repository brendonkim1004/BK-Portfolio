// Text motion for the HTML layer: the name reveal and the floating notes.
// Only transform and opacity are animated.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

export async function setupTextMotion() {
  await document.fonts.ready; // split after the font loads so letters are measured correctly

  // Name: letters rise in one after another.
  const name = new SplitText('.about-name', { type: 'chars' });
  gsap.from(name.chars, {
    yPercent: 70,
    opacity: 0,
    rotate: () => gsap.utils.random(-8, 8),
    duration: 0.9,
    ease: 'power3.out',
    stagger: 0.04,
    delay: 0.15,
  });
  gsap.from('.about-major, .about-school, .scroll-hint', {
    y: 18,
    opacity: 0,
    duration: 0.8,
    ease: 'power2.out',
    stagger: 0.12,
    delay: 0.7,
  });

  // Notes: each drifts up into place as it enters, then keeps drifting at its own speed.
  gsap.utils.toArray('.note').forEach((note, i) => {
    const tilt = Number(note.dataset.tilt || 0);
    gsap.set(note, { rotate: tilt });
    gsap.fromTo(
      note,
      { opacity: 0, y: 70, rotate: tilt + (i % 2 ? 6 : -6) },
      {
        opacity: 1,
        y: 0,
        rotate: tilt,
        ease: 'power2.out',
        scrollTrigger: { trigger: note.parentElement, start: 'top 95%', end: 'top 55%', scrub: 0.5 },
      },
    );
    gsap.to(note.parentElement, {
      y: -40 - i * 25,
      ease: 'none',
      scrollTrigger: { trigger: note.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.5 },
    });
  });

  ScrollTrigger.refresh();
}
