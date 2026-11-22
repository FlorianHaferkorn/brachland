---
last-reviewed: 2026-11-22
shelf-life-days: 365
---
# Referenzbefunde Menschen – Wikimedia Commons (22.11.2026)

Grundlage für „Zielbild Menschen, Runde 2" (`UEBERGABE.md` Abschnitt 0 Punkt 2b, Ledger D404; Runde 1: D383,
`tools/menschenframe.py`). Bilder liegen lokal unter `.cache/referenz/menschen/` (nicht im Repo), Vorschau
meist in der Commons-Stufe 1920 px (angefragt 1600, Commons liefert die nächste Standardstufe); wo das Original
kleiner ist oder Commons drosselte, 1280, 960 oder 500 px (`breite` je Datei). Lizenz, Urheber und Seiten-URL je
Datei stehen in [`menschen-quellen.json`](menschen-quellen.json), alles aus der Commons-API (`extmetadata`),
nicht geraten. Nur Public Domain, CC0, CC BY-SA. Drei Bilder (`brachgaenger-02`, `-06`, `-07`, Augustus F.
Sherman, Ellis Island um 1906) führt Commons als „No restrictions" (NYPL); der Fotograf starb 1925, sie sind
damit gemeinfrei — Hinweis steht in der JSON. Für CC-BY-SA-Bilder gilt: nur als Referenz benutzt, nichts davon
wird ins Spiel kopiert.

**Persönlichkeitsrecht:** Kein Kopf wird nach einer einzelnen Person gebaut. Die Gesichtsfotos sind entweder
historisch (1906–1943, Public Domain, die Abgebildeten sind mit hoher Wahrscheinlichkeit verstorben) oder
Ausschnitte ohne ganzes Gesicht (Kinn, Auge, Hinterkopf, Hand, Fuss). Fünf historische Fotos nennen die
Abgebildeten im Titel (`brachgaenger-01`, `schmiedin-01`, `schmiedin-08`, `zaehler-06`, `zaehler-07`) — von ihnen
werden nur Hautbild, Tuch, Haltung oder Gewandfall übernommen, keine Gesichtsform. Heutige, nicht genannte
Personen (`zaehler-02`, die Schmiede in `schmiedin-06`/`-07`) liefern nur Faltenmuster, Kleidung und Haltung.
Der Mischplan je Kopf steht am Ende jedes Abschnitts.

**Messmethode:** Verhältnisse aus Pixelkoordinaten geschätzt, etwa ±20 % (Perspektive, Objektiv). Farben nach
Augenschein und als sRGB-Richtwert aus kleinen Feldern; die absolute Helligkeit hängt an Kamera und, bei den
Kodachrome-Dias von 1942/43 und den Dreifarben-Auszügen von Prokudin-Gorski (1907–1911), am gealterten
Farbmaterial. Schwarzweiss-Fotos liefern Form, Falten, Haltung und Stoff, keine Farbe. Was nicht zu sehen ist,
steht als „nicht belegt" da. Commons hat am 22.11.2026 stark gedrosselt (HTTP 429): Suchen waren nur langsam
möglich, die Auswahl ist deshalb schmal.

**Was Runde 1 falsch hatte** (D383, UEBERGABE 2b) und woran die Befunde unten gemessen werden: glatte Haut ohne
Poren und Rötung, starrer Blick (Auge ohne Feuchte, ohne Lidrand), Haar als Platte, steife Haltung (Gewicht auf
beiden Beinen gleich), Gewebe in der Totalen glatt, Schuhe ohne Sohle.

## 1. Brachgänger (Spielfigur, Wanderer; Mann, MakeHuman-Alter 0,68 ≈ Ende 40)

