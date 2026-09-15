/**
 * BRACHLAND — Nahfeld-Streuschicht
 *
 * Das Problem, das die erste Live-Sicht freigelegt hat: Im 10-m-Umkreis um den
 * Spieler stand **kein einziges Objekt**. Ohne etwas Bekanntes am Boden fehlt dem
 * Auge der Maßstab, und das Gelände wirkt als Fläche, egal wie fein es tesselliert ist.
 *
 * Diese Schicht ist bewusst **kein** Prop-System: Sie wird nicht gespeichert, nicht
 * gechunkt und nicht auf Entfernung sortiert. Sie existiert nur im Nahbereich, wird
 * beim Gehen nachgezogen und ist über die Weltposition deterministisch — derselbe
 * Fleck trägt bei jedem Besuch dieselben Büschel.
 */
import * as THREE from 'three';
import { gesperrt } from './bauwerke.js';
import { PALETTE } from './palette.js';
import type { Biom } from './osm.js';
import type { HoehenFeld } from './lod.js';

/** Radius, in dem gestreut wird. Darüber übernehmen die echten Props. */
export const STREU_RADIUS = 22;
/** Büschel je Quadratmeter auf voller Dichte. */
export const STREU_JE_QM = 2.40;
/** Obergrenze der Grasinstanzen. */
export const STREU_MAX = 5200;
/** Kleinzeug ist seltener als Gras — Steine liegen nicht flächendeckend. */
export const KLEIN_JE_QM = 0.22;
export const KLEIN_MAX = 900;
/** Ab dieser Bewegung wird nachgezogen. Bei 7 m/s knapp einmal je Sekunde. */
export const STREU_NACHZIEHEN = 6;

/**
 * Dichtefaktor je Biom. Fels und Wasser bleiben grasfrei — dort wäre Gras schlicht
 * falsch, und der Kontrast macht die Biome überhaupt erst lesbar.
 */
const DICHTE: Record<Biom, number> = {
  wiese: 1.0, gebuesch: 0.8, wald: 0.55, acker: 0.35, ruine: 0.45,
  siedlung: 0.25, industrie: 0.15, fels: 0.12, unbekannt: 0.3, wasser: 0,
};

/** Kleinzeug verteilt sich anders als Gras: viel auf Fels und in Ruinen, wenig auf der Wiese. */
const KLEIN_DICHTE: Record<Biom, number> = {
  fels: 1.0, ruine: 0.9, wald: 0.7, gebuesch: 0.5, industrie: 0.5,
  acker: 0.25, wiese: 0.22, siedlung: 0.3, unbekannt: 0.3, wasser: 0,
};

