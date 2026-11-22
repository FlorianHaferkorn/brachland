---
last-reviewed: 2026-11-22
shelf-life-days: 365
---
# Befunde: Woraus entsteht die Bildwirkung der Landschaft?

Stand 22.11.2026 · Stilvorlage zu ADR-0018 (gemalter Realismus) · **nur lokal, gitignored**

**Zweck und Grenze.** 43 offizielle Bilder aus vier Spielen, alle einzeln gesichtet. Die Bilder sind
urheberrechtlich geschützt (Quellen und Rechteinhaber: `quellen.json`) und dienen nur der Analyse der
Bildwirkung. Übernommen wird Handwerk (Licht, Dichte, Schichtung, Material), nie ein Motiv oder eine Gestalt
(ADR-0004). Nichts davon gehört ins Repo oder nach `public/`.

**Drei Vorbehalte, die jede Zahl unten einschränken:**

1. Es sind **Marketing-Standbilder**: ausgesuchte Kamera, oft Fotomodus, teils nachbearbeitet. Sie zeigen das
   Zielbild der Studios, nicht den Durchschnitt im Spiel. Eine Look-Abnahme für BRACHLAND ersetzt das nicht
   (CLAUDE.md: Look nur am Zielgerät in Bewegung).
2. Die **Messwerte** sind aus den 8-Bit-JPEGs gerechnet (sRGB 0..1, 480 px Breite, Rec.709-Luma), also nach
   Tonemapping und Grading der Studios. Sie sind Zielwerte für das *fertige Bild*, keine Szenen-Beleuchtungswerte.
   Legende: `L` = mittlere Helligkeit, `dkl` = Pixelanteil L < 0.2, `hell` = Anteil L > 0.7, `oben/unten` =
   Helligkeit oberes Drittel / untere zwei Drittel, `R−B` = Wärme in den hellsten 20 % bzw. dunkelsten 30 %
   (positiv warm, negativ kühl). Alle Einzelwerte stehen in `quellen.json`.
3. Angaben wie „4 Tiefenebenen“ oder „30 % Boden sichtbar“ sind **Schätzungen am Bild**, keine Messung.

Kürzel: SF = `soulframe/`, PBZ = `phantom-blade-zero/`, BoD = `blood-of-dawnwalker/`, ER = `elden-ring/`.

## Median je Spiel

| Spiel | Bilder | L | dkl | hell | oben | unten | Sättigung | R−B Lichter | R−B Schatten |
|---|---|---|---|---|---|---|---|---|---|
| Soulframe | 11 | 0.29 | 33 % | 2 % | 0.34 | 0.25 | 0.29 | +0.11 | +0.04 |
| Phantom Blade Zero | 12 | 0.35 | 32 % | 8 % | 0.47 | 0.28 | 0.21 | +0.02 | −0.02 |
| Blood of Dawnwalker | 9 (7 gemessen) | 0.24 | 56 % | 4 % | 0.33 | 0.20 | 0.31 | −0.01 | +0.01 |
| Elden Ring | 11 | 0.32 | 26 % | 3 % | 0.35 | 0.31 | 0.35 | +0.03 | −0.02 |
| **alle** | 43 | **0.32** | **33 %** | **4 %** | 0.37 | 0.25 | 0.29 | +0.04 | +0.01 |

Die zwei BoD-Concept-Bilder mit UI-Rahmen sind aus dem Median ausgenommen. Der Himmel/das obere Drittel ist im
Median 1.5-mal so hell wie der Rest. Auffällig über alle Spiele: **fast nichts ist wirklich hell** (4 % der
Fläche über 0.7) und **ein Drittel ist dunkel**. Die Bilder leben in den unteren Mitteltönen.

---

## Soulframe (Digital Extremes) — die Messlatte (ADR-0012)

11 Bilder: `steam_01..06` (Steam), `web_01..05` (soulframe.com).

**1. Licht.** Durchgehend tiefe Sonne, 10–25° über dem Horizont, meist seitlich-hinten (Dreiviertel-Gegenlicht).
Belege: lange Schlagschatten quer über den Weg in `steam_06`, Kronenschatten als Fleckenmuster auf Boden und
Tierfell in `steam_02`, `steam_06`, `web_05`. Lichter warm (R−B +0.10 bis +0.25), Schatten bleiben **leicht warm
bis neutral** (+0.03 bis +0.07) statt blau. Der Warm-Kalt-Kontrast ist also schwach; die Wärme kommt aus einem
warmen Gesamtschleier. Dunkelanteil 16–59 %, im Wald typisch 30–55 % (`steam_03` 55 %, `web_01` 45 %).
Lichtflecken: 10–20 % des Bodens, weich berandet, nie hart ausgestanzt. Volumenlicht in jedem Waldbild: breite,
weiche Bahnen zwischen den Stämmen (`web_01`, `steam_02`, `steam_06`), keine scharfen „God Rays“.

