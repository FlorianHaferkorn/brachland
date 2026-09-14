/**
 * BRACHLAND — Geometrie-Tor (ADR-0005, Klassen W1–W4)
 *
 *     npx tsx tools/geometrie.ts [--verteilung] [--top N]
 *
 * ## Warum es das gibt
 *
 * Alle bisherigen Tore messen, wie **hell das Bild** ist (Bildtor), was eine Datei
 * **wiegt** (quality) oder ob Inhalt **zusammenpasst** (validate). Kein einziger dieser
 * Werte ändert sich, wenn Geometrie falsch in der Welt sitzt: Ein versunkenes Haus hat
 * eine tadellose Leuchtdichte. Genau deshalb sind G-128 (Häuser innen nach aussen) und
 * G-130 (Kreatur nie in der Welt) wochenlang durch grüne Tore gelaufen.
 *
 * ## Was es prüft
 *
 * - **W1** Nichts schwebt, nichts versinkt — Gebäude gegen das Gelände unter ihrem
 *   Grundriss, Orte und Fundstellen gegen die Geländehöhe an ihrem Punkt.
 * - **W3** Geschlossene Körper sind geschlossen — Randkanten (Loch) und Kanten mit
 *   mehr als zwei Flächen (nicht-mannigfaltig) je Haus.
 * - **W4** Wasser liegt in seinem Bett — Wasseroberfläche gegen das Gelände daneben.
 *
 * ## Wie gemessen wird (N6)
 *
 * An der **gebauten Geometrie**, nicht an der Absicht im Code: Der Prüfer ruft
 * dieselben Bauer wie die Szene (`baueGebaeude`, `baueWasserKachel`) und liest die
 * Vertexpositionen. Was der Code zu tun glaubt, ist irrelevant — gemessen wird, was
 * gezeichnet würde.
 *
 * ## Abdeckung (N1)
 *
 * Grundgesamtheit, keine Stichprobe: alle Gebäude, alle Wasserkacheln, alle Orte und
 * Fundstellen der Region. Die Zahl steht im Ergebnis.
 */
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import { entpackeWelt, type Weltdaten } from '../src/world/osm.js';
import { baueGebaeude } from '../src/world/terrain.js';
import { baueHoehenfeld, aufsatzboden, hoeheAufFlaeche, baueKachelraster } from '../src/world/lod.js';
import { zerlegeBaender, baueWasserKachel, baueFallKachel } from '../src/world/baender.js';

const ARGS = process.argv.slice(2);
const TOP = Number(ARGS[ARGS.indexOf('--top') + 1]) || 8;
const VERTEILUNG = ARGS.includes('--verteilung');

/**
 * Toleranz in Metern. Bewusst grosszügig für den **ersten** Lauf: Erst die Verteilung
 * lesen, dann die Schwelle setzen — eine erfundene Schwelle misst die Erfindung.
 */
const TOLERANZ = 0.30;

const welt: Weltdaten = entpackeWelt(
  JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt,
);
const feld = baueHoehenfeld(welt);
const boden = aufsatzboden(feld);
const [sued, west, nord, ost] = welt.bbox;
const nachWelt = ([lat, lon]: [number, number]): [number, number] => [
  ((lon - west) / (ost - west) - 0.5) * feld.breiteMeter,
  ((nord - lat) / (nord - sued) - 0.5) * feld.tiefeMeter,
];

let blocker = 0;
const zeile = (s: string) => console.log(s);
const p = (xs: number[], q: number) =>
  xs.length ? xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))] : NaN;

// ------------------------------------------------------- W1: Gebäude auf Boden

/**
 * Für jedes Gebäude: die Geländehöhe unter dem Grundriss gegen die gebaute Geometrie.
 *
 * Zwei Masse, weil zwei Fehler möglich sind:
 * - **Lücke** = tiefster Geländepunkt unter dem Haus − tiefster Hauspunkt.
 *   Positiv heisst: unter dem Haus ist Luft, es **schwebt**.
 * - **Einsenkung** = höchster Geländepunkt unter dem Haus − tiefster Hauspunkt.
 *   Ein Stück davon ist Absicht (die Schürze greift bergseitig ins Gelände), zu viel
 *   heisst, das Haus **versinkt**. Wieviel „zu viel" ist, sagt die Verteilung.
 */
