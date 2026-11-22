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
import { Oekonomie, ReinigenDaten, Belohnungen, Techniken, Wirken, BELOHNUNGS_RAENGE } from '../src/data/schema.js';
import { bilanz, SPIELWEISEN, zaehlerStand } from '../src/spiel/oekonomie.js';
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
spalte('Umbau der Hauptwaffe bezahlt (D403)', b => b.umbau ? 'ja' : 'nein');
spalte('Waffenschaden Hauptwaffe', b => `+${Math.round(b.waffen[0] * JE_STUFE * 100)} %`);
spalte('Läuterung → Markenstufe', b => `${b.laeuterung} → ${b.markenStufe}`);
spalte('Fassung nach dem Regenten', b => `${b.fassung}`);
spalte('ruhige Reviere', b => `${b.ruhigeReviere} von ${a.reviere}`);
spalte('Flasche (Schlucke × Stärke)', b => `${b.schlucke} × ${Math.round(b.staerke * 100)} %`);
spalte('Reinkulturen übrig', b => `${b.reinkulturenUebrig}`);
spalte('Anteil gereinigt an den Eingriffen', b => `${Math.round(b.anteilGereinigt * 100)} %`);

// --- D400: Fortschritt der Spielfigur
const techniken = Techniken.parse(lies('content/techniken.json'));
const technikKosten = techniken.reduce((n, t) => n + t.kosten, 0);
// Schwelle und Gewichte des Zählers: die `eingriffe`-Bedingung in seinen Stationen (D404: Reinigen wiegt leichter).
let moenchsSchwelle = Infinity, gewichte = { getoetet: 1, gereinigt: 1 };
JSON.stringify(lies('content/wanderfiguren/zaehler.json'), (_k, v) => {
  if (v && typeof v === 'object' && v.art === 'eingriffe' && typeof v.anzahl === 'number') { moenchsSchwelle = v.anzahl; if (v.gewichte) gewichte = v.gewichte; }
  return v;
});
const wirken = Wirken.parse(lies('content/wirken.json'));
const wirkenKosten = wirken.reduce((n, x) => n + x.einsicht, 0);
const stand = (b: typeof zeilen[number]) => zaehlerStand(b, gewichte);
console.log(`\nFortschritt der Spielfigur (D400/D405) — Techniken: ${techniken.length} für ${technikKosten} Einsicht, Wirken: ${wirken.length} für ${wirkenKosten}; Zähler: Schwelle ${moenchsSchwelle}, getötet × ${gewichte.getoetet}, gereinigt × ${gewichte.gereinigt}\n`);
console.log(`| | ${zeilen.map(z => z.name).join(' | ')} |`);
console.log(`|---|${zeilen.map(() => '---').join('|')}|`);
spalte('Eingriffe ungewichtet (vor D405)', b => `${b.eingriffe}`);
spalte('Stand beim Zähler (gewichtet)', b => `${stand(b).toFixed(0)}`);
spalte('Mönche trauen', b => stand(b) <= moenchsSchwelle ? 'ja' : 'nein');
spalte('Ladungen ins Wirken (D405)', b => `${b.wirkenLadungen}`);
spalte('leere Reviere → nachgewanderte Verhärtete', b => `${b.leereReviere} → ${b.nachgewandert}`);
spalte('Bossteile Mark / Abwurf', b => `${b.mark} / ${b.abwurf}`);
spalte('Dauersude: Leben / Ausdauer', b => `+${b.lebenPlus} / +${b.ausdauerPlus}`);
spalte('Figurenlinien abgeschlossen', b => `${b.linien} von ${o.erfahrung.linien}`);
spalte('Einsicht (von ' + (technikKosten + wirkenKosten) + ' für alle Techniken und alles Wirken)', b => `${b.einsicht}`);

// Dominanzprüfung über alle Achsen: Waffe, Marke, Leben, Ausdauer, Einsicht, Vertrauen der Mönche.
// Keine Spielweise darf eine andere auf jeder Achse erreichen und auf einer übertreffen.
console.log('\nDominanz (Waffe, Marke, Leben, Ausdauer, Einsicht, Mönche):');
const achsen = (b: typeof zeilen[number]) => [b.waffen[0], b.markenStufe, b.lebenPlus, b.ausdauerPlus, b.einsicht, stand(b) <= moenchsSchwelle ? 1 : 0];
let dominiert = 0;
for (const x of zeilen) for (const y of zeilen) if (x !== y) {
  const ax = achsen(x), ay = achsen(y);
  if (ax.every((v, i) => v >= ay[i]) && ax.some((v, i) => v > ay[i])) {
    dominiert++; console.log(`  ✗ ${x.name} schlägt ${y.name} auf allen Achsen (${ax.join('/')} gegen ${ay.join('/')})`);
  }
}
if (!dominiert) console.log('  ✓ keine Spielweise schlägt eine andere auf allen Achsen');
else console.log('  (Befund D405: mit Reinigen × 0,25 bleibt bei Schwelle 40 auch der Heiler unter dem Zähler; bei 30 trennt er Heiler und Umgeher wieder — A-32)');
console.log(`  Schwellenprobe: unter 30 bleiben ${zeilen.filter(z => stand(z) <= 30).map(z => z.name).join(', ') || 'niemand'}; unter 40 ${zeilen.filter(z => stand(z) <= 40).map(z => z.name).join(', ') || 'niemand'}; unter 50 ${zeilen.filter(z => stand(z) <= 50).map(z => z.name).join(', ') || 'niemand'}; unter 60 ${zeilen.filter(z => stand(z) <= 60).map(z => z.name).join(', ') || 'niemand'}`);
for (const z of zeilen) console.log(`    ${z.name.padEnd(11)} ${achsen(z).join(' / ')}`);

console.log('\nBelohnungsleiter (Mengenware je Sprosse):');
for (const rang of BELOHNUNGS_RAENGE) {
  const teile = Object.entries(bel.mengen).flatMap(([k, liste]) => liste!
    .filter(e => (e.menge[rang] ?? 0) > 0).map(e => `${k}: ${e.menge[rang]} ${e.gegenstand}`));
  console.log(`  ${rang.padEnd(16)} ${teile.join(' · ') || '—'}`);
}
