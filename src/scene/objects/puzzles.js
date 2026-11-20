// Two more puzzles stuck in the moon either side of the cube: a Pyraminx (pyramid) and a
// Megaminx (twelve-sided). They are placeholders for future projects and only say "Coming Soon".
// Like every object, each exports a create function that returns a Group with update().
import * as THREE from 'three';
import { palette } from '../../styles/palette.js';
import { addOutline, toon } from '../materials.js';

const STICKER_LIFT = 0.02; // stickers sit just proud of the body so they never flicker against it

// Pulls a shape's corners toward its middle, leaving a dark gap around it.
function shrink(points, amount) {
  const centre = points.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(points.length);
  return points.map((p) => centre.clone().lerp(p, amount));
}

// Turns flat shapes into meshes, one mesh per colour.
// shapes: [{ points: Vector3[], normal: Vector3, color: hex }]
function stickerMeshes(shapes) {
  const byColor = new Map();
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();

  for (const { points, normal, color } of shapes) {
    if (!byColor.has(color)) byColor.set(color, { positions: [], normals: [] });
    const { positions, normals } = byColor.get(color);
    // Make sure the corners go anticlockwise seen from outside, so the front face is the visible one.
    edgeA.subVectors(points[1], points[0]);
    edgeB.subVectors(points[2], points[0]);
    const ordered = edgeA.cross(edgeB).dot(normal) < 0 ? [...points].reverse() : points;
    for (let i = 1; i < ordered.length - 1; i++) {
      for (const p of [ordered[0], ordered[i], ordered[i + 1]]) {
        positions.push(p.x + normal.x * STICKER_LIFT, p.y + normal.y * STICKER_LIFT, p.z + normal.z * STICKER_LIFT);
        normals.push(normal.x, normal.y, normal.z);
      }
    }
  }

  return [...byColor].map(([color, { positions, normals }]) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return new THREE.Mesh(geo, toon(color));
  });
}

// Wraps a body and its stickers in three nested groups:
// the outer one is placed by the scene, "hop" does the little hop and wiggle on hover,
// and "tilted" holds the puzzle at its resting angle.
function puzzle(body, shapes, orientation) {
  const group = new THREE.Group();
  const hop = new THREE.Group();
  const tilted = new THREE.Group();
  tilted.add(addOutline(body, 0.05), ...stickerMeshes(shapes));
  tilted.quaternion.copy(orientation);
  hop.add(tilted);
  group.add(hop);

  // hover: 0..1, eased by the scene.
  group.update = (time, hover = 0) => {
    hop.position.y = hover * 0.3;
    hop.rotation.z = Math.sin(time * 9) * 0.07 * hover;
    hop.scale.setScalar(1 + hover * 0.07);
  };
  return group;
}

const UP = new THREE.Vector3(0, 1, 0);
// A lean (x, y, z angles) applied after the puzzle has been stood the right way up.
const lean = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

// ---- Pyraminx: four triangular faces, each cut into nine small triangles ----
export function createPyraminx(radius = 1.7) {
  const corners = [
    [1, 1, 1],
    [-1, -1, 1],
    [-1, 1, -1],
    [1, -1, -1],
  ].map((c) => new THREE.Vector3(...c).multiplyScalar(radius / Math.sqrt(3)));
  const colors = [palette.faces.yellow, palette.faces.green, palette.faces.red, palette.faces.blue];

  const shapes = [];
  corners.forEach((opposite, f) => {
    // A face is the three corners that are not "opposite"; it points away from that corner.
    const [a, b, c] = corners.filter((corner) => corner !== opposite);
    const normal = opposite.clone().normalize().negate();
    const at = (i, j) =>
      a.clone().addScaledVector(b.clone().sub(a), i / 3).addScaledVector(c.clone().sub(a), j / 3);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3 - i; j++) {
        shapes.push({ points: shrink([at(i, j), at(i + 1, j), at(i, j + 1)], 0.76), normal, color: colors[f] });
        if (i + j < 2) {
          shapes.push({
            points: shrink([at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)], 0.76),
            normal,
            color: colors[f],
          });
        }
      }
    }
  });

  const body = new THREE.Mesh(new THREE.TetrahedronGeometry(radius), toon(palette.cubeBody));
  // Stand it on one face with a point straight up, then lean it a little, as if it landed that way.
  const upright = new THREE.Quaternion().setFromUnitVectors(corners[0].clone().normalize(), UP);
  return puzzle(body, shapes, lean(0.12, 0.5, 0.2).multiply(upright));
}

// ---- Megaminx: twelve five-sided faces, each a centre piece ringed by five more ----
export function createMegaminx(radius = 1.3) {
  const phi = (1 + Math.sqrt(5)) / 2;
  const inv = 1 / phi;
  const signs = [-1, 1];

  // The 20 corners of a dodecahedron.
  const corners = [];
  for (const x of signs) {
    for (const y of signs) {
      for (const z of signs) corners.push([x, y, z]);
      corners.push([0, x * inv, y * phi], [x * inv, y * phi, 0], [x * phi, 0, y * inv]);
    }
  }
  const points = corners.map((c) => new THREE.Vector3(...c).multiplyScalar(radius / Math.sqrt(3)));

  // Its 12 faces point along these directions.
  const normals = [];
  for (const x of signs) {
    for (const y of signs) {
      normals.push([0, x * phi, y], [x, 0, y * phi], [x * phi, y, 0]);
    }
  }

  const colors = Object.values(palette.faces);
  const shapes = [];
  normals.forEach((direction, f) => {
    const normal = new THREE.Vector3(...direction).normalize();
    // The face's five corners are the ones furthest along its direction, taken in order round the face.
    const five = [...points].sort((p, q) => q.dot(normal) - p.dot(normal)).slice(0, 5);
    const centre = five.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(5);
    const u = five[0].clone().sub(centre).normalize();
    const w = normal.clone().cross(u);
    const angle = (p) => Math.atan2(p.clone().sub(centre).dot(w), p.clone().sub(centre).dot(u));
    five.sort((p, q) => angle(p) - angle(q));

    const ring = (scale) => five.map((p) => centre.clone().lerp(p, scale));
    const outer = ring(0.88);
    const middle = ring(0.5);
    const color = colors[f % colors.length];
    shapes.push({ points: ring(0.4), normal, color });
    for (let k = 0; k < 5; k++) {
      const next = (k + 1) % 5;
      shapes.push({ points: shrink([outer[k], outer[next], middle[next], middle[k]], 0.86), normal, color });
    }
  });

  const body = new THREE.Mesh(new THREE.DodecahedronGeometry(radius), toon(palette.cubeBody));
  return puzzle(body, shapes, lean(0.35, -0.4, 0.2));
}
