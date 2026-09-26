/**
 * BRACHLAND — Kampfbot als Tor (D171): ein Band, kein Punkt.
 *
 * Der Bot (`tools/kampfbot.ts`) ist kein Mensch; seine Zahlen hängen an seiner Spielweise (in D171
 * gesehen: eine zu vorsichtige Fassung verlor 80 % gegen den Grathorn, weil sie nie zuschlug). Das
 * Tor prüft deshalb nur ein breites Band, das jede Regeländerung halten soll:
 *   * Einzeln ist jeder Gegner für einen aufmerksamen Spieler schlagbar (≥ 90 %).
 *   * Zu zweit ist es ein Kampf: aufmerksam meist gewonnen (≥ 60 %), müde nicht immer (< 95 %).
 *   * Kein Kampf läuft in die Zeitgrenze — sonst schlägt jemand nie zu.
 */
import { messe } from '../tools/kampfbot.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}

const zeilen = messe(60);
const pct = (x: number) => `${Math.round(x * 100)} %`;
for (const z of zeilen) {
  const paar = z.gegner.includes('+');
  if (z.profil === 'aufmerksam') {
    pruefe(`${z.gegner}/${z.waffe}: aufmerksam ${paar ? '≥ 60 %' : '≥ 90 %'}`, z.siege >= (paar ? 0.6 : 0.9), pct(z.siege));
  }
  pruefe(`${z.gegner}/${z.waffe}/${z.profil}: Sieg im Mittel unter 60 s`, !(z.zeit > 60), `${z.zeit.toFixed(1)} s`);
}
const muedePaare = zeilen.filter(z => z.gegner.includes('+') && z.profil === 'müde');
pruefe('zu zweit verliert ein müder Spieler manchmal', muedePaare.some(z => z.siege < 0.95),
  muedePaare.map(z => `${z.gegner}/${z.waffe} ${pct(z.siege)}`).join(', '));

console.log(`\nKampfbot — ${zeilen.length} Zeilen à 60 Kämpfe`);
console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
