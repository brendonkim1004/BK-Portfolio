// Rebuilds the inventory demo and copies its finished pages into public/demos/inventory,
// which is where the portfolio serves them from. Run with: npm run build:demos
//
// The inventory demo is its own small Next.js project (demos/inventory) because the real app
// is written in React. Only its built, static pages are used by the portfolio.
// (The truck tracker demo needs none of this: it is plain JavaScript and Vite builds it directly.)
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';

const project = 'demos/inventory';
const built = `${project}/out`;
const served = 'public/demos/inventory';

if (!existsSync(`${project}/node_modules`)) {
  execSync('npm install', { cwd: project, stdio: 'inherit' });
}
execSync('npm run build', { cwd: project, stdio: 'inherit' });

rmSync(served, { recursive: true, force: true });
cpSync(built, served, { recursive: true });
console.log(`Inventory demo copied to ${served}`);
