/**
 * BRACHLAND — Klippen und Felsbänder
 *
 * Das Gelände kommt jetzt aus dem 1-Meter-Modell und ist damit **geometrisch**
 * richtig. Es sieht trotzdem weich aus, und der Grund ist nicht die Auflösung: Ein
 * Höhenraster kann per Bauart keinen Überhang, keine senkrechte Wand und keine
 * scharfe Abrisskante. Jede Zelle hat genau eine Höhe. Eine echte Felswand ist aber
 * genau das — mehrere Höhen über derselben Grundfläche.
 *
 * Deshalb werden Klippen **aufgesetzt** statt aus dem Raster geschnitzt: Wo das
 * Gelände über einen Schwellwert steil wird, steht eine Felsplatte in der Falllinie.
 * Sie ist keine Verschönerung, sie ist die einzige Möglichkeit, eine Wand zu bekommen.
 *
 * Bewusst nicht gemacht: das Terrain selbst aufzuschneiden. Das bräuchte ein
 * Voxel- oder Mesh-Verfahren, würde LOD, Kollision und Höhenabfrage gleichzeitig
 * brechen — und alles davon funktioniert gerade.
 */
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import type { HoehenFeld } from './lod.js';
import { mulberry } from './props.js';

/**
 * Wie viele verschiedene Wände es gibt.
 *
 * Jede Variante ist ein eigener Draw Call, und Draw Calls sind die Größe, an der
 * diese Szene hängt (G-104: gemessen 254–353 im Bild). Drei waren zu wenig für
 * 4.019 Wände — bei der Dichte sieht man die Wiederholung. Fünf kosten zwei
 * Aufrufe mehr, also unter einem Prozent.
 */
export const KLIPPEN_VARIANTEN = 5;

/** Eine Ecke im Grundriss, in Einheiten der Instanzskalierung. */
interface Ecke { x: number; z: number }

/**
 * Ein Körper zwischen zwei Grundrissen.
 *
 * Der erste Versuch am 26.08.2026 zog **einen** Grundriss senkrecht hoch und
 * setzte einen flachen Deckel darauf. Im Rendering war das ein Stapel weißer
 * Kisten, und der Grund ist Licht, nicht Umriss: Bei einer senkrechten
 * Extrusion steht jede Seitenfläche lotrecht, alle bekommen denselben
 * Einfallswinkel, und die Form verschwindet in einer einzigen Helligkeit.
 * Zwei verschiedene Grundrisse — oben kleiner, verschoben und verdreht — kippen
 * jede Seitenfläche einzeln, und erst dann trennt das Licht sie voneinander.
 *
 * Der Deckel ist kein Deckel, sondern ein **First**: Der Mittelpunkt des oberen
 * Grundrisses wird angehoben. Das kostet kein Dreieck (der Fächer war ohnehin
 * da) und nimmt der Silhouette die waagerechte Oberkante, die eine Kiste
 * ausmacht.
 *
 * Der Umlaufsinn wird **gerechnet, nicht gesetzt** — dieselbe Vorsichtsmaßnahme
 * wie in `world/fernland.ts`, wo eine von Hand gewählte Reihenfolge einen halben
 * Tag lang eine unsichtbare Geometrie ergeben hat (G-106).
 *
 * **Keine Bodenfläche.** Die Wand steckt zu 35 % im Hang (`findeKlippen` setzt
 * `y = h - hoehe * 0.35`), und die Bänke sitzen ineinander. Was unten liegt,
 * sieht niemand.
 */
