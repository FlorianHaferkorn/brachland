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

export type Phase = 'bereit' | 'vorlauf' | 'aktiv' | 'erholung' | 'rolle' | 'betaeubt' | 'zucken' | 'gefallen';

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
  /** Name für Anzeige und Protokoll (D171). */
  name?: string;
  /**
   * Der Clip dazu und wo in ihm Scheitel und Durchzug liegen, in Clipsekunden (D171). Die Figur
   * legt Vorlauf auf 0…Scheitel, Aktiv auf Scheitel…Durchzug, Erholung auf den Rest.
   */
  clip?: string;
  hieb?: { scheitel: number; durchzug: number };
  /**
   * Vorschritt in Metern (D171): Der Körper geht mit dem Schlag mit — verteilt über das letzte
   * Drittel des Vorlaufs und das Aktive. Ein Schwert, das aus dem Stand trifft, sieht aus wie ein
   * Wedeln; ein Schritt in den Hieb ist das, was ihn schwer macht.
   */
  schritt?: number;
  /** Wie weit der Treffer das Ziel zurückstösst, Meter (D171). Ohne Angabe 0,2. */
  rueckstoss?: number;
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
  /**
   * Was nach `schlag` ohne Pause folgt (D171) — der Doppelbiss des Wolfs. Der nächste Schlag beginnt,
   * sobald die Erholung des vorigen um ist; das Angriffsrecht bleibt dabei.
   */
  kette?: Schlag[];
  /** Lauftempo der KI in m/s; ohne Angabe `GEGNER_KI.tempo`. */
  tempo?: number;
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
  /**
   * Halbe Länge des Körpers entlang des Blicks (D170). 0 = runde Kapsel (Mensch). Ein Vierbeiner
   * ist eine Pille: Kopf und Hinterteil reichen weiter als die Flanke.
   */
  halbLaenge?: number;
  /**
   * Wie lange ein Treffer den Kämpfer aus seiner Handlung reisst (D170). 0 heisst: Er schlägt
   * durch — Gegner brechen nur über die Haltung. Die Spielerin zuckt, und ein Treffer im Vorlauf
   * kostet sie den eigenen Schlag.
   */
  zucken?: number;
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
  radius: 0.4, hoehe: 1.7, zucken: 0.3,
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
/**
 * Ein Moveset je Waffe (D171) — wie in der Gattung: leichte Kette, schwerer Schlag, Laufangriff.
 * `schlag` ist der erste der leichten Kette und bleibt, was die älteren Prüfungen meinen.
 */
export interface Waffe {
  name: string;
  schlag: Schlag;
  leicht: Schlag[];
  schwer: Schlag;
  lauf: Schlag;
  /** Kampfhaltung im Stand (Clip). */
  haltung: string;
}

const KLINGE_1: Schlag = { ...SPIELERIN.schlag, name: 'Hieb', clip: 'Sword_Slash',
  hieb: { scheitel: 0.375, durchzug: 0.67 }, schritt: 0.3 };
const AXT_1: Schlag = {
  name: 'Axthieb', vorlauf: 0.42, aktiv: 0.16, erholung: 0.55,
  reichweite: 2.9, halbwinkel: 40 * GRAD,
  schaden: 38, haltungsschaden: 52, kosten: 30, nachdrehen: 3,
  clip: 'Axe_Overhead', hieb: { scheitel: 12 / 24, durchzug: 16 / 24 }, schritt: 0.25, rueckstoss: 0.3,
};

/**
 * Die Klinge: drei leichte (Hieb, Rückhand, Stich — der Stich reicht weiter und schmaler), ein
 * schwerer Zweihandhieb von oben, ein Laufstich mit langem Ausfall. Die Axt: zwei leichte (von oben,
 * dann quer mit breitem Bogen), ein schwerer Hieb mit weitem Ausholen, ein Laufhieb schräg.
 * Die Clips (ausser `Sword_Slash`) baut `tools/waffenclips.py`; die Zeiten `hieb` stehen dort.
 */