**2. Luft/Tiefe.** 3–4 Ebenen. Typisch in `steam_06`: Vordergrund klar (0–8 m), Mittelgrund mit leicht
angehobenen Schwarzwerten (8–30 m), Hintergrundbäume nur noch als Tonwert-Silhouetten (30–80 m, etwa 60–70 %
Dunst), dahinter Himmel. Dunstfarbe = Himmelsfarbe, warm-grau bis gelblich-beige, nie reines Weiss. Extremfall
`web_02`: Nebel ersetzt alle Farbe (Sättigung 0.09, nur 2 % dunkle Pixel), die Tiefe entsteht allein aus drei
Tonwertstufen der Stämme. Der Dunst liegt als **Bodenschicht**: zwischen den Stämmen dicht, oben dünn
(`steam_02`, `steam_06`).

**3. Vegetation.** Alle fünf Schichten sind belegt, aber locker: Bodendecker/Moos, Gras 20–40 cm in Büscheln,
Blühkraut als Farbinseln (`steam_03` rosa, `web_04` rot/weiss), Farn und Strauch am Stammfuss, dann Stamm und
Krone. Sichtbarer nackter Boden (Erde, Kies, Fels) auf dem Weg 40–60 % (`steam_06`, `steam_02`), abseits 10–20 %.
Baumsilhouetten sind das Markenzeichen: **dicke, gedrehte Stämme mit ausgeprägtem Wurzelanlauf**, wenige grosse
Äste, eher knorrig als hoch (`steam_03`, `web_02`, `steam_02`). Kronen licht: 40–60 % Himmel scheint durch
(`steam_02`), darum landet überhaupt Licht am Boden. Nadelbäume in `steam_06` schlank, mit Lücken im Astwerk.

**4. Stein/Mauer/Holz.** Rinde ist **geometrisch tief**: Wülste, Drehwuchs, Höhlungen im Zentimeter- bis
Dezimeterbereich (`steam_03`, `web_02`), nicht nur Normal-Map. Fels gross geformt, weich gerundet, mit Moos als
**Kappe auf den Oberseiten** (`steam_03` rechts, `steam_06`), Flanken kahl. Mauerwerk in `web_04` (Brücke) und
`steam_04` (Turm): unregelmässige Quader, 2–3 Farbtöne nebeneinander, Fugen dunkel, Kanten gebrochen. Kaum
Feuchteglanz ausser im Regen-/Nachtbild (`web_03`).

**5. Häuser/Ruinen.** Bauten nehmen 10–25 % der Bildfläche ein und stehen fast immer **im Dunst der zweiten
oder dritten Ebene** (`steam_04` Turm, `web_05` Burg, `web_04` Brücke). Sie sind Silhouette zuerst, Detail
zweitens. Einbettung: Gras und Kraut reichen bis an den Mauerfuss, es gibt keine saubere Sockellinie (`steam_01`,
`web_04`).

**6. Boden/Wege.** Der Weg ist kein Band, sondern eine **Ausdünnung**: Kies und Erde mit einzelnen Steinen,
Grasbüschel wachsen von den Rändern unregelmässig hinein, Übergangszone 0.5–1.5 m breit (`steam_06`, `steam_02`).
Drei Materialien mischen sich (Erde, Kies/Stein, Gras), dazu Laub/Nadeln als vierte, feine Streuschicht.

**7. Himmel.** Meist verschleiert, hell-warmgrau, kaum Zeichnung (`steam_02`, `steam_06`); 1.2–2-mal so hell
wie der Boden. Dramatische Wolken nur in den Stimmungsbildern (`steam_05`, `web_05`). Der Himmel ist Lichtquelle
und Dunstfarbe, selten Motiv.

**8. Komposition.** Fast immer ein **dunkler Vordergrundrahmen**: Stamm und Ast oben/seitlich (`steam_02`,
`steam_03`, `web_02`), Fels oder Hang unten (`web_05`, `steam_06`). Der Weg oder eine Lichtbahn führt diagonal
zum hellsten Fleck. Horizont auf 55–65 % Bildhöhe von unten (Schulterkamera), also mehr Boden als Himmel.

