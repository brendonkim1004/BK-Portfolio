// Shared toy-look materials: flat toon shading plus a slightly wobbly outline shell.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from '../styles/palette.js';

// Three flat tone steps (shadow, mid, lit) instead of a smooth gradient.
const toneSteps = new THREE.DataTexture(new Uint8Array([120, 195, 255]), 3, 1, THREE.RedFormat);
toneSteps.minFilter = THREE.NearestFilter;
toneSteps.magFilter = THREE.NearestFilter;
toneSteps.needsUpdate = true;

const toonCache = new Map();

// One material per colour, reused everywhere.
export function toon(hex) {
  if (!toonCache.has(hex)) {
    toonCache.set(hex, new THREE.MeshToonMaterial({ color: hex, gradientMap: toneSteps }));
  }
  return toonCache.get(hex);
}

const outlineCache = new Map();

function outlineMaterial(thickness) {
  if (!outlineCache.has(thickness)) {
    const mat = new THREE.MeshBasicMaterial({ color: palette.outline, side: THREE.BackSide });
    // Push every vertex out along its normal, by a slightly uneven amount, so the line looks hand-cut.
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
         float wobble = sin(position.x * 5.0 + position.y * 3.7) * sin(position.z * 4.3 + position.y * 2.1);
         transformed += normalize(normal) * ${thickness.toFixed(4)} * (1.0 + 0.35 * wobble);`,
      );
    };
    outlineCache.set(thickness, mat);
  }
  return outlineCache.get(thickness);
}

// Adds a dark shell just outside the mesh. The shell uses merged, averaged normals
// so it does not split open at hard corners.
export function addOutline(mesh, thickness = 0.06) {
  const geo = mesh.geometry.clone();
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const merged = mergeVertices(geo);
  merged.computeVertexNormals();
  const shell = new THREE.Mesh(merged, outlineMaterial(thickness));
  shell.name = 'outline';
  mesh.add(shell);
  return mesh;
}

// Convenience: a toon mesh with an outline.
export function toyMesh(geometry, hex, { outline = 0.06 } = {}) {
  const mesh = new THREE.Mesh(geometry, toon(hex));
  if (outline > 0) addOutline(mesh, outline);
  return mesh;
}
