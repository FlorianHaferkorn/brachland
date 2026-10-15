/**
 * BRACHLAND — Bodenmaterial mit prozeduraler Oberflächenvariation
 *
 * Das Problem: Der Boden ist Vertex-Farbe je Dreieck. Bei LOD0 sind das 2-m-Quads,
 * darüber 4, 8, 16 m — Flächen, die als Flächen lesen. Ohne Textur fehlt genau die
 * Ebene zwischen „Geometrie" und „Farbe", auf der ein Auge Oberfläche erkennt.
 *
 * Die Lösung greift ADR-0002 nicht an. „Keine Texturen" heißt dort: keine
 * Textur-*Assets* — wegen des 60-MB-Offline-Budgets und weil Texturen einen
 * Art-Stil erzwingen, den ein Solo-Projekt nicht durchhält. Rauschen im Shader
 * kostet **null Bytes** und wird aus der Weltposition berechnet, ist also über
 * Kachelgrenzen und LOD-Stufen hinweg stabil.
 *
 * Zwei Oktaven mit Absicht:
 * - fein (~1,4 m): bricht die einzelne Fläche auf, wirkt nur im Nahbereich
 * - grob (~9 m): Flecken, die auch auf Entfernung Struktur geben und die
 *   Kachelgrenzen optisch übertönen
 */
import * as THREE from 'three';
import { HIMMEL_UNIFORM } from './windmaterial.js';
import { PALETTE } from './palette.js';

/**
 * Himmelsanteil des Geländes um ein Set-Piece (D171, `tools/himmelboden.ts`): ein Raster von
 * 0,5 m, als Datentextur. Ein Slot — die Set-Pieces liegen über 1,5 km auseinander, sichtbar ist
 * immer höchstens eins. Ausserhalb des Rahmens (und ohne Raster) ist der Faktor 1.
 */
const LEER = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType);
LEER.needsUpdate = true;
const BODEN_HIMMEL = {
  karte: { value: LEER as THREE.Texture },
  /** x0, z0, 1/Breite, 1/Tiefe in Weltmetern; Breite 0 heisst: aus. */
  rahmen: { value: new THREE.Vector4(0, 0, 0, 0) },
};
let bodenHimmelName: string | null = null;

/** Raster des Set-Pieces `name` laden (oder mit `null` abschalten). Mehrfachaufruf ist billig. */
export function setzeBodenHimmel(name: string | null): void {
  if (name === bodenHimmelName) return;
  bodenHimmelName = name;
  if (!name) { BODEN_HIMMEL.rahmen.value.set(0, 0, 0, 0); return; }
  Promise.all([
    fetch(`/bauten/${name}-himmel.json`).then(r => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch(`/bauten/${name}-himmel.bin`).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))),
  ]).then(([m, bin]: [{ x0: number; z0: number; schritt: number; breite: number; tiefe: number }, ArrayBuffer]) => {
    if (bodenHimmelName !== name) return;
    const t = new THREE.DataTexture(new Uint8Array(bin), m.breite, m.tiefe, THREE.RedFormat, THREE.UnsignedByteType);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.unpackAlignment = 1;
    t.needsUpdate = true;
    const alt = BODEN_HIMMEL.karte.value;
    BODEN_HIMMEL.karte.value = t;
    if (alt !== LEER) alt.dispose();
    BODEN_HIMMEL.rahmen.value.set(m.x0, m.z0, 1 / (m.breite * m.schritt), 1 / (m.tiefe * m.schritt));
  }).catch(() => { /* kein Raster: Faktor 1 */ });
}

const HIMMEL_GLSL = /* glsl */ `
  // D171: Fülllicht dämpfen, wo Mauern und Kronen den Himmel verdecken. Zum Rand hin auf 1,
  // damit der Rahmen im Bild keine Kante zeichnet.
  if (uBodenRahmen.z > 0.0) {
    vec2 uvH = (vWeltPos.xz - uBodenRahmen.xy) * uBodenRahmen.zw;
    if (uvH.x > 0.0 && uvH.x < 1.0 && uvH.y > 0.0 && uvH.y < 1.0) {
      float kante = smoothstep(0.0, 0.03, min(min(uvH.x, 1.0 - uvH.x), min(uvH.y, 1.0 - uvH.y)));
      float sicht = mix(1.0, texture2D(uBodenHimmel, uvH).r, kante);
      reflectedLight.indirectDiffuse *= mix(1.0, sicht, uHimmel);
    }
  }
`;

