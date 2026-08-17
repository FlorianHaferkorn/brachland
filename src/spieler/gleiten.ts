/**
 * BRACHLAND — Gleiten
 *
 * Der letzte der sechs Traversal-Verben (`docs/design/BRACHLAND_Traversal_v1.md`,
 * Ledger G-44). Ausdauer, Springen, Klettern, Waten, Schwimmen und Reiten standen;
 * Gleiten fehlte, weil es Fallgeschwindigkeit brauchte — und die gab es erst, seit
 * die Figur nicht mehr am Boden klebt (G-41).
 *
 * ## Das Gleitverhältnis ist gemessen, nicht gewählt
 *
 * `npm run gleit` hat 9.600 Flüge über das Höhenfeld gerechnet, je 400
 * Absprungkanten in acht Richtungen, für 2:1, 3:1 und 4:1:
 *
 * | Verhältnis | Median beste Richtung | Kanten > 500 m | Ersparnis gegen Rennen |
 * |---|---|---|---|
 * | 2:1 | 280 m | 21 % | **0,7 s** |
 * | **3:1** | **540 m** | **53 %** | **29,6 s** |
 * | 4:1 | 825 m | 64 % | 69,3 s |
 *
 * 2:1 scheidet aus: Gegen die 11,0 m/s, die im Code stehen, spart es im Mittel
 * eine Dreiviertelsekunde — das ist keine Fähigkeit, das ist eine Animation. 4:1
 * bringt mit einem Median von 825 m und Spitzen von 2,9 km ein Fünftel bis
 * Dreiviertel der Regionsbreite in einen einzigen Flug; dann ist der Rest der
 * Karte Kulisse. **3:1** liegt dazwischen und ist deshalb gesetzt.
 *
 * ## Warum es keinen eigenen Knopf gibt
 *
 * Der naheliegende Entwurf wäre „Sprungtaste halten". Er scheitert am Zielgerät:
 * Auf dem Handy ist Springen ein **Tipp** auf die rechte Bildhälfte, und ein Tipp
 * lässt sich nicht halten, ohne ihn vom beginnenden Blickschwenk zu unterscheiden.
 * Ein zweiter Knopf für eine Fähigkeit, die man ohnehin immer will, wäre eine
 * Bedienlast ohne Entscheidung dahinter.
 *
 * Stattdessen öffnet der Gleiter **von selbst**, sobald ein Fall ernst wird:
 * `GLEIT_AB` Meter unter dem höchsten Punkt des Falls. Von einer Geländestufe
 * springt man weiter wie vorher, von einer Kante trägt es. Wer doch fallen will,
 * drückt Springen — das faltet den Gleiter bis zur Landung zusammen.
 *
 * Reines Modul ohne three.js und React (`tests/gleiten.test.ts`).
 */
import { SCHWERKRAFT } from './tempo.js';

/**
 * Horizontal zu vertikal. Aus der Messung (siehe Kopf).
 *
 * Bei `GLEIT_SINKEN` von 4,0 m/s heißt 3:1 ein Vorwärtstempo von 12,0 m/s — knapp
 * über den 11,0 m/s Rennen. Das ist Absicht: Gleiten soll sich schneller anfühlen
 * als Rennen, aber nicht wie ein anderes Spiel.
 */
export const GLEIT_VERHAELTNIS = 3;

/** Sinkgeschwindigkeit am Gleiter, m/s. Ohne ihn fällt man mit bis zu 50 m/s. */
export const GLEIT_SINKEN = 4.0;

/** Vorwärtsgeschwindigkeit am Gleiter, m/s. Folgt aus Verhältnis und Sinkrate. */
export const GLEIT_TEMPO = GLEIT_SINKEN * GLEIT_VERHAELTNIS;

/**
 * Ab wie vielen Metern Fallhöhe der Gleiter aufgeht.
 *
 * 3,0 m ist mit Bedacht **über** der Sprunghöhe (1,49 m): Ein Sprung darf sich nie
 * in einen Flug verwandeln, sonst schwebt man über jede Türschwelle. Gleichzeitig
 * niedrig genug, dass eine Felskante von 4 m schon trägt — und Felskanten hat das
 * Œntal 9,3 % der Fläche.
 */
export const GLEIT_AB = 3.0;

/**
 * Freigeschaltet mit dem Regenten der Region.
 *
 * Das Traversal-Dokument setzt Gleiten auf „Kapitel 2". Im Spielverlauf ist das
 * derselbe Moment: Kapitel 1 endet mit dem Flussvater. Abgeleitet aus dem
 * Weltzustand (`regenten` im Spielstand) und **nicht** als eigenes Feld gespeichert
 * — dieselbe Regel wie beim Auftragsfortschritt (D56). Ein zweiter Merker über
 * denselben Sachverhalt driftet, sobald irgendwo ein Haken fehlt.
 */
