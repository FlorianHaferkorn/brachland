/** D298: Originale Scan-Albedo und Materialkanäle der begrenzten Hofprobe. */
import * as THREE from 'three';
import { HOF_BODEN_AN, HOF_ZIELTREUE_AN } from './echt.js';
import { HOF_ZUGANG_PARS } from './hofboden.js';
import { HOF_UNIFORM, HOF_PARS } from './hofplatz.js';

const texturen = new Map<string, THREE.Texture>();
export function hofTextur(name: string, farbe = false): THREE.Texture {
  const pfad = `/material/hof-${name}.webp`;
  let t = texturen.get(pfad);
  if (!t) {
    t = new THREE.TextureLoader().load(pfad);
    t.colorSpace = farbe ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = /^(boden|kies)-/.test(name) ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.anisotropy = 8;
    if (/^(fels-|farn-|gras-)/.test(name)) t.flipY = false;
    texturen.set(pfad, t);
  }
  return t;
}

export function hofUniforms() {
  return { uHofMitte: HOF_UNIFORM.mitte, uHofAchse: HOF_UNIFORM.achse,
    uHofHalb: HOF_UNIFORM.halb, uHofBereit: HOF_UNIFORM.bereit,
    uHofZugaenge: HOF_UNIFORM.zugaenge, uHofZugangZahl: HOF_UNIFORM.zugangZahl,
    uHofKontakt: HOF_UNIFORM.kontakt, uHofKontaktRahmen: HOF_UNIFORM.kontaktRahmen };
}

export const HOF_HAUS_PARS = /* glsl */ `
${HOF_PARS}
uniform sampler2D uHofFarbe, uHofNormal, uHofArm;
uniform vec4 uHofMeter;
vec2 hofScanP;
vec3 hofT, hofB, hofN;
float hofHausAnteil;
vec3 hofArm;
vec4 hofLies(sampler2D t, vec2 p, float r) {
  vec2 off = vec2(mod(r, 2.0), 1.0 - floor(r / 2.0)) * 0.5;
  // Acht umgelegte Randpixel schützen den Atlas vor Nachbarkacheln in den Mips.
  return textureGrad(t, off + (fract(p) * (1008.0/1024.0) + 8.0/1024.0) * 0.5,
    dFdx(p) * (504.0/1024.0), dFdy(p) * (504.0/1024.0));
}
`;

export const HOF_HAUS_FARBE = /* glsl */ `
  hofHausAnteil = uHofBereit * (1.0 - smoothstep(38.0, 48.0, distance(vHausPos.xz, uHofMitte)));
  hofArm = vec3(1.0, 0.9, 0.0);
  if (scanR < 3.5 && hofHausAnteil > 0.0) {
    float hm = scanR < 0.5 ? uHofMeter.x : scanR < 1.5 ? uHofMeter.y : scanR < 2.5 ? uHofMeter.z : uHofMeter.w;
    // Die Flächennormale aus den Vertices bleibt über das ganze Brett konstant.
    // Eine aus Fragmentableitungen rekonstruierte Basis verstärkt bei Welt-x≈1400 Rundungsfehler.
    hofN = normalize(vHausNormal);
    hofT = abs(hofN.y) > 0.97 ? vec3(1,0,0) : normalize(cross(vec3(0,1,0), hofN));
    hofB = cross(hofN, hofT);
    vec3 lokalP = vHausPos - vec3(uHofMitte.x, 0.0, uHofMitte.y);
    hofScanP = vec2(dot(lokalP, hofT), dot(lokalP, hofB)) / hm;
    vec3 albedo = hofLies(uHofFarbe, hofScanP, scanR).rgb;
    ${HOF_BODEN_AN ? `// Horizontale Trittsteine sind einzelne Platten, kein aufgedrucktes Bruchsteinmauerwerk.
    if (scanR > 2.5 && hofN.y > 0.7) {
      float korn = sin(vHausPos.x * 3.1 + vHausPos.z * 0.7) * sin(vHausPos.z * 4.3);
      albedo = vec3(0.15, 0.145, 0.13) * (1.0 + korn * 0.08);
    }` : ''}
    hofArm = hofLies(uHofArm, hofScanP, scanR).rgb;
    // Originalfarben ersetzen die mehrfach modulierte Palette. Nur der Sockelkontakt bleibt.
    float kontakt = mix(0.72, 1.0, smoothstep(0.0, 0.9, vZustand.y));
    diffuseColor.rgb = mix(diffuseColor.rgb, albedo * kontakt, hofHausAnteil);
  }
`;

