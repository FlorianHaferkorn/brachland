/**
 * BRACHLAND — Körpersprache der Gegner über den Clips (D458), rein, ohne three.js.
 *
 * **Die Regel ist die Wahrheit** (`src/kampf/echtzeit.ts`): Vorlauf, Aktiv, Erholung, Betäubung, Aufgabe (D426),
 * gereinigt (D417). Dieses Modul rechnet nur, **wie der Körper das zeigt** — als Zusatz über dem Clip, zeitlich
 * genau an die Phase gebunden: Es liest `phase` und `zeit` der Regel und ändert keinen Zeitpunkt.
 *
 * - `ansagePose`: Der Vorlauf eines Angriffs als Körperbewegung. Messlatte D432 (For Honor, Soulframe): Man liest
 *   den Schlag am Körper, bevor die Farbe es sagt. Gewicht zurück, Kopf senkt sich, Ducken oder Steigen, Scharren;
 *   beim Menschen dreht der Rumpf ins Ausholen. Die Spannung steigt **früh** (nach `anstieg` des Vorlaufs steht
 *   die Pose) und hält bis zum Schlag — ein gespannter Bogen, kein gleichmässiges Wachsen. Im Aktiv entlädt sie
 *   sich. **Richtungsangriffe (ADR-0009)** zeigen die Seite: Kopf und Schultern drehen dorthin, woher der Schlag
 *   kommt — und zwar auf die Seite **des Bildschirms**, die die Linienraute der Anzeige zeigt (`seitenZeichen`).
 * - `taumelPose`: Betäubung als Taumeln mit Gewicht — ein Körper, der um seine Füsse schwankt, schwingt wie ein
 *   umgekehrtes Pendel: je höher der Schwerpunkt, desto langsamer (f ∝ 1/√h, D398). Der Kopf hängt und kommt nach.
 * - `schuettelPose`: Das gereinigte Tier schüttelt sich (D417), vom Kopf nach hinten laufend.
 * - `sturzVerlauf`: Fall eines starren Leibs — beschleunigt wie ein kippender Körper, setzt auf, federt einmal nach.
 * - `wendeSchritt`: Abwenden mit begrenzter Drehrate statt eines Sprungs um 180°.
 *
 * Achsen wie in `vierbeiner.ts`: vorn −Z, rechts +X; Rumpf-Nicken positiv = vorn hoch; **Kopf-Nicken positiv =
 * Kopf senkt sich**; Rollen positiv = nach links geneigt; Gier positiv = nach links gedreht.
 */
import { klemme } from './feder.js';
import { GRAD } from './werte.js';
import type { Figurgegner } from '../data/schema.js';

export type Linie = 'oben' | 'unten' | 'links' | 'rechts';
export type Ansageprofil = Figurgegner['ansage']['profile'][string];

/** Zusatz über dem Clip: Rumpf als Ganzes (m, rad), Verdrehung der Wirbelsäule, Kopf. */
export interface Zusatz {
  rumpfX: number; rumpfY: number; rumpfZ: number;
  rumpfNick: number; rumpfRoll: number; rumpfGier: number;
  kopfNick: number; kopfGier: number; kopfRoll: number;
}

export const neuerZusatz = (): Zusatz => ({ rumpfX: 0, rumpfY: 0, rumpfZ: 0, rumpfNick: 0, rumpfRoll: 0, rumpfGier: 0, kopfNick: 0, kopfGier: 0, kopfRoll: 0 });

export function leereZusatz(z: Zusatz): Zusatz {
  z.rumpfX = z.rumpfY = z.rumpfZ = z.rumpfNick = z.rumpfRoll = z.rumpfGier = z.kopfNick = z.kopfGier = z.kopfRoll = 0;
  return z;
}

/**
 * Auf welche Seite des **eigenen** Körpers der Angreifer für eine Linie ausholt: +1 = nach links (Gier positiv),
 * −1 = nach rechts, 0 = oben/unten. Die Anzeige zeigt `rechts` rechts in der Raute, und die Spielerin steht dem
 * Angreifer gegenüber — was sie rechts im Bild sieht, ist **seine linke** Seite. (So lag es auch vor D458: der
 * Wegelagerer holte für `rechts` mit `Klinge_U_A` nach seiner Linken aus, gemessen an `hand_r` am Scheitel.)
 */