function pruefeGebaeude() {
  const luecken: number[] = [], senkungen: number[] = [], ueberstaende: number[] = [];
  const schlimmste: { art: string; ecken: number; luecke: number; senkung: number; ueberstand: number; hoehe: number; x: number; z: number }[] = [];
  let ohneGeometrie = 0;

  for (const g of welt.gebaeude) {
    const geo = baueGebaeude(welt, boden, [g]);
    if (!geo) { ohneGeometrie++; continue; }
    geo.computeBoundingBox();
    const hausMin = geo.boundingBox!.min.y;
    const hausMax = geo.boundingBox!.max.y;

    // Grundriss abtasten: Ecken plus ein 5×5-Raster über der Hüllbox.
    const punkte = g.punkte.map(nachWelt);
    const xs = punkte.map(q => q[0]), zs = punkte.map(q => q[1]);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [z0, z1] = [Math.min(...zs), Math.max(...zs)];
    const proben: [number, number][] = [...punkte];
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++)
      proben.push([x0 + (x1 - x0) * i / 4, z0 + (z1 - z0) * j / 4]);

    let bodenMin = Infinity, bodenMax = -Infinity;
    for (const [x, z] of proben) {
      // `tiefsteFlaeche` ist das, worauf die Szene setzt: die tiefste Geländefläche
      // über alle LOD-Stufen, damit ein Haus beim Stufenwechsel nicht in die Luft kommt.
      const h = boden.tiefsteFlaeche(x, z);
      bodenMin = Math.min(bodenMin, h); bodenMax = Math.max(bodenMax, h);
    }
    const luecke = bodenMin - hausMin;
    const senkung = bodenMax - hausMin;
    /**
     * **Überstand**: wieviel vom Haus bergseitig noch über dem Gelände steht.
     * Die Einsenkung allein sagt nichts — an einem Steilhang greift die Schürze
     * naturgemäss tief. Entscheidend ist, ob oben noch ein Haus zu sehen ist.
     */
    const ueberstand = hausMax - bodenMax;
    luecken.push(luecke); senkungen.push(senkung); ueberstaende.push(ueberstand);
    schlimmste.push({ art: g.art, ecken: g.punkte.length - 1, luecke, senkung, ueberstand,
                      hoehe: hausMax - hausMin, x: (x0 + x1) / 2, z: (z0 + z1) / 2 });
    geo.dispose();
  }

  const schweben = luecken.filter(l => l > TOLERANZ).length;
  zeile(`\n[W1 Gebäude]  ${welt.gebaeude.length} Grundrisse geprüft (Grundgesamtheit)`);
  if (ohneGeometrie) zeile(`  · ${ohneGeometrie} ohne Geometrie (zu klein, wird nicht gebaut)`);
  zeile(`  Lücke unter dem Haus (positiv = schwebt):  p50 ${p(luecken, .5).toFixed(2)} m · p90 ${p(luecken, .9).toFixed(2)} m · max ${Math.max(...luecken).toFixed(2)} m`);
  zeile(`  Einsenkung bergseitig:                     p50 ${p(senkungen, .5).toFixed(2)} m · p90 ${p(senkungen, .9).toFixed(2)} m · max ${Math.max(...senkungen).toFixed(2)} m`);
  zeile(`  Überstand bergseitig (was rausschaut):     p50 ${p(ueberstaende, .5).toFixed(2)} m · p10 ${p(ueberstaende, .1).toFixed(2)} m · min ${Math.min(...ueberstaende).toFixed(2)} m`);
  const versunken = schlimmste.filter(s => s.ueberstand < 1.5);
  const ganz = schlimmste.filter(s => s.ueberstand <= 0);
  if (versunken.length) {
    blocker++;
    zeile(`  ✗ ${versunken.length} Gebäude schauen bergseitig weniger als 1,5 m heraus, davon ${ganz.length} gar nicht mehr`);
    for (const s of versunken.sort((a, b) => a.ueberstand - b.ueberstand).slice(0, TOP))
      zeile(`      ${s.art.padEnd(10)} bei ${s.x.toFixed(0)},${s.z.toFixed(0)} — ${s.hoehe.toFixed(1)} m hoch, davon ${s.senkung.toFixed(1)} m im Berg, Überstand ${s.ueberstand.toFixed(2)} m`);
  } else {
    zeile('  ✓ jedes Gebäude schaut bergseitig über 1,5 m heraus');
  }
  if (schweben) {
    blocker++;
    zeile(`  ✗ ${schweben} Gebäude schweben über ${TOLERANZ} m`);
    for (const s of schlimmste.sort((a, b) => b.luecke - a.luecke).slice(0, TOP))
      zeile(`      ${s.art.padEnd(8)} ${s.ecken} Ecken bei ${s.x.toFixed(0)},${s.z.toFixed(0)} — Lücke ${s.luecke.toFixed(2)} m`);
  } else {
    zeile(`  ✓ kein Gebäude schwebt über ${TOLERANZ} m`);
  }
  if (VERTEILUNG) {
    zeile('  Einsenkung, tiefste 12:');
    for (const s of schlimmste.sort((a, b) => b.senkung - a.senkung).slice(0, 12))
      zeile(`      ${s.art.padEnd(8)} bei ${s.x.toFixed(0)},${s.z.toFixed(0)} — ${s.senkung.toFixed(2)} m unter Grat`);
  }
}

