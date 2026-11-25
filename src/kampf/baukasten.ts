/**
 * BRACHLAND — Waffen-Baukasten (D403, Entwurf): Kopf × Schaft × Material × Härtung.
 *
 * Aus den Teilen in `content/waffenteile.json` wird eine Waffe **abgeleitet**, nicht festgelegt: Masse
 * und Trägheitsmoment folgen aus Abmessung und Gewicht der Teile, daraus Schlagzeit, Wucht und
 * Ausdauerkosten. Gerechnet wird als Faktor gegen den **Referenzbau** jeder Familie — der Referenzbau
 * ist die heutige Waffe, und mit ihm kommt jede Zahl aus `content/waffen/*.json` unverändert heraus
 * (`tests/baukasten.test.ts`). Damit bleiben die geprüften Kampfwerte der Anker.
 *
 * Die Formeln (Herleitung und Abweichungen: `docs/design/BRACHLAND_Waffen-Baukasten_v1.md` §3):
 *   Schwung:  T ∝ ((I_Arm + I) / Kraft)^(1/3)   — konstante Muskelleistung dreht Arm und Waffe
 *   Stoss:    T ∝ ((m_Arm + M) / Kraft)^(1/3)   — konstante Leistung schiebt Arme und Waffe
 *   Energie:  E ∝ Kraft · T                      — Leistung mal Zeit
 *   Schaden          × E · Schneide · Güte
 *   Haltungsschaden  × Impuls · Wucht · Güte;  Impuls ∝ √(E · I) / d  (Schwung), √(E · M) (Stoss)
 *   Ausdauerkosten   × a · E + (1 − a) · M
 *   Ausgleich (D407) × Kopf · Schaft auf Schaden und Haltungsschaden — Spielausgleich, keine Physik
 *   Vorlauf × T;  Erholung × T (Stoss: × Dreh-T);  Nachdrehen × Wendigkeit / Dreh-T;  Reichweite + Δ Spitze
 * Unberührt bleiben Aktivfenster, Bogenwinkel, Linie, Clip, Schritt — sie hängen an der Animation.
 *
 * Rein, ohne three.js und React. Das Spiel liest dieses Modul nicht.
 */
import type { Waffenbaukasten, Waffenteil, WaffenDaten, WaffenSchlag } from '../data/schema.js';
import type { Schlag, Waffe } from './echtzeit.js';

export type Familie = 'klinge' | 'axt' | 'speer';
export interface Bau { kopf: string; schaft: string; material: string; haertung: string }

/** Was die Teile zusammen sind — in echten Einheiten, zum Nachrechnen. */
export interface Koerper {
  /** Kilogramm. */
  masse: number;
  /** Trägheitsmoment um die Griffhand, kg·m². */
  traegheit: number;
  /** Abstand des Kopfschwerpunkts von der Griffhand, Meter. */
  kopfAbstand: number;
  /** Abstand der Spitze oder Schneide von der Griffhand, Meter. */
  spitze: number;
  /** Schwerpunkt der ganzen Waffe vor der Griffhand, Meter. */
  schwerpunkt: number;
  kraft: number; wendig: number; schneide: number; wucht: number;
  /** D407: Spielausgleich der beiden Teile (Kopf × Schaft), kein Physikwert. */
  ausgleich: number;
}

/** Die Faktoren gegen den Referenzbau. Alle 1 (und `reichweite` 0) heisst: die heutige Waffe. */
export interface Faktoren {
  zeit: number; drehZeit: number; energie: number; impuls: number;
  schaden: number; haltungsschaden: number; kosten: number; nachdrehen: number;
  /** Meter, wird addiert. */
  reichweite: number;
}

function teil(liste: readonly Waffenteil[], id: string, was: string): Waffenteil {
  const t = liste.find(x => x.id === id);
  if (!t) throw new Error(`Baukasten: ${was} '${id}' gibt es nicht`);
  return t;
}

