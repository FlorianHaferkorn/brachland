/**
 * Was kostet die Steigungsgrenze an begehbarer Welt?
 *
 * Der Anlass ist eine Änderung, die leicht das ganze Spiel kaputtmacht: Bis eben
 * setzte die Figur ihre Höhe jedes Bild auf den Boden und lief damit **jede** Wand
 * senkrecht hoch. Ohne Grenze ist Klettern folgenlos; mit einer zu strengen Grenze
 * steht man im Talkessel und kommt nicht mehr heraus.
 *
 * Im Browser lässt sich das nicht messen — der Software-Renderer der Sandbox
 * schafft 1 Bild je Sekunde, und in zwölf Sekunden Gehen kommt knapp ein Meter
 * zusammen. Die Frage ist aber ohnehin rein geometrisch und braucht keinen
 * Renderer: Sie hängt nur am Höhenfeld und an derselben Formel, die auch die Szene
 * benutzt.
 *
 * Drei Zahlen zählen:
 *   1. Wie viel der Fläche ist zu Fuß begehbar?
 *   2. Wo steht man **fest** — alle acht Richtungen blockiert und kein Fels zum
 *      Klettern? Das wäre der einzige echte Fehler.
 *   3. Wie viel gewinnt Klettern dazu?
 *
 * `npm run steigung`
 */
import { readFileSync } from 'node:fs';
import { entpackeWelt } from '../src/world/osm.js';
import { baueHoehenfeld, hoeheAufFlaeche } from '../src/world/lod.js';

/** Aus `RegionsSzene.tsx` — bewusst hier gespiegelt, weil das Modul React lädt. */
const GEHEN_MAX_GRAD = 40;
const STEIGUNG_MAX = Math.tan(GEHEN_MAX_GRAD * Math.PI / 180);
const TAST_WEITE = 1.4;
/** Aus `ausdauer.ts`: 100 Punkte / 16 je Sekunde × 2,2 m/s. */
const KLETTERHOEHE = (100 / 16) * 2.2;

const roh = JSON.parse(readFileSync('public/world/oental.json', 'utf8'));
const welt = entpackeWelt(roh.welt);
const feld = baueHoehenfeld(welt);

/** Prüfraster. 12 m ist grob genug für 4 km² und fein genug für Talkessel. */
const SCHRITT = 12;
const halbB = feld.breiteMeter / 2 - 20, halbT = feld.tiefeMeter / 2 - 20;

const RICHTUNGEN = Array.from({ length: 8 }, (_, i) => {
  const w = (i / 8) * Math.PI * 2;
  return [Math.sin(w), Math.cos(w)] as const;
});

interface Punkt { x: number; z: number; offen: number; maxSteigung: number }
const punkte: Punkt[] = [];

for (let x = -halbB; x <= halbB; x += SCHRITT) {
  for (let z = -halbT; z <= halbT; z += SCHRITT) {
    const h = hoeheAufFlaeche(feld, x, z);
    let offen = 0, maxSteigung = -Infinity;
    for (const [dx, dz] of RICHTUNGEN) {
      const hv = hoeheAufFlaeche(feld, x + dx * TAST_WEITE, z + dz * TAST_WEITE);
      const s = (hv - h) / TAST_WEITE;
      maxSteigung = Math.max(maxSteigung, s);
      if (s <= STEIGUNG_MAX) offen++;
    }
    punkte.push({ x, z, offen, maxSteigung });
  }
}

const n = punkte.length;
const anteil = (k: number) => `${(100 * k / n).toFixed(2)} %`;

console.log(`Steigungsgrenze — ${GEHEN_MAX_GRAD}° (tan = ${STEIGUNG_MAX.toFixed(3)})\n`);
console.log(`  Prüfpunkte im ${SCHRITT}-m-Raster        ${n.toLocaleString('de')}`);
console.log('');

