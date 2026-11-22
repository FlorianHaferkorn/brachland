---
last-reviewed: 2026-11-22
shelf-life-days: 90
---
# BRACHLAND — Ortsliste Œntal nach Story-Bibel v2 (Enklave-Lage v2)

> **Ersetzt v1** (Versionsregel `_INDEX.md`). v1 war die Bestandsaufnahme mit drei Optionen; Flo hat am 22.11.2026
> Option 2 „Hangterrasse“ entschieden (D374). Hier steht, was daraufhin in `content/` gesetzt wurde (D375), mit
> Koordinaten, und was davon im Spiel wirkt. Offen/erledigt steht im Ledger (A-21, A-24), nicht hier.

Weltkoordinaten in Metern, Regionsmitte 0/0 = Spielstart, x nach Osten, z nach Süden (also **negatives z = Norden**).
Höhen aus dem Raster `public/world/oental.json` (384 × 384, 10,4 m je Zelle). Die Tabellen kommen aus
`python3 tools/enklave_karte.py`; dasselbe Skript zeichnet die Karte alt gegen neu nach
`.cache/bilder/D375/d375-karte.png` (Draufsicht aus dem Höhenraster, kein Spielbild). Ein Vorher/Nachher-Paar aus dem
Spiel (Terrasse, altes Dorf) gibt es noch nicht; der Umzug ist im Spiel ungesehen.

## 1. Was gesetzt ist

| | Wert | Wo |
|---|---|---|
| `flutlinie` | **499 m** (Wehrkrone) | `content/regions/oental.json`, Schema `Region.flutlinie` |
| Enklave | Bezugspunkt = Wirt, 696 / −657, 514 m; Name vorläufig **„Die Terrasse“** | `Region.enklave` |
| Unter der Flutlinie | 3,73 km² von 15,9 km²; 1.448 von 2.033 Gebäuden (unter 495 m: 1.312) | `npm run validate` |

### Bewohner der Enklave

Die sechs behalten ihre IDs (`dorf-…`, in Aufträgen und Code verdrahtet); das „Dorf“ im Namen ist Herkunft, nicht Lage.

| Wer | x | z | Höhe | zum Wirt | Gebäude (Index in `welt.gebaeude`) | Warum dort |
|---|---|---|---|---|---|---|
| Wirt (`dorf-wirt`) | 696 | −657 | 514 | 0 | 1716, der größte Bau der Terrasse (1.669 m²) | Mitte; Kopfgeld-Brett |
| Alte am Zaun (`dorf-alte`) | 745 | −725 | 509 | 84 | 3, Kirche | Kirchhofzaun; geht abends zum Wirt |
| Magd (`dorf-magd`) | 597 | −566 | 522 | 135 | 391, Westrand am Bach | holt Wasser aus dem Bach; geht abends zum Wirt |
| Bursche (`dorf-bursche`) | 851 | −700 | 505 | 161 | 363, Ostkante | **Wache am Abstieg zur Flut**, Blick aufs Wasser; bleibt abends |
| Förster (`dorf-foerster`) | 401 | −813 | 566 | 334 | 1683, Hofgruppe am Waldrand | ausserhalb, sein Revier ist der Hangwald; bleibt abends |
| Schmiedin (`dorf-schmied`) | 765 | −259 | 518 | 403 | 464, Nordende | Rauch und Lärm abseits; blieb schon bisher an der Esse |

Kein 80-m-Kreis enthält mehr als einen Bewohner (vorher: 6 in 80 m). Die Prüfung dafür, für „über der Flutlinie“
und „nicht im Grundriss“ steht in `tools/validate.ts`.

### Zufluchten in Ringen um die Enklave

| Ring | Zuflucht | x | z | Höhe | zur Enklave | neu |
|---|---|---|---|---|---|---|
| ≤ 800 m (4) | Saal auf der Terrasse (`terrasse-saal`) | 657 | −694 | 514 | 54 | ja |
| | Feldscheune am Waldrand (`feldscheune-waldrand`) | 146 | −946 | 600 | 622 | ja |
| | Schuppen am Nordufer (`schuppen-nordufer`) | 438 | −1243 | 508 | 641 | ja |
| | Stadel am Hangweg (`stadel-hangweg`) | 814 | 112 | 519 | 778 | ja |
| 800–1.400 m (2) | Unterstand am Talweg | −7 | 87 | 639 | 1.023 | |
| | Heustadel am Grabenweg | 107 | 461 | 631 | 1.263 | |
| > 1.400 m (3) | Kirche am Nordhang (`kirche-nordhang`) | −284 | −1784 | 578 | 1.494 | ja |
| | Kapelle über dem Kalkbruch (`kapelle-kalkbruch`) | 1798 | 669 | 525 | 1.724 | ja |
| | Almhütte | −1474 | −1415 | 1055 | 2.299 | |

