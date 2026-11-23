"""
BRACHLAND — Waffenclips (D171, ADR-0008 Nachtrag): ein Moveset je Waffe auf dem Rig der Wanderin.

Das Paket hat einen Waffenschlag (`Sword_Slash`) und eine Schwerthaltung (`Idle_Sword`). Die Gattung
(Elden Ring, Soulframe) lebt davon, dass jede Waffe **anders** schlägt: leichte Kette, schwerer Hieb,
Laufangriff. Fremde Clips scheitern an ADR-0002; also werden sie hier gebaut, wie der Axthieb (D169) —
aber nicht mehr aus Richtungen je Knochen, sondern aus dem, was man sieht:

  * **Hand und Waffe**: Wo ist die Hand (Meter, rechts/vorn/hoch vom Standpunkt), wohin zeigt die
    Waffe. Der Arm folgt über eine Zwei-Knochen-IK mit Ellbogenpol; das Handgelenk wird so gedreht,
    dass die Klinge (Knochen −X, wie `WAFFE_AN_HAND` in `RegionsSzene.tsx`) dorthin zeigt und die
    Schneide (Knochen +Y, Finger) in Bewegungsrichtung — die Schneide führt.
  * **Rumpf**: Drehung um die Hochachse (+ = rechte Schulter vor) und Neigung (+ = vor), verteilt
    über Hüfte, Bauch, Brust; der Kopf dreht gegen, der Blick bleibt beim Gegner.
  * **Körper und Füsse**: Schwerpunkt vor/runter, ein Fuss vor — die Beine per IK, Knie nach vorn.
    Ein Hieb aus dem Stand sieht aus wie ein Wedeln; der Schritt hinein macht ihn schwer.
  * **Zweihändig**: Die linke Hand greift an den Stiel oder an den Knauf. D429: An der Fällaxt sitzt sie **fest am
    Stielende** (USDA Forest Service, *An Ax to Grind*, 1999), die rechte gleitet: beim Ausholen ¾ den Stiel hinauf
    zum Kopf, im Schlag zurück, im Treffen liegen beide Hände am Ende. Posenfeld `griff` = wo die linke Hand entlang
    des Stiels von der rechten aus sitzt (Meter, negativ = zum Stielende hin).

D456: Zwischen den Schlüsseln wird **jedes Bild** aus den Posenfeldern gerechnet (Bögen, Überlappung, stehende Füsse —
siehe „Zwischenbilder“ vor `baue_clip`); jede Waffe hat eine Hut, in der ihre Clips beginnen und enden. Marken für
Übergänge und Ketten: `content/clipmarken.json`; gemessen wird an der ausgelieferten Datei in `tests/clipguete.test.ts`.

D460: Die **Fortbewegung** (Gang, Laufschritt, Sprint, Anlauf, Abstoppen, Wenden, Rolle, Sprung, Klettern, Schwimmen) ist
kein Satz von Schlüsseln, sondern je Bild gerechnet — Abschnitt „D460: Fortbewegung“ weiter unten (`RECHNE`).

Jedes Bild setzt alle Knochen (three.js lässt ungenannte stehen), Quaternionen werden auf
Stetigkeit gedreht (q und −q sind dieselbe Drehung, aber nicht für Blenders Interpolation je
Komponente), und kein Abschnitt dreht einen Knochen über ~100°.

Die Zeiten `hieb: { scheitel, durchzug }` in `src/kampf/echtzeit.ts` sind die Bilder hier / 24.
Wer ein Bild verschiebt, zieht dort nach — `tests/waffenclips.test.ts` prüft beides gegeneinander.
"""
import math
import bpy
from mathutils import Vector, Matrix

