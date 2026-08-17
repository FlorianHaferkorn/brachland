/**
 * Tests für die vier Zustände, die Narben und die neuen Kampfregeln.
 *
 * Anlass ist die Creature Design Bible v1.1: Sie nennt vier Zustände mit konkreten
 * Zahlen, der Code kannte drei ohne Narben. Beim Zusammenführen kamen drei Befunde
 * heraus, und dieser Test hält alle drei fest:
 *
 * 1. **Resistenz und Verteidigung wären derselbe Effekt gewesen.** Das Blatt nennt
 *    „+20 % Resistenz" und „+30 % Verteidigung" — beides wäre auf `ver` gelaufen.
 *    Deshalb stumpft `resistenz` jetzt den **Elementnachteil** ab und `panzer` hebt
 *    `ver`. Der Test prüft, dass sie sich unterschiedlich verhalten.
 * 2. **Krit gab es nicht.** Die Wildling-Narbe hätte auf nichts gezeigt.
 * 3. **Move-Effekte wurden nie angewendet.** `moveDef` warf sie weg — alle 49 Moves
 *    trugen Wirkungen, die die Engine nie gesehen hat.
 */
import { NARBE } from '../src/data/schema.js';
import {
  REGELN, erstelle, fangbarImZustand, iniEff, rng, schlag, stufenFaktor,
  trefferchance, wendeWirkungenAn, type Kaempfer, type MoveDef, type Zustand,
} from '../src/engine/battle.js';

let ok = 0, fehler = 0;
function pruefe(was: string, bedingung: boolean, notiz = '') {
  console.log(`  ${bedingung ? '✓' : '✗'} ${was.padEnd(52)} ${notiz}`);
  bedingung ? ok++ : fehler++;
}

const MOVE: MoveDef = { id: 'x', name: 'X', element: 'holz', band: 'normal' };
const HOLZ_HAU: MoveDef = { id: 'h', name: 'Holzhau', element: 'holz', band: 'normal' };

function kaempfer(zustand: Zustand, elemente: ('holz' | 'stein' | 'frost')[] = ['stein'],
                  narbe?: { art: 'krit' | 'resistenz' | 'panzer'; wert: number }): Kaempfer {
  return erstelle({
    id: 'k', name: 'K', elemente, zustand, narbe,
    maxKp: 200, ang: 60, ver: 60, ini: 50, moves: [MOVE],
  });
}

console.log('Zustände und Narben — Creature Design Bible v1.1\n');

// ---- Fangbarkeit -----------------------------------------------------------
{
  pruefe('rein ist fangbar', fangbarImZustand('rein'));
  pruefe('befallen ist fangbar', fangbarImZustand('befallen'));
  pruefe('rückgeführt ist fangbar', fangbarImZustand('rueckgefuehrt'));
  pruefe('verhärtet ist NICHT fangbar', !fangbarImZustand('verhaertet'));
}

// ---- Befall: die Zahlen des Blattes gegen die Engine -----------------------
{
  const rein = kaempfer('rein'), bef = kaempfer('befallen');
  pruefe('Befall hebt ANG um 15 %', bef.ang === Math.round(rein.ang * 1.15),
         `${rein.ang} → ${bef.ang}`);
  pruefe('Befall hebt VER um 15 %', bef.ver === Math.round(rein.ver * 1.15));
  // Der Punkt, den das Blatt mit „+20 % Rohwerte" verliert: INI profitiert WENIGER.
  pruefe('Befall hebt INI nur um 10 % — nicht 15', bef.ini === Math.round(rein.ini * 1.10),
         `${rein.ini} → ${bef.ini}`);
  pruefe('INI wächst schwächer als ANG', REGELN.BEFALL_INI < REGELN.BEFALL_ANG);
}

// ---- Rückgeführt: keine Zehrung, kein Befall-Bonus, dafür Narbe ------------
{
  const rein = kaempfer('rein');
  const rueck = kaempfer('rueckgefuehrt', ['stein'], NARBE.wildling);
  pruefe('Rückgeführt hat keinen Befall-Bonus', rueck.ang === rein.ang);
  pruefe('Rückgeführt trägt die Narbe', rueck.narbe?.art === 'krit');
  // Eine Narbe an einem nicht-zurückgeführten Kämpfer wird verworfen: Sie entsteht
  // durch die Reinigung, nicht durch die Datenlage.
  const falsch = kaempfer('befallen', ['stein'], NARBE.wildling);
  pruefe('Narbe wirkt nur bei rückgeführt', falsch.narbe === undefined);
}