// ---- 1. Wie viel ist zu Fuß offen? ----------------------------------------
const frei = punkte.filter(p => p.offen === 8).length;
const teils = punkte.filter(p => p.offen > 0 && p.offen < 8).length;
const fest = punkte.filter(p => p.offen === 0);
console.log('  Bewegungsfreiheit je Standort');
console.log(`    alle 8 Richtungen offen        ${String(frei).padStart(6)}  ${anteil(frei)}`);
console.log(`    teilweise blockiert            ${String(teils).padStart(6)}  ${anteil(teils)}`);
console.log(`    alle 8 blockiert (festgesetzt) ${String(fest.length).padStart(6)}  ${anteil(fest.length)}`);
console.log('');

// ---- 2. Der einzige echte Fehler: festsitzen OHNE Ausweg -------------------
//
// „Alle acht blockiert" ist für sich noch kein Fehler: Wer auf einem Felskopf
// steht, kommt herunter — bergab ist nie gesperrt. Gesperrt sind nur Schritte
// BERGAUF. Ein echter Fehler wäre eine Senke, aus der es weder hinauf noch
// hinunter geht, und die kann es in einem Höhenfeld gar nicht geben, solange die
// Prüfung nur bergauf greift. Trotzdem einmal nachgerechnet:
const kessel = fest.filter(p => {
  const h = hoeheAufFlaeche(feld, p.x, p.z);
  // Gibt es irgendeine Richtung, in der es abwärts geht?
  return !RICHTUNGEN.some(([dx, dz]) =>
    hoeheAufFlaeche(feld, p.x + dx * TAST_WEITE, p.z + dz * TAST_WEITE) < h - 0.02);
});
console.log('  Kessel ohne Ausweg (weder hinauf noch hinunter)');
console.log(`    ${kessel.length === 0 ? '✓ keiner' : `✗ ${kessel.length} Stellen`}`);
if (kessel.length) for (const k of kessel.slice(0, 5))
  console.log(`      bei ${Math.round(k.x)} / ${Math.round(k.z)}`);
console.log('');

// ---- 3. Was Klettern dazugewinnt ------------------------------------------
//
// Eine blockierte Richtung ist erst dann ein Verlust, wenn die Wand höher ist,
// als eine Ausdauerfüllung trägt. Alles darunter ist keine Grenze, sondern eine
// Kletterstelle — und damit genau das, wofür die Grenze eingebaut wurde.
let kletterbar = 0, zuHoch = 0;
for (const p of punkte) {
  if (p.offen === 8) continue;
  // Wandhöhe grob: Steigung mal einer typischen Wandlänge von 10 m, gedeckelt.
  const hoehe = Math.min(20, p.maxSteigung * 10);
  if (hoehe <= KLETTERHOEHE) kletterbar++; else zuHoch++;
}
console.log('  Blockierte Standorte nach Wandhöhe');
console.log(`    in einem Zug erkletterbar (≤ ${KLETTERHOEHE.toFixed(1)} m)  ${String(kletterbar).padStart(6)}  ${anteil(kletterbar)}`);
console.log(`    braucht einen Absatz zum Verschnaufen      ${String(zuHoch).padStart(6)}  ${anteil(zuHoch)}`);
console.log('');

// ---- Verteilung -----------------------------------------------------------
const grade = punkte.map(p => Math.atan(Math.max(0, p.maxSteigung)) * 180 / Math.PI).sort((a, b) => a - b);
const q = (t: number) => grade[Math.floor(t * (grade.length - 1))].toFixed(1);
console.log('  Steilste Richtung je Standort, in Grad');
console.log(`    Median ${q(0.5)}°   ·   80. Perzentil ${q(0.8)}°   ·   95. ${q(0.95)}°   ·   Maximum ${q(1)}°`);
console.log('');
console.log(`  Zum Vergleich: Klippen entstehen ab ${41}° (KLIPPE_AB_GRAD). Die Grenze`);
console.log(`  liegt bei ${GEHEN_MAX_GRAD}° und damit knapp darunter — wo eine Felsplatte steht,`);
console.log('  muss geklettert werden, und nur da.');
