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
         'Messer_Schwer': 'messer', 'Messer_Block': 'messer', 'Geraet_Blasebalg': 'klinge'}


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
    v, h = pose.get('koerper', (0, 0))
    if v or h:
        rig.schiebe('Body', rig.vorn * v + rig.oben * h)
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
    for s, feld, seite in (('R', 'fuss_r', 1), ('L', 'fuss_l', -1)):
        fuss = pose.get(feld, (0, 0))
        fv, fr = fuss[0], fuss[1]
        delta = rig.vorn * fv + rig.rechts * fr
        if len(fuss) > 2:
            delta = delta + rig.oben * fuss[2]   # D456: der Fuss hebt im Schritt ab
        if delta.length > 1e-6:
            rig.schiebe('Foot.' + s, delta)
            if 'PT.' + s in rig.pb:
                rig.schiebe('PT.' + s, delta)
        rig.zwei('UpperLeg.' + s, 'LowerLeg.' + s, knoechel[s] + delta, rig.vorn + rig.rechts * 0.15 * seite, ende[s])

    if 'hand' in pose:
        ziel = rig.punkt(*pose['hand'])
        rig.zwei('UpperArm.R', 'LowerArm.R', ziel, _pol(rig, 1, ziel), hand_ende['R'])
        klinge = rig.richtung(*pose['richt'])
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
