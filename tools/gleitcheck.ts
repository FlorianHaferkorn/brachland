/**
 * Hat das Oental überhaupt etwas zu vergleiten?
 *
 * Gleiten ist als Antwort auf ein gemessenes Problem geplant (Ledger G-44): Die
 * Region ist knapp 4 km breit, und selbst im Rennen ist die Diagonale reine
 * Wartezeit. Eine Gleitmechanik verspricht, diese Zeit gegen Höhe einzutauschen —
 * aber nur, wenn es Höhe zu tauschen gibt und Kanten, von denen aus getauscht
 * werden kann. Beides steht nicht in der Mechanik, sondern im Gelände.
 *
 * Die eigentliche offene Frage ist das Gleitverhältnis. 2:1, 3:1 oder 4:1 ist
 * keine Gefühlsfrage: Jede Zahl bedeutet eine Reichweite, und ob diese Reichweite
 * hier trägt, entscheidet allein das Höhenfeld. Ein Verhältnis, das über dem
 * Oental in halber Höhe schon aufsetzt, ist ein leeres Versprechen; eines, das
 * die halbe Region überfliegt, macht den Rest der Karte zur Kulisse.
 *
 * Wie bei der Steigungsgrenze (`tools/steigungcheck.ts`) braucht das keinen
 * Renderer — es ist Geometrie auf derselben Fläche, auf der die Figur steht:
 * `hoeheAufFlaeche`, die gezeichnete Oberfläche, nicht die stetige Funktion.
 *
 * Vier Fragen:
 *   1. Wie viel Höhe liegt überhaupt über dem tiefsten Punkt?
 *   2. Wie viele Absprungkanten gibt es, und wo liegen sie?
 *   3. Wie weit trägt ein Flug tatsächlich, bis er aufsetzt?
 *   4. Ist das schneller als zu Fuß — und um wie viel?
 *
 * `npx tsx tools/gleitcheck.ts`
 */
import { readFileSync } from 'node:fs';
import { entpackeWelt } from '../src/world/osm.js';
import { baueHoehenfeld, hoeheAufFlaeche } from '../src/world/lod.js';

/** Aus `RegionsSzene.tsx` — bewusst hier gespiegelt, weil das Modul React lädt. */
const SCHWERKRAFT = 9.81;
const ABSPRUNG = 5.4;
const RENNEN = 11.0;
const GEHEN_MAX_GRAD = 40;
/** Scheitelhöhe des Absprungs: v²/2g. Von dort beginnt der Flug. */
const SPRUNGSCHEITEL = (ABSPRUNG * ABSPRUNG) / (2 * SCHWERKRAFT);

// ---- Annahmen dieser Messung (keine Konstanten aus dem Repo) --------------
/** Sinkrate im Gleitflug, konstant. Vorgabe für diese Messung. */
const SINKRATE = 4.0;
/** Horizontal:vertikal. Ein 3:1-Gleiter kommt aus 100 m 300 m weit. */
const VERHAELTNISSE = [2, 3, 4] as const;
/** Renntempo für den Fußweg-Vergleich. Vorgabe; im Repo steht RENNEN = 11,0. */
const RENNTEMPO = 7.0;
/** Der Fußweg ist keine Gerade — Luftlinie mal Umwegfaktor. */
const UMWEG = 1.4;

// ---- Rasterweiten ---------------------------------------------------------
/** Prüfraster über die Region. 320² = 102.400 Punkte, Abstand ~12 m. */
const RASTER = 320;
/** Eine Kante: innerhalb dieser Distanz fällt das Gelände ab. */
const KANTE_WEITE = 20;
/** ... und zwar um mehr als so viel. */
const KANTE_ABFALL = 15;
/** Schrittweite der Flugsimulation. */
const FLUG_SCHRITT = 5;
/** So viele Absprungstellen werden beflogen. */
const STICHPROBE = 400;
/** Notbremse: kein Flug ist länger als die Region breit ist. */
const FLUG_MAX = 6000;

const t0 = Date.now();
const roh = JSON.parse(readFileSync('public/world/oental.json', 'utf8'));
const welt = entpackeWelt(roh.welt);
const feld = baueHoehenfeld(welt);
const hoehe = (x: number, z: number) => hoeheAufFlaeche(feld, x, z);