| Datei | Ansicht | Wofür |
|---|---|---|
| `brachgaenger-01.jpg` | Kodachrome-Porträt 1942, Kopf und Schultern, Streiflicht von oben links | Haut: Poren, Rötung, Stirnfalten, Augenfeuchte |
| `brachgaenger-02.jpg` | Porträt 1906, sitzend, frontal, Schafspelz | Gesichtsfalten eines Draussen-Arbeiters, Bart |
| `brachgaenger-03.jpg` | Kinn und Lippen, Zwei-Tage-Bart, teils weiss | Bartschatten, Haarstoppeln, Lippenrand |
| `brachgaenger-04.jpg` | Kinn, Nase, Lippen, Wochenbart | Bartdichte nach Zone |
| `brachgaenger-05.jpg` | Auge im Makro, Blick zur Seite | Lidrand, Wimpern, Feuchte, Bindehaut |
| `brachgaenger-06.jpg` | Porträt um 1906, Walkjanker, Hut | Loden, Filzhut, Kragen |
| `brachgaenger-07.jpg` | ganze Figur um 1906, stehend auf Stufen | Pose mit Gewichtsverlagerung, Strümpfe, Schuhe |
| `brachgaenger-08.jpg` | Bergschuh von unten und von der Seite, mit Krampen | Sohle, Rahmen, Nagelung |

- **Haut (01):** Poren auf Nase und Wangen in Kopfgrösse sichtbar, auf der Stirn nicht, dort feine waagrechte
  Linien (5–6 durchgehend, dazwischen kurze). Krähenfüsse 3–4 Linien je Auge, fächerförmig bis etwa 1,5 cm
  neben den Lidwinkel. Die Haut ist **nicht einfarbig:** beschattete Wange ~ sRGB 176/138/119, belichtete Stirn
  ~ 225/201/182 — R−B auf der Wange +57, auf der Stirn +43, die Wange ist also röter, nicht nur dunkler; Ohr
  und Nasenspitze rosiger als die Wange, Schläfe gelblicher (~ 179/151/128). Glanz liegt auf Nasenrücken,
  Nasenspitze und Stirnmitte, die Wange ist matt. Graue kurze Haare an der Schläfe.
- **Falten (02):** Nasolabialfalte tief, vom Nasenflügel bis unter den Mundwinkel, verdeckt vom Schnauzbart;
  zwei senkrechte Zornesfalten über der Nasenwurzel; Wangen unter dem Jochbein eingefallen; Ohren abstehend.
  Haar kurz geschoren, Ansatz an den Schläfen zurückgewichen.
- **Bart (03, 04):** Stoppeln stehen einzeln, **nicht** als Fläche; Dichte am grössten auf Oberlippe und Kinn,
  auf der Wange nach oben ausdünnend, Grenze unscharf; in 03 sind etwa ein Fünftel der Stoppeln am Kinn weiss.
  Unter den Stoppeln ist die Haut bläulich-grau getönt (Bartschatten). Der Lippenrand ist scharf, die
  Lippe deutlich röter und feuchter als die Haut.
- **Auge (05):** Feuchter Saum auf dem Unterlid (heller Streifen, 1–2 mm), die Wimpern des Unterlids stehen
  einzeln und schräg nach unten; Oberlid wirft einen Schatten auf die obere Iris (etwa ein Viertel der Iris
  verdeckt). Lichtreflex auf der Hornhaut als Fensterbild, nicht als Punkt. Lidhaut feinst gefaltet, am
  äusseren Winkel Linien wie in 01. Das Augenweiss ist nicht weiss, sondern grau-bläulich, zum inneren Winkel hin rosa.
- **Kleidung (06):** Walkstoff (Loden) ohne sichtbare Webung, filzige Oberfläche, Kanten dick und rund (≈ 1 cm),
  Revers liegt in einem weichen Bogen, Ärmel mit breiten, wenigen Falten — der Stoff ist steif. Filzhut mit
  breiter Krempe, an den Seiten aufgebogen, Kopf eingedellt.
- **Pose (07):** Gewicht auf dem hinteren Bein, das vordere steht eine Stufe tiefer und locker; Becken
  dadurch schräg, Schultern gegengleich, Hände am Gürtel, Kopf leicht abgewandt. Kopf ≈ 1/7,5 der Gesamthöhe.
  Strümpfe gestrickt, Rippenmuster quer, über der Wade gefaltet; Hemdsärmel bis zum Ellbogen hochgeschoben.
  Schuhe mit dickem Rahmen, Sohle seitlich sichtbar (≈ 1,5 cm).
