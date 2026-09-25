/**
 * BRACHLAND — Kampftor: die Zahlen, die kein Bild zeigt (ADR-0007, Stufe 1)
 *
 * Ein Echtzeitkampf steht und fällt an Fenstern in Millisekunden, Reichweiten in Metern und
 * Winkeln. Kein Bildtor sieht sie, und ein Spieltest sieht sie nur als Gefühl („die Rolle geht
 * manchmal nicht"). Dieser Test rechnet sie nach, Teilschritt für Teilschritt, und druckt die
 * gemessenen Werte aus — das ist die Latte, die ADR-0007 unter „Konsequenzen" verlangt.
 *
 * Geprüft werden Regeln, nicht Zahlenwerte: dass ein Schwung jedes Ziel nur einmal trifft, dass die
 * Rolle auf der Stelle nur im richtigen Moment schützt, dass dieser Moment für einen Menschen
 * erreichbar ist, dass das Ergebnis nicht an der Bildrate hängt. Wer an `SPIELERIN` oder
 * `UEBUNGSGEGNER` dreht, bekommt hier gesagt, ob das Spiel dabei kaputtgeht.
 */
import {
  SPIELERIN, UEBUNGSGEGNER, SCHRITT, ZIELEN,
  neuerKaempfer, setzeSchlagAn, setzeRolleAn, kannSchlagen, kannRollen,
  imBogen, loeseTreffer, schrittKaempfer, simuliere, waehleZiel, blickAuf, vorwaerts,
  type Kaempfer, type Kampfwelt, type Treffer,
} from '../src/kampf/echtzeit.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, bedingung: boolean, hinweis = '') {
  if (bedingung) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}
const GRAD = Math.PI / 180;
const f3 = (v: number) => v.toFixed(3);

/** Spielerin im Ursprung mit Blick nach −Z, Gegner `d` m davor, ihr zugewandt. */
function paar(d: number): { s: Kaempfer; g: Kaempfer } {
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  const g = neuerKaempfer('g', UEBUNGSGEGNER, 0, -d, blickAuf(0, -d, 0, 0));
  return { s, g };
}

// ---------------------------------------------------- 1. Richtung stimmt mit der Szene überein
{
  const [fx, fz] = vorwaerts(0);
  pruefe('blick 0 schaut nach −Z wie in `Spieler`', Math.abs(fx) < 1e-9 && Math.abs(fz + 1) < 1e-9);
  pruefe('blickAuf ist die Umkehrung von vorwaerts', Math.abs(blickAuf(0, 0, 0, -5)) < 1e-9
    && Math.abs(Math.abs(blickAuf(0, 0, 0, 5)) - Math.PI) < 1e-9);
}

// ---------------------------------------------------- 2. Reichweite bis zum Kapselrand
const randReichweite = SPIELERIN.schlag.reichweite + UEBUNGSGEGNER.radius;
{
  const nah = paar(randReichweite - 0.05), weit = paar(randReichweite + 0.05);
  pruefe(`Schlag trifft 5 cm innerhalb der Reichweite (${f3(randReichweite)} m Mitte zu Mitte)`,
    imBogen(nah.s, nah.g));
  pruefe('Schlag verfehlt 5 cm ausserhalb', !imBogen(weit.s, weit.g));
}

// ---------------------------------------------------- 3. Winkel, mit Zugabe für die Kapsel
{
  const bei = (grad: number) => {
    const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
    const a = grad * GRAD;
    const g = neuerKaempfer('g', UEBUNGSGEGNER, -Math.sin(a) * 2, -Math.cos(a) * 2);
    return imBogen(s, g);
  };
  pruefe('Ziel 40° neben dem Blick wird getroffen', bei(40));
  pruefe('Ziel 80° neben dem Blick wird verfehlt', !bei(80));
  pruefe('Ziel hinter der Spielerin wird verfehlt', !bei(180));
}