/** Masse, Trägheit und Spitze eines Baus aus Kopf und Schaft. Stab um einen Punkt: m·(L²/12 + a²). */
export function koerper(k: Waffenbaukasten, familie: Familie, bau: Pick<Bau, 'kopf' | 'schaft'>): Koerper {
  const f = k.familien[familie];
  const kopf = teil(f.kopf, bau.kopf, 'Kopf'), schaft = teil(f.schaft, bau.schaft, 'Schaft');
  const vorn = schaft.laenge * f.vorHand;                 // Schaft vor der Griffhand
  const schaftMitte = vorn - schaft.laenge / 2;           // Schaftschwerpunkt, von der Hand aus
  const kopfAbstand = vorn + kopf.schwerpunkt;
  const iSchaft = schaft.masse * (schaft.laenge ** 2 / 12 + schaftMitte ** 2);
  const iKopf = kopf.masse * (kopf.laenge ** 2 / 12 + kopfAbstand ** 2);
  const masse = kopf.masse + schaft.masse;
  return {
    masse, traegheit: iSchaft + iKopf, kopfAbstand, spitze: vorn + kopf.laenge,
    schwerpunkt: (kopf.masse * kopfAbstand + schaft.masse * schaftMitte) / masse,
    kraft: kopf.kraft * schaft.kraft, wendig: kopf.wendig * schaft.wendig,
    schneide: kopf.schneide * schaft.schneide, wucht: kopf.wucht * schaft.wucht,
    ausgleich: kopf.ausgleich * schaft.ausgleich,
  };
}

export function faktoren(k: Waffenbaukasten, familie: Familie, bau: Bau): Faktoren {
  const f = k.familien[familie], p = k.physik;
  const b = koerper(k, familie, bau), r = koerper(k, familie, f.referenz);
  const material = k.material.find(m => m.id === bau.material);
  const haertung = k.haertung.find(h => h.id === bau.haertung);
  if (!material) throw new Error(`Baukasten: Material '${bau.material}' gibt es nicht`);
  if (!haertung) throw new Error(`Baukasten: Härtung '${bau.haertung}' gibt es nicht`);
  // Dreh-Zeit: Arm und Waffe um die Schulter; Stoss-Zeit: Arme und Waffe geradeaus.
  const drehT = (x: Koerper) => Math.cbrt((p.armTraegheit + x.traegheit) / x.kraft);
  const stossT = (x: Koerper) => Math.cbrt((p.armMasse + x.masse) / x.kraft);
  const drehZeit = drehT(b) / drehT(r);
  const zeit = f.bewegung === 'stoss' ? stossT(b) / stossT(r) : drehZeit;
  const energie = (b.kraft / r.kraft) * zeit;
  const impuls = f.bewegung === 'stoss'
    ? Math.sqrt(energie * (b.masse / r.masse))
    : Math.sqrt(energie * (b.traegheit / r.traegheit)) / (b.kopfAbstand / r.kopfAbstand);
  // D407: Spielausgleich je Teil — wirkt wie die Güte auf Schaden und Haltungsschaden, nicht auf Tempo und Kosten.
  const ausgleich = b.ausgleich / r.ausgleich;
  return {
    zeit, drehZeit, energie, impuls,
    schaden: energie * (b.schneide / r.schneide) * material.guete * haertung.schneide * ausgleich,
    haltungsschaden: impuls * (b.wucht / r.wucht) * material.guete * haertung.wucht * ausgleich,
    kosten: p.anteilEnergie * energie + (1 - p.anteilEnergie) * (b.masse / r.masse),
    nachdrehen: (b.wendig / r.wendig) / drehZeit,
    reichweite: b.spitze - r.spitze,
  };
}

