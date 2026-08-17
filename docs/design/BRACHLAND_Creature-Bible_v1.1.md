---
last-reviewed: 2026-08-17
shelf-life-days: 180
---
# BRACHLAND — Creature Design Bible v1.1 (Textfassung)

> **Status: verbindlich.** Ersetzt `BRACHLAND_Stilreferenz_v1.md` als oberste
> Kreatur-Referenz; die Stilreferenz gilt weiter für die **Wildlinge** und ist dort
> die feinere Auflösung.
>
> Diese Datei ist die **Textfassung** des Blattes von Flo (v1.1). Sie existiert,
> weil ein Bild nicht im Gate prüfbar ist und weil jede Zahl darauf eine
> Entsprechung im Code haben muss. Wo Blatt und Code auseinanderlagen, steht hier,
> welche Seite gewonnen hat und warum.

## 1. Die drei Herkünfte

| Herkunft | Was sie ist | Optik | Code |
|---|---|---|---|
| **Wildlinge** | Echte Tiere, die der Faulbrand mutiert hat | organisch, asymmetrisch, gewachsen | `ursprung: 'wildling'` |
| **Zuchtlinien** | Künstliche Organismen aus VERIDIA-Anlagen | symmetrisch, modular, konstruiert | `ursprung: 'zuchtlinie'` |
| **Verwachsene** | Tier und Infrastruktur sind eins geworden | ortsgebunden, massiv, funktional | `ursprung: 'verwachsener'` |

## 2. Evolutionsstufen — und die Ausnahme

| Stufe | Name | Bedeutung |
|---|---|---|
| I | Angepasst | Erster Kontakt mit dem Symbionten |
| II | Durchdrungen | Der Symbiont dominiert |
| III | Vollzogen | Die Tierform ist Restform |

Erreicht werden sie über die Erfahrungsstufe (`mutationBei`, Schwellen 1/14/28) —
22 Kämpfe bis zur ersten Mutation, 83 bis zur zweiten.

### Verwachsene haben KEINE Stufen — Entscheidung

Das Blatt zeigt V03 Trafomarder in drei Stufen mit Pfeilkette. Das Schema verbietet
das (`stufen.length === 1` für `verwachsener`), und **das Schema behält recht**:

Ein Verwachsener ist laut Blatt selbst *„ortsgebunden, massiv, funktional"* und
gehört zu den *„Bossformen und Ruinenwächter"*. Er ist nicht fangbar. Etwas, das man
nicht mitnimmt, braucht keine Fortschrittskurve — es gäbe keinen Weg, Erfahrung
dorthin zu bringen, und ein zweiter Weg (Weltzustand als Stufenquelle) wäre ein
eigenes System für genau eine Kreaturart.

**Konsequenz für das Blatt:** Die drei Bilder der Verwachsenen-Zeile sind eine
**Entstehungsgeschichte**, keine Spielmechanik. Beschriftung sollte „Entstehung"
lauten, nicht „Evolutionsstufen".

## 3. Die vier Zustände

Quer zur Stufe — jede Kreatur jeder Stufe kann in jedem Zustand sein.

| Zustand | Fangbar | Zehrung | Wirkung | Code |
|---|---|---|---|---|
| **rein** | ja | — | Basiswerte | `'rein'` |
| **befallen** | ja | **12 %**/Runde, nur aktiver Kämpfer | ANG +15 %, VER +15 %, **INI +10 %** | `'befallen'` |
| **verhärtet** | **nein** | — | Endstadium, Bossformen | `'verhaertet'` |
| **rückgeführt** | ja | 0 % | Narbe je Herkunft | `'rueckgefuehrt'` |

### Wo das Blatt korrigiert werden muss

**Zehrung: 12 %, nicht 7 %.** Die 7 % stammen aus der Vor-Simulation. Die Engine
wurde danach neu kalibriert, weil der Befall-Bonus mit STAB und Fokus mehr wert ist
als gedacht (Begründung an `REGELN.ZEHRUNG`). Der Dateikopf von `battle.ts` stand
selbst noch auf 7 % — das ist mit dieser Runde behoben.

**Befallen: +15/+15/+10, nicht „+20 % Rohwerte".** Dass Initiative **weniger**
profitiert, ist die Bremse, die den Befall nicht dominant macht. Eine einzelne Zahl
verliert genau diese Aussage.

## 4. Die drei Narben

Das Blatt nennt „+15 % Krit", „+20 % Resistenz", „+30 % Verteidigung". Beim
Nachrechnen fiel auf, dass Resistenz und Verteidigung **auf denselben Engine-Wert**
gelaufen wären (`ver`) — drei Narben, mechanisch zwei Effekte. Deshalb sind sie
jetzt verschieden definiert, und die Zahlen des Blattes bleiben unangetastet:

| Herkunft | Narbe | Wirkung in der Engine |
|---|---|---|
| Wildling | +15 % Krit | Volltrefferchance 6 % → **21 %** |
| Zuchtlinie | +20 % Resistenz | dämpft den **Elementnachteil**: Faktor 2,0 → 1,8. Einen Vorteil des Verteidigers lässt sie in Ruhe |
| Verwachsener | +30 % Verteidigung | `ver` × 1,3 |

Die Narbe folgt aus der **Herkunft**, nicht aus den Daten der Kreatur — jede
Zuchtlinie trägt dieselbe Systemnarbe. `erstelle()` verwirft sie bei jedem anderen
Zustand als `rueckgefuehrt`: Sie entsteht durch die Reinigung, nicht durch die
Datenlage.

## 5. Was durch dieses Blatt neu in der Engine steht

| Neu | Warum es das Blatt gebraucht hat |
|---|---|
| **Volltreffer** (6 % Basis, ×1,6) | Die Wildling-Narbe hätte sonst auf nichts gezeigt — Krit gab es nicht |
| **Trefferwurf** (95 % Basis, 12,5 pp je Stufe, Boden 45 %) | `blendlinse` heißt „trifft schlechter" und war als `ang -2` umgesetzt. Weniger Angriff ist gleichmäßig weniger Schaden; weniger Genauigkeit ist **gelegentlich gar keiner** |
| **Statusstufen** (±3, 20 % je Stufe) | Nötig, damit Wirkungen überhaupt greifen können |
| **`rueckgefuehrt`** als vierter Zustand | Das Enum hatte drei |
| **Fangsperre bei verhärtet** | `fangchance` hing nur an den KP |

### Der Befund, der dabei herauskam

**Move-Effekte wurden nie angewendet.** `moveDef()` warf `effekte` weg — alle 49
Moves trugen ihre Wirkungen im JSON, und die Engine hat keine davon gesehen.
Ledger G-24 nannte *drei* fehlende Wirkungen; gefehlt haben **alle sieben**.

Umgesetzt sind jetzt die beiden stufenförmigen Arten (`statuswert`, `genauigkeit`)
— 14 der 21 Effektnutzungen. Die übrigen fünf Arten (`heilung`,
`schaden_ueber_zeit`, `wechselsperre`, `reinigung`, `befall`) stehen als **G-56**
offen.

## 6. Optik — was gilt

- **Eine Signalfarbe: biolumineszentes Blau.** Das Blatt legt sie für den Befall
  fest, damit ist die Frage aus Stilreferenz v1 entschieden. Das Violett der
  Befallen-Spalte auf dem Blatt ist Illustration, nicht Spezifikation.
- **Befall ist Pilz, Flechte und Biolicht — keine Technikaufkleber.** Diese Regel
  aus Stilreferenz v1 gilt **für Wildlinge**. Zuchtlinien und Verwachsene sind von
  Bauart technisch; dort beschreibt die Regel den *Befall*, nicht den Körper.
- **Ein Auswuchs je Kreatur**, aus genau einer der sechs Funktionskategorien.
- **Fidelity-Ziel ist die Silhouette, nicht das Rendering.** Im Spiel stehen
  Kreaturen bei 4.000 Dreiecken (`zielTris`, Schema) im Nebel; die Bilder des
  Blattes haben Rim Light, Glow und Kristallkanten. Das ist kein Mangel des
  Blattes — Silhouette ist genau das, was Low-Poly plus Nebel überträgt. Es muss
  nur benannt sein, sonst wird bei jedem Modell gegen ein unerreichbares Bild
  gemessen.

## 7. Offene Punkte im Blatt (Stand v1.1)

| Stelle | Ist | Soll |
|---|---|---|
| Regelbox „Die vier Zustände" | **BUCHLINIEN** | BEFALLEN |
| Regelbox Befallen | Zehrung 7 % / Runde | **12 %** / Runde |
| Regelbox Befallen | +20 % Rohwerte | ANG +15 %, VER +15 %, **INI +10 %** |
| Größenklassen-Kopf | an menschlicher **Sihouette** | Silhouette |
| K7-a-Beschreibung | stabil, **seriemäßig** | serienmäßig |
| Verwachsene-Zeile | „Evolutionsstufen" | **„Entstehung"** (siehe §2) |

## Definition of Done (Kreatur nach dieser Bibel)

- **Input:** neue `.json` in `content/creatures/`
- **Output:** `npm run validate` grün, Herkunft gesetzt, genau ein Auswuchs aus
  einer der sechs Kategorien, `zielTris` ≤ 4.000
- **Fehlerfall:** Verwachsener mit mehr als einer Stufe → Schema lehnt ab, und das
  ist richtig (§2)
- **Rollback:** Datei löschen
