/**
 * BRACHLAND — Reviere aus dem Gelände rechnen (D416)
 *
 * Kerne von Hand (je Revier ein Punkt mit Begründung: Tal, Hangstufe, Weg, Zuflucht, Flutlinie), Grenzen gerechnet:
 * Jede Zelle des Revierrasters gehört zu dem Kern, den man von ihr aus mit dem geringsten **Weg** erreicht
 * (Dijkstra über acht Nachbarn). Der Weg folgt dem Gelände:
 *
 * - **Steigung nach Naismith:** 1 Stunde je 5 km plus 1 Stunde je 600 m Anstieg — 1 m Höhe kostet so viel wie
 *   8,3 m Strecke. Hier in beide Richtungen (eine Grenze ist symmetrisch). Grate werden so zu Grenzen.
 * - **Wasser unter der Flutlinie** (499 m, `content/regions/oental.json`): Schwimmen kostet das Vierfache des Gehens
 *   (Schwimmen ≈ 1 m/s gegen Gehen ≈ 4 km/h — real eher das Drei- bis Vierfache; der Wert ist gesetzt, nicht gemessen).
 *   Jeder Ein- und Ausstieg an der Flutlinie kostet zusätzlich 20 km — praktisch eine Wand: Die Flutlinie ist
 *   die Grenze (sie trennt Tiere, die schwimmen, von denen, die es nicht tun), Wasser gehört den Flutrevieren, Land
 *   den Landrevieren. Nur eine Insel, die vom Land aus nur über Wasser erreichbar ist, fällt an ein Flutrevier.
 *
 * Abgeleitet und in die Datei geschrieben: Fläche, Höhenspanne, Anteil unter der Flutlinie, Zufluchten und verborgene
 * Orte darin, erwartete Tiere je Kreatur (aus `verteileKreaturen`, Seed 7 — dieselbe Rechnung wie die Welt),
 * Nachbarn (gemeinsame Zellkante). `npm run validate` prüft die Datei gegen das Raster.
 *
 *   npx tsx tools/reviere.ts [region] [--schreiben]
 *
 * Ohne `--schreiben` nur die Tabelle. Messwerkzeug, nicht im Gate.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { entpackeWelt } from '../src/world/osm.js';
import { baueTerrain } from '../src/world/terrain.js';
import { verteileKreaturen, type KreaturSpawn } from '../src/world/vorkommen.js';
import { Revierkarte, type Revier } from '../src/data/schema.js';
import { baueRevierwelt, masseAus } from '../src/spiel/reviere.js';

const REGION = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? 'oental';
const SCHREIBEN = process.argv.includes('--schreiben');
/** Zellen je Seite: 64 → rund 62 m. Fein genug für Ufer und Talgründe, grob genug für eine lesbare Datei. */
const RASTER = 64;
const NAISMITH = 5000 / 600;
const WASSER = 4;
/** Ein- oder Ausstieg an der Flutlinie: so viele Meter Weg. Gesetzt als Wand (siehe oben). */
const UFER = 20_000;

interface Kern { id: string; zeichen: string; name: string; kern: [number, number]; begruendung: string }

/**
 * Die Kerne des Œntals. Meter der Region (x Ost, z Süd; Lagen aus `BRACHLAND_Enklave_Lage_v2.md`). Zwölf, weil
 * D393 mit zwölf gerechnet hat und das Gelände zwölf Einheiten hergibt: fünf Talgründe und Hangstufen am Westufer,
 * drei Höhen im Westen, zwei Ufer, der Südhang und die Flut.
 */