/** Deterministisches Rauschen — gleicher Punkt, gleiches Ergebnis. */
function hash(x: number, y: number, k: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(k | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Ein Büschel aus sechs gebogenen Halmen — 36 Dreiecke (D121; davor fünf
 * flache Zacken mit 10).
 *
 * Feingliedriger als die erste Fassung (drei breite Klingen): schmalere Halme,
 * unterschiedlich hoch, leicht auseinanderfallend. Ein Büschel soll aus Halmen
 * bestehen, nicht aus Zacken.
 *
 * Die Vertex-Farbe läuft von dunkel am Fuß zu hell an der Spitze. Das ersetzt die
 * Textur, die es hier bewusst nicht gibt (ADR-0002): Ohne den Verlauf wäre jedes
 * Büschel ein einfarbiger Fleck und würde sich vom Boden nicht absetzen.
 */
export function baueBueschelGeometrie(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const fuss = new THREE.Color(PALETTE.streu.grasFuss);
  const spitze = new THREE.Color(PALETTE.streu.grasSpitze);

  /**
   * Seit D121 **sechs gebogene Halme** statt fünf flacher Zacken: Jeder Halm ist
   * ein Viereck bis zur halben Höhe und ein Dreieck bis zur Spitze, in der
   * Mitte nach aussen geknickt. Der Knick ist der Unterschied — ein gerader
   * Zacken liest sich von oben als Stern, ein geknickter Halm als Gras, weil
   * seine Spitze über den Fuss hinausragt und der Umriss eine Kurve wird.
   * Dieselbe Bauart wie die Grasbüschel-Attrappen (`propbau.ts`), damit die
   * beiden Systeme eine Pflanze sind. 36 statt 10 Dreiecke je Büschel; bei
   * 5.200 Büscheln im Nahring sind das +135.000 Dreiecke, nach G-111 unter der
   * Messschwelle — die Aufrufe bleiben bei einem.
   */
  const mitte = fuss.clone().lerp(spitze, 0.45);
  const HALME = 6;
  const F = (c: THREE.Color) => [c.r, c.g, c.b];
  for (let i = 0; i < HALME; i++) {
    const w = (i / HALME) * Math.PI * 2 + hash(i, 7, 3) * 0.6;
    const breite = 0.03 + hash(i, 11, 5) * 0.025;
    const dx = Math.cos(w) * breite, dz = Math.sin(w) * breite;
    const hoehe = 0.55 + hash(i, 13, 9) * 0.45;
    // Neigung: in der Mitte wenig, an der Spitze mehr — der Halm biegt sich.
    const n1 = 0.06 + hash(i, 17, 2) * 0.06, n2 = 0.22 + hash(i, 19, 4) * 0.16;
    const fx = Math.cos(w) * 0.035, fz = Math.sin(w) * 0.035;
    const a: [number, number, number] = [fx - dx, 0, fz - dz];
    const b: [number, number, number] = [fx + dx, 0, fz + dz];
    const m1: [number, number, number] = [fx + Math.cos(w) * n1 - dx * 0.7, hoehe * 0.5, fz + Math.sin(w) * n1 - dz * 0.7];
    const m2: [number, number, number] = [fx + Math.cos(w) * n1 + dx * 0.7, hoehe * 0.5, fz + Math.sin(w) * n1 + dz * 0.7];
    const c: [number, number, number] = [fx + Math.cos(w) * n2, hoehe, fz + Math.sin(w) * n2];
    // Vorder- und Rückseite mit umgekehrter Wicklung — deshalb braucht das
    // Material KEIN DoubleSide: Aus jeder Blickrichtung ist genau eine vorne.
    for (const seite of [1, -1]) {
      const [p, q] = seite > 0 ? [a, b] : [b, a];
      const [r, s] = seite > 0 ? [m1, m2] : [m2, m1];
      pos.push(...p, ...q, ...s, ...p, ...s, ...r, ...r, ...s, ...c);
      col.push(...F(fuss), ...F(fuss), ...F(mitte), ...F(fuss), ...F(mitte), ...F(mitte), ...F(mitte), ...F(mitte), ...F(spitze));
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));

  // Normalen senkrecht nach oben statt aus der Geometrie berechnet.
  //
  // `computeVertexNormals()` gäbe Halmen waagerechte Normalen — die bekommen von
  // einer tief stehenden Sonne und einem Himmelslicht fast nichts ab und rendern als
  // schwarze Zacken. Nach oben zeigende Normalen lassen die Büschel dasselbe Licht
  // aufnehmen wie der Boden, auf dem sie stehen.
  const hoch: number[] = [];
  for (let i = 0; i < pos.length / 3; i++) hoch.push(0, 1, 0);
  g.setAttribute('normal', new THREE.Float32BufferAttribute(hoch, 3));
  return g;
}

/**
 * Kleinzeug: Steine, Äste, Wurzelstücke — 5 Formen in einer Geometrie ist zu teuer,
 * also eine gemischte Form, die je nach Drehung und Stauchung mal Stein, mal Ast wirkt.
 *
 * Ein flacher, kantiger Körper. Stark gestaucht liest er sich als Stein, lang gezogen
 * als Ast. Die Instanz entscheidet über die Skalierung, nicht die Geometrie.
 */
export function baueKleinzeugGeometrie(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.5, 0).toNonIndexed();
  const stein = new THREE.Color(PALETTE.streu.stein);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i*3] = stein.r; col[i*3+1] = stein.g; col[i*3+2] = stein.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Material der Streuschicht — mit Wind.
 *
 * Der Wind sitzt im Vertex-Shader, nicht in der CPU: 5.000 Instanzen je Bild neu zu
 * berechnen wäre der teuerste Teil der ganzen Szene. Die Biegung wächst quadratisch
 * mit der Halmhöhe, also bewegt sich die Spitze und der Fuß bleibt stehen.
 *
 * Die Phase kommt aus der Weltposition der Instanz. Ohne sie schwingt die ganze
 * Wiese im Gleichtakt — das sieht sofort nach Computer aus. Mit ihr läuft eine Böe
 * als Welle über das Feld.
 */
export function baueStreuMaterial(amplitude = 0.16): {
  material: THREE.MeshStandardMaterial;
  setzeZeit(t: number): void;
} {
  const zeit = { value: 0 };
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: false, roughness: 1, metalness: 0,
    side: THREE.FrontSide,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uZeit = zeit;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uZeit;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          // Instanzposition steckt in der vierten Spalte der Instanzmatrix.
          vec3 wurzel = instanceMatrix[3].xyz;
          float phase = wurzel.x * 0.11 + wurzel.z * 0.085;
          float hoehe = clamp(transformed.y, 0.0, 1.0);
          float biegung = hoehe * hoehe * ${amplitude.toFixed(3)};
          // Zwei Frequenzen: eine tragende Böe, eine feine Unruhe darüber.
          float boe = sin(uZeit * 0.9 + phase) * 0.7 + sin(uZeit * 2.3 + phase * 1.7) * 0.3;
          transformed.x += boe * biegung;
          transformed.z += cos(uZeit * 0.7 + phase * 1.3) * biegung * 0.45;
        }`);
  };
  material.customProgramCacheKey = () => 'brachland-streu-wind-v1';

  return { material, setzeZeit: (t) => { zeit.value = t; } };
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
  feld: HoehenFeld, mx: number, mz: number, mesh: THREE.InstancedMesh, faktor = 1,
): number {
  return streue(feld, mx, mz, mesh, DICHTE, STREU_JE_QM * faktor, STREU_MAX, 0, (h1, h2, h3) => {
    const hoehe = 0.18 + h1 * 0.30;
    hilfe.rotation.set(0, h2 * Math.PI * 2, 0);
    hilfe.scale.set(0.9 + h3 * 0.7, hoehe, 0.9 + h3 * 0.7);
  });
}

/** Steine, Äste, Wurzelstücke — flach und klein, ohne Wind. */
export function streueKleinzeug(
  feld: HoehenFeld, mx: number, mz: number, mesh: THREE.InstancedMesh, faktor = 1,
): number {
  return streue(feld, mx, mz, mesh, KLEIN_DICHTE, KLEIN_JE_QM * faktor, KLEIN_MAX, 991, (h1, h2, h3) => {
    // Unter 0,45 wird der Körper zum Ast gestreckt, darüber zum flachen Stein gestaucht.
    const ast = h1 < 0.45;
    const gr = 0.10 + h3 * 0.22;
    hilfe.rotation.set(ast ? Math.PI * 0.5 : h1 * 0.3, h2 * Math.PI * 2, h3 * 0.4);
    if (ast) hilfe.scale.set(gr * 0.28, gr * 2.6, gr * 0.28);
    else hilfe.scale.set(gr * 1.4, gr * 0.55, gr * 1.2);
  });
}

function streue(
  feld: HoehenFeld, mx: number, mz: number, mesh: THREE.InstancedMesh,
  dichte: Record<Biom, number>, jeQm: number, max: number, salz: number,
  form: (h1: number, h2: number, h3: number) => void,
): number {
  const ZELLE = 2;
  const jeZelle = jeQm * ZELLE * ZELLE;
  const r = STREU_RADIUS;
  let n = 0;

  const x0 = Math.floor((mx - r) / ZELLE), x1 = Math.ceil((mx + r) / ZELLE);
  const z0 = Math.floor((mz - r) / ZELLE), z1 = Math.ceil((mz + r) / ZELLE);

  for (let iz = z0; iz <= z1 && n < max; iz++) {
    for (let ix = x0; ix <= x1 && n < max; ix++) {
      const zx = ix * ZELLE, zz = iz * ZELLE;
      const faktor = dichte[feld.biom(zx, zz)] ?? 0;
      if (faktor === 0) continue;

      // Nachkommaanteil als Wahrscheinlichkeit, sonst verschwinden dünne Biome ganz.
      const erwartet = jeZelle * faktor;
      const anzahl = Math.floor(erwartet) + (hash(ix, iz, salz + 7) < erwartet % 1 ? 1 : 0);

      for (let k = 0; k < anzahl && n < max; k++) {
        const b = salz + k * 8;
        const x = zx + hash(ix, iz, b + 1) * ZELLE;
        const z = zz + hash(ix, iz, b + 2) * ZELLE;
        const d = Math.hypot(x - mx, z - mz);
        if (d > r) continue;
        if (gesperrt(x, z, 'streu')) continue;   // Hof eines Bauwerks (ADR-0006)
        // Am Rand ausdünnen, damit die Schicht nicht als Kreis endet.
        if (d > r * 0.75 && hash(ix, iz, b + 3) < (d - r * 0.75) / (r * 0.25)) continue;

        hilfe.position.set(x, feld.hoehe(x, z), z);
        form(hash(ix, iz, b + 4), hash(ix, iz, b + 5), hash(ix, iz, b + 6));
        hilfe.updateMatrix();
        mesh.setMatrixAt(n++, hilfe.matrix);
      }
    }
  }
  return n;
}
