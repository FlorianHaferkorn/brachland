import type { Color } from 'three';
import { mulberry } from './props.js';

type Punkt = [number, number, number];
type Wandkante = readonly [number, number];
type Wandpunkt = [laenge: number, hoehe: number, abstand: number];
type Dreieck = (a: Punkt, b: Punkt, c: Punkt, farbe: Color) => void;

const DREIECKE_JE_WAND = 1980;
const BLATTFORM: readonly Wandpunkt[] = [
  [0, -0.46, 0], [-0.41, -0.28, 0.03], [-0.28, 0.06, -0.16],
  [0, 0.57, 0.11], [0.33, 0.10, -0.12], [0.43, -0.23, 0.04],
];

/** Kletterefeu in der Fassadengeometrie. Türposition in Metern längs der Wand, Traufe in Weltkoordinaten. */
export function baueHausbewuchs(
  dreieck: Dreieck, start: Wandkante, ende: Wandkante, aussen: Wandkante,
  boden: (x: number, z: number) => number, traufe: number, stufe: 1 | 2,
  saat: number, tuerU: number | null, farben: { blaetter: readonly Color[]; trieb: Color },
): void {
  const dx = ende[0] - start[0], dz = ende[1] - start[1];
  const laenge = Math.hypot(dx, dz);
  if (laenge < 0.9 || farben.blaetter.length === 0) return;
  const tx = dx / laenge, tz = dz / laenge;
  const [nx, nz] = aussen;
  const umlauf = -tz * nx + tx * nz;
  const zufall = mulberry(saat);
  const bodenBei = (u: number) => boden(start[0] + u * tx + nx * 0.09, start[1] + u * tz + nz * 0.09);
  const tuerOberkante = tuerU === null ? 0 : bodenBei(tuerU) + 2.35;
  const welt = ([u, y, v]: Wandpunkt): Punkt => [start[0] + tx * u + nx * v, y, start[1] + tz * u + nz * v];
  const passt = (u: number, y: number, radius: number) =>
    u - radius >= 0.025 && u + radius <= laenge - 0.025 && y + radius <= traufe
    && (tuerU === null || Math.abs(u - tuerU) > 0.85 + radius || y - radius >= tuerOberkante);

  let anzahl = 0;
  const flaeche = (a: Wandpunkt, b: Wandpunkt, c: Wandpunkt, farbe: Color) => {
    const kreuz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (kreuz * umlauf > 0) dreieck(welt(a), welt(b), welt(c), farbe);
    else dreieck(welt(a), welt(c), welt(b), farbe);
    anzahl++;
  };

  const trieb = (a: Wandpunkt, b: Wandpunkt, dicke: number) => {
    const strecke = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (anzahl + 2 > DREIECKE_JE_WAND || strecke < 0.02) return;
    const u = (b[1] - a[1]) * dicke / strecke, y = (a[0] - b[0]) * dicke / strecke;
    const randLinks = Math.min(a[0], b[0]) - Math.abs(u), randRechts = Math.max(a[0], b[0]) + Math.abs(u);
    if (randLinks < 0.025 || randRechts > laenge - 0.025 || Math.max(a[1], b[1]) + Math.abs(y) > traufe) return;
    if (tuerU !== null && randLinks < tuerU + 0.85 && randRechts > tuerU - 0.85
      && Math.min(a[1], b[1]) - Math.abs(y) < tuerOberkante) return;
    const links: Wandpunkt = [a[0] - u, a[1] - y, a[2]];
    const rechts: Wandpunkt = [a[0] + u, a[1] + y, a[2]];
    const spitzeLinks: Wandpunkt = [b[0] - u * 0.52, b[1] - y * 0.52, b[2]];
    const spitzeRechts: Wandpunkt = [b[0] + u * 0.52, b[1] + y * 0.52, b[2]];
    flaeche(links, rechts, spitzeRechts, farben.trieb);
    flaeche(links, spitzeRechts, spitzeLinks, farben.trieb);
  };

  const blatt = (u: number, y: number, tiefe: number, laengeBlatt: number, winkel: number, ton: number) => {
    const einfach = stufe === 2 && ton % 3 !== 0;
    if (anzahl + (einfach ? 2 : BLATTFORM.length) > DREIECKE_JE_WAND || !passt(u, y, laengeBlatt * 0.59)) return;
    const sin = Math.sin(winkel), cos = Math.cos(winkel);
    const randpunkt = ([q, h, v]: Wandpunkt): Wandpunkt => [
      u + (q * cos + h * sin) * laengeBlatt,
      y + (-q * sin + h * cos) * laengeBlatt,
      tiefe + v * laengeBlatt,
    ];
    const farbe = farben.blaetter[ton];
    if (einfach) {
      const fuss = randpunkt(BLATTFORM[0]), links = randpunkt(BLATTFORM[1]);
      const spitze = randpunkt(BLATTFORM[3]), rechts = randpunkt(BLATTFORM[5]);
      flaeche(fuss, links, spitze, farbe);
      flaeche(fuss, spitze, rechts, farbe);
      return;
    }
    const rand = BLATTFORM.map(randpunkt);
    const mitte: Wandpunkt = [u, y, tiefe + laengeBlatt * 0.18];
    for (let i = 0; i < rand.length; i++) flaeche(mitte, rand[i], rand[(i + 1) % rand.length], farbe);
  };

  const polster = (punkt: Wandpunkt, richtung: number, dichte: number, breite: number) => {
    const palette = farben.blaetter.length;
    const ton = Math.floor(zufall() * palette);
    for (let i = 0; i < dichte; i++) {
      const winkel = zufall() * 2 * Math.PI;
      // Das Zentrum bleibt dicht; Finger aus jüngeren Blättern bilden einen löchrigen Saum.
      const radius = breite * Math.pow(zufall(), 1.2);
      const u = punkt[0] + Math.cos(winkel) * radius;
      const y = punkt[1] + Math.sin(winkel) * radius * 0.78;
      const tiefe = Math.max(0.095, Math.min(0.30, punkt[2] + (zufall() - 0.22) * 0.13));
      const groesse = stufe === 2 ? 0.15 + zufall() * 0.14 : 0.105 + zufall() * 0.11;
      const blattTon = zufall() < 0.78 ? ton : Math.floor(zufall() * palette);
      blatt(u, y, tiefe, groesse, richtung * 0.7 + (zufall() - 0.5) * 3.6, blattTon);
    }
  };

  const wurzeln = stufe === 2 ? Math.max(2, Math.min(4, Math.ceil(laenge / 4.2))) : Math.min(2, Math.ceil(laenge / 8));
  // Die Züge belegen unterschiedliche Felder der Fassade, auch auf kurzen Nebengebäuden.
  for (let wurzel = 0; wurzel < wurzeln; wurzel++) {
    const mitte = laenge * (wurzel + 0.5) / wurzeln;
    let u = mitte + (zufall() - 0.5) * laenge / wurzeln * 0.48;
    if (tuerU !== null && Math.abs(u - tuerU) < 1.0) u = tuerU + (u < tuerU ? -1.07 : 1.07);
    if (u < 0.16 || u > laenge - 0.16) continue;
    const y0 = bodenBei(u) - 0.025;
    const waechstHoch = stufe === 2 && (wurzel === 0 || zufall() > 0.34);
    const y1 = waechstHoch
      ? traufe - 0.14 - zufall() * 0.32
      : Math.min(traufe - 0.18, y0 + 1.25 + zufall() * (stufe === 2 ? 3.2 : 2.4));
    if (y1 - y0 < 0.55) continue;

    const drift = (zufall() - 0.5) * Math.min(2.6, laenge * 0.19);
    const schwung = zufall() * Math.PI * 2;
    const abschnitte = Math.max(3, Math.min(stufe === 2 ? 16 : 8, Math.ceil((y1 - y0) / 0.38)));
    const dichte = stufe === 2 ? Math.floor(19 / wurzeln) : 6;
    let unten: Wandpunkt = [u, y0, 0.018];
    for (let i = 1; i <= abschnitte; i++) {
      const t = i / abschnitte;
      const y = y0 + (y1 - y0) * t;
      const schlenker = Math.sin(schwung + t * 6.4) - Math.sin(schwung);
      let obenU = u + drift * t + schlenker * Math.min(0.46, laenge * 0.06);
      if (tuerU !== null && y < tuerOberkante + 0.1 && Math.abs(obenU - tuerU) < 0.97) {
        obenU = tuerU + (u < tuerU ? -0.97 : 0.97);
      }
      const oben: Wandpunkt = [Math.max(0.14, Math.min(laenge - 0.14, obenU)), y, 0.028 + 0.04 * t];
      trieb(unten, oben, (stufe === 2 ? 0.042 : 0.028) * (1 - t * 0.82));

      const seite = (i + wurzel) % 2 === 0 ? 1 : -1;
      const finger = (0.26 + zufall() ** 1.5 * (stufe === 2 ? 1.27 : 0.43)) * seite;
      const hoehensprung = (zufall() - 0.18) * 0.38;
      const seitentrieb: Wandpunkt = [oben[0] + finger, oben[1] + hoehensprung, 0.09 + zufall() * 0.09];
      trieb(oben, seitentrieb, 0.009);
      // Ein Knoten liegt vorn am Seitentrieb, ein zweiter am Haupttrieb hinter dem ersten.
      polster(seitentrieb, seite, dichte, 0.19 + zufall() * (stufe === 2 ? 0.52 : 0.27));
      polster([oben[0] + finger * 0.26, oben[1] - 0.13, 0.09], -seite, Math.ceil(dichte * 0.67),
        0.2 + zufall() * (stufe === 2 ? 0.42 : 0.17));
      unten = oben;
    }
  }
}