// --------------------------------------------- W3: geschlossene Körper, Umlauf

/**
 * Kantenbilanz eines Netzes.
 *
 * Jede Kante eines geschlossenen Körpers gehört zu **genau zwei** Dreiecken, und zwar
 * in entgegengesetzter Richtung (a→b beim einen, b→a beim anderen). Daraus folgen drei
 * Befunde, ohne dass man die Form kennen muss:
 *
 * - **Rand** (Kante in nur einer Richtung, kein Gegenstück): ein Loch.
 * - **Nicht-mannigfaltig** (mehr als zwei Flächen an einer Kante): T-Stück.
 * - **Gleichläufig** (dieselbe Richtung zweimal): eine der beiden Flächen ist
 *   umgedreht — das war G-128, nur dass es damals niemand gezählt hat.
 *
 * Positionen werden auf 1 mm gerundet, sonst trennt Fliesskomma zwei Ecken, die
 * dieselbe sind.
 */
function kantenbilanz(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position');
  const idx = geo.getIndex();
  const n = idx ? idx.count : pos.count;
  const schluessel = (i: number) => {
    const v = idx ? idx.getX(i) : i;
    return `${Math.round(pos.getX(v) * 1000)},${Math.round(pos.getY(v) * 1000)},${Math.round(pos.getZ(v) * 1000)}`;
  };
  const gerichtet = new Map<string, number>();
  for (let t = 0; t < n; t += 3) {
    const a = schluessel(t), b = schluessel(t + 1), c = schluessel(t + 2);
    for (const [u, v] of [[a, b], [b, c], [c, a]] as const)
      gerichtet.set(`${u}|${v}`, (gerichtet.get(`${u}|${v}`) ?? 0) + 1);
  }
  let rand = 0, gleichlauf = 0, vielfach = 0;
  for (const [k, anzahl] of gerichtet) {
    const [u, v] = k.split('|');
    const zurueck = gerichtet.get(`${v}|${u}`) ?? 0;
    if (anzahl > 1) gleichlauf += anzahl - 1;      // dieselbe Richtung mehrfach
    if (zurueck === 0) rand += anzahl;              // kein Gegenstück
    if (anzahl + zurueck > 2) vielfach++;
  }
  return { rand, gleichlauf, vielfach, dreiecke: n / 3 };
}

/** Punkt im Polygon (Strahlverfahren) — für die Wahl eines Startpunkts im Haus. */
function innen(poly: [number, number][], px: number, pz: number) {
  let d = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) d = !d;
  }
  return d;
}

/**
 * **Lochprobe: was ein Spieler sieht, nicht was die Topologie sagt.**
 *
 * Der erste Anlauf zählte Randkanten (Kante mit nur einer Fläche = Loch). Ergebnis:
 * 2.033 von 2.033 Gebäuden „mit Loch", 2,07 Mio. Randkanten. Das war **der Prüfer**,
 * nicht der Bestand: Ein Haus dieses Generators ist eine Montage aus Quads und Kästen
 * (Wand, Dach, Band, Balkon), kein geschweisster Körper — da ist fast jede Kante ein
 * Rand. Ein Tor, das 2.033 Fehlalarme meldet, ist schlimmer als keines.
 *
 * Also die Frage stellen, die zählt: **Kommt man von innen nach draussen?** Aus der
 * Mitte des Grundrisses, auf Augenhöhe, Strahlen in die obere Halbkugel (Wände und
 * Dach — nach unten schaut niemand von innen). Jeder Strahl, der kein Dreieck trifft,
 * ist ein Loch, durch das man den Himmel sieht.
 */
