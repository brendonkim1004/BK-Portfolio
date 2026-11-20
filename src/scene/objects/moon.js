// The moon: a big toon ball whose top sits at y = 0 of the returned group, with craters on it.
import * as THREE from 'three';
import { palette } from '../../styles/palette.js';
import { toon, toyMesh } from '../materials.js';

export const MOON_RADIUS = 40;

// A crater is a dark disc with a raised rim, laid flat on the surface.
// (tiltX, tiltZ) are small angles away from the top of the moon.
function crater(radius, tiltX = 0, tiltZ = 0) {
  const holder = new THREE.Group(); // rotates about the moon's centre
  holder.rotation.set(tiltX, 0, tiltZ);

  const disc = new THREE.Group(); // sits on the surface; scaling it resizes the crater in place
  disc.position.y = MOON_RADIUS;

  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), toon(palette.moonShade));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.03;

  const rim = toyMesh(new THREE.TorusGeometry(radius, radius * 0.09, 10, 48), palette.moon, { outline: 0.04 });
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -radius * 0.02;

  disc.add(floor, rim);
  holder.add(disc);
  holder.userData.disc = disc;
  return holder;
}

const UP = new THREE.Vector3(0, 1, 0);
const toward = new THREE.Vector3();

export function createMoon() {
  const group = new THREE.Group();
  const centre = new THREE.Group();
  centre.position.y = -MOON_RADIUS;
  group.add(centre);

  centre.add(toyMesh(new THREE.SphereGeometry(MOON_RADIUS, 96, 64), palette.moon, { outline: 0.09 }));

  centre.add(crater(2.7, 0, 0)); // the main one, where the cube is stuck
  // The small ones keep clear of the two side puzzles, which bring their own craters.
  centre.add(crater(1.1, -0.08, 0.1));
  centre.add(crater(0.7, 0.07, -0.12));
  centre.add(crater(1.0, 0.1, -0.2));
  centre.add(crater(0.9, 0.09, 0.22));
  centre.add(crater(0.6, -0.02, 0.09));

  // Adds a crater that can be moved later, for things whose place depends on the screen shape.
  // place(x, z, scale) puts it on the surface at that sideways (x) and front-back (z) offset from the top.
  group.addCrater = (radius) => {
    const holder = crater(radius);
    centre.add(holder);
    return {
      place(x, z, scale = 1) {
        toward.set(x, Math.sqrt(MOON_RADIUS ** 2 - x ** 2 - z ** 2), z).normalize();
        holder.quaternion.setFromUnitVectors(UP, toward);
        holder.userData.disc.scale.setScalar(scale);
      },
      show(visible) {
        holder.visible = visible;
      },
    };
  };

  group.update = () => {};
  return group;
}
