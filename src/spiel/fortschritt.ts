/**
 * BRACHLAND — Fortschritt: Stufe, Erfahrung, Mutation
 *
 * Was bisher fehlte, war der Grund weiterzuspielen. Man fing eine Kreatur, kämpfte
 * damit — und sie blieb für immer gleich. Die drei Mutationsstufen lagen als Daten
 * im Repo, ohne dass es einen Weg gab, sie zu erreichen.
 *
 * Zwei Achsen, bewusst getrennt:
 * - **Stufe** (1…40): stetiger Zuwachs an Werten. Sie macht den Unterschied zwischen
 *   „ich kann diesen Kampf gewinnen" und „noch nicht".
 * - **Mutation** (1…3): sprunghafter Wechsel von Name, Gestalt und Moveset. Sie ist
 *   das Ereignis, auf das man hinspielt.
 *
 * Reine Rechnung, kein Zustand, keine Anzeige — deshalb prüfbar
 * (`tests/fortschritt.test.ts`).
 */

/** Höchste erreichbare Stufe. */
export const STUFE_MAX = 40;

/**
 * Stufen, ab denen die zweite und dritte Mutation greifen.
 *
 * 14 und 28 liegen bewusst nicht in der Mitte: Die erste Mutation soll früh genug
 * kommen, dass man sie im ersten Kapitel erlebt, die zweite spät genug, dass sie
 * etwas bedeutet. Zweistufige Linien nehmen nur den ersten Wert.
 */
export const MUTATION_AB = [1, 14, 28] as const;

/**
 * Erfahrung für die nächste Stufe.
 *
 * Exponent 2,30 gegen einen linear wachsenden Ertrag je Sieg. Die Differenz der
 * beiden Kurven ist die eigentliche Entscheidung: Die ersten Stufen kommen schnell,
 * damit der Einstieg trägt, und die letzten kosten so viel, dass die Höchststufe
 * **nicht** im ersten Kapitel erreichbar ist. Œntal ist auf 6 Stunden ausgelegt
 * (`content/regions/oental.json`), das Spiel auf fünf Regionen.
 *
 * Exponent und Ertrag sind **durchgerechnet**, nicht geschätzt. Über 16 Kombinationen:
 *
 * | Exponent | Ertrag | bis Mut. 2 | bis Mut. 3 | bis Stufe 40 |
 * |---|---|---|---|---|
 * | 1,50 | 70 | 16 | 36 | 54 — Kapitel 1 verbraucht das ganze System |
 * | 1,95 | 70 | 37 | 115 | 201 — der Einstieg zäh |
 * | **2,30** | **260** | **22** | **83** | **162** |
 * | 2,45 | 360 | 22 | 92 | 188 |
 *
 * Nicht die Höhe der Kurve entscheidet, sondern ihre Krümmung gegen den Ertrag: Ein
 * höherer Ertrag verschiebt alle drei Zahlen gleichzeitig, ein höherer Exponent
 * spreizt sie. Gebraucht wurde die Spreizung.
 */
export function erfahrungFuerStufe(stufe: number): number {
  return Math.round(30 * Math.pow(Math.max(1, stufe), 2.3));
}

/**
 * Erfahrung, die das Besiegen einer Kreatur dieser Stufe einbringt.
 *
 * Der Faktor 260 gehört zum Exponenten 2,30 in `erfahrungFuerStufe` — die beiden
 * lassen sich nicht einzeln ändern. Der Zuschlag für höhere Mutationen sorgt dafür,
 * dass sich das Aufsuchen stärkerer Gegner lohnt, statt schwache abzufarmen.
 */
export function erfahrungAusSieg(gegnerStufe: number, gegnerMutation: number): number {
  return Math.round(260 * gegnerStufe * (1 + gegnerMutation * 0.35));
}

/** Welche Mutation gehört zu dieser Stufe, begrenzt durch die Linie. */
export function mutationBei(stufe: number, mutationen: number): number {
  let m = 0;
  for (let i = 0; i < Math.min(mutationen, MUTATION_AB.length); i++)
    if (stufe >= MUTATION_AB[i]) m = i;
  return m;
}

/**
 * Wert einer Kreatur auf einer Stufe.
 *
 * `basis` sind die Roster-Zahlen **aller** Mutationen dieser Linie, in der Reihenfolge
 * des Inhalts. Zwischen zwei Mutationsschwellen wird auf den nächsten Roster-Wert
 * hin interpoliert; jenseits der letzten wächst der Wert um weitere 30 %.
 *
 * Der erste Versuch rechnete je Mutation vom eigenen Basiswert aus 45 % hoch. Das
 * ergab beim Grathorn Stufe 13 = 184 KP und Stufe 14 = **162 KP** — die Kreatur
 * wurde beim Mutieren schwächer. Ein Fortschrittssystem, das rückwärts laufen kann,
 * ist keins. So herum ist die Monotonie kein Balancing, sondern Bauart: Der Wert
 * läuft auf den nächsten Roster-Wert zu und trifft ihn genau an der Schwelle.
 */
export function werteBei(basis: number[], stufe: number): number {
  const mutationen = basis.length;
  const m = mutationBei(stufe, mutationen);
  const von = MUTATION_AB[Math.min(m, MUTATION_AB.length - 1)];
  const letzteMutation = m + 1 >= mutationen;
  const bis = letzteMutation
    ? STUFE_MAX
    : MUTATION_AB[Math.min(m + 1, MUTATION_AB.length - 1)];
  const zielWert = letzteMutation ? basis[m] * 1.30 : basis[m + 1];
  const t = Math.max(0, Math.min(1, (stufe - von) / Math.max(1, bis - von)));
  return Math.max(1, Math.round(basis[m] + (zielWert - basis[m]) * t));
}

export interface Aufstieg {
  stufe: number;
  erfahrung: number;
  /** Wie viele Stufen dazugekommen sind. */
  gestiegen: number;
  /** Neue Mutation, falls sich etwas geändert hat. */
  mutation: number;
  mutiert: boolean;
}

/**
 * Erfahrung gutschreiben und daraus Stufe und Mutation ableiten.
 *
 * Mehrere Stufen auf einmal sind ausdrücklich erlaubt — wer nach langer Pause einen
 * starken Gegner legt, soll den Sprung auch bekommen.
 */
export function gutschrift(
  stufe: number, erfahrung: number, gewinn: number, mutationen: number,
): Aufstieg {
  const vorher = mutationBei(stufe, mutationen);
  let s = stufe, e = erfahrung + gewinn, gestiegen = 0;
  while (s < STUFE_MAX && e >= erfahrungFuerStufe(s)) {
    e -= erfahrungFuerStufe(s);
    s++; gestiegen++;
  }
  if (s >= STUFE_MAX) { s = STUFE_MAX; e = 0; }
  const nachher = mutationBei(s, mutationen);
  return { stufe: s, erfahrung: e, gestiegen, mutation: nachher, mutiert: nachher !== vorher };
}

/**
 * Stufe einer wilden Kreatur nach Entfernung zur Regionsmitte.
 *
 * Dieselbe Regel wie bei der Mutation (Ledger D33): Schwierigkeit folgt dem Weg,
 * nicht dem Würfel. Im Startbereich Stufe 3–6, am Rand der Region 22–30.
 */
export function wildStufe(abstandMeter: number, wurf: number): number {
  const t = Math.max(0, Math.min(1, abstandMeter / 1600));
  const mitte = 4 + t * 22;
  return Math.max(1, Math.round(mitte + (wurf - 0.5) * (4 + t * 6)));
}
