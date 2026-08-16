/**
 * BRACHLAND — Qualitätstor
 *
 * Prüft nicht "ist es gültig?" (das macht validate.ts), sondern "ist es gut genug?".
 * Läuft in CI und blockt den Merge. Jede Schwelle ist begründet und änderbar —
 * aber nur bewusst, nicht im Vorbeigehen.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { effektivitaet, ELEMENTE, BAND } from '../src/data/schema.js';

type Befund = { schwere: 'stop' | 'warnung'; bereich: string; text: string };
const befunde: Befund[] = [];
const stop = (bereich: string, text: string) => befunde.push({ schwere: 'stop', bereich, text });
const warn = (bereich: string, text: string) => befunde.push({ schwere: 'warnung', bereich, text });

// ---------------------------------------------------------------- Schwellen
const BUDGET = {
  trisStandard: 4000,
  trisBoss: 8000,
  trisMax: 8000,
  glbKB: 120,            // je Kreatur, nach Reduktion
  paketMB: 60,           // Gesamtpaket im Service-Worker-Cache
  texturPx: 1024,
  beschreibungMin: 40,   // keine Platzhaltertexte
  ungebundeneVertexQuote: 0.05,
};

// ------------------------------------------------------- 1. Inhaltstiefe
const kreaturen = readdirSync('content/creatures')
  .filter(f => f.endsWith('.json'))
  .map(f => ({ f, k: JSON.parse(readFileSync(join('content/creatures', f), 'utf8')) }));

for (const { f, k } of kreaturen) {
  if (!k.beschreibung || k.beschreibung.length < BUDGET.beschreibungMin)
    stop('Inhalt', `${f}: Beschreibung fehlt oder ist ein Platzhalter (<${BUDGET.beschreibungMin} Zeichen)`);
  if (/TODO|TBD|xxx|placeholder/i.test(JSON.stringify(k)))
    stop('Inhalt', `${f}: enthält Platzhalter-Marker`);
  if ((k.zielTris ?? 4000) > BUDGET.trisMax)
    stop('Assets', `${f}: zielTris ${k.zielTris} über Budget ${BUDGET.trisMax}`);

  // Werteprogression: Zuwachs je Stufe muss im Korridor liegen
  for (let i = 1; i < k.stufen.length; i++) {
    const a = k.stufen[i - 1].werte, b = k.stufen[i].werte;
    const summe = (w: any) => w.kp + w.ang + w.ver + w.ini;
    const faktor = summe(b) / summe(a);
    if (faktor < 1.15) warn('Balance', `${f}: Stufe ${i + 1} nur ${((faktor - 1) * 100).toFixed(0)} % stärker — zu flach`);
    if (faktor > 1.45) stop('Balance', `${f}: Stufe ${i + 1} ${((faktor - 1) * 100).toFixed(0)} % stärker — Sprung zu groß`);
  }

  // Designregel: genau EIN Biotech-Merkmal
  if (k.merkmal.includes(' und ') || k.merkmal.includes(','))
    stop('Design', `${f}: mehr als ein Merkmal — verstößt gegen die Designregel`);
}

// -------------------------------------------- 2. Roster-Deckung je Region
const regionen = existsSync('content/regions')
  ? readdirSync('content/regions').filter(f => f.endsWith('.json'))
  : [];
for (const rf of regionen) {
  const r = JSON.parse(readFileSync(join('content/regions', rf), 'utf8'));
  const elemente = new Set<string>();
  for (const id of r.kreaturen ?? []) {
    const k = kreaturen.find(x => x.k.id === id)?.k;
    if (!k) { stop('Inhalt', `${rf}: Kreatur '${id}' existiert nicht`); continue; }
    k.elemente.forEach((e: string) => elemente.add(e));
  }
  if (elemente.size < 4)
    stop('Balance', `${rf}: nur ${elemente.size} Elemente vertreten — Region wird eintönig (min. 4)`);

  // Der Regent muss konterbar sein
  const regent = existsSync(`content/regenten/${r.regent}.json`)
    ? JSON.parse(readFileSync(`content/regenten/${r.regent}.json`, 'utf8')) : null;
  if (regent) {
    for (const [i, ph] of regent.phasen.entries()) {
      const konter = [...elemente].filter(e =>
        ph.elemente.every((pe: any) => effektivitaet(e as any, pe) === 2));
      if (konter.length === 0)
        stop('Balance', `${rf}: Regenten-Phase ${i + 1} (${ph.elemente}) hat KEINEN Konter in der Region`);
      else if (konter.length === 1)
        warn('Balance', `${rf}: Phase ${i + 1} nur über '${konter[0]}' konterbar — bewusst als Engpass?`);
    }
  }
}

// ------------------------------------------------------ 3. Asset-Budgets
if (existsSync('assets/creatures')) {
  let gesamt = 0;
  for (const f of readdirSync('assets/creatures').filter(f => f.endsWith('.glb'))) {
    const kb = statSync(join('assets/creatures', f)).size / 1024;
    gesamt += kb;
    if (kb > BUDGET.glbKB) stop('Assets', `${f}: ${kb.toFixed(0)} KB über Budget ${BUDGET.glbKB} KB`);
  }
  if (gesamt / 1024 > BUDGET.paketMB)
    stop('Assets', `Gesamtpaket ${(gesamt / 1024).toFixed(1)} MB über ${BUDGET.paketMB} MB — Offline-Cache gefährdet`);
} else warn('Assets', 'assets/creatures fehlt — Asset-Budget nicht prüfbar');

// -------------------------------------------------- 4. System-Invarianten
let matrixOk = true;
for (const a of ELEMENTE) {
  const s = ELEMENTE.filter(d => effektivitaet(a, d) === 2).length;
  const n = ELEMENTE.filter(d => effektivitaet(d, a) === 2).length;
  if (s !== 2 || n !== 2) { matrixOk = false; stop('System', `Element '${a}' unausgewogen (${s}/${n})`); }
}
// Fokus-Effizienz: normal und schwer müssen gleich effizient sein (Tempo statt Effizienz)
const eff = (b: keyof typeof BAND) => BAND[b].power / BAND[b].fokus;
if (Math.abs(eff('normal') - eff('schwer')) > 0.01)
  stop('System', `Fokus-Effizienz normal (${eff('normal')}) ≠ schwer (${eff('schwer')}) — Entscheidung wird zur Falle`);

// ------------------------------------------------------------- Ausgabe
const stops = befunde.filter(b => b.schwere === 'stop');
const warns = befunde.filter(b => b.schwere === 'warnung');
console.log(`\nQualitätstor — ${kreaturen.length} Kreaturen, ${regionen.length} Regionen\n`);
for (const b of stops) console.log(`  ✗ [${b.bereich}] ${b.text}`);
for (const b of warns) console.log(`  ! [${b.bereich}] ${b.text}`);
if (!befunde.length) console.log('  Alle automatischen Prüfungen bestanden.');
console.log(`\n${stops.length} Blocker, ${warns.length} Warnungen`);
console.log(matrixOk ? 'Matrix-Invariante hält.\n' : 'MATRIX VERLETZT.\n');
process.exit(stops.length ? 1 : 0);
