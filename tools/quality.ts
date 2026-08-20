/**
 * BRACHLAND — Qualitätstor
 *
 * Prüft nicht "ist es gültig?" (das macht validate.ts), sondern "ist es gut genug?".
 * Läuft in CI und blockt den Merge. Jede Schwelle ist begründet und änderbar —
 * aber nur bewusst, nicht im Vorbeigehen.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { effektivitaet, ELEMENTE, BAND } from '../src/data/schema.js';
import { VARIANTEN, propPfad } from '../src/world/props.js';
import { WEGBELAG } from '../src/world/baender.js';
import { entpackeWelt } from '../src/world/osm.js';

type Befund = { schwere: 'stop' | 'warnung'; bereich: string; text: string };
const befunde: Befund[] = [];
const stop = (bereich: string, text: string) => befunde.push({ schwere: 'stop', bereich, text });
const warn = (bereich: string, text: string) => befunde.push({ schwere: 'warnung', bereich, text });

// ---------------------------------------------------------------- Schwellen
const BUDGET = {
  trisStandard: 4000,
  trisBoss: 8000,
  trisMax: 8000,
  /**
   * Je Kreatur, nach Reduktion — **eine Sperrklinke, keine Ableitung.**
   *
   * Die 120 stammen aus A-6: Die sechs Grathorn-Dateien lagen bei 163–167 KB,
   * nach der Reihenfolgekorrektur bei 100–103, und 120 war knapp darüber. Das
   * beschreibt, was ein Asset einmal geschafft hat, nicht was das Paket verträgt.
   *
   * Nachgerechnet am 20.08.2026, zum ersten Mal:
   *
   *   Precache heute      2.721 KB   Code 1.304 · Weltdaten 1.324 · Props 92
   *   14 × 120 KB         1.680 KB   →  4.401 KB gesamt
   *   14 × 180 KB         2.520 KB   →  5.241 KB gesamt   (was error 0,01 liefert)
   *   14 × 212 KB         2.968 KB   →  5.689 KB gesamt   (was error 0,005 lieferte)
   *
   * Gegen `paketMB: 60` ist alles davon belanglos — die beiden Zahlen stehen im
   * Verhältnis **44:1** und wurden nie aufeinander bezogen. Die Grenze, die
   * wirklich zählt, ist keine von beiden, sondern die **Erstladezeit auf dem
   * Handy**, und die steht nirgends.
   *
   * Wer `glbKB` ändern will, entscheidet in Wahrheit über diese Gesamtgröße:
   *
   *   Ziel 4 MB  →   98 KB je Kreatur   (enger als heute)
   *   Ziel 5 MB  →  171 KB
   *   Ziel 6 MB  →  244 KB
   *
   * Und das skaliert je **Region**: Eine zweite Region bringt rund 1,3 MB
   * Weltdaten plus ihre eigenen Kreaturen mit. Die Zahl bleibt bei 120, bis
   * jemand die Erstladezeit setzt — dann folgt sie daraus, statt sie zu ersetzen.
   */
  glbKB: 120,
  paketMB: 60,           // Gesamtpaket im Service-Worker-Cache
  texturPx: 1024,
  beschreibungMin: 40,   // keine Platzhaltertexte
  ungebundeneVertexQuote: 0.05,
};

// ------------------------------------------------------- 1. Inhaltstiefe
const kreaturen = readdirSync('content/creatures')
  .filter(f => f.endsWith('.json'))
  .map(f => ({ f, k: JSON.parse(readFileSync(join('content/creatures', f), 'utf8')) }));

for (const { f, k } of kreaturen) {
  if (!k.beschreibung || k.beschreibung.length < BUDGET.beschreibungMin)
    stop('Inhalt', `${f}: Beschreibung fehlt oder ist ein Platzhalter (<${BUDGET.beschreibungMin} Zeichen)`);
  if (/TODO|TBD|xxx|placeholder/i.test(JSON.stringify(k)))
    stop('Inhalt', `${f}: enthält Platzhalter-Marker`);
  if ((k.zielTris ?? 4000) > BUDGET.trisMax)
    stop('Assets', `${f}: zielTris ${k.zielTris} über Budget ${BUDGET.trisMax}`);

  // Werteprogression: Zuwachs je Stufe muss im Korridor liegen
  for (let i = 1; i < k.stufen.length; i++) {
    const a = k.stufen[i - 1].werte, b = k.stufen[i].werte;
    const summe = (w: any) => w.kp + w.ang + w.ver + w.ini;
    const faktor = summe(b) / summe(a);
    if (faktor < 1.15) warn('Balance', `${f}: Stufe ${i + 1} nur ${((faktor - 1) * 100).toFixed(0)} % stärker — zu flach`);
    if (faktor > 1.45) stop('Balance', `${f}: Stufe ${i + 1} ${((faktor - 1) * 100).toFixed(0)} % stärker — Sprung zu groß`);
  }

  // Designregel: genau EIN Biotech-Merkmal
  if (k.merkmal.includes(' und ') || k.merkmal.includes(','))
    stop('Design', `${f}: mehr als ein Merkmal — verstößt gegen die Designregel`);
}

