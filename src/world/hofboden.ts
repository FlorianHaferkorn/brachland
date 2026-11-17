/** D307: ortsfeste Hofränder und abgetretene Vorfelder der tatsächlich freien Türen. */
export interface HofbodenZugang {
  eingang: [number, number];
  /** Einheitsnormal der freien Außenwand, wie in bestimmeHofhaeuser. */
  vorne: [number, number];
}

/** Fester Uniformumfang der begrenzten Acht-Häuser-Probe. Null-Eingänge belegen keinen Slot. */
export const HOF_ZUGANG_MAX = 8;

function glatt(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Zwei ruhige Maßstäbe statt einzelner hektischer Körner an der Außenkante; höchstens ±0,7m. */
export function hofbodenRand(u: number, v: number): number {
  if (!Number.isFinite(u) || !Number.isFinite(v)) return 0;
  return .44 * Math.sin(u * .63 + v * .27) * Math.sin(v * .91 - u * .19)
    + .26 * Math.sin(u * 1.37 - v * .41 + 1.7) * Math.sin(v * 1.13 + u * .35);
}

/**
 * Die Maske bleibt vollständig im gegen alle Nachbargrundrisse geprüften D304-Rechteck:
 * seitlich ±0,725m, vorwärts 0,025–1,65m. Die letzten 10cm laufen weich aus;
 * der seitliche Rand variiert langsam um 5cm. Keine fiktiven Türen bei eingang=null.
 */
export function hofbodenZugang(x: number, z: number,
  haeuser: readonly { eingang: [number, number] | null; vorne: [number, number] }[]): number {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
  let anteil = 0, zahl = 0;
  for (const h of haeuser) {
    if (!h.eingang) continue;
    if (zahl++ >= HOF_ZUGANG_MAX) break;
    const dx = x - h.eingang[0], dz = z - h.eingang[1];
    const u = dx * h.vorne[1] - dz * h.vorne[0];
    const v = dx * h.vorne[0] + dz * h.vorne[1];
    const halb = .675 + .05 * Math.sin(v * 3.1 + .7);
    const hier = (1 - glatt(halb - .1, halb, Math.abs(u)))
      * glatt(.025, .125, v) * (1 - glatt(1.55, 1.65, v));
    anteil = Math.max(anteil, hier);
  }
  return anteil;
}

/** Dieselben lokalen Achsen und Polynome wie oben. Uniforms werden einmal beim Weltaufbau gesetzt. */
export const HOF_ZUGANG_PARS = /* glsl */ `
uniform vec4 uHofZugaenge[8];
uniform int uHofZugangZahl;
float hofBodenRand(vec2 q) {
  return 0.44 * sin(q.x * 0.63 + q.y * 0.27) * sin(q.y * 0.91 - q.x * 0.19)
    + 0.26 * sin(q.x * 1.37 - q.y * 0.41 + 1.7) * sin(q.y * 1.13 + q.x * 0.35);
}
float hofZugang(vec2 p) {
  float anteil = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uHofZugangZahl) break;
    vec4 h = uHofZugaenge[i];
    vec2 d = p - h.xy;
    float u = dot(d, vec2(h.w, -h.z));
    float v = dot(d, h.zw);
    float halb = 0.675 + 0.05 * sin(v * 3.1 + 0.7);
    float hier = (1.0 - smoothstep(halb - 0.1, halb, abs(u)))
      * smoothstep(0.025, 0.125, v) * (1.0 - smoothstep(1.55, 1.65, v));
    anteil = max(anteil, hier);
  }
  return anteil;
}
`;
