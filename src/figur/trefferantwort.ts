/**
 * BRACHLAND — Antwort des Körpers auf einen erlittenen Treffer (D457), rein, ohne three.js.
 *
 * D427 lässt den Leib eines **Gegners** nach Impuls kippen (`kampf/gewicht.ts` `reaktion`). Die Spielfigur
 * spielte bisher nur ihren Rückstoss-Clip — immer denselben, egal woher und wie hart der Schlag kam. Hier
 * kommt die Richtung und die Wucht **additiv** über den Clip: Der Oberkörper kippt vom Angreifer weg und
 * schwingt aus (gedämpfte Schwingung, ein Ruck und ein halber Nachschwinger — kein Schweben).
 *
 * Mass der Wucht ist der **erlittene Schaden** — derselbe, nach dem die Kamera stösst (`kameraErlitten`).
 * Gegner führen in den Daten keine Waffenmasse; ein Impuls wie bei den Treffern der Spielerin lässt sich für
 * sie nicht rechnen (benannt, D398). Die Regel bleibt unberührt: Rückstoss, Betäubung und Schaden entscheidet
 * `echtzeit.ts`, hier bewegt sich nur das Bild.
 */
import { neueFeder, schwingSchritt, type Feder } from './feder.js';
import type { Figurlaufzeit } from '../data/schema.js';
import { GRAD } from './werte.js';

/** Kippung in zwei Achsen des Figurraums: `x` = zur Seite (lokal +X), `z` = nach hinten (lokal +Z). */
export interface Trefferantwort { x: Feder; z: Feder }

export const neueTrefferantwort = (): Trefferantwort => ({ x: neueFeder(), z: neueFeder() });

/** Scheitel einer gedämpften Schwingung, die mit Geschwindigkeit 1 aus der Ruhe startet (für die Eichung). */
function scheitelJeTempo(frequenz: number, daempfung: number): number {
  const w0 = 2 * Math.PI * frequenz, wd = w0 * Math.sqrt(1 - daempfung * daempfung);
  const t = Math.atan2(wd, daempfung * w0) / wd;
  return Math.exp(-daempfung * w0 * t) * Math.sin(wd * t) / wd;
}

/** Grösste Kippung in rad für einen Treffer mit `schaden`. */
export function trefferKippung(schaden: number, w: Figurlaufzeit['treffer']): number {
  return Math.min(w.maxGrad, w.gradJeSchaden * Math.max(0, schaden)) * GRAD;
}

/**
 * Einen Treffer aufnehmen. (`wegX`, `wegZ`): Einheitsrichtung vom Angreifer weg im Raum der Figur
 * (`wegVomAngreifer` aus `kampf/gewicht.ts`). `faktor` skaliert (Einstellung für Bewegungsempfindliche).
 */
export function stosseFigur(a: Trefferantwort, wegX: number, wegZ: number, schaden: number, w: Figurlaufzeit['treffer'], faktor = 1): void {
  const v = (trefferKippung(schaden, w) * Math.max(0, faktor)) / scheitelJeTempo(w.frequenz, w.daempfung);
  a.x.v += wegX * v; a.z.v += wegZ * v;
}

/** Zeit laufen lassen. Zurück: Kippung (rad) zur Seite und nach hinten; unter einem Zehntelgrad null. */
export function trefferSchritt(a: Trefferantwort, dt: number, w: Figurlaufzeit['treffer']): [number, number] {
  const x = schwingSchritt(a.x, w.frequenz, w.daempfung, dt);
  const z = schwingSchritt(a.z, w.frequenz, w.daempfung, dt);
  if (Math.abs(x) + Math.abs(z) + (Math.abs(a.x.v) + Math.abs(a.z.v)) * 0.05 < 0.0017) {
    a.x.x = a.x.v = a.z.x = a.z.v = 0;
    return [0, 0];
  }
  return [x, z];
}
