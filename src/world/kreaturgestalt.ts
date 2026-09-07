/**
 * BRACHLAND — Kreaturensilhouetten (Platzhalter)
 *
 * ADR-0002 sperrt echte Kreaturenmodelle, bis die Stil-Referenz steht: ein Bild
 * definiert den Look für alle ~200, sonst driftet der Stil auseinander. Bis dahin
 * braucht das Spiel trotzdem etwas, das in der Welt steht und angreifbar ist.
 *
 * Deshalb Silhouetten statt Modelle. Vier Bauformen nach `basisRig`, eingefärbt nach
 * Element. Das reicht, um im Nebel zu erkennen, dass dort etwas steht und welches
 * Element es hat — mehr leistet die Art Direction auf Entfernung ohnehin nicht.
 *
 * Bewusst NICHT gemacht: Details, die später weggeworfen werden.
 *
 * **Zum Dreiecksbudget — eine Korrektur.** Hier stand „jede Silhouette bleibt unter
 * 250 Dreiecken". Das war beim ersten Messen falsch: Der Pilzfächer aus der
 * Stilreferenz hat den Rahmen gesprengt, ohne dass die Zusage nachgezogen wurde.
 * Gemessen (`npm run gestalt`) steht es bei 208 auf Mutation 0 bis 556 beim K7 auf
 * Mutation 2; die Obergrenze ist jetzt **600** und wird von einem Werkzeug geprüft
 * statt von einem Kommentar behauptet. Das eigentliche Modellbudget bleibt davon
 * unberührt — das sind die 4.000 Dreiecke aus `zielTris`.
 */
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry } from './props.js';
import type { Element, Ursprung } from '../data/schema.js';

/**
 * Herkunft als Bauweise — die Creature Design Bible v1.1, §1.
 *
 * Das Blatt nennt für jede der drei Herkünfte eine Optik: Wildlinge *organisch,
 * asymmetrisch, gewachsen*; Zuchtlinien *symmetrisch, modular, konstruiert*;
 * Verwachsene *ortsgebunden, massiv, funktional*. Im Code stand davon nichts —
 * jede Kreatur wurde exakt gleich gebaut, aus gespiegelten Boxen.
 *
 * Der Witz daran: Diese Bauweise ist genau die der **Zuchtlinien**. Alle zwölf
 * Wildlinge sahen aus wie Fabrikware, und es fiel nicht auf, solange es keine
 * Zuchtlinie gab, gegen die man sie hätte halten können.
 *
 * Umgesetzt ist deshalb der Unterschied, nicht die Beschreibung:
 *
 * - `wildling` bekommt **Streuung** — Beine unterschiedlich lang, Rumpf leicht
 *   gekippt, ein Horn länger, der Fächer sitzt auf einer Flanke statt mittig.
 *   Der Zufall ist je Linie fest (Seed aus dem Rig), also über Sitzungen gleich.
 * - `zuchtlinie` bleibt **exakt gespiegelt** und bekommt ein Rückenmodul: eine
 *   Reihe gleicher Platten in gleichem Abstand. Wiederholung ist das Signal.
 * - `verwachsener` wird **breiter und tiefer** und bekommt einen Sockel: der Teil,
 *   der nicht mehr Tier ist, sondern Bauwerk.
 *
 * Auf 15 m im Nebel sind das drei unterscheidbare Umrisse — mehr braucht es nicht,
 * und mehr trägt eine Silhouette unter 250 Dreiecken auch nicht.
 */
export type { Ursprung };

/** Streuung eines Wildlings: 1 ± `staerke`. Bei allen anderen Herkünften exakt 1. */
function streuung(zufall: () => number, ursprung: Ursprung, staerke: number): number {
  return ursprung === 'wildling' ? 1 + (zufall() - 0.5) * 2 * staerke : 1;
}

/**
 * Stabiler Streu-Seed aus einer Kreatur-Id.
 *
 * Muss aus der **Id** kommen und nicht aus einem Zähler: Ein Zähler ändert sich,
 * sobald eine Datei dazukommt, und dann steht der Grathorn nach dem nächsten
 * Inhalts-Commit anders da als vorher. Die Id ändert sich nie.
 */
export function saatAusId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 100000;
}

/**
 * Elementfarben — gedämpft, wie alles außer dem Befall.
 *
 * `sporen` ist der einzige helle Ton: Sporen sind im Kanon biolumineszent, und die
 * Signalfarbe der Art Direction (#3fd9a0) gehört zum Befall. Die Kreaturenfarbe
 * liegt bewusst daneben, nicht darauf.
 */
export const ELEMENT_FARBE: Record<Element, string> = {
  holz: PALETTE.element.holz, stein: PALETTE.element.stein, 'alt-tech': PALETTE.element['alt-tech'],
  sporen: PALETTE.element.sporen, wasser: PALETTE.element.wasser, brand: PALETTE.element.brand,
  frost: PALETTE.element.frost, faeulnis: PALETTE.element.faeulnis,
};

export type BasisRig = 'quadruped' | 'quadruped_small' | 'biped_bird' | 'serpent';

/**
 * Widerristhöhe je Bauform in Metern.
 *
 * Aus den realen Vorbildern: Steinbock und Wildschwein ~1 m, Fuchs und Salamander
 * deutlich darunter, Auerhahn aufgerichtet ~0,85 m, Kreuzotter liegt flach.
 * Maßstabstreue ist der Grund, warum das Projekt überhaupt 3D ist.
 */
/**
 * Kreaturen, für die ein **Modell** in `public/creatures` liegt.
 *
 * Alles andere steht weiter als Silhouette in der Welt (G-23). Die Liste ist von
 * Hand gepflegt und wird vom Qualitätstor gegen den Ordner geprüft — ein Eintrag
 * ohne Datei wäre eine Kreatur, die im Spiel verschwindet, und das sieht man erst
 * an der Stelle, an der sie stehen sollte.
 *
 * Die Modelle kommen aus einem CC0-Tierpack und laufen durch `tools/kreaturbau.py`
 * (G-123): Materialfarbe an den Vertex, Helligkeit in die Palette der Welt,
 * Dreiecke auf `zielTris`, Widerristhöhe aus `RIG_HOEHE` eingerechnet. Deshalb
 * braucht die Szene für Modell und Silhouette denselben Skalierungsausdruck.
 */
export const MIT_MODELL: ReadonlySet<string> = new Set([
  'grathorn', 'k7-wolf', 'nebelgams', 'spuerfuchs', 'wurzelkeiler',
]);

