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
import { Kreatur, Move, Regent, Gegenstand, Fragment, Ort, Auftrag, NARBE } from './schema.js';
import { erstelle, type Kaempfer, type MoveDef, type Band } from '../engine/battle.js';
import { mutationBei, werteBei, STUFE_MAX } from '../spiel/fortschritt.js';

type Roh = Record<string, unknown>;

const moveRoh = import.meta.glob('../../content/moves/*.json', { eager: true, import: 'default' }) as Roh;
const kreaturRoh = import.meta.glob('../../content/creatures/*.json', { eager: true, import: 'default' }) as Roh;
const regentRoh = import.meta.glob('../../content/regenten/*.json', { eager: true, import: 'default' }) as Roh;
const gegenstandRoh = import.meta.glob('../../content/gegenstaende/*.json', { eager: true, import: 'default' }) as Roh;
const fragmentRoh = import.meta.glob('../../content/fragmente/*.json', { eager: true, import: 'default' }) as Roh;
const ortRoh = import.meta.glob('../../content/orte/*.json', { eager: true, import: 'default' }) as Roh;
const auftragRoh = import.meta.glob('../../content/auftraege/*.json', { eager: true, import: 'default' }) as Roh;

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
export const FRAGMENTE = lade(fragmentRoh, Fragment, 'Fragment');
export const ORTE = lade(ortRoh, Ort, 'Ort');
export const AUFTRAEGE = [...lade(auftragRoh, Auftrag, 'Auftrag').values()];

/**
 * Alles, was streift — daraus werden Begegnungen gebaut.
 *
 * Hier stand `ursprung === 'wildling'`, und das ging gut, solange 12 von 13 Linien
 * Wildlinge waren. Mit der ersten **Zuchtlinie** (K7) fiel auf, dass die Bedingung
 * die falsche Frage stellt: Herkunft sagt, *woher* eine Kreatur kommt, nicht *ob*
 * sie durch die Landschaft läuft. Der K7 wäre Inhalt gewesen, den niemand je
 * antrifft — `npm run vorkommen` hat ihn mit 0 Vorkommen geführt.
 *
 * Die richtige Frage ist die Häufigkeit: `fest` heißt „steht an einer Position"
 * (Verwachsene, Uniques), alles andere streift.
 *
 * **Seit G-130 gehen auch die Festen in die Welt.** Bis dahin filterte diese
 * Liste `fest` heraus, und `verteileKreaturen` hätte mit der leeren Zellenliste
 * ohnehin nichts gesetzt — der Trafomarder stand an keinem Ort, mit Modell,
 * Anbau und Herkunftszeile. Jetzt setzt `verteileKreaturen` eine feste Art an
 * ihre `position`; die Liste hier enthält deshalb alle Arten. Der Name bleibt,
 * weil die Szene sie als „was in der Welt steht" liest.
 */
export const STREUNENDE = [...KREATUREN.values()];

export function moveDef(id: string): MoveDef {
  const m = MOVES.get(id);
  if (!m) throw new Error(`Move '${id}' fehlt — npm run validate haette das gefunden`);
  // `effekte` wurden hier bis eben verworfen — alle 49 Moves trugen sie im JSON,
  // und die Engine hat sie nie gesehen. Jetzt reichen sie durch.
  return { id: m.id, name: m.name, element: m.element, band: m.band as Band, effekte: m.effekte };
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
    // Die Narbe folgt aus der Herkunft, nicht aus den Daten der Kreatur — jede
    // Zuchtlinie trägt dieselbe Systemnarbe, jeder Wildling dieselbe Fellnarbe.
    // `erstelle` verwirft sie bei jedem anderen Zustand als `rueckgefuehrt`.
    narbe: NARBE[k.ursprung],
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

const METER_JE_GRAD = 111_320;

/**
 * Ausdehnung einer Region in Metern aus ihrer Bounding Box.
 *
 * Stand dreimal wortgleich in `main.tsx` — beim Regenten, bei den Fundstellen und
 * beinahe ein viertes Mal bei den Orten. Drei Kopien derselben Formel sind drei
 * Gelegenheiten, sie unterschiedlich zu ändern.
 */
export function regionsMasse(bbox: readonly [number, number, number, number]) {
  const [sued, west, nord, ost] = bbox;
  const mittelLat = (sued + nord) / 2;
  return {
    breite: (ost - west) * METER_JE_GRAD * Math.cos(mittelLat * Math.PI / 180),
    tiefe: (nord - sued) * METER_JE_GRAD,
  };
}

/**
 * lat/lon nach Weltkoordinaten (Meter, x/z).
 *
 * Dieselbe Umrechnung wie in `baueTerrain` — sie steht hier noch einmal, weil die
 * Alternative wäre, `data/` von `world/` abhängig zu machen. Inhalte sollen die
 * Geometrie nicht kennen.
 */
export function nachMetern(
  latlon: readonly [number, number], bbox: readonly [number, number, number, number],
): [number, number] {
  const [sued, west, nord, ost] = bbox;
  const { breite, tiefe } = regionsMasse(bbox);
  return [
    ((latlon[1] - west) / (ost - west) - 0.5) * breite,
    ((nord - latlon[0]) / (nord - sued) - 0.5) * tiefe,
  ];
}

export function regentOrt(
  id: string, bbox: readonly [number, number, number, number],
): [number, number] | null {
  const r = REGENTEN.get(id);
  return r ? nachMetern(r.ort, bbox) : null;
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
