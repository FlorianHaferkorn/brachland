/**
 * BRACHLAND — Baukasten gegen drei Ziele (D407): jede Form Kopf × Schaft durch den Kampfbot, nicht nur
 * im Tötungsmodus wie `tools/baukastensim.ts` (D403), sondern so, wie D404 es verlangt:
 *
 *   töten     die fünf Tiere einzeln, Bot D407 (`BOT_D407`), drei Profile
 *   reinigen  dieselben Tiere, „immer reinigen“ mit dem Heiler (`HEILER`: schont den tödlichen Schlag,
 *             bricht die Haltung eines wunden Tiers und greift in die Betäubung)
 *   menschen  Wegelagerer, Speermann, Axtmann einzeln; der Kampf endet beim ersten Haltungsbruch
 *             (D385 als Messannahme `aufgabe` — im Spiel noch nicht gebaut)
 *   rudel     sechs Paare und Dreier wie in `tools/reinigensim.ts`, töten — mit dem Anteil der Fenster,
 *             die an der Ausdauer scheiterten
 *
 * Gemessen wird je Ziel die mittlere Zeit gewonnener Kämpfe gegen den Referenzbau der Familie (dieselben
 * Würfe: Saat 7000 + Kampfnummer), dazu Siege und Schaden. Die Teile kommen aus `content/waffenteile.json`
 * samt Ausgleich (`ausgleich` je Teil, D407); mit `ausgleich=aus` rechnet die Messung ohne ihn (Stand D403),
 * mit `ausgleich=<datei.json>` mit Probewerten `{ "<familie>": { "<teil>": faktor } }` — die Daten bleiben dabei
 * unberührt. `probe` misst zusätzlich den Referenzbau mit Schaden ×1,10: daraus die Elastizität der
 * Kampfdauer gegen den Schaden, mit der `--vorschlag` einen Ausgleich je Teil vorschlägt.
 *
 *   npx tsx tools/baukastenziele.ts [kämpfe=100] [familie|alle] [ziele=toeten,reinigen,menschen] [ausgleich=an|aus|<datei>] [probe] [--vorschlag] [--json=<datei>]
 *   npx tsx tools/baukastenziele.ts suche <familie> [kämpfe=100] [ziele=…] [start=<datei>] [runden=1] [mass=mittel]
 *
 * `suche` geht für jedes Teil die Stufen `STUFEN` durch und nimmt die, mit der seine Formen im Mittel der Ziele
 * am nächsten an der Referenzdauer liegen (`suche()`); das Ergebnis ist ein Vorschlag für `ausgleich` in den Daten.
 *
 * Messwerkzeug, nicht im Gate. Tabellen: `docs/design/BRACHLAND_Waffen-Baukasten_v1.md` §24.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Waffenbaukasten, WaffenDaten } from '../src/data/schema.js';
import { WAFFEN, KEILER, GRATHORN, WOLF, FUCHS, GAMS, WEGELAGERER, SPEERMANN, AXTMANN, REINIGEN, type KampfWerte, type WaffenArt } from '../src/kampf/echtzeit.js';
import { alleBauten, leiteAb, referenzBau, regelWaffe, type Bau, type Familie } from '../src/kampf/baukasten.js';
import { kampf, PROFILE, BOT_D407, HEILER, type BotOptionen, type MarkenSpiel } from './kampfbot.js';
import { schlaegt } from './baukastensim.js';

export type Ziel = 'toeten' | 'reinigen' | 'menschen' | 'rudel';
export const ZIELE: Record<Ziel, { aufstellungen: Record<string, KampfWerte[]>; bot: BotOptionen; spiel?: MarkenSpiel; anteil?: number }> = {
  toeten: { aufstellungen: { keiler: [KEILER], grathorn: [GRATHORN], wolf: [WOLF], fuchs: [FUCHS], gams: [GAMS] }, bot: BOT_D407 },
  reinigen: { aufstellungen: { keiler: [KEILER], grathorn: [GRATHORN], wolf: [WOLF], fuchs: [FUCHS], gams: [GAMS] }, bot: HEILER,
    spiel: { modus: 'immer', werte: REINIGEN } },
  menschen: { aufstellungen: { wegelagerer: [WEGELAGERER], speermann: [SPEERMANN], axtmann: [AXTMANN] }, bot: { ...BOT_D407, aufgabe: true } },
  // Rudel sind lang: ein Drittel der Kämpfe je Zelle genügt für die Rangfolge.
  rudel: { aufstellungen: { 'wolf+fuchs': [WOLF, FUCHS], 'wolf+wolf': [WOLF, WOLF], 'gams+gams': [GAMS, GAMS], 'keiler+grathorn': [KEILER, GRATHORN],
    'wolf+wolf+wolf': [WOLF, WOLF, WOLF], 'wolf+fuchs+fuchs': [WOLF, FUCHS, FUCHS] }, bot: BOT_D407, anteil: 1 / 3 },
};
const SAAT = 7000;

export interface ZielMessung { siege: number; zeit: number; erlitten: number;
  /** reinigen: Anteil gereinigt statt getötet; menschen: Anteil, der beim Haltungsbruch aufgab; rudel: Anteil der Fenster ohne Ausdauer. */
  anteil: number; brueche: number }
