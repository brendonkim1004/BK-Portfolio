// Satellite, asteroids and comet. Each returns a Group with an update(time) method.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from '../../styles/palette.js';
import { toyMesh } from '../materials.js';

export function createSatellite() {
  const group = new THREE.Group();
  const body = toyMesh(new RoundedBoxGeometry(1.3, 1.3, 1.3, 4, 0.22), palette.moon, { outline: 0.06 });
  const eye = toyMesh(new THREE.SphereGeometry(0.34, 20, 14), palette.faces.yellow, { outline: 0.04 });
  eye.position.z = 0.6;
  eye.scale.z = 0.5;
  const mast = toyMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), palette.cream, { outline: 0.03 });
  mast.position.y = 1.0;
  const bulb = toyMesh(new THREE.SphereGeometry(0.14, 12, 10), palette.faces.red, { outline: 0.03 });
  bulb.position.y = 1.45;
  group.add(body, eye, mast, bulb);

  for (const side of [-1, 1]) {
    const arm = toyMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), palette.moonShade, { outline: 0.03 });
    arm.rotation.z = Math.PI / 2;
    arm.position.x = side * 0.85;
    const panel = toyMesh(new RoundedBoxGeometry(1.5, 0.9, 0.1, 2, 0.05), palette.faces.blue, { outline: 0.05 });
    panel.position.x = side * 1.8;
    group.add(arm, panel);
  }

  // Clicking it sets it spinning (see planets.js for how spinnables work).
  const spin = { hit: group, angle: 0, speed: 0 };
  group.spinnables = [spin];

  group.rotation.set(0.3, -0.5, 0.25);
  group.update = (time) => {
    group.rotation.z = 0.25 + Math.sin(time * 0.4) * 0.12;
    group.rotation.y = -0.5 + Math.sin(time * 0.25) * 0.25 + spin.angle;
    group.position.y = group.userData.homeY + Math.sin(time * 0.45 + 0.7) * 0.2;
  };
  return group;
}

// A lumpy low-poly rock. Seed keeps each one's shape the same on every visit.
function rock(radius, seed, color) {
  let geo = new THREE.IcosahedronGeometry(radius, 1);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const n = Math.sin((i + 1) * 12.9898 * seed) * 43758.5453;
    const k = 0.82 + (n - Math.floor(n)) * 0.36;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  // Un-share the corners so every face gets its own flat shade (the low-poly look).
  const faceted = geo.toNonIndexed();
  faceted.computeVertexNormals();
  return toyMesh(faceted, color, { outline: radius * 0.07 });
}

// A loose cluster of rocks. layout = [[x, y, z, radius], ...]
export function createAsteroids(layout, seed = 1) {
  const group = new THREE.Group();
  const rocks = layout.map(([x, y, z, r], i) => {
    const mesh = rock(r, seed + i * 0.37, i % 2 ? palette.moon : palette.moonShade);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  });
  // Each rock spins on its own when clicked (see planets.js for how spinnables work).
  group.spinnables = rocks.map((mesh) => ({ hit: mesh, angle: 0, speed: 0 }));

  group.update = (time) => {
    rocks.forEach((mesh, i) => {
      mesh.rotation.x = time * (0.12 + i * 0.05);
      mesh.rotation.y = time * (0.18 - i * 0.03) + group.spinnables[i].angle;
    });
    group.position.y = group.userData.homeY + Math.sin(time * 0.35 + seed) * 0.15;
  };
  return group;
}

export function createComet() {
  const group = new THREE.Group();
  const head = toyMesh(new THREE.SphereGeometry(0.55, 24, 16), palette.cream, { outline: 0.05 });
  const tail = toyMesh(new THREE.ConeGeometry(0.5, 3.2, 16), palette.faces.yellow, { outline: 0.05 });
  tail.rotation.z = -Math.PI / 2; // point the tip along +x, away from the head
  tail.position.x = 1.7;
  const puffs = [0.22, 0.15, 0.1].map((r, i) => {
    const puff = toyMesh(new THREE.SphereGeometry(r, 12, 10), palette.faces.orange, { outline: 0.03 });
    puff.position.set(3.6 + i * 0.55, (i % 2 ? -1 : 1) * 0.15, 0);
    group.add(puff);
    return puff;
  });
  group.add(tail, head); // head last so it sits over the tail's base
  group.rotation.z = -0.45;

  group.update = (time) => {
    // Slow glide back and forth along its own direction.
    const slide = Math.sin(time * 0.3) * 0.8;
    group.position.x = group.userData.homeX - slide;
    group.position.y = group.userData.homeY - slide * 0.45;
    puffs.forEach((puff, i) => puff.scale.setScalar(0.8 + Math.sin(time * 3 + i) * 0.2));
  };
  return group;
}
