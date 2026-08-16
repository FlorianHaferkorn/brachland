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
import type { Weltdaten, Biom } from './osm.js';
import type { TerrainErgebnis } from './terrain.js';
import { MASSSTAB } from './terrain.js';

export type PropArt = 'nadelbaum' | 'laubbaum' | 'busch' | 'findling' | 'grasbuschel' | 'totholz';

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
const DICHTE: Record<Biom, Partial<Record<PropArt, number>>> = {
  wald:      { nadelbaum: 95, laubbaum: 32, busch: 26, totholz: 8, grasbuschel: 30 },
  gebuesch:  { busch: 55, nadelbaum: 6, findling: 5, grasbuschel: 34 },
  wiese:     { grasbuschel: 40, busch: 3, laubbaum: 1.2 },
  acker:     { grasbuschel: 8 },
  fels:      { findling: 18, busch: 4, nadelbaum: 1.6 },
  wasser:    {},
  siedlung:  { laubbaum: 6, busch: 7 },
  industrie: { busch: 4, totholz: 3 },
  ruine:     { busch: 9, totholz: 5, findling: 5 },
  unbekannt: { grasbuschel: 10 },
};

/**
 * Sichtweite je Art. Kleinzeug jenseits davon wird gar nicht erst gezeichnet —
 * bei Nebel ab 420 m sieht man es ohnehin nicht, es kostet aber volle Dreiecke.
 */
export const SICHTWEITE: Record<PropArt, number> = {
  nadelbaum: 420, laubbaum: 420, findling: 300,
  busch: 180, totholz: 160, grasbuschel: 90,
};

/** Ab dieser Neigung wächst nichts mehr — verhindert Bäume an Felswänden. */
const MAX_NEIGUNG_GRAD: Partial<Record<PropArt, number>> = {
  nadelbaum: 38, laubbaum: 32, busch: 45, totholz: 35, grasbuschel: 40, findling: 60,
};

export interface PropInstanz {
  art: PropArt;
  /** Index in VARIANTEN[art] — Abwechslung ohne zusätzliche Daten. */
  variante: number;
  position: [number, number, number];
  drehung: number;
  skalierung: number;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function verteileProps(
  welt: Weltdaten, terrain: TerrainErgebnis, seed = 1,
): PropInstanz[] {
  const zufall = mulberry(seed);
  const n = welt.aufloesung;
  const zellBreite = terrain.breiteMeter / (n - 1);
  const zellTiefe = terrain.tiefeMeter / (n - 1);
  const hektarJeZelle = (zellBreite * zellTiefe * MASSSTAB.stauchung ** 2) / 10_000;

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
          props.push({
            art,
            variante: Math.floor(zufall() * VARIANTEN[art].length),
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
 * Echte Modelle aus dem Kenney Nature Kit (CC0), reduziert über tools/reduce.mjs.
 * Je Art mehrere Varianten — ein einziges Baummodell 25.000-mal geklont fällt sofort
 * als Muster auf, vier Varianten reichen, damit der Wald wie ein Wald wirkt.
 *
 * Kenney-Modelle sind in Blockeinheiten modelliert (Baum = 2 Einheiten hoch).
 * SKALIERUNG rechnet sie auf reale Meter um — im 1:1-Maßstab ist eine Fichte 22 m.
 */
export const VARIANTEN: Record<PropArt, string[]> = {
  nadelbaum:   ['nadelbaum_0', 'nadelbaum_1', 'nadelbaum_2', 'nadelbaum_3'],
  laubbaum:    ['laubbaum_0', 'laubbaum_1', 'laubbaum_2', 'laubbaum_3'],
  busch:       ['busch_0', 'busch_1', 'busch_2', 'busch_3'],
  findling:    ['findling_0', 'findling_1', 'findling_2', 'findling_3'],
  totholz:     ['totholz_0', 'totholz_1', 'totholz_2'],
  grasbuschel: ['grasbuschel_0', 'grasbuschel_1', 'grasbuschel_2', 'grasbuschel_3'],
};

/** Reale Zielhöhe je Art in Metern. Quelle für die Skalierung der Rohmodelle. */
export const ZIELHOEHE: Record<PropArt, number> = {
  nadelbaum: 22, laubbaum: 14, busch: 1.3, findling: 1.1, totholz: 0.9, grasbuschel: 0.35,
};

export const propPfad = (variante: string) => `/props/${variante}.glb`;

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
  }
}

export const PROP_FARBE: Record<PropArt, THREE.ColorRepresentation> = {
  nadelbaum:   '#20351f',
  laubbaum:    '#3a4d2c',
  busch:       '#3f4f33',
  findling:    '#6e7276',
  totholz:     '#4a4239',
  grasbuschel: '#5c6b45',
};

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

export function chunkeProps(
  props: PropInstanz[], chunkGroesse = 120,
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