const RAUSCH_GLSL = /* glsl */ `
varying vec3 vWeltPos;

float bodenHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float bodenRauschen(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = bodenHash(i);
  float b = bodenHash(i + vec2(1.0, 0.0));
  float c = bodenHash(i + vec2(0.0, 1.0));
  float d = bodenHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`;

/**
 * D216: Moos am Waldboden. Der Wald trug dieselbe Bodenvariation wie die Wiese; im Bild las er sich
 * als grüner Teppich ohne Unterschied. Moos sitzt in Polstern (Rauschen ~4 m und ~1,3 m), satter und
 * dunkler als der Boden, nur dort, wo die Bodenfarbe Wald ist (Abstand zur Biomfarbe — die Kachel
 * mischt Biome weich, D162, also läuft das Moos am Waldrand mit aus) und nicht am Steilhang.
 */
const MOOS_GLSL = /* glsl */ `
  float imWald = 1.0 - smoothstep(0.015, 0.06, distance(diffuseColor.rgb, uWaldTon));
  {
    float flach = smoothstep(0.75, 0.9, vWeltNormal.y);
    float polster = bodenRauschen(vWeltPos.xz * 0.25) * 0.65 + bodenRauschen(vWeltPos.xz * 0.77 + 9.1) * 0.35;
    float moos = smoothstep(0.45, 0.62, polster) * imWald * flach;
    vec3 moosTon = uMoos * (0.85 + bodenRauschen(vWeltPos.xz * 2.3) * 0.3);
    diffuseColor.rgb = mix(diffuseColor.rgb, moosTon, moos * 0.75);
    // Nadelstreu zwischen den Polstern: etwas brauner als der Biomton.
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 0.95, 0.8), imWald * (1.0 - moos) * 0.5);
  }
`;

const VARIATION_GLSL = /* glsl */ `
  float fein = bodenRauschen(vWeltPos.xz * 0.72);
  float grob = bodenRauschen(vWeltPos.xz * 0.115);

  // Helligkeit: fein bricht die Fläche, grob macht Flecken über größere Strecken.
  float helligkeit = 1.0 + (fein - 0.5) * 0.26 + (grob - 0.5) * 0.20;
  diffuseColor.rgb *= helligkeit;

  // Trockene Kuppen leicht ins Ockerfarbene, feuchte Senken ins Grüne.
  // Sehr zurückhaltend — der Biom-Farbton soll führen, nicht das Rauschen.
  vec3 trocken = vec3(1.06, 1.01, 0.88);
  vec3 feucht  = vec3(0.94, 1.03, 0.95);
  diffuseColor.rgb *= mix(feucht, trocken, grob);
`;

/**
 * D201: Fels an steilen Hängen, Schutt am Übergang. Bisher trug nur die Biomfarbe des Höhenrasters
 * den Hang — ein 35°-Hang im Wald war so grün wie der Talboden. Gesteuert über die **Weltnormale**
 * (seit D201 glatt aus dem Höhenfeld) mit verrauschter Schwelle, damit die Grenze keine Höhenlinie
 * zeichnet. Farben aus der Palette (`fels.b`, `fels.schutt`), nicht im Shader erfunden.
 */
/**
 * D223: Gescannte Bodenschichten (Poly Haven, CC0, Rob Tuytel; Herkunft in `assets/HERKUNFT.md`,
 * gepackt von 2K auf 1K). Ersetzt die Detailnormalen aus D206. Vier Schichten: Wiese
 * (`forrest_ground_01`), Waldboden (`forest_leaves_02`), Schutt (`rocks_ground_01`), Fels
 * (`mossy_rock`, triplanar). Je Schicht zwei Bilder:
 *
 * - `*-farbe.webp`: RGB ist **Modulation**, nicht Farbe — linear durch den Mittelwert des Scans
 *   geteilt, Mittel 0,5, als Wurzel gespeichert. Der Farbton kommt weiter aus Palette und Biom
 *   (Art Direction, ADR-0012), der Scan liefert Hell/Dunkel und Farbwechsel innerhalb davon.
 *   A ist die Höhe des Scans: Die Schichten mischen über sie (Steine ragen aus dem Schutt,
 *   Moos aus dem Laub), nicht über eine weiche Rampe.
 * - `*-normal.webp`: Normalen im OpenGL-Format.
 *
 * Gegen das Kachelmuster wird jede ebene Schicht zweimal gelesen (zweite Lage gedreht und
 * versetzt) und über Rauschen gewechselt. Bis die Bilder geladen sind, liegen neutrale Pixel
 * in den Slots — dann ändert sich nichts.
 */
