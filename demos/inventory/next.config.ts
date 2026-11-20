import type { NextConfig } from "next";

// This is the static, fake-data demo of the inventory app. It is exported as
// plain files (no server) and served from a sub-folder of the portfolio site.
const nextConfig: NextConfig = {
  // Build to plain HTML/JS/CSS in out/ — there is no server in the demo.
  output: "export",
  // The demo lives at <portfolio>/demos/inventory/. Keep this in step with
  // BASE_PATH in lib/demo/basePath.ts.
  basePath: "/demos/inventory",
  // Every route becomes a folder with an index.html, so any static host works.
  trailingSlash: true,
  // No image optimisation server in a static export.
  images: { unoptimized: true },
  // Pin the workspace root to this folder so Next doesn't pick up a lockfile
  // from a parent folder.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
