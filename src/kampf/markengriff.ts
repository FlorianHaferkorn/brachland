/**
 * BRACHLAND — Markengriff: Reinigen aus der Eingabe (D417)
 *
 * Der Regelkern steht seit D376 in `kampf/echtzeit.ts` (`kannReinigen`, `setzeReinigenAn`, `loeseReinigen`,
 * bestätigt D379, Dauer je Tier D389/D395) und wird hier **nicht** geändert — der Kampfbot (D407) liest
 * dieselben Regeln. Dieses Modul ist nur die Anbindung an die Eingabe und die Anzeige:
 *
 * - `drueckeReinigen`: die Aktion `reinigen` (F / Gamepad X, `content/belegung.json`). Beginnt den Griff,
 *   wenn die Regeln es erlauben; sonst sagt es, **warum nicht** — eine Taste, die still nichts tut, liest
 *   sich wie ein Fehler.
 * - `rolleImGriff`: Rolle im Kanal heisst lösen und rollen (Reinigen v1 §2 „Eingabe“). Der Puffer der
 *   Rolle (0,3 s) überdauert das Lösen (0,2 s), die Rolle kommt also von selbst hinterher.
 * - `reinigenLage`: was die Anzeige braucht — wer der Kandidat ist, ob die Marke **jetzt** greifen kann,
 *   ob er nur niedergerungen und nah ist, und der Fortschritt am Tier.
 *
 * Renderfrei (kein three.js, kein React, kein DOM): `tests/markengriff.test.ts`.
 */
import {
  KOMBO_AB, istBefallen, kannReinigen, loeseReinigen, puffere, randAbstand, reinigungsLadung, setzeReinigenAn,
  type Kampfwelt, type Kaempfer,
} from './echtzeit.js';

/** Was ein Druck auf „Reinigen“ bewirkt hat. `begonnen` ist der einzige Erfolg. */
export type GriffAntwort =
  | 'begonnen'
  /** Ohne `Kampfwelt.marke` gibt es die Handlung nicht. */
  | 'keine-marke'
  /** Kein befallenes Tier auf dem Platz (nur Menschen oder alle schon aus dem Kampf). */
  | 'nichts-befallen'
  /** Das Ziel ist ein Mensch (D385): Die Marke wirkt auf Symbionten, Menschen sind nicht befallen. */
  | 'mensch'
  /** Verhärtet und keine Reinkultur dabei. */
  | 'verhaertet'
  | 'leer'
  /** Leben noch über der Schwelle (35 %). */
  | 'nicht-wund'
  /** Weiter als `reichweite` (1,8 m) vom Rand des Tiers. */
  | 'zu-weit'
  /** Die Spielerin schlägt, rollt, blockt oder kanalisiert schon. */
  | 'beschaeftigt'
  /** Alles stimmt, aber das Tier steht nicht offen (nicht betäubt, nicht in der Erholung, nicht lauernd). */
  | 'kein-fenster';

/** Kurze Meldung für die Kampfanzeige — dieselbe Sprache wie „ausgewichen“, „Haltung gebrochen“. */
export const GRIFF_MELDUNG: Record<GriffAntwort, string> = {
  begonnen: 'Griff',
  'keine-marke': '',
  'nichts-befallen': 'nichts zu reinigen',
  mensch: 'die Marke greift nicht bei Menschen',
  verhaertet: 'verhärtet — ohne Reinkultur greift sie nicht',
  leer: 'Marke leer — rasten',
  'nicht-wund': 'erst niederringen',
  'zu-weit': 'zu weit — heran',
  beschaeftigt: 'erst ausschwingen',
  'kein-fenster': 'auf die Lücke warten',
};

/**
 * Auf wen bezieht sich ein Druck? Das aufgeschaltete Ziel, sonst das nächste befallene Tier — dieselbe
 * Reihenfolge wie `setzeReinigenAn`, nur auch dann, wenn die Marke gerade nicht greifen kann.
 */
function bezug(w: Kampfwelt): Kaempfer | undefined {
  const s = w.spielerin;
  const ziel = w.ziel ? w.gegner.find(g => g.id === w.ziel && g.phase !== 'gefallen') : undefined;
  if (ziel) return ziel;
  let best: Kaempfer | undefined;
  for (const g of w.gegner) if (istBefallen(g) && (!best || randAbstand(s, g) < randAbstand(s, best))) best = g;
  return best;
}