const KERNE: Record<string, Kern[]> = {
  // Dreizehn statt zwölf: Die Flut (3,7 km², ein Viertel der Region) ist als ein Revier zu gross und zerfällt in den
  // Seeboden vor der Terrasse und den Stau am Kalkbruch.
  oental: [
    { id: 'oental-terrasse', zeichen: 'A', name: 'Terrasse von Brannburg', kern: [690, -660],
      begruendung: 'Hangterrasse 505–525 m über der Flut mit der Enklave; nach Osten die Flutlinie, nach Westen der Hangwald. Das Revier um die Menschen.' },
    { id: 'oental-nordufer', zeichen: 'B', name: 'Waldrand am Nordufer', kern: [200, -1100],
      begruendung: 'Hangfuss nördlich der Terrasse vom Waldrand (Feldscheune, 600 m) hinunter zum Nordufer (Schuppen) — der trockene Weg zum Absetzbecken (Reinkultur Nord). Grenze: Flutlinie, Nordhang, Bannwald.' },
    { id: 'oental-nordhang', zeichen: 'C', name: 'Nordhang unter der Kirche', kern: [-300, -1700],
      begruendung: 'Hang am Nordrand mit der Kirche am Nordhang (578 m); eigener Talzug, vom Nordufer durch die Geländestufe getrennt.' },
    { id: 'oental-alm', zeichen: 'D', name: 'Alm unter dem Grat', kern: [-1450, -1400],
      begruendung: 'Hochlage im Nordwesten um die Almhütte (1.055 m), über der Befallsgrenze; Almweg. 500 m über dem Tal — die Steigung trennt sie.' },
    { id: 'oental-bannwald', zeichen: 'E', name: 'Bannwald', kern: [-750, -650],
      begruendung: 'Westlicher Talzug mit der Hütte im Bannwald (verborgener Ort, 704 m); Bach hinunter zur Terrasse. Keine Zuflucht — das Revier des Försters.' },
    { id: 'oental-steig', zeichen: 'F', name: 'Steig und Talweg', kern: [200, -60],
      begruendung: 'Mittlere Hangstufe um den Spielstart: Remise am Steig und Unterstand am Talweg, der Steig hinauf zur Terrasse. Hier liegen die ersten Begegnungen.' },
    { id: 'oental-grat', zeichen: 'G', name: 'Grat am Oberstollen', kern: [-1050, -50],
      begruendung: 'Hochstufe unter dem Grat mit dem Oberstollen (963 m, Reinkultur West); Kletterwand oder alter Almweg. Grenze nach Osten: der Steilhang.' },
    { id: 'oental-graben', zeichen: 'H', name: 'Grabenweg und Bruch', kern: [50, 480],
      begruendung: 'Talzug am Grabenweg mit Heustadel, Tremmel und dem Wart am Bruch (630 m); eigener Bach, durch einen Rücken vom Steig getrennt.' },
    { id: 'oental-quelltopf', zeichen: 'I', name: 'Quellhang', kern: [-1600, 750],
      begruendung: 'Südwestliche Hochlage um den Quelltopf (verborgener Ort, 971 m) knapp unter der Grenze; Bachlauf bis zur Quelle. Keine Zuflucht.' },
    { id: 'oental-suedhang', zeichen: 'J', name: 'Südhang mit Saatkammer', kern: [420, 1150],
      begruendung: 'Südhang über dem Wehr mit der Saatkammer (601 m, Reinkultur Süd); Gleiterweg vom Westhang endet hier. Grenze im Norden: der Graben.' },
    { id: 'oental-uferweg', zeichen: 'K', name: 'Uferweg zum Wehr', kern: [880, 450],
      begruendung: 'Trockener Uferweg vom Stadel am Hangweg zum Wehr und zum Bahnhof (D380: der beschwerliche Weg zum Flussvater); schmal zwischen Hang und Flutlinie.' },
    { id: 'oental-seeboden', zeichen: 'L', name: 'Seeboden vor der Terrasse', kern: [1500, -700],
      begruendung: 'Flut vor der Terrasse bis zum Absetzbecken (Reinkultur Nord liegt auf dem Grund) mit dem Kirchturm im Wasser: die versunkene Stadt. Nur mit Tauchzeug oder nach dem Wandel.' },
    { id: 'oental-stau', zeichen: 'M', name: 'Stau am Kalkbruch', kern: [1450, 650],
      begruendung: 'Stauwasser vor dem Wehr mit der Kalkbruch-Insel und der Kapelle (vor dem Wandel nur mit Tauchzeug, D391). Grenze zum Seeboden: die Engstelle vor dem Bahnhof.' },
  ],
};

// ---------------------------------------------------------------- Gelände
const region = JSON.parse(readFileSync(`content/regions/${REGION}.json`, 'utf8'));
const kerne = KERNE[REGION];
if (!kerne) { console.error(`Keine Kerne für '${REGION}' in tools/reviere.ts`); process.exit(1); }
const flut: number = region.flutlinie ?? -Infinity;
const welt = entpackeWelt(JSON.parse(readFileSync(`public/world/${REGION}.json`, 'utf8')).welt);
const n = welt.aufloesung;
const { breite, tiefe } = masseAus(region.bbox);
const zelleB = breite / RASTER, zelleT = tiefe / RASTER;

