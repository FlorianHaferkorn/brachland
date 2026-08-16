/**
 * Tests für die Ausdauer.
 *
 * Zwei Dinge sollen sie festhalten, weil beide leicht kaputtgehen:
 *
 * 1. **Die Kletterhöhe.** 16/s Zehrung bei 2,2 m/s Steiggeschwindigkeit ergeben
 *    13,8 m. Die höchsten Klippen messen 14 m. Wer an einer der beiden Zahlen
 *    dreht, hebelt die Aussage „die höchste Wand geht nicht in einem Zug" aus,
 *    ohne es zu merken — deshalb steht sie hier als Rechnung, nicht als Kommentar.
 * 2. **Die Hysterese.** Am Nullpunkt ohne Sperre flackert die Bewegung im
 *    Bildtakt. Der Fall ist unauffällig, solange man nicht bis auf null klettert.
 */
import {
  AUSDAUER_MAX, ERHOLT_AB, ERHOLUNG_JE_SEK, KLETTERN_JE_SEK, RUHE_BIS, SPRUNG_KOSTEN,
  anteil, neueAusdauer, reicht, schritt, verbrauche, type Ausdauer,
} from '../src/spieler/ausdauer.js';

let ok = 0, fehler = 0;

function pruefe(was: string, bedingung: boolean, notiz = '') {
  console.log(`  ${bedingung ? '✓' : '✗'} ${was.padEnd(56)} ${notiz}`);
  bedingung ? ok++ : fehler++;
}

/** Lässt `sekunden` mit fester Zehrung vergehen, in Schritten von 1/60 s. */
function laufe(a: Ausdauer, sekunden: number, zehrung = 0): Ausdauer {
  const dt = 1 / 60;
  for (let t = 0; t < sekunden; t += dt) a = schritt(a, dt, zehrung);
  return a;
}

console.log('Ausdauer — Klettern zehrt, Rennen nicht\n');

// ---- Grundzustand ---------------------------------------------------------
{
  const a = neueAusdauer();
  pruefe('Startet voll', a.wert === AUSDAUER_MAX, `${a.wert}`);
  pruefe('Startet nicht erschöpft', !a.erschoepft);
  pruefe('Anteil ist 1', anteil(a) === 1);
  pruefe('Ohne Zehrung passiert nichts', laufe(a, 3).wert === AUSDAUER_MAX);
}

// ---- Die Kletterhöhe — der eigentliche Balanceweft -------------------------
{
  const KLETTERN_TEMPO = 2.2;                       // m/s, siehe RegionsSzene
  const dauer = AUSDAUER_MAX / KLETTERN_JE_SEK;     // s bis leer
  const hoehe = dauer * KLETTERN_TEMPO;
  pruefe('Aus vollem Vorrat 12–14 m Wand', hoehe > 12 && hoehe < 14,
         `${hoehe.toFixed(1)} m in ${dauer.toFixed(2)} s`);
  pruefe('Die höchste Klippe (14 m) geht NICHT in einem Zug', hoehe < 14,
         `fehlen ${(14 - hoehe).toFixed(1)} m`);

  const leer = laufe(neueAusdauer(), dauer + 0.5, KLETTERN_JE_SEK);
  pruefe('Klettern bis zum Nullpunkt setzt erschöpft', leer.erschoepft && leer.wert === 0);
  pruefe('Erschöpft heißt gesperrt', !reicht(leer));
}

// ---- Hysterese ------------------------------------------------------------
{
  const leer = laufe(neueAusdauer(), 7, KLETTERN_JE_SEK);
  // Knapp unter der Schwelle: noch gesperrt, obwohl schon Punkte da sind.
  const knapp = laufe(leer, RUHE_BIS + (AUSDAUER_MAX * ERHOLT_AB * 0.8) / ERHOLUNG_JE_SEK);
  pruefe('Unter 30 % bleibt gesperrt', knapp.erschoepft && knapp.wert > 0,
         `${knapp.wert.toFixed(0)} Punkte`);
  const frei = laufe(leer, RUHE_BIS + (AUSDAUER_MAX * ERHOLT_AB * 1.3) / ERHOLUNG_JE_SEK);
  pruefe('Über 30 % ist wieder frei', !frei.erschoepft && reicht(frei),
         `${frei.wert.toFixed(0)} Punkte`);
}

// ---- Ruhepause vor der Erholung -------------------------------------------
{
  // Vier Sekunden Klettern lassen 36 Punkte übrig — genug Abstand zum Maximum,
  // dass die Erholung messbar ist, ohne oben anzuschlagen.
  const nach = schritt(neueAusdauer(), 4, KLETTERN_JE_SEK);
  const gleich = laufe(nach, RUHE_BIS * 0.7);
  pruefe('In der Ruhepause regeneriert nichts', Math.abs(gleich.wert - nach.wert) < 0.001,
         `${gleich.wert.toFixed(1)}`);
  // 1 s Erholung sind 26 Punkte; die Ruhepause davor zählt nicht mit.
  const spaeter = laufe(nach, RUHE_BIS + 1);
  pruefe('Nach der Ruhepause regeneriert es', spaeter.wert > nach.wert + 20,
         `${nach.wert.toFixed(0)} → ${spaeter.wert.toFixed(0)}`);
  pruefe('Voll nach 4,5 s Ruhe', laufe(nach, 4.5).wert === AUSDAUER_MAX);
}

// ---- Sprung ---------------------------------------------------------------
{
  let a = neueAusdauer();
  let spruenge = 0;
  while (reicht(a, SPRUNG_KOSTEN)) { a = verbrauche(a, SPRUNG_KOSTEN); spruenge++; }
  pruefe('Sprünge am Stück aus vollem Vorrat', spruenge === 8, `${spruenge}`);
  // 8 × 12 = 96. Der Rest von 4 Punkten reicht für keinen neunten Sprung — der
  // Vorrat ist also gesperrt, nicht leer. Beim ersten Schreiben hatte ich hier
  // `=== 0` stehen; das ist die Zahl, die man erwartet, wenn man 100/12 nicht
  // ausrechnet.
  pruefe('Rest reicht für keinen weiteren Sprung',
         a.wert === AUSDAUER_MAX - 8 * SPRUNG_KOSTEN && !reicht(a, SPRUNG_KOSTEN),
         `${a.wert} übrig`);
  pruefe('Ein weiterer Sprung ändert nichts',
         verbrauche(a, SPRUNG_KOSTEN).wert === a.wert);
}

// ---- Reinheit: der übergebene Zustand darf sich nicht ändern ---------------
{
  const a = neueAusdauer();
  const kopie = { ...a };
  schritt(a, 1, KLETTERN_JE_SEK);
  verbrauche(a, SPRUNG_KOSTEN);
  pruefe('Eingabezustand bleibt unverändert',
         a.wert === kopie.wert && a.seitZehrung === kopie.seitZehrung);
}

// ---- Robustheit -----------------------------------------------------------
{
  const a = neueAusdauer();
  pruefe('dt = 0 ändert nichts', schritt(a, 0, KLETTERN_JE_SEK) === a);
  const gross = schritt(a, 100, KLETTERN_JE_SEK);
  pruefe('Riesiges dt fällt nicht unter null', gross.wert === 0);
  const ueber = laufe(neueAusdauer(), 20);
  pruefe('Erholung läuft nicht über das Maximum', ueber.wert === AUSDAUER_MAX);
}

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if (fehler > 0) process.exit(1);
