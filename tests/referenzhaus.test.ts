/** D303: nur das gewählte Hofhaus ändern; echte Öffnungen auch an gedrehten Fassaden. */
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import type { Weltdaten } from '../src/world/osm.js';
import { entpackeWelt } from '../src/world/osm.js';
import type { Aufsatzboden } from '../src/world/terrain.js';
import { vereinfacheHauswand } from '../src/world/hausbauteil.js';

Object.defineProperty(globalThis, 'location', { value: { search: '?hausfront=1&bau=1' }, configurable: true });
const { baueGebaeude } = await import('../src/world/terrain.js');
const { bestimmeHof, hofEingangFrei } = await import('../src/world/hofplatz.js');
let ok = 0, fehler = 0;
function pruefe(name: string, gut: boolean, info = '') {
  console.log(`  ${gut ? '✓' : '✗'} ${name} ${info}`);
  gut ? ok++ : fehler++;
}
const boden: Aufsatzboden = { breiteMeter: 1000, tiefeMeter: 1000, hoeheAn: () => 0, tiefsteFlaeche: () => 0 };
const welt: Weltdaten = { bbox: [0, 0, 1, 1], aufloesung: 2, hoehen: [[0, 0], [0, 0]], hoeheMin: 0, hoeheMax: 0,
  biome: [['wiese', 'wiese'], ['wiese', 'wiese']], flaechen: [], linien: [], gebaeude: [], wege: [], marker: [], attribution: 'Testfixture' };
const material = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
const strahl = new THREE.Raycaster();
const flaeche = (p: readonly [number, number][]) => p.slice(0, -1).reduce((summe, a, i) => summe + a[0] * p[i + 1][1] - a[1] * p[i + 1][0], 0) / 2;
const gleich = (a: THREE.BufferGeometry, b: THREE.BufferGeometry) => {
  const namen = Object.keys(a.attributes).sort();
  return namen.join() === Object.keys(b.attributes).sort().join() && namen.every(name => {
    const x = a.getAttribute(name), y = b.getAttribute(name);
    return x.itemSize === y.itemSize && x.array.length === y.array.length && x.array.every((v, i) => v === y.array[i]);
  });
};

