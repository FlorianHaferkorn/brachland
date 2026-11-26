/** D481: Aus dem vordersten komponierten Kamm einen bewaldeten Hang fürs Messbild bauen.
 * npx tsx tools/fernhang.ts [Luftbild.jpg] [Ausgabe.glb]
 * Der Kamm stammt aus bergrueckenexport.py. Darunter trägt das regionale Höhenraster
 * Wald und Lichtungen desselben Orts aus DOP20. Die künstlerische Erhöhung läuft am Fuß aus.
 */
import { readFile } from 'node:fs/promises';
import { NodeIO, type TypedArray } from '@gltf-transform/core';
import sharp from 'sharp';
import { entpackeWelt, type GepackteWelt } from '../src/world/osm.js';

const ordner = 'public/bauten-ziel';
const eingang = `${ordner}/felsmulde-bergruecken.glb`;
const ausgang = process.argv[3] ?? `${ordner}/felsmulde-fernhang.glb`;
const welt = entpackeWelt((JSON.parse(await readFile('public/world/oental.json', 'utf8')) as { welt: GepackteWelt }).welt);
const register = JSON.parse(await readFile(`${ordner}/register.json`, 'utf8'));
const ort = register.bauwerke.find((b: {name: string}) => b.name === 'felsmulde');
const [sued, west, nord, ost] = welt.bbox;
const meterLat = 111320, meterLon = meterLat * Math.cos((nord + sued) * Math.PI / 360);
const breite = (ost-west) * meterLon, tiefe = (nord-sued) * meterLat;
const minX = 80, maxX = 760, minZ = -1120, maxZ = 1120;
const breit = 768, hoch = 2496;
const bbox = [(nord+sued)/2-(ort.ursprung.z+maxZ)/meterLat, (ost+west)/2+(ort.ursprung.x+minX)/meterLon,
  (nord+sued)/2-(ort.ursprung.z+minZ)/meterLat, (ost+west)/2+(ort.ursprung.x+maxX)/meterLon].join(',');
const url = new URL('https://geoservices.bayern.de/od/wms/dop/v1/dop20');
url.search = new URLSearchParams({SERVICE:'WMS', VERSION:'1.3.0', REQUEST:'GetMap', LAYERS:'by_dop20c',
  STYLES:'', FORMAT:'image/jpeg', CRS:'EPSG:4326', BBOX:bbox, WIDTH:String(breit), HEIGHT:String(hoch)}).toString();
