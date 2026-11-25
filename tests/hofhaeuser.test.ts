/** D304: freie Eingänge trotz verbundener Wohnhäuser und Garagen. */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { bestimmeHofhaeuser, hofhausZugangFrei } from '../src/world/hofhaeuser.js';
import { vereinfacheHauswand } from '../src/world/hausbauteil.js';
import type { Hof } from '../src/world/hofplatz.js';
import type { Aufsatzboden } from '../src/world/terrain.js';
import { entpackeWelt, imPolygon, type Weltdaten } from '../src/world/osm.js';

Object.defineProperty(globalThis, 'location', { value: { search: '?hausfront=1&bau=1&lod2=1' }, configurable: true });
const { orientierteHuelle, baueGebaeude } = await import('../src/world/terrain.js');
const { bestimmeHof } = await import('../src/world/hofplatz.js');

let ok = 0, fehler = 0;
function pruefe(name: string, gut: boolean, info = '') { console.log(`  ${gut ? '✓' : '✗'} ${name} ${info}`); gut ? ok++ : fehler++; }
type Punkt = [number, number];
const mass = { breiteMeter: 1000, tiefeMeter: 1000 };
const leer: Weltdaten = { bbox: [0, 0, 1, 1], aufloesung: 2, hoehen: [[0, 0], [0, 0]], hoeheMin: 0, hoeheMax: 0,
  biome: [['wiese', 'wiese'], ['wiese', 'wiese']], flaechen: [], linien: [], gebaeude: [], wege: [], marker: [], attribution: 'Testfixture' };
const haus = (x0: number, z0: number, x1: number, z1: number, art = 'house'): Weltdaten['gebaeude'][number] => ({ art, ebenen: 2,
  punkte: [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]].map(([x, z]) => [.5 - z / 1000, .5 + x / 1000]) });
const hof: Hof = { mitte: [200, 200], achse: [-1, 0], halb: [6, 4], gebaeudeIndex: 0 };
const basis = haus(194, 196, 206, 204);
const teilweise: Weltdaten = { ...leer, gebaeude: [basis, haus(198, 190, 206, 196, 'garage'), haus(190, 196, 194, 204, 'garage'),
  haus(206, 196, 210, 204, 'garage'), haus(194, 204, 206, 210, 'garage')] };
const gespeichert = JSON.stringify(teilweise);
const auswahl = bestimmeHofhaeuser(teilweise, mass, hof);
pruefe('Nur Wohnhaus auswählen, Garagen bleiben Blocker', auswahl.length === 1 && auswahl[0].gebaeudeIndex === 0);
const eingang = auswahl[0]?.eingang;
pruefe('Teilüberdeckte Wand erhält Tür im freien Rest', !!eingang && eingang[0] > 194.725 && eingang[0] < 197.275 && Math.abs(eingang[1] - 196) < 1e-7, JSON.stringify(eingang));
pruefe('Türnormal weist aus dem freien Wandabschnitt', auswahl[0]?.vorne[1] < -.999);
pruefe('Auswahl verändert keine Eingangsdaten', JSON.stringify(teilweise) === gespeichert);
pruefe('Auswahl und Türlagen deterministisch', JSON.stringify(bestimmeHofhaeuser(teilweise, mass, hof)) === JSON.stringify(auswahl));
const eingeschlossen = { ...teilweise, gebaeude: [basis, ...teilweise.gebaeude.slice(1), haus(194, 190, 198, 196, 'garage')] };
pruefe('Vollständig umschlossenes Haus bekommt keine erfundene Tür', bestimmeHofhaeuser(eingeschlossen, mass, hof)[0]?.eingang === null);
const aussenBlocker = { ...leer, gebaeude: [basis, haus(194, 96, 206, 196, 'garage'), haus(194, 204, 206, 304, 'garage'),
  haus(94, 196, 194, 204, 'garage'), haus(206, 196, 306, 204, 'garage')] };
