/**
 * BRACHLAND — Reinigen gegen Töten, ausgespielt (D376).
 *
 * Der Kampfbot (`tools/kampfbot.ts`) kämpft jede Aufstellung dreimal: (a) nur töten, (b) immer
 * reinigen, (c) gemischt — töten, solange noch ein anderer steht, den Letzten reinigen. Gemessen
 * werden Siegquote, Zeit bis zum Sieg, erlittener Schaden und der Anteil der Kanäle, die ein Treffer
 * gebrochen hat. Die Tabelle steht in `docs/design/BRACHLAND_Reinigen_v1.md`; wer an
 * `content/reinigen.json` dreht, rechnet sie hier nach.
 *
 *   npx tsx tools/reinigensim.ts [kämpfe=1000] [variante=empfohlen|gnadengriff|binden|alle] [waffe=klinge] [profil=aufmerksam]
 */
import { KEILER, GRATHORN, WOLF, FUCHS, GAMS, REINIGEN, type KampfWerte, type ReinigenWerte, type WaffenArt } from '../src/kampf/echtzeit.js';
import { kampf, PROFILE, type MarkenSpiel, type Profil } from './kampfbot.js';

/** Einzeln jedes Tier, dann zu zweit und zu dritt. Menschen fehlen: Die Marke greift bei ihnen nicht. */
export const AUFSTELLUNGEN: Record<string, KampfWerte[]> = {
  keiler: [KEILER], grathorn: [GRATHORN], wolf: [WOLF], fuchs: [FUCHS], gams: [GAMS],
  'wolf+fuchs': [WOLF, FUCHS], 'wolf+wolf': [WOLF, WOLF], 'gams+gams': [GAMS, GAMS], 'keiler+grathorn': [KEILER, GRATHORN],
  'wolf+wolf+wolf': [WOLF, WOLF, WOLF], 'wolf+fuchs+fuchs': [WOLF, FUCHS, FUCHS],
};

/**
 * Die drei Varianten aus dem Entwurf. `empfohlen` ist `content/reinigen.json`; die anderen beiden
 * sind Gegenproben und stehen nur hier, weil sie nicht ins Spiel kommen.
 */
export const VARIANTEN: Record<string, ReinigenWerte> = {
  // B — Greifen in Fenstern (empfohlen): erst wund ringen, dann mehrere kurze Griffe; Fortschritt bleibt.
  empfohlen: REINIGEN,
  // A — Gnadengriff: erst unter 25 % Leben, ein einziger Kanal von 3 s, die Marke hält bis zum Ende;
  // ein Treffer löscht alles.
  gnadengriff: { ...REINIGEN, schwelle: 0.25, wundAb: 0.25, halten: 60, grunddauer: 3, lebenJeSekunde: 1e9,
    behaltBeiTreffer: 0, verfallJeSekunde: 0.5 },
  // C — Binden ab dem ersten Haltungsbruch: keine Lebensschwelle, die Marke hält bis zum Ende.
  binden: { ...REINIGEN, schwelle: 1, halten: 60, grunddauer: 1.5, lebenJeSekunde: 30 },
};

export interface SimZeile {
  aufstellung: string; modus: 'töten' | 'immer' | 'gemischt';
  siege: number; zeit: number; erlitten: number;
  /** Anteil der Tiere, die gereinigt statt getötet wurden (über gewonnene und verlorene Kämpfe). */
  gereinigt: number;
  /** Anteil der begonnenen Kanäle, die ein Treffer gebrochen hat bzw. die der Bot selbst löste. */
  gebrochen: number; geloest: number;
  /** Kanäle je Kampf. */
  kanaele: number;
}

