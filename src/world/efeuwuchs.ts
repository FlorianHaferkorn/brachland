/**
 * BRACHLAND — Efeuwuchs an einer Wand (D359), rein und ohne three.js, damit er testbar bleibt.
 *
 * Flo, 21.11.2026: „das Efeu wächst noch nicht natürlich“. D358 setzte Karten auf frei verteilte Polster — eine Matte,
 * die über der Wand schwebt. Echter Efeu (Hedera helix) wurzelt am Boden, bevorzugt an Ecken und in Fugen, wächst zum
 * Licht nach oben, verzweigt sich und fächert seitlich auf. Unten ist er alt, verholzt und dicht, nach oben jung und
 * licht; Öffnungen umwächst er, nur verfallene Häuser überwuchert er. An der Traufe endet die Wand.
 *
 * Koordinaten: Wand-u in Metern längs der Wand (0 … laenge), y absolut. Ergebnis: Triebe (Strecken mit Alter) und
 * Knoten (Ort, Richtung, Alter) — `hausbewuchs.ts` zeichnet daraus Stämme, Karten und Spitzenblätter.
 */
export interface Oeffnung { u0: number; u1: number; y0: number; y1: number }

export interface WuchsKnoten {
  u: number; y: number;
  /** Wuchsrichtung in der Wand (Einheitsvektor u/y). */
  du: number; dy: number;
  /** 1 an der Wurzel, 0 an der Spitze. */
  alter: number;
  /** Ordnung: 0 Haupttrieb, 1 Seitentrieb, 2 Ranke. */
  ordnung: number;
}

export interface WuchsStrecke { a: WuchsKnoten; b: WuchsKnoten }

export interface Wuchsvorgabe {
  laenge: number;
  /** Bodenhöhe an der Stelle u (Wurzelhöhe). */
  bodenBei: (u: number) => number;
  traufe: number;
  oeffnungen: readonly Oeffnung[];
  /** 0 … 1: wie weit der Efeu die Wand erobert hat (Verfallsstufe, Lage). */
  staerke: number;
  /** Verfallen: darf Öffnungen gelegentlich überwachsen. */
  ueberwaechst: boolean;
  zufall: () => number;
}

const SCHRITT = 0.12;
const RAND = 0.12;

export function wachseEfeu(v: Wuchsvorgabe): { knoten: WuchsKnoten[]; strecken: WuchsStrecke[] } {
  const { laenge, traufe, zufall, staerke } = v;
  const knoten: WuchsKnoten[] = [];
  const strecken: WuchsStrecke[] = [];
  if (laenge < 0.9 || staerke <= 0) return { knoten, strecken };

  const inOeffnung = (u: number, y: number, rand = 0.06) =>
    v.oeffnungen.some(o => u > o.u0 - rand && u < o.u1 + rand && y > o.y0 - rand && y < o.y1 + rand);

  // Wurzeln: an Ecken bevorzugt, sonst frei, nie in einer Öffnung (Tür).
  const zahl = Math.max(1, Math.min(5, Math.round(laenge / 3.2 * (0.5 + staerke))));
  const wurzeln: number[] = [];
  for (let i = 0; i < zahl * 3 && wurzeln.length < zahl; i++) {
    const ecke = zufall() < 0.45;
    const u = ecke ? (zufall() < 0.5 ? 0.18 + zufall() * 0.5 : laenge - 0.18 - zufall() * 0.5) : 0.3 + zufall() * (laenge - 0.6);
    if (inOeffnung(u, v.bodenBei(u) + 0.3, 0.25) || wurzeln.some(w => Math.abs(w - u) < 0.7)) continue;
    wurzeln.push(u);
  }

  /** Ein Trieb: wächst schrittweise, lenkt zum Licht, umgeht Öffnungen, zweigt ab. */
  const wachse = (u: number, y: number, du: number, dy: number, laengeMax: number, ordnung: number, alterStart: number) => {
    let vorher: WuchsKnoten = { u, y, du, dy, alter: alterStart, ordnung };
    knoten.push(vorher);
    const schritte = Math.max(2, Math.floor(laengeMax / SCHRITT));
    for (let s = 1; s <= schritte; s++) {
      // Lichtwendig: zieht nach oben, Seitentriebe erst seitlich, dann aufwärts; dazu Unruhe.
      const zug = ordnung === 0 ? 0.25 : 0.12;
      du += (zufall() - 0.5) * 0.35; dy += zug + (zufall() - 0.5) * 0.15;
      const n = Math.hypot(du, dy) || 1; du /= n; dy /= n;
      let nu = u + du * SCHRITT, ny = y + dy * SCHRITT;
      if (inOeffnung(nu, ny) && !(v.ueberwaechst && zufall() < 0.3)) {
        // Umgehen: zur näheren Kante der Öffnung seitlich ausweichen.
        const o = v.oeffnungen.find(q => nu > q.u0 - 0.06 && nu < q.u1 + 0.06 && ny > q.y0 - 0.06 && ny < q.y1 + 0.06)!;
        const links = Math.abs(nu - o.u0) < Math.abs(o.u1 - nu);
        du = links ? -1 : 1; dy = 0.15;
        nu = u + du * SCHRITT; ny = y + dy * SCHRITT * 0.5;
        if (inOeffnung(nu, ny)) break;
      }
      if (nu < RAND || nu > laenge - RAND || ny > traufe - 0.08 || ny < v.bodenBei(nu) - 0.05) break;
      const alter = alterStart * (1 - s / schritte);
      const k: WuchsKnoten = { u: nu, y: ny, du, dy, alter, ordnung };
      knoten.push(k); strecken.push({ a: vorher, b: k });
      vorher = k; u = nu; y = ny;
      // Verzweigen: im alten Teil häufiger, Seitentriebe fächern 35–75° ab.
      if (ordnung < 2 && zufall() < (ordnung === 0 ? 0.16 : 0.10) * (0.4 + alter)) {
        const seite = zufall() < 0.5 ? -1 : 1, winkel = (35 + zufall() * 40) * Math.PI / 180;
        const bu = du * Math.cos(winkel) - seite * dy * Math.sin(winkel);
        const by = seite * du * Math.sin(winkel) + dy * Math.cos(winkel);
        wachse(u, y, bu, Math.max(0.05, by), laengeMax * (0.25 + 0.45 * zufall()) * alter + 0.3, ordnung + 1, alter * 0.85);
      }
    }
  };

  for (const u of wurzeln) {
    const y0 = v.bodenBei(u) - 0.02;
    const hoehe = (traufe - y0) * (0.35 + 0.65 * staerke) * (0.7 + 0.3 * zufall());
    wachse(u, y0, (zufall() - 0.5) * 0.4, 1, hoehe * 1.25, 0, 1);
    // Am Fuss zwei kurze Triebe seitlich: der Efeu läuft erst ein Stück am Sockel entlang.
    for (const seite of [-1, 1]) if (zufall() < 0.7) wachse(u, y0 + 0.05, seite, 0.35, 0.5 + zufall() * 1.2 * staerke, 1, 0.8);
  }
  return { knoten, strecken };
}
