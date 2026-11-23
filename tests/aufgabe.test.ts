/**
 * BRACHLAND — Aufgabe menschlicher Gegner beim Haltungsbruch (D426, D385).
 *
 * Renderfrei festgehalten:
 *   1. Wer aufgibt: Menschen ohne `gibtAuf: false`; nie ein Tier (das Feld steht im Block `mensch`).
 *   2. Der erste Haltungsbruch der Spielerin → `aufgegeben`: keine Deckung, kein Angriff mehr, er weicht zurück.
 *   3. Nach der Frist geht er: `ausgang` `verschont`, der Kampfbericht sagt `verschont`, der Kampf ist gewonnen.
 *   4. Trotzdem töten geht bis zur Frist: Bericht `getoetet`, mit `aufgegeben`.
 *   5. Ausnahmen und Schalter: Tiere, `gibtAuf: false`, `Kampfwelt.aufgabe: false` (wie vor D426).
 *   6. Im Rudel zählt der Aufgegebene nicht mehr mit (Angriffsrecht, Atempause), die anderen kämpfen weiter.
 *   7. Folgen: getöteter Mensch → Begegnung `getoetet` mit `mensch`, zählt beim Zähler der Mönche voll, in keinem
 *      Revier; verschont → `verschont`, kein Eingriff, keine Beute; der Spielstand nimmt beides an.
 */
import { readFileSync } from 'node:fs';
import {
  SPIELERIN, WEGELAGERER, SPEERMANN, AXTMANN, WOLF, FUCHS, KEILER, GRATHORN, GAMS, UEBUNGSGEGNER, SCHRITT, AUFGABE, WAFFEN,
  neuerKaempfer, blickAuf, simuliere, gibtAuf, imKampf, ruesteAus, puffere, angriffsrecht,
  type Kaempfer, type Kampfwelt, type KampfWerte, type Treffer,
} from '../src/kampf/echtzeit.js';
import { kampfbericht } from '../src/kampf/kampfende.js';
import { folgenDerBegegnung, teileBeute, SCHMIEDE_WAEHRUNG } from '../src/spiel/begegnungen.js';
import { baueRevierwelt, revierZustaende, vermerkeBegegnung, type Begegnung } from '../src/spiel/reviere.js';
import { eingriffe } from '../src/spiel/wanderfiguren.js';
import { LEERER_STAND } from '../src/spiel/spielstand.js';
import { AufgabeDaten, GegnerDaten, Revierkarte, SpielstandDaten } from '../src/data/schema.js';

let bestanden = 0, fehlgeschlagen = 0;
function pruefe(name: string, ok: boolean, zusatz = '') {
  if (ok) { bestanden++; console.log(`  ✓ ${name.padEnd(72)} ${zusatz}`); }
  else { fehlgeschlagen++; console.log(`  ✗ ${name.padEnd(72)} ${zusatz}`); }
}
const lies = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

console.log('Aufgabe menschlicher Gegner (D426)\n');

/** Spielerin bei 0/0 mit der Axt, Gegner `abstand` m vor ihr und ihr zugewandt. */
function platz(werte: KampfWerte[], abstand = 1.6): { w: Kampfwelt; s: Kaempfer; g: Kaempfer[] } {
  const s = neuerKaempfer('spielerin', SPIELERIN, 0, 0, 0);
  ruesteAus(s, 'axt');
  const g = werte.map((x, i) => {
    const k = neuerKaempfer(`g${i + 1}`, x, i * 2.5, -abstand - i * 4, 0);
    k.blick = blickAuf(k.x, k.z, 0, 0);
    return k;
  });
  return { w: { spielerin: s, gegner: g, ziel: g[0].id }, s, g };
}
const laufe = (w: Kampfwelt, sek: number, jeSchritt?: (t: number) => void): Treffer[] => {
  const raus: Treffer[] = [];
  for (let t = 0; t < sek - 1e-9; t += SCHRITT) { jeSchritt?.(t); raus.push(...simuliere(w, SCHRITT)); }
  return raus;
};
/** Die Spielerin schlägt einmal (Axt, leicht) auf einen Gegner mit fast leerer Haltung — der Treffer bricht sie. */
function brich(w: Kampfwelt, g: Kaempfer): Treffer[] {
  g.haltung = 1;
  // nicht in die gedeckte Linie eines Menschen (D174) — die fängt den Hieb
  if (g.deckung) w.spielerin.linie = g.deckung === 'rechts' ? 'links' : 'rechts';
  puffere(w.spielerin, 'leicht');
  const tr: Treffer[] = [];
  for (let t = 0; t < 1.2 && !tr.some(e => e.auf === g.id && e.schaden > 0); t += SCHRITT) tr.push(...simuliere(w, SCHRITT));
  return tr;
}

