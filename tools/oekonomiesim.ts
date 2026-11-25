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
 *
 * Seit D416 über die **echten Reviere** (`content/reviere/<region>.json`) statt über `annahmen.reviere` gleich grosse:
 * Begegnungen nach dem Bestand je Revier, Reviere in der Reihenfolge ihres Abstands vom Start, ruhig/leer nach
 * `reviere.bezug` — und zum Vergleich mit dem anderen Bezug und der alten Annahme. Der Zähler in drei Stufen
 * (abgewandt / geduldet / vertraut, D406).
 */
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { Oekonomie, ReinigenDaten, Belohnungen, Techniken, Wirken, Revierkarte, BELOHNUNGS_RAENGE } from '../src/data/schema.js';
import { bilanz, bilanzMitRevieren, SPIELWEISEN, zaehlerStand, type Bilanz, type SimRevier, type RevierBilanz } from '../src/spiel/oekonomie.js';
import { bestand, regelnAus, zaehlerStufe, type Zaehlerstufe } from '../src/spiel/reviere.js';
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

// D416: die echten Reviere, in der Reihenfolge ihres Abstands vom Start (Annahme: man arbeitet sich von innen nach aussen).
const pfad = `content/reviere/${region}.json`;
if (!existsSync(pfad)) { console.error(`${pfad} fehlt — erst \`npx tsx tools/reviere.ts ${region} --schreiben\``); process.exit(1); }
const karte = Revierkarte.parse(lies(pfad));
/** Verhärtete: je verborgenem Ort einer (Lage v2), der Rest der Annahme an den Engstellen des Uferwegs (D393). */
const ENGSTELLEN = 'oental-uferweg';
const simReviere: SimRevier[] = [...karte.reviere]
  .sort((x, y) => Math.hypot(...x.kern) - Math.hypot(...y.kern))
  .map(r => ({ id: r.id, bestand: bestand(r), verhaertete: r.verborgeneOrte.length }));
const rest = a.verhaertete - simReviere.reduce((n, r) => n + r.verhaertete, 0);
const eng = simReviere.find(r => r.id === ENGSTELLEN);
if (eng && rest > 0) eng.verhaertete += rest;
const regeln = regelnAus(o);
const anders = regeln.bezug === 'bestand' ? 'begegnet' : 'bestand';
console.log(`Reviere (D416): ${karte.reviere.length} echte statt ${a.reviere} angenommene, Bestand ${simReviere.reduce((n, r) => n + r.bestand, 0)} Tiere, davon ${a.tiere} begegnet; Reihenfolge ${simReviere.map(r => r.id.replace(/^[a-z]+-/, '')).join(' → ')}; Verhärtete ${simReviere.filter(r => r.verhaertete).map(r => `${r.id.replace(/^[a-z]+-/, '')} ${r.verhaertete}`).join(', ')}; Bezug „${regeln.bezug}“ (Daten), zum Vergleich „${anders}“\n`);
const zeilen: RevierBilanz[] = SPIELWEISEN.map(w => bilanzMitRevieren(w, region, o, marke, simReviere, regeln));
const zeilenAnders = SPIELWEISEN.map(w => bilanzMitRevieren(w, region, o, marke, simReviere, { ...regeln, bezug: anders }));
const zeilenAlt = SPIELWEISEN.map(w => bilanz(w, region, o, marke));
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
spalte('ruhige Reviere', b => `${b.ruhigeReviere} von ${b.reviere}`);
spalte('leere Reviere', b => `${b.leereReviere} von ${b.reviere}`);
spalte('unberührte Reviere', b => `${b.unberuehrt} von ${b.reviere}`);
spalte('nachgewachsen bis Kapitelende (D399)', b => `${b.nachgewachsen}`);
spalte('Flasche (Schlucke × Stärke)', b => `${b.schlucke} × ${Math.round(b.staerke * 100)} %`);
spalte('Reinkulturen übrig', b => `${b.reinkulturenUebrig}`);
spalte('Anteil gereinigt an den Eingriffen', b => `${Math.round(b.anteilGereinigt * 100)} %`);

