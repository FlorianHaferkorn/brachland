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
 *   - Zehrung 12 % nur beim aktiven Kämpfer (die 7 % der Vor-Simulation waren zu
 *     wenig, siehe Begründung an `REGELN.ZEHRUNG` — dieser Kommentar hat die
 *     Korrektur monatelang nicht mitbekommen und stand auf 7 %)
 *   - Trefferwurf und Volltreffer (Creature Design Bible v1.1)
 *   - Regenten wechseln das Element bei KP-Schwellen
 */
import { Element, effektivitaet, BAND, type MoveEffekt, type NarbenArt } from '../data/schema.js';

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

  /**
   * Volltreffer.
   *
   * 6 % Grundchance, 1,6-facher Schaden. Bewusst niedrig: Ein Volltreffer soll
   * eine Überraschung sein, kein Rechenposten. Bei 6 % fällt er in einem Kampf
   * von 14 Runden etwa einmal — oft genug, dass man ihn erlebt, selten genug,
   * dass keine Strategie darauf baut.
   *
   * Die Wildling-Narbe hebt ihn auf 21 %. Das ist der Punkt, ab dem er zur
   * Strategie wird, und deshalb ist er dort auch etwas wert.
   */
  KRIT_BASIS: 0.06,
  KRIT_SCHADEN: 1.6,

  /**
   * Trefferwurf.
   *
   * 95 % Grundgenauigkeit. Eine Stufe Genauigkeit sind 12,5 Prozentpunkte, also
   * `blendlinse` mit -2 Stufen: 95 % → 70 %. Jeder dritte bis vierte Angriff geht
   * daneben — spürbar, ohne den Kampf zum Würfelspiel zu machen.
   *
   * Untergrenze 45 %: Auch drei Blendungen dürfen einen Kämpfer nicht wehrlos
   * machen. Ein Zustand, aus dem es keinen Ausweg gibt, ist keine Taktik.
   */
  TREFFER_BASIS: 0.95,
  TREFFER_JE_STUFE: 0.125,
  TREFFER_MIN: 0.45,

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
export type Zustand = 'rein' | 'befallen' | 'verhaertet' | 'rueckgefuehrt';

/**
 * Darf diese Kreatur gefangen werden?
 *
 * Die Regelbox des Blattes sagt: rein, befallen und rückgeführt ja, **verhärtet
 * nein**. Verhärtet ist das Endstadium — Bossformen und Ruinenwächter. Etwas, das
 * sich nicht mehr zurückführen lässt, nimmt man nicht mit.
 *
 * Steht hier und nicht in der Oberfläche, weil es eine Regel ist und keine Anzeige.
 */
export function fangbarImZustand(z: Zustand): boolean {
  return z !== 'verhaertet';
}

/**
 * Reinigung — der einzige Weg zum vierten Zustand.
 *
 * Bis hierher gab es `rueckgefuehrt` im Enum und keinen Weg dorthin: Der
 * `reinigung`-Gegenstand setzte auf `rein` zurück, und der `reinigung`-Move
 * existierte nur als Datensatz. Damit war die Narbe eine Regel ohne Anlass.
 *
 * Jetzt gilt: Wer **befallen** war und gereinigt wird, ist nicht wieder rein — er
 * ist **zurückgeführt** und trägt die Narbe seiner Herkunft. Das ist die Aussage
 * der Creature Design Bible: „gereinigt, mit permanentem Bonus". Reinigen ist damit
 * keine Reparatur, sondern eine Entscheidung mit Ertrag.
 *
 * Wer nie befallen war, bleibt rein — eine Narbe ohne Wunde gibt es nicht.
 */
export function reinige(k: Kaempfer, narbe: { art: NarbenArt; wert: number }): boolean {
  if (k.zustand !== 'befallen') return false;
  k.zustand = 'rueckgefuehrt';
  k.narbe = narbe;
  // Der Befall-Bonus fällt weg, die Narbe kommt dazu. Beides muss sich in den
  // Werten niederschlagen, sonst behielte ein Zurückgeführter seinen Befall-Bonus.
  const roh = {
    ang: Math.round(k.ang / REGELN.BEFALL_ANG),
    ver: Math.round(k.ver / REGELN.BEFALL_VER),
    ini: Math.round(k.ini / REGELN.BEFALL_INI),
  };
  k.ang = roh.ang;
  k.ver = narbe.art === 'panzer' ? Math.round(roh.ver * (1 + narbe.wert)) : roh.ver;
  k.ini = roh.ini;
  if (narbe.art === 'krit') k.krit += narbe.wert;
  // Zehrung endet — der Zustand ist der Auslöser, nicht eine laufende Wirkung.
  return true;
}

