/** D303: vollständige Hofszene, gleiche Kamerafahrt und Windphase bei normalem 60°-Blickfeld.
 * node tools/mess/hauslauf.mjs <neuer-name> <0|1> [stand|fahrt] [profil]
 * Einzelbilder sind Qualitätsbelege, keine FPS-Messung. */
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {playwright} from './pw.mjs';
const [name,probe,modus='fahrt',profil='referenz']=process.argv.slice(2);
const bildspitzen=profil==='bildspitzen';
const kachelnachlauf=profil==='kachelnachlauf'||bildspitzen;
const bildfluss=profil==='bildfluss'||kachelnachlauf;
const bildtakt=profil==='bildtakt'||bildfluss;
const hofsilhouette=profil==='hofsilhouette'||bildtakt;
const eckfahrt=hofsilhouette||['ranke','ruine','einsturz','hofziel','hofdachbruch','hoflicht','zieltreue','verfallverlauf','ortsalterung'].includes(profil);
const weststrasse=profil==='weststrasse';
const strassenfahrt=profil==='ortsstrasse'||weststrasse;
const ortsalterung=profil==='ortsalterung'||hofsilhouette||strassenfahrt;
const kurzeFahrt=eckfahrt||strassenfahrt;
if(!kurzeFahrt&&!['referenz','hof','kompakt','lauben','boden','gras','teppich','verfall'].includes(profil)) throw Error('Profil referenz|hof|kompakt|lauben|boden|gras|teppich|verfall|ranke|ruine|einsturz|hofziel|hofdachbruch|hoflicht|zieltreue|verfallverlauf|ortsalterung|ortsstrasse|weststrasse|hofsilhouette|bildtakt|bildfluss|kachelnachlauf|bildspitzen angeben.');
const bodennah=kurzeFahrt||['boden','gras','teppich','verfall'].includes(profil);
const anzahl=kurzeFahrt?192:bodennah?288:profil!=='referenz'?216:144;
if(!name || !/^[a-z0-9_-]+$/i.test(name) || !['0','1'].includes(probe) || !['stand','fahrt'].includes(modus)) throw Error('Name, 0|1, stand|fahrt angeben.');
const ziel=`.cache/mess/${name}`;
if(existsSync(ziel)) throw Error(`Ausgabe existiert: ${ziel}`);
mkdirSync(ziel,{recursive:true});
const {chromium}=await playwright();
const browser=await chromium.launch({args:['--use-angle=metal','--ignore-gpu-blocklist']});
const seite=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
await seite.addInitScript(()=>{
 const original=window.requestAnimationFrame.bind(window),abbruch=window.cancelAnimationFrame.bind(window);
 let pause=false,n=1000000;const wartend=new Map();
 window.requestAnimationFrame=cb=>{if(!pause)return original(cb);const id=n++;wartend.set(id,cb);return id;};
 window.cancelAnimationFrame=id=>{if(!wartend.delete(id))abbruch(id);};
 window.__hausPause=()=>{pause=true;};
 window.__hausSchritt=()=>{const c=[...wartend.values()];wartend.clear();for(const f of c)f(performance.now());};
});
const fehler=[];seite.on('pageerror',e=>fehler.push(String(e)));seite.on('console',m=>{if(m.type()==='error')fehler.push(m.text());});
const parameter=new URLSearchParams(`absetzen=1432,423,150&zeit=.26&kontur=0&stimmung=zielbild&hofgruen=1&referenzhaus=${probe}&kamera=1444,36.8,418,1431,37.5,432&fov=60&umgebung=6&sonne=.8&umlichtstaerke=1.2&schatten=.4`);
if(profil!=='referenz'){parameter.set('referenzhaus','1');parameter.set('hofhaeuser',profil==='hof'?probe:'1');}
parameter.set('hauskompakt',profil==='kompakt'?probe:profil==='lauben'||bodennah?'1':'0');
parameter.set('hoflauben',profil==='lauben'?probe:bodennah?'1':'0');
parameter.set('hofboden',profil==='boden'?probe:bodennah?'1':'0');
if(profil==='gras')parameter.set('hofgras',probe);
if(profil==='verfall'){parameter.set('hofgras','1');parameter.set('hofverfall',probe);}
if(kurzeFahrt){
 parameter.set('hofgras','1');parameter.set('hofverfall','1');parameter.set('hofranke',profil==='ranke'?probe:'1');
 if(profil==='ruine')parameter.set('hofruine',probe);
 if(profil==='einsturz'){parameter.set('hofruine','1');parameter.set('hofeinsturz',probe);}
 if(ortsalterung||['hofziel','hofdachbruch','hoflicht','zieltreue','verfallverlauf'].includes(profil)){
  parameter.set('hofruine','1');parameter.set('hofeinsturz','1');
  parameter.set('hofziel',profil==='hofziel'?probe:'1');
  if(probe==='1'||profil!=='hofziel'){
   parameter.set('stimmung','hofziel');parameter.set('umgebung','6.4');parameter.set('sonne','.73');
  }
  if(ortsalterung||['hoflicht','zieltreue','verfallverlauf'].includes(profil)){
   parameter.set('hofdachbruch','1');parameter.set('stimmung','hofdachbruch');
   parameter.set('hoflicht',profil==='hoflicht'?probe:'1');
   if(profil==='zieltreue')parameter.set('zieltreue',probe);
   if(profil==='verfallverlauf'||ortsalterung){
    parameter.set('zieltreue','1');parameter.set('verfallverlauf',ortsalterung?'1':probe);
    if(ortsalterung)parameter.set('ortsalterung',hofsilhouette?'1':probe);
    if(hofsilhouette)parameter.set('hofsilhouette',bildtakt?'1':probe);
    if(bildtakt){parameter.set('bildruhe','1');parameter.set('bildtakt',bildfluss?'1':probe);}
    if(bildfluss)parameter.set('bildfluss',kachelnachlauf?'1':probe);
    if(kachelnachlauf)parameter.set('kachelnachlauf',bildspitzen?'1':probe);
    if(bildspitzen)parameter.set('bildspitzen',probe);
   }
  }
  if(profil==='hofdachbruch'){
   parameter.set('hofdachbruch',probe);
   if(probe==='1')parameter.set('stimmung','hofdachbruch');
  }
 }
 if(weststrasse){
  parameter.set('absetzen','1358.45,413,245');
  parameter.set('kamera','1358.45,37.75,413,1380,39.8,423');
 } else {
  parameter.set('absetzen',strassenfahrt?'1461.65,457.25,103':'1425,403,175');
  parameter.set('kamera',strassenfahrt?'1461.65,36.05,457.25,1446.7,38.5,460.7':'1424,36.44,403,1426,37.8,409.3');
 }
}
if(profil==='teppich'){parameter.set('hofgras','1');parameter.set('teppichspar',probe);}
const spiel=new URLSearchParams(parameter);spiel.delete('kamera');spiel.delete('fov');
// Der Spiel-Link startet auf dem freien Weg, nicht am stationären Messanker in der Garage.
spiel.set('absetzen',kurzeFahrt?parameter.get('absetzen'):profil==='referenz'?'1444,419,150':'1447,430,200');
try {
 await seite.goto(`http://127.0.0.1:4173/?${parameter}`);
 await seite.waitForFunction(()=>document.body.textContent.includes('Ladezeit')&&window.__szene?.userData.ezKamera,null,{timeout:180000});
 await seite.waitForTimeout(15000);
 await seite.evaluate(({profil,eckfahrt,strassenfahrt,weststrasse})=>{
  const s=window.__szene,vorher=s.onBeforeRender;
  window.__haus={index:0,bilder:0,position:[]};
  s.onBeforeRender=function(gl,szene,kamera,ziel){
   vorher.call(this,gl,szene,kamera,ziel);
   const d=window.__haus;
   // Zwei normale Blicke: erst vollständiges Haus vom freien Weg, dann Eingang aus Augenhöhe.
   if(eckfahrt) {
    const t=d.index/191;
    kamera.position.set(1424+11*(1-(1-t)**1.3),36.44-.12*t,403+8*t*t);
    kamera.lookAt(1426+.25*t,37.8+.25*t,409.3);
   } else if(weststrasse) {
    // Westlicher Wohnweg 600 in den Œntal-Daten. Freistehende Satteldächer 508, 510 und 512.
    const t=d.index/191;
    kamera.position.set(1358.45+19.45*t,37.75+.30*t,413+43*t);
    kamera.lookAt(1380+21*t,39.8+.30*t,423+32*t);
   } else if(strassenfahrt) {
    // Südöstlicher Straßenzug am Hof. Blick auf Wohnhäuser und niedrigere Garagen.
    const t=d.index/191;
    kamera.position.set(1461.65+13.1*t,36.05+.12*t,457.25+24.42*t);
    kamera.lookAt(1446.7+15.3*t,38.5,460.7+22.1*t);
   } else if(profil!=='referenz') {
    const abschnitt=Math.floor(d.index/72),t=(d.index%72)/71;
    // Die Hofansichten werden vor dem Messlauf auf freie Kamerapositionen geprüft.
    if(abschnitt===0){kamera.position.set(1444-4*t,36.8,418+3*t);kamera.lookAt(1432,38.2,433);}
    else if(abschnitt===1){kamera.position.set(1447,36.4,430+6*t);kamera.lookAt(1457,38,432);}
    else if(abschnitt===2){kamera.position.set(1454+3*t,36.532+.225*t,447+6*t);kamera.lookAt(1445.5,38,454.5);}
    else{kamera.position.set(1442-2*t,36.4,427.9+1.4*t);kamera.lookAt(1437.578,34.8,431.053);}
   } else if(d.index<96) {
    const t=d.index/95;kamera.position.set(1444-4*t,36.8,418+3*t);
    kamera.lookAt(1432,38.2,433);
   } else {
    const t=(d.index-96)/47;kamera.position.set(1429.67+.9*t,36.20+.05*t,424.35+1.45*t);
    kamera.lookAt(1430.96,35.8,430.46);
   }
   kamera.updateMatrixWorld(true);d.position=kamera.position.toArray();
   szene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(!m)continue;const u=gl.properties.get(m).uniforms;
    for(const k of ['uEzZeit','uZeit','uTime'])if(u?.[k])u[k].value=1000+d.index/24;
   }});d.bilder++;
  };
  for(const e of document.querySelectorAll('body *'))if(e.tagName!=='CANVAS'&&!e.querySelector('canvas'))e.style.visibility='hidden';
 },{profil,eckfahrt,strassenfahrt,weststrasse});
 await seite.evaluate(async()=>{for(let i=0;i<8;i++)await new Promise(r=>requestAnimationFrame(r));window.__hausPause();});
 await seite.waitForTimeout(200);
 await seite.evaluate(()=>{for(let i=0;i<64;i++)window.__hausSchritt();});
 const indizes=modus==='fahrt'?Array.from({length:anzahl},(_,i)=>i):kurzeFahrt?[0,64,127,191]:bodennah?[0,71,143,215,287]:profil!=='referenz'?[0,71,143,215]:[0,47,95,143];
 for(const i of indizes){
  await seite.evaluate(({i,profil,modus})=>{window.__haus.index=i;for(let f=0;f<((modus==='stand'||(profil!=='referenz'?i%72===0:i===96))?32:1);f++)window.__hausSchritt();},{i,profil,modus});
  await seite.waitForTimeout(10);
  await seite.screenshot({path:`${ziel}/${String(i).padStart(3,'0')}.png`});
 }
 const hausPuffer=await seite.evaluate(()=>{
  const gesehen=new Set(),daten=[];
  window.__szene.traverse(o=>{
   const g=o.geometry;if(!g?.getAttribute('glut')||gesehen.has(g))return;gesehen.add(g);
   daten.push({ecken:g.getAttribute('position').count,dreiecke:(g.index?.count??g.getAttribute('position').count)/3,
    byte:Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(g.index?.array.byteLength??0),indiziert:!!g.index});
  });return daten;
 });
 const bericht={probe,modus,profil,hausPuffer,parameter:String(parameter),spielURL:`http://127.0.0.1:4173/?${spiel}`,bilder:indizes.length,fpsVideo:24,breite:1280,hoehe:720,fehler,letzte:await seite.evaluate(()=>window.__haus)};
 writeFileSync(`${ziel}/bericht.json`,JSON.stringify(bericht,null,2));console.log(JSON.stringify(bericht));
 if(fehler.length)process.exitCode=1;
}finally{await browser.close();}
