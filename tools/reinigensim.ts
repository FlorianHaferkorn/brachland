/**
 * BRACHLAND — Reinigen gegen Töten, ausgespielt (D376, je Gegner D389).
 *
 * Der Kampfbot (`tools/kampfbot.ts`) kämpft jede Aufstellung dreimal: (a) nur töten, (b) immer
 * reinigen, (c) gemischt — töten, solange noch ein anderer steht, den Letzten reinigen. Gemessen
 * werden Siegquote, Zeit bis zum Sieg, erlittener Schaden und der Anteil der Kanäle, die ein Treffer
 * gebrochen hat. Die Tabelle steht in `docs/design/BRACHLAND_Reinigen_v1.md`; wer an
 * `content/reinigen.json` dreht, rechnet sie hier nach.
 *
 *   npx tsx tools/reinigensim.ts [kämpfe=1000] [variante=empfohlen|formel|gnadengriff|binden|alle] [waffe=klinge] [profil=aufmerksam]
 *
 * D389 — Dauer je Gegner: jedes reinigbare Tier einzeln, je Spielerprofil des Kampfbots, mit seinen
 * eigenen Werten aus `content/gegner/*.json` (`reinigen`) und zum Vergleich mit der Grössenformel
 * davor. Wer an einem `reinigen`-Block dreht, rechnet hier nach:
 *
 *   npx tsx tools/reinigensim.ts [kämpfe=1000] gegner [waffe=klinge]
 *
 * D407: Als letztes Wort `bot=d407` oder `bot=heiler` misst mit dem korrigierten Bot bzw. dem Heiler (`BOT`).
 */
import { KEILER, GRATHORN, WOLF, FUCHS, GAMS, REINIGEN, neuerKaempfer, reinigungsDauer, reinigungsHalten, reinigungsGriffe,
  type KampfWerte, type ReinigenWerte, type WaffenArt } from '../src/kampf/echtzeit.js';
import { kampf, PROFILE, BOT_D407, HEILER, type BotOptionen, type MarkenSpiel, type Profil } from './kampfbot.js';

/**
 * D407: Mit welchem Bot gemessen wird — getrennt für Töten und Reinigen. Ohne Angabe der Bot von D171
 * (die Tabellen in Reinigen v1 §3 und §6 bis D389). `bot=d407`: der korrigierte Bot für beides;
 * `bot=heiler`: korrigiert beim Töten, der Heiler (`HEILER`) beim Reinigen.
 */
export const BOT: { toeten: BotOptionen; reinigen: BotOptionen } = { toeten: {}, reinigen: {} };
export function waehleBot(wahl: 'd171' | 'd407' | 'heiler'): void {
  BOT.toeten = wahl === 'd171' ? {} : BOT_D407;
  BOT.reinigen = wahl === 'd171' ? {} : wahl === 'heiler' ? HEILER : BOT_D407;
}

/** Jedes reinigbare Tier aus `content/gegner/` (der Test hält die Liste gegen den Ordner). Menschen fehlen: Die Marke greift bei ihnen nicht (D385). */
export const TIERE: Record<string, KampfWerte> = { keiler: KEILER, grathorn: GRATHORN, wolf: WOLF, fuchs: FUCHS, gams: GAMS };

/** Einzeln jedes Tier, dann zu zweit und zu dritt. */
export const AUFSTELLUNGEN: Record<string, KampfWerte[]> = {
  keiler: [KEILER], grathorn: [GRATHORN], wolf: [WOLF], fuchs: [FUCHS], gams: [GAMS],
  'wolf+fuchs': [WOLF, FUCHS], 'wolf+wolf': [WOLF, WOLF], 'gams+gams': [GAMS, GAMS], 'keiler+grathorn': [KEILER, GRATHORN],
  'wolf+wolf+wolf': [WOLF, WOLF, WOLF], 'wolf+fuchs+fuchs': [WOLF, FUCHS, FUCHS],
};

/**
 * Die drei Varianten aus dem Entwurf. `empfohlen` ist `content/reinigen.json` mit den Werten je Gegner
 * (D389); die anderen sind Gegenproben und stehen nur hier, weil sie nicht ins Spiel kommen.
 */
