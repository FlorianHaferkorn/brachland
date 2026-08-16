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

/**
 * Bodenmaterial für die LOD-Kacheln.
 *
 * `flatShading` bleibt an — die facettierte Optik ist Art Direction (ADR-0002).
 * Das Rauschen sitzt in der Farbe, nicht in der Normale: Eine Normalen-Störung
 * würde mit Flat Shading kämpfen und die Silhouetten aufweichen, auf denen der
 * Look beruht.
 */
export function baueBodenMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0,
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
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + VARIATION_GLSL);
  };

  // Ohne eigenen Cache-Schlüssel teilt three das kompilierte Programm mit anderen
  // MeshStandardMaterials gleicher Konfiguration — und die hätten das Rauschen nicht.
  material.customProgramCacheKey = () => 'brachland-boden-v1';

  return material;
}