export const RIG_HOEHE: Record<BasisRig, number> = {
  quadruped: 1.0, quadruped_small: 0.4, biped_bird: 0.85, serpent: 0.22,
};

function rig(name: string): BasisRig {
  return (name in RIG_HOEHE ? name : 'quadruped') as BasisRig;
}

/** Färbt eine Geometrie flächig ein und schiebt sie an ihre Stelle. */
function teil(
  roh: THREE.BufferGeometry, farbe: THREE.Color, x: number, y: number, z: number,
  drehX = 0,
): THREE.BufferGeometry {
  const g = roh.index ? roh.toNonIndexed() : roh;
  if (drehX) g.rotateX(drehX);
  g.translate(x, y, z);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = farbe.r; col[i * 3 + 1] = farbe.g; col[i * 3 + 2] = farbe.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function bauQuadruped(hell: THREE.Color, dunkel: THREE.Color, h: number,
                      ursprung: Ursprung, zufall: () => number) {
  const teile: THREE.BufferGeometry[] = [];
  // Verwachsene sind „massiv": tiefer gesetzt, breiter, kürzere Beine. Das ist die
  // einzige Herkunft, die den Grundriss ändert und nicht nur die Streuung.
  const massiv = ursprung === 'verwachsener';
  const rumpfH = h * (massiv ? 0.44 : 0.34), beinH = h * (massiv ? 0.36 : 0.5);
  const L = h * 1.15, B = h * (massiv ? 0.58 : 0.42);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // Vier gleiche Beine sind eine Konstruktion. Ein gewachsenes Tier hat vier
    // verschiedene — deshalb streut jedes einzeln, und zwar in Länge UND Stand.
    const lang = beinH * streuung(zufall, ursprung, 0.10);
    teile.push(teil(new THREE.BoxGeometry(B * 0.22, lang, B * 0.22), dunkel,
      sx * B * 0.34 * streuung(zufall, ursprung, 0.08), lang / 2,
      sz * L * 0.3 * streuung(zufall, ursprung, 0.08)));
  }
  const rumpf = new THREE.BoxGeometry(B, rumpfH, L);
  // Ein leicht gekippter Rumpf liest sich als Haltung, nicht als Fehler — er ist
  // der billigste Weg von „Modell" zu „Tier".
  if (ursprung === 'wildling') rumpf.rotateZ((zufall() - 0.5) * 0.14);
  teile.push(teil(rumpf, hell, 0, beinH + rumpfH / 2, 0));
  // Kopf sitzt vorn und tiefer — das macht die Silhouette lesbar als Tier.
  teile.push(teil(new THREE.BoxGeometry(B * 0.55, h * 0.22, h * 0.3), hell,
    (ursprung === 'wildling' ? (zufall() - 0.5) * B * 0.16 : 0),
    beinH + rumpfH * 0.85, -L * 0.58));
  // Hörner/Ohren als Kontur nach oben. Bei Wildlingen ist eins länger — das
  // auffälligste Zeichen von Asymmetrie, das eine Silhouette überhaupt hergibt.
  for (const sx of [-1, 1]) {
    teile.push(teil(new THREE.ConeGeometry(h * 0.05, h * 0.26 * streuung(zufall, ursprung, 0.28), 4),
      dunkel, sx * B * 0.2, beinH + rumpfH * 1.2, -L * 0.55));
  }
  teile.push(teil(new THREE.BoxGeometry(B * 0.16, h * 0.1, L * 0.32), dunkel,
    0, beinH + rumpfH * 0.9, L * 0.6));

  if (ursprung === 'zuchtlinie') teile.push(...bauRueckenmodul(dunkel, h, beinH + rumpfH, L, B));
  if (massiv) teile.push(...bauSockel(dunkel, h, L, B));
  return teile;
}

/**
 * Das Rückenmodul der Zuchtlinien — gleiche Platten in gleichem Abstand.
 *
 * Wiederholung ist hier die ganze Aussage. Eine Zuchtlinie ist nicht deshalb
 * erkennbar, weil sie Technik trägt (Verwachsene tun das auch), sondern weil sich
 * an ihr etwas **wiederholt**: fünf identische Rippen, mittig gespiegelt, ohne
 * jede Streuung. Das ist die Klemmrippe des K7 und zugleich der Bauplan für jede
 * weitere Zuchtlinie.
 */
function bauRueckenmodul(farbe: THREE.Color, h: number, ruecken: number,
                         L: number, B: number): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  const rippen = 5;
  for (let i = 0; i < rippen; i++) {
    const t = i / (rippen - 1);
    for (const sx of [-1, 1]) {
      teile.push(teil(new THREE.BoxGeometry(B * 0.1, h * 0.14, L * 0.06), farbe,
        sx * B * 0.28, ruecken + h * 0.06, (t - 0.5) * L * 0.62));
    }
  }
  return teile;
}

/**
 * Der Sockel der Verwachsenen — der Teil, der nicht mehr Tier ist.
 *
 * „Ortsgebunden" ist keine Farbe und keine Form am Körper, sondern die Aussage,
 * dass etwas nicht weggeht. Ein Block, der bis auf den Boden reicht und breiter
 * ist als das Tier, sagt das auf jede Entfernung.
 */
function bauSockel(farbe: THREE.Color, h: number, L: number, B: number): THREE.BufferGeometry[] {
  return [teil(new THREE.BoxGeometry(B * 1.25, h * 0.3, L * 0.7), farbe, 0, h * 0.15, L * 0.1)];
}

function bauVogel(hell: THREE.Color, dunkel: THREE.Color, h: number,
                  ursprung: Ursprung, zufall: () => number) {
  const teile: THREE.BufferGeometry[] = [];
  const beinH = h * 0.34;
  for (const sx of [-1, 1]) {
    const lang = beinH * streuung(zufall, ursprung, 0.12);
    teile.push(teil(new THREE.BoxGeometry(h * 0.06, lang, h * 0.06), dunkel,
      sx * h * 0.09, lang / 2, 0));
  }
  const g = new THREE.IcosahedronGeometry(h * 0.26, 1);
  g.scale(0.85, 1.05, 1.15);
  teile.push(teil(g, hell, 0, beinH + h * 0.26, 0));
  // Der Kopf sitzt bei einem Vogel selten gerade — hier trägt die Streuung am meisten.
  teile.push(teil(new THREE.IcosahedronGeometry(h * 0.13, 0), hell,
    ursprung === 'wildling' ? (zufall() - 0.5) * h * 0.1 : 0, beinH + h * 0.6, -h * 0.08));
  teile.push(teil(new THREE.ConeGeometry(h * 0.05, h * 0.16, 4), dunkel,
    0, beinH + h * 0.58, -h * 0.2, Math.PI / -2));
  // Aufgestellter Fächer — die Silhouette, an der man die Art erkennt
  const faecher = new THREE.CylinderGeometry(h * 0.34, h * 0.1, h * 0.05, 6, 1, false, 0, Math.PI);
  teile.push(teil(faecher, dunkel, 0, beinH + h * 0.34, h * 0.3, Math.PI / 2));
  return teile;
}

