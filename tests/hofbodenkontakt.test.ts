/** D307: örtliches Kontaktband hält Nachbarhäuser und Grundrisse frei. */
import assert from 'node:assert/strict';
import { baueHofbodenkontakt } from '../src/world/hofbodenkontakt.js';
import type { Weltdaten } from '../src/world/osm.js';
import type { Hofbodenkontakt } from '../src/world/hofbodenkontakt.js';

let ok = 0;
function pruefe(name: string, gut: boolean): void { assert.ok(gut, name); console.log(`  ✓ ${name}`); ok++; }
const mass = { breiteMeter: 1000, tiefeMeter: 1000 };
const haus = (p: number[][]): Weltdaten['gebaeude'][number] => ({ art: 'house', ebenen: 2,
  punkte: p.map(([x, z]) => [.5 - z / 1000, .5 + x / 1000]) });
const welt: Weltdaten = { bbox: [0, 0, 1, 1], aufloesung: 2, hoehen: [[0, 0], [0, 0]], hoeheMin: 0, hoeheMax: 0,
  biome: [['wiese', 'wiese'], ['wiese', 'wiese']], flaechen: [], linien: [], gebaeude: [], wege: [], marker: [], attribution: 'Testfixture' };
const rechteck = haus([[-4, -3], [4, -3], [4, 3], [-4, 3], [-4, -3]]);
const fixture: Weltdaten = { ...welt, gebaeude: [rechteck] };
const vorher = JSON.stringify(fixture);
const g = baueHofbodenkontakt(fixture, mass, [{ gebaeudeIndex: 0 }], [0, 0]);
function lies(g: Hofbodenkontakt, x: number, z: number): number {
  const j = Math.floor((x - g.rahmen[0]) * g.rahmen[2] * g.breite);
  const i = Math.floor((z - g.rahmen[1]) * g.rahmen[3] * g.breite);
  return g.daten[i * g.breite + j];
}
pruefe('Genau ein 512²-Bytekanal ohne Zusatzdaten', g.breite === 512 && g.daten.byteLength === 262144);
pruefe('86m-Rahmen bildet Pixelzentren in positiver z-Reihenfolge ab', g.rahmen.join() === [-43, -43, 1 / 86, 1 / 86].join());
pruefe('Direkt außen an Hauskante voller Kontakt', lies(g, 4.05, 0) === 255);
pruefe('Kontakt läuft über 1,15m weich bis null aus', lies(g, 4.5, 0) > lies(g, 4.9, 0) && lies(g, 4.9, 0) > 0 && lies(g, 5.3, 0) === 0);
pruefe('Hausinneres wird nicht als Bodenband gefärbt', lies(g, 3.95, 0) === 0 && lies(g, 0, 0) === 0);
pruefe('Außerhalb der Probe kein Kontakt', lies(g, 22, 22) === 0 && lies(g, -22, -22) === 0);
pruefe('Ohne gewählte Häuser bleibt der ganze Kanal leer', baueHofbodenkontakt(fixture, mass, [], [0, 0]).daten.every(w => w === 0));
const nachbar = haus([[4.1, -.5], [5, -.5], [5, .5], [4.1, .5], [4.1, -.5]]);
const mitNachbar = baueHofbodenkontakt({ ...fixture, gebaeude: [rechteck, nachbar] }, mass, [{ gebaeudeIndex: 0 }], [0, 0]);
pruefe('Nicht gewählter Nachbar sperrt sein Inneres aus', lies(g, 4.5, 0) > 0 && lies(mitNachbar, 4.5, 0) === 0);
pruefe('Nicht gewählter Nachbar erhält kein eigenes Bodenband', lies(mitNachbar, 5.6, 0) === 0);
const umgedreht = { ...rechteck, punkte: [...rechteck.punkte].reverse() };
const rueckwaerts = baueHofbodenkontakt({ ...fixture, gebaeude: [umgedreht] }, mass, [{ gebaeudeIndex: 0 }], [0, 0]);
pruefe('Umgekehrter Grundrissumlauf erhält den Kanal bytegleich', g.daten.every((w, i) => w === rueckwaerts.daten[i]));
const wieder = baueHofbodenkontakt(fixture, mass, [{ gebaeudeIndex: 0 }], [0, 0]);
pruefe('Auswahl und Eingangswelt bleiben unverändert und Ausgabe deterministisch', JSON.stringify(fixture) === vorher && g.daten.every((w, i) => w === wieder.daten[i]));
const versatz = [180, -210];
const verschoben = haus([[-4, -3], [4, -3], [4, 3], [-4, 3], [-4, -3]].map(([x, z]) => [x + versatz[0], z + versatz[1]]));
const v = baueHofbodenkontakt({ ...fixture, gebaeude: [verschoben] }, mass, [{ gebaeudeIndex: 0 }], versatz);
pruefe('Weltversatz erhält den örtlichen Kanal bytegleich', g.daten.every((w, i) => w === v.daten[i]));
assert.throws(() => baueHofbodenkontakt(fixture, mass, [], [NaN, 0])); ok++;
console.log(`\nHofbodenkontakt: ${ok} bestanden.`);
