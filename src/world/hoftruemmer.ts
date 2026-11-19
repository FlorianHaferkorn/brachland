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

/** Ausgebrochene Putzkante unter derselben Lastspur wie die Schalung. */
export function bruchKantenabtrag(anteil: number): number {
  const druck = Math.max(0, 1 - ((anteil - .49) / .30) ** 2);
  return druck * (.30 + .13 * Math.sin(anteil * 38) + .09 * Math.cos(anteil * 87));
}

/** Schräg gerissene Schalungsbretter mit erhaltenen, verschieden nachgebenden Anschlüssen. */
export function baueSchalungsriss(
  dreieck: Dreieck, quad: HausQuad, P: Fassadenpunkt, t0: number, t1: number, boden: number, traufe: number,
  seitlich: Punkt, aussen: Punkt, farbe: Color, nummer: number, putzbruch: (t: number) => number,
): void {
  const zufall = mulberry(321344 + nummer);
  const mitte = (t0 + t1) * .5;
  const druck = Math.max(0, 1 - ((mitte - .49) / .35) ** 2);
  const breite = t1 - t0;
  // Das Brett steht an den Schultern noch hoch und splisst näher zur Mulde auf.
  const rest = .13 + .09 * zufall() + (traufe - boden - .51) * (1 - druck) ** 2
    + druck * druck * zufall() ** 2 * .42;
  const lehne = (.013 + .13 * zufall()) * druck;
  const a = P(t0,boden-putzbruch(t0),-.016), b = P(t1,boden-putzbruch(t1),-.02);
  const c = P(t1-breite*.04,boden+rest*.72,lehne*.73), d = P(t0+breite*.08,boden+rest,lehne);
  const riss = P(mitte-breite*.13,boden+rest*(.96+zufall()*.24),lehne+.017);
  const cInnen = P(t1-breite*.04,c[1]-.04,lehne*.73-.095);
  const dInnen = P(t0+breite*.08,d[1]+.014,lehne-.092);
  const rissInnen = P(mitte-breite*.13,riss[1]-.09,lehne-.061);
  quad(a,b,c,riss,farbe,aussen);
  dreieck(a,d,riss,farbe);
  quad(d,riss,rissInnen,dInnen,SCHNITT,OBEN);
  quad(riss,c,cInnen,rissInnen,SCHNITT,OBEN);
  quad(b,P(t1,b[1],-.11),cInnen,c,UNTERSICHT,seitlich);
  quad(a,d,dInnen,P(t0,a[1],-.11),UNTERSICHT,[-seitlich[0],0,-seitlich[2]]);

  if (druck < .35 || zufall() > .43) return;
  // Einzelne obere Bretter hängen noch an den Latten; die gerissenen Enden weichen nach innen aus.
  const start = traufe + .03, ende = start - (.20 + zufall() * .71) * druck;
  const obenLinks = P(t0+breite*.13,start,-.10), obenRechts = P(t1-breite*.21,start,-.085);
  const unten = P(mitte-breite*.065,ende,-.23-druck*.25);
  const untenRechts = P(t1-breite*.32,ende+.16,-.25-druck*.25);
  quad(obenLinks,obenRechts,untenRechts,unten,farbe,aussen);
  quad(obenRechts,obenLinks,unten,untenRechts,UNTERSICHT,[-aussen[0],0,-aussen[2]]);
}

