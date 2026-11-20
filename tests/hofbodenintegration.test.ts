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
const {baueGebaeude,orientierteHuelle}=await import('./src/world/terrain.ts');
const {baueLoD2Dach}=await import('./src/world/lod2dach.ts');
const {bestimmeHof,waehleHof,HOF_UNIFORM}=await import('./src/world/hofplatz.ts');
const {bestimmeHofhaeuser}=await import('./src/world/hofhaeuser.ts');
const {indexiereHausGeometrie}=await import('./src/world/hausindex.ts');
const welt=entpackeWelt(JSON.parse(fs.readFileSync('public/world/oental.json','utf8')).welt),lod=JSON.parse(fs.readFileSync('public/world/oental-lod2.json','utf8'));
const nutzungen=JSON.parse(fs.readFileSync('content/regions/oental.json','utf8')).hausnutzung;
const zuordnung=nutzungen.map(n=>welt.gebaeude.flatMap((g,i)=>imPolygon(n.ort,g.punkte)?[i]:[]));
const vorher=JSON.stringify(welt.gebaeude),[s,we,n,o]=welt.bbox;
const mass={breiteMeter:(o-we)*111320*Math.cos((s+n)/2*Math.PI/180),tiefeMeter:(n-s)*111320};
const hoehe=(x,z)=>34+(x-1433)*.08+(z-434)*.05;
const boden={...mass,hoeheAn:hoehe,tiefsteFlaeche:hoehe},hof=bestimmeHof(welt,mass),haeuser=bestimmeHofhaeuser(welt,mass,hof);
waehleHof(welt,mass);
const nachWelt=(lat,lon)=>[((lon-we)/(o-we)-.5)*mass.breiteMeter,((n-lat)/(n-s)-.5)*mass.tiefeMeter];
const ringe=welt.gebaeude.map(g=>g.punkte.map(p=>nachWelt(...p)));
const hash=g=>{
  const h=createHash('sha256');
  for(const [name,a]of Object.entries(g.attributes)) {h.update(name);h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}
  return h.digest('hex');
};
const result={haeuser:{},bewohntHash:'',eingabeErhalten:false,uniforms:{zahl:HOF_UNIFORM.zugangZahl.value,werte:HOF_UNIFORM.zugaenge.value.map(q=>q.toArray())},auswahl:haeuser,zuordnung};
if(process.env.D307_BODEN_QUERY.includes('&milbingerdetail=1')) {
  const check={dachkern:true,richtung:true,neueDeckung:0,rinnen:0,ueberschneidungen:0};
  for(const i of [410,413,444,506,507,509,511,513]) {
    const koerper=lod[i].koerper;
    for(const k of koerper) {
      const bau=(nachbarn)=>{
        const flaechen={deckung:[],untersicht:[],stirn:[],wand:[],rinne:[]};
        baueLoD2Dach(k,nachWelt,30,30+k.t,(a,b,c,rolle)=>flaechen[rolle].push([a,b,c]),nachbarn);
        return flaechen;
      };
      const nachbarn=koerper.filter(q=>q!==k).map(q=>q.grundriss);
      const vorher=bau(), nachher=bau(nachbarn);
      const deckung=nachher.deckung.slice(vorher.deckung.length);
      check.dachkern&&=JSON.stringify(vorher.deckung)===JSON.stringify(nachher.deckung.slice(0,vorher.deckung.length))
        && JSON.stringify(vorher.wand)===JSON.stringify(nachher.wand);
      check.richtung&&=nachher.deckung.every(([a,b,c])=>(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])>0)
        && nachher.untersicht.every(([a,b,c])=>(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])<0);
      const nachbarWelt=nachbarn.map(ring=>ring.map(p=>nachWelt(...p)));
      for(const [a,b,c] of [...deckung,...nachher.rinne]) {
        const mitte=[(a[0]+b[0]+c[0])/3,(a[2]+b[2]+c[2])/3];
        if(nachbarWelt.some(ring=>imPolygon(mitte,ring))) check.ueberschneidungen++;
      }
      check.neueDeckung+=deckung.length;
      check.rinnen+=nachher.rinne.length;
    }
  }
  result.dachdetails=check;
}
const material=new THREE.MeshBasicMaterial({side:THREE.FrontSide}),strahl=new THREE.Raycaster();
for(const i of [...haeuser.map(h=>h.gebaeudeIndex),316,343,352,353,354,355,506,508,509,510,512,693]) {
  const haus={...welt.gebaeude[i],lod2:lod[i],hausnutzung:nutzungen.find(n=>imPolygon(n.ort,welt.gebaeude[i].punkte))};
  const g=baueGebaeude(welt,boden,[haus],[[hof.mitte[0],hof.mitte[1]-75]],haeuser);
  const p=g.getAttribute('position'),r=g.getAttribute('rolle'),z=g.getAttribute('zustand'),glut=g.getAttribute('glut'),uv=g.getAttribute('raumUv');
  const referenz=haeuser.find(h=>h.gebaeudeIndex===i);
  const dachRinge=haus.lod2?.koerper?.map(k=>k.grundriss.map(p=>nachWelt(...p))) ?? [];
  let endlich=true,raumFalsch=0,glutFalsch=0,kontaktFehler=0,oberePlatten=0,blockiert=0,ausserhalbVorfeld=0,licht=0,schuttEcken=0,balkenEcken=0;
  let blattecken=0, holzrahmen=0, tiefeOeffnung=0, vertieftesGlas=0, regenEcken=0;
  const dachHoehen={};
  for(const a of Object.values(g.attributes)) {endlich&&=a.count===p.count;for(const wert of a.array)endlich&&=Number.isFinite(wert);}
  for(let j=0;j<p.count;j++) {
    if(r.getX(j)===7) blattecken++;
    if(r.getX(j)===6) holzrahmen++;
    if(r.getX(j)===5) {
      const x=p.getX(j),z=p.getZ(j), tiefe=haus.hausnutzung ? .23 : .18;
      for(const ring of haus.hausnutzung ? [ringe[i]] : dachRinge) {
        if(!imPolygon([x,z],ring)) continue;
        const abstand=Math.min(...ring.map(([ax,az],k)=>{
          const [bx,bz]=ring[(k+1)%ring.length], dx=bx-ax,dz=bz-az;
          if(dx*dx+dz*dz<1e-9) return Infinity;
          const t=THREE.MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);
          return Math.hypot(x-ax-dx*t,z-az-dz*t);
        }));
        if(Math.abs(abstand-tiefe)<.01) { vertieftesGlas++; break; }
      }
    }
    if(glut.getX(j)!==0){licht++;if(r.getX(j)!==5)glutFalsch++;}
    const putzRegen=i===508 && r.getX(j)===0 && uv.getZ(j)===1 && process.env.D307_BODEN_QUERY.includes('&westfassade=1');
    if(putzRegen) regenEcken++;
    else if(r.getX(j)!==5 && r.getX(j)!==7 && (uv.getX(j)!==0||uv.getY(j)!==0||uv.getZ(j)!==0))raumFalsch++;
    if((referenz || (haus.lod2?.koerper && process.env.D307_BODEN_QUERY.includes('&milbingerboden=1')))
      && Math.abs(z.getY(j)-(p.getY(j)-hoehe(p.getX(j),p.getZ(j))))>2e-5)kontaktFehler++;
    if(i===308&&r.getX(j)===2&&z.getY(j)>4) {
      const ort=p.getX(j).toFixed(3)+','+p.getZ(j).toFixed(3);
      dachHoehen[ort]=Math.max(dachHoehen[ort]??-Infinity,p.getY(j));
    }
    if(i===308&&referenz?.eingang&&r.getX(j)===4) {
      const dx=p.getX(j)-referenz.eingang[0],dz=p.getZ(j)-referenz.eingang[1];
      const [nx,nz]=referenz.vorne,vor=dx*nx+dz*nz,seitlich=dx*(-nz)+dz*nx;
      if(vor>.3&&vor<2.25&&seitlich<-.92&&z.getY(j)<.4)schuttEcken++;
      if(vor>.55&&vor<1.65&&seitlich<-.92&&z.getY(j)>1&&z.getY(j)<3.4)balkenEcken++;
    }
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
  const tritte=[], tuerTiefen=[], wandTiefen=[];
  let firstLaenge=0, firstWinkel=0, dachstufe=0;
  if(i===509 || i===510) {
    // Die höchsten Dachvertices liefern Länge und Winkel aus dem gebauten Netz.
    const dachpunkte=[];
    for(let j=0;j<p.count;j++) if(r.getX(j)===2) dachpunkte.push([p.getX(j),p.getY(j),p.getZ(j)]);
    const maxY=Math.max(...dachpunkte.map(q=>q[1]));
    const first=dachpunkte.filter(q=>q[1]>=maxY-(i===509?.02:.006));
    for(const a of first) for(const b of first) {
      const laenge=Math.hypot(b[0]-a[0],b[2]-a[2]);
      if(laenge<=firstLaenge) continue;
      firstLaenge=laenge;
      firstWinkel=(Math.atan2(b[2]-a[2],b[0]-a[0])*180/Math.PI+180)%180;
    }
  }
  if(i===512 && lod[i].teile) {
    const hu=orientierteHuelle(ringe[i],lod[i].p*Math.PI/180);
    const sattel=lod[i].teile.filter(t=>t[0]===3100);
    const u=hu.minU+(sattel[0][2]+sattel[1][1])/2;
    const mesh=new THREE.Mesh(g,material);
    mesh.updateMatrixWorld();
    const hi=[];
    for(const du of [-.24,.24]) {
      const [x,z]=hu.welt(u+du,hu.minV+.33);
      strahl.set(new THREE.Vector3(x,hoehe(x,z)+25,z),new THREE.Vector3(0,-1,0));
      hi.push(strahl.intersectObject(mesh,false)[0]?.point.y);
    }
    if(hi.every(Number.isFinite)) dachstufe=Math.abs(hi[0]-hi[1]);
  }
  if(i===508) {
    const ring=ringe[i], wandBoden=Math.min(...ring.map(([x,z])=>hoehe(x,z)));
    const flaeche=ring.slice(0,-1).reduce((s,[x,z],k)=>s+x*ring[k+1][1]-z*ring[k+1][0],0);
    const mesh=new THREE.Mesh(g,material);
    mesh.updateMatrixWorld();
    for(let k=0;k<ring.length-1;k++){
      const [x,z]=ring[k], dx=ring[k+1][0]-x, dz=ring[k+1][1]-z, laenge=Math.hypot(dx,dz);
      if(laenge<3) continue;
      const nx=dz/laenge*Math.sign(flaeche), nz=-dx/laenge*Math.sign(flaeche);
      for(let u=1;u<20;u++){
        strahl.set(new THREE.Vector3(x+dx*u/20+nx*1.2,wandBoden+lod[i].t*.79,z+dz*u/20+nz*1.2),new THREE.Vector3(-nx,0,-nz));
        const tiefe=strahl.intersectObject(mesh,false)[0]?.distance;
        if(tiefe!==undefined&&tiefe>2.35&&tiefe<4.05) tiefeOeffnung++;
      }
    }
  }
  if(referenz?.eingang) {
    const mesh=new THREE.Mesh(g,material);mesh.updateMatrixWorld();
    for(const vor of [.76,1.30]) {
      const x=referenz.eingang[0]+referenz.vorne[0]*vor,z=referenz.eingang[1]+referenz.vorne[1]*vor;
      strahl.set(new THREE.Vector3(x,hoehe(x,z)+.2,z),new THREE.Vector3(0,-1,0));
      const t=strahl.intersectObject(mesh,false)[0];
      tritte.push(!!t&&r.getX(t.face.a)===3&&Math.abs(t.point.y-hoehe(x,z)-.035)<2e-5);
    }
    if(i===308) {
      const [nx,nz]=referenz.vorne;
      const messTiefe=(seitlich,y)=>{
        const x=referenz.eingang[0]+nx*1.25+nz*seitlich,z=referenz.eingang[1]+nz*1.25-nx*seitlich;
        strahl.set(new THREE.Vector3(x,y,z),new THREE.Vector3(-nx,0,-nz));
        return strahl.intersectObject(mesh,false)[0]?.distance??null;
      };
      for(const seitlich of [-.25,-.13,.13,.25])tuerTiefen.push(messTiefe(seitlich,hoehe(...referenz.eingang)+1.25));
      const oben=Math.min(...ringe[i].map(q=>hoehe(...q)))+lod[i].t;
      for(const seitlich of [-.86,-.32,.32,.86])wandTiefen.push(messTiefe(seitlich,oben-.36));
    }
  }
  const positionHash=createHash('sha256').update(Buffer.from(p.array.buffer,p.array.byteOffset,p.array.byteLength)).digest('hex');
  result.haeuser[i]={hash:hash(g),positionHash,ecken:p.count,stufe:z.getX(0),endlich,raumFalsch,glutFalsch,kontaktFehler,oberePlatten,blockiert,ausserhalbVorfeld,indexGleich,tritte,licht,tuerTiefen,wandTiefen,schuttEcken,balkenEcken,dachHoehen,blattecken,holzrahmen,tiefeOeffnung,firstLaenge,firstWinkel,dachstufe,vertieftesGlas,regenEcken};
  if(i===297){
    const innen=referenz.mitte;
    if(!imPolygon(innen,ringe[i])) throw Error('Bewohnerprobe muss im Grundriss liegen');
    const bewohnt=baueGebaeude(welt,boden,[haus],[innen],haeuser);
    if(Math.floor(bewohnt.getAttribute('zustand').getX(0)%4)===0) result.bewohntHash=hash(bewohnt);
    bewohnt.dispose();
  }
  indexiert.dispose();g.dispose();
}
material.dispose();result.eingabeErhalten=vorher===JSON.stringify(welt.gebaeude);
console.log(JSON.stringify(result));`;

interface Hausbefund {
  hash: string; positionHash: string; ecken: number; stufe: number; endlich: boolean; raumFalsch: number; glutFalsch: number; licht: number;
  kontaktFehler: number; oberePlatten: number; blockiert: number; ausserhalbVorfeld: number;
  indexGleich: boolean; tritte: boolean[]; tuerTiefen: (number | null)[]; wandTiefen: (number | null)[]; schuttEcken: number;
  balkenEcken: number; dachHoehen: Record<string, number>;
  blattecken: number; holzrahmen: number; tiefeOeffnung: number;
  firstLaenge: number; firstWinkel: number; dachstufe: number; vertieftesGlas: number; regenEcken: number;
}
interface Stand {
  haeuser: Record<number, Hausbefund>; eingabeErhalten: boolean; bewohntHash: string;
  dachdetails?: { dachkern: boolean; richtung: boolean; neueDeckung: number; rinnen: number; ueberschneidungen: number };
  uniforms: { zahl: number; werte: number[][] }; zuordnung: number[][];
  auswahl: { gebaeudeIndex: number; eingang: [number, number] | null; vorne: [number, number] }[];
}
const lauf = (query: string): Stand => JSON.parse(execFileSync(process.execPath,
  ['--import', 'tsx', '--input-type=module', '--eval', kind],
  { encoding: 'utf8', env: { ...process.env, D307_BODEN_QUERY: query } }));
const bisher = lauf(''), aus = lauf('&hofboden=0'), an = lauf('&hofboden=1');
const verfall = lauf('&hofboden=1&hofverfall=1');
const ranke = lauf('&hofboden=1&hofverfall=1&hofranke=1');
const ruine = lauf('&hofboden=1&hofverfall=1&hofranke=1&hofruine=1');
const spur = lauf('&hofboden=1&hofverfall=1&hofranke=1&hofruine=1&hofeinsturz=1');
const ziel = lauf('&hofboden=1&hofverfall=1&hofranke=1&hofruine=1&hofeinsturz=1&hofziel=1');
const dachbruch = lauf('&hofboden=1&hofverfall=1&hofranke=1&hofruine=1&hofeinsturz=1&hofziel=1&hofdachbruch=1');
const zielbildQuery = '&hofboden=1&hofverfall=1&hofranke=1&hofruine=1&hofeinsturz=1&hofziel=1&hofdachbruch=1&hoflicht=1&stimmung=hofdachbruch&zieltreue=1';
const zieltreue = lauf(zielbildQuery);
const verlauf = lauf(zielbildQuery + '&verfallverlauf=1');
const ortsprobe = lauf(zielbildQuery + '&verfallverlauf=1&ortsalterung=1');
const silhouette = lauf(zielbildQuery + '&verfallverlauf=1&ortsalterung=1&hofsilhouette=1');
const westprobe = lauf(zielbildQuery + '&verfallverlauf=1&ortsalterung=1&hofsilhouette=1&westverfall=1');
const westdetail = lauf(zielbildQuery + '&verfallverlauf=1&ortsalterung=1&hofsilhouette=1&westverfall=1&westdetail=1');
const westdachQuery = zielbildQuery + '&verfallverlauf=1&ortsalterung=1&hofsilhouette=1&westverfall=1&westdetail=1&westdach=1';
const westdach = lauf(westdachQuery);
const westfassade = lauf(westdachQuery + '&westfassade=1');
const milbingerQuery = westdachQuery + '&westfassade=1&westanschluss=1&wohnwegquerschnitt=1&milbingerbelag=1&milbingeroben=1';
const milbingerVorher = lauf(milbingerQuery), milbingerMasse = lauf(milbingerQuery + '&milbingermasse=1');
const milbingerDetailQuery = milbingerQuery + '&milbingermasse=1&milbingerdetail=1';
const milbingerDetail = lauf(milbingerDetailQuery);
const milbingerBoden = lauf(milbingerDetailQuery + '&milbingerboden=1');
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
const kurve = ranke.haeuser[308], verstreut = verfall.haeuser[308];
pruefe('D313: Kurve verändert ausschließlich das Referenzhaus', kurve.hash !== verstreut.hash
  && Object.entries(verfall.haeuser).every(([i, b]) => i === '308' || b.hash === ranke.haeuser[Number(i)].hash));
pruefe('D313: Eingangsöffnung und Trittplatten bleiben frei', kurve.tritte.length === 2 && kurve.tritte.every(Boolean)
  && kurve.tuerTiefen.length === 4 && kurve.tuerTiefen.every((tiefe, i) => tiefe !== null && tiefe === verstreut.tuerTiefen[i]));
pruefe('D313: Die Kurve passt in den bestehenden Puffer und das Dreieckbudget der beiden Wände',
  kurve.endlich && kurve.indexGleich && kurve.ecken <= verstreut.ecken, `${kurve.ecken / 3} / ${verstreut.ecken / 3} Dreiecke`);
const einsturz = ruine.haeuser[308];
pruefe('D314: Einsturz entfernt die vordere Wandfläche wirklich', kurve.wandTiefen.every(t => t !== null && t < 1.5)
  && einsturz.wandTiefen.every(t => t === null || t > 2), `${kurve.wandTiefen} → ${einsturz.wandTiefen}`);
pruefe('D314: Schutt liegt seitlich der Tür, Trittplatten und Öffnung bleiben frei', einsturz.schuttEcken > kurve.schuttEcken
  && einsturz.tritte.every(Boolean) && einsturz.tuerTiefen.every((tiefe, i) => tiefe === kurve.tuerTiefen[i]));
pruefe('D314: endlicher, kompaktierbarer Hauspuffer und gleiche Nachbarbauten', einsturz.endlich && einsturz.indexGleich
  && Object.entries(ranke.haeuser).every(([i, b]) => i === '308' || b.hash === ruine.haeuser[Number(i)].hash));
const abgesackt = spur.haeuser[308];
const absenkung = Object.entries(einsturz.dachHoehen).flatMap(([ort, y]) =>
  ort in abgesackt.dachHoehen ? [y - abgesackt.dachHoehen[ort]] : []);
pruefe('D316: Dachhaut ist am ursprünglichen Grundriss nach unten verformt',
  absenkung.filter(d => d > .4).length >= 3 && Math.max(...absenkung) >= .75 && absenkung.every(d => d >= -.001),
  `max. ${Math.max(...absenkung).toFixed(2)} m`);
pruefe('D316: geneigtes Bruchholz am Schutt und freie Tür mit beiden Trittsteinen',
  abgesackt.balkenEcken > einsturz.balkenEcken && abgesackt.tritte.length === 2 && abgesackt.tritte.every(Boolean)
  && abgesackt.tuerTiefen.every((tiefe, i) => tiefe === einsturz.tuerTiefen[i]));
pruefe('D316: dieselbe Kompaktierung und unveränderte Nachbarbauten', abgesackt.endlich && abgesackt.indexGleich
  && Object.entries(ruine.haeuser).every(([i, b]) => i === '308' || b.hash === spur.haeuser[Number(i)].hash));
const zielhaus = ziel.haeuser[308];
pruefe('D317: Zielmaterial markiert nur Haus 308, der Hauspuffer bleibt kompaktierbar',
  zielhaus.stufe === 6 && zielhaus.endlich && zielhaus.indexGleich && zielhaus.hash !== abgesackt.hash
  && Object.entries(spur.haeuser).every(([i, b]) => i === '308' || b.hash === ziel.haeuser[Number(i)].hash));
pruefe('D317: Schindeln liegen im Schuttfeld und Eingang mit beiden Trittplatten bleibt frei',
  zielhaus.schuttEcken >= abgesackt.schuttEcken && zielhaus.tritte.length === 2 && zielhaus.tritte.every(Boolean)
  && zielhaus.tuerTiefen.every((tiefe, i) => tiefe === abgesackt.tuerTiefen[i]),
  `Schuttecken ${abgesackt.schuttEcken} → ${zielhaus.schuttEcken}, Tritte ${zielhaus.tritte}, Tür ${zielhaus.tuerTiefen}`);
const bruchhaus = dachbruch.haeuser[308];
pruefe('D318: Der neue Dachbruch liegt ausschließlich an Haus 308',
  bruchhaus.hash !== zielhaus.hash && bruchhaus.endlich && bruchhaus.indexGleich && bruchhaus.raumFalsch === 0
  && Object.entries(ziel.haeuser).every(([i,b]) => i === '308' || b.hash === dachbruch.haeuser[Number(i)].hash));
pruefe('D318: Beide Platten und derselbe Türquerschnitt bleiben frei',
  bruchhaus.tritte.length === 2 && bruchhaus.tritte.every(Boolean)
  && bruchhaus.tuerTiefen.every((tiefe,i) => tiefe === zielhaus.tuerTiefen[i]));
pruefe('D318: Geometrischer Dachbruch und sichtbare Tiefe ändern sich im bestehenden Hauspuffer',
  bruchhaus.ecken > zielhaus.ecken && bruchhaus.ecken - zielhaus.ecken < 18000 * 3
  && bruchhaus.wandTiefen.some((tiefe,i) => tiefe !== zielhaus.wandTiefen[i]),
  `Dreiecke ${zielhaus.ecken / 3} → ${bruchhaus.ecken / 3}, Tiefe ${zielhaus.wandTiefen} → ${bruchhaus.wandTiefen}`);
const zielbildhaus = zieltreue.haeuser[308];
pruefe('D320: Der überarbeitete Hauspuffer betrifft nur Haus 308 und bleibt verlustfrei kompaktierbar',
  zielbildhaus.hash !== bruchhaus.hash && zielbildhaus.endlich && zielbildhaus.indexGleich && zielbildhaus.raumFalsch === 0
  && Object.entries(dachbruch.haeuser).every(([i, b]) => i === '308' || b.hash === zieltreue.haeuser[Number(i)].hash));
pruefe('D320: Die Ruine lässt die beiden Trittplatten und den Türquerschnitt frei',
  zielbildhaus.tritte.length === 2 && zielbildhaus.tritte.every(Boolean)
  && zielbildhaus.tuerTiefen.every((tiefe, i) => tiefe === bruchhaus.tuerTiefen[i]));
const gealtert = verlauf.haeuser[308];
pruefe('D321: Die gestaffelte Bruchkante liegt nur an Haus 308',
  gealtert.hash !== zielbildhaus.hash && gealtert.endlich && gealtert.indexGleich && gealtert.raumFalsch === 0
  && gealtert.wandTiefen.some((tiefe, i) => tiefe !== zielbildhaus.wandTiefen[i])
  && Object.entries(zieltreue.haeuser).every(([i, b]) => i === '308' || b.hash === verlauf.haeuser[Number(i)].hash));
pruefe('D321: Auslaufende Bruchstellen verändern weder Trittplatten noch den Türquerschnitt',
  gealtert.tritte.length === 2 && gealtert.tritte.every(Boolean)
  && gealtert.tuerTiefen.every((tiefe, i) => tiefe === zielbildhaus.tuerTiefen[i]));
const strassenHaeuser = [316, 343, 355];
pruefe('D322: Eigenständige Alterungswerte außerhalb des Hofverbunds, Fernhaus bleibt bytegleich',
  strassenHaeuser.every(i => ortsprobe.haeuser[i].stufe >= 8 && ortsprobe.haeuser[i].hash !== verlauf.haeuser[i].hash)
  && new Set(strassenHaeuser.map(i => ortsprobe.haeuser[i].stufe)).size === strassenHaeuser.length
  && ortsprobe.haeuser[693].hash === verlauf.haeuser[693].hash,
  strassenHaeuser.map(i => `${i}=${ortsprobe.haeuser[i].stufe}`).join(', '));
pruefe('D322: Neben der Materialalterung variiert die Dachgeometrie weiterer Häuser',
  strassenHaeuser.some(i => ortsprobe.haeuser[i].positionHash !== verlauf.haeuser[i].positionHash));
pruefe('D322: Grundrisse, Fensterglut der bewohnten Probe, Tritte und Türquerschnitt bleiben gültig',
  ortsprobe.eingabeErhalten && ortsprobe.bewohntHash.length > 0
  && Object.values(ortsprobe.haeuser).every(h => h.endlich && h.indexGleich && h.raumFalsch === 0 && h.glutFalsch === 0 && h.tritte.every(Boolean))
  && ortsprobe.haeuser[308].tuerTiefen.every((tiefe, i) => tiefe === gealtert.tuerTiefen[i]));
const westhaeuser = [508, 510, 512];
pruefe('D323: Die Weststraße erhält individuelle Alterung außerhalb der Hofauswahl',
  westhaeuser.every(i => ortsprobe.haeuser[i].stufe >= 8 && ortsprobe.haeuser[i].hash !== verlauf.haeuser[i].hash)
  && new Set(westhaeuser.map(i => ortsprobe.haeuser[i].stufe)).size === westhaeuser.length
  && westhaeuser.some(i => ortsprobe.haeuser[i].positionHash !== verlauf.haeuser[i].positionHash)
  && ortsprobe.haeuser[506].hash === verlauf.haeuser[506].hash);
pruefe('D323: Die Dachkorrektur betrifft nur die beiden Häuser an der Giebelfuge',
  silhouette.haeuser[308].positionHash !== ortsprobe.haeuser[308].positionHash
  && Object.entries(silhouette.haeuser).every(([i, h]) => h.endlich && h.indexGleich
    && (i === '308' || i === '346' || h.hash === ortsprobe.haeuser[Number(i)].hash)));
pruefe('D323: Beide Hofplatten und derselbe Türquerschnitt bleiben frei',
  silhouette.haeuser[308].tritte.length === 2 && silhouette.haeuser[308].tritte.every(Boolean)
  && silhouette.haeuser[308].tuerTiefen.every((tiefe, i) => tiefe === ortsprobe.haeuser[308].tuerTiefen[i]));
pruefe('D329: Drei Nutzungspunkte treffen jeweils genau einen realen Grundriss',
  westprobe.zuordnung.every((treffer, i) => treffer.length === 1 && treffer[0] === westhaeuser[i]));
pruefe('D329: Die Hausnutzungen ändern nur 508, 510, 512',
  westprobe.eingabeErhalten && Object.entries(silhouette.haeuser).every(([i, haus]) =>
    westhaeuser.includes(Number(i)) === (haus.hash !== westprobe.haeuser[Number(i)].hash)));
pruefe('D329: Drei unterscheidbare und verlustfrei indexierte Zustände',
  westhaeuser.every((i, k) => {
    const haus = westprobe.haeuser[i];
    return Math.floor(haus.stufe) % 32 === 26-k && haus.endlich && haus.indexGleich && !haus.raumFalsch
      && !haus.glutFalsch && haus.positionHash !== silhouette.haeuser[i].positionHash;
  }),
  westhaeuser.map(i => `${i}: ${silhouette.haeuser[i].ecken/3} → ${westprobe.haeuser[i].ecken/3}`).join(', '));
pruefe('D329: Fensterglut nur im instandgesetzten Haus',
  !westprobe.haeuser[508].licht && !westprobe.haeuser[510].licht && westprobe.haeuser[512].licht > 0);
pruefe('D330: Detailgeometrie nur an den drei Häusern und verlustfrei indexierbar',
  Object.entries(westprobe.haeuser).every(([i,h]) => {
    const detail = westdetail.haeuser[Number(i)];
    return (westhaeuser.includes(Number(i)) === (h.hash !== detail.hash))
      && detail.endlich && detail.indexGleich && !detail.raumFalsch && !detail.glutFalsch;
  }));
pruefe('D330: Sichtstrahlen treffen den mehr als einen Meter tiefen Innenraum bei 508',
  westdetail.haeuser[508].tiefeOeffnung > westprobe.haeuser[508].tiefeOeffnung + 3,
  `${westprobe.haeuser[508].tiefeOeffnung} → ${westdetail.haeuser[508].tiefeOeffnung}`);
pruefe('D330: Texturierte Efeublätter bei 510 und 3D-Rahmenrollen an allen drei Fassaden',
  westdetail.haeuser[510].blattecken > westprobe.haeuser[510].blattecken
    && westhaeuser.every(i => westdetail.haeuser[i].holzrahmen > 0));
pruefe('D331: Die Dachmaße ändern nur die drei Weststraßenhäuser',
  Object.entries(westdetail.haeuser).every(([i,h]) => {
    const dach = westdach.haeuser[Number(i)];
    return westhaeuser.includes(Number(i)) === (h.hash !== dach.hash) && dach.endlich && dach.indexGleich;
  }));
const vorDach = westdetail.haeuser[510], nachDach = westdach.haeuser[510];
pruefe('D331: Der First von 510 ist kürzer und folgt der projizierten Messkante',
  nachDach.firstLaenge > 22 && nachDach.firstLaenge < vorDach.firstLaenge - 3.6
  && Math.abs(nachDach.firstWinkel-150.69) < .05,
  `${vorDach.firstLaenge.toFixed(3)} → ${nachDach.firstLaenge.toFixed(3)} m · ${nachDach.firstWinkel.toFixed(3)}°`);
pruefe('D331: Zwischen den beiden Dachkörpern von 512 bleibt eine gemessene Höhenstufe',
  westdetail.haeuser[512].dachstufe < .085 && westdach.haeuser[512].dachstufe > .12
  && westdach.haeuser[512].dachstufe < .26,
  `${westdetail.haeuser[512].dachstufe.toFixed(3)} → ${westdach.haeuser[512].dachstufe.toFixed(3)} m`);
pruefe('D331: Bei 508 bleibt der tiefe Innenraum durch den Dachbruch sichtbar',
  westdach.haeuser[508].tiefeOeffnung >= 3,
  `${westdetail.haeuser[508].tiefeOeffnung} → ${westdach.haeuser[508].tiefeOeffnung}`);
pruefe('D335: Fassadenbaukasten verändert ausschließlich die gewählten Häuser',
  westfassade.eingabeErhalten && Object.entries(westdach.haeuser).every(([i, vorher]) => {
    const nachher = westfassade.haeuser[Number(i)];
    return westhaeuser.includes(Number(i)) === (vorher.hash !== nachher.hash)
      && nachher.endlich && nachher.indexGleich && !nachher.raumFalsch && !nachher.glutFalsch;
  }));
pruefe('D335: In allen drei Gebäuden sitzt Glas 23 cm hinter der Fassadenkante',
  westhaeuser.every(i => westdach.haeuser[i].vertieftesGlas === 0 && westfassade.haeuser[i].vertieftesGlas >= 12),
  westhaeuser.map(i => `${i}: ${westfassade.haeuser[i].vertieftesGlas} Ecken`).join(', '));
pruefe('D335: Firstlage, Dachstufe und Sicht in den Einsturz bleiben erhalten',
  Math.abs(westfassade.haeuser[510].firstLaenge - nachDach.firstLaenge) < .001
  && Math.abs(westfassade.haeuser[510].firstWinkel - nachDach.firstWinkel) < .001
  && Math.abs(westfassade.haeuser[512].dachstufe - westdach.haeuser[512].dachstufe) < .001
  && westfassade.haeuser[508].tiefeOeffnung >= 3);
pruefe('D335: Regenlauf liegt ausschließlich am offenen Bruch',
  westfassade.haeuser[508].regenEcken > 0 && westfassade.haeuser[510].regenEcken === 0
  && westfassade.haeuser[512].regenEcken === 0 && westdach.haeuser[508].regenEcken === 0);
const first509Vorher = milbingerVorher.haeuser[509].firstLaenge, first509Masse = milbingerMasse.haeuser[509].firstLaenge;
pruefe('D340: First von Haus 509 folgt der amtlichen Kante im gebauten Netz',
  Math.abs(first509Vorher - 23.21) < .03 && Math.abs(first509Masse - 8.72) < .03,
  `${first509Vorher.toFixed(3)} → ${first509Masse.toFixed(3)} m`);
pruefe('D340: Neue Dachkörper bleiben kompaktierbar und lassen den Weststraßenverfall stehen',
  milbingerMasse.eingabeErhalten && Object.entries(milbingerMasse.haeuser).every(([i, dach]) =>
    dach.endlich && dach.indexGleich && (dach.hash !== milbingerVorher.haeuser[Number(i)].hash) === (i === '506' || i === '509')));
const dachdetails = milbingerDetail.dachdetails;
pruefe('D341: Überstände und Rinnen erhalten Dachkern und Wandabschlüsse mit richtiger Sichtseite',
  !!dachdetails?.dachkern && dachdetails.richtung && dachdetails.neueDeckung > 0 && dachdetails.rinnen > 0
  && dachdetails.ueberschneidungen === 0);
pruefe('D341: Nur die vermessenen Hauspuffer erhalten Dachdetails und bleiben exakt indexierbar',
  Object.entries(milbingerDetail.haeuser).every(([i, dach]) =>
    dach.endlich && dach.indexGleich && (dach.hash !== milbingerMasse.haeuser[Number(i)].hash) === (i === '506' || i === '509')));
pruefe('D341: Die Milbinger Scheiben liegen in räumlichen Laibungen',
  [506,509].every(i => milbingerMasse.haeuser[i].vertieftesGlas === 0 && milbingerDetail.haeuser[i].vertieftesGlas >= 12),
  [506,509].map(i => `${i}: ${milbingerDetail.haeuser[i].vertieftesGlas} Ecken bei 18 cm`).join(', '));
pruefe('D342: Die LoD2-Sockel folgen dem örtlichen Hang und behalten denselben First',
  [506,509].every(i => {
    const boden = milbingerBoden.haeuser[i], vorher = milbingerDetail.haeuser[i];
    return boden.endlich && boden.indexGleich && boden.ecken > vorher.ecken
      && !boden.kontaktFehler && boden.firstLaenge === vorher.firstLaenge;
  }));
pruefe('D342: Hof und drei Westfassaden bleiben geometrisch unverändert',
  [308,508,510,512].every(i => milbingerBoden.haeuser[i].hash === milbingerDetail.haeuser[i].hash));
console.log(`\nHofbodenintegration: ${ok} bestanden, ${fehler} Fehler.`);
if (fehler) process.exitCode = 1;
