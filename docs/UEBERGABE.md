---
last-reviewed: 2026-11-22
shelf-life-days: 30
---
# Übergabe Cloud → M1 (22.11.2026)

> Flo, 22.11.2026: Ab jetzt arbeitet **eine** Sitzung, lokal auf dem M1 (CLAUDE.md: „Arbeit läuft im Repo, nie in
> einer Sandbox“). Die Cloud-Sitzung, die D349–D376 gebaut hat, schliesst ihre laufenden Aufträge ab, pusht auf
> `claude/epic-planck-86z6fy` (PR #16) und ruht dann. Diese Datei ist der Einstieg; offen/erledigt steht im Ledger
> (`_INDEX.md`), nicht hier. Wenn alles unten übernommen ist: Datei löschen und im Index austragen.

## 1. Wo wir stehen

| Thema | Stand | Wo |
|---|---|---|
| **Stil** | Entschieden: gemalter Realismus — Substanz real, Darstellung gemalt, kein Mikrorauschen | `adr/0018-gemalter-realismus.md`, D370 |
| **Messlatte** (Flo) | Landschaft mind. Soulframe / Phantom Blade Zero / Dawnwalker; Story und Erlebnis wie Elden Ring; Kampf Soulframe-Basis + Richtungsblock | D374, `referenz/REFERENZ_SPIELE.md` (10 Regeln) |
| **Zielbild Felsmulde** | A-Frame D371 fertig, von Flo als „noch nicht natürlich genug“ bewertet; Runde 2 (rau, verwittert, Vegetation, Himmel) = D372 | `bilder/zielbild/`, `../tools/stilframes.py` |
| **Zielbild Haus** | verlassener Einfirsthof = D373 | `../tools/hausframe.py` (kommt mit D373) |
| **Story** | Bibel v2: Marke heilt statt tötet, offene Welt mit zwei Wegen, Enklave auf der Hangterrasse, Flutlinie 499 m, drei Enden | `design/BRACHLAND_Story-Bibel_v2.md`, D374 |
| **Orte und Texte** | neu gesetzt und umgeschrieben = D375 | `design/BRACHLAND_Enklave_Lage_v2.md` (kommt mit D375) |
| **Reinigen im Kampf** | Entwurf, Regelkern hinter Schalter, Simulation = D376 | `design/BRACHLAND_Reinigen_v1.md` (kommt mit D376) |
| **Welt im Spiel** | D363–D368: Hof-Baukasten (`?hofbau=1`), Efeu-Karten, Streudecke, Bodenpflanzen, Bäume mit Wurzeln/Rinde, Fern-Impostoren, Wand-Parallax (`?pom=0`), Himmel-Prototyp (`?himmel=physik`) | Ledger Tabelle B |

D372, D373, D375, D376 sind zum Zeitpunkt dieser Datei in Arbeit; ob sie gemergt sind, zeigt `git log` und das Ledger.
**Stand 22.11.2026 abends:** D372, D373, D375, D376 sind gemergt; dazu D378 (Zielbild Haus freigegeben, Enklave heisst Brannburg), D379 (Reinigen bestätigt), D380 (Zugang zum Flussvater). Neue Nummern normal über `make ledger-ids` (nächste frei: D381).

## 2. Was auf dem M1 als Erstes zu tun ist (Reihenfolge)

1. **Ansehen, in Bewegung** (`npm run build && npm run preview`, `?echt=1`): Alles aus D353–D368 wurde nur ohne GPU
   (SwiftShader, Standbilder) geprüft — „Nicht am M1 gesehen“ steht an jeder Zeile. Befunde je D-Nummer ins Ledger.
   Besonders: Efeu-Karten und Schatten, Streudecke unter Kronen (wirkt sie wie ein harter Teppich?), Bodenpflanzen
   (liest man sie neben dem Grasteppich?), Rinde/Wurzeln, Impostor-Übergang (Flimmern?), Parallax am Sockel.
2. **Putzkorn: behoben (D387), am M1 gegenprüfen.** Ursache war keine ungefilterte Schicht, sondern zwei Rechenfehler im
   Hausmaterial (Wandnormale aus Ableitungen der 32-Bit-Weltlage; Flächenart ungerundet verglichen). Die Wände zeigen Scan,
   Flecken und Efeu jetzt an der richtigen Stelle — das ist ein neues Bild, in Bewegung ansehen. Offen: Blattkrisseln des
   flachen Wandefeus in 5–15 m, `substratKorn` 31/m (ADR-0018 Punkt 3?). Details Ledger D387.
3. **Zielbilder mit GPU neu rendern** (Metal; in der Cloud nur CPU, 1280×720): `tools/stilframes.py` Modus `aframe`,
   danach D372/D373. Scans von Poly Haven (CC0) neu laden — Liste im Ledger D371/D372/D373, Ablage `.cache/cc0/`.
   Flo entscheidet am Bild, ob das Zielbild gilt.
4. **Zielbild in die Engine** — erst wenn Flo eines freigegeben hat (ADR-0006: die Engine folgt dem Render).
   Reihenfolge der Hebel nach `referenz/REFERENZ_SPIELE.md`: (a) Tonwert und Licht (mittlere Helligkeit 0,25–0,35,
   Sonne tief und schräg von hinten, warmer Schleier), (b) Luft in vier Tiefenebenen, Bodennebel in Himmelsfarbe,
   (c) Nachbearbeitung: tiefengewichtete Glättung, Bloom nur auf Lichtern, Kantenglättung, (d) Kronendichte
   (Befund D364/D371: Spielkronen zu licht; geschlossen ab ~2,4 Karten/m² Buche, 3/m² Fichte), (e) Scan-Stein und
   Laubboden an **einer** Stelle (Felsmulde oder Hof 708) auf Endqualität, bevor es in die Breite geht.
5. **Story umsetzen** nach D375/D376, sobald gemergt (Flutdarstellung, Bewohner an neuen Plätzen prüfen, Reinigen als
   Handlung mit Animation).

## 3. Offene Entscheidungen bei Flo

| Was | Wo |
|---|---|
| Zielbild freigeben (Felsmulde D372, Haus D373) — Kamera, Himmel, Vegetationsdichte | Ledger D371–D373 |
| Grasbüschel vor den Höfen sind mit D366 weggefallen — so lassen? Grasteppich unter Kronen zurücknehmen? | D366 |
| Name der Enklave, Spielstart an der Enklave, Belohnung Reinigen gegen Töten | A-24 |
| ADR-0017 (Verfall erzählt Zeit, Flut, Bewohnung) bestätigen | A-21 |
| Engine-Frage: Wenn das Zielbild im Browser am M1 nicht erreichbar ist, ist Unreal die ehrliche Alternative | ADR-0018 Kontext, D369 |

## 4. Was nicht im Repo liegt (nur in der Cloud-Sitzung, `.cache/` ist gitignored)

| Was | Ersatz auf dem M1 |
|---|---|
| Vorher/Nachher-Bilder `.cache/bilder/D353…D373/` | die wichtigsten Zielbilder liegen unter `bilder/zielbild/`; der Rest ist reproduzierbar (Kamera steht je Ledger-Zeile) |
| Commons-Referenzfotos (31) | `referenz/fotos-quellen.json` (URL, Lizenz, Urheber je Bild) neu laden; Befunde in `referenz/REFERENZ_FOTOS.md` |
| Spiel-Screenshots (43, urheberrechtlich geschützt, nur lokal!) | `referenz/spiele-quellen.json` neu laden nach `.cache/referenz/spiele/`; **nie ins Repo**; Befunde in `referenz/REFERENZ_SPIELE.md` |
| Flos Stilreferenzen (3 Instagram-Screenshots) | liegen bei Flo; nur lokal nutzen (Rechte ungeklärt) |
| CC0-Scans (Poly Haven) `.cache/cc0/` | neu laden, Namen im Ledger D364 (Rinde), D365 (Höhenkarten), D371 ff. |
| Blender-Zwischenstände (`.blend`, EXR) | neu erzeugen |

## 5. Regeln, die in der Cloud Zeit gekostet haben

- **Look nie aus Standbildern oder SwiftShader beurteilen** (CLAUDE.md, ADR-0018 Punkt 5). Bildpaare bleiben Pflicht,
  sind ohne GPU aber nur Form- und Grössenvergleich.
- **Vorher-Builds prüfen:** `npx vite build` und den Bundle-Inhalt per grep bestätigen — ein stiller tsc-Fehler hat
  einmal alle „Vorher“-Bilder den neuen Stand zeigen lassen (D353).
- **Kein Google Street View, kein Fab/Megascans, kein Instagram-Login.** Nur freie Lizenzen (ADR-0013); Spiel-Bilder
  nur als lokale Analysevorlage, Handwerk ja, Motive nein (ADR-0004).
- **Eine Stelle fertig vor der Breite.** Die Wochen D353–D368 haben viele Features etwas besser gemacht und keine
  Stelle fertig — genau das hat zur Stilentscheidung geführt.
- `git add` mit expliziten Pfaden; Worktrees von Agenten liegen unter `.claude/worktrees/` (gitignored), das
  Drift-Gate sieht halbfertige Agenten-Dateien dort trotzdem.
