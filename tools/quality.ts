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
import { baueGebaeude } from '../src/world/terrain.js';
import { herkunftJson } from './herkunft.js';
import { aufsatzboden, baueHoehenfeld } from '../src/world/lod.js';

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
   * **Die Größe, aus der alles andere folgt: was beim ersten Besuch über die
   * Leitung geht**, komprimiert, in KB.
   *
   * Nicht die Precache-Größe. Die steht bei 2.748 KB, aber Weltdaten sind JSON
   * und komprimieren 2,9-fach; über die Leitung gehen davon 886 KB. Wer die
   * unkomprimierte Zahl budgetiert, budgetiert etwas, das nie jemand überträgt.
   *
   * Gemessen am 20.08.2026, serverseitig gezählt, gzip Stufe 6:
   *
   *   Code + Bündel        373 KB   das Einzige, was das erste Bild aufhält
   *   Weltdaten            456 KB
   *   Weltdaten nochmal    456 KB   → siehe `wirdZweimalGeladen` unten
   *   Prop-Modelle          48 KB
   *   Rest                   8 KB
   *   ausgeliefert       1.382 KB   in 82 Anfragen für 41 Dateien
   *
   * Und die Zeiten, gedrosselt im Browser gemessen — **das erste Bild** braucht
   * nur das Bündel und ist von Kreaturmodellen völlig unberührt:
   *
   *   langsames 3G   8,6 s      schnelles 3G   3,2 s      4G   0,6 s
   *
   * Der Offline-Cache steht später; das ist die Zahl, die hier budgetiert wird.
   * Bei **2 MB** über die Leitung sind das rund 41 s auf langsamem 3G — und der
   * erste Besuch findet fast immer im WLAN statt, danach nie wieder einer.
   *
   * ⚠️ UNKLAR: `Network.emulateNetworkConditions` drosselt die Anfragen des
   * Service Workers nicht mit. Die Zeiten fürs erste Bild sind gemessen, die
   * für den vollständigen Cache aus Bytes durch Durchsatz gerechnet.
   */
  erstladungKB: 2048,

  /**
   * Je Kreatur, roh — **abgeleitet, nicht gesetzt.**
   *
   * Vorher stand hier 120. Das war eine Sperrklinke aus A-6: Die sechs
   * Grathorn-Dateien landeten nach der Reihenfolgekorrektur bei 100–103 KB, und
   * 120 war knapp darüber. Es beschrieb, was ein Asset einmal geschafft hat.
   *
   * Jetzt folgt die Zahl aus `erstladungKB`:
   *
   *   (2048 − 886 fest) / 14 Kreaturen        =  83 KB komprimiert
   *   × 2,3 Kompression (an zwei GLB gemessen) = 191 KB roh
   *
   * Gerundet auf **190**. Die Kette liefert mit `error: 0,01` genau 180 KB
   * (G-89) — das passt, ohne dass an der Zahl gedreht werden musste.
   *
   * Die Umkehrung, falls jemand die Erstladung anders setzen will:
   *
   *   1,5 MB → 107 KB je Kreatur   (31 s auf langsamem 3G)
   *   2,0 MB → 191 KB              (41 s)  ← gesetzt
   *   2,5 MB → 275 KB              (51 s)
   *   3,0 MB → 359 KB              (61 s)
   *
   * Und es skaliert je **Region**: Eine zweite bringt rund 456 KB komprimierte
   * Weltdaten plus ihre eigenen Kreaturen mit. Spätestens dann muss nicht mehr
   * alles in den Precache, sondern die Startregion hinein und der Rest zur
   * Laufzeit — die Zahl hier ändert daran nichts.
   */
  glbKB: 190,

  /**
   * `oental.json` geht beim ersten Besuch **zweimal** über die Leitung: einmal
   * holt es die Anwendung, einmal der Precache. Workbox umgeht dafür bewusst den
   * HTTP-Cache (`cache: 'reload'`), damit keine veraltete Fassung einzementiert
   * wird — gemessen 82 Anfragen für 41 Dateien, auch mit `max-age=3600`.
   *
   * Kostet 456 KB von 1.382, also **ein Drittel der Erstladung**. Zu beheben
   * wäre es, indem `world/*.json` aus dem Precache fällt und stattdessen eine
   * Laufzeitregel (CacheFirst) bekommt: Dann füllt der Griff der Anwendung den
   * Cache, und offline ist es ab dem ersten Start trotzdem da. Der Preis ist die
   * Garantie — precached ist es nach der Installation sicher da, laufzeitgecacht
   * erst, nachdem die Anwendung es einmal angefragt hat.
   */
  wirdZweimalGeladen: 456,

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
// **`public/creatures`, nicht `assets`.** Die Modelle gehen ins Bundle, also
// zaehlt der Ordner, der ausgeliefert wird. Bis zum 31.08.2026 stand hier
// `assets/creatures` — der Ordner war leer, und das Tor meldete deshalb „kein
// Kreaturenmodell", waehrend fuenf davon im Spiel standen.
if (existsSync('public/creatures')) {
  let gesamt = 0;
  for (const f of readdirSync('public/creatures').filter(f => f.endsWith('.glb'))) {
    const kb = statSync(join('public/creatures', f)).size / 1024;
    gesamt += kb;
    if (kb > BUDGET.glbKB) stop('Assets', `${f}: ${kb.toFixed(0)} KB über Budget ${BUDGET.glbKB} KB`);
  }
  if (gesamt / 1024 > BUDGET.paketMB)
    stop('Assets', `Gesamtpaket ${(gesamt / 1024).toFixed(1)} MB über ${BUDGET.paketMB} MB — Offline-Cache gefährdet`);
} else warn('Assets', 'kein Kreaturenmodell — offener Posten, nicht mehr Absicht: ADR-0002 ist seit dem '
  + '16.08.2026 erfüllt und die Stilreferenz steht. Es fehlen Rohmodelle (G-119, G-120)');

