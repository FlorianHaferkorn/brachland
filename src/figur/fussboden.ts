/**
 * BRACHLAND — Fuss am Boden (D457), die Geometrie dazu, rein, ohne three.js.
 *
 * D214 (`src/spieler/fussik.ts`) setzt die Füsse auf die Geländehöhe und senkt das Becken. Was fehlte:
 *
 * 1. **Neigung:** Der Fuss stand am Hang waagerecht — Ferse oder Spitze in der Luft. `bodenNormale` gibt die
 *    Flächennormale unter dem Fuss, `begrenzeNormale` klemmt sie (ein Sprunggelenk kippt nicht beliebig).
 * 2. **Standfuss:** Steht ein Fuss laut Clip (tief über seinem Boden), bleibt er in der Welt, wo er aufsetzte,
 *    auch wenn sich der Körper darüber dreht oder der Clip nicht genau zum Tempo passt. Rutscht er weiter als
 *    `haltMax`, lässt er los und der Versatz klingt ab — ein Bein wird nie überstreckt, um einen Fuss zu halten.
 * 3. **Zwei-Gelenk-Geometrie** (`zweiGelenk`) als geprüfte Formel: Kosinussatz, wie `zweiKnochen` in `fussik.ts`.
 *
 * Ein Bein ist ein Bein: Die Funktionen wissen nichts von links und rechts und gelten für vier genauso.
 */

export interface Standfuss {
  fest: boolean;
  /** Wo der Fuss in der Welt hält (x, z). */
  hx: number; hz: number;
  /** Versatz, der auf die Fusslage des Clips gelegt wird (Welt, m). */
  ox: number; oz: number;
}

export const neuerStandfuss = (): Standfuss => ({ fest: false, hx: 0, hz: 0, ox: 0, oz: 0 });

export interface FussWerte { standHoehe: number; haltMax: number; loesen: number }

/**
 * Einen Fuss führen. `fx`, `fz`: Lage des Fusses laut Clip in der Welt; `hub`: seine Höhe über dem Boden laut
 * Clip (über ebenem Grund); `erlaubt` false löst sofort (Luft, Rolle, Sattel). Schreibt `ox`, `oz`.
 */
export function fuehreStandfuss(s: Standfuss, fx: number, fz: number, hub: number, dt: number, w: FussWerte, erlaubt = true): void {
  const steht = erlaubt && hub < w.standHoehe;
  if (s.fest) {
    const dx = s.hx - fx, dz = s.hz - fz;
    if (!steht || Math.hypot(dx, dz) > w.haltMax) s.fest = false;
    else { s.ox = dx; s.oz = dz; return; }
  }
  // Gelöst: Versatz klingt e-fach ab. Neu fassen erst, wenn er fast weg ist — sonst hielte der Fuss an der
  // Stelle fest, von der er gerade losgelassen hat, und spränge.
  const k = dt > 0 ? Math.exp(-dt / Math.max(1e-3, w.loesen)) : 1;
  s.ox *= k; s.oz *= k;
  if (steht && Math.hypot(s.ox, s.oz) < 0.01) {
    s.fest = true; s.hx = fx + s.ox; s.hz = fz + s.oz;
  }
}

/** Flächennormale des Geländes bei (x, z) aus vier Höhen im Abstand `weite` (Einheitsvektor, y > 0). */
export function bodenNormale(hoeheAn: (x: number, z: number) => number, x: number, z: number, weite = 0.12): [number, number, number] {
  const dx = (hoeheAn(x + weite, z) - hoeheAn(x - weite, z)) / (2 * weite);
  const dz = (hoeheAn(x, z + weite) - hoeheAn(x, z - weite)) / (2 * weite);
  const l = Math.hypot(dx, 1, dz);
  return [-dx / l, 1 / l, -dz / l];
}

/** Normale so weit zur Senkrechten zurückdrehen, dass sie höchstens `maxRad` kippt. */
export function begrenzeNormale(n: readonly [number, number, number], maxRad: number): [number, number, number] {
  const kipp = Math.acos(Math.max(-1, Math.min(1, n[1])));
  if (kipp <= maxRad) return [n[0], n[1], n[2]];
  const quer = Math.hypot(n[0], n[2]) || 1, s = Math.sin(maxRad) / quer;
  return [n[0] * s, Math.cos(maxRad), n[2] * s];
}

/** Um wie viel das Becken sinkt: der tiefste Fussversatz, nur abwärts, höchstens `max` (m, ≤ 0). */
export function beckenSenkung(versaetze: readonly number[], max: number): number {
  let tief = 0;
  for (const v of versaetze) if (v < tief) tief = v;
  return Math.max(-max, tief);
}

/**
 * Zwei-Gelenk-Kette (Hüfte–Knie–Fuss) auf einen Abstand Hüfte → Ziel: Innenwinkel am Knie und Winkel an der
 * Hüfte zwischen Oberschenkel und der Linie zum Ziel. Liegt das Ziel ausser Reichweite, streckt sich das Bein
 * (und erreicht es nicht) — `erreicht` sagt es.
 */
export function zweiGelenk(lOber: number, lUnter: number, abstand: number): { knie: number; huefte: number; erreicht: boolean } {
  const max = lOber + lUnter, min = Math.abs(lOber - lUnter);
  const d = Math.max(min + 1e-6, Math.min(max - 1e-6, abstand));
  const cosKnie = (lOber * lOber + lUnter * lUnter - d * d) / (2 * lOber * lUnter);
  const cosHuefte = (lOber * lOber + d * d - lUnter * lUnter) / (2 * lOber * d);
  return {
    knie: Math.acos(Math.max(-1, Math.min(1, cosKnie))),
    huefte: Math.acos(Math.max(-1, Math.min(1, cosHuefte))),
    erreicht: abstand <= max && abstand >= min,
  };
}
