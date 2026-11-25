/**
 * BRACHLAND — Lehrstrecke ausgespielt (D390).
 *
 * Liest `content/strecken/*.json` und lässt den Kampfbot (`tools/kampfbot.ts`) jede Station mit
 * Gegnern durchspielen: nur töten, und — wo Tiere stehen — immer reinigen. Je Profil (aufmerksam,
 * müde, parierend) Siegquote, Zeit bis zum Sieg und erlittener Schaden. Daran hängt die Aussage
 * „vom schwächsten aufsteigend“ in `docs/design/BRACHLAND_Weg-nach-Brannburg_v1.md` §4; wer eine
 * Station umbesetzt, rechnet sie hier nach.
 *
 * Messung, kein Bauschritt und nicht im Gate. Bot-Werte, nichts am Gerät gespielt.
 *
 *   npx tsx tools/streckensim.ts [kämpfe=400] [waffe=klinge]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Strecke } from '../src/data/schema.js';
import { KEILER, GRATHORN, WOLF, FUCHS, GAMS, WEGELAGERER, SPEERMANN, AXTMANN, REINIGEN,
         type KampfWerte, type WaffenArt } from '../src/kampf/echtzeit.js';
import { kampf, PROFILE, type MarkenSpiel } from './kampfbot.js';

/** ID aus `content/gegner/` → Kampfwerte. Der Übungsgegner fehlt: `validate` lässt ihn auf keiner Strecke zu. */
const WERTE: Record<string, KampfWerte> = {
  keiler: KEILER, grathorn: GRATHORN, wolf: WOLF, fuchs: FUCHS, gams: GAMS,
  wegelagerer: WEGELAGERER, speermann: SPEERMANN, axtmann: AXTMANN,
};
const MENSCHEN = new Set(['wegelagerer', 'speermann', 'axtmann']);

const n = Number(process.argv[2] ?? 400);
const waffe = (process.argv[3] ?? 'klinge') as WaffenArt;
const pct = (x: number) => `${(x * 100).toFixed(0)} %`;

for (const datei of readdirSync('content/strecken').filter(f => f.endsWith('.json')).sort()) {
  const strecke = Strecke.parse(JSON.parse(readFileSync(join('content/strecken', datei), 'utf8')));
  console.log(`\n### ${strecke.name} — ${n} Kämpfe je Zeile, ${waffe}\n`);
  console.log('| Station | Aufstellung | Lehrt | Profil | Modus | Siege | Zeit bis Sieg | Schaden erlitten | gereinigt |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const st of strecke.stationen) {
    const arten = st.gegner.flatMap(g => Array<string>(g.anzahl).fill(g.art));
    if (!arten.length) continue;
    const aufstellung = arten.map(a => { const w = WERTE[a]; if (!w) throw new Error(`Gegner '${a}' kennt streckensim nicht`); return w; });
    const nurTiere = !arten.some(a => MENSCHEN.has(a));
    for (const profil of PROFILE) for (const modus of ['töten', 'immer reinigen'] as const) {
      if (modus !== 'töten' && !nurTiere) continue;
      const spiel: MarkenSpiel | undefined = modus === 'töten' ? undefined : { modus: 'immer', werte: REINIGEN };
      let siege = 0, zeit = 0, erlitten = 0, gereinigt = 0;
      for (let i = 0; i < n; i++) {
        const e = kampf(aufstellung, waffe, profil, 5000 + i, undefined, 1, undefined, spiel);
        if (e.sieg) { siege++; zeit += e.zeit; }
        erlitten += e.erlitten; gereinigt += e.gereinigt ?? 0;
      }
      console.log(`| ${st.name} | ${arten.join(' + ')} | ${st.lehrt.join(', ')} | ${profil.name} | ${modus} | ${pct(siege / n)} | `
        + `${siege ? (zeit / siege).toFixed(1) : '–'} s | ${(erlitten / n).toFixed(0)} | ${modus === 'töten' ? '–' : pct(gereinigt / (n * arten.length))} |`);
    }
  }
}
