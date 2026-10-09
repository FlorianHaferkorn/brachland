import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { PALETTE } from '../src/world/palette.js';
import { join } from 'node:path';
import { Kreatur, Move, Regent, Gegenstand, Fragment, Ort, Auftrag, WaffenDaten, GegnerDaten,
         effektivitaet, schadensfaktor, ELEMENTE } from '../src/data/schema.js';

let ok = 0, fehler = 0;

/** Ein Ordner gegen ein Schema. Gibt die geparsten Objekte zurueck. */
function pruefe<T>(ordner: string, schema: { safeParse: (x: unknown) => any }): T[] {
  const raus: T[] = [];
  for (const f of readdirSync(ordner).filter(f => f.endsWith('.json')).sort()) {
    const raw = JSON.parse(readFileSync(join(ordner, f), 'utf8'));
    const r = schema.safeParse(raw);
    if (r.success) { console.log(`  ✓ ${f}`); ok++; raus.push(r.data); }
    else {
      console.log(`  ✗ ${f}`);
      r.error.issues.forEach((i: any) => console.log(`      ${i.path.join('.')}: ${i.message}`));
      fehler++;
    }
  }
  return raus;
}

console.log('Moves:');
const moves = pruefe<{ id: string }>('content/moves', Move);
console.log('\nKreaturen:');
const kreaturen = pruefe<any>('content/creatures', Kreatur);
console.log('\nRegenten:');
const regenten = pruefe<any>('content/regenten', Regent);
console.log('\nGegenstände:');
const gegenstaende = pruefe<any>('content/gegenstaende', Gegenstand);
console.log('\nFragmente:');
const fragmente = pruefe<any>('content/fragmente', Fragment);
console.log('\nOrte:');
const orte = pruefe<any>('content/orte', Ort);
console.log('\nAufträge:');
const auftraege = pruefe<any>('content/auftraege', Auftrag);
console.log('\nWaffen:');
const waffen = pruefe<any>('content/waffen', WaffenDaten);
{
  // Die Datei heisst wie ihre Waffe — `echtzeit.ts` importiert sie über den Namen.
  for (const f of readdirSync('content/waffen').filter(f => f.endsWith('.json'))) {
    const id = JSON.parse(readFileSync(join('content/waffen', f), 'utf8')).id;
    if (`${id}.json` !== f) { console.log(`  ✗ ${f} trägt id '${id}'`); fehler++; }
  }
  // `istSchwer` erkennt den schweren Schlag am Namen: Ein Name, der zweimal vorkommt, entlädt den
  // Funken aus dem falschen Schlag oder nie.
  const namen = waffen.flatMap((w: any) => [...w.leicht, w.schwer, w.lauf].map((s: any) => s.name));
  const doppelt = namen.filter((n: string, i: number) => namen.indexOf(n) !== i);
  if (doppelt.length) { console.log(`  ✗ Schlagnamen doppelt: ${[...new Set(doppelt)].join(', ')}`); fehler++; }
  else console.log(`  ✓ ${namen.length} Schlagnamen eindeutig`);
}
console.log('\nGegner:');
pruefe<any>('content/gegner', GegnerDaten);
// Wie bei den Waffen: Dateiname = id, `echtzeit.ts` importiert über den Namen.
for (const f of readdirSync('content/gegner').filter(f => f.endsWith('.json'))) {
  const id = JSON.parse(readFileSync(join('content/gegner', f), 'utf8')).id;
  if (`${id}.json` !== f) { console.log(`  ✗ ${f} trägt id '${id}'`); fehler++; }
}

