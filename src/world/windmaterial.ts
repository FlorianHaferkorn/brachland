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
  /**
   * Loecher im Laub (ADR-0006, Stufe 2): Schwelle 0…1, ab der ein Rauschen in Weltkoordinaten
   * das Fragment verwirft. Dasselbe Rezept wie `mat_laub` im Szenenbau (Noise > Schwelle →
   * transparent): Blattmassen aus der Blender-Szene kommen als geschlossene Klumpen, die Loecher
   * macht der Shader — kein Alpha-Bild, keine Sortierung. 0 oder undefined schaltet ab.
   */
  loecher?: number;
  /** Rauschmassstab der Loecher in 1/m; Szenenbau nimmt 9. */
  loecherSkala?: number;
  /**
   * Durchlass 0…1 (Stufe 2): Sonnenlicht, das von hinten durch ein Blatt faellt, als
   * Lambert-Term auf die **abgewandte** Seite — `mat_laub` im Szenenbau mischt dafuer
   * Diffus und Translucent 45/55. Ohne diesen Term liest eine Krone im Gegenlicht als
   * dunkle Scheibe, mit ihm leuchtet sie. Nur die erste Richtungsquelle (die Sonne).
   */
  durchlass?: number;
  /**
   * Himmelsanteil (D170): Die Geometrie trägt ein Attribut `_himmel` (0…1, `tools/himmel.ts`),
   * und das **Fülllicht** — nur das indirekte Diffuslicht, also die Hemisphäre — wird damit
   * gedämpft. Die Sonne bleibt unberührt. Nur setzen, wenn das Attribut da ist: Fehlt es, liefert
   * WebGL 0, und die Fläche verlöre ihr ganzes Fülllicht.
   */
  himmel?: boolean;
}

/**
 * Stärke des Himmelsanteils (D170): 0,7. `?himmel=0…1` überschreibt (0 = wie vor D170).
 *
 * Gemessen an der sonnenabgewandten Mauer der Felsmulde (Median, linear; Render 0,0071):
 * 0 → 0,0155 · 0,5 → 0,0091 · **0,7 → 0,0069** · 1 → 0,0042. Voll wäre zu dunkel, weil Cycles
 * das Licht, das der Himmel nicht mehr bringt, zum Teil über Bounces vom Boden zurückholt —
 * die fehlen hier. 0,7 ist diese Lücke, gemessen, nicht geschätzt; sie gilt für eine Kamera.
 */
const HIMMEL_MESSLAUF: number | null = (() => {
  if (typeof location === 'undefined') return null;
  const roh = new URLSearchParams(location.search).get('himmel');
  const n = roh === null ? NaN : Number(roh);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
})();
/**
 * Ein Uniform für alle Materialien mit Himmelsanteil — die Stärke hängt an der Stimmung (die Nacht
 * lebt vom Fülllicht und bekommt 0, siehe `Stimmung.himmel`), gesetzt von der Szene.
 */
const HIMMEL_UNIFORM = { value: HIMMEL_MESSLAUF ?? 0.7 };
/** Stärke des Himmelsanteils setzen (Szene, je Stimmung). `?himmel=` hat Vorrang. */
export function setzeHimmelStaerke(s: number): void {
  HIMMEL_UNIFORM.value = HIMMEL_MESSLAUF ?? s;
}

/** Slots der Laufzeitfarben (D146) — dieselbe Reihenfolge wie `SLOT` in `tools/menschbau.py`. */
export const ROLLEN_SLOTS = ['haut', 'haar', 'oberteil', 'hose', 'stiefel', 'kopf', 'riemen', 'hemd'] as const;
export type RollenSlot = typeof ROLLEN_SLOTS[number];

/**
 * Laufzeitfarben (D146): Die Menschenkette schreibt je Materialrolle einen Slot
 * 1…8 in `COLOR_0.a`. Ist `uRollenAn` gesetzt und der Slot in der Maske, ersetzt
 * `uRollen[slot]` die gebackene Farbe — eine Datei je Silhouette, Haar, Jacke,
 * Hose aus dem Inhalt (`Ort.farben`). Alpha wird danach auf 1 gesetzt, damit
 * der Fragmentshader keine Transparenz aus dem Slot liest. Nur mit
 * `USE_COLOR_ALPHA` (COLOR_0 mit vier Komponenten); Kreaturen haben drei.
 */
