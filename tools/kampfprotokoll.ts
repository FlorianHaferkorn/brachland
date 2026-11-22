/**
 * BRACHLAND — Kampfprotokoll (D407): ein einzelner Bot-Kampf Zeile für Zeile, und die Auszählung dahinter.
 *
 * Der Kampfbot (`tools/kampfbot.ts`) liefert Siege und Zeiten. Warum eine Zeit so ist, steht dort nicht —
 * dafür ist dieses Werkzeug: Es hört die Ereignisse des Bots mit (`BotOptionen.ereignis`) und druckt sie,
 * oder zählt über viele Kämpfe aus, was aus den offenen Fenstern des Gegners wurde.
 *
 *   npx tsx tools/kampfprotokoll.ts kampf   <gegner> [waffe=klinge] [profil=aufmerksam] [saat=5000] [schalter…]
 *   npx tsx tools/kampfprotokoll.ts fenster <gegner|alle> [waffe=klinge] [kämpfe=1000] [schalter…]
 *   npx tsx tools/kampfprotokoll.ts wolf    [kämpfe=1000] [waffe=klinge] [schalter…]
 *
 * Schalter: `reinigen` (Bot reinigt immer), `lauf` (rennt nach und setzt den Laufangriff), `sanft`, `haltung`
 * (Spielweisen des Heilers), `schwelle=0.4`, `halten=1.5`, `loesen=0.1` (Markenwerte nur für diese Messung),
 * `g.erholung=0.85` (ein Feld des Gegnerschlags nur für diese Messung — `content/gegner/` bleibt unberührt).
 *
 * `fenster`: je Gegner und Profil — wie viele Erholungen des Gegners der Bot zum Schlag nutzte, und woran
 * die anderen scheiterten. `wolf`: woran „immer reinigen“ beim Wolf scheitert, einzeln ausgezählt (D389/D395).
 *
 * Messwerkzeug, nicht im Gate. Befunde: `docs/design/BRACHLAND_Reinigen_v1.md` §7.
 */
import { REINIGEN, type KampfWerte, type ReinigenWerte, type WaffenArt } from '../src/kampf/echtzeit.js';
import { kampf, GEGNER, PROFILE, type BotEreignis, type BotOptionen, type Ergebnis, type MarkenSpiel, type Profil } from './kampfbot.js';

export interface Schalter { opt: BotOptionen; spiel?: MarkenSpiel; werte: ReinigenWerte;
  /** Nur für diese Messung: Felder des Gegnerschlags überschreiben (`g.erholung=0.85`). Die Daten bleiben unberührt. */
  gegnerSchlag?: Record<string, number> }

/** Die Aufstellung mit den Probewerten aus den Schaltern — eine Kopie, `content/gegner/` bleibt, wie es ist. */
export function aufstellung(name: string, sch: Schalter): KampfWerte[] {
  if (!sch.gegnerSchlag) return GEGNER[name];
  return GEGNER[name].map(w => ({ ...w, schlag: { ...w.schlag, ...sch.gegnerSchlag } }));
}

/** Schalter von der Befehlszeile lesen (siehe Kopf). Unbekannte Wörter bleiben liegen. */
export function leseSchalter(woerter: readonly string[]): Schalter {
  const opt: BotOptionen = {};
  let werte: ReinigenWerte = REINIGEN, reinigen = false, gegnerSchlag: Record<string, number> | undefined;
  for (const w of woerter) {
    if (w === 'lauf') opt.nachsetzen = 'lauf';
    else if (w === 'abbruch') opt.abbruch = true;
    else if (w === 'sanft') opt.sanft = true;
    else if (w === 'haltung') opt.haltung = true;
    else if (w === 'reinigen') reinigen = true;
    else if (w === 'alt') Object.assign(opt, { nachsetzen: undefined });
    else if (/^g\.[a-z]+=/.test(w)) { const [k, v] = w.slice(2).split('='); gegnerSchlag = { ...gegnerSchlag, [k]: Number(v) }; }
    else if (/^(schwelle|halten|loesen|nachhall)=/.test(w)) {
      const [k, v] = w.split('=');
      werte = { ...werte, [k]: Number(v), ...(k === 'schwelle' ? { wundAb: Number(v) } : {}) };
    }
  }
  return { opt, werte, gegnerSchlag, spiel: reinigen ? { modus: 'immer', werte } : undefined };
}

/** Ein Kampf mit allen Ereignissen. */
export function protokolliere(aufstellung: KampfWerte[], waffe: WaffenArt, p: Profil, saat: number, sch: Schalter): { ergebnis: Ergebnis; ereignisse: BotEreignis[] } {
  const ereignisse: BotEreignis[] = [];
  const ergebnis = kampf(aufstellung, waffe, p, saat, undefined, 1, undefined, sch.spiel, { ...sch.opt, ereignis: e => ereignisse.push(e) });
  return { ergebnis, ereignisse };
}

