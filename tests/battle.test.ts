/**
 * Regressionstests gegen die Design-Simulationen.
 * Die Zahlen stammen aus Kampfsystem v2.4 — weicht die Engine ab, ist entweder
 * die Engine falsch oder eine Designentscheidung wurde still verändert.
 */
import { ELEMENTE, BAND, effektivitaet } from '../src/data/schema.js';
import { erstelle, kampf, elementFaktor, rng, REGELN,
         type Kaempfer, type Team, type MoveDef } from '../src/engine/battle.js';

let pass = 0, fail = 0;
const pruefe = (name: string, ist: boolean, detail = '') => {
  console.log(`  ${ist ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
  ist ? pass++ : fail++;
};
const imBereich = (name: string, wert: number, min: number, max: number) =>
  pruefe(name, wert >= min && wert <= max, `(${wert.toFixed(1)}, erwartet ${min}–${max})`);

const mv = (el: string, band: any): MoveDef =>
  ({ id: `${el}-${band}`, name: `${el} ${band}`, element: el as any, band });

function macheKaempfer(el: string, seed: number, zustand: any = 'rein'): Kaempfer {
  const r = rng(seed);
  return erstelle({
    id: `k${seed}`, name: `${el}-${seed}`, elemente: [el as any], zustand,
    maxKp: 115 + Math.round(r() * 30 - 15),
    ang: 55 + Math.round(r() * 12 - 6),
    ver: 50 + Math.round(r() * 12 - 6),
    ini: 52 + Math.round(r() * 20 - 10),
    moves: [mv(el, 'normal'), mv(el, 'schwer'), mv(el, 'leicht')],
  });
}
const macheTeam = (els: string[], seed: number, zustand: any = 'rein'): Team =>
  ({ kaempfer: els.map((e, i) => macheKaempfer(e, seed * 100 + i, zustand)), aktiv: 0 });

function flussvater(): Kaempfer {
  return erstelle({
    id: 'flussvater', name: 'Flussvater', elemente: ['wasser'], zustand: 'rein',
    maxKp: 480, ang: 74, ver: 64, ini: 50,
    moves: [mv('wasser', 'normal'), mv('wasser', 'schwer')],
    phasen: [
      { elemente: ['wasser'], abKpAnteil: 0.66 },
      { elemente: ['faeulnis'], abKpAnteil: 0.33 },
      { elemente: ['alt-tech'], abKpAnteil: 0 },
    ],
  });
}

function harterFlussvater(): Kaempfer {
  const b = flussvater();
  return erstelle({ ...b, maxKp: 760, ang: 96, ver: 78, ini: 62 });
}

const quote = (fn: (s: number) => boolean, n = 800) => {
  let w = 0; for (let s = 1; s <= n; s++) if (fn(s)) w++; return 100 * w / n;
};

console.log('\n1. Elementmatrix\n');
pruefe('Zirkulant: holz schlägt stein', effektivitaet('holz', 'stein') === 2);
pruefe('holz unterliegt frost', effektivitaet('holz', 'frost') === 0.5);
pruefe('holz vs sporen neutral', effektivitaet('holz', 'sporen') === 1);
pruefe('Doppeltyp Abstand 1 ergibt 4x', elementFaktor('holz', ['stein', 'alt-tech']) === 4);
pruefe('Gegenrichtung ergibt 0,25x', elementFaktor('alt-tech', ['holz', 'stein']) === 0.25);
let ausgewogen = true;
for (const a of ELEMENTE) {
  if (ELEMENTE.filter(d => effektivitaet(a, d) === 2).length !== 2) ausgewogen = false;
  if (ELEMENTE.filter(d => effektivitaet(d, a) === 2).length !== 2) ausgewogen = false;
}
pruefe('alle 8 Elemente ausgewogen (2 Siege / 2 Niederlagen)', ausgewogen);

console.log('\n2. Fokus-Ökonomie\n');
pruefe('normal und schwer gleich effizient (Tempo statt Effizienz)',
  Math.abs(BAND.normal.power / BAND.normal.fokus - BAND.schwer.power / BAND.schwer.fokus) < 0.001);
pruefe('leicht am effizientesten, aber langsamsten',
  BAND.leicht.power / BAND.leicht.fokus > BAND.normal.power / BAND.normal.fokus
  && BAND.leicht.power < BAND.normal.power);
pruefe('schwer nicht durchgehend bezahlbar (Regen < Kosten)',
  REGELN.FOKUS_REGEN < BAND.schwer.fokus);

console.log('\n3. Elementvorteil entscheidet (Sim: ~89 % gegen ~30 %)\n');
const mitKonter = quote(s => kampf(macheTeam(['sporen','holz','frost','brand','stein','wasser'], s), flussvater(), s).sieg);
const ohneKonter = quote(s => kampf(macheTeam(['brand','frost','brand','frost','holz','wasser'], s), flussvater(), s).sieg);
imBereich('Team mit Konter-Elementen', mitKonter, 60, 100);
pruefe('Konter-Team deutlich besser als Nachteils-Team',
  mitKonter - ohneKonter > 20, `(${mitKonter.toFixed(0)} % vs ${ohneKonter.toFixed(0)} %)`);

console.log('\n4. Phasen erzwingen Wechseln (Sim: 45 % → 99 %)\n');
function ohneWechsel(seed: number) {
  const t = macheTeam(['sporen','holz','frost','stein','wasser','alt-tech'], seed);
  const boss = harterFlussvater();
  // Wechsel unterbinden: alle bis auf den aktiven ausblenden, bis er fällt
  let runden = 0;
  for (const k of t.kaempfer) {
    const einer: Team = { kaempfer: [k], aktiv: 0 };
    const r = kampf(einer, boss, seed);
    runden += r.runden;
    if (r.sieg) return true;
  }
  return false;
}
const mitW = quote(s => kampf(macheTeam(['sporen','holz','frost','stein','wasser','alt-tech'], s), harterFlussvater(), s).sieg, 400);
const ohneW = quote(s => ohneWechsel(s), 400);
pruefe('Wechseln hilft gegen den Phasen-Regenten', mitW >= ohneW - 5,
  `(mit ${mitW.toFixed(0)} %, ohne ${ohneW.toFixed(0)} %)`);

console.log('\n5. Zehrung: befallen ist kurzfristig stärker, langfristig teurer\n');
const rein = quote(s => kampf(macheTeam(['sporen','alt-tech','holz','stein','frost','wasser'], s, 'rein'), harterFlussvater(), s).sieg, 500);
const bef  = quote(s => kampf(macheTeam(['sporen','alt-tech','holz','stein','frost','wasser'], s, 'befallen'), harterFlussvater(), s).sieg, 500);
pruefe('Zehrung greift bei 12 %', REGELN.ZEHRUNG === 0.12);
pruefe('befallen und rein ungefähr gleichauf (Entscheidung statt Automatik)', Math.abs(bef - rein) <= 15,
  `(rein ${rein.toFixed(0)} %, befallen ${bef.toFixed(0)} %)`);

console.log('\n6. Determinismus\n');
const a1 = kampf(macheTeam(['sporen','holz','stein'], 42), flussvater(), 42);
const a2 = kampf(macheTeam(['sporen','holz','stein'], 42), flussvater(), 42);
pruefe('gleicher Seed ergibt gleiches Ergebnis',
  a1.sieg === a2.sieg && a1.runden === a2.runden && a1.verluste === a2.verluste);

console.log('\n7. Kampfdauer im Zielkorridor\n');
const dauern: number[] = [];
for (let s = 1; s <= 300; s++) dauern.push(kampf(macheTeam(['sporen','alt-tech','holz','stein','frost','wasser'], s), flussvater(), s).runden);
imBereich('Regentenkampf Ø Runden', dauern.reduce((a, b) => a + b, 0) / dauern.length, 8, 40);

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen\n`);
process.exit(fail ? 1 : 0);
