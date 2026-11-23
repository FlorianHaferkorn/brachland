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
  // D400: Fortschritt der Spielfigur — Bruchstück für einen Dauersud (Leben, Ausdauer) und Einsicht (Techniken).
  'vital', 'erfahrung',
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
   * `gewichte` (D404/D405): wie schwer ein Eingriff wiegt. Ohne Angabe zählt beides voll (wie vor D405).
   */
  z.object({ art: z.literal('eingriffe'), anzahl: z.number().int().min(1).max(500),
    gewichte: z.object({ getoetet: z.number().min(0).max(2), gereinigt: z.number().min(0).max(2) }).optional() }),
  /**
   * D406/D416: Der Zähler **vertraut** nicht mehr — wahr, sobald der gewichtete Stand über `anzahl` liegt (nicht mehr
   * *geduldet*) **oder** weniger als `unberuehrtMindestens` der Reviere der Region unberührt sind. Beides wächst nur in
   * eine Richtung (Eingriffe kommen dazu, berührte Reviere werden nie wieder unberührt), also gilt die Regel oben.
   * Ohne Revierangabe im Weltstand zählt nur die erste Hälfte (wie `eingriffe`, aber mit „über“ statt „ab“: D406
   * sagt geduldet = ≤ 40).
   */
  z.object({ art: z.literal('misstraut'), anzahl: z.number().int().min(1).max(500),
    gewichte: z.object({ getoetet: z.number().min(0).max(2), gereinigt: z.number().min(0).max(2) }).optional(),
    unberuehrtMindestens: z.number().min(0).max(1) }),
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
  // ---- D393: Gegenstände, die nicht auf einen Kämpfer wirken (Gegenstände-und-Aufwertung v1) ----
  /** Aufwertungsmaterial der Schmiede, Stufe 1–4 (Vertrag `aufwertung-1..4`). */
  z.object({ art: z.literal('material'), stufe: z.number().int().min(1).max(4) }),
  /** Werkzeug der Fortbewegung (Traversal v2 §4, D391): hebt eine Grenze auf, sperrt nichts. */
  z.object({ art: z.literal('werkzeug'), faehigkeit: z.enum(['tauchen', 'klettern', 'gleiten', 'reiten']) }),
  /** Stärkt die Marke ausserhalb des Reinigens: so viel Läuterung beim Einsetzen an der Rast. */
  z.object({ art: z.literal('marke'), laeuterung: z.number().int().min(1).max(15) }),
  /** Zutat, die ein Bewohner verarbeitet: `flasche` (Schlucke/Stärke des Suds) oder `reinkultur`. */
  z.object({ art: z.literal('zutat'), fuer: z.enum(['flasche', 'reinkultur',
    // D400: `dauersud` = Bruchstück oder Bossteil eines dauerhaften Suds, `beigabe` = Kraut für die Flasche bis zur nächsten Rast.
    'dauersud', 'beigabe',
    // D410: Betriebsstoff eines Geräts (Gas, Kohlensäure, Batterie, Kalk).
    'geraet']) }),
  /** D400: Einsicht — Erfahrung aus Aufträgen, Linien und Orten, nie aus Kämpfen. Wird für Techniken ausgegeben. */
  z.object({ art: z.literal('erfahrung'), punkte: z.number().int().min(1).max(3) }),
  /** Kleidung, **ein** Platz. Seitwärts statt aufwärts: jedes Stück hat einen Preis. Werte sind Entwurf. */
  z.object({ art: z.literal('zeug'), werte: z.record(z.string(), z.number()) }),
  /** Fundwaffe: schaltet eine Waffe aus `content/waffen/` frei, ändert keinen Kampfwert. */
  z.object({ art: z.literal('waffe'), waffe: z.enum(['klinge', 'axt', 'speer']) }),
  /** Wissen mit Nutzen: Rezept, Karte, Schrift. `schaltet` nennt, was es öffnet (Tausch, Anzeige). */
  z.object({ art: z.literal('wissen'), form: z.enum(['rezept', 'karte', 'schrift']), schaltet: z.string().max(60) }),
  /** Schlüsselgegenstand: öffnet einen Ort oder eine Art von Verschluss. */
  z.object({ art: z.literal('zugang'), oeffnet: z.string().max(60) }),
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
  /** D393: Es gibt ihn je Spielstand genau einmal (Werkzeug, Zeug, Wissen, Zugang, Fundwaffe). */
  einmalig: z.boolean().default(false),
  /** D393: Bleibt beim Tod als Bündel am Ort liegen (`spiel/oekonomie.ts` `todesverlust`). */
  liegtBeiTod: z.boolean().default(false),
  /** D393: Höchstens so viele im Beutel; ohne Angabe unbegrenzt. */
  traglast: z.number().int().min(1).max(99).optional(),
  /** D398: Gewicht eines Stücks in Kilogramm — Herleitung in Gegenstände-und-Aufwertung v1 §11. */
  gewicht: z.number().min(0).max(30).optional(),
}).refine(g => !(g.einmalig && g.liegtBeiTod), 'Einmaliges geht beim Tod nicht verloren')
  .refine(g => !['werkzeug', 'zeug', 'waffe', 'wissen', 'zugang'].includes(g.wirkung.art) || g.einmalig,
    'Werkzeug, Zeug, Fundwaffe, Wissen und Zugang sind einmalig')
  .refine(g => ['heilung', 'wiederbelebung', 'reinigung', 'fanghilfe', 'fokus'].includes(g.wirkung.art) || !g.imKampf,
    'nur Verbrauchsgüter sind im Kampf benutzbar');
export type Gegenstand = z.infer<typeof Gegenstand>;

// ------------------------------------------------- Belohnungen und Ökonomie (D393)

/**
 * Vertrag mit den Aufträgen (D392): Story und Quests vergeben Belohnungen als **Kategorie**,
 * `content/belohnungen.json` löst sie in Gegenstand und Menge auf (`spiel/belohnung.ts`).
 */
// Eine Liste, zwei Namen: der Auftrag (`lohn`, D392) und die Auflösung (D393) teilen sich LOHNKATEGORIEN.
export const BELOHNUNGS_KATEGORIEN = LOHNKATEGORIEN;
export type BelohnungsKategorie = Lohnkategorie;

/** Die Sprossen der Belohnungsleiter, klein nach gross. */
export const BELOHNUNGS_RAENGE = ['entdeckung', 'verborgener-ort', 'nebenaufgabe', 'figurenlinie',
  'optionaler-boss', 'regent'] as const;
export type BelohnungsRang = typeof BELOHNUNGS_RAENGE[number];

const Kennung = z.string().regex(/^[a-z0-9-]+$/);
const MengeJeRang = z.record(z.enum(BELOHNUNGS_RAENGE), z.number().int().min(0).max(12));

export const Belohnungen = z.object({
  /** Mengenware: ein Gegenstand, die Menge hängt an der Sprosse (0 = auf dieser Sprosse nicht vergeben). */
  mengen: z.record(z.enum(BELOHNUNGS_KATEGORIEN), z.array(z.object({
    gegenstand: Kennung,
    menge: MengeJeRang,
  })).min(1)),
  /** Unikate: je Region ein Vorrat, aus dem jedes Stück höchstens einmal vergeben wird. */
  unikate: z.record(z.enum(BELOHNUNGS_KATEGORIEN), z.record(Kennung, z.array(Kennung).min(1))),
  /** Was eine Sprosse bringt — Lesetabelle für Menschen und Prüfgrundlage für `validate`. */
  leiter: z.array(z.object({
    rang: z.enum(BELOHNUNGS_RAENGE),
    was: z.string().max(120),
    wiederholbar: z.boolean(),
    /** Mindestens ein Unikat? Dann gibt es dort nie nur Mengenware. */
    unikat: z.boolean(),
    kategorien: z.array(z.enum(BELOHNUNGS_KATEGORIEN)).min(1),
    regel: z.string().max(260),
  })).length(BELOHNUNGS_RAENGE.length),
}).refine(b => BELOHNUNGS_KATEGORIEN.every(k => (k in b.mengen) !== (k in b.unikate)),
  'jede Kategorie steht genau einmal: unter `mengen` oder unter `unikate`');
export type Belohnungen = z.infer<typeof Belohnungen>;

const Preis = z.record(Kennung, z.number().int().min(1).max(40));

/**
 * Die Aufwertungs-Ökonomie als Daten (D393, `docs/design/BRACHLAND_Gegenstaende-und-Aufwertung_v1.md`).
 * **Entwurf:** Das Spiel liest sie noch nicht; die Schmiede rechnet weiter nach D177
 * (`spiel/schmiede.ts`). `tools/oekonomiesim.ts` rechnet die Überschlagsrechnung daraus.
 */