const [SUED, WEST, NORD, OST] = welt.bbox;
const halbB = feld.breiteMeter / 2 - 20, halbT = feld.tiefeMeter / 2 - 20;
const flaecheKm2 = (feld.breiteMeter * feld.tiefeMeter) / 1e6;

/** Weltmeter → Grad. X = Ost, Z = Süd; i = 0 des DEM liegt im Norden. */
const zuLatLon = (x: number, z: number): [number, number] => [
  NORD - (z / feld.tiefeMeter + 0.5) * (NORD - SUED),
  WEST + (x / feld.breiteMeter + 0.5) * (OST - WEST),
];

const HIMMEL = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'] as const;
/** N = -Z, O = +X, im Uhrzeigersinn. */
const RICHTUNGEN = HIMMEL.map((_, i) => {
  const w = (i / 8) * Math.PI * 2;
  return [Math.sin(w), -Math.cos(w)] as const;
});

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : NaN;
};
const mittel = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
const m = (v: number) => `${v.toFixed(0)} m`;

console.log('Gleiten über dem Oental — was das Gelände hergibt\n');
console.log(`  Region                 ${feld.breiteMeter.toFixed(0)} × ${feld.tiefeMeter.toFixed(0)} m  (${flaecheKm2.toFixed(2)} km²)`);
console.log(`  DEM-Auflösung          ${welt.aufloesung}²  ·  real ${welt.hoeheMin.toFixed(0)}–${welt.hoeheMax.toFixed(0)} m ü. NN`);
console.log(`  Überhöhung 1,15 — alle Höhen unten in SPIELMETERN über dem tiefsten Punkt.`);
console.log(`  Aus RegionsSzene.tsx: Schwerkraft ${SCHWERKRAFT} m/s², Absprung ${ABSPRUNG} m/s`);
console.log(`  (= ${SPRUNGSCHEITEL.toFixed(2)} m Scheitel), Rennen ${RENNEN} m/s, Gehgrenze ${GEHEN_MAX_GRAD}°.`);
console.log(`  Annahmen: Sinkrate ${SINKRATE.toFixed(1)} m/s, Renntempo ${RENNTEMPO.toFixed(1)} m/s, Umweg ×${UMWEG}.\n`);

// ---- 1./2. Ein Durchgang übers Raster: Höhen UND Kanten -------------------
//
// Beides aus derselben Schleife, weil die Kantenprüfung die Höhe am Standort
// ohnehin braucht. Eine Kante ist ein Punkt, an dem das Gelände innerhalb von
// KANTE_WEITE in irgendeiner der acht Richtungen um mehr als KANTE_ABFALL
// abfällt — weniger ist ein Hang, den man auch hinunterläuft.
interface Kante { x: number; z: number; h: number; abfall: number }
const kanten: Kante[] = [];
const hoehen: number[] = [];

for (let i = 0; i < RASTER; i++) {
  const x = -halbB + (2 * halbB * i) / (RASTER - 1);
  for (let j = 0; j < RASTER; j++) {
    const z = -halbT + (2 * halbT * j) / (RASTER - 1);
    const h = hoehe(x, z);
    hoehen.push(h);
    let tiefster = h;
    for (const [dx, dz] of RICHTUNGEN) {
      const hv = hoehe(x + dx * KANTE_WEITE, z + dz * KANTE_WEITE);
      if (hv < tiefster) tiefster = hv;
    }
    if (h - tiefster > KANTE_ABFALL) kanten.push({ x, z, h, abfall: h - tiefster });
  }
}

const hMin = Math.min(...hoehen), hMax = Math.max(...hoehen);
const ueber = (g: number) => hoehen.filter(h => h - hMin > g).length;
const proz = (k: number, n: number) => `${((100 * k) / n).toFixed(1)} %`;

console.log('1. Höhenvorrat');
console.log(`   Prüfpunkte                      ${hoehen.length.toLocaleString('de')}  (${RASTER}², Abstand ${((2 * halbB) / (RASTER - 1)).toFixed(1)} m)`);
console.log(`   Minimum / Median / Maximum      ${m(hMin)} / ${m(median(hoehen))} / ${m(hMax)}`);
for (const g of [100, 200, 300, 400])
  console.log(`   Fläche über +${String(g).padStart(3)} m                ${proz(ueber(g), hoehen.length).padStart(7)}`);
console.log('');

