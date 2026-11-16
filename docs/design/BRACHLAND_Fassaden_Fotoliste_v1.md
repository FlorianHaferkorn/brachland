# BRACHLAND — Fassaden-Fotoliste Öntal (v1)

> Stand 15.11.2026 (D291). Status und offene Punkte leben im Ledger `../_INDEX.md`, nicht hier.
> Format der Steckbriefe: `Fassade` in `../../src/data/schema.ts`; Ablage `../../content/fassaden/<id>.json`.

## Wozu

Silhouette (Höhe, Dachform, Firstrichtung) und Dachfarbe kommen je Haus aus LoD2 und DOP20 (D290/D291).
Was keine offene Quelle liefert: **Fassade** — Fensterachsen, Laube, Putz- und Holzfarbe, Läden, Malerei.
Diese 44 Gebäude sind die, an denen die Geschichte spielt oder die der Spieler aus der Nähe sieht
(Orte aus `content/orte`, ihr Umfeld im 60-m-Radius, Kirchen und Kapellen). Für den Rest bleibt der Generator.

## Pro Gebäude fotografieren

1. Traufseite frontal (ganze Länge, Dach sichtbar), Giebelseite frontal, eine Schrägansicht.
2. Fenster je Geschoss zählen (Traufe und Giebel getrennt) — das sind `fensterachsen`.
3. Laube: keine / Traufseite / Giebel / umlaufend; Hochlaube unter dem Giebel ja/nein.
4. Farben: Putz EG, Holz OG/Giebel, Läden — bei bedecktem Himmel, nicht in Sonne.
5. Malerei, Inschrift, Jahreszahl kurz notieren.
6. Nur von öffentlichem Grund; keine Personen, keine Kennzeichen. Fotos unter `assets/fotos/` (nicht ausgeliefert).

Steckbrief-Beispiel (Werte sind Platzhalter, keine Messung):

```json
{ "id": "beispiel-hof", "region": "oental", "name": "Hof am Bach", "ort": [47.7410, 12.0919],
  "quelle": { "foto": "assets/fotos/beispiel-hof-traufe.jpg", "datum": "2026-11-20", "urheber": "Flo" },
  "fensterachsen": { "traufe": 5, "giebel": 3 }, "laube": "giebel", "hochlaube": true,
  "putz": "#e8e2d4", "holz": "#6b4a2e", "laeden": "#3f5a3a", "malerei": null }
```

`ort` ist ein Punkt im Grundriss (Spalte Koordinate unten genügt). Der Generator übernimmt Farben (Ton der
Palette, Licht und Abdunklung bleiben), Fensterzahl je Seite, `laube: "keine"` unterdrückt den Balkon,
`stufe` erzwingt eine Verfallsstufe (`terrain.ts`, `baueGebaeude`).

## Zuordnung der Fotos (A-20)

Die Karte in jeder Zeile markiert den Gebäudepunkt. Fotos nach der Fotokennung benennen:
`oental-osm-513-traufe.jpg`, `oental-osm-513-giebel.jpg`, `oental-osm-513-schraeg.jpg`.
Bei mehreren Aufnahmen eine laufende Nummer ergänzen. Die OSM-Indizes beziehen sich auf den
aktuellen Weltstand; im fertigen Steckbrief bleibt die geografische Koordinate die Zuordnung.
Unsichtbare Rückseiten und verdeckte Fenster nicht schätzen, sondern als fehlenden Befund angeben.
Die Kennung zusammen mit Datum und Fotos übergeben; daraus werden die belegten Steckbriefe erstellt.

## Liste (44 Gebäude)

