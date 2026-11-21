/**
 * BRACHLAND — Baum-Impostor für die Fernstufe (D367)
 *
 * Bis D367 war die Fernstufe der Blender-Bäume dieselbe Krone, auf 25 % (Buche) bzw. 60 % (Fichte) dezimiert:
 * 500–1.250 Dreiecke je Baum, und die Dezimierung frass die Kronenmassen zu Ballons. Jetzt backt
 * `tools/baumbau.py` je Baum acht orthografische Ansichten (alle 45° um die Hochachse) vom **Nahbaum** — Farbe +
 * Deckung und Modell-Normale — in einen Atlas, und die Ferne zeichnet zwei Dreiecke je Baum:
 *
 * - **Quad um die Hochachse zur Kamera gedreht** (zylindrisch, der Baum kippt nicht mit dem Blick).
 * - **Ansicht** aus dem Winkel Kamera ↔ Baumdrehung; zwischen den zwei nächsten Ansichten wird überblendet.
 * - **Licht** aus der gebackenen Normale, gedreht wie die Instanz: Sonne und Nebel wirken wie am Netz.
 * - **Übergabe von der Mittelstufe** (`ueberblend`): Bäume der Mittelstufe im Band vor `ATTRAPPE_AB` stehen
 *   zusätzlich als Impostor im Bündel; beide verwerfen komplementär nach demselben Bildschirmraster.
 *
 * Die reine Winkelrechnung steht hier ohne three.js-Abhängigkeit oben (`impostorAnsicht`) und ist getestet
 * (`tests/impostor.test.ts`); der Shader rechnet dieselbe Formel.
 */
import * as THREE from 'three';
import { UEBERBLEND_GLSL } from './windmaterial.js';

/** D367: Breite des Übergabebandes Mittelstufe → Impostor in Metern, vor `ATTRAPPE_AB · weite`. */
export const UEBERBLEND_BAND = 24;
/** Gemeinsames Uniform für Netz (`windmaterial` `ueberblend`) und Impostor: (Ende des Bandes, Breite). Die Szene setzt x. */
export const BAUM_UEBERBLEND = { value: new THREE.Vector2(110, UEBERBLEND_BAND) };

/** Rahmen eines gebackenen Impostors — aus `public/props/baeume.json` (`impostor`). */
export interface ImpostorRahmen {
  /** Breite und Höhe des Bildrahmens in Modellmetern. */
  breite: number;
  hoehe: number;
  /** Unterkante des Rahmens in Modellmetern (unter dem Boden: die Wurzeln tauchen ein). */
  unten: number;
  ansichten: number;
  zelle: [number, number];
}

/**
 * Welche zwei gebackenen Ansichten für eine Kamera gelten, und wie stark die zweite.
 *
 * `dx`, `dz`: Richtung vom Baum zur Kamera in Weltlage (three: y oben). `drehung`: Instanzdrehung um y.
 * Ansicht i ist in Blender von Azimut a_i = i · 360°/n aus gerendert, Kamera auf (cos a, sin a, 0) — in three
 * (glTF, y oben) ist das (cos a, 0, −sin a). Die Modellrichtung der Kamera ist R_y(−drehung) · d.
 */
export function impostorAnsicht(dx: number, dz: number, drehung: number, ansichten: number): { a: number; b: number; misch: number } {
  const c = Math.cos(drehung), s = Math.sin(drehung);
  // R_y(−θ): x' = c·x − s·z, z' = s·x + c·z
  const mx = c * dx - s * dz, mz = s * dx + c * dz;
  let w = Math.atan2(-mz, mx) / (2 * Math.PI) * ansichten;
  w = ((w % ansichten) + ansichten) % ansichten;
  const a = Math.floor(w) % ansichten;
  return { a, b: (a + 1) % ansichten, misch: w - Math.floor(w) };
}

/** Ein Quad, Ursprung unten Mitte, x = rechts (Kamera), y = oben; uv 0…1. */
export function impostorGeometrie(r: ImpostorRahmen): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(r.breite, r.hoehe);
  g.translate(0, r.unten + r.hoehe / 2, 0);
  return g;
}

const IMPOSTOR_PARS_VERTEX = /* glsl */ `
uniform float uAnsichten;
attribute float aUeberblend;
varying vec2 vUvA;
varying vec2 vUvB;
varying float vMisch;
varying mat3 vImpZuSicht;
varying float vImpBand;
varying float vImpD;
`;

/** Ersetzt `project_vertex`: Quad um die Hochachse zur Kamera drehen, Ansicht wählen. */
const IMPOSTOR_PROJEKTION = /* glsl */ `
  mat4 impM = modelMatrix * instanceMatrix;
  vec3 impMitte = impM[3].xyz;
  float impSkala = length(instanceMatrix[0].xyz);
  mat3 impR = mat3(instanceMatrix) / impSkala;
  vec3 zuKam = cameraPosition - impMitte;
  vec2 d = normalize(zuKam.xz + vec2(1e-5, 0.0));
  vec3 rechts = vec3(d.y, 0.0, -d.x);
  vec3 welt = impMitte + rechts * (transformed.x * impSkala) + vec3(0.0, transformed.y * impSkala, 0.0);
  vec4 mvPosition = viewMatrix * vec4(welt, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  // Kamera in Modellrichtung: R^T · d (Instanzdrehung ist reine Drehung um y)
  vec3 dm = transpose(impR) * vec3(d.x, 0.0, d.y);
  float w = atan(-dm.z, dm.x) / 6.28318530718 * uAnsichten;
  w = mod(w, uAnsichten);
  float ia = floor(w);
  vMisch = w - ia;
  float ib = mod(ia + 1.0, uAnsichten);
  vUvA = vec2((ia + uv.x) / uAnsichten, uv.y);
  vUvB = vec2((ib + uv.x) / uAnsichten, uv.y);
  vImpZuSicht = mat3(viewMatrix) * mat3(modelMatrix) * impR;
  vImpBand = aUeberblend;
  vImpD = length(zuKam);
`;