/**
 * Die Schlange bekommt keine Streuung — sie hat schon welche.
 *
 * Der Körper liegt auf einer Sinuswelle, also ist kein Glied gespiegelt und keine
 * Seite gleich der anderen. Zusätzlicher Zufall würde die Welle nur unruhig machen,
 * ohne die Aussage „gewachsen" zu verstärken.
 */
function bauSchlange(hell: THREE.Color, dunkel: THREE.Color, h: number) {
  const teile: THREE.BufferGeometry[] = [];
  const glieder = 7, laenge = h * 5.5;
  for (let i = 0; i < glieder; i++) {
    const t = i / (glieder - 1);
    const dicke = h * (1 - 0.55 * t);
    teile.push(teil(new THREE.BoxGeometry(dicke, dicke * 0.8, laenge / glieder), i % 2 ? hell : dunkel,
      Math.sin(t * Math.PI * 2) * h * 0.9, dicke * 0.4, (t - 0.5) * laenge));
  }
  teile.push(teil(new THREE.BoxGeometry(h * 1.1, h * 0.7, h * 1.0), hell, 0, h * 0.4, -laenge * 0.55));
  return teile;
}

/**
 * Farben des Befalls.
 *
 * Aus der Stilreferenz: Was wächst, ist Pilz und Flechte — Ocker und helles Beige
 * für die Hüte, gedämpftes Graugrün für Moos. Die Signalfarbe erscheint **nur** als
 * Punkt und nie am Tier selbst.
 */
const PILZ_HELL = new THREE.Color(PALETTE.befall.pilzHell);
const PILZ_DUNKEL = new THREE.Color(PALETTE.befall.pilzDunkel);
const SIGNAL = new THREE.Color(PALETTE.befall.signal);

/**
 * Der Pilzfächer — das Leitmerkmal.
 *
 * Aus `docs/design/BRACHLAND_Stilreferenz_v1.md`: Alle Linien tragen einen Fächer aus
 * Baumpilzen an der Hinterhand, der mit jeder Mutation wächst, bis er auf Stufe 3
 * fast so groß ist wie das Tier. Das ist das eine Merkmal, an dem man
 * BRACHLAND-Kreaturen von jedem anderen Creature-Collector unterscheidet — ohne ihn
 * sieht man dem Spiel seine eigene Handschrift nicht an.
 *
 * Gebaut als Reihe überlappender Platten auf einem Halbkreis, jede leicht gedreht.
 * Dazu ein paar Hutpilze und Signalpunkte, deren Zahl mit der Mutation steigt.
 */
function bauFaecher(mutation: number, h: number, ursprung: Ursprung): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  const zufall = mulberry(4711 + mutation * 977);

  /**
   * Größe und Dichte wachsen mit der Mutation: angedeutet, halbe Körperlänge,
   * fast körpergroß.
   *
   * Die Werte waren `0.55 + mutation * 0.42`, also 1,39 × Rig-Höhe auf der
   * höchsten Stufe. Gemessen über alle vier Rigs wuchs die Silhouette damit auf
   * **1,66 × Rig-Höhe**, und die Breite des Vierbeiners von 0,60 auf 1,42 — der
   * Körper wächst nicht mit, das ist alles Fächer. Die Stilreferenz sagt „fast so
   * groß wie das Tier"; im Bild war er größer als das Tier, das ihn trägt, und
   * beim Reiten saß der Reiter auf dem Fächer statt auf dem Rücken.
   *
   * Jetzt 0,46 + 0,34 je Stufe. Der erste Versuch (0,42 + 0,25) traf die Größe,
   * kostete aber die **Staffelung**: Stufe 0 und 1 kamen beide auf 1,03 × Rig-Höhe,
   * weil der Fächer den Körper noch nicht überragte — und genau daran soll man auf
   * Entfernung sehen, wie weit eine Kreatur ist. Gemessen jetzt über alle Rigs:
   * **1,03 → 1,09 → 1,31** in der Höhe, beim Vierbeiner 0,53 → 0,72 → 1,02 in der
   * Breite. Das Leitmerkmal bleibt und wächst sichtbar — es ersetzt die Kreatur
   * nur nicht mehr.
   */
  const spanne = h * (0.46 + mutation * 0.34);
  const lamellen = 5 + mutation * 3;
  // Der Fächer ist Befall, kein Bauteil: An einem Wildling wächst er auf **einer**
  // Flanke, an einer Zuchtlinie sitzt er mittig — dort ist der Körper das Raster,
  // dem auch der Bewuchs folgt. Ein winziger Versatz, aber er entscheidet, ob die
  // Rückenansicht gespiegelt aussieht oder nicht.
  const flanke = ursprung === 'wildling' ? h * 0.11 : 0;

  for (let i = 0; i < lamellen; i++) {
    const t = i / (lamellen - 1);
    // Halbkreis von schräg unten nach schräg oben, hinten am Körper.
    const winkel = -0.35 + t * 2.1;
    const r = spanne * (0.55 + 0.45 * Math.sin(t * Math.PI));
    // Platten kleiner (0,48 statt 0,55): Bei acht überlappenden Lamellen auf der
    // höchsten Stufe entscheidet die Zahl über die Dichte, nicht die Einzelgröße.
    const g = new THREE.CylinderGeometry(r * 0.48, r * 0.08, h * 0.045, 3, 1, false, 0, Math.PI);
    g.rotateX(Math.PI / 2);
    g.rotateZ(winkel - Math.PI / 2);
    g.translate(
      flanke + (zufall() - 0.5) * h * 0.08,
      // Enger am Rücken (0,30 statt 0,35): Der Fächer ist Bewuchs und soll dem
      // Körper folgen, nicht neben ihm stehen.
      h * 0.55 + Math.sin(winkel) * spanne * 0.30,
      /**
       * An die **Hinterhand**, nicht auf die Mitte des Rückens.
       *
       * Die Stilreferenz sagt „ein Fächer aus Baumpilzen an der Hinterhand“; der
       * Wert stand auf `h * 0.35` und ergab gemessen eine Fächermitte bei z =
       * +0,21, während der Körper von −0,82 (Kopf) bis +0,87 (Rute) reicht — das
       * ist Rückenmitte. Aufgefallen ist es erst beim Reiten: Der Reiter sitzt
       * auf dem Rumpf, und der Fächer stand vor ihm statt hinter ihm.
       */
      h * 0.60 + Math.cos(winkel) * spanne * 0.12,
    );
    teile.push(teil(g, i % 2 ? PILZ_HELL : PILZ_DUNKEL, 0, 0, 0));
  }

  // Hutpilze auf dem Rücken. Erst wenige, auf Stufe 3 über den ganzen Rücken.
  const huete = 2 + mutation * 3;
  for (let i = 0; i < huete; i++) {
    const t = i / Math.max(1, huete - 1);
    const g = new THREE.CylinderGeometry(h * 0.075, h * 0.025, h * 0.05, 5);
    g.translate(
      (zufall() - 0.5) * h * 0.22,
      h * (0.72 + zufall() * 0.08),
      h * (0.28 - t * 0.5),
    );
    teile.push(teil(g, PILZ_HELL, 0, 0, 0));
  }

  // Signalpunkte. Sparsam gesetzt — Dutzende, keine Hunderte, und immer als Punkt.
  const punkte = 3 + mutation * 4;
  for (let i = 0; i < punkte; i++) {
    const winkel = -0.3 + zufall() * 2.0;
    const r = spanne * (0.5 + zufall() * 0.45);
    const g = new THREE.TetrahedronGeometry(h * 0.022, 0);
    g.translate(
      (zufall() - 0.5) * h * 0.12,
      h * 0.55 + Math.sin(winkel) * r * 0.4,
      h * 0.35 + Math.cos(winkel) * r * 0.16,
    );
    teile.push(teil(g, SIGNAL, 0, 0, 0));
  }
  return teile;
}

