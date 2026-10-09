/**
 * Die Stimmungen (Licht, Nebel, Himmel) als reine Daten (D198, Ledger A-11).
 *
 * Bis D197 standen sie in `src/scenes/RegionsSzene.tsx`. Wer sie lesen wollte — `tools/lichtcheck.ts`
 * —, lud damit die ganze Szene samt `location`, `window` und React-DOM und brach unter Node ab.
 * Hier hängt nichts davon: nur Farben, Zahlen und die Palette. Die Szene importiert von hier und
 * reicht `STIMMUNG` weiter.
 */
import { PALETTE } from './palette.js';

/**
 * Tageszeiten als Schlüsselbilder eines durchgehenden Laufs.
 *
 * Vorher waren es drei Knöpfe, und dazwischen gab es nichts. Ein Sprung von Nacht auf
 * Dämmerung ist aber kein Tageswechsel, sondern ein Schnitt — und die interessanten
 * Zustände liegen genau dazwischen, im Übergang.
 *
 * Der Lauf ist bewusst **kein voller Tag**: Es gibt keinen Mittag. Die Art Direction
 * steht auf Dämmerung, Nebel und Silhouetten; Mittagssonne verzeiht nichts und würde
 * jede Schwäche der Geometrie zeigen. Der Zyklus läuft deshalb
 * Nacht → Morgengrauen → Nebelmorgen → Abendrot → Nacht.
 *
 * **Farbvokabular.** Jeder Schlüssel benutzt dieselben vier Rollen und nichts
 * darüber hinaus: ein kaltes Blaugrün für den Zenit, einen warmen Ton am Horizont,
 * einen entsättigten Nebelton und **eine** Sonnenfarbe. Was daraus nicht ableitbar
 * ist, kommt nicht ins Bild — die Signalfarbe des Befalls bleibt die einzige
 * Ausnahme (ADR-0002).
 */
export interface Stimmung {
  himmel: string; nebel: string; nebelNah: number; nebelFern: number;
  sonne: string; sonneStaerke: number; umgebung: string; umgebungStaerke: number;
  sonnenstand: readonly [number, number, number];
  belichtung: number;
  /** Schattenstärke der Sonne 0…1 (`shadow.intensity`); ohne Angabe 1. */
  schatten?: number;
  /** Fensterglut 0…1 (D134): wie hell hinter den Fenstern Licht brennt; ohne Angabe 0. */
  fenster?: number;
  zenit: string; horizont: string; scheibe: number; hof: number;
  /** D203: Wolkenbedeckung 0…1 (`himmel.ts`); ohne Angabe `WOLKEN_VORGABE`. */
  wolken?: number;
  /** Silhouettenlicht: Farbe des Himmels, der die Umrisse zeichnet. */
  randFarbe: string;
  randStaerke: number;
  /**
   * Stärke des Himmelsanteils im Fülllicht (D170, `windmaterial.ts`); ohne Angabe 0,7. Die Nacht
   * bekommt 0: Dort ist das Fülllicht das einzige Licht, und im Hof der Felsmulde wurden mit 0,7
   * 8,1 % der Pixel reines Schwarz (Bildtor-Blocker, Grenze 6,5). (`himmel` ist die Himmelsfarbe.)
   */
  himmelAnteil?: number;
  /**
   * Bodenfarbe der Hemisphäre je Stimmung (D167); ohne Angabe `HEMI_BODEN`. Die Nacht braucht den
   * hellen Boden gegen reines Schwarz, der Tag nicht — eine globale Zahl musste beides können.
   */
  hemiBoden?: string;
}

/**
 * Zweite Farbe der Hemisphere-Lichtquelle — das Licht „von unten".
 *
 * War `#121a16` und damit praktisch schwarz. Wirkung: Alles, was zur Sonne
 * abgewandt oder im Schatten stand, landete unter der **Schwarzgrenze des Tone
 * Mappings**. Die liegt bei ACES nicht bei null, sondern bei einer linearen
 * Strahldichte von rund 0,002/Belichtung — darunter ist der Zähler des RRT-Fits
 * negativ und das Ergebnis wird auf 0 geklemmt. Es gibt dort kein „sehr dunkel",
 * nur „aus". Gemessen mit `npm run licht`.
 *
 * Als Farbe exportiert, damit das Messwerkzeug dieselbe Zahl liest wie die Szene.
 */
