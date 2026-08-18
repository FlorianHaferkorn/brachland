/**
 * Tests für die Siedlungsregel und die Prop-Verteilung.
 *
 * Beide Fehler, die hier abgesichert werden, waren nur im Bild sichtbar und in
 * keiner Zahl:
 *
 *   - **1.608 von 2.033 Gebäuden standen im Biom `wiese`** (G-81). Bayerische
 *     Dörfer tragen in OSM oft kein `landuse=residential`, also fiel die
 *     Rasterzelle auf die umgebende Wiese zurück — mit Wiesendichten im Dorf.
 *   - **2.416 Props standen in einem Grundriss**, darunter 124 Bäume (G-82). Die
 *     Verteilung kannte Gebäude nicht.
 *
 * Geprüft wird die Regel, nicht die Region: eine winzige Kunstwelt mit zwei
 * Häusern nebeneinander und einem allein auf der Wiese. Eine Prüfung gegen die
 * echte Weltdatei würde bestehen, solange die Datei alt ist, und wäre damit
 * genau die Art Kennzahl, die keinen Rückschritt zeigen kann.
 */
import { baueWelt, entpackeWelt, type Weltdaten } from '../src/world/osm.js';
import { baueTerrain } from '../src/world/terrain.js';
import { verteileProps } from '../src/world/props.js';

let ok = 0, fehler = 0;
function pruefe(was: string, bedingung: boolean, notiz = '') {
  console.log(`  ${bedingung ? '✓' : '✗'} ${was.padEnd(52)} ${notiz}`);
  bedingung ? ok++ : fehler++;
}

console.log('Siedlung und Props — zwei Fehler, die nur im Bild standen\n');

/**
 * Kunstwelt: 400 x 400 m, flache Wiese, drei Häuser.
 *
 * Zwei stehen 12 m auseinander (ein Weiler), das dritte 150 m entfernt allein
 * (eine Almhütte). Die Regel verlangt **zwei** Gebäude in 20 m — genau, damit
 * die Hütte Wiese bleibt.
 */
const MITTE_LAT = 47.73, MITTE_LON = 12.08;
const M_LAT = 1 / 111_320;
const M_LON = 1 / (111_320 * Math.cos(MITTE_LAT * Math.PI / 180));

/** Ein quadratischer Grundriss von `seite` Metern um einen Versatz in Metern. */
function haus(dNord: number, dOst: number, seite = 8) {
  const lat = MITTE_LAT + dNord * M_LAT, lon = MITTE_LON + dOst * M_LON;
  const h = (seite / 2) * M_LAT, b = (seite / 2) * M_LON;
  return {
    type: 'way', id: Math.round(Math.abs(dNord) * 1000 + Math.abs(dOst) * 7 + seite),
    tags: { building: 'yes' },
    geometry: [
      { lat: lat - h, lon: lon - b }, { lat: lat + h, lon: lon - b },
      { lat: lat + h, lon: lon + b }, { lat: lat - h, lon: lon + b },
      { lat: lat - h, lon: lon - b },
    ],
  };
}

const R = 200;
const bbox: [number, number, number, number] = [
  MITTE_LAT - R * M_LAT, MITTE_LON - R * M_LON,
  MITTE_LAT + R * M_LAT, MITTE_LON + R * M_LON,
];
const N = 64;
const hoehen = Array.from({ length: N }, () => Array.from({ length: N }, () => 600));

const roh = baueWelt(
  bbox,
  [
    // Wiese über die ganze Fläche, damit der Rückfall nicht mitspielt.
    {
      type: 'way', id: 1, tags: { landuse: 'meadow' },
      geometry: [
        { lat: bbox[0], lon: bbox[1] }, { lat: bbox[2], lon: bbox[1] },
        { lat: bbox[2], lon: bbox[3] }, { lat: bbox[0], lon: bbox[3] },
        { lat: bbox[0], lon: bbox[1] },
      ],
    },
    haus(0, 0), haus(0, 12), haus(-150, -150),
  ] as never[],
  hoehen,
);
const welt: Weltdaten = entpackeWelt(JSON.parse(JSON.stringify(roh)));
const t = baueTerrain(welt);

pruefe('Drei Grundrisse übernommen', welt.gebaeude.length === 3, `${welt.gebaeude.length}`);

/** Biom an einem Versatz in Metern von der Mitte. */
const biomBei = (dNord: number, dOst: number) => {
  const [x, z] = [dOst, -dNord];
  const [i, j] = t.weltZuRaster(x, z);
  return welt.biome[i][j];
};

pruefe('Zwischen zwei Häusern ist Siedlung', biomBei(0, 6) === 'siedlung', biomBei(0, 6));
pruefe('Am Weiler, 10 m daneben, auch', biomBei(10, 6) === 'siedlung', biomBei(10, 6));
pruefe('60 m vom Weiler ist wieder Wiese', biomBei(0, 70) === 'wiese', biomBei(0, 70));
pruefe('Die einzelne Hütte bleibt Wiese', biomBei(-150, -150) === 'wiese', biomBei(-150, -150));
pruefe('Und ihr Umfeld auch', biomBei(-150, -140) === 'wiese', biomBei(-150, -140));

const zellen = welt.biome.flat();
const siedlung = zellen.filter(b => b === 'siedlung').length;
pruefe('Siedlung bleibt eine kleine Insel', siedlung > 0 && siedlung < zellen.length * 0.1,
  `${siedlung} von ${zellen.length} Zellen`);

// ---------------------------------------------------------------- Props
const props = verteileProps(welt, t, 3);
const imPolygon = (x: number, z: number, p: [number, number][]) => {
  let drin = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) drin = !drin;
  }
  return drin;
};
const [sued, west, nord, ost] = welt.bbox;
const grundrisse = welt.gebaeude.map(g => g.punkte.map(([lat, lon]) => [
  ((lon - west) / (ost - west) - 0.5) * t.breiteMeter,
  ((nord - lat) / (nord - sued) - 0.5) * t.tiefeMeter,
] as [number, number]));

const drinnen = props.filter(p => grundrisse.some(g => imPolygon(p.position[0], p.position[2], g)));
pruefe('Props werden überhaupt verteilt', props.length > 50, `${props.length}`);
pruefe('Kein einziges steht in einem Grundriss', drinnen.length === 0,
  `${drinnen.length} von ${props.length}`);

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
process.exit(fehler ? 1 : 0);
