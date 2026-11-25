/**
 * BRACHLAND — Inertialisierung von Übergängen (D457), rein, ohne three.js.
 *
 * **Quelle:** David Bollo, „Inertialization: High-Performance Animation Transitions in ‚Gears of War‘“,
 * GDC 2018 (gdcvault.com/play/1025165), Vorläufer „High Performance Animation in Gears of War 4“,
 * SIGGRAPH 2017 Talks. Kern des Vortrags: Blenden zwischen zwei Clips entfällt; beim Wechsel spielt sofort nur
 * der Zielclip, und der **Versatz** zwischen der zuletzt gezeigten Pose und dem Ziel klingt als Nachbearbeitung
 * ab — mit einer Kurve, die die Geschwindigkeit der alten Bewegung mitnimmt. Für Drehungen wird der Versatz
 * als Achse und Winkel gefasst (die Achse bleibt, der Winkel klingt ab), für Lagen als Richtung und Betrag.
 *
 * **Die Kurve** ist ein Polynom fünften Grades x(t) mit x(0) = x0, x′(0) = v0, x″(0) = a0 und
 * x(t1) = x′(t1) = x″(t1) = 0; a0 wird so gewählt, dass auch der Ruck am Ende null ist, und nicht kleiner als 0. Die Koeffizienten
 * folgen aus diesen Bedingungen (der Vortrag war von hier aus nur als Zusammenfassung abrufbar, die Formeln
 * sind nicht gegen die Folien gelesen); `tests/figurlaufzeit.test.ts` prüft jede Bedingung nach. Zwei
 * Sicherungen gegen Überschwingen: Läuft der Versatz vom Ziel weg (v0 > 0), zählt v0 = 0; läuft er schneller
 * aufs Ziel zu, als die Dauer hergibt, wird die Dauer auf −5·x0/v0 gekürzt.
 *
 * Posen sind flache Felder: je Knochen vier Zahlen (x, y, z, w) im Elternraum, für Lagen drei.
 */

/** Eine Abklingkurve: Betrag ≥ 0 über die Zeit seit dem Wechsel. */
export interface Kurve { x0: number; v0: number; a0: number; A: number; B: number; C: number; t1: number }

/** Kurve aus Betrag `x0` (≥ 0), Geschwindigkeit des Betrags `v0` und gewünschter Dauer. */
export function abklingKurve(x0: number, v0: number, dauer: number, aus?: Kurve): Kurve {
  const k = aus ?? { x0: 0, v0: 0, a0: 0, A: 0, B: 0, C: 0, t1: 0 };
  if (!(x0 > 1e-9)) { k.x0 = 0; k.v0 = 0; k.a0 = 0; k.A = 0; k.B = 0; k.C = 0; k.t1 = 0; return k; }
  let t1 = Math.max(1e-4, dauer);
  const v = Math.min(0, v0);
  if (v < 0) t1 = Math.min(t1, (-5 * x0) / v);
  const t2 = t1 * t1;
  // a0 aus „Ruck am Ende null“; negativ hiesse: schon im ersten Bild aufs Ziel zu beschleunigen (Knick in der
  // Beschleunigung) — dann lieber 0, die Kurve beginnt weich.
  const a0 = Math.max(0, (-8 * v * t1 - 20 * x0) / t2);
  k.x0 = x0; k.v0 = v; k.a0 = a0; k.t1 = t1;
  k.A = -(a0 * t2 + 6 * v * t1 + 12 * x0) / (2 * t2 * t2 * t1);
  k.B = (3 * a0 * t2 + 16 * v * t1 + 30 * x0) / (2 * t2 * t2);
  k.C = -(3 * a0 * t2 + 12 * v * t1 + 20 * x0) / (2 * t2 * t1);
  return k;
}

/** Betrag zur Zeit `t` seit dem Wechsel; nach `t1` null. */
export function abklingWert(k: Kurve, t: number): number {
  if (t >= k.t1 || k.t1 <= 0) return 0;
  if (t <= 0) return k.x0;
  return ((((k.A * t + k.B) * t + k.C) * t + 0.5 * k.a0) * t + k.v0) * t + k.x0;
}

/** Ableitung des Betrags (für Tests). */
export function abklingTempo(k: Kurve, t: number): number {
  if (t >= k.t1 || k.t1 <= 0) return 0;
  return (((5 * k.A * t + 4 * k.B) * t + 3 * k.C) * t + k.a0) * t + k.v0;
}