// -------------------------------------------- 2. Roster-Deckung je Region
const regionen = existsSync('content/regions')
  ? readdirSync('content/regions').filter(f => f.endsWith('.json'))
  : [];
for (const rf of regionen) {
  const r = JSON.parse(readFileSync(join('content/regions', rf), 'utf8'));
  const elemente = new Set<string>();
  for (const id of r.kreaturen ?? []) {
    const k = kreaturen.find(x => x.k.id === id)?.k;
    if (!k) { stop('Inhalt', `${rf}: Kreatur '${id}' existiert nicht`); continue; }
    k.elemente.forEach((e: string) => elemente.add(e));
  }
  if (elemente.size < 4)
    stop('Balance', `${rf}: nur ${elemente.size} Elemente vertreten — Region wird eintönig (min. 4)`);

  // Der Regent muss konterbar sein
  const regent = existsSync(`content/regenten/${r.regent}.json`)
    ? JSON.parse(readFileSync(`content/regenten/${r.regent}.json`, 'utf8')) : null;
  if (regent) {
    for (const [i, ph] of regent.phasen.entries()) {
      const konter = [...elemente].filter(e =>
        ph.elemente.every((pe: any) => effektivitaet(e as any, pe) === 2));
      if (konter.length === 0)
        stop('Balance', `${rf}: Regenten-Phase ${i + 1} (${ph.elemente}) hat KEINEN Konter in der Region`);
      else if (konter.length === 1)
        warn('Balance', `${rf}: Phase ${i + 1} nur über '${konter[0]}' konterbar`
          + (konter[0] === 'frost'
            ? ' — bewusst: der zweite Konter wäre Brand, und Brand gehört ins Aschefeld (Roster Kap. 1)'
            : ' — bewusst als Engpass?'));
    }
  }

  /**
   * Brand-Sperre für Kapitel 1.
   *
   * `brand` hat im Œntal 0 Kreaturen und 0 Moves. Das sah beim Zählen wie eine
   * Lücke aus und ist eine **Entscheidung**: `BRACHLAND_Roster_Kapitel1.md` sagt
   * „Brand existiert in Kapitel 1 nicht" und nennt den Preis, wenn man sie kippt —
   * „sonst verliert das Aschefeld sein Alleinstellungsmerkmal". Der Engpass bei
   * Flussvater-Phase 2 ist die gewollte Folge, nicht ein Nebeneffekt.
   *
   * Diese Prüfung steht hier, weil eine Entscheidung, die nur in einem Dokument
   * steht, beim nächsten Inhaltsschub ohne Absicht gekippt wird: Man legt eine
   * Linie an, die Matrix bleibt ausgewogen, `validate` bleibt grün, und niemand
   * sieht, dass gerade das Alleinstellungsmerkmal einer späteren Region ausgegeben
   * wurde. Wer Brand hier wirklich will, ändert erst das Roster-Dokument und dann
   * diese Zeile — in dieser Reihenfolge.
   */
  if (rf === 'oental.json' && elemente.has('brand'))
    stop('Balance', `${rf}: Brand-Kreatur in Kapitel 1 — Roster_Kapitel1.md schließt das aus `
      + `(„sonst verliert das Aschefeld sein Alleinstellungsmerkmal"). Erst das Dokument ändern, dann diese Prüfung`);
}

// ------------------------------------------------------ 3. Asset-Budgets
if (existsSync('assets/creatures')) {
  let gesamt = 0;
  for (const f of readdirSync('assets/creatures').filter(f => f.endsWith('.glb'))) {
    const kb = statSync(join('assets/creatures', f)).size / 1024;
    gesamt += kb;
    if (kb > BUDGET.glbKB) stop('Assets', `${f}: ${kb.toFixed(0)} KB über Budget ${BUDGET.glbKB} KB`);
  }
  if (gesamt / 1024 > BUDGET.paketMB)
    stop('Assets', `Gesamtpaket ${(gesamt / 1024).toFixed(1)} MB über ${BUDGET.paketMB} MB — Offline-Cache gefährdet`);
} else console.log('  · [Assets] kein Kreaturenmodell — so gewollt, solange ADR-0002 gilt (G-23)');

