/**
 * BRACHLAND — Echtzeitkampf, Stufe 1: die Regeln ohne Bild (ADR-0007)
 *
 * Reines Modul ohne three.js und ohne React, aus demselben Grund wie `spieler/ausdauer.ts`: Was
 * hier steht, lässt sich in `tests/echtzeit.test.ts` Schritt für Schritt nachrechnen. Ein
 * Echtzeitkampf hat Zahlen, die kein Bildtor sieht — Fenster in Millisekunden, Reichweiten in
 * Metern, Winkel —, und genau die prüft der Test. Die Szene zeichnet nur, was hier entschieden ist.
 *
 * ## Was übernommen ist (ADR-0007 §1)
 *
 * Das Regelwerk der Gattung, nicht die Gestalt eines Vorbilds: ein Schlag mit Vorlauf, aktiver
 * Phase und Erholung; eine Ausweichrolle mit Unverwundbarkeitsfenster; Ausdauer als gemeinsame
 * Kasse für beides; Haltung, die erst nach mehreren Treffern bricht; ein Gegner, der seinen
 * Angriff **telegrafiert** und sich im Vorlauf nur langsam nachdreht.
 *
 * ## Richtungen
 *
 * Wie in der Szene: `blick` ist die Gier in Radiant, vorwärts ist `(−sin, −cos)` — die Figur
 * schaut bei `blick = 0` nach −Z. Siehe `Spieler` in `RegionsSzene.tsx`.
 *
 * ## Zeit
 *
 * `simuliere` rechnet in festen Teilschritten von 1/120 s, egal wie gross das Bild-dt ist. Ohne
 * das könnte ein langsames Bild (100 ms) das aktive Fenster eines Schlags (120 ms) überspringen,
 * und ob ein Treffer zählt, hinge an der Bildrate statt am Spiel.
 */
import { schadensfaktor, GegnerDaten, WaffenDaten, type Element as ElementName, type SchlagDaten } from '../data/schema.js';
import KLINGE_ROH from '../../content/waffen/klinge.json';
import AXT_ROH from '../../content/waffen/axt.json';
import SPEER_ROH from '../../content/waffen/speer.json';
import UEBUNGSGEGNER_ROH from '../../content/gegner/uebungsgegner.json';
import KEILER_ROH from '../../content/gegner/keiler.json';
import GRATHORN_ROH from '../../content/gegner/grathorn.json';
import WOLF_ROH from '../../content/gegner/wolf.json';
import FUCHS_ROH from '../../content/gegner/fuchs.json';
import GAMS_ROH from '../../content/gegner/gams.json';
import WEGELAGERER_ROH from '../../content/gegner/wegelagerer.json';
import SPEERMANN_ROH from '../../content/gegner/speermann.json';
import AXTMANN_ROH from '../../content/gegner/axtmann.json';
import { neueAusdauer, reicht, schritt as ausdauerSchritt, verbrauche, type Ausdauer } from '../spieler/ausdauer.js';

export type Phase = 'bereit' | 'vorlauf' | 'aktiv' | 'erholung' | 'rolle' | 'block' | 'betaeubt' | 'zucken' | 'gefallen';

/**
 * Linien (ADR-0009 Stufe 2, D174): woher ein Schlag kommt. Block und Deckung gelten je Linie — gegen
 * Menschen. Tiere schlagen ohne Linie (Stufe 3); gegen sie hält jeder Block wie in Stufe 1.
 */
export type Linie = 'oben' | 'unten' | 'links' | 'rechts';
export const LINIEN: readonly Linie[] = ['oben', 'rechts', 'unten', 'links'];

/** Ein Schlag: drei Phasen, Bogen, Wirkung. Zeiten in Sekunden, Strecken in Metern. */
export interface Schlag {
  vorlauf: number;
  aktiv: number;
  erholung: number;
  /** Bis wohin der Bogen reicht — von der Mitte des Angreifers bis zum **Rand** des Ziels. */
  reichweite: number;
  /** Halber Öffnungswinkel des Bogens in Radiant. */
  halbwinkel: number;
  schaden: number;
  /** Wie viel Haltung ein Treffer nimmt. */
  haltungsschaden: number;
  /** Ausdauerkosten beim Ansetzen. 0 heisst: kostet nichts (Gegner). */
  kosten: number;
  /** Wie schnell der Angreifer sich im Vorlauf noch nachdreht, rad/s. Im Aktiven dreht niemand. */
  nachdrehen: number;
  /** Name für Anzeige und Protokoll (D171). */
  name?: string;
  /**
   * Der Clip dazu und wo in ihm Scheitel und Durchzug liegen, in Clipsekunden (D171). Die Figur
   * legt Vorlauf auf 0…Scheitel, Aktiv auf Scheitel…Durchzug, Erholung auf den Rest.
   */
  clip?: string;
  hieb?: { scheitel: number; durchzug: number };
  /**
   * Vorschritt in Metern (D171): Der Körper geht mit dem Schlag mit — verteilt über das letzte
   * Drittel des Vorlaufs und das Aktive. Ein Schwert, das aus dem Stand trifft, sieht aus wie ein
   * Wedeln; ein Schritt in den Hieb ist das, was ihn schwer macht.
   */
  schritt?: number;
  /** Wie weit der Treffer das Ziel zurückstösst, Meter (D171). Ohne Angabe 0,2. */
  rueckstoss?: number;
  /**
   * D181: Standfest — wer so ausholt, zuckt bei einem Treffer im Vorlauf/Aktiven nicht, der Schlag
   * geht durch (Schaden nimmt er trotzdem). Die Rolle der Axt gegen Überzahl.
   */
  standfest?: boolean;
  /** D181: Wirft den Getroffenen aus der Handlung — so lange (s) betäubt, sein Vorlauf ist verloren. */
  wirft?: number;
  /** Grundlinie des Schlags (D174); die Spielerin kann sie mit den Pfeiltasten überschreiben. */
  linie?: Linie;
  /** Geht durch jeden Block (ADR-0009 Stufe 1, D173) — der Rammstoss des Keilers. Nur ausweichen hilft. */
  durch?: boolean;
}

/** Die Ausweichrolle. */
export interface Rolle {
  dauer: number;
  /** Unverwundbar von … bis, Sekunden ab Beginn der Rolle. */
  unverwundbarVon: number;
  unverwundbarBis: number;
  /** Weg über die ganze Rolle. */
  strecke: number;
  kosten: number;
}

export interface KampfWerte {
  schlag: Schlag;
  /** D189: Elemente des Tiers (aus `content/creatures`, im Test gegengeprüft) — Menschen haben keins. */
  elemente?: readonly ElementName[];
  /**
   * Was nach `schlag` ohne Pause folgt (D171) — der Doppelbiss des Wolfs. Der nächste Schlag beginnt,
   * sobald die Erholung des vorigen um ist; das Angriffsrecht bleibt dabei.
   */
  kette?: Schlag[];
  /** Lauftempo der KI in m/s; ohne Angabe `GEGNER_KI.tempo`. */
  tempo?: number;
  rolle: Rolle;
  lebenMax: number;
  haltungMax: number;
  /** Haltung je Sekunde zurück, sobald `haltungRuhe` s lang kein Treffer kam. */
  haltungErholung: number;
  haltungRuhe: number;
  /** Wie lange ein Haltungsbruch lähmt. */
  betaeubt: number;
  /** Kapsel: Radius in der Ebene und Höhe. */
  radius: number;
  hoehe: number;
  /**
   * Halbe Länge des Körpers entlang des Blicks (D170). 0 = runde Kapsel (Mensch). Ein Vierbeiner
   * ist eine Pille: Kopf und Hinterteil reichen weiter als die Flanke.
   */
  halbLaenge?: number;
  /**
   * Wie lange ein Treffer den Kämpfer aus seiner Handlung reisst (D170). 0 heisst: Er schlägt
   * durch — Gegner brechen nur über die Haltung. Die Spielerin zuckt, und ein Treffer im Vorlauf
   * kostet sie den eigenen Schlag.
   */
  zucken?: number;
  /**
   * Mensch (D174): schlägt in Linien (`linienFolge`, reihum nach Schwung), deckt eine Linie und liest
   * die Spielerin — dreimal dieselbe Linie getroffen, dann deckt er sie.
   */
  mensch?: { linienFolge: readonly Linie[]; deckung: Linie };
  /**
   * Linien eines Tiers (ADR-0009 Stufe 3, D175) — aus dem Körperbau, reihum nach Schwung: Keiler und
   * Fuchs von unten, Grathorn und Gams von oben, der Wolf dreht den Kopf (links, dann rechts).
   */
  linien?: readonly Linie[];
}

const GRAD = Math.PI / 180;

