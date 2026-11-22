/**
 * Speicherformat (D415) — das Datenverlust-Risiko.
 *
 * Bis D415 verwarf `ladeStand` jeden Stand mit anderer Version. Festgehalten wird hier:
 *
 * 1. **Ein echter v1-Stand lädt ohne Verlust** — jedes Feld, jede Kreatur, jede Zahl, auch ein früher
 *    Stand, dem die später ergänzten Felder fehlen (`tests/staende/`).
 * 2. **Nichts wird still verworfen** — kaputt, fremd oder aus einer neueren Fassung: aufbewahrt unter
 *    `sicherung/`, gemeldet, und der Rückfall auf die Rast greift.
 * 3. **Der alte Schlüssel bleibt liegen** — die Migration schreibt daneben, nie darüber.
 * 4. **Export/Import** übersteht Umformatieren, aber kein geändertes Feld (Prüfsumme).
 * 5. **Ein ungültiger Stand überschreibt keinen guten.**
 */
import { readFileSync } from 'node:fs';
import {
  ALTER_SCHLUESSEL, AKTUELLE_VERSION, KOMMT_SPAETER, MIGRATIONEN, beginneNeu, erkenneVersion, exportiere,
  importiere, ladePlatz, listePlaetze, listeSicherungen, oeffne, pruefsumme, schluessel, schreibePlatz,
  stabilJson, type Ablage,
} from '../src/spiel/speicherformat.js';
import { LEERER_STAND, SPIELSTAND_VERSION, ergaenzeStand, type Spielstand } from '../src/spiel/spielstand.js';

let bestanden = 0, fehlgeschlagen = 0;
function pruefe(name: string, bedingung: boolean, zusatz = '') {
  if (bedingung) { bestanden++; console.log(`  ✓ ${name.padEnd(62)} ${zusatz}`); }
  else { fehlgeschlagen++; console.log(`  ✗ ${name.padEnd(62)} ${zusatz}`); }
}

/** Ablage im Arbeitsspeicher; `structuredClone` wie IndexedDB. */
function neueAblage(start: Record<string, unknown> = {}): Ablage & { daten: Map<string, unknown> } {
  const daten = new Map<string, unknown>(Object.entries(start).map(([k, v]) => [k, structuredClone(v)]));
  return {
    daten,
    lies: async k => (daten.has(k) ? structuredClone(daten.get(k)) : undefined),
    schreibe: async (k, v) => { daten.set(k, structuredClone(v)); },
    schluessel: async () => [...daten.keys()],
  };
}

const jetzt = new Date('2026-11-22T12:00:00Z');
const v1 = JSON.parse(readFileSync('tests/staende/v1-oental-unterwegs.json', 'utf8'));
const v1frueh = JSON.parse(readFileSync('tests/staende/v1-frueh-ohne-neue-felder.json', 'utf8'));
const gleich = (a: unknown, b: unknown) => stabilJson(a) === stabilJson(b);

console.log('Speicherformat — Hülle, Migration, Plätze, Export\n');

// ---- Versionen und Migrationskette
pruefe('Format-Version ist 3 (D416), Spielstand nennt dieselbe', AKTUELLE_VERSION === 3 && SPIELSTAND_VERSION === 3 && LEERER_STAND.version === 3);
pruefe('v1 nackt wird als Version 1 erkannt', erkenneVersion(v1) === 1);
pruefe('Fremdes Objekt wird nicht erkannt', erkenneVersion({ version: 1 }) === null && erkenneVersion('x') === null && erkenneVersion(null) === null);
pruefe('Jede Version unter der aktuellen hat eine Migration',
  Array.from({ length: AKTUELLE_VERSION - 1 }, (_, i) => i + 1).every(n => typeof MIGRATIONEN[n] === 'function'));