# Name → (Grundhaltung, Schlüssel). Ein Schlüssel: Bild und Pose. Pose-Felder (alle optional):
#   hand (r, v, h)      Handgelenk rechts, Meter vom Standpunkt   richt (r, v, h) Klinge/Stiel
#   zwei                linke Hand an die Waffe                   links (r, v, h) linke Hand frei
#   rumpf (dreh, neig)  Grad                                       koerper (v, h)  Meter
#   fuss_r / fuss_l (v, r)  Meter
#   (bis D455 gab es `pol`, den Ellbogenpol je Schlüssel — seit D456 folgt der Ellbogen dem Feld `_pol`)
#   huefte              Grad, Becken dreht vor der Brust (D414: die Hüfte führt den Schlag)
#   griff               D429, Axt: linke Hand entlang des Stiels von der rechten aus, Meter (negativ = zum Ende)
# 'stand' heisst: die Grundhaltung unverändert.
KLINGE_BASIS = 'Klinge_Stand'
HIRSCH_BASIS = 'Hirsch_Stand'
CLIPS = {
    # D456 — die Klinge (Seitschwert, einhändig, 1,1 kg): Hut ist der **Pflug rechts** der Liechtenauer-Tradition
    # (Ringeck-Glosse; Waffenbewegungen §4.2): Gehilz über der rechten Hüfte, Ort zum Gesicht des Gegners, **linker
    # Fuss vor** (Widerspruch 6 — bis D455 stand der rechte vor). Die freie Hand steht als Deckung vor der Brust (bei
    # Lecküchner läge sie auf dem Rücken; vorn ist sie bereit zum Greifen, D417) und arbeitet in jedem Hieb als
    # Gegengewicht mit.
    'Klinge_Stand': ('Idle', 'schleife', [
        (1, dict(hand=(0.22, 0.28, 1.08), richt=(-0.2, 0.72, 0.66), rumpf=(-16, 5), koerper=(0, -0.07),
                 fuss_l=(0.16, -0.03), fuss_r=(-0.13, 0.05), links=(-0.18, 0.24, 1.12))),
        (25, dict(hand=(0.22, 0.29, 1.06), richt=(-0.2, 0.74, 0.64), rumpf=(-17, 7), koerper=(0, -0.085),
                  fuss_l=(0.16, -0.03), fuss_r=(-0.13, 0.05), links=(-0.18, 0.25, 1.1))),
        (49, dict(hand=(0.22, 0.28, 1.08), richt=(-0.2, 0.72, 0.66), rumpf=(-16, 5), koerper=(0, -0.07),
                  fuss_l=(0.16, -0.03), fuss_r=(-0.13, 0.05), links=(-0.18, 0.24, 1.12))),
    ]),
    # D456: Oberhau von der rechten Schulter (Zornhau, Ringeck fol. 18r ff.) **mit dem Schritt des rechten Fusses** —
    # ersetzt `Klinge_U_A` (UAL2: Schulterlinie dreht ±178°, Ausfall 30 cm, kein Nachschwung; Widerspruch 7). Ausholen:
    # Klinge an die rechte Schulter (Gegenbewegung nach hinten, die freie Hand zeigt zum Ziel), der rechte Fuss setzt
    # vor und steht ab dem Scheitel; die Hüfte dreht vor der Brust, das Gewicht wandert 20 cm auf den vorderen Fuss.
    # Nachschwung 46° nach links unten (Soll `gewicht.ts` 17,5°), Halt bis 53 % der Erholung (Soll 47 %).
    'Klinge_Hieb_A': (KLINGE_BASIS, 'einmal', [
        (1, 'stand'),
        (3, dict(hand=(0.32, 0.12, 1.36), richt=(0.3, -0.15, 0.94), rumpf=(-22, 0), koerper=(-0.03, -0.02),
                 links=(-0.14, 0.36, 1.2))),
        (6, dict(hand=(0.34, -0.02, 1.5), richt=(0.35, -0.6, 0.72), rumpf=(-36, -3), huefte=12, koerper=(0.0, -0.03),
                 fuss_r=(0.44, 0.02), links=(-0.1, 0.42, 1.25))),
        (8, dict(hand=(0.12, 0.5, 1.36), richt=(0.1, 0.85, 0.5), rumpf=(8, 8), huefte=8, koerper=(0.14, -0.07),
                 fuss_r=(0.44, 0.02), links=(-0.26, 0.15, 1.1))),
        (9, dict(hand=(-0.12, 0.5, 1.08), richt=(-0.45, 0.85, -0.25), rumpf=(30, 12), huefte=2, koerper=(0.2, -0.1),
                 fuss_r=(0.44, 0.02), links=(-0.34, -0.02, 1.02))),
        (12, dict(hand=(-0.3, 0.3, 0.92), richt=(-0.7, 0.25, -0.67), rumpf=(42, 14), huefte=-6, koerper=(0.22, -0.12),
                  fuss_r=(0.44, 0.02), links=(-0.38, -0.12, 1.0))),
        (18, dict(hand=(-0.26, 0.3, 0.95), richt=(-0.62, 0.35, -0.7), rumpf=(36, 12), huefte=-3, koerper=(0.19, -0.1),
                  fuss_r=(0.44, 0.02), links=(-0.34, -0.08, 1.02))),
        (26, 'stand'),
    ]),
    # D456: Rückhand von links nach rechts (Mittelhau von der linken Seite), der vordere linke Fuss rückt eine
    # Fusslänge vor — ersetzt `Klinge_U_B`. Ausholen über den Leib an die linke Schulter (der Arm kreuzt, die freie
    # Hand weicht nach unten aus), dann öffnet die Hüfte nach rechts, die freie Hand schwingt als Gegengewicht vor.
    'Klinge_Hieb_B': (KLINGE_BASIS, 'einmal', [
        (1, 'stand'),
        (3, dict(hand=(-0.12, 0.22, 1.2), richt=(-0.6, 0.1, 0.79), rumpf=(18, 2), koerper=(-0.03, -0.03),
                 links=(-0.24, 0.1, 1.05))),
        (6, dict(hand=(-0.22, 0.12, 1.3), richt=(-0.72, -0.5, 0.48), rumpf=(36, 0), huefte=-12, koerper=(0.0, -0.04),
                 fuss_l=(0.22, -0.02), links=(-0.3, 0.0, 1.0))),
        (8, dict(hand=(0.1, 0.5, 1.25), richt=(-0.1, 0.95, 0.3), rumpf=(4, 6), huefte=-8, koerper=(0.1, -0.07),
                 fuss_l=(0.22, -0.02), links=(-0.3, 0.12, 1.08))),
        (9, dict(hand=(0.4, 0.38, 1.15), richt=(0.62, 0.75, -0.2), rumpf=(-28, 10), huefte=-2, koerper=(0.15, -0.09),
                 fuss_l=(0.22, -0.02), links=(-0.24, 0.3, 1.15))),
        (12, dict(hand=(0.5, 0.1, 1.08), richt=(0.8, 0.1, -0.59), rumpf=(-42, 12), huefte=6, koerper=(0.17, -0.11),
                  fuss_l=(0.22, -0.02), links=(-0.16, 0.38, 1.2))),
        (19, dict(hand=(0.46, 0.14, 1.08), richt=(0.72, 0.2, -0.66), rumpf=(-36, 10), huefte=3, koerper=(0.14, -0.09),
                  fuss_l=(0.22, -0.02), links=(-0.18, 0.34, 1.18))),
        (28, 'stand'),
    ]),
    # Stich aus dem Pflug: zurückziehen an die Hüfte (Gegenbewegung, Gewicht hinten), der vordere linke Fuss fällt aus
    # und steht ab dem Scheitel, dann treibt das hintere Bein den Körper hinterher; die freie Hand fliegt als
    # Gegengewicht zurück. D456: gestreckt gehalten bis Bild 16 (nicht sofort zurück), Rückweg ab Bild 22 (53 %).
    'Klinge_Stich': (KLINGE_BASIS, 'einmal', [
        (1, 'stand'),
        (5, dict(hand=(0.26, 0.06, 1.1), richt=(-0.08, 0.99, 0.12), rumpf=(-26, 0), koerper=(-0.05, -0.03),
                 links=(-0.12, 0.34, 1.2))),
        (9, dict(hand=(0.28, -0.08, 1.12), richt=(-0.05, 1, 0.06), rumpf=(-36, -3), huefte=10, koerper=(-0.03, -0.05),
                 fuss_l=(0.3, -0.01), links=(-0.1, 0.4, 1.25))),
        (11, dict(hand=(0.16, 0.42, 1.24), richt=(-0.02, 1, 0.02), rumpf=(0, 10), huefte=6, koerper=(0.14, -0.1),
                  fuss_l=(0.3, -0.01), links=(-0.24, 0.1, 1.1))),
        (13, dict(hand=(0.06, 0.8, 1.26), richt=(0, 1, 0), rumpf=(30, 18), koerper=(0.26, -0.14),
                  fuss_l=(0.3, -0.01), links=(-0.34, -0.2, 1.05))),
        (16, dict(hand=(0.07, 0.83, 1.25), richt=(0, 1, -0.02), rumpf=(28, 18), koerper=(0.27, -0.15),
                  fuss_l=(0.3, -0.01), links=(-0.33, -0.18, 1.05))),
        (22, dict(hand=(0.16, 0.5, 1.16), richt=(-0.06, 0.98, 0.2), rumpf=(8, 10), koerper=(0.14, -0.08),
                  fuss_l=(0.3, -0.01), links=(-0.24, 0.1, 1.1))),
        (30, 'stand'),
    ]),
    # D456: schwerer Hieb von oben mit beiden Händen (die Regel nennt ihn „Zweihandhieb“) — ersetzt `Klinge_U_C` (UAL2:
    # Sprung, Gewicht bis 3,5 Fusslängen vor dem vorderen Fuss). Die linke Hand kommt beim Ausholen an den Knauf
    # (`beide`), der rechte Fuss setzt mit dem Scheitel weit vor; im Scheitel ist der Körper aufgerichtet, dann klappt
    # er in der Hüfte vor (wie `Messer_Schwer`), die Beine fangen die Masse.
    'Klinge_Schwer': (KLINGE_BASIS, 'einmal', [
        (1, 'stand'),
        (5, dict(hand=(0.2, 0.2, 1.3), richt=(0.05, 0.2, 0.98), rumpf=(-10, 0), koerper=(-0.03, -0.03), beide=True)),
        (10, dict(hand=(0.16, 0.02, 1.62), richt=(0.1, -0.45, 0.89), rumpf=(-16, -6), koerper=(-0.06, 0.0), beide=True)),
        (14, dict(hand=(0.14, -0.04, 1.66), richt=(0.08, -0.75, 0.66), rumpf=(-18, -8), huefte=8, koerper=(-0.04, 0.01),
                  fuss_r=(0.46, 0.02), beide=True)),
        (16, dict(hand=(0.08, 0.36, 1.52), richt=(0, 0.9, 0.44), rumpf=(-4, 10), huefte=6, koerper=(0.1, -0.07),
                  fuss_r=(0.46, 0.02), beide=True)),
        (18, dict(hand=(0.03, 0.56, 1.0), richt=(0, 0.62, -0.78), rumpf=(8, 30), koerper=(0.2, -0.2),
                  fuss_r=(0.46, 0.02), beide=True)),
        (22, dict(hand=(0.02, 0.54, 0.8), richt=(0, 0.8, -0.6), rumpf=(8, 36), koerper=(0.22, -0.25),
                  fuss_r=(0.46, 0.02), beide=True)),
        (29, dict(hand=(0.05, 0.48, 0.84), richt=(0.02, 0.76, -0.65), rumpf=(6, 32), koerper=(0.2, -0.23),
                  fuss_r=(0.46, 0.02), beide=True)),
        (40, 'stand'),
    ]),
    # D456: Laufstich — ersetzt `Klinge_U_Lauf`. Beginnt nicht in der Hut, sondern in der Anlaufpose (die Figur kommt
    # aus dem Lauf; `content/clipmarken.json` `beginn: "anlauf"`), endet in der Hut. Der rechte Fuss fällt weit aus.
    'Klinge_Lauf': (KLINGE_BASIS, 'einmal', [
        (1, dict(hand=(0.28, 0.0, 1.12), richt=(-0.04, 0.99, 0.1), rumpf=(-24, 10), koerper=(0.04, -0.04),
                 links=(-0.16, 0.3, 1.2))),
        (4, dict(hand=(0.3, -0.1, 1.14), richt=(-0.03, 1, 0.06), rumpf=(-34, 8), huefte=10, koerper=(0.08, -0.05),
                 links=(-0.12, 0.4, 1.25))),
        (7, dict(hand=(0.28, -0.06, 1.16), richt=(-0.02, 1, 0.04), rumpf=(-34, 10), huefte=14, koerper=(0.16, -0.08),
                 fuss_r=(0.62, 0.0), links=(-0.1, 0.42, 1.25))),
        (9, dict(hand=(0.14, 0.5, 1.24), richt=(0, 1, 0.02), rumpf=(4, 18), huefte=6, koerper=(0.32, -0.14),
                 fuss_r=(0.62, 0.0), links=(-0.26, 0.1, 1.1))),
        (11, dict(hand=(0.05, 0.86, 1.24), richt=(0, 1, -0.02), rumpf=(32, 24), koerper=(0.42, -0.19),
                  fuss_r=(0.62, 0.0), links=(-0.36, -0.24, 1.02))),
        (15, dict(hand=(0.06, 0.9, 1.22), richt=(0, 1, -0.04), rumpf=(30, 24), koerper=(0.43, -0.2),
                  fuss_r=(0.62, 0.0), links=(-0.35, -0.22, 1.02))),
        (21, dict(hand=(0.16, 0.56, 1.16), richt=(-0.06, 0.98, 0.18), rumpf=(10, 12), koerper=(0.28, -0.12),
                  fuss_r=(0.62, 0.0), links=(-0.24, 0.08, 1.1))),
        (30, 'stand'),
    ]),
    # D456: Deckung der Klinge aus Schlüsselbildern (hängende Versatzung: Gehilz hoch rechts, Klinge schräg vor Kopf
    # und linker Schulter) — beginnt in der Hut, gehalten wird das letzte Bild. Noch nicht verdrahtet: `BLOCKCLIP` in
    # `RegionsSzene.tsx` spielt weiter `Klinge_U_Block` (UAL2).
    'Klinge_Block': (KLINGE_BASIS, 'einmal', [
        (1, 'stand'),
        (4, dict(hand=(0.24, 0.3, 1.34), richt=(-0.7, 0.2, 0.68), rumpf=(-8, 4), koerper=(-0.03, -0.03),
                 links=(-0.14, 0.26, 1.2))),
        (8, dict(hand=(0.25, 0.32, 1.38), richt=(-0.74, 0.2, 0.64), rumpf=(-8, 6), koerper=(-0.04, -0.05),
                 links=(-0.12, 0.28, 1.22))),
    ]),
    # D429: Zweihand-Fällaxt in der Hut — linke Hand am Stielende vor der linken Hüfte, rechte vorn am Stiel, der Kopf
    # oben rechts vor der Schulter; linker Fuss eine Handbreit vor (Rechtshänder, wie die Leger der Fechtbücher).
    'Axt_Stand': ('Idle', 'schleife', [
        (1, dict(hand=(0.12, 0.32, 1.18), richt=(0.53, 0.48, 0.7), zwei='axt', griff=-0.42, rumpf=(-10, 3),
                 koerper=(0, -0.04), fuss_l=(0.14, -0.02), fuss_r=(-0.08, 0.04))),
        (25, dict(hand=(0.12, 0.33, 1.16), richt=(0.53, 0.5, 0.68), zwei='axt', griff=-0.42, rumpf=(-11, 5),
                  koerper=(0, -0.055), fuss_l=(0.14, -0.02), fuss_r=(-0.08, 0.04))),
        (49, dict(hand=(0.12, 0.32, 1.18), richt=(0.53, 0.48, 0.7), zwei='axt', griff=-0.42, rumpf=(-10, 3),
                  koerper=(0, -0.04), fuss_l=(0.14, -0.02), fuss_r=(-0.08, 0.04))),
    ]),
    # D173: Axtblock — der Stiel quer vor der Brust, beide Hände weit auseinander (D429: links am Ende, rechts vorn,
    # der Kopf rechts), Gewicht tief. Gehalten wird das letzte Bild (die Szene klemmt den Clip), deshalb endet er
    # nicht im Stand.
    'Axt_Block': ('Axt_Stand', 'einmal', [
        (1, 'stand'),
        (4, dict(hand=(0.3, 0.3, 1.38), richt=(0.95, 0.1, 0.3), zwei='axt', griff=-0.6, rumpf=(-6, 4), koerper=(-0.03, -0.06))),
        (8, dict(hand=(0.32, 0.32, 1.42), richt=(0.96, 0.1, 0.25), zwei='axt', griff=-0.6, rumpf=(-6, 6), koerper=(-0.04, -0.08))),
    ]),
    # D429 — die Fällaxt nach dem Forsthandbuch (USDA Forest Service, *An Ax to Grind*, 1999, Abb. 76–79): Die linke Hand
    # bleibt am Stielende, die rechte gleitet beim Ausholen ¾ hinauf zum Kopf (`griff` −0,62) und im Schlag zurück zur
    # linken (`griff` −0,11: beide Hände am Ende im Treffen); ausgeholt wird über die rechte Schulter. Die Hüfte führt
    # (`huefte` in Schlagrichtung, während die Brust noch zurück ist), das Gewicht wandert nach vorn (`koerper` v), die
    # Füsse stehen vom Scheitel bis zum Durchzug (USFS: keine Schritte im Hieb). Nachschwung nach D420 (`gewicht.ts`,
    # Axt nach D429: ≥ 44° weiter, Halt ≥ 67 % der Erholung): Der Kopf läuft weiter, das Becken bremst, die Beine fangen die Masse.
    # Die Schneide führt: Das Handgelenk wird nach der Bahn des **Kopfs** gedreht, nicht nach der der Hand (`_kopfbahn`).
    # Bilder (Clipdauer, Scheitel, Durchzug) wie vor D429 — es sind die Trefferfenster (`content/waffen/axt.json`).
    #
    # Axthieb von oben (ersetzt `Axe_Overhead`, D169: einhändig, Rumpf still, Nacken voran — D428 §5 Nr. 3).
    # D452 nach dem Spaltvideo (D430 §7.4): Der linke Fuss setzt beim Ausholen eine Handbreit weiter vor und steht, das
    # Gewicht liegt im Scheitel hinten und der Körper richtet sich auf (+4 cm über der Hut), dann klappt er in der Hüfte
    # nach vorn: Becken 29 cm hinunter, Rumpf bis 51° vor (Hut + Pose; Video 68° — das Spalten zielt auf Kniehöhe, der
    # Fällhieb auf Hüfthöhe, also weniger). Das Becken wandert dabei nur 13 cm vor — der Schwerpunkt wandert über das
    # Vorbeugen (Überschlag 0,33 m) und bleibt über den Füssen (Physik D398: weiter vor fiele die Figur nach vorn; im
    # Video geht das Becken im Treffen sogar zurück). Die Hände treffen tiefer und weiter vorn (Schultern sinken mit).
    'Axt_Hieb': ('Axt_Stand', 'einmal', [
        (1, 'stand'),
        (5, dict(hand=(0.2, 0.2, 1.38), richt=(0.25, 0.15, 0.96), zwei='axt', griff=-0.5, rumpf=(-15, 2), koerper=(-0.03, -0.04))),
        (9, dict(hand=(0.26, -0.07, 1.7), richt=(0.2, -0.45, 0.87), zwei='axt', griff=-0.6, rumpf=(-26, -6), huefte=4,
                 koerper=(-0.07, -0.01), fuss_l=(0.1, -0.02))),
        (12, dict(hand=(0.24, -0.14, 1.74), richt=(0.15, -0.7, 0.7), zwei='axt', griff=-0.62, rumpf=(-30, -8), huefte=12,
                  koerper=(-0.08, 0.04), fuss_l=(0.1, -0.02))),
        (14, dict(hand=(0.14, 0.27, 1.56), richt=(0.06, 0.25, 0.97), zwei='axt', griff=-0.36, rumpf=(-10, 16), huefte=10,
                  koerper=(-0.01, -0.06), fuss_l=(0.1, -0.02))),
        (16, dict(hand=(0.05, 0.62, 0.98), richt=(0, 0.97, -0.24), zwei='axt', griff=-0.11, rumpf=(5, 40), huefte=2,
                  koerper=(0.05, -0.18), fuss_l=(0.1, -0.02))),
        (21, dict(hand=(0.03, 0.55, 0.84), richt=(0, 0.5, -0.866), zwei='axt', griff=-0.11, rumpf=(8, 48), huefte=-6,
                  koerper=(0.06, -0.25), fuss_l=(0.1, -0.02))),
        (29, dict(hand=(0.06, 0.5, 0.88), richt=(0.02, 0.55, -0.83), zwei='axt', griff=-0.13, rumpf=(5, 44), huefte=-3,
                  koerper=(0.05, -0.22), fuss_l=(0.1, -0.02))),
        (34, 'stand'),
    ]),
    # Querhieb: von rechts hinten über vorn nach links, der linke Fuss tritt beim Ausholen vor und steht.
    'Axt_Quer': ('Axt_Stand', 'einmal', [
        (1, 'stand'),
        (5, dict(hand=(0.32, 0.12, 1.25), richt=(0.7, -0.35, 0.62), zwei='axt', griff=-0.52, rumpf=(-28, 2),
                 koerper=(-0.03, -0.06))),
        (10, dict(hand=(0.36, -0.08, 1.3), richt=(0.62, -0.74, 0.25), zwei='axt', griff=-0.62, rumpf=(-50, 0), huefte=14,
                  koerper=(-0.04, -0.08), fuss_l=(0.15, -0.03))),
        (12, dict(hand=(0.28, 0.38, 1.2), richt=(0.55, 0.83, 0.05), zwei='axt', griff=-0.36, rumpf=(-14, 8), huefte=12,
                  koerper=(0.04, -0.1), fuss_l=(0.15, -0.03))),
        (15, dict(hand=(-0.18, 0.45, 1.12), richt=(-0.62, 0.78, -0.1), zwei='axt', griff=-0.11, rumpf=(36, 12), huefte=4,
                  koerper=(0.12, -0.12), fuss_l=(0.15, -0.03))),
        (20, dict(hand=(-0.34, 0.2, 1.06), richt=(-0.75, -0.55, -0.36), zwei='axt', griff=-0.11, rumpf=(55, 14), huefte=-8,
                  koerper=(0.14, -0.13), fuss_l=(0.15, -0.03))),
        (26, dict(hand=(-0.3, 0.18, 1.0), richt=(-0.6, -0.4, -0.69), zwei='axt', griff=-0.13, rumpf=(46, 12), huefte=-4,
                  koerper=(0.12, -0.12), fuss_l=(0.15, -0.03))),
        (30, 'stand'),
    ]),
    # Spalthieb: tief über den Kopf ausholen, die Axt hinter dem Rücken, über oben in den Boden. Der linke Fuss tritt
    # beim Ausholen vor; der Hieb endet am Boden, die Beine fangen die Masse.
    # D452 nach dem Spaltvideo (D430 §7.4, Ziel wie dort tief): im Scheitel aufgerichtet (+3 cm über der Hut, Gewicht
    # hinten), dann klappt der Körper in der Hüfte: Becken 33 cm hinunter (Video 30 cm), Rumpf bis 63° vor (Video 68°),
    # das Becken nur 14 cm vor — der Schwerpunkt wandert über das Vorbeugen (Überschlag 0,38 m) und bleibt über den
    # Füssen (D398). Die Hände gehen mit den Schultern tiefer und weiter vor; der Stiel flacher, damit die Schneide
    # über dem Boden bleibt (Test: Spitze ≥ 5 cm).
    'Axt_Schwer': ('Axt_Stand', 'einmal', [
        (1, 'stand'),
        (6, dict(hand=(0.15, 0.22, 1.32), richt=(0.1, 0.3, 0.95), zwei='axt', griff=-0.45, rumpf=(-8, 5), koerper=(0, -0.06))),
        (12, dict(hand=(0.12, 0.05, 1.72), richt=(0.05, -0.4, 0.9), zwei='axt', griff=-0.58, rumpf=(-8, -8),
                  koerper=(-0.04, -0.02))),
        # Im Scheitel liegt der Stiel waagrecht über dem Kopf, der Kopf hinten, die rechte Hand hinter dem Kopf 0,45 m
        # vom Ende, die linke vor der Brust am Ende. Tiefer (Kopf hängt hinter dem Rücken) reicht der linke Arm nicht
        # ans Stielende — geprüft D429: die Hand verliesse den Stiel um 13 cm.
        (17, dict(hand=(0.1, -0.05, 1.68), richt=(0.03, -0.75, 0.66), zwei='axt', griff=-0.5, rumpf=(-8, -12), huefte=3,
                  koerper=(-0.1, 0.03), fuss_l=(0.12, -0.02))),
        (20, dict(hand=(0.06, -0.18, 1.62), richt=(0.02, -0.95, 0.3), zwei='axt', griff=-0.42, rumpf=(-6, -10), huefte=8,
                  koerper=(-0.11, 0.03), fuss_l=(0.12, -0.02))),
        (22, dict(hand=(0.06, 0.1, 1.7), richt=(0, 0.15, 0.99), zwei='axt', griff=-0.42, rumpf=(-4, -2), huefte=6,
                  koerper=(-0.05, 0.01), fuss_l=(0.12, -0.02))),
        (23, dict(hand=(0.05, 0.46, 1.46), richt=(0, 0.9, 0.45), zwei='axt', griff=-0.25, rumpf=(0, 20), koerper=(0.0, -0.08),
                  fuss_l=(0.12, -0.02))),
        (25, dict(hand=(0.02, 0.57, 0.78), richt=(0, 0.62, -0.78), zwei='axt', griff=-0.11, rumpf=(0, 50), koerper=(0.03, -0.24),
                  fuss_l=(0.12, -0.02))),
        (31, dict(hand=(0.02, 0.58, 0.71), richt=(0, 0.72, -0.69), zwei='axt', griff=-0.11, rumpf=(0, 60), koerper=(0.04, -0.3),
                  fuss_l=(0.12, -0.02))),
        (36, dict(hand=(0.04, 0.55, 0.75), richt=(0, 0.72, -0.69), zwei='axt', griff=-0.13, rumpf=(0, 54), koerper=(0.03, -0.27),
                  fuss_l=(0.12, -0.02))),
        (40, 'stand'),
    ]),
    # Laufhieb: schräg von rechts oben nach links unten, der rechte Fuss setzt im Scheitel weit vor und trägt den Körper.
    'Axt_Lauf': ('Axt_Stand', 'einmal', [
        (1, dict(hand=(0.3, 0.05, 1.45), richt=(0.45, -0.3, 0.85), zwei='axt', griff=-0.5, rumpf=(-25, 12), koerper=(0, -0.05))),
        (4, dict(hand=(0.34, 0.0, 1.6), richt=(0.5, -0.45, 0.74), zwei='axt', griff=-0.58, rumpf=(-32, 10), koerper=(0.02, -0.05))),
        (7, dict(hand=(0.36, 0.06, 1.6), richt=(0.45, -0.62, 0.64), zwei='axt', griff=-0.62, rumpf=(-40, 10), huefte=12,
                 koerper=(0.12, -0.08), fuss_r=(0.45, 0.02))),
        (9, dict(hand=(0.2, 0.6, 1.45), richt=(0.35, 0.82, 0.45), zwei='axt', griff=-0.35, rumpf=(-5, 20), huefte=10,
                 koerper=(0.25, -0.12), fuss_r=(0.45, 0.02))),
        (10, dict(hand=(-0.01, 0.66, 1.2), richt=(-0.3, 0.95, -0.08), zwei='axt', griff=-0.25, rumpf=(15, 24), huefte=6,
                  koerper=(0.28, -0.14), fuss_r=(0.45, 0.02))),
        (11, dict(hand=(-0.22, 0.68, 0.95), richt=(-0.55, 0.62, -0.56), zwei='axt', griff=-0.11, rumpf=(35, 28), huefte=2,
                  koerper=(0.3, -0.16), fuss_r=(0.45, 0.02))),
        (15, dict(hand=(-0.3, 0.54, 0.92), richt=(-0.6, -0.25, -0.76), zwei='axt', griff=-0.11, rumpf=(46, 30), huefte=-8,
                  koerper=(0.32, -0.18), fuss_r=(0.45, 0.02))),
        (22, dict(hand=(-0.26, 0.52, 0.95), richt=(-0.55, -0.1, -0.83), zwei='axt', griff=-0.13, rumpf=(38, 25), huefte=-3,
                  koerper=(0.28, -0.16), fuss_r=(0.45, 0.02))),
        (26, 'stand'),
    ]),
    # D456 — die Saufeder nach Joachim Meyer, halbe Stange (1570, Buch III fol. 16r–17v; Waffenbewegungen §4.4): Hut
    # ist die **Mittelhut** — „die gerade Versatzung vor dem Mann“ —, **linker Fuss vor** (die linke Hand ist die
    # vordere; bis D455 stand der rechte vor und drehte den Rumpf gegen die Waffe, Widerspruch 6), das hintere Ende an
    # der rechten Hüfte, der Ort auf der Mittellinie in Brusthöhe. Beide Hände am Schaft; **die hintere (rechte) Hand
    # führt** und stösst den Schaft durch die vordere, die ihn nur leitet: `griff` = Abstand der linken Hand vor der
    # rechten sinkt im Stoss von 0,5 auf 0,2 m (die Hände kommen zusammen), im Rückzug gleitet er zurück.
    # Der Stoss kommt aus den Beinen: Gewicht erst auf den hinteren Fuss (Gegenbewegung), der vordere fällt aus und
    # steht ab dem Scheitel, das hintere Bein treibt Becken und Rumpf nach, die Arme zuletzt. Kein Nachschwung (Stoss),
    # aber Halt nach `gewicht.ts` (≥ 56 % der Erholung): gestreckt stehen, dann erst zurück.
    'Speer_Stand': ('Idle', 'schleife', [
        (1, dict(hand=(0.24, -0.04, 0.98), richt=(-0.13, 0.96, 0.24), zwei='speer', rumpf=(-24, 5), koerper=(0, -0.07),
                 fuss_l=(0.2, -0.03), fuss_r=(-0.14, 0.06))),
        (25, dict(hand=(0.24, -0.03, 0.965), richt=(-0.13, 0.965, 0.22), zwei='speer', rumpf=(-25, 7), koerper=(0, -0.085),
                  fuss_l=(0.2, -0.03), fuss_r=(-0.14, 0.06))),
        (49, dict(hand=(0.24, -0.04, 0.98), richt=(-0.13, 0.96, 0.24), zwei='speer', rumpf=(-24, 5), koerper=(0, -0.07),
                  fuss_l=(0.2, -0.03), fuss_r=(-0.14, 0.06))),
    ]),
    'Speer_Stoss': ('Speer_Stand', 'einmal', [
        (1, 'stand'),
        (5, dict(hand=(0.27, -0.16, 1.0), richt=(-0.13, 0.97, 0.2), zwei='speer', griff=0.52, rumpf=(-8, -1),
                 koerper=(-0.05, -0.02))),
        (9, dict(hand=(0.28, -0.24, 1.02), richt=(-0.12, 0.98, 0.16), zwei='speer', griff=0.55, rumpf=(-12, -2), huefte=8,
                 koerper=(-0.04, -0.04), fuss_l=(0.26, 0.0))),
        (11, dict(hand=(0.2, 0.2, 1.08), richt=(-0.08, 0.99, 0.1), zwei='speer', griff=0.4, rumpf=(6, 6), huefte=6,
                  koerper=(0.1, -0.09), fuss_l=(0.26, 0.0))),
        (13, dict(hand=(0.14, 0.5, 1.12), richt=(-0.05, 1, 0.05), zwei='speer', griff=0.22, rumpf=(20, 12),
                  koerper=(0.2, -0.13), fuss_l=(0.26, 0.0))),
        (16, dict(hand=(0.14, 0.53, 1.11), richt=(-0.05, 1, 0.04), zwei='speer', griff=0.22, rumpf=(19, 12),
                  koerper=(0.21, -0.14), fuss_l=(0.26, 0.0))),
        (21, dict(hand=(0.22, 0.14, 1.02), richt=(-0.1, 0.98, 0.16), zwei='speer', griff=0.42, rumpf=(4, 5),
                  koerper=(0.08, -0.06), fuss_l=(0.26, 0.0))),
        (27, 'stand'),
    ]),
    # Weitstoss: die hintere Hand hebt beim Ausholen auf Brusthöhe (zur Oberhut hin, der Ort senkt sich auf das Ziel),
    # das Gewicht geht ganz auf den hinteren Fuss; Ausfallschritt 0,4 m (0,5 m erreichte das Bein nicht), das Becken fällt 20 cm.
    'Speer_Weit': ('Speer_Stand', 'einmal', [
        (1, 'stand'),
        (6, dict(hand=(0.28, -0.2, 1.15), richt=(-0.13, 0.97, 0.12), zwei='speer', griff=0.52, rumpf=(-10, -2),
                 koerper=(-0.07, -0.01))),
        (10, dict(hand=(0.3, -0.3, 1.3), richt=(-0.12, 0.98, -0.02), zwei='speer', griff=0.55, rumpf=(-16, -4),
                  koerper=(-0.1, 0.0))),
        (14, dict(hand=(0.3, -0.32, 1.32), richt=(-0.11, 0.99, -0.04), zwei='speer', griff=0.55, rumpf=(-18, -4), huefte=10,
                  koerper=(-0.02, -0.05), fuss_l=(0.4, 0.0))),
        (16, dict(hand=(0.2, 0.26, 1.2), richt=(-0.07, 1, 0.0), zwei='speer', griff=0.4, rumpf=(8, 10), huefte=6,
                  koerper=(0.18, -0.14), fuss_l=(0.4, 0.0))),
        (18, dict(hand=(0.12, 0.72, 1.12), richt=(-0.03, 1, 0.02), zwei='speer', griff=0.2, rumpf=(26, 20),
                  koerper=(0.32, -0.2), fuss_l=(0.4, 0.0))),
        (22, dict(hand=(0.12, 0.75, 1.1), richt=(-0.03, 1, 0.0), zwei='speer', griff=0.2, rumpf=(25, 20),
                  koerper=(0.33, -0.21), fuss_l=(0.4, 0.0))),
        (27, dict(hand=(0.2, 0.3, 1.04), richt=(-0.09, 0.99, 0.12), zwei='speer', griff=0.4, rumpf=(8, 8),
                  koerper=(0.16, -0.1), fuss_l=(0.4, 0.0))),
        (33, 'stand'),
    ]),
    # Anlauf: beginnt in der Anlaufpose (aus dem Lauf, `beginn: "anlauf"`), endet in der Hut.
    'Speer_Lauf': ('Speer_Stand', 'einmal', [
        (1, dict(hand=(0.27, -0.1, 1.02), richt=(-0.13, 0.97, 0.2), zwei='speer', griff=0.5, rumpf=(-4, 6),
                 koerper=(0.04, -0.03))),
        (4, dict(hand=(0.29, -0.22, 1.06), richt=(-0.12, 0.98, 0.12), zwei='speer', griff=0.54, rumpf=(-10, 5), huefte=8,
                 koerper=(0.08, -0.04))),
        (7, dict(hand=(0.29, -0.2, 1.08), richt=(-0.11, 0.99, 0.08), zwei='speer', griff=0.55, rumpf=(-10, 7), huefte=12,
                 koerper=(0.16, -0.08), fuss_l=(0.55, 0.0))),
        (9, dict(hand=(0.2, 0.36, 1.12), richt=(-0.06, 1, 0.03), zwei='speer', griff=0.38, rumpf=(8, 14), huefte=5,
                 koerper=(0.28, -0.16), fuss_l=(0.55, 0.0))),
        (11, dict(hand=(0.12, 0.8, 1.1), richt=(-0.03, 1, 0.0), zwei='speer', griff=0.2, rumpf=(24, 21),
                  koerper=(0.38, -0.21), fuss_l=(0.55, 0.0))),
        (15, dict(hand=(0.12, 0.83, 1.08), richt=(-0.03, 1, -0.01), zwei='speer', griff=0.2, rumpf=(23, 21),
                  koerper=(0.39, -0.22), fuss_l=(0.55, 0.0))),
        (21, dict(hand=(0.2, 0.34, 1.03), richt=(-0.09, 0.99, 0.12), zwei='speer', griff=0.4, rumpf=(8, 9),
                  koerper=(0.18, -0.1), fuss_l=(0.55, 0.0))),
        (28, 'stand'),
    ]),
    # Block: der Schaft quer vor der Brust; beginnt in der Hut, gehalten wird das letzte Bild.
    'Speer_Block': ('Speer_Stand', 'einmal', [
        (1, 'stand'),
        (5, dict(hand=(0.3, 0.3, 1.32), richt=(-1, 0.08, 0.12), zwei='speer', griff=0.5, rumpf=(18, 1),
                 koerper=(-0.03, -0.02))),
        (8, dict(hand=(0.3, 0.31, 1.31), richt=(-1, 0.08, 0.12), zwei='speer', griff=0.5, rumpf=(18, 2),
                 koerper=(-0.03, -0.03))),
    ]),
    # D414: Das Lange Messer (Hauswehr, zweihändig, 1,1 m, um 1,3 kg). Die rechte Hand sitzt unter dem Gehilz,
    # die linke 0,13 m dahinter am Knauf (`GRIFF['messer']`). Trägheit um die rechte Hand 0,23 kg·m² (aus dem
    # Modell, `tools/waffenmodelle.py`), grob 0,15 bei der Klinge (einhändig) und um 1,0 bei der Axt (Kopf 0,8 m
    # vor der Hand) — Überschläge. Zwei Hände geben mehr Kraft als eine; darum holt es länger aus als die Klinge
    # (Scheitel 8–9 statt 6 Bilder) und kürzer als die Axt (10), und der Durchzug läuft nach dem Treffer weiter.
    # Physik (D398), in jedem Hieb gleich: Ausholen = Gewicht auf den hinteren Fuss, der vordere setzt auf
    # und steht vom Scheitel bis zum Durchzug (`fuss_*` gleich, Test). Die Hüfte führt: `huefte` dreht das
    # Becken (und den unteren Rücken) schon in Schlagrichtung, während die Brust noch zurück ist — die
    # Schultern folgen, die Klinge zuletzt. Das Gewicht wandert im Schlag nach vorn (`koerper` v steigt).
    'Messer_Stand': ('Idle', 'schleife', [
        # Beidhändig vor dem Bauch, die Spitze auf Gesichtshöhe des Gegners; linker Fuss vor (rechte Hand
        # oben), Knie leicht gebeugt.
        (1, dict(hand=(0.1, 0.32, 1.1), richt=(-0.05, 0.7, 0.71), zwei='messer', rumpf=(-10, 4), koerper=(0, -0.07),
                 fuss_l=(0.14, -0.02), fuss_r=(-0.1, 0.04))),
        (25, dict(hand=(0.1, 0.33, 1.08), richt=(-0.05, 0.72, 0.69), zwei='messer', rumpf=(-11, 6), koerper=(0, -0.085),
                  fuss_l=(0.14, -0.02), fuss_r=(-0.1, 0.04))),
        (49, dict(hand=(0.1, 0.32, 1.1), richt=(-0.05, 0.7, 0.71), zwei='messer', rumpf=(-10, 4), koerper=(0, -0.07),
                  fuss_l=(0.14, -0.02), fuss_r=(-0.1, 0.04))),
    ]),
    # Vorhand, waagrecht von rechts nach links — der breite Bogen gegen das Rudel. Ausholen auf den rechten
    # Fuss, der linke tritt im Scheitel vor und steht; das Becken dreht vor, die Klinge folgt.
    'Messer_Quer_A': ('Messer_Stand', 'einmal', [
        (1, 'stand'),
        (5, dict(hand=(0.3, 0.12, 1.2), richt=(0.75, -0.4, 0.5), zwei='messer', rumpf=(-28, 2), koerper=(-0.03, -0.08),
                 fuss_l=(0.14, -0.02), fuss_r=(-0.1, 0.04))),
        (9, dict(hand=(0.36, -0.06, 1.22), richt=(0.62, -0.75, 0.22), zwei='messer', rumpf=(-48, 0), huefte=14,
                 koerper=(-0.04, -0.1), fuss_l=(0.3, -0.04), fuss_r=(-0.12, 0.05))),
        (11, dict(hand=(0.18, 0.46, 1.16), richt=(0.25, 0.97, 0.0), zwei='messer', rumpf=(-8, 8), huefte=12,
                  koerper=(0.08, -0.12), fuss_l=(0.3, -0.04), fuss_r=(-0.12, 0.05))),
        (13, dict(hand=(-0.28, 0.4, 1.1), richt=(-0.8, 0.58, -0.12), zwei='messer', rumpf=(38, 12), huefte=4,
                  koerper=(0.14, -0.12), fuss_l=(0.3, -0.04), fuss_r=(-0.12, 0.05))),
        # D420: Der erste Schlüssel nach dem Durchzug setzt die Hand auf die Linie, auf der sie vorher weiterlief — die Lage
        # des Handgelenks im Durchzug folgt dieser Richtung (`_pose` `bewegung`), so bleibt die Pose im Treffer gleich.
        # D420 Nachschwung: Die Masse läuft weiter (Klinge 82° über den Durchzug, Bremsweg ≥ 21°), die Brust
        # wird mitgezogen, das Becken bremst schon zurück (`huefte` gegen die Drehung), das Gewicht bleibt tief auf
        # dem vorderen Fuss. Erst ab Bild 23 (53 % der Erholung, `nachschwung`) hebt sie die Klinge zurück.
        (17, dict(hand=(-0.34, 0.18, 1.06), richt=(-0.62, -0.7, -0.36), zwei='messer', rumpf=(56, 14), huefte=-8,
                  koerper=(0.17, -0.14), fuss_l=(0.3, -0.04), fuss_r=(-0.12, 0.05))),
        (23, dict(hand=(-0.3, 0.14, 0.98), richt=(-0.55, -0.45, -0.7), zwei='messer', rumpf=(46, 12), huefte=-4,
                  koerper=(0.13, -0.12), fuss_l=(0.3, -0.04), fuss_r=(-0.12, 0.05))),
        (30, 'stand'),
    ]),
    # Rückhand, von links nach rechts, mit dem Schritt des rechten Fusses: die zweite Hälfte der Kette.
    'Messer_Quer_B': ('Messer_Stand', 'einmal', [
        (1, 'stand'),
        (5, dict(hand=(-0.18, 0.12, 1.22), richt=(-0.7, -0.4, 0.55), zwei='messer', rumpf=(25, 4), koerper=(-0.03, -0.08),
                 fuss_l=(0.14, -0.02), fuss_r=(-0.1, 0.04))),
        (8, dict(hand=(-0.26, -0.02, 1.25), richt=(-0.6, -0.72, 0.3), zwei='messer', rumpf=(42, 2), huefte=-14,
                 koerper=(-0.04, -0.1), fuss_l=(0.14, -0.02), fuss_r=(0.22, 0.06))),
        (10, dict(hand=(0.1, 0.48, 1.16), richt=(-0.2, 0.98, 0.0), zwei='messer', rumpf=(5, 8), huefte=-12,
                  koerper=(0.08, -0.12), fuss_l=(0.14, -0.02), fuss_r=(0.22, 0.06))),
        (12, dict(hand=(0.42, 0.32, 1.1), richt=(0.82, 0.55, -0.12), zwei='messer', rumpf=(-36, 10), huefte=-4,
                  koerper=(0.13, -0.12), fuss_l=(0.14, -0.02), fuss_r=(0.22, 0.06))),
        # D420 Nachschwung gespiegelt zu `Quer_A`: weiter nach rechts hinten, Becken bremst, Gewicht vorn; zurück ab Bild 21.
        (16, dict(hand=(0.48, 0.05, 1.05), richt=(0.62, -0.68, -0.38), zwei='messer', rumpf=(-54, 12), huefte=8,
                  koerper=(0.16, -0.14), fuss_l=(0.14, -0.02), fuss_r=(0.22, 0.06))),
        (21, dict(hand=(0.42, 0.1, 1.0), richt=(0.55, -0.45, -0.7), zwei='messer', rumpf=(-44, 10), huefte=4,
                  koerper=(0.12, -0.12), fuss_l=(0.14, -0.02), fuss_r=(0.22, 0.06))),
        (28, 'stand'),
    ]),
    # Laufhieb: aus dem Lauf hoch rechts ausholen, der rechte Fuss setzt im Scheitel weit vor und trägt den
    # Körper hinein; schräg nach links unten durch.
    'Messer_Lauf': ('Messer_Stand', 'einmal', [
        (1, dict(hand=(0.28, 0.04, 1.45), richt=(0.4, -0.35, 0.85), zwei='messer', rumpf=(-25, 12), koerper=(0.05, -0.06))),
        (4, dict(hand=(0.3, 0.0, 1.5), richt=(0.45, -0.5, 0.75), zwei='messer', rumpf=(-32, 10), koerper=(0.08, -0.06))),
        (7, dict(hand=(0.3, 0.08, 1.54), richt=(0.4, -0.7, 0.6), zwei='messer', rumpf=(-40, 10), huefte=12,
                 koerper=(0.15, -0.1), fuss_r=(0.5, 0.02))),
        (9, dict(hand=(0.15, 0.66, 1.42), richt=(0.3, 0.85, 0.42), zwei='messer', rumpf=(-5, 20), huefte=10,
                 koerper=(0.3, -0.15), fuss_r=(0.5, 0.02))),
        (11, dict(hand=(-0.25, 0.66, 0.92), richt=(-0.55, 0.6, -0.58), zwei='messer', rumpf=(35, 28), huefte=2,
                  koerper=(0.36, -0.18), fuss_r=(0.5, 0.02))),
        # D420 Nachschwung: tief links unten aus (Spitze knapp 20 cm über dem Boden), das Becken bremst, der Körper bleibt
        # im Ausfall auf dem rechten Fuss; zurück ab Bild 20.
        (15, dict(hand=(-0.3015, 0.5325, 0.874), richt=(-0.7, 0.1, -0.7), zwei='messer', rumpf=(46, 30), huefte=-8,
                  koerper=(0.38, -0.2), fuss_r=(0.5, 0.02))),
        (20, dict(hand=(-0.25, 0.52, 0.88), richt=(-0.62, 0.18, -0.76), zwei='messer', rumpf=(38, 24), huefte=-3,
                  koerper=(0.33, -0.17), fuss_r=(0.5, 0.02))),
        (26, 'stand'),
    ]),
    # Schwerer Hieb von oben (D414, sechster Clip): `Klinge_U_C` aus der UAL2 taugt dafür nicht — im Prüfbild
    # (`.cache/bilder/D414/messer_mit_klinge_u_c.png`) springt die Figur, und die linke Hand ist nicht am Griff.
    # Hoch über den Kopf ausholen (Gewicht hinten, der linke Fuss tritt vor und steht), dann mit dem ganzen
    # Körper nach vorn unten durch: Das Becken schiebt vor (`koerper` v), der Rumpf beugt sich mit.
    'Messer_Schwer': ('Messer_Stand', 'einmal', [
        (1, 'stand'),
        (6, dict(hand=(0.14, 0.18, 1.42), richt=(0.05, 0.2, 0.98), zwei='messer', rumpf=(-10, 0), koerper=(-0.02, -0.06),
                 fuss_l=(0.14, -0.02), fuss_r=(-0.1, 0.04))),
        (12, dict(hand=(0.1, 0.0, 1.66), richt=(0.05, -0.75, 0.66), zwei='messer', rumpf=(-12, -8), koerper=(-0.06, -0.05),
                  fuss_l=(0.32, -0.04), fuss_r=(-0.12, 0.05))),
        (14, dict(hand=(0.06, 0.34, 1.52), richt=(0.0, 0.95, 0.3), zwei='messer', rumpf=(-4, 10), koerper=(0.06, -0.08),
                  fuss_l=(0.32, -0.04), fuss_r=(-0.12, 0.05))),
        (17, dict(hand=(0.03, 0.55, 0.98), richt=(0.0, 0.6, -0.8), zwei='messer', rumpf=(0, 30), koerper=(0.16, -0.19),
                  fuss_l=(0.32, -0.04), fuss_r=(-0.12, 0.05))),
        # D420 Nachschwung: Der Hieb von oben endet am Boden — die Masse fangen die Beine (Becken 6 cm tiefer, Hände
        # 24 cm), die Spitze bleibt 17–19 cm über dem Boden. Zurück ab Bild 28 (53 % der Erholung).
        (21, dict(hand=(0.0225, 0.54, 0.745), richt=(0.02, 0.8, -0.6), zwei='messer', rumpf=(0, 38), koerper=(0.19, -0.25),
                  fuss_l=(0.32, -0.04), fuss_r=(-0.12, 0.05))),
        (28, dict(hand=(0.05, 0.46, 0.78), richt=(0.03, 0.75, -0.66), zwei='messer', rumpf=(0, 34), koerper=(0.17, -0.23),
                  fuss_l=(0.32, -0.04), fuss_r=(-0.12, 0.05))),
        (36, 'stand'),
    ]),
    # Block: die Klinge schräg vor Kopf und linker Seite, beide Hände vor der Brust, die rechte oben — die Arme
    # kreuzen nicht. Gehalten wird das letzte Bild (wie `Axt_Block`).
    'Messer_Block': ('Messer_Stand', 'einmal', [
        (1, 'stand'),
        (4, dict(hand=(0.06, 0.32, 1.3), richt=(-0.62, 0.15, 0.77), zwei='messer', rumpf=(-6, 4), koerper=(-0.03, -0.08),
                 fuss_l=(0.14, -0.02), fuss_r=(-0.12, 0.05))),
        (8, dict(hand=(0.07, 0.34, 1.33), richt=(-0.65, 0.15, 0.74), zwei='messer', rumpf=(-6, 6), koerper=(-0.04, -0.1),
                 fuss_l=(0.14, -0.02), fuss_r=(-0.12, 0.05))),
    ]),
    # D456 — der Hirschfänger (0,59 kg, 0,65 m, einhändig; Anker DHM W 70/71, `content/waffenfamilien.json`). Bis D455
    # lief er auf den Klingenclips. Geprüft: Nach `gewicht.ts` schlägt er nur 4 % schneller als die Klinge (0,165 gegen
    # 0,171 s — der Arm bestimmt die Zeit, nicht die Waffe), aber er bremst auf 8° statt 17,5° und hält nur 37 % statt
    # 47 % der Erholung; mit den Klingenclips schwänge er aus wie ein Schwert. Darum eigene, engere Clips: Hut dichter
    # am Leib und tiefer (man steht im Bogen des Tiers), kleine Bögen aus Unterarm und Hüfte, kurzer Schritt, kurzer
    # Nachschwung. **Keine Kampfwerte:** Scheitel und Durchzug stehen in `FENSTER`, bis D407 misst.
    'Hirsch_Stand': ('Idle', 'schleife', [
        (1, dict(hand=(0.2, 0.3, 1.02), richt=(-0.25, 0.85, 0.46), rumpf=(-18, 8), koerper=(0, -0.1),
                 fuss_l=(0.15, -0.03), fuss_r=(-0.13, 0.05), links=(-0.16, 0.3, 1.1))),
        (25, dict(hand=(0.2, 0.31, 1.0), richt=(-0.25, 0.86, 0.44), rumpf=(-19, 10), koerper=(0, -0.115),
                  fuss_l=(0.15, -0.03), fuss_r=(-0.13, 0.05), links=(-0.16, 0.31, 1.08))),
        (49, dict(hand=(0.2, 0.3, 1.02), richt=(-0.25, 0.85, 0.46), rumpf=(-18, 8), koerper=(0, -0.1),
                  fuss_l=(0.15, -0.03), fuss_r=(-0.13, 0.05), links=(-0.16, 0.3, 1.1))),
    ]),
    # Kurzer Hieb von rechts oben, der vordere Fuss rückt eine halbe Fusslänge vor.
    'Hirsch_Hieb_A': (HIRSCH_BASIS, 'einmal', [
        (1, 'stand'),
        (3, dict(hand=(0.3, 0.16, 1.24), richt=(0.25, 0.1, 0.96), rumpf=(-14, 0), koerper=(-0.02, -0.01),
                 links=(-0.12, 0.38, 1.16))),
        (5, dict(hand=(0.32, 0.08, 1.36), richt=(0.35, -0.4, 0.85), rumpf=(-24, -2), huefte=10, koerper=(0.0, -0.02),
                 fuss_l=(0.14, -0.01), links=(-0.1, 0.42, 1.2))),
        (7, dict(hand=(0.12, 0.5, 1.22), richt=(0.0, 0.9, 0.43), rumpf=(8, 6), huefte=6, koerper=(0.08, -0.05),
                 fuss_l=(0.14, -0.01), links=(-0.24, 0.18, 1.08))),
        (8, dict(hand=(-0.08, 0.5, 1.0), richt=(-0.45, 0.83, -0.33), rumpf=(22, 9), huefte=1, koerper=(0.11, -0.07),
                 fuss_l=(0.14, -0.01), links=(-0.3, 0.04, 1.02))),
        (10, dict(hand=(-0.16, 0.4, 0.92), richt=(-0.58, 0.62, -0.53), rumpf=(27, 10), huefte=-4, koerper=(0.12, -0.08),
                  fuss_l=(0.14, -0.01), links=(-0.32, 0.0, 1.0))),
        (14, dict(hand=(-0.12, 0.4, 0.95), richt=(-0.5, 0.7, -0.5), rumpf=(22, 9), huefte=-2, koerper=(0.1, -0.07),
                  fuss_l=(0.14, -0.01), links=(-0.3, 0.04, 1.02))),
        (20, 'stand'),
    ]),
    # Rückhand von links nach rechts — das zweite Glied.
    'Hirsch_Hieb_B': (HIRSCH_BASIS, 'einmal', [
        (1, 'stand'),
        (3, dict(hand=(-0.06, 0.26, 1.12), richt=(-0.6, 0.3, 0.74), rumpf=(12, 2), koerper=(-0.02, -0.01),
                 links=(-0.22, 0.14, 1.02))),
        (5, dict(hand=(-0.14, 0.2, 1.2), richt=(-0.78, -0.2, 0.59), rumpf=(24, 0), huefte=-10, koerper=(0.0, -0.02),
                 fuss_l=(0.14, -0.01), links=(-0.26, 0.06, 0.98))),
        (7, dict(hand=(0.12, 0.5, 1.14), richt=(-0.2, 0.95, 0.24), rumpf=(2, 5), huefte=-6, koerper=(0.07, -0.05),
                 fuss_l=(0.14, -0.01), links=(-0.26, 0.16, 1.06))),
        (8, dict(hand=(0.36, 0.4, 1.06), richt=(0.6, 0.76, -0.25), rumpf=(-20, 8), huefte=-1, koerper=(0.1, -0.07),
                 fuss_l=(0.14, -0.01), links=(-0.2, 0.3, 1.12))),
        (10, dict(hand=(0.42, 0.28, 1.0), richt=(0.72, 0.5, -0.48), rumpf=(-26, 9), huefte=4, koerper=(0.11, -0.08),
                  fuss_l=(0.14, -0.01), links=(-0.16, 0.34, 1.14))),
        (14, dict(hand=(0.4, 0.3, 1.02), richt=(0.66, 0.58, -0.47), rumpf=(-21, 8), huefte=2, koerper=(0.09, -0.07),
                  fuss_l=(0.14, -0.01), links=(-0.17, 0.32, 1.13))),
        (20, 'stand'),
    ]),
    # Stich mit kurzem Vorlauf: aus der Hut kaum zurück, der vordere Fuss fällt aus, die freie Hand fliegt zurück.
    'Hirsch_Stich': (HIRSCH_BASIS, 'einmal', [
        (1, 'stand'),
        (4, dict(hand=(0.24, 0.12, 1.04), richt=(-0.1, 0.98, 0.16), rumpf=(-16, 0), koerper=(-0.03, -0.01),
                 links=(-0.12, 0.38, 1.16))),
        (6, dict(hand=(0.25, 0.04, 1.06), richt=(-0.06, 1, 0.08), rumpf=(-22, -2), huefte=8, koerper=(-0.01, -0.02),
                 fuss_l=(0.24, -0.01), links=(-0.1, 0.42, 1.2))),
        (8, dict(hand=(0.14, 0.46, 1.14), richt=(-0.02, 1, 0.03), rumpf=(4, 8), huefte=4, koerper=(0.12, -0.07),
                 fuss_l=(0.24, -0.01), links=(-0.24, 0.12, 1.06))),
        (9, dict(hand=(0.06, 0.74, 1.16), richt=(0, 1, 0), rumpf=(24, 14), koerper=(0.2, -0.1),
                 fuss_l=(0.24, -0.01), links=(-0.32, -0.14, 1.02))),
        (11, dict(hand=(0.07, 0.76, 1.15), richt=(0, 1, -0.02), rumpf=(23, 14), koerper=(0.21, -0.11),
                  fuss_l=(0.24, -0.01), links=(-0.31, -0.12, 1.02))),
        (15, dict(hand=(0.16, 0.46, 1.08), richt=(-0.1, 0.97, 0.2), rumpf=(6, 8), koerper=(0.1, -0.06),
                  fuss_l=(0.24, -0.01), links=(-0.22, 0.12, 1.06))),
        (21, 'stand'),
    ]),
    # D456 — Körperclips ohne Waffenbezug (Teil 2 des Auftrags D455), gebaut aus dem Stand (`Idle`), **nicht verdrahtet**
    # (Laufzeit: D457). Die rechte Hand trägt die Waffe tief neben dem Leib; `richt` stellt nur das Handgelenk.
    # Landung weich (Fall ohne Schaden, `content/bewegung.json`: schadlos bis 4,5 m): Beginnt im Aufsetzen — Knie schon
    # gebeugt —, federt 22 cm ein (Becken und Rumpf nach vorn über die Füsse, Arme vor zum Ausgleich) und steht auf.
    'Koerper_Landung_Weich': ('Idle', 'einmal', [
        (1, dict(hand=(0.3, 0.12, 0.98), richt=(0.1, 0.75, -0.65), links=(-0.3, 0.12, 0.98), rumpf=(0, 8), koerper=(0, -0.08))),
        (4, dict(hand=(0.32, 0.28, 0.86), richt=(0.1, 0.85, -0.5), links=(-0.32, 0.28, 0.86), rumpf=(0, 22), koerper=(0.02, -0.22))),
        (6, dict(hand=(0.32, 0.3, 0.84), richt=(0.1, 0.86, -0.5), links=(-0.32, 0.3, 0.84), rumpf=(0, 24), koerper=(0.02, -0.24))),
        (11, dict(hand=(0.3, 0.16, 0.9), richt=(0.1, 0.7, -0.7), links=(-0.3, 0.16, 0.9), rumpf=(0, 8), koerper=(0.01, -0.07))),
        (16, 'stand'),
    ]),
    # Landung hart (Fall mit Schaden, D412): tief in die Hocke (Becken 45 cm), der Rumpf klappt vor, die linke Hand
    # fängt am Boden ab; die Figur bleibt einen Moment unten (das Gewicht ist angekommen) und drückt sich erst dann hoch.
    'Koerper_Landung_Hart': ('Idle', 'einmal', [
        (1, dict(hand=(0.3, 0.12, 0.96), richt=(0.1, 0.75, -0.65), links=(-0.3, 0.14, 0.96), rumpf=(0, 10), koerper=(0, -0.1))),
        (4, dict(hand=(0.34, 0.3, 0.6), richt=(0.2, 0.9, -0.4), links=(-0.26, 0.4, 0.3), rumpf=(-8, 40), koerper=(0.03, -0.4),
                 fuss_l=(0.06, -0.03), fuss_r=(-0.04, 0.03))),
        (7, dict(hand=(0.34, 0.3, 0.52), richt=(0.2, 0.92, -0.35), links=(-0.24, 0.42, 0.14), rumpf=(-10, 46), koerper=(0.04, -0.46),
                 fuss_l=(0.06, -0.03), fuss_r=(-0.04, 0.03))),
        (14, dict(hand=(0.34, 0.3, 0.55), richt=(0.2, 0.92, -0.35), links=(-0.24, 0.42, 0.15), rumpf=(-9, 44), koerper=(0.04, -0.44),
                  fuss_l=(0.06, -0.03), fuss_r=(-0.04, 0.03))),
        (22, dict(hand=(0.3, 0.2, 0.86), richt=(0.1, 0.75, -0.65), links=(-0.3, 0.22, 0.8), rumpf=(-2, 16), koerper=(0.02, -0.14),
                  fuss_l=(0.06, -0.03), fuss_r=(-0.04, 0.03))),
        (30, 'stand'),
    ]),
    # Markengriff (Reinigen, D417 — bis jetzt stand dafür der Block-Clip): ein Schritt mit dem linken Fuss, die linke
    # Hand greift offen nach vorn auf Brusthöhe des Tiers, die Waffe geht aus dem Weg nach hinten unten. Das letzte Bild
    # wird gehalten (der Griff dauert, solange die Regel ihn hält).
    'Koerper_Griff': ('Idle', 'einmal', [
        (1, 'stand'),
        (4, dict(hand=(0.3, 0.02, 0.92), richt=(0.2, 0.5, -0.84), links=(-0.16, 0.3, 1.1), rumpf=(-10, 4), koerper=(0.02, -0.04))),
        (8, dict(hand=(0.32, -0.1, 0.9), richt=(0.25, 0.3, -0.92), links=(-0.08, 0.56, 1.08), rumpf=(-26, 12), koerper=(0.12, -0.1),
                 fuss_l=(0.3, -0.02))),
        (12, dict(hand=(0.32, -0.12, 0.9), richt=(0.25, 0.28, -0.93), links=(-0.06, 0.62, 1.05), rumpf=(-30, 15), koerper=(0.15, -0.12),
                  fuss_l=(0.3, -0.02))),
    ]),
    # „Aufgegeben“ für Menschen (D426: sie geben beim Haltungsbruch auf — bis jetzt ohne Clip): auf das rechte Knie,
    # beide Hände offen auf Schulterhöhe gehoben, der Kopf gesenkt. Das letzte Bild wird gehalten.
    'Koerper_Aufgabe': ('Idle', 'einmal', [
        (1, 'stand'),
        (5, dict(hand=(0.34, 0.16, 1.05), richt=(0.2, 0.3, 0.93), links=(-0.34, 0.16, 1.05), rumpf=(0, 10), koerper=(-0.02, -0.12),
                 fuss_r=(-0.12, 0.02))),
        (11, dict(hand=(0.38, 0.2, 1.0), richt=(0.25, 0.2, 0.95), links=(-0.38, 0.2, 1.0), rumpf=(0, 14), koerper=(-0.04, -0.4),
                  fuss_r=(-0.36, 0.02))),
        (16, dict(hand=(0.38, 0.2, 0.98), richt=(0.25, 0.2, 0.95), links=(-0.38, 0.2, 0.98), rumpf=(0, 16), koerper=(-0.04, -0.43),
                  fuss_r=(-0.36, 0.02))),
    ]),
    # D414: Räucherkanne (Imker-Smoker, Baukasten §18) — die linke Hand hält die Kanne am Blasebalg und
    # drückt ihn, die rechte hält die einhändige Waffe tief rechts vorn — die Klinge kreuzt nicht vor der Kanne
    # (erste Fassung aus Klinge_Stand: im Prüfbild kreuzte sie). Ein Smoker wird
    # real mit einer Hand geführt: Balg in der Hand, Kanne daneben. Zwei Stösse je Sekunde; die Hand schiebt
    # dabei ein wenig vor und sinkt (Druck auf den Balg). Schleife, 1 s.
    # D460 — Trage-Huten der Zweihandwaffen fürs Gehen und Laufen ausserhalb des Kampfs (Laufzeit D457: Oberkörper aus
    # diesem Clip über die Beine des Gangs). Die Kampf-Huten halten die Waffe hoch und zum Gegner — im Rennen falsch; und
    # der Paketgang trägt jede Waffe einhändig. Hier liegt sie quer und tief vor dem Leib, beide Hände am Holz, wie man
    # ein Werkzeug über Strecke trägt. Schleife mit kleinem Wiegen (die Beine und das Becken bringt der Gang).
    'Axt_Trage': ('Idle', 'schleife', [
        (1, dict(hand=(0.24, 0.2, 1.1), richt=(0.93, 0.25, 0.12), zwei='axt', griff=-0.4, rumpf=(0, 5))),
        (13, dict(hand=(0.24, 0.21, 1.085), richt=(0.93, 0.26, 0.1), zwei='axt', griff=-0.4, rumpf=(0, 6))),
        (25, dict(hand=(0.24, 0.2, 1.1), richt=(0.93, 0.25, 0.12), zwei='axt', griff=-0.4, rumpf=(0, 5))),
    ]),
    'Speer_Trage': ('Idle', 'schleife', [
        (1, dict(hand=(0.24, 0.05, 1.02), richt=(-0.6, 0.6, 0.5), zwei='speer', griff=0.32, rumpf=(-6, 5))),
        (13, dict(hand=(0.24, 0.06, 1.005), richt=(-0.6, 0.61, 0.48), zwei='speer', griff=0.32, rumpf=(-6, 6))),
        (25, dict(hand=(0.24, 0.05, 1.02), richt=(-0.6, 0.6, 0.5), zwei='speer', griff=0.32, rumpf=(-6, 5))),
    ]),
    'Messer_Trage': ('Idle', 'schleife', [
        (1, dict(hand=(-0.02, 0.26, 1.04), richt=(-0.25, 0.5, -0.83), zwei='messer', rumpf=(0, 5))),
        (13, dict(hand=(-0.02, 0.27, 1.025), richt=(-0.25, 0.52, -0.81), zwei='messer', rumpf=(0, 6))),
        (25, dict(hand=(-0.02, 0.26, 1.04), richt=(-0.25, 0.5, -0.83), zwei='messer', rumpf=(0, 5))),
    ]),
    'Geraet_Blasebalg': (KLINGE_BASIS, 'schleife', [
        (1, dict(hand=(0.3, 0.26, 1.05), richt=(0.1, 0.8, 0.59), rumpf=(10, 1), koerper=(0, 0),
                 links=(-0.14, 0.4, 1.24))),
        (7, dict(hand=(0.3, 0.26, 1.04), richt=(0.1, 0.8, 0.59), rumpf=(10, 2), koerper=(0, -0.005),
                 links=(-0.14, 0.44, 1.21))),
        (13, dict(hand=(0.3, 0.26, 1.05), richt=(0.1, 0.8, 0.59), rumpf=(10, 1), koerper=(0, 0),
                  links=(-0.14, 0.4, 1.24))),
        (19, dict(hand=(0.3, 0.26, 1.04), richt=(0.1, 0.8, 0.59), rumpf=(10, 2), koerper=(0, -0.005),
                  links=(-0.14, 0.44, 1.21))),
        (25, dict(hand=(0.3, 0.26, 1.05), richt=(0.1, 0.8, 0.59), rumpf=(10, 1), koerper=(0, 0),
                  links=(-0.14, 0.4, 1.24))),
    ]),
}
# D414: Treffer-Scheitel und Durchzug der Messerhiebe in Bildern (24/s), solange es keine Kampfwerte gibt —
# die Regel (`content/waffen/`, `hieb`) übernimmt sie, sobald D407 misst (`tests/waffenclips.test.ts` prüft).
TREFFER = {'Messer_Quer_A': (9, 13), 'Messer_Quer_B': (8, 12), 'Messer_Schwer': (12, 17), 'Messer_Lauf': (7, 11),
           # D429: die Axt — dieselben Bilder wie `hieb` in `content/waffen/axt.json` (unverändert seit vor D429).
           'Axt_Hieb': (12, 16), 'Axt_Quer': (10, 15), 'Axt_Schwer': (20, 25), 'Axt_Lauf': (7, 11)}
