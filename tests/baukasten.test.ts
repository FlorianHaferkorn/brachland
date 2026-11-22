/**
 * BRACHLAND — Waffen-Baukasten (D403). Das Wichtigste zuerst: Der Referenzbau jeder Familie ergibt
 * die heutige Waffe **exakt** — jede Zahl aus `content/waffen/*.json`, bitgleich. Danach die Physik:
 * längerer Hebel ist langsamer und reicht weiter, mehr Masse kostet mehr, Material ist die alte Stufe.
 */
import { readFileSync } from 'node:fs';
import { Waffenbaukasten, WaffenDaten, Gegenstand } from '../src/data/schema.js';
import { WAFFEN } from '../src/kampf/echtzeit.js';
import { schadenFaktor } from '../src/spiel/schmiede.js';
import { alleBauten, bauPreis, faktoren, koerper, leiteAb, referenzBau, regelWaffe, type Familie } from '../src/kampf/baukasten.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++; console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}
const lies = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const k = Waffenbaukasten.parse(lies('content/waffenteile.json'));
const FAMILIEN: Familie[] = ['klinge', 'axt', 'speer'];
const grund = Object.fromEntries(FAMILIEN.map(f => [f, WaffenDaten.parse(lies(`content/waffen/${f}.json`))])) as Record<Familie, WaffenDaten>;

// --- Rückwärtskompatibilität: Referenzbau = heutige Waffe, exakt
for (const f of FAMILIEN) {
  const ref = referenzBau(k, f);
  const fa = faktoren(k, f, ref);
  pruefe(`${f}: alle Faktoren des Referenzbaus sind genau 1`, [fa.zeit, fa.drehZeit, fa.energie, fa.impuls, fa.schaden, fa.haltungsschaden, fa.kosten, fa.nachdrehen]
    .every(x => x === 1) && fa.reichweite === 0, JSON.stringify(fa));
  const ab = leiteAb(k, grund[f], ref);
  pruefe(`${f}: Referenzbau ergibt die Datei content/waffen/${f}.json bitgleich`, JSON.stringify(ab) === JSON.stringify(grund[f]));
  pruefe(`${f}: Referenzbau ergibt WAFFEN.${f} der Kampfregeln bitgleich`, JSON.stringify(regelWaffe(ab)) === JSON.stringify(WAFFEN[f]));
}

// --- Physik: Körper in echten Einheiten
const kl = koerper(k, 'klinge', k.familien.klinge.referenz), ax = koerper(k, 'axt', k.familien.axt.referenz), sp = koerper(k, 'speer', k.familien.speer.referenz);
pruefe('Klinge wiegt wie ein Einhandschwert (1,0–1,3 kg)', kl.masse >= 1.0 && kl.masse <= 1.3, `${kl.masse}`);
pruefe('Axt wiegt 1,6–2,2 kg, Speer 1,2–2,0 kg', ax.masse >= 1.6 && ax.masse <= 2.2 && sp.masse >= 1.2 && sp.masse <= 2.0, `${ax.masse} / ${sp.masse}`);
pruefe('die Axt ist kopflastiger als die Klinge', ax.schwerpunkt > kl.schwerpunkt && ax.traegheit > kl.traegheit);
pruefe('der Speer hat die grösste Trägheit', sp.traegheit > ax.traegheit);