**9. Stilisierung.** Gemalt: einheitlicher Farbschleier (2–3 Farbfamilien je Bild), Ferne zu Tonflächen
zusammengezogen, Baumformen übertrieben, weiche Lichtkanten. Realistisch: Rinde, Fell, Stoff, Gras im
Nahbereich. Das deckt sich genau mit ADR-0018 Punkt 1 und 2.

---

## Phantom Blade Zero (S-GAME)

12 Bilder: `steam_00, 01, 02, 04, 06, 07` (Steam), `web_004, 005, 008, 3, 4, 6` (pbz.s-game.com).

**1. Licht.** Zwei Modi. (a) **Bedeckt/Regen**, der Normalfall: kein Sonnenstand erkennbar, weiches Oberlicht
aus dem Himmel, Lichter kühl (R−B −0.05 bis −0.10), fast monochrom grau-blaugrün, Sättigung 0.14–0.19
(`web_3`, `web_4`, `web_6`, `steam_04`, `steam_06`). (b) **Tiefes Gegenlicht**: Sonne im Bild oder knapp
ausserhalb, alles in einer Farbe gebadet (`web_008` R−B +0.34, `steam_07` +0.28). Dazu der Waldfall `web_005`:
77 % dunkel, ein einziges Lichtloch im Blätterdach, Lichtflecken auf unter 10 % der Fläche. `web_004` ist das
Extrem: 91 % dunkel, **eine** warme Lichtquelle im Zentrum. Warme Akzente im kühlen Bild sind punktförmig und
klein (Laternen in `web_4`, Dorflichter in `steam_06`), unter 1 % der Fläche.

**2. Luft/Tiefe.** Die klarste Staffelung aller vier Spiele: 5–6 Ebenen in `web_6` (Dach vorn, Stege, Wasser,
Insel, Bergkette 1, Bergkette 2) und `steam_06`. Jede Ebene ist rund **eine Tonstufe heller und kontrastärmer**
als die davor; die letzte Bergkette liegt nur noch 5–10 % unter dem Himmelswert. Dunstfarbe kühl-blaugrau, im
Gegenlicht gold. Zusätzlich **Nebelbänke als eigene Formen**, die an Bergflanken hochziehen (`web_6`), und
Bodennebel über der Fläche (`steam_01`). Dunst setzt früh ein: in der Gasse `web_3` ist schon nach 20–30 m die
Hälfte des Kontrasts weg.

**3. Vegetation.** Sparsam und gezielt, 10–25 % der Fläche. Unkraut und Gras wachsen **in den Fugen und
Brüchen** der gebauten Welt (`steam_06` Brücke, `web_3`, `web_4`), Efeu hängt von Dächern. Bäume als
ausdrucksstarke Einzelsilhouetten: waagrecht geschichtete Kiefernkronen (`steam_06`, `steam_02`), ein windschiefer
Einzelbaum (`web_008`), kahles Geäst vor hellem Himmel (`steam_00`). Der dichte Fall ist `web_005`: Bambus als
geschlossene Wand, 90 % Bewuchs, Kronendach fast zu.

**4. Stein/Mauer/Holz.** Hier liegt die Materialstärke. Holzbohlen mit **tiefer Maserung, Rissen, ausgebrochenen
Enden, verzogenen Brettern**, jedes Brett in Ton und Lage etwas anders (`web_3` Vordergrund, `steam_06`,
`steam_02`). Alles ist **nass**: Bohlen, Pflaster und Ziegel haben einen breiten, matten Glanz, der den Himmel
spiegelt und die Fläche aufhellt (`steam_06`, `web_4`). Dachziegel mit Moosbelag (`web_6` rechts), Naturstein
im Sockel grob und dunkel. Farbvariation gering (alles grau-braun), die Variation liegt in **Helligkeit und
Glanz**.

**5. Häuser/Ruinen.** Bauten dominieren: 40–60 % der Bildfläche (`web_3`, `web_4`, `steam_00`). Verfall durch
**Formstörung**: durchhängende Firste, fehlende Dachteile, schiefe Pfosten, geflickte Vordächer, herumliegende
Bretter. Kein Haus ist gerade. Einbettung über Efeu an den Wänden, Gras am Sockel, Kleinkram davor (Krüge,
Holzstapel, Zaunreste in `web_4`). Seile und Laternen spannen sich quer und verbinden die Baukörper.

**6. Boden/Wege.** Pflaster mit breiten, bewachsenen Fugen, einzelne Platten fehlen oder sind gekippt; daneben
Matsch mit Pfützen (`web_4`, `steam_07`). Holzstege mit Laub, Grasbüscheln und Schlammresten (`steam_06`).
Kies/Geröll am Ufer mit nassem, dunklem Saum (`steam_04`). Übergänge immer über eine dritte Zutat: Laub, Schlamm
oder Gras kaschieren die Materialgrenze.