const ROLLEN_GLSL = /* glsl */ `
  #ifdef USE_COLOR_ALPHA
  {
    float rolle = floor(vColor.a * 255.0 + 0.5);
    if (uRollenAn > 0.5 && rolle >= 1.0 && rolle <= 8.0) {
      int i = int(rolle) - 1;
      if (uRollenMaske[i] > 0.5) vColor.rgb = uRollen[i];
    }
    if (uRollenAn > 0.5) vColor.a = 1.0;
  }
  #endif
`;

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
/**
 * `?saum=0.5` skaliert das Silhouettenlicht **aller** Materialien, `?saumSchaerfe=8` setzt den Exponenten.
 *
 * Messparameter (D160), hier statt in der Szene, weil auch Kreaturen, Figur und Bauwerke dieses Material
 * benutzen. Auf einer Blattmasse aus kleinen Kugeln ist `1 - |N·V|` fast ueberall hoch — „Silhouette" ist
 * dort kein Rand, sondern die halbe Flaeche, und der Saum legt sich als heller Flaum ueber die Krone.
 * Ob Staerke oder Schaerfe der Hebel ist, entscheidet die Messung, nicht die Vermutung.
 */
const zahlAusAdresse = (name: string, max: number, minimum = 0): number | null => {
  if (typeof location === 'undefined') return null;
  const text = new URLSearchParams(location.search).get(name);
  if (text === null) return null;   // `Number(null)` ist 0, und 0 ist gueltig (Saum aus) — D159
  const roh = Number(text);
  return Number.isFinite(roh) && roh >= minimum && roh <= max ? roh : null;
};
const SAUM_FAKTOR: number = zahlAusAdresse('saum', 10) ?? 1;
const SAUM_SCHAERFE: number | null = zahlAusAdresse('saumSchaerfe', 32, 0.01);

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
/**
 * Wertrauschen in drei Oktaven auf der Weltposition — genug fuer Loecher, die wie Blattwerk
 * lesen. Kein Perlin: Das hier muss nur unregelmaessig sein, nicht schoen.
 */
const LOECHER_GLSL = /* glsl */ `
  #ifdef USE_COLOR_ALPHA
  float laubmaske = vColor.a;      // Baumbau: 1 = Blatt, 0 = Holz — Loecher nur im Laub
  #else
  float laubmaske = 1.0;
  #endif
  if (uLoecher > 0.0 && laubmaske > 0.5) {
    vec3 q = vLoecherPos * uLoecherSkala;
    float n = 0.0, a = 0.5;
    for (int o = 0; o < 3; o++) {
      vec3 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
      float h000 = fract(sin(dot(i, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      float h100 = fract(sin(dot(i + vec3(1,0,0), vec3(127.1, 311.7, 74.7))) * 43758.5453);
      float h010 = fract(sin(dot(i + vec3(0,1,0), vec3(127.1, 311.7, 74.7))) * 43758.5453);
      float h110 = fract(sin(dot(i + vec3(1,1,0), vec3(127.1, 311.7, 74.7))) * 43758.5453);
      float h001 = fract(sin(dot(i + vec3(0,0,1), vec3(127.1, 311.7, 74.7))) * 43758.5453);
      float h101 = fract(sin(dot(i + vec3(1,0,1), vec3(127.1, 311.7, 74.7))) * 43758.5453);
      float h011 = fract(sin(dot(i + vec3(0,1,1), vec3(127.1, 311.7, 74.7))) * 43758.5453);
      float h111 = fract(sin(dot(i + vec3(1,1,1), vec3(127.1, 311.7, 74.7))) * 43758.5453);
      float v = mix(mix(mix(h000, h100, f.x), mix(h010, h110, f.x), f.y), mix(mix(h001, h101, f.x), mix(h011, h111, f.x), f.y), f.z);
      n += v * a; q *= 2.0; a *= 0.5;
    }
    if (n > uLoecher) discard;
  }
`;

