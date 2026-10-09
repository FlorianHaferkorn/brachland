/**
 * BRACHLAND — Props und Vegetation
 *
 * Streut Bäume, Findlinge und Büsche über das Terrain. Der wirksamste Hebel für
 * die Landschaftsqualität — ein Terrain-Mesh allein sieht nie gut aus, egal wie fein.
 *
 * Deterministisch über einen Seed: dieselbe Region sieht bei jedem Laden gleich aus,
 * ohne dass Positionen gespeichert werden müssen. Wichtig für die Offline-PWA —
 * ~40.000 Props als JSON wären mehrere Megabyte, der Seed ist eine Zahl.
 */
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import BAEUME_REGISTER from '../../public/props/baeume.json';
import type { Weltdaten, Biom } from './osm.js';
import type { TerrainErgebnis } from './terrain.js';
import { MASSSTAB } from './terrain.js';

export type PropArt = 'nadelbaum' | 'laubbaum' | 'busch' | 'findling' | 'grasbuschel' | 'totholz'
                    | 'blume' | 'pilz' | 'farn';

/**
 * Props je Hektar und Biom.
 *
 * Die Ausgangswerte (Wald: 18 Nadelbäume/ha) waren eine Parklandschaft — ein
 * bewirtschafteter Fichtenbestand trägt 400 bis 1000 Stämme je Hektar. Voll
 * realistisch geht nicht: Bei 420 m Sichtweite wären das über zwei Millionen
 * Dreiecke gegen ein Handybudget von 400.000.
 *
 * Diese Werte sind das, was das Budget hergibt — rund fünffach dichter als vorher
 * und damit als Wald lesbar, aber weiter licht. Der nächste Hebel wären
 * Fernattrappen statt voller Modelle (Ledger G-15), nicht noch mehr Dichte.
 */
export const DICHTE: Record<Biom, Partial<Record<PropArt, number>>> = {
  // D212/D216: Farn als Waldunterwuchs, in Beständen (`farnBestand`). Gesät werden 700/ha, stehen
  // bleiben rund 45 % — im Bestand bis 700/ha (ein Stock je 14 m²), dazwischen nackter Boden.
  // Gleichverteilt (D212, 350/ha) las sich aus Spielerhöhe als vereinzelte Pflanze, nicht als Farn.
  wald:      { nadelbaum: 95, laubbaum: 32, busch: 26, totholz: 8, grasbuschel: 30, pilz: 14, blume: 4, farn: 700 },
  gebuesch:  { busch: 55, nadelbaum: 6, findling: 5, grasbuschel: 34, blume: 9, farn: 25 },
  wiese:     { grasbuschel: 40, busch: 3, laubbaum: 1.2, blume: 22 },
  acker:     { grasbuschel: 8, blume: 2 },
  fels:      { findling: 18, busch: 4, nadelbaum: 1.6, grasbuschel: 6 },
  wasser:    {},
  // Siedlung: siehe den Block unter dieser Tabelle. Kurz — ein bayerisches Dorf ist
  // nicht leerer als die Wiese daneben, sondern anders bewachsen: weniger Horstgras,
  // deutlich mehr Holz.
  siedlung:  { laubbaum: 22, nadelbaum: 3, busch: 34, grasbuschel: 20, blume: 14, totholz: 3 },
  industrie: { busch: 4, totholz: 3, grasbuschel: 9 },
  ruine:     { busch: 9, totholz: 5, findling: 5, grasbuschel: 14, blume: 3 },
  unbekannt: { grasbuschel: 10 },
};

