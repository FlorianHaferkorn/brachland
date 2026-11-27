/** D363: Hof-Baukasten-Modell sitzt am Grundriss — Ursprung am Giebel minU, Drehung entlang der langen Seite. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { baueKollision, SPIELER_RADIUS } from '../src/spieler/kollision.js';
import * as THREE from 'three';
import { bereiteHofholzVor } from '../src/world/hausmaterial.js';
import { hofbauLagen, ersetzteGebaeude, mitHofterrassen, hofEfeukarten } from '../src/world/hofbau.js';
import daten from '../content/hofbauten.json';
import { entpackeWelt, type Weltdaten } from '../src/world/osm.js';
import { baueHoehenfeld, hoeheAufFlaeche, type HoehenFeld } from '../src/world/lod.js';

const h = daten.hofbauten[0];
// Region 1000 × 1000 m; Grundriss 36 × 14 m, um 30° gedreht, Mitte (100, -50).
const bbox: [number, number, number, number] = [47, 12, 47.009, 12.0132];
const breite = 1000, tiefe = 1000;
const a = Math.PI / 6, c = Math.cos(a), s = Math.sin(a);
const ecken = [[-18, -7], [18, -7], [18, 7], [-18, 7], [-18, -7]].map(([u, v]) => [100 + u * c - v * s, -50 + u * s + v * c]);
const zuLatLon = ([x, z]: number[]): [number, number] =>
  [bbox[2] - (z / tiefe + 0.5) * (bbox[2] - bbox[0]), bbox[1] + (x / breite + 0.5) * (bbox[3] - bbox[1])];
const gebaeude = Array.from({ length: h.gebaeude + 1 }, () => ({ punkte: [] as [number, number][], ebenen: 2, art: 'house' }));
gebaeude[h.gebaeude] = { punkte: ecken.map(zuLatLon), ebenen: 2, art: 'farm' };
const welt = { bbox, gebaeude } as unknown as Weltdaten;
const boden = { breiteMeter: breite, tiefeMeter: tiefe, hoeheAn: (x: number, z: number) => 0.01 * x + 0.02 * z } as never;

const [l] = hofbauLagen(h.region, welt, boden);
assert.ok(l, 'keine Lage');
assert.ok(Math.abs(l.laenge - 36) < 0.05 && Math.abs(l.breite - 14) < 0.05, `Masse ${l.laenge}/${l.breite}`);
// Modellachse +x zeigt nach Drehung entlang der langen Seite, vom Ursprung zum anderen Giebel.
const ax = Math.cos(l.drehung), az = -Math.sin(l.drehung);
const ende = [l.ort[0] + ax * 36, l.ort[2] + az * 36];
const mitte: [number, number] = [(l.ort[0] + ende[0]) / 2, (l.ort[2] + ende[1]) / 2];
assert.ok(Math.hypot(mitte[0] - 100, mitte[1] + 50) < 0.1, `Mitte daneben: ${mitte}`);
const rohhoehe = (x: number, z: number) => .01 * x + .02 * z;
const rohfeld = { hoehe: rohhoehe, breiteMeter: breite, tiefeMeter: tiefe } as HoehenFeld;
assert.equal(mitHofterrassen(rohfeld, []), rohfeld);
const feld = mitHofterrassen(rohfeld, [l]);
const pad = .65 * rohhoehe(...mitte) + .35 * rohhoehe(l.ort[0], l.ort[2]);
assert.ok(Math.abs(l.ort[1] - pad) < 1e-6);
assert.ok(Math.abs(hoeheAufFlaeche(feld, ...mitte) - (pad - .04)) < 1e-6);
// Traufkante, weicher Saum und äußerer Anschluss im gedrehten Hauskoordinatensystem.
for (const abstand of [0, .5, 4.9, 9, 20]) {
  const x = mitte[0] - az * (7 + abstand), z = mitte[1] + ax * (7 + abstand);
  const t = THREE.MathUtils.smoothstep(abstand, .8, 9);
  assert.ok(Math.abs(feld.hoehe(x, z) - THREE.MathUtils.lerp(pad - .04, rohhoehe(x, z), t)) < 1e-6);
}
assert.ok(ersetzteGebaeude(h.region).has(h.gebaeude));
console.log(`hofbau: ${h.modell} mittig am Grundriss, Modell, Terrain und Bodenabfrage auf demselben Planum`);

// Ein umgekehrt erfasster Ring darf Wohn- und Wirtschaftsgiebel nicht vertauschen.
gebaeude[h.gebaeude].punkte.reverse();
const [rueckwaerts] = hofbauLagen(h.region, welt, boden);
assert.ok(Math.hypot(rueckwaerts.ort[0] - l.ort[0], rueckwaerts.ort[2] - l.ort[2]) < .05);
assert.ok(Math.cos(rueckwaerts.drehung - l.drehung) > .999);
assert.ok(l.querSpiegeln);

// Gleicher Holzton, unterschiedlicher Regenschutz: Zwei Hölzer unter demselben
// Dachrand. Die lokal quantisierten Eckkoordinaten müssen in Hausmetern ankommen.
const szene = new THREE.Group();
const dach = new THREE.Mesh(new THREE.BoxGeometry(20, 3, 10));
dach.name = 'ziegel';
dach.position.set(10, 6.5, 0); // Traufe y=5, First y=8
szene.add(dach);
const eckenHolz = new THREE.BufferGeometry();
eckenHolz.setAttribute('position', new THREE.Int16BufferAttribute([0, 32767, 0, 0, -32767, 0], 3, true));
const holz = new THREE.Mesh(eckenHolz);
holz.name = 'holz_block';
holz.position.set(10, 2.5, 4.9);
holz.scale.setScalar(2.5);
szene.add(holz);
bereiteHofholzVor(szene);
const regen = eckenHolz.getAttribute('hofRegen');
assert.deepEqual([regen.getX(0), regen.getX(1)], [0, 1]);

assert.ok(l.efeuecke);
const efeu = hofEfeukarten(l.efeuecke, l.saat);
assert.deepEqual(efeu, hofEfeukarten(l.efeuecke, l.saat));
for (const [nx, nz] of [[-1, 0], [0, 1]]) {
  const wand = efeu.filter(k => k.normal[0] === nx && k.normal[1] === nz);
  assert.ok(wand.some(k => k.ort[1] < .5), 'Wurzel an der Wandecke');
  assert.ok(wand.some(k => k.ort[1] > l.efeuecke!.traufe - .7), 'Ranke am Laubenpfosten');
}

// Beide Gänge liegen im gespiegelten und gedrehten Hofsystem. Mitte, Saum und
// freie Wiese sowie die sieben Zentimeter Trittiefe sind mit denselben Daten prüfbar.
const spur = feld.trittweg;
assert.ok(spur && l.trittwege);
const hauspunkt = (u: number, v: number): [number, number] =>
  [l.ort[0] + ax*u - az*v, l.ort[2] + az*u + ax*v];
for (const linie of l.trittwege) {
  for (const [u, v] of linie) assert.equal(spur.deckung(...hauspunkt(u, v)), 1);
}
const trittprobe = hauspunkt(-16.5, -18);
assert.ok(Math.abs(feld.hoehe(...trittprobe) - (rohhoehe(...trittprobe) - .07)) < 1e-6);
assert.equal(spur.deckung(...hauspunkt(-16.5, -12)), 0);

// Spieler und Sichtprobe nutzen dasselbe Raster, auch wenn neben der Wand kein einziger Baum steht.
const kollision = baueKollision([], welt, breite, tiefe, []);
const anAussenwand = hauspunkt(15, 7);
const abgerueckt = kollision.schiebeRaus(...anAussenwand);
assert.ok(Math.abs(Math.hypot(abgerueckt[0] - anAussenwand[0], abgerueckt[1] - anAussenwand[1]) - SPIELER_RADIUS) < 1e-6);
assert.deepEqual(kollision.schiebeRaus(...abgerueckt), abgerueckt, 'auf der Schultergrenze in Ruhe');
const gangAmHaus = hauspunkt(15, 7.6);
assert.deepEqual(kollision.schiebeRaus(...gangAmHaus), gangAmHaus, 'Weg entlang der gedrehten Fassade bleibt frei');
const innen = hauspunkt(.1, 0);
const stufe = kollision.schiebeRaus(...innen);
assert.ok(Math.hypot(stufe[0] - l.ort[0], stufe[1] - l.ort[2]) >= SPIELER_RADIUS - 1e-6);

// D489-Aufnahmeroute gegen die echten Weltmeter von Gebäude 708.
const oental = entpackeWelt(JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt);
const grund = baueHoehenfeld(oental);
const wirklich = baueKollision([], oental, grund.breiteMeter, grund.tiefeMeter, []);
const [hof] = hofbauLagen('oental', oental, { ...grund, hoeheAn: grund.hoehe, tiefsteFlaeche: grund.hoehe });
let ort: [number, number] = [189, 231], kontakte = 0;
const gier = -94 * Math.PI / 180;
for (let i = 0; i < 675; i++) {
  const x = ort[0] - .1 * Math.sin(gier), z = ort[1] - .1 * Math.cos(gier);
  ort = wirklich.schiebeRaus(x, z);
  if (x !== ort[0] || z !== ort[1]) kontakte++;
  const dx = ort[0] - hof.ort[0], dz = ort[1] - hof.ort[2];
  const u = dx * Math.cos(hof.drehung) - dz * Math.sin(hof.drehung);
  const v = dx * Math.sin(hof.drehung) + dz * Math.cos(hof.drehung);
  assert.ok(u < 0 || u > hof.laenge || Math.abs(v) > hof.breite / 2, 'Figur dringt in Modellhof 708 ein');
}
assert.ok(kontakte > 0, 'Prüflauf muss die Eckfassade tatsächlich treffen');
console.log('Hofkollision: echte Aufnahmelinie über 67,5 m Eingabe, Wandabstand, freie Wege und rasterunabhängige Sicht geprüft.');