/**
 * Jedes Kreaturmodell braucht eine Herkunftszeile.
 *
 * Seit D107 stehen unter `public/creatures` auch **CC-BY**-Modelle, und CC-BY
 * verlangt die Namensnennung. Ohne Eintrag in `assets/HERKUNFT.md` wäre die
 * Lizenzbedingung nicht erfüllt — das ist kein Schönheitsfehler, sondern ein
 * Rechtsmangel, und deshalb ein **Blocker**.
 *
 * Geprüft wird in beide Richtungen: Eine Datei ohne Zeile bliebe unbelegt, eine
 * Zeile ohne Datei würde Herkunft für etwas behaupten, das es nicht gibt.
 */
if (existsSync('public/creatures')) {
  const dateien = readdirSync('public/creatures').filter(f => f.endsWith('.glb'));
  // `public/herkunft.json` muss die Tabelle sein (D127): Das Menü zeigt die
  // Namensnennung aus dieser Datei, und eine veraltete Kopie waere eine falsche
  // Nennung — schlimmer als keine.
  if (existsSync('assets/HERKUNFT.md')) {
    const soll = herkunftJson();
    const ist = existsSync('public/herkunft.json') ? readFileSync('public/herkunft.json', 'utf8') : '';
    if (soll !== ist) stop('Assets', 'public/herkunft.json ist nicht die Tabelle aus assets/HERKUNFT.md — npm run herkunft');
  }
  const herkunft = existsSync('assets/HERKUNFT.md')
    ? readFileSync('assets/HERKUNFT.md', 'utf8') : '';
  if (!herkunft) {
    stop('Assets', `${dateien.length} Kreaturmodelle, aber keine assets/HERKUNFT.md`);
  } else {
    const ohne = dateien.filter(f => !herkunft.includes(f));
    if (ohne.length)
      stop('Assets', `ohne Herkunftsangabe: ${ohne.join(', ')} — CC-BY verlangt die Nennung`);
    // Rückrichtung: Zeilen, die auf nichts zeigen.
    const genannt = [...herkunft.matchAll(/`([a-z0-9-]+\.glb)`/g)].map(m => m[1]);
    const tot = genannt.filter(n => !dateien.includes(n));
    if (tot.length)
      warn('Assets', `HERKUNFT.md nennt Dateien, die es nicht gibt: ${tot.join(', ')}`);
    if (!ohne.length)
      console.log(`  · [Assets] ${dateien.length} Kreaturmodelle, alle mit Herkunft belegt`);
  }
}

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
 * Dreiecke je Objektklasse — Korridor, nicht nur Deckel.
 *
 * Bis zum 02.09.2026 gab es Budgets nur nach oben, und nur für Kreaturen. Die
 * Klassen, die das Bild tragen, hatten keine Zahl: Ein Haus lag im Median bei
 * **236** Dreiecken, ein Findling bei **37**, ein Busch bei 39 — während eine
 * Kreatur 2.000 bekam. Dabei hat G-111 gemessen, dass Dreiecke auf dem
 * Zielgerät fast nichts kosten (11 µs je Draw Call, die Geometrie daneben
 * kaum messbar). Das Budget begrenzte die falsche Größe, und zwar von oben, wo
 * das Problem unten lag.
 *
 * Deshalb je Klasse ein **Korridor** (D111): Unterschreitet der Median die
 * Untergrenze, ist das eine Warnung — das Bild hat weniger, als es sich
 * leisten kann. Überschreitet das Maximum den Deckel, ist es ein Blocker.
 * Die Untergrenzen sind aus der Stilreferenz abgeleitet, die Deckel aus der
 * Bildzeit (`npm run zaehlen`, 19 ms p95 am Gerät).
 *
 * Häuser werden **gesampelt** (jedes zehnte), sonst kostet das Tor 30 s mehr.
 */
