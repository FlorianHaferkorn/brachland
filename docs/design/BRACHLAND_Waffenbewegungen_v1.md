---
last-reviewed: 2026-11-23
shelf-life-days: 180
---
<!-- BRACHLAND — Waffenbewegungen aus freien Quellen (D428, D430). Stand 23.11.2026. -->

# BRACHLAND — Waffenbewegungen aus freien Quellen v1 (D428)

> **D452 (23.11.2026):** Körper von `Axt_Hieb` und `Axt_Schwer` nach dem Spaltvideo nachgezogen (tieferes Becken, Hüftknick,
> Schwerpunkt über den Füssen), Trefferfenster A gegen B mit dem Kampfbot gemessen — A übernommen, B Vorschlag (§5.2, A-49).
>
> **D430 (23.11.2026):** Bewegungen aus frei lizenzierten Videos — Quellen, Kette (`tools/videoposen.py`), Probeclip und
> ehrliche Bewertung in §7; Fragen an Flo: Ledger **A-45**.
>
> **D429 (22.11.2026):** Die Axt ist jetzt eine Zweihand-Fällaxt nach *An Ax to Grind* — Widersprüche 2, 3 und 5 (Axt)
> aus §5 sind behoben, Ausführung und Messwerte in §5.1.
>
> **Recherche und Probe, nichts verdrahtet.** Kein Clip in `public/figuren/held/held-clips.glb` geändert, keiner
> Waffe zugewiesen, kein Kampfwert berührt (D423: Bestandsclips erst nach der Messung). Offene Fragen an Flo:
> Ledger **A-43**. Prüfbilder unter `.cache/bilder/D428/` (Formprüfung in Blender Cycles, keine Look-Abnahme,
> Bewegung nur am M1 — ADR-0005). Grundsatz (D431): reale Techniken und Handwerk ja, fremde Gestaltung nein
> (ADR-0007 §1 Nachtrag); ob Material benutzt werden darf, regelt ADR-0013 Punkt 5. Physik nach D398, Gewicht sichtbar
> nach D419.

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

**Nachtrag D452 (23.11.2026):** gemessen — Variante B (dieser Vorschlag) geht durch das Kampftor, bleibt aber Vorschlag (§5.2).

### 5.2 D452: Körper nach dem Spaltvideo, Trefferfenster A gegen B

Flo 23.11.2026 („mach 2“, A-45 (2)): den Körper der Axtclips nach dem Befund aus §7.4 nachziehen und das Timing per Kampfbot
messen. **Geändert:** `Axt_Hieb` und `Axt_Schwer` (`tools/waffenclips.py`), eingefügt in die Fassung aus git von
`public/figuren/held/held-clips.glb` (786 → **789 KB**, Budget 800; die übrigen 34 Clips unverändert). Bilder, Scheitel,
Durchzug und Clipdauer bleiben (Test), ebenso Zweihandgriff, Schneide in Schlagrichtung und alle Prüfungen aus D429
(`tests/waffenclips.test.ts` 203/203, `tests/axtgriff.test.ts` 53/53). **Kein Kampfwert geändert.**

**Was das Video wirklich zeigt.** Die Schlüsselposen von Hieb 2 (`.cache/d430/cleaving/cleaving.json`) lesen sich anders, als
die Kurzform „Gewicht 0,43 m nach vorn“ in §7.4 nahelegt: Die 0,43 m sind die **Spanne des Beckens**, und das Becken geht im
Schlag **zurück** (Scheitel +0,21 m, Treffen −0,20 m), während der Rumpf bis 68° vorklappt — ein Hüftknick. Der Schwerpunkt
wandert über das Vorbeugen nach vorn, nicht über das Becken. Würde man bei 50–60° Vorbeugen auch das Becken nach vorn
schieben, läge der Schwerpunkt vor den Zehen (Physik D398). Die Prüfung aus D414 („`koerper` v steigt vom Scheitel zum
Durchzug um > 0,1 m“) verlangt aber, dass das Becken vorwandert; sie hält, weil das Gewicht im Scheitel jetzt auf dem
hinteren Fuss liegt (Fechtbuch, §4) und das Becken von dort nur 13–14 cm vor geht. **Vorschlag:** die Prüfung auf den
Schwerpunkt umstellen (Becken + Rumpfneigung), nicht auf das Becken — nicht gemacht, weil es eine Prüfung aus D414/D429 ist.

**Körperwerte alt → neu** (Pose + Hut wie im Clip; Becken und Rumpf aus den Schlüsseln, Schwerpunkt als Überschlag:
Rumpf+Kopf 58 % bei 0,6 × 0,45 m entlang des Rumpfs, Beine 32 %, Arme 10 %, Axt 3 %; Stütze = Ferse hinten bis Zehen vorn;
Axtkopf = Hand + Stielrichtung × Abstand nach D429; Video aus §7.4):

