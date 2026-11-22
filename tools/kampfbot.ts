/**
 * BRACHLAND — Kampfbot (D171): spielt gegen jeden Gegner mit menschlicher Reaktionszeit und misst,
 * wie schwer der Kampf ist.
 *
 * Das Kampftor (`tests/echtzeit.test.ts`) prüft Fenster und Regeln einzeln. Ob die Summe fair ist —
 * ob ein Mensch, der aufpasst, einen Wolf schlägt und ein unaufmerksamer nicht immer —, sieht man
 * erst im ganzen Kampf. Der Bot spielt ihn aus, ohne Grafik, in denselben Teilschritten wie das Spiel.
 *
 * Der Bot tut, was man einem Anfänger nach zehn Minuten zutraut:
 *   * Er sieht den Gegner ausholen und rollt nach seiner Reaktionszeit (Normalverteilung, Mittel und
 *     Streuung je Profil) — bei einer Kette (Wolf) weg vom Gegner, sonst schräg zurück.
 *   * Steht der Gegner in der Erholung oder taumelt, geht er hin und schlägt: leicht in Kette, auf
 *     einen taumelnden Gegner schwer.
 *   * Er verschätzt sich: Mit `patzer` Wahrscheinlichkeit rollt er zu spät oder gar nicht.
 *
 *   npx tsx tools/kampfbot.ts [kämpfe=200]
 */
import { RENNEN } from '../src/spieler/tempo.js';
import {
  SPIELERIN, KEILER, GRATHORN, WOLF, FUCHS, GAMS, WEGELAGERER, andereLinie, UEBUNGSGEGNER, SCHRITT, WAFFEN,
  neuerKaempfer, blickAuf, puffere, setzeBlockAn, loeseBlock, ruesteAus, simuliere, frei, naechsterSchlag,
  neueMarke, istBefallen, kannReinigen, setzeReinigenAn, loeseReinigen, randAbstand, reinigenFenster, REINIGEN,
  type KampfWerte, type Kampfwelt, type WaffenArt, type ReinigenWerte,
} from '../src/kampf/echtzeit.js';

/**
 * D376: Wie der Bot mit der Marke umgeht. `immer`: jedes Tier reinigen, auch mitten im Rudel —
 * er löst und rollt, wenn er einen Angriff kommen sieht (oder patzt und wird getroffen). `sicher`:
 * töten, solange noch ein anderer steht, und nur den Letzten reinigen. Ohne Angabe: keine Marke,
 * der Bot spielt wie vor D376.
 */
export interface MarkenSpiel { modus: 'immer' | 'sicher'; werte?: ReinigenWerte; zustand?: 'befallen' | 'verhaertet'; reinkultur?: boolean }

/** `parade` (D173): pariert statt zu rollen — hebt den Block kurz vor dem Aktiven; nur der Rammstoss wird gerollt. */
export interface Profil { name: string; reaktion: number; streuung: number; patzer: number; parade?: boolean }
export const PROFILE: Profil[] = [
  { name: 'aufmerksam', reaktion: 0.25, streuung: 0.05, patzer: 0.1 },
  { name: 'müde', reaktion: 0.4, streuung: 0.08, patzer: 0.25 },
  { name: 'parierend', reaktion: 0.25, streuung: 0.08, patzer: 0.1, parade: true },
];
/** Aufstellungen: einzeln und zu zweit (wie `?kampf=1` bzw. `?kampf=wolf`). */
export const GEGNER: Record<string, KampfWerte[]> = {
  kapsel: [UEBUNGSGEGNER], keiler: [KEILER], grathorn: [GRATHORN], wolf: [WOLF], fuchs: [FUCHS], gams: [GAMS],
  'keiler+grathorn': [KEILER, GRATHORN], 'wolf+wolf': [WOLF, WOLF], 'wolf+fuchs': [WOLF, FUCHS], 'gams+gams': [GAMS, GAMS], wegelagerer: [WEGELAGERER], 'wegelagerer+wolf': [WEGELAGERER, WOLF], 'wolf+wolf+wolf': [WOLF, WOLF, WOLF],
};

/** Kleiner deterministischer Zufall (mulberry32) — dieselbe Saat, dieselben Kämpfe. */
function zufall(saat: number) {
  let a = saat >>> 0;
  const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const normal = (m: number, s: number) => m + s * Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  return { r, normal };
}

