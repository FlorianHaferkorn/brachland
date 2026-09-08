/**
 * BRACHLAND — Spielerfigur
 *
 * Bis D126 ein **Platzhalter**: drei Kästen in drei Grautönen unter Leuchtdichte
 * 0,03. Seit D126 eine **Wanderin** aus Kästen und Vier- bis Sechskant-Zylindern.
 * Seit D139 ist sie auf dem Niveau der Kreaturen: **gelofteter Körper** aus
 * Querschnittsringen (Hüfte, Taille, Brust, Schulter; Oberschenkel, Knie, Wade,
 * Stiefel, Fuß; Oberarm, Ellbogen, Handgelenk, Hand) statt Primitiven, ein
 * Kopf aus 320 Flächen, und eine **eingebackene Verschattung** in der Vertexfarbe
 * — unter dem Jackensaum, im Kragen, unter dem Rucksack, am Stiefelrand —, so
 * wie `kreaturbau.py` den Tieren ihr AO in die Farbe backt (D116). Alle Farben
 * aus `PALETTE.figur` (D117); die Signalfarbe kommt hier nicht vor (ADR-0002).
 *
 * **In Teilen statt als ein Klumpen.** Ein einziges verschmolzenes Mesh kann nicht
 * gehen — Beine und Arme liegen einzeln vor, jeweils mit dem Drehpunkt im
 * Ursprung, damit die Szene sie um Hüfte und Schulter schwenken kann. Kein Rig;
 * der Unterschied zwischen „gleitet" und „geht".
 *
 * **Umlaufsinn** (G-128): Das Material ist einseitig. `loft` legt jedes Dreieck
 * so, dass die Normale nach aussen zeigt — am Ring von unten nach oben und um die
 * Hochachse; ein Loft, der um eine andere Achse laufen soll (Fuß, Rolle), wird
 * **gedreht**, nicht anders gebaut. Geprüft mit `.cache/figurseite.ts`.
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

/** Ein Querschnitt des Lofts: Höhe, halbe Breite (x), halbe Tiefe (z), Versatz. */
interface Ring { y: number; rx: number; rz: number; x?: number; z?: number }

/**
 * Loft um die Hochachse: Ringe von unten nach oben, `seg` Ecken je Ring, Deckel
 * oben und unten. Die Ecken stehen um eine halbe Teilung gedreht, damit bei acht
 * Ecken je eine **Fläche** nach vorn, hinten und zur Seite zeigt — eine Kante
 * nach vorn liest sich als Grat, eine Fläche als Brust.
 */