| | `Axt_Hieb` D429 → **D452** | `Axt_Schwer` D429 → **D452** | Video Spalten (Hieb 2) |
|---|---|---|---|
| Becken im Scheitel über der Hut | −1 cm → **+4 cm** (aufgerichtet) | 0 → **+3 cm** | +8 cm |
| Becken Scheitel → tiefster Punkt | 17 → **29 cm** | 25 → **33 cm** | 30 cm |
| Rumpf vor (grösste Neigung) | 35° → **51°** | 41° → **63°** | 68° |
| Becken vor Scheitel → Durchzug | 14 → **13 cm** | 24 → **14 cm** | −40 cm (zurück) |
| Schwerpunkt vor Scheitel → Durchzug (Überschlag) | 28 → **32 cm** | 40 → **35 cm** (bis 38) | — (nicht gemessen) |
| Schwerpunkt im Durchzug / vordere Stützgrenze | 0,22 / 0,31 → **0,24 / 0,41 m** | 0,28 / 0,43 → **0,24 / 0,43 m** | — |
| linker Fuss | steht in der Hut → **setzt beim Ausholen 10 cm weiter vor, steht ab Bild 9** | +12 cm ab Bild 17 (unverändert) | stehen, 0,32 m auseinander |
| Axtkopf im Durchzug (Treffhöhe) | 0,72 → **0,79 m** (Hüfthöhe 0,96 m kurz vor dem Durchzug durchlaufen) | 0,15 → **0,15 m** (am Boden) | Spaltblock in Kniehöhe |
| Schneide ↔ Bahn Scheitel / Durchzug (`axtgriff.test.ts`) | 19° / 6° → **7° / 4°** | 1° / 4° → **1° / 7°** | — |
| rechte Hand vom Stielende Scheitel → Durchzug | 63 → 14 cm (gleich) | 44 → 14 cm (gleich) | — |
| Nachschwung / Halt (Soll 44° / 67 %) | 49° / 72 % → **46° / 72 %** | endet am Boden, Becken −6 cm (Test ≥ 4) / 73 % | Holz hält die Axt |

Die Hände treffen im Hieb tiefer und weiter vorn (Durchzug 1,15 → 0,98 m hoch, 0,45 → 0,62 m vor), weil die Schultern mit
dem Vorbeugen 13 cm tiefer liegen; im Spalthieb liegt der Stiel im Treffen flacher (Spitze ≥ 5 cm über dem Boden, Test).
Der Fällhieb bleibt flacher gebeugt als das Spalten (51° gegen 68°), weil er auf Hüfthöhe zielt, nicht auf Kniehöhe.
**Abweichungen, benannt:** (1) Der Schritt des linken Fusses im Hieb gleitet zwischen Bild 5 und 9 am Boden (Schlüssel ohne
Anheben, wie die Messerhiebe seit D414). (2) Im Spalthieb reicht die rechte Hand in Bild 17 nur 41 statt 50 cm hinauf (Arm zu
kurz, die linke Hand rückt am Stiel nach, `_pose` — ob die Fassung D429 dort schon kürzte, nicht geprüft). (3) Der Schwerpunkt ist ein Überschlag, keine Rechnung am Rig.

**`Axt_Quer` und `Axt_Lauf` nicht geändert.** Befund: Der Querhieb senkt das Becken vom Scheitel nur 5 cm (13 cm aus der
Hut), Rumpf 17°, das Gewicht wandert 16 cm vor — für einen waagrechten Hieb auf Hüfthöhe stimmig; das einzige freie Video eines
Querhiebs (*Standing Block*, §7.4) zeigt 2 cm auf/ab, die Hände sind dort verdeckt — kein Beleg für mehr Körper. Der
Laufhieb trägt den Körper schon mit einem Schritt von 45 cm, Becken 30 cm vor, Rumpf 33° — nicht offensichtlich steif.

