---
last-reviewed: 2026-11-21
shelf-life-days: 90
---
# BRACHLAND — Lage der Enklave und der Zufluchten im Œntal (Entwurf v1)

> **Abgelöst durch [v2](BRACHLAND_Enklave_Lage_v2.md) (D375, 22.11.2026).** Die Koordinaten unten sind der Stand
> **vor** dem Umzug der Enklave; die gesetzte Ortsliste steht in v2. Bleibt als Beleg für Befund und Optionen.

**Status:** Entschieden am 22.11.2026 (Flo, D374): **Option 2 „Hangterrasse“**, Flut vom Stauwehr, Flutlinie 499 m (Arbeitswert) — siehe `BRACHLAND_Story-Bibel_v2.md` §4. Dieses Dokument bleibt Bestandsaufnahme; die Fragen unten stehen im Ledger (A-21, A-24). Bestandsaufnahme vom 21.11.2026 aus Story-Bibel,
Story-Struktur, Traversal, Bauwelt, `content/orte`, `content/auftraege`, `content/fragmente`, `content/regenten` und
dem Höhenraster `public/world/oental.json`. Nichts davon ist umgesetzt.

Flo, 21.11.2026: Die Lage der Enklave ergibt sich aus der Story. Story und Questlinie müssen so weit stehen, dass sich
entscheiden lässt, wo Enklaven sinnvoll liegen, damit Erkundung angeheizt wird und nicht alles zu einfach lösbar ist.

## Befund

Weltkoordinaten in Metern, Regionsmitte 0/0 = Spielstart (`src/spiel/spielstand.ts`), x nach Osten, z nach Süden.

| Ort | Typ | x | z | Höhe m | zum Start |
|---|---|---|---|---|---|
| Dorf (Förster, Bursche, Alte, Magd, Wirt, Schmiedin) | Bewohner, faktisch Enklave | 1292–1371 | 397–513 | 492–494 | ~1.400 |
| Flussvater = Stauwehr | Regent | 1071 | 871 | 499 | 1.380 |
| Werkstor (`werk-schichtbuch`) | Bewohner, kritischer Pfad | 1305 | 1177 | 513 | 1.758 |
| Silo-Hof (`saatgut-rein`) | Reinkultur | 99 | 298 | 630 | **314** |
| Stollenmund (`katalysator-v3`) | Reinkultur | −254 | 292 | 693 | **387** |
| Absetzbecken (`wasserprobe-quell`) | Reinkultur | 170 | −1534 | 502 | 1.544 |
| Unterstand Mitte / Heustadel | Zuflucht | −7 / 107 | 87 / 461 | 639 / 631 | 87 / 473 |
| Almhütte | Zuflucht | −1473 | −1415 | 1055 | 2.043 |
| grat-hoch („über tausend Metern hört es auf“) | Fundstück | −1232 | 3 | 1020 | 1.232 |

**Was nicht trägt:**
1. **Der Regent steht vor der Haustür.** Dorf, Stauwehr und Werkstor liegen in einem Dreieck mit höchstens 730 m
   Seitenlänge.
2. **Zwei von drei Reinkulturen liegen am Start** (314 m und 387 m). Die Dorfaufträge schicken zurück statt nach vorn.
3. **Eine Nabe:** 6 von 9 Bewohnern stehen in einem Kreis von 80 m. Das widerspricht der Story-Struktur
   („keine Nabe, wenige NPCs“).
4. **Keine Tore:** Klettern ist ab Start frei (Traversal v1 sieht es erst nach dem Flussvater vor), und die Nordkante
   zum Fahlmoos ist offen.
5. **Die Westhälfte (750–1144 m) hat keinen Zweck.** Dort liegen nur zwei Fundstücke und die Almhütte.
6. **Höhe gegen Flut:** Das Dorf liegt 492–494 m hoch, also unter dem Stauwehr (499 m). Unter 495 m stehen 1.314
   von 2.033 Gebäuden.

**Widersprüche in den Texten:**
- „Mildorf“ (Story-Bibel) gibt es in `content` nicht. Der Name ist ein Echo von Mühldorf, die Region ist aber
  Brannenburg.
- Ruine und Altstollen sind derselbe OSM-Punkt, einen Moorrand gibt es nicht.
- Die Zeiten in den Texten passen nicht zu 40–60 Jahren nach dem Kollaps: „seit achtzehn Jahren“, „vor zwei Jahren“
  (`steinbruch-wart`, `werk-schichtbuch`, `bruchkante`, `kalkbruch`).
- Die Flut ist laut Texten frisch: Das Wasser steht „seit dem Frühjahr“.
- Die Fraktionen Erbe und Grüne Mönche haben keinen Inhalt.

## Optionen

| | 1 „Letzte trockene Schwelle“ | 2 „Hangterrasse“ | 3 „Hochenklave über 1.000 m“ |
|---|---|---|---|
| Lage | bleibt am Dorf (492–494 m), Flutlinie ~490 m knapp darunter | Terrassenkante x 650–750, z −280…−740, 505–525 m | Almhütte (1.055 m) oder grat-hoch (1.020 m), dazu ein Talposten |
| Story | Damm und Sandsäcke, das Wasser vor der Tür („die Enklave will ihn tot“, §9.2) | blickt auf den gefluteten Talboden, über jeder Flutlinie bis 500 m | über der Befallsgrenze, gestützt auf die Fundtexte („nach oben, nicht ins Tal“) |
| Milbinger Straße | **bewohnt**: D346–D348 werden zur geflickten Enklavenstraße umgebaut | **Brache in der Flutzone**: D346–D348 bleiben, dazu Wasserlinie und Schlamm | Brache, bewohnt höchstens am Talposten |
| Erkundung | Regent braucht einen verdeckten Zugang; eine Komponente muss weit weg | ~1,4 km über gefluteten Grund zum Regenten; die abgesoffene Stadt (z ≈ −600) wird zum Erkundungsgebiet | Westhälfte bekommt Sinn, der Abstieg ist der Zweck des Gleitens |
| Kosten | fertige Stände D346–D348 umbauen, die Nabe bleibt | sechs Bewohner umziehen, Tagesroutine (D177) neu, Aufträge bleiben | Start und §9.1 anpassen, echte Tore nötig, Spielzeit messen |

**Für alle drei Optionen:**
- Die drei Reinkulturen liegen in drei verschiedenen Richtungen, nicht zwei am Start.
- Die Zufluchten verteilen sich in Ringen, neu im Osten über der Flut (Kalkbruch-Kapellen, 525 m) und im Norden
  (Kirche −284/−1784, 578 m).
- Die Tore aus Traversal v1 greifen wirklich.

## Fragen an Flo

1. Woher kommt die Flut (Rückstau des Inn von Nordosten, Tiefpunkt 465 m, oder Stau am Wehr, 499 m), und welche
   `flutlinie` gilt?
2. Beginnt das Spiel an der Enklave (§9.1), oder bleibt der Start in der Regionsmitte?
3. Wie heißt die Enklave? „Mildorf“ oder ein Echo aus Brannenburg?
4. Sollen die Traversal-Tore greifen (Klettern erst später, Nordkante gesperrt)?
5. Sind die Zeiten in den Texten (18 Jahre, 2 Jahre) lokale Zeiten oder Fehler gegen 40–60 Jahre?