export interface FormMessung { bau: Bau; referenz: boolean; ziele: Partial<Record<Ziel, ZielMessung>> }

const lies = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

/** Baukasten aus den Daten, wahlweise ohne Ausgleich oder mit Probewerten. Die Datei wird nie geschrieben. */
export function baukasten(ausgleich: 'an' | 'aus' | Record<string, Record<string, number>> = 'an'): Waffenbaukasten {
  const k = Waffenbaukasten.parse(lies('content/waffenteile.json'));
  if (ausgleich === 'an') return k;
  for (const [f, fam] of Object.entries(k.familien)) for (const t of [...fam.kopf, ...fam.schaft]) {
    t.ausgleich = ausgleich === 'aus' ? 1 : ausgleich[f]?.[t.id] ?? t.ausgleich;
  }
  return k;
}

/** Eine Form gegen ein Ziel: drei Profile × Aufstellungen × `n` Kämpfe. `schadenFaktor` nur für die Probe. */
export function messeZiel(k: Waffenbaukasten, familie: Familie, bau: Bau, ziel: Ziel, n: number, schadenFaktor = 1): ZielMessung {
  const grund = WaffenDaten.parse(lies(`content/waffen/${familie}.json`));
  const vorher = WAFFEN[familie as WaffenArt];
  WAFFEN[familie as WaffenArt] = regelWaffe(leiteAb(k, grund, bau));
  const z = ZIELE[ziel];
  const m = Math.max(1, Math.round(n * (z.anteil ?? 1)));
  let siege = 0, zeit = 0, erlitten = 0, alle = 0, a = 0, b = 0, brueche = 0, fenster = 0, leer = 0;
  try {
    for (const p of PROFILE) for (const aufst of Object.values(z.aufstellungen)) for (let i = 0; i < m; i++) {
      const opt: BotOptionen = ziel === 'rudel' ? { ...z.bot, ereignis: e => { if (e.art === 'fenster' && e.phase === 'erholung') { fenster++; if (!e.hiebe && !e.reserve) leer++; } } } : z.bot;
      const e = kampf(aufst, familie as WaffenArt, p, SAAT + i, undefined, schadenFaktor, undefined, z.spiel, opt);
      alle++; erlitten += e.erlitten; brueche += e.brueche;
      if (e.sieg) { siege++; zeit += e.zeit; }
      if (ziel === 'reinigen') { a += e.gereinigt ?? 0; b += (e.gereinigt ?? 0) + (e.getoetet ?? 0); }
      if (ziel === 'menschen') { a += e.aufgegeben ?? 0; b += aufst.length; }
    }
  } finally { WAFFEN[familie as WaffenArt] = vorher; }
  return { siege: siege / alle, zeit: siege ? zeit / siege : NaN, erlitten: erlitten / alle, brueche: brueche / alle,
    anteil: ziel === 'rudel' ? (fenster ? leer / fenster : 0) : b ? a / b : 0 };
}

/** Besser als die Referenz in einem Ziel: über dem Rauschen schneller, ohne mehr als 2 Punkte Siege zu verlieren. */
export function vorn(x: ZielMessung, r: ZielMessung, rauschen = 0.03): boolean {
  return x.zeit < r.zeit * (1 - rauschen) && x.siege >= r.siege - 0.02;
}
export function hinten(x: ZielMessung, r: ZielMessung, rauschen = 0.03): boolean {
  return x.zeit > r.zeit * (1 + rauschen) || x.siege < r.siege - 0.02;
}

