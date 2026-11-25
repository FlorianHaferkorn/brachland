/** D314: der Einsturzschutt bleibt Teil der Hausgeometrie. */
import { Color } from 'three';
import { mulberry } from './props.js';

type PunktXZ = readonly [number, number];
type Punkt = [number, number, number];
type Dreieck = (a: Punkt, b: Punkt, c: Punkt, farbe: Color) => void;

const ZIEGEL = ['#89634a', '#745440', '#a57a5a', '#8b6b50'].map(ton => new Color(ton));
const MAUER = ['#8a826f', '#aba18a', '#777366', '#938875'].map(ton => new Color(ton));
const HOLZ = ['#6c5540', '#866e55', '#594b3e'].map(ton => new Color(ton));
const BRUCH = new Color('#ba9e78');

/** Tangente und Außennormale sind waagerechte Einheitsvektoren. Ursprung liegt in der Mitte am Wandfuß. */
export function baueRuinenschutt(
  dreieck: Dreieck, ursprung: PunktXZ, tangente: PunktXZ, aussen: PunktXZ,
  hoeheAn: (x: number, z: number) => number, saat: number,
  gesperrt: (x: number, z: number) => boolean, zielbild = false,
): void {
  const zufall = mulberry(saat);
  const gespiegelt = tangente[0] * aussen[1] - tangente[1] * aussen[0] > 0;
  const welt = (u: number, v: number): PunktXZ =>
    [ursprung[0] + tangente[0] * u + aussen[0] * v, ursprung[1] + tangente[1] * u + aussen[1] * v];
  const flaeche: Dreieck = (a, b, c, farbe) => gespiegelt ? dreieck(a, c, b, farbe) : dreieck(a, b, c, farbe);
  const ton = (palette: readonly Color[]) => palette[Math.floor(zufall() * palette.length)];

  /** Der Radialfächer bildet Kantensplitter und die erhabene Mitte eines Stücks. */
  const stueck = (u: number, v: number, kontur: readonly PunktXZ[], winkel: number,
    dicke: number, ruecken: number, farbe: Color, bruchkante = false): void => {
    const cos = Math.cos(winkel), sin = Math.sin(winkel);
    const rand = kontur.map(([x,z]): PunktXZ => [u + x * cos - z * sin, v + x * sin + z * cos]);
    const frei = (x: number, z: number) => Math.abs(x) <= 1.64 && z >= .21 && z <= 2.24 && !gesperrt(...welt(x, z));
    if (!frei(u, v) || rand.some(([x,z], i) => {
      const [nx,nz] = rand[(i + 1) % rand.length];
      return !frei(x, z) || !frei((x + nx) * .5, (z + nz) * .5) || !frei((x + u) * .5, (z + v) * .5);
    })) return;

    const unten: Punkt[] = [], oben: Punkt[] = [];
    for (const [u,v] of rand) {
      const [x,z] = welt(u,v), y = hoeheAn(x,z);
      unten.push([x, y - .035, z]);
      oben.push([x, y + dicke * (.65 + zufall() * .7), z]);
    }
    const [x,z] = welt(u,v);
    const mitte: Punkt = [x, hoeheAn(x,z) + dicke + ruecken, z];
    const seitenton = farbe.clone().multiplyScalar(.66);
    for (let i = 0; i < rand.length; i++) {
      const j = (i + 1) % rand.length;
      flaeche(mitte, oben[i], oben[j], farbe);
      const kante = bruchkante && (i === 1 || i === 2) ? BRUCH : seitenton;
      flaeche(oben[j], oben[i], unten[i], kante);
      flaeche(oben[j], unten[i], unten[j], kante);
    }
  };

  // Zwei erkennbare Mauerbrocken halten die Silhouette des Haufens auch aus Spielhöhe.
  const mauerbruch: readonly PunktXZ[] = [[-.29, -.13], [.09, -.22], [.28, -.09], [.19, .15], [-.15, .20]];
  stueck(-.46, .61, mauerbruch, .23, .15, .22, MAUER[0]);
  stueck(.25, .72, mauerbruch, -.52, .12, .16, MAUER[1]);

  // Große Bruchstücke liegen konzentriert unten, kleinere Ziegelscherben reichen weiter heraus.
  for (let i = 0; i < 22; i++) {
    const u = (zufall() + zufall() - 1) * 1.38;
    const v = .46 + zufall() ** 1.5 * 1.06;
    const radius = .08 + zufall() ** 1.7 * .19;
    const kanten = 4 + Math.floor(zufall() * 3);
    const kontur = Array.from({ length: kanten }, (_, j): PunktXZ => {
      const winkel = j / kanten * Math.PI * 2;
      const r = radius * (.67 + zufall() * .46);
      return [Math.cos(winkel) * r, Math.sin(winkel) * r * .81];
    });
    stueck(u, v, kontur, zufall() * Math.PI, radius * .40, radius * .67, ton(MAUER));
  }
  for (let i = 0; i < 32; i++) {
    const u = (zufall() + zufall() - 1) * 1.55;
    const v = .53 + zufall() ** 1.5 * 1.51;
    const laenge = .09 + zufall() * .23, breite = .08 + zufall() * .14;
    const kontur: PunktXZ[] = [[-.5 * laenge, -.5 * breite], [.43 * laenge, -.45 * breite],
      [.5 * laenge, .08 * breite], [.26 * laenge, .5 * breite], [-.47 * laenge, .31 * breite]];
    stueck(u, v, kontur, zufall() * Math.PI, .032, .025 + zufall() * .045, ton(ZIEGEL));
  }

  // Die gebrochenen Enden liegen oben auf dem Schutt und zeigen frischere Holzfasern.
  for (const [u,v,laenge,winkel] of [[-.49,.86,1.26,-.49], [.25,1.06,1.02,.53], [.58,.69,.76,-.32]]) {
    const halb = laenge * .5;
    const kontur: PunktXZ[] = [[-halb, -.061], [halb * .83, -.068], [halb, -.027], [halb * .70, .071], [-halb, .064]];
    stueck(u, v, kontur, winkel, .065, .06, ton(HOLZ), true);
  }
  if (zielbild) {
    const schindel: readonly PunktXZ[] = [[-.25,-.20],[.28,-.14],[.24,.09],[.05,.19],[-.20,.14]];
    const grauholz = new Color('#514b41');
    const verwittert = new Color('#71675a');
    for (const [u,v,w,dicke] of [[-.38,.41,-.46,.17],[.07,.41,.31,.16],[-.27,.96,.67,.09],
      [-.60,1.23,1.37,.09],[.49,.59,-.71,.13],[.21,1.24,1.25,.036]]) {
      stueck(u, v, schindel, w, dicke, .044, dicke > .10 ? grauholz : verwittert);
    }
  }
}
