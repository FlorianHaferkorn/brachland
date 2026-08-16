/**
 * BRACHLAND — Inhalte zur Laufzeit
 *
 * Bindeglied zwischen `content/` (validierte JSON-Daten) und `engine/` (Regeln ohne
 * Daten). Beide Seiten kennen einander nicht — hier treffen sie sich.
 *
 * Die Zod-Prüfung läuft **auch im Browser**, nicht nur im Gate. Der Grund: `npm run
 * validate` prüft den Stand auf der Platte, der Browser lädt den Stand im Bundle.
 * Solange beides dasselbe ist, kostet die zweite Prüfung nur Millisekunden; sobald es
 * auseinanderläuft, fällt es beim Start auf statt mitten im Kampf.
 */
import { Kreatur, Move, Regent, Gegenstand } from './schema.js';
import { erstelle, type Kaempfer, type MoveDef, type Band } from '../engine/battle.js';
import { mutationBei, werteBei, STUFE_MAX } from '../spiel/fortschritt.js';

type Roh = Record<string, unknown>;

const moveRoh = import.meta.glob('../../content/moves/*.json', { eager: true, import: 'default' }) as Roh;
const kreaturRoh = import.meta.glob('../../content/creatures/*.json', { eager: true, import: 'default' }) as Roh;
const regentRoh = import.meta.glob('../../content/regenten/*.json', { eager: true, import: 'default' }) as Roh;
const gegenstandRoh = import.meta.glob('../../content/gegenstaende/*.json', { eager: true, import: 'default' }) as Roh;

function lade<T>(roh: Roh, schema: { parse: (x: unknown) => T }, was: string): Map<string, T> {
  const karte = new Map<string, T>();
  for (const [pfad, wert] of Object.entries(roh)) {
    try {
      const geprueft = schema.parse(wert);
      karte.set((geprueft as { id: string }).id, geprueft);
    } catch (e) {
      throw new Error(`${was} ${pfad} passt nicht ins Schema: ${String(e)}`);
    }
  }
  return karte;
}

export const MOVES = lade(moveRoh, Move, 'Move');
export const KREATUREN = lade(kreaturRoh, Kreatur, 'Kreatur');
export const REGENTEN = lade(regentRoh, Regent, 'Regent');
export const GEGENSTAENDE = lade(gegenstandRoh, Gegenstand, 'Gegenstand');

/** Nur die fangbaren Wildlinge — daraus werden Begegnungen gebaut. */
export const WILDLINGE = [...KREATUREN.values()].filter(k => k.ursprung === 'wildling');

export function moveDef(id: string): MoveDef {
  const m = MOVES.get(id);
  if (!m) throw new Error(`Move '${id}' fehlt — npm run validate haette das gefunden`);
  return { id: m.id, name: m.name, element: m.element, band: m.band as Band };
}

/**
 * Baut einen Kämpfer aus Kreatur und **Erfahrungsstufe** (1…40).
 *
 * Die Mutation wird abgeleitet, nicht übergeben: Sie folgt aus der Stufe
 * (`mutationBei`) und aus der Länge der Linie. Zwei Quellen für dieselbe Wahrheit
 * wären genau die Art Drift, gegen die dieses Projekt Schemas hat.
 *
 * Moveset nach Roster-Regel: die zwei Grundmoves plus jeden Signaturmove der
 * erreichten Mutationen. Eine dreistufige Linie hat auf Mutation 3 vier Moves —
 * genau die vier Slots, die das Move-System vorsieht.
 */
export function baueKaempfer(
  kreaturId: string, stufe = 1, zustand: Kaempfer['zustand'] = 'rein',
): Kaempfer {
  const k = KREATUREN.get(kreaturId);
  if (!k) throw new Error(`Kreatur '${kreaturId}' fehlt`);
  const lvl = Math.max(1, Math.min(STUFE_MAX, Math.round(stufe)));
  const m = mutationBei(lvl, k.stufen.length);
  const s = k.stufen[m];
  const ids = [
    ...k.grundMoves,
    ...k.stufen.slice(0, m + 1).map(x => x.signaturMove).filter((x): x is string => !!x),
  ];
  const werte = (feld: 'kp' | 'ang' | 'ver' | 'ini') =>
    werteBei(k.stufen.map(x => x.werte[feld]), lvl);
  return erstelle({
    id: `${k.id}-s${m + 1}-l${lvl}`,
    name: s.name,
    elemente: [...k.elemente],
    zustand,
    maxKp: werte('kp'),
    ang: werte('ang'), ver: werte('ver'), ini: werte('ini'),
    moves: ids.map(moveDef),
  });
}

/** Liest Kreatur, Mutation und Stufe aus einer Kämpfer-ID zurück. */
export function ausKaempferId(id: string): { kreatur: string; mutation: number; stufe: number } {
  const m = id.match(/^(.*)-s(\d+)-l(\d+)$/);
  if (!m) return { kreatur: id.replace(/-s\d+$/, ''), mutation: 0, stufe: 1 };
  return { kreatur: m[1], mutation: Number(m[2]) - 1, stufe: Number(m[3]) };
}

/**
 * Ort des Regenten in Weltkoordinaten (Meter, x/z), abgeleitet aus lat/lon.
 *
 * Dieselbe Umrechnung wie in `baueTerrain` — sie steht hier noch einmal, weil die
 * Alternative wäre, `data/` von `world/` abhängig zu machen. Inhalte sollen die
 * Geometrie nicht kennen.
 */
export function regentOrt(
  id: string, bbox: [number, number, number, number],
  breiteMeter: number, tiefeMeter: number,
): [number, number] | null {
  const r = REGENTEN.get(id);
  if (!r) return null;
  const [sued, west, nord, ost] = bbox;
  const [lat, lon] = r.ort;
  return [
    ((lon - west) / (ost - west) - 0.5) * breiteMeter,
    ((nord - lat) / (nord - sued) - 0.5) * tiefeMeter,
  ];
}

/** Regent als Kämpfer — mit Phasen, damit die Engine das Element wechseln kann. */
export function baueRegent(id: string): Kaempfer {
  const r = REGENTEN.get(id);
  if (!r) throw new Error(`Regent '${id}' fehlt`);
  return erstelle({
    id: r.id,
    name: r.name,
    elemente: [...r.phasen[0].elemente],
    zustand: 'rein',
    maxKp: r.werte.kp,
    ang: r.werte.ang, ver: r.werte.ver, ini: r.werte.ini,
    moves: r.moves.map(moveDef),
    phasen: r.phasen.map(p => ({ elemente: [...p.elemente], abKpAnteil: p.abKpAnteil })),
  });
}
