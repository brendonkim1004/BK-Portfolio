// The extra bits that fly out when a face is clicked: flat geometric shards and small
// square particles in the face's colour. Everything is a pure function of one number (0..1),
// so playing it backwards reassembles cleanly.
import * as THREE from 'three';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createBurstFx({ isPhone }) {
  const group = new THREE.Group();
  group.visible = false;

  let seed = 23;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const randomDirection = () =>
    new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();

  // ---- shards: one instanced mesh ----
  const shardCount = isPhone ? 16 : 34;
  const shardMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
  const shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.3), shardMat, shardCount);
  shards.frustumCulled = false;
  const shardData = Array.from({ length: shardCount }, () => ({
    dir: randomDirection(),
    dist: 4 + rand() * 8,
    axis: randomDirection(),
    spin: (rand() - 0.5) * 14,
    size: 0.5 + rand() * 1.1,
  }));
  group.add(shards);

  // ---- particles: one Points cloud that simply scales outward ----
  const dotCount = isPhone ? 50 : 130;
  const positions = new Float32Array(dotCount * 3);
  for (let i = 0; i < dotCount; i++) {
    const p = randomDirection().multiplyScalar(3 + rand() * 11);
    positions.set([p.x, p.y, p.z], i * 3);
  }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dotMat = new THREE.PointsMaterial({ size: 0.16, transparent: true, depthWrite: false });
  const dots = new THREE.Points(dotGeo, dotMat);
  dots.frustumCulled = false;
  group.add(dots);

  const dummy = new THREE.Object3D();

  group.setColor = (hex) => {
    shardMat.color.set(hex);
    dotMat.color.set(hex);
  };

  // b: 0 = hidden inside the cube, 1 = fully flown out and faded.
  group.setProgress = (b) => {
    group.visible = b > 0.001;
    if (!group.visible) return;

    // The burst eases out fast, so b is already large early on: fade only near the very end.
    const fade = 1 - smooth(0.82, 1, b);
    shardMat.opacity = fade;
    dotMat.opacity = fade;

    for (let i = 0; i < shardCount; i++) {
      const s = shardData[i];
      dummy.position.copy(s.dir).multiplyScalar(s.dist * b);
      dummy.quaternion.setFromAxisAngle(s.axis, s.spin * b);
      dummy.scale.setScalar(s.size * Math.min(1, b * 5));
      dummy.updateMatrix();
      shards.setMatrixAt(i, dummy.matrix);
    }
    shards.instanceMatrix.needsUpdate = true;
    dots.scale.setScalar(b);
  };

  return group;
}
