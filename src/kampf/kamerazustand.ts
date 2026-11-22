/**
 * D189: Was die Kamera gerade zeigt — die Kamera (`RegionsSzene`) schreibt, der Kampfplatz liest.
 * `vorn`: Vorder-, Seiten- oder Gegneransicht; dann stören Zielmarke und Fächer im Bild.
 */
export const kameraZustand = { vorn: false };

/**
 * D427: `?zeitlupe=0.2` — Messadresse: Kampfplatz und Kamerastoss rechnen je Bild mit `min(dt, 0,1) · zeitlupe`
 * und einer eigenen Uhr daraus statt `performance.now()`. So steht der Moment nach einem Treffer auch unter
 * SwiftShader (≈ 1 Bild/s) über mehrere Bilder (Bildpaar), und am M1 sieht man Stopp, Stoss und Reaktion langsam.
 * Ohne Schalter 1 — dann ist nichts anders als vorher.
 */
export const ZEITLUPE = (() => {
  const z = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('zeitlupe')) : NaN;
  return Number.isFinite(z) && z > 0 && z < 1 ? Math.max(0.01, z) : 1;
})();
let lupenUhr = 0;
/** Uhr des Kampfplatzes in ms: echt, oder in der Zeitlupe die aufsummierten verlangsamten Bildzeiten. */
export function kampfUhr(dtLupe: number): number {
  if (ZEITLUPE === 1) return performance.now();
  lupenUhr += dtLupe * 1000;
  return lupenUhr;
}
