import { defineConfig } from 'vite';

// The real site, two decision pages (type test, storyboard), and the truck tracker demo.
// The inventory demo is a folder of ready-made pages in public/demos/inventory. Its links end
// in "/" (for example /demos/inventory/stock/), so the dev server is told to serve the
// index.html inside that folder, the way a normal web host does.
const inventoryDemoPages = {
  name: 'inventory-demo-pages',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const [path, query] = req.url.split('?');
      if (path.startsWith('/demos/inventory/') && path.endsWith('/')) {
        req.url = `${path}index.html${query ? `?${query}` : ''}`;
      }
      next();
    });
  },
};

export default defineConfig({
  plugins: [inventoryDemoPages],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        typeTest: 'type-test.html',
        storyboard: 'storyboard.html',
        truckTracker: 'demos/truck-tracker/dashboard.html',
      },
    },
  },
});
