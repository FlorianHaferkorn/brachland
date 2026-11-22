/**
 * Reviere (D416) — Lage, Zustand aus dem Spielstand, Regeln an der Rast, Zähler, Ökonomie.
 *
 * Festgehalten wird:
 * 1. **Die Karte trägt:** jede Zuflucht und jeder verborgene Ort liegt in dem Revier, das ihn nennt; `revierAn` und
 *    `revierAnGeo` sagen dasselbe; über mehrere Regionen sucht `revierAnGeo` erst die Region (ADR-0020).
 * 2. **Der Zustand kommt aus dem, was getan wurde:** `besiegt`/`gefangen` über die Zelle der Vorkommen-ID, gemeldete
 *    Begegnungen über die Lage — nichts doppelt, der Regent nie, Umgehen berührt nicht.
 * 3. **Die Schwellen sind Daten** (`oekonomie.json`): ruhig, leer, Boden gegen „ein Griff befriedet“.
 * 4. **Die Rast wertet aus und gibt Änderungen zurück:** jedes zweite leergetötete Revier zieht einen Verhärteten nach,
 *    Nachwachsen erst nach `abRasten`, höchstens die Hälfte, nie in ein ruhiges Revier, nie nach der Heilung.
 * 5. **Die Ökonomie mit echten Revieren:** keine Spielweise schlägt eine andere auf allen Achsen.
 */
import { readFileSync } from 'node:fs';
import { Oekonomie, ReinigenDaten, Revierkarte, Wanderfigur } from '../src/data/schema.js';
import {
  baueRevierwelt, bestand, bezugTiere, istLeergetoetet, istRuhig, istUnberuehrt, ladungNachRast, LEERER_REVIERSTAND,
  regelnAus, revierZustaende, unberuehrtAnteil, unberuehrtAnteilVon, vermerkeBegegnung, werteRastAus, zaehlerStufe,
  type Begegnung, type Revierregeln, type StandMitRevieren,
} from '../src/spiel/reviere.js';
import { bilanzMitRevieren, SPIELWEISEN, zaehlerStand, type SimRevier } from '../src/spiel/oekonomie.js';
import { stationVon } from '../src/spiel/wanderfiguren.js';
import { ergaenzeStand } from '../src/spiel/spielstand.js';
import { oeffne } from '../src/spiel/speicherformat.js';

let bestanden = 0, fehlgeschlagen = 0;
function pruefe(name: string, bedingung: boolean, zusatz = '') {
  if (bedingung) { bestanden++; console.log(`  ✓ ${name.padEnd(70)} ${zusatz}`); }
  else { fehlgeschlagen++; console.log(`  ✗ ${name.padEnd(70)} ${zusatz}`); }
}
const lies = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

const region = lies('content/regions/oental.json');
const karte = Revierkarte.parse(lies('content/reviere/oental.json'));
const welt = baueRevierwelt([karte], [{ id: 'oental', bbox: region.bbox }]);
const o = Oekonomie.parse(lies('content/oekonomie.json'));
const regeln = regelnAus(o);
const [sued, west, nord, ost] = region.bbox;
const meter = (ort: [number, number]): [number, number] => {
  const b = (ost - west) * 111_320 * Math.cos((sued + nord) / 2 * Math.PI / 180), t = (nord - sued) * 111_320;
  return [((ort[1] - west) / (ost - west) - 0.5) * b, ((nord - ort[0]) / (nord - sued) - 0.5) * t];
};
const ortVon = (id: string) => lies(`content/orte/${id}.json`).ort as [number, number];
/** Eine Vorkommen-ID, deren Zelle an dieser Lage liegt (wie `kreatur:i:j` aus `verteileKreaturen`). */
const n = karte.raster.vorkommenRaster;
const breite = (ost - west) * 111_320 * Math.cos((sued + nord) / 2 * Math.PI / 180), tiefe = (nord - sued) * 111_320;
const idBei = (kreatur: string, x: number, z: number, versatz = 0) =>
  `${kreatur}:${Math.round((z / tiefe + 0.5) * (n - 1))}:${Math.round((x / breite + 0.5) * (n - 1)) + versatz}`;

