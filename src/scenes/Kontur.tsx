/**
 * BRACHLAND — Nachbearbeitung: Kontur (dunkle Linie an jeder Tiefenkante) und AO (Stufe 2)
 *
 * **Kontur.** Der eine Baustein, den kein Asset mitbringt und der den handgemalten
 * Eindruck der Stilreferenz traegt (G-126, Phase 1): Jedes Objekt bekommt an
 * seiner Silhouette eine dunkle Linie, gleich breit, egal woher es kommt —
 * Fels, Haus, Grasbueschel, Kreatur. Das ist der staerkste Vereinheitlicher
 * ueber Quellen hinweg, weil er *nach* allen Materialien kommt.
 *
 * **AO (ADR-0006, Stufe 2, D155).** Der Vergleich Spielbild gegen Blender-Render an derselben
 * Kamera (D154) ergab: Himmel, Licht und Dunst decken sich, aber der Hof ist im Spiel 6× heller,
 * weil die Engine keine Verdeckung kennt — im Render nimmt die Mauer dem Hof den Himmel. Deshalb
 * ein Verdeckungspass aus der Tiefe: Sichtraumposition aus Tiefe und Sichtfeld rekonstruiert,
 * Normale aus den Ableitungen, 12 Proben in der Halbkugel (Radius 8 m, je Pixel gedreht),
 * Abstandspruefung gegen Halos, danach ein 4-Punkte-Weichzeichner im Kompositpass. Das ist
 * Nahfeld-Verdeckung (Fugen, Mauerfuss, Blockschatten); die grosse Himmelsverdeckung des Hofs
 * kommt weiterhin aus dem **gebackenen** AO der Bauwerke (`tools/szenenexport.py`).
 *
 * ## Warum ein Vollbildpass und keine Rueckseitenhuelle
 *
 * Die Huelle (das Objekt ein zweites Mal, leicht aufgeblasen, nur Rueckseiten)
 * braucht Normalen zum Aufblasen — die Kreaturen kommen seit D107 ohne —, und
 * sie ist ein zweiter Draw Call je Objekt, also auf dem Zielgeraet die teure
 * Groesse (G-111). Ein Tiefenpass ist genau **ein** Aufruf fuer das ganze
 * Bild und trifft auch Instanzen, Kacheln und den Himmel.
 *
 * ## Wie gemessen wird
 *
 * `?kontur=0` schaltet die Linie ab, `?kontur=1` an; `?ao=0` schaltet die Verdeckung ab,
 * `?ao=1.5` setzt ihre Staerke, `?aoRadius=4` die Reichweite in Metern — unabhängig von der Vorgabe, damit Bildtor und Vergleich
 * beide Zustaende an demselben Ort sehen. Der Pass selbst laeuft, sobald eines von beiden an
 * ist: Szene in ein Ziel mit Tiefe, AO in ein halb so grosses Ziel, ein Vollbild-Quad.
 *
 * ## Tone Mapping
 *
 * three.js wendet Tone Mapping und die sRGB-Wandlung nur beim Zeichnen auf
 * den Bildschirm an, nicht in ein Renderziel. Die Szene liegt im Ziel also
 * **linear und ungemappt** (deshalb HalfFloat), und das Quad holt beides mit
 * denselben Chunks nach, die auch jedes Material benutzt — dieselbe Falle,
 * in die G-105 beim Himmel gelaufen ist, nur hier bewusst behandelt. AO wird
 * im Linearen multipliziert, vor dem Mapping.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { MSAA, ABGLEICH_AN, AO_RUHIG, TAA_AN, KUWAHARA_AN } from '../world/echt.js';

const KONTUR_ADRESSE: boolean | null = (() => {
  if (typeof location === 'undefined') return null;
  const roh = new URLSearchParams(location.search).get('kontur');
  return roh === null ? null : roh !== '0';
})();

/** `?ao=0` aus, `?ao=1.5` Staerke; ohne Angabe die Vorgabe. */
const AO_ADRESSE: number | null = (() => {
  if (typeof location === 'undefined') return null;
  const roh = new URLSearchParams(location.search).get('ao');
  if (roh === null) return null;
  const n = Number(roh);
  return Number.isFinite(n) && n >= 0 ? n : null;
})();

/** `?aoRadius=8` Reichweite in Metern; ohne Angabe die Vorgabe. */
const AO_RADIUS_ADRESSE: number | null = (() => {
  if (typeof location === 'undefined') return null;
  const roh = new URLSearchParams(location.search).get('aoRadius');
  if (roh === null) return null;
  const n = Number(roh);
  return Number.isFinite(n) && n > 0 && n <= 32 ? n : null;
})();