function koerper(
  unten: Ecke[], oben: Ecke[], yUnten: number[], yOben: number[], first: number,
  pos: number[], col: number[], farbe: [number, number, number], streu: () => number,
) {
  const n = unten.length;
  const mx = oben.reduce((a, e) => a + e.x, 0) / n;
  const mz = oben.reduce((a, e) => a + e.z, 0) / n;

  /** Dreieck, dessen Normale in Richtung `rx, ry, rz` zeigt. */
  const nach = (
    a: [number, number, number], b: [number, number, number], c: [number, number, number],
    rx: number, ry: number, rz: number,
  ) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const drei = nx * rx + ny * ry + nz * rz < 0 ? [a, c, b] : [a, b, c];
    // Streuung je Fläche, nicht je Vertex — sonst verläuft die Farbe über die
    // Kante und die Flachschattierung verliert genau das, wofür sie da ist.
    const s = 0.84 + streu() * 0.32;
    for (const v of drei) {
      pos.push(v[0], v[1], v[2]);
      col.push(farbe[0] * s, farbe[1] * s, farbe[2] * s);
    }
  };

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const au: [number, number, number] = [unten[i].x, yUnten[i], unten[i].z];
    const bu: [number, number, number] = [unten[j].x, yUnten[j], unten[j].z];
    const ao: [number, number, number] = [oben[i].x, yOben[i], oben[i].z];
    const bo: [number, number, number] = [oben[j].x, yOben[j], oben[j].z];
    const rx = (unten[i].x + unten[j].x) / 2 - mx;
    const rz = (unten[i].z + unten[j].z) / 2 - mz;
    nach(au, bu, bo, rx, 0, rz);
    nach(au, bo, ao, rx, 0, rz);
    nach([mx, first, mz], ao, bo, 0, 1, 0);
  }
}

/** Ab dieser Neigung in Grad gilt ein Hang als Klippe. */
export const KLIPPE_AB_GRAD = 41;
/** Abstand der Prüfpunkte in Metern. Feiner heißt mehr Wände und mehr Dreiecke. */
const RASTER = 14;

export interface Klippe {
  /** Mittelpunkt am Fuß der Wand. */
  position: [number, number, number];
  /** Höhe der Wand in Metern. */
  hoehe: number;
  /** Breite quer zur Falllinie. */
  breite: number;
  /** Drehung um Y, sodass die Platte im Hang steht. */
  drehung: number;
  variante: number;
}

/**
 * Findet Klippen im Höhenfeld.
 *
 * Die Neigung wird über zwei Meter Abstand gemessen, nicht über einen — bei einem
 * 1-m-Modell ist ein einzelner Nachbar Rauschen, zwei sind eine Kante.
 *
 * ## Warum die Auswahl nicht mehr gewürfelt wird
 *
 * Bis zum 26.08.2026 stand hier `if (zufall() > 0.55) continue` mit der
 * Begründung „sonst wird der Hang zur Mauer". Im Rendering eines echten
 * Ausschnitts war das Ergebnis das Gegenteil einer Mauer und schlimmer:
 * **65 einzelne Steine auf einer glatten Wiese, gleichmäßig verstreut** — ein
 * Feld von Menhiren, kein Fels. Ein Würfel je Zelle löscht genau das, was Fels
 * ausmacht, nämlich den Zusammenhang: In einer Kalkflanke steht Fels in Bändern
 * entlang der Falllinie, nicht als Einzelstück alle 14 m.
 *
 * Jetzt entscheidet die **Nachbarschaft**: Eine Zelle bekommt nur dann eine
 * Wand, wenn mindestens zwei ihrer vier Nachbarn ebenfalls über der Schwelle
 * liegen. Das löscht die Einzelgänger und lässt die Bänder stehen — und es ist
 * deterministisch, also unabhängig davon, in welcher Reihenfolge gewürfelt wird.
 * Zusammen mit der größeren Breite (10–22 m auf 14 m Raster) überlappen
 * benachbarte Wände und bilden eine durchgehende Wand statt einer Perlenkette.
 */