async function luftbild() {
  if (process.argv[2]) return readFile(process.argv[2]);
  const antwort = await fetch(url);
  if (!antwort.ok || !antwort.headers.get('content-type')?.includes('image/')) throw Error(`DOP20: ${antwort.status}`);
  return Buffer.from(await antwort.arrayBuffer());
}
const quelle = await sharp(await luftbild()).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
if (quelle.info.width !== breit || quelle.info.height !== hoch || quelle.info.channels !== 3) throw Error('Unerwartetes DOP-Raster');
// Abstand zwischen Foto und weißem Abtastfeld für die drei bereits vertexgefärbten Fernrücken.
const atlasBreite = breit + 32;
const atlas = Buffer.alloc(atlasBreite * hoch * 3, 255);
for (let y=0; y<hoch; y++) {
  for (let x=0; x<breit; x++) {
    const i = 3*(y*breit+x), j = 3*(y*atlasBreite+x);
    const r=quelle.data[i], g=quelle.data[i+1], b=quelle.data[i+2];
    const hell = (.24*r + .62*g + .14*b) / 255;
    // Früheres Grünland ist heller als die geschlossenen Baumgruppen. Ferndunst hebt
    // die tiefsten Kronenschatten. Die Luftbildstruktur bleibt über beide Biome durchgehend.
    atlas[j] = 51 + 94*hell;
    atlas[j+1] = 52 + 83*hell + (g-r)*.09;
    atlas[j+2] = 40 + 66*hell + (b-r)*.07;
  }
}
const io = new NodeIO();
const doc = await io.read(eingang);
const root = doc.getRoot(), p = root.listMeshes()[0].listPrimitives()[0], buffer = root.listBuffers()[0];
const position = p.getAttribute('POSITION')!, farbe = p.getAttribute('COLOR_0')!, index = p.getIndices()!;
const pos: number[] = [], rgb: number[] = [], uv: number[] = [], ind: number[] = [];
const rest = new Map<number,number>();
const kamm = new Map<number, number[]>();
for (let i=0; i<position.getCount(); i++) {
  const v = position.getElement(i, []);
  if (v[0] < 1000) {
    const vorher = kamm.get(v[2]);
    if (!vorher || vorher[1] < v[1]) kamm.set(v[2], v);
  } else {
    rest.set(i,pos.length/3); pos.push(...v);
    rgb.push(...farbe.getElement(i, []).slice(0,3)); uv.push((breit+16)/atlasBreite,.5);
  }
}
for (let i=0; i<index.getCount(); i++) {
  const j = rest.get(index.getScalar(i)); if (j !== undefined) ind.push(j);
}
const n = welt.aufloesung-1;
function boden(x: number,z: number) {
  const u = Math.min(n-1e-6,Math.max(0,((x+ort.ursprung.x)/breite+.5)*n));
  const v = Math.min(n-1e-6,Math.max(0,((z+ort.ursprung.z)/tiefe+.5)*n));
  const i = Math.floor(u), j = Math.floor(v), fx=u-i, fz=v-j;
  const h = (1-fz)*((1-fx)*welt.hoehen[j][i]+fx*welt.hoehen[j][i+1])
    + fz*((1-fx)*welt.hoehen[j+1][i]+fx*welt.hoehen[j+1][i+1]);
  return (h-welt.hoeheMin)*1.15-ort.h0;
}
const kammfolge = [...kamm.values()].sort((a,b)=>a[2]-b[2]);
const anfang = pos.length/3, reihen=28;
for (const [xKamm,yKamm,z] of kammfolge) {
  const hub = yKamm-boden(xKamm,z);
  for (let j=0; j<=reihen; j++) {
    const t = j/reihen, x = minX+(xKamm-minX)*t;
    const y = boden(x,z)+hub*t*t*(3-2*t);
    pos.push(x,y,z);
    // Tiefe Runsen aus der gemessenen Hangneigung. Der Gradient ist relativ zum
    // versetzten Kamm berechnet; der Zuwachs entlang X ist die Ableitung des Höhenübergangs.
    const dx=(boden(x+6,z)-boden(x-6,z))/12 + hub*6*t*(1-t)/(xKamm-minX);
    const dz=(boden(x,z+6)-boden(x,z-6))/12;
    const sonne=(-dx*-.22 + .415 - dz*.883)/Math.hypot(dx,1,dz);
    const licht=.80+.32*Math.max(0,sonne);
    rgb.push(licht, licht, licht);
    uv.push(Math.min(breit-.5,Math.max(.5,(x-minX)/(maxX-minX)*breit))/atlasBreite,
      Math.min(1-.5/hoch,Math.max(.5/hoch,(z-minZ)/(maxZ-minZ))));
  }
}
for (let i=0; i<kammfolge.length-1; i++) for (let j=0; j<reihen; j++) {
  const a = anfang+i*(reihen+1)+j, b=a+reihen+1;
  ind.push(a,b,a+1,a+1,b,b+1);
}
const attrib = (name: string,type:'SCALAR'|'VEC2'|'VEC3',array: TypedArray) =>
  doc.createAccessor(name,buffer).setType(type).setArray(array);
p.setAttribute('POSITION',attrib('Position','VEC3',new Float32Array(pos)));
p.setAttribute('COLOR_0',attrib('Hanglicht','VEC3',new Float32Array(rgb)));
p.setAttribute('TEXCOORD_0',attrib('Orthofoto','VEC2',new Float32Array(uv)));
if (pos.length/3 > 65535) throw Error('Indexbereich überschritten');
p.setIndices(attrib('Flächen','SCALAR',new Uint16Array(ind)));
position.dispose(); farbe.dispose(); index.dispose();
const bild = await sharp(atlas,{raw:{width:atlasBreite,height:hoch,channels:3}}).jpeg({quality:83}).toBuffer();
const tex = doc.createTexture('Bewaldete Flanke').setImage(bild).setMimeType('image/jpeg');
p.setMaterial(doc.createMaterial('Ferne').setBaseColorTexture(tex));
await io.write(ausgang,doc);
console.log(ausgang, pos.length/3,'Punkte',ind.length/3,'Dreiecke',bild.byteLength,'Bildbytes',url.href);
