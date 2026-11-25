/** D306: geschlossene Blüten-/Laubkörper statt durchgehender Quaderbänder. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { baueLaubenkasten } from '../src/world/laubenkasten.js';
import type { HausQuad } from '../src/world/hausbauteil.js';
import type { Weltdaten } from '../src/world/osm.js';
import type { Aufsatzboden } from '../src/world/terrain.js';
type Punkt=[number,number,number];
type Flaeche={p:Punkt[];farbe:THREE.Color;n:readonly[number,number,number]};
let ok=0,fehler=0;
function pruefe(name:string,gut:boolean,info=''){console.log(`  ${gut?'✓':'✗'} ${name} ${info}`);gut?ok++:fehler++;}
const farben={holz:new THREE.Color('#4e4034'),laub:new THREE.Color('#4d603f'),bluete:new THREE.Color('#b5433d'),erde:new THREE.Color('#4e4034').multiplyScalar(.28)};
function capture(seed:number,breite=1.05){const f:Flaeche[]=[];const ausgabe:HausQuad=(a,b,c,d,farbe,n)=>f.push({p:[a,b,c,d],farbe,n});baueLaubenkasten(ausgabe,2,4,6,breite,seed,farben);return f;}
const serial=(f:Flaeche[])=>JSON.stringify(f.map(q=>({p:q.p,n:q.n,f:q.farbe.toArray()})));
const kreuz=(a:Punkt,b:Punkt,c:Punkt)=>new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a)));
function geschlossen(f:Flaeche[]){const kanten=new Map<string,number>();for(const q of f)for(const ids of [[0,1,2],[0,2,3]])for(let k=0;k<3;k++){const a=q.p[ids[k]].join(','),b=q.p[ids[(k+1)%3]].join(','),key=[a,b].sort().join('|');kanten.set(key,(kanten.get(key)??0)+1);}return [...kanten.values()].every(n=>n===2);}
for(const seed of [0,1,17,991,4294967295]){
  const f=capture(seed),koepfe=(f.length-86)/10;
  pruefe(`Seed${seed}: rundes Laub bleibt unter300Dreiecken`,f.length*2<=300&&f.length*2>=252,String(f.length*2));
  pruefe(`Seed${seed}: vier bis sechs separate Blütenköpfe`,Number.isInteger(koepfe)&&koepfe>=4&&koepfe<=6,String(koepfe));
  let endlich=true,entartet=0,normal=0;
  for(const q of f){for(const p of q.p)endlich&&=p.every(Number.isFinite);endlich&&=q.n.every(Number.isFinite);const a=kreuz(q.p[0],q.p[1],q.p[2]),b=kreuz(q.p[0],q.p[2],q.p[3]);if(a.lengthSq()<1e-18||b.lengthSq()<1e-18)entartet++;if(a.dot(new THREE.Vector3(...q.n))*b.dot(new THREE.Vector3(...q.n))<=0)normal++;}
  pruefe(`Seed${seed}: endliche Punkte und Richtungen`,endlich);
  pruefe(`Seed${seed}: keine entarteten Dreiecke`,entartet===0,String(entartet));
  pruefe(`Seed${seed}: beide Dreiecke haben dieselbe Außenseite`,normal===0,String(normal));
  const p=f.flatMap(q=>q.p);
  pruefe(`Seed${seed}: Kasten-/Pflanzenabmessungen begrenzt`,p.every(q=>q[0]>=2-1.05/2-.10&&q[0]<=2+1.05/2+.10&&q[1]>=3.8-1e-8&&q[1]<=4.27&&q[2]>=5.74-1e-8&&q[2]<=6.18));
  pruefe(`Seed${seed}: Holzobjekt für Scanrolle erhalten`,f.slice(0,25).every(q=>q.farbe===farben.holz));
  pruefe(`Seed${seed}: Erde vier Zentimeter unter offenem Rand`,f[25].farbe===farben.erde&&f[25].p.every(p=>Math.abs(p[1]-3.96)<1e-9)&&f.slice(0,24).some(q=>q.p.every(p=>p[1]===4)));
  for(let i=0;i<6;i++)pruefe(`Seed${seed}: runde Laubgruppe${i} geschlossen`,geschlossen(f.slice(26+i*10,36+i*10)));
  let bedeckung=0;
  for(let i=0;i<koepfe;i++){const gruppe=f.slice(86+i*10,96+i*10),xs=gruppe.flatMap(q=>q.p.map(p=>p[0]));bedeckung+=Math.max(...xs)-Math.min(...xs);pruefe(`Seed${seed}: Blütenkopf${i} geschlossen`,geschlossen(gruppe));}
  pruefe(`Seed${seed}: Blüten bilden keine durchgehende Markise`,bedeckung<1.05*.8);
  pruefe(`Seed${seed}: Laub hängt vor dem Holz über`,f.slice(26,86).some(q=>q.p.some(p=>p[2]>6.06&&p[1]<4.03)));
  pruefe(`Seed${seed}: deterministische Geometrie`,serial(f)===serial(capture(seed)));
}
pruefe('Anderer Seed ändert die Bepflanzung',serial(capture(1))!==serial(capture(2)));
const pflanzen=capture(17).slice(26),hoehen=pflanzen.filter((_,i)=>i%4===0).map(q=>q.p.reduce((s,p)=>s+p[1],0)/4);
pruefe('Pflanzengruppen haben unterschiedliche Höhen',Math.max(...hoehen)-Math.min(...hoehen)>.02);
assert.throws(()=>capture(1,0));ok++;

// Rootintegration: Pflanzen tragen dieselben vollständigen Hausattribute wie
// die Brüstung. Nur Glas darf Nachtglut oder Raumdaten tragen.
Object.defineProperty(globalThis,'location',{value:{search:'?hofgruen=1&hofhaeuser=1&hoflauben=1'},configurable:true});
const {baueGebaeude}=await import('../src/world/terrain.js');
const boden:Aufsatzboden={breiteMeter:1000,tiefeMeter:1000,hoeheAn:()=>0,tiefsteFlaeche:()=>0};
const welt:Weltdaten={bbox:[0,0,1,1],aufloesung:2,hoehen:[[0,0],[0,0]],hoeheMin:0,hoeheMax:0,biome:[['wiese','wiese'],['wiese','wiese']],flaechen:[],linien:[],gebaeude:[],wege:[],marker:[],attribution:'Fixture'};
const haus:Weltdaten['gebaeude'][number]={art:'house',ebenen:2,punkte:[[-6,-4],[6,-4],[6,4],[-6,4],[-6,-4]].map(([u,v])=>[.5-(200+v)/1000,.5+(200+u)/1000])};
const g=baueGebaeude(welt,boden,[haus],[[200,200]],[{mitte:[200,200],vorne:[0,-1],eingang:[200,196]}])!;
const pos=g.getAttribute('position'),rolle=g.getAttribute('rolle'),glut=g.getAttribute('glut'),uv=g.getAttribute('raumUv');
let finite=true,glutFalsch=0,raumFalsch=0,entartet=0;
for(const a of Object.values(g.attributes)){finite&&=a.count===pos.count;for(const wert of a.array)finite&&=Number.isFinite(wert);}
for(let i=0;i<pos.count;i++){if(rolle.getX(i)!==5&&glut.getX(i)!==0)glutFalsch++;if(rolle.getX(i)!==5&&(uv.getX(i)!==0||uv.getY(i)!==0||uv.getZ(i)!==0))raumFalsch++;}
for(let i=0;i<pos.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),c=new THREE.Vector3().fromBufferAttribute(pos,i+2);if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-14)entartet++;}
pruefe('Integriertes Haus: vollständige endliche Attribute',finite);
pruefe('Integriertes Haus: keine entarteten Pflanzen-/Brüstungsflächen',entartet===0,String(entartet));
pruefe('Integriertes Haus: Pflanzen und Holz ohne Fensterglut',glutFalsch===0);
pruefe('Integriertes Haus: Pflanzen und Holz ohne Raum-UV',raumFalsch===0);
const wieder=baueGebaeude(welt,boden,[haus],[[200,200]],[{mitte:[200,200],vorne:[0,-1],eingang:[200,196]}])!;
pruefe('Integrierte Kästen deterministisch',Object.keys(g.attributes).every(n=>{const a=g.getAttribute(n).array,b=wieder.getAttribute(n).array;return a.length===b.length&&a.every((v,i)=>v===b[i]);}));
g.dispose();wieder.dispose();

// Eigene Prozesse lesen die beim Import festgeschriebenen Schalter unabhängig.
// Das untere Hausdrittel enthält den Holzstapel, aber keine neue Laube: sein
// identischer Hash prüft insbesondere den erhaltenen Haus-Zufallsverbrauch.
const kind = `
import fs from 'node:fs';
import {createHash} from 'node:crypto';
Object.defineProperty(globalThis,'location',{value:{search:'?hofgruen=1&hofhaeuser=1'+process.env.D306_LAUBEN_QUERY},configurable:true});
const {entpackeWelt}=await import('./src/world/osm.ts');
const {baueGebaeude}=await import('./src/world/terrain.ts');
const {bestimmeHof}=await import('./src/world/hofplatz.ts');
const {bestimmeHofhaeuser}=await import('./src/world/hofhaeuser.ts');
const welt=entpackeWelt(JSON.parse(fs.readFileSync('public/world/oental.json','utf8')).welt),lod=JSON.parse(fs.readFileSync('public/world/oental-lod2.json','utf8'));
const [s,we,n,o]=welt.bbox,mass={breiteMeter:(o-we)*111320*Math.cos((s+n)/2*Math.PI/180),tiefeMeter:(n-s)*111320};
const boden={...mass,hoeheAn:()=>0,tiefsteFlaeche:()=>0},hof=bestimmeHof(welt,mass),haeuser=bestimmeHofhaeuser(welt,mass,hof);
const hash=(g,tief=false)=>{
  const h=createHash('sha256'),p=g.getAttribute('position'),indizes=[];
  for(let i=0;i<p.count;i++)if(!tief||p.getY(i)<2)indizes.push(i);
  for(const [name,a]of Object.entries(g.attributes)){
    h.update(name);const w=new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length),d=new Uint32Array(indizes.length*a.itemSize);
    for(let i=0;i<indizes.length;i++)for(let k=0;k<a.itemSize;k++)d[i*a.itemSize+k]=w[indizes[i]*a.itemSize+k];
    h.update(Buffer.from(d.buffer));
  }return h.digest('hex');
};
const result={};
for(const i of [...haeuser.map(h=>h.gebaeudeIndex),352,353,354]){
  const haus={...welt.gebaeude[i],lod2:lod[i]},g=baueGebaeude(welt,boden,[haus],[hof.mitte],haeuser);
  const ohneLaube={...haus,fassade:{fensterachsen:{traufe:3,giebel:2},laube:'keine',hochlaube:false,putz:'#ddddcc',holz:'#665544',laeden:'#335533',malerei:null,stufe:0}};
  const k=baueGebaeude(welt,boden,[ohneLaube],[hof.mitte],haeuser);
  result[i]={ganz:hash(g),unten:hash(g,true),ohneLaube:hash(k)};g.dispose();k.dispose();
}
console.log(JSON.stringify(result));`;
type Stand = Record<string,{ganz:string;unten:string;ohneLaube:string}>;
const gegenlauf=(query:string):Stand=>JSON.parse(execFileSync(process.execPath,['--import','tsx','--input-type=module','--eval',kind],
  {encoding:'utf8',env:{...process.env,D306_LAUBEN_QUERY:query}}));
const bisher=gegenlauf(''), aus=gegenlauf('&hoflauben=0'), an=gegenlauf('&hoflauben=1');
for(const i of [297,301,307,308,320,344,345,346]){
  pruefe(`Hofhaus${i}: expliziter0-Schalter entspricht unverändertem Gegenlauf`,aus[i].ganz===bisher[i].ganz);
  pruefe(`Hofhaus${i}: unteres Haus und Holzstapel beiLaubenprobe bitgleich`,an[i].unten===aus[i].unten);
  pruefe(`Hofhaus${i}: ohne Laube keinerlei Geometrie-/Farbänderung`,an[i].ohneLaube===aus[i].ohneLaube);
}
for(const i of [352,353,354])pruefe(`Haus${i}: Garage oder nicht ausgewählter Nachbar unverändert`,an[i].ganz===aus[i].ganz&&aus[i].ganz===bisher[i].ganz);
pruefe('Aktivierte Probe ändert tatsächlich Laubengeometrie im Hofensemble',[297,301,307,308,320,344,345,346].some(i=>an[i].ganz!==aus[i].ganz));
console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if(fehler)process.exitCode=1;
