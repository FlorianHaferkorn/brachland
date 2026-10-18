/**
 * Tests für die Weltpipeline (G-143): Multipolygon-Relationen und das Biom `moor`.
 *
 * Geprüft wird, was beim Weltbau still schiefgehen kann: ein Ring, der aus verkehrt herum
 * gezeichneten Teilstücken nicht zusammenfindet, ein Loch, das als Fläche zählt, und eine
 * Weltdatei, die nach dem elften Biom nicht mehr lesbar ist.
 */
import { relationsFlaechen, bestimmeBiom, packeWelt, entpackeWelt, baueWelt, BIOME, type Weltdaten } from '../src/world/osm.js';

let pass = 0, fail = 0;
const pruefe = (name: string, ist: boolean, detail = '') => {
  console.log(`  ${ist ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
  ist ? pass++ : fail++;
};
const p = (lat: number, lon: number) => ({ lat, lon });

console.log('\nRelationen');
{
  // Ein Quadrat aus drei Ways, das mittlere verkehrt herum gezeichnet.
  const ringe = relationsFlaechen([
    { role: 'outer', geometry: [p(0, 0), p(0, 1)] },
    { role: 'outer', geometry: [p(1, 1), p(0, 1)] },
    { role: 'outer', geometry: [p(1, 1), p(1, 0), p(0, 0)] },
  ]);
  const r = ringe[0]?.aussen;
  pruefe('Ring aus Teilstücken, eines verkehrt herum', ringe.length === 1 && r.length === 5, `${ringe.length} Ringe`);
  pruefe('Ring ist geschlossen', r?.[0].lat === r?.at(-1)!.lat && r?.[0].lon === r?.at(-1)!.lon);
}
{
  const ringe = relationsFlaechen([
    { role: 'outer', geometry: [p(0, 0), p(0, 4), p(4, 4), p(4, 0), p(0, 0)] },
    { role: 'inner', geometry: [p(1, 1), p(1, 2), p(2, 2), p(1, 1)] },
    { role: 'outer', geometry: [p(10, 10), p(10, 11), p(11, 11), p(10, 10)] },
  ]);
  const gross = ringe.find(f => f.aussen.length === 5);
  pruefe('Innerer Ring ist ein Loch, keine eigene Fläche', ringe.length === 2 && gross?.loecher.length === 1);
  pruefe('Loch hängt am Ring, der es enthält', ringe.find(f => f.aussen.length === 4)?.loecher.length === 0);
}
{
  // Wald mit ausgespartem Moor: Die Zelle im Loch darf nicht Wald werden (Kollerfilze, G-143).
  const n = 5, ll = (a: number, b: number) => [a, b] as [number, number];
  const welt = baueWelt([0, 0, 4, 4], [
    { id: -1, tags: { landuse: 'forest' }, geometry: [p(-1, -1), p(-1, 5), p(5, 5), p(5, -1), p(-1, -1)],
      loecher: [[p(1.5, 1.5), p(1.5, 2.5), p(2.5, 2.5), p(2.5, 1.5), p(1.5, 1.5)]] },
  ], Array.from({ length: n }, () => Array(n).fill(500)));
  pruefe('Zelle im Loch ist nicht Wald', welt.biome[2][2] !== 'wald', welt.biome[2][2]);
  pruefe('Zelle daneben ist Wald', welt.biome[0][0] === 'wald');
  pruefe('Loch steht in der Weltdatei', JSON.stringify(welt.flaechen[0].loecher?.[0][0]) === JSON.stringify(ll(1.5, 1.5)));
}
pruefe('Offener Rest wird verworfen', relationsFlaechen([{ role: 'outer', geometry: [p(0, 0), p(0, 1), p(1, 1)] }]).length === 0);
pruefe('Mitglied ohne Geometrie stört nicht', relationsFlaechen([{ role: 'outer' }]).length === 0);

console.log('\nMoor');
pruefe('natural=wetland ist Moor, kein Gewässer', bestimmeBiom({ natural: 'wetland', wetland: 'bog' }) === 'moor');
pruefe('natural=water bleibt Gewässer', bestimmeBiom({ natural: 'water' }) === 'wasser');
pruefe('Moor hängt hinten an — alte Codes bleiben', BIOME.indexOf('moor') === 10 && BIOME.indexOf('unbekannt') === 9);
{
  const n = 3;
  const biome = [['wiese', 'moor', 'wald'], ['moor', 'wasser', 'unbekannt'], ['fels', 'moor', 'siedlung']] as Weltdaten['biome'];
  const welt: Weltdaten = {
    bbox: [0, 0, 1, 1], aufloesung: n, hoehen: [[1, 2, 3], [4, 5, 6], [7, 8, 9]], hoeheMin: 1, hoeheMax: 9,
    biome, flaechen: [], linien: [], gebaeude: [], wege: [], marker: [], attribution: '',
  };
  const g = packeWelt(welt);
  pruefe('Ein Zeichen je Zelle, auch mit Moor', g.biomeStr.length === n * n, g.biomeStr);
  pruefe('Packen und Entpacken verlustfrei', JSON.stringify(entpackeWelt(g).biome) === JSON.stringify(biome));
  // Eine Weltdatei von vor G-143: Ziffern 0–9 lesen sich wie bisher.
  const alt = entpackeWelt({ ...g, biomeStr: '359150680' });
  pruefe('Alte Weltdatei liest sich unverändert', alt.biome.flat().join() === 'wiese,wasser,unbekannt,wald,wasser,fels,siedlung,ruine,fels');
}

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
if (fail) process.exit(1);
