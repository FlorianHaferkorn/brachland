import { ShapeUtils, Vector2 } from 'three';
import type { LoD2Koerper } from './osm.js';

type Punkt = [number, number, number];
type Dachrolle = 'deckung' | 'untersicht' | 'stirn' | 'wand';

/**
 * Der amtliche Dachkörper ersetzt die rechteckige Dachhülle. Nur der obere
 * Wandabschluss kommt aus LoD2, die Fassadendetails darunter aus dem Hausgenerator.
 */
export function baueLoD2Dach(
  koerper: LoD2Koerper, nachWelt: (lat: number, lon: number) => [number, number],
  sockel: number, traufe: number,
  zeichne: (a: Punkt, b: Punkt, c: Punkt, rolle: Dachrolle) => void,
): void {
  const dicke = .14;
  const tiefer = ([x, y, z]: Punkt): Punkt => [x, y - dicke, z];
  const punkt = ([lat, lon, y]: Punkt): Punkt => {
    const [x, z] = nachWelt(lat, lon);
    return [x, sockel + y, z];
  };
  const flaeche = (roh: Punkt[], aufDach: boolean) => {
    const gleich = (a: Punkt, b: Punkt) => a.every((wert, i) => wert === b[i]);
    const offen = roh.length && gleich(roh[0], roh[roh.length - 1]) ? roh.slice(0, -1) : roh;
    const ring = offen.filter((p, i) => !i || !gleich(p, offen[i - 1])).map(punkt);
    if (ring.length < 3) return;
    const spannweite = (achse: number) => {
      const werte = ring.map(p => p[achse]);
      return Math.max(...werte) - Math.min(...werte);
    };
    const waagerecht = aufDach || spannweite(0) >= spannweite(2) ? 0 : 2;
    const senkrecht = aufDach ? 2 : 1;
    const flach = ring.map(p => new Vector2(p[waagerecht] - ring[0][waagerecht], p[senkrecht] - ring[0][senkrecht]));
    const seite = aufDach ? -1 : Math.sign(ShapeUtils.area(flach));
    if (!seite) return;
    const dreiecke = ShapeUtils.triangulateShape(flach, []).map(([a, b, c]): [Punkt, Punkt, Punkt] => {
      const u = flach[b].clone().sub(flach[a]), v = flach[c].clone().sub(flach[a]);
      return u.cross(v) * seite > 0 ? [ring[a], ring[b], ring[c]] : [ring[a], ring[c], ring[b]];
    });
    if (aufDach && Math.sign(ShapeUtils.area(flach)) !== seite) ring.reverse();
    return { ring, dreiecke };
  };

  const dachkanten = new Map<string, [Punkt, Punkt]>();
  for (const roh of koerper.dachflaechen) {
    const dach = flaeche(roh, true);
    if (!dach) continue;
    for (const [a, b, c] of dach.dreiecke) {
      zeichne(a, b, c, 'deckung');
      zeichne(tiefer(a), tiefer(c), tiefer(b), 'untersicht');
    }
    for (const [i, a] of dach.ring.entries()) {
      const b = dach.ring[(i + 1) % dach.ring.length];
      const schluessel = [a.join(','), b.join(',')].sort().join('|');
      if (!dachkanten.delete(schluessel)) dachkanten.set(schluessel, [a, b]);
    }
  }
  for (const [a, b] of dachkanten.values()) {
    zeichne(b, a, tiefer(a), 'stirn');
    zeichne(b, tiefer(a), tiefer(b), 'stirn');
  }

  // Jedes Dreieck separat auf Traufhöhe abschneiden. Auch ein Giebel
  // mit zwei getrennten Spitzen bleibt dabei eine geschlossene Fläche.
  for (const roh of koerper.wandabschluesse) {
    const wand = flaeche(roh, false);
    for (const dreieck of wand?.dreiecke ?? []) {
      const oberhalb: Punkt[] = [];
      for (const [i, a] of dreieck.entries()) {
        const b = dreieck[(i + 1) % dreieck.length];
        if (a[1] >= traufe) oberhalb.push(a);
        if ((a[1] < traufe && b[1] > traufe) || (a[1] > traufe && b[1] < traufe)) {
          const t = (traufe - a[1]) / (b[1] - a[1]);
          oberhalb.push([a[0] + (b[0] - a[0]) * t, traufe, a[2] + (b[2] - a[2]) * t]);
        }
      }
      for (let i = 1; i + 1 < oberhalb.length; i++) {
        const a = oberhalb[0], b = oberhalb[i], c = oberhalb[i + 1];
        const uy = b[1] - a[1], vy = c[1] - a[1];
        const nx = uy * (c[2] - a[2]) - vy * (b[2] - a[2]);
        const nz = vy * (b[0] - a[0]) - uy * (c[0] - a[0]);
        if (nx * nx + nz * nz > 1e-10) zeichne(a, b, c, 'wand');
      }
    }
  }
}