// Mittlere Höhe je Revierzelle aus den Weltzellen, deren Mitte darin liegt.
const summe = new Float64Array(RASTER * RASTER), zahl = new Float64Array(RASTER * RASTER);
for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
  const h = welt.hoehen[i][j];
  if (!Number.isFinite(h)) continue;
  const ri = Math.min(RASTER - 1, Math.floor(i / (n - 1) * RASTER)), rj = Math.min(RASTER - 1, Math.floor(j / (n - 1) * RASTER));
  summe[ri * RASTER + rj] += h; zahl[ri * RASTER + rj]++;
}
const hoehe = Float64Array.from(summe, (s, k) => s / Math.max(1, zahl[k]));
const nass = (k: number) => hoehe[k] < flut;

// ---------------------------------------------------------------- Dijkstra von allen Kernen
const kosten = new Float64Array(RASTER * RASTER).fill(Infinity);
const besitzer = new Int16Array(RASTER * RASTER).fill(-1);
const zelle = (x: number, z: number) => {
  const j = Math.max(0, Math.min(RASTER - 1, Math.floor((x / breite + 0.5) * RASTER)));
  const i = Math.max(0, Math.min(RASTER - 1, Math.floor((z / tiefe + 0.5) * RASTER)));
  return i * RASTER + j;
};
// Einfacher Binärheap.
const heap: [number, number][] = [];
const schiebe = (e: [number, number]) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
const nimm = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
kerne.forEach((k, idx) => { const c = zelle(k.kern[0], k.kern[1]); kosten[c] = 0; besitzer[c] = idx; schiebe([0, c]); });
while (heap.length) {
  const [d, c] = nimm();
  if (d > kosten[c]) continue;
  const i = Math.floor(c / RASTER), j = c % RASTER;
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    if (!di && !dj) continue;
    const ni = i + di, nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= RASTER || nj >= RASTER) continue;
    const nc = ni * RASTER + nj;
    const strecke = Math.hypot(di * zelleT, dj * zelleB);
    const schritt = (strecke + NAISMITH * Math.abs(hoehe[nc] - hoehe[c])) * (nass(c) || nass(nc) ? WASSER : 1)
      + (nass(c) !== nass(nc) ? UFER : 0);
    if (d + schritt < kosten[nc]) { kosten[nc] = d + schritt; besitzer[nc] = besitzer[c]; schiebe([d + schritt, nc]); }
  }
}

// ---------------------------------------------------------------- Ableiten
const karte: string[] = [];
for (let i = 0; i < RASTER; i++) karte.push(Array.from({ length: RASTER }, (_, j) => kerne[besitzer[i * RASTER + j]].zeichen).join(''));

const orte = readdirSync('content/orte').filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join('content/orte', f), 'utf8'))).filter(o => o.region === REGION);
const [sued, west, nord, ost] = region.bbox;
const meter = (o: [number, number]): [number, number] => [((o[1] - west) / (ost - west) - 0.5) * breite, ((nord - o[0]) / (nord - sued) - 0.5) * tiefe];
const zeichenAn = (x: number, z: number) => { const c = zelle(x, z); return karte[Math.floor(c / RASTER)][c % RASTER]; };

const kreaturen: KreaturSpawn[] = readdirSync('content/creatures').filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join('content/creatures', f), 'utf8')))
  .filter(k => (region.kreaturen as string[]).includes(k.id));
const t = baueTerrain(welt);
const vorkommen = verteileKreaturen(welt, kreaturen, t.rasterZuWelt, t.hoeheAn, t.breiteMeter, t.tiefeMeter);

/**
 * Lage eines Vorkommens so, wie der Spielstand sie später liest: aus der Zelle der ID (`kreatur:i:j`, Zellmitte), nicht
 * aus der versetzten Lage — sonst zählte ein Tier an einer Grenze hier zum einen, im Stand zum anderen Revier (7 von
 * 1.019 im Œntal). Feste Vorkommen (`:fest`) haben keine Zelle in der ID und zählen nach ihrer Lage.
 */
