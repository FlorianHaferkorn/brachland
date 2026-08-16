/**
 * BRACHLAND — Weltdaten aus OpenStreetMap + EU-DEM
 *
 * ⚠️ NICHT REKONSTRUIERT. Das Original ging mit der Chat-Sandbox verloren
 * (siehe ../../docs/RECOVERY.md). Diese Datei hält die Schnittstelle fest, die
 * der gerettete Code nachweislich verlangt — abgeleitet aus den Zugriffen in
 * props.ts, lod.ts, main.tsx und scenes/RegionsSzene.tsx.
 *
 * Der Ladepfad ist bekannt: main.tsx holt `public/world/<region>.json`, erzeugt
 * per `npm run world oental 96` (~2 min, Höhendaten-API). Der Generator fehlt.
 */

/** Biome, wie sie das Raster führt. Vollständig belegt über DICHTE in props.ts. */
export type Biom =
  | 'wald' | 'gebuesch' | 'wiese' | 'acker' | 'fels'
  | 'wasser' | 'siedlung' | 'industrie' | 'ruine' | 'unbekannt';

/** Ein Linienzug oder Polygon in Weltkoordinaten (Grad). */
export type Linienzug = ReadonlyArray<readonly [lat: number, lon: number]>;

/**
 * Eine geladene Region.
 *
 * Belegte Felder (aus Zugriffen im geretteten Code):
 *   aufloesung · bbox · hoehen · hoeheMin · biome
 * Die Geometrie-Felder darunter sind aus den Aufrufen `baueWege(welt, t)`,
 * `baueGewaesser(welt, t)` und `baueGebaeude(welt, t)` erschlossen — ihre exakte
 * Form ist NICHT belegt und beim Nachbau des Generators festzulegen.
 */
export interface Weltdaten {
  /** Rasterkantenlänge; das Höhen- und Biomraster ist `aufloesung × aufloesung`. */
  readonly aufloesung: number;
  /** Begrenzung als [sued, west, nord, ost] in Grad. */
  readonly bbox: readonly [sued: number, west: number, nord: number, ost: number];
  /** Höhen in Metern, `[i][j]`. NaN ist zulässig — lod.ts ersetzt Lücken durch den Mittelwert. */
  readonly hoehen: readonly (readonly number[])[];
  /** Tiefster gültiger Höhenwert; Bezugspunkt für die Überhöhung. */
  readonly hoeheMin: number;
  /** Biom je Rasterzelle, `[i][j]`. */
  readonly biome: readonly (readonly Biom[])[];

  /** NICHT BELEGT — Form beim Nachbau des Generators festlegen. */
  readonly wege?: readonly Linienzug[];
  /** NICHT BELEGT — Form beim Nachbau des Generators festlegen. */
  readonly gewaesser?: readonly Linienzug[];
  /** NICHT BELEGT — Gebäudegrundriss plus Höhe; Dächer werden daraus erzeugt. */
  readonly gebaeude?: readonly { readonly umriss: Linienzug; readonly hoehe: number }[];
}

const NICHT_REKONSTRUIERT =
  'world/osm.ts ist nicht rekonstruiert (Ledger B-1). Siehe docs/RECOVERY.md.';

/**
 * Lädt eine Region. Platzhalter — wirft bewusst, statt stillschweigend
 * Unsinn zu liefern.
 */
export async function ladeWelt(_region: string): Promise<Weltdaten> {
  throw new Error(NICHT_REKONSTRUIERT);
}
