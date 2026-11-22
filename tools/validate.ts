import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { PALETTE } from '../src/world/palette.js';
import { join } from 'node:path';
import { Belohnungen, Oekonomie, BELOHNUNGS_KATEGORIEN, Kreatur, Move, Regent, Gegenstand, Fragment, Ort, Auftrag, Region, Wanderfigur, Strecke, LEKTIONEN, WaffenDaten, GegnerDaten, ReinigenDaten, Fassade, Massstab, Hofbauten, Hofbaukasten, Einstellungen, QUALITAETSSTUFEN,
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
console.log('\nFassaden:');
pruefe<any>('content/fassaden', Fassade);
{
  const h = Hofbauten.safeParse(JSON.parse(readFileSync('content/hofbauten.json', 'utf8')));
  if (!h.success) { console.log('  ✗ content/hofbauten.json', JSON.stringify(h.error.issues)); fehler++; }
  else for (const b of h.data.hofbauten) {
    if (!existsSync(`public/bauten/${b.modell}.glb`)) { console.log(`  ✗ hofbauten: public/bauten/${b.modell}.glb fehlt`); fehler++; }
    else ok++;
  }
  const r = Massstab.safeParse(JSON.parse(readFileSync('content/massstab.json', 'utf8')));
  if (!r.success) { console.log('  ✗ content/massstab.json', JSON.stringify(r.error.issues)); fehler++; }
  else ok++;
}
{
  // D360: Hof-Baukasten. Eine Zahl ohne annahme muss auf die Bauwelt-Notiz oder eine Ledger-Zeile zeigen.
  const r = Hofbaukasten.safeParse(JSON.parse(readFileSync('content/hofbaukasten.json', 'utf8')));
  if (!r.success) { console.log('  ✗ content/hofbaukasten.json', JSON.stringify(r.error.issues)); fehler++; }
  else {
    const eintraege: [string, { quelle: string; annahme: boolean }][] = [
      ...Object.entries(r.data.masse), ...Object.entries(r.data.farben),
      ...r.data.verfall.flatMap(s => Object.entries(s).filter(([, w]) => typeof w === 'object') as [string, any][])
        .map(([k, w]) => [`verfall.${k}`, w] as [string, any]),
    ];
    const ohne = eintraege.filter(([, w]) => !w.annahme && !/Bauwelt|Ledger D\d+/.test(w.quelle));
    ohne.forEach(([k]) => console.log(`  ✗ hofbaukasten ${k}: kein Beleg und nicht als annahme gekennzeichnet`));
    if (ohne.length) fehler++; else { console.log(`  ✓ hofbaukasten.json (${eintraege.filter(([, w]) => w.annahme).length} Annahmen)`); ok++; }
  }
}
console.log('\nAufträge:');
const auftraege = pruefe<any>('content/auftraege', Auftrag);
console.log('\nRegionen:');
const regionen = pruefe<any>('content/regions', Region);
console.log('\nWanderfiguren:');
const wanderfiguren = pruefe<any>('content/wanderfiguren', Wanderfigur);
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
const gegnerDaten = pruefe<any>('content/gegner', GegnerDaten);
console.log('\nStrecken:');
const strecken = pruefe<any>('content/strecken', Strecke);
// Wie bei den Waffen: Dateiname = id, `echtzeit.ts` importiert über den Namen.
for (const f of readdirSync('content/gegner').filter(f => f.endsWith('.json'))) {
  const id = JSON.parse(readFileSync(join('content/gegner', f), 'utf8')).id;
  if (`${id}.json` !== f) { console.log(`  ✗ ${f} trägt id '${id}'`); fehler++; }
}

console.log('\nReinigen (D376):');
{
  const r = ReinigenDaten.safeParse(JSON.parse(readFileSync('content/reinigen.json', 'utf8')));
  if (r.success) { console.log('  ✓ reinigen.json'); ok++; }
  else { console.log(`  ✗ reinigen.json: ${r.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; ')}`); fehler++; }
  // D389: Jedes Tier trägt seine eigene Reinigungsdauer, kein Mensch eine (ausser freiwillig befallen,
  // D385); die Griffzahl `ceil(dauer / halten)` bleibt im bestätigten Band (D379).
  if (r.success) {
    const band = r.data.griffe;
    let gut = 0;
    for (const f of readdirSync('content/gegner').filter(f => f.endsWith('.json'))) {
      const g = GegnerDaten.safeParse(JSON.parse(readFileSync(join('content/gegner', f), 'utf8')));
      if (!g.success) continue;
      const tier = !!g.data.elemente?.length && !g.data.mensch;
      if (tier && !g.data.reinigen) { console.log(`  ✗ ${f}: Tier ohne \`reinigen\` (D389)`); fehler++; continue; }
      if (!g.data.reinigen) continue;
      const griffe = Math.ceil(g.data.reinigen.dauer / (g.data.reinigen.halten ?? r.data.halten) - 1e-9);
      if (griffe < band.min || griffe > band.max) {
        console.log(`  ✗ ${f}: ${griffe} Griffe, erlaubt ${band.min}–${band.max} (reinigen.json griffe)`); fehler++;
      } else gut++;
    }
    console.log(`  ✓ ${gut} Gegner mit eigener Reinigungsdauer, Griffzahl ${band.min}–${band.max}`); ok++;
  }
}

console.log('\nEinstellungen (D394):');
{
  // Das Schema prüft Eindeutigkeit, Standard und Stufenwerte im Wertebereich. Hier zusätzlich: Eine
  // Grafik-Einstellung mit Stufenwerten nennt alle vier Stufen — sonst bliebe beim Wechsel der
  // Qualitätsstufe ein Wert der alten Stufe stehen.
  const r = Einstellungen.safeParse(JSON.parse(readFileSync('content/einstellungen.json', 'utf8')));
  if (!r.success) {
    console.log(`  ✗ einstellungen.json: ${r.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; ')}`); fehler++;
  } else {
    let luecken = 0;
    for (const e of r.data.einstellungen) {
      const fehlt = e.stufen ? QUALITAETSSTUFEN.filter(s => !(s in e.stufen!)) : [];
      if (fehlt.length) { console.log(`  ✗ ${e.id}: Stufenwert fehlt für ${fehlt.join(', ')}`); fehler++; luecken++; }
    }
    if (!luecken) { console.log(`  ✓ einstellungen.json: ${r.data.einstellungen.length} Einstellungen, Stufenwerte vollständig`); ok++; }
  }
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

// Belohnungen und Ökonomie (D393): Jede Kategorie des Vertrags mit D392 löst sich in vorhandene
// Gegenstände der passenden Art auf; Unikate sind einmalig und liegen in genau einem Vorrat.
{
  const meldeB = (was: string) => { console.log(`  ✗ Belohnungen: ${was}`); auftragsfehler++; };
  const art = (id: string) => gegenstaende.find((g: any) => g.id === id)?.wirkung.art;
  const einmalig = (id: string) => gegenstaende.find((g: any) => g.id === id)?.einmalig === true;
  const b = Belohnungen.safeParse(JSON.parse(readFileSync('content/belohnungen.json', 'utf8')));
  if (!b.success) meldeB(b.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; '));
  else {
    for (const k of BELOHNUNGS_KATEGORIEN) if (!(k in b.data.mengen) && !(k in b.data.unikate)) meldeB(`Kategorie '${k}' fehlt`);
    for (const [k, liste] of Object.entries(b.data.mengen)) for (const e of liste!) {
      if (!gegenstandIds.has(e.gegenstand)) { meldeB(`${k}: '${e.gegenstand}' gibt es nicht`); continue; }
      if (einmalig(e.gegenstand)) meldeB(`${k}: '${e.gegenstand}' ist einmalig und keine Mengenware`);
      const stufe = /^aufwertung-(\d)$/.exec(k)?.[1];
      const g = gegenstaende.find((x: any) => x.id === e.gegenstand);
      if (stufe && !(g.wirkung.art === 'material' && g.wirkung.stufe === Number(stufe))) meldeB(`${k}: '${e.gegenstand}' ist kein Material der Stufe ${stufe}`);
      if (k === 'marke' && g.wirkung.art !== 'marke') meldeB(`marke: '${e.gegenstand}' stärkt die Marke nicht`);
    }
    const ARTEN: Record<string, string> = { werkzeug: 'werkzeug', waffe: 'waffe', ruestung: 'zeug', wissen: 'wissen', zugang: 'zugang' };
    const gesehen = new Set<string>();
    for (const [k, jeRegion] of Object.entries(b.data.unikate)) for (const [region, vorrat] of Object.entries(jeRegion!)) {
      if (!regionen.some((r: any) => r.id === region)) meldeB(`${k}: Region '${region}' gibt es nicht`);
      for (const id of vorrat) {
        if (!gegenstandIds.has(id)) { meldeB(`${k}: '${id}' gibt es nicht`); continue; }
        if (!einmalig(id)) meldeB(`${k}: '${id}' ist nicht einmalig`);
        if (ARTEN[k] && art(id) !== ARTEN[k]) meldeB(`${k}: '${id}' hat Art '${art(id)}', erwartet '${ARTEN[k]}'`);
        if (gesehen.has(id)) meldeB(`'${id}' liegt in zwei Vorräten — das wäre eine Kopier-Belohnung`);
        gesehen.add(id);
      }
    }
    for (const g of gegenstaende) if (g.gewicht === undefined) meldeB(`'${g.id}' hat kein Gewicht (D398)`);
    for (const g of gegenstaende) if (g.einmalig && !gesehen.has(g.id)) meldeB(`'${g.id}' ist einmalig, liegt aber in keinem Vorrat`);
    for (const sprosse of b.data.leiter) if (sprosse.unikat && !sprosse.kategorien.some(k => k in b.data.unikate))
      meldeB(`Sprosse '${sprosse.rang}' verspricht ein Unikat, nennt aber keine Unikat-Kategorie`);
  }
  const o = Oekonomie.safeParse(JSON.parse(readFileSync('content/oekonomie.json', 'utf8')));
  if (!o.success) meldeB(`oekonomie.json: ${o.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  else {
    const d = o.data;
    const kenne = (wo: string, ids: string[]) => { for (const id of ids) if (!gegenstandIds.has(id)) meldeB(`oekonomie.json ${wo}: '${id}' gibt es nicht`); };
    d.schmiede.forEach(s => kenne(`schmiede Stufe ${s.stufe}`, Object.keys(s.preis)));
    if (d.schmiede.some((s, i) => s.stufe !== i + 1)) meldeB('oekonomie.json schmiede: Stufen lückenlos ab 1');
    kenne('beute', [d.beute.tier.gegenstand, d.beute.mensch.gegenstand, d.beute.verhaerteter.gegenstand, d.beute.regent.gegenstand]);
    kenne('marke.ruhigesRevier', Object.keys(d.marke.ruhigesRevier));
    kenne('flasche', [...Object.keys(d.flasche.schlucke.preis), ...Object.keys(d.flasche.staerke.preis)]);
    for (const t of d.tausch) {
      if (!bewohner.has(t.bei)) meldeB(`oekonomie.json tausch: '${t.bei}' ist kein Bewohner-Ort`);
      kenne(`tausch bei ${t.bei}`, [...Object.keys(t.gibt), ...Object.keys(t.nimmt), ...(t.braucht ? [t.braucht] : [])]);
      if (t.braucht && art(t.braucht) !== 'wissen') meldeB(`oekonomie.json tausch: '${t.braucht}' ist kein Wissen`);
    }
    for (const [region, r] of Object.entries(d.regionen)) {
      if (!regionen.some((x: any) => x.id === region)) meldeB(`oekonomie.json: Region '${region}' gibt es nicht`);
      kenne(`regionen.${region}.einmalig`, Object.keys(r.einmalig));
    }
  }
}

for (const a of auftraege) {
  if (!bewohner.has(a.geber)) meldeA(a.id, `Geber '${a.geber}' ist kein Bewohner-Ort`);
  if (a.vorher && !auftragIds.has(a.vorher)) meldeA(a.id, `Vorbedingung '${a.vorher}' gibt es nicht`);
  if (a.vorher === a.id) meldeA(a.id, 'ist seine eigene Vorbedingung');
  for (const g of Object.keys(a.belohnung))
    if (!gegenstandIds.has(g)) meldeA(a.id, `Belohnung '${g}' gibt es nicht`);
  const z = a.ziel;
  if ((z.art === 'besiege' || z.art === 'reinige') && !kreaturIds.has(z.kreatur))
    meldeA(a.id, `Ziel-Kreatur '${z.kreatur}' gibt es nicht`);
  if (z.art === 'finde' && !fragmentIds.has(z.fragment))
    meldeA(a.id, `Ziel-Fragment '${z.fragment}' gibt es nicht`);
  if ((z.art === 'regent' || z.art === 'heile') && !regentIds.has(z.regent))
    meldeA(a.id, `Ziel-Regent '${z.regent}' gibt es nicht`);
}

// Heilung (D240): Jede Reinkultur-Komponente eines Regenten muss es als Gegenstand der Art
// `komponente` geben und als Belohnung irgendeines Auftrags — sonst ist die Heilung unerreichbar.
const belohnt = new Set(auftraege.flatMap((a: any) => Object.keys(a.belohnung)));
const meldeR = (id: string, was: string) => { console.log(`  ✗ Regent '${id}': ${was}`); auftragsfehler++; };
for (const r of regenten) for (const k of r.reinkulturen) {
  const g = gegenstaende.find((x: any) => x.id === k);
  if (!g) meldeR(r.id, `Reinkultur '${k}' gibt es nicht als Gegenstand`);
  else if (g.wirkung.art !== 'komponente') meldeR(r.id, `Reinkultur '${k}' ist keine Komponente`);
  // Ein Regent, dessen Region noch nicht angelegt ist (D246, Brutmutter vor Fahlmoos), hat
  // keine Aufträge, die belohnen könnten. Die Erreichbarkeit wird hart, sobald die Region da ist.
  if (!belohnt.has(k) && existsSync(`content/regions/${r.region}.json`))
    meldeR(r.id, `Reinkultur '${k}' ist keine Belohnung — Heilung unerreichbar`);
}
for (const r of regenten) if (!existsSync(`content/regions/${r.region}.json`))
  console.log(`  · Regent '${r.id}': Region '${r.region}' fehlt noch — im Spiel nicht erreichbar, `
    + `Reinkulturen erst mit der Region prüfbar`);
// Regionen als eigene Karten (ADR-0014): Was eine Region nennt, muss es geben, und was in einer
// Region liegt, muss in ihrer Bbox liegen — sonst rechnet `nachMetern` es über den Rand hinaus.
{
  const meldeG = (id: string, was: string) => { console.log(`  ✗ Region '${id}': ${was}`); auftragsfehler++; };
  const gegenueber = { nord: 'sued', sued: 'nord', ost: 'west', west: 'ost' } as const;
  const nachId = new Map(regionen.map((r: any) => [r.id, r]));
  const drin = (r: any, [lat, lon]: [number, number]) =>
    lat >= r.bbox[0] && lat <= r.bbox[2] && lon >= r.bbox[1] && lon <= r.bbox[3];
  for (const r of regionen) {
    if (!existsSync(`public/world/${r.id}.json`)) meldeG(r.id, `Weltdaten fehlen — npm run world ${r.id} 384`);
    if (!regentIds.has(r.regent)) meldeG(r.id, `Regent '${r.regent}' gibt es nicht`);
    for (const k of r.kreaturen) if (!kreaturIds.has(k)) meldeG(r.id, `Kreatur '${k}' gibt es nicht`);
    for (const n of r.nachbarn) {
      const ziel: any = nachId.get(n.region);
      if (!ziel) meldeG(r.id, `Nachbarin '${n.region}' gibt es nicht`);
      else if (!ziel.nachbarn.some((m: any) => m.region === r.id && m.seite === gegenueber[n.seite as keyof typeof gegenueber]))
        meldeG(r.id, `'${n.region}' kennt den Weg zurück nicht (Seite ${gegenueber[n.seite as keyof typeof gegenueber]})`);
    }
    // Eine feste Art steht an einer Koordinate — in einer anderen Region stünde sie irgendwo draußen.
    for (const k of r.kreaturen) {
      const kr = kreaturen.find((x: any) => x.id === k);
      if (kr?.position && !drin(r, kr.position)) meldeG(r.id, `feste Kreatur '${k}' steht ausserhalb der Bbox`);
    }
  }
  const lage = (was: string, x: any, ort: [number, number] | undefined) => {
    const r = nachId.get(x.region);
    if (!r) meldeG(x.region, `${was} '${x.id}' nennt eine Region, die es nicht gibt`);
    else if (ort && !drin(r, ort)) meldeG(x.region, `${was} '${x.id}' liegt ausserhalb der Bbox`);
  };
  for (const f of fragmente) lage('Fragment', f, f.ort);
  for (const o of orte) lage('Ort', o, o.ort);
  for (const r of regenten) lage('Regent', r, r.ort);
  for (const a of auftraege) {
    lage('Auftrag', a, undefined);
    const g = orte.find((o: any) => o.id === a.geber);
    if (g && g.region !== a.region) meldeA(a.id, `Geber '${a.geber}' steht in '${g.region}', nicht in '${a.region}'`);
    const f = a.ziel.art === 'finde' ? fragmente.find((x: any) => x.id === a.ziel.fragment) : null;
    if (f && f.region !== a.region) meldeA(a.id, `Fundstück '${f.id}' liegt in '${f.region}'`);
  }
  console.log(`  ✓ ${regionen.length} Regionen gegen Kreaturen, Regenten, Nachbarn und Bbox geprüft`);
}

// Rückkehr nach der Heilung (D241): nur Arten, die es gibt.
for (const r of regenten) for (const n of r.nachHeilung ?? [])
  if (!kreaturIds.has(n.kreatur)) meldeR(r.id, `Rückkehrer '${n.kreatur}' gibt es nicht`);

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
// Je Region gegen ihre eigene Welt (ADR-0014): Bis zum Fahlmoos stand hier fest `oental.json`, und ein
// Ort im Moor maß seinen Wandabstand gegen Häuser 5 km weiter südlich.
const alleOrte = orte;
for (const region of regionen) for (const orte of [alleOrte.filter((o: any) => o.region === region.id)])
if (orte.length && existsSync(`public/world/${region.id}.json`)) {
  const welt = JSON.parse(readFileSync(`public/world/${region.id}.json`, 'utf8')).welt;
  const M = 111_000, MO = 111_000 * Math.cos((region.bbox[0] + region.bbox[2]) / 2 * Math.PI / 180);
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
  // Ein Bewohner steht vor dem Haus, nicht darin (D145) — geprüft, seit das Hilfsskript dafür in
  // `.cache/` verloren ging und der erste Fahlmoos-Bewohner auf dem Hüttenmittelpunkt stand (D248).
  for (const o of orte.filter((x: any) => x.art === 'bewohner')) {
    const naehe = welt.gebaeude.map((g: any) => g.punkte.map(([la, lo]: number[]) => [(lo - o.ort[1]) * MO, -(la - o.ort[0]) * M]))
      .filter((P: number[][]) => P.some(q => Math.hypot(q[0], q[1]) < 60));
    if (naehe.some((P: number[][]) => innen([0, 0], P))) {
      console.log(`  ✗ ${o.id}: Bewohner steht im Grundriss`);
      auftragsfehler++;
    }
  }
  const schlimmster = nachbarn.reduce((a, b) => (b.n > a.n ? b : a));
  console.log(`  ✓ ${region.id}: ${orte.length} Orte freistehend: höchstens ${schlimmster.n} Nachbargebäude `
    + `im 70-m-Umkreis (${schlimmster.id}), ${nachbarn.filter(x => x.n === 0).length} ganz allein`);
}

/**
 * Lage der Enklave, Flut und Wege (Story-Bibel v2 §3–§5, D375).
 *
 * Alles hier misst gegen das Höhenraster der Region. Die Schwellen sind Entwurfsregeln aus der Story-Bibel, keine
 * Spielwerte: Sie entscheiden nicht, was im Spiel passiert, sondern ob die Ortsliste noch zu dem passt, was
 * entschieden wurde.
 */
{
  /** Reinkultur-Orte: Mindestabstand zur Enklave und zur Regionsmitte (Spielstart), Story-Bibel v2 §4 / D375. */
  const REINKULTUR_FERN = 900;
  /** „In drei Himmelsrichtungen“: Zwei Reinkultur-Orte liegen von der Enklave aus mindestens so weit auseinander. */
  const REINKULTUR_WINKEL = 45;
  /** Der Abendweg (D177) ist eine Gerade durch alles, was im Weg steht — länger soll sie nicht sein. */
  const ABENDWEG_MAX = 150;
  const meldeL = (was: string) => { console.log(`  ✗ ${was}`); auftragsfehler++; };
  for (const region of regionen) {
    if (!existsSync(`public/world/${region.id}.json`)) continue;
    const welt = JSON.parse(readFileSync(`public/world/${region.id}.json`, 'utf8')).welt;
    const [sued, west, nord, ost] = region.bbox as number[];
    const n: number = welt.aufloesung;
    const roh = Buffer.from(welt.hoehenB64, 'base64');
    const breite = (ost - west) * 111_320 * Math.cos((sued + nord) / 2 * Math.PI / 180), tiefe = (nord - sued) * 111_320;
    /** Wie `nachMetern` (`src/data/inhalte.ts`) und `weltZuRaster` (`src/world/terrain.ts`). */
    const meter = ([lat, lon]: number[]): [number, number] =>
      [((lon - west) / (ost - west) - 0.5) * breite, ((nord - lat) / (nord - sued) - 0.5) * tiefe];
    const hoehe = (ort: number[]) => {
      const [x, z] = meter(ort);
      const i = Math.max(0, Math.min(n - 1, Math.round((z / tiefe + 0.5) * (n - 1))));
      const j = Math.max(0, Math.min(n - 1, Math.round((x / breite + 0.5) * (n - 1))));
      return roh.readInt16LE((i * n + j) * 2) / 10;
    };
    const weite = (a: number[], b: number[]) => { const p = meter(a), q = meter(b); return Math.hypot(p[0] - q[0], p[1] - q[1]); };
    const hiesige = alleOrte.filter((o: any) => o.region === region.id);

    // Tagesroutine: Ziel gibt es, ist ein Bewohner derselben Region, und der Weg ist kurz.
    for (const o of hiesige.filter((x: any) => x.abends)) {
      const zielOrt = hiesige.find((x: any) => x.id === o.abends);
      if (!zielOrt || zielOrt.art !== 'bewohner') meldeL(`${o.id}: Abendziel '${o.abends}' ist kein Bewohner in ${region.id}`);
      else if (weite(o.ort, zielOrt.ort) > ABENDWEG_MAX)
        meldeL(`${o.id}: Abendweg ${weite(o.ort, zielOrt.ort).toFixed(0)} m zu '${o.abends}' — höchstens ${ABENDWEG_MAX} m`);
    }

    const flut: number | undefined = region.flutlinie;
    if (flut !== undefined) {
      if (flut <= welt.hoeheMin || flut >= welt.hoeheMax) meldeL(`${region.id}: Flutlinie ${flut} m liegt ausserhalb des Geländes`);
      // Wer wohnt oder rastet, tut es über dem Wasser.
      const nass = hiesige.filter((o: any) => hoehe(o.ort) <= flut);
      nass.forEach((o: any) => meldeL(`${o.id}: liegt auf ${hoehe(o.ort)} m unter der Flutlinie ${flut} m`));
      const unter = welt.gebaeude.filter((g: any) => hoehe(g.punkte[0]) < flut).length;
      if (!nass.length) console.log(`  ✓ ${region.id}: Flutlinie ${flut} m — ${hiesige.length} Orte darüber, ${unter} von ${welt.gebaeude.length} Gebäuden darunter`);
    }

    const enklave = region.enklave;
    if (enklave) {
      if (flut !== undefined && hoehe(enklave.ort) <= flut + 3) meldeL(`${region.id}: Enklave „${enklave.name}“ liegt nicht über der Flut`);
      // Keine Nabe (Story-Struktur v1): nicht die Mehrheit der Enklaven-Bewohner in einem 80-m-Kreis.
      const nah = hiesige.filter((o: any) => o.art === 'bewohner' && weite(o.ort, enklave.ort) < 600);
      const dichtester = Math.max(0, ...nah.map((a: any) => nah.filter((b: any) => weite(a.ort, b.ort) <= 80).length));
      if (nah.length >= 4 && dichtester > nah.length / 2) meldeL(`${region.id}: ${dichtester} von ${nah.length} Enklaven-Bewohnern in einem 80-m-Kreis — das ist eine Nabe`);
      // Reinkulturen: fern von Enklave und Start, und nicht alle in einer Richtung.
      const regent = regenten.find((r: any) => r.id === region.regent);
      const stellen: { k: string; ort: number[] }[] = [];
      for (const k of regent?.reinkulturen ?? []) {
        const a = auftraege.find((x: any) => k in x.belohnung && x.ziel.art === 'finde');
        const f = a && fragmente.find((x: any) => x.id === a.ziel.fragment);
        if (f) stellen.push({ k, ort: f.ort });
      }
      const peil = (ort: number[]) => { const p = meter(ort), e = meter(enklave.ort); return Math.atan2(p[0] - e[0], -(p[1] - e[1])) * 180 / Math.PI; };
      for (const st of stellen) {
        const zurEnklave = weite(st.ort, enklave.ort), zumStart = Math.hypot(...meter(st.ort));
        if (zurEnklave < REINKULTUR_FERN || zumStart < REINKULTUR_FERN)
          meldeL(`${region.id}: Reinkultur '${st.k}' liegt ${zurEnklave.toFixed(0)} m von der Enklave und ${zumStart.toFixed(0)} m vom Start — mindestens ${REINKULTUR_FERN} m`);
      }
      for (let i = 0; i < stellen.length; i++) for (let j = i + 1; j < stellen.length; j++) {
        const d = Math.abs(((peil(stellen[i].ort) - peil(stellen[j].ort) + 540) % 360) - 180);
        if (d < REINKULTUR_WINKEL) meldeL(`${region.id}: Reinkulturen '${stellen[i].k}' und '${stellen[j].k}' liegen in derselben Richtung (${d.toFixed(0)}°)`);
      }
      console.log(`  ✓ ${region.id}: Enklave „${enklave.name}“ auf ${hoehe(enklave.ort)} m, ${nah.length} Bewohner (dichtester 80-m-Kreis: ${dichtester}), ${stellen.length} Reinkultur-Orte: `
        + stellen.map(st => `${st.k} ${weite(st.ort, enklave.ort).toFixed(0)} m/${((peil(st.ort) + 360) % 360).toFixed(0)}°`).join(', '));
    }

    // Verborgene Orte: Die Kreatur lebt hier, das Fundstück gibt es, und kein Auftrag zeigt darauf.
    for (const v of region.verborgeneOrte ?? []) {
      const [lat, lon] = v.ort;
      if (lat < sued || lat > nord || lon < west || lon > ost) meldeL(`${region.id}: verborgener Ort '${v.id}' liegt ausserhalb der Bbox`);
      if (!region.kreaturen.includes(v.verhaerteter)) meldeL(`${region.id}: verborgener Ort '${v.id}' nennt '${v.verhaerteter}', das hier nicht lebt`);
      const f = v.fragment ? fragmente.find((x: any) => x.id === v.fragment) : undefined;
      if (v.fragment && !f) meldeL(`${region.id}: verborgener Ort '${v.id}' nennt ein Fundstück '${v.fragment}', das es nicht gibt`);
      if (f && weite(f.ort, v.ort) > 30) meldeL(`${region.id}: Fundstück '${f.id}' liegt ${weite(f.ort, v.ort).toFixed(0)} m vom verborgenen Ort '${v.id}'`);
      const verraeter = auftraege.find((a: any) => a.ziel.art === 'finde' && a.ziel.fragment === v.fragment);
      if (verraeter) meldeL(`${region.id}: Auftrag '${verraeter.id}' zeigt auf den verborgenen Ort '${v.id}' — dann ist er nicht verborgen`);
    }
    if (region.verborgeneOrte?.length) console.log(`  ✓ ${region.id}: ${region.verborgeneOrte.length} verborgene Orte, von keinem Auftrag genannt`);

    // Wanderfiguren: Bedingungen zeigen auf Vorhandenes; unter der Flutlinie steht niemand, solange der Regent staut.
    const hiesigeFiguren = wanderfiguren.filter((f: any) => f.region === region.id);
    for (const f of hiesigeFiguren) {
      let trocken = false;          // ab hier ist der Regent sicher besiegt
      for (const st of f.stationen) {
        for (const b of [st.ab, st.bis].filter(Boolean)) {
          if (b.art === 'finde' && !fragmente.some((x: any) => x.id === b.fragment && x.region === region.id)) meldeL(`Wanderfigur '${f.id}': Fundstück '${b.fragment}' gibt es in ${region.id} nicht`);
          if ((b.art === 'regent' || b.art === 'heile') && b.regent !== region.regent) meldeL(`Wanderfigur '${f.id}': Regent '${b.regent}' ist nicht der von ${region.id}`);
          if (b.art === 'auftrag' && !auftraege.some((x: any) => x.id === b.auftrag)) meldeL(`Wanderfigur '${f.id}': Auftrag '${b.auftrag}' gibt es nicht`);
        }
        const [lat, lon] = st.ort;
        if (lat < sued || lat > nord || lon < west || lon > ost) meldeL(`Wanderfigur '${f.id}': Station „${st.wo}“ liegt ausserhalb der Bbox`);
        if (st.ab && (st.ab.art === 'regent' || st.ab.art === 'heile')) trocken = true;
        if (flut !== undefined && !trocken && hoehe(st.ort) <= flut) meldeL(`Wanderfigur '${f.id}': Station „${st.wo}“ liegt auf ${hoehe(st.ort)} m unter der Flutlinie, bevor das Wasser sinkt`);
        // Im Grundriss stünde sie in der Wand.
        const drin = welt.gebaeude.some((g: any) => { const q: number[][] = g.punkte; let c = false;
          for (let i = 0; i < q.length - 1; i++) { const [y1, x1] = q[i], [y2, x2] = q[i + 1];
            if ((y1 > lat) !== (y2 > lat) && lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1) c = !c; }
          return c; });
        if (drin) meldeL(`Wanderfigur '${f.id}': Station „${st.wo}“ steht im Grundriss`);
        if (st.bis && (st.bis.art === 'regent' || st.bis.art === 'heile')) trocken = true;
      }
    }
    if (enklave) for (const fr of ['enklave', 'moenche', 'erbe'])
      if (hiesigeFiguren.filter((f: any) => f.fraktion === fr).length !== 1) meldeL(`${region.id}: genau eine Wanderfigur der Fraktion '${fr}' erwartet (Story-Bibel v2 §5)`);
    if (hiesigeFiguren.length) console.log(`  ✓ ${region.id}: ${hiesigeFiguren.length} Wanderfiguren mit ${hiesigeFiguren.reduce((a: number, f: any) => a + f.stationen.length, 0)} Stationen`);

    // Lehrstrecken (D381, D390): Lage, Verweise, Lektionen. Schwellen sind Entwurfsregeln wie oben, keine Spielwerte.
    /** So nah an der Station liegen ihr Fundstück und ihre Zuflucht (Fundradius 9 m, Ortsradius 7 m, dazu Spielraum). */
    const STATION_NAH = 40;
    for (const s of strecken.filter((x: any) => x.region === region.id)) {
      const meldeS = (was: string) => meldeL(`Strecke '${s.id}': ${was}`);
      const imGrundriss = ([lat, lon]: number[]) => welt.gebaeude.some((g: any) => { const q: number[][] = g.punkte; let c = false;
        for (let i = 0; i < q.length - 1; i++) { const [y1, x1] = q[i], [y2, x2] = q[i + 1];
          if ((y1 > lat) !== (y2 > lat) && lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1) c = !c; }
        return c; });
      const ziel = hiesige.find((o: any) => o.id === s.ankunft.bewohner);
      if (!ziel || ziel.art !== 'bewohner') meldeS(`Ankunft '${s.ankunft.bewohner}' ist kein Bewohner in ${region.id}`);
      else if (enklave && weite(ziel.ort, enklave.ort) > 600) meldeS(`Ankunft '${ziel.id}' liegt ${weite(ziel.ort, enklave.ort).toFixed(0)} m von der Enklave — das ist nicht die Enklave`);
      if (!hiesige.some((o: any) => o.id === s.ankunft.zuflucht && o.art === 'zuflucht')) meldeS(`Ankunfts-Zuflucht '${s.ankunft.zuflucht}' gibt es in ${region.id} nicht`);
      if (weite(s.start.ort, s.stationen[0].ort) > STATION_NAH) meldeS(`die erste Station liegt ${weite(s.start.ort, s.stationen[0].ort).toFixed(0)} m vom Start`);
      const gelehrt = new Set<string>();
      let davor = Infinity, luftlinie = 0;
      s.stationen.forEach((st: any, i: number) => {
        const wo = `Station „${st.name}“`;
        const [lat, lon] = st.ort;
        if (lat < sued || lat > nord || lon < west || lon > ost) meldeS(`${wo} liegt ausserhalb der Bbox`);
        if (flut !== undefined && hoehe(st.ort) <= flut) meldeS(`${wo} liegt auf ${hoehe(st.ort)} m unter der Flutlinie`);
        if (imGrundriss(st.ort)) meldeS(`${wo} steht im Grundriss`);
        // Jede Station führt näher ans Ziel — sonst ist es keine Strecke, sondern eine Liste von Orten.
        if (ziel) { const d = weite(st.ort, ziel.ort); if (d >= davor) meldeS(`${wo} liegt nicht näher an der Ankunft als die Station davor`); davor = d; }
        if (i > 0) luftlinie += weite(s.stationen[i - 1].ort, st.ort);
        st.lehrt.forEach((l: string) => gelehrt.add(l));
        const arten = st.gegner.map((g: any) => gegnerDaten.find((x: any) => x.id === g.art));
        st.gegner.forEach((g: any, k: number) => {
          if (!arten[k]) meldeS(`${wo}: Gegner '${g.art}' gibt es nicht in content/gegner`);
          else if (!arten[k].linien && !arten[k].mensch) meldeS(`${wo}: '${g.art}' ist der Platzhalter ohne Körperbau, kein Gegner für die Welt`);
        });
        // Die Marke greift nur bei Befallenen (D385): Reinigen lernt man an einem Tier.
        if (st.lehrt.includes('reinigen') && !arten.some((a: any) => a && !a.mensch)) meldeS(`${wo} lehrt Reinigen, hat aber kein Tier`);
        const kampf = ['leichter-angriff', 'ausdauer', 'rolle', 'block', 'parade', 'lock-on', 'haltung', 'reinigen'];
        if (st.lehrt.some((l: string) => kampf.includes(l)) && !st.gegner.length) meldeS(`${wo} lehrt eine Kampfhandlung ohne Gegner`);
        if (st.lehrt.includes('lock-on') && st.gegner.reduce((a: number, g: any) => a + g.anzahl, 0) < 2) meldeS(`${wo} lehrt den Zielwechsel an weniger als zwei Gegnern`);
        if (st.lehrt.includes('rast') && !st.zuflucht) meldeS(`${wo} lehrt die Rast ohne Zuflucht`);
        if (st.fragment) {
          const f = fragmente.find((x: any) => x.id === st.fragment && x.region === region.id);
          if (!f) meldeS(`${wo}: Fundstück '${st.fragment}' gibt es in ${region.id} nicht`);
          else if (weite(f.ort, st.ort) > STATION_NAH) meldeS(`${wo}: Fundstück '${f.id}' liegt ${weite(f.ort, st.ort).toFixed(0)} m entfernt`);
          if ((region.verborgeneOrte ?? []).some((v: any) => v.fragment === st.fragment)) meldeS(`${wo} zeigt auf das Fundstück eines verborgenen Orts`);
        }
        if (st.zuflucht) {
          const z = hiesige.find((o: any) => o.id === st.zuflucht && o.art === 'zuflucht');
          if (!z) meldeS(`${wo}: Zuflucht '${st.zuflucht}' gibt es in ${region.id} nicht`);
          else if (weite(z.ort, st.ort) > STATION_NAH) meldeS(`${wo}: Zuflucht '${z.id}' liegt ${weite(z.ort, st.ort).toFixed(0)} m entfernt`);
        }
      });
      const fehlt = LEKTIONEN.filter(l => !gelehrt.has(l));
      if (fehlt.length) meldeS(`lehrt nicht: ${fehlt.join(', ')}`);
      if (ziel) luftlinie += weite(s.stationen[s.stationen.length - 1].ort, ziel.ort);
      console.log(`  ✓ ${region.id}: Strecke „${s.name}“ — ${s.stationen.length} Stationen, ${luftlinie.toFixed(0)} m von Station zu Station bis zur Ankunft, `
        + `${s.stationen.reduce((a: number, st: any) => a + st.gegner.reduce((b: number, g: any) => b + g.anzahl, 0), 0)} Gegner, ${gelehrt.size} von ${LEKTIONEN.length} Lektionen`);
    }
  }
  for (const f of wanderfiguren) if (!regionen.some((r: any) => r.id === f.region)) meldeL(`Wanderfigur '${f.id}' nennt eine Region, die es nicht gibt`);
  for (const s of strecken) if (!regionen.some((r: any) => r.id === s.region)) meldeL(`Strecke '${s.id}' nennt eine Region, die es nicht gibt`);
}

const zufluchten = orte.filter((o: any) => o.art === 'zuflucht').length;
for (const r of regionen) if (!orte.some((o: any) => o.art === 'zuflucht' && o.region === r.id)) {
  console.log(`  ✗ ${r.id}: keine Zuflucht — dann bleibt die Niederlage der beste Weg zu vollen KP`);
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