Dichte grob 2 je km² im inneren Ring, 0,5 im mittleren, 0,3 aussen. **Die Kapelle liegt auf einer Insel**: Der
Kalkbruch-Rücken ist bei 499 m ringsum von Wasser umgeben (kürzeste Querung 396 m, bis 9,9 m tief, kein Watweg im
Raster). Sie ist vor dem Wandel nur schwimmend erreichbar.

### Drei Reinkulturen in drei Richtungen

Reinkultur-Ort ist das Fundstück, auf das der Auftrag zeigt, der die Komponente gibt. `validate` verlangt: mindestens
900 m von der Enklave **und** von der Regionsmitte, paarweise mindestens 45° auseinander.

| Richtung | Fundstück → Komponente | x | z | Höhe | zur Enklave | zum Start | Geber | Werkzeugweg | Beschwerlicher Weg |
|---|---|---|---|---|---|---|---|---|---|
| Nord (329°) | `absetzbecken` → `wasserprobe-quell` | 170 | −1534 | 502 | 1.023 | 1.543 | Wirt | am Ufer entlang schwimmen, gerade Linie | Hangweg über Feldscheune und Schuppen am Nordufer, 1.082 m bis ans Ufer, 18 m Anstieg |
| West (251°) | `oberstollen` (neu) → `katalysator-v3` | −1031 | −47 | 963 | 1.832 | 1.032 | Wart vom Bruch | die Stufe unter dem Grat klettern (Raster: bis 60° im 40-m-Umkreis) | OSM-Pfad 5 m neben dem Mundloch („alter Almweg“); ab Enklave 2.097 m und 451 Höhenmeter |
| Süd (189°) | `saatkammer` (neu) → `saatgut-rein` | 421 | 1104 | 601 | 1.783 | 1.182 | Magd | Reiten auf dem Uferweg; Gleiten nur von den Westhängen, nicht von der Terrasse | Uferweg über den Stadel am Hangweg, dann bergauf: 1.856 m, 99 Höhenmeter |

`stollenmund` (387 m vom Start) und `silo-hof` (314 m) bleiben als Fundstücke liegen, sind aber keine Reinkultur-Orte
mehr. Der untere Stollen ist „zugemauert“ — das trägt jetzt den Verweis nach oben.

### Drei verborgene Orte

Kein Auftrag und kein Bewohner nennt sie (`validate` lehnt einen Auftrag ab, der auf ihr Fundstück zeigt).

| Ort | x | z | Höhe | zur Enklave | Verhärteter | Spur |
|---|---|---|---|---|---|---|
| Kirchturm im Wasser (`kirchturm`) | 1639 | −317 | 483 | 1.002 | Kiemenbiber | Licht: die einzige Kirche der versunkenen Stadt, 15,6 m unter der Flutlinie — nur der Turm steht heraus |
| Hütte im Bannwald (`jagdhuette`) | −746 | −649 | 704 | 1.443 | Wurzelkeiler | Gelände: einzige Hütte im Westwald, kein Nachbar in 70 m |
| Quelltopf unter der Grenze (`quelltopf`) | −1683 | 650 | 971 | 2.715 | Grathorn | Gelände: Bachlauf bis zur Quelle folgen, knapp unter 1.000 m |

Der Kirchturm ist vor dem Wandel nur schwimmend oder tauchend zu erreichen und fällt danach trocken.

### Drei Fraktionsfiguren

Eigene Inhaltsart `content/wanderfiguren/` (keine `Ort`e: Sie verschieben den Bewohnt-Radius der Häuser nicht und
brauchen keinen Auftrag). Eine Figur steht an der ersten Station, deren `bis` noch nicht eingetreten ist; wer später
kommt, trifft sie dort nicht mehr.