**7. Himmel.** Im Regenmodus eine fast gleichmässig helle Fläche ohne Zeichnung, 1.5–3-mal so hell wie die
Landschaft (`steam_00` oben 0.66 / unten 0.22, `web_6` 0.69 / 0.35). Der Himmel ist die hellste Fläche und
macht alles davor zur Silhouette. Im Abendbild `web_008` strukturierte, gerichtete Wolkenbänder, die zur Sonne
laufen.

**8. Komposition.** Strenge **Zentralperspektive**: Brücke, Gasse oder Steg laufen auf einen Fluchtpunkt im
hellen Dunst (`steam_06`, `web_3`, `web_005`). Vordergrundrahmen aus Architektur: Pfosten rechts, Dachkante oben
(`web_3`, `web_4`, `web_6`). Vögel und Laub als bewegte Punkte geben dem leeren Himmel Massstab. Horizont
mittig bis hoch (50–65 %); im Panorama `web_6` Aufsicht von oben.

**9. Stilisierung.** Gemalt nach dem Vorbild der Tuschemalerei: **Ferne als gewaschene Tonflächen**, radikal
reduzierte Palette (eine Farbfamilie plus ein Akzent), Berge als erfundene, übersteile Silhouetten.
Fotorealistisch-detailliert: Holz, Stein, Stoff und Nässe im Nahbereich. Die Trennlinie liegt bei etwa 30 m.

---

## The Blood of Dawnwalker (Rebel Wolves)

9 Bilder: `steam_00, 02, 03, 04, 05` (Steam), `steam_extra_01, 02` (Store-Banner, nur 780×292),
`steam_eclipse_01, 02` (offizielle Concept-Paintings im Kompendium-Viewer, mit UI-Rahmen).
Schwächste Datenlage: die Store-Screenshots sind überwiegend Figuren und Innenräume.

**1. Licht.** Das **härteste Licht** der vier. Tag: klare Bergsonne, mittelhoch (30–45°), scharfe Schlagschatten,
Schatten fast schwarz. In `steam_02` liegt die Hälfte des Platzes (49 % dunkel) im Schatten der Häuser, die
Fassaden gegenüber stehen voll im Licht. `steam_00`: 56 % dunkel bei blauem Himmel. Farbe neutral bis kühl
(R−B um 0), die Wärme kommt aus dem Material (Lehmputz, Holz, trockenes Gras), nicht aus dem Licht. Nacht
(`steam_03`): 89 % dunkel, kaltes Mondlicht von hinten als Kantenlicht und Dunst, dazu **kleine warme Feuer**
(Kohlebecken, Fenster) mit Spiegelung im nassen Pflaster. `steam_04`: Volumenlicht als harter Strahlenkegel aus
einer Deckenöffnung in sonst schwarzem Raum.

**2. Luft/Tiefe.** 4–5 Ebenen im Gebirge (`steam_extra_01`, `steam_extra_02`): dunkler Nadelwald vorn,
bewaldeter Hang, Felsgrat, Schneegipfel, Wolken. Der Dunst ist **kühl-blau und dünn**; die Ferne bleibt lesbar
und wird vor allem blauer und heller, nicht grau. Die Gipfel sind die hellste Fläche der Landschaft. Im Dorf
`steam_05` staffeln sich Blockhaus (klar), Turm (heller, blau-grau) und Fels dahinter in drei Stufen auf
kurzer Distanz.

**3. Vegetation.** Montan und sparsam: trockenes, gelb-grünes Gras 15–30 cm, niedrige Sträucher, einzelne
dunkle Fichten und Kiefern als fast schwarze, spitze Silhouetten (`steam_00`, `steam_extra_01`). Sichtbarer
Boden 40–60 % (Fels, Erde, Pfad). Nadelkronen dicht und dunkel, sie wirken als Masse, nicht als Blattwerk. Das
Concept `steam_eclipse_02` zeigt den Gegenentwurf: ein mächtiger Einzelbaum mit ockerfarbener Krone als
Dorfmitte, Vordergrund aus hohem, rostbraunem Kraut.

**4. Stein/Mauer/Holz.** Fachwerk mit **sichtbar krummen Balken**, Lehmgefachen in 3–4 Tönen (Ocker, Grau,
Rosa), Flecken, Abplatzungen und Wasserläufern unter den Fenstern (`steam_02`). Bruchsteinsockel mit grossen,
unregelmässigen Steinen. Blockbau aus dicken, verwitterten Rundstämmen mit dunklen Stirnseiten (`steam_05`).
Fels kantig und geschichtet, hellgrau, Moos nur in Spalten (`steam_00`). Nasses Kopfsteinpflaster bei Nacht mit
starkem Glanz (`steam_03`). Wenig Bewuchs an Bauten: die Welt ist bewohnt, nicht verlassen.