/** `?bloom=0` aus, `?bloom=0.2` Staerke (D210). */
const BLOOM_ADRESSE: number | null = (() => {
  if (typeof location === 'undefined') return null;
  const roh = new URLSearchParams(location.search).get('bloom');
  if (roh === null) return null;
  const n = Number(roh);
  return Number.isFinite(n) && n >= 0 ? n : null;
})();

/** `?schacht=0` aus, `?schacht=0.5` Staerke der Lichtschaechte (D210). */
const SCHACHT_ADRESSE: number | null = (() => {
  if (typeof location === 'undefined') return null;
  const roh = new URLSearchParams(location.search).get('schacht');
  if (roh === null) return null;
  const n = Number(roh);
  return Number.isFinite(n) && n >= 0 ? n : null;
})();

/** Ist die Kontur an? Adresse schlaegt Vorgabe. */
export function konturAn(vorgabe: boolean): boolean {
  return KONTUR_ADRESSE ?? vorgabe;
}

/** Staerke der Verdeckung; 0 = aus. Adresse schlaegt Vorgabe. */
export function aoStaerke(vorgabe: number): number {
  return AO_ADRESSE ?? vorgabe;
}

/** Reichweite der Verdeckung in Metern; Adresse schlaegt Vorgabe. */
export function aoReichweite(vorgabe: number): number {
  return AO_RADIUS_ADRESSE ?? vorgabe;
}

const SCHEITEL = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const TIEFE_GLSL = /* glsl */`
  uniform sampler2D tTiefe;
  uniform float uNah, uFern;
  // Perspektivische Tiefe zurueck in Meter, damit Schwellen in Metern und Prozent
  // gelten und nicht in Puffereinheiten.
  float meter(vec2 uv) {
    float d = texture2D(tTiefe, uv).x;
    float z = d * 2.0 - 1.0;
    return (2.0 * uNah * uFern) / (uFern + uNah - z * (uFern - uNah));
  }
`;

/** Verdeckung aus der Tiefe, in ein halb so grosses Ziel. */
const AO_FRAGMENT = /* glsl */`
  #include <common>
  __TIEFE__
  uniform vec2 uTanHalb;
  uniform float uRadius;
  uniform float uRuhig;
  varying vec2 vUv;

  // Sichtraumposition: uv → Sichtstrahl mal Tiefe. z zeigt nach hinten (negativ).
  vec3 sicht(vec2 uv) {
    float z = meter(uv);
    return vec3((uv * 2.0 - 1.0) * uTanHalb * z, -z);
  }

  void main() {
    vec3 P = sicht(vUv);
    if (-P.z > uFern * 0.95) { gl_FragColor = vec4(1.0); return; }   // Himmel
    vec3 N = normalize(cross(dFdx(P), dFdy(P)));
    // Halbkugel um N: Basis aus einem je Pixel gedrehten Zufallsvektor
    float w = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    // D263 (\`?echt=1\`): statt weissem Rauschen ein 4×4-Bayer-Muster. Jede Drehung kommt in jedem
    // 4×4-Block genau einmal vor, und die 16-Proben-Weichzeichnung im Zielbild hebt es restlos auf.
    // Mit weissem Rauschen blieb nach den vier Proben ein Korn, das in Bewegung flimmerte.
    if (uRuhig > 0.0) {
      vec2 q = mod(floor(gl_FragCoord.xy), 4.0);
      vec2 fein = mod(q, 2.0), grob = floor(q / 2.0);
      // 2×2-Bayer (0 2 / 3 1) zweimal geschachtelt: 16 verschiedene Werte je 4×4-Block.
      float b = 4.0 * mod(2.0 * fein.x + 3.0 * fein.y, 4.0) + mod(2.0 * grob.x + 3.0 * grob.y, 4.0);
      w = (b + 0.5) / 16.0;
    }
    vec3 zufall = vec3(cos(w * 6.2832), sin(w * 6.2832), 0.37);
    vec3 T = normalize(zufall - N * dot(zufall, N));
    vec3 B = cross(N, T);
    float verdeckt = 0.0;
    for (int i = 0; i < 12; i++) {
      float t = (float(i) + 0.5) / 12.0;
      float a = t * 6.2832 * 2.4 + w * 6.2832;
      float r = uRadius * (0.15 + 0.85 * t * t);
      // Proben in der Halbkugel, zur Normale hin gewichtet
      vec3 h = (T * cos(a) + B * sin(a)) * r * (1.0 - t * 0.5) + N * r * (0.3 + 0.7 * t);
      vec3 S = P + h;
      vec2 suv = (S.xy / -S.z) / uTanHalb * 0.5 + 0.5;
      if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
      float zs = meter(suv);
      float dz = (-S.z) - zs;                       // > 0: Szene liegt vor der Probe → verdeckt
      float reichweite = smoothstep(0.0, 1.0, uRadius / max(1e-3, abs(-P.z - zs)));
      verdeckt += (dz > 0.03 ? 1.0 : 0.0) * reichweite;
    }
    float ao = 1.0 - verdeckt / 12.0;
    // In der Ferne ausblenden: Dort ist die Tiefe zu grob, und die Verdeckung wird zu Streifen
    // (gesehen an der Kulisse, D155). Verdeckung ist ohnehin ein Nahfeld-Mass.
    ao = mix(ao, 1.0, smoothstep(120.0, 350.0, -P.z));
    gl_FragColor = vec4(vec3(ao), 1.0);
  }
`;

