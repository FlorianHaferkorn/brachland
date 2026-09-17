/**
 * BRACHLAND — die Prop-Auswahl darf keinen Chunk verlieren
 *
 * Seit die Attrappen gebündelt werden (G-111), teilen sich zwei Listen alle
 * sichtbaren Chunks, und sie werden **verschieden oft** neu bestimmt: die
 * Nahliste alle 8 m, das Bündel alle 60 m. Genau daraus entsteht der eine
 * Fehler, den ein Bildschirmfoto nicht zeigt — ein Chunk, der in keiner der
 * beiden Listen steht und damit für ein paar Schritte verschwindet.
 *
 * Geprüft wird deshalb nicht ein Zustand, sondern ein **Lauf**: Die Kamera geht
 * in Schritten über die Karte, das Bündel wird nur alle 60 m neu gebaut, und
 * nach jedem Schritt muss jeder Chunk, der überhaupt in Reichweite ist, in genau
 * einer Liste stehen.
 */
import { buendleFernProps, propListenNeu, waehleProps } from '../src/scenes/propauswahl.js';
import { ATTRAPPE_AB, FERN_NEUBEWERTUNG, MITTEL_AB, PROP_NEUBEWERTUNG } from '../src/scenes/sichtweiten.js';
import type { PropArt, PropChunk } from '../src/world/props.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, bedingung: boolean, hinweis = '') {
  if (bedingung) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}

/** Ein Raster aus Chunks, wie `chunkeProps` es liefert: 70 m Kacheln. */
function raster(art: PropArt, sichtweite: number, halb = 700): PropChunk[] {
  const raus: PropChunk[] = [];
  for (let x = -halb; x <= halb; x += 70)
    for (let z = -halb; z <= halb; z += 70)
      raus.push({ art, variante: 0, mitte: [x, z], radius: 52.5, sichtweite, instanzen: [] });
  return raus;
}

const chunks = raster('nadelbaum', 420);

// Der Fernanker kann die 60-m-Grenze kurz nach einer 8-m-Nahbewertung kreuzen.
// Dann muessen beide Listen atomar folgen, sonst steht ein Randchunk kurz doppelt.
{
  const ruhig = propListenNeu(PROP_NEUBEWERTUNG - 0.1, FERN_NEUBEWERTUNG - 0.1);
  pruefe('unter beiden Schwellen bleibt die Auswahl stehen', !ruhig.nah && !ruhig.fern);
  const anker = propListenNeu(0.1, FERN_NEUBEWERTUNG);
  pruefe('neuer Fernanker erzwingt auch die Nahliste', anker.nah && anker.fern);
  const zuerst = propListenNeu(Number.NaN, Number.NaN);
  pruefe('NaN startet beide Listen', zuerst.nah && zuerst.fern);
}

/**
 * Zugehörigkeit über die **Kachel**, nicht über die Objektidentität.
 *
 * Seit D100 legt die Mittelstufe die Varianten einer Kachel zusammen und gibt
 * dafür ein **neues** Chunk-Objekt aus. Ein `Set` von Objektreferenzen würde
 * seither überall Ausfälle melden, die keine sind. Die Frage, die der Test
 * stellen will, war ohnehin nie „ist dieses Objekt dabei", sondern „wird diese
 * Kachel gezeichnet".
 */
const kachel = (c: PropChunk) => `${c.art}|${c.mitte[0]}|${c.mitte[1]}`;

// ---------------------------------------------------- 1. Keine Doppelung
{
  const { nah, buendel } = waehleProps(chunks, [0, 0], [0, 0], true);
  const imBuendel = new Set([...buendel.values()].flat().map(kachel));
  const doppelt = nah.filter(n => imBuendel.has(kachel(n.c))).length;
  pruefe('kein Chunk steht in beiden Listen', doppelt === 0, `${doppelt} doppelt`);
  pruefe('die Nahliste ist nicht leer', nah.length > 0);
  pruefe('das Bündel ist nicht leer', imBuendel.size > 0);
}