// ---- v1 lädt ohne Verlust
const o = oeffne(v1, ergaenzeStand, jetzt);
pruefe('v1 öffnet', o.art === 'ok', o.art);
if (o.art === 'ok') {
  const s = o.huelle.spiel as unknown as Record<string, unknown>;
  const verloren = Object.keys(v1).filter(k => k !== 'version' && !gleich(s[k], v1[k]));
  pruefe('v1: jedes Feld unverändert (ausser version)', verloren.length === 0, verloren.join(', ') || `${Object.keys(v1).length - 1} Felder`);
  pruefe('v1: Hülle trägt format, version 3, geschrieben', o.huelle.format === 'brachland-spielstand' && o.huelle.version === 3 && o.huelle.geschrieben === jetzt.toISOString());
  pruefe('v1: vonVersion = 1', o.vonVersion === 1);
  pruefe('v1: Team mit Erfahrung und Rest-KP', gleich(s.team, v1.team));
  pruefe('v1: Kernfunke in den Waffenstufen bleibt', (s.waffenStufen as { funke?: string }).funke === 'wasser');
}
const of = oeffne(v1frueh, ergaenzeStand, jetzt);
pruefe('Früher v1-Stand ohne spätere Felder öffnet', of.art === 'ok', of.art === 'kaputt' ? of.grund : '');
if (of.art === 'ok') {
  const s = of.huelle.spiel;
  pruefe('früh: Team, besiegt, Position bleiben', gleich(s.team, v1frueh.team) && gleich(s.besiegt, v1frueh.besiegt) && gleich(s.position, v1frueh.position));
  pruefe('früh: fehlende Felder aus LEERER_STAND ergänzt', s.region === 'oental' && s.richtungskampf === true && s.held === null
    && Array.isArray(s.orte) && s.orte.length === 0 && gleich(s.beutel, {}));
}

// ---- Laden über den alten Schlüssel
{
  const a = neueAblage({ [ALTER_SCHLUESSEL]: v1 });
  const l = await ladePlatz(a, 1, ergaenzeStand, jetzt);
  pruefe('Platz 1 liest den Stand vor D415', l.art === 'geladen' && l.fassung === 'alt' && l.vonVersion === 1);
  pruefe('… und meldet die Übernahme', l.meldungen.length === 1 && /Version 1/.test(l.meldungen[0]));
  pruefe('Der alte Schlüssel bleibt unverändert liegen', gleich(a.daten.get(ALTER_SCHLUESSEL), v1));
  pruefe('Platz 1 hat danach beide Fassungen in Version 3',
    (a.daten.get(schluessel(1, 'aktuell')) as { version: number }).version === 3
    && (a.daten.get(schluessel(1, 'rast')) as { version: number }).version === 3);
  const zweit = await ladePlatz(a, 1, ergaenzeStand, jetzt);
  pruefe('Zweite Ladung kommt vom neuen Platz, ohne Meldung', zweit.art === 'geladen' && zweit.fassung === 'aktuell' && zweit.meldungen.length === 0);
  const p2 = await ladePlatz(a, 2, ergaenzeStand, jetzt);
  pruefe('Platz 2 liest den alten Schlüssel nicht', p2.art === 'leer');
}

// ---- Kaputt, neuer, Rückfall
{
  const gut = await (async () => { const a = neueAblage(); await schreibePlatz(a, 1, ergaenzeStand(v1), {}, jetzt); return a.daten.get(schluessel(1, 'aktuell')); })();
  const a = neueAblage({ [schluessel(1, 'aktuell')]: { format: 'brachland-spielstand', version: 2, geschrieben: 'x', spiel: { team: 'kaputt' } },
    [schluessel(1, 'rast')]: gut });
  const l = await ladePlatz(a, 1, ergaenzeStand, jetzt);
  pruefe('Kaputtes aktuell → Rückfall auf die Rast', l.art === 'geladen' && l.fassung === 'rast');
  const sich = await listeSicherungen(a);
  pruefe('Kaputtes aktuell ist aufbewahrt, nicht gelöscht', sich.length === 1
    && gleich((a.daten.get(sich[0]) as { roh: unknown }).roh, { format: 'brachland-spielstand', version: 2, geschrieben: 'x', spiel: { team: 'kaputt' } }));
  pruefe('… und gemeldet (Rast + aufbewahrt)', l.meldungen.some(m => /aufbewahrt/.test(m)) && l.meldungen.some(m => /Rast/.test(m)));
}
{
  const neuer = { format: 'brachland-spielstand', version: 9, geschrieben: '2027-01-01T00:00:00Z', spiel: { irgendwas: 1 } };
  const a = neueAblage({ [schluessel(1, 'aktuell')]: neuer });
  const l = await ladePlatz(a, 1, ergaenzeStand, jetzt);
  pruefe('Stand aus neuerer Fassung lädt nicht', l.art === 'leer');
  pruefe('… bleibt aber unangetastet und zusätzlich aufbewahrt', gleich(a.daten.get(schluessel(1, 'aktuell')), neuer)
    && (await listeSicherungen(a)).length === 1);
  pruefe('… mit Meldung „neueren Fassung“', l.meldungen.some(m => /neueren Fassung/.test(m)));
  await schreibePlatz(a, 1, ergaenzeStand(v1frueh), {}, jetzt);
  const s = (await listeSicherungen(a))[0];
  pruefe('Überschreiben danach verliert ihn nicht (Sicherung trägt ihn)', gleich((a.daten.get(s) as { roh: unknown }).roh, neuer));
}
{
  const a = neueAblage({ [ALTER_SCHLUESSEL]: { version: 1, team: 'nicht-ein-array' } });
  const l = await ladePlatz(a, 1, ergaenzeStand, jetzt);
  pruefe('Unlesbarer alter Stand: leer, aufbewahrt, gemeldet', l.art === 'leer' && (await listeSicherungen(a)).length === 1 && l.meldungen.length === 1);
}

