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
import { PALETTE } from './palette.js';
import type { Weltdaten } from './osm.js';
import { MASSSTAB, WEG_TEILUNG, orientierteHuelle } from './terrain.js';
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
  /** Belag des Wegs — Farbe und Oberfläche. Bei Gewässern undefiniert. */
  belag?: Wegbelag;
}

/**
 * Wie ein Weg aussieht, je OSM-Klasse.
 *
 * In den Weltdaten stehen neun Klassen über 170,5 km — von `secondary` (8 m
 * Asphalt) bis `path` (1,6 m Trampelpfad). Gezeichnet wurden sie bis jetzt alle
 * mit **einer** Farbe und demselben Spurrinnenmuster; unterscheidbar waren sie nur
 * an der Breite. Eine Landstraße, die aussieht wie ein Trampelpfad, kostet mehr
 * Glaubwürdigkeit als jedes fehlende Modell.
 *
 * Alle drei Werte gehen als Vertexattribut ins Band, nicht als Material: Ein
 * zweites Material wäre ein zweiter Draw Call je Kachel, und das Wegnetz ist der
 * Teil der Szene mit den meisten Kacheln.
 */
export interface Wegbelag {
  /** Grundfarbe in sRGB-Hex. */
  farbe: string;
  /** Stärke der Spurrinnen, 0 = keine. Nur ausgefahrene Wege haben welche. */
  rinne: number;
  /** Wie stark der Rand ausfranst. Asphalt hat eine Kante, ein Pfad nicht. */
  franse: number;
}

export const WEGBELAG: Record<string, Wegbelag> = {
  // Asphalt: dunkel, geschlossen, scharfe Kante. Keine Rinnen — die entstehen
  // durch Räder auf losem Grund, nicht auf gebundener Decke.
  secondary:    { farbe: PALETTE.weg.secondary, rinne: 0,    franse: 0.15 },
  tertiary:     { farbe: PALETTE.weg.tertiary, rinne: 0,    franse: 0.18 },
  residential:  { farbe: PALETTE.weg.residential, rinne: 0,    franse: 0.25 },
  unclassified: { farbe: PALETTE.weg.unclassified, rinne: 0.1,  franse: 0.35 },
  cycleway:     { farbe: PALETTE.weg.cycleway, rinne: 0,    franse: 0.2 },
  // Hofzufahrt: Beton oder verdichteter Schotter, heller, zwei schwache Spuren.
  service:      { farbe: PALETTE.weg.service, rinne: 0.25, franse: 0.5 },
  // Feldweg: der Normalfall im Œntal, 71 km. Zwei ausgefahrene Spuren mit
  // Grasstreifen dazwischen, Rand völlig unscharf.
  track:        { farbe: PALETTE.weg.track, rinne: 0.55, franse: 1.0 },
  // Trampelpfad: zu schmal für Spuren, dafür kaum ein Rand.
  path:         { farbe: PALETTE.weg.path, rinne: 0,    franse: 1.2 },
  footway:      { farbe: PALETTE.weg.footway, rinne: 0,    franse: 1.1 },
};

/** Für eine Klasse, die in WEGBELAG fehlt — sichtbar neutral, nicht heimlich. */
const BELAG_STANDARD: Wegbelag = { farbe: PALETTE.weg.standard, rinne: 0.2, franse: 0.6 };

/** Welche Klassen in den Weltdaten keinen Eintrag haben. Für Werkzeuge. */
export const belagFehlt = new Set<string>();

function belagFuer(art: string): Wegbelag {
  const b = WEGBELAG[art];
  if (b) return b;
  belagFehlt.add(art);
  return BELAG_STANDARD;
}

/**
 * Ein Hausgarten: eine eingezäunte Parzelle mit Beeten an der Rückseite des Hauses.
 *
 * Warum überhaupt: Ein Dorf ohne Gärten ist eine Ansammlung von Häusern. Der
 * Garten ist das, was einen Grundriss zu einem bewohnten Grundstück macht — und
 * er kostet weniger als ein einziger Baum, weil er aus Kästen besteht.
 */