export const Oekonomie = z.object({
  /** Achse Stahl: Kosten je Waffenstufe. Wirkung je Stufe bleibt `schmiede.ts` (`JE_STUFE`). */
  schmiede: z.array(z.object({ stufe: z.number().int().min(1).max(4), preis: Preis, vorschlag: z.boolean().default(false) })).min(3),
  /** Was ein Getöteter hinterlässt (D379: Material nur von Getöteten). */
  beute: z.object({
    tier: z.object({ gegenstand: Kennung, chance: z.number().min(0).max(1) }),
    mensch: z.object({ gegenstand: Kennung, menge: z.number().int().min(0).max(3) }),
    verhaerteter: z.object({ gegenstand: Kennung, menge: z.number().int().min(1).max(3) }),
    regent: z.object({ gegenstand: Kennung, menge: z.number().int().min(1).max(3) }),
  }),
  /** Achse Marke: Läuterung je Gereinigtem und die Stufen (Reinigen v1 §4, A5). */
  marke: z.object({
    laeuterung: z.object({ tier: z.number().int().min(1), verhaerteter: z.number().int().min(1), regent: z.number().int().min(1) }),
    schwellen: z.array(z.number().int().positive()).min(1).max(6)
      .refine(a => a.every((x, i) => i === 0 || x > a[i - 1]), 'Schwellen steigen'),
    fassungJeStufe: z.number().int().min(1).max(2),
    /** Ein Revier gilt als ruhig, wenn dieser Anteil der Eingriffe Reinigungen sind (A6) … */
    ruhigAb: z.number().gt(0).max(1),
    /** … und mindestens dieser Anteil der Tiere des Reviers gereinigt ist (D393: sonst unerreichbar oder geschenkt). */
    ruhigMindestens: z.number().gt(0).max(1),
    /** Rast im ruhigen Revier (ohne Zuflucht): füllt diesen Anteil der Fassung. */
    ruhigeRast: z.number().gt(0).max(1),
    /** Was ein ruhiges Revier einmalig hergibt. */
    ruhigesRevier: Preis,
  }),
  /** Die Sudflasche: füllt sich an der Rast, wächst über Zutaten. */
  flasche: z.object({
    schlucke: z.object({ start: z.number().int().min(1), max: z.number().int().min(1), preis: Preis }),
    staerke: z.object({ start: z.number().gt(0).max(1), jeStufe: z.number().gt(0).max(0.3), stufen: z.number().int().min(1).max(4), preis: Preis }),
  }).refine(f => f.schlucke.max >= f.schlucke.start, 'max ≥ start'),
  /** Rezepte und Tausch in der Enklave: wer macht was woraus. */
  tausch: z.array(z.object({
    bei: Kennung.describe('Ort-ID eines Bewohners'),
    gibt: Preis, nimmt: Preis,
    /** Wissensgegenstand, der den Tausch erst öffnet. */
    braucht: Kennung.optional(),
    jeRast: z.boolean().default(false).describe('höchstens einmal je Rast in der Enklave'),
  })),
  /**
   * D400 — Brauen: dauerhafte Sude heben einen Vitalwert, Beigaben färben die Flasche bis zur nächsten Rast.
   * Alle Wirkwerte sind Entwurf und berühren Kampfwerte; sie gelten erst nach Messung (Kampfbot).
   */
  brauen: z.object({
    /** Was ein Boss hinterlässt — je nach Ausgang ein anderes Stück. */
    bossteil: z.object({ getoetet: Kennung, gereinigt: Kennung }),
    dauersude: z.array(z.object({
      id: Kennung, name: z.string().max(40),
      wert: z.enum(['leben', 'ausdauer']),
      plus: z.number().int().min(1).max(20),
      /** Höchstens so viele im ganzen Spiel. */
      hoechstens: z.number().int().min(1).max(20),
      preis: Preis,
      /** Welche Bossteile taugen. */
      bossteile: z.array(Kennung).min(1),
    })).min(1),
    beigaben: z.array(z.object({
      gegenstand: Kennung,
      wirkung: z.string().max(120),
      werte: z.record(z.string(), z.number()),
      dauerSek: z.number().int().min(10).max(900),
    })),
    /** Plätze für Beigaben in der Flasche (eine Technik kann einen zweiten öffnen). */
    beigabePlaetze: z.number().int().min(1).max(2),
  }),
  /** D400 — Erfahrung: Einsicht aus Figurenlinien; alles andere über die Belohnungsleiter. */
  erfahrung: z.object({ jeLinie: z.number().int().min(1).max(4), linien: z.number().int().min(1).max(5) }),
  /** D400 — Folgen des Tötens, die über die Beute hinausgehen. */
  toeten: z.object({
    /** Ab diesem Anteil getöteter Tiere gilt ein Revier als leer. */
    leerAb: z.number().gt(0).max(1),
    /** Verhärtung: so viele neue Verhärtete je leergetötetem Revier wandern nach (Vorschlag). */
    verhaertungJeLeeremRevier: z.number().min(0).max(1),
  }),
  /**
   * D416 — Regeln, die an den Revieren hängen (`src/spiel/reviere.ts`). Die Schwellen für ruhig/leer stehen weiter
   * in `marke` und `toeten`; hier nur, was die Reviere zusätzlich brauchen.
   */
  reviere: z.object({
    /**
     * Wogegen „≥ `ruhigMindestens` der Tiere des Reviers“ und „leer ab `leerAb`“ gemessen werden: `bestand` = die
     * erwarteten Tiere des Reviers aus dem Vorkommen (`content/reviere/`), `begegnet` = die Tiere, denen man dort
     * begegnet ist (getötet + gereinigt + umgangen; so rechnete D393). Arbeitswert, Frage an Flo (A-38).
     */
    bezug: z.enum(['bestand', 'begegnet']),
    /**
     * Bei `begegnet`: Der Nenner ist mindestens dieser Anteil des Bestands. Ohne Boden machte ein einziger Griff ein
     * Revier ruhig und ein einziger Tod es leer (D393 hat genau das verworfen) — mit 0,25 braucht ein Revier mit 93
     * Tieren 6 Reinigungen für ruhig und 14 Getötete für leer.
     */
    mindestBestand: z.number().min(0).max(1).default(0),
    /** D393/D399: Nachwachsen aus Nachbarrevieren, solange die Region nicht geheilt ist. Nie im selben Revier. */
    nachwachsen: z.object({
      /** So viele Rasten, nachdem im Revier getötet wurde, bis die ersten Tiere aus der Nachbarschaft kommen. */
      abRasten: z.number().int().min(1).max(20),
      /** Höchstens dieser Anteil der Getöteten kommt wieder („bis zur Hälfte“) — und nie mehr als dieser Anteil des Bestands. */
      anteil: z.number().gt(0).max(1),
      /** So viele Tiere je Rast und Revier, wenn eines nachwachsen darf. */
      jeRast: z.number().int().min(1).max(20),
    }),
  }).optional(),
  /** D403 — Baukasten: was ein Umbau (anderer Kopf und anderer Schaft) im Mittel kostet. Vorschlag. */
  baukasten: z.object({ umbau: Preis }).optional(),
  /** Überschlagsrechnung je Region: Umfang (Annahmen) und was einmalig in der Welt liegt. */
  regionen: z.record(Kennung, z.object({
    annahmen: z.object({
      begegnungen: z.number().int().positive(), tiere: z.number().int().positive(),
      rasten: z.number().int().positive(), verhaertete: z.number().int().nonnegative(),
      menschen: z.number().int().nonnegative(), reviere: z.number().int().positive(),
    }),
    einmalig: Preis,
  })),
});
export type Oekonomie = z.infer<typeof Oekonomie>;

// ------------------------------------------------------- Reviere (D416)

/**
 * Ein Revier (D416): ein Stück Region, an dem ruhig/leer, das Aufladen der Marke an der Rast, die Stufe „vertraut“ des
 * Zählers, die Verhärtung und das Nachwachsen hängen. Die Fläche steht als Zellen im Revierraster der Karte
 * (`Revierkarte.raster`, ein Zeichen je Zelle). Erzeugt von `tools/reviere.ts`: Kerne von Hand, Grenzen gerechnet
 * (Weg mit Steigung nach Naismith, Wasser unter der Flutlinie langsamer). `tiere`, `flaecheKm2`, `hoehe`, `unterFlut`,
 * `zufluchten`, `verborgeneOrte`, `nachbarn` sind abgeleitet und werden von `validate` gegen das Raster geprüft.
 */
export const Revier = z.object({
  id: Kennung.describe('regionsweit eindeutig, mit Regionsvorsilbe (ADR-0020: Nachbarschaft darf über die Regionsgrenze gehen)'),
  zeichen: z.string().regex(/^[A-Za-z]$/).describe('Zeichen im Revierraster'),
  name: z.string().min(1).max(40),
  kern: z.tuple([z.number(), z.number()]).describe('Kern der Rechnung, Meter der Region (x Ost, z Süd)'),
  begruendung: z.string().min(1).max(400).describe('warum hier ein Revier: Tal, Hangstufe, Weg, Flutlinie'),
  zufluchten: z.array(Kennung).describe('Zufluchten (Orte mit `art: zuflucht`) in der Fläche'),
  verborgeneOrte: z.array(Kennung),
  flaecheKm2: z.number().positive(),
  unterFlut: z.number().min(0).max(1).describe('Anteil der Fläche unter der Flutlinie'),
  hoehe: z.tuple([z.number(), z.number()]).describe('kleinste und grösste Zellhöhe, m ü. NN'),
  tiere: z.record(Kennung, z.number().int().min(0)).describe('erwartete Tiere je Kreatur aus `verteileKreaturen` (Seed 7)'),
  nachbarn: z.array(Kennung).min(1).describe('Reviere mit gemeinsamer Kante; später auch über die Regionsgrenze (ADR-0020)'),
}).strict();
export type Revier = z.infer<typeof Revier>;

