import * as THREE from 'three';
import { ASPHALTRAND_GLSL, BAND_RAUSCHEN_GLSL } from './bandmaterial.js';
import { WEG_UEBER_GRUND } from './baender.js';
import { ladeHorstAtlas, leereHorstTextur, HORST_SCHWELLE, type HorstKachel } from './grashorst.js';
import { mulberry } from './props.js';
import { WEG_TEILUNG } from './terrain.js';
import { MILBINGERSUBSTANZ_AN } from './echt.js';
import {
  BORD_ABSENKUNG, DECKE_UEBER_GRUND, GEHWEG_RANDABTRAG, ZUFAHRT_UEBER_GRUND,
  gehwegRandverfall, querschnittFreihaltung, querschnittSaum, wurzelinsel,
} from './strassenquerschnitt.js';
import type { WohnwegQuerschnitt } from '../data/schema.js';

export interface StrassenbewuchsWeg {
  /** Linienverlauf in Weltmetern. Breite ist die volle Breite des Wegbandes. */
  punkte: readonly (readonly [number, number])[];
  breite: number;
  saat: number;
  /** Bewuchs und Frostschäden zwischen 0 und 1. */
  verfall?: number;
  /** Niedriger, gruppierter Bewuchs für schmale Wohnwege. */
  wohnwegrand?: boolean;
  /** Ersetzte Stationen der untexturierten Fahrbahnprobe. */
  querschnitt?: readonly [number, number];
  /** Verwitterter Außenrand entlang des vermessenen Querschnitts. */
  vermessenerSaum?: WohnwegQuerschnitt;
  schotterspuren?: boolean;
  /** Niedrige, unterbrochene Saumgruppen auf der Erdseite des Gehwegs. */
  nahtbewuchs?: boolean;
  /** Erdlinsen und Bruchkies neben ausgebrochenen Gehwegkanten. */
  randverfall?: boolean;
  /** Pflanzeninseln in ausgespülten, offenen Fahrbahnrändern. */
  strassenfinale?: boolean;
  hofzufahrt?: boolean;
  bodenpassend?: boolean;
  /** Erhaltene Zugänge an der Straße, in Weltmetern. */
  wohnwegZugaenge?: readonly (readonly [number, number])[];
  /** Auf ungebundenem Belag entstehen Rinnen und Pflanzeninseln ohne Asphaltrisse. */
  gebundenerBelag?: boolean;
  /** Bruchstücke der gebundenen Fahrbahn und stärker gezackter Randsaum. */
  fahrbahnprofil?: boolean;
  /** Verschiebung der Fahrbahnmitte quer zur OSM-Achse in Weltmetern. */
  versatz?: number;
  /** Gemessene Streifen. Längs- und Quermaße gelten in Weltmetern. */
  markierungen?: readonly { von: number; bis: number; breite: number; quer?: number; querEnde?: number }[];
}

type Bodenhoehe = (x: number, z: number) => number;
type FreierBoden = (x: number, z: number) => boolean;
type Punkt = readonly [x: number, y: number, z: number];
type Bandpunkt = readonly [laengs: number, quer: number];

interface Stueck {
  x: number;
  z: number;
  dx: number;
  dz: number;
  laenge: number;
  halb: number;
  /** Geländehöhen der vier Bandvertices. */
  hoehen: readonly [number, number, number, number];
}

interface Bewuchs {
  ort: Punkt;
  groesse: number;
  breite?: number;
  drehung: number;
  ton: number;
  auswahl: number;
  sorte?: HorstKachel['art'];
}

const MOOS = new THREE.Color('#495340');
const ERDE = new THREE.Color('#605746');
const SPLITT = new THREE.Color('#6a6559');
const RISS = new THREE.Color('#24271f');
const MARKIERUNG = new THREE.Color('#e5e2d0');
const ASPHALT = new THREE.Color('#55544e');
const BRUCHKANTE = new THREE.Color('#37372f');
const TAU = Math.PI * 2;

function punktAmBand(st: Stueck, laengs: number, quer: number, boden: Bodenhoehe, hub = 0): Punkt {
  const x = st.x + st.dx * laengs - st.dz * quer;
  const z = st.z + st.dz * laengs + st.dx * quer;
  const u = THREE.MathUtils.clamp((quer / st.halb + 1) * .5, 0, 1);
  const v = THREE.MathUtils.clamp(laengs / st.laenge, 0, 1);
  const [al, ar, bl, br] = st.hoehen;
  // Derselbe Diagonalschnitt wie liegendesBand in baender.ts. Dadurch liegt
  // die Auflage auch über Quergefälle und kurzen Kuppen am gezeichneten Belag.
  const y = u + v <= 1
    ? al + (ar - al) * u + (bl - al) * v
    : br + (bl - br) * (1 - u) + (ar - br) * (1 - v);
  const anschluss = Math.abs(quer) - st.halb;
  const hoehe = anschluss <= 0
    ? y + WEG_UEBER_GRUND
    : THREE.MathUtils.lerp(y + WEG_UEBER_GRUND, boden(x, z), Math.min(1, anschluss * 5));
  return [x, hoehe + hub, z];
}

function atlasKarten(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    -.5, 0, 0, .5, 0, 0, -.5, 1, 0, .5, 1, 0,
    0, 0, -.5, 0, 0, .5, 0, 1, -.5, 0, 1, .5,
  ], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1, 0,0,1,0,0,1,1,1], 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: 8 }, () => [0,1,0]).flat(), 3));
  geo.setIndex([0,1,2, 2,1,3, 4,5,6, 6,5,7]);
  return geo;
}

/** Schneidet einen Streifen so, dass keines seiner Dreiecke den Bandknick überspannt. */
function anBanddiagonaleTeilen(st: Stueck, ring: readonly Bandpunkt[], seite: -1 | 1): Bandpunkt[] {
  const abstand = ([l, q]: Bandpunkt) => seite * (l / st.laenge + q / (2 * st.halb) - .5);
  return ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length], dA = abstand(a), dB = abstand(b);
    const raus: Bandpunkt[] = dA >= 0 ? [a] : [];
    if (dA * dB < 0) {
      const t = dA / (dA - dB);
      raus.push([THREE.MathUtils.lerp(a[0], b[0], t), THREE.MathUtils.lerp(a[1], b[1], t)]);
    }
    return raus;
  });
}