**5. Häuser/Ruinen.** In `steam_02` 50–60 % der Bildfläche; mehrgeschossig, vorkragende Obergeschosse, steile
Dächer, dicht an dicht. Verfall ist **Abnutzung statt Ruine**: schiefe Linien, durchhängende Strohdächer,
geflickte Planen. In `steam_00` steht ein Turm mit hölzernem Wehrgang direkt am Fels, 25 % der Fläche, als
dunkler Rahmen links. Im Concept `steam_eclipse_02` ducken sich die Strohdachhäuser unter den Baum und sind
kaum höher als das Kraut im Vordergrund; `steam_eclipse_01` staffelt Dächer als Zickzackmuster bis zur
Kathedrale.

**6. Boden/Wege.** Festgetretener Lehm mit Spurrillen, Fussabdrücken und Strohresten (`steam_02`, `steam_05`).
Bergpfad als heller Erdstreifen zwischen Fels und Gras mit weichem, 0.5 m breitem Übergang (`steam_00`).
Überall Kleinteile, die den Boden erzählen: Körbe, Fässer, Krüge, Knochen.

**7. Himmel.** Blau mit hellen Haufenwolken, real wirkend, 1.5–2-mal so hell wie die Landschaft. Nimmt wenig
Fläche ein (10–25 %), weil Bauten und Berge hoch ins Bild ragen. Nacht: dunkle Wolken mit Mondkante.

**8. Komposition.** Dunkle Vordergrundmasse seitlich (Marktstand links in `steam_02`, Turm links in
`steam_00`), Blick in eine helle Mitte, **Schneegipfel als Schlusspunkt** in der Bildtiefe. Im Dorf verstellt
die Architektur den Horizont fast ganz. Starke Diagonalen aus Schlagschatten.

**9. Stilisierung.** Am nächsten am Fotorealismus: Licht physikalisch plausibel, Material gescannt wirkend,
wenig Farbschleier. Gemalt sind nur die Concepts (`steam_eclipse_01`, `_02`) und die Gipfelkulisse. **Für
BRACHLAND ist das der Gegenpol**: nützlich für Material und Dorf-Dichte, nicht für Licht und Luft.

---

## Elden Ring (FromSoftware) — nur für Weite und Komposition

11 Bilder: `steam_00, 01, 03, 04, 06, 07, 09` (Hauptspiel), `steam_sote_00, 03, 04, 09` (Shadow of the Erdtree).

**1. Licht.** Selten eine sichtbare Sonne. Das Licht kommt aus einem **leuchtenden Motiv** (goldener Baum in
`steam_00`, `steam_06`, `steam_07`; Glut in `steam_sote_03`) oder aus einer Lücke in der Wolkendecke
(`steam_sote_00`). Stärkster Warm-Kalt-Kontrast der Sammlung: goldene Lichter (R−B +0.20 bis +0.27) gegen
blau-grüne Schatten (bis −0.12), z. B. `steam_09`, `steam_00`. Strahlenbündel sind gross und deutlich
(`steam_00`, `steam_sote_00`).

**2. Luft/Tiefe.** `steam_07` ist das Lehrbild: ein **Nebelmeer füllt die Täler**, daraus ragen 5–6 Ebenen
von Felsnadeln und Ruinen als reine Silhouetten, jede heller als die vorige. `steam_01` und `steam_00` ebenso:
Aquädukte und Türme als blasse Schattenrisse in 3–4 Stufen. Dunstfarbe folgt der Bildstimmung (grün-gold,
violett-blau, ocker), ist also bewusst gefärbt. Der Nebel liegt **unten**; Spitzen bleiben frei.

**3. Vegetation.** Vordergrund fast immer **hohes Gras, 40–80 cm, als geschlossene Fläche** mit einzelnen
Halmen und Rispen gegen das Licht (`steam_sote_00`, `steam_sote_09`, `steam_06`, `steam_03`). Bäume sind
Farbmassen: Herbstlaub in zwei Ockertönen (`steam_03`), schlanke Stämme, lichte Kronen. `steam_sote_04` ist das
einzige dichte Waldbild: 80 % Bewuchs, alle Schichten, Weg als schmale Schneise.

