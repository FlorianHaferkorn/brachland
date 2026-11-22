/**
 * BRACHLAND — Inhaltsschemas
 *
 * Diese Datei ist der Drift-Schutz des Projekts: Jeder Spielinhalt muss hier
 * hindurch. Neue Inhalte passen ins Schema, oder das Schema wird bewusst
 * geändert — unbemerktes Abdriften ist damit ausgeschlossen.
 */
import { z } from 'zod';
import FIGUREN_REGISTER from '../../public/figuren/register.json';

// ---------------------------------------------------------------- Elemente

export const ELEMENTE = [
  'holz', 'stein', 'alt-tech', 'sporen', 'wasser', 'brand', 'frost', 'faeulnis',
] as const;
export const Element = z.enum(ELEMENTE);
export type Element = z.infer<typeof Element>;

/**
 * Effektivitätsmatrix als Zirkulant: Element i schlägt i+1 und i+2.
 * Nicht von Hand gepflegt, sondern erzeugt — dadurch strukturell garantiert
 * ausgewogen (jedes Element 2 Stärken, 2 Schwächen, 3 neutral).
 */
export function effektivitaet(angreifer: Element, verteidiger: Element): number {
  const n = ELEMENTE.length;
  const a = ELEMENTE.indexOf(angreifer);
  const d = ELEMENTE.indexOf(verteidiger);
  const schlaegt = (x: number, y: number) => (y - x + n) % n === 1 || (y - x + n) % n === 2;
  if (schlaegt(a, d)) return 2.0;
  if (schlaegt(d, a)) return 0.5;
  return 1.0;
}

/** Verteidigung multipliziert beide Typen: 2×2=4, 2×0.5=1, 0.5×0.5=0.25 */
export function schadensfaktor(angriff: Element, verteidigerTypen: Element[]): number {
  return verteidigerTypen.reduce((f, t) => f * effektivitaet(angriff, t), 1);
}

// ------------------------------------------------------------------- Moves

export const PowerBand = z.enum(['leicht', 'normal', 'schwer', 'utility']);

/** Kosten und Power je Band — zentral, damit Balancing an einer Stelle passiert. */
export const BAND = {
  leicht:  { power: 0.7, fokus: 1 },
  normal:  { power: 1.0, fokus: 2 },
  schwer:  { power: 1.5, fokus: 3 },
  utility: { power: 0.0, fokus: 2 },
} as const;

export const MoveEffekt = z.discriminatedUnion('art', [
  z.object({ art: z.literal('statuswert'), wert: z.enum(['ang','ver','ini']),
             stufen: z.number().int().min(-3).max(3), ziel: z.enum(['selbst','gegner']) }),
  // `proRunde` ist ein Anteil der maximalen KP (`battle.ts`), keine Punktzahl. Ohne Grenze standen
  // 5 und 6 im Bestand — 500 % pro Runde, ein Sofort-K.o. auch gegen den Regenten (D246).
  z.object({ art: z.literal('schaden_ueber_zeit'), proRunde: z.number().gt(0).max(0.25), runden: z.number().int() }),
  z.object({ art: z.literal('befall'), chance: z.number().min(0).max(1) }),
  z.object({ art: z.literal('wechselsperre'), runden: z.number().int() }),
  z.object({ art: z.literal('heilung'), anteil: z.number().min(0).max(1) }),
  z.object({ art: z.literal('reinigung') }),
  z.object({ art: z.literal('mehrfachtreffer'), treffer: z.number().int().min(2).max(5) }),
  /**
   * Genauigkeit — die echte Umsetzung, nicht mehr der Ersatz über `ang`.
   *
   * Ledger G-24: `blendlinse` („Der Gegner trifft schlechter") war als
   * `statuswert ang -2` umgesetzt, weil die Engine keinen Trefferwurf hatte.
   * Das ist nicht dasselbe: Weniger Angriff heißt gleichmäßig weniger Schaden,
   * weniger Genauigkeit heißt **gelegentlich gar keiner**. Der Unterschied ist
   * genau das, was eine Blendung ausmacht.
   */
  z.object({ art: z.literal('genauigkeit'), stufen: z.number().int().min(-3).max(3),
             ziel: z.enum(['selbst','gegner']) }),
]);
export type MoveEffekt = z.infer<typeof MoveEffekt>;

export const Move = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  element: Element,
  band: PowerBand,
  effekte: z.array(MoveEffekt).default([]),
  beschreibung: z.string().max(200),
});
export type Move = z.infer<typeof Move>;

// --------------------------------------------------------------- Kreaturen

export const Ursprung = z.enum(['wildling', 'zuchtlinie', 'verwachsener']);
export type Ursprung = z.infer<typeof Ursprung>;

/**
 * Die vier Zustände der Creature Design Bible v1.1.
 *
 * `rueckgefuehrt` war bis hierher nicht im Enum — das Blatt kennt vier Zustände,
 * der Code kannte drei. Der vierte ist der einzige, der etwas **behält**: Eine
 * zurückgeführte Kreatur ist gereinigt (keine Zehrung, kein Befall-Bonus) und
 * trägt dafür eine **Narbe**, die dauerhaft wirkt.
 *
 * Reihenfolge ist der Verlauf: rein → befallen → verhärtet ist die Sackgasse,
 * rein → befallen → rückgeführt der Weg zurück.
 */
export const Zustand = z.enum(['rein', 'befallen', 'verhaertet', 'rueckgefuehrt']);

/**
 * Was eine Narbe tut — eine Wirkung je Herkunft.
 *
 * Das Blatt nennt „+15 % Krit-Chance", „+20 % Resistenz", „+30 % Verteidigung".
 * Beim Nachrechnen fiel auf, dass Resistenz und Verteidigung auf denselben
 * Engine-Wert (`ver`) gelaufen wären — drei Narben, mechanisch zwei Effekte.
 * Deshalb sind sie hier **verschieden definiert**:
 *
 * - `krit`       hebt die Volltrefferchance (Wildlinge: das Tier lernt zielen)
 * - `resistenz`  stumpft den **Elementnachteil** ab, nicht die Verteidigung
 *                (Zuchtlinien: das Protokoll kompensiert die Schwäche)
 * - `panzer`     hebt `ver` (Verwachsene: Infrastruktur als Rüstung)
 *
 * Damit sind es drei Effekte, die sich im Kampf unterschiedlich anfühlen — und
 * die Zahlen des Blattes bleiben, wie sie dort stehen.
 */
export const NarbenArt = z.enum(['krit', 'resistenz', 'panzer']);
export type NarbenArt = z.infer<typeof NarbenArt>;

export const NARBE: Record<z.infer<typeof Ursprung>, { art: NarbenArt; wert: number }> = {
  wildling:     { art: 'krit',      wert: 0.15 },
  zuchtlinie:   { art: 'resistenz', wert: 0.20 },
  verwachsener: { art: 'panzer',    wert: 0.30 },
};

export const Werte = z.object({
  kp:  z.number().int().min(1).max(400),
  ang: z.number().int().min(1).max(200),
  ver: z.number().int().min(1).max(200),
  ini: z.number().int().min(1).max(200),
});

export const Stufe = z.object({
  name: z.string(),
  werte: Werte,
  /** Signaturmove dieser Stufe. Stufe 1 hat keinen (dort greifen die Grundmoves). */
  signaturMove: z.string().optional(),
});

