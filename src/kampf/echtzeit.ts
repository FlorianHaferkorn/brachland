/**
 * BRACHLAND — Echtzeitkampf, Stufe 1: die Regeln ohne Bild (ADR-0007)
 *
 * Reines Modul ohne three.js und ohne React, aus demselben Grund wie `spieler/ausdauer.ts`: Was
 * hier steht, lässt sich in `tests/echtzeit.test.ts` Schritt für Schritt nachrechnen. Ein
 * Echtzeitkampf hat Zahlen, die kein Bildtor sieht — Fenster in Millisekunden, Reichweiten in
 * Metern, Winkel —, und genau die prüft der Test. Die Szene zeichnet nur, was hier entschieden ist.
 *
 * ## Was übernommen ist (ADR-0007 §1)
 *
 * Das Regelwerk der Gattung, nicht die Gestalt eines Vorbilds: ein Schlag mit Vorlauf, aktiver
 * Phase und Erholung; eine Ausweichrolle mit Unverwundbarkeitsfenster; Ausdauer als gemeinsame
 * Kasse für beides; Haltung, die erst nach mehreren Treffern bricht; ein Gegner, der seinen
 * Angriff **telegrafiert** und sich im Vorlauf nur langsam nachdreht.
 *
 * ## Richtungen
 *
 * Wie in der Szene: `blick` ist die Gier in Radiant, vorwärts ist `(−sin, −cos)` — die Figur
 * schaut bei `blick = 0` nach −Z. Siehe `Spieler` in `RegionsSzene.tsx`.
 *
 * ## Zeit
 *
 * `simuliere` rechnet in festen Teilschritten von 1/120 s, egal wie gross das Bild-dt ist. Ohne
 * das könnte ein langsames Bild (100 ms) das aktive Fenster eines Schlags (120 ms) überspringen,
 * und ob ein Treffer zählt, hinge an der Bildrate statt am Spiel.
 */
import { neueAusdauer, reicht, schritt as ausdauerSchritt, verbrauche, type Ausdauer } from '../spieler/ausdauer.js';

export type Phase = 'bereit' | 'vorlauf' | 'aktiv' | 'erholung' | 'rolle' | 'betaeubt' | 'gefallen';

/** Ein Schlag: drei Phasen, Bogen, Wirkung. Zeiten in Sekunden, Strecken in Metern. */
export interface Schlag {
  vorlauf: number;
  aktiv: number;
  erholung: number;
  /** Bis wohin der Bogen reicht — von der Mitte des Angreifers bis zum **Rand** des Ziels. */
  reichweite: number;
  /** Halber Öffnungswinkel des Bogens in Radiant. */
  halbwinkel: number;
  schaden: number;
  /** Wie viel Haltung ein Treffer nimmt. */
  haltungsschaden: number;
  /** Ausdauerkosten beim Ansetzen. 0 heisst: kostet nichts (Gegner). */
  kosten: number;
  /** Wie schnell der Angreifer sich im Vorlauf noch nachdreht, rad/s. Im Aktiven dreht niemand. */
  nachdrehen: number;
}

/** Die Ausweichrolle. */
export interface Rolle {
  dauer: number;
  /** Unverwundbar von … bis, Sekunden ab Beginn der Rolle. */
  unverwundbarVon: number;
  unverwundbarBis: number;
  /** Weg über die ganze Rolle. */
  strecke: number;
  kosten: number;
}

export interface KampfWerte {
  schlag: Schlag;
  rolle: Rolle;
  lebenMax: number;
  haltungMax: number;
  /** Haltung je Sekunde zurück, sobald `haltungRuhe` s lang kein Treffer kam. */
  haltungErholung: number;
  haltungRuhe: number;
  /** Wie lange ein Haltungsbruch lähmt. */
  betaeubt: number;
  /** Kapsel: Radius in der Ebene und Höhe. */
  radius: number;
  hoehe: number;
}

const GRAD = Math.PI / 180;

/**
 * Die Spielerin.
 *
 * Der Schlag ist schnell angesetzt (0,18 s) und lang erholt (0,32 s): Wer trifft, ist danach eine
 * halbe Sekunde festgelegt. Genau das macht Timing zur Entscheidung statt zum Tastenrhythmus. Die
 * Rolle ist 0,30 s unverwundbar — das aktive Fenster des Übungsgegners dauert 0,15 s.
 */
