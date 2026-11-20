import { defineConfig } from 'vite';

// Three pages: the real site plus two decision pages (type test, storyboard).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        typeTest: 'type-test.html',
        storyboard: 'storyboard.html',
      },
    },
  },
});
