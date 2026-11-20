// Runs after `next build` (see "build" in package.json).
//
// When you hover a link, Next quietly fetches a small data file for the page
// behind it, e.g.  scan/__next.scan.__PAGE__.txt  (dots all the way).
// The static export writes that same file into nested folders instead:
//                   scan/__next.scan/__PAGE__.txt
// A plain file host can't translate one into the other, so every hover would
// log a 404. This script copies each nested file to the dotted name the
// browser actually asks for. Nothing else in out/ is touched.

import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "out");
let copied = 0;

// Copy every file under `dir` up into `routeDir`, joining the folder names
// with dots:  __next.admin/labels/__PAGE__.txt -> __next.admin.labels.__PAGE__.txt
function flatten(routeDir, dir, dottedName) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const from = path.join(dir, entry.name);
    const name = `${dottedName}.${entry.name}`;
    if (entry.isDirectory()) {
      flatten(routeDir, from, name);
    } else {
      fs.copyFileSync(from, path.join(routeDir, name));
      copied += 1;
    }
  }
}

// Look through every folder in out/ for "__next.something" folders.
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith("__next.")) flatten(dir, full, entry.name);
    else if (entry.name !== "_next") walk(full);
  }
}

if (!fs.existsSync(OUT)) {
  console.error("fix-export: no out/ folder — did the build run?");
  process.exit(1);
}
walk(OUT);
console.log(`fix-export: wrote ${copied} link-preload files with dotted names.`);
