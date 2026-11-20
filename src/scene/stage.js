// Renderer, camera and lights. One fixed canvas behind the page.
import * as THREE from 'three';
import { palette } from '../styles/palette.js';

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(palette.inkDeep);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(0, 0, 14);

  scene.add(new THREE.AmbientLight(0xffffff, 1.05));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(-4, 6, 8);
  scene.add(sun);

  const listeners = new Set();

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const fn of listeners) fn(camera.aspect);
  }
  window.addEventListener('resize', resize);

  return {
    renderer,
    scene,
    camera,
    resize,
    onResize: (fn) => listeners.add(fn),
    render: () => renderer.render(scene, camera),
  };
}