const KORRIDOR: Record<string, { min: number; max: number }> = {
  'Haus':            { min: 600, max: 1500 },
  'Prop':            { min: 150, max: 800 },
  // Untergrenze 1.200 → 500 (D129): Die neun Poly-by-Google-Modelle haben 568–1.200
  // Dreiecke und sind so gebaut — facettiert, unverschweisst. Unterteilen hat sie
  // zu Schuppentieren gemacht, nicht zu besseren; die Facetten sind der Stil.
  'Kreatur (Modell)': { min: 500, max: 3000 },
};
{
  const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
  const glbTris = (pfad: string): number => {
    const buf = readFileSync(pfad);
    const g = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
    let t = 0;
    for (const m of g.meshes ?? []) for (const p of m.primitives ?? [])
      t += g.accessors[p.indices ?? p.attributes.POSITION].count / 3;
    return Math.round(t);
  };
  const klassen: Record<string, number[]> = {};
  if (existsSync('public/props'))
    klassen['Prop'] = readdirSync('public/props').filter(f => f.endsWith('.glb'))
      .map(f => glbTris(join('public/props', f)));
  if (existsSync('public/creatures')) {
    const dateien = readdirSync('public/creatures').filter(f => f.endsWith('.glb'));
    klassen['Kreatur (Modell)'] = dateien.map(f => glbTris(join('public/creatures', f)));
    /**
     * Genau POSITION und COLOR_0, sonst nichts (G-131). Der Anbau (D128) wird mit
     * dem Koerper zu einer Geometrie gefasst, und `mergeGeometries` verlangt
     * gleiche Attribute: Ein TEXCOORD_0 am Koerper — neun Poly-Modelle brachten
     * es mit — liess die Szene still auf den Koerper ohne Anbau zurueckfallen.
     */
    for (const f of dateien) {
      const buf = readFileSync(join('public/creatures', f));
      const g = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
      for (const m of g.meshes ?? []) for (const p of m.primitives ?? []) {
        const attr = Object.keys(p.attributes ?? {}).sort().join('+');
        if (attr !== 'COLOR_0+POSITION')
          stop('Kreaturen', `${f} traegt ${attr} — erlaubt ist COLOR_0+POSITION, sonst verliert die Szene den Anbau (G-131)`);
      }
    }
  }
  const region = readdirSync('public/world').map(f => join('public/world', f))
    .find(f => f.endsWith('.json') && JSON.parse(readFileSync(f, 'utf8')).welt);
  if (region) {
    const welt = entpackeWelt(JSON.parse(readFileSync(region, 'utf8')).welt);
    const boden = aufsatzboden(baueHoehenfeld(welt));
    const stichprobe = welt.gebaeude.filter((_, i) => i % 10 === 0);
    const geometrien = stichprobe.map(g => baueGebaeude(welt, boden, [g]));
    klassen['Haus'] = geometrien
      .filter((g): g is NonNullable<typeof g> => !!g)
      .map(g => g.getAttribute('position').count / 3);

    /**
     * Umlaufsinn (G-128): Zeigen die Wände nach aussen?
     *
     * Bis zum 07.09.2026 zeigten 70 % der Wanddreiecke mit der Normale ins
     * Haus und alle Dachflächen nach unten — bei einseitigem Material also
     * weggeschnitten, und niemand hat es gemerkt, weil `flatShading` eine
     * Innenseite wie eine Aussenseite beleuchtet. Geprüft wird hier, was sich
     * ohne Bild prüfen lässt: Für jedes senkrechte Dreieck nahe der Wandlinie
     * muss der Punkt 0,25 m in Normalenrichtung **ausserhalb** des Grundrisses
     * liegen. Ein paar Prozent sind erlaubt — an einer einspringenden Ecke
     * trifft der Prüfpunkt die Nachbarwand.
     */
    {
      const [sued, west, nord, ost] = welt.bbox;
      let aussen = 0, innen = 0;
      stichprobe.forEach((g, i) => {
        const geo = geometrien[i]; if (!geo) return;
        const p = g.punkte.map(([lat, lon]) => [
          ((lon - west) / (ost - west) - 0.5) * boden.breiteMeter,
          ((nord - lat) / (nord - sued) - 0.5) * boden.tiefeMeter,
        ] as [number, number]);
        const drin = (x: number, z: number) => {
          let d = false;
          for (let a = 0, b = p.length - 2; a < p.length - 1; b = a++) {
            const [xa, za] = p[a], [xb, zb] = p[b];
            if ((za > z) !== (zb > z) && x < ((xb - xa) * (z - za)) / (zb - za) + xa) d = !d;
          }
          return d;
        };
        const nahe = (x: number, z: number) => {
          for (let k = 0; k < p.length - 1; k++) {
            const [x1, z1] = p[k], [x2, z2] = p[k + 1];
            const l2 = (x2 - x1) ** 2 + (z2 - z1) ** 2; if (l2 < 1e-6) continue;
            const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (z - z1) * (z2 - z1)) / l2));
            if (Math.hypot(x - x1 - (x2 - x1) * t, z - z1 - (z2 - z1) * t) < 0.5) return true;
          }
          return false;
        };
        const P = geo.getAttribute('position').array as Float32Array;
        for (let t = 0; t < P.length; t += 9) {
          const ax = P[t], ay = P[t + 1], az = P[t + 2], bx = P[t + 3], by = P[t + 4], bz = P[t + 5];
          const cx = P[t + 6], cy = P[t + 7], cz = P[t + 8];
          const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
          const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
          const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
          const l = Math.hypot(nx, ny, nz); if (l < 1e-6 || Math.abs(ny / l) > 0.05) continue;
          const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3;
          if (!nahe(mx, mz)) continue;
          if (drin(mx + nx / l * 0.25, mz + nz / l * 0.25)) innen++; else aussen++;
        }
      });
      const anteil = innen / Math.max(1, innen + aussen) * 100;
      const lage = `Umlauf: ${anteil.toFixed(2)} % der Wanddreiecke zeigen nach innen (${innen} von ${innen + aussen}, ${stichprobe.length} Häuser)`;
      if (anteil > 5) stop('Klassen', `${lage} — Häuser rendern innen nach aussen (G-128)`);
      else if (anteil > 1) warn('Klassen', lage);
      else console.log(`  · [Klassen] ${lage}`);
    }
  }
  for (const [name, werte] of Object.entries(klassen)) {
    if (!werte.length) continue;
    const k = KORRIDOR[name]; const med = median(werte); const max = Math.max(...werte);
    const lage = `${name}: Median ${med}, max ${max} Dreiecke (Korridor ${k.min}–${k.max}, n=${werte.length})`;
    if (max > k.max) stop('Klassen', `${lage} — über dem Deckel`);
    else if (med < k.min) warn('Klassen', `${lage} — unter der Untergrenze, das Bild hat weniger, als es sich leisten kann`);
    else console.log(`  · [Klassen] ${lage}`);
  }
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
  // Seit D85 liegen in `public/world` zwei Arten Datei: Regionen (`{ welt: … }`)
  // und Fernlandraster (`{ bbox, aufloesung, hoehen }`). Wer alles als Region
  // liest, stirbt am ersten Fernland — dieses Tor ist genau daran gescheitert.
  const roh = JSON.parse(readFileSync(join('public/world', datei), 'utf8'));
  if (!roh.welt) continue;
  // Entpackt, nicht roh: Die Weltdatei ist gepackt, und `welt.biome` ist darin
  // kein Raster. Roh gelesen lief die Prüfung ins Leere statt in einen Befund.
  const welt = entpackeWelt(roh.welt);
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
  // Fernlandraster überspringen, siehe oben — sie tragen kein `welt`.
  const roh = JSON.parse(readFileSync(join('public/world', datei), 'utf8'));
  if (!roh.welt) continue;
  const welt = entpackeWelt(roh.welt);
  const arten = new Set<string>(welt.wege.map(w => w.art));
  const offen = [...arten].filter(a => !WEGBELAG[a]);
  if (offen.length)
    warn('Welt', `${datei}: Wegklassen ohne Belag — ${offen.join(', ')} (src/world/baender.ts)`);
  else
    console.log(`  · [Welt] ${datei}: alle ${arten.size} Wegklassen haben einen Belag`);
}

