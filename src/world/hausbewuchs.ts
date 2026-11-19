import { CatmullRomCurve3, Color, Vector3 } from 'three';
import { mulberry } from './props.js';
import { HOF_ORTSALTERUNG_AN, HOF_VERFALLVERLAUF_AN, HOF_ZIELTREUE_AN } from './echt.js';

type Punkt = [number, number, number];
type Wandkante = readonly [number, number];
type Wandpunkt = [laenge: number, hoehe: number, abstand: number];
export type BlattKoordinaten = readonly [readonly [number, number], readonly [number, number], readonly [number, number]];
type Dreieck = (a: Punkt, b: Punkt, c: Punkt, farbe: Color, blatt?: BlattKoordinaten) => void;
type Rankenfarben = { blaetter: readonly Color[]; trieb: Color };
export type Rankenpunkt = { ort: Punkt; aussen: Punkt };

const DREIECKE_JE_WAND = 1980;
const BLATTFORM: readonly Wandpunkt[] = [
  [0, -0.46, 0], [-0.41, -0.28, 0.03], [-0.28, 0.06, -0.16],
  [0, 0.57, 0.11], [0.33, 0.10, -0.12], [0.43, -0.23, 0.04],
];

/** Kletterefeu in der Fassadengeometrie. Türposition in Metern längs der Wand, Traufe in Weltkoordinaten. */
export function baueHausbewuchs(
  dreieck: Dreieck, start: Wandkante, ende: Wandkante, aussen: Wandkante,
  boden: (x: number, z: number) => number, traufe: number, stufe: 1 | 2,
  saat: number, tuerU: number | null, farben: Rankenfarben, dicht = false,
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
  const dreieckgrenze = dicht ? 3300 : DREIECKE_JE_WAND;
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

  const blatt = (u: number, y: number, tiefe: number, laengeBlatt: number, winkel: number, ton: number) => {
    const einfach = stufe === 2 && ton % 3 !== 0;
    if (anzahl + (einfach ? 2 : BLATTFORM.length) > dreieckgrenze || !passt(u, y, laengeBlatt * 0.59)) return;
    const sin = Math.sin(winkel), cos = Math.cos(winkel);
    const randpunkt = ([q, h, v]: Wandpunkt): Wandpunkt => [
      u + (q * cos + h * sin) * laengeBlatt,
      y + (-q * sin + h * cos) * laengeBlatt,
      tiefe + v * laengeBlatt,
    ];
    const farbe = farben.blaetter[ton];
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
      const groesse = dicht ? .20 + zufall() * .19 : stufe === 2 ? .15 + zufall() * .14 : .105 + zufall() * .11;
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
    const dichte = dicht ? Math.floor(33 / wurzeln) : stufe === 2 ? Math.floor(19 / wurzeln) : 6;
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

    for (let j = 0; j < 5; j++) {
      const seitlich = j < 3 ? seite * (.14 + zufall() * .86) : (zufall() - .5) * .48;
      const mitte = ort.clone().addScaledVector(quer, seitlich * ausladung)
        .addScaledVector(blattVor, (zufall() - .42) * .44).addScaledVector(normal, .10 + zufall() * .24);
      const groesse = (.14 + zufall() * .24) * (.68 + .32 * fuelle);
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
const EFEULAUB = ['#303722', '#3b462a', '#434c30', '#4c5435', '#595d3c', '#656347']
  .map(ton => new Color(ton));
const EFEURINDE = ['#4e4233', '#62503d', '#705b43'].map(ton => new Color(ton));

// Der Rand behält die Spitzen, die dazwischenliegenden Bögen runden die fünf Lappen ab.
const KRONENBLATT: readonly Wandpunkt[] = [
  [0,-.43,-.02], [-.20,-.48,0], [-.38,-.39,-.025], [-.42,-.22,-.04],
  [-.35,-.06,-.052], [-.57,.13,-.085], [-.39,.22,-.06], [-.235,.19,-.03],
  [-.12,.46,-.015], [0,.72,-.055], [.15,.47,-.03], [.225,.22,-.026],
  [.38,.24,-.04], [.565,.19,-.08], [.385,-.08,-.043], [.37,-.25,-.033],
  [.29,-.43,-.015], [.15,-.47,.005],
];
const KRONENLAUB = ['#39462b', '#414b32', '#485336', '#535c3b', '#5c6241', '#686c48', '#78784c']
  .map(ton => new Color(ton));
const SCHATTENLAUB = KRONENLAUB.map(ton => ton.clone().multiplyScalar(.64));
const KRONENRINDE = ['#47382b', '#584836', '#5d4d38', '#63533d', '#514537']
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
    const rand = KRONENBLATT.map(([x, y, w]) => ziel.clone()
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
      flaeche(falz, rand[l], rand[k], ton, [[0, 0], [KRONENBLATT[l][0], KRONENBLATT[l][1]], [KRONENBLATT[k][0], KRONENBLATT[k][1]]]);
    }
  };

  // Tiefe in der Krone kommt von der dunklen wandnahen Lage.
  for (let k = 0; k < Math.ceil(dichte * (HOF_ZIELTREUE_AN ? 4 : 3)); k++) {
    const ziel = ort.clone().addScaledVector(quer, (zufall() - .5) * halbeBreite * .81)
      .addScaledVector(hoch, (zufall() - .5) * .30)
      .addScaledVector(normal, .04 + zufall() * .105);
    fieder(ort, ziel, (zufall() - .5) * 1.2, .19 + zufall() * .17, k !== 0);
  }
  const seitentriebe = Math.ceil(dichte * (HOF_ZIELTREUE_AN ? 6 : 5));
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
      const groesse = (.17 + zufall() * .15) * blattEnde * (.77 + .23 * dichte);
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
    const zahl = Math.round(2 + 6 * fuelle);
    const hauptseite = i % 2 ? 1 : -1;
    const ast = ort.clone().addScaledVector(quer, breite * .72 * hauptseite).addScaledVector(normal, .10);
    const astKante = laubHoch.clone().multiplyScalar(.016 * hauptseite);
    flaeche(ort.clone().add(astKante), ort.clone().sub(astKante), ast, EFEURINDE[1]);

    for (let j = 0; j < zahl; j++) {
      const seite = j % 3 === 0 ? -hauptseite : hauptseite;
      const ausladung = seite * breite * (.04 + zufall() ** 1.15 * .96);
      const mitte = ort.clone().addScaledVector(quer, ausladung)
        .addScaledVector(laubHoch, (zufall() - .48) * .38)
        .addScaledVector(normal, .10 + zufall() * .14);
      const groesse = (.14 + zufall() * .19) * (HOF_VERFALLVERLAUF_AN ? .27 + .66 * fuelle : .58 + .42 * fuelle);
      const winkel = seite * .75 + (zufall() - .5) * 2.25;
      const cos = Math.cos(winkel), sin = Math.sin(winkel);
      const stiel = laubHoch.clone().multiplyScalar(cos).addScaledVector(quer, sin);
      const querBlatt = quer.clone().multiplyScalar(cos).addScaledVector(laubHoch, -sin);
      const neigung = (zufall() - .5) * .70;
      const knick = (zufall() - .57) * .51;
      const rand = EFEUBLATT.map(([u, y, v]) => mitte.clone()
        .addScaledVector(querBlatt, groesse * u).addScaledVector(stiel, groesse * y)
        .addScaledVector(normal, groesse * (v + neigung * u + knick * y)));
      const falz = mitte.clone().addScaledVector(normal, groesse * .052);
      const farbe = EFEULAUB[Math.floor(zufall() * EFEULAUB.length)];
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
