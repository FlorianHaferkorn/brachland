---
last-reviewed: 2026-11-22
shelf-life-days: 180
---
<!-- BRACHLAND — Waffenbewegungen aus freien Quellen (D428). Stand 22.11.2026. -->

# BRACHLAND — Waffenbewegungen aus freien Quellen v1 (D428)

> **D429 (22.11.2026):** Die Axt ist jetzt eine Zweihand-Fällaxt nach *An Ax to Grind* — Widersprüche 2, 3 und 5 (Axt)
> aus §5 sind behoben, Ausführung und Messwerte in §5.1.
>
> **Recherche und Probe, nichts verdrahtet.** Kein Clip in `public/figuren/held/held-clips.glb` geändert, keiner
> Waffe zugewiesen, kein Kampfwert berührt (D423: Bestandsclips erst nach der Messung). Offene Fragen an Flo:
> Ledger **A-43**. Prüfbilder unter `.cache/bilder/D428/` (Formprüfung in Blender Cycles, keine Look-Abnahme,
> Bewegung nur am M1 — ADR-0005). Grundsatz: Handwerk ja, Motive fremder Spiele nein (ADR-0004); Physik nach D398,
> Gewicht sichtbar nach D419.

**Kurzfassung.**
1. **UAL2 geladen** (itch.io, Fassung vom 16.06.2026, und OpenGameArt, Fassung vom 23.01.2026), Lizenz in beiden
   Archiven **CC0 1.0**. Die freie Fassung hat **43 Clips** (nicht ~90: „60–70 %“ meint die Pakete insgesamt). Davon
   tragen nur zehn eine Waffe — alle **einhändig**, alle Schwert, Wurf, Schild oder Hacke. Für Langes Messer
   (zweihändig), Fällaxt (zweihändig), Saufeder und Räucherkanne gibt die freie UAL2 **nichts** her. Neu gegenüber
   dem Stand von D173 ist nur `Sword_Heavy_Combo`.
2. **Weg zur Hauptfigur bestätigt:** Der D173-Clip `Klinge_U_A`, mit der neuen Datei über `weltformel.py`
   nachgebaut, trifft den ausgelieferten auf **0,1 cm** (Hände, Füsse, Kopf, alle 34 Bilder). Ruhelagen gleich
   (66 Knoten, `clipnachbau.mjs einfuegen`, nur in eine Kopie).
3. **Fechtbücher:** Lecküchner (Cgm 582, 1482) lehrt das Messer **einhändig** — „firstly, you should fence with one
   hand with the Messer and you should have the other one on the back“. Unser Langes Messer ist zweihändig gebaut
   (D406/D414). Das ist der grösste Widerspruch dieser Arbeit (§5, A-43).
4. **Fällaxt:** Kein Fechtbuch kennt sie (Talhoffers „axst“ ist die Mord-/Kampfaxt am langen Schaft). Die Vorlage
   ist das Forsthandwerk: USDA Forest Service, *An Ax to Grind* (1999, gemeinfrei als Werk der US-Regierung) — beide
   Hände, die linke **fest am Stielende**, die rechte gleitet. Unsere Axt-Clips halten es umgekehrt, `Axe_Overhead`
   ist einhändig und trifft mit dem Nacken voran.

---

## 1. UAL2: Herkunft und Lizenz

| Fassung | Quelle | Datei, Grösse, SHA-256 | Inhalt |
|---|---|---|---|
| itch.io „Standard“ (Name-your-own-price, 0 $) | https://quaternius.itch.io/universal-animation-library-2 | `Universal Animation Library 2[Standard].zip`, 18,7 MB, `4008ea20…2a68` | `UAL2_Standard.glb` (ohne Wurzelbewegung) und `UAL2_Standard_RM.glb` (mit), FBX, Mannequin F; Zeitstempel 16.06.2026 (v2.0) |
| OpenGameArt | https://opengameart.org/content/universal-animation-library-2 | `universal_animation_library_2standard.zip`, 10,3 MB, `ec0e40d6…9217` | Fassung 23.01.2026 (v1): ohne `Sword_Heavy_Combo`, vier Clips heissen `…_RM` |
| Website | https://quaternius.com/packs/universalanimationlibrary2.html | — | verweist auf beide; Lizenz „CC0“ |

`License.txt` in beiden Archiven: „CC0 1.0 Universal (CC0 1.0) Public Domain Dedication“. Abgelegt **nur lokal**
unter `.cache/ual2-d428/` (nicht im Repo, nicht an der Stelle `.cache/ual2/`, die `tools/ual2uebertrag.py` erwartet).
Die Seite nennt eine Fassung v2.2 (28.09.2026: Endbilder der `Sword_Light_*` korrigiert); das Archiv trägt
Zeitstempel vom 16.06.2026 — `Sword_Light_*` sind ohnehin nur in der Bezahlfassung. **Die Bezahlfassung „Source“
(14,99 $, ebenfalls CC0)** fällt unter ADR-0013 Nr. 2 („nicht erlaubt: alles, was Geld kostet“) und ist nicht geladen.

