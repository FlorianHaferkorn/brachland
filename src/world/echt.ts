/**
 * BRACHLAND — Schalter des Vertikalschnitts „so echt wie möglich“ (Stauwehr, 11.11.2026)
 *
 * Flo am 11.11.2026: „so realistisch, plastisch und echt wie möglich“. Alles, was dafür neu ist,
 * hängt zunächst an Schaltern, damit der erarbeitete Look daneben bitgleich bleibt und am M1 in
 * Bewegung verglichen werden kann (ADR-0005/0006). `?echt=1` schaltet alles zusammen ein,
 * die Einzelschalter erlauben den Vergleich Stück für Stück.
 */
const suche = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
const an = (name: string) => suche.get(name) === '1';

/**
 * Malerischer Look (D269): `?malerei=1` = `?echt=1` plus Pinsel und Malfilter. Anlass: Reel
 * „oil-paint“ (patch.gg/blendi, three.js r186, WebGL2) vom 12.11.2026 und Flos „ne A“ — Realismus
 * allein ist dem Film nicht gewachsen, ein gemalter Look verzeiht Flimmern und fehlende Mikrodetails.
 * Einzeln: `?echt=1&pinsel=1` (nur B), `?echt=1&kuwahara=1` (nur C), oder `?malerei=1&pinsel=0`.
 */