// ---- Schreiben
{
  const a = neueAblage();
  const r = await schreibePlatz(a, 2, ergaenzeStand(v1), {}, jetzt);
  pruefe('Erste Schreibung legt auch die Rast an', r.ok && a.daten.has(schluessel(2, 'rast')));
  const spaeter = new Date('2026-11-22T13:00:00Z');
  await schreibePlatz(a, 2, { ...ergaenzeStand(v1), besiegt: [] }, {}, spaeter);
  pruefe('Weitere Schreibung ohne Rast lässt die Rast stehen',
    (a.daten.get(schluessel(2, 'rast')) as { geschrieben: string }).geschrieben === jetzt.toISOString());
  await schreibePlatz(a, 2, ergaenzeStand(v1), { rast: true }, spaeter);
  pruefe('Rast schreibt beide Fassungen', (a.daten.get(schluessel(2, 'rast')) as { geschrieben: string }).geschrieben === spaeter.toISOString());
  const vorher = stabilJson(a.daten.get(schluessel(2, 'aktuell')));
  const kaputt = { ...ergaenzeStand(v1), position: [Number.NaN, 0] } as unknown as Spielstand;
  const rk = await schreibePlatz(a, 2, kaputt, {}, spaeter);
  pruefe('Ungültiger Stand (NaN-Position) wird nicht geschrieben', !rk.ok && stabilJson(a.daten.get(schluessel(2, 'aktuell'))) === vorher);
  const koepfe = await listePlaetze(a);
  pruefe('Platzliste: drei Plätze, nur 2 belegt, mit Region',
    koepfe.length === 3 && !koepfe[0].belegt && koepfe[1].belegt && koepfe[1].region === 'oental' && !koepfe[2].belegt);
  const n = await beginneNeu(a, 2, { ...LEERER_STAND, team: [{ kreatur: 'grathorn', stufe: 3, erfahrung: 0, kp: 0 }] }, spaeter);
  pruefe('Neues Spiel: alter Stand (beide Fassungen) aufbewahrt', n.ok && (await listeSicherungen(a)).length === 2);
}

// ---- Export / Import
{
  const stand = ergaenzeStand(v1);
  const d = exportiere(stand, { einstellungen: { signalfarbe: 'blau' } }, jetzt);
  pruefe('Dateiname brachland-<region>-<datum>.json', d.name === 'brachland-oental-2026-11-22.json', d.name);
  const r = importiere(d.text, ergaenzeStand, jetzt);
  pruefe('Export → Import ergibt denselben Stand', r.ok && gleich(r.stand, { ...stand, version: 3 }));
  pruefe('Import bringt die persönlichen Einstellungen mit', r.ok && gleich(r.einstellungen, { signalfarbe: 'blau' }));
  const umformatiert = JSON.stringify(JSON.parse(d.text));
  pruefe('Umformatiert (ohne Einrückung) besteht die Prüfsumme', importiere(umformatiert, ergaenzeStand, jetzt).ok);
  const geaendert = d.text.replace('"stufe": 7', '"stufe": 40');
  const rg = importiere(geaendert, ergaenzeStand, jetzt);
  pruefe('Geändertes Feld fällt an der Prüfsumme durch', !rg.ok && /Prüfsumme/.test(rg.grund));
  pruefe('Keine JSON-Datei wird abgelehnt', !importiere('kein json', ergaenzeStand).ok);
  pruefe('Nackter v1-Stand als Datei wird angenommen und migriert', (() => { const x = importiere(JSON.stringify(v1), ergaenzeStand, jetzt); return x.ok && x.vonVersion === 1; })());
  const neuer = JSON.stringify({ format: 'brachland-spielstand', version: 5, geschrieben: 'x', spiel: {} });
  const rn = importiere(neuer, ergaenzeStand);
  pruefe('Datei aus neuerer Fassung: abgelehnt mit Grund', !rn.ok && /neueren Fassung/.test(rn.grund));
  pruefe('Prüfsumme: 8 Hex-Ziffern, stabil', /^[0-9a-f]{8}$/.test(pruefsumme('x')) && pruefsumme('x') === pruefsumme('x') && pruefsumme('x') !== pruefsumme('y'));
}