/**
 * Das Waffenwerk liegt als Daten in `content/waffen/` (ADR-0004: Inhalte sind Daten, nie Code) und
 * wird hier gegen `WaffenDaten` geprüft — eine Datei, die dem Schema widerspricht, bricht schon beim
 * Laden, nicht erst im Kampf. Die Dateien führen Grad und Clipbilder (24 fps), die Regeln rechnen
 * in Radiant und Clipsekunden.
 */
const WAFFEN_DATEN = {
  klinge: WaffenDaten.parse(KLINGE_ROH),
  axt: WaffenDaten.parse(AXT_ROH),
  speer: WaffenDaten.parse(SPEER_ROH),
};
const CLIP_BILDRATE = 24;

function schlagAusDaten(d: SchlagDaten): Schlag {
  const { halbwinkelGrad, hieb, ...rest } = d;
  const schlag: Schlag = { ...rest, halbwinkel: halbwinkelGrad * GRAD };
  if (hieb) schlag.hieb = { scheitel: hieb.scheitel / CLIP_BILDRATE, durchzug: hieb.durchzug / CLIP_BILDRATE };
  return schlag;
}

/**
 * Gegner (D194) aus `content/gegner/` — geprüft gegen `GegnerDaten` beim Laden. Gegner rollen nicht;
 * die leere Rolle setzt der Lader, damit sie nicht neunmal in den Daten steht.
 */
function gegnerAusDaten(roh: unknown): KampfWerte {
  const { id: _id, schlag, kette, ...rest } = GegnerDaten.parse(roh);
  const werte: KampfWerte = {
    ...rest,
    schlag: schlagAusDaten(schlag),
    rolle: { dauer: 0, unverwundbarVon: 0, unverwundbarBis: 0, strecke: 0, kosten: 0 },
  };
  if (kette) werte.kette = kette.map(schlagAusDaten);
  return werte;
}

/**
 * Die Spielerin.
 *
 * Der Schlag ist schnell angesetzt (0,18 s) und lang erholt (0,32 s): Wer trifft, ist danach eine
 * halbe Sekunde festgelegt. Genau das macht Timing zur Entscheidung statt zum Tastenrhythmus. Die
 * Rolle ist 0,30 s unverwundbar — das aktive Fenster des Übungsgegners dauert 0,15 s.
 */
export const SPIELERIN: KampfWerte = {
  // Der Grundschlag der Klinge (`content/waffen/klinge.json`, erster leichter), ohne Clip und Linie.
  schlag: (({ vorlauf, aktiv, erholung, reichweite, halbwinkel, schaden, haltungsschaden, kosten, nachdrehen }) =>
    ({ vorlauf, aktiv, erholung, reichweite, halbwinkel, schaden, haltungsschaden, kosten, nachdrehen }))(
    schlagAusDaten(WAFFEN_DATEN.klinge.leicht[0])),
  rolle: { dauer: 0.55, unverwundbarVon: 0.05, unverwundbarBis: 0.35, strecke: 3.8, kosten: 24 },
  lebenMax: 100, haltungMax: 60, haltungErholung: 30, haltungRuhe: 1.2, betaeubt: 0.45,
  radius: 0.4, hoehe: 1.7, zucken: 0.3,
};

/**
 * Das Waffenwerk (ADR-0008): zwei Klassen, jede mit **eigenem Fenster**.
 *
 * Die Klinge ist der Schlag der Spielerin von D166, unverändert. Die Axt tauscht Tempo gegen
 * Reichweite und Haltung: langer Vorlauf (0,42 s), dafür 2,9 m und ein Haltungsschaden, der den
 * Übungsgegner (Haltung 50) mit **einem** Treffer bricht. Damit sind die Klassen Werkzeuge für
 * verschiedene Lagen, keine Stufen: Die Klinge macht mehr Schaden je Sekunde, die Axt öffnet die
 * Deckung. Das Tor prüft beides, auch dass die Axt je Sekunde **nicht** mehr Schaden macht.
 */
export type WaffenArt = 'klinge' | 'axt' | 'speer';
/**
 * D188: Kernfunken (Story-Bibel §5: die Direktivkerne der Regenten). Bisher nur Wasser (Flussvater).
 * Wirkung „Flutstoss“: der schwere Schlag mit voller Ladung wirft weit zurück, betäubt, +25 % Schaden;
 * gegen Menschen halb so lange betäubt — sie stemmen sich dagegen, Tiere werden weggespült.
 */
export type Element = 'wasser' | 'stein';
export const LADUNG = { treffer: 0.2, parade: 0.35 };
export const FLUT = { schaden: 1.25, stoss: 3, betaeubt: 0.7, betaeubtMensch: 0.35 };
/**
 * D190: Steinfunke „Bruchschlag“ — kein Wegspülen, sondern Wucht: Haltungsschaden ×2,5 (bricht fast
 * jede Deckung), +10 % Schaden, und ein Mensch verliert seine gedeckte Linie (liest neu).
 * Die Antwort auf den Axtmann und die Speerfrau, die sich hinter ihrer Linie verschanzen.
 */
export const BRUCH = { schaden: 1.1, haltung: 2.5 };
/**
 * D189: Die Elementmatrix der Kreaturenkämpfe gilt auch für den Funken — gedämpft (Wurzel), weil ein
 * Echtzeittreffer sonst mit ×4 einen Wolf auf einen Schlag nimmt: 4 → 2, 2 → 1,41, 0,5 → 0,71, 0,25 → 0,5.
 * Wirkt auf Schaden und Betäubung des Flutstosses.
 */
export function funkenFaktor(element: Element, ziel: KampfWerte): number {
  return ziel.elemente?.length ? Math.sqrt(schadensfaktor(element, [...ziel.elemente])) : 1;
}
/** Der schwere Schlag jeder Waffe — nur er entlädt den Funken. */
export function istSchwer(s: Schlag): boolean {
  // Nach Namen, nicht nach Objekt: Der Puffer legt Kopien an (D190 im Bild gefunden — keine Entladung).
  return s.name === WAFFEN.klinge.schwer.name || s.name === WAFFEN.axt.schwer.name || s.name === WAFFEN.speer.schwer.name;
}
/**
 * Ein Moveset je Waffe (D171) — wie in der Gattung: leichte Kette, schwerer Schlag, Laufangriff.
 * `schlag` ist der erste der leichten Kette und bleibt, was die älteren Prüfungen meinen.
 */
export interface Waffe {
  name: string;
  schlag: Schlag;
  leicht: Schlag[];
  schwer: Schlag;
  lauf: Schlag;
  /** Kampfhaltung im Stand (Clip). */
  haltung: string;
}

function waffeAusDaten(d: WaffenDaten): Waffe {
  const leicht = d.leicht.map(schlagAusDaten);
  return { name: d.name, haltung: d.haltung, schlag: leicht[0], leicht,
    schwer: schlagAusDaten(d.schwer), lauf: schlagAusDaten(d.lauf) };
}

/**
 * Die Klinge: drei leichte (Hieb, Rückhand, Stich — der Stich reicht weiter und schmaler), ein
 * schwerer Zweihandhieb von oben, ein Laufstich mit langem Ausfall. Die Axt: zwei leichte (von oben,
 * dann quer mit breitem Bogen), ein schwerer Hieb mit weitem Ausholen, ein Laufhieb schräg.
 * Klinge: Hieb, Rückhand, Zweihand und Laufstich aus der UAL2 (`tools/ual2uebertrag.py`, D173,
 * `hieb` gemessen an der Klingenspitze); Stich und alle Axtclips baut `tools/waffenclips.py`.
 *
 * Axthieb D180: Vorlauf 0,42 → 0,37 s (Test: > 2 × Klinge), Schaden 38 → 36 (Schaden/s bleibt unter
 * der Klinge). Mit 0,42 s passte der Hieb in kaum ein Strafenfenster der Wegelagerer — Almsteig mit
 * Axt 7–37 % (`tools/durchlauf.ts`).
 *
 * D183: Der Speer — Abstand statt Wucht. Reicht am weitesten (3,1–4,0 m), sticht schmal (±12–20°)
 * und stösst den Getroffenen weit zurück; wenig Haltungsschaden, weniger Schaden je Sekunde als
 * die Klinge. Gegen Tiere, die anspringen, hält er sie draussen; gegen drei Menschen fehlt ihm
 * der Bogen. Seit D184 eigene beidhändige Clips (`tools/waffenclips.py`: Speer_Stand/Stoss/Weit/Lauf/Block).
 *
 * Werte: `content/waffen/*.json`, Schema `WaffenDaten` in `src/data/schema.ts`.
 */
export const WAFFEN: Record<WaffenArt, Waffe> = {
  klinge: waffeAusDaten(WAFFEN_DATEN.klinge),
  axt: waffeAusDaten(WAFFEN_DATEN.axt),
  speer: waffeAusDaten(WAFFEN_DATEN.speer),
};

/**
 * Eingaben bleiben so lange gültig (D171) — wer im Schlag schon den nächsten drückt, wird bedient.
 * Im Aktiven und in der Erholung vor `KOMBO_AB` läuft die Uhr nicht (siehe `schrittKaempfer`).
 */
