/**
 * Terrainausschnitt fuer Blender (D153): npx tsx tools/terrainexport.ts cx cz groesse [schritt] [zielordner] [praefix]
 * Schreibt .cache/blender/terrain.obj (Blender-Achsen: X=x, Y=-z, Z=y; Vertexfarbe = Biom),
 * wasser.obj (Wasserspiegel, nur nasse Zellen), haeuser.obj (Grundriss x Ebenen), wege.obj (Linien)
 * und terrain.json (Meta: Mitte, Hoehe, Biomhistogramm). Alles relativ zur Mitte (cx, cz).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { entpackeWelt, type Weltdaten } from '../src/world/osm.js';
import { baueHoehenfeld } from '../src/world/lod.js';

const [cx, cz, groesse, schritt] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4] ?? 400), Number(process.argv[5] ?? 2)];
const ZIEL = process.argv[6] ?? '.cache/blender';   // Zielordner je Szene (D155)
const PRAEFIX = process.argv[7] ?? '';                // 'fern_' fuer den groben Aussenring
const welt: Weltdaten = entpackeWelt(JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt);
const feld = baueHoehenfeld(welt);
const [sued, west, nord, ost] = welt.bbox;
const nachWelt = ([lat, lon]: [number, number]): [number, number] => [
  ((lon - west) / (ost - west) - 0.5) * feld.breiteMeter,
  ((nord - lat) / (nord - sued) - 0.5) * feld.tiefeMeter,
];
mkdirSync(ZIEL, { recursive: true });
const FARBE: Record<string, [number, number, number]> = {
  gras: [0.2, 0.6, 0.2], wiese: [0.2, 0.6, 0.2], wald: [0.05, 0.3, 0.1], fels: [0.5, 0.5, 0.5],
  wasser: [0.1, 0.3, 0.8], siedlung: [0.8, 0.3, 0.2], acker: [0.6, 0.5, 0.2], unbekannt: [0.5, 0.2, 0.5],
};
const h0 = feld.hoehe(cx, cz);
const n = Math.round(groesse / schritt) + 1;
const half = groesse / 2;
const hist: Record<string, number> = {};
let terrain = '# BRACHLAND Terrain ' + cx + ',' + cz + '\n', wasser = '', hmin = Infinity, hmax = -Infinity, nass = 0;
const wIdx: number[][] = [];
let wCount = 0;
for (let i = 0; i < n; i++) {
  wIdx.push([]);
  for (let j = 0; j < n; j++) {
    const x = cx - half + j * schritt, z = cz - half + i * schritt;
    const h = feld.hoehe(x, z); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h);
    const b = feld.biom(x, z); hist[b] = (hist[b] ?? 0) + 1;
    const c = FARBE[b] ?? FARBE.unbekannt;
    terrain += `v ${(x - cx).toFixed(2)} ${(cz - z).toFixed(2)} ${(h - h0).toFixed(2)} ${c[0]} ${c[1]} ${c[2]}\n`;
    const t = feld.wasserTiefe(x, z);
    if (t > 0.02) { nass++; wasser += `v ${(x - cx).toFixed(2)} ${(cz - z).toFixed(2)} ${(h + t - h0).toFixed(2)}\n`; wIdx[i].push(++wCount); }
    else wIdx[i].push(0);
  }
}
for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
  const a = i * n + j + 1, b = a + 1, c = a + n, d = c + 1;
  terrain += `f ${a} ${c} ${d} ${b}\n`;
  const wa = wIdx[i][j], wb = wIdx[i][j + 1], wc = wIdx[i + 1][j], wd = wIdx[i + 1][j + 1];
  if (wa && wb && wc && wd) wasser += `f ${wa} ${wc} ${wd} ${wb}\n`;
}
writeFileSync(`${ZIEL}/${PRAEFIX}terrain.obj`, terrain);
writeFileSync(`${ZIEL}/${PRAEFIX}wasser.obj`, wasser);

// Haeuser als Kaesten (Grundriss x Ebenen), Wege als Linien — nur im Ausschnitt
let haus = '', hv = 0, hausN = 0;
for (const g of welt.gebaeude) {
  const pts = g.punkte.map(nachWelt).filter(p => Math.abs(p[0] - cx) < half && Math.abs(p[1] - cz) < half);
  if (pts.length < 3) continue;
  hausN++;
  const grund = Math.min(...pts.map(p => feld.hoehe(p[0], p[1]))) - h0;
  const hoehe = Math.max(1, g.ebenen) * 3;
  const k = pts.length;
  for (const p of pts) haus += `v ${(p[0] - cx).toFixed(2)} ${(cz - p[1]).toFixed(2)} ${(grund - 0.5).toFixed(2)}\n`;
  for (const p of pts) haus += `v ${(p[0] - cx).toFixed(2)} ${(cz - p[1]).toFixed(2)} ${(grund + hoehe).toFixed(2)}\n`;
  const u = hv + 1, o = hv + 1 + k;
  haus += 'f ' + Array.from({ length: k }, (_, i) => o + i).join(' ') + '\n';
  for (let i = 0; i < k; i++) { const j = (i + 1) % k; haus += `f ${u + i} ${u + j} ${o + j} ${o + i}\n`; }
  hv += 2 * k;
}
writeFileSync(`${ZIEL}/${PRAEFIX}haeuser.obj`, haus);
let wege = '', wv = 0, wegN = 0;
for (const w of welt.wege) {
  const pts = w.punkte.map(nachWelt).filter(p => Math.abs(p[0] - cx) < half && Math.abs(p[1] - cz) < half);
  if (pts.length < 2) continue;
  wegN++;
  for (const p of pts) wege += `v ${(p[0] - cx).toFixed(2)} ${(cz - p[1]).toFixed(2)} ${(feld.hoehe(p[0], p[1]) - h0 + 0.1).toFixed(2)}\n`;
  wege += 'l ' + Array.from({ length: pts.length }, (_, i) => wv + 1 + i).join(' ') + `\n# ${w.art} ${w.breite}\n`;
  wv += pts.length;
}
writeFileSync(`${ZIEL}/${PRAEFIX}wege.obj`, wege);
const meta = { cx, cz, groesse, schritt, h0, hmin: hmin - h0, hmax: hmax - h0, hist, nass, hausN, wegN, teiche: feld.teiche.length };
writeFileSync(`${ZIEL}/${PRAEFIX}terrain.json`, JSON.stringify(meta, null, 1));
console.log(JSON.stringify(meta));