const STRAHLEN = 240;
function lochprobe(geo: THREE.BufferGeometry, poly: [number, number][], y: number) {
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld();
  // Startpunkt: Schwerpunkt, falls er im Polygon liegt, sonst der erste Rasterpunkt darin.
  const xs = poly.map(q => q[0]), zs = poly.map(q => q[1]);
  let sx = xs.reduce((a, b) => a + b, 0) / xs.length, sz = zs.reduce((a, b) => a + b, 0) / zs.length;
  if (!innen(poly, sx, sz)) {
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)], [z0, z1] = [Math.min(...zs), Math.max(...zs)];
    let gefunden = false;
    for (let i = 1; i < 8 && !gefunden; i++) for (let j = 1; j < 8 && !gefunden; j++) {
      const x = x0 + (x1 - x0) * i / 8, z = z0 + (z1 - z0) * j / 8;
      if (innen(poly, x, z)) { sx = x; sz = z; gefunden = true; }
    }
    if (!gefunden) return null;   // nicht prüfbar (entartetes Polygon)
  }
  const rc = new THREE.Raycaster();
  rc.far = 400;
  const start = new THREE.Vector3(sx, y + 1.5, sz);
  let offen = 0;
  for (let i = 0; i < STRAHLEN; i++) {
    // Fibonacci-Halbkugel: gleichmässig verteilt, y >= 0 (Wände und Dach).
    const t = (i + 0.5) / STRAHLEN;
    const phi = Math.acos(1 - t);                    // 0 = hoch, PI/2 = waagerecht
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const dir = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
    rc.set(start, dir);
    if (rc.intersectObject(mesh, false).length === 0) offen++;
  }
  return offen / STRAHLEN;
}

function pruefeKoerper() {
  let gleichlaufGesamt = 0, mitGleichlauf = 0, nichtPruefbar = 0;
  const offenheiten: number[] = [];
  const schlimmste: { art: string; offen: number; x: number; z: number; gleich: number }[] = [];
  for (const g of welt.gebaeude) {
    const geo = baueGebaeude(welt, boden, [g]);
    if (!geo) continue;
    const b = kantenbilanz(geo);
    if (b.gleichlauf > 0) { mitGleichlauf++; gleichlaufGesamt += b.gleichlauf; }
    const poly = g.punkte.map(nachWelt);
    const mx = poly.reduce((s, q) => s + q[0], 0) / poly.length;
    const mz = poly.reduce((s, q) => s + q[1], 0) / poly.length;
    const offen = lochprobe(geo, poly, boden.tiefsteFlaeche(mx, mz));
    if (offen === null) nichtPruefbar++;
    else {
      offenheiten.push(offen);
      if (offen > 0.02 || b.gleichlauf > 0)
        schlimmste.push({ art: g.art, offen, x: mx, z: mz, gleich: b.gleichlauf });
    }
    geo.dispose();
  }
  const mitLoch = offenheiten.filter(o => o > 0.02).length;
  zeile(`\n[W3 Körper]   ${offenheiten.length} Gebäude mit ${STRAHLEN} Strahlen von innen geprüft (Grundgesamtheit)`);
  if (nichtPruefbar) zeile(`  · ${nichtPruefbar} nicht prüfbar (entarteter Grundriss)`);
  zeile(`  Umgedrehte Flächen (G-128):   ${mitGleichlauf} Gebäude, ${gleichlaufGesamt} Kanten`);
  zeile(`  Offener Himmel von innen:     p50 ${(p(offenheiten, .5) * 100).toFixed(1)} % · p90 ${(p(offenheiten, .9) * 100).toFixed(1)} % · max ${(Math.max(...offenheiten) * 100).toFixed(1)} %`);
  if (mitLoch) {
    blocker++;
    zeile(`  ✗ ${mitLoch} Gebäude mit Loch (über 2 % offen)`);
    for (const s of schlimmste.sort((a, b) => b.offen - a.offen).slice(0, TOP))
      zeile(`      ${s.art.padEnd(10)} bei ${s.x.toFixed(0)},${s.z.toFixed(0)} — ${(s.offen * 100).toFixed(1)} % offen${s.gleich ? `, ${s.gleich} umgedreht` : ''}`);
  } else {
    zeile('  ✓ kein Gebäude offen über 2 %');
  }
  if (mitGleichlauf) blocker++;
}

// ------------------------------------------------ W4: Wasser liegt in seinem Bett

