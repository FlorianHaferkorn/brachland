/**
 * Die Schmiede (D177): Beute aus den Wegelagern gegen eine bessere Waffe.
 *
 * Drei Stufen je Waffe; jede Stufe hebt Schaden und Haltungsschaden um 12 %. Mehr nicht — die
 * Waffe bleibt dieselbe Klasse mit denselben Fenstern (ADR-0008), sie trifft nur härter. Die Kosten
 * steigen, und der Herzfunke (selten) steckt ab Stufe 2 drin: Wer die Axt auf 3 will, muss am
 * Almsteig gewesen sein.
 */
/** `speer` seit D183 — ältere Stände haben ihn nicht, darum überall `?? 0`. */
export type WaffenStufen = { klinge: number; axt: number; speer?: number;
  /** D188: eingesetzter Kernfunke — gilt für jede Waffe (die Marke trägt ihn, nicht der Stahl). */
  funke?: 'wasser' | 'stein' };
export const KEINE_STUFEN: WaffenStufen = { klinge: 0, axt: 0, speer: 0 };
export type Schmiedewaffe = 'klinge' | 'axt' | 'speer';
export const WAFFENNAME: Record<Schmiedewaffe, string> = { klinge: 'Klinge', axt: 'Axt', speer: 'Speer' };
export const MAX_STUFE = 3;
export const JE_STUFE = 0.12;

export interface Angebot { waffe: Schmiedewaffe; stufe: number; preis: Record<string, number>; name: string }

export function angebot(waffe: Schmiedewaffe, jetzt = 0): Angebot | null {
  if (jetzt >= MAX_STUFE) return null;
  const stufe = jetzt + 1;
  const preis: Record<string, number> = stufe === 1 ? { harzverband: 1 }
    : stufe === 2 ? { harzverband: 2, herzfunke: 1 } : { harzverband: 3, herzfunke: 2 };
  const name = `${WAFFENNAME[waffe]} ${['geschärft', 'gehärtet', 'meisterlich'][stufe - 1]}`;
  return { waffe, stufe, preis, name };
}

/** D188: Kernfunke einsetzen — erst, wenn der Regent besiegt ist; kostet Harz für die Fassung. */
export const FUNKE_PREIS: Record<string, number> = { harzverband: 2 };
export const FUNKE_REGENT = { wasser: 'flussvater' } as const;

export function bezahlbar(a: Angebot, beutel: Record<string, number>): boolean {
  return Object.entries(a.preis).every(([g, n]) => (beutel[g] ?? 0) >= n);
}

export function bezahle(a: Angebot, beutel: Record<string, number>): Record<string, number> {
  const neu = { ...beutel };
  for (const [g, n] of Object.entries(a.preis)) neu[g] = (neu[g] ?? 0) - n;
  return neu;
}

export function schadenFaktor(stufe: number): number {
  return 1 + JE_STUFE * Math.max(0, Math.min(MAX_STUFE, stufe));
}
