/**
 * BRACHLAND — Weltdaten-Pipeline
 *
 * Holt OSM-Geometrie (Overpass) und Höhendaten (EU-DEM) für einen Kartenausschnitt
 * und baut daraus Terrain-Heightmap, Biom-Raster und Spawn-Zonen.
 *
 * Läuft als Build-Schritt, nicht zur Laufzeit: Ergebnis wird als JSON abgelegt und
 * mit der PWA ausgeliefert, damit das Spiel offline funktioniert.
 *
 * Attribution: OSM-Daten stehen unter ODbL — Namensnennung ist Pflicht.
 */

export type BBox = [sued: number, west: number, nord: number, ost: number];

export interface OsmWay {
  id: number;
  tags: Record<string, string>;
  geometry: { lat: number; lon: number }[];
}

/** Biome, auf die OSM-Tags abgebildet werden. Bestimmen Aussehen UND Spawns. */
export const BIOME = [
  'fels', 'wald', 'gebuesch', 'wiese', 'acker', 'wasser',
  'siedlung', 'industrie', 'ruine', 'unbekannt',
] as const;
export type Biom = typeof BIOME[number];

/**
 * Tag → Biom. Reihenfolge zählt: erste Übereinstimmung gewinnt.
 * Erweiterung passiert hier, nicht verstreut im Code.
 */
const TAG_BIOM: [string, string, Biom][] = [
  ['natural',  'cliff',       'fels'],
  ['natural',  'bare_rock',   'fels'],
  ['natural',  'scree',       'fels'],
  ['landuse',  'quarry',      'fels'],
  ['natural',  'wood',        'wald'],
  ['landuse',  'forest',      'wald'],
  ['natural',  'scrub',       'gebuesch'],
  ['natural',  'grassland',   'wiese'],
  ['landuse',  'meadow',      'wiese'],
  ['landuse',  'grass',       'wiese'],
  ['landuse',  'farmland',    'acker'],
  ['landuse',  'orchard',     'acker'],
  ['natural',  'water',       'wasser'],
  ['natural',  'wetland',     'wasser'],
  ['landuse',  'residential', 'siedlung'],
  ['landuse',  'farmyard',    'siedlung'],
  ['landuse',  'industrial',  'industrie'],
  ['man_made', 'bunker_silo', 'ruine'],
  ['historic', 'ruins',       'ruine'],
];

export function bestimmeBiom(tags: Record<string, string>): Biom {
  for (const [k, v, b] of TAG_BIOM) if (tags[k] === v) return b;
  if (tags.waterway) return 'wasser';
  if (tags.building) return 'siedlung';
  return 'unbekannt';
}

// ------------------------------------------------------------------ Overpass

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const VERSUCHE_JE_HOST = 3;

export function overpassQuery([s, w, n, e]: BBox): string {
  const box = `(${s},${w},${n},${e})`;
  const keys = ['natural', 'landuse', 'waterway', 'building', 'man_made', 'historic', 'highway'];
  return `[out:json][timeout:180];\n(\n${keys.map(k => `  way["${k}"]${box};`).join('\n')}\n);\nout geom;`;
}

export async function holeOsm(bbox: BBox, protokoll = console.log): Promise<OsmWay[]> {
  const body = () => new URLSearchParams({ data: overpassQuery(bbox) });
  let letzterFehler: unknown;
  // Overpass-Spiegel sind regelmäßig überlastet (503/504) — Wiederholung ist der Normalfall,
  // nicht die Ausnahme. Leise Fehlschläge wären hier fatal: eine leere Welt sieht wie Erfolg aus.
  for (const host of OVERPASS) {
    for (let versuch = 1; versuch <= VERSUCHE_JE_HOST; versuch++) {
      try {
        const r = await fetch(host, {
          method: 'POST', body: body(),
          headers: { 'User-Agent': 'brachland/0.1 (game world pipeline)' },
        });
        if (!r.ok) {
          letzterFehler = new Error(`${host}: HTTP ${r.status}`);
          protokoll(`  ${host} → HTTP ${r.status}, Versuch ${versuch}/${VERSUCHE_JE_HOST}`);
          await new Promise(res => setTimeout(res, 3000 * versuch));
          continue;
        }
        const j = await r.json() as { elements?: any[] };
        const ways = (j.elements ?? [])
          .filter(el => el.type === 'way' && el.geometry)
          .map(el => ({ id: el.id, tags: el.tags ?? {}, geometry: el.geometry }));
        if (!ways.length) throw new Error('Antwort ohne Ways — vermutlich abgeschnitten');
        return ways;
      } catch (err) {
        letzterFehler = err;
        protokoll(`  ${host} → ${err}, Versuch ${versuch}/${VERSUCHE_JE_HOST}`);
        await new Promise(res => setTimeout(res, 3000 * versuch));
      }
    }
  }
  throw new Error(`Overpass nicht erreichbar: ${letzterFehler}`);
}

