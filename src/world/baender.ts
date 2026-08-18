/**
 * BRACHLAND — Wege und Gewässer als Bänder auf den Kacheln
 *
 * Warum eigenes Modul, warum je Kachel?
 *
 * Ein Band, das einmal für die ganze Region gebaut wird, muss sich für **eine**
 * Höhe entscheiden. Das Gelände hat aber je nach Kameraabstand fünf: 2 m
 * Vertexabstand in der Nähe, 32 m in der Ferne. Gemessen hing das Wegband auf der
 * gröbsten Stufe zu 26 % über einem halben Meter in der Luft, das Gewässerband im
 * Mittel 2,5 m (`npm run aufsatz`, G-70). Eine Böschung konnte das zudecken —
 * beheben konnte sie es nicht, und sie kostete 112.000 Dreiecke auf Meshes, die
 * nie gecullt werden.
 *
 * Je Kachel gebaut, mit **derselben LOD-Stufe wie die Kachel darunter**, ist die
 * Frage weg statt gedeckt: Das Band liegt auf genau dem Dreieck, das dort
 * gezeichnet wird. Übrig bleibt der Sprung an der Naht zwischen zwei Kacheln
 * verschiedener Stufe — dafür, und nur dafür, gibt es noch eine schmale Schürze.
 *
 * Nebenwirkung, die genauso wichtig ist: Bänder werden jetzt wie das Gelände
 * nach Entfernung ausgeblendet.
 */
import * as THREE from 'three';
import type { Weltdaten } from './osm.js';
import { MASSSTAB, WEG_TEILUNG } from './terrain.js';
import { KACHEL, LOD_STUFEN, hoeheAufFlaeche, spiegelAufFlaeche,
         type HoehenFeld, type Kachel } from './lod.js';

/** Wie hoch die Wasserfläche über dem Gelände liegt. */
const WASSER_UEBER_GRUND = 0.06;
/** Wie hoch das Wegband über dem Gelände liegt, damit nichts durchblitzt. */
const WEG_UEBER_GRUND = 0.12;

/**
 * Ab diesem Gefälle je Teilstück wird aus dem liegenden Band eine stehende Fläche.
 *
 * Ein Bach, der 40 Höhenmeter auf 60 Metern Lauflänge verliert, ist im echten
 * Œntal kein Bach mehr, sondern eine Kaskade. Entschieden wird das **einmal** auf
 * der feinen Fläche und im Stück gespeichert — würde jede LOD-Stufe neu urteilen,
 * verwandelten sich Wasserfälle beim Weggehen in Bäche.
 */
const WASSERFALL_AB = 0.22;

/** Nahtsprung unter dieser Höhe braucht keine Schürze. */
const NAHT_AB = 0.3;
/** Und über dieser sieht man sie ohnehin nicht mehr. */
const NAHT_MAX = 2.5;

/** Ein fertig zerlegtes Teilstück eines Bandes, in Weltkoordinaten. */
export interface Bandstueck {
  ax: number; az: number; bx: number; bz: number;
  /** Halbe Breite quer zur Laufrichtung. */
  nx: number; nz: number;
  /** Lauflänge in Metern an beiden Enden — wird zu `uv.y`. */
  v1: number; v2: number;
  /** Steht dieses Stück als Wasserfall? Einmal entschieden, nie neu. */
  fall: boolean;
}

/** Alles, was auf dem Gelände aufliegt, nach Kachel sortiert. */
export interface Bandsatz {
  wege: Map<string, Bandstueck[]>;
  baeche: Map<string, Bandstueck[]>;
  faelle: Map<string, Bandstueck[]>;
  teiche: Map<string, { punkte: [number, number][] }[]>;
}

const schluessel = (ix: number, iz: number) => `${ix}:${iz}`;

