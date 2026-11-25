/**
 * BRACHLAND — Reinigen als Handlung im Spiel (D417).
 *
 * Die Regeln stehen in `src/kampf/echtzeit.ts` und sind in `reinigen.test.ts` geprüft. Hier wird die
 * **Anbindung** festgehalten, renderfrei:
 *
 *   1. Startbedingungen aus der Eingabe (`drueckeReinigen`): Erst wenn Schwelle, Reichweite, Ladung,
 *      Befall und Fenster stimmen, beginnt der Griff — sonst eine Antwort, die sagt warum.
 *   2. Ladungsverbrauch: eine Reinigung kostet eine Ladung; Rolle im Griff löst erst und rollt dann.
 *   3. Anzeige (`reinigenLage`): aus → nah → greifbar → Kanal.
 *   4. Kampfende unterscheidet getötet / gereinigt (`kampfbericht`), auch bei einer Niederlage.
 *   5. Folgen im Stand: `gereinigt`, `besiegt` (nur Tiere), Markenladung; Beute nach D379; jedes Ende geht als
 *      `Begegnung` an die Reviere (D416 `vermerkeBegegnung`), und dort zählt nichts doppelt.
 *   6. Aufträge `reinige` zählen echte Reinigungen, nicht mehr das Aufnehmen; der Zähler sieht gereinigt ¼.
 *   7. Migration v3 → v4: alte `gefangen` werden zu `gereinigt`, die Marke startet voll, nichts geht verloren
 *      (auch nicht `begegnungen`/`reviere` aus D416); der Schritt ist idempotent.
 */
import { readFileSync } from 'node:fs';
import {
  SPIELERIN, FUCHS, WOLF, WEGELAGERER, REINIGEN, SCHRITT,
  neuerKaempfer, blickAuf, simuliere, neueMarke, reinigungsGriffe,
  type Kaempfer, type Kampfwelt, type KampfWerte,
} from '../src/kampf/echtzeit.js';
import { drueckeReinigen, rolleImGriff, reinigenLage, warumNicht, GRIFF_MELDUNG } from '../src/kampf/markengriff.js';
import { kampfbericht, KREATUR_DER_ART } from '../src/kampf/kampfende.js';
import { folgenDerBegegnung, teileBeute, SCHMIEDE_WAEHRUNG } from '../src/spiel/begegnungen.js';
import { baueRevierwelt, revierZustaende, vermerkeBegegnung } from '../src/spiel/reviere.js';
import { Revierkarte } from '../src/data/schema.js';
import { fuelleMarke, hebeMarke, laeuterung, markenFassung, markenLadung, stufeDerMarke } from '../src/spiel/marke.js';
import { LEERER_STAND, ergaenzeStand, type Spielstand } from '../src/spiel/spielstand.js';
import { AKTUELLE_VERSION, MIGRATIONEN, oeffne, verpacke } from '../src/spiel/speicherformat.js';
import { werteZiel, type Taten } from '../src/spiel/auftraege.js';
import { eingriffe } from '../src/spiel/wanderfiguren.js';
import { SpielstandDaten } from '../src/data/schema.js';
import { BELEGUNG_DATEN, aktionenVon } from '../src/spieler/eingabe.js';

let bestanden = 0, fehlgeschlagen = 0;
function pruefe(name: string, ok: boolean, zusatz = '') {
  if (ok) { bestanden++; console.log(`  ✓ ${name.padEnd(70)} ${zusatz}`); }
  else { fehlgeschlagen++; console.log(`  ✗ ${name.padEnd(70)} ${zusatz}`); }
}
const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

console.log('Markengriff — Reinigen im Spiel (D417)\n');

/** Spielerin bei 0/0, Gegner 1,5 m vor ihr, ihr zugewandt; friedlich (denkt nicht, Uhren laufen). */
function platz(werte: KampfWerte[], abstand = 1.5): { w: Kampfwelt; s: Kaempfer; g: Kaempfer[] } {
  const s = neuerKaempfer('spielerin', SPIELERIN, 0, 0, 0);
  const g = werte.map((x, i) => {
    const k = neuerKaempfer(`g${i + 1}`, x, i * 3, -abstand, 0);
    k.blick = blickAuf(k.x, k.z, 0, 0);
    return k;
  });
  const w: Kampfwelt = { spielerin: s, gegner: g, ziel: null, friedlich: true, marke: neueMarke() };
  return { w, s, g };
}
const wund = (g: Kaempfer) => { g.leben = g.werte.lebenMax * REINIGEN.schwelle * 0.9; };
const betaeubt = (g: Kaempfer) => { g.phase = 'betaeubt'; g.zeit = 0; g.betaeubtFuer = 1; };
const laufe = (w: Kampfwelt, sek: number) => { for (let t = 0; t < sek - 1e-9; t += SCHRITT) simuliere(w, SCHRITT); };