export const Revierkarte = z.object({
  region: Kennung,
  erzeugt: z.string().min(1),
  raster: z.object({
    spalten: z.number().int().min(4).max(256),
    zeilen: z.number().int().min(4).max(256),
    /** Auflösung des Weltrasters, in dessen Zellen die Vorkommen-IDs (`kreatur:i:j`) stehen. */
    vorkommenRaster: z.number().int().min(2),
    /** Zeile für Zeile von Nord nach Süd, Zeichen von West nach Ost. */
    karte: z.array(z.string()),
  }).strict(),
  reviere: z.array(Revier).min(1),
}).strict().superRefine((k, ctx) => {
  if (k.raster.karte.length !== k.raster.zeilen) ctx.addIssue({ code: 'custom', path: ['raster', 'karte'], message: `${k.raster.karte.length} Zeilen statt ${k.raster.zeilen}` });
  k.raster.karte.forEach((z, i) => { if (z.length !== k.raster.spalten) ctx.addIssue({ code: 'custom', path: ['raster', 'karte', i], message: `${z.length} Zeichen statt ${k.raster.spalten}` }); });
  const zeichen = new Set<string>(), ids = new Set<string>();
  k.reviere.forEach((r, i) => {
    if (zeichen.has(r.zeichen)) ctx.addIssue({ code: 'custom', path: ['reviere', i, 'zeichen'], message: `Zeichen '${r.zeichen}' doppelt` });
    if (ids.has(r.id)) ctx.addIssue({ code: 'custom', path: ['reviere', i, 'id'], message: `Revier '${r.id}' doppelt` });
    zeichen.add(r.zeichen); ids.add(r.id);
  });
});
export type Revierkarte = z.infer<typeof Revierkarte>;

// ------------------------------------------------------- Waffen-Baukasten (D403, Entwurf)

/**
 * Ein Teil des Baukastens. Masse und Abmessung sind echte Grössen (kg, m) — daraus rechnet
 * `src/kampf/baukasten.ts` Trägheit, Schlagzeit, Wucht. `kraft`, `wendig`, `schneide`, `wucht` sind
 * **nicht** abgeleitet, sondern gesetzt (Zweihandgriff, Gegengewicht, Schneidenform); jedes Teil, das
 * einen davon ändert, sagt in `text`, warum.
 */
export const Waffenteil = z.object({
  id: Kennung,
  name: z.string().max(40),
  masse: z.number().positive().max(5).describe('Kilogramm'),
  laenge: z.number().positive().max(3).describe('Meter; Kopf: von der Schaftspitze bis zur Spitze/Schneide'),
  schwerpunkt: z.number().min(-0.2).max(1).default(0).describe('nur Kopf: Schwerpunkt vor der Schaftspitze, Meter'),
  kraft: z.number().min(0.8).max(1.3).default(1),
  wendig: z.number().min(0.8).max(1.3).default(1),
  schneide: z.number().min(0.7).max(1.3).default(1),
  wucht: z.number().min(0.7).max(1.3).default(1),
  /**
   * D407: Ausgleichsfaktor auf Schaden und Haltungsschaden — **Spielausgleich, keine Physik** (D404: Bestformen auf
   * ±5 % der Referenz-Kampfdauer). Gerechnet wie Schneide: Kopf × Schaft gegen die Referenzteile, die 1 tragen.
   */
  ausgleich: z.number().min(0.7).max(1.4).default(1),
  /** Was das Teil kostet (Gegenstand → Anzahl). */
  preis: z.record(Kennung, z.number().int().min(1).max(40)),
  /** Woher Masse und Länge stammen — Quelle oder „Überschlag“. */
  anker: z.string().max(280),
  text: z.string().max(200),
  /** Braucht eine eigene Pose oder einen eigenen Clip (z. B. zweite Hand am Griff). */
  brauchtPose: z.boolean().default(false),
}).strict();
export type Waffenteil = z.infer<typeof Waffenteil>;

const Waffenfamilie = z.object({
  bewegung: z.enum(['schwung', 'stoss']),
  /** Anteil des Schafts vor der Griffhand (Klinge 0: der Griff *ist* die Hand; Axt 0,85; Speer 0,67). */
  vorHand: z.number().min(0).max(1),
  kopf: z.array(Waffenteil).min(2).max(5),
  schaft: z.array(Waffenteil).min(2).max(4),
  /** Der Bau, der die heutige Waffe ergibt. */
  referenz: z.object({ kopf: Kennung, schaft: Kennung }),
}).refine(f => f.kopf.some(t => t.id === f.referenz.kopf) && f.schaft.some(t => t.id === f.referenz.schaft), 'Referenzteile gibt es')
  // D407: Der Ausgleich ist gegen die Referenz gerechnet — die Referenzteile tragen keinen, sonst wäre die heutige Waffe verschoben.
  .refine(f => f.kopf.every(t => t.id !== f.referenz.kopf || t.ausgleich === 1) && f.schaft.every(t => t.id !== f.referenz.schaft || t.ausgleich === 1),
    'Referenzteile tragen den Ausgleich 1');

export const Waffenbaukasten = z.object({
  physik: z.object({
    armTraegheit: z.number().positive().describe('kg·m², Arm um die Schulter'),
    armMasse: z.number().positive().describe('kg, was beim Stoss mitbewegt wird'),
    anteilEnergie: z.number().min(0).max(1).describe('Anteil der Schlagenergie an den Ausdauerkosten; der Rest ist Tragen'),
  }),
  familien: z.object({ klinge: Waffenfamilie, axt: Waffenfamilie, speer: Waffenfamilie }),
  /** Materialgüte: ersetzt die Waffenstufen (D177/D393). `guete` = Faktor auf Schaden und Haltungsschaden. */
  material: z.array(z.object({
    id: Kennung, name: z.string().max(40), stufe: z.number().int().min(0).max(4),
    guete: z.number().min(1).max(1.6), preis: z.record(Kennung, z.number().int().min(1).max(40)), text: z.string().max(200),
  })).min(2).refine(a => a.filter(m => m.guete === 1).length === 1, 'genau ein Material der Güte 1 (der heutige Stahl)'),
  /** Härtung: verschiebt zwischen Schneide und Wucht, ohne Summe zu heben. */
  haertung: z.array(z.object({
    id: Kennung, name: z.string().max(40), schneide: z.number().min(0.9).max(1.1), wucht: z.number().min(0.9).max(1.1), text: z.string().max(200),
  })).min(1).refine(a => a.filter(h => h.schneide === 1 && h.wucht === 1).length === 1, 'genau eine neutrale Härtung'),
  /** Zeug nach demselben Aufbau: Grundstück × Material × Futter. Nur Entwurf, keine Ableitung. */
  zeug: z.object({
    grundstuecke: z.array(z.object({ id: Kennung, gegenstand: Kennung, masse: z.number().positive().max(10), vorteil: z.string().max(120), nachteil: z.string().max(120) })).min(1),
    materialien: z.array(z.object({ id: Kennung, name: z.string().max(40), masseFaktor: z.number().min(0.5).max(2), vorteil: z.string().max(120), nachteil: z.string().max(120) })).min(1),
    futter: z.array(z.object({ id: Kennung, name: z.string().max(40), masse: z.number().min(0).max(3), vorteil: z.string().max(120), nachteil: z.string().max(120) })).min(1),
  }),
  /** Stufe 1, Gestalten: rein kosmetisch, ändert keinen Wert. */
  gestalten: z.array(z.object({ id: Kennung, name: z.string().max(40), ort: z.enum(['griff', 'schaft', 'kopf', 'zeug']), preis: z.record(Kennung, z.number().int().min(1).max(9)).optional(), text: z.string().max(160) })).min(1),
}).strict();
export type Waffenbaukasten = z.infer<typeof Waffenbaukasten>;

// ------------------------------------------------------- Waffenfamilien und Wirken (D405, Entwurf)

/**
 * Plan der Waffenfamilien (D404/D405): was es gibt, was kommen soll, und was dafür fehlt. **Keine Kampfwerte**
 * — die stehen für den Bestand in `content/waffen/`, für neue Familien gibt es sie erst nach der Messung.
 */
export const Waffenfamilienplan = z.object({
  familien: z.array(z.object({
    id: Kennung, name: z.string().max(40),
    status: z.enum(['bestand', 'entwurf', 'zurueckgestellt']),
    kapitel: z.number().int().min(1).max(5).optional(),
    art: z.enum(['nah', 'fern']),
    gefuehl: z.string().max(160),
    trennt: z.string().max(260),
    reinigen: z.string().max(200),
    /** Echtes Gewicht und Länge als Anker (D398) — mit Quelle oder „Überschlag“. */
    anker: z.object({ masse: z.string().max(40), laenge: z.string().max(40), quelle: z.string().max(260) }),
    /** Abweichung von der realen Vorlage, falls das Werkzeug real eine schlechte Waffe ist. */
    abweichung: z.string().max(260).optional(),
    clips: z.object({ vorhanden: z.array(z.string()), fehlen: z.array(z.string()) }),
    messung: z.string().max(200),
    erwerb: z.string().max(200),
    aufwand: z.enum(['S', 'M', 'L']),
    /** Baukasten-Familie, deren Formel und Teile sie teilt (`content/waffenteile.json`), falls es eine gibt. */
    baukasten: z.enum(['klinge', 'axt', 'speer']).optional(),
  }).strict()).min(3),
  /** Fernkampf als Entwurf: alle Zahlen ungeprüft, real verankert, Abweichung benannt (ADR-0019 Proposed). */
  fernkampf: z.object({
    waffen: z.array(z.object({
      id: Kennung, name: z.string().max(40),
      spannen: z.number().positive().describe('Sekunden bis schussbereit'),
      spannenReal: z.string().max(120),
      haltenJeSek: z.number().nonnegative().describe('Ausdauer je Sekunde im gespannten Zustand'),
      kosten: z.number().nonnegative().describe('Ausdauer je Schuss'),
      tempo: z.number().positive().describe('m/s Abgang'),
      schaden: z.number().positive(), haltungsschaden: z.number().nonnegative(),
      inBewegung: z.boolean(),
    }).strict()).min(1),
    geschosse: z.array(z.object({
      id: Kennung, name: z.string().max(40), fuer: z.array(Kennung).min(1),
      masse: z.number().positive().describe('Gramm'),
      schaden: z.number().min(0).max(2).describe('Faktor auf den Schaden der Waffe'),
      haltung: z.number().min(0).max(3).describe('Faktor auf den Haltungsschaden der Waffe'),
      traglast: z.number().int().min(1).max(40),
      wiederfinden: z.number().min(0).max(1),
      preis: z.record(Kennung, z.number().int().min(1).max(9)), ergibt: z.number().int().min(1).max(12),
      text: z.string().max(200),
    }).strict()).min(1),
    regeln: z.array(z.string().max(260)).min(3),
  }),
}).strict();
export type Waffenfamilienplan = z.infer<typeof Waffenfamilienplan>;