console.log('Reviere (D416)\n');

// ---- 1. Karte
pruefe('Œntal: 12–13 Reviere (D393 rechnete mit 12)', karte.reviere.length >= 12 && karte.reviere.length <= 13, `${karte.reviere.length}`);
const zuflucht = (id: string) => welt.revierAn('oental', ...meter(ortVon(id)))?.id;
pruefe('Saal auf der Terrasse liegt im Revier Terrasse', zuflucht('terrasse-saal') === 'oental-terrasse');
pruefe('Kapelle über dem Kalkbruch liegt im Stau (Insel im Flutrevier)', zuflucht('kapelle-kalkbruch') === 'oental-stau');
pruefe('Almhütte liegt auf der Alm, Remise am Steig', zuflucht('almhuette') === 'oental-alm' && zuflucht('remise-am-steig') === 'oental-steig');
const kirchturm = region.verborgeneOrte.find((v: any) => v.id === 'kirchturm').ort;
pruefe('Kirchturm im Wasser liegt im Seeboden', welt.revierAn('oental', ...meter(kirchturm))?.id === 'oental-seeboden');
pruefe('revierAnGeo sagt dasselbe wie revierAn', welt.revierAnGeo(kirchturm[0], kirchturm[1])?.id === 'oental-seeboden');
pruefe('Ausserhalb jeder Region: kein Revier (revierAnGeo)', welt.revierAnGeo(48.5, 11.0) === null);
pruefe('Unbekannte Region oder NaN: kein Revier', welt.revierAn('nirgends', 0, 0) === null && welt.revierAn('oental', NaN, 0) === null);
pruefe('Über den Rand geklemmt: Randrevier', welt.revierAn('oental', -99999, -99999)?.id === welt.revierAn('oental', -1980, -1990)?.id);
pruefe('Flutreviere liegen ganz oder fast ganz unter der Flutlinie, Landreviere darüber',
  karte.reviere.every(r => (r.id === 'oental-seeboden' || r.id === 'oental-stau') ? r.unterFlut >= 0.85 : r.unterFlut === 0));
pruefe('Jedes Revier hat Tiere, zusammen der ganze Bestand (1.019, Seed 7)',
  karte.reviere.every(r => bestand(r) > 0) && karte.reviere.reduce((s, r) => s + bestand(r), 0) === 1019);
pruefe('Nachbarn symmetrisch', karte.reviere.every(r => r.nachbarn.every(id => welt.revier(id)?.nachbarn.includes(r.id))));
// ADR-0020: zweite Region daneben — revierAnGeo sucht zuerst die Region.
{
  const bbox2: [number, number, number, number] = [nord, west, nord + 0.036, ost];
  const zweite = Revierkarte.parse({ region: 'probe', erzeugt: 'Test', raster: { spalten: 4, zeilen: 4, vorkommenRaster: 384,
    karte: ['AAAA', 'AAAA', 'AAAA', 'AAAA'] }, reviere: [{ id: 'probe-alles', zeichen: 'A', name: 'Alles', kern: [0, 0],
    begruendung: 'Test', zufluchten: [], verborgeneOrte: [], flaecheKm2: 16, unterFlut: 0, hoehe: [0, 0], tiere: {}, nachbarn: ['oental-alm'] }] });
  const zwei = baueRevierwelt([karte, zweite], [{ id: 'oental', bbox: region.bbox }, { id: 'probe', bbox: bbox2 }]);
  pruefe('ADR-0020: Lage nördlich des Œntals findet das Revier der Nachbarregion', zwei.revierAnGeo(nord + 0.01, (west + ost) / 2)?.id === 'probe-alles');
  pruefe('ADR-0020: dieselbe Welt findet im Œntal weiter das Œntal-Revier', zwei.revierAnGeo(kirchturm[0], kirchturm[1])?.id === 'oental-seeboden');
  pruefe('ADR-0020: Region eines Reviers, Reviere je Region', zwei.regionVon('probe-alles') === 'probe' && zwei.reviereVon('probe').length === 1);
}
pruefe('vorkommenLage: kreatur:i:j ja, fest/heil/Regent nein',
  !!welt.vorkommenLage('oental', 'k7-wolf:50:337') && welt.vorkommenLage('oental', 'trafomarder:fest') === null
  && welt.vorkommenLage('oental', 'wels:heil:2') === null && welt.vorkommenLage('oental', 'regent:flussvater') === null);

