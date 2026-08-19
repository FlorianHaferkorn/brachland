/**
 * Wie dicht steht das Dorf wirklich?
 *
 * `DICHTE.siedlung` wurde gesetzt, als `siedlung` 48 ha gross war und fast nur aus
 * `landuse=residential`-Flaechen bestand. Seit die Siedlung aus den Gebaeuden selbst
 * gestempelt wird (D74), sind es 178 ha — und der grosse Teil davon war vorher
 * `wiese`. Die Zahlen je Hektar blieben stehen.
 *
 * Das ist keine Kleinigkeit: Wiese traegt 40 Grasbuescheln und 22 Blumen je Hektar,
 * Siedlung 12 und 6. Jede Zelle, die von `wiese` auf `siedlung` gekippt ist, hat
 * damit Bewuchs **verloren**. Ob das Dorf dadurch leerer aussieht als die Wiese
 * daneben, steht in keiner Kennzahl — dieses Werkzeug rechnet es aus.
 *
 * Gemessen wird:
 *   1. Flaeche je Biom in Hektar (aus dem Raster, mit Stauchung).
 *   2. Props je Biom, absolut und je Hektar — die **gebaute** Zahl, nach Neigungs-
 *      und Hausfilter, nicht die Tabelle.
 *   3. Der Bewuchs im Umkreis der Gebaeude, gestaffelt nach Abstand: Was steht
 *      zwischen den Haeusern, was am Ortsrand, was auf der freien Wiese?
 *   4. Die Gegenrechnung: Wieviel Bewuchs hat der Siedlungsstempel gekostet?
 *
 * `npm run dichte`
 */
import { readFileSync } from 'node:fs';
import { entpackeWelt, type Biom } from '../src/world/osm.js';
import { baueTerrain, MASSSTAB } from '../src/world/terrain.js';
import { verteileProps, DICHTE, type PropArt } from '../src/world/props.js';

const welt = entpackeWelt(JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt);
const t = baueTerrain(welt);
// Seed 1 — derselbe, den RegionsSzene.tsx benutzt. Ein anderer Seed misst eine
// andere Welt als die, die man spielt.
const props = verteileProps(welt, { ...t, hoeheAn: t.hoeheAn }, 1);

const n = welt.aufloesung;
const zellBreite = t.breiteMeter / (n - 1);
const zellTiefe = t.tiefeMeter / (n - 1);
const haJeZelle = (zellBreite * zellTiefe * MASSSTAB.stauchung ** 2) / 10_000;

// ------------------------------------------------------------ 1. Flaeche je Biom
const flaeche = new Map<Biom, number>();
for (let i = 0; i < n - 1; i++)
  for (let j = 0; j < n - 1; j++)
    flaeche.set(welt.biome[i][j], (flaeche.get(welt.biome[i][j]) ?? 0) + haJeZelle);

// ------------------------------------------------------------ 2. Props je Biom
/**
 * Biom an einer Weltposition.
 *
 * **Nicht** ueber `terrain.weltZuRaster` — das rundet auf den naechsten Gitterknoten,
 * waehrend `verteileProps` das Prop irgendwo **innerhalb** der Zelle (i,j) ablegt.
 * Der erste Lauf dieses Werkzeugs hat damit rund die Haelfte aller Props der
 * Nachbarzelle zugeschlagen: `wasser` trug angeblich 55 Props je Hektar, obwohl
 * `DICHTE.wasser` leer ist. Hier wird abgeschnitten, nicht gerundet — dieselbe
 * Zelle, die das Prop erzeugt hat.
 */
const biomBei = (x: number, z: number): Biom => {
  const j = Math.max(0, Math.min(n - 2, Math.floor((x / t.breiteMeter + 0.5) * (n - 1))));
  const i = Math.max(0, Math.min(n - 2, Math.floor((z / t.tiefeMeter + 0.5) * (n - 1))));
  return welt.biome[i][j];
};

const jeBiom = new Map<Biom, Map<PropArt, number>>();
for (const p of props) {
  const b = biomBei(p.position[0], p.position[2]);
  let m = jeBiom.get(b); if (!m) { m = new Map(); jeBiom.set(b, m); }
  m.set(p.art, (m.get(p.art) ?? 0) + 1);
}

const ARTEN: PropArt[] = ['nadelbaum', 'laubbaum', 'busch', 'findling', 'totholz',
                          'grasbuschel', 'blume', 'pilz'];