/** Warum die Marke `z` jetzt nicht greift — in der Reihenfolge, in der man es beheben würde. */
export function warumNicht(w: Kampfwelt, z: Kaempfer | undefined): Exclude<GriffAntwort, 'begonnen'> {
  const m = w.marke, s = w.spielerin;
  if (!m) return 'keine-marke';
  if (!z) return 'nichts-befallen';
  if (!istBefallen(z)) return z.werte.mensch ? 'mensch' : 'nichts-befallen';
  if (z.zustand === 'verhaertet' && !m.reinkultur) return 'verhaertet';
  if (m.ladung < reinigungsLadung(m.werte, z) - 1e-9) return 'leer';
  if (z.leben > m.werte.schwelle * z.werte.lebenMax + 1e-9) return 'nicht-wund';
  if (randAbstand(s, z) > m.werte.reichweite) return 'zu-weit';
  const abbrechbar = s.phase === 'erholung' && s.zeit >= s.schlag.erholung * KOMBO_AB;
  if (s.phase !== 'bereit' && !abbrechbar) return 'beschaeftigt';
  return 'kein-fenster';
}

/**
 * Die Aktion `reinigen`. Greift, wenn die Regeln es erlauben (`setzeReinigenAn`: Ziel, sonst das nächste
 * greifbare), und sagt sonst, woran es liegt. Ein Druck während des Kanals tut nichts.
 */
export function drueckeReinigen(w: Kampfwelt): GriffAntwort {
  if (!w.marke) return 'keine-marke';
  if (w.spielerin.phase === 'reinigen') return 'beschaeftigt';
  if (setzeReinigenAn(w)) return 'begonnen';
  // Ist irgendein anderes Tier greifbar, hätte `setzeReinigenAn` es genommen — also liegt es am Bezug.
  return warumNicht(w, bezug(w));
}

/**
 * Rolle gedrückt: im Kanal erst lösen (kostet `loesen` s), dann rollt sie aus dem Puffer heraus.
 * Ausserhalb des Kanals einfach die Rolle, wie bisher.
 */
export function rolleImGriff(w: Kampfwelt, rx: number, rz: number): void {
  if (w.marke && w.spielerin.phase === 'reinigen') loeseReinigen(w);
  puffere(w.spielerin, 'rolle', rx, rz);
}

/** Was die Anzeige über die Marke wissen muss. */
export interface ReinigenLage {
  /** Wen die Marke gerade hält, sonst wen ein Druck meinen würde (nur befallene Tiere). */
  kandidat: string | null;
  /**
   * `kanal`: die Spielerin hält gerade · `greifbar`: ein Druck greift jetzt · `nah`: niedergerungen und in
   * Reichweite, aber das Tier steht nicht offen oder die Spielerin ist im Schwung · `aus`: nichts davon.
   */
  stufe: 'kanal' | 'greifbar' | 'nah' | 'aus';
  /** Fortschritt am Kandidaten 0…1, `null` ohne Kandidat. */
  fortschritt: number | null;
  ladung: number;
}

export function reinigenLage(w: Kampfwelt): ReinigenLage | null {
  const m = w.marke;
  if (!m) return null;
  const s = w.spielerin;
  if (s.phase === 'reinigen' && m.ziel) {
    const z = w.gegner.find(g => g.id === m.ziel);
    return { kandidat: m.ziel, stufe: 'kanal', fortschritt: z?.reinigung ?? 0, ladung: m.ladung };
  }
  // Greifbar: genau das Tier, das `setzeReinigenAn` jetzt nähme.
  const ziel = w.ziel ? w.gegner.find(g => g.id === w.ziel && kannReinigen(w, g)) : undefined;
  let greift = ziel;
  if (!greift) for (const g of w.gegner) if (kannReinigen(w, g) && (!greift || randAbstand(s, g) < randAbstand(s, greift))) greift = g;
  if (greift) return { kandidat: greift.id, stufe: 'greifbar', fortschritt: greift.reinigung ?? 0, ladung: m.ladung };
  // Nah: Schwelle erreicht, in Reichweite, reinigbar, Ladung reicht — nur das Fenster fehlt.
  const z = bezug(w);
  if (z && istBefallen(z)) {
    const grund = warumNicht(w, z);
    const stufe = grund === 'kein-fenster' || grund === 'beschaeftigt' ? 'nah' : 'aus';
    return { kandidat: z.id, stufe, fortschritt: (z.reinigung ?? 0) > 0 || stufe === 'nah' ? z.reinigung ?? 0 : null, ladung: m.ladung };
  }
  return { kandidat: null, stufe: 'aus', fortschritt: null, ladung: m.ladung };
}
