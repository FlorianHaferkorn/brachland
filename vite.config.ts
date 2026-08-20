import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // `includeAssets` ist hier überflüssig: `globPatterns` unten deckt `**/*.json`
      // bereits ab, und oental.json stand deshalb **zweimal** im Precache-Manifest.
      // Geladen wird es trotzdem nur einmal — beide Einträge tragen dieselbe
      // Revision, also denselben Cache-Key, und Workbox fasst das zusammen. Es ist
      // kein Datenleck, aber es hat eine Messung der Precache-Größe verdoppelt und
      // wäre ein echter Fehler in dem Moment, in dem beide Wege verschiedene
      // Revisionen erzeugen (dann wirft Workbox `add-to-cache-list-conflicting-entries`).
      includeAssets: [],
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