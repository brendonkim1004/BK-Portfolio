// Builds the 27 cubies: a dark rounded body each, with chunky colour stickers on the outside faces.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { palette } from '../../styles/palette.js';
import { addOutline, toon } from '../materials.js';
import { HOME } from './solve.js';

// The six faces. "color" is a key in palette.faces and is what projects.js maps to.
export const FACES = [
  { normal: [1, 0, 0], color: 'red' },
  { normal: [-1, 0, 0], color: 'orange' },
  { normal: [0, 1, 0], color: 'yellow' },
  { normal: [0, -1, 0], color: 'green' },
  { normal: [0, 0, 1], color: 'blue' },
  { normal: [0, 0, -1], color: 'pink' },
];

const BODY = 0.95; // cubie size; the small gap between cubies reads as a dark seam
const STICKER = 0.76;
const STICKER_DEPTH = 0.05;

// A rounded square, slightly thick so it can visibly lift off the cubie on hover.
function stickerGeometry() {
  const h = STICKER / 2;
  const r = 0.13;
  const shape = new THREE.Shape();
  shape.moveTo(-h + r, -h);
  shape.lineTo(h - r, -h);
  shape.quadraticCurveTo(h, -h, h, -h + r);
  shape.lineTo(h, h - r);
  shape.quadraticCurveTo(h, h, h - r, h);
  shape.lineTo(-h + r, h);
  shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r);
  shape.quadraticCurveTo(-h, -h, -h + r, -h);
  return new THREE.ExtrudeGeometry(shape, { depth: STICKER_DEPTH, bevelEnabled: false, curveSegments: 5 });
}

// Returns { cubies, stickers }. cubies are in the same order as HOME.
// Each sticker remembers its face index, resting position and outward direction.
export function buildCubies() {
  // One body (with its outline shell) is built once and cloned, so all 27 share geometry.
  const bodyProto = addOutline(
    new THREE.Mesh(new RoundedBoxGeometry(BODY, BODY, BODY, 3, 0.13), toon(palette.cubeBody)),
    0.03,
  );
  const stickerGeo = stickerGeometry();
  const forward = new THREE.Vector3(0, 0, 1);

  const cubies = [];
  const stickers = [];

  for (const home of HOME) {
    const cubie = new THREE.Group();
    cubie.add(bodyProto.clone());

    FACES.forEach((face, index) => {
      // A cubie only has a sticker on sides that face outward.
      const outward = face.normal.some((n, axis) => n !== 0 && n === home[axis]);
      if (!outward) return;
      const normal = new THREE.Vector3(...face.normal);
      const sticker = new THREE.Mesh(stickerGeo, toon(palette.faces[face.color]));
      sticker.quaternion.setFromUnitVectors(forward, normal);
      sticker.position.copy(normal).multiplyScalar(BODY / 2 - 0.01);
      sticker.userData = { face: index, base: sticker.position.clone(), normal };
      cubie.add(sticker);
      stickers.push(sticker);
    });

    cubies.push(cubie);
  }
  return { cubies, stickers };
}
