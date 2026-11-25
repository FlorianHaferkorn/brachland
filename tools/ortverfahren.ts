/**
 * BRACHLAND — Verfahren „Ort für Ort“ (D459): ein Aufruf je Schritt, Abnahme als bestanden / nicht bestanden.
 *
 *   npx tsx tools/ortverfahren.ts <ort> plan [Dxxx] [kamera]     alle Schritte mit ausgefüllten Befehlen
 *   npx tsx tools/ortverfahren.ts <ort> schritt <n> [Dxxx]       ein Schritt
 *   npx tsx tools/ortverfahren.ts <ort> pruefe                   Akte gegen das Schema, Bauteile, Quellen
 *   npx tsx tools/ortverfahren.ts <ort> zielwerte                Messwerte des Zielbilds, Regelbereich
 *   npx tsx tools/ortverfahren.ts <ort> adresse [kamera]         Kamera, Bildwinkel, Absetzpunkt, Sonnenstand, Stimmung
 *   npx tsx tools/ortverfahren.ts <ort> abnahme <spielbild>      Spielbild gegen Zielbild, Toleranzen der Akte
 *   npx tsx tools/ortverfahren.ts <ort> bildrate <bildrate.txt>  Ausgabe von tools/mess/bildrate.mjs beurteilen
 *   npx tsx tools/ortverfahren.ts <ort> budget                   Dateigrösse der exportierten Szene
 *
 * Kurzform: `make ort ORT=<ort> [SCHRITT=<n>] [D=Dxxx]`. Ablauf, Regeln und Eskalation: `docs/VERFAHREN_ORT.md`.
 * Akten liegen unter `tools/ort/<ort>.json`. Ende mit Code 1, wenn eine Abnahme nicht bestanden ist.
 *
 * In der Cloud geprüft: plan, schritt, pruefe, zielwerte, adresse, abnahme (an eingecheckten Bildern), bildrate (an
 * Textproben). Die Befehle der Schritte 4, 6, 7 und 8 selbst brauchen den M1 (GPU, Scans, Blender-Szene) und sind
 * aus D445–D450 zusammengesetzt, dort aber in dieser Form nicht am Stück gelaufen.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  Akte, abnahme, abnahmeTabelle, adresse, bildratenUrteil, budgetUrteil, leseBildrate, regelpruefung, schritte, sonnenstand,
  sonnenstandImQuelltext, stimmungsVorlage, zeige, type Messwerte, type Schritt,
} from './ortlogik.js';

function ladeAkte(ort: string): Akte {
  const pfad = join('tools', 'ort', `${ort}.json`);
  if (!existsSync(pfad)) throw new Error(`Keine Akte ${pfad} — Vorlage: tools/ort/felsmulde.json`);
  return Akte.parse(JSON.parse(readFileSync(pfad, 'utf8')));
}

function messe(bilder: string[]): Messwerte[] {
  for (const b of bilder) if (!existsSync(b)) throw new Error(`Bild fehlt: ${b}`);
  const roh = JSON.parse(execFileSync('python3', ['tools/mess/messwerte.py', '--json', ...bilder], { encoding: 'utf8' })) as Record<string, Messwerte>;
  return bilder.map(b => roh[b]);
}

function drucke(s: Schritt) {
  console.log(`\n## Schritt ${s.nr} — ${s.titel}   [${s.wo === 'm1' ? 'nur am M1' : 'Cloud oder M1'} · ${s.wer === 'guenstig' ? 'günstiges Modell' : 'RÜCKGABE an stärkeres Modell / Flo'}]`);
  console.log(`Zweck: ${s.zweck}`);
  console.log('Befehle:'); for (const b of s.befehle) console.log(`  ${b}`);
  console.log(`Ausgabe: ${s.ausgabe}`);
  console.log(`Abnahme: ${s.abnahme}`);
  console.log('Bei Verfehlen (höchstens diese zwei, dann stoppen und melden):'); s.beiVerfehlen.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
}

const [ort, befehl = 'plan', ...rest] = process.argv.slice(2);
if (!ort) { console.error('Aufruf: npx tsx tools/ortverfahren.ts <ort> plan|schritt|pruefe|zielwerte|adresse|abnahme|bildrate|budget …'); process.exit(2); }
const a = ladeAkte(ort);
let ok = true;

if (befehl === 'plan') {
  console.log(`# Verfahren Ort für Ort — ${a.name} (${a.id}), Zielbild ${a.zielbild.freigabe}, Runde ${rest[0] ?? 'Dxxx'}`);
  schritte(a, rest[0], rest[1]).forEach(drucke);
} else if (befehl === 'schritt') {
  const s = schritte(a, rest[1], rest[2]).find(x => x.nr === Number(rest[0]));
  if (!s) throw new Error(`Schritt ${rest[0]} gibt es nicht (1–10)`);
  drucke(s);
} else if (befehl === 'pruefe') {
  console.log(`Ort ${a.name} (${a.id}), Region ${a.region}, Ursprung ${a.ursprung.x}/${a.ursprung.z}, h0 ${a.h0.toFixed(2)} m`);
  console.log(`Zielbild: ${a.zielbild.werkzeug} Modus ${a.zielbild.modus}, freigegeben ${a.zielbild.freigabe}, Bild ${a.zielbild.bild}`);
  const ledger = readFileSync('docs/_INDEX.md', 'utf8');
  if (!new RegExp(`^\\| ${a.zielbild.freigabe} \\|`, 'm').test(ledger)) { ok = false; console.log(`FEHLER: Freigabe ${a.zielbild.freigabe} steht nicht im Ledger (docs/_INDEX.md Tabelle B)`); }
  if (!existsSync(a.zielbild.bild)) { ok = false; console.log(`FEHLER: Zielbild ${a.zielbild.bild} fehlt`); }
  for (const b of a.bauteile) {
    console.log(`  Bauteil ${b.id.padEnd(10)} ${b.art.padEnd(9)} über ${b.weg}${b.datei ? ' → ' + b.datei : ''}`);
    if (b.weg === 'hand') { ok = false; console.log('    FEHLER: Weg `hand` — dafür gibt es kein Werkzeug, Rückgabe an ein stärkeres Modell'); }
    if (b.weg === 'engine') console.log('    Hinweis: Engine-Bauteil, wird in diesem Verfahren nicht übertragen' + (b.hinweis ? ` (${b.hinweis})` : ''));
  }
  for (const q of a.quellen) console.log(`  Quelle ${q.name}: ${q.lizenz} — ${q.imSpiel ? 'im Spiel erlaubt' : 'NUR Zielbild, nicht ins Spiel (ADR-0021)'}`);
  console.log(ok ? 'AKTE GÜLTIG' : 'AKTE NICHT GÜLTIG');
} else if (befehl === 'zielwerte') {
  const [z] = messe([a.zielbild.bild]);
  console.log('| Grösse | Zielbild | Regelbereich | im Bereich |\n|---|---|---|---|');
  for (const r of regelpruefung(z)) console.log(`| ${r.name} | ${zeige(r.groesse, r.wert)} | ${zeige(r.groesse, r.von)} … ${zeige(r.groesse, r.bis)} | ${r.drin ? 'ja' : 'NEIN — melden, nicht ändern'} |`);
  console.log(`| Sättigung | ${zeige('saett', z.saett)} | — | — |\n| Himmel (Flutfüllung) | ${zeige('himmel', z.himmel)} | — | — |`);
  console.log('ZIELWERTE GEMESSEN');
} else if (befehl === 'adresse') {
  const k = a.kameras.find(x => x.name === rest[0]) ?? a.kameras[0];
  const adr = adresse(a, k);
  console.log(`Kamera ${k.name}: kamera=${adr.kamera}  fov=${adr.fov}  absetzen=${adr.absetzen}`);
  console.log(`Adresszusatz vorher:  ${adr.zusatz(a.spiel.schalterVorher)}`);
  console.log(`Adresszusatz nachher: ${adr.zusatz(a.spiel.schalterNachher)}`);
  const soll = sonnenstand(a.sonne.azimut, a.sonne.hoehe);
  console.log(`Sonne Azimut ${a.sonne.azimut}°, Höhe ${a.sonne.hoehe}° → sonnenstand [${soll.map(n => n.toFixed(1)).join(', ')}]`);
  const ist = sonnenstandImQuelltext(readFileSync('src/world/stimmung.ts', 'utf8'), a.spiel.stimmung);
  if (!ist) { ok = false; console.log(`STIMMUNG FEHLT: \`${a.spiel.stimmung}\` steht nicht in src/world/stimmung.ts. Diesen Block unverändert einfügen:\n\n${stimmungsVorlage(a)}\n`); }
  else if (ist.some((n, i) => Math.abs(n - soll[i]) > 0.5)) { ok = false; console.log(`STIMMUNG WEICHT AB: \`${a.spiel.stimmung}\` hat sonnenstand [${ist.join(', ')}] — nicht überschreiben, melden.`); }
  else console.log('STIMMUNG PASST');
} else if (befehl === 'abnahme') {
  if (!rest[0]) throw new Error('Aufruf: … abnahme <spielbild.png>');
  const [z, s] = messe([a.zielbild.bild, rest[0]]);
  const urteil = abnahme(z, s, a.abnahme.toleranz);
  console.log(abnahmeTabelle(urteil));
  ok = urteil.bestanden;
} else if (befehl === 'bildrate') {
  if (!rest[0]) throw new Error('Aufruf: … bildrate <bildrate.txt>');
  const u = bildratenUrteil(leseBildrate(readFileSync(rest[0], 'utf8')), a.abnahme.bildrate.min, a.abnahme.budget);
  for (const m of u.meldungen) console.log(m);
  console.log(`Engpass: ${u.engpass}`);
  console.log(u.bestanden ? 'BILDRATE BESTANDEN' : 'BILDRATE NICHT BESTANDEN');
  ok = u.bestanden;
} else if (befehl === 'budget') {
  const dateien = [...new Set(a.bauteile.flatMap(b => (b.datei ? [b.datei] : [])))];
  let summe = 0;
  for (const d of dateien) {
    const p = join('public', a.spiel.ordner, d);
    if (!existsSync(p)) { ok = false; console.log(`FEHLT ${p}`); continue; }
    const g = statSync(p).size; summe += g; console.log(`${(g / 1048576).toFixed(1).padStart(7)} MB  ${p}`);
  }
  const u = budgetUrteil(summe, a.abnahme.budget.dateienMB);
  console.log(`Summe ${u.mb.toFixed(1)} MB, Grenze ${a.abnahme.budget.dateienMB} MB`);
  ok = ok && u.bestanden;
  console.log(ok ? 'BUDGET BESTANDEN' : 'BUDGET NICHT BESTANDEN');
} else throw new Error(`Unbekannter Befehl ${befehl}`);

process.exit(ok ? 0 : 1);