/**
 * D210 (ADR-0012, Hebel 6): Helles fuer Bloom und Quelle der Lichtschaechte, auf Viertelaufloesung.
 * rgb: was ueber der Schwelle liegt (linear, vor dem Tone Mapping); a: Himmel nahe der Sonne —
 * nur dort, wo die Tiefe leer ist. Was davor steht (Stamm, Krone, Mauer), schneidet den Schacht.
 */
const HELL_FRAGMENT = /* glsl */`
  #include <common>
  __TIEFE__
  uniform sampler2D tFarbe;
  uniform vec2 uTexel;
  uniform float uSchwelleHell;
  uniform vec2 uSonneUv;
  uniform float uSeiten;
  varying vec2 vUv;
  void main() {
    vec3 c = 0.25 * (texture2D(tFarbe, vUv + uTexel * vec2(1.0, 1.0)).rgb
                   + texture2D(tFarbe, vUv + uTexel * vec2(-1.0, 1.0)).rgb
                   + texture2D(tFarbe, vUv + uTexel * vec2(1.0, -1.0)).rgb
                   + texture2D(tFarbe, vUv + uTexel * vec2(-1.0, -1.0)).rgb);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 hell = c * max(l - uSchwelleHell, 0.0) / max(l, 1e-4);
    float himmel = step(uFern * 0.95, meter(vUv));
    vec2 ab = (vUv - uSonneUv) * vec2(uSeiten, 1.0);
    float nahSonne = pow(max(0.0, 1.0 - length(ab) / 0.7), 2.0);
    gl_FragColor = vec4(hell, himmel * min(l, 4.0) * nahSonne);
  }
`;

/** Lichtschaechte: radiales Verwischen der Himmelsmaske zur Sonne hin. */
const SCHACHT_FRAGMENT = /* glsl */`
  uniform sampler2D tHell;
  uniform vec2 uSonneUv;
  varying vec2 vUv;
  void main() {
    vec2 schritt = (vUv - uSonneUv) * (0.95 / 40.0);
    vec2 uv = vUv;
    float summe = 0.0, gewicht = 1.0;
    for (int i = 0; i < 40; i++) {
      uv -= schritt;
      summe += texture2D(tHell, uv).a * gewicht;
      gewicht *= 0.965;
    }
    gl_FragColor = vec4(vec3(summe / 40.0), 1.0);
  }
`;