/** Spawn wird direkt aus OSM-Tags abgeleitet — die Pipeline setzt das automatisch. */
export const Spawn = z.object({
  osmTag: z.string().regex(/^[a-z_]+=[a-z_]+$/).optional(),
  minHoehe: z.number().optional(),
  maxHoehe: z.number().optional(),
  nurNachts: z.boolean().default(false),
  wetter: z.enum(['beliebig','frost','nebel','regen']).default('beliebig'),
  haeufigkeit: z.enum(['haeufig','gelegentlich','selten','fest']),
  /** Feste Positionen für Verwachsene und Uniques. */
  position: z.tuple([z.number(), z.number()]).optional(),
});

export const Kreatur = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  linie: z.string(),
  basis: z.string().describe('reales Tier'),
  merkmal: z.string().describe('genau EIN Biotech-Merkmal — Designregel'),
  elemente: z.array(Element).min(1).max(2),
  ursprung: Ursprung,
  basisRig: z.string().describe('Archetyp-Rig, z.B. quadruped'),
  /**
   * Widerristhöhe des Modells in Metern, wenn die Rig-Höhe nicht passt (D125).
   * Die Kette normt auf `RIG_HOEHE[basisRig]`; ein Biber mit `quadruped`
   * käme so auf 2,96 m Länge, ein Salamander mit `quadruped_small` auf 2,48 m —
   * lange, flache Tiere werden durch eine Rig-Höhe gross. Ohne Angabe gilt das Rig.
   */
  widerrist: z.number().min(0.1).max(2.5).optional(),
  zielTris: z.number().int().min(1000).max(10000).default(4000),
  spawn: Spawn,
  grundMoves: z.array(z.string()).length(2),
  stufen: z.array(Stufe).min(1).max(3),
  fangbar: z.boolean().default(true),
  beschreibung: z.string().max(400),
})
.refine(k => k.ursprung !== 'verwachsener' || k.elemente.length === 2,
  { message: 'Verwachsene sind immer doppeltypig (Tier + Infrastruktur)' })
.refine(k => k.ursprung !== 'verwachsener' || k.stufen.length === 1,
  { message: 'Verwachsene haben genau eine Stufe' })
.refine(k => k.ursprung !== 'verwachsener' || !k.fangbar,
  { message: 'Verwachsene sind nicht fangbar — nur besiegen oder heilen' })
.refine(k => k.stufen.slice(1).every(s => s.signaturMove),
  { message: 'Jede Stufe ab 2 braucht einen Signaturmove' })
.refine(k => {
    // Werte müssen je Stufe steigen
    for (let i = 1; i < k.stufen.length; i++) {
      const a = k.stufen[i-1].werte, b = k.stufen[i].werte;
      if (b.kp <= a.kp || b.ang <= a.ang) return false;
    }
    return true;
  }, { message: 'Werte müssen mit jeder Stufe steigen' });
export type Kreatur = z.infer<typeof Kreatur>;

// ------------------------------------------------------------- Fragmente

/**
 * Ein Fundstück in der Welt.
 *
 * Die Story-Bibel legt „Fragmente statt Cutscenes" fest: Die Geschichte liegt an
 * Orten, nicht in Dialogen. Deshalb hat ein Fragment eine Position und keinen
 * Sprecher — wer es findet, liest es; wer nicht sucht, geht daran vorbei.
 *
 * 400 Zeichen sind die Obergrenze und sie sind gemeint. Der Ton verträgt keine
 * Textwand, und ein Fundstück, das man im Stehen nicht zu Ende liest, ist keins.
 */
export const Fragment = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  region: z.string(),
  /** Fundort in der Welt (lat, lon). */
  ort: z.tuple([z.number(), z.number()]),
  titel: z.string().max(60),
  text: z.string().max(400),
  /**
   * Woran es liegt — nur zur Einordnung beim Anlegen.
   *
   * `weiher` kam dazu, als der erste Fund **unter Wasser** lag. Er ist die einzige
   * Fundstelle, die eine Fähigkeit voraussetzt: Der Marker steht auf der Sohle des
   * größten Weihers (62 × 71 m, 2,40 m tief), rund 30 m vom Ufer. Der Auslöser
   * misst waagerecht 9 m — von jedem Ufer aus ist das unerreichbar, ohne zu
   * schwimmen. Damit hat Schwimmen zum ersten Mal einen Grund, der nicht
   * „ein Bach liegt im Weg" heißt.
   */
  fundstelle: z.enum(['ruine', 'bunker', 'steinbruch', 'grat', 'bach', 'hof', 'weiher']),
});
export type Fragment = z.infer<typeof Fragment>;

// ----------------------------------------------------------------- Orte

/**
 * Ein fester Ort in der Welt, an dem etwas passiert.
 *
 * Zwei Arten, ein Schema — weil beide dasselbe brauchen: eine Position, eine
 * sichtbare Marke, einen Auslöseradius und einen Knopf.
 *
 * `zuflucht` heilt das Team. Der Grund steht in G-35: Ohne Heilung außerhalb des
 * Kampfes war die **Niederlage** der zuverlässigste Weg zu vollen KP, weil sie
 * vollständig heilt. Gegenstände haben das entschärft, aber nicht behoben — wer
 * keinen Sud mehr hat, hat weiterhin nur die eine Wahl. Eine Zuflucht kostet
 * dafür den Weg dorthin, und das ist der Preis, den ein Rastplatz haben soll.
 *
 * `bewohner` gibt Aufträge. Kein Dialogbaum, keine Zeilen zum Durchklicken: Wer
 * anspricht, sieht, was offen ist und was fertig ist.
 *
 * Die Positionen stammen aus den OSM-Gebäuden der Region — freistehende Höfe,
 * Hütten und Kapellen. Die Welt liefert sie umsonst; sie mussten nur belegt werden.
 */
/**
 * D291 Fassaden-Steckbrief (Bauwelt D287): die echte Fassade eines story-relevanten Gebäudes nach Flos Foto. Die
 * Silhouette kommt aus LoD2 (D290), der Steckbrief ergänzt, was kein offener Datensatz hat: Fensterachsen, Laube,
 * Farben, Malerei. Zuordnung zum Gebäude über `ort` (liegt im Grundriss). Ohne Steckbrief setzt der Generator die
 * Fassade nach Bautyp.
 */
const Hex = z.string().regex(/^#[0-9a-f]{6}$/i);
/**
 * D352: Referenzmaße der Welt. Jede Zeile nennt eine reale Spanne mit Quelle; `tools/massstab.ts`
 * misst die gebaute Geometrie dagegen (`messung`). `belegt: false` heisst: Spanne ohne geprüfte
 * Quelle, das Tor warnt dann nur.
 */
export const MassReferenz = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  was: z.string().min(3),
  min: z.number().positive(),
  max: z.number().positive(),
  ziel: z.number().positive(),
  quelle: z.string().min(3),
  url: z.union([z.string().url(), z.literal('')]),
  /** `streu`: Eingabe für `tools/streukarten.py` (D361), im Tor nur aufgelistet. `boden` (D366): Bodenpflanzen-Karten
   *  (`tools/bodenkarten.py`), das Tor misst die aufgestellten Pflanzenhöhen aus `src/world/bodenpflanzen.ts`.
   *  `stamm` (D364): BHD aus `baeume.json`; `rinde` (D364): Kachelmass der Rinden-Scans (`RINDE_KACHEL`) gegen die Scangrösse. */
  messung: z.enum(['hausbewuchs', 'figur', 'bordstein', 'baum', 'streu', 'boden', 'stamm', 'rinde']),
  belegt: z.boolean(),
}).refine(r => r.min <= r.ziel && r.ziel <= r.max, 'ziel liegt nicht zwischen min und max');
export const Massstab = z.object({ referenzen: z.array(MassReferenz).min(1) });
export type MassReferenz = z.infer<typeof MassReferenz>;