// ---------------------------------------------------- 4. Ein Schwung trifft jedes Ziel genau einmal, und nur im Aktiven
let trefferZeit = NaN;
{
  const { s, g } = paar(2);
  setzeSchlagAn(s);
  let n = 0;
  for (let i = 0, t = 0; i < 120; i++) {
    schrittKaempfer(s, SCHRITT); t += SCHRITT;
    const h = loeseTreffer(s, [g]);
    if (h.length && Number.isNaN(trefferZeit)) trefferZeit = t;
    n += h.length;
  }
  pruefe('ein Schwung, ein Treffer, obwohl das Aktive 14 Teilschritte dauert', n === 1, `${n} Treffer`);
  const a0 = SPIELERIN.schlag.vorlauf, a1 = a0 + SPIELERIN.schlag.aktiv;
  pruefe('der Treffer fällt ins aktive Fenster, nicht in Vorlauf oder Erholung',
    trefferZeit >= a0 - 1e-9 && trefferZeit < a1 + SCHRITT, `bei ${f3(trefferZeit)} s, Fenster ${a0}–${a1}`);
}

// ---------------------------------------------------- 5. Das Schutzfenster der Rolle auf der Stelle
//
// Der Gegner setzt bei t = 0 an. Die Spielerin rollt bei t0 **auf der Stelle** — ohne Weg, also
// schützt allein die Unverwundbarkeit. Gerechnet wird für jedes t0 in 5-ms-Schritten, ob Schaden
// ankommt. Das Ergebnis ist das Fenster, das ein Spieler treffen muss.
const REAKTION = 0.25;
let fensterVon = NaN, fensterBis = NaN, zusammenhaengend = true;
{
  const geschuetzt = (t0: number): boolean => {
    const { s, g } = paar(1.8);
    setzeSchlagAn(g);
    let t = 0, gerollt = false;
    for (let i = 0; i < 180; i++) {
      if (!gerollt && t >= t0 - 1e-9) { gerollt = setzeRolleAn(s, 0, 0); }
      schrittKaempfer(s, SCHRITT); schrittKaempfer(g, SCHRITT); t += SCHRITT;
      loeseTreffer(g, [s]);
    }
    return s.leben === s.werte.lebenMax;
  };
  let vorher = false;
  for (let t0 = 0; t0 <= 0.9 + 1e-9; t0 += 0.005) {
    const jetzt = geschuetzt(t0);
    if (jetzt && Number.isNaN(fensterVon)) fensterVon = t0;
    if (jetzt) fensterBis = t0;
    if (!jetzt && vorher && !Number.isNaN(fensterVon)) {
      // nach dem Ende wieder geschützt? Dann ist das Fenster zerrissen.
      for (let t1 = t0; t1 <= 0.9; t1 += 0.005) if (geschuetzt(t1)) zusammenhaengend = false;
      break;
    }
    vorher = jetzt;
  }
  const breite = fensterBis - fensterVon;
  pruefe('es gibt ein Schutzfenster', !Number.isNaN(fensterVon));
  pruefe('das Schutzfenster ist zusammenhängend', zusammenhaengend);
  pruefe('das Schutzfenster ist mindestens 200 ms breit', breite >= 0.2 - 1e-9, `${f3(breite)} s`);
  pruefe(`es endet mindestens 150 ms nach einer Reaktionszeit von ${REAKTION} s — erreichbar`,
    fensterBis >= REAKTION + 0.15 - 1e-9, `endet bei ${f3(fensterBis)} s`);
  pruefe('eine Panikrolle beim ersten Zucken schützt nicht — Timing zählt', !geschuetzt(0));
}

// ---------------------------------------------------- 6. Aus dem Bogen rollen
//
// Diesmal in der ganzen Welt, mit denkendem Gegner, der sich im Vorlauf nachdreht.
function lauf(aktion: (w: Kampfwelt, t: number) => void, dauer = 2.5): { w: Kampfwelt; treffer: Treffer[] } {
  const { s, g } = paar(2.2);
  const w: Kampfwelt = { spielerin: s, gegner: [g], ziel: null };
  const treffer: Treffer[] = [];
  for (let t = 0; t < dauer; t += SCHRITT) { aktion(w, t); treffer.push(...simuliere(w, SCHRITT)); }
  return { w, treffer };
}
{
  const stehen = lauf(() => {});
  pruefe('wer im Telegraf stehenbleibt, wird getroffen',
    stehen.treffer.some(h => h.auf === 's' && h.schaden > 0));
  const zurueck = lauf((w, t) => { if (Math.abs(t - REAKTION) < SCHRITT / 2) setzeRolleAn(w.spielerin, 0, 1); });
  pruefe('Rolle rückwärts nach Reaktionszeit: kein Schaden (Abstand)',
    zurueck.w.spielerin.leben === SPIELERIN.lebenMax, `Leben ${zurueck.w.spielerin.leben}`);
  const seite = lauf((w, t) => { if (Math.abs(t - REAKTION) < SCHRITT / 2) setzeRolleAn(w.spielerin, 1, 0); });
  pruefe('Rolle zur Seite nach Reaktionszeit: kein Schaden, obwohl der Gegner nachdreht',
    seite.w.spielerin.leben === SPIELERIN.lebenMax, `Leben ${seite.w.spielerin.leben}`);
}

