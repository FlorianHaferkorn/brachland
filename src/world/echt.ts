/**
 * BRACHLAND — Schalter des Vertikalschnitts „so echt wie möglich“ (Stauwehr, 11.11.2026)
 *
 * Flo am 11.11.2026: „so realistisch, plastisch und echt wie möglich“. Alles, was dafür neu ist,
 * hängt zunächst an Schaltern, damit der erarbeitete Look daneben bitgleich bleibt und am M1 in
 * Bewegung verglichen werden kann (ADR-0005/0006). `?echt=1` schaltet alles zusammen ein,
 * die Einzelschalter erlauben den Vergleich Stück für Stück.
 */
const suche = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
const an = (name: string) => suche.get(name) === '1';

export const ECHT = an('echt');
/** Foto-Blattkarten auf den Kronen der Blender-Szenen (`laubkarten.ts`). */
export const LAUBKARTEN_AN = ECHT || an('laubkarten');
/**
 * Bachufer grün statt Schlamm: Bäche werden mit einer ganzen Rasterzelle (~10 m bei 384) als Biom
 * `wasser` gestempelt. Wo dort trocken ist, zählt die Zelle als Wiese — Farbe, Gras, Streu.
 */
export const UFER_GRUEN = ECHT || an('ufer');
/**
 * Kantenglättung im Zwischenbild (`Kontur.tsx`): Seit D155 zeichnet die Szene für AO/Kontur/Bloom
 * in ein Renderziel mit `samples: 0` — `antialias` am Canvas wirkt dann nie, jede Kante hat
 * Treppen. `?msaa=0|2|4|8` setzt die Samples für die Messung am M1; `?echt=1` nimmt 4.
 */
export const MSAA: number = (() => {
  const roh = suche.get('msaa');
  const n = roh === null ? NaN : Number(roh);
  if ([0, 2, 4, 8].includes(n)) return n;
  return ECHT ? 4 : 0;
})();
