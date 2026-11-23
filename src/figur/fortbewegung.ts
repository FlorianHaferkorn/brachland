/**
 * BRACHLAND — Fortbewegung über den Clips (D457), rein, ohne three.js.
 *
 * Das **Tempo ist Spielwert** (`content/bewegung.json`, D412: Laufschritt 4,2 m/s, Rennen 8,5 m/s) und wird
 * hier nur gelesen. Die Spielregel setzt es ohne Anlauf — die Figur ist im ersten Bild schnell. Was dieses
 * Modul dazutut, ist die Darstellung, die das glaubhaft macht:
 *
 * - **Gang ans Tempo gekoppelt** (`gangMischung`): Geh- und Laufclip werden nach Tempo gemischt, im selben
 *   Schritt (`standMitte` gleicht die Phasen ab), und Schrittfrequenz und Schrittweite werden so gestellt, dass
 *   die Füsse die Strecke abdecken, die die Figur zurücklegt. Wie schnell ein Clip über den Boden kommt, wird am
 *   Clip **gemessen** (`natuerlichesTempo`), nicht geschätzt: Ändert D456 die Clips, stimmt die Kopplung weiter.
 *   **Befund 23.11.2026:** `Walk` kommt mit 1,03 m/s, `Run` mit 2,07 m/s über den Boden — angenommen waren 1,7
 *   und 6,5 (D145). Bei Laufschritt 4,2 m/s rutschten die Füsse deshalb mit rund 1,9 m/s. Mit Frequenz ×1,45 und
 *   Weite ×1,4 deckt `Run` 4,2 m/s; für Rennen 8,5 m/s reicht auch das nicht (`gleiten` ≈ 25 %) — dafür braucht
 *   es einen Sprintclip (D456).
 * - **Neigen** (`kurvenNeigung`, `schubNeigung`): in die Kurve und beim Anlaufen/Abstoppen. Physik (D398): Wer
 *   mit v um eine Kurve mit Drehrate ω läuft, lehnt um atan(v·ω/g); wer mit a beschleunigt, um atan(a/g).
 *   **Benannte Abweichung:** Gezeigt wird nur ein Anteil davon, geklemmt — die Drehrate kommt von der Maus und
 *   springt, die volle Lage wäre bei 8,5 m/s und einer schnellen Mausbewegung über 60°.
 * - **Drehkette** (`drehSchritt`): Der Blick dreht sofort (Regel), der Körper folgt versetzt — Kopf zuerst,
 *   dann Schultern, dann Hüfte.
 * - **Blick zum Ziel** (`blickWinkel`) mit Grenzen: Ein Kopf dreht nicht über die Schulter hinaus; liegt das
 *   Ziel hinter der Figur, gibt sie den Blick auf, statt am Anschlag zu kleben.
 * - **Atem** (`atemSchritt`): im Stand, schneller und tiefer nach Anstrengung, klingt mit der Erholung ab.
 */
import { federSchritt, falte, klemme, neueFeder, type Feder } from './feder.js';
import type { Figurlaufzeit } from '../data/schema.js';
import { G, GRAD } from './werte.js';

// ---- Gang ---------------------------------------------------------------------------------------------------

/** Ein Gangclip: wie schnell er bei Abspielrate 1 über den Boden kommt und wie lang ein Zyklus dauert. */
export interface Gang { tempo: number; dauer: number }

export interface Bahnpunkt { t: number; x: number; y: number; z: number }

/**
 * Tempo eines Gangclips aus der Bahn eines Fusses im Raum der Figur (ein Zyklus, gleichmässig abgetastet):
 * Solange der Fuss steht (tief über dem tiefsten Punkt seiner Bahn), wandert er im Clip nach hinten — genau so
 * schnell, wie der Körper vorankäme. Mittel der waagerechten Geschwindigkeit über die Standbilder; `null`,
 * wenn der Fuss nie steht oder sich dabei nicht bewegt (Stand-Clip).
 */
export function natuerlichesTempo(bahn: readonly Bahnpunkt[], standHoehe: number): number | null {
  if (bahn.length < 4) return null;
  let tief = Infinity;
  for (const p of bahn) tief = Math.min(tief, p.y);
  let weg = 0, zeit = 0;
  for (let i = 0; i + 1 < bahn.length; i++) {
    const a = bahn[i], b = bahn[i + 1];
    if (a.y - tief > standHoehe || b.y - tief > standHoehe) continue;
    weg += Math.hypot(b.x - a.x, b.z - a.z); zeit += b.t - a.t;
  }
  if (zeit <= 0) return null;
  const v = weg / zeit;
  return v > 0.2 ? v : null;
}

