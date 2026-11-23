/**
 * BRACHLAND — Bot-Optionen und Kampfprotokoll (D407).
 *
 * Der Kampfbot ist Messwerkzeug, kein Spielwert. Damit alte Messungen nachrechenbar bleiben, gilt:
 *   * Ohne Optionen ist der Bot der von D171/D376 — Kampf für Kampf; der Fingerabdruck unten ist mit der
 *     Fassung vor D407 (`fce9a34`) gerechnet. Zuhören (`ereignis`) ändert nichts.
 *   * Jede Option tut, was ihr Kommentar sagt: `sanft` führt den tödlichen Schlag an einem befallenen Tier
 *     seltener, `aufgabe` beendet den Kampf gegen einen Menschen beim Haltungsbruch, `reichweite: 'schritt'`
 *     schlägt aus grösserem Abstand.
 *   * Das Protokoll zählt richtig: jeder Griff hat genau eine Quelle, jeder Fortschritt liegt in 0…1.
 */
import { REINIGEN, WEGELAGERER, GAMS, WOLF, FUCHS, type KampfWerte } from '../src/kampf/echtzeit.js';
import { kampf, GEGNER, PROFILE, BOT_D171, BOT_D407, HEILER, type BotEreignis } from '../tools/kampfbot.js';
import { zaehleGriffe, zaehleWolf, zaehleFenster, leseSchalter } from '../tools/kampfprotokoll.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++; console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}

// --- Fingerabdruck des Bots von D171 (gerechnet mit tools/kampfbot.ts aus fce9a34, 22.11.2026)
// Er prüft den Bot, nicht die Daten: Gegner mit den Werten jener Fassung. Seit D426 trägt die Gams 0,85 s Erholung
// (vorher 0,7 s) und der Wolf einen Griff von 1,5 s — hier stehen die alten Zahlen, damit der Abdruck vergleichbar bleibt.
// D427: Trefferstopp nach Wucht — nur die Zeit verschiebt sich (4797,008 → 4800,475 s über 384 Kämpfe, +9 ms je
// Kampf); Treffer, erlittener Schaden, Siege und Reinigungen sind die von fce9a34 (geprüft unten).
const FINGERABDRUCK_D171 = { treffer: 1239, zeit: 4800.475, erlitten: 10681.5, siege: 269, rein: 97 };
const GAMS_D407: KampfWerte = { ...GAMS, schlag: { ...GAMS.schlag, erholung: 0.7 } };
const WOLF_D407: KampfWerte = { ...WOLF, reinigen: { dauer: 4.25 } };
const ALT: Record<string, KampfWerte[]> = { wolf: [WOLF_D407], gams: [GAMS_D407], wegelagerer: GEGNER.wegelagerer, 'wolf+fuchs': [WOLF_D407, FUCHS] };
{
  const { zeit: _z, ...ohneZeit } = abdruck(kampf);
  pruefe('D427: ohne die Zeit derselbe Fingerabdruck wie fce9a34', JSON.stringify(ohneZeit)
    === JSON.stringify({ treffer: 1239, erlitten: 10681.5, siege: 269, rein: 97 }), JSON.stringify(ohneZeit));
}
type K = typeof kampf;
function abdruck(k: (...a: Parameters<K>) => ReturnType<K>) {
  let treffer = 0, zeit = 0, erlitten = 0, siege = 0, rein = 0;
  for (const name of ['wolf', 'gams', 'wegelagerer', 'wolf+fuchs']) for (const waffe of ['klinge', 'axt', 'speer'] as const) for (const p of PROFILE)
    for (const spiel of [undefined, { modus: 'immer' as const, werte: REINIGEN }]) for (let i = 0; i < 4; i++) {
      const e = k(ALT[name], waffe, p, 4000 + i, undefined, 1, undefined, spiel);
      treffer += e.treffer; zeit += e.zeit; erlitten += e.erlitten; siege += e.sieg ? 1 : 0; rein += e.gereinigt ?? 0;
    }
  return { treffer, zeit: Math.round(zeit * 1000) / 1000, erlitten: Math.round(erlitten * 1000) / 1000, siege, rein };
}
const soll = JSON.stringify(FINGERABDRUCK_D171);
pruefe('ohne Optionen: Bot wie D171 (Fingerabdruck)', JSON.stringify(abdruck(kampf)) === soll, JSON.stringify(abdruck(kampf)));
pruefe('BOT_D171: wie ohne Optionen', JSON.stringify(abdruck((...a) => kampf(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], BOT_D171))) === soll);
let gehoert = 0;
pruefe('Zuhören ändert nichts', JSON.stringify(abdruck((...a) => kampf(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], { ereignis: () => { gehoert++; } }))) === soll);
pruefe('… und es gibt etwas zu hören', gehoert > 1000, `${gehoert}`);

