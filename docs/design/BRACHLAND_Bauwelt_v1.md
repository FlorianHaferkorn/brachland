---
last-reviewed: 2026-11-15
shelf-life-days: 180
---
# BRACHLAND — Bauwelt v1: reale Bauten im Œntal und ihr Zustand nach dem Kollaps

**Status:** verbindlich für Gebäude, Siedlungen und Bauwerke seit 15.11.2026 (Ledger D287). Der Story-Bibel untergeordnet.

Flo, 15.11.2026: „Wir müssen das auch auf unsere Geschichte anpassen und zum realen Umfeld. Wir können nicht einfach
Fantasie-Gebäude verwenden, sondern sollten uns an den realen Dörfern, Städten und Gebäuden orientieren und diese
entsprechend für unsere Story anpassen.“

## Grundsatz
1. **Vorbild ist der reale Bestand** im Ausschnitt Inntal-Süd (bbox 47,715–47,751 N / 12,055–12,108 E: Brannenburg,
   Degerndorf, Rand Flintsbach). Grundrisse kommen aus OSM, Form und Material aus den Bautypen unten. Fantasie-Bauten
   (Rundtempel, Fachwerk-Märchenhäuser, Burgen, die es hier nicht gibt) sind ausgeschlossen. Fachwerk ist im Inntal
   **nicht** regional — das Obergeschoss ist Blockbau, der Giebel verbrettert, Zier höchstens als Giebelbundwerk.
2. **Die Story-Bibel setzt den Zustand:** 40–60 Jahre nach dem Kollaps, Namen als erodierte Echos, Vergangenheit
   archäologisch erzählt. Jedes Gebäude bekommt eine **Verfallsstufe** und eine **Nutzung**.
3. **Referenzbilder** (z. B. Florian Renaux, Instagram 26.10.2026) gelten nur für **Licht, Bewuchs und Materialtiefe**,
   nie für Bauformen.

## Zustand nach dem Kollaps — Regeln
| Stufe | Wo | Bild |
|---|---|---|
| **0 bewohnt** | Enklave auf der Hangterrasse (Name offen, A-24; vorläufig „Die Terrasse“, D375), wenige Einzelhöfe | Bestand geflickt: Bretter vor Fensterlöchern, Wellblech auf Dachschäden, Gärten statt Rasen, Rauch, Fensterlicht (Glut D134), Wäsche, Brennholz. Kein Befall. |
| **1 verlassen, intakt** | Ortsränder, Höfe in Einzellage | Dach geschlossen, Moos und Gras auf der Dachhaut, Efeu/Waldrebe an der Wetterseite, Fenster blind, Läden schief, Lauben morsch, Gras und Birken im Hof. |
| **2 verfallen** | Talboden, Hanglagen | Dach eingesunken (Teilfläche fehlt, Sparren sichtbar), Laube abgestürzt, Blockbau-OG dunkel verwittert, Birken/Holunder im Haus, Wände stark überwachsen. |
| **3 Ruine** | einzelne Orte der Story (Altstollen, Ruine) | nur Erdgeschoss-Mauerwerk aus Nagelfluh/Feldstein, Bäume darin, kein Dach. |
| **Befall** | überall möglich, aber mit **Quellen**: Infrastruktur (Trafo, Kläranlage, Stollen, Werk) sind die Herde, von dort breitet er sich aus (Flo 22.11.2026, Ledger D433) | an den Quellen dicht mit Verwachsenen (Tier × Infrastruktur); abseits davon als Ausläufer: bleiches Geflecht, das sich als Band ausbreitet, hinten alt und tot, vorn frisch und eisblau pulsierend. Die **eine** Signalfarbe (ADR-0002) bleibt. |

Zuweisung im Generator: aus Lage (Abstand zur Enklave, Einzellage, Höhe), Grundfläche und einem Würfel je Gebäude —
deterministisch (Seed), nicht gespeichert (CLAUDE.md, Performance-Invarianten).

## Typzuweisung aus den Daten
OSM liefert je Gebäude nur `punkte`, `ebenen`, `art`; `ebenen = 2` ist bei 1.820 von 2.033 ein Default und taugt
**nicht**. Typ daher aus **Grundfläche, Seitenverhältnis und Lage**:

| Klasse | Typ |
|---|---|
| 400–1.500 m², L/B ≈ 1,4–2,2, Einzellage oder Ortsrand | Einfirsthof (Wohnteil + Tenne unter einem First) |
| 150–400 m² | Wohnhaus / Siedlungshaus 20. Jh. / kleiner Hof |
| 50–150 m² | Austragshaus, kleines Wohnhaus, Garage (`art = garage`) |
| < 50 m² | Stadel, Schuppen, Kapelle (`art = chapel`) |
| `art = church` | Kirche nach Tabelle (Brannenburg **Spitzhelm**, Degerndorf Christkönig **Zwiebelhaube**) |
| > 1.500 m² | Gewerbe/Halle (Degerndorf) — im Kollaps Werk/Lager, Kandidat für Befall |

## Recherche (15.11.2026)

### Teil A — Bautypen

#### 1. Inntaler Bauernhaus (Einfirsthof)
Die Denkmallisten Brannenburg (33 Bauernhäuser) und Flintsbach (11) beschreiben fast wörtlich gleich: *„Einfirsthof, zweigeschossiger Flachsatteldachbau mit Blockbau-Obergeschoss, umlaufender Laube und Hochlaube, verbrettertem Giebel"*, teils *„Giebelbundwerk"*, Sockel/EG aus *Nagelfluh- oder Feldsteinmauerwerk*, Firstpfette mit Datierung. Datierung meist 18. Jh. / um 1800, ältestes Datum 1542 (St. Margarethen 10), späteste um 1850. [Beleg]