export const MALEREI = an('malerei');
/** D299: Vegetationsprobe am Scan-Hof; eigener, zurückschaltbarer Vergleich. */
export const HOF_GRUEN_AN = an('hofgruen');
/** D302: dieselbe sparsame Strauchform auch in der Fernverwaltung; Rückfall `strauchweit=0`. */
export const HOF_STRAUCH_WEIT = HOF_GRUEN_AN && suche.get('strauchweit') !== '0';
/** D300: abgestufte Blattkanten im MSAA-Ziel; `blattruhe=0` erhält den D299-Gegenlauf. */
export const BLATTRUHE_AN = HOF_GRUEN_AN && suche.get('blattruhe') !== '0';
/** D301: kontinuierliche AO-Flächen statt Normalen über Blatt-/Himmel-Tiefensprünge. */
export const BLATTVERLAUF_AN = BLATTRUHE_AN && suche.get('blattverlauf') !== '0';
/** D304: Bauteile auf den örtlichen Hofverbund übertragen; D303 bleibt separat abrufbar. */
export const HOF_HAEUSER_AN = HOF_GRUEN_AN && an('hofhaeuser');
/** D307: örtliche Bodenmischung, Zugänge und Geländekontakt; Rückfall hofboden=0. */
export const HOF_BODEN_AN = HOF_HAEUSER_AN && an('hofboden');
/** D312: separater Vergleich für den verwachsenen Hofverbund. */
export const HOF_VERFALL_AN = HOF_HAEUSER_AN && an('hofverfall') && suche.get('bau') !== '0';
/** D313: von Hand geführter Efeu am beschädigten Referenzhaus. */
export const HOF_RANKE_AN = HOF_VERFALL_AN && an('hofranke');
/** D314: Einsturzspur an derselben Referenzruine. */
export const HOF_RUINE_AN = HOF_RANKE_AN && an('hofruine');
/** D316: abgesacktes Dach und durchgehende Einsturzspur an Haus 308. */
export const HOF_EINSTURZ_AN = HOF_RUINE_AN && an('hofeinsturz');
/** D317: Zielbildfassung von Haus 308. */
export const HOF_ZIEL_AN = HOF_EINSTURZ_AN && an('hofziel');
/** D318: weiter ausgearbeitete Schindelruine und dichterer Eckbewuchs. */
export const HOF_DACHBRUCH_AN = HOF_ZIEL_AN && an('hofdachbruch');
/** D319: weiche Sonnenschatten und indirekte Aufhellung am Referenzhof. */
export const HOF_LICHT_AN = HOF_DACHBRUCH_AN && an('hoflicht') && suche.get('stimmung') === 'hofdachbruch';
/** D320: zusammenhängende Zielbildfassung des Hauses und seines Vorfelds. */
export const HOF_ZIELTREUE_AN = HOF_LICHT_AN && an('zieltreue');
/** D321: abgestufte Schäden zwischen Dach, Fassade und Bewuchs an Haus 308. */
export const HOF_VERFALLVERLAUF_AN = HOF_ZIELTREUE_AN && an('verfallverlauf');
/** D322: Alterung aus Bauform, Exposition und Nutzung im spielbaren Ausschnitt. */
export const HOF_ORTSALTERUNG_AN = HOF_VERFALLVERLAUF_AN && an('ortsalterung');
/** D329: drei Nutzungszustände der Satteldachhäuser an der Weststraße. */
export const WESTVERFALL_AN = HOF_ORTSALTERUNG_AN && an('westverfall');
/** D330: Detailmaterialien und konstruktive Tiefe für die Häuser der Weststraße. */
export const WESTDETAIL_AN = WESTVERFALL_AN && an('westdetail');
/** D331: maßstäbliche Dachkörper im Weststraßen-Ausschnitt. */
export const WESTDACH_AN = WESTDETAIL_AN && an('westdach');
/** D335: regionaler Fassadenbaukasten an Gebäuden mit Nutzungsprofil. */
export const WESTFASSADE_AN = WESTDACH_AN && an('westfassade');
/** D336: Bauwerks- und Vegetationsanschlüsse am westlichen Wohnweg. */
export const WESTANSCHLUSS_AN = WESTFASSADE_AN && an('westanschluss');
/** D337: untexturierte Geometrieprobe des vermessenen Straßenzugs. */
export const WOHNWEGQUERSCHNITT_AN = WESTANSCHLUSS_AN && an('wohnwegquerschnitt');
/** D338: Material- und Saumprobe am vermessenen Wohnweg. */
export const MILBINGERBELAG_AN = WOHNWEGQUERSCHNITT_AN && an('milbingerbelag');
/** D339: eigenständiger Schotterbelag und Flankenbewuchs für ausgewählte Zufahrten. */
export const MILBINGEROBEN_AN = MILBINGERBELAG_AN && an('milbingeroben');
/** D340: vermessene Proportionen und die Scan-Wiese im Milbinger Straßenraum. */
export const MILBINGERMASSE_AN = MILBINGEROBEN_AN && an('milbingermasse');
/** D341: räumliche Dachkanten, örtliche Materialalterung und Straßenrand. */
export const MILBINGERDETAIL_AN = MILBINGERMASSE_AN && an('milbingerdetail');
/** D342: hangfolgende Sockel und durchgehender Bodenanschluss am Milbinger Wohnweg. */
export const MILBINGERBODEN_AN = MILBINGERDETAIL_AN && an('milbingerboden');
/** D343: örtliches Tageslicht, Baumkulisse und Materialprobe der Spielfigur. */
export const MILBINGERLICHT_AN = MILBINGERBODEN_AN && an('milbingerlicht');
/** D344: D343-Tageslicht für den direkten Vergleich zur Wolkendecke. */
export const MILBINGERKLAR_AN = an('milbingerklar');
/** D345: DGM1-Fernrelief. Der Nullschalter erhält die D344-Kulisse für den Vergleich. */
export const MILBINGERFERN_AN = MILBINGERLICHT_AN && suche.get('milbingerfern') !== '0';
/**
 * D349: DGM1-Ring um die ganze Region statt nur des Südhangs. `fernring=0` zeigt D345.
 * D351: `fernring=1` schaltet den Ring auch ohne Milbinger Kette zu (Fahlmoos, übriges Œntal).
 */
export const FERNRING_AN = (MILBINGERFERN_AN && suche.get('fernring') !== '0') || an('fernring');
/** D350: Ring jenseits 1 km Ringtiefe mit halber Linienzahl. `fernhalb=0` zeigt den vollen Ring. */
export const FERNHALB_AN = FERNRING_AN && suche.get('fernhalb') !== '0';
/** D358: Efeu als gebackene Karten in echter Blattgrösse; Einzelblätter nur noch am Rand. D359: Vorgabe, `efeukarten=0` zeigt D354. */
export const EFEUKARTEN_AN = suche.get('efeukarten') !== '0';
/**
 * D365: Parallax Occlusion Mapping an den Hauswänden (`hauspom.ts`) — Fugen, Feldstein, Brettfugen und Ziegelkanten
 * mit Tiefe statt flach aufgedruckt, nur im Nahbereich (bis 25 m). Wirkt, wo Hausscans liegen (`?haus=1`/`?echt=1`).
 * Vorgabe an; `pom=0` zeigt den Stand davor.
 */
