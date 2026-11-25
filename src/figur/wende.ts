/**
 * BRACHLAND — Wenden im Stand (D461), rein, ohne three.js.
 *
 * D460 hat `Koerper_Wenden_Links/_Rechts` (90°, 0,5 s, zwei Tritte) und `Koerper_Kehrt_Links/_Rechts` (180°, 0,75 s,
 * vier Tritte) gebaut: Sie beginnen um ihren Winkel gegen die neue Richtung zurückgedreht und enden im Stand; der
 * Standfuss liegt dabei fest (am Clip gemessen, `tests/gangclips.test.ts`).
 *
 * **Wie es ohne Fussgleiten geht.** Die Blickrichtung der Regel dreht stufenlos (Maus). Folgt die Hüfte ihr wie im
 * Gang, drehen die Füsse auf dem Boden mit. Deshalb im freien Stand (kein Kampf, kein Tempo, nicht im Sattel):
 *
 * 1. Die **Hüfte bleibt stehen** (`richtung`), der Blick läuft ihr davon; Rumpf und Kopf teilen sich den Winkel
 *    (`drehSchritt` mit `Standdrehung`).
 * 2. Ab `abGrad` Abstand spielt ein Wendeclip, ab `kehrtAbGrad` das Kehrt. Im selben Bild springt die Hüfte um
 *    **genau den Winkel des Clips** (90° / 180°) — der Clip beginnt um diesen Winkel zurückgedreht, das Bild bleibt
 *    stehen und die Füsse treten um. Der Rest (Blick − Hüfte) bleibt in Rumpf und Kopf, bis er wieder reicht.
 * 3. Die Clips drehen um die **Mitte des Stands**, die Figur um ihren Ursprung (die liegen 6 cm auseinander). Darum
 *    bleibt im freien Stand die Standmitte in der Welt liegen (`standVersatz`): Die Figur wird gegen den Ort der
 *    Regel um höchstens den doppelten Abstand versetzt gezeichnet; beim Losgehen klingt das ab.
 *
 * **Nicht aus dem Lauf:** Die Figur schaut immer in Blickrichtung und geht seitwärts und rückwärts, ohne sich zu
 * drehen — ihre Richtung springt im Lauf nie. Und die Clips enden im Stand, während die Regel das Tempo hält: Bei
 * 4,2 m/s glitten die Füsse über 0,5–0,75 s rund 2–3 m. Darum gibt es hier keinen Weg aus dem Lauf.
 *
 * **Kein Spielwert:** Wohin die Regel schaut, schlägt und geht, bleibt die Blickrichtung. Hier steht nur, wohin der
 * Körper darunter zeigt.
 */
import { falte } from './feder.js';
import type { Figurlaufzeit } from '../data/schema.js';
import { GRAD } from './werte.js';

export type Wendeclip = keyof Figurlaufzeit['wenden']['clips'];

export interface Wende {
  begonnen: boolean;
  /** Im freien Stand: Die Hüfte hält `richtung`. */
  frei: boolean;
  /** Blick der Regel und Standrichtung der Hüfte, beide abgewickelt (laufen nicht um). */
  ziel: number; richtung: number;
  /** Laufender Wendeclip, Sekunden seit seinem Beginn, seine Dauer. `nr` zählt die Wenden. */
  clip: Wendeclip | null; seit: number; dauer: number; nr: number;
  /** Standmitte in der Welt gegen den Ort der Regel, solange `frei` (`verankert`); Versatz der Figur in der Welt. */
  verankert: boolean; ankerX: number; ankerZ: number; ox: number; oz: number;
}

export const neueWende = (): Wende => ({
  begonnen: false, frei: false, ziel: 0, richtung: 0, clip: null, seit: 0, dauer: 0, nr: 0,
  verankert: false, ankerX: 0, ankerZ: 0, ox: 0, oz: 0,
});

/**
 * Einen Schritt führen. `gier`: Blickrichtung der Regel. `frei`: freier Stand (siehe oben). `ruhig`: es klingt
 * kein Übergang mehr ab — nur dann darf ein Wendeclip beginnen (er wechselt die Beine hart, siehe `laufzeit.ts`).
 * `dauern`: Länge der Clips in Sekunden. Zurück: der Winkel in rad, um den die Hüfte **in diesem Bild springt**
 * (positiv = nach links), 0 ohne neue Wende.
 */
export function wendeSchritt(w: Wende, gier: number, dt: number, frei: boolean, ruhig: boolean,
  dauern: { wenden: number; kehrt: number }, werte: Figurlaufzeit['wenden']): number {
  if (!w.begonnen) { w.begonnen = true; w.ziel = gier; w.richtung = gier; }
  w.ziel += falte(gier - w.ziel);
  if (!frei || !werte.an) {
    w.frei = false; w.clip = null; w.richtung = w.ziel;
    return 0;
  }
  if (!w.frei) { w.frei = true; w.richtung = w.ziel; w.clip = null; }
  if (w.clip) {
    w.seit += Math.max(0, dt);
    if (w.seit >= w.dauer) w.clip = null;
  }
  if (w.clip || !ruhig) return 0;
  const d = w.ziel - w.richtung, a = Math.abs(d);
  if (a < werte.abGrad * GRAD) return 0;
  const links = d > 0, kehrt = a >= werte.kehrtAbGrad * GRAD;
  const winkel = (kehrt ? Math.PI : Math.PI / 2) * (links ? 1 : -1);
  w.clip = kehrt ? (links ? 'kehrtLinks' : 'kehrtRechts') : (links ? 'wendenLinks' : 'wendenRechts');
  w.seit = 0; w.dauer = kehrt ? dauern.kehrt : dauern.wenden; w.nr++;
  w.richtung += winkel;
  return winkel;
}

/** Punkt (x, z) im Raum der Figur → Welt bei Hüftrichtung `h` (Drehung um die Hochachse wie `rotation.y`). */
export function dreheUmHoch(x: number, z: number, h: number): [number, number] {
  const c = Math.cos(h), s = Math.sin(h);
  return [x * c + z * s, -x * s + z * c];
}

/**
 * Versatz der Figur im **Raum der Figur** (x, z), so dass im freien Stand die Standmitte `mitte` (Raum der Figur)
 * in der Welt liegen bleibt, egal wie die Hüfte dreht — und wie sie springt. `huefte`: die gezeigte Hüftrichtung
 * dieses Bilds. Ausserhalb des freien Stands klingt der Versatz mit `halbwert` ab.
 */
export function standVersatz(w: Wende, huefte: number, mitte: readonly [number, number], dt: number, halbwert: number): [number, number] {
  if (w.frei) {
    const [rx, rz] = dreheUmHoch(mitte[0], mitte[1], huefte);
    if (!w.verankert) { w.verankert = true; w.ankerX = rx + w.ox; w.ankerZ = rz + w.oz; }
    w.ox = w.ankerX - rx; w.oz = w.ankerZ - rz;
  } else {
    w.verankert = false;
    const k = halbwert > 0 ? Math.pow(0.5, Math.max(0, dt) / halbwert) : 0;
    w.ox *= k; w.oz *= k;
    if (Math.abs(w.ox) + Math.abs(w.oz) < 1e-5) { w.ox = 0; w.oz = 0; }
  }
  return dreheUmHoch(w.ox, w.oz, -huefte);
}
