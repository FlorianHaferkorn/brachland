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
import { GRAS_ECHT, GRAS_FEIN, GRAS_VIEL, PINSEL_AN } from './echt.js';
import { ladeHorstAtlas, leereHorstTextur, HORST_BLUME, HORST_GRUEN, HORST_HALM, HORST_KRAUT, HORST_SCHWELLE, HORST_STROH, HORST_ZAHL } from './grashorst.js';
import { PINSEL_BAND_GLSL } from './pinsel.js';
import type { Biom } from './osm.js';
import type { HoehenFeld } from './lod.js';

/** Halbe Kantenlänge des Halmfelds in Metern. */
export const TEPPICH_HALB = 30;
/** Halmzelle in Metern bei voller Qualität — ein Halm je Zelle, also 25 je m². */
export const TEPPICH_ZELLE = 0.2;
/**
 * D266: Mit `GRAS_ECHT` 0,15 m (44 statt 25 Halme je m² im 30-m-Teppich). Zwischen 12 und 30 m las die
 * Wiese mit 25 je m² als einzelne Sprossen. Kostet ~0,35 Mio Dreiecke mehr; am M1 zu messen (A-16).
 */
export const TEPPICH_ZELLE_ECHT = 0.15;
/** D272 (`?gras=3`): Foto-Büschel statt Halme — Zelle 15 cm im Teppich (44 Büschel je m²), 12 cm im Nahfeld (69 je m²). */
export const TEPPICH_ZELLE_FEIN = 0.15;
export const NAH_ZELLE_FEIN = 0.12;
/** Ab dieser Bewegung wird die Feldtextur neu gefüllt. */
export const TEPPICH_NACHZIEHEN = 4;
/**
 * G-141: So viele Millisekunden je Bild dürfen alle Ringe zusammen nachziehen. 3 ms lassen bei 60 Hz
 * gut 13 ms fürs Bild; die Füllung des 30-m-Teppichs verteilt sich damit auf ~15–20 Bilder.
 */
export const TEPPICH_FRIST_MS = 3;
/**
 * D235: Nahfeld für die dichte Wiese — zweite Halmschicht bis 12 m mit 7-cm-Zelle (~200 Halme je m²
 * bei Dichte 1), über dem 30-m-Teppich. Nur auf voller Qualität (`Qualitaet.gras` ≥ 1).
 */
export const NAH_HALB = 12;
/**
 * D247: Fernring für die Sichtweite „weit“ (`Qualitaet.weite`) — gröbere Zelle, breitere Halme,
 * innen ausgespart und genau dort eingeblendet, wo der 30-m-Teppich ausblendet. Nah- und
 * Mittelfeld bleiben damit Halm für Halm wie bisher; nur dahinter steht jetzt noch Wiese.
 */
export const FERN_ZELLE = 0.45;
export const NAH_ZELLE = 0.07;
/**
 * D268 (`?gras=1` / `?echt=1`): Nahfeld auf 8 m verkürzt und auf 4,5-cm-Zelle verdichtet (~490 statt ~200
 * Halme je m²) bei **gleich vielen Instanzen** (356² gegen 343²) — Wiese wie Rasen, wo man sie anfasst,
 * und dünnere Halme (Faktor `NAH_BREITE_ECHT`). Dahinter übernimmt der 30-m-Teppich mit 15 cm (D266).
 */
export const NAH_HALB_ECHT = 8;
export const NAH_ZELLE_ECHT = 0.045;
const NAH_BREITE_ECHT = 0.7;