export function seitenZeichen(linie: Linie | undefined): -1 | 0 | 1 {
  return linie === 'rechts' ? 1 : linie === 'links' ? -1 : 0;
}

/**
 * Spannung der Ansage 0…1 zu einem Augenblick der Regel: im Vorlauf steigt sie bis `anstieg` (Anteil des Vorlaufs)
 * und hält; im Aktiv entlädt sie sich; sonst 0. Stetig über Vorlauf → Aktiv (beide Seiten 1), monoton im Vorlauf.
 */
export function ansageSpannung(phase: string, zeit: number, vorlauf: number, aktiv: number, anstieg: number): number {
  if (phase === 'vorlauf') {
    const u = vorlauf > 0 ? klemme(zeit / (vorlauf * klemme(anstieg, 0.05, 1)), 0, 1) : 1;
    return 1 - (1 - u) ** 3;
  }
  if (phase === 'aktiv') {
    const u = aktiv > 0 ? klemme(zeit / aktiv, 0, 1) : 1;
    return 1 - u * u * (3 - 2 * u);
  }
  return 0;
}

/**
 * Die Ansage als Zusatz. `staerke` skaliert (Folgeschlag einer Kette kommt aus der Bewegung: kleiner).
 * `zeit` läuft in der Phase der Regel; Scharren und Zittern hängen an derselben Uhr, damit die Pose bei gleicher
 * Regelzeit dieselbe ist (Wiederholbarkeit, Messbilder).
 */
export function ansagePose(
  p: Ansageprofil, phase: string, zeit: number, schlag: { vorlauf: number; aktiv: number }, linie: Linie | undefined,
  staerke = 1, aus: Zusatz = neuerZusatz(),
): Zusatz & { spannung: number } {
  const a = aus as Zusatz & { spannung: number };
  leereZusatz(a);
  const k = ansageSpannung(phase, zeit, schlag.vorlauf, schlag.aktiv, p.anstieg) * Math.max(0, staerke);
  a.spannung = k;
  if (k <= 0) return a;
  const seite = seitenZeichen(linie), hoch = linie === 'oben' ? 1 : linie === 'unten' ? -1 : 0;
  a.rumpfZ = p.zurueck * k;
  a.rumpfY = p.hoch * k + Math.abs(Math.sin(zeit * 2 * Math.PI * p.scharrHz)) * p.scharrHub * k;
  a.rumpfNick = p.nickGrad * GRAD * k;
  a.rumpfRoll = Math.sin(zeit * 2 * Math.PI * p.zitterHz) * p.zitterGrad * GRAD * k + seite * p.seiteRollGrad * GRAD * k;
  a.rumpfGier = seite * p.seiteRumpfGrad * GRAD * k;
  // Linie oben hebt den Kopf (er kommt von oben), unten senkt ihn zusätzlich.
  a.kopfNick = (p.kopfGrad - hoch * p.linieKopfGrad) * GRAD * k;
  a.kopfGier = seite * p.seiteKopfGrad * GRAD * k;
  a.kopfRoll = seite * p.seiteRollGrad * GRAD * k;
  return a;
}

// ---- Taumeln --------------------------------------------------------------------------------------------------

export type TaumelWerte = Figurgegner['taumel'];

export interface Taumel { roll: number; nick: number; seit: number; sinken: number; kopfNick: number; kopfRoll: number }

/** Frequenz des Schwankens für einen Körper der Höhe `hoehe` (m): Pendelgesetz, auf 1 m bezogen. */
export const taumelHz = (hoehe: number, w: Pick<TaumelWerte, 'hzBei1m'>): number => w.hzBei1m / Math.sqrt(Math.max(0.2, hoehe));

/**
 * Taumeln zur Zeit `t` seit Beginn der Betäubung. `dauer`: wie lange die Regel betäubt; `ausschlag` in rad
 * (nach Haltungsbruch aus der Wucht des brechenden Schlags, D427; sonst der Grundwert). Die Hüllkurve fällt bis
 * `rest` und bleibt dort — wer betäubt ist, steht nicht still, bevor die Regel ihn loslässt. `seit` ist der Weg
 * des Schwerpunkts zur Seite (m), `sinken` das Nachgeben der Beine (m, ≤ 0).
 */
