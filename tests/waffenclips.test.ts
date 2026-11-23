/**
 * BRACHLAND — Waffenclips gegen Regeln (D171).
 *
 * Die Zeiten eines Schlags stehen zweimal: in der Regel (`hieb: { scheitel, durchzug }` in
 * `src/kampf/echtzeit.ts`, Clipsekunden) und im Clip (Schlüsselbilder in `tools/waffenclips.py`,
 * 24 je Sekunde). Liegen sie auseinander, holt die Figur noch aus, während der Treffer schon
 * zählt — genau der Fehler, den man im Spiel als „der Schlag trifft, bevor er ankommt" spürt und im
 * Bild nie findet. Dieser Test hält beide Stellen zusammen, und die ausgelieferte Datei dazu.
 */
import { readFileSync, existsSync } from 'node:fs';
import { WAFFEN } from '../src/kampf/echtzeit.js';
import { nachschwung, waffenkoerper } from '../src/kampf/gewicht.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}

// ---- Clips und Schlüsselbilder aus waffenclips.py
const py = readFileSync('tools/waffenclips.py', 'utf8');
const clips = new Map<string, { art: string; bilder: number[] }>();
let jetzt: string | null = null;
for (const z of py.split('\n')) {
  const kopf = z.match(/^ {4}'(\w+)': \((?:'\w+'|KLINGE_BASIS|HIRSCH_BASIS), '(\w+)', \[/);
  if (kopf) { jetzt = kopf[1]; clips.set(jetzt, { art: kopf[2], bilder: [] }); continue; }
  const bild = z.match(/^ {8}\((\d+), /);
  if (bild && jetzt) clips.get(jetzt)!.bilder.push(Number(bild[1]));
  if (/^\}/.test(z)) jetzt = null;
}
pruefe('waffenclips.py: Clips gefunden', clips.size >= 7, `${clips.size}`);

// ---- menschbau.py baut genau diese Clips mit
const mb = readFileSync('tools/menschbau.py', 'utf8').match(/ANIM_WAFFEN = \(([^)]*)\)/);
const mbNamen = mb ? [...mb[1].matchAll(/'(\w+)'/g)].map(m => m[1]).sort() : [];
// D460: dazu die gerechneten Clips der Fortbewegung (`_melde`, `_gang` — sie stehen nicht als Schlüsselbilder in `CLIPS`).
const gerechnet = [...py.matchAll(/^_(?:melde|gang)\('(\w+)'/gm)].map(x => x[1]);
pruefe('D460: vierzehn gerechnete Clips der Fortbewegung', gerechnet.length === 14, gerechnet.join(','));
pruefe('menschbau.ANIM_WAFFEN = waffenclips.CLIPS', mbNamen.join(',') === [...clips.keys(), ...gerechnet].sort().join(','),
  `${mbNamen.join(',')} gegen ${[...clips.keys()].sort().join(',')}`);

// ---- Jede Waffe: Haltung als Schleife, jeder Schlag mit Scheitel und Durchzug auf Schlüsselbildern
const AUS_DEM_PAKET = new Set(['Sword_Slash', 'Axe_Overhead']);
// D173: Clips aus der UAL2 — Länge aus den Bildbereichen in `tools/ual2uebertrag.py`.
const ual2 = new Map<string, number>();
{
  const q = readFileSync('tools/ual2uebertrag.py', 'utf8');
  for (const m of q.matchAll(/'(\w+)':\s*\[([^\]]*)\]/g)) {
    const teile = [...m[2].matchAll(/\('\w+',\s*(\d+),\s*(\d+)\)/g)];
    if (teile.length) ual2.set(m[1], teile.reduce((n, t) => n + (+t[2] - +t[1]), 0));
  }
}
pruefe('ual2uebertrag.py: 7 Clips gefunden', ual2.size === 7, [...ual2.keys()].join(','));
const mu = readFileSync('tools/menschbau.py', 'utf8').match(/ANIM_UAL2 = \(([^)]*)\)/);
pruefe('menschbau.ANIM_UAL2 = ual2uebertrag.CLIPS',
  (mu ? [...mu[1].matchAll(/'(\w+)'/g)].map(m => m[1]).sort().join(',') : '') === [...ual2.keys()].sort().join(','));