| OSM-Index | Warum | Koordinate (lat, lon) | OSM-Art | LoD2  Karte / Fotokennung |
|---|---|---|---|------|
| 1820 | Almhütte | 47.74571, 12.06181 | hut | kein LoD2  [oental-osm-1820](https://www.openstreetmap.org/?mlat=47.74571&mlon=12.06181#map=19/47.74571/12.06181) |
| 513 | Der Bursche; Umfeld Der Bursche; Umfeld Der Förster; Umfeld Der Wirt | 47.72872, 12.09973 | yes | Sattel, Traufe 4.7 m, First 7.9 m  [oental-osm-513](https://www.openstreetmap.org/?mlat=47.72872&mlon=12.09973#map=19/47.72872/12.09973) |
| 698 | Der Wart vom Bruch; Umfeld Der Wart vom Bruch | 47.72812, 12.08363 | farm | Pult, Traufe 5.4 m, First 7.1 m  [oental-osm-698](https://www.openstreetmap.org/?mlat=47.72812&mlon=12.08363#map=19/47.72812/12.08363) |
| 507 | Die Alte am Zaun; Umfeld Die Alte am Zaun | 47.72938, 12.09928 | yes | Sattel, Traufe 3.8 m, First 6.7 m  [oental-osm-507](https://www.openstreetmap.org/?mlat=47.72938&mlon=12.09928#map=19/47.72938/12.09928) |
| 19 | Die Frau am Werkstor; Umfeld Die Frau am Werkstor | 47.72238, 12.09900 | yes | Sattel, Traufe 6.2 m, First 8.1 m  [oental-osm-19](https://www.openstreetmap.org/?mlat=47.72238&mlon=12.09900#map=19/47.72238/12.09900) |
| 445 | Die Magd vom Unterhof; Umfeld Die Magd vom Unterhof; Umfeld Die Schmiedin | 47.72885, 12.09867 | yes | Sattel, Traufe 5.8 m, First 7.5 m  [oental-osm-445](https://www.openstreetmap.org/?mlat=47.72885&mlon=12.09867#map=19/47.72885/12.09867) |
| 424 | Die Schmiedin; Umfeld Die Schmiedin; Umfeld Der Wirt | 47.72842, 12.09889 | yes | Sattel, Traufe 3.7 m, First 8.2 m  [oental-osm-424](https://www.openstreetmap.org/?mlat=47.72842&mlon=12.09889#map=19/47.72842/12.09889) |
| 693 | Heustadel am Grabenweg | 47.72886, 12.08295 | yes | Sattel, Traufe 6.1 m, First 7.6 m  [oental-osm-693](https://www.openstreetmap.org/?mlat=47.72886&mlon=12.08295#map=19/47.72886/12.08295) |
| 3 | Kirche/Kapelle | 47.73963, 12.09147 | church | sonst, Traufe 2.7 m, First 47.2 m  [oental-osm-3](https://www.openstreetmap.org/?mlat=47.73963&mlon=12.09147#map=19/47.73963/12.09147) |
| 4 | Kirche/Kapelle | 47.72530, 12.08556 | church | Sattel, Traufe 7.5 m, First 22.2 m  [oental-osm-4](https://www.openstreetmap.org/?mlat=47.72530&mlon=12.08556#map=19/47.72530/12.08556) |
| 102 | Kirche/Kapelle | 47.74903, 12.07771 | church | Sattel, Traufe 5.8 m, First 22.6 m  [oental-osm-102](https://www.openstreetmap.org/?mlat=47.74903&mlon=12.07771#map=19/47.74903/12.07771) |
| 312 | Kirche/Kapelle | 47.72804, 12.10041 | chapel | sonst, Traufe 1.6 m, First 3.5 m  [oental-osm-312](https://www.openstreetmap.org/?mlat=47.72804&mlon=12.10041#map=19/47.72804/12.10041) |
| 569 | Kirche/Kapelle | 47.73590, 12.10356 | church | Sattel, Traufe 4.0 m, First 16.1 m  [oental-osm-569](https://www.openstreetmap.org/?mlat=47.73590&mlon=12.10356#map=19/47.73590/12.10356) |
| 581 | Kirche/Kapelle | 47.73428, 12.10348 | church | Sattel, Traufe 3.9 m, First 32.1 m  [oental-osm-581](https://www.openstreetmap.org/?mlat=47.73428&mlon=12.10348#map=19/47.73428/12.10348) |
| 657 | Kirche/Kapelle | 47.73577, 12.10795 | church | sonst, Traufe 4.9 m, First 34.2 m  [oental-osm-657](https://www.openstreetmap.org/?mlat=47.73577&mlon=12.10795#map=19/47.73577/12.10795) |
| 1812 | Kirche/Kapelle | 47.72731, 12.10533 | chapel | Flach, Traufe 1.5 m, First 1.5 m  [oental-osm-1812](https://www.openstreetmap.org/?mlat=47.72731&mlon=12.10533#map=19/47.72731/12.10533) |
| 1818 | Kirche/Kapelle | 47.72699, 12.10551 | chapel | Walm, Traufe 4.7 m, First 8.0 m  [oental-osm-1818](https://www.openstreetmap.org/?mlat=47.72699&mlon=12.10551#map=19/47.72699/12.10551) |
| 714 | Tremmel, Hofbesitzerin; Umfeld Tremmel, Hofbesitzerin | 47.72915, 12.07892 | farm | Sattel, Traufe 5.4 m, First 6.6 m  [oental-osm-714](https://www.openstreetmap.org/?mlat=47.72915&mlon=12.07892#map=19/47.72915/12.07892) |
| 430 | Umfeld Der Bursche; Umfeld Die Schmiedin; Umfeld Der Wirt | 47.72849, 12.09941 | yes | Sattel, Traufe 5.3 m, First 7.9 m  [oental-osm-430](https://www.openstreetmap.org/?mlat=47.72849&mlon=12.09941#map=19/47.72849/12.09941) |
| 436 | Umfeld Der Bursche; Umfeld Die Schmiedin; Umfeld Der Wirt | 47.72863, 12.09931 | yes | Sattel, Traufe 2.7 m, First 7.3 m  [oental-osm-436](https://www.openstreetmap.org/?mlat=47.72863&mlon=12.09931#map=19/47.72863/12.09931) |
| 440 | Umfeld Der Bursche; Umfeld Der Förster; Umfeld Die Magd vom Unterhof; Umfeld Die Schmiedin; Umfeld Der Wirt | 47.72870, 12.09926 | yes | Sattel, Traufe 4.7 m, First 7.5 m  [oental-osm-440](https://www.openstreetmap.org/?mlat=47.72870&mlon=12.09926#map=19/47.72870/12.09926) |
| 510 | Umfeld Der Bursche; Umfeld Der Förster | 47.72903, 12.10016 | yes | Sattel, Traufe 5.8 m, First 9.0 m  [oental-osm-510](https://www.openstreetmap.org/?mlat=47.72903&mlon=12.10016#map=19/47.72903/12.10016) |
| 511 | Umfeld Der Bursche; Der Förster; Umfeld Der Förster | 47.72891, 12.09961 | yes | Sattel, Traufe 7.0 m, First 9.4 m  [oental-osm-511](https://www.openstreetmap.org/?mlat=47.72891&mlon=12.09961#map=19/47.72891/12.09961) |
| 512 | Umfeld Der Bursche; Umfeld Der Förster | 47.72883, 12.10028 | yes | Sattel, Traufe 5.5 m, First 7.6 m  [oental-osm-512](https://www.openstreetmap.org/?mlat=47.72883&mlon=12.10028#map=19/47.72883/12.10028) |
| 515 | Umfeld Der Bursche; Umfeld Der Förster; Umfeld Der Wirt | 47.72857, 12.09985 | yes | Sattel, Traufe 4.6 m, First 7.2 m  [oental-osm-515](https://www.openstreetmap.org/?mlat=47.72857&mlon=12.09985#map=19/47.72857/12.09985) |
| 517 | Umfeld Der Bursche; Umfeld Der Wirt | 47.72837, 12.09994 | yes | Sattel, Traufe 6.2 m, First 7.6 m  [oental-osm-517](https://www.openstreetmap.org/?mlat=47.72837&mlon=12.09994#map=19/47.72837/12.09994) |
| 410 | Umfeld Der Förster; Umfeld Die Magd vom Unterhof | 47.72894, 12.09914 | yes | Sattel, Traufe 4.8 m, First 8.1 m  [oental-osm-410](https://www.openstreetmap.org/?mlat=47.72894&mlon=12.09914#map=19/47.72894/12.09914) |
| 508 | Umfeld Der Förster | 47.72921, 12.09994 | yes | Sattel, Traufe 6.5 m, First 9.1 m  [oental-osm-508](https://www.openstreetmap.org/?mlat=47.72921&mlon=12.09994#map=19/47.72921/12.09994) |
| 328 | Umfeld Der Wirt | 47.72804, 12.09969 | yes | Sattel, Traufe 3.4 m, First 5.6 m  [oental-osm-328](https://www.openstreetmap.org/?mlat=47.72804&mlon=12.09969#map=19/47.72804/12.09969) |
| 420 | Umfeld Der Wirt | 47.72825, 12.09949 | yes | Sattel, Traufe 3.0 m, First 9.8 m  [oental-osm-420](https://www.openstreetmap.org/?mlat=47.72825&mlon=12.09949#map=19/47.72825/12.09949) |
| 411 | Umfeld Die Alte am Zaun | 47.72957, 12.09897 | yes | kein LoD2  [oental-osm-411](https://www.openstreetmap.org/?mlat=47.72957&mlon=12.09897#map=19/47.72957/12.09897) |
| 413 | Umfeld Die Alte am Zaun; Umfeld Die Magd vom Unterhof | 47.72915, 12.09898 | yes | Sattel, Traufe 7.7 m, First 10.1 m  [oental-osm-413](https://www.openstreetmap.org/?mlat=47.72915&mlon=12.09898#map=19/47.72915/12.09898) |
| 506 | Umfeld Die Alte am Zaun | 47.72948, 12.09978 | yes | Sattel, Traufe 6.6 m, First 9.7 m  [oental-osm-506](https://www.openstreetmap.org/?mlat=47.72948&mlon=12.09978#map=19/47.72948/12.09978) |
| 509 | Umfeld Die Alte am Zaun; Umfeld Der Förster | 47.72915, 12.09950 | yes | Sattel, Traufe 4.0 m, First 7.8 m  [oental-osm-509](https://www.openstreetmap.org/?mlat=47.72915&mlon=12.09950#map=19/47.72915/12.09950) |
| 526 | Umfeld Die Alte am Zaun | 47.72977, 12.09906 | yes | Sattel, Traufe 4.8 m, First 8.2 m  [oental-osm-526](https://www.openstreetmap.org/?mlat=47.72977&mlon=12.09906#map=19/47.72977/12.09906) |
| 540 | Umfeld Die Alte am Zaun | 47.72963, 12.09897 | yes | Sattel, Traufe 4.5 m, First 8.0 m  [oental-osm-540](https://www.openstreetmap.org/?mlat=47.72963&mlon=12.09897#map=19/47.72963/12.09897) |
| 412 | Umfeld Die Magd vom Unterhof | 47.72864, 12.09835 | yes | Sattel, Traufe 7.2 m, First 9.7 m  [oental-osm-412](https://www.openstreetmap.org/?mlat=47.72864&mlon=12.09835#map=19/47.72864/12.09835) |
| 415 | Umfeld Die Magd vom Unterhof | 47.72919, 12.09858 | yes | Sattel, Traufe 6.0 m, First 8.3 m  [oental-osm-415](https://www.openstreetmap.org/?mlat=47.72919&mlon=12.09858#map=19/47.72919/12.09858) |
| 538 | Umfeld Die Magd vom Unterhof | 47.72930, 12.09857 | yes | Sattel, Traufe 5.8 m, First 8.1 m  [oental-osm-538](https://www.openstreetmap.org/?mlat=47.72930&mlon=12.09857#map=19/47.72930/12.09857) |
| 539 | Umfeld Die Magd vom Unterhof | 47.72924, 12.09857 | yes | Sattel, Traufe 5.8 m, First 8.0 m  [oental-osm-539](https://www.openstreetmap.org/?mlat=47.72924&mlon=12.09857#map=19/47.72924/12.09857) |
| 414 | Umfeld Die Schmiedin | 47.72853, 12.09843 | yes | Sattel, Traufe 7.2 m, First 9.7 m  [oental-osm-414](https://www.openstreetmap.org/?mlat=47.72853&mlon=12.09843#map=19/47.72853/12.09843) |
| 427 | Umfeld Die Schmiedin; Der Wirt; Umfeld Der Wirt | 47.72842, 12.09946 | yes | Sattel, Traufe 5.4 m, First 7.5 m  [oental-osm-427](https://www.openstreetmap.org/?mlat=47.72842&mlon=12.09946#map=19/47.72842/12.09946) |
| 435 | Umfeld Die Schmiedin | 47.72827, 12.09861 | yes | Sattel, Traufe 5.4 m, First 7.6 m  [oental-osm-435](https://www.openstreetmap.org/?mlat=47.72827&mlon=12.09861#map=19/47.72827/12.09861) |
| 1856 | Unterstand am Talweg | 47.73222, 12.08141 | yes | kein LoD2  [oental-osm-1856](https://www.openstreetmap.org/?mlat=47.73222&mlon=12.08141#map=19/47.73222/12.08141) |