// Querverweise: jede referenzierte Move-ID muss es geben. Ohne diese Pruefung
// faellt ein Tippfehler erst im Kampf auf — und dort als leerer Move-Knopf.
console.log('\nQuerverweise:');
const bekannt = new Set(moves.map(m => m.id));
let tote = 0;
const melde = (wer: string, id: string) => {
  if (bekannt.has(id)) return;
  console.log(`  ✗ ${wer} verweist auf unbekannten Move '${id}'`);
  tote++;
};
for (const k of kreaturen) {
  k.grundMoves.forEach((m: string) => melde(k.id, m));
  k.stufen.forEach((s: any) => s.signaturMove && melde(k.id, s.signaturMove));
}
for (const r of regenten) r.moves.forEach((m: string) => melde(r.id, m));
console.log(tote === 0 ? `  ✓ alle ${bekannt.size} Moves aufgeloest` : `  ${tote} tote Verweise`);

// Ohne Beute im Spiel gibt es keine Gegenstaende — dann ist der Beutel Deko.
const mitBeute = gegenstaende.filter((g: any) => g.beuteChance > 0).length;
console.log(mitBeute > 0
  ? `  ✓ ${mitBeute} von ${gegenstaende.length} Gegenstaenden fallen als Beute an`
  : '  ✗ kein Gegenstand faellt als Beute an — der Beutel bliebe leer');
if (mitBeute === 0) fehler++;

// Zwei Fragmente am selben Ort findet man nie beide — der zweite Auslöser feuert nie.
let doppelt = 0;
for (let i = 0; i < fragmente.length; i++)
  for (let j = i + 1; j < fragmente.length; j++) {
    const a = fragmente[i].ort, b = fragmente[j].ort;
    // ~0,0002 Grad sind rund 20 m — knapp unter dem Fundradius.
    if (Math.abs(a[0] - b[0]) < 0.0002 && Math.abs(a[1] - b[1]) < 0.0002) {
      console.log(`  ✗ '${fragmente[i].id}' und '${fragmente[j].id}' liegen am selben Ort`);
      doppelt++;
    }
  }
console.log(doppelt === 0
  ? `  ✓ ${fragmente.length} Fragmente liegen einzeln`
  : `  ${doppelt} Ueberschneidungen`);
fehler += doppelt;
if (tote > 0) fehler += tote;

/**
 * Aufträge gegen die Welt prüfen.
 *
 * Ein Auftrag ist die einzige Inhaltsart, die auf **vier** andere zeigt: Geber,
 * Zielobjekt, Belohnung und Vorgänger. Jeder dieser Verweise ist ein Tippfehler
 * entfernt davon, einen Auftrag unerfüllbar zu machen — und unerfüllbar merkt man
 * erst, wenn jemand ihn angenommen hat und stundenlang nichts passiert.
 */
let auftragsfehler = 0;
const meldeA = (id: string, was: string) => {
  console.log(`  ✗ Auftrag '${id}': ${was}`);
  auftragsfehler++;
};
const bewohner = new Set(orte.filter((o: any) => o.art === 'bewohner').map((o: any) => o.id));
const gegenstandIds = new Set(gegenstaende.map((g: any) => g.id));
const kreaturIds = new Set(kreaturen.map((k: any) => k.id));
const fragmentIds = new Set(fragmente.map((f: any) => f.id));
const regentIds = new Set(regenten.map((r: any) => r.id));
const auftragIds = new Set(auftraege.map((a: any) => a.id));

for (const a of auftraege) {
  if (!bewohner.has(a.geber)) meldeA(a.id, `Geber '${a.geber}' ist kein Bewohner-Ort`);
  if (a.vorher && !auftragIds.has(a.vorher)) meldeA(a.id, `Vorbedingung '${a.vorher}' gibt es nicht`);
  if (a.vorher === a.id) meldeA(a.id, 'ist seine eigene Vorbedingung');
  for (const g of Object.keys(a.belohnung))
    if (!gegenstandIds.has(g)) meldeA(a.id, `Belohnung '${g}' gibt es nicht`);
  const z = a.ziel;
  if ((z.art === 'besiege' || z.art === 'fange') && !kreaturIds.has(z.kreatur))
    meldeA(a.id, `Ziel-Kreatur '${z.kreatur}' gibt es nicht`);
  if (z.art === 'finde' && !fragmentIds.has(z.fragment))
    meldeA(a.id, `Ziel-Fragment '${z.fragment}' gibt es nicht`);
  if (z.art === 'regent' && !regentIds.has(z.regent))
    meldeA(a.id, `Ziel-Regent '${z.regent}' gibt es nicht`);
}

