/**
 * BRACHLAND — Häuser von innen (D242): Jede Raumart baut, bleibt in ihren Wänden, und die Anker
 * (Fenster, Glut, Figur, Kamera) stehen dort, wo die Szene sie erwartet.
 */
import { baueStube, RAUM, type InnenArt } from '../src/world/stube.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, bedingung: boolean, hinweis = '') {
  if (bedingung) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}

for (const art of Object.keys(RAUM) as InnenArt[]) {
  const { b, t, h } = RAUM[art];
  const bau = baueStube(art, `probe-${art}`);
  const p = bau.geometrie.getAttribute('position');
  let kaputt = 0;
  for (let i = 0; i < p.array.length; i++) if (!Number.isFinite(p.array[i])) kaputt++;
  pruefe(`${art}: keine NaN-Ecken`, kaputt === 0, `${kaputt}`);
  pruefe(`${art}: hat Farbe, keine Normalen`, !!bau.geometrie.getAttribute('color') && !bau.geometrie.getAttribute('normal'));
  bau.geometrie.computeBoundingBox();
  const bb = bau.geometrie.boundingBox!;
  const rand = 0.25;
  pruefe(`${art}: innerhalb der Wände`,
    bb.min.x >= -b / 2 - rand && bb.max.x <= b / 2 + rand && bb.min.z >= -t / 2 - rand && bb.max.z <= t / 2 + rand
      && bb.min.y >= -0.1 && bb.max.y <= h + 0.1,
    `${bb.min.x.toFixed(2)}…${bb.max.x.toFixed(2)} × ${bb.min.z.toFixed(2)}…${bb.max.z.toFixed(2)} × ${bb.max.y.toFixed(2)}`);
  const [fx, fy, fz] = bau.fenster.mitte;
  pruefe(`${art}: Fenster in der Rückwand`, Math.abs(fz + t / 2) < 1e-6 && Math.abs(fx) + bau.fenster.breite / 2 < b / 2 && fy < h);
  const [gx, gy, gz] = bau.glut;
  pruefe(`${art}: Glut im Raum`, Math.abs(gx) < b / 2 && Math.abs(gz) < t / 2 && gy > 0 && gy < h);
  const [px, , pz] = bau.figur.ort;
  pruefe(`${art}: Figur im Raum`, Math.abs(px) < b / 2 - 0.3 && Math.abs(pz) < t / 2 - 0.3);
  pruefe(`${art}: Kamera in der offenen Tür`, bau.kamera.ort[2] > t / 2 && bau.kamera.ort[1] > 1 && bau.kamera.ort[1] < h);
  // Saat fest: dieselbe Id, derselbe Raum.
  const nochmal = baueStube(art, `probe-${art}`).geometrie.getAttribute('position');
  pruefe(`${art}: fest je Id`, nochmal.count === p.count && nochmal.array[123] === p.array[123]);
}

console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
