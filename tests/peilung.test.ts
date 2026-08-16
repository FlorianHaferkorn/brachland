/**
 * Tests für die Peilung.
 *
 * Der Anlass ist ein echter Fehler: ein falsches Vorzeichen, das nur bei
 * Blickrichtung 0 unauffällig war. Die Fälle hier sind genau die, bei denen er
 * aufgefallen wäre.
 */
import { peilung } from '../src/spieler/peilung.js';

let ok = 0, fehler = 0;
const GRAD = 180 / Math.PI;

function pruefe(was: string, ist: number, soll: number, toleranz = 0.5) {
  const gut = Math.abs(ist - soll) <= toleranz;
  console.log(`  ${gut ? '✓' : '✗'} ${was.padEnd(52)} ${ist.toFixed(1)}°` +
              (gut ? '' : `  (erwartet ${soll}°)`));
  gut ? ok++ : fehler++;
}

console.log('Peilung — Blickrichtung ist -Z, positiv heißt rechts\n');

// Ohne Drehung. Der Spieler steht im Ursprung und schaut nach -Z.
pruefe('Ziel geradeaus (0,-10), Blick 0',        peilung(0, 0, 0, -10, 0) * GRAD, 0);
pruefe('Ziel rechts (10,0), Blick 0',            peilung(0, 0, 10, 0, 0) * GRAD, 90);
pruefe('Ziel links (-10,0), Blick 0',            peilung(0, 0, -10, 0, 0) * GRAD, -90);
pruefe('Ziel hinten (0,10), Blick 0',            Math.abs(peilung(0, 0, 0, 10, 0) * GRAD), 180);

// Mit Drehung — hier lag der Fehler. Dreht sich der Blick nach links (gier +90°),
// muss ein Ziel, das vorher links lag, jetzt geradeaus liegen.
pruefe('Ziel links, Blick 90° nach links gedreht',
       peilung(0, 0, -10, 0, Math.PI / 2) * GRAD, 0);
pruefe('Ziel geradeaus, Blick 90° nach links gedreht',
       peilung(0, 0, 0, -10, Math.PI / 2) * GRAD, 90);
pruefe('Ziel rechts, Blick 90° nach rechts gedreht',
       peilung(0, 0, 10, 0, -Math.PI / 2) * GRAD, 0);

// Drehen verkleinert den Betrag — das ist die Eigenschaft, an der die Anzeige hängt.
//
// Der Pfeil zeigt hier nach links (negativer Winkel), also muss nach links gedreht
// werden. Nach links heißt **wachsendes** `gier`: Die Blickrichtung ist
// (-sin g, -cos g), bei g = 0 also -Z und bei g = +90° -X — von oben betrachtet eine
// Linksdrehung. Beim ersten Schreiben dieses Falls hatte ich das Vorzeichen falsch
// und der Test schlug fehl, obwohl die Formel stimmte.
const start = peilung(0, 0, -70, 66, 0);
const nachDrehung = peilung(0, 0, -70, 66, 0.4);
pruefe('Drehen nach links verkleinert einen negativen Winkel',
       Math.abs(nachDrehung) < Math.abs(start) ? 1 : 0, 1, 0);
pruefe('Drehen nach rechts vergroessert ihn',
       Math.abs(peilung(0, 0, -70, 66, -0.4)) > Math.abs(start) ? 1 : 0, 1, 0);

// Mehrfache Umdrehung darf nicht aufaddieren.
pruefe('Winkel bleibt in -180…180 auch nach 3 Umdrehungen',
       Math.abs(peilung(0, 0, 0, -10, 6 * Math.PI) * GRAD) <= 180.001 ? 1 : 0, 1, 0);

// Versatz des Spielers: nur die Differenz zählt.
pruefe('Spieler versetzt, gleiche relative Lage',
       peilung(500, -300, 500, -310, 0) * GRAD, 0);

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen\n`);
process.exit(fehler > 0 ? 1 : 0);
