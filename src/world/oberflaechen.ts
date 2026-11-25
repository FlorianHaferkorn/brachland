import type * as THREE from 'three';

/** Ort und Höhenwirkung in Metern, mit Ausblendung unterhalb eines Bildpixels. */
export const OBERFLAECHEN_GLSL = /* glsl */ `
float substratHash(vec2 zelle) {
  vec3 p = fract(vec3(mod(zelle, 4096.0).xyx) * .1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float substratRauschen(vec2 ort) {
  vec2 i = floor(ort), f = fract(ort);
  f = f*f*(3.0 - 2.0*f);
  return mix(mix(substratHash(i),substratHash(i+vec2(1,0)),f.x),
             mix(substratHash(i+vec2(0,1)),substratHash(i+vec2(1,1)),f.x),f.y);
}

float substratDetail(float pixel, float dichte) {
  return 1.0 - smoothstep(.26, .78, pixel*dichte);
}

float substratKorn(vec2 ort, float pixel, float dichte) {
  return mix(.5, substratRauschen(ort*dichte), substratDetail(pixel, dichte));
}

float substratKiesel(vec2 ort, float pixel, float dichte) {
  vec2 feld = ort*dichte;
  vec2 zelle = floor(feld);
  float saat = substratHash(zelle);
  vec2 lokal = fract(feld);
  vec2 mitte = .5 + (vec2(substratHash(zelle + 12.0),substratHash(zelle + 27.0))-.5)*.66;
  vec2 form = mix(vec2(4.9,3.1),vec2(2.9,5.1),saat) / (.54 + .64*substratHash(zelle + 71.0));
  vec2 bruch = (lokal - mitte)*form;
  float abstand = min(min(lokal.x,1.0-lokal.x),min(lokal.y,1.0-lokal.y));
  float stein = max(0.0,1.0-dot(bruch,bruch)) * smoothstep(0.0,.10,abstand) * (.39 + .61*saat);
  return stein * substratDetail(pixel, dichte);
}

vec2 substratSand(vec2 ort, float pixel) {
  float korn = substratKorn(ort, pixel, 118.0);
  float lagerung = substratRauschen(ort*2.1);
  float feineRippe = sin(24.0*ort.x + 49.0*ort.y + 4.0*substratRauschen(ort*6.4));
  float weiteRippe = sin(6.0*ort.x + 14.0*ort.y + 3.1*lagerung);
  float rippe = .5 + .5*feineRippe*substratDetail(pixel,9.0)*smoothstep(.31,.79,lagerung);
  return vec2(.0026*(korn-.5) + .0016*(rippe-.5) + .0014*weiteRippe,
    .71 + .26*korn + .09*rippe + .24*lagerung);
}

// Höhenableitung auf der im Raster tatsächlich sichtbaren Fläche (in Szenenmetern).
vec3 substratNormale(vec3 norm, vec3 blick, float hoehe, float seite) {
  vec3 dx = dFdx(-blick), dy = dFdy(-blick);
  vec3 seitX = cross(dy, norm), seitY = cross(norm, dx);
  float det = dot(dx, seitX)*seite;
  vec3 gradient = sign(det)*(dFdx(hoehe)*seitX + dFdy(hoehe)*seitY);
  return normalize(max(abs(det), 1e-8)*norm - gradient);
}
`;

/** Sandmaterial für schmale Sandablagerungen und offene Gartenflächen. */
export function verfeinereSandMaterial(material: THREE.MeshStandardMaterial): void {
  const davor = material.onBeforeCompile;
  const schluessel = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    davor.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSandOrt;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSandOrt = (modelMatrix * vec4(transformed,1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSandOrt;\n' + OBERFLAECHEN_GLSL)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
      float sandPixel = max(length(dFdx(vSandOrt)), length(dFdy(vSandOrt)));
      vec2 sand = substratSand(vSandOrt, sandPixel);
      float sandFeuchte = smoothstep(.27,.74,.61*substratRauschen(vSandOrt*1.48)
        + .39*substratKorn(vSandOrt,sandPixel,8.3));
      diffuseColor.rgb *= sand.y * mix(vec3(1.0),vec3(.56,.47,.36),sandFeuchte*.71);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(.94,.84,sandFeuchte);')
      .replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
      normal = substratNormale(normal, vViewPosition, sand.x*(1.0-.31*sandFeuchte), faceDirection);`);
  };
  material.customProgramCacheKey = () => schluessel + '-sand-millimeter';
  material.needsUpdate = true;
}
