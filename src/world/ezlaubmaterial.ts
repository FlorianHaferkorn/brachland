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

/** Deckungswechsel um die Blatt-Schwelle zentrieren, damit der Rand nicht mit der Ableitung schrumpft. */
export function beruhigeEzBlattkante(material: THREE.Material): void {
  const vorher = material.onBeforeCompile, programm = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    vorher.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', /* glsl */ `
      #ifdef USE_ALPHATEST
        #ifdef ALPHA_TO_COVERAGE
          float ezRandbreite = max(fwidth(diffuseColor.a), 0.0001);
          diffuseColor.a = smoothstep(alphaTest - ezRandbreite * 0.5, alphaTest + ezRandbreite * 0.5, diffuseColor.a);
          if (diffuseColor.a == 0.0) discard;
        #else
          if (diffuseColor.a < alphaTest) discard;
        #endif
      #endif
    `);
  };
  material.customProgramCacheKey = () => `${programm()}:ez-blattrand-v1`;
  material.needsUpdate = true;
}

/** three.js ersetzt bei Alpha-to-Coverage selbst eigene Schatten-Schwellen durch 0,5.
 * Erst nach dieser Vorbereitung die tatsächliche Blattdeckung am gezeichneten Material bewahren.
 */
export function bewahreEzBlattschatten(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhongMaterial>): void {
  const vorher = mesh.onBeforeShadow;
  mesh.onBeforeShadow = (...argumente) => {
    vorher.call(mesh, ...argumente);
    argumente[5].alphaTest = mesh.material.alphaTest;
  };
}

/** Nach anderen Shader-Anpassungen aufrufen; vorhandene Hooks bleiben erhalten. */
export function ergaenzeEzLaublicht(material: THREE.Material, matt = false): void {
  const vorher = material.onBeforeCompile;
  const programm = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    vorher.call(material, shader, renderer);
    // Phong behält selbst bei schwarzer Glanzfarbe Fresnel-Reflexe im Streiflicht.
    if (matt) shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>',
      '#include <lights_fragment_end>\nreflectedLight.directSpecular = vec3(0.0);');
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
  material.customProgramCacheKey = () => `${programm()}:ez-laublicht-v3${matt ? ':matt' : ''}`;
  material.needsUpdate = true;
}