// ---- 2. Schnittstelle D417 und Zustand
const terrasse = meter(ortVon('terrasse-saal'));
const almOrt = meter(ortVon('almhuette'));
const leer: StandMitRevieren & { begegnungen: Begegnung[] } = { region: 'oental', besiegt: [], gefangen: [], begegnungen: [] };
const e1: Begegnung = { art: 'getoetet', gegnerId: 'lager-x:0', region: 'oental', x: terrasse[0] + 0.04, z: terrasse[1], zeit: 1000 };
const s1 = vermerkeBegegnung(leer, e1);
pruefe('vermerkeBegegnung hängt an und lässt den alten Stand unverändert', s1.begegnungen!.length === 1 && leer.begegnungen.length === 0);
pruefe('… rundet die Lage auf 10 cm', s1.begegnungen![0].x === Math.round((terrasse[0] + 0.04) * 10) / 10);
pruefe('… dieselbe Meldung zweimal zählt einmal (StrictMode)', vermerkeBegegnung(s1, e1) === s1);
pruefe('… ungültige Meldung ändert nichts', vermerkeBegegnung(leer, { ...e1, x: NaN }) === leer
  && vermerkeBegegnung(leer, { ...e1, gegnerId: '' }) === leer && vermerkeBegegnung(leer, { ...e1, art: 'gefangen' as never }) === leer);
pruefe('… gleiche ID, andere Zeit: neue Begegnung (Lager wieder besetzt)', vermerkeBegegnung(s1, { ...e1, zeit: 2000 }).begegnungen!.length === 2);

const idTerrasse = idBei('wurzelkeiler', terrasse[0], terrasse[1]);
const idAlm = idBei('alpenmurmel', almOrt[0], almOrt[1]);
const alt: StandMitRevieren = { region: 'oental', besiegt: [idTerrasse, 'regent:flussvater', 'lager-bruchweg'], gefangen: [idAlm] };
const z0 = revierZustaende(welt, alt);
pruefe('Bestand: besiegt zählt als getötet im Revier der Zelle', z0.get('oental-terrasse')!.getoetet === 1);
pruefe('Bestand: gefangen zählt als gereinigt (D375, bis D417 schreibt)', z0.get('oental-alm')!.gereinigt === 1);
pruefe('Regent und Lager-IDs zählen keinem Revier', [...z0.values()].reduce((s, z) => s + z.eingriffe, 0) === 2);
pruefe('Alle Reviere der Region haben einen Zustand', z0.size === karte.reviere.length);
const mitLog = { ...alt, begegnungen: [
  { art: 'getoetet' as const, gegnerId: idTerrasse, region: 'oental', x: terrasse[0], z: terrasse[1], zeit: 5 },
  { art: 'umgangen' as const, gegnerId: 'fuchs-a', region: 'oental', x: terrasse[0], z: terrasse[1], zeit: 6 },
  { art: 'umgangen' as const, gegnerId: 'fuchs-b', region: 'oental', x: terrasse[0], z: terrasse[1], zeit: 7 },
  { art: 'gereinigt' as const, gegnerId: 'fuchs-b', region: 'oental', x: terrasse[0], z: terrasse[1], zeit: 8 }] };
const z1 = revierZustaende(welt, mitLog).get('oental-terrasse')!;
pruefe('Gemeldete ID zählt nicht zusätzlich aus besiegt', z1.getoetet === 1, `${z1.getoetet}`);
pruefe('Umgangen und danach gereinigt: zählt als gereinigt, nicht als umgangen', z1.gereinigt === 1 && z1.umgangen === 1 && z1.begegnet === 3);
pruefe('Umgehen berührt nicht', istUnberuehrt({ ...z1, getoetet: 0, gereinigt: 0, eingriffe: 0 }));

