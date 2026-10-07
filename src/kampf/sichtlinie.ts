/**
 * D192: Sichtlinie bei Zielaufschaltung — rein, ohne three.js, damit sie testbar bleibt.
 *
 * Die Kamera zog bisher nur ein, wenn zwischen ihr und der **Figur** etwas stand (`Kamera` in
 * `RegionsSzene.tsx`). Bei Aufschaltung fehlten zwei Fälle: Der Schulterversatz (0,85 m zur Seite)
 * schob die Kamera nach der Prüfung in einen Stamm, und zwischen Kamera und **Ziel** wurde gar nicht
 * geprüft — ein Baum zwischen beiden verdeckte den Gegner, den man gerade lesen soll.
 *
 * Geprüft wird gegen dieselbe Frage wie bisher (`versperrt`: Kollisionsfeld + Gelände), nicht per
 * Raycast gegen die Szene — bei 155.000 Props je Bild unbezahlbar, das Rasterfeld antwortet in
 * konstanter Zeit.
 */
export type Punkt = readonly [number, number, number];
export type Versperrt = (x: number, y: number, z: number) => boolean;

/**
 * Probenabstand in Metern. Fest je Meter, nicht fest je Strecke: Zwölf Proben auf zehn Meter liegen
 * 0,8 m auseinander und springen über einen Stamm (Radius 0,55–0,65 m) — im ersten Testlauf passiert.
 */
export const PROBE_ABSTAND = 0.3;

/**
 * Ist die Strecke a → b frei? Proben alle `PROBE_ABSTAND` m, a selbst nicht. `randB` Meter vor b
 * werden nicht geprüft — das Ziel steht oft dicht an einem Stamm, und der Stamm *neben* ihm
 * verdeckt es nicht.
 */
export function sichtFrei(a: Punkt, b: Punkt, versperrt: Versperrt, randB = 0): boolean {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const laenge = Math.hypot(dx, dy, dz);
  if (laenge < 1e-6) return !versperrt(a[0], a[1], a[2]);
  const bis = Math.max(0, 1 - randB / laenge);
  const proben = Math.max(1, Math.ceil((laenge * bis) / PROBE_ABSTAND));
  for (let i = 1; i <= proben; i++) {
    const t = (bis * i) / proben;
    if (versperrt(a[0] + dx * t, a[1] + dy * t, a[2] + dz * t)) return false;
  }
  return true;
}

/** Abstand, unter dem das Ziel nicht mehr auf Sicht geprüft wird (seine eigene Kapsel und Nachbarn). */
export const ZIEL_RAND = 0.8;

/**
 * Längster Kameraarm in [min, max], bei dem die Schulterkamera frei steht und Figur **und** Ziel
 * sieht. Kamera = blick + richtung·r + versatz. Gesucht wird von aussen nach innen in `schritte`
 * Stufen; findet sich nichts, gilt `min` (dann sieht man wenigstens die Figur von nah).
 */
export function armMitSicht(o: {
  blick: Punkt; richtung: Punkt; versatz: Punkt; ziel: Punkt | null;
  min: number; max: number; versperrt: Versperrt; schritte?: number;
}): number {
  const n = o.schritte ?? 8;
  if (o.max <= o.min) return o.min;
  for (let i = 0; i <= n; i++) {
    const r = o.max - ((o.max - o.min) * i) / n;
    const k: Punkt = [
      o.blick[0] + o.richtung[0] * r + o.versatz[0],
      o.blick[1] + o.richtung[1] * r + o.versatz[1],
      o.blick[2] + o.richtung[2] * r + o.versatz[2],
    ];
    if (o.versperrt(k[0], k[1], k[2])) continue;
    if (!sichtFrei(o.blick, k, o.versperrt)) continue;
    if (o.ziel && !sichtFrei(k, o.ziel, o.versperrt, ZIEL_RAND)) continue;
    return r;
  }
  return o.min;
}
