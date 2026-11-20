// Planets. Each create function returns a Group with an update(time) method for idle drift.
// group.spinnables lists the parts that spin when clicked: "hit" is what the click lands on,
// and the scene keeps "angle" (extra turn, in radians) and "speed" up to date.
import * as THREE from 'three';
import { palette } from '../../styles/palette.js';
import { toyMesh } from '../materials.js';

export function createRingedPlanet() {
  const group = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.set(0.5, 0, -0.35);
  group.add(tilt);

  const ball = toyMesh(new THREE.SphereGeometry(1.6, 40, 28), palette.faces.orange, { outline: 0.07 });
  const stripe = toyMesh(new THREE.SphereGeometry(1.615, 40, 8, 0, Math.PI * 2, 1.25, 0.3), palette.faces.yellow, {
    outline: 0,
  });
  const ring = toyMesh(new THREE.TorusGeometry(2.55, 0.26, 12, 64), palette.faces.pink, { outline: 0.06 });
  ring.rotation.x = Math.PI / 2;
  ring.scale.set(1, 1, 0.35); // squash the tube so the ring reads as a flat band
  tilt.add(ball, stripe, ring);

  // A plain ball turning on its own axis would not show, so a click swings the whole tilted planet round.
  const spin = { hit: group, angle: 0, speed: 0 };
  group.spinnables = [spin];

  group.update = (time) => {
    group.rotation.y = spin.angle;
    ball.rotation.y = time * 0.15;
    stripe.rotation.y = time * 0.15;
    group.position.y = group.userData.homeY + Math.sin(time * 0.5) * 0.18;
    tilt.rotation.z = -0.35 + Math.sin(time * 0.3) * 0.04;
  };
  return group;
}

export function createSmallPlanet(color = palette.faces.green, spotColor = palette.faces.blue) {
  const group = new THREE.Group();
  const ball = toyMesh(new THREE.SphereGeometry(0.9, 32, 22), color, { outline: 0.06 });
  group.add(ball);

  // A few flat spots stuck on the surface.
  const spots = [
    [0.4, 0.5, 0.28],
    [-0.5, -0.1, 0.2],
    [0.1, -0.55, 0.16],
  ];
  for (const [x, y, r] of spots) {
    const spot = toyMesh(new THREE.SphereGeometry(r, 16, 12), spotColor, { outline: 0 });
    const dir = new THREE.Vector3(x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))).normalize();
    spot.position.copy(dir.multiplyScalar(0.84));
    spot.scale.setScalar(0.9);
    ball.add(spot);
  }

  // A tiny moon going round it.
  const orbit = new THREE.Group();
  orbit.rotation.set(0.5, 0, 0.3);
  const pebble = toyMesh(new THREE.SphereGeometry(0.2, 16, 12), palette.cream, { outline: 0.04 });
  pebble.position.x = 1.6;
  orbit.add(pebble);
  group.add(orbit);

  const spin = { hit: ball, angle: 0, speed: 0 };
  group.spinnables = [spin];

  group.update = (time) => {
    ball.rotation.y = time * 0.25 + spin.angle;
    orbit.rotation.y = time * 0.7 + spin.angle * 0.4; // its little moon gets dragged along too
    group.position.y = group.userData.homeY + Math.sin(time * 0.6 + 1.3) * 0.15;
  };
  return group;
}