export const SPIELERIN: KampfWerte = {
  schlag: {
    vorlauf: 0.18, aktiv: 0.12, erholung: 0.32,
    reichweite: 2.4, halbwinkel: 55 * GRAD,
    schaden: 22, haltungsschaden: 34, kosten: 18, nachdrehen: 6,
  },
  rolle: { dauer: 0.55, unverwundbarVon: 0.05, unverwundbarBis: 0.35, strecke: 3.8, kosten: 24 },
  lebenMax: 100, haltungMax: 60, haltungErholung: 30, haltungRuhe: 1.2, betaeubt: 0.45,
  radius: 0.4, hoehe: 1.7,
};

/**
 * Das Waffenwerk (ADR-0008): zwei Klassen, jede mit **eigenem Fenster**.
 *
 * Die Klinge ist der Schlag der Spielerin von D166, unverändert. Die Axt tauscht Tempo gegen
 * Reichweite und Haltung: langer Vorlauf (0,42 s), dafür 2,9 m und ein Haltungsschaden, der den
 * Übungsgegner (Haltung 50) mit **einem** Treffer bricht. Damit sind die Klassen Werkzeuge für
 * verschiedene Lagen, keine Stufen: Die Klinge macht mehr Schaden je Sekunde, die Axt öffnet die
 * Deckung. Das Tor prüft beides, auch dass die Axt je Sekunde **nicht** mehr Schaden macht.
 */
export type WaffenArt = 'klinge' | 'axt';
export const WAFFEN: Record<WaffenArt, { name: string; schlag: Schlag }> = {
  klinge: { name: 'Klinge', schlag: SPIELERIN.schlag },
  axt: {
    name: 'Axt',
    schlag: {
      vorlauf: 0.42, aktiv: 0.16, erholung: 0.55,
      reichweite: 2.9, halbwinkel: 40 * GRAD,
      schaden: 38, haltungsschaden: 52, kosten: 30, nachdrehen: 3,
    },
  },
};

/** Waffe wechseln — nur aus dem Stand, nie mitten im Schlag oder in der Rolle. */
export function ruesteAus(k: Kaempfer, art: WaffenArt): boolean {
  if (k.phase !== 'bereit') return false;
  k.werte = { ...k.werte, schlag: WAFFEN[art].schlag };
  k.waffe = art;
  return true;
}

/**
 * Der Übungsgegner — ein Platzhalter ohne Asset (ADR-0007 Stufe 1).
 *
 * Der Vorlauf von **0,75 s** ist das Telegraf. Wer auf das erste Zucken hin sofort rollt, ist zu
 * früh: Die Unverwundbarkeit ist vorbei, bevor der Schlag ankommt. Das Fenster, in dem eine Rolle
 * auf der Stelle den Treffer schluckt, liegt in der zweiten Hälfte des Vorlaufs — der Test rechnet
 * es aus und prüft, dass es nach einer menschlichen Reaktionszeit beginnt und breit genug ist.
 */
export const UEBUNGSGEGNER: KampfWerte = {
  schlag: {
    vorlauf: 0.75, aktiv: 0.15, erholung: 0.9,
    reichweite: 2.2, halbwinkel: 50 * GRAD,
    schaden: 25, haltungsschaden: 30, kosten: 0, nachdrehen: 1.6,
  },
  rolle: { dauer: 0, unverwundbarVon: 0, unverwundbarBis: 0, strecke: 0, kosten: 0 },
  lebenMax: 110, haltungMax: 50, haltungErholung: 20, haltungRuhe: 1.5, betaeubt: 0.9,
  radius: 0.45, hoehe: 1.8,
};

/** Wie weit und in welchem Kegel die Zielaufschaltung greift, und wie schnell sie den Blick zieht. */
export const ZIELEN = {
  reichweite: 18, halbwinkel: 70 * GRAD, drehrate: 7,
  /** Bis zu welchem Winkel der Angreifer beim Aufschalten vorgeht (D168). */
  angreiferWinkel: 110 * GRAD,
};

