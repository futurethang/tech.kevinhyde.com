import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Baseball FX Tester',
        short_name: 'FX Tester',
        description: 'Test baseball game effects on mobile — haptics, animations, sounds',
        theme_color: '#1a472a',
        background_color: '#111111',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
      },
    }),
  ],
  root: resolve(__dirname),
  base: './',
  publicDir: resolve(__dirname, '../public'),
  resolve: {
    alias: {
      '@effects': resolve(__dirname, '../effects'),
    },
  },
  build: {
    outDir: resolve(__dirname, '../dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5175,
  },
});