// ---------------------------------------------------------------- 1. Eingabe
pruefe('F und Gamepad X sind „reinigen“ und verdrahtet (D415 → D417)',
  aktionenVon('KeyF').includes('reinigen') && aktionenVon('Pad:X').includes('reinigen')
  && BELEGUNG_DATEN.aktionen.find(a => a.id === 'reinigen')?.verdrahtet === true);
{
  const { w } = platz([FUCHS]); delete w.marke;
  pruefe('ohne Marke: nichts', drueckeReinigen(w) === 'keine-marke');
}
{
  const { w, g: [f] } = platz([FUCHS]);
  betaeubt(f);
  pruefe('über der Schwelle (betäubt, nah): „erst niederringen“', drueckeReinigen(w) === 'nicht-wund' && w.spielerin.phase === 'bereit');
  wund(f); f.x = 0; f.z = -4;
  pruefe('wund und betäubt, aber 4 m weit: „zu weit“', drueckeReinigen(w) === 'zu-weit');
  f.z = -1.5; w.marke!.ladung = 0;
  pruefe('wund, betäubt, nah, Marke leer: „leer“', drueckeReinigen(w) === 'leer');
  w.marke!.ladung = 4; f.phase = 'bereit';
  pruefe('wund, nah, steht aber nicht offen: „auf die Lücke warten“', drueckeReinigen(w) === 'kein-fenster');
  betaeubt(f); w.spielerin.phase = 'vorlauf';
  pruefe('Spielerin holt gerade aus: „erst ausschwingen“', drueckeReinigen(w) === 'beschaeftigt');
  w.spielerin.phase = 'bereit';
  pruefe('alles stimmt: der Griff beginnt', drueckeReinigen(w) === 'begonnen' && (w.spielerin.phase as string) === 'reinigen' && w.marke!.ziel === 'g1');
  pruefe('ein zweiter Druck im Griff tut nichts', drueckeReinigen(w) === 'beschaeftigt' && w.marke!.ziel === 'g1');
}
{
  const { w, g: [m] } = platz([WEGELAGERER]);
  wund(m); betaeubt(m); w.ziel = 'g1';
  pruefe('Mensch (D385): „die Marke greift nicht bei Menschen“', drueckeReinigen(w) === 'mensch');
  w.ziel = null;
  pruefe('nur Menschen auf dem Platz: „nichts zu reinigen“', drueckeReinigen(w) === 'nichts-befallen');
}
{
  const { w, g: [f] } = platz([FUCHS]);
  wund(f); betaeubt(f); f.zustand = 'verhaertet';
  pruefe('verhärtet ohne Reinkultur: abgelehnt', drueckeReinigen(w) === 'verhaertet');
  w.marke!.reinkultur = true; w.marke!.ladung = 4;
  pruefe('verhärtet mit Reinkultur: greift', drueckeReinigen(w) === 'begonnen');
}
{
  const { w, g: [m, f] } = platz([WEGELAGERER, FUCHS]);
  f.x = 1.2; f.z = -0.9; wund(f); betaeubt(f); w.ziel = 'g1'; // aufgeschaltet ist der Mensch
  pruefe('Ziel ist ein Mensch, greifbares Tier daneben: die Marke nimmt das Tier', drueckeReinigen(w) === 'begonnen' && w.marke!.ziel === 'g2');
  void m;
}
pruefe('jede Antwort ausser „keine Marke“ hat eine Meldung',
  Object.entries(GRIFF_MELDUNG).every(([k, v]) => k === 'keine-marke' || v.length > 0));

