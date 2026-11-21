/**
 * BRACHLAND — Physikalischer Himmel als reine Rechnung (D368, `?himmel=physik`)
 *
 * Streuung in der Atmosphäre nach Hillaire 2020 („A Scalable and Production Ready Sky and
 * Atmosphere Rendering Technique“): Rayleigh, Mie (Aerosol) und Ozon über einer kugelförmigen Erde,
 * vorgerechnet in drei kleine Tabellen —
 *
 * 1. **Durchlass-Tabelle** (Transmittance-LUT, 64 × 64): optische Tiefe von jeder Höhe in jede
 *    Richtung bis zum Rand der Atmosphäre.
 * 2. **Mehrfachstreu-Tabelle** (16 × 16): Hillaires Näherung Ψ_ms = L₂ / (1 − f_ms) — die Streuung
 *    zweiter und höherer Ordnung als isotroper Zuschlag je Höhe und Sonnenstand.
 * 3. **Himmelsansicht** (Sky-View-LUT, 96 × 64): Strahldichte je Blickrichtung von der Kamera aus,
 *    Azimut relativ zur Sonne (symmetrisch, also nur 0…π), Höhenwinkel quadratisch zum Horizont hin
 *    verdichtet. Diese Tabelle liest der Himmelsshader (`physikhimmel.ts`) — ein Texturzugriff je
 *    Pixel statt eines Strahlmarsches.
 *
 * **Warum auf der CPU:** Die Tabellen hängen nur an der Stimmung (Sonnenstand, Luftzusammensetzung),
 * nicht am Bild. Sie werden einmal je Stimmung gerechnet (gemessen im Test: wenige zehn
 * Millisekunden), nie je Bild. Und dieselbe Rechnung liefert ohne Rücklesen von der GPU die Farben,
 * mit denen Nebel, Fernland, Fülllicht und Sonne an den Himmel gekoppelt werden (`koppleStimmung`).
 * Ohne three.js — deshalb unter Node testbar (`tests/atmosphaere.test.ts`).
 *
 * **Warum nicht three.js `Sky` (Preetham):** fester Satz analytischer Koeffizienten, bei tiefer Sonne
 * bekannt ungenau, keine Absorption im Aerosol. Genau die braucht das Zielbild: Der Render
 * (`tools/szenenbau.py` `welt()`) hat Nishita verworfen, weil klare Luft ein blaues Zenit und blaue
 * Schatten gibt — die Referenz ist warm. Physikalisch warm wird ein Himmel durch dichten Dunst, der
 * Blau stärker schluckt als Rot (Rauch, Staub; Absorptions-Albedo je Kanal). Das kann nur ein Modell
 * mit frei wählbarem Aerosol. **Warum nicht Takram/Bruneton (D249):** GPU-Vorberechnung in vier
 * Dimensionen, Versionskonflikt mit three, und es ersetzte nur den Hintergrund.
 *
 * Einheiten: Längen in km, Koeffizienten je km, Sonne mit Bestrahlungsstärke 1 je Kanal (weiss).
 * Kanäle R, G, B stehen für 680, 550 und 440 nm.
 */
import type { Atmosphaere, Stimmung } from './stimmung.js';

export type Rgb = [number, number, number];

/** Erdradius und Rand der Atmosphäre in km (Hillaire 2020, Tabelle 1). */
const RG = 6360, RT = 6460;
/**
 * Kamerahöhe über dem Modellboden in km. Der Modellboden ist die Talsohle, nicht Meereshöhe: Die
 * Aerosol-Dicke einer Stimmung meint den Dunst über dem Spieler, nicht den über der Nordsee.
 */
const KAMERA_KM = 0.05;
const WELLE = [680, 550, 440] as const;
/** Rayleigh-Streuung auf Meereshöhe je km (Hillaire 2020). */
const RAYLEIGH: Rgb = [5.802e-3, 13.558e-3, 33.1e-3];
const RAYLEIGH_HOEHE = 8;
/** Ozon-Absorption je km am Maximum (Hillaire 2020), Zeltprofil um 25 km, halbe Breite 15 km. */
const OZON: Rgb = [0.65e-3, 1.881e-3, 0.085e-3];

export const DURCHLASS_B = 64, DURCHLASS_H = 64;
export const MEHRFACH_N = 16;
export const ANSICHT_B = 96, ANSICHT_H = 64;

