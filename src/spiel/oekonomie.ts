/**
 * BRACHLAND — Aufwertungs-Ökonomie (D393): zwei Achsen, eine Rechnung
 *
 * **Stahl** wächst aus dem, was Getötete hinterlassen (D379), **Marke** aus dem, was man reinigt.
 * Alle Zahlen stehen in `content/oekonomie.json`; hier steht nur, wie gerechnet wird. Das Spiel
 * liest das Modul noch nicht — die Schmiede läuft weiter nach D177 (`schmiede.ts`). Gebraucht wird
 * es von `tools/oekonomiesim.ts` (Überschlagsrechnung) und `tests/oekonomie.test.ts`.
 *
 * Rein, ohne three.js und React.
 */
import type { Gegenstand, Oekonomie } from '../data/schema.js';

type Vorrat = Readonly<Record<string, number>>;

export function reicht(preis: Vorrat, vorrat: Vorrat, mal = 1): boolean {
  return Object.entries(preis).every(([g, n]) => (vorrat[g] ?? 0) >= n * mal);
}

export function ziehe(preis: Vorrat, vorrat: Vorrat, mal = 1): Record<string, number> {
  const neu: Record<string, number> = { ...vorrat };
  for (const [g, n] of Object.entries(preis)) neu[g] = (neu[g] ?? 0) - n * mal;
  return neu;
}

// ------------------------------------------------------------------ Achse Marke

/** Markenstufe aus der Läuterung: Zahl der erreichten Schwellen. */
export function markenStufe(laeuterung: number, o: Oekonomie): number {
  return o.marke.schwellen.filter(s => laeuterung >= s).length;
}

/** Fassung der Marke: Grundwert und Regenten aus `content/reinigen.json`, Stufen von hier. */
export function fassung(laeuterung: number, regenten: number, grund: { start: number; jeRegent: number }, o: Oekonomie): number {
  return grund.start + grund.jeRegent * regenten + markenStufe(laeuterung, o) * o.marke.fassungJeStufe;
}

/**
 * Ein Revier ist ruhig, wenn die Eingriffe überwiegend Reinigungen waren (`ruhigAb`) **und** ein
 * Mindestanteil seiner Tiere gereinigt ist (`ruhigMindestens`). Zwei Bedingungen, weil eine allein
 * nicht trägt: „60 % aller Tiere“ (Reinigen v1 §4, A6 wörtlich) ist mit Fassung 4 zwischen zwei Rasten
 * unerreichbar, und „60 % der Eingriffe“ allein befriedet ein Revier mit einem einzigen Griff.
 * Ein leergetötetes Revier ist nur still.
 */
export function revierRuhig(gereinigt: number, getoetet: number, tiere: number, o: Oekonomie): boolean {
  const eingriffe = gereinigt + getoetet;
  return eingriffe > 0 && tiere > 0
    && gereinigt / eingriffe >= o.marke.ruhigAb - 1e-9
    && gereinigt / tiere >= o.marke.ruhigMindestens - 1e-9;
}

// ------------------------------------------------------------------ Achse Stahl

/**
 * Wie weit kommen die Waffen mit diesem Vorrat? Eine nach der anderen, die erste zuerst bis zum
 * Ende — so schmiedet, wer eine Hauptwaffe führt. Vorschlagsstufen (`vorschlag`) zählen nur auf Wunsch.
 */
export function schmiedeAus(vorrat: Vorrat, o: Oekonomie, waffen = 3, mitVorschlag = false): { stufen: number[]; rest: Record<string, number> } {
  const leiter = o.schmiede.filter(s => mitVorschlag || !s.vorschlag).sort((a, b) => a.stufe - b.stufe);
  let rest: Record<string, number> = { ...vorrat };
  const stufen: number[] = [];
  for (let w = 0; w < waffen; w++) {
    let stufe = 0;
    for (const s of leiter) {
      if (!reicht(s.preis, rest)) break;
      rest = ziehe(s.preis, rest); stufe = s.stufe;
    }
    stufen.push(stufe);
  }
  return { stufen, rest };
}