export const VARIANTEN: Record<string, ReinigenWerte> = {
  // B — Greifen in Fenstern (empfohlen): erst wund ringen, dann mehrere kurze Griffe; Fortschritt bleibt.
  empfohlen: REINIGEN,
  // B wie in D376 gemessen: dieselben Markenwerte, aber die Dauer nach der Grösse statt je Gegner.
  formel: REINIGEN,
  // A — Gnadengriff: erst unter 25 % Leben, ein einziger Kanal von 3 s, die Marke hält bis zum Ende;
  // ein Treffer löscht alles.
  gnadengriff: { ...REINIGEN, schwelle: 0.25, wundAb: 0.25, halten: 60, grunddauer: 3, lebenJeSekunde: 1e9,
    behaltBeiTreffer: 0, verfallJeSekunde: 0.5 },
  // C — Binden ab dem ersten Haltungsbruch: keine Lebensschwelle, die Marke hält bis zum Ende.
  binden: { ...REINIGEN, schwelle: 1, halten: 60, grunddauer: 1.5, lebenJeSekunde: 30 },
};
/** Diese Varianten rechnen ohne die Werte je Gegner — sonst überstimmte `reinigen.dauer` ihre eigene Dauer. */
export const NACH_FORMEL = new Set(['formel', 'gnadengriff', 'binden']);

/** Derselbe Gegner ohne eigene Reinigungswerte: Es gilt die Grössenformel der Markenwerte (Stand D376). */
export function ohneEigeneWerte(w: KampfWerte): KampfWerte {
  const { reinigen: _weg, ...rest } = w;
  return rest;
}

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

function messe(name: string, aufstellung: KampfWerte[], modus: SimZeile['modus'], n: number, werte: ReinigenWerte,
               waffe: WaffenArt, profil: Profil, saat0: number): SimZeile {
  const spiel: MarkenSpiel | undefined = modus === 'töten' ? undefined : { modus: modus === 'immer' ? 'immer' : 'sicher', werte };
  let siege = 0, zeit = 0, erlitten = 0, gereinigt = 0, kanaele = 0, gebrochen = 0, geloest = 0;
  for (let i = 0; i < n; i++) {
    const e = kampf(aufstellung, waffe, profil, saat0 + i, undefined, 1, undefined, spiel, modus === 'töten' ? BOT.toeten : BOT.reinigen);
    if (e.sieg) { siege++; zeit += e.zeit; }
    erlitten += e.erlitten;
    gereinigt += e.gereinigt ?? 0; kanaele += e.kanaele ?? 0; gebrochen += e.gebrochen ?? 0; geloest += e.geloest ?? 0;
  }
  return { aufstellung: name, modus, siege: siege / n, zeit: siege ? zeit / siege : NaN, erlitten: erlitten / n,
    gereinigt: gereinigt / (n * aufstellung.length), gebrochen: kanaele ? gebrochen / kanaele : 0,
    geloest: kanaele ? geloest / kanaele : 0, kanaele: kanaele / n };
}

/** `formel`: ohne die Werte je Gegner rechnen (Stand D376, und für die Gegenproben A und C). */
export function simuliereZeile(name: string, modus: SimZeile['modus'], n: number, werte: ReinigenWerte,
                               waffe: WaffenArt = 'klinge', profil: Profil = PROFILE[0], saat0 = SAAT, formel = false): SimZeile {
  const aufstellung = formel ? AUFSTELLUNGEN[name].map(ohneEigeneWerte) : AUFSTELLUNGEN[name];
  return messe(name, aufstellung, modus, n, werte, waffe, profil, saat0);
}

export function simuliereAlle(n: number, werte: ReinigenWerte, waffe: WaffenArt = 'klinge', profil: Profil = PROFILE[0], formel = false): SimZeile[] {
  const raus: SimZeile[] = [];
  for (const name of Object.keys(AUFSTELLUNGEN)) for (const modus of ['töten', 'immer', 'gemischt'] as const) {
    // Einzeln ist „gemischt“ dasselbe wie „immer“ — der Letzte ist der Einzige.
    if (modus === 'gemischt' && AUFSTELLUNGEN[name].length === 1) continue;
    raus.push(simuliereZeile(name, modus, n, werte, waffe, profil, SAAT, formel));
  }
  return raus;
}

