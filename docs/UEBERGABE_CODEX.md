---
last-reviewed: 2026-11-25
shelf-life-days: 30
---
# Übergabe M1-Sitzung → Codex (25.11.2026)

> Flo, 25.11.2026: „Committe alles, so dass Codex weitermachen kann.“ Diese Datei ist der Einstieg für die nächste
> Sitzung. Offen/erledigt steht im Ledger (`_INDEX.md`), nicht hier. Wenn alles übernommen ist: Datei löschen und im
> Index austragen.

## 1. Wo wir stehen

| Thema | Stand | Wo |
|---|---|---|
| **Fokus** | Flo: Tiere und Menschen **geparkt**, „die Welt endlich finalisieren“ (D474). Reihenfolge: Felsmulde fertig, dann Ort für Ort nach derselben Methode | Ledger D474, A-19 |
| **Methode** | Zielbild-Szene selbst ins Spiel backen statt nachbauen; Abnahme je Ort = Messbild Spiel │ Zielbild + 10 s Video, 60 B/s am M1 | **`VERFAHREN_ORT.md`** (Hauptdokument, Akte je Ort) + **`WELT_METHODE.md`** (Backkette `../tools/ortkette.sh`, Fallen) |
| **Felsmulde** | Läuft hinter `?lookfels=1&stimmung=zielbildfels` mit Mauern, Felsen, Teich, Boden, Pflanzen, Efeu, Schattenhülle und Kartenkronen; 58 B/s im Retina-Fenster 1440×900; Helligkeit wie Zielbild. Scan-Bäume des Zielbilds in Arbeit hinter `?scanbaeume=1` (Laub zerfällt noch) | D445, D450, D464, D474, D475, D478 |
| **Waffen** | Zielbild Runde 2 (eigene Geometrie, Stahl mit Zunder, Herkunft je Waffe als Vorschlag); Holz noch flach | D472, D477, `../tools/waffenframe.py` |
| **Tiere** | geparkt nach Runde 9; Grenze der Methode erreicht; Vorlagen-Liste und Bild-zu-3D-Wege geprüft | D470, D463, D473, A-56 |
| **Menschen** | geparkt; Zähler aus Einar (Blender Studio, CC-BY) als echtes Altersgesicht; Scans für Brachgänger/Schmiedin brauchen Flos Download | D467, D468, D469, D471, A-58 |
| **Bewegung** | Cloud-Sitzung D455–D461: Clips der Spielfigur gerechnet (Waffen, Gang, Laufschritt, Sprint, Rolle, Sprung), Laufzeit mit Inertialisierung und Fuss-IK, Tiere und Gegner an der Laufzeit, alles hinter `figurfein` (`?figurfein=0` = alt). Nichts davon in Bewegung gesehen; nicht der Fokus, aber am M1 einmal ansehen | `UEBERGABE.md` Abschnitt 0 Punkt 6 (Prüfliste), A-54, A-55, `design/BRACHLAND_Waffenbewegungen_v1.md` §8–§10 |
| **Befallgrade** | entschieden: stufenloser Regler mit vier lesbaren Graden, Narben nach dem Reinigen | A-57 |

## 2. Was **nicht** im Repo liegt (wichtig für eine Sitzung ohne den M1)

- `public/bauten-ziel/*.glb` (Felsmulde, rund 60 MB) — per `.gitignore` ausgenommen, Entscheidung offen (A-46).
  Ohne diese Dateien lädt `?lookfels=1` nichts Neues.
- `.cache/blender/felsmulde/szene4.blend` (361 MB, Zielbild-Szene Runde 4) — Quelle für `tools/ortkette.sh`.
- `.cache/bilder/…` (alle Bildpaare), `.cache/referenz/…` (Fotos, Kandidatenlisten, geladene CC-BY-Modelle wie Einar).

Eine Sitzung ohne diese Dateien kann Code, Werkzeuge, Ledger und Dokumente bearbeiten, aber die Felsmulde weder
ansehen noch neu backen. Für Look-Arbeit: am M1 arbeiten oder Flo die Dateien bereitstellen lassen.

## 3. Nächste Schritte (Reihenfolge)

1. **Felsmulde abschliessen** (Ledger D475 „Offen“, A-46):
   - Scan-Bäume (D478) fertig machen: Krone als Büschel-Karten backen statt aus der Geometrie ableiten (vier Läufe
     und ihre Fehler stehen in D478); erst wenn sie besser aussehen als die Kartenkronen, `?scanbaeume=1` zur Vorgabe.
   - Himmel im Bogen: warmer Dunst mit Bergstaffel statt hell und blau; Fernberg rechts als graue Fläche.
   - Lichter wärmer (R−B Lichter −0,01 statt +0,13), Boden grüner.
   - 10 s Video (`tools/mess/messbild.mjs` ohne `MESS_NUR_STAND`) und Bildpaar an Flo → Freigabe.
2. **Werkzeuge verallgemeinern** (Voraussetzung für den zweiten Ort; deckt sich mit A-53 der Cloud, Lücken L1–L4, und `WELT_METHODE.md` „Was je Ort anzupassen ist“):
   Bodenmitte/Radius, Objektnamen-Muster, Budgets als Parameter; Schalter `?ziel=<ort>` statt `?lookfels=1`;
   Rahmenkronen ortsunabhängig oder weg (die Scan-Bäume ersetzen sie).
3. **Zweiter Ort:** Flo entscheidet, welcher (Stauwehr, Hof/Milbinger Straße, Siedlung) und ob es dafür ein
   freigegebenes Zielbild als Szene gibt. Ohne Zielbild-Szene zuerst das Zielbild (Blender) — Flos Freigabe.
4. **Waffen:** Formliste aus D472/D477 in `tools/waffenmodelle.py` übernehmen (Spielmodelle; Länge, Griffpunkte,
   Masse bleiben); im Zielbild Holz aus Poly-Haven-Scans statt prozedural.
5. Geparkt, nur auf Flos Wort: Tiere (Vorlagen A-56 laden oder Bild-zu-3D D473), Menschen (Scans A-58, Einar-Weg).

## 4. Regeln, die in dieser Sitzung teuer gelernt wurden

- **Ledger-Nummern:** Cloud-Chat und M1 haben mehrfach dieselben Nummern vergeben. Vor jeder Nummer `git fetch` und
  `git show origin/claude/epic-planck-86z6fy:docs/_INDEX.md` prüfen (`make ledger-ids` nennt die nächste freie Nummer);
  die später gemergte Seite nummeriert um, nur in Zeilen, die es auf der anderen Seite nicht gibt (Skript-Muster:
  `.cache/merge-d441/umnummern.py`, liegt nur am M1). `scripts/check_ledger_ids.py` in `make check` fängt Dubletten.
- **8 GB Speicher:** nie zwei Blender gleichzeitig (Sperre `.cache/blender.sperre`), keine Bildratenmessung während
  eines Renders; Exit 137 heisst Speicher.
- **Messen statt raten:** Bildrate je Posten mit `tools/mess/bildrate.mjs` zerlegen (`&aus=…`); Bildfarben je Feld gegen
  das Zielbild, eine Änderung je Durchgang.
- **Keine Logins**, keine Käufe; Sketchfab/BlendSwap/Fab/Epic-Downloads macht Flo. Lizenzen vor Download auf der Seite
  prüfen (ADR-0013, ADR-0021).
- **Physik muss stimmen** (D398), Deutsch als Code-Sprache, Bildpaar zu jeder sichtbaren Änderung.
