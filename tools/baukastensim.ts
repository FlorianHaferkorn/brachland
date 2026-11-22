/**
 * BRACHLAND — Baukasten-Messung (D403): jede Kombination Kopf × Schaft durch den Kampfbot.
 *
 * Leitet aus `content/waffenteile.json` jede Waffe ab (`src/kampf/baukasten.ts`), setzt sie für die
 * Dauer der Messung an die Stelle der Familienwaffe und lässt den Kampfbot (D171) gegen die fünf
 * Tiere kämpfen, drei Profile, dieselbe Saat für jede Kombination. Die Daten der drei Waffen bleiben
 * unberührt: Getauscht wird nur der Eintrag in `WAFFEN` in diesem Prozess, und er wird zurückgesetzt.
 *
 *   npx tsx tools/baukastensim.ts [kämpfe=60] [familie|alle] [material|-] [reinigen]
 *
 * Mit `reinigen` spielt der Bot „immer reinigen“ (D376) statt zu töten: Dann zählt, wie oft das Tier
 * gereinigt statt versehentlich getötet wird — die Frage „was baut der Heiler?“.
 *
 * Messwerkzeug, nicht im Gate. Tabelle in `docs/design/BRACHLAND_Waffen-Baukasten_v1.md` §4.
 */
import { readFileSync } from 'node:fs';
import { Waffenbaukasten, WaffenDaten } from '../src/data/schema.js';
import { WAFFEN, type WaffenArt } from '../src/kampf/echtzeit.js';
import { alleBauten, faktoren, koerper, leiteAb, referenzBau, regelWaffe, type Bau, type Familie } from '../src/kampf/baukasten.js';
import { kampf, GEGNER, PROFILE } from './kampfbot.js';

const lies = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const k = Waffenbaukasten.parse(lies('content/waffenteile.json'));
const n = Number(process.argv[2] ?? 60);
const wahl = process.argv[3] ?? 'alle';
const materialId = process.argv[4] && process.argv[4] !== '-' ? process.argv[4] : undefined;
const REINIGEN_MODUS = process.argv.includes('reinigen');
const TIERE = ['keiler', 'grathorn', 'wolf', 'fuchs', 'gams'];
const SAAT = 7000;

export interface Messung { familie: Familie; bau: Bau; referenz: boolean; siege: number; zeit: number; erlitten: number;
  /** Nur im Modus `reinigen`: Anteil der Tiere, die gereinigt statt getötet wurden. */
  gereinigt?: number;
  jeProfil: Record<string, { siege: number; zeit: number; erlitten: number }> }

/** Eine Kombination gegen alle Tiere und Profile. Zeit nur über gewonnene Kämpfe. */
export function messe(familie: Familie, bau: Bau, kaempfe: number): Messung {
  const grund = WaffenDaten.parse(lies(`content/waffen/${familie}.json`));
  const vorher = WAFFEN[familie as WaffenArt];
  WAFFEN[familie as WaffenArt] = regelWaffe(leiteAb(k, grund, bau));
  const jeProfil: Messung['jeProfil'] = {};
  let siege = 0, zeit = 0, erlitten = 0, alle = 0, rein = 0, tot = 0;
  try {
    for (const p of PROFILE) {
      let ps = 0, pz = 0, pe = 0, pn = 0;
      for (const tier of TIERE) for (let i = 0; i < kaempfe; i++) {
        const e = REINIGEN_MODUS ? kampf(GEGNER[tier], familie as WaffenArt, p, SAAT + i, undefined, 1, undefined, { modus: 'immer' })
          : kampf(GEGNER[tier], familie as WaffenArt, p, SAAT + i);
        rein += e.gereinigt ?? 0; tot += e.getoetet ?? 0;
        pn++; pe += e.erlitten; if (e.sieg) { ps++; pz += e.zeit; }
      }
      jeProfil[p.name] = { siege: ps / pn, zeit: ps ? pz / ps : NaN, erlitten: pe / pn };
      siege += ps; zeit += pz; erlitten += pe; alle += pn;
    }
  } finally { WAFFEN[familie as WaffenArt] = vorher; }
  const ref = referenzBau(k, familie);
  return { familie, bau, referenz: bau.kopf === ref.kopf && bau.schaft === ref.schaft && bau.material === ref.material && bau.haertung === ref.haertung,
    siege: siege / alle, zeit: siege ? zeit / siege : NaN, erlitten: erlitten / alle, jeProfil,
    ...(REINIGEN_MODUS ? { gereinigt: rein + tot ? rein / (rein + tot) : 0 } : {}) };
}

