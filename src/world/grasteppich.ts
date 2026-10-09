/**
 * BRACHLAND — Grasteppich: Einzelhalme im Nahbereich, auf der GPU (D211, ADR-0012)
 *
 * Die Streuschicht (`streuung.ts`) stellt Büschel, die Props stellen Horste. Dazwischen lag der
 * nackte Boden — auf einer Wiese ist das der grösste Abstand zu Soulframe und Elden Ring: Dort steht
 * die Fläche voller Halme, und der Wind läuft als Welle darüber.
 *
 * Bauart, damit es auf dem M1 trägt (ADR-0006):
 * - **Ein** Aufruf. Eine `InstancedBufferGeometry` mit einem Halm (7 Ecken, 5 Dreiecke) und je
 *   Instanz nur der Zellversatz im Halmraster. Lage, Höhe, Drehung, Farbe und Wind rechnet der
 *   Vertex-Shader aus der **Weltzelle** — derselbe Fleck trägt bei jedem Besuch dieselben Halme,
 *   und beim Nachziehen springt nichts (das Raster rastet auf ganze Zellen ein).
 * - Boden und Dichte kommen aus einer kleinen Feldtextur (1 m, `FELD_TEXEL`²), die die CPU beim
 *   Gehen neu füllt: Höhe aus `feld.hoehe`, Dichte aus Biom, Wasser, Hang, Weg und Freihaltung der
 *   Bauwerke. Rund 3.000 Abfragen je Nachziehen statt 60.000 Matrizen.
 * - Zum Rand des Rings werden die Halme kleiner statt zu verschwinden; dahinter übernehmen
 *   Streuschicht und Grasbüschel-Props.
 */
import * as THREE from 'three';
import { gesperrt } from './bauwerke.js';
import { PALETTE } from './palette.js';
import type { Biom } from './osm.js';
import type { HoehenFeld } from './lod.js';

/** Halbe Kantenlänge des Halmfelds in Metern. */
export const TEPPICH_HALB = 30;
/** Halmzelle in Metern bei voller Qualität — ein Halm je Zelle, also 25 je m². */
export const TEPPICH_ZELLE = 0.2;
/** Ab dieser Bewegung wird die Feldtextur neu gefüllt. */
export const TEPPICH_NACHZIEHEN = 4;
/** Texel der Feldtextur je Kante (1 m), mit Rand über das Halmfeld hinaus. */
const FELD_TEXEL = 2 * TEPPICH_HALB + 8;

/** Wie dicht Gras je Biom steht (0…1). Wald trägt Moos und Farn, kein Rasen. */
const DICHTE: Record<Biom, number> = {
  wiese: 1.0, gebuesch: 0.75, wald: 0.22, acker: 0.45, ruine: 0.55,
  siedlung: 0.4, industrie: 0.25, fels: 0.12, unbekannt: 0.35, wasser: 0,
};
/** Halmhöhe je Biom in Metern (Mittel); ungemähte Wiese steht höher als Hof und Waldrand. */
const HOEHE: Record<Biom, number> = {
  wiese: 0.55, gebuesch: 0.5, wald: 0.3, acker: 0.4, ruine: 0.45,
  siedlung: 0.25, industrie: 0.3, fels: 0.2, unbekannt: 0.35, wasser: 0,
};