export const PUFFER = 0.3;

/**
 * D182: Nach einem Wurf ist der Getroffene so lange (s) gegen den nächsten gefeit. Länger als
 * eine Axtkette (Axthieb + Querhieb ≈ 1,6 s), damit die zweite Hälfte ihn nicht erneut festnagelt.
 */
export const WURF_SPERRE = 2.0;
/** Ab diesem Anteil der Erholung darf der nächste leichte Schlag die Erholung abbrechen (D171). */
export const KOMBO_AB = 0.35;
/** So lange nach dem Ende eines Schlags setzt der nächste leichte die Kette fort (D171). */
export const KOMBO_FENSTER = 0.45;
/** Trefferstopp (D171): Nach einem Treffer steht die Welt so lange still. */
export const TREFFERSTOPP = 0.06;
/** Über so viele Sekunden läuft ein Rückstoss aus (D171) — ein Ruck statt eines Sprungs. */
export const STOSS_DAUER = 0.15;
/**
 * Block und Parade (ADR-0009 Stufe 1, D173). Geblockt wird frontal (±70° um den Blick). Wer den
 * Block höchstens `PARADE` s vor dem Treffer hob, pariert: kein Schaden, keine Ausdauer, der
 * Angreifer ist `PARADE_BETAEUBT` s betäubt. Sonst kostet der Block Ausdauer (halber
 * Haltungsschaden); reicht sie nicht, bricht er — betäubt und erschöpft.
 */
export const BLOCK = { halbwinkel: 70 * GRAD, kosten: 0.5, rueckstoss: 0.5 };
export const PARADE = 0.15;
/** Schlag in die gedeckte Linie eines Menschen: Ausdauer des Angreifers = Schaden × das (D174). */
export const DECKUNG_KOSTEN = 0.5;
export const PARADE_BETAEUBT = 0.45;

/** Waffe wechseln — nur aus dem Stand, nie mitten im Schlag oder in der Rolle. */
export function ruesteAus(k: Kaempfer, art: WaffenArt): boolean {
  if (k.phase !== 'bereit') return false;
  k.werte = { ...k.werte, schlag: WAFFEN[art].schlag };
  k.schlag = WAFFEN[art].schlag;
  k.kombo = 0; k.komboOffen = 0;
  k.waffe = art;
  return true;
}

/**
 * Der Übungsgegner — ein Platzhalter ohne Asset (ADR-0007 Stufe 1).
 *
 * Der Vorlauf von **0,75 s** ist das Telegraf. Wer auf das erste Zucken hin sofort rollt, ist zu
 * früh: Die Unverwundbarkeit ist vorbei, bevor der Schlag ankommt. Das Fenster, in dem eine Rolle
 * auf der Stelle den Treffer schluckt, liegt in der zweiten Hälfte des Vorlaufs — der Test rechnet
 * es aus und prüft, dass es nach einer menschlichen Reaktionszeit beginnt und breit genug ist.
 */
export const UEBUNGSGEGNER: KampfWerte = gegnerAusDaten(UEBUNGSGEGNER_ROH);

/**
 * Der Wurzelkeiler als Gegner (D169, ADR-0007 Stufe 2) — der erste aus einem Körperbauplan
 * (Huftier/Vierbeiner), mit dem Modell aus der Welt statt einer Kapsel.
 *
 * Ein Keiler rammt: langer Vorlauf (0,85 s — er senkt den Kopf und scharrt), kurzer, weiter Stoss
 * (2,6 m, weil er sich dabei nach vorn wirft), schmaler Bogen (±35° — was neben ihm steht, trifft
 * er nicht), lange Erholung (1,0 s), in der er offen steht. Mehr Leben und Haltung als der
 * Übungsgegner: Die Klinge braucht drei Treffer für die Haltung, die Axt zwei. Seit D170 eine
 * Pille entlang des Körpers statt einer runden Kapsel (vorher r 0,55 m bei 1,8 m Länge — von der
 * Seite zu leicht, von vorn zu schwer zu treffen): halbe Breite 0,31 m, Körper 1,8 m lang.
 * D173: Der Rammstoss geht durch jeden Block (`durch`).
 */
export const KEILER: KampfWerte = gegnerAusDaten(KEILER_ROH);

/**
 * Der Grathorn als Gegner (D170) — zweiter Körperbauplan (Huftier mit Gehörn, Steinbock).
 *
 * Er stösst mit dem Gehörn: steigt kurz auf (0,6 s — der Kopf geht **hoch**, nicht runter wie beim
 * Keiler), dann kracht er schräg nach unten nach vorn. Schneller als der Keiler, kürzer (2,2 m),
 * noch schmaler (±30°) und leichter: Wer den Keiler gelernt hat, muss hier früher rollen.
 */
export const GRATHORN: KampfWerte = gegnerAusDaten(GRATHORN_ROH);

/**
 * Der K7-Wolf als Gegner (D171) — dritter Körperbauplan (Raubtier), der erste mit einer **Kette**.
 *
 * Er beisst zweimal: Der erste Biss kommt nach kurzem Ducken (0,5 s), der zweite ohne neues
 * Telegraf 0,32 s nach dem Ende des ersten, mit einem Satz nach vorn. Wer auf der Stelle unter den
 * ersten rollt, steht beim zweiten wieder da und wird gebissen — sicher ist die Rolle **weg** oder
 * eine zweite Rolle gleich hinterher. Das ist die erste Lektion, die nicht „wann", sondern „wohin"
 * heisst. Dafür wenig Leben und Haltung: Die Klinge bricht ihn mit dem zweiten Treffer.
 */
export const WOLF: KampfWerte = gegnerAusDaten(WOLF_ROH);

/**
 * Der Spürfuchs als Gegner (D173) — klein, schnell, schwach. Er schnappt nach kurzem Ducken
 * (0,4 s): zu schnell, um erst beim Ausholen zu reagieren — wer ihn parieren will, muss seinen
 * Rhythmus lesen. Wenig Leben, geringer Schaden; im Rudel mit dem Wolf ist er der Störer.
 */
export const FUCHS: KampfWerte = gegnerAusDaten(FUCHS_ROH);

/**
 * Die Nebelgams als Gegner (D173) — Huftier wie der Grathorn, aber leicht: ein kurzer Kopfstoss
 * (0,45 s) mit weitem Rückstoss. Sie trifft selten hart, wirft aber aus der Stellung — wer am Rand
 * steht oder zwischen zwei Gegnern, merkt das.
 */
export const GAMS: KampfWerte = gegnerAusDaten(GAMS_ROH);

/**
 * Der Wegelagerer (D174, ADR-0009 Stufe 2) — der erste Mensch als Gegner, mit Klinge. Er schlägt in
 * Linien (reihum nach `linienFolge`, der zweite Schlag der Kette aus einer anderen), deckt eine Linie
 * und wechselt sie nach eigenem Angriff und nach jedem Treffer; wer ihn dreimal aus derselben Linie
 * trifft, wird gelesen. Tempo und Schaden wie ein Mensch: langsamer als der Wolf, härter.
 */
export const WEGELAGERER: KampfWerte = gegnerAusDaten(WEGELAGERER_ROH);

/**
 * D184: Der Speermann — sticht aus 3 m, bevor die Klinge heran ist, stösst zurück, deckt unten und
 * oben. Weniger Leben, leichtere Treffer. Wer an seiner Spitze vorbeikommt, hat ihn.
 * D190: Leben 75 → 65 — die Axt verlor nachts 77 % gegen sie; Schere ja, Sackgasse nein.
 */
export const SPEERMANN: KampfWerte = gegnerAusDaten(SPEERMANN_ROH);

/**
 * D184: Der Axtmann — langsam (0,7 s Vorlauf), aber ein Treffer kostet ein Drittel des Lebens und
 * bricht fast die Deckung. Kein Nachschlag; nach dem Hieb steht er lange offen.
 */
export const AXTMANN: KampfWerte = gegnerAusDaten(AXTMANN_ROH);

/** Werte: `content/gegner/*.json`, Schema `GegnerDaten` in `src/data/schema.ts` (D194). */

/**
 * Gegnerwerte für die Nacht (D179): mehr Leben und Haltung, härtere Schläge, gleiche Fenster.
 * Die Fenster bleiben, weil sie das Lesbare sind — nachts ist es gefährlicher, nicht unfair.
 */
export function naechtlich(w: KampfWerte, f = { leben: 1.3, schaden: 1.2 }): KampfWerte {
  const s = (x: Schlag): Schlag => ({ ...x, schaden: x.schaden * f.schaden, haltungsschaden: x.haltungsschaden * f.schaden });
  return {
    ...w, schlag: s(w.schlag), kette: w.kette?.map(s),
    lebenMax: w.lebenMax * f.leben, haltungMax: w.haltungMax * f.leben,
  };
}