export interface Ergebnis { sieg: boolean; zeit: number; erlitten: number; treffer: number; paraden: number; blocks: number;
  /** D407: Haltungsbrüche, die die Spielerin gesetzt hat (ohne tödliche Treffer). */
  brueche: number;
  /** D407, nur mit `BotOptionen.aufgabe`: Menschen, die beim Haltungsbruch aufgaben (D385). */
  aufgegeben?: number;
  /** D376, nur mit Marke: gereinigte und getötete Tiere, begonnene Kanäle, davon durch Treffer gebrochen bzw. selbst gelöst. */
  gereinigt?: number; getoetet?: number; kanaele?: number; gebrochen?: number; geloest?: number }

/** Wer traf die Spielerin, in welcher ihrer Phasen, mit welchem Schlag — für die Diagnose. */
export interface Einschlag { von: string; phase: string; schlag: string; rand: number }

/**
 * D407: Was im Kampf geschah — für das Protokoll einzelner Kämpfe (`tools/kampfprotokoll.ts`). Wer nicht
 * zuhört, zahlt nichts: Ohne `BotOptionen.ereignis` wird kein Ereignis gebaut.
 *   `telegraf`  der Bot sieht einen Angriff beginnen; `rolleUm` ist, wann er rollen will (∞: gepatzt, gar nicht)
 *   `rolle`     die Rolle ist gedrückt
 *   `hieb`      ein Schlag ist gedrückt (`rand`: Abstand zum Rand des Ziels, `rest`: wie lange es noch offen steht)
 *   `treffer`   die Spielerin trifft (`leben`: Leben des Ziels davor)
 *   `einschlag` die Spielerin wird getroffen (`phase`: ihre Phase davor)
 *   `fenster`   der Gegner stand offen und steht es nicht mehr: wie lange, wie viele Hiebe der Bot hineinsetzte,
 *               wie lange er dabei frei war (`frei`) und wie viel Luft der beste Moment hatte (`spiel` = Rest des
 *               Fensters − Weg − Vorlauf, negativ heisst: der Hieb wäre zu spät gekommen; `reserve`: Ausdauer reichte)
 *   `griff`     die Marke ist aufgelegt (`aus`: in welcher Phase das Tier war, `haelt`: wie lange sie es hält)
 *   `kanal`     der Kanal endete: gereinigt, vom Treffer gebrochen oder selbst gelöst (`reinigung`: Stand danach)
 */
export type BotEreignis = { t: number } & (
  | { art: 'telegraf'; von: string; schlag: string; rolleUm: number; parade: boolean }
  | { art: 'rolle'; richtung: 'zurück' | 'seitwärts'; rand: number }
  | { art: 'hieb'; schlag: string; schwer: boolean; rand: number; rest: number; zielPhase: string; lauf: boolean }
  | { art: 'treffer'; auf: string; schlag: string; schaden: number; leben: number; lebenMax: number; gebrochen: boolean; toedlich: boolean }
  | { art: 'einschlag'; von: string; schlag: string; schaden: number; phase: string; kette: boolean }
  | { art: 'fenster'; ziel: string; phase: string; dauer: number; hiebe: number; frei: number; spiel: number; reserve: boolean }
  | { art: 'griff'; ziel: string; aus: string; haelt: number; reinigung: number }
  | { art: 'kanal'; ziel: string; ende: 'gereinigt' | 'getroffen' | 'geloest'; reinigung: number }
);

/**
 * D407: Stellschrauben am Bot — alle aus heisst: der Bot von D171/D376, Kampf für Kampf wie zuvor
 * (`tests/kampfbot.test.ts` hält das fest). Sie sind Spielweisen, keine Spielwerte.
 */
