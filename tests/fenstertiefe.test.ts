/** D296: echte Fensteröffnungen, Scheibentiefe und Laibungsrichtung an erzeugter Hausgeometrie. */
import * as THREE from 'three';
import type { Weltdaten } from '../src/world/osm.js';
import type { Aufsatzboden } from '../src/world/terrain.js';

// Die Schalter werden beim Modulimport gelesen; kein DOM/keine Texturlader im Geometrietest.
Object.defineProperty(globalThis, 'location', { value: { search: '?fenstertiefe=1&bau=1' }, configurable: true });
const { baueGebaeude } = await import('../src/world/terrain.js');
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
for (const grad of [0, 37]) {
  const a = grad * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const ring: [number, number][] = [[-6, -4], [6, -4], [6, 4], [-6, 4], [-6, -4]];
  const weltEcken = ring.map(([u, v]) => new THREE.Vector3(200 + u * c - v * s, 0, 200 + u * s + v * c));
  const punkte: [number, number][] = ring.map(([u, v]) => {
    const x = 200 + u * c - v * s, z = 200 + u * s + v * c;
    return [0.5 - z / 1000, 0.5 + x / 1000];
  });
  const haus: Weltdaten['gebaeude'][number] = { punkte, ebenen: 2, art: 'house',
    fassade: { fensterachsen: { traufe: 3, giebel: 2 }, laube: 'keine', hochlaube: false,
      putz: '#ddddcc', holz: '#665544', laeden: '#335533', malerei: null, stufe: 0 } };
  const g = baueGebaeude(welt, boden, [haus], [[200, 200]])!;
  pruefe(`${grad}°: Haus erzeugt`, !!g);
  if (!g) continue;
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), r = g.getAttribute('rolle'), glut = g.getAttribute('glut');
  pruefe(`${grad}°: alle Eckattribute vollständig`, r.count === p.count && n.count === p.count && glut.count === p.count && g.getAttribute('zustand').count === p.count);
  let entartet = 0, ungueltig = 0;
  for (let i = 0; i < p.count; i += 3) {
    const A = new THREE.Vector3().fromBufferAttribute(p, i), B = new THREE.Vector3().fromBufferAttribute(p, i + 1), C = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    if (B.sub(A).cross(C.sub(A)).lengthSq() < 1e-14) entartet++;
    for (let j = i; j < i + 3; j++) if (![p.getX(j), p.getY(j), p.getZ(j), n.getX(j), n.getY(j), n.getZ(j)].every(Number.isFinite)) ungueltig++;
  }
  pruefe(`${grad}°: keine entarteten Dreiecke`, entartet === 0, String(entartet));
  pruefe(`${grad}°: Positionen und Normalen endlich`, ungueltig === 0);
  const mesh = new THREE.Mesh(g, material); mesh.updateMatrixWorld();
  let scheiben = 0, tiefen = 0, laibungen = 0, normalRichtig = 0, leuchtet = 0, glutFalsch = 0;
  for (let i = 0; i < p.count; i++) if (glut.getX(i) > 0 && r.getX(i) !== 5) glutFalsch++;
  for (let i = 0; i + 5 < p.count; i++) {
    if (r.getX(i) !== 5) continue;
    const mitte = new THREE.Vector3();
    for (let j = 0; j < 6; j++) mitte.add(new THREE.Vector3().fromBufferAttribute(p, i + j));
    mitte.multiplyScalar(1 / 6);
    const normal = new THREE.Vector3().fromBufferAttribute(n, i).normalize();
    if (glut.getX(i) > 0) leuchtet++;
    // EG-Türen und Vordächer können Fenster verdecken; OG prüft alle Fassadenrichtungen.
    if (mitte.y > 4) {
      scheiben++;
      const tangente = new THREE.Vector3(normal.z, 0, -normal.x);
      const ziel = mitte.clone().addScaledVector(tangente, 0.16).add(new THREE.Vector3(0, -0.15, 0));
      // Millimetertoleranz: Float32-Geometrie und Normalen bei gedrehten Fassaden.
      const fassadenEbene = Math.max(...weltEcken.map(v => v.dot(normal)));
      const scheibenTiefe = fassadenEbene - mitte.dot(normal);
      const startFrontal = ziel.clone().addScaledVector(normal, fassadenEbene - ziel.dot(normal) + 1);
      strahl.set(startFrontal, normal.clone().negate());
      const treffer = strahl.intersectObject(mesh, false)[0];
      if (treffer && Math.abs(scheibenTiefe - 0.18) < 1e-3 && Math.abs(treffer.distance - 1.18) < 1e-3 && r.getX(treffer.face!.a) === 5) tiefen++;
      const start = mitte.clone().addScaledVector(normal, 0.23).addScaledVector(tangente, -0.35);
      strahl.set(start, normal.clone().negate().addScaledVector(tangente, -0.8).normalize());
      const seitlich = strahl.intersectObject(mesh, false)[0];
      if (seitlich && r.getX(seitlich.face!.a) !== 5 && seitlich.distance < 0.29) {
        laibungen++;
        if (seitlich.face!.normal.dot(tangente) > 0.99) normalRichtig++;
      }
    }
    i += 5;
  }
  pruefe(`${grad}°: Scheiben an allen vier Fassaden`, scheiben === 10, String(scheiben));
  pruefe(`${grad}°: Frontstrahlen treffen erst die 18cm zurückgesetzte Scheibe`, tiefen === scheiben, `${tiefen}/${scheiben}`);
  pruefe(`${grad}°: schräge Strahlen treffen seitliche Laibung`, laibungen === scheiben, `${laibungen}/${scheiben}`);
  pruefe(`${grad}°: Laibungsnormalen zeigen in die Öffnung`, normalRichtig === scheiben, `${normalRichtig}/${scheiben}`);
  pruefe(`${grad}°: nächtliche Fensterglut erhalten`, leuchtet > 0, String(leuchtet));
  pruefe(`${grad}°: Laibung/Fasche und Wand tragen keine Glut`, glutFalsch === 0, String(glutFalsch));
  g.dispose();
}
material.dispose();
console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if (fehler) process.exitCode = 1;