// ---------------------------------------------------- 2. Kein Loch im Lauf
//
// Die Kamera läuft 600 m in 8-m-Schritten. Das Bündel wird nachgezogen, sobald
// sie sich FERN_NEUBEWERTUNG vom Anker entfernt hat — genau wie in der Szene.
{
  let anker: [number, number] = [-300, 0];
  let letztesBuendel = waehleProps(chunks, anker, anker, true).buendel;
  let fehlend = 0, doppelt = 0, schritte = 0;

  for (let x = -300; x <= 300; x += 8) {
    const p: [number, number] = [x, 0];
    if (Math.hypot(p[0] - anker[0], p[1] - anker[1]) >= FERN_NEUBEWERTUNG) {
      anker = p;
      letztesBuendel = waehleProps(chunks, p, anker, true).buendel;
    }
    const { nah } = waehleProps(chunks, p, anker, false);
    const imBuendel = new Set([...letztesBuendel.values()].flat().map(kachel));
    const inNah = new Set(nah.map(n => kachel(n.c)));
    schritte++;
    for (const c of chunks) {
      const d = Math.hypot(p[0] - c.mitte[0], p[1] - c.mitte[1]);
      // Nur was klar in Reichweite ist, muss gezeichnet werden. Der Rand selbst
      // ist unscharf, weil das Bündel mit dem Anker rechnet.
      if (d - c.radius > c.sichtweite - FERN_NEUBEWERTUNG) continue;
      const a = inNah.has(kachel(c)), b = imBuendel.has(kachel(c));
      if (!a && !b) fehlend++;
      if (a && b) doppelt++;
    }
  }
  pruefe(`Lauf über ${schritte} Schritte: kein Chunk fehlt`, fehlend === 0,
    `${fehlend} Ausfälle`);
  pruefe(`Lauf über ${schritte} Schritte: kein Chunk doppelt`, doppelt === 0,
    `${doppelt} Doppelungen`);
}

// ---------------------------------------------------- 3. Die Grenze hängt am Anker
//
// Derselbe Chunk muss bei gleichem Anker in derselben Liste bleiben, egal wo die
// Kamera zwischen zwei Ankern gerade steht. Sonst wandert die Grenze mit und der
// Lauf oben hätte nur zufällig gehalten.
{
  const anker: [number, number] = [0, 0];
  const a = waehleProps(chunks, [0, 0], anker, true);
  const b = waehleProps(chunks, [55, 0], anker, true);
  const mengeA = new Set([...a.buendel.values()].flat());
  const mengeB = new Set([...b.buendel.values()].flat());
  const gleich = mengeA.size === mengeB.size && [...mengeA].every(c => mengeB.has(c));
  pruefe('Bündelzugehörigkeit hängt am Anker, nicht an der Kamera', gleich);
}

// ---------------------------------------------------- 4. Attrappengrenze stimmt
{
  const { nah } = waehleProps(chunks, [0, 0], [0, 0], true);
  const zuWeit = nah.filter(n => Math.hypot(n.c.mitte[0], n.c.mitte[1]) > ATTRAPPE_AB).length;
  pruefe(`kein Nahchunk jenseits von ${ATTRAPPE_AB} m`, zuWeit === 0, `${zuWeit} zu weit`);
}