- **Schuh (08):** Laufsohle mit umlaufenden Randnägeln (Krampen) im Abstand ≈ 1,5–2 cm, Mittelfeld mit
  Einzelnägeln; Absatz eigener Block, ≈ 2,5 cm; Rahmen genäht und von der Seite als Stufe lesbar; Leder am
  Vorderfuss quer geknickt (Gehfalten).

**Mischplan Kopf Brachgänger:** Hautbild (Poren, Rötung der Wangen und Ohren, Glanzzonen, Stirn- und
Augenfalten) aus 01, Faltenlage und Kopfform eines Draussen-Arbeiters (Nasolabialfalte, Zornesfalten,
eingefallene Wangen) aus 02, Bart aus 03/04, Auge aus 05 — die Gesichtsform bleibt die eigene aus den
MakeHuman-Zielen (D383), keine der Personen wird nachgebaut. Kleidung, Hut, Pose und Schuh aus 06–08.

## 2. Schmiedin (Frau, MakeHuman-Alter 0,60 ≈ Ende 30, kräftig)

| Datei | Ansicht | Wofür |
|---|---|---|
| `schmiedin-01.jpg` | Kodachrome-Porträt 1943, Arbeiterin mit Kopftuch und Schutzbrille | Haut mit Russ, Kopftuch, Augen |
| `schmiedin-02.jpg` | Frau am Amboss, 1914–1918, halbe Figur | Arbeitshaltung, Schürze, gekrempelte Ärmel |
| `schmiedin-03.jpg` | Frau und Mann in der Schmiede, 1914–1918, ganze Figuren | Stand am Amboss, Schürzenlänge |
| `schmiedin-04.jpg` | Bäuerin 1910, ganze Figur, Farbe | Stand mit Gewichtsverlagerung, Kopftuch, Rock |
| `schmiedin-05.jpg` | Zopf von hinten, Nacken | Haar in Strähnen, Ansatz, lose Haare |
| `schmiedin-06.jpg` | Schmied in Guédelon, Lederschürze nah | Leder: Glanz, Brandflecken, Abrieb |
| `schmiedin-07.jpg` | Schmied in Guédelon, ganze Figur am Amboss | Arbeitsstand, Gewicht auf dem vorderen Bein |
| `schmiedin-08.jpg` | Schmied am Feldamboss 1933, Hammer erhoben | Schlaghaltung, Arbeitskleidung |

- **Haut (01):** helle Haut mit Sommersprossen; die Rötung liegt als weicher, runder Fleck auf den Wangen
  (Durchmesser ≈ ein Drittel der Gesichtsbreite, ohne Rand) und schwächer auf der Nasenspitze. Russ als
  ungleichmässiger grauer Film an Kinn, Nasenflügeln und Mundwinkeln, auf den Wangenhöhen abgerieben. Leichte
  Schatten unter den Augen, zwei feine senkrechte Falten über der Nasenwurzel. Lippen rosig, nur wenig dunkler
  als die Wange, Mund fest geschlossen. Augen braun, Glanzpunkt auf der Hornhaut, Feuchtsaum am Unterlid.
- **Kopftuch (01, 04):** in 01 um den Kopf geschlungen, Knoten oben über der Stirn, bedrucktes Baumwolltuch
  mit weichen, kleinen Falten; einzelne Haarsträhnen fallen unter dem Tuch in die Stirn. In 04 eng um Kopf und
  Ohren, dunkel, im Nacken gebunden.
- **Haar (05):** Zopf aus drei Strängen, jeder aus vielen hundert Einzelhaaren; Glanz liegt als Band quer über
  jedem Strang, nicht über dem ganzen Zopf. Lose Einzelhaare stehen am Nacken und an den Strängen ab (Flaum),
  der Ansatz im Nacken ist weich, kein Rand. Farbe in einem Strang von dunkelbraun (innen) bis blond (Spitzen
  und Licht) — das Haar ist nicht einfarbig.
