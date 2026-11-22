/**
 * BRACHLAND — Geräte mit Elementangriffen (D410). Geprüft wird, dass die Geräte das **vorhandene**
 * Elementsystem benutzen (derselbe Kreis, dieselbe Dämpfung wie der Kernfunke), dass sie Nahbereich
 * bleiben, und dass es Geräte gibt, die nicht töten können — die des Heilers.
 */
import { readFileSync } from 'node:fs';
import { ELEMENTE, Geraete, Gegenstand, schadensfaktor, type Element } from '../src/data/schema.js';
import { funkenFaktor, KEILER, GRATHORN, WOLF, FUCHS, GAMS, WAFFEN } from '../src/kampf/echtzeit.js';
import { einsaetze, elementFaktor, staerkste, toetet, trifft, wirkung } from '../src/kampf/geraete.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++; console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}
const lies = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const geraete = Geraete.parse(lies('content/geraete.json'));
const TIERE = { keiler: KEILER, grathorn: GRATHORN, wolf: WOLF, fuchs: FUCHS, gams: GAMS };

// --- Kein zweites Elementsystem
pruefe('jedes Gerät trägt ein Element aus ELEMENTE, keines doppelt', geraete.every(g => ELEMENTE.includes(g.element))
  && new Set(geraete.map(g => g.element)).size === geraete.length);
for (const e of ['wasser', 'stein'] as const) for (const [name, t] of Object.entries(TIERE))
  pruefe(`Dämpfung wie der Kernfunke: ${e} gegen ${name}`, Math.abs(elementFaktor(e, t.elemente) - funkenFaktor(e, t)) < 1e-12);
pruefe('der Faktor ist die Wurzel des Kreisfaktors', ELEMENTE.every(a => ELEMENTE.every(d =>
  Math.abs(elementFaktor(a, [d]) - Math.sqrt(schadensfaktor(a, [d]))) < 1e-12)));
pruefe('ohne Element (Mensch) wirkt jedes Gerät neutral', geraete.every(g => elementFaktor(g.element, undefined) === 1));

// --- Schwächen der fünf Tiere, abgeleitet aus dem Bestand (content/gegner/*.json `elemente`)
const stark = (tier: keyof typeof TIERE) => ELEMENTE.filter(e => wirkung(e, TIERE[tier].elemente) === 'stark').sort().join();
pruefe('Keiler (holz): schwach gegen frost und faeulnis', stark('keiler') === 'faeulnis,frost', stark('keiler'));
pruefe('Grathorn und Gams (stein): schwach gegen holz und faeulnis', stark('grathorn') === 'faeulnis,holz' && stark('gams') === 'faeulnis,holz');
pruefe('Fuchs (alt-tech): schwach gegen holz und stein', stark('fuchs') === 'holz,stein', stark('fuchs'));
pruefe('Wolf (alt-tech + frost): schwach gegen stein und brand', stark('wolf') === 'brand,stein', stark('wolf'));
const kapitel1 = geraete.filter(g => g.status === 'kapitel-1');
pruefe('vier Geräte in Kapitel 1', kapitel1.length === 4, kapitel1.map(g => g.id).join());
for (const tier of Object.keys(TIERE) as (keyof typeof TIERE)[])
  pruefe(`gegen ${tier} wirkt in Kapitel 1 ein Gerät stark`, kapitel1.some(g => wirkung(g.element, TIERE[tier].elemente) === 'stark'),
    kapitel1.map(g => `${g.id} ${wirkung(g.element, TIERE[tier].elemente)}`).join(', '));
pruefe('kein Gerät aus Kapitel 1 wirkt gegen alle fünf Tiere stark', kapitel1.every(g => Object.values(TIERE).some(t => wirkung(g.element, t.elemente) !== 'stark')));
pruefe('gegen den Keiler ist der Löscher das stärkste Gerät des Kapitels', staerkste(kapitel1, [...KEILER.elemente!]).join() === 'loescher');

