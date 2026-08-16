/**
 * BRACHLAND — Nahfeld-Streuschicht
 *
 * Das Problem, das die erste Live-Sicht freigelegt hat: Im 10-m-Umkreis um den
 * Spieler stand **kein einziges Objekt**, im 25-m-Umkreis zwei Grasbüschel. Auf
 * `wiese` sind 10 Büschel je Hektar rechnerisch 0,1 Stück auf 100 m² — eine echte
 * Wiese liest sich dicht. Ohne etwas Bekanntes am Boden fehlt dem Auge der Maßstab,
 * und das Gelände wirkt als Fläche, egal wie fein es tesselliert ist.
 *
 * Diese Schicht ist bewusst **kein** Prop-System: Sie wird nicht gespeichert, nicht
 * gechunkt und nicht auf Entfernung sortiert. Sie existiert nur im Nahbereich, wird
 * beim Gehen nachgezogen und ist über die Weltposition deterministisch — derselbe
 * Fleck trägt bei jedem Besuch dieselben Büschel.
 */
import * as THREE from 'three';
import type { Biom } from './osm.js';
import type { HoehenFeld } from './lod.js';

/** Radius, in dem gestreut wird. Darüber übernehmen die echten Props. */
export const STREU_RADIUS = 22;
/** Büschel je Quadratmeter auf voller Dichte. */
export const STREU_JE_QM = 2.40;
/** Obergrenze der Instanzen — Puffergröße, nie überschritten. */
export const STREU_MAX = 5200;
/** Ab dieser Bewegung wird nachgezogen. Bei 7 m/s knapp einmal je Sekunde. */
export const STREU_NACHZIEHEN = 6;

/**
 * Dichtefaktor je Biom. Fels und Wasser bleiben leer — dort wäre Gras schlicht falsch,
 * und der Kontrast macht die Biome überhaupt erst lesbar.
 */
const DICHTE: Record<Biom, number> = {
  wiese: 1.0, gebuesch: 0.8, wald: 0.55, acker: 0.35, ruine: 0.45,
  siedlung: 0.25, industrie: 0.15, fels: 0.12, unbekannt: 0.3, wasser: 0,
};

/** Deterministisches Rauschen — gleicher Punkt, gleiches Ergebnis. */
function hash(x: number, y: number, k: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(k | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Ein Büschel aus drei gekreuzten Halmpaaren — 6 Dreiecke.
 *
 * Die Vertex-Farbe läuft von dunkel am Fuß zu hell an der Spitze. Das ersetzt die
 * Textur, die es hier bewusst nicht gibt (ADR-0002): Ohne den Verlauf wäre jedes
 * Büschel ein einfarbiger Fleck und würde sich vom Boden nicht absetzen.
 */
export function baueBueschelGeometrie(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const fuss = new THREE.Color('#46552f');
  const spitze = new THREE.Color('#a3b47a');

  for (let i = 0; i < 3; i++) {
    const w = (i / 3) * Math.PI;
    const dx = Math.cos(w) * 0.09, dz = Math.sin(w) * 0.09;
    // Halm als schmales Dreieck: zwei Fußpunkte, eine leicht geneigte Spitze.
    const neigung = (i - 1) * 0.05;
    pos.push(-dx, 0, -dz,  dx, 0, dz,  neigung, 1, neigung * 0.5);
    col.push(fuss.r, fuss.g, fuss.b, fuss.r, fuss.g, fuss.b, spitze.r, spitze.g, spitze.b);
    // Rückseite mit umgekehrter Wicklung — deshalb braucht das Material KEIN
    // DoubleSide: Aus jeder Blickrichtung ist genau eine der beiden Kopien vorne.
    pos.push(dx, 0, dz,  -dx, 0, -dz,  neigung, 1, neigung * 0.5);
    col.push(fuss.r, fuss.g, fuss.b, fuss.r, fuss.g, fuss.b, spitze.r, spitze.g, spitze.b);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));

  // Normalen senkrecht nach oben statt aus der Geometrie berechnet.
  //
  // `computeVertexNormals()` gäbe gekreuzten Halmen waagerechte Normalen — die
  // bekommen von einer tief stehenden Sonne und einem Himmelslicht fast nichts ab
  // und rendern als schwarze Zacken. Nach oben zeigende Normalen lassen die Büschel
  // dasselbe Licht aufnehmen wie der Boden, auf dem sie stehen. Übliches Verfahren
  // für Vegetation und hier doppelt richtig, weil der Boden die Bezugsfläche ist.
  const hoch: number[] = [];
  for (let i = 0; i < pos.length / 3; i++) hoch.push(0, 1, 0);
  g.setAttribute('normal', new THREE.Float32BufferAttribute(hoch, 3));
  return g;
}

const hilfe = new THREE.Object3D();

/**
 * Füllt die Instanzmatrizen für die Umgebung von (mx, mz) und gibt die Anzahl zurück.
 *
 * Gerastert in Zellen von 2 m: So hängt das Ergebnis nur von der Weltposition ab,
 * nicht davon, von wo aus gestreut wurde — sonst würden die Büschel bei jedem
 * Nachziehen umherspringen.
 */
export function streueUmgebung(
  feld: HoehenFeld, mx: number, mz: number, mesh: THREE.InstancedMesh,
): number {
  const ZELLE = 2;
  const jeZelle = STREU_JE_QM * ZELLE * ZELLE;
  const r = STREU_RADIUS;
  let n = 0;

  const x0 = Math.floor((mx - r) / ZELLE), x1 = Math.ceil((mx + r) / ZELLE);
  const z0 = Math.floor((mz - r) / ZELLE), z1 = Math.ceil((mz + r) / ZELLE);

  for (let iz = z0; iz <= z1 && n < STREU_MAX; iz++) {
    for (let ix = x0; ix <= x1 && n < STREU_MAX; ix++) {
      const zx = ix * ZELLE, zz = iz * ZELLE;
      const faktor = DICHTE[feld.biom(zx, zz)] ?? 0;
      if (faktor === 0) continue;

      // Nachkommaanteil als Wahrscheinlichkeit, sonst verschwinden dünne Biome ganz.
      const erwartet = jeZelle * faktor;
      const anzahl = Math.floor(erwartet) + (hash(ix, iz, 7) < erwartet % 1 ? 1 : 0);

      for (let k = 0; k < anzahl && n < STREU_MAX; k++) {
        const x = zx + hash(ix, iz, k * 3 + 1) * ZELLE;
        const z = zz + hash(ix, iz, k * 3 + 2) * ZELLE;
        const d = Math.hypot(x - mx, z - mz);
        if (d > r) continue;

        // Am Rand ausdünnen, damit die Schicht nicht als Kreis endet.
        if (d > r * 0.75 && hash(ix, iz, k * 3 + 3) < (d - r * 0.75) / (r * 0.25)) continue;

        const hoehe = 0.18 + hash(ix, iz, k * 3 + 4) * 0.30;
        hilfe.position.set(x, feld.hoehe(x, z), z);
        hilfe.rotation.set(0, hash(ix, iz, k * 3 + 5) * Math.PI * 2, 0);
        hilfe.scale.set(0.9 + hash(ix, iz, k * 3 + 6) * 0.7, hoehe, 0.9 + hash(ix, iz, k * 3 + 7) * 0.7);
        hilfe.updateMatrix();
        mesh.setMatrixAt(n++, hilfe.matrix);
      }
    }
  }
  return n;
}
