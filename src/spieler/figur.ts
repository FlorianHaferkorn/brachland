/**
 * BRACHLAND — Spielerfigur
 *
 * Bis D126 ein **Platzhalter**: drei Kästen in drei Grautönen unter Leuchtdichte
 * 0,03, gedacht als Größenreferenz. Seit das Licht auf D110 steht und die Welt
 * im Band 0,07–0,35 liegt, war die Figur das dunkelste Ding im Bild — ein
 * Scherenschnitt, der in jeder Aufnahme als schwarzes Loch stand.
 *
 * Jetzt eine **Wanderin**: Kopf mit Gesicht und Kapuze, Jacke mit Kragen, ein
 * Halstuch als der eine Akzent, Rucksack mit Rolle und Riemen, Hose, Stiefel.
 * Alle Farben aus `PALETTE.figur` (D117), alle Teile unter 700 Dreiecken. Die
 * Signalfarbe des Befalls kommt hier weiterhin nicht vor (ADR-0002).
 *
 * **In Teilen statt als ein Klumpen.** Ein einziges verschmolzenes Mesh kann nicht
 * gehen — die Figur glitt über den Boden, und genau das fällt sofort auf. Beine und
 * Arme liegen deshalb einzeln vor, jeweils mit dem Drehpunkt im Ursprung, damit die
 * Szene sie um Hüfte und Schulter schwenken kann. Das ist kein Rig und ersetzt auch
 * keines; es ist der Unterschied zwischen „gleitet" und „geht".
 */
import * as THREE from 'three';
import { PALETTE } from '../world/palette.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Gesamthöhe in Metern — muss zu `GROESSE.spieler` passen. */
export const FIGUR_HOEHE = 1.8;

/** Höhe des Hüftgelenks über dem Boden. Beine hängen von hier nach unten. */
export const HUEFTE = 0.85;
/** Höhe des Schultergelenks. */
export const SCHULTER = 1.42;

const F = PALETTE.figur;
const JACKE = new THREE.Color(F.jacke);
const HOSE = new THREE.Color(F.hose);
const STIEFEL = new THREE.Color(F.stiefel);
const HAUT = new THREE.Color(F.haut);
const KAPUZE = new THREE.Color(F.kapuze);
const HALSTUCH = new THREE.Color(F.halstuch);
const GEPAECK = new THREE.Color(F.gepaeck);
const RIEMEN = new THREE.Color(F.riemen);
const ROLLE = new THREE.Color(F.rolle);

