/** D305: Indexierung darf kein Dreieck und kein Float32-Wort verändern. */
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { indexiereHausGeometrie } from '../src/world/hausindex.js';
import { bestimmeHofhaeuser } from '../src/world/hofhaeuser.js';
import { entpackeWelt, type Weltdaten } from '../src/world/osm.js';
import type { Aufsatzboden } from '../src/world/terrain.js';

Object.defineProperty(globalThis, 'location', { value: { search: '?hausfront=1&bau=1&lod2=1' }, configurable: true });
const { baueGebaeude } = await import('../src/world/terrain.js');
const { bestimmeHof } = await import('../src/world/hofplatz.js');
const { baueGartenKachel } = await import('../src/world/baender.js');
const { baueHoehenfeld } = await import('../src/world/lod.js');
let ok = 0, fehler = 0;
function pruefe(name: string, gut: boolean, info = '') { console.log(`  ${gut ? '✓' : '✗'} ${name} ${info}`); gut ? ok++ : fehler++; }
const worte = (a: THREE.BufferAttribute) => new Uint32Array(a.array.buffer, a.array.byteOffset, a.array.length);
function rueckgleich(alt: THREE.BufferGeometry, neu: THREE.BufferGeometry): boolean {
  if (!neu.index || neu.index.count !== alt.getAttribute('position').count) return false;
  const namen = Object.keys(alt.attributes).sort();
  if (namen.join() !== Object.keys(neu.attributes).sort().join()) return false;
  return namen.every(name => {
    const a = alt.getAttribute(name) as THREE.BufferAttribute, b = neu.getAttribute(name) as THREE.BufferAttribute;
    if (a.itemSize !== b.itemSize || a.normalized !== b.normalized) return false;
    const aw = worte(a), bw = worte(b);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) if (aw[i * a.itemSize + k] !== bw[neu.index!.getX(i) * b.itemSize + k]) return false;
    return true;
  });
}
function fixture(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 1,0,0, 1,1,0, 0,0,0, 1,1,0, 0,1,0], 3));
  for (const [name, werte] of Object.entries({ normal: [0,0,1], color: [.3,.4,.5], rolle: [5], raumUv: [.2,.7,.314159], glut: [1], zustand: [0,1.5] })) {
    g.setAttribute(name, new THREE.Float32BufferAttribute(Array.from({length:6}, () => werte).flat(), werte.length));
  }
  return g;
}
const basis = fixture();
basis.name = 'Prüfhaus'; basis.userData.herkunft = 'Fixture';
basis.addGroup(0,3,0); basis.addGroup(3,3,1); basis.setDrawRange(3,3); basis.computeBoundingBox(); basis.computeBoundingSphere();
const vorherWorte = Object.fromEntries(Object.entries(basis.attributes).map(([n,a]) => [n, Array.from(worte(a as THREE.BufferAttribute))]));
const kompakt = indexiereHausGeometrie(basis);
pruefe('Nicht indexierte Eingabe erzeugt neues Objekt', kompakt !== basis && basis.index === null);
pruefe('Zwei Dreiecke teilen vier wortgleiche Ecken', kompakt.getAttribute('position').count === 4 && kompakt.index?.count === 6);
pruefe('Triangweise Rückexpansion sämtlicher Attribute bitgleich', rueckgleich(basis, kompakt));
pruefe('Eingabeattribute vollständig unverändert', JSON.stringify(vorherWorte) === JSON.stringify(Object.fromEntries(Object.entries(basis.attributes).map(([n,a]) => [n, Array.from(worte(a as THREE.BufferAttribute))]))));
pruefe('Indexierte Eingabe ist idempotent dasselbe Objekt', indexiereHausGeometrie(kompakt) === kompakt);
pruefe('Kleine Geometrie verwendet Uint16', kompakt.index!.array instanceof Uint16Array);
pruefe('Materialgruppen und DrawRange unverändert', JSON.stringify(kompakt.groups) === JSON.stringify(basis.groups) && JSON.stringify(kompakt.drawRange) === JSON.stringify(basis.drawRange));
pruefe('Bounds unverändert und unabhängig kopiert', !!kompakt.boundingBox?.equals(basis.boundingBox!) && !!kompakt.boundingSphere?.equals(basis.boundingSphere!) && kompakt.boundingBox !== basis.boundingBox && kompakt.boundingSphere !== basis.boundingSphere);
pruefe('Name und Herkunft bleiben erhalten', kompakt.name === basis.name && kompakt.userData.herkunft === basis.userData.herkunft);
for (const name of ['normal', 'color', 'rolle', 'raumUv', 'glut', 'zustand']) {
  const g = fixture(), a = g.getAttribute(name) as THREE.BufferAttribute;
  // Ecke3 liegt geometrisch auf Ecke0; bereits ein unterschiedliches Zusatzwort verhindert das Verschweißen.
  a.setComponent(3, a.itemSize - 1, a.getComponent(3, a.itemSize - 1) + .125);
  const k = indexiereHausGeometrie(g);
  pruefe(`Unterschied in ${name} bleibt getrennt`, k.getAttribute('position').count === 5 && rueckgleich(g,k));
  g.dispose(); k.dispose();
}
const nullen = fixture(), normalNullen = nullen.getAttribute('normal') as THREE.BufferAttribute;
worte(normalNullen)[3 * normalNullen.itemSize] = 0x80000000;
const getrennt = indexiereHausGeometrie(nullen);
pruefe('Plusnull und Minusnull bleiben wortgetreu verschieden', getrennt.getAttribute('position').count === 5 && rueckgleich(nullen, getrennt));
const kollision = new THREE.BufferGeometry(), kollDaten = new Float32Array(9), kw = new Uint32Array(kollDaten.buffer);
kw[3] = 1;
kw[4] = (Math.imul(2166136261,16777619) ^ Math.imul(2166136261 ^ 1,16777619)) >>> 0;
kollision.setAttribute('position', new THREE.BufferAttribute(kollDaten,3));
const kollKompakt = indexiereHausGeometrie(kollision);
const hash = (index:number) => { let h=2166136261; for(let k=0;k<3;k++)h=Math.imul(h^kw[index*3+k],16777619);return h>>>0; };
pruefe('Kollisionsfixture besitzt tatsächlich denselben32bit-Hash',hash(0)===hash(1)&&kw[0]!==kw[3]);
pruefe('Echte FNV-Hashkollision prüft alle Float32-Worte nach', kollKompakt.getAttribute('position').count === 2 && rueckgleich(kollision,kollKompakt));
for (const eindeutig of [65536,65538]) {
  const g = new THREE.BufferGeometry(), daten = new Float32Array(65538 * 3);
  for (let i=0;i<65538;i++) daten[i*3] = i < eindeutig ? i : 0;
  g.setAttribute('position',new THREE.BufferAttribute(daten,3));
  const k = indexiereHausGeometrie(g);
  pruefe(`${eindeutig} eindeutige Ecken wählen richtigen Indextyp`, k.getAttribute('position').count === eindeutig && (eindeutig===65536 ? k.index!.array instanceof Uint16Array : k.index!.array instanceof Uint32Array) && rueckgleich(g,k));
  g.dispose(); k.dispose();
}
const welt = entpackeWelt(JSON.parse(readFileSync(new URL('../public/world/oental.json',import.meta.url),'utf8')).welt);
const lod2 = JSON.parse(readFileSync(new URL('../public/world/oental-lod2.json',import.meta.url),'utf8'));
const [s,we,n,o] = welt.bbox, mass = {breiteMeter:(o-we)*111320*Math.cos((s+n)/2*Math.PI/180),tiefeMeter:(n-s)*111320};
const boden: Aufsatzboden = {...mass,hoeheAn:()=>0,tiefsteFlaeche:()=>0};
const haeuser = bestimmeHofhaeuser(welt,mass,bestimmeHof(welt,mass));
const originale: THREE.BufferGeometry[] = [], indexiert: THREE.BufferGeometry[] = [];
let eckenVorher=0,eckenNachher=0,bytesVorher=0,bytesNachher=0;
const bytes = (g:THREE.BufferGeometry) => Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(g.index?.array.byteLength??0);
for(const h of haeuser) {
  const g=baueGebaeude(welt,boden,[{...welt.gebaeude[h.gebaeudeIndex],lod2:lod2[h.gebaeudeIndex]}],[[1432.666,433.662]],haeuser)!;
  const k=indexiereHausGeometrie(g);
  pruefe(`Haus${h.gebaeudeIndex}: sämtliche Dreiecke/Attribute exakt erhalten`,rueckgleich(g,k));
  pruefe(`Haus${h.gebaeudeIndex}: tatsächlich weniger Ecken`,k.getAttribute('position').count<g.getAttribute('position').count);
  eckenVorher+=g.getAttribute('position').count;eckenNachher+=k.getAttribute('position').count;bytesVorher+=bytes(g);bytesNachher+=bytes(k);
  originale.push(g);indexiert.push(k);
}
const klein:Weltdaten={bbox:[0,0,1,1],aufloesung:2,hoehen:[[0,0],[0,0]],hoeheMin:0,hoeheMax:0,biome:[['wiese','wiese'],['wiese','wiese']],flaechen:[],linien:[],gebaeude:[],wege:[],marker:[],attribution:'Fixture'};
const feld=baueHoehenfeld(klein), satz={wege:new Map(),baeche:new Map(),faelle:new Map(),teiche:new Map(),gebaeude:new Map(),gaerten:new Map([['0:0',[{ecken:[[180,180],[190,180],[190,188],[180,188]] as [number,number][],achse:0}]]])};
const garten=baueGartenKachel(feld,satz,{ix:0,iz:0,mitte:[185,184],radius:10},0)!;
const gartenIndex=indexiereHausGeometrie(garten);
pruefe('Garten dreieckweise und in allen Attributen unverändert',rueckgleich(garten,gartenIndex));
const gemeinsam=mergeGeometries([...indexiert,gartenIndex],false), vorherZusammen=mergeGeometries([...originale,garten],false)!;
pruefe('Alle acht indexierten Häuser und Garten gemeinsam mergebar',!!gemeinsam&&rueckgleich(vorherZusammen,gemeinsam));
console.log(JSON.stringify({haeuser:haeuser.length,eckenVorher,eckenNachher,eckenReduktionProzent:100*(1-eckenNachher/eckenVorher),bytesVorher,bytesNachher,byteReduktionProzent:100*(1-bytesNachher/bytesVorher),mergeBytesVorher:bytes(vorherZusammen),mergeBytesNachher:gemeinsam&&bytes(gemeinsam),mergeIndextyp:gemeinsam?.index?.array.constructor.name}));
[basis,kompakt,nullen,getrennt,kollision,kollKompakt,...originale,...indexiert,garten,gartenIndex,gemeinsam,vorherZusammen].forEach(g=>g?.dispose());
console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if(fehler)process.exitCode=1;