// ---------------------------------------------------- 7. Ausdauer ist die gemeinsame Kasse
let schlaegeAusVoll = 0, rollenAusVoll = 0;
{
  const s = neuerKaempfer('s', SPIELERIN, 0, 0);
  while (setzeSchlagAn(s)) { schlaegeAusVoll++; s.phase = 'bereit'; }
  pruefe('ohne Ausdauer kein Schlag', !kannSchlagen(s));
  for (let t = 0; t < 1.2; t += SCHRITT) schrittKaempfer(s, SCHRITT);
  pruefe('nach gut einer Sekunde Ruhe geht der nächste Schlag wieder', kannSchlagen(s),
    `Ausdauer ${s.ausdauer.wert.toFixed(1)}`);
  const r = neuerKaempfer('r', SPIELERIN, 0, 0);
  while (setzeRolleAn(r, 0, 1)) { rollenAusVoll++; r.phase = 'bereit'; }
  pruefe('ohne Ausdauer keine Rolle', !kannRollen(r));
  pruefe('aus vollem Vorrat gehen mehr Schläge als Rollen', schlaegeAusVoll > rollenAusVoll);
  const e = neuerKaempfer('e', SPIELERIN, 0, 0);
  setzeSchlagAn(e);
  pruefe('im Vorlauf keine Rolle — wer ausholt, hat sich festgelegt', !kannRollen(e));
  e.phase = 'erholung';
  pruefe('aus der Erholung darf gerollt werden', kannRollen(e));
}

// ---------------------------------------------------- 8. Haltung bricht beim zweiten Treffer, nicht beim ersten
{
  const { s, g } = paar(2);
  setzeSchlagAn(g);
  const hau = () => { s.phase = 'aktiv'; s.erreicht = new Set(); return loeseTreffer(s, [g]); };
  hau();
  pruefe('der erste Treffer unterbricht den Vorlauf des Gegners nicht', g.phase === 'vorlauf', g.phase);
  const zweiter = hau();
  pruefe('der zweite bricht die Haltung und betäubt', g.phase === 'betaeubt' && zweiter[0]?.gebrochen === true, g.phase);
  pruefe('nach dem Bruch ist die Haltung wieder voll', g.haltung === UEBUNGSGEGNER.haltungMax);
}

// ---------------------------------------------------- 9. Zielaufschaltung
{
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  const vorn = neuerKaempfer('vorn', UEBUNGSGEGNER, 0, -5);
  const hinten = neuerKaempfer('hinten', UEBUNGSGEGNER, 0, 3);
  const fern = neuerKaempfer('fern', UEBUNGSGEGNER, 0, -(ZIELEN.reichweite + 2));
  const schraeg = neuerKaempfer('schraeg', UEBUNGSGEGNER, -Math.sin(30 * GRAD) * 8, -Math.cos(30 * GRAD) * 8);
  const alle = [vorn, hinten, fern, schraeg];
  pruefe('aufgeschaltet wird das nächste Ziel im Kegel, nicht das hinter einem',
    waehleZiel(s, alle)?.id === 'vorn', waehleZiel(s, alle)?.id);
  vorn.phase = 'gefallen';
  pruefe('ein gefallenes Ziel wird übersprungen', waehleZiel(s, alle)?.id === 'schraeg', waehleZiel(s, alle)?.id);
  schraeg.phase = 'gefallen';
  pruefe('jenseits der Reichweite wird nichts aufgeschaltet', waehleZiel(s, alle) === null);
}

