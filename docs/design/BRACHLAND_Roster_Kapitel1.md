# BRACHLAND — Roster Kapitel 1 „Œntal"

Region: Inntal-Süd (Wendelstein-Fuß), 465–1139 m, ~16 km².
16 Linien · 35 Kreaturen · 7 der 8 Elemente (Brand fehlt — kommt erst im Aschefeld).

Designregel durchgehend: **heimisches Tier × genau ein Biotech-Merkmal.**
Spawn = OSM-Tag, die Pipeline setzt das automatisch.
Werte: KP / ANG / VER / INI.

---

## Elementverteilung und was daraus folgt

| Element | Linien |
|---|---|
| Alt-Tech | 4 |
| Stein | 3 |
| Sporen | 3 |
| Holz | 2 |
| Fäulnis | 2 |
| Wasser | 1 |
| Frost | 1 |
| Brand | 0 |

**Der Flussvater hat drei Phasen: Wasser → Fäulnis → Alt-Tech.**

- Phase 1 (Wasser) kontern Sporen und Alt-Tech — beides reichlich vorhanden. Machbar.
- Phase 2 (Fäulnis) kontern Brand und Frost. **Brand existiert in Kapitel 1 nicht**, Frost
  nur über den seltenen Firnhasen an Nordhängen über 1000 m. Das ist der Engpass des
  Kapitels: Wer den Firnhasen nicht sucht, muss Phase 2 austanken.
- Phase 3 (Alt-Tech) kontern Stein und Holz — vorhanden. Machbar.

Das Kapitel zwingt damit ohne eine einzige Textzeile zur Erkundung: Der Aufstieg über
1000 m ist der Unterschied zwischen komfortablem und zähem Bosskampf.

**Konzentrate im Œntal:** Kalkkern (Stein) tief im Altstollen hinter einer
Traversal-Sperre · Akkuherz (Alt-Tech) nur aus einem **besiegten** Verwachsenen —
Trafomarder oder Silohorst, die man dann nicht fangen kann.

---

## Move-Struktur (Details siehe Move-System v1)

Jede Kreatur hat **4 Slots**. Moves tragen ein Element; stimmt es mit einem Element der
Kreatur überein, gibt es **×1,5 Schaden**.

- **Grundmoves (2):** fest ab Stufe 1 — die Identität der Linie
- **Signaturmoves:** je 1 garantiert bei S2 und S3
- **Exposition:** Biom-Moves durch Kämpfe in einer Region, plus erbeutete Attacken von
  Verhärteten, Zuchtlinien und Regenten

Daraus folgt der Ausgleich zwischen langen und kurzen Linien: **3-stufige Linien** haben
ab S3 alle 4 Slots voll — Exposition ist dort immer ein Tausch. **2-stufige Linien** haben
einen freien Slot und sind damit anpassungsfähiger, was ihre schwächeren Werte ausgleicht.


---

## Wildlinge (10 Linien, 25 Kreaturen)

### 1 — Grathorn · Steinbock × Chitinplatten-Gehörn · **Stein** · 3 Stufen
Spawn: `natural=cliff`, ab 900 m
Das Wappentier der Region. Ruhig, territorial, greift erst an, wenn man den Grat betritt.

| Stufe | Name | KP/ANG/VER/INI |
|---|---|---|
| 1 Angepasst | **Grathorn** | 130/58/62/44 |
| 2 Durchdrungen | **Grathaupt** | 162/72/78/48 |
| 3 Vollzogen | **Kalkvollzug** | 198/88/96/50 |

**Grund:** Plattenstoß (Stein 1,0) · Kalkstaub (Stein 0,7 — senkt gegn. INI)
**Signatur S2:** Gratsprung (Stein 1,5) · **Signatur S3:** Abschütteln (Utility — entfernt Statuseffekte, füllt Fokus)
*Slots ab S3 voll — Exposition nur im Tausch.*

### 2 — Nebelgams · Gams × Silikat-Hufe · **Stein** · 2 Stufen
Spawn: Steilhang, `natural=scrub`
Schnellster Steinträger. Flieht, wenn man sie frontal angeht — muss von oben gestellt werden.

| Stufe | Name | KP/ANG/VER/INI |
|---|---|---|
| 1 | **Nebelgams** | 105/52/48/72 |
| 2 | **Firngams** | 138/68/60/86 |

