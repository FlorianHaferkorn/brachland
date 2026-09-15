/**
 * LOD-Silhouetten aus den tatsaechlichen GLB vergleichen (CPU, ohne Beleuchtung).
 * node --import tsx tools/baumvergleich.ts <alt/props> <neu/props> <bericht.json> [pixel=512]
 *
 * Knoten-Weltmatrizen werden angewendet. Alle sechs Stufen eines Baums teilen pro Blick
 * denselben Projektionsrahmen: keine Zentrierung/Skalierung je LOD, die Spruenge verstecken wuerde.
 * Drei Seitenblicke plus drei erhoehte Blicke; Gegenrichtungen auf gleicher Hoehe waeren
 * bei einer binaren Silhouette redundant. Gemessen wird Geometrie, nicht der Laublochshader.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { GLTFLoader, MeshoptDecoder } from 'three-stdlib';
import { Box3, Mesh, Vector3 } from 'three';

type Stufe = 'nah' | 'mittel' | 'fern';
type Modell = { dreiecke: Float64Array; zahl: number; box: Box3 };
type Blick = { azimut: number; hoehenwinkel: number };
type Rahmen = { u0: number; v0: number; meterJePixel: number };
const STUFEN: Stufe[] = ['nah', 'mittel', 'fern'];
const BLICKE: Blick[] = [0, 60, 120].flatMap(azimut => [
  { azimut, hoehenwinkel: 0 }, { azimut, hoehenwinkel: 30 },
]);
const decoder = typeof MeshoptDecoder === 'function' ? MeshoptDecoder() : MeshoptDecoder;
const loader = new GLTFLoader().setMeshoptDecoder(decoder);

async function lade(pfad: string): Promise<Modell> {
  const daten = readFileSync(pfad);
  const gltf = await loader.parseAsync(daten.buffer.slice(daten.byteOffset, daten.byteOffset + daten.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const punkte: number[] = [], box = new Box3(), v = new Vector3();
  gltf.scene.traverse(o => {
    if (!(o instanceof Mesh)) return;
    const position = o.geometry.getAttribute('position'), index = o.geometry.index;
    const n = index?.count ?? position.count;
    if (n % 3 !== 0) throw new Error(`${pfad}: Keine Dreiecksliste.`);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(o.matrixWorld);
      if (![v.x, v.y, v.z].every(Number.isFinite)) throw new Error(`${pfad}: Ungueltige Position.`);
      box.expandByPoint(v); punkte.push(v.x, v.y, v.z);
    }
  });
  if (!punkte.length) throw new Error(`${pfad}: Keine Dreiecke.`);
  return { dreiecke: Float64Array.from(punkte), zahl: punkte.length / 9, box };
}

function projiziere(modell: Modell, blick: Blick): Float64Array {
  const az = blick.azimut * Math.PI / 180, el = blick.hoehenwinkel * Math.PI / 180;
  const rechts = new Vector3(Math.cos(az), 0, -Math.sin(az));
  const oben = new Vector3(-Math.sin(az) * Math.sin(el), Math.cos(el), -Math.cos(az) * Math.sin(el));
  const aus = new Float64Array(modell.dreiecke.length / 3 * 2);
  for (let i = 0, j = 0; i < modell.dreiecke.length; i += 3, j += 2) {
    const [x, y, z] = modell.dreiecke.subarray(i, i + 3);
    aus[j] = x * rechts.x + y * rechts.y + z * rechts.z;
    aus[j + 1] = x * oben.x + y * oben.y + z * oben.z;
  }
  return aus;
}

function rahmenFuer(projektionen: Float64Array[], pixel: number): Rahmen {
  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
  for (const p of projektionen) for (let i = 0; i < p.length; i += 2) {
    minU = Math.min(minU, p[i]); maxU = Math.max(maxU, p[i]);
    minV = Math.min(minV, p[i + 1]); maxV = Math.max(maxV, p[i + 1]);
  }
  const seite = Math.max(maxU - minU, maxV - minV) * 1.1;
  if (!(seite > 0)) throw new Error('Leerer Projektionsrahmen.');
  return { u0: (minU + maxU - seite) / 2, v0: (minV + maxV - seite) / 2, meterJePixel: seite / pixel };
}

function rastere(punkte: Float64Array, pixel: number, rahmen: Rahmen): Uint8Array {
  const maske = new Uint8Array(pixel * pixel);
  for (let i = 0; i < punkte.length; i += 6) {
    const ax = (punkte[i] - rahmen.u0) / rahmen.meterJePixel, ay = (punkte[i + 1] - rahmen.v0) / rahmen.meterJePixel;
    const bx = (punkte[i + 2] - rahmen.u0) / rahmen.meterJePixel, by = (punkte[i + 3] - rahmen.v0) / rahmen.meterJePixel;
    const cx = (punkte[i + 4] - rahmen.u0) / rahmen.meterJePixel, cy = (punkte[i + 5] - rahmen.v0) / rahmen.meterJePixel;
    const kreuz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(kreuz) < 1e-12) continue;
    const vorzeichen = Math.sign(kreuz);
    const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - 0.5));
    const x1 = Math.min(pixel - 1, Math.floor(Math.max(ax, bx, cx) - 0.5));
    const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy) - 0.5));
    const y1 = Math.min(pixel - 1, Math.floor(Math.max(ay, by, cy) - 0.5));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (maske[y * pixel + x]) continue;
      const px = x + 0.5, py = y + 0.5;
      if (vorzeichen * ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) >= -1e-10 &&
          vorzeichen * ((cx - bx) * (py - by) - (cy - by) * (px - bx)) >= -1e-10 &&
          vorzeichen * ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) >= -1e-10) {
        maske[y * pixel + x] = 1;
      }
    }
  }
  return maske;
}

function vergleiche(referenz: Uint8Array, kandidat: Uint8Array, pixel: number, meterJePixel: number) {
  let ref = 0, ziel = 0, schnitt = 0, rx = 0, ry = 0, zx = 0, zy = 0;
  for (let i = 0; i < referenz.length; i++) {
    const x = i % pixel, y = Math.floor(i / pixel);
    if (referenz[i]) { ref++; rx += x; ry += y; }
    if (kandidat[i]) { ziel++; zx += x; zy += y; }
    if (referenz[i] && kandidat[i]) schnitt++;
  }
  if (!ref || !ziel) throw new Error('Silhouette leer: Aufloesung oder Geometrie pruefen.');
  return {
    iou: schnitt / (ref + ziel - schnitt), referenzPixel: ref, kandidatPixel: ziel,
    fehlenderAnteil: (ref - schnitt) / ref, hinzugefuegterAnteil: (ziel - schnitt) / ref,
    flaechenfaktor: ziel / ref,
    schwerpunktVersatzMeter: Math.hypot(zx / ziel - rx / ref, zy / ziel - ry / ref) * meterJePixel,
  };
}

// Gegenprobe des Messverfahrens: gleiche/gegensinnig orientierte Quadrate und halbe Ueberlappung.
function pruefeRaster(): void {
  const a = new Float64Array([0, 0, 4, 0, 4, 4, 0, 0, 4, 4, 0, 4]);
  const b = new Float64Array([4, 4, 4, 0, 0, 0, 0, 4, 4, 4, 0, 0]);
  const c = a.map((v, i) => v + (i % 2 === 0 ? 2 : 0));
  const r = { u0: 0, v0: 0, meterJePixel: 1 };
  const ra = rastere(a, 8, r), rb = rastere(b, 8, r), rc = rastere(c, 8, r);
  assert.equal(ra.reduce((sum, v) => sum + v, 0), 16);
  assert.deepEqual(ra, rb);
  assert.equal(vergleiche(ra, ra, 8, 1).iou, 1);
  assert.equal(vergleiche(ra, rc, 8, 1).iou, 1 / 3);
}

function boxwerte(modell: Modell) {
  const groesse = modell.box.getSize(new Vector3());
  return { dreiecke: modell.zahl, min: modell.box.min.toArray(), max: modell.box.max.toArray(),
    breite: groesse.x, hoehe: groesse.y, tiefe: groesse.z, mitte: modell.box.getCenter(new Vector3()).toArray() };
}

pruefeRaster();
const [altOrdner, neuOrdner, berichtPfad, raster = '512'] = process.argv.slice(2);
const pixel = Number(raster);
if (!altOrdner || !neuOrdner || !berichtPfad || !Number.isInteger(pixel) || pixel < 64 || pixel > 2048) {
  throw new Error('Aufruf: baumvergleich.ts <alt/props> <neu/props> <bericht.json> [pixel=512; 64..2048]');
}
const dateien = readdirSync(altOrdner).filter(n => /^baum-.+-\d+-(nah|mittel|fern)\.glb$/.test(n)).sort();
const neuDateien = readdirSync(neuOrdner).filter(n => /^baum-.+-\d+-(nah|mittel|fern)\.glb$/.test(n)).sort();
assert(dateien.length > 0, 'Keine Baumdateien in der Baseline.');
assert.deepEqual(neuDateien, dateien, 'Alt/Neu muessen denselben Satz Baumdateien enthalten.');
const namen = [...new Set(dateien.map(n => n.replace(/-(nah|mittel|fern)\.glb$/, '')))];
const baeume = [];
for (const name of namen) {
  const alt = {} as Record<Stufe, Modell>, neu = {} as Record<Stufe, Modell>;
  for (const stufe of STUFEN) {
    alt[stufe] = await lade(join(altOrdner, `${name}-${stufe}.glb`));
    neu[stufe] = await lade(join(neuOrdner, `${name}-${stufe}.glb`));
  }
  const ansichten = BLICKE.map(blick => {
    const pa = STUFEN.map(s => projiziere(alt[s], blick));
    const pn = STUFEN.map(s => projiziere(neu[s], blick));
    const rahmen = rahmenFuer([...pa, ...pn], pixel);
    const ra = pa.map(p => rastere(p, pixel, rahmen)), rn = pn.map(p => rastere(p, pixel, rahmen));
    return { ...blick, rahmen,
      nahAltGegenNeu: vergleiche(ra[0], rn[0], pixel, rahmen.meterJePixel),
      alt: { mittel: vergleiche(ra[0], ra[1], pixel, rahmen.meterJePixel), fern: vergleiche(ra[0], ra[2], pixel, rahmen.meterJePixel) },
      neu: { mittel: vergleiche(rn[0], rn[1], pixel, rahmen.meterJePixel), fern: vergleiche(rn[0], rn[2], pixel, rahmen.meterJePixel) },
    };
  });
  baeume.push({ name, alt: Object.fromEntries(STUFEN.map(s => [s, boxwerte(alt[s])])),
    neu: Object.fromEntries(STUFEN.map(s => [s, boxwerte(neu[s])])), ansichten });
}
const zusammenfassung = [];
for (const art of [...new Set(namen.map(n => n.replace(/^baum-/, '').replace(/-\d+$/, '')))]) {
  for (const stufe of ['mittel', 'fern'] as const) {
    const gruppe = baeume.filter(b => b.name.startsWith(`baum-${art}-`));
    const alt = gruppe.flatMap(b => b.ansichten.map(a => a.alt[stufe].iou));
    const neu = gruppe.flatMap(b => b.ansichten.map(a => a.neu[stufe].iou));
    zusammenfassung.push({ art, stufe, ansichten: alt.length,
      alt: { mittelIoU: alt.reduce((a, b) => a + b) / alt.length, minIoU: Math.min(...alt), maxIoU: Math.max(...alt) },
      neu: { mittelIoU: neu.reduce((a, b) => a + b) / neu.length, minIoU: Math.min(...neu), maxIoU: Math.max(...neu) } });
  }
}
const bericht = { erstellt: new Date().toISOString(), eingaben: { altOrdner, neuOrdner }, pixel,
  verfahren: 'Binaere Vereinigung aller projizierten GLB-Dreiecke an Pixelmitten; Weltmatrizen angewendet; gemeinsamer Rahmen fuer alle Alt/Neu-LOD eines Baums; sechs orthographische Ansichten.',
  rasterSelbsttest: '16 Pixel im 4x4-Quadrat, winding-unabhaengig, identisch IoU=1, halbe Ueberlappung IoU=1/3.',
  grenzen: ['Keine Laubloechershader, Farbe, Licht, Wind oder Dithering.', 'Sechs Ansichten sind Stichproben, keine Abnahme aus jeder Richtung.',
    'IoU haengt von der Aufloesung ab; keine unkalibrierte harte Schwelle.', 'Geometrische Silhouette im Asset-Massstab; LOD-Auswahl und Bewegung der Engine werden hier nicht getestet.'],
  zusammenfassung, baeume };
mkdirSync(dirname(berichtPfad), { recursive: true });
writeFileSync(berichtPfad, JSON.stringify(bericht, null, 2) + '\n', { flag: 'wx' });
for (const z of zusammenfassung) console.log(`${z.art}/${z.stufe}: IoU Mittel ${z.alt.mittelIoU.toFixed(3)} → ${z.neu.mittelIoU.toFixed(3)}, Minimum ${z.alt.minIoU.toFixed(3)} → ${z.neu.minIoU.toFixed(3)} (${z.ansichten} Ansichten)`);
console.log(berichtPfad);
