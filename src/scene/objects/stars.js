// Stars: one Points cloud filling the whole column of space the camera travels through.
import * as THREE from 'three';
import { palette } from '../../styles/palette.js';

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

// top/bottom are world y values; count is lower on phones.
export function createStars({ count, top, bottom }) {
  const positions = new Float32Array(count * 3);
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (rand() - 0.5) * 90;
    positions[i * 3 + 1] = bottom + rand() * (top - bottom);
    positions[i * 3 + 2] = -12 - rand() * 45;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: palette.cream,
    size: 0.32,
    map: dotTexture(),
    transparent: true,
    alphaTest: 0.5,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.update = () => {};
  return points;
}
