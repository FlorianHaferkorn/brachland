/**
 * BRACHLAND — Materialien für Wasser und Wege
 *
 * Beide waren flache, einfarbige Bänder mit harter Kante — im Spiel las sich das als
 * „Platte auf der Landschaft", nicht als Bach oder Feldweg. Der Grund ist derselbe
 * wie beim Boden: Zwischen Geometrie und Farbe fehlt die Ebene, auf der ein Auge
 * Oberfläche erkennt. Und die Kante fehlt in der Natur ganz — ein Bach hat ein Ufer,
 * ein Weg einen ausgetretenen Rand.
 *
 * Beides kommt aus dem Shader und kostet **null Bytes**:
 * - `uv.x` läuft quer über das Band, -1 am linken, +1 am rechten Rand. Daraus wird
 *   die weiche Kante: außen durchsichtig, innen deckend.
 * - `uv.y` ist die Strecke in Metern flussabwärts. Daraus laufen die Wellen.
 */
import { BACH_ECHT, BELAG_ECHT, GEWAESSER_ECHT, WELLEN_ECHT } from './echt.js';
import WEG_SCANS from '../../public/material/weg-scans.json';
import * as THREE from 'three';
import { BODEN_HIMMEL } from './bodenmaterial.js';
import { PALETTE } from './palette.js';
import { SPIEGELBILD } from './spiegelbild.js';

/** Optionale lokale Echtzeitprobe; ohne sie bleibt der bisherige Shader unveraendert. */
export interface WasserReflexProbe {
  karte: { value: THREE.CubeTexture | null };
  mitte: { value: THREE.Vector3 };
  bereit: { value: number };
}

const HASH_GLSL = /* glsl */ `
float bandHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float bandRauschen(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bandHash(i), bandHash(i + vec2(1.0, 0.0)), f.x),
             mix(bandHash(i + vec2(0.0, 1.0)), bandHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

/**
 * Gischt am fallenden Wasser (Phase 3, D131).
 *
 * Ein Fall ist kein blaues Band, das schräg steht — was man von einem Fall sieht,
 * ist **Weiß**: Luft im Wasser, in Strähnen, die mit dem Wasser nach unten laufen.
 * Deshalb Strähnen aus demselben Rauschen wie die Wellen, quer schmal (`uv.x · 7`),
 * längs gestreckt und mit `uTempo` abwärts laufend; über der Schwelle wird die
 * Farbe zur Gischt gehoben und die Fläche deckender. Kein zweiter Pass, keine
 * Partikel — auf dem Handy wäre beides die Füllrate, die der Fall nicht hat.
 */
const GISCHT_GLSL = /* glsl */ `
  float straehne = bandRauschen(vec2(vBand.x * 7.0, vBand.y * 2.2 - zeit * uTempo * 0.9));
  float straehne2 = bandRauschen(vec2(vBand.x * 13.0 + 3.7, vBand.y * 4.5 - zeit * uTempo * 1.3));
  float gischt = smoothstep(0.50, 0.85, straehne * 0.65 + straehne2 * 0.35);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.83, 0.85), gischt * 0.9);
  diffuseColor.a = max(diffuseColor.a, gischt * 0.95);
`;

/**
 * Himmelsspiegelung verdecken (D239, H-156c): Die Umgebungskarte ist nur Himmel, und
 * unter Kronen und Mauern spiegelte das Wasser deshalb vollen Himmel — im Blender-Render
 * steht dort das dunkle Spiegelbild der Bäume. Dasselbe Raster wie das Fülllicht des
 * Bodens (D171, `BODEN_HIMMEL`); ausserhalb eines Set-Pieces bleibt der Faktor 1.
 */
const VERDECKT_GLSL = /* glsl */ `
  if (uBodenRahmen.z > 0.0) {
    vec2 uvH = (vWasserPos.xz - uBodenRahmen.xy) * uBodenRahmen.zw;
    if (uvH.x > 0.0 && uvH.x < 1.0 && uvH.y > 0.0 && uvH.y < 1.0) {
      float kante = smoothstep(0.0, 0.03, min(min(uvH.x, 1.0 - uvH.x), min(uvH.y, 1.0 - uvH.y)));
      reflectedLight.indirectSpecular *= mix(1.0, texture2D(uBodenHimmel, uvH).r, kante);
    }
  }
