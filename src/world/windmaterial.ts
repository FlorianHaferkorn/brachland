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
  /**
   * Exponent des Fresnel-Terms — **wie breit** der Rand ist, nicht wie hell.
   *
   * Bei 3,0 leuchten nur wenige Grad um die Silhouette. Auf einer Fichtenkrone
   * aus tausenden frontalen Facetten ist das ein verschwindender Flaechenanteil,
   * und mehr `randStaerke` aendert daran nichts: 0,30 bis 1,40 bewegten den
   * Schwarzanteil um weniger als zwei Punkte (G-118).
   *
   * Fuer **Kreaturen** ist das der falsche Kompromiss. Sie sind das, wonach der
   * Spieler sucht, und ein 3.000-Flaechen-Koerper hat dasselbe Problem wie eine
   * Krone: viele kleine Facetten, fast alle frontal. Ein kleinerer Exponent
   * verbreitert den Saum, statt ihn heller zu machen.
   *
   * Standard bleibt 3,0, damit Baeume, Buesche und Gras unveraendert aussehen.
   */
  randSchaerfe?: number;
  /**
   * Atmen und Kopfwenden (D136) — nur für Kreaturen. Rumpf quer ±1,5 % im
   * Atemrhythmus, alles vor dem Hals dreht langsam um die Hochachse. Rechnet in
   * den genormten Modellmetern der Kette (Widerrist 1 m, Nase nach −Z, Füße auf
   * y = 0), Phase aus der Weltlage — kein Rig, keine zweite Geometrie.
   */
  atmen?: boolean;
}

/**
 * Der Fresnel-Term wird auf `reflectedLight.indirectSpecular` addiert, **nicht** auf
 * `outgoingLight`.
 *
 * Das ist kein Detail, das war ein harter Fehler: `outgoingLight` existiert an dieser
 * Stelle im three.js-Shader noch gar nicht — es wird erst in `<opaque_fragment>`
 * gebildet. Der Shader ließ sich deshalb **nicht kompilieren**, und jedes Material,
 * das dieses Licht benutzt hat, verschwand: Bäume, Büsche, Kreaturen, Spielerfigur,
 * Klippen. Genau das war „man sieht keine Monster mehr".
 *
 * Aufgefallen ist es erst im Browser. Typen, Gate und Build können einen GLSL-Fehler
 * nicht sehen — Shader werden zur Laufzeit übersetzt.
 *
 * `indirectSpecular` ist auch inhaltlich die richtige Stelle: Der Beitrag soll nicht
 * mit der Grundfarbe eingefärbt werden. Ein Umriss gegen den Himmel hat die Farbe
 * des Himmels, nicht die des Fells.
 */
const RAND_GLSL = /* glsl */ `
  // Fresnel: 0 dort, wo die Fläche zum Betrachter zeigt, 1 an der Silhouette.
  float randKante = 1.0 - abs(dot(geometryNormal, geometryViewDir));
  reflectedLight.indirectSpecular += uRandFarbe * pow(randKante, uRandSchaerfe) * uRandStaerke;
`;

/**
 * `instanceMatrix` existiert im Shader **nur**, wenn three.js `USE_INSTANCING`
 * gesetzt hat — also bei einem `InstancedMesh`. Dasselbe Material hängt aber auch an
 * der Spielerfigur und an den Kreaturen, und das sind einfache Meshes. Ohne diese
 * Abfrage ließ sich der Shader dort nicht übersetzen, und beide verschwanden.
 *
 * Der `#ifdef` steht deshalb im Shader und nicht als zweites Material in TypeScript:
 * Zwei Materialien hieße zwei Programme, zwei Uniform-Sätze und zwei Stellen, an
 * denen man die Randfarbe nachziehen muss.
 */
const WIND_GLSL = /* glsl */ `
  #ifdef USE_INSTANCING
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
  #endif
`;

/**
 * Leben ohne Rig (D136).
 *
 * Ein stehendes Tier liest als Attrappe; was es zum Tier macht, ist die kleine,
 * unregelmäßige Bewegung, die ein Blick sofort als Atmen und Aufmerken erkennt.
 * Beides kommt aus zwei Zeilen im Vertex-Shader, in den genormten Modellmetern:
 * - **Atmen:** der Rumpf (y 0,3…1,0 über den Füßen, also nicht Beine, nicht Kopf)
 *   wird quer um bis zu 1,5 % breiter und schmaler, 1,4 rad/s ≈ 13 Atemzüge je Minute.
 * - **Kopfwenden:** alles vor dem Hals (z < −0,35 m, Nase zeigt nach −Z) dreht um
 *   die Hochachse durch den Hals, bis ±8°, aus zwei langsamen Sinus mit
 *   unterschiedlicher Phase — kein Metronom. Ein Tier, das kürzer als 0,35 m
 *   nach vorn reicht (Alpenmurmel), wendet nichts; das ist richtig so.
 * Die Phase kommt aus der Weltlage, damit keine zwei Tiere im Takt atmen.
 */
const ATMEN_GLSL = /* glsl */ `
  if (uAtmen > 0.5) {
    vec2 ort = modelMatrix[3].xz;
    float ph = fract(sin(dot(ort, vec2(12.9898, 78.233))) * 43758.5453) * 6.2832;
    float rumpf = smoothstep(0.30, 0.55, position.y) * (1.0 - smoothstep(0.95, 1.15, position.y));
    transformed.x *= 1.0 + sin(uZeit * 1.4 + ph) * 0.015 * rumpf;
    float kopf = smoothstep(-0.35, -0.85, position.z);
    float dreh = kopf * 0.14 * (sin(uZeit * 0.37 + ph) * 0.6 + sin(uZeit * 0.9 + ph * 1.7) * 0.4);
    float c = cos(dreh), s = sin(dreh);
    float hals = -0.35;
    float x = transformed.x, z = transformed.z - hals;
    transformed.x = x * c - z * s;
    transformed.z = hals + x * s + z * c;
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
  const randSchaerfe = { value: w.randSchaerfe ?? 3.0 };
  const windAmp = { value: w.amplitude };
  const atmen = { value: w.atmen ? 1 : 0 };

  const material = basis instanceof THREE.MeshStandardMaterial
    ? (basis.clone() as THREE.MeshStandardMaterial)
    : new THREE.MeshStandardMaterial({
        vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0,
      });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uZeit = zeit;
    shader.uniforms.uRandFarbe = randFarbe;
    shader.uniforms.uRandStaerke = randStaerke;
    shader.uniforms.uRandSchaerfe = randSchaerfe;
    shader.uniforms.uWindAmp = windAmp;
    shader.uniforms.uAtmen = atmen;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
        // aWind ebenfalls nur bei Instanzen deklarieren: Ein Attribut, das die
        // Geometrie nicht liefert, ist auf manchen Treibern ein harter Fehler.
        '#include <common>\nuniform float uZeit;\nuniform float uWindAmp;\nuniform float uAtmen;\n'
        + '#ifdef USE_INSTANCING\nattribute float aWind;\n#endif')
      .replace('#include <begin_vertex>', '#include <begin_vertex>' + WIND_GLSL + ATMEN_GLSL);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\nuniform vec3 uRandFarbe;\nuniform float uRandStaerke;\nuniform float uRandSchaerfe;')
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>' + RAND_GLSL);
  };
  material.customProgramCacheKey = () => 'brachland-wind-rand-v5';

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
