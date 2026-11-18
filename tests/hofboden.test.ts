/** D307: Bodenmaske verlässt das tatsächlich geprüfte freie Türvorfeld nicht. */
import { hofbodenRand, hofbodenZugang, hofgrasFrei, rastereHofgras, HOF_ZUGANG_MAX } from '../src/world/hofboden.js';
import type { HofbodenZugang } from '../src/world/hofboden.js';

let ok = 0, fehler = 0;
function pruefe(name: string, gut: boolean) {
  console.log(`  ${gut ? '✓' : '✗'} ${name}`);
  gut ? ok++ : fehler++;
}
const haus: HofbodenZugang = { eingang: [0, 0], vorne: [0, 1] };
pruefe('Leere Auswahl erzeugt keine Eintrittsfläche', hofbodenZugang(0, .7, []) === 0);
pruefe('Versperrte Tür erzeugt keine Eintrittsfläche', hofbodenZugang(0, .7, [{ eingang: null, vorne: [0, 1] }]) === 0);
pruefe('Mitte des freien Vorfelds ist vollständig abgetreten', hofbodenZugang(0, .7, [haus]) === 1);
pruefe('Hinter der Tür und hinter dem Vorfeld endet die Maske', hofbodenZugang(0, 0, [haus]) === 0 && hofbodenZugang(0, 1.7, [haus]) === 0);
pruefe('Seitlich neben dem geprüften Vorfeld endet die Maske', hofbodenZugang(.726, .8, [haus]) === 0 && hofbodenZugang(-.726, .8, [haus]) === 0);
pruefe('10cm Anfangs- und Endrampe sind weich', hofbodenZugang(0, .075, [haus]) > .49 && hofbodenZugang(0, .075, [haus]) < .51
  && hofbodenZugang(0, 1.6, [haus]) > .49 && hofbodenZugang(0, 1.6, [haus]) < .51);
let begrenzt = true, freiesVorfeld = true, randBegrenzt = true, verschieden = false;
for (let ix = -110; ix <= 110; ix++) for (let iz = -20; iz <= 185; iz++) {
  const u = ix / 100, v = iz / 100, k = hofbodenZugang(u, v, [haus]);
  begrenzt &&= Number.isFinite(k) && k >= 0 && k <= 1;
  if (k > 0) freiesVorfeld &&= Math.abs(u) < .725 && v > .025 && v < 1.65;
  const r = hofbodenRand(u * 23, v * 17);
  randBegrenzt &&= Number.isFinite(r) && Math.abs(r) <= .7;
  verschieden ||= Math.abs(r - hofbodenRand(u * 23 + 1, v * 17)) > .15;
}
pruefe('Dichte Rasterprobe: Anteile bleiben zwischen null und eins', begrenzt);
pruefe('Dichte Rasterprobe: jeder positive Anteil bleibt im freien D304-Rechteck', freiesVorfeld);
pruefe('Hofrand bleibt innerhalb ±0,7m und variiert örtlich', randBegrenzt && verschieden);
const winkel = .73, c = Math.cos(winkel), s = Math.sin(winkel);
const gedreht: HofbodenZugang = { eingang: [1437.578, 431.053], vorne: [-s, c] };
let lagegleich = true;
for (const u of [-.8, -.6, -.1, .1, .6, .8]) for (const v of [-.1, .05, .075, .4, .9, 1.6, 1.7]) {
  const x = gedreht.eingang[0] + c * u - s * v, z = gedreht.eingang[1] + s * u + c * v;
  lagegleich &&= Math.abs(hofbodenZugang(x, z, [gedreht]) - hofbodenZugang(u, v, [haus])) < 1e-10;
}
pruefe('Drehung und Weltversatz erhalten dieselbe lokale Abnutzung', lagegleich);
const zweite: HofbodenZugang = { eingang: [20, 20], vorne: [1, 0] };
pruefe('Getrennte Türen erzeugen getrennte Masken ohne Verbindungslinie', hofbodenZugang(20.7, 20, [haus, zweite]) === 1
  && hofbodenZugang(10, 10, [haus, zweite]) === 0);
const vorher = JSON.stringify([haus, gedreht, zweite]);
const zahl = hofbodenZugang(.6, .5, [haus, gedreht, zweite]);
pruefe('Determinismus ohne Änderung der Eingabedaten', zahl === hofbodenZugang(.6, .5, [haus, gedreht, zweite]) && vorher === JSON.stringify([haus, gedreht, zweite]));
pruefe('Nichtendliche Abfrage erzeugt keine NaN-Uniformfolge', hofbodenZugang(NaN, 0, [haus]) === 0 && hofbodenRand(Infinity, 0) === 0);
const voll = Array.from({ length: HOF_ZUGANG_MAX }, () => zweite);
pruefe('CPU respektiert acht gepackte GLSL-Slots', hofbodenZugang(0, .7, [...voll, haus]) === 0);
pruefe('Null-Türen verbrauchen keinen gepackten GLSL-Slot', hofbodenZugang(0, .7, [{ eingang: null, vorne: [0, 1] }, ...voll.slice(1), haus]) === 1);
// Der gefährliche Wurzelort liegt außerhalb der Platte, der Halm ragt aber hinein.
const grasslot = [{ x: gedreht.eingang[0], y: gedreht.eingang[1], z: -s, w: c }];
const grasFrei = (u: number, v: number) => hofgrasFrei(
  gedreht.eingang[0] + c * u - s * v, gedreht.eingang[1] + s * u + c * v, grasslot, 1);
pruefe('Gras bleibt seitlich und vor beiden Trittplatten auch außerhalb der Steinkanten frei',
  !grasFrei(.9, .76) && !grasFrei(-.9, 1.30) && !grasFrei(0, 1.95));
pruefe('Nachbarwiese außerhalb des Sicherheitsabstands behält ihre Wurzeln',
  grasFrei(1.25, .76) && grasFrei(0, 2.25));
pruefe('Ohne bestätigten Eingang bleibt das Gras frei verteilt', hofgrasFrei(0, 0, [], 0));
const raster = rastereHofgras([1433, 434], [gedreht]);
const [x0, z0, sx, sz] = raster.rahmen;
const rasterWert = (x: number, z: number) => {
  const u = (x - x0) * sx * raster.breite - .5;
  const v = (z - z0) * sz * raster.breite - .5;
  const j = Math.floor(u), i = Math.floor(v);
  const a = u - j, b = v - i;
  const oben = i * raster.breite + j, unten = oben + raster.breite;
  return (1 - b) * ((1 - a) * raster.daten[oben] + a * raster.daten[oben + 1])
    + b * ((1 - a) * raster.daten[unten] + a * raster.daten[unten + 1]);
};
let rasterFrei = true;
for (let i = -60; i <= 120; i++) for (let j = -65; j <= 65; j++) {
  const u = j * .02, v = i * .02;
  const x = gedreht.eingang[0] + c * u - s * v, z = gedreht.eingang[1] + s * u + c * v;
  if (!grasFrei(u, v)) rasterFrei &&= rasterWert(x, z) === 0;
}
pruefe('Bilineares Raster lässt keinen Halm in den analytisch geschützten Bereich', rasterFrei);
pruefe('Raster lässt Grün vier Meter neben der Tür unverändert',
  rasterWert(gedreht.eingang[0] + 4, gedreht.eingang[1]) === 255);
console.log(`\nHofboden: ${ok} bestanden, ${fehler} Fehler.`);
if (fehler) process.exit(1);