# D456: Scheitel und Durchzug der übrigen Hiebe und Stösse — dieselben Bilder wie `hieb` in `content/waffen/klinge.json`
# und `speer.json` (Test). Eigenes Feld, weil `TREFFER` die Prüfungen aus D414/D429 trägt (zweihändige Schwünge).
FENSTER = {'Klinge_Hieb_A': (6, 9), 'Klinge_Hieb_B': (6, 9), 'Klinge_Stich': (9, 13), 'Klinge_Schwer': (14, 18),
           'Klinge_Lauf': (7, 11), 'Speer_Stoss': (9, 13), 'Speer_Weit': (14, 18), 'Speer_Lauf': (7, 11),
           # Hirschfänger: noch keine Kampfwerte (D407 misst) — Vorschlag der Clips, kürzer als die Klinge (6/9, 9/13).
           'Hirsch_Hieb_A': (5, 8), 'Hirsch_Hieb_B': (5, 8), 'Hirsch_Stich': (6, 9)}
# Hiebe (Schwung): Hier dreht das Handgelenk nach der Bahn des Schlagpunkts.
HIEBE = set(TREFFER) | {'Klinge_Hieb_A', 'Klinge_Hieb_B', 'Klinge_Schwer', 'Hirsch_Hieb_A', 'Hirsch_Hieb_B'}
NAMEN = tuple(CLIPS)
ACHSE = {'Klinge_Stand': 'klinge', 'Klinge_Stich': 'klinge', 'Klinge_Hieb_A': 'klinge', 'Klinge_Hieb_B': 'klinge',
         'Klinge_Schwer': 'klinge', 'Klinge_Lauf': 'klinge', 'Klinge_Block': 'klinge',
         'Hirsch_Stand': 'hirsch', 'Hirsch_Hieb_A': 'hirsch', 'Hirsch_Hieb_B': 'hirsch', 'Hirsch_Stich': 'hirsch',
         'Axt_Stand': 'axt', 'Axt_Block': 'axt', 'Axt_Hieb': 'axt', 'Axt_Quer': 'axt', 'Axt_Schwer': 'axt', 'Axt_Lauf': 'axt',
         'Speer_Stand': 'speer', 'Speer_Stoss': 'speer', 'Speer_Weit': 'speer', 'Speer_Lauf': 'speer', 'Speer_Block': 'speer',
         'Messer_Stand': 'messer', 'Messer_Quer_A': 'messer', 'Messer_Quer_B': 'messer', 'Messer_Lauf': 'messer',
         'Messer_Schwer': 'messer', 'Messer_Block': 'messer', 'Geraet_Blasebalg': 'klinge',
         'Axt_Trage': 'axt', 'Speer_Trage': 'speer', 'Messer_Trage': 'messer'}