`;

/**
 * Wasser nach der Blender-Quelle `szenenbau.py:mat_wasser` (ADR-0006).
 *
 * Der Standard naehert Absorption durch transparente Abdunklung an und zeigt
 * direktes Glanzlicht mit IOR 1,333. WasserUmgebung liefert denselben Himmel wie
 * im Spiel als Reflexionskarte. Der Standard hat keine Brechung.
 * Der optionale physikalische Vergleichspfad nutzt Transmission: ein weiterer
 * Szenenpass, auf three r169 in voller Aufloesung. Seine Dicke von 0,4 m ist
 * eine Naeherung fuer das Band, kein gemessener Tiefenpuffer. Spiegelungen von
 * Baeumen erfordern in beiden Faellen zusaetzlich eine Szenenreflexion.
 *
 * Fallendes Wasser behaelt seine Gischt. Die weiche Uferkante und das Zeit-Uniform
 * bleiben fuer beide Pfade erhalten; glatte Normalen verhindern Bruchglas-Facetten.
 */
export function baueWasserMaterial(
  fallend = false,
  physikalisch = false,
  form: 'band' | 'becken' | 'weiher' = 'band',
  probe?: WasserReflexProbe | null,
): THREE.MeshStandardMaterial {
  const material = fallend ? new THREE.MeshStandardMaterial({
    color: PALETTE.wasser.fallend,
    // D131: Das Weiss kommt aus Gischt statt einem harten Sonnenfleck.
    roughness: 0.85, metalness: 0.05,
    transparent: true, opacity: 0.8,
    emissive: new THREE.Color(PALETTE.wasser.fallendGlanz),
    emissiveIntensity: 0.2,
    // Fallendes Wasser wird von beiden Seiten gesehen — man steht auch mal darunter.
    /**
     * Beidseitig, seit es ein Gewässerbett gibt.
     *
     * Vorher lag die Wasserfläche über dem Gelände — man sah sie immer von oben,
     * `FrontSide` reichte. Jetzt steht man **darin**: Die Kamera sitzt beim
     * Schwimmen unter dem Spiegel, und eine einseitige Fläche verschwindet von
     * unten vollständig. Im Weiher sah das aus wie ein dunkles Loch ohne Wasser.
     */
    side: THREE.DoubleSide,
  }) : new THREE.MeshPhysicalMaterial({
    // ADR-0006: die Farbe entsteht aus dem durchscheinenden Bett. Emission und
    // Metall hatten das Wasser selbst im Schatten tuerkis aufgehellt.
    // Quelle: szenenbau.py:mat_wasser (IOR 1,333, Transmission 1, Rauheit 0,03).
    // Ohne Transmission darf die durchsichtige Grundfarbe nicht als deckende
    // Albedo leuchten. Absorption wird dann als neutrales Abdunkeln geblendet;
    // der Farbton kommt vom sichtbaren Gewaesserbett, nicht von Selbstleuchten.
    // D280 (`?gewaesser=1`): dunkler, olivgrüner Wasserkörper (Streulicht im Wasser) statt schwarz.
    color: physikalisch ? new THREE.Color(PALETTE.wasser.durchsicht) : GEWAESSER_ECHT ? new THREE.Color(0.018, 0.03, 0.024) : new THREE.Color(0, 0, 0),
    roughness: 0.03, metalness: 0, transmission: physikalisch ? 1 : 0, ior: 1.333,
    thickness: 0.4,
    attenuationColor: PALETTE.wasser.absorption,
    attenuationDistance: 1 / 0.6,
    // Der Himmel ist die einzige Umgebung in der Karte. Ohne die verdeckenden
    // Baeume des Blender-Renders darf er das Wasser nicht vollstaendig aufhellen.
    envMapIntensity: GEWAESSER_ECHT ? 0.6 : form === 'becken' ? 0.15 : form === 'weiher' ? 0.25 : 0.35,
    transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false,
    forceSinglePass: true,
  });

  const zeit = { value: 0 };
  material.userData.zeit = zeit;
  // Alle Wasserflaechen einschliesslich Becken/Faelle waehrend einer
  // Szenenaufnahme ausblenden: sonst Selbstreflexion und Target-Feedback.
  material.userData.istWasser = true;

  /**
   * Uferfaktor 0…1 je Fläche. Band: Quer (`vBand.x` −1…1). Becken: Abstand zum Rechteckrand.
   * Weiher (D268): `uv.x` = halbe Tiefe in 0,5-m-Schritten, von `weiher.ts` je Ecke gesetzt.
   */
  const UFER_AUSDRUCK = form === 'becken' ? '2.0 * min(min(vBand.x, 1.0 - vBand.x), min(vBand.y, 1.0 - vBand.y))'
    : form === 'weiher' ? '2.0 * vBand.x' : '1.0 - abs(vBand.x)';
  // Wellen: auf Bändern längs/quer des Bandes; auf dem Weiher gibt es keine Laufrichtung — dort aus
  // der Weltposition, sonst stünde die Welle über die ganze Fläche gleich.
  const WELLE_Y = form === 'weiher' ? '(vWasserPos.x * 0.9 + vWasserPos.z * 0.5)' : 'vBand.y';
  const WELLE_X = form === 'weiher' ? '(vWasserPos.z * 0.8 - vWasserPos.x * 0.3)' : 'vBand.x';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.zeit = zeit;
    // Fallendes Wasser läuft schneller. Derselbe Shader, ein anderer Faktor.
    shader.uniforms.uTempo = { value: fallend ? 4.5 : 1 };
    shader.uniforms.uBodenHimmel = BODEN_HIMMEL.karte;
    shader.uniforms.uBodenRahmen = BODEN_HIMMEL.rahmen;
    if (GEWAESSER_ECHT && !fallend) {
      shader.uniforms.uSpiegelKarte = SPIEGELBILD.karte; shader.uniforms.uSpiegelMatrix = SPIEGELBILD.matrix;
      shader.uniforms.uSpiegelHoehe = SPIEGELBILD.hoehe; shader.uniforms.uSpiegelAn = SPIEGELBILD.an;
    }
    if (probe && !fallend) {
      shader.uniforms.uWehrReflex = probe.karte;
      shader.uniforms.uWehrMitte = probe.mitte;
      shader.uniforms.uWehrBereit = probe.bereit;
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBand;\nvarying vec3 vWasserPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vBand = uv;\n  vWasserPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float zeit;\nuniform float uTempo;\nvarying vec2 vBand;\nvarying vec3 vWasserPos;\nuniform sampler2D uBodenHimmel;\nuniform vec4 uBodenRahmen;\n' + HASH_GLSL + (probe && !fallend ? /* glsl */ `
uniform samplerCube uWehrReflex;
uniform vec3 uWehrMitte;
uniform float uWehrBereit;
float wehrAnteil(vec3 p) {
  // Unter Wasser keine oberseitige Luft-/Vegetationsaufnahme vortaeuschen.
  if (!gl_FrontFacing) return 0.0;
  float horizontal = 1.0 - smoothstep(25.0, 55.0, distance(p.xz, uWehrMitte.xz));
  float hoehe = 1.0 - smoothstep(2.0, 5.0, abs(p.y - uWehrMitte.y));
  return horizontal * hoehe * uWehrBereit;
}
` : ''))
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + (probe && !fallend
        ? VERDECKT_GLSL.replace('reflectedLight.indirectSpecular *= mix(1.0, texture2D(uBodenHimmel, uvH).r, kante);',
          'reflectedLight.indirectSpecular *= mix(mix(1.0, texture2D(uBodenHimmel, uvH).r, kante), 1.0, wehrAnteil(vWasserPos));')
        : VERDECKT_GLSL))
      .replace('#include <color_fragment>', fallend ? /* glsl */ `#include <color_fragment>
  float ufer = ${UFER_AUSDRUCK};

  /* Tiefe.
   *
   * Ein Bach ist am Ufer knöcheltief und in der Mitte hüfttief, und man sieht das
   * an der Farbe, nicht an der Geometrie: Je mehr Wasser über dem Grund steht, desto
   * mehr rotes Licht ist weg. Deshalb läuft die Mitte ins Blaugrüne und wird
   * dunkler, das Ufer bleibt hell und sandig.
   *
   * Das ist billiger und robuster als echte Tiefenberechnung: Die bräuchte den
   * Tiefenpuffer der Szene, ein zweites Rendertarget und würde auf Handys genau die
   * Fuellrate kosten, die wir nicht haben. */
  float tiefe = smoothstep(0.0, 0.75, ufer);
  vec3 grund = vec3(0.44, 0.46, 0.42);
  vec3 tief  = diffuseColor.rgb * vec3(0.55, 0.85, 0.95);
  diffuseColor.rgb = mix(grund, tief, tiefe);
  // Über tiefem Wasser sieht man den Grund nicht mehr — Deckkraft steigt mit.
  float deckung = mix(0.72, 0.97, tiefe);
  // Weiche Uferkante statt Plattenrand.
  diffuseColor.a = deckung * smoothstep(0.0, 0.28, ufer);
