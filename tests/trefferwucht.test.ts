/**
 * BRACHLAND — Gewicht spürbar, Runde 2 (D427): was D420 vorbereitet hat, verdrahtet und renderfrei geprüft.
 *
 *  * **Trefferstopp im Kampf je Waffe** (`echtzeit.ts` `trefferstoppVon`, D423): Der Treffer der Spielerin trägt
 *    Waffe und Wucht, die Welt steht so lange wie `trefferstopp(trefferImpuls(…))` — Klinge kürzer als die
 *    60 ms von D171, Axt länger, schwerer Schlag länger als leichter; Gegnertreffer behalten 60 ms.
 *  * **Kamerastoss** (`kamerastoss.ts`): der stärkere gewinnt, klingt e-fach ab, steht zum Anteil in
 *    Schlagrichtung, die Einstellung `kamerawackeln` skaliert und schaltet ab.
 *  * **Reaktion des Leibs** (`gewicht.ts` `reaktionsVerlauf`, `wegVomAngreifer`): Ruck und Ausklingen, Richtung
 *    im Raum des Getroffenen wie `rotation.y` in three.js.
 */
import {
  neuerKaempfer, ruesteAus, setzeSchlagAn, simuliere, blickAuf, SPIELERIN, UEBUNGSGEGNER, KEILER, SCHRITT, TREFFERSTOPP,
  WAFFEN, trefferstoppVon, type Kampfwelt, type Treffer, type WaffenArt, type Schlag,
} from '../src/kampf/echtzeit.js';
import {
  GEWICHT, kameraErlitten, kameraGesetzt, reaktionsVerlauf, schlagWucht, trefferImpuls, trefferstopp, wegVomAngreifer,
} from '../src/kampf/gewicht.js';
import { klingeAb, neuerStoss, stosse, stossVersatz } from '../src/kampf/kamerastoss.js';
import { EINSTELLUNGS_DATEN, erzeugeSpeicher } from '../src/spiel/einstellungen.js';
import { einstellungsWertGueltig } from '../src/data/schema.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}
const nah = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;
const ms = (s: number) => `${(s * 1000).toFixed(1)} ms`;

// ---- 1. Trefferstopp im Kampf je Waffe
/** Ein Schlag der Spielerin mit Waffe `art` gegen einen Pfosten 1,6 m vor ihr; gibt Treffer, Stopp und Welt zurück. */
function ersterTreffer(art: WaffenArt, schlag?: (w: typeof WAFFEN[WaffenArt]) => Schlag) {
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  ruesteAus(s, art);
  const g = neuerKaempfer('g', UEBUNGSGEGNER, 0, -1.6, blickAuf(0, -1.6, 0, 0));
  const w: Kampfwelt = { spielerin: s, gegner: [g], ziel: null, friedlich: true };
  setzeSchlagAn(s, schlag ? schlag(WAFFEN[art]) : undefined);
  let treffer: Treffer | undefined;
  for (let t = 0; t < 2 && !treffer; t += SCHRITT) treffer = simuliere(w, SCHRITT).find(e => e.schaden > 0);
  return { treffer, stopp: w.stopp ?? 0, w, s, g };
}

const stoppJe: Record<string, number> = {};
for (const art of ['klinge', 'axt', 'speer'] as const) {
  const { treffer, stopp, w, s, g } = ersterTreffer(art);
  pruefe(`${art}: der erste leichte Schlag trifft den Pfosten`, !!treffer);
  if (!treffer) continue;
  pruefe(`${art}: der Treffer trägt die Waffe`, treffer.waffe === art, String(treffer.waffe));
  pruefe(`${art}: Wucht des ersten leichten Schlags ist 1`, nah(treffer.wucht ?? 0, 1));
  const soll = trefferstopp(trefferImpuls(art), treffer);
  pruefe(`${art}: Stopp nach Wucht (${ms(soll)})`, nah(stopp, soll, 1e-12), ms(stopp));
  stoppJe[art] = stopp;
  // Die Welt steht so lange still — und läuft danach weiter.
  const z0 = s.zeit, gz = g.zeit;
  simuliere(w, Math.floor(soll / SCHRITT) * SCHRITT - SCHRITT * 0.5);
  pruefe(`${art}: im Stopp steht die Uhr`, s.zeit === z0 && g.zeit === gz);
  simuliere(w, SCHRITT * 3);
  pruefe(`${art}: nach dem Stopp läuft sie weiter`, s.zeit > z0);
}
pruefe('Klinge hält kürzer an als die 60 ms von D171', stoppJe.klinge < TREFFERSTOPP, ms(stoppJe.klinge));
pruefe('Axt hält länger an als die 60 ms von D171', stoppJe.axt > TREFFERSTOPP, ms(stoppJe.axt));
pruefe('Reihenfolge nach Masse: Klinge < Saufeder < Axt', stoppJe.klinge < stoppJe.speer && stoppJe.speer < stoppJe.axt,
  `${ms(stoppJe.klinge)} / ${ms(stoppJe.speer)} / ${ms(stoppJe.axt)}`);