| Figur | Fraktion | Station | x | z | bis / ab |
|---|---|---|---|---|---|
| Die Pegelwartin | Enklave | 1 Pegel unter der Terrasse | 889 | −653 | bis `stauwehr` gelesen |
| | | 2 Bahnhof am Wehr | 858 | 852 | bis Flussvater besiegt |
| | | 3 Altes Dorf, trockengefallen | 1327 | 397 | bis Region geheilt |
| | | 4 Terrasse, letzte Zahl | 878 | −656 | — |
| Der Zähler | Grüne Mönche | 1 Hof am Stau | 988 | 764 | bis `stauwehr` gelesen |
| | | 2 Ufer am Absetzbecken | 150 | −1499 | bis `absetzbecken` gelesen |
| | | 3 Hof am Stau, zweite Reihe | 995 | 747 | bis Flussvater besiegt |
| | | 4 Wehrkrone | 1050 | 861 | **ab** Region geheilt (wer nur tötet, sieht ihn nie wieder) |
| Der Bote | Das Erbe | 1 Bahnhof, nach dem Wandel | 839 | 857 | **ab** Flussvater besiegt, bis Region geheilt |
| | | 2 Silo drei, trockengefallen | 1030 | −580 | bis `was-danach-waechst` abgeholt |
| | | 3 Hof über dem Nordufer | −315 | −1310 | — |

## 2. Was davon im Spiel wirkt — und was nur Daten sind

| Im Spiel | Nur Daten |
|---|---|
| Sechs Bewohner stehen auf der Terrasse; das alte Dorf ist leer | `flutlinie`: keine Wasserfläche, kein Schlammrand, keine Verfallsregel (ADR-0017) |
| Bewohnt-Radius (D289, 150 m) folgt den Orten: Häuser um die neuen Plätze und die sechs neuen Zufluchten werden Stufe 0, die im alten Dorf fallen auf Stufe 1–2 | `enklave`: nur Bezugspunkt der Prüfung und Name |
| Sechs neue Zufluchten (Rasten, Aufwachen) | `verborgeneOrte`: Es steht kein Verhärteter dort |
| Sechs neue Fundstücke liegen aus, zwei Aufträge zeigen auf neue | Werkzeugweg/beschwerlicher Weg: Beschreibung in dieser Notiz, im Gelände ist nichts gebaut |
| Wanderfiguren stehen an ihrer Station und sagen ihren Satz (`src/main.tsx` `figurOrte`); wer sie anspricht, steht als `wanderfigur-<id>` in `stand.orte` | Ob eine Figur einem traut, scheitert oder ein Ende öffnet |
| Abendweg zum Wirt nur noch für Alte und Magd (`Ort.abends`, vorher am Namen `dorf-…` verdrahtet) | Zielart `reinige`: zählt bis zur Kampfhandlung „Reinigen“ das alte Aufnehmen (`gefangen`) |

**Bewusst stehen gelassen:** `hausnutzung` und `content/milbinger-substanz.json` (Milbinger Straße, D346–D348) — nach
Story-Bibel v2 §4 bleibt sie als Brache in der Flutzone; der Widerspruch aus ADR-0017 Punkt 2 (Stufe 1–2 mitten in
der Enklave) ist mit dem Umzug weg. `tests/hofhaeuser.test.ts` und `tests/hofbodenintegration.test.ts` tragen ihre
eigene Bewohnt-Liste und hängen nicht an `content/orte`. Die Wegelager hängen an Tremmel, Wart und Almhütte, nicht am
Dorf. Die Köder und Netzschlingen (Fanghilfe) bleiben als Gegenstände und Belohnungen, bis „Reinigen“ entworfen ist.

## 3. Was das echte Gelände anders sagt als die Bibel

1. **Der Flussvater liegt nicht hinter der Flut.** Das Wehr (1072 / 871, 499 m) sitzt am Westufer. Von der Enklave
   führt ein trockener Uferweg hin: 1.681 m, 10 m Anstieg, keine Stufe über 45 % im Raster. Die Luftlinie über das
   Wasser ist 1.573 m. „1,4 km über Flutgrund“ (Bibel §4) stimmt also nur als Luftlinie, und der Werkzeugweg
   (schwimmen) spart nichts. Der „Osthang mit Kalkbruch-Kante“ ist eine Insel und liegt nicht auf dem Weg.
2. **Von der Terrasse lässt sich nicht gleiten.** Sie liegt auf 505–525 m, alles Trockene im Süden liegt höher.
   Gleiten ist im Œntal eine Fähigkeit der Westhänge (Traversal v1, Nachtrag).
3. **Das Fundstück im Absetzbecken liegt auf dem Grund**, 30 m vom Ufer, Auslöser 9 m. Ohne Schwimmen ist es nicht
   lesbar — die Reinkultur Nord hat damit keinen beschwerlichen Weg ohne Werkzeug.
