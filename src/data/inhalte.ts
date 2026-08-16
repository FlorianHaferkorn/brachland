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
import { Kreatur, Move, Regent } from './schema.js';
import { erstelle, type Kaempfer, type MoveDef, type Band } from '../engine/battle.js';

type Roh = Record<string, unknown>;

const moveRoh = import.meta.glob('../../content/moves/*.json', { eager: true, import: 'default' }) as Roh;
const kreaturRoh = import.meta.glob('../../content/creatures/*.json', { eager: true, import: 'default' }) as Roh;
const regentRoh = import.meta.glob('../../content/regenten/*.json', { eager: true, import: 'default' }) as Roh;

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

/** Nur die fangbaren Wildlinge — daraus werden Begegnungen gebaut. */
export const WILDLINGE = [...KREATUREN.values()].filter(k => k.ursprung === 'wildling');

export function moveDef(id: string): MoveDef {
  const m = MOVES.get(id);
  if (!m) throw new Error(`Move '${id}' fehlt — npm run validate haette das gefunden`);
  return { id: m.id, name: m.name, element: m.element, band: m.band as Band };
}

/**
 * Baut einen Kämpfer aus Kreatur und Stufe.
 *
 * Moveset nach Roster-Regel: die zwei Grundmoves plus jeden Signaturmove der
 * erreichten Stufen. Eine dreistufige Linie hat auf S3 damit vier Moves — genau die
 * vier Slots, die das Move-System vorsieht.
 */
export function baueKaempfer(
  kreaturId: string, stufe = 0, zustand: Kaempfer['zustand'] = 'rein',
): Kaempfer {
  const k = KREATUREN.get(kreaturId);
  if (!k) throw new Error(`Kreatur '${kreaturId}' fehlt`);
  const i = Math.max(0, Math.min(stufe, k.stufen.length - 1));
  const s = k.stufen[i];
  const ids = [
    ...k.grundMoves,
    ...k.stufen.slice(0, i + 1).map(x => x.signaturMove).filter((x): x is string => !!x),
  ];
  return erstelle({
    id: `${k.id}-s${i + 1}`,
    name: s.name,
    elemente: [...k.elemente],
    zustand,
    maxKp: s.werte.kp,
    ang: s.werte.ang, ver: s.werte.ver, ini: s.werte.ini,
    moves: ids.map(moveDef),
  });
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
