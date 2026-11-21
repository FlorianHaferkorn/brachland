/**
 * Tests für den physikalischen Himmel (D368, `src/world/atmosphaere.ts`).
 *
 * Geprüft wird, was die Kopplung verspricht und was beim Nachstellen der Luft leicht umkippt:
 * - Klare Luft ergibt ein **blaues** Zenit (Rayleigh) — das Modell rechnet überhaupt Physik.
 * - Die Luft von `zielbild` ergibt ein **warmes** Zenit und trifft die Kunstwerte (ADR-0006): Das
 *   ist der Grund, warum der Prototyp `zielbild` nicht ersetzt, sondern nachbildet.
 * - Die Kopplung lässt die Helligkeit von Nebel, Sonne und Fülllicht stehen (eingemessen, D152/D172)
 *   und ändert nur den Farbton.
 * - Tiefe Sonne färbt das Sonnenlicht wärmer als hohe.
 * - Die Tabellen kosten einmal je Stimmung, nicht je Bild (Rechenzeit unter einer Grenze).
 */
import {
  rechneHimmel, koppleStimmung, hexLinear, leuchtdichte, ATMOSPHAERE_VORGABE, mischeAtmosphaere,
  ANSICHT_B, ANSICHT_H, himmelZuFarben,
} from '../src/world/atmosphaere.js';
import { STIMMUNG } from '../src/world/stimmung.js';

let ok = 0, fehler = 0;
const pruefe = (name: string, wahr: boolean, info = '') => {
  if (wahr) ok++; else { fehler++; console.error(`FEHLER ${name} ${info}`); }
};
const fmt = (c: readonly number[]) => c.map(x => x.toFixed(4)).join('/');

const klar = { ...ATMOSPHAERE_VORGABE, aerosol: 0.08 };
const Z = { zenit: 0.05, horizont: 0.1 };
const pk = rechneHimmel(klar, [0, 60, -40], Z);
pruefe('klare Luft: Zenit blau', pk.zenit[2] > pk.zenit[0] * 1.5, fmt(pk.zenit));
pruefe('Tabelle hat die erwartete Grösse', pk.ansicht.length === ANSICHT_B * ANSICHT_H * 3);
pruefe('keine negativen oder ungültigen Strahldichten', pk.ansicht.every(v => Number.isFinite(v) && v >= 0));
const fz = leuchtdichte(pk.zenit) / Z.zenit, fh = leuchtdichte(pk.horizont) / Z.horizont;
pruefe('Skala trifft Zenit und Horizont im geometrischen Mittel', Math.abs(fz * fh - 1) < 1e-6, `${fz} ${fh}`);

const z = STIMMUNG.zielbild;
pruefe('zielbild trägt eine Atmosphäre', !!z.atmosphaere);
const g = koppleStimmung(z);
const zenit = hexLinear(g.zenit);
pruefe('zielbild: Zenit nicht blau (B < 1,15 R)', zenit[2] < 1.15 * zenit[0], g.zenit);
// Nähe zum Kunstwert (#4c4340), in Blenden je Kanal: näher als mit klarer Luft.
const blenden = (x: readonly number[], y: readonly number[]) =>
  Math.hypot(...x.map((v, i) => Math.log2(Math.max(v, 1e-4) / Math.max(y[i], 1e-4))));
const kunst = hexLinear(z.zenit);
const klarZenit = hexLinear(koppleStimmung(z, klar).zenit);
pruefe('zielbild: Zenit näher am Kunstwert als klare Luft', blenden(zenit, kunst) < blenden(klarZenit, kunst),
  `${g.zenit} gegen ${z.zenit}`);
for (const k of ['nebel', 'sonne', 'umgebung'] as const) {
  const a = leuchtdichte(hexLinear(z[k])), b = leuchtdichte(hexLinear(g[k]));
  pruefe(`Kopplung hält Helligkeit ${k}`, Math.abs(b / a - 1) < 0.05, `${z[k]} → ${g[k]}`);
}
pruefe('Kopplung lässt Stärken stehen', g.sonneStaerke === z.sonneStaerke && g.umgebungStaerke === z.umgebungStaerke
  && g.nebelFern === z.nebelFern && g.belichtung === z.belichtung);
const nh = hexLinear(g.nebel), hh = hexLinear(g.horizont);
pruefe('Nebel trägt den Farbton des Horizonts', Math.abs(nh[0] / nh[2] - hh[0] / hh[2]) < 0.15, `${g.nebel} ${g.horizont}`);
const wieder = himmelZuFarben(g.atmosphaere!, z.sonnenstand, g.zenit, g.horizont);
const frei = rechneHimmel(z.atmosphaere!, z.sonnenstand,
  { zenit: leuchtdichte(hexLinear(g.zenit)), horizont: leuchtdichte(hexLinear(g.horizont)) });
pruefe('aus den gekoppelten Farben folgt dieselbe Skala', Math.abs(frei.skala / wieder.skala - 1) < 0.02,
  `${frei.skala} ${wieder.skala}`);

const tief = rechneHimmel(ATMOSPHAERE_VORGABE, [100, 8, 0], Z).sonneBoden;
const hoch = rechneHimmel(ATMOSPHAERE_VORGABE, [20, 100, 0], Z).sonneBoden;
pruefe('tiefe Sonne wärmer als hohe', tief[2] / tief[0] < hoch[2] / hoch[0], `${fmt(tief)} / ${fmt(hoch)}`);

const m = mischeAtmosphaere(klar, z.atmosphaere!, 0.5);
pruefe('Mischung liegt dazwischen', m.aerosol > klar.aerosol && m.aerosol < z.atmosphaere!.aerosol);

const ms = rechneHimmel({ ...ATMOSPHAERE_VORGABE, aerosol: 0.333 }, [10, 20, 30], Z).ms;
console.log(`Tabellen je Stimmung: ${ms.toFixed(0)} ms (Durchlass 64×64, Mehrfach 16×16, Ansicht ${ANSICHT_B}×${ANSICHT_H})`);
pruefe('Tabellen unter 400 ms', ms < 400, ms.toFixed(0));

console.log(`atmosphaere: ${ok} ok, ${fehler} Fehler`);
if (fehler) process.exit(1);