const lageVon = (v: { id: string; position: [number, number, number] }): [number, number] => {
  const m = /^[^:]+:(\d+):(\d+)$/.exec(v.id);
  return m ? [(Number(m[2]) / (n - 1) - 0.5) * breite, (Number(m[1]) / (n - 1) - 0.5) * tiefe] : [v.position[0], v.position[2]];
};
const reviere: Revier[] = kerne.map(k => {
  const zellen: number[] = [];
  karte.forEach((zeile, i) => [...zeile].forEach((ch, j) => { if (ch === k.zeichen) zellen.push(i * RASTER + j); }));
  const hs = zellen.map(c => hoehe[c]);
  const tiere: Record<string, number> = {};
  for (const v of vorkommen) if (zeichenAn(...lageVon(v)) === k.zeichen) tiere[v.kreatur] = (tiere[v.kreatur] ?? 0) + 1;
  const nachbarn = new Set<string>();
  for (const c of zellen) {
    const i = Math.floor(c / RASTER), j = c % RASTER;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= RASTER || nj >= RASTER) continue;
      const ch = karte[ni][nj];
      if (ch !== k.zeichen) nachbarn.add(kerne.find(x => x.zeichen === ch)!.id);
    }
  }
  return {
    id: k.id, zeichen: k.zeichen, name: k.name, kern: k.kern, begruendung: k.begruendung,
    zufluchten: orte.filter(o => o.art === 'zuflucht' && zeichenAn(...meter(o.ort)) === k.zeichen).map(o => o.id).sort(),
    verborgeneOrte: (region.verborgeneOrte ?? []).filter((v: any) => zeichenAn(...meter(v.ort)) === k.zeichen).map((v: any) => v.id).sort(),
    flaecheKm2: Math.round(zellen.length * zelleB * zelleT / 1e4) / 100,
    unterFlut: Math.round(zellen.filter(nass).length / zellen.length * 100) / 100,
    hoehe: [Math.round(Math.min(...hs)), Math.round(Math.max(...hs))],
    tiere: Object.fromEntries(Object.entries(tiere).sort()),
    nachbarn: [...nachbarn].sort(),
  };
});

const daten = Revierkarte.parse({
  region: REGION,
  erzeugt: `npx tsx tools/reviere.ts ${REGION} --schreiben (D416): Kerne von Hand, Grenzen nach Weg (Naismith ${NAISMITH.toFixed(1)} m je Höhenmeter, Wasser ×${WASSER}, Ufer ${UFER} m), Tiere aus verteileKreaturen Seed 7`,
  raster: { spalten: RASTER, zeilen: RASTER, vorkommenRaster: n, karte },
  reviere,
});
// Gegenprobe: dieselbe Zuordnung über die Laufzeitlogik.
const rw = baueRevierwelt([daten], [{ id: REGION, bbox: region.bbox }]);
let abweichung = 0;
for (const v of vorkommen) {
  const p = rw.vorkommenLage(REGION, v.id) ?? [v.position[0], v.position[2]];
  if (rw.revierAn(REGION, p[0], p[1])?.zeichen !== zeichenAn(...lageVon(v))) abweichung++;
}

console.log(`Region ${REGION}: ${(breite / 1000).toFixed(2)} × ${(tiefe / 1000).toFixed(2)} km, Raster ${RASTER}² (${zelleB.toFixed(0)} × ${zelleT.toFixed(0)} m), ${vorkommen.length} Vorkommen, Abweichung Laufzeitlogik: ${abweichung}\n`);
console.log('| Revier | Fläche km² | unter Flut | Höhe m | Zufluchten | verborgen | Tiere | häufigste | Nachbarn |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of reviere) {
  const summeT = Object.values(r.tiere).reduce((a, b) => a + b, 0);
  const top = Object.entries(r.tiere).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`| ${r.zeichen} ${r.name} | ${r.flaecheKm2} | ${Math.round(r.unterFlut * 100)} % | ${r.hoehe[0]}–${r.hoehe[1]} | ${r.zufluchten.join(', ') || '—'} | ${r.verborgeneOrte.join(', ') || '—'} | ${summeT} | ${top} | ${r.nachbarn.map(id => reviere.find(x => x.id === id)?.zeichen).join('')} |`);
}
console.log('\n' + karte.join('\n'));
if (SCHREIBEN) {
  const pfad = `content/reviere/${REGION}.json`;
  // Raster je Zeile, Rest eingerückt wie die übrigen Inhaltsdateien.
  const text = JSON.stringify(daten, null, 2).replace(/"karte": \[[^\]]*\]/, `"karte": [\n${karte.map(z => `      "${z}"`).join(',\n')}\n    ]`)
    .replace(/\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]/g, '[$1, $2]');
  writeFileSync(pfad, text + '\n');
  console.log(`\ngeschrieben: ${pfad}`);
}
