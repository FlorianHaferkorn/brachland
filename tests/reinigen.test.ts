/**
 * BRACHLAND — Reinigen als Kampfhandlung (D376, Story-Bibel v2 §2).
 *
 * Was hier festgehalten wird:
 *   * Der Schalter: Ohne `Kampfwelt.marke` gibt es die Handlung nicht, und eine Marke, die niemand
 *     benutzt, ändert keinen Teilschritt des Kampfs.
 *   * Das Fenster: erst niedergerungen (Leben ≤ Schwelle), dann betäubt, in der Erholung oder lauernd.
 *     Menschen nie, Verhärtete nur mit Reinkultur, nichts ohne Ladung.
 *   * Der Griff: Die Marke hält `halten` s, der Fortschritt bleibt am Tier und verfällt, mehrere
 *     Griffe reinigen. Das Ergebnis heisst „gereinigt“, nicht „besiegt“.
 *   * Das Risiko: Ein Treffer im Kanal wiegt mehr, bricht ihn und kostet Fortschritt; Lösen dauert.
 *   * Das Band aus `tools/reinigensim.ts`: Reinigen ist langsamer und im Rudel teurer, aber nie
 *     aussichtslos. Die volle Messreihe (1.000 Kämpfe je Zeile) steht im Entwurf
 *     `docs/design/BRACHLAND_Reinigen_v1.md`; hier läuft ein kleines Band als Tor.
 *   * D389 — Dauer je Gegner: Jedes Tier in `content/gegner/` trägt `reinigen` (Kanaldauer, Griffdauer),
 *     die Griffzahl bleibt im Band aus `content/reinigen.json`, die Regeln lesen die Werte des Gegners
 *     und fallen ohne sie auf die Grössenformel zurück. Menschen nie — ausser freiwillig befallen (D385).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SPIELERIN, FUCHS, WOLF, KEILER, GAMS, WEGELAGERER, UEBUNGSGEGNER, REINIGEN, SCHRITT,
  neuerKaempfer, blickAuf, simuliere, puffere, angriffsrecht,
  neueMarke, kannReinigen, setzeReinigenAn, loeseReinigen, reinigungsDauer, reinigungsHalten, reinigungsGriffe, reinigungsLadung, istBefallen,
  type Kaempfer, type Kampfwelt, type KampfWerte,
} from '../src/kampf/echtzeit.js';
import { ReinigenDaten, GegnerDaten } from '../src/data/schema.js';
import { simuliereZeile, simuliereGegner, bewerte, ohneEigeneWerte, TIERE, ZIELKORRIDOR, type SimZeile } from '../tools/reinigensim.js';
import { PROFILE } from '../tools/kampfbot.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}
const nah = (a: number, b: number, eps = 0.02) => Math.abs(a - b) <= eps;

const W = REINIGEN;

/** Spielerin bei 0/0, ein Gegner 1,5 m vor ihr, ihr zugewandt. `friedlich`: Er denkt nicht, seine Uhren laufen. */
function lage(werte: KampfWerte, mitMarke = true, weitere: KampfWerte[] = []): { w: Kampfwelt; s: Kaempfer; g: Kaempfer } {
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  const g = neuerKaempfer('g0', werte, 0, -1.5, 0);
  g.blick = blickAuf(g.x, g.z, 0, 0);
  const rest = weitere.map((x, i) => {
    const k = neuerKaempfer(`g${i + 1}`, x, 1.6, 0.2, 0);
    k.blick = blickAuf(k.x, k.z, 0, 0);
    return k;
  });
  const w: Kampfwelt = { spielerin: s, gegner: [g, ...rest], ziel: 'g0', friedlich: true };
  if (mitMarke) w.marke = neueMarke();
  return { w, s, g };
}
const wund = (g: Kaempfer) => { g.leben = g.werte.lebenMax * W.wundAb * 0.9; };
const inErholung = (g: Kaempfer) => { g.phase = 'erholung'; g.zeit = 0; g.schlag = g.werte.schlag; g.folge = []; };
const laufe = (w: Kampfwelt, sekunden: number) => { for (let t = 0; t < sekunden - 1e-9; t += SCHRITT) simuliere(w, SCHRITT); };