- **Arbeitshaltung (02, 03):** über den Amboss gebeugt, Rücken rund, Kopf ≈ 30° nach unten; Ambossbahn auf
  Höhe der Fingerknöchel bei hängendem Arm. Ärmel bis über den Ellbogen gerollt, Rollen ≈ 4–5 cm dick.
  Haar am Hinterkopf hochgesteckt. Lederschürze von der Brust bis übers Knie, in 03 bei der Frau bis zur Wade.
- **Stand (04, 07, 08):** Füsse etwa hüftbreit, eins vor dem anderen; Gewicht auf einem Bein, das andere locker
  (04: Becken zur Standseite geschoben). In 07 trägt das vordere Bein, der Oberkörper beugt sich über den
  Amboss; in 08 hebt der Schmied den Hammer über die Schulter, das Gewicht liegt auf dem hinteren Bein.
- **Leder (06):** Schürze aus dickem, steifem Leder, Kanten ungesäumt; dunkle Flecken (Öl, Brand) an Brust und
  Bauch, Glanz auf den Wölbungen, matter Abrieb an den Kanten; Halsriemen. Darunter grobes, helles Leinenhemd
  mit weichen Falten am Ellbogen, Strickmütze mit Rippen.
- **Rock (04):** fällt in senkrechten Falten bis zum Knöchel, unten breiter, Saum mit farbigem Band.

**Mischplan Kopf Schmiedin:** Hautbild mit Sommersprossen, Wangenrötung und Russ, Strähnen unter dem Tuch und Augenpartie aus 01, Kopfform und
Gesichtszüge aus den eigenen MakeHuman-Zielen (D383, runder Kopf, breites Kinn), Haar als Zopf aus Strähnen
nach 05, Bindeweise des Tuchs nach 04. Haltung und Arbeitsbild aus 02/03 (Frau am Amboss) und 07/08,
Schürze nach 06.

## 3. Zähler (Mönch, Mann, MakeHuman-Alter 0,92 ≈ um 80, mager, barfuss)

| Datei | Ansicht | Wofür |
|---|---|---|
| `zaehler-01.jpg` | sehr alter Mann 1907, ganze Figur, Farbe, Schnee | Altershaltung, weisser Bart, langer Mantel |
| `zaehler-02.jpg` | alter Mann lachend, Brustbild | Faltenmuster, Altersflecken, Rötung |
| `zaehler-03.jpg` | Hinterkopf, ergrautes Haar | Grau als Mischung, Strähnen |
| `zaehler-04.jpg` | alte Hand, Rücken, schwarzweiss | Adern, Knöchelfalten, Nägel |
| `zaehler-05.jpg` | Haut im Makro | Hautfelderung, Linien |
| `zaehler-06.jpg` | Abt 1909, ganze Figur, Kutte | Fall eines langen Wollgewands |
| `zaehler-07.jpg` | alter Mönch 1909, sitzend vor der Zelle | Sitzhaltung, Gewand im Sitzen |
| `zaehler-08.jpg` | nackte Füsse von hinten, Sohlen | Sohlen eines Barfussgehers |

- **Haltung (01):** Oberkörper leicht nach vorn, Kopf vor der Schulterlinie, Knie leicht gebeugt; Gewicht auf
  einem Bein, die Hände vor dem Bauch verschränkt. Mantel bis unter das Knie, Falten senkrecht und schwer, an
  den Ellbogen quer gestaucht. Bart weiss, lang, an den Spitzen dünn, am Kinn dicht.
- **Falten (02):** Krähenfüsse als tiefe Furchen bis zur Schläfe (5–7 je Seite); Stirn mit 4 tiefen
  durchgehenden Querfalten; Wange mit Falten senkrecht zur Nasolabialfalte; Augen tief in Lidfalten, Oberlid
  hängt über die Lidfalte. Haut gerötet auf Nase und Wangen, unregelmässige Flecken. Brust: graue Haare.
  Nur das Faltenmuster wird übernommen.
