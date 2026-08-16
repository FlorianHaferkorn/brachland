/**
 * Was kostet die Szene an CPU-Arbeit je Bild — unabhängig von jeder Grafikeinstellung.
 *
 * Der Anlass: 23–45 B/s auf dem Zielgerät bei nur ~210.000 gezeichneten Dreiecken,
 * und die Bildrate blieb gleich, egal ob Pixelauflösung, Schatten oder Gras aus waren.
 * Wenn kein Grafikschalter wirkt, liegt die Last nicht auf der GPU. Dieses Werkzeug
 * misst die Größe, die stattdessen zählt: wie viele Objekte je Bild angefasst werden.
 *
 * `npm run last`
 */
import { entpackeWelt } from '../src/world/osm.js';
import { readFileSync } from 'node:fs';
import { baueTerrain } from '../src/world/terrain.js';
import { verteileProps, chunkeProps } from '../src/world/props.js';
import { ATTRAPPE_AB } from '../src/scenes/sichtweiten.js';

const welt = entpackeWelt(JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt);
const t = baueTerrain(welt);
const props = verteileProps(welt, t, 1);
const chunks = chunkeProps(props);

const STANDORTE: [number, number][] = [[0, 0], [300, -300], [-350, 350], [450, 100]];

console.log('Last je Bild — Objekte im Szenengraph\n');
console.log(`  Prop-Instanzen          ${props.length.toLocaleString('de').padStart(9)}`);
console.log(`  Chunks gesamt           ${chunks.length.toLocaleString('de').padStart(9)}`);
console.log('');

let schlimmster = 0;
for (const [kx, kz] of STANDORTE) {
  let sichtbar = 0, fern = 0;
  for (const c of chunks) {
    const d = Math.hypot(c.mitte[0] - kx, c.mitte[1] - kz) - c.radius;
    if (d > c.sichtweite) continue;
    sichtbar++;
    if (d > ATTRAPPE_AB) fern++;
  }
  schlimmster = Math.max(schlimmster, sichtbar);
  const anteil = (100 * sichtbar / chunks.length).toFixed(1);
  console.log(`  Standort (${String(kx).padStart(4)},${String(kz).padStart(5)})  ${String(sichtbar).padStart(5)} sichtbar (${anteil.padStart(4)} % · davon ${fern} als Attrappe)`);
}

console.log('');
console.log(`  Vorher:  ${chunks.length.toLocaleString('de')} montierte Komponenten, jede mit eigenem useFrame`);
console.log(`  Nachher: ${schlimmster.toLocaleString('de')} montierte Komponenten, ein einziger useFrame in der Verwaltung`);
console.log(`  Faktor:  ${(chunks.length / Math.max(1, schlimmster)).toFixed(0)}x weniger Objekte, die three.js je Bild durchläuft`);
console.log('');
console.log('  Belegt ist damit nur die Objektzahl. Ob die Bildrate steigt, zeigt die');
console.log('  Anzeige im Spiel auf dem Zielgerät (B/s und Objekte, rechts oben).');