// ---------------------------------------------------------------- 1. Wer aufgibt
pruefe('Wegelagerer, Speermann, Axtmann geben auf (Standard für Menschen)', [WEGELAGERER, SPEERMANN, AXTMANN].every(gibtAuf));
pruefe('kein Tier gibt auf', [WOLF, FUCHS, KEILER, GRATHORN, GAMS, UEBUNGSGEGNER].every(x => !gibtAuf(x)));
const anfuehrer: KampfWerte = { ...WEGELAGERER, mensch: { ...WEGELAGERER.mensch!, gibtAuf: false } };
pruefe('Anführer mit gibtAuf: false gibt nicht auf', !gibtAuf(anfuehrer));
const roh = lies('content/gegner/wegelagerer.json');
pruefe('Schema: gibtAuf im Block mensch erlaubt', GegnerDaten.safeParse({ ...roh, mensch: { ...roh.mensch, gibtAuf: false } }).success);
pruefe('Schema: gibtAuf ausserhalb von mensch abgelehnt (kein Tier kann es tragen)',
  !GegnerDaten.safeParse({ ...lies('content/gegner/wolf.json'), gibtAuf: true }).success);
pruefe('aufgabe.json besteht das Schema; Frist länger als die Betäubung des Bruchs',
  AufgabeDaten.safeParse(lies('content/aufgabe.json')).success && AUFGABE.frist > WEGELAGERER.betaeubt);
// Aus dem Stand; mit Anlauf (Laufangriff) holt sie ihn immer ein — wer töten will, kann es.
pruefe('Abstand nach dem Rückzug liegt ausser Reichweite jedes Schlags aus dem Stand',
  Object.values(WAFFEN).every(wf => [...wf.leicht, wf.schwer].every(s => s.reichweite + (s.schritt ?? 0) < AUFGABE.abstand + SPIELERIN.radius)));

// ---------------------------------------------------------------- 2. Der erste Bruch
{
  const { w, g: [m] } = platz([WEGELAGERER]);
  const tr = brich(w, m);
  pruefe('Bruch: der Treffer bricht die Haltung', tr.some(e => e.auf === m.id && e.gebrochen));
  pruefe('Bruch → aufgegeben, betäubt, ohne Deckung', m.aufgegeben !== undefined && m.phase === 'betaeubt' && m.deckung === undefined,
    `${m.aufgegeben} ${m.phase} ${m.deckung}`);
  pruefe('aufgegeben heisst: nicht mehr im Kampf, aber nicht gefallen', !imKampf(m) && m.phase !== 'gefallen');
  const leben = w.spielerin.leben, d0 = Math.hypot(m.x, m.z);
  let angriff = false;
  laufe(w, 3, () => { if (m.phase === 'vorlauf' || m.phase === 'aktiv') angriff = true; });
  pruefe('danach kein Angriff mehr (3 s)', !angriff && w.spielerin.leben === leben, `Leben ${leben} → ${w.spielerin.leben}`);
  const d1 = Math.hypot(m.x, m.z);
  pruefe('er weicht zurück, die Spielerin im Blick', d1 > d0 + 1 && Math.abs(Math.cos(m.blick - blickAuf(m.x, m.z, 0, 0))) > 0.99,
    `${d0.toFixed(2)} → ${d1.toFixed(2)} m`);
  pruefe('… höchstens bis zum Abstand aus den Daten', d1 - SPIELERIN.radius <= AUFGABE.abstand + 1e-6);
  pruefe('das Angriffsrecht bekommt er nicht', angriffsrecht(w) === null);
  // ---------------------------------------------------------------- 3. verschont
  laufe(w, AUFGABE.frist);
  pruefe('nach der Frist: aus dem Kampf, verschont', m.phase === 'gefallen' && m.ausgang === 'verschont');
  const b = kampfbericht(w, ['wegelagerer']);
  pruefe('Kampfbericht: verschont, aufgegeben, gewonnen', b.sieg && b.gegner[0].ausgang === 'verschont' && b.gegner[0].aufgegeben);
}

