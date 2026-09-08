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
  z.object({ art: z.literal('schaden_ueber_zeit'), proRunde: z.number(), runden: z.number().int() }),
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
  /** Blickrichtung in Grad, 0 = Nord, positiv nach links wie `?absetzen=`. */
  blick: z.number().optional(),
});
export type Ort = z.infer<typeof Ort>;

// ------------------------------------------------------------- Aufträge

/**
 * Was ein Auftrag verlangt.
 *
 * Alle vier Bedingungen sind aus dem **Spielstand allein** prüfbar — besiegte und
 * gefangene Vorkommen, gelesene Fragmente, besiegte Regenten stehen dort ohnehin.
 * Das ist Absicht: Ein Auftragssystem, das eigene Zähler mitschreibt, hat ab dem
 * ersten Tag zwei Wahrheiten über denselben Sachverhalt, und die driften.
 */
export const Auftragsziel = z.discriminatedUnion('art', [
  z.object({ art: z.literal('besiege'), kreatur: z.string(), anzahl: z.number().int().min(1).max(20) }),
  z.object({ art: z.literal('fange'),   kreatur: z.string(), anzahl: z.number().int().min(1).max(6) }),
  z.object({ art: z.literal('finde'),   fragment: z.string() }),
  z.object({ art: z.literal('regent'),  regent: z.string() }),
]);
export type Auftragsziel = z.infer<typeof Auftragsziel>;

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
});
export type Auftrag = z.infer<typeof Auftrag>;

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
    abKpAnteil: z.number().min(0).max(1),
    verhalten: z.string(),
  })).min(2).max(4),
  werte: RegentWerte,
  moves: z.array(z.string()).min(4).max(6),
  /** Reinkultur-Komponenten, die zur Heilung gebraucht werden. */
  reinkulturen: z.array(z.string()).length(3),
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

export const Region = z.object({
  id: z.string(),
  name: z.string(),
  realeGrundlage: z.string().describe('reale Region, aus der die OSM-Daten stammen'),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  regent: z.string(),
  kreaturen: z.array(z.string()),
  konzentrate: z.array(Konzentrat).max(2),
  traversal: z.string().describe('Fähigkeit, die diese Region freischaltet'),
  zielSpielzeit: z.number().describe('Stunden'),
});

// --------------------------------------------------------------- Biom-Moves

export const BiomMove = z.object({
  osmTag: z.string(),
  move: z.string(),
  /** Feste Schwelle statt Zufall — Nachvollziehbarkeit geht vor. */
  kaempfeNoetig: z.number().int().default(8),
});

export const SCHEMA_VERSION = 1;
