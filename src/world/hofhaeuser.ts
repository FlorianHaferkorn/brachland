/** D304: begrenztes Hofensemble und freie Eingänge aus vorhandenen Grundrissen. */
import type { Weltdaten } from './osm.js';
import type { Hof } from './hofplatz.js';
import { vereinfacheHauswand } from './hausbauteil.js';

type Punkt = [number, number];
type Weltmass = { breiteMeter: number; tiefeMeter: number };
export interface Hofhaus {
  gebaeudeIndex: number;
  mitte: Punkt;
  vorne: Punkt;
  /** Kein freies Vorfeld bedeutet keine neue Tür, nicht eine Tür in der Nachbarwand. */
  eingang: Punkt | null;
}
type Umriss = { gebaeudeIndex: number; art: string; p: Punkt[]; mitte: Punkt; box: [number, number, number, number] };
const WOHNARTEN = new Set(['yes', 'house', 'detached', 'residential', 'apartments', 'farm', 'terrace', 'semidetached_house']);
const RADIUS = 35;
const HALBE_BREITE = 1.05 / 2 + 0.2;

/** Gleiche längste Originalkante wie terrain.orientierteHuelle, ohne Renderer-Import.
 * Eine mögliche 90°-Drehung vertauscht die Ausdehnungen, nicht den Mittelpunkt.
 */
function huellenMitte(p: readonly Punkt[]): Punkt {
  let laengste = 0, achse = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const dx = p[i + 1][0] - p[i][0], dz = p[i + 1][1] - p[i][1], l = Math.hypot(dx, dz);
    if (l > laengste) { laengste = l; achse = Math.atan2(dz, dx); }
  }
  const c = Math.cos(achse), s = Math.sin(achse), us = p.map(q => q[0] * c + q[1] * s), vs = p.map(q => -q[0] * s + q[1] * c);
  const u = (Math.max(...us) + Math.min(...us)) / 2, v = (Math.max(...vs) + Math.min(...vs)) / 2;
  return [u * c - v * s, u * s + v * c];
}
function innen(q: Punkt, p: readonly Punkt[]): boolean {
  let drin = false;
  for (let i = 0, j = p.length - 2; i < p.length - 1; j = i++) {
    const a = p[i], b = p[j];
    if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) drin = !drin;
  }
  return drin;
}
const kreuz = (a: Punkt, b: Punkt, q: Punkt) => (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
function schneidet(a: Punkt, b: Punkt, c: Punkt, d: Punkt): boolean {
  if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0])
    || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1])) return false;
  return kreuz(a, b, c) * kreuz(a, b, d) <= 0 && kreuz(c, d, a) * kreuz(c, d, b) <= 0;
}
function vorfeldFrei(m: Punkt, tangente: Punkt, normal: Punkt, haus: Umriss, alle: readonly Umriss[]): boolean {
  // 20cm seitlich neben dem Türblatt und 15cm Reserve hinter dem 1,5m-Zugang.
  const p = (u: number, v: number): Punkt => [m[0] + tangente[0] * u + normal[0] * v, m[1] + tangente[1] * u + normal[1] * v];
  const rechteck = [p(-HALBE_BREITE, .025), p(HALBE_BREITE, .025), p(HALBE_BREITE, 1.65), p(-HALBE_BREITE, 1.65)];
  rechteck.push(rechteck[0]);
  const xs = rechteck.map(q => q[0]), zs = rechteck.map(q => q[1]);
  const box = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
  for (const nachbar of alle) {
    if (nachbar === haus || box[2] < nachbar.box[0] || box[0] > nachbar.box[2] || box[3] < nachbar.box[1] || box[1] > nachbar.box[3]) continue;
    if (rechteck.some(q => innen(q, nachbar.p)) || nachbar.p.some(q => innen(q, rechteck))) return false;
    for (let i = 0; i < rechteck.length - 1; i++) for (let j = 0; j < nachbar.p.length - 1; j++) {
      if (schneidet(rechteck[i], rechteck[i + 1], nachbar.p[j], nachbar.p[j + 1])) return false;
    }
  }
  return true;
}

/** 35m umfassen die sichtbaren Wohnfassaden beider Straßenseiten, keine ganze Siedlung.
 * Garagen und Gebäude außerhalb der Auswahl bleiben als Eingangsblocker berücksichtigt.
 */
