/** D307: Trittplatten bleiben geschlossen, im freien Vorfeld und im Hang verankert. */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { baueHoftrittplatten } from '../src/world/hoftrittplatten.js';
import type { HausQuad } from '../src/world/hausbauteil.js';

type Punkt = [number, number, number];
type Flaeche = { p: Punkt[]; farbe: THREE.Color; n: readonly [number, number, number] };
const farbe = new THREE.Color('#645c50');
let ok = 0;
const pruefe = (name: string, wahr: boolean) => { assert.ok(wahr, name); ok++; console.log(`  ✓ ${name}`); };
function baue(seed: number, winkel = 0, eingang: [number, number] = [1437.578,431.053],
  hoehe: (x: number, z: number) => number = (x,z) => 34+(x-1437)*.19+(z-431)*.11) {
  const f: Flaeche[] = [], vorne: [number,number] = [Math.sin(winkel),Math.cos(winkel)];
  const quad: HausQuad = (a,b,c,d,ton,n) => { f.push({p:[a,b,c,d],farbe:ton,n}); };
  baueHoftrittplatten(quad,eingang,vorne,hoehe,seed,farbe);
  return { f, vorne, eingang, hoehe };
}
function normale(a: Punkt,b: Punkt,c: Punkt) {
  return new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a))
    .cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a)));
}
function geschlossen(f: Flaeche[]) {
  const kanten = new Map<string,number>();
  const richtungen = new Map<string,number>();
  let volumen=0;
  for (const q of f) for (const ids of [[0,1,2],[0,2,3]]) for (let k=0;k<3;k++) {
    const a=q.p[ids[k]].join(','),b=q.p[ids[(k+1)%3]].join(','), key=[a,b].sort().join('|');
    kanten.set(key,(kanten.get(key)??0)+1);
    richtungen.set(key,(richtungen.get(key)??0)+(a<b?1:-1));
  }
  const mitte=f[0].p[0];
  for(const q of f)for(const ids of [[0,1,2],[0,2,3]]) {
    const p=ids.map(i=>new THREE.Vector3(...q.p[i]).sub(new THREE.Vector3(...mitte)));
    volumen+=p[0].dot(p[1].clone().cross(p[2]))/6;
  }
  return [...kanten.values()].every(n=>n===2)&&[...richtungen.values()].every(n=>n===0)&&volumen>.01;
}
const serial = (f: Flaeche[]) => JSON.stringify(f.map(q=>({p:q.p,n:q.n,f:q.farbe.toArray()})));
for (const seed of [0,1,17,991,0xffffffff]) for (const winkel of [0,.63,Math.PI,-1.7]) {
  const {f,vorne,eingang,hoehe} = baue(seed,winkel);
  const titel = `Seed${seed}, Richtung${winkel.toFixed(2)}`;
  pruefe(`${titel}: zwei geschlossene Körper, zusammen64Dreiecke`,f.length===32&&geschlossen(f.slice(0,16))&&geschlossen(f.slice(16)));
  let endlich=true,richtung=true,bereich=true,kontakt=true;
  for (const q of f) {
    endlich &&= q.p.every(p=>p.every(Number.isFinite))&&q.n.every(Number.isFinite)&&Math.abs(Math.hypot(...q.n)-1)<1e-10;
    for (const ids of [[0,1,2],[0,2,3]]) {
      const n=normale(q.p[ids[0]],q.p[ids[1]],q.p[ids[2]]);
      richtung &&= n.lengthSq()>1e-12&&n.dot(new THREE.Vector3(...q.n))>0;
    }
    for (const p of q.p) {
      const dx=p[0]-eingang[0],dz=p[2]-eingang[1];
      const u=dx*vorne[1]-dz*vorne[0],v=dx*vorne[0]+dz*vorne[1];
      bereich &&= Math.abs(u)<.5&&v>.48&&v<1.60;
    }
  }
  for(let i=0;i<2;i++) {
    const platte=f.slice(i*16,(i+1)*16);
    for(let k=0;k<8;k++) {
      const oben=platte[k].p[0],unten=platte[k].p[1];
      kontakt &&= Math.abs(oben[1]-hoehe(oben[0],oben[2])-.035)<1e-10&&unten[1]<hoehe(unten[0],unten[2])-.07;
    }
    for(const q of platte.filter(q=>q.n[1]>.5)) for(const ids of [[0,1,2],[0,2,3]]) {
      const a=q.p[ids[0]],b=q.p[ids[1]],c=q.p[ids[2]];
      for(let u=0;u<=4;u++)for(let v=0;v<=4-u;v++) {
        const p=a.map((w,j)=>w*(1-(u+v)/4)+b[j]*u/4+c[j]*v/4) as Punkt;
        kontakt &&= p[1]-hoehe(p[0],p[2])>.02&&p[1]-hoehe(p[0],p[2])<.05;
      }
    }
  }
  pruefe(`${titel}: endliche Einheitsnormalen und keine dünnen/entarteten Dreiecke`,endlich&&richtung);
  pruefe(`${titel}: Schwelle und Grenze des freien Vorfelds bleiben frei`,bereich);
  pruefe(`${titel}: Oberseite folgt Hang, Unterseite im Boden`,kontakt);
  pruefe(`${titel}: Farbidentität erhält Materialrolle3`,f.every(q=>q.farbe===farbe));
}
pruefe('Gleicher Seed erzeugt identische Form',serial(baue(17).f)===serial(baue(17).f));
pruefe('Andere Seeds variieren die Form',serial(baue(17).f)!==serial(baue(18).f));
const nonlinear=(x:number,z:number)=>34+.08*x+.10*z+.01*Math.sin(x*1.3)*Math.cos(z*.9);
const kurve=baue(23,.8,[1437,431],nonlinear);
pruefe('Leicht gewellter Boden hat überall korrekte Flächenrichtungen',kurve.f.every(q=>[[0,1,2],[0,2,3]].every(ids=>normale(q.p[ids[0]],q.p[ids[1]],q.p[ids[2]]).dot(new THREE.Vector3(...q.n))>0)));
const dummy: HausQuad=()=>{};
assert.throws(()=>baueHoftrittplatten(dummy,[NaN,0],[0,1],()=>0,1,farbe));
assert.throws(()=>baueHoftrittplatten(dummy,[0,0],[0,0],()=>0,1,farbe));
assert.throws(()=>baueHoftrittplatten(dummy,[0,0],[0,1],()=>NaN,1,farbe));
ok+=3;
console.log(`\n${ok} bestanden, 0 fehlgeschlagen`);