function schlag(s: WaffenSchlag, f: Faktoren, stoss: boolean): WaffenSchlag {
  const neu: WaffenSchlag = {
    ...s,
    vorlauf: s.vorlauf * f.zeit,
    erholung: s.erholung * (stoss ? f.drehZeit : f.zeit),
    reichweite: s.reichweite + f.reichweite,
    schaden: s.schaden * f.schaden,
    haltungsschaden: s.haltungsschaden * f.haltungsschaden,
    kosten: s.kosten * f.kosten,
    nachdrehen: s.nachdrehen * f.nachdrehen,
  };
  if (s.rueckstoss !== undefined) neu.rueckstoss = s.rueckstoss * f.impuls;
  return neu;
}

/**
 * Die abgeleitete Waffe im Format von `content/waffen/*.json`. `grund` ist die heutige Waffe der
 * Familie; mit dem Referenzbau, Material der Güte 1 und neutraler Härtung kommt sie unverändert zurück.
 */
export function leiteAb(k: Waffenbaukasten, grund: WaffenDaten, bau: Bau): WaffenDaten {
  const familie = grund.id as Familie;
  const f = faktoren(k, familie, bau);
  const stoss = k.familien[familie].bewegung === 'stoss';
  return {
    ...grund,
    leicht: grund.leicht.map(s => schlag(s, f, stoss)),
    schwer: schlag(grund.schwer, f, stoss),
    lauf: schlag(grund.lauf, f, stoss),
  };
}

const GRAD = Math.PI / 180, CLIP_BILDRATE = 24;
function regelSchlag(d: WaffenSchlag): Schlag {
  const { halbwinkelGrad, hieb, ...rest } = d;
  return { ...rest, halbwinkel: halbwinkelGrad * GRAD,
    hieb: { scheitel: hieb.scheitel / CLIP_BILDRATE, durchzug: hieb.durchzug / CLIP_BILDRATE } };
}

/** Die abgeleitete Waffe im Format der Kampfregeln (Radiant, Clipsekunden) — wie `WAFFEN` in `echtzeit.ts`. */
export function regelWaffe(d: WaffenDaten): Waffe {
  const leicht = d.leicht.map(regelSchlag);
  return { name: d.name, haltung: d.haltung, schlag: leicht[0], leicht, schwer: regelSchlag(d.schwer), lauf: regelSchlag(d.lauf) };
}

/** Der Referenzbau einer Familie: die heutige Waffe. */
export function referenzBau(k: Waffenbaukasten, familie: Familie): Bau {
  const material = k.material.find(m => m.guete === 1), haertung = k.haertung.find(h => h.schneide === 1 && h.wucht === 1);
  if (!material || !haertung) throw new Error('Baukasten: kein neutrales Material oder keine neutrale Härtung');
  return { ...k.familien[familie].referenz, material: material.id, haertung: haertung.id };
}

/** Alle Bauten einer Familie aus Kopf × Schaft, mit festem Material und fester Härtung. */
export function alleBauten(k: Waffenbaukasten, familie: Familie, material?: string, haertung?: string): Bau[] {
  const ref = referenzBau(k, familie), f = k.familien[familie];
  return f.kopf.flatMap(kopf => f.schaft.map(schaft =>
    ({ kopf: kopf.id, schaft: schaft.id, material: material ?? ref.material, haertung: haertung ?? ref.haertung })));
}

/**
 * Was ein Bau von Grund auf kostet: Kopf, Schaft und jede Gütestufe bis zum gewählten Material — die Güte
 * wird wie die alte Waffenstufe Schritt für Schritt aufgebaut (D393: 8 Span · 14 Span + 3 Federstahl · …).
 */
export function bauPreis(k: Waffenbaukasten, familie: Familie, bau: Bau): Record<string, number> {
  const f = k.familien[familie];
  const material = k.material.find(m => m.id === bau.material)!;
  const preis: Record<string, number> = {};
  const plus = (p: Readonly<Record<string, number>>) => { for (const [g, n] of Object.entries(p)) preis[g] = (preis[g] ?? 0) + n; };
  plus(teil(f.kopf, bau.kopf, 'Kopf').preis); plus(teil(f.schaft, bau.schaft, 'Schaft').preis);
  for (const m of k.material) if (m.stufe <= material.stufe) plus(m.preis);
  return preis;
}
