/**
 * BRACHLAND — Blattkarten auf Kronenhüllen (Vertikalschnitt Stauwehr, 11.11.2026)
 *
 * Die Kronen der Blender-Szenen sind Klumpen: verformte Ikosphären, deren Look in Cycles erst
 * durch Shader entsteht (Rauschlöcher, Durchlass). Im glTF kommt davon nur Vertexfarbe an; im
 * Spiel stehen deshalb einfarbige Blattklumpen ohne Blatt. Kein Vertexshader-Trick holt das
 * zurück, es fehlt schlicht das Blatt.
 *
 * Hier wird der Klumpen zur **Hülle**: Auf seiner Oberfläche stehen tausende kleine Karten mit
 * einem Foto-Zweig (CC0, `public/material/ez-*-cc0-v5.webp`, Herkunft in `assets/HERKUNFT.md`).
 * Drei Dinge machen daraus Volumen statt Konfetti:
 * - **Hüllnormale statt Kartennormale.** Jede Karte schattiert mit der Normale der Hülle an
 *   ihrem Fusspunkt. Die Krone hellt zur Sonne hin weich auf und wird zur Schattenseite dunkel,
 *   wie ein Busch aus der Ferne — eine einzelne Karte zeigt kein eigenes Licht-Schatten-Muster.
 * - **Durchlass.** Steht die Sonne hinter der Krone, leuchtet das Blatt (direktes Licht durch
 *   das Blatt, Anteil `durchlass`).
 * - **Dunkler Kern.** Der alte Klumpen bleibt, verkleinert und abgedunkelt, als Inneres. Ohne ihn
 *   sieht man durch die Kartenlücken in den Himmel, und die Krone wirkt licht wie im Winter.
 *
 * Positionen aus einem Seed (CLAUDE.md, Performance-Invarianten), alles in einem `InstancedMesh`
 * je Hülle. Renderfrei gilt hier nicht: Das ist Welt-Code und kennt three.js.
 */
import * as THREE from 'three';
import { MSAA } from './echt.js';

export type KartenArt = 'laub' | 'nadel' | 'weide';

interface ArtWerte {
  textur: string;
  /** Karten je m² Hüllfläche. */
  dichte: number;
  /** Kantenlänge (Breite, Höhe) der Karte in Metern, Mittel. */
  groesse: [number, number];
  /** Wie stark die Karte von der Hüllnormale weg zufällig kippt (0 = flach auf der Hülle). */
  streuung: number;
  /** Hängend: Längsachse nach unten (Weide), sonst frei gedreht. */
  haengend: boolean;
  durchlass: number;
  /**
   * Wiederholungen des Fotos je Kartenkante (D262). Der Zweig im Foto trägt 6–7 Blätter über die
   * ganze Kachel; auf einer 75-cm-Karte war ein Blatt so 30–35 cm lang statt 8–12 cm — aus der
   * Nähe las die Krone wie Riesenlaub. 2 × 2 Zweige auf 60 cm bringen das Blatt auf ~13 cm.
   * Weide: 2 × 4 auf der schmalen Hängekarte, sonst war das Blatt 17 × 30 cm und blass gestreckt.
   */
  kacheln: [number, number];
}

const ARTEN: Record<KartenArt, ArtWerte> = {
  laub: { textur: '/material/ez-laub-cc0-v5.webp', dichte: 7.5, groesse: [0.6, 0.6], streuung: 0.9, haengend: false, durchlass: 0.6, kacheln: [2, 2] },
  nadel: { textur: '/material/ez-nadel-cc0-v5.webp', dichte: 6.5, groesse: [0.8, 0.55], streuung: 0.5, haengend: false, durchlass: 0.3, kacheln: [1, 1] },
  weide: { textur: '/material/ez-laub-cc0-v5.webp', dichte: 7, groesse: [0.35, 1.1], streuung: 0.35, haengend: true, durchlass: 0.65, kacheln: [2, 4] },
};

/** Obergrenze je Hülle: Eine riesige zusammengeführte Krone soll nicht 300.000 Karten bekommen. */
export const KARTEN_MAX = 60_000;