// ---------------------------------------------------------------- Daten
pruefe('content/reinigen.json besteht das Schema', ReinigenDaten.safeParse(W).success);
pruefe('die Marke hält kürzer, als die kleinste Reinigung dauert (mehr als ein Griff)',
  Object.values(TIERE).every(t => { const k = neuerKaempfer('x', t, 0, 0); return reinigungsHalten(W, k) < reinigungsDauer(W, k); }));
pruefe('wund liegt nicht über der Schwelle', W.wundAb <= W.schwelle);
pruefe('Lösen ist schneller als jeder Vorlauf, aber nicht umsonst', W.loesen > 0 && W.loesen < FUCHS.schlag.vorlauf);

// ---------------------------------------------------------------- Der Schalter
{
  const { w, g } = lage(FUCHS, false);
  wund(g); inErholung(g);
  pruefe('ohne Marke: nicht greifbar', !kannReinigen(w, g) && !setzeReinigenAn(w));
  pruefe('ohne Marke: die Spielerin bleibt bereit', w.spielerin.phase === 'bereit');
}
{
  // Derselbe Kampf mit und ohne (unbenutzte) Marke: jeder Teilschritt gleich.
  const spur = (mitMarke: boolean) => {
    const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
    const a = neuerKaempfer('g0', WOLF, 0.5, -6, 0), b = neuerKaempfer('g1', KEILER, -3, -7, 0);
    const w: Kampfwelt = { spielerin: s, gegner: [a, b], ziel: 'g0' };
    if (mitMarke) w.marke = neueMarke();
    const raus: string[] = [];
    for (let i = 0; i < 120 * 12; i++) {
      if (i % 90 === 10) puffere(s, 'leicht');
      if (i % 240 === 150) puffere(s, 'rolle', 1, 0);
      const e = simuliere(w, SCHRITT);
      raus.push(JSON.stringify([s.x, s.z, s.leben, s.phase, s.ausdauer.wert, a.x, a.z, a.leben, a.phase, b.x, b.z, b.leben, b.phase, e]));
    }
    return raus.join('\n');
  };
  pruefe('eine unbenutzte Marke ändert keinen Teilschritt (12 s, zwei Gegner)', spur(false) === spur(true));
}

// ---------------------------------------------------------------- Das Fenster
{
  const { w, g } = lage(FUCHS);
  inErholung(g);
  pruefe('über der Schwelle: nicht greifbar, auch nicht in der Erholung', !kannReinigen(w, g));
  g.phase = 'betaeubt'; g.zeit = 0;
  pruefe('über der Schwelle: auch betäubt nicht (erst niederringen)', W.schwelle >= 1 || !kannReinigen(w, g));
  wund(g);
  pruefe('wund und betäubt: greifbar', kannReinigen(w, g));
  inErholung(g);
  pruefe('wund und in der Erholung: greifbar', kannReinigen(w, g));
  g.folge = [g.werte.schlag];
  pruefe('mitten in der Kette: nicht greifbar', !kannReinigen(w, g));
  g.folge = []; g.phase = 'vorlauf';
  pruefe('wund, aber holt aus: nicht greifbar', !kannReinigen(w, g));
  g.phase = 'bereit';
  pruefe('wund und bereit, allein: nicht greifbar (allein lauert keiner)', !kannReinigen(w, g));
  w.atem = 0.5;
  pruefe('wund und lauernd, während die Meute Atem holt: greifbar', kannReinigen(w, g));
  w.atem = 0; inErholung(g);
  g.z = -(W.reichweite + g.werte.radius + (g.werte.halbLaenge ?? 0) + 0.3);
  pruefe('ausser Reichweite: nicht greifbar', !kannReinigen(w, g));
  g.z = -1.5;
  w.spielerin.phase = 'vorlauf';
  pruefe('mitten im eigenen Schlag: nicht', !kannReinigen(w, g));
  w.spielerin.phase = 'bereit';
  w.marke!.ladung = 0;
  pruefe('ohne Ladung: nicht greifbar', !kannReinigen(w, g));
}
{
  const { w, g } = lage(WEGELAGERER);
  wund(g); g.phase = 'betaeubt';
  pruefe('ein Mensch ist nicht befallen — die Marke greift nicht', !istBefallen(g) && !kannReinigen(w, g));
}
{
  const { w, g } = lage(FUCHS);
  wund(g); inErholung(g); g.zustand = 'verhaertet';
  pruefe('verhärtet ohne Reinkultur: nicht greifbar', !kannReinigen(w, g));
  w.marke!.reinkultur = true;
  pruefe('verhärtet mit Reinkultur, aber zu wenig Ladung: nicht', W.verhaertet.ladung <= w.marke!.ladung || !kannReinigen(w, g));
  w.marke!.ladung = W.verhaertet.ladung;
  pruefe('verhärtet mit Reinkultur und Ladung: greifbar', kannReinigen(w, g));
  const normal = { ...g, zustand: undefined } as Kaempfer;
  pruefe('verhärtet dauert länger', nah(reinigungsDauer(W, g), reinigungsDauer(W, normal) * W.verhaertet.dauerFaktor, 1e-9));
  pruefe('verhärtet kostet mehr Ladung', reinigungsLadung(W, g) === W.verhaertet.ladung && reinigungsLadung(W, normal) === W.ladung);
}
pruefe('die Dauer hängt an der Grösse des Tiers, nicht am Restleben',
  reinigungsDauer(W, neuerKaempfer('a', KEILER, 0, 0)) > reinigungsDauer(W, neuerKaempfer('b', FUCHS, 0, 0))
  && (() => { const k = neuerKaempfer('c', KEILER, 0, 0); const voll = reinigungsDauer(W, k); k.leben = 5; return reinigungsDauer(W, k) === voll; })());

