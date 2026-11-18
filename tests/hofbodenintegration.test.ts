/** D307: echte Hofhäuser, getrennte Schalterprozesse und Bodenkontakt am Hang. */
import { execFileSync } from 'node:child_process';

let ok = 0, fehler = 0;
function pruefe(name: string, gut: boolean, info = '') {
  console.log(`  ${gut ? '✓' : '✗'} ${name} ${info}`);
  gut ? ok++ : fehler++;
}

// Die Schalter werden beim Modulimport festgeschrieben: jeder Gegenlauf braucht
// seinen eigenen Prozess. Reale Grundrisse, aber analytisch bekannte Hanghöhe,
// damit die Prüfung nicht dieselbe Interpolation wie die Implementierung kopiert.
const kind = `
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
Object.defineProperty(globalThis,'location',{value:{search:'?hofgruen=1&hofhaeuser=1&hoflauben=1&bau=1&lod2=1'+process.env.D307_BODEN_QUERY},configurable:true});
const {entpackeWelt,imPolygon}=await import('./src/world/osm.ts');
const {baueGebaeude}=await import('./src/world/terrain.ts');
const {bestimmeHof,waehleHof,HOF_UNIFORM}=await import('./src/world/hofplatz.ts');
const {bestimmeHofhaeuser}=await import('./src/world/hofhaeuser.ts');
const {indexiereHausGeometrie}=await import('./src/world/hausindex.ts');
const welt=entpackeWelt(JSON.parse(fs.readFileSync('public/world/oental.json','utf8')).welt),lod=JSON.parse(fs.readFileSync('public/world/oental-lod2.json','utf8'));
const vorher=JSON.stringify(welt.gebaeude),[s,we,n,o]=welt.bbox;
const mass={breiteMeter:(o-we)*111320*Math.cos((s+n)/2*Math.PI/180),tiefeMeter:(n-s)*111320};
const hoehe=(x,z)=>34+(x-1433)*.08+(z-434)*.05;
const boden={...mass,hoeheAn:hoehe,tiefsteFlaeche:hoehe},hof=bestimmeHof(welt,mass),haeuser=bestimmeHofhaeuser(welt,mass,hof);
waehleHof(welt,mass);
const ringe=welt.gebaeude.map(g=>g.punkte.map(([lat,lon])=>[((lon-we)/(o-we)-.5)*mass.breiteMeter,((n-lat)/(n-s)-.5)*mass.tiefeMeter]));
const hash=g=>{
  const h=createHash('sha256');
  for(const [name,a]of Object.entries(g.attributes)) {h.update(name);h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}
  return h.digest('hex');
};
const result={haeuser:{},bewohntHash:'',eingabeErhalten:false,uniforms:{zahl:HOF_UNIFORM.zugangZahl.value,werte:HOF_UNIFORM.zugaenge.value.map(q=>q.toArray())},auswahl:haeuser};
const material=new THREE.MeshBasicMaterial({side:THREE.FrontSide}),strahl=new THREE.Raycaster();
for(const i of [...haeuser.map(h=>h.gebaeudeIndex),352,353,354]) {
  const haus={...welt.gebaeude[i],lod2:lod[i]},g=baueGebaeude(welt,boden,[haus],[[hof.mitte[0],hof.mitte[1]-75]],haeuser);
  const p=g.getAttribute('position'),r=g.getAttribute('rolle'),z=g.getAttribute('zustand'),glut=g.getAttribute('glut'),uv=g.getAttribute('raumUv');
  const referenz=haeuser.find(h=>h.gebaeudeIndex===i);
  let endlich=true,raumFalsch=0,glutFalsch=0,kontaktFehler=0,oberePlatten=0,blockiert=0,ausserhalbVorfeld=0,licht=0;
  for(const a of Object.values(g.attributes)) {endlich&&=a.count===p.count;for(const wert of a.array)endlich&&=Number.isFinite(wert);}
  for(let j=0;j<p.count;j++) {
    if(glut.getX(j)!==0){licht++;if(r.getX(j)!==5)glutFalsch++;}
    if(r.getX(j)!==5 && (uv.getX(j)!==0||uv.getY(j)!==0||uv.getZ(j)!==0))raumFalsch++;
    if(referenz && Math.abs(z.getY(j)-(p.getY(j)-hoehe(p.getX(j),p.getZ(j))))>2e-5)kontaktFehler++;
    if(!referenz?.eingang||r.getX(j)!==3||Math.abs(p.getY(j)-hoehe(p.getX(j),p.getZ(j))-.035)>2e-5)continue;
    const dx=p.getX(j)-referenz.eingang[0],dz=p.getZ(j)-referenz.eingang[1];
    const u=dx*referenz.vorne[1]-dz*referenz.vorne[0],v=dx*referenz.vorne[0]+dz*referenz.vorne[1];
    if(v<.5)continue;
    oberePlatten++;
    if(Math.abs(u)>.725||v<.025||v>1.65)ausserhalbVorfeld++;
    if(ringe.some((q,k)=>k!==i&&imPolygon([p.getX(j),p.getZ(j)],q)))blockiert++;
  }
  const indexiert=indexiereHausGeometrie(g);
  let indexGleich=indexiert.index.count===p.count;
  for(const [name,a]of Object.entries(g.attributes)) {
    const b=indexiert.getAttribute(name);
    for(let j=0;j<a.count;j++)for(let k=0;k<a.itemSize;k++)if(a.array[j*a.itemSize+k]!==b.array[indexiert.index.getX(j)*a.itemSize+k])indexGleich=false;
  }
  const tritte=[];
  if(referenz?.eingang) {
    const mesh=new THREE.Mesh(g,material);mesh.updateMatrixWorld();
    for(const vor of [.76,1.30]) {
      const x=referenz.eingang[0]+referenz.vorne[0]*vor,z=referenz.eingang[1]+referenz.vorne[1]*vor;
      strahl.set(new THREE.Vector3(x,hoehe(x,z)+.2,z),new THREE.Vector3(0,-1,0));
      const t=strahl.intersectObject(mesh,false)[0];
      tritte.push(!!t&&r.getX(t.face.a)===3&&Math.abs(t.point.y-hoehe(x,z)-.035)<2e-5);
    }
  }
  result.haeuser[i]={hash:hash(g),ecken:p.count,stufe:z.getX(0),endlich,raumFalsch,glutFalsch,kontaktFehler,oberePlatten,blockiert,ausserhalbVorfeld,indexGleich,tritte,licht};
  if(i===297){
    const innen=referenz.mitte;
    if(!imPolygon(innen,ringe[i])) throw Error('Bewohnerprobe muss im Grundriss liegen');
    const bewohnt=baueGebaeude(welt,boden,[haus],[innen],haeuser);
    if(bewohnt.getAttribute('zustand').getX(0)===0) result.bewohntHash=hash(bewohnt);
    bewohnt.dispose();
  }
  indexiert.dispose();g.dispose();
}
material.dispose();result.eingabeErhalten=vorher===JSON.stringify(welt.gebaeude);
console.log(JSON.stringify(result));`;

