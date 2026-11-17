/** D306: offener Holzkasten, überhängendes Laub und einzelne runde Blütenköpfe. */
import type { Color } from 'three';
import { fassadenKasten, type HausQuad } from './hausbauteil.js';

type Punkt = [number, number, number];
type Farben = { holz: Color; laub: Color; bluete: Color; erde: Color };
const TAU = Math.PI * 2;

/** Lokale Koordinaten u/y/v; vorneV ist die äußere Vorderkante des Kastens.
 * Alles landet im bestehenden Hausbatch. 252–292 Dreiecke je Kasten, keine
 * Texturen, Einzelmeshes oder zusätzlichen Aufrufe des Haus-Zufallsstroms.
 */
export function baueLaubenkasten(quad: HausQuad, mitteU: number, obenY: number, vorneV: number, breite: number, seed: number, farben: Farben): void {
  if (![mitteU, obenY, vorneV, breite, seed].every(Number.isFinite) || breite <= .2) throw new Error('Laubenkasten braucht endliche Koordinaten und Breite über20cm.');
  let saat = seed >>> 0;
  const zufall = () => {
    saat = (saat + 0x6d2b79f5) >>> 0;
    let z = saat; z = Math.imul(z ^ (z >>> 15), z | 1); z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
  const u0 = mitteU - breite / 2, u1 = mitteU + breite / 2, v0 = vorneV - .26, v1 = vorneV, untenY = obenY - .2, dicke = .025;
  const K = fassadenKasten(quad, [0,0], [1,0], [0,1]);
  // Die vier geschlossenen Bretter tragen ihren sichtbaren oberen Rand selbst.
  // Holzobjekt nicht klonen: der Hausgenerator weist darüber den Holzscan zu.
  K(u0,u1,untenY,obenY,v0,v0+dicke,farben.holz);
  K(u0,u1,untenY,obenY,v1-dicke,v1,farben.holz);
  K(u0,u0+dicke,untenY,obenY,v0+dicke,v1-dicke,farben.holz);
  K(u1-dicke,u1,untenY,obenY,v0+dicke,v1-dicke,farben.holz);
  quad([u0,untenY,v0],[u0,untenY,v1],[u1,untenY,v1],[u1,untenY,v0],farben.holz,[0,-1,0]);
  const erdeY = obenY - .04;
  quad([u0+dicke,erdeY,v0+dicke],[u1-dicke,erdeY,v0+dicke],[u1-dicke,erdeY,v1-dicke],[u0+dicke,erdeY,v1-dicke],farben.erde,[0,1,0]);

  // Ein Quad darf zwei benachbarte, nicht koplanare Dreiecke verbinden. Die
  // gemeinsame Diagonale bleibt eine echte Außenkante, kein entartetes Dreieck.
  const koerper = (mitte: Punkt, radius: Punkt, ringzahl: number, farbe: Color, winkel: number, rund: boolean) => {
    const P = (x: number, y: number, z: number): Punkt => [mitte[0] + radius[0] * (x*Math.cos(winkel)-z*Math.sin(winkel)), mitte[1] + radius[1]*y,
      mitte[2] + radius[2] * (x*Math.sin(winkel)+z*Math.cos(winkel))];
    const flaeche = (a: Punkt,b: Punkt,c: Punkt,d: Punkt) => {
      const n: Punkt = [(a[0]+b[0]+c[0]+d[0])/4-mitte[0],(a[1]+b[1]+c[1]+d[1])/4-mitte[1],(a[2]+b[2]+c[2]+d[2])/4-mitte[2]];
      quad(a,b,c,d,farbe,n);
    };
    const nord=P(0,1,0), sued=P(0,-1,0);
    if (rund) {
      // Zwei versetzte Fünferringe plus Pole: geschlossener Ikosaeder,20Tri.
      const h=1/Math.sqrt(5), r=2/Math.sqrt(5);
      const oben=Array.from({length:ringzahl},(_,i)=>P(Math.cos(TAU*i/ringzahl)*r,h,Math.sin(TAU*i/ringzahl)*r));
      const unten=Array.from({length:ringzahl},(_,i)=>P(Math.cos(TAU*(i+.5)/ringzahl)*r,-h,Math.sin(TAU*(i+.5)/ringzahl)*r));
      for(let i=0;i<ringzahl;i++) { const j=(i+1)%ringzahl; flaeche(oben[i],unten[i],oben[j],nord); flaeche(unten[i],sued,unten[j],oben[j]); }
    } else {
      const ring=Array.from({length:ringzahl},(_,i)=>P(Math.cos(TAU*i/ringzahl),0,Math.sin(TAU*i/ringzahl)));
      for(let i=0;i<ringzahl;i++) flaeche(ring[i],sued,ring[(i+1)%ringzahl],nord);
    }
  };
  const gruen = [farben.laub.clone().multiplyScalar(.84),farben.laub,farben.laub.clone().multiplyScalar(1.08)];
  const rot = [farben.bluete,farben.bluete.clone().multiplyScalar(.85),farben.bluete.clone().multiplyScalar(1.10)];
  const schritt=breite/6;
  for(let i=0;i<6;i++) {
    const u=u0+schritt*(i+.5)+(zufall()-.5)*schritt*.22;
    const y=obenY+.015+zufall()*.055, v=v1-.055+zufall()*.085;
    koerper([u,y,v],[Math.min(.20,schritt*.66),.065+zufall()*.04,.10+zufall()*.035],5,gruen[i%3],zufall()*TAU,true);
  }
  const anzahl=4+Math.floor(zufall()*3), bluetenSchritt=(breite-.10)/anzahl;
  for(let i=0;i<anzahl;i++) {
    const u=u0+.05+bluetenSchritt*(i+.5)+(zufall()-.5)*bluetenSchritt*.20;
    const y=obenY+.12+zufall()*.07, v=v1-.055+(zufall()-.5)*.08;
    const r=Math.min(.066,bluetenSchritt*.33)*(.88+zufall()*.18);
    koerper([u,y,v],[r,.045+zufall()*.018,r],5,rot[i%3],zufall()*TAU,true);
  }
}