// ---------------------------------------------------------------- 2. Ladung und Rolle
{
  const { w, g: [f] } = platz([FUCHS]);
  wund(f);
  const vorher = w.marke!.ladung;
  let griffe = 0;
  for (let i = 0; i < 20 && f.ausgang !== 'gereinigt'; i++) {
    betaeubt(f); f.betaeubtFuer = 0.01; // nur die Marke hält
    if (drueckeReinigen(w) === 'begonnen') griffe++;
    laufe(w, 2);
  }
  pruefe('Fuchs: nach mehreren Griffen gereinigt', f.ausgang === 'gereinigt' && f.zustand === 'rueckgefuehrt' && f.phase === 'gefallen',
    `${griffe} Griffe, Soll ≥ ${reinigungsGriffe(REINIGEN, f)}`);
  pruefe('… mindestens so viele Griffe, wie das Tier braucht (D389)', griffe >= reinigungsGriffe(REINIGEN, f));
  pruefe('… genau eine Ladung verbraucht', w.marke!.ladung === vorher - REINIGEN.ladung, `${vorher} → ${w.marke!.ladung}`);
  pruefe('… und lebt noch (nicht getötet)', f.leben > 0);
}
{
  const { w, s, g: [f] } = platz([FUCHS]);
  wund(f); betaeubt(f);
  drueckeReinigen(w);
  laufe(w, 0.3);
  const fort = f.reinigung ?? 0;
  rolleImGriff(w, 1, 0);
  pruefe('Rolle im Griff: erst noch gebunden (Lösen dauert)', s.phase === 'reinigen');
  laufe(w, REINIGEN.loesen + 0.05);
  pruefe('… dann rollt sie aus dem Puffer', s.phase === 'rolle', s.phase);
  pruefe('… und der Fortschritt bleibt am Tier', (f.reinigung ?? 0) >= fort - 0.01 && fort > 0, `${fort.toFixed(2)} → ${(f.reinigung ?? 0).toFixed(2)}`);
  pruefe('… keine Ladung verbraucht', w.marke!.ladung === neueMarke().ladung);
}

// ---------------------------------------------------------------- 3. Anzeige
{
  const { w, g: [f] } = platz([FUCHS]);
  pruefe('Anzeige: gesund → aus', reinigenLage(w)?.stufe === 'aus');
  wund(f);
  pruefe('Anzeige: niedergerungen und nah, aber nicht offen → nah', reinigenLage(w)?.stufe === 'nah' && reinigenLage(w)?.kandidat === 'g1');
  f.z = -5;
  pruefe('Anzeige: niedergerungen, aber zu weit → aus', reinigenLage(w)?.stufe === 'aus');
  f.z = -1.5; betaeubt(f);
  pruefe('Anzeige: betäubt in Reichweite → greifbar', reinigenLage(w)?.stufe === 'greifbar');
  drueckeReinigen(w); laufe(w, 0.4);
  const l = reinigenLage(w);
  pruefe('Anzeige: im Griff → Kanal mit Fortschritt', l?.stufe === 'kanal' && (l.fortschritt ?? 0) > 0, `${(l?.fortschritt ?? 0).toFixed(2)}`);
  pruefe('Anzeige: Ladungen stehen dabei', l?.ladung === w.marke!.ladung);
  const { w: w2 } = platz([FUCHS]); delete w2.marke;
  pruefe('Anzeige: ohne Marke nichts', reinigenLage(w2) === null);
}

// ---------------------------------------------------------------- 4. Kampfende
{
  const { w, g: [m, a, b] } = platz([WEGELAGERER, WOLF, FUCHS]);
  m.phase = 'gefallen'; m.leben = 0;
  a.phase = 'gefallen'; a.leben = 0;
  b.phase = 'gefallen'; b.ausgang = 'gereinigt'; b.zustand = 'rueckgefuehrt'; w.marke!.ladung = 3;
  const r = kampfbericht(w, ['wegelagerer', 'wolf', 'fuchs']);
  pruefe('Kampfende: Sieg, wenn keiner mehr steht', r.sieg);
  pruefe('Kampfende: Mensch getötet, Wolf getötet, Fuchs gereinigt',
    gleich(r.gegner.map(g => g.ausgang), ['getoetet', 'getoetet', 'gereinigt']));
  pruefe('Kampfende: Kreatur der Welt hinter der Art (Aufträge zählen danach)',
    r.gegner[1].kreatur === KREATUR_DER_ART.wolf && r.gegner[1].kreatur === 'k7-wolf' && r.gegner[0].kreatur === 'wegelagerer' && r.gegner[0].mensch);
  pruefe('Kampfende: Markenladung am Ende', r.markenLadung === 3);
  w.spielerin.phase = 'gefallen'; a.phase = 'bereit'; a.leben = 10;
  const n = kampfbericht(w, ['wegelagerer', 'wolf', 'fuchs']);
  pruefe('Niederlage: kein Sieg, der Gereinigte bleibt gereinigt, der Wolf steht',
    !n.sieg && gleich(n.gegner.map(g => g.ausgang), ['getoetet', 'steht', 'gereinigt']));
}

