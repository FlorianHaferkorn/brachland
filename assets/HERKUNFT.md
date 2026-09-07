---
last-reviewed: 2026-09-07
owns: []
---

# Herkunft der Fremdmodelle

Jede Datei unter `public/creatures` steht hier mit Autor und Lizenz. Das ist
keine Höflichkeit: **CC-BY verlangt die Namensnennung**, und ohne diese Tabelle
wäre die Bedingung nicht erfüllt. `tools/quality.ts` prüft deshalb, dass jede
Modelldatei einen Eintrag hat und jeder Eintrag eine Datei — ein Modell ohne
Zeile ist ein **Blocker**, keine Warnung.

## Warum überhaupt CC-BY

ADR-0002 sagt CC0. Am 31.08.2026 hat Flo die Abweichung für Kreaturmodelle
freigegeben: Die Alpennischen des Rosters — Steinbock, Gams, Wildschwein,
Murmeltier, Schneehase, Baummarder, Feuersalamander — kommen in CC0-Paketen
schlicht nicht vor (G-123, G-124). Die Alternative wäre ein Generator gewesen,
und der ist auf beiden Rechnern nicht lauffähig (G-119).

**Für Props bleibt es bei CC0.** Die Ausnahme gilt nur für `public/creatures`.

## Modelle

| Datei | Rolle | Autor | Lizenz | Quelle |
|---|---|---|---|---|
| `spuerfuchs.glb` | Spürfuchs | Quaternius | CC0 | poly.pizza, Animated Animal Pack |
| `k7-wolf.glb` | K7-Wolf | Quaternius | CC0 | poly.pizza, Animated Animal Pack |
| `grathorn.glb` | Grathorn | Quaternius | CC0 | poly.pizza, Animated Animal Pack (Stag) |
| `nebelgams.glb` | Nebelgams | Quaternius | CC0 | poly.pizza, Animated Animal Pack (Deer) |
| `wurzelkeiler.glb` | Wurzelkeiler | Poly by Google | **CC BY 3.0** | poly.pizza, „Boar" |
| `alpenmurmel.glb` | Alpenmurmel | Poly by Google | **CC BY 3.0** | poly.pizza `2IatILCJa3X`, „Gopher" (aufrecht, Wachposten-Haltung) |
| `firnhase.glb` | Firnhase | Poly by Google | **CC BY 3.0** | poly.pizza `biNOm96olTH`, „Jackrabbit" |
| `kiemenbiber.glb` | Kiemenbiber | Poly by Google | **CC BY 3.0** | poly.pizza `fwtA7VLrXPr`, „Beaver" |
| `linsenuhu.glb` | Linsenuhu | Poly by Google | **CC BY 3.0** | poly.pizza `fNkq9CwSG6d`, „Great horned owl" — der Ast unter dem Vogel ist bis auf ein Stück unter den Krallen abgeschnitten |
| `moderotter.glb` | Moderotter | Poly by Google | **CC BY 3.0** | poly.pizza `dJW3JeUWXQ-`, „River otter" |
| `myzelmolch.glb` | Myzelmolch | Poly by Google | **CC BY 3.0** | poly.pizza `eqjMAgmr-pM`, „Salamander" |
| `schneehuhn.glb` | Schneehuhn | Poly by Google | **CC BY 3.0** | poly.pizza `4A0kLzM65Mg`, „Quail" |
| `sporenhahn.glb` | Sporenhahn | Poly by Google | **CC BY 3.0** | poly.pizza `6NTegstc5Jy`, „Rooster" |
| `trafomarder.glb` | Trafomarder | Poly by Google | **CC BY 3.0** | poly.pizza `4I1SBFHWuSo`, „Ferret" |

Alle Dateien sind gegenüber dem Original verändert: Materialfarbe an den Vertex
gebacken (bei den Poly-by-Google-Modellen aus der Base-Color-Textur je Fläche
abgetastet, D124), Leuchtdichte in die Palette der Welt gezogen, Dreiecke auf `zielTris`
reduziert, auf Widerristhöhe genormt und um 180° gedreht (`tools/kreaturbau.py`).
Bei CC BY ist das ausdrücklich erlaubt und muss als Bearbeitung kenntlich sein —
diese Zeile ist die Kenntlichmachung.

Zwei Eingriffe gehen darüber hinaus und stehen deshalb einzeln hier. Aus allen
vier Quaternius-Dateien fällt eine mitgelieferte `Icosphere` heraus, die zu
nichts gehört. Und beim **Grathorn** fällt das Hirschgeweih weg — es ist im
Original ein eigenes Netz (`Stag_Horns`, 1.616 Flächen), und die Linie trägt laut
`content/creatures/grathorn.json` ein Chitinplatten-Gehörn. Das kommt als Anbau
aus `src/world/kreaturgestalt.ts` und ist BRACHLAND-eigen.

## Was im Spiel stehen muss

Für CC BY reicht die Nennung in einer mitgelieferten Datei; ein Impressum im
Menü ist die sauberere Form. **Offen**, solange das Verzeichnis im Menü keinen
Abschnitt „Herkunft" hat.

## Nicht übernommen

| Modell | Autor | Lizenz | Warum nicht |
|---|---|---|---|
| `ibex` | Syl | CC BY 3.0 | Beine stehen in einer eingefrorenen Sprungpose schräg nach hinten weg — die Hörner stimmen, der Rest ist unbrauchbar (28.08.2026 gerendert und verworfen) |
| `Rabbit` (`mKev485XTR`) | Quaternius | CC0 | Ein Cartoon-Hase in T-Pose mit Armen — eine Figur, kein Tier (07.09.2026 gerendert und verworfen; der CC-BY-Jackrabbit ist ein Hase) |
| `Pheasant` (`1wqLCnNFCgv`) | Poly by Google | CC BY 3.0 | Geladen als Alternative zur Wachtel, nicht gebraucht |