/** Gauss mit neun Abgriffen, einmal waagrecht, einmal senkrecht. */
const WEICH_FRAGMENT = /* glsl */`
  uniform sampler2D tQuelle;
  uniform vec2 uRichtung;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tQuelle, vUv).rgb * 0.227027;
    c += (texture2D(tQuelle, vUv + uRichtung * 1.5).rgb + texture2D(tQuelle, vUv - uRichtung * 1.5).rgb) * 0.1945946;
    c += (texture2D(tQuelle, vUv + uRichtung * 3.0).rgb + texture2D(tQuelle, vUv - uRichtung * 3.0).rgb) * 0.1216216;
    c += (texture2D(tQuelle, vUv + uRichtung * 4.5).rgb + texture2D(tQuelle, vUv - uRichtung * 4.5).rgb) * 0.054054;
    c += (texture2D(tQuelle, vUv + uRichtung * 6.0).rgb + texture2D(tQuelle, vUv - uRichtung * 6.0).rgb) * 0.016216;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const FRAGMENT = /* glsl */`
  #include <common>
  __TIEFE__
  uniform sampler2D tFarbe;
  uniform sampler2D tAO;
  uniform vec2 uTexel;
  uniform vec2 uTexelAO;
  uniform float uStaerke;
  uniform float uSchwelle;
  uniform float uAO;
  uniform sampler2D tBloom;
  uniform sampler2D tSchacht;
  uniform float uBloom;
  uniform vec3 uSchacht;
  uniform float uAbgleich;
  uniform float uRuhig;
  uniform float uKuwahara;
  varying vec2 vUv;

  /* Malfilter (D269): Kuwahara mit vier Sektoren. Gemittelt wird in Karis-Stauchung (c / (1 + c)),
   * damit helle Pixel die Varianz nicht dominieren; Schrittweite = Pixelverhältnis, sonst wäre der
   * Strich auf einem 2×-Schirm halb so gross. 4 × 16 Proben je Pixel. */
  vec3 kuwahara(vec2 uv) {
    vec3 mittel[4]; float var[4];
    for (int q = 0; q < 4; q++) { mittel[q] = vec3(0.0); var[q] = 0.0; }
    vec2 schritt = uTexel * uKuwahara;
    for (int q = 0; q < 4; q++) {
      vec2 richtung = vec2((q == 1 || q == 2) ? -1.0 : 1.0, (q >= 2) ? -1.0 : 1.0);
      vec3 summe = vec3(0.0); float lSumme = 0.0, l2 = 0.0;
      for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
        vec3 c = texture2D(tFarbe, uv + vec2(float(i), float(j)) * richtung * schritt).rgb;
        c = c / (1.0 + c);
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        summe += c; lSumme += l; l2 += l * l;
      }
      mittel[q] = summe / 16.0;
      float lm = lSumme / 16.0;
      var[q] = l2 / 16.0 - lm * lm;
    }
    vec3 best = mittel[0]; float vMin = var[0];
    for (int q = 1; q < 4; q++) if (var[q] < vMin) { vMin = var[q]; best = mittel[q]; }
    return best / max(1.0 - best, vec3(1e-3));
  }

  /* Farbabgleich (D262, \`?abgleich=1\` / \`?echt=1\`): linear, vor dem Tonemapping.
   * 1. Weissabgleich: ein Teil des Sepiastichs raus, Helligkeit bleibt (Luminanz wieder hergestellt).
   * 2. Kontrast um 0,12 (Mitte des dämmrigen Bildes) in Potenz 1,1 — Schatten tiefer, Licht heller, Mitte bleibt.
   * 3. Etwas Sättigung zurück, die der Stich vorher als Gelbbraun gebunden hatte. */
  vec3 abgleich(vec3 c) {
    float l0 = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c *= vec3(0.8, 1.0, 1.35);
    float l1 = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c *= l0 / max(l1, 1e-5);
    c = 0.12 * pow(max(c, vec3(0.0)) / 0.12, vec3(1.1));
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return max(mix(vec3(l), c, 1.12), vec3(0.0));
  }

  void main() {
    vec4 farbe = uKuwahara > 0.0 ? vec4(kuwahara(vUv), 1.0) : texture2D(tFarbe, vUv);
    float z = meter(vUv);
    float zl = meter(vUv - vec2(uTexel.x, 0.0));
    float zr = meter(vUv + vec2(uTexel.x, 0.0));
    float zu = meter(vUv - vec2(0.0, uTexel.y));
    float zo = meter(vUv + vec2(0.0, uTexel.y));
    // Nur Kanten, an denen der Nachbar **weiter weg** ist: die Linie liegt am
    // vorderen Objekt, nicht am Hintergrund, und ein Hang vor dem Himmel
    // bekommt sie an der Hangkante.
    float sprung = max(max(zl - z, zr - z), max(zu - z, zo - z)) / z;
    float kante = smoothstep(uSchwelle, uSchwelle * 3.0, sprung);
    // AO: vier Proben um den Pixel weichgezeichnet — das Rauschen des Passes verschwindet,
    // die Verdeckung bleibt. Potenz statt Faktor, damit 0,5 sichtbar dunkler ist als 0,8.
    float ao = 1.0;
    if (uAO > 0.0) {
      if (uRuhig > 0.0) {
        // D263: 4×4 AO-Texel (= 8×8 Bildpixel), tiefengewichtet — das Bayer-Muster verschwindet,
        // Kanten bleiben, weil Proben auf anderer Tiefe (Stamm vor Wiese) kaum zählen.
        float summe = 0.0, gewicht = 0.0;
        for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++) {
          vec2 suv = vUv + (vec2(float(i), float(j)) - 1.5) * uTexelAO;
          float g = 1.0 / (1.0 + pow(abs(meter(suv) - z) / (0.03 * z), 2.0));
          summe += texture2D(tAO, suv).r * g; gewicht += g;
        }
        ao = summe / max(gewicht, 1e-4);
      } else
      ao = 0.25 * (texture2D(tAO, vUv + vec2(uTexelAO.x, uTexelAO.y) * 0.5).r
                 + texture2D(tAO, vUv + vec2(-uTexelAO.x, uTexelAO.y) * 0.5).r
                 + texture2D(tAO, vUv + vec2(uTexelAO.x, -uTexelAO.y) * 0.5).r
                 + texture2D(tAO, vUv + vec2(-uTexelAO.x, -uTexelAO.y) * 0.5).r);
      ao = pow(clamp(ao, 0.0, 1.0), uAO);
      // D215: Feinstruktur (Halme, Laub) springt in der Tiefe in **beide** Richtungen; eine echte
      // Kante (Mauerfuss, Stamm vor Boden) nur in eine. Wo beide Achsen springen, verdeckt jeder Halm
      // seinen Nachbarn, und die Verdeckung wurde zu schwarzen Stoppeln (Wiese, 08.10.2026).
      float rauh = min(abs(zl - z) + abs(zr - z), abs(zu - z) + abs(zo - z)) / z;
      ao = mix(ao, 1.0, smoothstep(0.004, 0.03, rauh) * 0.85);
    }
    vec3 rgb = farbe.rgb * ao * (1.0 - uStaerke * kante);
    if (uBloom > 0.0) rgb += texture2D(tBloom, vUv).rgb * uBloom;
    rgb += texture2D(tSchacht, vUv).r * uSchacht;
    if (uAbgleich > 0.0) rgb = abgleich(rgb);
    gl_FragColor = vec4(rgb, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * Auflösung des Zeitverlaufs (D268). Alles in Karis-Stauchung (c / (1 + max(c))), damit helle Pixel
 * (Sonne, Gischt) den Verlauf nicht aufreissen und die Begrenzung auf die 3×3-Nachbarschaft in
 * einem Raum liegt, in dem Min/Max etwas bedeuten.
 * Reprojektion nur aus der Kamerabewegung: Tiefe → Weltpunkt → Position im Vorbild. Bewegte Objekte
 * (Tiere, Figuren) bekommen den Verlauf an der falschen Stelle; die Begrenzung hält den Geist klein.
 */
const TAA_FRAGMENT = /* glsl */`
  #include <common>
  __TIEFE__
  uniform sampler2D tAktuell;
  uniform sampler2D tVerlauf;
  uniform vec2 uTexel;
  uniform vec2 uTanHalb;
  uniform mat4 uKameraWelt;
  uniform mat4 uVorherVP;
  uniform float uErste;
  uniform float uMischung;
  varying vec2 vUv;

  vec3 stauche(vec3 c) { return c / (1.0 + max(max(c.r, c.g), c.b)); }
  vec3 entstauche(vec3 c) { return c / max(1.0 - max(max(c.r, c.g), c.b), 1e-3); }

  void main() {
    vec3 mitte = stauche(texture2D(tAktuell, vUv).rgb);
    vec3 lo = mitte, hi = mitte;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      if (i == 0 && j == 0) continue;
      vec3 c = stauche(texture2D(tAktuell, vUv + vec2(float(i), float(j)) * uTexel).rgb);
      lo = min(lo, c); hi = max(hi, c);
    }
    float z = meter(vUv);
    vec4 welt = uKameraWelt * vec4((vUv * 2.0 - 1.0) * uTanHalb * z, -z, 1.0);
    vec4 vor = uVorherVP * welt;
    vec2 vorUv = vor.xy / max(vor.w, 1e-4) * 0.5 + 0.5;
    bool innen = vor.w > 0.0 && vorUv.x > 0.0 && vorUv.y > 0.0 && vorUv.x < 1.0 && vorUv.y < 1.0;
    vec3 verlauf = clamp(stauche(texture2D(tVerlauf, vorUv).rgb), lo, hi);
    float bewegung = length((vorUv - vUv) / uTexel);
    float a = mix(uMischung, 0.5, clamp(bewegung / 8.0, 0.0, 1.0));
    if (uErste > 0.5 || !innen) a = 1.0;
    gl_FragColor = vec4(entstauche(mix(verlauf, mitte, a)), 1.0);
  }
`;

/** Letzter Pass mit TAA: Verlauf auf den Bildschirm, mit Tone Mapping und Ausgabefarbraum. */
const TAA_AUSGABE = /* glsl */`
  #include <common>
  uniform sampler2D tQuelle;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(texture2D(tQuelle, vUv).rgb, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Halton-Folge (Basis 2 und 3), Teilbildpunkt-Versatz in −0,5…0,5. */
function halton(i: number, basis: number): number {
  let f = 1, r = 0;
  while (i > 0) { f /= basis; r += f * (i % basis); i = Math.floor(i / basis); }
  return r - 0.5;
}

export function Kontur({ an, staerke = 0.6, schwelle = 0.03, ao = 1.4, aoRadius = 8,
  bloom = 0, schacht = 0, sonne, sonnenFarbe = '#ffffff' }: {
  an: boolean; staerke?: number; schwelle?: number;
  /** Verdeckungsstaerke als Exponent; 0 = aus. */
  ao?: number; aoRadius?: number;
  /** D210: Bloom-Staerke (0 = aus) und Lichtschaechte (0 = aus); `sonne` ist die Richtung zur Sonne. */
  bloom?: number; schacht?: number;
  sonne?: readonly [number, number, number]; sonnenFarbe?: THREE.ColorRepresentation;
}) {
  const { gl, scene, camera, size } = useThree();
  const dpr = gl.getPixelRatio();
  const aoAn = ao > 0;
  bloom = BLOOM_ADRESSE ?? bloom;
  schacht = sonne ? (SCHACHT_ADRESSE ?? schacht) : 0;
  const hellAn = bloom > 0 || schacht > 0;
  const passAn = an || aoAn || hellAn;

  const ziel = useMemo(() => {
    const b = Math.max(1, Math.round(size.width * dpr)), h = Math.max(1, Math.round(size.height * dpr));
    const rt = new THREE.WebGLRenderTarget(b, h, {
      type: THREE.HalfFloatType,
      depthTexture: new THREE.DepthTexture(b, h, THREE.UnsignedIntType),
      samples: MSAA,
    });
    const aoZiel = new THREE.WebGLRenderTarget(Math.max(1, Math.round(b / 2)), Math.max(1, Math.round(h / 2)), { depthBuffer: false });
    const viertel = () => new THREE.WebGLRenderTarget(Math.max(1, Math.round(b / 4)), Math.max(1, Math.round(h / 4)),
      { depthBuffer: false, type: THREE.HalfFloatType });
    const voll = () => new THREE.WebGLRenderTarget(b, h, { type: THREE.HalfFloatType, depthBuffer: false });
    return {
      rt, aoZiel, hell: viertel(), weich: viertel(), schacht: viertel(),
      // D268: TAA — Komposition und zwei Verlaufsbilder (Ping-Pong); sonst gar nicht angelegt.
      komp: TAA_AN ? voll() : null, verlauf: TAA_AN ? [voll(), voll()] as const : null,
    };
  }, [size, dpr]);
  useEffect(() => () => {
    ziel.rt.depthTexture?.dispose(); ziel.rt.dispose(); ziel.aoZiel.dispose();
    ziel.hell.dispose(); ziel.weich.dispose(); ziel.schacht.dispose();
    ziel.komp?.dispose(); ziel.verlauf?.forEach(v => v.dispose());
  }, [ziel]);
  // Zustand der Zeitauflösung; neues Ziel (Grössenwechsel) = neuer Zustand = erstes Bild ohne Verlauf.
  const taa = useMemo(() => ({
    index: 0, bild: 0, erste: true,
    vorherVP: new THREE.Matrix4(), jetztVP: new THREE.Matrix4(),
  }), [ziel]);

  const quad = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader: SCHEITEL, fragmentShader: FRAGMENT.replace('__TIEFE__', TIEFE_GLSL),
      uniforms: {
        tFarbe: { value: null }, tTiefe: { value: null }, tAO: { value: null },
        uTexel: { value: new THREE.Vector2() }, uTexelAO: { value: new THREE.Vector2() },
        uNah: { value: 0.2 }, uFern: { value: 1000 },
        uStaerke: { value: an ? staerke : 0 }, uSchwelle: { value: schwelle }, uAO: { value: ao },
        tBloom: { value: null }, tSchacht: { value: null },
        uBloom: { value: 0 }, uSchacht: { value: new THREE.Color(0, 0, 0) },
        uAbgleich: { value: ABGLEICH_AN ? 1 : 0 }, uRuhig: { value: AO_RUHIG ? 1 : 0 },
        uKuwahara: { value: KUWAHARA_AN ? Math.max(1, dpr) : 0 },
      },
      depthTest: false, depthWrite: false,
    });
    const aoMaterial = new THREE.ShaderMaterial({
      vertexShader: SCHEITEL, fragmentShader: AO_FRAGMENT.replace('__TIEFE__', TIEFE_GLSL),
      uniforms: {
        tTiefe: { value: null }, uNah: { value: 0.2 }, uFern: { value: 1000 },
        uTanHalb: { value: new THREE.Vector2(1, 1) }, uRadius: { value: aoRadius },
        uRuhig: { value: AO_RUHIG ? 1 : 0 },
      },
      depthTest: false, depthWrite: false,
    });
    const hellMaterial = new THREE.ShaderMaterial({
      vertexShader: SCHEITEL, fragmentShader: HELL_FRAGMENT.replace('__TIEFE__', TIEFE_GLSL),
      uniforms: {
        tFarbe: { value: null }, tTiefe: { value: null }, uNah: { value: 0.2 }, uFern: { value: 1000 },
        uTexel: { value: new THREE.Vector2() }, uSchwelleHell: { value: 1.2 },
        uSonneUv: { value: new THREE.Vector2(0.5, 0.5) }, uSeiten: { value: 1 },
      },
      depthTest: false, depthWrite: false,
    });
    const schachtMaterial = new THREE.ShaderMaterial({
      vertexShader: SCHEITEL, fragmentShader: SCHACHT_FRAGMENT,
      uniforms: { tHell: { value: null }, uSonneUv: { value: new THREE.Vector2(0.5, 0.5) } },
      depthTest: false, depthWrite: false,
    });
    const weichMaterial = new THREE.ShaderMaterial({
      vertexShader: SCHEITEL, fragmentShader: WEICH_FRAGMENT,
      uniforms: { tQuelle: { value: null }, uRichtung: { value: new THREE.Vector2() } },
      depthTest: false, depthWrite: false,
    });
    const vollbild = (m: THREE.Material) => {
      const sz = new THREE.Scene(); const me = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
      me.frustumCulled = false; sz.add(me); return sz;
    };
    const bild = new THREE.Scene(); const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material); mesh.frustumCulled = false; bild.add(mesh);
    const aoBild = new THREE.Scene(); const aoMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), aoMaterial); aoMesh.frustumCulled = false; aoBild.add(aoMesh);
    const kam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const taaMaterial = TAA_AN ? new THREE.ShaderMaterial({
      vertexShader: SCHEITEL, fragmentShader: TAA_FRAGMENT.replace('__TIEFE__', TIEFE_GLSL),
      uniforms: {
        tAktuell: { value: null }, tVerlauf: { value: null }, tTiefe: { value: null },
        uNah: { value: 0.2 }, uFern: { value: 1000 }, uTexel: { value: new THREE.Vector2() },
        uTanHalb: { value: new THREE.Vector2(1, 1) }, uKameraWelt: { value: new THREE.Matrix4() },
        uVorherVP: { value: new THREE.Matrix4() }, uErste: { value: 1 }, uMischung: { value: 0.12 },
      },
      depthTest: false, depthWrite: false,
    }) : null;
    const ausgabeMaterial = TAA_AN ? new THREE.ShaderMaterial({
      vertexShader: SCHEITEL, fragmentShader: TAA_AUSGABE, uniforms: { tQuelle: { value: null } },
      depthTest: false, depthWrite: false,
    }) : null;
    return { material, aoMaterial, hellMaterial, schachtMaterial, weichMaterial, bild, aoBild,
      hellBild: vollbild(hellMaterial), schachtBild: vollbild(schachtMaterial), weichBild: vollbild(weichMaterial), kam,
      taaMaterial, ausgabeMaterial,
      taaBild: taaMaterial ? vollbild(taaMaterial) : null, ausgabeBild: ausgabeMaterial ? vollbild(ausgabeMaterial) : null };
  }, [an, staerke, schwelle, ao, aoRadius, dpr]);
  useEffect(() => () => {
    quad.material.dispose(); quad.aoMaterial.dispose();
    quad.hellMaterial.dispose(); quad.schachtMaterial.dispose(); quad.weichMaterial.dispose();
    quad.taaMaterial?.dispose(); quad.ausgabeMaterial?.dispose();
  }, [quad]);
  const sonnenFarbeLinear = useMemo(() => new THREE.Color(sonnenFarbe), [sonnenFarbe]);
  const hilf = useMemo(() => ({ v: new THREE.Vector3(), vor: new THREE.Vector3() }), []);

  // Prioritaet 1 uebernimmt das Zeichnen von fiber — auch wenn der Pass aus ist,
  // damit der Vergleich A/B denselben Weg nimmt und nur der Pass fehlt.
  // fiber setzt `gl.info` je `render()` zurueck — nach dem Quad staende im HUD
  // „2 Dreiecke, 1 Aufruf". Deshalb von Hand: einmal je Bild, vor der Szene.
  useEffect(() => { gl.info.autoReset = false; return () => { gl.info.autoReset = true; }; }, [gl]);
  useFrame(() => {
    gl.info.reset();
    if (!passAn) { gl.setRenderTarget(null); gl.render(scene, camera); return; }
    const k = camera as THREE.PerspectiveCamera;
    const taaAn = !!(TAA_AN && ziel.komp && ziel.verlauf && quad.taaBild && quad.ausgabeBild);
    gl.setRenderTarget(ziel.rt);
    if (taaAn) {
      // Teilbildpunkt-Versatz der Projektion für dieses Bild; danach zurück, damit nichts ausserhalb
      // (Zielsuche, Culling in anderen Systemen) die verschobene Matrix sieht.
      const s = (taa.bild % 8) + 1;
      k.setViewOffset(ziel.rt.width, ziel.rt.height, halton(s, 2), halton(s, 3), ziel.rt.width, ziel.rt.height);
    }
    gl.render(scene, camera);
    if (taaAn) { k.clearViewOffset(); taa.jetztVP.multiplyMatrices(k.projectionMatrix, k.matrixWorldInverse); }
    if (aoAn) {
      const ua = quad.aoMaterial.uniforms;
      ua.tTiefe.value = ziel.rt.depthTexture;
      ua.uNah.value = k.near; ua.uFern.value = k.far;
      const th = Math.tan(k.fov * Math.PI / 360);
      ua.uTanHalb.value.set(th * k.aspect, th);
      gl.setRenderTarget(ziel.aoZiel);
      gl.render(quad.aoBild, quad.kam);
    }
    // D210: Sonne auf dem Bildschirm; hinter der Kamera oder weit ausserhalb kein Schacht.
    let schachtSichtbar = 0;
    if (hellAn) {
      const uh = quad.hellMaterial.uniforms;
      if (sonne) {
        hilf.v.set(sonne[0], sonne[1], sonne[2]).normalize();
        k.getWorldDirection(hilf.vor);
        schachtSichtbar = THREE.MathUtils.smoothstep(hilf.vor.dot(hilf.v), 0.15, 0.55);
        hilf.v.multiplyScalar(k.far * 0.5).add(k.position).project(k);
        uh.uSonneUv.value.set(hilf.v.x * 0.5 + 0.5, hilf.v.y * 0.5 + 0.5);
        quad.schachtMaterial.uniforms.uSonneUv.value.copy(uh.uSonneUv.value);
      }
      uh.tFarbe.value = ziel.rt.texture; uh.tTiefe.value = ziel.rt.depthTexture;
      uh.uNah.value = k.near; uh.uFern.value = k.far;
      uh.uTexel.value.set(1 / ziel.rt.width, 1 / ziel.rt.height);
      uh.uSeiten.value = k.aspect;
      gl.setRenderTarget(ziel.hell);
      gl.render(quad.hellBild, quad.kam);
      if (schacht > 0 && schachtSichtbar > 0) {
        quad.schachtMaterial.uniforms.tHell.value = ziel.hell.texture;
        gl.setRenderTarget(ziel.schacht);
        gl.render(quad.schachtBild, quad.kam);
      }
      if (bloom > 0) {
        const uw = quad.weichMaterial.uniforms;
        uw.tQuelle.value = ziel.hell.texture; uw.uRichtung.value.set(1 / ziel.hell.width, 0);
        gl.setRenderTarget(ziel.weich); gl.render(quad.weichBild, quad.kam);
        uw.tQuelle.value = ziel.weich.texture; uw.uRichtung.value.set(0, 1 / ziel.hell.height);
        gl.setRenderTarget(ziel.hell); gl.render(quad.weichBild, quad.kam);
      }
    }
    gl.setRenderTarget(taaAn ? ziel.komp : null);
    const u = quad.material.uniforms;
    u.tBloom.value = bloom > 0 ? ziel.hell.texture : null;
    u.uBloom.value = bloom;
    const schachtWert = schacht * schachtSichtbar;
    u.tSchacht.value = schachtWert > 0 ? ziel.schacht.texture : null;
    u.uSchacht.value.copy(sonnenFarbeLinear).multiplyScalar(schachtWert);
    u.tFarbe.value = ziel.rt.texture;
    u.tTiefe.value = ziel.rt.depthTexture;
    u.tAO.value = aoAn ? ziel.aoZiel.texture : null;
    u.uAO.value = aoAn ? ao : 0;
    u.uTexel.value.set(1 / ziel.rt.width, 1 / ziel.rt.height);
    u.uTexelAO.value.set(1 / ziel.aoZiel.width, 1 / ziel.aoZiel.height);
    u.uNah.value = k.near; u.uFern.value = k.far;
    gl.render(quad.bild, quad.kam);
    if (taaAn && quad.taaMaterial && quad.ausgabeMaterial) {
      // Zeitauflösung: Komposition + Vorbild → neues Verlaufsbild; das geht mit Tone Mapping auf den Schirm.
      const v = ziel.verlauf!, jetzt = v[taa.index], vorher = v[1 - taa.index];
      const ut = quad.taaMaterial.uniforms;
      ut.tAktuell.value = ziel.komp!.texture; ut.tVerlauf.value = vorher.texture;
      ut.tTiefe.value = ziel.rt.depthTexture;
      ut.uNah.value = k.near; ut.uFern.value = k.far;
      ut.uTexel.value.set(1 / ziel.rt.width, 1 / ziel.rt.height);
      const th = Math.tan(k.fov * Math.PI / 360);
      ut.uTanHalb.value.set(th * k.aspect, th);
      ut.uKameraWelt.value.copy(k.matrixWorld);
      ut.uVorherVP.value.copy(taa.vorherVP);
      ut.uErste.value = taa.erste ? 1 : 0;
      gl.setRenderTarget(jetzt);
      gl.render(quad.taaBild!, quad.kam);
      quad.ausgabeMaterial.uniforms.tQuelle.value = jetzt.texture;
      gl.setRenderTarget(null);
      gl.render(quad.ausgabeBild!, quad.kam);
      taa.vorherVP.copy(taa.jetztVP);
      taa.index = 1 - taa.index; taa.bild++; taa.erste = false;
    }
  }, 1);

  return null;
}
