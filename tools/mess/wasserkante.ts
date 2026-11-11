/**
 * Reproduzierbare Geometriesonde der Stauwehr-Wasserkante (D255).
 * Aufruf: npx tsx tools/mess/wasserkante.ts
 *
 * Baut Wasser- und Terrain-Kacheln aus den unveraenderten Weltdaten mit der
 * LOD-Wahl des Spielers bei (1045, 885); Strahlen entsprechen der Kamera aus
 * docs/MESSLAUF.md bei 960 x 540. Gemeldet werden Treffer und Hoehen, es werden
 * keine Bilder oder Baselines geschrieben. Der naechste Bachabschnitt und sein
 * niederes Ufer sind eine gesonderte Kontrollrechnung, kein Shader-Renderer.
 * Sichtbare Bauwerks-/Vegetationsnetze, Wasserpegel-Senken, Materialtransparenz,
 * Wellennormalen und Beleuchtung werden von dieser CPU-Sonde nicht simuliert.
 */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { entpackeWelt } from '../../src/world/osm.js';
import {
  baueHoehenfeld, baueKachelGeometrie, baueKachelraster, hoeheAufFlaeche,
  lodFuerAbstand, spiegelAufFlaeche, LOD_STUFEN,
} from '../../src/world/lod.js';
import { baueWasserKachel, zerlegeBaender, type Bandstueck } from '../../src/world/baender.js';

const welt = entpackeWelt(JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt);
const feld = baueHoehenfeld(welt), satz = zerlegeBaender(welt, feld);
const spieler = new THREE.Vector2(1045, 885);
const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const wasser: THREE.Mesh[] = [], boden: THREE.Mesh[] = [];
const kacheln = baueKachelraster(feld);
const lodKachel = (k: typeof kacheln[number]) => lodFuerAbstand(
  Math.max(0, Math.hypot(k.mitte[0] - spieler.x, k.mitte[1] - spieler.y) - k.radius),
);
for (const k of kacheln) {
  if (Math.hypot(k.mitte[0] - spieler.x, k.mitte[1] - spieler.y) - k.radius > 220) continue;
  const lod = lodKachel(k), g = baueWasserKachel(feld, satz, k, lod);
  if (g) {
    const mesh = new THREE.Mesh(g, material);
    mesh.userData = { kachel: `${k.ix}:${k.iz}`, lod };
    mesh.updateMatrixWorld(true); wasser.push(mesh);
  }
  const mesh = new THREE.Mesh(baueKachelGeometrie(feld, k, lod), material);
  mesh.userData = { kachel: `${k.ix}:${k.iz}`, lod };
  mesh.updateMatrixWorld(true); boden.push(mesh);
}
const kamera = new THREE.PerspectiveCamera(42.6, 960 / 540, 0.1, 5000);
kamera.position.set(1068, 47.959, 867);
kamera.lookAt(1105, 43.899, 842); kamera.updateMatrixWorld(true);
const strahl = new THREE.Raycaster();
const rund = (n: number) => Math.round(n * 1000) / 1000;
const punkt = (p: THREE.Vector3) => p.toArray().map(rund);

/** Rechnet das naechste liegende Band am Punkt mit derselben Uferregel nach. */
function naechstesBand(x: number, z: number) {
  let best: { kachel: string; s: Bandstueck; t: number; abstand: number } | null = null;
  for (const [kachel, liste] of satz.baeche) for (const s of liste) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, lq = dx * dx + dz * dz;
    const t = lq > 0 ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / lq)) : 0;
    const abstand = Math.hypot(x - s.ax - t * dx, z - s.az - t * dz);
    if (!best || abstand < best.abstand) best = { kachel, s, t, abstand };
  }
  if (!best) return null;
  const [ix, iz] = best.kachel.split(':').map(Number);
  const k = kacheln.find(v => v.ix === ix && v.iz === iz);
  if (!k) return null;
  const { s, t, abstand } = best, lod = lodKachel(k), schritt = LOD_STUFEN[lod].schritt;
  const a = [spiegelAufFlaeche(feld, s.ax - s.nx, s.az - s.nz, schritt),
    spiegelAufFlaeche(feld, s.ax + s.nx, s.az + s.nz, schritt)];
  const b = [spiegelAufFlaeche(feld, s.bx - s.nx, s.bz - s.nz, schritt),
    spiegelAufFlaeche(feld, s.bx + s.nx, s.bz + s.nz, schritt)];
  // dieselbe min(Ufer links, Ufer rechts) + 0,06 m wie liegendesBand.
  const spiegel = Math.min(...a) * (1 - t) + Math.min(...b) * t + 0.06;
  const untergrund = hoeheAufFlaeche(feld, x, z, schritt);
  return { kachel: best.kachel, lod, abstand: rund(abstand), halbeBreite: rund(Math.hypot(s.nx, s.nz)),
    uferA: a.map(rund), uferB: b.map(rund), spiegel: rund(spiegel),
    untergrund: rund(untergrund), spiegelMinusBoden: rund(spiegel - untergrund) };
}

for (const [x, y] of [[400, 325], [400, 333], [400, 340], [400, 342], [400, 345], [450, 325]]) {
  strahl.setFromCamera(new THREE.Vector2(x / 960 * 2 - 1, 1 - y / 540 * 2), kamera);
  const w = strahl.intersectObjects(wasser)[0], b = strahl.intersectObjects(boden)[0];
  const basis = b ? { punkt: punkt(b.point), entfernung: rund(b.distance), normal: b.face && punkt(b.face.normal),
    wassertiefe: rund(feld.wasserTiefe(b.point.x, b.point.z)), kachel: b.object.userData.kachel,
    band: naechstesBand(b.point.x, b.point.z) } : null;
  const spiegel = w ? { punkt: punkt(w.point), entfernung: rund(w.distance), normal: w.face && punkt(w.face.normal),
    uv: w.uv?.toArray().map(rund), vorBoden: !b || w.distance < b.distance } : null;
  console.log(JSON.stringify({ pixel: [x, y], boden: basis, wasser: spiegel }));
}
for (const mesh of [...wasser, ...boden]) mesh.geometry.dispose();
material.dispose();
