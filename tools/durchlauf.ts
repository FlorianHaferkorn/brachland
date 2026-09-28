/**
 * BRACHLAND — Durchlauf (D179): die Wegelager von Bruchweg bis Almsteig, bei Tag und Nacht, mit
 * Schmiedestufe 0/1/3, gespielt vom Kampfbot (Profil „aufmerksam“ und „müde“). Dazu die Rechnung, wie
 * viele Siege eine Waffe auf Stufe 3 kostet. Kein Tor — eine Tabelle zum Abstimmen.
 *
 *   npx tsx tools/durchlauf.ts [kämpfe je zeile, vorgabe 40]
 */
import { kampf, PROFILE } from './kampfbot.js';
import { WEGELAGERER, WOLF, FUCHS, naechtlich, type KampfWerte } from '../src/kampf/echtzeit.js';
import { schadenFaktor, angebot } from '../src/spiel/schmiede.js';

const N = Number(process.argv[2] ?? 40);
const LAGER: { name: string; auf: KampfWerte[]; beute: Record<string, number> }[] = [
  { name: 'Bruchweg', auf: [WEGELAGERER, WOLF], beute: { kraeutersud: 1, harzverband: 1 } },
  { name: 'Hofgraben', auf: [WEGELAGERER, FUCHS], beute: { koeder: 2, netzschlinge: 1 } },
  { name: 'Almsteig', auf: [WEGELAGERER, WEGELAGERER, WOLF], beute: { kraeutersud: 2, herzfunke: 1 } },
];
console.log(`Durchlauf — ${N} Kämpfe je Zeile`);
console.log('Lager       Zeit   Waffe   Stufe Profil        Siege  Zeit    erlitten');
for (const l of LAGER) for (const nacht of [false, true]) for (const waffe of ['klinge', 'axt', 'speer'] as const)
  for (const stufe of [0, 1, 3]) for (const p of PROFILE.filter(x => x.name !== 'parierend')) {
    const auf = nacht ? l.auf.map(w => naechtlich(w)) : l.auf;
    let siege = 0, zeit = 0, erlitten = 0;
    for (let i = 0; i < N; i++) {
      const e = kampf(auf, waffe, p, 5000 + i, undefined, schadenFaktor(stufe));
      if (e.sieg) { siege++; zeit += e.zeit; }
      erlitten += e.erlitten;
    }
    console.log(`${l.name.padEnd(11)} ${(nacht ? 'Nacht' : 'Tag').padEnd(6)} ${waffe.padEnd(7)} ${String(stufe).padStart(5)} ${p.name.padEnd(12)}`
      + ` ${String(Math.round(siege / N * 100)).padStart(4)} %  ${siege ? (zeit / siege).toFixed(1).padStart(5) + ' s' : '    –  '}  ${(erlitten / N).toFixed(0).padStart(5)}`);
  }

// Wirtschaft: was kostet Stufe 3, und wie viele Siege liefern das (Tag / Nacht = doppelte Beute)?
const kosten: Record<string, number> = {};
for (let s = 0; s < 3; s++) for (const [g, n] of Object.entries(angebot('klinge', s)!.preis)) kosten[g] = (kosten[g] ?? 0) + n;
console.log(`\nStufe 0 → 3 kostet je Waffe: ${Object.entries(kosten).map(([g, n]) => `${g} ×${n}`).join(', ')}`);
for (const [g, n] of Object.entries(kosten)) {
  const quellen = LAGER.filter(l => l.beute[g]).map(l => `${l.name} (${l.beute[g]}/Sieg)`);
  const jeSieg = Math.max(...LAGER.map(l => l.beute[g] ?? 0));
  console.log(`  ${g}: ${quellen.join(', ') || 'kein Lager'} → mindestens ${Math.ceil(n / jeSieg)} Siege bei Tag, ${Math.ceil(n / (2 * jeSieg))} bei Nacht`);
}
