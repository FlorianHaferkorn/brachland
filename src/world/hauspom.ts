/**
 * BRACHLAND — Parallax Occlusion Mapping an den Hauswänden (D365, `?pom=0` schaltet ab)
 *
 * Flo am 21.11.2026: Die Wände wirken flach. Vorbild war Blenders „Displacement in one click“ (Foto →
 * Höhenkarte → echte Verformung). Im Browser kostet echte Verformung Millionen Dreiecke; POM verschiebt
 * stattdessen je Pixel die Texturkoordinate entlang des Blickstrahls, bis er die Höhenkarte schneidet —
 * Fugen, Feldsteine, Brettfugen und Ziegelkanten verdecken einander wie Relief.
 *
 * Kniff für das vielschichtige Hausmaterial: Jede Farbschicht (Hausscan, Hofscan, Zielbild, Weststraße,
 * Milbinger) leitet ihre UV aus der Weltlage `vHausPos` in der Wandebene ab. POM verschiebt deshalb nicht
 * eine UV, sondern die **Weltlage in der Wandebene** (`pomPos`); ein `#define` lenkt alle späteren Leser
 * dorthin um. So folgen Farbe, Normale, Rauheit, Verfall und Efeu demselben Versatz, ohne dass eine
 * Schicht angefasst wird. Die Höhe kommt aus dem Atlas der Schicht, die das Pixel am Ende färbt.
 *
 * Kosten: 8–24 Lagen (flacher Blick → mehr) plus 5 Schritte binäre Verfeinerung, je eine Abtastung
 * einer kleinen Graustufenkarte (512²–1024²), nur bis 25 m und nur ab 7° über der Wand. Darüber ein
 * Zweig, der früh aussteigt. WebGL2 (`textureGrad`, Schleife mit fester Obergrenze). Der WebGPU-Pfad
 * (ADR-0015, `probe/webgpuStauwehr.ts`) nutzt dieses Material nicht und bleibt unberührt.
 */

/** Erarbeitbare Werte, eine Quelle für Shader und Test. Längen in Metern. */
export const POM = {
  /** Lagen bei senkrechtem bzw. streifendem Blick. */
  schritteMin: 8,
  schritteMax: 24,
  verfeinerung: 5,
  /** Voll bis `nahVoll`, aus ab `nahEnde` (Abstand zur Kamera). */
  nahVoll: 18,
  nahEnde: 25,
  /** Kosinus Blick/Wandnormale: aus unter `flachAus` (~7°), voll ab `flachVoll` (~17°). */
  flachAus: 0.12,
  flachVoll: 0.3,
  /** Relieftiefe je Rolle: Putz, Schalung, Dach, Sockel (Feldstein). */
  tiefe: [0.007, 0.012, 0.028, 0.045] as const,
  /** Abdunkeln tiefer Stellen (Fugen, Abplatzer), Anteil bei voller Tiefe. */
  fuge: 0.3,
} as const;

const glatt = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Gewicht des Effekts nach Abstand und Blickwinkel (Kosinus zur Wandnormale). */
export function pomGewicht(abstand: number, kosinus: number): number {
  return (1 - glatt(POM.nahVoll, POM.nahEnde, abstand)) * glatt(POM.flachAus, POM.flachVoll, kosinus);
}

/** Lagenzahl: senkrecht wenige, streifend viele (dort ist der Versatz je Lage am größten). */
export function pomSchritte(kosinus: number): number {
  const k = Math.min(1, Math.max(0, kosinus));
  return POM.schritteMax + (POM.schritteMin - POM.schritteMax) * k;
}

/**
 * CPU-Gegenstück der Shaderschleife (für den Test): Versatz in UV-Einheiten für eine Höhenfunktion
 * `hoehe(u, v)` ∈ [0, 1] (1 = oben), Blick im Tangentenraum (x, y entlang u, v; z zur Wand hin positiv)
 * und Gesamttiefe `tiefeUv` in UV-Einheiten.
 */
