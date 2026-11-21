import * as THREE from 'three';
import { rastereBodenkontakt } from './hofbodenkontakt.js';
import type { Weltdaten } from './osm.js';

const AUSLAUF = 9;
const KONTAKTWEITE = 2.15;
const KONTAKTSCHRITT = .16;

/** Weltrechteck an einer vermessenen Straße, mit einem weichen Übergang am Rand. */
export function baueWiesenbereich(strassenrahmen: THREE.Vector4, kontakt?: WiesenHauskontakt) {
  const rahmen = new THREE.Vector4(strassenrahmen.x - 6, strassenrahmen.y - 6,
    strassenrahmen.x + 1 / strassenrahmen.z + 6, strassenrahmen.y + 1 / strassenrahmen.w + 6);
  const gewicht = (x: number, z: number) => THREE.MathUtils.smoothstep(
    Math.min(x - rahmen.x, z - rahmen.y, rahmen.z - x, rahmen.w - z), 0, AUSLAUF,
  );
  return { rahmen, gewicht, kontakt };
}
export type Wiesenbereich = ReturnType<typeof baueWiesenbereich>;

export function baueWiesenHauskontakt(welt: Weltdaten,
  lod2: readonly (Weltdaten['gebaeude'][number]['lod2'] | null)[],
  nachWelt: (ort: readonly [number, number]) => [number, number],
  hofkarte?: THREE.DataTexture,
) {
  const ringe = welt.gebaeude.flatMap((haus, i) => {
    const koerper = lod2[i]?.koerper;
    if (koerper?.length) return koerper.map(({ grundriss }) => ({
      punkte: grundriss.map(nachWelt), kontakt: true, garage: haus.art === 'garage' || haus.art === 'carport',
    }));
    return haus.punkte.length < 3 ? [] : [{ punkte: haus.punkte.map(nachWelt), kontakt: false, garage: false }];
  });
  const auswahl = ringe.filter(ring => ring.kontakt);
  const aussen = auswahl.flatMap(ring => ring.punkte);
  if (!aussen.length) return undefined;
  const xs = aussen.map(p => p[0]), zs = aussen.map(p => p[1]);
  const rand = KONTAKTWEITE + KONTAKTSCHRITT;
  const x0 = Math.min(...xs) - rand, z0 = Math.min(...zs) - rand;
  const breite = Math.ceil((Math.max(...xs) + rand - x0) / KONTAKTSCHRITT);
  const tiefe = Math.ceil((Math.max(...zs) + rand - z0) / KONTAKTSCHRITT);
  const raster = rastereBodenkontakt(ringe, x0, z0, breite, tiefe, KONTAKTSCHRITT, KONTAKTWEITE);
  const eingaenge = auswahl.flatMap(({ punkte, garage }) => {
    let laenge = 0, x = 0, z = 0, tx = 0, tz = 0;
    for (let i = 0; i < punkte.length; i++) {
      const a = punkte[i], b = punkte[(i + 1) % punkte.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      if (l <= laenge) continue;
      laenge = l; x = (a[0] + b[0]) / 2; z = (a[1] + b[1]) / 2; tx = dx / l; tz = dz / l;
    }
    return laenge < 2.2 ? [] : [{ x, z, tx, tz, halb: garage ? 1.8 : 1.04 }];
  });
  // Das 1-m-Wuchsfeld allein kann den Zugang nicht trennscharf freihalten.
  // Grün im Kontaktatlas enthält deshalb zusätzlich die Trittspur in 16-cm-Abtastung.
  const zugang = new Uint8Array(raster.daten.length);
  for (const e of eingaenge) {
    const reichweite = Math.hypot(e.halb + .35, 2.35);
    const j0 = Math.max(0, Math.floor((e.z - reichweite - z0) / KONTAKTSCHRITT));
    const j1 = Math.min(tiefe, Math.ceil((e.z + reichweite - z0) / KONTAKTSCHRITT));
    const i0 = Math.max(0, Math.floor((e.x - reichweite - x0) / KONTAKTSCHRITT));
    const i1 = Math.min(breite, Math.ceil((e.x + reichweite - x0) / KONTAKTSCHRITT));
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const dx = x0 + (i + .5) * KONTAKTSCHRITT - e.x, dz = z0 + (j + .5) * KONTAKTSCHRITT - e.z;
      const laengs = Math.abs(dx*e.tx + dz*e.tz), quer = Math.abs(dz*e.tx - dx*e.tz);
      const gewicht = (1 - THREE.MathUtils.smoothstep(laengs, e.halb, e.halb + .35))
        * (1 - THREE.MathUtils.smoothstep(quer, 1.65, 2.35));
      const k = j * breite + i;
      zugang[k] = Math.max(zugang[k], Math.round(gewicht * 255));
    }
  }
  const freigabe = (x: number, z: number) => {
    const i = Math.floor((x - x0) / KONTAKTSCHRITT), j = Math.floor((z - z0) / KONTAKTSCHRITT);
    if (i < 0 || j < 0 || i >= breite || j >= tiefe) return false;
    const k = j * breite + i;
    return raster.daten[k] > 0 && zugang[k] < 64;
  };
  const hof = hofkarte?.image;
  const atlasBreite = Math.max(raster.breite, hof?.width ?? 0);
  const atlasTiefe = raster.tiefe + (hof?.height ?? 0);
  const daten = new Uint8Array(atlasBreite * atlasTiefe * 2);
  const hofZeilen = hof?.height ?? 0;
  if (hof) for (let z = 0; z < hof.height; z++) for (let x = 0; x < hof.width; x++) {
    daten[2 * (z * atlasBreite + x)] = (hof.data as Uint8Array)[z * hof.width + x];
  }
  for (let z = 0; z < tiefe; z++) for (let x = 0; x < breite; x++) {
    const i = z * breite + x, k = 2 * ((z + hofZeilen) * atlasBreite + x);
    daten[k] = raster.daten[i];
    daten[k+1] = zugang[i];
  }
  const textur = new THREE.DataTexture(daten, atlasBreite, atlasTiefe, THREE.RGFormat);
  textur.minFilter = textur.magFilter = THREE.LinearFilter;
  textur.needsUpdate = true;
  return {
    textur, rahmen: new THREE.Vector4(...raster.rahmen), freigabe,
    hofTeil: hof ? new THREE.Vector4(0, 0, hof.width / atlasBreite, hof.height / atlasTiefe) : undefined,
    wiesenTeil: new THREE.Vector4(0, hofZeilen / atlasTiefe, raster.breite / atlasBreite, raster.tiefe / atlasTiefe),
  };
}
type WiesenHauskontakt = NonNullable<ReturnType<typeof baueWiesenHauskontakt>>;

