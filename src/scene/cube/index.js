// The Rubik's cube: wedged in the crater, wiggles free, lifts, solves with scroll,
// then can be dragged, hovered and clicked during the hold.
import * as THREE from 'three';
import { FACES, buildCubies } from './model.js';
import { HOME, buildStates, poseCubies } from './solve.js';
import { createBurstFx } from './burst.js';
import { palette } from '../../styles/palette.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Where each part of the moon stretch (0..1) happens.
const WIGGLE = [0, 0.12, 0.3, 0.4]; // fades in, then out as the cube lets go
const LIFT = [0.3, 0.62];
const SOLVE = [0.45, 0.97];

// hitEl: transparent element over the cube that receives pointer input during the hold.
// burst: shared { value: 0..1, face } object, tweened by the project view.
// onFaceClick(faceIndex, {x, y}) returns true if that face opened something.
// onLabel(faceIndex | null, {x, y} | null) asks the page to show or hide the face's title sticker.
export function createCube({ hitEl, camera, isPhone, burst, onFaceClick, onLabel }) {
  // spin (drag rotation, world axes) > pose (scroll-driven tilt) > cubies
  const spin = new THREE.Group();
  const pose = new THREE.Group();
  spin.add(pose);

  const { cubies, stickers } = buildCubies();
  for (const cubie of cubies) pose.add(cubie);
  const states = buildStates();

  // An invisible box the size of the whole cube, used only to work out which face the pointer is on.
  const picker = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshBasicMaterial());
  picker.visible = false;
  pose.add(picker);

  const fx = createBurstFx({ isPhone });
  pose.add(fx);

  // Each cubie's own outward path and tumble for the burst, fixed once so it reverses exactly.
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const scatter = HOME.map((home) => {
    const dir = new THREE.Vector3(...home);
    if (dir.lengthSq() === 0) dir.set(0, 0, 1);
    dir.x += (rand() - 0.5) * 0.5;
    dir.y += (rand() - 0.5) * 0.5;
    dir.z += (rand() - 0.5) * 0.5;
    return {
      dir: dir.normalize(),
      dist: 4.5 + rand() * 4.5,
      axis: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
      angle: (2 + rand() * 3) * (rand() < 0.5 ? -1 : 1),
    };
  });
  const tumble = new THREE.Quaternion();

  const wedged = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, 0.5, 0.35));
  const display = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.48, -0.7, 0));
  const identity = new THREE.Quaternion();

  // ---- which face is under the pointer ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(clientX, clientY) {
    ndc.set((clientX / window.innerWidth) * 2 - 1, -((clientY / window.innerHeight) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(picker, false)[0];
    if (!hit) return null;
    const n = hit.face.normal;
    const index = FACES.findIndex((f) => f.normal[0] * n.x + f.normal[1] * n.y + f.normal[2] * n.z > 0.9);
    return index === -1 ? null : index;
  }

  // ---- drag with inertia, hover, click ----
  let dragging = false;
  let moved = 0;
  let last = { x: 0, y: 0 };
  const velocity = { x: 0, y: 0 }; // radians per second
  const step = new THREE.Quaternion();
  const axisX = new THREE.Vector3(1, 0, 0);
  const axisY = new THREE.Vector3(0, 1, 0);
  let pulse = 0;
  let hovered = null; // face under the mouse
  let focused = null; // face chosen with the keyboard
  let turnTarget = null; // spin rotation that brings the focused face to the front
  let frontFace = null; // face most turned toward the viewer (used for the label on touch)
  const lift = FACES.map(() => 0); // how far each face's stickers are raised, 0..1

  function rotateBy(rx, ry) {
    step.setFromAxisAngle(axisY, ry);
    spin.quaternion.premultiply(step);
    step.setFromAxisAngle(axisX, rx);
    spin.quaternion.premultiply(step);
  }

  function setHovered(face, point) {
    hovered = face;
    onLabel(face, face === null ? null : point);
  }

  hitEl.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = 0;
    last = { x: e.clientX, y: e.clientY };
    velocity.x = velocity.y = 0;
    turnTarget = null;
    focused = null;
    hitEl.setPointerCapture(e.pointerId);
    hitEl.classList.add('is-dragging');
  });
  hitEl.addEventListener('pointermove', (e) => {
    if (!dragging) {
      if (e.pointerType === 'mouse') setHovered(pick(e.clientX, e.clientY), { x: e.clientX, y: e.clientY });
      return;
    }
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved >= 6 && hovered !== null) setHovered(null);
    const k = 4.5 / window.innerHeight; // a drag the height of the screen is about 260 degrees
    rotateBy(dy * k, dx * k);
    // Remember the latest speed so the cube keeps turning after release.
    velocity.x = dy * k * 60;
    velocity.y = dx * k * 60;
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    hitEl.classList.remove('is-dragging');
    if (moved < 6 && e.type === 'pointerup') {
      // Counts as a click, not a drag.
      velocity.x = velocity.y = 0;
      const face = pick(e.clientX, e.clientY);
      if (face !== null && !onFaceClick(face, { x: e.clientX, y: e.clientY })) pulse = 1;
    }
  };
  hitEl.addEventListener('pointerup', end);
  hitEl.addEventListener('pointercancel', end);
  hitEl.addEventListener('pointerleave', () => {
    if (!dragging && hovered !== null) setHovered(null);
  });

  let inHold = false;
  let live = false;
  const toCamera = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const faceDir = new THREE.Vector3();

  // journey = { descent, moon, outro } each 0..1; restY/liftY are world heights.
  spin.update = (time, dt, journey, { restY, liftY, scale }) => {
    const m = journey.moon;
    const rise = smooth(LIFT[0], LIFT[1], m);

    // Wiggle while still stuck, then rise and turn to the display pose.
    const wiggle =
      Math.sin(m * 70) * 0.07 * smooth(WIGGLE[0], WIGGLE[1], m) * (1 - smooth(WIGGLE[2], WIGGLE[3], m));
    pose.quaternion.slerpQuaternions(wedged, display, rise);
    pose.rotateZ(wiggle);

    // The solve: a pure function of scroll.
    poseCubies(states, (m - SOLVE[0]) / (SOLVE[1] - SOLVE[0]), cubies);

    // The burst sits on top of the solved pose.
    const b = burst.value;
    if (b > 0) {
      for (let j = 0; j < cubies.length; j++) {
        const s = scatter[j];
        cubies[j].position.addScaledVector(s.dir, s.dist * b);
        cubies[j].quaternion.multiply(tumble.setFromAxisAngle(s.axis, s.angle * b));
      }
    }
    fx.setProgress(b);

    const nowInHold = m > 0.995 && journey.outro < 0.005;
    if (nowInHold !== inHold) {
      inHold = nowInHold;
      if (!inHold) {
        dragging = false;
        focused = null;
        turnTarget = null;
        if (hovered !== null) setHovered(null);
        if (frontFace !== null) {
          frontFace = null;
          if (isPhone) onLabel(null, null);
        }
      }
    }
    // Input is only live in the hold, and not while a project is open.
    const nowLive = inHold && b === 0;
    if (nowLive !== live) {
      live = nowLive;
      hitEl.classList.toggle('is-live', live);
    }

    if (inHold) {
      if (turnTarget) {
        spin.quaternion.slerp(turnTarget, 1 - Math.exp(-5 * dt));
      } else if (!dragging) {
        rotateBy(velocity.x * dt, velocity.y * dt);
        const damp = Math.exp(-2.4 * dt); // soft inertia
        velocity.x *= damp;
        velocity.y *= damp;
      }

      // On touch there is no hover, so the face turned toward the viewer shows its title.
      if (isPhone && live) {
        pose.getWorldQuaternion(worldQuat);
        toCamera.copy(camera.position).sub(spin.position).normalize();
        let best = 0;
        let bestDot = -Infinity;
        FACES.forEach((face, index) => {
          const dot = faceDir.set(...face.normal).applyQuaternion(worldQuat).dot(toCamera);
          if (dot > bestDot) {
            bestDot = dot;
            best = index;
          }
        });
        if (best !== frontFace) {
          frontFace = best;
          onLabel(best, null);
        }
      }
    } else {
      // Outside the hold, ease back to the rest pose so un-solve and outro start from a known place.
      velocity.x = velocity.y = 0;
      spin.quaternion.slerp(identity, 1 - Math.exp(-6 * dt));
    }

    // Hovered (or keyboard-focused) face: its nine stickers lift a little.
    const ease = 1 - Math.exp(-12 * dt);
    for (let f = 0; f < lift.length; f++) {
      const target = live && (hovered === f || focused === f) ? 1 : 0;
      lift[f] += (target - lift[f]) * ease;
    }
    for (const sticker of stickers) {
      const { base, normal, face } = sticker.userData;
      sticker.position.copy(base).addScaledVector(normal, lift[face] * 0.11);
    }

    pulse = Math.max(0, pulse - dt * 3);
    const bob = inHold ? Math.sin(time * 1.1) * 0.08 : 0;
    spin.position.y = restY + (liftY - restY) * rise + bob;
    spin.scale.setScalar(scale * (1 + Math.sin(pulse * Math.PI) * 0.06));
  };

  // Keyboard: bring a face round to the front (null lets go).
  const view = new THREE.Vector3(0.26, 0.3, 1).normalize();
  spin.focusFace = (index) => {
    focused = index;
    if (index === null) {
      turnTarget = null;
      return;
    }
    const facing = new THREE.Vector3(...FACES[index].normal).applyQuaternion(display);
    turnTarget = new THREE.Quaternion().setFromUnitVectors(facing, view);
    velocity.x = velocity.y = 0;
  };

  // Called just before a burst so the shards match the clicked face.
  spin.setBurstFace = (index) => fx.setColor(palette.faces[FACES[index].color]);

  spin.isInHold = () => inHold;

  return spin;
}