/** Vorgabe, wenn eine Stimmung nichts sagt: mitteleuropäischer Dunst, AOD 0,25. */
export const ATMOSPHAERE_VORGABE: Atmosphaere = {
  rayleigh: 1, aerosol: 0.25, angstroem: 1.0, albedo: [0.92, 0.9, 0.88], g: 0.76,
  aerosolHoehe: 1200, ozon: 1, bodenAlbedo: 0.15, dunstTiefe: 0.02,
};

interface Medium {
  rs: Rgb; ms: Rgb; me: Rgb; oa: Rgb; hm: number; g: number; boden: number;
}

function medium(a: Atmosphaere): Medium {
  const hm = a.aerosolHoehe / 1000;
  const me = WELLE.map(l => (a.aerosol / hm) * Math.pow(l / 550, -a.angstroem)) as Rgb;
  return {
    rs: RAYLEIGH.map(b => b * a.rayleigh) as Rgb,
    me, ms: me.map((e, i) => e * a.albedo[i]) as Rgb,
    oa: OZON.map(b => b * a.ozon) as Rgb,
    hm, g: a.g, boden: a.bodenAlbedo ?? 0.15,
  };
}

const dichteR = (h: number) => Math.exp(-Math.max(h, 0) / RAYLEIGH_HOEHE);
const dichteM = (h: number, hm: number) => Math.exp(-Math.max(h, 0) / hm);
const dichteO = (h: number) => Math.max(0, 1 - Math.abs(h - 25) / 15);

function extinktion(m: Medium, h: number, aus: Rgb): Rgb {
  const r = dichteR(h), mi = dichteM(h, m.hm), o = dichteO(h);
  for (let k = 0; k < 3; k++) aus[k] = m.rs[k] * r + m.me[k] * mi + m.oa[k] * o;
  return aus;
}

/** Abstand bis zur Kugel mit Radius `R` von Radius `r` aus, Richtung mit Kosinus `mu` zur Senkrechten. */
function bisKugel(r: number, mu: number, R: number): number {
  const d = r * r * (mu * mu - 1) + R * R;
  return d < 0 ? -1 : -r * mu + Math.sqrt(d);
}
/** Trifft der Strahl den Boden? Dann Abstand, sonst −1. */
function bisBoden(r: number, mu: number): number {
  if (mu >= 0) return -1;
  const d = r * r * (mu * mu - 1) + RG * RG;
  return d < 0 ? -1 : -r * mu - Math.sqrt(d);
}

export const phaseRayleigh = (c: number) => 3 / (16 * Math.PI) * (1 + c * c);
/** Cornette-Shanks wie Hillaire 2020 — Henyey-Greenstein mit physikalischerem Rückwärtsanteil. */
export function phaseMie(c: number, g: number): number {
  const g2 = g * g;
  const k = 3 / (8 * Math.PI) * (1 - g2) / (2 + g2);
  return k * (1 + c * c) / Math.pow(Math.max(1 + g2 - 2 * g * c, 1e-6), 1.5);
}

