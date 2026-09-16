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
 * `?bodenglatt=1` schaltet das Flat Shading des Bodens ab — **Messparameter, keine Umstellung** (D160).
 *
 * Gebaut, um dem Schachbrettmuster nachzugehen, das am Stauwehr über dem Boden liegt. **Ergebnis: Flat
 * Shading ist nicht die Ursache** — mit und ohne sind Bild und Messwerte gleich (Drittel 0,236/0,119/0,075
 * gegen 0,236/0,119/0,074). Das Muster steht auch auf dem nackten Terrain (`?aus=gras,baeume,bauwerke,
 * haeuser,menschen`) und ist damit **Farbe, nicht Beleuchtung**: die zellenweisen Biomfarben des
 * Höhenrasters, die mit der entsättigten Palette als Raster lesen. Gehört zu Stufe 3 (Karte).
 *
 * Der Regler bleibt, weil er diesen Ausschluss reproduzierbar macht — nicht als halbe Umstellung.
 */
const BODEN_GLATT: boolean = (() => {
  if (typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).get('bodenglatt') === '1';
})();

export function baueBodenMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: !BODEN_GLATT, roughness: 0.95, metalness: 0,
  });

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWeltPos;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vWeltPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + RAUSCH_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + VARIATION_GLSL)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + RELIEF_GLSL);
  };

  // Ohne eigenen Cache-Schlüssel teilt three das kompilierte Programm mit anderen
  // MeshStandardMaterials gleicher Konfiguration — und die hätten das Rauschen nicht.
  material.customProgramCacheKey = () => 'brachland-boden-v2';

  return material;
}