/** Färbt eine Geometrie flächig ein und schiebt sie an ihre Position. */
function teil(
  roh: THREE.BufferGeometry, farbe: THREE.Color,
  x: number, y: number, z: number, dreh: [number, number, number] = [0, 0, 0],
): THREE.BufferGeometry {
  // Erst vereinheitlichen: Box und Cylinder sind indiziert, Icosahedron nicht.
  // `mergeGeometries` verweigert gemischte Index-Attribute — der Fehler tritt erst
  // zur Laufzeit auf und nimmt die ganze Szene mit.
  const g = roh.index ? roh.toNonIndexed() : roh;
  if (dreh[0]) g.rotateX(dreh[0]);
  if (dreh[1]) g.rotateY(dreh[1]);
  if (dreh[2]) g.rotateZ(dreh[2]);
  g.translate(x, y, z);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = farbe.r; col[i * 3 + 1] = farbe.g; col[i * 3 + 2] = farbe.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function fertig(teile: THREE.BufferGeometry[], was: string): THREE.BufferGeometry {
  const g = mergeGeometries(teile, false);
  if (!g) throw new Error(`Spielerfigur (${was}): Geometrien ließen sich nicht zusammenfassen`);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export interface SpielerTeile {
  /** Rumpf, Kopf, Gepäck — steht fest am Anker. */
  rumpf: THREE.BufferGeometry;
  /** Bein, Drehpunkt im Ursprung, hängt nach unten. Für beide Seiten dasselbe. */
  bein: THREE.BufferGeometry;
  /** Arm, Drehpunkt im Ursprung, hängt nach unten. */
  arm: THREE.BufferGeometry;
}

/**
 * Baut die Figur in Teilen. Blickrichtung ist -Z, passend zur Kamera von +Z.
 *
 * Masse aus einer 1,80-m-Person: Schulterbreite 0,42, Hüfte 0,34, Kopf 0,22.
 * Der Rumpf ist ein nach unten schmaler Kasten — Schultern oben, Taille unten —,
 * kein Zylinder: Ein Zylinder liest sich von hinten als Fass, und von hinten sieht
 * man die Figur die meiste Zeit. Kragen, Halstuch und Rucksackrolle brechen die
 * Silhouette an genau den Stellen, an denen ein Kasten sonst Kasten bleibt.
 */
export function baueSpielerTeile(): SpielerTeile {
  const r: THREE.BufferGeometry[] = [];

  // --- Rumpf: Jacke als Kegelstumpf mit vier Kanten (Kasten, oben breiter) ----
  const jacke = new THREE.CylinderGeometry(0.235, 0.185, 0.58, 4, 1);
  jacke.rotateY(Math.PI / 4);                       // Kanten nach vorn/seitlich → Flächen frontal
  jacke.scale(1, 1, 0.62);                          // Brust flacher als breit
  r.push(teil(jacke, JACKE, 0, 1.14, 0));
  // Gürtel/Saum: eine dunkle Linie an der Taille — die Waagerechte, an der die
  // Figur als bekleidet liest statt als Block.
  r.push(teil(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 4, 1).rotateY(Math.PI / 4), RIEMEN, 0, 0.87, 0));
  // Kragen: ein flacher Ring, der die Schulterlinie hebt.
  r.push(teil(new THREE.CylinderGeometry(0.15, 0.20, 0.09, 6, 1), JACKE, 0, 1.44, 0.01));
  // Halstuch: der Akzent. Ein Keil vorn unter dem Kinn, Zipfel nach unten.
  r.push(teil(new THREE.ConeGeometry(0.10, 0.20, 3), HALSTUCH, 0, 1.36, -0.10, [Math.PI, 0, 0]));
  r.push(teil(new THREE.CylinderGeometry(0.12, 0.13, 0.05, 6, 1), HALSTUCH, 0, 1.47, 0));

  // --- Kopf: Haut vorn, Kapuze hinten und oben --------------------------------
  // Der Kopf ist ein leicht gestrecktes Zwölfflach; die Kapuze ein zweites, etwas
  // größeres, hinten um 0,03 versetzt und unten offen — so bleibt das Gesicht frei.
  const kopf = new THREE.IcosahedronGeometry(0.105, 1);
  kopf.scale(0.92, 1.08, 0.95);
  r.push(teil(kopf, HAUT, 0, 1.63, -0.01));
  // phi 0…π ist bei `SphereGeometry` die Hälfte mit z ≥ 0 — der Hinterkopf.
  const kapuze = new THREE.SphereGeometry(0.13, 8, 6, 0, Math.PI, 0, Math.PI * 0.62);
  r.push(teil(kapuze, KAPUZE, 0, 1.64, 0.02));

  // --- Rucksack: Kasten, Rolle obenauf, zwei Riemen über die Schultern ---------
  r.push(teil(new THREE.BoxGeometry(0.30, 0.36, 0.16), GEPAECK, 0, 1.22, 0.20));
  r.push(teil(new THREE.BoxGeometry(0.26, 0.10, 0.06), RIEMEN, 0, 1.30, 0.29));   // Klappe/Schnalle
  r.push(teil(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 7, 1), ROLLE, 0, 1.46, 0.18, [0, 0, Math.PI / 2]));
  for (const sx of [-1, 1]) {
    r.push(teil(new THREE.BoxGeometry(0.05, 0.42, 0.03), RIEMEN, sx * 0.11, 1.25, -0.10, [0.12, 0, 0]));
  }

  // --- Bein: Hose bis zum Knie, Stiefel darunter. Drehpunkt = Hüfte -----------
  const bein = fertig([
    teil(new THREE.CylinderGeometry(0.085, 0.075, 0.52, 5, 1), HOSE, 0, -0.26, 0),
    teil(new THREE.CylinderGeometry(0.08, 0.09, 0.30, 5, 1), STIEFEL, 0, -0.68, 0),
    // Fuß nach vorn: der Absatz, an dem ein Bein als Bein steht und nicht als Stab.
    teil(new THREE.BoxGeometry(0.15, 0.09, 0.26), STIEFEL, 0, -0.805, -0.05),
  ], 'Bein');

  // --- Arm: Ärmel, dann Hand. Drehpunkt = Schulter -----------------------------
  const arm = fertig([
    teil(new THREE.CylinderGeometry(0.065, 0.055, 0.50, 5, 1), JACKE, 0, -0.25, 0),
    teil(new THREE.IcosahedronGeometry(0.055, 0), HAUT, 0, -0.53, 0),
  ], 'Arm');

  return { rumpf: fertig(r, 'Rumpf'), bein, arm };
}
