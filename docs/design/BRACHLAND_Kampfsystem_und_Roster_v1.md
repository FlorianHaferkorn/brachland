# BRACHLAND — Kampfsystem & Startroster v1

Stand: Spike-Ergebnisse, simulationsgeprüft. Ergänzt die Story-Bibel v1.
Region Kapitel 1: **Inntal-Süd** (Wendelstein-Fuß, 465–1139 m, Delta 673 m).

---

## 1. Elementarkreis

Fünf Elemente, geschlossener 5er-Kreis — bewusst klein, damit Balancing beherrschbar bleibt.

**Holz → Stein → Alt-Tech → Sporen → Wasser → Holz**

- Vorteil (schlägt): **×2,0**
- Nachteil (wird geschlagen von): **×0,5**
- sonst: ×1,0

Begründung in der Fiktion: Wurzeln sprengen Stein · Stein zermahlt Maschinen · Strom verbrennt Sporen · Sporen befallen Wasser · Wasser zersetzt Holz.

## 2. Werte & Schadensformel

Werte pro Kreatur: **KP · ANG · VER · INI**

```
Schaden = ( ANG / VER ) × Movepower × 18 + 2      × Elementfaktor × Zufall(0,9–1,1)
```

Kalibrierung aus der Simulation: Bei Basiswerten ~120 KP / 55 ANG / 50 VER ergibt das **~4–5 Runden pro Wildkampf**. Das ist die Zielgröße — kurz genug fürs Handy, lang genug für Entscheidungen.

⚠️ **Wichtiger Simulationsbefund:** Die erste Formelvariante (Faktor 0,45) erzeugte Kämpfe über 30 Runden ohne K.o. — unspielbar. Die Kampflänge hängt fast vollständig am Verhältnis Schaden/KP; das ist der eine Regler, den man beim Balancing zuerst festnagelt.

## 3. Zustände (Querachse zum Element)

| Zustand | Effekt | Fangbar |
|---|---|---|
| **rein** | Basiswerte | ja |
| **befallen** | +25 % ANG/VER, +15 % INI — **Zehrung: verliert x % der max. KP pro Runde** | ja |
| **verhärtet** | Endstadium, stark, nicht fangbar — nur besiegbar oder mit Reinkulturen heilbar | nein (Heilung → rein + Narben-Bonus) |

### Zehrung — simulationsgeprüfte Tuning-Kurve

Befallen vs. rein, identische Basiswerte, 4.000 Kämpfe je Zeile:

| Zehrung/Runde | Siegrate befallen | Ø Kampflänge |
|---|---|---|
| 0 % | 99,2 % | 4,9 |
| 3 % | 96,2 % | 4,9 |
| 5 % | 90,9 % | 4,8 |
| 6 % | 84,2 % | 4,8 |
| **8 %** | **68,5 %** | 4,6 |
| **10 %** | **53,5 %** | 4,4 |
| 14 % | 21,7 % | 3,9 |

**Empfehlung: 8–10 %.** Darunter ist „befallen" ein Gratis-Buff (keine echte Entscheidung), darüber eine Falle, die niemand freiwillig wählt. Bei 8–10 % ist es genau das, was es sein soll: **stärker jetzt, teurer über die Zeit** — gut für kurze Kämpfe, schlecht für lange.

⚠️ **UNKLAR / offen:** Der Bosskampf-Test war schlecht angelegt (1 Kreatur gegen einen Regenten mit 300 KP → 0 % in allen Varianten, wenig aussagekräftig). Die Zehrung entfaltet ihren eigentlichen Reiz erst im **Team-Kampf über mehrere Wechsel** — das muss mit 3–6 Kreaturen gegen einen Regenten neu simuliert werden, bevor die Werte final sind.

## 4. Moves

4 Slots pro Kreatur. Kein PP-System — stattdessen **Fokus** als gemeinsame Ressource des aktiven Teams (regeneriert pro Runde). Starke Moves kosten mehr Fokus. Das ersetzt Attrition durch Entscheidungen und passt zu kurzen Handy-Sessions.

Movepower-Bänder: leicht 0,7 · normal 1,0 · schwer 1,5 (hoher Fokuskosten) · Utility 0 (Status/Buff).

---

## 5. Startroster — 10 Kreaturen (Inntal-Süd)

Designregel durchgehend: **heimisches Tier × genau ein Biotech-Merkmal**.
Spawn = OSM-Tag der Zone (die Pipeline setzt das automatisch).