console.log(`2. Absprungkanten (> ${KANTE_ABFALL} m Abfall innerhalb ${KANTE_WEITE} m)`);
console.log(`   gefunden                        ${kanten.length.toLocaleString('de').padStart(7)}  (${proz(kanten.length, hoehen.length)} der Fläche)`);
console.log(`   je km²                          ${(kanten.length / flaecheKm2).toFixed(0).padStart(7)}`);
console.log(`   Abfall Median / Maximum         ${m(median(kanten.map(k => k.abfall)))} / ${m(Math.max(...kanten.map(k => k.abfall)))}`);
console.log('   Verteilung über die Höhe:');
for (let g = 0; g < 800; g += 100) {
  const inBand = kanten.filter(k => k.h - hMin >= g && k.h - hMin < g + 100).length;
  const flaeche = hoehen.filter(h => h - hMin >= g && h - hMin < g + 100).length;
  if (!flaeche) continue;
  console.log(`     +${String(g).padStart(3)}–${String(g + 100).padStart(3)} m   ${String(inBand).padStart(6)} Kanten` +
              `  ·  ${proz(inBand, flaeche).padStart(7)} dieses Höhenbands`);
}
console.log('');

// ---- 3. Der Flug ----------------------------------------------------------
//
// Modell: feste Sinkrate, feste Vorwärtsgeschwindigkeit = Verhältnis × Sinkrate.
// Der Flug beginnt am Sprungscheitel über der Kante und endet, sobald die
// Flughöhe die Geländehöhe erreicht. Kein Auftrieb, kein Wind, keine Steuerung
// in der Luft — die untere Schranke dessen, was eine Mechanik leisten würde.
interface Flug { weite: number; abstieg: number; amRand: boolean }

function gleite(x0: number, z0: number, dx: number, dz: number, verhaeltnis: number): Flug {
  const start = hoehe(x0, z0) + SPRUNGSCHEITEL;
  let x = x0, z = z0, y = start, weite = 0;
  while (weite < FLUG_MAX) {
    x += dx * FLUG_SCHRITT;
    z += dz * FLUG_SCHRITT;
    y -= FLUG_SCHRITT / verhaeltnis;
    weite += FLUG_SCHRITT;
    if (Math.abs(x) > halbB || Math.abs(z) > halbT)
      return { weite, abstieg: start - y, amRand: true };
    if (y <= hoehe(x, z)) return { weite, abstieg: start - y, amRand: false };
  }
  return { weite, abstieg: start - y, amRand: true };
}

/** Gleichmäßige Stichprobe über die Kantenliste — kein Zufall, damit der Lauf
 *  wiederholbar ist und nicht zufällig ein Grat überrepräsentiert wird. */
const stichprobe: Kante[] = [];
for (let k = 0; k < Math.min(STICHPROBE, kanten.length); k++)
  stichprobe.push(kanten[Math.floor((k * kanten.length) / Math.min(STICHPROBE, kanten.length))]);

interface Beste { kante: Kante; weite: number; richtung: number; abstieg: number; amRand: boolean }
const alleWeiten = new Map<number, number[]>();
const besten = new Map<number, Beste[]>();
let randTreffer = 0, fluege = 0;

for (const v of VERHAELTNISSE) {
  const weiten: number[] = [];
  const best: Beste[] = [];
  for (const k of stichprobe) {
    let b: Beste = { kante: k, weite: -1, richtung: 0, abstieg: 0, amRand: false };
    for (let r = 0; r < 8; r++) {
      const f = gleite(k.x, k.z, RICHTUNGEN[r][0], RICHTUNGEN[r][1], v);
      fluege++;
      if (f.amRand) randTreffer++;
      weiten.push(f.weite);
      if (f.weite > b.weite)
        b = { kante: k, weite: f.weite, richtung: r, abstieg: f.abstieg, amRand: f.amRand };
    }
    best.push(b);
  }
  alleWeiten.set(v, weiten);
  besten.set(v, best);
}

console.log(`3. Gleitweiten  (${stichprobe.length} Absprungstellen × 8 Richtungen × ${VERHAELTNISSE.length} Verhältnisse` +
            ` = ${fluege.toLocaleString('de')} Flüge, Schritt ${FLUG_SCHRITT} m)`);
