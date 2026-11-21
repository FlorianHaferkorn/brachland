import { CatmullRomCurve3, Color, Vector3 } from 'three';
import { mulberry } from './props.js';
import { EFEUKARTEN_AN, HOF_ORTSALTERUNG_AN, HOF_VERFALLVERLAUF_AN, HOF_ZIELTREUE_AN } from './echt.js';
import { meldeEfeuKarte } from './efeukarten.js';
import { wachseEfeu, type Oeffnung } from './efeuwuchs.js';
import massstab from '../../content/massstab.json';

/**
 * D353: Efeublätter in echter Grösse. Bis D352 waren die Blattgrössen je Bauer von Hand gesetzt und lagen
 * im Median bei 17–31 cm, einzeln bis 49 cm (`npm run massstab`); echter Efeu hat 4–12 cm. Die Länge kommt
 * jetzt aus `content/massstab.json`, die Form wird auf diese Länge skaliert.
 */
const EFEU = massstab.referenzen.find(r => r.id === 'efeublatt')!;
/** Kleinere Blätter brauchen mehr Blätter je Büschel, sonst zerfällt die Deckung in Punkte. */
/** D358: Mit Efeukarten trägt die Karte die Masse; Einzelblätter bleiben für Rand und Silhouette. */
const EFEU_DICHTE = EFEUKARTEN_AN ? 2 : 5;
/** Die verholzte Efeukrone (Haus 308) ist schon dicht; mehr sprengt das Hausbudget aus D318. */
const EFEU_DICHTE_KRONE = EFEUKARTEN_AN ? 2 : 3;
/** D354: Wölbung der Efeupolster in Metern je Stufe (1, 2, dicht). */
const EFEU_KUPPEL: Record<number, number> = { 1: .14, 2: .20, 3: .26 };

/** Blattlänge in Metern. `jung` 0…1 verkleinert Triebspitzen und Ränder; Median ≈ `EFEU.ziel` bei `jung` = 1. */
function efeuLaenge(zufall: () => number, jung = 1): number {
  const t = zufall() ** 1.6 * (.55 + .45 * Math.max(0, Math.min(1, jung)));
  return EFEU.min + (EFEU.max - EFEU.min) * t;
}

/** Grösste Ausdehnung einer Blattform in Formeinheiten — Länge eines Blatts der Grösse 1. */
function spanne(form: readonly (readonly [number, number, number])[]): number {
  let groesste = 0;
  for (const a of form) for (const b of form) groesste = Math.max(groesste, Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]));
  return groesste;
}

type Punkt = [number, number, number];
type Wandkante = readonly [number, number];
type Wandpunkt = [laenge: number, hoehe: number, abstand: number];
export type BlattKoordinaten = readonly [readonly [number, number], readonly [number, number], readonly [number, number]];
type Dreieck = (a: Punkt, b: Punkt, c: Punkt, farbe: Color, blatt?: BlattKoordinaten) => void;
type Rankenfarben = { blaetter: readonly Color[]; trieb: Color };
export type Rankenpunkt = { ort: Punkt; aussen: Punkt };

const DREIECKE_JE_WAND = 1980 * 3;
const BLATTFORM: readonly Wandpunkt[] = [
  [0, -0.46, 0], [-0.41, -0.28, 0.03], [-0.28, 0.06, -0.16],
  [0, 0.57, 0.11], [0.33, 0.10, -0.12], [0.43, -0.23, 0.04],
];
const SPANNE_BLATTFORM = spanne(BLATTFORM);