/** D320: versetzte Deckreihen auf der eingesunkenen Dachhaut. */
export function baueDachschindeln(
  dreieck: Dreieck, quad: HausQuad, P: Dachpunkt, rand: readonly Dachkante[],
  zurTraufe: -1 | 1, aussen: Punkt, holztoene: readonly Color[], verlauf = false, bruchhaut = false,
): void {
  const zufall = mulberry(320308);
  const start = rand[0].u, ende = rand[rand.length - 1].u;
  const tiefe = (u: number) => {
    const i = rand.findIndex(kante => kante.u >= u);
    if (i <= 0) return i === 0 ? rand[0].v : rand[rand.length - 1].v;
    const a = rand[i - 1], b = rand[i];
    return a.v + (b.v - a.v) * (u - a.u) / (b.u - a.u);
  };
  for (let reihe = 0; reihe < (bruchhaut ? 8 : 6); reihe++) {
    // Die Deckung folgt den Latten. Nur die unteren Reihen sind an der Abrisskante ausgerissen.
    for (let u0 = start + (reihe % 2) * .14; u0 < ende - .105;) {
      const breit = .18 + zufall() * .24;
      const u1 = Math.min(ende, u0 + breit);
      const nahAmBruch = reihe < 2;
      const randabstand = Math.min(u1 - start, ende - u0);
      const randUebergang = verlauf ? Math.min(1, Math.max(0, (randabstand-.36)/1.08)) : 1;
      const loseDeckung = verlauf && randUebergang > .65 && nahAmBruch;
      if (!nahAmBruch || zufall() > .19) {
        const mitte = (u0 + u1) / 2;
        const laenge = (bruchhaut ? .46 : .38) + zufall() * .22;
        const ueberstand = nahAmBruch ? .10 + zufall() * .27 : .04 * zufall();
        const spreizung = loseDeckung ? .29 : nahAmBruch ? .25 : .105;
        // Am auslaufenden Rand liegt die Deckung wieder auf der Traufe auf.
        const ueberschuss = verlauf ? -.16 + (ueberstand+.16)*randUebergang : ueberstand;
        const v = tiefe(mitte) + zurTraufe * (ueberschuss - reihe * .286);
        const v0 = v + (bruchhaut ? tiefe(u0) - tiefe(mitte) : 0) + zurTraufe * (zufall() - .5) * spreizung;
        const v1 = v + (bruchhaut ? tiefe(u1) - tiefe(mitte) : 0) + zurTraufe * (zufall() - .5) * spreizung;
        const lippe = .038 + zufall() * .062 * randUebergang + (loseDeckung ? (zufall()-.7)*.071 : 0);
        // Frontenden einzelner Deckbretter sacken ab. Die firstseitige
        // Überlappung liegt auf der nächsten Reihe und bleibt unverformt.
        const abknick = bruchhaut && loseDeckung ? (.06 + zufall()*.17) * (1 - reihe*.45) : 0;
        const a = P(u0,v0,lippe-abknick), b = P(u1,v1,lippe-abknick + (zufall() - .5) * .052);
        const c = P(u1-.018,v1-zurTraufe*laenge,.025), d = P(u0+.015,v0-zurTraufe*laenge,.032);
        const aUnten = P(u0,v0,lippe-abknick-.052), bUnten = P(u1,v1,lippe-abknick-.046);
        const farbe = holztoene[Math.floor(zufall() * holztoene.length)];
        quad(a,b,c,d,farbe,OBEN);
        quad(aUnten,bUnten,b,a,SCHNITT,aussen);
        if (nahAmBruch && randUebergang > .58) {
          // Nur über der fehlenden Schalung kann man die Unterseite und einzelne lange Fasern sehen.
          quad(aUnten,d,c,bUnten,UNTERSICHT,UNTEN);
          if (zufall() > .45) {
            const spitze = P(mitte + (zufall() - .5) * .11,v+zurTraufe*(.10+zufall()*.15),lippe-abknick-.14-zufall()*.34);
            const faser = P(mitte,v,-.014-abknick), riss = P(mitte+.04,v,lippe-abknick-.02);
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
  traufe: number, schindelfarbe: Color, aussen: Punkt, splitter = false, verlauf = false,
): void {
  // Der Hauptsparren hängt am äußeren Ständer. Unter ihm liegt der abgescherte Gegenzug.
  if (verlauf) {
    baueBruchholz(dreieck,P(.177,traufe-.22,-.08),P(.381,boden+1.14,.16),.20,.13,321301,true,true);
    baueBruchholz(dreieck,P(.392,boden+.98,.17),P(.551,boden-.18,.43),.16,.10,321302,true,true);
    baueBruchholz(dreieck,P(.769,boden+1.12,-.19),P(.596,boden+.16,.39),.18,.14,321303,true,true);
    baueBruchholz(dreieck,P(.621,boden+.20,.32),P(.482,boden+.03,.66),.098,.12,321304,true,true);
    baueBruchholz(dreieck,P(.511,boden+.10,.34),P(.322,boden+.46,-.62),.13,.10,321305,true,true);
  } else {
    baueBruchholz(dreieck,P(.594,boden+.21,.12),P(.213,traufe-.26,-.06),.24,.21,318308,true,splitter);
    baueBruchholz(dreieck,P(.575,boden+.28,.18),P(.393,boden+1.47,.10),.118,.086,318309,true,splitter);
    baueBruchholz(dreieck,P(.741,boden+1.36,-.24),P(.475,boden+.35,.31),.215,.17,318310,true,splitter);
    baueBruchholz(dreieck,P(.649,boden+.25,.52),P(.332,boden+.65,-.44),.19,.15,318311,true,splitter);
    baueBruchholz(dreieck,P(.618,boden+.25,.23),P(.405,boden+.79,-.57),.10,.085,318312,true,splitter);
  }

  // Verkeilte Schalungsstücke in einer Mulde, am Mauerband enger gestaffelt.
  const zufall = mulberry(318037);
  for (let i = 0; i < (splitter ? 43 : 25); i++) {
    const lage = i % 5, stelle = Math.floor(i / 5);
    const t = splitter ? .28+zufall()*.455 : .28+stelle*.093+(zufall()-.5)*.083;
    const druck = verlauf ? bruchKantenabtrag(t) : 0;
    const h = boden + .14 + lage * .105 + Math.abs(t - .51) * .7 + (splitter ? zufall()*.14 : 0) - druck * .70;
    const v = .41 - lage * .162 + (zufall() - .5) * (splitter ? .47 : .22) + druck * .70;
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
