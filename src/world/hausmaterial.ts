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
  material.customProgramCacheKey = () => 'brachland-haus-glut-v1';
  return material;
}