/**
 * Rang in der Familie je Ziel wie in D403: „dominant“, wenn die Form mindestens die Hälfte der anderen schlägt
 * (nirgends schlechter, irgendwo über dem Rauschen besser — `schlaegt` aus `tools/baukastensim.ts`), „nutzlos“,
 * wenn mindestens die Hälfte sie schlägt.
 */
export function rang(formen: readonly FormMessung[], x: FormMessung, ziel: Ziel): 'dominant' | 'nutzlos' | '' {
  const m = (f: FormMessung) => f.ziele[ziel]!;
  const andere = formen.filter(f => f !== x);
  if (andere.filter(f => schlaegt(m(f), m(x))).length >= formen.length / 2) return 'nutzlos';
  if (andere.filter(f => schlaegt(m(x), m(f))).length >= formen.length / 2) return 'dominant';
  return '';
}

/**
 * Ausgleich je Teil aus einer Messung: Mittel der Zeitverhältnisse über die Ziele, je Form im Logarithmus
 * zerlegt in Kopf + Schaft (kleinste Quadrate, Referenzteile 0), geteilt durch die Elastizität — wie viel
 * Schaden ein Teil mehr (oder weniger) braucht, damit die Form im Mittel die Referenzdauer trifft.
 */
export function schlageVor(k: Waffenbaukasten, familie: Familie, formen: readonly FormMessung[], ziele: readonly Ziel[], elastizitaet: number): Record<string, number> {
  const f = k.familien[familie];
  const ref = formen.find(x => x.referenz)!;
  const lg = (x: FormMessung) => ziele.reduce((s, z) => s + Math.log(x.ziele[z]!.zeit / ref.ziele[z]!.zeit), 0) / ziele.length;
  const koepfe = f.kopf.map(t => t.id), schaefte = f.schaft.map(t => t.id);
  const a: Record<string, number> = Object.fromEntries(koepfe.map(i => [i, 0]));
  const b: Record<string, number> = Object.fromEntries(schaefte.map(i => [i, 0]));
  // Abwechselnd (Gauss-Seidel): Kopf als Mittel über seine Schäfte, Schaft als Mittel über seine Köpfe.
  for (let it = 0; it < 50; it++) {
    for (const kk of koepfe) if (kk !== f.referenz.kopf) {
      const fs = formen.filter(x => x.bau.kopf === kk); a[kk] = fs.reduce((s, x) => s + lg(x) - b[x.bau.schaft], 0) / fs.length;
    }
    for (const ss of schaefte) if (ss !== f.referenz.schaft) {
      const fs = formen.filter(x => x.bau.schaft === ss); b[ss] = fs.reduce((s, x) => s + lg(x) - a[x.bau.kopf], 0) / fs.length;
    }
  }
  const alt = (id: string) => [...f.kopf, ...f.schaft].find(t => t.id === id)!.ausgleich;
  const runde = (x: number) => Math.round(x * 100) / 100;
  return Object.fromEntries([...Object.entries(a), ...Object.entries(b)].map(([id, v]) =>
    [id, id === f.referenz.kopf || id === f.referenz.schaft ? 1 : runde(Math.min(1.4, Math.max(0.7, alt(id) * Math.exp(v / elastizitaet))))]));
}

/** Schrittweite und Grenzen der Suche (die Grenzen sind die des Schemas). */
export const SUCHE = { schritt: 0.05, min: 0.7, max: 1.4 };

/**
 * Ausgleich je Teil durch Suche (Koordinaten nacheinander, erst Köpfe, dann Schäfte, `runden` Durchgänge): Für
 * jedes Teil wird vom Startwert aus in Schritten von 0,05 in die bessere Richtung gegangen, bis es nicht besser wird —
 * gemessen an allen Formen mit diesem Teil gegen die Ziele. Fehler (`mass`): `einzeln` (Vorgabe) = mittlere quadrierte
 * Abweichung je Ziel von der Referenzdauer; `mittel` = quadrierte Abweichung des Mittels der Ziele (erste Fassung —
 * sie tauschte bei der Axt ein Ziel gegen ein anderes). Die Fehlerkurven sind eingipflig (gemessen über 0,75–1,4 an Bartaxt, kurzem Blatt,
 * Nadelspitze). Die Referenzteile bleiben 1. Gemessen wird mit denselben Würfen wie überall (Saat 7000…).
 */