const FLACH = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
FLACH.needsUpdate = true;
/** Modulation 1,0 (gespeichert √0,5 ≈ 181) und mittlere Höhe. */
const NEUTRAL = new THREE.DataTexture(new Uint8Array([181, 181, 181, 128]), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
NEUTRAL.needsUpdate = true;

const SCHICHTEN = ['wiese', 'waldboden', 'schutt', 'fels'] as const;
type Schicht = typeof SCHICHTEN[number];
const SCAN = Object.fromEntries(SCHICHTEN.map(n => [n, {
  farbe: { value: NEUTRAL as THREE.Texture },
  normal: { value: FLACH as THREE.Texture },
}])) as Record<Schicht, { farbe: { value: THREE.Texture }; normal: { value: THREE.Texture } }>;
let scanGeladen = false;

/** `?detail=0` schaltet die Scans ab — Vergleichsschalter (D206, seit D223 für alle Schichten). */
const DETAIL_AUS: boolean = (() => {
  if (typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).get('detail') === '0';
})();

function ladeScans(): void {
  if (scanGeladen || DETAIL_AUS || typeof document === 'undefined') return;
  scanGeladen = true;
  const lader = new THREE.TextureLoader();
  for (const n of SCHICHTEN)
    for (const art of ['farbe', 'normal'] as const)
      lader.load(`/material/${n}-${art}.webp`, (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = THREE.NoColorSpace;
        t.anisotropy = 8;
        SCAN[n][art].value = t;
      });
}

const SCAN_PARS_GLSL = /* glsl */ `
uniform sampler2D uWieseFarbe;
uniform sampler2D uWieseNormal;
uniform sampler2D uWaldbodenFarbe;
uniform sampler2D uWaldbodenNormal;
uniform sampler2D uSchuttFarbe;
uniform sampler2D uSchuttNormal;
uniform sampler2D uFelsFarbe;
uniform sampler2D uFelsNormal;

// Zweite Lage gegen das Kachelmuster: um ~53° gedreht und versetzt.
const mat2 SCAN_DREH = mat2(0.6, -0.8, 0.8, 0.6);
vec2 scanZweit(vec2 uv) { return SCAN_DREH * uv + vec2(0.37, 0.71); }

vec4 scanLesen(sampler2D t, vec2 uv, float wechsel) {
  return mix(texture2D(t, uv), texture2D(t, scanZweit(uv)), wechsel);
}

// Tangentennormale in uv-Lage; die gedrehte Lage wird zurückgedreht.
vec3 scanNormale(sampler2D t, vec2 uv, float wechsel) {
  vec3 a = texture2D(t, uv).xyz * 2.0 - 1.0;
  vec3 b = texture2D(t, scanZweit(uv)).xyz * 2.0 - 1.0;
  b.xy = transpose(SCAN_DREH) * b.xy;
  return normalize(mix(a, b, wechsel));
}

// Planare Draufsicht: Tangentennormale (u = x, v = z) auf die Weltnormale (Whiteout).
vec3 scanAufWelt(vec3 t, vec3 basisW) {
  return normalize(vec3(t.x + basisW.x, abs(t.z) * basisW.y, t.y + basisW.z));
}
`;

/** Weltmasse der Scans in Metern (Poly Haven `dimensions`), Fels zweifach gestreckt: Hänge sind gross. */
const SCAN_GLSL = /* glsl */ `
  vec2 uvWiese = vWeltPos.xz / 2.0;
  vec2 uvWald = vWeltPos.xz / 3.0;
  vec2 uvSchutt = vWeltPos.xz / 2.0;
  float felsSkala = 1.0 / 6.0;
  float scanWechsel = smoothstep(0.38, 0.62, bodenRauschen(vWeltPos.xz * 0.07 + 3.3));

  vec3 scanBasis = normalize(vWeltNormal);
  vec3 felsAchse = pow(abs(scanBasis), vec3(4.0));
  felsAchse /= felsAchse.x + felsAchse.y + felsAchse.z;

  vec4 sWiese = scanLesen(uWieseFarbe, uvWiese, scanWechsel);
  vec4 sWald = scanLesen(uWaldbodenFarbe, uvWald, scanWechsel);
  vec4 sSchutt = scanLesen(uSchuttFarbe, uvSchutt, scanWechsel);
  vec4 sFels = texture2D(uFelsFarbe, vWeltPos.zy * felsSkala) * felsAchse.x
             + texture2D(uFelsFarbe, vWeltPos.xz * felsSkala) * felsAchse.y
             + texture2D(uFelsFarbe, vWeltPos.xy * felsSkala) * felsAchse.z;

  // Grundgewichte aus Biom und Hang (HANG_GLSL), dann Höhenmischung: Wer höher steht, deckt.
  vec4 scanGewicht;
  scanGewicht.w = steil;
  scanGewicht.z = schutt * (1.0 - steil);
  scanGewicht.y = imWald * (1.0 - scanGewicht.z - scanGewicht.w);
  scanGewicht.x = max(0.0, 1.0 - scanGewicht.y - scanGewicht.z - scanGewicht.w);
  vec4 scanHoehe = scanGewicht + vec4(sWiese.a, sWald.a, sSchutt.a, sFels.a) * 0.6;
  float scanOben = max(max(scanHoehe.x, scanHoehe.y), max(scanHoehe.z, scanHoehe.w)) - 0.25;
  scanGewicht = max(scanHoehe - scanOben, 0.0) * step(0.001, scanGewicht);
  scanGewicht /= max(scanGewicht.x + scanGewicht.y + scanGewicht.z + scanGewicht.w, 1e-4);

  vec3 scanMod = sWiese.rgb * scanGewicht.x + sWald.rgb * scanGewicht.y
               + sSchutt.rgb * scanGewicht.z + sFels.rgb * scanGewicht.w;
  scanMod = scanMod * scanMod * 2.0;
  diffuseColor.rgb *= mix(vec3(1.0), scanMod, 0.85);
`;

const DETAIL_GLSL = /* glsl */ `
  vec3 tX = texture2D(uFelsNormal, vWeltPos.zy * felsSkala).xyz * 2.0 - 1.0;
  vec3 tY = texture2D(uFelsNormal, vWeltPos.xz * felsSkala).xyz * 2.0 - 1.0;
  vec3 tZ = texture2D(uFelsNormal, vWeltPos.xy * felsSkala).xyz * 2.0 - 1.0;
  tX = vec3(tX.xy + scanBasis.zy, abs(tX.z) * scanBasis.x);
  tY = vec3(tY.xy + scanBasis.xz, abs(tY.z) * scanBasis.y);
  tZ = vec3(tZ.xy + scanBasis.xy, abs(tZ.z) * scanBasis.z);
  vec3 felsW = normalize(tX.zyx * felsAchse.x + tY.xzy * felsAchse.y + tZ.xyz * felsAchse.z);
  vec3 detailW = scanAufWelt(scanNormale(uWieseNormal, uvWiese, scanWechsel), scanBasis) * scanGewicht.x
               + scanAufWelt(scanNormale(uWaldbodenNormal, uvWald, scanWechsel), scanBasis) * scanGewicht.y
               + scanAufWelt(scanNormale(uSchuttNormal, uvSchutt, scanWechsel), scanBasis) * scanGewicht.z
               + felsW * scanGewicht.w;
  detailW = normalize(detailW);
  // Ferne: Mipmaps glätten ohnehin; ab ~180 m ganz aus, damit nichts flimmert.
  float detailNah = 1.0 - smoothstep(80.0, 180.0, length(vViewPosition));
  vec3 versatz = mat3(viewMatrix) * (detailW - scanBasis);
  normal = normalize(normal + versatz * detailNah);
`;

const HANG_GLSL = /* glsl */ `
  float hangRausch = bodenRauschen(vWeltPos.xz * 0.31) - 0.5;
  float steil = 1.0 - smoothstep(0.66, 0.86, vWeltNormal.y + hangRausch * 0.16);
  float schutt = 1.0 - smoothstep(0.78, 0.93, vWeltNormal.y + hangRausch * 0.12);
  diffuseColor.rgb = mix(diffuseColor.rgb, uSchutt, schutt * 0.45);
  diffuseColor.rgb = mix(diffuseColor.rgb, uFels * (0.85 + hangRausch * 0.4), steil);
`;

const RELIEF_GLSL = /* glsl */ `
  // Blender mat_boden: Rauschen bei 6/m. Unser zweidimensionales Wertrauschen
  // hat steilere Einzelhaenge: 8 mm statt .15 m * .3 verhindern ein Kornraster.
  // Weltkoordinaten halten die Koernung beim Kachel-/LOD-Wechsel ortsfest.
  vec2 kornOrt = vWeltPos.xz * 6.0;
  float pixelBreite = max(length(dFdx(kornOrt)), length(dFdy(kornOrt)));
  float feinSichtbar = 1.0 - smoothstep(0.25, 0.75, pixelBreite);
  float korn = bodenRauschen(kornOrt);
  vec2 detailOrt = mat2(0.8, -0.6, 0.6, 0.8) * kornOrt * 2.0;
  float detail = bodenRauschen(detailOrt);
  float detailSichtbar = 1.0 - smoothstep(0.125, 0.375, pixelBreite);
  float hoehe = ((korn - 0.5) * 0.7 + (detail - 0.5) * 0.3 * detailSichtbar) * 0.008;

  // Oberflaechengradient nach Mikkelsen (wie three.js bumpmap_pars_fragment).
  // Unnormierte Ableitungen passen zur Hoehe in Metern; dadurch ist das Relief
  // unabhaengig von Aufloesung und Blickabstand. Die Geometrienormale bleibt Basis.
  vec3 dx = dFdx(-vViewPosition);
  vec3 dy = dFdy(-vViewPosition);
  vec3 querY = cross(dy, normal);
  vec3 querX = cross(normal, dx);
  float determinante = dot(dx, querY) * faceDirection;
  vec3 gradient = sign(determinante) * (dFdx(hoehe) * querY + dFdy(hoehe) * querX);
  vec3 reliefNormal = normalize(max(abs(determinante), 1e-8) * normal - gradient);
  normal = normalize(mix(normal, reliefNormal, feinSichtbar));
`;

/**
 * Bodenmaterial für die LOD-Kacheln.
 *
 * Flat Shading traegt die Gelaendeform. Das kleinere Normalenrelief folgt
 * ADR-0006 und der Blender-Quelle; es veraendert weder Silhouette noch Kollision.
 */
/**
 * `?bodenkantig=1` stellt das alte Flat Shading wieder her — **Vergleichsschalter** (D201).
 *
 * Bis D200 war Flat Shading die Vorgabe und `?bodenglatt=1` der Schalter dagegen. D160 maß mit ihm
 * „kein Unterschied“ — zu Recht, aber aus dem falschen Grund: Die Kachelgeometrie war nicht
 * indiziert, und `computeVertexNormals()` gab ohnehin nur Flächennormalen. Seit D201 kommen die
 * Normalen aus dem Höhenfeld, und glatt ist die Vorgabe (ADR-0012: Soulframe als Messlatte —
 * Gelände liest sich dort als Form, nicht als Facette).
 */
const BODEN_KANTIG: boolean = (() => {
  if (typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).get('bodenkantig') === '1';
})();

export function baueBodenMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: BODEN_KANTIG, roughness: 0.95, metalness: 0,
  });

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWeltPos;\nvarying vec3 vWeltNormal;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vWeltPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vWeltNormal = normalize(mat3(modelMatrix) * objectNormal);',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + RAUSCH_GLSL + '\nvarying vec3 vWeltNormal;\nuniform vec3 uFels;\nuniform vec3 uSchutt;\nuniform vec3 uWaldTon;\nuniform vec3 uMoos;\n' + SCAN_PARS_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + MOOS_GLSL + VARIATION_GLSL + HANG_GLSL + SCAN_GLSL)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + RELIEF_GLSL + DETAIL_GLSL)
      .replace('#include <common>', '#include <common>\nuniform sampler2D uBodenHimmel;\nuniform vec4 uBodenRahmen;\nuniform float uHimmel;')
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + HIMMEL_GLSL);
    shader.uniforms.uBodenHimmel = BODEN_HIMMEL.karte;
    shader.uniforms.uBodenRahmen = BODEN_HIMMEL.rahmen;
    shader.uniforms.uHimmel = HIMMEL_UNIFORM;
    shader.uniforms.uFels = { value: new THREE.Color(PALETTE.fels.b) };
    shader.uniforms.uSchutt = { value: new THREE.Color(PALETTE.fels.schutt) };
    shader.uniforms.uWaldTon = { value: new THREE.Color(PALETTE.biom.wald) };
    shader.uniforms.uMoos = { value: new THREE.Color(PALETTE.boden.moos) };
    shader.uniforms.uWieseFarbe = SCAN.wiese.farbe;
    shader.uniforms.uWieseNormal = SCAN.wiese.normal;
    shader.uniforms.uWaldbodenFarbe = SCAN.waldboden.farbe;
    shader.uniforms.uWaldbodenNormal = SCAN.waldboden.normal;
    shader.uniforms.uSchuttFarbe = SCAN.schutt.farbe;
    shader.uniforms.uSchuttNormal = SCAN.schutt.normal;
    shader.uniforms.uFelsFarbe = SCAN.fels.farbe;
    shader.uniforms.uFelsNormal = SCAN.fels.normal;
  };
  ladeScans();

  // Ohne eigenen Cache-Schlüssel teilt three das kompilierte Programm mit anderen
  // MeshStandardMaterials gleicher Konfiguration — und die hätten das Rauschen nicht.
  material.customProgramCacheKey = () => 'brachland-boden-v7' + (BODEN_KANTIG ? '-kantig' : '');

  return material;
}