console.log(`Bewuchs je Biom — ${props.length.toLocaleString('de')} Props auf ${welt.gebaeude.length} Gebaeuden\n`);
console.log(`  ${'Biom'.padEnd(10)} ${'ha'.padStart(7)} ${'Props'.padStart(8)} ${'/ha'.padStart(6)}   `
  + ARTEN.map(a => a.slice(0, 5).padStart(6)).join(''));
console.log('  ' + '-'.repeat(115));
for (const [b, ha] of [...flaeche].sort((a, c) => c[1] - a[1])) {
  const m = jeBiom.get(b) ?? new Map<PropArt, number>();
  const summe = [...m.values()].reduce((a, c) => a + c, 0);
  console.log(`  ${b.padEnd(10)} ${ha.toFixed(1).padStart(7)} ${summe.toLocaleString('de').padStart(8)}`
    + ` ${(summe / ha).toFixed(0).padStart(6)}   `
    + ARTEN.map(a => ((m.get(a) ?? 0) / ha).toFixed(1).padStart(6)).join(''));
}

// ------------------------------------------- 3. Bewuchs nach Abstand zum Haus
//
// Das Biom ist eine Rasterzelle, das Dorf ist eine Erfahrung. Wer zwischen zwei
// Haeusern steht, sieht nicht "Siedlung", sondern das, was in 30 m Umkreis waechst.
// Darum wird hier nicht nach Biom gezaehlt, sondern nach Abstand zum naechsten
// Grundriss — dieselbe Groesse, die der Spieler wahrnimmt.
const [sued, west, nord, ost] = welt.bbox;
const huellen = welt.gebaeude.map(g => {
  const p = g.punkte.map(([lat, lon]) => [
    ((lon - west) / (ost - west) - 0.5) * t.breiteMeter,
    ((nord - lat) / (nord - sued) - 0.5) * t.tiefeMeter,
  ] as [number, number]);
  const xs = p.map(q => q[0]), zs = p.map(q => q[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs),
           minZ: Math.min(...zs), maxZ: Math.max(...zs) };
});

const RASTER = 64;
const eimer = new Map<string, number[]>();
huellen.forEach((h, i) => {
  for (let cx = Math.floor(h.minX / RASTER); cx <= Math.floor(h.maxX / RASTER); cx++)
    for (let cz = Math.floor(h.minZ / RASTER); cz <= Math.floor(h.maxZ / RASTER); cz++) {
      const k = `${cx}:${cz}`;
      const l = eimer.get(k); if (l) l.push(i); else eimer.set(k, [i]);
    }
});

/** Abstand zum naechsten Grundriss in Metern, gedeckelt bei 200. */
function abstandZumHaus(x: number, z: number): number {
  const cx = Math.floor(x / RASTER), cz = Math.floor(z / RASTER);
  let best = 200;
  for (let r = 0; r <= 3; r++) {
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        for (const i of eimer.get(`${cx + dx}:${cz + dz}`) ?? []) {
          const h = huellen[i];
          const ax = Math.max(h.minX - x, 0, x - h.maxX);
          const az = Math.max(h.minZ - z, 0, z - h.maxZ);
          best = Math.min(best, Math.hypot(ax, az));
        }
      }
    if (best <= r * RASTER) break;
  }
  return best;
}

const BAENDER = [
  { bis: 15, name: 'zwischen den Haeusern' },
  { bis: 40, name: 'Ortsrand' },
  { bis: 100, name: 'Feldrand' },
  { bis: Infinity, name: 'freie Flur' },
];
const bandVon = (d: number) => BAENDER.findIndex(b => d < b.bis);

const bandFlaeche = new Array(BAENDER.length).fill(0);
for (let i = 0; i < n - 1; i++)
  for (let j = 0; j < n - 1; j++) {
    if (welt.biome[i][j] === 'wasser') continue;
    const [x, z] = t.rasterZuWelt(i, j);
    bandFlaeche[bandVon(abstandZumHaus(x, z))] += haJeZelle;
  }

const bandProps = BAENDER.map(() => new Map<PropArt, number>());
for (const p of props) {
  const m = bandProps[bandVon(abstandZumHaus(p.position[0], p.position[2]))];
  m.set(p.art, (m.get(p.art) ?? 0) + 1);
}