- **Haar (03):** grau ist keine Farbe, sondern eine **Mischung** aus weissen und dunklen Einzelhaaren; weisse
  Haare sind dicker und krauser, stehen ab; die Strähnen bilden Locken mit eigenem Glanzband.
- **Hand (04):** Venen stehen als Wülste über dem Handrücken; über jedem Fingergelenk 4–6 quere Falten;
  Haut des Handrückens in feinen Längsfalten; Nägel mit Längsrillen. Für die Hände um Stab und Zählschnur.
- **Haut (05):** Felderung in unregelmässigen Drei- und Vierecken (≈ 0,5–1 mm), Linien vertieft; dazwischen
  einzelne Rötungen. Gilt als Mikrorelief für alle drei Figuren, am stärksten beim Zähler.
- **Gewand (06, 07):** langes Wollgewand fällt im Stand fast faltenlos senkrecht und wird zum Saum breiter
  (Saum ≈ 1,3 × Schulterbreite), Ärmel weit; im Sitzen (07) staut es sich über den Knien in wenigen grossen
  Falten. Stoffstruktur in diesen Bildern **nicht belegt** (zu klein); dafür bleibt der Scan `hessian_380`
  (Poly Haven, D383).
- **Füsse (08):** Ferse und Ballen mit verdickter, dunklerer Hornhaut, Fussgewölbe heller und glatt; Zehen
  gespreizt. Alte Füsse selbst **nicht belegt** (das Foto zeigt einen jüngeren Mann): Alterszeichen aus 04
  übertragen.

**Mischplan Kopf Zähler:** Altersbau von Kopf und Haltung (vorgeschobener Kopf, eingefallene Wangen, weisser
Bart) aus 01, Faltenmuster aus 02, Haar als Grau-Mischung aus 03, Hautrelief aus 05 — Gesichtszüge aus den
eigenen MakeHuman-Zielen (D383). Hände nach 04, Gewandfall nach 06/07, Sohlen nach 08.

## Was fehlt

- **Lebende Augenpartie bei Frauen und Alten:** Augen-Makro nur von einem jüngeren Mann (05); Augenfeuchte und
  Lidschatten für Schmiedin und Zähler aus 05 übertragen.
- **Webstruktur in Farbe:** Leinen, Rupfen und Wolle sind in keinem Foto nah und in Farbe zu sehen; dafür
  bleiben die Poly-Haven-Scans aus D383. Kutte/Gugel nur aus den Gewandbildern 1909.
- **Gealterte nackte Füsse** und **Frauenschuhe mit Sohle**: nicht gefunden (Drosselung).
- **Seitenansichten der Köpfe** für Profil und Ohrlage: keine.


## Lizenz MPFB (22.11.2026)

**Frage** (UEBERGABE 2b, D383 ⚠️ UNKLAR (a)): Rig und Körperziele liegen im GPL-Paket von MPFB ohne eigenen
CC0-Vermerk — dürfen sie bzw. ein daraus exportiertes Modell in einem kommerziellen Web-Spiel ausgeliefert
werden, ohne dass das Spiel unter die GPL fällt? Baut auf dem Lizenzbefund vom 14.11.2026 in A-18 auf.

**Geprüft wurde Version 2.0.18** (die Version aus `tools/menschenframe.py`, `MPFB_URL`). Die heruntergeladene
`mpfb.zip` liegt auf diesem Rechner nicht (`.cache/cc0/menschen/` fehlt hier, D383 lief in der Cloud); geprüft
wurde stattdessen das Git-Tag `v2.0.18` (Commit `d0a32e57a7`) im offiziellen Repository.

### Befund aus Primärquellen