interface Hausbefund {
  hash: string; ecken: number; stufe: number; endlich: boolean; raumFalsch: number; glutFalsch: number; licht: number;
  kontaktFehler: number; oberePlatten: number; blockiert: number; ausserhalbVorfeld: number;
  indexGleich: boolean; tritte: boolean[];
}
interface Stand {
  haeuser: Record<number, Hausbefund>; eingabeErhalten: boolean; bewohntHash: string;
  uniforms: { zahl: number; werte: number[][] };
  auswahl: { gebaeudeIndex: number; eingang: [number, number] | null; vorne: [number, number] }[];
}
const lauf = (query: string): Stand => JSON.parse(execFileSync(process.execPath,
  ['--import', 'tsx', '--input-type=module', '--eval', kind],
  { encoding: 'utf8', env: { ...process.env, D307_BODEN_QUERY: query } }));
const bisher = lauf(''), aus = lauf('&hofboden=0'), an = lauf('&hofboden=1');
const verfall = lauf('&hofboden=1&hofverfall=1');
pruefe('Drei Schalterläufe erhalten alle Weltgrundrisse', bisher.eingabeErhalten && aus.eingabeErhalten && an.eingabeErhalten);
pruefe('Echte Hofauswahl bleibt auf acht Wohnhäuser begrenzt', an.auswahl.map(h => h.gebaeudeIndex).join() === '297,301,307,308,320,344,345,346');
pruefe('Ohne Probe keine aktiven Zugangsuniforms', bisher.uniforms.zahl === 0 && aus.uniforms.zahl === 0);
const eingangsHaeuser = an.auswahl.filter(h => h.eingang);
pruefe('Alle freien realen Eingänge sind ohne Slotversatz im Shader gepackt', an.uniforms.zahl === eingangsHaeuser.length
  && eingangsHaeuser.every((h, i) => an.uniforms.werte[i].every((w, k) => w === [...h.eingang!, ...h.vorne][k])));
