/**
 * BRACHLAND — Tonwertkurve wie im Zielbild (ADR-0006, D161)
 *
 * Der Blender-Render legt den Look fest mit `view_transform = 'AgX'` **und** dem Look
 * `AgX - Medium High Contrast` (`tools/szenenbau.py`). Die Engine kann AgX seit three.js r166,
 * aber **ohne** den Look — und genau der macht den Unterschied zwischen „flau" und „Zielbild".
 *
 * ## Gemessen, nicht hergeleitet
 *
 * Blenders OCIO-Konfiguration definiert den Look als `GradingPrimaryTransform` im AgX-Log-Raum:
 * `contrast: 1.2`, `pivot: -0.2`, `saturation: 1`. Diese Werte in three.js' Log-Raum umzurechnen
 * ist fehleranfaellig (andere Normierung, andere Matrixkonvention), deshalb wurde die Kurve
 * **gemessen**: dieselbe logarithmische Rampe (0,0005 bis 32, linear) einmal durch Blender
 * (`.cache/rampe.py`, mit und ohne Look) und einmal durch die echte Engine im Browser
 * (`.cache/rampe_lesen.mjs` auf `dist/rampe/`).
 *
 * Ergebnis der Messung:
 * - Engine-AgX gegen Blender-AgX (beide ohne Look, Belichtung 2,462 = 2^1,3): **max. 0,067**
 *   Abweichung. Die beiden Implementierungen stimmen also weitgehend ueberein.
 * - Der fehlende Look ist eine S-Kurve. Gewaehlt ist **Gamma 1,12 plus S-Term 0,70** (max. Fehler
 *   0,029), weil diese Form 0 auf 0 haelt; siehe die Konstanten unten. Ein Kontrast um Pivot
 *   0,75 traf mit 0,039 aehnlich gut und lag naeher an Blenders eigener Schreibweise, loeschte
 *   aber die Nachtbilder.
 *
 * ## Warum hier und nicht in der Nachbearbeitung
 *
 * `Kontur.tsx` laeuft nur, wenn Kontur oder Verdeckung an sind. Eine Tonwertkurve muss aber
 * immer greifen, sonst haengt der Look an einem Schalter. `CustomToneMapping` ersetzt die
 * eingebaute Kurve an der Stelle, an der three.js sie ohnehin anwendet.
 *
 * ## Was das **nicht** loest
 *
 * Die Kurve gleicht die Tonwerte an, nicht die Lichtrechnung. Cycles fuellt Hof, Fugen und
 * Waldboden mit indirektem Licht; die Engine hat keine Bounces und ersetzt sie durch ein
 * flaechiges Hemisphaerenlicht. Das bleibt der groessere Posten (siehe `docs/MESSLAUF.md`).
 */
import * as THREE from 'three';

/**
 * Kurvenform aus der Messung: erst Gamma, dann ein S-Term, beide im sRGB-Ausgaberaum.
 *
 * `y = w + a·w·(1−w)·(2w−1)` mit `w = x^g` haelt **0 auf 0 und 1 auf 1** und ist fuer a < 1
 * streng monoton (kleinste Steigung 1−a = 0,3). Genau das ist der Grund fuer diese Form: Der
 * naheliegende Kontrast um einen Pivot (c = 1,19, p = 0,75, Fehler 0,039) traf tagsueber besser
 * als Gamma allein, riss aber bei Nacht das Bild auf — im Bildtor 53 bis 67 % **leere** Flaeche
 * an allen vier Nachtfaellen, weil dort das ganze Bild unter dem Pivot liegt und der Clamp es
 * auf null schneidet. Blender umgeht das, weil sein Look im Log-Raum sitzt, wo es keine harte
 * Null gibt. Diese Form kommt mit 0,029 sogar naeher und kann per Konstruktion nichts loeschen.
 */
export const LOOK_GAMMA = 1.12;
export const LOOK_S = 0.70;

let eingehaengt = false;

/**
 * Haengt `THREE.CustomToneMapping` als „AgX plus Look" ein: three.js' eigenes AgX, danach der
 * gemessene Kontrast. Der Shader-Baustein wird genau einmal ersetzt; three.js liest ihn beim
 * Uebersetzen jedes Materials, ein spaeterer Aufruf haette keine Wirkung mehr auf bereits
 * uebersetzte Programme.
 */