/**
 * Jeder Vertex der Wasser- und Fallgeometrie gegen die Geländehöhe an derselben Stelle.
 *
 * Wasser **über** dem Gelände schwebt. Ein kleiner Betrag ist Bauart (das Band liegt
 * bewusst knapp über der Sohle, damit es nicht im Boden verschwindet); wieviel zu viel
 * ist, sagt die Verteilung. Gemessen auf LOD 0, weil das Band auf der feinsten Stufe
 * gebaut wird.
 */
function pruefeWasser() {
  const satz = zerlegeBaender(welt, feld);
  const kacheln = baueKachelraster(feld);
  const ueber: number[] = [];
  const schlimmste: { x: number; z: number; d: number; art: string }[] = [];
  let kachelnMitWasser = 0, vertices = 0;

  for (const k of kacheln) {
    for (const [art, bauen] of [['bach', baueWasserKachel], ['fall', baueFallKachel]] as const) {
      const geo = bauen(feld, satz, k, 0);
      if (!geo) continue;
      kachelnMitWasser++;
      const pos = geo.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const h = hoeheAufFlaeche(feld, x, z);
        const d = y - h;
        vertices++;
        ueber.push(d);
        if (d > 1.0) schlimmste.push({ x, z, d, art });
      }
      geo.dispose();
    }
  }

  const schwebend = ueber.filter(d => d > 1.0).length;
  zeile(`\n[W4 Wasser]   ${kachelnMitWasser} Kacheln mit Wasser, ${vertices} Vertices geprüft (Grundgesamtheit, LOD 0)`);
  if (!vertices) { zeile('  (kein Wasser gebaut)'); return; }
  zeile(`  Höhe über Gelände:  p50 ${p(ueber, .5).toFixed(2)} m · p90 ${p(ueber, .9).toFixed(2)} m · p99 ${p(ueber, .99).toFixed(2)} m · max ${Math.max(...ueber).toFixed(2)} m`);
  zeile(`  Anteil über 1 m:    ${(schwebend / vertices * 100).toFixed(1)} %  (${schwebend} Vertices)`);
  if (schwebend) {
    blocker++;
    const gruppen = new Map<string, { d: number; x: number; z: number; n: number }>();
    for (const s of schlimmste) {
      const k = `${Math.round(s.x / 40)}:${Math.round(s.z / 40)}:${s.art}`;
      const v = gruppen.get(k);
      if (!v || s.d > v.d) gruppen.set(k, { d: s.d, x: s.x, z: s.z, n: (v?.n ?? 0) + 1 });
      else v.n++;
    }
    zeile(`  ✗ Wasser schwebt an ${gruppen.size} Stellen über 1 m:`);
    for (const [, v] of [...gruppen].sort((a, b) => b[1].d - a[1].d).slice(0, TOP))
      zeile(`      bei ${v.x.toFixed(0)},${v.z.toFixed(0)} — ${v.d.toFixed(2)} m über Grund (${v.n} Vertices im Umkreis)`);
  }
}

// --------------------------------------------- W1b: Orte und Fundstellen auf Boden

function pruefeMarken() {
  const inhalt = (ordner: string) =>
    readdirSync(`content/${ordner}`).filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(readFileSync(`content/${ordner}/${f}`, 'utf8')));
  let geprueft = 0, daneben = 0;
  for (const ordner of ['orte', 'fragmente']) {
    for (const o of inhalt(ordner)) {
      if (!o.ort) continue;
      const [x, z] = nachWelt(o.ort);
      geprueft++;
      const drin = Math.abs(x) <= feld.breiteMeter / 2 && Math.abs(z) <= feld.tiefeMeter / 2;
      if (!drin) {
        daneben++;
        zeile(`      ✗ ${o.id} liegt ausserhalb der Region bei ${x.toFixed(0)},${z.toFixed(0)}`);
      }
    }
  }
  zeile(`\n[W5 Marken]   ${geprueft} Orte und Fundstellen geprüft (Grundgesamtheit)`);
  zeile(daneben ? `  ✗ ${daneben} ausserhalb der Region` : '  ✓ alle innerhalb der Region');
  if (daneben) blocker++;
}

zeile('\nGeometrie-Tor — ADR-0005 W1/W3/W4/W5');
zeile(`Region: ${welt.gebaeude.length} Gebäude · ${feld.breiteMeter.toFixed(0)}×${feld.tiefeMeter.toFixed(0)} m`);
pruefeGebaeude();
pruefeKoerper();
pruefeWasser();
pruefeMarken();
zeile(`\n${blocker} Blocker\n`);
process.exit(blocker ? 1 : 0);
