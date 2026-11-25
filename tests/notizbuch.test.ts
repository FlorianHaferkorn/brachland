/**
 * Tests für das Heft (D392, `docs/design/BRACHLAND_Quests_v1.md` §2).
 *
 * Das Heft ist eine Sicht auf den Spielstand, kein zweiter Speicher. Geprüft wird, woran es scheitern
 * kann:
 *
 * · Es steht nur drin, was der Spieler gefunden hat — und zwar im Wortlaut der Inhalte.
 * · Der Satz einer Wanderfigur bleibt an der Station hängen, an der er gefallen ist, auch wenn die
 *   Figur weitergezogen ist; ohne Stationsvermerk (alter Stand) steht nichts da, statt etwas Falsches.
 * · Ein Auftrag steht unter seinem Geber, sobald er angenommen ist — nie vorher.
 * · Unbekannte IDs lassen das Heft nicht abstürzen.
 *
 * Der zweite Teil läuft über die echten Inhalte: Die vier Aufträge aus D392 tragen den
 * Belohnungsvertrag (`lohn`) und zeigen auf Fundstücke, die es gibt.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { Auftrag, Fragment, Ort, Wanderfigur, LOHNKATEGORIEN } from '../src/data/schema.js';
import { gehoerteStationen, notizbuch, type Heftinhalt, type Heftstand } from '../src/spiel/notizbuch.js';

let ok = 0, fehler = 0;
function pruefe(was: string, bedingung: boolean, notiz = '') {
  console.log(`  ${bedingung ? '✓' : '✗'} ${was.padEnd(66)} ${notiz}`);
  bedingung ? ok++ : fehler++;
}

function lade<T>(ordner: string, schema: { parse: (x: unknown) => T }): T[] {
  return readdirSync(ordner).filter(f => f.endsWith('.json'))
    .map(f => schema.parse(JSON.parse(readFileSync(`${ordner}/${f}`, 'utf8'))));
}
const inhalt: Heftinhalt = {
  fragmente: lade('content/fragmente', Fragment),
  orte: lade('content/orte', Ort),
  auftraege: lade('content/auftraege', Auftrag),
  figuren: lade('content/wanderfiguren', Wanderfigur),
};
const LEER: Heftstand = { fragmente: [], orte: [], auftraege: {} };

console.log('Das Heft:');
pruefe('Leerer Stand: leeres Heft', notizbuch(LEER, inhalt).length === 0);
{
  const n = notizbuch({ ...LEER, fragmente: ['stauwehr', 'pegellatte'] }, inhalt);
  const latte = inhalt.fragmente.find(f => f.id === 'pegellatte')!;
  pruefe('Gelesenes steht im Wortlaut und in der Reihenfolge des Findens',
         n.length === 2 && n[1].art === 'gelesen' && n[1].text === latte.text && n[1].quelle === latte.titel);
}
{
  const n = notizbuch({ ...LEER, orte: ['dorf-wirt', 'terrasse-saal'] }, inhalt);
  pruefe('Bewohner: gesagt; Zuflucht: gesehen', n.length === 2 && n[0].art === 'gesagt' && n[1].art === 'gesehen');
}
{
  const ohne = notizbuch({ ...LEER, orte: ['dorf-wirt'], auftraege: {} }, inhalt);
  const mit = notizbuch({ ...LEER, orte: ['dorf-wirt'], auftraege: { 'die-letzte-kerbe': 'angenommen', 'was-der-tresen-weiss': 'abgeholt' } }, inhalt);
  const kerbe = mit.find(x => x.auftrag === 'Die letzte Kerbe');
  const tresen = mit.find(x => x.auftrag === 'Was der Tresen weiß');
  pruefe('Ein nicht angenommener Auftrag steht nicht im Heft', ohne.length === 1);
  pruefe('Angenommen: Wortlaut des Gebers unter seinem Namen',
         !!kerbe && kerbe.quelle === 'Der Wirt' && kerbe.erledigt === false && kerbe.text.startsWith('Die Pegelwartin'));
  pruefe('Abgeholt: als erledigt vermerkt, nicht gelöscht', !!tresen && tresen.erledigt === true);
  pruefe('Kein Eintrag nennt ein Ziel — nur Titel und Wortlaut',
         mit.every(x => !('ziel' in x) && !('fortschritt' in x)));
}
{
  const z = inhalt.figuren.find(f => f.id === 'zaehler')!;
  const n = notizbuch({ ...LEER, orte: ['wanderfigur-zaehler', 'wanderfigur-zaehler:0', 'wanderfigur-zaehler:2'] }, inhalt);
  pruefe('Wanderfigur: je gehörter Station ein Satz, mit dem Ort in Worten',
         n.length === 2 && n[0].wo === z.stationen[0].wo && n[1].text === z.stationen[2].text);
  pruefe('Alter Stand ohne Stationsvermerk: kein Satz statt eines falschen',
         notizbuch({ ...LEER, orte: ['wanderfigur-zaehler'] }, inhalt).length === 0);
  pruefe('Gehörte Stationen: aufsteigend, ohne Doppelte, nur diese Figur',
         JSON.stringify(gehoerteStationen(['wanderfigur-zaehler:2', 'wanderfigur-pegelwartin:1', 'wanderfigur-zaehler:0', 'wanderfigur-zaehler:2'], 'zaehler')) === '[0,2]');
}
pruefe('Unbekannte IDs fallen still heraus',
       notizbuch({ fragmente: ['gibt-es-nicht'], orte: ['weg', 'wanderfigur-niemand:1', 'wanderfigur-zaehler:9'], auftraege: { nix: 'angenommen' } }, inhalt).length === 0);

console.log('\nAufträge aus D392 (content/auftraege):');
const NEU = ['wer-wirklich-kommt', 'die-letzte-kerbe', 'was-im-heft-steht', 'was-am-werkstor-haengt'];
for (const id of NEU) {
  const a = inhalt.auftraege.find(x => x.id === id);
  const f = a && a.ziel.art === 'finde' ? inhalt.fragmente.find(x => x.id === (a.ziel as { fragment: string }).fragment) : undefined;
  pruefe(`${id}: Fundstück vorhanden, Lohn nach Vertrag, Platzhalter markiert`,
         !!a && !!f && f.region === a.region && !!a.lohn && a.lohn.every(k => (LOHNKATEGORIEN as readonly string[]).includes(k)),
         a?.lohn?.join(', ') ?? '');
}
pruefe('Schema lehnt eine Lohnkategorie ausserhalb des Vertrags ab',
       !Auftrag.safeParse({ ...inhalt.auftraege.find(x => x.id === NEU[0])!, lohn: ['gold'] }).success);
{
  const hinweise = ['pegellatte', 'mulde-im-heu', 'boot-kieloben', 'opferstock', 'huettenbuch', 'werkstor-aushang', 'tuer-im-schlamm'];
  pruefe('Sieben neue Fundstücke liegen im Œntal',
         hinweise.every(id => inhalt.fragmente.some(f => f.id === id && f.region === 'oental')));
  // Das Rätsel am Schuppen (Traversal v2 §5) ist nur lösbar, wenn beide Hälften in der Welt stehen.
  const tafel = inhalt.fragmente.find(f => f.id === 'absetzbecken')!, spind = inhalt.fragmente.find(f => f.id === 'boot-kieloben')!;
  pruefe('Spind-Rätsel: Zahl steht am Absetzbecken, das Schloss hat vier Räder',
         tafel.text.includes('09/41') && spind.text.includes('vier Zahlenrädern') && spind.text.includes('FREIGABE') && tafel.text.includes('FREIGABE'));
}

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if (fehler > 0) process.exit(1);