**4. Stein/Mauer/Holz.** Fels grossblockig mit klaren Bruchkanten und Flechtenflecken in Rost und Grün
(`steam_01`). Mauerwerk extrem kleinteilig ornamentiert, aber farblich **ein** Grau-Grün mit dunklen
Wasserläufern (`steam_04`). Auf Distanz zählt nur die Silhouette.

**5. Häuser/Ruinen.** Zwei Rollen: fernes **Wahrzeichen**, 5–15 % der Fläche, überhöht und im Dunst
(`steam_07`, `steam_sote_00`, `steam_sote_09`), oder bildfüllende Masse von unten gesehen (`steam_04`, 60 %).
Ruinen sind Bögen und Stümpfe, deren Lücken den Dunst zeigen (`steam_00`, `steam_sote_04`).

**6. Boden/Wege.** Meist Gras bis an den Bildrand; Wege schmal und dunkel (`steam_sote_04`). Fels bricht in
Stufen und Platten ab (`steam_07`, `steam_01`).

**7. Himmel.** Der Himmel ist **Hauptdarsteller**: 40–60 % der Bildfläche, stark gezeichnete, gemalte
Wolkenmassen in Bildfarbe (`steam_04`, `steam_sote_03`, `steam_sote_09`). Nicht wesentlich heller als das Land
(oben 0.35 / unten 0.31 im Median), sondern etwa gleich: Himmel und Land sind **ein** Tonraum.

**8. Komposition.** Immer dasselbe Schema: dunkler Felsvorsprung oder Grashang unten als Sockel, kleine Figur
mit Rücken zum Betrachter als Massstab, weite Tiefe, **ein** überhöhtes Ziel am Horizont. Horizont tief (30–45 %
von unten), viel Himmel.

**9. Stilisierung.** Am stärksten gemalt: erfundene Lichtquellen, eingefärbter Dunst, übersteigerte Silhouetten,
technisch eher schlichte Geometrie. Beleg dafür, dass **Weite aus Staffelung und Silhouette entsteht, nicht aus
Polygonzahl.**

---

## Gemeinsame Regeln (über alle vier)

1. **Dunkel ist die Grundlage.** Median 33 % der Fläche unter L 0.2, nur 4 % über 0.7; mittlere Helligkeit
   0.24–0.35. Kein Bild ist gleichmässig ausgeleuchtet.
2. **Das Licht kommt von hinten oder von der Seite**, tief. Frontallicht kommt in 43 Bildern nicht vor.
3. **Tiefe ist Tonwert-Staffelung.** 3–6 Ebenen, jede heller und kontrastärmer; die Ferne ist Silhouette in
   Dunstfarbe (`PBZ/web_6`, `ER/steam_07`, `SF/steam_06`, `BoD/steam_extra_01`).
4. **Dunst hat Farbe und Form.** Er trägt die Himmelsfarbe, liegt am Boden und in Senken, und setzt ab
   20–40 m sichtbar ein.
5. **Eine Farbfamilie plus ein Akzent.** Sättigung im Mittel 0.2–0.35; der Akzent (Feuer, Blüte, Laterne,
   Leuchtmotiv) belegt unter 2 % der Fläche.
6. **Der Vordergrund rahmt dunkel**: Stamm, Ast, Fels, Pfosten, Dachkante oder Grashang in fast jedem Bild.
7. **Material ist im Nahbereich tief und unregelmässig**, die Farbvariation liegt in 2–4 benachbarten Tönen
   und in Glanz/Nässe, nicht in Buntheit.
8. **Kein Übergang ist eine Linie.** Weg zu Gras, Mauer zu Boden, Fels zu Wiese: immer eine Zone mit einer
   dritten Zutat (Büschel, Laub, Schutt, Moos).
9. **Bauten sind Silhouette zuerst.** Schiefe, gebrochene, überhöhte Umrisse; Detail erst aus der Nähe.
10. **Bäume sind Charaktere.** Wenige, markante Formen mit lichten Kronen statt vieler gleicher Bäume.

---

## 10 Regeln für BRACHLAND-Zielbilder

Jede Regel ist am Zielbild prüfbar. Die Zahlen sind Arbeitswerte aus der Sammlung, an Soulframe gewichtet
(ADR-0012), und müssen am Zielgerät in Bewegung bestätigt werden.

1. **Tonwert-Budget.** Mittlere Bildhelligkeit 0.25–0.35; 30–50 % der Fläche unter L 0.2; höchstens 5 % über
   0.7. Messbar mit demselben Skript wie hier. (Beleg: Median aller 43; `SF/steam_03`, `SF/web_01`.)
