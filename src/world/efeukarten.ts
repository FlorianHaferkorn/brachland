/**
 * BRACHLAND — Efeukarten (D358): die Masse des Efeus als gebackene Karten in echter Blattgrösse.
 *
 * Einzelblätter in echter Grösse (4–12 cm, `content/massstab.json`) tragen keine geschlossene Efeumatte: Eine Wand
 * bräuchte zehntausende davon (D353/D354). Die Karten kommen aus `tools/efeukarten.py` (Blender, Cycles CPU): vier
 * Felder von 1 × 1 m mit derselben Wuchsregel, gebacken als Grundfarbe, Normale und Wandabstand. Die Efeu-Bauer in
 * `hausbewuchs.ts` melden je Polster und Triebabschnitt einen Kartenplatz; die Szene zeichnet alle Plätze als vier
 * `InstancedMesh` (eine je Atlas-Kachel), zwei Schichten je Platz.
 *
 * Die Kartengrösse bleibt nahe 1 m, weil sie die Blattgrösse festlegt: 0,6–1,1 m ergibt 4–13 cm Blattlänge.
 */
import * as THREE from 'three';

export interface EfeuKarte {
  /** Mitte auf der Wand, Weltmeter. */
  ort: readonly [number, number, number];
  /** Wandnormale nach aussen (waagerecht). */
  normal: readonly [number, number];
  /** Abstand des Polsters vor der Wand in Metern. */
  vorstand: number;
  /** Gewünschte Kantenlänge in Metern (wird auf 0,6–1,1 m begrenzt). */
  groesse: number;
  /** D359: Wuchsrichtung als Drehung in der Wandebene (Bogenmass, 0 = aufwärts); ohne Angabe frei. */
  winkel?: number;
  saat: number;
}

let sammler: ((k: EfeuKarte) => void) | null = null;

/** Der Hausbau meldet Karten nur, solange ein Sammler gesetzt ist (Szene, Tests). */
export function setzeEfeuSammler(s: ((k: EfeuKarte) => void) | null): void { sammler = s; }
export function meldeEfeuKarte(k: EfeuKarte): void { sammler?.(k); }

const KANTE_MIN = 0.6, KANTE_MAX = 1.1;

/** Zwei Schichten je Platz: hinten gross an der Wand, vorn kleiner auf dem Polster, verdreht. */
export function kartenMatrizen(karten: readonly EfeuKarte[]): THREE.Matrix4[][] {
  const kacheln: THREE.Matrix4[][] = [[], [], [], []];
  const q = new THREE.Quaternion(), dreh = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const z = new THREE.Vector3(0, 0, 1);
  for (const k of karten) {
    const n = new THREE.Vector3(k.normal[0], 0, k.normal[1]).normalize();
    q.setFromUnitVectors(z, n);
    const kante = Math.min(KANTE_MAX, Math.max(KANTE_MIN, k.groesse));
    let h = (k.saat >>> 0) || 1;
    const zufall = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
    // Zweite Schicht nur auf dicken Polstern; dünne Ranken bleiben eine Lage.
    const schichten: (readonly [number, number])[] = k.vorstand > 0.15
      ? [[0.02, 1], [Math.max(0.05, k.vorstand * 0.8), 0.72]] : [[0.02, 1]];
    for (const [tiefe, anteil] of schichten) {
      // Mit Wuchsrichtung: der Karte folgen (±10°), sonst ±17° um die Senkrechte.
      const winkel = k.winkel !== undefined ? k.winkel + (zufall() - 0.5) * 0.35 : (zufall() - 0.5) * 0.6;
      dreh.setFromAxisAngle(z, winkel);
      // Kein Spiegeln: eine gespiegelte Karte zeigt die Rückseite, Normalen und Licht kehren sich um (D358, Tarnmuster).
      p.set(k.ort[0] + n.x * tiefe, k.ort[1], k.ort[2] + n.z * tiefe);
      s.set(kante * anteil, kante * anteil, 1);
      kacheln[Math.floor(zufall() * 4) % 4].push(new THREE.Matrix4().compose(p, q.clone().multiply(dreh), s));
    }
  }
  return kacheln;
}

/** Ebene 1 × 1 m, UV auf eine Atlas-Kachel (2 × 2) abgebildet. */
export function kachelGeometrie(kachel: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(1, 1);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const ox = (kachel % 2) * 0.5, oy = (1 - Math.floor(kachel / 2)) * 0.5;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, ox + uv.getX(i) * 0.5, oy + uv.getY(i) * 0.5);
  return g;
}

/**
 * D361: gebackene Karte (Farbe + Deckung, Normale + Abstand/Höhe in Alpha) als Material — für Efeu und Streu.
 * `tief` ist die Helligkeit der tiefsten Lage (Alpha 0). `dämpfen`: entsättigt und dunkler (Streu las im Spiel zu rot, D361).
 */
export function kartenMaterial(art: string, tief: number, dämpfen = false): THREE.MeshStandardMaterial {
  const lade = (name: string, farbe: boolean) => {
    const t = new THREE.TextureLoader().load(`/material/${art}-karten-${name}.webp`);
    t.colorSpace = farbe ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const m = new THREE.MeshStandardMaterial({
    map: lade('farbe', true), normalMap: lade('normal', false), alphaTest: 0.5,
    side: THREE.DoubleSide, roughness: 0.6, metalness: 0,
  });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', /* glsl */ `
#include <normal_fragment_maps>
// Abstand/Höhe (A der Normalenkarte): tiefe Lagen liegen im Schatten der oberen.
diffuseColor.rgb *= mix(${tief.toFixed(2)}, 1.0, texture2D(normalMap, vNormalMapUv).a);
${dämpfen ? 'diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(.2126,.7152,.0722))), diffuseColor.rgb, .62) * .78;' : ''}`);
  };
  // D366: Der Programm-Cache von three.js unterscheidet sonst nur nach dem Quelltext von `onBeforeCompile` — Efeu,
  // Streu und Bodenpflanzen mit verschiedenem `tief`/`dämpfen` könnten sich ein Programm teilen.
  m.customProgramCacheKey = () => `karten-${art}-${tief}-${dämpfen}`;
  return m;
}

let material: THREE.MeshStandardMaterial | null = null;
let tiefe: THREE.MeshDepthMaterial | null = null;

/** D359: Schatten mit demselben Blattumriss — ohne eigenes Tiefenmaterial würfe jede Karte ein volles Quadrat. */
export function efeuKartenTiefe(): THREE.MeshDepthMaterial {
  if (tiefe) return tiefe;
  tiefe = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: efeuKartenMaterial().map, alphaTest: 0.5 });
  return tiefe;
}

/** Ein Material für alle Karten: Ausschnitt per Alpha-Test, Tiefe (Normalen-Alpha) dunkelt das Innere des Polsters ab. */
export function efeuKartenMaterial(): THREE.MeshStandardMaterial {
  material ??= kartenMaterial('efeu', 0.42);
  return material;
}