/** Gegnerverhalten des Platzhalters. `abstand` ist der Anteil der Reichweite, auf den er aufrückt. */
export const GEGNER_KI = {
  wachAb: 11, tempo: 2.4, drehrate: 3.5, abstand: 0.9, zielt: 20 * GRAD,
  /**
   * Wer kein Angriffsrecht hat, wartet so viel weiter draussen als die Haltelinie (D167) — ausser
   * Reichweite, aber nah genug, um nach dem Wechsel in unter einer Sekunde dran zu sein.
   */
  warteAbstand: 1.4,
  /** Tempo beim Umkreisen, als Anteil von `tempo`. */
  kreisen: 0.45,
};

/** Die feste Teilschrittweite der Simulation. */
export const SCHRITT = 1 / 120;

export interface Kaempfer {
  id: string;
  werte: KampfWerte;
  x: number; y: number; z: number;
  blick: number;
  leben: number;
  haltung: number;
  /** Sekunden seit dem letzten erlittenen Treffer — für die Haltungserholung. */
  seitTreffer: number;
  ausdauer: Ausdauer;
  phase: Phase;
  /** Sekunden in der aktuellen Phase. */
  zeit: number;
  /** Zählt die Schläge; die Szene erkennt daran einen neuen Schwung. */
  schwung: number;
  /** Wen der laufende Schwung schon erreicht hat — ein Schwung trifft jedes Ziel höchstens einmal. */
  erreicht: Set<string>;
  /** Richtung der laufenden Rolle, Einheitsvektor oder (0, 0) für eine Rolle auf der Stelle. */
  rolleX: number; rolleZ: number;
  /** Sekunden seit dem letzten Schlagbeginn — wer am längsten nicht dran war, bekommt das Angriffsrecht. */
  seitSchlag: number;
  /** Geführte Waffe (ADR-0008); Gegner führen keine. */
  waffe?: WaffenArt;
}

export function neuerKaempfer(id: string, werte: KampfWerte, x: number, z: number, blick = 0, y = 0): Kaempfer {
  return {
    id, werte, x, y, z, blick,
    leben: werte.lebenMax, haltung: werte.haltungMax, seitTreffer: 99,
    ausdauer: neueAusdauer(), phase: 'bereit', zeit: 0, schwung: 0, erreicht: new Set(),
    rolleX: 0, rolleZ: 0, seitSchlag: 99,
  };
}

/** Vorwärtsrichtung zu einer Gier — dieselbe Formel wie in `Spieler`. */
export function vorwaerts(blick: number): [number, number] {
  return [-Math.sin(blick), -Math.cos(blick)];
}

/** Die Gier, unter der man von (vx, vz) nach (nx, nz) schaut. Umkehrung von `vorwaerts`. */
export function blickAuf(vx: number, vz: number, nx: number, nz: number): number {
  return Math.atan2(-(nx - vx), -(nz - vz));
}