export interface Garten {
  /** Vier Ecken der Parzelle in Weltkoordinaten, im Umlaufsinn. */
  ecken: [number, number][];
  /** Richtung der Beetreihen — dieselbe Achse wie der First des Hauses. */
  achse: number;
}

/** Alles, was auf dem Gelände aufliegt, nach Kachel sortiert. */
export interface Bandsatz {
  wege: Map<string, Bandstueck[]>;
  baeche: Map<string, Bandstueck[]>;
  faelle: Map<string, Bandstueck[]>;
  teiche: Map<string, { punkte: [number, number][] }[]>;
  /** Indizes in `welt.gebaeude` je Kachel — Häuser fallen mit der Entfernung weg. */
  gebaeude: Map<string, number[]>;
  gaerten: Map<string, Garten[]>;
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
    gebaeude: new Map(), gaerten: new Map(),
  };

  const zerlegen = (
    punkte: readonly [number, number][], breite: number,
    ziel: Map<string, Bandstueck[]>, fallZiel: Map<string, Bandstueck[]> | null,
    belag?: Wegbelag,
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
          v1: laengs + len * t1, v2: laengs + len * t2, fall, belag,
        };
        const [ix, iz] = kachelAn(feld, (x1 + x2) / 2, (z1 + z2) / 2);
        einsortieren(fall ? fallZiel! : ziel, ix, iz, stueck);
      }
      laengs += len;
    }
  };

  for (const linie of welt.linien) zerlegen(linie.punkte, linie.breite, satz.baeche, satz.faelle);
  for (const weg of welt.wege) zerlegen(weg.punkte, weg.breite, satz.wege, null, belagFuer(weg.art));

  // Nach den Wegen, weil die Gartenprüfung sie braucht: Ein Beet auf der
  // Dorfstraße ist schlimmer als kein Beet.
  gebaeudeUndGaerten(welt, feld, zuWelt, satz);

  for (const teich of feld.teiche) {
    if (teich.punkte.length < 3) continue;
    let mx = 0, mz = 0;
    for (const [x, z] of teich.punkte) { mx += x; mz += z; }
    const [ix, iz] = kachelAn(feld, mx / teich.punkte.length, mz / teich.punkte.length);
    einsortieren(satz.teiche, ix, iz, teich);
  }
  return satz;
}

/**
 * Welche OSM-Gebäudearten bewohnt sind.
 *
 * `yes` ist mit 1.685 von 2.033 der Normalfall und muss dabei sein, sonst hätte
 * das Œntal fünf Gärten. Garagen, Kirchen, Ställe und Hallen bekommen keinen —
 * ein Gemüsebeet an einer Werkshalle wäre schlechter als gar keins.
 */
const WOHNT: ReadonlySet<string> = new Set([
  'yes', 'house', 'detached', 'semidetached_house', 'apartments', 'farm', 'hut',
  'residential', 'bungalow', 'terrace',
]);

/**
 * Tiefen, die für die Parzelle nacheinander versucht werden.
 *
 * Mit nur 7 m bekam der Dorfkern fünf Gärten auf 63 Häuser: Dort steht das
 * nächste Haus keine sieben Meter weiter, und die Parzelle fiel jedes Mal an der
 * Nachbarbebauung durch — also genau dort, wo Gärten am dichtesten sind. Ein
 * Reihenhausgarten ist eben schmal; die Staffelung bildet das ab, statt die
 * Prüfung zu lockern.
 */
const GARTEN_TIEFEN = [7, 5, 3.5, 2.4];
/** Breiter als das wird kein Garten, auch nicht hinter einem langen Hof. */
const GARTEN_BREITE_MAX = 13;
/** Über diesen Höhenunterschied auf der Parzelle steht kein Beet mehr. */
const GARTEN_STEIGUNG = 2.0;