pruefe('Nachbarzentren außerhalb35m blockieren trotzdem alle Eingänge', bestimmeHofhaeuser(aussenBlocker, mass, hof)[0]?.eingang === null);
const grenzen = { ...leer, gebaeude: [basis, haus(232, 197, 238, 203), haus(233, 197, 239, 203), haus(197, 197, 203, 203, 'industrial')] };
const grenzwahl = bestimmeHofhaeuser(grenzen, mass, hof);
pruefe('35m-Grenze enthalten, außerhalb ausgeschlossen, Industrie ausgeschlossen', grenzwahl.map(h => h.gebaeudeIndex).join() === '0,1');
pruefe('Ohne Hof keine Auswahl', bestimmeHofhaeuser(teilweise, mass, null).length === 0);
pruefe('Ohne freie Tür keine Pflegezone', !hofhausZugangFrei(200, 195, bestimmeHofhaeuser(eingeschlossen, mass, hof)));
if (eingang) {
  pruefe('Tür und direkter Zugang ohne niedrigen Bewuchs', hofhausZugangFrei(eingang[0], eingang[1], auswahl) && hofhausZugangFrei(eingang[0], eingang[1] - 3, auswahl));
  pruefe('Pflegezone endet seitlich und vor dem Nachbargarten', !hofhausZugangFrei(eingang[0] + 1.3, eingang[1] - 1, auswahl) && !hofhausZugangFrei(eingang[0], eingang[1] - 3.3, auswahl));
}
const welt = entpackeWelt(JSON.parse(readFileSync(new URL('../public/world/oental.json', import.meta.url), 'utf8')).welt);
const [s, west, n, ost] = welt.bbox;
const realmass = { breiteMeter: (ost - west) * 111320 * Math.cos((s + n) / 2 * Math.PI / 180), tiefeMeter: (n - s) * 111320 };
const original = JSON.stringify(welt.gebaeude);
const real = bestimmeHofhaeuser(welt, realmass, bestimmeHof(welt, realmass));
pruefe('Reales Hofensemble: acht Wohnhäuser und keine Garagen', real.map(h => h.gebaeudeIndex).join() === '297,301,307,308,320,344,345,346');
const ringe: Punkt[][] = welt.gebaeude.map(g => g.punkte.map(([lat, lon]) => [((lon - west) / (ost - west) - .5) * realmass.breiteMeter, ((n - lat) / (n - s) - .5) * realmass.tiefeMeter]));
for (const h of real) {
  const huelle = orientierteHuelle(ringe[h.gebaeudeIndex]), mitte = huelle.welt((huelle.minU + huelle.maxU) / 2, (huelle.minV + huelle.maxV) / 2);
  pruefe(`Haus${h.gebaeudeIndex}: Mittelpunkt passt zur Renderer-Auswahl`, Math.hypot(h.mitte[0] - mitte[0], h.mitte[1] - mitte[1]) < 1e-8);
  pruefe(`Haus${h.gebaeudeIndex}: freier Eingang vorhanden`, !!h.eingang);
  let blockiert = false;
  if (h.eingang) for (const u of [-.7, -.35, 0, .35, .7]) for (const v of [.05, .25, .75, 1.5]) {
    const q: Punkt = [h.eingang[0] + h.vorne[1] * u + h.vorne[0] * v, h.eingang[1] - h.vorne[0] * u + h.vorne[1] * v];
    // Unabhängige Punktproben im tatsächlich begehbaren Vorfeld gegen alle
    // Weltgrundrisse, einschließlich352/353 und Nachbarn außerhalb35m.
    if (ringe.some((p, i) => i !== h.gebaeudeIndex && imPolygon(q, p))) blockiert = true;
  }
  pruefe(`Haus${h.gebaeudeIndex}: 1,5m Vorfeld über Türbreite frei von allen Nachbarn`, !blockiert);
  pruefe(`Haus${h.gebaeudeIndex}: Einheitsnormal`, Math.abs(Math.hypot(...h.vorne) - 1) < 1e-10);
}
const referenz = real.find(h => h.gebaeudeIndex === 297)!;
pruefe('D303-Tür lag im Grundriss352; neue297-Tür liegt an freier Straßenfassade', imPolygon([1430.9635-.4693*.35, 430.4577-.883*.35], ringe[352]) && !!referenz.eingang && referenz.vorne[0] > .88 && referenz.vorne[1] < -.46);
pruefe('Reale Grundrisse einschließlich Nachbarhäusern unverändert', JSON.stringify(welt.gebaeude) === original);