Die vollständige Liste der Source-Fassung (134 Namen) steht in der Animationsvorschau von Quaternius
(https://quaternius.com/animviewer.html; Namen aus deren Datenpaket gelesen, nicht angesehen). **Nur dort, nicht frei:**
`Sword_Heavy_A–D` (+ `_Rec`), `Sword_Light_A–D` (+ `_Rec`), `Sword_Light_Combo`, `Sword_Aerial_*`,
`Sword_GroundPound_RM`, `Sword_UpperCut_RM`, `Melee_Combo`, `Melee_Knee(_Rec)`, `Melee_Uppercut`, **`Mining`**
(Spitzhacke, vermutlich zweihändig — nicht angesehen), **`Bow_Aim_*`, `Bow_Notch`, `Bow_Shoot`, `Bow_RapidShoot`**
(für den Bogen nach ADR-0019), `Bandage`, `Fish_*`, `Farm_PickingTree`, `Farm_ScatteringSeeds`, Zombie-Gänge,
Parkour (`WallRun_*`, `Turn180_*`, `KipUp` …). Ob sich der Kauf lohnt, ist Frage A-43 (3).

## 2. Clipliste der freien Fassung (43 Clips, `UAL2_Standard.glb`, 24 Bilder/s)

Gemessen in Blender 5.3 am UAL2-Mannequin (Skript im Arbeitsordner, Werte wiederholbar mit `tools/ual2probe.py`):
**Hände** = Abstand rechte–linke Hand, kleinster–mittlerer Wert in cm (unter ~30 cm über den ganzen Clip hiesse:
beide an einer Waffe — kein Waffenclip erreicht das); **Becken** = wie tief es unter die Ausgangslage geht (cm);
**Schultern** = Drehung der Schulterlinie gegen Bild 0 (°, ±180 heisst: der Körper dreht sich ganz herum).
**Einsatz** = ob schon ausgeliefert (D173 `ual2uebertrag.py`, D176 `heldbau.py`).

| Clip | Bilder | s | Hände cm | Becken cm | Schultern ° | Art | Hand | Einsatz | Zuordnung zu unseren Familien |
|---|---|---|---|---|---|---|---|---|---|
| `Sword_Regular_A` | 11 | 0,42 | 45–71 | 30 | ±178 | Hieb, Kombo-Glied 1 | 1 | `Klinge_U_A` (+ `_Rec`) | Klinge, Hirschfänger (Bestand) |
| `Sword_Regular_A_Rec` | 24 | 0,96 | 43–70 | 0 | ±180 | Erholung | 1 | in `Klinge_U_A` | wie oben |
| `Sword_Regular_B` | 14 | 0,54 | 25–144 | 9 | −156…179 | Hieb, Kombo-Glied 2 | 1 | `Klinge_U_B` (+ `_Rec`) | Klinge, Hirschfänger |
| `Sword_Regular_B_Rec` | 26 | 1,04 | 67–124 | 1 | 0…31 | Erholung | 1 | in `Klinge_U_B` | wie oben |
| `Sword_Regular_C` | 49 | 2,00 | 67–91 | 0 | −171…138 | Hieb mit Sprung, Kombo-Glied 3 | 1 | `Klinge_U_C` | Klinge; **nicht** Messer (D414: Sprung, linke Hand weg) |
| `Sword_Regular_Combo` | 73 | 3,00 | 24–89 | 39 | ±178 | Kombo A+B+C am Stück | 1 | — | nichts Neues (= A, B, C) |
| `Sword_Heavy_Combo` | 105 | 4,33 | 27–91 | 38 | ±178 | Kombo, vier weite Hiebe mit Drehungen | 1 | — | **neu**; Klinge allenfalls, siehe §3 |
| `Sword_Dash` | 39 | 1,58 | 30–128 | 40 | −20…134 | Laufangriff | 1 | `Klinge_U_Lauf` | Klinge, Hirschfänger |
| `Sword_Block` | 31 | 1,25 | 64–97 | 23 | −6…44 | Block | 1 | `Klinge_U_Block`, Fingergriff | Klinge, Hirschfänger |
| `Hit_Knockback` | 21 | 0,83 | 66–81 | 57 | −2…3 | Treffer (Rückstoss) | — | `Kampf_Rueckstoss` | alle |
| `Idle_Shield_Break` | 27 | 1,08 | 70–93 | 5 | 0…65 | Treffer (Taumeln) | — | `Kampf_Taumeln` | alle |
| `Idle_Shield_Loop` | 61 | 2,50 | 67–69 | 1 | 0 | Stand mit Schild | 1 + Schild | — | keine (kein Schild im Spiel) |
| `Shield_OneShot` | 21 | 0,83 | 67–75 | 4 | −30…0 | Schildstoss | Schild | — | keine |
| `Shield_Dash` | 27 | 1,08 | 67–101 | 0 | 0…95 | Anlauf mit Schild | Schild | — | keine |
| `Melee_Hook` | 12 | 0,46 | 40–110 | 30 | −83…51 | Faustschlag (Haken) | leer | — | keine Waffe; allenfalls Ringen (Lecküchner) |
| `Melee_Hook_Rec` | 15 | 0,58 | 40–66 | 0 | −50…0 | Erholung | leer | — | wie oben |
| `OverhandThrow` | 33 | 1,33 | 67–112 | 25 | −58…69 | Wurf über die Schulter mit Ausfallschritt | 1 | — | Axt „wirft“ (`waffenfamilien.json`), siehe §3 |
| `TreeChopping_Loop` | 24 | 0,96 | 92–114 | 2 | 0…79 | Hacken (Schleife) | **1** | Fingergriff links (D188) | Beil, **nicht** Fällaxt, siehe §3 |
| `Farm_Harvest` | 61 | 2,50 | 62–67 | 16 | 0…18 | Ernten (Sichel?) | 1 | — | keine |
| `Zombie_Scratch` | 44 | 1,79 | 74–88 | 17 | −45…58 | Kratzen | leer | — | allenfalls Befallene |
| `Idle_FoldArms_Loop` | 61 | 2,50 | 15–16 | 1 | 0 | Stand | — | `Idle_Ruhig` | Bewohner |
| `Yes` | 61 | 2,50 | 64–94 | 1 | 0 | Nicken | — | `Gruss` | Bewohner |
| `A_TPose`, `Chest_Open`, `ClimbUp_1m`, `Consume`, `Farm_PlantSeed`, `Farm_Watering`, `Idle_Lantern_Loop`, `Idle_No_Loop`, `Idle_Rail_Call`, `Idle_Rail_Loop`, `Idle_TalkingPhone_Loop`, `LayToIdle`, `NinjaJump_Idle_Loop`, `NinjaJump_Land`, `NinjaJump_Start`, `Slide_Start`, `Slide_Loop`, `Slide_Exit`, `Walk_Carry_Loop`, `Zombie_Idle_Loop`, `Zombie_Walk_Fwd_Loop` | — | — | — | — | — | Alltag, Bewegung, Befallene | — | — | keine Waffe |

**Kein Clip:** Rolle, Tod, Stich mit Speer, zweihändiger Hieb, Axt am Stiel mit beiden Händen. **Familien ohne
Kandidaten:** Langes Messer, Fällaxt (Hieb), Saufeder, Räucherkanne. Hirschfänger hat die Klingenclips (D414).

## 3. Probe auf der Hauptfigur (drei Clips, nicht eingefügt)

Weg D414/D176: `node tools/clipnachbau.mjs figur …` → `tools/ual2probe.py` (neu, Weltformel aus `weltformel.py`,
Finger aus der Quelle) → Messung → `clipnachbau.mjs einfuegen` **in eine Kopie** von `held-clips.glb` (Ruhelagen:
66 Knoten gleich; 785 → 899 KB — das Budget von 800 KB hielte das nicht) → `kontaktbogen.py`/`.mjs` mit den
Modellen aus `waffen.glb`. Messwerte am Ziel (Lage der Waffe wie im Spiel, `WAFFE_AN_HELD_HAND`):

| Clip | Waffe | s | Scheitel/Durchzug (Bild) | Spitze m/s | Nachschwung m | Schneide ↔ Schlag | linke Hand neben Griff cm | Becken tiefer cm | Schultern ° | Gewicht hinten→vorn | Fuss nah am Boden m/s |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `Probe_Schwer` (`Sword_Heavy_Combo`) | Klinge | 4,33 | Hiebe bei 13, 29, 46, 64 | 45,6 | 0,92 | 21° | 57 | 38 | ±179 | −0,31…1,16 | 17,0 |
| `Probe_Hacken` (`TreeChopping_Loop`) | Axt | 0,96 | 5/5 | 28,2 | 0 | 9° | 70 | 2 | −16…62 | 0,51…0,66 | 0,25 |
| `Probe_Wurf` (`OverhandThrow`) | Axt | 1,33 | 10/11 | 17,6 | 0,30 | 59° | 75 | 25 | −49…75 | 0,44…0,94 | 2,9 |

Lesart: **Scheitel** = schnellstes Bild der Spitze, **Durchzug** = letztes Bild danach mit ≥ 50 % davon,
**Nachschwung** = Weg der Spitze danach bis unter 20 %. **Gewicht**: Becken auf der Linie hinterer → vorderer Fuss
(0 = über dem hinteren, 1 = über dem vorderen; ausserhalb = Ausfall oder Sprung). **Fuss nah am Boden**: grösste
waagrechte Geschwindigkeit eines Fusses, solange er unter 5 cm über dem Boden ist (Gleiten **oder** flacher Schritt —
die Messung trennt das nicht). Spitzengeschwindigkeiten sind Werte des Clips; reale Vergleichswerte sind in dieser
Recherche **nicht belegt**.

Bewertung gegen D398/D419 und die Trefferfenster:

- **`Sword_Heavy_Combo`** — Bilder `.cache/bilder/D428/probe_schwer_kontakt.png`. Vier Hiebe mit klaren Spitzen
  (Scheitel/Durchzug auf 12/14, 28/30, 45/47, 63/65 legbar). Aber: Ausfälle bis 38 cm tief, der Körper dreht sich
  zweimal ganz herum, die Füsse gleiten nah am Boden bis 17 m/s, das Gewicht liegt zeitweise vor dem vorderen Fuss.
  Das ist Schauwert, kein Gewicht — ein 1,2-kg-Schwert reisst niemanden so herum. **Nicht empfohlen** (D419); höchstens
  der vierte Hieb (Bild 61–105, mit langem Halten danach) als Vorlage für einen schweren Klingenhieb — nach D423.
- **`TreeChopping_Loop`** — `.cache/bilder/D428/probe_axt_kontakt.png`. **Einhändig** (linke Hand 57–105 cm weg),
  Becken fast still (−2 cm), Gewicht verlagert sich kaum (0,51 → 0,66): ein Beil aus dem Arm. Die Schneide führt
  (9°). Mit der Fällaxt (2,1 kg, 1 m) physikalisch falsch (D421/D426: zweihändig). Nebenbei: D188 nahm den
  linken Fingergriff „Axt mit beiden Händen“ aus diesem Clip — die linke Hand hält dort **nichts**; der Griff stimmt
  trotzdem als Faust, die Begründung im Kommentar von `tools/heldbau.py` nicht.
- **`OverhandThrow`** — Wurf mit Ausfallschritt, Becken −25 cm, Gewicht wandert von 0,44 auf 0,94 nach vorn, Rumpf
  dreht 124°: der einzige freie Clip mit Gewicht im ganzen Körper. **Kandidat für „Axt wirft“** — aber nur mit einem
  Wurfbeil (real um 0,6–1 kg, *nicht belegt*), nicht mit der 2,1-kg-Fällaxt; die Schneide steht im Scheitel 59° zur
  Wurfrichtung (beim Wurf dreht sich die Waffe ohnehin). Im Bild 10–12 ist die Waffe hinter dem Körper.
- Nicht geprobt, weil schon ausgeliefert: `Sword_Regular_A/B/C`, `Sword_Dash`, `Sword_Block`, `Hit_Knockback`,
  `Idle_Shield_Break`. **Ergebnis Teil 1:** Die freie UAL2 bringt für Kapitel 1 keinen Clip, der unsere Lücken
  schliesst. Der Weg über Schlüsselbilder (`waffenclips.py`, D184/D414) bleibt der richtige — mit den Vorgaben aus §4.

## 4. Fechtbücher und Handwerk als Vorlage

Alle Quellen gemeinfrei (Handschriften des 15./16. Jh.; *An Ax to Grind* als Werk der US-Bundesregierung). Texte
und Übersetzungen nach Wiktenauer (https://wiktenauer.com, Übersetzungen dort unter CC-BY-SA — **zitiert, nicht
übernommen**). Bilder **nur lokal** unter `.cache/referenz/fechtbuecher/` (Quellenliste dort, `QUELLEN.md`); ins Repo
ist keine Abbildung übernommen. Folio = Blatt der genannten Handschrift; die Zuordnung der Wiktenauer-Spalten zur
Handschrift ist bei Lecküchner (Cgm 582) und Talhoffer (Cod.icon. 394a) am Scan geprüft, bei Ringeck (Dresden) nur aus
der Spaltenfolge geschlossen (**UNKLAR**, §6).

**Achsen der Posenfelder** (`tools/waffenclips.py`): `hand` (rechts, vorn, hoch) in Metern vom Standpunkt, `richt`
Richtung der Klinge/des Stiels, `rumpf` (Drehung + = rechte Schulter vor, Neigung + = vor), `huefte` (Becken vor
der Brust, °), `koerper` (vor, hoch) Schwerpunkt, `fuss_l`/`fuss_r` (vor, rechts), `zwei` linke Hand an die Waffe,
`links` linke Hand frei. Höhen an der Hauptfigur: Schulter ≈ 1,45 m, Hüfte ≈ 1,0 m, Knie ≈ 0,5 m.

### 4.1 Langes Messer — Johannes Lecküchner, *Kunst des Messerfechtens*, Cgm 582 (BSB München, 1482)

Grundsatz (Wiktenauer Lecküchner, Abschnitt „how one should hold himself“): **einhändig**, die andere Hand auf dem
Rücken; sie kommt nach vorn zum Greifen, Ringen, Messernehmen. Beide Hände an den Griff nur als „Nachhilfe“ in
Ringstücken („come with your left hand to help your right hand down on your hilt … pull with your both hands firmly
downwards“, Abschnitt [294]). Alle Leger mit dem **linken Fuss vor** (Rechtshänder).

| Original | Deutsch heute | Beschreibung | Füsse | Gewicht | Schneide | Quelle |
|---|---|---|---|---|---|---|
| Pastey (Bastei) | Bastei | Arm gestreckt vor dir, Spitze auf der Erde, kurze Schneide oben | links vor | mittig | kurze oben | Cgm 582 fol. 33r |
| Lug ins Land | Ausguck | Arm hoch gestreckt vor dem Kopf, lange Schneide gegen den Mann | links vor | hinten, sprungbereit | lange vorn | fol. 33v |
| Eber | Eber | Messer am rechten Bein, Gehilz an der Hüfte, stumpfe Schneide oben, Spitze zum Gesicht; auch links | links vor | mittig, tief | stumpfe oben | fol. 33v |
| Stier | Stier | Gehilz vor dem Kopf (links oder rechts), kurze Schneide zu dir, Spitze zum Gesicht | links vor | mittig | kurze zu dir | fol. 34r |
| Schrankhut | Schrankhut | Spitze rechts (oder links) auf dem Boden, kurze Schneide zum Mann | links vor | hinten | kurze vorn | fol. 17r |
| Zornhau | Zornhau | von rechts oben „zornig“ mit ihm zusammen, Spitze gleich vor zum Gesicht oder zur Brust | — (nicht genannt) | nach vorn | lange | fol. 3v |
| Wecker | Wecker | von der rechten Schulter, **Sprung mit dem rechten Fuss weit nach rechts**, lange Schneide auf sein Messer, Spitze ins Gesicht winden | rechts seitwärts | über den rechten Fuss | lange | fol. 14v–15r |
| Entrüsthau | Entrüsthau | gegen den Ausguck: Messer flach am Leib, Sprung nach rechts, Gehilz vor den Kopf (Daumen unten), mit der stumpfen Schneide zu seiner oberen Blösse | rechts seitwärts | über den rechten Fuss | stumpfe | fol. 25r |
| Zwinger | Zwinger | bricht den Eber (Stich von unten), von beiden Seiten | — | — | — | fol. 28v |
| Geferhau | Geferhau | aus dem Ausguck mit gestrecktem Arm von oben, Sprung mit dem rechten Fuss, lange Schneide | Sprung rechts vor | ganz nach vorn | lange | fol. 29r–29v |
| Winker | Winker | von der rechten Schulter lang mit gestrecktem Arm, am Messer winden, kurze Schneide zum Kopf | links vor | nach vorn | lange, dann kurze | fol. 30r |

Plattenbilder: https://wiktenauer.com/wiki/Johannes_Lecküchner (Cgm 582: BSB-Digitalisat, Wiktenauer-Dateien
`Cgm_582_003v.jpg` … `Cgm_582_034r.jpg`).

