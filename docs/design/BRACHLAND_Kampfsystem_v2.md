# BRACHLAND — Kampfsystem v2.4 (1v1 mit Wechseln)

Ersetzt Kampfsystem v1. Wechselmechanik in v2.1 geklärt, Doppel-Elemente in v2.2 ergänzt, Vergabe über Fundstücke in v2.3, Konzentrat-System in v2.4. Entscheidung: **1v1 nach Pokémon-Schema**, Team von 6,
Wechsel kostet den Zug. Alle Werte simulationsgeprüft (1.200–4.000 Kämpfe je Zeile).

---

## 1. Elementarkreis — 8 Elemente

Konstruktion: Zirkulant, jedes Element schlägt die **zwei folgenden**.
Dadurch ist die Matrix strukturell perfekt ausgewogen — jedes Element hat
2 Stärken, 2 Schwächen, 3 neutrale Begegnungen, und alle haben identischen
Angriffs- und Verteidigungsdurchschnitt (1,125).

**Holz → Stein → Alt-Tech → Sporen → Wasser → Brand → Frost → Fäulnis → Holz**
(jedes schlägt auch das übernächste)

| Angreifer ↓ | Holz | Stein | Alt-Tech | Sporen | Wasser | Brand | Frost | Fäulnis |
|---|---|---|---|---|---|---|---|---|
| **Holz** | 1,0 | **2,0** | **2,0** | 1,0 | 1,0 | 1,0 | 0,5 | 0,5 |
| **Stein** | 0,5 | 1,0 | **2,0** | **2,0** | 1,0 | 1,0 | 1,0 | 0,5 |
| **Alt-Tech** | 0,5 | 0,5 | 1,0 | **2,0** | **2,0** | 1,0 | 1,0 | 1,0 |
| **Sporen** | 1,0 | 0,5 | 0,5 | 1,0 | **2,0** | **2,0** | 1,0 | 1,0 |
| **Wasser** | 1,0 | 1,0 | 0,5 | 0,5 | 1,0 | **2,0** | **2,0** | 1,0 |
| **Brand** | 1,0 | 1,0 | 1,0 | 0,5 | 0,5 | 1,0 | **2,0** | **2,0** |
| **Frost** | **2,0** | 1,0 | 1,0 | 1,0 | 0,5 | 0,5 | 1,0 | **2,0** |
| **Fäulnis** | **2,0** | **2,0** | 1,0 | 1,0 | 1,0 | 0,5 | 0,5 | 1,0 |

**Begründung in der Fiktion:** Wurzeln sprengen Stein und überwuchern Maschinen ·
Stein zermalmt Alt-Tech und bietet Sporen keinen Nährboden · Alt-Tech sterilisiert
Sporen und leitet in Wasser · Sporen verkeimen Wasser und besiedeln Brandflächen ·
Wasser löscht Brand und bricht Eis · Brand schmilzt Frost und brennt Fäulnis aus ·
Frost konserviert gegen Fäulnis und sprengt Holz · Fäulnis zersetzt Holz und
verwittert Stein.

## 2. Schadensformel

```
Schaden = (ANG / VER) × Movepower × 18 + 2   × Elementfaktor × Zufall(0,9–1,1)
```

Kalibriert auf ~4–5 Runden je Wildkampf, ~27 Runden je Regentenkampf.

## 3. Zehrung der Befallenen — der entscheidende Befund

Ursprünglich sollte die Zehrung auf das ganze Team wirken. Die Simulation hat das
widerlegt: Bei teamweiter Zehrung bricht ein befallenes Team im langen Regentenkampf
komplett ein (14 % Siegrate bei 6 %), unabhängig von jeder Taktik — die Mechanik wäre
eine reine Falle gewesen.

**Korrektur: Zehrung wirkt nur auf den aktiven Kämpfer.** Damit wird Wechseln zum
Gegenmittel und die Mechanik zur Entscheidung statt zur Strafe.

Team von 6 gegen Regent „Flussvater" (Wasser, 480 KP, 74/64/50):

| Zehrung/Runde | Team rein | Team befallen |
|---|---|---|
| 0 % | 57,1 % | 95,9 % |
| 4 % | 56,8 % | 87,7 % |
| **6 %** | 56,3 % | **71,7 %** |
| **8 %** | 56,1 % | **45,7 %** |
| 10 % | 56,7 % | 24,7 % |
| 13 % | 56,7 % | 8,3 % |
| 16 % | 57,6 % | 5,6 % |

