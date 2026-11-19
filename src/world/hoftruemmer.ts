/** Verkeilte Dachreste und angebrochene Dachdeckung von Haus 308. */
import { Color } from 'three';
import type { HausQuad } from './hausbauteil.js';
import { baueBruchholz } from './bruchholz.js';
import { mulberry } from './props.js';

type Punkt = [number, number, number];
type Dreieck = (a: Punkt, b: Punkt, c: Punkt, farbe: Color) => void;
type Fassadenpunkt = (anteil: number, hoehe: number, tiefe: number) => Punkt;
type Dachpunkt = (u: number, v: number, hub: number) => Punkt;
type Dachkante = { u: number; v: number };
const SCHNITT = new Color('#625548');
const UNTERSICHT = new Color('#3b3328');
const OBEN: Punkt = [0, 1, 0];
const UNTEN: Punkt = [0, -1, 0];

/** D320: versetzte Deckreihen auf der eingesunkenen Dachhaut. */
export function baueDachschindeln(
  dreieck: Dreieck, quad: HausQuad, P: Dachpunkt, rand: readonly Dachkante[],
  zurTraufe: -1 | 1, aussen: Punkt, holztoene: readonly Color[],
): void {
  const zufall = mulberry(320308);
  const start = rand[0].u, ende = rand[rand.length - 1].u;
  const tiefe = (u: number) => {
    const i = rand.findIndex(kante => kante.u >= u);
    if (i <= 0) return i === 0 ? rand[0].v : rand[rand.length - 1].v;
    const a = rand[i - 1], b = rand[i];
    return a.v + (b.v - a.v) * (u - a.u) / (b.u - a.u);
  };
  for (let reihe = 0; reihe < 6; reihe++) {
    // Die Deckung folgt den Latten. Nur die unteren Reihen sind an der Abrisskante ausgerissen.
    for (let u0 = start + (reihe % 2) * .14; u0 < ende - .105;) {
      const breit = .18 + zufall() * .24;
      const u1 = Math.min(ende, u0 + breit);
      const nahAmBruch = reihe < 2;
      if (!nahAmBruch || zufall() > .19) {
        const mitte = (u0 + u1) / 2;
        const laenge = .38 + zufall() * .22;
        const ueberstand = nahAmBruch ? .10 + zufall() * .27 : .04 * zufall();
        const spreizung = nahAmBruch ? .25 : .105;
        const v = tiefe(mitte) + zurTraufe * (ueberstand - reihe * .286);
        const v0 = v + zurTraufe * (zufall() - .5) * spreizung;
        const v1 = v + zurTraufe * (zufall() - .5) * spreizung;
        const lippe = .038 + zufall() * .062;
        const a = P(u0,v0,lippe), b = P(u1,v1,lippe + (zufall() - .5) * .052);
        const c = P(u1-.018,v1-zurTraufe*laenge,.025), d = P(u0+.015,v0-zurTraufe*laenge,.032);
        const aUnten = P(u0,v0,lippe-.052), bUnten = P(u1,v1,lippe-.046);
        const farbe = holztoene[Math.floor(zufall() * holztoene.length)];
        quad(a,b,c,d,farbe,OBEN);
        quad(aUnten,bUnten,b,a,SCHNITT,aussen);
        if (nahAmBruch) {
          // Nur über der fehlenden Schalung kann man die Unterseite und einzelne lange Fasern sehen.
          quad(aUnten,d,c,bUnten,UNTERSICHT,UNTEN);
          if (zufall() > .45) {
            const spitze = P(mitte + (zufall() - .5) * .11,v+zurTraufe*(.10+zufall()*.15),lippe-.14-zufall()*.34);
            const faser = P(mitte,v,-.014), riss = P(mitte+.04,v,lippe-.02);
            dreieck(faser,spitze,riss,SCHNITT);
            dreieck(faser,riss,spitze,UNTERSICHT);
          }
        }
      }
      u0 = u1 + .007 + zufall() * .011;
    }
  }
}

export function baueTruemmerkeil(
  dreieck: Dreieck, quad: HausQuad, P: Fassadenpunkt, wandLaenge: number, boden: number,
  traufe: number, schindelfarbe: Color, aussen: Punkt, splitter = false,
): void {
  // Der Hauptsparren hängt am äußeren Ständer. Unter ihm liegt der abgescherte Gegenzug.
  baueBruchholz(dreieck,P(.594,boden+.21,.12),P(.213,traufe-.26,-.06),.24,.21,318308,true,splitter);
  baueBruchholz(dreieck,P(.575,boden+.28,.18),P(.393,boden+1.47,.10),.118,.086,318309,true,splitter);
  baueBruchholz(dreieck,P(.741,boden+1.36,-.24),P(.475,boden+.35,.31),.215,.17,318310,true,splitter);
  baueBruchholz(dreieck,P(.649,boden+.25,.52),P(.332,boden+.65,-.44),.19,.15,318311,true,splitter);
  baueBruchholz(dreieck,P(.618,boden+.25,.23),P(.405,boden+.79,-.57),.10,.085,318312,true,splitter);

  // Verkeilte Schalungsstücke in einer Mulde, am Mauerband enger gestaffelt.
  const zufall = mulberry(318037);
  for (let i = 0; i < (splitter ? 43 : 25); i++) {
    const lage = i % 5, stelle = Math.floor(i / 5);
    const t = splitter ? .28+zufall()*.455 : .28+stelle*.093+(zufall()-.5)*.083;
    const h = boden + .14 + lage * .105 + Math.abs(t - .51) * .7 + (splitter ? zufall()*.14 : 0);
    const v = .41 - lage * .162 + (zufall() - .5) * (splitter ? .47 : .22);
    const b = (.13 + zufall() * .19) / wandLaenge;
    const neigung = (zufall() - .38) * .41;
    const r = t + (zufall() - .5) * .10;
    const a = P(t-b,h,v+.10), b0 = P(t+b,h+.066,v+.06);
    const c = P(r+b*.82,h+.16+neigung,v-.30), d = P(r-b*.68,h+.12+neigung,v-.38);
    const faser = P(t+b*.15,h+.016,v+.142);
    dreieck(a,faser,b0,SCHNITT);
    quad(a,b0,c,d,schindelfarbe,OBEN);
    quad(a,b0,P(t+b,h+.028,v+.06),P(t-b,h-.038,v+.10),UNTERSICHT,aussen);
  }
}