/** Wie dicht Gras je Biom steht (0…1). Wald trägt Moos und Farn, kein Rasen. */
const DICHTE: Record<Biom, number> = {
  wiese: 1.0, gebuesch: 0.75, wald: 0.22, acker: 0.45, ruine: 0.55,
  siedlung: 0.4, industrie: 0.25, fels: 0.12, unbekannt: 0.35, wasser: 0,
  // G-143: Hochmoor trägt Wollgras und Pfeifengras in Bulten, dazwischen Torfmoos ohne Halm.
  moor: 0.6,
};
/** Halmhöhe je Biom in Metern (Mittel); ungemähte Wiese steht höher als Hof und Waldrand. */
const HOEHE: Record<Biom, number> = {
  wiese: 0.55, gebuesch: 0.5, wald: 0.3, acker: 0.4, ruine: 0.45,
  siedlung: 0.25, industrie: 0.3, fels: 0.2, unbekannt: 0.35, wasser: 0, moor: 0.4,
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
  // Wert egal, der Vertex-Shader setzt `objectNormal` selbst. Ohne das Attribut schaltet three
  // ab r18x auf FLAT_SHADED, dann fehlt `vNormal` und der Teppich kompiliert nicht (ADR-0015).
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

/**
 * D272: Zwei gekreuzte Karten je Instanz (je 2 Höhenstufen für die Biegung), `position.z` kennzeichnet
 * die Karte (0/1) und wählt im Shader die Achse; `uv.y` = 1 − Höhe (Zeile 0 der Textur ist oben).
 */
function baueHorst(): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let k = 0; k < 2; k++) {
    const o = pos.length / 3;
    for (const y of [0, 0.5, 1]) for (const x of [-1, 1]) { pos.push(x, y, k); uv.push((x + 1) / 2, 1 - y); }
    idx.push(o, o + 1, o + 3, o, o + 3, o + 2, o + 2, o + 3, o + 5, o + 2, o + 5, o + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export interface Grasteppich {
  mesh: THREE.Mesh;
  /** Je Bild: Zeit und Kamera für Wind und Randausblendung. */
  setzeZeit(t: number): void;
  /**
   * Feld um (mx, mz) neu füllen, wenn weit genug gegangen (G-141). Gefüllt wird zeilenweise in einen
   * Hinterpuffer, bis `frist` (`performance.now()`) erreicht ist — mindestens eine Zeile je Aufruf;
   * erst die volle Füllung wird sichtbar. Ohne `frist` alles in einem Zug (erstes Bild).
   * Gibt true zurück, solange in diesem Aufruf gefüllt wurde.
   */
  ziehNach(mx: number, mz: number, frist?: number): boolean;
  dispose(): void;
}

/**
 * Grasteppich bauen. `faktor` ist die Qualitätsstufe (`Qualitaet.gras`): Bei 0,5 ist die Zelle
 * √2-mal so gross, also halb so viele Halme.
 */
export function baueGrasteppich(
  feld: HoehenFeld, aufWeg: (x: number, z: number) => boolean, faktor = 1,
  halb = TEPPICH_HALB, grundZelle = GRAS_FEIN ? TEPPICH_ZELLE_FEIN : GRAS_ECHT ? TEPPICH_ZELLE_ECHT : TEPPICH_ZELLE,
  /** Fernring (D247): halbe Kantenlänge des inneren Teppichs, der hier ausgespart wird. 0 = keiner. */
  innen = 0,
  /**
   * Meter je Feldtexel. 1 für die inneren Ringe; der Fernring nimmt 3 — bei 1 m kostete sein
   * Nachziehen gemessen 260–330 ms (23.000 Texel), ein Ruckler alle zehn Meter Lauf (D247).
   */
  texel = 1,
): Grasteppich {
  // D255: gezielte Vergleichsprobe; ohne Parameter bleibt der bestehende Look.
  // Alle Ringe verwenden denselben ortsfesten Faktor, ohne neue Geometrie.
  const strukturAn = typeof location !== 'undefined' && new URLSearchParams(location.search).get('grasstruktur') === '1';
  /** Texel der Feldtextur je Kante, mit Rand über das Halmfeld hinaus. */
  const FELD_TEXEL = 2 * Math.ceil((halb + 4) / texel);
  const zelle = grundZelle / Math.sqrt(Math.max(0.1, faktor));
  const n = Math.ceil((2 * halb) / zelle);
  const halm = GRAS_FEIN ? baueHorst() : baueHalm();
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = halm.index;
  geo.setAttribute('position', halm.getAttribute('position'));
  geo.setAttribute('normal', halm.getAttribute('normal'));
  if (GRAS_FEIN) geo.setAttribute('uv', halm.getAttribute('uv'));
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
    uKarte: { value: GRAS_FEIN ? leereHorstTextur() : null },
    /** D272: Rechteck je Kachel im Atlas (x, y, Breite, Höhe) und ihre Kantenlänge in Metern. */
    uKachel: { value: Array.from({ length: HORST_ZAHL }, () => new THREE.Vector4(0, 0, 1, 1)) },
    uKachelGr: { value: new Float32Array(HORST_ZAHL).fill(0.25) },
  };
  if (GRAS_FEIN) {
    void ladeHorstAtlas().then((a) => {
      uniforms.uKarte.value = a.textur;
      a.kacheln.slice(0, HORST_ZAHL).forEach((k, i) => { uniforms.uKachel.value[i].set(...k.rect); uniforms.uKachelGr.value[i] = k.groesse; });
    });
  }

  const material = new THREE.MeshStandardMaterial({
    // D266: Mit `GRAS_ECHT` matt — bei 0,85 glänzte jede Spitze im Streiflicht grau-weiss.
    vertexColors: false, roughness: GRAS_ECHT ? 1 : 0.85, metalness: 0, side: THREE.DoubleSide,
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
varying float vHalmY;
varying float vQ;
varying vec2 vKartenUv;
uniform sampler2D uKarte;
uniform vec4 uKachel[${HORST_ZAHL}];
uniform float uKachelGr[${HORST_ZAHL}];
float halmHash(vec2 p) { p = mod(p, 4096.0); return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float halmRauschen(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(halmHash(i), halmHash(i + vec2(1.0, 0.0)), f.x),
             mix(halmHash(i + vec2(0.0, 1.0)), halmHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// Bilinear von Hand: Float-Texturen filtern nicht überall linear.
vec4 bilinear(sampler2D tex, vec2 welt) {
  vec2 t = (welt - uFeldUrsprung.xy) / ${texel.toFixed(1)} - 0.5;
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
  float rand = ${innen > 0
    // Fernring: blendet ein, wo der innere Teppich ausblendet (dieselbe Kurve), und läuft spät aus.
    ? `smoothstep(${(innen * 0.45).toFixed(1)}, ${(innen * 0.98).toFixed(1)}, abst)
      * (1.0 - smoothstep(${(halb * 0.7).toFixed(1)}, ${(halb * 0.98).toFixed(1)}, abst))`
    : `1.0 - smoothstep(${(halb * 0.45).toFixed(1)}, ${(halb * 0.98).toFixed(1)}, abst)`};
  // D225: Wo wenig Gras steht (Wald, Acker), wächst es in Horsten (~5 m) mit kahlen Stellen
  // dazwischen — dort zeigt sich der gescannte Boden (D223). Volle Wiese (Dichte 1) bleibt geschlossen.
  float horst = smoothstep(0.4, 0.75, halmRauschen(ort * 0.18 + 3.7)) * 1.8;
  float dicht = boden.g * mix(1.0, horst, 1.0 - boden.g);
  ${strukturAn ? `
  // Besonders volle Wiesen erhalten zusammenhaengende, sanfte Hoehen- und
  // Dichteunterschiede. Die Maske bleibt am Weltort verankert und veraendert
  // keine Weg-, Wasser- oder Bauwerksfreihaltung; null Dichte bleibt null.
  float wiesenAnteil = smoothstep(0.7, 0.95, boden.g);
  float wiesenStruktur = clamp(horst / 1.8, 0.0, 1.0);
  dicht *= mix(1.0, mix(0.82, 1.0, wiesenStruktur), wiesenAnteil);
  ` : ''}
  ${GRAS_VIEL ? `
  // D271: Arten in ~10-m-Flecken (Stroh), Kraut in kleineren (~5 m) mit je Halm 35 % Anteil.
  // Büschel: Rauschen auf ~1,2 m lässt 45 % der Dichte zwischen den Horsten stehen — der Boden scheint durch.
  float stroh = smoothstep(${GRAS_FEIN ? '0.58, 0.70' : '0.52, 0.66'}, halmRauschen(ort * 0.09 + 19.0));
  float kraut = (1.0 - stroh) * step(0.62, halmRauschen(ort * 0.2 + 51.0)) * step(h2, 0.35);
  dicht *= mix(${GRAS_FEIN ? '0.3' : '0.55'}, 1.0, smoothstep(0.3, 0.55, halmRauschen(ort * 0.8 + 71.0)));` : ''}
  ${GRAS_FEIN ? `
  // D272: Kachel je Weltzelle — grüne Büschel im Normalfall, trockene in den Strohflecken.
  // D272: Kachel je Weltzelle — grüne Büschel im Normalfall, trockene in Strohflecken, Kraut in Krautflecken
  // (35 % der Zellen dort), Blüten als Akzent in 3 % aller Zellen.
  float h6 = halmHash(zelleW + 5.7), h7 = halmHash(zelleW + 11.3);
  int kachel = min(int(h6 * ${HORST_GRUEN}.0), ${HORST_GRUEN - 1});
  if (stroh > 0.5) kachel = ${HORST_GRUEN} + min(int(h6 * ${HORST_STROH}.0), ${HORST_STROH - 1});
  else if (kraut > 0.5) kachel = ${HORST_GRUEN + HORST_STROH} + min(int(h6 * ${HORST_KRAUT}.0), ${HORST_KRAUT - 1});
  if (h7 >= 0.06 && h7 < 0.10) kachel = ${HORST_GRUEN + HORST_STROH + HORST_KRAUT + HORST_BLUME} + min(int(h6 * ${HORST_HALM}.0), ${HORST_HALM - 1});   // 4 %: Halme mit Samenständen
  if (h7 < 0.06) kachel = ${HORST_GRUEN + HORST_STROH + HORST_KRAUT} + min(int(h6 * ${HORST_BLUME}.0), ${HORST_BLUME - 1});
  bool strohKachel = kachel >= ${HORST_GRUEN} && kachel < ${HORST_GRUEN + HORST_STROH};
  bool blumeKachel = kachel >= ${HORST_GRUEN + HORST_STROH + HORST_KRAUT};` : ''}
  // Dichte als Schwelle: stabil am Ort, kein Flackern beim Nachziehen.
  float da = step(h3, dicht) * rand;
  ${GRAS_FEIN && innen === 0 ? `// D272: Ab 7 m bleibt nur jede vierte Zelle, dafür doppelt so breit und hoch (Ghost of Tsushima: 3 von 4 Halmen
  // fallen weg) — ein Büschel hat dann mehr Pixel, die Mip-Stufe sinkt, der Rand bleibt scharf.
  float spreiz = smoothstep(7.0, 14.0, abst);
  da *= step(halmHash(zelleW + 23.1), mix(1.0, 0.25, spreiz));` : ''}
  float hoehe = boden.b * (0.55 + h4 * 0.9) * da;
  ${strukturAn ? 'hoehe *= mix(1.0, mix(0.78, 1.05, wiesenStruktur), wiesenAnteil);' : ''}
  ${GRAS_ECHT ? `
  // D266: Büschel. Gras wächst in Horsten von Handbreite bis Armlänge, nicht als Teppich gleicher
  // Höhe — zwei Rauschlagen (70 cm, 3 m) heben und senken die Halme.
  float buschel = halmRauschen(ort * 1.4 + 11.0) * 0.65 + halmRauschen(ort * 0.33 + 2.0) * 0.35;
  hoehe *= 0.45 + 1.1 * buschel;` : ''}
  ${GRAS_VIEL ? 'hoehe *= mix(1.0, 1.7, stroh) * mix(1.0, 0.6, kraut);' : ''}
  // Im Fernring breiter: Ein 2-cm-Halm ist auf 50 m kleiner als ein Pixel und flimmert nur.
  float breite = (0.012 + h5 * 0.012) * ${PINSEL_AN ? '1.9 * ' : ''}${innen > 0 ? (grundZelle / TEPPICH_ZELLE).toFixed(2) : GRAS_ECHT && halb === NAH_HALB_ECHT ? NAH_BREITE_ECHT.toFixed(2) : '1.0'};
  ${GRAS_VIEL && !GRAS_FEIN ? 'breite *= mix(1.0, 0.6, stroh) * mix(1.0, 3.2, kraut);' : ''}
  ${GRAS_FEIN ? `
  // D272: quadratische Karte; Grösse = Kachelmass × Zufall × Bodenhöhe × Büschelhöhe × Zellgrösse/20 cm
  // (grössere Zellen, Fernring, bekommen grössere Büschel, damit sie sich schliessen); Faktor 1,5: Wiese, nicht Rasen.
  float gr = 1.5 * uKachelGr[kachel] * (0.75 + 0.6 * h4) * clamp(boden.b / 0.55, 0.45, 1.4) * (0.6 + 0.8 * buschel)
           * ${(zelle / 0.15).toFixed(3)} * mix(1.0, 1.25, stroh) * boden.a * (blumeKachel ? 1.2 : 1.0)${innen === 0 ? ' * mix(1.0, 2.0, spreiz)' : ''};
  hoehe = gr * da;
  breite = gr * 0.5;` : ''}
  float winkel = h1 * 6.2832;
  vec2 quer = vec2(cos(winkel), sin(winkel));
  vec2 vor = vec2(-quer.y, quer.x);
  vec2 ach = ${GRAS_FEIN ? 'position.z > 0.5 ? vor : quer' : 'quer'};   // D272: zweite Karte steht quer zur ersten
  // Wind: eine Welle, die über das Feld läuft, plus Böen aus Rauschen, plus Eigenzittern.
  vec2 windRichtung = normalize(vec2(0.8, 0.6));
  float welle = sin(dot(ort, windRichtung) * 0.35 - uZeit * 1.6) * 0.5 + 0.5;
  float boe = halmRauschen(ort * 0.05 - windRichtung * uZeit * 0.4);
  float zittern = sin(uZeit * 3.1 + h2 * 20.0) * 0.08;
  float neigung = (0.18 + h3 * 0.35)${GRAS_VIEL ? ' * mix(mix(1.0, 1.8, stroh), 0.6, kraut)' : ''};
  float y = position.y;
  vec2 biege = vor * neigung * y * y + windRichtung * (welle * 0.35 + boe * 0.45 + zittern) * y * y;
  vec3 halmPos = vec3(ort.x + ach.x * position.x * breite + biege.x * hoehe,
                      boden.r + y * hoehe * (1.0 - 0.25 * length(biege)),
                      ort.y + ach.y * position.x * breite + biege.y * hoehe);
  // Farbe: aus dem Boden heraus, zur Spitze grüner und heller; trockene Flecken (Rauschen 30 m)
  // gehen ins Strohfarbene. Zum Ringrand hin ganz Bodenfarbe — der Übergang hat keine Kante.
  float trocken = smoothstep(0.55, 0.85, halmRauschen(ort * 0.033 + 5.0)) * 0.7 + h4 * 0.15;
  vec3 gruen = mix(bodenTon, uSpitze, 0.55);
  vec3 spitze = mix(gruen, vec3(0.62, 0.55, 0.34), trocken) * (0.9 + h5 * 0.25);
  vec3 fuss = bodenTon * 0.8;
  float zumBoden = smoothstep(${(halb * (innen > 0 ? 0.5 : 0.3)).toFixed(1)}, ${(halb * (innen > 0 ? 0.95 : 0.9)).toFixed(1)}, abst);
  ${GRAS_ECHT ? `
  // D266: Grün statt Grau. Zwei Grüntöne in 4-m-Flecken (sattes Wiesengrün, gelbgrün), je Halm
  // ±15 % Helligkeit; trocken bleibt Stroh. Die Basis tief dunkel: Im Rasen kommt unten kaum Licht an.
  float fleck = halmRauschen(ort * 0.25 + 7.0);
  vec3 sattGruen = mix(vec3(0.075, 0.16, 0.03), vec3(0.17, 0.24, 0.05), fleck);
  spitze = mix(mix(sattGruen, gruen, 0.35), vec3(0.45, 0.40, 0.22), trocken) * (0.85 + h5 * 0.3);
  fuss = bodenTon * 0.35;` : ''}
  ${GRAS_VIEL ? `
  // D271: Farbe nach Art, leicht entsättigt. Stroh ist unten nicht dunkel (trockener Halm), Kraut olivgrün.
  vec3 strohF = mix(vec3(0.50, 0.42, 0.22), vec3(0.62, 0.53, 0.30), h5);
  vec3 krautF = mix(vec3(0.20, 0.27, 0.09), vec3(0.30, 0.36, 0.14), h5);
  vec3 graeser = mix(vec3(0.10, 0.17, 0.05), vec3(0.22, 0.28, 0.09), fleck);
  vec3 artFarbe = mix(mix(graeser, strohF, stroh), krautF, kraut);
  artFarbe = mix(vec3(dot(artFarbe, vec3(0.299, 0.587, 0.114))), artFarbe, 0.85);
  spitze = artFarbe * (0.85 + h5 * 0.3);
  fuss = mix(bodenTon * 0.35, strohF * 0.45, stroh);
  vQ = position.x / max(1.0 - 0.75 * y, 0.05);` : 'vQ = 0.0;'}
  ${GRAS_FEIN ? `vec4 kr = uKachel[kachel];
  vKartenUv = vec2(kr.x + uv.x * kr.z, (1.0 - kr.y - kr.w) + uv.y * kr.w);` : 'vKartenUv = vec2(0.0);'}
  vHalmFarbe = mix(mix(fuss, spitze, smoothstep(0.0, 1.0, y)), bodenTon, zumBoden);
  vHalmY = y * (1.0 - zumBoden);
  ${GRAS_FEIN ? `// D272: Helligkeit je Büschel; grüne Kacheln saftiger (Grün ×1,3, Blau ×0,85), Stroh ×0,8, Kraut leicht grüner.
  vHalmFarbe = vec3(0.8 + 0.4 * h5) * (strohKachel ? vec3(0.8) : kachel < ${HORST_GRUEN} ? vec3(1.15, 1.3, 0.85) : vec3(1.05, 1.15, 0.9));` : ''}
  vec3 objectNormal = normalize(mix(vec3(vor.x, 0.0, vor.y), vec3(0.0, 1.0, 0.0), 0.82));
  #ifdef USE_TANGENT
    vec3 objectTangent = vec3(1.0, 0.0, 0.0);
  #endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = halmPos;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHalmFarbe;\nvarying float vHalmY;\nvarying float vQ;\nvarying vec2 vKartenUv;\nuniform sampler2D uKarte;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = vHalmFarbe;' + (GRAS_FEIN ? `
  { vec4 horst = texture2D(uKarte, vKartenUv);   // D272: Foto-Büschel — Farbe, Deckung, Verdeckung am Fuss
    diffuseColor.rgb = vHalmFarbe * horst.rgb * 1.9 * mix(0.55, 1.0, smoothstep(0.0, 0.5, vHalmY));   // 1,9: Foto-Albedo (Mittel 0,125 linear) auf die Helligkeit der Szene (alte Spitze ~0,3); 2,4 überbelichtete
    diffuseColor.a = horst.a; }` : '') + (GRAS_VIEL && !GRAS_FEIN ? `
  { float kante = abs(vQ);   // D271: Kante dunkler, Mittelrippe heller — der Halm hat Körper statt Flachband
    diffuseColor.rgb *= (1.0 - 0.3 * kante * kante) * (1.0 + 0.18 * (1.0 - smoothstep(0.0, 0.12, kante))); }` : ''))
      // Beide Seiten mit derselben (nach oben gekippten) Normale: three dreht sie für die
      // Rückseite um, dann zeigte sie in den Boden und der halbe Rasen wäre schwarz.
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);')
      // D269 (`?malerei=1`): drei Farbbänder statt weichem Verlauf, Halme als breite Striche.
      .replace('#include <opaque_fragment>', PINSEL_AN ? PINSEL_BAND_GLSL + '\n#include <opaque_fragment>' : '#include <opaque_fragment>')
      // D266: Durchlicht — steht die Sonne hinter dem Halm, leuchtet die Spitze (Gras ist dünn).
      .replace('#include <lights_fragment_end>', GRAS_ECHT ? `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
  {
    vec3 sonne = directionalLights[ 0 ].direction;
    float gegen = saturate(dot(-normalize(vViewPosition), sonne));
    reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[ 0 ].color * 0.55 * pow(gegen, 3.0) * vHalmY;
  }
#endif` : '#include <lights_fragment_end>');
  };
  material.customProgramCacheKey = () => `brachland-grasteppich-v4-${halb}-${innen}-${texel}-${strukturAn ? 'struktur' : 'standard'}${GRAS_ECHT ? '-echt' : ''}${GRAS_VIEL ? '-viel' : ''}${GRAS_FEIN ? '-fein' : ''}${PINSEL_AN ? '-pinsel' : ''}`;

  // D272: Halmkarten mit Alpha-Test; mit MSAA (Kontur) weiche Kanten über alphaToCoverage.
  if (GRAS_FEIN) { material.alphaTest = HORST_SCHWELLE; material.alphaToCoverage = true; }
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = innen > 0 ? 'Grasteppich-fern' : halb === TEPPICH_HALB ? 'Grasteppich' : 'Grasteppich-nah';
  // Der Fernring füllt (2·halb+8)² Texel — bei 72 m rund 23.000 statt 4.600. Seltener nachziehen;
  // sein Rand liegt im Auslauf, dort sieht man ein paar Meter Versatz nicht.
  const nachziehen = TEPPICH_NACHZIEHEN * Math.max(1, halb / TEPPICH_HALB);

  // G-141: Das Füllen kostete gemessen 49–59 ms in einem Bild, alle 4 m Lauf. Jetzt läuft es
  // zeilenweise über mehrere Bilder in diese Hinterpuffer; die Texturen tauschen erst, wenn alles
  // steht. Der Rand von 4 m über das Halmfeld hinaus trägt die Bilder dazwischen.
  const datenNeu = new Float32Array(daten.length), tonNeu = new Float32Array(ton.length);
  const letzte = new THREE.Vector2(NaN, NaN);
  /** Laufende Füllung: Ursprung, Mitte und nächste Zeile; `zeile < 0` heisst keine. */
  const lauf = { x0: 0, z0: 0, mx: 0, mz: 0, zeile: -1 };

  function fuelleZeile(i: number): void {
    for (let j = 0; j < FELD_TEXEL; j++) {
      const x = lauf.x0 + (j + 0.5) * texel, z = lauf.z0 + (i + 0.5) * texel, k = (i * FELD_TEXEL + j) * 4;
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
      // D272: Alpha = Höhenfaktor. Kürzer (×0,55) wo ein Weg bis 1,5 m, ×0,7 wo Wasser bis 2 m entfernt liegt —
      // Wegrand und Ufer sind betreten bzw. nass, dort steht kein Hochgras.
      let hf = 1;
      if (GRAS_FEIN && d > 0) {
        if (aufWeg(x + 1.5, z) || aufWeg(x - 1.5, z) || aufWeg(x, z + 1.5) || aufWeg(x, z - 1.5)) hf = 0.55;
        else if (feld.wasserTiefe(x + 2, z) > 0.02 || feld.wasserTiefe(x - 2, z) > 0.02
          || feld.wasserTiefe(x, z + 2) > 0.02 || feld.wasserTiefe(x, z - 2) > 0.02) hf = 0.7;
      }
      datenNeu[k] = h; datenNeu[k + 1] = d; datenNeu[k + 2] = HOEHE[biom] ?? 0; datenNeu[k + 3] = hf;
      feld.bodenfarbe(x, z, farbe);
      tonNeu[k] = farbe.r; tonNeu[k + 1] = farbe.g; tonNeu[k + 2] = farbe.b; tonNeu[k + 3] = 1;
    }
  }

  function ziehNach(mx: number, mz: number, frist = Infinity): boolean {
    uniforms.uMitte.value.set(mx, mz);
    if (lauf.zeile < 0) {
      if (Math.hypot(mx - letzte.x, mz - letzte.y) < nachziehen) return false;
      letzte.set(mx, mz);
      lauf.mx = mx; lauf.mz = mz; lauf.zeile = 0;
      lauf.x0 = (Math.floor(mx / texel) - FELD_TEXEL / 2) * texel;
      lauf.z0 = (Math.floor(mz / texel) - FELD_TEXEL / 2) * texel;
    }
    do fuelleZeile(lauf.zeile++);
    while (lauf.zeile < FELD_TEXEL && performance.now() < frist);
    if (lauf.zeile < FELD_TEXEL) return true;
    lauf.zeile = -1;
    daten.set(datenNeu); ton.set(tonNeu);
    uniforms.uFeldUrsprung.value.set(lauf.x0, lauf.z0, 1 / FELD_TEXEL);
    uniforms.uRaster.value.set(Math.round(lauf.mx / zelle), Math.round(lauf.mz / zelle), zelle);
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