/**
 * D360: Hof-Baukasten für den Inntaler Einfirsthof (`content/hofbaukasten.json`, gelesen von
 * `tools/hofbaukasten.py`). Jede Zahl trägt ihre Quelle; was die Bauwelt-Notiz nicht nennt, ist
 * `annahme: true`. Die Schlüssel sind fest, weil das Blender-Werkzeug sie ohne Rückfall liest.
 */
export const HOF_MASSE = [
  'wohnteilbreite', 'gesamtlaenge', 'wohnteilanteil', 'geschosse', 'geschosshoehe_eg', 'geschosshoehe_og',
  'kniestock', 'sockelhoehe', 'mauerstaerke_eg', 'dachneigung', 'ueberstand_traufe', 'ueberstand_giebel',
  'dachdicke', 'laubentiefe', 'bruestungshoehe', 'hochlaube_anteil', 'balken_hoehe', 'balken_staerke',
  'vorkopf', 'brettbreite', 'brettstaerke', 'fenster_breite', 'fenster_hoehe', 'fenster_bruestung',
  'fensterachse', 'tuer_breite', 'tuer_hoehe', 'tennentor_breite', 'tennentor_hoehe', 'pfette_querschnitt',
  'sparrenabstand', 'sparren_hoehe',
] as const;
export const HOF_FARBEN = [
  'putz', 'stein', 'holz_sonne', 'holz_grau', 'ziegel_rot', 'ziegel_anthrazit', 'schindel', 'blech', 'rost', 'laeden',
] as const;
export const HOF_VERFALL = [
  'laeden_fehlen', 'laeden_schief', 'laubenbretter_fehlen', 'laube_abgestuerzt', 'dach_fehlstelle', 'dach_flicken',
  'fenster_verbrettert', 'fenster_licht', 'vergrauung', 'moos',
] as const;
const Herkunft = { quelle: z.string().min(3), annahme: z.boolean() };
export const HofMass = z.object({
  was: z.string().min(3),
  einheit: z.enum(['m', 'grad', 'anteil', 'anzahl']),
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
  ziel: z.number().nonnegative(),
  ...Herkunft,
}).strict().refine(m => m.min <= m.ziel && m.ziel <= m.max, 'ziel liegt nicht zwischen min und max');
const HofWert = z.object({ wert: z.number().nonnegative(), ...Herkunft }).strict();
export const Hofbaukasten = z.object({
  typ: z.literal('einfirsthof'),
  hinweis: z.string(),
  masse: z.object(Object.fromEntries(HOF_MASSE.map(k => [k, HofMass])) as Record<(typeof HOF_MASSE)[number], typeof HofMass>).strict(),
  farben: z.object(Object.fromEntries(HOF_FARBEN.map(k => [k, z.object({ hex: Hex, ...Herkunft }).strict()])) as
    Record<(typeof HOF_FARBEN)[number], z.ZodObject<{ hex: typeof Hex; quelle: z.ZodString; annahme: z.ZodBoolean }, 'strict'>>).strict(),
  verfall: z.array(z.object({
    stufe: z.number().int().min(0).max(3),
    bild: z.string().min(3),
    ...Object.fromEntries(HOF_VERFALL.map(k => [k, HofWert])) as Record<(typeof HOF_VERFALL)[number], typeof HofWert>,
  }).strict()).length(4)
    .refine(v => v.every((s, i) => s.stufe === i), 'verfall muss die Stufen 0, 1, 2, 3 in dieser Reihenfolge enthalten'),
}).strict();
export type Hofbaukasten = z.infer<typeof Hofbaukasten>;

/**
 * D363: Gebäude, die das Spiel durch ein Modell aus dem Hof-Baukasten (`tools/hofbaukasten.py`, D360) ersetzt.
 * `gebaeude` ist der Index in `welt.gebaeude` der Region; das Modell liegt unter `public/bauten/<modell>.glb`.
 */
export const Hofbau = z.object({
  region: z.string(),
  gebaeude: z.number().int().nonnegative(),
  modell: z.string().regex(/^[a-z0-9-]+$/),
  saat: z.number().int(),
  stufe: z.number().int().min(0).max(3),
  grund: z.string().min(10),
});
export const Hofbauten = z.object({ hofbauten: z.array(Hofbau) });
export type Hofbau = z.infer<typeof Hofbau>;

export const Fassade = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  region: z.string(),
  name: z.string().max(60),
  /** Punkt im Grundriss (lat, lon). */
  ort: z.tuple([z.number(), z.number()]),
  /** Eigenes Foto: Pfad unter `assets/fotos/` (nicht ausgeliefert), Aufnahmedatum, Urheber. */
  quelle: z.object({ foto: z.string(), datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), urheber: z.string() }),
  /** Fensterachsen je Geschoss an der Traufseite bzw. am Giebel (Strassenseite zuerst). */
  fensterachsen: z.object({ traufe: z.number().int().min(0).max(14), giebel: z.number().int().min(0).max(8) }),
  laube: z.enum(['keine', 'traufseite', 'giebel', 'umlaufend']),
  hochlaube: z.boolean(),
  /** Farben in sRGB: Putz des Erdgeschosses, Holz von Obergeschoss/Giebel, Fensterläden (null = keine Läden). */
  putz: Hex,
  holz: Hex,
  laeden: Hex.nullable(),
  /** Wandmalerei oder Inschrift, kurz beschrieben (null = keine). */
  malerei: z.string().max(200).nullable(),
  /** Verfallsstufe erzwingen (0 bewohnt … 3 Ruine); ohne Angabe nach Lage (D289). */
  stufe: z.number().int().min(0).max(3).optional(),
  besonderheiten: z.string().max(240).optional(),
});
export type Fassade = z.infer<typeof Fassade>;

export const Ort = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  region: z.string(),
  art: z.enum(['zuflucht', 'bewohner']),
  name: z.string().max(40),
  /** Position in der Welt (lat, lon). */
  ort: z.tuple([z.number(), z.number()]),
  /** Ein Satz, der beim Ansprechen oben steht. Kein Dialog, eine Feststellung. */
  text: z.string().max(240),
  /**
   * Figur aus der Menschenkette (`public/figuren/<figur>.glb`, D143) — nur für
   * `bewohner`. Ohne Angabe steht die karge Silhouette wie bisher. Die Liste
   * kommt aus dem Register der Kette, nicht von Hand (G-129): Was `menschbau.py`
   * baut, darf ein Ort tragen — und nichts anderes.
   */
  figur: z.string().refine(f => (FIGUREN_REGISTER.figuren as string[]).includes(f),
    f => ({ message: `Figur „${f}“ steht nicht in public/figuren/register.json` })).optional(),
  /**
   * Aufwachpunkt einer Zuflucht (D182): Versatz in Metern zu `ort`, x nach Ost, z nach Süd.
   * Dort steht man nach einer Niederlage. `ort` liegt meist im Grundriss — `tools/validate.ts`
   * prüft, dass der Punkt draussen liegt und 2 m Abstand zu jeder Wand hält.
   */
  aufwachen: z.tuple([z.number(), z.number()]).optional(),
  /** Blickrichtung in Grad, 0 = Nord, positiv nach links wie `?absetzen=`. */
  blick: z.number().optional(),
  /**
   * Wegstück in Metern entlang `blick` (D146): der Bewohner geht vom Haus zur
   * Strasse und zurück, mit Pausen. Ohne Angabe steht er.
   */
  gang: z.number().min(0).max(20).optional(),
  /**
   * Laufzeitfarben je Slot (D146) — dieselbe Datei, andere Haar-, Jacken-,
   * Hosenfarbe. Die Slots stehen in `COLOR_0.a` der Figur (`tools/menschbau.py`).
   * sRGB-Hex wie die Palette; das Tor prüft die Leuchtdichte gegen das Kreaturband.
   */
  farben: z.record(
    z.enum(['haut', 'haar', 'oberteil', 'hose', 'stiefel', 'kopf', 'riemen', 'hemd']),
    z.string().regex(/^#[0-9a-fA-F]{6}$/),
  ).optional(),
  /**
   * Schmiede (D177): Das Fenster zeigt die Angebote aus `spiel/schmiede.ts` — Beute gegen eine
   * schärfere Waffe. Kein Handelssystem mit Preisen, eine Werkbank.
   */
  schmied: z.boolean().optional(),
  /**
   * Raum hinter dem Ortsfenster (D242): Art des Innenraums, gebaut von `world/stube.ts`. Ohne
   * Angabe kein Raum — etwa wo der Bewohner vor dem Tor sitzt.
   */
  innen: z.enum(['stube', 'wirtsstube', 'stadel', 'schuppen', 'werkstatt']).optional(),
  /** Was der Bewohner abends im Wirtshaus sagt (D178). Ohne Angabe gilt `text`. */
  textAbend: z.string().max(240).optional(),
  /**
   * Tagesroutine (D177, als Datum seit D375): ID des Orts, zu dem der Bewohner abends geht. Bis D375
   * hing das am Namen (`dorf-…` ging zu `dorf-wirt`); seit die Enklave über die Terrasse verteilt ist,
   * gehen nur die, die nah genug wohnen. `validate` prüft Ziel, Region und Weglänge.
   */
  abends: z.string().optional(),
});
export type Ort = z.infer<typeof Ort>;