/**
 * Wo im Zyklus der Fuss steht: Mitte der Standphase als Phase 0…1 (Kreismittel über die Standbilder), `null`
 * ohne Standphase. Zwei Gangclips, die gemischt werden, müssen im selben Schritt stehen — die Differenz ihrer
 * Standmitten ist der Versatz, um den der zweite Clip verschoben abgespielt wird.
 */
export function standMitte(bahn: readonly Bahnpunkt[], standHoehe: number): number | null {
  if (bahn.length < 4) return null;
  const dauer = bahn[bahn.length - 1].t - bahn[0].t;
  if (!(dauer > 0)) return null;
  let tief = Infinity;
  for (const p of bahn) tief = Math.min(tief, p.y);
  let c = 0, sn = 0, n = 0;
  // Das letzte Bild ist das erste (Schleife) — nicht doppelt zählen.
  for (let i = 0; i + 1 < bahn.length; i++) {
    if (bahn[i].y - tief > standHoehe) continue;
    const w = ((bahn[i].t - bahn[0].t) / dauer) * 2 * Math.PI;
    c += Math.cos(w); sn += Math.sin(w); n++;
  }
  if (!n || Math.hypot(c, sn) < 1e-6) return null;
  return (Math.atan2(sn, c) / (2 * Math.PI) + 1) % 1;
}

export interface Gangmischung {
  /** Anteil des Laufclips, 0…1. */
  rennen: number;
  /** Phasenrate in Zyklen je Sekunde. */
  rate: number;
  /** Schrittweite gegen den Clip (1 = wie im Clip): Die Fuss-IK streckt oder staucht den Schritt in Laufrichtung. */
  weite: number;
  /** Strecke je Zyklus der Mischung bei Weite 1, m. */
  strecke: number;
  /** Anteil des Tempos, den Füsse nicht abdecken (0 = kein Gleiten; positiv = die Figur ist schneller als ihre Füsse). */
  gleiten: number;
}

/**
 * Mischung von Gehen und Rennen bei Tempo `v`. Zwischen den Clips wird die **Strecke je Zyklus** gemischt.
 * Was das Tempo darüber hinaus verlangt (Faktor F = v / natürliches Tempo der Mischung), teilen sich
 * **Schrittfrequenz** und **Schrittweite** zu gleichen Teilen (je √F) — so läuft auch ein Mensch schneller:
 * längere **und** schnellere Schritte. Beide sind geklemmt (`rateMin`/`rateMax` gegen die natürliche Rate,
 * `weiteMin`/`weiteMax`); schlägt eine an, übernimmt die andere den Rest. Erst wenn beide anschlagen, gleitet die
 * Figur — `gleiten` sagt, um wie viel, statt es zu verstecken.
 */
export function gangMischung(v: number, gehen: Gang, rennen: Gang, w: Pick<Figurlaufzeit['gang'], 'rateMin' | 'rateMax' | 'weiteMin' | 'weiteMax'>): Gangmischung {
  const a = rennen.tempo > gehen.tempo ? klemme((v - gehen.tempo) / (rennen.tempo - gehen.tempo), 0, 1) : 0;
  const strecke = gehen.tempo * gehen.dauer * (1 - a) + rennen.tempo * rennen.dauer * a;
  const natuerlich = 1 / (gehen.dauer * (1 - a) + rennen.dauer * a);
  const F = strecke > 0 ? Math.max(0, v) / (natuerlich * strecke) : 1;
  let weite = klemme(Math.sqrt(F), w.weiteMin, w.weiteMax);
  const r = klemme(F / weite, w.rateMin, w.rateMax);
  weite = klemme(F / r, w.weiteMin, w.weiteMax);
  const fuss = r * natuerlich * weite * strecke;
  return { rennen: a, rate: r * natuerlich, weite, strecke, gleiten: v > 1e-6 ? (v - fuss) / v : 0 };
}

// ---- Neigen -------------------------------------------------------------------------------------------------

/** Kurvenlage in rad, positiv = nach links (Drehrate positiv = Linkskurve, wie `gier`). */
export function kurvenNeigung(v: number, gierRate: number, w: Figurlaufzeit['neigen']): number {
  const max = w.kurveMaxGrad * GRAD;
  return klemme(Math.atan((v * gierRate) / G) * w.kurve, -max, max);
}

/** Lage beim Beschleunigen in rad, positiv = nach vorn (a > 0 Anlaufen, a < 0 Abstoppen lehnt zurück). */
export function schubNeigung(a: number, w: Figurlaufzeit['neigen']): number {
  const max = w.schubMaxGrad * GRAD;
  return klemme(Math.atan(a / G) * w.schub, -max, max);
}

