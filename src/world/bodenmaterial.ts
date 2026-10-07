/**
 * BRACHLAND — Bodenmaterial mit prozeduraler Oberflächenvariation
 *
 * Das Problem: Der Boden ist Vertex-Farbe je Dreieck. Bei LOD0 sind das 2-m-Quads,
 * darüber 4, 8, 16 m — Flächen, die als Flächen lesen. Ohne Textur fehlt genau die
 * Ebene zwischen „Geometrie" und „Farbe", auf der ein Auge Oberfläche erkennt.
 *
 * Die Lösung greift ADR-0002 nicht an. „Keine Texturen" heißt dort: keine
 * Textur-*Assets* — wegen des 60-MB-Offline-Budgets und weil Texturen einen
 * Art-Stil erzwingen, den ein Solo-Projekt nicht durchhält. Rauschen im Shader
 * kostet **null Bytes** und wird aus der Weltposition berechnet, ist also über
 * Kachelgrenzen und LOD-Stufen hinweg stabil.
 *
 * Zwei Oktaven mit Absicht:
 * - fein (~1,4 m): bricht die einzelne Fläche auf, wirkt nur im Nahbereich
 * - grob (~9 m): Flecken, die auch auf Entfernung Struktur geben und die
 *   Kachelgrenzen optisch übertönen
 */
import * as THREE from 'three';
import { HIMMEL_UNIFORM } from './windmaterial.js';
import { PALETTE } from './palette.js';

/**
 * Himmelsanteil des Geländes um ein Set-Piece (D171, `tools/himmelboden.ts`): ein Raster von
 * 0,5 m, als Datentextur. Ein Slot — die Set-Pieces liegen über 1,5 km auseinander, sichtbar ist
 * immer höchstens eins. Ausserhalb des Rahmens (und ohne Raster) ist der Faktor 1.
 */
const LEER = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType);
LEER.needsUpdate = true;
const BODEN_HIMMEL = {
  karte: { value: LEER as THREE.Texture },
  /** x0, z0, 1/Breite, 1/Tiefe in Weltmetern; Breite 0 heisst: aus. */
  rahmen: { value: new THREE.Vector4(0, 0, 0, 0) },
};
let bodenHimmelName: string | null = null;

/** Raster des Set-Pieces `name` laden (oder mit `null` abschalten). Mehrfachaufruf ist billig. */
export function setzeBodenHimmel(name: string | null): void {
  if (name === bodenHimmelName) return;
  bodenHimmelName = name;
  if (!name) { BODEN_HIMMEL.rahmen.value.set(0, 0, 0, 0); return; }
  Promise.all([
    fetch(`/bauten/${name}-himmel.json`).then(r => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch(`/bauten/${name}-himmel.bin`).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))),
  ]).then(([m, bin]: [{ x0: number; z0: number; schritt: number; breite: number; tiefe: number }, ArrayBuffer]) => {
    if (bodenHimmelName !== name) return;
    const t = new THREE.DataTexture(new Uint8Array(bin), m.breite, m.tiefe, THREE.RedFormat, THREE.UnsignedByteType);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.unpackAlignment = 1;
    t.needsUpdate = true;
    const alt = BODEN_HIMMEL.karte.value;
    BODEN_HIMMEL.karte.value = t;
    if (alt !== LEER) alt.dispose();
    BODEN_HIMMEL.rahmen.value.set(m.x0, m.z0, 1 / (m.breite * m.schritt), 1 / (m.tiefe * m.schritt));
  }).catch(() => { /* kein Raster: Faktor 1 */ });
}

const HIMMEL_GLSL = /* glsl */ `
  // D171: Fülllicht dämpfen, wo Mauern und Kronen den Himmel verdecken. Zum Rand hin auf 1,
  // damit der Rahmen im Bild keine Kante zeichnet.
  if (uBodenRahmen.z > 0.0) {
    vec2 uvH = (vWeltPos.xz - uBodenRahmen.xy) * uBodenRahmen.zw;
    if (uvH.x > 0.0 && uvH.x < 1.0 && uvH.y > 0.0 && uvH.y < 1.0) {
      float kante = smoothstep(0.0, 0.03, min(min(uvH.x, 1.0 - uvH.x), min(uvH.y, 1.0 - uvH.y)));
      float sicht = mix(1.0, texture2D(uBodenHimmel, uvH).r, kante);
      reflectedLight.indirectDiffuse *= mix(1.0, sicht, uHimmel);
    }
  }
`;

const RAUSCH_GLSL = /* glsl */ `
varying vec3 vWeltPos;

float bodenHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float bodenRauschen(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = bodenHash(i);
  float b = bodenHash(i + vec2(1.0, 0.0));
  float c = bodenHash(i + vec2(0.0, 1.0));
  float d = bodenHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`;

const VARIATION_GLSL = /* glsl */ `
  float fein = bodenRauschen(vWeltPos.xz * 0.72);
  float grob = bodenRauschen(vWeltPos.xz * 0.115);

  // Helligkeit: fein bricht die Fläche, grob macht Flecken über größere Strecken.
  float helligkeit = 1.0 + (fein - 0.5) * 0.26 + (grob - 0.5) * 0.20;
  diffuseColor.rgb *= helligkeit;

  // Trockene Kuppen leicht ins Ockerfarbene, feuchte Senken ins Grüne.
  // Sehr zurückhaltend — der Biom-Farbton soll führen, nicht das Rauschen.
  vec3 trocken = vec3(1.06, 1.01, 0.88);
  vec3 feucht  = vec3(0.94, 1.03, 0.95);
  diffuseColor.rgb *= mix(feucht, trocken, grob);
`;

