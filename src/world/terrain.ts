/**
 * BRACHLAND — Terrain-, Gewässer-, Gebäude- und Wege-Geometrie
 *
 * ⚠️ NICHT REKONSTRUIERT. Das Original ging mit der Chat-Sandbox verloren
 * (siehe ../../docs/RECOVERY.md). Diese Datei hält die Schnittstelle fest, die
 * der gerettete Code nachweislich verlangt.
 *
 * Belege für jede Signatur:
 *   scenes/RegionsSzene.tsx:14,41-46,52  → baueTerrain/-Gewaesser/-Gebaeude/-Wege, .geometrie
 *   scenes/RegionsSzene.tsx:195-223      → GROESSE.kameraHoehe/-Abstand/-BlickHoehe
 *   world/props.ts:70-102                → breiteMeter, tiefeMeter, rasterZuWelt, hoeheAn, MASSSTAB.stauchung
 *   world/lod.ts:79-88                   → MASSSTAB.stauchung, MASSSTAB.ueberhoehung, BIOM_FARBE
 *
 * Beim Nachbau: `baueHoehenfeld` aus lod.ts liefert bereits Höhe und Biom an
 * beliebiger Weltposition inklusive Mikrorelief — `hoeheAn` sollte darauf
 * aufsetzen statt eine zweite Interpolation zu führen.
 */
import * as THREE from 'three';
import type { Biom, Weltdaten } from './osm.js';

/**
 * Weltmaßstab. `stauchung` bildet Grad auf Meter ab, `ueberhoehung` skaliert
 * die Höhe — bei 1 ist das Gelände 1:1, darüber wirkt es dramatischer.
 * Werte NICHT belegt; beim Nachbau gegen `npm run masstab` prüfen.
 */
export const MASSSTAB = {
  stauchung: 1,
  ueberhoehung: 1,
} as const;

/** Kameraführung im 1:1-Maßstab (Third Person). Werte NICHT belegt. */
export const GROESSE = {
  kameraHoehe: 1.7,
  kameraAbstand: 6,
  kameraBlickHoehe: 1.5,
} as const;

/** Grundfarbe je Biom — Vertex-Farben, keine Texturen (ADR-0002). Werte NICHT belegt. */
export const BIOM_FARBE: Record<Biom, THREE.ColorRepresentation> = {
  wald: '#2b3a2a', gebuesch: '#3a4530', wiese: '#4a5535', acker: '#5a5238',
  fels: '#4b4a48', wasser: '#22333a', siedlung: '#4a4540', industrie: '#3e3c3a',
  ruine: '#443f3a', unbekannt: '#3a3a38',
};

/** Ergebnis von `baueTerrain` — vollständig aus den Zugriffsstellen belegt. */
export interface TerrainErgebnis {
  /** Terrain-Mesh mit Vertex-Farben und Flat Shading. */
  readonly geometrie: THREE.BufferGeometry;
  readonly breiteMeter: number;
  readonly tiefeMeter: number;
  /** Rasterindex → Weltposition (x, z) in Metern. */
  rasterZuWelt(i: number, j: number): readonly [x: number, z: number];
  /** Höhe an beliebiger Weltposition, inkl. Interpolation und Mikrorelief. */
  hoeheAn(x: number, z: number): number;
}

const NICHT_REKONSTRUIERT =
  'world/terrain.ts ist nicht rekonstruiert (Ledger B-2). Siehe docs/RECOVERY.md.';

export function baueTerrain(_welt: Weltdaten): TerrainErgebnis {
  throw new Error(NICHT_REKONSTRUIERT);
}

/** Gibt `null` zurück, wenn die Region kein Gewässer enthält. */
export function baueGewaesser(_welt: Weltdaten, _t: TerrainErgebnis): THREE.BufferGeometry | null {
  throw new Error(NICHT_REKONSTRUIERT);
}

/** Gebäude inklusive Dächer. `null`, wenn die Region keine enthält. */
export function baueGebaeude(_welt: Weltdaten, _t: TerrainErgebnis): THREE.BufferGeometry | null {
  throw new Error(NICHT_REKONSTRUIERT);
}

/** Wege als aufs Gelände gelegte Bänder. `null`, wenn die Region keine enthält. */
export function baueWege(_welt: Weltdaten, _t: TerrainErgebnis): THREE.BufferGeometry | null {
  throw new Error(NICHT_REKONSTRUIERT);
}