export const POM_AN = suche.get('pom') !== '0';
/** D363: Gebäude aus `content/hofbauten.json` als Hof-Baukasten-Modell (Blender, D360) statt des erzeugten Hauses. */
export const HOFBAU_AN = an('hofbau');
/** D361: Bodenstreu als gebackene Karten (Laub, Nadeln, Kies, Zweige) um die Spielfigur; `streu=0` schaltet ab. */
export const STREU_AN = suche.get('streu') !== '0';
/** D366: Bodenpflanzen (Sauerklee, Waldmeister, Moos, Brombeere, Jungwuchs) als gebackene Karten; `boden=0` schaltet ab. */
export const BODEN_AN = suche.get('boden') !== '0';
/** D346: ausgebrochener Gehwegrand und zusammenhängende Verwitterung am Milbinger Weg. */
export const MILBINGERRAND_AN = MILBINGERBODEN_AN && an('milbingerrand');
/** D347: Materialtiefe und fortgeschrittene Übernahme an der Milbinger Straße. */
export const MILBINGERSUBSTANZ_AN = MILBINGERRAND_AN && an('milbingersubstanz');
/** D348: zusammenhängender Belag, Farbreste und Straßenrand in Milbinger. */
export const MILBINGERFINALE_AN = MILBINGERSUBSTANZ_AN && an('milbingerfinale');
/** D333: quellenbasierte Straßenausstattung und begehbarer Verfall. */
export const STRASSENVERFALL_AN = an('strassenverfall');
/** D334: am Luftbild gemessene Breiten und Markierungen. */
export const STRASSENPROFIL_AN = STRASSENVERFALL_AN && an('strassenprofil');
/** D323: Dachkontur und Baumgruppen für das Zielbild am Hof. */
export const HOF_SILHOUETTE_AN = HOF_ORTSALTERUNG_AN && an('hofsilhouette');
/** D323: unveränderte Prop-Fernanker wiederverwenden und Klanggraph bei Bedarf aufbauen. */
export const HOF_BILDRUHE_AN = HOF_ORTSALTERUNG_AN && an('bildruhe');
/** D324: denselben Hof mit räumlich begrenzter Grasarbeit und vorbereiteten Nahbaumdaten zeichnen. */
export const HOF_BILDTAKT_AN = HOF_SILHOUETTE_AN && HOF_BILDRUHE_AN && an('bildtakt');
/** D326: getrennte Haus- und Gartenpuffer, indiziertes Gelände und erst gefüllte Instanzgruppen zeichnen. */
export const HOF_BILDFLUSS_AN = HOF_BILDTAKT_AN && an('bildfluss');
/** D327: Geländekacheln und sichtbare Aufsätze gemeinsam, in kleinen Arbeitsschritten wechseln. */
export const HOF_KACHELNACHLAUF_AN = HOF_BILDFLUSS_AN && an('kachelnachlauf');
/** D328: Gruppenwechsel mit vorbereiteten Baumformen und geteilten Kopien. Rückfall mit bildspitzen=0. */
export const HOF_BILDSPITZEN_AN = HOF_KACHELNACHLAUF_AN && suche.get('bildspitzen') !== '0';
/** D308: kürzeres, fleckiges Hofgras und freie Trittplatten. */
export const HOF_GRAS_AN = HOF_BODEN_AN && an('hofgras');
/** D306: räumliche Brüstung und getrennte bepflanzte Kästen am Hof. */
export const HOF_LAUBEN_AN = HOF_HAEUSER_AN && an('hoflauben');
/** D305: identische Haus-/Gartenecken einmal speichern; Rückfall auf D304 mit hauskompakt=0. */
export const HAUS_KOMPAKT_AN = HOF_HAEUSER_AN && suche.get('hauskompakt') !== '0';
/** Getrennte Diagnose für das Auslassen vollständig überschriebener Shaderarbeit. */
export const HAUS_SHADER_SPAR_AN = HAUS_KOMPAKT_AN && suche.get('hausshader') !== '0';
/** D303: nur das ausgewählte Hofhaus, expliziter Vorher/Nachher-Schalter. */
export const REFERENZHAUS_AN = HOF_GRUEN_AN && an('referenzhaus');
export const HOF_AN = an('scanhof') || HOF_GRUEN_AN;
/**
 * A-Frame-Darstellung (D433, ADR-0018, Rezept aus `tools/stilframes.py` Stil `aframe`): `?aframe=1` = `?echt=1`
 * plus tiefengewichteter Malfilter (nah unberührt, Ferne/Kronen/Himmel zu Flächen) und Temperaturtrennung
 * (Schatten kühl, Licht warm) nach der Tonwertkurve. Ersetzt den globalen Filter aus D269 nicht, steht daneben.
 */
