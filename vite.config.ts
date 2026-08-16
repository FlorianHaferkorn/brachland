import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['world/*.json'],
      manifest: {
        name: 'BRACHLAND', short_name: 'Brachland',
        background_color: '#0d1210', theme_color: '#0d1210',
        display: 'fullscreen', orientation: 'landscape',
        start_url: '/', icons: [],
      },
      workbox: {
        // Weltdaten und Modelle müssen offline im Cache liegen — sonst ist
        // "im Flugmodus spielbar" nicht erfüllt.
        globPatterns: ['**/*.{js,css,html,json,glb}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  server: { host: true },   // vom Handy im selben WLAN erreichbar
});