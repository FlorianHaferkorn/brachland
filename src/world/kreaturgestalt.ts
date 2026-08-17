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
  holz:      '#4a5c33',
  stein:     '#6e7276',
  'alt-tech': '#5a6b74',
  sporen:    '#6f9c6a',
  wasser:    '#3f6672',
  brand:     '#7a4a33',
  frost:     '#8fa6ad',
  faeulnis:  '#5c5238',
};

export type BasisRig = 'quadruped' | 'quadruped_small' | 'biped_bird' | 'serpent';

/**
 * Widerristhöhe je Bauform in Metern.
 *
 * Aus den realen Vorbildern: Steinbock und Wildschwein ~1 m, Fuchs und Salamander
 * deutlich darunter, Auerhahn aufgerichtet ~0,85 m, Kreuzotter liegt flach.
 * Maßstabstreue ist der Grund, warum das Projekt überhaupt 3D ist.
 */
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
const PILZ_HELL = new THREE.Color('#c9b389');
const PILZ_DUNKEL = new THREE.Color('#9a8560');
const SIGNAL = new THREE.Color('#cfe9f2');

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

  // Größe und Dichte wachsen mit der Mutation: angedeutet, halbe Körperlänge, fast körpergroß.
  const spanne = h * (0.55 + mutation * 0.42);
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
    const g = new THREE.CylinderGeometry(r * 0.55, r * 0.08, h * 0.045, 3, 1, false, 0, Math.PI);
    g.rotateX(Math.PI / 2);
    g.rotateZ(winkel - Math.PI / 2);
    g.translate(
      flanke + (zufall() - 0.5) * h * 0.08,
      h * 0.55 + Math.sin(winkel) * spanne * 0.35,
      h * 0.35 + Math.cos(winkel) * spanne * 0.12,
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
  const hell = new THREE.Color(ELEMENT_FARBE[elemente[0]] ?? '#5a6058');
  // Zweites Element färbt die Akzente — Doppeltypen sind so auf Distanz erkennbar.
  const dunkel = new THREE.Color(ELEMENT_FARBE[elemente[1] ?? elemente[0]] ?? '#3a403a')
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
