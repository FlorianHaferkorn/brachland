/**
 * BRACHLAND — Übergangsarten und Clipzeit eines Hiebs (D457), rein, ohne three.js.
 *
 * **Die Regel ist die Wahrheit** (`src/kampf/echtzeit.ts`): Vorlauf, Aktiv, Erholung, `KOMBO_AB`. Dieses Modul
 * legt nur fest, **welche Stelle des Clips** zu welchem Augenblick der Regel gezeigt wird und wie lange der
 * Versatz beim Wechsel abklingt. Es ändert keinen Zeitpunkt, an dem etwas trifft oder abgebrochen werden darf.
 *
 * **Ketten ohne Rückkehr in die Hut:** Jeder Clip beginnt und endet in der Grundhaltung seiner Waffe. Folgt ein
 * Hieb auf einen Hieb, wäre der Weg „Nachschwung → Hut → Ausholen“ ein sichtbarer Umweg. Mit Clipmarken
 * (D456, `content/clipmarken.json`) geht es direkt:
 *
 * - `kettenpose` (Clipsekunde in der Erholung): Bis `KOMBO_AB` der Erholung läuft der Clip vom Durchzug genau
 *   bis dorthin — in dem Augenblick, in dem die Regel den nächsten Hieb erlaubt, steht die Figur in der Pose,
 *   aus der er kommt. Wird nicht gekettet, läuft der Rest der Erholung von dort in die Hut.
 * - `einstieg` (Clipsekunde im Ausholen): Ein geketteter Hieb beginnt dort statt bei 0 und überspringt den
 *   Weg aus der Hut; sein Vorlauf (unverändert lang) verteilt sich auf Einstieg → Scheitel.
 *
 * Ohne Marken: Einstieg 0, Erholung gleichmässig bis zum Clipende — die Zuordnung von vor D457, und der
 * Versatz zwischen Nachschwung und Clipanfang klingt per Inertialisierung ab (`inertial.ts`).
 */
import type { Figurlaufzeit } from '../data/schema.js';

/** Was die Figur gerade zeigt — bestimmt die Dauer des Übergangs. */
export type Bewegungsart = 'stand' | 'gang' | 'hut' | 'hieb' | 'block' | 'rolle' | 'treffer' | 'fall';

/**
 * Dauer, über die der Versatz beim Wechsel `von` → `nach` abklingt, aus den Daten. `gleicheArt` meint einen
 * Neustart innerhalb derselben Art (Hieb → Hieb ist die Kette, Rolle → Rolle eine zweite Rolle).
 */
export function uebergangsDauer(von: Bewegungsart, nach: Bewegungsart, u: Figurlaufzeit['uebergang']): number {
  if (nach === 'fall') return u.fall;
  if (nach === 'treffer') return u.treffer;
  if (nach === 'rolle') return u.rolle;
  if (nach === 'block') return u.block;
  if (nach === 'hieb') return von === 'hieb' ? u.kette : u.hutHieb;
  // Ab hier: zurück in Stand, Hut oder Gang.
  if (von === 'hieb') return u.hiebHut;
  if (von === 'rolle') return u.rolleEnde;
  if (von === 'treffer') return u.trefferEnde;
  if (von === 'block') return u.abbruch;
  if (von === 'gang' || nach === 'gang') return u.gang;
  return u.standard;
}

/** Wo im Clip Scheitel und Durchzug liegen (Clipsekunden), seine Länge und — wenn vorhanden — die Kettenmarken. */
export interface Hiebmarken {
  scheitel: number;
  durchzug: number;
  dauer: number;
  /** Clipsekunde, an der ein geketteter Hieb einsteigt (0 ≤ einstieg < scheitel). */
  einstieg?: number;
  /** Clipsekunde der Kettenpose in der Erholung (durchzug < kettenpose < dauer). */
  kettenpose?: number;
}

export interface Schlagzeiten { vorlauf: number; aktiv: number; erholung: number }

/**
 * Clipsekunde zu einem Augenblick der Regel. `ausKette`: Dieser Hieb folgte unmittelbar auf einen Hieb.
 * `komboAb` ist `KOMBO_AB` aus `echtzeit.ts` (Anteil der Erholung, ab dem der nächste Hieb darf).
 *
 * Ohne Marken und ohne Kette ist das genau die Zuordnung von D168/D171:
 * Vorlauf 0 → Scheitel, Aktiv Scheitel → Durchzug, Erholung Durchzug → Clipende.
 */
export function hiebClipzeit(
  phase: 'vorlauf' | 'aktiv' | 'erholung', zeit: number, s: Schlagzeiten, m: Hiebmarken, ausKette: boolean, komboAb: number,
): number {
  const anteil = (dauer: number) => (dauer > 0 ? Math.max(0, Math.min(1, zeit / dauer)) : 1);
  let sek: number;
  if (phase === 'vorlauf') {
    const start = ausKette && m.einstieg !== undefined && m.einstieg > 0 && m.einstieg < m.scheitel ? m.einstieg : 0;
    sek = start + (m.scheitel - start) * anteil(s.vorlauf);
  } else if (phase === 'aktiv') {
    sek = m.scheitel + (m.durchzug - m.scheitel) * anteil(s.aktiv);
  } else {
    const u = anteil(s.erholung), kp = m.kettenpose;
    if (kp !== undefined && kp > m.durchzug && kp < m.dauer && komboAb > 0 && komboAb < 1) {
      sek = u < komboAb ? m.durchzug + (kp - m.durchzug) * (u / komboAb)
        : kp + (m.dauer - kp) * ((u - komboAb) / (1 - komboAb));
    } else sek = m.durchzug + (m.dauer - m.durchzug) * u;
  }
  return Math.min(sek, m.dauer * 0.999);
}
