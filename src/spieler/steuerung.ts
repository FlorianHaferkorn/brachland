/**
 * BRACHLAND — Eingabe für Bewegung und Blickrichtung
 *
 * Zwei Geräte, ein Zustand. Das Handy ist das Zielgerät, also ist Touch kein
 * Nachtrag: linke Bildhälfte bewegt, rechte dreht den Blick. Auf dem Laptop
 * dasselbe über WASD und Ziehen mit der Maus.
 *
 * Der Zustand liegt in einem Ref, nicht im React-State — bei 60 Bildern je Sekunde
 * wäre ein Re-Render pro Eingabe sinnlos teuer.
 */
import { useEffect, useRef, type RefObject } from 'react';

export interface Eingabe {
  /** Vorwärts/rückwärts, -1 … 1 */
  vor: number;
  /** Seitwärts, -1 … 1 */
  seit: number;
  /** Drehrate aus Tastatur, rad/s */
  drehRate: number;
  /** Aufgelaufene Drehung aus Wischen/Ziehen, rad. Wird je Bild verbraucht. */
  drehDelta: number;
  /** Neigerate aus Tastatur, rad/s. Positiv heißt nach oben schauen. */
  neigRate: number;
  /** Aufgelaufene Neigung aus Wischen/Ziehen, rad. Wird je Bild verbraucht. */
  neigDelta: number;
  rennen: boolean;
  /** Einmaliger Sprungwunsch. Wird beim Verbrauchen zurückgesetzt. */
  springen: boolean;
}

/** Wie weit der Daumen wandern muss, bis der Stock voll ausschlägt. */
const STOCK_RADIUS = 64;
/**
 * Totzone als Anteil des Radius.
 *
 * Ein Daumen liegt nie still. Ohne Totzone dreht die Kamera schon beim Aufsetzen,
 * und ein Tipp zum Springen wird zum Schwenk.
 */
const TOTZONE = 0.16;
/** Bildschirmpixel je Radiant beim Ziehen mit der **Maus**. Der Daumen zieht nicht. */
const PIXEL_JE_RADIANT = 320;
/** Drehgeschwindigkeit bei vollem Ausschlag des Blickstocks, rad/s. */
const ZEIGER_DREHRATE = 2.4;
/** Neigegeschwindigkeit bei vollem Ausschlag, rad/s. Kleiner, weil der Weg kurz ist. */
const ZEIGER_NEIGRATE = 1.1;
/** Drehgeschwindigkeit der Tastatur. */
const TASTEN_DREHRATE = 1.8;
/** Neigegeschwindigkeit der Tastatur (R/F). */
const TASTEN_NEIGRATE = 1.2;

/** Ein sichtbarer Knüppel: Ansetzpunkt in Bildschirmpixeln plus Ausschlag −1…1. */
export interface Stock { x: number; y: number; dx: number; dy: number }
/** Was gerade unter den Daumen liegt. `null` heißt: kein Finger auf dieser Seite. */
export interface Stoecke { links: Stock | null; rechts: Stock | null }

