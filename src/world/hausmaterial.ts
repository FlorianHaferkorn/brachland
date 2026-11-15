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
import { HAUS_ECHT } from './echt.js';
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
        .replace('#include <common>', '#include <common>\nattribute float rolle;\nvarying float vRolle;\nvarying vec3 vHausPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vRolle = rolle;\n  vHausPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + SCAN_PARS)
        .replace('#include <color_fragment>', `#include <color_fragment>
  float scanR = floor(vRolle + 0.5);
  vec2 scanP = vec2(0.0);
  if (scanR < 3.5) {
    scanP = scanUv(scanR);
    diffuseColor.rgb *= scanLies(uScanFarbe, scanP, scanR).rgb * 2.0;
  }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (scanR < 3.5) {
    vec3 sn = scanLies(uScanNormal, scanP, scanR).xyz * 2.0 - 1.0;
    sn.xy *= 0.8;
    vec3 nw = normalize(scanT * sn.x + scanB * sn.y + scanN * sn.z);
    normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
  }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  if (scanR > 1.5 && scanR < 2.5) roughnessFactor = 0.72;
  // D285: Glas — glatt, spiegelt die Umgebungskarte (Himmelslicht \`?umlicht=1\`); dahinter dunkler Raum.
  // Leichte Welligkeit je Scheibe (alte Fenster), damit nicht jede Scheibe ein perfekter Spiegel ist.
  if (scanR > 4.5) roughnessFactor = 0.05 + 0.08 * fract(sin(dot(floor(vHausPos.xz * 1.3), vec2(12.9898, 78.233))) * 43758.5453);`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  if (scanR > 4.5) radiance *= 1.6;`);
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
  material.customProgramCacheKey = () => 'brachland-haus-glut-v1' + (SCAN_TEXTUREN ? '-scans' : '');
  return material;
}