**Empfehlung: 7 %.** Genau dort liegt der Gleichstand zwischen rein und befallen —
befallen ist in kurzen Kämpfen klar stärker, in langen klar schwächer. Das ist die
Entscheidung, die die Mechanik tragen soll: *stärker jetzt, teurer über die Zeit.*

## 4. Elementvorteil zählt — und zwar deutlich

Gegenprobe, Team mit einer erzwungenen Kreatur des jeweiligen Elements gegen den
Wasser-Regenten (Zehrung 6 %):

| Team enthält | Siegrate |
|---|---|
| Alt-Tech (schlägt Wasser) | **89,0 %** |
| Sporen (schlägt Wasser) | **88,7 %** |
| Frost (unterliegt Wasser) | 30,9 % |
| Brand (unterliegt Wasser) | 29,6 % |

Faktor 3 zwischen richtiger und falscher Teamzusammenstellung. Genau das soll ein
Creature-Collector leisten: **Vorbereitung schlägt Grinding.** Der Spieler, der vor
dem Flussvater gezielt Sporen- oder Alt-Tech-Kreaturen aufbaut, gewinnt; wer mit
Levelbrechstange kommt, verliert.

## 5. Wechseln — geklärt

Erste Simulation zeigte Wechseln als nachteilig (75,9 % mit, 88,7 % ohne). Ursache war
weder die Wechselregel noch eine schwache KI, sondern der **statische Gegner**: Wenn eine
Kreatur fällt, kommt die nächste umsonst — Sterbenlassen *ist* der freie Wechsel. Gegen
einen Gegner mit festem Element brauchst du nie zu wechseln; du startest mit dem richtigen
Konter und mahlst durch.

**Der Fix sind mehrphasige Regenten.** Regent 480 KP, Zehrung 7 %, Variante E, 2.500 Kämpfe:

| Regent | nie wechseln | klug wechseln |
|---|---|---|
| 1 Phase (statisch, Wasser) | 89,3 % / 4,01 Verluste | 86,5 % / 1,65 |
| 2 Phasen (Wasser → Fäulnis) | 68,2 % / 4,27 | **97,4 % / 0,33** |
| 3 Phasen (Wasser → Fäulnis → Alt-Tech) | 45,3 % / 5,16 | **99,5 % / 0,18** |

Bei drei Phasen entscheidet Wechseln zwischen 45 % und 99,5 %. Genau das soll die
Mechanik leisten — und es passt zur Fiktion: Regenten sind VERIDIA-Terraformer, die bei
KP-Schwellen **ihr Protokoll umschalten**. Der Flussvater flutet erst (Wasser), lässt dann
faulen (Fäulnis), fährt zuletzt die Anlagentechnik hoch (Alt-Tech) — sichtbar in Kampf
und Verhalten.

Normale Trainerkämpfe liefern dieselbe Dynamik automatisch, weil der Gegner mehrere
Kreaturen hat. Nur bei einphasigen Wildkämpfen bleibt Wechseln bedeutungslos — das ist
in Ordnung, dort geht es ums Fangen.

### Wechselregel: Variante E — Schutzschild

Der Wechsel kostet den Zug; die eintretende Kreatur nimmt in dieser Runde nur einen
**Anteil des Schadens**. Gemessen gegen die Alternativen (Regent 480 KP, 1 Phase):

| Variante | nie | klug |
|---|---|---|
| A Pokémon-Standard (voller Treffer) | 89,2 % / 4,01 | 60,8 % / 3,01 |
| B Freier Wechsel (kein Zugverlust) | 89,1 % / 4,01 | 89,0 % / 1,56 |
| C Halber Treffer | 89,6 % / 4,00 | 73,3 % / 2,36 |
| D Wechselbudget 2 | 89,1 % / 4,02 | 77,6 % / 2,84 |
| **E Schutzschild** | 89,0 % / 4,02 | **86,7 % / 1,64** |
| F Zug geteilt | 89,3 % / 4,01 | 70,3 % / 2,47 |

A bricht ein (Wechseln wird bestraft), B ist zu billig (kein Preis, keine Entscheidung).
E liegt dazwischen: echter Kosten, mitigiertes Risiko.

### Der Schildwert ist ein Regler, kein Fixwert

`SHIELD_DR` = Schadensanteil, den die eintretende Kreatur in der Wechselrunde nimmt.
Gemessen gegen einen harten 3-Phasen-Regenten (620 KP / 84 ANG), 2.000 Kämpfe:

| Schildwert | Siegrate | Ø Verluste | Ø Wechsel | Missbrauch |
|---|---|---|---|---|
| 0 % Schaden (immun) | 97,0 % | 0,56 | 3,80 | nein |
| 25 % Schaden | 88,3 % | 1,08 | 4,19 | nein |
| **50 % Schaden** | **81,3 %** | **1,53** | **4,71** | nein |
| 75 % Schaden | 76,8 % | 1,94 | 5,02 | **ja** |
| 100 % (kein Schild) | 63,1 % | 2,83 | 5,69 | **ja** |

**Startwert: 50 %.** Darunter wird Wechseln nahezu risikofrei (bei 0 % sind Verluste fast
null — der Kampf verliert seine Spannung), darüber steigt die Wechselzahl an, weil das
Team ins Trudeln gerät und reaktiv statt geplant tauscht.

Der Wert ist bewusst als Regler ausgelegt und lässt sich später differenzieren:

- **global nachjustieren**, wenn Kämpfe zu leicht oder zu zäh wirken
- **pro Schwierigkeitsgrad** (leichter Modus 25 %, harter Modus 75 %)
- **pro Kreatur** als Eigenschaft — schwere, gepanzerte Kreaturen (Grathorn, Silohorst)
  bekommen einen besseren Schild als filigrane; das gibt Kreaturen taktische Rollen als
  „Wechsel-Anker" jenseits ihrer Rohwerte
- **pro Zustand** — befallene Kreaturen mit schwächerem Schild, passend zu ihrer
  Instabilität

## 5a. Ohnmachtskosten (optional, nicht mehr nötig)

Ursprünglich als Lösung angedacht: gefallene Kreaturen kosten Reinkulturen, damit
Sterbenlassen einen Preis hat. Nach dem Phasen-Befund ist das **nicht mehr erforderlich** —
mehrphasige Gegner erzeugen die Entscheidung von selbst.

Als Feinschliff bleibt es interessant, weil es Kampf und Heilungs-Loop koppelt:
Schludriges Kämpfen kostet Fortschritt beim Heilen der Region. Falls eingeführt, reicht
ein niedriger Satz (~0,05–0,10 Reinkulturen je gefallener Kreatur); höhere Sätze wirken
schnell strafend.

## 6. Was daraus für Kapitel 1 folgt

Der Flussvater ist **Wasser**. Der Startroster (Kapitel 1) enthält kaum Sporen und
kein Alt-Tech in Stärke — der Spieler muss also gezielt aufbauen, statt durchzurennen.
Die Zahlen bestätigen, dass dieser Aufbau den Unterschied zwischen ~30 % und ~89 %
Siegchance macht. Der Bosskampf zwingt damit von selbst zum Sammeln und Planen.

## 8. Doppel-Elemente

Verteidigung multipliziert beide Typen (2,0 × 2,0 = 4,0 · 2,0 × 0,5 = 1,0 · 0,5 × 0,5 = 0,25).
Angriff nutzt den jeweils besseren eigenen Typ.

### Die Distanz im Kreis bestimmt den Charakter

Weil die Matrix ein Zirkulant ist, hängt das gesamte Profil einer Kombination nur vom
**Abstand der beiden Elemente im Kreis** ab — eine ungewöhnlich saubere Design-Regel:

| Abstand | Beispiel | 4×-Schwäche | 0,25×-Resistenz | Ø erlittener Schaden | Charakter |
|---|---|---|---|---|---|
| 1 | Holz/Stein | 1 | 1 | 1,406 | **spitz** — Glaskanone mit hartem Konter |
| 2 | Holz/Alt-Tech | 0 | 0 | 1,188 | leicht breiter, ohne Extreme |
| 3–4 | Holz/Sporen | 0 | 0 | 1,125 | **flach** — defensiv wie ein Rein-Element |

Gesamtspanne über alle 36 Kombinationen: 1,125 bis 1,406, also nur Faktor **1,25**.
Zum Vergleich streuen Doppeltypen in Pokémon um ein Vielfaches. Die Matrix ist damit auch
mit Doppel-Elementen strukturell stabil — kein Balancing-Alptraum.

### Doppel-Elemente sind ein deutlicher Machtzuwachs

Regent mit 3 Phasen, 620 KP, Schild 50 %, 3.000 Kämpfe, gleiche Primärelemente in allen Teams:

| Team | Sieg | Ø Verluste |
|---|---|---|
| Rein (1 Element) | 81,8 % | 1,49 |
| Doppel, Abstand 1 | **97,7 %** | 0,31 |
| Doppel, Abstand 2 | **96,4 %** | 0,43 |
| Doppel, Abstand 3 | 86,5 % | 1,38 |
| Doppel, Abstand 4 | 89,7 % | 1,14 |

Ursache ist vor allem die **Angriffsseite**: Ein Doppeltyp trifft immer mit dem besseren
seiner beiden Elemente. Deshalb gilt:

⚠️ **Doppel-Elemente dürfen nicht der Normalfall sein.** Sonst werden Rein-Elemente
wertlos und die gesamte Kurve verschiebt sich.

### Und beim Gegner sind sie brutal

Regent mit Doppel-Element in jeder Phase:

| Team | Sieg |
|---|---|
| Rein | **0,0 %** |
| Doppel Abstand 1 | 39,6 % |
| Doppel Abstand 2 | 51,0 % |

Ein durchgehend doppeltypiger Regent ist für ein Rein-Team eine **unüberwindbare Wand**.
Regelung: Regenten tragen ihr zweites Element **nur in der letzten Phase** — als
Eskalation, nicht als Grundzustand.

### Vergabe-Regel: Fundstücke statt Automatik

Doppel-Elemente werden **nicht** automatisch mit der Entwicklungsstufe vergeben, sondern
über limitierte Fundstücke, die man beim Erkunden findet: **Faulbrand-Konzentrat**.
Einmalig verwendbar, fügt einer Kreatur ein zweites Element hinzu, unwiderruflich.

Warum das besser ist als die Automatik:

- **Es belohnt Erkundung** — das erklärte Kernziel der Weltgestaltung. Abseits der
  Hauptroute liegt echte Macht, nicht nur Beiwerk.
- **Es erzwingt eine Entscheidung.** Wer bekommt das Konzentrat? Die Entscheidung ist
  endgültig und prägt das Team über Kapitel hinweg.
- **Es hält Doppeltypen selten**, ohne eine Regel dafür zu brauchen — Knappheit reguliert
  sich über die Fundmenge.
- **Es passt zur Fiktion.** Du treibst eine Kreatur bewusst weiter vom Tier weg, das sie
  war. Der Machtzuwachs ist derselbe Vorgang, den du in der Welt bekämpfst. Und es steht
  in direkter Gegenrichtung zur **Rückführung**: das eine entfremdet, das andere holt zurück.

### Wie viele Fundstücke?

Regent 3 Phasen, 620 KP, Schild 50 %, gemischte Teams (Abstand 2), 3.000 Kämpfe:

| Doppel im Team | Sieg | Ø Verluste |
|---|---|---|
| 0 von 6 | 81,8 % | 1,48 |
| 1 von 6 | 77,7 % | 1,70 |
| 2 von 6 | 76,4 % | 1,84 |
| 3 von 6 | 78,5 % | 1,75 |
| 4 von 6 | 83,3 % | 1,44 |
| 5 von 6 | 90,7 % | 0,95 |
| 6 von 6 | 96,6 % | 0,44 |

Der Machtzuwachs setzt erst **ab 4 von 6** ein. Bis dahin ist der Effekt neutral bis leicht
negativ — eine einzelne Doppeltyp-Kreatur wird zum Dauereinsatz und nutzt sich ab, während
sie defensiv (Abstand 2: Ø 1,188 statt 1,125) sogar etwas schlechter dasteht.

⚠️ Der leichte Einbruch bei 1–2 ist teilweise ein Artefakt der Wechsel-KI, die die eine
starke Kreatur überstrapaziert. Die belastbare Aussage ist die Schwelle: **bis 3 von 6
unkritisch, ab 4 kippt es.**

**Empfehlung: 1–2 Konzentrate je Region, insgesamt 5–8 im ganzen Spiel.** Damit bleibt
ein Team dauerhaft unter der Schwelle, und jedes einzelne Fundstück behält Gewicht.

### Die acht Konzentrate — je Element eines, je Element ein anderer Weg

Statt eines generischen Fundstücks gibt es **acht verschiedene Konzentrate**, jedes
verleiht genau sein Element. Der Beschaffungsweg passt jeweils zum Element und zieht
eine andere Spielmechanik heran — dadurch wird das System selbst zum Inhalt.