/**
 * Baut die Silhouette einer Kreatur. Blickrichtung -Z, wie bei der Spielerfigur.
 * Das Ergebnis ist auf die reale Höhe der Bauform normiert.
 *
 * `mutation` (0…2) steuert den Befall: Größe des Fächers, Zahl der Hüte und Punkte.
 */
export function baueKreaturGeometrie(
  basisRig: string, elemente: Element[], mutation = 0,
  /**
   * Herkunft. Steuert die Bauweise (siehe oben) und ist bewusst **das letzte**
   * Argument mit Vorgabe `wildling`: Alle bestehenden Aufrufe liefern damit
   * weiterhin die zwölf Wildlinge, und nur wer eine Herkunft kennt, gibt sie an.
   */
  ursprung: Ursprung = 'wildling',
  /**
   * Streu-Seed. Je Linie fest, damit ein Wildling über Sitzungen hinweg dieselbe
   * Schiefe behält — sonst stünde dieselbe Kreatur in jedem Ladevorgang anders da.
   */
  seed = 0,
): THREE.BufferGeometry {
  const r = rig(basisRig);
  const h = RIG_HOEHE[r];
  const hell = new THREE.Color(ELEMENT_FARBE[elemente[0]] ?? PALETTE.element.hell);
  // Zweites Element färbt die Akzente — Doppeltypen sind so auf Distanz erkennbar.
  const dunkel = new THREE.Color(ELEMENT_FARBE[elemente[1] ?? elemente[0]] ?? PALETTE.element.dunkel)
    .multiplyScalar(0.62);
  const zufall = mulberry(1009 + seed * 7919);

  const teile = r === 'biped_bird' ? bauVogel(hell, dunkel, h, ursprung, zufall)
    : r === 'serpent' ? bauSchlange(hell, dunkel, h)
    : bauQuadruped(hell, dunkel, h, ursprung, zufall);
  teile.push(...bauFaecher(Math.max(0, Math.min(2, mutation)), h, ursprung));

  const g = mergeGeometries(teile, false);
  if (!g) throw new Error(`Kreatursilhouette ${basisRig}: Geometrien nicht zusammenfassbar`);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * Wo ein Reiter auf dieser Silhouette sitzt — **aus der Geometrie gelesen**.
 *
 * ## Warum das nicht `RIG_HOEHE` sein kann
 *
 * `RIG_HOEHE.quadruped` ist eine 1. Die Silhouette eines Vierbeiners bei
 * Mutation 2 ist gemessen **2,28 m** hoch und liegt ausserdem waagerecht
 * versetzt (x −0,75 … 1,24 statt symmetrisch um null). Der Reiter landete damit
 * 0,9 m zu tief und ein Viertelmeter neben dem Tier — im Bild steht er neben
 * seinem Reittier statt darauf. Rückmeldung vom Gerät am 26.08.2026:
 * „haus und reiten soll so aussehen?“
 *
 * Eine Konstante kann das auch gar nicht leisten: Die Gestalt wächst mit der
 * Mutationsstufe, mit dem Element und mit der Saat aus der Kreatur-ID. Was
 * gebraucht wird, ist eine Messung an genau der Geometrie, die gezeichnet wird.
 *
 * ## Wie gemessen wird
 *
 * Der Widerrist ist der höchste Punkt des **mittleren Fünftels** in beiden
 * waagerechten Achsen. Kopf, Rute, Ohren und Pilzfächer liegen ausserhalb, der
 * Rücken liegt darin. Der Versatz ist die Verschiebung, die den Rumpf über den
 * Ursprung holt — ohne sie sitzt der Reiter dort, wo die Kreatur zufällig
 * modelliert wurde, und nicht auf ihr.
 */
export function reitsitz(geo: THREE.BufferGeometry): {
  hoehe: number; versatzX: number; versatzZ: number;
} {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const mx = (bb.min.x + bb.max.x) / 2, mz = (bb.min.z + bb.max.z) / 2;
  const bx = Math.max(0.01, bb.max.x - bb.min.x), bz = Math.max(0.01, bb.max.z - bb.min.z);
  const p = geo.getAttribute('position');
  let hoehe = 0;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(p.getX(i) - mx) > bx * 0.2) continue;
    if (Math.abs(p.getZ(i) - mz) > bz * 0.2) continue;
    hoehe = Math.max(hoehe, p.getY(i));
  }
  // Rückfall, falls das mittlere Fünftel leer ist (sehr schmale Gestalten):
  // 70 % der Gesamthöhe liegt bei jedem der vier Rigs im Rumpfbereich.
  return { hoehe: hoehe > 0 ? hoehe : bb.max.y * 0.7, versatzX: -mx, versatzZ: -mz };
}