/** Berechnet die Auflagen des beprobten Straßenzugs einmal. Büschel und Splitt bleiben Instanzen. */
export function baueStrassenbewuchs(
  wege: readonly StrassenbewuchsWeg[],
  boden: Bodenhoehe,
  freierBoden: FreierBoden = () => true,
): { gruppe: THREE.Group; entsorge: () => void } {
  const gruppe = new THREE.Group();
  gruppe.name = 'Straßenbewuchs';
  const positionen: number[] = [], farben: number[] = [], indizes: number[] = [];
  const hatMarkierungen = wege.some(weg => weg.markierungen?.length);
  const lack: number[] = [];
  const wildkraut: Bewuchs[] = [], splitt: Bewuchs[] = [];
  let risse = 0;
  let markierungsMeter = 0, markierungsDreiecke = 0, asphaltSchollen = 0;

  const vertex = (p: Punkt, farbe: THREE.Color, deckung: number, randabstand = -1, verfall = 0) => {
    const index = positionen.length / 3;
    positionen.push(...p);
    farben.push(farbe.r, farbe.g, farbe.b, deckung);
    if (hatMarkierungen) lack.push(randabstand, verfall);
    return index;
  };
  const frei = ([x, , z]: Punkt) => freierBoden(x, z);
  const lackieren = (st: Stueck, meter: number, streifen: NonNullable<StrassenbewuchsWeg['markierungen']>[number], verfall: number) => {
    const l0 = Math.max(0, streifen.von - meter), l1 = Math.min(st.laenge, streifen.bis - meter);
    if (l1 <= l0) return;
    const quer = streifen.quer ?? 0, querEnde = streifen.querEnde ?? quer;
    const quergrenzen = (l: number) => {
      const q = THREE.MathUtils.lerp(quer, querEnde, (meter + l - streifen.von) / (streifen.bis - streifen.von));
      const halb = streifen.breite / 2;
      return [Math.max(-st.halb, q - halb), Math.min(st.halb, q + halb)];
    };
    const unterteilt = Math.ceil((l1 - l0) / .36);
    for (let k = 0; k < unterteilt; k++) {
      const a = THREE.MathUtils.lerp(l0, l1, k / unterteilt);
      const b = THREE.MathUtils.lerp(l0, l1, (k + 1) / unterteilt);
      const [a0, a1] = quergrenzen(a), [b0, b1] = quergrenzen(b);
      if (a0 >= a1 || b0 >= b1) continue;
      const flaeche: Bandpunkt[] = [[a,a0],[a,a1],[b,b1],[b,b0]];
      if (!flaeche.every(([l, quer]) => frei(punktAmBand(st,l,quer,boden)))) continue;
      for (const seite of [-1, 1] as const) {
        const ring = anBanddiagonaleTeilen(st, flaeche, seite);
        if (ring.length < 3) continue;
        const ecken = ring.map(([l, quer]) => {
          const meterwert = meter + l;
          const abgerieben = .24 + .52 * (.5 + .5 * Math.sin(meterwert * 4.03 + quer * 7.1))
            + .17 * (.5 + .5 * Math.sin(meterwert * 12.7 - quer * 4.3));
          return vertex(punktAmBand(st,l,quer,boden,.013), MARKIERUNG, 1 - verfall * abgerieben,
            1 - Math.abs(quer) / st.halb, verfall);
        });
        for (let i = 1; i + 1 < ecken.length; i++) indizes.push(ecken[0],ecken[i],ecken[i + 1]);
        markierungsDreiecke += ecken.length - 2;
      }
      markierungsMeter += b - a;
    }
  };
  const matrix = new THREE.Matrix4(), skalierung = new THREE.Vector3(), farbe = new THREE.Color();

  let inselhorste = 0, schwemmkiesel = 0;
  let saumhorste = 0, saumflecken = 0, zufahrtshorste = 0, nahthorste = 0;
  let randlinsen = 0, randhorste = 0, randbruch = 0, zufahrtskiesel = 0, fahrbahnsaum = 0;
  const bepflanzeQuerschnitt = (weg: StrassenbewuchsWeg) => {
    const profil = weg.vermessenerSaum, verwitterung = profil?.verwitterung;
    if (!profil || !verwitterung || !verwitterung.staerke) return;
    const aussen = querschnittSaum(weg.punkte, profil, weg.breite);
    const belegt = querschnittFreihaltung(weg.punkte, profil, weg.breite).enthaelt;
    const { von, bis } = verwitterung.saum;
    if (weg.strassenfinale) {
      const start = profil.stationen[0][0], ende = profil.stationen.at(-1)![0];
      for (const seite of [-1, 1] as const) for (let i = Math.ceil(start / .82); i*.82 < ende; i++) {
        const zufall = mulberry(weg.saat ^ Math.imul(i*2 + (seite > 0 ? 1 : 0),34871));
        const s = (i + zufall()*.55)*.82;
        if (s > ende || profil.zufahrten.some(z => z.seite === seite && s > z.von-.58 && s < z.bis+.58)) continue;
        const amBord = profil.gehwege.some(g => g.seite === seite && s >= g.von && s <= g.bis);
        const deckung = (.61 + .27*Math.sin(s*.49) + .12*Math.sin(s*1.36 + .8)) * (amBord ? .39 : 1);
        if (zufall() > deckung) continue;
        const anzahl = amBord ? 1 : 3 + Math.floor(4*deckung);
        for (let k = 0; k < anzahl; k++) {
          const laengs = s + (zufall()-.5)*.63, quer = amBord ? -.055 : -.18 + zufall()*.64;
          const ort = aussen(laengs,seite,quer,true);
          if (!ort || !freierBoden(...ort)) continue;
          const wuchs = zufall(), auswahl = zufall(), drehung = zufall()*TAU;
          const [x,z] = ort;
          const fuss: Punkt = [x,boden(x,z) + (quer < 0 ? .012 : -.002),z];
          if (auswahl < .26) {
            splitt.push({ ort: fuss, groesse: .024+.053*wuchs, drehung, ton: .81+.46*zufall(), auswahl });
          } else {
            const aussenwuchs = Math.max(0, quer)*.55;
            wildkraut.push({ ort: fuss, groesse: .038 + wuchs*(.096 + aussenwuchs),
              breite: .058 + wuchs*(.113 + aussenwuchs), drehung, ton: .65+.24*zufall(),
              auswahl, sorte: auswahl < .54 ? 'kraut' : auswahl < .79 ? 'halm' : 'stroh' });
          }
          fahrbahnsaum++;
        }
      }
    }
    if (weg.randverfall) for (const { seite, von, bis, breite: gehwegbreite } of profil.gehwege) {
      const maximalerAbtrag = Math.min(GEHWEG_RANDABTRAG, gehwegbreite * .16);
      const amBruch = (s: number, abstand: number, hub: number): Punkt | undefined => {
        const abtrag = gehwegRandverfall(s, seite, profil);
        if (abtrag < .035) return undefined;
        const ort = aussen(s, seite, abstand - maximalerAbtrag * abtrag);
        if (!ort || !freierBoden(...ort)) return undefined;
        const [x, z] = ort;
        if (weg.wohnwegZugaenge?.some(([a, b]) => Math.hypot(x - a, z - b) < 1.55)) return undefined;
        return [x, boden(x, z) + hub, z];
      };
      const raster = .97;
      for (let i = Math.ceil(von / raster); i * raster < bis; i++) {
        const zufall = mulberry(weg.saat ^ Math.imul(2 * i + (seite < 0 ? 1 : 0), 21491));
        const s = (i + .15 + zufall() * .51) * raster;
        const abtrag = gehwegRandverfall(s, seite, profil);
        if (abtrag < .16) continue;
        const hub = .028 + .055 * abtrag;
        const mitte = amBruch(s, .21, hub);
        const laenge = .29 + .27 * zufall(), breite = .30 + .27 * abtrag;
        const kontur = [
          amBruch(s - laenge, .14, .009), amBruch(s - laenge * .58, .068, hub * .53),
          amBruch(s + laenge * .37, .068, hub * .43), amBruch(s + laenge, .13, .009),
          amBruch(s + laenge * .64, breite, .009), amBruch(s - laenge * .41, breite * 1.15, .009),
        ];
        if (!mitte || !kontur.every((p): p is Punkt => p !== undefined)) continue;
        farbe.copy(ERDE).lerp(SPLITT, .25 + .29 * zufall()).multiplyScalar(.86 + .24 * zufall());
        const kern = vertex(mitte, farbe, .90);
        const rand = kontur.map((p, k) => vertex(p, farbe, k === 1 || k === 2 ? .57 : 0));
        for (let k = 0; k < rand.length; k++) indizes.push(kern, rand[k], rand[(k + 1) % rand.length]);
        randlinsen++;

        // Nur innerhalb der modellierten Erdlinse streuen, so sitzen Steine und Halme auf der Auflage.
        for (let k = 0; k < 2 + Math.round(4 * abtrag); k++) {
          const dreieck = Math.floor(zufall() * kontur.length);
          const a = kontur[dreieck], b = kontur[(dreieck + 1) % kontur.length];
          const quer = zufall(), streuung = .13 + .56 * zufall();
          const koordinate = (achse: 0 | 1 | 2) => THREE.MathUtils.lerp(mitte[achse], THREE.MathUtils.lerp(a[achse], b[achse], quer), streuung);
          const ort: Punkt = [koordinate(0), koordinate(1) - .003, koordinate(2)];
          if (!frei(ort)) continue;
          const wuchs = zufall(), auswahl = zufall(), drehung = zufall() * TAU;
          if (auswahl < .47) {
            splitt.push({ ort, groesse: .024 + .049 * wuchs, drehung, ton: 1.17 + wuchs * .37, auswahl });
            randbruch++;
          } else {
            wildkraut.push({
              ort, groesse: .046 + .10 * wuchs, breite: .07 + .08 * wuchs, drehung,
              ton: .69 + .31 * zufall(), auswahl, sorte: auswahl < .64 ? 'kraut' : auswahl < .87 ? 'halm' : 'stroh',
            });
            randhorste++;
          }
        }
      }
    }
    if (weg.nahtbewuchs) for (const gehweg of profil.gehwege) {
      const raster = .79;
      for (let i = Math.ceil(Math.max(von, gehweg.von + .5) / raster); i * raster < Math.min(bis, gehweg.bis - .5); i++) {
        const zufall = mulberry(weg.saat ^ Math.imul(2 * i + (gehweg.seite === 1 ? 1 : 0), 27109));
        const station = (i + zufall() * .46) * raster;
        const nachbar = profil.zufahrten.some(z => z.seite === gehweg.seite && station >= z.von - .23 && station <= z.bis + .23);
        const gruppierung = .55 + .45 * Math.sin(station * .91) ** 2;
        if (nachbar || zufall() > .67 * gruppierung * verwitterung.staerke) continue;
        const ort = aussen(station, gehweg.seite, .30 + zufall() * .11);
        if (!ort || belegt(...ort) || !freierBoden(...ort)) continue;
        const [x, z] = ort, wuchs = zufall(), auswahl = zufall();
        const breite = .064 + .068 * wuchs;
        const radius = breite / 2;
        if ([-radius, radius].some(dx => [-radius, radius].some(dz => belegt(x + dx, z + dz)))) continue;
        wildkraut.push({
          ort: [x, boden(x, z) - .004, z], groesse: .046 + .051 * wuchs, breite,
          drehung: zufall() * TAU, ton: .62 + wuchs * .22, auswahl, sorte: auswahl < .46 ? 'kraut' : 'halm',
        });
        nahthorste++;
      }
    }
    const raster = 1.16;
    for (const seite of [-1, 1] as const) for (let i = Math.ceil(von / raster); i * raster < bis; i++) {
      // Dieselben Horste bleiben beim Verlängern eines Prüfabschnitts erhalten.
      const zufall = mulberry(weg.saat ^ Math.imul(2 * i + (seite < 0 ? 1 : 0), 28351));
      const s = (i + .08 + zufall() * .66) * raster;
      const zugang = Math.min(3, ...profil.zufahrten.filter(z => z.seite === seite)
        .map(z => Math.max(z.von - s, 0, s - z.bis)));
      if (s > bis || zugang < .7) continue;
      const dichte = .36 + .64 * (.5 + .5 * Math.sin(s * .56 + seite * 2.9)) ** 1.5;
      const trocken = zufall();
      if (zufall() > verwitterung.staerke * (.43 + .57 * dichte)) continue;
      const grund = (meter: number, abstand: number): Punkt | undefined => {
        const ort = aussen(meter, seite, abstand);
        if (!ort) return undefined;
        const [x, z] = ort;
        if (belegt(x, z) || !freierBoden(x, z)) return undefined;
        return [x, boden(x, z) + .016, z];
      };
      const mitte = grund(s, .65);
      if (!mitte) continue;
      const ring = Array.from({ length: 9 }, (_, k) => {
        const winkel = TAU * k / 9, faktor = .74 + zufall() * .26;
        return grund(s + Math.cos(winkel) * .78 * faktor, .65 + Math.sin(winkel) * .38 * faktor);
      });
      if (ring.every((ecke): ecke is Punkt => ecke !== undefined)) {
        farbe.copy(ERDE).lerp(MOOS, (1 - trocken) * .46).multiplyScalar(.77 + zufall() * .3);
        const kern = vertex(mitte, farbe, .79);
        const rand = ring.map(p => vertex(p, farbe, 0));
        for (let k = 0; k < rand.length; k++) indizes.push(kern, rand[k], rand[(k + 1) % rand.length]);
        saumflecken++;
      }
      for (let k = 0; k < 3 + Math.floor(dichte * 6); k++) {
        const abstand = .41 + zufall() * (dichte * .82 + .21);
        const ort = grund(s + (zufall() - .5) * Math.min(1.1, zugang), abstand);
        const wuchs = zufall(), sorte = zufall();
        if (!ort) continue;
        const hoch = Math.min(1, Math.max(0, abstand - .43) * 1.6);
        wildkraut.push({
          ort, groesse: .103 + wuchs * (.118 + hoch * .26), breite: .14 + wuchs * (.14 + hoch * .21),
          drehung: zufall() * TAU, ton: .69 + zufall() * .29, auswahl: zufall(),
          sorte: sorte < .22 ? 'kraut' : sorte < .27 ? 'blume'
            : trocken > .56 ? (sorte > .78 ? 'halm' : 'stroh') : 'gruen',
        });
        saumhorste++;
      }
    }
    if (!weg.schotterspuren) return;
    for (const zufahrt of profil.zufahrten) {
      const belag = zufahrt.schotterspuren;
      if (!belag) continue;
      const zufall = mulberry(weg.saat ^ Math.imul(Math.round(zufahrt.von * 100) + zufahrt.seite, 19013));
      if (MILBINGERSUBSTANZ_AN && weg.randverfall && weg.bodenpassend) {
        const kiesSaat = mulberry(weg.saat ^ Math.imul(Math.round(zufahrt.von * 100), 34709));
        const mitte = (zufahrt.von + zufahrt.bis) / 2;
        const gehweg = profil.gehwege.find(g => g.seite === zufahrt.seite
          && g.von <= mitte && g.bis >= mitte)?.breite ?? 0;
        const anzahl = Math.ceil((zufahrt.bis - zufahrt.von) * Math.max(0, zufahrt.tiefe - gehweg) * 7.5);
        const hubInnen = DECKE_UEBER_GRUND + (gehweg > 0 ? BORD_ABSENKUNG : 0);
        const bodenAuftrag = (s: number, t: number) => THREE.MathUtils.lerp(hubInnen, ZUFAHRT_UEBER_GRUND, t)
          + (weg.hofzufahrt ? .045 * wurzelinsel(s - mitte, t, belag.spurabstand / 2) : 0);
        if (weg.hofzufahrt) {
          const saat = mulberry(weg.saat ^ Math.round(zufahrt.von * 1000));
          const laenge = zufahrt.tiefe - gehweg, proben = Math.ceil(laenge * 26);
          for (let i = 0; i < proben; i++) {
            const t = (i + saat()) / proben, versatz = (saat() - .5) * belag.spurabstand;
            const humus = wurzelinsel(versatz, t, belag.spurabstand / 2);
            if (saat() >= humus * belag.saumdichte) continue;
            const s = mitte + versatz, ort = aussen(s, zufahrt.seite, gehweg + t * laenge, true);
            if (!ort || !freierBoden(...ort)) continue;
            const [x, z] = ort, wuchs = saat(), art = saat();
            // Der Wurzelansatz steckt im Kies; in den lichten Fugen wachsen nur niedrige Rosetten.
            wildkraut.push({ ort: [x, boden(x, z) + bodenAuftrag(s, t) - .014, z],
              groesse: .069 + humus * (.11 + .16 * wuchs), breite: .095 + humus * (.11 + wuchs * .16),
              drehung: saat() * TAU, ton: .64 + saat() * .29, auswahl: saat(),
              sorte: humus < .27 || art < .46 ? 'kraut' : art < .79 ? 'gruen' : 'stroh' });
            inselhorste++;
          }
          // Abgerollter Splitt bleibt unten am abgesenkten Bord. Sowohl Gefälle zur
          // Fahrbahn als auch Richtung entlang der Rinne stammen aus dem Geländeraster.
          const muendung = aussen(mitte, zufahrt.seite, -.04, true);
          const hof = aussen(mitte, zufahrt.seite, zufahrt.tiefe - .12, true);
          const davor = aussen(mitte - .7, zufahrt.seite, -.14, true);
          const danach = aussen(mitte + .7, zufahrt.seite, -.14, true);
          if (muendung && hof && davor && danach && boden(...hof) - boden(...muendung) > .045) {
            const talab = boden(...davor) > boden(...danach) ? 1 : -1;
            const ausgang = mitte + talab * belag.spurabstand / 2;
            const reihen = 8, spalten = 6;
            const punkte: (number | undefined)[][] = [];
            for (let j = 0; j <= reihen; j++) {
              const t = j / reihen, laenge = -.04 - .73 * t;
              const halb = .12 + .41 * Math.sin(t * 2.4), drift = .47 * t;
              const reihe: (number | undefined)[] = [];
              for (let i = 0; i <= spalten; i++) {
                const u = i / spalten * 2 - 1, rand = 1 - Math.abs(u);
                const station = ausgang + drift * talab + halb * u;
                const ort = aussen(station, zufahrt.seite, laenge + .07 * Math.sin(7*u + 2*t) * t, true);
                if (!ort || !freierBoden(...ort)) { reihe.push(undefined); continue; }
                const kern = rand * (1-t*t), y = boden(...ort) + DECKE_UEBER_GRUND + .002 + kern * .011;
                farbe.copy(ERDE).lerp(SPLITT, .29 + .48 * t).multiplyScalar(.84 + .23 * saat());
                reihe.push(vertex([ort[0], y, ort[1]], farbe, .92 * Math.sqrt(kern)));
                if (i && j && t < 1 && saat() < .75) {
                  splitt.push({ ort: [ort[0], y - .003, ort[1]], groesse: .012 + .032 * kern * saat(),
                    drehung: saat() * TAU, ton: .91 + .45*saat(), auswahl: saat() });
                  schwemmkiesel++;
                }
              }
              punkte.push(reihe);
            }
            for (let j=1; j<=reihen; j++) for (let i=1; i<=spalten; i++) {
              const [a,b,c,d] = [punkte[j-1][i-1],punkte[j-1][i],punkte[j][i],punkte[j][i-1]];
              if (a !== undefined && b !== undefined && c !== undefined && d !== undefined)
                indizes.push(a,b,c,a,c,d);
            }
          }
        }
        for (let i = 0; i < anzahl; i++) {
          const abstand = weg.strassenfinale ? .55 : .16;
          const s = THREE.MathUtils.lerp(zufahrt.von + abstand, zufahrt.bis - abstand, kiesSaat());
          const t = weg.strassenfinale ? .15 + .68*kiesSaat() : .07 + .86*kiesSaat();
          const spur = Math.abs(Math.abs(s - mitte) - belag.spurabstand / 2);
          if (spur < .31 && kiesSaat() < .95) continue;
          const punkt = aussen(s, zufahrt.seite, THREE.MathUtils.lerp(gehweg, zufahrt.tiefe, t), true);
          if (!punkt) continue;
          const [x, z] = punkt;
          const y = boden(x, z) + bodenAuftrag(s, t);
          const groesse = .019 + .041 * kiesSaat() ** 1.65;
          splitt.push({ ort: [x, y, z], groesse, drehung: kiesSaat() * TAU,
            ton: 1.02 + .46 * kiesSaat(), auswahl: kiesSaat() });
          zufahrtskiesel++;
        }
      }
      for (const flanke of [-1, 1] as const) {
        const station = flanke < 0 ? zufahrt.von : zufahrt.bis;
        const gehweg = profil.gehwege.find(g => g.seite === zufahrt.seite
          && g.von <= station && g.bis >= station)?.breite ?? 0;
        const laenge = zufahrt.tiefe - gehweg;
        const zellen = Math.floor(laenge / .48);
        const phase = zufall() * TAU;
        const anfang = aussen(station, zufahrt.seite, gehweg, true);
        const ende = aussen(station, zufahrt.seite, zufahrt.tiefe, true);
        if (!weg.strassenfinale && anfang && ende && zellen > 0) {
          const hubInnen = (weg.bodenpassend ? DECKE_UEBER_GRUND : WEG_UEBER_GRUND) + (gehweg > 0 ? BORD_ABSENKUNG : 0);
          const hubAussen = weg.bodenpassend ? ZUFAHRT_UEBER_GRUND : WEG_UEBER_GRUND;
          const innenY = boden(...anfang) + hubInnen;
          const aussenY = boden(...ende) + hubAussen;
          const kante: ([number, number] | undefined)[] = [];
          for (let i = 0; i <= zellen; i++) {
            const anteil = i / zellen;
            const breite = .18 + .23 * (.5 + .5 * Math.sin(i * 2.48 + phase));
            const ort = aussen(station + breite * flanke, zufahrt.seite, gehweg + anteil * laenge, true);
            if (!ort || belegt(...ort) || !freierBoden(...ort)) {
              kante.push(undefined);
              continue;
            }
            const ix = THREE.MathUtils.lerp(anfang[0], ende[0], anteil);
            const iz = THREE.MathUtils.lerp(anfang[1], ende[1], anteil);
            const iy = weg.bodenpassend
              ? boden(ix, iz) + THREE.MathUtils.lerp(hubInnen, hubAussen, anteil)
              : THREE.MathUtils.lerp(innenY, aussenY, anteil);
            const innen: Punkt = [ix, iy - .005, iz];
            const [x, z] = ort, untergrund: Punkt = [x, boden(x, z) + .011, z];
            farbe.copy(ERDE).lerp(SPLITT, .68 - .23 * Math.sin(i * 1.68 + phase));
            kante.push([vertex(innen, farbe, .94), vertex(untergrund, farbe, 0)]);
          }
          for (let i = 1; i < kante.length; i++) {
            const a = kante[i - 1], b = kante[i];
            if (a && b) indizes.push(a[0], a[1], b[0], a[1], b[1], b[0]);
          }
        }
        if (belag.saumdichte <= 0) continue;
        for (let i = 0; i < zellen; i++) {
          const tiefe = (i + .18 + .62 * zufall()) / zellen;
          const gruppe = .38 + .62 * (.5 + .5 * Math.sin(tiefe * 15 + phase));
          if (zufall() > belag.saumdichte * gruppe) continue;
          for (let k = 0; k < 2 + Math.floor(gruppe * 3); k++) {
            const laengs = station + flanke * (.48 + zufall() * .67);
            const quer = gehweg + .26 + tiefe * laenge + (zufall() - .5) * .54;
            const ort = aussen(laengs, zufahrt.seite, quer, true);
            if (!ort || belegt(...ort) || !freierBoden(...ort)) continue;
            const [x, z] = ort, wuchs = zufall(), grasart = zufall();
            const art = grasart < .56 ? 'kraut' : grasart < .78 ? 'halm' : 'gruen';
            const hoechste = .15 + .31 * tiefe;
            wildkraut.push({
              ort: [x, boden(x, z) - .006, z], groesse: .13 + wuchs * hoechste,
              breite: .19 + wuchs * .18, drehung: zufall() * TAU,
              ton: .67 + zufall() * .23, auswahl: zufall(), sorte: art,
            });
            if (k === 0 && grasart < .34) {
              splitt.push({ ort: [x, boden(x, z) + .006, z], groesse: .05 + wuchs * .045,
                drehung: phase, ton: .98 + wuchs * .41, auswahl: grasart });
            }
            zufahrtshorste++;
          }
        }
      }
    }
  };

  for (const weg of wege) {
    if (weg.vermessenerSaum) bepflanzeQuerschnitt(weg);
    const zufall = mulberry(weg.saat);
    const verfall = THREE.MathUtils.clamp(weg.verfall ?? 1, 0, 1);
    const halb = weg.breite / 2, versatz = weg.versatz ?? 0;
    const freieSpur = Math.min(.90, halb * .70);
    const markierungen = weg.markierungen ?? [];
    const fahrbahnprofil = !!weg.fahrbahnprofil && weg.gebundenerBelag !== false;
    if (halb < .45 || (verfall === 0 && markierungen.length === 0)) continue;
    const phase = zufall() * TAU;
    let meter = 0;

    for (let i = 1; i < weg.punkte.length; i++) {
      const [x0, z0] = weg.punkte[i - 1];
      const [x1, z1] = weg.punkte[i];
      const distanz = Math.hypot(x1 - x0, z1 - z0);
      if (distanz === 0 || (distanz < .05 && markierungen.length === 0)) continue;
      const teile = Math.ceil(distanz / WEG_TEILUNG), laenge = distanz / teile;
      const dx = (x1 - x0) / distanz, dz = (z1 - z0) / distanz;
      const querX = -dz * versatz, querZ = dx * versatz;
      for (let j = 0; j < teile; j++, meter += laenge) {
        if (weg.querschnitt && meter < weg.querschnitt[1] && meter + laenge > weg.querschnitt[0]) continue;
        const x = x0 + dx * laenge * j + querX, z = z0 + dz * laenge * j + querZ;
        const ex = x0 + dx * laenge * (j + 1), ez = z0 + dz * laenge * (j + 1);
        const nx = -dz * halb, nz = dx * halb;
        const st: Stueck = {
          x, z, dx, dz, laenge, halb,
          hoehen: [boden(x - nx, z - nz), boden(x + nx, z + nz), boden(ex - nx, ez - nz), boden(ex + nx, ez + nz)],
        };
        for (const streifen of markierungen) lackieren(st, meter, streifen, verfall);
        if (verfall === 0 || distanz < .05) continue;

        for (const seite of [-1, 1]) {
          const horst = .5 + .5 * Math.sin(meter * (seite < 0 ? .19 : .27) + phase + seite * 1.23);
          const drang = verfall * (.19 + .81 * horst ** 1.5);
          const randbucht = fahrbahnprofil ? .34 * Math.sin(meter * .48 + phase + 2.8 * seite)
            + .19 * Math.sin(meter * 1.07 - phase * seite) : 0;
          const saum = halb - drang * (halb - freieSpur) * .68;
          const mitte = fahrbahnprofil ? Math.max(freieSpur + .13, saum + randbucht * verfall) : saum;
          const breite = Math.min(.29 + drang * .71, mitte - freieSpur);
          const laengs = laenge * (.42 + zufall() * .16);
          const radius = Math.min(laenge * .4, .55 + drang * 1.04);

          if (fahrbahnprofil && laenge >= .7) {
            // Eigenes Zufallsfeld hält die Schollen unabhängig vom Blattatlas.
            const scholle = mulberry(weg.saat ^ Math.imul(Math.round(meter * 100) + seite, 22799));
            const quer = Math.max(freieSpur + .24, Math.min(halb - .08, halb * .84 + randbucht * .67));
            const querweite = Math.min(.13 + scholle() * .24, quer - freieSpur);
            if (querweite > .12 && scholle() < verfall * (.37 + drang * .44)) {
              const laengsweite = Math.min(laenge * .35, .28 + scholle() * .59);
              const relief = .013 + scholle() * .025;
              const kern = punktAmBand(st, laengs, seite * quer, boden, relief);
              const ring = Array.from({ length: 8 }, (_, k): Bandpunkt => {
                const winkel = TAU * k / 8 + (scholle() - .5) * .53;
                const f = .62 + scholle() * .38;
                return [THREE.MathUtils.clamp(laengs + Math.cos(winkel) * laengsweite * f, 0, laenge),
                  seite * (quer + Math.sin(winkel) * querweite * f)];
              });
              const oben = ring.map(([l, q]) => punktAmBand(st,l,q,boden,relief * (.54 + scholle() * .46)));
              if (frei(kern) && oben.every(frei)) {
                farbe.copy(ASPHALT).multiplyScalar(.75 + scholle() * .45);
                const a = vertex(kern, farbe, .87);
                const b = oben.map(p => vertex(p, farbe, .74 + scholle() * .24));
                const c = ring.map(([l, q]) => vertex(punktAmBand(st,l,q,boden,-.013), BRUCHKANTE, .83));
                for (let k = 0; k < b.length; k++) {
                  const k2 = (k + 1) % b.length;
                  indizes.push(a,b[seite > 0 ? k2 : k],b[seite > 0 ? k : k2],
                    b[k],c[k],b[k2],b[k2],c[k],c[k2]);
                }
                asphaltSchollen++;
              }
            }
          }

          if (breite > .03 && zufall() < drang * 1.35) {
            const kern = punktAmBand(st, laengs, seite * mitte, boden, .023);
            const rand = Array.from({ length: 10 }, (_, k) => {
              const alpha = TAU * k / 10, f = .65 + zufall() * .35;
              return punktAmBand(st, laengs + Math.cos(alpha) * radius * f,
                seite * (mitte + Math.sin(alpha) * breite * f), boden, .023);
            });
            if (frei(kern) && rand.every(frei)) {
              farbe.copy(MOOS).lerp(ERDE, zufall() * .72).multiplyScalar(.83 + zufall() * .34);
              const a = vertex(kern, farbe, .68 + drang * .26);
              const b = rand.map(p => vertex(p, farbe, 0));
              for (let k = 0; k < b.length; k++) indizes.push(a, b[k], b[(k + 1) % b.length]);
            }
          }

          if (weg.wohnwegrand) {
            // Die Gruppen folgen durchgehenden Metern statt den OSM-Kanten.
            // Mehrere kleine Horste teilen sich Farbe und Wuchshöhe, dazwischen
            // bleibt offener Boden. Nur am äußeren Rand stehen einzelne Rispen.
            const raster = 1.36;
            const von = Math.floor((meter - .44) / raster);
            const bis = Math.floor((meter + laenge + .44) / raster);
            for (let i = von; i <= bis; i++) {
              if (i < 0) continue;
              const horstZufall = mulberry(weg.saat ^ Math.imul(2 * i + (seite < 0 ? 1 : 0), 15683));
              const zentrum = (i + .16 + horstZufall() * .68) * raster;
              const buschig = .5 + .5 * Math.sin(zentrum * (seite < 0 ? .52 : .67) + phase + seite * 2.2);
              if (horstZufall() > verfall * (.37 + .51 * buschig)) continue;
              const trocken = horstZufall();
              const streuung = .16 + horstZufall() * .27;
              const querMitte = Math.min(halb + .17, mitte + (horstZufall() - .38) * .57);
              const anzahl = 2 + Math.floor(buschig * 2 + horstZufall() * 2);
              for (let k = 0; k < anzahl; k++) {
                const l = zentrum - meter + (horstZufall() - .5) * 2 * streuung;
                const rand = querMitte + (horstZufall() - .5) * .48;
                const x = horstZufall(), wuchs = horstZufall();
                const trockenHalm = x > .94 && rand >= halb - .14;
                const sorte = trockenHalm ? 'halm' : trocken > .81 ? 'stroh' : x < .28 ? 'kraut' : 'gruen';
                const groesse = trockenHalm ? .225 + wuchs * .055
                  : sorte === 'kraut' ? .085 + wuchs * .065 : .108 + wuchs * .109;
                const breite = sorte === 'kraut' ? .13 + wuchs * .10 : .105 + wuchs * .073;
                const quer = THREE.MathUtils.clamp(rand, freieSpur + breite * .65 + .04, halb + .34);
                const drehung = horstZufall() * TAU, ton = .71 + trocken * .21 + horstZufall() * .13;
                const auswahl = horstZufall(), splittwahl = horstZufall();
                if (l < 0 || l >= laenge) continue;
                const ort = punktAmBand(st, l, seite * quer, boden, -.012);
                if (!frei(ort) || weg.wohnwegZugaenge?.some(([x, z]) => Math.hypot(ort[0] - x, ort[2] - z) < 1.4)) continue;
                wildkraut.push({ ort, groesse, breite, drehung, ton, auswahl, sorte });
                if (splittwahl < .13) splitt.push({ ort, groesse: .042 + splittwahl * .64, drehung, ton, auswahl });
              }
            }
            continue;
          }

          const anzahl = Math.round(laenge * (1.1 + 10.2 * drang) * verfall);
          for (let k = 0; k < anzahl; k++) {
            const groesse = .14 + (.09 + .34 * drang) * zufall();
            const quer = Math.max(freieSpur + groesse * .59, mitte + (zufall() - .42) * (.70 + drang * .74));
            const laengs = laenge * (.07 + zufall() * .86);
            const ort = punktAmBand(st, laengs, seite * quer, boden, -.012);
            if (!frei(ort)) continue;
            wildkraut.push({ ort, groesse, drehung: zufall() * TAU, ton: .64 + zufall() * .58, auswahl: zufall() });
            if (zufall() < .18) splitt.push({
              ort, groesse: .045 + zufall() * .135, drehung: zufall() * TAU, ton: .6 + zufall() * .59, auswahl: zufall(),
            });
          }
        }

        if (weg.gebundenerBelag === false || laenge < .8 || zufall() > laenge * .135 * verfall) continue;
        const seite = zufall() < .5 ? -1 : 1;
        const anfang = laenge * (.23 + zufall() * .4);
        const reichweite = halb * (.35 + zufall() * .57);
        const versatz = (zufall() - .5) * Math.min(.9, laenge * .28);
        // Unregelmäßige, auslaufende Bruchfläche vom Rand zur Fahrbahnmitte.
        const verlauf = Array.from({ length: 6 }, (_, k) => {
          const t = k / 5, zacke = (zufall() - .5) * .19;
          return {
            laengs: anfang + versatz * t + zacke, quer: seite * (halb * .83 - reichweite * t),
            breit: (.014 + .023 * zufall()) * (1 - t * .85),
          };
        });
        const kanten = verlauf.map(({ laengs, quer, breit }) =>
          [punktAmBand(st, laengs - breit, quer, boden, .028), punktAmBand(st, laengs + breit, quer, boden, .028)] as const);
        if (!kanten.every(paare => paare.every(frei))) continue;
        const risskanten = kanten.map((paare, k) => paare.map(p => vertex(p, RISS, 1 - k * .135)));
        for (let k = 1; k < risskanten.length; k++) {
          const [a, b] = risskanten[k - 1], [c, d] = risskanten[k];
          indizes.push(a, b, c, b, d, c);
        }
        risse++;
      }
    }
  }

  const geos: THREE.BufferGeometry[] = [], materialien: THREE.Material[] = [];
  let entsorgt = false, platzhalter: THREE.DataTexture | undefined;
  if (positionen.length) {
    const flaeche = new THREE.BufferGeometry();
    flaeche.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
    flaeche.setAttribute('color', new THREE.Float32BufferAttribute(farben, 4));
    if (hatMarkierungen) flaeche.setAttribute('lack', new THREE.Float32BufferAttribute(lack, 2));
    flaeche.setIndex(indizes);
    // Auflagen übernehmen auf beiden Seiten die Normalenrichtung des Bodens.
    flaeche.setAttribute('normal', new THREE.Float32BufferAttribute(
      Float32Array.from({ length: positionen.length }, (_, i) => i % 3 === 1 ? 1 : 0), 3));
    flaeche.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, side: THREE.DoubleSide, transparent: true, forceSinglePass: true, depthWrite: false,
      roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nvarying vec2 vAuflage;
${hatMarkierungen ? 'attribute vec2 lack; varying vec2 vLack;' : ''}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nvAuflage = position.xz;
${hatMarkierungen ? 'vLack = lack;' : ''}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec2 vAuflage;
${hatMarkierungen ? 'varying vec2 vLack;\n' + BAND_RAUSCHEN_GLSL + ASPHALTRAND_GLSL : ''}
float auflageKorn(vec2 p) {
  return fract(sin(dot(mod(p, 4096.0), vec2(83.2, 35.1))) * 43758.5453);
}
float auflageRauschen(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f *= f * (3.0 - 2.0 * f);
  return mix(mix(auflageKorn(i), auflageKorn(i + vec2(1,0)), f.x),
             mix(auflageKorn(i + vec2(0,1)), auflageKorn(i + vec2(1,1)), f.x), f.y);
}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
  float moos = auflageRauschen(vAuflage * 9.0);
  float korn = auflageRauschen(vAuflage * 36.0);
  diffuseColor.rgb *= 0.75 + 0.42 * moos + 0.18 * korn;
  diffuseColor.a *= smoothstep(0.05, 0.49, moos * 0.51 + diffuseColor.a * 0.64);
${hatMarkierungen ? /* glsl */ `
  if (vLack.x >= 0.0) {
    float ausbruch = asphaltAufbruch(1.0 - vLack.x, bandRauschen(vAuflage * .29),
      bandRauschen(vAuflage * 2.1), vLack.y);
    diffuseColor.a *= (1.0 - ausbruch) * smoothstep(0.0, asphaltRandbreite(bandRauschen(vAuflage * .85)), vLack.x);
    diffuseColor.a *= smoothstep(.21, .56, moos * .61 + korn * .39);
  }
` : ''}`);
    };
    if (hatMarkierungen) material.customProgramCacheKey = () => 'strassenauflage-mit-lack';
    const mesh = new THREE.Mesh(flaeche, material);
    mesh.renderOrder = .5;
    mesh.receiveShadow = true;
    gruppe.add(mesh);
    geos.push(flaeche);
    materialien.push(material);
  }

  const instanzen = (geo: THREE.BufferGeometry, material: THREE.MeshStandardMaterial,
    eintraege: readonly Bewuchs[], istStein: boolean) => {
    const mesh = new THREE.InstancedMesh(geo, material, eintraege.length);
    eintraege.forEach(({ ort, groesse, breite = groesse, drehung, ton, auswahl }, i) => {
      matrix.makeRotationY(drehung);
      matrix.scale(skalierung.set(breite * (istStein ? 1.5 : 1), groesse * (istStein ? .48 : 1), breite));
      matrix.setPosition(ort[0], ort[1] + (istStein ? groesse * .27 : 0), ort[2]);
      mesh.setMatrixAt(i, matrix);
      if (istStein) farbe.copy(SPLITT).lerp(ERDE, auswahl * .47).multiplyScalar(ton);
      else farbe.setRGB(1.38 * ton, 1.53 * ton, 1.25 * ton);
      mesh.setColorAt(i, farbe);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    gruppe.add(mesh);
    geos.push(geo);
    materialien.push(material);
    return mesh;
  };

  if (splitt.length) instanzen(new THREE.IcosahedronGeometry(.5, 0),
    new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), splitt, true);

  if (wildkraut.length) {
    const geo = atlasKarten();
    const kacheln = new THREE.InstancedBufferAttribute(new Float32Array(wildkraut.length * 4), 4);
    platzhalter = leereHorstTextur();
    geo.setAttribute('kartenfeld', kacheln);
    const mat = new THREE.MeshStandardMaterial({
      map: platzhalter, alphaTest: HORST_SCHWELLE, alphaToCoverage: true, side: THREE.DoubleSide, roughness: .9,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 kartenfeld;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = kartenfeld.xy + uv * kartenfeld.zw;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
        '#include <normal_fragment_begin>\nnormal = normalize(vNormal);');
    };
    instanzen(geo, mat, wildkraut, false);
    if (typeof document !== 'undefined') {
      void ladeHorstAtlas().then(({ textur, kacheln: felder }) => {
        if (entsorgt) return;
        const gruen = felder.filter(k => k.art === 'gruen');
        const kraut = felder.filter(k => k.art === 'kraut');
        const trocken = felder.filter(k => k.art === 'stroh');
        const blume = felder.filter(k => k.art === 'blume');
        const sorten = { gruen, kraut, stroh: trocken, blume, halm: felder.filter(k => k.art === 'halm') };
        wildkraut.forEach((eintrag, i) => {
          const x = eintrag.auswahl;
          const art = eintrag.sorte ? sorten[eintrag.sorte] : x < .62 ? gruen : x < .81 ? kraut : x < .96 ? trocken : blume;
          const kachel = art[Math.floor((x * 37 % 1) * art.length)];
          if (kachel) kacheln.setXYZW(i, ...kachel.rect);
        });
        kacheln.needsUpdate = true;
        mat.map = textur;
        mat.needsUpdate = true;
        platzhalter?.dispose();
        platzhalter = undefined;
      }).catch((fehler: unknown) => console.warn('Straßenbewuchs: Grashorst-Atlas fehlt.', fehler));
    }
  }
  gruppe.userData.strassenbewuchs = {
    wildkraut: wildkraut.length, splitt: splitt.length, zufahrtskiesel, risse, auflageDreiecke: indizes.length / 3,
    ...(fahrbahnsaum ? { fahrbahnsaum } : {}),
    ...(inselhorste ? { inselhorste } : {}),
    ...(schwemmkiesel ? { schwemmkiesel } : {}),
    ...(saumhorste || saumflecken ? { saumhorste, saumflecken } : {}),
    ...(zufahrtshorste ? { zufahrtshorste } : {}),
    ...(nahthorste ? { nahthorste } : {}),
    ...(randlinsen ? { randlinsen, randhorste, randbruch } : {}),
    ...(wege.some(weg => weg.markierungen || weg.fahrbahnprofil) ? { markierungsMeter, markierungsDreiecke, asphaltSchollen } : {}),
  };
  return {
    gruppe,
    entsorge: () => {
      entsorgt = true;
      platzhalter?.dispose();
      geos.forEach(g => g.dispose());
      materialien.forEach(m => m.dispose());
      for (const kind of gruppe.children) if (kind instanceof THREE.InstancedMesh) kind.dispose();
    },
  };
}