/**
 * Durchlass: Licht der Sonne von der Rueckseite. `directionalLights[0].direction` zeigt zur
 * Quelle (Sichtraum); ein Blatt, dessen Normale von der Sonne wegzeigt, bekommt den
 * negativen Kosinus als diffusen Beitrag. Ohne Schattenmaske — die kennt nur die Vorderseite,
 * und ein Rest Leuchten im Kronenschatten ist genau, was Laub tut.
 */
const DURCHLASS_GLSL = /* glsl */ `
  #if NUM_DIR_LIGHTS > 0
  if (uDurchlass > 0.0 && laubmaske > 0.5) {
    // Blender mischt Diffus und Translucent. Der alte Shader liess den vollen
    // Diffusanteil stehen und addierte Durchlass darauf: Laub bekam mehr als
    // 100 % Licht und wurde blass. Beide Anteile teilen sich nun dieselbe Energie.
    reflectedLight.directDiffuse *= 1.0 - uDurchlass;
    reflectedLight.indirectDiffuse *= 1.0 - uDurchlass;
    float rueck = max(0.0, -dot(geometryNormal, directionalLights[0].direction));
    reflectedLight.directDiffuse += BRDF_Lambert(diffuseColor.rgb) * directionalLights[0].color * rueck * uDurchlass;
  }
  #endif
`;

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
    // Gang (D138): Beine schwingen laengs, diagonal gepaart — vorn links mit
    // hinten rechts —, der Fuss hebt sich in der Vorschwingphase, der Rumpf wippt
    // zweimal je Schritt. uGang 0…1 blendet in JS weich ein und aus. Vorderbeine
    // liegen bei z < −0,15 (Nase −Z); ein Vogel hat beide Beine bei z ≈ 0 und
    // wechselt damit nur nach Seite — richtig fuer zwei Beine.
    float bein = smoothstep(0.55, 0.15, position.y);
    float paar = (position.x < 0.0 ? -1.0 : 1.0) * (position.z < -0.15 ? -1.0 : 1.0);
    float takt = uZeit * 7.5 + ph;
    transformed.z += sin(takt) * paar * 0.11 * bein * uGang;
    transformed.y += max(0.0, cos(takt) * paar) * 0.05 * bein * uGang;
    transformed.y += sin(takt * 2.0) * 0.012 * uGang * (1.0 - bein);
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
  /** Tiefenmaterial fuer Schatten mit denselben Loechern — nur mit `loecher`; als `customDepthMaterial` setzen. */
  tiefe?: THREE.MeshDepthMaterial;
  setzeZeit(t: number): void;
  setzeRand(farbe: THREE.Color, staerke: number): void;
  /** Gangstaerke 0…1 (D138) — nur mit `atmen`. */
  setzeGang(g: number): void;
  /** Laufzeitfarben je Slot (D146); `null` schaltet ab. Nur fuer Netze mit COLOR_0.a. */
  setzeRollen(farben: Partial<Record<RollenSlot, THREE.Color | string>> | null): void;
} {
  const zeit = { value: 0 };
  const randFarbe = { value: w.randFarbe.clone() };
  const randStaerke = { value: w.randStaerke * SAUM_FAKTOR };
  const randSchaerfe = { value: SAUM_SCHAERFE ?? w.randSchaerfe ?? 3.0 };
  const windAmp = { value: w.amplitude };
  const atmen = { value: w.atmen ? 1 : 0 };
  const gang = { value: 0 };
  const rollenAn = { value: 0 };
  const rollen = { value: Array.from({ length: 8 }, () => new THREE.Color(0, 0, 0)) };
  const rollenMaske = { value: new Float32Array(8) };
  const loecher = { value: w.loecher ?? 0 };
  const loecherSkala = { value: w.loecherSkala ?? 9 };
  const durchlass = { value: w.durchlass ?? 0 };

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
    shader.uniforms.uGang = gang;
    shader.uniforms.uRollenAn = rollenAn;
    shader.uniforms.uRollen = rollen;
    shader.uniforms.uRollenMaske = rollenMaske;
    shader.uniforms.uLoecher = loecher;
    shader.uniforms.uLoecherSkala = loecherSkala;
    shader.uniforms.uDurchlass = durchlass;
    if (w.himmel) {
      shader.uniforms.uHimmel = HIMMEL_UNIFORM;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float _himmel;\nvarying float vHimmel;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHimmel = _himmel;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vHimmel;\nuniform float uHimmel;')
        // Nach der AO-Karte: `indirectDiffuse` ist hier allein das Fülllicht (Hemisphäre); die Sonne
        // steckt in `directDiffuse` und bleibt, wie sie ist.
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= mix(1.0, vHimmel, uHimmel);');
    }

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
        // aWind ebenfalls nur bei Instanzen deklarieren: Ein Attribut, das die
        // Geometrie nicht liefert, ist auf manchen Treibern ein harter Fehler.
        '#include <common>\nuniform float uZeit;\nuniform float uWindAmp;\nuniform float uAtmen;\nuniform float uGang;\n'
        + 'uniform float uRollenAn;\nuniform vec3 uRollen[8];\nuniform float uRollenMaske[8];\nvarying vec3 vLoecherPos;\n'
        + '#ifdef USE_INSTANCING\nattribute float aWind;\n#endif')
      .replace('#include <color_vertex>', '#include <color_vertex>' + ROLLEN_GLSL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>' + WIND_GLSL + ATMEN_GLSL)
      // Weltposition fuer die Loecher: nach allen Verschiebungen, vor der Projektion
      .replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_INSTANCING\nvLoecherPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvLoecherPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\nuniform vec3 uRandFarbe;\nuniform float uRandStaerke;\nuniform float uRandSchaerfe;\nuniform float uLoecher;\nuniform float uLoecherSkala;\nuniform float uDurchlass;\nvarying vec3 vLoecherPos;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + LOECHER_GLSL)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>' + RAND_GLSL + DURCHLASS_GLSL);
  };
  material.customProgramCacheKey = () => 'brachland-wind-rand-v12' + (w.himmel ? '-himmel' : '');

  // Tiefenmaterial mit denselben Loechern: sonst wirft eine Krone den Schatten eines vollen Klumpens
  let tiefe: THREE.MeshDepthMaterial | undefined;
  if ((w.loecher ?? 0) > 0) {
    tiefe = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    tiefe.vertexColors = true;
    tiefe.onBeforeCompile = (shader) => {
      shader.uniforms.uLoecher = loecher; shader.uniforms.uLoecherSkala = loecherSkala;
      shader.uniforms.uZeit = zeit; shader.uniforms.uWindAmp = windAmp;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n#include <color_pars_vertex>\nvarying vec3 vLoecherPos;\nuniform float uZeit;\nuniform float uWindAmp;\n#ifdef USE_INSTANCING\nattribute float aWind;\n#endif')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n#include <color_vertex>' + WIND_GLSL)
        .replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_INSTANCING\nvLoecherPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvLoecherPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n#include <color_pars_fragment>\nuniform float uLoecher;\nuniform float uLoecherSkala;\nvarying vec3 vLoecherPos;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + LOECHER_GLSL);
    };
    tiefe.customProgramCacheKey = () => 'brachland-tiefe-loecher-v2';
  }

  return {
    material,
    tiefe,
    setzeZeit: (t) => { zeit.value = t; },
    setzeRand: (farbe, staerke) => { randFarbe.value.copy(farbe); randStaerke.value = staerke * SAUM_FAKTOR; },
    setzeGang: (g) => { gang.value = g; },
    setzeRollen: (farben) => {
      rollenMaske.value.fill(0);
      if (!farben) { rollenAn.value = 0; return; }
      let eine = false;
      ROLLEN_SLOTS.forEach((slot, i) => {
        const f = farben[slot];
        if (f === undefined) return;
        rollen.value[i].set(f); rollenMaske.value[i] = 1; eine = true;
      });
      rollenAn.value = eine ? 1 : 0;
    },
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
