/**
 * BRACHLAND — Stehende Gewässer als Daten: der Au-See am Stauwehr (D280, `?see=1` / `?echt=1`)
 *
 * Flo 14.11.2026: „mach den See“ — gemeint war die milchige Fläche hinter dem Teich (D278/D279). Dort
 * stehen die Stämme der Blender-Szene in einer flachen Senke; ein See mit Stämmen im Wasser (überfluteter
 * Au- bzw. Bruchwald) passt zu Region und Auftrag „Das stehende Wasser“ und braucht keine Bäume zu
 * entfernen. Die Lage steht in `public/world/seen.json` (Daten, nicht im Code): Mitte, Halbachsen,
 * Drehung, **Spiegelhöhe** und Tiefe. Die Spiegelhöhe wird mitgegeben, weil der See auf einem Hang liegt
 * (Gelände 44,4–46,6 m): `lod.ts` kappt das Gelände im Umriss auf den Spiegel (plus flache Böschung
 * ausserhalb), `baender.ts` legt die Wasserfläche auf diesen Spiegel statt auf das tiefste Uferpunkt-Niveau.
 *
 * Der Umriss ist eine leicht unregelmässige Ellipse (deterministisch aus dem Namen), kein Rechteck-Teich.
 */
import { z } from 'zod';
import SEEN_ROH from '../../public/world/seen.json';
import { AKTIVE_REGION } from '../spiel/region.js';
import { SEE_AN } from './echt.js';

const See = z.object({
  name: z.string(),
  region: z.string().default('oental'),
  mitte: z.tuple([z.number(), z.number()]),
  rx: z.number().positive(), rz: z.number().positive(),
  /** Drehung der Längsachse in Grad (0 = entlang x). */
  drehung: z.number().default(0),
  spiegel: z.number(),
  tiefe: z.number().positive(),
});
export type See = z.infer<typeof See>;

/** Die Seen der geladenen Region; leer, wenn `?see=0` oder ohne Schalter. */
export const SEEN: See[] = SEE_AN
  ? z.object({ seen: z.array(See) }).parse(SEEN_ROH).seen.filter((s) => s.region === AKTIVE_REGION)
  : [];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

/** Umriss in Weltmetern: Ellipse mit zwei Wellen im Radius (±8 %, ±5 %), `n` Punkte. */
export function seeUmriss(s: See, n = 32): [number, number][] {
  const a = hash(s.name) * 6.2832, b = hash(s.name + '#') * 6.2832;
  const c = Math.cos(s.drehung * Math.PI / 180), d = Math.sin(s.drehung * Math.PI / 180);
  const p: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const w = (i / n) * 6.2832;
    const r = 1 + 0.08 * Math.sin(2 * w + a) + 0.05 * Math.sin(3 * w + b);
    const u = Math.cos(w) * s.rx * r, v = Math.sin(w) * s.rz * r;
    p.push([s.mitte[0] + u * c - v * d, s.mitte[1] + u * d + v * c]);
  }
  return p;
}

/**
 * Geländekappe: Das Gelände liegt im See höchstens auf dem Spiegel; ausserhalb steigt eine Böschung mit
 * 0,4 m je Meter vom Spiegel an (bis `BOESCHUNG_BREITE`). Gibt die gekappte Höhe zurück (ohne Bett-Tiefe).
 */
const BOESCHUNG_BREITE = 8;
export function seeKappe(x: number, z: number, oben: number): number {
  for (const s of SEEN) {
    const c = Math.cos(s.drehung * Math.PI / 180), d = Math.sin(s.drehung * Math.PI / 180);
    const dx = x - s.mitte[0], dz = z - s.mitte[1];
    const u = (dx * c + dz * d) / s.rx, v = (-dx * d + dz * c) / s.rz;
    const e = Math.hypot(u, v);
    const kleinste = Math.min(s.rx, s.rz);
    if (e > 1 + BOESCHUNG_BREITE / kleinste) continue;
    const abstand = Math.max(0, e - 1) * kleinste;
    oben = Math.min(oben, s.spiegel + abstand * 0.4);
  }
  return oben;
}