export const HEMI_BODEN = PALETTE.licht.hemiBoden;
/**
 * Hemisphärenboden der Tagesstimmungen (D167): `nebelmorgen`, `goldnebel`, `zielbild`. Nacht,
 * Dämmerung und Abendrot behalten `HEMI_BODEN` — dort trägt das Umgebungslicht das Bild, und die
 * Nacht verlöre mit dem dunklen Boden fast doppelt so viele Pixel an reines Schwarz (Fenster
 * 2,7 → 4,8 %, Felsmulde nachts wird zum Bildtor-Blocker). Gemessen in `docs/MESSLAUF.md`.
 */
export const HEMI_BODEN_TAG = PALETTE.licht.hemiBodenTag;

export const STIMMUNG: Record<string, Stimmung> = {
  nacht: {
    himmel: '#0a0f12', nebel: '#101a1c', nebelNah: 25, nebelFern: 260,
    // Umgebung von 0,35 auf 0,60: Bei 0,35 lag JEDE beschattete Fläche exakt bei
    // 0,000 — nicht dunkel, sondern aus. Nacht bleibt die dunkelste Stimmung, aber
    // mit Zeichnung statt mit Löchern.
    /**
     * Belichtung 1,40 → **2,60**: Bei 1,40 war am Hang fast die Hälfte des
     * Bildes nicht dunkel, sondern **aus** (G-116).
     *
     * Der Hinweis darüber stammt aus einem Test gegen eine ebene Fläche und hat
     * den Fall nie gesehen. Gemessen an vier echten Orten, Anteil der Pixel,
     * deren höchster Kanal **exakt 0** ist:
     *
     * | Ort | nacht | daemmerung | nebelmorgen | abendrot |
     * |---|---|---|---|---|
     * | Felsflanke | **42,7 %** | 2,8 % | 1,0 % | 0,1 % |
     * | Waldrand | **47,2 %** | 5,5 % | 4,9 % | 4,6 % |
     * | Talboden | 1,7 % | 0,0 % | 0,2 % | 1,4 % |
     * | Dorf | 1,1 % | 1,5 % | 1,3 % | 0,3 % |
     *
     * Nur `nacht`, und nur wo kein Himmel im Bild steht. Ein Spitzenwert bei
     * **genau 0** und nicht bei 1 oder 2 heisst: Es ist keine Fläche unbeleuchtet,
     * das Ergebnis fällt unter die 8-Bit-Schwelle. Genau deshalb halfen Umgebung
     * (0,80 → 1,05) und ein kleiner Belichtungsschritt (1,40 → 1,75) nichts.
     *
     * Die Reihe, die es entschieden hat — Anteil exakt schwarzer Pixel gegen
     * Belichtung: 1,40 → 42,7 % · 2,00 → 17,2 % · **2,60 → 3,6 %** · 3,20 →
     * 2,6 % · 4,00 → 2,0 %. Der Knick liegt bei 2,60; darüber kostet jeder
     * weitere Schritt Dunkelheit ohne Gewinn.
     *
     * Nacht bleibt mit Abstand die dunkelste Stimmung: Median-Leuchtdichte
     * **0,014** gegen 0,118 bei `daemmerung` und 0,156 bei `nebelmorgen`. Die
     * Lichtwerte sind unangetastet — Belichtung ist seit D22 genau der Regler
     * für „kommt die Szene auf einem Bildschirm an", getrennt von der
     * Kunstrichtung.
     */
    sonne: '#8fa9c4', sonneStaerke: 0.45, umgebung: '#22323a', umgebungStaerke: 0.80,
    sonnenstand: [-80, 90, 60] as const,
    belichtung: 2.60,
    schatten: 0.7,
    fenster: 1.0,    // nachts brennt Licht — das Dorf ist bewohnt (D134)
    // Mond: harte kleine Scheibe, fast kein Hof.
    zenit: '#05080d', horizont: '#131c22', scheibe: 0.0009, hof: 900,
    // Nachts trägt der Umriss fast das ganze Bild — deshalb hier am stärksten.
    randFarbe: '#4d6b82', randStaerke: 0.30,
    himmelAnteil: 0,
  },
  daemmerung: {
    himmel: '#141d20', nebel: '#1b2a2b', nebelNah: 60, nebelFern: 420,
    sonne: '#c8b48a', sonneStaerke: 2.4, umgebung: '#4d5f64', umgebungStaerke: 4.0,
    sonnenstand: [-120, 110, -90] as const,
    belichtung: 2.7,
    /**
     * Schlagschatten auf 60 % (D122). Gemessen mit `?schatten=`: Bei 1,0 stand
     * beschatteter Boden bei 28 % des beleuchteten — die Stilreferenz liegt bei
     * etwa 60 %. 0,5 hob das Dorf von 0,102 auf 0,124, Felsflanke und
     * Stauwehr um 0,01; 0,6 ist der Kompromiss, der den Schatten als Form
     * behält.
     */
    schatten: 0.6,
    fenster: 0.15,   // erste Lampen in der Daemmerung
    // Tief stehende Sonne: kleine Scheibe, sehr weiter Hof. Der Hof IST die Stimmung.
    zenit: '#1b3550', horizont: '#4a4238', scheibe: 0.0016, hof: 190,
    randFarbe: '#6e7f86', randStaerke: 0.22,
    himmelAnteil: 0.35,   // Dämmerung trägt sich über die Umgebung (D118) — halb
  },
  nebelmorgen: {
    himmel: '#20282a', nebel: '#2c3a39', nebelNah: 30, nebelFern: 240,
    // Sonne 1,6 → 1,3 und Belichtung 2,2 → 2,05 (D118): Bei 1,6 lag an der
    // Felsflanke ein Viertel des Bildes über Leuchtdichte 0,30 — das Brennen kam
    // aus der Sonne, nicht aus der Belichtung. Jetzt 0,169 Median, 0,4 % hell.
    // D173: Sonne 1,3 → 1,5, Fülllicht 3,5 → 3,2, Schatten 0,5 → 0,65. Verhältnis Sonne·sin(Höhe) zu
    // Fülllicht 0,20 → 0,25 — Richtung `tag` (0,29), aber darunter: Dunst streut, das bleibt weicher.
    sonne: '#d8d2c0', sonneStaerke: 1.5, umgebung: '#5d7072', umgebungStaerke: 3.2,
    sonnenstand: [90, 90, -110] as const,
    belichtung: 2.05,
    schatten: 0.65,   // Dunst: weicher Schatten
    // Im Dunst gibt es keine Scheibe, nur einen breiten hellen Fleck.
    zenit: '#26333a', horizont: '#3e4a48', scheibe: 0.0, hof: 42,
    // Im Dunst streut das Licht ohnehin um jede Kante — Rand dezent.
    randFarbe: '#8a9a9c', randStaerke: 0.14,
    // Tag: dunklerer Hemisphärenboden (D167). Der Tag trägt sich über die Sonne; der helle Boden
    // war gegen die ACES-Schwarzgrenze gesetzt und hob hier nur die Unterseiten an.
    hemiBoden: HEMI_BODEN_TAG,
  },
  abendrot: {
    himmel: '#1a1614', nebel: '#2a221d', nebelNah: 50, nebelFern: 380,
    // Die Sonne steht 20° über dem Horizont — flacher Einfall, also kaum
    // Direktlicht auf waagerechtem Boden. Was das Bild trägt, ist hier die
    // Umgebung: 3,0 → 4,5 und Belichtung 2,4 → 3,0 (D118) holen die Felsflanke
    // von Median 0,058 auf 0,108, ohne dass die Sonne angefasst wird.
    /**
     * Warme Sonne, **kaltes** Umgebungslicht — aus dem Grund, der übrig blieb.
     *
     * Bis zum 27.08.2026 stand hier `umgebung: '#4e433c'`, ein warmes Braun.
     * Am Abend kommt das Direktlicht von der tiefstehenden Sonne und ist warm,
     * das Licht in den Schatten kommt vom **Himmel** und ist blau — zwei warme
     * Quellen sind physikalisch einfach falsch. Gemessen an der Felsflanke
     * (`?absetzen=-1620,-1620,40`): Pixel unter Leuchtdichte 0,02 **29,8 % →
     * 20,6 %**, also ein Drittel weniger Loch, bei einem Messrauschen von 0,3
     * Punkten.
     *
     * **Wofür es NICHT gut war, und das gehört dazu (G-115):** Der Anlass war
     * die Beobachtung, abendrot sei monochrom — gemessen als
     * saettigungsgewichtete Bündelung des Farbwinkels **0,994**, wo dieselbe
     * Szene in `daemmerung` 0,529 und in `nebelmorgen` 0,738 ergibt. Die
     * Umstellung auf kaltes Umgebungslicht änderte daran **nichts** (0,994 →
     * 0,990), und der Nebel als zweiter Verdächtiger genauso wenig (Nebel
     * praktisch abgeschaltet: 0,990). Übrig bleibt die Sonnenfarbe selbst:
     * `#d98b5b` hat Sättigung 0,58 gegen 0,31 bei `daemmerung`, und ein stark
     * gesättigtes Licht zieht jede Fläche, die es trifft, auf seinen Ton. Das
     * ist keine Fehlfunktion — das **ist** Abendrot.
     */
    sonne: '#d98b5b', sonneStaerke: 1.8, umgebung: '#454f5e', umgebungStaerke: 4.5,
    sonnenstand: [130, 55, 70] as const,
    belichtung: 3.0,
    schatten: 0.7,   // lange Abendschatten sind die Stimmung
    fenster: 0.4,
    zenit: '#13202c', horizont: '#5c4030', scheibe: 0.0020, hof: 120,
    randFarbe: '#c07a4e', randStaerke: 0.26,
    himmelAnteil: 0.35,
  },
  /**
   * Probe D152: warmer Dunst. **Nicht im Tageslauf**, nur per `?stimmung=goldnebel`.
   *
   * Referenz sind acht Landschafts-Pressebilder eines aktuellen Titels (Summer
   * Game Fest, 05.06.2026), gemessen mit demselben Mass wie das Bildtor
   * (`.cache/mess/stil.mjs`). Was die Bilder gemeinsam haben, und zwar alle:
   * - Licht **und** Schatten sind warm. Hellste 10 %: `#b7a995`…`#d7bca7`;
   *   dunkelste 2–12 %: `#191410`…`#302521`. Kein blauer Schatten.
   * - Der Dunst ist hell und traegt die Lichtfarbe: oberes Drittel `#7a756b`…
   *   `#9b7873`, Leuchtdichte 0,19–0,24; unteres Drittel 0,03–0,08. Das Bild
   *   faellt von oben nach unten um den Faktor 3–8.
   * - Saettigung nimmt zum Vordergrund **zu**: oben 0,19–0,28, unten 0,30–0,40.
   * - Median 0,06–0,14, dunkel 15–25 %, hell 8–17 %. Eine Blende dunkler als
   *   die D110-Ziele (>= 0,15 / <= 10 %) — deshalb Probe, nicht Tageslauf.
   * - Farbton: 80–95 % der Saettigung liegen in 0–60°, dazu eine Akzentfamilie.
   *
   * Uebernommen wird nur das: Lichtfarbe, Dunstfarbe, Wertestaffelung. Keine
   * Assets, keine Motive (ADR-0004). Erste Werte geschaetzt, dann gemessen und
   * nachgezogen — die Zahlen im Ledger D152.
   */
  goldnebel: {
    // Drei Wuerfe, gemessen (.cache/stil152*.txt):
    // 1. umgebung #6a5748/3,2, belichtung 2,4: Felsflanke traf die Referenz
    //    (Licht #d7c2ae gegen #d7bca7, Dunst oben 0,226), aber Dorf 0,074 und
    //    Grashang 0,099 bei Saettigung 0,53 — Schattenseiten Sepia statt Dunst.
    // 2. Dunst #7d6f63, umgebung #7b6e63/4,2, belichtung 2,9: Dorf 0,185, aber
    //    Felsflanke 0,362 mit 66 % hell — ausgebleicht. Der Dunst war zu hell.
    // 3. Dunst und Himmel von 1, nur das Fuelllicht entsaettigt und angehoben.
    himmel: '#5a4c43', nebel: '#5a4b40', nebelNah: 20, nebelFern: 230,
    sonne: '#e2c6a6', sonneStaerke: 1.4, umgebung: '#7b6e63', umgebungStaerke: 4.0,
    sonnenstand: [110, 38, -90] as const,
    belichtung: 2.5,
    schatten: 0.55,
    fenster: 0.2,
    zenit: '#4c4340', horizont: '#9c7f6c', scheibe: 0.0030, hof: 60,
    randFarbe: '#e8cba8', randStaerke: 0.32,
    hemiBoden: HEMI_BODEN_TAG,   // erbt `zielbild`
  },
};
/**
 * Probe D195: **kaltnebel** — die kühle Tagespalette aus dem Briefing vom 07.10.2026 (ADR-0011,
 * Option 2). **Nicht im Tageslauf**, nur per `?stimmung=kaltnebel`, wie seinerzeit `goldnebel` (D152).
 *
 * Gegenstück zu `zielbild` an derselben Sonne (13° hoch, Nordost), damit der Vergleich an derselben
 * Kamera nur die Palette zeigt: Sonne neutral-kühl statt warm und schwächer (Dunst nimmt das
 * Direktlicht), Fülllicht blaugrau und stärker, Dunst und Himmel blaugrau statt Sepia, Schatten
 * etwas härter. Braun kommt aus dem Boden (`hemiBoden` wie der Tag) und den Biomfarben, nicht aus
 * dem Licht.
 *
 * **Ungemessen.** Die Werte sind geschätzt, nicht gegen eine Referenz gelegt: gebaut in einer
 * Cloud-Sandbox ohne Bildschirm, und `npm run licht` läuft unter Node nicht (lädt die Szene samt
 * React-DOM). Bevor hier irgendetwas in den Tageslauf wandert: an den Bildtor-Adressen messen und
 * am Zielgerät ansehen (Ledger A-9, ADR-0005 N3/N6).
 */