/** Ein Halm: drei Viereckstufen und eine Spitze, x in Halbbreiten, y von 0 bis 1. */
function baueHalm(): THREE.BufferGeometry {
  const ys = [0, 0.3, 0.62];
  const pos: number[] = [];
  for (const y of ys) { const b = 1 - y * 0.75; pos.push(-b, y, 0, b, y, 0); }
  pos.push(0, 1, 0);
  const idx = [0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 6];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export interface Grasteppich {
  mesh: THREE.Mesh;
  /** Je Bild: Zeit und Kamera für Wind und Randausblendung. */
  setzeZeit(t: number): void;
  /** Feld um (mx, mz) neu füllen, wenn weit genug gegangen. Gibt true zurück, wenn gefüllt. */
  ziehNach(mx: number, mz: number): boolean;
  dispose(): void;
}

/**
 * Grasteppich bauen. `faktor` ist die Qualitätsstufe (`Qualitaet.gras`): Bei 0,5 ist die Zelle
 * √2-mal so gross, also halb so viele Halme.
 */
export function baueGrasteppich(
  feld: HoehenFeld, aufWeg: (x: number, z: number) => boolean, faktor = 1,
): Grasteppich {
  const zelle = TEPPICH_ZELLE / Math.sqrt(Math.max(0.1, faktor));
  const n = Math.ceil((2 * TEPPICH_HALB) / zelle);
  const halm = baueHalm();
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = halm.index;
  geo.setAttribute('position', halm.getAttribute('position'));
  const versatz = new Float32Array(n * n * 2);
  for (let i = 0, k = 0; i < n; i++) for (let j = 0; j < n; j++) { versatz[k++] = j - n / 2; versatz[k++] = i - n / 2; }
  geo.setAttribute('aZelle', new THREE.InstancedBufferAttribute(versatz, 2));
  geo.instanceCount = n * n;

  const daten = new Float32Array(FELD_TEXEL * FELD_TEXEL * 4);
  const feldTextur = new THREE.DataTexture(daten, FELD_TEXEL, FELD_TEXEL, THREE.RGBAFormat, THREE.FloatType);
  feldTextur.magFilter = feldTextur.minFilter = THREE.NearestFilter;
  feldTextur.needsUpdate = true;
  // Bodenfarbe am selben Ort (linear): Der Halm wächst aus ihr heraus und geht zum Rand des Rings
  // ganz in sie über — sonst endet der Teppich als Kante (erster Render, Wiese 08.10.2026).
  const ton = new Float32Array(FELD_TEXEL * FELD_TEXEL * 4);
  const tonTextur = new THREE.DataTexture(ton, FELD_TEXEL, FELD_TEXEL, THREE.RGBAFormat, THREE.FloatType);
  tonTextur.magFilter = tonTextur.minFilter = THREE.NearestFilter;
  tonTextur.needsUpdate = true;
  const farbe = new THREE.Color();

  const uniforms = {
    uZeit: { value: 0 },
    uFeld: { value: feldTextur },
    uTon: { value: tonTextur },
    /** Weltlage von Texel (0,0) und 1/Texelzahl. */
    uFeldUrsprung: { value: new THREE.Vector3(0, 0, 1 / FELD_TEXEL) },
    /** Halmraster: Mitte in ganzen Zellen, Zellgrösse in Metern. */
    uRaster: { value: new THREE.Vector3(0, 0, zelle) },
    uMitte: { value: new THREE.Vector2() },
    uFuss: { value: new THREE.Color(PALETTE.streu.grasFuss) },
    uSpitze: { value: new THREE.Color(PALETTE.streu.grasSpitze) },
  };

  const material = new THREE.MeshStandardMaterial({
    vertexColors: false, roughness: 0.85, metalness: 0, side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aZelle;
uniform float uZeit;
uniform sampler2D uFeld;
uniform sampler2D uTon;
uniform vec3 uFeldUrsprung;
uniform vec3 uRaster;
uniform vec2 uMitte;
uniform vec3 uFuss;
uniform vec3 uSpitze;
varying vec3 vHalmFarbe;
float halmHash(vec2 p) { p = mod(p, 4096.0); return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float halmRauschen(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(halmHash(i), halmHash(i + vec2(1.0, 0.0)), f.x),
             mix(halmHash(i + vec2(0.0, 1.0)), halmHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// Bilinear von Hand: Float-Texturen filtern nicht überall linear.
vec4 bilinear(sampler2D tex, vec2 welt) {
  vec2 t = (welt - uFeldUrsprung.xy) - 0.5;
  vec2 i = floor(t), f = t - i;
  float s = uFeldUrsprung.z;
  vec4 a = texture2D(tex, (i + vec2(0.5, 0.5)) * s), b = texture2D(tex, (i + vec2(1.5, 0.5)) * s);
  vec4 c = texture2D(tex, (i + vec2(0.5, 1.5)) * s), d = texture2D(tex, (i + vec2(1.5, 1.5)) * s);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}`)
      .replace('#include <beginnormal_vertex>', `
  vec2 zelleW = uRaster.xy + aZelle;
  float h1 = halmHash(zelleW), h2 = halmHash(zelleW + 17.3), h3 = halmHash(zelleW + 41.9);
  float h4 = halmHash(zelleW + 73.1), h5 = halmHash(zelleW + 97.7);
  vec2 ort = (zelleW + vec2(h1, h2)) * uRaster.z;
  vec4 boden = bilinear(uFeld, ort);
  vec3 bodenTon = bilinear(uTon, ort).rgb;
  float abst = distance(ort, uMitte);
  float rand = 1.0 - smoothstep(${(TEPPICH_HALB * 0.45).toFixed(1)}, ${(TEPPICH_HALB * 0.98).toFixed(1)}, abst);
  // Dichte als Schwelle: stabil am Ort, kein Flackern beim Nachziehen.
  float da = step(h3, boden.g) * rand;
  float hoehe = boden.b * (0.55 + h4 * 0.9) * da;
  float breite = 0.012 + h5 * 0.012;
  float winkel = h1 * 6.2832;
  vec2 quer = vec2(cos(winkel), sin(winkel));
  vec2 vor = vec2(-quer.y, quer.x);
  // Wind: eine Welle, die über das Feld läuft, plus Böen aus Rauschen, plus Eigenzittern.
  vec2 windRichtung = normalize(vec2(0.8, 0.6));
  float welle = sin(dot(ort, windRichtung) * 0.35 - uZeit * 1.6) * 0.5 + 0.5;
  float boe = halmRauschen(ort * 0.05 - windRichtung * uZeit * 0.4);
  float zittern = sin(uZeit * 3.1 + h2 * 20.0) * 0.08;
  float neigung = 0.18 + h3 * 0.35;
  float y = position.y;
  vec2 biege = vor * neigung * y * y + windRichtung * (welle * 0.35 + boe * 0.45 + zittern) * y * y;
  vec3 halmPos = vec3(ort.x + quer.x * position.x * breite + biege.x * hoehe,
                      boden.r + y * hoehe * (1.0 - 0.25 * length(biege)),
                      ort.y + quer.y * position.x * breite + biege.y * hoehe);
  // Farbe: aus dem Boden heraus, zur Spitze grüner und heller; trockene Flecken (Rauschen 30 m)
  // gehen ins Strohfarbene. Zum Ringrand hin ganz Bodenfarbe — der Übergang hat keine Kante.
  float trocken = smoothstep(0.55, 0.85, halmRauschen(ort * 0.033 + 5.0)) * 0.7 + h4 * 0.15;
  vec3 gruen = mix(bodenTon, uSpitze, 0.55);
  vec3 spitze = mix(gruen, vec3(0.62, 0.55, 0.34), trocken) * (0.9 + h5 * 0.25);
  vec3 fuss = bodenTon * 0.8;
  float zumBoden = smoothstep(${(TEPPICH_HALB * 0.3).toFixed(1)}, ${(TEPPICH_HALB * 0.9).toFixed(1)}, abst);
  vHalmFarbe = mix(mix(fuss, spitze, smoothstep(0.0, 1.0, y)), bodenTon, zumBoden);
  vec3 objectNormal = normalize(mix(vec3(vor.x, 0.0, vor.y), vec3(0.0, 1.0, 0.0), 0.82));
  #ifdef USE_TANGENT
    vec3 objectTangent = vec3(1.0, 0.0, 0.0);
  #endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = halmPos;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHalmFarbe;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = vHalmFarbe;')
      // Beide Seiten mit derselben (nach oben gekippten) Normale: three dreht sie für die
      // Rückseite um, dann zeigte sie in den Boden und der halbe Rasen wäre schwarz.
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);');
  };
  material.customProgramCacheKey = () => 'brachland-grasteppich-v2';

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'Grasteppich';

  const letzte = new THREE.Vector2(NaN, NaN);
  function ziehNach(mx: number, mz: number): boolean {
    uniforms.uMitte.value.set(mx, mz);
    if (Math.hypot(mx - letzte.x, mz - letzte.y) < TEPPICH_NACHZIEHEN) return false;
    letzte.set(mx, mz);
    const x0 = Math.floor(mx) - FELD_TEXEL / 2, z0 = Math.floor(mz) - FELD_TEXEL / 2;
    for (let i = 0; i < FELD_TEXEL; i++)
      for (let j = 0; j < FELD_TEXEL; j++) {
        const x = x0 + j + 0.5, z = z0 + i + 0.5, k = (i * FELD_TEXEL + j) * 4;
        const h = feld.hoehe(x, z);
        const biom = feld.biom(x, z);
        let d = DICHTE[biom] ?? 0;
        if (d > 0 && (feld.wasserTiefe(x, z) > 0.02 || gesperrt(x, z, 'streu') || aufWeg(x, z))) d = 0;
        if (d > 0) {
          // Hang: ab ~40° kein Halt mehr (wie die Grasbüschel-Props).
          const gx = feld.hoehe(x + 0.5, z) - feld.hoehe(x - 0.5, z);
          const gz = feld.hoehe(x, z + 0.5) - feld.hoehe(x, z - 0.5);
          d *= 1 - THREE.MathUtils.smoothstep(Math.hypot(gx, gz), 0.6, 0.9);
        }
        daten[k] = h; daten[k + 1] = d; daten[k + 2] = HOEHE[biom] ?? 0; daten[k + 3] = 1;
        feld.bodenfarbe(x, z, farbe);
        ton[k] = farbe.r; ton[k + 1] = farbe.g; ton[k + 2] = farbe.b; ton[k + 3] = 1;
      }
    uniforms.uFeldUrsprung.value.set(x0, z0, 1 / FELD_TEXEL);
    uniforms.uRaster.value.set(Math.round(mx / zelle), Math.round(mz / zelle), zelle);
    feldTextur.needsUpdate = true;
    tonTextur.needsUpdate = true;
    return true;
  }

  return {
    mesh,
    setzeZeit: (t) => { uniforms.uZeit.value = t; },
    ziehNach,
    dispose: () => { geo.dispose(); halm.dispose(); material.dispose(); feldTextur.dispose(); tonTextur.dispose(); },
  };
}