console.log(`\nBewuchs nach Abstand zum naechsten Grundriss\n`);
console.log(`  ${'Lage'.padEnd(22)} ${'ha'.padStart(7)} ${'Props'.padStart(8)} ${'/ha'.padStart(6)}   `
  + ARTEN.map(a => a.slice(0, 5).padStart(6)).join(''));
console.log('  ' + '-'.repeat(127));
BAENDER.forEach((b, k) => {
  const ha = bandFlaeche[k], m = bandProps[k];
  const summe = [...m.values()].reduce((a, c) => a + c, 0);
  console.log(`  ${b.name.padEnd(22)} ${ha.toFixed(1).padStart(7)} ${summe.toLocaleString('de').padStart(8)}`
    + ` ${(summe / ha).toFixed(0).padStart(6)}   `
    + ARTEN.map(a => ((m.get(a) ?? 0) / ha).toFixed(1).padStart(6)).join(''));
});

// ----------------------------------------------- 4. Was der Stempel gekostet hat
//
// Die Siedlungsregel hat 130 ha von `wiese` auf `siedlung` gekippt. Beide Bioeme
// tragen andere Zahlen. Die Differenz ist der Bewuchs, den das Dorf gegenueber der
// Wiese verloren (oder gewonnen) hat — die Zahl, die niemand gesehen hat, als die
// Regel eingebaut wurde.
const siedlungHa = flaeche.get('siedlung') ?? 0;
console.log('\nWas der Siedlungsstempel am Bewuchs geaendert hat');
console.log(`  ${siedlungHa.toFixed(1)} ha tragen jetzt Siedlungs- statt Wiesenzahlen.\n`);
console.log(`  ${'Art'.padEnd(12)} ${'als Wiese'.padStart(10)} ${'als Siedlung'.padStart(13)} ${'Differenz'.padStart(11)}`);
console.log('  ' + '-'.repeat(50));
let summeAlt = 0, summeNeu = 0;
for (const a of ARTEN) {
  const alt = (DICHTE.wiese[a] ?? 0) * siedlungHa;
  const neu = (DICHTE.siedlung[a] ?? 0) * siedlungHa;
  if (!alt && !neu) continue;
  summeAlt += alt; summeNeu += neu;
  console.log(`  ${a.padEnd(12)} ${Math.round(alt).toLocaleString('de').padStart(10)}`
    + ` ${Math.round(neu).toLocaleString('de').padStart(13)}`
    + ` ${(neu >= alt ? '+' : '') + Math.round(neu - alt).toLocaleString('de')}`.padStart(12));
}
console.log('  ' + '-'.repeat(50));
console.log(`  ${'gesamt'.padEnd(12)} ${Math.round(summeAlt).toLocaleString('de').padStart(10)}`
  + ` ${Math.round(summeNeu).toLocaleString('de').padStart(13)}`
  + ` ${(summeNeu >= summeAlt ? '+' : '') + Math.round(summeNeu - summeAlt).toLocaleString('de')}`.padStart(12));

// --------------------------------------------------------- 5. Der dichteste Ort
//
// Ein Mittelwert ueber 178 ha sagt nichts ueber den Ortskern. Gesucht wird das
// 100-m-Fenster mit den meisten Gebaeuden — dort steht der Spieler, wenn er "Dorf"
// denkt, und dort faellt leerer Boden auf.
const FENSTER = 100;
const kern = new Map<string, number>();
huellen.forEach(h => {
  const k = `${Math.round((h.minX + h.maxX) / 2 / FENSTER)}:${Math.round((h.minZ + h.maxZ) / 2 / FENSTER)}`;
  kern.set(k, (kern.get(k) ?? 0) + 1);
});
const [besterSchluessel, haeuser] = [...kern].sort((a, b) => b[1] - a[1])[0];
const [bx, bz] = besterSchluessel.split(':').map(Number);
const mx = bx * FENSTER, mz = bz * FENSTER;
const imKern = props.filter(p =>
  Math.abs(p.position[0] - mx) <= FENSTER / 2 && Math.abs(p.position[2] - mz) <= FENSTER / 2);