| Merkmal | Wert |
|---|---|
| Geschosse | 2 + Dachgeschoss mit Hochlaube [Beleg] |
| Grundriss | Wohnteil (Giebel zur Straße/Tal) + Tenne/Stall unter **einem** First; in Längsrichtung gereiht (Mittertenne möglich) [Richtwert] |
| Maße | Wohnteil ca. 10–13 m breit; Gesamtlänge mit Wirtschaftsteil 25–40 m [Richtwert; deckt sich mit Teil B: große Grundrisse median 35 × 21 m] |
| Dachneigung | flach, ca. 18–25° („Flachsatteldach") [Richtwert; Bebauungspläne der Region schreiben bis heute 18–24° vor, z. B. Obing] |
| Dachüberstand | groß: Traufe ca. 1,0–1,5 m, Giebel 1,5–2,5 m (überdeckt die Lauben) [Richtwert] |
| EG | verputztes Mauerwerk (Nagelfluh/Feldstein), weiß gekalkt [Beleg/Richtwert Farbe] |
| OG | Blockbau, Holz sonnenseitig dunkel nachgedunkelt (braun-schwarz) [Beleg/Richtwert] |
| Giebel | verbrettert, ggf. Bundwerk (sichtbare Zierverstrebung) [Beleg] |
| Lauben | umlaufend am OG + Hochlaube im Giebel, Brüstung aus ausgesägten Brettern [Beleg/Richtwert] |
| Dach historisch | Legschindeln, mit Steinen beschwert (flache Neigung als Grund) [Richtwert, Salzburger Parallele: „flachgeneigte Pfettendächer, mit Legschindeln gedeckt"] |
| Dach heute | Betonstein/Ziegel braun-rot oder anthrazit, Blech am Wirtschaftsteil [Richtwert] |
| Fensterläden | grün oder grün-weiß geflammt [Richtwert, UNKLAR] |
| Wandmalerei | „Wandmalereien/Wandbild" in Flintsbach belegt; Wort „Lüftlmalerei" taucht nicht auf → sparsam einsetzen [Beleg] |

#### 2. Dorfhaus / Austragshaus / Siedlungshaus 20. Jh.
„Zuhaus" (Austrag) belegt in Erlach, Vorderkronberg [Beleg]: kleiner Ableger des Bauernhauses, 1–2 Geschosse, 8 × 10 m. Nachkriegs-/Siedlungshaus („oberbayerischer Stil"): 2 Geschosse, weiß verputzt, OG oder Giebel holzverschalt, Satteldach 18–25°, Überstand 0,8–1,2 m, Holzbalkon über die Giebelbreite, oft Garage daneben [Richtwert]. Regionale Bebauungspläne: Balkon ≤1,80 m tief, Dachüberstand ≥20 cm über Balkon (Pittenhart) [Beleg, Nachbarkommune].

#### 3. Heustadel / Stadel
Freistehende Feldstadel: Holz-Ständer- oder Blockbau, offene Bretterschalung mit Fugen, flaches Satteldach, ca. 5 × 7 m, eingeschossig; Dach Schindel/heute Blech [Richtwert, UNKLAR]. Hofnebengebäude/„Hofkapelle mit Giebelbundwerk" Milbinger Str. 26 belegt.

#### 4. Almhütte (Wendelstein)
Hütten am Weg: Mitteralm (1200 m, DAV Bergbund Rosenheim, Bedarfshalt der Zahnradbahn), Siglhütte (DAV Oberland), Wendelsteinhaus (1882/83). Gipfelkapelle 1718: *„ovaler, verschindelter Holzbau auf Steinsockel mit Satteldach"* [Beleg]. Typ Kaser: Bruchstein-EG/Stall, Blockbau-Wohnteil, flaches Schindel-/Blechdach, ca. 7 × 10 m [Richtwert]. Wendelsteinkirche (1889/90, neugotisch, höchstgelegene Kirche Deutschlands, 1730 m).

#### 5. Kirchen (Turmform)
| Kirche | Ort | Turm [Beleg] |
|---|---|---|
| Pfarrkirche Mariä Himmelfahrt | Brannenburg, Kirchplatz 5 | Westturm mit **Spitzhelm** |
| Pfarrkirche Christkönig | Degerndorf, Kirchenstr. 22 | **Zwiebelhaube** |
| Filialkirche St. Ägidius | Degerndorf, Rosenheimer Str. 18 | Nordturm, Spitzhelm |
| Wallfahrtskirche St. Maria Magdalena | Biber (Degerndorf) | SW-Turm, **Zwiebelhaube**; Kreuzweg 1733–36 |
| Mariahilf u. St. Johann Nepomuk | Schwarzlack | Dachreiter, Spitzhelm |
| St. Margarethen | St. Margarethen | Südturm mit Treppengiebel |
| Pfarrkirche St. Martin | Flintsbach | Südturm mit Kuppel + Laterne (Barock 1734/35) |
| St. Johannes Ev. | Fischbach | welsche Haube (1824) |
| St. Peter | Petersberg | Nordturm, Schopfwalmdach |

Fazit: „Zwiebelturm überall" ist falsch — der Hauptort Brannenburg hat einen **Spitzhelm**. Saalbau mit Satteldach, weiß verputzt, spätgotischer Kern, barock überformt.
Hinweis: Die ADAC-Seite nennt „St. Margareth, 1733" als Pfarrkirche Brannenburg — widerspricht der Denkmalliste → UNKLAR, Denkmalliste bevorzugt.

#### 6. Kapelle / Wegkreuz / Marterl
Belegt: Hofkapellen (halbrund, Steildach, 19. Jh.; Kirnstein neobarock 1875), Wegkapelle Kufsteiner Str. 135 (offene Nische mit Schmiedeeisengitter, 18. Jh.), Friedhofskapelle Flintsbach (achteckig, Zeltdach). Maßstab 2–4 × 3–5 m, weiß, Schindel-/Blechdach. Marterl/Wegkreuze: Holzkreuz mit kleinem Blechdach [Richtwert].

#### 7. Burgruine Falkenstein / Petersberg
Falkenstein (untere Burg, 536 m): Bergfried „nach 1296", Ringmauer 15. Jh. mit zwei Türmen, Vorburg 15./16. Jh., zeitweise Hof in der Ruine, 2024 Regenschäden/Funde, Zugang wegen Sanierung gesperrt (Stand UNKLAR). Alt-Falkenstein (Rachelburg): minimale Mauerreste. Petersberg (Kleiner Madron): Kirche St. Peter (1135 gegr., Weihe 1139, Ausbau Krumpper 1605–10), ehem. Propstei heute Gasthaus (zweigeschossiger Walmdachbau 1696, nach Brand 1832). [Beleg]

#### 8. Infrastruktur
- **Wendelsteinbahn**: älteste deutsche Zahnradbahn, 1910–12 (Steinbeis); 7 Tunnel, 8 Galerien, 12 Brücken, „Hohe Mauer" 17 m; Talbahnhof bis 1961 am Bf. Degerndorf, seitdem **Waching** (Sudelfeldstr.); eigenes Wasserkraftwerk Hinterkronberg (1910) [Beleg].
- **Bahn Rosenheim–Kufstein** (Bf. Brannenburg in Degerndorf, Flintsbach) und **A93** im Inntal [Allgemeinwissen, Trassen in OSM].
- **Innkraftwerke**: Nußdorf (1982, 48 MW) talabwärts; Oberaudorf-Ebbs (1988–92, 60 MW) talaufwärts — beide außerhalb der bbox [Beleg VERBUND].
- **Kies/Hartstein**: Regionalplan weist Vorranggebiete für Kies und Hartgestein in Flintsbach und Brannenburg aus [Beleg]; unsere Daten enthalten drei `landuse=quarry` um 47.727–47.730 N / 12.107–12.110 E (Steinbruch, Betreiber UNKLAR).
- **Kläranlage**: kein Beleg gefunden → UNKLAR.

### Teil B — Auswertung `public/world/oental.json`

Felder je Gebäude nur `punkte`, `ebenen`, `art` (= OSM `building`). 2033 Gebäude, 42,8 ha Grundfläche.

| art | n | Median m² |
|---|---|---|
| yes (unbestimmt) | 1685 | 171 |
| garage / garages | 186 / 4 | 61 / 103 |
| farm / farm_auxiliary | 39 / 1 | 205 / 870 |
| detached / house / semidetached / terrace | 26 / 18 / 8 / 4 | 227 / 64 / 97 / 84 |
| apartments | 18 | 214 |
| church / chapel | 6 / 3 | 254 / 10 |
| hut / cabin / shed / roof | 6 / 2 / 4 / 3 | 74 / 65 / 13 / 48 |
| retail, kindergarten, sports_hall, school, train_station u. a. | 22 | – |

**Geschosse:** 1 → 207, 2 → 1820, 3 → 5, 4 → 1. Die 2 ist offenkundig ein **Default** (fehlendes `building:levels`); 1 kommt fast nur bei Garagen. `ebenen` taugt nicht zur Typunterscheidung.

**Grundfläche** (äquirektangulär, lat0 = 47.733): Median 160 m², P10 56, P25 90, P75 247, P90 359, P99 1289, Max 5005.

| Klasse | n | Lesart | Median L × B |
|---|---|---|---|
| < 50 m² | 171 | Garage, Schuppen, Stadel, Kapelle | 6,9 × 5,2 m |
| 50–150 m² | 785 | Garage, Austrag, kleines Wohnhaus | 12,3 × 8,1 m |
| 150–400 m² | 908 | Wohnhaus, Siedlungshaus, kleiner Hof | 18,7 × 13,6 m |
| 400–1500 m² | 156 | **Einfirsthof**, Gewerbe | 35,1 × 21,5 m (L/B 1,66) |
| > 1500 m² | 13 | Gewerbe/Halle/Schule, Turnhalle | – |

**Schätzung:** wahrscheinlich Bauernhäuser ≈ 120–160 (Klasse 400–1500 m² minus Gewerbe/Schule; nur 39 sind als `farm` getaggt, deren Fläche streut von 23 bis 1467 m²). Klein (< 100 m²: Garagen/Nebengebäude) ≈ 600. Die größten `yes`-Bauten (5005, 3472, 3284 m² bei 47.746/12.095–12.103) sind wohl Gewerbe/Industrie in Degerndorf (UNKLAR). Für die Typzuweisung im Generator: Fläche + Seitenverhältnis + Lage (Ortskern vs. Einzellage) statt `ebenen`.


## Umsetzung (Generator `src/world/terrain.ts`, Material `src/world/hausmaterial.ts`)
Reihenfolge nach Wirkung:
1. **Dach:** Flachsatteldach 18–25°, Überstand Traufe 1,0–1,5 m, Giebel 1,5–2,5 m (deckt die Lauben). Dachhaut
   Betonstein/Ziegel (Scan `grey_roof_tiles`, D284), Wirtschaftsteil Blech; Moos/Gras nach Stufe.
2. **Einfirsthof:** Wohnteil (Putz-EG, Blockbau-OG, umlaufende Laube, Hochlaube im Giebel) und Tenne/Stall unter
   einem First, Tennentor; Giebelbundwerk als Zier.
3. **Verfallsstufen** wie oben, inklusive Bewuchs als Blattkarten (Technik D282) und Moos-/Feuchtemaske im Material.
4. **Sonderbauten:** Kirchen nach Tabelle (Turmform je Ort), Kapellen/Marterl, Stadel, Almkaser am Hang.
5. **Infrastruktur:** Bahn Rosenheim–Kufstein, Wendelsteinbahn-Talstation Waching, Steinbruch (3× `landuse=quarry`),
   A93 — als Ruinen/Trassen; hier liegen die Quellen des Befalls (Ausläufer überall, Ledger D433).

Richtwerte (Neigung, Überstand, Ladenfarbe) sind nicht belegt (UNKLAR) — vor Festschreibung gegen Fotos der
Denkmalliste oder Glentleiten prüfen.

## Quellen (abgerufen 15.11.2026)
- Liste der Baudenkmäler in Brannenburg (nach BLfD): https://de.wikipedia.org/wiki/Liste_der_Baudenkmäler_in_Brannenburg
- Liste der Baudenkmäler in Flintsbach am Inn: https://de.wikipedia.org/wiki/Liste_der_Baudenkmäler_in_Flintsbach_am_Inn
- Einfirsthof (Wikipedia de): https://de.wikipedia.org/wiki/Einfirsthof
- Ländliche Baugeschichte Salzburgs (Legschindel-Pfettendächer): https://www.zukunft-bau.at/sites/default/files/dateien/inhalt/landliche-baugeschichte-salzburgs.pdf
- Bundwerk, LK Salzburg: https://sbg.lko.at/das-bundwerk-kommt-wieder-in-mode+2400+3383632
- Burgenwelt Falkenstein: https://www.burgenwelt.org/deutschland/falkenstein3/burgenwelt-falkensteinby-deutschland.pdf
- St. Peter am Madron: https://en.wikipedia.org/wiki/Saint_Peter%27s_Abbey_on_the_Madron
- Regenschäden Falkenstein 2024: https://www.schwaebische.de/regional/bayern/burg-falkenstein-regenmassen-legen-historische-funde-frei-2664588
- VERBUND Innkraftwerke: https://power.verbund.com/media/kwao5nyg/die-wasserkraftwerke-am-inn.pdf
- Regionalplan Südostoberbayern (Rohstoffe): https://www.region-suedostoberbayern.bayern.de/files/RP18_Text_PDF/RP18_Text_B-V_Ziele.pdf
- Bebauungsplan Obing/Frabertsham (18–24°): https://www.obing.de/media/sites/3/Frabertsham-Nord-Kellerstrasse-4-2.-Ausl.-11-11-25.pdf
- Bebauungsplan Pittenhart: https://www.pittenhart.de/media/sites/4/2022-01-18_Oberbrunn-Nord-Pittenhart_BPL-Erweiterung-1.pdf
- Hütten am Wendelstein: https://www.hoehenrausch.de/huetten/mitteralm/ · https://wendelsteinbahn.de/en/wendelsteinhaus-restaurant-1
- ADAC Brannenburg (widersprüchlich): https://maps.adac.de/ort/brannenburg-bayern

Nicht erreicht: Denkmal-Atlas direkt, Glentleiten/Amerang-Objektseiten, Gemeindeseiten. Diese als nächste Quelle für Dachneigung/Überstand/Ladenfarbe einplanen.
