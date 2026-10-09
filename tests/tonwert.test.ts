/**
 * Tests für die Tonwertkurve auf der CPU (D199).
 *
 * `agxMitLook` ist die Kopie dessen, was der Shader in `CustomToneMapping` rechnet — für
 * `npm run licht`, das bis D198 ACES rechnete, während das Spiel seit D164 AgX + Look zeigt. Die
 * Sollwerte sind **gemessen**: dieselben Farben durch three.js r169 in Chromium gerendert
 * (SwiftShader, 07.10.2026) und als 8-bit-sRGB zurückgelesen. Die CPU traf sie auf 0/255. Wer
 * `LOOK_GAMMA`, `LOOK_S` oder die Matrizen ändert, ändert den Shader mit — und muss diese Werte neu
 * messen, nicht nachrechnen.
 */
import { agxMitLook } from '../src/scenes/tonwert.js';

let ok = 0, fehler = 0;
const srgb = (c: number) => { c = Math.max(0, Math.min(1, c)); return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055; };

/** [Belichtung, linear-sRGB, gemessene Bytes] */
const SOLL: [number, [number, number, number], [number, number, number]][] = [
  [2.4, [0.001, 0.001, 0.001], [0, 0, 0]],
  [2.4, [0.003, 0.003, 0.003], [3, 3, 3]],
  [2.4, [0.01, 0.01, 0.01], [19, 19, 19]],
  [2.4, [0.02, 0.02, 0.02], [41, 41, 41]],
  [2.4, [0.04, 0.04, 0.04], [75, 75, 75]],
  [2.4, [0.07, 0.07, 0.07], [110, 109, 109]],
  [2.4, [0.1, 0.1, 0.1], [133, 133, 133]],
  [2.4, [0.15, 0.15, 0.15], [159, 159, 159]],
  [2.4, [0.2, 0.2, 0.2], [177, 177, 177]],
  [2.4, [0.3, 0.3, 0.3], [199, 199, 199]],
  [2.4, [0.45, 0.45, 0.45], [217, 216, 216]],
  [2.4, [0.7, 0.7, 0.7], [231, 231, 231]],
  [2.4, [1, 1, 1], [239, 239, 239]],
  [2.4, [0.05, 0.08, 0.12], [92, 121, 146]],
  [2.4, [0.2, 0.12, 0.06], [178, 143, 107]],
  [2.4, [0.03, 0.06, 0.02], [65, 95, 45]],
  [2.4, [0.4, 0.3, 0.1], [213, 196, 148]],
  [2.5, [0.001, 0.001, 0.001], [0, 0, 0]],
  [2.5, [0.003, 0.003, 0.003], [3, 3, 3]],
  [2.5, [0.01, 0.01, 0.01], [20, 20, 20]],
  [2.5, [0.02, 0.02, 0.02], [43, 43, 43]],
  [2.5, [0.04, 0.04, 0.04], [78, 78, 78]],
  [2.5, [0.07, 0.07, 0.07], [112, 112, 112]],
  [2.5, [0.1, 0.1, 0.1], [136, 136, 136]],
  [2.5, [0.15, 0.15, 0.15], [162, 162, 162]],
  [2.5, [0.2, 0.2, 0.2], [179, 179, 179]],
  [2.5, [0.3, 0.3, 0.3], [201, 201, 201]],
  [2.5, [0.45, 0.45, 0.45], [218, 218, 218]],
  [2.5, [0.7, 0.7, 0.7], [232, 232, 232]],
  [2.5, [1, 1, 1], [240, 240, 240]],
  [2.5, [0.05, 0.08, 0.12], [95, 124, 149]],
  [2.5, [0.2, 0.12, 0.06], [181, 146, 110]],
  [2.5, [0.03, 0.06, 0.02], [67, 98, 47]],
  [2.5, [0.4, 0.3, 0.1], [215, 198, 150]],
];

console.log('Tonwertkurve — CPU gegen gemessenen Shader (Toleranz 1/255)\n');
for (const [bel, farbe, gpu] of SOLL) {
  const cpu = agxMitLook(farbe, bel).map(c => Math.round(srgb(c) * 255));
  const d = Math.max(...cpu.map((c, k) => Math.abs(c - gpu[k])));
  const gut = d <= 1;
  if (!gut) console.log(`  ✗ Bel ${bel} ${farbe.join('/')}: CPU ${cpu.join(',')} gegen GPU ${gpu.join(',')}`);
  gut ? ok++ : fehler++;
}
console.log(`  ${fehler === 0 ? '✓' : '✗'} ${SOLL.length} Proben, zwei Belichtungen`);
console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen\n`);
process.exit(fehler > 0 ? 1 : 0);