/**
 * Chitinplatten-Gehörn — das Merkmal der Grathorn-Linie.
 *
 * Aus `docs/design/BRACHLAND_Stilreferenz_v1.md` und dem Bild
 * `docs/bilder/mutationsstufen_v2.png`: **ein** gebogenes Horn, das aus dem
 * Widerrist wächst, nach hinten geneigt ansetzt und sich zur Spitze aufrichtet.
 * Auf der höchsten Stufe ist es so hoch wie das Tier — genau daran soll man auf
 * Entfernung sehen, wie weit eine Kreatur ist.
 *
 * **Warum ein Anbau und kein neues Modell.** Der Grundkörper kommt aus einem
 * CC0-Tierpack und ist ein Hirsch; sein Hirschgeweih fällt in `kreaturbau.py`
 * weg (1.616 Flächen), und das Merkmal kommt von hier. Das kostet keine neue
 * Datei, wächst mit der Mutationsstufe — was eine gebackene Datei nicht kann —
 * und ist der Prüfstein für alle weiteren Merkmale: Wenn ein Anbau auf einem
 * fremden Grundkörper sitzt, sitzt jeder.
 *
 * Gebaut als Reihe überlappender Kegelstümpfe entlang einer Kurve. Der Überlapp
 * ist das Wesentliche: Jede Platte setzt breiter an, als die vorige aufhört, und
 * genau diese Kante liest auf Entfernung als Platte statt als Rohr.
 */
const CHITIN_HELL = new THREE.Color(PALETTE.chitin.hell);
const CHITIN_DUNKEL = new THREE.Color(PALETTE.chitin.dunkel);

export function baueGehoern(
  /** Ansatzpunkt in Geometriekoordinaten — Widerrist, siehe `widerristPunkt`. */
  anker: THREE.Vector3,
  /** Widerristhöhe desselben Modells. Alle Maße sind Vielfache davon. */
  h: number,
  /** 0…2. Steuert Länge und Zahl der Platten. */
  mutation: number,
  ursprung: Ursprung = 'wildling',
  saat = 0,
): THREE.BufferGeometry {
  const zufall = mulberry(9173 + saat * 31 + mutation * 977);
  /**
   * 0,16 · 0,61 · 1,06 der Widerristhöhe.
   *
   * Abgelesen an der Stilreferenz, nicht gewählt: Dort ist das Horn auf S1 ein
   * Ansatz von rund einem Zehntel der Körperhöhe, auf S2 gut zwei Dritteln und
   * auf S3 etwa körperhoch. Der Sprung von S1 auf S2 ist bewusst der größere —
   * eine Mutation soll man sehen, und der erste Schritt ist der, an dem sich
   * „angedeutet" und „durchgedrungen" unterscheiden.
   */
  const spanne = h * (0.16 + mutation * 0.45);
  const platten = 4 + mutation * 3;
  const teile: THREE.BufferGeometry[] = [];

  // Kurve als Streckenzug: Neigung nach hinten (+Z, die Nase zeigt nach -Z),
  // von 36 Grad am Ansatz auf 6 Grad an der Spitze. Ein Steinbockhorn steht
  // hinten an und richtet sich auf; andersherum sähe es aus wie ein Nashorn.
  let py = anker.y - h * 0.02, pz = anker.z;
  for (let i = 0; i < platten; i++) {
    const t = i / platten;
    const winkel = 0.63 - t * 0.53;
    const schritt = spanne / platten;
    const ny = py + Math.cos(winkel) * schritt;
    const nz = pz + Math.sin(winkel) * schritt;
    // Unten breiter als die vorige Platte oben aufhört: der Überlapp, an dem
    // das Ganze als Platten liest.
    const rU = spanne * 0.155 * (1 - t * 0.80) * streuung(zufall, ursprung, 0.10);
    const rO = spanne * 0.155 * (1 - (t + 1 / platten) * 0.80);
    const g = new THREE.CylinderGeometry(Math.max(rO, spanne * 0.012), rU,
                                         schritt * 1.30, 5, 1, false);
    g.rotateX(winkel);
    teile.push(teil(g, i % 2 ? CHITIN_HELL : CHITIN_DUNKEL,
                    anker.x, (py + ny) / 2, (pz + nz) / 2));
    py = ny; pz = nz;
  }

  // Zwei kleine Platten am Ansatz, ab der zweiten Stufe. Sie machen aus einem
  // aufgesetzten Horn einen gewachsenen Kamm — in der Stilreferenz sitzen auf
  // S3 dieselben Splitter an Schulter und Hinterhand.
  if (mutation >= 1) {
    for (const sx of [-1, 1]) {
      const g = new THREE.ConeGeometry(spanne * 0.055, spanne * 0.22, 4);
      g.rotateX(0.9);
      teile.push(teil(g, CHITIN_DUNKEL,
                      anker.x + sx * h * 0.075, anker.y + spanne * 0.06,
                      anker.z + spanne * 0.10));
    }
  }
  return mergeGeometries(teile, false)!;
}

/**
 * Der Widerrist eines **Modells** — Ansatzpunkt für Anbauten.
 *
 * Nicht dasselbe wie `reitsitz`: Das misst den höchsten Punkt des mittleren
 * Fünftels, also die Rückenmitte, auf die ein Reiter gehört. Ein Gehörn gehört
 * an die Schulter. `tools/kreaturbau.py` normt jedes Modell so, dass der
 * Widerrist auf y = 1 liegt und die Nase nach −Z zeigt; gesucht ist damit nur
 * noch, **wo** entlang der Längsachse er sitzt. Gemessen am Grathorn liegt er
 * bei 40 % der Länge hinter der Nase — Kopf und Hals davor, Rücken dahinter.
 */
export function widerristPunkt(geo: THREE.BufferGeometry): THREE.Vector3 {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const p = geo.getAttribute('position');
  const spanneZ = bb.max.z - bb.min.z, spanneX = bb.max.x - bb.min.x;
  const mx = (bb.min.x + bb.max.x) / 2;
  const a = bb.min.z + spanneZ * 0.30, b = bb.min.z + spanneZ * 0.52;
  let besteY = -Infinity, besteZ = (a + b) / 2;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    if (z < a || z > b) continue;
    if (Math.abs(p.getX(i) - mx) > spanneX * 0.18) continue;
    const y = p.getY(i);
    if (y > besteY) { besteY = y; besteZ = z; }
  }
  return new THREE.Vector3(mx, besteY > -Infinity ? besteY : bb.max.y * 0.9, besteZ);
}