// ---- 3. Schwellen
const r = welt.revier('oental-graben')!;
const zst = (getoetet: number, gereinigt: number, umgangen = 0) =>
  ({ revier: r, getoetet, gereinigt, umgangen, begegnet: getoetet + gereinigt + umgangen, eingriffe: getoetet + gereinigt, zugewandert: 0, verhaertet: 0 });
const boden = Math.ceil(bestand(r) * regeln.mindestBestand);
pruefe('Schwellen aus den Daten (ruhig 60 %/25 %, leer 60 %, Rast ½)', regeln.ruhigAb === o.marke.ruhigAb && regeln.ruhigMindestens === o.marke.ruhigMindestens
  && regeln.leerAb === o.toeten.leerAb && regeln.ruhigeRast === o.marke.ruhigeRast && regeln.bezug === o.reviere!.bezug);
pruefe('Ein einziger Griff befriedet nichts (Boden gegen D393 „geschenkt“)', !istRuhig(zst(0, 1), regeln), `Boden ${boden} von ${bestand(r)}`);
pruefe('Ein einziger Tod leert nichts', !istLeergetoetet(zst(1, 0), regeln));
const ruhigAb = Math.ceil(regeln.ruhigMindestens * bezugTiere(zst(0, 0), regeln) - 1e-9);
pruefe('Genug gereinigt und kaum getötet: ruhig', istRuhig(zst(0, ruhigAb), regeln) && istRuhig(zst(Math.floor(ruhigAb * 0.6), ruhigAb), regeln), `${ruhigAb} Reinigungen`);
pruefe('Überwiegend getötet: nicht ruhig', !istRuhig(zst(ruhigAb, ruhigAb), regeln));
const leerAb = Math.ceil(regeln.leerAb * bestand(r) * regeln.mindestBestand - 1e-9);
pruefe('Leergetötet ab 60 % der Tiere des Reviers', istLeergetoetet(zst(leerAb, 0), regeln) && !istLeergetoetet(zst(leerAb - 1, 0), regeln), `${leerAb} Getötete`);
pruefe('Ein leergetötetes Revier, in das die Hälfte nachwächst, ist wieder befallen (Quelle für Nachbarn)',
  !istLeergetoetet({ ...zst(leerAb, 0), zugewandert: Math.floor(leerAb / 2) }, regeln));
pruefe('Begegnete über dem Boden zählen als Tiere des Reviers', bezugTiere(zst(10, 10, 20), regeln) === Math.max(40, bestand(r) * regeln.mindestBestand));
const nachBestand: Revierregeln = { ...regeln, bezug: 'bestand' };
pruefe('Bezug „bestand“: der ganze Bestand ist der Nenner', bezugTiere(zst(5, 5), nachBestand) === bestand(r));

// ---- Marke an der Rast
pruefe('Zuflucht füllt die Marke', ladungNachRast({ ladung: 0, fassung: 5, zuflucht: true, ruhig: false }, regeln) === 5);
pruefe('Ruhiges Revier ohne Zuflucht: halbe Fassung dazu', ladungNachRast({ ladung: 1, fassung: 5, zuflucht: false, ruhig: true }, regeln) === 3);
pruefe('… nie über die Fassung', ladungNachRast({ ladung: 4, fassung: 5, zuflucht: false, ruhig: true }, regeln) === 5);
pruefe('Befallenes oder leeres Revier ohne Zuflucht: nichts', ladungNachRast({ ladung: 1, fassung: 5, zuflucht: false, ruhig: false }, regeln) === 1);

// ---- Zähler
const zaehler = Wanderfigur.parse(lies('content/wanderfiguren/zaehler.json'));
const regel = zaehler.stationen.map(s => s.bis).find(b => b?.art === 'misstraut') as { art: 'misstraut'; anzahl: number; unberuehrtMindestens: number; gewichte?: { getoetet: number; gereinigt: number } };
pruefe('Zähler: „vertraut“ steht als Daten an der Krone (D406: 40, Hälfte unberührt)', !!regel && regel.anzahl === 40 && regel.unberuehrtMindestens === 0.5);
pruefe('zaehlerStufe: vertraut / geduldet / abgewandt', zaehlerStufe(40, 0.5, regel) === 'vertraut' && zaehlerStufe(40, 0.4, regel) === 'geduldet'
  && zaehlerStufe(40.5, 1, regel) === 'abgewandt');