// ---------------------------------------------------------------- Der Griff
{
  const { w, s, g } = lage(FUCHS);
  wund(g); inErholung(g);
  const ausdauerVorher = s.ausdauer.wert;
  pruefe('eine Eingabe greift das aufgeschaltete Ziel', setzeReinigenAn(w));
  pruefe('die Spielerin kanalisiert, das Tier liegt', s.phase === 'reinigen' && g.phase === 'betaeubt' && w.marke!.ziel === 'g0');
  pruefe('der Griff kostet die Ausdauer aus den Daten', nah(ausdauerVorher - s.ausdauer.wert, W.ausdauer, 1e-9));
  puffere(s, 'rolle', 1, 0);
  laufe(w, 0.3);
  pruefe('im Kanal rollt sie nicht', s.phase === 'reinigen');
  s.puffer = null;
  laufe(w, W.halten - 0.3 + 0.05);
  const dauer = reinigungsDauer(W, g);
  pruefe('nach `halten` s steht das Tier wieder, der Kanal löst sich von selbst', s.phase === 'bereit' && g.phase !== 'betaeubt' && w.marke!.ziel === null,
    `Spielerin ${s.phase}, Tier ${g.phase}`);
  pruefe('ein Griff bringt halten/dauer Fortschritt', nah(g.reinigung ?? 0, W.halten / dauer, 0.03), `${(g.reinigung ?? 0).toFixed(3)} gegen ${(W.halten / dauer).toFixed(3)}`);
  pruefe('ein Griff reicht nicht', (g.reinigung ?? 0) < 1 && g.ausgang === undefined);
  pruefe('Ereignisse: begonnen, dann gelöst', w.marke!.ereignisse.map(e => e.art).join(',') === 'begonnen,geloest');
  const vorher = g.reinigung ?? 0;
  g.phase = 'bereit'; g.zeit = 0;
  laufe(w, 2);
  pruefe('ohne Kanal verfällt der Fortschritt langsam', nah((g.reinigung ?? 0), vorher - 2 * W.verfallJeSekunde, 0.01) && (g.reinigung ?? 0) > 0);

  // Weiter greifen, bis es durch ist.
  let griffe = 1;
  const ladungVorher = w.marke!.ladung;
  while (g.ausgang !== 'gereinigt' && griffe < 20) {
    inErholung(g);
    if (!setzeReinigenAn(w)) break;
    griffe++;
    laufe(w, W.halten + 0.1);
  }
  pruefe('mehrere Griffe reinigen', g.ausgang === 'gereinigt' && griffe >= 2 && griffe <= Math.ceil(dauer / W.halten) + 2, `${griffe} Griffe`);
  pruefe('gereinigt heisst: aus dem Kampf, rückgeführt, nicht tot', (g.phase as string) === 'gefallen' && g.zustand === 'rueckgefuehrt' && g.leben > 0);
  pruefe('die Spielerin ist danach frei', s.phase === 'bereit' && w.marke!.ziel === null);
  pruefe('eine Reinigung kostet eine Ladung — erst beim Gelingen', w.marke!.ladung === ladungVorher - W.ladung);
  pruefe('das letzte Ereignis heisst gereinigt', w.marke!.ereignisse.at(-1)?.art === 'gereinigt');
  pruefe('ein Gereinigtes greift nicht mehr an und ist nicht mehr greifbar', angriffsrecht(w) === null && !kannReinigen(w, g) && w.ziel === null);
}
{
  // Der Lohn des Haltungsbruchs: Ein Betäubtes liegt den Rest seiner Betäubung **und** `halten`.
  const { w, g } = lage(FUCHS);
  wund(g); g.phase = 'betaeubt'; g.zeit = 0; g.betaeubtFuer = undefined;
  setzeReinigenAn(w);
  laufe(w, W.halten + g.werte.betaeubt - 0.1);
  pruefe('ein Betäubtes hält die Marke um den Rest der Betäubung länger', g.phase === 'betaeubt' && w.spielerin.phase === 'reinigen');
  laufe(w, 0.2);
  pruefe('… und dann steht auch es wieder', w.spielerin.phase === 'bereit');
}

