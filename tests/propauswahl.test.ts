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
import { waehleProps } from '../src/scenes/propauswahl.js';
import { ATTRAPPE_AB, FERN_NEUBEWERTUNG } from '../src/scenes/sichtweiten.js';
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

// ---------------------------------------------------- 1. Keine Doppelung
{
  const { nah, buendel } = waehleProps(chunks, [0, 0], [0, 0], true);
  const imBuendel = new Set([...buendel.values()].flat());
  const doppelt = nah.filter(n => imBuendel.has(n.c)).length;
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
    const imBuendel = new Set([...letztesBuendel.values()].flat());
    const inNah = new Set(nah.map(n => n.c));
    schritte++;
    for (const c of chunks) {
      const d = Math.hypot(p[0] - c.mitte[0], p[1] - c.mitte[1]);
      // Nur was klar in Reichweite ist, muss gezeichnet werden. Der Rand selbst
      // ist unscharf, weil das Bündel mit dem Anker rechnet.
      if (d - c.radius > c.sichtweite - FERN_NEUBEWERTUNG) continue;
      const a = inNah.has(c), b = imBuendel.has(c);
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

console.log(`\n${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