// ---------------------------------------------------------------- 5. Folgen im Stand
const basis = (): Spielstand => ({ ...LEERER_STAND, gefangen: ['k7-wolf:3:4'], besiegt: ['sporenhahn:1:2'], gereinigt: [] });
{
  const { w, g: [m, a, b] } = platz([WEGELAGERER, WOLF, FUCHS]);
  m.phase = 'gefallen'; a.phase = 'gefallen'; b.phase = 'gefallen'; b.ausgang = 'gereinigt'; w.marke!.ladung = 3;
  // Ein zweiter Fuchs, gereinigt — damit „reinige k7-wolf“ unten etwas zu zählen hat, nehmen wir den Wolf.
  a.ausgang = 'gereinigt'; b.ausgang = undefined; w.marke!.ladung = 3;
  const bericht = kampfbericht(w, ['wegelagerer', 'wolf', 'fuchs']);
  const f = folgenDerBegegnung(basis(), bericht, { begegnung: 'lager-bruchweg', region: 'oental', zeit: 1000 });
  const gemeldet = f.ereignisse;
  pruefe('Folgen: Wolf in `gereinigt` mit Kreatur vorn', gleich(f.stand.gereinigt, ['k7-wolf:lager-bruchweg:2:1000']));
  pruefe('Folgen: getöteter Fuchs in `besiegt`, der Mensch nicht (D385)',
    gleich(f.stand.besiegt, ['sporenhahn:1:2', 'spuerfuchs:lager-bruchweg:3:1000']));
  pruefe('Folgen: Markenladung aus dem Kampf übernommen', f.stand.marke.ladung === 3);
  pruefe('Folgen: gefangen bleibt unberührt', gleich(f.stand.gefangen, ['k7-wolf:3:4']));
  pruefe('Begegnungen: je Gegner, der aus dem Kampf ging, eine (3)', gemeldet.length === 3);
  pruefe('Begegnungen: { art, gegnerId, region, x, z, zeit } wie D416 sie erwartet',
    gemeldet.every(e => typeof e.gegnerId === 'string' && e.region === 'oental' && Number.isFinite(e.x) && Number.isFinite(e.z) && e.zeit === 1000)
    && gleich(gemeldet.map(e => e.art), ['getoetet', 'gereinigt', 'getoetet']));
  pruefe('Begegnungen: gegnerId ist dieselbe ID wie in gereinigt/besiegt',
    f.stand.gereinigt.includes(gemeldet[1].gegnerId) && f.stand.besiegt.includes(gemeldet[2].gegnerId));
  const mitMeldung = gemeldet.reduce((st, e) => vermerkeBegegnung(st, e), f.stand);
  pruefe('vermerkeBegegnung (D416) nimmt alle drei auf; zweimal gemeldet zählt einmal',
    mitMeldung.begegnungen?.length === 3 && gemeldet.reduce((st, e) => vermerkeBegegnung(st, e), mitMeldung).begegnungen?.length === 3);
  // Reviere: eine gereinigte Vorkommen-ID, die zugleich gemeldet ist, zählt einmal (Dedup je ID, D416).
  const lies = (q: string) => JSON.parse(readFileSync(q, 'utf8'));
  const region = lies('content/regions/oental.json');
  const rwelt = baueRevierwelt([Revierkarte.parse(lies('content/reviere/oental.json'))], [{ id: 'oental', bbox: region.bbox }]);
  const summe = (st: Parameters<typeof revierZustaende>[1]) => [...revierZustaende(rwelt, st).values()].reduce((n, z) => n + z.gereinigt, 0);
  const ohne = summe({ ...mitMeldung, begegnungen: [] }), mit = summe(mitMeldung);
  pruefe('Reviere: echte Reinigung zählt höchstens einmal (gemeldet und in gereinigt)', mit - ohne <= 1, `ohne Meldung ${ohne}, mit ${mit}`);
  pruefe('Reviere: neues Aufnehmen (nur gefangen) zählt nicht als gereinigt, wenn gereinigt da ist',
    summe({ ...mitMeldung, gefangen: [...mitMeldung.gefangen, 'k7-wolf:30:30'] }) === mit);

  // Beute nach D379
  const istMaterial = (g: string) => SCHMIEDE_WAEHRUNG.has(g);
  const beute = { kraeutersud: 2, harzverband: 3, herzfunke: 1 };
  const teil = teileBeute(beute, bericht, istMaterial);
  pruefe('Schmiedewährung ist aus schmiede.ts abgeleitet (Harz, Herzfunke)', SCHMIEDE_WAEHRUNG.has('harzverband') && SCHMIEDE_WAEHRUNG.has('herzfunke') && !SCHMIEDE_WAEHRUNG.has('kraeutersud'));
  pruefe('Beute: Material nur vom Anteil der Getöteten (2 von 3, abgerundet)', teil.harzverband === 2 && teil.herzfunke === undefined, JSON.stringify(teil));
  pruefe('Beute: Sud und anderes bleibt ganz', teil.kraeutersud === 2);
  a.ausgang = undefined;
  pruefe('Beute: alle getötet → alles', gleich(teileBeute(beute, kampfbericht(w, ['wegelagerer', 'wolf', 'fuchs']), istMaterial), beute));

  // ---------------------------------------------------------------- 6. Aufträge und Zähler
  const taten = (s: Spielstand): Taten => ({ besiegt: s.besiegt, gefangen: s.gefangen, gereinigt: s.gereinigt,
    fragmente: s.fragmente, regenten: s.regenten, geheilt: s.geheilt });
  const ziel = { art: 'reinige' as const, kreatur: 'k7-wolf', anzahl: 2 };
  pruefe('Auftrag „reinige k7-wolf“: Aufnehmen zählt nicht mehr (D417)', werteZiel(ziel, taten(basis())).ist === 0);
  pruefe('Auftrag „reinige k7-wolf“: die echte Reinigung zählt', werteZiel(ziel, taten(f.stand)).ist === 1);
  pruefe('Auftrag „besiege spuerfuchs“: der im Lager getötete zählt',
    werteZiel({ art: 'besiege', kreatur: 'spuerfuchs', anzahl: 1 }, taten(f.stand)).erfuellt);
  const zaehler = JSON.parse(readFileSync('content/wanderfiguren/zaehler.json', 'utf8'));
  const gew = zaehler.stationen.map((s: { bis?: { gewichte?: unknown } }) => s.bis?.gewichte).find(Boolean);
  pruefe('Zähler (D404/D405): gereinigt wiegt ¼, getötet voll — Gewichte aus den Daten',
    Math.abs(eingriffe(f.stand, gew) - (2 * 1 + 1 * 0.25)) < 1e-9, `${eingriffe(f.stand, gew)}`);
}