// Zyklus in den Vorbedingungen: Zwei Aufträge, die aufeinander warten, sind beide
// für immer gesperrt — und im Spiel sichtbar nur als „da ist nichts".
for (const a of auftraege) {
  const gesehen = new Set<string>([a.id]);
  let k = a.vorher;
  while (k) {
    if (gesehen.has(k)) { meldeA(a.id, `Vorbedingungen laufen im Kreis (über '${k}')`); break; }
    gesehen.add(k);
    k = auftraege.find((x: any) => x.id === k)?.vorher;
  }
}

// Ein Bewohner ohne Auftrag ist ein Knopf, der nichts tut.
for (const o of orte.filter((x: any) => x.art === 'bewohner'))
  if (!auftraege.some((a: any) => a.geber === o.id))
    meldeA(o.id, 'Bewohner ohne einen einzigen Auftrag');

/**
 * Laufzeitfarben (D146) muessen im Kreaturband liegen — dieselbe Regel wie fuer
 * jede Palettenfarbe an einer Figur (D112/D117): Was heller ist, brennt im
 * Sonnenfleck weiss aus, was dunkler ist, faellt unter die Schwarzgrenze.
 * Haut und Haar duerfen darunter (Haar 0,05 in der Palette).
 */
{
  const lin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const { unten, oben } = PALETTE.kreaturBand;
  for (const o of orte as any[]) {
    for (const [slot, hex] of Object.entries(o.farben ?? {}) as [string, string][]) {
      const y = 0.2126 * lin(parseInt(hex.slice(1, 3), 16)) + 0.7152 * lin(parseInt(hex.slice(3, 5), 16)) + 0.0722 * lin(parseInt(hex.slice(5, 7), 16));
      const min = slot === 'haar' || slot === 'haut' || slot === 'stiefel' || slot === 'riemen' ? 0.02 : unten;
      if (y < min || y > oben)
        meldeA(o.id, `Farbe ${slot} ${hex} hat Leuchtdichte ${y.toFixed(3)} — erlaubt ${min}…${oben} (Kreaturband)`);
    }
  }
}

/**
 * Wie freistehend stehen die Orte wirklich?
 *
 * `content/orte/_INDEX.md` behauptete „0 Nachbarn im 70-m-Umkreis". Nachgemessen
 * waren es bei zwei der vier je einer — die Zahl stimmte, als sie geschrieben
 * wurde, und ist seitdem stehengeblieben. Deshalb steht sie jetzt hier: Eine
 * Marke ist nur auffindbar, wenn sie nicht zwischen zwanzig Häusern sitzt, und
 * das ist eine Messung, keine Behauptung.
 *
 * Keine Fehlergrenze, nur eine Ausgabe: Ab wann ein Ort „zu dicht" steht, hängt
 * am Gefühl beim Spielen, und eine erfundene Schwelle wäre schlimmer als keine.
 */
