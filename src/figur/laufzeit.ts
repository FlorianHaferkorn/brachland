/**
 * BRACHLAND — Laufzeit der Bewegung am Skelett (D457): die Brücke von den reinen Modulen dieses Verzeichnisses
 * zu three.js. **Einziges Modul in `src/figur/`, das three.js kennt** — die Formeln liegen daneben und sind
 * renderfrei geprüft (`tests/figurlaufzeit.test.ts`).
 *
 * Drei Bausteine, je Figur einmal angelegt, im Bild ohne neue Objekte:
 *
 * - `PosenTraegheit`: Inertialisierung nach dem Mixer (`inertial.ts`). `wechsel(dauer)` vor einem harten
 *   Clipwechsel, `nachMixer(dt)` nach `mixer.update`, `ende()` am Schluss des Bilds.
 * - `Koerperfein`: alles über den Clips — Drehkette, Neigen, Blick, Atem, Trefferantwort, Füsse am Boden.
 * - `teileClip`, `messeGang`: Ebenen (Ober-/Unterkörper als Teilclips) und das Tempo eines Gangclips.
 *
 * **Warum `ende()`:** Der `AnimationMixer` schreibt einen Knochen nur, wenn sich sein Wert seit dem letzten Bild
 * geändert hat. Steht ein Clip (Hieb im Trefferstopp, gehaltene Deckung), bleibt im Knochen, was das letzte Bild
 * daraufgelegt hat — jede additive Drehung würde sich Bild für Bild aufsummieren. `ende()` merkt sich, was am
 * Schluss im Knochen steht; findet `nachMixer` genau das wieder vor, hat der Mixer nicht geschrieben, und die
 * rohe Pose des Clips wird zurückgelegt, bevor irgendetwas darauf rechnet.
 *
 * Gebaut gegen einen `Rigplan` (`ebenen.ts`), nicht gegen feste Knochennamen: Hauptfigur, Axtmann und
 * Wegelagerer teilen `RIG_MENSCH`; ein Vierbeiner bringt einen Plan mit vier Beinen mit (D458).
 *
 * **D458 — Vierbeiner und Zusatz.** Mit Beinpaaren im Plan (`paar`) und `FeinOptionen.vier` trägt jedes Paar
 * seinen Gürtel (`vierbeiner.ts`): Der Rumpf liegt als Gerade zwischen Schulter und Becken, die Läufe bleiben, wo
 * der Clip sie hinsetzt, und der Kopf gleicht das Nicken aus. `FeinEingabe.zusatz` (`ansage.ts`) legt die
 * Körpersprache der Gegner darüber — Ansage, Taumeln, Schütteln: beim Tier bewegt sie den Rumpf **über stehenden
 * Läufen** (Gewicht zurück heisst: die Füsse bleiben), beim Menschen Wirbelsäule und Kopf.
 */
import * as THREE from 'three';
import { neueTraegheit, starteUebergang, wendeAn, type Traegheit } from './inertial.js';
import { teileSpuren, type Rigplan } from './ebenen.js';
import { paarHoehe, rumpfLage, seitLage, type Rumpflage, type RumpfWerte } from './vierbeiner.js';
import type { Zusatz } from './ansage.js';
import type { Figurlaufzeit } from '../data/schema.js';
import { beckenSenkung, begrenzeNormale, bodenNormale, fuehreStandfuss, neuerStandfuss, type Standfuss } from './fussboden.js';
import {
  atemSchritt, blickWinkel, drehSchritt, kurvenNeigung, natuerlichesTempo, neueDrehkette, neuerAtem, schubNeigung, standMitte,
  type Atem, type Bahnpunkt, type Drehkette,
} from './fortbewegung.js';
import { federSchritt, klemme, neueFeder, type Feder } from './feder.js';
import { neueTrefferantwort, stosseFigur, stosseGrad, trefferSchritt, type Trefferantwort } from './trefferantwort.js';
import { FIGUR, GRAD } from './werte.js';
import { zweiKnochen } from '../spieler/fussik.js';

// ---- Trägheit am Skelett ---------------------------------------------------------------------------------------

/** Alle Knochen unter `wurzel`, Eltern vor Kindern. */
export function sammleKnochen(wurzel: THREE.Object3D): THREE.Object3D[] {
  const aus: THREE.Object3D[] = [];
  wurzel.traverse(o => { if ((o as THREE.Bone).isBone) aus.push(o); });
  return aus;
}

export class PosenTraegheit {
  readonly knochen: THREE.Object3D[];
  private z: Traegheit;
  /** Rohpose des Mixers in diesem Bild, die gezeigte Pose des letzten und vorletzten Bilds, und was `ende()` vorfand. */
  private roh: Float64Array; private vorher: Float64Array; private davor: Float64Array; private schluss: Float64Array;
  private lroh: Float64Array; private lvorher: Float64Array; private ldavor: Float64Array; private lschluss: Float64Array;
  private dtVor = 0;
  private offen = -1;
  private bereit = false;

