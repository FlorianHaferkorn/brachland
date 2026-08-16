/**
 * BRACHLAND — Materialien für Wasser und Wege
 *
 * Beide waren flache, einfarbige Bänder mit harter Kante — im Spiel las sich das als
 * „Platte auf der Landschaft", nicht als Bach oder Feldweg. Der Grund ist derselbe
 * wie beim Boden: Zwischen Geometrie und Farbe fehlt die Ebene, auf der ein Auge
 * Oberfläche erkennt. Und die Kante fehlt in der Natur ganz — ein Bach hat ein Ufer,
 * ein Weg einen ausgetretenen Rand.
 *
 * Beides kommt aus dem Shader und kostet **null Bytes**:
 * - `uv.x` läuft quer über das Band, -1 am linken, +1 am rechten Rand. Daraus wird
 *   die weiche Kante: außen durchsichtig, innen deckend.
 * - `uv.y` ist die Strecke in Metern flussabwärts. Daraus laufen die Wellen.
 */
import * as THREE from 'three';

const HASH_GLSL = /* glsl */ `
float bandHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float bandRauschen(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bandHash(i), bandHash(i + vec2(1.0, 0.0)), f.x),
             mix(bandHash(i + vec2(0.0, 1.0)), bandHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

/**
 * Fließendes Wasser.
 *
 * Drei Lagen übereinander, jede für sich billig:
 * 1. **Ufer** — Deckkraft fällt zum Rand hin ab, statt an einer Kante zu enden.
 * 2. **Strömung** — zwei gegenläufige Wellenzüge in der Normale. Nicht in der Farbe:
 *    Wasser erkennt man am wandernden Glanzlicht, nicht an wandernden Flecken.
 * 3. **Tiefe** — zur Mitte hin dunkler und satter, am Ufer heller.
 *
 * `flatShading` ist hier bewusst **aus**. Die facettierte Optik ist Art Direction für
 * Fels und Boden; eine facettierte Wasseroberfläche sieht aus wie Bruchglas.
 */
export function baueWasserMaterial(fallend = false): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: fallend ? '#7d9aa2' : '#2e5560',
    roughness: fallend ? 0.35 : 0.18,
    metalness: fallend ? 0.05 : 0.28,
    transparent: true, opacity: fallend ? 0.8 : 0.92,
    emissive: new THREE.Color(fallend ? '#3a5c64' : '#12303a'),
    emissiveIntensity: fallend ? 0.5 : 0.3,
    // Fallendes Wasser wird von beiden Seiten gesehen — man steht auch mal darunter.
    side: fallend ? THREE.DoubleSide : THREE.FrontSide,
  });

  const zeit = { value: 0 };
  material.userData.zeit = zeit;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.zeit = zeit;
    // Fallendes Wasser läuft schneller. Derselbe Shader, ein anderer Faktor.
    shader.uniforms.uTempo = { value: fallend ? 4.5 : 1 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBand;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vBand = uv;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float zeit;\nuniform float uTempo;\nvarying vec2 vBand;\n' + HASH_GLSL)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
  float ufer = 1.0 - abs(vBand.x);

  /* Tiefe.
   *
   * Ein Bach ist am Ufer knöcheltief und in der Mitte hüfttief, und man sieht das
   * an der Farbe, nicht an der Geometrie: Je mehr Wasser über dem Grund steht, desto
   * mehr rotes Licht ist weg. Deshalb läuft die Mitte ins Blaugrüne und wird
   * dunkler, das Ufer bleibt hell und sandig.
   *
   * Das ist billiger und robuster als echte Tiefenberechnung: Die bräuchte den
   * Tiefenpuffer der Szene, ein zweites Rendertarget und würde auf Handys genau die
   * Fuellrate kosten, die wir nicht haben. */
  float tiefe = smoothstep(0.0, 0.75, ufer);
  vec3 grund = vec3(0.44, 0.46, 0.42);
  vec3 tief  = diffuseColor.rgb * vec3(0.55, 0.85, 0.95);
  diffuseColor.rgb = mix(grund, tief, tiefe);
  // Über tiefem Wasser sieht man den Grund nicht mehr — Deckkraft steigt mit.
  float deckung = mix(0.72, 0.97, tiefe);
  // Weiche Uferkante statt Plattenrand.
  diffuseColor.a = deckung * smoothstep(0.0, 0.28, ufer);
`)
      .replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
  // Zwei Wellenzüge unterschiedlicher Länge und Geschwindigkeit. Der zweite läuft
  // schräg, sonst entsteht ein sichtbares Streifenmuster.
  float w1 = sin(vBand.y * 2.3 - zeit * uTempo * 1.7 + vBand.x * 1.1);
  float w2 = sin(vBand.y * 5.9 - zeit * uTempo * 2.9 - vBand.x * 2.7);
  float kraus = bandRauschen(vec2(vBand.y * 1.7 - zeit * uTempo * 0.6, vBand.x * 3.0)) - 0.5;
  normal = normalize(normal + vec3(w2 * 0.10 + kraus * 0.16, 0.0, w1 * 0.14));
`);
  };

  material.customProgramCacheKey = () => `brachland-wasser-v2-${fallend ? 'fall' : 'lauf'}`;
  return material;
}

/**
 * Feldwege und Straßen.
 *
 * Gleiche Idee, ruhiger eingestellt: ausgefranster Rand statt weicher Uferverlauf,
 * Spurrinnen über `uv.x`, Flecken über die Weltposition. Ein Weg soll ausgetreten
 * wirken, nicht gestreichelt.
 */
export function baueWegMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#4a4740', roughness: 1, metalness: 0, transparent: true,
  });

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBand;\nvarying vec3 vWeltPos;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\n  vBand = uv;\n  vWeltPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBand;\nvarying vec3 vWeltPos;\n' + HASH_GLSL)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
  float quer = abs(vBand.x);
  float rand = 1.0 - quer;

  // Zwei Spurrinnen bei etwa halber Breite — heller, weil dort der Schotter liegt.
  float rinne = exp(-pow((quer - 0.55) * 5.5, 2.0));
  diffuseColor.rgb *= 1.0 + rinne * 0.22;

  // Flecken aus der Weltposition, damit benachbarte Segmente zusammenpassen.
  float fleck = bandRauschen(vWeltPos.xz * 0.85);
  diffuseColor.rgb *= 0.86 + fleck * 0.30;

  // Ausgefranster Rand: Das Rauschen verschiebt die Kante, statt sie zu begradigen.
  float franse = bandRauschen(vec2(vBand.y * 1.4, vBand.x * 2.0)) * 0.22;
  diffuseColor.a *= smoothstep(0.0, 0.30 + franse, rand);
`);
  };

  material.customProgramCacheKey = () => 'brachland-weg-v1';
  return material;
}
