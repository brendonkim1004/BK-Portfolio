// The moon: a big toon ball whose top sits at y = 0 of the returned group, with craters on it.
import * as THREE from 'three';
import { palette } from '../../styles/palette.js';
import { toon, toyMesh } from '../materials.js';

export const MOON_RADIUS = 40;

// A crater is a dark disc with a raised rim, laid flat on the surface.
// (tiltX, tiltZ) are small angles away from the top of the moon.
function crater(radius, tiltX, tiltZ) {
  const holder = new THREE.Group(); // rotates about the moon's centre
  holder.rotation.set(tiltX, 0, tiltZ);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), toon(palette.moonShade));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = MOON_RADIUS + 0.03;

  const rim = toyMesh(new THREE.TorusGeometry(radius, radius * 0.09, 10, 48), palette.moon, { outline: 0.04 });
  rim.rotation.x = Math.PI / 2;
  rim.position.y = MOON_RADIUS - radius * 0.02;

  holder.add(floor, rim);
  return holder;
}

export function createMoon() {
  const group = new THREE.Group();
  const centre = new THREE.Group();
  centre.position.y = -MOON_RADIUS;
  group.add(centre);

  centre.add(toyMesh(new THREE.SphereGeometry(MOON_RADIUS, 96, 64), palette.moon, { outline: 0.09 }));

  centre.add(crater(2.7, 0, 0)); // the main one, where the cube is stuck
  centre.add(crater(1.1, 0.02, 0.14));
  centre.add(crater(0.7, 0.07, -0.12));
  centre.add(crater(1.5, -0.03, -0.2));
  centre.add(crater(0.9, 0.09, 0.22));
  centre.add(crater(0.6, -0.02, 0.09));

  group.update = () => {};
  return group;
}
