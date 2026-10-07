/**
 * Tests für die Stämme der Blender-Szenen (G-136).
 *
 * Anlass: Im Lock-On-Video vom 07.10.2026 stand das aufgeschaltete Ziel hinter einem Stauwehr-Stamm,
 * und die Kamera zog nicht nach — die Szenen-Stämme fehlten im Kollisionsfeld. Festgehalten wird:
 * jede Szene hat Stämme, sie liegen in ihrem Freihalte-Radius (sonst stimmt die Achsenlage nicht),
 * das Kollisionsfeld kennt sie, die Sichtlinie sieht sie, und `staemme.json` passt zu den GLB.
 */
import { readFileSync } from 'node:fs';
import { BAUWERKE, staemmeVon } from '../src/world/bauwerke.js';
import { baueKollision } from '../src/spieler/kollision.js';
import { sichtFrei } from '../src/kampf/sichtlinie.js';
import { berechneStaemme } from '../tools/staemme.js';

let ok = 0, fehler = 0;
function pruefe(was: string, gut: boolean, info = '') {
  console.log(`  ${gut ? '✓' : '✗'} ${was.padEnd(66)} ${info}`);
  gut ? ok++ : fehler++;
}

console.log('Szenen-Stämme — Kollision und Sicht im Freihalte-Radius\n');

const feld = baueKollision([]);
for (const b of BAUWERKE) {
  const s = staemmeVon(b.name);
  pruefe(`${b.name}: mindestens 100 Stämme`, s.length >= 100, `${s.length}`);
  const f = b.frei!;
  const draussen = s.filter(([x, z]) => Math.hypot(x - f.x, z - f.z) > f.props + 10).length;
  pruefe(`${b.name}: alle im Freihalte-Radius (${f.props} m)`, draussen === 0, `${draussen} draussen`);
  const [x, z] = s[Math.floor(s.length / 2)];
  const [ax, az] = feld.schiebeRaus(x + 0.05, z);
  pruefe(`${b.name}: Kollisionsfeld schiebt aus einem Stamm`, Math.hypot(ax - x, az - z) > 0.3);
}

// Der Stamm aus dem Video: 66 m vom Stauwehr, beim Testpunkt ?absetzen=1045,885
const nah = staemmeVon('stauwehr').find(([x, z]) => Math.hypot(x - 1049, z - 887) < 2);
pruefe('Stauwehr-Stamm am Testpunkt (1049/887) ist bekannt', !!nah, nah ? JSON.stringify(nah) : '-');
if (nah) {
  const [x, z] = nah;
  const versperrt = (px: number, _y: number, pz: number) => { const [qx, qz] = feld.schiebeRaus(px, pz); return qx !== px || qz !== pz; };
  pruefe('… und verdeckt die Sicht quer durch ihn', !sichtFrei([x - 4, 1.5, z], [x + 4, 1.2, z], versperrt));
}

const frisch = await berechneStaemme();
const datei = JSON.parse(readFileSync('public/bauten/staemme.json', 'utf8'));
pruefe('staemme.json passt zu den GLB (sonst: npx tsx tools/staemme.ts)', JSON.stringify(frisch) === JSON.stringify(datei));

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen\n`);
process.exit(fehler > 0 ? 1 : 0);