export const HOF_HAUS_NORMAL = /* glsl */ `
  if (scanR < 3.5 && hofHausAnteil > 0.0) {
    vec3 hn = hofLies(uHofNormal, hofScanP, scanR).xyz * 2.0 - 1.0;
    hn.xy *= ${HOF_BODEN_AN ? '(scanR > 2.5 && hofN.y > 0.7) ? 0.12 : 0.65' : '0.65'};
    vec3 hnW = normalize(hofT * hn.x + hofB * hn.y + hofN * hn.z);
    normal = normalize(mix(normal, (viewMatrix * vec4(hnW, 0.0)).xyz, hofHausAnteil));
  }
`;

export const HOF_BODEN_PARS = /* glsl */ `
${HOF_PARS}
${HOF_BODEN_AN ? HOF_ZUGANG_PARS + '\nuniform sampler2D uHofKontakt;\nuniform vec4 uHofKontaktRahmen;' : ''}
${HOF_ZIELTREUE_AN ? 'uniform vec4 uHofZielVorfeld;\nuniform vec2 uHofZielHalb;' : ''}
uniform sampler2D uHofBodenFarbe, uHofBodenNormal, uHofBodenArm;
uniform float uHofBodenMeter;
float hofBodenAnteil;
vec2 hofBodenUv;
vec3 hofBodenArm;
`;
export const HOF_BODEN_FARBE = /* glsl */ `
  hofBodenAnteil = hofDeckung(vWeltPos.xz);
  hofBodenUv = vWeltPos.xz / uHofBodenMeter;
  hofBodenArm = vec3(1.0, 0.9, 0.0);
  ${HOF_BODEN_AN ? `
  float hofLokal = uHofBereit * (1.0 - smoothstep(38.0, 43.0, distance(vWeltPos.xz, uHofMitte)));
  if (hofLokal > 0.0) {
    float zugang = hofZugang(vWeltPos.xz);
    float streu = smoothstep(0.28, 0.72, bodenRauschen((vWeltPos.xz - uHofMitte) * 0.53));
    vec2 kontaktUv = (vWeltPos.xz - uHofKontaktRahmen.xy) * uHofKontaktRahmen.zw;
    // Die Kontaktkarte hat keine Mips: ihr Abtasten braucht keine Fragmentableitungen.
    float kontakt = texture2D(uHofKontakt, kontaktUv).r;
    float kontaktStreu = kontakt * mix(0.5, 0.9, streu);
    float erdRand = hofBodenAnteil * (1.0 - hofBodenAnteil) * 2.5;
    vec3 erde = vec3(0.095, 0.065, 0.035) * (sWiese.rgb * 1.4 + 0.3);
    diffuseColor.rgb = mix(diffuseColor.rgb, erde, hofLokal * clamp(erdRand + kontaktStreu + zugang * 0.9, 0.0, 0.95));
    hofBodenAnteil *= mix(0.30, 0.92, streu) * (1.0 - max(zugang * 0.88, kontaktStreu));
  }
  ` : ''}
  ${HOF_ZIELTREUE_AN ? `
  vec2 zielDelta = vWeltPos.xz - uHofZielVorfeld.xy;
  if (uHofZielHalb.x > 0.0 && dot(zielDelta, zielDelta) < 182.25) {
    vec2 n = uHofZielVorfeld.zw;
    vec2 q = vec2(dot(zielDelta, vec2(n.y, -n.x)), dot(zielDelta, n));
    vec2 rand = abs(q) - uHofZielHalb;
    float innen = max(rand.x, rand.y);
    float abstand = length(max(rand, 0.0));
    float fleck = bodenRauschen(q * 0.76) * 0.67 + bodenRauschen(q * 2.43 + 2.0) * 0.33;
    // Erdiger Sockelsaum mit ungleichmäßig auslaufendem Kies auf Eingang- und Zaunseite.
    float sicht = smoothstep(-uHofZielHalb.x + 0.30, -uHofZielHalb.x + 1.2, q.x);
    float breite = 1.16 + 1.95 * smoothstep(0.0, uHofZielHalb.y, q.y);
    float saum = sicht * smoothstep(-0.12, 0.03, innen)
      * (1.0 - smoothstep(breite * 0.45, breite, abstand + (fleck - 0.49) * 1.12));
    vec3 feuchteErde = vec3(0.094, 0.073, 0.05) * (0.71 + sWiese.rgb * 0.83);
    diffuseColor.rgb = mix(diffuseColor.rgb, feuchteErde, saum * 0.76);
    hofBodenAnteil = max(hofBodenAnteil, saum * smoothstep(0.18, 0.74, fleck) * 0.72);
  }
  ` : ''}
  // Ableitungen vor der Ortsverzweigung halten die Mipwahl an den Maskenrändern stabil.
  vec2 hofDx = dFdx(hofBodenUv), hofDy = dFdy(hofBodenUv);
  if (hofBodenAnteil > 0.0) {
    vec3 kies = ${HOF_BODEN_AN ? 'textureGrad(uHofBodenFarbe, hofBodenUv, hofDx, hofDy)' : 'texture2D(uHofBodenFarbe, hofBodenUv)'}.rgb;
    hofBodenArm = ${HOF_BODEN_AN ? 'textureGrad(uHofBodenArm, hofBodenUv, hofDx, hofDy)' : 'texture2D(uHofBodenArm, hofBodenUv)'}.rgb;
    diffuseColor.rgb = mix(diffuseColor.rgb, kies, hofBodenAnteil);
  }
`;