/**
 * Archetyp-Rigs — dass sie da sind, nicht wie groß sie sind.
 *
 * Ein Rig ist keine Auslieferungsdatei: Es geht nie ins Bundle, sondern in
 * `autorig.py`. Deshalb kein Byte-Budget, sondern die Frage, ob `npm run assets`
 * für eine Bauform überhaupt laufen kann. Fehlt das Rig, überspringt `pipeline.sh`
 * die Kreatur mit einer Zeile, die im Stapellauf leicht untergeht (Ledger B-10).
 */
/**
 * `quadruped_small` hat bewusst KEINE eigene Datei und teilt sich das Rig mit
 * `quadruped`: `autorig.py` skaliert das Skelett je Achse an die Bounding Box des
 * Zielmeshes, und beide Bauformen haben dieselbe Topologie. Die Zuordnung steht in
 * `pipeline.sh`; hier wird geprüft, dass die Datei existiert, auf die sie zeigt.
 *
 * Ohne diese Zeile meldete das Tor „3/4, es fehlt quadruped_small" — eine Lücke,
 * die es nach eigener Entscheidung nicht gibt. Ein Tor, das Phantome zählt,
 * verliert seinen Wert schneller als eines, das zu wenig prüft.
 */
const RIGDATEI: Record<string, string> = {
  quadruped: 'quadruped', quadruped_small: 'quadruped',
  biped_bird: 'biped_bird', serpent: 'serpent',
};
const bauformen = Object.keys(RIGDATEI);
const gedeckt = bauformen.filter(b => existsSync(join('assets/rigs', `${RIGDATEI[b]}.glb`)));
const offen = bauformen.filter(b => !gedeckt.includes(b));
const dateien = new Set(Object.values(RIGDATEI));
console.log(`  · [Assets] Archetyp-Rigs: ${gedeckt.length}/${bauformen.length} Bauformen gedeckt`
  + ` aus ${dateien.size} Dateien`
  + (offen.length ? ` — offen: ${offen.join(', ')} (B-10)` : ''));

/**
 * Props: Datei da, genau ein Primitiv, Vertexfarben drin.
 *
 * Alle drei Bedingungen waren einmal verletzt, und keine davon hat sich als
 * Fehlermeldung gezeigt — sie zeigten sich als Bild. Ohne `COLOR_0` liefert WebGL
 * für ein deklariertes Attribut den Vorgabewert (0,0,0), und das Modell wird
 * **schwarz** gezeichnet statt gar nicht. Mit mehreren Primitiven nimmt die Szene
 * das erste und lässt den Rest weg. Beides fällt beim Spielen auf und in keinem
 * Test (G-76).
 *
 * Geprüft wird direkt in der GLB, ohne glTF-Bibliothek: Der JSON-Block steht am
 * Anfang der Datei und nennt Meshes, Primitive und Attribute im Klartext.
 */
const propDateien = (Object.values(VARIANTEN) as { datei: string }[][]).flat();
if (propDateien.length) {
  let heil = 0;
  for (const v of propDateien) {
    const pfad = join('public', propPfad(v.datei));
    if (!existsSync(pfad)) { stop('Props', `${v.datei}.glb fehlt — npm run props:bau`); continue; }
    const roh = readFileSync(pfad);
    const jsonLaenge = roh.readUInt32LE(12);
    const kopf = JSON.parse(roh.subarray(20, 20 + jsonLaenge).toString('utf8'));
    const prims = (kopf.meshes ?? []).flatMap((m: { primitives: unknown[] }) => m.primitives);
    if (prims.length !== 1)
      stop('Props', `${v.datei}.glb hat ${prims.length} Primitive — die Szene zeichnet nur das erste`);
    else if (!prims[0].attributes?.COLOR_0)
      stop('Props', `${v.datei}.glb ohne COLOR_0 — wird mit vertexColors gezeichnet und bliebe schwarz`);
    else heil++;
  }
  console.log(`  · [Assets] Props: ${heil}/${propDateien.length} mit einem Primitiv und Vertexfarbe`);
}

/**
 * Stehen die Häuser einer Region auf Siedlung?
 *
 * Gemessen standen **1.608 von 2.033 im Biom `wiese`** (G-81): Bayerische Dörfer
 * tragen in OSM oft kein `landuse=residential`. Sichtbar war das nur indirekt —
 * an Wiesendichten im Dorf und daran, dass `landuse=farmyard`-Kreaturen 48 ha
 * statt der bewohnten Fläche fanden.
 *
 * Geprüft wird die **gebaute Datei**, nicht die Regel: Die Regel testet
 * `tests/siedlung.test.ts`. Hier geht es darum, dass niemand eine alte Weltdatei
 * mitschleppt oder eine neue Region ohne den Schritt baut.
 */
