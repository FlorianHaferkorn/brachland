/**
 * BRACHLAND — Kampf-Engine
 *
 * Reine Logik, kein 3D, keine UI. Deterministisch über einen gesetzten Zufallsgenerator,
 * damit die Simulationen aus dem Designprozess als Testfälle taugen.
 *
 * Umgesetzt: Kampfsystem v2.4 + Move-System v1.1
 *   - 8 Elemente als Zirkulant, Doppeltypen multiplizieren die Verteidigung
 *   - Schaden = (ANG/VER) x Power x 18 + 2, mal Element, mal Zufall(0,9–1,1)
 *   - Elementbonus x1,5 bei Übereinstimmung Move/Kreatur
 *   - Fokus: Start 4, Regen +2, Max 8, Kosten 1/2/3
 *   - Wechsel kostet den Zug, Eintretender nimmt SHIELD_DR des Schadens
 *   - Zehrung 7 % nur beim aktiven Kämpfer
 *   - Regenten wechseln das Element bei KP-Schwellen
 */
import { Element, effektivitaet, BAND } from '../data/schema.js';

// ------------------------------------------------------------- Stellschrauben
export const REGELN = {
  SHIELD_DR: 0.5,      // Schadensanteil für den Eintretenden beim Wechsel
  ZEHRUNG: 0.12,       // Anteil max. KP je Runde, nur aktiver Befallener
                       // Kalibriert an der Engine, nicht an der Vor-Simulation:
                       // mit STAB und Fokus ist der Befall-Bonus mehr wert als gedacht.
  FOKUS_START: 4,
  FOKUS_REGEN: 2,
  FOKUS_MAX: 8,
  STAB: 1.5,           // Elementbonus
  BEFALL_ANG: 1.15,
  BEFALL_VER: 1.15,
  BEFALL_INI: 1.10,
  MAX_RUNDEN: 60,
};

// ------------------------------------------------------------------ Zufall
/** Mulberry32 — klein, schnell, reproduzierbar. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ Typen
export type Band = keyof typeof BAND;
export type Zustand = 'rein' | 'befallen' | 'verhaertet';

export interface MoveDef { id: string; name: string; element: Element; band: Band; }

export interface Kaempfer {
  id: string;
  name: string;
  elemente: Element[];
  zustand: Zustand;
  maxKp: number; kp: number;
  ang: number; ver: number; ini: number;
  moves: MoveDef[];
  fokus: number;
  /** Regenten: Element wechselt bei KP-Anteil. */
  phasen?: { elemente: Element[]; abKpAnteil: number }[];
}

export interface Team { kaempfer: Kaempfer[]; aktiv: number; }

export type Ereignis =
  | { art: 'angriff'; von: string; auf: string; move: string; schaden: number; faktor: number }
  | { art: 'wechsel'; zu: string; freierTreffer: number }
  | { art: 'zehrung'; wen: string; schaden: number }
  | { art: 'phase'; wer: string; elemente: Element[] }
  | { art: 'ko'; wen: string }
  | { art: 'kein_fokus'; wer: string };

// ------------------------------------------------------------- Grundrechnen
export function erstelle(basis: Omit<Kaempfer, 'kp' | 'fokus'>): Kaempfer {
  const m = basis.zustand === 'befallen' ? 1 : 0;
  return {
    ...basis,
    kp: basis.maxKp,
    fokus: REGELN.FOKUS_START,
    ang: Math.round(basis.ang * (m ? REGELN.BEFALL_ANG : 1)),
    ver: Math.round(basis.ver * (m ? REGELN.BEFALL_VER : 1)),
    ini: Math.round(basis.ini * (m ? REGELN.BEFALL_INI : 1)),
  };
}

/** Verteidigung multipliziert beide Typen. */
export function elementFaktor(angriff: Element, verteidiger: Element[]): number {
  return verteidiger.reduce((f, t) => f * effektivitaet(angriff, t), 1);
}

export function schaden(a: Kaempfer, d: Kaempfer, move: MoveDef, zufall: () => number): number {
  const power = BAND[move.band].power;
  if (power === 0) return 0;
  const stab = a.elemente.includes(move.element) ? REGELN.STAB : 1;
  const el = elementFaktor(move.element, d.elemente);
  const roh = (a.ang / d.ver) * power * 18 + 2;
  return Math.max(1, Math.round(roh * stab * el * (0.9 + zufall() * 0.2)));
}

/** Erwartungswert ohne Zufall — für die KI. */
function erwartet(a: Kaempfer, d: Kaempfer): number {
  const beste = a.moves
    .filter(m => BAND[m.band].power > 0 && BAND[m.band].fokus <= a.fokus)
    .map(m => {
      const stab = a.elemente.includes(m.element) ? REGELN.STAB : 1;
      return ((a.ang / d.ver) * BAND[m.band].power * 18 + 2) * stab * elementFaktor(m.element, d.elemente);
    });
  return beste.length ? Math.max(...beste) : 1;
}

// ------------------------------------------------------------------ Auswahl
/** Wählt den Move mit dem höchsten Schaden, den der Fokus hergibt. */
export function waehleMove(a: Kaempfer, d: Kaempfer): MoveDef | null {
  const bezahlbar = a.moves.filter(m => BAND[m.band].fokus <= a.fokus);
  if (!bezahlbar.length) return null;
  const schaedigend = bezahlbar.filter(m => BAND[m.band].power > 0);
  if (!schaedigend.length) return bezahlbar[0];
  return schaedigend.reduce((best, m) => {
    const bew = (x: MoveDef) => {
      const stab = a.elemente.includes(x.element) ? REGELN.STAB : 1;
      return BAND[x.band].power * stab * elementFaktor(x.element, d.elemente);
    };
    return bew(m) > bew(best) ? m : best;
  });
}