export function haengeAgxLookEin(): void {
  if (eingehaengt) return;
  eingehaengt = true;
  THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
    'vec3 CustomToneMapping( vec3 color ) { return color; }',
    /* glsl */ `
    vec3 CustomToneMapping( vec3 color ) {
      color = AgXToneMapping( color );
      // Look "AgX - Medium High Contrast", gemessen statt umgerechnet (D161).
      //
      // **Im sRGB-Raum**, denn dort wurde er gemessen (Screenshot gegen Blender-PNG). Der erste
      // Versuch wandte ihn auf die linearen Werte an, die das Tone Mapping zurueckgibt: derselbe
      // Kontrast trifft dort die Schatten ungleich haerter, und beide Messorte standen mit
      // Schatten #000000 und ueber 53 % dunkel da — also ohne Zeichnung, was das Bildtor als
      // "leer" blockt (G-116). Hin und zurueck ueber die echte sRGB-Kennlinie, nicht ueber
      // Gamma 2,2: die beiden laufen im unteren Zehntel sichtbar auseinander, und genau dort
      // sitzt der Look.
      vec3 s = mix(color * 12.92,
                   1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
                   step(vec3(0.0031308), color));
      s = clamp(s, 0.0, 1.0);
      s = pow(s, vec3(${LOOK_GAMMA.toFixed(2)}));
      s = s + ${LOOK_S.toFixed(2)} * s * (1.0 - s) * (2.0 * s - 1.0);
      return mix(s / 12.92,
                 pow((s + 0.055) / 1.055, vec3(2.4)),
                 step(vec3(0.04045), s));
    }`,
  );
}

// ---- Dieselbe Kurve auf der CPU (D199) ----------------------------------------------------------

type Vek = [number, number, number];
/** GLSL-`mat3` ist spaltenweise: `M * v = s0·v.x + s1·v.y + s2·v.z`. Spalten wie im three.js-Quelltext. */
function mal(s: readonly [Vek, Vek, Vek], v: Vek): Vek {
  return [
    s[0][0] * v[0] + s[1][0] * v[1] + s[2][0] * v[2],
    s[0][1] * v[0] + s[1][1] * v[1] + s[2][1] * v[2],
    s[0][2] * v[0] + s[1][2] * v[1] + s[2][2] * v[2],
  ];
}
// Abgeschrieben aus three r169 `tonemapping_pars_fragment.glsl.js` (`AgXToneMapping`).
const SRGB_ZU_REC2020: [Vek, Vek, Vek] = [[0.6274, 0.0691, 0.0164], [0.3293, 0.9195, 0.0880], [0.0433, 0.0113, 0.8956]];
const REC2020_ZU_SRGB: [Vek, Vek, Vek] = [[1.6605, -0.1246, -0.0182], [-0.5876, 1.1329, -0.1006], [-0.0728, -0.0083, 1.1187]];
const AGX_INSET: [Vek, Vek, Vek] = [
  [0.856627153315983, 0.137318972929847, 0.11189821299995],
  [0.0951212405381588, 0.761241990602591, 0.0767994186031903],
  [0.0482516061458583, 0.101439036467562, 0.811302368396859],
];
const AGX_OUTSET: [Vek, Vek, Vek] = [
  [1.1271005818144368, -0.1413297634984383, -0.14132976349843826],
  [-0.11060664309660323, 1.157823702216272, -0.11060664309660294],
  [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405],
];
const AGX_MIN_EV = -12.47393, AGX_MAX_EV = 4.026069;

const klemme = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Was `CustomToneMapping` im Shader tut, auf der CPU: three.js-AgX, dann der Look im sRGB-Raum.
 * Eingang linear-sRGB (vor der Belichtung), Ausgang linear-sRGB — wie der Shader. Für Messwerkzeuge
 * (`tools/lichtcheck.ts`), die sonst eine andere Kurve rechnen als das Spiel zeigt.
 */
export function agxMitLook(farbe: Vek, belichtung: number): Vek {
  let c = mal(AGX_INSET, mal(SRGB_ZU_REC2020, farbe.map(x => x * belichtung) as Vek));
  c = c.map(x => klemme((Math.log2(Math.max(x, 1e-10)) - AGX_MIN_EV) / (AGX_MAX_EV - AGX_MIN_EV))) as Vek;
  c = c.map(x => {
    const x2 = x * x, x4 = x2 * x2;
    return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
  }) as Vek;
  c = mal(AGX_OUTSET, c).map(x => Math.max(0, x) ** 2.2) as Vek;
  c = mal(REC2020_ZU_SRGB, c).map(klemme) as Vek;
  // Look wie im Shader: hin nach sRGB, Gamma + S-Term, zurück nach linear.
  return c.map(x => {
    let s = klemme(x < 0.0031308 ? x * 12.92 : 1.055 * Math.max(x, 0) ** (1 / 2.4) - 0.055);
    s = s ** LOOK_GAMMA;
    s = s + LOOK_S * s * (1 - s) * (2 * s - 1);
    return s < 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Vek;
}
