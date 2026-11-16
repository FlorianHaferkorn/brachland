/**
 * BRACHLAND — Hausmaterial mit Fensterglut (D134)
 *
 * Ein Material für alle Häuser einer Kachel: Wand, Holz, Fenster, Sockel, Tür
 * stecken als Vertexfarben in der Geometrie. Nachts fehlte dem Dorf das eine,
 * woran man ein bewohntes Haus erkennt — Licht hinter den Fenstern. Der
 * billigste Weg dahin ist derselbe wie beim Wasser (`bandmaterial.ts`): kein
 * zweites Material, keine zweite Geometrie, kein zweiter Draw Call, sondern ein
 * Attribut je Ecke (`glut`, 1 an brennenden Scheiben, sonst 0) und eine Zeile
 * Emissiv im Fragment-Shader, skaliert mit einem Uniform je Stimmung.
 *
 * Die Glutfarbe ist warm und liegt als Strahldichte **vor** der Belichtung:
 * Bei `nacht` (Belichtung 2,6) kommt eine Scheibe damit auf rund 0,7 linear —
 * hell, aber nicht ausgebrannt, und der Rahmen daneben bleibt, was er ist.
 */
import * as THREE from 'three';
import { BAUWELT_AN, HAUS_ECHT, HAUSFRONT_AN } from './echt.js';
import { bueschelTextur } from './laubkarten.js';
import { HAUSFRONT_PARS, HAUSFRONT_FARBE } from './hausfront.js';
import SCANS from '../../public/material/haus-scans.json';

/**
 * D284: Hausscans als 2 × 2-Atlas (`tools/hausscans.py`): Putz, Schalung, Dach, Sockel. Farbe ist Modulation
 * (Mittel 0,5 → ×2), der Ton bleibt die Palette. Normale OpenGL. Kantenlänge je Kachel in Metern aus der JSON.
 */
const SCAN_TEXTUREN = (() => {
  if (!HAUS_ECHT || typeof document === 'undefined') return null;
  const lade = (pfad: string) => {
    const t = new THREE.TextureLoader().load(pfad);
    t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8;
    return t;
  };
  return { farbe: lade('/material/haus-scans.webp'), normal: lade('/material/haus-scans-nor.webp') };
})();
const SCAN_METER = new THREE.Vector4(...(SCANS as { rollen: { meter: number }[] }).rollen.map(r => r.meter) as [number, number, number, number]);

/**
 * Projektion in der Flächenebene: u waagerecht entlang der Fläche, v die Fallinie hinauf. So laufen Bretter an
 * jeder Wand senkrecht und Ziegelreihen an jedem Dach parallel zur Traufe, egal wie das Haus gedreht ist —
 * eine dreiachsige Projektion hätte die Ziegelreihen an der Hälfte der Dächer quer gelegt.
 */
/**
 * D289 Verfall (Bauwelt D287): Moos auf der Dachhaut, Feuchte und Algen am Sockel, Efeu von unten die Wände hinauf —
 * Stärke nach der Verfallsstufe je Haus (Attribut `zustand.x`: 0 bewohnt, 1 verlassen, 2 verfallen), Höhe über dem
 * Sockel aus `zustand.y`. Efeu nimmt Farbe und Deckung aus dem Laub-Büschelatlas (D282), in der Wandebene gelesen.
 */