/** Durchlass-Tabelle: optische Tiefe je (Höhe, Kosinus zur Senkrechten). */
class Durchlass {
  readonly od = new Float32Array(DURCHLASS_B * DURCHLASS_H * 3);
  constructor(m: Medium) {
    const e: Rgb = [0, 0, 0];
    for (let j = 0; j < DURCHLASS_H; j++) {
      const h = Math.pow(j / (DURCHLASS_H - 1), 2) * (RT - RG);
      const r = RG + h;
      for (let i = 0; i < DURCHLASS_B; i++) {
        const u = i / (DURCHLASS_B - 1) * 2 - 1;
        const mu = Math.sign(u) * u * u;
        const o = (j * DURCHLASS_B + i) * 3;
        if (bisBoden(r, mu) >= 0) { this.od[o] = this.od[o + 1] = this.od[o + 2] = 80; continue; }
        const t = Math.max(bisKugel(r, mu, RT), 0);
        const n = 40, dt = t / n;
        let a0 = 0, a1 = 0, a2 = 0;
        for (let s = 0; s < n; s++) {
          const ts = (s + 0.5) * dt;
          const hs = Math.sqrt(r * r + ts * ts + 2 * r * mu * ts) - RG;
          extinktion(m, hs, e);
          a0 += e[0] * dt; a1 += e[1] * dt; a2 += e[2] * dt;
        }
        this.od[o] = a0; this.od[o + 1] = a1; this.od[o + 2] = a2;
      }
    }
  }
  /** Durchlass e^−τ von Höhe `h` (km) in Richtung `mu`; schreibt in `aus`. */
  lies(h: number, mu: number, aus: Rgb): Rgb {
    const v = Math.sqrt(Math.min(Math.max(h, 0) / (RT - RG), 1)) * (DURCHLASS_H - 1);
    const u = (Math.sign(mu) * Math.sqrt(Math.min(Math.abs(mu), 1)) * 0.5 + 0.5) * (DURCHLASS_B - 1);
    const i0 = Math.min(Math.floor(u), DURCHLASS_B - 2), j0 = Math.min(Math.floor(v), DURCHLASS_H - 2);
    const fu = u - i0, fv = v - j0;
    for (let k = 0; k < 3; k++) {
      const a = this.od[(j0 * DURCHLASS_B + i0) * 3 + k], b = this.od[(j0 * DURCHLASS_B + i0 + 1) * 3 + k];
      const c = this.od[((j0 + 1) * DURCHLASS_B + i0) * 3 + k], d = this.od[((j0 + 1) * DURCHLASS_B + i0 + 1) * 3 + k];
      aus[k] = Math.exp(-((a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv));
    }
    // Die Erde wirft Schatten: unter dem geometrischen Horizont kein Sonnenlicht.
    if (bisBoden(RG + Math.max(h, 0), mu) >= 0) aus[0] = aus[1] = aus[2] = 0;
    return aus;
  }
}

/** Fibonacci-Kugel: gleichmässig verteilte Richtungen für das Integral der Mehrfachstreuung. */
function kugelRichtungen(n: number): Rgb[] {
  const aus: Rgb[] = [];
  const gold = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y);
    aus.push([Math.cos(gold * i) * r, y, Math.sin(gold * i) * r]);
  }
  return aus;
}

/** Mehrfachstreu-Tabelle Ψ_ms je (Höhe, Sonnenkosinus), Hillaire 2020 §5.5. */
class Mehrfach {
  readonly psi = new Float32Array(MEHRFACH_N * MEHRFACH_N * 3);
  constructor(m: Medium, t: Durchlass) {
    const richtungen = kugelRichtungen(32);
    const e: Rgb = [0, 0, 0], ts: Rgb = [0, 0, 0];
    for (let j = 0; j < MEHRFACH_N; j++) {
      const h = Math.pow(j / (MEHRFACH_N - 1), 2) * (RT - RG);
      const r = RG + h;
      for (let i = 0; i < MEHRFACH_N; i++) {
        const muS = i / (MEHRFACH_N - 1) * 2 - 1;
        const sonne: Rgb = [Math.sqrt(1 - muS * muS), muS, 0];
        const L2: Rgb = [0, 0, 0], fms: Rgb = [0, 0, 0];
        for (const w of richtungen) {
          const mu = w[1];
          const boden = bisBoden(r, mu);
          const tMax = boden >= 0 ? boden : Math.max(bisKugel(r, mu, RT), 0);
          const n = 16, dt = tMax / n;
          const T: Rgb = [1, 1, 1];
          for (let s = 0; s < n; s++) {
            const tt = (s + 0.5) * dt;
            const px = w[0] * tt, py = r + w[1] * tt, pz = w[2] * tt;
            const rs = Math.hypot(px, py, pz), hs = rs - RG;
            const muSs = (px * sonne[0] + py * sonne[1] + pz * sonne[2]) / rs;
            extinktion(m, hs, e);
            t.lies(hs, muSs, ts);
            const dR = dichteR(hs), dM = dichteM(hs, m.hm);
            for (let k = 0; k < 3; k++) {
              const sig = m.rs[k] * dR + m.ms[k] * dM;
              const schritt = Math.exp(-e[k] * dt);
              const integ = e[k] > 0 ? (1 - schritt) / e[k] : dt;
              L2[k] += T[k] * sig * ts[k] / (4 * Math.PI) * integ;
              fms[k] += T[k] * sig * integ;
              T[k] *= schritt;
            }
          }
          if (boden >= 0) {
            // Bodenreflexion: Lambert mit der Bodenalbedo, beleuchtet von der durchgelassenen Sonne.
            // Näherung: Bodennormale senkrecht, der Auftreffpunkt liegt nah.
            const muG = Math.max(0, muS);
            t.lies(0, muS, ts);
            for (let k = 0; k < 3; k++) L2[k] += T[k] * ts[k] * muG * m.boden / Math.PI;
          }
        }
        const o = (j * MEHRFACH_N + i) * 3;
        for (let k = 0; k < 3; k++) {
          // Isotropes Integral über die Kugel: Mittel der Richtungen.
          const l2 = L2[k] / richtungen.length, f = fms[k] / richtungen.length;
          this.psi[o + k] = l2 / Math.max(1 - f, 1e-3);
        }
      }
    }
  }
  lies(h: number, muS: number, aus: Rgb): Rgb {
    const v = Math.sqrt(Math.min(Math.max(h, 0) / (RT - RG), 1)) * (MEHRFACH_N - 1);
    const u = (Math.min(Math.max(muS, -1), 1) * 0.5 + 0.5) * (MEHRFACH_N - 1);
    const i0 = Math.min(Math.floor(u), MEHRFACH_N - 2), j0 = Math.min(Math.floor(v), MEHRFACH_N - 2);
    const fu = u - i0, fv = v - j0;
    const p = this.psi, o00 = (j0 * MEHRFACH_N + i0) * 3, o10 = o00 + MEHRFACH_N * 3;
    for (let k = 0; k < 3; k++) {
      aus[k] = (p[o00 + k] * (1 - fu) + p[o00 + 3 + k] * fu) * (1 - fv) + (p[o10 + k] * (1 - fu) + p[o10 + 3 + k] * fu) * fv;
    }
    return aus;
  }
}

