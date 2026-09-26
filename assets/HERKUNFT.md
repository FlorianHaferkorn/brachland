---
last-reviewed: 2026-09-07
owns: []
---

# Herkunft der Fremdmodelle

Jede Datei unter `public/creatures` und `public/figuren` steht hier mit Autor und Lizenz. Das ist
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
| `kampf/k7-wolf.glb` | K7-Wolf mit Rig für den Kampf (D172) | Quaternius | CC0 | dasselbe Modell, gebunden an Skelett und Clips der Quelle (Animated Animal Pack, „Wolf“: Idle, Walk, Gallop, Attack, HitReact, Death) mit `tools/kampftierbau.py` |
| `kampf/grathorn.glb` | Grathorn mit Rig für den Kampf (D172) | Quaternius | CC0 | dasselbe Modell, Skelett und Clips der Quelle (Animated Animal Pack, „Stag“: Idle, Walk, Gallop, Attack_Headbutt, HitReact, Death) |
| `kampf/spuerfuchs.glb` | Spürfuchs mit Rig für den Kampf (D173) | Quaternius | CC0 | dasselbe Modell, Skelett und Clips der Quelle (Animated Animal Pack, „Fox“: Idle, Walk, Gallop, Attack, HitReact links/rechts, Death), `tools/kampftierbau.py` |
| `kampf/nebelgams.glb` | Nebelgams mit Rig für den Kampf (D173) | Quaternius | CC0 | dasselbe Modell, Skelett und Clips der Quelle (Animated Animal Pack, „Deer“: Idle, Walk, Gallop, Attack_Headbutt, HitReact links/rechts, Death) |
| `kampf/waffen.glb` | Schwert und Axt der Wanderin (D173) | Quaternius | CC0 | Medieval Weapons Pack („Sword“, „Axe“, OBJ), gedreht, skaliert und im Griff zentriert mit `tools/waffenbau.py` |
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

## Menschen (`public/figuren`, D143)

Spielerfigur und Bewohner kommen aus den Quaternius-Paketen **Ultimate Modular
Women** und **Ultimate Modular Men** — CC0 auf quaternius.com wie auf poly.pizza
(fünf Figuren des Women-Packs führt poly.pizza als CC BY 3.0, die bleiben draussen).
Seit D145 auch **Varianten aus Teilen**: Kopf, Rumpf, Beine, Füße verschiedener
Figuren an einer Armature — alle Figuren teilen die Knochen, aber nur innerhalb
derselben Ruhepose (Männer ohne „Adventurer“, Frauen) lassen sie sich mischen. Verarbeitet mit `tools/menschbau.py`: Schwert und
Icosphere weg, Finger-Knochen ans Handgelenk, vier Teile zu einem Netz, Farbe je
Materialrolle aus `PALETTE.figur` an den Vertex, planar dezimiert, Rig und drei
bis vier Animationen des Pakets behalten, `tools/menschpack.ts` packt Farbe und
Gewichte auf 8 Bit.

| Datei | Rolle | Autor | Lizenz | Quelle |
|---|---|---|---|---|
| `wanderin.glb` | Spielerfigur | Quaternius | CC0 | poly.pizza `y9KWOVG21R`, Ultimate Modular Women, „Hooded Adventurer" |
| `wanderin-waffen.glb` | Kampfclips der Spielerin (nur Knochen und Animation, `figuren/kampf/`) | Quaternius (Rig), Clips selbst gebaut | CC0 | Rig aus poly.pizza `y9KWOVG21R`; die neun Clips (Klinge/Axt: Haltung, Kette, schwer, Lauf) aus `tools/waffenclips.py`, abgetrennt mit `tools/waffenteilen.ts` (D171); seit D173 dazu sieben Clips aus der Universal Animation Library 2 (Quaternius, CC0: Sword_Regular_A/B/C, Sword_Dash, Sword_Block, Hit_Knockback, Idle_Shield_Break), übertragen mit `tools/ual2uebertrag.py` |
| `bauer.glb` | Bewohner (frei) | Quaternius | CC0 | poly.pizza `7pn3R6hPvE`, Ultimate Modular Men, „Farmer" |
| `arbeiter.glb` | Der Wart vom Bruch | Quaternius | CC0 | poly.pizza `Yg2bQZO6Hj`, Ultimate Modular Men, „Worker" |
| `wanderer.glb` | Bewohner (frei) | Quaternius | CC0 | poly.pizza `kZ3DmIoGip`, Ultimate Modular Men, „Casual Character" |
| `baeuerin.glb` | Tremmel, Hofbesitzerin | Quaternius | CC0 | poly.pizza `nIItLV9nxS`, Ultimate Modular Women, „Animated Woman" |
| `werkfrau.glb` | Die Frau am Werkstor | Quaternius | CC0 | poly.pizza `qJ2gsTUBHL`, Ultimate Modular Women, „Animated Woman" (zweite) |
| `foerster.glb` | Der Förster | Quaternius | CC0 | Teile aus poly.pizza `kZ3DmIoGip` (Rumpf, „Casual Character“), `7pn3R6hPvE` (Kopf, „Farmer“), `Yg2bQZO6Hj` (Beine, Füße, „Worker“), Ultimate Modular Men |
| `wirt.glb` | Der Wirt | Quaternius | CC0 | poly.pizza `JFrLIKqvCH`, Ultimate Modular Men, „Business Man“ |
| `bursche.glb` | Der Bursche | Quaternius | CC0 | Teile aus poly.pizza `gKLBoRsyKe` (Rumpf, Kopf, Füße, „Hoodie Character“) und `kZ3DmIoGip` (Beine, „Casual Character“), Ultimate Modular Men |
| `alte.glb` | Die Alte am Zaun | Quaternius | CC0 | Teile aus poly.pizza `nIItLV9nxS` (Rumpf, Beine, Füße, „Animated Woman“) und `qJ2gsTUBHL` (Kopf, zweite „Animated Woman“), Ultimate Modular Women |
| `magd.glb` | Die Magd vom Unterhof | Quaternius | CC0 | Teile aus poly.pizza `qJ2gsTUBHL` (Rumpf, Beine, Füße) und `ZwF0K7WBmu` (Kopf, „Adventurer“), Ultimate Modular Women |

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
