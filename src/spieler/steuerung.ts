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
/** Bildschirmpixel je Radiant beim Drehen. */
const PIXEL_JE_RADIANT = 320;
/** Drehgeschwindigkeit der Tastatur. */
const TASTEN_DREHRATE = 1.8;
/** Neigegeschwindigkeit der Tastatur (R/F). */
const TASTEN_NEIGRATE = 1.2;

export function benutzeSteuerung(element: HTMLElement | null): RefObject<Eingabe> {
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
    type Zeiger = { start: [number, number]; letzte: [number, number]; links: boolean };
    const zeiger = new Map<number, Zeiger>();

    const zeigerRunter = (ev: PointerEvent) => {
      const links = ev.clientX < element.clientWidth / 2;
      // Tippen auf die rechte Haelfte, ohne zu ziehen, ist der Sprung. Erkannt wird
      // das beim Loslassen — hier nur der Startpunkt.

      zeiger.set(ev.pointerId, { start: [ev.clientX, ev.clientY], letzte: [ev.clientX, ev.clientY], links });
      element.setPointerCapture(ev.pointerId);
    };

    const zeigerBewegt = (ev: PointerEvent) => {
      const z = zeiger.get(ev.pointerId);
      if (!z) return;
      if (z.links) {
        const dx = (ev.clientX - z.start[0]) / STOCK_RADIUS;
        const dy = (ev.clientY - z.start[1]) / STOCK_RADIUS;
        const laenge = Math.hypot(dx, dy);
        const f = laenge > 1 ? 1 / laenge : 1;
        e.seit = dx * f;
        e.vor = -dy * f;                 // nach oben wischen = vorwärts
        e.rennen = laenge > 0.85;        // voller Ausschlag heißt rennen
      } else {
        e.drehDelta -= (ev.clientX - z.letzte[0]) / PIXEL_JE_RADIANT;
        // Nach oben wischen heißt nach oben schauen — dieselbe Richtung wie beim
        // Bewegungsstock, sonst muss man beim Wechseln der Hand umdenken.
        e.neigDelta -= (ev.clientY - z.letzte[1]) / PIXEL_JE_RADIANT;
      }
      z.letzte = [ev.clientX, ev.clientY];
    };

    const zeigerHoch = (ev: PointerEvent) => {
      const z = zeiger.get(ev.pointerId);
      if (!z) return;
      if (z.links) { e.vor = 0; e.seit = 0; e.rennen = false; }
      else {
        // Kurzer Tipp ohne nennenswerte Bewegung: springen. Der Schwellwert von
        // 12 px trennt Tippen von einem beginnenden Blickschwenk — darunter ist
        // jede Bewegung Wackeln der Hand, darueber will jemand die Kamera drehen.
        const weg = Math.hypot(ev.clientX - z.start[0], ev.clientY - z.start[1]);
        if (weg < 12) e.springen = true;
      }
      zeiger.delete(ev.pointerId);
    };

    element.addEventListener('pointerdown', zeigerRunter);
    element.addEventListener('pointermove', zeigerBewegt);
    element.addEventListener('pointerup', zeigerHoch);
    element.addEventListener('pointercancel', zeigerHoch);

    return () => {
      window.removeEventListener('keydown', runter);
      window.removeEventListener('keyup', hoch);
      window.removeEventListener('blur', verlassen);
      element.removeEventListener('touchmove', kein);
      element.removeEventListener('pointerdown', zeigerRunter);
      element.removeEventListener('pointermove', zeigerBewegt);
      element.removeEventListener('pointerup', zeigerHoch);
      element.removeEventListener('pointercancel', zeigerHoch);
    };
  }, [element]);

  return eingabe;
}
