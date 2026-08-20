/**
 * BRACHLAND — Regionskarte auf ein Canvas zeichnen
 *
 * ## Warum es sie jetzt doch gibt
 *
 * `Witterung.tsx` hielt fest: „das ersetzt eine Karte, die es nicht geben soll."
 * Der Gedanke war richtig und die Folge falsch. Richtig ist: Eine Karte, die
 * jeden Fundort verrät, nimmt der Region das Suchen. Falsch ist der Umkehrschluss
 * — ohne **jede** Übersicht steht der Regent 1.381 m entfernt hinter einer
 * Nebelgrenze von 420 m, und niemand findet ihn je (G-101).
 *
 * Diese Karte zeigt deshalb **Gelände und Wege, aber keine Beute**: wo man war,
 * wohin man laufen kann, und die drei Dinge, die man selbst freigespielt hat
 * (besuchte Orte, gelesene Fundstücke, das verfolgte Auftragsziel). Sie zeigt
 * keine Kreaturen, keine ungelesenen Fundstücke und keine Zufluchten, die man
 * noch nicht gesehen hat.
 *
 * ## Warum Biome und nicht Schummerung
 *
 * `tools/hoehenbild.mjs` zeichnet eine Schummerung, und die liest sich als
 * Landschaft. Auf 300 px Handybreite liest sie sich als grauer Fleck. Was man
 * auf einer Spielkarte wiedererkennt, sind **Flächen und Linien**: der Wald
 * dunkel, die Wiese hell, die Wege als Netz. Deshalb Biomraster als Grund,
 * Höhenlinien nur als Andeutung darüber.
 */
import type { Weltdaten, Biom } from '../world/osm.js';
import { regionsMasse } from '../data/inhalte.js';

/** Gedämpfte Kartentöne — nicht die Weltpalette, die ist für Licht gemacht. */
const GRUND: Record<Biom, string> = {
  fels: '#333630',
  wald: '#1c2a22',
  gebuesch: '#243024',
  wiese: '#2b3527',
  acker: '#33351f',
  wasser: '#1b2c35',
  siedlung: '#39352c',
  industrie: '#2f2b28',
  ruine: '#302b26',
  unbekannt: '#22261f',
};
const AUSWEICH = '#22261f';

export interface Kartenmarke {
  x: number;
  z: number;
  art: 'spieler' | 'ort' | 'zuflucht' | 'fund' | 'ziel';
  name?: string;
}

/**
 * Karte zeichnen. Gibt die Weltmaße zurück, damit der Aufrufer Klicks
 * zurückrechnen kann.
 *
 * `kante` ist die Seitenlänge in Gerätepixeln — der Aufrufer skaliert mit `dpr`,
 * damit die Karte auf dem Handy nicht matschig wird.
 */
