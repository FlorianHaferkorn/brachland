/** D359: natürlicher Efeuwuchs — Wurzeln am Boden, zum Licht, Öffnungen umwachsen, oben lichter. */
import assert from 'node:assert/strict';
import { wachseEfeu, type Oeffnung } from '../src/world/efeuwuchs.js';
import { mulberry } from '../src/world/props.js';

const fenster: Oeffnung[] = [
  { u0: 1.6, u1: 2.5, y0: 1.05, y1: 2.2 }, { u0: 4.6, u1: 5.5, y0: 1.05, y1: 2.2 },
  { u0: 1.6, u1: 2.5, y0: 3.95, y1: 5.1 }, { u0: 4.6, u1: 5.5, y0: 3.95, y1: 5.1 },
];
const basis = { laenge: 7, bodenBei: (u: number) => 0.1 * Math.sin(u), traufe: 6, oeffnungen: fenster };
let pruefungen = 0;

for (let saat = 1; saat <= 40; saat++) {
  for (const [staerke, ueberwaechst] of [[0.5, false], [0.8, false], [1, true]] as const) {
    const { knoten, strecken } = wachseEfeu({ ...basis, staerke, ueberwaechst, zufall: mulberry(saat * 977) });
    assert.ok(knoten.length > 10, `Saat ${saat}: zu wenig Wuchs (${knoten.length})`);
    for (const k of knoten) {
      assert.ok(k.y <= basis.traufe - 0.08 + 1e-9, 'über der Traufe');
      assert.ok(k.u >= 0.12 - 1e-9 && k.u <= basis.laenge - 0.12 + 1e-9, 'über den Wandrand');
      if (!ueberwaechst) assert.ok(!fenster.some(o => k.u > o.u0 && k.u < o.u1 && k.y > o.y0 && k.y < o.y1),
        `Saat ${saat}: Knoten im Fenster (${k.u.toFixed(2)}/${k.y.toFixed(2)})`);
      pruefungen++;
    }
    // Wurzeln: Haupttriebe beginnen am Boden.
    const wurzeln = knoten.filter(k => k.ordnung === 0 && k.alter === 1);
    assert.ok(wurzeln.length >= 1 && wurzeln.every(w => Math.abs(w.y - basis.bodenBei(w.u)) < 0.05), 'Wurzel nicht am Boden');
    // Strecken sind kurz (ein Schritt) und gehen überwiegend aufwärts.
    assert.ok(strecken.every(s => Math.hypot(s.b.u - s.a.u, s.b.y - s.a.y) < 0.2), 'Sprung im Trieb');
    const aufwaerts = strecken.filter(s => s.b.y > s.a.y).length / Math.max(1, strecken.length);
    assert.ok(aufwaerts > 0.6, `Saat ${saat}: nur ${Math.round(aufwaerts * 100)} % aufwärts`);
  }
}

// Oben lichter: im obersten Drittel weniger Knoten als im untersten (gemittelt über alle Saaten).
let unten = 0, oben = 0;
for (let saat = 1; saat <= 40; saat++) {
  for (const k of wachseEfeu({ ...basis, staerke: 0.8, ueberwaechst: false, zufall: mulberry(saat * 31) }).knoten) {
    if (k.y < 2) unten++; else if (k.y > 4) oben++;
  }
}
assert.ok(oben < unten, `oben ${oben} nicht lichter als unten ${unten}`);
// Stärke wirkt: schwacher Bewuchs bleibt niedriger.
const hoechster = (staerke: number) => Math.max(...Array.from({ length: 20 }, (_, i) =>
  Math.max(...wachseEfeu({ ...basis, staerke, ueberwaechst: false, zufall: mulberry(i + 5) }).knoten.map(k => k.y))));
assert.ok(hoechster(0.5) <= hoechster(1) + 1e-9, 'schwacher Bewuchs wächst höher als starker');
console.log(`efeuwuchs: ${pruefungen} Knoten geprüft, unten ${unten} / oben ${oben}`);
