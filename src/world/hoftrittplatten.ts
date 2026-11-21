/** D307: zwei eingesetzte Trittsteine im geprüften Vorfeld eines echten Eingangs. */
import type { Color } from 'three';
import type { HausQuad } from './hausbauteil.js';

type Punkt = [number, number, number];
type PunktXZ = [number, number];

/** Weltkoordinaten; das unveränderte Farbobjekt erhält die Sockelrolle im Hausbatch.
 * Die Steine beginnen hinter der vorhandenen 38cm-Schwelle und bleiben innerhalb
 * des auf Nachbarfreiheit geprüften Vorfelds (1,65m tief, 1,45m breit).
 * Jeder Randpunkt und die Mitte liegen 3,5cm über dem dort abgetasteten Terrain;
 * die Unterseite reicht unter dessen niedrigsten Abtastpunkt. Keine Einzelmeshes.
 */
export function baueHoftrittplatten(quad: HausQuad, eingang: readonly number[], vorne: readonly number[],
  hoehe: (x: number, z: number) => number, seed: number, farbe: Color): void {
  if (![eingang[0], eingang[1], vorne[0], vorne[1], seed].every(Number.isFinite)) throw new Error('Trittplatten brauchen endliche Eingangskoordinaten und Seed.');
  const laenge = Math.hypot(vorne[0], vorne[1]);
  if (laenge < 1e-6) throw new Error('Trittplatten brauchen eine Eingangsrichtung.');
  const nx = vorne[0] / laenge, nz = vorne[1] / laenge;
  let saat = seed >>> 0;
  const zufall = () => {
    saat = (Math.imul(saat, 1664525) + 1013904223) >>> 0;
    return saat / 4294967296;
  };
  const welt = (u: number, v: number): PunktXZ => [eingang[0] + nz * u + nx * v, eingang[1] - nx * u + nz * v];
  const flaeche = (a: Punkt, b: Punkt, c: Punkt, d: Punkt) => {
    // Summe der beiden Dreiecksnormalen: auch leicht nichtplanare Oberseiten
    // zeigen nach außen, ohne einen abweichenden zweiten Normalenpfad zu bauen.
    const kreuz = (p: Punkt, q: Punkt, r: Punkt): Punkt => [
      (q[1]-p[1])*(r[2]-p[2])-(q[2]-p[2])*(r[1]-p[1]),
      (q[2]-p[2])*(r[0]-p[0])-(q[0]-p[0])*(r[2]-p[2]),
      (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]),
    ];
    const n0 = kreuz(a,b,c), n1 = kreuz(a,c,d);
    const n: Punkt = [n0[0]+n1[0],n0[1]+n1[1],n0[2]+n1[2]], l = Math.hypot(...n);
    quad(a,b,c,d,farbe,[n[0]/l,n[1]/l,n[2]/l]);
  };
  for (const v of [.76, 1.30]) {
    const u = (zufall()-.5)*.05, breite = .84+zufall()*.08, tiefe = .43+zufall()*.04;
    const links=u-breite/2, rechts=u+breite/2, hinten=v-tiefe/2, vorn=v+tiefe/2;
    const ecken = Array.from({length:4},()=>.05+zufall()*.035);
    // Im Uhrzeigersinn von oben: abgeschnittene Ecken statt dünner Splitter.
    const lokal: PunktXZ[] = [[links,hinten+ecken[0]],[links,vorn-ecken[1]],
      [links+ecken[1],vorn],[rechts-ecken[2],vorn],[rechts,vorn-ecken[2]],
      [rechts,hinten+ecken[3]],[rechts-ecken[3],hinten],[links+ecken[0],hinten]];
    const rand = lokal.map(([lu,lv])=>welt(lu,lv)), mitte = welt(u,v);
    const boden = [...rand,mitte].map(([x,z])=>hoehe(x,z));
    if (!boden.every(Number.isFinite)) throw new Error('Trittplatten brauchen endliche Terrainhöhen.');
    const untenY = Math.min(...boden)-.08;
    const oben: Punkt[] = rand.map(([x,z],i)=>[x,boden[i]+.035,z]);
    const unten: Punkt[] = rand.map(([x,z])=>[x,untenY,z]);
    const obenM: Punkt = [mitte[0],boden[8]+.035,mitte[1]], untenM: Punkt = [mitte[0],untenY,mitte[1]];
    for (let i=0;i<8;i++) {
      const j=(i+1)%8;
      flaeche(oben[i],unten[i],unten[j],oben[j]);
    }
    for (let i=0;i<8;i+=2) {
      const j=i+1,k=(i+2)%8;
      flaeche(obenM,oben[i],oben[j],oben[k]);
      flaeche(untenM,unten[k],unten[j],unten[i]);
    }
  }
}