// --- reichweite 'schritt': schlägt aus grösserem Abstand (der erste Hieb gegen die Gams)
const ersterHieb = (opt: typeof BOT_D407) => {
  const ev: BotEreignis[] = [];
  kampf([GAMS], 'klinge', PROFILE[0], 5000, undefined, 1, undefined, undefined, { ...opt, ereignis: e => ev.push(e) });
  return Math.max(...ev.filter((e): e is Extract<BotEreignis, { art: 'hieb' }> => e.art === 'hieb').map(e => e.rand));
};
pruefe('Bot D407 setzt Hiebe aus weiterem Abstand als D171', ersterHieb(BOT_D407) > ersterHieb(BOT_D171) + 0.2,
  `${ersterHieb(BOT_D407).toFixed(2)} gegen ${ersterHieb(BOT_D171).toFixed(2)} m`);
pruefe('… und kein Hieb aus weiter als Reichweite + Vorschritt', ersterHieb(BOT_D407) <= (2.8 + 0.6) * 0.9 + 1e-9);

// --- aufgabe: Menschen geben beim Haltungsbruch auf, Tiere nicht (seit D426 die Regel aus echtzeit.ts, der Bot verschont)
let aufg = 0, kuerzer = 0;
for (let i = 0; i < 30; i++) {
  const mit = kampf([WEGELAGERER], 'axt', PROFILE[0], 5000 + i, undefined, 1, undefined, undefined, { aufgabe: true });
  const ohne = kampf([WEGELAGERER], 'axt', PROFILE[0], 5000 + i);
  if (mit.sieg && mit.aufgegeben === 1) aufg++;
  if (mit.sieg && ohne.sieg && mit.zeit <= ohne.zeit + 1e-9) kuerzer++;
  if (mit.aufgegeben && mit.brueche < 1) pruefe('Aufgabe nur nach einem Haltungsbruch', false);
}
pruefe('aufgabe: der Wegelagerer gibt mit der Axt meist auf (≥ 20 von 30)', aufg >= 20, `${aufg}`);
pruefe('aufgabe: nie länger als bis zum Tod', kuerzer >= aufg, `${kuerzer} / ${aufg}`);
const tier = kampf([WOLF], 'axt', PROFILE[0], 5000, undefined, 1, undefined, undefined, { aufgabe: true });
pruefe('aufgabe: Tiere geben nicht auf', tier.aufgegeben === 0);

// --- sanft/HEILER: weniger Tiere über die Schwelle hinweg getötet als D171 (Wolf, müde)
const sch = leseSchalter(['reinigen']);
const alt = zaehleWolf(150, 'klinge', PROFILE[1], { ...sch, opt: BOT_D171 });
const neu = zaehleWolf(150, 'klinge', PROFILE[1], { ...sch, opt: HEILER });
pruefe('Heiler tötet den Wolf seltener über die Schwelle als D171', neu.ursachen['tot: Schlag über die Schwelle'] < alt.ursachen['tot: Schlag über die Schwelle'] / 2,
  `${neu.ursachen['tot: Schlag über die Schwelle']} gegen ${alt.ursachen['tot: Schlag über die Schwelle']}`);
pruefe('Ausgänge summieren sich auf die Kämpfe', Object.values(neu.ursachen).reduce((a, b) => a + b, 0) === 150);

// --- Griffe: jede Quelle zählt, Summe = Kanäle
const g = zaehleGriffe([GAMS], 'klinge', PROFILE[2], 60, { ...sch, opt: HEILER });
let kanaele = 0;
for (let i = 0; i < 60; i++) kanaele += kampf([GAMS], 'klinge', PROFILE[2], 5000 + i, undefined, 1, undefined, sch.spiel, HEILER).kanaele ?? 0;
const summe = Object.values(g.quellen).reduce((s, q) => s + q.griffe, 0) * 60;
pruefe('Griffe nach Quelle summieren sich auf die Kanäle', Math.abs(summe - kanaele) < 1e-6, `${summe} gegen ${kanaele}`);
pruefe('Fortschritt je Griff liegt in 0…1', Object.values(g.quellen).every(q => q.fortschritt >= 0 && q.fortschritt <= 1));
pruefe('ein Griff aus dem Haltungsbruch hält länger als einer aus der Erholung', !g.quellen.Haltungsbruch.griffe || !g.quellen.Erholung.griffe
  || g.quellen.Haltungsbruch.haelt > g.quellen.Erholung.haelt, `${g.quellen.Haltungsbruch.haelt} / ${g.quellen.Erholung.haelt}`);

// --- Fenster: jede Erholung genau einer Ursache
const f = zaehleFenster('gams', 'klinge', PROFILE[0], 40, leseSchalter([]));
pruefe('Fenster: genutzt + nie frei + Ausdauer + zu spät = alle', Math.abs(f.genutzt + f.nieFrei + f.ausdauer + f.zuSpaet - f.fenster) < 1e-9);

console.log(`\nKampfprotokoll und Bot-Optionen (D407): ${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