// --- D400: Fortschritt der Spielfigur
const techniken = Techniken.parse(lies('content/techniken.json'));
const technikKosten = techniken.reduce((n, t) => n + t.kosten, 0);
// Schwelle und Gewichte des Zählers: die `eingriffe`-Bedingung in seinen Stationen (D404: Reinigen wiegt leichter).
let moenchsSchwelle = Infinity, gewichte = { getoetet: 1, gereinigt: 1 }, unberuehrtMindestens = 0;
JSON.stringify(lies('content/wanderfiguren/zaehler.json'), (_k, v) => {
  if (v && typeof v === 'object' && (v.art === 'eingriffe' || v.art === 'misstraut') && typeof v.anzahl === 'number') {
    moenchsSchwelle = v.anzahl; if (v.gewichte) gewichte = v.gewichte;
    if (v.art === 'misstraut') unberuehrtMindestens = v.unberuehrtMindestens;
  }
  return v;
});
const regelZaehler = { anzahl: moenchsSchwelle, unberuehrtMindestens };
const stufeVon = (b: RevierBilanz): Zaehlerstufe => zaehlerStufe(zaehlerStand(b, gewichte), b.unberuehrt / b.reviere, regelZaehler);
const STUFENWERT: Record<Zaehlerstufe, number> = { abgewandt: 0, geduldet: 1, vertraut: 2 };
const wirken = Wirken.parse(lies('content/wirken.json')).filter(x => x.status === 'gilt');
const wirkenKosten = wirken.reduce((n, x) => n + x.einsicht, 0);
const stand = (b: Bilanz) => zaehlerStand(b, gewichte);
console.log(`\nFortschritt der Spielfigur (D400/D405) — Techniken: ${techniken.length} für ${technikKosten} Einsicht, Wirken: ${wirken.length} für ${wirkenKosten}; Zähler: geduldet bis ${moenchsSchwelle}, getötet × ${gewichte.getoetet}, gereinigt × ${gewichte.gereinigt}; vertraut ab ${Math.round(unberuehrtMindestens * 100)} % unberührter Reviere\n`);
console.log(`| | ${zeilen.map(z => z.name).join(' | ')} |`);
console.log(`|---|${zeilen.map(() => '---').join('|')}|`);
spalte('Eingriffe ungewichtet (vor D405)', b => `${b.eingriffe}`);
spalte('Stand beim Zähler (gewichtet)', b => `${stand(b).toFixed(0)}`);
spalte('Zähler (D406): Stufe', b => stufeVon(b));
spalte('Ladungen ins Wirken (D405)', b => `${b.wirkenLadungen}`);
spalte('leere Reviere → nachgewanderte Verhärtete', b => `${b.leereReviere} → ${b.nachgewandert}`);
spalte('Bossteile Mark / Abwurf', b => `${b.mark} / ${b.abwurf}`);
spalte('Dauersude: Leben / Ausdauer', b => `+${b.lebenPlus} / +${b.ausdauerPlus}`);
spalte('Figurenlinien abgeschlossen', b => `${b.linien} von ${o.erfahrung.linien}`);
spalte('Einsicht (von ' + (technikKosten + wirkenKosten) + ' für alle Techniken und alles Wirken)', b => `${b.einsicht}`);