// ------------------------------------------------------------- Aufträge

/**
 * Was ein Auftrag verlangt.
 *
 * Alle Bedingungen sind aus dem **Spielstand allein** prüfbar — besiegte und
 * gereinigte Vorkommen, gelesene Fragmente, besiegte Regenten stehen dort ohnehin.
 * Das ist Absicht: Ein Auftragssystem, das eigene Zähler mitschreibt, hat ab dem
 * ersten Tag zwei Wahrheiten über denselben Sachverhalt, und die driften.
 */
export const Auftragsziel = z.discriminatedUnion('art', [
  z.object({ art: z.literal('besiege'), kreatur: z.string(), anzahl: z.number().int().min(1).max(20) }),
  /**
   * Befallene über die Marke reinigen (Story-Bibel v2 §2, D375) — ersetzt `fange`: Fangen, Team und
   * Besitz gibt es in der Erzählung nicht mehr. Gezählt wird `Taten.gereinigt`.
   */
  z.object({ art: z.literal('reinige'), kreatur: z.string(), anzahl: z.number().int().min(1).max(6) }),
  z.object({ art: z.literal('finde'),   fragment: z.string() }),
  z.object({ art: z.literal('regent'),  regent: z.string() }),
  /** Region geheilt: Regent besiegt **und** seine Reinkultur-Komponenten eingesetzt (D240). */
  z.object({ art: z.literal('heile'),   regent: z.string() }),
]);
export type Auftragsziel = z.infer<typeof Auftragsziel>;

/**
 * Kategorien einer Belohnung — der Vertrag zwischen Quest-Entwurf (D392) und Gegenständen (D393). Der
 * Auftrag sagt nur Art und Stufe; welcher Gegenstand das ist, entscheidet die Gegenstandsliste.
 */
export const LOHNKATEGORIEN = [
  'aufwertung-1', 'aufwertung-2', 'aufwertung-3', 'aufwertung-4',
  'verbrauch', 'werkzeug', 'waffe', 'ruestung', 'marke', 'wissen', 'zugang',
] as const;
export const Lohnkategorie = z.enum(LOHNKATEGORIEN);
export type Lohnkategorie = z.infer<typeof Lohnkategorie>;

export const Auftrag = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  region: z.string(),
  /** ID eines `Ort` mit `art: 'bewohner'`. */
  geber: z.string(),
  titel: z.string().max(60),
  /** Der Auftrag in seinen Worten. Höchstens vier Sätze. */
  text: z.string().max(320),
  ziel: Auftragsziel,
  /** Was es dafür gibt: Gegenstands-IDs mit Anzahl. */
  belohnung: z.record(z.string(), z.number().int().min(1).max(9)),
  /** Vorher zu erledigender Auftrag. Leer heißt: von Anfang an offen. */
  vorher: z.string().optional(),
  /**
   * Belohnungsvertrag (D392, `docs/design/BRACHLAND_Quests_v1.md` §8): was dieser Auftrag der Art nach geben
   * soll. **Solange das Feld gesetzt ist, ist `belohnung` ein Platzhalter** aus vorhandenen Gegenständen —
   * die echten Gegenstände setzt D393 und nimmt das Feld dann heraus.
   */
  lohn: z.array(Lohnkategorie).min(1).max(3).optional(),
});
export type Auftrag = z.infer<typeof Auftrag>;

// ------------------------------------------------------- Wanderfiguren

/**
 * Wann eine Wanderfigur eine Station erreicht oder verlässt — dieselbe geschlossene Liste von Prüfungen gegen den
 * Spielstand wie bei den Aufträgen, kein Skript. `auftrag` heisst: Belohnung abgeholt.
 */
export const Stationsbedingung = z.discriminatedUnion('art', [
  z.object({ art: z.literal('finde'),   fragment: z.string() }),
  z.object({ art: z.literal('regent'),  regent: z.string() }),
  z.object({ art: z.literal('heile'),   regent: z.string() }),
  z.object({ art: z.literal('auftrag'), auftrag: z.string() }),
  /**
   * Der Zähler der Mönche (D385, D392): wahr, sobald der Brachgänger so oft eingegriffen hat — getötet **oder**
   * gereinigt, beides zählt. Wie alle Bedingungen hier nur in eine Richtung: einmal wahr, immer wahr.
   */
  z.object({ art: z.literal('eingriffe'), anzahl: z.number().int().min(1).max(500) }),
]);
export type Stationsbedingung = z.infer<typeof Stationsbedingung>;

/**
 * Eine Figur mit eigenem Weg (Story-Bibel v2 §5, D375): je Fraktion eine je Region, drei bis fünf Stationen. Sie
 * steht an der ersten Station, deren `bis` noch nicht eingetreten ist, und nur, wenn deren `ab` gilt — wer zu spät
 * kommt, trifft sie dort nicht mehr. Kein Dialogbaum: ein Satz je Station, wie bei jedem Ort.
 *
 * Kein `Ort`, damit sie weder den Bewohnt-Radius der Häuser (D289) verschiebt noch einen Auftrag braucht.
 */
export const Wanderfigur = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  region: z.string(),
  fraktion: z.enum(['enklave', 'moenche', 'erbe']),
  name: z.string().max(40),
  figur: z.string().refine(f => (FIGUREN_REGISTER.figuren as string[]).includes(f),
    f => ({ message: `Figur „${f}“ steht nicht in public/figuren/register.json` })).optional(),
  farben: z.record(
    z.enum(['haut', 'haar', 'oberteil', 'hose', 'stiefel', 'kopf', 'riemen', 'hemd']),
    z.string().regex(/^#[0-9a-fA-F]{6}$/),
  ).optional(),
  stationen: z.array(z.object({
    /** Wo das ist, in zwei, drei Worten — für Notiz und Prüfausgabe, nicht für eine Kartenmarke. */
    wo: z.string().max(40),
    ort: z.tuple([z.number(), z.number()]),
    text: z.string().max(240),
    blick: z.number().optional(),
    /** Erst ab hier steht die Figur an dieser Station; vorher ist sie nirgends. */
    ab: Stationsbedingung.optional(),
    /** Tritt das ein, zieht sie weiter. Nur die letzte Station darf ohne sein. */
    bis: Stationsbedingung.optional(),
  }).strict()).min(3).max(5),
}).strict().refine(f => f.stationen.slice(0, -1).every(s => s.bis),
  'Jede Station ausser der letzten braucht `bis` — sonst zieht die Figur nie weiter.');