/** Deterministischer Zufall (Mulberry32) — gleiche Hülle, gleiche Karten. */
function zufall(saat: number): () => number {
  let a = saat >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Name → Kartenart, oder null für alles, was keine Krone ist. */
export function kartenArtFuer(name: string): KartenArt | null {
  if (/Weide.*Krone/.test(name)) return 'weide';
  if (/Nadeln/.test(name)) return 'nadel';
  if (/Krone|Laub/.test(name)) return 'laub';
  return null;
}

const texturen = new Map<string, THREE.Texture>();
function textur(pfad: string, kacheln: [number, number]): THREE.Texture {
  const schluessel = pfad + '×' + kacheln.join('×');
  let t = texturen.get(schluessel);
  if (!t) {
    t = new THREE.TextureLoader().load(pfad);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (kacheln[0] * kacheln[1] > 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(kacheln[0], kacheln[1]); }
    texturen.set(schluessel, t);
  }
  return t;
}

function baueKartenMaterial(art: ArtWerte): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map: textur(art.textur, art.kacheln), alphaTest: 0.45, side: THREE.DoubleSide,
    roughness: 0.75, metalness: 0,
    // Weiche Blattränder statt Treppen — wirkt nur mit MSAA im Zielbild (`echt.ts` MSAA).
    alphaToCoverage: MSAA > 0,
  });
  const uDurchlass = { value: art.durchlass };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDurchlass = uDurchlass;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aHuelle;')
      // Hüllnormale, schon in den Kartenraum zurückgedreht (CPU), damit `instanceMatrix` sie wieder
      // auf die Hülle bringt.
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = aHuelle;\n#ifdef USE_TANGENT\n  vec3 objectTangent = vec3(1.0, 0.0, 0.0);\n#endif');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDurchlass;')
      // Beide Kartenseiten schattieren wie die Hülle: three dreht die Normale der Rückseite um.
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
  {
    vec3 sonne = directionalLights[ 0 ].direction;
    float rueck = saturate(-dot(normal, sonne));
    float gegen = saturate(dot(-normalize(vViewPosition), sonne));
    reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[ 0 ].color * uDurchlass * rueck * (0.35 + 0.65 * gegen);
  }
#endif`);
  };
  m.customProgramCacheKey = () => 'brachland-laubkarten-v1';
  return m;
}

const KARTE = (() => {
  const g = new THREE.PlaneGeometry(1, 1);
  return g;
})();

export interface Laubkarten {
  mesh: THREE.InstancedMesh;
  anzahl: number;
  flaeche: number;
  dispose(): void;
}

/**
 * Karten auf die Hülle `geo` streuen. Ergebnis liegt im **lokalen Raum** von `geo` — als Kind des
 * Hüll-Meshes einhängen, dann sitzt es ohne weitere Umrechnung.
 */