// ---- Die drei Narben müssen sich UNTERSCHEIDEN -----------------------------
{
  const ohne = kaempfer('rueckgefuehrt');
  const krit = kaempfer('rueckgefuehrt', ['stein'], NARBE.wildling);
  const resi = kaempfer('rueckgefuehrt', ['stein'], NARBE.zuchtlinie);
  const panz = kaempfer('rueckgefuehrt', ['stein'], NARBE.verwachsener);

  pruefe('Krit-Narbe hebt die Volltrefferchance',
         Math.abs(krit.krit - (REGELN.KRIT_BASIS + 0.15)) < 1e-9,
         `${(krit.krit * 100).toFixed(0)} %`);
  pruefe('Panzer-Narbe hebt VER um 30 %', panz.ver === Math.round(ohne.ver * 1.3),
         `${ohne.ver} → ${panz.ver}`);
  // Der eigentliche Befund: Resistenz darf NICHT dasselbe wie Panzer sein.
  pruefe('Resistenz-Narbe lässt VER unangetastet', resi.ver === ohne.ver,
         `${resi.ver} = ${ohne.ver}`);

  // Resistenz stumpft den Elementnachteil ab. Holz schlägt Stein (Faktor 2).
  const ang = kaempfer('rein', ['holz']);
  const zufall = () => 0.5;   // trifft, mittlere Streuung, kein Krit
  const gegenOhne = schlag(ang, ohne, HOLZ_HAU, zufall).wert;
  const gegenResi = schlag(ang, resi, HOLZ_HAU, zufall).wert;
  pruefe('Resistenz senkt den Elementnachteil', gegenResi < gegenOhne,
         `${gegenOhne} → ${gegenResi}`);
  // 2,0 wird zu 1,8 — also 10 % weniger Schaden, nicht 20 %. Das ist gewollt:
  // Die Narbe nimmt 20 % des ÜBERSCHUSSES, nicht 20 % des Schadens.
  pruefe('Genau der Überschuss wird gedämpft',
         Math.abs(gegenResi / gegenOhne - 1.8 / 2.0) < 0.02,
         `${(gegenResi / gegenOhne).toFixed(3)}`);
  // Und einen Vorteil des Verteidigers lässt sie in Ruhe.
  const frostGegner = kaempfer('rueckgefuehrt', ['frost'], NARBE.zuchtlinie);
  const frostOhne = kaempfer('rueckgefuehrt', ['frost']);
  pruefe('Vorteil des Verteidigers bleibt unangetastet',
         schlag(ang, frostGegner, HOLZ_HAU, zufall).wert === schlag(ang, frostOhne, HOLZ_HAU, zufall).wert);
}

// ---- Trefferwurf und Volltreffer ------------------------------------------
console.log('\nTrefferwurf und Volltreffer\n');
{
  const a = kaempfer('rein'), d = kaempfer('rein');
  pruefe('Grundgenauigkeit 95 %', Math.abs(trefferchance(a) - 0.95) < 1e-9);
  a.genauigkeit = -2;
  pruefe('Zwei Stufen Blendung → 70 %', Math.abs(trefferchance(a) - 0.70) < 1e-9,
         `${(trefferchance(a) * 100).toFixed(0)} %`);
  a.genauigkeit = -3;
  pruefe('Nie unter der Untergrenze', trefferchance(a) >= REGELN.TREFFER_MIN,
         `${(trefferchance(a) * 100).toFixed(0)} %`);
  a.genauigkeit = 3;
  pruefe('Nie über 100 %', trefferchance(a) <= 1);

  a.genauigkeit = 0;
  // Ein Wurf über der Trefferchance ist ein Fehlschlag — und der unterscheidet
  // sich von „0 Schaden": Utility trifft immer.
  const daneben = schlag(a, d, MOVE, () => 0.99);
  pruefe('Fehlschlag macht 0 Schaden', daneben.fehlschlag && daneben.wert === 0);
  const util: MoveDef = { id: 'u', name: 'U', element: 'holz', band: 'utility' };
  pruefe('Utility geht nie daneben', !schlag(a, d, util, () => 0.99).fehlschlag);

  // Volltreffer: dritter Wurf unter der Kritchance.
  const wuerfe = [0.1, 0.5, 0.001];
  let i = 0;
  const gezielt = schlag(a, d, MOVE, () => wuerfe[i++]);
  pruefe('Volltreffer wird erkannt', gezielt.kritisch);
  i = 0;
  const normal = schlag(a, d, MOVE, () => [0.1, 0.5, 0.9][i++]);
  pruefe('Volltreffer macht mehr Schaden', gezielt.wert > normal.wert,
         `${normal.wert} → ${gezielt.wert}`);
  pruefe('Und zwar um den Faktor aus den Regeln',
         Math.abs(gezielt.wert / normal.wert - REGELN.KRIT_SCHADEN) < 0.02);
}

