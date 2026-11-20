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
const OUTRO_RISE = 10; // how far the camera drifts up for the outro
const CAMERA_Z = 14;

const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

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

  // ---- the two placeholder puzzles, each stuck in its own crater either side of the cube ----
  // rest: how far the centre sits above the ground (they are part buried, and rise clear on hover).
  // top: where the label goes. craterSize: radius of the crater it sits in.
  const SIDE_Z = -1;
  const sides = [
    { object: createPyraminx(), side: -1, rest: 0.4, top: 3.1, craterSize: 1.9, hover: 0 },
    { object: createMegaminx(), side: 1, rest: 0.6, top: 2.9, craterSize: 1.55, hover: 0 },
  ];
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
    const ground = MOON_TOP - MOON_RADIUS + Math.sqrt(MOON_RADIUS ** 2 - x ** 2 - SIDE_Z ** 2);
    for (const s of sides) {
      s.object.position.set(s.side * x, ground + s.rest * scale, SIDE_Z);
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

    const camY =
      DESCENT_END * journey.descent +
      (ARRIVE - DESCENT_END) * easeOut(journey.moon) +
      OUTRO_RISE * easeInOut(journey.outro);

    camera.position.set(pointer.x * 0.45, camY + pointer.y * 0.25, CAMERA_Z);
    camera.lookAt(0, camY, 0);

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
      const { object, top } = hoveredSide;
      labelPoint.copy(object.position);
      labelPoint.y += top * object.scale.x;
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