export function gleiterFrei(besiegteRegenten: readonly string[]): boolean {
  return besiegteRegenten.length > 0;
}

/** Laufender Zustand eines Falls. Liegt beim Spieler, nicht in der Bildschleife. */
export interface Fall {
  /** Höchster Punkt seit dem letzten Bodenkontakt. Referenz für die Fallhöhe. */
  scheitel: number;
  /** Gleiter von Hand eingeklappt — bis zur Landung. */
  gefaltet: boolean;
}

export function neuerFall(y: number): Fall {
  return { scheitel: y, gefaltet: false };
}

export interface GleitEingabe {
  /** Aktuelle Höhe der Figur. */
  y: number;
  /** Vertikale Geschwindigkeit, negativ heißt fallen. */
  steigen: number;
  amBoden: boolean;
  /** Zustände, in denen kein Gleiter aufgeht. */
  gesperrt: boolean;
  /** Gleiter überhaupt vorhanden. */
  frei: boolean;
  /** Sprungwunsch in diesem Bild — faltet einen offenen Gleiter zusammen. */
  falten: boolean;
}

export interface GleitErgebnis {
  fall: Fall;
  gleitet: boolean;
  /** Vertikale Geschwindigkeit nach der Gleitregel. */
  steigen: number;
  /** Wie tief man unter dem Scheitel des Falls hängt. Für die Anzeige. */
  fallhoehe: number;
}

/**
 * Eine Runde Gleitlogik. Rein: Eingabe rein, neuer Zustand raus.
 *
 * Reihenfolge zählt und ist der Grund, warum das hier steht und nicht in der
 * Bildschleife: **erst** den Scheitel nachführen, **dann** die Fallhöhe messen,
 * **dann** entscheiden. Andersherum misst man die Fallhöhe gegen einen Scheitel,
 * den der aktuelle Aufstieg gerade selbst gesetzt hat, und der Gleiter geht im
 * Steigflug auf.
 */
export function gleitSchritt(fall: Fall, e: GleitEingabe): GleitErgebnis {
  if (e.amBoden || e.gesperrt) {
    return { fall: neuerFall(e.y), gleitet: false, steigen: e.steigen, fallhoehe: 0 };
  }

  const scheitel = Math.max(fall.scheitel, e.y);
  const gefaltet = fall.gefaltet || e.falten;
  const fallhoehe = scheitel - e.y;

  const gleitet = e.frei && !gefaltet && e.steigen < 0 && fallhoehe >= GLEIT_AB;
  return {
    fall: { scheitel, gefaltet },
    gleitet,
    steigen: gleitet ? bremse(e.steigen) : e.steigen,
    fallhoehe,
  };
}

/**
 * Die Gleitregel selbst: **nur bremsen, nie beschleunigen.**
 *
 * Wer langsamer fällt als der Gleiter sinkt, behält seine Geschwindigkeit — sonst
 * zöge der Gleiter einen sanften Fall nach unten, statt ihn zu tragen.
 *
 * Steht als eigene Funktion da, weil die Bildschleife sie ein zweites Mal braucht:
 * Dort wird erst die Schwerkraft auf `steigen` gerechnet und **danach** gebremst.
 * Die Regel zweimal hinzuschreiben wäre die Sorte Verdopplung, die auseinanderläuft.
 */
export function bremse(steigen: number): number {
  return Math.max(steigen, -GLEIT_SINKEN);
}

/**
 * Wie weit trägt ein Flug aus dieser Höhe, ohne Gelände?
 *
 * Die Obergrenze, gegen die sich jede gemessene Weite vergleichen lässt. Ob sie
 * erreicht wird, entscheidet das Höhenfeld — `tools/gleitcheck.ts` misst das.
 */
export function reichweite(hoehe: number): number {
  return Math.max(0, hoehe) * GLEIT_VERHAELTNIS;
}

/** Wie lange dieser Flug dauert, in Sekunden. */
export function flugdauer(hoehe: number): number {
  return Math.max(0, hoehe) / GLEIT_SINKEN;
}

/**
 * Freier Fall aus derselben Höhe, zum Vergleich — die Zahl, die den Gleiter
 * begründet. Ohne ihn schlägt man aus 200 m mit 63 m/s auf.
 */
export function fallgeschwindigkeit(hoehe: number): number {
  return Math.sqrt(2 * SCHWERKRAFT * Math.max(0, hoehe));
}