/** A schlägt B, wenn A nirgends schlechter und irgendwo deutlich besser ist (über dem Rauschen). */
export function schlaegt(a: Pick<Messung, 'siege' | 'zeit' | 'erlitten'>, b: Pick<Messung, 'siege' | 'zeit' | 'erlitten'>, rauschen = { siege: 0.02, zeit: 0.03, erlitten: 1 }): boolean {
  const nichtSchlechter = a.siege >= b.siege - rauschen.siege && a.zeit <= b.zeit * (1 + rauschen.zeit) && a.erlitten <= b.erlitten + rauschen.erlitten;
  const besser = a.siege > b.siege + rauschen.siege || a.zeit < b.zeit * (1 - rauschen.zeit) || a.erlitten < b.erlitten - rauschen.erlitten;
  return nichtSchlechter && besser;
}

if (process.argv[1]?.endsWith('baukastensim.ts')) {
  const familien = (wahl === 'alle' ? ['klinge', 'axt', 'speer'] : [wahl]) as Familie[];
  console.log(`Baukasten-Messung: ${n} Kämpfe je Tier und Profil (${TIERE.length} Tiere × ${PROFILE.length} Profile = ${n * TIERE.length * PROFILE.length} je Kombination), Saat ${SAAT}…${REINIGEN_MODUS ? ', Bot reinigt immer' : ''}${materialId ? `, Material ${materialId}` : ''}\n`);
  for (const familie of familien) {
    const bauten = alleBauten(k, familie, materialId);
    const ref = referenzBau(k, familie);
    // Härtung nur am Referenzbau: sie verschiebt ±4 % und braucht nicht das ganze Raster.
    if (!materialId) for (const h of k.haertung) if (h.id !== ref.haertung) bauten.push({ ...ref, haertung: h.id });
    // Material am Referenzbau: reiner Faktor auf Schaden und Haltungsschaden, eine Zeile je Güte genügt.
    if (!materialId) for (const m of k.material) if (m.id !== ref.material) bauten.push({ ...ref, material: m.id });
    const zeilen = bauten.map(b => messe(familie, b, n));
    const r = zeilen.find(z => z.referenz) ?? zeilen[0];
    console.log(`### ${familie} (Referenz: ${ref.kopf} + ${ref.schaft})\n`);
    console.log('| Kopf | Schaft | Härtung | Masse | Trägheit | Reichweite | Tempo | Schaden | Haltung | Kosten | Siege | Zeit | gegen Ref. | erlitten | aufm. / müde / par. Siege | Befund |' + (REINIGEN_MODUS ? ' gereinigt |' : ''));
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|' + (REINIGEN_MODUS ? '---|' : ''));
    for (const z of zeilen) {
      const f = faktoren(k, familie, z.bau), kp = koerper(k, familie, z.bau);
      const gleiche = zeilen.filter(x => x.bau.material === z.bau.material);
      const geschlagenVon = gleiche.filter(a => a !== z && schlaegt(a, z)).length;
      const schlaegtAndere = gleiche.filter(b => b !== z && schlaegt(z, b)).length;
      const befund = z.referenz ? 'Referenz' : z.bau.material !== ref.material ? 'Materialgüte' : geschlagenVon >= gleiche.length / 2 ? `**nutzlos** (von ${geschlagenVon} geschlagen)`
        : schlaegtAndere >= gleiche.length / 2 ? `**dominant** (schlägt ${schlaegtAndere})` : geschlagenVon ? `von ${geschlagenVon} geschlagen` : schlaegtAndere ? `schlägt ${schlaegtAndere}` : 'gleichauf';
      const pz = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)} %`;
      console.log(`| ${z.bau.kopf} | ${z.bau.schaft} | ${z.bau.haertung}${z.bau.material !== ref.material ? ' · ' + z.bau.material : ''} | ${kp.masse.toFixed(2)} kg | ${kp.traegheit.toFixed(2)} | ${f.reichweite >= 0 ? '+' : ''}${f.reichweite.toFixed(2)} m | ${pz(f.zeit - 1)} | ${pz(f.schaden - 1)} | ${pz(f.haltungsschaden - 1)} | ${pz(f.kosten - 1)} | ${(z.siege * 100).toFixed(0)} % | ${z.zeit.toFixed(1)} s | ${pz(z.zeit / r.zeit - 1)} | ${z.erlitten.toFixed(0)} | ${PROFILE.map(p => (z.jeProfil[p.name].siege * 100).toFixed(0)).join(' / ')} | ${befund} |${z.gereinigt !== undefined ? ` ${(z.gereinigt * 100).toFixed(0)} % |` : ''}`);
    }
    const ohneRef = zeilen;
    const sp = (f: (z: Messung) => number) => `${Math.min(...ohneRef.map(f)).toFixed(1)} … ${Math.max(...ohneRef.map(f)).toFixed(1)}`;
    console.log(`\nStreuung ${familie}: Siege ${sp(z => z.siege * 100)} %, Zeit ${sp(z => z.zeit)} s, erlitten ${sp(z => z.erlitten)}\n`);
  }
}
