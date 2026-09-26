/**
 * BRACHLAND — Waffenclips gegen Regeln (D171).
 *
 * Die Zeiten eines Schlags stehen zweimal: in der Regel (`hieb: { scheitel, durchzug }` in
 * `src/kampf/echtzeit.ts`, Clipsekunden) und im Clip (Schlüsselbilder in `tools/waffenclips.py`,
 * 24 je Sekunde). Liegen sie auseinander, holt die Figur noch aus, während der Treffer schon
 * zählt — genau der Fehler, den man im Spiel als „der Schlag trifft, bevor er ankommt" spürt und im
 * Bild nie findet. Dieser Test hält beide Stellen zusammen, und die ausgelieferte Datei dazu.
 */
import { readFileSync, existsSync } from 'node:fs';
import { WAFFEN } from '../src/kampf/echtzeit.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}

// ---- Clips und Schlüsselbilder aus waffenclips.py
const py = readFileSync('tools/waffenclips.py', 'utf8');
const clips = new Map<string, { art: string; bilder: number[] }>();
let jetzt: string | null = null;
for (const z of py.split('\n')) {
  const kopf = z.match(/^ {4}'(\w+)': \((?:'\w+'|KLINGE_BASIS), '(\w+)', \[/);
  if (kopf) { jetzt = kopf[1]; clips.set(jetzt, { art: kopf[2], bilder: [] }); continue; }
  const bild = z.match(/^ {8}\((\d+), /);
  if (bild && jetzt) clips.get(jetzt)!.bilder.push(Number(bild[1]));
  if (/^\}/.test(z)) jetzt = null;
}
pruefe('waffenclips.py: Clips gefunden', clips.size >= 7, `${clips.size}`);

// ---- menschbau.py baut genau diese Clips mit
const mb = readFileSync('tools/menschbau.py', 'utf8').match(/ANIM_WAFFEN = \(([^)]*)\)/);
const mbNamen = mb ? [...mb[1].matchAll(/'(\w+)'/g)].map(m => m[1]).sort() : [];
pruefe('menschbau.ANIM_WAFFEN = waffenclips.CLIPS', mbNamen.join(',') === [...clips.keys()].sort().join(','),
  `${mbNamen.join(',')} gegen ${[...clips.keys()].sort().join(',')}`);

// ---- Jede Waffe: Haltung als Schleife, jeder Schlag mit Scheitel und Durchzug auf Schlüsselbildern
const AUS_DEM_PAKET = new Set(['Sword_Slash', 'Axe_Overhead']);
// D173: Clips aus der UAL2 — Länge aus den Bildbereichen in `tools/ual2uebertrag.py`.
const ual2 = new Map<string, number>();
{
  const q = readFileSync('tools/ual2uebertrag.py', 'utf8');
  for (const m of q.matchAll(/'(\w+)':\s*\[([^\]]*)\]/g)) {
    const teile = [...m[2].matchAll(/\('\w+',\s*(\d+),\s*(\d+)\)/g)];
    if (teile.length) ual2.set(m[1], teile.reduce((n, t) => n + (+t[2] - +t[1]), 0));
  }
}
pruefe('ual2uebertrag.py: 7 Clips gefunden', ual2.size === 7, [...ual2.keys()].join(','));
const mu = readFileSync('tools/menschbau.py', 'utf8').match(/ANIM_UAL2 = \(([^)]*)\)/);
pruefe('menschbau.ANIM_UAL2 = ual2uebertrag.CLIPS',
  (mu ? [...mu[1].matchAll(/'(\w+)'/g)].map(m => m[1]).sort().join(',') : '') === [...ual2.keys()].sort().join(','));
const gebraucht: string[] = [];
for (const [art, w] of Object.entries(WAFFEN)) {
  const h = clips.get(w.haltung);
  pruefe(`${art}: Haltung ${w.haltung} ist ein Schleifenclip`, h?.art === 'schleife', h?.art ?? 'fehlt');
  const b = h?.bilder ?? [];
  pruefe(`${art}: Haltung endet, wie sie beginnt`, b.length >= 2 && b[0] === 1, b.join(','));
  gebraucht.push(w.haltung);
  for (const s of [...w.leicht, w.schwer, w.lauf]) {
    if (!s.clip || AUS_DEM_PAKET.has(s.clip)) continue;
    if (ual2.has(s.clip)) {
      gebraucht.push(s.clip);
      const ende = ual2.get(s.clip)!;
      pruefe(`${art}/${s.name}: UAL2-Clip ${s.clip} trägt Scheitel < Durchzug im Clip, danach ≥ 8 Bilder Erholung`,
        !!s.hieb && s.hieb.scheitel < s.hieb.durchzug && ende - s.hieb.durchzug * 24 >= 8, `${ende}`);
      continue;
    }
    gebraucht.push(s.clip);
    const c = clips.get(s.clip);
    pruefe(`${art}/${s.name}: Clip ${s.clip} gebaut`, !!c);
    if (!c || !s.hieb) continue;
    const sb = s.hieb.scheitel * 24, db = s.hieb.durchzug * 24;
    pruefe(`${art}/${s.name}: Scheitel liegt auf einem Schlüssel`, c.bilder.some(x => Math.abs(x - sb) < 1e-6),
      `${sb.toFixed(2)} in ${c.bilder.join(',')}`);
    pruefe(`${art}/${s.name}: Durchzug liegt auf einem Schlüssel`, c.bilder.some(x => Math.abs(x - db) < 1e-6),
      `${db.toFixed(2)} in ${c.bilder.join(',')}`);
    const ende = Math.max(...c.bilder);
    pruefe(`${art}/${s.name}: nach dem Durchzug bleibt Erholung im Clip (≥ 8 Bilder)`, ende - db >= 8, `${ende} - ${db}`);
  }
}

// ---- Die ausgelieferten Dateien
function animationen(pfad: string): string[] {
  const buf = readFileSync(pfad);
  const g = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
  return (g.animations ?? []).map((a: { name: string }) => a.name);
}
const WAFFENDATEI = 'public/figuren/kampf/wanderin-waffen.glb';
pruefe('Waffenclips-Datei ist da', existsSync(WAFFENDATEI));
if (existsSync(WAFFENDATEI)) {
  const drin = new Set(animationen(WAFFENDATEI));
  const fehlt = gebraucht.filter(n => !drin.has(n));
  pruefe('jeder gebrauchte Clip steckt in der Waffendatei', fehlt.length === 0, fehlt.join(', '));
}
const figur = animationen('public/figuren/wanderin.glb');
pruefe('die Wanderin trägt keine Waffenclips (Budget)', !figur.some(n => /^(Klinge|Axt|Kampf)_/.test(n)), figur.join(', '));
pruefe('die Wanderin trägt die Rückfälle Sword_Slash und Axe_Overhead',
  figur.includes('Sword_Slash') && figur.includes('Axe_Overhead'));

console.log(`\nWaffenclips — ${clips.size} Clips, ${gebraucht.length} gebraucht`);
console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