/**
 * Warum `siedlung` von 31 auf 96 je Hektar gegangen ist.
 *
 * Die alten Werte (`laubbaum: 6, busch: 7, grasbuschel: 12, blume: 6`) wurden
 * gesetzt, als `siedlung` 48 ha gross war und aus `landuse=residential` kam. Seit
 * die Siedlung aus den Gebäuden selbst gestempelt wird (D74), sind es 177,5 ha —
 * grösstenteils vormalige Wiese. Gemessen (`npm run dichte`) ergab das:
 *
 *   - Siedlung trug **25 Props je Hektar**, Wiese 66, freie Flur 128. Das Dorf war
 *     die kahlste Fläche der Karte ausser dem Acker.
 *   - Im dichtesten Ortskern standen auf **einem Hektar mit 25 Gebäuden ganze 30
 *     Props** — fünf Bäume, sechs Büsche, zwölf Grasbüschel, sieben Blumen.
 *   - Der Stempel hatte dem Bewuchs unterm Strich **6.249 Props entzogen**: +852
 *     Bäume und +710 Büsche gegen −4.971 Grasbüschel und −2.840 Blumen.
 *
 * Der Fehler war nicht die Regel, sondern die stehengebliebene Tabelle. Als
 * Bezugsgrösse dienen jetzt gemessene Werte statt einer Setzung:
 *
 *   - **Bäume: 18 je Hektar Siedlungsfläche.** Abgeleitet aus 9,8 % Kronenanteil an
 *     der Siedlungs- und Verkehrsfläche (BBSR/IÖR, „Wie grün sind deutsche Städte?",
 *     2022, Datenstand 2018) bei 60 m² mittlerer Kronenfläche — dem Median der an
 *     rund 2.000 bayerischen Stadtbäumen gemessenen Kronendurchmesser (ZSK/TUM,
 *     2019). Kleinstädte liegen 10,6 % über dem Bundesmittel, also rund 18.
 *     Tabellenwert 25 (22 Laub + 3 Nadel), weil Neigungs-, Haus- und Wegfilter
 *     rund ein Viertel wieder wegnehmen.
 *   - **Sträucher: 34.** Schwächste Zahl hier. Aus 40–80 lfm Hecke je Hektar
 *     (ANL-Landschaftspflegekonzept „Hecken", 1997, Feldflurwert) × 2–3 m Breite ×
 *     0,44 Pflanzen je m² (KULAP-Pflanzabstand) folgen 35–105 Sträucher je Hektar.
 *     Zierstraucher in Hausgärten sind in keiner Quelle erfasst. Genommen wird das
 *     untere Ende. ⚠️ UNKLAR: zwei unbelegte Übertragungen (Feldflur → Ortslage,
 *     Heckenbreite), Unsicherheit Faktor 3.
 *   - **Bodendeckung: 20 Grasbüschel und 14 Blumen** gegen 40 und 22 auf der Wiese.
 *     Rund 51 % einer bayerischen Siedlungs-Hektare sind versiegelt (LfU Bayern,
 *     Satellitenstudie 2015, ländlicher Raum: 51,2 %), grünbedeckt sind 35–39 %.
 *     Der Rest ist gemähter Rasen, und Rasen trägt keine Horste — darum die Hälfte
 *     der Wiese, nicht 37 % davon.
 *   - **Totholz: 3.** Der Holzstoss an der Hauswand. `totholz_stapel` ist genau das
 *     Modell dafür, und es stand bisher nur im Wald.
 *
 * Ungelöst bleibt die Struktur: Ortskern und Ortsrand tragen dieselbe Zahl, obwohl
 * die Quellen 8–12 Bäume je Hektar für dichte Bebauung und 50–100 für den
 * Streuobstgürtel am Ortsrand nennen. Das braucht ein eigenes Biom, keine Zahl
 * (Ledger A-x).
 */

/**
 * Sichtweite je Art. Kleinzeug jenseits davon wird gar nicht erst gezeichnet —
 * bei Nebel ab 420 m sieht man es ohnehin nicht, es kostet aber volle Dreiecke.
 */
export const SICHTWEITE: Record<PropArt, number> = {
  nadelbaum: 420, laubbaum: 420, findling: 300,
  busch: 180, totholz: 160, grasbuschel: 90,
  // Eine Blume ist 25 cm hoch und ein Pilz 15 — jenseits von 45 m sind sie
  // weniger als ein Pixel und kosten trotzdem einen ganzen Draw Call je Chunk.
  blume: 55, pilz: 45,
  // Farn trägt eine Silhouette wie ein kleiner Busch; ab 110 m ist er Bodentextur.
  farn: 110,
};

/** Ab dieser Neigung wächst nichts mehr — verhindert Bäume an Felswänden. */
const MAX_NEIGUNG_GRAD: Partial<Record<PropArt, number>> = {
  nadelbaum: 38, laubbaum: 32, busch: 45, totholz: 35, grasbuschel: 40, findling: 60,
  blume: 35, pilz: 30, farn: 42,
};

export interface PropInstanz {
  art: PropArt;
  /** Index in VARIANTEN[art] — Abwechslung ohne zusätzliche Daten. */
  variante: number;
  position: [number, number, number];
  drehung: number;
  skalierung: number;
}

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Steht dieser Punkt in einem Gebäude?
 *
 * Die Prop-Verteilung kannte Grundrisse nicht: Gemessen standen **2.416 von
 * 172.220 Props in einem Haus** (1,4 %), darunter 96 Laubbäume und 28 Fichten.
 * Ein Grasbüschel im Wohnzimmer sieht man nicht, einen Baum durch das Dach schon.
 *
 * Ein Raster über die Grundriss-Hüllen macht aus 172.000 × 2.033 Vergleichen einen
 * Durchlauf; erst wenn die Hülle passt, wird das Polygon geprüft.
 */
