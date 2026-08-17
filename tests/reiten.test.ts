/**
 * Tests für Reiten und Waten.
 *
 * Zwei Module, ein Test — beide beantworten dieselbe Sorte Frage („darf die Figur
 * das hier?") und beide hängen an Zahlen, die stimmen müssen, damit die Fähigkeit
 * überhaupt einen Ort hat.
 *
 * Beim Wasserfeld ist genau das schiefgegangen: Der erste Anlauf von
 * `tools/wassercheck.ts` maß die Bachbreite am Biom-Raster und kam auf 15,6 m —
 * die Rasterweite. Der Test hier hält fest, dass das Feld die **Linienbreite**
 * benutzt, also 4 m für einen `stream`, und nicht irgendeine Rasterzahl.
 */
import { besteReittier, traegt, warumNicht, REITEN_AB_MUTATION,
         type Reitkandidat } from '../src/spiel/reiten.js';
import { baueWasserfeld } from '../src/world/wasserfeld.js';
import type { Weltdaten } from '../src/world/osm.js';

let ok = 0, fehler = 0;
function pruefe(was: string, bedingung: boolean, notiz = '') {
  console.log(`  ${bedingung ? '✓' : '✗'} ${was.padEnd(54)} ${notiz}`);
  bedingung ? ok++ : fehler++;
}

const k = (platz: number, basisRig: string, mutation: number, name = `T${platz}`): Reitkandidat =>
  ({ platz, kreatur: 'x', name, basisRig, mutation });

console.log('Reiten — Bauform und Mutationsstufe\n');

// ---- Bedingungen ----------------------------------------------------------
pruefe('Vierbeiner auf Mutationsstufe 2 trägt', traegt('quadruped', 1));
pruefe('Vierbeiner auf Stufe 1 trägt NICHT', !traegt('quadruped', 0));
pruefe('Kleiner Vierbeiner trägt nie', !traegt('quadruped_small', 2));
pruefe('Vogel trägt nie', !traegt('biped_bird', 2));
pruefe('Schlange trägt nie', !traegt('serpent', 2));

// ---- Auswahl im Team ------------------------------------------------------
{
  pruefe('Leeres Team: kein Reittier', besteReittier([]) === null);
  pruefe('Nur ungeeignete: kein Reittier',
         besteReittier([k(0, 'biped_bird', 2), k(1, 'serpent', 2)]) === null);

  const team = [k(0, 'quadruped', 1, 'Alt'), k(1, 'quadruped', 2, 'Groß'), k(2, 'biped_bird', 2)];
  pruefe('Höchste Mutation gewinnt', besteReittier(team)?.name === 'Groß');

  // Bei Gleichstand entscheidet die Teamordnung — das ist die Aussage des Spielers.
  const gleich = [k(0, 'quadruped', 1, 'Vorne'), k(1, 'quadruped', 1, 'Hinten')];
  pruefe('Bei Gleichstand der vordere Platz', besteReittier(gleich)?.name === 'Vorne');
}

// ---- Die Erklärung, wenn es nicht geht ------------------------------------
{
  pruefe('Kein Team → sagt das', warumNicht([]) === 'Kein Team.');
  pruefe('Nur Vögel → nennt die Bauform',
         warumNicht([k(0, 'biped_bird', 2)])?.includes('Vierbeiner') === true);
  const zuKlein = warumNicht([k(0, 'quadruped', 0, 'Grathorn')]);
  pruefe('Zu kleine Mutation → nennt Namen und Schwelle',
         zuKlein?.includes('Grathorn') === true && zuKlein.includes(String(REITEN_AB_MUTATION + 1)),
         zuKlein ?? '');
  pruefe('Mit Reittier keine Erklärung', warumNicht([k(0, 'quadruped', 1)]) === null);
}