/** In welcher Kachel liegt dieser Punkt? */
function kachelAn(feld: HoehenFeld, x: number, z: number): [number, number] {
  const nx = Math.ceil(feld.breiteMeter / KACHEL);
  const nz = Math.ceil(feld.tiefeMeter / KACHEL);
  return [
    Math.max(0, Math.min(nx - 1, Math.floor((x + feld.breiteMeter / 2) / KACHEL))),
    Math.max(0, Math.min(nz - 1, Math.floor((z + feld.tiefeMeter / 2) / KACHEL))),
  ];
}

function einsortieren<T>(karte: Map<string, T[]>, ix: number, iz: number, wert: T): void {
  const k = schluessel(ix, iz);
  const liste = karte.get(k);
  if (liste) liste.push(wert); else karte.set(k, [wert]);
}

/**
 * Linien und Wege einmal in Teilstücke zerlegen und den Kacheln zuordnen.
 *
 * Die Zerlegung auf `WEG_TEILUNG` ist dieselbe wie früher und aus demselben Grund:
 * OSM-Stützpunkte liegen oft dutzende Meter auseinander, und ein Band, das nur an
 * den Enden aufs Gelände gelegt wird, schneidet dazwischen durch Kuppen.
 *
 * Zugeordnet wird nach der **Mitte** des Teilstücks. Ein Stück kann damit ein Stück
 * weit in die Nachbarkachel ragen; bei 4 m Teilung und 64 m Kacheln sind das
 * höchstens 2 m, und die Naht behandelt die Schürze.
 */
export function zerlegeBaender(welt: Weltdaten, feld: HoehenFeld): Bandsatz {
  const [sued, west, nord, ost] = welt.bbox;
  const zuWelt = (lat: number, lon: number): [number, number] => [
    ((lon - west) / (ost - west) - 0.5) * feld.breiteMeter,
    ((nord - lat) / (nord - sued) - 0.5) * feld.tiefeMeter,
  ];
  const satz: Bandsatz = {
    wege: new Map(), baeche: new Map(), faelle: new Map(), teiche: new Map(),
  };

  const zerlegen = (
    punkte: readonly [number, number][], breite: number,
    ziel: Map<string, Bandstueck[]>, fallZiel: Map<string, Bandstueck[]> | null,
  ) => {
    const halbe = breite / (2 * MASSSTAB.stauchung);
    const halbeFall = Math.max(0.8, halbe);
    let laengs = 0;
    for (let k = 0; k < punkte.length - 1; k++) {
      const [ax, az] = zuWelt(...punkte[k]);
      const [bx, bz] = zuWelt(...punkte[k + 1]);
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz) || 1;
      const teile = Math.max(1, Math.ceil(len / WEG_TEILUNG));
      for (let t = 0; t < teile; t++) {
        const t1 = t / teile, t2 = (t + 1) / teile;
        const x1 = ax + dx * t1, z1 = az + dz * t1;
        const x2 = ax + dx * t2, z2 = az + dz * t2;
        // Der Wasserfall wird auf der feinen Fläche entschieden — der einen, die
        // sich mit der Kameraentfernung nicht ändert.
        const fall = fallZiel !== null
          && (hoeheAufFlaeche(feld, x1, z1) - hoeheAufFlaeche(feld, x2, z2))
             / Math.max(1, len / teile) >= WASSERFALL_AB;
        const b = halbe === 0 ? halbeFall : (fall ? halbeFall : halbe);
        const stueck: Bandstueck = {
          ax: x1, az: z1, bx: x2, bz: z2,
          nx: (-dz / len) * b, nz: (dx / len) * b,
          v1: laengs + len * t1, v2: laengs + len * t2, fall,
        };
        const [ix, iz] = kachelAn(feld, (x1 + x2) / 2, (z1 + z2) / 2);
        einsortieren(fall ? fallZiel! : ziel, ix, iz, stueck);
      }
      laengs += len;
    }
  };

  for (const linie of welt.linien) zerlegen(linie.punkte, linie.breite, satz.baeche, satz.faelle);
  for (const weg of welt.wege) zerlegen(weg.punkte, weg.breite, satz.wege, null);

  for (const teich of feld.teiche) {
    if (teich.punkte.length < 3) continue;
    let mx = 0, mz = 0;
    for (const [x, z] of teich.punkte) { mx += x; mz += z; }
    const [ix, iz] = kachelAn(feld, mx / teich.punkte.length, mz / teich.punkte.length);
    einsortieren(satz.teiche, ix, iz, teich);
  }
  return satz;
}

