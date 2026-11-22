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
  const kopf = z.match(/^ {4}'(\w+)': \((?:'\w+'|KLINGE_BASIS), '(\w+)', \[/);
  if (kopf) { jetzt = kopf[1]; clips.set(jetzt, { art: kopf[2], bilder: [] }); continue; }
  const bild = z.match(/^ {8}\((\d+), /);
  if (bild && jetzt) clips.get(jetzt)!.bilder.push(Number(bild[1]));
  if (/^\}/.test(z)) jetzt = null;
}
pruefe('waffenclips.py: Clips gefunden', clips.size >= 7, `${clips.size}`);

// ---- menschbau.py baut genau diese Clips mit
const mb = readFileSync('tools/menschbau.py', 'utf8').match(/ANIM_WAFFEN = \(([^)]*)\)/);
const mbNamen = mb ? [...mb[1].matchAll(/'(\w+)'/g)].map(m => m[1]).sort() : [];
pruefe('menschbau.ANIM_WAFFEN = waffenclips.CLIPS', mbNamen.join(',') === [...clips.keys()].sort().join(','),
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
    const kopf = z.match(/^ {4}'(\w+)': \((?:'\w+'|KLINGE_BASIS), '(\w+)', \[/);
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
pruefe('D414: sieben neue Clips (sechs Messer, ein Gerät)', neueClips.length === 7, neueClips.join(','));
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
  if (n !== 'Messer_Schwer') {
    const h = feld(k.get(s), 'huefte')?.[0] ?? 0;
    pruefe(`${n}: Hüfte führt (huefte ${h} in Richtung der Drehung ${rS} → ${rD})`, h !== 0 && Math.sign(h) === Math.sign(rD - rS));
    pruefe(`${n}: breiter Bogen — der Rumpf dreht ≥ 60° vom Scheitel zum Durchzug`, Math.abs(rD - rS) >= 60, `${rD - rS}`);
  }
  // Masse (1,4 kg, 0,23 kg·m² um die Hand): holt länger aus als die Klinge, nicht länger als die Axt.
  if (n === 'Messer_Schwer') {
    pruefe(`${n}: Ausholen zwischen leichtem Messerhieb und Spalthieb der Axt (${s})`, s > 9 && s <= axtSchwer, `${axtSchwer}`);
  } else if (n !== 'Messer_Lauf') {
    pruefe(`${n}: Ausholen länger als die Klinge (${klingeLeicht}), höchstens wie die Axt (${axtQuer}): ${s}`,
      s > klingeLeicht && s <= axtQuer);
  }
  // Sobald eine Waffe den Clip trägt, muss ihre Regel dieselben Bilder nennen.
  for (const [art, w] of Object.entries(WAFFEN)) for (const sch of [...w.leicht, w.schwer, w.lauf]) {
    if (sch.clip === n) pruefe(`${art}/${sch.name}: hieb = TREFFER ${n}`, Math.abs((sch.hieb?.scheitel ?? -1) * 24 - s) < 1e-6 && Math.abs((sch.hieb?.durchzug ?? -1) * 24 - d) < 1e-6);
  }
}
// Ausgeliefert: Clips der Hauptfigur, Modelle, Daten.
if (existsSync('public/figuren/held/held-clips.glb')) {
  const held = new Set(animationen('public/figuren/held/held-clips.glb'));
  const fehlt = neueClips.filter(n => !held.has(n));
  pruefe('held-clips.glb trägt alle neuen Clips', fehlt.length === 0, fehlt.join(', '));
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
  const fehlt = gebraucht.filter(n => !drin.has(n));
  pruefe('jeder gebrauchte Clip steckt in der Waffendatei', fehlt.length === 0, fehlt.join(', '));
}
const figur = animationen('public/figuren/wanderin.glb');
pruefe('die Wanderin trägt keine Waffenclips (Budget)', !figur.some(n => /^(Klinge|Axt|Kampf)_/.test(n)), figur.join(', '));
pruefe('die Wanderin trägt die Rückfälle Sword_Slash und Axe_Overhead',
  figur.includes('Sword_Slash') && figur.includes('Axe_Overhead'));

console.log(`\nWaffenclips — ${clips.size} Clips, ${gebraucht.length} gebraucht`);
console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