export function findeKlippen(
  feld: HoehenFeld, hoeheAn: (x: number, z: number) => number, seed = 3,
): Klippe[] {
  const zufall = mulberry(seed);
  const raus: Klippe[] = [];
  const halbB = feld.breiteMeter / 2, halbT = feld.tiefeMeter / 2;

  const spalten = Math.floor((halbB * 2 - 2 * RASTER) / RASTER);
  const reihen = Math.floor((halbT * 2 - 2 * RASTER) / RASTER);
  const xVon = (i: number) => -halbB + RASTER + i * RASTER;
  const zVon = (j: number) => -halbT + RASTER + j * RASTER;

  /** Neigung je Zelle, einmal gerechnet — die Nachbarschaftsprüfung liest sie mehrfach. */
  const grade = new Float32Array(spalten * reihen);
  const gefaelleX = new Float32Array(spalten * reihen);
  const gefaelleZ = new Float32Array(spalten * reihen);
  for (let i = 0; i < spalten; i++)
    for (let j = 0; j < reihen; j++) {
      const x = xVon(i), z = zVon(j);
      const hx = hoeheAn(x + 2, z) - hoeheAn(x - 2, z);
      const hz = hoeheAn(x, z + 2) - hoeheAn(x, z - 2);
      const k = i * reihen + j;
      gefaelleX[k] = hx; gefaelleZ[k] = hz;
      grade[k] = Math.atan(Math.hypot(hx, hz) / 4) * 180 / Math.PI;
    }

  const steil = (i: number, j: number) =>
    i >= 0 && j >= 0 && i < spalten && j < reihen && grade[i * reihen + j] >= KLIPPE_AB_GRAD;

  for (let i = 0; i < spalten; i++)
    for (let j = 0; j < reihen; j++) {
      if (!steil(i, j)) continue;
      const nachbarn = Number(steil(i - 1, j)) + Number(steil(i + 1, j))
                     + Number(steil(i, j - 1)) + Number(steil(i, j + 1));
      if (nachbarn < 2) continue;

      const k = i * reihen + j;
      const x = xVon(i), z = zVon(j);
      const h = hoeheAn(x, z);
      const grad = grade[k];
      // Falllinie: Die Wand steht quer dazu, mit dem Rücken zum Berg.
      const richtung = Math.atan2(gefaelleX[k], gefaelleZ[k]);
      // Höhe der Wand aus dem Gefälle: steiler heißt höher, gedeckelt bei 14 m.
      const hoehe = Math.min(14, 2.5 + (grad - KLIPPE_AB_GRAD) * 0.5 + zufall() * 3);
      raus.push({
        position: [x + (zufall() - 0.5) * RASTER * 0.5,
                   h - hoehe * 0.35,
                   z + (zufall() - 0.5) * RASTER * 0.5],
        hoehe,
        // Breiter als das Raster, damit Nachbarn ineinandergreifen. Darunter
        // stehen sie einzeln und das Band zerfällt wieder in Steine.
        breite: 10 + zufall() * 12,
        drehung: richtung + (zufall() - 0.5) * 0.4,
        variante: Math.floor(zufall() * KLIPPEN_VARIANTEN),
      });
    }
  return raus;
}

/**
 * Geometrie einer Felswand.
 *
 * ## Was vorher fehlte
 *
 * Bis zum 26.08.2026 waren es 3–4 gekippte `BoxGeometry`, 36–48 Dreiecke. Das
 * Problem war dasselbe wie bei den Häusern (D84): nicht zu wenig Unterteilung,
 * sondern **fehlende Teile**. Und der erste Ersatz — senkrechte Prismen über
 * unregelmäßigem Grundriss — war im Rendering keinen Deut besser, weil er den
 * eigentlichen Grund nicht traf: Lotrechte Flächen bekommen alle denselben
 * Lichteinfall. Ob ihr Grundriss vier oder sieben Ecken hat, sieht man erst,
 * wenn sie **verschieden geneigt** sind.
 *
 * ## Was jetzt drin ist
 *
 * **Verjüngte, gescherte, verdrehte Bänke.** Jede Bank hat einen eigenen oberen
 * Grundriss: 55–78 % des unteren, seitlich versetzt und um einen halben
 * Eckenabstand verdreht. Damit ist keine Seitenfläche mehr lotrecht und keine
 * parallel zur nächsten — das Licht trennt sie.
 *
 * **Ein First statt eines Deckels.** Der Mittelpunkt der Oberseite wird
 * angehoben. Kostet kein Dreieck und nimmt der Silhouette die waagerechte
 * Oberkante, an der man eine Kiste erkennt.
 *
 * **Zwei bis drei Bänke statt vier.** Wenige große Formen lesen sich als Fels,
 * viele gleich große als Stapel. Die oberste läuft am stärksten spitz zu.
 *
 * **Eine Kluft.** Eine Ecke je Bank sitzt auf halbem Radius — die senkrechte
 * Rinne, an der Kalk bricht. Sie wandert von Bank zu Bank, sonst wäre es eine
 * durchgehende Nut und damit wieder ein Muster.
 *
 * **Schutt.** Fünf bis sieben flache, spitz zulaufende Blöcke am Fuß, außerhalb
 * des Wandgrundrisses, in einem eigenen schmutzigeren Ton. Der billigste Teil
 * und der, der am meisten bringt: Eine Wand ohne ihren eigenen Abtrag sieht
 * aufgeklebt aus.
 *
 * ## Was es kostet
 *
 * 36–48 → rund 110–140 Dreiecke je Wand. Gezeichnet wird instanziert, ein
 * Aufruf je Variante, und nur innerhalb von 320 m (`KLIPPEN_SICHT`). Gemessen
 * über 1.640 Standorte à 100 m: **Median 4.587, p95 26.895, max 45.342**
 * Dreiecke im Sichtkreis — gegen 276.000 im schlechtesten gemessenen Bild
 * (G-104) derselbe Handel wie bei den Häusern.
 */
