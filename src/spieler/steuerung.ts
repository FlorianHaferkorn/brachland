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
  rennen: boolean;
}

/** Wie weit der Daumen wandern muss, bis der Stock voll ausschlägt. */
const STOCK_RADIUS = 64;
/** Bildschirmpixel je Radiant beim Drehen. */
const PIXEL_JE_RADIANT = 320;
/** Drehgeschwindigkeit der Tastatur. */
const TASTEN_DREHRATE = 1.8;

export function benutzeSteuerung(element: HTMLElement | null): RefObject<Eingabe> {
  const eingabe = useRef<Eingabe>({ vor: 0, seit: 0, drehRate: 0, drehDelta: 0, rennen: false });

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
      e.rennen = tasten.has('ShiftLeft') || tasten.has('ShiftRight');
    };

    const runter = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement) return;
      tasten.add(ev.code); ausTasten();
    };
    const hoch = (ev: KeyboardEvent) => { tasten.delete(ev.code); ausTasten(); };
    const verlassen = () => { tasten.clear(); ausTasten(); };

    window.addEventListener('keydown', runter);
    window.addEventListener('keyup', hoch);
    window.addEventListener('blur', verlassen);

    // ---- Zeiger: links bewegen, rechts blicken -------------------------------
    type Zeiger = { start: [number, number]; letzte: [number, number]; links: boolean };
    const zeiger = new Map<number, Zeiger>();

    const zeigerRunter = (ev: PointerEvent) => {
      const links = ev.clientX < element.clientWidth / 2;
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
      }
      z.letzte = [ev.clientX, ev.clientY];
    };

    const zeigerHoch = (ev: PointerEvent) => {
      const z = zeiger.get(ev.pointerId);
      if (!z) return;
      if (z.links) { e.vor = 0; e.seit = 0; e.rennen = false; }
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
      element.removeEventListener('pointerdown', zeigerRunter);
      element.removeEventListener('pointermove', zeigerBewegt);
      element.removeEventListener('pointerup', zeigerHoch);
      element.removeEventListener('pointercancel', zeigerHoch);
    };
  }, [element]);

  return eingabe;
}
