/**
 * Stehen Wasser, Wege und Häuser auf dem Boden, den man SIEHT?
 *
 * Der erste Anlauf dieses Werkzeugs hat gegen `terrain.hoeheAn` gemessen und einen
 * mittleren Fehler von 0,76 m gemeldet. Die Zahl war falsch — nicht die Rechnung,
 * die **Annahme**: Die Szene reicht den Bauern gar nicht `terrain` durch, sondern
 * `{...terrain, hoeheAn: feld.hoehe}` (RegionsSzene.tsx:271). Gemessen wurde ein
 * Pfad, den das Spiel nicht benutzt. Lehre, schon wieder dieselbe: **Ein Messwerkzeug
 * muss den Aufrufer nachbauen, nicht die Signatur.**
 *
 * Was übrig bleibt, ist der echte Fehler, und der ist strukturell:
 *
 *   `feld.hoehe`      — stetige Funktion. Daraus wird die Aufsatzgeometrie gelegt.
 *   gezeichnete Fläche — Dreiecksnetz mit Vertices im **LOD-Abstand**. 2 m nah,
 *                        32 m fern. Dazwischen linear interpoliert.
 *
 * Beide sind nur im Nahbereich fast gleich. Eine Kachel in 500 m Entfernung hat
 * Vertices alle 16 m; die Fläche schneidet dort durch jede Kuppe. Das Wasserband
 * folgt aber weiter der feinen Funktion — und hängt in der Luft. Genau deshalb
 * fliegen Bachläufe **teilweise**: in der Ferne, nicht vor der Nase.
 *
 * Gemessen wird deshalb je LOD-Stufe.
 *
 * `npm run aufsatz`
 */
import { readFileSync } from 'node:fs';
import { entpackeWelt } from '../src/world/osm.js';
import { baueTerrain, schuerze, WEG_TEILUNG } from '../src/world/terrain.js';
import { baueHoehenfeld, hoeheAufFlaeche, aufsatzboden, LOD_STUFEN } from '../src/world/lod.js';

const welt = entpackeWelt(JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt);
const t = baueTerrain(welt);
const feld = baueHoehenfeld(welt);

const HALB_B = t.breiteMeter / 2, HALB_T = t.tiefeMeter / 2;
const nachWelt = ([lat, lon]: number[]): [number, number] => {
  const [s, w, n, e] = welt.bbox;
  return [(((lon - w) / (e - w)) - 0.5) * t.breiteMeter,
          -(((lat - s) / (n - s)) - 0.5) * t.tiefeMeter];
};
const drin = (x: number, z: number) => Math.abs(x) < HALB_B - 5 && Math.abs(z) < HALB_T - 5;

/** Genau das Objekt, das die Szene den Bauern reicht — nicht ein zweites daneben. */
const boden = aufsatzboden(feld);
const wasser = aufsatzboden(feld, true);



/** Kennzahlen einer Fehlerliste, in Metern. Positiv = schwebt, negativ = versinkt. */
function auswerten(name: string, fehler: number[], grenze: number): void {
  if (!fehler.length) { console.log(`  ${name.padEnd(14)} keine Proben`); return; }
  const abs = fehler.map(Math.abs).sort((a, b) => a - b);
  const p = (q: number) => abs[Math.min(abs.length - 1, Math.floor(q * abs.length))];
  const mittel = abs.reduce((a, b) => a + b, 0) / abs.length;
  console.log(`  ${name.padEnd(14)} Mittel ${mittel.toFixed(2).padStart(5)} m`
    + ` · Median ${p(0.5).toFixed(2).padStart(5)} m`
    + ` · 95. ${p(0.95).toFixed(2).padStart(5)} m`
    + ` · max ${abs[abs.length - 1].toFixed(2).padStart(6)} m`
    + ` · schwebt > 0,5 m: ${(100 * fehler.filter(x => x > 0.5).length / fehler.length).toFixed(1).padStart(5)} %`);
}

/**
 * Dieselben Proben, die der Bauer setzt: Teilstücke à `WEG_TEILUNG`, und je Stück
 * die beiden **Bandkanten** — nicht die Mittellinie. Die Böschung wird an der
 * Kante entschieden, also muss sie dort auch gemessen werden.
 */
function verdichten(punkte: number[][], breite: number): [number, number][] {
  const raus: [number, number][] = [];
  const halbe = breite / 2;
  for (let k = 0; k < punkte.length - 1; k++) {
    const [ax, az] = nachWelt(punkte[k]), [bx, bz] = nachWelt(punkte[k + 1]);
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * halbe, nz = (dx / len) * halbe;
    const n = Math.max(1, Math.ceil(len / WEG_TEILUNG));
    for (let s = 0; s < n; s++) {
      const x = ax + dx * s / n, z = az + dz * s / n;
      for (const seite of [-1, 1]) {
        const px = x + nx * seite, pz = z + nz * seite;
        if (drin(px, pz)) raus.push([px, pz]);
      }
    }
  }
  return raus;
}

const wasserPunkte = welt.linien.flatMap(l => verdichten(l.punkte, l.breite));
const wegPunkte = welt.wege.flatMap(w => verdichten(w.punkte, w.breite));

console.log('Stehen aufgesetzte Geometrien auf der gezeichneten Fläche?\n');
console.log(`  ${wasserPunkte.length} Gewässer- und ${wegPunkte.length} Wegproben,`
  + ' je LOD-Stufe gegen das Netz gerechnet, das dort tatsächlich gezeichnet wird.\n');