const VERFALL_PARS = /* glsl */ `
uniform sampler2D uEfeu;
varying vec2 vZustand;
float verfallHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float verfallRauschen(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(verfallHash(i), verfallHash(i + vec2(1.0, 0.0)), f.x), mix(verfallHash(i + vec2(0.0, 1.0)), verfallHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;
const VERFALL_FARBE = /* glsl */ `
  float vStufe = vZustand.x, vHoehe = vZustand.y;
  // Bauwelt D287: Das Erdgeschoss ist weiss gekalkt (Denkmalliste: verputztes Nagelfluh-/Feldsteinmauerwerk). Der Paletten-
  // putz las mit dem Scan als grauer Granit — aufhellen; verlassene Häuser vergrauen etwas.
  if (scanR < 0.5) diffuseColor.rgb *= mix(vec3(1.5, 1.48, 1.42), vec3(1.25, 1.24, 1.2), vStufe * 0.5);
  // D292: Holz altert. Ungestrichenes Lärchen-/Fichtenholz wird an der Sonne dunkelbraun, im Wetter silbergrau — nach
  // 40–60 Jahren ohne Pflege (D287) erst recht; das Palettenholz las mit dem Scan als frisches Orange. Bewohnt
  // dunkler und gedämpft, verlassen und verfallen zunehmend grau.
  if (scanR > 0.5 && scanR < 1.5) {
    float holzL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 vergraut = vec3(holzL) * vec3(1.02, 0.98, 0.92);
    diffuseColor.rgb = mix(diffuseColor.rgb, vergraut, 0.38 + vStufe * 0.2) * (0.86 - vStufe * 0.04);
  }
  float efeuDeckung = 0.0;
  vec3 efeuFarbe = vec3(0.0);
  if (scanR < 3.5) {
    vec2 wp = vec2(dot(vHausPos, scanT), vHausPos.y);
    float n1 = verfallRauschen(wp * 0.35 + vHausPos.xz * 0.05), n2 = verfallRauschen(wp * 1.7 + 13.0);
    if (scanR > 1.5 && scanR < 2.5) {
      // Moos und Gras auf der Dachhaut: Flecken, an der Traufe und in Kehlen dichter; bewohnt nur ein Hauch.
      float moos = smoothstep(0.55 - vStufe * 0.22, 0.85 - vStufe * 0.2, n1 * 0.7 + n2 * 0.3);
      vec3 moosFarbe = mix(vec3(0.16, 0.19, 0.07), vec3(0.30, 0.31, 0.12), n2);
      diffuseColor.rgb = mix(diffuseColor.rgb, moosFarbe, moos * (0.25 + vStufe * 0.35));
    } else {
      // Feuchte und Algen am Sockel, Schmutzläufer von oben — mit der Stufe stärker.
      float feucht = (1.0 - smoothstep(0.0, 0.6 + vStufe * 0.5, vHoehe)) * (0.25 + vStufe * 0.2);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.62, 0.5), feucht);
      // Efeu: von unten nach oben, verlassen bis ~3 m, verfallen bis unters Dach; bewohnte Häuser frei.
      float reicht = vStufe < 0.5 ? -1.0 : vStufe < 1.5 ? 3.2 : 7.5;
      float mass = smoothstep(reicht, reicht - 1.8, vHoehe + (n1 - 0.5) * 3.0) * smoothstep(0.35, 0.6, n1 + n2 * 0.25);
      if (mass > 0.01) {
        vec2 ep = wp / 0.9;
        vec2 ez = floor(ep);
        float ek = floor(verfallHash(ez) * 16.0);
        vec2 euv = (fract(ep) + vec2(mod(ek, 4.0), floor(ek / 4.0))) * 0.25;
        vec4 blatt = textureGrad(uEfeu, euv, dFdx(ep) * 0.25, dFdy(ep) * 0.25);
        efeuDeckung = mass * smoothstep(0.2, 0.5, blatt.a + mass * 0.35);
        efeuFarbe = blatt.rgb * 0.9;
        diffuseColor.rgb = mix(diffuseColor.rgb, efeuFarbe, efeuDeckung);
      }
    }
  }