const gebraucht: string[] = [];
for (const [art, w] of Object.entries(WAFFEN)) {
  const h = clips.get(w.haltung);
  pruefe(`${art}: Haltung ${w.haltung} ist ein Schleifenclip`, h?.art === 'schleife', h?.art ?? 'fehlt');
  const b = h?.bilder ?? [];
  pruefe(`${art}: Haltung endet, wie sie beginnt`, b.length >= 2 && b[0] === 1, b.join(','));
  gebraucht.push(w.haltung);
  for (const s of [...w.leicht, w.schwer, w.lauf]) {
    if (!s.clip || AUS_DEM_PAKET.has(s.clip)) continue;
    if (ual2.has(s.clip)) {
      gebraucht.push(s.clip);
      const ende = ual2.get(s.clip)!;
      pruefe(`${art}/${s.name}: UAL2-Clip ${s.clip} trägt Scheitel < Durchzug im Clip, danach ≥ 8 Bilder Erholung`,
        !!s.hieb && s.hieb.scheitel < s.hieb.durchzug && ende - s.hieb.durchzug * 24 >= 8, `${ende}`);
      continue;
    }
    gebraucht.push(s.clip);
    const c = clips.get(s.clip);
    pruefe(`${art}/${s.name}: Clip ${s.clip} gebaut`, !!c);
    if (!c || !s.hieb) continue;
    const sb = s.hieb.scheitel * 24, db = s.hieb.durchzug * 24;
    pruefe(`${art}/${s.name}: Scheitel liegt auf einem Schlüssel`, c.bilder.some(x => Math.abs(x - sb) < 1e-6),
      `${sb.toFixed(2)} in ${c.bilder.join(',')}`);
    pruefe(`${art}/${s.name}: Durchzug liegt auf einem Schlüssel`, c.bilder.some(x => Math.abs(x - db) < 1e-6),
      `${db.toFixed(2)} in ${c.bilder.join(',')}`);
    const ende = Math.max(...c.bilder);
    pruefe(`${art}/${s.name}: nach dem Durchzug bleibt Erholung im Clip (≥ 8 Bilder)`, ende - db >= 8, `${ende} - ${db}`);
  }
}

// ---- D414: Langes Messer und Räucherkanne. Es gibt noch keine Kampfwerte (D407 misst) — Scheitel und Durchzug
// stehen deshalb in `TREFFER` in waffenclips.py, und die Physik der Hiebe (D398) wird an den Schlüsseln geprüft.
const schluessel = new Map<string, Map<number, string>>();
{
  let clip: string | null = null, bild = 0;
  for (const z of py.split('\n')) {
    const kopf = z.match(/^ {4}'(\w+)': \((?:'\w+'|KLINGE_BASIS|HIRSCH_BASIS), '(\w+)', \[/);
    if (kopf) { clip = kopf[1]; schluessel.set(clip, new Map()); continue; }
    if (!clip) continue;
    if (/^ {4}\]\),?$/.test(z) || /^\}/.test(z)) { clip = null; continue; }
    const k = z.match(/^ {8}\((\d+), (.*)$/);
    if (k) { bild = Number(k[1]); schluessel.get(clip)!.set(bild, k[2]); continue; }
    if (bild && /^ {9,}\S/.test(z)) schluessel.get(clip)!.set(bild, schluessel.get(clip)!.get(bild) + ' ' + z.trim());
  }
}
const feld = (text: string | undefined, name: string): number[] | null => {
  const m = text?.match(new RegExp(`\\b${name}=\\(([^)]*)\\)`)) ?? text?.match(new RegExp(`\\b${name}=(-?[\\d.]+)`));
  return m ? m[1].split(',').map(Number) : null;
};
const tm = py.match(/^TREFFER = \{([^}]*)\}/m);
const treffer = new Map<string, [number, number]>(
  tm ? [...tm[1].matchAll(/'(\w+)': \((\d+), (\d+)\)/g)].map(m => [m[1], [Number(m[2]), Number(m[3])]]) : []);
pruefe('TREFFER: vier Messerhiebe', ['Messer_Quer_A', 'Messer_Quer_B', 'Messer_Schwer', 'Messer_Lauf'].every(n => treffer.has(n)),
  [...treffer.keys()].join(','));