function loft(ringe: Ring[], seg = 8, deckel: { oben?: boolean; unten?: boolean } = {}): THREE.BufferGeometry {
  const p: number[] = [];
  const punkt = (r: Ring, i: number): [number, number, number] => {
    const a = ((i % seg) + 0.5) / seg * Math.PI * 2;
    return [(r.x ?? 0) + r.rx * Math.cos(a), r.y, (r.z ?? 0) + r.rz * Math.sin(a)];
  };
  const tri = (a: number[], b: number[], c: number[]) => p.push(...a, ...b, ...c);
  for (let k = 0; k + 1 < ringe.length; k++) {
    const u = ringe[k], o = ringe[k + 1];
    for (let i = 0; i < seg; i++) {
      const a0 = punkt(u, i), a1 = punkt(u, i + 1), b0 = punkt(o, i), b1 = punkt(o, i + 1);
      // Nach aussen (nachgerechnet am Ring bei Winkel 0: Normale +x).
      tri(a0, b1, a1);
      tri(a0, b0, b1);
    }
  }
  if (deckel.oben) {
    const r = ringe[ringe.length - 1], c = [r.x ?? 0, r.y, r.z ?? 0];
    for (let i = 0; i < seg; i++) tri(c, punkt(r, i + 1), punkt(r, i));
  }
  if (deckel.unten) {
    const r = ringe[0], c = [r.x ?? 0, r.y, r.z ?? 0];
    for (let i = 0; i < seg; i++) tri(c, punkt(r, i), punkt(r, i + 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return g;
}

/** Verschattung 0…1 je Ecke — 1 ist unverschattet. */
type Schatten = (x: number, y: number, z: number) => number;

/** Färbt eine Geometrie ein, verschattet je Ecke und schiebt sie an ihre Position. */
function teil(
  roh: THREE.BufferGeometry, farbe: THREE.Color,
  x: number, y: number, z: number, dreh: [number, number, number] = [0, 0, 0],
  schatten?: Schatten,
): THREE.BufferGeometry {
  // Erst vereinheitlichen: Icosahedron und Sphere sind indiziert, `loft` nicht.
  // `mergeGeometries` verweigert gemischte Index-Attribute.
  const g = roh.index ? roh.toNonIndexed() : roh;
  // Primitive bringen Normalen und UV mit, `loft` nicht — und `mergeGeometries`
  // verlangt bei allen dieselben Attribute (G-131). Normalen rechnet `fertig`.
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  if (dreh[0]) g.rotateX(dreh[0]);
  if (dreh[1]) g.rotateY(dreh[1]);
  if (dreh[2]) g.rotateZ(dreh[2]);
  g.translate(x, y, z);
  const pos = g.getAttribute('position');
  const n = pos.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = schatten ? schatten(pos.getX(i), pos.getY(i), pos.getZ(i)) : 1;
    col[i * 3] = farbe.r * k; col[i * 3 + 1] = farbe.g * k; col[i * 3 + 2] = farbe.b * k;
  }
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

/** Weiche Stufe, wie `smoothstep` im Shader. */
const glatt = (a: number, b: number, t: number) => {
  const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

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
 * Masse aus einer 1,80-m-Person: Schulterbreite 0,47, Hüfte 0,35, Kopf 0,21.
 * Der Rumpf ist ein Loft mit Taille — Schultern breit, Taille schmal, Hüfte
 * wieder breiter —, denn von hinten sieht man die Figur die meiste Zeit, und
 * von hinten ist die Taille das, was einen Körper von einem Sack unterscheidet.
 */
export function baueSpielerTeile(): SpielerTeile {
  const r: THREE.BufferGeometry[] = [];

  // --- Rumpf: Jacke als Loft Hüfte → Taille → Brust → Schulter ------------------
  // Verschattung: unter dem Saum dunkel (der Gürtel wirft Schatten auf die Hose,
  // hier: der Saum auf sich selbst), unter dem Kragen, und hinten unter dem Pack.
  const rumpfSchatten: Schatten = (x, y, z) =>
    (0.78 + 0.22 * glatt(0.86, 0.98, y))
    * (1 - 0.16 * glatt(1.34, 1.43, y) * glatt(1.47, 1.44, y))
    * (z > 0.06 && y > 1.0 && y < 1.42 ? 0.86 : 1);
  r.push(teil(loft([
    { y: 0.86, rx: 0.175, rz: 0.115 }, { y: 0.98, rx: 0.160, rz: 0.105 },
    { y: 1.12, rx: 0.190, rz: 0.120 }, { y: 1.28, rx: 0.215, rz: 0.130 },
    { y: 1.40, rx: 0.235, rz: 0.130 }, { y: 1.46, rx: 0.200, rz: 0.120 },
  ], 8, { oben: true, unten: true }), JACKE, 0, 0, 0, [0, 0, 0], rumpfSchatten));
  // Gürtel: die Waagerechte, an der die Figur als bekleidet liest.
  r.push(teil(loft([{ y: 0.855, rx: 0.180, rz: 0.120 }, { y: 0.90, rx: 0.180, rz: 0.120 }], 8), RIEMEN, 0, 0, 0));
  // Kragen: ein aufgestellter Trichter über der Schulterlinie.
  r.push(teil(loft([{ y: 1.44, rx: 0.165, rz: 0.125 }, { y: 1.53, rx: 0.125, rz: 0.100 }], 8, { oben: true }),
              JACKE, 0, 0, 0, [0, 0, 0], (_x, y) => 0.84 + 0.16 * glatt(1.44, 1.53, y)));
  // Hals.
  r.push(teil(loft([{ y: 1.46, rx: 0.055, rz: 0.050 }, { y: 1.58, rx: 0.055, rz: 0.050 }], 8),
              HAUT, 0, 0, 0, [0, 0, 0], (_x, y) => 0.78 + 0.22 * glatt(1.48, 1.58, y)));
  // Halstuch: der Akzent. Ein Keil vorn unter dem Kinn, dazu ein Ring am Hals.
  r.push(teil(new THREE.ConeGeometry(0.10, 0.20, 3), HALSTUCH, 0, 1.40, -0.10, [Math.PI, 0, 0]));
  r.push(teil(loft([{ y: 1.49, rx: 0.115, rz: 0.100 }, { y: 1.54, rx: 0.125, rz: 0.105 }], 8, { oben: true }), HALSTUCH, 0, 0, 0));

  // --- Kopf: Haut vorn, Kapuze hinten und oben --------------------------------
  const kopf = new THREE.IcosahedronGeometry(0.105, 2);
  kopf.scale(0.92, 1.10, 0.98);
  r.push(teil(kopf, HAUT, 0, 1.665, -0.01, [0, 0, 0],
              (_x, y, z) => (0.86 + 0.14 * glatt(1.58, 1.66, y)) * (z > 0.03 ? 0.9 : 1)));
  // phi 0…π ist bei `SphereGeometry` die Hälfte mit z ≥ 0 — der Hinterkopf.
  // Seit D142 (zum ersten Mal von vorn gesehen: ein kahler Hautkopf) greift die
  // Kapuze 0,6 rad über beide Seiten nach vorn und lässt nur das Gesicht frei —
  // von vorn rahmt sie es, von hinten ist sie, was sie war.
  const kapuze = new THREE.SphereGeometry(0.135, 12, 7, -0.6, Math.PI + 1.2, 0, Math.PI * 0.64);
  r.push(teil(kapuze, KAPUZE, 0, 1.675, 0.02, [0, 0, 0],
              (_x, y) => 0.82 + 0.18 * glatt(1.60, 1.74, y)));
  // Augen: zwei dunkle Punkte, knapp in der Stirnfläche — ohne sie ist ein
  // Gesicht ein Ei (D142).
  for (const sx of [-1, 1]) {
    r.push(teil(new THREE.IcosahedronGeometry(0.013, 0), RIEMEN, sx * 0.036, 1.685, -0.096));
  }

  // --- Rucksack: Kasten mit gerundeter Rolle obenauf, zwei Riemen ---------------
  const packSchatten: Schatten = (_x, y) => 0.82 + 0.18 * glatt(1.04, 1.30, y);
  r.push(teil(new THREE.BoxGeometry(0.30, 0.36, 0.16), GEPAECK, 0, 1.22, 0.21, [0, 0, 0], packSchatten));
  r.push(teil(new THREE.BoxGeometry(0.26, 0.10, 0.06), RIEMEN, 0, 1.30, 0.30));   // Klappe/Schnalle
  r.push(teil(loft([{ y: -0.17, rx: 0.07, rz: 0.07 }, { y: 0.17, rx: 0.07, rz: 0.07 }], 8, { oben: true, unten: true }),
              ROLLE, 0, 1.46, 0.19, [0, 0, Math.PI / 2]));
  for (const sx of [-1, 1]) {
    r.push(teil(new THREE.BoxGeometry(0.05, 0.42, 0.03), RIEMEN, sx * 0.11, 1.25, -0.115, [0.12, 0, 0]));
  }

  // --- Bein: Hose bis unters Knie, Stiefel darunter, Fuß nach vorn. Drehpunkt = Hüfte
  // Verschattung: oben unter dem Jackensaum, am Stiefelrand unter dem Hosenbein.
  const bein = fertig([
    teil(loft([
      { y: -0.55, rx: 0.080, rz: 0.085 }, { y: -0.42, rx: 0.075, rz: 0.080, z: -0.005 },
      { y: -0.20, rx: 0.088, rz: 0.095 }, { y: 0.00, rx: 0.098, rz: 0.105 },
    ], 8, { oben: true }), HOSE, 0, 0, 0, [0, 0, 0],
      (_x, y) => (0.74 + 0.26 * glatt(0.0, -0.16, y)) * (1 - 0.12 * glatt(-0.50, -0.55, y))),
    teil(loft([
      { y: -0.81, rx: 0.062, rz: 0.068 }, { y: -0.72, rx: 0.066, rz: 0.072 },
      { y: -0.62, rx: 0.078, rz: 0.084 }, { y: -0.54, rx: 0.084, rz: 0.090 },
    ], 8, { oben: true }), STIEFEL, 0, 0, 0, [0, 0, 0],
      (_x, y) => 0.80 + 0.20 * glatt(-0.54, -0.66, y)),
    // Fuß: Loft entlang der Hochachse gebaut (Ferse unten, Zehen oben) und um −90°
    // um x gedreht — y wird −z, die Zehen zeigen nach vorn. Umlaufsinn bleibt.
    teil(loft([
      { y: -0.07, rx: 0.060, rz: 0.035 }, { y: 0.02, rx: 0.070, rz: 0.044 },
      { y: 0.13, rx: 0.062, rz: 0.036 }, { y: 0.19, rx: 0.042, rz: 0.020 },
    ], 8, { oben: true, unten: true }), STIEFEL, 0, -0.806, -0.02, [-Math.PI / 2, 0, 0]),
  ], 'Bein');

  // --- Arm: Ärmel mit leichtem Knick am Ellbogen, dann Hand. Drehpunkt = Schulter
  const arm = fertig([
    teil(loft([
      { y: -0.47, rx: 0.058, rz: 0.058, z: -0.040 }, { y: -0.40, rx: 0.055, rz: 0.055, z: -0.030 },
      { y: -0.27, rx: 0.062, rz: 0.062, z: -0.010 }, { y: -0.14, rx: 0.070, rz: 0.070 },
      { y: 0.00, rx: 0.078, rz: 0.078 },
    ], 8, { oben: true }), JACKE, 0, 0, 0, [0, 0, 0],
      (_x, y) => 0.80 + 0.20 * glatt(0.0, -0.12, y)),
    teil(loft([
      { y: -0.60, rx: 0.030, rz: 0.022, z: -0.050 }, { y: -0.56, rx: 0.046, rz: 0.032, z: -0.050 },
      { y: -0.47, rx: 0.046, rz: 0.036, z: -0.040 },
    ], 8, { unten: true }), HAUT, 0, 0, 0, [0, 0, 0],
      (_x, y) => 0.84 + 0.16 * glatt(-0.47, -0.55, y)),
  ], 'Arm');

  return { rumpf: fertig(r, 'Rumpf'), bein, arm };
}