for (const grad of [0, 37]) {
  const winkel = grad * Math.PI / 180, c = Math.cos(winkel), s = Math.sin(winkel), prefix = `${grad}°: `;
  const ring: [number, number][] = [[-6, -4], [-2, -4], [6, -4], [6, 4], [-6, 4], [-6, -4]];
  const punkte = ring.map(([u, v]): [number, number] => [200 + u * c - v * s, 200 + u * s + v * c]);
  const ringVorher = JSON.stringify(punkte);
  const einfach = vereinfacheHauswand(punkte);
  pruefe(prefix + 'Vereinfachung verändert den Eingabering nicht', JSON.stringify(punkte) === ringVorher);
  pruefe(prefix + 'redundante Frontkante vereinfacht, Ring geschlossen', einfach.length === 5 && einfach[0][0] === einfach.at(-1)![0] && einfach[0][1] === einfach.at(-1)![1]);
  pruefe(prefix + 'Vereinfachung erhält Fläche und Umlaufsinn', Math.abs(flaeche(einfach) - flaeche(punkte)) < 1e-8);
  const umgekehrt = vereinfacheHauswand([...punkte].reverse());
  pruefe(prefix + 'Vereinfachung erhält auch umgekehrten Umlaufsinn', Math.abs(flaeche(umgekehrt) + flaeche(punkte)) < 1e-8);
  const haus: Weltdaten['gebaeude'][number] = { punkte: punkte.map(([x, z]) => [0.5 - z / 1000, 0.5 + x / 1000]), ebenen: 2, art: 'house',
    fassade: { fensterachsen: { traufe: 3, giebel: 2 }, laube: 'keine', hochlaube: false,
      putz: '#ddddcc', holz: '#665544', laeden: '#335533', malerei: null, stufe: 0 } };
  const vorne: [number, number] = [s, -c];
  const alt = baueGebaeude(welt, boden, [haus], [[200, 200]])!;
  const fremd = baueGebaeude(welt, boden, [haus], [[200, 200]], { mitte: [220, 200], vorne })!;
  pruefe(prefix + 'nicht gewähltes Haus in allen Attributen bitgleich', gleich(alt, fremd));
  const g = baueGebaeude(welt, boden, [haus], [[200, 200]], { mitte: [200, 200], vorne })!;
  pruefe(prefix + 'Referenzhaus tatsächlich geändert', !gleich(alt, g));
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), rollen = g.getAttribute('rolle'), glut = g.getAttribute('glut'), uv = g.getAttribute('raumUv');
  pruefe(prefix + 'alle Attribute vollständig', Object.values(g.attributes).every(a => a.count === p.count));
  let entartet = 0, ungueltig = 0, normaleFalsch = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), d = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    const kreuz = b.sub(a).cross(d.sub(a));
    if (kreuz.lengthSq() < 1e-14) entartet++;
    else if (kreuz.normalize().dot(new THREE.Vector3().fromBufferAttribute(n, i)) < 0.999) normaleFalsch++;
  }
  for (const a of Object.values(g.attributes)) for (const wert of a.array) if (!Number.isFinite(wert)) ungueltig++;
  pruefe(prefix + 'keine entarteten Dreiecke', entartet === 0, String(entartet));
  pruefe(prefix + 'alle Geometrieattribute endlich', ungueltig === 0);
  pruefe(prefix + 'Normalen stimmen mit Dreiecksumlauf überein', normaleFalsch === 0, String(normaleFalsch));
  const mesh = new THREE.Mesh(g, material); mesh.updateMatrixWorld();
  const normal = new THREE.Vector3(vorne[0], 0, vorne[1]);
  const front = new THREE.Vector3(200 + 4 * vorne[0], 0.55, 200 + 4 * vorne[1]).add(new THREE.Vector3(c * 0.12, 0, s * 0.12));
  strahl.set(front.clone().add(normal), normal.clone().negate());
  const tuer = strahl.intersectObject(mesh, false)[0];
  pruefe(prefix + 'Hof-Eingang hat echte zurückgesetzte Tür ohne Wand davor', !!tuer && tuer.distance > 1.06 && tuer.distance < 1.19 && rollen.getX(tuer.face!.a) !== 0, tuer?.distance.toFixed(5));
  pruefe(prefix + 'Türnormal zeigt nach außen', !!tuer && tuer.face!.normal.dot(normal) > 0.999);

  let scheiben = 0, tiefeRichtig = 0, richtungRichtig = 0, glutFalsch = 0, leuchtet = 0, fremdeUv = 0;
  const seeds = new Set<number>();
  for (let i = 0; i < p.count; i++) {
    if (glut.getX(i) !== 0 && rollen.getX(i) !== 5) glutFalsch++;
    if (rollen.getX(i) !== 5 && (uv.getX(i) !== 0 || uv.getY(i) !== 0 || uv.getZ(i) !== 0)) fremdeUv++;
  }
  for (let i = 0; i + 5 < p.count; i++) {
    if (rollen.getX(i) !== 5) continue;
    const mitte = new THREE.Vector3();
    for (let j = 0; j < 6; j++) mitte.add(new THREE.Vector3().fromBufferAttribute(p, i + j));
    mitte.multiplyScalar(1 / 6);
    seeds.add(uv.getZ(i));
    if (glut.getX(i) > 0) leuchtet++;
    // OG bleibt frei von Eingang/Vordach; derselbe Strahl prüft die vier Hausseiten.
    if (mitte.y > 4) {
      scheiben++;
      const aussen = new THREE.Vector3().fromBufferAttribute(n, i).normalize();
      const tangente = new THREE.Vector3(aussen.z, 0, -aussen.x);
      const ebene = Math.max(...punkte.map(q => q[0] * aussen.x + q[1] * aussen.z));
      const ziel = mitte.clone().addScaledVector(tangente, 0.16).add(new THREE.Vector3(0, -0.15, 0));
      strahl.set(ziel.clone().addScaledVector(aussen, ebene - ziel.dot(aussen) + 1), aussen.clone().negate());
      const treffer = strahl.intersectObject(mesh, false)[0];
      if (treffer && rollen.getX(treffer.face!.a) === 5 && Math.abs(treffer.distance - 1.18) < 0.001 && Math.abs(ebene - mitte.dot(aussen) - 0.18) < 0.001) tiefeRichtig++;
      else console.log('    Scheibenstrahl', JSON.stringify({ mitte: mitte.toArray(), normal: aussen.toArray(), tiefe: ebene-mitte.dot(aussen), treffer: treffer && { distanz: treffer.distance, rolle: rollen.getX(treffer.face!.a), punkt: treffer.point.toArray() } }));
      if (aussen.dot(mitte.clone().sub(new THREE.Vector3(200, mitte.y, 200))) > 0) richtungRichtig++;
    }
    i += 5;
  }
  pruefe(prefix + 'OG-Scheiben auf allen vier Fassaden vorhanden', scheiben === 10, String(scheiben));
  pruefe(prefix + 'Scheiben liegen frei hinter 18cm Laibung', tiefeRichtig === scheiben, `${tiefeRichtig}/${scheiben}`);
  pruefe(prefix + 'Glasnormalen zeigen aus dem Haus', richtungRichtig === scheiben);
  pruefe(prefix + 'Fenster behalten verschiedene Raumseeds', seeds.size > 10, String(seeds.size));
  pruefe(prefix + 'Raum-UV ausschließlich auf Glas', fremdeUv === 0);
  pruefe(prefix + 'Nachtglut ausschließlich auf Glas, weiterhin vorhanden', glutFalsch === 0 && leuchtet > 0, `${glutFalsch} falsch / ${leuchtet} leuchtend`);
  const wieder = baueGebaeude(welt, boden, [haus], [[200, 200]], { mitte: [200, 200], vorne })!;
  pruefe(prefix + 'Referenzgeometrie und Fensterseeds deterministisch', gleich(g, wieder));
  [alt, fremd, g, wieder].forEach(a => a.dispose());
}
const winkelhaus: [number, number][] = [[0, 0], [8, 0], [8, 3], [3, 3], [3, 8], [0, 8], [0, 0]];
const erhalten = vereinfacheHauswand(winkelhaus);
pruefe('Echte konkave Hausecke bleibt unverändert', JSON.stringify(erhalten) === JSON.stringify(winkelhaus));