// ---- Drehkette ----------------------------------------------------------------------------------------------

export interface Drehkette { ziel: number; kopf: Feder; schulter: Feder; huefte: Feder; begonnen: boolean }

export const neueDrehkette = (): Drehkette => ({ ziel: 0, kopf: neueFeder(), schulter: neueFeder(), huefte: neueFeder(), begonnen: false });

/**
 * Die Kette einen Schritt führen. `gier` ist die Blickrichtung der Regel (springt, läuft um). Zurück kommen die
 * Hüftrichtung (dreht die ganze Figur) und, relativ dazu, die Verdrehung von Schultern und Kopf — beide in
 * Drehrichtung voraus. `straff` 0…1 verkürzt die Verzögerung (im Schlag soll die Figur dorthin zeigen, wohin
 * die Regel schlägt: 1 = ohne Verzögerung).
 */
export function drehSchritt(k: Drehkette, gier: number, dt: number, w: Figurlaufzeit['drehen'], straff = 0):
  { huefte: number; schulter: number; kopf: number } {
  if (!k.begonnen) { k.begonnen = true; k.ziel = gier; k.kopf.x = k.schulter.x = k.huefte.x = gier; }
  k.ziel += falte(gier - k.ziel);
  const lose = 1 - klemme(straff, 0, 1), max = w.maxGrad * GRAD;
  for (const [f, hw] of [[k.kopf, w.kopf], [k.schulter, w.schulter], [k.huefte, w.huefte]] as const) {
    federSchritt(f, k.ziel, hw * lose, dt);
    // Nie weiter zurück als `max` — sonst schraubt sich die Figur bei einer schnellen Kehre auf.
    if (f.x < k.ziel - max) { f.x = k.ziel - max; f.v = Math.max(0, f.v); }
    if (f.x > k.ziel + max) { f.x = k.ziel + max; f.v = Math.min(0, f.v); }
  }
  return { huefte: k.huefte.x, schulter: k.schulter.x - k.huefte.x, kopf: k.kopf.x - k.schulter.x };
}

// ---- Blick --------------------------------------------------------------------------------------------------

/**
 * Wohin der Kopf drehen müsste, um von `kopf` auf `ziel` zu sehen, relativ zur Körperrichtung `koerperGier`
 * (0 = −Z, positiv nach links, wie überall): Gier und Nick in rad, geklemmt. `gilt` false, wenn das Ziel
 * weiter als `aufgebenGrad` seitlich/hinten liegt — dann schaut die Figur geradeaus.
 */
export function blickWinkel(
  kopf: readonly [number, number, number], ziel: readonly [number, number, number], koerperGier: number, w: Figurlaufzeit['blick'],
): { gier: number; nick: number; gilt: boolean } {
  const dx = ziel[0] - kopf[0], dy = ziel[1] - kopf[1], dz = ziel[2] - kopf[2];
  const weit = Math.hypot(dx, dz);
  if (weit < 0.05) return { gier: 0, nick: 0, gilt: false };
  const rel = falte(Math.atan2(-dx, -dz) - koerperGier);
  if (Math.abs(rel) > w.aufgebenGrad * GRAD) return { gier: 0, nick: 0, gilt: false };
  const gm = w.gierMaxGrad * GRAD, nm = w.nickMaxGrad * GRAD;
  return { gier: klemme(rel, -gm, gm), nick: klemme(Math.atan2(dy, weit), -nm, nm), gilt: true };
}

// ---- Atem ---------------------------------------------------------------------------------------------------

export interface Atem { phase: number; last: number }

export const neuerAtem = (): Atem => ({ phase: 0, last: 0 });

/**
 * Atem einen Schritt führen. `anstrengung` 0…1 (Tempo gegen Renntempo). Zurück: Hub in rad für die Brust
 * (positiv = Einatmen, Brust hebt sich). Die Last steigt über `anstieg` Sekunden und klingt über `erholung` ab.
 */
export function atemSchritt(a: Atem, anstrengung: number, dt: number, w: Figurlaufzeit['atem']): number {
  const ziel = klemme(anstrengung, 0, 1);
  const tau = ziel > a.last ? w.anstieg : w.erholung;
  a.last += (ziel - a.last) * (1 - Math.exp(-Math.max(0, dt) / tau));
  a.phase = (a.phase + dt * (w.ruheHz + (w.lastHz - w.ruheHz) * a.last)) % 1;
  return Math.sin(a.phase * 2 * Math.PI) * w.hubGrad * GRAD * (1 + a.last);
}