**Vorgaben für Schlüsselbilder** (einhändige Fassung; zweihändig siehe §5 Nr. 1):

| Lage | `hand` | `richt` | `rumpf` | `huefte` | `koerper` | Füsse | linke Hand |
|---|---|---|---|---|---|---|---|
| Stand = Stier rechts | (0,15, 0,25, 1,62) | (−0,1, 0,95, −0,2) | (−15, 4) | 0 | (0, −0,06) | `fuss_l` (0,18, −0,02), `fuss_r` (−0,12, 0,06) | `links` (−0,12, −0,18, 1,05) — hinter dem Rücken |
| Ausholen Zornhau (= Luginsland/Schulter) | (0,28, −0,05, 1,6) | (0,2, −0,5, 0,85) | (−35, −4) | 10 | (−0,04, −0,06) | wie Stand | an der Brust (Lecküchner: „turn the hand from the back to the chest“) |
| Scheitel Zornhau | (0,05, 0,55, 1,35) | (−0,3, 0,9, −0,3) | (10, 12) | −8 | (0,12, −0,1) | `fuss_r` (0,35, 0,05) — Schritt | locker vorn |
| Wecker: Sprung | (0,35, 0,35, 1,45) | (−0,6, 0,75, 0,1) | (0, 10) | −5 | (0,08, −0,08) | `fuss_r` (0,15, 0,40) — seitwärts | frei |
| Bastei | (0,12, 0,45, 1,0) | (0, 0,55, −0,83) | (−8, 8) | 0 | (0, −0,08) | linker vor | hinter dem Rücken |
| Eber | (0,25, 0,12, 1,0) | (−0,05, 0,9, 0,42) | (−20, 6) | 8 | (0, −0,1) | linker vor | hinter dem Rücken |

