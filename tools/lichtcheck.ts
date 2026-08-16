/**
 * Wie hell kommt der Wald tatsächlich an?
 *
 * Der Anlass ist eine Rückmeldung („teilweise sehr dunkel"), die bisher unbeantwortet
 * im Ledger stand. Das Problem an so einer Rückmeldung ist, dass jede Antwort darauf
 * ein Gefühl gegen ein Gefühl setzt: Ich sehe die Szene auf einem anderen Bildschirm
 * als Flo, und wer an den Lichtwerten dreht, verschiebt zwangsläufig auch alles
 * andere. Also erst rechnen, dann drehen.
 *
 * Gerechnet wird die **Bildschirmhelligkeit eines Pixels** — also der ganze Weg:
 *
 *   Albedo → Bestrahlung (Hemisphere + Sonne) → Lambert → ACES → sRGB → Nebel
 *
 * in genau der Reihenfolge, in der three.js ihn im Fragment-Shader durchläuft. Der
 * Nebel kommt **nach** dem Tone Mapping und nach der Farbraumwandlung; das ist keine
 * Feinheit, sondern der Grund, warum ferner Wald anders reagiert als naher.
 *
 * Grenzwerte (relative Leuchtdichte Y nach sRGB, 0…1):
 *   < 0,04   auf einem Handy im Freien nicht mehr von Schwarz zu unterscheiden
 *   < 0,10   erkennbar, aber ohne Binnenzeichnung — „eine dunkle Wand"
 *   0,10…0,45 der brauchbare Bereich
 *
 * `npm run licht`
 */
import { STIMMUNG, HEMI_BODEN } from '../src/scenes/RegionsSzene.js';
import { BIOM_FARBE } from '../src/world/terrain.js';
import { BAUM } from '../src/world/baum.js';

// ---- Farbe -----------------------------------------------------------------

/** Hex nach linearem RGB. three.js liest Materialfarben als sRGB und rechnet linear. */
function linear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const kanal = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return [kanal((n >> 16) & 255), kanal((n >> 8) & 255), kanal(n & 255)];
}

