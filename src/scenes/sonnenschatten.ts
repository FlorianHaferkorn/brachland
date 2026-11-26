import * as THREE from 'three';

/** Der direkte Standard-BRDF multipliziert jeden Beitrag mit max(N·L, 0).
 * Rückwärtige Fragmente brauchen deshalb weder die fünf PCF-Proben noch die BRDF.
 * Klarlack verwendet eine eigene Normale und behält den vollständigen Lichtpfad.
 */
export function kuerzeSonnenlicht(): void {
  const quelle = THREE.ShaderChunk.lights_fragment_begin;
  const licht = 'getDirectionalLightInfo( directionalLight, directLight );';
  const beitrag = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
  const lichtBei = quelle.indexOf(licht);
  const beitragBei = quelle.indexOf(beitrag, lichtBei);
  if (lichtBei < 0 || beitragBei < 0) return;
  const von = lichtBei + licht.length, bis = beitragBei + beitrag.length;
  THREE.ShaderChunk.lights_fragment_begin = quelle.slice(0, von) + `
    #if defined( STANDARD ) && defined( SHADOWMAP_TYPE_PCF ) && ! defined( USE_CLEARCOAT )
    if (dot(geometryNormal, directLight.direction) > 0.0) {
    #endif
    ` + quelle.slice(von, bis) + `
    #if defined( STANDARD ) && defined( SHADOWMAP_TYPE_PCF ) && ! defined( USE_CLEARCOAT )
    }
    #endif
    ` + quelle.slice(bis);
}

/** three r187 liest bei PCF ausschließlich die Tiefentextur. Ein R8-Farbziel
 * neben derselben Tiefe spart bei 4096² rechnerisch 48 MiB gegenüber RGBA8.
 * Die Sonnenkamera übernimmt beim ersten Rendern die Karte samt Lebensdauer.
 */
export function legePcfKarteAn(licht: THREE.DirectionalLight, gl: THREE.WebGLRenderer): void {
  const schatten = licht.shadow;
  if (schatten.map || !gl.shadowMap.enabled || gl.shadowMap.type !== THREE.PCFShadowMap) return;
  const breite = Math.min(schatten.mapSize.x, gl.capabilities.maxTextureSize);
  const hoehe = Math.min(schatten.mapSize.y, gl.capabilities.maxTextureSize);
  const tiefe = new THREE.DepthTexture(breite, hoehe, THREE.UnsignedIntType);
  tiefe.name = licht.name + '.shadowMap';
  tiefe.compareFunction = gl.capabilities.reversedDepthBuffer ? THREE.GreaterEqualCompare : THREE.LessEqualCompare;
  tiefe.minFilter = tiefe.magFilter = THREE.LinearFilter;
  schatten.map = new THREE.WebGLRenderTarget(breite, hoehe, { format: THREE.RedFormat, depthTexture: tiefe });
  schatten.camera.updateProjectionMatrix();
}