Schneide: lange Schneide führt bei Zorn-, Gefer- und Winkerhau, die **kurze** oder stumpfe beim Wecker aus der
Schrankhut und beim Entrüsthau — `waffenclips.py` dreht heute immer die (lange) Schneide in die Bewegung; ein
Feld für „kurze Schneide führt“ fehlt (Vorschlag §5 Nr. 4).

### 4.2 Klinge (Seitschwert, einhändig) — Liechtenauer-Tradition und Lecküchner

Die Liechtenauer-Lehre ist eine Lehre des **Langen Schwerts** (zweihändig). Unsere Klinge ist ein einhändiges
Seitschwert (D421, 1,21 kg). Übertragbar sind Fussarbeit, Leger und Schlagwege; der Griff ist der des Messers (§4.1).

Leger wörtlich nach der Ringeck-Glosse; die fünf Meisterhäue nur kurz nach Stichwort und Blatt (Beschreibung aus
der Glosse zusammengefasst, nicht Satz für Satz geprüft).

| Original | Deutsch heute | Beschreibung (Ringeck-Glosse) | Füsse | Schneide | Quelle |
|---|---|---|---|---|---|
| Ochs | Ochs | Schwert neben dem rechten Kopf, Gehilz vor dem Haupt, Spitze zum Gesicht | links vor | — | Liechtenauers Zettel, Verse 68–69; Glosse Mscr.Dresd.C.487 fol. 34r |
| Pflug | Pflug | Schwert über dem rechten Knie, Spitze zum Gesicht | links vor | — | fol. 34r |
| Alber | Narr | Arme gestreckt, Spitze auf der Erde | **rechts** vor | — | fol. 34r–34v |
| Vom Tag | Vom Dach | Schwert an der rechten Schulter oder gestreckt über dem Kopf | links vor | — | fol. 34v |
| Zornhau | Zornhau | Oberhau von rechts, gleich in den Ort | — | lange | fol. 18r–21v |
| Krumphau | Krumphau | von der Schulter über seine Hände, zur Seite tretend | seitwärts | lange, gekreuzte Hände | fol. 24v–26v |
| Zwerchhau | Zwerchhau | waagrecht, Gehilz hoch vor dem Kopf | — | kurze, dann lange | um fol. 29v |
| Schielhau | Schielhau | Oberhau mit der kurzen Schneide | — | kurze | fol. 31r |
| Scheitelhau | Scheitelhau | senkrecht von oben | — | lange | um fol. 33r |