// ---- Wasserfeld -----------------------------------------------------------
console.log('\nWasserfeld — Breite kommt aus der Linie, nicht aus dem Raster\n');
{
  // Eine kerzengerade Bachlinie durch die Mitte einer 1000×1000-m-Welt.
  // bbox so gewählt, dass die Umrechnung glatt aufgeht.
  const welt = {
    bbox: [0, 0, 1, 1],
    linien: [{ art: 'stream', breite: 4, punkte: [[0.5, 0.2], [0.5, 0.8]] }],
  } as unknown as Weltdaten;
  const feld = baueWasserfeld(welt, 1000, 1000);

  pruefe('Segmente gefunden', feld.segmente === 1, `${feld.segmente}`);
  pruefe('Bachmitte ist nass', feld.tiefeAn(0, 0) > 0.5, `${feld.tiefeAn(0, 0).toFixed(2)} m`);
  pruefe('Trocken 10 m daneben', feld.tiefeAn(0, 10) === 0);
  pruefe('Trocken weit weg', feld.tiefeAn(400, 400) === 0);

  // Der eigentliche Punkt: Die nasse Zone ist 4 m breit, nicht 15,6.
  let nass = 0;
  for (let z = -20; z <= 20; z += 0.1) if (feld.tiefeAn(0, z) > 0) nass += 0.1;
  pruefe('Nasse Breite ist die Linienbreite (4 m)', Math.abs(nass - 4) < 0.3,
         `${nass.toFixed(1)} m gemessen`);

  // Am Ufer flach, in der Mitte tief — keine Stufenkante.
  const mitte = feld.tiefeAn(0, 0), ufer = feld.tiefeAn(0, 1.9);
  pruefe('Ufer flacher als Mitte', ufer > 0 && ufer < mitte * 0.6,
         `Ufer ${ufer.toFixed(2)} m, Mitte ${mitte.toFixed(2)} m`);

  // Ein Graben ist flacher als ein Bach — sonst wäre die Art-Unterscheidung Deko.
  const graben = baueWasserfeld({
    bbox: [0, 0, 1, 1],
    linien: [{ art: 'ditch', breite: 2, punkte: [[0.5, 0.2], [0.5, 0.8]] }],
  } as unknown as Weltdaten, 1000, 1000);
  pruefe('Graben flacher als Bach', graben.tiefeAn(0, 0) < mitte,
         `${graben.tiefeAn(0, 0).toFixed(2)} m gegen ${mitte.toFixed(2)} m`);
}

// ---- Stehende Gewässer ----------------------------------------------------
//
// Der Fall, den der erste Anlauf komplett übersehen hat: Wasser liegt nicht nur
// in `welt.linien`, sondern auch als Polygon in `welt.flaechen`. Ohne diesen Teil
// gäbe es die elf Weiher der Region nach wie vor nicht — und die Aussage
// „Schwimmen hat hier keinen Ort" bliebe falsch, ohne dass es auffiele.
{
  // Ein quadratischer Weiher von 60 × 60 m in der Mitte einer 1000-m-Welt.
  const r = 0.03; // Grad; bei 1000 m Kantenlänge sind das 30 m
  const teich = baueWasserfeld({
    bbox: [0, 0, 1, 1],
    linien: [],
    flaechen: [{
      biom: 'wasser',
      punkte: [[0.5 - r, 0.5 - r], [0.5 - r, 0.5 + r], [0.5 + r, 0.5 + r], [0.5 + r, 0.5 - r]],
    }],
  } as unknown as Weltdaten, 1000, 1000);

  pruefe('Teich erkannt', teich.teiche.length === 1, `${teich.teiche.length}`);
  const mitte = teich.tiefeAn(0, 0);
  pruefe('Teichmitte ist schwimmtief', mitte > 2, `${mitte.toFixed(2)} m`);
  pruefe('Tiefer als jeder Bach', mitte > 0.85);
  pruefe('Außerhalb trocken', teich.tiefeAn(60, 0) === 0);
  // Am Ufer flach — sonst fällt man beim Hineingehen in ein Loch.
  const ufer = teich.tiefeAn(28, 0);
  pruefe('Uferzone flach', ufer > 0 && ufer < mitte * 0.7, `${ufer.toFixed(2)} m`);
  // Ein Polygon mit zu wenigen Punkten ist kein Weiher, sondern ein Datenfehler.
  const kaputt = baueWasserfeld({
    bbox: [0, 0, 1, 1], linien: [],
    flaechen: [{ biom: 'wasser', punkte: [[0.5, 0.5], [0.5, 0.6]] }],
  } as unknown as Weltdaten, 1000, 1000);
  pruefe('Entartetes Polygon wird verworfen', kaputt.teiche.length === 0);
}

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if (fehler > 0) process.exit(1);