// ------------------------------------- 3b. Inhalte innerhalb der Region?
//
// Ein Fundstück, das ausserhalb der bbox liegt, ist nicht schwer zu finden — es
// ist **unerreichbar**: Die Bewegung klemmt den Spieler auf ±1976 m (X) und
// ±1996 m (Z) (`RegionsSzene.tsx`), weil dahinter kein Gelände mehr steht.
// Gefunden an `bruchkante` (lon 12,10967 gegen Ostkante 12,108 → x = 2.109 m):
// Der Zähler „x von 13 Fundstücken" kann damit nie 13 erreichen, und nichts im
// Repo hat es gemeldet. Das Schema prüft die Form der Koordinate, nicht ihre Lage.
//
// Warnung und nicht Blocker, weil die Behebung eine **inhaltliche** Entscheidung
// ist (wohin verschiebt man den Stein?) und ein Blocker die Kette anhielte,
// bevor jemand sie treffen kann. Wird Blocker, sobald die offenen Fälle behoben sind.
type Verortet = { id: string; region?: string; ort?: [number, number] };
const ausOrdner = (p: string): Verortet[] => existsSync(p)
  ? readdirSync(p).filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(readFileSync(join(p, f), 'utf8')) as Verortet)
  : [];
const verortet: [string, Verortet[]][] = [
  ['Fundstück', ausOrdner('content/fragmente')],
  ['Ort', ausOrdner('content/orte')],
];