export const AFRAME_AN = an('aframe');
/** D446: Look-Durchgang Felsmulde nach dem Messbild D445 — Rahmenkronen (`scenes/Rahmenkronen.tsx`); mit `?stimmung=zielbildfels`. */
export const LOOK_FELS_AN = an('lookfels');
/**
 * D478, in Arbeit: Scan-Bäume des Zielbilds statt Kartenkronen (`tools/baumexport.py`, `dateien: baeume`). Hinter
 * eigenem Schalter, weil die Laubkarten beim Kürzen noch zerfallen (Splitter, freistehende Aststücke); Vorgabe bleiben
 * die Rahmenkronen (D446/D474/D475). `?lookfels=1&scanbaeume=1`.
 */
export const SCAN_BAEUME_AN = LOOK_FELS_AN && an('scanbaeume');
export const ECHT = an('echt') || MALEREI || HOF_AN || AFRAME_AN;
/** Einzelschalter: `?x=1` schaltet ein, `?x=0` nimmt ihn aus `?echt=1` heraus. */
const teil = (name: string) => (suche.get(name) === '0' ? false : ECHT || an(name));
/** Foto-Blattkarten auf den Kronen der Blender-Szenen (`laubkarten.ts`). */
export const LAUBKARTEN_AN = teil('laubkarten');
/**
 * Bachufer grün statt Schlamm: Bäche werden mit einer ganzen Rasterzelle (~10 m bei 384) als Biom
 * `wasser` gestempelt. Wo dort trocken ist, zählt die Zelle als Wiese — Farbe, Gras, Streu.
 */
export const UFER_GRUEN = teil('ufer');
/**
 * Rinde und Stammfuss an den Waldstämmen der Blender-Szenen (D262): `WaldHolz` bekommt den
 * Rinden-Scan, den die Engine-Bäume seit D224 tragen, und jedes Holz der Szene die Verdeckung am
 * Boden (`stammfuss.ts`).
 */
export const STAMM_AN = teil('stamm');
/**
 * Farbabgleich im Zwischenbild (D262): nimmt einen Teil des Sepiastichs der Stimmung heraus und
 * setzt eine sanfte S-Kurve. Berührt die entschiedene Tagesstimmung nicht — die Stimmung bleibt
 * `zielbild`, nur das fertige Bild wird abgeglichen. Gegenentwurf mit kühler Palette bleibt
 * ADR-0011 (Proposed).
 */
export const ABGLEICH_AN = teil('abgleich');
/**
 * Ruhige Verdeckung (D263): Der AO-Pass dreht seine Proben je Pixel mit weissem Rauschen und wird
 * nur mit vier Proben weichgezeichnet — es bleibt Korn, das in Bewegung flimmert. Mit dem Schalter
 * Bayer-Muster plus 4×4-Weichzeichnung mit Tiefengewicht (`Kontur.tsx`).
 */
export const AO_RUHIG = teil('aoruhig');
/**
 * Gras wie Gras (D266, `grasteppich.ts`): satteres Grün mit Farbflecken statt grau-weisser Spitzen,
 * Büschel (Höhe in ~70-cm-Flecken), dunkle Basis (Verdeckung im Rasen), Durchlicht im Gegenlicht,
 * kein Glanz. Der Teppich selbst — Dichte, Ringe, Wind — bleibt.
 */
/**
 * Gras-Vielfalt (D271, `?gras=2`): Pflanzenarten (Gras, Stroh, Kraut), Büschel mit kahlen Stellen, Halmkante
 * und -rippe. Anlass: Vergleich mit Phantom-Blade-Zero-Pressebildern am 12.11.2026 — dort fällt nicht die
 * Dichte auf, sondern Vielfalt. Schaltet `?gras=1` (Nahfeld, D268) mit ein.
 */