export interface BotOptionen {
  ereignis?: (e: BotEreignis) => void;
  /**
   * Nachsetzen nach der Rolle. Der Bot von D171 geht (4,5 m/s) und schlägt aus dem Stand; passt das nicht
   * mehr in die Erholung des Gegners, bleibt er stehen und wartet auf das nächste Telegraf. `lauf`: Dann
   * rennt er hin (`RENNEN`, 11 m/s) und setzt den Laufangriff der Waffe — was das Spiel mit Shift + Schlag tut
   * (`Kampfplatz.tsx`), der Bot aber nie konnte.
   */
  nachsetzen?: 'lauf';
  /**
   * Die Rolle fallen lassen, wenn der Angriff gar nicht mehr kommt: Der eigene Treffer hat den Angreifer
   * betäubt (Haltungsbruch, Wurf) oder gefällt, und das ist länger her als die Reaktionszeit. Der Bot von
   * D171 rollte trotzdem — weg von einem Tier, das offen dalag, für 24 Ausdauer.
   */
  abbruch?: boolean;
  /**
   * Heiler nahe der Schwelle: nie den Schlag führen, der das Tier tötet. Reicht der schwere Schlag über
   * das Leben, nimmt er den leichten; tötet auch der, lässt er es und wartet auf das nächste Fenster.
   */
  sanft?: boolean;
  /**
   * Heiler nutzt die Haltung: Ein wundes Tier schlägt er doch, wenn der Schlag es nicht tötet **und** seine
   * Haltung bricht — dann liegt es betäubt, und der Griff hält den Rest der Betäubung obendrauf.
   */
  haltung?: boolean;
  /**
   * Seine Reichweite richtig einschätzen: Der Bot von D171 rechnet mit 90 % der Reichweite und ohne den
   * Vorschritt des Schlags (`schritt`, Klinge 0,3–0,6 m, D171). `schritt`: Der Vorschritt zählt mit
   * (zu 90 % wie die Reichweite) — wer zehn Minuten spielt, weiss, wie weit der eigene Hieb trägt. Nicht
   * gegen einen Lauernden in der Atempause: Dort trüge der Schritt ihn in den Ring der Meute (gemessen:
   * drei Wölfe mit Klinge 92 → 12 % Siege, wenn der Schritt auch dort zählt).
   */
  reichweite?: 'schritt';
  /**
   * Messannahme nach D385, **nicht** in `echtzeit.ts` gebaut: Ein Mensch gibt beim ersten Haltungsbruch auf
   * (Flucht oder Aufgabe) und ist aus dem Kampf. Tiere kämpfen weiter wie bisher.
   */
  aufgabe?: boolean;
}

/** Der Bot von D171/D376 ohne die Zusätze aus D407 — für Vergleiche davor/danach. */
export const BOT_D171: BotOptionen = {};
/**
 * D407: der korrigierte Bot — kennt die Reichweite seines Hiebs samt Vorschritt (Reinigen v1 §6 „Nachmessung
 * D407“). Spielt sonst wie D171. Die Messwerkzeuge aus D407 spielen mit ihm; `kampf()` ohne Optionen bleibt D171.
 */
export const BOT_D407: BotOptionen = { reichweite: 'schritt' };
/** D407: der Heiler — Bot D407, der den tödlichen Schlag an einem befallenen Tier schont und die Haltung nutzt. */
export const HEILER: BotOptionen = { ...BOT_D407, sanft: true, haltung: true };