// ------------------------------------------------------- Gewicht spürbar machen (D420, nur Darstellung)

/**
 * D420: Kennzahlen, mit denen `src/kampf/gewicht.ts` aus Masse, Trägheit und Treffer-Impuls einer Waffe die
 * **Darstellung** ableitet — Trefferstopp, Kameraimpuls, Reaktion des Getroffenen, Ton, Nachschwung im Clip.
 * **Kein Kampfwert:** Fenster, Schaden, Haltungsschaden, Kosten, Rückstoss der Regel bleiben in
 * `content/waffen/` (D419). Jeder Block nennt `real` (mit „nicht belegt“, wo die Quelle fehlt), `warum` und
 * `quelle` (D398). Zeiten in Sekunden, Strecken in Metern, Massen in kg, Impulse in N·s.
 */
const GewichtBenannt = {
  real: z.string().min(1),
  warum: z.string().min(1),
  quelle: z.string().min(1),
};
const GewichtWaffe = z.union([
  /** Familie des Baukastens: Masse und Trägheit aus ihrem Referenzbau (`content/waffenteile.json`). */
  z.object({ baukasten: z.enum(['klinge', 'axt', 'speer']), zweihand: z.boolean() }).strict(),
  /** Ohne Baukastenteile: Werte aus dem Modell (`tools/waffenmodelle.py`, D414). */
  z.object({
    masse: z.number().positive().max(10),
    traegheit: z.number().positive().max(5).describe('kg·m² um die Griffhand'),
    kopfAbstand: z.number().positive().max(2).describe('Schwerpunkt des Blatts vor der Hand, m — Hebel des Impulses'),
    spitze: z.number().positive().max(3).describe('Spitze vor der Hand, m'),
    bewegung: z.enum(['schwung', 'stoss']),
    zweihand: z.boolean(),
    quelle: z.string().min(1),
  }).strict(),
]);
export const Gewicht = z.object({
  stand: z.string(),
  /** Wie der Arm die Waffe beschleunigt — die Baukasten-Formel (§3.2) in absoluten Einheiten. */
  physik: z.object({
    leistung: z.number().positive().max(3000).describe('W, einhändig'),
    zweihand: z.number().min(1).max(2).describe('Faktor auf die Leistung mit zwei Händen'),
    bogenGrad: z.number().positive().max(360).describe('Schwungwinkel bis zum Treffer'),
    stossWeg: z.number().positive().max(2).describe('m, Weg der Hände im Stoss'),
    bremsmoment: z.number().positive().max(500).describe('N·m, mit dem eine Hand die Waffe nach dem Treffer abfängt'),
    unterarm: z.number().positive().max(1).describe('m, Hebel, über den das Bremsmoment einen Stoss als Kraft abfängt'),
    ...GewichtBenannt,
  }).strict(),
  /** Je Waffenfamilie (`content/waffenfamilien.json`) der Körper der Waffe. */
  waffen: z.record(Kennung, GewichtWaffe),
  /** Masse der Getroffenen in kg (für die Reaktion: Δv = Impuls / Masse); `standard` für alles Ungenannte. */
  ziele: z.object({ standard: z.number().positive().max(2000), je: z.record(Kennung, z.number().positive().max(2000)), ...GewichtBenannt }).strict(),
  trefferstopp: z.object({
    min: z.number().min(0).max(0.2), max: z.number().min(0).max(0.2),
    impulsVon: z.number().nonnegative(), impulsBis: z.number().positive(),
    gebrochen: z.number().min(0).max(0.1).describe('s dazu, wenn die Haltung bricht'),
    toedlich: z.number().min(0).max(0.1).describe('s dazu beim tödlichen Treffer'),
    geblockt: z.number().min(0).max(1).describe('Faktor, wenn ein Block den Schlag fängt'),
    ...GewichtBenannt,
  }).strict().refine(t => t.min <= t.max, 'trefferstopp.min über max').refine(t => t.impulsVon < t.impulsBis, 'impulsVon nicht unter impulsBis'),
  kamera: z.object({
    gesetzt: z.object({ grund: z.number().nonnegative().max(0.2), jeImpuls: z.number().nonnegative().max(0.05), max: z.number().positive().max(0.3) }).strict(),
    erlitten: z.object({ grund: z.number().nonnegative().max(0.2), jeSchaden: z.number().nonnegative().max(0.05), max: z.number().positive().max(0.3) }).strict(),
    abklingen: z.object({ grund: z.number().positive().max(0.5), jeImpuls: z.number().nonnegative().max(0.05), max: z.number().positive().max(1) }).strict(),
    /** Anteil des Ausschlags in Schlagrichtung; der Rest ist Zittern wie bisher (D171). */
    richtung: z.number().min(0).max(1),
    ...GewichtBenannt,
  }).strict(),
  reaktion: z.object({
    neigungJeMps: z.number().nonnegative().max(200), neigungMax: z.number().nonnegative().max(60),
    versatzMax: z.number().nonnegative().max(0.5), dauer: z.number().positive().max(1),
    taumelGrund: z.number().nonnegative().max(45), taumelJeMps: z.number().nonnegative().max(200), taumelMax: z.number().nonnegative().max(60),
    ...GewichtBenannt,
  }).strict(),
  ton: z.object({
    referenz: Kennung.describe('Waffe mit Tonhöhe 1 und Pegel aus dem Grundwert'),
    schwungGrund: z.number().min(0).max(1), schwungJeMps: z.number().min(0).max(0.2),
    trefferGrund: z.number().min(0).max(1), trefferJeOktave: z.number().min(0).max(0.5),
    ...GewichtBenannt,
  }).strict(),
  /** Nachschwung und Erholung im Clip (Prüfung `tests/waffenclips.test.ts`): wie lange der Körper der Masse folgt. */
  clips: z.object({
    haltGrund: z.number().min(0).max(1), haltJeKg: z.number().min(0).max(1), haltMax: z.number().min(0).max(1),
    ...GewichtBenannt,
  }).strict(),
}).strict();
export type Gewicht = z.infer<typeof Gewicht>;

// ------------------------------------------------------- Clipmarken (D456, nur Darstellung)

/**
 * D456: Marken in den Clips der Spielfigur für Übergänge und Ketten (`content/clipmarken.json`) — gelesen von der
 * Laufzeit (D457) und von `tests/clipguete.test.ts`. **Kein Kampfwert:** Scheitel und Durchzug stehen hier nur noch
 * einmal neben `hieb` in `content/waffen/` (der Test hält beide gleich). Alle Zahlen sind **Bildnummern** bei
 * `bildrate` Bildern je Sekunde, gezählt wie die Schlüsselbilder in `tools/waffenclips.py` (Bild 1 = erstes Bild,
 * Clipzeit = Bild / `bildrate`).
 */