// ---------------------------------------------------- 10. Der Übungsgegner kommt und schlägt
let ankunft = NaN;
{
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  const g = neuerKaempfer('g', UEBUNGSGEGNER, 0, -8, 0);
  const w: Kampfwelt = { spielerin: s, gegner: [g], ziel: null };
  for (let t = 0; t < 6 && Number.isNaN(ankunft); t += SCHRITT) {
    if (simuliere(w, SCHRITT).some(h => h.auf === 's' && h.schaden > 0)) ankunft = t;
  }
  pruefe('der Gegner rückt aus 8 m auf und trifft eine stehende Spielerin', !Number.isNaN(ankunft));
  pruefe('ein Treffer kostet genau seinen Schaden', s.leben === SPIELERIN.lebenMax - UEBUNGSGEGNER.schlag.schaden,
    `Leben ${s.leben}`);
}

// ---------------------------------------------------- 10b. Aus jeder Richtung, auf jeder Höhe
// Im Spiel stand der Übungsgegner 2,38 m vor der Spielerin und schlug nie: Der Anlauf
// endete mit krummen Koordinaten 1e-16 m vor der Haltelinie, und die Bedingung „weiter
// anrücken" blieb für immer wahr. Achsparallel (wie oben) fällt das nicht auf.
{
  let schlug = 0;
  const richtungen = 12;
  for (let i = 0; i < richtungen; i++) {
    const a = (i / richtungen) * 2 * Math.PI + 0.13;
    const s = neuerKaempfer('s', SPIELERIN, 3.7, -1.2, 0, 41.3);
    const gx = 3.7 - Math.sin(a) * 9.3, gz = -1.2 - Math.cos(a) * 9.3;
    const g = neuerKaempfer('g', UEBUNGSGEGNER, gx, gz, blickAuf(gx, gz, 3.7, -1.2));
    const w: Kampfwelt = { spielerin: s, gegner: [g], ziel: null };
    let angesetzt = false;
    for (let t = 0; t < 6 && !angesetzt; t += 1 / 60) {
      simuliere(w, 1 / 60);
      angesetzt = g.phase !== 'bereit';
    }
    if (angesetzt) schlug++;
  }
  pruefe('der Gegner setzt aus allen 12 Anlaufrichtungen binnen 6 s zum Schlag an',
    schlug === richtungen, `${schlug}/${richtungen}`);
}

// ---------------------------------------------------- 11. Unabhängig von der Bildrate
{
  const probe = (bild: number) => {
    const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
    const g = neuerKaempfer('g', UEBUNGSGEGNER, 0, -6, 0);
    const w: Kampfwelt = { spielerin: s, gegner: [g], ziel: null };
    let t = 0, ereignisse = 0;
    while (t < 5) { ereignisse += simuliere(w, bild).length; t += bild; }
    return `${s.leben}|${g.leben}|${ereignisse}`;
  };
  const a = probe(1 / 30), b = probe(1 / 144), c = probe(0.1);
  pruefe('dasselbe Ergebnis bei 30, 144 und 10 Bildern je Sekunde', a === b && b === c, `${a} · ${b} · ${c}`);
}

// ---------------------------------------------------- Die gemessenen Werte
const s0 = SPIELERIN, g0 = UEBUNGSGEGNER;
console.log('\nKampftor — gemessen an SPIELERIN gegen UEBUNGSGEGNER');
console.log(`  Schutzfenster Rolle auf der Stelle   ${f3(fensterVon)} … ${f3(fensterBis)} s nach Telegrafbeginn`
  + ` (${Math.round((fensterBis - fensterVon) * 1000)} ms; Telegraf ${g0.schlag.vorlauf} s)`);
console.log(`  Treffer der Spielerin                bei ${f3(trefferZeit)} s nach Tastendruck`);
console.log(`  Reichweite Mitte zu Mitte            ${f3(randReichweite)} m`);
console.log(`  Aus vollem Vorrat                    ${schlaegeAusVoll} Schläge oder ${rollenAusVoll} Rollen`);
console.log(`  Schläge bis der Gegner fällt         ${Math.ceil(g0.lebenMax / s0.schlag.schaden)}`
  + ` · bis er taumelt ${Math.ceil(g0.haltungMax / s0.schlag.haltungsschaden)}`);
console.log(`  Treffer bis die Spielerin fällt      ${Math.ceil(s0.lebenMax / g0.schlag.schaden)}`);
console.log(`  Erster Treffer des Gegners aus 8 m   ${f3(ankunft)} s`);
console.log(`\n${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