/**
 * Mip-Ketten mit Deckungserhalt für die Laub- und Nadelkarten (D273, `alphamips.ts`): dünne Blattränder
 * zerfallen beim Verkleinern sonst im Alpha-Test zu ausgefransten Flecken. `?mips=1` oder in `?echt=1`.
 */
export const MIPS_ERHALT = teil('mips');

/**
 * Gras aus feinen Horsten (D272, `?gras=3`): echte Halmbreite (3–8 mm) und Dichte über Karten mit je ~44
 * gezeichneten Halmen statt breiter Einzelhalme; schliesst `?gras=2` (Vielfalt) und `?gras=1` ein.
 */
/**
 * D282 (`?laub=2`, seit D283 Teil von `?echt=1`): Laubkarten aus gebackenen Büscheln echter Poly-Haven-Baummodelle (`laub-bueschel.webp`),
 * Blätter fast ohne Glanz, Mip-Kette mit Deckungserhalt, Krone ab ~15 m dichter und mit weniger Durchlicht.
 * Gegen weisse Säume und Krisseln (Flo 14.11.2026).
 */
// D283: Teil von `?echt=1` (Flo 14.11.2026 „mach alles davon“); `?laub=0` nimmt es heraus, `?laub=2` schaltet es einzeln ein.
export const LAUB_FEIN = suche.get('laub') === '2' || (ECHT && suche.get('laub') !== '0');
/**
 * D284 (`?haus=1` / `?echt=1`): Hausscans — Putz, Schalung, Dachziegel, Sockel aus Poly-Haven-Texturen (CC0) auf
 * den prozeduralen Häusern (`hausmaterial.ts`), Farbe bleibt die Palette, die Textur bringt Struktur und Relief.
 */
export const HAUS_ECHT = teil('haus');
/** D285 (`?belag=1` / `?echt=1`): Wegbeläge aus Scans — Asphalt, Schotter, Erdpfad, Graspfad (`bandmaterial.ts`). */
export const BELAG_ECHT = teil('belag');
/**
 * D289 (`?bau=1` / `?echt=1`): Bauwelt (D287, `docs/design/BRACHLAND_Bauwelt_v1.md`) im Hausgenerator — Flachsatteldach
 * (~22° statt 40°), Giebelüberstand grösser als Traufüberstand, Einfirsthof (Wohnteil + Tenne unter einem First, Tennentor)
 * für grosse, längliche Grundrisse, Fensterkreuz und Vorhänge statt schwarzer Scheibe.
 */
export const BAUWELT_AN = teil('bau');
/**
 * D290 (`?lod2=1` / `?echt=1`): echte Silhouetten aus den amtlichen 3D-Gebäudemodellen (LoD2, LDBV, CC BY 4.0) —
 * Trauf- und Firsthöhe, Dachform, Firstrichtung je Gebäude (`public/world/oental-lod2.json`, `tools/lod2import.py`).
 */
export const LOD2_AN = teil('lod2');
export const GRAS_FEIN = suche.get('gras') === '3';
export const GRAS_VIEL = suche.get('gras') === '2' || GRAS_FEIN;
export const GRAS_ECHT = teil('gras') || GRAS_VIEL;
/**
 * Bach im Wald (D267, `bandmaterial.ts`): Die Spiegelung zeigt unterhalb einer Waldkante (~7–27° über
 * dem Wasser) das dunkle Ufer statt Himmel. Ohne Szenenspiegelung reflektierte das Wasser gerade dort,
 * wo Fresnel am stärksten ist (flacher Blick), den hellen Himmel — es lag weiss im Wald.
 */
export const BACH_ECHT = teil('bach');
/**
 * Gewässer wie echt (D280, `bandmaterial.ts`): Wasser hat einen eigenen, dunklen Körper (Streulicht statt
 * schwarzer Albedo), Tiefe nach Uferabstand bis 3 m statt 0,8 m (Teiche und Weiher decken in der Mitte
 * statt Wiese durchscheinen zu lassen), kräftigere Himmelsspiegelung mit Waldkante, und Wellen aus
 * mehrlagigem Rauschen statt zweier Sinuszüge (kein Streifenmuster). Teiche/Weiher ruhig, Bäche bewegter.
 */
