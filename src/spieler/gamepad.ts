/**
 * BRACHLAND — Gamepad über die Gamepad API (D415, A-29 (5): vor dem ersten Fremdtest, Grundbelegung fest)
 *
 * **Ein Weg für alle Geräte.** Knöpfe werden zu Codes (`Pad:A`, `Pad:RB` …) und als synthetische
 * `keydown`/`keyup` am `window` gemeldet — denselben Weg, den die Galerie-Vorführung (`Kampfplatz.tsx`)
 * und die Touch-Knöpfe (`main.tsx`) schon gehen. Wer Aktionen über `spieler/eingabe.ts` liest, bekommt das
 * Gamepad damit ohne eigene Verdrahtung. Die Sticks sind Achsen: `padAchsen()` liest `steuerung.ts` je Bild.
 *
 * Reine Teile (`totzone`, `knopfCodes`, `Doppelknopf`, `ruck`) sind ohne Browser getestet
 * (`tests/eingabe.test.ts`); `starteGamepad` ist die dünne Browser-Seite.
 *
 * Nicht erprobt: Verhalten an echten Geräten (Xbox, DualSense, 8BitDo) und in Safari — nur
 * `mapping === 'standard'` wird gelesen, andere Geräte bleiben stumm (MDN „Gamepad.mapping“).
 */
import { BELEGUNG_DATEN } from './eingabe.js';

/** Standardzuordnung der Gamepad API: Knopfindex → Name. */
export const PAD_KNOEPFE = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Start', 'L3', 'R3',
  'Hoch', 'Runter', 'Links', 'Rechts', 'Home'] as const;
/** Ab welchem Wert ein analoger Abzug (LT/RT) als gedrückt gilt. */
const ABZUG_SCHWELLE = 0.5;

/**
 * Radiale Totzone mit Neuskalierung: unter `zone` null, darüber linear von 0 bis 1 — sonst springt der
 * Ausschlag an der Kante der Totzone von 0 auf `zone`. Radial statt je Achse, damit Diagonalen nicht
 * einrasten.
 */
export function totzone(x: number, y: number, zone: number): [number, number] {
  const laenge = Math.hypot(x, y);
  if (laenge <= zone || laenge === 0) return [0, 0];
  const neu = Math.min(1, (laenge - zone) / (1 - zone));
  return [x / laenge * neu, y / laenge * neu];
}

/** Gedrückte Knöpfe eines Pads als Codes. */
export function knopfCodes(knoepfe: readonly { pressed: boolean; value: number }[]): Set<string> {
  const aus = new Set<string>();
  knoepfe.forEach((k, i) => {
    const name = PAD_KNOEPFE[i];
    if (!name) return;
    const analog = i === 6 || i === 7;
    if (analog ? k.value >= ABZUG_SCHWELLE : k.pressed) aus.add(`Pad:${name}`);
  });
  return aus;
}

/**
 * Ein Knopf, zwei Aktionen nach Druckdauer (Gattung: B tippen = Rolle, B halten = Rennen). Tippen
 * meldet beim Loslassen, Halten ab der Schwelle — die Rolle kommt also um die Druckdauer später als
 * auf der Tastatur (unter 0,3 s). Gibt die Codes zurück, die jetzt gedrückt/losgelassen werden.
 */
export class Doppelknopf {
  private seit: number | null = null;
  private haelt = false;
  constructor(readonly tippen: string, readonly halten: string, readonly schwelleS: number) {}
  schritt(gedrueckt: boolean, jetztS: number): { runter: string[]; hoch: string[] } {
    const runter: string[] = [], hoch: string[] = [];
    if (gedrueckt && this.seit === null) this.seit = jetztS;
    if (gedrueckt && !this.haelt && this.seit !== null && jetztS - this.seit >= this.schwelleS) {
      this.haelt = true; runter.push(this.halten);
    }
    if (!gedrueckt && this.seit !== null) {
      if (this.haelt) hoch.push(this.halten);
      else { runter.push(this.tippen); hoch.push(this.tippen); }
      this.seit = null; this.haelt = false;
    }
    return { runter, hoch };
  }
}

/**
 * Stickruck für den Zielwechsel (Doc §6.4.1: „rechter Stick rucken“): meldet einmal, wenn der Stick aus
 * der Ruhe über `aus` schlägt, und erst wieder, wenn er unter `ruhe` zurück war.
 */
