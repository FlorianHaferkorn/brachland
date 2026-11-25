/**
 * BRACHLAND — Kampfton (D427): Tonauswahl renderfrei (`src/ton/kampfton.ts` `planeKlang`).
 *
 * Geprüft: Daten passen zum Schema, jede Datei liegt und hat Herkunft; das Band folgt dem Ereignis und der
 * Oberfläche des Getroffenen; **Masse wirkt** — die Axt klingt tiefer und schlägt lauter ein als die Klinge, der
 * Hirschfänger heller (aus `toene()`, `gewicht.ts`); die Variation wiederholt nie dieselbe Datei direkt; Rate und
 * Pegel bleiben in ihren Grenzen; der Effekte-Bus folgt Gesamt × Effekte und schweigt, wenn er soll.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Kampfton, KAMPFTON_BAENDER } from '../src/data/schema.js';
import { KAMPFTON, busPegel, oberflaeche, planeKlang, waehle, type KampfEreignis } from '../src/ton/kampfton.js';
import { toene } from '../src/kampf/gewicht.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}
const nah = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;
/** Zufall 0,5: keine Streuung (2·0,5 − 1 = 0), mittlere Datei. */
const mitte = () => 0.5;

// ---- Daten
const r = Kampfton.safeParse(JSON.parse(readFileSync('content/kampfton.json', 'utf8')));
pruefe('kampfton.json passt zum Schema', r.success, r.success ? '' : r.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; '));
for (const b of KAMPFTON_BAENDER) pruefe(`Band ${b} ist belegt`, (KAMPFTON.baender[b]?.dateien.length ?? 0) >= 1);
const herkunft = readFileSync('assets/HERKUNFT.md', 'utf8');
let kb = 0;
for (const [band, b] of Object.entries(KAMPFTON.baender)) for (const f of b.dateien) {
  const p = join('public', KAMPFTON.ordner, f);
  pruefe(`${band}: ${f} liegt`, existsSync(p));
  pruefe(`${band}: ${f} hat Herkunft`, herkunft.includes(f));
  if (existsSync(p)) kb += statSync(p).size / 1024;
}
const liegen = readdirSync(join('public', KAMPFTON.ordner));
const benutzt = new Set(Object.values(KAMPFTON.baender).flatMap(b => b.dateien));
pruefe('keine Datei unter public/ton/kampf ohne Band', liegen.every(f => benutzt.has(f)), liegen.filter(f => !benutzt.has(f)).join(', '));
pruefe('Kampfton zusammen unter 400 KB', kb < 400, `${kb.toFixed(0)} KB`);
const gegner = readdirSync('content/gegner').filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
for (const id of gegner) pruefe(`Gegner ${id} hat eine Oberfläche`, id in KAMPFTON.oberflaechen.je);

// ---- Band nach Ereignis und Oberfläche
const band = (e: KampfEreignis) => planeKlang(e, mitte, {}).band;
pruefe('Wolf: Fell', band({ art: 'treffer', waffe: 'klinge', ziel: 'wolf' }) === 'treffer-fell');
pruefe('Wurzelkeiler: Rinde (Panzer aus Wurzelwerk)', band({ art: 'treffer', waffe: 'axt', ziel: 'keiler' }) === 'treffer-rinde');
pruefe('Wegelagerer: Stoff', band({ art: 'treffer', waffe: 'speer', ziel: 'wegelagerer' }) === 'treffer-stoff');
pruefe('Unbekanntes Ziel: Standard', oberflaeche('niemand') === KAMPFTON.oberflaechen.standard);
pruefe('Gedeckte Linie: Metall', band({ art: 'gedeckt', waffe: 'klinge' }) === 'treffer-metall');
pruefe('Erlitten: die Spielerin (Stoff)', band({ art: 'erlitten', schaden: 20 }) === `treffer-${KAMPFTON.oberflaechen.spielerin}`);
pruefe('Schwung leicht/schwer', band({ art: 'schwung', waffe: 'axt', schwer: false }) === 'schwung-leicht'
  && band({ art: 'schwung', waffe: 'axt', schwer: true }) === 'schwung-schwer');
pruefe('Block, Parade, Rolle, Schritt, Griff', band({ art: 'block', waffe: 'klinge' }) === 'block' && band({ art: 'parade', waffe: 'klinge' }) === 'parade'
  && band({ art: 'rolle' }) === 'rolle' && band({ art: 'schritt' }) === 'schritt' && band({ art: 'griff' }) === 'griff');

// ---- Masse wirkt (ohne Streuung)
const plan = (e: KampfEreignis) => planeKlang(e, mitte, {});
const tk = plan({ art: 'treffer', waffe: 'klinge', ziel: 'wolf' }), ta = plan({ art: 'treffer', waffe: 'axt', ziel: 'wolf' });
const th = plan({ art: 'treffer', waffe: 'hirschfaenger', ziel: 'wolf' });
pruefe('Klinge = Referenz: Rate 1, Pegel = Grundpegel des Bands', nah(tk.rate, 1) && nah(tk.pegel, KAMPFTON.baender['treffer-fell']!.pegel));
pruefe('Axt trifft tiefer als die Klinge', ta.rate < tk.rate, `${ta.rate.toFixed(3)} gegen ${tk.rate.toFixed(3)}`);
pruefe('Axt trifft lauter als die Klinge', ta.pegel > tk.pegel, `${ta.pegel.toFixed(3)} gegen ${tk.pegel.toFixed(3)}`);
pruefe('Axt: Rate = Tonhöhe aus toene()', nah(ta.rate, toene('axt').treffer.tonhoehe));
pruefe('Hirschfänger trifft heller und leiser', th.rate > tk.rate && th.pegel < tk.pegel, `${th.rate.toFixed(3)} / ${th.pegel.toFixed(3)}`);
const schwer = plan({ art: 'treffer', waffe: 'axt', ziel: 'wolf', wucht: 1.5 });
pruefe('Wucht des Schlags macht lauter, nicht tiefer', schwer.pegel > ta.pegel && nah(schwer.rate, ta.rate));
const sk = plan({ art: 'schwung', waffe: 'klinge', schwer: false }), sa = plan({ art: 'schwung', waffe: 'axt', schwer: false });
pruefe('Schwung: Axt tiefer als Klinge', sa.rate < sk.rate, `${sa.rate.toFixed(3)} gegen ${sk.rate.toFixed(3)}`);
pruefe('Erlitten: mehr Schaden lauter', plan({ art: 'erlitten', schaden: 40 }).pegel > plan({ art: 'erlitten', schaden: 5 }).pegel);
pruefe('Griff ist leise (unter dem halben Treffer)', plan({ art: 'griff' }).pegel < tk.pegel / 2);

// ---- Grenzen und Variation
{
  let ok = true;
  const z = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  const ereignisse: KampfEreignis[] = [
    { art: 'treffer', waffe: 'axt', ziel: 'keiler', wucht: 3 }, { art: 'treffer', waffe: 'hirschfaenger', ziel: 'fuchs' },
    { art: 'schwung', waffe: 'speer', schwer: true }, { art: 'erlitten', schaden: 200 }, { art: 'rolle' },
  ];
  for (let i = 0; i < 400; i++) {
    const p = planeKlang(ereignisse[i % ereignisse.length], z, {});
    ok &&= p.rate >= KAMPFTON.rate.min && p.rate <= KAMPFTON.rate.max && p.pegel >= 0 && p.pegel <= 1;
  }
  pruefe('Rate in rate.min…max, Pegel in 0…1 (auch bei Wucht 3 und Schaden 200)', ok);
  const zuletzt = {};
  let folge = '', wdh = false;
  for (let i = 0; i < 200; i++) {
    const d = planeKlang({ art: 'treffer', waffe: 'klinge', ziel: 'wolf' }, z, zuletzt).datei;
    if (d === folge) wdh = true;
    folge = d;
  }
  pruefe('nie zweimal dieselbe Datei hintereinander', !wdh);
  const n = new Set<number>(); for (let i = 0; i < 200; i++) n.add(waehle(3, 1, z));
  pruefe('waehle: die beiden anderen kommen beide vor, die letzte nie', n.size === 2 && !n.has(1));
  pruefe('waehle: mit einer Datei immer sie', waehle(1, 0, z) === 0);
  const streu = new Set<string>(); for (let i = 0; i < 20; i++) streu.add(planeKlang({ art: 'schritt' }, z, {}).rate.toFixed(4));
  pruefe('Streuung der Tonhöhe wirkt', streu.size > 10);
}

// ---- Effekte-Bus
pruefe('Bus: Gesamt × Effekte', nah(busPegel(80, 100, false), 0.8) && nah(busPegel(80, 50, false), 0.4));
pruefe('Bus: stumm schweigt', busPegel(100, 100, true) === 0);
pruefe('Bus: 0 % ist stumm', busPegel(0, 100, false) === 0);

console.log(`\nKampfton — ${benutzt.size} Dateien, ${kb.toFixed(0)} KB; Treffer Klinge/Axt/Hirschfänger Rate ${tk.rate.toFixed(2)}/${ta.rate.toFixed(2)}/${th.rate.toFixed(2)}, Pegel ${tk.pegel.toFixed(2)}/${ta.pegel.toFixed(2)}/${th.pegel.toFixed(2)}`);
console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
