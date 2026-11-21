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
 * Fleck trägt bei jedem Besuch dieselben Steine und Äste.
 *
 * D366: Die Grasbüschel dieser Schicht (sechs breite, gebogene Halme, 18–48 cm hoch, bis 17 cm breit, auch auf
 * Wegen und am Hof-Vorfeld) sind entfernt — sie lasen als grosse, flache, hellgrüne Blattkarten (Flo, 21.11.2026:
 * „mach mal die grashalme bitte weg“). Gras tragen jetzt nur der Grasteppich (`grasteppich.ts`, feine Einzelhalme).
 */
import * as THREE from 'three';
import { gesperrt } from './bauwerke.js';
import { PALETTE } from './palette.js';
import type { Biom } from './osm.js';
import type { HoehenFeld } from './lod.js';

/** Radius, in dem gestreut wird. Darüber übernehmen die echten Props. */
export const STREU_RADIUS = 22;
/** Steine und Äste je Quadratmeter auf voller Dichte — sie liegen nicht flächendeckend. */
export const KLEIN_JE_QM = 0.22;
export const KLEIN_MAX = 900;
/** Ab dieser Bewegung wird nachgezogen. Bei 7 m/s knapp einmal je Sekunde. */
export const STREU_NACHZIEHEN = 6;

/** Kleinzeug je Biom: viel auf Fels und in Ruinen, wenig auf der Wiese. */
const KLEIN_DICHTE: Record<Biom, number> = {
  fels: 1.0, ruine: 0.9, wald: 0.7, gebuesch: 0.5, industrie: 0.5,
  acker: 0.25, wiese: 0.22, siedlung: 0.3, unbekannt: 0.3, wasser: 0, moor: 0.35,
};

/** Deterministisches Rauschen — gleicher Punkt, gleiches Ergebnis. */
function hash(x: number, y: number, k: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(k | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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

const hilfe = new THREE.Object3D();
/** D292: Ton je Instanz als Faktor auf die Steinfarbe der Geometrie (three multipliziert Instanz- und Eckfarbe). */
const AST_FAKTOR = (() => {
  const a = new THREE.Color(PALETTE.streu.ast), s = new THREE.Color(PALETTE.streu.stein);
  return new THREE.Color(a.r / s.r, a.g / s.g, a.b / s.b);
})();
const kleinTon = new THREE.Color();

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
    /**
     * D292: Äste in Holzfarbe, Steine mit Helligkeitsstreuung, beide zu gut einem Drittel im Boden. Vorher lagen
     * graue, scharfkantige Körper obenauf und lasen im Bild als weisse Glasscherben (Ledger A-19).
     */
    // Steine auf die Helligkeit des Scan-Bodens (D284/D285) gezogen: mit der Palettenfarbe standen sie im
    // Prüfbild 15.11.2026 dreimal so hell wie der Boden daneben und lasen weiter als Scherben. 36–56 % reichten nicht
    // (die flache Oberseite fängt Sonne und Himmel voll), daher 16–26 %.
    const r = (h2 * 7.31) % 1;
    if (ast) kleinTon.copy(AST_FAKTOR).multiplyScalar(0.72 + r * 0.3);
    else { const hell = 0.16 + r * 0.1; kleinTon.setRGB(hell * 1.04, hell, hell * 0.9); }
    hilfe.position.y -= (ast ? gr * 0.28 : gr * 0.55) * 0.5 * 0.4;
    return kleinTon;
  });
}

function streue(
  feld: HoehenFeld, mx: number, mz: number, mesh: THREE.InstancedMesh,
  dichte: Record<Biom, number>, jeQm: number, max: number, salz: number,
  form: (h1: number, h2: number, h3: number) => THREE.Color | void,
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
        const ton = form(hash(ix, iz, b + 4), hash(ix, iz, b + 5), hash(ix, iz, b + 6));
        hilfe.updateMatrix();
        if (ton) mesh.setColorAt(n, ton);
        mesh.setMatrixAt(n++, hilfe.matrix);
      }
    }
  }
  return n;
}