export const WAFFEN: Record<WaffenArt, Waffe> = {
  klinge: {
    name: 'Klinge', schlag: KLINGE_1, haltung: 'Klinge_Stand',
    leicht: [
      KLINGE_1,
      { name: 'Rückhand', vorlauf: 0.16, aktiv: 0.12, erholung: 0.34, reichweite: 2.4, halbwinkel: 60 * GRAD,
        schaden: 26, haltungsschaden: 30, kosten: 16, nachdrehen: 6,
        clip: 'Klinge_Rueckhand', hieb: { scheitel: 8 / 24, durchzug: 13 / 24 }, schritt: 0.35 },
      { name: 'Stich', vorlauf: 0.22, aktiv: 0.1, erholung: 0.45, reichweite: 2.8, halbwinkel: 20 * GRAD,
        schaden: 34, haltungsschaden: 40, kosten: 20, nachdrehen: 5,
        clip: 'Klinge_Stich', hieb: { scheitel: 9 / 24, durchzug: 13 / 24 }, schritt: 0.6, rueckstoss: 0.35 },
    ],
    schwer: { name: 'Zweihandhieb', vorlauf: 0.5, aktiv: 0.14, erholung: 0.5, reichweite: 2.6, halbwinkel: 45 * GRAD,
      schaden: 48, haltungsschaden: 60, kosten: 30, nachdrehen: 4,
      clip: 'Klinge_Schwer', hieb: { scheitel: 14 / 24, durchzug: 18 / 24 }, schritt: 0.4, rueckstoss: 0.45 },
    lauf: { name: 'Laufstich', vorlauf: 0.15, aktiv: 0.14, erholung: 0.5, reichweite: 2.8, halbwinkel: 35 * GRAD,
      schaden: 30, haltungsschaden: 40, kosten: 22, nachdrehen: 3,
      clip: 'Klinge_Lauf', hieb: { scheitel: 6 / 24, durchzug: 10 / 24 }, schritt: 1.4, rueckstoss: 0.4 },
  },
  axt: {
    name: 'Axt', schlag: AXT_1, haltung: 'Axt_Stand',
    leicht: [
      AXT_1,
      { name: 'Querhieb', vorlauf: 0.36, aktiv: 0.18, erholung: 0.6, reichweite: 2.8, halbwinkel: 70 * GRAD,
        schaden: 34, haltungsschaden: 46, kosten: 28, nachdrehen: 3,
        clip: 'Axt_Quer', hieb: { scheitel: 10 / 24, durchzug: 15 / 24 }, schritt: 0.3, rueckstoss: 0.3 },
    ],
    schwer: { name: 'Spalthieb', vorlauf: 0.9, aktiv: 0.18, erholung: 0.7, reichweite: 3.0, halbwinkel: 40 * GRAD,
      schaden: 60, haltungsschaden: 80, kosten: 42, nachdrehen: 2,
      clip: 'Axt_Schwer', hieb: { scheitel: 20 / 24, durchzug: 25 / 24 }, schritt: 0.5, rueckstoss: 0.6 },
    lauf: { name: 'Laufhieb', vorlauf: 0.2, aktiv: 0.16, erholung: 0.6, reichweite: 3.0, halbwinkel: 55 * GRAD,
      schaden: 40, haltungsschaden: 55, kosten: 30, nachdrehen: 2,
      clip: 'Axt_Lauf', hieb: { scheitel: 7 / 24, durchzug: 11 / 24 }, schritt: 1.6, rueckstoss: 0.5 },
  },
};

/**
 * Eingaben bleiben so lange gültig (D171) — wer im Schlag schon den nächsten drückt, wird bedient.
 * Im Aktiven und in der Erholung vor `KOMBO_AB` läuft die Uhr nicht (siehe `schrittKaempfer`).
 */