`;

const SCAN_PARS = /* glsl */ `
uniform sampler2D uScanFarbe;
uniform sampler2D uScanNormal;
uniform vec4 uScanMeter;
varying float vRolle;
varying vec3 vHausPos;
vec3 scanT, scanB, scanN;
vec2 scanUv(float r) {
  scanN = normalize(cross(dFdx(vHausPos), dFdy(vHausPos)));
  vec3 hoch = vec3(0.0, 1.0, 0.0);
  scanT = abs(scanN.y) > 0.97 ? vec3(1.0, 0.0, 0.0) : normalize(cross(hoch, scanN));
  scanB = cross(scanN, scanT);
  float m = r < 0.5 ? uScanMeter.x : r < 1.5 ? uScanMeter.y : r < 2.5 ? uScanMeter.z : uScanMeter.w;
  return vec2(dot(vHausPos, scanT), dot(vHausPos, scanB)) / m;
}
vec4 scanLies(sampler2D t, vec2 p, float r) {
  // Kachel im 2 × 2-Atlas (Zeile 0 oben im Bild = oben in UV); textureGrad gegen Mip-Sprünge an der Wiederholung.
  vec2 off = vec2(mod(r, 2.0), 1.0 - floor(r / 2.0)) * 0.5;
  vec2 uv = off + (fract(p) * 0.996 + 0.002) * 0.5;
  return textureGrad(t, uv, dFdx(p) * 0.5, dFdy(p) * 0.5);
}
`;

/** Strahldichte einer brennenden Scheibe bei Glut 1, linear. Warmes Lampenlicht. */
const GLUT_FARBE = new THREE.Vector3(0.30, 0.21, 0.11);

export function baueHausMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.88, flatShading: true,
  });
  const glut = { value: 0 };
  material.userData.glut = glut;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlut = glut;
    if (SCAN_TEXTUREN) {
      shader.uniforms.uScanFarbe = { value: SCAN_TEXTUREN.farbe };
      shader.uniforms.uScanNormal = { value: SCAN_TEXTUREN.normal };
      shader.uniforms.uScanMeter = { value: SCAN_METER };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float rolle;\nvarying float vRolle;\nvarying vec3 vHausPos;' + (BAUWELT_AN ? '\nattribute vec2 zustand;\nvarying vec2 vZustand;' : '') + (HAUSFRONT_AN ? '\nattribute vec3 raumUv;\nvarying vec3 vRaumUv;\nvarying vec3 vHausNormal;' : ''))
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vRolle = rolle;\n  vHausPos = (modelMatrix * vec4(transformed, 1.0)).xyz;' + (BAUWELT_AN ? '\n  vZustand = zustand;' : '') + (HAUSFRONT_AN ? '\n  vRaumUv = raumUv; vHausNormal = normalize(mat3(modelMatrix) * objectNormal);' : ''));
      if (BAUWELT_AN) shader.uniforms.uEfeu = { value: bueschelTextur('laub') };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + SCAN_PARS + (BAUWELT_AN ? VERFALL_PARS : '') + (HAUSFRONT_AN ? HAUSFRONT_PARS : ''))
        .replace('#include <color_fragment>', `#include <color_fragment>
  float scanR = floor(vRolle + 0.5);
  vec2 scanP = vec2(0.0);
  if (scanR < 3.5) {
    scanP = scanUv(scanR);
    diffuseColor.rgb *= scanLies(uScanFarbe, scanP, scanR).rgb * 2.0;
  }
${BAUWELT_AN ? VERFALL_FARBE : ''}
${HAUSFRONT_AN ? HAUSFRONT_FARBE : ''}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (scanR < 3.5) {
    vec3 sn = scanLies(uScanNormal, scanP, scanR).xyz * 2.0 - 1.0;
    sn.xy *= 0.8${BAUWELT_AN ? ' * (1.0 - efeuDeckung)' : ''};
    vec3 nw = normalize(scanT * sn.x + scanB * sn.y + scanN * sn.z);
    normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
  }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  if (scanR > 1.5 && scanR < 2.5) roughnessFactor = 0.72;${BAUWELT_AN ? '\n  roughnessFactor = mix(roughnessFactor, 0.65, efeuDeckung);' : ''}
  // D285: Glas — glatt, spiegelt die Umgebungskarte (Himmelslicht \`?umlicht=1\`); dahinter dunkler Raum.
  // Leichte Welligkeit je Scheibe (alte Fenster), damit nicht jede Scheibe ein perfekter Spiegel ist.
  if (scanR > 4.5) roughnessFactor = 0.05 + 0.08 * fract(sin(dot(floor(vHausPos.xz * 1.3), vec2(12.9898, 78.233))) * 43758.5453);`)
        .replace('#include <lights_fragment_end>', `
  // D295: Vor RE_IndirectSpecular skalieren; danach wird radiance nicht mehr gelesen.
  if (scanR > 4.5) radiance *= 1.6;
  #include <lights_fragment_end>`);
    }
    shader.uniforms.uGlutFarbe = { value: GLUT_FARBE };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float glut;\nvarying float vGlut;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlut = glut;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlut;\nuniform vec3 uGlutFarbe;\nvarying float vGlut;')
      .replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
  totalEmissiveRadiance += uGlutFarbe * (vGlut * uGlut);
`);
  };
  material.customProgramCacheKey = () => 'brachland-haus-glut-v2' + (SCAN_TEXTUREN ? '-scans' : '') + (BAUWELT_AN ? '-verfall' : '') + (HAUSFRONT_AN ? '-hausfront' : '');
  return material;
}