/**
 * D201: Fels an steilen Hängen, Schutt am Übergang. Bisher trug nur die Biomfarbe des Höhenrasters
 * den Hang — ein 35°-Hang im Wald war so grün wie der Talboden. Gesteuert über die **Weltnormale**
 * (seit D201 glatt aus dem Höhenfeld) mit verrauschter Schwelle, damit die Grenze keine Höhenlinie
 * zeichnet. Farben aus der Palette (`fels.b`, `fels.schutt`), nicht im Shader erfunden.
 */
const HANG_GLSL = /* glsl */ `
  float hangRausch = bodenRauschen(vWeltPos.xz * 0.31) - 0.5;
  float steil = 1.0 - smoothstep(0.66, 0.86, vWeltNormal.y + hangRausch * 0.16);
  float schutt = 1.0 - smoothstep(0.78, 0.93, vWeltNormal.y + hangRausch * 0.12);
  diffuseColor.rgb = mix(diffuseColor.rgb, uSchutt, schutt * 0.45);
  diffuseColor.rgb = mix(diffuseColor.rgb, uFels * (0.85 + hangRausch * 0.4), steil);
`;

const RELIEF_GLSL = /* glsl */ `
  // Blender mat_boden: Rauschen bei 6/m. Unser zweidimensionales Wertrauschen
  // hat steilere Einzelhaenge: 8 mm statt .15 m * .3 verhindern ein Kornraster.
  // Weltkoordinaten halten die Koernung beim Kachel-/LOD-Wechsel ortsfest.
  vec2 kornOrt = vWeltPos.xz * 6.0;
  float pixelBreite = max(length(dFdx(kornOrt)), length(dFdy(kornOrt)));
  float feinSichtbar = 1.0 - smoothstep(0.25, 0.75, pixelBreite);
  float korn = bodenRauschen(kornOrt);
  vec2 detailOrt = mat2(0.8, -0.6, 0.6, 0.8) * kornOrt * 2.0;
  float detail = bodenRauschen(detailOrt);
  float detailSichtbar = 1.0 - smoothstep(0.125, 0.375, pixelBreite);
  float hoehe = ((korn - 0.5) * 0.7 + (detail - 0.5) * 0.3 * detailSichtbar) * 0.008;

  // Oberflaechengradient nach Mikkelsen (wie three.js bumpmap_pars_fragment).
  // Unnormierte Ableitungen passen zur Hoehe in Metern; dadurch ist das Relief
  // unabhaengig von Aufloesung und Blickabstand. Die Geometrienormale bleibt Basis.
  vec3 dx = dFdx(-vViewPosition);
  vec3 dy = dFdy(-vViewPosition);
  vec3 querY = cross(dy, normal);
  vec3 querX = cross(normal, dx);
  float determinante = dot(dx, querY) * faceDirection;
  vec3 gradient = sign(determinante) * (dFdx(hoehe) * querY + dFdy(hoehe) * querX);
  vec3 reliefNormal = normalize(max(abs(determinante), 1e-8) * normal - gradient);
  normal = normalize(mix(normal, reliefNormal, feinSichtbar));
`;

/**
 * Bodenmaterial für die LOD-Kacheln.
 *
 * Flat Shading traegt die Gelaendeform. Das kleinere Normalenrelief folgt
 * ADR-0006 und der Blender-Quelle; es veraendert weder Silhouette noch Kollision.
 */
/**
 * `?bodenkantig=1` stellt das alte Flat Shading wieder her — **Vergleichsschalter** (D201).
 *
 * Bis D200 war Flat Shading die Vorgabe und `?bodenglatt=1` der Schalter dagegen. D160 maß mit ihm
 * „kein Unterschied“ — zu Recht, aber aus dem falschen Grund: Die Kachelgeometrie war nicht
 * indiziert, und `computeVertexNormals()` gab ohnehin nur Flächennormalen. Seit D201 kommen die
 * Normalen aus dem Höhenfeld, und glatt ist die Vorgabe (ADR-0012: Soulframe als Messlatte —
 * Gelände liest sich dort als Form, nicht als Facette).
 */
const BODEN_KANTIG: boolean = (() => {
  if (typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).get('bodenkantig') === '1';
})();

export function baueBodenMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: BODEN_KANTIG, roughness: 0.95, metalness: 0,
  });

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWeltPos;\nvarying vec3 vWeltNormal;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vWeltPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vWeltNormal = normalize(mat3(modelMatrix) * objectNormal);',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + RAUSCH_GLSL + '\nvarying vec3 vWeltNormal;\nuniform vec3 uFels;\nuniform vec3 uSchutt;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + VARIATION_GLSL + HANG_GLSL)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + RELIEF_GLSL)
      .replace('#include <common>', '#include <common>\nuniform sampler2D uBodenHimmel;\nuniform vec4 uBodenRahmen;\nuniform float uHimmel;')
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + HIMMEL_GLSL);
    shader.uniforms.uBodenHimmel = BODEN_HIMMEL.karte;
    shader.uniforms.uBodenRahmen = BODEN_HIMMEL.rahmen;
    shader.uniforms.uHimmel = HIMMEL_UNIFORM;
    shader.uniforms.uFels = { value: new THREE.Color(PALETTE.fels.b) };
    shader.uniforms.uSchutt = { value: new THREE.Color(PALETTE.fels.schutt) };
  };

  // Ohne eigenen Cache-Schlüssel teilt three das kompilierte Programm mit anderen
  // MeshStandardMaterials gleicher Konfiguration — und die hätten das Rauschen nicht.
  material.customProgramCacheKey = () => 'brachland-boden-v4' + (BODEN_KANTIG ? '-kantig' : '');

  return material;
}
