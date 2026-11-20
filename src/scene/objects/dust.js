// The dust puff kicked up when the cube pulls free of the crater.
// A ring of soft blobs whose size and position depend only on the cube's release progress,
// so rewinding the release plays the puff in reverse.
import * as THREE from 'three';
import { palette } from '../../styles/palette.js';
import { toon } from '../materials.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function createDust({ count = 11, start = 0.23, length = 0.32 } = {}) {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const mat = toon(palette.dust);

  let seed = 5;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const puffs = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(0);
    group.add(mesh);
    puffs.push({
      mesh,
      angle: (i / count) * Math.PI * 2 + rand() * 0.5,
      reach: 1.5 + rand() * 2.2, // how far it rolls outward
      height: 0.5 + rand() * 1.5,
      size: 0.32 + rand() * 0.42,
      delay: rand() * 0.07,
    });
  }

  // m is the cube's release progress, 0..1.
  group.setProgress = (m) => {
    for (const p of puffs) {
      const u = clamp01((m - start - p.delay) / length);
      const out = 1 - (1 - u) ** 3; // quick at first, then slowing
      const r = 1.4 + p.reach * out;
      p.mesh.position.set(Math.cos(p.angle) * r, 0.15 + p.height * out, Math.sin(p.angle) * r * 0.7);
      // Swells up fast, then shrinks away to nothing.
      p.mesh.scale.setScalar(p.size * Math.sin(Math.PI * Math.sqrt(u)));
    }
  };

  return group;
}