for (const datei of readdirSync('public/world').filter(f => f.endsWith('.json'))) {
  // Entpackt, nicht roh: Die Weltdatei ist gepackt, und `welt.biome` ist darin
  // kein Raster. Roh gelesen lief die Prüfung ins Leere statt in einen Befund.
  const welt = entpackeWelt(JSON.parse(readFileSync(join('public/world', datei), 'utf8')).welt);
  const gebaeude = welt.gebaeude ?? [];
  if (!gebaeude.length) continue;
  const [s2, w2, n2, e2] = welt.bbox;
  const N = welt.aufloesung;
  let drauf = 0;
  for (const g of gebaeude) {
    const p: [number, number][] = g.punkte;
    const lat = p.reduce((a, q) => a + q[0], 0) / p.length;
    const lon = p.reduce((a, q) => a + q[1], 0) / p.length;
    const i = Math.max(0, Math.min(N - 1, Math.round((n2 - lat) / (n2 - s2) * (N - 1))));
    const j = Math.max(0, Math.min(N - 1, Math.round((lon - w2) / (e2 - w2) * (N - 1))));
    const b = welt.biome[i][j];
    if (b === 'siedlung' || b === 'industrie') drauf++;
  }
  const anteil = 100 * drauf / gebaeude.length;
  if (anteil < 80)
    stop('Welt', `${datei}: nur ${anteil.toFixed(0)} % der ${gebaeude.length} Gebäude stehen auf`
      + ' Siedlung oder Industrie — Weltdatei veraltet? npm run world <region> 384 dgm1 (G-81)');
  else
    console.log(`  · [Welt] ${datei}: ${anteil.toFixed(0)} % der ${gebaeude.length} Gebäude stehen auf Siedlung oder Industrie`);
}

/**
 * Jede Wegklasse in den Weltdaten braucht einen Belag.
 *
 * Ohne Eintrag fällt `belagFuer` still auf einen neutralen Standard zurück — und
 * eine neue Region mit `motorway` oder `steps` sähe wieder aus wie vorher: alles
 * derselbe Weg. Ein stiller Rückfall ist kein Fehler, den man sieht, sondern
 * einer, den man nicht sieht.
 */
for (const datei of readdirSync('public/world').filter(f => f.endsWith('.json'))) {
  const welt = entpackeWelt(JSON.parse(readFileSync(join('public/world', datei), 'utf8')).welt);
  const arten = new Set<string>(welt.wege.map(w => w.art));
  const offen = [...arten].filter(a => !WEGBELAG[a]);
  if (offen.length)
    warn('Welt', `${datei}: Wegklassen ohne Belag — ${offen.join(', ')} (src/world/baender.ts)`);
  else
    console.log(`  · [Welt] ${datei}: alle ${arten.size} Wegklassen haben einen Belag`);
}

// -------------------------------------------------- 4. System-Invarianten
let matrixOk = true;
for (const a of ELEMENTE) {
  const s = ELEMENTE.filter(d => effektivitaet(a, d) === 2).length;
  const n = ELEMENTE.filter(d => effektivitaet(d, a) === 2).length;
  if (s !== 2 || n !== 2) { matrixOk = false; stop('System', `Element '${a}' unausgewogen (${s}/${n})`); }
}
// Fokus-Effizienz: normal und schwer müssen gleich effizient sein (Tempo statt Effizienz)
const eff = (b: keyof typeof BAND) => BAND[b].power / BAND[b].fokus;
if (Math.abs(eff('normal') - eff('schwer')) > 0.01)
  stop('System', `Fokus-Effizienz normal (${eff('normal')}) ≠ schwer (${eff('schwer')}) — Entscheidung wird zur Falle`);

// ------------------------------------------------------------- Ausgabe
const stops = befunde.filter(b => b.schwere === 'stop');
const warns = befunde.filter(b => b.schwere === 'warnung');
console.log(`\nQualitätstor — ${kreaturen.length} Kreaturen, ${regionen.length} Regionen\n`);
for (const b of stops) console.log(`  ✗ [${b.bereich}] ${b.text}`);
for (const b of warns) console.log(`  ! [${b.bereich}] ${b.text}`);
if (!befunde.length) console.log('  Alle automatischen Prüfungen bestanden.');
console.log(`\n${stops.length} Blocker, ${warns.length} Warnungen`);
console.log(matrixOk ? 'Matrix-Invariante hält.\n' : 'MATRIX VERLETZT.\n');
process.exit(stops.length ? 1 : 0);
