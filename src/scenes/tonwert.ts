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