**Grund:** Hufhieb (Stein 1,0) · Steilflucht (Utility — Wechsel ohne Zugverlust)
**Signatur S2:** Splitterhuf (Stein 1,5)
*1 freier Slot für Exposition.*

### 3 — Kiemenbiber · Biber × Filterkiemen-Kragen · **Wasser** · 3 Stufen
Spawn: `waterway=stream` (182 Vorkommen in der Region)
Baut Dämme aus Trümmern. Im Kapitel häufig — und gegen den Flussvater nutzlos.

| Stufe | Name | KP/ANG/VER/INI |
|---|---|---|
| 1 | **Kiemenbiber** | 140/50/60/38 |
| 2 | **Stauleib** | 172/62/76/40 |
| 3 | **Klärgrund** | 208/74/94/42 |

**Grund:** Schwanzschlag (Wasser 1,0) · Dammbau (Utility — erhöht VER)
**Signatur S2:** Filterstrom (Wasser 1,5) · **Signatur S3:** Klarwasser (Utility — heilt 25 %)
*Slots ab S3 voll.*

### 4 — Sporenhahn · Auerhahn × Sporenfächer · **Sporen** · 3 Stufen
Spawn: `landuse=forest`, `natural=wood`
Balzt in befallenen Lichtungen. Der zuverlässigste Konter gegen Phase 1 des Flussvaters.

| Stufe | Name | KP/ANG/VER/INI |
|---|---|---|
| 1 | **Sporenhahn** | 100/60/44/58 |
| 2 | **Fächerbalz** | 128/76/54/66 |
| 3 | **Hallenbrut** | 156/94/62/72 |

**Grund:** Fächerschlag (Sporen 1,0) · Sporenwolke (Sporen 0,7 — Befall-Chance)
**Signatur S2:** Balzruf (Utility — senkt gegn. VER) · **Signatur S3:** Sporenbrut (Sporen 1,5)
*Slots ab S3 voll.*

### 5 — Myzelmolch · Feuersalamander × Leuchtmyzel-Adern · **Sporen** · 2 Stufen
Spawn: Bachrand, feuchter Waldboden
Leuchtet nachts. Glaskanone — hoher Angriff, dünne Verteidigung.

| Stufe | Name | KP/ANG/VER/INI |
|---|---|---|
| 1 | **Myzelmolch** | 95/64/40/50 |
| 2 | **Leuchtmolch** | 124/84/50/58 |

**Grund:** Ätzhaut (Sporen 1,0) · Leuchtsignal (Utility — erhöht INI)
**Signatur S2:** Myzelfaden (Sporen 1,5)
*1 freier Slot für Exposition.*

### 6 — Wurzelkeiler · Wildschwein × Wurzelpanzer · **Holz** · 3 Stufen
Spawn: `natural=wood`, `landuse=meadow`
Wühlt Wurzelwerk um. Der Panzer wächst aus dem Boden nach, den es durchbricht.

| Stufe | Name | KP/ANG/VER/INI |
|---|---|---|
| 1 | **Wurzelkeiler** | 150/62/56/34 |
| 2 | **Dickichtbrecher** | 184/78/70/38 |
| 3 | **Wurzelvollzug** | 222/96/86/40 |

**Grund:** Hauerstoß (Holz 1,0) · Wurzelgriff (Holz 0,7 — sperrt gegn. Wechsel)
**Signatur S2:** Dickichtsturm (Holz 1,5) · **Signatur S3:** Eingraben (Utility — VER stark hoch)
*Slots ab S3 voll.*

### 7 — Linsenuhu · Uhu × Facetten-Linsenaugen · **Alt-Tech** · 2 Stufen
Spawn: Ruinen, `natural=cliff` — nur nachts
Beobachtet, bevor er angreift. Sichtbar an den reflektierenden Augen im Dunkeln.

| Stufe | Name | KP/ANG/VER/INI |
|---|---|---|
| 1 | **Linsenuhu** | 98/66/42/64 |
| 2 | **Spähuhu** | 126/84/52/74 |

**Grund:** Stoßflug (Alt-Tech 1,0) · Blendlinse (Utility — senkt Genauigkeit)
**Signatur S2:** Impulsschrei (Alt-Tech 1,5)
*1 freier Slot für Exposition.*