/**
 * Welche Kreatur trägt welches Merkmal als Anbau.
 *
 * Bewusst eine Liste und keine Auswertung von `merkmal` aus `content/creatures`:
 * Dort steht Fließtext („Chitinplatten-Gehörn", „Rindenpanzer", „Linsenauge"),
 * und jedes davon braucht eigene Geometrie. Was hier nicht steht, hat noch
 * keine — und ein stiller Rückfall auf ein falsches Merkmal wäre schlimmer als
 * gar keines.
 */
export const MIT_GEHOERN: ReadonlySet<string> = new Set(['grathorn']);

// ------------------------------------------------------------- Anbauten (D128)

/**
 * Ankerpunkte eines **Modells**, gemessen — nicht gesetzt.
 *
 * Jedes Modell aus `kreaturbau.py` steht mit dem Widerrist auf y ≈ h, der Nase
 * nach −Z und den Füssen auf y = 0. Wo an dieser Gestalt Kopf, Hals, Kruppe und
 * Schwanz sitzen, sagt niemand — man misst es: Scheibe für Scheibe entlang der
 * Längsachse der höchste Punkt. Für **aufrechte** Tiere (der Alpenmurmel steht
 * wie ein Wachposten, Höhe > 1,1 × Länge — der Schwanz zählt zur Länge) läuft dieselbe Messung entlang der
 * Hochachse und nimmt je Scheibe den hintersten Punkt: Der Rücken eines
 * stehenden Murmeltiers ist seine Rückseite, nicht seine Oberseite.
 */
export interface Anker {
  /** Widerristhöhe — alle Anbaumaße sind Vielfache davon. */
  h: number;
  laenge: number;
  breite: number;
  aufrecht: boolean;
  nase: THREE.Vector3;
  kopf: THREE.Vector3;
  hals: THREE.Vector3;
  widerrist: THREE.Vector3;
  kruppe: THREE.Vector3;
  schwanz: THREE.Vector3;
  /** Punkt auf der Rückenlinie, t = 0 an der Nase, 1 am Schwanzende. */
  ruecken: (t: number) => THREE.Vector3;
}

export function messeAnker(geo: THREE.BufferGeometry): Anker {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const p = geo.getAttribute('position');
  const laenge = bb.max.z - bb.min.z, hoehe = bb.max.y - bb.min.y;
  const breite = bb.max.x - bb.min.x;
  const mx = (bb.min.x + bb.max.x) / 2;
  const aufrecht = hoehe > laenge * 1.1;
  const widerrist = widerristPunkt(geo);
  const h = widerrist.y;

  /** Höchster Punkt in einer Scheibe entlang z (liegend) bzw. hinterster entlang y (aufrecht). */
  const scheibe = (t: number): THREE.Vector3 => {
    if (!aufrecht) {
      const z0 = bb.min.z + laenge * (t - 0.03), z1 = bb.min.z + laenge * (t + 0.03);
      let bestY = -Infinity, bestZ = (z0 + z1) / 2;
      for (let i = 0; i < p.count; i++) {
        const z = p.getZ(i); if (z < z0 || z > z1) continue;
        if (Math.abs(p.getX(i) - mx) > breite * 0.25) continue;
        const y = p.getY(i); if (y > bestY) { bestY = y; bestZ = z; }
      }
      return new THREE.Vector3(mx, bestY > -Infinity ? bestY : h, bestZ);
    }
    // Aufrecht: t läuft von oben (Kopf) nach unten (Fuss) über die Höhe.
    const y0 = bb.max.y - hoehe * (t + 0.03), y1 = bb.max.y - hoehe * (t - 0.03);
    let bestZ = -Infinity, bestY = (y0 + y1) / 2;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i); if (y < y0 || y > y1) continue;
      if (Math.abs(p.getX(i) - mx) > breite * 0.25) continue;
      const z = p.getZ(i); if (z > bestZ) { bestZ = z; bestY = y; }
    }
    return new THREE.Vector3(mx, bestY, bestZ > -Infinity ? bestZ : bb.max.z);
  };

  return {
    h, laenge, breite, aufrecht,
    nase: new THREE.Vector3(mx, aufrecht ? bb.max.y * 0.85 : h * 0.7, bb.min.z),
    kopf: scheibe(aufrecht ? 0.08 : 0.10),
    hals: scheibe(aufrecht ? 0.22 : 0.26),
    widerrist,
    kruppe: scheibe(aufrecht ? 0.55 : 0.72),
    schwanz: scheibe(aufrecht ? 0.85 : 0.95),
    ruecken: scheibe,
  };
}

const SIGNALFARBE = new THREE.Color(PALETTE.befall.signal);
const WEISS = new THREE.Color(PALETTE.kenney.colorWhite);
const MOOS = new THREE.Color(PALETTE.attrappe.busch);
const elementFarbe = (e: Element) => new THREE.Color(ELEMENT_FARBE[e] ?? PALETTE.element.hell);

/** Flache Platte/Lamelle: ein flachgedrückter Kegel, Spitze nach +Y. */
function lamelle(laenge: number, breite: number, dicke: number): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(breite / 2, laenge, 3);
  g.translate(0, laenge / 2, 0);
  g.scale(1, 1, dicke / Math.max(1e-6, breite));
  return g;
}

type AnbauBauer = (a: Anker, mutation: number, zufall: () => number) => THREE.BufferGeometry[];

/**
 * Filterkiemen-Kragen (Kiemenbiber): ein Kranz aus Lamellen um den Hals, nach
 * hinten gelegt. 6 · 9 · 12 Lamellen, mit jeder Stufe länger — auf S3 steht der
 * Kragen wie ein Halskrause um den Kopf.
 */
