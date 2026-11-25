/** D303: Körper im lokalen Fassadensystem, gesammelt im bestehenden Hausmesh. */
import type { Color } from 'three';

/** Auswahl und Eingangsadresse; undefined erhält die frühere Richtungsprobe, null setzt keine Tür. */
export interface HausReferenz {
  gebaeudeIndex?: number;
  mitte: readonly number[];
  vorne: readonly number[];
  eingang?: readonly number[] | null;
}

type Punkt = [number, number, number];
export type HausQuad = (a: Punkt, b: Punkt, c: Punkt, d: Punkt, farbe: Color, normal: readonly [number, number, number]) => void;

/** Keine Einzelmeshes: sechs Flächen je Bauteil mit korrekten Aussennormalen. */
export function fassadenKasten(quad: HausQuad, ursprung: readonly number[], richtung: readonly number[], normal: readonly number[]) {
  return (u0: number, u1: number, y0: number, y1: number, v0: number, v1: number, farbe: Color) => {
    const P = (u: number, y: number, v: number): Punkt => [ursprung[0] + richtung[0] * u + normal[0] * v, y,
      ursprung[1] + richtung[1] * u + normal[1] * v];
    quad(P(u0,y0,v1),P(u1,y0,v1),P(u1,y1,v1),P(u0,y1,v1),farbe,[normal[0],0,normal[1]]);
    quad(P(u1,y0,v0),P(u0,y0,v0),P(u0,y1,v0),P(u1,y1,v0),farbe,[-normal[0],0,-normal[1]]);
    quad(P(u0,y0,v0),P(u0,y0,v1),P(u0,y1,v1),P(u0,y1,v0),farbe,[-richtung[0],0,-richtung[1]]);
    quad(P(u1,y0,v1),P(u1,y0,v0),P(u1,y1,v0),P(u1,y1,v1),farbe,[richtung[0],0,richtung[1]]);
    quad(P(u0,y1,v0),P(u0,y1,v1),P(u1,y1,v1),P(u1,y1,v0),farbe,[0,1,0]);
    quad(P(u0,y0,v1),P(u0,y0,v0),P(u1,y0,v0),P(u1,y0,v1),farbe,[0,-1,0]);
  };
}

/** Nahezu kollineare Ecken entfernen; höchstens 1,5 cm Abweichung am Grundriss. */
export function vereinfacheHauswand(p: readonly PunktXZ[]): PunktXZ[] {
  const ring = p.slice(0, -1).filter((b, i, alle) => {
    const a=alle[(i+alle.length-1)%alle.length], c=alle[(i+1)%alle.length];
    const la=Math.hypot(b[0]-a[0],b[1]-a[1]), lb=Math.hypot(c[0]-b[0],c[1]-b[1]);
    const kreuz=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
    const vor=(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]);
    return la<1e-6 || lb<1e-6 || vor<=0 || Math.abs(kreuz)/(la+lb)>0.015;
  });
  return ring.length >= 3 ? [...ring,ring[0]] : [...p];
}
type PunktXZ = [number, number];

/** Geneigte Bank mit vorspringender Tropfkante und Anschluss an die Laibung. */
export function baueFassadenbank(
  quad: HausQuad, punkt: (u: number, y: number, v: number) => Punkt, halb: number, y: number,
  laibung: number, vor: number, tangente: PunktXZ, normal: PunktXZ, farbe: Color,
) {
  const a = punkt(-halb, y, laibung), b = punkt(halb, y, laibung);
  const c = punkt(halb, y - .035, vor), d = punkt(-halb, y - .035, vor);
  const tiefer = ([x, y, z]: Punkt): Punkt => [x, y - .055, z];
  const unten = [a, b, c, d].map(tiefer);
  quad(a, b, c, d, farbe, [0, 1, 0]);
  quad(d, c, unten[2], unten[3], farbe, [normal[0], 0, normal[1]]);
  quad(a, d, unten[3], unten[0], farbe, [-tangente[0], 0, -tangente[1]]);
  quad(c, b, unten[1], unten[2], farbe, [tangente[0], 0, tangente[1]]);
  quad(unten[0], unten[1], unten[2], unten[3], farbe, [0, -1, 0]);
}

/** Durchgehender sechsseitiger Rohrquerschnitt auch über den Knien. */
export function baueFassadenFallrohr(
  quad: HausQuad, welt: (u: number, y: number, v: number) => Punkt, u: number,
  verlauf: readonly (readonly [y: number, v: number])[], farbe: Color,
) {
  const mittelpunkte = verlauf.map(([y, v]) => welt(u, y, v));
  const ringe = verlauf.map(([y, v], i) => {
    const [y0, v0] = verlauf[Math.max(0, i - 1)], [y1, v1] = verlauf[Math.min(verlauf.length - 1, i + 1)];
    const laenge = Math.hypot(y1 - y0, v1 - v0);
    return Array.from({ length: 6 }, (_, ecke) => {
      const winkel = ecke * Math.PI / 3, quer = Math.sin(winkel) * .053;
      return welt(u + Math.cos(winkel) * .053, y - quer * (v1 - v0) / laenge, v + quer * (y1 - y0) / laenge);
    });
  });
  for (let i = 1; i < ringe.length; i++) for (let k = 0; k < 6; k++) {
    const ende = (k + 1) % 6;
    const a = ringe[i - 1][k], b = ringe[i - 1][ende], c = ringe[i][ende], d = ringe[i][k];
    const m = mittelpunkte[i - 1], n = mittelpunkte[i];
    quad(a, b, c, d, farbe, [
      (a[0] + b[0] - 2*m[0]) + (c[0] + d[0] - 2*n[0]),
      (a[1] + b[1] - 2*m[1]) + (c[1] + d[1] - 2*n[1]),
      (a[2] + b[2] - 2*m[2]) + (c[2] + d[2] - 2*n[2]),
    ]);
  }
}