/**
 * Wechsel-KI: nur bei echtem Nachteil oder drohendem K.o.
 * Bewusst zurückhaltend — eine eifrige KI tauscht sich zu Tode (siehe Kampfsystem v2.1).
 */
export function waehleWechsel(team: Team, gegner: Kaempfer): number | null {
  const cur = team.kaempfer[team.aktiv];
  const eingehend = erwartet(gegner, cur);
  const schlecht =
    elementFaktor(gegner.elemente[0], cur.elemente) >= 2 ||
    Math.max(...cur.elemente.map(e => elementFaktor(e, gegner.elemente))) <= 0.5;
  const sterbend = cur.kp <= eingehend * 1.15;
  if (!schlecht && !sterbend) return null;

  const bewerte = (k: Kaempfer) =>
    erwartet(k, gegner) / Math.max(1, erwartet(gegner, k)) + 0.6 * (k.kp / k.maxKp);
  let besterIdx: number | null = null, bester = bewerte(cur) * 1.15;
  team.kaempfer.forEach((k, i) => {
    if (i === team.aktiv || k.kp <= 0) return;
    const w = bewerte(k);
    if (w > bester) { bester = w; besterIdx = i; }
  });
  return besterIdx;
}

// -------------------------------------------------------------- Kampfablauf
export interface Ergebnis { sieg: boolean; runden: number; verluste: number; log: Ereignis[]; }

export function kampf(team: Team, boss: Kaempfer, seed = 1, log = false): Ergebnis {
  const zufall = rng(seed);
  const ereignisse: Ereignis[] = [];
  const merke = (e: Ereignis) => { if (log) ereignisse.push(e); };
  let schild = 0;
  let phase = -1;

  for (let runde = 0; runde < REGELN.MAX_RUNDEN; runde++) {
    // Regenten-Phase nach KP-Anteil
    if (boss.phasen) {
      const anteil = boss.kp / boss.maxKp;
      const idx = boss.phasen.findIndex(p => anteil > p.abKpAnteil);
      const neu = idx === -1 ? boss.phasen.length - 1 : idx;
      if (neu !== phase) {
        phase = neu; boss.elemente = boss.phasen[neu].elemente;
        merke({ art: 'phase', wer: boss.name, elemente: boss.elemente });
      }
    }

    let cur = team.kaempfer[team.aktiv];
    const ziel = waehleWechsel(team, boss);
    const gewechselt = ziel !== null;

    if (gewechselt) {
      team.aktiv = ziel!;
      cur = team.kaempfer[team.aktiv];
      cur.fokus = REGELN.FOKUS_START;
      const m = waehleMove(boss, cur);
      const roh = m ? schaden(boss, cur, m, zufall) : 0;
      const d = Math.round(roh * REGELN.SHIELD_DR);
      cur.kp -= d;
      boss.fokus = Math.min(REGELN.FOKUS_MAX, boss.fokus - (m ? BAND[m.band].fokus : 0) + REGELN.FOKUS_REGEN);
      merke({ art: 'wechsel', zu: cur.name, freierTreffer: d });
      schild = 0;
    } else {
      const reihe: [Kaempfer, Kaempfer][] =
        boss.ini > cur.ini ? [[boss, cur], [cur, boss]] : [[cur, boss], [boss, cur]];
      for (const [a, d] of reihe) {
        if (a.kp <= 0 || d.kp <= 0) continue;
        const m = waehleMove(a, d);
        if (!m) { merke({ art: 'kein_fokus', wer: a.name }); a.fokus = Math.min(REGELN.FOKUS_MAX, a.fokus + REGELN.FOKUS_REGEN); continue; }
        a.fokus -= BAND[m.band].fokus;
        let s = schaden(a, d, m, zufall);
        if (d === cur && schild) s = Math.round(s * REGELN.SHIELD_DR);
        d.kp -= s;
        merke({ art: 'angriff', von: a.name, auf: d.name, move: m.name, schaden: s, faktor: elementFaktor(m.element, d.elemente) });
      }
      schild = 0;
      for (const k of [cur, boss]) k.fokus = Math.min(REGELN.FOKUS_MAX, k.fokus + REGELN.FOKUS_REGEN);
    }

    // Zehrung nur beim aktiven Befallenen
    for (const k of [cur, boss]) {
      if (k.zustand === 'befallen' && k.kp > 0) {
        const z = Math.round(k.maxKp * REGELN.ZEHRUNG);
        k.kp -= z;
        merke({ art: 'zehrung', wen: k.name, schaden: z });
      }
    }

    if (boss.kp <= 0) {
      merke({ art: 'ko', wen: boss.name });
      return { sieg: true, runden: runde + 1, verluste: team.kaempfer.filter(k => k.kp <= 0).length, log: ereignisse };
    }
    if (cur.kp <= 0) {
      merke({ art: 'ko', wen: cur.name });
      const naechster = team.kaempfer.findIndex(k => k.kp > 0);
      if (naechster === -1)
        return { sieg: false, runden: runde + 1, verluste: team.kaempfer.length, log: ereignisse };
      team.aktiv = naechster;
      team.kaempfer[naechster].fokus = REGELN.FOKUS_START;
    }
  }
  return { sieg: false, runden: REGELN.MAX_RUNDEN, verluste: team.kaempfer.filter(k => k.kp <= 0).length, log: ereignisse };
}