const Clipname = z.string().regex(/^[A-Z][A-Za-z0-9]*(_[A-Za-z0-9]+)+$/);
const Bild = z.number().int().min(1).max(400);
export const Clipmarke = z.object({
  /** Schlüssel aus `hut`, oder `koerper` für Clips ohne Waffenbezug. */
  waffe: z.string().regex(/^[a-z0-9-]+$/),
  art: z.enum(['hut', 'hieb', 'stoss', 'block', 'geraet', 'koerper']),
  /** `hut`: Bild 1 ist genau die Hut (Pose und Fusslage). `anlauf`: beginnt in einer Anlaufpose. `frei`: eigener Anfang. */
  beginn: z.enum(['hut', 'anlauf', 'frei']),
  /** `hut`: letztes Bild ist die Hut. `gehalten`: letztes Bild wird gehalten. `schleife`: Schleife. `liegt`: endet am Boden. */
  ende: z.enum(['hut', 'gehalten', 'schleife', 'liegt']),
  /** Letztes Bild des Clips. */
  bilder: Bild,
  /** Bild im Ausholen, ab dem ein geketteter Schlag beginnen darf (aus der Kettenpose des vorigen, ohne Hut). */
  einstieg: Bild.optional(),
  scheitel: Bild.optional(),
  durchzug: Bild.optional(),
  /** Kettenpose: erstes Schlüsselbild nach dem Durchzug — frühester Absprung in den nächsten Schlag. */
  kette: Bild.optional(),
  /** Letztes Schlüsselbild vor der Rückkehr in die Hut — bis hierher folgt der Körper der Masse. */
  halt: Bild.optional(),
  /** Welcher Fuss in der Kettenpose vorn steht. */
  vorn: z.enum(['links', 'rechts', 'gleich']).optional(),
}).strict().superRefine((m, ctx) => {
  const schlag = m.art === 'hieb' || m.art === 'stoss';
  for (const f of ['einstieg', 'scheitel', 'durchzug', 'kette', 'halt', 'vorn'] as const) {
    if (schlag && m[f] === undefined) ctx.addIssue({ code: 'custom', message: `${m.art} braucht ${f}`, path: [f] });
    if (!schlag && m[f] !== undefined) ctx.addIssue({ code: 'custom', message: `${f} nur bei hieb und stoss`, path: [f] });
  }
  if (m.art === 'hut' && (m.beginn !== 'hut' || m.ende !== 'schleife')) ctx.addIssue({ code: 'custom', message: 'eine Hut beginnt als hut und endet als schleife' });
});
export const Clipmarken = z.object({
  stand: z.string().min(1),
  lies: z.string().min(1).describe('das Format in Worten — für Menschen und für die Laufzeit-Sitzung'),
  bildrate: z.number().int().positive(),
  /** Die eine Grundhaltung je Waffe (Schleifenclip). */
  hut: z.record(z.string().regex(/^[a-z0-9-]+$/), Clipname),
  clips: z.record(Clipname, Clipmarke),
}).strict().superRefine((d, ctx) => {
  for (const [w, h] of Object.entries(d.hut)) {
    if (d.clips[h]?.art !== 'hut') ctx.addIssue({ code: 'custom', message: `Hut ${h} von ${w} fehlt in clips oder ist keine hut`, path: ['hut', w] });
  }
  for (const [n, c] of Object.entries(d.clips)) {
    if (c.waffe !== 'koerper' && !d.hut[c.waffe]) ctx.addIssue({ code: 'custom', message: `Waffe ${c.waffe} hat keine Hut`, path: ['clips', n, 'waffe'] });
  }
});
export type Clipmarken = z.infer<typeof Clipmarken>;

/**
 * D457: Laufzeit der Bewegung (`content/figurlaufzeit.json`, gelesen von `src/figur/werte.ts`) — **nur Darstellung**:
 * Dauern der Übergänge je Art (Inertialisierung), Kopplung des Gangs ans Tempo, Fuss am Boden, Neigen, Drehkette,
 * Blick, Atem, Antwort auf erlittene Treffer. Kein Wert hier ändert eine Kampfregel oder ein Tempo.
 */
const sek = (max: number) => z.number().min(0).max(max);
const grad = (max: number) => z.number().min(0).max(max);
export const Figurlaufzeit = z.object({
  stand: z.string(),
  /** Sekunden, über die der Versatz zur neuen Pose abklingt, je Übergangsart. */
  uebergang: z.object({
    standard: sek(0.5), gang: sek(0.5), hutHieb: sek(0.3), kette: sek(0.3), hiebHut: sek(0.5), abbruch: sek(0.3),
    rolle: sek(0.3), rolleEnde: sek(0.5), treffer: sek(0.3), trefferEnde: sek(0.5), block: sek(0.3), fall: sek(0.5),
  }).strict(),
  gang: z.object({
    gehen: z.number().positive().max(4).describe('m/s des Geh-Clips bei Rate 1, Rückfall, wenn die Messung am Clip nichts ergibt'),
    rennen: z.number().positive().max(12).describe('m/s des Lauf-Clips bei Rate 1, Rückfall'),
    rateMin: z.number().positive().max(1), rateMax: z.number().min(1).max(3),
    weiteMin: z.number().positive().max(1).describe('kleinste Schrittweite gegen den Clip'),
    weiteMax: z.number().min(1).max(2).describe('grösste Schrittweite gegen den Clip — darüber reicht das Bein nicht'),
    standHoehe: z.number().positive().max(0.2).describe('m über dem tiefsten Punkt der Fussbahn, bis zu denen ein Fuss als stehend gilt'),
  }).strict().refine(g => g.gehen < g.rennen, 'gehen muss langsamer sein als rennen'),
  fuss: z.object({
    standHoehe: z.number().positive().max(0.2), haltMax: z.number().positive().max(0.3),
    loesen: z.number().positive().max(0.5), neigungMaxGrad: grad(45),
  }).strict(),
  neigen: z.object({
    kurve: z.number().min(0).max(1).describe('Anteil der physikalischen Kurvenlage atan(v·ω/g)'),
    kurveMaxGrad: grad(30),
    schub: z.number().min(0).max(1).describe('Anteil von atan(a/g) beim Anlaufen und Abstoppen'),
    schubMaxGrad: grad(20), halbwert: sek(1),
  }).strict(),
  drehen: z.object({ kopf: sek(0.5), schulter: sek(0.5), huefte: sek(0.5), maxGrad: grad(80) }).strict()
    .refine(d => d.kopf <= d.schulter && d.schulter <= d.huefte, 'Kopf führt, dann Schultern, dann Hüfte'),
  blick: z.object({
    gierMaxGrad: grad(90), nickMaxGrad: grad(60), aufgebenGrad: grad(180), halbwert: sek(1),
    kopf: z.number().min(0).max(1), hals: z.number().min(0).max(1), brust: z.number().min(0).max(1),
  }).strict().refine(b => Math.abs(b.kopf + b.hals + b.brust - 1) < 1e-6, 'Anteile Kopf + Hals + Brust = 1')
    .refine(b => b.aufgebenGrad >= b.gierMaxGrad, 'aufgeben erst jenseits der Grenze'),
  atem: z.object({
    ruheHz: z.number().positive().max(1), lastHz: z.number().positive().max(2), hubGrad: grad(5),
    anstieg: z.number().positive().max(60), erholung: z.number().positive().max(60),
  }).strict(),
  treffer: z.object({
    gradJeSchaden: z.number().min(0).max(2), maxGrad: grad(40),
    frequenz: z.number().positive().max(10), daempfung: z.number().positive().max(0.99),
  }).strict(),
}).strict();
export type Figurlaufzeit = z.infer<typeof Figurlaufzeit>;

/**
 * D427: Kampfton (D423: freie Aufnahmen, CC0, ADR-0013) — welche Dateien unter `public/ton/kampf/` zu welchem
 * Ereignis gehören, wie laut ein Band im Grund ist und wie weit Tonhöhe und Pegel je Anschlag streuen (gegen
 * Wiederholung). Tonhöhe und Pegel **nach Masse** kommen nicht von hier, sondern aus `content/gewicht.json`
 * `ton` über `toene()` in `src/kampf/gewicht.ts`. Gelesen von `src/ton/kampfton.ts`; `npm run validate` prüft,
 * dass jede Datei liegt und in `assets/HERKUNFT.md` steht.
 */
export const KAMPFTON_BAENDER = ['schwung-leicht', 'schwung-schwer', 'treffer-fell', 'treffer-rinde', 'treffer-stoff',
  'treffer-metall', 'block', 'parade', 'rolle', 'schritt', 'griff'] as const;
export const KAMPFTON_OBERFLAECHEN = ['fell', 'rinde', 'stoff', 'metall'] as const;
export const Kampfton = z.object({
  stand: z.string(),
  ordner: z.string().regex(/^[a-z0-9/-]+$/).describe('unter public/, ohne Schrägstrich vorn und hinten'),
  baender: z.record(z.enum(KAMPFTON_BAENDER), z.object({
    dateien: z.array(z.string().regex(/^[a-z0-9-]+\.ogg$/)).min(1),
    pegel: z.number().min(0).max(1).describe('Grundpegel des Bands, 0…1 vor Masse und Bus'),
    streuPegel: z.number().min(0).max(0.5).describe('± Anteil zufällig je Anschlag'),
    streuHalbton: z.number().min(0).max(4).describe('± Halbtöne zufällig je Anschlag'),
  }).strict()),
  /** Was ein Treffer der Spielerin am Getroffenen trifft — Bauplan des Gegners (`content/gegner/<id>.json`). */
  oberflaechen: z.object({
    standard: z.enum(KAMPFTON_OBERFLAECHEN),
    je: z.record(Kennung, z.enum(KAMPFTON_OBERFLAECHEN)),
    /** Die Spielerin selbst (erlittene Treffer). */
    spielerin: z.enum(KAMPFTON_OBERFLAECHEN),
    /** In die gedeckte Linie eines Menschen geschlagen: Waffe auf Waffe. */
    gedeckt: z.enum(KAMPFTON_OBERFLAECHEN),
  }).strict(),
  /** Erlittene Treffer: Pegel nach Schaden (der Gegner trägt keine Waffenmasse in den Daten). */
  erlitten: z.object({ grund: z.number().min(0).max(1), jeSchaden: z.number().min(0).max(0.05) }).strict(),
  /** Abspielrate höchstens so weit von 1 — weiter verstimmt klingt eine Aufnahme nach Band statt nach Masse. */
  rate: z.object({ min: z.number().positive().max(1), max: z.number().min(1).max(4) }).strict(),
  /** Nach dem Beginn der Rolle der Fussaufsatz, als Anteil der Rollendauer. */
  schrittNachRolle: z.number().min(0).max(1),
  real: z.string().min(1),
  warum: z.string().min(1),
  quelle: z.string().min(1),
}).strict().refine(k => k.rate.min <= k.rate.max, 'rate.min über rate.max');
export type Kampfton = z.infer<typeof Kampfton>;