/** Kleinster Winkel von `a` nach `b`, in (−π, π]. */
export function winkelDiff(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Den Blick mit begrenzter Rate auf `ziel` drehen. */
export function drehe(k: Kaempfer, ziel: number, rate: number, dt: number): void {
  const d = winkelDiff(k.blick, ziel);
  const max = rate * dt;
  k.blick += Math.abs(d) <= max ? d : Math.sign(d) * max;
}

/** Darf ein Schlag beginnen? Nur aus dem Stand, und nur mit Ausdauer. */
export function kannSchlagen(k: Kaempfer): boolean {
  if (k.phase !== 'bereit') return false;
  return k.werte.schlag.kosten <= 0 || reicht(k.ausdauer, k.werte.schlag.kosten);
}

export function setzeSchlagAn(k: Kaempfer): boolean {
  if (!kannSchlagen(k)) return false;
  if (k.werte.schlag.kosten > 0) k.ausdauer = verbrauche(k.ausdauer, k.werte.schlag.kosten);
  k.phase = 'vorlauf'; k.zeit = 0; k.schwung++; k.erreicht = new Set(); k.seitSchlag = 0;
  return true;
}

/**
 * Darf eine Rolle beginnen? Aus dem Stand und aus der **Erholung** — die Erholung abbrechen zu
 * dürfen ist das, was einen verfehlten Schlag überlebbar macht. Aus dem Vorlauf nicht: Wer
 * ausholt, hat sich festgelegt.
 */
export function kannRollen(k: Kaempfer): boolean {
  if (k.phase !== 'bereit' && k.phase !== 'erholung') return false;
  if (k.werte.rolle.dauer <= 0) return false;
  return reicht(k.ausdauer, k.werte.rolle.kosten);
}

export function setzeRolleAn(k: Kaempfer, richtX: number, richtZ: number): boolean {
  if (!kannRollen(k)) return false;
  k.ausdauer = verbrauche(k.ausdauer, k.werte.rolle.kosten);
  const l = Math.hypot(richtX, richtZ);
  k.rolleX = l > 1e-6 ? richtX / l : 0;
  k.rolleZ = l > 1e-6 ? richtZ / l : 0;
  k.phase = 'rolle'; k.zeit = 0;
  return true;
}

export function unverwundbar(k: Kaempfer): boolean {
  return k.phase === 'rolle'
    && k.zeit >= k.werte.rolle.unverwundbarVon && k.zeit < k.werte.rolle.unverwundbarBis;
}

/** Kann einer handeln oder sich bewegen? Die Szene sperrt das Gehen, solange nicht. */
export function frei(k: Kaempfer): boolean {
  return k.phase === 'bereit';
}

/**
 * Liegt das Ziel im Bogen des Angreifers?
 *
 * Gemessen wird bis zum **Rand** der Zielkapsel, und der Winkel bekommt den halben Sichtwinkel der
 * Kapsel als Zugabe: Ein Gegner, dessen Schulter noch im Bogen steht, wird getroffen, auch wenn
 * seine Mitte knapp daneben liegt. Anders fühlt sich ein Nahkampf an wie Zielschiessen.
 */
export function imBogen(a: Kaempfer, z: Kaempfer): boolean {
  const s = a.werte.schlag;
  if (Math.abs(z.y - a.y) > Math.max(a.werte.hoehe, z.werte.hoehe)) return false;
  const dx = z.x - a.x, dz = z.z - a.z;
  const d = Math.hypot(dx, dz);
  if (d - z.werte.radius > s.reichweite) return false;
  if (d <= z.werte.radius) return true;
  const [fx, fz] = vorwaerts(a.blick);
  const winkel = Math.acos(Math.max(-1, Math.min(1, (fx * dx + fz * dz) / d)));
  return winkel <= s.halbwinkel + Math.asin(Math.min(1, z.werte.radius / d));
}

export interface Treffer {
  von: string;
  auf: string;
  schaden: number;
  /** Haltung gebrochen — das Ziel ist betäubt. */
  gebrochen: boolean;
  toedlich: boolean;
  /** Die Rolle hat den Schlag geschluckt. */
  ausgewichen: boolean;
}

/**
 * Treffer des laufenden Schwungs gegen `ziele` auflösen.
 *
 * Ein Schwung, der durch ein unverwundbares Ziel geht, ist **ausgewichen** und zählt auch dann
 * nicht mehr, wenn die Unverwundbarkeit im selben aktiven Fenster endet. Ohne diese Regel würde
 * eine Rolle, die exakt richtig liegt, im nächsten Teilschritt doch noch getroffen.
 */
export function loeseTreffer(a: Kaempfer, ziele: readonly Kaempfer[]): Treffer[] {
  if (a.phase !== 'aktiv') return [];
  const raus: Treffer[] = [];
  for (const z of ziele) {
    if (z === a || z.phase === 'gefallen' || a.erreicht.has(z.id)) continue;
    if (!imBogen(a, z)) continue;
    a.erreicht.add(z.id);
    if (unverwundbar(z)) {
      raus.push({ von: a.id, auf: z.id, schaden: 0, gebrochen: false, toedlich: false, ausgewichen: true });
      continue;
    }
    const s = a.werte.schlag;
    z.leben = Math.max(0, z.leben - s.schaden);
    z.haltung -= s.haltungsschaden;
    z.seitTreffer = 0;
    let gebrochen = false;
    const toedlich = z.leben <= 0;
    if (toedlich) { z.phase = 'gefallen'; z.zeit = 0; }
    else if (z.haltung <= 0) {
      z.phase = 'betaeubt'; z.zeit = 0; z.haltung = z.werte.haltungMax; gebrochen = true;
    }
    raus.push({ von: a.id, auf: z.id, schaden: s.schaden, gebrochen, toedlich, ausgewichen: false });
  }
  return raus;
}

function phasenDauer(k: Kaempfer): number {
  const w = k.werte;
  switch (k.phase) {
    case 'vorlauf': return w.schlag.vorlauf;
    case 'aktiv': return w.schlag.aktiv;
    case 'erholung': return w.schlag.erholung;
    case 'rolle': return w.rolle.dauer;
    case 'betaeubt': return w.betaeubt;
    default: return Infinity;
  }
}

const NAECHSTE: Partial<Record<Phase, Phase>> = {
  vorlauf: 'aktiv', aktiv: 'erholung', erholung: 'bereit', rolle: 'bereit', betaeubt: 'bereit',
};

/** Weiterschieben einer Position durch Kollision und Gelände — die Szene reicht ihre ein. */
export type Schieber = (x: number, z: number) => [number, number];

/** Ein Teilschritt für einen Kämpfer: Uhren, Ausdauer, Haltung, Rollweg, Phasenwechsel. */
export function schrittKaempfer(k: Kaempfer, dt: number, schiebe?: Schieber): void {
  if (dt <= 0) return;
  const w = k.werte;
  k.seitTreffer += dt;
  k.seitSchlag += dt;
  k.ausdauer = ausdauerSchritt(k.ausdauer, dt, 0);
  if (k.seitTreffer >= w.haltungRuhe) k.haltung = Math.min(w.haltungMax, k.haltung + w.haltungErholung * dt);
  if (k.phase === 'gefallen') { k.zeit += dt; return; }

  if (k.phase === 'rolle' && (k.rolleX !== 0 || k.rolleZ !== 0)) {
    const t = Math.min(dt, Math.max(0, w.rolle.dauer - k.zeit));
    if (t > 0) {
      const v = w.rolle.strecke / w.rolle.dauer;
      let nx = k.x + k.rolleX * v * t, nz = k.z + k.rolleZ * v * t;
      if (schiebe) [nx, nz] = schiebe(nx, nz);
      k.x = nx; k.z = nz;
    }
  }

  k.zeit += dt;
  for (;;) {
    const dauer = phasenDauer(k);
    if (k.zeit < dauer) break;
    const naechste: Phase | undefined = NAECHSTE[k.phase];
    if (!naechste) break;
    k.zeit -= dauer;
    k.phase = naechste;
    if (naechste === 'bereit') { k.zeit = 0; break; }
  }
}

/**
 * Das Verhalten des Übungsgegners.
 *
 * Wach unter 11 m, dreht sich zu, rückt auf 90 % seiner Reichweite auf und schlägt, wenn er
 * einigermassen gerade steht. Im Vorlauf dreht er sich nur mit `schlag.nachdrehen` nach — das ist
 * die Lücke, in die eine Seitwärtsrolle fällt.
 */
export function denkeGegner(g: Kaempfer, s: Kaempfer, dt: number, schiebe?: Schieber, darf = true): void {
  if (g.phase === 'gefallen' || s.phase === 'gefallen') return;
  const dx = s.x - g.x, dz = s.z - g.z;
  const d = Math.hypot(dx, dz);
  if (d > GEGNER_KI.wachAb) return;
  const ziel = blickAuf(g.x, g.z, s.x, s.z);
  if (g.phase === 'vorlauf') { drehe(g, ziel, g.werte.schlag.nachdrehen, dt); return; }
  if (g.phase !== 'bereit') return;
  drehe(g, ziel, GEGNER_KI.drehrate, dt);
  const halt = g.werte.schlag.reichweite * GEGNER_KI.abstand;
  if (!darf) { warte(g, s, dx, dz, d, halt, dt, schiebe); return; }
  // Mit Spiel von 1 cm: Ohne sie rückte der Gegner im Spiel unendlich weiter um 1e-16 m
  // an und schlug nie zu — der letzte Schritt landet nur bei achsparallelen Zahlen exakt auf
  // `halt`. Das Tor hatte nur achsparallel geprüft; gefunden erst im Bild (D166).
  if (d - s.werte.radius > halt + 0.01) {
    const schrittweite = Math.min(GEGNER_KI.tempo * dt, d - s.werte.radius - halt);
    let nx = g.x + (dx / d) * schrittweite, nz = g.z + (dz / d) * schrittweite;
    if (schiebe) [nx, nz] = schiebe(nx, nz);
    g.x = nx; g.z = nz;
  } else if (Math.abs(winkelDiff(g.blick, ziel)) < GEGNER_KI.zielt) {
    setzeSchlagAn(g);
  }
}

/** Ein Schritt in der Ebene, durch Kollision und Gelände geschoben. */
function geheUm(g: Kaempfer, vx: number, vz: number, schiebe?: Schieber): void {
  let nx = g.x + vx, nz = g.z + vz;
  if (schiebe) [nx, nz] = schiebe(nx, nz);
  g.x = nx; g.z = nz;
}

/**
 * Warten ohne Angriffsrecht: auf den Ring `halt + warteAbstand` und dort seitwärts kreisen.
 *
 * Kreisen statt Stehen, weil ein stehender zweiter Gegner wie ein Fehler aussieht und weil er
 * so die Spielerin nicht zustellt. Die Richtung hängt an der Id — zwei Wartende kreisen nicht
 * zwangsläufig gleich herum, aber jeder bleibt bei seiner.
 */
function warte(g: Kaempfer, s: Kaempfer, dx: number, dz: number, d: number, halt: number,
               dt: number, schiebe?: Schieber): void {
  if (d < 1e-6) return;
  const ring = halt + GEGNER_KI.warteAbstand;
  const rand = d - s.werte.radius;
  const ux = dx / d, uz = dz / d;
  if (rand > ring + 0.3) {
    const w = Math.min(GEGNER_KI.tempo * dt, rand - ring);
    geheUm(g, ux * w, uz * w, schiebe);
  } else if (rand < ring - 0.3) {
    const w = Math.min(GEGNER_KI.tempo * 0.6 * dt, ring - rand);
    geheUm(g, -ux * w, -uz * w, schiebe);
  } else {
    const seite = g.id.charCodeAt(g.id.length - 1) % 2 === 0 ? 1 : -1;
    const w = GEGNER_KI.tempo * GEGNER_KI.kreisen * dt * seite;
    geheUm(g, -uz * w, ux * w, schiebe);
  }
}

/**
 * Wer darf angreifen? Höchstens **ein** Gegner zugleich (D167).
 *
 * Wer gerade ausholt, schlägt oder sich erholt, behält das Recht. Sonst bekommt es der Wache, der
 * am längsten nicht geschlagen hat — so wechseln sich zwei ab, statt dass der nähere ewig dran
 * ist. Ohne diese Regel schlugen im Bild zwei Übungsgegner im selben Takt, und eine stehende
 * Spielerin fiel in 2,5 s; das ist kein Kampf, sondern ein Zufall der Aufstellung.
 */
export function angriffsrecht(w: Kampfwelt): string | null {
  const s = w.spielerin;
  const dran = w.gegner.find(g => g.phase === 'vorlauf' || g.phase === 'aktiv' || g.phase === 'erholung');
  if (dran) return dran.id;
  let beste: Kaempfer | null = null;
  for (const g of w.gegner) {
    if (g.phase !== 'bereit') continue;
    const d = Math.hypot(g.x - s.x, g.z - s.z);
    if (d > GEGNER_KI.wachAb) continue;
    if (!beste || g.seitSchlag > beste.seitSchlag + 1e-9
        || (Math.abs(g.seitSchlag - beste.seitSchlag) <= 1e-9 && d < Math.hypot(beste.x - s.x, beste.z - s.z))) {
      beste = g;
    }
  }
  return beste?.id ?? null;
}

/**
 * Zielaufschaltung: das nächste lebende Ziel im Blickkegel und in Reichweite.
 *
 * Nächstes, nicht mittigstes — im Getümmel will man den, der gleich zuschlägt, und das ist der,
 * der am nächsten steht.
 */
export function waehleZiel(von: Kaempfer, kandidaten: readonly Kaempfer[], angreifer: string | null = null): Kaempfer | null {
  // Wer gerade das Angriffsrecht hat, geht vor — auch etwas ausserhalb des Kegels (D168). Im Bild
  // (D167) war der aufgeschaltete Gegner oft der wartende, und der Angreifer stand am Bildrand.
  const a = angreifer ? kandidaten.find(k => k.id === angreifer && k.phase !== 'gefallen') : undefined;
  if (a && Math.hypot(a.x - von.x, a.z - von.z) <= ZIELEN.reichweite
      && Math.abs(winkelDiff(von.blick, blickAuf(von.x, von.z, a.x, a.z))) <= ZIELEN.angreiferWinkel) {
    return a;
  }
  let beste: Kaempfer | null = null, besteD = Infinity;
  for (const k of kandidaten) {
    if (k.phase === 'gefallen') continue;
    const d = Math.hypot(k.x - von.x, k.z - von.z);
    if (d > ZIELEN.reichweite || d >= besteD) continue;
    if (Math.abs(winkelDiff(von.blick, blickAuf(von.x, von.z, k.x, k.z))) > ZIELEN.halbwinkel) continue;
    beste = k; besteD = d;
  }
  return beste;
}

/**
 * Ziel wechseln (D168): der nächste lebende Gegner **seitlich** vom aktuellen, in Reichweite.
 *
 * `richtung` +1 heisst rechts, −1 links — vom Blick der Spielerin aus. Gemessen wird der Winkel
 * gegen die Blickrichtung; gewählt wird der kleinste Schritt über den Winkel des aktuellen Ziels
 * hinaus. Kein Umlauf: Wer ganz rechts ist, bleibt, statt nach links zu springen — ein Sprung
 * über die ganze Szene wäre im Getümmel die falsche Überraschung.
 */
export function wechsleZiel(von: Kaempfer, kandidaten: readonly Kaempfer[], aktuell: string | null,
                            richtung: 1 | -1): Kaempfer | null {
  const rechts = (k: Kaempfer) => -winkelDiff(von.blick, blickAuf(von.x, von.z, k.x, k.z));
  const jetzt = kandidaten.find(k => k.id === aktuell);
  const basis = jetzt ? rechts(jetzt) : 0;
  let beste: Kaempfer | null = null, besterSchritt = Infinity;
  for (const k of kandidaten) {
    if (k.id === aktuell || k.phase === 'gefallen') continue;
    if (Math.hypot(k.x - von.x, k.z - von.z) > ZIELEN.reichweite) continue;
    const schritt = (rechts(k) - basis) * richtung;
    if (schritt > 1e-6 && schritt < besterSchritt) { beste = k; besterSchritt = schritt; }
  }
  return beste ?? jetzt ?? null;
}

export interface Kampfwelt {
  spielerin: Kaempfer;
  gegner: Kaempfer[];
  /** Id des aufgeschalteten Gegners oder `null`. */
  ziel: string | null;
  /** Noch nicht gerechnete Zeit unter einem Teilschritt — siehe `simuliere`. */
  uebrig?: number;
  /** Wer im letzten Teilschritt angreifen durfte — nur zum Ansehen (`kampf.mjs`). */
  recht?: string | null;
}

/**
 * Die Welt um `dt` weiterrechnen, in **festen** Teilschritten von `SCHRITT`.
 *
 * Was unter einem Teilschritt übrig bleibt, wird in `uebrig` mitgenommen statt als kürzerer
 * Schritt gerechnet. Damit ist das Ergebnis dasselbe, ob die Szene mit 30, 60 oder 144 Bildern
 * läuft — der Test prüft genau das. Mit einem verkürzten Restschritt wäre es das nicht: Die
 * Phasengrenzen fielen je nach Bildrate auf andere Teilschritte.
 *
 * Reihenfolge je Teilschritt: Gegner denken, alle Uhren laufen, dann Treffer — die Spielerin zuerst.
 * Wer im selben Teilschritt trifft wie der Gegner, gewinnt den Tausch; die Spielerin ist schneller
 * und soll das spüren.
 */
export function simuliere(w: Kampfwelt, dt: number, schiebe?: Schieber): Treffer[] {
  const ereignisse: Treffer[] = [];
  w.uebrig = (w.uebrig ?? 0) + Math.max(0, dt);
  while (w.uebrig >= SCHRITT - 1e-12) {
    const h = SCHRITT;
    w.uebrig -= h;
    w.recht = angriffsrecht(w);
    for (const g of w.gegner) denkeGegner(g, w.spielerin, h, schiebe, w.recht === null || w.recht === g.id);
    schrittKaempfer(w.spielerin, h, schiebe);
    for (const g of w.gegner) schrittKaempfer(g, h, schiebe);
    ereignisse.push(...loeseTreffer(w.spielerin, w.gegner));
    for (const g of w.gegner) ereignisse.push(...loeseTreffer(g, [w.spielerin]));
    if (w.ziel && w.gegner.find(g => g.id === w.ziel)?.phase === 'gefallen') w.ziel = null;
  }
  return ereignisse;
}