| # | Name | Basis × Merkmal | Element | Ursprung | Spawn (OSM-Tag) | KP/ANG/VER/INI |
|---|---|---|---|---|---|---|
| 1 | **Grathorn** | Steinbock × Chitinplatten-Gehörn | Stein | Wildling | `natural=cliff`, Hochlagen | 130/58/62/44 |
| 2 | **Nebelgams** | Gams × Silikat-Hufe | Stein | Wildling | Steilhang, `natural=scrub` | 105/52/48/72 |
| 3 | **Kiemenbiber** | Biber × Filterkiemen-Kragen | Wasser | Wildling | `waterway=stream` | 140/50/60/38 |
| 4 | **Sporenhahn** | Auerhahn × Sporenfächer | Sporen | Wildling | `landuse=forest`, `natural=wood` | 100/60/44/58 |
| 5 | **Myzelmolch** | Feuersalamander × Leuchtmyzel-Adern | Sporen | Wildling | feuchter Waldboden, Bachrand | 95/64/40/50 |
| 6 | **Wurzelkeiler** | Wildschwein × Wurzelpanzer | Holz | Wildling | `natural=wood`, `landuse=meadow` | 150/62/56/34 |
| 7 | **Linsenuhu** | Uhu × Facetten-Linsenaugen | Alt-Tech | Wildling | Ruinen, `natural=cliff` (nachts) | 98/66/42/64 |
| 8 | **Spürfuchs** | Fuchs × Sensor-Fell | Alt-Tech | Wildling | `landuse=farmyard`, Siedlungsrand | 102/54/46/78 |
| 9 | **Serie-K7 „Kalkläufer"** | Zuchtlinie: Reh-Bauplan, symmetrisch, seriennummeriert | Stein | Zuchtlinie | `landuse=quarry` (selten) | 120/70/58/60 |
| 10 | **Silohorst** | Storch × Bunker-Silo-Verwachsung | Alt-Tech | Verwachsener | `man_made=bunker_silo` (fest, 1 Exemplar) | 175/58/70/30 |

**Anmerkungen zum Roster:**
- Elementverteilung: Stein 3 · Sporen 2 · Alt-Tech 3 · Holz 1 · Wasser 1. Bewusst unausgewogen — Wasser und Holz kommen verstärkt in Kapitel 2 (Œn-Aue, Moor), damit der Spieler dort echten Zugewinn spürt.
- **Silohorst** ist der einzige Verwachsene und steht als fester Weltgegner an einem konkreten Ort — Mini-Boss statt Random-Encounter.
- **Serie-K7** ist die erste Zuchtlinie: zu perfekt, seriennummeriert, erster stiller Hinweis auf VERIDIA.
- Der Regent **Der Flussvater** (Riesenwels × Kläranlagen-Organik, Wasser, verhärtet) ist bewusst **Wasser** — der Spieler hat im Startroster fast nichts dagegen und muss Sporen (schlägt Wasser) gezielt aufbauen. Das erzwingt Team-Denken statt Levelbrechstange.

---

## 6. Nächste Schritte (vor Repo)

1. **Team-Simulation** 3–6 Kreaturen gegen Regenten — Zehrung final tunen, Fokus-Ökonomie testen.
2. **Testkreatur in Blender**: ein CC0-Basis-Rig + Biotech-Anbau + Import in three.js → misst den echten Aufwand pro Kreatur (der wichtigste Kostenschätzer für den ganzen Roster).
3. **Authoring-Gefühl prüfen**: Wenn das Ausschreiben dieser 10 Spaß gemacht hat, trägt das Projekt. Wenn nicht, ist das das ehrlichste Stopp-Signal.

---

## 7. Asset-Lage (Recherche-Stand)

Verfügbar CC0/frei: Quaternius (Nature MegaKit ~68 Modelle, Ultimate Animated Animal Pack — 12 Tiere mit je 12+ Animationen), Poly Pizza (Aggregator, lizenzgefiltert), OpenGameArt (CC0-Sammlung, Basemeshes), ithappy „Animals FREE" (7 Tiere, saubere Rigs), itch.io Low-Poly/PSX-Tierpacks.

⚠️ **Alpen-Fauna fehlt überall**: Steinbock, Gams, Auerhahn, Murmeltier existieren nicht als freie Modelle. Zwei Wege — Substitution (Hirsch → Rothirsch, Ziege → Gams, generischer Vogel → Auerhahn) oder Kitbashing auf vorhandene Rigs. Letzteres brauchst du für die Biotech-Anbauten ohnehin; deshalb Schritt 2 oben zuerst.