// ------------------------------------------------------------------ Dauer je Gegner (D389)

/** Erste Saat jeder Zeile; Kampf `i` läuft mit `SAAT + i`. Töten und Reinigen sehen also dieselben Würfe. */
export const SAAT = 5000;

/**
 * Zielkorridor (Messlatte der Auswertung, kein Spielwert). `zeit`: Kampfdauer Reinigen gegen Töten für
 * den aufmerksamen Spieler — der Richtwert +20–40 % aus D376. `zeitHoechstens`: Obergrenze für jedes
 * Profil — **Annahme** aus dem Auftrag D389 („nicht länger als ~1,5× der Tötungszeit“), nicht von Flo
 * bestätigt. `siegeVerlust`: so viel Siegquote darf Reinigen gegenüber Töten höchstens kosten, sonst
 * ist es nicht „riskanter“, sondern aussichtslos — ebenfalls **Annahme**.
 */
export const ZIELKORRIDOR = { zeit: [1.2, 1.4] as const, zeitHoechstens: 1.5, siegeVerlust: 0.15 };

export interface GegnerZeile {
  gegner: string; profil: string;
  /** Kanaldauer, Griffdauer und Griffzahl aus den Daten (`formel`: nach der Grösse, Stand D376). */
  dauer: number; halten: number; griffe: number;
  toeten: SimZeile; reinigen: SimZeile;
  /** Zeit bis Sieg Reinigen / Töten und Schaden Reinigen − Töten. */
  zeitFaktor: number; mehrSchaden: number;
  /** Was am Korridor reisst — leer heisst: im Korridor. */
  befund: string[];
}

export function bewerte(profil: string, t: SimZeile, r: SimZeile): string[] {
  const f = r.zeit / t.zeit, raus: string[] = [];
  if (profil === PROFILE[0].name && f < ZIELKORRIDOR.zeit[0]) raus.push('zu leicht (kostet zu wenig Zeit)');
  if (profil === PROFILE[0].name && f > ZIELKORRIDOR.zeit[1] && f <= ZIELKORRIDOR.zeitHoechstens) raus.push('über dem Richtwert');
  if (f > ZIELKORRIDOR.zeitHoechstens) raus.push('zu lang (über 1,5×)');
  if (t.siege - r.siege > ZIELKORRIDOR.siegeVerlust) raus.push('zu hart (Siege brechen ein)');
  if (r.erlitten < t.erlitten - 0.5 && r.siege >= t.siege) raus.push('nicht riskanter (weniger Schaden als Töten)');
  // Der Bot kam gar nicht zum Reinigen — dann sagt die Zeile nichts über die Dauer.
  if (r.gereinigt < 0.5 && r.siege - r.gereinigt > 0.25) raus.push('selten gereinigt (der Bot tötet vorher)');
  return raus;
}

/** Ein Tier einzeln: töten gegen immer reinigen, je Profil. `formel`: mit der Grössenformel statt der eigenen Werte. */
export function simuliereGegner(name: string, n: number, profil: Profil, waffe: WaffenArt = 'klinge', formel = false,
                                werte: ReinigenWerte = REINIGEN, saat0 = SAAT, toeten?: SimZeile): GegnerZeile {
  const tier = formel ? ohneEigeneWerte(TIERE[name]) : TIERE[name];
  const k = neuerKaempfer(name, tier, 0, 0);
  // Töten hängt nicht an den Reinigungswerten — wer die Zeile schon hat, reicht sie herein.
  const t = toeten ?? messe(name, [tier], 'töten', n, werte, waffe, profil, saat0);
  const r = messe(name, [tier], 'immer', n, werte, waffe, profil, saat0);
  return { gegner: name, profil: profil.name, dauer: reinigungsDauer(werte, k), halten: reinigungsHalten(werte, k),
    griffe: reinigungsGriffe(werte, k), toeten: t, reinigen: r, zeitFaktor: r.zeit / t.zeit, mehrSchaden: r.erlitten - t.erlitten,
    befund: bewerte(profil.name, t, r) };
}

const pct = (x: number) => `${(x * 100).toFixed(0)} %`;
const mitVorzeichen = (x: number, stellen = 0) => `${x >= 0 ? '+' : ''}${x.toFixed(stellen)}`.replace('-', '−');
const komma = (x: number, stellen = 1) => x.toFixed(stellen).replace('.', ',');