const neueClips = [...clips.keys()].filter(n => /^(Messer|Geraet)_/.test(n));
// D429: Die Axtclips sind seit D429 aus Schlüsselbildern gebaut (Zweihand-Fällaxt) und stehen mit in `TREFFER`.
const AXTCLIPS = ['Axt_Hieb', 'Axt_Quer', 'Axt_Schwer', 'Axt_Lauf'];
pruefe('D429: TREFFER trägt die vier Axtschläge', AXTCLIPS.every(n => treffer.has(n)), [...treffer.keys()].join(','));
// Hiebe von oben (kein Querbogen) und Hiebe, die am Boden enden (die Beine fangen die Masse statt eines Bremswegs).
const VON_OBEN = new Set(['Messer_Schwer', 'Axt_Hieb', 'Axt_Schwer']);
const AM_BODEN = new Set(['Messer_Schwer', 'Axt_Schwer']);
pruefe('D414: sieben neue Clips (sechs Messer, ein Gerät; dazu seit D460 die Trage-Hut)', neueClips.filter(n => n !== 'Messer_Trage').length === 7, neueClips.join(','));
for (const n of ['Messer_Stand', 'Geraet_Blasebalg']) {
  const b = clips.get(n)?.bilder ?? [];
  pruefe(`${n} ist eine Schleife, die endet, wie sie beginnt`, clips.get(n)?.art === 'schleife' && b[0] === 1 &&
    schluessel.get(n)?.get(1)?.replace(/^dict\(/, '') === schluessel.get(n)?.get(Math.max(...b))?.replace(/^dict\(/, ''));
}
const scheitelVon = (art: string, name: string) => {
  const w = WAFFEN[art as keyof typeof WAFFEN];
  return 24 * ([...w.leicht, w.schwer, w.lauf].find(s => s.name === name)?.hieb?.scheitel ?? NaN);   // Regel in s, Clip in Bildern
};
const klingeLeicht = Math.max(scheitelVon('klinge', 'Hieb'), scheitelVon('klinge', 'Rückhand'));
const axtQuer = scheitelVon('axt', 'Querhieb'), axtSchwer = scheitelVon('axt', 'Spalthieb');
for (const [n, [s, d]] of treffer) {
  const c = clips.get(n), k = schluessel.get(n);
  pruefe(`${n}: gebaut`, !!c && !!k);
  if (!c || !k) continue;
  pruefe(`${n}: Scheitel ${s} und Durchzug ${d} liegen auf Schlüsseln`, c.bilder.includes(s) && c.bilder.includes(d), c.bilder.join(','));
  pruefe(`${n}: nach dem Durchzug ≥ 8 Bilder Erholung`, Math.max(...c.bilder) - d >= 8);
  // Füsse stehen: vom Scheitel bis zum Durchzug dieselben Fusslagen in jedem Schlüssel.
  const imSchlag = c.bilder.filter(b => b >= s && b <= d);
  for (const f of ['fuss_l', 'fuss_r']) {
    const lagen = new Set(imSchlag.map(b => JSON.stringify(feld(k.get(b), f))));
    pruefe(`${n}: ${f} steht vom Scheitel bis zum Durchzug`, lagen.size === 1, [...lagen].join(' | '));
  }
  // Gewicht verlagern: der Körper wandert im Schlag nach vorn.
  const vS = feld(k.get(s), 'koerper')?.[0] ?? 0, vD = feld(k.get(d), 'koerper')?.[0] ?? 0;
  pruefe(`${n}: Gewicht wandert nach vorn (koerper v ${vS} → ${vD})`, vD > vS + 0.1);
  // Die Hüfte führt: Im Scheitel ist das Becken schon in Schlagrichtung gedreht (Querhiebe und Lauf).
  const rS = feld(k.get(s), 'rumpf')?.[0] ?? 0, rD = feld(k.get(d), 'rumpf')?.[0] ?? 0;
  if (!VON_OBEN.has(n)) {
    const h = feld(k.get(s), 'huefte')?.[0] ?? 0;
    pruefe(`${n}: Hüfte führt (huefte ${h} in Richtung der Drehung ${rS} → ${rD})`, h !== 0 && Math.sign(h) === Math.sign(rD - rS));
    pruefe(`${n}: breiter Bogen — der Rumpf dreht ≥ 60° vom Scheitel zum Durchzug`, Math.abs(rD - rS) >= 60, `${rD - rS}`);
  }
  // Masse (1,4 kg, 0,23 kg·m² um die Hand): holt länger aus als die Klinge, nicht länger als die Axt.
  if (n === 'Messer_Schwer') {
    pruefe(`${n}: Ausholen zwischen leichtem Messerhieb und Spalthieb der Axt (${s})`, s > 9 && s <= axtSchwer, `${axtSchwer}`);
  } else if (n !== 'Messer_Lauf' && n.startsWith('Messer_')) {
    pruefe(`${n}: Ausholen länger als die Klinge (${klingeLeicht}), höchstens wie die Axt (${axtQuer}): ${s}`,
      s > klingeLeicht && s <= axtQuer);
  }
  // Sobald eine Waffe den Clip trägt, muss ihre Regel dieselben Bilder nennen.
  for (const [art, w] of Object.entries(WAFFEN)) for (const sch of [...w.leicht, w.schwer, w.lauf]) {
    if (sch.clip === n) pruefe(`${art}/${sch.name}: hieb = TREFFER ${n}`, Math.abs((sch.hieb?.scheitel ?? -1) * 24 - s) < 1e-6 && Math.abs((sch.hieb?.durchzug ?? -1) * 24 - d) < 1e-6);
  }
}
// ---- D420: Nachschwung und Erholung zeigen die Masse (Grundsatz D419). Scheitel, Durchzug und Clipdauer bleiben —
// sie sind die Trefferfenster; geprüft wird nur, was danach kommt. Soll aus `src/kampf/gewicht.ts` `nachschwung`:
// Die Klinge läuft mindestens um ihren Bremsweg weiter (Energie / Bremsmoment), und der letzte Schlüssel vor der
// Rückkehr liegt bei mindestens (0,25 + 0,2 · Masse) der Erholung im Clip.
const istStand = (t: string | undefined) => !t || t.startsWith("'stand'");
const grad = (a: number[], b: number[]) => {
  const d = a.reduce((s, v, i) => s + v * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b));
  return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
};
function nachDemDurchzug(n: string, d: number) {
  const c = clips.get(n)!, k = schluessel.get(n)!;
  const ende = Math.max(...c.bilder);
  const nach = c.bilder.filter(b => b > d && b < ende && !istStand(k.get(b)));
  const r0 = feld(k.get(d), 'richt');
  const winkel = r0 ? Math.max(0, ...nach.map(b => { const r = feld(k.get(b), 'richt'); return r ? grad(r0, r) : 0; })) : 0;
  const letzter = nach.length ? Math.max(...nach) : d;
  return { k, ende, nach, winkel, halt: (letzter - d) / (ende - d) };
}
const MESSER = waffenkoerper('kriegsmesser');
const sollMesser = nachschwung('kriegsmesser');
const sollAxt = nachschwung('axt');
// D429: Spitze der Axt vor dem rechten Handgelenk — 0,35 m bei der rechten Hand an der vorderen Griffstelle
// (`tools/waffenmodelle.py`), dazu, was die Hand zum Stielende gleitet (`griff` −0,62 … −0,11).
const axtSpitze = (text: string | undefined) => 0.35 + 0.62 + (feld(text, 'griff')?.[0] ?? -0.42);
const befund: string[] = [];
for (const [n, [s, d]] of treffer) {
  const b = nachDemDurchzug(n, d);
  const soll = n.startsWith('Axt_') ? sollAxt : sollMesser;
  befund.push(`${n}: ${b.winkel.toFixed(0)}° / ${(b.halt * 100).toFixed(0)} %`);
  const rS = feld(b.k.get(s), 'rumpf')?.[0] ?? 0, rD = feld(b.k.get(d), 'rumpf')?.[0] ?? 0;
  pruefe(`${n}: Nachschwung mit mindestens zwei Schlüsseln (weiterlaufen, halten)`, b.nach.length >= 2, b.nach.join(','));
  if (AM_BODEN.has(n)) {
    // Der Hieb von oben endet am Boden: Die Masse fangen die Beine — das Becken sinkt (E = 43 J ≈ 70 kg · g · 6 cm).
    const hD = feld(b.k.get(d), 'koerper')?.[1] ?? 0;
    const tiefst = Math.min(...b.nach.map(x => feld(b.k.get(x), 'koerper')?.[1] ?? 0));
    pruefe(`${n}: die Beine fangen die Masse (Becken ≥ 4 cm tiefer als im Durchzug)`, tiefst <= hD - 0.04, `${hD} → ${tiefst}`);
  } else {
    pruefe(`${n}: Klinge läuft ≥ ${soll.winkel.toFixed(0)}° weiter (Bremsweg)`, b.winkel >= soll.winkel, b.winkel.toFixed(0));
    // Das Becken bremst: im Nachschwung gegen die Drehung des Schlags gestellt.
    pruefe(`${n}: Hüfte bremst gegen die Drehung`, b.nach.some(x => Math.sign(feld(b.k.get(x), 'huefte')?.[0] ?? 0) === -Math.sign(rD - rS)));
  }
  pruefe(`${n}: Körper folgt der Masse bis ≥ ${(soll.halt * 100).toFixed(0)} % der Erholung`, b.halt >= soll.halt - 1e-9,
    `${(b.halt * 100).toFixed(0)} %`);
  const vD = feld(b.k.get(d), 'koerper')?.[0] ?? 0, vN = feld(b.k.get(b.nach[0]), 'koerper')?.[0] ?? 0;
  pruefe(`${n}: Gewicht bleibt auf dem vorderen Fuss (koerper v ${vD} → ${vN})`, vN >= vD - 0.02);
  for (const f of ['fuss_l', 'fuss_r']) {
    const lagen = new Set([d, ...b.nach].map(x => JSON.stringify(feld(b.k.get(x), f))));
    pruefe(`${n}: ${f} rutscht im Nachschwung nicht`, lagen.size === 1, [...lagen].join(' | '));
  }
  for (const x of b.nach) {
    const h = feld(b.k.get(x), 'hand')?.[2] ?? 1, r = feld(b.k.get(x), 'richt')!;
    const spitze = h + (n.startsWith('Axt_') ? axtSpitze(b.k.get(x)) : MESSER.spitze) * r[2] / Math.hypot(...r);
    pruefe(`${n} Bild ${x}: Spitze über dem Boden (${(spitze * 100).toFixed(0)} cm)`, spitze >= 0.05);
  }
}
// Befund an den Bestandsclips (nicht geändert, D414: ihr Nachbau weicht 10–35 cm ab) — nur gemeldet, Vorschlag in
// `tools/gewichtvorschlag.py`.
console.log(`  D420/D429 Langes Messer (Soll ${sollMesser.winkel.toFixed(0)}° / ${(sollMesser.halt * 100).toFixed(0)} %), Axt (Soll ${sollAxt.winkel.toFixed(0)}° / ${(sollAxt.halt * 100).toFixed(0)} %): ${befund.splice(0).join('; ')}`);
for (const [art, id] of [['axt', 'axt'], ['speer', 'speer'], ['klinge', 'klinge']] as const) {
  const w = WAFFEN[art], soll = nachschwung(id);
  for (const sch of [...w.leicht, w.schwer, w.lauf]) {
    if (!sch.clip || !sch.hieb || !clips.has(sch.clip) || treffer.has(sch.clip) || befund.some(x => x.startsWith(sch.clip + ':'))) continue;
    const b = nachDemDurchzug(sch.clip, Math.round(sch.hieb.durchzug * 24));
    befund.push(`${sch.clip}: Nachschwung ${b.winkel.toFixed(0)}° (Soll ${soll.winkel.toFixed(0)}°), Halt ${(b.halt * 100).toFixed(0)} % (Soll ${(soll.halt * 100).toFixed(0)} %)`);
  }
}
console.log(`  Befund D420 (Bestand, nur gemeldet): ${befund.join('; ')}`);

// ---- D456: Klinge, Hirschfänger und Saufeder aus Schlüsselbildern (Auftrag D455). Scheitel und Durchzug stehen in
// `FENSTER`; geprüft wird wie bei Messer und Axt, was die Schlüssel zeigen müssen — nichts davon lockert `TREFFER`.
const fm = py.match(/^FENSTER = \{([^}]*)\}/m);
const fenster = new Map<string, [number, number]>(
  fm ? [...fm[1].matchAll(/'(\w+)': \((\d+), (\d+)\)/g)].map(m => [m[1], [Number(m[2]), Number(m[3])]]) : []);