/**
 * Zwei Zahlen je Stufe:
 *
 *   „roh"       — wie weit die Bandoberkante von der gezeichneten Fläche abweicht.
 *                 Ändert sich durch die Schürze nicht, und soll es auch nicht:
 *                 Nah an der Kamera liegt das Band richtig, und das bleibt so.
 *   „offen"     — wie viel davon **sichtbar** in der Luft hängt, also nicht von
 *                 der Böschung nach unten gedeckt wird. Das ist die Zahl, die
 *                 der Spieler sieht, und die einzige, die hier fallen muss.
 */
for (let lod = 0; lod < LOD_STUFEN.length; lod++) {
  const s = LOD_STUFEN[lod].schritt;
  const bis = LOD_STUFEN[lod].bisMeter;
  const rohW: number[] = [], offenW: number[] = [];
  for (const [x, z] of wasserPunkte) {
    const y = wasser.hoeheAn(x, z) + 0.06;
    const flaeche = hoeheAufFlaeche(feld, x, z, s) + feld.wasserTiefe(x, z);
    rohW.push(y - flaeche);
    offenW.push(Math.max(0, y - schuerze(wasser, x, z, y) - flaeche));
  }
  const rohP: number[] = [], offenP: number[] = [];
  for (const [x, z] of wegPunkte) {
    const y = boden.hoeheAn(x, z) + 0.12;
    const flaeche = hoeheAufFlaeche(feld, x, z, s);
    rohP.push(y - flaeche);
    offenP.push(Math.max(0, y - schuerze(boden, x, z, y) - flaeche));
  }
  console.log(`LOD${lod} · Vertexabstand ${String(s).padStart(2)} m · ab Kameraabstand `
    + `${lod === 0 ? '0' : LOD_STUFEN[lod - 1].bisMeter} m`
    + `${Number.isFinite(bis) ? ` bis ${bis} m` : ''}`);
  auswerten('Gewässer roh', rohW, 0.5);
  auswerten('Gewässer offen', offenW, 0.5);
  auswerten('Weg roh', rohP, 0.5);
  auswerten('Weg offen', offenP, 0.5);
}

// ---- Häuser ---------------------------------------------------------------
// Der Sockel wird auf die niedrigste ECKE gesetzt. Die Kante dazwischen kann
// tiefer liegen — dort klafft die Lücke unter der Wand, die man von außen sieht.
console.log('\nGebäude — Lücke unter der Wand (LOD0, 2 m)');
const luecke: number[] = [], grundflaeche: number[] = [], orientiertF: number[] = [];
for (const g of welt.gebaeude) {
  const p = g.punkte.map(nachWelt);
  if (p.length < 3 || !p.every(([x, z]) => drin(x, z))) continue;
  // Genau die Abtastung, die baueGebaeude fährt: Wandlinie alle 1,5 m.
  let sockel = Infinity, unterkante = Infinity, tiefste = Infinity;
  for (let k = 0; k < p.length - 1; k++) {
    const [ax, az] = p[k], [bx, bz] = p[k + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
    for (let i = 0; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
      sockel = Math.min(sockel, boden.hoeheAn(x, z));
      unterkante = Math.min(unterkante, boden.tiefsteFlaeche(x, z));
      tiefste = Math.min(tiefste, hoeheAufFlaeche(feld, x, z));
    }
  }
  const fuss = sockel - Math.min(2.5, Math.max(0, sockel - unterkante));
  luecke.push(fuss - tiefste);

  // Das Dach sitzt auf einer Hülle, die Wände folgen dem Grundriss. Je größer die
  // Hülle gegenüber dem Grundriss, desto weiter steht der Deckel über das Haus
  // hinaus. Achsparallel war das im Median das Doppelte; orientiert ist es das,
  // was die Grundrissform selbst hergibt.
  const xs = p.map(q => q[0]), zs = p.map(q => q[1]);
  const achsparallel = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
  let achse = 0, laengste = 0;
  for (let k = 0; k < p.length - 1; k++) {
    const dx = p[k + 1][0] - p[k][0], dz = p[k + 1][1] - p[k][1];
    const l = Math.hypot(dx, dz);
    if (l > laengste) { laengste = l; achse = Math.atan2(dz, dx); }
  }
  const c = Math.cos(achse), si = Math.sin(achse);
  const us = p.map(([x, z]) => x * c + z * si), vs = p.map(([x, z]) => -x * si + z * c);
  const orientiert = (Math.max(...us) - Math.min(...us)) * (Math.max(...vs) - Math.min(...vs));
  let a = 0;
  for (let k = 0; k < p.length - 1; k++) a += p[k][0] * p[k + 1][1] - p[k + 1][0] * p[k][1];
  a = Math.abs(a) / 2;
  if (a > 1) { grundflaeche.push(achsparallel / a); orientiertF.push(orientiert / a); }
}
auswerten('Wandunterkante', luecke, 0.5);
console.log(`  ${'schwebend'.padEnd(14)} ${luecke.filter(x => x > 0.05).length} von ${luecke.length} Häusern`
  + ' haben mehr als 5 cm Luft unter mindestens einer Wand');
console.log(`\nGebäude — Dachhülle gegen Grundrissfläche`);
const kennzahl = (name: string, werte: number[]) => {
  const s2 = [...werte].sort((x, y) => x - y);
  console.log(`  ${name.padEnd(14)} Median ${s2[Math.floor(s2.length / 2)].toFixed(2)}x`
    + ` · 95. ${s2[Math.floor(s2.length * 0.95)].toFixed(2)}x`
    + ` · max ${s2[s2.length - 1].toFixed(1)}x`);
};
kennzahl('achsparallel', grundflaeche);
kennzahl('orientiert', orientiertF);
console.log('  Nur 9 % der Grundrisse liegen achsnah, die mittlere Drehung beträgt 27°.');
console.log('  Achsparallel war das Dach im Median doppelt so groß wie das Haus darunter —');
console.log('  Deckel und Körper waren zwei verschiedene Formen.');