export type Wanderfigur = z.infer<typeof Wanderfigur>;

// ------------------------------------------------------------- Strecken

/**
 * Was eine Station einer Lehrstrecke lehrt (D390). Geschlossene Liste: Es sind die Handlungen, die der
 * Echtzeitkampf (ADR-0007/0009), die Marke (D376) und die Rast kennen — `validate` verlangt, dass eine
 * Strecke jede mindestens einmal trägt.
 */
export const LEKTIONEN = [
  'bewegen', 'kamera', 'leichter-angriff', 'ausdauer', 'rolle', 'block', 'parade', 'lock-on', 'haltung',
  'reinigen', 'rast',
] as const;
export const Lektion = z.enum(LEKTIONEN);
export type Lektion = z.infer<typeof Lektion>;

/**
 * Ein Weg zwischen dieser und der nächsten Station (Story-Bibel v2 §3, D374): der beschwerliche ohne
 * Werkzeug, oder die Abkürzung mit einem. `werkzeug` nur beim Werkzeugweg.
 */
const StreckenWeg = z.object({
  art: z.enum(['beschwerlich', 'werkzeug']),
  werkzeug: z.enum(['klettern', 'schwimmen', 'gleiten', 'reiten']).optional(),
  text: z.string().max(240),
}).strict().refine(w => (w.art === 'werkzeug') === (w.werkzeug !== undefined),
  'Ein Werkzeugweg nennt sein Werkzeug, ein beschwerlicher Weg keins');

const StreckenStation = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().max(40),
  /** Wo die Station liegt (lat, lon) — dort stehen ihre Gegner. */
  ort: z.tuple([z.number(), z.number()]),
  lehrt: z.array(Lektion).min(1).max(3),
  /** Wer hier steht: ID aus `content/gegner/` und Zahl. Leer heisst: kein Kampf. */
  gegner: z.array(z.object({ art: z.string(), anzahl: z.number().int().min(1).max(3) }).strict()).max(3).default([]),
  /** Was man hier sieht — ein Bild, kein Text im Spiel. Vorgabe für Szene und Set-Piece. */
  bild: z.string().max(240).optional(),
  /** Fundstück der Station (`content/fragmente/`). */
  fragment: z.string().optional(),
  /** Zuflucht der Station (`content/orte/`, `art: zuflucht`). */
  zuflucht: z.string().optional(),
  /** Wege von hier zur nächsten Station; ohne Angabe gibt es nur den einen. */
  wege: z.array(StreckenWeg).max(3).optional(),
}).strict().refine(s => s.bild !== undefined || s.fragment !== undefined,
  'Jede Station erzählt etwas: ein Bild oder ein Fundstück');

/**
 * Eine Lehrstrecke (D381, D390): der Weg vom Spielbeginn zur Enklave, als Folge von Stationen. Jede lehrt eine
 * Handlung an einem Gegner, ohne Texttafel — die Welt lehrt (Story-Bibel v2 §6 Schritt 0).
 *
 * **Nur Datum.** Das Spiel liest die Strecke noch nicht: Es stellt weder die Gegner auf noch setzt es den
 * Spielbeginn um. `start` ist der vorbereitete Spielbeginn; der wirksame steht weiter in
 * `LEERER_STAND.position` (`src/spiel/spielstand.ts`). `tools/validate.ts` prüft Lage, Verweise und dass
 * jede Lektion vorkommt; `tools/streckensim.ts` spielt die Aufstellungen mit dem Kampfbot durch.
 */
export const Strecke = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  region: z.string(),
  name: z.string().max(40),
  /** Vorbereiteter Spielbeginn: Ort (lat, lon) und Blick in Grad wie `?absetzen=` (0 = Nord, positiv nach links). */
  start: z.object({ ort: z.tuple([z.number(), z.number()]), blick: z.number() }).strict(),
  stationen: z.array(StreckenStation).min(5).max(8),
  /**
   * Ankunft: der Bewohner, den man als Ersten trifft, sein Satz beim ersten Mal (statt `Ort.text`) und die
   * Zuflucht, in der die Strecke endet.
   */
  ankunft: z.object({ bewohner: z.string(), text: z.string().max(240), zuflucht: z.string() }).strict(),
}).strict()
  .refine(s => s.stationen[0].gegner.length === 0, 'Die erste Station ist kampffrei — dort lernt man gehen')
  .refine(s => new Set(s.stationen.map(x => x.id)).size === s.stationen.length, 'Stations-IDs sind eindeutig');
export type Strecke = z.infer<typeof Strecke>;

// ------------------------------------------------------------ Gegenstände

/**
 * Was ein Gegenstand tut.
 *
 * Bewusst wenige Arten. Ein Beutel voller Varianten derselben Wirkung ist keine
 * Entscheidung, sondern Verwaltung — und die Regel des Projekts lautet, dass
 * Inhalt aus Entscheidungen besteht.
 */
export const GegenstandWirkung = z.discriminatedUnion('art', [
  /** Heilt einen Anteil der maximalen KP. */
  z.object({ art: z.literal('heilung'), anteil: z.number().min(0.05).max(1) }),
  /** Bringt einen ausgefallenen Kämpfer zurück, mit diesem Anteil KP. */
  z.object({ art: z.literal('wiederbelebung'), anteil: z.number().min(0.1).max(1) }),
  /** Entfernt Befall und Statusveränderungen. */
  z.object({ art: z.literal('reinigung') }),
  /** Erhöht die Fangchance um diesen absoluten Betrag. */
  z.object({ art: z.literal('fanghilfe'), bonus: z.number().min(0.05).max(0.6) }),
  /** Füllt Fokus auf. */
  z.object({ art: z.literal('fokus'), punkte: z.number().int().min(1).max(8) }),
  /**
   * Reinkultur-Komponente eines Regenten (D240): wirkt auf keinen Kämpfer, sondern wird am
   * Regentenort eingesetzt, wenn er besiegt ist (`spiel/heilung.ts`).
   */
  z.object({ art: z.literal('komponente') }),
]);

export const Gegenstand = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  wirkung: GegenstandWirkung,
  /** Im Kampf benutzbar? Manches wirkt nur draußen. */
  imKampf: z.boolean().default(true),
  /** Wie häufig er als Beute nach einem Sieg anfällt, 0…1. */
  beuteChance: z.number().min(0).max(1).default(0),
  beschreibung: z.string().max(200),
});
export type Gegenstand = z.infer<typeof Gegenstand>;

// ----------------------------------------------------------------- Regenten

/**
 * Regenten sprengen das Kreaturenband bewusst: Der Flussvater hat 480 KP gegen
 * ein Kreaturenmaximum von 400. Ein Bosskampf gegen ein Team von sechs muss
 * laenger tragen — deshalb ein eigenes Band statt einer aufgeweichten Obergrenze
 * fuer alle. ANG/VER/INI bleiben im Kreaturenband, sonst kippt die Balance.
 */
export const RegentWerte = Werte.extend({
  kp: z.number().int().min(200).max(800),
});

