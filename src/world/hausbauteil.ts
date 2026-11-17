/** D303: Körper im lokalen Fassadensystem, gesammelt im bestehenden Hausmesh. */
import type { Color } from 'three';

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