// ------------------------------------------------------------------ Flasche

/** Schlucke und Stärke der Sudflasche aus dem, was man der Magd gebracht hat. */
export function flasche(vorrat: Vorrat, o: Oekonomie): { schlucke: number; staerke: number; rest: Record<string, number> } {
  const f = o.flasche;
  let rest: Record<string, number> = { ...vorrat };
  let schlucke = f.schlucke.start;
  while (schlucke < f.schlucke.max && reicht(f.schlucke.preis, rest)) { rest = ziehe(f.schlucke.preis, rest); schlucke++; }
  let stufe = 0;
  while (stufe < f.staerke.stufen && reicht(f.staerke.preis, rest)) { rest = ziehe(f.staerke.preis, rest); stufe++; }
  return { schlucke, staerke: Math.round((f.staerke.start + stufe * f.staerke.jeStufe) * 100) / 100, rest };
}

// ------------------------------------------------------------------ Tod

/**
 * Was beim Tod am Ort bleibt (das Bündel) und was man behält. Verloren geht nur loses Material
 * (`liegtBeiTod`); Werkzeug, Wissen, Marke und Vorräte bleiben am Körper. Unbekannte IDs bleiben
 * im Beutel — wie überall (`content/gegenstaende/_INDEX.md`, Rollback).
 */
export function todesverlust(beutel: Vorrat, gegenstaende: readonly Pick<Gegenstand, 'id' | 'liegtBeiTod'>[]): { behalten: Record<string, number>; buendel: Record<string, number> } {
  const lose = new Set(gegenstaende.filter(g => g.liegtBeiTod).map(g => g.id));
  const behalten: Record<string, number> = {}, buendel: Record<string, number> = {};
  for (const [g, n] of Object.entries(beutel)) if (n > 0) (lose.has(g) ? buendel : behalten)[g] = n;
  return { behalten, buendel };
}

// ------------------------------------------------------------------ Überschlag je Region

/** Eine Spielweise über ein Kapitel. Anteile 0…1; was übrig bleibt, wird umgangen. */
export interface Spielweise {
  name: string;
  /** Anteil der Begegnungen, die gekämpft werden (der Rest wird umgangen). */
  kaempft: number;
  /** Reinigt, solange Ladung da ist: 0 = nie, 1 = jedes Tier, dazwischen höchstens dieser Anteil. */
  reinigtBisAnteil: number;
  /** Tötet, was nicht gereinigt wird? Der Heiler lässt es stehen. */
  toetetRest: boolean;
  /** Wie viele der Verhärteten getötet werden; die übrigen werden gereinigt, soweit Reinkulturen reichen. */
  verhaerteteToeten: number;
  regent: 'toeten' | 'heilen';
  /** Getötete Menschen (D385: töten, vertreiben oder verschonen). */
  menschenToeten: number;
  /** Anteil des einmalig in der Welt Liegenden, den diese Spielweise findet. */
  findet: number;
  /** D400: abgeschlossene Figurenlinien — wem man traut, schliesst ab; wer Figuren tötet, verliert die Linie (D399). */
  linien: number;
}

export interface Bilanz {
  name: string;
  getoetet: number; gereinigt: number; umgangen: number;
  verhaerteteGetoetet: number; verhaerteteGereinigt: number;
  ruhigeReviere: number;
  vorrat: Record<string, number>;
  waffen: number[];
  laeuterung: number; markenStufe: number; fassung: number;
  schlucke: number; staerke: number;
  reinkulturenUebrig: number;
  anteilGereinigt: number;
  // --- D400: Fortschritt der Spielfigur
  /** Alle Eingriffe, getötet wie gereinigt — das zählt der Mönch. */
  eingriffe: number;
  leereReviere: number;
  /** Verhärtete, die in leergetötete Reviere nachgewandert sind (Verhärtung). */
  nachgewandert: number;
  mark: number; abwurf: number;
  lebenPlus: number; ausdauerPlus: number;
  einsicht: number;
  linien: number;
  /** D403: Hat das Material für einen Umbau der Hauptwaffe (anderer Kopf, anderer Schaft) gereicht? */
  umbau: boolean;
}

