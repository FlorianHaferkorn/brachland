/**
 * BRACHLAND — Das Heft: was der Brachgänger gehört, gelesen und gesehen hat (D392)
 *
 * `docs/design/BRACHLAND_Quests_v1.md` §2: Es gibt kein Auftragslog und keine Kartenmarke für Ziele
 * (Story-Struktur v1). Was es stattdessen gibt, ist ein Heft, das **wörtlich** festhält, was gesagt
 * wurde, was auf einem Fundstück stand und was an einer Zuflucht zu sehen war — mit dem Ort in
 * Worten, nicht als Marke. Es sagt nie, was als Nächstes zu tun ist; es sagt nur, was schon bekannt ist.
 * Das ist die Antwort auf den häufigsten Einwand gegen diese Bauweise: Wer nach drei Wochen
 * weiterspielt, weiss sonst nicht mehr, wer wo was wollte.
 *
 * **Abgeleitet, nicht mitgeschrieben** (wie `spiel/auftraege.ts`): Der Spielstand weiss bereits, welche
 * Fundstücke gelesen, welche Orte geöffnet und welche Aufträge angenommen sind. Das Heft ist eine
 * Sicht darauf. Das Einzige, was dafür neu im Stand steht, ist die Station einer Wanderfigur
 * (`wanderfigur-<id>:<n>` in `orte`, geschrieben in `main.tsx` `oeffneOrt`) — ohne sie wäre der Satz
 * einer Figur fort, sobald sie weiterzieht.
 *
 * Reines Modul ohne three.js und React (`tests/notizbuch.test.ts`). Eine Anzeige gibt es noch nicht.
 */
import type { Auftrag, Fragment, Ort, Wanderfigur } from '../data/schema.js';

/** Der Teil des Spielstands, aus dem das Heft entsteht. Die Listen stehen in der Reihenfolge des Findens. */
export interface Heftstand {
  fragmente: readonly string[];
  orte: readonly string[];
  /** Aufträge mit Stand (`angenommen` | `abgeholt`); `unbekannt` steht nicht im Heft. */
  auftraege: Readonly<Record<string, string>>;
}

export interface Heftinhalt {
  fragmente: readonly Fragment[];
  orte: readonly Ort[];
  auftraege: readonly Auftrag[];
  figuren: readonly Wanderfigur[];
}

export interface Notiz {
  /** `gelesen`: Fundstück. `gesagt`: Bewohner, Wanderfigur, Auftrag. `gesehen`: Zuflucht. */
  art: 'gelesen' | 'gesagt' | 'gesehen';
  /** Wer oder was: Titel des Fundstücks, Name der Figur, Name der Zuflucht. */
  quelle: string;
  /** Wo, in Worten — nur wo es sich nicht aus `quelle` ergibt (Station einer Wanderfigur). */
  wo?: string;
  /** Der Wortlaut, unverändert aus den Inhalten. */
  text: string;
  /** Nur bei Aufträgen: der Titel, unter dem der Geber es gesagt hat. */
  auftrag?: string;
  /** Nur bei Aufträgen: Der Lohn ist abgeholt — die Sache ist zwischen beiden erledigt. */
  erledigt?: boolean;
}

const STATION = /^wanderfigur-([a-z0-9-]+):(\d+)$/;

/**
 * Alle Einträge des Hefts: erst das Gelesene, dann Gesagtes und Gesehenes je Ort, jeweils in der
 * Reihenfolge, in der der Spieler es gefunden hat. Was er einem Bewohner an Aufträgen abgenommen hat,
 * steht direkt unter dessen Satz — so bleibt beisammen, was derselbe Mensch gesagt hat.
 *
 * Unbekannte IDs (Inhalt entfernt, anderer Stand) fallen still heraus: Das Heft darf nie der Grund
 * sein, dass ein alter Spielstand nicht lädt.
 */
export function notizbuch(stand: Heftstand, inhalt: Heftinhalt): Notiz[] {
  const raus: Notiz[] = [];
  for (const id of stand.fragmente) {
    const f = inhalt.fragmente.find(x => x.id === id);
    if (f) raus.push({ art: 'gelesen', quelle: f.titel, text: f.text });
  }
  for (const id of stand.orte) {
    const st = STATION.exec(id);
    if (st) {
      const figur = inhalt.figuren.find(x => x.id === st[1]);
      const station = figur?.stationen[Number(st[2])];
      if (figur && station) raus.push({ art: 'gesagt', quelle: figur.name, wo: station.wo, text: station.text });
      continue;
    }
    const o = inhalt.orte.find(x => x.id === id);
    if (!o) continue;
    raus.push({ art: o.art === 'bewohner' ? 'gesagt' : 'gesehen', quelle: o.name, text: o.text });
    for (const a of inhalt.auftraege) {
      const s = stand.auftraege[a.id];
      if (a.geber !== o.id || (s !== 'angenommen' && s !== 'abgeholt')) continue;
      raus.push({ art: 'gesagt', quelle: o.name, text: a.text, auftrag: a.titel, erledigt: s === 'abgeholt' });
    }
  }
  return raus;
}

/**
 * An welchen Stationen der Spieler eine Figur angesprochen hat — die Grundlage dafür, ob sie ihm
 * später traut (Quests v1 §5). Aufsteigend, ohne Doppelte.
 */
export function gehoerteStationen(orte: readonly string[], figur: string): number[] {
  const n = orte.map(id => STATION.exec(id)).filter(m => m && m[1] === figur).map(m => Number(m![2]));
  return [...new Set(n)].sort((a, b) => a - b);
}
