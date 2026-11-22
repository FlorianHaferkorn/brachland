/**
 * Spielphasen und echte Pause (D415, A-29 (1)).
 *
 * Festgehalten: Ein Menü pausiert; ein verborgener Tab pausiert und **bleibt** pausiert, bis der Spieler
 * fortsetzt; ein verlorener Grafikkontext lässt sich nicht wegklicken und wird gemeldet; was beim Laden
 * passiert, wirkt danach; gesichert wird beim Verbergen, aber nie im Kampf.
 */
import { MELDUNG_KONTEXT, START, eingabeGilt, naechste, simulationLaeuft, sollSichern, tonStumm,
         type Ereignis, type PhasenZustand } from '../src/spiel/spielphase.js';

let bestanden = 0, fehlgeschlagen = 0;
function pruefe(name: string, bedingung: boolean, zusatz = '') {
  if (bedingung) { bestanden++; console.log(`  ✓ ${name.padEnd(62)} ${zusatz}`); }
  else { fehlgeschlagen++; console.log(`  ✗ ${name.padEnd(62)} ${zusatz}`); }
}
const lauf = (...e: Ereignis[]): PhasenZustand => e.reduce(naechste, START);

console.log('Spielphasen — Pause, Tab-Wechsel, Kontextverlust\n');

pruefe('Start: lädt, keine Simulation', START.phase === 'laedt' && !simulationLaeuft(START));
const spielt = lauf({ art: 'geladen' });
pruefe('Geladen: spielt, Simulation und Eingabe laufen', spielt.phase === 'spielt' && simulationLaeuft(spielt) && eingabeGilt(spielt));
const menue = naechste(spielt, { art: 'menue', offen: true });
pruefe('Menü offen: echte Pause (A-29 (1))', menue.phase === 'menue' && !simulationLaeuft(menue) && !eingabeGilt(menue));
pruefe('Menü zu: spielt wieder', naechste(menue, { art: 'menue', offen: false }).phase === 'spielt');
const weg = naechste(spielt, { art: 'verborgen' });
pruefe('Tab verborgen: pausiert', weg.phase === 'pausiert' && weg.gruende.includes('verborgen'));
const zurueck = naechste(weg, { art: 'sichtbar' });
pruefe('Tab wieder sichtbar: bleibt pausiert, bis fortgesetzt', zurueck.phase === 'pausiert' && !zurueck.gruende.includes('verborgen'));
pruefe('Fortsetzen: spielt', naechste(zurueck, { art: 'fortsetzen' }).phase === 'spielt');
const kontext = naechste(spielt, { art: 'kontextVerloren' });
pruefe('Kontext verloren: pausiert mit Meldung', kontext.phase === 'pausiert' && kontext.meldung === MELDUNG_KONTEXT);
pruefe('Kontext verloren: Fortsetzen hilft nicht', naechste(kontext, { art: 'fortsetzen' }).phase === 'pausiert');
const wieder = lauf({ art: 'geladen' }, { art: 'kontextVerloren' }, { art: 'kontextZurueck' }, { art: 'fortsetzen' });
pruefe('Kontext zurück + Fortsetzen: spielt, Meldung weg', wieder.phase === 'spielt' && wieder.meldung === null);
const imMenue = lauf({ art: 'geladen' }, { art: 'menue', offen: true }, { art: 'verborgen' }, { art: 'sichtbar' }, { art: 'menue', offen: false });
pruefe('Verborgen im Menü: nach Schliessen pausiert statt spielt', imMenue.phase === 'pausiert');
const beimLaden = lauf({ art: 'verborgen' }, { art: 'geladen' });
pruefe('Verborgen beim Laden: nach dem Laden pausiert', beimLaden.phase === 'pausiert');
pruefe('Pause durch Spieler und wieder fort', lauf({ art: 'geladen' }, { art: 'pause' }, { art: 'fortsetzen' }).phase === 'spielt');
pruefe('Gamepad getrennt: pausiert mit Meldung', (() => { const z = naechste(spielt, { art: 'gamepadGetrennt' }); return z.phase === 'pausiert' && !!z.meldung; })());
pruefe('Ton: verborgen + Einstellung an = stumm, aus = nicht', tonStumm(weg, true) && !tonStumm(weg, false) && !tonStumm(spielt, true));
pruefe('Sichern beim Verbergen ausserhalb des Kampfs', sollSichern('verborgen', false) && sollSichern('pagehide', false));
pruefe('Nie im Kampf sichern (ausser Rast, die es dort nicht gibt)', !sollSichern('verborgen', true) && !sollSichern('zeit', true));
pruefe('Nicht während des Ladens sichern', !sollSichern('verborgen', false, true));

console.log(`\n${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
if (fehlgeschlagen > 0) process.exit(1);