  constructor(knochen: THREE.Object3D[]) {
    const n = knochen.length;
    this.knochen = knochen;
    this.z = neueTraegheit(n);
    this.roh = new Float64Array(4 * n); this.vorher = new Float64Array(4 * n); this.davor = new Float64Array(4 * n); this.schluss = new Float64Array(4 * n);
    this.lroh = new Float64Array(3 * n); this.lvorher = new Float64Array(3 * n); this.ldavor = new Float64Array(3 * n); this.lschluss = new Float64Array(3 * n);
  }

  /** Vor einem harten Clipwechsel: Der Versatz zur neuen Pose klingt über `dauer` Sekunden ab. */
  wechsel(dauer: number): void { this.offen = Math.max(this.offen, dauer); }

  /** Klingt gerade etwas ab? */
  get laeuft(): boolean { return this.z.laeuft; }

  /** Alles vergessen (Figur neu aufgestellt, Schalter aus) — das nächste Bild beginnt ohne Versatz. */
  ruhe(): void { this.bereit = false; this.offen = -1; this.z.laeuft = false; }

  /**
   * Nach `mixer.update`: Rohpose sichern (und zurücklegen, wo der Mixer nicht geschrieben hat), einen offenen
   * Wechsel beginnen, den Versatz auflegen. Danach stehen die Knochen in der **gezeigten Clip-Pose**; alles
   * Weitere (Drehkette, Blick, Füsse) legt sich darauf.
   */
  nachMixer(dt: number): void {
    const { knochen, roh, lroh, schluss, lschluss } = this;
    const n = knochen.length;
    for (let i = 0; i < n; i++) {
      const q = knochen[i].quaternion, p = knochen[i].position, o = i * 4, l = i * 3;
      if (this.bereit && q.x === schluss[o] && q.y === schluss[o + 1] && q.z === schluss[o + 2] && q.w === schluss[o + 3]) {
        q.set(roh[o], roh[o + 1], roh[o + 2], roh[o + 3]);
      } else { roh[o] = q.x; roh[o + 1] = q.y; roh[o + 2] = q.z; roh[o + 3] = q.w; }
      if (this.bereit && p.x === lschluss[l] && p.y === lschluss[l + 1] && p.z === lschluss[l + 2]) {
        p.set(lroh[l], lroh[l + 1], lroh[l + 2]);
      } else { lroh[l] = p.x; lroh[l + 1] = p.y; lroh[l + 2] = p.z; }
    }
    if (this.offen >= 0 && this.bereit) {
      starteUebergang(this.z, this.vorher, this.davor, roh, this.dtVor, this.offen, this.lvorher, this.ldavor, lroh);
    }
    this.offen = -1;
    // Gezeigte Pose = Rohpose + Versatz. `vorher` wird zum Arbeitsfeld für dieses Bild.
    const t = this.davor; this.davor = this.vorher; this.vorher = t;
    const lt = this.ldavor; this.ldavor = this.lvorher; this.lvorher = lt;
    this.vorher.set(roh); this.lvorher.set(lroh);
    if (wendeAn(this.z, this.vorher, dt, this.lvorher)) {
      const v = this.vorher, lv = this.lvorher;
      for (let i = 0; i < n; i++) {
        const o = i * 4, l = i * 3;
        knochen[i].quaternion.set(v[o], v[o + 1], v[o + 2], v[o + 3]);
        knochen[i].position.set(lv[l], lv[l + 1], lv[l + 2]);
      }
    }
    if (!this.bereit) { this.davor.set(this.vorher); this.ldavor.set(this.lvorher); }
    this.dtVor = dt;
    this.bereit = true;
  }

  /** Am Schluss des Bilds, nach allem, was Knochen dreht (auch Sitzpose und Fuss-IK). */
  ende(): void {
    const { knochen, schluss, lschluss } = this;
    for (let i = 0; i < knochen.length; i++) {
      const q = knochen[i].quaternion, p = knochen[i].position, o = i * 4, l = i * 3;
      schluss[o] = q.x; schluss[o + 1] = q.y; schluss[o + 2] = q.z; schluss[o + 3] = q.w;
      lschluss[l] = p.x; lschluss[l + 1] = p.y; lschluss[l + 2] = p.z;
    }
  }
}

// ---- Ebenen und Gang -------------------------------------------------------------------------------------------

/** Knochen → Elternknochen, für `nachfahren`. */
export function elternkarte(wurzel: THREE.Object3D): Map<string, string | null> {
  const k = new Map<string, string | null>();
  wurzel.traverse(o => { if ((o as THREE.Bone).isBone) k.set(o.name, (o.parent as THREE.Bone | null)?.isBone ? o.parent!.name : null); });
  return k;
}

/** Einen Clip in Oberkörper und Rest teilen (`ebenen.ts`). Die Teilclips teilen sich die Spuren des Originals. */
export function teileClip(clip: THREE.AnimationClip, ober: ReadonlySet<string>): { ober: THREE.AnimationClip; unter: THREE.AnimationClip } {
  const t = teileSpuren(clip.tracks.map(s => s.name), ober);
  return {
    ober: new THREE.AnimationClip(`${clip.name}#ober`, clip.duration, t.ober.map(i => clip.tracks[i])),
    unter: new THREE.AnimationClip(`${clip.name}#unter`, clip.duration, t.unter.map(i => clip.tracks[i])),
  };
}