const kragen: AnbauBauer = (a, m, w) => {
  const teile: THREE.BufferGeometry[] = [];
  const n = 6 + 3 * m;
  // Halsachse: unter dem Halsrücken um den halben Körperradius; die Lamellen
  // setzen **auf** der Haut an (Radius 0,45 Breite) und zeigen radial weg.
  const r = a.breite * 0.45;
  const mitte = new THREE.Vector3(a.hals.x, a.hals.y - r * 0.9, a.hals.z);
  const l = a.h * (0.16 + 0.11 * m);
  const farbe = elementFarbe('wasser'), hell = CHITIN_HELL;
  for (let i = 0; i < n; i++) {
    const phi = (i + 0.5) / n * Math.PI * 2;
    // Breite Lamelle (halb so breit wie lang), ein Kragen und keine Nadeln.
    const g = lamelle(l * streuung(w, 'wildling', 0.12), l * 0.5, l * 0.06);
    // Spitze radial nach aussen und 30° nach hinten (+Z; die Nase zeigt nach −Z).
    g.rotateX(0.52);
    g.rotateZ(-phi);
    teile.push(teil(g, i % 2 ? farbe : hell,
                    mitte.x + Math.sin(phi) * r, mitte.y + Math.cos(phi) * r, mitte.z));
  }
  return teile;
};

/**
 * Facetten-Linsenaugen (Linsenuhu): zwei Linsen in der Signalfarbe, in einem
 * dunklen Ring aus Alt-Tech. Sie wachsen von Augen zu Scheinwerfern.
 */
const linsenaugen: AnbauBauer = (a, m) => {
  const teile: THREE.BufferGeometry[] = [];
  const r = a.h * (0.055 + 0.03 * m);
  const ring = elementFarbe('alt-tech');
  for (const sx of [-1, 1]) {
    const x = a.kopf.x + sx * a.breite * 0.22, y = a.kopf.y - a.h * 0.16, z = a.nase.z + a.laenge * 0.06;
    const fassung = new THREE.CylinderGeometry(r * 1.25, r * 1.1, r * 0.5, 8);
    fassung.rotateX(Math.PI / 2);
    teile.push(teil(fassung, ring, x, y, z + r * 0.2));
    const linse = new THREE.IcosahedronGeometry(r, 1);
    linse.scale(1, 1, 0.55);
    teile.push(teil(linse, SIGNALFARBE, x, y, z));
  }
  return teile;
};

/** Sporenfächer (Sporenhahn): der Pilzfächer der Silhouetten, an die Kruppe gesetzt. */
const sporenfaecher: AnbauBauer = (a, m) => {
  const teile = bauFaecher(m, a.h, 'wildling');
  // `bauFaecher` baut für die Silhouette: Rückenhöhe 0,55 h, Hinterhand bei +0,60 h.
  for (const g of teile) g.translate(0, a.kruppe.y - a.h * 0.72, a.kruppe.z - a.h * 0.60);
  return teile;
};

/**
 * Erdpilz-Rückenpolster (Alpenmurmel): flache Kuppen über den Rücken, Moos
 * dazwischen. Der Murmel steht aufrecht — sein Rücken ist seine Rückseite.
 */
const rueckenpolster: AnbauBauer = (a, m, w) => {
  const teile: THREE.BufferGeometry[] = [];
  const n = 3 + 3 * m;
  for (let i = 0; i < n; i++) {
    const t = 0.30 + 0.55 * (i + 0.5) / n;
    const pkt = a.ruecken(t);
    const r = a.h * (0.09 + 0.05 * m) * streuung(w, 'wildling', 0.2);
    const kuppe = new THREE.SphereGeometry(r, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.55);
    kuppe.scale(1, 0.6, 1);
    if (a.aufrecht) kuppe.rotateX(Math.PI / 2);   // Kuppe zeigt nach hinten
    const x = pkt.x + (w() - 0.5) * a.breite * 0.5;
    teile.push(teil(kuppe, i % 3 === 2 ? MOOS : PILZ_DUNKEL, x, pkt.y, pkt.z));
  }
  return teile;
};

/**
 * Frostkristall-Fell (Firnhase): Kristalle als Doppelkegel über Rücken und
 * Ohren, mit jeder Stufe mehr und länger.
 */
const frostkristalle: AnbauBauer = (a, m, w) => {
  const teile: THREE.BufferGeometry[] = [];
  const n = 4 + 4 * m, frost = elementFarbe('frost');
  for (let i = 0; i < n; i++) {
    const t = 0.15 + 0.75 * (i + 0.3 * w()) / n;
    const pkt = a.ruecken(t);
    const l = a.h * (0.10 + 0.07 * m) * streuung(w, 'wildling', 0.25);
    const g = new THREE.OctahedronGeometry(l * 0.35, 0);
    g.scale(0.5, 1.6, 0.5);
    g.rotateX((w() - 0.5) * 0.8); g.rotateZ((w() - 0.5) * 0.8);
    teile.push(teil(g, i % 2 ? WEISS : frost, pkt.x + (w() - 0.5) * a.breite * 0.5, pkt.y + l * 0.3, pkt.z));
  }
  return teile;
};

/**
 * Fäulnisdrüse (Moderotter): geschwollene Drüsen an den Flanken, jede mit
 * einem Signalpunkt. Sie sind das Einzige an diesem Tier, das leuchtet.
 */
const faeulnisdruesen: AnbauBauer = (a, m, w) => {
  const teile: THREE.BufferGeometry[] = [];
  const n = 2 + 2 * m, dunkel = elementFarbe('faeulnis');
  for (let i = 0; i < n; i++) {
    const t = 0.25 + 0.6 * (i + 0.5) / n;
    const pkt = a.ruecken(t);
    const sx = i % 2 ? 1 : -1;
    const r = a.h * (0.16 + 0.08 * m) * streuung(w, 'wildling', 0.2);
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(0.8, 0.7, 1);
    const x = pkt.x + sx * a.breite * 0.42, y = pkt.y - a.h * 0.35;
    teile.push(teil(g, dunkel, x, y, pkt.z));
    teile.push(teil(new THREE.IcosahedronGeometry(r * 0.28, 0), SIGNALFARBE, x + sx * r * 0.7, y + r * 0.3, pkt.z));
  }
  return teile;
};

/**
 * Leuchtmyzel-Adern (Myzelmolch): Stränge in der Signalfarbe, die dem Rücken
 * folgen und sich mit jeder Stufe verzweigen.
 */
