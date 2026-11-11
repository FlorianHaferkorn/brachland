/**
 * Lichtdurchlass fuer die Blattkarten der EZ-Tree-Probe.
 *
 * Die fotografischen Karten sind deutlich dunkler als die gebackenen Farben der
 * Blender-Baeume. Ein reines Phong-Material behandelt sie zudem als opake
 * Flaechen: Licht von hinten und mehrfach gestreutes Himmelslicht fehlen.
 * Dieser kleine, lichtabhaengige Anteil beleuchtet nur das Laub; nachts wird
 * nichts selbstleuchtend. Der Schattenpass bleibt unveraendert.
 */
import * as THREE from 'three';

/** Nach anderen Shader-Anpassungen aufrufen; vorhandene Hooks bleiben erhalten. */
export function ergaenzeEzLaublicht(material: THREE.Material): void {
  const vorher = material.onBeforeCompile;
  const programm = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    vorher.call(material, shader, renderer);
    // Die Poly-Haven-Karten sind fuer eine dunklere Scanvorlage belichtet.
    // Im linearen Farbraum die Leuchtdichte anheben, ohne die Farbanteile
    // einzeln zu veraendern. So bleibt die Saettigung der Blattkarte erhalten.
    // Kein selbstleuchtender Anteil: Die Nacht bleibt lichtabhaengig.
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 ezBlattfarbe = max(diffuseColor.rgb, vec3(0.0));
      float ezBlatthelligkeit = dot(ezBlattfarbe, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb = ezBlattfarbe * inversesqrt(max(ezBlatthelligkeit, 0.01));
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', /* glsl */ `
      #include <lights_fragment_end>
      // Rueckseitiges Sonnenlicht wie beim bestehenden Baum-Laubmaterial.
      #if NUM_DIR_LIGHTS > 0
        float ezRueck = max(0.0, -dot(geometryNormal, directionalLights[0].direction));
        reflectedLight.directDiffuse += BRDF_Lambert(diffuseColor.rgb) * directionalLights[0].color * ezRueck * 0.45;
      #endif
      // Ein kleiner Anteil mehrfach gestreuten Himmelslichts in dichten Kronen.
      #if NUM_HEMI_LIGHTS > 0
        reflectedLight.indirectDiffuse += BRDF_Lambert(diffuseColor.rgb) * getHemisphereLightIrradiance(hemisphereLights[0], geometryNormal) * 0.35;
      #endif
    `);
  };
  material.customProgramCacheKey = () => `${programm()}:ez-laublicht-v3`;
  material.needsUpdate = true;
}