pruefe('D456: FENSTER trägt fünf Klingen-, drei Speer- und drei Hirschfängerschläge', fenster.size === 11, [...fenster.keys()].join(','));
const GEWICHT_ID = (n: string) => n.startsWith('Klinge_') ? 'klinge' : n.startsWith('Hirsch_') ? 'hirschfaenger' : 'speer';
const STOSS = (n: string) => /_(Stich|Stoss|Weit|Lauf)$/.test(n) && !n.startsWith('Messer_') && !n.startsWith('Axt_');
const befund456: string[] = [];
for (const [n, [s, d]] of fenster) {
  const c = clips.get(n), k = schluessel.get(n);
  pruefe(`${n}: gebaut`, !!c && !!k);
  if (!c || !k) continue;
  const soll = nachschwung(GEWICHT_ID(n));
  pruefe(`${n}: Scheitel ${s} und Durchzug ${d} liegen auf Schlüsseln`, c.bilder.includes(s) && c.bilder.includes(d), c.bilder.join(','));
  pruefe(`${n}: nach dem Durchzug ≥ 8 Bilder Erholung`, Math.max(...c.bilder) - d >= 8);
  const imSchlag = c.bilder.filter(b => b >= s && b <= d);
  for (const f of ['fuss_l', 'fuss_r']) {
    const lagen = new Set(imSchlag.map(b => JSON.stringify(feld(k.get(b), f))));
    pruefe(`${n}: ${f} steht vom Scheitel bis zum Durchzug`, lagen.size === 1, [...lagen].join(' | '));
  }
  const vS = feld(k.get(s), 'koerper')?.[0] ?? 0, vD = feld(k.get(d), 'koerper')?.[0] ?? 0;
  pruefe(`${n}: Gewicht wandert nach vorn (koerper v ${vS} → ${vD}, ≥ 8 cm)`, vD >= vS + 0.08);
  // Ausholen als Gegenbewegung: Vor dem Scheitel liegt das Gewicht hinter dem des Durchzugs, und die Hand ist zurück.
  const handS = feld(k.get(s), 'hand')!, handD = feld(k.get(d), 'hand')!;
  const rS = feld(k.get(s), 'rumpf')?.[0] ?? 0, rD = feld(k.get(d), 'rumpf')?.[0] ?? 0;
  const h = feld(k.get(s), 'huefte')?.[0] ?? 0;
  pruefe(`${n}: Hüfte führt (huefte ${h} in Richtung der Drehung ${rS} → ${rD})`, h !== 0 && Math.sign(h) === Math.sign(rD - rS));
  const b = nachDemDurchzug(n, d);
  pruefe(`${n}: nach dem Durchzug mindestens zwei Schlüssel (weiterlaufen oder halten, dann lösen)`, b.nach.length >= 2, b.nach.join(','));
  pruefe(`${n}: Körper folgt der Masse bis ≥ ${(soll.halt * 100).toFixed(0)} % der Erholung`, b.halt >= soll.halt - 1e-9, `${(b.halt * 100).toFixed(0)} %`);
  const vN = feld(b.k.get(b.nach[0]), 'koerper')?.[0] ?? 0;
  pruefe(`${n}: Gewicht bleibt auf dem vorderen Fuss (koerper v ${vD} → ${vN})`, vN >= vD - 0.02);
  for (const f of ['fuss_l', 'fuss_r']) {
    const lagen = new Set([d, ...b.nach].map(x => JSON.stringify(feld(b.k.get(x), f))));
    pruefe(`${n}: ${f} rutscht im Nachschwung nicht`, lagen.size === 1, [...lagen].join(' | '));
  }
  if (STOSS(n)) {
    // Stoss: gerade nach vorn (Waffe ≤ 10° neben der Stossrichtung), die Hand ≥ 40 cm vor, danach gestreckt gehalten.
    const rD3 = feld(k.get(d), 'richt')!;
    pruefe(`${n}: Stoss geradeaus (Waffe ${grad(rD3, [0, 1, 0]).toFixed(0)}° neben vorn ≤ 10°)`, grad(rD3, [0, 1, 0]) <= 10);
    pruefe(`${n}: die Hand stösst ≥ 40 cm vor (${handS[1]} → ${handD[1]})`, handD[1] - handS[1] >= 0.4);
    const hN = feld(b.k.get(b.nach[0]), 'hand')!;
    pruefe(`${n}: gestreckt gehalten, nicht sofort zurück (Hand im ersten Schlüssel danach ${hN[1]} ≥ ${handD[1]})`, hN[1] >= handD[1] - 1e-9);
    if (n.startsWith('Speer_')) {
      // Meyer: beide Hände am Schaft, die hintere führt — sie stösst den Schaft durch die vordere (griff sinkt).
      const gS = feld(k.get(s), 'griff')?.[0] ?? 0.5, gD = feld(k.get(d), 'griff')?.[0] ?? 0.5;
      pruefe(`${n}: die hintere Hand stösst den Schaft durch die vordere (griff ${gS} → ${gD})`, gS >= 0.5 && gD <= 0.25);
    }
  } else {
    pruefe(`${n}: der Rumpf dreht ≥ 40° vom Scheitel zum Durchzug oder klappt ≥ 25° vor`,
      Math.abs(rD - rS) >= 40 || (feld(k.get(d), 'rumpf')?.[1] ?? 0) - (feld(k.get(s), 'rumpf')?.[1] ?? 0) >= 25, `${rD - rS}`);
    if (n === 'Klinge_Schwer') {
      const hD = feld(b.k.get(d), 'koerper')?.[1] ?? 0, tiefst = Math.min(...b.nach.map(x => feld(b.k.get(x), 'koerper')?.[1] ?? 0));
      pruefe(`${n}: die Beine fangen die Masse (Becken ≥ 4 cm tiefer als im Durchzug)`, tiefst <= hD - 0.04, `${hD} → ${tiefst}`);
    } else {
      pruefe(`${n}: Klinge läuft ≥ ${soll.winkel.toFixed(0)}° weiter (Bremsweg)`, b.winkel >= soll.winkel, b.winkel.toFixed(0));
      pruefe(`${n}: Hüfte bremst gegen die Drehung`, b.nach.some(x => Math.sign(feld(b.k.get(x), 'huefte')?.[0] ?? 0) === -Math.sign(rD - rS)));
    }
    for (const x of b.nach) {
      const hh = feld(b.k.get(x), 'hand')?.[2] ?? 1, r = feld(b.k.get(x), 'richt')!;
      const spitze = hh + waffenkoerper(GEWICHT_ID(n)).spitze * r[2] / Math.hypot(...r);
      pruefe(`${n} Bild ${x}: Spitze über dem Boden (${(spitze * 100).toFixed(0)} cm)`, spitze >= 0.05);
    }
  }
  befund456.push(`${n}: ${b.winkel.toFixed(0)}° / ${(b.halt * 100).toFixed(0)} % (Soll ${soll.winkel.toFixed(0)}° / ${(soll.halt * 100).toFixed(0)} %)`);
  for (const [art, w] of Object.entries(WAFFEN)) for (const sch of [...w.leicht, w.schwer, w.lauf]) {
    if (sch.clip === n) pruefe(`${art}/${sch.name}: hieb = FENSTER ${n}`, Math.abs((sch.hieb?.scheitel ?? -1) * 24 - s) < 1e-6 && Math.abs((sch.hieb?.durchzug ?? -1) * 24 - d) < 1e-6);
  }
}
console.log(`  D456 Nachschwung / Halt: ${befund456.join('; ')}`);
// Linker Fuss vor in jeder Hut (alle Quellen: Liechtenauer, Lecküchner, Meyer — Waffenbewegungen §5 Nr. 6).
for (const hut of ['Klinge_Stand', 'Speer_Stand', 'Messer_Stand', 'Axt_Stand', 'Hirsch_Stand']) {
  const t = schluessel.get(hut)?.get(1);
  const l = feld(t, 'fuss_l')?.[0] ?? 0, r = feld(t, 'fuss_r')?.[0] ?? 0;
  pruefe(`${hut}: linker Fuss vor (fuss_l ${l} > fuss_r ${r}, ≥ 20 cm)`, l - r >= 0.2);
}
// Die Regel der Klinge spielt die eigenen Clips, nicht mehr die UAL2-Hiebe mit ganzer Drehung (§5 Nr. 7).
for (const sch of [...WAFFEN.klinge.leicht, WAFFEN.klinge.schwer, WAFFEN.klinge.lauf]) {
  pruefe(`klinge/${sch.name}: Clip ${sch.clip} aus Schlüsselbildern (kein Klinge_U_*)`, !!sch.clip && clips.has(sch.clip) && !ual2.has(sch.clip));
}

