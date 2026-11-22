/**
 * Tests für die Wanderfiguren (D375, Story-Bibel v2 §5).
 *
 * Geprüft wird die eine Frage, die das Modul beantwortet — an welcher Station steht die Figur —,
 * an den Stellen, an denen sie falsch werden kann:
 *
 * · Wer zu spät kommt, trifft sie an der alten Station nicht mehr (verpassen ist gewollt).
 * · Eine Station mit `ab` gibt es erst, wenn `ab` gilt — vorher ist die Figur nirgends, nicht
 *   an der Station davor.
 * · Nach der letzten Station mit `bis` ist sie fort.
 *
 * Der zweite Teil läuft über die echten Dateien unter `content/wanderfiguren`: Jede Station
 * muss in irgendeinem Spielverlauf erreichbar sein, sonst ist ihr Text tot.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { Wanderfigur } from '../src/data/schema.js';
import { gilt, stationVon, type Weltstand } from '../src/spiel/wanderfiguren.js';

let ok = 0, fehler = 0;
function pruefe(was: string, bedingung: boolean, notiz = '') {
  console.log(`  ${bedingung ? '✓' : '✗'} ${was.padEnd(62)} ${notiz}`);
  bedingung ? ok++ : fehler++;
}

const LEER: Weltstand = { fragmente: [], regenten: [], geheilt: [], auftraege: {} };
const ORT: [number, number] = [47.73, 12.09];

const F: Wanderfigur = {
  id: 'probe', region: 'oental', fraktion: 'enklave', name: 'Probe',
  stationen: [
    { wo: 'eins', ort: ORT, text: '', bis: { art: 'finde', fragment: 'stauwehr' } },
    { wo: 'zwei', ort: ORT, text: '', bis: { art: 'regent', regent: 'flussvater' } },
    { wo: 'drei', ort: ORT, text: '', ab: { art: 'heile', regent: 'flussvater' } },
  ],
};

console.log('Stationen:');
pruefe('Am Anfang steht sie an der ersten Station', stationVon(F, LEER) === 0);
pruefe('Nach dem Fundstück ist sie weitergezogen', stationVon(F, { ...LEER, fragmente: ['stauwehr'] }) === 1);
pruefe('Regent besiegt, Fundstück nie gelesen: erste Station',
       stationVon(F, { ...LEER, regenten: ['flussvater'] }) === 0);
pruefe('Besiegt, nicht geheilt: Sie ist nirgends',
       stationVon(F, { ...LEER, fragmente: ['stauwehr'], regenten: ['flussvater'] }) === null);
pruefe('Geheilt: Sie steht an der letzten Station',
       stationVon(F, { fragmente: ['stauwehr'], regenten: ['flussvater'], geheilt: ['flussvater'], auftraege: {} }) === 2);
{
  const fort: Wanderfigur = { ...F, stationen: F.stationen.map(s => ({ ...s, ab: undefined, bis: { art: 'finde' as const, fragment: 'stauwehr' } })) };
  pruefe('Alle Stationen verlassen: Sie ist fort', stationVon(fort, { ...LEER, fragmente: ['stauwehr'] }) === null);
}
pruefe('Auftrag zählt erst, wenn abgeholt',
       !gilt({ art: 'auftrag', auftrag: 'a' }, { ...LEER, auftraege: { a: 'angenommen' } })
       && gilt({ art: 'auftrag', auftrag: 'a' }, { ...LEER, auftraege: { a: 'abgeholt' } }));
pruefe('Schema lehnt eine Zwischenstation ohne `bis` ab',
       !Wanderfigur.safeParse({ ...F, stationen: [{ wo: 'a', ort: ORT, text: '' }, ...F.stationen.slice(1)] }).success);
pruefe('Schema verlangt mindestens drei Stationen',
       !Wanderfigur.safeParse({ ...F, stationen: F.stationen.slice(1) }).success);

console.log('\nInhalte (content/wanderfiguren):');
const ordner = 'content/wanderfiguren';
const figuren = readdirSync(ordner).filter(f => f.endsWith('.json'))
  .map(f => Wanderfigur.parse(JSON.parse(readFileSync(`${ordner}/${f}`, 'utf8'))));
pruefe('Drei Figuren, je eine Fraktion',
       figuren.length === 3 && new Set(figuren.map(f => f.fraktion)).size === 3, figuren.map(f => f.id).join(', '));

/**
 * Alle Weltstände, die eine Figur unterscheiden kann: jede Teilmenge ihrer eigenen Bedingungen —
 * ohne die unmöglichen (geheilt ohne besiegt, `heilung.ts`).
 */
function staende(f: Wanderfigur): Weltstand[] {
  const bed = f.stationen.flatMap(s => [s.ab, s.bis]).filter((b): b is NonNullable<typeof b> => !!b);
  const eindeutig = [...new Map(bed.map(b => [JSON.stringify(b), b])).values()];
  const raus: Weltstand[] = [];
  for (let m = 0; m < 1 << eindeutig.length; m++) {
    const w = { fragmente: [] as string[], regenten: [] as string[], geheilt: [] as string[], auftraege: {} as Record<string, string> };
    eindeutig.forEach((b, i) => {
      if (!(m >> i & 1)) return;
      if (b.art === 'finde') w.fragmente.push(b.fragment);
      if (b.art === 'regent') w.regenten.push(b.regent);
      if (b.art === 'heile') w.geheilt.push(b.regent);
      if (b.art === 'auftrag') w.auftraege[b.auftrag] = 'abgeholt';
    });
    if (w.geheilt.every(r => w.regenten.includes(r))) raus.push(w);
  }
  return raus;
}
for (const f of figuren) {
  const erreicht = new Set(staende(f).map(w => stationVon(f, w)));
  const tot = f.stationen.map((s, i) => (erreicht.has(i) ? null : s.wo)).filter(Boolean);
  pruefe(`${f.id}: jede der ${f.stationen.length} Stationen ist erreichbar`, tot.length === 0, tot.join(', '));
  pruefe(`${f.id}: kein Satz über 240 Zeichen`, f.stationen.every(s => s.text.length <= 240));
}
{
  const bote = figuren.find(f => f.fraktion === 'erbe')!;
  pruefe('Der Bote des Erbes erscheint erst nach dem Wandel',
         stationVon(bote, LEER) === null && stationVon(bote, { ...LEER, regenten: ['flussvater'] }) === 0);
}

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if (fehler > 0) process.exit(1);
