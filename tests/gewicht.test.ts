/**
 * BRACHLAND — Gewicht spürbar machen (D420): `src/kampf/gewicht.ts` gegen `content/gewicht.json`.
 *
 * Geprüft wird, dass die Darstellung der Masse folgt (schwerer → längerer Stopp, stärkerer Kamerastoss, tieferer
 * Ton, weiterer Nachschwung), dass sie die Baukasten-Physik wiederverwendet statt neu erfindet (Schlagzeit
 * ∝ (I_Arm + I)^⅓ wie `faktoren`), dass die Werte in ihren Grenzen bleiben und dass **kein Kampfwert** sich ändert.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { Gewicht, Waffenbaukasten, Waffenfamilienplan } from '../src/data/schema.js';
import { WAFFEN } from '../src/kampf/echtzeit.js';
import { alleBauten, faktoren, koerper } from '../src/kampf/baukasten.js';
import {
  GEWICHT, kameraErlitten, kameraGesetzt, nachschwung, reaktion, schlagRichtung, schlagWucht, schwung, toene,
  trefferBild, trefferImpuls, trefferstopp, waffenkoerper, zielMasse, type Waffenkoerper,
} from '../src/kampf/gewicht.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}
const lies = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const nah = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;

// ---- Daten
const g = Gewicht.safeParse(lies('content/gewicht.json'));
pruefe('gewicht.json passt zum Schema', g.success, g.success ? '' : g.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; '));
const k = Waffenbaukasten.parse(lies('content/waffenteile.json'));
const plan = Waffenfamilienplan.parse(lies('content/waffenfamilien.json'));
const kapitel1 = ['klinge', 'axt', 'speer', 'hirschfaenger', 'kriegsmesser'];
for (const id of kapitel1) pruefe(`Kapitel-1-Waffe ${id} hat einen Körper`, !!GEWICHT.waffen[id]);
for (const id of Object.keys(GEWICHT.waffen)) pruefe(`${id} ist eine Waffenfamilie`, plan.familien.some(f => f.id === id));
const gegner = readdirSync('content/gegner').filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
for (const id of Object.keys(GEWICHT.ziele.je)) pruefe(`Ziel ${id} ist ein Gegner`, gegner.includes(id));
for (const id of gegner) pruefe(`Gegner ${id} hat eine Masse`, id in GEWICHT.ziele.je);

// ---- Baukasten wiederverwendet: dieselben Körper, dieselbe Proportion der Schlagzeit
for (const fam of ['klinge', 'axt', 'speer'] as const) {
  const w = waffenkoerper(fam), b = koerper(k, fam, k.familien[fam].referenz);
  pruefe(`${fam}: Masse und Trägheit aus dem Referenzbau`, nah(w.masse, b.masse) && nah(w.traegheit, b.traegheit), `${w.masse} ${b.masse}`);
  const anker = plan.familien.find(f => f.id === fam)!.anker.masse;
  const ankerKg = Number(anker.match(/[\d,]+/)![0].replace(',', '.'));
  // D407: Seit D421 steht im Anker auch die Masse des Modells („Modell 2,10 kg“); der Referenzbau trägt sie (Axt, Speer)
  // oder die reale Angabe davor (Klinge 1,1 kg; Modell 1,21 kg).
  const modell = anker.match(/Modell ([\d,]+) kg/);
  const modellKg = modell ? Number(modell[1].replace(',', '.')) : NaN;
  pruefe(`${fam}: Masse ${w.masse.toFixed(2)} kg = Anker ${anker}`, nah(w.masse, ankerKg, 0.005) || nah(w.masse, modellKg, 0.005));
  const ref = schwung(w);
  for (const bau of alleBauten(k, fam)) {
    const kb = koerper(k, fam, bau);
    if (kb.kraft !== 1) continue;   // die Kraft eines Teils kennt nur der Baukasten
    const wb: Waffenkoerper = { ...w, masse: kb.masse, traegheit: kb.traegheit, kopfAbstand: kb.kopfAbstand, spitze: kb.spitze };
    const soll = faktoren(k, fam, bau).zeit;
    pruefe(`${fam} ${bau.kopf}/${bau.schaft}: Schlagzeit wie der Baukasten (×${soll.toFixed(3)})`, nah(schwung(wb).zeit / ref.zeit, soll, 1e-9));
  }
}

// ---- Physik plausibel (D398): Grössenordnung echter Hiebe, Reihenfolge nach Masse und Trägheit
const ids = ['hirschfaenger', 'klinge', 'speer', 'kriegsmesser', 'axt'];
const s = Object.fromEntries(ids.map(id => [id, schwung(waffenkoerper(id))]));
pruefe('Klingenspitze 10–25 m/s', s.klinge.spitzeTempo > 10 && s.klinge.spitzeTempo < 25, s.klinge.spitzeTempo.toFixed(1));
pruefe('Axtkopf 8–20 m/s', s.axt.spitzeTempo > 8 && s.axt.spitzeTempo < 20, s.axt.spitzeTempo.toFixed(1));
pruefe('Speerstoss 3–10 m/s', s.speer.tempo > 3 && s.speer.tempo < 10, s.speer.tempo.toFixed(1));
pruefe('Schlagzeit aus voller Leistung 0,1–0,3 s', ids.every(id => s[id].zeit > 0.1 && s[id].zeit < 0.3), ids.map(id => s[id].zeit.toFixed(3)).join(' '));
for (let i = 1; i < ids.length; i++) {
  pruefe(`Impuls ${ids[i - 1]} < ${ids[i]}`, s[ids[i - 1]].impuls < s[ids[i]].impuls,
    `${s[ids[i - 1]].impuls.toFixed(2)} / ${s[ids[i]].impuls.toFixed(2)}`);
}
pruefe('Die Axt holt langsamer aus als die Klinge, die Hirschfänger-Klinge schneller', s.axt.zeit > s.klinge.zeit && s.hirschfaenger.zeit < s.klinge.zeit);
pruefe('Bremszeit der Axt > Messer > Klinge > Hirschfänger', s.axt.bremszeit > s.kriegsmesser.bremszeit
  && s.kriegsmesser.bremszeit > s.klinge.bremszeit && s.klinge.bremszeit > s.hirschfaenger.bremszeit);

// ---- Trefferstopp
const t = GEWICHT.trefferstopp;
pruefe('Trefferstopp wächst mit dem Impuls', trefferstopp(5) < trefferstopp(10) && trefferstopp(10) < trefferstopp(20));
pruefe('Trefferstopp unten und oben begrenzt', nah(trefferstopp(0), t.min) && nah(trefferstopp(1000), t.max));
pruefe('Haltungsbruch verlängert, Block halbiert, tödlich darf über max',
  trefferstopp(8, { gebrochen: true }) > trefferstopp(8) && nah(trefferstopp(8, { geblockt: true }), trefferstopp(8) * t.geblockt)
  && nah(trefferstopp(1000, { toedlich: true }), t.max + t.toedlich));
const alleSchlaege: [string, string, number][] = [];
for (const [art, w] of Object.entries(WAFFEN)) for (const sch of [...w.leicht, w.schwer, w.lauf]) {
  const J = trefferImpuls(art, schlagWucht(sch, w.leicht[0]));
  alleSchlaege.push([art, sch.name ?? '?', trefferstopp(J)]);
}
pruefe('Jeder Schlag der Regel zwischen min und max', alleSchlaege.every(([, , x]) => x >= t.min - 1e-12 && x <= t.max + 1e-12));
const stopp = (art: string, name: string) => alleSchlaege.find(x => x[0] === art && x[1] === name)![2];
pruefe('Der Spalthieb hält am längsten an', stopp('axt', 'Spalthieb') === Math.max(...alleSchlaege.map(x => x[2])));
pruefe('Klingenhieb kürzer als heute (60 ms), Axthieb länger', stopp('klinge', 'Hieb') < 0.06 && stopp('axt', 'Axthieb') > 0.06,
  `${stopp('klinge', 'Hieb')} / ${stopp('axt', 'Axthieb')}`);
pruefe('Schwerer Schlag jeder Waffe hält länger an als ihr erster leichter',
  Object.entries(WAFFEN).every(([art, w]) => stopp(art, w.schwer.name!) > stopp(art, w.leicht[0].name!)));
pruefe('Wucht ohne Kampfwerte = 1', schlagWucht() === 1 && schlagWucht({ haltungsschaden: 10 }) === 1);

// ---- Kamera
const c = GEWICHT.kamera;
pruefe('Kamerastoss wächst mit dem Impuls und klingt länger aus',
  kameraGesetzt(15, null).staerke > kameraGesetzt(5, null).staerke && kameraGesetzt(15, null).abklingen > kameraGesetzt(5, null).abklingen);
pruefe('Kamerastoss begrenzt', nah(kameraGesetzt(1e4, null).staerke, c.gesetzt.max) && nah(kameraGesetzt(1e4, null).abklingen, c.abklingen.max));
pruefe('Erlitten stösst stärker als ein leichter eigener Treffer (wie D171)', kameraErlitten(10).staerke > kameraGesetzt(s.klinge.impuls, null).staerke);
pruefe('Richtung: Hieb von rechts zieht nach links, von oben nach unten, Stoss nach vorn',
  schlagRichtung('rechts', 'schwung')[0] === -1 && schlagRichtung('oben', 'schwung')[1] === -1 && schlagRichtung('rechts', 'stoss')[2] === 1);
pruefe('Ohne Richtung nur Zittern', kameraGesetzt(10, null).anteil === 0 && kameraGesetzt(10, [1, 0, 0]).anteil === c.richtung);

// ---- Reaktion des Getroffenen: Δv = J / m
pruefe('Masse aus den Daten, sonst Standard', zielMasse('keiler') === GEWICHT.ziele.je.keiler && zielMasse('niemand') === GEWICHT.ziele.standard);
const rw = reaktion(s.axt.impuls, 'wolf'), rk = reaktion(s.axt.impuls, 'keiler');
pruefe('Axt wirft den Wolf weiter als den Keiler', rw.dv > rk.dv && rw.neigung > rk.neigung && rw.versatz > rk.versatz);
pruefe('Δv = Impuls / Masse', nah(rk.dv, s.axt.impuls / GEWICHT.ziele.je.keiler));
pruefe('Ein Klingenhieb bewegt den Keiler kaum (< 3°)', reaktion(s.klinge.impuls, 'keiler').neigung < 3);
pruefe('Taumeln nur nach Haltungsbruch, schwerer weiter', reaktion(10, 'wolf').taumel === 0
  && reaktion(20, 'wolf', true).taumel > reaktion(5, 'wolf', true).taumel);
pruefe('Reaktion begrenzt', reaktion(1e4, 'fuchs').neigung === GEWICHT.reaktion.neigungMax && reaktion(1e4, 'fuchs').versatz === GEWICHT.reaktion.versatzMax);

// ---- Ton
const tk = toene('klinge'), ta = toene('axt'), th = toene('hirschfaenger');
pruefe('Referenzwaffe: Tonhöhe 1', nah(tk.schwung.tonhoehe, 1) && nah(tk.treffer.tonhoehe, 1));
pruefe('Schwerer trifft tiefer und lauter', ta.treffer.tonhoehe < tk.treffer.tonhoehe && tk.treffer.tonhoehe < th.treffer.tonhoehe
  && ta.treffer.pegel > tk.treffer.pegel && tk.treffer.pegel > th.treffer.pegel);
pruefe('Pegel 0…1', ids.every(id => { const x = toene(id); return [x.schwung.pegel, x.treffer.pegel].every(p => p >= 0 && p <= 1); }));

// ---- Nachschwung im Clip
const n = Object.fromEntries(ids.map(id => [id, nachschwung(id)]));
pruefe('Nachschwung: Axt > Messer > Klinge > Hirschfänger (Grad)', n.axt.winkel > n.kriegsmesser.winkel
  && n.kriegsmesser.winkel > n.klinge.winkel && n.klinge.winkel > n.hirschfaenger.winkel);
pruefe('Halt im Clip wächst mit der Masse, höchstens haltMax', n.axt.halt > n.kriegsmesser.halt && n.kriegsmesser.halt > n.hirschfaenger.halt
  && ids.every(id => n[id].halt <= GEWICHT.clips.haltMax));
pruefe('Ein Stoss hat keinen Winkel', n.speer.winkel === 0);

// ---- Kein Kampfwert ändert sich
const vorher = JSON.stringify(WAFFEN);
const bild = trefferBild({ waffe: 'axt', wucht: 1.5, ziel: 'keiler', linie: 'oben', gebrochen: true });
pruefe('trefferBild lässt WAFFEN unberührt', JSON.stringify(WAFFEN) === vorher);
pruefe('trefferBild: Stopp, Kamera, Reaktion, Ton gefüllt', bild.stopp > 0 && bild.kamera.staerke > 0 && bild.reaktion.taumel > 0 && bild.ton.pegel > 0);
const geblockt = trefferBild({ waffe: 'axt', ziel: 'keiler', geblockt: true });
pruefe('Geblockt: kein Versatz des Ziels, halber Stopp', geblockt.reaktion.dv === 0 && geblockt.stopp < trefferBild({ waffe: 'axt', ziel: 'keiler' }).stopp);
for (const id of ['klinge', 'axt', 'speer']) {
  pruefe(`content/waffen/${id}.json ist die Regel (WAFFEN.${id})`, lies(`content/waffen/${id}.json`).leicht[0].vorlauf === (WAFFEN as Record<string, { leicht: { vorlauf: number }[] }>)[id].leicht[0].vorlauf);
}

console.log(`\nGewicht — ${ids.map(id => `${id} ${s[id].impuls.toFixed(1)} N·s / ${(trefferstopp(s[id].impuls) * 1000).toFixed(0)} ms`).join(', ')}`);
console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
