/**
 * BRACHLAND — Nebel mit Auslauf und Höhendunst (D204, ADR-0012)
 *
 * three.js rechnet „linearen“ Nebel als `smoothstep(nah, fern, Tiefe)`. Bei `fern` ist also alles
 * zu 100 % Nebelfarbe, dahinter stand eine flache helle Wand: An der Felsflanke war jenseits von
 * rund 230 m (`nebelFern` von `zielbild`) keine einzige Kontur mehr (D203, Befund). Soulframe-Bilder
 * (Messlatte, ADR-0012) leben von der Staffelung: Kamm hinter Kamm, jeder heller und blasser.
 *
 * Zwei Änderungen, beide in denselben Shader-Bausteinen, die jedes Material mit `fog` ohnehin nimmt:
 *
 * 1. **Auslauf mit Decke.** `MAX · (1 − exp(−(t·k)^1,5))` mit `t = (Tiefe − nah) / (fern − nah)`,
 *    `k` so, dass bei t = 0,5 wie beim alten `smoothstep` rund 0,49 stehen — Nah- und Mittelbereich,
 *    an denen das Bildtor eingemessen ist, bleiben. Bei `fern` 80 % statt 100 %, und die Kurve
 *    erreicht nie mehr als `NEBEL_MAX` (90 %): Auch der fernste Kamm behält ein Zehntel seines Tons
 *    und steht als blasse Silhouette vor dem Himmel. Die erste Fassung (85 % bei `fern`, Decke
 *    100 %) liess an der Flanken-Kamera die Ebene jenseits 230 m weiter als Wand stehen (D204).
 * 2. **Höhendunst.** Was über der Kamera liegt, steht in dünnerem Dunst: Faktor bis auf `OBEN_REST`
 *    herab, mit `OBEN_SKALA` m Abfall. Täler bleiben voll, Kämme ragen heraus.
 *
 * `?nebel=alt` stellt das alte `smoothstep` zum Vergleich her.
 */
import * as THREE from 'three';

/** Höchster Nebelanteil, auch im Unendlichen (vorher 1,0). */
export const NEBEL_MAX = 0.9;
/** Nebelanteil auf halbem Weg von `nah` nach `fern` — wie das alte `smoothstep` (0,5). */
export const NEBEL_BEI_HALB = 0.49;
/** Steilheit der Kurve, abgeleitet aus den beiden Werten oben. */
const K = 2 * Math.pow(-Math.log(1 - NEBEL_BEI_HALB / NEBEL_MAX), 1 / 1.5);
/** Dünnster Dunst hoch über der Kamera, als Anteil. */
export const OBEN_REST = 0.45;
/** Meter über der Kamera, auf denen der Dunst auf 1/e seines Abstands zu `OBEN_REST` abnimmt. */
export const OBEN_SKALA = 140;

const ALT: boolean = typeof location !== 'undefined' && new URLSearchParams(location.search).get('nebel') === 'alt';

/** Die Kurve auf der CPU — für den Test und für alle, die Nebel nachrechnen. */
export function nebelAnteil(tiefe: number, nah: number, fern: number, ueberKamera = 0): number {
  const t = Math.max(tiefe - nah, 0) / Math.max(fern - nah, 1);
  const f = NEBEL_MAX * (1 - Math.exp(-Math.pow(t * K, 1.5)));
  const ueber = Math.max(ueberKamera - 8, 0);
  return f * (OBEN_REST + (1 - OBEN_REST) * Math.exp(-ueber / OBEN_SKALA));
}

let eingehaengt = false;

/** Einmal vor dem ersten Übersetzen eines Materials aufrufen (wie `haengeAgxLookEin`). */
export function haengeNebelEin(): void {
  if (eingehaengt || ALT) return;
  eingehaengt = true;
  const k = K.toFixed(6);
  THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying float vNebelWeltY;
#endif
`;
  THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vNebelWeltY = ( inverse( viewMatrix ) * mvPosition ).y;
#endif
`;
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying float vNebelWeltY;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif
`;
  THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float nebelT = max( vFogDepth - fogNear, 0.0 ) / max( fogFar - fogNear, 1.0 );
    float fogFactor = ${NEBEL_MAX.toFixed(3)} * ( 1.0 - exp( - pow( nebelT * ${k}, 1.5 ) ) );
    float nebelUeber = max( vNebelWeltY - cameraPosition.y - 8.0, 0.0 );
    fogFactor *= mix( ${OBEN_REST.toFixed(3)}, 1.0, exp( - nebelUeber / ${OBEN_SKALA.toFixed(1)} ) );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
`;
}
