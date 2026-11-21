---
last-reviewed: 2026-11-21
shelf-life-days: 365
---
# ADR-0017 — Verfall erzählt: Zeit, Flut und Bewohnung als eine Regel für alles Gebaute

**Status:** Proposed · 2026-11-21 · erweitert [Bauwelt v1](../design/BRACHLAND_Bauwelt_v1.md) (D287/D289) von Gebäuden
auf Straßenraum, Fahrzeuge, Mobiliar und Gelände; erweitert [ADR-0005](0005-qualitaetsanspruch-die-welt-haelt-ueberall.md)
(die Welt hält überall) · Bestätigung durch Flo offen (Ledger A-21)

## Kontext

Flo, 21.11.2026: Verwitterung und Zerstörung sollen das Narrativ besser unterstützen. Die Story-Bibel setzt den Zustand
fest: **40–60 Jahre nach dem Kollaps**, die Menschheit lebt in Enklaven, der Flussvater **staut den Fluss und flutet das
Tal**. Die Bauwelt (D287, im Generator seit D289) übersetzt das für **Gebäude** in Stufen: 0 bewohnt (im Umkreis von
150 m um Bewohner und Zufluchten aus `content/orte`), 1 verlassen, 2 verfallen, 3 Ruine. Befall gibt es nur an
Infrastruktur.

Drei Lücken, gefunden am 21.11.2026:

1. **Die Regel gilt nur für Häuser.** Straße, Fahrzeuge, Schilder, Markierungen und Kleinkram an der Milbinger Straße
   (D346–D348) sind ohne sie entstanden. Das Ergebnis liest sich wie fünf bis zehn Jahre Leerstand: Reste von
   Baustellenmarkierungen, ein Kleinwagen mit Karosserie, ein Sandkasten, eine geschlossene Asphaltdecke mit Frostschäden.
2. **Die Ausnahme widerspricht der Regel.** `content/milbinger-substanz.json` setzt acht Häuser an der Milbinger Straße
   auf Stufe 1–2 und öffnet zwei Dächer (D347). Die Straße liegt aber mitten in der Enklave: Förster 3 m, Bursche 25 m,
   Alte 65 m, Magd 72 m, Wirt 69 m, Schmied 80 m (`content/orte/dorf-*.json`, nachgemessen 21.11.2026). Nach der
   Bauwelt wären diese Häuser Stufe 0. Flos Auftrag an Codex lautete dort „zusammenhängende postapokalyptische Fassung“.
   Beides gilt nicht zugleich.
3. **Die Flut fehlt im Bild.** Der Flussvater ist der Regent des Œntals. Weder eine Hochwasserlinie noch Schlamm oder
   Treibgut kommen in Bauwelt oder Generator vor.

## Entscheidung

Jedes gebaute oder hergestellte Ding in der Welt bekommt seinen Zustand aus **drei Größen**, nicht aus Gestaltung je Ort:

| Größe | Quelle | Wirkung |
|---|---|---|
| **Zeit** | Story-Bibel: 40–60 Jahre, eine Zahl für die ganze Welt | Was 50 Jahre ohne Pflege übersteht und was nicht (Tabelle unten) |
| **Bewohnung** | `content/orte` (Bewohner, Zuflucht), Radius 150 m wie D289 | Stufe 0: geflickt, genutzt, ausgeschlachtet. Nichts verfällt dort ungestört, nichts liegt ungenutzt herum |
| **Flut** | neuer Regionswert `flutlinie` (m ü. NN) in `content/regions/<id>.json`, nur Œntal | Unterhalb: Schlammrand und Wasserlinie an Fassaden, Treibgut, Sedimentfächer, Röhricht; oberhalb nichts davon |

**Zeit, 50 Jahre ohne Pflege — Richtwerte, keine Messwerte** (⚠️ UNKLAR: ohne Primärquelle, vor der Umsetzung je Zeile
belegen oder als Gestaltungsannahme kennzeichnen):