const leuchtadern: AnbauBauer = (a, m, w) => {
  const teile: THREE.BufferGeometry[] = [];
  const straenge = 1 + m, glieder = 7;
  for (let s = 0; s < straenge; s++) {
    const seite = (s % 2 ? 1 : -1) * (s === 0 ? 0 : 1);
    for (let i = 0; i < glieder; i++) {
      const t0 = 0.2 + 0.7 * i / glieder, t1 = 0.2 + 0.7 * (i + 1) / glieder;
      const p0 = a.ruecken(t0), p1 = a.ruecken(t1);
      const x0 = seite * a.breite * (0.18 + 0.15 * Math.sin(i * 1.7 + s));
      const x1 = seite * a.breite * (0.18 + 0.15 * Math.sin((i + 1) * 1.7 + s));
      const r = a.h * (0.035 + 0.012 * m) * streuung(w, 'wildling', 0.15);
      const von = new THREE.Vector3(p0.x + x0, p0.y + r, p0.z), bis = new THREE.Vector3(p1.x + x1, p1.y + r, p1.z);
      const l = von.distanceTo(bis);
      const g = new THREE.CylinderGeometry(r, r, l * 1.15, 4);
      // Zylinder steht auf +Y; auf die Strecke von→bis drehen.
      const richtung = bis.clone().sub(von).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), richtung);
      g.applyQuaternion(q);
      const mitte = von.clone().add(bis).multiplyScalar(0.5);
      teile.push(teil(g, i % 3 === 1 ? PILZ_HELL : SIGNALFARBE, mitte.x, mitte.y, mitte.z));
    }
  }
  return teile;
};

/**
 * Frostfeder-Fächer (Schneehuhn): ein Fächer aus Federn am Hinterkopf und am
 * Stoss, weiss mit Frost — die Balz eines Tieres, das im Schnee unsichtbar
 * sein will und es auf S3 nicht mehr ist.
 */
const federfaecher: AnbauBauer = (a, m, w) => {
  const teile: THREE.BufferGeometry[] = [];
  const n = 5 + 2 * m, frost = elementFarbe('frost');
  for (const [anker, richtung, spanne] of [[a.kopf, -1, 0.9], [a.schwanz, 1, 1.2]] as const) {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const winkel = (t - 0.5) * spanne * 1.6;
      const l = a.h * (0.14 + 0.08 * m) * streuung(w, 'wildling', 0.15);
      const g = lamelle(l, l * 0.3, l * 0.05);
      // Fächer öffnet sich quer (um die Längsachse), Federn leicht nach hinten/vorn.
      g.rotateX(richtung * 0.9);
      g.rotateZ(winkel);
      teile.push(teil(g, i % 2 ? WEISS : frost, anker.x, anker.y, anker.z + richtung * a.h * 0.05));
    }
  }
  return teile;
};

/**
 * Trafostation-Verwachsung (Trafomarder): ein Gehäuse mit Kühlrippen auf dem
 * Rücken und ein Isolator mit Signalspitze. Mit jeder Stufe eine Rippe mehr
 * und ein grösseres Gehäuse — die Station wächst, das Tier nicht.
 */
const trafoverwachsung: AnbauBauer = (a, m) => {
  const teile: THREE.BufferGeometry[] = [];
  const f = 1 + 0.35 * m, tech = elementFarbe('alt-tech'), dunkel = CHITIN_DUNKEL;
  const pkt = a.ruecken(0.5);
  const b = a.h * 0.28 * f, hh = a.h * 0.22 * f, tiefe = a.h * 0.34 * f;
  teile.push(teil(new THREE.BoxGeometry(b, hh, tiefe), tech, pkt.x, pkt.y + hh * 0.35, pkt.z));
  const rippen = 3 + m;
  for (let i = 0; i < rippen; i++) {
    const z = pkt.z - tiefe * 0.4 + tiefe * 0.8 * (i + 0.5) / rippen;
    teile.push(teil(new THREE.BoxGeometry(b * 1.25, hh * 0.7, tiefe * 0.06), dunkel, pkt.x, pkt.y + hh * 0.4, z));
  }
  // Isolator: Stab mit Ringen und Signalspitze, vorn auf dem Gehäuse.
  const stab = a.h * (0.25 + 0.12 * m);
  teile.push(teil(new THREE.CylinderGeometry(a.h * 0.02, a.h * 0.025, stab, 5), dunkel, pkt.x + b * 0.25, pkt.y + hh * 0.85 + stab / 2, pkt.z - tiefe * 0.25));
  teile.push(teil(new THREE.CylinderGeometry(a.h * 0.05, a.h * 0.05, a.h * 0.03, 6), tech, pkt.x + b * 0.25, pkt.y + hh * 0.85 + stab * 0.6, pkt.z - tiefe * 0.25));
  teile.push(teil(new THREE.IcosahedronGeometry(a.h * 0.035, 0), SIGNALFARBE, pkt.x + b * 0.25, pkt.y + hh * 0.85 + stab, pkt.z - tiefe * 0.25));
  return teile;
};

/** Das Gehörn des Grathorn, in derselben Form wie die anderen Anbauten. */
const gehoern: AnbauBauer = (a, m, w) => [baueGehoern(a.widerrist, a.h, m, 'wildling', Math.floor(w() * 1000))];

/**
 * Welche Kreatur trägt welches Merkmal als Anbau (D109, D128).
 *
 * Bewusst eine Liste und keine Auswertung von `merkmal` aus `content/creatures`:
 * Dort steht Fließtext, und jedes Merkmal braucht eigene Geometrie. Was hier
 * nicht steht, hat noch keine — ein stiller Rückfall auf ein falsches Merkmal
 * wäre schlimmer als gar keines. Wolf, Fuchs, Gams und Keiler tragen ihr
 * Merkmal (Fell, Witterung, Nebel, Wurzeln) nicht als Bauteil.
 */
const ANBAUTEN: Record<string, AnbauBauer> = {
  grathorn: gehoern,
  kiemenbiber: kragen,
  linsenuhu: linsenaugen,
  sporenhahn: sporenfaecher,
  alpenmurmel: rueckenpolster,
  firnhase: frostkristalle,
  moderotter: faeulnisdruesen,
  myzelmolch: leuchtadern,
  schneehuhn: federfaecher,
  trafomarder: trafoverwachsung,
};
export const MIT_ANBAU: ReadonlySet<string> = new Set(Object.keys(ANBAUTEN));

/**
 * Anbau für ein Modell, an dessen gemessenen Ankern, als eine Geometrie mit
 * Position und Farbe — ohne Normalen und UV, damit `mergeGeometries` sie mit
 * dem Modell (D107: keine Normalen) zusammenlegen kann.
 */
export function baueAnbau(kreatur: string, koerper: THREE.BufferGeometry, mutation: number, saat = 0): THREE.BufferGeometry | null {
  const bauer = ANBAUTEN[kreatur];
  if (!bauer) return null;
  const anker = messeAnker(koerper);
  const teile = bauer(anker, mutation, mulberry(9173 + saat * 31 + mutation * 977));
  const g = mergeGeometries(teile, false);
  if (!g) return null;
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  return g;
}
