import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Kreatur, effektivitaet, schadensfaktor, ELEMENTE } from '../src/data/schema.js';

let ok = 0, fehler = 0;
for (const f of readdirSync('content/creatures')) {
  const raw = JSON.parse(readFileSync(join('content/creatures', f), 'utf8'));
  const r = Kreatur.safeParse(raw);
  if (r.success) { console.log(`  ✓ ${f}`); ok++; }
  else {
    console.log(`  ✗ ${f}`);
    r.error.issues.forEach(i => console.log(`      ${i.path.join('.')}: ${i.message}`));
    fehler++;
  }
}
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