/**
 * Wirken der Marke (D405, Entwurf): keine Zauber, sondern Funktionen der Armklammer. Jedes Wirken kostet
 * Ladungen — dieselben, die das Reinigen braucht. Freigeschaltet über Markenstufe und Einsicht.
 */
export const Wirken = z.array(z.object({
  id: Kennung, name: z.string().max(40),
  ladungen: z.number().int().min(1).max(4),
  markenStufe: z.number().int().min(0).max(6),
  einsicht: z.number().int().min(1).max(3),
  wirkung: z.string().max(200),
  /** Wie das Werk es genannt hätte — die Erklärung aus der Technik der Welt. */
  werk: z.string().max(160),
  beruehrt: z.enum(['anzeige', 'welt', 'traversal', 'oekonomie', 'kampfwert']),
  messung: z.string().max(160).optional(),
  /**
   * D409/D410: Die Marke zaubert nicht. `gilt` = bleibt als Funktion der Klammer (Sensor, Rückruf);
   * `ersetzt` = entfällt als Wirken, `ersetztDurch` nennt das Gerät oder sagt „entfällt“.
   */
  status: z.enum(['gilt', 'ersetzt']).default('gilt'),
  ersetztDurch: z.string().max(120).optional(),
}).strict().refine(w => ['anzeige', 'welt'].includes(w.beruehrt) || !!w.messung, 'wer einen geprüften Wert berührt, nennt die Messung')
  .refine(w => (w.status === 'ersetzt') === !!w.ersetztDurch, 'ersetzt ⇔ ersetztDurch')
  .refine(w => w.status === 'ersetzt' || ['anzeige', 'welt'].includes(w.beruehrt), 'ein geltendes Wirken berührt keinen Kampfwert (D409: keine Magie)'))
  .min(1).refine(a => new Set(a.map(w => w.id)).size === a.length, 'Wirken-IDs sind eindeutig');
export type Wirken = z.infer<typeof Wirken>;

// ------------------------------------------------------- Geräte mit Elementangriffen (D410, Entwurf)

/**
 * Geräte (D409/D410): Technik der Welt, die ein Element aus `ELEMENTE` trägt. Das Gerät in der Hand bestimmt,
 * was man ausführen kann; die **Aufsätze** sind das Austauschbare. Alle Wirkwerte sind Entwurf und ungemessen;
 * `schaden` und `haltung` zählen in Einheiten des leichten Klingenhiebs, bevor der Elementkreis greift.
 */
export const Geraete = z.array(z.object({
  id: Kennung, name: z.string().max(40),
  element: Element,
  status: z.enum(['kapitel-1', 'kapitel-2', 'geparkt']),
  /** Was das Ding real ist und wie es real wirkt (D398). */
  real: z.string().max(320),
  /** Wo das Spiel von der Wirklichkeit abweicht — benannt, nie still. */
  abweichung: z.string().max(260),
  betriebsstoff: z.object({
    gegenstand: Kennung,
    jeFuellung: z.number().int().min(1).max(20).describe('Einheiten je voller Füllung'),
    nachschub: z.enum(['altbestand', 'nachwachsend']),
    real: z.string().max(200),
  }),
  risiko: z.string().max(260),
  erwerb: z.string().max(200),
  masse: z.number().positive().max(15).describe('Kilogramm, betriebsbereit'),
  aufsaetze: z.array(z.object({
    id: Kennung, name: z.string().max(40),
    form: z.enum(['kegel', 'stoss', 'flaeche', 'beruehrung', 'linie']),
    /** Meter. Geräte sind Nahbereich: Fernkampf ist bis nach Kapitel 1 zurückgestellt (D406). */
    reichweite: z.number().positive().max(4),
    schaden: z.number().min(0).max(3),
    haltung: z.number().min(0).max(3),
    zustand: z.enum(['brennt', 'verlangsamt', 'zuckt', 'ruhig', 'geblendet']).optional(),
    dauerSek: z.number().min(0).max(20),
    verbrauch: z.number().int().min(1).max(10),
    wirkung: z.string().max(200),
  }).strict().refine(a => !!a.zustand === a.dauerSek > 0, 'Zustand ⇔ Dauer')).min(2).max(3),
  clips: z.object({ vorhanden: z.array(z.string()), fehlen: z.array(z.string()) }),
  messung: z.string().max(200),
}).strict()).min(5).max(7)
  .refine(a => new Set(a.map(g => g.id)).size === a.length, 'Geräte-IDs sind eindeutig')
  .refine(a => new Set(a.map(g => g.element)).size === a.length, 'je Element höchstens ein Gerät');
export type Geraete = z.infer<typeof Geraete>;

/**
 * Techniken (D400): was der Brachgänger **gelernt** hat. Bezahlt mit Einsicht, an der Rast. Keine Technik
 * schaltet ein Grundverb frei (ADR-0007: Ausdauer, Rolle, Parade, Lock-On, Haltung sind ab Start da).
 * `beruehrt` sagt, was die Technik anfasst — und damit, was vor dem Bau gemessen werden muss.
 */
export const Technik = z.object({
  id: Kennung,
  name: z.string().max(40),
  zweig: z.enum(['kampf', 'reinigen', 'bewegung']),
  kosten: z.number().int().min(1).max(3),
  wirkung: z.string().max(200),
  /** `anzeige`/`welt`: kein geprüfter Wert berührt. `traversal`/`oekonomie`/`kampfwert`: erst messen. */
  beruehrt: z.enum(['anzeige', 'welt', 'traversal', 'oekonomie', 'kampfwert']),
  /** Womit gemessen wird, bevor die Technik gilt. Pflicht, wenn ein geprüfter Wert berührt ist. */
  messung: z.string().max(160).optional(),
  /** Der berührte Wert, falls es ihn schon gibt (Datei und Feld). */
  wert: z.string().max(120).optional(),
  vorher: Kennung.optional(),
}).refine(t => ['anzeige', 'welt'].includes(t.beruehrt) || !!t.messung, 'wer einen geprüften Wert berührt, nennt die Messung');
export const Techniken = z.array(Technik).min(1)
  .refine(a => new Set(a.map(t => t.id)).size === a.length, 'Technik-IDs sind eindeutig')
  .refine(a => a.every(t => !t.vorher || a.some(x => x.id === t.vorher)), '`vorher` zeigt auf eine Technik');
export type Technik = z.infer<typeof Technik>;

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
  mensch: z.object({
    linienFolge: z.array(KampfLinie).min(1), deckung: KampfLinie,
    /**
     * D426: Gibt er beim ersten Haltungsbruch auf (Waffe fallen lassen, Hände heben, zurückweichen — `echtzeit.ts`
     * `gibtAuf`)? Ohne Angabe ja. `false` für die, die nicht aufgeben (Anführer). Das Feld steht im Block `mensch`,
     * damit kein Tier es tragen kann: Tiere geben nie auf.
     */
    gibtAuf: z.boolean().optional(),
  }).strict().optional(),
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

/**
 * D426: Aufgabe menschlicher Gegner beim ersten Haltungsbruch (`content/aufgabe.json`, gelesen von
 * `src/kampf/echtzeit.ts`). Wer aufgibt, greift nicht mehr an und weicht zurück; die Spielerin kann ihn bis zum Ende
 * der Frist noch töten, danach geht er (verschont). Ob ein Mensch aufgibt, steht am Gegner (`mensch.gibtAuf`).
 */
export const AufgabeDaten = z.object({
  rueckzug: z.number().positive().max(2).describe('m/s, mit denen er rückwärts von der Spielerin weg geht'),
  abstand: z.number().positive().max(15).describe('Meter bis zum Rand der Spielerin, bis zu denen er zurückweicht'),
  frist: z.number().positive().max(15).describe('Sekunden ab dem Haltungsbruch, bis er den Kampf verlässt (verschont)'),
  warum: z.string().optional(),
}).strict();
export type AufgabeDaten = z.infer<typeof AufgabeDaten>;

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

// --------------------------------------------------------------- Einstellungen (D394)

/**
 * Einstellungen als Daten (D394, `docs/design/BRACHLAND_Menue-und-Einstellungen_v1.md` §6/§8): Jede
 * Einstellung ist ein Eintrag in `content/einstellungen.json`, kein Feld im Code. Der Store (noch nicht
 * gebaut) liest Standard und Wertebereich von hier, die Oberfläche baut ihre Zeilen daraus, und die
 * URL-Schalter aus `src/world/echt.ts` bleiben als Entwickler-Übersteuerung darüber liegen (`url`).
 *
 * `prioritaet`: M = muss vor dem ersten Fremdtest, S = soll vor Veröffentlichung, K = kann.
 * `wirkt`: `geraet` gilt für diesen Rechner (Grafik, Anzeige, Ton, Belegung), `spieler` für die Person
 * (Hilfen, Zugänglichkeit) — beim Export wandern nur `spieler`-Werte mit dem Spielstand mit.
 */