1. **Lizenzaufteilung im Repository.** Das Repository
   [makehumancommunity/mpfb2](https://github.com/makehumancommunity/mpfb2) trägt im Wurzelverzeichnis drei
   Dateien: `LICENSE.md`, `LICENSE.CODE.md`, `LICENSE.ASSETS.md`. `LICENSE.md` gibt es seit 11.03.2021; der Text
   im Tag `v2.0.18` ist mit dem heutigen identisch (Byte-Vergleich am 22.11.2026). Inhalt, sinngemäss:
   - MPFB besteht aus zwei getrennten Teilen, Quellcode und Assets, nach dem Muster von MakeHuman.
   - **Quellcode** (Python, Shell-Skripte, Konfiguration) steht unter **GPL-3.0-or-later**.
   - **Assets** sind alle Daten, die zur Ausgabe von MPFB beitragen. Ausdrücklich aufgezählt: Grundnetz und
     Proxys, **Ziele (Targets) und Modifikatoren**, Texturen, Kleidung (MHCLO), **Rigs, Posen und Ausdrücke**,
     JSON-Daten mit Netzinformationen. Sie stehen unter **CC0 1.0 Universal** (`LICENSE.ASSETS.md` ist der
     CC0-Rechtstext).
   - **Ausgabe:** Nach Ansicht des MakeHuman-Teams enthält keine Ausgabe von MPFB Programmlogik, auch nicht bei
     Aufruf per Skript; sie ist eine Kombination aus CC0-Assets und eigener Arbeit und damit frei verwendbar.
     Das Team erhebt ausdrücklich keinen Anspruch auf Exporte (FBX, OBJ, DAE …), per Skript erzeugte Daten,
     Renderings und gespeicherte Modelle.
2. **Warum das Paket nur „GPL" sagt.** Das Erweiterungspaket wird aus `src/mpfb/` gebaut. Dort liegt keine
   Lizenzdatei; das Manifest `src/mpfb/blender_manifest.toml` (Tag `v2.0.18`) nennt als einzige Lizenz
   `SPDX:GPL-3.0-or-later`. Die Blender-Erweiterungsplattform verlangt für Add-ons GPL-3.0-or-later und für
   Assets CC0 ([Blender-Handbuch, Extension Licenses](https://docs.blender.org/manual/en/latest/advanced/extensions/licenses.html));
   das Manifest nennt also die Add-on-Lizenz. Der fehlende Vermerk im Paket ist eine Lücke der Verpackung, kein
   anderer Lizenzstand: Die Lizenzerklärung desselben Stands im Repository deckt Rigs und Ziele ausdrücklich.
3. **Einzelvermerke in den Dateien** (Tag `v2.0.18`, `src/mpfb/data/`):
   - `3dobjs/base.obj` (Grundnetz): Kopfkommentar „ausdrücklich im September 2020 als CC0 freigegeben",
     Rechteinhaber damals Data Collection AB, Joel Palmius, Jonas Hauquier.
   - `rigs/standard/weights.game_engine.json` (Gewichte des im Zielbild benutzten Rigs `game_engine`): Feld
     `"license": "CC0"`.
   - `rigs/standard/rig.game_engine.json` (Knochen): **kein** eigenes Lizenzfeld — gedeckt nur durch
     `LICENSE.md` („Rigs").
   - `targets/**/*.target.gz` (1.258 Dateien, z. B. `nose/nose-hump-incr.target.gz`): reine Zahlenlisten
     (Vertexindex, Versatz), **kein** Kopfvermerk — gedeckt nur durch `LICENSE.md` („Targets and modifiers").
4. **Vorlage MakeHuman.** Das Standard-Skelett von MakeHuman 1.x
   (`makehuman/data/rigs/default.mhskel` im Repository
   [makehumancommunity/makehuman](https://github.com/makehumancommunity/makehuman)) trägt `"license": "CC0"`,
   ebenso seine Gewichte (`default_weights.mhw`). Die `LICENSE.md` von MakeHuman führt dieselbe Asset-Liste
   (ohne das Wort „Rigs", aber mit „alle Daten, die zur grafischen Ausgabe beitragen").
5. **Offizielle Seiten der MakeHuman-Community.**
   - [Lizenzseite](https://static.makehumancommunity.org/about/license.html): MakeHuman-Code AGPL, MPFB-Code GPL,
     alle Kern-Assets CC0 (ohne Bezahlung, Vermerk oder Namensnennung nutzbar).
   - [FAQ „Was hat sich 2020 an der Lizenz geändert?"](https://static.makehumancommunity.org/oldsite/faq/what_changed_regarding_the_license_in_2020.html):
     Seit September 2020 sind Assets eigenständig und standardmässig CC0; Grundnetz, Ziele und Proxys gelten
     nicht mehr als AGPL-Quellcode, sondern als CC0-Grafikdaten; Exporte enthalten nur noch CC0-Material.
     Rigs werden dort nicht eigens genannt.
   - [MPFB-FAQ „Modelle aus MPFB in einem Closed-Source-Spiel?"](https://static.makehumancommunity.org/mpfb/faq/use_in_closed_source.html):
     ja; Grundnetz, Ziele und Häute sind CC0; für Fremd-Assets mit anderer Lizenz ist der Nutzer selbst
     verantwortlich.
   - [MPFB-FAQ „System-Assets für einen eigenen Charaktergenerator?"](https://static.makehumancommunity.org/mpfb/faq/build_other_chargen.html):
     ausdrücklich erwünscht, Grundnetz, Ziele und System-Assets sind CC0.

### Ergebnis

| Teil | Lizenz | Beleg | Ausliefern im kommerziellen Web-Spiel |
|---|---|---|---|
| (1) Standard-Rig/Skelett (`game_engine`, auch `default`) | **CC0** | `LICENSE.md` Abschnitt C „Rigs, poses and expressions"; Gewichte mit `"license": "CC0"`; MakeHuman-`default.mhskel` CC0 | **erlaubt** |
| (2) Körperziele (Targets, Makro- und Gesichtsziele) | **CC0** | `LICENSE.md` Abschnitt C „Targets and modifiers"; FAQ 2020; MPFB-FAQ | **erlaubt**, auch als Morph-Ziele zur Laufzeit |
| (3) Grundnetz `base.obj` | **CC0** | Kopfvermerk in der Datei; `LICENSE.md`; FAQ 2020 | **erlaubt** |
| MPFB-Quellcode (Python) | GPL-3.0-or-later | `LICENSE.md` Abschnitt B, Manifest | nur Werkzeug; **nicht** ins Spiel übernehmen |
| Exportiertes Modell (glTF aus Blender) | frei (CC0-Daten + eigene Arbeit) | `LICENSE.md` Abschnitt D | **erlaubt**, das Spiel fällt nicht unter die GPL |

**Kurz:** Rig, Körperziele und Grundnetz von MPFB 2.0.18 stehen unter CC0; ein daraus exportiertes Modell darf
in einem kommerziellen Web-Spiel ausgeliefert werden, ohne dass das Spiel unter die GPL fällt. Die GPL betrifft
nur den Python-Code des Add-ons, der im Spiel nicht vorkommt.

**Grenzen und Restrisiken (keine davon ändert das Ergebnis):**
- Für `rig.game_engine.json` und die `.target.gz`-Dateien gibt es keinen Vermerk **in der Datei**, nur die
  Lizenzerklärung im Repository. Empfehlung: `LICENSE.md` aus dem Tag `v2.0.18` zusammen mit `herkunft.json`
  ablegen (Beleg, falls die Frage später wieder aufkommt).
- Das Erweiterungspaket selbst nennt nur GPL; wer allein das Paket prüft, kommt zum falschen Schluss. Der
  massgebliche Beleg ist das Repository, nicht das Paket.
- CC0 ist in Deutschland als Verzicht auf das Urheberrecht nicht voll wirksam; dafür greift die
  Rückfall-Lizenz in CC0 Abschnitt 3 (weltweit, unentgeltlich, unwiderruflich, für jeden Zweck). Für die
  Nutzung im Spiel reicht das.
- Die Marke „MakeHuman" ist von CC0 nicht erfasst (CC0 Abschnitt 4a): nicht für Werbung oder Titel benutzen.
- Fremd-Assets aus Community-Paketen „…02/03" stehen teils unter CC BY (A-18) — das Zielbild nutzt nur die
  System-Assets (CC0); bei jedem weiteren Asset die Lizenz einzeln prüfen.
- Kein Anwalt hat das geprüft; der Befund ruht auf den Erklärungen der Rechteinhaber.
