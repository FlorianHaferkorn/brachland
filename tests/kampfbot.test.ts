/**
 * BRACHLAND — Kampfbot als Tor (D171): ein Band, kein Punkt.
 *
 * Der Bot (`tools/kampfbot.ts`) ist kein Mensch; seine Zahlen hängen an seiner Spielweise (in D171
 * gesehen: eine zu vorsichtige Fassung verlor 80 % gegen den Grathorn, weil sie nie zuschlug). Das
 * Tor prüft deshalb nur ein breites Band, das jede Regeländerung halten soll:
 *   * Einzeln ist jeder Gegner für einen aufmerksamen Spieler schlagbar (≥ 90 %).
 *   * Zu zweit ist es ein Kampf: aufmerksam meist gewonnen (≥ 60 %), müde nicht immer (< 95 %).
 *   * Das Rudel (drei Wölfe, D172) ist der harte Kampf: aufmerksam ≥ 40 %, müde meist verloren.
 *   * Parieren (D173): Klinge einzeln ≥ 90 % und nicht langsamer als Rollen; gegen das Rudel schlechter.
 *   * Kein Kampf läuft in die Zeitgrenze — sonst schlägt jemand nie zu.
 * D407: Dasselbe Band gilt für den korrigierten Bot (`BOT_D407`, kennt den Vorschritt seines Hiebs) —
 * die Korrektur darf kein Tor kippen.
 */
import { messe, BOT_D407, type BotOptionen } from '../tools/kampfbot.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}

function tor(bot: string, opt?: BotOptionen) {
  const zeilen = messe(60, opt);
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  for (const z of zeilen) {
    const zahl = z.gegner.split('+').length;
    // Einzeln fast sicher, zu zweit meist, das Rudel (drei Wölfe, D172) ist der harte Kampf.
    const latte = zahl === 1 ? 0.9 : zahl === 2 ? 0.6 : 0.4;
    if (z.profil === 'aufmerksam') {
      pruefe(`${bot}: ${z.gegner}/${z.waffe}: aufmerksam ≥ ${latte * 100} %`, z.siege >= latte, pct(z.siege));
    }
    const grenze = zahl >= 3 ? 90 : 60;
    pruefe(`${bot}: ${z.gegner}/${z.waffe}/${z.profil}: Sieg im Mittel unter ${grenze} s`, !(z.zeit > grenze), `${z.zeit.toFixed(1)} s`);
  }
  // D173 (ADR-0009 Stufe 1): Parieren ist die Klingenantwort auf Einzelgegner — schnell und sicher,
  // aber kein Freibrief: Gegen das Rudel bleibt die Rolle besser, die Axt (lange Erholung) pariert schlecht.
  const par = zeilen.filter(z => z.profil === 'parierend');
  const auf = (z: typeof zeilen[number]) => zeilen.find(y => y.gegner === z.gegner && y.waffe === z.waffe && y.profil === 'aufmerksam')!;
  for (const z of par.filter(z => z.waffe === 'klinge' && !z.gegner.includes('+'))) {
    pruefe(`${bot}: ${z.gegner}/klinge: parierend ≥ 90 %`, z.siege >= 0.9, pct(z.siege));
    pruefe(`${bot}: ${z.gegner}/klinge: Parade nicht langsamer als Rollen`, z.zeit <= auf(z).zeit + 1, `${z.zeit.toFixed(1)} gegen ${auf(z).zeit.toFixed(1)} s`);
  }
  const rudelPar = par.filter(z => z.gegner.split('+').length === 3);
  pruefe(bot + ': ' + 'gegen das Rudel ist Parieren schlechter als Rollen', rudelPar.every(z => z.siege < auf(z).siege),
    rudelPar.map(z => `${z.waffe} ${pct(z.siege)} gegen ${pct(auf(z).siege)}`).join(', '));
  pruefe(bot + ': ' + 'der Bot pariert wirklich (Klinge gegen Wolf ≥ 0,5 Paraden je Kampf — einer reicht oft)',
    (par.find(z => z.gegner === 'wolf' && z.waffe === 'klinge')?.paraden ?? 0) >= 0.5);
  const muedePaare = zeilen.filter(z => z.gegner.includes('+') && z.profil === 'müde');
  const rudelMuede = zeilen.filter(z => z.gegner.split('+').length === 3 && z.profil === 'müde');
  pruefe(bot + ': ' + 'das Rudel schlägt einen müden Spieler meistens', rudelMuede.every(z => z.siege < 0.5),
    rudelMuede.map(z => `${z.waffe} ${pct(z.siege)}`).join(', '));
  pruefe(bot + ': ' + 'zu zweit verliert ein müder Spieler manchmal', muedePaare.some(z => z.siege < 0.95),
    muedePaare.map(z => `${z.gegner}/${z.waffe} ${pct(z.siege)}`).join(', '));

  return zeilen.length;
}
const zeilenZahl = tor('D171');
tor('D407', BOT_D407);

console.log(`\nKampfbot — ${zeilenZahl} Zeilen à 60 Kämpfe, Bot D171 und D407`);
console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