export function kampf(aufstellung: KampfWerte[], waffe: WaffenArt, p: Profil, saat: number,
                      beobachte?: (e: Einschlag) => void, schadenFaktor = 1, element?: 'wasser' | 'stein', markenSpiel?: MarkenSpiel,
                      opt: BotOptionen = {}): Ergebnis {
  const z = zufall(saat);
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  ruesteAus(s, waffe);
  s.schadenFaktor = schadenFaktor;
  if (element) { s.element = element; s.ladung = 0; }
  const alle = aufstellung.map((werte, i) => {
    const winkel = (z.r() - 0.5) * 1.2 + (i ? 0.9 : 0);
    const k = neuerKaempfer(`g${i}`, werte, -Math.sin(winkel) * (8 + 2 * i), -Math.cos(winkel) * (8 + 2 * i), 0);
    k.blick = blickAuf(k.x, k.z, 0, 0);
    return k;
  });
  const w: Kampfwelt = { spielerin: s, gegner: alle, ziel: null };
  let kanaele = 0, gebrochen = 0, geloest = 0, brueche = 0, aufgegeben = 0;
  if (markenSpiel) {
    // Die Ladung ist hier nicht die Frage (die rechnet die Ökonomie) — genug für jeden im Kampf.
    w.marke = { ...neueMarke(0, markenSpiel.werte ?? REINIGEN), ladung: 99, reinkultur: markenSpiel.reinkultur };
    if (markenSpiel.zustand) for (const g of alle) g.zustand = markenSpiel.zustand;
  }
  let t = 0, rolleUm = Infinity, blockUm = Infinity, paraden = 0, blocks = 0, treffer = 0, kette = false, angreifer = '', zweite = false, seite = 1;
  const gesehen = alle.map(g => g.schwung);
  // D407, nur fürs Protokoll: je Gegner das laufende offene Fenster.
  const fenster = new Map<string, { t0: number; phase: string; hiebe: number; frei: number; spiel: number; reserve: boolean }>();
  const fuehreFenster = (lebend: typeof alle) => {
    for (const g of alle) {
      const offen = lebend.includes(g) && (g.phase === 'erholung' && g.folge.length === 0 || g.phase === 'betaeubt');
      let f = fenster.get(g.id);
      if (!offen) {
        if (f) { opt.ereignis!({ t, art: 'fenster', ziel: g.id, phase: f.phase, dauer: t - f.t0, hiebe: f.hiebe, frei: f.frei, spiel: f.spiel, reserve: f.reserve }); fenster.delete(g.id); }
        continue;
      }
      if (!f) { f = { t0: t, phase: g.phase, hiebe: 0, frei: 0, spiel: -Infinity, reserve: true }; fenster.set(g.id, f); }
      if (!frei(s)) continue;
      f.frei += SCHRITT;
      const n = naechsterSchlag(s, 'leicht').schlag;
      const rand = Math.hypot(g.x - s.x, g.z - s.z) - g.werte.radius - (g.werte.halbLaenge ?? 0) * 0.5;
      const rest = g.phase === 'erholung' ? g.schlag.erholung - g.zeit : (g.betaeubtFuer ?? g.werte.betaeubt) - g.zeit;
      const spiel = rest - Math.max(0, rand - n.reichweite * 0.9) / 4.5 - n.vorlauf;
      if (spiel > f.spiel) { f.spiel = spiel; f.reserve = s.ausdauer.wert - n.kosten >= s.werte.rolle.kosten; }
    }
  };
  while (t < 120 && s.phase !== 'gefallen' && alle.some(g => g.phase !== 'gefallen')) {
    // Wahrnehmen: ein neuer Angriff (erster Schlag, nicht die Kette) → Rolle nach der Reaktionszeit.
    alle.forEach((g, i) => {
      if (g.schwung === gesehen[i]) return;
      // D174: Gegen Menschen pariert der Bot auch den Nachhieb — er kommt aus einer anderen Linie.
      if (g.phase === 'vorlauf' && (g.schlag === g.werte.schlag || (p.parade && g.werte.mensch))) {
        const patzt = z.r() < p.patzer;
        if (p.parade && !g.schlag.durch) {
          // Parieren heisst: das Ende des Vorlaufs treffen, nicht nur reagieren. Fehler ± Streuung.
          blockUm = t + Math.max(0.12, g.schlag.vorlauf - 0.09 + z.normal(0, p.streuung) + (patzt ? 0.2 : 0));
          kette = false; angreifer = g.id; gesehen[i] = g.schwung;
          opt.ereignis?.({ t, art: 'telegraf', von: g.id, schlag: g.schlag.name ?? '', rolleUm: blockUm, parade: true });
          return;
        }
        rolleUm = patzt && z.r() < 0.5 ? Infinity : t + Math.max(0.12, z.normal(p.reaktion, p.streuung)) + (patzt ? 0.2 : 0);
        kette = !!g.werte.kette?.length;
        angreifer = g.id;
        opt.ereignis?.({ t, art: 'telegraf', von: g.id, schlag: g.schlag.name ?? '', rolleUm, parade: false });
      }
      gesehen[i] = g.schwung;
    });
    // Ziel: wer gerade angreift, sonst der nächste Lebende.
    const lebend = alle.filter(g => g.phase !== 'gefallen');
    if (opt.nachsetzen) s.rennt = false;
    if (opt.ereignis) fuehreFenster(lebend);
    const naechster = lebend.reduce((a, b) =>
      Math.hypot(a.x - s.x, a.z - s.z) <= Math.hypot(b.x - s.x, b.z - s.z) ? a : b);
    // In der Atempause (D172) den Nächsten nehmen — wer lauert, steht offen.
    const lauert = (w.atem ?? 0) > 0.2;
    const g = lauert ? naechster : (lebend.find(k => k.id === w.recht) ?? naechster);
    w.ziel = g.id;
    const dx = g.x - s.x, dz = g.z - s.z, d = Math.hypot(dx, dz);
    const rand = d - g.werte.radius - (g.werte.halbLaenge ?? 0) * 0.5;
    const a = alle.find(k => k.id === angreifer) ?? g;
    const ax = a.x - s.x, az = a.z - s.z, ad = Math.hypot(ax, az) || 1;
    // D376: Im Kanal sieht er den Angriff kommen — lösen, dann greift die Rolle unten.
    if (w.marke && s.phase === 'reinigen' && t >= rolleUm) loeseReinigen(w);
    // D376: Will er dieses Tier reinigen? `sicher` nur den Letzten.
    const will = (k: typeof g) => !!w.marke && istBefallen(k) && (k.zustand !== 'verhaertet' || !!w.marke.reinkultur)
      && (markenSpiel!.modus === 'immer' || lebend.length === 1);
    // D407 `abbruch`: Der Angriff, auf den die Rolle wartete, ist geplatzt — und er hat es gesehen.
    if (opt.abbruch && rolleUm < Infinity && a.id === angreifer
        && (a.phase === 'gefallen' || (a.phase === 'betaeubt' && a.zeit >= p.reaktion))) rolleUm = Infinity;
    if (t >= blockUm) {
      // Linie lesen (D174): Der Bot deckt die Linie, aus der der Mensch kommt.
      if (a.schlagLinie) s.linie = a.schlagLinie;
      if (s.phase !== 'block') setzeBlockAn(s);
      // Halten, bis der Schlag vorbei ist (oder pariert — dann steht der Angreifer betäubt).
      if (a.phase !== 'vorlauf' && a.phase !== 'aktiv') { loeseBlock(s); blockUm = Infinity; }
    } else if (t >= rolleUm) {
      // Zur Seite aus dem Bogen des **Angreifers** (nicht des Ziels — im Rudel sind das zwei) —
      // dann steht man nach der Rolle nah genug, um in seine Erholung zu schlagen. Gegen eine Kette
      // zweimal (D171: die Doppelrolle schützt vor beiden Bissen). Erste Fassung rollte gerade weg
      // und stand nach dem Nachbiss 5 m entfernt: im Rudel nie ein Treffer, 53 von 60 Kämpfen in
      // die Zeitgrenze.
      seite = -seite;
      if (kette && lebend.length === 1) {
        // Allein gegen eine Kette: gerade zurück, dann ist man aus beiden Bissen und kommt wieder rein.
        puffere(s, 'rolle', -ax / ad, -az / ad);
        zweite = false;
        opt.ereignis?.({ t, art: 'rolle', richtung: 'zurück', rand: ad });
      } else {
        puffere(s, 'rolle', (-az / ad) * seite, (ax / ad) * seite);
        zweite = kette;
        opt.ereignis?.({ t, art: 'rolle', richtung: 'seitwärts', rand: ad });
      }
      rolleUm = Infinity;
    } else if (zweite && s.phase === 'rolle' && s.zeit > s.werte.rolle.dauer - 0.1) {
      puffere(s, 'rolle', (-az / ad) * seite, (ax / ad) * seite);
      zweite = false;
    } else if (w.marke && (frei(s) || s.phase === 'erholung') && lebend.some(k => will(k) && kannReinigen(w, k))
        && s.ausdauer.wert - w.marke.werte.ausdauer >= s.werte.rolle.kosten
        && !lebend.some(k => k.phase === 'vorlauf' || k.phase === 'aktiv')) {
      // D376: Greifbar und niemand holt gerade aus — die Marke auflegen.
      const k = lebend.filter(k => will(k) && kannReinigen(w, k)).reduce((a, b) => randAbstand(s, a) <= randAbstand(s, b) ? a : b);
      // Kam das Telegraf von eben diesem Tier, ist es erledigt: Es liegt.
      const aus = k.phase;
      if (setzeReinigenAn(w, k.id)) {
        if (angreifer === k.id) rolleUm = Infinity;
        opt.ereignis?.({ t, art: 'griff', ziel: k.id, aus, haelt: k.betaeubtFuer ?? 0, reinigung: k.reinigung ?? 0 });
      }
    } else if (w.marke && will(g) && reinigenFenster(w.marke.werte, g, lauert) && (!frei(s) || randAbstand(s, g) > w.marke.werte.reichweite)) {
      // D376: Offen für die Marke, aber zu weit (oder noch in der eigenen Erholung) — herangehen statt zuschlagen.
      if (frei(s)) {
        s.blick = blickAuf(s.x, s.z, g.x, g.z);
        const v = Math.min(4.5 * SCHRITT, randAbstand(s, g) - w.marke.werte.reichweite + 0.05); s.x += dx / d * v; s.z += dz / d * v;
      }
    } else if (frei(s) || s.phase === 'erholung') {
      if (frei(s)) s.blick = blickAuf(s.x, s.z, g.x, g.z);
      const offen = g.phase === 'erholung' && g.folge.length === 0 || g.phase === 'betaeubt' || (lauert && g.phase === 'bereit');
      // D181: Mit einem standfesten Schlag (Axt) greift er auch an, wenn der Gegner gerade ausholt und
      // der eigene Hieb vorher ankommt — der Treffer wirft ihn aus dem Vorlauf.
      const vorher = naechsterSchlag(s, 'leicht').schlag;
      const durch = !!vorher.standfest && !!vorher.wirft && g.phase === 'vorlauf' && g.schlag.vorlauf - g.zeit > vorher.vorlauf + 0.05;
      // Wie lange er noch offen steht — ein Mensch schlägt nur, wenn der Schlag vorher ankommt.
      const rest = !offen ? 0 : g.phase === 'erholung' ? g.schlag.erholung - g.zeit
        : g.phase === 'betaeubt' ? (g.betaeubtFuer ?? g.werte.betaeubt) - g.zeit : (w.atem ?? 0);
      const restD = durch ? g.schlag.vorlauf - g.zeit : rest;
      // D189: Mit vollem Funken schlägt er schwer, sobald der Schlag ins Fenster passt (Flutstoss).
      // D189: Mit vollem Funken schwer — aber nur, wenn der schwere Schlag ins Fenster passt; sonst leicht
      // weiter (erste Fassung wartete auf ein grosses Fenster und schlug gar nicht mehr: Axt 100 → 27 %).
      const schwerPasst = (s.ladung ?? 0) >= 1 && (() => {
        const sw = naechsterSchlag(s, 'schwer').schlag;
        const r = g.phase === 'erholung' ? g.schlag.erholung - g.zeit : g.phase === 'betaeubt' ? (g.betaeubtFuer ?? g.werte.betaeubt) - g.zeit : 0;
        return r > Math.max(0, rand - sw.reichweite * 0.9) / 4.5 + sw.vorlauf;
      })();
      let art: 'schwer' | 'leicht' = g.phase === 'betaeubt' || schwerPasst ? 'schwer' : 'leicht';
      // D407 `sanft`: Wer reinigen will, führt nicht den Schlag, der tötet — statt schwer leicht, statt
      // mitten in der Kette lieber den ersten (schwächsten) abwarten. Tötet auch der, bleibt nur er.
      const toetet = (a: 'schwer' | 'leicht') => naechsterSchlag(s, a).schlag.schaden * (s.schadenFaktor ?? 1) >= g.leben - 1e-9;
      let wartet = false;
      if (opt.sanft && will(g)) {
        if (art === 'schwer' && toetet('schwer')) art = 'leicht';
        if (toetet('leicht') && naechsterSchlag(s, 'leicht').kombo !== 0) wartet = true;
      }
      const naechster = naechsterSchlag(s, art).schlag;
      const reich = (naechster.reichweite + (opt.reichweite === 'schritt' && !(lauert && g.phase === 'bereit') ? naechster.schritt ?? 0 : 0)) * 0.9;
      const weg = Math.max(0, rand - reich) / 4.5;
      // Ausdauer für eine Rolle bleibt übrig — wer sie verschlägt, steht beim nächsten Angriff blank
      // (D172: die Klinge verlor zu zweit, weil der Bot ihre Kette bis zur Neige schlug).
      const reserve = s.ausdauer.wert - naechster.kosten >= s.werte.rolle.kosten;
      const reicht = reserve && (durch ? restD > naechster.vorlauf : rest > weg + naechster.vorlauf);
      // D174: In die freie Linie schlagen; müde trifft öfter die gedeckte.
      if (g.deckung) s.linie = z.r() < (p.name === 'müde' ? 0.3 : 0.05) ? g.deckung : andereLinie(g.deckung);
      // D376: Wer reinigen will, schlägt ein wundes Tier nicht weiter — er greift es im nächsten Fenster.
      const wund = !!w.marke && will(g) && g.leben <= w.marke.werte.wundAb * g.werte.lebenMax;
      // D407 `haltung`: Ein wundes Tier doch schlagen, wenn der Schlag es nicht tötet und die Haltung bricht —
      // dann liegt es betäubt, und der Griff hält den Rest der Betäubung obendrauf.
      const bricht = wund && !!opt.haltung && g.phase !== 'betaeubt' && !toetet(art)
        && g.haltung - naechster.haltungsschaden * (s.schadenFaktor ?? 1) <= 0;
      const schont = wund && !bricht;
      const hieb = (lauf: boolean) => {
        const neu = s.puffer?.art !== art;      // er hält die Taste, bis der Schlag beginnt — ein Hieb, nicht zwanzig
        puffere(s, art);
        if (opt.ereignis && neu) {
          opt.ereignis({ t, art: 'hieb', schlag: (lauf ? WAFFEN[waffe].lauf : naechster).name ?? '', schwer: art === 'schwer', rand, rest: restD, zielPhase: g.phase, lauf });
          const f = fenster.get(g.id); if (f) f.hiebe++;
        }
      };
      // D407 `nachsetzen: 'lauf'`: Der Hieb aus dem Stand kommt zu spät — rennen und den Laufangriff setzen.
      const lauf = WAFFEN[waffe].lauf;
      // Nur, wenn der Weg das Hindernis ist (`rand > reich`) — nicht als Ersatz für einen schweren Schlag, der nicht passt.
      const laufPasst = opt.nachsetzen === 'lauf' && offen && !reicht && rand > reich && !schont && !wartet && frei(s) && s.komboOffen <= 0
        && s.ausdauer.wert - lauf.kosten >= s.werte.rolle.kosten
        && !(opt.sanft && will(g) && lauf.schaden * (s.schadenFaktor ?? 1) >= g.leben - 1e-9)
        && rest > Math.max(0, rand - lauf.reichweite * 0.9) / RENNEN + lauf.vorlauf;
      if (schont || wartet) { /* warten, bis es sich verausgabt hat — dann greift der Zweig oben */ }
      else if ((offen || durch) && reicht && rand <= reich) hieb(false);
      else if (!frei(s)) { /* in der Erholung: nicht nachsetzen, sie läuft aus */ }
      // Nachsetzen, wenn er offen steht; sonst stehen und auf das Telegraf warten. (Zurückweichen
      // gab es in der ersten Fassung — der Gegner rückte nach, schlug nie, 90 s Patt.)
      else if (offen && reicht && frei(s)) { const v = 4.5 * SCHRITT; s.x += dx / d * v; s.z += dz / d * v; }
      else if (laufPasst) {
        s.rennt = true;
        if (rand <= lauf.reichweite * 0.9) hieb(true);
        else { const v = Math.min(RENNEN * SCHRITT, rand - lauf.reichweite * 0.9 + 0.02); s.x += dx / d * v; s.z += dz / d * v; }
      }
    }
    const phaseVorher = s.phase;
    if (w.marke) {
      for (const e of w.marke.ereignisse) {
        if (e.art === 'begonnen') kanaele++; else if (e.art === 'getroffen') gebrochen++; else if (e.art === 'geloest') geloest++;
        if (e.art !== 'begonnen') opt.ereignis?.({ t, art: 'kanal', ziel: e.ziel, ende: e.art, reinigung: alle.find(k => k.id === e.ziel)?.reinigung ?? 0 });
      }
      w.marke.ereignisse.length = 0;
    }
    const lebenVorher = opt.ereignis ? alle.map(k => k.leben) : null;
    for (const e of simuliere(w, SCHRITT)) {
      if (lebenVorher && e.schaden > 0) {
        if (e.von === 's') { const i = alle.findIndex(k => k.id === e.auf);
          opt.ereignis!({ t, art: 'treffer', auf: e.auf, schlag: s.schlag.name ?? '', schaden: e.schaden, leben: lebenVorher[i], lebenMax: alle[i].werte.lebenMax, gebrochen: e.gebrochen, toedlich: e.toedlich });
        } else { const a = alle.find(k => k.id === e.von)!;
          opt.ereignis!({ t, art: 'einschlag', von: e.von, schlag: a.schlag.name ?? '', schaden: e.schaden, phase: phaseVorher, kette: a.schlag !== a.werte.schlag }); }
      }
      if (e.von === 's' && e.schaden > 0) treffer++;
      if (e.von === 's' && e.gebrochen) {
        brueche++;
        const z = alle.find(k => k.id === e.auf);
        if (opt.aufgabe && z?.werte.mensch && z.phase !== 'gefallen') { z.phase = 'gefallen'; z.zeit = 0; z.folge = []; aufgegeben++; }
      }
      if (e.auf === 's' && e.pariert) paraden++;
      else if (e.auf === 's' && e.geblockt) blocks++;
      if (e.auf === 's' && e.schaden > 0 && beobachte) {
        const a = alle.find(k => k.id === e.von)!;
        beobachte({ von: a.werte === aufstellung[0] ? 'erster' : 'zweiter', phase: phaseVorher, schlag: s.schlag.name ?? '',
          rand: Math.hypot(a.x - s.x, a.z - s.z) });
      }
    }
    t += SCHRITT;
  }
  const raus: Ergebnis = { sieg: alle.every(g => g.phase === 'gefallen'), zeit: t, erlitten: s.werte.lebenMax - s.leben, treffer, paraden, blocks, brueche };
  if (opt.aufgabe) raus.aufgegeben = aufgegeben;
  if (w.marke) {
    for (const e of w.marke.ereignisse) {
      if (e.art === 'begonnen') kanaele++; else if (e.art === 'getroffen') gebrochen++; else if (e.art === 'geloest') geloest++;
      if (e.art !== 'begonnen') opt.ereignis?.({ t, art: 'kanal', ziel: e.ziel, ende: e.art, reinigung: alle.find(k => k.id === e.ziel)?.reinigung ?? 0 });
    }
    raus.gereinigt = alle.filter(g => g.ausgang === 'gereinigt').length;
    raus.getoetet = alle.filter(g => g.phase === 'gefallen' && g.ausgang !== 'gereinigt').length;
    raus.kanaele = kanaele; raus.gebrochen = gebrochen; raus.geloest = geloest;
  }
  return raus;
}