export function zeichneKarte(
  ctx: CanvasRenderingContext2D, welt: Weltdaten, kante: number,
): { breiteMeter: number; tiefeMeter: number } {
  const { breite: breiteMeter, tiefe: tiefeMeter } = regionsMasse(welt.bbox);
  const n = welt.biome.length;
  const zelle = kante / n;

  ctx.fillStyle = AUSWEICH;
  ctx.fillRect(0, 0, kante, kante);

  // Grund: Biomraster. `+1` bei der Kantenlänge, weil zwischen zwei Zellen sonst
  // eine Haarlinie Hintergrund durchscheint — auf 300 px ein sichtbares Gitter.
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = GRUND[welt.biome[j][i]] ?? AUSWEICH;
      ctx.fillRect(i * zelle, j * zelle, zelle + 1, zelle + 1);
    }
  }

  // Höhenlinien alle 100 m, nur angedeutet. Sie machen aus der Fläche ein
  // Gelände, ohne den Kontrast der Biome zu schlucken.
  ctx.strokeStyle = '#00000038';
  ctx.lineWidth = 1;
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const h = welt.hoehen[j][i];
      if (!Number.isFinite(h)) continue;
      const stufe = Math.floor(h / 100);
      if (Math.floor(welt.hoehen[j][i + 1] / 100) !== stufe
          || Math.floor(welt.hoehen[j + 1][i] / 100) !== stufe) {
        ctx.strokeRect(i * zelle, j * zelle, zelle, zelle);
      }
    }
  }

  // Wege — das Netz, an dem man sich orientiert. Breite Klassen heller.
  const [sued, west, nord, ost] = welt.bbox;
  const zuPixel = (lat: number, lon: number): [number, number] => [
    ((lon - west) / (ost - west)) * kante,
    ((nord - lat) / (nord - sued)) * kante,
  ];
  for (const w of welt.wege) {
    if (w.punkte.length < 2) continue;
    ctx.strokeStyle = w.breite >= 5 ? '#7a7059' : w.breite >= 3 ? '#5d5747' : '#46422f';
    ctx.lineWidth = w.breite >= 5 ? 1.8 : 1;
    ctx.beginPath();
    w.punkte.forEach(([la, lo], k) => {
      const [px, py] = zuPixel(la, lo);
      k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  // Bäche über die Wege, weil sie die Region gliedern und oft daneben laufen.
  ctx.strokeStyle = '#3f6a7d';
  ctx.lineWidth = 1.2;
  for (const l of welt.linien) {
    if (l.punkte.length < 2) continue;
    ctx.beginPath();
    l.punkte.forEach(([la, lo], k) => {
      const [px, py] = zuPixel(la, lo);
      k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  // Gebäude als Punkte. Einzelne Grundrisse sind auf dieser Größe nicht lesbar,
  // aber ihre **Häufung** ist genau das, was ein Dorf auf einer Karte ausmacht.
  ctx.fillStyle = '#6c6350';
  for (const g of welt.gebaeude) {
    if (!g.punkte.length) continue;
    const [px, py] = zuPixel(g.punkte[0][0], g.punkte[0][1]);
    ctx.fillRect(px - 0.9, py - 0.9, 1.8, 1.8);
  }

  return { breiteMeter, tiefeMeter };
}

/** Weltkoordinate zu Kartenpixel. Die Welt liegt zentriert um (0,0). */
export function weltZuKarte(
  x: number, z: number, kante: number, breiteMeter: number, tiefeMeter: number,
): [number, number] {
  return [
    (x / breiteMeter + 0.5) * kante,
    (z / tiefeMeter + 0.5) * kante,
  ];
}

const MARKENFARBE: Record<Kartenmarke['art'], string> = {
  spieler: '#3fd9a0',
  ort: '#c8a86b',
  zuflucht: '#7fc8a0',
  fund: '#8a93c8',
  ziel: '#e0743f',
};

/** Marken über die gezeichnete Karte legen. */
export function zeichneMarken(
  ctx: CanvasRenderingContext2D, marken: Kartenmarke[], kante: number,
  breiteMeter: number, tiefeMeter: number,
): void {
  for (const m of marken) {
    const [px, py] = weltZuKarte(m.x, m.z, kante, breiteMeter, tiefeMeter);
    ctx.fillStyle = MARKENFARBE[m.art];
    if (m.art === 'spieler') {
      // Der Spieler bekommt einen Ring statt eines Punktes — er muss auch dann
      // auffindbar sein, wenn er auf einer Marke steht.
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#3fd9a0';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (m.art === 'ziel') {
      // Das verfolgte Ziel ist das Einzige, was man aus der Ferne wiederfinden
      // muss — deshalb größer und mit Fadenkreuz.
      ctx.strokeStyle = MARKENFARBE.ziel;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px - 9, py); ctx.lineTo(px - 3, py);
      ctx.moveTo(px + 3, py); ctx.lineTo(px + 9, py);
      ctx.moveTo(px, py - 9); ctx.lineTo(px, py - 3);
      ctx.moveTo(px, py + 3); ctx.lineTo(px, py + 9);
      ctx.stroke();
      continue;
    }
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