Wiktenauer: https://wiktenauer.com/wiki/Liechtenauer (Zettel), https://wiktenauer.com/wiki/Sigmund_ain_Ringeck (Glosse).
**Vorgabe:** `Klinge_Stand` steht heute mit dem **rechten** Fuss vor (Alber-Stellung) — das stimmt mit einer
Spitze vorn-oben nur für den Alber; für Ochs/Pflug/Lecküchner-Leger linker Fuss vor (§5 Nr. 6).

### 4.3 Axt — Talhoffer (Kampfaxt) und das Forsthandwerk (Fällaxt)

**Benannt:** Talhoffers „axst“ (Cod.icon. 394a, BSB München, 1467, fol. 41r ff.; Thott 290 2°, 1459) ist die
**Mord- bzw. Kampfaxt** des gerichtlichen Zweikampfs: Schaft etwa mannshoch, Haken, Stossspitze, im Harnisch,
Hände weit auseinander, Binden und Ringen am Schaft. **Das ist keine Fällaxt.** Übernehmen lässt sich nur: zwei Hände,
die hintere am Ende, Hebel statt Kraft. Für unsere Fällaxt (2,1 kg, 1 m) gilt das Handwerk:

USDA Forest Service, Bernie Weisgerber, *An Ax to Grind: A Practical Ax Manual* (1999), Kapitel „Chopping Technique“
(https://www.fs.usda.gov/t-d/pubs/htmlpubs/htm99232823/page04.htm, Abb. 76–79):
„place your **left hand** about 1 or 2 inches from the butt end … your **right hand** about three–fourths of the way up
the handle“; „Raise the ax over your right shoulder … your right hand sliding down the handle toward your left hand“;
„You will end this motion with both hands at the end of the handle when the ax strikes the wood“; „Your left hand never
leaves the end of the handle“; Rückhand ebenfalls über die rechte Schulter, „shift your body well to the left“;
„Changing hand positions instead of … the back swing technique is not considered acceptable ax use.“ Schnitt 45–50°
zur Faser.

| Name | Beschreibung | Füsse | Gewicht | Schneide | Quelle |
|---|---|---|---|---|---|
| Griff | links am Stielende (fest), rechts ¾ oben (gleitet) | schulterbreit | mittig | — | USFS Abb. 76 |
| Vorhand | über die rechte Schulter ausholen, rechte Hand gleitet beim Schlag zur linken, im Treffen beide am Ende | stehen | nach vorn ins Ziel | führt, 45° | USFS Abb. 77–78 |
| Rückhand | ebenfalls über die rechte Schulter, Körper weit nach links verlagert | stehen | nach links | führt | USFS Abb. 79 |
| Anbinden (Kampfaxt) | Schäfte gekreuzt, beide Hände weit auseinander | Ausfall | vorn | Haken | Cod.icon. 394a fol. 41r |
| Frei schlagen (Kampfaxt) | „Der will fry schlahen“ — Schlag von oben aus dem Binden | — | — | Schneide | fol. 42r |

**Vorgabe Fällaxt** (`zwei` ändert die Seite, §5 Nr. 2): Ausholen `hand` (0,25, −0,15, 1,75), `richt`
(0,15, −0,7, 0,7), `rumpf` (−30, −10), `koerper` (−0,04, 0); Scheitel `hand` (0,05, 0,45, 1,2), `richt`
(0, 0,85, −0,5), `rumpf` (5, 25), `koerper` (0,1, −0,12); Treffen beide Hände am Stielende; Nachschwung: der Kopf
folgt bis unter die Hüfte, das Becken bremst (D420), die Füsse bleiben stehen (USFS: keine Schritte beim Hieb).

### 4.4 Saufeder — Joachim Meyer, halbe Stange (1570), und Jagd

Meyer, *Gründtliche Beschreibung der … Kunst des Fechtens* (Strassburg 1570), Buch III, fol. 16r–17v, „Von den Legern
oder Huten“ der **halben Stange** („Fundament aller langen Wehren“); https://wiktenauer.com/wiki/Joachim_Meyer.
Talhoffer (Thott 290 2°, 1459) zeigt den Spiess vor allem als Wurf. Eine gemeinfreie Jagdquelle mit Saufeder im
Bild: Gaston Phébus, *Livre de la chasse*, BnF fr. 616, um fol. 94r (Wildschweinjagd) — **nicht am Scan geprüft**;
*The Master of Game* (Gutenberg) war beim Abruf nicht erreichbar.

| Original | Deutsch heute | Beschreibung | Füsse | Gewicht | Quelle |
|---|---|---|---|---|---|
| Oberhut | Oberhut | hinteres Ende an der Brust, vorderes gerade nach oben (auch zu den Seiten) | **links vor**, nicht zu weit | mittig | Meyer III fol. 16v |
| Underhut | Unterhut | hinteres Ende an der rechten Weiche, vorderes gestreckt auf die Erde (links, rechts, gerade) | links vor | mittig | fol. 16v |
| Nebenhut | Nebenhut | Mitte der Stange an der linken Hüfte, kurzes Ende zum Mann | rechts vor | hinten | fol. 16v–17v |
| Mittelhut | Mittelhut | „die gerade Versatzung vor dem Mann, daraus man am meisten ficht“ | links vor | mittig | fol. 17v |
| Steirhut | Steuerhut | vorderes Ende vor dem linken Fuss am Boden, das hintere mit gestreckten Armen vor dem Gesicht | links vor | hinten | fol. 17v |

**Vorgabe:** Grundhaltung Mittelhut, **linker Fuss vor** (linke Hand ist die vordere), hinteres Ende an der rechten
Weiche/Hüfte; Stoss mit Vorschritt des linken oder Nachtritt des rechten Fusses, Gewicht wandert auf den vorderen
Fuss. Für das Abfangen eines anlaufenden Tiers (Jagd) Unterhut, Schaftende am Boden oder an der Hüfte — **nicht
belegt** an einer geprüften Quelle.

### 4.5 Hirschfänger und Räucherkanne

**Hirschfänger:** jagdliche Seitenwaffe zum Abfangen; ein eigenes Fechtbuch ist in dieser Recherche nicht gefunden.
Einhändig wie Lecküchners Messer, kürzer — die Klingenclips (D414) passen dazu. **Räucherkanne:** Werkzeug, keine
Waffe; keine Fechtquelle (Haltung aus der Imkerei, D414).

## 5. Abgleich: unsere Clips gegen Fechtbuch und Handwerk

Gemessen mit `tools/ual2probe.py` (`BESTAND=…`) an der ausgelieferten Figur, Bilder
`.cache/bilder/D428/bestand_abgleich_kontakt.png`. **Clips nicht geändert** (D423); jeder Vorschlag ist ein
Kampfwert-Wechsel und braucht die Messung.

| Clip | s | Scheitel/Durchzug (gemessen) | Schneide ↔ Schlag | linke Hand neben Griff cm | Becken tiefer cm | Schultern ° | Gewicht | Nachschwung m |
|---|---|---|---|---|---|---|---|---|
| `Klinge_U_A` | 1,38 | 7/8 | 20° | 55 | 30 | −164…47 | 0,23…0,99 | 0 |
| `Klinge_U_B` | 1,58 | 8/8 | 24° | 73 | 9 | −156…44 | 0,13…0,85 | 0,65 |
| `Klinge_U_C` | 2,00 | 17/18 | 7° | 63 | 0 | −179…165 | 0,29…3,51 | 0,61 |
| `Klinge_Stich` | 1,21 | 11/11 | (Stich) | 50 | 0 | −13…40 | 0,46…0,56 | 0,41 |
| `Klinge_U_Lauf` | 1,58 | 9/10 | 9° | 68 | 40 | −114…39 | −0,05…0,83 | 0 |
| `Axe_Overhead` | 1,38 | 13/14 | **119°** | **34 (6–72)** | 0 | **0…0** | 0,60 (fest) | 0 |
| `Axt_Quer` | 1,21 | 12/13 | 15° | 3 | 0 | −42…53 | 0,50…0,68 | 2,20 |
| `Axt_Schwer` | 1,62 | 22/25 | 23° | 5 | 1 | 6…16 | 0,33…0,76 | 0 |
| `Axt_Lauf` | 1,04 | 11/11 | 30° | 1 | 0 | −31…48 | 0,55…0,60 | 0 |
| `Speer_Stoss` | 0,96 | 8/10 | (Stoss) | 5 | 0 | 3…22 | 0,49…0,60 | 1,67 |
| `Speer_Weit` | 1,21 | 14/14 | (Stoss) | 7 | 0 | 0…28 | 0,51…0,60 | 0,28 |
| `Messer_Quer_A` | 1,21 | 11/13 | 21° | **2** | 13 | −46…58 | 0,17…0,67 | 1,37 |
| `Messer_Quer_B` | 1,12 | 10/11 | 18° | **2** | 13 | −32…63 | −0,14…0,36 | 1,98 |
| `Messer_Schwer` | 1,46 | 14/16 | 22° | **1** | 24 | 8…22 | 0,14…0,70 | 0,38 |
| `Messer_Lauf` | 1,04 | 11/11 | 36° | **2** | 13 | −36…50 | 0,27…0,73 | 0,43 |

Die gemessenen schnellsten Bilder liegen bei allen Clips im Fenster `hieb` aus `content/waffen/*.json` — die
Trefferfenster sitzen auf den Schlüsselbildern.

**Widersprüche und Vorschläge:**

1. **Langes Messer zweihändig** (`Messer_*`, linke Hand 1–2 cm am Griff) — Lecküchner lehrt einhändig, die zweite
   Hand frei (§4.1). Unser Modell (1,17 m, 1,39 kg, Griffpunkt 27 cm vom Knauf) liegt an der Grösse eines
   zweihändigen Kriegsmessers; dafür gibt es in dieser Recherche **keine** gemeinfreie Fechtlehre. Vorschlag: (a)
   einhändig nach Lecküchner, Modell kürzer (Klinge um 70 cm, *Anker nicht belegt*), linke Hand frei — sie passt dann
   zum Wirken der Marke und zum Greifen (Reinigen, D417); oder (b) zweihändig lassen und als Kriegsmesser benennen,
   Vorlage dann die Leger des Langen Schwerts (§4.2). → **A-43 (1)**.
2. ~~**Axt: Hände vertauscht**~~ — **behoben D429** (§5.1). (`zwei='axt'`: rechte Hand am Stielende, linke 0,22 m darüber; `Axt_*`) — Handwerk:
   linke Hand fest am Ende, rechte gleitet, Hieb über die **rechte** Schulter (§4.3). Mit der rechten Hand am Ende ist
   die natürliche Ausholseite die linke. Vorschlag: Waffe an die linke Hand (Ende) hängen, rechte Hand per IK am Stiel
   gleiten lassen (Ausholen ¾ oben, Treffen am Ende) — braucht eine Lage der Waffe an der linken Hand
   (`WAFFE_AN_HELD_HAND`, `src/kampf/waffenhand.ts`) und eine Gleit-IK in `weltformel.greife_links`. → A-43 (2).
3. ~~**`Axe_Overhead` einhändig, ohne Körper, Nacken voran**~~ — **behoben D429** (§5.1, ersetzt durch `Axt_Hieb`). (erster leichter Axthieb, `content/waffen/axt.json`
   `leicht[0]`): linke Hand 34 cm (bis 72) vom Stiel, Schultern und Becken bewegen sich **gar nicht** (0°, 0 cm,
   Gewicht fest 0,60), die Schneide steht im Scheitel 119° zur Schlagrichtung. Widerspricht D419/D421 und dem
   Handwerk. Vorschlag: durch einen eigenen zweihändigen Vorhandhieb aus `waffenclips.py` ersetzen (Vorgabe §4.3),
   Fenster neu messen (D423).
4. **Schneide immer in Schlagrichtung** — richtig für Axt (15–30°) und für die langen Messerhiebe (18–36°); bei
   Lecküchners Wecker/Entrüsthau/Schielhau führt aber die **kurze** oder stumpfe Schneide. Vorschlag: Posenfeld
   `kurz=True` in `waffenclips.py` (Handgelenk um 180° um die Klingenachse), erst wenn ein solcher Hieb gebaut wird.
5. **Kein Nachschwung bei `Axt_Schwer`, `Axt_Lauf`, `Klinge_U_A`, `Klinge_U_Lauf`** — für die Axt **behoben D429** (§5.1),
   die Klinge bleibt offen. (Spitze steht unmittelbar nach
   dem Durchzug) — bekannt aus D420/D423 („Bestandsclips nach der Messung“). Handwerk: Kopf folgt bis ins Holz,
   beide Hände am Ende. Keine neue Erkenntnis, hier nur gemessen.
6. **Standbein:** `Klinge_Stand` und `Speer_Stand` stehen mit dem **rechten** Fuss vor. Liechtenauer (Ochs, Pflug,
   Vom Tag), Lecküchner (alle Leger) und Meyer (Ober-, Unter-, Mittelhut der Stange, die linke Hand vorn) stellen den
   **linken** Fuss vor. Bei der Saufeder ist das deutlich: vordere Hand links, vorderer Fuss rechts dreht den Rumpf
   gegen die Waffe. Vorschlag: linker Fuss vor, Stoss mit Nachtritt rechts. `Messer_Stand` stimmt (links vor).
7. **Ganze Drehungen in den UAL2-Klingenhieben** (`Klinge_U_A/B/C`: Schulterlinie dreht bis ±180°, Ausfall bis
   30 cm, Füsse nah am Boden bis 6 m/s) — in den hier gelesenen Stellen von Lecküchner und Ringeck schlägt man mit
   Schritt oder Sprung zur Seite, eine Drehung um die eigene Achse kommt dort nicht vor (eine Gradzahl für die
   Rumpfdrehung nennen die Quellen nicht). Gehört zur Klingen-Überarbeitung nach D423, nicht jetzt.
8. **Kommentar in `tools/heldbau.py`** (D188: Fingergriff links „aus TreeChopping_Loop (Axt mit beiden Händen)“) —
   der Clip ist einhändig (§3). Der Griff selbst taugt; nur die Begründung stimmt nicht. Bei der nächsten Arbeit an
   `heldbau.py` korrigieren (die Datei gehört nicht zu diesem Auftrag).

### 5.1 D429: die Zweihand-Fällaxt — ausgeführt

Flo 22.11.2026 (Ledger D429): vier Fehler an der Axt, alle bestätigt. Gebaut nach §4.3 (Forsthandbuch), geprüft an den
ausgelieferten Dateien (`tests/axtgriff.test.ts`: three.js spielt `held-clips.glb` und `waffen.glb` ab wie das Spiel).

**Wie die Hände halten.** Das Modell hängt weiter an `hand_r` (Spielhand). Sein Ursprung ist die **vordere** Griffstelle
(¾ den Stiel hinauf, 65 cm vor dem Ende), das Stielende liegt als `griff_links` 0,62 m dahinter (3 cm vor dem Ende, der
kleine Finger auf dem Knauf). Die Clips legen die linke Hand je Bild auf die Stielachse an die Stelle `griff`
(`tools/waffenclips.py` Posenfeld, `tools/weltformel.py` `stiel`); die Szene schiebt das Modell nach jedem Mixer-Schritt
entlang seiner Achse, bis das Stielende in der linken Hand liegt (`gleiteAmStiel`, `src/kampf/waffenhand.ts`; Spielerin und
Axtmann). So **gleitet die rechte Hand**, wie das Handbuch es verlangt: in der Hut 40 cm vom Ende, beim Ausholen 63 cm (zum
Kopf), im Treffen 14 cm (beide Hände am Ende); die linke verlässt das Ende nie. Liegt die linke Hand nicht am Stiel (Rolle,
Gang, Treffer), hält die rechte die Axt allein an der vorderen Griffstelle.

**Clips** (alle aus Schlüsselbildern, Hüfte führt, Gewicht nach vorn, Füsse stehen vom Scheitel bis zum Durchzug,
Nachschwung nach D420 — Soll Axt seit D429 44° / 67 %):

| Clip | Dauer | Scheitel / Durchzug | Schneide ↔ Bahn im Scheitel / Durchzug (vorher) | rechte Hand vom Stielende Scheitel → Durchzug | Nachschwung / Halt |
|---|---|---|---|---|---|
| `Axt_Hieb` (statt `Axe_Overhead`) | 1,417 s | 12 / 16 | **19° / 6°** (160° / 60°) | 63 → 14 cm | 49° / 72 % |
| `Axt_Quer` | 1,250 s | 10 / 15 | **4° / 2°** (8° / 16°) | 63 → 14 cm | 86° / 73 % |
| `Axt_Schwer` | 1,667 s | 20 / 25 | **1° / 4°** (108° / 5°) | 44 → 14 cm | endet am Boden, Becken −5 cm / 73 % |
| `Axt_Lauf` | 1,083 s | 7 / 11 | **10° / 5°** (43° / 26°) | 63 → 14 cm | 53° / 73 % |
| `Axt_Stand`, `Axt_Block` | 2,042 / 0,333 s | — | — | Hut 40 cm, Block 60 cm | — |

Dauer, Scheitel und Durchzug **wie vor D429** (Test). Schneide gemessen als Winkel zwischen Schneide und Bahn der Kopfmitte
quer zum Stiel, im Scheitel die Richtung des beginnenden Schlags, im Durchzug die, aus der er kommt; dazwischen bis 4° (Lauf
19°). Vorher = dieselbe Messung an der Fassung aus git (Axt starr an der rechten Hand). Die Schneide führt, weil das
Handgelenk jetzt nach der Bahn des **Kopfs** gedreht wird (vorher nach der der Hand) und schon beim Ausholen in die künftige
Schlagrichtung steht. Das Modell legt die Schneide nach −X — wie `waffenclips.py` annimmt (Test `waffenmodelle.test.ts`).

**Abweichungen, benannt:** (1) Im Spalthieb reicht die rechte Hand im Scheitel nur 44 cm vom Ende hinauf (nicht ¾): Hängt
der Kopf tiefer hinter dem Rücken, reicht der linke Arm nicht mehr ans Stielende (geprüft: die Hand verliesse den Stiel um
13 cm) — der Scheitel liegt deshalb mit waagrechtem Stiel über dem Kopf. (2) Auch in der Hut rückt die linke Hand 5 cm zur
rechten (Arm zu kurz für 0,42 m). (3) Der Querhieb und der Laufhieb sind Kampfhiebe; das Forsthandbuch kennt nur den Hieb über
die rechte Schulter (Vor- und Rückhand) — die Griffregel gilt für alle, die Bahn nicht.

**Timing — Vorschlag, nicht angewendet** (Kampfwerte, Messbedarf Kampfbot D407 mit Siegquoten gegen Menschen): Der Kopf
schwingt im Aktivfenster 165° (Hieb), 170° (Quer), 137° (Spalthieb), 172° (Lauf). Aus voller Leistung (zwei Hände,
`content/gewicht.json`: 840 W, Trägheit 0,68 kg·m² + Arm 0,5) braucht 120° 0,19 s, also t = 0,19 s · (θ/120°)^⅔: Axthieb
**0,23 s** (Regel 0,16), Querhieb **0,24 s** (0,20), Spalthieb **0,21 s** (0,18), Laufhieb **0,24 s** (0,16). Die Regel
ist 15–50 % schneller als die Physik (Überschlag — Leistung und Zweihandfaktor sind nicht belegt). Ein längeres Aktivfenster
heisst aber auch länger treffen; die Physik verlangt eigentlich den **Schwung**, nicht das Fenster. Vorschlag: Aktiv wie oben,
dafür Vorlauf um dieselbe Zeit kürzen (Axthieb 0,37 → 0,30 s), damit die Schlagzeit gleich bleibt — erst messen.

## 6. Unklar

- **UNKLAR:** Folio der Ringeck-Glosse — die Zuordnung der ersten Wiktenauer-Spalte zu Mscr.Dresd.C.487 ist aus der
  Spaltenfolge geschlossen, nicht am Scan geprüft.
- **UNKLAR:** Ob die Source-Fassung der UAL2 einen zweihändigen Hieb enthält (`Mining`, `Sword_Heavy_A–D`) — nur
  die Namen sind gelesen, die Clips nicht angesehen.
- **UNKLAR:** Reale Spitzengeschwindigkeiten von Schwert- und Axthieben und das Gewicht eines Wurfbeils — nicht belegt.
- **UNKLAR:** Saufeder in der Jagd (Phébus fol. 94r) nicht am Bild geprüft.
- Die Messung „Fuss nah am Boden“ trennt Gleiten nicht von flachem Schritt; Urteil über Fussgleiten nur am M1 in
  Bewegung.