export function ruck(x: number, bereit: boolean, aus = 0.8, ruhe = 0.3): { richtung: -1 | 0 | 1; bereit: boolean } {
  if (bereit && Math.abs(x) >= aus) return { richtung: x < 0 ? -1 : 1, bereit: false };
  return { richtung: 0, bereit: bereit || Math.abs(x) < ruhe };
}

// ---- Browser-Seite ------------------------------------------------------------------------------

/** Stickstellung nach Totzone, −1…1; y positiv = nach unten gedrückt (Gamepad-API-Richtung). */
export interface PadAchsen { lx: number; ly: number; rx: number; ry: number; verbunden: boolean }
const achsen: PadAchsen = { lx: 0, ly: 0, rx: 0, ry: 0, verbunden: false };
export function padAchsen(): Readonly<PadAchsen> { return achsen; }

export interface PadEinstellung { totzoneLinks: number; totzoneRechts: number }

let eingehaengt = false;
/**
 * Gamepad-Abfrage einhängen (einmal je Seite). Die Schleife je Bild läuft nur, solange ein Pad verbunden
 * ist — der Browser meldet es erst nach dem ersten Knopfdruck (`gamepadconnected`). `einstellung` wird je
 * Bild gelesen, damit eine geänderte Totzone sofort wirkt. `getrennt` meldet, wenn das letzte Pad
 * verschwindet (Doc §8.6: dann Pause).
 */
export function starteGamepad(einstellung: () => PadEinstellung, getrennt?: () => void): void {
  if (eingehaengt || typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.getGamepads) return;
  eingehaengt = true;
  let laeuft = false;
  let vorher = new Set<string>();
  const doppel = BELEGUNG_DATEN.doppel.map(d => ({ knopf: d.knopf, d: new Doppelknopf(d.tippen, d.halten, d.schwelleS) }));
  const doppelKnoepfe = new Set(doppel.map(d => d.knopf));
  let ruckBereit = true;
  const melde = (art: 'keydown' | 'keyup', code: string) =>
    window.dispatchEvent(new KeyboardEvent(art, { code, bubbles: true }));
  window.addEventListener('gamepaddisconnected', () => {
    if (![...navigator.getGamepads()].some(p => p?.connected)) getrennt?.();
  });
  window.addEventListener('gamepadconnected', () => { if (!laeuft) { laeuft = true; requestAnimationFrame(bild); } });
  const bild = () => {
    const pad = [...navigator.getGamepads()].find(p => p?.connected && p.mapping === 'standard') ?? null;
    achsen.verbunden = !!pad;
    const jetzt = new Set<string>();
    if (pad) {
      const e = einstellung();
      [achsen.lx, achsen.ly] = totzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, e.totzoneLinks);
      [achsen.rx, achsen.ry] = totzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0, e.totzoneRechts);
      for (const c of knopfCodes(pad.buttons)) jetzt.add(c);
    } else { achsen.lx = achsen.ly = achsen.rx = achsen.ry = 0; }
    // Doppelknöpfe melden nicht sich selbst, sondern Tippen/Halten.
    const t = performance.now() / 1000;
    for (const { knopf, d } of doppel) {
      const s = d.schritt(jetzt.has(knopf), t);
      for (const c of s.runter) melde('keydown', c);
      for (const c of s.hoch) melde('keyup', c);
    }
    const r = ruck(achsen.rx, ruckBereit);
    ruckBereit = r.bereit;
    if (r.richtung !== 0) {
      const c = r.richtung < 0 ? 'Pad:RS-Links' : 'Pad:RS-Rechts';
      melde('keydown', c); melde('keyup', c);
    }
    for (const c of jetzt) if (!vorher.has(c) && !doppelKnoepfe.has(c)) melde('keydown', c);
    for (const c of vorher) if (!jetzt.has(c) && !doppelKnoepfe.has(c)) melde('keyup', c);
    vorher = jetzt;
    // Ohne Pad und ohne gehaltenen Knopf endet die Schleife; `gamepadconnected` startet sie neu.
    if (pad || jetzt.size > 0) requestAnimationFrame(bild); else laeuft = false;
  };
}
