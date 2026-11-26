/**
 * Verfahren „Ort für Ort“ (D459): die Rechnung hinter `tools/ortverfahren.ts`.
 * Festgehalten wird, was am M1 gemessen und im Ledger belegt ist — die Akte Felsmulde muss die Adresse aus D445
 * ergeben, und die Abnahme muss an den Messwerten aus D445–D448 so urteilen, wie A-46 es beschreibt
 * (Helligkeit und Sättigung treffen, die Schatten nicht).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  Akte, abnahme, abnahmeTabelle, adresse, bildratenUrteil, bildwinkel, budgetUrteil, kurz, leseBildrate, regelpruefung,
  schritte, sonnenstand, sonnenstandImQuelltext, stimmungsVorlage, weltpunkt, type Messwerte,
} from '../tools/ortlogik.js';

const fels = Akte.parse(JSON.parse(readFileSync('tools/ort/felsmulde.json', 'utf8')));
const nah = (a: number, b: number, eps: number, text: string) => assert.ok(Math.abs(a - b) <= eps, `${text}: ${a} statt ${b}`);

// Kamera: D445 `?kamera=-811,455.01,597.8,-795,455.56,601.0&fov=45.75`, Figur `?absetzen=-814,597.2,-101`
const adr = adresse(fels, fels.kameras[0]);
assert.equal(adr.kamera, '-811,455.01,597.8,-795,455.56,601');
assert.equal(adr.fov, '45.75');
const [ax, az, ag] = adr.absetzen.split(',').map(Number);
nah(ax, -814, 0.15, 'Absetzpunkt x'); nah(az, 597.2, 0.15, 'Absetzpunkt z'); nah(ag, -101, 0.5, 'Blick');
assert.equal(adr.zusatz(['echt=1', 'lookfels=1']), '&stimmung=zielbildfels&echt=1&lookfels=1&kamera=-811,455.01,597.8,-795,455.56,601&fov=45.75');
assert.deepEqual(weltpunkt(fels, [0, 0, 0]).map(n => Number(n.toFixed(2))), [-800, 453.11, 600]);
nah(bildwinkel(24), 45.75, 0.01, 'Bildwinkel 24 mm');
assert.equal(kurz(-0.001), '0'); assert.equal(kurz(601.0), '601'); assert.equal(kurz(455.0119), '455.01');
assert.throws(() => adresse(fels, { ...fels.kameras[0], blick: [-11.0, 2.2, 5] }), /übereinander/);

// Sonne: `STIMMUNG.zielbildfels.sonnenstand = [-22.0, 41.5, 88.3]` (Azimut 194°, Höhe 24,5°), `zielbild` = 42°/13°
const s = sonnenstand(194, 24.5);
nah(s[0], -22.0, 0.05, 'Sonne x'); nah(s[1], 41.5, 0.05, 'Sonne y'); nah(s[2], 88.3, 0.05, 'Sonne z');
const s2 = sonnenstand(42, 13);
nah(s2[0], 65.2, 0.05, 'zielbild x'); nah(s2[1], 22.5, 0.05, 'zielbild y'); nah(s2[2], -72.4, 0.05, 'zielbild z');
const quelltext = readFileSync('src/world/stimmung.ts', 'utf8');
const ist = sonnenstandImQuelltext(quelltext, fels.spiel.stimmung);
assert.ok(ist, 'Messstimmung der Felsmulde steht im Quelltext');
ist!.forEach((n, i) => nah(n, s[i], 0.5, 'Stimmung passt zur Akte'));
assert.equal(sonnenstandImQuelltext(quelltext, 'gibtesnicht'), null);
assert.match(stimmungsVorlage(fels), /STIMMUNG\.zielbildfels = \{\n {2}\.\.\.STIMMUNG\.zielbild,\n {2}sonnenstand: \[-22\.0, 41\.5, 88\.3\] as const,\n\};/);

// Abnahme an den Werten des Ledgers (Protokoll der Akte)
const voll = (w: Partial<Messwerte>): Messwerte => ({ mittel: 0, unter02: 0, ueber07: 0, rb_licht: 0, rb_schatten: 0, saett: 0, himmel: 0, ...w });
const ziel = voll(fels.protokoll[0].werte);
const tol = fels.abnahme.toleranz;
const selbst = abnahme(ziel, ziel, tol);
assert.ok(selbst.bestanden, 'das Zielbild besteht gegen sich selbst');
const vorher = abnahme(ziel, voll(fels.protokoll[1].werte), tol);            // D445: zu hell, zu wenig Farbe, zu viel Himmel
assert.ok(!vorher.bestanden);
assert.deepEqual(vorher.zeilen.filter(z => !z.bestanden).map(z => z.groesse), ['mittel', 'saett', 'himmel']);
const d448 = abnahme(ziel, voll({ ...fels.protokoll[3].werte, rb_licht: ziel.rb_licht, rb_schatten: ziel.rb_schatten }), tol);
assert.ok(!d448.bestanden, 'A-46: die übertragene Felsmulde besteht die Abnahme noch nicht');
assert.deepEqual(d448.zeilen.filter(z => !z.bestanden).map(z => z.groesse), ['mittel', 'unter02', 'ueber07']);
assert.match(d448.zeilen.find(z => z.groesse === 'unter02')!.hebel, /Fülllicht/);
assert.match(abnahmeTabelle(d448), /ABNAHME: NICHT BESTANDEN$/);
assert.match(abnahmeTabelle(selbst), /ABNAHME: BESTANDEN$/);
assert.ok(!abnahme(ziel, { ...ziel, magenta: 0.05 }, tol).bestanden, 'Magenta = fehlende Textur');
assert.ok(abnahme(ziel, { ...ziel, mittel: 0.01 }, tol).leer, 'schwarzes Bild wird erkannt');
// Grenze: genau auf der Toleranz besteht, knapp darüber nicht
assert.ok(abnahme(ziel, { ...ziel, mittel: ziel.mittel + tol.mittel }, tol).bestanden);
assert.ok(!abnahme(ziel, { ...ziel, mittel: ziel.mittel + tol.mittel + 0.001 }, tol).bestanden);
// Das freigegebene Zielbild liegt im Regelbereich (REFERENZ_SPIELE Regeln 1 und 3)
assert.ok(regelpruefung(ziel).every(r => r.drin), 'Zielbild Felsmulde im Regelbereich');
assert.ok(!regelpruefung({ ...ziel, mittel: 0.5 }).every(r => r.drin));

// Bildrate: Ausgabeformat von tools/mess/bildrate.mjs, Urteil und Engpass nach D450
const zeile = (n: string, b: number, d: number, a: number) => `${n.padEnd(24)} ${String(b).padStart(3)} B/s  ${d.toFixed(2).padStart(6)} Mio. Dreiecke  ${String(a).padStart(5)} Aufrufe`;
const gelesen = leseBildrate([zeile('voll', 13, 23, 10794), 'Rauschen', zeile('ohnebauwerke', 27, 2.1, 600), zeile('halb', 17, 23, 10794)].join('\n'));
assert.deepEqual(gelesen[0], { name: 'voll', bps: 13, dreieckeMio: 23, aufrufe: 10794 });
assert.equal(gelesen.length, 3);
const b = fels.abnahme.budget;
const d448rate = bildratenUrteil(gelesen, 30, b);                              // D448: Geometrie, zu viele Aufrufe, Welt allein auch unter 30
assert.ok(!d448rate.bestanden); assert.equal(d448rate.engpass, 'welt');
const geo = bildratenUrteil(leseBildrate([zeile('voll', 13, 23, 10794), zeile('ohnebauwerke', 40, 2.1, 600), zeile('halb', 17, 23, 10794)].join('\n')), 30, b);
assert.equal(geo.engpass, 'geometrie');
assert.ok(geo.meldungen.some(m => /Nachstellschritt A/.test(m)) && geo.meldungen.some(m => /Nachstellschritt B/.test(m)));
const pix = bildratenUrteil(leseBildrate([zeile('voll', 19, 3.2, 400), zeile('ohnebauwerke', 40, 2.1, 300), zeile('halb', 29, 3.2, 400)].join('\n')), 30, b);
assert.equal(pix.engpass, 'pixel');
assert.ok(bildratenUrteil(leseBildrate(zeile('voll', 31, 3.2, 400)), 30, b).bestanden);
assert.ok(!bildratenUrteil([], 30, b).bestanden);
assert.ok(budgetUrteil(55 * 1048576, 60).bestanden); assert.ok(!budgetUrteil(104 * 1048576, 60).bestanden);

// Schrittliste: zehn Schritte, genau der Look-Durchgang geht zurück, jeder Schritt hat höchstens zwei Nachstellschritte
const liste = schritte(fels, 'D999');
assert.deepEqual(liste.map(x => x.nr), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.deepEqual(liste.filter(x => x.wer === 'stark').map(x => x.nr), [5]);
assert.deepEqual(liste.filter(x => x.wo === 'm1').map(x => x.nr), [4, 5, 6, 7, 8]);
assert.ok(liste.every(x => x.beiVerfehlen.length <= 2 && x.befehle.length > 0 && x.abnahme.length > 0));
assert.ok(liste[3].befehle.some(x => x.includes('messbild.mjs .cache/bilder/D999/vorher "-813.9,597.2,-101" "&stimmung=zielbildfels&echt=1&kamera=')));
assert.ok(liste[5].befehle.some(x => x.startsWith('SZENE_ZIEL=1')) && liste[5].befehle.some(x => x.includes('pflanzenexport.py')) && liste[5].befehle.some(x => x.includes('--instanz')));
assert.ok(liste.every(x => x.befehle.every(c => !c.includes('/home/'))), 'Befehle nur mit relativen Pfaden');
// Akte: ohne Freigabe oder Kamera ungültig
assert.throws(() => Akte.parse({ ...fels, zielbild: { ...fels.zielbild, freigabe: 'offen' } }));
assert.throws(() => Akte.parse({ ...fels, kameras: [] }));

console.log('ortverfahren: Adresse D445, Sonnenstand, Abnahme D445–D448, Bildrate D450, zehn Schritte — in Ordnung');


// Ortskurzlinks lesen dieselbe Kamera wie die Backkette. Der normale Start bleibt frei beweglich.
const { waehleZielort } = await import('../src/spiel/zielort.js');
const fest = waehleZielort('?ziel=felsmulde&zielkamera=1');
assert.equal(fest.parameter.get('kamera'), adr.kamera);
assert.equal(fest.parameter.get('fov'), adr.fov);
assert.equal(fest.parameter.get('absetzen'), '-814,597.2,-101');
assert.equal(fest.ort?.laufzeit.modellgruppe, 'felsmulde');
const frei = waehleZielort('?ziel=milbinger');
assert.equal(frei.parameter.get('kamera'), null);
assert.equal(frei.parameter.get('milbingerfinale'), '1');
assert.equal(frei.parameter.get('hofzufahrt'), '1');
const kies = waehleZielort('?ziel=milbinger&zielkamera=kies&hofzufahrt=0');
assert.equal(kies.parameter.get('hofzufahrt'), '0');
assert.equal(kies.parameter.get('kamera'), '1354.2,37.478584,420.47,1350.03,35.917412,418.87');
assert.equal(kies.parameter.get('fov'), '58');
assert.equal(waehleZielort('?ziel=felsmulde&absetzen=4,5,6').parameter.get('absetzen'), '4,5,6');
for (const suche of ['', '?lookfels=1', '?ziel=unbekannt', '?region=fahlmoos&ziel=milbinger']) {
  assert.deepEqual([...waehleZielort(suche).parameter], [...new URLSearchParams(suche)]);
}