export const GEWAESSER_ECHT = teil('gewaesser');
/**
 * Wellenbild nach einem Blender-Wasser-Aufbau (D293, Quelle: Node-Bild von Flo, 15.11.2026): zur Rauschhöhe von
 * D280 eine verzerrte Ringwelle (Wave/Rings/Sine, Distortion ~4,8) zu gleichen Teilen — gebogene, unregelmässige
 * Kämme statt Beulen — und eine feine Lage für das Glitzern. Wirkt nur mit `gewaesser`.
 */
export const WELLEN_ECHT = teil('wellen') && GEWAESSER_ECHT;
/** Stauweiher hinter dem Wehr, aus dem GLB abgeleitet (D268, `weiher.ts`). */
export const WEIHER_AN = teil('weiher');
/**
 * Zeitliche Kantenglättung (D268, `Kontur.tsx`): Kamera-Jitter nach Halton (8 Stellungen), das fertige
 * Bild (nach Kontur, Verdeckung, Bloom) wird gegen das Vorbild aufgelöst — Reprojektion aus der
 * Tiefe, Nachbarschafts-Begrenzung. Gegen das Flimmern von Halmen und Blattkanten in Bewegung, das
 * MSAA nicht fasst (Kantenglättung wirkt nur an Dreieckskanten, nicht in Teilbildpunkt-Strukturen).
 * Kostet drei Vollbild-Ziele (~125 MB bei 2880×1800) und zwei Vollbildpässe.
 */
export const TAA_AN = teil('taa');
/**
 * Flur um die Set-Pieces (D267, `lod.ts`): Industrie- und Siedlungsboden zählt im Häuser-Freihaltekreis
 * eines Bauwerks (`frei.haeuser`) als Wiese. Die Häuser sind dort seit D155 weg, ihre Bodenfarbe blieb —
 * am Stauwehr eine flache, betongraue Ebene im Wald, die wie ein zugefrorener See las.
 */
export const FLUR_GRUEN = teil('flur');
/**
 * Weg B der Gegenüberstellung (D265): ein Himmelsfoto (HDRI, Poly Haven `alps_field`, CC0) als
 * Umgebungslicht für alle Standardmaterialien statt nur der gerechneten Hemisphäre. **Nicht** Teil
 * von `?echt=1`: Es ändert die entschiedene Lichtstimmung (`zielbild`, A-9/ADR-0011) — eine Probe
 * zum Ansehen, keine Vorgabe. `?hdri=1`; die Stärke mit `?hdristaerke=` (Vorgabe 0,8).
 */
export const HDRI_AN = an('hdri');
/**
 * D285 (`?umlicht=1` / `?echt=1`): Bildlicht aus dem eigenen Himmel. Der Spielhimmel der Stimmung (samt Boden-
 * ton) wird per PMREM zur Umgebungskarte und beleuchtet alle Standardmaterialien — Schattenseiten bekommen
 * Himmelsfarbe statt Schwarz, Glanz spiegelt den richtigen Himmel. Anders als `?hdri=1` (D265, Fremdfoto,
 * kühl-türkis) bleibt die Stimmung (A-9) erhalten. Stärke `?umlichtstaerke=` (Vorgabe 0,9).
 */
export const UMLICHT_AN = teil('umlicht') && !HDRI_AN;
export const UMLICHT_STAERKE = (() => { const v = Number(suche.get('umlichtstaerke')); return Number.isFinite(v) && v > 0 ? v : 0.9; })();
export const HDRI_STAERKE = (() => { const v = Number(suche.get('hdristaerke')); return Number.isFinite(v) && v > 0 ? v : 0.8; })();
/**
 * Querbett (D263, `lod.ts`): Breite in Metern jenseits der Uferkante, auf der die hohe Böschung auf
 * den Spiegel abgestochen wird; 0 = aus (Vorgabe). Zwei Netzecken (2 m) plus Rand.
 */
export const BETT_QUER = teil('bett') ? 3 : 0;
/**
 * Schattenkarte (D263): 2048² auf ±250 m sind ~24 cm je Schattenpixel, Schattenkanten im Gras
 * werden zu Treppen. `?echt=1` nimmt 4096² (~12 cm). `?schattenkarte=` überschreibt weiter.
 */