export function taumelPose(t: number, dauer: number, ausschlag: number, hoehe: number, w: TaumelWerte): Taumel {
  const huelle = Math.max(w.rest, 1 - t / Math.max(0.01, dauer));
  const ph = 2 * Math.PI * taumelHz(hoehe, w) * Math.max(0, t);
  const roll = Math.sin(ph) * ausschlag * huelle;
  return {
    roll,
    // Vor und zurück mit halber Frequenz und versetzt: der Schwerpunkt läuft eine liegende Acht, kein Metronom.
    nick: Math.sin(ph * 0.5 + 1) * ausschlag * w.nickAnteil * huelle,
    seit: Math.sin(roll) * hoehe * w.hebel,
    sinken: -w.sinken * huelle,
    kopfNick: w.kopfGrad * GRAD * huelle,
    // Der Kopf kommt dem Rumpf nach (Phasenverzug) und schlägt nach der Gegenseite aus — er hängt.
    kopfRoll: -Math.sin(ph - w.kopfVerzug) * ausschlag * w.kopfAnteil * huelle,
  };
}

// ---- Schütteln ------------------------------------------------------------------------------------------------

export type SchuettelWerte = Figurgegner['schuetteln'];

/**
 * Frequenz des Schüttelns nach Körpermasse: f = `hzBei30kg` · (m / 30 kg)^`exponent`. Grosse Tiere schütteln
 * langsamer (Dickerson, Mills, Hu: „Wet mammals shake at tuned frequencies to dry“, J. R. Soc. Interface 2012 —
 * f ∝ M^−0,22; aus dem Gedächtnis zitiert, die Zahl steht als Wert in den Daten und ist dort benannt).
 */
export const schuettelHz = (masseKg: number, w: Pick<SchuettelWerte, 'hzBei30kg' | 'exponent'>): number =>
  w.hzBei30kg * Math.pow(Math.max(1, masseKg) / 30, w.exponent);

/**
 * Schütteln zur Zeit `t` seit dem Ende des Kampfs für dieses Tier: beginnt nach `beginn`, dauert `dauer`,
 * schwillt an und ab (sin²). Der Kopf führt, der Rumpf folgt um `welle` (rad) versetzt und kleiner.
 */
export function schuettelPose(t: number, masseKg: number, w: SchuettelWerte): { kopfRoll: number; rumpfRoll: number } {
  const u = (t - w.beginn) / w.dauer;
  if (!(u > 0 && u < 1)) return { kopfRoll: 0, rumpfRoll: 0 };
  const huelle = Math.sin(Math.PI * u) ** 2, ph = 2 * Math.PI * schuettelHz(masseKg, w) * (t - w.beginn);
  return { kopfRoll: Math.sin(ph) * w.kopfGrad * GRAD * huelle, rumpfRoll: Math.sin(ph - w.welle) * w.rumpfGrad * GRAD * huelle };
}

// ---- Sturz und Wende ------------------------------------------------------------------------------------------

/**
 * Anteil 0…1 des Kippens eines starren Leibs zur Zeit `t`: Ein kippender Körper beschleunigt (anfangs ∝ t²), setzt
 * bei `dauer` auf und federt einmal um `prall` nach (der Leib ist weich, kein Brett). Danach genau 1 — er liegt.
 */
export function sturzVerlauf(t: number, dauer: number, prall = 0.05, nach = 0.25): number {
  if (!(t > 0)) return 0;
  if (t < dauer) { const u = t / dauer; return u * u; }
  const n = (t - dauer) / Math.max(1e-3, nach);
  if (n >= 1) return 1;
  return 1 - prall * Math.sin(Math.PI * n) * (1 - n);
}

/** Winkel `ist` auf kürzestem Weg um höchstens `rate`·`dt` (rad) auf `soll` zu drehen. */
export function wendeSchritt(ist: number, soll: number, rate: number, dt: number): number {
  let d = (soll - ist) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  const max = Math.max(0, rate * dt);
  return Math.abs(d) <= max ? soll : ist + Math.sign(d) * max;
}