// ---------------------------------------------------- 5. Mittelstufe legt Varianten zusammen
//
// Der Fehler, den das abdeckt, ist derselbe wie oben und genauso unsichtbar: Beim
// Zusammenfassen kann eine Instanz verlorengehen oder zweimal auftauchen. Unter
// 3.000 Grasbüscheln fällt weder das eine noch das andere auf.
{
  const VARIANTEN_ZAHL = 4;
  const mehrere: PropChunk[] = [];
  for (let x = -280; x <= 280; x += 70)
    for (let z = -280; z <= 280; z += 70)
      for (let v = 0; v < VARIANTEN_ZAHL; v++)
        mehrere.push({
          art: 'busch', variante: v, mitte: [x, z], radius: 52.5, sichtweite: 420,
          // Eine eindeutige Kennung je Instanz, damit sich Verlust und Doppelung
          // zählen lassen. Die Lage sitzt auf der Chunkmitte: Seit D162 entscheidet
          // `waehleProps` auf der Schwelle je Instanz, und dieser Fall soll genau
          // das alte Verhalten prüfen, nicht die neue Teilung.
          instanzen: [{ kennung: `${x}|${z}|${v}`, position: [x, 0, z] }] as never,
        });

  const { nah } = waehleProps(mehrere, [0, 0], [0, 0], false);
  const mittel = nah.filter(n => n.stufe === 'mittel');
  const nahStufe = nah.filter(n => n.stufe === 'nah');

  // Erwartet: je Kachel EIN Mittel-Eintrag, aber die Nahstufe unangetastet.
  const kachelnMittel = new Set(mittel.map(n => kachel(n.c)));
  pruefe('je Kachel genau ein Mittel-Eintrag',
    kachelnMittel.size === mittel.length, `${mittel.length} Einträge, ${kachelnMittel.size} Kacheln`);
  pruefe('die Nahstufe behält ihre Varianten',
    nahStufe.length === new Set(nahStufe.map(n => kachel(n.c))).size * VARIANTEN_ZAHL,
    `${nahStufe.length} Nah-Einträge`);

  // Keine Instanz verloren, keine doppelt.
  const roh = mehrere.filter(c => {
    const d = Math.hypot(c.mitte[0], c.mitte[1]);
    return d <= 140 && d - c.radius <= c.sichtweite;   // ATTRAPPE_AB = 110, Rand grosszügig
  });
  const erwartet = new Set(roh.filter(c => Math.hypot(c.mitte[0], c.mitte[1]) <= ATTRAPPE_AB)
    .flatMap(c => c.instanzen.map(i => (i as unknown as { kennung: string }).kennung)));
  const bekommen = nah.flatMap(n => n.c.instanzen.map(i => (i as unknown as { kennung: string }).kennung));
  pruefe('keine Instanz doppelt', bekommen.length === new Set(bekommen).size,
    `${bekommen.length} Instanzen, ${new Set(bekommen).size} verschiedene`);
  const fehlen = [...erwartet].filter(k => !bekommen.includes(k)).length;
  pruefe('keine Instanz verloren', fehlen === 0, `${fehlen} fehlen`);

  // Und die Wirkung, um derentwillen es das gibt.
  pruefe(`Zusammenlegen spart Aufrufe: ${mittel.length} statt ${mittel.length * VARIANTEN_ZAHL}`,
    mittel.length * VARIANTEN_ZAHL > mittel.length && mittel.length > 0);

  // Zweimal hintereinander aufrufen darf nichts anhäufen — die Chunkliste ist
  // dieselbe, und ein `push` auf das Original hätte die Instanzen verdoppelt.
  const zweite = waehleProps(mehrere, [0, 0], [0, 0], false);
  const summe = (a: typeof nah) => a.reduce((s, n) => s + n.c.instanzen.length, 0);
  pruefe('zweiter Aufruf liefert dieselbe Zahl Instanzen',
    summe(zweite.nah) === summe(nah), `${summe(nah)} → ${summe(zweite.nah)}`);
}

// Baumformen duerfen bei keinem LOD-Wechsel auf Variante 0 springen (D157).
for (const art of ['laubbaum', 'nadelbaum'] as const) {
  const baeume: PropChunk[] = [0, 1, 2, 3].map(variante => ({
    art, variante, mitte: [70, 0], radius: 10, sichtweite: 420,
    instanzen: [{ art, variante, position: [70, 0, 0], drehung: 0, skalierung: 1 }],
  }));
  const mittel = waehleProps(baeume, [0, 0], [0, 0], true).nah;
  pruefe(`${art}: Mittelstufe behaelt jede Form`, mittel.length === 4 && mittel.every(e =>
    e.stufe === 'mittel' && e.c.instanzen.every(p => p.variante === e.c.variante)));
  const fern = buendleFernProps(waehleProps(baeume, [-60, 0], [-60, 0], true).buendel);
  pruefe(`${art}: Fernstufe behaelt jede Form`, fern.length === 4 && fern.every(e =>
    e.instanzen.every(p => p.variante === e.variante)));
  pruefe(`${art}: LOD-Wechsel erhaelt alle Instanzen genau einmal`,
    fern.flatMap(e => e.instanzen).length === 4 && new Set(fern.flatMap(e => e.instanzen)).size === 4);
}

