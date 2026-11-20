// The title sticker shown for a cube face: it follows the mouse on hover, or sits
// just above the cube on touch screens and for keyboard focus.
export function createFaceLabel(el) {
  return {
    // point is { x, y } in screen pixels, or null for the fixed spot above the cube.
    show(text, hex, point) {
      el.textContent = text;
      el.style.backgroundColor = hex;
      const x = point ? point.x : window.innerWidth / 2;
      const y = point ? point.y : window.innerHeight * 0.2;
      // Only transform changes, so moving it is cheap.
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, ${point ? '-170%' : '-50%'}) rotate(-3deg)`;
      el.classList.add('is-on');
    },
    hide() {
      el.classList.remove('is-on');
    },
  };
}