def _rahmen(laengs, quer):
    """Rechtwinkliger Rahmen eines Glieds: y entlang, x quer zur Gelenkebene (Spalten x, y, z)."""
    y = laengs.normalized()
    x = (quer - y * quer.dot(y)).normalized()
    return Matrix((x, y, x.cross(y))).transposed()


def _um(achse, grad, v):
    """v um `achse` drehen."""
    return Matrix.Rotation(math.radians(grad), 3, achse) @ v


def _winkel_um(achse, von, nach):
    """Vorzeichenbehafteter Winkel (Grad) von `von` nach `nach` um `achse`, beide quer zur Achse gemessen."""
    u = (von - achse * von.dot(achse)).normalized()
    v = (nach - achse * nach.dot(achse)).normalized()
    return math.degrees(math.atan2(achse.dot(u.cross(v)), u.dot(v)))


class Rig:
    """Das Rig in Weltmetern: Achsen, Standpunkt, Knochenlängen — gelesen aus der Grundhaltung."""

    def __init__(self, arm):
        self.arm = arm
        self.eich = {}
        self.pb = arm.pose.bones
        self.welt = arm.matrix_world.copy()
        self.welt_inv = self.welt.inverted()
        self.rot = self.welt.to_3x3().normalized()
        pb = self.pb
        self.oben = Vector((0, 0, 1))
        rechts = (self.welt @ pb['UpperArm.R'].head) - (self.welt @ pb['UpperArm.L'].head)
        rechts.z = 0
        self.rechts = rechts.normalized()
        spitzen = Vector((0, 0, 0))
        for s in 'LR':
            spitzen += (self.welt @ pb['Foot.' + s].tail) - (self.welt @ pb['Foot.' + s].head)
        vorn = self.oben.cross(self.rechts)
        if vorn.dot(spitzen) < 0:
            vorn = -vorn
        self.vorn = vorn.normalized()
        h = self.welt @ pb['Hips'].head
        self.standpunkt = Vector((h.x, h.y, min((self.welt @ pb['Foot.' + s].head).z for s in 'LR')))

    def w(self, name, spitze=False):
        b = self.pb[name]
        return self.welt @ (b.tail if spitze else b.head)

    def punkt(self, r, v, h):
        return self.standpunkt + self.rechts * r + self.vorn * v + self.oben * h

    def richtung(self, r, v, h):
        return (self.rechts * r + self.vorn * v + self.oben * h).normalized()

    def update(self):
        bpy.context.view_layer.update()

    def weltdrehung(self, name, m4):
        """Knochen in der Welt um `m4` bewegen (Kinder folgen)."""
        b = self.pb[name]
        b.matrix = self.welt_inv @ m4 @ self.welt @ b.matrix
        self.update()

    def drehe(self, name, achse, grad):
        import math
        k = self.w(name)
        r = Matrix.Rotation(math.radians(grad), 4, achse)
        self.weltdrehung(name, Matrix.Translation(k) @ r @ Matrix.Translation(-k))

    def schiebe(self, name, delta):
        self.weltdrehung(name, Matrix.Translation(delta))

    def richte(self, name, ziel):
        """Y-Achse des Knochens (Kopf→Spitze) in der Welt nach `ziel` drehen, kleinste Drehung."""
        b = self.pb[name]
        jetzt = (self.rot @ b.matrix.to_3x3().col[1]).normalized()
        d = jetzt.rotation_difference(ziel.normalized()).to_matrix().to_4x4()
        k = self.w(name)
        self.weltdrehung(name, Matrix.Translation(k) @ d @ Matrix.Translation(-k))

    def lage(self, name, x_welt, y_welt):
        """Volle Lage setzen: Knochen-X nach `x_welt`, Knochen-Y nach `y_welt` (orthogonalisiert)."""
        b = self.pb[name]
        y = y_welt.normalized()
        x = (x_welt - y * x_welt.dot(y)).normalized()
        z = x.cross(y)
        soll = Matrix((x, y, z)).transposed()          # Spalten x, y, z
        k = self.w(name)
        m_arm = (self.rot.inverted() @ soll).to_4x4()
        m_arm.translation = self.welt_inv @ k
        # Skalierung des Knochens (1) behalten: `rot` ist normiert, die Translation im Armaturraum.
        b.matrix = m_arm
        self.update()

    def lokal(self, name, punkt_welt):
        """Ein Weltpunkt im Raum des Knochens — er wandert dann mit dem Knochen."""
        return (self.welt @ self.pb[name].matrix).inverted() @ punkt_welt

    def aus_lokal(self, name, p):
        return self.welt @ self.pb[name].matrix @ p

    def drehe_hin(self, name, von, nach):
        """Knochen um seinen Kopf so drehen, dass die Weltrichtung `von` nach `nach` zeigt."""
        d = von.normalized().rotation_difference(nach.normalized()).to_matrix().to_4x4()
        k = self.w(name)
        self.weltdrehung(name, Matrix.Translation(k) @ d @ Matrix.Translation(-k))

    def zwei(self, ober, unter, ziel, pol, ende):
        """
        Zwei-Knochen-IK: der Endpunkt `ende` (im Raum von `unter`) nach `ziel`, das Gelenk zur Seite
        `pol`. Die Knochen des Pakets sind 8 mm lange Stummel, nicht verbunden — die Glieder sind die
        Strecken zwischen den Köpfen, nicht die Knochen selbst (im Test gefunden: eine IK über
        Kopf→Spitze verfehlte die Hand um 30 cm).
        """
        s = self.w(ober)
        e1 = self.w(unter)
        e2 = self.aus_lokal(unter, ende)
        l1 = (e1 - s).length
        l2 = (e2 - e1).length
        d = ziel - s
        dist = max(abs(l1 - l2) + 1e-4, min(l1 + l2 - 1e-4, d.length))
        dn = d.normalized()
        a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
        h = max(0.0, l1 * l1 - a * a) ** 0.5
        p = pol - dn * pol.dot(dn)
        if p.length < 1e-6:
            p = self.vorn - dn * self.vorn.dot(dn)
        p.normalize()
        knie = s + dn * a + p * h
        if ober not in self.eich:
            # Eichung (und der Weg bis D455): kleinste Drehung aus der jetzigen Lage.
            self.drehe_hin(ober, e1 - s, knie - s)
            e1 = self.w(unter)
            self.drehe_hin(unter, self.aus_lokal(unter, ende) - e1, (s + dn * dist) - e1)
            return dn.cross(p).normalized()
        # D456: Die Verdrehung des Glieds um seine Längsachse folgt der Gelenkebene (Schulter–Ellbogen–Hand), wie am
        # Körper: Die Achse des Ellbogens steht quer zu ihr. Die kleinste Drehung aus der Grundhaltung (bis D455) kippte
        # um, sobald das Glied der Grundhaltung entgegen zeigte — gemessen an der ausgelieferten Datei: Sprünge von
        # 160–180° von einem Bild zum nächsten in Ober- und Unterarm (Ausholen über den Kopf, Durchzug quer). Die
        # Ebene ist stetig, solange der Pol nicht in der Linie Schulter–Hand liegt.
        n = dn.cross(p).normalized()
        co, cu = self.eich[ober]
        self.drehung(ober, _rahmen(knie - s, n) @ co)
        e1 = self.w(unter)
        self.drehung(unter, _rahmen((s + dn * dist) - e1, n) @ cu)
        return n

    def drehung(self, name, soll):
        """Weltdrehung (3×3) eines Knochens setzen, sein Kopf bleibt, Kinder folgen."""
        b = self.pb[name]
        k = self.w(name)
        m = (self.rot.inverted() @ soll).to_4x4()
        m.translation = self.welt_inv @ k
        b.matrix = m
        self.update()

    def eiche(self, ober, unter, ziel, pol, ende):
        """Die feste Lage beider Knochen gegen den Rahmen ihres Glieds merken — an einer gebeugten Pose, gestellt wie
        bis D455 (kleinste Drehung aus dem Stand): Dort sah die Verdrehung richtig aus, und von dort gilt sie jetzt."""
        self.eich.pop(ober, None)
        n = self.zwei(ober, unter, ziel, pol, ende)
        s, e1, e2 = self.w(ober), self.w(unter), self.aus_lokal(unter, ende)
        welt = lambda name: (self.rot @ self.pb[name].matrix.to_3x3()).normalized()
        self.eich[ober] = (_rahmen(e1 - s, n).inverted() @ welt(ober), _rahmen(e2 - e1, n).inverted() @ welt(unter))


