/**
 * BRACHLAND — Gewicht spürbar machen (D420, Grundsatz D419): aus Masse, Trägheit und Treffer-Impuls einer
 * Waffe die **Darstellung** ableiten — Trefferstopp, Kameraimpuls, Reaktion des Getroffenen, Ton und wie lange
 * der Körper im Clip der Masse folgt.
 *
 * **Kein Kampfwert.** Vorlauf, Aktiv, Erholung, Schaden, Haltungsschaden, Kosten, Rückstoss und Schritt stehen
 * in `content/waffen/` und sind über den Kampfbot geprüft; dieses Modul liest sie höchstens (das Verhältnis der
 * Haltungsschäden innerhalb einer Waffe gibt die Wucht eines Schlags gegen ihren ersten leichten).
 *
 * Die Physik ist die des Baukastens (`src/kampf/baukasten.ts`, Dokument §3.2), hier absolut gerechnet statt als
 * Faktor gegen den Referenzbau: Masse und Trägheit um die Griffhand aus `koerper` (dieselben Teile, derselbe
 * Steinersche Satz), und konstante Muskelleistung P beschleunigt Arm und Waffe aus der Ruhe:
 *   Schwung:  ½ (I_Arm + I) ω² = P t,  θ = ∫ω dt  ⇒  t = (9 (I_Arm + I) θ² / 8P)^⅓,  ω = √(2 P t / (I_Arm + I))
 *   Stoss:    dasselbe geradeaus mit m_Arm + M und dem Weg s
 *   Impuls am Kopf (Schwung) J = I ω / d  — wie `faktoren`: √(E·I)/d;  Stoss J = M v
 *   Bremsweg nach dem Treffer = Energie / Bremsmoment (der Arm fängt die Waffe ab)
 * t ∝ (I_Arm + I)^⅓ ist genau die Schlagzeit des Baukastens; nur die Konstanten (P, θ, s, Bremsmoment) sind neu
 * und stehen mit „nicht belegt“ in `content/gewicht.json`.
 *
 * Rein, ohne three.js und React (`tests/gewicht.test.ts`). Verdrahtet ist es noch nicht — die Einhängepunkte
 * in Kampfplatz, Kamera und Ton stehen im Baukasten-Dokument, Abschnitt „Gewicht spürbar machen (D420)“.
 */
import GEWICHT_ROH from '../../content/gewicht.json';
import WAFFENTEILE_ROH from '../../content/waffenteile.json';
import type { Gewicht, Waffenbaukasten } from '../data/schema.js';
import { koerper } from './baukasten.js';
import type { Linie } from './echtzeit.js';

/** Die Kennzahlen der Darstellung, geprüft von `npm run validate`. */
export const GEWICHT = GEWICHT_ROH as Gewicht;
const TEILE = WAFFENTEILE_ROH as unknown as Waffenbaukasten;   // geprüft von `npm run validate`

/** Was an einer Waffe für ihr Gewicht zählt, in echten Einheiten. */
export interface Waffenkoerper {
  id: string;
  /** kg */
  masse: number;
  /** kg·m² um die Griffhand */
  traegheit: number;
  /** Hebel des Impulses: Schwerpunkt des Kopfs oder Blatts vor der Hand, m. */
  kopfAbstand: number;
  /** Spitze oder Schneide vor der Hand, m. */
  spitze: number;
  bewegung: 'schwung' | 'stoss';
  zweihand: boolean;
}

export function waffenkoerper(id: string, g: Gewicht = GEWICHT, k: Waffenbaukasten = TEILE): Waffenkoerper {
  const w = g.waffen[id];
  if (!w) throw new Error(`Gewicht: Waffe '${id}' fehlt in content/gewicht.json`);
  if ('baukasten' in w) {
    const f = k.familien[w.baukasten];
    const b = koerper(k, w.baukasten, f.referenz);
    return { id, masse: b.masse, traegheit: b.traegheit, kopfAbstand: b.kopfAbstand, spitze: b.spitze,
      bewegung: f.bewegung, zweihand: w.zweihand };
  }
  return { id, masse: w.masse, traegheit: w.traegheit, kopfAbstand: w.kopfAbstand, spitze: w.spitze,
    bewegung: w.bewegung, zweihand: w.zweihand };
}

/** Ein Schlag aus voller Leistung bis zum Treffer. */
export interface Schwung {
  /** s bis zum Treffer — dieselbe Proportion wie die Schlagzeit des Baukastens. */
  zeit: number;
  /** rad/s (Schwung) bzw. m/s (Stoss) im Treffer. */
  tempo: number;
  /** m/s der Spitze. */
  spitzeTempo: number;
  /** J, Bewegungsenergie der Waffe allein. */
  energie: number;
  /** N·s am Treffpunkt. */
  impuls: number;
  /** s, bis der Arm die Waffe nach dem Treffer abgefangen hat (Drehimpuls / Bremsmoment). */
  bremszeit: number;
  /** Nachschwung bis zum Halt: Grad (Schwung) bzw. Meter (Stoss) = Energie / Bremsmoment. */
  bremsweg: number;
}