// Der Pfosten bricht unter dem ersten Axthieb (Haltung 50): +20 ms — ohne Bruch 96 ms nach den Modellmassen von D421 (D407).
pruefe('Axthieb ohne Bruch 96 ms (D407), Saufeder 58 ms', Math.round(trefferstopp(trefferImpuls('axt')) * 1000) === 96
  && Math.round(trefferstopp(trefferImpuls('speer')) * 1000) === 58, ms(trefferstopp(trefferImpuls('axt'))));
{
  const leicht = ersterTreffer('axt'), schwer = ersterTreffer('axt', w => w.schwer);
  pruefe('schwerer Axthieb: Wucht über 1 (Haltungsschaden der Regel)', (schwer.treffer?.wucht ?? 0) > 1,
    String(schwer.treffer?.wucht));
  pruefe('schwerer Axthieb hält länger an als der leichte', schwer.stopp > leicht.stopp, `${ms(schwer.stopp)} gegen ${ms(leicht.stopp)}`);
  pruefe('Wucht = schlagWucht der Regel', nah(schwer.treffer?.wucht ?? 0, schlagWucht(WAFFEN.axt.schwer, WAFFEN.axt.leicht[0])));
}
// Gegner tragen keine Waffe: 60 ms bis zur Messung (Baukasten §28 Nr. 7).
{
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  const g = neuerKaempfer('g', KEILER, 0, -1.6, blickAuf(0, -1.6, 0, 0));
  const w: Kampfwelt = { spielerin: s, gegner: [g], ziel: null, friedlich: true };
  setzeSchlagAn(g);
  let e: Treffer | undefined;
  for (let t = 0; t < 3 && !e; t += SCHRITT) e = simuliere(w, SCHRITT).find(x => x.schaden > 0 && x.auf === 's');
  pruefe('Gegnertreffer: ohne Waffe', !!e && e.waffe === undefined && e.wucht === undefined);
  pruefe('Gegnertreffer: Stopp bleibt 60 ms', nah(w.stopp ?? 0, TREFFERSTOPP, 1e-12), ms(w.stopp ?? 0));
}
// trefferstoppVon: der stärkste zählt, ohne Schaden kein Stopp, Obergrenze gegen Ruckeln.
{
  const t = GEWICHT.trefferstopp;
  const e = (x: Partial<Treffer>): Treffer => ({ von: 's', auf: 'g', schaden: 10, gebrochen: false, toedlich: false, ausgewichen: false, ...x });
  pruefe('ohne Treffer mit Schaden: kein Stopp', trefferstoppVon([e({ schaden: 0, waffe: 'axt' }), e({ schaden: 0 })]) === 0);
  pruefe('Gegner und Klinge im selben Teilschritt: der längere (60 ms) gilt',
    nah(trefferstoppVon([e({ waffe: 'klinge', wucht: 1 }), e({ von: 'g', auf: 's' })]), TREFFERSTOPP));
  pruefe('Axt und Klinge im selben Teilschritt: die Axt gilt',
    nah(trefferstoppVon([e({ waffe: 'klinge', wucht: 1 }), e({ waffe: 'axt', wucht: 1 })]), trefferstopp(trefferImpuls('axt'))));
  const oben = trefferstoppVon([e({ waffe: 'axt', wucht: 50, gebrochen: true, toedlich: true })]);
  pruefe('Obergrenze: höchstens max + tödlich', nah(oben, t.max + t.toedlich), ms(oben));
  pruefe('Obergrenze liegt bei höchstens 150 ms', t.max + t.toedlich <= 0.15 + 1e-12);
  pruefe('Haltungsbruch verlängert', trefferstoppVon([e({ waffe: 'klinge', gebrochen: true })]) > trefferstoppVon([e({ waffe: 'klinge' })]));
}