pruefe('Anteil unberührt: frischer Stand 1, nach zwei berührten Revieren (13 − 2) / 13',
  unberuehrtAnteil(revierZustaende(welt, leer), welt, 'oental') === 1
  && Math.abs(unberuehrtAnteilVon(welt, alt) - (karte.reviere.length - 2) / karte.reviere.length) < 1e-9);
{
  const geheilt = { fragmente: ['stauwehr', 'absetzbecken'], regenten: ['flussvater'], geheilt: ['flussvater'], auftraege: {} };
  const wenige = { ...alt, besiegt: [idTerrasse] };
  pruefe('Zähler steht nach der Heilung auf der Krone, wenn er vertraut', stationVon(zaehler, { ...geheilt, ...wenige, unberuehrtAnteil: unberuehrtAnteilVon(welt, wenige) }) === 3);
  // Je ein Gereinigter in sieben Revieren: Stand 1,75 — geduldet, aber nicht mehr vertraut.
  const sieben = karte.reviere.slice(0, 7).map((rv, i) => idBei('spuerfuchs', rv.kern[0], rv.kern[1], i % 2));
  const breit = { ...alt, besiegt: [], gefangen: sieben };
  const st = { ...geheilt, ...breit, gereinigt: breit.gefangen, unberuehrtAnteil: unberuehrtAnteilVon(welt, breit) };
  pruefe('Wenig, aber in mehr als der Hälfte der Reviere eingegriffen: er wendet sich ab (Kirche)', stationVon(zaehler, st) === 4,
    `unberührt ${(st.unberuehrtAnteil * 100).toFixed(0)} %`);
}