export const Regent = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string(),
  basis: z.string(),
  merkmal: z.string(),
  /** Phasen: Element wechselt bei KP-Schwellen. Zweites Element NUR in der Schlussphase. */
  phasen: z.array(z.object({
    elemente: z.array(Element).min(1).max(2),
    /** **Ab** diesem KP-Anteil abwärts gilt die Phase — erste 1,0, dann fallend (D244, `phaseBei`). */
    abKpAnteil: z.number().min(0).max(1),
    verhalten: z.string(),
  })).min(2).max(4)
    // D245: Die Lesart stand nur im Namen, und die Engine las sie anders (D244). Jetzt prüft sie
    // `validate`, bevor ein zweiter Regent dazukommt.
    .refine(ph => ph[0].abKpAnteil === 1, 'Phasen: Die erste Phase gilt ab vollen KP (abKpAnteil 1)')
    .refine(ph => ph.every((p, i) => i === 0 || p.abKpAnteil < ph[i - 1].abKpAnteil),
      'Phasen: abKpAnteil muss streng fallen — sonst wird eine Phase übersprungen')
    .refine(ph => ph.slice(0, -1).every(p => p.elemente.length === 1),
      'Phasen: Zweites Element nur in der Schlussphase'),
  werte: RegentWerte,
  moves: z.array(z.string()).min(4).max(6),
  /** Reinkultur-Komponenten, die zur Heilung gebraucht werden. */
  reinkulturen: z.array(z.string()).length(3),
  /**
   * Anteil befallener Wildlinge in seiner Region, solange er nicht geheilt ist (D241). Nach der
   * Heilung sind alle rein — der Wandel, den man in jeder Begegnung merkt.
   */
  befall: z.number().min(0).max(1).default(0),
  /** Arten, die nach der Heilung an seinen Ort zurückkehren (D241): neue, reine Vorkommen. */
  nachHeilung: z.array(z.object({ kreatur: z.string(), anzahl: z.number().int().min(1).max(8) })).default([]),
  /**
   * Fester Ort in der Welt (lat, lon).
   *
   * Regenten wandern nicht. Sie sind der Grund, warum eine Region eine Region ist —
   * und man soll sie suchen können, statt ihnen zufällig zu begegnen.
   */
  ort: z.tuple([z.number(), z.number()]),
})
.refine(r => r.phasen.slice(0, -1).every(p => p.elemente.length === 1),
  { message: 'Zweites Element nur in der Schlussphase erlaubt' });

// ------------------------------------------------------------------ Region

export const Konzentrat = z.object({
  element: Element,
  name: z.string(),
  weg: z.enum(['erkundung','gating','verzicht','crafting','heilung','quest','weltzustand','fraktion']),
  beschreibung: z.string(),
});

const Hausnutzung = z.object({
  ort: z.tuple([z.number(), z.number()]).describe('Punkt im Gebäudegrundriss'),
  strasse: z.tuple([z.number(), z.number()]).describe('Zugewandter Punkt auf dem Wohnweg'),
  zustand: z.enum(['ruine', 'verwachsen', 'instandgesetzt']),
  fassadenbaukasten: z.boolean().optional(),
});
export type Hausnutzung = z.infer<typeof Hausnutzung>;

const Strassenobjekt = z.object({
  osmKnoten: z.number().int().positive(),
  osmWeg: z.number().int().positive(),
  ort: z.tuple([z.number(), z.number()]),
  verfall: z.number().min(0).max(1),
});
const Strassengeschichte = Strassenobjekt.pick({ ort: true, verfall: true }).extend({
  richtung: z.number().min(0).lt(360),
});
const Stationsbereich = z.object({
  von: z.number().nonnegative(), bis: z.number().positive(), seite: z.union([z.literal(-1), z.literal(1)]),
});
const Strassenalterung = z.object({
  /** Historische Arbeitsmarkierungen der Spielwelt, quer ab gemessener Fahrbahnmitte. */
  farbreste: z.array(z.object({
    von: z.number().nonnegative(), bis: z.number().positive(), quer: z.number(),
    breite: z.number().min(.05).max(.25),
  }).refine(s => s.bis > s.von)).max(12),
  ausbrueche: z.array(z.object({
    station: z.number().nonnegative(), quer: z.number(),
    laenge: z.number().min(.12).max(2.6), breite: z.number().min(.12).max(1.7),
  })).max(12),
  ablaeufe: z.array(z.object({
    station: z.number().nonnegative(), seite: z.union([z.literal(-1), z.literal(1)]),
  })).max(6),
  schachtdeckel: z.object({
    station: z.number().nonnegative(), quer: z.number(), durchmesser: z.number().min(.3).max(1),
  }).optional(),
});
export type Strassenalterung = z.infer<typeof Strassenalterung>;
const WohnwegQuerschnitt = z.object({
  /** Längsmeter ab dem ersten OSM-Punkt, dann beide Asphaltkanten quer nach (-dz, dx). */
  stationen: z.array(z.tuple([z.number().nonnegative(), z.number(), z.number()])).min(2)
    .refine(s => s.every(([meter, minus, plus], i) => plus > minus && (!i || meter > s[i - 1][0])),
      'Querschnitte nach Station ordnen und Kanten aufsteigend angeben.'),
  gehwege: z.array(Stationsbereich.extend({ breite: z.number().positive() })).default([]),
  zufahrten: z.array(Stationsbereich.extend({
    tiefe: z.number().positive(),
    schotterspuren: z.object({
      /** Abstand der beiden Spurmitten in Metern quer zur Einfahrt. */
      spurabstand: z.number().positive(),
      saumdichte: z.number().min(0).max(1),
    }).optional(),
  }).refine(z => !z.schotterspuren || z.schotterspuren.spurabstand + .55 <= z.bis - z.von,
    'Die beiden Fahrspuren brauchen Abstand zum Rand der Zufahrt.')).default([]),
  verwitterung: z.object({
    staerke: z.number().min(0).max(1),
    saum: z.object({ von: z.number().nonnegative(), bis: z.number().positive() }),
  }).optional(),
  alterung: Strassenalterung.optional(),
}).refine(p => p.stationen.length >= 2 && [...p.gehwege, ...p.zufahrten, ...(p.verwitterung ? [p.verwitterung.saum] : []),
  ...(p.alterung?.farbreste ?? []),
  ...(p.alterung?.ausbrueche ?? []).map(s => ({ von: s.station - s.laenge / 2, bis: s.station + s.laenge / 2 })),
  ...(p.alterung?.ablaeufe ?? []).map(s => ({ von: s.station - .3, bis: s.station + .3 })),
  ...(p.alterung?.schachtdeckel ? [{ von: p.alterung.schachtdeckel.station - p.alterung.schachtdeckel.durchmesser/2,
    bis: p.alterung.schachtdeckel.station + p.alterung.schachtdeckel.durchmesser/2 }] : [])].every(a =>
  a.von < a.bis && a.von >= p.stationen[0][0] && a.bis <= p.stationen.at(-1)![0]),
  'Gehwege, Zufahrten, bewachsene Säume und Alterung müssen innerhalb der gemessenen Stationen liegen.');
export type WohnwegQuerschnitt = z.infer<typeof WohnwegQuerschnitt>;