// ---------------------------------------------------------------- 4. trotzdem töten
{
  const { w, s, g: [m] } = platz([WEGELAGERER]);
  brich(w, m);
  let t = 0;
  while (m.phase !== 'gefallen' && t < AUFGABE.frist) {
    // hinterher und schlagen — wie die Spielerin, die nicht verschont
    const d = Math.hypot(m.x - s.x, m.z - s.z);
    s.blick = blickAuf(s.x, s.z, m.x, m.z);
    if (s.phase === 'bereit' && d > 2.2) { s.x += (m.x - s.x) / d * 4.5 * SCHRITT; s.z += (m.z - s.z) / d * 4.5 * SCHRITT; }
    else if (!s.puffer) puffere(s, 'leicht');
    simuliere(w, SCHRITT); t += SCHRITT;
  }
  pruefe('trotzdem töten: in der Frist zu schaffen', m.phase === 'gefallen' && !m.ausgang, `${t.toFixed(2)} s`);
  const b = kampfbericht(w, ['wegelagerer']);
  pruefe('Kampfbericht: getötet, nach der Aufgabe', b.gegner[0].ausgang === 'getoetet' && b.gegner[0].aufgegeben);
}

// ---------------------------------------------------------------- 5. Ausnahmen
{
  const { w, g: [a] } = platz([WOLF]);
  const tr = brich(w, a);
  pruefe('Tier: Haltungsbruch, aber keine Aufgabe', tr.some(e => e.gebrochen) && a.aufgegeben === undefined && imKampf(a));
}
{
  const { w, g: [a] } = platz([anfuehrer]);
  brich(w, a);
  let angriff = false;
  laufe(w, 3, () => { if (a.phase === 'vorlauf') angriff = true; });
  pruefe('Anführer (gibtAuf: false): kämpft nach dem Bruch weiter', a.aufgegeben === undefined && angriff);
}
{
  const { w, g: [m] } = platz([WEGELAGERER]);
  w.aufgabe = false;
  brich(w, m);
  pruefe('Kampfwelt.aufgabe = false: wie vor D426, keine Aufgabe', m.aufgegeben === undefined && m.deckung !== undefined);
}
{
  // Nur der erste Bruch zählt: ein zweiter setzt die Frist nicht zurück.
  const { w, g: [m] } = platz([WEGELAGERER]);
  brich(w, m);
  laufe(w, 1.5);
  const vorher = m.aufgegeben!;
  m.haltung = 1; m.x = 0; m.z = -1.6; m.blick = blickAuf(m.x, m.z, 0, 0); w.spielerin.blick = 0;
  brich(w, m);
  pruefe('ein zweiter Bruch setzt die Frist nicht zurück', (m.aufgegeben ?? 0) > vorher, `${vorher.toFixed(2)} → ${(m.aufgegeben ?? 0).toFixed(2)} s`);
}

// ---------------------------------------------------------------- 6. im Rudel
{
  const { w, g: [m, a] } = platz([WEGELAGERER, WOLF]);
  brich(w, m);
  pruefe('Rudel: der Mensch gibt auf, der Wolf nicht', m.aufgegeben !== undefined && a.aufgegeben === undefined);
  let wolfGreift = false, menschGreift = false, atem = false;
  laufe(w, 3, () => {
    if (a.phase === 'vorlauf') wolfGreift = true;
    if (m.phase === 'vorlauf') menschGreift = true;
    if ((w.atem ?? 0) > 0) atem = true;
  });
  pruefe('Rudel: der Wolf greift weiter an, der Mensch nicht', wolfGreift && !menschGreift);
  pruefe('Rudel: keine Atempause — der Aufgegebene zählt nicht als zweiter Gegner', !atem);
}