// ------------------------------------------------------------ Höhenmodell

/** EU-DEM 25 m über OpenTopoData. 100 Punkte je Anfrage, ~1 s Pause dazwischen. */
export async function holeHoehen(bbox: BBox, aufloesung = 48): Promise<number[][]> {
  const [s, w, n, e] = bbox;
  const punkte: [number, number][] = [];
  for (let i = 0; i < aufloesung; i++) {
    for (let j = 0; j < aufloesung; j++) {
      punkte.push([
        n - (n - s) * (i / (aufloesung - 1)),
        w + (e - w) * (j / (aufloesung - 1)),
      ]);
    }
  }
  const werte: number[] = [];
  for (let i = 0; i < punkte.length; i += 100) {
    const teil = punkte.slice(i, i + 100);
    const url = 'https://api.opentopodata.org/v1/eudem25m?locations='
      + teil.map(([a, b]) => `${a},${b}`).join('|');
    const r = await fetch(url);
    if (!r.ok) throw new Error(`OpenTopoData: HTTP ${r.status}`);
    const j = await r.json() as { results: { elevation: number | null }[] };
    werte.push(...j.results.map(x => x.elevation ?? NaN));
    if (i + 100 < punkte.length) await new Promise(res => setTimeout(res, 1100));
  }
  const raster: number[][] = [];
  for (let i = 0; i < aufloesung; i++)
    raster.push(werte.slice(i * aufloesung, (i + 1) * aufloesung));
  return raster;
}

// ------------------------------------------------------------ Aufbereitung

export interface Weltdaten {
  bbox: BBox;
  aufloesung: number;
  hoehen: number[][];
  hoeheMin: number;
  hoeheMax: number;
  /** Biom je Rasterzelle — bestimmt Textur und Spawn. */
  biome: Biom[][];
  /** Flächen und Linien für die Geometrie-Erzeugung. */
  flaechen: { biom: Biom; punkte: [number, number][] }[];
  linien: { art: string; punkte: [number, number][]; breite: number }[];
  gebaeude: { punkte: [number, number][]; ebenen: number; art: string }[];
  /** Wege und Straßen — strukturieren die Landschaft stark. */
  wege: { art: string; punkte: [number, number][]; breite: number }[];
  /** Feste Positionen für Verwachsene und Uniques. */
  marker: { tag: string; position: [number, number] }[];
  attribution: string;
}

const RINGGESCHLOSSEN = (g: { lat: number; lon: number }[]) =>
  g.length > 3 && g[0].lat === g.at(-1)!.lat && g[0].lon === g.at(-1)!.lon;