for (const h of an.auswahl) {
  const i = h.gebaeudeIndex, a = an.haeuser[i], b = aus.haeuser[i];
  pruefe(`Haus${i}: 0-Schalter entspricht dem bisherigen Gegenlauf`, b.hash === bisher.haeuser[i].hash);
  pruefe(`Haus${i}: aktivierte Probe fügt tatsächliche Plattengeometrie hinzu`, a.hash !== b.hash && a.ecken > b.ecken);
  pruefe(`Haus${i}: vollständige endliche Attribute und unveränderte Fensterrollen`, a.endlich && a.glutFalsch === 0 && a.raumFalsch === 0);
  pruefe(`Haus${i}: Kontaktabstand folgt dem lokalen Hang statt Hausminimum`, a.kontaktFehler === 0, String(a.kontaktFehler));
  pruefe(`Haus${i}: Platten im freien Türvorfeld, außerhalb aller Nachbargrundrisse`, a.oberePlatten > 0 && a.blockiert === 0 && a.ausserhalbVorfeld === 0);
  pruefe(`Haus${i}: beide Platten sind von oben treffbar und liegen 3,5cm über Boden`, a.tritte.length === 2 && a.tritte.every(Boolean));
  pruefe(`Haus${i}: bestehende Kompaktierung erhält jedes Attributwort`, a.indexGleich);
}
for (const i of [352, 353, 354]) pruefe(`Haus${i}: Garagen/nicht gewählter Nachbar in allen Attributen unverändert`, an.haeuser[i].hash === aus.haeuser[i].hash && aus.haeuser[i].hash === bisher.haeuser[i].hash);
pruefe('D312: Ein Bewohner im Gebäude erhält die gepflegte Fassung', verfall.bewohntHash === an.haeuser[297].hash);
pruefe('D312: Verfall erhält die Weltgrundrisse und Nachbargeometrie', verfall.eingabeErhalten
  && [352, 353, 354].every(i => verfall.haeuser[i].hash === an.haeuser[i].hash));
pruefe('D312: Gegenprobe zählt alle Hofhäuser zur bewohnten Umgebung', an.auswahl.every(h => an.haeuser[h.gebaeudeIndex].stufe === 0));
pruefe('D312: Aufgegebene Hofhäuser haben zwei Verfallsstufen und keine Fensterglut', verfall.auswahl.map(h => {
  const b = verfall.haeuser[h.gebaeudeIndex];
  return b.licht === 0 ? b.stufe : -1;
}).join() === '1,2,2,2,2,1,2,1');
pruefe('D312: Verfall bleibt kompaktierbar und beide Trittplatten bleiben erreichbar', verfall.auswahl.every(h => {
  const b = verfall.haeuser[h.gebaeudeIndex];
  return b.endlich && b.indexGleich && b.tritte.length === 2 && b.tritte.every(Boolean);
}));
console.log(`\nHofbodenintegration: ${ok} bestanden, ${fehler} Fehler.`);
if (fehler) process.exitCode = 1;
