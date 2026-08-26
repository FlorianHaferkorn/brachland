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
}

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
varying vec3 vRichtung;

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

  // Hof: weiter, weicher Abfall. Das ist der Teil, der die Stimmung macht.
  farbe += sonnenfarbe * pow(d, hof) * 0.55;
  // Scheibe: harte Kante mit schmalem Saum.
  farbe += sonnenfarbe * smoothstep(1.0 - scheibe, 1.0 - scheibe * 0.35, d) * 1.4;
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
    },
  });

  // Wenige Segmente reichen: Die Farbe kommt aus der Richtung je Pixel, nicht aus
  // den Eckpunkten. 16x10 sind 320 Dreiecke fuer den ganzen Himmel.
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
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
}