export function schwung(w: Waffenkoerper, g: Gewicht = GEWICHT, k: Waffenbaukasten = TEILE): Schwung {
  const p = g.physik;
  const haende = w.zweihand ? 2 : 1;
  const P = p.leistung * (w.zweihand ? p.zweihand : 1);
  const moment = p.bremsmoment * haende;
  if (w.bewegung === 'stoss') {
    const m = k.physik.armMasse + w.masse, s = p.stossWeg;
    const zeit = Math.cbrt(9 * m * s * s / (8 * P));
    const v = Math.sqrt(2 * P * zeit / m);
    const energie = 0.5 * w.masse * v * v, impuls = w.masse * v, kraft = moment / p.unterarm;
    return { zeit, tempo: v, spitzeTempo: v, energie, impuls, bremszeit: impuls / kraft, bremsweg: energie / kraft };
  }
  const I = k.physik.armTraegheit + w.traegheit, theta = p.bogenGrad * Math.PI / 180;
  const zeit = Math.cbrt(9 * I * theta * theta / (8 * P));
  const omega = Math.sqrt(2 * P * zeit / I);
  const energie = 0.5 * w.traegheit * omega * omega;
  return { zeit, tempo: omega, spitzeTempo: omega * w.spitze, energie, impuls: w.traegheit * omega / w.kopfAbstand,
    bremszeit: w.traegheit * omega / moment, bremsweg: energie / moment * 180 / Math.PI };
}

/**
 * Wucht eines Schlags gegen den ersten leichten derselben Waffe, aus der Regel gelesen: Der Haltungsschaden
 * folgt im Baukasten dem Impuls (§3.2), also trägt das Verhältnis die Wucht. Ohne Kampfwerte (Messer,
 * Hirschfänger) 1.
 */
export function schlagWucht(schlag?: { haltungsschaden: number }, ersterLeicht?: { haltungsschaden: number }): number {
  if (!schlag || !ersterLeicht || ersterLeicht.haltungsschaden <= 0) return 1;
  return schlag.haltungsschaden / ersterLeicht.haltungsschaden;
}

/** Treffer-Impuls in N·s: der der Waffe mal die Wucht des Schlags. */
export function trefferImpuls(id: string, wucht = 1, g: Gewicht = GEWICHT): number {
  return schwung(waffenkoerper(id, g), g).impuls * wucht;
}

export interface Trefferlage { gebrochen?: boolean; toedlich?: boolean; geblockt?: boolean }

/**
 * Wie lange die Welt nach dem Treffer still steht (s): linear im Impuls zwischen `impulsVon` und `impulsBis`,
 * dazu ein Zuschlag für Haltungsbruch und tödlichen Treffer; ein Block halbiert. Höchstens `max` + `toedlich`.
 */
export function trefferstopp(impuls: number, lage: Trefferlage = {}, g: Gewicht = GEWICHT): number {
  const t = g.trefferstopp;
  const a = Math.max(0, Math.min(1, (impuls - t.impulsVon) / (t.impulsBis - t.impulsVon)));
  let s = t.min + (t.max - t.min) * a;
  if (lage.geblockt) s *= t.geblockt;
  if (lage.gebrochen) s += t.gebrochen;
  s = Math.min(t.max, s);
  if (lage.toedlich) s += t.toedlich;
  return s;
}

/** Ein Kamerastoss: Stärke in Metern, Abklingzeit (e-fach) in s, Richtung im Raum der Kamera (x rechts, y oben, z vor). */
export interface Kamerastoss { staerke: number; abklingen: number; richtung: [number, number, number] | null; anteil: number }

/** Richtung, in die die Waffe beim Treffer läuft: Ein Hieb von rechts zieht nach links, einer von oben nach unten. */
export function schlagRichtung(linie: Linie | undefined, bewegung: 'schwung' | 'stoss'): [number, number, number] {
  if (bewegung === 'stoss') return [0, 0, 1];
  switch (linie) {
    case 'rechts': return [-1, 0, 0];
    case 'links': return [1, 0, 0];
    case 'oben': return [0, -1, 0];
    case 'unten': return [0, 0, 1];
    default: return [0, 0, 1];
  }
}

/** Kamerastoss beim eigenen Treffer — wächst mit dem Impuls, klingt länger aus, je schwerer. */
export function kameraGesetzt(impuls: number, richtung: [number, number, number] | null, g: Gewicht = GEWICHT): Kamerastoss {
  const c = g.kamera;
  return {
    staerke: Math.min(c.gesetzt.max, c.gesetzt.grund + c.gesetzt.jeImpuls * impuls),
    abklingen: Math.min(c.abklingen.max, c.abklingen.grund + c.abklingen.jeImpuls * impuls),
    richtung, anteil: richtung ? c.richtung : 0,
  };
}

