/**
 * BRACHLAND — Physikalischer Himmel auf der Kugel (D368, `?himmel=physik`)
 *
 * Gegenstück zu `himmel.ts`, gleiche Kugel, gleiche Einbindung (an der Kamera, ferne Ebene, Tone
 * Mapping im Shader). Die Farbe kommt nicht aus vier gemalten Rollen, sondern aus der
 * Himmelsansicht von `atmosphaere.ts` (Hillaire 2020): **ein** Texturzugriff je Pixel.
 *
 * Darauf:
 * - **Sonnenscheibe** in echter Grösse (0,27°), mit dem Durchlass der Luft gefärbt und gedimmt.
 * - **Wolkenschicht**: eine waagerechte Ebene in `wolkenHoehe`, FBM wie D203, Bedeckung `wolken`
 *   der Stimmung. Beleuchtet vom Sonnenlicht *in Wolkenhöhe* (Durchlass-Tabelle) mit
 *   Henyey-Greenstein-Phase und zwei Proben Selbstschatten zur Sonne, aufgehellt vom Himmelslicht
 *   der Kuppel; zwischen Kamera und Wolke liegt die Luft (Luftperspektive: Durchlass e^−τ, der Rest
 *   ist Himmel). Nahe am Horizont verschwinden Wolken deshalb im Dunst, ohne eigene Regel.
 * - **Dunstband**: die Bodendunstschicht (`dunstTiefe`), durch die man flach blickt, in der
 *   Horizontfarbe des Himmels — derselben, auf die `koppleStimmung` den Dunst des Fernlands setzt.
 *   Darum schliesst das Fernland ohne Kante an. (Der Verlaufshimmel legt das Band in die dunklere
 *   Nebelfarbe; am Abend stand so ein dunkles Band zwischen hellem Fernland und Himmel, Bild D368.)
 *
 * Kosten je Bild: ein Texturzugriff und, nur wo Himmel über dem Horizont steht, drei Dichteproben
 * à sechs Rauschwerte (Wolke + zwei Schattenproben, nur in Wolken) gegen zehn der alten Kugel; 320
 * Dreiecke. Die Tabellen entstehen je Stimmung auf der CPU (`atmosphaere.ts`, 60–80 ms), nie je Bild.
 */
import * as THREE from 'three';
import { ANSICHT_B, ANSICHT_H, himmelZuFarben, type PhysikHimmel } from './atmosphaere.js';
import type { HimmelWerte } from './himmel.js';

