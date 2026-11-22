/**
 * BRACHLAND — Überschlagsrechnung der Aufwertungs-Ökonomie (D393)
 *
 * Rechnet je Spielweise über eine Region, was an Material und Markenstärke anfällt und was man sich
 * davon leisten kann. Liest `content/oekonomie.json`, `content/reinigen.json` und
 * `content/belohnungen.json`; die Regeln stehen in `src/spiel/oekonomie.ts`. Erwartungswerte, kein
 * Würfeln, kein Kampf — in Millisekunden fertig. Messwerkzeug, nicht im Gate.
 *
 *   npx tsx tools/oekonomiesim.ts [region]
 *
 * Tabelle in `docs/design/BRACHLAND_Gegenstaende-und-Aufwertung_v1.md` §3.
 */
import { readFileSync } from 'node:fs';
import { Oekonomie, ReinigenDaten, Belohnungen, BELOHNUNGS_RAENGE } from '../src/data/schema.js';
import { bilanz, SPIELWEISEN } from '../src/spiel/oekonomie.js';
import { JE_STUFE } from '../src/spiel/schmiede.js';

const lies = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const o = Oekonomie.parse(lies('content/oekonomie.json'));
const rein = ReinigenDaten.parse(lies('content/reinigen.json'));
const bel = Belohnungen.parse(lies('content/belohnungen.json'));
const region = process.argv[2] ?? 'oental';
const marke = { start: rein.fassung.start, jeRegent: rein.fassung.jeRegent, ladung: rein.ladung, ladungVerhaertet: rein.verhaertet.ladung };

const a = o.regionen[region]?.annahmen;
if (!a) { console.error(`Region '${region}' fehlt in content/oekonomie.json`); process.exit(1); }
console.log(`Region ${region} — Annahmen: ${a.begegnungen} Begegnungen, ${a.tiere} Tiere, ${a.rasten} Rasten, ${a.verhaertete} Verhärtete, ${a.menschen} Menschen, ${a.reviere} Reviere`);
console.log(`Schmiede: ${o.schmiede.map(s => `Stufe ${s.stufe}${s.vorschlag ? ' (Vorschlag)' : ''} = ${Object.entries(s.preis).map(([g, n]) => `${n} ${g}`).join(' + ')}`).join('; ')}`);
console.log(`Marke: Schwellen ${o.marke.schwellen.join(' / ')}, Fassung ${marke.start} + ${marke.jeRegent} je Regent + ${o.marke.fassungJeStufe} je Stufe\n`);

const zeilen = SPIELWEISEN.map(w => bilanz(w, region, o, marke));
const spalte = (titel: string, f: (b: typeof zeilen[number]) => string) =>
  console.log(`| ${titel} | ${zeilen.map(f).join(' | ')} |`);
console.log(`| | ${zeilen.map(z => z.name).join(' | ')} |`);
console.log(`|---|${zeilen.map(() => '---').join('|')}|`);
spalte('Tiere getötet / gereinigt / umgangen', b => `${b.getoetet} / ${b.gereinigt} / ${b.umgangen}`);
spalte('Verhärtete getötet / gereinigt', b => `${b.verhaerteteGetoetet} / ${b.verhaerteteGereinigt}`);
spalte('Chitinspan / Federstahl / Härtling / Kernschlacke', b => `${b.vorrat.chitinspan ?? 0} / ${b.vorrat.federstahl ?? 0} / ${b.vorrat.haertling ?? 0} / ${b.vorrat.kernschlacke ?? 0}`);
spalte('Waffenstufen (Haupt / zweite / dritte)', b => b.waffen.join(' / '));
spalte('Waffenschaden Hauptwaffe', b => `+${Math.round(b.waffen[0] * JE_STUFE * 100)} %`);
spalte('Läuterung → Markenstufe', b => `${b.laeuterung} → ${b.markenStufe}`);
spalte('Fassung nach dem Regenten', b => `${b.fassung}`);
spalte('ruhige Reviere', b => `${b.ruhigeReviere} von ${a.reviere}`);
spalte('Flasche (Schlucke × Stärke)', b => `${b.schlucke} × ${Math.round(b.staerke * 100)} %`);
spalte('Reinkulturen übrig', b => `${b.reinkulturenUebrig}`);
spalte('Anteil gereinigt an den Eingriffen', b => `${Math.round(b.anteilGereinigt * 100)} %`);

// Dominanzprüfung: Keine der kämpfenden Spielweisen darf eine andere auf beiden Achsen schlagen.
// Der Umgeher steht daneben: Er verzichtet auf beides, sein Lohn ist das Vertrauen der Mönche (D385).
console.log('\nDominanz (Hauptwaffe und Markenstufe, ohne Umgeher):');
let dominiert = 0;
const kaempfer = zeilen.filter(z => z.name !== 'Umgeher');
for (const x of kaempfer) for (const y of kaempfer) if (x !== y) {
  const besser = x.waffen[0] >= y.waffen[0] && x.markenStufe >= y.markenStufe
    && (x.waffen[0] > y.waffen[0] || x.markenStufe > y.markenStufe);
  if (besser) { dominiert++; console.log(`  ✗ ${x.name} schlägt ${y.name} auf beiden Achsen (${x.waffen[0]}/${x.markenStufe} gegen ${y.waffen[0]}/${y.markenStufe})`); }
}
if (!dominiert) console.log('  ✓ keine Spielweise schlägt eine andere auf beiden Achsen');

console.log('\nBelohnungsleiter (Mengenware je Sprosse):');
for (const rang of BELOHNUNGS_RAENGE) {
  const teile = Object.entries(bel.mengen).flatMap(([k, liste]) => liste!
    .filter(e => (e.menge[rang] ?? 0) > 0).map(e => `${k}: ${e.menge[rang]} ${e.gegenstand}`));
  console.log(`  ${rang.padEnd(16)} ${teile.join(' · ') || '—'}`);
}