for (const rf of regionen) {
  const region = JSON.parse(readFileSync(join('content/regions', rf), 'utf8'));
  const [sued, west, nord, ost] = region.bbox as [number, number, number, number];
  const drin = (o: [number, number]) =>
    o[0] >= sued && o[0] <= nord && o[1] >= west && o[1] <= ost;
  let geprueft = 0;
  for (const [art, liste] of verortet) {
    for (const e of liste) {
      if (e.region !== region.id || !e.ort) continue;
      geprueft++;
      if (drin(e.ort)) continue;
      // Randabstand mitliefern — „knapp daneben" und „400 m daneben" sind
      // verschiedene Fehler.
      const dLat = Math.max(sued - e.ort[0], e.ort[0] - nord, 0) * 111_320;
      const dLon = Math.max(west - e.ort[1], e.ort[1] - ost, 0) * 111_320
                   * Math.cos(e.ort[0] * Math.PI / 180);
      warn('Welt', `${art} '${e.id}' liegt ausserhalb von ${region.id} `
        + `(${Math.round(Math.max(dLat, dLon))} m jenseits der Kante) — unerreichbar, `
        + `die Bewegung klemmt am Geländerand`);
    }
  }
  console.log(`  · [Welt] ${region.id}: ${geprueft} verortete Inhalte gegen die bbox geprüft`);
}


