/**
 * BRACHLAND — Silhouettenlicht und Windbewegung für Prop-Instanzen
 *
 * Zwei Shader-Zutaten, die dieselbe Beobachtung bedienen: Die Art Direction lebt von
 * Silhouetten im Nebel, und eine Silhouette braucht eine Kante und Bewegung, um als
 * Gegenstand gelesen zu werden statt als Fleck.
 *
 * **Silhouettenlicht** ist ein Fresnel-Term: An Flächen, die vom Betrachter
 * wegkippen, kommt Himmelslicht dazu. Physikalisch ist das die Streuung am Rand
 * eines Körpers gegen den hellen Himmel — dieselbe Kante, die auf jedem
 * Gegenlichtfoto den Umriss zeichnet. Sie kostet drei Rechenschritte und ersetzt,
 * wofür sonst eine Lichtquelle je Objekt nötig wäre.
 *
 * **Wind** verschiebt Laub und Zweige, aber nicht Stämme. Welcher Teil sich bewegen
 * darf, steht als Attribut `wind` in der Geometrie: 0 am Stamm, 1 in der Krone. Ohne
 * dieses Attribut würde der ganze Baum wackeln — die Alternative wäre, Stamm und
 * Krone als getrennte Meshes zu führen und die Instanzzahl zu verdoppeln.
 */
import * as THREE from 'three';

export interface WindMaterialWerte {
  /** Ausschlag der Krone in Metern bei vollem Windattribut. */
  amplitude: number;
  /** Farbe des Silhouettenlichts — sollte zur Himmelsfarbe passen. */
  randFarbe: THREE.Color;
  /** Stärke des Silhouettenlichts. 0 schaltet es ab. */
  randStaerke: number;
}

const RAND_GLSL = /* glsl */ `
  // Fresnel: 0 dort, wo die Fläche zum Betrachter zeigt, 1 an der Silhouette.
  float randKante = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
  outgoingLight += uRandFarbe * pow(randKante, 3.0) * uRandStaerke;
`;

const WIND_GLSL = /* glsl */ `
  {
    // Instanzposition steckt in der vierten Spalte der Instanzmatrix. Sie ist die
    // Phase: Ohne sie schwingt der ganze Wald im Gleichtakt, und das sieht aus wie
    // ein Fehler, nicht wie Wind.
    vec3 wurzel = instanceMatrix[3].xyz;
    float phase = wurzel.x * 0.09 + wurzel.z * 0.07;
    float b = uWindAmp * aWind;
    // Zwei Frequenzen: eine tragende Böe, eine feine Unruhe darüber.
    float boe = sin(uZeit * 0.55 + phase) * 0.72 + sin(uZeit * 1.6 + phase * 1.9) * 0.28;
    transformed.x += boe * b;
    transformed.z += cos(uZeit * 0.42 + phase * 1.3) * b * 0.5;
  }
`;

/**
 * Standardmaterial mit Silhouettenlicht und optionalem Wind.
 *
 * `aWind` wird als Attribut erwartet. Fehlt es in der Geometrie, liefert WebGL 0 —
 * dann steht das Objekt still, und das ist genau das richtige Verhalten.
 */
export function baueWindMaterial(w: WindMaterialWerte, basis?: THREE.Material): {
  material: THREE.MeshStandardMaterial;
  setzeZeit(t: number): void;
  setzeRand(farbe: THREE.Color, staerke: number): void;
} {
  const zeit = { value: 0 };
  const randFarbe = { value: w.randFarbe.clone() };
  const randStaerke = { value: w.randStaerke };
  const windAmp = { value: w.amplitude };

  const material = basis instanceof THREE.MeshStandardMaterial
    ? (basis.clone() as THREE.MeshStandardMaterial)
    : new THREE.MeshStandardMaterial({
        vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0,
      });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uZeit = zeit;
    shader.uniforms.uRandFarbe = randFarbe;
    shader.uniforms.uRandStaerke = randStaerke;
    shader.uniforms.uWindAmp = windAmp;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
        '#include <common>\nuniform float uZeit;\nuniform float uWindAmp;\nattribute float aWind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>' + WIND_GLSL);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\nuniform vec3 uRandFarbe;\nuniform float uRandStaerke;')
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>' + RAND_GLSL);
  };
  material.customProgramCacheKey = () => 'brachland-wind-rand-v1';

  return {
    material,
    setzeZeit: (t) => { zeit.value = t; },
    setzeRand: (farbe, staerke) => { randFarbe.value.copy(farbe); randStaerke.value = staerke; },
  };
}

/**
 * Setzt das Windattribut aus der Höhe.
 *
 * Für alles, was keine eigene Zuordnung mitbringt (Büsche, Grasbüschel): unten
 * starr, oben beweglich, quadratisch dazwischen. Ein Busch biegt sich am Trieb, nicht
 * am Wurzelhals.
 */
export function windAusHoehe(g: THREE.BufferGeometry, hoehe: number): THREE.BufferGeometry {
  const pos = g.getAttribute('position');
  const wind = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, pos.getY(i) / Math.max(0.001, hoehe)));
    wind[i] = t * t;
  }
  g.setAttribute('aWind', new THREE.BufferAttribute(wind, 1));
  return g;
}
