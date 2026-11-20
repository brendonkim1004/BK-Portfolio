// A plain box standing in for the Rubik's cube, so the scroll -> hold -> drag -> outro
// handoff can be tested before the real cube exists (Milestone 3 replaces this file).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { palette } from '../styles/palette.js';
import { addOutline, toon } from './materials.js';

const SIZE = 3;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// hitEl is the transparent element over the cube that receives drags during the hold.
export function createGreyBox(hitEl) {
  // spin (drag rotation, world axes) > pose (scroll-driven tilt) > mesh
  const spin = new THREE.Group();
  const pose = new THREE.Group();
  spin.add(pose);

  // One grey per face so rotation is visible.
  const greys = ['#D9D6CC', '#8C8A84', '#F1EEE3', '#6F6E6A', '#BDBAB1', '#A4A29A'];
  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(SIZE, SIZE, SIZE, 4, 0.28),
    greys.map((hex) => toon(hex)),
  );
  addOutline(mesh, 0.07);
  pose.add(mesh);

  const wedged = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, 0.5, 0.35));
  const display = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.48, -0.7, 0));
  const identity = new THREE.Quaternion();

  // ---- drag with inertia ----
  let dragging = false;
  let moved = 0;
  let last = { x: 0, y: 0 };
  const velocity = { x: 0, y: 0 }; // radians per second
  const step = new THREE.Quaternion();
  const axisX = new THREE.Vector3(1, 0, 0);
  const axisY = new THREE.Vector3(0, 1, 0);
  let pulse = 0;

  function rotateBy(rx, ry) {
    step.setFromAxisAngle(axisY, ry);
    spin.quaternion.premultiply(step);
    step.setFromAxisAngle(axisX, rx);
    spin.quaternion.premultiply(step);
  }

  hitEl.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = 0;
    last = { x: e.clientX, y: e.clientY };
    velocity.x = velocity.y = 0;
    hitEl.setPointerCapture(e.pointerId);
    hitEl.classList.add('is-dragging');
  });
  hitEl.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    moved += Math.abs(dx) + Math.abs(dy);
    const k = 4.5 / window.innerHeight; // a drag the height of the screen is about 260 degrees
    rotateBy(dy * k, dx * k);
    // Remember the latest speed so the box keeps turning after release.
    velocity.x = dy * k * 60;
    velocity.y = dx * k * 60;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    hitEl.classList.remove('is-dragging');
    if (moved < 6) {
      // Counts as a click, not a drag. The real cube opens a project here.
      velocity.x = velocity.y = 0;
      pulse = 1;
    }
  };
  hitEl.addEventListener('pointerup', end);
  hitEl.addEventListener('pointercancel', end);

  let inHold = false;

  // journey = { descent, moon, outro } each 0..1; restY/liftY are world heights.
  spin.update = (time, dt, journey, { restY, liftY, scale }) => {
    const m = journey.moon;
    const lift = smooth(0.35, 1, m);

    // Wiggle while still stuck, then rise and turn to the display pose.
    const wiggle = Math.sin(m * 46) * 0.07 * smooth(0, 0.3, m) * (1 - lift);
    pose.quaternion.slerpQuaternions(wedged, display, lift);
    pose.rotateZ(wiggle);
    pose.rotateY((1 - lift) * -1.2 * smooth(0.35, 0.5, m));

    const nowInHold = m > 0.995 && journey.outro < 0.005;
    if (nowInHold !== inHold) {
      inHold = nowInHold;
      hitEl.classList.toggle('is-live', inHold);
      if (!inHold) dragging = false;
    }

    if (inHold) {
      if (!dragging) {
        rotateBy(velocity.x * dt, velocity.y * dt);
        const damp = Math.exp(-2.4 * dt); // soft inertia
        velocity.x *= damp;
        velocity.y *= damp;
      }
    } else {
      // Outside the hold, ease back to the rest pose so un-solve and outro start from a known place.
      velocity.x = velocity.y = 0;
      spin.quaternion.slerp(identity, 1 - Math.exp(-6 * dt));
    }

    pulse = Math.max(0, pulse - dt * 3);
    const bob = inHold ? Math.sin(time * 1.1) * 0.08 : 0;
    spin.position.y = restY + (liftY - restY) * lift + bob;
    spin.scale.setScalar(scale * (1 + Math.sin(pulse * Math.PI) * 0.06));
  };

  return spin;
}