| Bauteil | Zustand nach ~50 Jahren | Heute an der Milbinger Straße |
|---|---|---|
| Asphalt, Wohnstraße | Decke in Schollen, Fugen und Ränder von Gras, Moos, Birken und Weiden durchwachsen; Mitte länger offen als die Ränder | geschlossen, Frostschäden, Reparaturnähte (D348) |
| Fahrbahnmarkierung | nicht mehr erkennbar | ausgebleichte Baustellenreste (D348) |
| Pkw | Rostgerippe ohne Glas, Reifen und Innenraum; in der Enklave ausgeschlachtet (Bleche, Sitze, Räder verbaut) | Kleinwagen mit Karosserie (D347) |
| Kunststoff (Roller, Sandkasten) | zerfallen, ausgebleicht, weitgehend unter Streu | erkennbare Relikte (D347) |
| Schilder, Masten | Stahl stark korrodiert, teils umgestürzt; Schrift weg | Straßenname lesbar, Verfall 0,86 (D347) |
| Dächer, verlassen | Bauwelt Stufe 1–3 wie D287 | wie D287 |
| Gehölz auf Freiflächen | Pionierwald: Birke, Weide, Esche bis ~15–20 m Höhe | Gärten mit Säumen (D347) |

**Bewohnung (Stufe 0) heißt konkret:** Fahrspur freigehalten und gestampft, Schollen am Rand aufgeschichtet; Fahrzeuge
als Materiallager; Dächer mit Wellblech und Brettern geflickt statt offen; Gärten als Beete; Brennholz, Wäsche, Rauch,
Wege zwischen den Häusern. Verfall gibt es dort am Rand der Enklave und an aufgegebenen Häusern, nicht an jedem Haus.

**Befall** bleibt bei D287: an Infrastruktur gebunden, die eine Signalfarbe als Punkt. Pflanzen auf Häusern und Straßen
sind heimische Arten in echter Größe (`content/massstab.json`, D352) — das Fremde erzählt der Befall, nicht der Efeu.

**Ortsbezogene Ausnahmen** (wie `milbinger-substanz.json`) bleiben erlaubt, müssen aber der Regel folgen oder ihren
Grund im Datensatz nennen (Feld `grund`). Ohne Grund gilt die Regel.

## Konsequenzen

- **Positiv:** Ein Spieler liest Zeit, Flut und Enklave am Bild ab, ohne Text. Die Welt erzählt dieselbe Geschichte
  an jedem Ort, auch an Orten, die nie einzeln gestaltet wurden. Prüfbar: Ein Werkzeug kann Zustand gegen Lage
  (Abstand zu Bewohnern, Höhe über/unter `flutlinie`) testen wie `tools/massstab.ts` die Größen.
- **Negativ:** D346–D348 müssen überarbeitet werden. Entweder wird die Milbinger Straße zur bewohnten Enklavenstraße,
  oder die Enklave rückt weg und die Straße wird zur 50-Jahre-Brache. Beides kostet Arbeit an fertigen,
  am M1 gemessenen Ständen.
- **Negativ:** Ein Pionierwald auf Straßen und in Gärten erhöht die Zahl der Bäume im Siedlungsbereich deutlich, mit
  Folgen für Dreiecke, Schatten und Sicht im Kampf. Muss am M1 gemessen werden.

## Grenze (bekannte Limitation)

- Die Höhe der `flutlinie` ist **nicht entschieden**. Sie hängt an der Story (wie hoch staut der Flussvater, bis wohin
  reicht die Flut) und am Gelände. Bis zur Entscheidung zeichnet der Generator keine Flutspuren.
- Die Zeittabelle ist Gestaltungsgrundlage, keine Messung. Jede Zahl, die ins Spiel geht, braucht vorher einen Beleg
  oder die Kennzeichnung als Annahme im Ledger.
- Das Fahlmoos (Brutmutter, Moor) bekommt eigene Größen statt der Flut (Gelege, Moorwasserstand). Nicht Teil dieses ADR.
- Fassadendetails (Fensterachsen, Lauben, Farben) regelt dieses ADR nicht. Sie kommen aus Fotos (A-20) oder dem
  Typenbaukasten der Bauwelt.