export function suche(familie: Familie, ziele: readonly Ziel[], n: number, start: Record<string, number> = {}, runden = 1,
                      log: (z: string) => void = () => {}, mass: 'mittel' | 'einzeln' = 'einzeln'): Record<string, number> {
  const k0 = baukasten('aus');
  const f = k0.familien[familie];
  const wert: Record<string, number> = Object.fromEntries([...f.kopf, ...f.schaft].map(t => [t.id, start[t.id] ?? 1]));
  const ref = referenzBau(k0, familie);
  const r = Object.fromEntries(ziele.map(z => [z, messeZiel(k0, familie, ref, z, n)])) as Record<Ziel, ZielMessung>;
  const runde2 = (x: number) => Math.round(x * 100) / 100;
  for (let runde = 0; runde < runden; runde++) for (const t of [...f.kopf, ...f.schaft]) {
    if (t.id === f.referenz.kopf || t.id === f.referenz.schaft) continue;
    const gemerkt = new Map<number, number>();
    const fehler = (st: number) => {
      const st2 = runde2(st);
      if (gemerkt.has(st2)) return gemerkt.get(st2)!;
      const k = baukasten({ [familie]: { ...wert, [t.id]: st2 } });
      const e = alleBauten(k, familie).filter(b => (b.kopf === t.id || b.schaft === t.id) && !(b.kopf === ref.kopf && b.schaft === ref.schaft))
        .reduce((s, b) => {
          const d = ziele.map(z => messeZiel(k, familie, b, z, n).zeit / r[z].zeit - 1);
          const m = d.reduce((a, x) => a + x, 0) / d.length;
          // `einzeln`: jede Abweichung je Ziel zählt — sonst kauft die Suche ein Ziel mit einem anderen frei (Axt: −46 % töten gegen +94 % Menschen).
          return s + (mass === 'mittel' ? m * m : d.reduce((a, x) => a + x * x, 0) / d.length);
        }, 0);
      gemerkt.set(st2, e); log(`${familie} ${t.id} ${st2}: ${e.toFixed(4)}`);
      return e;
    };
    let x = wert[t.id];
    const auf = fehler(Math.min(SUCHE.max, x + SUCHE.schritt)), hier = fehler(x), ab = fehler(Math.max(SUCHE.min, x - SUCHE.schritt));
    const richtung = auf < hier && auf <= ab ? 1 : ab < hier ? -1 : 0;
    if (richtung) {
      x = runde2(x + richtung * SUCHE.schritt);
      for (;;) {
        const weiter = runde2(x + richtung * SUCHE.schritt);
        if (weiter < SUCHE.min - 1e-9 || weiter > SUCHE.max + 1e-9 || fehler(weiter) >= fehler(x)) break;
        x = weiter;
      }
    }
    wert[t.id] = x;
    log(`${familie} ${t.id} → ${x}`);
  }
  return wert;
}