export const SCHATTEN_AUFLOESUNG = ECHT && suche.get('schattenkarte') === null ? 4096 : 2048;
/**
 * Szenenspiegelung im Wasser am Stauwehr (D255): nur einzeln mit `?wasserreflex=1`, **nicht** Teil von
 * `?echt=1`. Sechs Szenenpässe je Aufnahme (~22 Mio Dreiecke) machten das Bild unter SwiftShader so
 * schwer, dass kein Bildschirmfoto mehr zustande kam (12.11.2026), und D255 belegt keinen sichtbaren
 * Gewinn — der dunkle Keil am Wehr ist Geometrie (H-156c).
 */
export const WASSERREFLEX_AN = an('wasserreflex');
/**
 * Kantenglättung im Zwischenbild (`Kontur.tsx`): Seit D155 zeichnet die Szene für AO/Kontur/Bloom
 * in ein Renderziel mit `samples: 0` — `antialias` am Canvas wirkt dann nie, jede Kante hat
 * Treppen. `?msaa=0|2|4|8` setzt die Samples für die Messung am M1; `?echt=1` nimmt 4.
 */
export const MSAA: number = (() => {
  const roh = suche.get('msaa');
  const n = roh === null ? NaN : Number(roh);
  if ([0, 2, 4, 8].includes(n)) return n;
  // D450: In der Zielbild-Felsmulde glättet TAA allein — MSAA 4× kostete dort 4 B/s (19 → 23 am M1, 1920×1080)
  return ECHT && !(LOOK_FELS_AN && TAA_AN) ? 4 : 0;
})();

/**
 * Sichtweite der Props an der Zielbild-Felsmulde (D464): Bäume werden ab 110 m × 1,3 = 143 m zum Fernbild statt ab
 * 176 m (Sichtweite „weit“ 1,6). Im Band 143–176 m standen 0,5 Mio. Dreiecke der Mittelstufe, dort ist ein Baum
 * noch ~120 Pixel hoch — die Fernbilder (D367) sind für 110 m gebaut. `?propweite=1.6` stellt den alten Wert her.
 */
export const LOOK_FELS_PROPWEITE: number = Number(suche.get('propweite')) > 0 ? Number(suche.get('propweite')) : 1.3;

/**
 * Pixeldichte der Zielbild-Felsmulde (D450): `?lookfels=1` rechnet mit 1 statt der Bildschirmdichte. Am M1 bei
 * 1440 × 900 gemessen: Dichte 2 → 15 B/s, Dichte 1 → 31 B/s; TAA und der Malfilter tragen die Kanten. `?dichte=2`
 * stellt die Bildschirmdichte wieder her.
 */
export const LOOK_FELS_DICHTE: number | null = LOOK_FELS_AN ? (Number(suche.get('dichte')) > 0 ? Number(suche.get('dichte')) : 1) : null;

/**
 * B — Pinselstriche (D269, `laubkarten.ts`, `grasteppich.ts`): Laub als grosse Striche mit Pinselbogen
 * statt Foto-Blättern, drei Farbbänder (Licht, Halbton, Schatten) nach der Beleuchtung der Hülle;
 * Gras mit breiteren Halmen und denselben Bändern. Braucht `laubkarten` (steckt in `echt` und `malerei`).
 */
export const PINSEL_AN = teil('pinsel') && (MALEREI || an('pinsel'));
/**
 * C — Malfilter (D269, `Kontur.tsx`): Kuwahara über das Szenenbild vor Kontur und Verdeckung. Vier
 * Sektoren, der mit der kleinsten Varianz gewinnt — Flächen werden glatt, Kanten bleiben. Nachteil:
 * Die „Striche“ liegen am Bildschirm, nicht an der Welt (Schiebefenster-Effekt in Bewegung).
 */
export const KUWAHARA_AN = teil('kuwahara') && (MALEREI || an('kuwahara'));

/** D296: echte Fensteröffnungen mit Laibungen, nur als einzelne Vergleichsprobe. */
export const FENSTERTIEFE_AN = an('fenstertiefe');

/** D297: zusammenhängende Material-/Fenster-/Bewuchsprobe im Dorf, einzeln zuschaltbar. */
export const HAUSFRONT_AN = an('hausfront') || HOF_AN;