/** Wie weit und in welchem Kegel die Zielaufschaltung greift, und wie schnell sie den Blick zieht. */
export const ZIELEN = {
  reichweite: 18, halbwinkel: 70 * GRAD, drehrate: 7,
  /** Bis zu welchem Winkel der Angreifer beim Aufschalten vorgeht (D168). */
  angreiferWinkel: 110 * GRAD,
};

/** Gegnerverhalten des Platzhalters. `abstand` ist der Anteil der Reichweite, auf den er aufrückt. */
export const GEGNER_KI = {
  wachAb: 11, tempo: 2.4, drehrate: 3.5, abstand: 0.9, zielt: 20 * GRAD,
  /**
   * Wer kein Angriffsrecht hat, wartet so viel weiter draussen als die Haltelinie (D167) — ausser
   * Reichweite, aber nah genug, um nach dem Wechsel in unter einer Sekunde dran zu sein.
   */
  warteAbstand: 1.4,
  /**
   * Atempause (D172): Nach einem Angriff greift so lange niemand an, sobald mehr als einer steht.
   * Ohne sie kam im Rudel der nächste Biss, während die Spielerin noch aus dem letzten rollte — der
   * Kampfbot gewann gegen drei Wölfe 9 %, und das nicht durch Sterben, sondern weil er nie zuschlagen
   * konnte. Die Gattung macht es so: Wer wartet, lauert; der Druck kommt aus der Zahl, nicht aus
   * einer Kette ohne Lücke.
   */
  atempause: 1.0,
  /** Tempo beim Umkreisen, als Anteil von `tempo`. */
  kreisen: 0.45,
};

/** Die feste Teilschrittweite der Simulation. */
export const SCHRITT = 1 / 120;

export interface Kaempfer {
  id: string;
  werte: KampfWerte;
  x: number; y: number; z: number;
  blick: number;
  leben: number;
  haltung: number;
  /** Sekunden seit dem letzten erlittenen Treffer — für die Haltungserholung. */
  seitTreffer: number;
  ausdauer: Ausdauer;
  phase: Phase;
  /** Sekunden in der aktuellen Phase. */
  zeit: number;
  /** Zählt die Schläge; die Szene erkennt daran einen neuen Schwung. */
  schwung: number;
  /** Wen der laufende Schwung schon erreicht hat — ein Schwung trifft jedes Ziel höchstens einmal. */
  erreicht: Set<string>;
  /** Richtung der laufenden Rolle, Einheitsvektor oder (0, 0) für eine Rolle auf der Stelle. */
  rolleX: number; rolleZ: number;
  /** Sekunden seit dem letzten Schlagbeginn — wer am längsten nicht dran war, bekommt das Angriffsrecht. */
  seitSchlag: number;
  /** Geführte Waffe (ADR-0008); Gegner führen keine. */
  waffe?: WaffenArt;
  /** D188: Kernfunke in der Waffe (Element des besiegten Regenten). */
  element?: Element;
  /** 0…1 — füllt sich mit Treffern und Paraden; voll entlädt der nächste schwere Schlag das Element. */
  ladung?: number;
  /** Schwung, in dem das Element entladen wird (trifft jedes Ziel dieses Schwungs). */
  entladung?: number;
  /** Der Schlag, der gerade läuft oder zuletzt lief (D171) — nicht immer `werte.schlag`. */
  schlag: Schlag;
  /** Was nach diesem Schlag ohne Pause folgt (Kette, D171). */
  folge: Schlag[];
  /** Stelle in der leichten Kette der Waffe, und wie lange sie nach dem letzten Schlag noch offen ist. */
  kombo: number;
  komboOffen: number;
  /** Gepufferte Eingabe (D171) mit Restzeit. */
  puffer: { art: 'leicht' | 'schwer' | 'rolle'; rest: number; rx: number; rz: number } | null;
  /** Rennt die Spielerin gerade? Dann wird aus dem leichten Schlag der Laufangriff. Setzt die Szene. */
  rennt?: boolean;
  /**
   * Die Ausdauer erholt jemand anderes (D171): In der Szene tut das `Spieler` — die Simulation
   * zieht nur ab. Ohne das erholte sie sich doppelt, sobald ein Gegner in der Nähe steht.
   */
  ausdauerFremd?: boolean;
  /** Laufender Rückstoss (D171): Rest in Metern je Achse und Restzeit. */
  stoss?: { x: number; z: number; rest: number } | null;
  /** Gewählte Linie (D174): Pfeiltasten der Spielerin — für Angriff und Block. */
  linie?: Linie;
  /** Linie des laufenden Schlags, beim Ansetzen festgelegt. */
  schlagLinie?: Linie;
  /** Gedeckte Linie eines Menschen (D174). */
  deckung?: Linie;
  /** Die letzten Linien, in die er getroffen wurde — fürs Lesen. */
  gelesen?: Linie[];
  /** Schadensfaktor der geschmiedeten Waffe (D177, `spiel/schmiede.ts`); ohne Angabe 1. */
  schadenFaktor?: number;
  /** Dauer der laufenden Betäubung, wenn sie nicht `werte.betaeubt` ist (Parade, D173). */
  betaeubtFuer?: number;
  /** D182: Sekunden seit dem letzten Wurf (`wirft`) — darunter `WURF_SPERRE` wirft ihn nichts. */
  seitWurf?: number;
}

export function neuerKaempfer(id: string, werte: KampfWerte, x: number, z: number, blick = 0, y = 0): Kaempfer {
  return {
    id, werte, x, y, z, blick,
    leben: werte.lebenMax, haltung: werte.haltungMax, seitTreffer: 99,
    ausdauer: neueAusdauer(), phase: 'bereit', zeit: 0, schwung: 0, erreicht: new Set(),
    rolleX: 0, rolleZ: 0, seitSchlag: 99,
    schlag: werte.schlag, folge: [], kombo: 0, komboOffen: 0, puffer: null,
    deckung: werte.mensch?.deckung,
  };
}

/** Vorwärtsrichtung zu einer Gier — dieselbe Formel wie in `Spieler`. */
export function vorwaerts(blick: number): [number, number] {
  return [-Math.sin(blick), -Math.cos(blick)];
}

/** Die Gier, unter der man von (vx, vz) nach (nx, nz) schaut. Umkehrung von `vorwaerts`. */
export function blickAuf(vx: number, vz: number, nx: number, nz: number): number {
  return Math.atan2(-(nx - vx), -(nz - vz));
}

