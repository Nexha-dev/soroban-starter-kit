import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      srcDir: 'src',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      injectManifest: {
        swSrc: 'src/sw.ts',
      },
      includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Fidelis Soroban DApp',
        short_name: 'Fidelis',
        description: 'Soroban DApp with offline support',
        theme_color: '#1a1a2e',
        background_color: '#16213e',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait-primary',
        categories: ['finance', 'utilities'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          {
            name: 'Pending Transactions',
            url: '/?tab=pending',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
    }),
    // Bundle visualizer: generates stats.html when ANALYZE=true
    ...(process.env.ANALYZE === 'true'
      ? [visualizer({ open: true, filename: 'dist/stats.html', gzipSize: true, brotliSize: true })]
      : []),
  ],
  server: { port: 3000 },
  build: {
    sourcemap: process.env.ANALYZE === 'true',
    rollupOptions: {
      output: {
        // Code splitting: vendor, stellar SDK, performance tools, and app chunks
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@stellar')) return 'vendor-stellar';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            return 'vendor';
          }
          // Lazy-loadable feature chunks
          if (id.includes('src/services/performance')) return 'perf-tools';
          if (id.includes('src/services/security')) return 'security';
        },
      },
    },
    // Performance budget: warn if chunk exceeds 500KB
    chunkSizeWarningLimit: 500,
  },
}));
