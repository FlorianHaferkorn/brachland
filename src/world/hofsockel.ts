/** D307: geschlossener Hofsockel und Kappe folgen dem Gelände statt einer Bodenebene. */
import type { Color } from 'three';
import type { HausQuad } from './hausbauteil.js';

type Punkt = [number, number, number];
type Sockelzustand = 'ruine' | 'verwachsen' | 'instandgesetzt';

/** Abschnitte entlang der Wandtangente, alle Koordinaten in Weltmetern.
 * Gemeinsame Endpunkte haben dieselbe Oberkante; die Unterseiten der einzelnen
 * geschlossenen Stücke bleiben unter dem Gelände. Ein Meter Abtastabstand hält
 * die geneigte Kappe am Hang, ohne Einzelmeshes oder Arbeit pro Frame.
 */
export function baueHofsockel(quad: HausQuad, ursprung: readonly number[], tangente: readonly number[],
  normal: readonly number[], abschnitte: readonly (readonly [number, number])[], grund: number,
  mindestOberkante: number, hoehe: (x: number, z: number) => number, sockelfarbe: Color, kappenfarbe: Color,
  zustand?: Sockelzustand): void {
  if (![ursprung[0],ursprung[1],tangente[0],tangente[1],normal[0],normal[1],grund,mindestOberkante].every(Number.isFinite)) {
    throw new Error('Hofsockel braucht endliche Koordinaten und Höhen.');
  }
  const tl=Math.hypot(tangente[0],tangente[1]), nl=Math.hypot(normal[0],normal[1]);
  if(tl<1e-6||nl<1e-6||Math.abs((tangente[0]*normal[0]+tangente[1]*normal[1])/(tl*nl))>1e-6) {
    throw new Error('Hofsockel braucht rechtwinklige Wandachsen.');
  }
  if(abschnitte.some(([a,b])=>!Number.isFinite(a)||!Number.isFinite(b)||b<=a)) throw new Error('Hofsockel braucht aufsteigende Wandabschnitte.');
  const tx=tangente[0]/tl,tz=tangente[1]/tl,nx=normal[0]/nl,nz=normal[1]/nl;
  const P=(u:number,y:number,v:number):Punkt=>[ursprung[0]+tx*u+nx*v,y,ursprung[1]+tz*u+nz*v];
  const terrain=(u:number,v:number) => {
    const p=P(u,0,v), y=hoehe(p[0],p[2]);
    if(!Number.isFinite(y)) throw new Error('Hofsockel braucht endliche Terrainhöhen.');
    return y;
  };
  const kreuz=(a:Punkt,b:Punkt,c:Punkt):Punkt=>[
    (b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),
    (b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),
    (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),
  ];
  const flaeche=(a:Punkt,b:Punkt,c:Punkt,d:Punkt,farbe:Color,aussen:readonly number[])=>{
    let n=kreuz(a,b,c);
    if(n[0]*aussen[0]+n[1]*aussen[1]+n[2]*aussen[2]<0) { const alt=b;b=d;d=alt;n=kreuz(a,b,c); }
    const l=Math.hypot(...n);
    quad(a,b,c,d,farbe,[n[0]/l,n[1]/l,n[2]/l]);
  };
  const koerper=(a:number,b:number,untenA:number,untenB:number,obenA:number,obenB:number,v0:number,v1:number,farbe:Color)=>{
    const A=P(a,untenA,v0),B=P(b,untenB,v0),C=P(b,untenB,v1),D=P(a,untenA,v1);
    const E=P(a,obenA,v0),F=P(b,obenB,v0),G=P(b,obenB,v1),H=P(a,obenA,v1);
    flaeche(D,C,G,H,farbe,[nx,0,nz]);
    flaeche(B,A,E,F,farbe,[-nx,0,-nz]);
    flaeche(A,D,H,E,farbe,[-tx,0,-tz]);
    flaeche(C,B,F,G,farbe,[tx,0,tz]);
    flaeche(E,H,G,F,farbe,[0,1,0]);
    flaeche(D,A,B,C,farbe,[0,-1,0]);
  };
  for(const [von,bis] of abschnitte) {
    const anzahl=Math.ceil(bis-von);
    const stellen=Array.from({length:anzahl+1},(_,i)=>von+(bis-von)*i/anzahl);
    const abtrag = zustand === 'ruine' ? .12 : zustand === 'verwachsen' ? .075 : .035;
    const kanten = stellen.map(u => {
      const [x, , z] = P(u, 0, 0);
      const frost = zustand === undefined ? 0 : abtrag * (.55 + .28*Math.sin(x*1.91+z*.87) + .17*Math.sin(z*3.37-x*1.03));
      const oben = Math.max(mindestOberkante - frost, terrain(u,.17) + .18 - frost*.50);
      return { oben, kappe: oben + .07 - frost*.38 };
    });
    for(let i=0;i<anzahl;i++) {
      const a=stellen[i],b=stellen[i+1],links=kanten[i],rechts=kanten[i+1];
      const unten=Math.min(grund,...[a,(a+b)/2,b].flatMap(u=>[.01,.015,.13,.17].map(v=>terrain(u,v)-.12)));
      koerper(a,b,unten,unten,links.oben,rechts.oben,.015,.13,sockelfarbe);
      koerper(a,b,links.oben,rechts.oben,links.kappe,rechts.kappe,.01,.17,kappenfarbe);
    }
  }
}