4. **Das 10-m-Raster sieht keine Wände.** Die 4.031 Klippen sind Instanzen; „klettern oder aussen herum“ ist am
   Oberstollen plausibel (60° im Umkreis, Pfad daneben), aber nicht gemessen.

## 4. Name der Enklave — drei Vorschläge

Namensschema Story-Bibel v1 §8 (Inn → Œn, Mühldorf → Mildorf): das reale Wort bleibt hörbar, ein Stück ist abgerieben.
Die Terrasse ist der hochgelegene Ortskern von Brannenburg; Degerndorf liegt im Talboden und ist die versunkene Stadt.

| Vorschlag | Echo von | Für | Gegen |
|---|---|---|---|
| **Brannburg** | Brannenburg | trifft den realen Ort; „Brand“ klingt mit dem Faulbrand zusammen | nah am Original |
| **Dernhof** | Degerndorf | klingt nach Hof und Enklave | Degerndorf ist real der Talort, also die versunkene Stadt — der Name gehörte eher dorthin |
| **Flinsach** | Flintsbach | eigenständigster Klang | Flintsbach liegt südlich ausserhalb der Region |

Bis Flo entscheidet, heisst sie in den Daten **„Die Terrasse“**. „Mildorf“ stand in keinem Inhalt, nur in der
Bauwelt-Notiz (dort ersetzt) und in der abgelösten Story-Bibel v1.

## 5. Spielstart an der Enklave — was es kosten würde

Technisch eine Zeile: `LEERER_STAND.position` in `src/spiel/spielstand.ts` (gehörte dann als `start` in die
Regionsdaten). Der Preis liegt im Inhalt, nicht im Code:

- **Die ersten zehn Minuten sind um 0/0 gebaut.** Unterstand (87 m), Tremmel (465 m), Wart (565 m), Heustadel,
  Trafomarder (279 m), zwei Wegelager, `stollenmund` und `silo-hof` liegen dort. Von der Terrasse sind es 957 m bis
  zur Mitte; die Terrasse selbst hat sechs Bewohner, aber keinen Einstiegsauftrag in Laufweite ausser dem des Burschen.
- **`validate` misst die 900 m der Reinkulturen auch gegen die Regionsmitte.** Mit Start an der Enklave fiele diese
  zweite Bedingung weg — der Hof mit den vier Silos (191 / 680) käme dann für die Reinkultur Süd in Frage.
- **Alle Lastmessungen stehen an 0/0** und drei Nachbarpunkten (`tools/lastcheck.ts`, `aufsatzcheck.ts`,
  `scenecheck.ts`). Die Terrasse hat rund 80 Häuser im Nahbereich und Blick auf 1.448 weitere; Last und
  Vorkommen (`npm run vorkommen`) wären dort neu zu messen.
- Bibel §6.1 („Ankunft auf der Terrasse“) spricht dafür. Ein Mittelweg: Start bleibt, und die ersten Aufträge an
  Tremmel und Wart schicken zur Terrasse.

## 6. Texte: was geändert wurde und warum

Geprüft: 17 Aufträge, 14 Fundstücke, 14 Orte. **Lokale Zeit im Œntal**, an der die Zahlen jetzt hängen: Kollaps vor
40–60 Jahren; Überlebende brechen vierzehn Jahre Kalk; **vor achtzehn Jahren** kommt der Befall ins Tal (Bruch
stillgelegt, Werk geschlossen, die Hunde bleiben drin); die Flut steht **seit dem Frühjahr**. Damit bleiben „achtzehn
Jahre“ (Wart, Werkstor) und „vierzehn Jahre“ (`kalkbruch`) stehen, nur „vor zwei Jahren“ passte nicht.