const lod2 = JSON.parse(readFileSync(new URL('../public/world/oental-lod2.json', import.meta.url), 'utf8'));
const rendererBoden: Aufsatzboden = { ...realmass, hoeheAn: () => 0, tiefsteFlaeche: () => 0 };
const einzel = { mitte: [1432.6660174198419, 433.6622065675122], vorne: [-0.4693169803236261, -0.8830297684562584] };
const bewohnt: [number, number][] = [[1432.666, 433.662]];
const material = new THREE.MeshBasicMaterial({ side: THREE.FrontSide }), strahl = new THREE.Raycaster();
const bitgleich = (a: THREE.BufferGeometry, b: THREE.BufferGeometry) => {
  const namen = Object.keys(a.attributes).sort();
  return namen.join() === Object.keys(b.attributes).sort().join() && namen.every(name => {
    const x = a.getAttribute(name), y = b.getAttribute(name);
    return x.itemSize === y.itemSize && x.array.length === y.array.length && x.array.every((v, i) => v === y.array[i]);
  });
};
for (const h of real) {
  const gebaeude = { ...welt.gebaeude[h.gebaeudeIndex], lod2: lod2[h.gebaeudeIndex] };
  const vorher = baueGebaeude(welt, rendererBoden, [gebaeude], bewohnt, einzel)!;
  const nachher = baueGebaeude(welt, rendererBoden, [gebaeude], bewohnt, real)!;
  const p = nachher.getAttribute('position'), n = nachher.getAttribute('normal'), r = nachher.getAttribute('rolle'), glut = nachher.getAttribute('glut');
  const wandRing = vereinfacheHauswand(ringe[h.gebaeudeIndex]);
  pruefe(`Renderer${h.gebaeudeIndex}: Ensemble wirklich übernommen`, !bitgleich(vorher, nachher));
  if (h.gebaeudeIndex !== 297) pruefe(`Renderer${h.gebaeudeIndex}: zusätzliche Bauteilgeometrie`, p.count > vorher.getAttribute('position').count);
  let endlich = true, entartet = 0, glutFalsch = 0, scheiben = 0, scheibenTief = 0;
  for (const a of Object.values(nachher.attributes)) {
    endlich &&= a.count === p.count;
    for (const wert of a.array) endlich &&= Number.isFinite(wert);
  }
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-14) entartet++;
  }
  for (let i = 0; i < p.count; i++) if (glut.getX(i) !== 0 && r.getX(i) !== 5) glutFalsch++;
  for (let i = 0; i + 5 < p.count; i++) {
    if (r.getX(i) !== 5) continue;
    scheiben++;
    const mitte = new THREE.Vector3();
    for (let j = 0; j < 6; j++) mitte.add(new THREE.Vector3().fromBufferAttribute(p, i + j));
    mitte.multiplyScalar(1 / 6);
    const normal = new THREE.Vector3().fromBufferAttribute(n, i).normalize();
    // Die vereinfachte lange Wand kann wenige Millimeter von einer redundanten
    // OSM-Zwischenecke abweichen. Lokale Projektion vermeidet zudem großen Weltursprung.
    const tiefe = Math.max(...wandRing.map(q => (q[0] - mitte.x) * normal.x + (q[1] - mitte.z) * normal.z));
    if (Math.abs(tiefe - .18) < .001) scheibenTief++;
    i += 5;
  }
  pruefe(`Renderer${h.gebaeudeIndex}: vollständige endliche Attribute`, endlich);
  pruefe(`Renderer${h.gebaeudeIndex}: keine entarteten Dreiecke`, entartet === 0, String(entartet));
  pruefe(`Renderer${h.gebaeudeIndex}: Glut nur auf Glas`, glutFalsch === 0);
  pruefe(`Renderer${h.gebaeudeIndex}: sämtliche Scheiben18cm zurückgesetzt`, scheiben > 0 && scheibenTief === scheiben, `${scheibenTief}/${scheiben}`);
  const mesh = new THREE.Mesh(nachher, material); mesh.updateMatrixWorld();
  if (h.eingang) {
    const normal = new THREE.Vector3(h.vorne[0], 0, h.vorne[1]);
    // 12cm seitlich der Brettfuge in der Türmitte, nicht genau auf einer Kante.
    const ziel = new THREE.Vector3(h.eingang[0] + h.vorne[1] * .12, .55, h.eingang[1] - h.vorne[0] * .12);
    strahl.set(ziel.clone().add(normal), normal.clone().negate());
    const treffer = strahl.intersectObject(mesh, false)[0];
    pruefe(`Renderer${h.gebaeudeIndex}: reale Eingangslage trifft zurückgesetzte Tür statt Wand`, !!treffer && treffer.distance > 1.06 && treffer.distance < 1.19 && r.getX(treffer.face!.a) !== 0 && treffer.face!.normal.dot(normal) > .999, treffer?.distance.toFixed(5));
  }
  vorher.dispose(); nachher.dispose();
}
for (const i of [352, 353, 354]) {
  const gebaeude = { ...welt.gebaeude[i], lod2: lod2[i] };
  const vorher = baueGebaeude(welt, rendererBoden, [gebaeude], bewohnt, einzel)!;
  const nachher = baueGebaeude(welt, rendererBoden, [gebaeude], bewohnt, real)!;
  pruefe(`Renderer${i}: Garage oder Nachbar außerhalb Auswahl bleibt bitgleich`, bitgleich(vorher, nachher));
  vorher.dispose(); nachher.dispose();
}
material.dispose();
console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if (fehler) process.exitCode = 1;
