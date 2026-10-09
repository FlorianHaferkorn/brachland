/**
 * BRACHLAND — Fernland: die Berge jenseits der Region.
 *
 * ## Das Problem, das es löst
 *
 * Die Region ist ein 4-km-Kasten aus dem Inntal. An drei von vier Kanten ist
 * das **kein natürlicher Abschluss**: Im Westen liegen die Randhöhen bei
 * 848–1134 m — eine Bergflanke auf halber Höhe, die real zum Wendelstein
 * (1838 m) weitersteigt. Bis heute endete dort eine freischwebende 0,9-m-Kante,
 * dahinter `scene.background = null`, also leerer Dunst (G-101).
 *
 * Gezeichnet wird jetzt echtes Gelände aus `tools/fernland.ts` — grob (125 m
 * Zellweite), aber nicht erfunden.
 *
 * ## Drei Dinge, die dabei anders sind als beim Nahgelände
 *
 * **1. Kein Nebel, kein Licht, kein Tone Mapping.** Der Szenennebel endet je nach
 * Stimmung bei 240–420 m. Alles dahinter ist zu 100 % Nebelfarbe — ein Fernland
 * unter diesem Nebel wäre eine einfarbige Fläche. Deshalb `fog: false` und ein
 * **eingebackener Dunst**: Je weiter und je tiefer, desto stärker zur
 * Horizontfarbe gemischt. Das ist, was ein gemalter Prospekt tut.
 *
 * Gemalt heisst aber auch: Die Farbe muss **so ins Bild, wie sie gemalt wurde**.
 * Die erste Fassung nahm ein `MeshStandardMaterial`, und der Renderer hat den
 * Dunst mit dem Szenenlicht multipliziert — aus 0,23 wurde 0,04, aus der
 * Kulisse eine schwarze Wand vor einem fast schwarzen Himmel. Deshalb jetzt
 * eingebackene Beleuchtung und ein roher Shader, genau wie `himmel.ts` einen
 * hat. Beide enden am Horizont bei derselben Dunstfarbe; also müssen beide
 * denselben Weg ins Bild nehmen, sonst klebt die Kulisse als Silhouette davor.
 *
 * **2. Keine LOD, kein Culling nach Entfernung.** Das Fernland ist der Horizont;
 * es ist per Definition immer weit weg und immer sichtbar. Ein Kachelraster
 * darüber wäre Verwaltung ohne Gewinn. Der Posten ist **ein** Draw Call; zum
 * Vergleich: gemessen 254–353 Calls und bis 276.000 Dreiecke im Bild (G-104).
 *
 * **3. Die Region wird ausgespart — und zwar exakt.** Wo das feine Gelände steht,
 * hätte das grobe nichts zu suchen. Zellen ganz innerhalb fallen weg. Bei den
 * Randzellen reicht das aber nicht: Eine Zelle ist 125 m breit, die Region wird
 * am Rand mit 10,4 m abgetastet, und in einer Bergflanke unterscheiden sich beide
 * Abtastungen um mehrere Dutzend Meter. Ein einfaches „Randzellen stehenlassen"
 * hätte also einen 125 m breiten groben Streifen quer über das feine Gelände
 * gelegt — genau in dem Bereich, den der Spieler am Rand aus nächster Nähe sieht.
 *
 * Der erste Versuch schob deshalb die Eckpunkte der Randzellen auf die
 * Regionskante. Das war zu wenig: Die geschobenen Punkte stehen im **groben**
 * Abstand von 125 m, und zwischen zweien lag eine gerade Sehne gegen ein
 * Gelände, das alle 10,4 m einen neuen Wert hat.
 *
 * Jetzt läuft ein eigener **Nahtstreifen** um die Region: innen im Raster der
 * Region abgetastet, außen auf den groben Gitterknoten, verbunden über die
 * Vereinigung beider Parameterlisten. Gemessen Knoten gegen Knoten — nicht per
 * Strahl, siehe unten — liegen alle **4.980 Nahtpunkte bei Δ = 0,0000 m**.
 *
 * ## Warum hier Knoten gegen Knoten gemessen wird
 *
 * Ein Strahlentest von oben vergleicht eine interpolierte Fläche gegen
 * `hoeheAn`, und `hoeheAn` ist ein **nächster Nachbar**. An der Ostkante fällt
 * das Gelände bei z ≈ 512 real von 511 auf 461 m ü. NN — 50 m auf 21 m. Dort
 * unterscheiden sich die beiden Verfahren um mehr als jede echte Fuge, und mein
 * erster Bericht führte deshalb einen „Ausreißer von 19 m", den es nicht gibt.
 */