export function bestimmeHofhaeuser(welt: Weltdaten, mass: Weltmass, hof: Hof | null): Hofhaus[] {
  if (!hof) return [];
  const [sued, west, nord, ost] = welt.bbox;
  const alle: Umriss[] = welt.gebaeude.flatMap((g, gebaeudeIndex) => {
    if (g.punkte.length < 4) return [];
    let p: Punkt[] = g.punkte.map(([lat, lon]) => [((lon - west) / (ost - west) - .5) * mass.breiteMeter,
      ((nord - lat) / (nord - sued) - .5) * mass.tiefeMeter]);
    const mitte = huellenMitte(p);
    const flaeche = p.slice(0, -1).reduce((a, q, i) => a + q[0] * p[i + 1][1] - q[1] * p[i + 1][0], 0);
    if (flaeche < 0) p.reverse();
    p = vereinfacheHauswand(p);
    const xs = p.map(q => q[0]), zs = p.map(q => q[1]);
    return [{ gebaeudeIndex, art: g.art, p, mitte, box: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] as [number, number, number, number] }];
  });
  // Ein gemeinsamer Blickpunkt vor dem Hof bevorzugt zugängliche Hof-/Straßenfassaden.
  // Freies Vorfeld bleibt die harte Bedingung, die Blickrichtung nur eine Rangfolge.
  const blick: Punkt = [hof.mitte[0] - hof.achse[0] * (hof.halb[0] + 8), hof.mitte[1] - hof.achse[1] * (hof.halb[0] + 8)];
  return alle.filter(h => WOHNARTEN.has(h.art) && (h.gebaeudeIndex === hof.gebaeudeIndex || Math.hypot(h.mitte[0] - hof.mitte[0], h.mitte[1] - hof.mitte[1]) <= RADIUS)).map(haus => {
    let eingang: Punkt | null = null, vorne: Punkt = [-hof.achse[1], hof.achse[0]], bester = -Infinity;
    for (let k = 0; k < haus.p.length - 1; k++) {
      const a = haus.p[k], b = haus.p[k + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l < 2) continue;
      const t: Punkt = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], n: Punkt = [t[1], -t[0]];
      const schritte = Math.max(1, Math.ceil((l - 2 * HALBE_BREITE) / .2));
      const kandidaten = Array.from({ length: schritte + 1 }, (_, i) => {
        const u = HALBE_BREITE + (l - 2 * HALBE_BREITE) * i / schritte;
        const m: Punkt = [a[0] + t[0] * u, a[1] + t[1] * u];
        return { m, frei: vorfeldFrei(m, t, n, haus, alle) };
      });
      for (let i = 0; i < kandidaten.length; i++) {
        if (!kandidaten[i].frei) continue;
        let ende = i; while (ende + 1 < kandidaten.length && kandidaten[ende + 1].frei) ende++;
        const m: Punkt = [(kandidaten[i].m[0] + kandidaten[ende].m[0]) / 2, (kandidaten[i].m[1] + kandidaten[ende].m[1]) / 2];
        const dx = blick[0] - m[0], dz = blick[1] - m[1], abstand = Math.max(1e-6, Math.hypot(dx, dz));
        const wert = 3 * (dx * n[0] + dz * n[1]) / abstand + Math.min(2, (ende - i) * .2);
        if (wert > bester && vorfeldFrei(m, t, n, haus, alle)) { bester = wert; eingang = m; vorne = n; }
        i = ende;
      }
    }
    return { gebaeudeIndex: haus.gebaeudeIndex, mitte: haus.mitte, vorne, eingang };
  });
}

/** Schmaler ortsfester Pflegezugang nur vor tatsächlich gewählten Eingängen. */
export function hofhausZugangFrei(x: number, z: number, haeuser: readonly Hofhaus[]): boolean {
  return haeuser.some(h => {
    if (!h.eingang) return false;
    const dx = x - h.eingang[0], dz = z - h.eingang[1];
    const v = dx * h.vorne[0] + dz * h.vorne[1], u = dx * h.vorne[1] - dz * h.vorne[0];
    return Math.abs(u) < 1.15 && v > -.25 && v < 3.2;
  });
}
