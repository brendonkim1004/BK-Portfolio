// Builds the whole scene and moves the camera through it.
// Everything on screen is a pure function of the scroll "journey" values plus time for idle drift.
import * as THREE from 'three';
import { palette } from '../styles/palette.js';
import { createRingedPlanet, createSmallPlanet } from './objects/planets.js';
import { createSatellite, createAsteroids, createComet } from './objects/spaceJunk.js';
import { createMoon, MOON_RADIUS } from './objects/moon.js';
import { createPyraminx, createMegaminx } from './objects/puzzles.js';
import { createStars } from './objects/stars.js';
import { createDust } from './objects/dust.js';
import { createCube } from './cube/index.js';

// World heights (y). The camera starts at 0 and travels down.
const DESCENT_END = -40; // camera height when the descent stretch finishes
const MOON_TOP = -48; // the moon's surface
const ARRIVE = MOON_TOP + 4; // camera height once it has settled over the moon
const OUTRO_TILT = (62 * Math.PI) / 180; // how far the camera tips down to look at the moon's surface
const CAMERA_Z = 14;

const easeOut = (t) => 1 - (1 - t) ** 3;

// cubeOptions are passed straight to the cube: { burst, onFaceClick, onLabel }.
// onSideLabel({ x, y } | null) asks the page to show "Coming Soon" above a side puzzle, or hide it.
export function createWorld(stage, { hitEl, isPhone, onSideLabel, ...cubeOptions }) {
  const { scene, camera } = stage;
  const drifting = []; // things with update(time)
  const placed = []; // things whose x shrinks on narrow screens

  // Put an object at a home position. Narrow screens pull x toward the middle.
  function place(object, x, y, z, scale = 1, narrowDy = 0) {
    object.position.set(x, y, z);
    object.scale.setScalar(scale);
    object.userData.homeX = x;
    object.userData.baseX = x;
    object.userData.homeY = y;
    object.userData.baseY = y;
    object.userData.narrowDy = narrowDy; // extra height on phone-shaped screens, to clear the text
    object.userData.baseScale = scale;
    scene.add(object);
    drifting.push(object);
    placed.push(object);
    return object;
  }

  place(createRingedPlanet(), 5.4, 0.4, -3, 1, 3.6);
  place(createSmallPlanet(palette.faces.green, palette.faces.blue), 1.9, -4.6, -8, 1, -3);
  place(createSatellite(), -4.8, -11.5, -2, 0.9);
  place(
    createAsteroids(
      [
        [0, 0, 0, 1.1],
        [2.2, 1.3, -2, 0.5],
        [-1.9, -1.2, 1, 0.35],
        [1.2, -2.0, -1, 0.6],
      ],
      1.7,
    ),
    4.4,
    -19,
    -4,
  );
  place(createComet(), -3.8, -26.5, -9, 1.2);
  place(createSmallPlanet(palette.faces.pink, palette.faces.red), 5.2, -32.5, -12, 1.5);
  place(
    createAsteroids(
      [
        [0, 0, 0, 0.7],
        [1.6, -0.9, -1, 0.4],
        [-1.2, 0.9, 0.5, 0.3],
      ],
      4.2,
    ),
    -5,
    -37,
    -3,
  );

  const stars = createStars({ count: isPhone ? 300 : 600, top: 20, bottom: MOON_TOP - 14 });
  scene.add(stars);

  const moon = createMoon();
  moon.position.y = MOON_TOP;
  scene.add(moon);

  const dust = createDust({ count: isPhone ? 7 : 11 });
  dust.position.y = MOON_TOP;
  scene.add(dust);

  const cube = createCube({ hitEl, camera, isPhone, ...cubeOptions });
  scene.add(cube);
  let cubeScale = 1;
  let cubeGrow = 1.3; // how much bigger the cube gets once it is solved and centred

  // ---- the two placeholder puzzles, each sitting in its own crater either side of the cube ----
  // rest: height of the centre above the ground, chosen so the flat base just touches the crater floor
  // (nothing is buried). craterSize: radius of its crater.
  // The label is centred over the part the eye reads as the middle: "tip" is how far that part is
  // from the centre along the puzzle's own lean (the pyramid's point; 0 for the ball-shaped Megaminx),
  // and "gap" is how far straight up from there the label floats.
  const SIDE_Z = -1;
  const SIDE_LIFT = 0.6; // how far they rise on hover (matches the lift in puzzles.js)
  const sides = [
    { object: createPyraminx(), side: -1, rest: 0.62, tip: 1.7, gap: 0.4, craterSize: 2.0, hover: 0 },
    { object: createMegaminx(), side: 1, rest: 1.08, tip: 0, gap: 1.65, craterSize: 1.6, hover: 0 },
  ];
  const moonCentre = new THREE.Vector3(0, MOON_TOP - MOON_RADIUS, 0);
  const groundNormal = new THREE.Vector3();
  const straightUp = new THREE.Vector3(0, 1, 0);
  for (const s of sides) {
    scene.add(s.object);
    s.crater = moon.addCrater(s.craterSize);
  }

  // Hover works from the mouse position; on touch a tap shows the label for a moment.
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const labelPoint = new THREE.Vector3();
  let mouse = null; // last mouse position in screen pixels
  let tap = null; // a touch that has not been checked yet
  let hoveredSide = null;
  let tapUntil = 0;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') mouse = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') tap = { x: e.clientX, y: e.clientY };
  });
  document.documentElement.addEventListener('pointerleave', () => (mouse = null));

  // ---- click a planet or asteroid to spin it ----
  const spinnables = drifting.flatMap((object) => object.spinnables ?? []);
  const SPIN_KICK = 9; // radians per second added by one click
  const SPIN_MAX = 26;
  const centre = new THREE.Vector3();

  function spinnableUnder(point) {
    ndc.set((point.x / window.innerWidth) * 2 - 1, -((point.y / window.innerHeight) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    let nearest = null;
    let nearestDistance = Infinity;
    for (const s of spinnables) {
      const hit = ray.intersectObject(s.hit, true)[0];
      if (hit && hit.distance < nearestDistance) {
        nearest = s;
        nearestDistance = hit.distance;
      }
    }
    return nearest;
  }

  window.addEventListener('click', (e) => {
    // Clicks meant for buttons, the cube, or an open project are not ours.
    if (e.target.closest?.('button, a, #cube-hit, .project-view, .list-view')) return;
    const s = spinnableUnder({ x: e.clientX, y: e.clientY });
    if (!s) return;
    // Clicking its right side spins it one way, its left side the other, like flicking a globe.
    s.hit.getWorldPosition(centre).project(camera);
    const centreX = (centre.x * 0.5 + 0.5) * window.innerWidth;
    const push = e.clientX >= centreX ? SPIN_KICK : -SPIN_KICK;
    s.speed = Math.min(SPIN_MAX, Math.max(-SPIN_MAX, s.speed + push));
  });
  let canSpin = false; // whether the mouse is over something spinnable (shows the hand cursor)

  function sideUnder(point) {
    ndc.set((point.x / window.innerWidth) * 2 - 1, -((point.y / window.innerHeight) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    return sides.find((s) => ray.intersectObject(s.object, true).length > 0) ?? null;
  }

  stage.onResize((aspect) => {
    // Wide screens keep the full layout; tall phone screens squeeze it toward the centre.
    const k = Math.min(1, Math.max(0.42, aspect / 1.5));
    for (const object of placed) {
      object.userData.homeX = object.userData.baseX * k;
      object.position.x = object.userData.homeX;
      object.userData.homeY = object.userData.baseY + object.userData.narrowDy * (1 - k) / 0.58;
      object.position.y = object.userData.homeY;
      object.scale.setScalar(object.userData.baseScale * (0.7 + 0.3 * k));
    }
    cubeScale = 0.72 + 0.28 * k;
    const wide = (k - 0.42) / 0.58; // 0 on phone-shaped screens, 1 on wide ones
    cubeGrow = 1.1 + 0.2 * wide;

    // Side puzzles sit near the edge of the screen, resting on the curve of the moon.
    const halfWidth = Math.tan((camera.fov * Math.PI) / 360) * (CAMERA_Z - SIDE_Z) * aspect;
    const x = Math.min(6.8, Math.max(1.8, halfWidth * 0.66));
    const scale = 0.5 + 0.5 * wide;
    const height = Math.sqrt(MOON_RADIUS ** 2 - x ** 2 - SIDE_Z ** 2);
    for (const s of sides) {
      // The moon curves away from the middle, so each puzzle stands square to the ground under it.
      groundNormal.set(s.side * x, height, SIDE_Z).normalize();
      s.object.position.copy(moonCentre).addScaledVector(groundNormal, MOON_RADIUS + s.rest * scale);
      s.object.quaternion.setFromUnitVectors(straightUp, groundNormal);
      s.normal = groundNormal.clone(); // the way the puzzle leans, used to place its label
      s.object.scale.setScalar(scale);
      s.crater.place(s.side * x, SIDE_Z, scale);
      // On narrow screens the puzzles sit inside the cube's big crater already, so they need none of their own.
      s.crater.show(x - s.craterSize * scale > 3);
    }
  });

  const pointer = { x: 0, y: 0 }; // smoothed cursor offset, -1..1

  // journey = { descent, moon, outro }, each 0..1 from scroll. target = raw cursor position, -1..1.
  function update(time, dt, journey, target) {
    const follow = 1 - Math.exp(-3 * dt);
    pointer.x += (target.x - pointer.x) * follow;
    pointer.y += (target.y - pointer.y) * follow;

    const camY = DESCENT_END * journey.descent + (ARRIVE - DESCENT_END) * easeOut(journey.moon);

    // The ending: the camera stays where it is and tips down, so the horizon slides up and off the
    // screen and the moon's surface fills the view. It tips fastest at the start, so the ground has
    // taken over before the contact text arrives on top of it.
    const tilt = OUTRO_TILT * Math.sin((journey.outro * Math.PI) / 2);

    camera.position.set(pointer.x * 0.45, camY + pointer.y * 0.25, CAMERA_Z);
    camera.lookAt(0, camY - Math.tan(tilt) * CAMERA_Z, 0);

    // Spins from clicks carry on for a while and slow down smoothly.
    const slow = Math.exp(-1.4 * dt);
    for (const s of spinnables) {
      s.angle += s.speed * dt;
      s.speed *= slow;
    }
    const nowCanSpin = mouse !== null && spinnableUnder(mouse) !== null;
    if (nowCanSpin !== canSpin) {
      canSpin = nowCanSpin;
      document.documentElement.classList.toggle('can-spin', canSpin);
    }

    for (const object of drifting) object.update(time);
    cube.update(time, dt, journey, {
      restY: MOON_TOP + 0.35,
      liftY: ARRIVE + 0.2,
      scale: cubeScale,
      grow: cubeGrow,
    });
    dust.setProgress(cube.releaseProgress());

    // Side puzzles: which one (if any) is being pointed at, while the moon is on screen.
    const nearMoon = journey.moon > 0.25 && journey.outro < 0.6;
    let nowHovered = null;
    if (nearMoon) {
      if (tap) {
        nowHovered = sideUnder(tap);
        tapUntil = nowHovered ? time + 1.8 : 0;
      } else if (time < tapUntil) {
        nowHovered = hoveredSide;
      } else if (mouse) {
        nowHovered = sideUnder(mouse);
      }
    }
    tap = null;
    if (nowHovered !== hoveredSide) {
      hoveredSide = nowHovered;
      if (!hoveredSide) onSideLabel?.(null);
    }
    if (hoveredSide) {
      // Follow the puzzle on screen, since the camera moves with scroll and the cursor.
      const { object, tip, gap, normal } = hoveredSide;
      const size = object.scale.x;
      labelPoint.copy(object.position).addScaledVector(normal, (SIDE_LIFT + tip) * size);
      labelPoint.y += gap * size;
      labelPoint.project(camera);
      onSideLabel?.({
        x: (labelPoint.x * 0.5 + 0.5) * window.innerWidth,
        y: (-labelPoint.y * 0.5 + 0.5) * window.innerHeight,
      });
    }
    const ease = 1 - Math.exp(-10 * dt);
    for (const s of sides) {
      s.hover += ((s === hoveredSide ? 1 : 0) - s.hover) * ease;
      s.object.update(time, s.hover);
    }
  }

  return { update, cube };
}
