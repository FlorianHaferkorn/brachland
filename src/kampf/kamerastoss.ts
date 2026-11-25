/**
 * BRACHLAND — Kamerastoss bei Treffern (D427, Einhängepunkt §27 Baukasten): Stärke, Abklingen und Richtung
 * kommen je Treffer aus `src/kampf/gewicht.ts` (`kameraGesetzt` nach Impuls, `kameraErlitten` nach Schaden).
 * Ein Anteil `anteil` des Ausschlags ist ein Stoss **in Schlagrichtung** (Kameraraum: x rechts, y oben, z vor),
 * der Rest das Zittern von D171 — beides klingt e-fach über `abklingen` aus. Die Einstellung `kamerawackeln`
 * (0/50/100 %, Zugänglichkeit) skaliert beides, 0 schaltet ab.
 *
 * Rein, ohne three.js (`tests/kamerastoss.test.ts`); die Kamera in `RegionsSzene.tsx` dreht den Versatz mit
 * ihrer Ausrichtung in die Welt.
 */
import type { Kamerastoss } from './gewicht.js';

export interface Stosszustand {
  /** m, klingt ab. */
  staerke: number;
  /** s, e-fach. */
  abklingen: number;
  richtung: [number, number, number] | null;
  anteil: number;
  /** s seit Start der Kamera — Phase des Zitterns. */
  uhr: number;
}

export const neuerStoss = (): Stosszustand => ({ staerke: 0, abklingen: 0.12, richtung: null, anteil: 0, uhr: 0 });

/**
 * Einen Stoss aufnehmen. Der stärkere gewinnt (zwei Treffer im selben Bild sind ein Ruck, keine Summe) —
 * wie bisher `Math.max` (D171). `faktor` ist die Einstellung `kamerawackeln` / 100.
 */
export function stosse(z: Stosszustand, s: Kamerastoss, faktor = 1): void {
  const st = s.staerke * Math.max(0, faktor);
  if (st <= z.staerke) return;
  z.staerke = st; z.abklingen = s.abklingen; z.richtung = s.richtung; z.anteil = s.richtung ? s.anteil : 0;
}

/** Zeit laufen lassen: Stärke klingt e-fach ab. */
export function klingeAb(z: Stosszustand, dt: number): void {
  z.uhr += dt;
  z.staerke *= Math.exp(-dt / Math.max(1e-3, z.abklingen));
  if (z.staerke < 1e-4) { z.staerke = 0; z.richtung = null; z.anteil = 0; }
}

/**
 * Versatz der Kamera im Kameraraum (x rechts, y oben, z vor), m. Unter 2 mm nichts (wie D171). Das Zittern
 * hat die Frequenzen von D171 (71/83/59 rad/s), der Stoss steht entlang `richtung`.
 */
export function stossVersatz(z: Stosszustand): [number, number, number] {
  if (z.staerke < 0.002) return [0, 0, 0];
  const u = z.uhr, zit = z.staerke * (1 - z.anteil), st = z.staerke * z.anteil;
  const r = z.richtung ?? [0, 0, 0];
  return [
    st * r[0] + zit * Math.sin(u * 71),
    st * r[1] + zit * Math.sin(u * 83 + 1.3),
    st * r[2] + zit * Math.sin(u * 59 + 2.1),
  ];
}
