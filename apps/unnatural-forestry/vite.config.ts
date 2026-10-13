import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the build works under /apps/unnatural-forestry/ on GitHub Pages.
  base: './',
  build: { outDir: 'dist', target: 'es2022' },
});
