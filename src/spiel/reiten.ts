/**
 * BRACHLAND — Reiten
 *
 * Die Traversal-Vorlage nennt Reiten als Antwort auf eine Zahl, die im
 * Maßstabskommentar von `MASSSTAB` steht: 4 km Region sind zu Fuß rund 13 Minuten.
 * Das sollte ausdrücklich **nicht** über Stauchung gelöst werden, sondern über
 * Spielinhalt — und das ist dieser hier.
 *
 * Zwei Bedingungen, beide aus Bestandsdaten:
 *
 * 1. **Bauform.** Getragen wird nur von `quadruped`. Ein Alpenschneehuhn mit
 *    0,85 m Widerrist trägt niemanden, und eine Kreuzotter erst recht nicht. Das
 *    ist keine Balance-Entscheidung, sondern Maßstabstreue — der Grund, warum das
 *    Projekt überhaupt 3D ist.
 * 2. **Mutationsstufe 2.** Damit ist Reiten kein Startzustand, sondern etwas, das
 *    man sich erspielt: 22 Kämpfe bis zur ersten Mutation (`fortschritt.ts`). Eine
 *    Fortbewegungsart, die von Minute eins verfügbar ist, verändert nichts an der
 *    Wahrnehmung der Region — sie ersetzt sie nur.
 *
 * Reines Modul (`tests/reiten.test.ts`).
 *
 * ## Seit D413: getragen wird nach Tragfähigkeit, nicht nach Bauform
 *
 * Die zwei Bedingungen oben sind die **alte Regel** (bis D413). Sie liess jeden Vierbeiner ab
 * Mutationsstufe 2 tragen — einen Keiler von 140 kg, der real 28 kg trägt (Physik-Prüfung v1 §4.2).
 * D411 hat entschieden: Das Reittier ist **das letzte verwilderte Tragtier des Försterhofs**
 * (`content/bewegung.json` `tragtier`, Entwurf). Seit D413 trägt nur ein Tier, dessen leichteste
 * Masse den Reiter beim Traglastanteil trägt — und Massen stehen nur für dieses Tier in den Daten.
 * **Folge: Bis das Tragtier gebaut ist, trägt im Spiel kein Tier, Reiten geht nicht.**
 *
 * Entwickler-Schalter `?reitprobe=1` setzt die alte Regel wieder ein, damit man Reiten am M1
 * weiter prüfen kann (Tempo 5 / 13 m/s, Steigung, Sitz). Kein Spielwert, nur für den Vergleich.
 */
import { BEWEGUNG } from '../spieler/tempo.js';
import type { Bewegung } from '../data/schema.js';

/** `?reitprobe=1`: die alte Regel (Vierbeiner ab Mutation 2) für den Test am M1, D413. */
export const REITPROBE = typeof location !== 'undefined'
  && new URLSearchParams(location.search).get('reitprobe') === '1';

/** Trägt dieses Tier einen Reiter mit Zeug? Leichteste Masse × Traglastanteil ≥ Last (D398, D411). */
export function tragfaehig(tier: Bewegung['tragtier']): boolean {
  return tier.masse.min * tier.traglastAnteil >= tier.reiterLast - 1e-9;
}

/** Bauformen, die tragen können. Widerrist unter 1 m trägt keinen Menschen. */
export const TRAEGT: readonly string[] = ['quadruped'];

/**
 * Ab dieser Mutation (0-basiert) trägt ein Tier.
 *
 * 1 heißt Mutationsstufe **2** in der Sprache der Stilreferenz. Die Skalierung
 * `1 + mutation * 0.2` macht daraus 1,2 m Widerrist — die Schwelle, ab der ein
 * Vierbeiner einen erwachsenen Menschen tragen kann, ohne lächerlich auszusehen.
 */
export const REITEN_AB_MUTATION = 1;