export function pomVersatz(hoehe: (u: number, v: number) => number, blick: [number, number, number],
  tiefeUv: number, start: [number, number] = [0, 0]): { u: number; v: number; tiefe: number } {
  const [bx, by, bz] = blick;
  const n = pomSchritte(bz), lage = 1 / n;
  const du = bx / Math.max(bz, 0.05) * tiefeUv * lage, dv = by / Math.max(bz, 0.05) * tiefeUv * lage;
  let u = start[0], v = start[1], l = 0, h = 1 - hoehe(u, v);
  for (let i = 0; i < POM.schritteMax && i < n && l < h; i++) {
    u -= du; v -= dv; l += lage; h = 1 - hoehe(u, v);
  }
  if (l === 0) return { u: 0, v: 0, tiefe: 0 };
  let ua = u + du, va = v + dv, la = l - lage, ub = u, vb = v, lb = l;
  for (let i = 0; i < POM.verfeinerung; i++) {
    const um = (ua + ub) / 2, vm = (va + vb) / 2, lm = (la + lb) / 2;
    if (lm >= 1 - hoehe(um, vm)) { ub = um; vb = vm; lb = lm; } else { ua = um; va = vm; la = lm; }
  }
  return { u: (ua + ub) / 2 - start[0], v: (va + vb) / 2 - start[1], tiefe: (la + lb) / 2 };
}

const f = (x: number) => x.toFixed(4);

/** Deklarationen; `rolleMeter` und Quellen je nach Schaltern. Muss direkt nach `varying vec3 vHausPos;` stehen. */
export function pomPars(hof: boolean, ziel: boolean): string {
  return /* glsl */ `
vec3 hausPosRoh() { return vHausPos; }
vec3 pomPos;
float pomFuge = 0.0;
#define vHausPos pomPos
uniform sampler2D uPomHaus;
${hof ? 'uniform sampler2D uPomHof;' : ''}
${ziel ? 'uniform sampler2D uPomZiel;' : ''}
float pomLies(int q, vec2 p, float r, vec2 dx, vec2 dy) {
  vec2 off = vec2(mod(r, 2.0), 1.0 - floor(r / 2.0)) * 0.5;
  ${hof || ziel ? /* glsl */ `
  if (q > 0) {
    // Hof- und Zielatlas: 8/1024 umgelegter Rand je Kachel wie hofLiesGrad.
    vec2 uv = off + (fract(p) * (1008.0/1024.0) + 8.0/1024.0) * 0.5;
    vec2 gx = dx * (504.0/1024.0), gy = dy * (504.0/1024.0);
    ${hof && ziel ? 'return q == 1 ? textureGrad(uPomHof, uv, gx, gy).r : textureGrad(uPomZiel, uv, gx, gy).r;'
      : hof ? 'return textureGrad(uPomHof, uv, gx, gy).r;' : 'return textureGrad(uPomZiel, uv, gx, gy).r;'}
  }` : ''}
  return textureGrad(uPomHaus, off + (fract(p) * 0.996 + 0.002) * 0.5, dx * 0.5, dy * 0.5).r;
}
float pomTiefe(float r) {
  return r < 0.5 ? ${f(POM.tiefe[0])} : r < 1.5 ? ${f(POM.tiefe[1])} : r < 2.5 ? ${f(POM.tiefe[2])} : ${f(POM.tiefe[3])};
}
// Strahl gegen die Höhenkarte in der Wandebene; Ergebnis als verschobene Weltlage.
void pomRechne(vec3 roh, vec3 dRohX, vec3 dRohY, vec3 n, int q, vec3 ursprung, float meter, float r) {
  vec3 t = abs(n.y) > 0.97 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), n));
  vec3 b = cross(n, t);
  vec3 v = normalize(cameraPosition - roh);
  vec3 vt = vec3(dot(v, t), dot(v, b), dot(v, n));
  float w = (1.0 - smoothstep(${f(POM.nahVoll)}, ${f(POM.nahEnde)}, length(vViewPosition)))
    * smoothstep(${f(POM.flachAus)}, ${f(POM.flachVoll)}, vt.z);
  if (w <= 0.0) return;
  vec3 lokal = roh - ursprung;
  vec2 p0 = vec2(dot(lokal, t), dot(lokal, b)) / meter;
  vec2 dx = vec2(dot(dRohX, t), dot(dRohX, b)) / meter, dy = vec2(dot(dRohY, t), dot(dRohY, b)) / meter;
  float schritte = mix(${f(POM.schritteMax)}, ${f(POM.schritteMin)}, vt.z);
  float lage = 1.0 / schritte;
  vec2 d = vt.xy / max(vt.z, 0.05) * (pomTiefe(r) * w / meter) * lage;
  vec2 p = p0;
  float l = 0.0, h = 1.0 - pomLies(q, p, r, dx, dy);
  for (int i = 0; i < ${POM.schritteMax}; i++) {
    if (float(i) >= schritte || l >= h) break;
    p -= d; l += lage; h = 1.0 - pomLies(q, p, r, dx, dy);
  }
  if (l <= 0.0) return;
  vec2 pa = p + d, pb = p;
  float la = l - lage, lb = l;
  for (int i = 0; i < ${POM.verfeinerung}; i++) {
    vec2 pm = (pa + pb) * 0.5; float lm = (la + lb) * 0.5;
    if (lm >= 1.0 - pomLies(q, pm, r, dx, dy)) { pb = pm; lb = lm; } else { pa = pm; la = lm; }
  }
  vec2 versatz = ((pa + pb) * 0.5 - p0) * meter;
  pomPos = roh + t * versatz.x + b * versatz.y;
  pomFuge = (la + lb) * 0.5 * w;
}
`;
}

