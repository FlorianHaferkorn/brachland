/** D316: Gebrochener Dachbalken im bestehenden Hauspuffer. */
import { Color, Vector3 } from 'three';
import { mulberry } from './props.js';

type Punkt = [number, number, number];
type Dreieck = (a: Punkt, b: Punkt, c: Punkt, farbe: Color) => void;

// Vier abgegriffene Kanten und je eine flache Längsfuge auf den breiten Seiten.
const PROFIL = [
  [-.5, -.36], [-.39, -.5], [-.14, -.5], [-.07, -.46], [.39, -.5], [.5, -.36],
  [.5, .36], [.39, .5], [.14, .5], [.07, .46], [-.39, .5], [-.5, .36],
] as const;
const MANTEL = ['#79644f', '#6d5b49', '#524437', '#756452', '#665747'].map(ton => new Color(ton));
const BRUCH = ['#9e835f', '#ac916b', '#8b704e', '#796247'].map(ton => new Color(ton));
const ALT = ['#5b5349', '#665d50', '#443d34', '#716657', '#4f483b'].map(ton => new Color(ton));
const ALTBRUCH = ['#958468', '#a09579', '#6d6251', '#7a6e55'].map(ton => new Color(ton));

/** Fuß und Kopf geben die Mittelpunkte der Endquerschnitte vor, Maße in Metern. */
export function baueBruchholz(
  dreieck: Dreieck, fuss: readonly [number, number, number], kopf: readonly [number, number, number],
  breite: number, dicke: number, saat: number, verwittert = false,
): void {
  const anfang = new Vector3(...fuss);
  const achse = new Vector3(...kopf).sub(anfang);
  const laenge = achse.length();
  if (![laenge, breite, dicke].every(wert => Number.isFinite(wert) && wert > .001)) return;
  achse.divideScalar(laenge);
  const quer = new Vector3(Math.abs(achse.y) < .97 ? 0 : 1, Math.abs(achse.y) < .97 ? 1 : 0, 0)
    .cross(achse).normalize();
  const hoch = new Vector3().crossVectors(achse, quer);
  const welt = (entlang: number, seitlich: number, hoehe: number): Punkt => anfang.clone()
    .addScaledVector(achse, entlang).addScaledVector(quer, seitlich).addScaledVector(hoch, hoehe).toArray();

  const zufall = mulberry(saat);
  const splitter = Math.min(laenge * .27, Math.max(breite, dicke) * (verwittert ? 2.04 : 1.46));
  const fussspitze = Math.floor(zufall() * PROFIL.length);
  const kopfspitze = Math.floor(zufall() * PROFIL.length);
  const vorn = PROFIL.map(([q, h], i) => welt(
    i === fussspitze ? 0 : splitter * (.03 + zufall() * .31), q * breite, h * dicke));
  const riss = PROFIL.map(([q, h], i) => welt(
    i === kopfspitze ? laenge : laenge - splitter * (.10 + zufall() * .68), q * breite * .93, h * dicke * .96));
  const schulter = PROFIL.map(([q, h]) => welt(laenge - splitter, q * breite, h * dicke));
  const stirnFuss = welt(splitter * .44, 0, 0);
  const stirnKopf = welt(laenge - splitter * .86, 0, 0);
  const mantel = verwittert ? ALT : MANTEL;
  const bruch = verwittert ? ALTBRUCH : BRUCH;

  for (let i = 0; i < PROFIL.length; i++) {
    const j = (i + 1) % PROFIL.length;
    const ton = mantel[i === 2 || i === 8 ? 2 : (i + 3) % mantel.length];
    dreieck(vorn[i], vorn[j], schulter[j], ton);
    dreieck(vorn[i], schulter[j], schulter[i], ton);
    dreieck(schulter[i], schulter[j], riss[j], ton);
    dreieck(schulter[i], riss[j], riss[i], ton);
    dreieck(stirnFuss, vorn[j], vorn[i], bruch[Math.floor(zufall() * bruch.length)]);
    dreieck(stirnKopf, riss[i], riss[j], bruch[Math.floor(zufall() * bruch.length)]);
  }
}
