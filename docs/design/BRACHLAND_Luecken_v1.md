# BRACHLAND — was zum Spiel fehlt

**Stand 20.08.2026** · Auslöser: Rückmeldung Flo („Menü fehlt, Karte fehlt, Beutel fehlt,
Regenten nie gefunden, Kartenrand blockiert nicht, Häuser sehen aus wie Scheiße").

Dieses Dokument ist ein **Befund**, keine Entscheidung. Alles darin ist am Code gemessen,
mit Datei und Zeile belegt; wo eine Zahl steht, stammt sie aus einem Werkzeuglauf vom
20.08.2026, nicht aus einer Schätzung.

## Methode

Vier parallele Audits am Repo (Meta-/UI-Systeme, Erzählung, Kartenrand, Asset-Qualität),
dazu ein Systeminventar gegen die Pokémon-Reihe — als Vergleichsmaßstab die beiden
offenen Ableger, **Legends: Arceus** (2022) und **Legends: Z-A** (Oktober 2025), weil sie
strukturell näher an BRACHLAND liegen als die Hauptreihe: begehbare Zonen statt Routen,
sichtbare Kreaturen statt Zufallsbegegnungen.

## 1. Systeminventar

| System | Pokémon (Legends) | BRACHLAND heute | Beleg |
|---|---|---|---|
| **Hauptmenü / Pause** | Arc-Phone, Minus-Taste, überall | **existiert nicht.** Kein Titelbild, kein Pausenzustand, `Escape` unbelegt | `src/main.tsx:758`, `src/spieler/steuerung.ts:61` |
| **Karte** | Zonenkarte mit Markern, verfolgtem Auftrag, Schnellreise | **existiert nicht**, ausdrücklich verworfen. Ersatz: Pfeil auf die nächste Kreatur, 260 m | `src/ui/Witterung.tsx:14,23` |
| **Beutel** | jederzeit, Ziel wählbar | **nur im Kampf.** In der Welt eine Textzeile mit `pointerEvents:'none'` | `BattleScreen.tsx:430` vs. `main.tsx:660,682` |
| **Team ordnen / Box** | Reihenfolge, Ablage, Lager | **existiert nicht.** Bei vollem Team wird der Fang **verworfen** | `main.tsx:298-302` |
| **Heilen** | Basislager, Center | **existiert** — Rasten an 2 Zufluchten, voll und kostenlos | `main.tsx:387-394`, `Ortsfenster.tsx:52` |
| **Index / Dex** | Forschungsaufgaben je Art | **existiert nicht.** `gesehen[]` wird geschrieben und **nirgends gelesen** | `spielstand.ts:40` vs. kein Konsument |
| **Aufträge** | Missions + Requests, verfolgbar, Marker auf der Karte | 4 Aufträge, annehmbar **nur vor dem Geber**, Fortschritt nur dort sichtbar | `Ortsfenster.tsx:60-108`, `main.tsx:614` |
| **NPC / Dialog** | Figuren, Dialogbäume, Zustandszeilen | 3 Kapseln mit **einem** Satz, kein Zustand | `RegionsSzene.tsx:816-820` |
| **Kampf** | rundenbasiert, Typen, Status | **stark und vollständig** — 8 Effektarten, Phasen, Zehrung, Narben, 85 Tests | `engine/battle.ts` |
| **Fangen** | Bälle, Chance, Rückzug | **existiert**, linear, kostet den Zug | `main.tsx:286-310` |
| **Fortschritt** | Level, Entwicklung | **existiert** — Stufe 1–40, 3 Mutationen, entfernungsabhängig | `spiel/fortschritt.ts` |
| **Traversal** | Reittiere je Gelände | **existiert** — Klettern, Gleiten, Reiten, Ausdauer | `src/spieler/` |
| **Weltzustand nach Story** | Zonen ändern sich | `regenten[]` wird nur für den Gleiter gelesen; der Wasserstand ändert sich nicht | `gleiten.ts:77-79`, `main.tsx:440` |
| **Läden / Ökonomie** | Poké-Dollar, Händler | **existiert nicht**, keine Währung | — |
| **Speicherstände** | mehrere Slots | ein Slot, **kein Migrationspfad** — falsche Version verwirft den Stand | `spielstand.ts:77,90` |

**Die Bilanz:** Der Kern — Kampf, Fangen, Aufstufen, Bewegung — ist gebaut und getestet.
Was fehlt, ist fast vollständig die **Schicht darum**: die Oberfläche, mit der man ein
Spiel bedient, und der Faden, an dem man sich durch die Welt hangelt. Das deckt sich mit
einem Ledger-Eintrag, der seit dem 16.08. unverändert offen steht: **G-36 — „Fehlt für
3D-Pokémon: NPCs, Missionen, Angriffseffekte …"**.

## 2. Warum der Regent nie gefunden wurde

Das ist kein Balancing-Problem und kein Zufall. Gerechnet:

| | |
|---|---|
| Position des Flussvaters | x = **+1072 m**, z = **+871 m** (`flussvater.json:47`, `inhalte.ts:153`) |
| Startposition | 0 / 0 (`spielstand.ts:65`) |
| **Entfernung** | **1381 m** |
| Nebelende in der Vorgabestimmung | **420 m** (`RegionsSzene.tsx:102`) |
| Terrain wird gezeichnet bis | 500 m (`sichtweiten.ts:13`) |
| Peilung („Witterung") | 260 m, **nur auf Kreaturen** (`Witterung.tsx:23`, `RegionsSzene.tsx:669`) |
| Aufträge, die auf ihn zeigen | **0 von 4** |
| Texte, die ihn erwähnen | **0** (grep über `content/orte`, `fragmente`, `auftraege`) |
| Auslöseradius des Kampfes | 18 m (`RegionsSzene.tsx:935`) |

Er ist **961 m jenseits der Sichtgrenze**, und nichts im Spiel deutet in seine Richtung.
Ihn zu finden heißt, 1381 m in eine von 360 Richtungen zu laufen und dabei auf 18 m
heranzukommen. Das ist keine Entdeckung, das ist ein Lottoschein.

**Der Fix steht schon im Code und wird nicht benutzt:** Das Auftragsschema kennt den
Zieltyp `regent` (`schema.ts:264`, ausgewertet in `auftraege.ts:70,83`) — **keine einzige
Auftragsdatei verwendet ihn.**

## 3. Der Kartenrand

Gemessen (`RegionsSzene.tsx:1365-1369`, `lod.ts:101,263,315`, `himmel.ts:74`):

1. **Unsichtbare Wand** bei ±1976 m (X) / ±1996 m (Z). Kein Rückstoß, keine Meldung, kein
   Kommentar, kein Ledger-Eintrag. Die Figur bleibt auf offener Wiese stehen.
2. Die Wand steht **8 m vor der Geländekante**. Der Nebel beginnt erst bei 25–60 m — man
   sieht die Kante also bei vollem Kontrast.
3. Das Gelände endet an einer **senkrechten Kante von 0,9 m**: die Kachelschürze,
   freischwebend.
4. Dahinter **nichts** — `scene.background = null`, nur eine kamerafeste Nebelkugel. Keine
   Skybox, keine Fernberge, keine Silhouette.
5. Nach Osten und Süden läuft **gefälschtes Gelände** über die Wand hinaus (71,8 bzw.
   32,5 m): Das Kachelraster rundet auf, und die DEM-Randzeile wird zu einem Streifen
   ausgeschmiert. Der Streifen trägt weder Baum noch Gras (`props.ts:251`).
6. Der **Westrand schneidet mitten durch einen Berg**: DEM-Spalte 0 liegt bei
   848–1134 m ü. NN. Dort endet eine Bergflanke auf halber Höhe im Nichts.

Und das ist der eigentliche Punkt: **Die Region ist an drei von vier Kanten kein
natürlicher Abschluss.** Real liegt jenseits der bbox —

- **Westen:** das Massiv steigt weiter, Wendelstein (1838 m) rund 3,3 km westlich,
  Breitenstein (1622 m) südwestlich
- **Süden:** Flintsbach/Oberaudorf, Zug Wendelstein–Traithen–Sudelfeld, Randhöhen bis 1052 m
- **Norden:** Talweitung nach Nußdorf und Rosenheim
- **Osten:** flache Inntalsohle, A93, der **Inn 1,91 km östlich** (G-55)

Nur nach Osten öffnet sich echte Ebene. Nach Westen, Süden und Nordwesten müsste
**ansteigendes Gelände mit Gipfelsilhouetten** anschließen. Eine unsichtbare Wand mitten
im Hang ist dort die schlechtestmögliche Lösung.

## 4. Die Häuser

Gemessen an allen 2.033 Gebäuden (`terrain.ts:238` `baueGebaeude`):

| | |
|---|---|
| Dreiecke je Haus | **Median 94** · Mittel 105 · Min 22 · Max 586 |
| Verhältnis zum Fuchs (2.728) | **3,4 %** |
| Dachformen | **eine** — Satteldach, First über der langen Achse |
| Wand je Grundrisskante | **ein Quad**, 2 Dreiecke, keine Tiefe |
| Dachhaut | ohne Dicke, 6 Dreiecke gesamt |
| Tür | **nur an einer Wand des Hauses** |
| Farbvokabular | 6 Konstanten, **kein Unterschied Verputz / Holz / Stein** |

Vollständig fehlend: **Schornstein, Dachrinne, Traufuntersicht, Ortgang, Gaube,
Fensterlaibung, Fensterkreuz, Fensterläden, Balkongeländerstäbe, Podest, Dachdicke,
Walm-/Pult-/Flachdach, Anbau, Erker.**

Die Diagnose „sieht aus wie Scheiße" ist also nicht Geschmack. Ein Haus ist heute ein
Quader mit aufgeklebten Rechtecken, ohne eine einzige Kante, die Tiefe hat. Der
Oberbayern-Baubestand lebt genau von den Teilen, die fehlen: weiter Dachüberstand,
sichtbare Sparren, Balkon mit Stäben, Schornstein.

## 5. Wo ich widerspreche

### „Alle Assets mindestens auf Fuchs-Detailqualität"

**Das rechnet nicht auf, und zwar deutlich.**

Auf dem Zielgerät gemessen: **200.000–280.000 Dreiecke bei 60 B/s** (G-31). Im Bild stehen
je nach Standort 30–200 Häuser.

| | Dreiecke je Haus | 100 Häuser im Bild |
|---|---|---|
| heute | 94 | 9.400 |
| „wie der Fuchs" | 2.728 | **272.800** |

Häuser allein würden damit das **gesamte** gemessene Gerätebudget aufbrauchen — bevor ein
einziger Baum, ein Meter Gelände oder eine Kreatur gezeichnet ist. Und Bäume sind heute
schon der größte Posten: 53.815 Fichten, die volle Stufe kostet 2.152.

Detail muss sich nach **Bildfläche** richten, nicht nach Objektart. Der Fuchs steht bei
zwei Metern vor der Kamera und füllt ein Viertel des Bildes; ein Haus in 300 m Entfernung
ist zwanzig Pixel breit. Genau dafür hat die Szene bereits drei LOD-Stufen — Bäume nutzen
sie (2.152 / 174 / 12), Häuser **gar nicht**.

Dazu kommt: Es sind nicht in erster Linie *zu wenige* Dreiecke, es sind die **falschen**.
Ein Schornstein kostet 8 Dreiecke und tut mehr für „das ist ein Haus" als 500 Dreiecke
Wandunterteilung. Die Liste in Abschnitt 4 ist fast durchweg billig.

**Empfehlung statt Pauschalregel:**

| Stufe | Zielwert | wofür |
|---|---|---|
| Grunddetail (überall) | **~300 Dreiecke** | Schornstein, Dachdicke, Traufe, Fensterlaibung, Geländerstäbe, zwei weitere Dachformen |
| Nahstufe (< 40 m, 5–15 Häuser) | **~1.200 Dreiecke** | Gaube, Sparren, Fensterkreuz, Materialwechsel |
| Fernstufe (> 150 m) | **~40 Dreiecke** | Körper + Dach, sonst nichts |

Das kostet bei 100 Häusern rund 40.000 statt 9.400 Dreiecke und bleibt damit im Budget —
und im Nahbereich, wo das Auge hinsieht, ist es **13-mal** so detailliert wie heute.
⚠️ Die drei Zielwerte sind gesetzt, nicht gemessen; sie gehören vor der Umsetzung durch
`npm run szene` bestätigt.

### „Generierte 3D-Assets für Bäume, Häuser, Wasser, Seen, Felsen"

Fünf Kategorien, vier verschiedene Antworten. Pauschal ist es falsch.

| | Urteil | warum |
|---|---|---|
| **Felsen / Klippen** | **Ja, der stärkste Kandidat** | 4.019 Wände aus je 3–4 gekippten Boxen, 36–48 Dreiecke (`klippen.ts`). Eine Handvoll generierter Felsmodelle, instanziert mit Drehung und Skalierung, verändert die Berge sichtbar und kostet fast keine Bytes |
| **Haus-Module** | **Ja, aber keine Häuser** | Grundrisse kommen aus OSM und sind alle verschieden — „ein Hausmodell" gibt es nicht. Generierbar ist ein **Baukasten**: Schornstein, Gaube, Haustür, Fensterladen, Geländerstab. Klein, instanziert, genau das, was fehlt |
| **Bäume** | **Nein** | Der Generator ist nicht das Problem, der Laubballen ist es. Ein generierter Baum bräuchte die Voxel-Kette, käme bei 2.700 Dreiecken an und hätte keine LOD-Leiter — der prozedurale hat eine (2.152/174/12) und liefert je Instanz Varianz umsonst (D79). EZ-Tree wurde 2026-08-16 aus genau diesem Grund verworfen: +4,0 MB (G-33) |
| **Wasser / Seen** | **Nein — falsches Werkzeug** | Wasser ist heute 2 Dreiecke je Segment plus Shader (`bandmaterial.ts:44`). Was fehlt, sind **Gischt, Schaum an Steinen, Ufergeometrie, Tiefenstaffelung** — Shader- und Geometriearbeit, kein Modell |

## 6. Nebenbefunde aus den Audits

Alles am Code belegt, alles klein zu beheben:

1. **`content/fragmente/bruchkante.json` liegt außerhalb der Region.** lon 12,10967 gegen
   Ostkante 12,108 → x = 2109 m bei Weltradius 1984 m. Die unsichtbare Wand steht bei
   1976 m. **Das Fragment ist unerreichbar** — 1 von 13 Fundstücken kann niemand finden,
   und der Zähler „x von 13" erreicht nie 13. Gehört ins Qualitätstor.
2. **Zieltyp `regent` ist implementiert und unbenutzt** (siehe Abschnitt 2).
3. **`gesehen[]` wird an drei Stellen befüllt und nirgends gelesen** — der halbe Dex liegt
   schon im Spielstand.
4. **Fang bei vollem Team wird verworfen** (`main.tsx:298`). Ohne Lager ist das die einzig
   mögliche Regel, aber es ist die schlechteste.
5. **Kein Spielstand-Migrationspfad** — `roh.version !== SPIELSTAND_VERSION` löscht
   (`spielstand.ts:90`). Jede Schemaänderung kostet jedem Spieler alles.
6. **Fragmente sind nach dem Wegtippen nicht mehr abrufbar.** Der Code verspricht eine
   „Leseliste im Beutel" (`main.tsx:588`, `spielstand.ts:43`) — sie existiert nicht.
7. **`LOD_STUFEN[4]` ist toter Code** (32 m, ab 900 m), weil bei 500 m gecullt wird. Wird
   gebraucht, sobald Fernland gezeichnet wird.
8. **Die Kamera ist nicht geklemmt und hat keine Geländekollision** — am Rand schneidet
   ihre Nahebene durch die Kante.

## 7. Empfehlung: drei Züge, in dieser Reihenfolge

Die Reihenfolge ist nicht nach Aufwand sortiert, sondern danach, **was ohne das andere
wertlos ist**. Schönere Häuser in einer Welt ohne Menü sind eine schönere Kulisse.

### Zug 1 — Das Spiel wird bedienbar

Ein Menüsystem mit vier Reitern, ausgelöst durch **einen** Knopf. Das ist bewusst **ein**
Zug und nicht vier: Karte, Beutel, Team und Index teilen sich Rahmen, Eingabe und
Spielstandanbindung; einzeln gebaut entstehen vier Oberflächen, die nicht zueinander passen.

- **Karte** — Region als Draufsicht aus dem Höhenfeld, Orte, Zufluchten, gefundene
  Fragmente, verfolgtes Auftragsziel. Kein Schnellreisen (das nähme der Region ihren Sinn).
- **Beutel** — dieselbe Liste wie im Kampf, Ziel wählbar, plus die versprochene Leseliste
  der Fragmente.
- **Team** — Reihenfolge ändern, Zustand sehen. Ohne Lager: bei vollem Team **fragen**,
  wen man freilässt, statt still zu verwerfen.
- **Index** — `gesehen[]` und `gefangen[]` anzeigen. Die Daten liegen bereits.

*Definition of Done:* Ein Knopf öffnet das Menü, vier Reiter, alles über Touch bedienbar,
Spielstand überlebt den Neuladen, `npm run test` deckt Team-Umsortierung und Beutel-Nutzung
außerhalb des Kampfes ab.

### Zug 2 — Die Erzählung kommt an

- **Auftrag mit Zieltyp `regent`** — der Zieltyp existiert. Ein Bewohner schickt den
  Spieler zum Stauwehr, das Ziel erscheint auf der Karte, die Peilung kennt es.
- **Peilung erweitern**: heute nur Kreaturen in 260 m. Künftig auch das verfolgte
  Auftragsziel, ohne Entfernungsgrenze.
- **Auftragslog unterwegs** — Fortschritt im Menü statt nur vor dem Geber.
- **Fragment `bruchkante` in die Region holen.**
- **Weltzustand sichtbar machen**: „Das Stauwasser sinkt" steht als Satz da
  (`main.tsx:440`) und passiert nicht.

*Definition of Done:* Ein neuer Spielstand führt ohne Vorwissen zum Flussvater. 13 von 13
Fragmenten erreichbar. Der Wasserstand nach dem Sieg ist sichtbar anders.

### Zug 3 — Die Welt hört auf zu lügen, dann wird sie schön

- **Kartenrand**: Fernland als niedrig aufgelöste Kulisse aus SRTM-Daten jenseits der bbox
  (Wendelstein, Breitenstein, Ostflanke), dazu eine **weiche** Begrenzung — Gelände, das
  ansteigt und ununterhbar wird, statt einer Wand auf der Wiese. `LOD_STUFEN[4]` wartet
  darauf.
- **Häuser** auf die drei Detailstufen aus Abschnitt 5.
- **Felsen** aus generierten Modellen (Abschnitt 5).
- **Wasser**: Gischt und Ufer.

*Definition of Done:* Kein Standort im Œntal zeigt eine freischwebende Geländekante.
`npm run szene` bleibt unter dem Gerätebudget. Auf dem Handy nachgemessen.

## 8. Was ich nicht empfehle

- **Alles gleichzeitig anfangen.** Der Umfang oben ist mehr, als in dieser Fassung des
  Projekts an einem Stück gut wird.
- **Häuser vor dem Menü.** Ein Spiel ohne Menü ist eine Techdemo, egal wie die Häuser
  aussehen.
- **Die bbox erweitern**, um den Rand zu lösen. D70 hat das entschieden und gut begründet
  (13 von 18 Ankern gingen verloren). Das Fernland ist Kulisse, kein Spielgebiet.
- **Schnellreise.** Bei 4 km Kantenlänge nimmt sie der Region ihren einzigen Inhalt.

---

## Quellen zum Vergleichsmaßstab

- [Pokémon Legends: Arceus — Requests (Bulbapedia)](https://bulbapedia.bulbagarden.net/wiki/Walkthrough:Pok%C3%A9mon_Legends:_Arceus/Requests_1-30) —
  Arc-Phone, Reiter „Missions & Requests", ein verfolgter Auftrag mit Flaggensymbol
- [Pokémon Legends: Z-A Review (DualShockers)](https://www.dualshockers.com/pokemon-legends-z-a-review/)
- [Pokémon Legends: Z-A Review (Pixelkin)](https://pixelkin.org/2025/11/13/pokemon-legends-z-a-review/)
- Geografie jenseits der bbox: [Brannenburg](https://de.wikivoyage.org/wiki/Brannenburg),
  [Wendelstein](https://en.wikipedia.org/wiki/Wendelstein_(mountain)),
  [Flintsbach am Inn](https://de.wikipedia.org/wiki/Flintsbach_am_Inn)
