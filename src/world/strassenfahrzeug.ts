import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { BAND_RAUSCHEN_GLSL } from './bandmaterial.js';

const KLEINWAGEN = '/bauten/milbinger-kleinwagen.glb';
// Achsmittelpunkte der CC0-Vorlage in Modellmetern, +Z nach vorn.
const VORDERACHSE = 1.22, HINTERACHSE = -1.38, RADHÄLFTE = .77;

interface Parkplatz { x: number; z: number; richtung: number; verfall?: number }
type Bodenhoehe = (x: number, z: number) => number;

/** Neigung und Höhe aus derselben Geländeoberfläche, auf der die vier Reifen stehen. */
export function kleinwagenStand(ort: Parkplatz, boden: Bodenhoehe): THREE.Object3D {
  const stand = new THREE.Object3D();
  const gier = Math.PI - THREE.MathUtils.degToRad(ort.richtung);
  const sin = Math.sin(gier), cos = Math.cos(gier);
  const probe = (x: number, z: number) => boden(ort.x + cos * x + sin * z, ort.z - sin * x + cos * z);
  const vl = probe(RADHÄLFTE, VORDERACHSE), vr = probe(-RADHÄLFTE, VORDERACHSE);
  const hl = probe(RADHÄLFTE, HINTERACHSE), hr = probe(-RADHÄLFTE, HINTERACHSE);
  const gefaelle = ((hl + hr) - (vl + vr)) / (2 * (VORDERACHSE - HINTERACHSE));
  const quer = ((vl + hl) - (vr + hr)) / (4 * RADHÄLFTE);
  const mitte = (vl + vr + hl + hr) / 4 + gefaelle * (VORDERACHSE + HINTERACHSE) / 2;
  stand.position.set(ort.x, mitte - .014, ort.z);
  stand.rotation.set(Math.atan(gefaelle), gier, Math.atan(quer), 'YXZ');
  return stand;
}

const PARKWAGEN_GLSL = /* glsl */ `
  vec3 p = vParkwagen - uParkwagenStand;
  float fleck = bandRauschen(vec2(p.z + p.x * .61, p.y * 2.8) * 6.0);
  float blase = bandRauschen(vec2(p.z + p.x * 1.75, p.y) * 38.0);
  float unten = 1.0 - smoothstep(.28, .82, p.y);
  float schaden = smoothstep(.53, .80, fleck * .68 + blase * .32 + unten * .17) * uParkwagenAlter;
  if (uParkwagenRolle < .5) {
    vec3 stumpf = diffuseColor.rgb * vec3(1.17, 1.10, 1.02);
    vec3 rost = mix(vec3(.099, .042, .018), vec3(.27, .111, .043), blase);
    diffuseColor.rgb = mix(stumpf * (.81 + .21 * fleck), rost, schaden);
  } else if (uParkwagenRolle < 1.5) {
    float lauf = bandRauschen(vec2((p.x * .74 + p.z) * 39.0, p.y * 4.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.158, .145, .107), (.14 + .34 * lauf * fleck) * uParkwagenAlter);
  } else if (uParkwagenRolle < 2.5) {
    float erde = (1.0 - smoothstep(.02, .27, p.y)) * (.34 + .45 * fleck);
    diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 + .20 * blase), vec3(.104, .077, .047), erde * uParkwagenAlter);
  } else {
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.24, .107, .047), schaden * .71);
  }
`;

function verwittereKleinwagen(objekt: THREE.Object3D, stand: THREE.Vector3, alter: number): void {
  const bearbeitet = new Set<THREE.MeshStandardMaterial>();
  objekt.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    o.receiveShadow = true;
    const material = o.material;
    if (!(material instanceof THREE.MeshStandardMaterial)) return;
    o.castShadow = material.name !== 'glas';
    if (bearbeitet.has(material)) return;
    bearbeitet.add(material);
    const rolle = material.name.startsWith('lack') ? 0 : material.name === 'glas' ? 1
      : material.name === 'gummi' ? 2 : material.name === 'metall' ? 3 : -1;
    if (rolle < 0) return;
    material.onBeforeCompile = shader => {
      shader.uniforms.uParkwagenStand = { value: stand };
      shader.uniforms.uParkwagenRolle = { value: rolle };
      shader.uniforms.uParkwagenAlter = { value: alter };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vParkwagen;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvParkwagen = (modelMatrix * vec4(position, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vParkwagen;
uniform vec3 uParkwagenStand;
uniform float uParkwagenRolle;
uniform float uParkwagenAlter;
${BAND_RAUSCHEN_GLSL}`)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + PARKWAGEN_GLSL)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .95, schaden);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - .74 * schaden;');
    };
    material.customProgramCacheKey = () => 'brachland-parkender-kleinwagen';
  });
}

export function ladeKleinwagen(ort: Parkplatz, boden: Bodenhoehe, ziel: THREE.Group): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const stand = kleinwagenStand(ort, boden);
  stand.name = 'Abgestellter Kleinwagen';
  let freigegeben = false;
  let modell: THREE.Group | undefined;
  const entsorge = () => {
    const geos = new Set<THREE.BufferGeometry>(), materialien = new Set<THREE.MeshStandardMaterial>();
    modell?.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      geos.add(o.geometry);
      if (o.material instanceof THREE.MeshStandardMaterial) materialien.add(o.material);
    });
    for (const geo of geos) geo.dispose();
    const texturen = new Set<THREE.Texture>();
    for (const m of materialien) {
      if (m.aoMap) texturen.add(m.aoMap);
      if (m.normalMap) texturen.add(m.normalMap);
      m.dispose();
    }
    for (const t of texturen) {
      if (typeof ImageBitmap !== 'undefined' && t.image instanceof ImageBitmap) t.image.close();
      t.dispose();
    }
  };
  void new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(KLEINWAGEN).then(({ scene }) => {
    modell = scene;
    if (freigegeben) { entsorge(); return; }
    verwittereKleinwagen(modell, stand.position, ort.verfall ?? .9);
    stand.add(modell);
    ziel.add(stand);
  }).catch((fehler: unknown) => { if (!freigegeben) console.warn('Kleinwagen konnte nicht geladen werden.', fehler); });
  return () => { freigegeben = true; stand.removeFromParent(); entsorge(); };
}