// --- Physik: Richtung jeder Ableitung (ohne den Spielausgleich aus D407 — der ist ausdrücklich keine Physik)
const kPhysik = structuredClone(k);
for (const f of FAMILIEN) for (const t of [...kPhysik.familien[f].kopf, ...kPhysik.familien[f].schaft]) t.ausgleich = 1;
const bau = (f: Familie, kopf: string, schaft: string) => ({ ...referenzBau(k, f), kopf, schaft });
const axLang = faktoren(kPhysik, 'axt', bau('axt', 'spaltkopf', 'lang')), axKurz = faktoren(kPhysik, 'axt', bau('axt', 'spaltkopf', 'kurz'));
pruefe('langer Stiel: langsamer, weiter, härter, teurer', axLang.zeit > 1 && axLang.reichweite > 0 && axLang.haltungsschaden > 1 && axLang.kosten > 1 && axLang.nachdrehen < 1);
pruefe('kurzer Stiel: das Gegenteil', axKurz.zeit < 1 && axKurz.reichweite < 0 && axKurz.haltungsschaden < 1 && axKurz.kosten < 1 && axKurz.nachdrehen > 1);
pruefe('Reichweite folgt dem Stiel in Metern (0,2 m Stiel × 0,85 vor der Hand)', Math.abs(axLang.reichweite - 0.17) < 1e-9, `${axLang.reichweite}`);
const leicht = faktoren(kPhysik, 'axt', bau('axt', 'bartaxt', 'mittel')), schwer = faktoren(kPhysik, 'axt', bau('axt', 'breitbeil', 'mittel'));
pruefe('leichter Kopf ist schneller und billiger, schwerer langsamer und teurer', leicht.zeit < 1 && leicht.kosten < 1 && schwer.zeit > 1 && schwer.kosten > 1);
pruefe('schwerer Kopf trägt mehr Wucht', schwer.impuls > 1 && leicht.impuls < 1);
const hammer = faktoren(kPhysik, 'axt', bau('axt', 'hammerkopf', 'mittel'));
pruefe('Hammerkopf tauscht Schneide gegen Wucht', hammer.schaden < 1 && hammer.haltungsschaden > 1);
const spLang = faktoren(kPhysik, 'speer', bau('speer', 'saufeder', 'lang'));
pruefe('langer Speer: der Stoss kaum langsamer, die Erholung deutlich', spLang.zeit < 1.03 && spLang.drehZeit > 1.05 && spLang.reichweite > 0.2);
const ab = leiteAb(kPhysik, grund.speer, bau('speer', 'saufeder', 'lang'));
pruefe('Stoss: Vorlauf mit der Stosszeit, Erholung mit der Drehzeit', Math.abs(ab.leicht[0].vorlauf / grund.speer.leicht[0].vorlauf - spLang.zeit) < 1e-12
  && Math.abs(ab.leicht[0].erholung / grund.speer.leicht[0].erholung - spLang.drehZeit) < 1e-12);
const knauf = faktoren(kPhysik, 'klinge', bau('klinge', 'gerade', 'knaufschwer'));
pruefe('schwerer Knauf: wendiger, kaum langsamer, teurer', knauf.nachdrehen > 1.05 && knauf.zeit < 1.01 && knauf.kosten > 1);

// --- Was an der Animation hängt, bleibt unberührt
for (const f of FAMILIEN) for (const b of alleBauten(k, f)) {
  const w = leiteAb(k, grund[f], b);
  const gleich = [...w.leicht, w.schwer, w.lauf].every((s, i) => {
    const g = [...grund[f].leicht, grund[f].schwer, grund[f].lauf][i];
    return s.aktiv === g.aktiv && s.halbwinkelGrad === g.halbwinkelGrad && s.clip === g.clip && s.linie === g.linie
      && s.schritt === g.schritt && s.hieb.scheitel === g.hieb.scheitel && s.hieb.durchzug === g.hieb.durchzug && s.name === g.name;
  });
  if (!gleich) { pruefe(`${f} ${b.kopf}+${b.schaft}: Aktivfenster, Bogen, Clip, Linie, Schritt unverändert`, false); break; }
}
pruefe('kein Bau ändert Aktivfenster, Bogen, Clip, Linie oder Schritt', gefallen === 0);
pruefe('jeder abgeleitete Bau besteht das Waffenschema', FAMILIEN.every(f => alleBauten(k, f).every(b => WaffenDaten.safeParse(leiteAb(k, grund[f], b)).success)));

// --- Der Spielraum bleibt im Band, das die Clips vertragen (Entwurf: ±25 % Tempo, ±0,35 m)
const alle = FAMILIEN.flatMap(f => alleBauten(k, f).map(b => ({ f, b, fa: faktoren(k, f, b) })));
pruefe('33 Kombinationen Kopf × Schaft', alle.length === 33, `${alle.length}`);
pruefe('Tempo aller Bauten innerhalb ±25 %', alle.every(x => x.fa.zeit > 0.75 && x.fa.zeit < 1.25 && x.fa.drehZeit > 0.75 && x.fa.drehZeit < 1.25),
  alle.filter(x => !(x.fa.drehZeit > 0.75 && x.fa.drehZeit < 1.25)).map(x => `${x.f} ${x.b.kopf}+${x.b.schaft} ${x.fa.drehZeit.toFixed(2)}`).join(', '));
pruefe('Reichweite aller Bauten innerhalb ±0,35 m', alle.every(x => Math.abs(x.fa.reichweite) <= 0.35));

