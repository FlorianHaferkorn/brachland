/**
 * D387 („Putzkorn“): Die Wandnormale des Hausmaterials darf nicht aus Bildschirm-Ableitungen der Weltlage kommen.
 *
 * `vHausPos` ist eine 32-Bit-Zahl in Weltmetern (Brachland: x um 1400 → Auflösung 0,12 mm). Die Ableitung über
 * ein Pixel ist die Differenz zweier solcher Zahlen; bei wenigen Millimetern Pixelgrösse trägt sie Prozent Fehler.
 * Die Normale daraus kippt je 2 × 2-Pixelblock um Bruchteile eines Grads — und weil die Wandkoordinate
 * `dot(vHausPos, T)` die **absolute** Lage mit dieser Tangente verrechnet, wird aus dem Kippen ein Sprung von
 * Metern: Scan, Fleckenrauschen und Efeumaske lesen in jedem Block eine andere Stelle. Das ist das Pixelkorn.
 * Hier nachgerechnet (`Math.fround` = Genauigkeit der GPU) und gegen Rückfall gesichert.
 */
import { readFileSync } from 'node:fs';

let ok = 0, fehler = 0;
function pruefe(name: string, gut: boolean, info = '') {
  console.log('  ' + (gut ? '✓' : '✗') + ' ' + name + ' ' + info); gut ? ok++ : fehler++;
}

type V = [number, number, number];
const f = Math.fround;
const kreuz = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
const punkt = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Wand durch `ursprung`, waagerechte Richtung `t` (Einheitsvektor in xz). Lage bei Wandkoordinaten (u, v), 32 Bit. */
const lage = (ursprung: V, t: V, u: number, v: number): V =>
  [f(ursprung[0] + t[0] * u), f(ursprung[1] + v), f(ursprung[2] + t[2] * u)];

/**
 * Streuung der Wandkoordinate u (Meter) über viele Pixelblöcke, wenn die Tangente aus Ableitungen der 32-Bit-Lage
 * gebildet wird wie bis D386 im Shader: N = normalize(cross(dFdx P, dFdy P)), T = normalize(cross(hoch, N)).
 */
function streuung(pixel: number): number {
  const ursprung: V = [1386.4, 37.9, 450.8], winkel = 0.37;
  const t: V = [Math.cos(winkel), 0, Math.sin(winkel)];
  let groesste = 0;
  for (let i = 0; i < 400; i++) {
    const u = i * pixel * 2.37, v = (i % 17) * pixel * 1.91;
    const p = lage(ursprung, t, u, v), px = lage(ursprung, t, u + pixel, v), py = lage(ursprung, t, u, v + pixel);
    const dx: V = [f(px[0] - p[0]), f(px[1] - p[1]), f(px[2] - p[2])];
    const dy: V = [f(py[0] - p[0]), f(py[1] - p[1]), f(py[2] - p[2])];
    const n = norm(kreuz(dx, dy));
    const tt = norm(kreuz([0, 1, 0], n));
    // Vorzeichen der Tangente ist für die Streuung gleichgültig.
    const uGemessen = Math.abs(punkt(p, tt)), uWahr = Math.abs(punkt(p, t));
    groesste = Math.max(groesste, Math.abs(uGemessen - uWahr));
  }
  return groesste;
}

/** Pixelgrösse auf einer frontal gesehenen Wand: 55° Bildwinkel senkrecht, 1080 Bildzeilen. */
const pixel = (abstand: number) => 2 * abstand * Math.tan(55 / 2 * Math.PI / 180) / 1080;

console.log('Sprung der Wandkoordinate bei Normale aus Ableitungen (1080 Zeilen)');
for (const d of [2, 10, 40]) {
  console.log(`    ${d} m: Pixel ${(pixel(d) * 1000).toFixed(1)} mm, Sprung bis ${streuung(pixel(d)).toFixed(2)} m`);
}
pruefe('2 m: Sprung über eine ganze Scan-Kachel (1 m)', streuung(pixel(2)) > 1);
pruefe('10 m: Sprung von Dezimetern (Blätter, Fugen, Flecken verrutschen)', streuung(pixel(10)) > 0.3);
pruefe('40 m: immer noch mehrere Zentimeter, mehr als ein Pixel', streuung(pixel(40)) > 0.05 && streuung(pixel(40)) > pixel(40));

console.log('Rückfallsperre');
const haus = readFileSync(new URL('../src/world/hausmaterial.ts', import.meta.url), 'utf8');
const pom = readFileSync(new URL('../src/world/hauspom.ts', import.meta.url), 'utf8');
pruefe('hausmaterial.ts: Wandnormale aus dem Eckenattribut', haus.includes('scanN = normalize(vHausNormal);'));
pruefe('hausmaterial.ts: keine Normale aus dFdx der Weltlage', !/cross\(dFdx\((vHausPos|hausPosRoh\(\))\)/.test(haus));
pruefe('hauspom.ts: keine Normale aus dFdx der Weltlage', !/normalize\(cross\(pomDx, pomDy\)\)/.test(pom));
// Je Dreieck konstante Kennzahlen kommen interpoliert an (2.0 → 1.9999999) und müssen vor Schwellen gerundet werden.
pruefe('hausmaterial.ts: Flächenart gerundet', haus.includes('floor(vRaumUv.z + .5)') && !/vRaumUv\.z\s*(>=|>|<)/.test(haus));
// Feines Verfallsrauschen (ab 4 Zellen je Meter) läuft über die bandbegrenzte Fassung.
const fein = [...haus.matchAll(/verfallFein\([^;]*?, ([\d.]+)\)/g)].map(m => Number(m[1]));
pruefe('hausmaterial.ts: feines Verfallsrauschen bandbegrenzt', fein.length >= 15 && fein.every(d => d >= 4), `${fein.length} Stellen`);
pruefe('hausmaterial.ts: Pixelgrösse aus der unverschobenen Sichtlage', haus.includes('verfallPixel = max(length(dFdx(vViewPosition)), length(dFdy(vViewPosition)));'));

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if (fehler) process.exit(1);