const VERTEX = /* glsl */ `
varying vec3 vRichtung;
void main() {
  vRichtung = normalize(position);
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uAnsicht;
uniform vec3 uSonne;
uniform vec3 uScheibe;
uniform vec3 uDunst;
uniform float uDunstTiefe;
uniform float uWolken;
uniform float uWolkenHoehe;
uniform vec3 uWolkenSonne;
uniform vec3 uWolkenUmfeld;
uniform vec3 uTauWolke;
uniform float uZeit;
varying vec3 vRichtung;

#define PI 3.14159265
const float SB = ${ANSICHT_B}.0, SH = ${ANSICHT_H}.0;

vec3 himmelAus(vec3 r) {
  float e = asin(clamp(r.y, -1.0, 1.0));
  float v = 0.5 + 0.5 * sign(e) * sqrt(abs(e) / (0.5 * PI));
  vec2 a = normalize(r.xz + vec2(1e-6, 0.0)), b = normalize(uSonne.xz + vec2(1e-6, 0.0));
  float phi = acos(clamp(dot(a, b), -1.0, 1.0));
  vec2 uv = vec2((phi / PI * (SB - 1.0) + 0.5) / SB, (v * (SH - 1.0) + 0.5) / SH);
  return texture2D(uAnsicht, uv).rgb;
}

float himmelHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float himmelRauschen(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(himmelHash(i), himmelHash(i + vec2(1.0, 0.0)), f.x),
             mix(himmelHash(i + vec2(0.0, 1.0)), himmelHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float himmelFbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int k = 0; k < 5; k++) { s += a * himmelRauschen(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; }
  return s;
}
float wolkenDichte(vec2 p) {
  float n = himmelFbm(p) + 0.25 * himmelRauschen(p * 3.1 + 7.0) - 0.125;
  return smoothstep(1.0 - uWolken, 1.0 - uWolken + 0.32, n);
}
// Henyey-Greenstein, auf isotrop = 1 normiert.
float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5); }

void main() {
  vec3 r = normalize(vRichtung);
  vec3 s = normalize(uSonne);
  vec3 farbe = himmelAus(r);
  float c = dot(r, s);

  // Sonnenscheibe, 0,27° Radius, leichte Randverdunkelung.
  float scheibe = smoothstep(0.999986, 0.999990, c);
  float deckung = 0.0;

  if (r.y > 0.0 && uWolken > 0.0) {
    float hoch = max(r.y, 0.03);
    // Treffpunkt mit der Wolkenebene in Metern, Muster etwa 3 km gross, zieht langsam.
    vec2 p = r.xz * (uWolkenHoehe / hoch) / 3000.0 + vec2(uZeit * 0.0035, uZeit * 0.0012);
    float dichte = wolkenDichte(p);
    if (dichte > 0.002) {
      vec2 zurSonne = normalize(s.xz + vec2(1e-5, 0.0)) * 0.12 / max(s.y, 0.15);
      float tauSonne = (dichte + wolkenDichte(p + zurSonne) + wolkenDichte(p + 2.0 * zurSonne)) * 0.7;
      float phase = mix(hg(c, 0.6), hg(c, -0.25), 0.35);
      // Einfachstreuung zur Sonne plus breiter Mehrfachanteil (weiche Beer-Kurve), Albedo 0,9.
      vec3 sonnig = uWolkenSonne / PI * 0.9 * phase * (exp(-tauSonne) + 0.35 * exp(-tauSonne * 0.25));
      vec3 umfeld = uWolkenUmfeld * (1.05 - 0.5 * dichte);
      vec3 wolke = sonnig + umfeld;
      // Luft zwischen Kamera und Wolke: Durchlass, der Rest bleibt Himmel.
      vec3 T = exp(-uTauWolke / hoch);
      deckung = dichte * smoothstep(0.0, 0.06, r.y);
      farbe = mix(farbe, wolke * T + farbe * (1.0 - T), deckung);
    }
  }

  farbe += uScheibe * scheibe * (1.0 - deckung);

  // Bodendunst: Weg durch die Schicht wächst mit 1/sin(Höhe). Unter dem Horizont voll Dunst.
  float tau = r.y > 0.0 ? uDunstTiefe / max(r.y, 1e-3) : 1e3;
  farbe = mix(farbe, uDunst, 1.0 - exp(-tau));

  gl_FragColor = vec4(farbe, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const texturen = new WeakMap<PhysikHimmel, THREE.DataTexture>();

function ansichtTextur(p: PhysikHimmel): THREE.DataTexture {
  const alt = texturen.get(p);
  if (alt) return alt;
  const daten = new Uint16Array(ANSICHT_B * ANSICHT_H * 4);
  for (let i = 0; i < ANSICHT_B * ANSICHT_H; i++) {
    for (let k = 0; k < 3; k++) daten[i * 4 + k] = THREE.DataUtils.toHalfFloat(p.ansicht[i * 3 + k]);
    daten[i * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  // Halbe Fliesskommazahlen: linear filterbar ohne Erweiterung (WebGL2), Strahldichte bleibt linear.
  const t = new THREE.DataTexture(daten, ANSICHT_B, ANSICHT_H, THREE.RGBAFormat, THREE.HalfFloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.LinearSRGBColorSpace;
  t.needsUpdate = true;
  texturen.set(p, t);
  return t;
}

/** Sonnenscheibe: physikalisch 1/Ω ≈ 14.700 × Bestrahlung — gedeckelt, Tone Mapping macht sie ohnehin weiss. */
const SCHEIBE_DECKEL = 400;

export function bauePhysikHimmel(w: HimmelWerte & { atmosphaere: NonNullable<HimmelWerte['atmosphaere']> }): THREE.Mesh {
  const a = w.atmosphaere;
  const p = himmelZuFarben(a, w.sonnenstand, w.zenit, w.horizont);
  const scheibe = new THREE.Vector3(...p.sonneBoden).multiplyScalar(p.skala * SCHEIBE_DECKEL * (w.scheibe > 0 ? 1 : 0));
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uAnsicht: { value: ansichtTextur(p) },
      uSonne: { value: new THREE.Vector3(...w.sonnenstand).normalize() },
      uScheibe: { value: scheibe },
      uDunst: { value: new THREE.Color(w.horizont) },
      uDunstTiefe: { value: a.dunstTiefe },
      uWolken: { value: w.wolken ?? 0.45 },
      uWolkenHoehe: { value: a.wolkenHoehe ?? 2000 },
      uWolkenSonne: { value: new THREE.Vector3(...p.sonneWolke).multiplyScalar(p.skala) },
      uWolkenUmfeld: { value: new THREE.Vector3(...p.umfeld) },
      uTauWolke: { value: new THREE.Vector3(...p.tauWolke) },
      uZeit: { value: 0 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.userData.physik = p;
  mesh.onBeforeRender = () => { material.uniforms.uZeit.value = performance.now() / 1000; };
  return mesh;
}
