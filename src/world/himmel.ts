/**
 * BRACHLAND — Himmel als Verlauf statt als Farbfläche
 *
 * Bisher war `scene.background` eine einzige Farbe. Das kostet nichts und sieht auch
 * nach nichts aus: Der Horizont endet in derselben Fläche, in der er beginnt, und
 * die Sonne — die stärkste Lichtquelle der Szene — ist im Bild nirgends zu sehen.
 *
 * Ein Verlaufshimmel ist die billigste Atmosphäre, die es gibt. Er kostet **eine**
 * Kugel, ein Material ohne Textur und keinen einzigen Byte Download. Vier Dinge
 * macht er, die eine Volltonfarbe nicht kann:
 *
 * 1. **Zenit zu Horizont.** Oben dunkler, unten heller — das ist der Grund, warum
 *    ein Himmel als Raum gelesen wird und nicht als Wand.
 * 2. **Dunst am Horizont** in der Nebelfarbe. Damit verschwindet die Kante zwischen
 *    fernem Gelände und Himmel; das Tal wird tief, statt vor einer Tapete zu stehen.
 * 3. **Die Sonne steht im Bild.** Eine Scheibe plus weiter Hof. Bei Dämmerung ist
 *    genau dieser Hof die Lichtstimmung.
 * 4. **Gegenlicht am Gegenhorizont** — der schwache Aufheller gegenüber der Sonne,
 *    den jeder Sonnenuntergang hat.
 *
 * Gezeichnet wird von innen (`BackSide`) und ohne Tiefenschreiben, damit die Kugel
 * alles andere durchlässt. Sie hängt an der Kamera, hat also keine Ausdehnung im
 * Spielraum und keine Wechselwirkung mit Nebel oder Schatten.
 */
import * as THREE from 'three';

export interface HimmelWerte {
  zenit: string;
  horizont: string;
  /** Dunstfarbe direkt über dem Horizont — sollte der Nebelfarbe entsprechen. */
  dunst: string;
  sonne: string;
  /** Richtung zur Sonne (wird normiert). */
  sonnenstand: readonly [number, number, number];
  /** Winkeliger Radius der Sonnenscheibe, grob in Grad. */
  scheibe: number;
  /** Reichweite des Hofs. Kleiner Wert = weiter Hof. */
  hof: number;
  /** D203: Wolkenbedeckung 0…1; ohne Angabe `WOLKEN_VORGABE`. */
  wolken?: number;
}

/**
 * D203: Bedeckung, wenn die Stimmung nichts sagt. Ein Himmel ohne eine einzige Wolke las sich an
 * den Vergleichskameras als Fläche; Soulframe-Himmel (ADR-0012) tragen fast immer Schichten.
 */
export const WOLKEN_VORGABE = 0.45;