function druckeGegner(n: number, waffe: WaffenArt): void {
  console.log(`\n### Dauer je Gegner — ${n} Kämpfe je Zelle, ${waffe}, Saat ${SAAT}…${SAAT + n - 1}, einzeln, „immer reinigen“ gegen „töten“\n`);
  console.log('| Gegner | Dauer | Griff | Griffe | Profil | Siege töten → reinigen | Zeit töten → reinigen | gegen Töten | Schaden töten → reinigen | gereinigt | Kanäle | vor D389 (Formel) | Befund |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const name of Object.keys(TIERE)) for (const p of PROFILE) {
    const z = simuliereGegner(name, n, p, waffe), v = simuliereGegner(name, n, p, waffe, true, REINIGEN, SAAT, z.toeten);
    console.log(`| ${name} | ${komma(z.dauer, 2)} s | ${komma(z.halten)} s | ${z.griffe} | ${p.name} | ${pct(z.toeten.siege)} → ${pct(z.reinigen.siege)} | ${komma(z.toeten.zeit)} → ${komma(z.reinigen.zeit)} s | ${mitVorzeichen((z.zeitFaktor - 1) * 100)} % | ${z.toeten.erlitten.toFixed(0)} → ${z.reinigen.erlitten.toFixed(0)} (${mitVorzeichen(z.mehrSchaden)}) | ${pct(z.reinigen.gereinigt)} | ${komma(z.reinigen.kanaele)} | ${komma(v.dauer, 2)} s: ${mitVorzeichen((v.zeitFaktor - 1) * 100)} %, Siege ${pct(v.reinigen.siege)} | ${z.befund.join('; ') || 'im Korridor'} |`);
  }
}

if (process.argv[1]?.endsWith('reinigensim.ts')) {
  const botWahl = process.argv.find(a => a.startsWith('bot='))?.slice(4) as 'd171' | 'd407' | 'heiler' | undefined;
  if (botWahl) { waehleBot(botWahl); process.argv.splice(process.argv.indexOf(`bot=${botWahl}`), 1); console.log(`Bot: ${botWahl}`); }
  const n = Number(process.argv[2] ?? 1000);
  const welche = process.argv[3] ?? 'empfohlen';
  const waffe = (process.argv[4] ?? 'klinge') as WaffenArt;
  const profil = PROFILE.find(p => p.name === (process.argv[5] ?? 'aufmerksam')) ?? PROFILE[0];
  if (welche === 'gegner') druckeGegner(n, waffe);
  else for (const [vname, werte] of Object.entries(VARIANTEN)) {
    if (welche !== 'alle' && welche !== vname) continue;
    console.log(`\n### Variante ${vname} — ${n} Kämpfe je Zeile, ${waffe}, ${profil.name}\n`);
    console.log('| Aufstellung | Modus | Siege | Zeit bis Sieg | gegen Töten | Schaden erlitten | gegen Töten | gereinigt | Kanäle/Kampf | gebrochen | selbst gelöst |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|');
    let basis: SimZeile | null = null;
    for (const z of simuliereAlle(n, werte, waffe, profil, NACH_FORMEL.has(vname))) {
      if (z.modus === 'töten') basis = z;
      const dz = basis && z !== basis ? `${z.zeit >= basis.zeit ? '+' : ''}${((z.zeit / basis.zeit - 1) * 100).toFixed(0)} %` : '–';
      const de = basis && z !== basis ? `${z.erlitten >= basis.erlitten ? '+' : ''}${(z.erlitten - basis.erlitten).toFixed(0)}` : '–';
      console.log(`| ${z.aufstellung} | ${z.modus} | ${pct(z.siege)} | ${z.zeit.toFixed(1)} s | ${dz} | ${z.erlitten.toFixed(0)} | ${de} | ${z.modus === 'töten' ? '–' : pct(z.gereinigt)} | ${z.modus === 'töten' ? '–' : z.kanaele.toFixed(1)} | ${z.modus === 'töten' ? '–' : pct(z.gebrochen)} | ${z.modus === 'töten' ? '–' : pct(z.geloest)} |`);
    }
  }
}
