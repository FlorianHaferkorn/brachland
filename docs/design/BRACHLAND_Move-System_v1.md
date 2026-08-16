# BRACHLAND — Move-System v1.1

Ergänzt Kampfsystem v2.4 und Roster Kapitel 1.
Grundsatz: **planbarer Kern, dynamischer Rand.**

---

## 1. Move-Grundlagen

Jede Attacke hat **ein Element** und eine **Power-Stufe**:

| Band | Power | Rolle |
|---|---|---|
| leicht | 0,7 | Nebeneffekt-Träger (Status, Schaden über Zeit) |
| normal | 1,0 | Arbeitspferd |
| schwer | 1,5 | Entscheidungsmove, hohe Fokus-Kosten |
| Utility | — | kein Schaden, verändert den Kampfzustand |

**Elementbonus:** Stimmt das Element des Moves mit einem Element der Kreatur überein,
schlägt der Schaden mit **×1,5** zu Buche.

Das ist zugleich der Deckel für Doppeltypen: Eine doppeltypige Kreatur *kann* Moves beider
Elemente lernen, hat aber nur **4 Slots**. Wer beide Elemente abdeckt, verzichtet auf Tiefe;
wer sich spezialisiert, hat eine Blöße. Die Simulation nahm bisher an, dass immer der bessere
Typ verfügbar ist — mit Movepools fällt der Machtzuwachs deutlich moderater aus.

## 2. Vier Slots, drei Lernwege

| Weg | Was | Wann |
|---|---|---|
| **Grundmoves** | 2 feste Moves je Linie — die Identität der Kreatur | ab Stufe 1 |
| **Signaturmoves** | 1 Move je Entwicklungsstufe, garantiert | bei S2 und S3 |
| **Exposition** | Biom-Moves und erbeutete Attacken | im Spiel verdient |

**Rechnung pro Linie:**

- **3-stufige Linien:** 2 Grund + 2 Signatur = 4 Slots voll. Exposition ist hier immer ein
  **Tausch** — etwas muss weichen.
- **2-stufige Linien:** 2 Grund + 1 Signatur = 3 Slots. Ein freier Slot für Exposition.
- **1-stufige** (Verwachsene, Uniques): festes Set aus 4.

Das ist ein bewusster Ausgleich: Kurze Linien haben schwächere Werte, dafür mehr
Anpassungsfreiheit. Lange Linien sind stark, aber starr.

**Überschreiben nur mit Nachfrage.** Verzicht ist die Entscheidung, nicht ein Versehen.

## 3. Exposition — der dynamische Teil

Kreaturen lernen von dem, was ihnen widerfährt. Zwei Quellen:

### 3a. Biom-Moves

Kämpft eine Kreatur wiederholt in einer Region, nimmt sie deren Eigenart an. Der Ort
bestimmt, was sie wird — direkt an die OSM-Karte gekoppelt.

| Biom (OSM) | Move | Element / Power |
|---|---|---|
| `natural=cliff`, `landuse=quarry` | **Gratwind** | Stein 1,0 |
| `landuse=forest`, `natural=wood` | **Astwerk** | Holz 1,0 |
| `waterway=stream`, `natural=water` | **Strömung** | Wasser 1,0 |
| Ruinen, `landuse=industrial` | **Reststrom** | Alt-Tech 1,0 |
| Senken, `waterway=ditch` | **Moderluft** | Fäulnis 0,7 (Schaden über Zeit) |
| Nordhänge ab 1000 m | **Firnschliff** | Frost 1,0 |
| befallene Zonen | **Befallsstoß** | Sporen 1,0 (Befall-Chance) |

Damit tragen zwei Grathörner unterschiedliche Biografien — eines vom Grat, eines aus dem
Stollen — obwohl es dieselbe Linie ist.

### 3b. Erbeutete Attacken

Übersteht eine Kreatur eine Attacke, kann sie diese mit einer Chance selbst lernen.

⚠️ **Bewusst begrenzt** auf **Verhärtete, Zuchtlinien und Regenten**. Bei jedem Wildkampf
würde es zum Farmen einladen und die Kreaturen-Identität auflösen. So bleibt es selten und
jedes Mal ein Ereignis — und es belohnt genau die Kämpfe, die ohnehin die interessanten sind.

Die stärksten erbeutbaren Moves sind die Signaturmoves der Regenten — ein Grund, den
Bosskampf zu überleben statt ihn nur zu gewinnen.

### 3c. Verständlichkeit — gelöst

Das größte Risiko dieses Systems ist nicht die Mechanik, sondern dass Lernen **zufällig statt
verdient** wirkt. Gegenmittel, in dieser Reihenfolge:

**1. Vorher ankündigen, nicht hinterher melden.**
Beim Betreten eines Bioms zeigt die Kreaturen-Leiste eine Anpassungs-Anzeige:
`Grathorn · Altstollen 3/8 → Reststrom`. Der Spieler weiß von der ersten Sekunde an, was
er sich gerade erarbeitet, und kann es bewusst ansteuern oder meiden.

**2. Fester Schwellenwert statt Zufall.**
Biom-Moves werden nach einer **festen Zahl Kämpfe** im Biom gelernt (Richtwert 8), nicht
mit einer Chance. Zufall gehört nur zum Erbeuten — und dort ist der Auslöser sichtbar
(„du hast Lichtbogen überstanden"), also nachvollziehbar.

**3. Herkunft dauerhaft sichtbar.**
Jeder Move trägt im Menü seine Quelle: `Gratwind — gelernt am Wendelstein-Grat` ·
`Lichtbogen — erbeutet vom Trafomarder`. Damit wird das Moveset zur Biografie und der
Spieler erinnert sich an den Weg, nicht nur an die Zahlen.

**4. Der Tausch ist ein Moment, kein Dialogfeld.**
Bei vollen Slots keine nüchterne Abfrage, sondern eine Gegenüberstellung: alter Move mit
seiner Herkunft gegen neuen Move mit seiner. Was man aufgibt, hat eine Geschichte — das
macht den Verzicht spürbar.

**5. Nichts wird still gelernt.**
Kein Move erscheint ohne Meldung. Lieber eine Meldung zu viel als ein Moveset, das sich
unbemerkt verändert.

## 4. Fokus statt PP — simuliert

Kein Move-Vorrat. Stattdessen ein **Fokus**-Pool des aktiven Kämpfers, der pro Runde
regeneriert.

| Band | Power | **Fokus-Kosten** | Schaden je Fokus |
|---|---|---|---|
| leicht | 0,7 | **1** | 0,70 |
| normal | 1,0 | **2** | 0,50 |
| schwer | 1,5 | **3** | 0,50 |
| Utility | — | 1–3 | — |

**Start 4 · Regeneration +2 je Runde · Maximum 8.**
Ein Wechsel setzt den Fokus der eintretenden Kreatur auf den Startwert zurück.

### Der Befund: die erste Metrik war falsch

Ursprünglich waren schwere Moves mit **Kosten 4** angesetzt. Nach Schaden je Fokus
(0,38) sind sie damit dem normalen Move (0,50) klar unterlegen — sie wären reine
Fallen gewesen.

Aber Schaden je Fokus ist die **falsche Metrik**. Im echten Kampf ist die knappe Ressource
nicht Fokus, sondern **die Runde**, weil man in jeder Runde selbst Schaden nimmt. Ein
knappes Duell (eigene 140 KP, Gegner 230 KP, 17 Schaden je Runde) zeigt das:

| Kostenmodell | nur leicht | nur normal | schwer bevorzugt |
|---|---|---|---|
| 1/2/4, Regen 2 | verloren | verloren | verloren |
| 1/2/4, Regen 3 | verloren | verloren | **gewonnen** |
| 1/3/5 (Power 0,7/1,2/2,0), Regen 3 | verloren | **gewonnen** | **gewonnen** |

Sobald es eng wird, entscheidet **Schaden je Runde**, nicht je Fokus — und dort ist der
schwere Move die einzige Option, die reicht.

### Empfehlung: Kosten 1 / 2 / 3, Regen 2

Damit ist Schaden je Fokus zwischen normal und schwer **gleich (0,50)**. Die Entscheidung
verschiebt sich von Effizienz auf **Tempo**: Der schwere Move liefert mehr pro Runde, lässt
sich aber bei Regeneration 2 nicht durchgehend bezahlen — man alterniert. Genau der Rhythmus,
den ein Kampf braucht.

Leichte Moves bleiben mit 0,70 je Fokus am effizientesten, aber mit 0,7 Schaden je Runde am
langsamsten. Sie rechtfertigen sich über ihre **Nebeneffekte** (Befall, Schaden über Zeit,
Statuswerte), nicht über Schaden — genau ihre Rolle im Roster.

## 5. Offene Punkte

- ⚠️ Utility-Effekte in Zahlen fassen: Statuswerte-Änderungen in %, Dauer von Schaden über
  Zeit, Länge der Wechselsperre. Das ist der letzte ungeklärte Systemteil — er lässt sich
  aber sinnvoll erst am laufenden M0 justieren, nicht am Reißbrett.
- Chance beim Erbeuten: Richtwert 15 % je überstandenem Treffer von Verhärteten,
  Zuchtlinien und Regenten. Am Playtest nachziehen.