export function simuliereZeile(name: string, modus: SimZeile['modus'], n: number, werte: ReinigenWerte,
                               waffe: WaffenArt = 'klinge', profil: Profil = PROFILE[0], saat0 = 5000): SimZeile {
  const aufstellung = AUFSTELLUNGEN[name];
  const spiel: MarkenSpiel | undefined = modus === 'töten' ? undefined : { modus: modus === 'immer' ? 'immer' : 'sicher', werte };
  let siege = 0, zeit = 0, erlitten = 0, gereinigt = 0, kanaele = 0, gebrochen = 0, geloest = 0;
  for (let i = 0; i < n; i++) {
    const e = kampf(aufstellung, waffe, profil, saat0 + i, undefined, 1, undefined, spiel);
    if (e.sieg) { siege++; zeit += e.zeit; }
    erlitten += e.erlitten;
    gereinigt += e.gereinigt ?? 0; kanaele += e.kanaele ?? 0; gebrochen += e.gebrochen ?? 0; geloest += e.geloest ?? 0;
  }
  return { aufstellung: name, modus, siege: siege / n, zeit: siege ? zeit / siege : NaN, erlitten: erlitten / n,
    gereinigt: gereinigt / (n * aufstellung.length), gebrochen: kanaele ? gebrochen / kanaele : 0,
    geloest: kanaele ? geloest / kanaele : 0, kanaele: kanaele / n };
}

export function simuliereAlle(n: number, werte: ReinigenWerte, waffe: WaffenArt = 'klinge', profil: Profil = PROFILE[0]): SimZeile[] {
  const raus: SimZeile[] = [];
  for (const name of Object.keys(AUFSTELLUNGEN)) for (const modus of ['töten', 'immer', 'gemischt'] as const) {
    // Einzeln ist „gemischt“ dasselbe wie „immer“ — der Letzte ist der Einzige.
    if (modus === 'gemischt' && AUFSTELLUNGEN[name].length === 1) continue;
    raus.push(simuliereZeile(name, modus, n, werte, waffe, profil));
  }
  return raus;
}

if (process.argv[1]?.endsWith('reinigensim.ts')) {
  const n = Number(process.argv[2] ?? 1000);
  const welche = process.argv[3] ?? 'empfohlen';
  const waffe = (process.argv[4] ?? 'klinge') as WaffenArt;
  const profil = PROFILE.find(p => p.name === (process.argv[5] ?? 'aufmerksam')) ?? PROFILE[0];
  const pct = (x: number) => `${(x * 100).toFixed(0)} %`;
  for (const [vname, werte] of Object.entries(VARIANTEN)) {
    if (welche !== 'alle' && welche !== vname) continue;
    console.log(`\n### Variante ${vname} — ${n} Kämpfe je Zeile, ${waffe}, ${profil.name}\n`);
    console.log('| Aufstellung | Modus | Siege | Zeit bis Sieg | gegen Töten | Schaden erlitten | gegen Töten | gereinigt | Kanäle/Kampf | gebrochen | selbst gelöst |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|');
    let basis: SimZeile | null = null;
    for (const z of simuliereAlle(n, werte, waffe, profil)) {
      if (z.modus === 'töten') basis = z;
      const dz = basis && z !== basis ? `${z.zeit >= basis.zeit ? '+' : ''}${((z.zeit / basis.zeit - 1) * 100).toFixed(0)} %` : '–';
      const de = basis && z !== basis ? `${z.erlitten >= basis.erlitten ? '+' : ''}${(z.erlitten - basis.erlitten).toFixed(0)}` : '–';
      console.log(`| ${z.aufstellung} | ${z.modus} | ${pct(z.siege)} | ${z.zeit.toFixed(1)} s | ${dz} | ${z.erlitten.toFixed(0)} | ${de} | ${z.modus === 'töten' ? '–' : pct(z.gereinigt)} | ${z.modus === 'töten' ? '–' : z.kanaele.toFixed(1)} | ${z.modus === 'töten' ? '–' : pct(z.gebrochen)} | ${z.modus === 'töten' ? '–' : pct(z.geloest)} |`);
    }
  }
}