/** Ein Blickstrahl von der Kamera: Strahldichte je Einheit Sonnenbestrahlung. */
function strahl(m: Medium, t: Durchlass, ms: Mehrfach, hoehenwinkel: number, azimut: number,
  sonnenhoehe: number, aus: Rgb): Rgb {
  const r0 = RG + KAMERA_KM;
  const ce = Math.cos(hoehenwinkel);
  const w: Rgb = [ce * Math.cos(azimut), Math.sin(hoehenwinkel), ce * Math.sin(azimut)];
  const sonne: Rgb = [Math.cos(sonnenhoehe), Math.sin(sonnenhoehe), 0];
  const c = w[0] * sonne[0] + w[1] * sonne[1];
  const pR = phaseRayleigh(c), pM = phaseMie(c, m.g);
  const boden = bisBoden(r0, w[1]);
  const tMax = boden >= 0 ? boden : bisKugel(r0, w[1], RT);
  const n = 32;
  const e: Rgb = [0, 0, 0], ts: Rgb = [0, 0, 0], psi: Rgb = [0, 0, 0];
  const T: Rgb = [1, 1, 1];
  aus[0] = aus[1] = aus[2] = 0;
  let tAlt = 0;
  for (let s = 0; s < n; s++) {
    // Quadratisch verteilte Schritte: dicht an der Kamera, wo der Dunst sitzt.
    const tNeu = tMax * Math.pow((s + 1) / n, 2);
    const tt = 0.5 * (tAlt + tNeu), dt = tNeu - tAlt;
    tAlt = tNeu;
    const px = w[0] * tt, py = r0 + w[1] * tt, pz = w[2] * tt;
    const rs = Math.hypot(px, py, pz), hs = rs - RG;
    const muS = (px * sonne[0] + py * sonne[1]) / rs;
    extinktion(m, hs, e);
    t.lies(hs, muS, ts);
    ms.lies(hs, muS, psi);
    const dR = dichteR(hs), dM = dichteM(hs, m.hm);
    for (let k = 0; k < 3; k++) {
      const sR = m.rs[k] * dR, sM = m.ms[k] * dM;
      const quelle = (sR * pR + sM * pM) * ts[k] + (sR + sM) * psi[k];
      const schritt = Math.exp(-e[k] * dt);
      aus[k] += T[k] * quelle * (e[k] > 0 ? (1 - schritt) / e[k] : dt);
      T[k] *= schritt;
    }
  }
  if (boden >= 0) {
    t.lies(0, sonne[1], ts);
    for (let k = 0; k < 3; k++) aus[k] += T[k] * ts[k] * Math.max(sonne[1], 0) * m.boden / Math.PI;
  }
  return aus;
}

