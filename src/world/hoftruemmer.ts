/** D318: ineinander verkeilte Dachreste im Obergeschoss von Haus 308. */
import { Color } from 'three';
import type { HausQuad } from './hausbauteil.js';
import { baueBruchholz } from './bruchholz.js';
import { mulberry } from './props.js';

type Punkt = [number, number, number];
type Dreieck = (a: Punkt, b: Punkt, c: Punkt, farbe: Color) => void;
type Fassadenpunkt = (anteil: number, hoehe: number, tiefe: number) => Punkt;
const SCHNITT = new Color('#625548');
const UNTERSICHT = new Color('#3b3328');
const OBEN: Punkt = [0, 1, 0];

export function baueTruemmerkeil(
  dreieck: Dreieck, quad: HausQuad, P: Fassadenpunkt, wandLaenge: number, boden: number,
  traufe: number, schindelfarbe: Color, aussen: Punkt,
): void {
  // Der Hauptsparren hängt am äußeren Ständer. Unter ihm liegt der abgescherte Gegenzug.
  baueBruchholz(dreieck,P(.594,boden+.21,.12),P(.213,traufe-.26,-.06),.24,.21,318308,true);
  baueBruchholz(dreieck,P(.575,boden+.28,.18),P(.393,boden+1.47,.10),.118,.086,318309,true);
  baueBruchholz(dreieck,P(.741,boden+1.36,-.24),P(.475,boden+.35,.31),.215,.17,318310,true);
  baueBruchholz(dreieck,P(.649,boden+.25,.52),P(.332,boden+.65,-.44),.19,.15,318311,true);
  baueBruchholz(dreieck,P(.618,boden+.25,.23),P(.405,boden+.79,-.57),.10,.085,318312,true);

  // Verkeilte Schalungsstücke in einer Mulde, am Mauerband enger gestaffelt.
  const zufall = mulberry(318037);
  for (let i = 0; i < 25; i++) {
    const lage = i % 5, stelle = Math.floor(i / 5);
    const t = .28 + stelle * .093 + (zufall() - .5) * .083;
    const h = boden + .14 + lage * .105 + Math.abs(t - .51) * .7;
    const v = .41 - lage * .162 + (zufall() - .5) * .22;
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
