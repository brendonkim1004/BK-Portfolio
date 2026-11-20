import * as THREE from 'three';
import { test, expect } from 'vitest';
import { HOME, SCRAMBLE, buildStates, poseCubies } from '../src/scene/cube/solve.js';

const makeObjects = () => HOME.map(() => new THREE.Object3D());
const key = (v) => `${Math.round(v.x)},${Math.round(v.y)},${Math.round(v.z)}`;

test('every snapshot fills all 27 grid cells exactly once', () => {
  const states = buildStates();
  expect(states).toHaveLength(SCRAMBLE.length + 1);
  for (const state of states) {
    expect(new Set(state.map((c) => key(c.pos))).size).toBe(27);
  }
});

test('the scramble actually moves pieces', () => {
  const scrambled = buildStates().at(-1);
  const moved = scrambled.filter((c, j) => key(c.pos) !== HOME[j].join(','));
  expect(moved.length).toBeGreaterThan(12);
});

test('progress 1 is exactly solved and progress 0 is exactly the scramble', () => {
  const states = buildStates();
  const objects = makeObjects();

  poseCubies(states, 1, objects);
  objects.forEach((o, j) => {
    expect(o.position.distanceTo(new THREE.Vector3(...HOME[j]))).toBeLessThan(1e-9);
    expect(Math.abs(o.quaternion.w)).toBeCloseTo(1, 9);
  });

  poseCubies(states, 0, objects);
  objects.forEach((o, j) => {
    expect(o.position.distanceTo(states.at(-1)[j].pos)).toBeLessThan(1e-9);
    expect(o.quaternion.angleTo(states.at(-1)[j].quat)).toBeLessThan(1e-6);
  });
});

test('the pose is continuous across the join between two moves', () => {
  const states = buildStates();
  const before = makeObjects();
  const after = makeObjects();
  for (let move = 1; move < SCRAMBLE.length; move++) {
    const p = move / SCRAMBLE.length;
    poseCubies(states, p - 1e-7, before);
    poseCubies(states, p + 1e-7, after);
    before.forEach((o, j) => {
      expect(o.position.distanceTo(after[j].position)).toBeLessThan(1e-3);
      expect(o.quaternion.angleTo(after[j].quaternion)).toBeLessThan(1e-3);
    });
  }
});

test('scrubbing forward and back lands on the same pose', () => {
  const states = buildStates();
  const first = makeObjects();
  const again = makeObjects();
  poseCubies(states, 0.37, first);
  for (const p of [0.9, 0.1, 1, 0, 0.62, 0.37]) poseCubies(states, p, again);
  first.forEach((o, j) => {
    expect(o.position.equals(again[j].position)).toBe(true);
    expect(o.quaternion.equals(again[j].quaternion)).toBe(true);
  });
});