if (process.argv[1]?.endsWith('baukastenziele.ts') && process.argv.includes('suche')) {
  const arg = process.argv.slice(2);
  const n = Number(arg.find(a => /^\d+$/.test(a)) ?? 100);
  const familie = (arg.find(a => ['klinge', 'axt', 'speer'].includes(a)) ?? 'klinge') as Familie;
  const ziele = (arg.find(a => a.startsWith('ziele='))?.slice(6).split(',') ?? ['toeten', 'reinigen', 'menschen']) as Ziel[];
  const start = arg.find(a => a.startsWith('start='))?.slice(6);
  const runden = Number(arg.find(a => a.startsWith('runden='))?.slice(7) ?? 1);
  const mass = arg.includes('mass=mittel') ? 'mittel' : 'einzeln';
  const w = suche(familie, ziele, n, start ? lies(start)[familie] : {}, runden, z => console.log(z), mass);
  console.log(JSON.stringify({ [familie]: w }));
} else if (process.argv[1]?.endsWith('baukastenziele.ts')) {
  const arg = process.argv.slice(2);
  const n = Number(arg.find(a => /^\d+$/.test(a)) ?? 100);
  const wahl = arg.find(a => ['klinge', 'axt', 'speer', 'alle'].includes(a)) ?? 'alle';
  const ziele = (arg.find(a => a.startsWith('ziele='))?.slice(6).split(',') ?? ['toeten', 'reinigen', 'menschen']) as Ziel[];
  const aus = arg.find(a => a.startsWith('ausgleich='))?.slice(10) ?? 'an';
  const k = baukasten(aus === 'an' || aus === 'aus' ? aus : lies(aus));
  const probe = arg.includes('probe') || arg.includes('--vorschlag');
  const jsonZiel = arg.find(a => a.startsWith('--json='))?.slice(7);
  const familien = (wahl === 'alle' ? ['klinge', 'axt', 'speer'] : [wahl]) as Familie[];
  const k1 = (x: number) => x.toFixed(1).replace('.', ',');
  const pz = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(0)} %`;
  const pct = (x: number) => `${(x * 100).toFixed(0)} %`;
  const raus: Record<string, unknown> = {};
  console.log(`Baukasten gegen ${ziele.join(', ')} — ${n} Kämpfe je Aufstellung und Profil (Rudel ein Drittel), Saat ${SAAT}…, Ausgleich ${aus}\n`);
  for (const familie of familien) {
    const ref = referenzBau(k, familie);
    const formen: FormMessung[] = alleBauten(k, familie).map(bau => ({ bau, referenz: bau.kopf === ref.kopf && bau.schaft === ref.schaft,
      ziele: Object.fromEntries(ziele.map(z => [z, messeZiel(k, familie, bau, z, n)])) }));
    const r = formen.find(x => x.referenz)!;
    console.log(`### ${familie} (Referenz ${ref.kopf} + ${ref.schaft}: ${ziele.map(z => `${z} ${k1(r.ziele[z]!.zeit)} s / ${pct(r.ziele[z]!.siege)}`).join(', ')})\n`);
    console.log(`| Kopf | Schaft | ${ziele.map(z => `${z}: Zeit · Siege · ${z === 'reinigen' ? 'gereinigt' : z === 'menschen' ? 'aufgegeben' : z === 'rudel' ? 'ohne Ausdauer' : 'erlitten'}`).join(' | ')} | Mittel Zeit | Befund |`);
    console.log(`|---|---|${ziele.map(() => '---|').join('')}---|---|`);
    let imBand = 0;
    for (const x of formen) {
      const mittel = ziele.reduce((s, z) => s + x.ziele[z]!.zeit / r.ziele[z]!.zeit, 0) / ziele.length - 1;
      if (Math.abs(mittel) <= 0.05) imBand++;
      const v = ziele.filter(z => vorn(x.ziele[z]!, r.ziele[z]!)).length, h = ziele.filter(z => hinten(x.ziele[z]!, r.ziele[z]!)).length;
      const befund = x.referenz ? 'Referenz' : v === ziele.length ? '**vorn in allen**' : h === ziele.length ? '**hinten in allen**'
        : `vorn ${v} · hinten ${h}`;
      console.log(`| ${x.bau.kopf} | ${x.bau.schaft} | ${ziele.map(z => { const m = x.ziele[z]!, rr = r.ziele[z]!;
        const extra = z === 'toeten' ? k1(m.erlitten) : pct(m.anteil);
        const rg = rang(formen, x, z);
        return `${x.referenz ? k1(m.zeit) + ' s' : pz(m.zeit / rr.zeit - 1)} · ${pct(m.siege)} · ${extra}${rg ? ` · **${rg}**` : ''}`; }).join(' | ')} | ${x.referenz ? '—' : pz(mittel)} | ${befund} |`);
    }
    console.log(`\n${familie}: ${imBand} von ${formen.length} Formen im Mittel in ±5 % der Referenz.\n`);
    const eintrag: Record<string, unknown> = { formen };
    if (probe) {
      const p = Object.fromEntries(ziele.map(z => [z, messeZiel(k, familie, ref, z, n, 1.1)]));
      const el = ziele.reduce((s, z) => s + Math.log(p[z].zeit / r.ziele[z]!.zeit), 0) / ziele.length / Math.log(1.1);
      console.log(`Probe Referenz mit Schaden ×1,10: ${ziele.map(z => `${z} ${pz(p[z].zeit / r.ziele[z]!.zeit - 1)}`).join(', ')} — Elastizität ${el.toFixed(2)}\n`);
      eintrag.elastizitaet = el;
      if (arg.includes('--vorschlag')) {
        const v = schlageVor(k, familie, formen, ziele, Math.min(-0.3, el));
        console.log(`Vorschlag Ausgleich ${familie}: ${JSON.stringify(v)}\n`);
        eintrag.vorschlag = v;
      }
    }
    raus[familie] = eintrag;
  }
  if (jsonZiel) writeFileSync(jsonZiel, JSON.stringify(raus, null, 1));
}