export function baueLaubkarten(
  geo: THREE.BufferGeometry, artName: KartenArt, saat = 1, faktor = 1,
  /**
   * Meter je lokaler Einheit. glTF mit KHR_mesh_quantization speichert Positionen normiert, erst
   * die Knotenskala macht Meter daraus — ohne diesen Faktor bekam die Stauwehr-Szene 776 statt
   * zehntausender Karten. Dichte, Kartengrösse und Versatz rechnen in Metern.
   */
  skala = 1,
): Laubkarten {
  const art = ARTEN[artName];
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  let nor = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (!nor) { geo.computeVertexNormals(); nor = geo.getAttribute('normal') as THREE.BufferAttribute; }
  const idx = geo.index;
  const dreiecke = idx ? idx.count / 3 : pos.count / 3;
  const ecke = (t: number, k: number) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);

  // Flächen kumulieren, dann flächengewichtet ziehen.
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const kum = new Float64Array(dreiecke);
  let flaeche = 0;
  for (let t = 0; t < dreiecke; t++) {
    a.fromBufferAttribute(pos, ecke(t, 0)); b.fromBufferAttribute(pos, ecke(t, 1)); c.fromBufferAttribute(pos, ecke(t, 2));
    flaeche += b.sub(a).cross(c.sub(a)).length() / 2;
    kum[t] = flaeche;
  }
  flaeche *= skala * skala;
  const anzahl = Math.min(KARTEN_MAX, Math.round(flaeche * art.dichte * faktor));
  const kumSkala = skala * skala;
  const zuf = zufall(saat * 7919 + 17);

  const mesh = new THREE.InstancedMesh(KARTE, baueKartenMaterial(art), anzahl);
  const huelle = new Float32Array(anzahl * 3);
  const farbe = new THREE.Color();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), qInv = new THREE.Quaternion();
  const p = new THREE.Vector3(), n = new THREE.Vector3(), s = new THREE.Vector3();
  const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3();
  const vorne = new THREE.Vector3(0, 0, 1), hoch = new THREE.Vector3(0, 1, 0), achse = new THREE.Vector3();
  const qRoll = new THREE.Quaternion(), qKipp = new THREE.Quaternion();

  for (let i = 0; i < anzahl; i++) {
    // Dreieck per Bisektion, Punkt gleichverteilt darin.
    const ziel = zuf() * flaeche / kumSkala;
    let lo = 0, hi = dreiecke - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (kum[mid] < ziel) lo = mid + 1; else hi = mid; }
    let u = zuf(), v = zuf();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w0 = 1 - u - v;
    a.fromBufferAttribute(pos, ecke(lo, 0)); b.fromBufferAttribute(pos, ecke(lo, 1)); c.fromBufferAttribute(pos, ecke(lo, 2));
    p.set(0, 0, 0).addScaledVector(a, w0).addScaledVector(b, u).addScaledVector(c, v);
    na.fromBufferAttribute(nor, ecke(lo, 0)); nb.fromBufferAttribute(nor, ecke(lo, 1)); nc.fromBufferAttribute(nor, ecke(lo, 2));
    n.set(0, 0, 0).addScaledVector(na, w0).addScaledVector(nb, u).addScaledVector(nc, v).normalize();
    // ±20 cm um die Hülle streuen: Tiefe statt einer Schicht. Der Kern liegt 40 cm innen
    // (`schrumpfeHuelle`), also verschwindet keine Karte im undurchsichtigen Klumpen.
    const versatz = zuf() - 0.5;
    p.addScaledVector(n, versatz * 0.4 / skala);

    if (art.haengend) {
      // Weide: Karte senkrecht, Längsachse nach unten, um die Hochachse zufällig gedreht und
      // leicht zur Hülle hin geneigt.
      qRoll.setFromAxisAngle(hoch, zuf() * Math.PI * 2);
      qKipp.setFromAxisAngle(achse.set(1, 0, 0), (zuf() - 0.5) * art.streuung);
      q.copy(qRoll).multiply(qKipp);
      p.y -= art.groesse[1] * 0.35 / skala;
    } else {
      // Karte zur Hülle hin ausrichten, dann zufällig kippen und um sich selbst drehen.
      q.setFromUnitVectors(vorne, n);
      achse.set(zuf() - 0.5, zuf() - 0.5, zuf() - 0.5).normalize();
      qKipp.setFromAxisAngle(achse, (zuf() - 0.5) * 2 * art.streuung);
      qRoll.setFromAxisAngle(vorne, zuf() * Math.PI * 2);
      q.premultiply(qKipp).multiply(qRoll);
    }
    const g = 0.7 + zuf() * 0.6;
    s.set(art.groesse[0] * g / skala, art.groesse[1] * g / skala, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    // Hüllnormale in den Kartenraum: `instanceMatrix` dreht sie im Shader zurück.
    qInv.copy(q).invert();
    achse.copy(n).applyQuaternion(qInv);
    huelle[i * 3] = achse.x; huelle[i * 3 + 1] = achse.y; huelle[i * 3 + 2] = achse.z;
    // Farbe: leichte Streuung in Helligkeit und Gelbanteil, wie Sonnen- und Schattenblätter.
    // Kronen-Verdeckung: Karten innen (Versatz < 0) und an der Unterseite (Normale nach unten)
    // bekommen weniger Himmel ab. Das ist der Teil, der eine Krone schwer und rund macht.
    const unten = 0.5 + 0.5 * n.y;              // 0 = Unterseite, 1 = Oberseite
    const innen = 0.5 + versatz;                // 0 = innen, 1 = aussen
    const ao = 0.38 + 0.62 * (0.55 * unten + 0.45 * innen);
    const h = (0.85 + zuf() * 0.25) * ao;
    farbe.setRGB(h * (0.95 + zuf() * 0.1), h, h * (0.85 + zuf() * 0.1));
    mesh.setColorAt(i, farbe);
  }
  // Eigene Geometrie je Netz: `aHuelle` ist je Instanz verschieden.
  const kartenGeo = KARTE.clone();
  kartenGeo.setAttribute('aHuelle', new THREE.InstancedBufferAttribute(huelle, 3));
  mesh.geometry = kartenGeo;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = `Laubkarten:${artName}`;
  mesh.computeBoundingSphere();
  return {
    mesh, anzahl, flaeche,
    dispose: () => { kartenGeo.dispose(); (mesh.material as THREE.Material).dispose(); },
  };
}

/**
 * Dunkler Kern: dieselbe Hülle, jede Ecke `meter` entlang ihrer Normale nach innen. Neue Geometrie;
 * die alte bleibt für `baueLaubkarten` unverändert.
 */
export function schrumpfeHuelle(geo: THREE.BufferGeometry, meter = 0.4, skala = 1): THREE.BufferGeometry {
  const weg = meter / skala;
  const kern = geo.clone();
  if (!kern.getAttribute('normal')) kern.computeVertexNormals();
  const pos = kern.getAttribute('position') as THREE.BufferAttribute;
  const nor = kern.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++)
    pos.setXYZ(i, pos.getX(i) - nor.getX(i) * weg, pos.getY(i) - nor.getY(i) * weg, pos.getZ(i) - nor.getZ(i) * weg);
  pos.needsUpdate = true;
  kern.computeBoundingSphere();
  return kern;
}

/** Schalter: `echt.ts` (`?laubkarten=1` oder `?echt=1`). */
export { LAUBKARTEN_AN } from './echt.js';