function hausTest(
  welt: Weltdaten, terrain: TerrainErgebnis,
): (x: number, z: number) => boolean {
  const [sued, west, nord, ost] = welt.bbox;
  const zuWelt = (lat: number, lon: number): [number, number] => [
    ((lon - west) / (ost - west) - 0.5) * terrain.breiteMeter,
    ((nord - lat) / (nord - sued) - 0.5) * terrain.tiefeMeter,
  ];
  /** Abstand zur Wand, den ein Prop mindestens hält. */
  const RAND = 0.7;
  const RASTER = 32;
  const huellen = welt.gebaeude.map(g => {
    const p = g.punkte.map(([lat, lon]) => zuWelt(lat, lon));
    const xs = p.map(q => q[0]), zs = p.map(q => q[1]);
    return { p, minX: Math.min(...xs) - RAND, maxX: Math.max(...xs) + RAND,
             minZ: Math.min(...zs) - RAND, maxZ: Math.max(...zs) + RAND };
  });
  const eimer = new Map<string, number[]>();
  huellen.forEach((h, i) => {
    for (let cx = Math.floor(h.minX / RASTER); cx <= Math.floor(h.maxX / RASTER); cx++)
      for (let cz = Math.floor(h.minZ / RASTER); cz <= Math.floor(h.maxZ / RASTER); cz++) {
        const k = `${cx}:${cz}`;
        const l = eimer.get(k); if (l) l.push(i); else eimer.set(k, [i]);
      }
  });
  return (x, z) => {
    const kandidaten = eimer.get(`${Math.floor(x / RASTER)}:${Math.floor(z / RASTER)}`);
    if (!kandidaten) return false;
    for (const i of kandidaten) {
      const h = huellen[i];
      if (x < h.minX || x > h.maxX || z < h.minZ || z > h.maxZ) continue;
      // Strahlverfahren gegen den Grundriss selbst — die Hülle ist nur der Filter.
      let drin = false;
      const p = h.p;
      for (let a = 0, b = p.length - 1; a < p.length; b = a++) {
        const [xa, za] = p[a], [xb, zb] = p[b];
        if ((za > z) !== (zb > z) && x < ((xb - xa) * (z - za)) / (zb - za) + xa) drin = !drin;
      }
      if (drin) return true;
    }
    return false;
  };
}

/**
 * Steht dieser Punkt auf einem Wegband?
 *
 * Die Verteilung kannte seit G-82 die Gebäude, aber nicht die Wege. Gemessen
 * standen **4.975 von 166.773 Props auf dem Belag** (3,0 %), darunter 1.488
 * Fichten und 577 Laubbäume — Bäume mitten auf der Straße. Bei 25 Props je Hektar
 * im Dorf fiel das kaum auf; wer die Dorfdichte verdreifacht, vervielfacht zuerst
 * das Gras auf dem Asphalt.
 *
 * Bewusst dieselbe Bauart wie `hausTest`: ein Raster über die Segmente, dann der
 * genaue Abstand. `baender.ts` hat einen gleichnamigen Test für Gärten, der aber
 * Rechteck gegen Rechteck prüft und die LOD-Kacheln braucht — zwei verschiedene
 * Fragen, darum zwei Funktionen.
 */
