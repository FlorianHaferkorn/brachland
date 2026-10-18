/**
 * Tests für die Regionswahl (ADR-0014): eine Karte je Region, Übergang an der Kante.
 *
 * Geprüft wird, was beim Hinübergehen schiefgehen kann: die falsche Kante, ein Schalter in der
 * Adresse, der verloren geht, und eine Ankunft auf der falschen Seite der neuen Karte.
 */
import { readFileSync } from 'node:fs';
import { Region } from '../src/data/schema.js';
import { START_REGION, AKTIVE_REGION, regionAusSuche, randSeite, nachbarAn, adresseFuer, ankunft,
         inRegion, ANKUNFT_ABSTAND } from '../src/spiel/region.js';
import { BAUWERKE, SZENEN_STAEMME } from '../src/world/bauwerke.js';

let pass = 0, fail = 0;
const pruefe = (name: string, ist: boolean, detail = '') => {
  console.log(`  ${ist ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
  ist ? pass++ : fail++;
};
const lies = (id: string) => Region.parse(JSON.parse(readFileSync(new URL(`../content/regions/${id}.json`, import.meta.url), 'utf8')));
const oental = lies('oental'), fahlmoos = lies('fahlmoos');

console.log('\n1. Adresse\n');
pruefe('ohne Angabe das Œntal', regionAusSuche('') === 'oental' && regionAusSuche('?weite=1.6') === 'oental');
pruefe('?region=fahlmoos', regionAusSuche('?region=fahlmoos') === 'fahlmoos');
pruefe('Grossschreibung egal', regionAusSuche('?region=Fahlmoos') === 'fahlmoos');
pruefe('ausserhalb des Browsers das Œntal', AKTIVE_REGION === START_REGION);
pruefe('Hinüber behält die anderen Schalter', adresseFuer('fahlmoos', '?weite=1.6') === '?weite=1.6&region=fahlmoos',
  adresseFuer('fahlmoos', '?weite=1.6'));
pruefe('Zurück ins Œntal nimmt den Schalter heraus', adresseFuer('oental', '?region=fahlmoos') === '');

console.log('\n2. Kante\n');
pruefe('innen keine Kante', randSeite(10, 10, 100, 100) === null);
pruefe('z negativ ist Nord', randSeite(0, -101, 100, 100) === 'nord');
pruefe('z positiv ist Süd', randSeite(0, 101, 100, 100) === 'sued');
pruefe('x positiv ist Ost', randSeite(101, 0, 100, 100) === 'ost');
pruefe('Ecke: die weiter überschrittene Seite', randSeite(101, -105, 100, 100) === 'nord' && randSeite(105, -101, 100, 100) === 'ost');
pruefe('Œntal: im Norden das Fahlmoos', nachbarAn(oental, 'nord') === 'fahlmoos');
pruefe('Œntal: im Westen nichts', nachbarAn(oental, 'west') === null && nachbarAn(oental, null) === null);
pruefe('Fahlmoos: im Süden zurück', nachbarAn(fahlmoos, 'sued') === 'oental');

console.log('\n3. Ankunft\n');
{
  const [x, z] = ankunft(fahlmoos, 'oental', 4000, 4000);
  pruefe('aus dem Œntal am Südrand des Fahlmooses', x === 0 && z === 2000 - ANKUNFT_ABSTAND, `(${x}, ${z})`);
  const [x2, z2] = ankunft(oental, 'fahlmoos', 4000, 4000);
  pruefe('aus dem Fahlmoos am Nordrand des Œntals', x2 === 0 && z2 === -(2000 - ANKUNFT_ABSTAND), `(${x2}, ${z2})`);
  pruefe('unbekannte Herkunft: Mitte', ankunft(oental, 'nirgends', 4000, 4000).every(v => v === 0));
  pruefe('Ankunft liegt innerhalb der Klemmung (Rand 1,5 m)', ANKUNFT_ABSTAND > 1.5);
}

console.log('\n4. Was in einer Region liegt\n');
{
  const dinge = [{ id: 'a', region: 'oental' }, { id: 'b', region: 'fahlmoos' }];
  pruefe('inRegion filtert', inRegion(dinge, 'fahlmoos').map(d => d.id).join() === 'b');
  // Ohne Adresse (hier) ist es das Œntal: Stauwehr und Felsmulde bleiben, wie sie waren.
  pruefe('Œntal behält seine Blender-Szenen', BAUWERKE.length === 2 && BAUWERKE.every(b => b.region === 'oental'));
  pruefe('und ihre Stämme', SZENEN_STAEMME.length > 0);
}

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen\n`);
process.exit(fail ? 1 : 0);