/** Wie tief die Naht zur nächstgröberen Kachel fallen kann. */
function naht(feld: HoehenFeld, x: number, z: number, y: number, lod: number,
              hoehe: (f: HoehenFeld, x: number, z: number, s: number) => number): number {
  if (lod >= LOD_STUFEN.length - 1) return 0;
  const luft = y - hoehe(feld, x, z, LOD_STUFEN[lod + 1].schritt);
  return luft < NAHT_AB ? 0 : Math.min(luft, NAHT_MAX);
}

/**
 * Ein liegendes Band für eine Kachel bauen.
 *
 * `ueber` ist der Aufschlag über dem Boden, `hoehe` die Quelle: Geländefläche für
 * Wege, Spiegelfläche für Bäche. Beide tasten auf dem Vertexraster **dieser**
 * LOD-Stufe ab — deshalb liegt das Band auf dem Dreieck und nicht daneben.
 */
function liegendesBand(
  feld: HoehenFeld, stuecke: readonly Bandstueck[], lod: number, ueber: number,
  hoehe: (f: HoehenFeld, x: number, z: number, s: number) => number,
  /** true = quer waagerecht halten (Wasser), false = dem Hang folgen (Weg). */
  quer: boolean,
  positionen: number[], uvs: number[],
): void {
  const s = LOD_STUFEN[Math.min(lod, LOD_STUFEN.length - 1)].schritt;
  for (const st of stuecke) {
    /**
     * Höhe an **jeder Ecke**, nicht auf der Mittellinie.
     *
     * Ein Band ist bis zu 12 m breit. Wird die Höhe nur in der Mitte bestimmt,
     * liegt es quer zum Hang waagerecht, das Gelände darunter aber nicht: Ein
     * 6-m-Weg auf 30 % Querneigung steht damit 0,9 m schief, eine Seite in der
     * Luft, die andere im Boden. Gemessen blieben nach dem Umbau auf Kacheln
     * genau daraus noch 18 % der Wegvertices über einem halben Meter — die
     * letzte Abweichung, die nicht vom LOD kam.
     *
     * Wasser bekommt beide Ränder auf die **tiefere** Seite: Ein Bach ist quer
     * waagerecht, und die höhere Böschung darf im Hang stecken.
     */
    const yl1 = hoehe(feld, st.ax - st.nx, st.az - st.nz, s);
    const yr1 = hoehe(feld, st.ax + st.nx, st.az + st.nz, s);
    const yl2 = hoehe(feld, st.bx - st.nx, st.bz - st.nz, s);
    const yr2 = hoehe(feld, st.bx + st.nx, st.bz + st.nz, s);
    const [l1, r1, l2, r2] = quer
      ? [Math.min(yl1, yr1), Math.min(yl1, yr1), Math.min(yl2, yr2), Math.min(yl2, yr2)]
      : [yl1, yr1, yl2, yr2];
    const al = l1 + ueber, ar = r1 + ueber, bl = l2 + ueber, br = r2 + ueber;
    positionen.push(
      st.ax - st.nx, al, st.az - st.nz,  st.ax + st.nx, ar, st.az + st.nz,
      st.bx - st.nx, bl, st.bz - st.nz,
      st.ax + st.nx, ar, st.az + st.nz,  st.bx + st.nx, br, st.bz + st.nz,
      st.bx - st.nx, bl, st.bz - st.nz,
    );
    // u = quer, -1 am linken Rand bis +1 am rechten. v = Meter in Laufrichtung.
    uvs.push(-1, st.v1,  1, st.v1,  -1, st.v2,   1, st.v1,  1, st.v2,  -1, st.v2);

    // Schürze nur gegen die Naht zur nächstgröberen Kachel. Innerhalb der eigenen
    // Kachel gibt es nichts zu decken — dort ist die Abweichung null.
    for (const seite of [-1, 1]) {
      const px = st.ax + st.nx * seite, pz = st.az + st.nz * seite;
      const qx = st.bx + st.nx * seite, qz = st.bz + st.nz * seite;
      const y1 = seite < 0 ? al : ar, y2 = seite < 0 ? bl : br;
      const s1 = naht(feld, px, pz, y1, lod, hoehe);
      const s2 = naht(feld, qx, qz, y2, lod, hoehe);
      if (s1 <= 0 && s2 <= 0) continue;
      // Nicht u = ±1: Dort setzt der Shader die Deckkraft auf null, die Wand wäre
      // unsichtbar. ±0,72 gibt ihr die Farbe des flachen Randes.
      const u = 0.72 * seite;
      positionen.push(
        px, y1, pz,  px, y1 - s1, pz,  qx, y2, qz,
        px, y1 - s1, pz,  qx, y2 - s2, qz,  qx, y2, qz,
      );
      uvs.push(u, st.v1,  u, st.v1,  u, st.v2,   u, st.v1,  u, st.v2,  u, st.v2);
    }
  }
}