import * as THREE from 'three';
import type { BBox, Weltdaten } from './osm.js';
import { MASSSTAB } from './terrain.js';

/** Wie in `terrain.ts`. Dieselbe Zahl, sonst wandert die Naht. */
const METER_JE_GRAD = 111_320;

export interface Fernland {
  bbox: BBox;
  aufloesung: number;
  hoehen: (number | null)[][];
  quelle: string;
}

/**
 * Farbe nach Höhe — dasselbe knappe Vokabular wie in der Nähe, nur ohne Detail.
 *
 * Drei Bänder, weil man aus 3 km nicht mehr unterscheiden kann: Wald bis zur
 * Baumgrenze, Fels darüber, Firn ganz oben. Die Grenzen sind für die
 * Nordalpen gesetzt (Baumgrenze rund 1.700 m), nicht geraten.
 */
function bergfarbe(h: number, ziel: THREE.Color): THREE.Color {
  if (h < 1000) return ziel.setRGB(0.13, 0.17, 0.13);
  if (h < 1700) return ziel.setRGB(0.16, 0.18, 0.15);
  if (h < 2100) return ziel.setRGB(0.29, 0.28, 0.26);
  return ziel.setRGB(0.52, 0.53, 0.55);
}

/**
 * Fernland-Geometrie bauen.
 *
 * `horizont` ist die Dunstfarbe der aktuellen Stimmung — dieselbe, die
 * `himmel.ts` am Horizont zeichnet. Ohne sie stünde das Fernland als harter
 * Fremdkörper vor dem Himmel.
 */
export interface FernLicht {
  /** Horizontfarbe der Stimmung. Ziel des eingebackenen Dunstes. */
  dunst: THREE.ColorRepresentation;
  sonne: THREE.ColorRepresentation;
  sonneStaerke: number;
  umgebung: THREE.ColorRepresentation;
  umgebungStaerke: number;
  sonnenstand: readonly [number, number, number];
}