2. **Sonne tief und schräg von hinten.** 10–25° Höhe, 100–150° zur Blickrichtung. Schlagschatten mindestens
   doppelt so lang wie das Objekt hoch. Kein Frontallicht. (`SF/steam_06`, `SF/web_05`, `PBZ/steam_07`.)
3. **Warmes Führungslicht, Schatten nicht blau.** Lichter R−B +0.10 bis +0.20, Schatten 0 bis +0.05. Der
   Soulframe-Weg ist der warme Schleier, nicht der harte Warm-Kalt-Schnitt von Elden Ring. Passt zur
   Tagesstimmung `zielbild` (warm, Goldnebel). (`SF/steam_02`, `SF/steam_03`, `SF/web_01`.)
4. **Mindestens vier Tiefenebenen**, jede mit eigenem Tonwert: Vordergrundrahmen (dunkelste Fläche) →
   Spielraum (voller Kontrast) → Mittelgrund ab 30 m (halber Kontrast) → Ferne ab 80 m (Silhouette, höchstens
   10 % unter Himmelswert). (`PBZ/web_6`, `ER/steam_07`, `SF/steam_06`.)
5. **Nebel als Bodenschicht in Himmelsfarbe.** Höhenabhängig, unten dicht, über Kronenhöhe dünn; Farbe aus
   dem Himmel nahe der Sonne abgeleitet, nie neutralgrau oder weiss. Lichtbahnen zwischen Stämmen breit und
   weich. (`SF/web_02`, `SF/steam_02`, `PBZ/steam_01`.)
6. **Lichtflecken statt Flächenlicht im Wald.** 10–20 % des Bodens besonnt, Rest im Kronenschatten;
   Fleckenränder weich. Kronen dafür 40–60 % lichtdurchlässig halten. (`SF/steam_06`, `PBZ/web_005`.)
7. **Fünf Vegetationsschichten, aber Boden bleibt sichtbar.** Bodendecker, Gras 20–40 cm, Blühkraut in Inseln,
   Farn/Strauch am Stammfuss und an Felsen, Stamm, Krone. Auf Wegen 40–60 % nackter Boden, abseits 10–20 %.
   Kraut klumpt um Stämme und Steine, nicht gleichmässig verteilt. (`SF/steam_03`, `SF/web_04`, `ER/steam_sote_04`.)
8. **Wenige Baumcharaktere mit Masse.** 3–5 markante Stammformen mit Wurzelanlauf und Drehwuchs, Rindenrelief
   in der Geometrie; lieber weniger, dickere Bäume. Moos als Kappe auf Oberseiten, Flanken kahl.
   (`SF/steam_03`, `SF/web_02`, `BoD/steam_eclipse_02`.)
9. **Übergänge sind Zonen, Bauten sind eingewachsen.** Jeder Materialwechsel bekommt 0.5–1.5 m Mischzone mit
   einer dritten Zutat. Mauerfuss nie als gerade Linie: Gras, Schutt, Moos davor. Mauern und Holz in 2–4 Tönen,
   Kanten gebrochen, Linien schief. (`SF/steam_06`, `PBZ/web_4`, `PBZ/web_3`, `BoD/steam_02`.)
10. **Jedes Zielbild hat Rahmen, Weg und Ziel.** Dunkler Vordergrundrahmen auf 15–25 % der Fläche, eine
    Blickbahn (Weg, Lichtbahn, Bachlauf) diagonal zum hellsten Fleck, dort ein Silhouetten-Ziel im Dunst.
    Horizont auf 55–65 % von unten im Wald, 35–45 % für Fernsicht. **Eine** Signalfarbe (Befall) auf unter 2 %
    der Fläche, sonst eine Farbfamilie. (`SF/web_05`, `ER/steam_sote_00`, `PBZ/steam_06`.)

---

## Ehrliche Einschätzung: three.js / WebGPU

**Gut erreichbar (Stand der Technik im Browser, auch am M1):**

- **Regel 1, 2, 3 (Tonwert, Sonnenstand, Farbschleier):** reine Gestaltung. Tonemapping, Belichtung und ein
  Grading-Schritt (LUT oder Lift/Gamma/Gain) kosten fast nichts. Das Tonwert-Budget lässt sich automatisiert
  am Screenshot prüfen.
- **Regel 4, 5 (Staffelung, Nebel):** Höhen- und distanzabhängiger Nebel im Shader mit Einfärbung zur Sonne
  hin ist billig und trägt den grössten Teil der Wirkung. Ferne als Silhouetten-Kulissen (wenige grosse
  Meshes oder Karten) ist genau das, was Elden Ring zeigt: Weite ohne Polygonlast.