/**
 * Gebäude den Kacheln zuordnen und dahinter Gärten setzen.
 *
 * Die Parzelle liegt auf der **Rückseite** — der Balkon sitzt auf `+v`, der Garten
 * also auf `-v`. Verworfen wird sie, wenn sie in ein anderes Gebäude ragt oder auf
 * zu steilem Gelände liegt; beides prüft ein Raster über die Grundriss-Hüllen,
 * damit aus 2.033 × 2.033 Vergleichen ein Durchlauf wird.
 */
function gebaeudeUndGaerten(
  welt: Weltdaten, feld: HoehenFeld,
  zuWelt: (lat: number, lon: number) => [number, number], satz: Bandsatz,
): void {
  const huellen = welt.gebaeude.map(g => {
    const p = g.punkte.map(([lat, lon]) => zuWelt(lat, lon));
    const xs = p.map(q => q[0]), zs = p.map(q => q[1]);
    return { p, minX: Math.min(...xs), maxX: Math.max(...xs),
             minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  });

  // Raster über die Grundrisse: 32 m Zellen, damit die Überlappungsprüfung nicht
  // quadratisch wird.
  const RASTER = 32;
  const eimer = new Map<string, number[]>();
  huellen.forEach((h, i) => {
    for (let cx = Math.floor(h.minX / RASTER); cx <= Math.floor(h.maxX / RASTER); cx++)
      for (let cz = Math.floor(h.minZ / RASTER); cz <= Math.floor(h.maxZ / RASTER); cz++) {
        const k = `${cx}:${cz}`;
        const l = eimer.get(k); if (l) l.push(i); else eimer.set(k, [i]);
      }
  });
  const stoerer = (minX: number, maxX: number, minZ: number, maxZ: number, selbst: number) => {
    for (let cx = Math.floor(minX / RASTER); cx <= Math.floor(maxX / RASTER); cx++)
      for (let cz = Math.floor(minZ / RASTER); cz <= Math.floor(maxZ / RASTER); cz++)
        for (const i of eimer.get(`${cx}:${cz}`) ?? []) {
          if (i === selbst) continue;
          const h = huellen[i];
          if (h.minX < maxX && h.maxX > minX && h.minZ < maxZ && h.maxZ > minZ) return true;
        }
    return false;
  };

  /**
   * Liegt die Parzelle auf einem Weg?
   *
   * Geprüft wird gegen die schon zerlegten Wegstücke der umliegenden Kacheln, mit
   * der halben Bandbreite als Aufschlag. Grob genug, um konservativ zu sein: Im
   * Zweifel fällt ein Garten weg, statt auf der Straße zu liegen.
   */
  const aufWeg = (minX: number, maxX: number, minZ: number, maxZ: number) => {
    const [kx0, kz0] = kachelAn(feld, minX, minZ);
    const [kx1, kz1] = kachelAn(feld, maxX, maxZ);
    for (let cx = kx0 - 1; cx <= kx1 + 1; cx++)
      for (let cz = kz0 - 1; cz <= kz1 + 1; cz++)
        for (const st of satz.wege.get(schluessel(cx, cz)) ?? []) {
          const halbe = Math.hypot(st.nx, st.nz) + 0.6;
          if (Math.min(st.ax, st.bx) - halbe < maxX && Math.max(st.ax, st.bx) + halbe > minX
           && Math.min(st.az, st.bz) - halbe < maxZ && Math.max(st.az, st.bz) + halbe > minZ)
            return true;
        }
    return false;
  };

  welt.gebaeude.forEach((g, i) => {
    const h = huellen[i];
    const mx = (h.minX + h.maxX) / 2, mz = (h.minZ + h.maxZ) / 2;
    const [kx, kz] = kachelAn(feld, mx, mz);
    einsortieren(satz.gebaeude, kx, kz, i);

    if (!WOHNT.has(g.art) || g.ebenen > 2 || h.p.length < 4) return;
    const hu = orientierteHuelle(h.p);
    const flaeche = (hu.maxU - hu.minU) * (hu.maxV - hu.minV);
    if (flaeche < 45) return;

    const mitte = (hu.minU + hu.maxU) / 2;
    const halb = Math.min(GARTEN_BREITE_MAX, hu.maxU - hu.minU) / 2;
    for (const tiefe of GARTEN_TIEFEN) {
      const v0 = hu.minV - 1.0, v1 = v0 - tiefe;
      const ecken: [number, number][] = [
        hu.welt(mitte - halb, v0), hu.welt(mitte + halb, v0),
        hu.welt(mitte + halb, v1), hu.welt(mitte - halb, v1),
      ];
      const xs = ecken.map(e => e[0]), zs = ecken.map(e => e[1]);
      const bx0 = Math.min(...xs), bx1 = Math.max(...xs);
      const bz0 = Math.min(...zs), bz1 = Math.max(...zs);
      if (stoerer(bx0, bx1, bz0, bz1, i)) continue;
      if (aufWeg(bx0, bx1, bz0, bz1)) continue;

      let hoch = -Infinity, tief = Infinity;
      for (const [x, z] of [...ecken, [(xs[0] + xs[2]) / 2, (zs[0] + zs[2]) / 2] as [number, number]]) {
        const y = hoeheAufFlaeche(feld, x, z);
        hoch = Math.max(hoch, y); tief = Math.min(tief, y);
      }
      if (hoch - tief > GARTEN_STEIGUNG) continue;

      einsortieren(satz.gaerten, kx, kz, { ecken, achse: hu.achse });
      return;
    }
  });
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
  /** Nur für Wege: Farbe und Oberfläche je Vertex. */
  farben?: number[], belaege?: number[],
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
    if (farben && belaege) belagSchreiben(st, 6, farben, belaege);

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
      if (farben && belaege) belagSchreiben(st, 6, farben, belaege);
    }
  }
}