// ---------------------------------------------------------------- 7. Folgen
{
  const { w, g: [m, a, b] } = platz([WEGELAGERER, SPEERMANN, FUCHS]);
  m.phase = 'gefallen'; m.aufgegeben = 2;                       // nach der Aufgabe getötet
  a.phase = 'gefallen'; a.aufgegeben = AUFGABE.frist; a.ausgang = 'verschont';
  b.phase = 'gefallen';                                          // Fuchs getötet
  const bericht = kampfbericht(w, ['wegelagerer', 'speermann', 'fuchs']);
  pruefe('Bericht: getötet · verschont · getötet', bericht.sieg && bericht.gegner.map(g => g.ausgang).join(',') === 'getoetet,verschont,getoetet');
  const f = folgenDerBegegnung({ ...LEERER_STAND }, bericht, { begegnung: 'lager-bruchweg', region: 'oental', zeit: 1000 });
  pruefe('Folgen: nur der Fuchs in besiegt (Menschen in keiner Liste, D385)', f.stand.besiegt.join() === 'spuerfuchs:lager-bruchweg:3:1000');
  pruefe('Folgen: 2 getötet, 1 verschont, 0 gereinigt', f.getoetet === 2 && f.verschont === 1 && f.gereinigt === 0);
  const arten = f.ereignisse.map(e => `${e.art}${e.mensch ? '/mensch' : ''}`).join(',');
  pruefe('Begegnungen: getoetet/mensch · verschont/mensch · getoetet', arten === 'getoetet/mensch,verschont/mensch,getoetet', arten);
  const stand = f.ereignisse.reduce((st, e) => vermerkeBegegnung(st, e), f.stand);
  pruefe('Spielstand nimmt verschont und mensch an (Schema)', stand.begegnungen.length === 3 && stand.begegnungen[1].mensch === true
    && SpielstandDaten.safeParse(stand).success);
  const gew = lies('content/wanderfiguren/zaehler.json').stationen.map((s: { bis?: { gewichte?: unknown } }) => s.bis?.gewichte).find(Boolean);
  // Der Fuchs steht in besiegt und in begegnungen — er zählt einmal. Der getötete Mensch voll, der verschonte nicht.
  pruefe('Zähler der Mönche: getöteter Mensch voll, verschonter nichts', Math.abs(eingriffe(stand, gew) - 2) < 1e-9, `${eingriffe(stand, gew)}`);
  pruefe('… ohne die Menschen bliebe nur der Fuchs', Math.abs(eingriffe({ ...stand, begegnungen: stand.begegnungen.filter(e => !e.mensch) }, gew) - 1) < 1e-9);
  const region = lies('content/regions/oental.json');
  const rwelt = baueRevierwelt([Revierkarte.parse(lies('content/reviere/oental.json'))], [{ id: 'oental', bbox: region.bbox }]);
  const getoetet = (begegnungen: Begegnung[]) => [...revierZustaende(rwelt, { ...stand, begegnungen }).values()].reduce((n, z) => n + z.getoetet + z.umgangen + z.gereinigt, 0);
  const nurMensch = stand.begegnungen.filter(e => e.mensch);
  pruefe('Reviere: Menschen zählen in keinem Revier (weder getötet noch verschont)', getoetet(nurMensch) === getoetet([]), `${getoetet(nurMensch)} / ${getoetet([])}`);
  const istMaterial = (g: string) => SCHMIEDE_WAEHRUNG.has(g);
  const beute = teileBeute({ harzverband: 3, kraeutersud: 2 }, bericht, istMaterial);
  pruefe('Beute: der Verschonte gibt nichts (Material 2 von 3), Sud bleibt', beute.harzverband === 2 && beute.kraeutersud === 2, JSON.stringify(beute));
}

console.log(`\nAufgabe (D426): ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
if (fehlgeschlagen) process.exit(1);
