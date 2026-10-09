/**
 * BRACHLAND — Bauwerke aus der Blender-Szene (ADR-0006, Stufe 2)
 *
 * `tools/szenenbau.py` baut einen realen Ausschnitt als Blender-Szene, `tools/szenenexport.py`
 * backt die Materialien und schreibt GLB-Dateien plus `public/bauten/register.json`. Diese Datei
 * liest das Register — die **einzige** Liste (D137: Listen kommen aus dem Werkzeug) — und liefert,
 * was Engine und Tore gemeinsam brauchen: Ursprung, Hoehe, Terrasse.
 *
 * **Terrasse.** Die Szene ebnet eine Scheibe im Hang (`terrasse()` im Szenenbau), damit Mauer und
 * Hof nicht auf 30 Grad stehen. Dieselbe Scheibe muss das Hoehenfeld der Engine kennen, sonst
 * versinkt der Hof bergseitig und schwebt talseitig — genau W1 aus ADR-0005. Deshalb steht sie
 * hier und nicht im Szenenbau allein, und `baueHoehenfeld` nimmt sie als Vorgabe: jeder Aufrufer
 * (Szene, Geometrie-Tor, Checks) sieht denselben Boden.
 *
 * Achsen: glTF ist Y-oben. Blender (X, Y, Z) wird zu (X, Z, −Y); der Terrainexport hat das Gelaende
 * als (x, −z, y) geschrieben — also ist das GLB im Weltraster, sobald es am Ursprung (x, h0, z) steht.
 */
import { z } from 'zod';
import REGISTER from '../../public/bauten/register.json';
import STAEMME from '../../public/bauten/staemme.json';

export const Terrasse = z.object({ x: z.number(), z: z.number(), rInnen: z.number().positive(), rAussen: z.number().positive() });
export type Terrasse = z.infer<typeof Terrasse>;

export const Bauwerk = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  ursprung: z.object({ x: z.number(), z: z.number() }),
  /** Gelaendehoehe am Ursprung **vor** der Terrasse (Weltmeter ueber `hoeheMin`), aus dem Terrainexport. */
  h0: z.number(),
  terrasse: Terrasse.optional(),
  /**
   * Freihaltung um (x, z): keine Engine-Baeume im Radius `props`, keine Streuschicht im Radius `streu`,
   * keine OSM-Haeuser im Radius `haeuser` (D155: am Stauwehr stand ein Engine-Hof vor der Kamera, den die
   * Szene mit `loch_im_fernen` laengst ausgeblendet hatte — Blender und Engine muessen dasselbe Loch sehen).
   */
  frei: z.object({
    x: z.number(), z: z.number(),
    props: z.number().nonnegative(), streu: z.number().nonnegative(), haeuser: z.number().nonnegative().default(0),
  }).optional(),
  dateien: z.array(z.enum(['bauten', 'gruen', 'wasser'])),
  objekte: z.record(z.array(z.string())).optional(),
});
export type Bauwerk = z.infer<typeof Bauwerk>;

export const BAUWERKE: Bauwerk[] = z.object({ bauwerke: z.array(Bauwerk) }).parse(REGISTER).bauwerke;

/**
 * Stämme der Szenen als Kreise `[x, z, r]` in Weltmetern (G-136) — aus den GLB geschnitten von
 * `tools/staemme.ts`, nicht von Hand. Ohne sie lief man im Freihalte-Radius durch jeden Blender-Baum,
 * und die Lock-On-Sicht (D192) sah sie nicht. `baueKollision` nimmt sie als Vorgabe.
 */
const Kreis = z.tuple([z.number(), z.number(), z.number().positive()]);
const STAEMME_JE_SZENE = z.record(z.array(Kreis)).parse(STAEMME);
export const SZENEN_STAEMME: readonly (readonly [number, number, number])[] = Object.values(STAEMME_JE_SZENE).flat();
export const staemmeVon = (name: string) => STAEMME_JE_SZENE[name] ?? [];

/**
 * Der Nebel endet je Stimmung spaetestens bei rund 420 m. Mit 650 m wird eine
 * bis zu 150 m breite Blender-Szene geladen, bevor ihr naher Rand sichtbar wird.
 */
export const BAUWERK_LADE_RADIUS = 650;

/** Nur Szenen im sichtbaren Umkreis montieren; entscheidend ist der Spieler, nicht die Kamera. */
export function sichtbareBauwerke(x: number, z: number, radius = BAUWERK_LADE_RADIUS): Bauwerk[] {
  const quadrat = radius * radius;
  return BAUWERKE.filter(b => {
    const dx = x - b.ursprung.x, dz = z - b.ursprung.z;
    return dx * dx + dz * dz <= quadrat;
  });
}

/** Alle Terrassen der Region — Vorgabe fuer `baueHoehenfeld`. */
export const TERRASSEN: Terrasse[] = BAUWERKE.flatMap(b => (b.terrasse ? [b.terrasse] : []));

/**
 * Liegt (x, z) in einer Freihaltung? `props`: Baeume und Buesche der Engine, `streu`: Bodendecker.
 * Die Blender-Szene bringt ihre eigene Vegetation mit; zwei Waelder an einer Stelle sind einer zu viel.
 */
export function gesperrt(x: number, z: number, art: 'props' | 'streu' | 'haeuser'): boolean {
  for (const b of BAUWERKE) {
    const f = b.frei; if (!f) continue;
    const r = art === 'props' ? f.props : art === 'streu' ? f.streu : f.haeuser;
    if (r > 0 && (x - f.x) * (x - f.x) + (z - f.z) * (z - f.z) < r * r) return true;
  }
  return false;
}

/** Pfad einer Bauwerksdatei — ein Ort fuer die Konvention, nicht drei. */
export const bauwerkPfad = (b: Bauwerk, teil: 'bauten' | 'gruen' | 'wasser') => `/bauten/${b.name}-${teil}.glb`;

/**
 * Terrasse auf eine Hoehe anwenden: innen flach auf `zt`, bis `rAussen` weich ins Gelaende.
 * Dieselbe Kurve wie `terrasse()` im Szenenbau (smoothstep), damit Blender und Engine einen Boden haben.
 */
export function terrassiere(h: number, x: number, z: number, t: Terrasse, zt: number): number {
  const d = Math.hypot(x - t.x, z - t.z);
  if (d >= t.rAussen) return h;
  if (d <= t.rInnen) return zt;
  const s = (d - t.rInnen) / (t.rAussen - t.rInnen);
  const f = s * s * (3 - 2 * s);
  return zt * (1 - f) + h * f;
}