// ---------------------------------------------------------------- 7. Marke im Stand und Migration
{
  const leer = { gereinigt: [] as string[], regenten: [] as string[] };
  pruefe('Fassung ohne Regent und Läuterung = reinigen.json start (4)', markenFassung(leer) === REINIGEN.fassung.start);
  pruefe('Fassung +2 je besiegtem Regent', markenFassung({ gereinigt: [], regenten: ['flussvater'] }) === REINIGEN.fassung.start + REINIGEN.fassung.jeRegent);
  const viele = Array.from({ length: 25 }, (_, i) => `k7-wolf:x:${i}:0`);
  pruefe('Läuterung 1 je Tier; ab 25 Markenstufe 1 und eine Ladung mehr (D393)',
    laeuterung({ gereinigt: viele }) === 25 && stufeDerMarke({ gereinigt: viele }) === 1 && markenFassung({ gereinigt: viele, regenten: [] }) === REINIGEN.fassung.start + 1);
  pruefe('Rast füllt auf die Fassung', fuelleMarke({ gereinigt: viele, regenten: [] }).ladung === REINIGEN.fassung.start + 1);
  pruefe('Ladung ist auf die Fassung begrenzt', markenLadung({ ...leer, marke: { ladung: 99 } }) === REINIGEN.fassung.start);
  pruefe('LEERER_STAND: Marke voll, gereinigt leer, Schema gilt',
    LEERER_STAND.marke.ladung === REINIGEN.fassung.start && LEERER_STAND.gereinigt.length === 0 && SpielstandDaten.safeParse(LEERER_STAND).success);

  pruefe('Migration 3 → 4 existiert, Version 4', typeof MIGRATIONEN[3] === 'function' && AKTUELLE_VERSION === 4);
  // Ein v3-Stand, wie D416 ihn schreibt: Hülle, mit begegnungen und reviere, ohne gereinigt/marke.
  const v1 = JSON.parse(readFileSync('tests/staende/v1-oental-unterwegs.json', 'utf8'));
  const v3 = { format: 'brachland-spielstand', version: 3, geschrieben: '2026-11-22T10:00:00.000Z', spiel: { ...v1, version: 3,
    gefangen: ['k7-wolf:3:4', 'firnhase:1:1', 'k7-wolf:3:4'],
    begegnungen: [{ art: 'umgangen', gegnerId: 'k7-wolf:9:9', region: 'oental', x: 10, z: -20, zeit: 1795000000000 }],
    reviere: { rasten: 2, leerFolge: ['oental-terrasse'], je: { 'oental-terrasse': { verhaertet: 1 } } } } };
  const o = oeffne(v3, ergaenzeStand, new Date('2026-11-22T12:00:00Z'));
  pruefe('v3 öffnet', o.art === 'ok', o.art === 'kaputt' ? o.grund : '');
  if (o.art === 'ok') {
    const s = o.huelle.spiel;
    pruefe('v3 → 4: gefangen wird gereinigt (ohne Doppel), gefangen bleibt', gleich(s.gereinigt, ['k7-wolf:3:4', 'firnhase:1:1'])
      && gleich(s.gefangen, v3.spiel.gefangen));
    pruefe('v3 → 4: Marke startet voll', s.marke.ladung === REINIGEN.fassung.start);
    const roh = s as unknown as Record<string, unknown>;
    const verloren = Object.keys(v3.spiel).filter(k => k !== 'version' && !gleich(roh[k], (v3.spiel as Record<string, unknown>)[k]));
    pruefe('v3 → 4: jedes alte Feld unverändert (auch begegnungen, reviere)', verloren.length === 0, verloren.join(', ') || `${Object.keys(v3.spiel).length - 1} Felder`);
    pruefe('v3 → 4: Auftragsfortschritt bleibt (reinige k7-wolf zählt den alten Fang)',
      werteZiel({ art: 'reinige', kreatur: 'k7-wolf', anzahl: 1 }, { besiegt: s.besiegt, gefangen: s.gefangen, gereinigt: s.gereinigt, fragmente: [], regenten: [], geheilt: [] }).erfuellt);
    pruefe('v3 → 4: Stand besteht das Schema, Version aktuell', SpielstandDaten.safeParse(s).success && s.version === AKTUELLE_VERSION);
  }
  const v2 = JSON.parse(readFileSync('tests/staende/v2-oental-mit-wild.json', 'utf8'));
  const v2o = oeffne(v2, ergaenzeStand);
  pruefe('v2 → 3 → 4: der D416-Beispielstand bekommt Reviere und Marke',
    v2o.art === 'ok' && gleich(v2o.huelle.spiel.gereinigt, [...new Set(v2.spiel.gefangen)]) && Array.isArray(v2o.huelle.spiel.begegnungen));
  const v1o = oeffne(v1, ergaenzeStand);
  pruefe('v1 → 2 → 3 → 4: auch der Stand vor D415 bekommt die Marke',
    v1o.art === 'ok' && gleich(v1o.huelle.spiel.gereinigt, v1.gefangen) && v1o.huelle.spiel.marke.ladung === REINIGEN.fassung.start);
  const einmal = hebeMarke({ gefangen: ['a:1'], regenten: [] });
  pruefe('hebeMarke ist idempotent', gleich(hebeMarke(einmal), einmal));
  const spaeter = hebeMarke({ ...einmal, gefangen: ['a:1', 'b:2'] });
  pruefe('ein Stand mit gereinigt behält ihn (späteres Aufnehmen zählt nicht)', gleich(spaeter.gereinigt, ['a:1']));
  pruefe('verbrauchte Ladung bleibt verbraucht', hebeMarke({ ...einmal, marke: { ladung: 1 } }).marke.ladung === 1);
  // Sicherheitsnetz: Ein v4-Stand, dem die Felder fehlen (von Hand geändert), bekommt sie in ergaenzeStand.
  const ohneFelder = { format: 'brachland-spielstand', version: 4, geschrieben: 'x', spiel: { ...v1, version: 4 } };
  const o4 = oeffne(ohneFelder, ergaenzeStand);
  pruefe('v4 ohne Marke → in ergaenzeStand ergänzt', o4.art === 'ok' && gleich(o4.huelle.spiel.gereinigt, v1.gefangen) && o4.huelle.spiel.marke.ladung === REINIGEN.fassung.start);
  const rund = oeffne(verpacke(ergaenzeStand(v1)), ergaenzeStand);
  pruefe('Schreiben → Lesen ergibt dieselbe Marke', rund.art === 'ok' && rund.huelle.spiel.marke.ladung === REINIGEN.fassung.start);
  void warumNicht;
}

console.log(`\nMarkengriff — ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
if (fehlgeschlagen) process.exit(1);