function fertig(positionen: number[], uvs: number[]): THREE.BufferGeometry | null {
  if (!positionen.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function baueWegKachel(
  feld: HoehenFeld, satz: Bandsatz, kachel: Kachel, lod: number,
): THREE.BufferGeometry | null {
  const stuecke = satz.wege.get(schluessel(kachel.ix, kachel.iz));
  if (!stuecke) return null;
  const positionen: number[] = [], uvs: number[] = [];
  liegendesBand(feld, stuecke, lod, WEG_UEBER_GRUND, hoeheAufFlaeche, false, positionen, uvs);
  return fertig(positionen, uvs);
}

export function baueWasserKachel(
  feld: HoehenFeld, satz: Bandsatz, kachel: Kachel, lod: number,
): THREE.BufferGeometry | null {
  const k = schluessel(kachel.ix, kachel.iz);
  const stuecke = satz.baeche.get(k);
  const teiche = satz.teiche.get(k);
  if (!stuecke && !teiche) return null;
  const positionen: number[] = [], uvs: number[] = [];
  const s = LOD_STUFEN[Math.min(lod, LOD_STUFEN.length - 1)].schritt;
  if (stuecke) {
    liegendesBand(feld, stuecke, lod, WASSER_UEBER_GRUND, spiegelAufFlaeche, true, positionen, uvs);
  }
  for (const teich of teiche ?? []) {
    const p = teich.punkte;
    // Ein Teich ist waagerecht. Der Spiegel liegt auf dem tiefsten Punkt des Ufers:
    // höher liefe er über, tiefer bliebe ein Rand trockener Grube stehen.
    let spiegel = Infinity;
    for (const [x, z] of p) spiegel = Math.min(spiegel, spiegelAufFlaeche(feld, x, z, s));
    if (!Number.isFinite(spiegel)) continue;

    const UFER = 7;
    const uWert = (x: number, z: number): number => {
      let best = Infinity;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [x1, z1] = p[j], [x2, z2] = p[i];
        const dx = x2 - x1, dz = z2 - z1;
        const lq = dx * dx + dz * dz;
        const t = lq > 0 ? Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / lq)) : 0;
        best = Math.min(best, Math.hypot(x1 + dx * t - x, z1 + dz * t - z));
      }
      return 1 - Math.min(1, best / UFER);
    };

    // Umlaufsinn umdrehen: `triangulateShape` normalisiert den Außenring, und der
    // ergibt in three.js mit Y nach oben eine Normale nach unten (G-72).
    const punkte2d = p.map(([x, z]) => new THREE.Vector2(x, z));
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(punkte2d, [])) {
      for (const idx of [c, b, a]) {
        const v = punkte2d[idx];
        positionen.push(v.x, spiegel, v.y);
        uvs.push(uWert(v.x, v.y), 0);
      }
    }
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [x1, z1] = p[j], [x2, z2] = p[i];
      const s1 = Math.min(NAHT_MAX, Math.max(0, spiegel - hoeheAufFlaeche(feld, x1, z1, s)));
      const s2 = Math.min(NAHT_MAX, Math.max(0, spiegel - hoeheAufFlaeche(feld, x2, z2, s)));
      if (s1 < NAHT_AB && s2 < NAHT_AB) continue;
      positionen.push(
        x1, spiegel, z1,  x1, spiegel - s1, z1,  x2, spiegel, z2,
        x1, spiegel - s1, z1,  x2, spiegel - s2, z2,  x2, spiegel, z2,
      );
      for (let n = 0; n < 6; n++) uvs.push(0.72, 0);
    }
  }
  return fertig(positionen, uvs);
}