/** Höhenwinkel der Zeile `v` (0…1) der Himmelsansicht — quadratisch zum Horizont verdichtet. */
export function ansichtHoehenwinkel(v: number): number {
  const d = 2 * v - 1;
  return Math.sign(d) * d * d * Math.PI / 2;
}

export interface PhysikHimmel {
  /** Himmelsansicht RGB, linear, schon mit `skala` multipliziert. Zeilen = Höhenwinkel. */
  ansicht: Float32Array;
  /** Faktor physikalisch → Szene (siehe `rechneHimmel`). */
  skala: number;
  /** Mittlere Strahldichte knapp über dem Horizont (Mittel über alle Azimute), linear, skaliert. */
  horizont: Rgb;
  zenit: Rgb;
  /** Bestrahlungsstärke der Sonne am Boden (Durchlass × 1), unskaliert. */
  sonneBoden: Rgb;
  /** Dasselbe in Wolkenhöhe — Licht auf der Wolkenoberseite. */
  sonneWolke: Rgb;
  /** Himmelslicht auf eine waagerechte Fläche / π (= mittlere Strahldichte der Kuppel), skaliert. */
  umfeld: Rgb;
  /** Senkrechte optische Tiefe Kamera → Wolkenhöhe je Kanal (Luftperspektive der Wolken). */
  tauWolke: Rgb;
  /** Rechenzeit in ms (alle drei Tabellen). */
  ms: number;
}

export function sonnenHoehe(sonnenstand: readonly [number, number, number]): number {
  const [x, y, z] = sonnenstand;
  return Math.atan2(y, Math.hypot(x, z));
}

/** Leuchtdichte (Rec. 709, linear). */
export const leuchtdichte = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** Lineare Leuchtdichten, die der Himmel treffen soll — die Kunstwerte der Stimmung. */
export interface HimmelZiel { zenit: number; horizont: number }

const roh = new Map<string, PhysikHimmel>();
const zwischen = new Map<string, PhysikHimmel>();

/**
 * Alle Tabellen für eine Atmosphäre und einen Sonnenstand, auf die Szene skaliert.
 *
 * **Eine** Zahl bleibt frei: wie hell die Sonne in Szeneneinheiten ist. Sie wird so gewählt, dass
 * Zenit und Horizontmittel die Leuchtdichten der Stimmung im Mittel treffen (geometrisches Mittel der
 * beiden Verhältnisse, also kleinster Fehler in Blenden). Verteilung und Farbe kommen aus der
 * Physik, die Gesamthelligkeit aus der Kunst — die Belichtung je Stimmung ist eingemessen (D118).
 * Die Tabellen hängen nicht am Ziel und werden je (Luft, Sonne) einmal gerechnet; Szene,
 * Wasserhimmel und Umgebungslicht fragen dieselbe Stimmung dreimal an.
 */
export function rechneHimmel(a: Atmosphaere, sonnenstand: readonly [number, number, number],
  ziel: HimmelZiel): PhysikHimmel {
  const schluessel = JSON.stringify([a, sonnenstand, ziel.zenit.toFixed(5), ziel.horizont.toFixed(5)]);
  const alt = zwischen.get(schluessel);
  if (alt) return alt;
  const r = rechneRoh(a, sonnenstand);
  const skala = Math.sqrt(ziel.zenit / Math.max(leuchtdichte(r.zenit), 1e-9)
    * ziel.horizont / Math.max(leuchtdichte(r.horizont), 1e-9));
  const s = (c: Rgb) => c.map(x => x * skala) as Rgb;
  const ergebnis: PhysikHimmel = {
    ...r, ansicht: r.ansicht.map(x => x * skala), skala,
    horizont: s(r.horizont), zenit: s(r.zenit), umfeld: s(r.umfeld),
  };
  zwischen.set(schluessel, ergebnis);
  return ergebnis;
}

