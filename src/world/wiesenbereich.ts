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