/**
 * Dauerhafte Sude aus dem Vorrat (D400). Jeder Sud braucht seine Bruchstücke und **ein** Bossteil;
 * zuerst wird gebraut, was die wenigsten Bossteile annimmt, damit kein Abwurf an einen Sud geht,
 * den auch Mark getragen hätte.
 */
export function braue(vorrat: Vorrat, o: Oekonomie): { plus: Record<'leben' | 'ausdauer', number>; anzahl: Record<string, number>; rest: Record<string, number> } {
  let rest: Record<string, number> = { ...vorrat };
  const plus = { leben: 0, ausdauer: 0 };
  const anzahl: Record<string, number> = {};
  const reihenfolge = [...o.brauen.dauersude].sort((x, y) => x.bossteile.length - y.bossteile.length);
  for (const sud of reihenfolge) {
    anzahl[sud.id] = 0;
    // Mark vor Abwurf: das Stück nehmen, das sonst am wenigsten taugt.
    const teile = [...sud.bossteile].sort((x, y) => Number(x === o.brauen.bossteil.gereinigt) - Number(y === o.brauen.bossteil.gereinigt));
    while (anzahl[sud.id] < sud.hoechstens && reicht(sud.preis, rest)) {
      const teil = teile.find(t => (rest[t] ?? 0) > 0);
      if (!teil) break;
      rest = ziehe(sud.preis, rest); rest[teil] -= 1;
      anzahl[sud.id]++; plus[sud.wert] += sud.plus;
    }
  }
  return { plus, anzahl, rest };
}

/**
 * Überschlagsrechnung einer Spielweise über eine Region — Erwartungswerte, kein Würfeln.
 *
 * Ablauf wie Reinigen v1 §4: Zwischen zwei Rasten liegen gleich viele Begegnungen; an jeder Rast
 * füllt sich die Marke auf ihre Fassung. Reinigen kostet eine Ladung (Verhärtete drei und eine
 * Reinkultur, `reinigen.json`). Ein ruhiges Revier gibt einmalig seine Gabe, und im Abschnitt danach
 * lädt die Marke unterwegs noch einmal um den Anteil `ruhigeRast` (Rast ohne Zuflucht, A6).
 */
