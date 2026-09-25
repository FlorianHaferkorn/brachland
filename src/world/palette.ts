/**
 * BRACHLAND — die eine Palette
 *
 * Jede Farbe, die in der Welt steht, steht hier. Nirgends sonst ein Hex-Literal
 * für ein Material — Generatoren, Bänder, Kreaturen, Figur und die Kette für
 * Fremdassets lesen alle aus dieser Datei.
 *
 * ## Warum eine Datei
 *
 * Bis D117 lagen die Farben in neun Dateien: Biome in `terrain.ts`, Haus-
 * konstanten daneben, Kenney-Rollen und Attrappen in `props.ts`, Bäume in
 * `baum.ts`, Wege in `baender.ts`, Fels in `klippen.ts`, Gras in
 * `streuung.ts`, Elemente und Befall in `kreaturgestalt.ts`. Als das
 * Albedoband um 1,5 angehoben werden musste (D114), brauchte es ein Skript,
 * das vier Tabellen einzeln anfasst — und drei weitere (Wege, Fels, Gras)
 * blieben liegen, ohne dass es jemand gemerkt hätte. Das Messwerkzeug
 * (`.cache/palette.ts`) trug obendrein eine **Kopie** der Hausfarben, die
 * seit zwei Wochen nicht mehr stimmte.
 *
 * Einheitlichkeit über Asset-Quellen kommt aus der Behandlung, nicht aus der
 * Herkunft — und die erste Behandlung ist, dass alle aus demselben Topf
 * schöpfen. Ein Fremdmodell, das seine Farben hierauf rastert, ist danach
 * nicht mehr fremd.
 *
 * ## Konventionen
 *
 * - Hex ist sRGB, wie es im Quelltext steht; three.js wandelt beim Einlesen
 *   nach linear. Leuchtdichte-Angaben in Kommentaren sind **linear**.
 * - Das Band der Welt seit D114, gemessen über alle 101 Farben (`npm run
 *   palette`): Leuchtdichte p10 0,070, Median 0,141, p90 0,345 — die dunklen
 *   Werte sind Fensterhöhlen, Türen, Figur und Wasser. Kreaturen liegen
 *   bewusst im oberen Teil (`kreaturBand`).
 * - Sättigung bleibt bei ~0,5 im Median (G-124): Die Welt ist erdig und
 *   kräftig, nicht flau. Wer eine Farbe ändert, ändert Leuchtdichte, nicht
 *   Sättigung — `npm run palette` zeigt beides.
 */