/** sRGB-Hex zu linear — three.js rechnet Vertexfarben im linearen Raum. */
function linear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const k = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return [k((n >> 16) & 255), k((n >> 8) & 255), k(n & 255)];
}

const FARBCACHE = new Map<string, [number, number, number]>();

function belagSchreiben(st: Bandstueck, n: number, farben: number[], belaege: number[]): void {
  const b = st.belag ?? BELAG_STANDARD;
  let f = FARBCACHE.get(b.farbe);
  if (!f) { f = linear(b.farbe); FARBCACHE.set(b.farbe, f); }
  for (let i = 0; i < n; i++) {
    farben.push(f[0], f[1], f[2]);
    belaege.push(b.rinne, b.franse);
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
  const farben: number[] = [], belaege: number[] = [];
  liegendesBand(feld, stuecke, lod, WEG_UEBER_GRUND, hoeheAufFlaeche, false,
                positionen, uvs, farben, belaege);
  const g = fertig(positionen, uvs);
  if (!g) return null;
  g.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  g.setAttribute('belag', new THREE.Float32BufferAttribute(belaege, 2));
  return g;
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

/** Zwischenstützen des Fallstreifens auf dem Gelände, in Metern (D133). */
const FALL_STUETZE = 1.5;
/** Hub des Streifens über dem Spiegel: Abrisskante, Lauf, Fuß im Becken (D133). */
const FALL_HUB = { kopf: 0.15, lauf: 0.04, fuss: -0.1 };

/**
 * Welche Fallenden sind echte Köpfe und Füße — kein anderes Stück endet bzw.
 * beginnt dort. Einmal je Bandsatz, über alle Kacheln, sonst bekäme ein Fall,
 * der eine Kachelgrenze kreuzt, an der Grenze einen zweiten Kopf.
 */
const fallEnden = new WeakMap<Bandsatz, { anfaenge: Set<string>; enden: Set<string> }>();
const endeKey = (x: number, z: number) => `${Math.round(x * 1000)}:${Math.round(z * 1000)}`;
function fallEndenVon(satz: Bandsatz) {
  let e = fallEnden.get(satz);
  if (!e) {
    e = { anfaenge: new Set(), enden: new Set() };
    for (const liste of satz.faelle.values()) for (const st of liste) {
      e.anfaenge.add(endeKey(st.ax, st.az)); e.enden.add(endeKey(st.bx, st.bz));
    }
    fallEnden.set(satz, e);
  }
  return e;
}

/**
 * Wasserfälle: ein **verbundener Streifen** vom Kopf bis zum Fuß (D133).
 *
 * Vorher war jedes Stück ein eigenes Viereck, oben 0,15 m über dem Spiegel und
 * unten 0,1 m darunter — an jeder Naht zwischen zwei Stücken also ein Absatz von
 * 0,25 m, und die Strähnen des Shaders fingen an jeder Naht bei `uv.y = 0` neu an.
 * In der Lupe an der Kaskade (907, 660) war das eine Treppe aus Platten. Jetzt
 * werden aufeinanderfolgende Stücke zu einer Kette, die Kette bekommt alle
 * `FALL_STUETZE` eine Stütze auf dem Gelände, an Knicken einen gemittelten
 * Querschnitt, und der Hub gilt nur am echten Kopf und am echten Fuß.
 *
 * `uv.y` läuft kumuliert als Fallhöhe nach unten, damit derselbe Shader die
 * Strömung senkrecht und ohne Sprung laufen lässt — ein Wasserfall braucht kein
 * eigenes Material.
 */
export function baueFallKachel(
  feld: HoehenFeld, satz: Bandsatz, kachel: Kachel, lod: number,
): THREE.BufferGeometry | null {
  const stuecke = satz.faelle.get(schluessel(kachel.ix, kachel.iz));
  if (!stuecke) return null;
  const s = LOD_STUFEN[Math.min(lod, LOD_STUFEN.length - 1)].schritt;
  const enden = fallEndenVon(satz);
  const positionen: number[] = [], uvs: number[] = [];

  // Ketten: das Ende eines Stücks ist der Anfang des nächsten.
  const ketten: Bandstueck[][] = [];
  for (const st of stuecke) {
    const k = ketten[ketten.length - 1];
    const letztes = k?.[k.length - 1];
    if (letztes && endeKey(letztes.bx, letztes.bz) === endeKey(st.ax, st.az)) k.push(st);
    else ketten.push([st]);
  }

  for (const kette of ketten) {
    const knoten: { x: number; z: number; nx: number; nz: number; y: number }[] = [];
    for (let i = 0; i < kette.length; i++) {
      const st = kette[i];
      const naechstes = kette[i + 1];
      const len = Math.hypot(st.bx - st.ax, st.bz - st.az);
      const teile = Math.max(1, Math.ceil(len / FALL_STUETZE));
      for (let t = i === 0 ? 0 : 1; t <= teile; t++) {
        const f = t / teile;
        const x = st.ax + (st.bx - st.ax) * f, z = st.az + (st.bz - st.az) * f;
        let nx = st.nx, nz = st.nz;
        if (t === teile && naechstes) {
          // Gemittelter Querschnitt am Knick, auf die halbe Breite zurückgeführt.
          const mx = st.nx + naechstes.nx, mz = st.nz + naechstes.nz;
          const ml = Math.hypot(mx, mz) || 1, halbe = Math.hypot(st.nx, st.nz);
          nx = (mx / ml) * halbe; nz = (mz / ml) * halbe;
        }
        const kopf = t === 0 && !enden.enden.has(endeKey(x, z));
        const fuss = t === teile && !naechstes && !enden.anfaenge.has(endeKey(x, z));
        const hub = kopf ? FALL_HUB.kopf : fuss ? FALL_HUB.fuss : FALL_HUB.lauf;
        knoten.push({ x, z, nx, nz, y: spiegelAufFlaeche(feld, x, z, s) + hub });
      }
    }
    if (knoten.length < 2 || knoten[0].y - knoten[knoten.length - 1].y < 0.3) continue;

    let v = 0;
    for (let i = 1; i < knoten.length; i++) {
      const o = knoten[i - 1], u = knoten[i];
      const vo = v;
      v += Math.max(0.05, o.y - u.y);
      positionen.push(
        o.x - o.nx, o.y, o.z - o.nz,  o.x + o.nx, o.y, o.z + o.nz,  u.x - u.nx, u.y, u.z - u.nz,
        o.x + o.nx, o.y, o.z + o.nz,  u.x + u.nx, u.y, u.z + u.nz,  u.x - u.nx, u.y, u.z - u.nz,
      );
      uvs.push(-1, vo,  1, vo,  -1, v,   1, vo,  1, v,  -1, v);
    }
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

// ------------------------------------------------------------- Gärten

/** Farben des Gartens — Zaun, Erde, Grün. Aus derselben Palette wie alles andere. */
const ZAUN = [0x4f, 0x44, 0x36], ERDE = [0x54, 0x4c, 0x37], KRAUT = [0x55, 0x70, 0x3a];

function linearAus(rgb: number[]): [number, number, number] {
  const k = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return [k(rgb[0]), k(rgb[1]), k(rgb[2])];
}

/**
 * Ein Garten je Kachel: Zaun aus Pfosten und zwei Riegeln, dahinter drei Beete.
 *
 * Alles steht auf `hoeheAufFlaeche` **dieser** LOD-Stufe, aus demselben Grund wie
 * die Bänder: Ein Zaunpfosten, der auf der feinen Fläche gesetzt wird, hängt in
 * der Ferne über dem gröberen Netz.
 *
 * Kästen ohne Deckel und Boden — 8 Dreiecke je Pfosten statt 12. Von oben sieht
 * man in einen 1,05 m hohen Zaunpfosten nicht hinein.
 */
export function baueGartenKachel(
  feld: HoehenFeld, satz: Bandsatz, kachel: Kachel, lod: number,
): THREE.BufferGeometry | null {
  const gaerten = satz.gaerten.get(schluessel(kachel.ix, kachel.iz));
  if (!gaerten) return null;
  const s = LOD_STUFEN[Math.min(lod, LOD_STUFEN.length - 1)].schritt;
  const positionen: number[] = [], farben: number[] = [];

  const flaeche = (
    a: [number, number, number], b: [number, number, number],
    c: [number, number, number], d: [number, number, number], f: [number, number, number],
  ) => {
    positionen.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) farben.push(f[0], f[1], f[2]);
  };
  /** Kasten ohne Deckel und Boden, achsparallel zur Gartenachse. */
  const kasten = (
    x: number, z: number, y: number, bx: number, bz: number, hoch: number,
    cos: number, sin: number, f: [number, number, number],
  ) => {
    const e = (du: number, dv: number): [number, number] =>
      [x + du * cos - dv * sin, z + du * sin + dv * cos];
    const p1 = e(-bx, -bz), p2 = e(bx, -bz), p3 = e(bx, bz), p4 = e(-bx, bz);
    const ring = [p1, p2, p3, p4];
    for (let i = 0; i < 4; i++) {
      const a = ring[i], b = ring[(i + 1) % 4];
      flaeche([a[0], y, a[1]], [b[0], y, b[1]],
              [b[0], y + hoch, b[1]], [a[0], y + hoch, a[1]], f);
    }
  };

  const zaunF = linearAus(ZAUN), erdeF = linearAus(ERDE), krautF = linearAus(KRAUT);

  for (const garten of gaerten) {
    const cos = Math.cos(garten.achse), sin = Math.sin(garten.achse);
    const e = garten.ecken;
    const boden = (x: number, z: number) => hoeheAufFlaeche(feld, x, z, s);

    // Zaun: Pfosten alle 2,4 m, zwei Riegel dazwischen.
    for (let i = 0; i < 4; i++) {
      const [ax, az] = e[i], [bx, bz] = e[(i + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(2, Math.round(len / 3.0));
      for (let k = 0; k <= n; k++) {
        const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
        kasten(x, z, boden(x, z), 0.055, 0.055, 1.05, cos, sin, zaunF);
      }
      // Riegel als flache Bänder auf halber und voller Höhe.
      for (const [hoehe, dick] of [[0.42, 0.05], [0.86, 0.05]] as [number, number][]) {
        const y1 = boden(ax, az) + hoehe, y2 = boden(bx, bz) + hoehe;
        flaeche([ax, y1, az], [bx, y2, bz], [bx, y2 + dick * 2, bz], [ax, y1 + dick * 2, az], zaunF);
      }
    }

    // Beete: drei Streifen quer zur langen Achse, dazwischen Weg.
    const mx = (e[0][0] + e[2][0]) / 2, mz = (e[0][1] + e[2][1]) / 2;
    const laengs = Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]) / 2 - 0.9;
    const quer = Math.hypot(e[2][0] - e[1][0], e[2][1] - e[1][1]) / 2 - 0.9;
    // Bei einer schmalen Parzelle passt nur ein Beet — drei Streifen auf 2,4 m
    // Tiefe wären übereinander gestapelte Kästen.
    const streifen = quer > 2.2 ? [-1, 0, 1] : quer > 1.2 ? [-0.6, 0.6] : [0];
    for (const b of streifen) {
      const dv = b * quer * 0.6;
      const cx = mx - dv * sin, cz = mz + dv * cos;
      const y = boden(cx, cz);
      kasten(cx, cz, y, laengs, 0.62, 0.22, cos, sin, erdeF);
      // Deckel des Beets, damit man von oben Erde sieht und nicht durch.
      const deck = (du: number, dv2: number): [number, number] =>
        [cx + du * cos - dv2 * sin, cz + du * sin + dv2 * cos];
      const d1 = deck(-laengs, -0.62), d2 = deck(laengs, -0.62),
            d3 = deck(laengs, 0.62), d4 = deck(-laengs, 0.62);
      flaeche([d1[0], y + 0.22, d1[1]], [d4[0], y + 0.22, d4[1]],
              [d3[0], y + 0.22, d3[1]], [d2[0], y + 0.22, d2[1]], erdeF);
      /* Pflanzenreihe als Vierflächner, nicht als Kasten.
       *
       * Ein Kohlkopf braucht vier Dreiecke, kein Kästchen aus acht. Bei drei
       * Beeten je Garten und rund 900 Gärten ist das der Unterschied zwischen
       * 399.000 und 200.000 Dreiecken in der Region — sichtbar wird davon
       * nichts, ein Beet sieht man aus zwei Metern Höhe von schräg oben. */
      const stueck = Math.max(2, Math.round(laengs * 2 / 1.3));
      for (let k = 0; k < stueck; k++) {
        const du = -laengs + (k + 0.5) * (2 * laengs) / stueck;
        const [px, pz] = deck(du, 0);
        const r = 0.19, spitze: [number, number, number] = [px, y + 0.2 + 0.36, pz];
        const ring: [number, number][] = [
          deck(du - r, -r), deck(du + r, -r), deck(du + r, r), deck(du - r, r),
        ];
        for (let i = 0; i < 4; i++) {
          const a = ring[i], b = ring[(i + 1) % 4];
          positionen.push(a[0], y + 0.2, a[1], b[0], y + 0.2, b[1], ...spitze);
          for (let n = 0; n < 3; n++) farben.push(krautF[0], krautF[1], krautF[2]);
        }
      }
    }
  }

  if (!positionen.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  // Gärten werden mit den Häusern zu einer Geometrie gefasst (`LodBaender`), und
  // `mergeGeometries` verlangt dieselben Attribute: Ein Beet hat keine Fenster,
  // also Glut 0 (D134). Ohne die Zeile fiel die ganze Hauskachel still aus dem Bild.
  g.setAttribute('glut', new THREE.Float32BufferAttribute(new Float32Array(positionen.length / 3), 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