pruefe('Liste „kommt später“ ist nicht leer und nennt die Eingriffe nicht mehr (D416)', KOMMT_SPAETER.length > 0
  && !KOMMT_SPAETER.some(x => /eingriffe/.test(x)), `${KOMMT_SPAETER.length} Felder`);

// ---- D416: Version 2 → 3 (Reviere) ohne Verlust
{
  const v2 = JSON.parse(readFileSync('tests/staende/v2-oental-mit-wild.json', 'utf8'));
  pruefe('v2: als Version 2 erkannt', erkenneVersion(v2) === 2);
  const o2 = oeffne(v2, ergaenzeStand, jetzt);
  pruefe('v2 öffnet', o2.art === 'ok', o2.art === 'kaputt' ? o2.grund : '');
  if (o2.art === 'ok') {
    const s = o2.huelle.spiel as unknown as Record<string, unknown>;
    const alt = v2.spiel as Record<string, unknown>;
    const verloren = Object.keys(alt).filter(k => k !== 'version' && !gleich(s[k], alt[k]));
    pruefe('v2: jedes Feld unverändert (ausser version)', verloren.length === 0, verloren.join(', ') || `${Object.keys(alt).length - 1} Felder`);
    pruefe('v2: vonVersion = 2, jetzt Version 3', o2.vonVersion === 2 && o2.huelle.version === 3 && s.version === 3);
    pruefe('v2: Begegnungen leer, Reviere ohne Rast', gleich(s.begegnungen, []) && gleich(s.reviere, { rasten: 0, leerFolge: [], je: {} }));
    pruefe('v2: geschrieben bleibt (die Hülle wird nicht neu datiert)', o2.huelle.geschrieben === v2.geschrieben);
    pruefe('v2: besiegt/gefangen bleiben die Quelle der Reviere (nicht kopiert)', gleich(s.besiegt, alt.besiegt) && gleich(s.gefangen, alt.gefangen));
  }
  const a = neueAblage({ [schluessel(1, 'aktuell')]: v2 });
  const l = await ladePlatz(a, 1, ergaenzeStand, jetzt);
  pruefe('v2 auf Platz 1 lädt, der Platz selbst bleibt unverändert bis zum nächsten Schreiben', l.art === 'geladen' && l.vonVersion === 2
    && gleich(a.daten.get(schluessel(1, 'aktuell')), v2));
  const m = MIGRATIONEN[2](structuredClone(v2), jetzt) as { spiel: Record<string, unknown> };
  pruefe('Migration 2 → 3 behält vorhandene Begegnungen', gleich((MIGRATIONEN[2]({ ...v2, spiel: { ...v2.spiel, begegnungen: [{ art: 'umgangen', gegnerId: 'x', region: 'oental', x: 1, z: 2, zeit: 3 }] } }, jetzt) as { spiel: { begegnungen: unknown[] } }).spiel.begegnungen.length, 1)
    && Array.isArray(m.spiel.begegnungen));
  const v1nach3 = oeffne(v1, ergaenzeStand, jetzt);
  pruefe('v1 läuft über die ganze Kette bis 3', v1nach3.art === 'ok' && v1nach3.huelle.version === 3 && Array.isArray((v1nach3.huelle.spiel as Spielstand).begegnungen));
}

console.log(`\n${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
if (fehlgeschlagen > 0) process.exit(1);