export const PALETTE = {
  /** Biome des Geländes — gedämpfte Naturtöne, siehe Art Direction. */
  biom: {
    fels:      '#81868a',
    /**
     * Waldboden war `#2c4232` und damit auf denselben Helligkeitswert wie die
     * Fichtennadel gesetzt — gemessener Kontrast 1,00:1 in allen vier
     * Stimmungen. Beschatteter Wald war deshalb nicht nur dunkel, sondern
     * **eine einzige Fläche**. Nadelstreu ist in Wirklichkeit heller und wärmer
     * als das Kronendach, weil sie das Chlorophyll nicht mehr hat.
     */
    wald:      '#67754d',
    gebuesch:  '#5a6c4e',
    wiese:     '#73865d',
    acker:     '#918860',
    /** Gewässerbett: Schlamm aus `szenenbau.py:mat_boden`, linear (0,10/0,085/0,06). */
    wasser:    '#595245',
    siedlung:  '#837d72',   // ×1,4 (D122): das Dorf lag bei 0,10, weil sein Boden 0,15 hatte
    industrie: '#6d5a53',
    ruine:     '#625d57',
    unbekannt: '#5e6a61',
  },

  /** Häuser aus dem Generator. Zwei Grundtöne, Wand und Holz, plus Zubehör. */
  haus: {
    wand:     '#928b7d',   // ×1,4 (D122): Putz ist hell, Y 0,19 war Beton
    schalung: '#a27f5a',   // ×1,3 (D122)
    dach:     '#65574d',   // ×1,4 (D122)
    /** Fensterhöhle — bewusst das Dunkelste in der Welt, damit sie liest. */
    fenster:  '#11171a',
    sockel:   '#666055',
    tuer:     '#332b22',
    /**
     * Kaminschaft: heller Kalkputz. Stand bis 27.08.2026 einen Hauch neben dem
     * Dachton und war auf der Dachfläche unsichtbar. Ein Kamin ist im Bestand
     * fast immer verputzt und damit das **hellste** Teil des Daches.
     */
    kamin:    '#b0a596',
    /** Fensterläden — das eine gesättigte Signal am Alpenhaus. */
    laden:    '#5a6f4e',
    /** Fensterrahmen und Traufbrett, gekalktes Holz. */
    rahmen:   '#c2b9a6',
    /** Geranienkasten — Blüte und Kasten. */
    geranie:  '#b5433d',
    kasten:   '#4e4034',
    /** Brennholz, Stirnseite: heller als die Schalung, weil frisch gespalten. */
    holz:     '#a88c62',
    /** Firstbalken und Sparrenköpfe: das gleiche Holz wie die Schalung, verwittert. */
    sparren:  '#6e5a44',
    /** Fallrohr, Zink. */
    rinne:    '#8d9296',
  },

  /** Prozedurale Bäume, zwei Töne je Art — die Spreizung macht aus Fläche Volumen. */
  baum: {
    fichteStamm: '#605343', fichteLaub: '#4a6646', fichteLaub2: '#648761',
    bucheStamm:  '#817b6c', bucheLaub:  '#678747', bucheLaub2:  '#84a65a',
  },

  /**
   * Attrappen jenseits von 75 m. Müssen zu `baum` passen: Wenn die Attrappe
   * dunkler ist als der Baum davor, sieht man die Umschaltung als Farbsprung.
   */
  attrappe: {
    nadelbaum:   '#476245',
    laubbaum:    '#708f5a',
    busch:       '#4d603f',
    findling:    '#858a8e',
    totholz:     '#5a5146',
    grasbuschel: '#708154',
    blume:       '#97935f',
    pilz:        '#817364',
  },

  /**
   * Materialrollen der Attrappen — die Namen stammen aus dem Kenney-Kit (D74),
   * seit D120 baut `propbau.ts` die Props selbst und greift auf dieselben Rollen
   * zu (Stein, Rinde, Stirnholz, Laub, Blüten). Kenney-Materialrollen → Projektfarbe (D74). Die Töne stammen aus `biom`
   * und `baum`; ein Busch aus einer zweiten Palette fällt sofort als
   * Fremdkörper auf, und genau das war der Zustand vorher (G-76).
   */
  kenney: {
    grass:        '#5a6c4e',
    leafsGreen:   '#678747',
    leafsDark:    '#4a6646',
    leafsFall:    '#937b40',
    woodBark:     '#605343',
    woodBarkDark: '#4e4437',
    wood:         '#817055',
    woodDark:     '#5a4e40',
    woodBirch:    '#a69e8d',
    woodInner:    '#847761',
    dirt:         '#817553',
    dirtDark:     '#665d44',
    stone:        '#81868a',
    stoneDark:    '#686d71',
    water:        '#33555f',
    corn:         '#b9a75a',
    colorRed:     '#a85a51',
    colorRedDark: '#864740',
    colorYellow:  '#bfa755',
    colorPurple:  '#817393',
    colorWhite:   '#dad7cd',
    colorTan:     '#caaf80',
    _defaultMat:  '#817b6c',
  },

  /** Wegbeläge nach OSM-Klasse (G-79). Asphalt dunkel, Feldweg braun. */
  weg: {
    secondary:    '#4c4b48',
    tertiary:     '#4e4d4a',
    residential:  '#55524d',
    unclassified: '#57554f',
    cycleway:     '#524f4b',
    service:      '#6c675d',
    track:        '#847759',
    path:         '#887a59',
    footway:      '#85795b',
    standard:     '#5c5850',
  },

  /** Fließendes und stehendes Wasser (`bandmaterial.ts`). */
  /**
   * Wasser war bei D114 ausgenommen (Phase 3). Seit D123 ×2,2 auf dem
   * stehenden Wasser (Y 0,079 → 0,175, Sättigung 0,50 — die Referenz zeigt
   * Türkis, kein Graublau), Glanz ×1,8, fallendes Wasser ×1,3 Richtung Gischt.
   * D131 nimmt das Fallende wieder zurück (Y 0,39 → 0,21): In der Sonne war der
   * Fall eine weiße Platte (Ausschnitt Median 0,47, p90 0,80, Zeichnung null).
   * Die Farbe allein hat das nicht behoben (0,47 → 0,39) — die Platte war der
   * Sonnenfleck, Rauheit 0,35 → 0,85 in `bandmaterial.ts` (→ 0,27 / 0,46). Die
   * Gischt kommt jetzt aus Strähnen im Shader, nicht aus der Grundfarbe.
   */
  wasser: {
    stehend:         '#457c8b',
    stehendGlanz:    '#1b414e',
    fallend:         '#5f8590',
    fallendGlanz:    '#477079',
    /** `szenenbau.py:mat_wasser`: Grundfarbe und Volumenabsorption, hier in sRGB. */
    durchsicht:      '#c4cec4',
    absorption:      '#a0bcaa',
  },

  /** Felswände: drei Töne für die Facetten, ein Schutt. */
  fels: {
    a: '#5f6469', b: '#6b6f72', c: '#565b60',
    schutt: '#4f4c46',
  },

  /**
   * Gestreutes Gras und Steine (`streuung.ts`) und die Grasbüschel-Attrappen:
   * Halm von Fuß bis Spitze. Spitze Y 0,63 → **0,32** (D120): Bei 0,63 stand
   * jedes der 5.200 Büschel dreimal so hell wie die Wiese (0,21) und las sich
   * von oben als weisser Seestern — die ganze Wiese war ein Sternenfeld. Jetzt
   * anderthalbmal so hell wie der Boden, der Fuß bleibt dunkler als er.
   */
  streu: {
    grasFuss:   '#5d6f40',
    grasSpitze: '#8fa069',
    stein:      '#6f716a',
  },

  /** Elementfarben der Silhouetten — ein Ton je Element, gedämpft. */
  element: {
    holz:      '#4a5c33',
    stein:     '#6e7276',
    'alt-tech': '#5a6b74',
    sporen:    '#6f9c6a',
    wasser:    '#3f6672',
    brand:     '#7a4a33',
    frost:     '#8fa6ad',
    faeulnis:  '#5c5238',
    /** Rückfall, wenn ein Element keine Farbe hat. */
    hell:      '#5a6058',
    dunkel:    '#3a403a',
  },

  /**
   * Befall aus der Stilreferenz: Pilz und Flechte in Ocker und Beige, die
   * Signalfarbe nur als Punkt und nie am Tier selbst.
   */
  befall: {
    pilzHell:   '#c9b389',
    pilzDunkel: '#9a8560',
    signal:     '#cfe9f2',
  },

  /** Chitinplatten-Gehörn (D109): zwei Töne, abwechselnd je Platte. */
  chitin: { hell: '#9c8a68', dunkel: '#6f6350' },

  /** Die Spielerfigur: dunkle Silhouette, drei Stufen. */
  /**
   * Spielerfigur (D126). Bis dahin drei Grautöne unter Y 0,03 — die Figur stand
   * als schwarzer Scherenschnitt im Bild, aus jeder Entfernung. Jetzt eine
   * Wanderin im Band der Welt: Jacke und Hose gedämpft, Haut und Kapuze warm,
   * **ein** Akzent (Halstuch im Geranienrot) — nicht die Signalfarbe, die bleibt
   * dem Befall (ADR-0002).
   */
  figur: {
    jacke:    '#66756d',
    hose:     '#414c48',
    stiefel:  '#2e2a26',
    haut:     '#b39a7d',
    kapuze:   '#6e5643',
    halstuch: '#b5433d',
    gepaeck:  '#8a7455',
    rolle:    '#a89a86',
    riemen:   '#3a332c',
    /** Haar der Menschen aus der Menschenkette (D143) — dunkles Braun, Y 0,05. */
    haar:     '#4a3a2e',
    /** Varianten der Bewohner (D145): graues und helles Haar, Loden, Wolle, Kittel. */
    haarGrau: '#8d867b',
    haarHell: '#9a8258',
    loden:    '#4d5944',
    wolle:    '#7a6652',
    kittel:   '#5c4d5a',
  },

  /**
   * Boden der Hemisphäre — was von unten auf Flächen fällt. War `#121a16`
   * und damit praktisch schwarz: alles zur Sonne Abgewandte landete unter der
   * Schwarzgrenze des Tone Mappings (G-7). Seit D114 heller, als Teil des
   * Fülllichts.
   *
   * D166 neu hergeleitet, weil die alte Begründung mit ACES wegfiel (AgX
   * schneidet erst bei ~0,00018 statt ~0,0035 ab). Der Wert bleibt, der Grund
   * ist jetzt die Nacht: Bei `#242c26` steigt der Anteil exakt schwarzer
   * Pixel im Tor „Fenster" von 2,7 auf 4,8 %, bei `#121a16` auf 6,7 %. Am Tag
   * brächte `#242c26` die Felsmulden-Wand näher ans Render (Median 0,0213 →
   * 0,0155, Render 0,0069) — das ist knapp ein Drittel der Lücke und kein
   * Grund, die Nacht zuzuschütten. Wenn der Tag dunkler werden soll, dann je
   * Stimmung, nicht hier global. Messlauf: `?hemiboden=<hex6>`.
   */
  licht: {
    hemiBoden: '#3a463c',
    /**
     * D167: am Tag dunkler. Felsmulde (`zielbild`, Bogenkamera) Wand-Median 0,0213 → 0,0155
     * (Render 0,0069); dunkler bringt kaum mehr (`#1a201c` 0,0139, `#121a16` 0,0133). Der Hof
     * bleibt bei 0,073 — waagerechte Flächen sehen den Boden der Hemisphäre nicht.
     */
    hemiBodenTag: '#242c26',
  },

  /**
   * Leuchtdichteband für Fremdmodelle (linear). `tools/kreaturbau.py` liest
   * die beiden Zahlen aus dieser Datei — bewusst oben im Band der Welt, weil
   * eine Kreatur das ist, wonach der Spieler sucht (D106).
   */
  kreaturBand: { unten: 0.17, oben: 0.35 },
} as const;

export type Palette = typeof PALETTE;
