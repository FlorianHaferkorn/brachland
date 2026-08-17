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
 */

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

/** Tempo zu Pferd. Knapp doppelt so schnell wie zu Fuß, siehe Kopfkommentar. */
export const REITEN_GEHEN = 7.5;
export const REITEN_RENNEN = 17.0;

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

export function traegt(basisRig: string, mutation: number): boolean {
  return TRAEGT.includes(basisRig) && mutation >= REITEN_AB_MUTATION;
}

/**
 * Das beste Reittier im Team, oder null.
 *
 * „Bestes" heißt: höchste Mutation. Bei Gleichstand der vordere Platz — das Team
 * ist geordnet, und diese Ordnung ist die Aussage des Spielers darüber, was ihm
 * wichtig ist. Sie zu übergehen wäre eine stille Entscheidung an seiner Stelle.
 */
export function besteReittier(team: readonly Reitkandidat[]): Reitkandidat | null {
  let beste: Reitkandidat | null = null;
  for (const k of team) {
    if (!traegt(k.basisRig, k.mutation)) continue;
    if (!beste || k.mutation > beste.mutation) beste = k;
  }
  return beste;
}

/**
 * Warum geht es (noch) nicht? Ein Satz für die Oberfläche.
 *
 * Eine Fähigkeit, die nicht auslöst und nicht sagt warum, liest sich als Fehler.
 */
export function warumNicht(team: readonly Reitkandidat[]): string | null {
  if (besteReittier(team)) return null;
  if (team.length === 0) return 'Kein Team.';
  const vierbeiner = team.filter(k => TRAEGT.includes(k.basisRig));
  if (vierbeiner.length === 0) return 'Kein Vierbeiner im Team, der tragen könnte.';
  const beste = Math.max(...vierbeiner.map(k => k.mutation));
  return `${vierbeiner.find(k => k.mutation === beste)!.name} ist noch zu klein — Mutationsstufe ${REITEN_AB_MUTATION + 1} nötig.`;
}