// --- Material ist die alte Waffenstufe, Härtung verschiebt nur
for (const m of k.material) pruefe(`Material ${m.id}: Güte = Schmiedefaktor der Stufe ${m.stufe} (D177)`, Math.abs(m.guete - schadenFaktor(m.stufe)) < 1e-12);
const mitMat = faktoren(k, 'klinge', { ...referenzBau(k, 'klinge'), material: 'federstahl' });
pruefe('Material hebt Schaden und Haltungsschaden, sonst nichts', mitMat.schaden === 1.24 && mitMat.haltungsschaden === 1.24 && mitMat.zeit === 1 && mitMat.kosten === 1 && mitMat.reichweite === 0);
pruefe('Härtung hebt die Summe nicht', k.haertung.every(h => Math.abs(h.schneide + h.wucht - 2) < 1e-9));

// --- Ausgleich je Teil (D407): Spielausgleich auf Schaden und Haltungsschaden, sonst nichts; die Referenz trägt keinen
const roh = lies('content/waffenteile.json');
for (const f of FAMILIEN) {
  const fam = k.familien[f];
  pruefe(`${f}: Referenzteile tragen den Ausgleich 1`, [...fam.kopf.filter(t => t.id === fam.referenz.kopf), ...fam.schaft.filter(t => t.id === fam.referenz.schaft)]
    .every(t => t.ausgleich === 1));
  for (const b of alleBauten(k, f)) {
    if (b.kopf === fam.referenz.kopf && b.schaft === fam.referenz.schaft) continue;
    const mit = faktoren(k, f, b);
    const ohneK = structuredClone(k);
    for (const t of [...ohneK.familien[f].kopf, ...ohneK.familien[f].schaft]) t.ausgleich = 1;
    const ohne = faktoren(ohneK, f, b);
    const a = fam.kopf.find(t => t.id === b.kopf)!.ausgleich * fam.schaft.find(t => t.id === b.schaft)!.ausgleich;
    const ok = Math.abs(mit.schaden / ohne.schaden - a) < 1e-12 && Math.abs(mit.haltungsschaden / ohne.haltungsschaden - a) < 1e-12
      && mit.zeit === ohne.zeit && mit.drehZeit === ohne.drehZeit && mit.kosten === ohne.kosten && mit.reichweite === ohne.reichweite
      && mit.nachdrehen === ohne.nachdrehen && mit.impuls === ohne.impuls;
    if (!ok) { pruefe(`${f} ${b.kopf}+${b.schaft}: Ausgleich wirkt nur auf Schaden und Haltungsschaden`, false); break; }
  }
}
pruefe('Ausgleich wirkt nur auf Schaden und Haltungsschaden (alle Formen)', gefallen === 0);
const falsch = structuredClone(roh);
falsch.familien.klinge.kopf.find((t: { id: string }) => t.id === 'gerade').ausgleich = 1.1;
pruefe('Schema lehnt einen Ausgleich am Referenzteil ab', !Waffenbaukasten.safeParse(falsch).success);
const zuViel = structuredClone(roh);
zuViel.familien.axt.kopf.find((t: { id: string }) => t.id === 'hammerkopf').ausgleich = 1.6;
pruefe('Schema hält den Ausgleich in 0,7–1,4', !Waffenbaukasten.safeParse(zuViel).success);

// --- Preise und Gegenstände
const ids = new Set(['chitinspan', 'federstahl', 'haertling', 'kernschlacke', 'zunder', 'schafgarbe']);
const allePreise = [...FAMILIEN.flatMap(f => [...k.familien[f].kopf, ...k.familien[f].schaft].map(t => t.preis)), ...k.material.map(m => m.preis)];
pruefe('jeder Preis nennt vorhandene Gegenstände', allePreise.every(p => Object.keys(p).every(g => ids.has(g)
  && Gegenstand.safeParse(lies(`content/gegenstaende/${g}.json`)).success)));
const refPreis = bauPreis(k, 'klinge', referenzBau(k, 'klinge')), bestPreis = bauPreis(k, 'klinge', { ...referenzBau(k, 'klinge'), material: 'haertlingsschneide' });
pruefe('der Referenzbau ist der billigste Weg zu einer Waffe', Object.values(refPreis).reduce((a, b) => a + b, 0) <= 6, JSON.stringify(refPreis));
pruefe('die beste Güte kostet drei Härtlinge (D393: drei Verhärtete)', bestPreis.haertling === 3);
pruefe('Zeug: vier Grundstücke, je ein Gegenstand der Art zeug', k.zeug.grundstuecke.length === 4
  && k.zeug.grundstuecke.every(g => Gegenstand.parse(lies(`content/gegenstaende/${g.gegenstand}.json`)).wirkung.art === 'zeug'));

console.log(`\n${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
