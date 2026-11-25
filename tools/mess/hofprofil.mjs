/** D310: GPU-Sonde und wiederholte Gegenproben am stehenden Hofblick.
 * node tools/mess/hofprofil.mjs <neuer-name> */
import { playwright } from './pw.mjs';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const [name] = process.argv.slice(2);
if (!name || !/^[a-z0-9_-]+$/i.test(name)) throw Error('Neuen einfachen Namen angeben.');
const ziel = `.cache/mess/${name}`;
if (existsSync(ziel)) throw Error(`Ausgabe existiert: ${ziel}`);
mkdirSync(ziel, { recursive: true });
const {chromium}=await playwright();
const b=await chromium.launch({args:['--use-angle=metal','--enable-gpu-rasterization','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:960,height:540}});
const fehler=[];p.on('pageerror',e=>fehler.push(String(e)));
p.on('console',m=>{if(m.type()==='error')fehler.push(m.text());});
try {
 await p.goto('http://127.0.0.1:4173/?absetzen=1447,430,200&zeit=.26&kontur=0&hofgruen=1&referenzhaus=1&hofhaeuser=1&hauskompakt=1&hoflauben=1&hofboden=1&hofgras=1&teppichspar=0&stimmung=zielbild&umgebung=6&sonne=.8&umlichtstaerke=1.2&schatten=.4');
 await p.waitForFunction(()=>document.body.textContent.includes('Ladezeit')&&window.__szene,{},{timeout:180000});
 await p.evaluate(()=>{ const s=window.__szene, davor=s.onBeforeRender;s.onBeforeRender=function(gl,...args){window.__renderer=gl;return davor.call(this,gl,...args);}; });
 await p.waitForFunction(()=>window.__renderer);
 const r=await p.evaluate(async()=>{
 const s=window.__szene,gl=window.__renderer,g=gl.getContext(),ext=g.getExtension('EXT_disjoint_timer_query_webgl2');
 const original=gl.render,shadow=gl.shadowMap.render;
 const werte={},offen=[]; let aufnahme=false,aktiv=null;
 function an(name){if(!aufnahme||!ext)return;const q=g.createQuery();g.beginQuery(ext.TIME_ELAPSED_EXT,q);aktiv={name,q};}
 function aus(){if(!aktiv)return;g.endQuery(ext.TIME_ELAPSED_EXT);offen.push(aktiv);aktiv=null;}
 function ernte(){while(offen.length&&g.getQueryParameter(offen[0].q,g.QUERY_RESULT_AVAILABLE)){const {name,q}=offen.shift();if(!g.getParameter(ext.GPU_DISJOINT_EXT)) (werte[name]??=[]).push(g.getQueryParameter(q,g.QUERY_RESULT)/1e6);g.deleteQuery(q);}}
 gl.render=function(szene,...rest){ernte();const name=szene===s?'Welt':'Bildpass';an(name);try{return original.call(this,szene,...rest);}finally{aus();}};
 gl.shadowMap.render=function(...args){if(!aktiv)return shadow.apply(this,args);const name=aktiv.name;aus();an('Schatten');try{return shadow.apply(this,args);}finally{aus();an(name);}};
 const gras=[];s.traverse(o=>{if(o.name.startsWith('Grasteppich'))gras.push(o);});
 const frame=()=>new Promise(r=>requestAnimationFrame(r));
 const warten=async ms=>{const start=performance.now();while(performance.now()-start<ms)await frame();};
 // GPU-Abfragen werden nur im gesonderten Profil eingeschaltet.
 await warten(3000);
 if (ext) { aufnahme=true; await warten(2500); aufnahme=false; await warten(1000); ernte(); }
 const ergebnisse=[];
 for(const name of ['voll','schattenfix','ohneteppich','beides','ohneteppich','schattenfix','voll']){
   gl.shadowMap.autoUpdate=!(name==='schattenfix'||name==='beides');
   for(const o of gras)o.visible=!(name==='ohneteppich'||name==='beides');
   await warten(1250);
   const start=performance.now();let jetzt=start,n=0;
   while(jetzt-start<5500){jetzt=await frame();n++;}
   ergebnisse.push({name,fps:n*1000/(jetzt-start),dreiecke:gl.info.render.triangles,aufrufe:gl.info.render.calls});
 }
 ernte();return {ergebnisse,gpu:Object.fromEntries(Object.entries(werte).map(([k,v])=>[k,{n:v.length,ms:v.reduce((a,b)=>a+b,0)/v.length}]))};
 });
 const befund={...r,fehler};
 writeFileSync(`${ziel}/bericht.json`,JSON.stringify(befund,null,2),{flag:'wx'});
 console.log(JSON.stringify(befund));
 if(fehler.length)process.exitCode=1;
}finally{await b.close();}