// ---- 4. Rast
{
  const nach = (getoetet: number, revierId: string, zelle = 0) => {
    const rv = welt.revier(revierId)!;
    return Array.from({ length: getoetet }, (_, i) => ({ art: 'getoetet' as const, gegnerId: `t-${revierId}-${zelle}-${i}`, region: 'oental', x: rv.kern[0], z: rv.kern[1], zeit: i }));
  };
  const leerMenge = (id: string) => Math.ceil(regeln.leerAb * bezugTiere({ ...zst(0, 0), revier: welt.revier(id)! }, regeln));
  const s = (b: Begegnung[], reviere = LEERER_REVIERSTAND): StandMitRevieren => ({ region: 'oental', besiegt: [], gefangen: [], begegnungen: b, reviere });
  const a1 = werteRastAus(welt, s(nach(leerMenge('oental-steig'), 'oental-steig')), regeln, { geheilt: false });
  pruefe('Rast zählt mit', a1.reviere.rasten === 1);
  pruefe('Erstes leergetötetes Revier: vermerkt, noch kein Verhärteter', a1.reviere.leerFolge.join() === 'oental-steig'
    && !a1.aenderungen.some(x => x.art === 'verhaertung'));
  const beide = [...nach(leerMenge('oental-steig'), 'oental-steig'), ...nach(leerMenge('oental-graben'), 'oental-graben')];
  const a2 = werteRastAus(welt, s(beide, a1.reviere), regeln, { geheilt: false });
  pruefe('Zweites leergetötetes Revier zieht einen Verhärteten nach (D402)', a2.aenderungen.some(x => x.art === 'verhaertung' && x.revier === 'oental-graben')
    && a2.reviere.je['oental-graben'].verhaertet === 1 && a2.reviere.leerFolge.length === 2);
  pruefe('Kein Revier wird zweimal leer gezählt', werteRastAus(welt, s(beide, a2.reviere), regeln, { geheilt: false }).aenderungen.every(x => x.art !== 'leergetoetet'));
  pruefe('Nach der Heilung: leer vermerkt, aber keine Verhärtung', !werteRastAus(welt, s(beide, a1.reviere), regeln, { geheilt: true }).aenderungen.some(x => x.art === 'verhaertung'));
  pruefe('Die Rast ändert den alten Revierstand nicht', a1.reviere.leerFolge.length === 1 && LEERER_REVIERSTAND.leerFolge.length === 0 && LEERER_REVIERSTAND.rasten === 0);

  // Nachwachsen
  const toete = nach(6, 'oental-graben');
  let rs = LEERER_REVIERSTAND, zuerst = -1, summe = 0;
  for (let i = 1; i <= 12; i++) {
    const a = werteRastAus(welt, s(toete, rs), regeln, { geheilt: false });
    const nw = a.aenderungen.find(x => x.art === 'nachwachsen');
    if (nw && zuerst < 0) zuerst = i;
    if (nw && nw.art === 'nachwachsen') { summe += nw.anzahl; pruefe(`Rast ${i}: höchstens ${regeln.nachwachsen.jeRast} je Rast, aus Nachbarn`, nw.anzahl <= regeln.nachwachsen.jeRast && nw.aus.length > 0 && !nw.aus.includes('oental-graben')); }
    rs = a.reviere;
  }
  pruefe(`Nachwachsen beginnt erst nach ${regeln.nachwachsen.abRasten} Rasten`, zuerst === regeln.nachwachsen.abRasten, `Rast ${zuerst}`);
  pruefe('Nachwachsen höchstens bis zur Hälfte der Getöteten', summe === Math.floor(6 * regeln.nachwachsen.anteil) && rs.je['oental-graben'].zugewandert === summe, `${summe}`);
  let rh = LEERER_REVIERSTAND, geheiltSumme = 0;
  for (let i = 0; i < 8; i++) { const a = werteRastAus(welt, s(toete, rh), regeln, { geheilt: true }); geheiltSumme += a.aenderungen.filter(x => x.art === 'nachwachsen').length; rh = a.reviere; }
  pruefe('Geheilte Region: nichts wächst nach', geheiltSumme === 0);
  // Ruhiges Revier nimmt nichts auf.
  const ruhigeMenge = Math.ceil(regeln.ruhigMindestens * bezugTiere({ ...zst(0, 0), revier: welt.revier('oental-graben')! }, regeln));
  const ruhigUndEiner = [...nach(1, 'oental-graben'), ...Array.from({ length: ruhigeMenge }, (_, i) => ({ art: 'gereinigt' as const, gegnerId: `g-${i}`, region: 'oental', x: r.kern[0], z: r.kern[1], zeit: 100 + i }))];
  let rr = LEERER_REVIERSTAND, ruhigNach = 0;
  for (let i = 0; i < 8; i++) { const a = werteRastAus(welt, s(ruhigUndEiner, rr), regeln, { geheilt: false }); ruhigNach += a.aenderungen.filter(x => x.art === 'nachwachsen').length; rr = a.reviere; }
  pruefe('Ruhiges Revier nimmt keinen Befall auf (die Gunst bleibt)', ruhigNach === 0 && istRuhig(revierZustaende(welt, s(ruhigUndEiner)).get('oental-graben')!, regeln));
  // Ohne befallenen Nachbarn: nichts wandert nach.
  const flut = welt.revier('oental-stau')!; // Nachbarn: Seeboden, Uferweg
  // Die Nachbarn ganz leer (der ganze Bestand getötet), damit sie es auch bleiben, wenn in sie selbst etwas nachwächst.
  const alleLeer = [...nach(leerMenge('oental-stau'), 'oental-stau'), ...flut.nachbarn.flatMap(id => nach(bestand(welt.revier(id)!), id))];
  let rl = LEERER_REVIERSTAND, ohneQuelle = 0;
  for (let i = 0; i < 8; i++) { const a = werteRastAus(welt, s(alleLeer, rl), regeln, { geheilt: false }); ohneQuelle += a.aenderungen.filter(x => x.art === 'nachwachsen' && x.revier === 'oental-stau').length; rl = a.reviere; }
  pruefe('Sind alle Nachbarn leer, wächst nichts nach', ohneQuelle === 0);
}