export interface MoveDef {
  id: string; name: string; element: Element; band: Band;
  /**
   * Wirkungen des Moves.
   *
   * **Bis hierher warf `moveDef()` sie weg.** Alle 49 Moves trugen ihre Effekte im
   * JSON, und keiner davon wurde je angewendet — Statuswerte, Heilung, Befall,
   * Mehrfachtreffer waren Dekoration. Ledger G-24 nannte drei fehlende Wirkungen;
   * gefehlt haben alle sieben.
   *
   * Umgesetzt sind jetzt die beiden **stufenförmigen** Arten (`statuswert`,
   * `genauigkeit`), weil sie dieselbe Rechnung teilen und 14 der 21
   * Effektnutzungen abdecken. Die übrigen fünf Arten stehen als G-56 offen.
   */
  effekte?: readonly MoveEffekt[];
}

/**
 * Multiplikator einer Statusstufe, -3 … +3.
 *
 * 20 % je Stufe, bei Abwertung als Kehrwert — damit kann kein Wert auf null
 * fallen und keine Stufenkette einen Kämpfer wehrlos machen. Bewusst flacher als
 * das übliche `(2+n)/2` aus Rundenkämpfen: Diese Engine schwingt über Element und
 * STAB ohnehin um Faktor vier, und ein einziger Utility-Move darf nicht mehr
 * entscheiden als ein Elementvorteil.
 */
export function stufenFaktor(n: number): number {
  const s = Math.max(-3, Math.min(3, n));
  return s >= 0 ? 1 + 0.2 * s : 1 / (1 + 0.2 * -s);
}

const angEff = (k: Kaempfer) => k.ang * stufenFaktor(k.stufenAng);
const verEff = (k: Kaempfer) => k.ver * stufenFaktor(k.stufenVer);
export const iniEff = (k: Kaempfer) => k.ini * stufenFaktor(k.stufenIni);

export interface Kaempfer {
  id: string;
  name: string;
  elemente: Element[];
  zustand: Zustand;
  maxKp: number; kp: number;
  ang: number; ver: number; ini: number;
  moves: MoveDef[];
  fokus: number;
  /** Volltrefferchance 0…1. Grundwert plus Wildling-Narbe. */
  krit: number;
  /** Genauigkeitsstufen, -3…3. Wird von `genauigkeit`-Effekten verschoben. */
  genauigkeit: number;
  /** Statusstufen, -3…3. Nicht in die Werte gerechnet, sondern beim Lesen — sonst driftet es. */
  stufenAng: number; stufenVer: number; stufenIni: number;
  /**
   * Laufende Wirkungen über Runden hinweg.
   *
   * Der Grund, warum die fünf restlichen Effektarten (G-56) länger gebraucht haben
   * als die stufenförmigen: Zustandsschaden und Wechselsperre sind keine Rechnung,
   * sie sind **Gedächtnis**. Ein Kämpfer muss wissen, dass er noch drei Runden
   * blutet — und das muss bei ihm stehen, nicht in der Kampfschleife, sonst geht es
   * beim Wechseln verloren.
   */
  laufend: { art: 'schaden' | 'sperre'; runden: number; proRunde: number }[];
  /**
   * Narbe eines Zurückgeführten. Fehlt bei allen anderen Zuständen.
   *
   * Sie steht am Kämpfer und nicht in den Werten, weil `resistenz` erst beim
   * Schaden greift — sie ändert keine Zahl, sie ändert eine Rechnung.
   */
  narbe?: { art: NarbenArt; wert: number };
  /** Regenten: Element wechselt bei KP-Anteil. */
  phasen?: { elemente: Element[]; abKpAnteil: number }[];
}

export interface Team { kaempfer: Kaempfer[]; aktiv: number; }

export type Ereignis =
  | { art: 'angriff'; von: string; auf: string; move: string; schaden: number; faktor: number;
      kritisch?: boolean; fehlschlag?: boolean }
  | { art: 'wechsel'; zu: string; freierTreffer: number }
  | { art: 'zehrung'; wen: string; schaden: number; notiz?: string }
  | { art: 'phase'; wer: string; elemente: Element[] }
  | { art: 'ko'; wen: string }
  | { art: 'kein_fokus'; wer: string };