// --- Nahbereich: Geräte ergänzen den Nahkampf (D406: Fernkampf erst nach Kapitel 1)
const weitesterHieb = Math.max(...Object.values(WAFFEN).flatMap(w => [...w.leicht, w.schwer, w.lauf].map(s => s.reichweite)));
pruefe('kein Aufsatz reicht weiter als der weiteste Hieb', geraete.every(g => g.aufsaetze.every(a => a.reichweite <= weitesterHieb)), `${weitesterHieb}`);
pruefe('kein Aufsatz trifft härter als 1,5 leichte Hiebe, bevor der Kreis greift', geraete.every(g => g.aufsaetze.every(a => a.schaden <= 1.5)));
pruefe('je Gerät zwei bis drei Aufsätze', geraete.every(g => g.aufsaetze.length >= 2 && g.aufsaetze.length <= 3));

// --- Verhältnis zum Reinigen: es gibt Geräte, die nicht töten können
const nieToedlich = geraete.filter(g => g.aufsaetze.every(a => !toetet(a)));
pruefe('die Räucherkanne kann nicht töten', nieToedlich.some(g => g.id === 'raeucherkanne'));
pruefe('der Löscher hat Aufsätze ohne Schaden, die verlangsamen', geraete.find(g => g.id === 'loescher')!.aufsaetze.filter(a => !toetet(a) && a.zustand === 'verlangsamt').length >= 2);
pruefe('das Abflammgerät tötet mit jedem Aufsatz', geraete.find(g => g.id === 'abflammgeraet')!.aufsaetze.every(toetet));
pruefe('wer nicht töten will, hat in Kapitel 1 zwei Geräte', kapitel1.filter(g => g.aufsaetze.some(a => !toetet(a) && !!a.zustand)).length >= 2);
const kanne = geraete.find(g => g.id === 'raeucherkanne')!, rauch = kanne.aufsaetze[0];
pruefe('Rauch hält gegen ein Stein-Tier länger als gegen den Keiler', trifft(kanne, rauch, GAMS.elemente).zustandSek > trifft(kanne, rauch, KEILER.elemente).zustandSek);

// --- Speisung: Betriebsstoff je Gerät, als Gegenstand mit Traglast
for (const g of geraete.filter(x => x.status !== 'geparkt')) {
  const stoff = Gegenstand.safeParse(lies(`content/gegenstaende/${g.betriebsstoff.gegenstand}.json`));
  pruefe(`${g.id}: Betriebsstoff ${g.betriebsstoff.gegenstand} gibt es`, stoff.success);
  pruefe(`${g.id}: jeder Aufsatz löst mindestens zweimal je Füllung aus`, g.aufsaetze.every(a => einsaetze(g, a) >= 2), g.aufsaetze.map(a => einsaetze(g, a)).join());
}
pruefe('was tötet, läuft auf Altbestand; was nicht tötet, wächst nach', geraete.filter(g => g.status !== 'geparkt').every(g =>
  g.aufsaetze.every(a => !toetet(a)) ? g.betriebsstoff.nachschub === 'nachwachsend' : true)
  && geraete.find(g => g.id === 'abflammgeraet')!.betriebsstoff.nachschub === 'altbestand');
pruefe('jedes Gerät nennt Wirklichkeit, Abweichung und Risiko', geraete.every(g => g.real.length > 30 && g.abweichung.length > 20 && g.risiko.length > 20));
pruefe('Schema lehnt ein zweites Gerät desselben Elements ab', !Geraete.safeParse([...geraete.slice(0, 5), { ...geraete[0], id: 'zweites' }]).success);
pruefe('Schema lehnt einen Aufsatz über 4 m ab', !Geraete.safeParse(geraete.map((g, i) => i ? g : { ...g, aufsaetze: g.aufsaetze.map(a => ({ ...a, reichweite: 9 })) })).success);

const elementeDerGeraete: Element[] = geraete.map(g => g.element);
console.log(`  Geräte: ${geraete.map(g => `${g.name} (${g.element})`).join(', ')} — ${elementeDerGeraete.length} von ${ELEMENTE.length} Elementen`);
console.log(`\n${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