const Strassenkulisse = z.object({
  wege: z.array(z.object({
    osmWeg: z.number().int().positive(),
    verfall: z.number().min(0).max(1),
    wohnwegrand: z.boolean().optional(),
    querschnitt: WohnwegQuerschnitt.optional(),
    profil: z.object({
      breite: z.number().positive().optional(),
      /** Versatz der Fahrbahnmitte quer zur OSM-Achse in Weltmetern. */
      versatz: z.number().optional(),
      /** Stationen in Metern ab dem ersten OSM-Stützpunkt dieses Weges. */
      markierungen: z.array(z.object({
        von: z.number().nonnegative(),
        bis: z.number().positive(),
        breite: z.number().positive(),
        quer: z.number().optional().describe('Abstand von der Fahrbahnmitte in Weltmetern'),
        querEnde: z.number().optional().describe('Querabstand am Ende eines versetzten Streifens'),
      }).refine(linie => linie.bis > linie.von, 'Markierung endet vor ihrem Anfang.')).optional(),
    }).optional(),
  })),
  objekte: z.array(z.discriminatedUnion('art', [
    Strassenobjekt.extend({ art: z.literal('laterne') }),
    Strassenobjekt.extend({
      art: z.literal('ortstafel'),
      text: z.string().min(1),
      /** Frontnormalenwinkel der Tafel, Nord = 0°. */
      richtung: z.number().min(0).lt(360),
      /** OSM liegt auf der Straßenachse. Auf den rechten Rand der Anfahrt setzen. */
      achsenpunkt: z.boolean(),
    }),
  ])),
  /** Ausstattungsorte für BRACHLAND ohne behaupteten Nachweis des heutigen Objekts. */
  geschichte: z.array(z.discriminatedUnion('art', [
    Strassengeschichte.extend({ art: z.literal('laterne') }),
    Strassengeschichte.extend({ art: z.literal('strassenname'), text: z.string().min(1) }),
    Strassengeschichte.extend({ art: z.literal('kleinwagen') }),
    Strassengeschichte.extend({ art: z.literal('reifen') }),
    Strassengeschichte.extend({ art: z.literal('spielroller') }),
  ])).optional(),
});
export type Strassenkulisse = z.infer<typeof Strassenkulisse>;

export const Nahhoehen = z.object({
  /** Nordwestlicher Stützpunkt im Meter-Koordinatensystem der Region. */
  ursprung: z.tuple([z.number(), z.number()]),
  breite: z.number().int().min(2),
  tiefe: z.number().int().min(2),
  schritt: z.number().positive(),
  auslauf: z.number().positive(),
  datum: z.number(),
  /** Nord nach Süd, je Rasterzeile vorzeichenbehaftete Zentimeter relativ zum Datum, little endian. */
  zeilen: z.array(z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/)),
  quelle: z.string().min(1),
}).refine(r => r.zeilen.length === r.tiefe && r.zeilen.every(zeile => {
  const padding = zeile.endsWith('==') ? 2 : zeile.endsWith('=') ? 1 : 0;
  return zeile.length % 4 === 0 && zeile.length * 3 / 4 - padding === r.breite * 2;
}), 'Das Höhenraster braucht je Stützpunkt zwei Bytes.');
export type Nahhoehen = z.infer<typeof Nahhoehen>;

/**
 * Ein verborgener Ort (Story-Bibel v2 §3, D375): kein Auftrag nennt ihn, kein Bewohner erwähnt ihn. Man findet ihn
 * über Gelände, Licht oder ein Fundstück. **Nur Datum** — das Spiel setzt den Verhärteten noch nicht; das Fundstück
 * (`fragment`) liegt wie jedes andere in der Welt.
 */
const VerborgenerOrt = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().max(40),
  ort: z.tuple([z.number(), z.number()]),
  /** Kreatur, die hier im Endstadium sitzt (nur mit Reinkulturen zu reinigen). */
  verhaerteter: z.string(),
  /** Woran man den Ort findet. */
  spur: z.enum(['gelaende', 'licht', 'fundstueck']),
  /** Fundstück am Ort. `validate` lehnt ab, wenn ein Auftrag darauf zeigt. */
  fragment: z.string().optional(),
}).strict();

export const Region = z.object({
  id: z.string(),
  name: z.string(),
  realeGrundlage: z.string().describe('reale Region, aus der die OSM-Daten stammen'),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  regent: z.string(),
  kreaturen: z.array(z.string()),
  konzentrate: z.array(Konzentrat).max(2),
  /** Seit Traversal v2 (D388) kein Schlüssel mehr: Das Werkzeug kürzt Wege ab, gesperrt ist nichts. Von keinem Code gelesen. */
  traversal: z.string().describe('Werkzeug, dessen Werkzeugwege diese Region einführt (Traversal v2: kürzt ab, sperrt nichts)'),
  zielSpielzeit: z.number().describe('Stunden'),
  hausnutzung: z.array(Hausnutzung).optional(),
  strassenkulisse: z.array(Strassenkulisse).optional(),
  nahhoehen: Nahhoehen.optional(),
  /**
   * Flutlinie in m ü. NN (ADR-0017, Story-Bibel v2 §4, D375): Was darunter liegt, steht unter Wasser, solange der
   * Regent staut. **Nur Datum** — Darstellung und Verfallsregel hängen noch nicht daran. `validate` prüft, dass
   * kein Bewohner und keine Zuflucht darunter liegt.
   */
  flutlinie: z.number().optional(),
  /** Die Enklave der Region (D375): Name und Bezugspunkt, gegen den `validate` die Abstände der Reinkultur-Orte misst. */
  enklave: z.object({ name: z.string().max(40), ort: z.tuple([z.number(), z.number()]) }).strict().optional(),
  verborgeneOrte: z.array(VerborgenerOrt).optional(),
  /**
   * Übergänge an der Regionsgrenze (ADR-0014): Jede Region ist eine eigene Karte. Wer an der
   * genannten Kante steht, kann hinüber; die Karte der Nachbarregion wird dann geladen.
   * `validate` prüft, dass die Nachbarin existiert und den Weg zurück kennt.
   */
  nachbarn: z.array(z.object({
    region: z.string(),
    seite: z.enum(['nord', 'sued', 'ost', 'west']),
  })).default([]),
});
export type Region = z.infer<typeof Region>;

// --------------------------------------------------------------- Biom-Moves

export const BiomMove = z.object({
  osmTag: z.string(),
  move: z.string(),
  /** Feste Schwelle statt Zufall — Nachvollziehbarkeit geht vor. */
  kaempfeNoetig: z.number().int().default(8),
});

export const SCHEMA_VERSION = 1;

// --------------------------------------------------------------- Waffen (Echtzeitkampf)

/**
 * Das Waffenwerk (ADR-0008) als Daten statt als Konstante im Code. Ein Schlag trägt seine drei
 * Phasen (Vorlauf, Aktiv, Erholung), den Bogen und die Wirkung; `src/kampf/echtzeit.ts` liest die
 * Dateien aus `content/waffen/` und rechnet Grad in Radiant und Bilder in Clipsekunden um.
 */
export const KampfLinie = z.enum(['oben', 'unten', 'links', 'rechts']);

/**
 * Kern eines Schlags — gemeinsam für Waffen und Gegner (D194). Die Waffe verlangt zusätzlich Name,
 * Linie, Clip und Hieb; ein Gegner trägt sie nur, wo er sie braucht.
 */
const SchlagKern = z.object({
  name: z.string().optional(),
  linie: KampfLinie.optional(),
  vorlauf: z.number().positive().describe('Sekunden'),
  aktiv: z.number().positive().describe('Sekunden'),
  erholung: z.number().positive().describe('Sekunden'),
  reichweite: z.number().positive().max(6).describe('Meter, Mitte Angreifer bis Rand Ziel'),
  halbwinkelGrad: z.number().gt(0).max(180).describe('halber Öffnungswinkel des Bogens'),
  schaden: z.number().nonnegative(),
  haltungsschaden: z.number().nonnegative(),
  kosten: z.number().nonnegative().describe('Ausdauer beim Ansetzen'),
  nachdrehen: z.number().nonnegative().describe('rad/s im Vorlauf'),
  clip: z.string().optional(),
  hieb: z.object({
    scheitel: z.number().int().nonnegative(),
    durchzug: z.number().int().positive(),
  }).refine(h => h.durchzug > h.scheitel, 'Durchzug muss nach dem Scheitel liegen')
    .describe('Bilder bei 24 fps im Clip').optional(),
  schritt: z.number().nonnegative().optional().describe('Vorschritt in Metern'),
  rueckstoss: z.number().nonnegative().optional(),
  standfest: z.boolean().optional(),
  wirft: z.number().positive().optional().describe('Sekunden betäubt'),
  durch: z.boolean().optional(),
});
export type SchlagDaten = z.infer<typeof SchlagKern>;