// ---- Statusstufen ---------------------------------------------------------
console.log('\nMove-Wirkungen — vorher wurden sie verworfen\n');
{
  pruefe('Stufe 0 ist neutral', stufenFaktor(0) === 1);
  pruefe('+2 Stufen sind +40 %', Math.abs(stufenFaktor(2) - 1.4) < 1e-9);
  pruefe('-2 Stufen sind der Kehrwert', Math.abs(stufenFaktor(-2) - 1 / 1.4) < 1e-9);
  pruefe('Nie null, auch bei -3', stufenFaktor(-3) > 0.3);
  pruefe('Gedeckelt bei ±3', stufenFaktor(9) === stufenFaktor(3));

  const a = kaempfer('rein'), d = kaempfer('rein');
  const blend: MoveDef = {
    id: 'blendlinse', name: 'Blendlinse', element: 'alt-tech', band: 'utility',
    effekte: [{ art: 'genauigkeit', stufen: -2, ziel: 'gegner' }],
  };
  const gemeldet = wendeWirkungenAn(a, d, blend);
  pruefe('Blendlinse senkt die Genauigkeit des GEGNERS', d.genauigkeit === -2 && a.genauigkeit === 0);
  pruefe('Die Änderung wird gemeldet', gemeldet.length === 1 && gemeldet[0].includes('Genauigkeit'),
         gemeldet[0] ?? '');

  // Drei Blendungen können nicht tiefer als -3 — sonst wäre ein Kämpfer wehrlos.
  wendeWirkungenAn(a, d, blend);
  wendeWirkungenAn(a, d, blend);
  pruefe('Stufen sind gedeckelt, nicht kumulativ ohne Ende', d.genauigkeit === -3,
         `${d.genauigkeit}`);
  pruefe('Keine Meldung, wenn nichts mehr passiert',
         wendeWirkungenAn(a, d, blend).length === 0);

  // Statuswert auf sich selbst.
  const b = kaempfer('rein'), c = kaempfer('rein');
  const flucht: MoveDef = {
    id: 'steilflucht', name: 'Steilflucht', element: 'stein', band: 'utility',
    effekte: [{ art: 'statuswert', wert: 'ini', stufen: 2, ziel: 'selbst' }],
  };
  const iniVor = iniEff(b);
  wendeWirkungenAn(b, c, flucht);
  pruefe('Steilflucht hebt die eigene INI', iniEff(b) > iniVor,
         `${iniVor.toFixed(0)} → ${iniEff(b).toFixed(0)}`);
  pruefe('Der Grundwert bleibt unangetastet', b.ini === c.ini,
         'Stufen werden beim Lesen angewandt, nicht eingerechnet');
}

// ---- Determinismus bleibt -------------------------------------------------
{
  const lauf = () => {
    const z = rng(7);
    const a = kaempfer('rein'), d = kaempfer('rein');
    return [0, 1, 2, 3, 4].map(() => schlag(a, d, MOVE, z).wert).join(',');
  };
  pruefe('Gleicher Seed, gleiche Schläge', lauf() === lauf(), lauf());
}

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if (fehler > 0) process.exit(1);