// ------------------------------------------------------------- Grundrechnen
/**
 * Felder, die `erstelle` selbst setzt.
 *
 * Alles hier ist Kampfzustand, nicht Kreatureigenschaft: Ein Aufrufer, der eine
 * Kreatur aus Inhalten baut, soll nicht entscheiden können, dass sie mit drei
 * Runden Zustandsschaden ins Feld geht.
 */
type Abgeleitet = 'kp' | 'fokus' | 'krit' | 'genauigkeit'
  | 'stufenAng' | 'stufenVer' | 'stufenIni' | 'laufend';

export function erstelle(
  basis: Omit<Kaempfer, Abgeleitet> & Partial<Pick<Kaempfer, Abgeleitet>>,
): Kaempfer {
  const befallen = basis.zustand === 'befallen';
  const narbe = basis.zustand === 'rueckgefuehrt' ? basis.narbe : undefined;
  // Panzer wirkt auf den Wert, Krit auf die Chance, Resistenz erst beim Schaden.
  const panzer = narbe?.art === 'panzer' ? 1 + narbe.wert : 1;
  return {
    ...basis,
    narbe,
    kp: basis.maxKp,
    fokus: REGELN.FOKUS_START,
    krit: (basis.krit ?? REGELN.KRIT_BASIS) + (narbe?.art === 'krit' ? narbe.wert : 0),
    genauigkeit: basis.genauigkeit ?? 0,
    stufenAng: 0, stufenVer: 0, stufenIni: 0,
    laufend: [],
    ang: Math.round(basis.ang * (befallen ? REGELN.BEFALL_ANG : 1)),
    ver: Math.round(basis.ver * (befallen ? REGELN.BEFALL_VER : 1) * panzer),
    ini: Math.round(basis.ini * (befallen ? REGELN.BEFALL_INI : 1)),
  };
}

/** Verteidigung multipliziert beide Typen. */
export function elementFaktor(angriff: Element, verteidiger: Element[]): number {
  return verteidiger.reduce((f, t) => f * effektivitaet(angriff, t), 1);
}

/**
 * Elementfaktor aus Sicht des Verteidigers — mit Resistenz-Narbe.
 *
 * Die Narbe stumpft nur den **Nachteil** ab, nie den Vorteil: Aus dem doppelten
 * Schaden werden bei 20 % Resistenz 1,8-facher. Einen Vorteil des Verteidigers
 * (Faktor unter 1) lässt sie unangetastet — eine Narbe soll schützen, nicht
 * ausgleichen.
 */
function faktorGegen(a: Kaempfer, d: Kaempfer, move: MoveDef): number {
  const el = elementFaktor(move.element, d.elemente);
  if (d.narbe?.art !== 'resistenz' || el <= 1) return el;
  return 1 + (el - 1) * (1 - d.narbe.wert);
}

/** Trefferwahrscheinlichkeit 0…1 aus den Genauigkeitsstufen des Angreifers. */
export function trefferchance(a: Kaempfer): number {
  return Math.max(REGELN.TREFFER_MIN,
    Math.min(1, REGELN.TREFFER_BASIS + a.genauigkeit * REGELN.TREFFER_JE_STUFE));
}

export interface Schlag {
  wert: number;
  /** Danebengegangen. Unterscheidet sich von „0 Schaden" — Utility trifft immer. */
  fehlschlag: boolean;
  kritisch: boolean;
}

/**
 * Ein Angriff, vollständig: Trefferwurf, Schaden, Volltreffer.
 *
 * Die Reihenfolge der Würfe ist festgelegt und darf nicht getauscht werden —
 * jeder Aufruf von `zufall()` verschiebt sonst alle folgenden, und dann ändern
 * sich die 16 Simulationstests, ohne dass sich eine Regel geändert hat.
 * Deshalb: erst Treffer, dann Streuung, dann Volltreffer.
 */
export function schlag(a: Kaempfer, d: Kaempfer, move: MoveDef, zufall: () => number): Schlag {
  const power = BAND[move.band].power;
  // Utility trifft immer — ein Effekt, der danebengehen kann, wäre eine zweite
  // Zufallsquelle in einem Move, der ohnehin keinen Schaden macht.
  if (power === 0) return { wert: 0, fehlschlag: false, kritisch: false };

  if (zufall() > trefferchance(a)) return { wert: 0, fehlschlag: true, kritisch: false };

  const stab = a.elemente.includes(move.element) ? REGELN.STAB : 1;
  const el = faktorGegen(a, d, move);
  const roh = (angEff(a) / verEff(d)) * power * 18 + 2;
  const streuung = 0.9 + zufall() * 0.2;
  const kritisch = zufall() < a.krit;
  const kf = kritisch ? REGELN.KRIT_SCHADEN : 1;
  return {
    wert: Math.max(1, Math.round(roh * stab * el * streuung * kf)),
    fehlschlag: false, kritisch,
  };
}