/** Kleinster Winkel von `a` nach `b`, in (−π, π]. */
export function winkelDiff(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Den Blick mit begrenzter Rate auf `ziel` drehen. */
export function drehe(k: Kaempfer, ziel: number, rate: number, dt: number): void {
  const d = winkelDiff(k.blick, ziel);
  const max = rate * dt;
  k.blick += Math.abs(d) <= max ? d : Math.sign(d) * max;
}

/** Darf ein Schlag beginnen? Nur aus dem Stand, und nur mit Ausdauer. */
export function kannSchlagen(k: Kaempfer, s: Schlag = k.werte.schlag): boolean {
  if (k.phase !== 'bereit') return false;
  return s.kosten <= 0 || reicht(k.ausdauer, s.kosten);
}

export function setzeSchlagAn(k: Kaempfer, s: Schlag = k.werte.schlag): boolean {
  if (!kannSchlagen(k, s)) return false;
  beginneSchlag(k, s);
  // Die Kette eines Gegners (D171) hängt am ersten Schlag seines Angriffs.
  k.folge = s === k.werte.schlag && k.werte.kette ? [...k.werte.kette] : [];
  return true;
}

/** Die Linie, aus der `k` den Schlag `s` jetzt führt (D174). */
function linieFuer(k: Kaempfer, s: Schlag): Linie | undefined {
  const m = k.werte.mensch;
  if (m) return m.linienFolge[k.schwung % m.linienFolge.length];
  const t = k.werte.linien;
  if (t?.length) return t[k.schwung % t.length];
  return k.linie ?? s.linie;
}

/** Nächste Linie reihum, die nicht `nicht` ist. */
export function andereLinie(l: Linie | undefined, nicht?: Linie): Linie {
  let i = l ? LINIEN.indexOf(l) : -1;
  for (;;) { i = (i + 1) % LINIEN.length; if (LINIEN[i] !== nicht) return LINIEN[i]; }
}

function beginneSchlag(k: Kaempfer, s: Schlag): void {
  if (s.kosten > 0) k.ausdauer = verbrauche(k.ausdauer, s.kosten);
  k.schlagLinie = linieFuer(k, s);
  k.schlag = s;
  k.phase = 'vorlauf'; k.zeit = 0; k.schwung++; k.erreicht = new Set(); k.seitSchlag = 0;
}

/**
 * Eine Eingabe der Spielerin puffern (D171). Ausgeführt wird sie im nächsten Teilschritt, in dem es
 * geht — in der Erholung also schon ab `KOMBO_AB`, statt verloren zu gehen, weil sie 80 ms zu früh
 * kam. Das ist der Unterschied zwischen „reagiert nicht" und „flüssig".
 */
export function puffere(k: Kaempfer, art: 'leicht' | 'schwer' | 'rolle', rx = 0, rz = 0): void {
  k.puffer = { art, rest: PUFFER, rx, rz };
}

/** Welcher Schlag käme jetzt bei `art`? Kette, Laufangriff, schwer — aus der Waffe. */
export function naechsterSchlag(k: Kaempfer, art: 'leicht' | 'schwer'): { schlag: Schlag; kombo: number } {
  const waffe = WAFFEN[k.waffe ?? 'klinge'];
  if (art === 'schwer') return { schlag: waffe.schwer, kombo: 0 };
  const inKette = k.phase === 'erholung' || k.komboOffen > 0;
  if (!inKette && k.rennt) return { schlag: waffe.lauf, kombo: 0 };
  const i = inKette ? (k.kombo + 1) % waffe.leicht.length : 0;
  return { schlag: waffe.leicht[i], kombo: i };
}

/** Die gepufferte Eingabe ausführen, wenn es geht. `true`, wenn etwas begann. */
export function verarbeitePuffer(k: Kaempfer): boolean {
  const p = k.puffer;
  if (!p || p.rest <= 0) { k.puffer = null; return false; }
  if (p.art === 'rolle') {
    if (!setzeRolleAn(k, p.rx, p.rz)) return false;
    k.puffer = null; k.kombo = 0; k.komboOffen = 0;
    return true;
  }
  const abbrechbar = k.phase === 'erholung' && k.zeit >= k.schlag.erholung * KOMBO_AB;
  if (k.phase !== 'bereit' && !abbrechbar) return false;
  const { schlag, kombo } = naechsterSchlag(k, p.art);
  if (schlag.kosten > 0 && !reicht(k.ausdauer, schlag.kosten)) return false;
  beginneSchlag(k, schlag);
  k.folge = [];
  k.kombo = kombo; k.komboOffen = 0;
  k.puffer = null;
  return true;
}

/**
 * Darf eine Rolle beginnen? Aus dem Stand und aus der **Erholung** — die Erholung abbrechen zu
 * dürfen ist das, was einen verfehlten Schlag überlebbar macht. Aus dem Vorlauf nicht: Wer
 * ausholt, hat sich festgelegt.
 */
export function kannRollen(k: Kaempfer): boolean {
  if (k.phase !== 'bereit' && k.phase !== 'erholung') return false;
  if (k.werte.rolle.dauer <= 0) return false;
  return reicht(k.ausdauer, k.werte.rolle.kosten);
}

export function setzeRolleAn(k: Kaempfer, richtX: number, richtZ: number): boolean {
  if (!kannRollen(k)) return false;
  k.ausdauer = verbrauche(k.ausdauer, k.werte.rolle.kosten);
  const l = Math.hypot(richtX, richtZ);
  k.rolleX = l > 1e-6 ? richtX / l : 0;
  k.rolleZ = l > 1e-6 ? richtZ / l : 0;
  k.phase = 'rolle'; k.zeit = 0;
  return true;
}

/** Block heben (D173): aus dem Stand oder der abbrechbaren Erholung, mit etwas Ausdauer. */
export function kannBlocken(k: Kaempfer): boolean {
  if (k.werte.rolle.dauer <= 0) return false; // Gegner blocken nicht — wer nicht rollt, blockt nicht.
  const abbrechbar = k.phase === 'erholung' && k.zeit >= k.schlag.erholung * KOMBO_AB;
  return (k.phase === 'bereit' || abbrechbar) && reicht(k.ausdauer, 0);
}
export function setzeBlockAn(k: Kaempfer): boolean {
  if (!kannBlocken(k)) return false;
  k.phase = 'block'; k.zeit = 0; k.puffer = null; k.kombo = 0; k.komboOffen = 0;
  return true;
}
export function loeseBlock(k: Kaempfer): void {
  if (k.phase === 'block') { k.phase = 'bereit'; k.zeit = 0; }
}
/** Steht der Angreifer vor dem Blockenden? */
export function blocktFrontal(z: Kaempfer, a: Kaempfer): boolean {
  return Math.abs(winkelDiff(z.blick, blickAuf(z.x, z.z, a.x, a.z))) <= BLOCK.halbwinkel;
}

function betaeube(k: Kaempfer, dauer?: number): void {
  k.phase = 'betaeubt'; k.zeit = 0; k.folge = []; k.puffer = null; k.betaeubtFuer = dauer;
}

export function unverwundbar(k: Kaempfer): boolean {
  return k.phase === 'rolle'
    && k.zeit >= k.werte.rolle.unverwundbarVon && k.zeit < k.werte.rolle.unverwundbarBis;
}

/** Kann einer handeln oder sich bewegen? Die Szene sperrt das Gehen, solange nicht. */
export function frei(k: Kaempfer): boolean {
  return k.phase === 'bereit';
}

/**
 * Liegt das Ziel im Bogen des Angreifers?
 *
 * Gemessen wird bis zum **Rand** der Zielkapsel, und der Winkel bekommt den halben Sichtwinkel der
 * Kapsel als Zugabe: Ein Gegner, dessen Schulter noch im Bogen steht, wird getroffen, auch wenn
 * seine Mitte knapp daneben liegt. Anders fühlt sich ein Nahkampf an wie Zielschiessen.
 */
export function imBogen(a: Kaempfer, z: Kaempfer): boolean {
  const s = a.schlag;
  if (Math.abs(z.y - a.y) > Math.max(a.werte.hoehe, z.werte.hoehe)) return false;
  const r = z.werte.radius;
  const [fx, fz] = vorwaerts(a.blick);
  // D170: Das Ziel ist eine Pille entlang seines Blicks. Geprüft werden der nächste Punkt der
  // Mittellinie und ihre beiden Enden — liegt einer davon mit seinem Kreis im Bogen, trifft es.
  const h = z.werte.halbLaenge ?? 0;
  const [bx, bz] = vorwaerts(z.blick);
  const punkte: [number, number][] = [[z.x, z.z]];
  if (h > 0) {
    const t = Math.max(-h, Math.min(h, (a.x - z.x) * bx + (a.z - z.z) * bz));
    punkte.push([z.x + bx * t, z.z + bz * t], [z.x + bx * h, z.z + bz * h], [z.x - bx * h, z.z - bz * h]);
  }
  for (const [px, pz] of punkte) {
    const dx = px - a.x, dz = pz - a.z;
    const d = Math.hypot(dx, dz);
    if (d - r > s.reichweite) continue;
    if (d <= r) return true;
    const winkel = Math.acos(Math.max(-1, Math.min(1, (fx * dx + fz * dz) / d)));
    if (winkel <= s.halbwinkel + Math.asin(Math.min(1, r / d))) return true;
  }
  return false;
}

export interface Treffer {
  von: string;
  auf: string;
  schaden: number;
  /** Haltung gebrochen — das Ziel ist betäubt. */
  gebrochen: boolean;
  toedlich: boolean;
  /** Die Rolle hat den Schlag geschluckt. */
  ausgewichen: boolean;
  /** Der Block hat ihn gefangen (D173) — kein Schaden, Ausdauer weg. */
  geblockt?: boolean;
  /** Parade (D173): gefangen im ersten Moment des Blocks, der Angreifer ist betäubt. */
  pariert?: boolean;
  /** D188: Das Element wurde mit diesem Treffer entladen. */
  element?: Element;
  /** D189: Wirkung nach der Elementmatrix. */
  wirkung?: 'stark' | 'schwach';
  /** In die gedeckte Linie eines Menschen geschlagen (D174): kein Schaden, der Angreifer zahlt Ausdauer. */
  gedeckt?: boolean;
  /** Block in der falschen Linie (D174): halber Schaden. */
  falscheLinie?: boolean;
  /** Linie des Schlags. */
  linie?: Linie;
}

/**
 * Treffer des laufenden Schwungs gegen `ziele` auflösen.
 *
 * Ein Schwung, der durch ein unverwundbares Ziel geht, ist **ausgewichen** und zählt auch dann
 * nicht mehr, wenn die Unverwundbarkeit im selben aktiven Fenster endet. Ohne diese Regel würde
 * eine Rolle, die exakt richtig liegt, im nächsten Teilschritt doch noch getroffen.
 */
export function loeseTreffer(a: Kaempfer, ziele: readonly Kaempfer[]): Treffer[] {
  if (a.phase !== 'aktiv') return [];
  const raus: Treffer[] = [];
  for (const z of ziele) {
    if (z === a || z.phase === 'gefallen' || a.erreicht.has(z.id)) continue;
    if (!imBogen(a, z)) continue;
    a.erreicht.add(z.id);
    if (unverwundbar(z)) {
      raus.push({ von: a.id, auf: z.id, schaden: 0, gebrochen: false, toedlich: false, ausgewichen: true });
      continue;
    }
    const s = a.schlag;
    const linie = a.schlagLinie;
    // D174: Gegen einen Linienschlag hält der Block nur in derselben Linie; sonst fängt die Waffe halb.
    const linieFalsch = !!linie && z.phase === 'block' && z.linie !== linie;
    // D188/D190: vor Deckung und Block entschieden — Entladung — der schwere Schlag mit voller Ladung trägt das Element (ein Schwung, alle Ziele).
    if (a.element && (a.ladung ?? 0) >= 1 && istSchwer(s) && a.entladung !== a.schwung) { a.entladung = a.schwung; a.ladung = 0; }
    const flut = !!a.element && a.entladung === a.schwung;
    // Deckung eines Menschen: in die gedeckte Linie geschlagen kostet den Angreifer Ausdauer. Ein
    // entladener Funke geht durch die gedeckte Linie (D190: sonst entlud er nie gegen Menschen).
    if (!flut && z.deckung && linie === z.deckung && !s.durch && z.phase !== 'betaeubt' && blocktFrontal(z, a)) {
      const kosten = s.schaden * DECKUNG_KOSTEN;
      a.ausdauer = reicht(a.ausdauer, kosten) ? verbrauche(a.ausdauer, kosten) : { wert: 0, seitZehrung: 0, erschoepft: true };
      raus.push({ von: a.id, auf: z.id, schaden: 0, gebrochen: false, toedlich: false, ausgewichen: false,
        geblockt: true, gedeckt: true, linie });
      continue;
    }
    if (z.phase === 'block' && !s.durch && !linieFalsch && blocktFrontal(z, a)) {
      const dx = z.x - a.x, dz = z.z - a.z, d = Math.hypot(dx, dz) || 1;
      if (z.zeit <= PARADE) {
        betaeube(a, PARADE_BETAEUBT);
        if (z.element) z.ladung = Math.min(1, (z.ladung ?? 0) + LADUNG.parade);
        raus.push({ von: a.id, auf: z.id, schaden: 0, gebrochen: false, toedlich: false, ausgewichen: false,
          geblockt: true, pariert: true, linie });
        continue;
      }
      const kosten = s.haltungsschaden * BLOCK.kosten;
      const haelt = reicht(z.ausdauer, kosten);
      z.ausdauer = haelt ? verbrauche(z.ausdauer, kosten) : { wert: 0, seitZehrung: 0, erschoepft: true };
      if (!haelt) betaeube(z);
      z.stoss = { x: dx / d * (s.rueckstoss ?? 0.2) * BLOCK.rueckstoss, z: dz / d * (s.rueckstoss ?? 0.2) * BLOCK.rueckstoss, rest: STOSS_DAUER };
      raus.push({ von: a.id, auf: z.id, schaden: 0, gebrochen: !haelt, toedlich: false, ausgewichen: false, geblockt: true, linie });
      continue;
    }
    const ef = flut && a.element ? funkenFaktor(a.element, z.werte) : 1;
    const stein = flut && a.element === 'stein', wasser = flut && a.element === 'wasser';
    const f = (linieFalsch && blocktFrontal(z, a) && !s.durch ? 0.5 : 1) * (a.schadenFaktor ?? 1)
      * (wasser ? FLUT.schaden * ef : stein ? BRUCH.schaden * ef : 1);
    const schaden = s.schaden * f;
    z.leben = Math.max(0, z.leben - schaden);
    z.haltung -= s.haltungsschaden * f * (stein ? BRUCH.haltung : 1);
    if (stein && z.werte.mensch) { z.deckung = undefined; z.gelesen = []; }
    // D174: Ein Mensch liest — dreimal dieselbe Linie, dann deckt er sie; sonst wechselt er weg.
    if (z.werte.mensch && linie) {
      z.gelesen = [...(z.gelesen ?? []), linie].slice(-3);
      z.deckung = z.gelesen.length === 3 && z.gelesen.every(l => l === linie) ? linie : andereLinie(z.deckung, linie);
    }
    z.seitTreffer = 0;
    let gebrochen = false;
    const toedlich = z.leben <= 0;
    if (a.element && !flut) a.ladung = Math.min(1, (a.ladung ?? 0) + LADUNG.treffer);
    if (toedlich) { z.phase = 'gefallen'; z.zeit = 0; }
    else if (z.haltung <= 0) {
      betaeube(z); z.haltung = z.werte.haltungMax; gebrochen = true;
    } else if (s.wirft && (z.seitWurf ?? Infinity) >= WURF_SPERRE) {
      // D181: Ein wuchtiger Treffer wirft aus der Handlung — auch Gegner, die sonst nicht zucken.
      // D182: aber nicht zweimal kurz hintereinander, sonst hält die Axt einen Einzelnen fest.
      betaeube(z, s.wirft); z.seitWurf = 0;
    } else if ((z.werte.zucken ?? 0) > 0 && !((z.phase === 'vorlauf' || z.phase === 'aktiv') && z.schlag.standfest)) {
      // D170: Der Treffer reisst aus der Handlung — ein Schlag im Vorlauf ist verloren.
      z.phase = 'zucken'; z.zeit = 0; z.folge = []; z.puffer = null;
    }
    if (!toedlich) {
      // Rückstoss (D171): weg vom Angreifer. Ein Treffer, der nichts bewegt, sieht aus wie Durchfassen.
      const dx = z.x - a.x, dz = z.z - a.z, d = Math.hypot(dx, dz) || 1;
      const r = (s.rueckstoss ?? 0.2) * (wasser ? FLUT.stoss : 1);
      z.stoss = { x: dx / d * r, z: dz / d * r, rest: STOSS_DAUER };
      if (wasser && !gebrochen) betaeube(z, (z.werte.mensch ? FLUT.betaeubtMensch : FLUT.betaeubt) * ef);
    }
    raus.push({ von: a.id, auf: z.id, schaden, gebrochen, toedlich, ausgewichen: false,
      ...(f < 1 ? { falscheLinie: true } : {}), ...(flut ? { element: a.element, wirkung: ef > 1.05 ? 'stark' as const : ef < 0.95 ? 'schwach' as const : undefined } : {}), linie });
  }
  return raus;
}

function phasenDauer(k: Kaempfer): number {
  const w = k.werte;
  switch (k.phase) {
    case 'vorlauf': return k.schlag.vorlauf;
    case 'aktiv': return k.schlag.aktiv;
    case 'erholung': return k.schlag.erholung;
    case 'rolle': return w.rolle.dauer;
    case 'betaeubt': return k.betaeubtFuer ?? w.betaeubt;
    case 'zucken': return w.zucken ?? 0;
    default: return Infinity;
  }
}

const NAECHSTE: Partial<Record<Phase, Phase>> = {
  vorlauf: 'aktiv', aktiv: 'erholung', erholung: 'bereit', rolle: 'bereit', betaeubt: 'bereit',
  zucken: 'bereit',
};

/** Weiterschieben einer Position durch Kollision und Gelände — die Szene reicht ihre ein. */
export type Schieber = (x: number, z: number) => [number, number];

/** Ein Teilschritt für einen Kämpfer: Uhren, Ausdauer, Haltung, Rollweg, Phasenwechsel. */
export function schrittKaempfer(k: Kaempfer, dt: number, schiebe?: Schieber): void {
  if (dt <= 0) return;
  const w = k.werte;
  k.seitTreffer += dt;
  if (k.seitWurf !== undefined) k.seitWurf += dt;
  k.seitSchlag += dt;
  // Die Uhr des Puffers steht, solange der eigene Schwung läuft und noch nicht abbrechbar ist (D171,
  // im Bild gefunden): Bei der Axt lagen 0,77 s zwischen Druck und Abbruchpunkt — ein Druck im
  // Durchzug verfiel, bevor er dran war. Wer beim Ausholen hämmert, verliert ihn weiter.
  const haelt = k.phase === 'aktiv' || (k.phase === 'erholung' && k.zeit < k.schlag.erholung * KOMBO_AB);
  if (k.puffer && !haelt) { k.puffer.rest -= dt; if (k.puffer.rest <= 0) k.puffer = null; }
  if (k.komboOffen > 0) k.komboOffen = Math.max(0, k.komboOffen - dt);
  if (!k.ausdauerFremd) k.ausdauer = ausdauerSchritt(k.ausdauer, dt, 0);
  // Rückstoss: der Rest gleichmässig über die Restzeit, durch Kollision und Gelände.
  if (k.stoss && k.stoss.rest > 0) {
    const t = Math.min(dt, k.stoss.rest), f = t / k.stoss.rest;
    const mx = k.stoss.x * f, mz = k.stoss.z * f;
    let nx = k.x + mx, nz = k.z + mz;
    if (schiebe) [nx, nz] = schiebe(nx, nz);
    k.x = nx; k.z = nz;
    k.stoss = k.stoss.rest - t > 1e-9 ? { x: k.stoss.x - mx, z: k.stoss.z - mz, rest: k.stoss.rest - t } : null;
  }
  if (k.seitTreffer >= w.haltungRuhe) k.haltung = Math.min(w.haltungMax, k.haltung + w.haltungErholung * dt);
  if (k.phase === 'gefallen') { k.zeit += dt; return; }

  if (k.phase === 'rolle' && (k.rolleX !== 0 || k.rolleZ !== 0)) {
    const t = Math.min(dt, Math.max(0, w.rolle.dauer - k.zeit));
    if (t > 0) {
      const v = w.rolle.strecke / w.rolle.dauer;
      let nx = k.x + k.rolleX * v * t, nz = k.z + k.rolleZ * v * t;
      if (schiebe) [nx, nz] = schiebe(nx, nz);
      k.x = nx; k.z = nz;
    }
  }

  // Vorschritt (D171): im letzten Drittel des Vorlaufs und im Aktiven, in Blickrichtung.
  const sw = k.schlag.schritt ?? 0;
  if (sw > 0 && (k.phase === 'vorlauf' || k.phase === 'aktiv')) {
    const ab = k.schlag.vorlauf * (2 / 3);
    const spanne = k.schlag.vorlauf - ab + k.schlag.aktiv;
    const t0 = k.phase === 'vorlauf' ? k.zeit : k.schlag.vorlauf + k.zeit;
    const anteil = Math.max(0, Math.min(t0 + dt, ab + spanne) - Math.max(t0, ab));
    if (anteil > 0) {
      const [fx, fz] = vorwaerts(k.blick);
      let nx = k.x + fx * sw * anteil / spanne, nz = k.z + fz * sw * anteil / spanne;
      if (schiebe) [nx, nz] = schiebe(nx, nz);
      k.x = nx; k.z = nz;
    }
  }

  k.zeit += dt;
  for (;;) {
    const dauer = phasenDauer(k);
    if (k.zeit < dauer) break;
    const naechste: Phase | undefined = NAECHSTE[k.phase];
    if (!naechste) break;
    k.zeit -= dauer;
    if (k.phase === 'erholung' && k.folge.length > 0) {
      // Kette (D171): der nächste Schlag ohne Pause, ohne neue Kosten.
      const rest = k.zeit;
      const s = k.folge.shift()!;
      // Linie vor dem Zählen, wie in `beginneSchlag` — sonst schlüge die Kette aus derselben Linie.
      k.schlagLinie = linieFuer(k, s);
      k.schlag = s; k.phase = 'vorlauf'; k.zeit = rest; k.schwung++; k.erreicht = new Set();
      continue;
    }
    if (k.phase === 'erholung') k.komboOffen = KOMBO_FENSTER;
    // D174: Ein Mensch wechselt nach dem eigenen Angriff die Deckung.
    if (k.phase === 'erholung' && k.werte.mensch) k.deckung = andereLinie(k.deckung);
    k.phase = naechste;
    if (naechste === 'bereit') { k.zeit = 0; break; }
  }
}

/**
 * Das Verhalten des Übungsgegners.
 *
 * Wach unter 11 m, dreht sich zu, rückt auf 90 % seiner Reichweite auf und schlägt, wenn er
 * einigermassen gerade steht. Im Vorlauf dreht er sich nur mit `schlag.nachdrehen` nach — das ist
 * die Lücke, in die eine Seitwärtsrolle fällt.
 */
export function denkeGegner(g: Kaempfer, s: Kaempfer, dt: number, schiebe?: Schieber, darf = true, platz?: number): void {
  if (g.phase === 'gefallen' || s.phase === 'gefallen') return;
  const dx = s.x - g.x, dz = s.z - g.z;
  const d = Math.hypot(dx, dz);
  if (d > GEGNER_KI.wachAb) return;
  const ziel = blickAuf(g.x, g.z, s.x, s.z);
  if (g.phase === 'vorlauf') { drehe(g, ziel, g.schlag.nachdrehen, dt); return; }
  if (g.phase !== 'bereit') return;
  drehe(g, ziel, GEGNER_KI.drehrate, dt);
  const halt = g.werte.schlag.reichweite * GEGNER_KI.abstand;
  if (!darf) { warte(g, s, dx, dz, d, halt, dt, schiebe, platz); return; }
  // Mit Spiel von 1 cm: Ohne sie rückte der Gegner im Spiel unendlich weiter um 1e-16 m
  // an und schlug nie zu — der letzte Schritt landet nur bei achsparallelen Zahlen exakt auf
  // `halt`. Das Tor hatte nur achsparallel geprüft; gefunden erst im Bild (D166).
  if (d - s.werte.radius > halt + 0.01) {
    const schrittweite = Math.min((g.werte.tempo ?? GEGNER_KI.tempo) * dt, d - s.werte.radius - halt);
    let nx = g.x + (dx / d) * schrittweite, nz = g.z + (dz / d) * schrittweite;
    if (schiebe) [nx, nz] = schiebe(nx, nz);
    g.x = nx; g.z = nz;
  } else if (Math.abs(winkelDiff(g.blick, ziel)) < GEGNER_KI.zielt) {
    setzeSchlagAn(g);
  }
}

/** Ein Schritt in der Ebene, durch Kollision und Gelände geschoben. */
function geheUm(g: Kaempfer, vx: number, vz: number, schiebe?: Schieber): void {
  let nx = g.x + vx, nz = g.z + vz;
  if (schiebe) [nx, nz] = schiebe(nx, nz);
  g.x = nx; g.z = nz;
}

/**
 * Warten ohne Angriffsrecht: auf den Ring `halt + warteAbstand` und dort seitwärts kreisen.
 *
 * Kreisen statt Stehen, weil ein stehender zweiter Gegner wie ein Fehler aussieht und weil er
 * so die Spielerin nicht zustellt. Die Richtung hängt an der Id — zwei Wartende kreisen nicht
 * zwangsläufig gleich herum, aber jeder bleibt bei seiner.
 */
function warte(g: Kaempfer, s: Kaempfer, dx: number, dz: number, d: number, halt: number,
               dt: number, schiebe?: Schieber, platz?: number): void {
  if (d < 1e-6) return;
  const ring = halt + GEGNER_KI.warteAbstand;
  const rand = d - s.werte.radius;
  const ux = dx / d, uz = dz / d;
  const tempo = g.werte.tempo ?? GEGNER_KI.tempo;
  if (rand > ring + 0.3) {
    const w = Math.min(tempo * dt, rand - ring);
    geheUm(g, ux * w, uz * w, schiebe);
  } else if (rand < ring - 0.3) {
    const w = Math.min(tempo * 0.6 * dt, ring - rand);
    geheUm(g, -ux * w, -uz * w, schiebe);
  } else if (platz !== undefined) {
    // Umzingeln (D172): zum zugewiesenen Platz auf dem Ring, dort stehen bleiben und lauern.
    const jetzt = Math.atan2(-dx, -dz);                     // Richtung Spielerin → Gegner
    const diff = winkelDiff(jetzt, platz);
    if (Math.abs(diff) > 0.08) {
      const seite = Math.sign(diff);
      const w = Math.min(tempo * GEGNER_KI.kreisen * dt, Math.abs(diff) * d) * seite;
      // Tangente in Richtung wachsenden Winkels um die Spielerin.
      geheUm(g, -uz * w, ux * w, schiebe);
    }
  } else {
    const seite = g.id.charCodeAt(g.id.length - 1) % 2 === 0 ? 1 : -1;
    const w = GEGNER_KI.tempo * GEGNER_KI.kreisen * dt * seite;
    geheUm(g, -uz * w, ux * w, schiebe);
  }
}

/**
 * Plätze der Wartenden (D172): Wer nicht angreifen darf, verteilt sich um die Spielerin — bei zwei
 * Wartenden je 110° links und rechts vom Angreifer, bei dreien dazu einer im Rücken. Ein Rudel
 * kreist nicht, es stellt. Ohne Angreifer: um den ersten Wartenden herum.
 */
export function wartePlaetze(w: Kampfwelt): Map<string, number> {
  const s = w.spielerin;
  const winkel = (g: Kaempfer) => Math.atan2(g.x - s.x, g.z - s.z);
  const lebend = w.gegner.filter(g => g.phase !== 'gefallen');
  const angreifer = lebend.find(g => g.id === w.recht);
  const wartend = lebend.filter(g => g !== angreifer);
  const plaetze = new Map<string, number>();
  if (wartend.length < 2 && !angreifer) return plaetze;
  const basis = angreifer ? winkel(angreifer) : winkel(wartend[0]);
  const versatz = [110 * GRAD, -110 * GRAD, Math.PI, 55 * GRAD, -55 * GRAD];
  // Jeder nimmt den nächstgelegenen freien Platz — sonst laufen zwei aneinander vorbei.
  const frei = versatz.slice(0, wartend.length).map(v => basis + v);
  for (const g of [...wartend].sort((a, b) => a.id.localeCompare(b.id))) {
    let beste = 0;
    for (let i = 1; i < frei.length; i++) {
      if (Math.abs(winkelDiff(winkel(g), frei[i])) < Math.abs(winkelDiff(winkel(g), frei[beste]))) beste = i;
    }
    plaetze.set(g.id, frei[beste]);   // dieselbe Konvention wie `warte`: atan2(x, z) von der Spielerin aus
    frei.splice(beste, 1);
  }
  return plaetze;
}

/**
 * Wer darf angreifen? Höchstens **ein** Gegner zugleich (D167).
 *
 * Wer gerade ausholt, schlägt oder sich erholt, behält das Recht. Sonst bekommt es der Wache, der
 * am längsten nicht geschlagen hat — so wechseln sich zwei ab, statt dass der nähere ewig dran
 * ist. Ohne diese Regel schlugen im Bild zwei Übungsgegner im selben Takt, und eine stehende
 * Spielerin fiel in 2,5 s; das ist kein Kampf, sondern ein Zufall der Aufstellung.
 */
export function angriffsrecht(w: Kampfwelt): string | null {
  const s = w.spielerin;
  const dran = w.gegner.find(g => g.phase === 'vorlauf' || g.phase === 'aktiv' || g.phase === 'erholung');
  if (dran) return dran.id;
  let beste: Kaempfer | null = null;
  for (const g of w.gegner) {
    if (g.phase !== 'bereit') continue;
    const d = Math.hypot(g.x - s.x, g.z - s.z);
    if (d > GEGNER_KI.wachAb) continue;
    if (!beste || g.seitSchlag > beste.seitSchlag + 1e-9
        || (Math.abs(g.seitSchlag - beste.seitSchlag) <= 1e-9 && d < Math.hypot(beste.x - s.x, beste.z - s.z))) {
      beste = g;
    }
  }
  return beste?.id ?? null;
}

/**
 * Zielaufschaltung: das nächste lebende Ziel im Blickkegel und in Reichweite.
 *
 * Nächstes, nicht mittigstes — im Getümmel will man den, der gleich zuschlägt, und das ist der,
 * der am nächsten steht.
 */
export function waehleZiel(von: Kaempfer, kandidaten: readonly Kaempfer[], angreifer: string | null = null): Kaempfer | null {
  // Wer gerade das Angriffsrecht hat, geht vor — auch etwas ausserhalb des Kegels (D168). Im Bild
  // (D167) war der aufgeschaltete Gegner oft der wartende, und der Angreifer stand am Bildrand.
  const a = angreifer ? kandidaten.find(k => k.id === angreifer && k.phase !== 'gefallen') : undefined;
  if (a && Math.hypot(a.x - von.x, a.z - von.z) <= ZIELEN.reichweite
      && Math.abs(winkelDiff(von.blick, blickAuf(von.x, von.z, a.x, a.z))) <= ZIELEN.angreiferWinkel) {
    return a;
  }
  let beste: Kaempfer | null = null, besteD = Infinity;
  for (const k of kandidaten) {
    if (k.phase === 'gefallen') continue;
    const d = Math.hypot(k.x - von.x, k.z - von.z);
    if (d > ZIELEN.reichweite || d >= besteD) continue;
    if (Math.abs(winkelDiff(von.blick, blickAuf(von.x, von.z, k.x, k.z))) > ZIELEN.halbwinkel) continue;
    beste = k; besteD = d;
  }
  return beste;
}

/**
 * Ziel wechseln (D168): der nächste lebende Gegner **seitlich** vom aktuellen, in Reichweite.
 *
 * `richtung` +1 heisst rechts, −1 links — vom Blick der Spielerin aus. Gemessen wird der Winkel
 * gegen die Blickrichtung; gewählt wird der kleinste Schritt über den Winkel des aktuellen Ziels
 * hinaus. Kein Umlauf: Wer ganz rechts ist, bleibt, statt nach links zu springen — ein Sprung
 * über die ganze Szene wäre im Getümmel die falsche Überraschung.
 */
export function wechsleZiel(von: Kaempfer, kandidaten: readonly Kaempfer[], aktuell: string | null,
                            richtung: 1 | -1): Kaempfer | null {
  const rechts = (k: Kaempfer) => -winkelDiff(von.blick, blickAuf(von.x, von.z, k.x, k.z));
  const jetzt = kandidaten.find(k => k.id === aktuell);
  const basis = jetzt ? rechts(jetzt) : 0;
  let beste: Kaempfer | null = null, besterSchritt = Infinity;
  for (const k of kandidaten) {
    if (k.id === aktuell || k.phase === 'gefallen') continue;
    if (Math.hypot(k.x - von.x, k.z - von.z) > ZIELEN.reichweite) continue;
    const schritt = (rechts(k) - basis) * richtung;
    if (schritt > 1e-6 && schritt < besterSchritt) { beste = k; besterSchritt = schritt; }
  }
  return beste ?? jetzt ?? null;
}

export interface Kampfwelt {
  spielerin: Kaempfer;
  gegner: Kaempfer[];
  /** Id des aufgeschalteten Gegners oder `null`. */
  ziel: string | null;
  /** Noch nicht gerechnete Zeit unter einem Teilschritt — siehe `simuliere`. */
  uebrig?: number;
  /** D187: Galerie — die Gegner stehen nur da, denken nicht, greifen nicht an. */
  friedlich?: boolean;
  /** Wer im letzten Teilschritt angreifen durfte — nur zum Ansehen (`kampf.mjs`). */
  recht?: string | null;
  /** Restzeit des Trefferstopps (D171). */
  stopp?: number;
  /** Restzeit der Atempause und ob im letzten Teilschritt jemand angriff (D172). */
  atem?: number;
  warDran?: boolean;
}

/**
 * Die Welt um `dt` weiterrechnen, in **festen** Teilschritten von `SCHRITT`.
 *
 * Was unter einem Teilschritt übrig bleibt, wird in `uebrig` mitgenommen statt als kürzerer
 * Schritt gerechnet. Damit ist das Ergebnis dasselbe, ob die Szene mit 30, 60 oder 144 Bildern
 * läuft — der Test prüft genau das. Mit einem verkürzten Restschritt wäre es das nicht: Die
 * Phasengrenzen fielen je nach Bildrate auf andere Teilschritte.
 *
 * Reihenfolge je Teilschritt: Gegner denken, alle Uhren laufen, dann Treffer — die Spielerin zuerst.
 * Wer im selben Teilschritt trifft wie der Gegner, gewinnt den Tausch; die Spielerin ist schneller
 * und soll das spüren.
 */
export function simuliere(w: Kampfwelt, dt: number, schiebe?: Schieber): Treffer[] {
  const ereignisse: Treffer[] = [];
  w.uebrig = (w.uebrig ?? 0) + Math.max(0, dt);
  while (w.uebrig >= SCHRITT - 1e-12) {
    const h = SCHRITT;
    w.uebrig -= h;
    // Trefferstopp (D171): Die Welt hält kurz an — der Treffer hat Gewicht, bevor es weitergeht.
    if ((w.stopp ?? 0) > 1e-9) { w.stopp = Math.max(0, (w.stopp ?? 0) - h); continue; }
    verarbeitePuffer(w.spielerin);
    const dran = w.gegner.some(g => g.phase === 'vorlauf' || g.phase === 'aktiv' || g.phase === 'erholung');
    if (w.warDran && !dran && w.gegner.filter(g => g.phase !== 'gefallen').length > 1) w.atem = GEGNER_KI.atempause;
    w.warDran = dran;
    const atmet = (w.atem ?? 0) > 1e-9;
    if (atmet) w.atem = Math.max(0, (w.atem ?? 0) - h);
    w.recht = angriffsrecht(w);
    const plaetze = w.gegner.length > 2 ? wartePlaetze(w) : undefined;
    for (const g of w.gegner) {
      const darf = !atmet && (w.recht === null || w.recht === g.id);
      if (!w.friedlich) denkeGegner(g, w.spielerin, h, schiebe, darf, plaetze?.get(g.id));
    }
    schrittKaempfer(w.spielerin, h, schiebe);
    for (const g of w.gegner) schrittKaempfer(g, h, schiebe);
    const neu = loeseTreffer(w.spielerin, w.gegner);
    for (const g of w.gegner) neu.push(...loeseTreffer(g, [w.spielerin]));
    if (neu.some(e => e.schaden > 0)) w.stopp = TREFFERSTOPP;
    ereignisse.push(...neu);
    if (w.ziel && w.gegner.find(g => g.id === w.ziel)?.phase === 'gefallen') w.ziel = null;
  }
  return ereignisse;
}
