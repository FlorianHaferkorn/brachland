/**
 * BRACHLAND — Federn für die Laufzeit der Bewegung (D457), rein, ohne three.js.
 *
 * Zwei geschlossene Lösungen, beide unabhängig von der Bildrate (kein Euler-Schritt, der bei 20 Bildern/s
 * aufschwingt):
 *
 * - `federSchritt`: **kritisch gedämpft** — folgt einem Ziel ohne Überschwingen, parametriert über die
 *   Halbwertszeit. Für Neigen, Drehkette, Blick.
 * - `schwingSchritt`: **unterkritisch** — ein Ruck, der ausschwingt (Treffer; später Kapuze, Zopf, Tasche,
 *   sobald ein Rig Knochen dafür hat).
 *
 * Zustand ist ein Paar (Lage, Geschwindigkeit); die Funktionen schreiben in dasselbe Objekt zurück.
 */
export interface Feder { x: number; v: number }

export const neueFeder = (x = 0): Feder => ({ x, v: 0 });

/** Kritisch gedämpft zum Ziel. `halbwert` in Sekunden (Hüllkurve e^(−y·t) halbiert sich); 0 heisst sofort. */
export function federSchritt(f: Feder, ziel: number, halbwert: number, dt: number): number {
  if (!(halbwert > 1e-5)) { f.v = 0; f.x = ziel; return ziel; }
  if (!(dt > 0)) return f.x;
  const y = (2 * Math.LN2) / halbwert;
  const j0 = f.x - ziel, j1 = f.v + j0 * y, e = Math.exp(-y * dt);
  f.x = e * (j0 + j1 * dt) + ziel;
  f.v = e * (f.v - j1 * y * dt);
  return f.x;
}

/**
 * Gedämpfte Schwingung um 0. `frequenz` in Hz (ungedämpft), `daempfung` 0…1 (1 = kritisch).
 * Ein Stoss ist `f.v += …` vor dem Schritt.
 */
export function schwingSchritt(f: Feder, frequenz: number, daempfung: number, dt: number): number {
  if (!(dt > 0)) return f.x;
  const w0 = 2 * Math.PI * frequenz, z = Math.min(0.999, Math.max(0, daempfung));
  const wd = w0 * Math.sqrt(1 - z * z), e = Math.exp(-z * w0 * dt);
  const c = Math.cos(wd * dt), s = Math.sin(wd * dt);
  const a = f.x, b = (f.v + z * w0 * f.x) / wd;
  const x = e * (a * c + b * s);
  const v = e * ((b * wd - z * w0 * a) * c - (a * wd + z * w0 * b) * s);
  f.x = x; f.v = v;
  return x;
}

/** Winkel auf (−π, π] falten. */
export function falte(w: number): number {
  let a = w % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

export const klemme = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));