// ---- Spielstand v3 trägt die Felder; ein v2-Stand gibt seine Reviere über besiegt/gefangen her
{
  const v2 = lies('tests/staende/v2-oental-mit-wild.json');
  const of = oeffne(v2, ergaenzeStand);
  pruefe('v2 → v3: Revierzustand aus besiegt/gefangen ohne Kopie', of.art === 'ok' && (() => {
    const z = revierZustaende(welt, of.huelle.spiel);
    return [...z.values()].reduce((s, x) => s + x.getoetet, 0) === 2 && [...z.values()].reduce((s, x) => s + x.gereinigt, 0) === 1;
  })());
}

// ---- 5. Ökonomie mit echten Revieren
{
  const rein = ReinigenDaten.parse(lies('content/reinigen.json'));
  const marke = { start: rein.fassung.start, jeRegent: rein.fassung.jeRegent, ladung: rein.ladung, ladungVerhaertet: rein.verhaertet.ladung };
  const sim: SimRevier[] = [...karte.reviere].sort((x, y) => Math.hypot(...x.kern) - Math.hypot(...y.kern))
    .map(rv => ({ id: rv.id, bestand: bestand(rv), verhaertete: rv.verborgeneOrte.length + (rv.id === 'oental-uferweg' ? 2 : 0) }));
  pruefe('Rechnung: so viele Verhärtete wie angenommen', sim.reduce((s, x) => s + x.verhaertete, 0) === o.regionen.oental.annahmen.verhaertete);
  const gew = regel.gewichte!;
  for (const bezug of ['begegnet', 'bestand'] as const) {
    const b = SPIELWEISEN.map(w => bilanzMitRevieren(w, 'oental', o, marke, sim, { ...regeln, bezug }));
    const [S, G, H, U] = b;
    const stufe = (x: typeof S) => ({ abgewandt: 0, geduldet: 1, vertraut: 2 })[zaehlerStufe(zaehlerStand(x, gew), x.unberuehrt / x.reviere, regel)];
    const achsen = (x: typeof S) => [x.waffen[0], x.markenStufe, x.lebenPlus, x.ausdauerPlus, x.einsicht, stufe(x)];
    const dom = b.flatMap(x => b.filter(y => y !== x && achsen(x).every((v, i) => v >= achsen(y)[i]) && achsen(x).some((v, i) => v > achsen(y)[i])).map(y => `${x.name}>${y.name}`));
    pruefe(`Bezug ${bezug}: keine Spielweise schlägt eine andere auf allen sechs Achsen`, dom.length === 0, dom.join(' ') || b.map(x => achsen(x).join('/')).join('  '));
    pruefe(`Bezug ${bezug}: Bilanz geht auf (280 Begegnungen)`, b.every(x => Math.abs(x.getoetet + x.gereinigt + x.umgangen - o.regionen.oental.annahmen.tiere) <= 2));
    pruefe(`Bezug ${bezug}: nur der Umgeher bleibt vertraut`, stufe(U) === 2 && [S, G, H].every(x => stufe(x) < 2));
    if (bezug === regeln.bezug) {
      pruefe('Daten: der Heiler hat ruhige Reviere, Schlächter und Gemischt keine', H.ruhigeReviere > 0 && S.ruhigeReviere === 0 && G.ruhigeReviere === 0, `${H.ruhigeReviere}`);
      pruefe('Daten: wer tötet, leert Reviere und zieht Verhärtete nach, der Heiler nicht', S.leereReviere > 0 && S.nachgewandert > 0 && H.leereReviere === 0);
      pruefe('Daten: Nachwachsen trifft nur, wer tötet', S.nachgewachsen > 0 && H.nachgewachsen === 0);
      pruefe('Daten: der Heiler reinigt alle Verhärteten', H.verhaerteteGereinigt === o.regionen.oental.annahmen.verhaertete);
    }
  }
}

// Diese Prüfung braucht nur Typen aus dem Schema: Regeln ohne `reviere`-Block werfen.
pruefe('Ohne Block `reviere` in oekonomie.json: klare Meldung', (() => { try { regelnAus({ ...o, reviere: undefined }); return false; } catch (e) { return /reviere/.test(String(e)); } })());

console.log(`\n${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
if (fehlgeschlagen) process.exit(1);