/** Nur der Schadenswert — für Aufrufer, die Fehlschlag und Volltreffer nicht anzeigen. */
export function schaden(a: Kaempfer, d: Kaempfer, move: MoveDef, zufall: () => number): number {
  return schlag(a, d, move, zufall).wert;
}

/**
 * Wendet die stufenförmigen Wirkungen eines Moves an.
 *
 * Verschoben werden **Stufen**, nicht Werte — deshalb kann eine Kette aus fünf
 * Blendlinsen nicht tiefer als -3 gehen, und Rückrechnen ist nie nötig. Ein
 * Statuswert, der direkt multipliziert wird, driftet über einen langen
 * Regentenkampf bis zur Unbrauchbarkeit.
 *
 * Rückgabe sind die Namen der geänderten Werte — der Aufrufer entscheidet, ob er
 * sie anzeigt. Die Engine kennt keine Texte.
 */
export function wendeWirkungenAn(
  a: Kaempfer, d: Kaempfer, move: MoveDef,
  /**
   * Zufall für `befall`. Fehlt er, greift die Befallschance nicht — so kann ein
   * Aufrufer, der keine Zufallsquelle hat (Vorschau, KI-Bewertung), die übrigen
   * Wirkungen trocken durchrechnen, ohne den Kampfzufall zu verschieben.
   */
  zufall?: () => number,
  /** Narbe für `reinigung` — sie hängt an der Herkunft, die die Engine nicht kennt. */
  narbe?: { art: NarbenArt; wert: number },
): string[] {
  const gemeldet: string[] = [];
  const setze = (k: Kaempfer, feld: 'stufenAng' | 'stufenVer' | 'stufenIni' | 'genauigkeit',
                 stufen: number, name: string) => {
    const vorher = k[feld];
    k[feld] = Math.max(-3, Math.min(3, vorher + stufen));
    if (k[feld] !== vorher) gemeldet.push(`${k.name}: ${name} ${stufen > 0 ? '+' : ''}${stufen}`);
  };

  for (const e of move.effekte ?? []) {
    switch (e.art) {
      case 'statuswert': {
        const k = e.ziel === 'selbst' ? a : d;
        const feld = e.wert === 'ang' ? 'stufenAng' : e.wert === 'ver' ? 'stufenVer' : 'stufenIni';
        setze(k, feld, e.stufen, e.wert.toUpperCase());
        break;
      }
      case 'genauigkeit':
        setze(e.ziel === 'selbst' ? a : d, 'genauigkeit', e.stufen, 'Genauigkeit');
        break;

      case 'heilung': {
        // Heilt den Anwender. Ein Heilmove auf den Gegner wäre eine eigene
        // Zielangabe wert — bisher braucht kein Move sie.
        if (a.kp <= 0 || a.kp >= a.maxKp) break;
        const vorher = a.kp;
        a.kp = Math.min(a.maxKp, a.kp + Math.round(a.maxKp * e.anteil));
        gemeldet.push(`${a.name} erholt sich um ${a.kp - vorher} KP`);
        break;
      }

      case 'schaden_ueber_zeit':
        // Nicht stapeln: Ein zweiter Aufguss verlängert, statt zu verdoppeln.
        // Sonst multipliziert sich ein billiger Utility-Move zu Tode.
        {
          const da = d.laufend.find(l => l.art === 'schaden');
          if (da) { da.runden = Math.max(da.runden, e.runden); da.proRunde = Math.max(da.proRunde, e.proRunde); }
          else d.laufend.push({ art: 'schaden', runden: e.runden, proRunde: e.proRunde });
          gemeldet.push(`${d.name} nimmt Schaden über ${e.runden} Runden`);
        }
        break;

      case 'wechselsperre':
        {
          const s = d.laufend.find(l => l.art === 'sperre');
          if (s) s.runden = Math.max(s.runden, e.runden);
          else d.laufend.push({ art: 'sperre', runden: e.runden, proRunde: 0 });
          gemeldet.push(`${d.name} kann ${e.runden} Runden nicht wechseln`);
        }
        break;

      case 'befall':
        // Nur rein → befallen. Verhärtet ist Endstadium, zurückgeführt ist
        // gereinigt — beides lässt sich nicht neu anstecken.
        if (zufall && d.zustand === 'rein' && zufall() < e.chance) {
          d.zustand = 'befallen';
          d.ang = Math.round(d.ang * REGELN.BEFALL_ANG);
          d.ver = Math.round(d.ver * REGELN.BEFALL_VER);
          d.ini = Math.round(d.ini * REGELN.BEFALL_INI);
          gemeldet.push(`${d.name} ist befallen`);
        }
        break;

      case 'reinigung':
        // Reinigt den Anwender — ein Move gegen den eigenen Befall.
        if (narbe && reinige(a, narbe)) gemeldet.push(`${a.name} ist zurückgeführt — Narbe: ${narbe.art}`);
        break;

      case 'mehrfachtreffer':
        // Bewusst offen: Mehrfachtreffer greift in `schlag` ein, nicht daneben —
        // jeder Teiltreffer braucht eigene Würfe für Treffer und Volltreffer.
        // Kein Move im Bestand nutzt ihn (0 von 21 Nutzungen).
        break;
    }
  }
  return gemeldet;
}