/** Kletterefeu in der Fassadengeometrie. Türposition in Metern längs der Wand, Traufe in Weltkoordinaten. */
export function baueHausbewuchs(
  dreieck: Dreieck, start: Wandkante, ende: Wandkante, aussen: Wandkante,
  boden: (x: number, z: number) => number, traufe: number, stufe: 1 | 2,
  saat: number, tuerU: number | null, farben: Rankenfarben, dicht = false,
  /** D359: Fenster und Tür in Wand-u (ab `start`), damit der Efeu sie umwächst. */
  oeffnungen: readonly Oeffnung[] = [],
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
  const dreieckgrenze = dicht ? 3300 * 3 : DREIECKE_JE_WAND;
  const flaeche = (a: Wandpunkt, b: Wandpunkt, c: Wandpunkt, farbe: Color, blatt?: BlattKoordinaten) => {
    const kreuz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (kreuz * umlauf > 0) dreieck(welt(a), welt(b), welt(c), farbe, blatt);
    else dreieck(welt(a), welt(c), welt(b), farbe, blatt && [blatt[0], blatt[2], blatt[1]]);
    anzahl++;
  };

  const trieb = (a: Wandpunkt, b: Wandpunkt, dicke: number) => {
    const strecke = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (anzahl + 2 > dreieckgrenze || strecke < 0.02) return;
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

  /**
   * D354: `aufstellen` hebt die Blattspitze von der Wand ab (echter Efeu stellt die Spreite zum Licht),
   * `hell` dunkelt Blätter tief im Polster ab — beides zusammen macht das Polster plastisch.
   */
  const blatt = (u: number, y: number, tiefe: number, laengeBlatt: number, winkel: number, ton: number,
    aufstellen = 0, hell = 1) => {
    const einfach = stufe === 2 && ton % 3 !== 0;
    if (anzahl + (einfach ? 2 : BLATTFORM.length) > dreieckgrenze || !passt(u, y, laengeBlatt * 0.59)) return;
    const sin = Math.sin(winkel), cos = Math.cos(winkel);
    const randpunkt = ([q, h, v]: Wandpunkt): Wandpunkt => [
      u + (q * cos + h * sin) * laengeBlatt,
      y + (-q * sin + h * cos) * laengeBlatt,
      tiefe + (v + h * aufstellen) * laengeBlatt,
    ];
    const farbe = hell === 1 ? farben.blaetter[ton] : farben.blaetter[ton].clone().multiplyScalar(hell);
    const uv = (i: number): [number, number] => [BLATTFORM[i][0], BLATTFORM[i][1]];
    if (einfach) {
      const fuss = randpunkt(BLATTFORM[0]), links = randpunkt(BLATTFORM[1]);
      const spitze = randpunkt(BLATTFORM[3]), rechts = randpunkt(BLATTFORM[5]);
      flaeche(fuss, links, spitze, farbe, dicht ? [uv(0), uv(1), uv(3)] : undefined);
      flaeche(fuss, spitze, rechts, farbe, dicht ? [uv(0), uv(3), uv(5)] : undefined);
      return;
    }
    const rand = BLATTFORM.map(randpunkt);
    const mitte: Wandpunkt = [u, y, tiefe + laengeBlatt * 0.18];
    for (let i = 0; i < rand.length; i++) {
      const j = (i + 1) % rand.length;
      flaeche(mitte, rand[i], rand[j], farbe, dicht ? [[0, 0], uv(i), uv(j)] : undefined);
    }
  };

  /**
   * D359: natürlicher Wuchs mit Efeukarten — Wurzeln am Boden, Triebe zum Licht, Verzweigung, Öffnungen umwachsen.
   * Stämme werden gezeichnet, die Masse tragen Karten entlang der Triebe, die Spitzen Einzelblätter.
   */
  if (EFEUKARTEN_AN) {
    const staerke = dicht ? 1 : stufe === 2 ? .8 : .5;
    const loecher = tuerU === null ? oeffnungen
      : [...oeffnungen, { u0: tuerU - .85, u1: tuerU + .85, y0: -1e9, y1: tuerOberkante }];
    const { knoten, strecken } = wachseEfeu({ laenge, bodenBei, traufe, oeffnungen: loecher, staerke,
      ueberwaechst: stufe === 2, zufall });
    for (const { a, b } of strecken) {
      const dicke = [.006, .004, .0025][b.ordnung] + (b.ordnung === 0 ? .03 : .012) * a.alter ** 1.4;
      trieb([a.u, a.y, .012 + .02 * (1 - a.alter)], [b.u, b.y, .012 + .02 * (1 - b.alter)], dicke);
    }
    const palette = farben.blaetter.length;
    knoten.forEach((k, i) => {
      // Karten: jeder dritte Knoten der Haupt- und Seitentriebe; alt = gross und weit vor der Wand.
      if (k.ordnung < 2 && i % 3 === 0 && k.alter > .08) {
        const groesse = .6 + .45 * k.alter;
        let u = k.u + (zufall() - .5) * .16;
        // D362: Das Blattbüschel einer Karte reicht ~0,42 × Kante um die Mitte. Ragt es in ein Fenster, rückt die
        // Karte seitlich weg (höchstens 0,3 m); passt sie dann nicht, entfällt sie und Einzelblätter treten an.
        const radius = .42 * Math.min(1.1, Math.max(.6, groesse));
        const stoesst = (uu: number) => loecher.find(o => uu + radius > o.u0 - .03 && uu - radius < o.u1 + .03
          && k.y + radius > o.y0 - .03 && k.y - radius < o.y1 + .03);
        const o = stoesst(u);
        if (o) u = Math.abs(u - o.u0) < Math.abs(o.u1 - u) ? o.u0 - .03 - radius : o.u1 + .03 + radius;
        if (!o || (Math.abs(u - k.u) <= .3 && !stoesst(u) && u > radius * .5 && u < laenge - radius * .5)) {
          meldeEfeuKarte({ ort: welt([u, k.y, 0]), normal: aussen,
            vorstand: .04 + .22 * k.alter * staerke, groesse,
            winkel: Math.atan2(-umlauf * k.du, k.dy), saat: Math.floor(zufall() * 0x7fffffff) });
        } else for (let j = 0; j < 6; j++) {
          blatt(k.u + (zufall() - .5) * .22, k.y + (zufall() - .5) * .2, .04 + zufall() * .1, efeuLaenge(zufall, .8) / SPANNE_BLATTFORM,
            Math.atan2(k.du, k.dy) + (zufall() - .5) * 1.6, Math.floor(zufall() * farben.blaetter.length), .4 + .4 * zufall(), .8 + .2 * zufall());
        }
      }
      // Spitzen: einzelne Blätter, damit der Rand aus Blättern besteht, nicht aus einer Kartenkante.
      if (k.alter < .22) for (let j = 0; j < 3; j++) {
        const groesse = efeuLaenge(zufall, .55) / SPANNE_BLATTFORM;
        blatt(k.u + (zufall() - .5) * .14, k.y + (zufall() - .3) * .12, .03 + zufall() * .06, groesse,
          Math.atan2(k.du, k.dy) + (zufall() - .5) * 1.6, Math.floor(zufall() * palette), .4 + .4 * zufall(), .85 + .2 * zufall());
      }
    });
    return;
  }

  const polster = (punkt: Wandpunkt, richtung: number, dichte: number, breite: number) => {
    const palette = farben.blaetter.length;
    if (EFEUKARTEN_AN && passt(punkt[0], punkt[1], .1)) {
      const kuppel = EFEU_KUPPEL[dicht ? 3 : stufe] ?? .14;
      meldeEfeuKarte({ ort: welt([punkt[0], punkt[1], 0]), normal: aussen, vorstand: punkt[2] + kuppel,
        groesse: 1.5 * breite, saat: Math.floor(zufall() * 0x7fffffff) });
    }
    const ton = Math.floor(zufall() * palette);
    for (let i = 0; i < dichte; i++) {
      const winkel = zufall() * 2 * Math.PI;
      // Das Zentrum bleibt dicht; Finger aus jüngeren Blättern bilden einen löchrigen Saum.
      const radius = breite * Math.pow(zufall(), 1.2);
      const u = punkt[0] + Math.cos(winkel) * radius;
      const y = punkt[1] + Math.sin(winkel) * radius * 0.78;
      // D354: Das Polster wölbt sich zur Mitte bis ~0,3 m von der Wand; innen liegen die Blätter im Schatten.
      const rand = radius / breite;
      const kuppel = (EFEU_KUPPEL[dicht ? 3 : stufe] ?? .14) * (1 - rand * rand) * (.6 + .4 * zufall());
      const tiefe = Math.max(0.09, Math.min(0.45, punkt[2] + kuppel + (zufall() - 0.3) * 0.05));
      const groesse = efeuLaenge(zufall, dicht ? 1 : stufe === 2 ? .8 : .6) / SPANNE_BLATTFORM;
      const blattTon = zufall() < 0.78 ? ton : Math.floor(zufall() * palette);
      const hell = (.5 + .5 * Math.min(1, kuppel / .2 + .25 * (1 - rand))) * (.9 + .2 * zufall());
      blatt(u, y, tiefe, groesse, richtung * 0.7 + (zufall() - 0.5) * 3.6, blattTon, .45 + .45 * zufall(), hell);
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
    const dichte = EFEU_DICHTE * (dicht ? Math.floor(33 / wurzeln) : stufe === 2 ? Math.floor(19 / wurzeln) : 6);
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
      polster(seitentrieb, seite, dichte, (dicht ? .45 : .19) + zufall() * (stufe === 2 ? .52 : .27));
      polster([oben[0] + finger * 0.26, oben[1] - 0.13, 0.09], -seite, Math.ceil(dichte * 0.67),
        (dicht ? .42 : .20) + zufall() * (stufe === 2 ? .42 : .17));
      unten = oben;
    }
  }
}

/** Eine gezeichnete Ranke mit gleichmäßigem Blattabstand in Metern, auch an Knicken der Fassade. */
export function baueRankenkurve(
  dreieck: Dreieck, punkte: readonly Rankenpunkt[], saat: number, farben: Rankenfarben,
  zielbild = false, zielkrone = false,
): void {
  if (zielbild) {
    baueEfeukurve(dreieck, punkte, saat, zielkrone);
    return;
  }
  const kurve = new CatmullRomCurve3(punkte.map(p => new Vector3(...p.ort)));
  const normalen = punkte.map(p => new Vector3(...p.aussen));
  const zufall = mulberry(saat);
  const laenge = kurve.getLength();
  const abschnitte = Math.min(36, Math.max(2, Math.ceil(laenge / .27)));
  let letzterRing: Vector3[] | null = null;
  const flaeche = (a: Vector3, b: Vector3, c: Vector3, farbe: Color) =>
    dreieck(a.toArray(), b.toArray(), c.toArray(), farbe);

  for (let i = 0; i <= abschnitte; i++) {
    const anteil = i / abschnitte;
    const t = kurve.getUtoTmapping(anteil, anteil * laenge);
    const ort = kurve.getPoint(t), tangente = kurve.getTangent(t);
    const abschnitt = t * (punkte.length - 1);
    const links = Math.min(punkte.length - 2, Math.floor(abschnitt));
    const normal = normalen[links].clone().lerp(normalen[links + 1], abschnitt - links).normalize();
    const quer = new Vector3().crossVectors(tangente, normal).normalize();
    const radial = new Vector3().crossVectors(quer, tangente).normalize();
    const radius = .048 * (1 - anteil) + .008;
    const ring = [0, 1, 2].map(j => {
      const winkel = j * 2 * Math.PI / 3;
      return ort.clone().addScaledVector(radial, Math.cos(winkel) * radius)
        .addScaledVector(quer, Math.sin(winkel) * radius);
    });
    if (letzterRing) for (let j = 0; j < ring.length; j++) {
      const k = (j + 1) % ring.length;
      flaeche(letzterRing[j], ring[k], ring[j], farben.trieb);
      flaeche(letzterRing[j], letzterRing[k], ring[k], farben.trieb);
    }
    letzterRing = ring;
    if (i < 2) continue;

    const seite = i % 2 ? 1 : -1;
    const fuelle = Math.sin(Math.PI * anteil) * (.65 + .35 * Math.sin(anteil * 24) ** 2);
    const ausladung = .13 + .72 * fuelle;
    const blattVor = new Vector3().crossVectors(normal, quer).normalize();
    const triebEnde = ort.clone().addScaledVector(quer, seite * ausladung * .72).addScaledVector(normal, .07);
    const triebKante = blattVor.clone().multiplyScalar(.011);
    const astA = ort.clone().sub(triebKante), astB = ort.clone().add(triebKante);
    flaeche(seite === 1 ? astB : astA, seite === 1 ? astA : astB, triebEnde, farben.trieb);

    for (let j = 0; j < 5 * EFEU_DICHTE; j++) {
      const seitlich = j % 5 < 3 ? seite * (.14 + zufall() * .86) : (zufall() - .5) * .48;
      const mitte = ort.clone().addScaledVector(quer, seitlich * ausladung)
        .addScaledVector(blattVor, (zufall() - .42) * .44).addScaledVector(normal, .10 + zufall() * .24);
      const groesse = efeuLaenge(zufall, fuelle) / SPANNE_BLATTFORM;
      const winkel = seite * .7 + (zufall() - .5) * 3.3;
      const cos = Math.cos(winkel), sin = Math.sin(winkel);
      const stiel = blattVor.clone().multiplyScalar(cos).addScaledVector(quer, sin);
      const breite = quer.clone().multiplyScalar(cos).addScaledVector(blattVor, -sin);
      const rand = BLATTFORM.map(([u, y, h]) => mitte.clone().addScaledVector(breite, groesse * u)
        .addScaledVector(stiel, groesse * y).addScaledVector(normal, groesse * h));
      const falz = mitte.clone().addScaledVector(normal, groesse * .11);
      const farbe = farben.blaetter[Math.floor(zufall() * farben.blaetter.length)];
      const ansatz = ort.clone().lerp(triebEnde, Math.max(0, Math.min(1, seitlich * seite)));
      const halbeKante = triebKante.clone().multiplyScalar(.5 * Math.sign(seitlich));
      flaeche(ansatz.clone().add(halbeKante), ansatz.clone().sub(halbeKante), rand[0], farben.trieb);
      for (let k = 0; k < rand.length; k++) flaeche(falz, rand[(k + 1) % rand.length], rand[k], farbe);
    }
  }
}

// Die Seitenspitzen und Einschnitte lassen junge Efeublätter auch im Halbschatten erkennen.
const EFEUBLATT: readonly Wandpunkt[] = [
  [0, -.44, 0], [-.32, -.38, -.04], [-.45, -.15, -.11], [-.56, .13, -.10], [-.24, .16, -.05],
  [0, .68, -.09], [.23, .18, -.07], [.55, .20, -.10], [.43, -.15, -.13], [.29, -.40, -.03],
];
const SPANNE_EFEUBLATT = spanne(EFEUBLATT);
const EFEULAUB = ['#303722', '#3b462a', '#434c30', '#4c5435', '#595d3c', '#656347']
  .map(ton => new Color(ton));
export const EFEURINDE = ['#4e4233', '#62503d', '#705b43'].map(ton => new Color(ton));

// Der Rand behält die Spitzen, die dazwischenliegenden Bögen runden die fünf Lappen ab.
const KRONENBLATT: readonly Wandpunkt[] = [
  [0,-.43,-.02], [-.20,-.48,0], [-.38,-.39,-.025], [-.42,-.22,-.04],
  [-.35,-.06,-.052], [-.57,.13,-.085], [-.39,.22,-.06], [-.235,.19,-.03],
  [-.12,.46,-.015], [0,.72,-.055], [.15,.47,-.03], [.225,.22,-.026],
  [.38,.24,-.04], [.565,.19,-.08], [.385,-.08,-.043], [.37,-.25,-.033],
  [.29,-.43,-.015], [.15,-.47,.005],
];
/**
 * D353: Bei 4–12 cm Blattlänge tragen die Lappenspitzen und jeder zweite Bogenpunkt die Form; 12 statt 18 Dreiecke
 * je Blatt halten die dreifache Blattzahl im Hauspuffer (Budget aus D318).
 */
// Die Lappenspitzen (5, 9, 13) bleiben immer, sonst verliert das Blatt seine Form.
const KRONENBLATT_KLEIN: readonly Wandpunkt[] = KRONENBLATT.filter((_, i) => i % 2 === 0 || i === 5 || i === 9 || i === 13);
const SPANNE_KRONENBLATT = spanne(KRONENBLATT_KLEIN);
const KRONENLAUB = ['#39462b', '#414b32', '#485336', '#535c3b', '#5c6241', '#686c48', '#78784c']
  .map(ton => new Color(ton));
const SCHATTENLAUB = KRONENLAUB.map(ton => ton.clone().multiplyScalar(.64));
export const KRONENRINDE = ['#47382b', '#584836', '#5d4d38', '#63533d', '#514537']
  .map(ton => new Color(ton));

type VektorDreieck = (a: Vector3, b: Vector3, c: Vector3, farbe: Color, blatt?: BlattKoordinaten) => void;

/** Verdichtete alte Triebe unmittelbar an der Wand, junge Blattfinger am Kronenrand. */
function baueKronenblaetter(
  flaeche: VektorDreieck, ort: Vector3, quer: Vector3, hoch: Vector3, normal: Vector3,
  lauf: number, hoehe: number, zufall: () => number,
): void {
  // Wurzelholz bleibt am Boden ablesbar. Die Ausläufer werden oben wieder lichter.
  const aufstieg = Math.max(0, Math.min(1, (hoehe - (HOF_VERFALLVERLAUF_AN ? .08 : .24)) / (HOF_VERFALLVERLAUF_AN ? 1.86 : 1.11)));
  const auslauf = HOF_VERFALLVERLAUF_AN ? Math.min(1, (1.025 - lauf) * 5.7) : Math.min(1, (1.075 - lauf) * 7);
  const dichte = aufstieg * auslauf;
  if (dichte < .10) return;
  const schwung = Math.sin(lauf * 22) * .50 + Math.sin(lauf * 47 + 1.35) * .24;
  // Am oberen Wandanschluss greifen einzelne Triebe weiter in die Traufe.
  const traufsaum = HOF_ORTSALTERUNG_AN ? .40 * Math.max(0, 1 - Math.abs(lauf - .77) / .16) : 0;
  const halbeBreite = .24 + dichte * ((HOF_ZIELTREUE_AN ? .99 : .77) + schwung * .42 + traufsaum);
  const mitte = Math.floor(zufall() * KRONENLAUB.length);
  const dunkleSeite = zufall() > .5 ? -1 : 1;

  const fieder = (ansatz: Vector3, ziel: Vector3, seitlich: number, gross: number, schatten: boolean) => {
    // Hängende Blätter, die im Winkel dem lokalen Ende des Seitentriebs folgen.
    const winkel = Math.PI + seitlich * .72 + (zufall() - .5) * 2;
    const cos = Math.cos(winkel), sin = Math.sin(winkel);
    const laengs = hoch.clone().multiplyScalar(cos).addScaledVector(quer, sin);
    const breit = quer.clone().multiplyScalar(cos).addScaledVector(hoch, -sin);
    const blattKnick = (zufall() - .28) * .58, rollung = (zufall() - .5) * .83;
    const blattBreite = gross * (.8 + zufall() * .36);
    const rand = KRONENBLATT_KLEIN.map(([x, y, w]) => ziel.clone()
      .addScaledVector(breit, x * blattBreite)
      .addScaledVector(laengs, y * gross)
      .addScaledVector(normal, gross * (w + x * rollung + y * blattKnick)));
    const falz = ziel.clone().addScaledVector(normal, .05 * gross);
    const palette = schatten ? SCHATTENLAUB : KRONENLAUB;
    const ton = palette[Math.max(0, Math.min(palette.length - 1, mitte + Math.floor(zufall() * 5) - 2))];
    const stielKante = hoch.clone().multiplyScalar(.005);
    flaeche(ansatz.clone().add(stielKante), ansatz.clone().sub(stielKante), rand[0], KRONENRINDE[1]);
    for (let k = 0; k < rand.length; k++) {
      const l = (k + 1) % rand.length;
      flaeche(falz, rand[l], rand[k], ton, [[0, 0], [KRONENBLATT_KLEIN[l][0], KRONENBLATT_KLEIN[l][1]], [KRONENBLATT_KLEIN[k][0], KRONENBLATT_KLEIN[k][1]]]);
    }
  };

  // Tiefe in der Krone kommt von der dunklen wandnahen Lage.
  for (let k = 0; k < Math.ceil(dichte * (HOF_ZIELTREUE_AN ? 4 : 3) * EFEU_DICHTE_KRONE); k++) {
    const ziel = ort.clone().addScaledVector(quer, (zufall() - .5) * halbeBreite * .81)
      .addScaledVector(hoch, (zufall() - .5) * .30)
      .addScaledVector(normal, .04 + zufall() * .105);
    fieder(ort, ziel, (zufall() - .5) * 1.2, efeuLaenge(zufall, dichte) / SPANNE_KRONENBLATT, k !== 0);
  }
  const seitentriebe = Math.ceil(dichte * (HOF_ZIELTREUE_AN ? 6 : 5) * EFEU_DICHTE_KRONE);
  const seite = (Math.floor(lauf * 17) % 2 ? 1 : -1);
  for (const richtung of [-1, 1]) {
    // Seitentriebe laufen in versetzten Inseln aus, auch am Übergang um die Ecke.
    const ausbreitung = HOF_VERFALLVERLAUF_AN ? .96 + .36 * richtung * Math.sin(20 * lauf + 1.6) : 1;
    const reichweite = richtung * halbeBreite * (.68 + zufall() * .31 + (seite === richtung ? .14 : 0)) * ausbreitung;
    const neigung = -.32 + zufall() * .64;
    const ausstand = .13 + zufall() * .17;
    const ast = (t: number) => ort.clone().addScaledVector(quer, reichweite * t)
      .addScaledVector(hoch, neigung * t * t)
      .addScaledVector(normal, ausstand * t);
    const ansatz = ast(.22);
    const spitze = ast(1);
    const kante = hoch.clone().multiplyScalar(.013 * richtung);
    flaeche(ansatz.clone().add(kante), ansatz.clone().sub(kante), spitze, KRONENRINDE[0]);
    for (let j = 0; j < seitentriebe; j++) {
      const fortschritt = (j + .27 + zufall() * .59) / seitentriebe;
      const ansatz = ast(fortschritt * .82);
      const ziel = ast(fortschritt).addScaledVector(hoch, (zufall() - .48) * .35)
        .addScaledVector(normal, .028 + zufall() * .085);
      const blattEnde = HOF_VERFALLVERLAUF_AN ? 1.15 - .61 * fortschritt * fortschritt : .9 + .24 * (1 - fortschritt);
      const groesse = efeuLaenge(zufall, blattEnde * dichte) / SPANNE_KRONENBLATT;
      fieder(ansatz, ziel, richtung, groesse, richtung === dunkleSeite && j === 0);
    }
  }
}

/** D317: eng um die Hausecke wachsender Efeu mit drei verholzten Wurzelsträngen. */
function baueEfeukurve(dreieck: Dreieck, punkte: readonly Rankenpunkt[], saat: number, zielkrone: boolean): void {
  if (punkte.length < 2) return;
  const kurve = new CatmullRomCurve3(punkte.map(punkt => new Vector3(...punkt.ort)));
  const normalen = punkte.map(punkt => new Vector3(...punkt.aussen));
  const laenge = kurve.getLength();
  if (laenge < .05) return;
  const abschnitte = zielkrone ? Math.min(62, Math.max(3, Math.ceil(laenge / .14)))
    : Math.min(58, Math.max(2, Math.ceil(laenge / .13)));
  const zufall = mulberry(saat);
  const ringe: Vector3[][] = Array.from({ length: zielkrone ? 4 : 3 }, () => []);
  const profil = zielkrone ? [0, 1, 2, 3, 4] : [0, 1, 2];
  const flaeche = (a: Vector3, b: Vector3, c: Vector3, farbe: Color, blatt?: BlattKoordinaten) =>
    dreieck(a.toArray(), b.toArray(), c.toArray(), farbe, blatt);

  for (let i = 0; i <= abschnitte; i++) {
    const anteil = i / abschnitte;
    const t = kurve.getUtoTmapping(anteil, anteil * laenge);
    const ort = kurve.getPoint(t), tangente = kurve.getTangent(t);
    const stelle = t * (punkte.length - 1);
    const links = Math.min(punkte.length - 2, Math.floor(stelle));
    const normal = normalen[links].clone().lerp(normalen[links + 1], stelle - links).normalize();
    const quer = new Vector3().crossVectors(tangente, normal);
    if (quer.lengthSq() < 1e-5) {
      const achse = Math.abs(tangente.y) < .9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
      quer.crossVectors(achse, tangente);
    }
    quer.normalize();
    const radial = new Vector3().crossVectors(quer, tangente).normalize();
    const laubHoch = new Vector3().crossVectors(normal, quer).normalize();

    for (let r = 0; r < ringe.length; r++) {
      const drehung = zielkrone ? anteil * (14 + r * 3) + r * Math.PI * .5
        : anteil * (8 + r * 2) + r * Math.PI * 2 / 3;
      const abst = zielkrone ? .021 + .108 * (1 - anteil) ** 1.3 : .014 + .065 * (1 - anteil) ** 1.1;
      const zentrum = ort.clone().addScaledVector(quer, Math.cos(drehung) * abst * (zielkrone ? 1.34 : 1.6))
        .addScaledVector(radial, Math.sin(drehung) * abst);
      const radius = zielkrone ? (.087 - .013 * r) * (1 - anteil) ** 1.37 + .006
        : (.052 - .009 * r) * (1 - anteil) ** 1.25 + .009;
      const ring = profil.map(j => {
        const winkel = j * Math.PI * 2 / profil.length + r;
        const rippe = zielkrone ? radius * (.86 + .23 * Math.sin(j * 7.53 + r * 1.91)) : radius;
        return zentrum.clone().addScaledVector(radial, Math.cos(winkel) * rippe)
          .addScaledVector(quer, Math.sin(winkel) * rippe);
      });
      const vorher = ringe[r];
      for (let j = 0; j < vorher.length; j++) {
        const k = (j + 1) % ring.length;
        const palette = zielkrone ? KRONENRINDE : EFEURINDE;
        const ton = palette[(j + r) % palette.length];
        flaeche(vorher[j], ring[k], ring[j], ton);
        flaeche(vorher[j], vorher[k], ring[k], ton);
      }
      ringe[r] = ring;
    }
    if (zielkrone) {
      baueKronenblaetter(flaeche, ort, quer, laubHoch, normal, anteil, ort.y - punkte[0].ort[1], zufall);
      continue;
    }
    if (anteil < .065) continue;

    const dichte = HOF_VERFALLVERLAUF_AN
      ? Math.min(1, anteil * 4.3, (1.035 - anteil) * 2.8)
      : Math.min(1, (anteil - .085) * 5.5);
    const fuelle = dichte * (.78 + .22 * Math.sin(anteil * 28) ** 2);
    const breite = .19 + .69 * fuelle;
    const zahl = Math.round((2 + 6 * fuelle) * EFEU_DICHTE);
    // D358: jeder vierte Abschnitt meldet eine Karte auf dem Polster um den Trieb.
    if (EFEUKARTEN_AN && i % 4 === 0 && fuelle > .25 && Math.abs(normal.y) < .6) {
      const n = new Vector3(normal.x, 0, normal.z).normalize();
      meldeEfeuKarte({ ort: [ort.x, ort.y, ort.z], normal: [n.x, n.z], vorstand: .06 + EFEU_KUPPEL[2] * fuelle,
        groesse: 1.3 * breite, saat: Math.floor(zufall() * 0x7fffffff) });
    }
    const hauptseite = i % 2 ? 1 : -1;
    const ast = ort.clone().addScaledVector(quer, breite * .72 * hauptseite).addScaledVector(normal, .10);
    const astKante = laubHoch.clone().multiplyScalar(.016 * hauptseite);
    flaeche(ort.clone().add(astKante), ort.clone().sub(astKante), ast, EFEURINDE[1]);

    for (let j = 0; j < zahl; j++) {
      const seite = j % 3 === 0 ? -hauptseite : hauptseite;
      const ausladung = seite * breite * (.04 + zufall() ** 1.15 * .96);
      // D354: Polster um den Trieb — mittig weit vorn, am Rand flach an der Wand.
      const randAnteil = Math.min(1, Math.abs(ausladung) / Math.max(.01, breite));
      const vorstand = .06 + EFEU_KUPPEL[2] * (1 - randAnteil * randAnteil) * (.55 + .45 * zufall());
      const mitte = ort.clone().addScaledVector(quer, ausladung)
        .addScaledVector(laubHoch, (zufall() - .48) * .38)
        .addScaledVector(normal, vorstand);
      const schattenHell = (.5 + .5 * Math.min(1, (vorstand - .06) / EFEU_KUPPEL[2] + .2)) * (.9 + .2 * zufall());
      const aufstellen = .4 + .5 * zufall();
      const groesse = efeuLaenge(zufall, HOF_VERFALLVERLAUF_AN ? fuelle : .5 + .5 * fuelle) / SPANNE_EFEUBLATT;
      const winkel = seite * .75 + (zufall() - .5) * 2.25;
      const cos = Math.cos(winkel), sin = Math.sin(winkel);
      const stiel = laubHoch.clone().multiplyScalar(cos).addScaledVector(quer, sin);
      const querBlatt = quer.clone().multiplyScalar(cos).addScaledVector(laubHoch, -sin);
      const neigung = (zufall() - .5) * .70;
      const knick = (zufall() - .57) * .51;
      const rand = EFEUBLATT.map(([u, y, v]) => mitte.clone()
        .addScaledVector(querBlatt, groesse * u).addScaledVector(stiel, groesse * y)
        .addScaledVector(normal, groesse * (v + neigung * u + knick * y + aufstellen * y)));
      const falz = mitte.clone().addScaledVector(normal, groesse * .052);
      const farbe = EFEULAUB[Math.floor(zufall() * EFEULAUB.length)].clone().multiplyScalar(schattenHell);
      const ansatz = ort.clone().lerp(ast, Math.max(0, ausladung * hauptseite / breite));
      const stielKante = laubHoch.clone().multiplyScalar(.006 * seite);
      flaeche(ansatz.clone().add(stielKante), ansatz.clone().sub(stielKante), rand[0], EFEURINDE[2]);
      for (let k = 0; k < rand.length; k++) {
        const l = (k + 1) % rand.length;
        flaeche(falz, rand[l], rand[k], farbe, [[0, 0], [EFEUBLATT[l][0], EFEUBLATT[l][1]], [EFEUBLATT[k][0], EFEUBLATT[k][1]]]);
      }
    }
  }
}