// ---------------------------------------------------------------- Das Risiko
{
  const { w, s, g } = lage(FUCHS, true, [WOLF]);
  const zweiter = w.gegner[1];
  wund(g); inErholung(g);
  setzeReinigenAn(w);
  laufe(w, 0.5);
  const fortschritt = g.reinigung ?? 0;
  // Der zweite holt aus und trifft in den Kanal.
  zweiter.phase = 'vorlauf'; zweiter.zeit = 0; zweiter.schlag = zweiter.werte.schlag; zweiter.schwung = 1; zweiter.erreicht = new Set();
  const ereignisse = [];
  for (let t = 0; t < zweiter.werte.schlag.vorlauf + zweiter.werte.schlag.aktiv + 0.05; t += SCHRITT) ereignisse.push(...simuliere(w, SCHRITT));
  const treffer = ereignisse.find(e => e.auf === 's' && e.schaden > 0);
  pruefe('ein Treffer im Kanal trifft', !!treffer);
  pruefe('… und wiegt `verwundbar`-fach', !!treffer && nah(treffer.schaden, zweiter.werte.schlag.schaden * W.verwundbar, 1e-6)
    && nah(s.werte.lebenMax - s.leben, zweiter.werte.schlag.schaden * W.verwundbar, 1e-6), `${treffer?.schaden}`);
  pruefe('der Treffer bricht den Kanal', s.phase !== 'reinigen' && w.marke!.ziel === null && w.marke!.ereignisse.at(-1)?.art === 'getroffen');
  const mitZuwachs = fortschritt + (zweiter.werte.schlag.vorlauf + 0.02) / reinigungsDauer(W, g);
  pruefe('vom Fortschritt bleibt nur ein Teil', (g.reinigung ?? 0) <= mitZuwachs * W.behaltBeiTreffer + 0.02 && (g.reinigung ?? 0) < fortschritt + 1e-9,
    `${(g.reinigung ?? 0).toFixed(3)} nach ${fortschritt.toFixed(3)}`);
  pruefe('das Tier kommt nach dem Nachhall hoch', g.phase === 'betaeubt' && (g.betaeubtFuer ?? 99) <= W.nachhall + 1e-9);
}
{
  const { w, s, g } = lage(FUCHS);
  wund(g); inErholung(g);
  setzeReinigenAn(w);
  laufe(w, 0.3);
  loeseReinigen(w);
  pruefe('Lösen ist nicht sofort', s.phase === 'reinigen');
  laufe(w, W.loesen + 2 * SCHRITT);
  pruefe('nach `loesen` s ist sie frei, der Fortschritt bleibt', s.phase === 'bereit' && (g.reinigung ?? 0) > 0 && w.marke!.ziel === null);
  pruefe('selbst gelöst heisst gelöst, nicht getroffen', w.marke!.ereignisse.at(-1)?.art === 'geloest');
}

