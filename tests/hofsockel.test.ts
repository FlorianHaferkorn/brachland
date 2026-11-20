/** D307: geschlossene Sockelstücke, kontinuierliche Kappe und Geländeanschluss. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { baueFeldsteinsockel, baueHofsockel } from '../src/world/hofsockel.js';
import type { HausQuad } from '../src/world/hausbauteil.js';
type Punkt=[number,number,number];
type Flaeche={p:Punkt[];n:readonly[number,number,number];farbe:THREE.Color};
const sockel=new THREE.Color('#665f52'), kappe=new THREE.Color('#867f70');
let ok=0;
const pruefe=(name:string,wahr:boolean)=>{assert.ok(wahr,name);ok++;console.log(`  ✓ ${name}`);};
function geschlossen(f:Flaeche[]) {
  const kanten=new Map<string,number>(),richtungen=new Map<string,number>();
  let volumen=0;
  const m=f[0].p[0];
  for(const q of f)for(const ids of [[0,1,2],[0,2,3]]) {
    const p=ids.map(i=>new THREE.Vector3(q.p[i][0]-m[0],q.p[i][1]-m[1],q.p[i][2]-m[2]));
    volumen+=p[0].dot(new THREE.Vector3().crossVectors(p[1],p[2]))/6;
    for(let k=0;k<3;k++) {
      const a=q.p[ids[k]].join(','),b=q.p[ids[(k+1)%3]].join(','),key=[a,b].sort().join('|');
      kanten.set(key,(kanten.get(key)??0)+1);richtungen.set(key,(richtungen.get(key)??0)+(a<b?1:-1));
    }
  }
  return [...kanten.values()].every(n=>n===2)&&[...richtungen.values()].every(n=>n===0)&&volumen>1e-5;
}
const abschnitte:[number,number][]=[[-3,-.7],[.8,4.3]],mindest=34.34,grund=33.9;
for(const winkel of [0,.7,Math.PI,-1.8])for(const seite of [-1,1]) {
  const t=[Math.cos(winkel),Math.sin(winkel)],n=[-t[1]*seite,t[0]*seite],ursprung=[1433,434];
  const lokal=(p:Punkt)=>{const dx=p[0]-ursprung[0],dz=p[2]-ursprung[1];return {u:dx*t[0]+dz*t[1],v:dx*n[0]+dz*n[1]};};
  const hoehe=(x:number,z:number)=>{const q=lokal([x,0,z]);return 34+.14*q.u+.07*Math.sin(q.u*.9)+q.v*.25;};
  const f:Flaeche[]=[],quad:HausQuad=(a,b,c,d,farbe,n)=>f.push({p:[a,b,c,d],farbe,n});
  baueHofsockel(quad,ursprung,t,n,abschnitte,grund,mindest,hoehe,sockel,kappe);
  const titel=`Winkel${winkel.toFixed(2)}, Basis${seite}`;
  pruefe(`${titel}: sieben Stücke mit je zwei geschlossenen Körpern`,f.length===84&&Array.from({length:14},(_,i)=>geschlossen(f.slice(i*6,(i+1)*6))).every(Boolean));
  let normalGut=true,grenzen=true,bodenGut=true,stetig=true;
  const enden=new Map<string,number[]>();
  for(const q of f) {
    for(const ids of [[0,1,2],[0,2,3]]) {
      const [a,b,c]=ids.map(i=>new THREE.Vector3(...q.p[i]));
      const k=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a));
      normalGut&&=k.lengthSq()>1e-14&&k.dot(new THREE.Vector3(...q.n))>0&&q.n.every(Number.isFinite)&&Math.abs(Math.hypot(...q.n)-1)<1e-10;
    }
    for(const p of q.p) {
      const {u,v}=lokal(p);
      grenzen&&=p.every(Number.isFinite)&&v>.009999&&v<.170001&&abschnitte.some(([a,b])=>u>=a-1e-8&&u<=b+1e-8);
    }
  }
  for(let i=0;i<7;i++) {
    const teil=f.slice(i*12,(i+1)*12),oberseite=teil[4];
    const us=teil.flatMap(q=>q.p.map(p=>lokal(p).u)),a=Math.min(...us),b=Math.max(...us);
    grenzen&&=b-a<=1.000001;
    for(const p of oberseite.p) {
      const {u}=lokal(p),x=ursprung[0]+t[0]*u+n[0]*.17,z=ursprung[1]+t[1]*u+n[1]*.17;
      bodenGut&&=Math.abs(p[1]-Math.max(mindest,hoehe(x,z)+.18))<1e-9;
      const key=u.toFixed(7),liste=enden.get(key)??[];liste.push(p[1]);enden.set(key,liste);
    }
    for(const p of teil[5].p)bodenGut&&=p[1]<=grund+1e-9&&p[1]<hoehe(p[0],p[2])-.10;
    for(const q of [teil[4],teil[10]])for(const ids of [[0,1,2],[0,2,3]]) {
      const [a,b,c]=ids.map(i=>q.p[i]);
      for(let u=0;u<=4;u++)for(let v=0;v<=4-u;v++) {
        const p=a.map((w,j)=>w*(1-(u+v)/4)+b[j]*u/4+c[j]*v/4) as Punkt;
        bodenGut&&=p[1]>hoehe(p[0],p[2])+.16;
      }
    }
    for(const p of teil[10].p) {
      const l=lokal(p),partner=teil[4].p.find(q=>Math.abs(lokal(q).u-l.u)<1e-8);
      bodenGut&&=!!partner&&Math.abs(p[1]-partner[1]-.07)<1e-9;
    }
  }
  for(const werte of enden.values())stetig&&=Math.max(...werte)-Math.min(...werte)<1e-10;
  pruefe(`${titel}: beide Dreiecke nach außen, Einheitsnormalen endlich`,normalGut);
  pruefe(`${titel}: keine Geometrie im Türspalt, Wandstücke höchstens1m`,grenzen);
  pruefe(`${titel}: Sockel und Kappe über gewelltem Hang, Unterseite eingebettet`,bodenGut);
  pruefe(`${titel}: gemeinsame Enden haben exakt dieselbe Oberkante`,stetig);
  pruefe(`${titel}: Farbidentität für Sockel und Kappe erhalten`,f.every((q,i)=>q.farbe===(i%12<6?sockel:kappe)));
}
const alterung = (zustand: 'ruine' | 'instandgesetzt') => {
  const flaechen: Flaeche[] = [];
  baueHofsockel((a,b,c,d,farbe,n) => flaechen.push({ p: [a,b,c,d], n, farbe }),
    [1433,434], [1,0], [0,1], [[0,7]], 0, .34, () => 0, sockel, kappe, zustand);
  return flaechen;
};
const ruine = alterung('ruine'), reparatur = alterung('instandgesetzt');
const ruecken = (f: Flaeche[]) => f.filter((_, i) => i % 12 === 10).flatMap(q => q.p.map(p => p[1]));
const streuung = (werte: number[]) => Math.max(...werte) - Math.min(...werte);
pruefe('D336: Ruinensockel ist unregelmäßiger abgetragen als der reparierte Sockel',
  streuung(ruecken(ruine)) > .04 && streuung(ruecken(ruine)) > streuung(ruecken(reparatur)) * 2);
pruefe('D336: Verwitterte Kappen und Sockel bleiben geschlossen und teilen die Stoßkante',
  Array.from({ length: 14 }, (_,i) => geschlossen(ruine.slice(i*6, (i+1)*6))).every(Boolean)
  && Array.from({ length: 6 }, (_,i) =>
    ruine[i*12+10].p[2].every((wert,k) => wert === ruine[(i+1)*12+10].p[1][k])).every(Boolean));
let anzahl=0;const dummy:HausQuad=()=>{anzahl++;};
baueHofsockel(dummy,[0,0],[1,0],[0,1],[],0,.34,()=>0,sockel,kappe);
pruefe('Leere Abschnittsliste erzeugt keine Geometrie',anzahl===0);
assert.throws(()=>baueHofsockel(dummy,[NaN,0],[1,0],[0,1],[[0,1]],0,.34,()=>0,sockel,kappe));
assert.throws(()=>baueHofsockel(dummy,[0,0],[0,0],[0,1],[[0,1]],0,.34,()=>0,sockel,kappe));
assert.throws(()=>baueHofsockel(dummy,[0,0],[1,0],[1,1],[[0,1]],0,.34,()=>0,sockel,kappe));
assert.throws(()=>baueHofsockel(dummy,[0,0],[1,0],[0,1],[[1,0]],0,.34,()=>0,sockel,kappe));
assert.throws(()=>baueHofsockel(dummy,[0,0],[1,0],[0,1],[[0,1]],0,.34,()=>NaN,sockel,kappe));
ok+=5;
const feldstein: Flaeche[] = [];
const ring: [number, number][] = [[0,0], [5,0], [5,3], [0,3], [0,0]];
const feldhoehe = (x: number, z: number) => .12 * x - .08 * z + .043 * Math.sin(2 * x + z);
const felddreiecke: HausQuad = (a,b,c,d,farbe,n) => {
  const v = (p: Punkt) => new THREE.Vector3(...p);
  const rechts = v(b).sub(v(a)).cross(v(c).sub(v(a))).dot(new THREE.Vector3(...n)) > 0;
  feldstein.push({ p: rechts ? [a,b,c,d] : [a,d,c,b], farbe, n });
};
for (let k = 0; k < ring.length - 1; k++) {
  baueFeldsteinsockel(felddreiecke, ring, k, -.4, feldhoehe, sockel, [], k === 0 ? [1.7, 3.3] : undefined);
}
pruefe('D342: Gehrungen und Türlaibungen bilden eine geschlossene Steinauflage', geschlossen(feldstein));
const schulter = feldstein.filter(f => f.n[1] === 1).flatMap(f => f.p);
const fussseite = feldstein.filter(f => f.n[1] === -1).flatMap(f => f.p);
pruefe('D342: Die niedrige Schulter folgt dem Hang und das Fundament sitzt im Boden',
  streuung(schulter.map(p => p[1])) > .50
  && schulter.every(([x,y,z]) => y - feldhoehe(x,z) >= .14 && y - feldhoehe(x,z) <= .45)
  && fussseite.every(([x,y,z]) => y - feldhoehe(x,z) < -.12));
pruefe('D342: Die Sockelgeometrie lässt den Türspalt frei',
  !feldstein.some(f => f.p.some(([x, , z]) => x > 1.70001 && x < 3.29999 && z < -.01)));
console.log(`\n${ok} bestanden, 0 fehlgeschlagen`);
