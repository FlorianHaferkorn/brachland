/**
 * BRACHLAND — Stammfuss: Verdeckung am Boden für die Waldstämme der Blender-Szenen (D262)
 *
 * Ein Stamm, der überall gleich hell ist, steht nicht im Boden, er steckt darin. Im Render macht
 * das der Bounce: Unten fehlt Himmel, Streu und Gras schlucken Licht. Das Spiel hat dafür nur den
 * AO-Pass im Zwischenbild, und der reicht 8 m weit, nicht 30 cm.
 *
 * Hier bekommt jede Ecke eines Holznetzes `_fuss`: 0 am tiefsten Punkt ihres Stammes, 1 ab
 * `HOEHE` darüber. Welcher Stamm das ist, sagen die Stammkreise der Szene (`staemme.json`, G-136,
 * Weltmeter) — eine Ecke ausserhalb jedes Kreises (Ast, Krone) bleibt bei 1. Der Shader dunkelt
 * damit Fülllicht stark und Sonne schwach ab (`windmaterial.ts`, Option `fuss`).
 *
 * Einmal beim Laden, CPU, linear in den Ecken. Kein three.js im Kern bis auf den Attributtyp.
 */
import * as THREE from 'three';

/** Bis zu dieser Höhe über dem Stammfuss wirkt die Verdeckung, in Metern. */
export const FUSS_HOEHE = 1.2;
/** Spiel um den Stammkreis, in Metern: Wurzelanläufe sind breiter als der Schnitt bei Brusthöhe. */
const FUSS_RAND = 0.25;
const ZELLE = 2;

/**
 * `geo` liegt im Raum `matrix` (Netz → Gruppe der Szene), die Gruppe steht bei `(ursprungX, ·, ursprungZ)`.
 * Gibt die Zahl der Ecken zurück, die einem Stamm zugeordnet wurden.
 */
export function setzeStammfuss(
  geo: THREE.BufferGeometry, matrix: THREE.Matrix4,
  ursprungX: number, ursprungZ: number,
  staemme: readonly (readonly [number, number, number])[],
): number {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const n = pos.count;
  // Raster der Stammkreise: jede Zelle kennt die Kreise, die sie berühren.
  const raster = new Map<string, number[]>();
  staemme.forEach(([x, z, r], i) => {
    const rr = r + FUSS_RAND;
    for (let gx = Math.floor((x - rr) / ZELLE); gx <= Math.floor((x + rr) / ZELLE); gx++)
      for (let gz = Math.floor((z - rr) / ZELLE); gz <= Math.floor((z + rr) / ZELLE); gz++) {
        const k = gx + ',' + gz;
        const l = raster.get(k);
        if (l) l.push(i); else raster.set(k, [i]);
      }
  });
  const zuStamm = new Int32Array(n).fill(-1);
  const hoehe = new Float32Array(n);
  const tiefst = new Float64Array(staemme.length).fill(Infinity);
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(matrix);
    const wx = p.x + ursprungX, wz = p.z + ursprungZ;
    hoehe[i] = p.y;
    const l = raster.get(Math.floor(wx / ZELLE) + ',' + Math.floor(wz / ZELLE));
    if (!l) continue;
    let best = -1, bestD = Infinity;
    for (const s of l) {
      const [x, z, r] = staemme[s];
      const d = Math.hypot(wx - x, wz - z);
      if (d <= r + FUSS_RAND && d < bestD) { best = s; bestD = d; }
    }
    if (best < 0) continue;
    zuStamm[i] = best;
    if (p.y < tiefst[best]) tiefst[best] = p.y;
  }
  const fuss = new Float32Array(n).fill(1);
  let zugeordnet = 0;
  for (let i = 0; i < n; i++) {
    const s = zuStamm[i];
    if (s < 0) continue;
    zugeordnet++;
    fuss[i] = Math.min(1, Math.max(0, (hoehe[i] - tiefst[s]) / FUSS_HOEHE));
  }
  geo.setAttribute('_fuss', new THREE.Float32BufferAttribute(fuss, 1));
  return zugeordnet;
}
