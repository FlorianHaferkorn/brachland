/**
 * BRACHLAND — Inhaltsschemas
 *
 * Diese Datei ist der Drift-Schutz des Projekts: Jeder Spielinhalt muss hier
 * hindurch. Neue Inhalte passen ins Schema, oder das Schema wird bewusst
 * geändert — unbemerktes Abdriften ist damit ausgeschlossen.
 */
import { z } from 'zod';

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
]);

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
export const Zustand  = z.enum(['rein', 'befallen', 'verhaertet']);

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
  /** Woran es liegt — nur zur Einordnung beim Anlegen. */
  fundstelle: z.enum(['ruine', 'bunker', 'steinbruch', 'grat', 'bach', 'hof']),
});
export type Fragment = z.infer<typeof Fragment>;

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
