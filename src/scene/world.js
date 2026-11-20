// Builds the whole scene and moves the camera through it.
// Everything on screen is a pure function of the scroll "journey" values plus time for idle drift.
import { palette } from '../styles/palette.js';
import { createRingedPlanet, createSmallPlanet } from './objects/planets.js';
import { createSatellite, createAsteroids, createComet } from './objects/spaceJunk.js';
import { createMoon } from './objects/moon.js';
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
export function createWorld(stage, { hitEl, isPhone, ...cubeOptions }) {
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
    dust.setProgress(journey.moon);
    cube.update(time, dt, journey, { restY: MOON_TOP + 0.35, liftY: ARRIVE + 0.2, scale: cubeScale });
  }

  return { update, cube };
}