RUMPF = (('Hips', 0.25), ('Abdomen', 0.25), ('Torso', 0.25), ('Chest', 0.25))
# Linke Hand entlang der Klinge/des Stiels von der rechten aus, Meter (+ = zur Spitze). D429: Axt −0,42 (am Stielende,
# hinter der rechten; bis D429 +0,22, die Hände vertauscht), je Schlüssel über das Posenfeld `griff`.
GRIFF = {'axt': -0.42, 'klinge': -0.09, 'speer': 0.5, 'messer': -0.13}
# D429: Lage der Axtkopfmitte vor dem rechten Handgelenk bei `griff` = −0,62 (rechte Hand an der vorderen
# Griffstelle, `tools/waffenmodelle.py`); gleitet die rechte Hand zurück, liegt der Kopf um so viel weiter vorn.
AXT_KOPF = 0.30
# D456: Schlagpunkt der Klingen vor dem rechten Handgelenk, Meter (rund zwei Drittel der Klinge — Überschlag, die
# Modelle tragen keinen Mittelpunkt des Schlags). Die Axt rechnet ihren aus dem Griff (`AXT_KOPF`).
SCHLAGPUNKT = {'axt': None, 'messer': 0.6, 'klinge': 0.5, 'hirsch': 0.35}
AXT_LINKS = 0.62


def _basis(rig, ad, action):
    """Alle Knochen im Bild 1 einer Action — die Grundhaltung eines Clips."""
    ad.action = action
    if hasattr(ad, 'action_slot') and action.slots:
        ad.action_slot = action.slots[0]
    bpy.context.scene.frame_set(1)
    rig.update()
    return {b.name: b.matrix_basis.copy() for b in rig.pb}


def _setze(rig, basis):
    for b in rig.pb:
        b.matrix_basis = basis[b.name]
    rig.update()


def _pol(rig, seite, ziel):
    """
    D456: wohin der Ellbogen ausweicht — ein Feld über die Richtung Schulter→Hand statt eines Pols je Schlüssel.
    Ein fester Pol (bis D455: unten-aussen-hinten, über dem Kopf von Hand umgestellt) kippt, sobald die Hand in seiner
    Linie liegt; seit jedes Bild gerechnet wird, sprang der Ellbogen dort von Bild zu Bild auf die andere Seite.
      * **Hand in Brusthöhe** (Richtung flach): der Ellbogen hängt — unten, hinten und etwas aussen (an den Rippen).
        Das trägt auch, wenn die Hand dicht vor der Brust liegt (Stielende im Ausholen).
      * **Hand über der Schulter oder darunter** (Richtung steil, der feste Pol läge in der Linie): ein Bezugspol, mit
        der kleinsten Drehung in die Armrichtung getragen — er gibt hängend „Ellbogen nach hinten-aussen“ (wie der
        feste Pol dort, die beiden Regeln widersprechen sich an der Naht nicht), über dem Kopf „aussen“. Seine eine
        unstetige Stelle liegt hinter dem Rücken auf der anderen Seite, flach — dort gilt er nicht.
    Dazwischen wird gemischt. Aussen und vorn im Rahmen der Brust (sie dreht mit dem Rumpf), unten in der Welt.
    """
    brust = (rig.rot @ rig.pb['Chest'].matrix.to_3x3()).normalized() @ rig.brust0.inverted()
    r, v = brust @ rig.rechts, brust @ rig.vorn
    o = rig.oben
    d = (ziel - rig.w('UpperArm.' + ('R' if seite > 0 else 'L'))).normalized()
    haengt = r * (0.3 * seite) - v * 0.6 - o * 0.7
    haengt = haengt - d * haengt.dot(d)
    steil = _weich((abs(d.dot(o)) - 0.5) / 0.35)
    if steil <= 0:
        return haengt.normalized()
    bezug = (r * (0.7 * seite) + v * 0.7 + (brust @ rig.oben) * 0.15).normalized()
    pol0 = r * (0.75 * seite) - v * 0.5 - (brust @ rig.oben) * 0.45
    pol0 = (pol0 - bezug * pol0.dot(bezug)).normalized()
    feld = bezug.rotation_difference(d).to_matrix() @ pol0
    p = haengt * (1 - steil) + feld * steil
    return (p if p.length > 1e-4 else feld).normalized()


def _pose(rig, basis, pose, bewegung, schneide=None, winkel=None, fest=False):
    """Eine Pose aus der Grundhaltung. `bewegung`: Weltrichtung des Schlagpunkts um diesen Schlüssel — nur in Hieben
    (`fest`: die lange Schneide führt, kein Umschlagen). `schneide` (D456): die Weltrichtung der Schneide ist schon
    bekannt (Zwischenbild). `winkel` = (φ, ψ) der Hut (D456): ausserhalb der Hiebe steht die Schneide um φ gegen die
    Senkrechte gedreht (um die Klinge), die linke Hand um ψ gegen die rechte — so greifen beide Hände in jedem Bild
    gleich um die Waffe, statt dem Unterarm zu folgen (der sprang, sobald er in der Flucht des Stiels lag)."""
    _setze(rig, basis)
    if pose == 'stand':
        return
    knoechel = {s: rig.w('Foot.' + s) for s in 'LR'}
    # Endpunkte der Glieder im Raum des unteren Knochens: Knöchel, Handgelenke.
    ende = {s: rig.lokal('LowerLeg.' + s, knoechel[s]) for s in 'LR'}
    hand_ende = {s: rig.lokal('LowerArm.' + s, rig.w('Wrist.' + s)) for s in 'LR'}
    if pose.get('gier'):
        # D460 (Wenden): der ganze Körper um die Hochachse durch das Becken (+ = nach links); die Füsse stellt `'kreis'`.
        rig.drehe('Body', rig.oben, pose['gier'])
    koerper = pose.get('koerper', (0, 0))
    v, h = koerper[0], koerper[1]
    seit = koerper[2] if len(koerper) > 2 else 0   # D460: das Becken pendelt über den Standfuss
    if v or h or seit:
        rig.schiebe('Body', rig.vorn * v + rig.oben * h + rig.rechts * seit)
    # D460: Das Becken kippt um die Längsachse (+ = rechte Hüfte tiefer — im Gang sinkt die Schwungseite); die
    # Wirbelsäule richtet sich darüber wieder auf (Gegendrehung an `Hips`), die Schultern bleiben waagerecht.
    kippe = pose.get('kippe', 0)
    if kippe:
        rig.drehe('Body', rig.vorn, kippe)
        rig.drehe('Hips', rig.vorn, -kippe)
    # D414: Die Hüfte führt — das Becken (Body, samt Rücken) dreht vor, die Brust wird um dasselbe
    # zurückgedreht: Die Schultern stehen, wo `rumpf` sie hinstellt, das Becken ist schon weiter.
    huefte = pose.get('huefte', 0)
    if huefte:
        rig.drehe('Body', rig.oben, huefte)
    dreh, neig = pose.get('rumpf', (0, 0))
    for name, anteil in RUMPF:
        if name in rig.pb:
            if dreh: rig.drehe(name, rig.oben, dreh * anteil)
            if neig: rig.drehe(name, rig.rechts, -neig * anteil)
    if huefte:
        rig.drehe('Chest', rig.oben, -huefte)
    # Der Kopf dreht gegen: Der Blick bleibt beim Gegner. D456: ganz, nicht zu drei Vierteln (bis D455 blieb der Kopf
    # bei 55° Rumpfdrehung 14° neben dem Ziel) — Hals und Kopf teilen sich die Drehung, der Hals höchstens 35°, der
    # Kopf höchstens 40° (zusammen unter der Beweglichkeit der Halswirbelsäule von rund 80°, Überschlag). Beim
    # Vorbeugen hebt der Kopf vier Fünftel der Neigung zurück: Der Blick geht zum Ziel, nicht auf die eigenen Füsse.
    if dreh:
        hals = max(-35.0, min(35.0, 0.45 * dreh))
        rig.drehe('Neck', rig.oben, -hals)
        rig.drehe('Head', rig.oben, -max(-40.0, min(40.0, dreh - hals)))
    if neig:
        rig.drehe('Neck', rig.rechts, max(-20.0, min(20.0, 0.3 * neig)))
        rig.drehe('Head', rig.rechts, max(-30.0, min(30.0, 0.5 * neig)))
    if pose.get('kopf'):
        # D460: Kopf zusätzlich (dreh + = nach links wie `rumpf`, nick + = Kinn zur Brust) — Blick voraus beim Wenden,
        # Kinn an die Brust in der Rolle.
        kd, kn = pose['kopf']
        for kname in ('Neck', 'Head'):
            if kd: rig.drehe(kname, rig.oben, kd / 2)
            if kn: rig.drehe(kname, rig.rechts, -kn / 2)
    for s, feld, seite in (('R', 'fuss_r', 1), ('L', 'fuss_l', -1)):
        fuss = pose.get(feld, (0, 0))
        nick = gier = 0.0
        if fuss and fuss[0] == 'kreis':
            # D460 (Wenden): Der Fuss steht um `grad` um die Hochachse durch den Standpunkt gedreht (+ = nach links, wie
            # die Regel den Blick zählt), `hub` Meter gehoben — die Übertragung stellt ihn am Ziel genauso um die Mitte
            # der Füsse des ausgelieferten Stands (`weltformel.stelle_fuesse`, `kreis`).
            _, kgrad, khub = fuss
            arm_ = knoechel[s] - rig.standpunkt
            arm_.z = 0
            delta = Matrix.Rotation(math.radians(kgrad), 3, rig.oben) @ arm_ - arm_ + rig.oben * khub
            gier = kgrad
        else:
            fv, fr = fuss[0], fuss[1]
            delta = rig.vorn * fv + rig.rechts * fr
            if len(fuss) > 2:
                delta = delta + rig.oben * fuss[2]   # D456: der Fuss hebt im Schritt ab
            if len(fuss) > 3:
                nick = fuss[3]                       # D460: Fussabrollen — Grad, + = Zehen hoch (Fersenauftritt)
            if len(fuss) > 4:
                gier = fuss[4]
        if delta.length > 1e-6:
            rig.schiebe('Foot.' + s, delta)
            if 'PT.' + s in rig.pb:
                rig.schiebe('PT.' + s, delta)
        if nick:
            rig.drehe('Foot.' + s, rig.rechts, nick)
        if gier:
            rig.drehe('Foot.' + s, rig.oben, gier)
        # Knie nach vorn; `knie` (D460) spreizt sie (Hocke in der Rolle, Froschbeine beim Schwimmen).
        knie = Matrix.Rotation(math.radians(gier), 3, rig.oben) @ (rig.vorn + rig.rechts * pose.get('knie', 0.15) * seite)
        rig.zwei('UpperLeg.' + s, 'LowerLeg.' + s, knoechel[s] + delta, knie, ende[s])

    if 'arm_r' in pose or 'arm_l' in pose:
        # D460: Handziele von der Schulter aus, im Rahmen der Brust (sie dreht und neigt mit dem Rumpf) — so schwingen
        # die Arme am Körper, wohin der auch pendelt. Meter des Quellskeletts (Arm 0,45 m).
        brust = (rig.rot @ rig.pb['Chest'].matrix.to_3x3()).normalized() @ rig.brust0.inverted()
        aus_schulter = lambda sn, a: rig.w('UpperArm.' + sn) + brust @ (rig.rechts * a[0] + rig.vorn * a[1] + rig.oben * a[2])
    # D460: `arm_w` 0…1 mischt die Arme zwischen der Grundhaltung (wo sie nach Rumpf und Becken hängen) und den Zielen —
    # so kommen Clips weich aus dem Stand und kehren in ihn zurück.
    aw = pose.get('arm_w', 1.0) if 'arm_r' in pose or 'arm_l' in pose else 1.0
    if 'hand' in pose or ('arm_r' in pose and aw > 1e-4):
        ziel = aus_schulter('R', pose['arm_r']) if 'arm_r' in pose else rig.punkt(*pose['hand'])
        if aw < 1:
            ziel = rig.w('Wrist.R').lerp(ziel, aw)
            jetzt_ = -((rig.rot @ rig.pb['Wrist.R'].matrix.to_3x3()).normalized().col[0])
        rig.zwei('UpperArm.R', 'LowerArm.R', ziel, _pol(rig, 1, ziel), hand_ende['R'])
        klinge = rig.richtung(*pose['richt'])
        if aw < 1:
            klinge = jetzt_.lerp(klinge, aw).normalized()
        unterarm = (rig.w('Wrist.R') - rig.w('LowerArm.R')).normalized()
        y = bewegung - klinge * bewegung.dot(klinge)
        hoch = rig.oben - klinge * rig.oben.dot(klinge)
        if schneide is not None:
            y = schneide - klinge * schneide.dot(klinge)
            if y.length < 1e-4:
                y = unterarm - klinge * unterarm.dot(klinge)
        elif fest and y.length >= 0.05:
            pass     # Hieb: Die Schneide führt (D429 Axt, D414 Messer, D456 auch die Klinge mit ihrer langen Schneide).
        elif winkel is not None and hoch.length > 0.05:
            y = _um(klinge, winkel[0], hoch.normalized())
        elif y.length < 0.05:
            y = unterarm - klinge * unterarm.dot(klinge)
        elif pose.get('zwei') not in ('axt', 'speer', 'messer') and y.dot(unterarm) < 0:
            y = -y   # die Klinge hat zwei Schneiden: das Handgelenk knickt nicht nach hinten
            # (Messer und Axt haben eine: Die Schneide führt, auch wenn der Unterarm dafür drehen muss.)
        rig.lage('Wrist.R', -klinge, y)
        y = (y - klinge * y.dot(klinge)).normalized()
        if pose.get('zwei'):
            hand = rig.w('Wrist.R')
            abstand = pose.get('griff', GRIFF[pose['zwei']])
            griff = hand + klinge * abstand
            if pose['zwei'] == 'axt':
                # D429: Reicht der linke Arm nicht bis ans Stielende, rückt die Hand am Stiel zur rechten (wie D188 in
                # `weltformel.greife_links`) — sie bleibt auf dem Stiel; die Szene legt das Stielende dann in sie.
                schulter = rig.w('UpperArm.L')
                reich = (rig.w('LowerArm.L') - schulter).length + (rig.w('Wrist.L') - rig.w('LowerArm.L')).length - 0.01
                while (griff - schulter).length > reich and abstand < -0.1:
                    abstand += 0.01
                    griff = hand + klinge * abstand
                if abstand != pose.get('griff', GRIFF['axt']) and schneide is None:
                    print(f'    Griff links: Arm reicht nicht, linke Hand {abstand:.2f} statt {pose.get("griff", GRIFF["axt"]):.2f}')
            rig.zwei('UpperArm.L', 'LowerArm.L', griff, _pol(rig, -1, griff), hand_ende['L'])
            ua = (rig.w('Wrist.L') - rig.w('LowerArm.L')).normalized()
            if winkel is not None and winkel[1] is not None:
                rig.lage('Wrist.L', -klinge, _um(klinge, winkel[1], y))
            else:
                rig.lage('Wrist.L', -klinge, ua - klinge * ua.dot(klinge) if abs(ua.dot(klinge)) < 0.95 else y)
    if pose.get('links') is not None:
        rig.zwei('UpperArm.L', 'LowerArm.L', rig.punkt(*pose['links']), _pol(rig, -1, rig.punkt(*pose['links'])), hand_ende['L'])
    if 'arm_l' in pose and aw > 1e-4:
        zl = rig.w('Wrist.L').lerp(aus_schulter('L', pose['arm_l']), aw)
        rig.zwei('UpperArm.L', 'LowerArm.L', zl, _pol(rig, -1, zl), hand_ende['L'])
    lage = pose.get('lage')
    if lage:
        # D460: den ganzen Körper legen und drehen — was die Posenfelder bis D456 nicht konnten (Rolle, Wenden,
        # Schwimmen). `nick` (+ = vornüber), `roll` (+ = rechte Seite tiefer), `gier` (+ = nach links) in Grad um den
        # Punkt `um` (rechts, vorn, hoch vom Standpunkt), danach `schub` (Meter). Alles davor ist aufrecht gestellt
        # (Füsse, Hände im Rahmen des Körpers) und dreht starr mit: Becken samt Rumpf und Beinen, dazu die Füsse (sie
        # hängen im Quellskelett an der Wurzel, nicht am Bein).
        um = rig.punkt(*lage.get('um', (0, 0, 0.9)))
        dreh_ = (Matrix.Rotation(math.radians(lage.get('gier', 0)), 4, rig.oben)
                 @ Matrix.Rotation(math.radians(-lage.get('nick', 0)), 4, rig.rechts)
                 @ Matrix.Rotation(math.radians(lage.get('roll', 0)), 4, rig.vorn))
        sch = lage.get('schub', (0, 0, 0))
        m4 = (Matrix.Translation(rig.rechts * sch[0] + rig.vorn * sch[1] + rig.oben * sch[2])
              @ Matrix.Translation(um) @ dreh_ @ Matrix.Translation(-um))
        for kname in ('Body', 'Foot.L', 'Foot.R', 'PT.L', 'PT.R'):
            if kname in rig.pb:
                rig.weltdrehung(kname, m4)


def _handpunkt(rig, basis, pose):
    if pose != 'stand' and 'hand' in pose:
        return rig.punkt(*pose['hand'])
    _setze(rig, basis)
    return rig.w('Wrist.R')


def _kopfbahn(rig, basis, schluessel, grund, achse='axt'):
    """D429: Mitte des Axtkopfs je Schlüssel — rechte Hand plus Stielrichtung mal Abstand (der Kopf liegt um so weiter
    vorn, je weiter die rechte Hand zum Stielende gleitet). 'stand' ist der erste Schlüssel der Grundhaltung."""
    aus = []
    for _, pose in schluessel:
        if pose == 'stand' and grund in CLIPS and CLIPS[grund][2][0][1] != 'stand':
            pose = CLIPS[grund][2][0][1]
        if pose != 'stand' and 'hand' in pose:
            r = rig.richtung(*pose['richt'])
            abstand = AXT_KOPF + AXT_LINKS + pose.get('griff', GRIFF['axt']) if achse == 'axt' else SCHLAGPUNKT[achse]
            aus.append(rig.punkt(*pose['hand']) + r * abstand)
        else:
            aus.append(_handpunkt(rig, basis, pose))
    return aus


# ---- D456: Zwischenbilder nach den Handwerksregeln der Animation --------------------------------------------------
# Bis D455 trug ein Clip nur seine Schlüssel; dazwischen mischte Blender die Drehung jedes Knochens für sich. Das gab
# gerade Stücke von Schlüssel zu Schlüssel, alle Gelenke hielten im selben Bild an, und ein Schritt schleifte den Fuss
# über den Boden (benannt in D452). Jetzt wird **jedes Bild** aus den Posenfeldern gerechnet und per IK gestellt:
#   * **Bögen:** Die Hand läuft auf einer Kurve durch ihre Schlüssel (Hermite mit Tangenten aus den Nachbarn) statt auf
#     Geraden; am Clipanfang und -ende ist die Tangente null (weiches Ein- und Ausschwingen).
#   * **Überlappung:** Becken, Schwerpunkt und Füsse sind der Hand voraus, der Rumpf dazwischen, die Waffe hängt nach
#     (`VORAUS`, Bilder bei 24/s) — Hüfte → Rumpf → Arm → Waffe. Der Versatz blendet in den ersten und letzten Bildern
#     aus, damit Anfang und Ende genau die Hut bleiben. Hand und Waffenrichtung sind Weltziele: Die **Hand** steht in
#     Scheitel und Durchzug genau dort, wo der Schlüssel sie hinstellt; der Körper ist dort schon ein Stück weiter.
#   * **Kein gemeinsamer Halt:** Weil jede Ebene ihren eigenen Versatz hat, kommen Becken, Rumpf und Hand nacheinander
#     zur Ruhe.
#   * **Füsse:** stehen zwischen gleichen Schlüsseln still (IK je Bild), und ein Schritt hebt den Fuss (`_fusshub`).
# Geprüft an der ausgelieferten Datei in `tests/clipguete.test.ts`.
VORAUS = {'huefte': 1.5, 'koerper': 1.0, 'fuss_l': 1.5, 'fuss_r': 1.5, 'rumpf': 0.75, 'hand': 0.0,
          'griff': 0.0, 'links': -1.0, 'richt': -0.5}
EINBLENDEN = 3.0       # Bilder, über die der Versatz am Clipanfang und -ende ein- und ausblendet
WINKEL = {}            # Hut → (φ Schneide gegen die Senkrechte, ψ linke Hand gegen die rechte), Grad um die Klinge
GRIFFVERLAUF = {}      # Clip → [(Bild, Griff links an Stiel, Schaft oder Griff)] je Bild, für `weltformel.uebertrage(stiel=…)`