export function bilanz(w: Spielweise, region: string, o: Oekonomie,
  marke: { start: number; jeRegent: number; ladung: number; ladungVerhaertet: number }): Bilanz {
  const r = o.regionen[region];
  if (!r) throw new Error(`Region '${region}' fehlt in oekonomie.json`);
  const a = r.annahmen;
  const fund = (g: string) => Math.floor((r.einmalig[g] ?? 0) * w.findet + 1e-9);
  const vorrat: Record<string, number> = {};
  const plus = (g: string, n: number) => { if (n) vorrat[g] = (vorrat[g] ?? 0) + n; };
  for (const g of Object.keys(r.einmalig)) plus(g, fund(g));

  let laeuterung = (vorrat.eichsiegel ?? 0) * 5;
  delete vorrat.eichsiegel;
  let getoetet = 0, gereinigt = 0, umgangen = 0, ruhig = 0;
  let verhGetoetet = 0, verhGereinigt = 0;
  // Abschnitte von Rast zu Rast, jeder mit gleich vielen Begegnungen; Reviere der Reihe nach.
  const tiereJeAbschnitt = a.tiere / a.rasten;
  const revierVon = (abschnitt: number) => Math.min(a.reviere - 1, Math.floor(abschnitt * a.reviere / a.rasten));
  // Verhärtete stehen verteilt, einer je so vielen Abschnitten.
  const verhAlle = a.verhaertete > 0 ? Math.floor(a.rasten / a.verhaertete) : 0;
  let verhOffen = a.verhaertete, zuToeten = Math.min(w.verhaerteteToeten, a.verhaertete);
  let rG = 0, rT = 0, rB = 0, letztesRuhig = false, leer = 0;
  const schliesseRevier = () => {
    letztesRuhig = revierRuhig(rG, rT, rB, o);
    if (rB > 0 && rT / rB >= o.toeten.leerAb - 1e-9) leer++;
    if (letztesRuhig) { ruhig++; for (const [g, n] of Object.entries(o.marke.ruhigesRevier)) plus(g, n); }
    rG = 0; rT = 0; rB = 0;
  };
  for (let s = 0; s < a.rasten; s++) {
    if (s > 0 && revierVon(s) !== revierVon(s - 1)) schliesseRevier();
    // Volle Marke an der Rast; liegt ein ruhiges Revier im Rücken, dort noch einmal anteilig (Rast ohne Zuflucht).
    let ladung = fassung(laeuterung, 0, marke, o) * (letztesRuhig ? 1 + o.marke.ruhigeRast : 1);
    if (verhOffen > 0 && verhAlle > 0 && s % verhAlle === verhAlle - 1) {
      verhOffen--; rB += 1;
      const kulturen = (vorrat.reinkultur ?? 0) + Math.floor((vorrat.reinprobe ?? 0) / 2);
      const toete = () => { verhGetoetet++; rT += 1; plus(o.beute.verhaerteter.gegenstand, o.beute.verhaerteter.menge); };
      if (zuToeten > 0) { zuToeten--; toete(); }
      else if (w.reinigtBisAnteil > 0 && kulturen > 0 && ladung >= marke.ladungVerhaertet) {
        if ((vorrat.reinkultur ?? 0) > 0) vorrat.reinkultur--; else vorrat.reinprobe -= 2;
        ladung -= marke.ladungVerhaertet; verhGereinigt++; laeuterung += o.marke.laeuterung.verhaerteter; rG += 1;
      } else if (w.toetetRest) toete();
      // sonst: umgangen, er steht noch
    }
    const gekaempft = tiereJeAbschnitt * w.kaempft;
    const rein = Math.min(gekaempft * w.reinigtBisAnteil, ladung / marke.ladung);
    const tot = w.toetetRest ? gekaempft - rein : 0;
    gereinigt += rein; getoetet += tot; umgangen += tiereJeAbschnitt - rein - tot;
    rG += rein; rT += tot; rB += tiereJeAbschnitt;
    laeuterung += rein * o.marke.laeuterung.tier;
  }
  schliesseRevier();
  // D400, Verhärtung: In leergetötete Reviere wandert Befall nach und bringt neue Verhärtete mit.
  const nachgewandert = Math.floor(leer * o.toeten.verhaertungJeLeeremRevier + 1e-9);
  for (let i = 0; i < nachgewandert; i++) {
    const kulturen = (vorrat.reinkultur ?? 0) + Math.floor((vorrat.reinprobe ?? 0) / 2);
    if (w.verhaerteteToeten < 99 && w.reinigtBisAnteil > 0 && kulturen > 0) {
      if ((vorrat.reinkultur ?? 0) > 0) vorrat.reinkultur--; else vorrat.reinprobe -= 2;
      verhGereinigt++; laeuterung += o.marke.laeuterung.verhaerteter;
    } else if (w.toetetRest) { verhGetoetet++; plus(o.beute.verhaerteter.gegenstand, o.beute.verhaerteter.menge); }
  }
  const bossGetoetet = verhGetoetet + (w.regent === 'toeten' ? 1 : 0);
  const bossGereinigt = verhGereinigt + (w.regent === 'heilen' ? 1 : 0);
  plus(o.brauen.bossteil.getoetet, bossGetoetet);
  plus(o.brauen.bossteil.gereinigt, bossGereinigt);
  // Einsicht: was in der Welt liegt (schon im Vorrat), die Linien, der Regent — nie ein Kampf.
  const regentEinsicht = 2;
  const linien = Math.min(w.linien, o.erfahrung.linien);
  const einsicht = (vorrat.einsicht ?? 0) + linien * o.erfahrung.jeLinie + regentEinsicht;
  delete vorrat.einsicht;
  plus(o.beute.tier.gegenstand, Math.round(getoetet * o.beute.tier.chance));
  plus(o.beute.mensch.gegenstand, Math.min(w.menschenToeten, a.menschen) * o.beute.mensch.menge);
  if (w.regent === 'toeten') plus(o.beute.regent.gegenstand, o.beute.regent.menge);
  else laeuterung += o.marke.laeuterung.regent;

  const sud = flasche(vorrat, o);
  const gebraut = braue(sud.rest, o);
  // D403: erst die eigene Form (ein Umbau), dann die Güte.
  const umbauPreis = o.baukasten?.umbau;
  const umbau = !!umbauPreis && reicht(umbauPreis, gebraut.rest);
  const geschmiedet = schmiedeAus(umbau ? ziehe(umbauPreis!, gebraut.rest) : gebraut.rest, o);
  const eingriffe = getoetet + gereinigt + verhGetoetet + verhGereinigt;
  const rund = (x: number) => Math.round(x);
  return {
    name: w.name,
    getoetet: rund(getoetet), gereinigt: rund(gereinigt), umgangen: rund(umgangen),
    verhaerteteGetoetet: verhGetoetet, verhaerteteGereinigt: verhGereinigt,
    ruhigeReviere: ruhig,
    vorrat: Object.fromEntries(Object.entries(vorrat).map(([g, n]) => [g, rund(n)])),
    waffen: geschmiedet.stufen,
    laeuterung: rund(laeuterung), markenStufe: markenStufe(laeuterung, o),
    fassung: fassung(laeuterung, 1, marke, o),
    schlucke: sud.schlucke, staerke: sud.staerke,
    reinkulturenUebrig: (geschmiedet.rest.reinkultur ?? 0) + Math.floor((geschmiedet.rest.reinprobe ?? 0) / 2),
    anteilGereinigt: eingriffe > 0 ? (gereinigt + verhGereinigt) / eingriffe : 0,
    eingriffe: rund(eingriffe), leereReviere: leer, nachgewandert,
    mark: bossGetoetet, abwurf: bossGereinigt,
    lebenPlus: gebraut.plus.leben, ausdauerPlus: gebraut.plus.ausdauer,
    einsicht: rund(einsicht), linien, umbau,
  };
}