/**
 * Tempo im Sattel, Schritt und Galopp.
 *
 * Bis D412 7,5 / 17,0 m/s — 61 km/h auf Dauer, über dem Sprint jedes Tiers der Welt
 * (Physik-Prüfung v1 Zeile 22). Seit D411/D412 **5 / 13 m/s** aus
 * `content/bewegung.json` (`reiten`): folgt dem Renntempo (8,5), bleibt rund ×1,5
 * schneller. Der `?renntempo=`-Schalter verschiebt nur das Rennen zu Fuss, nicht das
 * Reiten.
 *
 * **Wer trägt (D411, seit D413 auch im Code):** das letzte verwilderte Tragtier des
 * Försterhofs (`bewegung.json` `tragtier`, Entwurf), nicht ein gereinigter Keiler — siehe
 * `traegt()`; die alte Regel nur noch hinter `?reitprobe=1`.
 */
export const REITEN_GEHEN = BEWEGUNG.reiten.gehen;
export const REITEN_RENNEN = BEWEGUNG.reiten.rennen;

/**
 * Steigungsgrenze im Sattel, in Grad.
 *
 * Höher als die 40° zu Fuß, aber nicht beliebig: Ein Steinbock geht Hänge hoch,
 * die ein Mensch nicht mehr geht — Wände geht er trotzdem nicht. Der Abstand zu
 * `KLIPPE_AB_GRAD` (41°) ist der Punkt: Zu Pferd kommt man an Hängen vorbei, für
 * die man sonst absteigen und klettern müsste, aber an einer Felsplatte ist auch
 * im Sattel Schluss.
 */
export const REIT_MAX_GRAD = 52;

export interface Reitkandidat {
  /** Platz im Team — der Aufrufer braucht ihn zurück. */
  platz: number;
  kreatur: string;
  name: string;
  basisRig: string;
  /** 0-basiert. */
  mutation: number;
}

/** Die alte Regel bis D413: Bauform und Mutationsstufe. Gilt nur noch hinter `?reitprobe=1`. */
export function traegtAlteRegel(basisRig: string, mutation: number): boolean {
  return TRAEGT.includes(basisRig) && mutation >= REITEN_AB_MUTATION;
}

/**
 * Trägt dieser Kandidat? Seit D413 nur das Tragtier aus den Daten, und nur, wenn es tragfähig ist.
 * Mit `probe` (Vorgabe `?reitprobe=1`) die alte Regel.
 */
export function traegt(k: Pick<Reitkandidat, 'kreatur' | 'basisRig' | 'mutation'>,
                       probe = REITPROBE, tier = BEWEGUNG.tragtier): boolean {
  if (probe) return traegtAlteRegel(k.basisRig, k.mutation);
  return k.kreatur === tier.id && tragfaehig(tier);
}

/**
 * Das beste Reittier im Team, oder null.
 *
 * „Bestes" heißt: höchste Mutation. Bei Gleichstand der vordere Platz — das Team
 * ist geordnet, und diese Ordnung ist die Aussage des Spielers darüber, was ihm
 * wichtig ist. Sie zu übergehen wäre eine stille Entscheidung an seiner Stelle.
 */
export function besteReittier(team: readonly Reitkandidat[], probe = REITPROBE): Reitkandidat | null {
  let beste: Reitkandidat | null = null;
  for (const k of team) {
    if (!traegt(k, probe)) continue;
    if (!beste || k.mutation > beste.mutation) beste = k;
  }
  return beste;
}

/**
 * Warum geht es (noch) nicht? Ein Satz für die Oberfläche.
 *
 * Eine Fähigkeit, die nicht auslöst und nicht sagt warum, liest sich als Fehler.
 */
export function warumNicht(team: readonly Reitkandidat[], probe = REITPROBE): string | null {
  if (besteReittier(team, probe)) return null;
  if (team.length === 0) return 'Kein Team.';
  // D413: Ohne Probe trägt nur das Tragtier — der Satz sagt, warum ein Wildtier nicht reicht.
  if (!probe) return 'Keines dieser Tiere trägt einen Erwachsenen.';
  const vierbeiner = team.filter(k => TRAEGT.includes(k.basisRig));
  if (vierbeiner.length === 0) return 'Kein Vierbeiner im Team, der tragen könnte.';
  const beste = Math.max(...vierbeiner.map(k => k.mutation));
  return `${vierbeiner.find(k => k.mutation === beste)!.name} ist noch zu klein — Mutationsstufe ${REITEN_AB_MUTATION + 1} nötig.`;
}
