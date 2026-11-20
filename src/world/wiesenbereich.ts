import * as THREE from 'three';

const AUSLAUF = 9;

/** Weltrechteck an einer vermessenen Straße, mit einem weichen Übergang am Rand. */
export function baueWiesenbereich(strassenrahmen: THREE.Vector4) {
  const rahmen = new THREE.Vector4(strassenrahmen.x - 6, strassenrahmen.y - 6,
    strassenrahmen.x + 1 / strassenrahmen.z + 6, strassenrahmen.y + 1 / strassenrahmen.w + 6);
  const gewicht = (x: number, z: number) => THREE.MathUtils.smoothstep(
    Math.min(x - rahmen.x, z - rahmen.y, rahmen.z - x, rahmen.w - z), 0, AUSLAUF,
  );
  return { rahmen, gewicht };
}
export type Wiesenbereich = ReturnType<typeof baueWiesenbereich>;

export const WIESENBEREICH_GLSL = /* glsl */ `
uniform vec4 uWiesenbereich;
float wiesenbereichGewicht(vec2 ort) {
  vec2 abstand = min(ort - uWiesenbereich.xy, uWiesenbereich.zw - ort);
  return smoothstep(0.0, ${AUSLAUF.toFixed(1)}, min(abstand.x, abstand.y));
}
`;

/** Durchgehende Vegetationsinseln über beide Shader und sämtliche LOD-Stufen. */
export const WIESENWUCHS_GLSL = /* glsl */ `
float wiesenZufall(vec2 p) {
  p = fract(p * vec2(.3171, .3679));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}
float wiesenRauschen(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f *= f * (3.0 - 2.0 * f);
  return mix(mix(wiesenZufall(i), wiesenZufall(i + vec2(1,0)), f.x),
             mix(wiesenZufall(i + vec2(0,1)), wiesenZufall(i + vec2(1,1)), f.x), f.y);
}
vec2 wiesenWuchs(vec2 p) {
  vec2 lokal = p - uWiesenbereich.xy;
  float stauden = smoothstep(.28,.74, .67*wiesenRauschen(lokal*.32) + .33*wiesenRauschen(lokal*1.43));
  float trocken = smoothstep(.44,.81, .73*wiesenRauschen(lokal*.18+23.0) + .27*wiesenRauschen(lokal*1.71));
  return vec2(stauden, trocken);
}
`;