/** Kamerastoss beim erlittenen Treffer — nach dem Schaden des Gegners (seine Waffe hat keine Masse in den Daten). */
export function kameraErlitten(schaden: number, g: Gewicht = GEWICHT): Kamerastoss {
  const c = g.kamera;
  return { staerke: Math.min(c.erlitten.max, c.erlitten.grund + c.erlitten.jeSchaden * schaden),
    abklingen: c.abklingen.grund, richtung: null, anteil: 0 };
}

/** Masse des Getroffenen in kg. */
export function zielMasse(id: string, g: Gewicht = GEWICHT): number {
  return g.ziele.je[id] ?? g.ziele.standard;
}

/** Wie der Leib des Getroffenen im Bild antwortet. Die Kapsel der Regel bewegt nur ihr Rückstoss. */
export interface Reaktion {
  /** m/s, Impuls / Masse. */
  dv: number;
  /** Grad, um die der Körper vom Angreifer weg kippt. */
  neigung: number;
  /** m, um die der Körper (nicht die Kapsel) nachgibt — der Weg beim Abbremsen von dv auf 0 über `dauer`. */
  versatz: number;
  /** s, bis er wieder steht. */
  dauer: number;
  /** Grad Ausschlag des Taumelns nach Haltungsbruch, sonst 0. */
  taumel: number;
}

export function reaktion(impuls: number, ziel: string, gebrochen = false, g: Gewicht = GEWICHT): Reaktion {
  const r = g.reaktion;
  const dv = impuls / zielMasse(ziel, g);
  return {
    dv,
    neigung: Math.min(r.neigungMax, r.neigungJeMps * dv),
    versatz: Math.min(r.versatzMax, dv * r.dauer / 2),
    dauer: r.dauer,
    taumel: gebrochen ? Math.min(r.taumelMax, r.taumelGrund + r.taumelJeMps * dv) : 0,
  };
}

/** Pegel 0…1 und Tonhöhe als Abspielrate (Referenzwaffe = 1). */
export interface Klang { pegel: number; tonhoehe: number }
export interface Toene { schwung: Klang; treffer: Klang }

const zwischen = (x: number) => Math.max(0, Math.min(1, x));

/** Ton des Schwungs und des Treffers einer Waffe: lauter mit Tempo und Energie, tiefer mit der Grösse. */
export function toene(id: string, wucht = 1, g: Gewicht = GEWICHT): Toene {
  const t = g.ton;
  const w = waffenkoerper(id, g), s = schwung(w, g);
  const rw = waffenkoerper(t.referenz, g), rs = schwung(rw, g);
  const groesse = Math.cbrt(rw.masse / w.masse);
  return {
    schwung: { pegel: zwischen(t.schwungGrund + t.schwungJeMps * s.spitzeTempo),
      tonhoehe: (s.spitzeTempo / rs.spitzeTempo) * groesse },
    treffer: { pegel: zwischen(t.trefferGrund + t.trefferJeOktave * Math.log2(s.impuls * wucht / rs.impuls)),
      tonhoehe: groesse },
  };
}

/**
 * Was ein Clip der Waffe nach dem Durchzug zeigen muss (`tests/waffenclips.test.ts`): Die Klinge läuft
 * mindestens `winkel` Grad weiter (Bremsweg, nur Schwung), und der letzte Schlüssel vor der Rückkehr in die
 * Haltung liegt bei mindestens `halt` der Erholung im Clip — so lange folgt der Körper der Masse.
 */
export function nachschwung(id: string, g: Gewicht = GEWICHT): { winkel: number; halt: number } {
  const w = waffenkoerper(id, g), s = schwung(w, g), c = g.clips;
  return { winkel: w.bewegung === 'schwung' ? s.bremsweg : 0, halt: Math.min(c.haltMax, c.haltGrund + c.haltJeKg * w.masse) };
}

/** Alles, was ein Treffer zeigt — die eine Funktion, die Kampfplatz und Kamera in Runde 2 rufen. */
export interface TrefferBild { impuls: number; stopp: number; kamera: Kamerastoss; reaktion: Reaktion; ton: Klang }

export function trefferBild(e: {
  waffe: string; wucht?: number; ziel: string; linie?: Linie;
} & Trefferlage, g: Gewicht = GEWICHT): TrefferBild {
  const w = waffenkoerper(e.waffe, g);
  const impuls = schwung(w, g).impuls * (e.wucht ?? 1);
  return {
    impuls,
    stopp: trefferstopp(impuls, e, g),
    kamera: kameraGesetzt(e.geblockt ? impuls * g.trefferstopp.geblockt : impuls, schlagRichtung(e.linie, w.bewegung), g),
    reaktion: reaktion(e.geblockt ? 0 : impuls, e.ziel, e.gebrochen, g),
    ton: toene(e.waffe, e.wucht, g).treffer,
  };
}
