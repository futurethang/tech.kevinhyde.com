import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The built app is served by the Hono server at '/' (one process, one URL).
export default defineConfig({
  build: { outDir: 'dist', emptyOutDir: true },
  // Dev only: proxy API calls to the running server.
  server: { proxy: { '/api': 'http://localhost:8080' } },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Marginalia',
        short_name: 'Marginalia',
        description: 'Personal engineering-content recall',
        display: 'standalone',
        start_url: '/',
        theme_color: '#4f46e5',
        background_color: '#0b0b0f',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // NetworkFirst for item reads → fresh online, readable offline (recall on a plane).
        // Only GET is matched; mutations (POST/PATCH/DELETE) are never cached.
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && url.pathname.startsWith('/api/items'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-items',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
