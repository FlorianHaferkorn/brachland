/**
 * Tests für die Lehrstrecken (D390, Story-Bibel v2 §6 Schritt 0).
 *
 * Das Schema `Strecke` ist neu und noch von keinem Spielcode gelesen — deshalb prüft der Test das,
 * was das Schema zusagt, an den Stellen, an denen eine Strecke still falsch werden kann:
 *
 * · Die erste Station ist kampffrei; eine Station ohne Bild und ohne Fundstück erzählt nichts.
 * · Ein Werkzeugweg nennt sein Werkzeug, ein beschwerlicher keins (D374).
 * · Fünf bis acht Stationen, nur bekannte Lektionen.
 *
 * Der zweite Teil läuft über die echten Dateien unter `content/strecken`: Die Reihenfolge aus D381
 * (Bewegung → erster Kampf → erstes Reinigen → erste Zuflucht → harter Gegner vor dem Tor) muss
 * in den Daten stehen, und jeder Gegner muss eine Datei in `content/gegner` haben. Lage, Flutlinie
 * und Abstände misst `tools/validate.ts` gegen das Höhenraster.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { Strecke, LEKTIONEN } from '../src/data/schema.js';

let ok = 0, fehler = 0;
function pruefe(was: string, bedingung: boolean, notiz = '') {
  console.log(`  ${bedingung ? '✓' : '✗'} ${was.padEnd(66)} ${notiz}`);
  bedingung ? ok++ : fehler++;
}

const ORT: [number, number] = [47.733, 12.0815];
const station = (id: string, mehr: object = {}) => ({ id, name: id, ort: ORT, lehrt: ['bewegen'], bild: 'Ein Bild.', ...mehr });
const probe = (stationen: object[]) => ({
  id: 'probe', region: 'oental', name: 'Probe', start: { ort: ORT, blick: 0 }, stationen,
  ankunft: { bewohner: 'dorf-magd', zuflucht: 'terrasse-saal', text: '' },
});
const fuenf = [station('a'), station('b'), station('c'), station('d'), station('e')];
const mit = (i: number, mehr: object) => fuenf.map((s, k) => (k === i ? { ...s, ...mehr } : s));

console.log('Schema:');
pruefe('Fünf Stationen mit Bild sind eine Strecke', Strecke.safeParse(probe(fuenf)).success);
pruefe('Vier Stationen sind keine', !Strecke.safeParse(probe(fuenf.slice(0, 4))).success);
pruefe('Neun Stationen sind zu viele', !Strecke.safeParse(probe([...fuenf, ...fuenf.slice(0, 4).map((s, i) => ({ ...s, id: `x${i}` }))])).success);
pruefe('Die erste Station ist kampffrei', !Strecke.safeParse(probe(mit(0, { gegner: [{ art: 'fuchs', anzahl: 1 }] }))).success);
pruefe('Später darf gekämpft werden', Strecke.safeParse(probe(mit(1, { gegner: [{ art: 'fuchs', anzahl: 2 }] }))).success);
pruefe('Vier Gegner derselben Art an einer Station sind zu viele', !Strecke.safeParse(probe(mit(1, { gegner: [{ art: 'fuchs', anzahl: 4 }] }))).success);
pruefe('Ohne Bild und ohne Fundstück erzählt eine Station nichts', !Strecke.safeParse(probe(mit(2, { bild: undefined }))).success);
pruefe('Ein Fundstück genügt', Strecke.safeParse(probe(mit(2, { bild: undefined, fragment: 'stauwehr' }))).success);
pruefe('Unbekannte Lektion wird abgelehnt', !Strecke.safeParse(probe(mit(1, { lehrt: ['fliegen'] }))).success);
pruefe('Doppelte Stations-ID wird abgelehnt', !Strecke.safeParse(probe(mit(1, { id: 'a' }))).success);
pruefe('Werkzeugweg ohne Werkzeug wird abgelehnt', !Strecke.safeParse(probe(mit(1, { wege: [{ art: 'werkzeug', text: '' }] }))).success);
pruefe('Beschwerlicher Weg mit Werkzeug wird abgelehnt', !Strecke.safeParse(probe(mit(1, { wege: [{ art: 'beschwerlich', werkzeug: 'reiten', text: '' }] }))).success);
pruefe('Beide Wege nebeneinander gelten', Strecke.safeParse(probe(mit(1, { wege: [{ art: 'beschwerlich', text: '' }, { art: 'werkzeug', werkzeug: 'klettern', text: '' }] }))).success);
pruefe('Unbekanntes Feld wird abgelehnt', !Strecke.safeParse({ ...probe(fuenf), startAktiv: true }).success);

console.log('\nInhalte:');
const dateien = readdirSync('content/strecken').filter(f => f.endsWith('.json'));
pruefe('Es gibt mindestens eine Strecke', dateien.length > 0, `${dateien.length}`);
for (const datei of dateien) {
  const r = Strecke.safeParse(JSON.parse(readFileSync(`content/strecken/${datei}`, 'utf8')));
  pruefe(`${datei} entspricht dem Schema`, r.success);
  if (!r.success) continue;
  const s = r.data;
  pruefe(`${s.id}: Dateiname = id`, datei === `${s.id}.json`);
  const erste = (l: string) => s.stationen.findIndex(st => st.lehrt.includes(l as typeof LEKTIONEN[number]));
  const letzte = s.stationen.length - 1;
  pruefe(`${s.id}: jede Lektion kommt vor`, LEKTIONEN.every(l => erste(l) >= 0), LEKTIONEN.filter(l => erste(l) < 0).join(', '));
  pruefe(`${s.id}: Bewegung zuerst`, erste('bewegen') === 0);
  // D381: erster Kampf → erstes Reinigen → erste Zuflucht → harter Gegner vor dem Tor.
  const kampf = s.stationen.findIndex(st => st.gegner.length > 0);
  pruefe(`${s.id}: erster Kampf vor dem ersten Reinigen`, kampf > 0 && kampf < erste('reinigen'));
  pruefe(`${s.id}: erstes Reinigen vor der ersten Rast`, erste('reinigen') < erste('rast'));
  pruefe(`${s.id}: nach der Rast wird noch gekämpft`, s.stationen.slice(erste('rast') + 1).some(st => st.gegner.length > 0));
  pruefe(`${s.id}: die letzte Station ist ein Kampf (das Tor)`, s.stationen[letzte].gegner.length > 0);
  pruefe(`${s.id}: der erste Gegner steht allein`, s.stationen[kampf].gegner.reduce((a, g) => a + g.anzahl, 0) === 1);
  const arten = [...new Set(s.stationen.flatMap(st => st.gegner.map(g => g.art)))];
  pruefe(`${s.id}: jeder Gegner hat eine Datei`, arten.every(a => existsSync(`content/gegner/${a}.json`)), arten.join(', '));
  pruefe(`${s.id}: der Start liegt an der ersten Station`, s.start.ort[0] === s.stationen[0].ort[0] && s.start.ort[1] === s.stationen[0].ort[1]);
}

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
process.exit(fehler > 0 ? 1 : 0);