| Element | Konzentrat | Weg | Mechanik |
|---|---|---|---|
| **Holz** | Wurzelharz | Aus einem lebenden Baumriesen zapfen — der Baum stirbt daran | Erkundung + moralische Entscheidung |
| **Stein** | Kalkkern | Tief im Altstollen hinter einer Traversal-Sperre | Erkundung, gated |
| **Alt-Tech** | Akkuherz | Nur aus einem **besiegten** Verwachsenen extrahierbar — nicht aus einem gefangenen | Verzicht: Kreatur *oder* Konzentrat |
| **Sporen** | Reinkultur | Gebraut: drei Zutaten sammeln, Enklaven-Labor nutzen | Sammeln + Crafting |
| **Wasser** | Quellauge | Erst zugänglich, wenn die Region geheilt ist und der Fluss klart | An den Heilungs-Loop gekoppelt |
| **Brand** | Schwelkohle | Auftrag: einen Schwelbrand in einer Ruine kontrollieren, statt ihn zu löschen | Quest |
| **Frost** | Firnkern | Nur bei bestimmter Wetterlage/Jahreszeit an Nordhängen | Weltzustand, zeitfenstergebunden |
| **Fäulnis** | Moderkern | Handel mit den Grünen Mönchen — sie verlangen etwas dafür | Fraktion + Preis |

Acht Wege, acht Spielmechaniken: Erkundung, Gating, Verzicht, Crafting, Heilungs-Loop,
Quest, Weltzustand, Fraktionshandel. Kein Konzentrat wird auf dieselbe Weise erlangt.

### Was daraus folgt

**Der Spieler steuert das Risikoprofil selbst.** Das Konzentrat bestimmt das *zweite*
Element, die Kreatur bringt das *erste* mit — der Spieler entscheidet über die Paarung
also den **Abstand im Elementkreis** und damit den Charakter (siehe Tabelle oben):

- Abstand 1 → spitz: 4×-Schwäche *und* 0,25×-Resistenz. Für Spieler, die planen.
- Abstand 3–4 → flach: defensiv unauffällig, dafür doppelte Angriffsdeckung.

Diese Entscheidungsebene entsteht kostenlos aus der Zirkulant-Struktur und ist der
eigentliche Reiz des Systems: nicht *ob* man ein Konzentrat einsetzt, sondern *auf wen*.

**Nicht alle acht sind in einem Durchgang erreichbar.** Bei 5–8 Konzentraten insgesamt
(Empfehlung oben) und acht möglichen bleibt immer etwas liegen — jeder Durchgang
spezialisiert sich anders. Das erzeugt Wiederspielwert, ohne dass dafür Inhalt gebaut
werden muss.

**Regionale Verteilung.** Jede Region beherbergt 1–2 Konzentrate, passend zu ihrem
Charakter: Œntal liefert Stein und Alt-Tech, Fahlmoos Fäulnis und Sporen, Hochstand
Frost, Aschefeld Brand. Wasser und Holz hängen am Weltzustand und sind erst spät
erreichbar.

Weiterhin von Natur aus doppeltypig, ohne Fundstück:

- **Verwachsene** — Tier + Infrastruktur sind zwei Naturen, meist mit Alt-Tech als zweitem
  Element. Dafür sind sie selten und ortsgebunden.
- **Zuchtlinien ab Stufe 2** — VERIDIA hat sie so konstruiert.
- **Regenten** — zweites Element nur in der Schlussphase, als Eskalation.

### Balancing-Hebel

Die Simulation nimmt an, dass eine Kreatur immer mit ihrem besseren Typ angreifen kann.
Das ist die großzügigste Annahme und der Grund für den hohen Machtzuwachs. Gegenmittel,
falls Doppeltypen zu stark wirken:

- **Movepool statt Automatik:** 4 Move-Slots; ein Doppeltyp *kann* Moves beider Elemente
  lernen, muss sich aber entscheiden. Das ist der natürlichste Deckel und der empfohlene Weg.
- Abstand 1 bevorzugt vergeben (spitzes Profil mit echter 4×-Schwäche) statt Abstand 3–4
- Rohwerte doppeltypiger Kreaturen leicht senken

## 7. Offene Punkte

- ⚠️ Fokus-Ökonomie statt PP: entworfen, aber noch nicht simuliert
- Statuseffekte (Befall als ansteckender Zustand) noch nicht modelliert