const k2 = (x: number) => x.toFixed(2).replace('.', ',');
const k1 = (x: number) => x.toFixed(1).replace('.', ',');
const pct = (x: number) => `${(x * 100).toFixed(0)} %`;

export function zeile(e: BotEreignis): string {
  const t = `${k2(e.t).padStart(6)} s  `;
  switch (e.art) {
    case 'telegraf': return `${t}${e.von} holt aus (${e.schlag}) → Bot ${e.parade ? 'hebt den Block' : 'rollt'} ${Number.isFinite(e.rolleUm) ? `bei ${k2(e.rolleUm)} s` : 'gar nicht (gepatzt)'}`;
    case 'rolle': return `${t}Bot rollt ${e.richtung} (Abstand ${k2(e.rand)} m)`;
    case 'hieb': return `${t}Bot schlägt: ${e.schlag}${e.lauf ? ' aus dem Lauf' : ''} (Rand ${k2(e.rand)} m, Ziel ${e.zielPhase}, noch ${k2(e.rest)} s offen)`;
    case 'treffer': return `${t}  Treffer auf ${e.auf}: ${e.schlag} −${k1(e.schaden)} (Leben ${k1(e.leben)} → ${k1(Math.max(0, e.leben - e.schaden))} von ${e.lebenMax})${e.gebrochen ? ', Haltung gebrochen' : ''}${e.toedlich ? ', TOT' : ''}`;
    case 'einschlag': return `${t}  Bot getroffen von ${e.von}: ${e.schlag}${e.kette ? ' (Kette)' : ''} −${k1(e.schaden)}, war in Phase „${e.phase}“`;
    case 'fenster': return `${t}Fenster ${e.ziel} zu (${e.phase}, ${k2(e.dauer)} s): ${e.hiebe} Hieb(e)${e.hiebe ? '' : e.frei < 0.02 ? ' — Bot war nie frei' : !e.reserve ? ' — Ausdauer reichte nicht' : ` — ${k2(-e.spiel)} s zu spät gewesen`}`;
    case 'griff': return `${t}Marke auf ${e.ziel} (war ${e.aus}), hält ${k2(e.haelt)} s, Stand ${pct(e.reinigung)}`;
    case 'kanal': return `${t}  Kanal ${e.ziel}: ${e.ende}, Stand ${pct(e.reinigung)}`;
  }
}

export interface FensterZeile { gegner: string; profil: string; siege: number; zeit: number; fenster: number; genutzt: number; nieFrei: number; ausdauer: number; zuSpaet: number; knapp: number; telegrafe: number; treffer: number; einschlaege: number }

/** Über `n` Kämpfe: was aus den Erholungsfenstern des Gegners wurde. `knapp`: höchstens 0,15 s zu spät. */
export function zaehleFenster(name: string, waffe: WaffenArt, p: Profil, n: number, sch: Schalter, saat0 = 5000): FensterZeile {
  const z: FensterZeile = { gegner: name, profil: p.name, siege: 0, zeit: 0, fenster: 0, genutzt: 0, nieFrei: 0, ausdauer: 0, zuSpaet: 0, knapp: 0, telegrafe: 0, treffer: 0, einschlaege: 0 };
  for (let i = 0; i < n; i++) {
    const { ergebnis, ereignisse } = protokolliere(aufstellung(name, sch), waffe, p, saat0 + i, sch);
    if (ergebnis.sieg) { z.siege++; z.zeit += ergebnis.zeit; }
    for (const e of ereignisse) {
      if (e.art === 'telegraf') z.telegrafe++;
      else if (e.art === 'treffer') z.treffer++;
      else if (e.art === 'einschlag') z.einschlaege++;
      else if (e.art === 'fenster' && e.phase === 'erholung') {
        z.fenster++;
        if (e.hiebe) z.genutzt++;
        else if (e.frei < 0.02) z.nieFrei++;
        else if (!e.reserve) z.ausdauer++;
        else { z.zuSpaet++; if (e.spiel > -0.15) z.knapp++; }
      }
    }
  }
  z.zeit = z.siege ? z.zeit / z.siege : NaN;
  for (const k of ['fenster', 'genutzt', 'nieFrei', 'ausdauer', 'zuSpaet', 'knapp', 'telegrafe', 'treffer', 'einschlaege'] as const) z[k] /= n;
  z.siege /= n;
  return z;
}