// ---------------------------------------------------- Chunk auf der Schwelle (D162)
//
// Ein Chunk ist 70 m breit. Kippt er geschlossen von `nah` auf `mittel`, wechseln
// auch die Bäume an seinem vorderen Rand die Silhouette — und die stehen dann
// wenige Meter vor der Kamera. Gemessen trugen 5,7 bis 9,6 % der Bäume die falsche
// Stufe, der nächste zu grob gezeichnete bei 16,9 m. Der Chunk, durch den die
// Schwelle läuft, wird deshalb je Instanz entschieden.
//
// Geprüft wird beides, was dabei schiefgehen kann: dass wirklich nach Abstand
// getrennt wird, und dass dabei keine Instanz verlorengeht oder doppelt auftaucht.
{
  const ORT: [number, number] = [0, 0];
  // Mitte bei 50 m, Radius 52,5 — die 45-m-Schwelle läuft mitten hindurch.
  const baeume = [10, 30, 44, 46, 70, 95].map((d, k) => ({
    art: 'nadelbaum' as PropArt, variante: 0,
    position: [d, 0, 0] as [number, number, number], drehung: 0, skalierung: 1, kennung: k,
  }));
  const chunk: PropChunk = {
    art: 'nadelbaum', variante: 0, mitte: [50, 0], radius: 52.5, sichtweite: 420,
    instanzen: baeume as never,
  };
  const { nah } = waehleProps([chunk], ORT, ORT, false);
  const nahe = nah.filter(e => e.stufe === 'nah').flatMap(e => e.c.instanzen);
  const mittlere = nah.filter(e => e.stufe === 'mittel').flatMap(e => e.c.instanzen);
  pruefe('Schwellenchunk: nur die nahen Bäume stehen auf der Nahstufe',
    nahe.length === 3 && nahe.every(p => p.position[0] <= MITTEL_AB),
    `${nahe.length} nah: ${nahe.map(p => p.position[0]).join(',')}`);
  pruefe('Schwellenchunk: die entfernten stehen auf der Mittelstufe',
    mittlere.length === 3 && mittlere.every(p => p.position[0] > MITTEL_AB),
    `${mittlere.length} mittel: ${mittlere.map(p => p.position[0]).join(',')}`);
  const alle = [...nahe, ...mittlere];
  pruefe('Schwellenchunk: keine Instanz verloren, keine doppelt',
    alle.length === baeume.length && new Set(alle).size === baeume.length,
    `${alle.length} von ${baeume.length}, ${new Set(alle).size} verschieden`);
  // Gegenprobe: ein Chunk, durch den die Schwelle NICHT läuft (|100 − 45| > 52,5),
  // bleibt ein Eintrag. Weiter als ATTRAPPE_AB darf er nicht liegen, sonst prüft
  // der Fall das Bündel statt die Teilung.
  const abseits: PropChunk = { ...chunk, mitte: [100, 0] };
  const einer = waehleProps([abseits], ORT, ORT, false).nah;
  pruefe('Chunk abseits der Schwelle bleibt ein einziger Eintrag', einer.length === 1,
    `${einer.length} Einträge`);
}

// ---------------------------------------------------- Die Kette ueberspringt keine Stufe (D164)
//
// Gemessen mit `lodlauf.mjs`: 6 von 76 Stufenwechseln waren `fern→nah` — vom 12-Dreieck-Kegel
// direkt aufs volle Modell. Ursache ist die Ankerstrecke: Ob ein Chunk Attrappe ist, entscheidet
// `vomAnker`, und der Anker zieht erst alle 60 m nach. Ein Chunk, der im vorigen Durchlauf im
// Buendel war, bekommt deshalb hoechstens die Mittelstufe.
{
  const c: PropChunk = {
    art: 'nadelbaum', variante: 0, mitte: [20, 0], radius: 52.5, sichtweite: 420,
    instanzen: [{ art: 'nadelbaum' as PropArt, variante: 0, position: [20, 0, 0], drehung: 0, skalierung: 1 }],
  };
  const ORT: [number, number] = [0, 0];
  // Ohne Vorgeschichte: 20 m ist Nahstufe.
  const frisch = waehleProps([c], ORT, ORT, false);
  pruefe('ohne Vorgeschichte steht der nahe Chunk auf der Nahstufe',
    frisch.nah.length === 1 && frisch.nah[0].stufe === 'nah', frisch.nah[0]?.stufe);
  // Mit Vorgeschichte „war Attrappe": erst Mittelstufe, kein Sprung.
  const key = `${c.art}|${c.mitte[0]}|${c.mitte[1]}`;
  const nachBuendel = waehleProps([c], ORT, ORT, false, new Set([key]));
  pruefe('aus dem Buendel kommend zuerst die Mittelstufe',
    nachBuendel.nah.length === 1 && nachBuendel.nah[0].stufe === 'mittel', nachBuendel.nah[0]?.stufe);
  // Und der naechste Durchlauf darf wieder nah sein — die Zwischenstufe haelt genau einen Schritt.
  const danach = waehleProps([c], ORT, ORT, false, nachBuendel.buendelKacheln);
  pruefe('die Zwischenstufe haelt genau einen Durchlauf',
    danach.nah.length === 1 && danach.nah[0].stufe === 'nah', danach.nah[0]?.stufe);
  // Der Schluesselsatz muss melden, was gerade Attrappe ist.
  const weit: PropChunk = { ...c, mitte: [400, 0] };
  const w = waehleProps([weit], ORT, ORT, true);
  pruefe('buendelKacheln nennt die Attrappenkachel',
    w.buendelKacheln.has(`${weit.art}|400|0`), [...w.buendelKacheln].join(','));
  pruefe('buendelKacheln nennt keine Nahkachel', !frisch.buendelKacheln.has(key));
}

console.log(`\n${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