export const WIESENBEREICH_GLSL = /* glsl */ `
uniform vec4 uWiesenbereich;
float wiesenbereichGewicht(vec2 ort) {
  vec2 abstand = min(ort - uWiesenbereich.xy, uWiesenbereich.zw - ort);
  return smoothstep(0.0, ${AUSLAUF.toFixed(1)}, min(abstand.x, abstand.y));
}
`;

const KONTAKTATLAS_GLSL = /* glsl */ `
vec2 kontaktAtlas(sampler2D karte, vec2 uv, vec4 teil) {
  vec2 halb = .5 / vec2(textureSize(karte, 0));
  return texture2D(karte, teil.xy + clamp(uv * teil.zw, halb, teil.zw - halb)).rg;
}
`;

export const wiesenKontaktGlsl = (gemeinsam = false) => /* glsl */ `
${gemeinsam ? 'uniform vec4 uHofKontaktTeil;' : 'uniform sampler2D uWiesenKontakt;'}
uniform vec4 uWiesenKontaktRahmen;
uniform vec4 uWiesenKontaktTeil;
${KONTAKTATLAS_GLSL}
vec2 wiesenHauskontakt(vec2 ort) {
  vec2 uv = (ort - uWiesenKontaktRahmen.xy) * uWiesenKontaktRahmen.zw;
  if (any(lessThan(uv,vec2(0))) || any(greaterThan(uv,vec2(1)))) return vec2(0.0);
  return kontaktAtlas(${gemeinsam ? 'uHofKontakt' : 'uWiesenKontakt'}, uv, uWiesenKontaktTeil);
}
`;

/** Durchgehende Vegetationsinseln über beide Shader und sämtliche LOD-Stufen. */
export const WIESENWUCHS_GLSL = /* glsl */ `
float wiesenZufall(vec2 p) {
  p = fract(p * vec2(.3171, .3679));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}
float wiesenRauschen(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f *= f * (3.0 - 2.0 * f);
  return mix(mix(wiesenZufall(i), wiesenZufall(i + vec2(1,0)), f.x),
             mix(wiesenZufall(i + vec2(0,1)), wiesenZufall(i + vec2(1,1)), f.x), f.y);
}
vec2 wiesenWuchs(vec2 p) {
  vec2 lokal = p - uWiesenbereich.xy;
  float stauden = smoothstep(.28,.74, .67*wiesenRauschen(lokal*.32) + .33*wiesenRauschen(lokal*1.43));
  float trocken = smoothstep(.44,.81, .73*wiesenRauschen(lokal*.18+23.0) + .27*wiesenRauschen(lokal*1.71));
  return vec2(stauden, trocken);
}
`;