### 8 — Spürfuchs · Fuchs × Sensor-Fell · **Alt-Tech** · 3 Stufen
Spawn: `landuse=farmyard`, Siedlungsrand
Streunt um die Enklaven. Schnellste Kreatur des Kapitels.

| Stufe | Name | KP/ANG/VER/INI |
|---|---|---|
| 1 | **Spürfuchs** | 102/54/46/78 |
| 2 | **Witterfuchs** | 130/68/58/90 |
| 3 | **Meldefuchs** | 158/84/68/102 |

**Grund:** Schnappbiss (Alt-Tech 1,0) · Fährte (Utility — erhöht Fangchance)
**Signatur S2:** Sensorsprung (Alt-Tech 1,5) · **Signatur S3:** Störfeld (Utility — blockiert gegn. Utility 2 Runden)
*Slots ab S3 voll.*

### 9 — Moderotter · Kreuzotter × Fäulnisdrüse · **Fäulnis** · 2 Stufen
Spawn: feuchte Senken, `waterway=ditch`
Erste Fäulnis-Kreatur. Vergiftet über Zeit statt hart zu treffen.

| Stufe | Name | KP/ANG/VER/INI |
|---|---|---|
| 1 | **Moderotter** | 92/68/38/60 |
| 2 | **Schlickotter** | 120/88/48/68 |

**Grund:** Fäulnisbiss (Fäulnis 1,0) · Moderhauch (Fäulnis 0,7 — Schaden über Zeit)
**Signatur S2:** Zersetzen (Fäulnis 1,5)
*1 freier Slot für Exposition.*

### 10 — Firnhase · Schneehase × Frostkristall-Fell · **Frost** · 2 Stufen
Spawn: Nordhänge ab 1000 m — **selten**, nur bei bestimmter Wetterlage
Die einzige Frost-Kreatur des Kapitels und damit der einzige verfügbare Konter gegen
Phase 2 des Flussvaters. Wer sie nicht sucht, kämpft den Boss deutlich zäher.

| Stufe | Name | KP/ANG/VER/INI |
|---|---|---|
| 1 | **Firnhase** | 88/50/44/86 |
| 2 | **Firnläufer** | 116/66/56/100 |

**Grund:** Frostbiss (Frost 1,0) · Klirren (Utility — senkt gegn. INI)
**Signatur S2:** Firnsprung (Frost 1,5)
*1 freier Slot für Exposition — beim Firnhasen meist Firnschliff vom Nordhang.*

---

## Zuchtlinien (4 Linien, 8 Kreaturen)

Reine VERIDIA-Konstrukte: symmetrisch, seriennummeriert, „zu perfekt".
Entwickeln sich **nur per Katalysator** aus Ruinen — nicht durch Kämpfen.

### 11 — Serie K7 „Kalkläufer" · Reh-Bauplan · **Stein** · 3 Stufen
Spawn: `landuse=quarry` — selten
Die erste Zuchtlinie, der der Spieler begegnet. Trägt eine eingeätzte Nummer am Lauf.

| Stufe | Name | KP/ANG/VER/INI |
|---|---|---|
| 1 | **K7-a** | 120/70/58/60 |
| 2 | **K7-b** | 152/88/74/66 |
| 3 | **K7-c** | 186/108/90/70 |

**Grund:** Normstoß (Stein 1,0) · Kalibrieren (Utility — erhöht ANG dauerhaft)
**Signatur S2:** Bruchkante (Stein 1,5) · **Signatur S3:** Serienschlag (Stein 1,0, trifft zweimal)
*Slots ab S3 voll.*

### 12 — Serie M3 „Moderwächter" · Dachs-Bauplan · **Fäulnis** · 2 Stufen
Spawn: Ruinen im Talgrund
Wurde gebaut, um Zersetzung zu steuern. Tut das jetzt ohne Auftrag.

| Stufe | Name | KP/ANG/VER/INI |
|---|---|---|
| 1 | **M3-a** | 128/64/62/44 |
| 2 | **M3-b** | 160/80/80/48 |

**Grund:** Kompostschlag (Fäulnis 1,0) · Abbauprotokoll (Fäulnis 0,7 — Schaden über Zeit, verstärkt sich)
**Signatur S2:** Verwesung (Fäulnis 1,5)
*1 freier Slot für Exposition.*