// Dominanzprüfung über alle Achsen: Waffe, Marke, Leben, Ausdauer, Einsicht, Vertrauen der Mönche.
// Keine Spielweise darf eine andere auf jeder Achse erreichen und auf einer übertreffen.
console.log('\nDominanz (Waffe, Marke, Leben, Ausdauer, Einsicht, Zähler-Stufe 0/1/2):');
const achsen = (b: RevierBilanz) => [b.waffen[0], b.markenStufe, b.lebenPlus, b.ausdauerPlus, b.einsicht, STUFENWERT[stufeVon(b)]];
const dominanz = (liste: RevierBilanz[], titel: string) => {
  let n = 0;
  for (const x of liste) for (const y of liste) if (x !== y) {
    const ax = achsen(x), ay = achsen(y);
    if (ax.every((v, i) => v >= ay[i]) && ax.some((v, i) => v > ay[i])) {
      n++; console.log(`  ✗ ${titel}: ${x.name} schlägt ${y.name} auf allen Achsen (${ax.join('/')} gegen ${ay.join('/')})`);
    }
  }
  if (!n) console.log(`  ✓ ${titel}: keine Spielweise schlägt eine andere auf allen Achsen`);
  return n;
};
const dominiert = dominanz(zeilen, `Bezug „${regeln.bezug}“ (Daten)`);
dominanz(zeilenAnders, `Bezug „${anders}“ (Vergleich)`);
console.log(`  Schwellenprobe: unter 30 bleiben ${zeilen.filter(z => stand(z) <= 30).map(z => z.name).join(', ') || 'niemand'}; unter 40 ${zeilen.filter(z => stand(z) <= 40).map(z => z.name).join(', ') || 'niemand'}; unter 50 ${zeilen.filter(z => stand(z) <= 50).map(z => z.name).join(', ') || 'niemand'}; unter 60 ${zeilen.filter(z => stand(z) <= 60).map(z => z.name).join(', ') || 'niemand'}`);
for (const z of zeilen) console.log(`    ${z.name.padEnd(11)} ${achsen(z).join(' / ')}`);

console.log(`\nVergleich — was sich mit den echten Revieren verschiebt (Waffe / Marke / ruhig / leer → Verhärtete / Zähler):`);
console.log(`| | ${zeilen.map(z => z.name).join(' | ')} |`);
console.log(`|---|${zeilen.map(() => '---').join('|')}|`);
const kurz = (b: Pick<RevierBilanz, 'waffen' | 'markenStufe' | 'ruhigeReviere' | 'leereReviere' | 'nachgewandert'>, n: number, st: string) =>
  `${b.waffen[0]} / ${b.markenStufe} / ${b.ruhigeReviere} von ${n} / ${b.leereReviere} → ${b.nachgewandert} / ${st}`;
console.log(`| Annahme D393 (${a.reviere} gleiche Reviere) | ${zeilenAlt.map(b => kurz(b, a.reviere, stand(b) <= moenchsSchwelle ? 'geduldet' : 'abgewandt')).join(' | ')} |`);
console.log(`| echte Reviere, Bezug „${regeln.bezug}“ | ${zeilen.map(b => kurz(b, b.reviere, stufeVon(b))).join(' | ')} |`);
console.log(`| echte Reviere, Bezug „${anders}“ | ${zeilenAnders.map(b => kurz(b, b.reviere, stufeVon(b))).join(' | ')} |`);
console.log('\nJe Revier (Heiler, Bezug Daten): getötet / gereinigt / begegnet');
for (const r of zeilen[2].je) console.log(`  ${r.id.padEnd(18)} ${r.getoetet} / ${r.gereinigt} / ${r.begegnet}${r.ruhig ? '  ruhig' : ''}${r.leer ? '  leer' : ''}`);
if (dominiert) process.exitCode = 0; // Messwerkzeug: der Befund steht in der Ausgabe, der Test in tests/oekonomie.test.ts

console.log('\nBelohnungsleiter (Mengenware je Sprosse):');
for (const rang of BELOHNUNGS_RAENGE) {
  const teile = Object.entries(bel.mengen).flatMap(([k, liste]) => liste!
    .filter(e => (e.menge[rang] ?? 0) > 0).map(e => `${k}: ${e.menge[rang]} ${e.gegenstand}`));
  console.log(`  ${rang.padEnd(16)} ${teile.join(' · ') || '—'}`);
}