// Tatsächlicher Hofgrundriss mit gemeinsamem Nachbargebäude: die ursprüngliche
// Längstwandregel wählte die Innenwand zu345. Die Referenz muss an die freie Hofseite.
const hofWelt = entpackeWelt(JSON.parse(readFileSync(new URL('../public/world/oental.json', import.meta.url), 'utf8')).welt);
const [sued, west, nord, ost] = hofWelt.bbox;
const hofBoden: Aufsatzboden = { ...boden, breiteMeter: (ost-west)*111320*Math.cos((sued+nord)/2*Math.PI/180), tiefeMeter: (nord-sued)*111320 };
const hof = { mitte: [1432.6660174198419, 433.6622065675122], vorne: [-0.4693169803236261, -0.8830297684562584] };
const grundrisseVorher = JSON.stringify(hofWelt.gebaeude);
const ziel = baueGebaeude(hofWelt, hofBoden, [hofWelt.gebaeude[297]], [], hof)!;
const nachbarAlt = baueGebaeude(hofWelt, hofBoden, [hofWelt.gebaeude[345]])!;
const nachbarNeu = baueGebaeude(hofWelt, hofBoden, [hofWelt.gebaeude[345]], [], hof)!;
pruefe('Realer Nachbar345 bleibt trotz gemeinsamer Kante in allen Attributen bitgleich', gleich(nachbarAlt, nachbarNeu));
const aussen = new THREE.Vector3(hof.vorne[0], 0, hof.vorne[1]);
const tuerMitte = new THREE.Vector3((1426.0481290184516+1435.878864450846)/2, 0.55, (433.068195999816+427.84728799970924)/2);
strahl.set(tuerMitte.clone().addScaledVector(aussen, 1), aussen.clone().negate());
const hofMesh = new THREE.Mesh(ziel, material); hofMesh.updateMatrixWorld();
const eingang = strahl.intersectObject(hofMesh, false)[0];
pruefe('Realer Hof297: zurückgesetzte Tür auf freier Hofseite statt Nachbarwand', !!eingang && eingang.distance > 1.06 && eingang.distance < 1.19 && ziel.getAttribute('rolle').getX(eingang.face!.a) !== 0, eingang?.distance.toFixed(5));
pruefe('Hausbau verändert keine Weltgrundrisse für Spielkollision oder Nachbarn', JSON.stringify(hofWelt.gebaeude) === grundrisseVorher);
const hofAuswahl = bestimmeHof(hofWelt, hofBoden);
pruefe('Eingangsmaske wird am tatsächlichen Hof297 geprüft', hofAuswahl?.gebaeudeIndex === 297);
pruefe('Realer Türeingang bleibt frei von niedrigem Bewuchs', hofEingangFrei(tuerMitte.x, tuerMitte.z, hofAuswahl));
for (const abstand of [0.4, 1.5, 3.0]) pruefe(`Direkter Hofzugang ${abstand}m vor der Tür bleibt frei`, hofEingangFrei(tuerMitte.x+aussen.x*abstand, tuerMitte.z+aussen.z*abstand, hofAuswahl));
pruefe('Hofzugang endet nach3,2m und räumt nicht die ganze Wiese', !hofEingangFrei(tuerMitte.x+aussen.x*3.4, tuerMitte.z+aussen.z*3.4, hofAuswahl));
pruefe('Seitlicher vorderer Hofstrauch bleibt erhalten', !hofEingangFrei(1437.6501, 424.8656, hofAuswahl));
pruefe('Seitlicher hinterer Hofstrauch bleibt erhalten', !hofEingangFrei(1431.459, 446.844, hofAuswahl));
pruefe('Nachbargarten wird nicht als Eingang freigeräumt', !hofEingangFrei(1441, 439, hofAuswahl));
pruefe('Ohne ausgewählten Hof kein Eingriff', !hofEingangFrei(tuerMitte.x, tuerMitte.z, null));
[ziel, nachbarAlt, nachbarNeu].forEach(g => g.dispose());
material.dispose();
console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if (fehler) process.exitCode = 1;