function rechneRoh(a: Atmosphaere, sonnenstand: readonly [number, number, number]): PhysikHimmel {
  const schluessel = JSON.stringify([a, sonnenstand]);
  const alt = roh.get(schluessel);
  if (alt) return alt;
  const beginn = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const m = medium(a);
  const t = new Durchlass(m);
  const mf = new Mehrfach(m, t);
  const es = sonnenHoehe(sonnenstand);
  const ansicht = new Float32Array(ANSICHT_B * ANSICHT_H * 3);
  const l: Rgb = [0, 0, 0];
  for (let j = 0; j < ANSICHT_H; j++) {
    const e = ansichtHoehenwinkel(j / (ANSICHT_H - 1));
    for (let i = 0; i < ANSICHT_B; i++) {
      strahl(m, t, mf, e, i / (ANSICHT_B - 1) * Math.PI, es, l);
      ansicht.set(l, (j * ANSICHT_B + i) * 3);
    }
  }
  // Horizontmittel: 1° über dem Horizont, über den vollen Kreis (Tabelle ist spiegelsymmetrisch).
  const horizont: Rgb = [0, 0, 0];
  const n = 24;
  for (let i = 0; i < n; i++) {
    strahl(m, t, mf, Math.PI / 180, (i + 0.5) / n * Math.PI, es, l);
    for (let k = 0; k < 3; k++) horizont[k] += l[k] / n;
  }
  const zenit = strahl(m, t, mf, Math.PI / 2 - 1e-4, 0, es, [0, 0, 0]);
  // Kuppel: Σ L·cos θ dω über die obere Hälfte, aus der Tabelle (beide Azimut-Hälften).
  const umfeld: Rgb = [0, 0, 0];
  let gewicht = 0;
  for (let j = 0; j < ANSICHT_H - 1; j++) {
    const e0 = ansichtHoehenwinkel(j / (ANSICHT_H - 1)), e1 = ansichtHoehenwinkel((j + 1) / (ANSICHT_H - 1));
    if (e1 <= 0) continue;
    const em = 0.5 * (Math.max(e0, 0) + e1), de = e1 - Math.max(e0, 0);
    const w = Math.sin(em) * Math.cos(em) * de;
    for (let i = 0; i < ANSICHT_B; i++) {
      const o0 = (j * ANSICHT_B + i) * 3, o1 = ((j + 1) * ANSICHT_B + i) * 3;
      for (let k = 0; k < 3; k++) umfeld[k] += w * 0.5 * (ansicht[o0 + k] + ansicht[o1 + k]);
    }
    gewicht += w * ANSICHT_B;
  }
  for (let k = 0; k < 3; k++) umfeld[k] /= gewicht;   // mittlere kosinusgewichtete Strahldichte
  const sonneBoden = t.lies(KAMERA_KM, Math.sin(es), [0, 0, 0]);
  const wolkeKm = KAMERA_KM + (a.wolkenHoehe ?? 2000) / 1000;
  const sonneWolke = t.lies(wolkeKm, Math.sin(es), [0, 0, 0]);
  const dh = wolkeKm - KAMERA_KM;
  const tauWolke = [0, 1, 2].map(k =>
    m.rs[k] * RAYLEIGH_HOEHE * (dichteR(KAMERA_KM) - dichteR(wolkeKm))
    + m.me[k] * m.hm * (dichteM(KAMERA_KM, m.hm) - dichteM(wolkeKm, m.hm))
    + m.oa[k] * dichteO(KAMERA_KM) * dh) as Rgb;

  const ende = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const ergebnis: PhysikHimmel = {
    ansicht, skala: 1, horizont, zenit, sonneBoden, sonneWolke, umfeld, tauWolke, ms: ende - beginn,
  };
  roh.set(schluessel, ergebnis);
  return ergebnis;
}

// ——— Farbumrechnung ohne three.js (sRGB-Hex ↔ linear), wie THREE.Color mit ColorManagement.
const nachLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const nachSrgb = (c: number) => c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
export function hexLinear(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16);
  return [nachLinear((n >> 16 & 255) / 255), nachLinear((n >> 8 & 255) / 255), nachLinear((n & 255) / 255)];
}
export function linearHex(c: readonly number[]): string {
  return '#' + c.map(x => Math.round(Math.min(Math.max(nachSrgb(Math.max(x, 0)), 0), 1) * 255)
    .toString(16).padStart(2, '0')).join('');
}
/** Farbton der Physik, Helligkeit der Stimmung: `farbe` auf die Leuchtdichte von `vorlage` bringen. */
export function mitLeuchtdichte(farbe: readonly number[], vorlage: string): string {
  const y = leuchtdichte(hexLinear(vorlage)), yf = Math.max(leuchtdichte(farbe), 1e-9);
  return linearHex(farbe.map(x => x * y / yf));
}

