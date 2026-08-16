/**
 * Tests für den Auftragsfortschritt.
 *
 * Die Fälle sind entlang der Stellen gewählt, an denen ein abgeleiteter Fortschritt
 * typischerweise falsch wird:
 *
 * · Präfix statt Präfix-mit-Trenner — `schneehuhn` würde sonst `schneehuhn-alt`
 *   mitzählen. Solche IDs gibt es heute nicht und irgendwann doch.
 * · Zählen über die Zielmenge hinaus — 5 von 3 ist kein Fortschritt, sondern
 *   eine kaputte Anzeige.
 * · Die Reihenfolge beim Geber. Wer vor einem NPC steht, muss zuerst sehen, was
 *   fertig ist, nicht was neu ist.
 */
import type { Auftrag } from '../src/data/schema.js';
import {
  beiGeber, lage, werteZiel, zielText, type Auftragsstand, type Taten,
} from '../src/spiel/auftraege.js';

let ok = 0, fehler = 0;
function pruefe(was: string, bedingung: boolean, notiz = '') {
  console.log(`  ${bedingung ? '✓' : '✗'} ${was.padEnd(54)} ${notiz}`);
  bedingung ? ok++ : fehler++;
}

const LEER: Taten = { besiegt: [], gefangen: [], fragmente: [], regenten: [] };

const A1: Auftrag = {
  id: 'a1', region: 'oental', geber: 'hof', titel: 'Drei', text: '',
  ziel: { art: 'besiege', kreatur: 'sporenhahn', anzahl: 3 },
  belohnung: { kraeutersud: 3 },
};
const A2: Auftrag = {
  id: 'a2', region: 'oental', geber: 'hof', titel: 'Danach', text: '',
  ziel: { art: 'fange', kreatur: 'alpenmurmel', anzahl: 1 },
  belohnung: { koeder: 1 }, vorher: 'a1',
};
const A3: Auftrag = {
  id: 'a3', region: 'oental', geber: 'bruch', titel: 'Lies', text: '',
  ziel: { art: 'finde', fragment: 'stollenmund' }, belohnung: { harzverband: 2 },
};

console.log('Aufträge — Fortschritt wird abgeleitet, nicht mitgeschrieben\n');

// ---- Zählen ---------------------------------------------------------------
{
  const t: Taten = { ...LEER, besiegt: ['sporenhahn:1:2', 'sporenhahn:9:4', 'grathorn:3:3'] };
  const f = werteZiel(A1.ziel, t);
  pruefe('Zählt nur die richtige Kreatur', f.ist === 2 && f.soll === 3, `${f.ist}/${f.soll}`);
  pruefe('Noch nicht erfüllt', !f.erfuellt);
  pruefe('Text zeigt den Stand', zielText(A1.ziel, f) === 'sporenhahn besiegen · 2/3',
         zielText(A1.ziel, f));
}
{
  const t: Taten = { ...LEER, besiegt: Array.from({ length: 5 }, (_, i) => `sporenhahn:${i}:0`) };
  const f = werteZiel(A1.ziel, t);
  pruefe('Zählt nicht über das Ziel hinaus', f.ist === 3, `${f.ist}/${f.soll}`);
  pruefe('Erfüllt', f.erfuellt);
}
{
  // Der Fall, für den der Doppelpunkt im Präfix da ist.
  const t: Taten = { ...LEER, besiegt: ['sporenhahn-alt:1:1', 'sporenhahn-alt:2:2'] };
  pruefe('Ähnlicher Name zählt NICHT mit', werteZiel(A1.ziel, t).ist === 0);
}
{
  // Fangen und Besiegen sind verschiedene Listen — ein besiegtes Murmel erfüllt
  // keinen Fangauftrag.
  const t: Taten = { ...LEER, besiegt: ['alpenmurmel:1:1'] };
  pruefe('Besiegt erfüllt keinen Fangauftrag', !werteZiel(A2.ziel, t).erfuellt);
  const t2: Taten = { ...LEER, gefangen: ['alpenmurmel:1:1'] };
  pruefe('Gefangen erfüllt ihn', werteZiel(A2.ziel, t2).erfuellt);
}
{
  pruefe('Fragment ungelesen', !werteZiel(A3.ziel, LEER).erfuellt);
  pruefe('Fragment gelesen', werteZiel(A3.ziel, { ...LEER, fragmente: ['stollenmund'] }).erfuellt);
  pruefe('Falsches Fragment zählt nicht',
         !werteZiel(A3.ziel, { ...LEER, fragmente: ['stauwehr'] }).erfuellt);
}
{
  const ziel = { art: 'regent', regent: 'flussvater' } as const;
  pruefe('Regent offen', !werteZiel(ziel, LEER).erfuellt);
  pruefe('Regent besiegt', werteZiel(ziel, { ...LEER, regenten: ['flussvater'] }).erfuellt);
}