const IMPOSTOR_PARS_FRAGMENT = /* glsl */ `
uniform sampler2D uImpFarbe;
uniform sampler2D uImpNormal;
uniform vec2 uUeberblend;
varying vec2 vUvA;
varying vec2 vUvB;
varying float vMisch;
varying mat3 vImpZuSicht;
varying float vImpBand;
varying float vImpD;
` + UEBERBLEND_GLSL;

/** Farbe und Deckung: zwei Ansichten gemischt; Alpha-Test wie das Laubloch; im Übergabeband das Gegenraster. */
const IMPOSTOR_FARBE = /* glsl */ `
  vec4 impA = texture2D(uImpFarbe, vUvA), impB = texture2D(uImpFarbe, vUvB);
  vec4 impF = mix(impA, impB, vMisch);
  // Mip-Erosion ausgleichen: In der Ferne mittelt das Mip-Level dünne Stämme und Klumpen unter 0,5, der Wald
  // wurde licht (Bildpaar D367, erster Lauf). Deckung je Mip-Stufe um 25 % anheben (Golus, „Anti-aliased Alpha Test").
  vec2 impTexel = vUvA * vec2(textureSize(uImpFarbe, 0));
  float impLod = max(0.0, 0.5 * log2(max(dot(dFdx(impTexel), dFdx(impTexel)), dot(dFdy(impTexel), dFdy(impTexel)))));
  impF.a *= 1.0 + impLod * 0.25;
  if (impF.a < 0.5) discard;
  if (vImpBand > 0.5) {
    float uf = smoothstep(uUeberblend.x - uUeberblend.y, uUeberblend.x, vImpD);
    if (ueberblendRaster() >= uf) discard;
  }
  diffuseColor.rgb *= impF.rgb;
`;

/** Gebackene Blender-Objektnormale (z oben) → three-Modell (y oben) → Sicht. */
const IMPOSTOR_NORMALE = /* glsl */ `
  {
    vec3 nb = mix(texture2D(uImpNormal, vUvA).xyz, texture2D(uImpNormal, vUvB).xyz, vMisch) * 2.0 - 1.0;
    normal = normalize(vImpZuSicht * vec3(nb.x, nb.z, -nb.y));
  }
`;

const TEXTUREN = new Map<string, THREE.Texture>();
function karte(datei: string, farbe: boolean): THREE.Texture {
  let t = TEXTUREN.get(datei);
  if (!t) {
    t = new THREE.TextureLoader().load(`/material/${datei}.webp`);
    t.colorSpace = farbe ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 4;
    TEXTUREN.set(datei, t);
  }
  return t;
}

/**
 * Material eines Impostors. `datei` = Registername (`baum-buche-0-fern`), die Karten heissen `<datei>-farbe/-normal`.
 * Geteilt wird je Datei (Cache), `ueberblend` ist das Uniform der Szene (dasselbe Objekt wie im Netzmaterial).
 */
const MATERIALIEN = new Map<string, THREE.MeshStandardMaterial>();
export function impostorMaterial(datei: string, rahmen: ImpostorRahmen, ueberblend: { value: THREE.Vector2 }): THREE.MeshStandardMaterial {
  const schluessel = datei;
  let m = MATERIALIEN.get(schluessel);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  const farbe = karte(`${datei}-farbe`, true), normal = karte(`${datei}-normal`, false);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uImpFarbe = { value: farbe };
    shader.uniforms.uImpNormal = { value: normal };
    shader.uniforms.uAnsichten = { value: rahmen.ansichten };
    shader.uniforms.uUeberblend = ueberblend;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + IMPOSTOR_PARS_VERTEX)
      .replace('#include <project_vertex>', '#ifdef USE_INSTANCING\n' + IMPOSTOR_PROJEKTION + '\n#else\n#include <project_vertex>\n#endif')
      // Schatten/Nebel/Weltlage lesen danach `mvPosition`; `worldpos_vertex` nimmt sonst die ungedrehte Lage.
      .replace('#include <worldpos_vertex>', '#ifdef USE_INSTANCING\nvec4 worldPosition = vec4(welt, 1.0);\n#else\n#include <worldpos_vertex>\n#endif');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + IMPOSTOR_PARS_FRAGMENT)
      .replace('#include <map_fragment>', '#include <map_fragment>' + IMPOSTOR_FARBE)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + IMPOSTOR_NORMALE);
  };
  m.customProgramCacheKey = () => 'brachland-impostor-v1';
  MATERIALIEN.set(schluessel, m);
  return m;
}