// ---------------------------------------------------------------- Dauer je Gegner (D389)
{
  const ORDNER = 'content/gegner';
  const dateien = readdirSync(ORDNER).filter(f => f.endsWith('.json'))
    .map(f => GegnerDaten.parse(JSON.parse(readFileSync(join(ORDNER, f), 'utf8'))));
  const tiere = dateien.filter(g => g.elemente?.length && !g.mensch), menschen = dateien.filter(g => g.mensch);
  pruefe('jedes Tier in content/gegner trägt eigene Reinigungswerte', tiere.length > 0 && tiere.every(g => !!g.reinigen),
    tiere.filter(g => !g.reinigen).map(g => g.id).join(', '));
  pruefe('kein Mensch in content/gegner ist reinigbar (D385)', menschen.length > 0 && menschen.every(g => !g.reinigen));
  pruefe('wer weder Tier noch Mensch ist (Übungsgegner), trägt keine', dateien.filter(g => !g.elemente && !g.mensch).every(g => !g.reinigen));
  pruefe('die Messreihe kennt genau die reinigbaren Tiere', tiere.map(g => g.id).sort().join() === Object.keys(TIERE).sort().join(),
    `${tiere.map(g => g.id).sort()} gegen ${Object.keys(TIERE).sort()}`);
  for (const g of tiere) {
    const k = neuerKaempfer(g.id, TIERE[g.id], 0, 0);
    pruefe(`${g.id}: die Regeln rechnen mit der Dauer aus den Daten`, reinigungsDauer(W, k) === g.reinigen!.dauer);
    pruefe(`${g.id}: die Griffdauer kommt vom Gegner, sonst aus den Markenwerten`, reinigungsHalten(W, k) === (g.reinigen!.halten ?? W.halten));
    const griffe = reinigungsGriffe(W, k);
    pruefe(`${g.id}: Griffzahl im Band ${W.griffe.min}–${W.griffe.max} (D379)`, griffe >= W.griffe.min && griffe <= W.griffe.max, `${griffe}`);
    pruefe(`${g.id}: ein Griff allein reinigt nicht`, reinigungsHalten(W, k) < reinigungsDauer(W, k));
  }
  // Ohne eigene Werte gilt die Grössenformel (Regenten, Testgegner, Stand D376).
  const nackt = neuerKaempfer('n', ohneEigeneWerte(KEILER), 0, 0);
  pruefe('ohne eigene Werte: Dauer nach der Grösse', nah(reinigungsDauer(W, nackt), W.grunddauer + KEILER.lebenMax / W.lebenJeSekunde, 1e-9)
    && reinigungsHalten(W, nackt) === W.halten);
  const hart = neuerKaempfer('h', KEILER, 0, 0); hart.zustand = 'verhaertet';
  pruefe('verhärtet vervielfacht die eigene Dauer', nah(reinigungsDauer(W, hart), KEILER.reinigen!.dauer * W.verhaertet.dauerFaktor, 1e-9));

  // Das Schema: reinigen nur bei Tieren — oder bei Menschen, die den Befall gewählt haben.
  const rohMensch = JSON.parse(readFileSync(join(ORDNER, 'wegelagerer.json'), 'utf8'));
  const rohTier = JSON.parse(readFileSync(join(ORDNER, 'fuchs.json'), 'utf8'));
  const rohUebung = JSON.parse(readFileSync(join(ORDNER, 'uebungsgegner.json'), 'utf8'));
  pruefe('Schema: Mensch mit reinigen wird abgelehnt', !GegnerDaten.safeParse({ ...rohMensch, reinigen: { dauer: 4 } }).success);
  pruefe('Schema: freiwillig befallener Mensch wird angenommen (D385)', GegnerDaten.safeParse({ ...rohMensch, reinigen: { dauer: 4, freiwillig: true } }).success);
  pruefe('Schema: ein Tier ist nie „freiwillig“', !GegnerDaten.safeParse({ ...rohTier, reinigen: { dauer: 3, freiwillig: true } }).success);
  pruefe('Schema: ohne Element kein reinigen', !GegnerDaten.safeParse({ ...rohUebung, reinigen: { dauer: 3 } }).success);
  pruefe('Schema: Dauer muss positiv sein', !GegnerDaten.safeParse({ ...rohTier, reinigen: { dauer: 0 } }).success);
  pruefe('Schema: unbekannte Felder im Block werden abgelehnt', !GegnerDaten.safeParse({ ...rohTier, reinigen: { dauer: 3, griffe: 3 } }).success);
  pruefe('der Übungsgegner ist nicht befallen', !istBefallen(neuerKaempfer('u', UEBUNGSGEGNER, 0, 0)));
}
{
  // D385: Der freiwillig Befallene (Mönch im Endstadium) ist der einzige Mensch, den die Marke greift.
  const moench: KampfWerte = { ...WEGELAGERER, reinigen: { dauer: 4, freiwillig: true } };
  const { w, g } = lage(moench);
  pruefe('freiwillig befallener Mensch: befallen', istBefallen(g));
  g.phase = 'betaeubt'; g.zeit = 0;
  pruefe('… aber wie jedes Ziel erst unter der Schwelle', W.schwelle >= 1 || !kannReinigen(w, g));
  wund(g);
  pruefe('… wund und betäubt: greifbar', kannReinigen(w, g));
}
{
  // Die Griffdauer je Gegner wirkt im Kampf: Die Gams liegt so lange, wie ihre Daten sagen.
  const { w, s, g } = lage(GAMS);
  const halten = reinigungsHalten(W, g);
  wund(g); inErholung(g);
  setzeReinigenAn(w);
  laufe(w, halten - 0.05);
  pruefe('ein Tier mit eigener Griffdauer liegt bis kurz vor ihrem Ende', s.phase === 'reinigen' && g.phase === 'betaeubt', `${s.phase}/${g.phase}`);
  laufe(w, 0.1);
  pruefe('… und steht danach wieder', s.phase === 'bereit' && g.phase !== 'betaeubt');
  pruefe('… mit halten/dauer Fortschritt', nah(g.reinigung ?? 0, halten / reinigungsDauer(W, g), 0.03), `${(g.reinigung ?? 0).toFixed(3)}`);
}
{
  // Die Auswertung der Messreihe (tools/reinigensim.ts `bewerte`) — Korridor aus D376, Obergrenze als Annahme D389.
  const z = (siege: number, zeit: number, erlitten: number): SimZeile =>
    ({ aufstellung: 'x', modus: 'immer', siege, zeit, erlitten, gereinigt: 1, gebrochen: 0, geloest: 0, kanaele: 4 });
  const [lo, hi] = ZIELKORRIDOR.zeit, auf = PROFILE[0].name, muede = PROFILE[1].name;
  pruefe('Auswertung: mitten im Korridor ohne Befund', bewerte(auf, z(1, 10, 10), z(1, 10 * (lo + hi) / 2, 12)).length === 0);
  pruefe('Auswertung: schneller als der Korridor heisst zu leicht', bewerte(auf, z(1, 10, 10), z(1, 10 * lo - 0.5, 12)).some(b => b.startsWith('zu leicht')));
  pruefe('Auswertung: über der Obergrenze heisst zu lang — für jedes Profil', bewerte(muede, z(1, 10, 10), z(1, 10 * ZIELKORRIDOR.zeitHoechstens + 0.5, 12)).some(b => b.startsWith('zu lang')));
  pruefe('Auswertung: der Richtwert gilt nur dem Aufmerksamen', bewerte(muede, z(1, 10, 10), z(1, 10 * hi + 0.5, 12)).length === 0);
  pruefe('Auswertung: brechen die Siege ein, ist es zu hart', bewerte(muede, z(0.8, 10, 10), z(0.8 - ZIELKORRIDOR.siegeVerlust - 0.05, 12.5, 30)).some(b => b.startsWith('zu hart')));
  pruefe('Auswertung: wer fast nie reinigt, wird als solcher benannt',
    bewerte(auf, z(1, 10, 10), { ...z(1, 13, 12), gereinigt: 0.1 }).some(b => b.startsWith('selten gereinigt')));
  pruefe('Auswertung: weniger Schaden als Töten heisst nicht riskanter', bewerte(auf, z(1, 10, 10), z(1, 13, 7)).some(b => b.startsWith('nicht riskanter')));
}