/** Linear zurück nach sRGB — der Wert, der im Bildspeicher landet. */
function srgb(v: number): number {
  const c = Math.max(0, Math.min(1, v));
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** Relative Leuchtdichte nach Rec. 709 — das, was das Auge als „hell" liest. */
function leuchtdichte(rgb: [number, number, number]): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/**
 * ACES-Filmic, wie three.js es in `ACESFilmicToneMapping` implementiert.
 *
 * Nachgebaut statt approximiert: Die Kurve drückt die Mitten spürbar, und genau in
 * den Mitten liegt der Wald. Eine „ungefähr wie ACES"-Kurve würde die Aussage des
 * ganzen Werkzeugs verfälschen.
 */
function aces(x: number, belichtung: number): number {
  const v = x * belichtung / 0.6;
  const a = 0.0245786, b = 0.000090537, c = 0.983729, d = 0.4329510, e = 0.238081;
  // RRT + ODT fit, auf einen Kanal reduziert (three.js rechnet ihn kanalweise).
  const y = (v * (v + a) - b) / (v * (c * v + d) + e);
  return Math.max(0, Math.min(1, y));
}

// ---- Beleuchtungsmodell ----------------------------------------------------

const OBEN: [number, number, number] = [0, 1, 0];
/**
 * Zweite Farbe der Hemisphere-Lichtquelle.
 *
 * Aus der Szene importiert, nicht abgeschrieben: Eine Kopie hier hätte genau die
 * Drift erzeugt, gegen die dieses Werkzeug messen soll.
 */
const BODENFARBE = HEMI_BODEN;

function normiere(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function punkt(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Bestrahlungsstärke an einer Fläche mit Normale `n`.
 *
 * `imSchatten` schaltet nur die Sonne ab — genau das macht die Schattenkarte auch.
 * Die Hemisphere-Lichtquelle kennt keine Verdeckung, und das ist die entscheidende
 * Eigenschaft für diese Messung: Unter einem Kronendach ist in three.js nichts
 * dunkler als auf der Wiese, außer die Sonne fehlt.
 */
function bestrahlung(
  s: typeof STIMMUNG[string], n: [number, number, number], imSchatten: boolean,
): [number, number, number] {
  const himmel = linear(s.umgebung), boden = linear(BODENFARBE);
  const gewicht = 0.5 * punkt(n, OBEN) + 0.5;
  const hemi: [number, number, number] = [
    (boden[0] + (himmel[0] - boden[0]) * gewicht) * s.umgebungStaerke,
    (boden[1] + (himmel[1] - boden[1]) * gewicht) * s.umgebungStaerke,
    (boden[2] + (himmel[2] - boden[2]) * gewicht) * s.umgebungStaerke,
  ];
  if (imSchatten) return hemi;

  const richtung = normiere(s.sonnenstand as unknown as [number, number, number]);
  const dotNL = Math.max(0, punkt(n, richtung));
  const sonne = linear(s.sonne);
  return [
    hemi[0] + sonne[0] * s.sonneStaerke * dotNL,
    hemi[1] + sonne[1] * s.sonneStaerke * dotNL,
    hemi[2] + sonne[2] * s.sonneStaerke * dotNL,
  ];
}

/** Ein Pixel von der Materialfarbe bis zum Bildspeicher. */
function pixel(
  s: typeof STIMMUNG[string], farbe: string, n: [number, number, number],
  imSchatten: boolean, abstand = 0,
): number {
  const albedo = linear(farbe);
  const e = bestrahlung(s, n, imSchatten);
  // Lambert. Der Faktor 1/π ist in three.js in der Lichtstärke aufgehoben —
  // weggelassen, weil sonst jede Szene um denselben Betrag zu dunkel gerechnet wird.
  const licht: [number, number, number] = [albedo[0] * e[0], albedo[1] * e[1], albedo[2] * e[2]];
  const nachTon = licht.map(v => srgb(aces(v, s.belichtung))) as [number, number, number];

  if (abstand <= 0) return leuchtdichte(nachTon);

  // Nebel wird NACH der Farbraumwandlung gemischt (`<fog_fragment>` steht hinter
  // `<colorspace_fragment>`) — also im sRGB-Raum, gegen die rohe Nebelfarbe.
  const t = Math.max(0, Math.min(1, (abstand - s.nebelNah) / (s.nebelFern - s.nebelNah)));
  const nebel = linear(s.nebel).map(srgb) as [number, number, number];
  return leuchtdichte([
    nachTon[0] + (nebel[0] - nachTon[0]) * t,
    nachTon[1] + (nebel[1] - nachTon[1]) * t,
    nachTon[2] + (nebel[2] - nachTon[2]) * t,
  ]);
}

// ---- Messung ---------------------------------------------------------------

/**
 * Normalen je Materialart.
 *
 * Boden liegt flach — eine Normale genügt. Laub und Stämme werden aus allen
 * Richtungen gesehen, und eine **einzelne** Facette ist eine irreführende Probe:
 * Beim ersten Lauf standen Fichtennadeln bei 0,012, weil die gewählte Facette
 * zufällig von der Sonne wegzeigte. Gemittelt wird deshalb über acht Richtungen
 * rund um die Hochachse — das ist es, was das Auge auf einer Krone sieht.
 */
const FLACH_N: [number, number, number][] = [[0, 1, 0]];
const RUNDUM_N: [number, number, number][] = Array.from({ length: 8 }, (_, i) => {
  const w = (i / 8) * Math.PI * 2;
  return normiere([Math.cos(w), 0.55, Math.sin(w)]);
});
const SENKRECHT_N: [number, number, number][] = Array.from({ length: 8 }, (_, i) => {
  const w = (i / 8) * Math.PI * 2;
  return normiere([Math.cos(w), 0.12, Math.sin(w)]);
});

const PROBEN: { was: string; farbe: string; ns: [number, number, number][] }[] = [
  { was: 'Waldboden',        farbe: String(BIOM_FARBE.wald),     ns: FLACH_N },
  { was: 'Wiese',            farbe: String(BIOM_FARBE.wiese),    ns: FLACH_N },
  { was: 'Fels',             farbe: String(BIOM_FARBE.fels),     ns: FLACH_N },
  { was: 'Fichtennadel',     farbe: BAUM.fichte.laubFarbe,       ns: RUNDUM_N },
  { was: 'Fichte hell',      farbe: BAUM.fichte.laubFarbe2,      ns: RUNDUM_N },
  { was: 'Buchenlaub',       farbe: BAUM.buche.laubFarbe,        ns: RUNDUM_N },
  { was: 'Stamm (Fichte)',   farbe: BAUM.fichte.stammFarbe,      ns: SENKRECHT_N },
];

/** Mittel über die Normalen einer Probe. */
function mittel(
  s: typeof STIMMUNG[string], farbe: string, ns: [number, number, number][],
  imSchatten: boolean, abstand = 0,
): number {
  let summe = 0;
  for (const n of ns) summe += pixel(s, farbe, n, imSchatten, abstand);
  return summe / ns.length;
}

const DUNKEL = 0.04, FLACH = 0.10, HELL = 0.45;

function urteil(y: number): string {
  if (y < DUNKEL) return '■ schwarz';
  if (y < FLACH) return '▪ flach';
  if (y > HELL) return '□ zu hell';
  return '· ok';
}

console.log('Bildschirmhelligkeit — relative Leuchtdichte Y nach sRGB\n');
console.log(`  Grenzen: < ${DUNKEL} nicht von Schwarz zu trennen · < ${FLACH} ohne Binnenzeichnung`);
console.log('  „Schatten" heißt: Sonne verdeckt, Hemisphere bleibt (so rechnet three.js)\n');

const namen = Object.keys(STIMMUNG);
let dunkelZaehler = 0, flachZaehler = 0;

for (const name of namen) {
  const s = STIMMUNG[name];
  console.log(`── ${name}  (Belichtung ${s.belichtung.toFixed(2)}, Sonne ${s.sonneStaerke}, Umgebung ${s.umgebungStaerke})`);
  console.log('   Material            besonnt          im Schatten      Verhältnis');
  for (const p of PROBEN) {
    const hell = mittel(s, p.farbe, p.ns, false);
    const dunkel = mittel(s, p.farbe, p.ns, true);
    if (dunkel < DUNKEL) dunkelZaehler++;
    else if (dunkel < FLACH) flachZaehler++;
    console.log(`   ${p.was.padEnd(18)} ${hell.toFixed(3)} ${urteil(hell).padEnd(11)}`
              + ` ${dunkel.toFixed(3)} ${urteil(dunkel).padEnd(11)}`
              + ` ${(hell / Math.max(1e-6, dunkel)).toFixed(1)}x`);
  }

  // Die Frage, die zählt: Kann man im beschatteten Wald Baum von Boden trennen?
  const bodenS = mittel(s, String(BIOM_FARBE.wald), FLACH_N, true);
  const nadelS = mittel(s, BAUM.fichte.laubFarbe, RUNDUM_N, true);
  const kontrast = (Math.max(bodenS, nadelS) + 0.05) / (Math.min(bodenS, nadelS) + 0.05);
  console.log(`   → Kontrast Boden gegen Nadel im Schatten: ${kontrast.toFixed(2)}:1`
            + (kontrast < 1.3 ? '   ⚠ eine Masse, keine zwei Dinge' : ''));

  // Und: verschwindet der Wald auf Entfernung im Nebel oder im Schwarz?
  for (const d of [40, 120, 300]) {
    const y = mittel(s, BAUM.fichte.laubFarbe, RUNDUM_N, true, d);
    process.stdout.write(`   ${d} m: ${y.toFixed(3)} ${urteil(y)}   `);
  }
  console.log('\n');
}

console.log(`Summe über alle Stimmungen: ${dunkelZaehler} Proben unter ${DUNKEL} (schwarz),`
          + ` ${flachZaehler} unter ${FLACH} (flach).`);
console.log('Was hier „schwarz" ist, ist es auf dem Gerät auch — die Rechnung enthält');
console.log('Tone Mapping und Belichtung, also genau die Schalter, die das sonst kaschieren.');
console.log('');
console.log('Was diese Rechnung NICHT enthält:');
console.log('  · das Silhouettenlicht (Fresnel, `windmaterial.ts`) — es sitzt auf der');
console.log('    Kante, nicht auf der Fläche, und trägt bei `nacht` mit randStaerke 0,30');
console.log('    den größten Teil der Trennung. Der Kontrastwert für die Nacht ist');
console.log('    deshalb eine Untergrenze, nicht das fertige Bild.');
console.log('  · die ACES-Farbmatrizen. Für die Leuchtdichte ist der Unterschied klein,');
console.log('    für den Farbton nicht — Farbaussagen gehören in den Browser, nicht hierher.');
