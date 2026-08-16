import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Kreatur, Move, Regent, Gegenstand, effektivitaet, schadensfaktor, ELEMENTE } from '../src/data/schema.js';

let ok = 0, fehler = 0;

/** Ein Ordner gegen ein Schema. Gibt die geparsten Objekte zurueck. */
function pruefe<T>(ordner: string, schema: { safeParse: (x: unknown) => any }): T[] {
  const raus: T[] = [];
  for (const f of readdirSync(ordner).filter(f => f.endsWith('.json')).sort()) {
    const raw = JSON.parse(readFileSync(join(ordner, f), 'utf8'));
    const r = schema.safeParse(raw);
    if (r.success) { console.log(`  ✓ ${f}`); ok++; raus.push(r.data); }
    else {
      console.log(`  ✗ ${f}`);
      r.error.issues.forEach((i: any) => console.log(`      ${i.path.join('.')}: ${i.message}`));
      fehler++;
    }
  }
  return raus;
}

console.log('Moves:');
const moves = pruefe<{ id: string }>('content/moves', Move);
console.log('\nKreaturen:');
const kreaturen = pruefe<any>('content/creatures', Kreatur);
console.log('\nRegenten:');
const regenten = pruefe<any>('content/regenten', Regent);
console.log('\nGegenstände:');
const gegenstaende = pruefe<any>('content/gegenstaende', Gegenstand);

// Querverweise: jede referenzierte Move-ID muss es geben. Ohne diese Pruefung
// faellt ein Tippfehler erst im Kampf auf — und dort als leerer Move-Knopf.
console.log('\nQuerverweise:');
const bekannt = new Set(moves.map(m => m.id));
let tote = 0;
const melde = (wer: string, id: string) => {
  if (bekannt.has(id)) return;
  console.log(`  ✗ ${wer} verweist auf unbekannten Move '${id}'`);
  tote++;
};
for (const k of kreaturen) {
  k.grundMoves.forEach((m: string) => melde(k.id, m));
  k.stufen.forEach((s: any) => s.signaturMove && melde(k.id, s.signaturMove));
}
for (const r of regenten) r.moves.forEach((m: string) => melde(r.id, m));
console.log(tote === 0 ? `  ✓ alle ${bekannt.size} Moves aufgeloest` : `  ${tote} tote Verweise`);

// Ohne Beute im Spiel gibt es keine Gegenstaende — dann ist der Beutel Deko.
const mitBeute = gegenstaende.filter((g: any) => g.beuteChance > 0).length;
console.log(mitBeute > 0
  ? `  ✓ ${mitBeute} von ${gegenstaende.length} Gegenstaenden fallen als Beute an`
  : '  ✗ kein Gegenstand faellt als Beute an — der Beutel bliebe leer');
if (mitBeute === 0) fehler++;
if (tote > 0) fehler += tote;

console.log(`\n${ok} gültig, ${fehler} fehlerhaft\n`);

// Matrix-Selbsttest: jedes Element muss 2 Siege, 2 Niederlagen, 3 neutral haben
console.log('Matrix-Selbsttest:');
let matrixOk = true;
for (const a of ELEMENTE) {
  const s = ELEMENTE.filter(d => effektivitaet(a, d) === 2).length;
  const n = ELEMENTE.filter(d => effektivitaet(d, a) === 2).length;
  const gut = s === 2 && n === 2;
  if (!gut) matrixOk = false;
  console.log(`  ${gut ? '✓' : '✗'} ${a.padEnd(9)} schlägt ${s}, unterliegt ${n}`);
}
console.log(matrixOk ? '  Matrix ausgewogen.\n' : '  MATRIX UNAUSGEWOGEN!\n');

console.log('Doppeltyp-Stichprobe (Verteidigung):');
console.log(`  Angriff holz  auf [stein]            → ${schadensfaktor('holz', ['stein'])}`);
console.log(`  Angriff holz  auf [stein, alt-tech]  → ${schadensfaktor('holz', ['stein','alt-tech'])}   (4x = Abstand 1)`);
console.log(`  Angriff frost auto [holz, sporen]    → ${schadensfaktor('frost', ['holz','sporen'])}`);

process.exit(fehler > 0 || !matrixOk ? 1 : 0);
