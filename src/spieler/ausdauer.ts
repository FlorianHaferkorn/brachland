/**
 * BRACHLAND — Ausdauer
 *
 * Die Sperre, an der alle Traversal-Formen hängen. Ohne sie ist Klettern
 * unbegrenzt, und unbegrenztes Klettern macht jede Felswand und jeden Umweg
 * bedeutungslos: Man geht überall gerade hoch.
 *
 * **Rennen zehrt bewusst NICHT.** Das ist die Abweichung von Enshrouded, und sie
 * ist eine Entscheidung, keine Auslassung: Die Region ist 4 km breit, Rennen ist
 * die Antwort auf „Bewegung zu langsam", und eine Ausdauergrenze aufs Rennen nimmt
 * genau das wieder zurück. Was dabei herauskommt, ist Stop-and-Go — die
 * ermüdendste Fortbewegung, die ein offenes Gelände anbieten kann.
 *
 * Gezehrt wird an dem, was Gelände überwindet statt es zu durchqueren: Klettern,
 * Springen, später Schwimmen und Gleiten. Dort ist die Grenze das Spiel.
 *
 * Reines Modul ohne three.js und ohne React — deshalb testbar (`tests/ausdauer.test.ts`).
 */

/** Volle Ausdauer. Die Einheit ist willkürlich; die Zehrraten geben ihr Bedeutung. */
export const AUSDAUER_MAX = 100;

/**
 * Zehrung je Sekunde beim Klettern.
 *
 * 16/s heißt 6,25 s am Fels, bei 2,2 m/s Klettertempo also **13,8 m Wand** aus dem
 * Stand. Die höchsten Klippen im Œntal messen 14 m (`baueKlippen`, gedeckelt) —
 * die Zahl ist so gewählt, dass die höchste Wand gerade eben nicht in einem Zug
 * geht. Ein Absatz zum Verschnaufen wird damit zur Route, nicht zur Zierde.
 */
export const KLETTERN_JE_SEK = 16;

/** Ein Sprung. 12 Punkte heißen acht Sprünge hintereinander aus vollem Vorrat. */
export const SPRUNG_KOSTEN = 12;

/** Erholung je Sekunde. Voll in 3,8 s — kurz genug, um nicht zu warten. */
export const ERHOLUNG_JE_SEK = 26;

/**
 * So lange nach der letzten Zehrung passiert nichts.
 *
 * Ohne diese Pause regeneriert es zwischen zwei Klettergriffen und die Grenze
 * verschwindet. 0,7 s ist der Abstand, ab dem eine Unterbrechung eine Entscheidung
 * ist und kein Tastenrhythmus.
 */
export const RUHE_BIS = 0.7;

/**
 * Nach dem Nullpunkt bleibt gesperrt, bis dieser Anteil wieder da ist.
 *
 * Ohne Hysterese fängt man bei 0 an zu flackern: ein Bild Klettern, ein Bild
 * Fallen, ein Bild Klettern. 30 % erzwingen eine echte Pause.
 */
export const ERHOLT_AB = 0.30;

export interface Ausdauer {
  /** 0 … AUSDAUER_MAX. */
  wert: number;
  /** Sekunden seit der letzten Zehrung. */
  seitZehrung: number;
  /** Am Nullpunkt gewesen und noch nicht über ERHOLT_AB zurück. */
  erschoepft: boolean;
}

export function neueAusdauer(): Ausdauer {
  return { wert: AUSDAUER_MAX, seitZehrung: RUHE_BIS, erschoepft: false };
}

/** Anteil 0…1 — das, was der Balken anzeigt. */
export function anteil(a: Ausdauer): number {
  return a.wert / AUSDAUER_MAX;
}

/**
 * Darf eine zehrende Handlung beginnen oder weiterlaufen?
 *
 * Erschöpft heißt gesperrt, auch wenn schon wieder ein paar Punkte da sind —
 * genau dafür ist die Hysterese da.
 */
export function reicht(a: Ausdauer, kosten = 0): boolean {
  if (a.erschoepft) return false;
  return a.wert >= kosten && a.wert > 0;
}

/**
 * Ein Zeitschritt.
 *
 * `zehrungJeSek` ist die laufende Zehrung der aktuellen Handlung (0 = nichts).
 * Rückgabe ist ein neuer Zustand; der alte bleibt unangetastet, damit die Funktion
 * ohne Seiteneffekt testbar ist.
 */
export function schritt(a: Ausdauer, dt: number, zehrungJeSek = 0): Ausdauer {
  if (dt <= 0) return a;

  if (zehrungJeSek > 0) {
    const wert = Math.max(0, a.wert - zehrungJeSek * dt);
    return { wert, seitZehrung: 0, erschoepft: a.erschoepft || wert <= 0 };
  }

  const seitZehrung = a.seitZehrung + dt;
  if (seitZehrung < RUHE_BIS) return { ...a, seitZehrung };

  const wert = Math.min(AUSDAUER_MAX, a.wert + ERHOLUNG_JE_SEK * dt);
  // Die Sperre fällt erst, wenn wieder genug da ist, um etwas damit anzufangen.
  const erschoepft = a.erschoepft && wert < AUSDAUER_MAX * ERHOLT_AB;
  return { wert, seitZehrung, erschoepft };
}

/**
 * Einmalige Kosten — der Sprung.
 *
 * Reicht es nicht, bleibt der Zustand unverändert; der Aufrufer prüft vorher mit
 * `reicht` und führt die Handlung gar nicht erst aus.
 */
export function verbrauche(a: Ausdauer, kosten: number): Ausdauer {
  if (!reicht(a, kosten)) return a;
  const wert = Math.max(0, a.wert - kosten);
  return { wert, seitZehrung: 0, erschoepft: a.erschoepft || wert <= 0 };
}