// ---------------------------------------------------------------- Das Band (klein; voll in tools/reinigensim.ts)
{
  // D389: Keiler und Fuchs lagen mit der Grössenformel über dem Richtwert — mit eigenen Werten darunter.
  const n = 40;
  for (const tier of ['keiler', 'fuchs']) {
    const z = simuliereGegner(tier, n, PROFILE[0]), v = simuliereGegner(tier, n, PROFILE[0], 'klinge', true);
    pruefe(`${tier}: mit eigener Dauer höchstens ${ZIELKORRIDOR.zeitHoechstens}× der Tötungszeit`, z.zeitFaktor <= ZIELKORRIDOR.zeitHoechstens, z.zeitFaktor.toFixed(2));
    pruefe(`${tier}: kürzer als mit der Grössenformel, aber weiter langsamer als Töten`, z.zeitFaktor < v.zeitFaktor && z.zeitFaktor > 1.05,
      `${z.zeitFaktor.toFixed(2)} gegen ${v.zeitFaktor.toFixed(2)}`);
    pruefe(`${tier}: gelingt und reinigt (≥ 90 %)`, z.reinigen.siege >= 0.9 && z.reinigen.gereinigt >= 0.9);
  }
}
{
  const n = 40;
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  for (const tier of ['wolf', 'keiler']) {
    const t = simuliereZeile(tier, 'töten', n, W), r = simuliereZeile(tier, 'immer', n, W);
    pruefe(`${tier} einzeln: reinigen gelingt (≥ 90 % Siege)`, r.siege >= 0.9, pct(r.siege));
    pruefe(`${tier} einzeln: fast immer gereinigt statt getötet (≥ 80 %)`, r.gereinigt >= 0.8, pct(r.gereinigt));
    pruefe(`${tier} einzeln: reinigen ist langsamer als töten`, r.zeit > t.zeit * 1.05, `${r.zeit.toFixed(1)} gegen ${t.zeit.toFixed(1)} s`);
    pruefe(`${tier} einzeln: aber nicht mehr als doppelt so lang`, r.zeit < t.zeit * 2, `${r.zeit.toFixed(1)} gegen ${t.zeit.toFixed(1)} s`);
  }
  const t = simuliereZeile('wolf+fuchs', 'töten', n, W), r = simuliereZeile('wolf+fuchs', 'immer', n, W), g = simuliereZeile('wolf+fuchs', 'gemischt', n, W);
  pruefe('zu zweit: immer reinigen kostet deutlich mehr Leben (≥ +10)', r.erlitten >= t.erlitten + 10, `${r.erlitten.toFixed(0)} gegen ${t.erlitten.toFixed(0)}`);
  pruefe('zu zweit: immer reinigen ist nie aussichtslos (≥ 60 % Siege)', r.siege >= 0.6, pct(r.siege));
  pruefe('zu zweit: gemischt bleibt sicher (≥ 85 % Siege)', g.siege >= 0.85, pct(g.siege));
  pruefe('zu zweit: gemischt reinigt den Letzten', g.gereinigt >= 0.35 && g.gereinigt <= 0.5 + 1e-9, pct(g.gereinigt));
  pruefe('zu zweit: Kanäle werden auch gebrochen (das Risiko ist echt)', r.gebrochen > 0, pct(r.gebrochen));
}

console.log(`\nReinigen — ${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