export const PUFFER = 0.3;
/** Ab diesem Anteil der Erholung darf der nächste leichte Schlag die Erholung abbrechen (D171). */
export const KOMBO_AB = 0.35;
/** So lange nach dem Ende eines Schlags setzt der nächste leichte die Kette fort (D171). */
export const KOMBO_FENSTER = 0.45;
/** Trefferstopp (D171): Nach einem Treffer steht die Welt so lange still. */
export const TREFFERSTOPP = 0.06;
/** Über so viele Sekunden läuft ein Rückstoss aus (D171) — ein Ruck statt eines Sprungs. */
export const STOSS_DAUER = 0.15;

/** Waffe wechseln — nur aus dem Stand, nie mitten im Schlag oder in der Rolle. */
export function ruesteAus(k: Kaempfer, art: WaffenArt): boolean {
  if (k.phase !== 'bereit') return false;
  k.werte = { ...k.werte, schlag: WAFFEN[art].schlag };
  k.schlag = WAFFEN[art].schlag;
  k.kombo = 0; k.komboOffen = 0;
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

/**
 * Der Wurzelkeiler als Gegner (D169, ADR-0007 Stufe 2) — der erste aus einem Körperbauplan
 * (Huftier/Vierbeiner), mit dem Modell aus der Welt statt einer Kapsel.
 *
 * Ein Keiler rammt: langer Vorlauf (0,85 s — er senkt den Kopf und scharrt), kurzer, weiter Stoss
 * (2,6 m, weil er sich dabei nach vorn wirft), schmaler Bogen (±35° — was neben ihm steht, trifft
 * er nicht), lange Erholung (1,0 s), in der er offen steht. Mehr Leben und Haltung als der
 * Übungsgegner: Die Klinge braucht drei Treffer für die Haltung, die Axt zwei. Seit D170 eine
 * Pille entlang des Körpers statt einer runden Kapsel (vorher r 0,55 m bei 1,8 m Länge — von der
 * Seite zu leicht, von vorn zu schwer zu treffen).
 */
export const KEILER: KampfWerte = {
  schlag: {
    vorlauf: 0.85, aktiv: 0.18, erholung: 1.0,
    reichweite: 2.6, halbwinkel: 35 * GRAD,
    schaden: 28, haltungsschaden: 36, kosten: 0, nachdrehen: 1.2,
  },
  rolle: { dauer: 0, unverwundbarVon: 0, unverwundbarBis: 0, strecke: 0, kosten: 0 },
  lebenMax: 140, haltungMax: 70, haltungErholung: 18, haltungRuhe: 1.6, betaeubt: 1.0,
  // D170: Pille statt runder Kapsel — halbe Breite 0,31 m, Körper 1,8 m lang.
  radius: 0.35, hoehe: 1.05, halbLaenge: 0.55,
};

/**
 * Der Grathorn als Gegner (D170) — zweiter Körperbauplan (Huftier mit Gehörn, Steinbock).
 *
 * Er stösst mit dem Gehörn: steigt kurz auf (0,6 s — der Kopf geht **hoch**, nicht runter wie beim
 * Keiler), dann kracht er schräg nach unten nach vorn. Schneller als der Keiler, kürzer (2,2 m),
 * noch schmaler (±30°) und leichter: Wer den Keiler gelernt hat, muss hier früher rollen.
 */
export const GRATHORN: KampfWerte = {
  schlag: {
    vorlauf: 0.6, aktiv: 0.14, erholung: 0.8,
    reichweite: 2.2, halbwinkel: 30 * GRAD,
    schaden: 24, haltungsschaden: 44, kosten: 0, nachdrehen: 2.0,
  },
  rolle: { dauer: 0, unverwundbarVon: 0, unverwundbarBis: 0, strecke: 0, kosten: 0 },
  lebenMax: 120, haltungMax: 60, haltungErholung: 22, haltungRuhe: 1.4, betaeubt: 0.9,
  radius: 0.3, hoehe: 1.3, halbLaenge: 0.45,
};

/**
 * Der K7-Wolf als Gegner (D171) — dritter Körperbauplan (Raubtier), der erste mit einer **Kette**.
 *
 * Er beisst zweimal: Der erste Biss kommt nach kurzem Ducken (0,5 s), der zweite ohne neues
 * Telegraf 0,32 s nach dem Ende des ersten, mit einem Satz nach vorn. Wer auf der Stelle unter den
 * ersten rollt, steht beim zweiten wieder da und wird gebissen — sicher ist die Rolle **weg** oder
 * eine zweite Rolle gleich hinterher. Das ist die erste Lektion, die nicht „wann", sondern „wohin"
 * heisst. Dafür wenig Leben und Haltung: Die Klinge bricht ihn mit dem zweiten Treffer.
 */
export const WOLF: KampfWerte = {
  schlag: {
    name: 'Biss', vorlauf: 0.5, aktiv: 0.1, erholung: 0.22,
    reichweite: 2.0, halbwinkel: 40 * GRAD,
    schaden: 14, haltungsschaden: 18, kosten: 0, nachdrehen: 3.0, schritt: 0.3,
  },
  kette: [{
    name: 'Nachbiss', vorlauf: 0.1, aktiv: 0.1, erholung: 0.9,
    reichweite: 2.2, halbwinkel: 40 * GRAD,
    schaden: 16, haltungsschaden: 22, kosten: 0, nachdrehen: 4.0, schritt: 0.5,
  }],
  tempo: 4.0,
  rolle: { dauer: 0, unverwundbarVon: 0, unverwundbarBis: 0, strecke: 0, kosten: 0 },
  lebenMax: 90, haltungMax: 55, haltungErholung: 25, haltungRuhe: 1.2, betaeubt: 0.8,
  radius: 0.28, hoehe: 0.9, halbLaenge: 0.45,
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
  /** Der Schlag, der gerade läuft oder zuletzt lief (D171) — nicht immer `werte.schlag`. */
  schlag: Schlag;
  /** Was nach diesem Schlag ohne Pause folgt (Kette, D171). */
  folge: Schlag[];
  /** Stelle in der leichten Kette der Waffe, und wie lange sie nach dem letzten Schlag noch offen ist. */
  kombo: number;
  komboOffen: number;
  /** Gepufferte Eingabe (D171) mit Restzeit. */
  puffer: { art: 'leicht' | 'schwer' | 'rolle'; rest: number; rx: number; rz: number } | null;
  /** Rennt die Spielerin gerade? Dann wird aus dem leichten Schlag der Laufangriff. Setzt die Szene. */
  rennt?: boolean;
  /**
   * Die Ausdauer erholt jemand anderes (D171): In der Szene tut das `Spieler` — die Simulation
   * zieht nur ab. Ohne das erholte sie sich doppelt, sobald ein Gegner in der Nähe steht.
   */
  ausdauerFremd?: boolean;
  /** Laufender Rückstoss (D171): Rest in Metern je Achse und Restzeit. */
  stoss?: { x: number; z: number; rest: number } | null;
}

export function neuerKaempfer(id: string, werte: KampfWerte, x: number, z: number, blick = 0, y = 0): Kaempfer {
  return {
    id, werte, x, y, z, blick,
    leben: werte.lebenMax, haltung: werte.haltungMax, seitTreffer: 99,
    ausdauer: neueAusdauer(), phase: 'bereit', zeit: 0, schwung: 0, erreicht: new Set(),
    rolleX: 0, rolleZ: 0, seitSchlag: 99,
    schlag: werte.schlag, folge: [], kombo: 0, komboOffen: 0, puffer: null,
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
export function kannSchlagen(k: Kaempfer, s: Schlag = k.werte.schlag): boolean {
  if (k.phase !== 'bereit') return false;
  return s.kosten <= 0 || reicht(k.ausdauer, s.kosten);
}

export function setzeSchlagAn(k: Kaempfer, s: Schlag = k.werte.schlag): boolean {
  if (!kannSchlagen(k, s)) return false;
  beginneSchlag(k, s);
  // Die Kette eines Gegners (D171) hängt am ersten Schlag seines Angriffs.
  k.folge = s === k.werte.schlag && k.werte.kette ? [...k.werte.kette] : [];
  return true;
}

function beginneSchlag(k: Kaempfer, s: Schlag): void {
  if (s.kosten > 0) k.ausdauer = verbrauche(k.ausdauer, s.kosten);
  k.schlag = s;
  k.phase = 'vorlauf'; k.zeit = 0; k.schwung++; k.erreicht = new Set(); k.seitSchlag = 0;
}

/**
 * Eine Eingabe der Spielerin puffern (D171). Ausgeführt wird sie im nächsten Teilschritt, in dem es
 * geht — in der Erholung also schon ab `KOMBO_AB`, statt verloren zu gehen, weil sie 80 ms zu früh
 * kam. Das ist der Unterschied zwischen „reagiert nicht" und „flüssig".
 */
export function puffere(k: Kaempfer, art: 'leicht' | 'schwer' | 'rolle', rx = 0, rz = 0): void {
  k.puffer = { art, rest: PUFFER, rx, rz };
}

/** Welcher Schlag käme jetzt bei `art`? Kette, Laufangriff, schwer — aus der Waffe. */
export function naechsterSchlag(k: Kaempfer, art: 'leicht' | 'schwer'): { schlag: Schlag; kombo: number } {
  const waffe = WAFFEN[k.waffe ?? 'klinge'];
  if (art === 'schwer') return { schlag: waffe.schwer, kombo: 0 };
  const inKette = k.phase === 'erholung' || k.komboOffen > 0;
  if (!inKette && k.rennt) return { schlag: waffe.lauf, kombo: 0 };
  const i = inKette ? (k.kombo + 1) % waffe.leicht.length : 0;
  return { schlag: waffe.leicht[i], kombo: i };
}

/** Die gepufferte Eingabe ausführen, wenn es geht. `true`, wenn etwas begann. */
export function verarbeitePuffer(k: Kaempfer): boolean {
  const p = k.puffer;
  if (!p || p.rest <= 0) { k.puffer = null; return false; }
  if (p.art === 'rolle') {
    if (!setzeRolleAn(k, p.rx, p.rz)) return false;
    k.puffer = null; k.kombo = 0; k.komboOffen = 0;
    return true;
  }
  const abbrechbar = k.phase === 'erholung' && k.zeit >= k.schlag.erholung * KOMBO_AB;
  if (k.phase !== 'bereit' && !abbrechbar) return false;
  const { schlag, kombo } = naechsterSchlag(k, p.art);
  if (schlag.kosten > 0 && !reicht(k.ausdauer, schlag.kosten)) return false;
  beginneSchlag(k, schlag);
  k.folge = [];
  k.kombo = kombo; k.komboOffen = 0;
  k.puffer = null;
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
  const s = a.schlag;
  if (Math.abs(z.y - a.y) > Math.max(a.werte.hoehe, z.werte.hoehe)) return false;
  const r = z.werte.radius;
  const [fx, fz] = vorwaerts(a.blick);
  // D170: Das Ziel ist eine Pille entlang seines Blicks. Geprüft werden der nächste Punkt der
  // Mittellinie und ihre beiden Enden — liegt einer davon mit seinem Kreis im Bogen, trifft es.
  const h = z.werte.halbLaenge ?? 0;
  const [bx, bz] = vorwaerts(z.blick);
  const punkte: [number, number][] = [[z.x, z.z]];
  if (h > 0) {
    const t = Math.max(-h, Math.min(h, (a.x - z.x) * bx + (a.z - z.z) * bz));
    punkte.push([z.x + bx * t, z.z + bz * t], [z.x + bx * h, z.z + bz * h], [z.x - bx * h, z.z - bz * h]);
  }
  for (const [px, pz] of punkte) {
    const dx = px - a.x, dz = pz - a.z;
    const d = Math.hypot(dx, dz);
    if (d - r > s.reichweite) continue;
    if (d <= r) return true;
    const winkel = Math.acos(Math.max(-1, Math.min(1, (fx * dx + fz * dz) / d)));
    if (winkel <= s.halbwinkel + Math.asin(Math.min(1, r / d))) return true;
  }
  return false;
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
    const s = a.schlag;
    z.leben = Math.max(0, z.leben - s.schaden);
    z.haltung -= s.haltungsschaden;
    z.seitTreffer = 0;
    let gebrochen = false;
    const toedlich = z.leben <= 0;
    if (toedlich) { z.phase = 'gefallen'; z.zeit = 0; }
    else if (z.haltung <= 0) {
      z.phase = 'betaeubt'; z.zeit = 0; z.haltung = z.werte.haltungMax; gebrochen = true;
    } else if ((z.werte.zucken ?? 0) > 0) {
      // D170: Der Treffer reisst aus der Handlung — ein Schlag im Vorlauf ist verloren.
      z.phase = 'zucken'; z.zeit = 0; z.folge = []; z.puffer = null;
    }
    if (!toedlich) {
      // Rückstoss (D171): weg vom Angreifer. Ein Treffer, der nichts bewegt, sieht aus wie Durchfassen.
      const dx = z.x - a.x, dz = z.z - a.z, d = Math.hypot(dx, dz) || 1;
      const r = s.rueckstoss ?? 0.2;
      z.stoss = { x: dx / d * r, z: dz / d * r, rest: STOSS_DAUER };
    }
    raus.push({ von: a.id, auf: z.id, schaden: s.schaden, gebrochen, toedlich, ausgewichen: false });
  }
  return raus;
}

function phasenDauer(k: Kaempfer): number {
  const w = k.werte;
  switch (k.phase) {
    case 'vorlauf': return k.schlag.vorlauf;
    case 'aktiv': return k.schlag.aktiv;
    case 'erholung': return k.schlag.erholung;
    case 'rolle': return w.rolle.dauer;
    case 'betaeubt': return w.betaeubt;
    case 'zucken': return w.zucken ?? 0;
    default: return Infinity;
  }
}

const NAECHSTE: Partial<Record<Phase, Phase>> = {
  vorlauf: 'aktiv', aktiv: 'erholung', erholung: 'bereit', rolle: 'bereit', betaeubt: 'bereit',
  zucken: 'bereit',
};

/** Weiterschieben einer Position durch Kollision und Gelände — die Szene reicht ihre ein. */
export type Schieber = (x: number, z: number) => [number, number];

/** Ein Teilschritt für einen Kämpfer: Uhren, Ausdauer, Haltung, Rollweg, Phasenwechsel. */
export function schrittKaempfer(k: Kaempfer, dt: number, schiebe?: Schieber): void {
  if (dt <= 0) return;
  const w = k.werte;
  k.seitTreffer += dt;
  k.seitSchlag += dt;
  // Die Uhr des Puffers steht, solange der eigene Schwung läuft und noch nicht abbrechbar ist (D171,
  // im Bild gefunden): Bei der Axt lagen 0,77 s zwischen Druck und Abbruchpunkt — ein Druck im
  // Durchzug verfiel, bevor er dran war. Wer beim Ausholen hämmert, verliert ihn weiter.
  const haelt = k.phase === 'aktiv' || (k.phase === 'erholung' && k.zeit < k.schlag.erholung * KOMBO_AB);
  if (k.puffer && !haelt) { k.puffer.rest -= dt; if (k.puffer.rest <= 0) k.puffer = null; }
  if (k.komboOffen > 0) k.komboOffen = Math.max(0, k.komboOffen - dt);
  if (!k.ausdauerFremd) k.ausdauer = ausdauerSchritt(k.ausdauer, dt, 0);
  // Rückstoss: der Rest gleichmässig über die Restzeit, durch Kollision und Gelände.
  if (k.stoss && k.stoss.rest > 0) {
    const t = Math.min(dt, k.stoss.rest), f = t / k.stoss.rest;
    const mx = k.stoss.x * f, mz = k.stoss.z * f;
    let nx = k.x + mx, nz = k.z + mz;
    if (schiebe) [nx, nz] = schiebe(nx, nz);
    k.x = nx; k.z = nz;
    k.stoss = k.stoss.rest - t > 1e-9 ? { x: k.stoss.x - mx, z: k.stoss.z - mz, rest: k.stoss.rest - t } : null;
  }
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

  // Vorschritt (D171): im letzten Drittel des Vorlaufs und im Aktiven, in Blickrichtung.
  const sw = k.schlag.schritt ?? 0;
  if (sw > 0 && (k.phase === 'vorlauf' || k.phase === 'aktiv')) {
    const ab = k.schlag.vorlauf * (2 / 3);
    const spanne = k.schlag.vorlauf - ab + k.schlag.aktiv;
    const t0 = k.phase === 'vorlauf' ? k.zeit : k.schlag.vorlauf + k.zeit;
    const anteil = Math.max(0, Math.min(t0 + dt, ab + spanne) - Math.max(t0, ab));
    if (anteil > 0) {
      const [fx, fz] = vorwaerts(k.blick);
      let nx = k.x + fx * sw * anteil / spanne, nz = k.z + fz * sw * anteil / spanne;
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
    if (k.phase === 'erholung' && k.folge.length > 0) {
      // Kette (D171): der nächste Schlag ohne Pause, ohne neue Kosten.
      const rest = k.zeit;
      const s = k.folge.shift()!;
      k.schlag = s; k.phase = 'vorlauf'; k.zeit = rest; k.schwung++; k.erreicht = new Set();
      continue;
    }
    if (k.phase === 'erholung') k.komboOffen = KOMBO_FENSTER;
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
  if (g.phase === 'vorlauf') { drehe(g, ziel, g.schlag.nachdrehen, dt); return; }
  if (g.phase !== 'bereit') return;
  drehe(g, ziel, GEGNER_KI.drehrate, dt);
  const halt = g.werte.schlag.reichweite * GEGNER_KI.abstand;
  if (!darf) { warte(g, s, dx, dz, d, halt, dt, schiebe); return; }
  // Mit Spiel von 1 cm: Ohne sie rückte der Gegner im Spiel unendlich weiter um 1e-16 m
  // an und schlug nie zu — der letzte Schritt landet nur bei achsparallelen Zahlen exakt auf
  // `halt`. Das Tor hatte nur achsparallel geprüft; gefunden erst im Bild (D166).
  if (d - s.werte.radius > halt + 0.01) {
    const schrittweite = Math.min((g.werte.tempo ?? GEGNER_KI.tempo) * dt, d - s.werte.radius - halt);
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
  /** Restzeit des Trefferstopps (D171). */
  stopp?: number;
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
    // Trefferstopp (D171): Die Welt hält kurz an — der Treffer hat Gewicht, bevor es weitergeht.
    if ((w.stopp ?? 0) > 1e-9) { w.stopp = Math.max(0, (w.stopp ?? 0) - h); continue; }
    verarbeitePuffer(w.spielerin);
    w.recht = angriffsrecht(w);
    for (const g of w.gegner) denkeGegner(g, w.spielerin, h, schiebe, w.recht === null || w.recht === g.id);
    schrittKaempfer(w.spielerin, h, schiebe);
    for (const g of w.gegner) schrittKaempfer(g, h, schiebe);
    const neu = loeseTreffer(w.spielerin, w.gegner);
    for (const g of w.gegner) neu.push(...loeseTreffer(g, [w.spielerin]));
    if (neu.some(e => e.schaden > 0)) w.stopp = TREFFERSTOPP;
    ereignisse.push(...neu);
    if (w.ziel && w.gegner.find(g => g.id === w.ziel)?.phase === 'gefallen') w.ziel = null;
  }
  return ereignisse;
}