/**
 * Wasserfälle: stehende Flächen vom oberen zum unteren Punkt.
 *
 * `uv.y` läuft an der Wand nach unten, damit derselbe Shader die Strömung
 * senkrecht laufen lässt — ein Wasserfall braucht kein eigenes Material.
 */
export function baueFallKachel(
  feld: HoehenFeld, satz: Bandsatz, kachel: Kachel, lod: number,
): THREE.BufferGeometry | null {
  const stuecke = satz.faelle.get(schluessel(kachel.ix, kachel.iz));
  if (!stuecke) return null;
  const s = LOD_STUFEN[Math.min(lod, LOD_STUFEN.length - 1)].schritt;
  const positionen: number[] = [], uvs: number[] = [];
  for (const st of stuecke) {
    // Oben leicht angehoben, damit die Fläche an der Abrisskante nicht im
    // Gelände verschwindet.
    const oben = spiegelAufFlaeche(feld, st.ax, st.az, s) + 0.15;
    const unten = spiegelAufFlaeche(feld, st.bx, st.bz, s) - 0.1;
    if (oben - unten < 0.3) continue;
    positionen.push(
      st.ax - st.nx, oben, st.az - st.nz,  st.ax + st.nx, oben, st.az + st.nz,
      st.bx - st.nx, unten, st.bz - st.nz,
      st.ax + st.nx, oben, st.az + st.nz,  st.bx + st.nx, unten, st.bz + st.nz,
      st.bx - st.nx, unten, st.bz - st.nz,
    );
    const v2 = oben - unten;
    uvs.push(-1, 0,  1, 0,  -1, v2,   1, 0,  1, v2,  -1, v2);
  }
  return fertig(positionen, uvs);
}

/**
 * Alle Kacheln auf **einer** Stufe bauen — für Werkzeuge, die die Region als Ganzes
 * zählen oder ausgeben wollen.
 *
 * Die Szene benutzt das ausdrücklich nicht: Sie baut jede Kachel auf der Stufe, die
 * dort gilt. Wer hier `lod = 0` übergibt, bekommt die Region so, wie sie aus der
 * Nähe aussähe, wenn man überall stünde — eine nützliche Obergrenze, aber kein Bild
 * aus dem Spiel.
 */
export function baueBaenderStufe(
  feld: HoehenFeld, satz: Bandsatz, kacheln: readonly Kachel[], lod: number,
): { wege: THREE.BufferGeometry[]; wasser: THREE.BufferGeometry[]; faelle: THREE.BufferGeometry[] } {
  const wege: THREE.BufferGeometry[] = [];
  const wasser: THREE.BufferGeometry[] = [];
  const faelle: THREE.BufferGeometry[] = [];
  for (const k of kacheln) {
    const w = baueWegKachel(feld, satz, k, lod); if (w) wege.push(w);
    const b = baueWasserKachel(feld, satz, k, lod); if (b) wasser.push(b);
    const f = baueFallKachel(feld, satz, k, lod); if (f) faelle.push(f);
  }
  return { wege, wasser, faelle };
}
