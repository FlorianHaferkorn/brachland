/**
 * BRACHLAND — Pinselstriche für den malerischen Look (D269, `?malerei=1`, Weg B)
 *
 * Vorbild: das three.js-Demo „oil-paint“ (patch.gg/blendi, 12.11.2026, MIT/CC0): Strich für Strich
 * an die Welt gebunden, drei Farbmischungen nach Beleuchtung, ein Pinselbogen mit mehreren Mustern.
 * Wir haben die Träger schon — instanzierte Karten auf Kronenhüllen (`laubkarten.ts`) und der
 * Grasteppich (`grasteppich.ts`). Hier fehlt nur, was aus Blatt und Halm einen **Strich** macht:
 * - `pinselTextur()`: ein Bogen mit Borstenstrichen statt Foto-Blättern (Alpha, per Canvas erzeugt,
 *   kein Bild im Paket — der Pinsel ist Code).
 * - `PINSEL_BAND_GLSL`: die Farbe in drei Bänder zerlegt (Licht, Halbton, Schatten) statt weich
 *   verlaufend. „Licht“ nur, wo die Sonne wirklich ankommt (Schattenkarte), „Halbton“, wo nur das
 *   Fülllicht ist; der Schatten bekommt einen kühlen Stich wie in Ölmalerei.
 */
import * as THREE from 'three';

/** Canvas-Kantenlänge des Pinselbogens. */
const BOGEN = 512;
let bogen: THREE.CanvasTexture | null = null;

/** Deterministischer Zufall — derselbe Bogen bei jedem Start. */
export function zufall(saat: number): () => number {
  let a = saat >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Acht Striche auf einem Bogen: je Strich viele dünne Borstenlinien mit leicht verschobenem Anfang und
 * Ende, rauem Rand und Helligkeitsschwankung entlang der Borste (Farbe kommt aus Instanz und Material,
 * die Textur trägt nur Alpha und Grauwert). Ohne `document` (Tests) eine 1×1-Textur.
 */
export function pinselTextur(): THREE.Texture {
  if (bogen) return bogen;
  if (typeof document === 'undefined') {
    bogen = new THREE.CanvasTexture(undefined as unknown as HTMLCanvasElement);
    return bogen;
  }
  const c = document.createElement('canvas');
  c.width = c.height = BOGEN;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, BOGEN, BOGEN);
  const z = zufall(20261112);
  for (let s = 0; s < 8; s++) {
    // Strich: Mittelpunkt in einem 4×2-Raster mit Streuung, Winkel um die Diagonale, Länge ~ ein Drittel.
    const mx = ((s % 4) + 0.5 + (z() - 0.5) * 0.4) * (BOGEN / 4);
    const my = (Math.floor(s / 4) + 0.5 + (z() - 0.5) * 0.4) * (BOGEN / 2);
    const winkel = -0.5 + (z() - 0.5) * 1.1;
    const laenge = 110 + z() * 70, breite = 44 + z() * 34;
    const dx = Math.cos(winkel), dy = Math.sin(winkel), nx = -dy, ny = dx;
    const borsten = 26 + Math.floor(z() * 10);
    for (let b = 0; b < borsten; b++) {
      // Quer zur Strichrichtung verteilt, in der Mitte dichter und länger (rundere Form).
      const t = (b + z() * 0.8) / borsten * 2 - 1;
      const kuerzung = 1 - Math.pow(Math.abs(t), 2.4) * 0.55;
      const l = laenge * kuerzung * (0.85 + z() * 0.3);
      const ox = nx * t * breite * 0.5, oy = ny * t * breite * 0.5;
      const x0 = mx + ox - dx * l * 0.5 + (z() - 0.5) * 8, y0 = my + oy - dy * l * 0.5 + (z() - 0.5) * 8;
      const x1 = mx + ox + dx * l * 0.5 + (z() - 0.5) * 8, y1 = my + oy + dy * l * 0.5 + (z() - 0.5) * 8;
      const bog = (z() - 0.5) * 14;
      const grau = 150 + Math.floor(z() * 105);
      g.strokeStyle = `rgba(${grau},${grau},${grau},${0.78 + z() * 0.22})`;
      g.lineCap = 'round';
      g.lineWidth = 3.2 + z() * 3.4;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo((x0 + x1) / 2 + nx * bog, (y0 + y1) / 2 + ny * bog, x1, y1);
      g.stroke();
    }
  }
  bogen = new THREE.CanvasTexture(c);
  bogen.colorSpace = THREE.SRGBColorSpace;
  bogen.anisotropy = 4;
  bogen.needsUpdate = true;
  return bogen;
}

/**
 * Fragment-Baustein: vor `#include <opaque_fragment>` einsetzen. Braucht `normal` (Sichtraum),
 * `diffuseColor`, `reflectedLight`, `outgoingLight` und eine Richtungslicht-Quelle (die Sonne).
 *
 * Sonnenanteil `s`: Das direkte Diffuslicht geteilt durch das, was ohne Schatten ankäme
 * (`lum(Albedo)/π · cos · lum(Sonnenfarbe)`) — 0 im Schatten, 1 im vollen Licht, auch mit Schatten
 * der Schattenkarte. Bänder: Licht = Sonne da und Fläche zur Sonne gedreht, Halbton = beleuchtet vom
 * Himmel, Schatten = abgewandt. Farben aus `diffuseColor`: Licht wärmer und heller, Schatten dunkler
 * und kühler (Ölfarbe: Schatten werden nicht grau, sondern bläulich-grün).
 */
export const PINSEL_BAND_GLSL = /* glsl */ `
#if NUM_DIR_LIGHTS > 0
  {
    vec3 sonneRichtung = directionalLights[ 0 ].direction;
    float cosSonne = dot(normal, sonneRichtung);
    float lumAlbedo = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    float lumSonne = dot(directionalLights[ 0 ].color, vec3(0.299, 0.587, 0.114));
    float ohneSchatten = max(lumAlbedo * max(cosSonne, 0.0) * lumSonne / 3.14159, 1e-4);
    float sonne = clamp(dot(reflectedLight.directDiffuse, vec3(0.299, 0.587, 0.114)) / ohneSchatten, 0.0, 1.0);
    float licht = smoothstep(0.18, 0.42, cosSonne) * smoothstep(0.35, 0.65, sonne);
    float halb = smoothstep(-0.35, -0.05, cosSonne);
    vec3 c = diffuseColor.rgb;
    vec3 cLicht = c * vec3(1.55, 1.4, 1.0) + vec3(0.03, 0.025, 0.0);
    vec3 cSchatten = c * vec3(0.38, 0.5, 0.68);
    outgoingLight = mix(mix(cSchatten, c, halb), cLicht, licht);
  }
#endif
`;