if (existsSync('public/world/oental.json')) {
  const welt = JSON.parse(readFileSync('public/world/oental.json', 'utf8')).welt;
  const M = 111_000, MO = 111_000 * Math.cos(47.733 * Math.PI / 180);
  const zentren = welt.gebaeude.map((g: any) => {
    let a = 0, b = 0;
    for (const [la, lo] of g.punkte) { a += la; b += lo; }
    return [a / g.punkte.length, b / g.punkte.length];
  });
  const nachbarn = orte.map((o: any) => {
    const d = zentren.map(([la, lo]: number[]) =>
      Math.hypot((la - o.ort[0]) * M, (lo - o.ort[1]) * MO));
    return { id: o.id, n: d.filter((x: number) => x > 1 && x < 70).length };
  });
  // D182: Jede Zuflucht braucht einen Aufwachpunkt ausserhalb jedes Grundrisses, 2 m von der Wand.
  const innen = (p: number[], P: number[][]) => {
    let c = false;
    for (let i = 0; i < P.length - 1; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[i + 1];
      if ((y1 > p[1]) !== (y2 > p[1]) && p[0] < (x2 - x1) * (p[1] - y1) / (y2 - y1) + x1) c = !c;
    }
    return c;
  };
  const kante = (p: number[], a: number[], b: number[]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
    return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
  };
  for (const o of orte.filter((x: any) => x.art === 'zuflucht')) {
    if (!o.aufwachen) { console.log(`  ✗ ${o.id}: Zuflucht ohne Aufwachpunkt`); auftragsfehler++; continue; }
    const p = o.aufwachen;
    const naehe = welt.gebaeude.map((g: any) => g.punkte.map(([la, lo]: number[]) => [(lo - o.ort[1]) * MO, -(la - o.ort[0]) * M]))
      .filter((P: number[][]) => P.some(q => Math.hypot(q[0], q[1]) < 60));
    const drin = naehe.some((P: number[][]) => innen(p, P));
    const abstand = Math.min(99, ...naehe.flatMap((P: number[][]) => P.slice(1).map((q, i) => kante(p, P[i], q))));
    if (drin || abstand < 2) {
      console.log(`  ✗ ${o.id}: Aufwachpunkt ${drin ? 'im Grundriss' : `nur ${abstand.toFixed(1)} m von der Wand`}`);
      auftragsfehler++;
    } else console.log(`  ✓ ${o.id}: Aufwachpunkt draussen, ${abstand.toFixed(1)} m von der Wand`);
  }
  const schlimmster = nachbarn.reduce((a, b) => (b.n > a.n ? b : a));
  console.log(`  ✓ ${orte.length} Orte freistehend: höchstens ${schlimmster.n} Nachbargebäude `
    + `im 70-m-Umkreis (${schlimmster.id}), ${nachbarn.filter(x => x.n === 0).length} ganz allein`);
}

const zufluchten = orte.filter((o: any) => o.art === 'zuflucht').length;
if (zufluchten === 0) {
  console.log('  ✗ keine Zuflucht — dann bleibt die Niederlage der beste Weg zu vollen KP');
  auftragsfehler++;
}
console.log(auftragsfehler === 0
  ? `  ✓ ${auftraege.length} Aufträge und ${orte.length} Orte hängen zusammen (${zufluchten} Zufluchten)`
  : `  ${auftragsfehler} Fehler in Aufträgen und Orten`);
fehler += auftragsfehler;

console.log(`\n${ok} gültig, ${fehler} fehlerhaft\n`);

// Matrix-Selbsttest: jedes Element muss 2 Siege, 2 Niederlagen, 3 neutral haben
console.log('Matrix-Selbsttest:');
let matrixOk = true;
for (const a of ELEMENTE) {
  const s = ELEMENTE.filter(d => effektivitaet(a, d) === 2).length;
  const n = ELEMENTE.filter(d => effektivitaet(d, a) === 2).length;
  const gut = s === 2 && n === 2;
  if (!gut) matrixOk = false;
  console.log(`  ${gut ? '✓' : '✗'} ${a.padEnd(9)} schlägt ${s}, unterliegt ${n}`);
}
console.log(matrixOk ? '  Matrix ausgewogen.\n' : '  MATRIX UNAUSGEWOGEN!\n');

console.log('Doppeltyp-Stichprobe (Verteidigung):');
console.log(`  Angriff holz  auf [stein]            → ${schadensfaktor('holz', ['stein'])}`);
console.log(`  Angriff holz  auf [stein, alt-tech]  → ${schadensfaktor('holz', ['stein','alt-tech'])}   (4x = Abstand 1)`);
console.log(`  Angriff frost auto [holz, sporen]    → ${schadensfaktor('frost', ['holz','sporen'])}`);

process.exit(fehler > 0 || !matrixOk ? 1 : 0);
