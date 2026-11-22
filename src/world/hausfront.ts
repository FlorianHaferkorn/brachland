/** D297: Materialpass der Hausfront-Probe; grobe Verwitterung statt zusätzlichem Pixelkorn. */
import { FENSTERRAUM_GLSL } from './fensterraum.js';

export const HAUSFRONT_PARS = /* glsl */ `
varying vec3 vRaumUv;
${FENSTERRAUM_GLSL}
float hausfrontHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float hausfrontRauschen(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hausfrontHash(i), hausfrontHash(i + vec2(1,0)), f.x),
             mix(hausfrontHash(i + vec2(0,1)), hausfrontHash(i + vec2(1,1)), f.x), f.y);
}
`;

export const HAUSFRONT_FARBE = /* glsl */ `
  vec3 frontN = normalize(vHausNormal);
  vec3 frontT = abs(frontN.y) > 0.97 ? vec3(1,0,0) : normalize(cross(frontN, vec3(0,1,0)));
  vec2 frontP = vec2(dot(vHausPos, frontT), vHausPos.y);
  float frontFleck = hausfrontRauschen(frontP * vec2(0.32, 0.55));
  float frontLaeufer = hausfrontRauschen(frontP * vec2(2.7, 0.14));
  if (scanR < 0.5) {
    // Kalkputz: breite, leicht warme Reparaturstellen; Wetterläufer bleiben im Material.
    vec3 kalk = diffuseColor.rgb * mix(vec3(0.79,0.83,0.81), vec3(1.08,1.05,0.98), frontFleck);
    diffuseColor.rgb = kalk * (0.88 + 0.16 * frontLaeufer);
  } else if (scanR < 1.5) {
    // Vergraute Bretter mit ortsfesten Fugen und unterschiedlichen Wetterseiten.
    float l = dot(diffuseColor.rgb, vec3(0.2126,0.7152,0.0722));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l) * vec3(0.88,0.96,1.02), 0.35 + 0.30 * frontFleck);
    float brett = frontP.x / 0.22;
    float fuge = min(fract(brett), 1.0-fract(brett));
    float pixel = max(fwidth(brett), 0.001);
    float deckung = smoothstep(0.015 - pixel, 0.015 + pixel, fuge);
    // Unterpixel-Fugen gehen in ihre mittlere Deckung über, statt die Ferne abzudunkeln.
    deckung = mix(deckung, 0.97, smoothstep(0.15, 0.4, pixel));
    diffuseColor.rgb *= (0.66 + 0.28 * frontLaeufer) * mix(0.65,1.0,deckung);
  } else if (scanR < 2.5) {
    // Dachhaut dunkler und gegliedert; das vorhandene Scanrelief bleibt führend.
    diffuseColor.rgb *= 0.76 + 0.18 * frontFleck;
  } else if (scanR > 4.5) {
    vec3 blick = normalize(cameraPosition - vHausPos);
    vec3 lokal = vec3(dot(blick, frontT), blick.y, max(0.015, dot(blick, frontN)));
    // Der Raum erhält nur einen Teil des Aussenlichts; sonst liest er
    // wie eine helle aufgeklebte Gardine. PBR-Glanz liegt weiter darüber.
    diffuseColor.rgb = hausFensterraum(clamp(vRaumUv.xy, 0.0, 1.0), lokal, vRaumUv.z) * 0.5;
  } else if (scanR > 3.5) {
    // Helle Rahmen werden vom Putz getrennt, ohne Tür und Läden aufzuhellen.
    float l = dot(diffuseColor.rgb, vec3(0.2126,0.7152,0.0722));
    diffuseColor.rgb *= mix(1.0,0.78,smoothstep(0.26,0.4,l));
  }
`;
