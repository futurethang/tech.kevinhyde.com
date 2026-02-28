import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  publicDir: resolve(__dirname, '../public'),
  resolve: {
    alias: {
      '@effects': resolve(__dirname, '../effects'),
    },
  },
  server: {
    port: 5174,
    open: true,
  },
});