/** Nach dem normalen Map-Pass: lokale Originalalbedo, die bestehende Alphamaske bleibt erhalten. */
export function richteHofPropEin(material: THREE.MeshStandardMaterial, textur: string): void {
  material.userData.hofProbe = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, hofUniforms(), {
      uHofPropFarbe: { value: hofTextur(`${textur}-farbe`, true) },
      uHofPropArm: { value: hofTextur(`${textur}-arm`) },
    });
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHofPropPos;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 hp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          hp = instanceMatrix * hp;
        #endif
        vHofPropPos = (modelMatrix * hp).xyz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      ${HOF_PARS}
      uniform sampler2D uHofPropFarbe, uHofPropArm;
      varying vec3 vHofPropPos;
      float hofPropAnteil;
      vec3 hofPropArm;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        hofPropAnteil = uHofBereit * (1.0 - smoothstep(38.0, 48.0, distance(vHofPropPos.xz, uHofMitte)));
        hofPropArm = texture2D(uHofPropArm, vMapUv).rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(uHofPropFarbe, vMapUv).rgb, hofPropAnteil);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, clamp(hofPropArm.g, 0.55, 1.0), hofPropAnteil);`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        reflectedLight.indirectDiffuse *= mix(1.0, hofPropArm.r, hofPropAnteil * 0.5);`);
  };
  material.customProgramCacheKey = () => `hof-prop-${textur}`;
}
export const HOF_BODEN_NORMAL = /* glsl */ `
  if (hofBodenAnteil > 0.0) {
    vec3 hn = ${HOF_BODEN_AN ? 'textureGrad(uHofBodenNormal, hofBodenUv, hofDx, hofDy)' : 'texture2D(uHofBodenNormal, hofBodenUv)'}.xyz * 2.0 - 1.0;
    hn.xy *= 0.65;
    vec3 hw = scanAufWelt(hn, normalize(vWeltNormal));
    normal = normalize(mix(normal, (viewMatrix * vec4(hw, 0.0)).xyz, hofBodenAnteil));
  }
`;