const kernHa = (FENSTER * MASSSTAB.stauchung) ** 2 / 10_000;
const kernArten = new Map<PropArt, number>();
for (const p of imKern) kernArten.set(p.art, (kernArten.get(p.art) ?? 0) + 1);
console.log(`\nDichtester Ortskern: ${FENSTER} x ${FENSTER} m um (${mx}, ${mz}) · ${haeuser} Gebaeude · ${kernHa.toFixed(2)} ha`);
console.log(`  ${imKern.length} Props · ${(imKern.length / kernHa).toFixed(0)} je Hektar`);
for (const a of ARTEN) {
  const c = kernArten.get(a) ?? 0;
  if (c) console.log(`    ${a.padEnd(12)} ${String(c).padStart(4)} · ${(c / kernHa).toFixed(1).padStart(6)} /ha`);
}

// -------------------------------------------------- 6. Steht Bewuchs auf dem Weg?
//
// `verteileProps` kennt seit G-82 die Gebaeude, aber **nicht die Wege**. Solange die
// Siedlung 28 Props je Hektar trug, fiel das kaum auf. Wer die Dorfdichte anhebt,
// vervielfacht zuerst das Gras auf dem Asphalt — darum wird das hier gemessen,
// bevor eine Zahl in der Tabelle steigt.
const wegPunkte = welt.wege.map(w => ({
  breite: w.breite,
  p: w.punkte.map(([lat, lon]) => [
    ((lon - west) / (ost - west) - 0.5) * t.breiteMeter,
    ((nord - lat) / (nord - sued) - 0.5) * t.tiefeMeter,
  ] as [number, number]),
}));

const WRASTER = 32;
const wegEimer = new Map<string, [number, number][]>();
let wegLaenge = 0;
wegPunkte.forEach(w => {
  for (let k = 0; k < w.p.length - 1; k++) {
    const [ax, az] = w.p[k], [bx, bz] = w.p[k + 1];
    wegLaenge += Math.hypot(bx - ax, bz - az);
    const cx0 = Math.floor(Math.min(ax, bx) / WRASTER), cx1 = Math.floor(Math.max(ax, bx) / WRASTER);
    const cz0 = Math.floor(Math.min(az, bz) / WRASTER), cz1 = Math.floor(Math.max(az, bz) / WRASTER);
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cz = cz0; cz <= cz1; cz++) {
        const key = `${cx}:${cz}`;
        const l = wegEimer.get(key);
        if (l) l.push([wegPunkte.indexOf(w), k]); else wegEimer.set(key, [[wegPunkte.indexOf(w), k]]);
      }
  }
});

/** Steht der Punkt auf einem Wegband? */
function aufWeg(x: number, z: number): boolean {
  const cx = Math.floor(x / WRASTER), cz = Math.floor(z / WRASTER);
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++)
      for (const [wi, k] of wegEimer.get(`${cx + dx}:${cz + dz}`) ?? []) {
        const w = wegPunkte[wi];
        const [ax, az] = w.p[k], [bx, bz] = w.p[k + 1];
        const dxs = bx - ax, dzs = bz - az;
        const l2 = dxs * dxs + dzs * dzs;
        const s = l2 ? Math.max(0, Math.min(1, ((x - ax) * dxs + (z - az) * dzs) / l2)) : 0;
        if (Math.hypot(x - ax - s * dxs, z - az - s * dzs) < w.breite / 2) return true;
      }
  return false;
}

const aufStrasse = props.filter(p => aufWeg(p.position[0], p.position[2]));
const strasseArten = new Map<PropArt, number>();
for (const p of aufStrasse) strasseArten.set(p.art, (strasseArten.get(p.art) ?? 0) + 1);
const wegFlaeche = wegPunkte.reduce((a, w) => {
  let l = 0;
  for (let k = 0; k < w.p.length - 1; k++)
    l += Math.hypot(w.p[k + 1][0] - w.p[k][0], w.p[k + 1][1] - w.p[k][1]);
  return a + l * w.breite;
}, 0) * MASSSTAB.stauchung ** 2 / 10_000;

console.log(`\nBewuchs auf den Wegen — ${(wegLaenge * MASSSTAB.stauchung / 1000).toFixed(1)} km, ${wegFlaeche.toFixed(1)} ha Belagflaeche`);
console.log(`  ${aufStrasse.length.toLocaleString('de')} von ${props.length.toLocaleString('de')} Props`
  + ` (${(100 * aufStrasse.length / props.length).toFixed(1)} %) stehen auf einem Wegband`);
for (const a of ARTEN) {
  const c = strasseArten.get(a) ?? 0;
  if (c) console.log(`    ${a.padEnd(12)} ${String(c).padStart(5)}`);
}