export function baueWelt(bbox: BBox, ways: OsmWay[], hoehen: number[][]): Weltdaten {
  const [s, w, n, e] = bbox;
  const aufloesung = hoehen.length;
  const flach = hoehen.flat().filter(x => !Number.isNaN(x));

  const flaechen: Weltdaten['flaechen'] = [];
  const linien: Weltdaten['linien'] = [];
  const gebaeude: Weltdaten['gebaeude'] = [];
  const wege: Weltdaten['wege'] = [];
  const marker: Weltdaten['marker'] = [];

  /** OSM kennt building:levels; sonst nach Nutzung schätzen. */
  const ebenenAus = (t: Record<string, string>): number => {
    const l = parseInt(t['building:levels'] ?? '', 10);
    if (Number.isFinite(l) && l > 0 && l < 30) return l;
    if (t.building === 'garage' || t.building === 'garages' || t.building === 'roof') return 1;
    if (t.building === 'apartments' || t.building === 'commercial') return 3;
    if (t.building === 'industrial' || t.building === 'warehouse') return 2;
    return 2;
  };

  const WEG_BREITE: Record<string, number> = {
    motorway: 14, trunk: 12, primary: 10, secondary: 8, tertiary: 7,
    unclassified: 5, residential: 5, service: 4, track: 3.5,
    path: 1.6, footway: 1.6, cycleway: 2,
  };

  for (const way of ways) {
    const punkte = way.geometry.map(p => [p.lat, p.lon] as [number, number]);
    if (way.tags.building) {
      gebaeude.push({ punkte, ebenen: ebenenAus(way.tags), art: way.tags.building });
      continue;
    }
    if (way.tags.highway) {
      const b = WEG_BREITE[way.tags.highway];
      if (b) wege.push({ art: way.tags.highway, punkte, breite: b });
      continue;
    }
    if (way.tags.waterway) {
      const breite = way.tags.waterway === 'river' ? 12 : way.tags.waterway === 'stream' ? 4 : 2;
      linien.push({ art: way.tags.waterway, punkte, breite });
      continue;
    }
    if (way.tags.man_made === 'bunker_silo' || way.tags.historic === 'ruins'
        || way.tags.landuse === 'quarry' || way.tags.natural === 'cliff') {
      const mitte = punkte.reduce((a, p) => [a[0] + p[0] / punkte.length, a[1] + p[1] / punkte.length], [0, 0]);
      const tag = Object.entries(way.tags).find(([k]) =>
        ['man_made', 'historic', 'landuse', 'natural'].includes(k));
      if (tag) marker.push({ tag: `${tag[0]}=${tag[1]}`, position: mitte as [number, number] });
    }
    if (RINGGESCHLOSSEN(way.geometry)) flaechen.push({ biom: bestimmeBiom(way.tags), punkte });
  }

  // Linienhafte Biom-Geber: cliff, tree_row etc. sind in OSM Linien, keine Flächen.
  // Ohne diesen Schritt fällt z. B. jeder Fels-Spawn aus.
  const linienBiome: { biom: Biom; punkte: [number, number][] }[] = [];
  for (const way of ways) {
    if (RINGGESCHLOSSEN(way.geometry)) continue;
    const b = bestimmeBiom(way.tags);
    if (b === 'fels' || b === 'wald')
      linienBiome.push({ biom: b, punkte: way.geometry.map(p => [p.lat, p.lon] as [number, number]) });
  }

  // Biom-Raster: für jede Zelle das Biom der ersten Fläche, die sie enthält
  const METER_JE_GRAD = 111_320;
  const mittelLat = (s + n) / 2;
  const zellbreiteMeter =
    ((e - w) * METER_JE_GRAD * Math.cos(mittelLat * Math.PI / 180)) / (aufloesung - 1);

  /**
   * Bäche und Gräben ins Raster stempeln.
   *
   * Vorher standen im Œntal ganze **zwei** Wasserzellen — die beiden einzigen
   * OSM-Wasserflächen. Bäche sind in OSM Linien, keine Flächen, und fielen deshalb
   * durch. Ergebnis: Kiemenbiber (1 Vorkommen) und Moderotter (0) gab es faktisch
   * nicht, obwohl 190 Gewässerläufe in den Daten liegen. Das war kein Inhaltsfehler,
   * sondern ein Rasterungsfehler.
   *
   * Gestempelt wird entlang jedes Laufs in Schritten von einer halben Zellbreite,
   * sonst reißt die Kette bei weit auseinanderliegenden OSM-Stützpunkten.
   */
  const wasserZellen = new Set<number>();
  for (const l of linien) {
    for (let k = 0; k < l.punkte.length - 1; k++) {
      const [alat, alon] = l.punkte[k];
      const [blat, blon] = l.punkte[k + 1];
      const schritte = Math.max(1, Math.ceil(
        Math.max(Math.abs(blat - alat) / ((n - s) / (aufloesung - 1)),
                 Math.abs(blon - alon) / ((e - w) / (aufloesung - 1))) * 2));
      for (let t = 0; t <= schritte; t++) {
        const lat = alat + (blat - alat) * (t / schritte);
        const lon = alon + (blon - alon) * (t / schritte);
        const i = Math.round((n - lat) / (n - s) * (aufloesung - 1));
        const j = Math.round((lon - w) / (e - w) * (aufloesung - 1));
        if (i < 0 || j < 0 || i >= aufloesung || j >= aufloesung) continue;
        wasserZellen.add(i * aufloesung + j);
      }
    }
  }

  const biome: Biom[][] = [];
  for (let i = 0; i < aufloesung; i++) {
    const zeile: Biom[] = [];
    const lat = n - (n - s) * (i / (aufloesung - 1));
    for (let j = 0; j < aufloesung; j++) {
      const lon = w + (e - w) * (j / (aufloesung - 1));
      // Wasser gewinnt: Ein Bach im Wald ist ein Bach, kein Wald.
      if (wasserZellen.has(i * aufloesung + j)) { zeile.push('wasser'); continue; }
      const treffer = flaechen.find(f => f.biom !== 'unbekannt' && imPolygon([lat, lon], f.punkte));
      if (treffer) { zeile.push(treffer.biom); continue; }
      // Linie in der Nähe? (Zellbreite als Radius)
      const zelleGrad = Math.max((n - s), (e - w)) / (aufloesung - 1);
      const nahLinie = linienBiome.find(l =>
        l.punkte.some(([plat, plon]) =>
          Math.abs(plat - lat) < zelleGrad && Math.abs(plon - lon) < zelleGrad));
      if (nahLinie) { zeile.push(nahLinie.biom); continue; }
      // Rückfall aus Gelände: OSM deckt längst nicht alles ab, sonst bleibt die Welt leer.
      zeile.push(biomAusGelaende(hoehen, i, j, aufloesung, zellbreiteMeter));
    }
    biome.push(zeile);
  }

  return {
    bbox, aufloesung, hoehen,
    hoeheMin: Math.min(...flach), hoeheMax: Math.max(...flach),
    biome, flaechen, linien, gebaeude, wege, marker,
    attribution: '© OpenStreetMap-Mitwirkende (ODbL) · Höhendaten: Bayerische '
      + 'Vermessungsverwaltung – www.geodaten.bayern.de (DGM1, CC BY 4.0, bearbeitet)',
  };
}