console.log('   Verh.   alle 8 Richtungen            beste Richtung je Stelle       Stellen mit Reichweite');
console.log('           Mittel  Median     Max       Mittel  Median     Max        >100 m   >250 m   >500 m');
for (const v of VERHAELTNISSE) {
  const w = alleWeiten.get(v)!, b = besten.get(v)!.map(x => x.weite);
  const zaehl = (g: number) => `${b.filter(x => x > g).length} (${((100 * b.filter(x => x > g).length) / b.length).toFixed(0)} %)`;
  console.log(`   ${v}:1  ${m(mittel(w)).padStart(8)}${m(median(w)).padStart(8)}${m(Math.max(...w)).padStart(9)} ` +
              `${m(mittel(b)).padStart(11)}${m(median(b)).padStart(8)}${m(Math.max(...b)).padStart(9)}   ` +
              `${zaehl(100).padStart(11)}${zaehl(250).padStart(11)}${zaehl(500).padStart(11)}`);
}
console.log(`   Am Regionsrand abgeschnitten: ${randTreffer} von ${fluege} Flügen` +
            ` (${proz(randTreffer, fluege)}) — diese Weiten sind untere Schranken.`);
console.log('');

// ---- 4. Gegen den Fußweg --------------------------------------------------
//
// Verglichen wird dieselbe Strecke: von der Absprungstelle zum Landepunkt der
// besten Richtung. Zu Fuß ist das die Luftlinie mal Umwegfaktor bei Renntempo,
// in der Luft der Abstieg geteilt durch die Sinkrate. Stellen ohne Flug
// (Weite 0, weil in jede Richtung Berg) fallen heraus — da gibt es nichts zu
// vergleichen.
console.log('4. Gleitflug gegen Fußweg  (gleiche Strecke, gleiche Richtung)');
console.log(`   Verh.   Vorwärtstempo   Flugzeit   Fußweg (${RENNTEMPO.toFixed(1)} m/s)   Ersparnis    schneller in`);
for (const v of VERHAELTNISSE) {
  const b = besten.get(v)!.filter(x => x.weite > 0);
  const flugZeit = b.map(x => x.abstieg / SINKRATE);
  const fussZeit = b.map(x => (x.weite * UMWEG) / RENNTEMPO);
  const spar = b.map((_, i) => fussZeit[i] - flugZeit[i]);
  const schneller = spar.filter(s => s > 0).length;
  console.log(`   ${v}:1   ${(v * SINKRATE).toFixed(1).padStart(9)} m/s ` +
              `${mittel(flugZeit).toFixed(1).padStart(9)} s ` +
              `${mittel(fussZeit).toFixed(1).padStart(13)} s ` +
              `${mittel(spar).toFixed(1).padStart(11)} s ` +
              `${`${((100 * schneller) / b.length).toFixed(0)} %`.padStart(13)}` +
              `  (n=${b.length})`);
}
// Gegenprobe mit dem Tempo, das wirklich im Code steht.
console.log(`   Gegenprobe mit RENNEN = ${RENNEN} m/s aus RegionsSzene.tsx:`);
for (const v of VERHAELTNISSE) {
  const b = besten.get(v)!.filter(x => x.weite > 0);
  const spar = b.map(x => (x.weite * UMWEG) / RENNEN - x.abstieg / SINKRATE);
  console.log(`   ${v}:1   Ersparnis ${mittel(spar).toFixed(1).padStart(6)} s` +
              `  ·  schneller in ${((100 * spar.filter(s => s > 0).length) / b.length).toFixed(0)} %`);
}
console.log('');

// ---- 5. Wo es sich lohnt --------------------------------------------------
console.log('5. Die drei weitesten Absprungstellen je Verhältnis');
for (const v of VERHAELTNISSE) {
  const top = [...besten.get(v)!].sort((a, b) => b.weite - a.weite).slice(0, 3);
  for (const [i, t] of top.entries()) {
    const [lat, lon] = zuLatLon(t.kante.x, t.kante.z);
    console.log(`   ${v}:1  #${i + 1}  ${String(Math.round(t.kante.x)).padStart(5)} / ${String(Math.round(t.kante.z)).padStart(5)} m` +
                `  ·  ${lat.toFixed(5)} / ${lon.toFixed(5)}` +
                `  ·  Höhe +${m(t.kante.h - hMin).padStart(5)}` +
                `  ·  ${m(t.weite).padStart(6)} nach ${HIMMEL[t.richtung].padEnd(2)}` +
                `${t.amRand ? '  (am Rand abgeschnitten)' : ''}`);
  }
}
console.log(`\n   Laufzeit ${((Date.now() - t0) / 1000).toFixed(1)} s`);