/** Zustand für `n` Knochen. Alles vorab angelegt — im Bild wird nichts erzeugt. */
export interface Traegheit {
  n: number;
  /** Drehachse je Knochen (3n) und die sieben Kurvenwerte je Knochen. */
  achse: Float32Array;
  kurve: Float64Array;
  /** Richtung des Lageversatzes je Knochen (3n) und seine Kurve. */
  richtung: Float32Array;
  lagekurve: Float64Array;
  /** Sekunden seit dem Wechsel und längste Dauer aller Kurven; `laeuft` false heisst: nichts zu tun. */
  zeit: number;
  ende: number;
  laeuft: boolean;
}

const JE = 7;

export function neueTraegheit(n: number): Traegheit {
  return {
    n, achse: new Float32Array(3 * n), kurve: new Float64Array(JE * n),
    richtung: new Float32Array(3 * n), lagekurve: new Float64Array(JE * n), zeit: 0, ende: 0, laeuft: false,
  };
}

const tmp: Kurve = { x0: 0, v0: 0, a0: 0, A: 0, B: 0, C: 0, t1: 0 };
function schreibe(feld: Float64Array, i: number, x0: number, v0: number, dauer: number): number {
  const k = abklingKurve(x0, v0, dauer, tmp), o = i * JE;
  feld[o] = k.x0; feld[o + 1] = k.v0; feld[o + 2] = k.a0; feld[o + 3] = k.A; feld[o + 4] = k.B; feld[o + 5] = k.C; feld[o + 6] = k.t1;
  return k.t1;
}
function lies(feld: Float64Array, i: number, t: number): number {
  const o = i * JE, t1 = feld[o + 6];
  if (t >= t1 || t1 <= 0) return 0;
  return ((((feld[o + 3] * t + feld[o + 4]) * t + feld[o + 5]) * t + 0.5 * feld[o + 2]) * t + feld[o + 1]) * t + feld[o];
}

type Zahlen = ArrayLike<number>;

/**
 * Wechsel beginnen. `vorher` ist die zuletzt gezeigte Pose, `davor` die ein Bild früher (`dt` Sekunden
 * dazwischen; ohne brauchbares `dt` gilt Geschwindigkeit 0), `ziel` die erste Pose des neuen Clips.
 * Lagen (`lv`, `ld`, `lz`, je 3n) sind freiwillig. Ein Wechsel mitten im Abklingen ist erlaubt: `vorher`
 * und `davor` sind dann schon die abklingenden Posen, der neue Versatz nimmt deren Bewegung mit.
 */