### 13 — Serie S9 „Sporenträger" · Vogel-Bauplan · **Sporen** · 2 Stufen
Spawn: VERIDIA-Außenposten
Ursprünglich zur Aussaat gebaut. Verteilt jetzt Befall statt Saatgut.

| Stufe | Name | KP/ANG/VER/INI |
|---|---|---|
| 1 | **S9-a** | 110/72/48/56 |
| 2 | **S9-b** | 140/92/60/64 |

**Grund:** Aussaat (Sporen 1,0) · Wartungsmodus (Utility — heilt 30 %, 1× pro Kampf)
**Signatur S2:** Keimstoß (Sporen 1,5)
*1 freier Slot für Exposition.*

### 14 — Serie H1 „Hüter" · **Holz** · 1 Stufe · **Story-Unique**
Spawn: fest, am Baumriesen (Fundort des Wurzelharz-Konzentrats)
Der letzte funktionierende Prototyp der ersten Baureihe. Bewacht den Baum, aus dem das
Wurzelharz gewonnen wird — wer das Konzentrat will, muss ihn besiegen.

| Stufe | Name | KP/ANG/VER/INI |
|---|---|---|
| — | **H1 „Hüter"** | 165/60/78/30 |

**Festes Set (4):** Standhalten (Utility — halbiert Schaden 3 Runden) · Astschlag (Holz 1,0) · Wurzelnetz (Holz 0,7 — sperrt Wechsel) · Letzte Direktive (Holz 1,5 — nur unter 25 % KP)

---

## Verwachsene (2 Linien, 2 Kreaturen)

Tier + Infrastruktur. Ortsgebunden, einmalig, **von Natur aus doppeltypig**.
Nicht wild anzutreffen — sie stehen an ihrem Bauwerk und warten.

### 15 — Silohorst · Storch × Bunker-Silo · **Alt-Tech / Stein** · 1 Stufe
Spawn: `man_made=bunker_silo` — fest, ein Exemplar
Hat sein Nest in einen Futtersilo hineinwachsen lassen, bis nicht mehr zu sagen ist, wo
das Tier aufhört. Mini-Boss des Kapitels.

| KP/ANG/VER/INI |
|---|
| 175/58/70/30 |

**Festes Set (4):** Silosturz (Stein 1,5) · Metallschnabel (Alt-Tech 1,0) · Verankern (Utility — sperrt eigenen Wechsel, verdoppelt VER) · Staubwolke (Stein 0,7 — senkt Genauigkeit)

### 16 — Trafomarder · Baummarder × Trafostation · **Alt-Tech / Fäulnis** · 1 Stufe
Spawn: Umspannwerk am Talrand — fest, ein Exemplar
Lebt im Schaltschrank. Extrem schnell, extrem dünnhäutig. Aus ihm lässt sich das
**Akkuherz** extrahieren — dann ist er allerdings verloren.

| KP/ANG/VER/INI |
|---|
| 112/76/50/68 |

**Festes Set (4):** Lichtbogen (Alt-Tech 1,5) · Kriechstrom (Alt-Tech 0,7 — Schaden über Zeit) · Kurzschluss (Utility — blockiert gegn. Utility) · Nagen (Fäulnis 1,0)

---

## Offene Punkte

- ⚠️ Werte sind Startwerte im Verhältnis zur Simulationsbasis (115/55/50/52), nicht
  gegen echte Kämpfe getestet. Nach dem ersten Playtest von M0 nachjustieren.
- ⚠️ Fokus-Kosten je Move stehen in Move-System v1, sind aber **nicht simuliert** —
  offen ist, ob schwere Moves attraktiv sind oder normale dominieren.
- ⚠️ Utility-Effekte (Statuswerte senken/erhöhen, Schaden über Zeit, Wechselsperre) sind
  benannt, aber nicht in Zahlen gefasst.
- Fangraten je Kreatur noch offen — Faustregel: Zuchtlinien schwer, Verwachsene gar nicht
  (nur besiegen oder heilen).
- Brand fehlt bewusst. Falls Phase 2 des Flussvaters im Test zu hart wird, ist die
  einfachste Korrektur eine zweite Frost-Linie statt einer Brand-Kreatur — sonst
  verliert das Aschefeld sein Alleinstellungsmerkmal.