STIMMUNG.kaltnebel = {
  himmel: '#1e272b', nebel: '#2a3539', nebelNah: 22, nebelFern: 220,
  sonne: '#c8d0d6', sonneStaerke: 2.4, umgebung: '#56656d', umgebungStaerke: 3.0,
  // Wie `zielbild`: Azimut 42°, Höhe 13°.
  sonnenstand: [65.2, 22.5, -72.4] as const,
  belichtung: 2.4,
  schatten: 0.8,
  fenster: 0.1,
  zenit: '#22313b', horizont: '#4a565c', scheibe: 0.0, hof: 60,
  randFarbe: '#8496a0', randStaerke: 0.2,
  hemiBoden: HEMI_BODEN_TAG,
};
export type StimmungsName = keyof typeof STIMMUNG;
/**
 * `zielbild` (Stufe 2): das Licht der Blender-Szene aus `tools/szenenbau.py` — Sonne 13° hoch im
 * Nordosten (Azimut 42°), warm; Dunst und Fuelllicht wie `goldnebel`. Nur per `?stimmung=zielbild`,
 * fuer den Vergleich Spielbild gegen Render an derselben Kamera (`?kamera=`).
 */
STIMMUNG.zielbild = {
  ...STIMMUNG.goldnebel,
  // D172: **Sonne 1,6 → 3,2, Fülllicht 4,0 → 2,5, Schlagschatten 0,6 → 1,0.** Das Verhältnis Sonne zu
  // Himmel war der Hebel, nicht Schattenkarte (4096 bei ±120 m: dunkel 21,0 → 21,2 %) und nicht der
  // Himmelsanteil im Gelände (+1,4 Punkte). Bei 13° Sonnenhöhe trifft die Sonne flachen Boden mit
  // sin 13° = 0,22 — mit 1,6 lag der beschienene Waldboden kaum über dem Schatten, im Bild fehlten die
  // Stammschatten des Renders ganz. Gemessen (Bogenkamera, 16:9):
  //   Stauwehr  Drittel 0,154/0,074/0,045 → 0,176/0,093/0,052  (Render 0,175/0,090/0,050), dunkel 21 → 29 % (44)
  //   Felsmulde Median 0,033 → 0,017 (Render 0,015), dunkel 41 → 52 % (58), Drittel 0,216/0,133/0,054 (0,225/0,123/0,044)
  // Das Fülllicht bleibt über dem Wert, an dem die sonnenabgewandte Mauer schwarz wurde (D159: 2,0) —
  // seit D170 dämpft der Himmelsanteil es dort, wo es nichts zu suchen hat, deshalb reichen 2,5.
  sonne: '#f2dcc0', sonneStaerke: 3.2,
  umgebungStaerke: 2.5,
  schatten: 1.0,
  // Azimut 42° von Nord im Uhrzeigersinn, Hoehe 13°: (sin·cos, sin, −cos·cos)
  sonnenstand: [65.2, 22.5, -72.4] as const,
};
/**
 * `tag` (D168) ist `zielbild` im Tageslauf — dasselbe Objekt, damit die Messadresse
 * `?stimmung=zielbild` und der Schlüssel bei 0,39 nie auseinanderlaufen.
 */
STIMMUNG.tag = STIMMUNG.zielbild;
/**
 * Probe D218: **weitsicht** — `zielbild` mit fast dreifacher Sichtweite (Ledger A-12, Option b).
 * **Nicht im Tageslauf**, nur per `?stimmung=weitsicht`. Soulframe (ADR-0012) staffelt über
 * Kilometer; `zielbild` ist gegen das Blender-Referenzbild auf 20/230 m eingemessen, und an der
 * Flanken-Kamera war alles dahinter eine helle Fläche (D204, D207). Sonst alles wie `zielbild`,
 * damit derselbe Kamerapunkt nur die Sichtweite vergleicht. Kosten: Was im Nebel verschwand, wird
 * jetzt gezeichnet — Prop-Sichtweiten (420 m) und Kacheln bleiben, aber bis 650 m sieht man sie.
 * **Ungemessen**, Abnahme am Zielgerät.
 */
STIMMUNG.weitsicht = {
  ...STIMMUNG.zielbild,
  nebelNah: 40, nebelFern: 650,
};
