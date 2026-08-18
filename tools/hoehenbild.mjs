#!/usr/bin/env node
/**
 * BRACHLAND — Geländeauflösung als Bild
 *
 * `npm run hoehen` sagt „mittlere Stufe 3,08 m gegen 2,09 m". Das ist die richtige
 * Zahl, aber niemand sieht einer Zahl an, ob ein Hang terrassiert aussieht. Dieses
 * Werkzeug rendert dieselben Höhendaten als **Schummerung** (Hillshade) — dieselbe
 * Sonne, dieselbe Ausschnittsgröße, nur ein anderes Raster.
 *
 * Es ersetzt keinen Blick ins Spiel. Es zeigt, was das Raster hergibt, bevor
 * Material, Nebel und Licht darübergehen — und genau darum geht es beim Vergleich
 * zweier Rasterweiten.
 *
 * Aufruf: node hoehenbild.mjs <a.json> <b.json> <raus.png> [ausschnitt]
 *   Die JSON-Dateien sind gepackte Weltstände (public/world/*.json).
 *   `ausschnitt` ist der Anteil der Region, 0…1 — kleiner heißt näher dran.
 */
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const [, , A, B, RAUS, AUSSCHNITT = '0.25'] = process.argv;
if (!A || !B || !RAUS) {
  console.error('Aufruf: node hoehenbild.mjs <a.json> <b.json> <raus.png> [ausschnitt]');
  process.exit(1);
}
const anteil = Number(AUSSCHNITT);
const KANTE = 620;          // Pixel je Teilbild
const LUECKE = 16;

/** Höhenraster aus einem gepackten Weltstand holen. */
function hoehenfeld(pfad) {
  const w = JSON.parse(readFileSync(pfad, 'utf8')).welt;
  const n = w.aufloesung;
  const roh = Buffer.from(w.hoehenB64, 'base64');
  // uint16 in Dezimetern, wie `packeWelt` es schreibt.
  const h = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) h[i] = roh.readUInt16LE(i * 2) / 10;
  return { n, h, name: `${n}×${n}` };
}

/**
 * Schummerung. Sonne aus Nordwest, 35° über dem Horizont — der Standardwinkel
 * für Geländekarten, weil das Auge Erhebungen sonst als Mulden liest.
 */
function schummere({ n, h }, breiteMeter) {
  const zelle = breiteMeter / (n - 1);
  const px = new Uint8ClampedArray(KANTE * KANTE);
  // Ausschnitt aus der Mitte, damit beide Bilder dieselbe Landschaft zeigen.
  const spanne = Math.max(4, Math.round(n * anteil));
  const off = Math.round((n - spanne) / 2);
  const lx = -0.6, ly = 0.6, lz = 0.53;   // normierte Sonnenrichtung

  for (let y = 0; y < KANTE; y++) {
    for (let x = 0; x < KANTE; x++) {
      // Bilinear aus dem Raster lesen — sonst vergleicht man Skalierungsartefakte.
      const fi = off + (y / (KANTE - 1)) * (spanne - 1);
      const fj = off + (x / (KANTE - 1)) * (spanne - 1);
      const i0 = Math.min(n - 2, Math.floor(fi)), j0 = Math.min(n - 2, Math.floor(fj));
      const ti = fi - i0, tj = fj - j0;
      const at = (i, j) => h[Math.min(n - 1, i) * n + Math.min(n - 1, j)];
      const hh = (a, b, t) => a + (b - a) * t;
      const oben = hh(at(i0, j0), at(i0, j0 + 1), tj);
      const unten = hh(at(i0 + 1, j0), at(i0 + 1, j0 + 1), tj);
      const z = hh(oben, unten, ti);
      // Gradient aus den Nachbarn desselben Rasters — das ist der Punkt: Ein
      // grobes Raster hat große, flache Facetten, ein feines viele kleine.
      const dzdx = (at(i0, j0 + 1) - at(i0, j0)) / zelle;
      const dzdy = (at(i0 + 1, j0) - at(i0, j0)) / zelle;
      const len = Math.hypot(dzdx, dzdy, 1);
      const licht = Math.max(0, (-dzdx * lx + -dzdy * ly + lz) / len);
      // Höhe schwach mit einblenden, sonst sieht man nur Kanten und keine Form.
      px[y * KANTE + x] = 255 * (0.14 + 0.74 * licht + 0.12 * Math.min(1, (z - 440) / 700));
    }
  }
  return px;
}

const a = hoehenfeld(A), b = hoehenfeld(B);
console.log(`links  ${A}  ${a.name}`);
console.log(`rechts ${B}  ${b.name}`);

const BREITE = KANTE * 2 + LUECKE;
const gesamt = Buffer.alloc(BREITE * KANTE, 13);
for (const [bild, x0] of [[schummere(a, 3968), 0], [schummere(b, 3968), KANTE + LUECKE]]) {
  for (let y = 0; y < KANTE; y++)
    for (let x = 0; x < KANTE; x++) gesamt[y * BREITE + x0 + x] = bild[y * KANTE + x];
}

await sharp(gesamt, { raw: { width: BREITE, height: KANTE, channels: 1 } })
  .png().toFile(RAUS);
console.log(`${RAUS} geschrieben — ${BREITE}×${KANTE}, Ausschnitt ${(anteil * 100).toFixed(0)} % der Region`);