export const EINSTELLUNGS_GRUPPEN = ['grafik', 'anzeige', 'ton', 'steuerung', 'spiel', 'zugaenglichkeit', 'daten'] as const;
export const QUALITAETSSTUFEN = ['niedrig', 'mittel', 'hoch', 'ultra'] as const;

const einstellungsKopf = {
  id: z.string().regex(/^[a-z0-9-]+$/),
  gruppe: z.enum(EINSTELLUNGS_GRUPPEN),
  name: z.string().min(1).describe('Anzeigename, deutsch (Lokalisierung: Doc §8.3)'),
  hilfe: z.string().min(1).describe('ein Satz, was die Einstellung tut und was sie kostet'),
  prioritaet: z.enum(['M', 'S', 'K']),
  wirkt: z.enum(['geraet', 'spieler']),
  url: z.string().regex(/^[a-z0-9]+$/).optional().describe('heutiger URL-Schalter (ohne Fragezeichen), der denselben Wert übersteuert'),
  /**
   * D415: Wie der URL-Text in einen Wert dieser Einstellung übersetzt wird (`?weite=1.6` → `weit`). Ohne
   * Angabe gilt: Schalter `1`/`0`, Auswahl die Wert-id, Regler die Zahl — jeweils nur, wenn gültig.
   */
  urlWerte: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  neustart: z.boolean().optional().describe('wirkt erst nach Neuladen der Seite'),
};

export const Einstellung = z.discriminatedUnion('art', [
  z.object({
    ...einstellungsKopf,
    art: z.literal('schalter'),
    standard: z.boolean(),
    stufen: z.record(z.enum(QUALITAETSSTUFEN), z.boolean()).optional(),
  }).strict(),
  z.object({
    ...einstellungsKopf,
    art: z.literal('auswahl'),
    werte: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1) }).strict()).min(2),
    standard: z.string(),
    stufen: z.record(z.enum(QUALITAETSSTUFEN), z.string()).optional(),
  }).strict(),
  z.object({
    ...einstellungsKopf,
    art: z.literal('regler'),
    min: z.number(),
    max: z.number(),
    schritt: z.number().positive(),
    standard: z.number(),
    einheit: z.string().optional(),
    stufen: z.record(z.enum(QUALITAETSSTUFEN), z.number()).optional(),
  }).strict(),
]);
export type Einstellung = z.infer<typeof Einstellung>;

/** Liegt ein Wert im Bereich der Einstellung? Auch der Store prüft damit geladene und importierte Werte. */
export function einstellungsWertGueltig(e: Einstellung, wert: unknown): boolean {
  if (e.art === 'schalter') return typeof wert === 'boolean';
  if (e.art === 'auswahl') return typeof wert === 'string' && e.werte.some(w => w.id === wert);
  if (typeof wert !== 'number' || !Number.isFinite(wert) || wert < e.min - 1e-9 || wert > e.max + 1e-9) return false;
  const schritte = (wert - e.min) / e.schritt;
  return Math.abs(schritte - Math.round(schritte)) < 1e-6;
}

/**
 * D415: Vorschlag der Qualitätsstufe aus Geräte-Kennwerten (`src/spiel/qualitaetsvorschlag.ts`). Die
 * Regeln sind **Arbeitswerte ohne Messlauf** (Doc §6.1) — sie wählen eine Startstufe, die Bildzeit beim
 * Vorwärmen korrigiert sie. Erste passende Regel gewinnt.
 */
export const QualitaetsAutomatik = z.object({
  regeln: z.array(z.object({
    muster: z.string().min(1).describe('regulärer Ausdruck, ohne Gross-/Kleinschreibung, gegen den Renderer-Namen'),
    stufe: z.enum(QUALITAETSSTUFEN),
    warum: z.string().min(1),
  }).strict()),
  ohneTreffer: z.enum(QUALITAETSSTUFEN).describe('Stufe, wenn keine Regel greift oder der Name fehlt'),
  mobilHoechstens: z.enum(QUALITAETSSTUFEN).describe('Handy/Tablet (grober Zeiger) nie darüber — ADR-0006: das Handy ist eine spätere eigene Stufe'),
  wenigKerneHoechstens: z.object({ kerne: z.number().int().positive(), stufe: z.enum(QUALITAETSSTUFEN) }).strict(),
  ultraBrauchtWebgpu: z.boolean().describe('Ultra nur, wenn der WebGPU-Pfad das Spiel trägt (Doc §6.1, ADR-0015)'),
  zielBildzeitMs: z.record(z.enum(QUALITAETSSTUFEN), z.number().positive()),
  runterAbAnteil: z.number().positive().describe('p95 über Ziel × Anteil → eine Stufe runter'),
  hochUnterAnteil: z.number().positive().describe('p95 unter Ziel × Anteil → eine Stufe hoch'),
}).strict();
export type QualitaetsAutomatik = z.infer<typeof QualitaetsAutomatik>;

export const Einstellungen = z.object({
  version: z.number().int().positive().describe('Version des Einstellungssatzes; steigt, wenn eine id entfällt oder ihre Bedeutung wechselt'),
  einstellungen: z.array(Einstellung).min(1),
  automatik: QualitaetsAutomatik.optional(),
}).strict().superRefine((d, ctx) => {
  const gesehen = new Set<string>();
  d.einstellungen.forEach((e, i) => {
    if (gesehen.has(e.id)) ctx.addIssue({ code: 'custom', path: ['einstellungen', i, 'id'], message: `id '${e.id}' doppelt` });
    gesehen.add(e.id);
    if (e.art === 'regler' && e.max <= e.min) ctx.addIssue({ code: 'custom', path: ['einstellungen', i, 'max'], message: 'max nicht über min' });
    if (e.art === 'auswahl' && new Set(e.werte.map(w => w.id)).size !== e.werte.length) {
      ctx.addIssue({ code: 'custom', path: ['einstellungen', i, 'werte'], message: 'Wert-id doppelt' });
    }
    if (!einstellungsWertGueltig(e, e.standard)) {
      ctx.addIssue({ code: 'custom', path: ['einstellungen', i, 'standard'], message: 'Standard liegt nicht im Wertebereich' });
    }
    for (const [stufe, wert] of Object.entries(e.stufen ?? {})) {
      if (!einstellungsWertGueltig(e, wert)) {
        ctx.addIssue({ code: 'custom', path: ['einstellungen', i, 'stufen', stufe], message: 'Stufenwert liegt nicht im Wertebereich' });
      }
    }
    // Nur Grafik hängt an Qualitätsstufen — sonst würde „Hoch“ still die Lautstärke ändern.
    if (e.stufen && e.gruppe !== 'grafik') {
      ctx.addIssue({ code: 'custom', path: ['einstellungen', i, 'stufen'], message: 'Stufenwerte nur in der Gruppe grafik' });
    }
  });
});
export type Einstellungen = z.infer<typeof Einstellungen>;

// ------------------------------------------------------- Belegung (D415)

/**
 * Eingabe als Aktionen (D415, Doc §6.4.1/§8.4): Der Code fragt Aktionen, nie Tasten. Tasten stehen als
 * `KeyboardEvent.code` (Lage, nicht Beschriftung), Maustasten als `Maus0`–`Maus2`, Gamepad-Knöpfe als
 * `Pad:<Name>` nach der Standardzuordnung der Gamepad API.
 *
 * **Kontext** sagt, in welchem Spielzustand eine Aktion gilt. Zwei Aktionen auf derselben Taste sind nur
 * dann eine Kollision, wenn sich ihre Kontexte überschneiden: `frei` (kein Ziel aufgeschaltet) und `ziel`
 * (Ziel aufgeschaltet) schliessen sich aus — so teilen sich Drehen und Zielwechsel Q/E, wie seit D168.
 */
export const EINGABE_KONTEXTE = ['immer', 'welt', 'kampf', 'frei', 'ziel'] as const;
export const Belegung = z.object({
  version: z.number().int().positive(),
  aktionen: z.array(z.object({
    id: z.string().regex(/^[a-z_]+$/),
    name: z.string().min(1),
    kontext: z.enum(EINGABE_KONTEXTE),
    tasten: z.array(z.string().min(1)).max(4).describe('Tastatur und Maus, Standardbelegung'),
    pad: z.array(z.string().regex(/^Pad:/)).max(2).describe('Gamepad-Grundbelegung, fest (A-29 (5))'),
    fest: z.boolean().optional().describe('nicht frei belegbar (Esc löst im Browser ohnehin den Zeiger)'),
    verdrahtet: z.boolean().describe('liest der Code die Aktion schon? Sonst nur vorgesehen'),
  }).strict()).min(1),
  geteilt: z.array(z.object({
    aktionen: z.tuple([z.string(), z.string()]),
    taste: z.string().min(1),
    warum: z.string().min(1),
  }).strict()).describe('bewusst geduldete Überschneidungen im Bestand, mit Begründung'),
  sperre: z.array(z.string().min(1)).describe('Tasten, die der Browser für sich behält'),
  doppel: z.array(z.object({
    knopf: z.string().regex(/^Pad:/),
    tippen: z.string().min(1),
    halten: z.string().min(1),
    schwelleS: z.number().positive(),
  }).strict()).describe('ein Knopf, zwei Aktionen nach Druckdauer (Gattung: B tippen = Rolle, halten = Rennen)'),
}).strict().superRefine((d, ctx) => {
  const ids = new Set<string>();
  d.aktionen.forEach((a, i) => {
    if (ids.has(a.id)) ctx.addIssue({ code: 'custom', path: ['aktionen', i, 'id'], message: `Aktion '${a.id}' doppelt` });
    ids.add(a.id);
    for (const t of a.tasten) if (d.sperre.includes(t)) ctx.addIssue({ code: 'custom', path: ['aktionen', i, 'tasten'], message: `${t} ist gesperrt` });
  });
  d.geteilt.forEach((g, i) => g.aktionen.forEach(a => {
    if (!ids.has(a)) ctx.addIssue({ code: 'custom', path: ['geteilt', i], message: `unbekannte Aktion '${a}'` });
  }));
});
export type Belegung = z.infer<typeof Belegung>;

