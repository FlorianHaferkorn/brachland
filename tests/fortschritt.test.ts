/**
 * Tests für den Fortschritt.
 *
 * Zwei Sorten Prüfung: harte Invarianten (eine Kreatur wird nie schwächer) und
 * **Kurvenprüfungen** — wie lange dauert es bis zur ersten Mutation, wie viele Kämpfe
 * bis Stufe 20. Die zweite Sorte ist die wichtigere: Ein Fortschrittssystem ist
 * selten kaputt, es ist meistens nur falsch dosiert, und das sieht man nur in Zahlen.
 */
import {
  STUFE_MAX, erfahrungFuerStufe, erfahrungAusSieg,
  mutationBei, werteBei, gutschrift, wildStufe,
} from '../src/spiel/fortschritt.js';

let ok = 0, fehler = 0;
function pruefe(was: string, bedingung: boolean, zusatz = '') {
  console.log(`  ${bedingung ? '✓' : '✗'} ${was.padEnd(56)} ${zusatz}`);
  bedingung ? ok++ : fehler++;
}

console.log('Fortschritt — Stufe, Erfahrung, Mutation\n');

// --- Invarianten ----------------------------------------------------------
const GRATHORN_KP = [130, 162, 198];
let steigend = true, letzterWert = 0, bruch = 0;
for (let s = 1; s <= STUFE_MAX; s++) {
  const w = werteBei(GRATHORN_KP, s);
  if (w < letzterWert) { steigend = false; bruch = s; }
  letzterWert = w;
}
pruefe('Werte steigen ueber alle Stufen monoton', steigend,
       steigend ? `Stufe 40: ${letzterWert} KP` : `Rueckschritt bei Stufe ${bruch}`);
pruefe('Roster-Werte werden an den Schwellen genau getroffen',
       werteBei(GRATHORN_KP, 1) === 130 && werteBei(GRATHORN_KP, 14) === 162
       && werteBei(GRATHORN_KP, 28) === 198);
pruefe('Zweistufige Linie waechst bis zur Hoechststufe weiter',
       werteBei([105, 138], 40) > werteBei([105, 138], 28),
       `Stufe 40: ${werteBei([105, 138], 40)} KP`);

pruefe('Mutation 1 ab Stufe 1', mutationBei(1, 3) === 0);
pruefe('Mutation 2 ab Stufe 14', mutationBei(14, 3) === 1 && mutationBei(13, 3) === 0);
pruefe('Mutation 3 ab Stufe 28', mutationBei(28, 3) === 2 && mutationBei(27, 3) === 1);
pruefe('Zweistufige Linie bleibt bei Mutation 2', mutationBei(35, 2) === 1);
pruefe('Einstufige Linie bleibt bei Mutation 1', mutationBei(40, 1) === 0);

pruefe('Erfahrung waechst mit der Stufe',
       erfahrungFuerStufe(20) > erfahrungFuerStufe(10) * 2,
       `Stufe 10: ${erfahrungFuerStufe(10)}, Stufe 20: ${erfahrungFuerStufe(20)}`);

// --- Kurve: wie viele Kaempfe bis wohin? ---------------------------------
/** Simuliert Kaempfe gegen Gegner gleicher Stufe und zaehlt, wie viele noetig sind. */
function kaempfeBis(zielStufe: number): number {
  let s = 1, e = 0, n = 0;
  while (s < zielStufe && n < 100_000) {
    const g = erfahrungAusSieg(s, mutationBei(s, 3));
    const a = gutschrift(s, e, g, 3);
    s = a.stufe; e = a.erfahrung; n++;
  }
  return n;
}
const bis14 = kaempfeBis(14);
const bis28 = kaempfeBis(28);
const bis40 = kaempfeBis(40);
console.log('');
// Die Korridore sind Designziele, keine Messungen: Kapitel 1 ist auf 6 Stunden
// ausgelegt, das Spiel auf fuenf Regionen. Die erste Mutation soll man im ersten
// Kapitel erleben, die Hoechststufe ausdruecklich NICHT.
pruefe('Erste Mutation in 8-25 Kaempfen', bis14 >= 8 && bis14 <= 25, `${bis14} Kaempfe bis Stufe 14`);
pruefe('Zweite Mutation in 35-100 Kaempfen', bis28 >= 35 && bis28 <= 100, `${bis28} Kaempfe bis Stufe 28`);
pruefe('Hoechststufe erst nach 120+ Kaempfen', bis40 >= 120, `${bis40} Kaempfe bis Stufe 40`);

// --- Aufstieg -------------------------------------------------------------
console.log('');
const a1 = gutschrift(1, 0, erfahrungFuerStufe(1), 3);
pruefe('Genau die Schwelle reicht fuer eine Stufe', a1.stufe === 2 && a1.gestiegen === 1);

const a2 = gutschrift(1, 0, 10_000_000, 3);
pruefe('Grosser Sprung endet bei Hoechststufe', a2.stufe === STUFE_MAX && a2.mutation === 2,
       `${a2.gestiegen} Stufen auf einmal`);

const a3 = gutschrift(13, erfahrungFuerStufe(13) - 1, 1, 3);
pruefe('Mutation wird beim Stufenaufstieg gemeldet', a3.stufe === 14 && a3.mutiert === true);

const a4 = gutschrift(5, 0, 1, 3);
pruefe('Ohne Aufstieg keine Mutationsmeldung', a4.gestiegen === 0 && a4.mutiert === false);

const a5 = gutschrift(STUFE_MAX, 0, 999, 3);
pruefe('Hoechststufe nimmt keine Erfahrung mehr an', a5.stufe === STUFE_MAX && a5.erfahrung === 0);

// --- Wilde Stufen ---------------------------------------------------------
console.log('');
let minNah = 99, maxNah = 0, minFern = 99, maxFern = 0;
for (let i = 0; i < 400; i++) {
  const w = i / 400;
  minNah = Math.min(minNah, wildStufe(50, w));   maxNah = Math.max(maxNah, wildStufe(50, w));
  minFern = Math.min(minFern, wildStufe(1800, w)); maxFern = Math.max(maxFern, wildStufe(1800, w));
}
pruefe('Startbereich liefert niedrige Stufen', maxNah <= 8, `Stufe ${minNah}-${maxNah} bei 50 m`);
pruefe('Regionsrand liefert hohe Stufen', minFern >= 20, `Stufe ${minFern}-${maxFern} bei 1800 m`);
pruefe('Nie unter Stufe 1', minNah >= 1);

// --- Werte-Beispiel zum Nachlesen ----------------------------------------
console.log('\n  Grathorn (Basis 130 KP je Mutation) ueber die Stufen:');
for (const s of [1, 7, 13, 14, 21, 27, 28, 34, 40]) {
  const m = mutationBei(s, 3);
  console.log(`    Stufe ${String(s).padStart(2)}  Mutation ${m + 1}  ${String(werteBei(GRATHORN_KP, s)).padStart(3)} KP`);
}

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen\n`);
process.exit(fehler > 0 ? 1 : 0);