/**
 * Die drei Spielweisen aus Reinigen v1 §4, dazu der Umgeher (D385: dritter Stil). `linien` nach der
 * Vertrauenstabelle dort: dem Schlächter traut nur das Erbe; Gemischt und Heiler verlieren die Mönche
 * (zu viele Eingriffe); der Umgeher hat nur sie.
 */
export const SPIELWEISEN: readonly Spielweise[] = [
  { name: 'Schlächter', kaempft: 1, reinigtBisAnteil: 0, toetetRest: true, verhaerteteToeten: 99, regent: 'toeten', menschenToeten: 99, findet: 1, linien: 1 },
  { name: 'Gemischt', kaempft: 1, reinigtBisAnteil: 0.4, toetetRest: true, verhaerteteToeten: 3, regent: 'heilen', menschenToeten: 2, findet: 1, linien: 2 },
  { name: 'Heiler', kaempft: 1, reinigtBisAnteil: 1, toetetRest: false, verhaerteteToeten: 0, regent: 'heilen', menschenToeten: 0, findet: 1, linien: 2 },
  { name: 'Umgeher', kaempft: 0.12, reinigtBisAnteil: 1, toetetRest: false, verhaerteteToeten: 0, regent: 'heilen', menschenToeten: 0, findet: 0.6, linien: 1 },
];