/**
 * Laufende Wirkungen eine Runde weiterlaufen lassen.
 *
 * Wird am Rundenende gerufen, für jeden Kämpfer. Gibt die Meldungen zurück und
 * zieht den Zustandsschaden ab — abgelaufene Wirkungen verschwinden von selbst.
 */
export function tickeWirkungen(k: Kaempfer): string[] {
  if (!k.laufend.length || k.kp <= 0) return [];
  const gemeldet: string[] = [];
  for (const l of k.laufend) {
    if (l.art === 'schaden') {
      const s = Math.max(1, Math.round(k.maxKp * l.proRunde));
      k.kp -= s;
      gemeldet.push(`${k.name} nimmt ${s} Schaden aus der Wunde`);
    }
    l.runden -= 1;
  }
  k.laufend = k.laufend.filter(l => l.runden > 0);
  return gemeldet;
}

/** Darf dieser Kämpfer gewechselt werden? `wechselsperre` sagt manchmal nein. */
export function darfWechseln(k: Kaempfer): boolean {
  return !k.laufend.some(l => l.art === 'sperre');
}

/** Erwartungswert ohne Zufall — für die KI. */
function erwartet(a: Kaempfer, d: Kaempfer): number {
  const beste = a.moves
    .filter(m => BAND[m.band].power > 0 && BAND[m.band].fokus <= a.fokus)
    .map(m => {
      const stab = a.elemente.includes(m.element) ? REGELN.STAB : 1;
      // Mit Stufen und Trefferchance, sonst überschätzt die KI einen geblendeten
      // Kämpfer und wechselt nicht, wenn sie es müsste.
      return ((angEff(a) / verEff(d)) * BAND[m.band].power * 18 + 2)
        * stab * elementFaktor(m.element, d.elemente) * trefferchance(a);
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
  // Gesperrt heißt gesperrt — auch für die KI. Sonst wäre die Wechselsperre eine
  // Regel, die nur den Spieler bindet.
  if (!darfWechseln(cur)) return null;
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
        iniEff(boss) > iniEff(cur) ? [[boss, cur], [cur, boss]] : [[cur, boss], [boss, cur]];
      for (const [a, d] of reihe) {
        if (a.kp <= 0 || d.kp <= 0) continue;
        const m = waehleMove(a, d);
        if (!m) { merke({ art: 'kein_fokus', wer: a.name }); a.fokus = Math.min(REGELN.FOKUS_MAX, a.fokus + REGELN.FOKUS_REGEN); continue; }
        a.fokus -= BAND[m.band].fokus;
        wendeWirkungenAn(a, d, m, zufall);
        const t = schlag(a, d, m, zufall);
        let s = t.wert;
        if (d === cur && schild) s = Math.round(s * REGELN.SHIELD_DR);
        d.kp -= s;
        merke({ art: 'angriff', von: a.name, auf: d.name, move: m.name, schaden: s,
                faktor: elementFaktor(m.element, d.elemente),
                kritisch: t.kritisch, fehlschlag: t.fehlschlag });
      }
      schild = 0;
      for (const k of [cur, boss]) k.fokus = Math.min(REGELN.FOKUS_MAX, k.fokus + REGELN.FOKUS_REGEN);
    }

    // Laufende Wirkungen: Zustandsschaden und ablaufende Sperren
    for (const k of [cur, boss]) {
      for (const m of tickeWirkungen(k)) merke({ art: 'zehrung', wen: k.name, schaden: 0, notiz: m });
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