// ------------------------------------- 3c. Führt irgendetwas zum Regenten?
//
// Der Flussvater stand seit dem ersten Tag im Œntal und ist **nie gefunden
// worden** (G-101). Nicht, weil er versteckt war, sondern weil nichts hinführte:
// 1.381 m vom Start, Nebelende bei 420 m, die Peilung zeigt nur auf Kreaturen,
// 0 von 4 Aufträgen nannten ihn, 0 Texte erwähnten ihn — und die Zielart
// `regent` war im Schema implementiert und von **keiner** Auftragsdatei benutzt.
//
// Ein Regent ohne Weg dorthin ist kein Geheimnis, sondern ein Inhalt, den es für
// den Spieler nicht gibt. Deshalb **Blocker**, nicht Warnung: Die Behebung ist
// eine Auftragsdatei, keine Grundsatzentscheidung, und die Kette anzuhalten ist
// billiger als eine weitere Region mit demselben Loch auszuliefern.
type Ziel = { art: string; regent?: string; fragment?: string };
type AuftragDatei = { id: string; region?: string; ziel?: Ziel; vorher?: string };
const auftraege = (existsSync('content/auftraege')
  ? readdirSync('content/auftraege').filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(readFileSync(join('content/auftraege', f), 'utf8')) as AuftragDatei)
  : []);
const nachId = new Map(auftraege.map(a => [a.id, a]));

/** Hängt der Auftrag an einer Kette, die irgendwo ohne `vorher` anfängt? */
function erreichbar(a: AuftragDatei): boolean {
  const gesehen = new Set<string>();
  let lauf: AuftragDatei | undefined = a;
  while (lauf) {
    if (gesehen.has(lauf.id)) return false;   // Ringschluss
    gesehen.add(lauf.id);
    if (!lauf.vorher) return true;
    lauf = nachId.get(lauf.vorher);
  }
  return false;                                // `vorher` zeigt ins Leere
}

for (const rf of regionen) {
  const region = JSON.parse(readFileSync(join('content/regions', rf), 'utf8'));
  const eigene = ausOrdner('content/regenten').filter(r => r.region === region.id);
  for (const r of eigene) {
    const wege = auftraege.filter(a => a.ziel?.art === 'regent' && a.ziel.regent === r.id);
    if (!wege.length) {
      stop('Inhalt', `Regent '${r.id}' in ${region.id}: kein Auftrag mit `
        + `Zielart 'regent' zeigt auf ihn — er ist im Spiel nicht auffindbar (G-101)`);
      continue;
    }
    const offen = wege.filter(erreichbar);
    if (!offen.length) {
      stop('Inhalt', `Regent '${r.id}' in ${region.id}: ${wege.length} Auftrag/Aufträge `
        + `zeigen auf ihn, aber keiner ist über eine Kette erreichbar `
        + `(fehlendes oder ringförmiges 'vorher')`);
      continue;
    }
    console.log(`  · [Inhalt] Regent '${r.id}': ${offen.length} erreichbarer Weg `
      + `(${offen.map(a => a.id).join(', ')})`);
  }
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