// Ausgeliefert: Clips der Hauptfigur, Modelle, Daten.
if (existsSync('public/figuren/held/held-clips.glb')) {
  const held = new Set(animationen('public/figuren/held/held-clips.glb'));
  const fehlt = [...clips.keys()].filter(n => !held.has(n));
  pruefe('held-clips.glb trägt alle Clips aus waffenclips.py (D414, D429, D456)', fehlt.length === 0, fehlt.join(', '));
  pruefe('D429: held-clips.glb trägt Axe_Overhead nicht mehr (ersetzt durch Axt_Hieb)', !held.has('Axe_Overhead'));
}
{
  const buf = readFileSync('public/figuren/kampf/waffen.glb');
  const g = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
  const knoten = new Set((g.nodes ?? []).map((n: { name: string }) => n.name));
  for (const m of ['Klinge', 'Axt', 'Hirschfaenger', 'Messer', 'Raeucherkanne']) pruefe(`waffen.glb: Modell ${m}`, knoten.has(m));
  const familien = JSON.parse(readFileSync('content/waffenfamilien.json', 'utf8')).familien as { id: string; clips: { vorhanden: string[]; fehlen: string[] } }[];
  const messer = familien.find(f => f.id === 'kriegsmesser');
  pruefe('waffenfamilien: Langes Messer führt alle Messer-Clips als vorhanden, keine fehlen',
    !!messer && neueClips.filter(n => n.startsWith('Messer_')).every(n => messer.clips.vorhanden.includes(n)) && messer.clips.fehlen.length === 0);
  const kanne = (JSON.parse(readFileSync('content/geraete.json', 'utf8')) as { id: string; clips: { vorhanden: string[] } }[])
    .find(x => x.id === 'raeucherkanne');
  pruefe('geraete: Räucherkanne führt Geraet_Blasebalg als vorhanden', !!kanne?.clips.vorhanden.includes('Geraet_Blasebalg'));
}