/** Wie ein Kampf „immer reinigen“ ausging und woran — eine Ursache je Kampf. */
export type WolfUrsache = 'gereinigt' | 'tot: Schlag über die Schwelle' | 'tot: wundes Tier geschlagen' | 'verloren' | 'Zeit um';
export interface WolfZaehlung {
  n: number; ursachen: Record<WolfUrsache, number>;
  /** Der tödliche Schlag über die Schwelle: welcher, und stand das Tier dabei betäubt (Haltungsbruch)? */
  toedlich: Record<string, number>;
  /** Schaden an der Spielerin nach Quelle, je Kampf. */
  schaden: Record<string, number>;
  /** Dasselbe nur über die verlorenen Kämpfe. */
  schadenVerloren: Record<string, number>;
  kanaele: number; gebrochen: number; geloest: number; griffeJeReinigung: number; zeit: number;
}

/** Schadensquelle eines Einschlags: welcher Biss, und was die Spielerin gerade tat. */
function quelle(e: Extract<BotEreignis, { art: 'einschlag' }>): string {
  const biss = e.kette ? 'Nachbiss' : 'erster Biss';
  const tat = e.phase === 'reinigen' ? 'im Kanal' : e.phase === 'rolle' ? 'in der Rolle (zu spät)' : e.phase === 'bereit' ? 'stehend' : `in ${e.phase}`;
  return `${biss} ${tat}`;
}

/** „Immer reinigen“ gegen einen Gegner, einzeln, Ursache je Kampf ausgezählt. */
export function zaehleWolf(n: number, waffe: WaffenArt, p: Profil, sch: Schalter, gegner = 'wolf', saat0 = 5000): WolfZaehlung {
  const z: WolfZaehlung = { n, ursachen: { gereinigt: 0, 'tot: Schlag über die Schwelle': 0, 'tot: wundes Tier geschlagen': 0, verloren: 0, 'Zeit um': 0 },
    toedlich: {}, schaden: {}, schadenVerloren: {}, kanaele: 0, gebrochen: 0, geloest: 0, griffeJeReinigung: 0, zeit: 0 };
  const spiel: MarkenSpiel = sch.spiel ?? { modus: 'immer', werte: sch.werte };
  let siege = 0, griffeRein = 0;
  for (let i = 0; i < n; i++) {
    const { ergebnis, ereignisse } = protokolliere(aufstellung(gegner, sch), waffe, p, saat0 + i, { ...sch, spiel });
    const tot = ereignisse.find((e): e is Extract<BotEreignis, { art: 'treffer' }> => e.art === 'treffer' && e.toedlich);
    const quellen: Record<string, number> = {};
    for (const e of ereignisse) if (e.art === 'einschlag') quellen[quelle(e)] = (quellen[quelle(e)] ?? 0) + e.schaden;
    for (const [k, v] of Object.entries(quellen)) z.schaden[k] = (z.schaden[k] ?? 0) + v / n;
    z.kanaele += (ergebnis.kanaele ?? 0) / n; z.gebrochen += (ergebnis.gebrochen ?? 0) / n; z.geloest += (ergebnis.geloest ?? 0) / n;
    if (ergebnis.sieg) { siege++; z.zeit += ergebnis.zeit; }
    if (ergebnis.gereinigt) { z.ursachen.gereinigt++; griffeRein += ergebnis.kanaele ?? 0; }
    else if (tot) {
      const ueber = tot.leben > spiel.werte!.schwelle * tot.lebenMax + 1e-9;
      z.ursachen[ueber ? 'tot: Schlag über die Schwelle' : 'tot: wundes Tier geschlagen']++;
      // Stand es betäubt? Dann war der letzte Treffer davor ein Haltungsbruch (oder der Bot schlug in den Nachhall).
      const davor = ereignisse.filter(e => e.t < tot.t && e.art === 'treffer').at(-1) as Extract<BotEreignis, { art: 'treffer' }> | undefined;
      const lage = davor?.gebrochen && tot.t - davor.t < 1.2 ? 'nach Haltungsbruch' : 'in der Erholung';
      const schluessel = `${tot.schlag} ${lage}`;
      z.toedlich[schluessel] = (z.toedlich[schluessel] ?? 0) + 1;
    } else if (!ergebnis.sieg && ergebnis.zeit < 119.9) {
      z.ursachen.verloren++;
      for (const [k, v] of Object.entries(quellen)) z.schadenVerloren[k] = (z.schadenVerloren[k] ?? 0) + v;
    } else z.ursachen['Zeit um']++;
  }
  const verloren = z.ursachen.verloren || 1;
  for (const k of Object.keys(z.schadenVerloren)) z.schadenVerloren[k] /= verloren;
  z.griffeJeReinigung = z.ursachen.gereinigt ? griffeRein / z.ursachen.gereinigt : NaN;
  z.zeit = siege ? z.zeit / siege : NaN;
  return z;
}

