/**
 * Tests für die Nebelkurve auf der CPU (D204).
 *
 * `nebelAnteil` ist dieselbe Formel, die `haengeNebelEin` in den Shader schreibt. Geprüft wird, was
 * die Kurve verspricht: Mittelbereich wie das alte `smoothstep` (auf dem das Bildtor eingemessen
 * ist), Decke bei `NEBEL_MAX`, Höhendunst dünnt nur über der Kamera aus.
 */
import { nebelAnteil, NEBEL_MAX, OBEN_REST } from '../src/scenes/nebel.js';

let ok = 0, fehler = 0;
const pruefe = (name: string, wahr: boolean, info = '') => {
  if (wahr) ok++; else { fehler++; console.error(`FEHLER ${name} ${info}`); }
};

const smoothstep = (t: number) => { t = Math.min(Math.max(t, 0), 1); return t * t * (3 - 2 * t); };
const halb = nebelAnteil(100, 0, 200);
pruefe('halber Weg wie smoothstep', Math.abs(halb - smoothstep(0.5)) < 0.02, halb.toFixed(3));
pruefe('vor nah kein Nebel', nebelAnteil(10, 20, 200) === 0);
pruefe('Decke im Unendlichen', Math.abs(nebelAnteil(1e6, 0, 200) - NEBEL_MAX) < 1e-6);
pruefe('Decke unter 1', NEBEL_MAX < 1);
let vorher = -1, steigt = true;
for (let d = 0; d <= 2000; d += 10) { const f = nebelAnteil(d, 0, 200); if (f < vorher) steigt = false; vorher = f; }
pruefe('monoton', steigt);
pruefe('unter der Kamera voll', nebelAnteil(300, 0, 200, -50) === nebelAnteil(300, 0, 200, 0));
const hoch = nebelAnteil(300, 0, 200, 5000) / nebelAnteil(300, 0, 200, 0);
pruefe('hoch oben bis OBEN_REST', Math.abs(hoch - OBEN_REST) < 1e-3, hoch.toFixed(3));

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if (fehler) process.exit(1);
