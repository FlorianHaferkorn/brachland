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
export function ergaenzeEzLaublicht(material: THREE.Material, matt = false, kulisse?: 'laubbaum' | 'nadelbaum', kronentiefe = false): void {
  const vorher = material.onBeforeCompile;
  const programm = material.customProgramCacheKey.bind(material);
  const kulissenton = kulisse ? { value: kulisse === 'laubbaum'
    ? new THREE.Vector3(1.13, 1.04, 0.67) : new THREE.Vector3(0.91, 0.99, 0.87) } : null;
  material.onBeforeCompile = (shader, renderer) => {
    vorher.call(material, shader, renderer);
    if (kulissenton) {
      shader.uniforms.uEzKulissenton = kulissenton;
      shader.fragmentShader = 'uniform vec3 uEzKulissenton;\n' + shader.fragmentShader;
    }
    if (kronentiefe) {
      shader.vertexShader = 'attribute float aEzKronentiefe; varying float vEzKronentiefe;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvEzKronentiefe = aEzKronentiefe;');
      shader.fragmentShader = 'varying float vEzKronentiefe;\n' + shader.fragmentShader;
    }
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
      diffuseColor.rgb = ezBlattfarbe * ${kronentiefe
        ? 'mix(1.0, inversesqrt(max(ezBlatthelligkeit, 0.01)), 0.69) * vEzKronentiefe'
        : 'inversesqrt(max(ezBlatthelligkeit, 0.01))'};
      ${kulisse ? /* glsl */ `
        // Gedämpfte Olive an den breiten Laubkronen und kühle Töne am Nadelsaum.
        float ezLicht = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = mix(diffuseColor.rgb, uEzKulissenton * ezLicht, 0.72) * 0.67;
      ` : ''}
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', /* glsl */ `
      #include <lights_fragment_end>
      // Rueckseitiges Sonnenlicht wie beim bestehenden Baum-Laubmaterial.
      #if NUM_DIR_LIGHTS > 0
        float ezRueck = max(0.0, -dot(geometryNormal, directionalLights[0].direction));
        reflectedLight.directDiffuse += BRDF_Lambert(diffuseColor.rgb) * directionalLights[0].color * ezRueck * ${kronentiefe ? '0.26' : kulisse ? '0.32' : '0.45'};
      #endif
      // Ein kleiner Anteil mehrfach gestreuten Himmelslichts in dichten Kronen.
      #if NUM_HEMI_LIGHTS > 0
        reflectedLight.indirectDiffuse += BRDF_Lambert(diffuseColor.rgb) * getHemisphereLightIrradiance(hemisphereLights[0], geometryNormal) * ${kronentiefe ? '0.19' : kulisse ? '0.25' : '0.35'};
      #endif
    `);
  };
  material.customProgramCacheKey = () => `${programm()}:ez-laublicht-v3${matt ? ':matt' : ''}${kulisse ? ':kulisse' : ''}${kronentiefe ? ':tiefe' : ''}`;
  material.needsUpdate = true;
}

/** Relief aus der Höhenmaske der vorhandenen Rindenkarte, ohne neuen Texturslot. */
export function ergaenzeEzRinde(material: THREE.MeshPhongMaterial): void {
  const vorher = material.onBeforeCompile;
  const programm = material.customProgramCacheKey.bind(material);
  material.normalMap = null;
  material.aoMap = null;
  material.specular.setScalar(.034);
  material.shininess = 9;
  material.onBeforeCompile = (shader, renderer) => {
    vorher.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', /* glsl */ `
      #include <normal_fragment_maps>
      #ifdef USE_MAP
        float ezRinde = texture2D(map, vMapUv).a;
        vec3 ezRindeX = dFdx(-vViewPosition);
        vec3 ezRindeY = dFdy(-vViewPosition);
        vec3 ezRindeR1 = cross(ezRindeY, normal);
        vec3 ezRindeR2 = cross(normal, ezRindeX);
        float ezRindeDet = dot(ezRindeX, ezRindeR1);
        vec3 ezRindeGrad = sign(ezRindeDet) * (dFdx(ezRinde) * ezRindeR1 + dFdy(ezRinde) * ezRindeR2);
        normal = normalize(max(0.00000001, abs(ezRindeDet)) * normal - ezRindeGrad * .040);
      #endif
    `);
  };
  material.customProgramCacheKey = () => `${programm()}:ez-rindenrelief`;
  material.needsUpdate = true;
}