export function starteUebergang(
  z: Traegheit, vorher: Zahlen, davor: Zahlen, ziel: Zahlen, dt: number, dauer: number,
  lv?: Zahlen, ld?: Zahlen, lz?: Zahlen,
): void {
  const mitTempo = dt > 1e-4;
  let ende = 0;
  for (let i = 0; i < z.n; i++) {
    const o = i * 4, p = i * 3;
    // Versatz q = vorher ⊗ ziel⁻¹ (ziel⁻¹ = Konjugierte), so dass q ⊗ ziel = vorher.
    const ax = vorher[o], ay = vorher[o + 1], az = vorher[o + 2], aw = vorher[o + 3];
    const bx = -ziel[o], by = -ziel[o + 1], bz = -ziel[o + 2], bw = ziel[o + 3];
    let qx = aw * bx + ax * bw + ay * bz - az * by;
    let qy = aw * by - ax * bz + ay * bw + az * bx;
    let qz = aw * bz + ax * by - ay * bx + az * bw;
    let qw = aw * bw - ax * bx - ay * by - az * bz;
    if (qw < 0) { qx = -qx; qy = -qy; qz = -qz; qw = -qw; }
    const sn = Math.hypot(qx, qy, qz);
    if (sn < 1e-6) { z.achse[p] = 1; z.achse[p + 1] = 0; z.achse[p + 2] = 0; schreibe(z.kurve, i, 0, 0, dauer); }
    else {
      const ux = qx / sn, uy = qy / sn, uz = qz / sn;
      z.achse[p] = ux; z.achse[p + 1] = uy; z.achse[p + 2] = uz;
      const x0 = 2 * Math.atan2(sn, qw);
      let v0 = 0;
      if (mitTempo) {
        // Derselbe Versatz ein Bild früher, als Verdrehung um dieselbe Achse.
        const cx = davor[o], cy = davor[o + 1], cz = davor[o + 2], cw = davor[o + 3];
        const rx = cw * bx + cx * bw + cy * bz - cz * by;
        const ry = cw * by - cx * bz + cy * bw + cz * bx;
        const rz = cw * bz + cx * by - cy * bx + cz * bw;
        const rw = cw * bw - cx * bx - cy * by - cz * bz;
        let x1 = 2 * Math.atan2(rx * ux + ry * uy + rz * uz, rw);
        if (x1 > Math.PI) x1 -= 2 * Math.PI; else if (x1 < -Math.PI) x1 += 2 * Math.PI;
        v0 = (x0 - x1) / dt;
      }
      ende = Math.max(ende, schreibe(z.kurve, i, x0, v0, dauer));
    }
    if (lv && lz) {
      const dx = lv[p] - lz[p], dy = lv[p + 1] - lz[p + 1], dz = lv[p + 2] - lz[p + 2];
      const l = Math.hypot(dx, dy, dz);
      if (l < 1e-7) { z.richtung[p] = 0; z.richtung[p + 1] = 0; z.richtung[p + 2] = 0; schreibe(z.lagekurve, i, 0, 0, dauer); }
      else {
        const ux = dx / l, uy = dy / l, uz = dz / l;
        z.richtung[p] = ux; z.richtung[p + 1] = uy; z.richtung[p + 2] = uz;
        let v0 = 0;
        if (mitTempo && ld) v0 = (l - ((ld[p] - lz[p]) * ux + (ld[p + 1] - lz[p + 1]) * uy + (ld[p + 2] - lz[p + 2]) * uz)) / dt;
        ende = Math.max(ende, schreibe(z.lagekurve, i, l, v0, dauer));
      }
    } else schreibe(z.lagekurve, i, 0, 0, dauer);
  }
  z.zeit = 0; z.ende = ende; z.laeuft = ende > 0;
}

/**
 * D461: Den Versatz eines Knochens streichen — er wechselt **hart**. Für Knochen, deren Sprung im Raum des
 * Elternknochens gewollt ist und in der Welt keiner: Beim Wenden im Stand dreht die Figurgruppe um 90°, der Clip
 * beginnt um 90° zurückgedreht; die Wurzel springt im eigenen Raum, das Bild steht.
 */
export function loescheVersatz(z: Traegheit, i: number): void {
  z.kurve.fill(0, i * JE, (i + 1) * JE);
  z.lagekurve.fill(0, i * JE, (i + 1) * JE);
}

/**
 * Den abklingenden Versatz auf die Pose des Zielclips legen (an Ort und Stelle). `dt` rückt die Uhr vor.
 * Gibt zurück, ob noch etwas abklingt.
 */
export function wendeAn(z: Traegheit, pose: { [i: number]: number }, dt: number, lage?: { [i: number]: number }): boolean {
  if (!z.laeuft) return false;
  z.zeit += Math.max(0, dt);
  const t = z.zeit;
  if (t >= z.ende) { z.laeuft = false; return false; }
  for (let i = 0; i < z.n; i++) {
    const w = lies(z.kurve, i, t), p = i * 3;
    if (w > 1e-6) {
      const h = w * 0.5, s = Math.sin(h), qw = Math.cos(h);
      const qx = z.achse[p] * s, qy = z.achse[p + 1] * s, qz = z.achse[p + 2] * s;
      const o = i * 4, bx = pose[o], by = pose[o + 1], bz = pose[o + 2], bw = pose[o + 3];
      pose[o] = qw * bx + qx * bw + qy * bz - qz * by;
      pose[o + 1] = qw * by - qx * bz + qy * bw + qz * bx;
      pose[o + 2] = qw * bz + qx * by - qy * bx + qz * bw;
      pose[o + 3] = qw * bw - qx * bx - qy * by - qz * bz;
    }
    if (lage) {
      const l = lies(z.lagekurve, i, t);
      if (l > 1e-7) { lage[p] += z.richtung[p] * l; lage[p + 1] += z.richtung[p + 1] * l; lage[p + 2] += z.richtung[p + 2] * l; }
    }
  }
  return true;
}