export const GegnerSchlag = SchlagKern.strict();

export const WaffenSchlag = SchlagKern.extend({
  name: z.string(),
  linie: KampfLinie,
  clip: z.string(),
  hieb: SchlagKern.shape.hieb.unwrap(),
  schritt: z.number().nonnegative().describe('Vorschritt in Metern'),
}).strict();
export type WaffenSchlag = z.infer<typeof WaffenSchlag>;

export const WaffenDaten = z.object({
  id: z.enum(['klinge', 'axt', 'speer']),
  name: z.string(),
  /** Kampfhaltung im Stand (Clip). */
  haltung: z.string(),
  /** Leichte Kette; der erste ist der Grundschlag. */
  leicht: z.array(WaffenSchlag).min(1),
  schwer: WaffenSchlag,
  lauf: WaffenSchlag,
}).strict();
export type WaffenDaten = z.infer<typeof WaffenDaten>;

/**
 * Reinigungswerte je Gegner (D389) — abgeleitet aus Angriffsmuster, Tempo und Gefährlichkeit, gemessen
 * mit `tools/reinigensim.ts` (Tabelle in `docs/design/BRACHLAND_Reinigen_v1.md` §6). Die Griffzahl
 * folgt aus beiden Werten: `ceil(dauer / halten)`; `npm run validate` hält sie im Band `griffe` aus
 * `content/reinigen.json`.
 */
export const GegnerReinigen = z.object({
  dauer: z.number().positive().describe('Sekunden Kanal bis gereinigt, über alle Griffe'),
  halten: z.number().positive().optional().describe('Sekunden, die ein Griff dieses Tier hält; ohne Angabe `halten` aus reinigen.json'),
  freiwillig: z.literal(true).optional().describe('Mensch, der den Befall gewählt hat (D385) — nur dann greift die Marke bei einem Menschen'),
}).strict();
export type GegnerReinigen = z.infer<typeof GegnerReinigen>;

/**
 * Gegner des Echtzeitkampfs (D194) — Tiere und Menschen, `content/gegner/`. Ohne Rolle: Gegner
 * weichen nicht aus, `echtzeit.ts` setzt eine leere. Elemente nur bei Tieren; `npm run validate`
 * prüft sie gegen die Kreatur gleichen Elements nicht, das tut `tests/echtzeit.test.ts` (D189).
 */
export const GegnerDaten = z.object({
  id: z.string(),
  elemente: z.array(Element).min(1).max(2).optional(),
  schlag: GegnerSchlag,
  kette: z.array(GegnerSchlag).optional(),
  tempo: z.number().positive().optional().describe('m/s; ohne Angabe GEGNER_KI.tempo'),
  linien: z.array(KampfLinie).min(1).optional(),
  lebenMax: z.number().positive(),
  haltungMax: z.number().positive(),
  haltungErholung: z.number().nonnegative(),
  haltungRuhe: z.number().nonnegative(),
  betaeubt: z.number().nonnegative(),
  radius: z.number().positive(),
  hoehe: z.number().positive(),
  halbLaenge: z.number().nonnegative().optional(),
  zucken: z.number().nonnegative().optional(),
  mensch: z.object({ linienFolge: z.array(KampfLinie).min(1), deckung: KampfLinie }).strict().optional(),
  /**
   * D389: Reinigungswerte dieses Gegners — nur, wer reinigbar ist. Tiere (mit `elemente`) sind es;
   * Menschen nicht (D385), ausser `freiwillig`: wer den Befall gewählt hat (Grüne Mönche im Endstadium).
   * Ohne den Block gilt die Grössenformel aus `content/reinigen.json` (Regenten, Testgegner).
   */
  reinigen: GegnerReinigen.optional(),
}).strict().refine(g => !(g.mensch && g.linien), 'Menschen schlagen nach linienFolge, nicht nach linien')
  .refine(g => !g.reinigen || (g.mensch ? g.reinigen.freiwillig === true : !!g.elemente?.length),
    'reinigen nur bei Tieren (mit elemente) oder freiwillig befallenen Menschen (D385)')
  .refine(g => !g.reinigen?.freiwillig || !!g.mensch, 'freiwillig befallen sind nur Menschen (D385)');
export type GegnerDaten = z.infer<typeof GegnerDaten>;

// --------------------------------------------------------------- Reinigen (Marke, D376)

/**
 * Reinigen als Kampfhandlung (Story-Bibel v2 §2, D374/D376): Die Marke bindet einen niedergerungenen
 * Befallenen und reinigt ihn, statt ihn zu töten. Werte in `content/reinigen.json`, Regeln in
 * `src/kampf/echtzeit.ts` (`setzeReinigenAn`, `schrittReinigen`), Herleitung und Messreihe in
 * `docs/design/BRACHLAND_Reinigen_v1.md`. Zeiten in Sekunden, Strecken in Metern.
 */
export const ReinigenDaten = z.object({
  reichweite: z.number().positive().max(4).describe('Meter, Mitte Spielerin bis Rand Ziel'),
  grunddauer: z.number().nonnegative().describe('Sekunden, die jede Reinigung mindestens kanalisiert'),
  lebenJeSekunde: z.number().positive().describe('so viel vom vollen Leben des Ziels arbeitet die Marke je Sekunde ab'),
  schwelle: z.number().gt(0).max(1).describe('Lebensanteil, über dem die Marke nicht greift (1 = keine Schwelle)'),
  wundAb: z.number().min(0).max(1).describe('Lebensanteil, ab dem das Ziel auch in der Erholung greifbar ist'),
  halten: z.number().nonnegative().describe('Sekunden, die die Marke ein gegriffenes Ziel am Boden hält (Betäubte zusätzlich den Rest ihrer Betäubung)'),
  loesen: z.number().nonnegative().describe('Sekunden vom Entschluss zu lösen bis die Spielerin frei ist'),
  nachhall: z.number().nonnegative().describe('Sekunden, die ein gehaltenes Ziel nach einem Abbruch höchstens noch benommen bleibt'),
  behaltBeiTreffer: z.number().min(0).max(1).describe('Anteil des Fortschritts, der einen Treffer übersteht'),
  verfallJeSekunde: z.number().nonnegative().describe('Fortschritt (0…1), der je Sekunde ohne Kanal verfällt'),
  verwundbar: z.number().min(1).max(3).describe('Schadensfaktor auf die kanalisierende Spielerin'),
  ausdauer: z.number().nonnegative().describe('Ausdauer beim Ansetzen'),
  ladung: z.number().nonnegative().describe('Markenladung je gelungener Reinigung'),
  verhaertet: z.object({
    dauerFaktor: z.number().min(1),
    ladung: z.number().nonnegative(),
  }).strict().describe('Verhärtete: nur mit Reinkultur, länger und teurer'),
  fassung: z.object({
    start: z.number().int().positive(),
    jeRegent: z.number().int().nonnegative(),
  }).strict().describe('Fassungsvermögen der Marke in Ladungen; füllt sich bei der Rast'),
  griffe: z.object({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
  }).strict().refine(g => g.max >= g.min, 'max unter min')
    .describe('D379/D389: Band der Griffzahl je Gegner (`ceil(dauer / halten)`); `npm run validate` prüft jeden Gegner dagegen'),
}).strict();
export type ReinigenDaten = z.infer<typeof ReinigenDaten>;
