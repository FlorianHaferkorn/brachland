/**
 * BRACHLAND — eine Waffe im Kampfbot über alle Zellen (D452): jedes Tier einzeln und im Rudel (`AUFSTELLUNGEN` aus
 * `reinigensim.ts`), je drei Profile, „töten“ und „immer reinigen“, dazu die Menschen bis zum Tod und mit der
 * Aufgabe-Regel (D426). Bot D407 (`BOT_D407`), Saat 5000…, Kampf `i` mit `5000 + i` — dieselben Würfe für jede Fassung.
 *
 *   npx tsx tools/waffenmessung.ts [kämpfe=1000] [waffe=axt] > a.json
 *
 * Gebraucht für D452 (Axt: Trefferfenster A gegen B, `docs/design/BRACHLAND_Waffenbewegungen_v1.md` §5.2): einmal mit
 * `content/waffen/<waffe>.json` wie es ist, einmal mit den geänderten Werten, und die beiden JSON-Ausgaben vergleichen.
 * Ausgabe je Zelle: Siegquote, Zeit bis zum Sieg (nur Siege), erlittener Schaden, Anteil gereinigter Tiere, Aufgaben, Treffer.
 */
import { WEGELAGERER, SPEERMANN, AXTMANN, WOLF, WAFFEN, type KampfWerte, type WaffenArt } from '../src/kampf/echtzeit.js';
import { kampf, PROFILE, BOT_D407, type Profil } from './kampfbot.js';
import { AUFSTELLUNGEN } from './reinigensim.js';

const n = Number(process.argv[2] ?? 1000);
const waffe = (process.argv[3] ?? 'axt') as WaffenArt;
const w = WAFFEN[waffe];
console.error(`${waffe}: ` + [...w.leicht, w.schwer, w.lauf].map(s => `${s.name} ${s.vorlauf}/${s.aktiv}/${s.erholung} s`).join(', '));

export interface MessZelle { gruppe: 'tier' | 'mensch'; name: string; modus: 'töten' | 'immer' | 'tod' | 'aufgabe'; profil: string;
  siege: number; zeit: number; erlitten: number; gereinigt: number; aufgegeben: number; treffer: number }
const raus: MessZelle[] = [];

function zelle(gruppe: MessZelle['gruppe'], name: string, aufst: KampfWerte[], modus: MessZelle['modus'], p: Profil) {
  let s = 0, z = 0, e = 0, ger = 0, auf = 0, tr = 0;
  for (let i = 0; i < n; i++) {
    const spiel = modus === 'immer' ? { modus: 'immer' as const } : undefined;
    const opt = modus === 'aufgabe' ? { ...BOT_D407, aufgabe: true } : BOT_D407;
    const x = kampf(aufst, waffe, p, 5000 + i, undefined, 1, undefined, spiel, opt);
    if (x.sieg) { s++; z += x.zeit; }
    e += x.erlitten; ger += x.gereinigt ?? 0; auf += x.aufgegeben ?? 0; tr += x.treffer;
  }
  raus.push({ gruppe, name, modus, profil: p.name, siege: s / n, zeit: s ? z / s : NaN, erlitten: e / n,
    gereinigt: ger / (n * aufst.length), aufgegeben: auf / n, treffer: tr / n });
}

for (const [name, a] of Object.entries(AUFSTELLUNGEN)) for (const modus of ['töten', 'immer'] as const) for (const p of PROFILE) zelle('tier', name, a, modus, p);
const MENSCHEN: Record<string, KampfWerte[]> = { wegelagerer: [WEGELAGERER], speermann: [SPEERMANN], axtmann: [AXTMANN], 'wegelagerer+wolf': [WEGELAGERER, WOLF] };
for (const [name, a] of Object.entries(MENSCHEN)) for (const modus of ['tod', 'aufgabe'] as const) for (const p of PROFILE) zelle('mensch', name, a, modus, p);
console.log(JSON.stringify(raus));