export function wegTest(
  welt: Weltdaten, terrain: Pick<TerrainErgebnis, 'breiteMeter' | 'tiefeMeter'>,
): (x: number, z: number) => boolean {
  const [sued, west, nord, ost] = welt.bbox;
  /** Abstand zur Wegkante, den ein Prop mindestens hält. */
  const RAND = 0.6;
  const RASTER = 32;
  const segmente: { ax: number; az: number; bx: number; bz: number; halb: number }[] = [];
  for (const w of welt.wege) {
    const p = w.punkte.map(([lat, lon]) => [
      ((lon - west) / (ost - west) - 0.5) * terrain.breiteMeter,
      ((nord - lat) / (nord - sued) - 0.5) * terrain.tiefeMeter,
    ] as [number, number]);
    for (let k = 0; k < p.length - 1; k++)
      segmente.push({ ax: p[k][0], az: p[k][1], bx: p[k + 1][0], bz: p[k + 1][1],
                      halb: w.breite / 2 + RAND });
  }
  const eimer = new Map<string, number[]>();
  segmente.forEach((s, i) => {
    const x0 = Math.floor((Math.min(s.ax, s.bx) - s.halb) / RASTER);
    const x1 = Math.floor((Math.max(s.ax, s.bx) + s.halb) / RASTER);
    const z0 = Math.floor((Math.min(s.az, s.bz) - s.halb) / RASTER);
    const z1 = Math.floor((Math.max(s.az, s.bz) + s.halb) / RASTER);
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++) {
        const k = `${cx}:${cz}`;
        const l = eimer.get(k); if (l) l.push(i); else eimer.set(k, [i]);
      }
  });
  return (x, z) => {
    for (const i of eimer.get(`${Math.floor(x / RASTER)}:${Math.floor(z / RASTER)}`) ?? []) {
      const s = segmente[i];
      const dx = s.bx - s.ax, dz = s.bz - s.az;
      const l2 = dx * dx + dz * dz;
      const t = l2 ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / l2)) : 0;
      if (Math.hypot(x - s.ax - t * dx, z - s.az - t * dz) < s.halb) return true;
    }
    return false;
  };
}

