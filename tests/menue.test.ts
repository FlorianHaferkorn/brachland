/**
 * Menü — die Teile, die etwas kaputtmachen können.
 *
 * Geprüft wird nicht die Oberfläche, sondern die zwei Stellen, an denen ein
 * Fehler still bliebe:
 *
 * 1. **Teamreihenfolge.** Sie steht an zwei Orten (Team und Erfahrung, weil die
 *    Engine keinen Fortschritt kennt). Laufen die auseinander, trägt die falsche
 *    Kreatur die falsche Erfahrung, und man sieht es erst beim nächsten
 *    Stufenaufstieg — also viel zu spät, um es noch zuzuordnen.
 * 2. **Gegenstände ausserhalb des Kampfes.** `wendeAn` sagt selbst, es bediene
 *    „Kampf und Beutel ausserhalb, damit ein Sud draussen nicht anders wirkt als
 *    drinnen" — bis heute rief es nur der Kampf auf. Dieser Test hält fest, dass
 *    beide Wege dasselbe tun.
 */
import { readFileSync } from 'node:fs';
import { verschiebe } from '../src/spiel/team.js';
import { wendeAn, wirktAuf } from '../src/spiel/gegenstaende.js';
import { erstelle } from '../src/engine/battle.js';
import { Gegenstand } from '../src/data/schema.js';
import { LEERER_STAND } from '../src/spiel/spielstand.js';

// Nicht über `data/inhalte.ts`: das benutzt `import.meta.glob` und läuft nur im
// Vite-Build. Der Inhalt wird hier direkt gelesen und gegen dasselbe Schema
// geprüft — damit hängt der Test an der echten Datei, nicht an einer Attrappe.
const ausDatei = (pfad: string) =>
  Gegenstand.parse(JSON.parse(readFileSync(pfad, 'utf8')));

const kaempfer = (kp: number) => erstelle({
  id: 'grathorn#0@10', name: 'Grathorn', elemente: ['stein'],
  ang: 60, ver: 60, ini: 50, maxKp: 200, zustand: 'rein', moves: [],
});

let bestanden = 0, fehlgeschlagen = 0;
function pruefe(name: string, bedingung: boolean, zusatz = '') {
  if (bedingung) { bestanden++; console.log(`  ✓ ${name.padEnd(54)} ${zusatz}`); }
  else { fehlgeschlagen++; console.log(`  ✗ ${name.padEnd(54)} ${zusatz}`); }
}

console.log('Menü — Teamreihenfolge und Beutel ausserhalb des Kampfes\n');

// ------------------------------------------------ Reihenfolge
const a = ['a', 'b', 'c', 'd'];
pruefe('Nach vorn schieben', verschiebe(a, 2, 0).join('') === 'cabd');
pruefe('Nach hinten schieben', verschiebe(a, 0, 3).join('') === 'bcda');
pruefe('Ein Platz hoch', verschiebe(a, 1, 0).join('') === 'bacd');
pruefe('Ein Platz runter', verschiebe(a, 1, 2).join('') === 'acbd');
pruefe('Gleicher Platz ändert nichts', verschiebe(a, 1, 1).join('') === 'abcd');
pruefe('Quelle ausserhalb ändert nichts', verschiebe(a, 9, 0).join('') === 'abcd');
pruefe('Ziel ausserhalb ändert nichts', verschiebe(a, 0, 9).join('') === 'abcd');
pruefe('Negativ ändert nichts', verschiebe(a, -1, 2).join('') === 'abcd');
pruefe('Die Eingabe bleibt unberührt', a.join('') === 'abcd');
pruefe('Leere Liste wirft nicht', verschiebe([], 0, 1).length === 0);

// Die eigentliche Gefahr: zwei Listen, eine Bewegung.
const team = ['grathorn', 'spuerfuchs', 'firnhase'];
const erfahrung = [10, 20, 30];
const [von, nach] = [2, 0];
const t2 = verschiebe(team, von, nach);
const e2 = verschiebe(erfahrung, von, nach);
pruefe('Team und Erfahrung bleiben gekoppelt',
  t2[0] === 'firnhase' && e2[0] === 30 && t2[2] === 'spuerfuchs' && e2[2] === 20,
  `${t2[0]}=${e2[0]}`);

// ------------------------------------------------ Beutel ausserhalb
const sud = ausDatei('content/gegenstaende/kraeutersud.json');
pruefe('Der Kräutersud liegt als gültiger Inhalt vor', sud.id === 'kraeutersud');

const k = kaempfer(200);
k.kp = 60;
pruefe('Verwundet ist er ein sinnvolles Ziel', wirktAuf(sud, k));
const w = wendeAn(sud, k);
pruefe('Der Sud wirkt draussen', w.gewirkt, w.meldung);
pruefe('Und hebt die KP', k.kp > 60, `60 → ${k.kp}`);
pruefe('Um genau den Anteil aus der Datei', k.kp === 60 + Math.round(200 * 0.35),
  `${k.kp}`);

const voll = kaempfer(200);
pruefe('Bei vollen KP kein sinnvolles Ziel', !wirktAuf(sud, voll));
const w2 = wendeAn(sud, voll);
pruefe('Und der Gegenstand wird nicht verbraucht', !w2.gewirkt, w2.meldung);

const tot = kaempfer(200);
tot.kp = 0;
pruefe('Ein Ausgefallener ist kein Heilziel', !wirktAuf(sud, tot));
pruefe('Heilen an einem Ausgefallenen wirkt nicht', !wendeAn(sud, tot).gewirkt);
pruefe('Und lässt ihn ausgefallen', tot.kp === 0);

// Nie über das Maximum — draussen kann man beliebig oft anwenden, drinnen nicht.
const fast = kaempfer(200);
fast.kp = 195;
wendeAn(sud, fast);
pruefe('Heilen läuft nicht über die Höchst-KP', fast.kp === 200, `${fast.kp}/200`);

// ------------------------------------------------ Spielstand
pruefe('Der leere Stand kennt besuchte Orte', Array.isArray(LEERER_STAND.orte));
pruefe('Und startet ohne einen', LEERER_STAND.orte.length === 0);
// Das Feld kam ohne Versionssprung dazu — ein Sprung verwirft in `ladeStand`
// jeden bestehenden Stand. Dieser Test hält die Absicht fest.
pruefe('Die Spielstandversion ist dafür NICHT gesprungen', LEERER_STAND.version === 1,
  `Version ${LEERER_STAND.version}`);

console.log(`\n${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
if (fehlgeschlagen) process.exit(1);