/**
 * Rückfall, wenn OSM für eine Zelle nichts hergibt: Biom aus Höhe und Hangneigung.
 * Ohne das bleiben in ländlichen Ausschnitten über 80 % der Karte ohne Biom.
 */
export function biomAusGelaende(
  h: number[][], i: number, j: number, n: number, zellbreiteMeter: number,
): Biom {
  const at = (a: number, b: number) => h[Math.max(0, Math.min(n - 1, a))][Math.max(0, Math.min(n - 1, b))];
  const hoehe = at(i, j);
  if (Number.isNaN(hoehe)) return 'unbekannt';

  // Neigung in GRAD statt Metern je Zelle — sonst hängt das Ergebnis an der Auflösung.
  // (Bei 32er Raster wären es 125 m/Zelle, bei 96er nur 42 m — dieselbe Schwelle
  //  in Metern hätte völlig verschiedene Bedeutung.)
  const dz = Math.max(
    Math.abs(at(i + 1, j) - at(i - 1, j)),
    Math.abs(at(i, j + 1) - at(i, j - 1)),
  ) / 2;
  const grad = Math.atan(dz / zellbreiteMeter) * 180 / Math.PI;

  if (hoehe > 1000 && grad > 22) return 'fels';
  if (hoehe > 1000) return 'gebuesch';
  if (grad > 32) return 'fels';
  if (hoehe > 650 || grad > 16) return 'wald';
  return 'wiese';
}

/** Punkt-in-Polygon, Ray-Casting. */
export function imPolygon([y, x]: [number, number], poly: [number, number][]): boolean {
  let drin = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}

// ------------------------------------------------------------- Auslieferung

/**
 * Kompaktform für die Auslieferung.
 *
 * Höhen und Biome sind bei 256×256 zusammen **877 KB JSON** — bei einem
 * Offline-Budget von wenigen Megabyte der größte Einzelposten, und beides speichert
 * Zahlen als Text. Gepackt sind es 240 KB, ohne einen Meter Genauigkeit zu verlieren:
 *
 * - **Höhen** als Int16 in Dezimetern, base64. Der Wertebereich −3.276 bis 3.276 m
 *   deckt jede Region ab, die dieses Spiel je haben wird; 10 cm liegen unter der
 *   Sichtbarkeitsschwelle. 378 KB → 175 KB.
 * - **Biome** als eine Zeichenkette, ein Zeichen je Zelle. 499 KB → 65 KB.
 *
 * Das Spiel arbeitet unverändert mit `Weltdaten`; `entpackeWelt` stellt sie her.
 */
