/** Unterbrochene Baum-LOD-Blenden behalten Deckung und benoetigen hoechstens drei Stufen. */
import assert from 'node:assert/strict';
import { EZ_BLEND_DAUER, EZ_STUFEN, ezGewichte, ezIntervall, ezWechsel } from '../src/scenes/ezlod.js';
import type { EzStufe, EzVerlauf } from '../src/scenes/ezlod.js';

const nahe = (a: number, b: number) => Math.abs(a - b) < 1e-10;
function pruefe(verlauf: EzVerlauf, zeit: number): void {
  const gewichte = ezGewichte(verlauf, zeit);
  assert.ok(nahe(gewichte.reduce((a, b) => a + b, 0), 1), 'Gesamtdeckung bleibt 1');
  const t = Math.max(0, Math.min(1, (zeit - verlauf.beginn) / EZ_BLEND_DAUER));
  let rand = 0;
  for (let i = 0; i < EZ_STUFEN.length; i++) {
    const [a, b, c, d] = ezIntervall(verlauf, EZ_STUFEN[i]);
    const unten = a + (c - a) * t, oben = b + (d - b) * t;
    assert.ok(nahe(unten, rand), 'Ditherintervalle ohne Luecke oder Ueberlappung');
    assert.ok(nahe(oben - unten, gewichte[i]), 'Ditherintervall entspricht dem Stufengewicht');
    rand = oben;
  }
  assert.ok(nahe(rand, 1), 'Ditherintervalle decken den gesamten Bereich');
}

// Drei verschiedene Stufen innerhalb einer Blende, auch mit sofortigem Rueckweg.
let lauf = ezWechsel('fern', 'mittel', 0);
for (const t of [0, 0.1, 0.4, 0.8, 1]) pruefe(lauf, t);
const vorUnterbrechung = ezGewichte(lauf, 0.2);
lauf = ezWechsel('mittel', 'nah', 0.2, lauf);
assert.deepEqual(ezGewichte(lauf, 0.2), vorUnterbrechung, 'kein Sprung beim zweiten Wechsel');
assert.ok(lauf.start.every(x => x > 0) === false, 'neue Zielstufe hat vor dem Einblenden noch Anteil null');
pruefe(lauf, 0.2); pruefe(lauf, 0.4);
const vorRueckkehr = ezGewichte(lauf, 0.4);
lauf = ezWechsel('nah', 'fern', 0.4, lauf);
assert.deepEqual(ezGewichte(lauf, 0.4), vorRueckkehr, 'Rueckkehr behaelt alle drei Anteile');
assert.ok(lauf.start.every(x => x > 0), 'alle drei Stufen werden beim Richtungswechsel erhalten');
for (const t of [0.4, 0.6, 1.2, 2]) pruefe(lauf, t);
assert.deepEqual(ezGewichte(lauf, 2), [0, 0, 1], 'alte Stufen verschwinden nach Blenddauer');

// Wiederholte schnelle Wechsel duerfen weder Deckung verlieren noch Zustand anwachsen lassen.
let vorher: EzStufe = 'fern';
for (let i = 1; i <= 1000; i++) {
  const ziel = EZ_STUFEN[i % 3], zeit = 2 + i * 0.07;
  const alteAnteile = ezGewichte(lauf, zeit);
  lauf = ezWechsel(vorher, ziel, zeit, lauf);
  assert.deepEqual(lauf.start, alteAnteile);
  assert.equal(lauf.start.length, 3);
  pruefe(lauf, zeit); pruefe(lauf, zeit + 0.035);
  vorher = ziel;
}
console.log('EZ-LOD: unterbrochene und 1000 schnelle Wechsel, Deckung und Zeitgrenzen geprueft.');