export function baueKlippenGeometrie(variante: number): THREE.BufferGeometry {
  const zufall = mulberry(1000 + variante * 7919);
  const pos: number[] = [];
  const col: number[] = [];

  /**
   * Palette als Hexwerte durch `THREE.Color` — **nicht** als Bruchteile der
   * Hexbytes.
   *
   * Genau das stand hier zuerst: `#5f6469` wurde zu (0.373, 0.392, 0.412), weil
   * 0x5f/255 = 0,373. Vertexfarben liegen aber im linearen Arbeitsraum, und
   * `THREE.Color` rechnet beim Setzen von sRGB dorthin um — derselbe Wert ist
   * linear (0.117, 0.132, 0.152). Der Unterschied ist Faktor 2,7: Im Rendering
   * saßen kalkweiße Blöcke auf schiefergrauem Fels, obwohl beide dieselbe Farbe
   * tragen sollten. `terrain.ts` gibt dem Biom `fels` genau `#6b6f72`.
   */
  const zuRGB = (hex: string): [number, number, number] => {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
  };
  const FELS = [PALETTE.fels.a, PALETTE.fels.b, PALETTE.fels.c].map(zuRGB);
  /** Schutt ist schmutziger als die Wand — Abtrag trägt Erde und Flechte. */
  const SCHUTT = zuRGB(PALETTE.fels.schutt);

  /**
   * Grundriss: sternförmig um die Mitte, eine Ecke als Kluft eingezogen.
   *
   * In z gestaucht, weil eine Wand breiter als tief ist — zusammen mit der
   * Instanzskalierung (z × 0,6) ergibt das eine Platte, keine Säule.
   */
  /**
   * Grundriss aus vorgegebenen Radien — sternförmig um die Mitte.
   *
   * Die Radien werden **einmal je Bank** gewürfelt und für Ober- und Unterseite
   * wiederverwendet. Der erste Versuch würfelte beide unabhängig, und dann traf
   * ein Eckpunkt auf volle Länge einen gegenüber auf halber — das ergibt dünne
   * Klingen, die aus der Silhouette stechen und wie Glasscherben aussehen, nicht
   * wie Fels. Was die Flächen kippt, ist die **Verdrehung**, nicht ein zweiter
   * Würfelwurf.
   *
   * In z gestaucht, weil eine Wand breiter als tief ist — zusammen mit der
   * Instanzskalierung (z × 0,6) ergibt das eine Platte, keine Säule.
   */
  const grundriss = (
    radien: number[], mass: number, dreh: number, vx = 0, vz = 0,
  ): Ecke[] =>
    radien.map((r, i) => {
      const w = dreh + (i / radien.length) * Math.PI * 2;
      return { x: Math.cos(w) * r * mass + vx, z: Math.sin(w) * r * mass * 0.62 + vz };
    });

  /** Radien einer Bank: leichte Schwankung, eine Ecke als Kluft eingezogen. */
  const radienFuer = (ecken: number) => {
    const kluft = Math.floor(zufall() * ecken);
    return Array.from({ length: ecken },
      (_, i) => (0.86 + zufall() * 0.28) * (i === kluft ? 0.68 : 1));
  };

  const baenke = 2 + Math.floor(zufall() * 2);
  let unten = 0;
  for (let i = 0; i < baenke; i++) {
    const ecken = 5 + Math.floor(zufall() * 3);
    const oberste = i === baenke - 1;
    const rUnten = 0.5 * (0.96 - i * 0.10);
    const hoch = (1 / baenke) * (0.9 + zufall() * 0.3);
    const dreh = zufall() * Math.PI * 2;
    const radien = radienFuer(ecken);

    const uEcken = grundriss(radien, rUnten, dreh);
    // Oberseite: dieselben Radien, nur kleiner, seitlich versetzt und um ein
    // Viertel Eckenabstand verdreht. Die Verdrehung kippt jede Seitenfläche
    // einzeln — ohne sie wäre es ein Kegelstumpf und das Licht träfe alle
    // Flächen gleich, genau der Fehler der ersten Fassung.
    const oEcken = grundriss(
      radien, rUnten * (oberste ? 0.76 + zufall() * 0.12 : 0.86 + zufall() * 0.10),
      dreh + Math.PI / (ecken * 2),
      (zufall() - 0.5) * rUnten * 0.72, (zufall() - 0.5) * rUnten * 0.34,
    );

    // Bänke greifen um ein Viertel ineinander, sonst klafft an der Fuge Licht
    // durch, sobald die obere Bank an einer Stelle schmaler ist als die untere.
    const yU = uEcken.map(() => unten - (i > 0 ? hoch * 0.25 : 0));
    // Krone: oben am stärksten gebrochen. Unten kaum — diese Kanten
    // verschwinden ohnehin unter der nächsten Bank.
    const bruch = oberste ? 0.30 : 0.12;
    const yO = oEcken.map(() => unten + hoch * (1 - zufall() * bruch));
    const first = unten + hoch * (1 + (oberste ? 0.05 + zufall() * 0.09 : 0.02));

    koerper(uEcken, oEcken, yU, yO, first, pos, col, FELS[i % FELS.length], zufall);
    unten += hoch;
  }

  const bloecke = 5 + Math.floor(zufall() * 3);
  for (let i = 0; i < bloecke; i++) {
    const w = zufall() * Math.PI * 2;
    const weg = 0.40 + zufall() * 0.34;
    const gross = 0.11 + zufall() * 0.10;
    const vx = Math.cos(w) * weg, vz = Math.sin(w) * weg * 0.7;
    const dreh = zufall() * Math.PI * 2;
    const radien = radienFuer(5);
    const u = grundriss(radien, gross, dreh, vx, vz);
    const o = grundriss(radien, gross * 0.72, dreh + Math.PI / 10,
                        vx + (zufall() - 0.5) * gross * 0.6,
                        vz + (zufall() - 0.5) * gross * 0.6);
    // Unterhalb des Wandfußes ansetzen: Der Schutt liegt am Hang, nicht auf
    // einem Sockel, und die Instanz steckt ohnehin 35 % im Boden. Flach, weil
    // Abtrag sich legt und nicht steht.
    const fuss = -0.08 - zufall() * 0.06;
    const kopf = fuss + gross * (0.5 + zufall() * 0.5);
    koerper(u, o, u.map(() => fuss), o.map(() => kopf - gross * zufall() * 0.3),
            kopf + gross * 0.12, pos, col, SCHUTT, zufall);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // Fels schwingt nicht. Das Attribut muss trotzdem da sein: Es teilt sich das
  // Material mit den Props, und ein fehlendes Attribut ergibt dort Müll.
  g.setAttribute('aWind', new THREE.BufferAttribute(new Float32Array(pos.length / 3), 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