export interface Zeile { gegner: string; waffe: WaffenArt; profil: string; siege: number; zeit: number; erlitten: number; paraden: number; blocks: number }

export function messe(kaempfe = 200, opt?: BotOptionen): Zeile[] {
  const zeilen: Zeile[] = [];
  for (const [name, werte] of Object.entries(GEGNER)) for (const waffe of Object.keys(WAFFEN) as WaffenArt[]) {
    for (const p of PROFILE) {
      let siege = 0, zeit = 0, erlitten = 0, paraden = 0, blocks = 0;
      for (let i = 0; i < kaempfe; i++) {
        const e = kampf(werte, waffe, p, 1000 + i, undefined, 1, undefined, undefined, opt);
        if (e.sieg) { siege++; zeit += e.zeit; }
        erlitten += e.erlitten; paraden += e.paraden; blocks += e.blocks;
      }
      zeilen.push({ gegner: name, waffe, profil: p.name, siege: siege / kaempfe, zeit: siege ? zeit / siege : NaN, erlitten: erlitten / kaempfe,
        paraden: paraden / kaempfe, blocks: blocks / kaempfe });
    }
  }
  return zeilen;
}

if (process.argv[1]?.endsWith('kampfbot.ts')) {
  const n = Number(process.argv[2] ?? 200);
  // D407: `alt` misst mit dem Bot von D171 (geht nur, kein Laufangriff) — für den Vergleich davor/danach.
  const w = (process.argv[3] ?? '').split(',');
  const opt: BotOptionen | undefined = !process.argv[3] ? undefined : w.includes('alt') ? BOT_D171
    : { ...(w.includes('lauf') ? { nachsetzen: 'lauf' as const } : {}), ...(w.includes('abbruch') ? { abbruch: true } : {}),
        ...(w.includes('schritt') ? { reichweite: 'schritt' as const } : {}) };
  console.log(`Kampfbot — ${n} Kämpfe je Zeile, Start 8 m${process.argv[3] ? `, Bot: ${process.argv[3]}` : ''}`);
  console.log('Gegner           Waffe   Profil       Siege   Zeit bis Sieg   Schaden erlitten');
  for (const z of messe(n, opt)) {
    console.log(`${z.gegner.padEnd(16)} ${z.waffe.padEnd(7)} ${z.profil.padEnd(12)} ${(z.siege * 100).toFixed(0).padStart(4)} %`
      + `   ${Number.isNaN(z.zeit) ? '   –' : z.zeit.toFixed(1).padStart(5) + ' s'}        ${z.erlitten.toFixed(0).padStart(4)}`);
  }
}