**Timing: A gegen B.** (A) Trefferfenster unverändert (`content/waffen/axt.json`), nur Körper; (B) Aktiv nach Physik/Video
(§5.1), Vorlauf um dieselbe Zeit kürzer, Schlagzeit gleich: Axthieb 0,37/**0,16** → 0,30/**0,23** s, Querhieb 0,30/0,20 →
0,26/0,24, Spalthieb 0,90/0,18 → 0,87/0,21, Laufhieb 0,20/0,16 → 0,12/0,24 (Erholung, Schaden, Kosten gleich; die Clipbilder
bleiben, die Szene legt jede Phase auf ihren Clipabschnitt). Gemessen mit `tools/waffenmessung.ts` (Bot D407, Axt, Saat 5000…,
**1.000 Kämpfe je Zelle**, 90 Zellen: elf Tieraufstellungen aus `reinigensim.ts` × drei Profile × töten / immer reinigen,
dazu Wegelagerer, Speermann, Axtmann, Wegelagerer+Wolf × drei Profile × bis zum Tod / Aufgabe D426). Rohdaten:
`.cache/d452/messung_A.json`, `.cache/d452/messung_B.json`.

- **Kampftor** (`tests/kampfbot.test.ts`, beide Bots) mit B: **348/348 grün** — kein Band reisst.
- **Andere Prüfungen mit B:** `tests/echtzeit.test.ts` **fällt** an „die Axt holt länger aus“ (Axthieb-Vorlauf > 2 × Klinge,
  D180/ADR-0008: 0,30 gegen 2 × 0,18 s) — eine Regel des Waffenwerks, kein Messband; `tests/kampfprotokoll.test.ts` fällt am
  Fingerabdruck von D171 (erwartet: der Fingerabdruck hält die Kampfwerte fest). Baukasten, Gewicht, Trefferwucht, Aufgabe,
  Waffenclips grün.
- **Mittel über alle Zellen:** Tiere Siege −0,6 Punkte (−7,9 … +2,6), Zeit −2 % (−41 … +63 %); Menschen Siege −0,6 Punkte
  (−9,2 … +3,8), Zeit −4 % (−17 … +3 %). 62 von 90 Zellen bleiben unter 3 Punkten und 5 %.

Zellen mit ≥ 3 Punkten Siege oder ≥ 5 % Zeit (28 von 90):

| Aufstellung | Spiel | Profil | Siege A → B | Zeit A → B | erlitten A → B | Δ Siege | Δ Zeit |
|---|---|---|---|---|---|---|---|
| grathorn | töten | parierend | 100 % → 100 % | 7.1 s → 6.7 s | 7 → 24 | +0.0 | -6 % |
| grathorn | immer reinigen | aufmerksam | 99 % → 96 % | 28.7 s → 46.6 s | 12 → 29 | -3.6 | +63 % |
| grathorn | immer reinigen | müde | 95 % → 93 % | 27.8 s → 29.8 s | 52 → 60 | -1.3 | +7 % |
| fuchs | töten | aufmerksam | 100 % → 100 % | 4.2 s → 3.4 s | 2 → 0 | +0.0 | -20 % |
| fuchs | töten | müde | 100 % → 100 % | 3.8 s → 3.3 s | 9 → 0 | +0.0 | -14 % |
| fuchs | töten | parierend | 100 % → 100 % | 4.8 s → 2.8 s | 7 → 0 | +0.0 | -41 % |
| fuchs | immer reinigen | aufmerksam | 100 % → 100 % | 4.2 s → 3.4 s | 2 → 0 | +0.0 | -20 % |
| fuchs | immer reinigen | müde | 100 % → 100 % | 3.8 s → 3.3 s | 9 → 0 | +0.0 | -14 % |
| fuchs | immer reinigen | parierend | 100 % → 100 % | 4.8 s → 2.8 s | 7 → 0 | +0.0 | -41 % |
| wolf+fuchs | töten | aufmerksam | 100 % → 100 % | 24.2 s → 20.9 s | 19 → 20 | -0.1 | -14 % |
| wolf+fuchs | töten | parierend | 100 % → 100 % | 5.8 s → 5.1 s | 5 → 3 | +0.0 | -11 % |
| gams+gams | töten | aufmerksam | 99 % → 95 % | 22.9 s → 21.9 s | 22 → 33 | -4.5 | -4 % |
| gams+gams | immer reinigen | müde | 54 % → 48 % | 21.9 s → 22.3 s | 84 → 87 | -6.1 | +2 % |
| keiler+grathorn | immer reinigen | aufmerksam | 99 % → 98 % | 48.1 s → 54.1 s | 21 → 24 | -0.8 | +12 % |
| keiler+grathorn | immer reinigen | müde | 74 % → 66 % | 46.8 s → 52.0 s | 56 → 67 | -7.9 | +11 % |
| wolf+wolf+wolf | töten | parierend | 14 % → 12 % | 14.5 s → 13.8 s | 15 → 16 | -1.7 | -5 % |
| wolf+wolf+wolf | immer reinigen | müde | 2 % → 2 % | 29.1 s → 30.6 s | 99 → 99 | +0.1 | +5 % |
| wolf+fuchs+fuchs | töten | parierend | 3 % → 3 % | 14.0 s → 11.0 s | 7 → 6 | +0.6 | -21 % |
| wolf+fuchs+fuchs | immer reinigen | parierend | 10 % → 12 % | 18.0 s → 13.1 s | 35 → 33 | +2.6 | -27 % |
| axtmann | bis zum Tod | müde | 67 % → 58 % | 21.6 s → 20.0 s | 61 → 71 | -9.2 | -7 % |
| axtmann | bis zum Tod | parierend | 100 % → 99 % | 7.6 s → 7.0 s | 14 → 31 | -0.9 | -7 % |
| axtmann | Aufgabe D426 | aufmerksam | 99 % → 98 % | 5.4 s → 4.9 s | 6 → 8 | -1.2 | -9 % |
| axtmann | Aufgabe D426 | müde | 76 % → 68 % | 11.6 s → 9.6 s | 39 → 44 | -7.4 | -17 % |
| axtmann | Aufgabe D426 | parierend | 100 % → 100 % | 3.7 s → 3.5 s | 4 → 3 | +0.0 | -6 % |
| wegelagerer+wolf | bis zum Tod | aufmerksam | 100 % → 100 % | 25.2 s → 23.7 s | 23 → 24 | +0.1 | -6 % |
| wegelagerer+wolf | bis zum Tod | müde | 60 % → 64 % | 22.8 s → 22.2 s | 76 → 76 | +3.4 | -3 % |
| wegelagerer+wolf | Aufgabe D426 | aufmerksam | 100 % → 100 % | 24.9 s → 23.4 s | 22 → 24 | +0.1 | -6 % |
| wegelagerer+wolf | Aufgabe D426 | müde | 61 % → 65 % | 22.3 s → 21.5 s | 75 → 74 | +3.8 | -3 % |

**Lesart.** B macht die Axt nicht schwerer, sondern anders: Das längere Aktivfenster fängt schnelle Gegner (Fuchs 20–41 %
schneller, Wolf+Fuchs −14 %), der kürzere Vorlauf kostet den müden Spieler gegen Haltung und Zweiergruppen Siege (Axtmann
müde −9/−7 Punkte, Keiler+Grathorn reinigen müde −8, Gämsen müde −6) und lässt mehr Schaden zu (Grathorn parierend 7 → 24,
Axtmann parierend 14 → 31 — die Parade kommt mit weniger Vorlauf später). Grathorn reinigen aufmerksam +63 % Zeit (28,7 →
46,6 s). Dass B das Gewicht besser zeigt, gilt nur für die Bewegung zwischen Scheitel und Durchzug (0,16 → 0,23 s, Video
0,28 s); das Ausholen wird dafür kürzer (Axthieb 0,37 → 0,30 s) — genau der Teil, an dem man im Spiel die Masse liest
(D419, Telegraf).

**Empfehlung: A übernommen** (Körper neu, Trefferfenster wie bisher). B geht sauber durch das Kampftor, aber (1) es bricht
die Regel des Waffenwerks „die Axt holt mehr als doppelt so lange aus wie die Klinge“ (ADR-0008, D180) — das wäre Flos
Entscheidung, nicht die einer Messung; (2) es zeigt das Gewicht nicht eindeutig besser (Schwung langsamer, Ausholen kürzer);
(3) es verschiebt die Balance gegen schnelle Tiere zugunsten und gegen Menschen und Paare zulasten des müden Spielers. **B bleibt
Vorschlag** (A-49). Nicht gemessen und vielleicht der physikalisch richtigere Weg: **C** — Aktiv verlängern, Vorlauf lassen
(Schlagzeit +0,03 … +0,08 s, die Axt wird langsamer, nicht nur anders verteilt); braucht eine eigene Messung.

## 6. Unklar

- **UNKLAR:** Folio der Ringeck-Glosse — die Zuordnung der ersten Wiktenauer-Spalte zu Mscr.Dresd.C.487 ist aus der
  Spaltenfolge geschlossen, nicht am Scan geprüft.
- **UNKLAR:** Ob die Source-Fassung der UAL2 einen zweihändigen Hieb enthält (`Mining`, `Sword_Heavy_A–D`) — nur
  die Namen sind gelesen, die Clips nicht angesehen.
- **UNKLAR:** Reale Spitzengeschwindigkeiten von Schwert- und Axthieben und das Gewicht eines Wurfbeils — nicht belegt.
- **UNKLAR:** Saufeder in der Jagd (Phébus fol. 94r) nicht am Bild geprüft.
- Die Messung „Fuss nah am Boden“ trennt Gleiten nicht von flachem Schritt; Urteil über Fussgleiten nur am M1 in
  Bewegung.

## 7. Bewegungen aus Videos (D430)

Flo 23.11.2026: „suche videos im Web und nimm die“ — nur frei lizenzierte (gemeinfrei, CC0, CC-BY, CC-BY-SA). Ob ein
Video benutzt werden darf, regeln die Rechte am Material und die Nutzungsbedingungen der Plattform (ADR-0013 Punkt 5,
D431); YouTube, Instagram, Vimeo und Spiel- oder Filmszenen ohne freie Lizenz sind deshalb nicht gesucht. Die Videos
liegen **nur lokal** unter `.cache/videos-d430/` (nicht im Repo); abgeleitete Schlüsselposen sind eigene Arbeit mit
Quellenangabe. **Nichts ausgeliefert:** kein Clip in `held-clips.glb`, keiner Waffe zugewiesen, kein Kampfwert berührt.

### 7.1 Suche und Quellen

Gesucht (23.11.2026) auf Wikimedia Commons (Volltextsuche `filemime:video` nach sword, fencing, longsword, axe, chopping,
spear, halberd, reenactment fight, bayonet; Kategorien Historical European martial arts, Videos of fencing, Videos of
martial arts, Videos of reenactments, Bastard swords, Wood chopping, Wood chopping sports, Wood cleaving, People with
axes) und auf Archive.org (Suche nach axe, chopping, longsword, HEMA, fencing in den Prelinger-Filmen, sword mit freier
Lizenz). Commons drosselte das Laden der Originale (HTTP 429); geladen sind die von Commons selbst erzeugten
Umwandlungen (720p/1080p/480p, dieselbe Datei, dieselbe Lizenz). Bildrate und Auflösung unten = geladene Fassung.

| Titel (Commons) | Lizenz, Urheber | Bilder/s | Auflösung | Blickwinkel | Bewegung | Eignung |
|---|---|---|---|---|---|---|
| [Wood cleaving - 2016](https://commons.wikimedia.org/wiki/File:Wood_cleaving_-_2016.webm) | CC BY-SA 4.0, Jarek Tuszyński (27.08.2015) | 29,97, **Zeitlupe** (Faktor geschätzt 4, §7.4) | 400 × 720 | seitlich (rechte Seite), ruhige Kamera, ganzer Körper | Spalten von oben, zweihändig, die obere Hand gleitet; zwei Hiebe | **gut** — bester Fund; Probeclip |
| [Wood chopping competition (standing block cut)](https://commons.wikimedia.org/wiki/File:Wood_chopping_competition_(standing_block_cut).webm) | CC BY-SA 3.0, Kerry Raymond (Ekka Brisbane, 15.08.2015) | 30 | 1280 × 720 | erhöht, schräg von hinten, Zaun davor, fünf Holzfäller | Querhiebe am stehenden Block (Wettkampf, zweihändig) | **bedingt** — Körper gut, Hände im Schlag verdeckt und unscharf |
| [Bucking, splitting and stacking logs for firewood in Kõrvemaa, Estonia (October 2022)](https://commons.wikimedia.org/wiki/File:Bucking,_splitting_and_stacking_logs_for_firewood_in_K%C3%B5rvemaa,_Estonia_(October_2022).webm) | CC BY-SA 4.0, Sillerkiil (04.10.2022) | 25 | 1280 × 720 | nah und tief, Person oft halb ausserhalb, Schnitte | Kettensäge, dann Spalten mit der Axt (ab 0:34) | **schlecht** — nur Zeitbezug in Echtzeit |
| ["IMG 8252" Hand-and-a-half sword (Bastard sword) exercises](https://commons.wikimedia.org/wiki/File:%22IMG_8252%22_Hand-and-a-half_sword_(Bastard_sword)_exercises.webm) | CC BY-SA 4.0, Kuroczynski (02.09.2023) | 29,97 | 608 × 1080 (hochkant) | erst von hinten, nach einem Schnitt seitlich; ruhig | Übungen mit dem Anderthalbhänder, beidhändig: Ober- und Querhaue in die Luft | **bedingt** — einzige freie Fechtaufnahme; Klinge klein und unscharf |
| [Jomvikings Winkinger Kampftraining](https://commons.wikimedia.org/wiki/File:Jomvikings_Winkinger_Kampftraining.webm) | CC BY-SA 3.0, HelgeRieder (02.11.2013) | 24 | 854 × 480 | Handkamera mitten in der Gruppe, Regen | Gruppenkampf (Schild, Speer, Axt) | **unbrauchbar** |
| [Batalo per glavoj en la Abalaka amuzejo](https://commons.wikimedia.org/wiki/File:Batalo_per_glavoj_en_la_Abalaka_amuzejo.webm) | CC BY-SA 4.0, RG72 (30.07.2021) | 30 | 1280 × 720 | weit weg (Figur ~60 Bildpunkte) | Schwert und Schild, Schaukampf | **unbrauchbar** |
| [Modern Sword Fighting Moscow VDNHA](https://commons.wikimedia.org/wiki/File:Modern_Sword_Fighting_Moscow_VDNHA.webm) | CC BY 4.0, Predatorsamsung (18.08.2025) | 59 | 270 × 480 | weit, Zuschauer davor | Rollenspiel-Schaukampf | **unbrauchbar** |

**Nicht genommen:** *Felling a tree* (Commons, CC BY-SA 4.0) — Kettensäge; *Wood Chopping* (Commons, CC0, Uganda) —
laut Beschreibung Kettensäge, nicht angesehen; *Cutting down an uprooted tree…* — Säge; *Renaissance Martial Arts – the
Web Documentary* (Archive.org) — CC BY-ND 3.0, „keine Bearbeitungen“ ist keine der erlaubten Lizenzen; *Akademia
Szermierzy … medieval longsword techniques* (Archive.org) — keine Lizenzangabe; Ausbildungsfilme der US-Armee mit
Bajonettdrill (Commons, 1939/1943, Werke der US-Streitkräfte) — andere Waffe, nicht als Saufeder genommen; *Hand Tools for Wildfire*
(US Forest Service, 1970er) — nur über einen kostenpflichtigen Archivhändler; einen Axt-Lehrfilm des US Forest Service
führt der Katalog der National Agricultural Library (16 mm), ein Digitalisat war nicht zu finden.

**Je Waffe:**

| Waffe | Freie Videos | Bemerkung |
|---|---|---|
| Fällaxt (zweihändig) | Spalten (gut), Standing Block (bedingt), Kõrvemaa (schlecht) | Spalten ist ein Hieb von oben auf einen Block in Kniehöhe — näher am Spalthieb (`Axt_Schwer`) als am Fällhieb |
| Langes Messer | **keins** | Ersatzweise der Anderthalbhänder (zweihändig wie unser Messer seit D414, A-43 (1) offen); ein Messer führt sich anders (eine Schneide, kürzer) |
| Klinge (Seitschwert, einhändig) | **keins** brauchbar | Abalak: Schwert und Schild, zu weit |
| Saufeder | **keins** | Nur Bajonettdrill (andere Waffe) — nicht ausgewichen |
| Hirschfänger | **keins** | — |

### 7.2 Kette (`tools/videoposen.py`, nicht im Gate)

Video (OpenCV) → MediaPipe PoseLandmarker *heavy* (Apache 2.0, CPU, ~12 Bilder/s auf diesem Rechner) → 33 Punkte je
Bild in 2D und als 3D-Weltschätzung → Median über 3 Bilder und Savitzky–Golay (5) → **Füsse am Boden**: MediaPipe
legt jedes Bild auf die Hüftmitte; die Verschiebung des Körpers wird aus dem Fuss zurückgerechnet, der im Bild stillsteht
→ Körperachsen aus der Ruhe, vertauschte Seiten (Ansicht von hinten) über die Zehen erkannt, Linkshänder gespiegelt →
Maßstab je Glied auf die Wanderin (Becken und Füsse nach Beinlänge, ihr Rumpf, Arme nach Armlänge von ihren
Schultern aus) → Phasen aus dem Tempo der Hände **im Bild** (Ausholbeginn, Ausholspitze, Scheitel als Umkehrpunkt,
schnellstes Bild, Durchzug = letztes Bild ≥ 50 %, Halt < 20 %) → Schlüsselposen im Format der Posenfelder
(`hand`, `richt`, `zwei`, `griff`, `rumpf`, `huefte`, `koerper`, `fuss_l`/`fuss_r`, `pol`/`pol_l`; Ramer–Douglas–Peucker,
≤ 5 cm) in 24 Bildern/s Echtzeit. **Waffe nach Regel:** zwei sichtbare Hände geben die Achse; ist die ferne Hand verdeckt,
gilt die Armflucht. Bei der Axt (`--regel`) folgen Stielwinkel und Griff dem Forsthandbuch (D429): angewinkelt beim
Ausholen, spät gelöst im Schlag, im Durchzug in der Armflucht; `griff` −0,42 → −0,62 → −0,11. Bau des Probeclips:
`PROBE=<name.json>:<Clip>` in `tools/clipnachbau.py`, dann `clipnachbau.mjs einfuegen` in eine **Kopie**,
`kontaktbogen.py`. MediaPipe braucht zum Laden `libEGL`/`libGLESv2`; ohne Grafiktreiber genügen leere
Ersatzbibliotheken (Docstring des Werkzeugs).

### 7.3 Was die Erkennung leistet — gemessen

| Video | Person erkannt | Zittern in Ruhe (Hand, 3D / 2D) | Unterarm in 3D (5.–95. Perzentil; ein starrer Knochen) | Handhöhe 2D minus 3D | Ferne Hand verdeckt (Sichtbarkeit < 0,5) |
|---|---|---|---|---|---|
| Spalten | 245 / 245 Bilder | 1,1 cm / 0,3 px | 17–26 cm | −8 … +27 cm | 55 % der Bilder |
| Standing Block | 421 / 421 | 0,2 cm / 0,1 px | 15–26 cm | −10 … +1 cm | 98 % |
| Anderthalbhänder | 539 / 539 | 0,8 cm / 1,1 px | 19–25 cm | −9 … +102 cm (Schnitt, Ansicht von hinten) | 69 % |

### 7.4 Vergleich mit unseren Clips

Bilder bei 24/s; Bestand aus `tools/waffenclips.py` gelesen (`videoposen.py vergleich`), Video aus den Schlüsselposen.
`huefte` und Schultern in Grad wie die Posenfelder; Becken vor = Spanne von `koerper` v, auf/ab = Spanne von `koerper` h.

| Clip | Scheitel / Durchzug | Ausholen | Schlag (Scheitel→Durchzug) | Nachschwung | `huefte` ° | Schultern ° | Becken vor (m) | Becken auf/ab (m) | Füsse |
|---|---|---|---|---|---|---|---|---|---|
| `Axt_Hieb` (D429) | 12 / 16 | 11 Bilder (0,46 s) | 4 Bilder (0,17 s) | bis Bild 29 (Halt 72 %) | −6 … 12 | −30 … 8 | −0,04 … 0,12 | 0,18 tiefer | stehen ab dem Scheitel |
| `Axt_Schwer` (D429) | 20 / 25 | 19 (0,79 s) | 5 (0,21 s) | endet am Boden | 0 … 8 | −10 … 0 | −0,09 … 0,16 | 0,25 tiefer | stehen |
| **Spalten** (Hieb 2, Zeitlupe ×4) | 16 / 23 | 15 (0,63 s) | **7 (0,28 s)** | 0,03 s — das Holz hält die Axt an | −16 … 23 | −35 … 59 ¹ | **−0,21 … 0,22** | **0,30** (+0,08 aufgerichtet im Scheitel, −0,21 im Treffen) | stehen (≤ 11 cm, Messfehler), 0,32 m auseinander; Rumpf bis **68°** vor |
| `Axt_Quer` (D429) | 10 / 15 | 9 (0,38 s) | 5 (0,21 s) | 86°, Halt 73 % | −8 … 14 | −50 … 55 | −0,04 … 0,14 | 0,13 tiefer | linker Fuss tritt vor |
| Standing Block (Hieb 2) ² | 33 / 37 | 32 (1,33 s) | 4 (0,17 s) | 0,37 s | −54 … −26 | −37 … −16 | −0,30 … −0,23 | 0,02 | Ausfallstellung 0,88 m vor/zurück, stehen |
| `Messer_Quer_A` (D414/D420) | 9 / 13 | 8 (0,33 s) | 4 (0,17 s) | 82°, ab Bild 23 zurück | −8 … 14 | −48 … 56 | −0,04 … 0,17 | 0,14 tiefer | linker Fuss tritt vor |
| `Messer_Schwer` | 12 / 17 | 11 (0,46 s) | 5 (0,21 s) | endet am Boden | 0 | −12 … 0 | −0,06 … 0,19 | 0,25 tiefer | linker Fuss tritt vor |
| Anderthalbhänder (Hieb 13, Querhau) ³ | 15 / 25 | 14 (0,57 s) | 10 (0,43 s) | 0,1 s | −6 … 42 | 13 … 69 | −0,02 … 0,14 | 0,04 | Schrittstellung ~0,8 m, stehen |

¹ Seitenansicht: Die Schulterlinie liegt in der Bildtiefe, ihre Drehung schätzt die 3D-Erkennung schlecht (94° Spanne in
einem geraden Hieb von oben ist nicht glaubhaft). ² Hände in 98 % der Bilder verdeckt, die Phasen sind nicht verlässlich
(Spitzentempo 1–3 m/s — die Unschärfe verschluckt den Schlag). ³ Übung in die Luft, langsam; kein Kampftempo.

**Lesart.** (1) **Timing:** Das Spalten braucht vom Scheitel bis zum Durchzug 7 Bilder (0,28 s) gegen 4 bei `Axt_Hieb`
und holt 4 Bilder länger aus. Das stützt den Vorschlag aus §5.1 (Physik: Aktiv 0,23 s statt Regel 0,16 s) — mit dem
Vorbehalt, dass der Zeitlupenfaktor geschätzt ist (Faktor 3–5 gäbe 0,21–0,35 s; **UNKLAR**). Kampfwerte bleiben, wie sie
sind (D423). (2) **Körper:** Im Video arbeitet der ganze Körper viel mehr als in unseren Clips — das Becken fällt 30 cm
vom Scheitel zum Treffen, der Rumpf beugt sich bis 68° vor, das Becken bewegt sich über 0,43 m (**D452:** vom Scheitel zum
Treffen geht es **zurück**, der Schwerpunkt wandert über das Vorbeugen — §5.2); `Axt_Hieb`: 18 cm, 32°,
0,16 m. Teils liegt das am Ziel (Spaltblock in Kniehöhe, Fällkerbe in Hüfthöhe), teils ist es genau das, was D419
(Gewicht sichtbar) verlangt. (3) **Füsse:** stehen im Video während des Hiebs (USFS und D429 bestätigt); im Scheitel
richtet sich der Körper auf (+8 cm), statt sich hinten hineinzulegen. (4) **Hüftdrehung:** aus einer Kamera nicht
verlässlich messbar (¹); ob die Hüfte vor den Schultern dreht, ist aus diesen Videos **nicht** belegt.

### 7.5 Probeclip und Prüfbilder

**`Axt_Video_cleaving_2`** — aus Hieb 2 des Spaltvideos, 27 Bilder (1,13 s), 21 Schlüssel, Scheitel 16 / Durchzug 23,
Grundhaltung `Idle`, Waffe nach Regel (`--regel`). Gebaut mit `PROBE=` über `clipnachbau.py` auf die Hauptfigur:
Klinge ≤ 3° neben `richt`; die rechte Hand trifft ihr Ziel bis Bild 25 auf ≤ 3 cm, in Bild 26–27 (tiefstes Bücken)
bis 8 cm daneben; die linke Hand liegt bis 25 cm neben der Stielachse, wo die Regel den Stiel anders legt, als der Arm
der Figur reicht. Nur in einer Kopie von `held-clips.glb` (786 → 809 KB, Ruhelagen 66 Knoten gleich), **nicht**
eingefügt, keiner Waffe zugewiesen. Datei `.cache/bilder/D430/probe_axt_video_cleaving_2.glb`. Zwei weitere Proben
nur für die Bilder: `Axt_Video_standingblock_2`, `Messer_Video_langschwert_13`.

Prüfbilder (Formprüfung in Blender Cycles, keine Look-Abnahme, Bewegung nur am M1 — ADR-0005; je Spalte oben das
Videobild mit erkanntem Skelett, in der Mitte die 3D-Schätzung von der Seite mit der Waffe nach Regel, unten der
Probeclip auf unserer Figur): `.cache/bilder/D430/axt_spalten_kontakt.png`, `.cache/bilder/D430/axt_quer_kontakt.png`,
`.cache/bilder/D430/messer_langschwert_kontakt.png`; dazu der Bestand mit derselben Kamera:
`.cache/bilder/D430/bestand_axt_hieb_kontakt.png`, `.cache/bilder/D430/bestand_axt_quer_kontakt.png`,
`.cache/bilder/D430/bestand_messer_quer_kontakt.png`. Kein Vorher/Nachher-Paar, weil im Spiel nichts geändert ist.
Im Spaltbogen folgt die Figur dem Video in Absenken, Aufrichten im Scheitel, Vorbeugen im Treffen; Querhieb und
Anderthalbhänder zeigen eine stimmige Stellung, aber keine brauchbare Waffenführung.

### 7.6 Bewertung — ehrlich

- **2D gut, 3D schwach.** Die Person wird in jedem Bild gefunden, das 2D-Skelett sitzt. Die 3D-Schätzung aus einer
  Kamera schwankt in der Tiefe: Ein starrer Unterarm misst 17–26 cm (±20 %), die Handhöhe weicht über dem Kopf bis
  27 cm vom Bild ab, die Schulterdrehung in der Seitenansicht ist nicht zu gebrauchen. In Ruhe zittert es kaum (≤ 1 cm);
  das Problem ist die Tiefe, nicht das Zittern.
- **Bewegungsunschärfe.** Bei 30 Bildern/s springt das Treffbild (einzelne Bilder 2–3× schneller als die Nachbarn); das
  Spitzentempo ist nicht messbar (Spalten mit Faktor 4: 19 m/s — Artefakt; Standing Block 1–3 m/s — verschluckt). Die
  Phasengrenzen stimmen auf ±1 Bild (33 ms) — für Ausholen und Halt genug, für einen Schlag von 4–7 Bildern grob.
- **Die verdeckte Hand.** Von der Seite oder von hinten ist die ferne Hand in 55–98 % der Bilder verdeckt; MediaPipe
  rät sie. Damit fehlt die zweite Hand für die Waffenachse, und die Fingerpunkte (Hand ~20 Bildpunkte) lagen bis 125°
  neben der wahren Stielrichtung. **Die Waffe ist reine Regel** — plausibel, aber erfunden.
- **Was die Kette kann:** die Körperlinie realer Menschen — Gewichtsverlagerung, Absenken, Rumpfneigung, Fussstellung
  und der Rhythmus Ausholen/Pause/Schlag/Halt. Genau das fehlt unseren Clips (§5, D419).
- **Lohnt sie gegenüber Fechtbuch + Hand?** Als **Ergänzung ja** — für Körper und Timing einer Bewegung, für die es ein
  gutes freies Video gibt (je Video etwa eine Stunde mit Prüfung). Als **Ersatz nein**: Für Langes Messer, Klinge,
  Saufeder und Hirschfänger gibt es kein freies Video, die Waffe fehlt, und Tiefen- und Seitenfehler müssen von Hand
  korrigiert werden. Fechtbuch und Forsthandbuch bleiben die Vorlage für Stellung und Waffenführung.
- **Reicht das für die Messlatte D432 (Dawnwalker, Soulframe, For Honor)? Nein.** Gewicht, Lesbarkeit des Ausholens,
  Fluss zwischen Hieben und Richtungsführung leben dort von sauber erfasster Bewegung samt Waffe (optisches Motion
  Capture mit vielen Kameras, hohe Bildrate) und von Hand nachgearbeiteten Übergängen. Eine Kamera mit 30 Bildern/s ohne
  Waffe liefert das nicht. Was es bräuchte: **eigene Aufnahmen** — eine Person, Übungswaffen in Länge und Gewicht
  unserer Modelle mit zwei Farbmarken am Ende und an der Spitze, **2–3 Kameras** (seitlich, vorn, schräg) mit ≥ 120
  Bildern/s und gemeinsamem Startsignal; dann Triangulation statt Schätzung (Tiefe und verdeckte Hand gelöst, Waffe aus
  den Marken). Freie Werkzeuge dafür gibt es; ihre Lizenzen sind in dieser Arbeit **nicht geprüft** (**UNKLAR**). Ein
  besseres 3D-Verfahren aus einer Kamera löst die Waffe nicht und braucht oft Körpermodelle mit nicht-kommerzieller
  Lizenz (nicht im Einzelnen geprüft).

### 7.7 Unklar (D430)

- **UNKLAR:** Zeitlupenfaktor des Spaltvideos — geschätzt 4 (120 Bilder/s, aus der Dauer des Abwärtsschwungs, real
  ~0,3 s); 8 (240 Bilder/s) gäbe einen Schlag von 0,14 s. Ein Messpunkt (Fallzeit eines Scheits) fehlt.
- **UNKLAR:** Lizenzen freier Mehrkamera-Werkzeuge (Triangulation) — nicht geprüft.
- Die Phasenerkennung braucht Hilfe (`--abwaerts`, `--hiebe`, `--ausschnitt`), sobald mehrere Personen im Bild sind oder
  der Mensch zwischen den Hieben umhergeht (Kõrvemaa: 13 „Hiebe“, die meisten Gehen und Holz Legen).