/**
 * Stimmung an den physikalischen Himmel koppeln (Luftperspektive): Nebel, Horizont (= Dunst des
 * Fernlands), Zenit, Sonnen- und Fülllichtfarbe kommen aus derselben Rechnung wie der Himmel.
 *
 * **Was die Stimmung behält:** alle Stärken, Belichtung, Nebelweiten, Schatten — die eingemessenen
 * Zahlen (D118, D152, D172). Die Helligkeit von Nebel, Sonne und Fülllicht bleibt die der Stimmung;
 * nur der Farbton wandert. Die Kopplung ändert also, *welche* Farbe das Licht hat, nicht *wie viel*
 * davon da ist. Der Nebel trägt den Farbton des Horizontmittels — die Farbe, gegen die ein langer
 * waagerechter Weg durch die Luft strebt —, der Horizont (Dunstziel des Fernlands) ist das
 * Horizontmittel selbst, also genau, was der Himmel dort zeigt.
 */
export function koppleStimmung(s: Stimmung, a: Atmosphaere = s.atmosphaere ?? ATMOSPHAERE_VORGABE): Stimmung {
  const p = rechneHimmel(a, s.sonnenstand, zielDerStimmung(s.zenit, s.horizont));
  const horizont = linearHex(p.horizont), zenit = linearHex(p.zenit);
  nachFarbe.set(farbSchluessel(a, s.sonnenstand, zenit, horizont), p);
  return {
    ...s,
    atmosphaere: a,
    nebel: mitLeuchtdichte(p.horizont, s.nebel),
    horizont,
    zenit,
    sonne: mitLeuchtdichte(p.sonneBoden, s.sonne),
    umgebung: mitLeuchtdichte(p.umfeld, s.umgebung),
    himmel: mitLeuchtdichte(p.umfeld, s.himmel),
  };
}

const zielDerStimmung = (zenit: string, horizont: string): HimmelZiel =>
  ({ zenit: leuchtdichte(hexLinear(zenit)), horizont: leuchtdichte(hexLinear(horizont)) });
const nachFarbe = new Map<string, PhysikHimmel>();
const farbSchluessel = (a: Atmosphaere, sonnenstand: readonly number[], zenit: string, horizont: string) =>
  JSON.stringify([a, sonnenstand, zenit.toLowerCase(), horizont.toLowerCase()]);

/**
 * Den Himmel zu einer schon gekoppelten Stimmung finden: Himmelskugel, Wasserhimmel und
 * Umgebungslicht kennen nur die gekoppelten Farben (8 Bit gerundet). Über sie findet sich die
 * Skalierung von `koppleStimmung` wieder; ohne Eintrag ergibt dieselbe Rechnung (fast) dieselbe
 * Skala, denn Zenit und Horizont tragen sie schon.
 */
export function himmelZuFarben(a: Atmosphaere, sonnenstand: readonly [number, number, number],
  zenit: string, horizont: string): PhysikHimmel {
  return nachFarbe.get(farbSchluessel(a, sonnenstand, zenit, horizont))
    ?? rechneHimmel(a, sonnenstand, zielDerStimmung(zenit, horizont));
}

/** Atmosphären mischen (Tageslauf, `stimmungBei`): linear in jedem Wert. */
export function mischeAtmosphaere(a: Atmosphaere, b: Atmosphaere, f: number): Atmosphaere {
  const z = (x: number, y: number) => x + (y - x) * f;
  return {
    rayleigh: z(a.rayleigh, b.rayleigh), aerosol: z(a.aerosol, b.aerosol),
    angstroem: z(a.angstroem, b.angstroem),
    albedo: [z(a.albedo[0], b.albedo[0]), z(a.albedo[1], b.albedo[1]), z(a.albedo[2], b.albedo[2])],
    g: z(a.g, b.g), aerosolHoehe: z(a.aerosolHoehe, b.aerosolHoehe), ozon: z(a.ozon, b.ozon),
    bodenAlbedo: z(a.bodenAlbedo ?? 0.15, b.bodenAlbedo ?? 0.15),
    dunstTiefe: z(a.dunstTiefe, b.dunstTiefe),
    wolkenHoehe: z(a.wolkenHoehe ?? 2000, b.wolkenHoehe ?? 2000),
  };
}
