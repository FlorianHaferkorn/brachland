import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * Inhaltsstempel über `public/world` — wandert als `__WELTSTAND__` in den
 * Cachenamen von `src/world/weltladen.ts`.
 *
 * Weltdaten liegen seit D82 nicht mehr im Precache, sondern in einem Cache, den
 * die Anwendung selbst führt. Damit fehlt ihnen, was Workbox sonst mitbringt:
 * eine Revision. Ohne die wäre ein `npm run world` unsichtbar — die Anwendung
 * zeigte weiter die alte Welt. Der Stempel kommt aus dem **Inhalt** und nicht
 * aus der Änderungszeit, damit ein frischer Clone dieselbe Zahl bekommt.
 */
function weltstand(): string {
  try {
    const h = createHash('sha1');
    for (const f of readdirSync('public/world').sort())
      h.update(readFileSync(`public/world/${f}`));
    return h.digest('hex').slice(0, 8);
  } catch {
    return 'leer';
  }
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // `includeAssets: ['world/*.json']` stand hier und war schon damals
      // überflüssig — `globPatterns` deckte `**/*.json` mit ab, und oental.json
      // stand deshalb **zweimal** im Precache-Manifest. Geladen wurde es trotzdem
      // nur einmal (gleiche Revision, gleicher Cache-Key), aber es hat eine
      // Messung der Precache-Größe verdoppelt. Seit D82 gehören Weltdaten
      // ohnehin nicht mehr in den Precache; leer bleibt es also erst recht.
      includeAssets: [],
      manifest: {
        name: 'BRACHLAND', short_name: 'Brachland',
        background_color: '#0d1210', theme_color: '#0d1210',
        display: 'fullscreen', orientation: 'landscape',
        start_url: '/', icons: [],
      },
      workbox: {
        // Modelle müssen offline im Cache liegen — sonst ist "im Flugmodus
        // spielbar" nicht erfüllt.
        //
        // **Weltdaten stehen bewusst nicht mehr hier** (D82). Sie gingen beim
        // ersten Besuch zweimal über die Leitung: einmal geholt von der
        // Anwendung, einmal vom Precache — 456 KB von 1.382, ein Drittel der
        // Erstladung (G-92). Eine CacheFirst-Laufzeitregel behebt das **nicht**,
        // sondern macht es schlimmer: gemessen 927 KB, aber die Weltdaten danach
        // in gar keinem Cache, weil die Seite beim ersten Aufruf noch nicht unter
        // Service-Worker-Kontrolle steht (G-100). Zuständig ist jetzt
        // `src/world/weltladen.ts`, das die Cache-API direkt bedient.
        globPatterns: ['**/*.{js,css,html,glb}'],
        // 8 → 16 MiB (ADR-0006, Stufe 2): Ein Bauwerk aus der Blender-Szene mit gebackenen
        // Texturen wiegt nach `tools/bautenpack.ts` 12 MB (WebP, 1024er Karten, 21 Netze).
        // Das Handy ist nachrangig; der Wert wird gemessen, nicht gedeckelt.
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
      },
    }),
  ],
  define: { __WELTSTAND__: JSON.stringify(weltstand()) },
  server: { host: true },   // vom Handy im selben WLAN erreichbar
});