const _mv = new THREE.Vector3();
/**
 * Einen Gangclip am Skelett vermessen: der Clip wird einmal in `proben` Schritten durchgestellt und die Bahn
 * jedes Fusses im Raum der Figur gelesen. `tempo`: wie schnell der Clip bei Rate 1 über den Boden kommt
 * (`natuerlichesTempo`, Mittel über die Füsse; `null`, wenn keiner steht). `tief`: die tiefste Höhe jedes
 * Fussknochens — so hoch sitzt er über dem Boden, wenn der Fuss steht. `standMitte`: wo im Zyklus der erste Fuss
 * steht (zum Abgleich zweier Gangclips). Einmal beim Laden, nie im Bild.
 */
export function messeGang(wurzel: THREE.Object3D, clip: THREE.AnimationClip, fuesse: readonly THREE.Object3D[], standHoehe: number, proben = 32):
  { tempo: number | null; tief: number[]; standMitte: number | null } {
  if (!fuesse.length || !(clip.duration > 0)) return { tempo: null, tief: [], standMitte: null };
  const mixer = new THREE.AnimationMixer(wurzel);
  const a = mixer.clipAction(clip);
  a.play();
  const bahnen: Bahnpunkt[][] = fuesse.map(() => []);
  for (let i = 0; i <= proben; i++) {
    a.time = Math.min(clip.duration * 0.9999, (clip.duration * i) / proben);
    mixer.update(0);
    wurzel.updateMatrixWorld(true);
    fuesse.forEach((f, k) => {
      wurzel.worldToLocal(f.getWorldPosition(_mv));
      bahnen[k].push({ t: (clip.duration * i) / proben, x: _mv.x, y: _mv.y, z: _mv.z });
    });
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(wurzel);
  const werte = bahnen.map(b => natuerlichesTempo(b, standHoehe)).filter((v): v is number => v !== null);
  return {
    tempo: werte.length ? werte.reduce((s, v) => s + v, 0) / werte.length : null,
    tief: bahnen.map(b => b.reduce((m, p) => Math.min(m, p.y), Infinity)),
    standMitte: standMitte(bahnen[0], standHoehe),
  };
}

// ---- Körper über den Clips -------------------------------------------------------------------------------------

interface Bein {
  ober: THREE.Object3D; unter: THREE.Object3D; fuss: THREE.Object3D; ruhe: number; halt: Standfuss; versatz: number; wx: number; wz: number;
  /** D458: Gürtel des Beins und die Sohle aus dem Clip in diesem Bild (Welt). */
  paar?: 'vorn' | 'hinten'; spitze: boolean; cx: number; cy: number; cz: number;
  /** D458: gestreckte Länge des Beins (Ruhelage) und das Ziel der Sohle in diesem Bild. */
  lang: number; zx: number; zy: number; zz: number;
}

/**
 * D458: Fussknoten eines Plans in dessen Reihenfolge. Für Läufe ohne Fussknochen (`spitze`) wird der Hilfspunkt
 * an der Sohle angelegt: am Ende von `unter`, in dessen Längsrichtung bis auf die Höhe der Wurzel — **in der
 * Ruhelage aufrufen** (vor dem ersten Mixer-Schritt), dort steht das Tier. Fehlt ein Knochen, steht `null`.
 */
export function fussKnoten(wurzel: THREE.Object3D, plan: Rigplan): (THREE.Object3D | null)[] {
  wurzel.updateMatrixWorld(true);
  const grund = wurzel.getWorldPosition(new THREE.Vector3()).y;
  return plan.beine.map(b => {
    const da = wurzel.getObjectByName(b.fuss);
    if (da || !b.spitze) return da ?? null;
    const unter = wurzel.getObjectByName(b.unter);
    if (!unter) return null;
    const kopf = unter.getWorldPosition(new THREE.Vector3());
    const laengs = new THREE.Vector3(0, 1, 0).applyQuaternion(unter.getWorldQuaternion(new THREE.Quaternion()));
    // Zeigt der Knochen kaum nach unten, liegt die Sohle lotrecht unter seinem Kopf.
    const sohle = laengs.y < -0.3 ? kopf.clone().addScaledVector(laengs, (kopf.y - grund) / -laengs.y) : new THREE.Vector3(kopf.x, grund, kopf.z);
    const punkt = new THREE.Object3D();
    punkt.name = b.fuss;
    punkt.position.copy(unter.worldToLocal(sohle));
    unter.add(punkt);
    punkt.updateMatrixWorld(true);
    return punkt;
  });
}

/** D458: Abweichungen vom Menschen — eigene Drehkette, und für Tiere die Rumpflage je Beinpaar. */
export interface FeinOptionen {
  drehen?: Figurlaufzeit['drehen'];
  vier?: RumpfWerte & { kopfAusgleich: number };
}

const KEIN_ZUSATZ: Zusatz = { rumpfX: 0, rumpfY: 0, rumpfZ: 0, rumpfNick: 0, rumpfRoll: 0, rumpfGier: 0, kopfNick: 0, kopfGier: 0, kopfRoll: 0 };

export interface FeinEingabe {
  /** Blickrichtung der Regel (rad, 0 = −Z, positiv links). */
  gier: number;
  /** Tempo über Grund in m/s und das Renntempo (für die Anstrengung). */
  tempo: number;
  rennen: number;
  /** 0…1: wie straff die Figur der Regel folgt (im Schlag, in der Rolle 1). */
  straff: number;
  /** Ziel des Blicks in der Welt, oder null. */
  fokus: { x: number; y: number; z: number } | null;
  /** Steht ruhig (Atem sichtbar). */
  steht: boolean;
  /** Geländehöhe; ohne sie bleiben die Füsse, wo der Clip sie hinsetzt. */
  hoeheAn?: (x: number, z: number) => number;
  /** Füsse dürfen auf den Boden (nicht im Sattel). */
  fuesse: boolean;
  /** Standfüsse dürfen halten (nicht in Rolle, Fall, Treffer). */
  halten: boolean;
  /** 0…1 — Einstellung für Bewegungsempfindliche skaliert Neigen und Wanken. */
  staerke: number;
  /** Schrittweite gegen den Clip (`gangMischung().weite`), 1 ausserhalb des Gangs. */
  weite: number;
  /** D458: Körpersprache über dem Clip (`ansage.ts`) — Ansage, Taumeln, Schütteln. */
  zusatz?: Zusatz;
}

export interface FeinAusgabe {
  /** Richtung der Hüfte: `rotation.y` der Figurgruppe. */
  huefte: number;
  /** Lage der ganzen Figur um ihren Fusspunkt: `rotation.z` (Kurve) und `rotation.x` (Schub), rad. */
  rollen: number;
  nicken: number;
}

const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _a = new THREE.Vector3();
const _v = new THREE.Vector3(), _ziel = new THREE.Vector3(), _vor = new THREE.Vector3();
const _auf = new THREE.Vector3(0, 1, 0), _n = new THREE.Vector3();
const _eu = new THREE.Euler();

/** Knochen um eine **Weltachse** drehen (Einheitsvektor), ohne seine Kinder vorher anzufassen. */
function dreheWelt(k: THREE.Object3D, ax: number, ay: number, az: number, winkel: number): void {
  if (Math.abs(winkel) < 1e-5) return;
  k.parent!.getWorldQuaternion(_qp);
  _a.set(ax, ay, az).applyQuaternion(_qp.invert());
  k.quaternion.premultiply(_q.setFromAxisAngle(_a, winkel));
}

export class Koerperfein {
  private wurzel: THREE.Object3D;
  private wirbel: THREE.Object3D[] = [];
  private hals: THREE.Object3D[] = [];
  private kopf: THREE.Object3D | null;
  private beine: Bein[] = [];
  private kette: Drehkette = neueDrehkette();
  private atem: Atem = neuerAtem();
  private treffer: Trefferantwort = neueTrefferantwort();
  private rollen: Feder = neueFeder(); private nicken: Feder = neueFeder();
  private blickG: Feder = neueFeder(); private blickN: Feder = neueFeder();
  private stehen: Feder = neueFeder(); private straff: Feder = neueFeder(); private weite: Feder = neueFeder(1);
  private gierVor = 0; private tempoGlatt: Feder = neueFeder(); private begonnen = false;
  private becken = 0; private an = 0;
  private schulter = 0; private kopfDreh = 0;
  private aus: FeinAusgabe = { huefte: 0, rollen: 0, nicken: 0 };
  private versaetze: number[] = [];
  private drehen: Figurlaufzeit['drehen'];
  /** D458, Vierbeiner: Werte, Ruhelage der Wurzel, geglättete Rumpflage, Arbeitsfelder je Paar. */
  private vier: (RumpfWerte & { kopfAusgleich: number }) | null = null;
  private grundQ = new THREE.Quaternion(); private grundP = new THREE.Vector3();
  private nickVier = 0; private rollVier = 0;
  private paarV: number[] = []; private paarH: number[] = [];
  private lage: Rumpflage = { hub: 0, nick: 0 };

  /**
   * `wurzel`: Wurzel des Modells (wird um die Beckensenkung verschoben, wie `setzeFuesse` es tut).
   * `ruheHoehen`: Höhe jedes Fussknochens über dem Boden im ebenen Stand, in der Reihenfolge des Plans; ohne
   * Angabe wird sie beim Bau am Skelett gelesen (dann muss die Figur gerade stehen).
   */
  constructor(wurzel: THREE.Object3D, plan: Rigplan, ruheHoehen?: readonly number[], opt?: FeinOptionen) {
    const k = (n: string) => wurzel.getObjectByName(n) ?? null;
    this.wurzel = wurzel;
    for (const n of plan.wirbel) { const o = k(n); if (o) this.wirbel.push(o); }
    for (const n of plan.halsKette ?? [plan.hals]) { const o = k(n); if (o) this.hals.push(o); }
    this.kopf = k(plan.kopf);
    this.drehen = opt?.drehen ?? FIGUR.drehen;
    this.grundQ.copy(wurzel.quaternion); this.grundP.copy(wurzel.position);
    wurzel.updateMatrixWorld(true);
    const grund = wurzel.getWorldPosition(new THREE.Vector3()).y;
    const fuesse = fussKnoten(wurzel, plan);
    plan.beine.forEach((b, i) => {
      const ober = k(b.ober), unter = k(b.unter), fuss = fuesse[i];
      if (!ober || !unter || !fuss) return;
      const ruhe = ruheHoehen?.[i] ?? fuss.getWorldPosition(new THREE.Vector3()).y - grund;
      const po = ober.getWorldPosition(new THREE.Vector3()), pu = unter.getWorldPosition(new THREE.Vector3()), pf = fuss.getWorldPosition(new THREE.Vector3());
      this.beine.push({ ober, unter, fuss, ruhe, halt: neuerStandfuss(), versatz: 0, wx: 0, wz: 0, paar: b.paar, spitze: !!b.spitze, cx: 0, cy: 0, cz: 0,
        lang: po.distanceTo(pu) + pu.distanceTo(pf), zx: 0, zy: 0, zz: 0 });
    });
    this.versaetze = this.beine.map(() => 0);
    // Rumpflage je Beinpaar nur, wenn beide Paare da sind — sonst der Weg des Menschen.
    this.paarV = this.beine.filter(b => b.paar === 'vorn').map(() => 0);
    this.paarH = this.beine.filter(b => b.paar === 'hinten').map(() => 0);
    if (opt?.vier && this.paarV.length && this.paarH.length) this.vier = opt.vier;
  }

  /** Erlittener Treffer: Richtung vom Angreifer weg im Raum der Figur (`wegVomAngreifer`), Wucht = Schaden. */
  stoss(wegX: number, wegZ: number, schaden: number, faktor = 1): void {
    stosseFigur(this.treffer, wegX, wegZ, schaden, FIGUR.treffer, faktor);
  }

  /** D458: Treffer mit vorgegebener Kippung in Grad (Gegner: `gewicht.ts` `reaktion().neigung`, aus dem Impuls). */
  stossGrad(wegX: number, wegZ: number, grad: number): void {
    stosseGrad(this.treffer, wegX, wegZ, grad, FIGUR.treffer);
  }

  /** D458: geglättete Rumpflage des Vierbeiners (rad, m) — für Messung und Bildprüfung. */
  get rumpf(): { nick: number; roll: number; hub: number } { return { nick: this.nickVier, roll: this.rollVier, hub: this.becken }; }

  /** Alles auf Ruhe (Schalter aus, Figur versetzt). */
  ruhe(): void {
    this.begonnen = false; this.kette = neueDrehkette(); this.treffer = neueTrefferantwort();
    this.rollen = neueFeder(); this.nicken = neueFeder(); this.blickG = neueFeder(); this.blickN = neueFeder();
    this.becken = 0; this.an = 0; this.nickVier = 0; this.rollVier = 0;
    this.wurzel.position.copy(this.grundP); this.wurzel.quaternion.copy(this.grundQ);
    for (const b of this.beine) { b.halt = neuerStandfuss(); b.versatz = 0; }
  }

  /**
   * Schritt 1, **vor** dem Zeichnen der Gruppe und nach dem Mixer: Federn führen. Gibt zurück, wie die
   * Figurgruppe zu drehen ist; der Aufrufer setzt das und ruft dann `knochen`.
   */
  schritt(dt: number, e: FeinEingabe): FeinAusgabe {
    const d = Math.min(Math.max(dt, 0), 0.1);
    if (!this.begonnen) { this.begonnen = true; this.gierVor = e.gier; this.tempoGlatt.x = e.tempo; }
    // Straffheit weich führen: Springt sie (Hut → Hieb), holte die Hüfte ihren Rückstand sonst in einem Bild auf.
    const straff = klemme(federSchritt(this.straff, e.straff, 0.04, d), 0, 1);
    const k = drehSchritt(this.kette, e.gier, d, this.drehen, straff);
    // Drehrate und Beschleunigung aus dem, was die Regel tut; geglättet, weil beides von Bild zu Bild springt.
    let dg = e.gier - this.gierVor;
    dg -= Math.round(dg / (2 * Math.PI)) * 2 * Math.PI;
    const rate = d > 1e-4 ? dg / d : 0;
    const vVor = this.tempoGlatt.x;
    federSchritt(this.tempoGlatt, e.tempo, 0.08, d);
    const a = d > 1e-4 ? (this.tempoGlatt.x - vVor) / d : 0;
    this.gierVor = e.gier;
    const n = FIGUR.neigen, frei = e.staerke * (1 - straff);
    federSchritt(this.rollen, kurvenNeigung(e.tempo, rate, n) * frei, n.halbwert, d);
    federSchritt(this.nicken, schubNeigung(a, n) * frei, n.halbwert, d);
    federSchritt(this.stehen, e.steht ? 1 : 0, 0.25, d);
    this.aus.huefte = k.huefte; this.aus.rollen = this.rollen.x; this.aus.nicken = -this.nicken.x;
    this.schulter = k.schulter; this.kopfDreh = k.kopf;
    return this.aus;
  }

  /**
   * Schritt 2, nachdem die Figurgruppe gedreht ist: Knochen. Drehkette, Atem, Trefferantwort, Blick, dann die
   * Füsse. Rechnet auf der gezeigten Clip-Pose (`PosenTraegheit.nachMixer` lief davor).
   */
  knochen(dt: number, e: FeinEingabe): void {
    const d = Math.min(Math.max(dt, 0), 0.1), g = this.aus.huefte;
    // Achsen der Figur in der Welt: rechts (lokal +X) und hinten (lokal +Z) bei Hüftrichtung g.
    const rx = Math.cos(g), rz = -Math.sin(g), hx = Math.sin(g), hz = Math.cos(g);
    const w = this.wirbel, nw = w.length;
    const [seit, rueck] = trefferSchritt(this.treffer, d, FIGUR.treffer);
    const hub = atemSchritt(this.atem, e.rennen > 0 ? e.tempo / e.rennen : 0, d, FIGUR.atem) * this.stehen.x * e.staerke;
    // Blick: gegen die Richtung der Schultern (Hüfte + Verdrehung), geglättet; ohne Ziel zurück auf 0.
    const b = FIGUR.blick;
    let zg = 0, zn = 0;
    if (e.fokus && this.kopf) {
      this.kopf.getWorldPosition(_v);
      const bl = blickWinkel([_v.x, _v.y, _v.z], [e.fokus.x, e.fokus.y, e.fokus.z], g + this.schulter, b);
      if (bl.gilt) { zg = bl.gier; zn = bl.nick; }
    }
    federSchritt(this.blickG, zg, b.halbwert, d); federSchritt(this.blickN, zn, b.halbwert, d);
    const bg = this.blickG.x, bn = this.blickN.x;
    // Wirbel von unten nach oben: Verdrehung der Schultern gleichmässig, Kippung des Treffers unten am stärksten.
    // D458: Beim Vierbeiner kippen Treffer und Rumpf-Zusatz den **ganzen Rumpf** über stehenden Läufen
    // (`fuesseVier`) — die Wirbel bekommen nur die Verdrehung. Beim Menschen geht beides in die Wirbelsäule.
    const zu = e.zusatz ?? KEIN_ZUSATZ, vier = this.vier;
    const wRueck = vier ? 0 : rueck + zu.rumpfNick, wSeit = vier ? 0 : seit - zu.rumpfRoll;
    const kipp = nw === 3 ? [0.5, 0.3, 0.2] : w.map(() => 1 / Math.max(1, nw));
    for (let i = 0; i < nw; i++) {
      dreheWelt(w[i], 0, 1, 0, (this.schulter + zu.rumpfGier) / nw + (i === nw - 1 ? bg * b.brust : 0));
      // Atem: beim Menschen hebt sich die Brust (zweiter Wirbel). Beim Vierbeiner hängen die Vorderläufe am zweiten —
      // dort schwängen sie mit jedem Atemzug über den Boden; er atmet deshalb am letzten Wirbel (Widerrist und Hals).
      const nick = wRueck * kipp[i] + (i === nw - 1 ? bn * b.brust : 0) + (i === (vier ? nw - 1 : Math.min(1, nw - 1)) ? hub : 0);
      dreheWelt(w[i], rx, 0, rz, nick);
      dreheWelt(w[i], hx, 0, hz, -wSeit * kipp[i]);
    }
    // Kopf senken (positiv): Zusatz, und beim Vierbeiner der Ausgleich des Rumpfnickens — der Kopf bleibt waagerecht.
    const tief = zu.kopfNick + (vier ? this.nickVier * this.an * vier.kopfAusgleich : 0);
    const nh = this.hals.length;
    for (let i = 0; i < nh; i++) {
      dreheWelt(this.hals[i], 0, 1, 0, (this.kopfDreh * 0.4 + bg * b.hals + zu.kopfGier * 0.5) / nh);
      dreheWelt(this.hals[i], rx, 0, rz, (bn * b.hals - hub * 0.5 - tief * 0.5) / nh);
    }
    if (this.kopf) {
      dreheWelt(this.kopf, 0, 1, 0, this.kopfDreh * 0.6 + bg * b.kopf + zu.kopfGier * 0.5);
      // Der Kopf bleibt beim Wanken ein Stück zurück (halbe Gegenkippung) — er ist das Schwerste am Hals.
      dreheWelt(this.kopf, rx, 0, rz, bn * b.kopf - wRueck * 0.25 - hub * 0.5 - tief * 0.5);
      dreheWelt(this.kopf, hx, 0, hz, wSeit * 0.25 + zu.kopfRoll);
    }
    if (vier) this.fuesseVier(d, e, vier, zu, seit, rueck);
    else if (e.hoeheAn) this.fuesse(d, e, e.hoeheAn);
  }

  /**
   * D458, Vierbeiner: Rumpf je Beinpaar, Läufe bleiben auf dem Boden. Ablauf: (1) Sohlen lesen, wie der Clip sie
   * setzt (Rumpf in Ruhelage), Bodenversatz je Lauf; (2) Schulter über den Vorderläufen, Becken über den
   * Hinterläufen → Hub und Nicken des Rumpfs, dazu Zusatz (Ansage, Taumeln) und Trefferkippung; (3) jeden Lauf per
   * Zwei-Gelenk-IK zurück auf **seine** Stelle am Boden — der Rumpf bewegt sich über stehenden Füssen.
   */
  private fuesseVier(dt: number, e: FeinEingabe, vw: RumpfWerte, zu: Zusatz, seit: number, rueck: number): void {
    const figur = this.wurzel, beine = this.beine;
    figur.position.copy(this.grundP); figur.quaternion.copy(this.grundQ);
    figur.updateMatrixWorld(true);
    figur.getWorldPosition(_v);
    const gx = _v.x, grundY = _v.y, gz = _v.z, boden = e.hoeheAn, mitte = boden ? boden(gx, gz) : grundY;
    const amBoden = e.fuesse && Math.abs(grundY - mitte) < 0.18;
    this.an += ((amBoden ? 1 : 0) - this.an) * Math.min(1, dt * 6);
    if (this.an < 0.01) this.an = 0;
    const an = this.an, glatt = Math.min(1, dt * 12), fw = FIGUR.fuss, g = this.aus.huefte;
    const hx = Math.sin(g), hz = Math.cos(g), rx = Math.cos(g), rz = -Math.sin(g);
    let iv = 0, ih = 0, zv = 0, zh = 0, sl = 0, sr = 0, xl = 0, xr = 0, nl = 0, nr = 0, gurt = 0;
    for (const b of beine) {
      b.fuss.getWorldPosition(_v);
      b.cx = _v.x; b.cy = _v.y; b.cz = _v.z;
      fuehreStandfuss(b.halt, _v.x, _v.z, _v.y - grundY - b.ruhe, dt, fw, amBoden && e.halten);
      const zielV = boden && an > 0 ? klemme(boden(_v.x + b.halt.ox, _v.z + b.halt.oz) - mitte, -vw.hubMax, vw.hubMax) : 0;
      b.versatz += (zielV - b.versatz) * glatt;
      b.ober.getWorldPosition(_ziel); gurt += _ziel.y - grundY;
      // Lage der Sohle längs und quer im Raum der Figur: Die Rumpfgerade geht durch die **Füsse** der Paare.
      const laengs = (b.cx - gx) * hx + (b.cz - gz) * hz, quer = (b.cx - gx) * rx + (b.cz - gz) * rz;
      if (b.paar === 'vorn') { this.paarV[iv++] = b.versatz; zv += laengs; } else { this.paarH[ih++] = b.versatz; zh += laengs; }
      if (quer < 0) { sl += b.versatz; xl += quer; nl++; } else { sr += b.versatz; xr += quer; nr++; }
    }
    const lage = rumpfLage(paarHoehe(this.paarV, vw.streckReserve), paarHoehe(this.paarH, vw.streckReserve), zv / iv, zh / ih, vw, this.lage);
    const roll = nl && nr ? seitLage(sl / nl, sr / nr, xr / nr - xl / nl, vw) : 0;
    this.nickVier += (lage.nick - this.nickVier) * glatt;
    this.rollVier += (roll - this.rollVier) * glatt;
    this.becken += (lage.hub - this.becken) * glatt;
    // Rumpf: Hang (nur am Boden) + Zusatz + Treffer. `rueck` kippt nach hinten (vorn hoch), `seit` nach rechts.
    const nick = this.nickVier * an + zu.rumpfNick + rueck * 0.5, rollen = this.rollVier * an + zu.rumpfRoll - seit;
    const hub = this.becken * an + zu.rumpfY;
    if (Math.abs(nick) + Math.abs(rollen) + Math.abs(hub) + Math.abs(zu.rumpfX) + Math.abs(zu.rumpfZ) < 1e-4) {
      let ruhig = true;
      for (const b of beine) if (Math.abs(b.versatz) * an + Math.abs(b.halt.ox) + Math.abs(b.halt.oz) > 0.003 || b.cy - grundY < -0.003) { ruhig = false; break; }
      if (ruhig) return;
    }
    figur.quaternion.setFromEuler(_eu.set(nick, 0, rollen)).multiply(this.grundQ);
    // Der Hang dreht den Rumpf um seine **eigene Höhe** (Mittel der Gürtel), nicht um den Punkt am Boden: Schulter
    // und Becken bleiben über ihren Füssen, die Läufe lotrecht. (Der Zusatz dreht um den Bodenpunkt wie D169–D171.)
    const h = gurt / Math.max(1, beine.length), nh = this.nickVier * an, rh = this.rollVier * an;
    figur.position.set(this.grundP.x + zu.rumpfX + h * Math.sin(rh), this.grundP.y + hub + h * (1 - Math.cos(nh)), this.grundP.z + zu.rumpfZ - h * Math.sin(nh));
    figur.updateMatrixWorld(true);
    if (an <= 0) return;
    // Ziel je Lauf: seine Stelle aus dem Clip, auf seinem Boden. Höhe der Sohle über dem Boden wie im Clip, aber nie
    // darunter (ein Clip, der duckt, drückt keine Pfote in die Erde).
    let senken = 0;
    for (const b of beine) {
      b.zx = b.cx + b.halt.ox * an; b.zz = b.cz + b.halt.oz * an;
      b.zy = grundY + Math.max(0, b.cy - grundY) * an + (b.cy - grundY) * (1 - an) + b.versatz * an;
      // Reicht der Lauf nicht (Tierläufe stehen im Clip fast gestreckt), gibt der Rumpf nach unten nach — ein Lauf
      // kann sich beugen, aber nicht länger werden.
      b.ober.getWorldPosition(_v);
      const dy = _v.y - b.zy, quer2 = (_v.x - b.zx) ** 2 + (_v.z - b.zz) ** 2, reich = b.lang * 0.995;
      if (dy > 0.02 && quer2 + dy * dy > reich * reich) senken = Math.max(senken, dy - Math.sqrt(Math.max(0, reich * reich - quer2)));
    }
    if (senken > 1e-4) { figur.position.y -= Math.min(senken, vw.hubMax); figur.updateMatrixWorld(true); }
    _vor.set(0, 0, 1).applyQuaternion(figur.getWorldQuaternion(_q));
    for (const b of beine) {
      _ziel.set(b.zx, b.zy, b.zz);
      zweiKnochen(b.ober, b.unter, b.fuss, _ziel, _vor, 1e-3);
    }
  }

  /** Füsse auf Höhe und Neigung des Geländes, Becken nach, Standfuss gehalten (`fussboden.ts`, D214). */
  private fuesse(dt: number, e: FeinEingabe, hoeheAn: (x: number, z: number) => number): void {
    const figur = this.wurzel, beine = this.beine;
    if (!beine.length) return;
    figur.position.y = 0;
    figur.updateMatrixWorld(true);
    figur.getWorldPosition(_v);
    const grundY = _v.y, mitte = hoeheAn(_v.x, _v.z);
    const amBoden = e.fuesse && Math.abs(grundY - mitte) < 0.18;
    this.an += ((amBoden ? 1 : 0) - this.an) * Math.min(1, dt * 6);
    if (this.an < 0.01) { this.an = 0; this.becken = 0; for (const b of beine) { b.versatz = 0; b.halt.fest = false; b.halt.ox = b.halt.oz = 0; } return; }
    const glatt = Math.min(1, dt * 12), fw = FIGUR.fuss;
    // Schrittweite: Der Fuss wird in Laufrichtung um den Faktor weiter (oder kürzer) von seiner Hüfte weggesetzt, als
    // der Clip es tut — längere Schritte bei höherem Tempo, ohne die Beine schneller zu wirbeln (`gangMischung`).
    const mehr = federSchritt(this.weite, e.weite, 0.1, dt) - 1, g = this.aus.huefte, vx = -Math.sin(g), vz = -Math.cos(g);
    beine.forEach((b, i) => {
      b.fuss.getWorldPosition(_v);
      if (Math.abs(mehr) > 0.01) {
        b.ober.getWorldPosition(_ziel);
        const lang = ((_v.x - _ziel.x) * vx + (_v.z - _ziel.z) * vz) * mehr;
        b.wx = vx * lang; b.wz = vz * lang;
      } else { b.wx = 0; b.wz = 0; }
      fuehreStandfuss(b.halt, _v.x + b.wx, _v.z + b.wz, _v.y - grundY - b.ruhe, dt, fw, amBoden && e.halten);
      const zielV = klemme(hoeheAn(_v.x + b.wx + b.halt.ox, _v.z + b.wz + b.halt.oz) - mitte, -0.6, 0.6);
      b.versatz += (zielV - b.versatz) * glatt;
      this.versaetze[i] = b.versatz;
    });
    this.becken += (beckenSenkung(this.versaetze, 0.35) - this.becken) * glatt;
    figur.position.y = this.becken * this.an;
    figur.updateMatrixWorld(true);
    _vor.set(0, 0, 1).applyQuaternion(figur.getWorldQuaternion(_q));
    const maxKipp = fw.neigungMaxGrad * GRAD;
    for (const b of beine) {
      b.fuss.getWorldPosition(_ziel);
      const hoch = _ziel.y - (grundY + this.becken * this.an) - b.ruhe;
      const hub = (b.versatz - this.becken) * this.an, ox = (b.halt.ox + b.wx) * this.an, oz = (b.halt.oz + b.wz) * this.an;
      if (Math.abs(hub) + Math.abs(ox) + Math.abs(oz) >= 0.004) {
        _ziel.x += ox; _ziel.y += hub; _ziel.z += oz;
        zweiKnochen(b.ober, b.unter, b.fuss, _ziel, _vor);
      }
      // Sohle auf die Fläche: nur, solange der Fuss nah am Boden ist — im Schwung gehört er dem Clip.
      const nah = klemme(1 - hoch / 0.15, 0, 1) * this.an;
      if (nah > 0.02) {
        const nn = begrenzeNormale(bodenNormale(hoeheAn, _ziel.x, _ziel.z), maxKipp);
        if (nn[1] < 0.9999) {
          _q.setFromUnitVectors(_auf, _n.set(nn[0], nn[1], nn[2]));
          if (nah < 1) _q.slerp(_qp.identity(), 1 - nah);
          b.fuss.parent!.getWorldQuaternion(_qp);
          // lokal = Eltern⁻¹ · Kippung · Eltern · lokal
          b.fuss.quaternion.premultiply(_qp).premultiply(_q).premultiply(_qp.invert());
        }
      }
    }
  }
}