/**
 * Wahl der Höhenquelle in derselben Reihenfolge, in der die Farbschichten einander überdecken
 * (Hausscan → Hofscan → Zielbild → Weststraße → Milbinger). Steht in `color_fragment` nach `scanR`/`zielHaus`.
 */
export function pomWahl(o: { hof: boolean; ziel: boolean; west: boolean; milbinger: boolean; normale: boolean }): string {
  const hofMeter = 'float pomHm = r < .5 ? uHofMeter.x : r < 1.5 ? uHofMeter.y : r < 2.5 ? uHofMeter.z : uHofMeter.w;';
  return /* glsl */ `
  pomPos = hausPosRoh();
  vec3 pomDx = dFdx(pomPos), pomDy = dFdy(pomPos);
  if (scanR < 3.5) {
    float r = scanR;
    int q = 0;
    vec3 n = normalize(cross(pomDx, pomDy));
    vec3 o = vec3(0.0);
    float m = r < 0.5 ? uScanMeter.x : r < 1.5 ? uScanMeter.y : r < 2.5 ? uScanMeter.z : uScanMeter.w;
    ${o.hof ? /* glsl */ `
    ${hofMeter}
    vec3 hn = ${o.normale ? 'normalize(vHausNormal)' : 'n'};
    vec3 ho = vec3(uHofMitte.x, 0.0, uHofMitte.y);
    float anteil = uHofBereit * (1.0 - smoothstep(38.0, 48.0, distance(pomPos.xz, uHofMitte)));
    if (anteil > 0.5) { q = 1; n = hn; o = ho; m = pomHm; }
    ${o.ziel ? 'if (anteil > 0.5 && zielHaus > .5 && (r < 2.5 || hn.y < .7)) { q = 2; m = pomHm / zielMassstab(r); }' : ''}
    ${o.west ? 'if (vZustand.x >= 24.0 && vRolle < 5.5 && (r < 2.5 || hn.y < .75)) { q = 2; n = hn; o = ho; m = pomHm / zielMassstab(r); }' : ''}
    ${o.milbinger ? /* glsl */ `
    float pomMa = milbingerHausGewicht(pomPos.xz) * (1.0 - smoothstep(55.0, 88.0, length(vViewPosition))) * (1.0 - zielHaus);
    if (vZustand.x >= 24.0 || vRolle >= 5.5) pomMa = 0.0;
    if (pomMa > 0.5) { q = 1; n = hn; o = vec3(uWiesenbereich.x, 0.0, uWiesenbereich.y); m = pomHm; }` : ''}
    ` : ''}
    // Waagerechte Trittplatten (Sockelrolle, liegend) bleiben eben.
    if (!(r > 2.5 && n.y > 0.7)) pomRechne(pomPos, pomDx, pomDy, n, q, o, m, r);
  }
`;
}

/** Nach allen Farbschichten: tiefe Stellen nehmen weniger Licht an (Fugen, Abplatzer). */
export const POM_FUGE = /* glsl */ `
  diffuseColor.rgb *= 1.0 - ${f(POM.fuge)} * pomFuge;
`;