// ---- Lage -----------------------------------------------------------------
{
  const keine: Record<string, Auftragsstand> = {};
  pruefe('Unbekannt und ohne Vorbedingung ist offen', lage(A1, keine, LEER) === 'offen');
  pruefe('Mit unerfüllter Vorbedingung gesperrt', lage(A2, keine, LEER) === 'gesperrt');
  pruefe('Angenommen, Ziel offen', lage(A1, { a1: 'angenommen' }, LEER) === 'angenommen');

  const drei: Taten = { ...LEER, besiegt: ['sporenhahn:1:1', 'sporenhahn:2:2', 'sporenhahn:3:3'] };
  pruefe('Angenommen und Ziel erreicht → erfüllt',
         lage(A1, { a1: 'angenommen' }, drei) === 'erfuellt');
  pruefe('Abgeholt bleibt abgeholt', lage(A1, { a1: 'abgeholt' }, drei) === 'abgeholt');
  // Der Kern der Vorbedingung: ERFÜLLT reicht nicht, es muss ABGEHOLT sein.
  pruefe('Vorbedingung erfüllt, aber nicht abgeholt → weiter gesperrt',
         lage(A2, { a1: 'angenommen' }, drei) === 'gesperrt');
  pruefe('Vorbedingung abgeholt → offen', lage(A2, { a1: 'abgeholt' }, drei) === 'offen');
}
{
  // Ein Ziel, das VOR dem Annehmen schon erfüllt war, gilt trotzdem nicht als
  // erfüllt, solange der Auftrag nicht angenommen ist — sonst springt beim
  // Ansprechen sofort die Belohnung heraus.
  const drei: Taten = { ...LEER, besiegt: ['sporenhahn:1:1', 'sporenhahn:2:2', 'sporenhahn:3:3'] };
  pruefe('Vorab erfülltes Ziel ist trotzdem erst „offen"', lage(A1, {}, drei) === 'offen');
}

// ---- Reihenfolge beim Geber ------------------------------------------------
{
  const drei: Taten = {
    ...LEER,
    besiegt: ['sporenhahn:1:1', 'sporenhahn:2:2', 'sporenhahn:3:3'],
  };
  const liste = beiGeber([A1, A2, A3], 'hof', { a1: 'angenommen' }, drei);
  pruefe('Nur die Aufträge dieses Gebers', liste.every(e => e.auftrag.geber === 'hof'));
  pruefe('Gesperrte fallen raus', liste.length === 1, `${liste.length} sichtbar`);

  const zwei = beiGeber([A1, A2, A3], 'hof', { a1: 'abgeholt' }, drei);
  pruefe('Nach dem Abholen wird der Folgeauftrag sichtbar',
         zwei.length === 1 && zwei[0].auftrag.id === 'a2');

  // Für die Sortierung braucht es zwei sichtbare Aufträge nebeneinander. Beim
  // ersten Schreiben stand hier `{ a2: 'angenommen' }` ohne abgeholtes a1 — dann
  // ist a2 gesperrt und die Liste hat genau einen Eintrag. Der Test prüfte nichts.
  const A4: Auftrag = {
    id: 'a4', region: 'oental', geber: 'hof', titel: 'Neu', text: '',
    ziel: { art: 'besiege', kreatur: 'grathorn', anzahl: 2 }, belohnung: { zunder: 1 },
  };
  const beides = beiGeber([A1, A2, A3, A4], 'hof', { a1: 'abgeholt', a2: 'angenommen' }, {
    ...drei, gefangen: ['alpenmurmel:5:5'],
  });
  pruefe('Abholbereites steht über Neuem',
         beides.length === 2 && beides[0].auftrag.id === 'a2' && beides[0].lage === 'erfuellt'
         && beides[1].lage === 'offen',
         beides.map(e => `${e.auftrag.id}:${e.lage}`).join(' '));
}

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if (fehler > 0) process.exit(1);