/** Wertrauschen 0…1 in der Ebene, deterministisch aus der Lage (kein Zufallsstrom). */
function lageRauschen(x: number, z: number): number {
  const h = (a: number, b: number) => {
    let n = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = h(ix, iz), b = h(ix + 1, iz), c = h(ix, iz + 1), d = h(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/**
 * Farnbestand an einer Stelle, 0…1 (D216). Farn wächst in Herden: Wurmfarn und Adlerfarn
 * breiten sich über Rhizome aus und bilden Flecken von einigen bis zu Dutzenden Metern. Zwei
 * Oktaven (rund 28 m und 9 m), damit die Ränder nicht rund sind. Bewusst **nicht** aus dem
 * Zufallsstrom: Ein zusätzlicher Aufruf dort verschöbe jede spätere Instanz der Welt.
 */
export function farnBestand(x: number, z: number): number {
  const n = lageRauschen(x / 28, z / 28) * 0.7 + lageRauschen(x / 9 + 31.7, z / 9 + 17.3) * 0.3;
  return Math.min(1, Math.max(0, (n - 0.42) / 0.2));
}

export function verteileProps(
  welt: Weltdaten, terrain: TerrainErgebnis, seed = 1,
): PropInstanz[] {
  const zufall = mulberry(seed);
  const n = welt.aufloesung;
  const zellBreite = terrain.breiteMeter / (n - 1);
  const zellTiefe = terrain.tiefeMeter / (n - 1);
  const hektarJeZelle = (zellBreite * zellTiefe * MASSSTAB.stauchung ** 2) / 10_000;
  const imHaus = hausTest(welt, terrain);
  const aufWeg = wegTest(welt, terrain);

  const props: PropInstanz[] = [];

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const biom = welt.biome[i][j];
      const dichte = DICHTE[biom];
      if (!dichte) continue;

      // Neigung der Zelle in Grad — Props auf Steilhängen sehen falsch aus
      const [x0, z0] = terrain.rasterZuWelt(i, j);
      const hMitte = terrain.hoeheAn(x0, z0);
      const dh = Math.max(
        Math.abs(terrain.hoeheAn(x0 + zellBreite, z0) - hMitte),
        Math.abs(terrain.hoeheAn(x0, z0 + zellTiefe) - hMitte),
      );
      const neigung = Math.atan(dh / (zellBreite || 1)) * 180 / Math.PI;

      for (const [art, jeHektar] of Object.entries(dichte) as [PropArt, number][]) {
        if (neigung > (MAX_NEIGUNG_GRAD[art] ?? 90)) continue;
        const erwartet = jeHektar * hektarJeZelle;
        // Nachkommaanteil als Wahrscheinlichkeit — sonst verschwinden seltene Props ganz
        const anzahl = Math.floor(erwartet) + (zufall() < erwartet % 1 ? 1 : 0);
        for (let k = 0; k < anzahl; k++) {
          const x = x0 + zufall() * zellBreite;
          const z = z0 + zufall() * zellTiefe;
          // Gemessen standen 2.416 Props in einem Grundriss, darunter 124 Bäume —
          // die wuchsen durch die Hauswand. Die Verteilung kannte Gebäude nicht.
          if (imHaus(x, z)) continue;
          // Und 4.975 standen auf dem Belag, darunter 1.488 Fichten (G-84).
          if (aufWeg(x, z)) continue;
          // Farn in Beständen (D216): die Schwelle aus der Lage, nicht aus dem Zufallsstrom.
          if (art === 'farn' && lageRauschen(x * 3.1, z * 3.1) > farnBestand(x, z)) {
            zufall(); zufall(); zufall();   // Strom wie bei einer gesetzten Instanz weiterdrehen
            continue;
          }
          props.push({
            art,
            variante: Math.floor(zufall() * variantenZahl(art)),
            position: [x, terrain.hoeheAn(x, z), z],
            drehung: zufall() * Math.PI * 2,
            skalierung: 0.75 + zufall() * 0.6,
          });
        }
      }
    }
  }
  return props;
}

// ------------------------------------------------------ Modelle statt Primitive
/**
 * Prozedurale Attrappen, gebaut über `npm run props:bau` (D120) — bis zum
 * 07.09.2026 Modelle aus dem Kenney Nature Kit (CC0, D74). Der Bauplan je
 * Datei steht in `tools/propbau.ts`; hier stehen nur Name und Höhe.
 *
 * **Die Höhe steht hier, nicht in einer Normierung.** Vorher zog die Szene jedes
 * Modell auf eine feste Zielhöhe je Art — alle 44.968 Grasbüschel wurden damit auf
 * exakt 0,35 m gestreckt, egal ob das Quellmodell ein Halm oder eine Staude war.
 * Genau die Vielfalt, die im Kit steckt, hat die Normierung wieder herausgerechnet.
 *
 * Die Kenney-Palette wird **nicht** übernommen. Sie ist bewusst bunt (Gras
 * `#73eddd` Minze, Rinde `#f2be9e` Pfirsich) und steht quer zu einer Art Direction
 * aus gedämpften Alpentönen. `propbau.ts` ersetzt sie durch `KENNEY_FARBE` und
 * backt das Ergebnis als Vertexfarbe ein — ein Material für alle Props.
 */
export interface Variante {
  /** Dateiname unter `public/props`, ohne Endung. */
  datei: string;
  /** Reale Höhe in Metern. */
  hoehe: number;
}

export const VARIANTEN: Record<PropArt, Variante[]> = {
  // Bäume sind prozedural (D40) — die Liste bleibt leer, damit nichts geladen wird,
  // was danach weggeworfen wird. Vorher lagen acht ungenutzte Baum-GLB im
  // Offline-Cache und wurden bei jedem Start vorgeladen. Ihre Vielfalt steht in
  // PROZEDURALE_VARIANTEN, nicht hier.
  nadelbaum: [],
  laubbaum: [],
  busch: [
    { datei: 'busch_klein',    hoehe: 0.9 },
    { datei: 'busch_dreieck',  hoehe: 1.2 },
    { datei: 'busch_mittel',   hoehe: 1.5 },
    { datei: 'busch_dicht',    hoehe: 1.8 },
    { datei: 'busch_breit',    hoehe: 2.1 },
    { datei: 'busch_gross',    hoehe: 2.4 },
  ],
  farn: [
    { datei: 'farn_klein',     hoehe: 0.55 },
    { datei: 'farn_mittel',    hoehe: 0.85 },
    { datei: 'farn_breit',     hoehe: 0.75 },
    { datei: 'farn_hoch',      hoehe: 1.25 },
  ],
  grasbuschel: [
    { datei: 'gras_matte',     hoehe: 0.18 },
    { datei: 'gras_kurz',      hoehe: 0.24 },
    { datei: 'gras_halme',     hoehe: 0.34 },
    { datei: 'gras_hoch',      hoehe: 0.48 },
    { datei: 'gras_blatt',     hoehe: 0.62 },
    { datei: 'gras_staude',    hoehe: 0.85 },
  ],
  findling: [
    { datei: 'findling_flach', hoehe: 0.45 },
    { datei: 'findling_klein', hoehe: 0.7 },
    { datei: 'findling_kant',  hoehe: 0.9 },
    { datei: 'findling_hoch',  hoehe: 1.7 },
    { datei: 'findling_block', hoehe: 2.2 },
    { datei: 'findling_gross', hoehe: 3.0 },
  ],
  totholz: [
    { datei: 'totholz_stamm',  hoehe: 0.5 },
    { datei: 'totholz_dick',   hoehe: 0.8 },
    { datei: 'totholz_stapel', hoehe: 0.7 },
    { datei: 'totholz_stumpf', hoehe: 0.6 },
    { datei: 'totholz_wurzel', hoehe: 1.0 },
    { datei: 'totholz_kante',  hoehe: 0.75 },
  ],
  blume: [
    { datei: 'blume_gelb',     hoehe: 0.26 },
    { datei: 'blume_gelb2',    hoehe: 0.3 },
    { datei: 'blume_rot',      hoehe: 0.24 },
    { datei: 'blume_rot2',     hoehe: 0.28 },
    { datei: 'blume_violett',  hoehe: 0.22 },
    { datei: 'blume_violett2', hoehe: 0.32 },
  ],
  pilz: [
    { datei: 'pilz_rot',       hoehe: 0.16 },
    { datei: 'pilz_rot_hoch',  hoehe: 0.26 },
    { datei: 'pilz_rot_gruppe',hoehe: 0.2 },
    { datei: 'pilz_hell',      hoehe: 0.15 },
    { datei: 'pilz_hell_hoch', hoehe: 0.24 },
    { datei: 'pilz_hell_grupp',hoehe: 0.19 },
  ],
};

/**
 * Kenney-Materialname → Farbe dieser Art Direction.
 *
 * Die Namen sind die Rollen, die Kenney im ganzen Kit durchhält (`grass` in 129
 * Modellen, `dirt` in 98, `stone` in 89). Damit reicht eine Tabelle für alle 329
 * Modelle, und ein neu hinzugenommenes Modell ist automatisch richtig gefärbt.
 *
 * Die Töne stammen aus `BIOM_FARBE` und `BAUM` — dieselbe Palette, aus der auch
 * Gelände und Bäume kommen. Ein Busch, der aus einer zweiten Palette stammt, fällt
 * sofort als Fremdkörper auf, und genau das war der Zustand vorher.
 */
export const KENNEY_FARBE: Record<string, string> = PALETTE.kenney;

/**
 * Wie viele Formen eine prozedurale Art kennt.
 *
 * `baueBaum` benutzt die Variantennummer als Seed für Höhe, Astwinkel und
 * Laubdichte — ohne sie ist jede Fichte im Œntal dieselbe Fichte. Als die
 * GLB-Liste für Bäume auf leer ging, fiel genau das still weg: Die Zahl der
 * Prop-Chunks halbierte sich, was nach Ersparnis aussah und in Wahrheit ein
 * geklonter Wald war.
 */
export const PROZEDURALE_VARIANTEN: Partial<Record<PropArt, number>> = {
  nadelbaum: 4, laubbaum: 4,
};

/**
 * Blender-Baeume (ADR-0006, D155): `tools/baumbau.py` schreibt je Art, Variante und Stufe eine
 * Datei und das Register `public/props/baeume.json`. Steht ein Eintrag da, nimmt die Szene die
 * Datei statt `baueBaum`; fehlt er, bleibt der prozedurale Baum (D40). Die Liste kommt aus dem
 * Werkzeug, nicht von Hand (G-129).
 */
export interface BlenderBaum { art: 'buche' | 'fichte'; variante: number; stufe: 'nah' | 'mittel' | 'fern'; datei: string; hoehe: number; dreiecke: number }
export const BLENDER_BAEUME: BlenderBaum[] = (BAEUME_REGISTER as { baeume: BlenderBaum[] }).baeume;
export function blenderBaum(art: 'buche' | 'fichte', variante: number, stufe: 'nah' | 'mittel' | 'fern'): BlenderBaum | null {
  const je = BLENDER_BAEUME.filter(b => b.art === art && b.stufe === stufe);
  if (!je.length) return null;
  return je[variante % je.length];
}

/** Wie viele Varianten eine Art hat — Datei oder Rechenvorschrift. */
export const variantenZahl = (art: PropArt): number =>
  VARIANTEN[art].length || PROZEDURALE_VARIANTEN[art] || 1;

// ------------------------------------------------- Farbe je Instanz statt je Datei
/**
 * Wie weit die Tönung je Art streuen darf, als volle Breite.
 *
 * `hell` ist die Helligkeit, `warm` die Achse gelb ↔ blaugrün — die beiden
 * Richtungen, in denen echte Vegetation tatsächlich auseinanderläuft. Ein Busch
 * neben dem anderen unterscheidet sich in der Belichtung und darin, wie weit er
 * schon ins Gelbe geht, nicht in der Farbe selbst.
 *
 * Gemessen sah es vorher so aus: 25.467 Büsche, sechs Formen, **eine** Farbe je
 * Form — die größte visuell identische Gruppe umfasste mehrere tausend Instanzen.
 * Bäume und Gras streuen am weitesten, Pilze und Blumen am wenigsten: Ein
 * Fliegenpilz ist rot, und ein olivgrüner Fliegenpilz ist kein Fliegenpilz mehr.
 */
const TON_STREUUNG: Record<PropArt, { hell: number; warm: number }> = {
  nadelbaum:   { hell: 0.16, warm: 0.10 },
  laubbaum:    { hell: 0.18, warm: 0.16 },
  busch:       { hell: 0.20, warm: 0.18 },
  grasbuschel: { hell: 0.22, warm: 0.20 },
  findling:    { hell: 0.16, warm: 0.08 },
  totholz:     { hell: 0.16, warm: 0.12 },
  blume:       { hell: 0.14, warm: 0.06 },
  pilz:        { hell: 0.12, warm: 0.05 },
  farn:        { hell: 0.22, warm: 0.22 },
};

/** Ein Schritt von `mulberry`, ohne Abschluss — 167.823 Aufrufe je Weltaufbau. */
function streu(n: number): number {
  let t = (n + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Farbfaktor einer einzelnen Prop-Instanz, um 1,0 herum.
 *
 * Wird in der Szene als `instanceColor` gesetzt und im Shader mit der Vertexfarbe
 * multipliziert — **drei Floats je Instanz, kein zusätzlicher Draw Call und kein
 * einziges Dreieck.** Bei 60 B/s Kopffreiheit ist das der billigste Hebel, den es
 * gibt, und der sichtbarste: Gleichfarbigkeit liest man als Billigware, lange bevor
 * man Dreiecke zählt.
 *
 * Der Zufall kommt aus der **Drehung**, die ohnehin je Instanz gespeichert ist.
 * Ein eigenes Feld hätte 167.823 zusätzliche Zahlen gekostet, für eine Information,
 * die aus einer vorhandenen ableitbar ist. Damit bleibt die Tönung auch determi-
 * nistisch: derselbe Seed, dieselbe Welt, dieselben Farben — und das Werkzeug
 * `npm run props` rechnet dieselbe Zahl aus wie die Szene.
 */
export function propTon(
  art: PropArt, variante: number, drehung: number,
): [number, number, number] {
  const s = TON_STREUUNG[art];
  const saat = Math.round(drehung * 65536) + variante * 7919;
  const hell = 1 + (streu(saat) - 0.5) * s.hell;
  // Warm hebt Rot und senkt Blau; Grün geht nur ein Viertel mit, sonst kippt das
  // Laub ins Graue statt ins Herbstliche.
  const warm = (streu(saat + 104729) - 0.5) * s.warm;
  return [hell * (1 + warm), hell * (1 + warm * 0.25), hell * (1 - warm)];
}

/** Reale Zielhöhe je Art in Metern — nur noch für die Fernattrappe. */
export const ZIELHOEHE: Record<PropArt, number> = {
  nadelbaum: 22, laubbaum: 14, busch: 1.6, findling: 1.1, totholz: 0.9,
  grasbuschel: 0.35, blume: 0.26, pilz: 0.18, farn: 0.7,
};

export const propPfad = (datei: string) => `/props/${datei}.glb`;

/**
 * Fernattrappe: dasselbe Primitiv wie der Rückfall, aber auf die reale Zielhöhe
 * normiert und mit Vertex-Farbe versehen, damit alle Arten sich ein Material teilen.
 *
 * Der Grund ist Budget, nicht Faulheit. Gemessen (16.08.2026):
 *
 * ```
 *   Art          GLB   Primitiv   Faktor
 *   nadelbaum    146          9    16,2x
 *   laubbaum     191         20     9,5x
 *   totholz      160         11    14,1x
 *   grasbuschel  109          6    17,2x
 * ```
 *
 * Mit voller Modellqualität bis zur Sichtweite kostet der dichteste Standort
 * 1,4 Mio Dreiecke gegen ein Handybudget von 400.000. Auf Entfernung, im Nebel und
 * als Silhouette ist der Unterschied zwischen Kenney-Fichte und Kegel ohnehin
 * marginal — die Art Direction lebt von Umrissen (ADR-0002).
 */
export function attrappeGeometrie(art: PropArt): THREE.BufferGeometry {
  const g = propGeometrie(art);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const hoehe = bb.max.y - bb.min.y || 1;
  const faktor = ZIELHOEHE[art] / hoehe;
  g.translate(0, -bb.min.y, 0);
  g.scale(faktor, faktor, faktor);

  const farbe = new THREE.Color(PROP_FARBE[art]);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i*3] = farbe.r; col[i*3+1] = farbe.g; col[i*3+2] = farbe.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Rückfall auf Primitive, solange ein Modell nicht geladen ist — die Szene soll
 * nicht leer bleiben, wenn eine Datei fehlt.
 */
export function propGeometrie(art: PropArt): THREE.BufferGeometry {
  switch (art) {
    case 'nadelbaum': {
      const g = new THREE.ConeGeometry(1.1, 5.5, 6);
      g.translate(0, 2.75, 0);
      return g;
    }
    case 'laubbaum': {
      const g = new THREE.IcosahedronGeometry(1.8, 0);
      g.scale(1, 1.25, 1);
      g.translate(0, 3.2, 0);
      return g;
    }
    case 'busch': {
      const g = new THREE.IcosahedronGeometry(0.75, 0);
      g.scale(1.25, 0.85, 1.25);
      g.translate(0, 0.6, 0);
      return g;
    }
    case 'findling': {
      const g = new THREE.DodecahedronGeometry(0.9, 0);
      g.scale(1.3, 0.75, 1.1);
      g.translate(0, 0.35, 0);
      return g;
    }
    case 'totholz': {
      const g = new THREE.CylinderGeometry(0.14, 0.2, 3.4, 5);
      g.rotateZ(Math.PI * 0.42);
      g.translate(0, 0.35, 0);
      return g;
    }
    case 'grasbuschel': {
      const g = new THREE.ConeGeometry(0.3, 0.9, 4);
      g.translate(0, 0.45, 0);
      return g;
    }
    case 'blume': {
      const g = new THREE.ConeGeometry(0.06, 0.26, 4);
      g.translate(0, 0.13, 0);
      return g;
    }
    case 'pilz': {
      const g = new THREE.CylinderGeometry(0.09, 0.03, 0.16, 5);
      g.translate(0, 0.08, 0);
      return g;
    }
    case 'farn': {
      const g = new THREE.ConeGeometry(0.5, 0.6, 5, 1, true);
      g.rotateX(Math.PI);
      g.translate(0, 0.3, 0);
      return g;
    }
  }
}

export const PROP_FARBE: Record<PropArt, THREE.ColorRepresentation> = PALETTE.attrappe;

/**
 * Props in ein Raster einteilen. InstancedMesh zeichnet immer ALLE Instanzen —
 * ohne Chunks gibt es kein Entfernungs-Culling, und 80.000 Grasbüschel am anderen
 * Ende der Karte kosten dieselbe Zeit wie die vor der Nase.
 */
export interface PropChunk {
  art: PropArt;
  variante: number;
  mitte: [number, number];
  radius: number;
  sichtweite: number;
  instanzen: PropInstanz[];
}

/**
 * Kantenlänge eines Chunks in Metern.
 *
 * 120 m waren zu grob, seit die Detailstufe je Chunk entschieden wird: Die Bänder
 * (voll bis 45 m, mittel bis 110 m) fielen **zwischen** das Raster, weil die nächsten
 * Chunkmitten 120 m auseinanderliegen. Das Ergebnis war eine Entscheidung mit zwei
 * Zuständen, obwohl drei gebaut waren — gemessen unveränderte 465.000 Dreiecke.
 *
 * 70 m ist der Kompromiss: fein genug, dass alle drei Bänder vorkommen, grob genug,
 * dass die Zahl der Draw Calls nicht davonläuft.
 */
const CHUNK_METER = 70;

export function chunkeProps(
  props: PropInstanz[], chunkGroesse = CHUNK_METER,
): PropChunk[] {
  const buckets = new Map<string, PropInstanz[]>();
  for (const p of props) {
    const cx = Math.floor(p.position[0] / chunkGroesse);
    const cz = Math.floor(p.position[2] / chunkGroesse);
    const key = `${p.art}|${p.variante}|${cx}|${cz}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }
  const chunks: PropChunk[] = [];
  for (const [key, instanzen] of buckets) {
    const [art, variante, cx, cz] = key.split('|');
    chunks.push({
      art: art as PropArt,
      variante: Number(variante),
      mitte: [(Number(cx) + 0.5) * chunkGroesse, (Number(cz) + 0.5) * chunkGroesse],
      radius: chunkGroesse * 0.75,
      sichtweite: SICHTWEITE[art as PropArt],
      instanzen,
    });
  }
  return chunks;
}

/** Für die Anzeige: wie viele Instanzen je Art. */
export function zaehleProps(props: PropInstanz[]): Record<string, number> {
  const z: Record<string, number> = {};
  for (const p of props) z[p.art] = (z[p.art] ?? 0) + 1;
  return z;
}
