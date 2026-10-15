---
last-reviewed: 2026-10-15
shelf-life-days: 60
---
# Asset-Kandidaten — Gratis-Modelle von Sketchfab (ADR-0013)

> Sichtung vom 15.10.2026 über die öffentliche Sketchfab Data API v3 (Suche, ohne Login). **Nichts
> davon ist heruntergeladen oder im Spiel.** Status und Entscheidung leben im Ledger (`_INDEX.md`,
> D226, A-13). Lizenzen ändern sich: vor jeder Übernahme erneut prüfen (ADR-0013, Punkt 4).

## Was zum Herunterladen fehlt

- Ein kostenloser **Sketchfab-Account** und dessen **API-Token** (Settings → Password & API).
- Abruf: `GET https://api.sketchfab.com/v3/models/{uid}/download` mit `Authorization: Token <token>`;
  die Antwort enthält kurzlebige, signierte URLs (glTF/GLB) — sofort ziehen.
- Den Token **nie** committen; als Umgebungsvariable der Cloud-Umgebung oder lokal setzen.

## Was beim Einbau gilt

- CC-BY 4.0: Titel, Autor, Link, Lizenz und „verändert“ (Decimation, Texturgrösse zählen) in
  `assets/HERKUNFT.md` und im Spiel (`public/herkunft.json`, Menü „Herkunft“).
- Texturen der Kandidaten sind oft 4K/8K (20–50 MB Archiv): auf 1K–2K verkleinern, sonst sprengt es
  das Precache-Budget (60 MB, `npm run quality`).
- Mixamo-Animationen in fremden Modellen sind nicht CC — neu über eigenen Account holen.
- Ausgeschlossen: Ableitungen aus Megascans, Adobe Fuse/Mixamo-Retextures, fremde Spielfiguren,
  „Standard“/„Editorial“, alles mit NC/ND.

## Kandidaten (Lizenz laut API am 15.10.2026; ✔ = Einzelabruf `GET /v3/models/<uid>` geprüft)

### Farne und Unterholz

| Modell | Autor | Lizenz | Flächen | uid | Einschätzung |
|---|---|---|---|---|---|
| Fern bracken | Tomhaj | CC-BY ✔ | 12.734 | fde431886a1940bfa855a6042498a8fc | Adlerfarn, Photogrammetrie, Low-Poly-FBX dabei — erste Wahl |
| Common polypody fern (43/55) | PlantCatalog | CC-BY ✔ | 1.248 | 891b474098c54e8db9d5fb07b372e2c9 | Mit LODs, Biom Wald/Feucht; prozedural, kein Scan |
| Moss clump | ZiemniaQ | CC-BY | 26.606 | 1a39ea43153a4bd3a92beaadfba4d089 | Photogrammetrie, braucht Decimation |
| Western Bracken Fern | ffish.asia / floraZia | CC0 | 314.980 | b2b5ca12ed004ca18507d0de066208b5 | Einziger CC0-Farn, viel zu schwer |

### Gras, Schilf, Feuchtgebiet

| Modell | Autor | Lizenz | Flächen | uid | Einschätzung |
|---|---|---|---|---|---|
| Reed Plants Pack | Nicholas-3D | CC-BY | 1.619 | bc77ea5218e44f2dbc23b2a4aef0c898 | 4 Schilfvarianten, Texturen 49 MB → verkleinern |
| Realistic Grass Pack For Games | Nicholas-3D | CC-BY | 794 | 9b958d613e9a44dbba580748e7a1789c | 3 Grastypen, klein |
| Cattail Plant | SXuno | CC-BY | 1.314 | c50630051edd4a7daa9708f6b31c021f | Rohrkolben, Look UNKLAR |
| Common Reed (Phragmites) | ffish.asia / floraZia | CC0 | 163.464 | 91f546fb238149ff9e99a8594a3a2b58 | Echter Scan, starke Reduktion nötig |

### Büsche

| Modell | Autor | Lizenz | Flächen | uid | Einschätzung |
|---|---|---|---|---|---|
| Bush models pack (LODs) | LOLIPOP | CC-BY ✔ | 23.301 gesamt | f2d9ffd3e6a94cf0b9464ccd66a4c2f8 | 15 Varianten mit LODs und 1K-Texturen — erste Wahl |
| Rosemary willow (99/99) | PlantCatalog | CC-BY | 5.807 | 3aaf9f4cf41e45098f2e7003a1b6165f | Weidenstrauch, Biom Feuchtgebiet |

### Totholz, Stümpfe

| Modell | Autor | Lizenz | Flächen | uid | Einschätzung |
|---|---|---|---|---|---|
| Mossy old tree log | Julian Malik | CC-BY | 20.390 | c65a00ca4a174653beb4c59cb42b9143 | Scan mit Retopo, spielfertig — erste Wahl |
| Scanned Stump Collection | That's Cool Jack | CC-BY | 3.802 gesamt | 56d6e23ecef141ba9e48b0d4a8dd3eea | Mehrere Stümpfe à ~1k Flächen |
| Boubín Stump | 3dhdscan | CC-BY ✔ | 23.581 | b968b5dc462148989cb87b072885da85 | Hohe Scanqualität, 49 MB Texturen |

### Menschen mit Rig

| Modell | Autor | Lizenz | Flächen | uid | Einschätzung |
|---|---|---|---|---|---|
| Nathan Animated 003 | Renderpeople | CC-BY ✔ | 21.506 | 143a2b1ea5eb4385ae90a73657aca3bc | Scan in Spitzenqualität, aber moderne Kleidung — Technikprobe für Skelett/Clips |
| Bandit Armor and Clothes | wolkoed | CC-BY | 28.356 | d6cf54210a564ff5ab2c288bac7cd66f | Kostüm passt am besten; handmodelliert, Mixamo-Rig wahrscheinlich (UNKLAR) |

**Befund Menschen:** Eine realistische, geriggte Figur in mittelalterlicher Kleidung mit sauberer
Herkunft gibt es auf Sketchfab gratis nicht. Realistischster Weg: Scan-Körper (Renderpeople) plus
eigene Kleidung; Ob sich das lohnt, ist offen (A-13).