const VERTEX = /* glsl */ `
varying vec3 vRichtung;
void main() {
  vRichtung = normalize(position);
  // w = z erzwingen: Die Kugel liegt damit immer auf der fernen Ebene und
  // ueberzeichnet nichts, egal wie gross sie ist.
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 zenit;
uniform vec3 horizont;
uniform vec3 dunst;
uniform vec3 sonnenfarbe;
uniform vec3 sonnenrichtung;
uniform float scheibe;
uniform float hof;
uniform float wolken;
uniform float uZeit;
varying vec3 vRichtung;

// D203: Wertrauschen und FBM für die Wolken — dieselbe Machart wie das Bodenrauschen, null Bytes.
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

void main() {
  vec3 r = normalize(vRichtung);
  float h = r.y;

  // Grundverlauf. Die Wurzel drueckt den Uebergang nach unten, sonst sitzt die
  // Mitte des Verlaufs auf 45 Grad und der Himmel wirkt oben flach.
  float t = clamp(h, 0.0, 1.0);
  vec3 farbe = mix(horizont, zenit, sqrt(t));

  // Dunstband: nur die untersten Grad ueber dem Horizont, dafuer kraeftig.
  float band = exp(-max(h, 0.0) * 14.0);
  farbe = mix(farbe, dunst, band * 0.85);

  // Unterhalb des Horizonts bleibt alles Dunst — dort steht ohnehin Gelaende.
  farbe = mix(farbe, dunst, clamp(-h * 6.0, 0.0, 1.0));

  vec3 s = normalize(sonnenrichtung);
  float d = max(dot(r, s), 0.0);

  // D203: Wolken. Kuppelprojektion — zum Horizont hin dichter gepackt, wie eine Wolkendecke in der
  // Perspektive. Unten laufen sie in den Dunst aus, sonst stünde eine Kante über dem Gelände.
  // Beleuchtet von der Sonne: Grundton aus dem Horizont, zur Sonne hin wärmer und heller, am Rand
  // ein heller Saum im Gegenlicht.
  float bedeckt = 0.0;
  if (h > 0.0 && wolken > 0.0) {
    vec2 uv = r.xz / (h + 0.12) * 0.75 + vec2(uZeit * 0.0035, uZeit * 0.0012);
    float n = himmelFbm(uv) + 0.25 * himmelFbm(uv * 3.1 + 7.0) - 0.125;
    float dichte = smoothstep(1.0 - wolken, 1.0 - wolken + 0.32, n);
    bedeckt = dichte * smoothstep(0.015, 0.16, h);
    float licht = 0.5 + 0.5 * pow(d, 2.0);
    vec3 wolkenFarbe = mix(horizont * 0.82, mix(horizont, sonnenfarbe, 0.4) * 1.2, licht);
    wolkenFarbe += sonnenfarbe * dichte * (1.0 - dichte) * 4.0 * pow(d, 5.0) * 0.45;
    farbe = mix(farbe, wolkenFarbe, bedeckt * 0.9);
  }

  // Hof: weiter, weicher Abfall. Das ist der Teil, der die Stimmung macht. Durch Wolken gedämpft,
  // nicht ausgelöscht — der Hof ist Streulicht und leuchtet die Wolken mit aus.
  farbe += sonnenfarbe * pow(d, hof) * 0.55 * (1.0 - bedeckt * 0.5);
  // Scheibe: harte Kante mit schmalem Saum, hinter Wolken verdeckt.
  farbe += sonnenfarbe * smoothstep(1.0 - scheibe, 1.0 - scheibe * 0.35, d) * 1.4 * (1.0 - bedeckt * 0.9);
  // Gegenlicht: schwacher Aufheller gegenueber der Sonne, knapp ueber dem Horizont.
  float gegen = max(dot(r, -s), 0.0);
  farbe += sonnenfarbe * pow(gegen, 8.0) * exp(-max(h, 0.0) * 6.0) * 0.10;

  gl_FragColor = vec4(farbe, 1.0);

  // Diese beiden Zeilen sind der Grund, warum der obige Kommentar überhaupt
  // stimmt. Ein roher ShaderMaterial schreibt direkt in den Bildspeicher: kein
  // Tone Mapping, keine Farbraumwandlung. Das Gelände geht beide Schritte, und
  // der Nebel des Geländes trägt dieselbe Farbe wie dunst hier — bis zum
  // 26.08.2026 kamen sie deshalb nie zusammen. Gemessen an #1b2a2b: roh
  // (3, 6, 6), nur Farbraum (27, 42, 43), beide Schritte **(25, 49, 51)** —
  // und (25, 49, 51) ist genau das, was der Nebel auf dem Gelände ergibt (G-105).
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function baueHimmel(w: HimmelWerte): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenit: { value: new THREE.Color(w.zenit) },
      horizont: { value: new THREE.Color(w.horizont) },
      dunst: { value: new THREE.Color(w.dunst) },
      sonnenfarbe: { value: new THREE.Color(w.sonne) },
      sonnenrichtung: { value: new THREE.Vector3(...w.sonnenstand).normalize() },
      scheibe: { value: w.scheibe },
      hof: { value: w.hof },
      wolken: { value: w.wolken ?? WOLKEN_VORGABE },
      uZeit: { value: 0 },
    },
  });

  // Wenige Segmente reichen: Die Farbe kommt aus der Richtung je Pixel, nicht aus
  // den Eckpunkten. 16x10 sind 320 Dreiecke fuer den ganzen Himmel.
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  // Wolken ziehen: Zeit je Bild, ohne dass die Szene davon wissen muss.
  mesh.onBeforeRender = () => { material.uniforms.uZeit.value = performance.now() / 1000; };
  return mesh;
}

export function setzeHimmel(mesh: THREE.Mesh, w: HimmelWerte): void {
  const u = (mesh.material as THREE.ShaderMaterial).uniforms;
  (u.zenit.value as THREE.Color).set(w.zenit);
  (u.horizont.value as THREE.Color).set(w.horizont);
  (u.dunst.value as THREE.Color).set(w.dunst);
  (u.sonnenfarbe.value as THREE.Color).set(w.sonne);
  (u.sonnenrichtung.value as THREE.Vector3).set(...w.sonnenstand).normalize();
  u.scheibe.value = w.scheibe;
  u.hof.value = w.hof;
  u.wolken.value = w.wolken ?? WOLKEN_VORGABE;
}