export function benutzeSteuerung(
  element: HTMLElement | null, stoecke?: RefObject<Stoecke>,
): RefObject<Eingabe> {
  const eingabe = useRef<Eingabe>({
    vor: 0, seit: 0, drehRate: 0, drehDelta: 0, neigRate: 0, neigDelta: 0,
    rennen: false, springen: false,
  });

  useEffect(() => {
    if (!element) return;
    const e = eingabe.current;
    const tasten = new Set<string>();

    const ausTasten = () => {
      e.vor = (tasten.has('KeyW') || tasten.has('ArrowUp') ? 1 : 0)
            - (tasten.has('KeyS') || tasten.has('ArrowDown') ? 1 : 0);
      e.seit = (tasten.has('KeyD') ? 1 : 0) - (tasten.has('KeyA') ? 1 : 0);
      e.drehRate = ((tasten.has('KeyQ') || tasten.has('ArrowLeft') ? 1 : 0)
                  - (tasten.has('KeyE') || tasten.has('ArrowRight') ? 1 : 0)) * TASTEN_DREHRATE;
      e.neigRate = ((tasten.has('KeyR') ? 1 : 0) - (tasten.has('KeyF') ? 1 : 0)) * TASTEN_NEIGRATE;
      e.rennen = tasten.has('ShiftLeft') || tasten.has('ShiftRight');
    };

    const runter = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement) return;
      // Leertaste scrollt sonst die Seite — auf dem Laptop sofort spuerbar.
      if (ev.code === 'Space') { ev.preventDefault(); e.springen = true; }
      tasten.add(ev.code); ausTasten();
    };
    const hoch = (ev: KeyboardEvent) => { tasten.delete(ev.code); ausTasten(); };
    const verlassen = () => { tasten.clear(); ausTasten(); };

    // Wischen darf die Seite nicht scrollen oder zoomen — auf dem Handy sonst
    // unbenutzbar, weil jeder Blickwechsel am Seitenrand zieht.
    const kein = (ev: Event) => ev.preventDefault();
    element.addEventListener('touchmove', kein, { passive: false });

    window.addEventListener('keydown', runter);
    window.addEventListener('keyup', hoch);
    window.addEventListener('blur', verlassen);

    // ---- Zeiger: links bewegen, rechts blicken -------------------------------
    //
    // Drei Dinge sind hier am 26.08.2026 geändert worden, alle drei aus einer
    // Rückmeldung vom Gerät („Umsehen“, „beides gleichzeitig“, „kein sichtbarer
    // Stick“). Sie hängen zusammen und stehen deshalb zusammen.
    //
    // **1. Kein `setPointerCapture` mehr, und `move`/`up` liegen am `window`.**
    // Capture bindet einen Zeiger an ein Element; zwei gleichzeitige Berührungen
    // auf demselben Element sind laut Norm erlaubt, in Safari auf iOS fällt dabei
    // aber regelmäßig einer heraus. Am `window` mit Filter auf die `pointerId`
    // gibt es das Problem nicht — und der Finger darf über den Bildrand hinaus,
    // ohne dass der Stock stehenbleibt.
    //
    // **2. Die rechte Hälfte ist ein Stock, kein Wisch.** Vorher lief die Drehung
    // über `drehDelta`, also über die **Strecke**, die der Finger zurücklegt: Bei
    // 320 px je Radiant braucht eine halbe Drehung 1.000 px, das sind drei bis
    // vier volle Wischer über ein Handydisplay, und zwischen zwei Wischern steht
    // die Kamera. Jetzt setzt der Ausschlag eine **Rate** — dieselben Felder
    // `drehRate`/`neigRate`, die auch die Tastatur füllt. Ein Daumen, der liegen
    // bleibt, dreht weiter.
    //
    // **3. Beide Stöcke melden ihren Zustand nach draussen**, damit die Anzeige
    // sie zeichnen kann. Ohne sichtbaren Knüppel sieht man nicht, wo man
    // hinfassen muss und ob der Finger noch greift.
    type Zeiger = {
      /** Ansetzpunkt in Bildschirmkoordinaten — der Stock wächst von hier. */
      start: [number, number];
      links: boolean;
      /** Zeitpunkt des Aufsetzens, für die Tipp-Erkennung. */
      zeit: number;
      /** Grösster Ausschlag, ebenfalls für die Tipp-Erkennung. */
      weiteste: number;
      /** Letzte Position — nur der Mauspfad braucht sie. */
      letzte: [number, number];
      /**
       * Daumen oder Maus?
       *
       * Der Blick läuft je nach Gerät verschieden, und das ist keine Bequemlichkeit,
       * sondern folgt aus dem Gerät: Eine Maus hat **unbegrenzten Weg** — man hebt
       * sie an und setzt sie neu auf —, also ist Ziehen dort genau richtig. Ein
       * Daumen hat 6 cm, und danach ist der Bildschirmrand. Deshalb: Maus zieht,
       * Daumen hält.
       */
      tipp: boolean;
    };
    const zeiger = new Map<number, Zeiger>();

    /** Ausschlag auf den Einheitskreis begrenzen, mit Totzone. */
    const ausschlag = (dx: number, dy: number): [number, number, number] => {
      const laenge = Math.hypot(dx, dy) / STOCK_RADIUS;
      if (laenge < TOTZONE) return [0, 0, 0];
      const f = (laenge > 1 ? 1 / laenge : 1) / STOCK_RADIUS;
      return [dx * f, dy * f, Math.min(1, laenge)];
    };

    const meldeStoecke = () => {
      if (!stoecke) return;
      stoecke.current = { links: null, rechts: null };
      for (const [, z] of zeiger) {
        // Die Maus bekommt keinen Knüppel gezeichnet — sie zieht, sie hält nicht.
        if (!z.tipp) continue;
        const seite = z.links ? 'links' : 'rechts';
        if (stoecke.current[seite]) continue;   // je Seite zählt der erste Finger
        stoecke.current[seite] = {
          x: z.start[0], y: z.start[1],
          dx: z.links ? e.seit : zeigerDreh,
          dy: z.links ? -e.vor : zeigerNeig,
        };
      }
    };
    // Der Blickstock schreibt Raten, nicht Ausschläge — für die Anzeige wird der
    // Ausschlag trotzdem gebraucht, also hier gemerkt.
    let zeigerDreh = 0, zeigerNeig = 0;

    const zeigerRunter = (ev: PointerEvent) => {
      const links = ev.clientX < element.clientWidth / 2;
      zeiger.set(ev.pointerId, {
        start: [ev.clientX, ev.clientY], letzte: [ev.clientX, ev.clientY], links,
        zeit: ev.timeStamp, weiteste: 0, tipp: ev.pointerType !== 'mouse',
      });
      meldeStoecke();
    };

    const zeigerBewegt = (ev: PointerEvent) => {
      const z = zeiger.get(ev.pointerId);
      if (!z) return;
      const dx = ev.clientX - z.start[0], dy = ev.clientY - z.start[1];
      z.weiteste = Math.max(z.weiteste, Math.hypot(dx, dy));
      const [ax, ay, laenge] = ausschlag(dx, dy);
      if (z.links) {
        e.seit = ax;
        e.vor = -ay;                     // nach oben wischen = vorwärts
        e.rennen = laenge > 0.85;        // voller Ausschlag heißt rennen
      } else if (z.tipp) {
        zeigerDreh = ax; zeigerNeig = ay;
        e.drehRate = -ax * ZEIGER_DREHRATE;
        // Nach oben wischen heißt nach oben schauen — dieselbe Richtung wie beim
        // Bewegungsstock, sonst muss man beim Wechseln der Hand umdenken.
        e.neigRate = -ay * ZEIGER_NEIGRATE;
      } else {
        // Maus: Ziehen wie bisher, über die Strecke statt über den Ausschlag.
        e.drehDelta -= (ev.clientX - z.letzte[0]) / PIXEL_JE_RADIANT;
        e.neigDelta -= (ev.clientY - z.letzte[1]) / PIXEL_JE_RADIANT;
      }
      z.letzte = [ev.clientX, ev.clientY];
      meldeStoecke();
    };

    const zeigerHoch = (ev: PointerEvent) => {
      const z = zeiger.get(ev.pointerId);
      if (!z) return;
      if (z.links) { e.vor = 0; e.seit = 0; e.rennen = false; }
      else {
        e.drehRate = 0; e.neigRate = 0; zeigerDreh = 0; zeigerNeig = 0;
        // Kurzer Tipp ohne nennenswerte Bewegung: springen. 12 px trennen Tippen
        // von einem beginnenden Schwenk; die Zeitschranke trennt es von einem
        // Finger, der lange still auf dem Stock liegt und dabei nur geradeaus
        // schaut — der will nicht springen.
        if (z.weiteste < 12 && ev.timeStamp - z.zeit < 350) e.springen = true;
      }
      zeiger.delete(ev.pointerId);
      meldeStoecke();
    };

    // `touch-action: none` ist keine Kosmetik, sondern die Bedingung dafür, dass
    // zwei Finger gleichzeitig ankommen: Ohne die Angabe behält der Browser die
    // Geste für sich (Scrollen, Doppeltipp-Zoom, Pinch) und schickt beim zweiten
    // Finger ein `pointercancel`. Genau das war „beides gleichzeitig geht nicht“.
    const vorherigeAktion = element.style.touchAction;
    element.style.touchAction = 'none';

    element.addEventListener('pointerdown', zeigerRunter);
    // Bewegung und Loslassen am `window`, nicht am Element: Ein Finger, der über
    // den Rand der Leinwand wandert, soll den Stock nicht verlieren.
    window.addEventListener('pointermove', zeigerBewegt);
    window.addEventListener('pointerup', zeigerHoch);
    window.addEventListener('pointercancel', zeigerHoch);

    return () => {
      window.removeEventListener('keydown', runter);
      window.removeEventListener('keyup', hoch);
      window.removeEventListener('blur', verlassen);
      element.removeEventListener('touchmove', kein);
      element.style.touchAction = vorherigeAktion;
      element.removeEventListener('pointerdown', zeigerRunter);
      window.removeEventListener('pointermove', zeigerBewegt);
      window.removeEventListener('pointerup', zeigerHoch);
      window.removeEventListener('pointercancel', zeigerHoch);
    };
  }, [element, stoecke]);

  return eingabe;
}