- **Regel 10 (Komposition):** Leveldesign und Kameraführung, keine Technikfrage.
- **Lichtflecken (Regel 6) als Näherung:** Schattenkaskaden plus eine projizierte Kronenschatten-Textur
  („Cookie“) auf dem Sonnenlicht ergeben das Fleckenmuster ohne echte Blattschatten.
- **Vegetationsschichten (Regel 7) in Spielernähe:** `InstancedMesh` mit Seed-Verteilung (bestehende
  Invariante) trägt Gras, Kraut und Farn, wenn die Dichte mit der Distanz ausdünnt.

**Erreichbar mit Aufwand und Abstrichen:**

- **Volumenlicht zwischen Stämmen:** echtes volumetrisches Raymarching ist auf WebGPU in halber Auflösung
  machbar, am M1 knapp. Günstiger Ersatz: Nebelkarten/Lichtbahnen als weiche, additive Flächen und
  Screen-Space-Strahlen. Sieht im Standbild ähnlich aus, hält in Bewegung weniger gut.
- **Baumcharaktere mit geometrischer Rinde (Regel 8):** machbar für wenige Heldenbäume (Sculpt und Bake in
  Blender, 2–3 LODs). Nicht machbar für jeden Baum im Bild; der Hintergrund braucht Impostor/Billboards.
  Die Regel „wenige, dicke Bäume“ hilft hier dem Budget.
- **Mischzonen am Boden (Regel 9):** Terrain-Splatting mit Höhen-Blend und Streu-Instanzen geht. Kostet
  Texturspeicher; das Precache-Budget ist zwar ausgesetzt (D286), aber nicht egal.
- **Nässe und Glanz wie PBZ:** Rauheits-Variation und Pfützen gehen; die grossflächige Himmelsspiegelung
  braucht Screen-Space-Reflections oder eine Umgebungs-Probe und bleibt gröber als im Vorbild.
- **Weiche Schatten über Distanz:** 3–4 Kaskaden sind die Grenze; feine Blatt- und Grasschatten in der Ferne
  fallen weg und müssen durch Nebel und dunkle Bodenfarbe kaschiert werden.

**Nicht erreichbar (und nicht nötig für den Stil):**

- **Geometriedichte von UE5-Titeln** (Nanite-artig): jeder Stein, jedes Brett, jeder Dachziegel als Geometrie
  wie in `PBZ/web_3` oder `BoD/steam_02`. Im Browser bleibt das Normal-/Parallax-Map plus wenige Heldenobjekte.
- **Dynamische globale Beleuchtung** (Lumen-artig): das weiche Aufhelllicht in Schatten und unter Dächern.
  Ersatz: gebackenes Licht/AO, Hemisphärenlicht und ein paar handgesetzte Aufheller. Funktioniert, weil
  BRACHLAND eine feste Tagesstimmung hat.
- **Volle Vegetationsdichte bis zum Horizont** mit Einzelschatten wie `ER/steam_sote_04` oder `PBZ/web_005`.
  Dichter Wald geht nur als kurzer Sichtkorridor mit Nebel dahinter.
- **Haar-/Fell- und Stoffqualität** der Figuren in den Vorbildern.
- **Die Bildruhe der Marketing-Shots** (hohes Supersampling). Im Browser mit TAA oder MSAA flimmert feines
  Gras und Astwerk eher; das kollidiert direkt mit ADR-0018 Punkt 3 (kein Mikrorauschen). Gegenmittel ist
  gestalterisch: weniger Hochfrequenz, grössere Formen, Dunst früher einsetzen.

**Fazit.** Etwa sieben der zehn Regeln sind Gestaltungs- und keine Rechenfragen (1–5, 9 teilweise, 10). Genau
dort liegt der grösste Teil der Bildwirkung der Vorbilder, und genau das ist im Browser frei verfügbar. Die
Lücke zu den Vorbildern bleibt beim Nahdetail (Geometrie, Schatten, GI) sichtbar; ADR-0018 hat sie mit
„Substanz real an wenigen Heldenobjekten, Darstellung gemalt“ bereits richtig eingeordnet. Die Sammlung stützt
das: Soulframe und Elden Ring wirken über Licht, Luft und Silhouette, nicht über Dichte.

**Was diese Analyse nicht leistet:** Sie beruht auf Standbildern. Wie Nebel, Lichtflecken und Gras in Bewegung
wirken, zeigt sie nicht; dafür wären offizielle Trailer am Zielgerät die bessere Quelle. Für Dawnwalker ist
die Landschafts-Stichprobe dünn (zwei Mini-Banner, zwei Concepts).
