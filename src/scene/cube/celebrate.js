// The little "done!" moment when the cube finishes solving: a ring of small stickers in the
// cube's six colours pops outward and shrinks away. One number (0..1) drives all of it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { palette } from '../../styles/palette.js';

export function createCelebration({ count = 18 } = {}) {
  // Unlit, so the stickers stay as bright as their palette colours.
  const mesh = new THREE.InstancedMesh(
    new RoundedBoxGeometry(0.34, 0.34, 0.1, 2, 0.04),
    new THREE.MeshBasicMaterial(),
    count,
  );
  mesh.frustumCulled = false;
  mesh.visible = false;

  let seed = 31;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const colors = Object.values(palette.cube);
  const tint = new THREE.Color();
  const bits = [];
  for (let i = 0; i < count; i++) {
    mesh.setColorAt(i, tint.set(colors[i % colors.length]));
    // Evenly round a circle facing the viewer, each with its own reach and tumble.
    const angle = (i / count) * Math.PI * 2 + rand() * 0.25;
    bits.push({
      dir: new THREE.Vector3(Math.cos(angle), Math.sin(angle), (rand() - 0.5) * 0.6),
      reach: 1.6 + rand() * 1.4,
      axis: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
      spin: (rand() - 0.5) * 10,
    });
  }

  const dummy = new THREE.Object3D();

  // c: 0 = nothing, 1 = finished. startRadius is how far from the centre they begin (the cube's edge).
  mesh.setProgress = (c, startRadius = 2.3) => {
    mesh.visible = c > 0.001 && c < 0.999;
    if (!mesh.visible) return;
    const out = 1 - (1 - c) ** 3; // quick at first, then slowing
    const size = Math.sin(Math.PI * Math.min(1, c * 1.05)) ** 0.6; // pops in, shrinks away
    for (let i = 0; i < count; i++) {
      const b = bits[i];
      dummy.position.copy(b.dir).multiplyScalar(startRadius + b.reach * out);
      dummy.quaternion.setFromAxisAngle(b.axis, b.spin * c);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  return mesh;
}