if (process.argv[1]?.endsWith('kampfprotokoll.ts')) {
  const [modus = 'kampf', ...rest] = process.argv.slice(2);
  const sch = leseSchalter(rest);
  const schalterText = rest.filter(w => /^(alt|lauf|abbruch|sanft|haltung|reinigen|g\.[a-z]+=.*|(schwelle|halten|loesen|nachhall)=.*)$/.test(w)).join(' ') || 'keine';
  if (modus === 'kampf') {
    const [gegner = 'gams', waffe = 'klinge', profil = 'aufmerksam', saat = '5000'] = rest;
    const p = PROFILE.find(x => x.name === profil) ?? PROFILE[0];
    const { ergebnis, ereignisse } = protokolliere(aufstellung(gegner, sch), waffe as WaffenArt, p, Number(saat), sch);
    console.log(`Kampf ${gegner}, ${waffe}, ${p.name}, Saat ${saat}, Schalter: ${schalterText}\n`);
    for (const e of ereignisse) console.log(zeile(e));
    console.log(`\n${ergebnis.sieg ? 'Sieg' : 'verloren'} nach ${k1(ergebnis.zeit)} s, ${ergebnis.treffer} Treffer gesetzt, ${ergebnis.erlitten.toFixed(0)} Schaden erlitten`
      + (ergebnis.kanaele !== undefined ? `, gereinigt ${ergebnis.gereinigt}, getötet ${ergebnis.getoetet}, Kanäle ${ergebnis.kanaele}` : ''));
  } else if (modus === 'fenster') {
    const [welche = 'alle', waffe = 'klinge', n = '1000'] = rest;
    const namen = welche === 'alle' ? ['keiler', 'grathorn', 'wolf', 'fuchs', 'gams'] : [welche];
    console.log(`Erholungsfenster des Gegners — ${n} Kämpfe je Zeile, ${waffe}, Saat 5000…, Schalter: ${schalterText}\n`);
    console.log('| Gegner | Profil | Siege | Zeit | Angriffe/Kampf | Fenster/Kampf | genutzt | Bot nie frei | Ausdauer fehlt | zu spät | davon knapp (< 0,15 s) | Treffer/Kampf | Einschläge/Kampf |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const name of namen) for (const p of PROFILE) {
      const z = zaehleFenster(name, waffe as WaffenArt, p, Number(n), sch);
      const a = (x: number) => pct(z.fenster ? x / z.fenster : 0);
      console.log(`| ${name} | ${p.name} | ${pct(z.siege)} | ${k1(z.zeit)} s | ${k1(z.telegrafe)} | ${k1(z.fenster)} | ${a(z.genutzt)} | ${a(z.nieFrei)} | ${a(z.ausdauer)} | ${a(z.zuSpaet)} | ${a(z.knapp)} | ${k1(z.treffer)} | ${k1(z.einschlaege)} |`);
    }
  } else if (modus === 'wolf') {
    const zahl = rest.find(w => /^\d+$/.test(w)), waffe = (rest.find(w => ['klinge', 'axt', 'speer'].includes(w)) ?? 'klinge') as WaffenArt;
    const gegner = rest.find(w => w in GEGNER) ?? 'wolf';
    const n = Number(zahl ?? 1000);
    console.log(`„Immer reinigen“ gegen ${gegner}, ${waffe}, ${n} Kämpfe je Profil, Saat 5000…, Schalter: ${schalterText}\n`);
    for (const p of PROFILE) {
      const z = zaehleWolf(n, waffe, p, sch, gegner);
      console.log(`### ${p.name} — Zeit bis Sieg ${k1(z.zeit)} s, Kanäle ${k1(z.kanaele)} je Kampf (gebrochen ${k2(z.gebrochen)}, gelöst ${k2(z.geloest)}), ${k1(z.griffeJeReinigung)} Griffe je Reinigung`);
      console.log('Ausgang: ' + Object.entries(z.ursachen).map(([k, v]) => `${k} ${pct(v / n)}`).join(' · '));
      console.log('Tödlicher Schlag über die Schwelle: ' + (Object.entries(z.toedlich).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v / n)}`).join(' · ') || '—'));
      console.log('Schaden je Kampf: ' + Object.entries(z.schaden).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${k1(v)}`).join(' · '));
      console.log('Schaden je verlorenem Kampf: ' + (Object.entries(z.schadenVerloren).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${k1(v)}`).join(' · ') || '—') + '\n');
    }
  }
}