// ------------------------------------------------------- Spielstand (D415)

/**
 * Laufzeit-Schema des Spielstands (D415, Doc §7.2): Laden und Import prüfen dagegen. **Bewusst
 * nachsichtig** — es prüft die Form der Felder, die das Spiel liest, und lässt unbekannte Felder durch
 * (`passthrough`). Ein zu strenges Schema wäre selbst ein Datenverlust: Was es ablehnt, lädt nicht.
 * Fehlende Felder ergänzt `ergaenzeStand` vorher aus `LEERER_STAND` (der Weg „ohne Versionssprung“).
 */
const kennung = z.string().min(1);
export const SpielstandDaten = z.object({
  version: z.number().int().positive(),
  team: z.array(z.object({
    kreatur: kennung,
    stufe: z.number().int().min(1),
    erfahrung: z.number().finite(),
    kp: z.number().finite(),
    zustand: z.enum(['rein', 'befallen', 'verhaertet', 'rueckgefuehrt']).optional(),
  }).passthrough()),
  gefangen: z.array(kennung),
  besiegt: z.array(kennung),
  /** D417 (Migration v3): gereinigte Tiere, Format wie `besiegt`. */
  gereinigt: z.array(kennung),
  /** D417: nur die Ladungen jetzt; Fassung, Läuterung, Stufe sind abgeleitet (`src/spiel/marke.ts`). */
  marke: z.object({ ladung: z.number().finite().min(0) }).passthrough(),
  position: z.tuple([z.number().finite(), z.number().finite()]),
  region: kennung,
  gesehen: z.array(kennung),
  beutel: z.record(z.string(), z.number().finite()),
  fragmente: z.array(kennung),
  orte: z.array(kennung),
  regenten: z.array(kennung),
  geheilt: z.array(kennung),
  auftraege: z.record(z.string(), z.enum(['angenommen', 'abgeholt'])),
  richtungskampf: z.boolean(),
  held: z.object({ name: z.string() }).passthrough().nullable(),
  waffenStufen: z.object({ klinge: z.number(), axt: z.number() }).passthrough(),
  lagerSieg: z.record(z.string(), z.number().finite()),
  letzteZuflucht: z.string().optional(),
  /** D416 (v3): gemeldete Begegnungen mit Lage; das Revier folgt aus der Lage. */
  begegnungen: z.array(z.object({
    art: z.enum(['getoetet', 'gereinigt', 'umgangen', 'verschont']),
    gegnerId: kennung, region: kennung,
    x: z.number().finite(), z: z.number().finite(), zeit: z.number().finite(),
    /** D426: Mensch statt Tier — zählt in keinem Revier, getötet beim Zähler der Mönche voll. */
    mensch: z.literal(true).optional(),
  }).passthrough()),
  /** D416 (v3): was Rasten an den Revieren entschieden haben. */
  reviere: z.object({
    rasten: z.number().int().min(0),
    leerFolge: z.array(kennung),
    je: z.record(z.string(), z.object({
      verhaertet: z.number().int().min(0).optional(),
      zugewandert: z.number().int().min(0).optional(),
      wartet: z.number().int().min(0).optional(),
    }).passthrough()),
  }).passthrough(),
}).passthrough();

/** Die Hülle um den Stand (D415): trägt, was eine Platzliste zeigt, ohne `spiel` zu lesen. */
export const SpielstandHuelle = z.object({
  format: z.literal('brachland-spielstand'),
  version: z.number().int().positive(),
  geschrieben: z.string().min(1).describe('ISO-Zeit des Schreibens'),
  spiel: z.unknown(),
  pruefsumme: z.string().regex(/^[0-9a-f]{8}$/).optional().describe('FNV-1a über `spiel` (stabil sortiert), nur im Export'),
  einstellungen: z.record(z.string(), z.unknown()).optional().describe('nur Export: persönliche Einstellungen (`wirkt: spieler`)'),
}).passthrough();

// ------------------------------------------------------- Bewegung (D412)

/**
 * Bewegungswerte der Figur (D412, Entscheidungen D411 auf die Physik-Prüfung, `content/bewegung.json`).
 * Jeder Block nennt, was real gilt, warum das Spiel abweicht und wo es steht — „benannt und begründet, nie
 * still“ (D398). Gelesen von `src/spieler/tempo.ts`, `ausdauer.ts`, `gleiten.ts`, `bewegung.ts` und
 * `src/spiel/reiten.ts`; `tauchen` und `tragtier` sind Entwurf — `tauchen` liest kein Code, vom Tragtier liest
 * `reiten.ts` seit D413 Masse und Traglast (`traegt`), das Tier selbst gibt es nicht. Zeiten in Sekunden,
 * Strecken in Metern, Tempi in m/s.
 */
const Benannt = {
  real: z.string().min(1).describe('was in der Wirklichkeit gilt, mit „nicht belegt“, wo die Quelle fehlt'),
  warum: z.string().min(1).describe('warum das Spiel davon abweicht'),
  quelle: z.string().min(1),
};
const Tempo = z.number().positive().max(60);
export const Bewegung = z.object({
  stand: z.string(),
  laufen: z.object({
    gehen: Tempo,
    rennen: Tempo,
    /** Werte, die `?renntempo=` am M1 zulässt; der Standard muss darunter sein. */
    rennenProbe: z.array(Tempo).min(1),
    ...Benannt,
  }).strict().refine(l => l.rennen > l.gehen, 'Rennen muss schneller sein als der Laufschritt')
    .refine(l => l.rennenProbe.includes(l.rennen), 'rennenProbe enthält den Standard nicht')
    .refine(l => l.rennenProbe.every(r => r > l.gehen), 'ein Probewert liegt nicht über dem Laufschritt'),
  reiten: z.object({ gehen: Tempo, rennen: Tempo, ...Benannt }).strict()
    .refine(r => r.rennen > r.gehen, 'Reiten im Galopp muss schneller sein als im Schritt'),
  klettern: z.object({
    tempo: Tempo,
    reichweite: z.number().positive().describe('Meter Wand aus voller Ausdauer'),
    ...Benannt,
  }).strict(),
  fall: z.object({
    schadlosBis: z.number().positive(),
    toedlichAb: z.number().positive(),
    rolle: z.number().min(0).max(1).describe('Faktor auf den Schaden bei einer Rolle in der Landung'),
    rolleFenster: z.number().positive().max(1).describe('Sekunden vor dem Aufsetzen, in denen die Rolltaste als Rolle zählt (D413)'),
    endgeschwindigkeit: Tempo,
    ...Benannt,
  }).strict().refine(f => f.schadlosBis < f.toedlichAb, 'schadlosBis muss unter toedlichAb liegen'),
  kaelte: z.object({
    sinktNach: z.number().positive(),
    leerNach: z.number().positive(),
    anzug: z.string().regex(/^[a-z0-9-]+$/).describe('Gegenstand, der die Kälteuhr anhält'),
    ...Benannt,
  }).strict().refine(k => k.sinktNach < k.leerNach, 'sinktNach muss vor leerNach liegen'),
  tauchen: z.object({
    status: z.literal('entwurf'),
    tempo: Tempo,
    flascheLiter: z.number().positive(),
    fuelldruckBar: z.number().positive(),
    reserveBar: z.number().nonnegative(),
    verbrauchArbeit: z.number().positive().describe('l/min an der Oberfläche bei Arbeit'),
    zeitfaktor: z.number().positive(),
    ...Benannt,
  }).strict().refine(t => t.reserveBar < t.fuelldruckBar, 'Reserve über dem Fülldruck'),
  gleiter: z.object({ verhaeltnis: z.number().positive(), sinken: Tempo, ...Benannt }).strict(),
  tragtier: z.object({
    status: z.literal('entwurf'),
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string(),
    arten: z.array(z.string()).min(1),
    zustand: Zustand,
    masse: z.object({ min: z.number().positive(), max: z.number().positive(), belegt: z.boolean(), notiz: z.string().optional() }).strict(),
    traglastAnteil: z.number().positive().max(0.3),
    reiterLast: z.number().positive(),
    auftrag: z.string().regex(/^[a-z0-9-]+$/),
    /** Kein Gegner: Das Tier wird gereinigt, nicht bekämpft. Kampfwerte erst, wenn es je als Gegner dient. */
    kampfwerte: z.null(),
    text: z.string().max(400),
    real: z.string().min(1),
    quelle: z.string().min(1),
  }).strict()
    .refine(t => t.masse.min <= t.masse.max, 'masse.min über masse.max')
    // Physik (D398): Das leichteste Tier dieser Art muss den Reiter beim Traglastanteil tragen.
    .refine(t => t.masse.min * t.traglastAnteil >= t.reiterLast - 1e-9, 'das leichteste Tier trägt den Reiter nicht'),
}).strict();
export type Bewegung = z.infer<typeof Bewegung>;