export function baueFernland(
  fern: Fernland, welt: Weltdaten, licht: FernLicht,
): THREE.BufferGeometry | null {
  const [fs, fw, fn, fe] = fern.bbox;
  const [rs, rw, rn, re] = welt.bbox;
  const n = fern.aufloesung;

  // Weltmaße der **Region** — das Koordinatensystem, in dem die Szene rechnet.
  // 111.320 ist dieselbe Konstante wie in `baueTerrain`; eine eigene Zahl hier
  // würde die Naht um Meter verschieben, ohne dass man den Grund fände.
  const mLat = (rs + rn) / 2;
  const regBreite = (re - rw) * METER_JE_GRAD * Math.cos(mLat * Math.PI / 180);
  const regTiefe = (rn - rs) * METER_JE_GRAD;
  /** Geografische Koordinate in Szenenmeter, Region zentriert um (0,0). */
  const zuWelt = (lat: number, lon: number): [number, number] => [
    ((lon - rw) / (re - rw) - 0.5) * regBreite,
    ((rn - lat) / (rn - rs) - 0.5) * regTiefe,
  ];

  const latVon = (i: number) => fn - (fn - fs) * (i / (n - 1));
  const lonVon = (j: number) => fw + (fe - fw) * (j / (n - 1));

  /**
   * Höhe in Szeneneinheiten — **dieselbe Rechnung wie `baueTerrain`**.
   *
   * Das Nahgelände zieht `hoeheMin` ab und überhöht um 1,15. Ein Fernland ohne
   * diese beiden Schritte stünde 460 m zu hoch und wäre am Rand um 15 % flacher
   * als das Gelände, an das es anschliesst.
   */
  const zuHoehe = (h: number) =>
    (h - welt.hoeheMin) * MASSSTAB.ueberhoehung / MASSSTAB.stauchung;

  /** Fernhöhe an beliebiger Stelle, bilinear. Auf den Gitterlinien exakt linear. */
  const fernBei = (lat: number, lon: number): number => {
    const fi = Math.max(0, Math.min(n - 1, ((fn - lat) / (fn - fs)) * (n - 1)));
    const fj = Math.max(0, Math.min(n - 1, ((lon - fw) / (fe - fw)) * (n - 1)));
    const i0 = Math.floor(fi), j0 = Math.floor(fj);
    const i1 = Math.min(n - 1, i0 + 1), j1 = Math.min(n - 1, j0 + 1);
    const ti = fi - i0, tj = fj - j0;
    const h = (i: number, j: number) => fern.hoehen[i]?.[j] ?? welt.hoeheMin;
    return (h(i0, j0) * (1 - tj) + h(i0, j1) * tj) * (1 - ti)
         + (h(i1, j0) * (1 - tj) + h(i1, j1) * tj) * ti;
  };

  /**
   * Höhe aus dem **feinen** Höhenfeld der Region.
   *
   * Nächster Nachbar mit Absicht: Die Nahtpunkte liegen genau auf den
   * Rasterknoten der Region, und dort liefert der nächste Nachbar exakt den
   * Wert, den `baueTerrain` für seinen Kantenvertex verwendet. Bilinear wäre
   * hier ungenauer, nicht genauer. Lücken werden wie dort mit dem Mittel
   * gefüllt — sonst klaffte die Naht genau da, wo das DEM ein Loch hat.
   */
  const rn1 = welt.aufloesung - 1;
  const gueltig = welt.hoehen.flat().filter(v => !Number.isNaN(v));
  const mittel = gueltig.reduce((a, b) => a + b, 0) / Math.max(1, gueltig.length);
  const feineHoehe = (lat: number, lon: number): number => {
    const i = Math.max(0, Math.min(rn1, Math.round(((rn - lat) / (rn - rs)) * rn1)));
    const j = Math.max(0, Math.min(rn1, Math.round(((lon - rw) / (re - rw)) * rn1)));
    const h = welt.hoehen[i]?.[j];
    return h === undefined || Number.isNaN(h) ? mittel : h;
  };

  const dunst = new THREE.Color(licht.dunst);
  /**
   * Beleuchtung wird **eingebacken**, nicht vom Renderer gerechnet.
   *
   * Der Grund steht im Kopf der Datei: Die Kulisse wird wie der Himmel roh
   * geschrieben, ohne Licht, Tone Mapping und Farbraumwandlung — nur so trifft
   * ihr Dunst genau das Dunstband, an das sie anschliesst. Ein Standardmaterial
   * hätte den gemalten Dunst mit dem Szenenlicht multipliziert und aus 0,23
   * eine 0,04 gemacht: aus der Kulisse wäre eine schwarze Wand geworden.
   *
   * Gerechnet wird ein Lambert-Term gegen dieselbe Sonnenrichtung, die auch das
   * Nahgelände beleuchtet, plus dieselbe Umgebungsfarbe — mit demselben 1/π wie der Renderer. Damit steht die Ferne
   * im gleichen Licht wie die Nähe, ohne dass ein Lichtmodell zweimal läuft.
   */
  // D202: durch π — three.js rechnet Lambert als `Bestrahlung · Albedo / π` (`BRDF_Lambert` in
  // `common.glsl.js`), und Sonne wie Hemisphäre gehen ohne π-Ausgleich in die Szene. Ohne diesen
  // Faktor stand die Kulisse π-mal heller als das Nahgelände; seit `zielbild` die Sonne auf 3,2
  // verdoppelte (D172), brannte der Fernberg weiss aus (Felsmulde-Kamera, 07.10.2026).
  const sonnenLicht = new THREE.Color(licht.sonne).multiplyScalar(licht.sonneStaerke / Math.PI);
  const grundLicht = new THREE.Color(licht.umgebung).multiplyScalar(licht.umgebungStaerke / Math.PI);
  const sonnenRichtung = new THREE.Vector3(...licht.sonnenstand).normalize();
  const beleuchtet = new THREE.Color();
  const farbe = new THREE.Color();
  const positionen: number[] = [];
  const farben: number[] = [];
  /** D207: der klare (undunstige) Anteil der Farbe, den das Mosaik im Shader abwandeln darf. */
  const klar: number[] = [];

  /** Ein Punkt: Szenenkoordinaten plus die echte Höhe ü. NN für Farbe und Dunst. */
  type Punkt = readonly [number, number, number, number];
  const punktFern = (lat: number, lon: number): Punkt => {
    const h = fernBei(lat, lon), [x, z] = zuWelt(lat, lon);
    return [x, zuHoehe(h), z, h];
  };
  const punktNah = (lat: number, lon: number): Punkt => {
    const h = feineHoehe(lat, lon), [x, z] = zuWelt(lat, lon);
    return [x, zuHoehe(h), z, h];
  };

  function schiebe(v: Punkt) {
    positionen.push(v[0], v[1], v[2]);
    bergfarbe(v[3], farbe);
    farbe.multiply(beleuchtet);
    /**
     * Dunst einbacken: nach **Entfernung von der Regionsmitte** und nach Höhe.
     * Weit und tief verschwindet zuerst — das ist die Staffelung, an der man
     * Entfernung überhaupt liest. Der Spieler bewegt sich nur innerhalb von
     * 2 km, deshalb reicht die Entfernung zur Mitte; eine Rechnung je Bild wäre
     * ein Shader für einen unsichtbaren Gewinn.
     */
    const weit = Math.hypot(v[0], v[2]);
    const nachEntfernung = Math.min(1, Math.max(0, (weit - 1400) / 4200));
    const nachHoehe = Math.min(1, Math.max(0, (1100 - v[3]) / 900));
    const anteil = Math.min(0.92, 0.30 + nachEntfernung * 0.45 + nachHoehe * 0.30);
    // Mosaik nur im Tal und an Waldhängen, oben (Fels, Firn) nicht.
    const tal = 1 - 0.7 * Math.min(1, Math.max(0, (v[3] - 1000) / 700));
    const rest = (1 - anteil) * tal;
    klar.push(farbe.r * rest, farbe.g * rest, farbe.b * rest);
    farbe.lerp(dunst, anteil);
    farben.push(farbe.r, farbe.g, farbe.b);
  }

  /**
   * Ein Dreieck, dessen Normale garantiert nach oben zeigt.
   *
   * Der Umlaufsinn wird **gerechnet, nicht gesetzt**: Am 26.08.2026 stand hier
   * eine von Hand gewählte Reihenfolge mit der Normale nach unten. Bei
   * `side: FrontSide` heisst das unsichtbar — und die Messung zeigte trotzdem
   * +1 Objekt, +1 Aufruf und 16.128 Dreiecke, weil Backface-Culling erst im
   * Rasterizer greift. Vier Kantenstreifen mit je eigener Orientierung wären
   * vier weitere Gelegenheiten für denselben Fehler.
   */
  function dreieckOben(p: Punkt, q: Punkt, r: Punkt) {
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2];
    const vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const laenge = Math.hypot(nx, ny, nz) || 1;
    const dreh = ny < 0;
    const w = (dreh ? -1 : 1) / laenge;
    nx *= w; ny *= w; nz *= w;
    // Flachschattierung: ein Lambert-Wert je Dreieck, kein Verlauf über die Ecken.
    const lam = Math.max(0, nx * sonnenRichtung.x + ny * sonnenRichtung.y + nz * sonnenRichtung.z);
    beleuchtet.setRGB(
      grundLicht.r + sonnenLicht.r * lam,
      grundLicht.g + sonnenLicht.g * lam,
      grundLicht.b + sonnenLicht.b * lam,
    );
    schiebe(p);
    if (dreh) { schiebe(r); schiebe(q); } else { schiebe(q); schiebe(r); }
  }
  const viereck = (a: Punkt, b: Punkt, c: Punkt, d: Punkt) => {
    dreieckOben(a, b, c); dreieckOben(a, c, d);
  };

  /**
   * Die Gitterlinien, die die Region gerade noch einschliessen.
   *
   * Alles innerhalb dieses Rechtecks überlässt das grobe Raster dem Nahtstreifen;
   * alle Zellen darin fallen weg. Vorher waren nur die *vollständig* innerhalb
   * liegenden Zellen weggefallen und die Randzellen wurden auf die Kante
   * gezogen — im Median passte das (Δ 0,0 m), aber zwischen zwei geschobenen
   * Ecken lag eine 125-m-Sehne gegen ein 10-m-Gelände, und die wich bis 40 m ab.
   */
  let iN = 0, iS = n - 1, jW = 0, jO = n - 1;
  for (let i = 0; i < n; i++) if (latVon(i) >= rn) iN = i;
  for (let i = n - 1; i >= 0; i--) if (latVon(i) <= rs) iS = i;
  for (let j = 0; j < n; j++) if (lonVon(j) <= rw) jW = j;
  for (let j = n - 1; j >= 0; j--) if (lonVon(j) >= re) jO = j;

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      if (i >= iN && i < iS && j >= jW && j < jO) continue;
      viereck(
        punktFern(latVon(i), lonVon(j)),
        punktFern(latVon(i), lonVon(j + 1)),
        punktFern(latVon(i + 1), lonVon(j + 1)),
        punktFern(latVon(i + 1), lonVon(j)),
      );
    }
  }

  /**
   * Nahtstreifen zwischen Regionskante und der ersten groben Gitterlinie.
   *
   * Beide Ränder werden über **denselben** Parameter t abgetastet, und die
   * Liste der t-Werte ist die Vereinigung aus beiden Rastern: dem feinen der
   * Region (damit die Innenkante Knoten für Knoten auf dem Gelände sitzt) und
   * den groben Gitterknoten (damit die Aussenkante die Fernlandzellen exakt
   * trifft). Fehlte eines der beiden, risse an dieser Stelle ein Spalt.
   */
  function streifen(
    innen: (t: number) => Punkt, aussen: (t: number) => Punkt, grob: number[],
  ) {
    const ts = new Set<number>(grob);
    for (let k = 0; k <= rn1; k++) ts.add(k / rn1);
    const liste = [...ts].sort((a, b) => a - b);
    for (let k = 0; k < liste.length - 1; k++) {
      const t0 = liste[k], t1 = liste[k + 1];
      viereck(aussen(t0), aussen(t1), innen(t1), innen(t0));
    }
  }

  /** t-Werte der groben Knoten zwischen zwei Indizes, auf 0…1 normiert. */
  const grobT = (von: number, bis: number) =>
    Array.from({ length: bis - von + 1 }, (_, k) => k / (bis - von));

  const nordAussen = latVon(iN), suedAussen = latVon(iS);
  const westAussen = lonVon(jW), ostAussen = lonVon(jO);
  const misch = (a: number, b: number, t: number) => a + (b - a) * t;

  // Nord und Süd laufen in der Länge, West und Ost in der Breite. Die Ecken
  // teilen sich Punkt für Punkt, weil beide Streifen dort bei t = 0 bzw. t = 1
  // dieselben vier Koordinaten einsetzen — deshalb klafft dort nichts.
  streifen(
    t => punktNah(rn, misch(rw, re, t)),
    t => punktFern(nordAussen, misch(westAussen, ostAussen, t)),
    grobT(jW, jO));
  streifen(
    t => punktNah(rs, misch(rw, re, t)),
    t => punktFern(suedAussen, misch(westAussen, ostAussen, t)),
    grobT(jW, jO));
  streifen(
    t => punktNah(misch(rn, rs, t), rw),
    t => punktFern(misch(nordAussen, suedAussen, t), westAussen),
    grobT(iN, iS));
  streifen(
    t => punktNah(misch(rn, rs, t), re),
    t => punktFern(misch(nordAussen, suedAussen, t), ostAussen),
    grobT(iN, iS));

  if (!positionen.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  geo.setAttribute('klar', new THREE.Float32BufferAttribute(klar, 3));
  // Keine Normalen: Das Material rechnet kein Licht, die Schattierung steckt
  // bereits in der Farbe. Ein Normalenattribut wäre 230 KB toter Speicher.
  return geo;
}

