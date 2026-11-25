/**
 * BRACHLAND — Belohnungen und Aufwertungs-Ökonomie (D393). Geprüft wird die Regel, nicht die Zahl:
 * Jede Kategorie des Vertrags löst sich auf, kein Unikat wird zweimal vergeben, beim Tod bleibt nur
 * loses Material liegen, und keine kämpfende Spielweise schlägt eine andere auf beiden Achsen.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { Belohnungen, Oekonomie, Gegenstand, ReinigenDaten, Techniken, Wirken, Waffenfamilienplan, BELOHNUNGS_KATEGORIEN, BELOHNUNGS_RAENGE } from '../src/data/schema.js';
import { verteile, loeseMenge, istUnikat, lege, type Vergabe } from '../src/spiel/belohnung.js';
import { braue, bilanz, zaehlerStand, SPIELWEISEN, markenStufe, fassung, revierRuhig, schmiedeAus, flasche, todesverlust, reicht, ziehe } from '../src/spiel/oekonomie.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++; console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}
const lies = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const t = Belohnungen.parse(lies('content/belohnungen.json'));
const o = Oekonomie.parse(lies('content/oekonomie.json'));
const rein = ReinigenDaten.parse(lies('content/reinigen.json'));
const gegenstaende = readdirSync('content/gegenstaende').filter(f => f.endsWith('.json'))
  .map(f => Gegenstand.parse(lies(`content/gegenstaende/${f}`)));
const marke = { start: rein.fassung.start, jeRegent: rein.fassung.jeRegent, ladung: rein.ladung, ladungVerhaertet: rein.verhaertet.ladung };

// --- Vertrag mit D392: jede Kategorie löst sich auf mindestens einer Sprosse auf
for (const k of BELOHNUNGS_KATEGORIEN) {
  const irgendwo = BELOHNUNGS_RAENGE.some(rang =>
    verteile(t, [{ schluessel: 'probe', kategorie: k, rang, region: 'oental' }])[0].ok);
  pruefe(`Kategorie ${k} löst sich auf`, irgendwo);
}
const v = (schluessel: string, kategorie: Vergabe['kategorie'], rang: Vergabe['rang'], wunsch?: string): Vergabe =>
  ({ schluessel, kategorie, rang, region: 'oental', wunsch });

// --- Mengenware
const span = loeseMenge(t, v('a', 'aufwertung-1', 'nebenaufgabe'));
pruefe('aufwertung-1 gibt Chitinspan', !!span && span.chitinspan === 3, JSON.stringify(span));
pruefe('Stufe 3 liegt nicht an kleinen Entdeckungen', loeseMenge(t, v('a', 'aufwertung-3', 'entdeckung')) === null);
pruefe('Stufe 4 gibt nur der Regent', BELOHNUNGS_RAENGE.filter(r => loeseMenge(t, v('a', 'aufwertung-4', r))).join() === 'regent');
const zweimal = [loeseMenge(t, v('die-runde', 'verbrauch', 'nebenaufgabe')), loeseMenge(t, v('die-runde', 'verbrauch', 'nebenaufgabe'))];
pruefe('derselbe Schlüssel gibt dasselbe', JSON.stringify(zweimal[0]) === JSON.stringify(zweimal[1]));
const sorten = new Set(Array.from({ length: 40 }, (_, i) => Object.keys(loeseMenge(t, v(`auftrag-${i}`, 'verbrauch', 'nebenaufgabe'))!)[0]));
pruefe('verschiedene Schlüssel geben nicht alle dasselbe', sorten.size >= 3, [...sorten].join());
pruefe('Wunsch wird erfüllt, wenn die Sprosse ihn hergibt', loeseMenge(t, v('x', 'verbrauch', 'figurenlinie', 'herzfunke'))?.herzfunke === 1);
pruefe('Wunsch ausserhalb der Sprosse gibt nichts', loeseMenge(t, v('x', 'verbrauch', 'entdeckung', 'herzfunke')) === null);

// --- Unikate: nie zweimal
const vier = verteile(t, ['d', 'b', 'a', 'c'].map(s => v(s, 'werkzeug', 'nebenaufgabe')));
const stuecke = vier.flatMap(a => a.ok ? Object.keys(a.belohnung) : []);
pruefe('vier Werkzeuge, vier verschiedene', stuecke.length === 4 && new Set(stuecke).size === 4, stuecke.join());
pruefe('Ergebnis in der Reihenfolge der Anfrage', vier.map(a => a.schluessel).join() === 'd,b,a,c');
const fuenf = verteile(t, ['a', 'b', 'c', 'd', 'e'].map(s => v(s, 'werkzeug', 'nebenaufgabe')));
pruefe('das fünfte Werkzeug gibt es nicht', fuenf.filter(a => !a.ok).length === 1 && !fuenf[4].ok);
const gewuenscht = verteile(t, [v('a', 'werkzeug', 'nebenaufgabe'), v('z', 'werkzeug', 'nebenaufgabe', 'kletterzeug')]);
pruefe('der Wunsch geht vor', gewuenscht[1].ok && gewuenscht[1].belohnung.kletterzeug === 1
  && gewuenscht[0].ok && !('kletterzeug' in gewuenscht[0].belohnung));
const doppelt = verteile(t, [v('a', 'werkzeug', 'nebenaufgabe', 'gleiter'), v('b', 'werkzeug', 'optionaler-boss', 'gleiter')]);
pruefe('derselbe Wunsch zweimal ist ein Fehler', doppelt.filter(a => a.ok).length === 1);
pruefe('schon Vergebenes kommt nicht wieder', verteile(t, [v('a', 'waffe', 'nebenaufgabe')], ['fundwaffe-axt'])[0]
  .ok && 'fundwaffe-speer' in (verteile(t, [v('a', 'waffe', 'nebenaufgabe')], ['fundwaffe-axt'])[0] as any).belohnung);
pruefe('fremde Region hat keinen Vorrat', !verteile(t, [{ ...v('a', 'zugang', 'nebenaufgabe'), region: 'fahlmoos' }])[0].ok);
pruefe('Unikat und Mengenware sind getrennt', istUnikat(t, 'ruestung') && !istUnikat(t, 'marke'));
pruefe('lege summiert', JSON.stringify(lege({ a: 1, b: 2 }, { b: 1 })) === '{"a":1,"b":3}');

// --- Die zwei Werkzeug-Aufträge aus D391 tragen echte Werkzeuge
for (const [auftrag, werkzeug] of [['was-noch-drin-liegt', 'kletterzeug'], ['ein-schwieriger-nachbar', 'halfter']] as const) {
  const a = lies(`content/auftraege/${auftrag}.json`);
  pruefe(`${auftrag} gibt ${werkzeug}`, a.belohnung[werkzeug] === 1 && gegenstaende.find(g => g.id === werkzeug)?.wirkung.art === 'werkzeug');
}

// --- Marke
pruefe('Markenstufe zählt erreichte Schwellen', markenStufe(0, o) === 0 && markenStufe(o.marke.schwellen[0], o) === 1
  && markenStufe(1e6, o) === o.marke.schwellen.length);
pruefe('Fassung: Grundwert + Regenten + Stufen', fassung(0, 0, marke, o) === 4 && fassung(0, 1, marke, o) === 6
  && fassung(o.marke.schwellen[1], 1, marke, o) === 8);
pruefe('leergetötet ist nicht ruhig', !revierRuhig(0, 20, 20, o));
pruefe('ein einzelner Griff befriedet nichts', !revierRuhig(1, 0, 20, o));
pruefe('überwiegend gereinigt ist ruhig', revierRuhig(6, 2, 20, o));
pruefe('überwiegend getötet ist nicht ruhig', !revierRuhig(6, 8, 20, o));

// --- Schmiede und Flasche
pruefe('reicht/ziehe', reicht({ a: 2 }, { a: 2 }) && !reicht({ a: 3 }, { a: 2 }) && ziehe({ a: 2 }, { a: 5, b: 1 }).a === 3);
const s1 = o.schmiede[0].preis, s2 = o.schmiede[1].preis;
pruefe('ohne Material keine Stufe', schmiedeAus({}, o).stufen.join() === '0,0,0');
pruefe('genau Stufe 1', schmiedeAus(s1, o).stufen[0] === 1 && Object.values(schmiedeAus(s1, o).rest).every(n => n === 0));
pruefe('Stufe 3 braucht Härtlinge', schmiedeAus({ chitinspan: 99, federstahl: 99 }, o).stufen[0] === 2);
pruefe('Vorschlagsstufe zählt nur auf Wunsch', schmiedeAus({ chitinspan: 99, federstahl: 99, haertling: 99, kernschlacke: 9 }, o).stufen[0] === 3
  && schmiedeAus({ chitinspan: 99, federstahl: 99, haertling: 99, kernschlacke: 9 }, o, 1, true).stufen[0] === 4);
pruefe('Stufen werden teurer', Object.values(s2).reduce((a, b) => a + b, 0) > Object.values(s1).reduce((a, b) => a + b, 0));
const f0 = flasche({}, o), fVoll = flasche({ setzling: 99, quellwasser: 99 }, o);
pruefe('Flasche beginnt mit den Startwerten', f0.schlucke === o.flasche.schlucke.start && f0.staerke === o.flasche.staerke.start);
pruefe('Flasche ist gedeckelt', fVoll.schlucke === o.flasche.schlucke.max
  && Math.abs(fVoll.staerke - (o.flasche.staerke.start + o.flasche.staerke.stufen * o.flasche.staerke.jeStufe)) < 1e-9);

// --- Tod: nur loses Material bleibt liegen
const tod = todesverlust({ chitinspan: 7, federstahl: 2, haertling: 1, kletterzeug: 1, harzverband: 2, unbekannt: 3, leer: 0 }, gegenstaende);
pruefe('Bündel = Span und Federstahl', JSON.stringify(tod.buendel) === '{"chitinspan":7,"federstahl":2}', JSON.stringify(tod.buendel));
pruefe('Härtling, Werkzeug, Vorrat und Unbekanntes bleiben', tod.behalten.haertling === 1 && tod.behalten.kletterzeug === 1
  && tod.behalten.harzverband === 2 && tod.behalten.unbekannt === 3 && !('leer' in tod.behalten));
pruefe('kein Einmaliges kann verloren gehen', gegenstaende.every(g => !(g.einmalig && g.liegtBeiTod)));

// --- Physik (D398): jedes Stück wiegt etwas, und was man an losem Material tragen darf, bleibt tragbar
pruefe('jeder Gegenstand hat ein Gewicht (nur Einsicht wiegt nichts)', gegenstaende.every(g => g.gewicht !== undefined
  && (g.gewicht > 0 || g.wirkung.art === 'erfahrung')));
const lose = gegenstaende.filter(g => g.liegtBeiTod);
pruefe('loses Material hat eine Traglast', lose.length > 0 && lose.every(g => g.traglast !== undefined));
const buendelKg = lose.reduce((kg, g) => kg + g.gewicht! * g.traglast!, 0);
pruefe('ein volles Bündel wiegt höchstens 10 kg', buendelKg <= 10 + 1e-9, `${buendelKg} kg`);
const weste = o.tausch.find(x => 'chitinweste' in x.gibt)!;
pruefe('die Weste wiegt mindestens ihr Material', gegenstaende.find(g => g.id === 'chitinweste')!.gewicht!
  >= weste.nimmt.chitinspan * gegenstaende.find(g => g.id === 'chitinspan')!.gewicht! - 1e-9);

// --- Überschlag Œntal: beide Achsen tragen, keine Spielweise dominiert
const z = Object.fromEntries(SPIELWEISEN.map(w => [w.name, bilanz(w, 'oental', o, marke)]));
const S = z['Schlächter'], G = z['Gemischt'], H = z['Heiler'], U = z['Umgeher'];
pruefe('Schlächter: Hauptwaffe am weitesten, Marke am schwächsten', S.waffen[0] > G.waffen[0] && S.markenStufe < G.markenStufe);
pruefe('Heiler: Marke am weitesten, Waffe am schwächsten der drei', H.markenStufe > G.markenStufe && H.waffen[0] < G.waffen[0]);
pruefe('Heiler kommt trotzdem zu einer Waffenstufe', H.waffen[0] >= 1);
pruefe('Schlächter kommt trotzdem zu einer Markenstufe', S.markenStufe >= 1);
pruefe('nur der Heiler hat ruhige Reviere', H.ruhigeReviere > 0 && S.ruhigeReviere === 0 && G.ruhigeReviere === 0 && U.ruhigeReviere === 0);
pruefe('Material nur von Getöteten', (H.vorrat.haertling ?? 0) === 0 && (H.vorrat.kernschlacke ?? 0) === 0
  && (H.vorrat.chitinspan ?? 0) === Math.floor(o.regionen.oental.einmalig.chitinspan));
const kaempfer = [S, G, H];
const dominiert = kaempfer.some(x => kaempfer.some(y => x !== y && x.waffen[0] >= y.waffen[0] && x.markenStufe >= y.markenStufe
  && (x.waffen[0] > y.waffen[0] || x.markenStufe > y.markenStufe)));
pruefe('keine kämpfende Spielweise schlägt eine andere auf beiden Achsen', !dominiert,
  kaempfer.map(b => `${b.name} ${b.waffen[0]}/${b.markenStufe}`).join(', '));
pruefe('Bilanz geht auf', [S, G, H, U].every(b => Math.abs(b.getoetet + b.gereinigt + b.umgangen - o.regionen.oental.annahmen.tiere) <= 2));
pruefe('der Heiler kann jeden Verhärteten reinigen', H.verhaerteteGereinigt === o.regionen.oental.annahmen.verhaertete);

// --- D400: Fortschritt der Spielfigur — Vitalwerte über Sude, Erfahrung über Aufträge, nie über Kämpfe
pruefe('vital und erfahrung sind Mengenware', !istUnikat(t, 'vital') && !istUnikat(t, 'erfahrung'));
pruefe('kein Bruchstück und keine Einsicht an kleinen Entdeckungen oder vom Boss selbst',
  (['entdeckung', 'optionaler-boss'] as const).every(r => !loeseMenge(t, v('a', 'vital', r)) && !loeseMenge(t, v('a', 'erfahrung', r))));
pruefe('eine Figurenlinie gibt mehr Einsicht als eine Nebenaufgabe',
  loeseMenge(t, v('a', 'erfahrung', 'figurenlinie'))!.einsicht > loeseMenge(t, v('a', 'erfahrung', 'nebenaufgabe'))!.einsicht);
pruefe('kein Gegenstand mit Einsicht fällt als Beute', gegenstaende.filter(g => g.wirkung.art === 'erfahrung').every(g => g.beuteChance === 0)
  && ![o.beute.tier, o.beute.mensch, o.beute.verhaerteter, o.beute.regent].some(b => b.gegenstand === 'einsicht'));
const leb = o.brauen.dauersude.find(d => d.wert === 'leben')!, atem = o.brauen.dauersude.find(d => d.wert === 'ausdauer')!;
const voll = { meisterwurz: 99, enzianwurzel: 99 };
pruefe('ohne Bossteil kein Dauersud', braue(voll, o).plus.leben === 0 && braue(voll, o).plus.ausdauer === 0);
pruefe('ohne Bruchstücke kein Dauersud', braue({ mark: 9, abwurf: 9 }, o).plus.leben === 0);
pruefe('Mark trägt nur den Lebenssud', braue({ ...voll, mark: 2 }, o).plus.leben === 2 * leb.plus && braue({ ...voll, mark: 2 }, o).plus.ausdauer === 0);
pruefe('Abwurf trägt beide', braue({ ...voll, abwurf: 1 }, o).plus.ausdauer === atem.plus
  && braue({ meisterwurz: 99, abwurf: 1 }, o).plus.leben === leb.plus);
const beides = braue({ ...voll, mark: 1, abwurf: 1 }, o);
pruefe('Mark geht in den Lebenssud, Abwurf bleibt für die Ausdauer', beides.plus.leben === leb.plus && beides.plus.ausdauer === atem.plus);
pruefe('Dauersude sind gedeckelt', braue({ ...voll, abwurf: 99, mark: 99 }, o).anzahl[leb.id] === leb.hoechstens);
pruefe('ein Sud kostet drei Bruchstücke und ein Bossteil — vier Teile', Object.values(leb.preis).reduce((a, b) => a + b, 0) + 1 === 4);
pruefe('Beigaben sind Zutaten mit Traglast', o.brauen.beigaben.every(b => {
  const g = gegenstaende.find(x => x.id === b.gegenstand);
  return !!g && g.wirkung.art === 'zutat' && g.wirkung.fuer === 'beigabe' && g.traglast !== undefined;
}));

const techniken = Techniken.parse(lies('content/techniken.json'));
pruefe('acht bis zwölf Techniken in drei Zweigen', techniken.length >= 8 && techniken.length <= 12
  && new Set(techniken.map(x => x.zweig)).size === 3);
pruefe('wer einen geprüften Wert berührt, nennt die Messung', techniken.every(x => ['anzeige', 'welt'].includes(x.beruehrt) || !!x.messung));
pruefe('mindestens vier Techniken berühren keinen geprüften Wert', techniken.filter(x => ['anzeige', 'welt'].includes(x.beruehrt)).length >= 4);
pruefe('Schema lehnt eine Kampfwert-Technik ohne Messung ab', !Techniken.safeParse([{ id: 'x', name: 'X', zweig: 'kampf', kosten: 1, wirkung: 'w', beruehrt: 'kampfwert' }]).success);
const technikKosten = techniken.reduce((n, x) => n + x.kosten, 0);
pruefe('ein Kapitel kauft nicht alle Techniken', [S, G, H, U].every(b => b.einsicht < technikKosten), `${technikKosten}`);
pruefe('jede Spielweise kann sich mindestens drei Techniken leisten', [S, G, H, U].every(b => b.einsicht >= 5));

pruefe('Töten gibt die Bossteile sofort, aber nur Mark', S.mark > 0 && S.abwurf === 0 && S.ausdauerPlus === 0 && S.lebenPlus > 0);
pruefe('wer reinigt, kann beide Vitalwerte heben', H.ausdauerPlus > 0 && H.lebenPlus > 0 && H.mark === 0);
pruefe('Vitalwerte hängen an Bruchstücken, nicht an der Zahl der Getöteten', S.lebenPlus <= H.lebenPlus + H.ausdauerPlus
  && S.lebenPlus <= Math.floor(o.regionen.oental.einmalig.meisterwurz / leb.preis.meisterwurz) * leb.plus);
pruefe('leergetötete Reviere ziehen Verhärtete nach, ruhige nicht', S.nachgewandert > 0 && S.leereReviere > 0 && H.nachgewandert === 0 && H.leereReviere === 0);
pruefe('wer Figuren verliert, verliert Einsicht', S.einsicht < H.einsicht && S.linien < H.linien);
// D404/D405: Der Zähler wiegt Reinigen leichter — Schwelle und Gewichte aus dem Inhalt.
const zb = lies('content/wanderfiguren/zaehler.json').stationen.map((x: any) => x.bis).find((x: any) => x?.art === 'eingriffe' || x?.art === 'misstraut');
const stand = (b: typeof S) => zaehlerStand(b, zb.gewichte);
pruefe('der Zähler trägt Gewichte, Reinigen leichter als Töten', zb.gewichte.gereinigt < zb.gewichte.getoetet);
pruefe('ungewichtet läge nur der Umgeher unter der Schwelle', U.eingriffe <= zb.anzahl && [S, G, H].every(b => b.eingriffe > zb.anzahl));
// D410: Ohne die Kontroll-Wirken reinigt der Heiler wieder mehr — er liegt jetzt knapp um die Schwelle.
pruefe('gewichtet bleibt der Umgeher klar darunter, wer tötet klar darüber, der Heiler in ±5 um die Schwelle', stand(U) <= zb.anzahl / 2 && stand(S) > zb.anzahl && stand(G) > zb.anzahl && Math.abs(stand(H) - zb.anzahl) <= 5,
  [S, G, H, U].map(b => `${b.name} ${stand(b).toFixed(0)}`).join(', '));
pruefe('der Umgeher liegt weiter unter der Schwelle als der Heiler', stand(U) < stand(H));
pruefe('zaehlerStand: ein Getöteter wiegt wie vier Gereinigte', zaehlerStand({ getoetet: 1, gereinigt: 0, verhaerteteGetoetet: 0, verhaerteteGereinigt: 0 }, zb.gewichte)
  === zaehlerStand({ getoetet: 0, gereinigt: 3, verhaerteteGetoetet: 0, verhaerteteGereinigt: 1 }, zb.gewichte));

// D405: Wirken der Marke kostet Ladungen, die dem Reinigen fehlen
const wirken = Wirken.parse(lies('content/wirken.json'));
const gilt = wirken.filter(x => x.status === 'gilt'), ersetzt = wirken.filter(x => x.status === 'ersetzt');
pruefe('D410: nur Sinnes- und Welt-Wirken gelten noch (Lesen, Rufen)', gilt.map(x => x.id).sort().join() === 'lesen,rufen' && gilt.every(x => ['anzeige', 'welt'].includes(x.beruehrt)));
pruefe('D410: fünf Wirken sind ersetzt und sagen, wodurch', ersetzt.length === 5 && ersetzt.every(x => !!x.ersetztDurch));
pruefe('D410: Reinigen aus der Ferne gibt es nicht mehr', wirken.find(x => x.id === 'nachhall')!.status === 'ersetzt');
pruefe('Schema lehnt ein geltendes Wirken mit Kampfwert ab (keine Magie)', !Wirken.safeParse([{ id: 'x', name: 'X', ladungen: 1, markenStufe: 0, einsicht: 1, wirkung: 'w', werk: 'w', beruehrt: 'kampfwert', messung: 'm' }]).success);
pruefe('jedes Wirken kostet Ladungen und Einsicht', wirken.every(x => x.ladungen >= 1 && x.einsicht >= 1));
const ohne = bilanz({ ...SPIELWEISEN[2], wirken: 0 }, 'oental', o, marke), mit = bilanz({ ...SPIELWEISEN[2], wirken: 0.3 }, 'oental', o, marke);
pruefe('wer wirkt, reinigt weniger', mit.gereinigt < ohne.gereinigt && mit.laeuterung < ohne.laeuterung && mit.wirkenLadungen > 0 && ohne.wirkenLadungen === 0);
pruefe('D410: der Schlächter gibt keine Ladung mehr fürs Wirken aus', S.wirkenLadungen === 0 && S.gereinigt === 0);

// D405: Waffenfamilien
const wf = Waffenfamilienplan.parse(lies('content/waffenfamilien.json'));
const aktiv = wf.familien.filter(x => x.status !== 'zurueckgestellt');
pruefe('sechs bis acht Familien, etwa fünf in Kapitel 1 (D404)', aktiv.length >= 6 && aktiv.length <= 8 && aktiv.filter(x => x.kapitel === 1).length >= 4 && aktiv.filter(x => x.kapitel === 1).length <= 6,
  `${aktiv.length} / ${aktiv.filter(x => x.kapitel === 1).length}`);
pruefe('die drei Bestandsfamilien fehlen nichts an Clips', wf.familien.filter(x => x.status === 'bestand').length === 3 && wf.familien.filter(x => x.status === 'bestand').every(x => x.clips.fehlen.length === 0));
pruefe('jede neue Familie sagt, was an Clips fehlt oder dass nichts fehlt', wf.familien.filter(x => x.status === 'entwurf').every(x => x.clips.vorhanden.length + x.clips.fehlen.length > 0));
pruefe('Fernwaffen spannen nur im Stand', wf.fernkampf.waffen.every(x => !x.inBewegung));
pruefe('es gibt ein Geschoss, das mehr Haltung als Schaden nimmt (Kolbenpfeil)', wf.fernkampf.geschosse.some(g => g.haltung > 1 && g.schaden < 1 && !('federstahl' in g.preis)));

const achsenBei = (schwelle: number) => (b: typeof S) => [b.waffen[0], b.markenStufe, b.lebenPlus, b.ausdauerPlus, b.einsicht, stand(b) <= schwelle ? 1 : 0];
const alle = [S, G, H, U];
const schlaegtBei = (schwelle: number) => { const ax = achsenBei(schwelle);
  return alle.filter(x => alle.some(y => x !== y && ax(x).every((w, i) => w >= ax(y)[i]) && ax(x).some((w, i) => w > ax(y)[i]))).map(x => x.name); };
// Befund D405: Mit Reinigen × 0,25 bleibt bei der heutigen Schwelle (40) auch der Heiler darunter — er hat dann
// alles, was der Umgeher hat, und mehr. Bei 30 trennt der Zähler die beiden wieder. Die Schwelle ist Flos Entscheidung
// (A-32); der Test hält fest, was bei welcher Schwelle gilt, statt die Daten vorwegzunehmen.
pruefe('Befund: liegt der Heiler unter der Schwelle, schlägt er den Umgeher auf allen Achsen', schlaegtBei(Math.ceil(stand(H))).join() === 'Heiler', schlaegtBei(Math.ceil(stand(H))).join());
pruefe('bei Schwelle 30 schlägt keine der vier Spielweisen eine andere auf allen sechs Achsen', schlaegtBei(30).length === 0,
  alle.map(b => `${b.name} ${achsenBei(30)(b).join('/')}`).join(', '));
pruefe('ohne die Achse der Mönche schlägt nur der Umgeher niemanden und wird geschlagen', (() => {
  const ax = (b: typeof S) => [b.waffen[0], b.markenStufe, b.lebenPlus, b.ausdauerPlus, b.einsicht];
  const k = [S, G, H]; return !k.some(x => k.some(y => x !== y && ax(x).every((w, i) => w >= ax(y)[i]) && ax(x).some((w, i) => w > ax(y)[i]))); })());

console.log(`  Œntal: ${[S, G, H, U].map(b => `${b.name} Waffe ${b.waffen[0]} / Marke ${b.markenStufe}`).join(' · ')}`);
console.log(`\n${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