// ---- Die ausgelieferten Dateien
function animationen(pfad: string): string[] {
  const buf = readFileSync(pfad);
  const g = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
  return (g.animations ?? []).map((a: { name: string }) => a.name);
}
const WAFFENDATEI = 'public/figuren/kampf/wanderin-waffen.glb';
pruefe('Waffenclips-Datei ist da', existsSync(WAFFENDATEI));
if (existsSync(WAFFENDATEI)) {
  const drin = new Set(animationen(WAFFENDATEI));
  // D429: `Axt_Hieb` gibt es nur für die Hauptfigur (`held-clips.glb`, oben geprüft) — die alte Wanderin (`?figur=alt`)
  // hat keine Quelle mehr (D414) und schlägt mit ihrem `Axe_Overhead` (Rückfall in `RegionsSzene`, unten geprüft).
  // D456: ebenso die eigenen Klingenhiebe (statt der UAL2-Clips, die in beiden Dateien bleiben) — die alte Wanderin fällt
  // auf `Sword_Slash` zurück.
  const NUR_HELD = new Set(['Axt_Hieb', 'Klinge_Hieb_A', 'Klinge_Hieb_B', 'Klinge_Schwer', 'Klinge_Lauf']);
  const fehlt = gebraucht.filter(n => !drin.has(n) && !NUR_HELD.has(n));
  pruefe('jeder gebrauchte Clip steckt in der Waffendatei', fehlt.length === 0, fehlt.join(', '));
}
const figur = animationen('public/figuren/wanderin.glb');
pruefe('die Wanderin trägt keine Waffenclips (Budget)', !figur.some(n => /^(Klinge|Axt|Kampf)_/.test(n)), figur.join(', '));
pruefe('die Wanderin trägt die Rückfälle Sword_Slash und Axe_Overhead',
  figur.includes('Sword_Slash') && figur.includes('Axe_Overhead'));

console.log(`\nWaffenclips — ${clips.size} Clips, ${gebraucht.length} gebraucht`);
console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