/**
 * Material für das Fernland: die gemalte Farbe ohne Licht und ohne Nebel ins Bild.
 *
 * Kein Licht und kein Nebel — die Schattierung steckt in der Farbe, der Dunst
 * auch. Tone Mapping und Farbraumwandlung dagegen **schon**, und zwar genau die
 * beiden Zeilen, die auch `himmel.ts` trägt. Das ist die Bedingung dafür, dass
 * die Kulisse am Horizont in den Himmel übergeht statt als Silhouette davor zu
 * kleben: Himmel, Nebel und Kulisse enden bei derselben Dunstfarbe, also müssen
 * alle drei denselben Weg ins Bild nehmen (G-105).
 */
export function baueFernlandMaterial(): THREE.Material {
  // D207: Mosaik aus Wald und Offenland im Fragment, nur auf dem klaren Anteil der Farbe
  // (`klar`), der Dunst bleibt unberührt — die Kulisse endet weiter bei der Horizontfarbe.
  return new THREE.ShaderMaterial({
    vertexColors: true,
    fog: false,
    vertexShader: `
attribute vec3 klar;
varying vec3 vFarbe;
varying vec3 vKlar;
varying vec2 vOrt;
void main() {
  vFarbe = color;
  vKlar = klar;
  vOrt = (modelMatrix * vec4(position, 1.0)).xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `
varying vec3 vFarbe;
varying vec3 vKlar;
varying vec2 vOrt;
float fernHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fernRauschen(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(fernHash(i), fernHash(i + vec2(1, 0)), u.x),
             mix(fernHash(i + vec2(0, 1)), fernHash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  // D207: Wald und Offenland als Mosaik. Das 125-m-Raster trägt keine Fläche unter einem
  // Kilometer; ohne das stand der Talboden als eine helle Platte (Flanken-Kamera, D204).
  float n = fernRauschen(vOrt / 420.0) * 0.6 + fernRauschen(vOrt / 140.0 + 7.3) * 0.3
          + fernRauschen(vOrt / 47.0 + 3.1) * 0.1;
  float offen = smoothstep(0.48, 0.58, n);
  vec3 mosaik = mix(vec3(0.62, 0.68, 0.62), vec3(1.30, 1.22, 0.98), offen);
  gl_FragColor = vec4(vFarbe + vKlar * (mosaik - 1.0), 1.0);
  // Denselben Weg wie Himmel und Nebel — siehe himmel.ts und G-105.
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
}