// ---- 2. Kamerastoss
{
  const z = neuerStoss();
  const klinge = kameraGesetzt(trefferImpuls('klinge'), [-1, 0, 0]);
  const axt = kameraGesetzt(trefferImpuls('axt'), [0, -1, 0]);
  pruefe('Axt stösst stärker als die Klinge', axt.staerke > klinge.staerke, `${axt.staerke.toFixed(3)} / ${klinge.staerke.toFixed(3)} m`);
  pruefe('Axt klingt länger aus', axt.abklingen > klinge.abklingen);
  stosse(z, klinge); stosse(z, axt); stosse(z, klinge);
  pruefe('im selben Bild gewinnt der stärkere, keine Summe', nah(z.staerke, axt.staerke) && z.richtung?.[1] === -1);
  const v = stossVersatz({ ...z, uhr: 0 });
  // Bei uhr 0 ist das Zittern in x 0 (sin 0): x = 0, y = Stoss nach unten + Zittern sin(1,3)·(1−anteil).
  pruefe('Stoss steht zum Anteil in Schlagrichtung', nah(v[1], -axt.staerke * axt.anteil + axt.staerke * (1 - axt.anteil) * Math.sin(1.3), 1e-12)
    && nah(v[0], 0, 1e-12), v.map(x => x.toFixed(4)).join(', '));
  const vor = z.staerke;
  klingeAb(z, axt.abklingen);
  pruefe('klingt e-fach über `abklingen` ab', nah(z.staerke, vor / Math.E, 1e-12));
  klingeAb(z, 2);
  pruefe('nach 2 s ist nichts mehr da', z.staerke === 0 && stossVersatz(z).every(x => x === 0));
  const aus = neuerStoss(); stosse(aus, axt, 0);
  pruefe('Kamerawackeln 0 %: kein Stoss', aus.staerke === 0);
  const halb = neuerStoss(); stosse(halb, axt, 0.5);
  pruefe('Kamerawackeln 50 %: halbe Stärke', nah(halb.staerke, axt.staerke / 2));
  const er = kameraErlitten(30);
  pruefe('erlitten: nach Schaden, ohne Richtung, nur Zittern', er.richtung === null && er.anteil === 0 && er.staerke > kameraErlitten(5).staerke);
  pruefe('erlitten (Keiler-Ramme 30) stärker als der eigene Axthieb — der fremde soll wehtun', er.staerke > axt.staerke);
  const winzig = neuerStoss(); stosse(winzig, { staerke: 0.001, abklingen: 0.1, richtung: null, anteil: 0 });
  pruefe('unter 2 mm kein Versatz (D171)', stossVersatz(winzig).every(x => x === 0));
}

// ---- 3. Reaktion des Leibs
pruefe('Verlauf: 0 am Anfang, voll nach einem Viertel, 0 am Ende', reaktionsVerlauf(0) === 0 && nah(reaktionsVerlauf(0.25), 1)
  && reaktionsVerlauf(1) === 0 && reaktionsVerlauf(-0.1) === 0 && reaktionsVerlauf(0.6) > 0 && reaktionsVerlauf(0.6) < 1);
{
  // three.js: rotation.y = θ bildet lokal (x, z) auf Welt (x cosθ + z sinθ, −x sinθ + z cosθ) ab.
  let ok = true;
  for (const blick of [0, 0.7, -2.1, Math.PI]) for (const [dx, dz] of [[1, 0], [0, -2], [-1.5, 0.5]]) {
    const [lx, lz] = wegVomAngreifer(dx, dz, blick), d = Math.hypot(dx, dz);
    const wx = lx * Math.cos(blick) + lz * Math.sin(blick), wz = -lx * Math.sin(blick) + lz * Math.cos(blick);
    ok &&= nah(wx, dx / d, 1e-12) && nah(wz, dz / d, 1e-12);
  }
  pruefe('weg vom Angreifer: im Raum der Gruppe, zurückgedreht = Weltrichtung', ok);
  pruefe('weg vom Angreifer: auf derselben Stelle keine Richtung', wegVomAngreifer(0, 0, 1).every(x => x === 0));
}

// ---- 4. Einstellungen (D415-Speicher)
{
  const e = EINSTELLUNGS_DATEN.einstellungen.find(x => x.id === 'kamerawackeln');
  pruefe('Einstellung kamerawackeln gibt es (Zugänglichkeit, Regler)', !!e && e.gruppe === 'zugaenglichkeit' && e.art === 'regler');
  if (e) {
    pruefe('kamerawackeln: Standard 100 % (Menü-Dokument §6.6)', e.standard === 100);
    pruefe('kamerawackeln: aus/gering/voll = 0/50/100 gültig, 25 nicht', [0, 50, 100].every(w => einstellungsWertGueltig(e, w)) && !einstellungsWertGueltig(e, 25));
  }
  const sp = erzeugeSpeicher({ adresse: new URLSearchParams('wackeln=0') });
  pruefe('kamerawackeln über die Adresse (?wackeln=0) für Messläufe', sp.wert('kamerawackeln') === 0 && sp.quelle('kamerawackeln') === 'adresse');
  const fx = EINSTELLUNGS_DATEN.einstellungen.find(x => x.id === 'lautstaerke-effekte');
  pruefe('Effekte-Regler gibt es (Ton, Standard 100 %)', !!fx && fx.gruppe === 'ton' && fx.standard === 100);
}

console.log(`\nTrefferwucht — Stopp Klinge ${ms(stoppJe.klinge)}, Saufeder ${ms(stoppJe.speer)}, Axt ${ms(stoppJe.axt)} (Pfosten bricht), Gegner ${ms(TREFFERSTOPP)}`);
console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