| Datei | alt | neu | Grund |
|---|---|---|---|
| `fragmente/bruchkante` | „Der Zettel hängt noch. Freitag war vor zwei Jahren.“ | „Der Zettel hängt noch im Kasten. Freitag war vor achtzehn Jahren.“ | Zeitlinie: derselbe Bruch liegt laut Wart seit achtzehn Jahren still |
| `auftraege/die-runde` | „Bringen Sie mir einen heraus. Nicht tot — … Wenn einer draußen ist …“, Ziel `fange` K7 | „Nehmen Sie einem das ab, was ihn laufen lässt. Nicht töten — … Wenn einer still steht …“, Ziel `reinige` | Marke: kein Fangen |
| `auftraege/die-zahl-am-morgen` | „Zwei Firnhasen zu viel heute Nacht. Fangen Sie mir zwei … Was Sie danach mit ihnen machen, ist Ihre Sache.“ | „Zwei Firnhasen zu wenig heute Nacht. Die kommen von oben, vom Geröll über der Grenze … Wenn sie den Schimmer im Fell haben, nehmen Sie ihn ab.“, Ziel `reinige` | Marke; Firnhasen leben auf Geröll über 1.000 m — der Auftrag schickt jetzt dorthin statt vors Haus |
| `auftraege/eine-fuer-den-hof` | „Fangen Sie mir ein Alpenmurmel.“ | „Machen Sie mir ein Alpenmurmel wieder rein.“, Ziel `reinige` | Marke |
| `auftraege/ein-gelege-ohne-fahl` (Fahlmoos) | „Fangen Sie mir zwei Molche, die noch sauber sind.“ | „Nehmen Sie zwei Molchen das Fahl, mit dem Zeichen an Ihrem Arm. Wenn es nicht wiederkommt …“, Ziel `reinige` | Marke |
| `auftraege/nach-vorher-schmecken` | „Am Silo vom Hof steht etwas geschrieben, seit dem Frühjahr. Ich gehe nicht mehr hin. …“ → `silo-hof` | „Am Südhang, hinter dem Wehr und dann bergauf, steht ein Hof mit einer Kammer, die keiner aufgemacht hat. … Ich gehe den Uferweg nicht mehr. …“ → `saatkammer` | Lage: Reinkultur weg vom Start, nach Süden |
| `auftraege/was-am-stollen-steht` | „Am Stollenmund ist eine Tafel. Ich habe sie nie gelesen, ich war zu nah dran. …“ → `stollenmund` | „Den unteren Stollen haben wir zugemauert. Den oberen nicht. Der liegt unter dem Grat, eine Wand hoch oder den alten Almweg außen herum. …“ → `oberstollen` | Lage: Reinkultur weg vom Start, nach Westen; nennt beide Wege |
| `orte/dorf-alte` | „… die nachts durchs Dorf gehen …“ | „… die nachts über die Terrasse gehen …“ | Lage |
| `orte/dorf-magd` | „Sie trägt Wasser, obwohl der Hof einen Anschluss hat. Der Brunnen, sagt sie, schmeckt noch nach vorher.“ | „Sie trägt Wasser vom Bach herauf, obwohl unten ein ganzes Tal davon steht. Das vom Bach, sagt sie, schmeckt noch nach vorher.“ | Lage: ihr Unterhof steht unter Wasser |
| `orte/dorf-bursche` | „… schaut jedes Mal die Straße hinunter, wenn Schritte kommen.“ / abends „Er hat die Strasse heute zweimal abgelaufen …, der zuhört.“ | „… schaut jedes Mal zum Wasser hinunter, wenn dort etwas schlägt.“ / „Er hat die Wasserkante heute zweimal abgelaufen …, der vorbeikommt.“ | Lage: Wache am Abstieg, abends nicht mehr im Wirtshaus |

Unverändert geprüft und passend: `das-stehende-wasser`, `was-im-stau-liegt`, `was-danach-waechst` („Sie haben gesagt,
er habe nur gereinigt“ — trägt v2 schon), `der-kern-im-stau`, `harz-fuer-die-esse`, `streuner`,
`schritte-auf-der-strasse` (die Füchse kommen jetzt „die Straße herauf“ vom Wasser), `bis-zur-kante`,
`was-der-tresen-weiss`, die zwei übrigen Fahlmoos-Aufträge; alle übrigen Fundstücke und Ortstexte.

**Neue Fundstücke (6):** `oberstollen` und `saatkammer` als Ziele der zwei verlegten Reinkulturen; `kirchturm`,
`jagdhuette`, `quelltopf` an den verborgenen Orten; `alter-tresen` im geräumten Dorf (1339 / 513, 493 m, unter Wasser).
Die Stationen der Wanderfiguren tragen ihren Satz selbst und bekommen kein Fundstück.

**Wohin die Aufträge schicken** (von der Enklave aus): Wirt → Nord (Absetzbecken), Magd → Süd (Saatkammer), Förster →
West (Felsband), Alte → West, über 1.000 m (Geröll), Schmiedin → Südwest (Trafomarder bei −22 / 278, das ist Richtung
Start), Bursche → vor Ort. Der kritische Pfad braucht keinen davon: Der Flussvater ist ohne Auftrag erreichbar.