` + GISCHT_GLSL : /* glsl */ `#include <color_fragment>
  float ufer = ${UFER_AUSDRUCK};
  // Dichte .6 aus der Blender-Quelle; die Bandmitte ist nur eine Tiefennaeherung.
  float dicke = mix(0.08, ${GEWAESSER_ECHT ? (form === 'band' ? '1.6' : '3.0') : '0.8'}, smoothstep(0.0, ${GEWAESSER_ECHT ? '0.6' : '0.75'}, ufer));
  diffuseColor.a *= smoothstep(0.0, 0.28, ufer);
`)
      .replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
  // Zwei Wellenzüge unterschiedlicher Länge und Geschwindigkeit. Der zweite läuft
  // schräg, sonst entsteht ein sichtbares Streifenmuster.
  float w1 = sin(${WELLE_Y} * 2.3 - zeit * uTempo * 1.7 + ${WELLE_X} * 1.1);
  float w2 = sin(${WELLE_Y} * 5.9 - zeit * uTempo * 2.9 - ${WELLE_X} * 2.7);
  float kraus = bandRauschen(vec2(${WELLE_Y} * 1.7 - zeit * uTempo * 0.6, ${WELLE_X} * 3.0)) - 0.5;
  // normal liegt im Sichtraum. Die Weltwelle muss mitgedreht werden, sonst
  // aendert ein Kameraschwenk die Wasseroberflaeche selbst.
  vec3 wellenNormale = vec3(w2 * 0.10 + kraus * 0.16, 0.0, w1 * 0.14);
  ${GEWAESSER_ECHT && !fallend ? `
  // D280: Wellen aus drei Rauschlagen (5 m, 1,7 m, 0,5 m), die mit dem Wind treiben — kein Sinus-Streifen.
  // Normale aus dem Gefälle der Höhe (Differenzen); ruhig auf Teich und Weiher, bewegter im Bach.
  {
    vec2 wp = vWasserPos.xz;
    vec2 wind = vec2(0.35, 0.22) * zeit * uTempo;
    float e = 0.12;
    #define WH0(p) (bandRauschen((p) * 0.2 + wind * 0.25) * 0.55 + bandRauschen((p) * 0.6 - wind * 0.6) * 0.3 + bandRauschen((p) * 2.0 + wind * 1.4) * 0.15)
    ${WELLEN_ECHT ? `
    // D293 (Blender-Aufbau): Ringwelle um einen fernen Mittelpunkt, Phase mit Rauschen verzerrt (Distortion ~4,8),
    // Wellenlänge 1,3 m, läuft mit der Zeit nach aussen; dazu eine feine Lage (0,15 m) für das Glitzern. Mischung
    // 1:1 mit dem Rauschen wie im Mix-Knoten (Faktor 0,5).
    #define WRING(p) (0.5 + 0.5 * sin(length((p) - vec2(-180.0, 140.0)) * 4.83 + 4.8 * (bandRauschen((p) * 0.35 + wind * 0.1) - 0.5) * 2.0 - zeit * uTempo * 1.6))
    #define WH(p) (mix(WH0(p), WRING(p), 0.5) + bandRauschen((p) * 6.5 + wind * 2.0) * 0.06)` : '#define WH(p) WH0(p)'}
    float h0 = WH(wp), hx = WH(wp + vec2(e, 0.0)), hz = WH(wp + vec2(0.0, e));
    #undef WH0
    ${WELLEN_ECHT ? '#undef WRING' : ''}
    #undef WH
    wellenNormale = vec3(h0 - hx, 0.0, h0 - hz) / e;
  }` : ''}
  normal = normalize(normal + mat3(viewMatrix) * wellenNormale * ${fallend ? '1.0' : GEWAESSER_ECHT ? (form === 'band' ? '0.18' : WELLEN_ECHT ? '0.10' : '0.04') : '0.15'});
`);
    if (BACH_ECHT && !fallend) {
      // D267: Waldkante in der Spiegelung. Unter ihr liegt das gegenüberliegende Ufer mit Bäumen,
      // dunkel und grünbraun; darüber der Himmel. Weiche Kante, und die Wellennormale verzieht sie.
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>', /* glsl */ `#include <lights_fragment_maps>
  #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
  {
    vec3 spiegelWelt = inverseTransformDirection(reflect(-geometryViewDir, normal), viewMatrix);
    float ueberKante = smoothstep(0.12, 0.45, spiegelWelt.y);
    radiance *= mix(vec3(0.09, 0.115, 0.07), vec3(1.0), ueberKante);
  }
  #endif
`);
    }
    if (GEWAESSER_ECHT && !fallend) {
      // D280: Spiegelbild der Szene (`spiegelbild.ts`) statt Himmelskarte, wo die Fläche auf der Spiegelhöhe
      // des nächsten Stillgewässers liegt. Die Wellennormale verzieht das Bild; am Bildrand weich zurück
      // zur Himmelskarte. Fresnel und BRDF macht three.js danach wie bisher.
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uSpiegelKarte;\nuniform mat4 uSpiegelMatrix;\nuniform float uSpiegelHoehe;\nuniform float uSpiegelAn;')
        .replace('#include <lights_fragment_end>', /* glsl */ `
  #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
  if (uSpiegelAn > 0.5 && gl_FrontFacing && abs(vWasserPos.y - uSpiegelHoehe) < 0.6) {
    vec4 sp = uSpiegelMatrix * vec4(vWasserPos, 1.0);
    vec2 suv = sp.xy / sp.w + normal.xy * 0.03;
    float imBild = smoothstep(0.0, 0.04, suv.x) * smoothstep(1.0, 0.96, suv.x) * smoothstep(0.0, 0.04, suv.y) * smoothstep(1.0, 0.96, suv.y);
    radiance = mix(radiance, texture2D(uSpiegelKarte, suv).rgb, imBild);
  }
  #endif
  #include <lights_fragment_end>`);
    }
    if (probe && !fallend) {
      // PBR verarbeitet die lokale Strahlung ueber denselben Fresnel-/BRDF-Pfad
      // wie den Himmel. Keine additive Emission und kein globales environment.
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>', /* glsl */ `
  #include <lights_fragment_maps>
  #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
    float anteilWehr = wehrAnteil(vWasserPos);
    if (anteilWehr > 0.0) {
      vec3 spiegelRichtung = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
      vec3 wehrStrahlung = textureCube(uWehrReflex, spiegelRichtung).rgb * envMapIntensity;
      radiance = mix(radiance, wehrStrahlung, anteilWehr);
    }
  #endif
`);
    }
    if (!fallend && !physikalisch) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', /* glsl */ `
  // Klarwasser hat keine diffuse Albedo: outgoingLight enthaelt nur Reflexion.
  // Sie darf beim Alpha-Blenden nicht nochmals mit der Absorption skaliert werden.
  // F0 folgt IOR 1,333; Fresnel und Absorption begrenzen den sichtbaren Grund.
  float cosBlick = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  float f0 = pow((1.333 - 1.0) / (1.333 + 1.0), 2.0);
  float reflexion = f0 + (1.0 - f0) * pow(1.0 - cosBlick, 5.0);
  float deckung = 1.0 - (1.0 - reflexion) * exp(-0.6 * dicke);
${BACH_ECHT ? `  // D274: Spitzen der Spiegelung weich begrenzen (Reinhard auf die Reflexion). Sonne und heller Himmel
  // spiegelten als harte weisse Platte mit Streifenmuster; die Spiegelung bleibt, brennt aber nicht aus.
  outgoingLight = outgoingLight / (1.0 + 0.6 * outgoingLight);
` : ''}  outgoingLight /= max(deckung, 0.0001);
  diffuseColor.a *= deckung;
  #include <opaque_fragment>
`);
    }
  };

  material.customProgramCacheKey = () => `brachland-wasser-v8${GEWAESSER_ECHT ? '-gewaesser' : ''}${WELLEN_ECHT ? '-wellen' : ''}-${form}-${fallend ? 'fall' : physikalisch ? 'physikalisch' : 'lauf'}${probe && !fallend ? '-wehrprobe-v1' : ''}${BACH_ECHT && !fallend ? '-bach' : ''}`;
  return material;
}

/**
 * Feldwege und Straßen.
 *
 * Gleiche Idee, ruhiger eingestellt: ausgefranster Rand statt weicher Uferverlauf,
 * Spurrinnen über `uv.x`, Flecken über die Weltposition. Ein Weg soll ausgetreten
 * wirken, nicht gestreichelt.
 */
/**
 * D285: Wegscans (`tools/hausscans.py weg`): 2 × 2-Atlas Asphalt, Schotter, Erdpfad, Graspfad — Farbe als
 * Modulation (Mittel 0,5 → ×2), der Ton bleibt `WEGBELAG`. Welcher Scan, folgt aus dem Belag: Randschärfe
 * (`vBelag.y`) unter 0,3 Asphalt, bis 0,8 Schotter, darüber Erdpfad; Feldwege mit Spurrinnen (`vBelag.x` > 0,4)
 * tragen zwischen den Spuren den Graspfad. Projektion von oben in Weltmetern.
 */
const WEG_TEXTUREN = (() => {
  if (!BELAG_ECHT || typeof document === 'undefined') return null;
  const lade = (pfad: string) => {
    const t = new THREE.TextureLoader().load(pfad);
    t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8;
    return t;
  };
  return { farbe: lade('/material/weg-scans.webp'), normal: lade('/material/weg-scans-nor.webp') };
})();
const WEG_METER = new THREE.Vector4(...(WEG_SCANS as { rollen: { meter: number }[] }).rollen.map(r => r.meter) as [number, number, number, number]);
const WEG_SCAN_GLSL = /* glsl */ `
uniform sampler2D uWegFarbe;
uniform sampler2D uWegNormal;
uniform vec4 uWegMeter;
vec4 wegLies(sampler2D t, float r) {
  float m = r < 0.5 ? uWegMeter.x : r < 1.5 ? uWegMeter.y : r < 2.5 ? uWegMeter.z : uWegMeter.w;
  vec2 p = vWeltPos.xz / m;
  vec2 off = vec2(mod(r, 2.0), 1.0 - floor(r / 2.0)) * 0.5;
  vec2 uv = off + (fract(p) * 0.996 + 0.002) * 0.5;
  return textureGrad(t, uv, dFdx(p) * 0.5, dFdy(p) * 0.5);
}
`;

export function baueWegMaterial(): THREE.MeshStandardMaterial {
  // `vertexColors` statt einer festen Farbe: In den Weltdaten stehen neun
  // OSM-Klassen über 170,5 km, von 8 m Asphalt bis 1,6 m Trampelpfad. Sie
  // unterschieden sich bis jetzt nur in der Breite. Farbe, Spurrinne und
  // Randschärfe kommen jetzt je Vertex aus `WEGBELAG` — ein Material, ein
  // Draw Call, neun Beläge.
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff', vertexColors: true, roughness: 1, metalness: 0, transparent: true,
  });

  material.onBeforeCompile = (shader) => {
    if (WEG_TEXTUREN) {
      shader.uniforms.uWegFarbe = { value: WEG_TEXTUREN.farbe };
      shader.uniforms.uWegNormal = { value: WEG_TEXTUREN.normal };
      shader.uniforms.uWegMeter = { value: WEG_METER };
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
        '#include <common>\nattribute vec2 belag;\nvarying vec2 vBand;\nvarying vec2 vBelag;\nvarying vec3 vWeltPos;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\n  vBand = uv;\n  vBelag = belag;\n  vWeltPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBand;\nvarying vec2 vBelag;\nvarying vec3 vWeltPos;\n' + HASH_GLSL + (WEG_TEXTUREN ? WEG_SCAN_GLSL : ''))
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
  float quer = abs(vBand.x);
  float rand = 1.0 - quer;

  /* Spurrinnen nur dort, wo Raeder auf losem Grund fahren.
   *
   * vBelag.x ist die Staerke aus WEGBELAG: Asphalt 0, Feldweg 0,55. Vorher
   * bekam jeder Weg dieselben zwei Rinnen — auch die Staatsstrasse. */
  float rinne = exp(-pow((quer - 0.55) * 5.5, 2.0)) * vBelag.x;
  diffuseColor.rgb *= 1.0 + rinne * 0.40;

  // Flecken aus der Weltposition, damit benachbarte Segmente zusammenpassen.
  // Gebundene Decke fleckt weniger als Schotter.
  float fleck = bandRauschen(vWeltPos.xz * 0.85);
  float unruhe = 0.10 + 0.26 * clamp(vBelag.y, 0.0, 1.2);
  diffuseColor.rgb *= (1.0 - unruhe * 0.5) + fleck * unruhe;

  /* Ausgefranster Rand. vBelag.y entscheidet, wie weich die Kante ist:
   * Asphalt hat eine gebaute Kante (0,15), ein Trampelpfad gar keine (1,2). */
  float franse = bandRauschen(vec2(vBand.y * 1.4, vBand.x * 2.0)) * 0.22 * vBelag.y;
  diffuseColor.a *= smoothstep(0.0, 0.12 + 0.28 * vBelag.y + franse, rand);
${WEG_TEXTUREN ? `
  // D285: Scan nach Belag; Feldweg zwischen den Spuren Graspfad.
  float wegR = vBelag.y < 0.3 ? 0.0 : vBelag.y < 0.8 ? 1.0 : 2.0;
  float wegGras = step(0.4, vBelag.x) * (1.0 - smoothstep(0.22, 0.38, quer));
  vec3 wegScan = mix(wegLies(uWegFarbe, wegR).rgb, wegLies(uWegFarbe, 3.0).rgb, wegGras) * 2.0;
  // Alter Asphalt ist grau, nicht schwarz: die Palette bleibt der Ton, der Belag hellt um 30 % auf.
  diffuseColor.rgb *= wegScan * (wegR < 0.5 ? 1.3 : 1.0);
  vec3 wegNt = mix(wegLies(uWegNormal, wegR).xyz, wegLies(uWegNormal, 3.0).xyz, wegGras) * 2.0 - 1.0;` : ''}
`)
      .replace('#include <normal_fragment_maps>', WEG_TEXTUREN ? `#include <normal_fragment_maps>
  {
    vec3 wn = inverseTransformDirection(normal, viewMatrix);
    wn = normalize(wn + vec3(wegNt.x, 0.0, wegNt.y) * 0.8);
    normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
  }` : '#include <normal_fragment_maps>');
  };

  material.customProgramCacheKey = () => 'brachland-weg-v2' + (WEG_TEXTUREN ? '-scans' : '');
  return material;
}
