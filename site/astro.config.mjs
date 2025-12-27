import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://tech.kevinhyde.com',
  outDir: '../dist',
  build: {
    assets: '_assets'
  }
});