export interface GepackteWelt extends Omit<Weltdaten, 'hoehen' | 'biome'> {
  hoehenB64: string;
  biomeStr: string;
}

const LUECKE = -32768;

export function packeWelt(welt: Weltdaten): GepackteWelt {
  const n = welt.aufloesung;
  const dm = new Int16Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const h = welt.hoehen[i][j];
      dm[i * n + j] = Number.isNaN(h) ? LUECKE : Math.round(h * 10);
    }
  const bytes = new Uint8Array(dm.buffer);
  let roh = '';
  for (let i = 0; i < bytes.length; i++) roh += String.fromCharCode(bytes[i]);

  let biomeStr = '';
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) biomeStr += String(BIOME.indexOf(welt.biome[i][j]));

  const { hoehen: _h, biome: _b, ...rest } = welt;
  return { ...rest, hoehenB64: btoa(roh), biomeStr };
}

export function entpackeWelt(g: GepackteWelt | Weltdaten): Weltdaten {
  if ('hoehen' in g) return g;                       // ungepackt (alte Datei)
  const n = g.aufloesung;
  const roh = atob(g.hoehenB64);
  const bytes = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
  const dm = new Int16Array(bytes.buffer);

  const hoehen: number[][] = [];
  const biome: Biom[][] = [];
  for (let i = 0; i < n; i++) {
    const zh: number[] = [], zb: Biom[] = [];
    for (let j = 0; j < n; j++) {
      const v = dm[i * n + j];
      zh.push(v === LUECKE ? NaN : v / 10);
      zb.push(BIOME[Number(g.biomeStr[i * n + j])] ?? 'unbekannt');
    }
    hoehen.push(zh); biome.push(zb);
  }
  const { hoehenB64: _a, biomeStr: _b2, ...rest } = g;
  return { ...rest, hoehen, biome };
}

// ------------------------------------------------------------------ Spawns

export interface SpawnZone {
  kreatur: string;
  zellen: [number, number][];
  haeufigkeit: string;
  /** Für 'fest': genaue Position statt Zellenmenge. */
  position?: [number, number];
}

/**
 * Ordnet Kreaturen ihren Zellen zu — der Kern der Idee: Spawns werden nicht
 * platziert, sie folgen aus den Kartendaten.
 */
export function baueSpawns(
  welt: Weltdaten,
  kreaturen: { id: string; spawn: { osmTag?: string; minHoehe?: number; maxHoehe?: number; haeufigkeit: string; position?: [number, number] } }[],
): SpawnZone[] {
  const zonen: SpawnZone[] = [];
  for (const k of kreaturen) {
    // Feste Kreaturen (Verwachsene, Uniques) stehen an einem Ort, nicht in einer Zone.
    if (k.spawn.haeufigkeit === 'fest') {
      zonen.push({ kreatur: k.id, zellen: [], haeufigkeit: 'fest',
                   position: (k.spawn as any).position });
      continue;
    }
    if (!k.spawn.osmTag) continue;
    const [key, val] = k.spawn.osmTag.split('=');
    // Ueber bestimmeBiom, nicht ueber TAG_BIOM direkt: Tags wie `waterway=stream`
    // stehen nicht in der Tabelle, fallen aber auf 'wasser' zurueck. Die Direktsuche
    // lieferte dafuer `undefined` — und damit eine Zone ueber die ganze Karte.
    const zielBiom = bestimmeBiom({ [key]: val });
    const zellen: [number, number][] = [];
    for (let i = 0; i < welt.aufloesung; i++) {
      for (let j = 0; j < welt.aufloesung; j++) {
        const h = welt.hoehen[i][j];
        if (k.spawn.minHoehe != null && !(h >= k.spawn.minHoehe)) continue;
        if (k.spawn.maxHoehe != null && !(h <= k.spawn.maxHoehe)) continue;
        if (zielBiom && welt.biome[i][j] !== zielBiom) continue;
        zellen.push([i, j]);
      }
    }
    zonen.push({ kreatur: k.id, zellen, haeufigkeit: k.spawn.haeufigkeit });
  }
  return zonen;
}