def _weich(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def _kurve(zeiten, werte, t, bogen=False):
    """Wert einer Spur zur Zeit t. `werte`: Tupel je Schlüssel. Hermite; Tangenten: `bogen` = mittlere Steigung der
    Nachbarn (Catmull-Rom, läuft durch den Schlüssel durch), sonst monoton (Fritsch–Carlson: kein Überschwingen, an
    Umkehrpunkten null). An den Enden null."""
    n = len(zeiten)
    if t <= zeiten[0]:
        return tuple(werte[0])
    if t >= zeiten[-1]:
        return tuple(werte[-1])
    i = max(j for j in range(n - 1) if zeiten[j] <= t)
    h = zeiten[i + 1] - zeiten[i]
    u = (t - zeiten[i]) / h
    aus = []
    for c in range(len(werte[0])):
        def steig(j):
            if j <= 0 or j >= n - 1:
                return 0.0
            d0 = (werte[j][c] - werte[j - 1][c]) / (zeiten[j] - zeiten[j - 1])
            d1 = (werte[j + 1][c] - werte[j][c]) / (zeiten[j + 1] - zeiten[j])
            if bogen:
                # Gewichtet nach der Länge der Abschnitte: Der kurze, schnelle Abschnitt bestimmt nicht allein.
                h0, h1 = zeiten[j] - zeiten[j - 1], zeiten[j + 1] - zeiten[j]
                return (d0 * h1 + d1 * h0) / (h0 + h1)
            if d0 * d1 <= 0:
                return 0.0
            return 2 * d0 * d1 / (d0 + d1)
        p0, p1, m0, m1 = werte[i][c], werte[i + 1][c], steig(i) * h, steig(i + 1) * h
        aus.append((2 * u ** 3 - 3 * u ** 2 + 1) * p0 + (u ** 3 - 2 * u ** 2 + u) * m0
                   + (-2 * u ** 3 + 3 * u ** 2) * p1 + (u ** 3 - u ** 2) * m1)
    return tuple(aus)


def _fusshub(zeiten, werte, t):
    """Höhe des Knöchels über seiner Standlage: Wandert der Fuss zwischen zwei Schlüsseln um mehr als 2 cm, hebt er ab —
    ein Drittel der Schrittlänge, mindestens 3, höchstens 10 cm (flacher Kampfschritt, kein Gehen), als halber Sinus
    über den Weg."""
    if t <= zeiten[0] or t >= zeiten[-1]:
        return 0.0
    i = max(j for j in range(len(zeiten) - 1) if zeiten[j] <= t)
    a, b = werte[i], werte[i + 1]
    d = math.hypot(b[0] - a[0], b[1] - a[1])
    if d <= 0.02:
        return 0.0
    w = _kurve(zeiten, werte, t)
    anteil = max(0.0, min(1.0, math.hypot(w[0] - a[0], w[1] - a[1]) / d))
    return max(0.03, min(0.10, d / 3)) * math.sin(math.pi * anteil)


def _in_rvh(rig, punkt=None, richtung=None):
    v = (punkt - rig.standpunkt) if punkt is not None else richtung
    return (v.dot(rig.rechts), v.dot(rig.vorn), v.dot(rig.oben))


def _voll(rig, basis, pose, grundpose):
    """Ein Schlüssel mit allen Feldern. 'stand' = die Grundhaltung: Hand und Waffe dort, wo sie in ihr stehen, der
    Körper unverändert; Griff, Pol und freie Hand wie im ersten Schlüssel der Grundhaltung."""
    if pose == 'stand':
        _setze(rig, basis)
        m = (rig.welt @ rig.pb['Wrist.R'].matrix).to_3x3().normalized()
        pose = dict(hand=_in_rvh(rig, punkt=rig.w('Wrist.R')), richt=_in_rvh(rig, richtung=-(m.col[0].normalized())))
        for f in ('zwei', 'griff'):
            if grundpose and f in grundpose:
                pose[f] = grundpose[f]
        if grundpose and 'links' in grundpose:
            pose['links'] = _in_rvh(rig, punkt=rig.w('Wrist.L'))
    voll = dict(pose)
    voll.setdefault('koerper', (0, 0)); voll.setdefault('rumpf', (0, 0)); voll.setdefault('huefte', 0)
    voll.setdefault('fuss_l', (0, 0)); voll.setdefault('fuss_r', (0, 0))
    if voll.get('zwei'):
        voll.setdefault('griff', GRIFF[voll['zwei']])
    if voll.get('beide'):
        # D456: die freie Hand greift an den Knauf — Ziel ist die Stelle am Griff hinter der rechten Hand.
        r = Vector(voll['richt']).normalized()
        voll['links'] = tuple(Vector(voll['hand']) + r * GRIFF['klinge'])
    voll['beide'] = 1.0 if voll.get('beide') else 0.0
    return voll


def baue_clip(rig, ad, name, basis):
    grund, art, schluessel = CLIPS[name]
    if art == 'gerechnet':
        return baue_gerechnet(rig, ad, name, basis)     # D460
    akt = bpy.data.actions.new(name)
    ad.action = akt
    vorige = {}
    punkte = [_handpunkt(rig, basis, p) for _, p in schluessel]
    # D429: Bei der Axt dreht das Handgelenk nach der Bahn des Kopfs — die Schneide führt dort, wo geschnitten wird.
    # D456: ebenso bei allen Hieben mit Klinge (`SCHLAGPUNKT`: der Punkt der Klinge, der trifft). Stösse und Haltungen
    # bleiben bei der Bahn der Hand.
    fenster = TREFFER.get(name) or FENSTER.get(name)
    einschneidig = name in HIEBE and fenster is not None
    bahn = _kopfbahn(rig, basis, schluessel, grund, ACHSE.get(name)) if ACHSE.get(name) in SCHLAGPUNKT and name in HIEBE else punkte
    bilder = [b for b, _ in schluessel]
    # 1. Durchgang: die Schlüssel wie bis D455 stellen und die Lage des rechten Handgelenks in der Welt merken — sie
    #    trägt die Schneide. Zwischen den Schlüsseln dreht sie auf dem kürzesten Weg (Slerp).
    ist_hieb = name in HIEBE
    if grund not in CLIPS and schluessel[0][1] != 'stand' and 'hand' in schluessel[0][1]:
        # Eine Hut: φ und ψ am ersten Schlüssel messen, gestellt wie bis D455 (Schneide und linke Hand nach dem
        # Unterarm) — die Hut sieht aus wie vorher, und alle Clips der Waffe greifen von da an gleich.
        _pose(rig, basis, schluessel[0][1], Vector((0, 0, 0)))
        klinge = rig.richtung(*schluessel[0][1]['richt'])
        hoch = rig.oben - klinge * rig.oben.dot(klinge)
        yr = (rig.welt @ rig.pb['Wrist.R'].matrix).to_3x3().normalized().col[1]
        yl = (rig.welt @ rig.pb['Wrist.L'].matrix).to_3x3().normalized().col[1]
        WINKEL[name] = (_winkel_um(klinge, hoch, yr), _winkel_um(klinge, yr, yl) if schluessel[0][1].get('zwei') else None)
        print(f'  Hut {name}: Schneide φ {WINKEL[name][0]:.0f}° gegen die Senkrechte' +
              (f', linke Hand ψ {WINKEL[name][1]:.0f}° gegen die rechte' if WINKEL[name][1] is not None else ''))
    winkel = WINKEL.get(name) or WINKEL.get(grund)
    gelenk = []
    for i, (bild, pose) in enumerate(schluessel):
        a = bahn[max(0, i - 1)]
        b = bahn[min(len(bahn) - 1, i + 1)]
        if einschneidig:
            # D429: Die Schneide zeigt schon beim Ausholen in die Richtung, in die der Schlag gehen wird (die Axt dreht
            # im Scheitel nicht um), im Schlag in die Bahn, im Nachschwung dorthin, wohin der Kopf weiterläuft.
            iS, iD = bilder.index(fenster[0]), bilder.index(fenster[1])
            if i <= iS:
                a, b = bahn[iS], bahn[iS + 1]
            elif i >= iD:
                a, b = bahn[i - 1], bahn[i]
        _pose(rig, basis, pose, (b - a) if ist_hieb else Vector((0, 0, 0)), winkel=winkel, fest=ist_hieb)
        q = (rig.welt @ rig.pb['Wrist.R'].matrix).to_3x3().normalized().to_quaternion()
        if gelenk and q.dot(gelenk[-1]) < 0:
            q.negate()
        gelenk.append(q)
    # 2. Durchgang (D456): jedes Bild aus den Feldern, mit Versatz je Ebene.
    grundpose = CLIPS[grund][2][0][1] if grund in CLIPS and CLIPS[grund][2][0][1] != 'stand' else None
    voll = [_voll(rig, basis, p, grundpose) for _, p in schluessel]
    hat_hand = all('hand' in v for v in voll)
    hat_links = any(v.get('links') is not None for v in voll)
    if hat_links:
        _setze(rig, basis)
        ruhe_links = _in_rvh(rig, punkt=rig.w('Wrist.L'))
        for v in voll:
            if v.get('links') is None:
                v['links'] = ruhe_links
    zeiten = [float(b) for b in bilder]
    erstes, letztes = bilder[0], bilder[-1]
    spur = lambda feld: [v[feld] if isinstance(v[feld], tuple) else (v[feld],) for v in voll]
    zwei = next((v['zwei'] for v in voll if v.get('zwei')), None)
    verlauf = []

    def felder(bild):
        """Die Pose eines Bilds aus den Kurven der Felder, jede Ebene mit ihrem Versatz."""
        blend = 0.0 if art == 'schleife' else _weich((bild - erstes) / EINBLENDEN) * _weich((letztes - bild) / EINBLENDEN)
        # Die Waffe hängt beim Ausholen und im Nachschwung nach; zwischen Scheitel und Durchzug holt sie auf und
        # steht im Durchzug genau, wo der Schlüssel sie hinstellt (das Trefferfenster ist ein Kampfwert).
        nach = 1.0 if fenster is None else 1.0 - _weich((bild - fenster[0]) / (fenster[1] - fenster[0])) * _weich((fenster[1] + 2.0 - bild) / 2.0)
        zeit = lambda feld: bild + VORAUS[feld] * blend * (nach if feld == 'richt' else 1.0)
        pose = {}
        for feld in ('koerper', 'rumpf', 'huefte'):
            w = _kurve(zeiten, spur(feld), zeit(feld))
            pose[feld] = w[0] if feld == 'huefte' else w
        for feld in ('fuss_l', 'fuss_r'):
            w = _kurve(zeiten, spur(feld), zeit(feld))
            pose[feld] = (w[0], w[1], _fusshub(zeiten, spur(feld), zeit(feld)))
        if hat_hand:
            pose['hand'] = _kurve(zeiten, spur('hand'), zeit('hand'), bogen=True)
            r = Vector(_kurve(zeiten, spur('richt'), zeit('richt'), bogen=True))
            if r.length < 1e-3:
                r = Vector(voll[max(j for j in range(len(bilder)) if bilder[j] <= bild)]['richt'])
            pose['richt'] = tuple(r.normalized())
            if zwei:
                pose['zwei'] = zwei
                pose['griff'] = _kurve(zeiten, [(v.get('griff', GRIFF[zwei]),) for v in voll], zeit('griff'))[0]
        if hat_links:
            pose['links'] = _kurve(zeiten, spur('links'), zeit('links'), bogen=True)
            am_knauf = _kurve(zeiten, spur('beide'), float(bild))[0]
            if am_knauf > 1e-3 and hat_hand:
                # Am Knauf folgt die linke Hand der Waffe dieses Bilds, nicht ihrer eigenen (nachhängenden) Kurve.
                knauf = Vector(pose['hand']) + Vector(pose['richt']) * GRIFF['klinge']
                pose['links'] = tuple(Vector(pose['links']).lerp(knauf, am_knauf))
        return pose

    posen = {bild: felder(bild) for bild in range(erstes, letztes + 1)}
    # Die Schneide zwischen den Schlüsseln: mit der Klinge mitgeführt (von Bild zu Bild die kleinste Drehung, also ohne
    # eigenes Rollen), und was am nächsten Schlüssel an Rollen fehlt, gleichmässig über den Abschnitt verteilt. Ein
    # Mischen der beiden Schlüssellagen (Slerp) kippte, wenn die Klinge dazwischen einen weiten Bogen läuft.
    schneiden = {}
    if hat_hand:
        klinge = {b: rig.richtung(*posen[b]['richt']) for b in posen}
        quer = lambda v, k: (v - k * v.dot(k)).normalized()
        for i in range(len(bilder) - 1):
            b0, b1 = bilder[i], bilder[i + 1]
            y = quer(gelenk[i].to_matrix().col[1], klinge[b0])
            mit = {b0: y}
            for f in range(b0 + 1, b1 + 1):
                y = quer(klinge[f - 1].rotation_difference(klinge[f]).to_matrix() @ y, klinge[f])
                mit[f] = y
            fehlt = _winkel_um(klinge[b1], mit[b1], quer(gelenk[i + 1].to_matrix().col[1], klinge[b1]))
            for f in range(b0, b1 + 1):
                schneiden[f] = _um(klinge[f], fehlt * (f - b0) / (b1 - b0), mit[f])
    for bild in range(erstes, letztes + 1):
        if bild in bilder and schluessel[bilder.index(bild)][1] == 'stand':
            _setze(rig, basis)       # die Hut wörtlich: Anfang und Ende sind dieselbe Pose
        else:
            pose = posen[bild]
            _pose(rig, basis, pose, Vector((0, 0, 0)), schneiden.get(bild), winkel=winkel)
            if pose.get('zwei'):
                verlauf.append((bild, pose['griff']))
        for kn in rig.pb:
            if kn.rotation_mode != 'QUATERNION':
                kn.rotation_mode = 'QUATERNION'
            q = kn.rotation_quaternion.copy()
            if kn.name in vorige and q.dot(vorige[kn.name]) < 0:
                q.negate()
                kn.rotation_quaternion = q
            vorige[kn.name] = q
            kn.keyframe_insert('rotation_quaternion', frame=bild)
            kn.keyframe_insert('location', frame=bild)
    if verlauf:
        hut = grundpose.get('griff', GRIFF[zwei]) if grundpose else GRIFF[zwei]
        GRIFFVERLAUF[name] = sorted(set(verlauf) | {(b, hut) for (b, p) in schluessel if p == 'stand'})
    # Zwischen den Bildern nichts mehr runden lassen: Die Kurve steckt in den Bildern selbst.
    for fc in _fkurven(akt):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    # Nachmessen: Die Hand steht im ausgewerteten Clip dort, wo der Schlüssel sie hinstellt.
    if hasattr(ad, 'action_slot') and akt.slots:
        ad.action_slot = akt.slots[0]
    for (bild, pose), soll in zip(schluessel, punkte):
        bpy.context.scene.frame_set(bild)
        rig.update()
        fehler = (rig.w('Wrist.R') - soll).length
        if fehler > 0.02:
            print(f'  WARNUNG {name} Bild {bild}: Hand {fehler * 100:.0f} cm neben dem Ziel')
    ad.action = None
    tr = ad.nla_tracks.new()
    tr.name = name
    st = tr.strips.new(name, 1, akt)
    if hasattr(st, 'action_slot') and akt.slots:
        st.action_slot = akt.slots[0]
    tr.mute = True
    print(f'  Waffenclip {name}: {len(schluessel)} Schlüssel, Bild 1–{schluessel[-1][0]} ({art}, aus {grund})')
    return akt


# ---- D460: Fortbewegung — gerechnete Clips ------------------------------------------------------------------------
# D456 baute Hiebe aus wenigen Schlüsseln; Gang, Lauf und Rolle gingen so nicht: „die Posenfelder können den Körper nicht
# legen oder um sich drehen, und für einen Gangzyklus fehlt das Fussabrollen“ (Waffenbewegungen §9.4). Hier wird die Pose
# **je Bild aus einer Funktion** gerechnet (`RECHNE`), und `_pose` kennt dafür neue Felder: Fuss mit Abrollwinkel und
# Drehung (`fuss_*` 4./5. Wert, `'kreis'`), Becken seitlich und gekippt (`koerper` 3. Wert, `kippe`), Arme von der
# Schulter aus (`arm_r`, `arm_l`), den ganzen Körper gedreht und gelegt (`gier`, `lage`), Kopf (`kopf`).
#
# **Der Gangzyklus** (`_gangpose`) ist ein Modell, kein Mocap: Der Standfuss liegt in der Welt fest — im Raum der Figur
# wandert sein Aufstandspunkt mit genau dem Tempo `v` nach hinten —, rollt von der Ferse (Drehpunkt Fersenkante) über die
# Sohle auf den Ballen (Drehpunkt Ballen, die Zehen bleiben liegen: `ZEHEN`) und schwingt auf einer Kurve wieder vor. Das
# Becken folgt der Physik des Schritts: im Gehen ein umgekehrtes Pendel (hoch über dem Standbein, tief im Doppelstand),
# im Laufen Feder und Flug (tief in der Standmitte, Wurfparabel in der Flugphase — Einfederung D = g·t_f·t_c / 2π, damit
# das Tempo am Absprung stetig ist, Steighöhe g·t_f² / 8). Es pendelt über den Standfuss, kippt zur Schwungseite und
# dreht mit dem Schwungbein vor; die Schultern drehen dagegen, die Arme schwingen gegengleich. Die Beckenhöhe wird so
# gelegt, dass kein Bein über seine Länge hinaus muss (`_beckenbasis`) — das Knie streckt sich am Fersenauftritt und
# am Abdruck fast ganz und beugt dazwischen, wie am Menschen.
#
# **Anker (D398)** mit Quelle je Wert: `docs/design/BRACHLAND_Waffenbewegungen_v1.md` §10.1.
# Alle Längen dieses Abschnitts sind **Meter der Hauptfigur** (Ziel), nicht des Quellskeletts: `MASS` rechnet um.
MASS = 0.96            # Zielmeter je Quellmeter (Beckenhöhe); `clipnachbau.py` setzt den gemessenen Wert
G_ERDE = 9.81
# Fuss der Hauptfigur: Knöchel → Ballen waagerecht, Sohle unter dem Knöchel, Fersenkante hinter dem Knöchel, Ballen → Zehenspitze
FUSS_VOR, SOHLE, FERSE_HINTER, ZEHE = 0.14, 0.08, 0.05, 0.13
# Bein der Hauptfigur: Hüftgelenk → Knöchel höchstens / im Stand senkrecht; Hüftgelenk seitlich der Mitte
BEIN_MAX, BEIN_STAND, HUEFTE_SEIT = 0.858, 0.84, 0.11
RECHNE = {}            # Clip → dict(bilder, rate, fn(bild) → Pose, fuesse)
ZEHEN = {}             # Clip → {Bild: (Grad links, Grad rechts)}: so weit biegen die Zehen auf (Ferse gehoben)
KREIS = {}             # Clip → {Bild: {'l'|'r': (Grad, Hub)}}: Fuss um die Hochachse gestellt (Wenden)
GANGMASS = {}          # Clip → Kennwerte des Modells (Tempo, Schrittlänge, Frequenz, Kontakt), für Test und Doku


def _k(tab, t):
    """Wert einer kleinen Tabelle [(t, wert | tupel)] zur Zeit t — monoton verbunden (`_kurve`)."""
    werte = [w if isinstance(w, tuple) else (w,) for _, w in tab]
    aus = _kurve([float(z) for z, _ in tab], werte, float(t))
    return aus if isinstance(tab[0][1], tuple) else aus[0]


def _fuss_stand(xb, nick):
    """Knöchel (vor dem Standpunkt, über seiner Standhöhe) eines aufgesetzten Fusses: `xb` = wo der Ballen aufliegt,
    `nick` Grad (+ = Zehen hoch: der Fuss steht auf der Fersenkante; − = Ferse hoch: er steht auf dem Ballen)."""
    w = math.radians(abs(nick))
    c, s_ = math.cos(w), math.sin(w)
    if nick >= 0:
        return xb - FUSS_VOR - FERSE_HINTER + FERSE_HINTER * c - SOHLE * s_, FERSE_HINTER * s_ + SOHLE * c - SOHLE
    return xb - FUSS_VOR * c + SOHLE * s_, FUSS_VOR * s_ + SOHLE * c - SOHLE


def _fussbahn(p, G):
    """Ein Fuss im Zyklus, `p` = 0…1 ab seinem Aufsetzen → (Knöchel vor, hoch, Nick Grad, Zehen Grad, steht)."""
    d = G['duty']
    lc = G['v'] * G['T'] * d                    # Weg des Körpers über dem stehenden Fuss

    def stand(u):
        n = _k(G['abrollen'], u)
        x, h = _fuss_stand(G['vorn'] - lc * u, n)
        return x, h, n
    if p < d:
        x, h, n = stand(p / d)
        return x, h, n, max(0.0, -n), True
    w = (p - d) / (1 - d)
    x1, h1, n1 = stand(1.0)
    x0, h0, n0 = stand(0.0)
    # Vor: Der Fuss läuft nach dem Abdruck noch mit dem Boden zurück und bremst (Anteil `nach` des Schwungs), schwingt
    # weich vor bis etwas über die Aufsetzstelle hinaus und kommt dem Boden im letzten Stück (`vorab`) wieder entgegen —
    # beim Aufsetzen hat er genau das Tempo des Bodens (kein Bremsstoss, kein Scharren; und die Laufzeit, die das Tempo
    # eines Clips an der tiefen Knöchelbahn misst, liest auch in diesen Bildern das richtige Tempo).
    na, vb, weg = G['nach'], G['vorab'], G['v'] * (1 - d) * G['T']
    mit = G.get('mit', 0.04)                     # letztes Stück des Schwungs: der Fuss läuft schon genau mit dem Boden
    xa, xe = x1 - weg * na / 2, x0 + weg * mit + weg * vb / 2
    if w < na:
        x = x1 - weg * (w - w * w / (2 * na))
    elif w > 1 - mit:
        x = x0 + weg * (1 - w)
    elif w > 1 - mit - vb:
        r = 1 - mit - w
        x = x0 + weg * mit + weg * (r - r * r / (2 * vb))
    else:
        u = (w - na) / (1 - na - vb - mit)
        x = xa + (xe - xa) * (u * u * u * (u * (6 * u - 15) + 10))
    n = _k([(0.0, n1)] + G['schwung'] + [(1.0, n0)], w)
    h = h1 + (h0 - h1) * _weich(w) + G['hub'] * math.sin(math.pi * w ** G.get('hubform', 1.0))
    # Die Zehen strecken sich nach dem Abdruck über das erste Drittel des Schwungs.
    zehen = max(0.0, min(-n, -n1 * (1 - w / 0.3)))
    # Bodenfreiheit: Zehenspitze (Fuss nach unten geneigt) oder Fersenkante (Zehen hoch) bleiben über dem Boden.
    frei = 0.012 * min(1.0, w / 0.12, (1 - w) / 0.12)
    if n < 0:
        b = math.radians(-n)
        noetig = FUSS_VOR * math.sin(b) + SOHLE * math.cos(b) - SOHLE + ZEHE * math.sin(math.radians(max(0.0, -n - zehen)))
    else:
        a = math.radians(n)
        noetig = FERSE_HINTER * math.sin(a) + SOHLE * math.cos(a) - SOHLE
    return x, max(h, noetig + frei), n, zehen, False


def _beckenform(p, G):
    """Auf und Ab des Beckens über den Zyklus, Meter um seine Grundhöhe."""
    d, T = G['duty'], G['T']
    if d >= 0.5:
        # Gehen: umgekehrtes Pendel — am tiefsten in der Mitte des Doppelstands, am höchsten über dem Standbein.
        return -G['hub_becken'] * (1 + math.cos(4 * math.pi * (p - (d - 0.5) / 2))) / 2
    # Laufen: Feder im Stand, Wurf im Flug.
    tc, tf = d * T, (0.5 - d) * T
    q = p % 0.5
    if q < d:
        return -(G_ERDE * tf * tc / (2 * math.pi)) * math.sin(math.pi * q / d)
    tau = (q - d) * T
    return G_ERDE / 2 * tau * (tf - tau)


def _becken(p, G):
    """(vor, hoch ohne Grundhöhe, seitlich, Gier Grad, Kippen Grad) des Beckens."""
    mitte = (G['duty'] - 0.5) / 2 if G['duty'] >= 0.5 else G['duty'] / 2 - 0.25      # Phase, in der das Gewicht mittig liegt
    w = 2 * math.pi * (p - mitte)
    # links steht ab p = 0: Das Becken pendelt nach links (−), die rechte Hüfte (Schwungseite) sinkt (+) …
    seit = -G['seit'] * math.sin(w)
    kippe = G['kippe'] * math.sin(w)
    # … und die Seite des Schwungbeins dreht vor: am Aufsetzen des linken Fusses ist die linke Hüfte vorn (Gier −).
    gier = -G['gier_becken'] * math.cos(2 * math.pi * (p - G.get('gier_nach', 0.0)))
    return G.get('koerper_vor', 0.0), _beckenform(p, G), seit, gier, kippe


def _beckenbasis(G):
    """Die höchste Grundhöhe des Beckens, bei der in keinem Augenblick ein Bein über seine Länge hinaus müsste."""
    if 'basis' in G:
        return G['basis']
    basis = 1e9
    for i in range(240):
        p = i / 240
        vor, hoch, seit, gier, kippe = _becken(p, G)
        for seite, versatz in ((-1, 0.0), (1, 0.5)):
            x, h, n, z, steht = _fussbahn((p + versatz) % 1, G)
            hx = vor + seite * HUEFTE_SEIT * math.sin(math.radians(gier))      # Hüftgelenk vor/zurück durch die Beckendrehung
            hz = -seite * HUEFTE_SEIT * math.sin(math.radians(kippe))          # und tiefer/höher durch das Kippen
            quer = BEIN_MAX ** 2 - (x - hx) ** 2
            grenze = (h + math.sqrt(quer) - BEIN_STAND - hz) if quer > 0 else -1.0
            basis = min(basis, grenze - hoch)
    G['basis'] = min(basis, G.get('basis_max', -0.01))
    return G['basis']


def _gangpose(p, G):
    """Die ganze Pose bei Phase p (0 = der linke Fuss setzt auf)."""
    basis = _beckenbasis(G)
    vor, hoch, seit, gier, kippe = _becken(p, G)
    xl, hl, nl, zl, _ = _fussbahn(p % 1, G)
    xr, hr, nr, zr, _ = _fussbahn((p + 0.5) % 1, G)
    spur = G.get('spur', 0.0)       # die Füsse setzen näher an der Mittellinie auf als im Stand
    c = math.cos(2 * math.pi * (p - G.get('arm_nach', 0.03)))    # +1: rechter Arm vorn (linker Fuss setzt auf)
    a = G['arm']
    return dict(
        koerper=(vor, basis + hoch, seit), huefte=gier, kippe=kippe,
        rumpf=(G['gier_schulter'] * math.cos(2 * math.pi * p), G['neig']),
        fuss_l=(xl, spur, hl, nl), fuss_r=(xr, -spur, hr, nr), zehen=(zl, zr),
        arm_r=(a['aus'] - a['ein'] * max(0.0, c), a['vor'] + a['schwung'] * c * a.get('rechts', 1.0),
               a['hoch'] + a['hub'] * c * a.get('rechts', 1.0) + a.get('heben', 0.0) * abs(c)),
        arm_l=(-a['aus'] + a['ein'] * max(0.0, -c), a['vor'] - a['schwung'] * c, a['hoch'] - a['hub'] * c + a.get('heben', 0.0) * abs(c)),
        richt=(a['waffe'][0], a['waffe'][1], a['waffe'][2] + a['waffe'][3] * c),      # die Waffe zeigt nach aussen-unten, weg von den Beinen
    )


def _melde(name, bilder, rate, fn, fuesse='stand'):
    """Einen gerechneten Clip anmelden: `fn(bild)` → Pose (Zielmeter) oder 'stand'; Bild 1…`bilder` bei `rate` Bildern/s."""
    RECHNE[name] = dict(bilder=bilder, rate=rate, fuesse=fuesse, fn=fn)
    CLIPS[name] = ('Idle', 'gerechnet', [])


def _gang(name, G, bilder, rate):
    """Einen Gangzyklus anmelden: `bilder` Bilder je Zyklus bei `rate` Bildern/s (das letzte Bild ist wieder das erste)."""
    G['T'] = bilder / rate
    GANGMASS[name] = dict(tempo=G['v'], zyklus=G['T'], schrittlaenge=G['v'] * G['T'] / 2, schritte_je_min=120 / G['T'],
                          kontakt=G['duty'] * G['T'], flug=max(0.0, 0.5 - G['duty']) * G['T'], standanteil=G['duty'])
    _melde(name, bilder + 1, rate, lambda bild: _gangpose((bild - 1) / bilder, G), fuesse='eben')


# Gehen, 1,4 m/s. Fersenauftritt mit 18° gehobenen Zehen, Sohle flach nach 12 % der Standphase, Ferse löst sich ab der
# Hälfte, Abdruck mit 52°. Im Schwung hebt der Knöchel 4–5 cm über seine Standhöhe — etwas mehr als auf ebenem Boden
# (Zehenfreiheit beim Menschen 1–2 cm): Die Figur geht über Wiese und Waldboden, und die Laufzeit erkennt den Schwung so
# sicher als Schwung (`figurlaufzeit.json` `gang.standHoehe` 4 cm).
GANG = dict(v=1.4, spur=0.04, duty=0.62, vorn=0.44, nach=0.10, vorab=0.14, hub=0.045, hubform=0.8,
            abrollen=[(0.0, 18.0), (0.12, 0.0), (0.5, 0.0), (0.8, -22.0), (1.0, -52.0)],
            schwung=[(0.35, -20.0), (0.8, 14.0)],
            hub_becken=0.04, seit=0.02, kippe=4.0, gier_becken=4.0, gier_schulter=3.5, neig=2.0,
            arm=dict(aus=0.07, ein=0.02, vor=0.03, schwung=0.15, hoch=-0.40, hub=0.0, heben=0.025, rechts=0.6,
                     waffe=(0.5, -0.3, -0.8, 0.05)))
_gang('Koerper_Gang', GANG, 24, 24)
# Laufschritt, 4,2 m/s (das Tempo `laufen.gehen` aus `content/bewegung.json`): Mittelfussauftritt (fast flach — so liest
# die Laufzeit an der Knöchelbahn dasselbe Tempo wie am Aufstandspunkt), Flugphase, Ferse schlägt im Schwung hoch,
# Ellbogen rund 90°.
LAUF = dict(v=4.2, spur=0.07, duty=0.3125, vorn=0.40, nach=0.10, vorab=0.12, hub=0.24, hubform=0.75, arm_nach=-0.15,
            abrollen=[(0.0, 3.0), (0.1, 0.0), (0.55, 0.0), (0.8, -28.0), (1.0, -62.0)],
            schwung=[(0.3, -55.0), (0.8, 6.0)],
            seit=0.012, kippe=3.5, gier_becken=6.0, gier_schulter=10.0, neig=7.0, basis_max=-0.03,
            arm=dict(aus=0.05, ein=0.09, vor=0.05, schwung=0.19, hoch=-0.19, hub=0.10, rechts=0.85,
                     waffe=(0.55, -0.35, -0.75, 0.1)))
_gang('Koerper_Laufschritt', LAUF, 32, 48)
# Sprint, 8,5 m/s (`laufen.rennen`): Ballenlauf (die Ferse setzt nicht auf), Kontakt 0,10 s, hohe Ferse und hohes Knie im
# Schwung, 12° Vorlage, grosser Armschwung.
SPRINT = dict(v=8.5, spur=0.08, duty=0.218, vorn=0.33, nach=0.07, vorab=0.08, hub=0.42, hubform=0.7, arm_nach=-0.2,
              abrollen=[(0.0, -12.0), (0.3, -6.0), (0.6, -22.0), (1.0, -68.0)],
              schwung=[(0.3, -60.0), (0.8, -5.0)],
              seit=0.008, kippe=3.0, gier_becken=8.0, gier_schulter=14.0, neig=12.0, basis_max=-0.03,
              arm=dict(aus=0.05, ein=0.10, vor=0.04, schwung=0.27, hoch=-0.15, hub=0.15, rechts=0.8,
                       waffe=(0.55, -0.35, -0.75, 0.12)))
_gang('Koerper_Sprint', SPRINT, 22, 48)
GAENGE = {'Koerper_Gang': GANG, 'Koerper_Laufschritt': LAUF, 'Koerper_Sprint': SPRINT}

# @@EINMAL@@
# ---- D460: Anlauf, Abstoppen, Wenden, Rolle, Sprung, Klettern, Schwimmen ------------------------------------------
# Der ausgelieferte Stand (`Idle`) steht am Ziel im Schritt (rechter Fuss 22 cm vor, 8 mm tiefer; D456) — die Gangzyklen
# stehen eben und gleichauf (`fuesse='eben'`). Clips, die im Stand beginnen oder enden, zählen ihre Füsse vom Stand aus
# (`fuesse='stand'`); eine Gangpose rechnet `_gang_im_stand` dorthin um.
STAND_SCHRITT, STAND_TIEFER = 0.218, 0.008


def _misch(a, b, w):
    """Zwei Posen mit denselben Zahlenfeldern mischen (w = 0: a, 1: b)."""
    aus = {}
    for f, x in a.items():
        y = b.get(f, x)
        aus[f] = tuple(p + (q - p) * w for p, q in zip(x, y)) if isinstance(x, tuple) else x + (y - x) * w
    return aus


def _gang_im_stand(pose):
    aus = dict(pose)
    l, r = pose['fuss_l'], pose['fuss_r']
    aus['fuss_l'] = (l[0] + STAND_SCHRITT / 2, l[1], l[2] - STAND_TIEFER / 2) + tuple(l[3:])
    aus['fuss_r'] = (r[0] - STAND_SCHRITT / 2, r[1], r[2] + STAND_TIEFER / 2) + tuple(r[3:])
    return aus


def _tritt(t, xk, tritte, start):
    """Ein Fuss, der in der Welt steht, während der Körper nach `xk(t)` vorankommt. `tritte` = [(t_ab, t_auf, Ballen in
    der Welt nach dem Aufsetzen, Hub)], `start` = Ballen in der Welt am Anfang. Er rollt vor dem Abheben auf den Ballen
    (Ferse hebt über 0,14 s bis 50°) und setzt mit 10° gehobenen Zehen auf. → (Knöchel vor im Raum der Figur, hoch, Nick, Zehen)."""
    ballen = start
    for i, (ab, auf, ziel, hub) in enumerate(tritte):
        if t <= ab:
            n = -50.0 * _weich((t - (ab - 0.14)) / 0.14)
            x, h = _fuss_stand(ballen, n)
            return x - xk(t), h, n, -n
        if t < auf:
            w = (t - ab) / (auf - ab)
            x1, h1 = _fuss_stand(ballen, -50.0)
            x0, h0 = _fuss_stand(ziel, 10.0)
            n = _k([(0.0, -50.0), (0.4, -30.0), (0.8, 8.0), (1.0, 10.0)], w)
            g = w * w * w * (w * (6 * w - 15) + 10)
            return x1 + (x0 - x1) * g - xk(t), h1 + (h0 - h1) * _weich(w) + hub * math.sin(math.pi * w ** 0.8), n, max(0.0, 50.0 * (1 - w / 0.3))
        ballen = ziel
        if i + 1 == len(tritte) or t < tritte[i + 1][0] - 0.14:
            n = 10.0 * (1 - _weich((t - auf) / 0.06))
            x, h = _fuss_stand(ballen, n)
            return x - xk(t), h, n, 0.0
    x, h = _fuss_stand(ballen, 0.0)
    return x - xk(t), h, 0.0, 0.0


# Anlauf: aus dem Stand in den Laufschritt, 0,67 s, zwei Schritte. Der Körper beschleunigt gleichmässig von 0 auf 4,2 m/s
# (6,3 m/s² — ein scharfer Antritt; Sprinter erreichen aus dem Block 4 m/s nach rund 0,5 s, Überschlag) und legt dabei
# 1,4 m zurück; die Füsse stehen in der Welt, im Raum der Figur wandern sie also nach hinten, wie der Körper vorankommt.
# **Voraussetzung:** Die Regel müsste das Tempo über dieselbe Zeit hochfahren (heute springt es, `content/bewegung.json`) —
# sonst gleitet der Standfuss. Endet in der Phase 0,53 des Laufschritts (rechter Fuss hat eben aufgesetzt).
ANLAUF_T, ANLAUF_ENDE = 16 / 24, 0.531


def _anlauf(bild):
    if bild == 1:
        return 'stand'
    t = (bild - 1) / 24
    a = LAUF['v'] / ANLAUF_T
    xk = lambda z: a * z * z / 2
    p = ANLAUF_ENDE - (ANLAUF_T - t) / LAUF['T']
    gang = _gang_im_stand(_gangpose(p % 1, LAUF))
    gang['arm_w'] = 1.0
    b0 = FUSS_VOR                                        # Ballen unter dem stehenden Fuss (Knöchel bei 0)
    # links: hebt sofort, setzt nach 0,25 s auf, drückt bis 0,52 s ab; rechts: drückt ab bis 0,30 s und schwingt durch.
    xl, hl, nl, zl = _tritt(t, xk, [(0.04, 0.25, xk(0.25) + 0.26 + FUSS_VOR, 0.07), (0.52, 9.0, 9.0, 0.2)], b0 + STAND_SCHRITT / 2)
    xr, hr, nr, zr = _tritt(t, xk, [(0.30, 0.66, xk(0.66) + 0.30 + FUSS_VOR, 0.22)], b0 - STAND_SCHRITT / 2)
    eigen = dict(gang)
    eigen.update(
        koerper=(_k([(0.0, 0.0), (0.2, 0.06), (0.667, 0.0)], t), _k([(0.0, 0.0), (0.12, -0.10), (0.4, -0.09), (0.667, gang['koerper'][1])], t), 0.0),
        rumpf=(gang['rumpf'][0], _k([(0.0, 0.0), (0.2, 30.0), (0.45, 18.0), (0.667, LAUF['neig'])], t)),
        fuss_l=(xl, 0.0, hl, nl), fuss_r=(xr, 0.0, hr, nr), zehen=(zl, zr),
        arm_w=_weich(t / 0.18))
    return _misch(eigen, gang, _weich((t - 0.50) / (ANLAUF_T - 0.50)))


_melde('Koerper_Anlauf', 17, 24, _anlauf)

# Abstoppen: aus dem Laufschritt in den Stand, 0,5 s, zwei Bremsschritte (8,4 m/s², Weg 1,05 m — härter als der Antritt:
# der Fuss stemmt vor dem Körper). Beginnt in der Phase 0,5 des Laufschritts (rechter Fuss setzt auf); der linke setzt
# vor dem Körper mit der Ferse auf und trägt die Bremsung, der Rumpf lehnt zurück, das Becken geht tief; der rechte
# zieht nach vorn in den Stand, der Körper richtet sich auf. **Voraussetzung** wie beim Anlauf: die Regel bremst über
# dieselbe Zeit.
STOPP_T = 12 / 24


def _abstoppen(bild):
    if bild == 13:
        return 'stand'
    t = (bild - 1) / 24
    v, br = LAUF['v'], LAUF['v'] / STOPP_T
    xk = lambda z: v * z - br * z * z / 2
    gang = _gang_im_stand(_gangpose((0.5 + t / LAUF['T']) % 1, LAUF))
    gang['arm_w'] = 1.0
    xr0 = _fussbahn(0.0, LAUF)[0] + FUSS_VOR - STAND_SCHRITT / 2          # Ballen des rechten Fusses beim Aufsetzen
    xr, hr, nr, zr = _tritt(t, xk, [(0.20, 0.42, xk(STOPP_T) + FUSS_VOR, 0.10)], xr0)
    ziel = xk(STOPP_T) + FUSS_VOR                                         # der linke Fuss landet, wo er im Stand steht
    if t < 0.20:
        # der linke Fuss ist beim Beginn im Schwung: von dort zur Aufsetzstelle, Ferse voran
        w = t / 0.20
        g = _gang_im_stand(_gangpose(0.5, LAUF))['fuss_l']
        x0, h0 = _fuss_stand(ziel, 14.0)
        xl, hl, nl, zl = g[0] + (x0 - xk(0.20) - g[0]) * _weich(w), g[2] + (h0 - g[2]) * w * w, g[3] + (14.0 - g[3]) * _weich(w), 0.0
    else:
        nl = 14.0 * (1 - _weich((t - 0.20) / 0.07))
        xl, hl = _fuss_stand(ziel, nl)
        xl, zl = xl - xk(t), 0.0
    eigen = dict(gang)
    eigen.update(
        koerper=(_k([(0.0, 0.0), (0.2, -0.07), (0.5, 0.0)], t), _k([(0.0, gang['koerper'][1]), (0.24, -0.13), (0.38, -0.07), (0.5, 0.0)], t), 0.0),
        huefte=0.0, kippe=0.0,
        rumpf=(_k([(0.0, gang['rumpf'][0]), (0.3, 0.0), (0.5, 0.0)], t), _k([(0.0, LAUF['neig']), (0.18, -9.0), (0.34, 6.0), (0.5, 0.0)], t)),
        fuss_l=(xl, 0.0, hl, nl), fuss_r=(xr, 0.0, hr, nr), zehen=(zl, zr),
        arm_r=(0.16, 0.10, -0.26), arm_l=(-0.20, 0.14, -0.22), richt=(0.3, 0.6, -0.74),
        arm_w=1 - _weich((t - 0.26) / 0.22))
    return _misch(gang, eigen, _weich(t / 0.10))


_melde('Koerper_Abstoppen', 13, 24, _abstoppen)


# Wenden auf der Stelle. Die Regel dreht die Figur sofort (`gier` springt); der Clip **beginnt** deshalb in der alten
# Richtung (um den Winkel zurückgedreht) und **endet im Stand** in der neuen — die Laufzeit spielt ihn ab dem Augenblick
# des Drehens, ohne die Wurzel zu führen. Der Kopf geht voran, die Schultern folgen, die Füsse setzen nacheinander um
# (der Fuss der Drehseite zuerst; bei 180° zweimal), der jeweils andere trägt; die Füsse drehen um die Mitte des Stands.
def _wenden(grad, schritte, bilder):
    zeichen = 1 if grad > 0 else -1
    erster, zweiter = ('l', 'r') if grad > 0 else ('r', 'l')
    teil = abs(grad) / (len(schritte) / 2)

    def fn(bild):
        if bild == bilder:
            return 'stand'
        fuss = {'l': [-abs(grad), 0.0], 'r': [-abs(grad), 0.0]}     # (Grad vor dem Ziel, Hub)
        last = 0.0                                                   # +1: der erste Fuss ist in der Luft, −1: der zweite
        for i, (ab, auf) in enumerate(schritte):
            s = erster if i % 2 == 0 else zweiter
            if bild >= auf:
                fuss[s][0] += teil
            elif bild > ab:
                w = (bild - ab) / (auf - ab)
                fuss[s][0] += teil * (w * w * (3 - 2 * w))
                fuss[s][1] = 0.07 * math.sin(math.pi * w)
                last = (1 if s == erster else -1) * math.sin(math.pi * w)
        e = _weich((bild - 1.5) / (bilder - 3.0))
        gier = -abs(grad) * (1 - e) * zeichen
        voraus = math.sin(math.pi * e)
        r = math.radians(gier)
        # Gewicht über den tragenden Fuss: hebt der erste (auf der Drehseite), lehnt das Becken zur anderen Seite.
        seit = 0.035 * last * zeichen
        return dict(gier=gier, koerper=(seit * math.sin(r), -(0.07 if abs(grad) > 90 else 0.05) * voraus, seit * math.cos(r)),
                    rumpf=(8.0 * voraus * zeichen, 2.0 * voraus), kopf=(min(30.0, abs(grad) / 3) * voraus * zeichen * (1 - e), 0.0),
                    fuss_l=('kreis', fuss['l'][0] * zeichen, fuss['l'][1]), fuss_r=('kreis', fuss['r'][0] * zeichen, fuss['r'][1]))
    return fn


_melde('Koerper_Wenden_Links', 13, 24, _wenden(90, [(2, 6), (6, 11)], 13))
_melde('Koerper_Wenden_Rechts', 13, 24, _wenden(-90, [(2, 6), (6, 11)], 13))
_melde('Koerper_Kehrt_Links', 19, 24, _wenden(180, [(2, 6), (6, 10), (10, 14), (14, 18)], 19))
_melde('Koerper_Kehrt_Rechts', 19, 24, _wenden(-180, [(2, 6), (6, 10), (10, 14), (14, 18)], 19))


# Rolle (Ausweichrolle der Regel: 3,8 m in 0,55 s, `echtzeit.ts`; die Szene spielt den Clip über 0,75 s). Eine Hechtrolle
# mit Gewicht: tief gehen und abdrücken (die Füsse bleiben in der Welt stehen — im Raum der Figur laufen sie nach hinten
# weg), gestreckt nach vorn, die linke Hand fängt ab, über die linke Schulter und den runden Rücken abrollen (Kinn an der
# Brust, Knie am Leib), auf die Füsse kommen (Bild 14 = 0,54 s, das Ende der Regel) und aus der tiefen Hocke aufstehen.
# Die Waffe liegt rechts aussen, weg vom Körper. Ab Bild 5 ist sie als **Lande-Rolle** (D413) nutzbar: Die Figur kommt
# gestreckt von oben-hinten, die Hand fängt ab. Benannte Abweichung (D398): 3,8 m in 0,55 s sind 6,9 m/s — schneller als
# ein Mensch aus dem Stand hechtet (Spielwert der Gattung, nicht geändert).
def _rolle(bild):
    if bild in (1, 19):
        return 'stand'
    b = float(bild)
    asym = lambda tab, dv: [(z, (w[0] + dv * (1 if 4 <= z <= 13 else 0), w[1], w[2])) for z, w in tab]
    fuss = [(1, (0.0, 0.0, 0.0)), (2, (-0.29, 0.05, -25.0)), (3, (-0.57, 0.08, -50.0)), (5, (-0.22, 0.0, -45.0)),
            (7, (0.0, 0.12, -25.0)), (9, (0.10, 0.16, -5.0)), (12, (0.12, 0.10, 0.0)), (14, (0.10, 0.0, 0.0)),
            (16, (0.04, 0.0, 0.0)), (19, (0.0, 0.0, 0.0))]
    fl, fr = _k(asym(fuss, 0.04), b), _k(asym(fuss, -0.04), b)
    return dict(
        koerper=(_k([(1, 0.0), (3, 0.10), (5, 0.0), (14, 0.0), (15, 0.05), (19, 0.0)], b),
                 _k([(1, 0.0), (2, -0.12), (3, -0.22), (5, -0.12), (7, -0.36), (9, -0.44), (12, -0.44), (14, -0.42), (16, -0.20), (19, 0.0)], b), 0.0),
        rumpf=(0.0, _k([(1, 0.0), (2, 30.0), (3, 58.0), (5, 60.0), (9, 64.0), (12, 56.0), (14, 42.0), (16, 22.0), (19, 0.0)], b)),
        kopf=(0.0, _k([(1, 0.0), (3, 10.0), (5, 35.0), (7, 55.0), (12, 45.0), (14, 10.0), (19, 0.0)], b)),
        knie=_k([(1, 0.15), (7, 0.40), (14, 0.32), (19, 0.15)], b),
        fuss_l=(fl[0], 0.0, fl[1], fl[2]), fuss_r=(fr[0], 0.0, fr[1], fr[2]),
        arm_l=_k([(1, (-0.10, 0.20, -0.20)), (3, (-0.10, 0.36, 0.05)), (5, (-0.04, 0.34, 0.24)), (7, (-0.04, 0.30, 0.02)),
                  (9, (-0.10, 0.28, -0.24)), (14, (-0.16, 0.30, -0.24)), (19, (-0.10, 0.10, -0.38))], b),
        arm_r=_k([(1, (0.14, 0.14, -0.26)), (3, (0.26, 0.20, -0.10)), (5, (0.33, 0.14, 0.02)), (9, (0.31, 0.14, -0.14)),
                  (14, (0.22, 0.24, -0.24)), (19, (0.10, 0.10, -0.38))], b),
        richt=_k([(1, (0.3, 0.6, -0.7)), (4, (0.8, -0.2, -0.55)), (13, (0.8, -0.2, -0.55)), (19, (0.3, 0.6, -0.7))], b),
        arm_w=_weich((b - 1) / 2.0) * _weich((19 - b) / 3.0),
        lage=dict(nick=_k([(1, 0.0), (3, 0.0), (5, 55.0), (7, 125.0), (9, 205.0), (11, 275.0), (13, 335.0), (14, 360.0), (19, 360.0)], b),
                  roll=_k([(1, 0.0), (5, 0.0), (7, -14.0), (10, -10.0), (13, 0.0), (19, 0.0)], b),
                  gier=_k([(1, 0.0), (5, 0.0), (7, 10.0), (10, 6.0), (13, 0.0), (19, 0.0)], b),
                  um=(0.0, 0.0, 0.50),
                  # Höhe des Drehpunkts je Bild so, dass der tiefste Punkt aufliegt (an der ausgelieferten Datei gemessen,
                  # `TIEF=Koerper_Rolle` in `tests/clipguete.test.ts`): über die Hand hoch, über den Rücken tief aufs Gesäss.
                  schub=(0.0, 0.0, _k([(1, 0.0), (5, 0.0), (6, 0.06), (7, 0.11), (8, -0.01), (9, -0.20), (10, -0.39), (11, -0.43),
                                       (12, -0.30), (13, -0.12), (14, 0.0), (19, 0.0)], b))))


_melde('Koerper_Rolle', 19, 24, _rolle)


# Sprung. Die Regel gibt dem Körper das Steigtempo im ersten Bild (kein Tiefgehen vorher) — `Koerper_Sprung_Ab` beginnt
# deshalb in der vollen Streckung des Abdrucks (Zehen gestreckt, Arme hoch) und zieht in die Flughaltung;
# `Koerper_Sprung_Flug` hält sie als Schleife (leicht gehockt, ein Bein vor, Arme zum Ausgleich offen). Die Landung
# decken `Koerper_Landung_Weich` und `_Hart` (D456) — die Flughaltung endet mit gebeugten Knien, aus der die Landung beginnt.
def _flug(s=0.0, c=1.0):
    return dict(koerper=(0.0, 0.0, 0.0), rumpf=(0.0, 8.0 + 1.5 * s),
                fuss_l=(0.20 + 0.02 * s, 0.0, 0.26 + 0.01 * c, -10.0), fuss_r=(-0.14 - 0.02 * s, 0.0, 0.16, -35.0),
                arm_l=(-0.30, 0.14 + 0.02 * s, -0.06), arm_r=(0.28, 0.06 - 0.02 * s, -0.12), richt=(0.5, 0.5, -0.7), arm_w=1.0)


def _sprung_ab(bild):
    ab = dict(koerper=(0.0, 0.02, 0.0), rumpf=(0.0, -4.0), fuss_l=(-0.02, 0.0, 0.0, -45.0), fuss_r=(-0.06, 0.0, 0.0, -50.0),
              arm_l=(-0.10, 0.25, 0.20), arm_r=(0.12, 0.20, 0.10), richt=(0.2, 0.6, 0.77), arm_w=1.0)
    return _misch(ab, _flug(), _weich((bild - 1.5) / 5.5))


_melde('Koerper_Sprung_Ab', 8, 24, _sprung_ab)
_melde('Koerper_Sprung_Flug', 25, 24, lambda bild: _flug(math.sin(2 * math.pi * (bild - 1) / 24), math.cos(2 * math.pi * (bild - 1) / 24)))


# Klettern (ein Zyklus, 1 s = 1 m: `klettern.tempo` 1,0 m/s). Die Wand steht 0,3 m vor der Brust; Hand und Fuss, die
# greifen, stehen an der Wand — im Raum der Figur wandern sie mit 1 m/s nach unten, während der Körper steigt —, die
# anderen lösen sich, schwingen von der Wand weg nach oben und greifen 0,5 m höher. Diagonal: rechte Hand mit linkem
# Fuss. Das Becken pendelt über den tragenden Fuss, der Blick geht nach oben. Die Waffe bleibt in der Hand (die Figur hat
# keine Scheide) — sie zeigt an der Wand nach oben.
def _klettern(bild):
    p = (bild - 1) / 24

    def glied(q, oben, unten, weg):
        """Phase q: erste Hälfte an der Wand von `oben` nach `unten`, zweite Hälfte gelöst zurück. → (hoch, von der Wand weg)"""
        if q < 0.5:
            return oben + (unten - oben) * q / 0.5, 0.0
        w = (q - 0.5) / 0.5
        return unten + (oben - unten) * (w * w * (3 - 2 * w)), weg * math.sin(math.pi * w)
    hr, wr = glied(p % 1, 0.36, -0.14, 0.10)                  # rechte Hand, von der Schulter
    hl, wl = glied((p + 0.5) % 1, 0.36, -0.14, 0.10)
    fl, vl = glied(p % 1, 0.50, 0.0, 0.08)                    # linker Fuss greift mit der rechten Hand
    fr, vr = glied((p + 0.5) % 1, 0.50, 0.0, 0.08)
    s = math.sin(2 * math.pi * (p - 0.12))
    return dict(koerper=(0.10, -0.11 + 0.015 * math.cos(4 * math.pi * p), -0.03 * s), rumpf=(5.0 * s, 8.0), kippe=4.0 * s,
                kopf=(0.0, -24.0), knie=0.45,
                fuss_l=(0.20 - vl, 0.0, fl, -18.0), fuss_r=(0.20 - vr, 0.0, fr, -18.0),
                arm_r=(0.06, 0.30 - wr, hr), arm_l=(-0.06, 0.30 - wl, hl), richt=(0.1, 0.15, 0.98), arm_w=1.0)


_melde('Koerper_Klettern', 25, 24, _klettern, fuesse='eben')


# Schwimmen (Brustschwimmen, ein Zyklus 1,33 s): der Körper liegt (78° vornüber um das Becken), der Kopf bleibt über
# Wasser. Armzug nach aussen und hinten, Hände unter dem Kinn zusammen, vorstossen und gleiten; Beine ziehen an (Fersen
# zum Gesäss, Knie auseinander), stossen nach aussen-hinten und schliessen. Die Höhe über der Wurzel bleibt die des
# Beckens im Stand — die Wasserlinie setzt die Laufzeit. Schwimmtempo ist kein Wert in `content/bewegung.json`
# (Konstante der Szene); der Clip hat keinen Boden, an dem ein Tempo zu messen wäre.
def _schwimmen(bild):
    p = (bild - 1) / 32
    arm = _k([(0.0, (0.03, 0.06, 0.42)), (0.25, (0.36, 0.10, 0.16)), (0.42, (0.07, 0.20, 0.06)), (0.62, (0.03, 0.08, 0.38)), (1.0, (0.03, 0.06, 0.42))], p)
    bein = _k([(0.0, (0.0, 0.0, 0.02, -40.0)), (0.25, (0.0, 0.0, 0.03, -35.0)), (0.45, (-0.02, 0.10, 0.36, 15.0)),
               (0.56, (-0.02, 0.26, 0.20, 15.0)), (0.70, (0.0, 0.03, 0.03, -30.0)), (1.0, (0.0, 0.0, 0.02, -40.0))], p)
    knie = _k([(0.0, 0.15), (0.25, 0.15), (0.45, 0.9), (0.56, 0.8), (0.70, 0.2), (1.0, 0.15)], p)
    nick = _k([(0.0, 78.0), (0.25, 71.0), (0.45, 74.0), (0.7, 80.0), (1.0, 78.0)], p)
    return dict(koerper=(0.0, 0.0, 0.0), rumpf=(0.0, -14.0), kopf=(0.0, -60.0), knie=knie,
                fuss_l=(bein[0], -bein[1] + 0.03, bein[2], bein[3]), fuss_r=(bein[0], bein[1] - 0.03, bein[2], bein[3]),
                arm_r=(arm[0], arm[1], arm[2]), arm_l=(-arm[0], arm[1], arm[2]), richt=(0.1, 0.2, 0.97), arm_w=1.0,
                lage=dict(nick=nick, um=(0.0, 0.0, 0.93), schub=(0.0, 0.0, 0.0)))


_melde('Koerper_Schwimmen', 33, 24, _schwimmen, fuesse='eben')

NAMEN = tuple(CLIPS)       # mit den gerechneten Clips


def _in_quelle(pose):
    """Pose in Zielmetern → Meter des Quellskeletts (Körper, Füsse, Lage); Arme stehen schon in Quellmetern."""
    aus = dict(pose)
    if 'koerper' in aus:
        aus['koerper'] = tuple(x / MASS for x in aus['koerper'])
    for f in ('fuss_l', 'fuss_r'):
        if f in aus:
            w = aus[f]
            aus[f] = ('kreis', w[1], w[2] / MASS) if w[0] == 'kreis' else tuple(x / MASS for x in w[:3]) + tuple(w[3:])
    if aus.get('lage'):
        lg = dict(aus['lage'])
        for f in ('um', 'schub'):
            if f in lg:
                lg[f] = tuple(x / MASS for x in lg[f])
        aus['lage'] = lg
    return aus


def baue_gerechnet(rig, ad, name, basis):
    """D460: ein Clip, dessen Pose je Bild aus einer Funktion kommt (`RECHNE`)."""
    r = RECHNE[name]
    akt = bpy.data.actions.new(name)
    ad.action = akt
    vorige = {}
    ZEHEN[name], KREIS[name] = {}, {}
    for bild in range(1, r['bilder'] + 1):
        pose = r['fn'](bild)
        if pose == 'stand':
            _setze(rig, basis)
        else:
            _pose(rig, basis, _in_quelle(pose), Vector((0, 0, 0)))
            if pose.get('zehen'):
                ZEHEN[name][bild] = pose['zehen']
            kreis = {s: (pose[f][1], pose[f][2]) for s, f in (('l', 'fuss_l'), ('r', 'fuss_r')) if f in pose and pose[f][0] == 'kreis'}
            if kreis:
                KREIS[name][bild] = kreis
        for kn in rig.pb:
            if kn.rotation_mode != 'QUATERNION':
                kn.rotation_mode = 'QUATERNION'
            q = kn.rotation_quaternion.copy()
            if kn.name in vorige and q.dot(vorige[kn.name]) < 0:
                q.negate()
                kn.rotation_quaternion = q
            vorige[kn.name] = q
            kn.keyframe_insert('rotation_quaternion', frame=bild)
            kn.keyframe_insert('location', frame=bild)
    for fc in _fkurven(akt):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    ad.action = None
    tr = ad.nla_tracks.new()
    tr.name = name
    st = tr.strips.new(name, 1, akt)
    if hasattr(st, 'action_slot') and akt.slots:
        st.action_slot = akt.slots[0]
    tr.mute = True
    print(f'  Gerechneter Clip {name}: Bild 1–{r["bilder"]} bei {r["rate"]} Bildern/s' +
          (f', Beckengrundhöhe {GAENGE[name]["basis"] * 100:+.1f} cm' if name in GAENGE else ''))
    return akt


def _fkurven(akt):
    """Alle F-Kurven einer Action — Blender 5 legt sie in Ebenen/Streifen/Kanalbeutel, ältere direkt an die Action."""
    aus = []
    for ebene in getattr(akt, 'layers', []):
        for streifen in ebene.strips:
            for beutel in getattr(streifen, 'channelbags', []):
                aus.extend(beutel.fcurves)
    if not aus and hasattr(akt, 'fcurves'):
        aus = list(akt.fcurves)
    return aus


def _eiche(rig, idle):
    """D456: Arme und Beine an einer gebeugten Pose eichen (`Rig.eiche`): Hände vor dem Bauch wie in einer Hut, Becken
    8 cm tiefer. Danach steht alles wieder im Stand."""
    _setze(rig, idle)
    hand = {s: rig.lokal('LowerArm.' + s, rig.w('Wrist.' + s)) for s in 'LR'}
    knoechel = {s: rig.w('Foot.' + s) for s in 'LR'}
    ende = {s: rig.lokal('LowerLeg.' + s, knoechel[s]) for s in 'LR'}
    rig.brust0 = (rig.rot @ rig.pb['Chest'].matrix.to_3x3()).normalized()
    for s, seite in (('R', 1), ('L', -1)):
        ziel = rig.punkt(0.2 * seite, 0.3, 1.1)
        rig.eiche('UpperArm.' + s, 'LowerArm.' + s, ziel, _pol(rig, seite, ziel), hand[s])
    rig.schiebe('Body', rig.oben * -0.08)
    for s, seite in (('R', 1), ('L', -1)):
        rig.eiche('UpperLeg.' + s, 'LowerLeg.' + s, knoechel[s], rig.vorn + rig.rechts * 0.15 * seite, ende[s])
    _setze(rig, idle)


def baue_waffenclips(arm, nur=None):
    """Alle Clips aus CLIPS als Actions mit NLA-Spur. Braucht `Idle` aus dem Paket."""
    ad = arm.animation_data or arm.animation_data_create()
    aktionen = {a.name.split('|')[-1]: a for a in bpy.data.actions}
    if 'Idle' not in aktionen:
        raise RuntimeError('Waffenclips: keine Idle-Action im Paket')
    for tr in ad.nla_tracks:
        tr.mute = True
    rig = None
    basen = {}
    gebaut = {}
    for name in NAMEN:
        if nur and name not in nur and not name.endswith('_Stand'):
            continue
        grund = CLIPS[name][0]
        if grund not in basen:
            quelle = gebaut.get(grund) or aktionen[grund]
            if rig is None:
                # Achsen aus dem Stand (Idle) lesen: In der Schwerthaltung stehen die Schultern gedreht.
                idle = _basis(Rig(arm), ad, aktionen['Idle'])
                rig = Rig(arm)
                _eiche(rig, idle)
            basen[grund] = _basis(rig, ad, quelle)
        gebaut[name] = baue_clip(rig, ad, name, basen[grund])
    ad.action = None
    for t in ad.nla_tracks:
        t.mute = False
    bpy.context.scene.frame_set(1)
    return gebaut
