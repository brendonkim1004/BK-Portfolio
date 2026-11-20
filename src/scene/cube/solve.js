// The cube's maths, with no drawing in it.
// The scramble is a fixed list of quarter turns. We store where every cubie sits after
// each move ("snapshots"), so the cube's look is a pure function of solve progress:
// scrolling back un-solves exactly, with no drift.
import * as THREE from 'three';

const AXES = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

// Home grid position of each of the 27 cubies, each coordinate -1, 0 or 1.
export const HOME = [];
for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) HOME.push([x, y, z]);
  }
}

// [axis, layer, direction]: turn the layer at axis = layer by a quarter turn.
// Neighbouring moves never share an axis, so none of them cancel out.
export const SCRAMBLE = [
  ['y', 1, 1],
  ['x', 1, -1],
  ['z', 1, 1],
  ['y', -1, -1],
  ['x', -1, 1],
  ['z', -1, -1],
  ['y', 1, -1],
  ['x', 1, 1],
  ['z', 1, -1],
  ['x', -1, -1],
  ['y', -1, 1],
  ['z', 1, 1],
  ['x', 1, 1],
];

// After a quarter turn every quaternion part is 0, 0.5, 0.707 or 1. Snap to those
// exact values so tiny rounding errors never pile up.
const EXACT = [0, 0.5, Math.SQRT1_2, 1];
function snap(q) {
  for (const key of ['x', 'y', 'z', 'w']) {
    const size = Math.abs(q[key]);
    let best = 0;
    for (const value of EXACT) if (Math.abs(value - size) < Math.abs(best - size)) best = value;
    q[key] = Math.sign(q[key]) * best;
  }
  return q.normalize();
}

// states[k] = every cubie's grid position and rotation after the first k scramble moves.
// states[0] is solved, states[SCRAMBLE.length] is fully scrambled.
export function buildStates() {
  let current = HOME.map(([x, y, z]) => ({
    pos: new THREE.Vector3(x, y, z),
    quat: new THREE.Quaternion(),
  }));
  const states = [current];
  const quarter = new THREE.Quaternion();

  for (const [axis, layer, dir] of SCRAMBLE) {
    quarter.setFromAxisAngle(AXES[axis], (dir * Math.PI) / 2);
    current = current.map(({ pos, quat }) => {
      if (Math.round(pos[axis]) !== layer) return { pos: pos.clone(), quat: quat.clone() };
      return {
        pos: pos.clone().applyQuaternion(quarter).round(),
        quat: snap(quat.clone().premultiply(quarter)),
      };
    });
    states.push(current);
  }
  return states;
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const turn = new THREE.Quaternion();

// Sets each object's position and rotation for solve progress p (0 = scrambled, 1 = solved).
// objects are in the same order as HOME.
export function poseCubies(states, p, objects) {
  const n = SCRAMBLE.length;
  const s = Math.min(1, Math.max(0, p)) * n;
  const i = Math.min(n - 1, Math.floor(s));
  const k = n - i; // start from the snapshot after k moves, then undo move k
  const [axis, layer, dir] = SCRAMBLE[k - 1];
  turn.setFromAxisAngle(AXES[axis], ((-dir * Math.PI) / 2) * easeInOut(s - i));

  const snapshot = states[k];
  for (let j = 0; j < objects.length; j++) {
    const object = objects[j];
    object.position.copy(snapshot[j].pos);
    object.quaternion.copy(snapshot[j].quat);
    // The turning layer swings around the cube's centre: position and rotation together.
    if (Math.round(snapshot[j].pos[axis]) === layer) {
      object.position.applyQuaternion(turn);
      object.quaternion.premultiply(turn);
    }
  }
}
