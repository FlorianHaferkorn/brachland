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

Jeder Schlüssel setzt alle Knochen (three.js lässt ungenannte stehen), Quaternionen werden auf
Stetigkeit gedreht (q und −q sind dieselbe Drehung, aber nicht für Blenders Interpolation je
Komponente), und kein Abschnitt dreht einen Knochen über ~100°.

Die Zeiten `hieb: { scheitel, durchzug }` in `src/kampf/echtzeit.ts` sind die Bilder hier / 24.
Wer ein Bild verschiebt, zieht dort nach — `tests/waffenclips.test.ts` prüft beides gegeneinander.
"""
import bpy
from mathutils import Vector, Matrix

# Name → (Grundhaltung, Schlüssel). Ein Schlüssel: Bild und Pose. Pose-Felder (alle optional):
#   hand (r, v, h)      Handgelenk rechts, Meter vom Standpunkt   richt (r, v, h) Klinge/Stiel
#   zwei                linke Hand an die Waffe                   links (r, v, h) linke Hand frei
#   rumpf (dreh, neig)  Grad                                       koerper (v, h)  Meter
#   fuss_r / fuss_l (v, r)  Meter                                 pol (r, v, h)   Ellbogen rechts
#   huefte              Grad, Becken dreht vor der Brust (D414: die Hüfte führt den Schlag)
#   griff               D429, Axt: linke Hand entlang des Stiels von der rechten aus, Meter (negativ = zum Ende)
# 'stand' heisst: die Grundhaltung unverändert.
KLINGE_BASIS = 'Klinge_Stand'
CLIPS = {
    # Die Haltungen aus dem Stand (Idle), nicht aus `Idle_Sword`: Die steht seitlich wie beim Fechten
    # (im Bild gefunden) — jede Drehung des Rumpfs käme dazu, und der Stich ginge zur Seite.
    'Klinge_Stand': ('Idle', 'schleife', [
        # D189: Deckung statt hängendem Arm — Hand vor dem Bauchnabel auf 1,2 m, Klinge schräg nach oben
        # vorn (die Spitze auf Kinnhöhe des Gegners), linke Hand locker vor der Brust.
        (1, dict(hand=(0.2, 0.32, 1.2), richt=(-0.12, 0.62, 0.78), rumpf=(-12, 5), koerper=(0, -0.06),
                 fuss_r=(0.14, 0.04), fuss_l=(-0.12, -0.03), links=(-0.2, 0.2, 1.12))),
        (25, dict(hand=(0.2, 0.33, 1.18), richt=(-0.12, 0.64, 0.76), rumpf=(-13, 7), koerper=(0, -0.075),
                  fuss_r=(0.14, 0.04), fuss_l=(-0.12, -0.03), links=(-0.2, 0.21, 1.1))),
        (49, dict(hand=(0.2, 0.32, 1.2), richt=(-0.12, 0.62, 0.78), rumpf=(-12, 5), koerper=(0, -0.06),
                  fuss_r=(0.14, 0.04), fuss_l=(-0.12, -0.03), links=(-0.2, 0.2, 1.12))),
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
    # Stich: zurückziehen an die Hüfte, dann Ausfall mit dem rechten Fuss.
    'Klinge_Stich': (KLINGE_BASIS, 'einmal', [
        (1, 'stand'),
        (5, dict(hand=(0.22, 0.02, 1.12), richt=(0.05, 1, 0.1), rumpf=(-18, 0), links=(-0.12, 0.3, 1.2))),
        (9, dict(hand=(0.24, -0.1, 1.1), richt=(0.02, 1, 0.08), rumpf=(-28, -3), koerper=(-0.05, -0.04), links=(-0.12, 0.35, 1.25))),
        (11, dict(hand=(0.12, 0.45, 1.24), richt=(0, 1, 0.03), rumpf=(5, 10), koerper=(0.12, -0.07), fuss_r=(0.25, 0))),
        (13, dict(hand=(0.03, 0.78, 1.25), richt=(0, 1, 0), rumpf=(25, 18), koerper=(0.25, -0.11), fuss_r=(0.42, 0),
                  links=(-0.32, -0.2, 1.05))),
        (20, dict(hand=(0.12, 0.5, 1.2), richt=(0.02, 1, 0.05), rumpf=(12, 12), koerper=(0.16, -0.07), fuss_r=(0.3, 0))),
        (30, 'stand'),
    ]),
    # D173: Axtblock — der Stiel quer vor der Brust, beide Hände weit auseinander (D429: links am Ende, rechts vorn,
    # der Kopf rechts), Gewicht tief. Gehalten wird das letzte Bild (die Szene klemmt den Clip), deshalb endet er
    # nicht im Stand.
    'Axt_Block': ('Axt_Stand', 'einmal', [
        (1, 'stand'),
        (4, dict(hand=(0.3, 0.3, 1.38), richt=(0.95, 0.1, 0.3), zwei='axt', griff=-0.6, rumpf=(-6, 4), koerper=(-0.03, -0.06),
                 pol=(0.6, -0.3, -0.6))),
        (8, dict(hand=(0.32, 0.32, 1.42), richt=(0.96, 0.1, 0.25), zwei='axt', griff=-0.6, rumpf=(-6, 6), koerper=(-0.04, -0.08),
                 pol=(0.6, -0.3, -0.6))),
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
                 koerper=(-0.07, -0.01), fuss_l=(0.1, -0.02), pol=(0.7, 0.2, -0.3))),
        (12, dict(hand=(0.24, -0.14, 1.74), richt=(0.15, -0.7, 0.7), zwei='axt', griff=-0.62, rumpf=(-30, -8), huefte=12,
                  koerper=(-0.08, 0.04), fuss_l=(0.1, -0.02), pol=(0.7, 0.2, -0.3))),
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
                 koerper=(-0.03, -0.06), pol=(0.5, -0.2, -0.8))),
        (10, dict(hand=(0.36, -0.08, 1.3), richt=(0.62, -0.74, 0.25), zwei='axt', griff=-0.62, rumpf=(-50, 0), huefte=14,
                  koerper=(-0.04, -0.08), fuss_l=(0.15, -0.03), pol=(0.5, -0.3, -0.8))),
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
                  koerper=(-0.04, -0.02), pol=(0.7, 0.3, -0.3))),
        # Im Scheitel liegt der Stiel waagrecht über dem Kopf, der Kopf hinten, die rechte Hand hinter dem Kopf 0,45 m
        # vom Ende, die linke vor der Brust am Ende. Tiefer (Kopf hängt hinter dem Rücken) reicht der linke Arm nicht
        # ans Stielende — geprüft D429: die Hand verliesse den Stiel um 13 cm.
        (17, dict(hand=(0.1, -0.05, 1.68), richt=(0.03, -0.75, 0.66), zwei='axt', griff=-0.5, rumpf=(-8, -12), huefte=3,
                  koerper=(-0.1, 0.03), fuss_l=(0.12, -0.02), pol=(0.7, 0.2, -0.3))),
        (20, dict(hand=(0.06, -0.18, 1.62), richt=(0.02, -0.95, 0.3), zwei='axt', griff=-0.42, rumpf=(-6, -10), huefte=8,
                  koerper=(-0.11, 0.03), fuss_l=(0.12, -0.02), pol=(0.7, 0.2, -0.3))),
        (22, dict(hand=(0.06, 0.1, 1.7), richt=(0, 0.15, 0.99), zwei='axt', griff=-0.42, rumpf=(-4, -2), huefte=6,
                  koerper=(-0.05, 0.01), fuss_l=(0.12, -0.02), pol=(0.7, 0.3, -0.3))),
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
        (7, dict(hand=(0.36, -0.04, 1.6), richt=(0.45, -0.62, 0.64), zwei='axt', griff=-0.62, rumpf=(-40, 10), huefte=12,
                 koerper=(0.12, -0.08), fuss_r=(0.45, 0.02), pol=(0.6, 0.1, -0.6))),
        (9, dict(hand=(0.2, 0.42, 1.45), richt=(0.35, 0.82, 0.45), zwei='axt', griff=-0.35, rumpf=(-5, 20), huefte=10,
                 koerper=(0.25, -0.12), fuss_r=(0.45, 0.02))),
        (10, dict(hand=(-0.01, 0.44, 1.2), richt=(-0.3, 0.95, -0.08), zwei='axt', griff=-0.25, rumpf=(15, 24), huefte=6,
                  koerper=(0.28, -0.14), fuss_r=(0.45, 0.02))),
        (11, dict(hand=(-0.22, 0.45, 0.95), richt=(-0.55, 0.62, -0.56), zwei='axt', griff=-0.11, rumpf=(35, 28), huefte=2,
                  koerper=(0.3, -0.16), fuss_r=(0.45, 0.02))),
        (15, dict(hand=(-0.3, 0.3, 0.92), richt=(-0.6, -0.25, -0.76), zwei='axt', griff=-0.11, rumpf=(46, 30), huefte=-8,
                  koerper=(0.32, -0.18), fuss_r=(0.45, 0.02))),
        (22, dict(hand=(-0.26, 0.32, 0.95), richt=(-0.55, -0.1, -0.83), zwei='axt', griff=-0.13, rumpf=(38, 25), huefte=-3,
                  koerper=(0.28, -0.16), fuss_r=(0.45, 0.02))),
        (26, 'stand'),
    ]),
    # D184: Der Speer — beide Hände am Schaft (links 0,5 m vor der rechten), Spitze nach vorn. Der Stich
    # kommt aus dem Zurückziehen, geht gerade nach vorn und wird gehalten; der Weitstoss mit Ausfallschritt.
    'Speer_Stand': ('Idle', 'schleife', [
        (1, dict(hand=(0.22, 0.02, 1.0), richt=(0.05, 0.95, 0.25), zwei='speer', rumpf=(-15, 4), koerper=(0, -0.05),
                 fuss_r=(0.12, 0.05), fuss_l=(-0.12, -0.03))),
        (25, dict(hand=(0.22, 0.03, 0.98), richt=(0.05, 0.95, 0.22), zwei='speer', rumpf=(-16, 6), koerper=(0, -0.065),
                  fuss_r=(0.12, 0.05), fuss_l=(-0.12, -0.03))),
        (49, dict(hand=(0.22, 0.02, 1.0), richt=(0.05, 0.95, 0.25), zwei='speer', rumpf=(-15, 4), koerper=(0, -0.05),
                  fuss_r=(0.12, 0.05), fuss_l=(-0.12, -0.03))),
    ]),
    'Speer_Stoss': ('Idle', 'einmal', [
        (1, dict(hand=(0.22, 0.02, 1.0), richt=(0.05, 0.95, 0.25), zwei='speer', rumpf=(-15, 4), koerper=(0, -0.05))),
        (6, dict(hand=(0.25, -0.18, 1.02), richt=(0.03, 0.97, 0.2), zwei='speer', rumpf=(-22, 2), koerper=(-0.04, -0.05))),
        (9, dict(hand=(0.14, 0.52, 1.12), richt=(0, 1, 0.08), zwei='speer', rumpf=(-4, 10), koerper=(0.12, -0.07), fuss_r=(0.3, 0.02))),
        (13, dict(hand=(0.13, 0.56, 1.1), richt=(0, 1, 0.06), zwei='speer', rumpf=(-3, 11), koerper=(0.13, -0.08), fuss_r=(0.3, 0.02))),
        (24, dict(hand=(0.22, 0.02, 1.0), richt=(0.05, 0.95, 0.25), zwei='speer', rumpf=(-15, 4), koerper=(0, -0.05))),
    ]),
    'Speer_Weit': ('Idle', 'einmal', [
        (1, dict(hand=(0.22, 0.02, 1.0), richt=(0.05, 0.95, 0.25), zwei='speer', rumpf=(-15, 4), koerper=(0, -0.05))),
        (10, dict(hand=(0.3, -0.32, 1.02), richt=(0.05, 0.96, 0.25), zwei='speer', rumpf=(-28, 0), koerper=(-0.08, -0.06), fuss_l=(-0.1, -0.05))),
        (14, dict(hand=(0.1, 0.78, 1.1), richt=(0, 1, 0.05), zwei='speer', rumpf=(0, 18), koerper=(0.3, -0.16), fuss_r=(0.55, 0.02))),
        (18, dict(hand=(0.1, 0.82, 1.07), richt=(0, 1, 0.03), zwei='speer', rumpf=(0, 19), koerper=(0.31, -0.17), fuss_r=(0.55, 0.02))),
        (30, dict(hand=(0.22, 0.02, 1.0), richt=(0.05, 0.95, 0.25), zwei='speer', rumpf=(-15, 4), koerper=(0, -0.05))),
    ]),
    'Speer_Lauf': ('Idle', 'einmal', [
        (1, dict(hand=(0.24, -0.05, 1.02), richt=(0.03, 0.96, 0.25), zwei='speer', rumpf=(-18, 8), koerper=(0.05, -0.06))),
        (7, dict(hand=(0.1, 0.84, 1.05), richt=(0, 1, 0.02), zwei='speer', rumpf=(0, 20), koerper=(0.35, -0.18), fuss_r=(0.6, 0.02))),
        (11, dict(hand=(0.1, 0.86, 1.03), richt=(0, 1, 0.0), zwei='speer', rumpf=(0, 21), koerper=(0.36, -0.19), fuss_r=(0.6, 0.02))),
        (22, dict(hand=(0.22, 0.02, 1.0), richt=(0.05, 0.95, 0.25), zwei='speer', rumpf=(-15, 4), koerper=(0, -0.05))),
    ]),
    'Speer_Block': ('Idle', 'einmal', [
        (1, dict(hand=(0.22, 0.02, 1.0), richt=(0.05, 0.95, 0.25), zwei='speer', rumpf=(-15, 4), koerper=(0, -0.05))),
        (5, dict(hand=(0.3, 0.3, 1.32), richt=(-1, 0.08, 0.12), zwei='speer', rumpf=(-6, 6), koerper=(-0.03, -0.08), fuss_l=(-0.12, -0.03))),
        (8, dict(hand=(0.3, 0.31, 1.31), richt=(-1, 0.08, 0.12), zwei='speer', rumpf=(-6, 7), koerper=(-0.03, -0.09), fuss_l=(-0.12, -0.03))),
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
                 fuss_l=(0.14, -0.02), fuss_r=(-0.1, 0.04), pol=(0.5, -0.2, -0.8))),
        (9, dict(hand=(0.36, -0.06, 1.22), richt=(0.62, -0.75, 0.22), zwei='messer', rumpf=(-48, 0), huefte=14,
                 koerper=(-0.04, -0.1), fuss_l=(0.3, -0.04), fuss_r=(-0.12, 0.05), pol=(0.5, -0.3, -0.8))),
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
                 fuss_l=(0.14, -0.02), fuss_r=(-0.1, 0.04), pol=(0.3, -0.4, -0.8))),
        (8, dict(hand=(-0.26, -0.02, 1.25), richt=(-0.6, -0.72, 0.3), zwei='messer', rumpf=(42, 2), huefte=-14,
                 koerper=(-0.04, -0.1), fuss_l=(0.14, -0.02), fuss_r=(0.22, 0.06), pol=(0.3, -0.4, -0.8))),
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
        (4, dict(hand=(0.3, 0.0, 1.5), richt=(0.45, -0.5, 0.75), zwei='messer', rumpf=(-32, 10), koerper=(0.08, -0.06),
                 pol=(0.6, 0.1, -0.6))),
        (7, dict(hand=(0.3, -0.04, 1.54), richt=(0.4, -0.7, 0.6), zwei='messer', rumpf=(-40, 10), huefte=12,
                 koerper=(0.15, -0.1), fuss_r=(0.5, 0.02), pol=(0.6, 0.1, -0.6))),
        (9, dict(hand=(0.15, 0.45, 1.42), richt=(0.3, 0.85, 0.42), zwei='messer', rumpf=(-5, 20), huefte=10,
                 koerper=(0.3, -0.15), fuss_r=(0.5, 0.02))),
        (11, dict(hand=(-0.25, 0.42, 0.92), richt=(-0.55, 0.6, -0.58), zwei='messer', rumpf=(35, 28), huefte=2,
                  koerper=(0.36, -0.18), fuss_r=(0.5, 0.02))),
        # D420 Nachschwung: tief links unten aus (Spitze knapp 20 cm über dem Boden), das Becken bremst, der Körper bleibt
        # im Ausfall auf dem rechten Fuss; zurück ab Bild 20.
        (15, dict(hand=(-0.3015, 0.2925, 0.874), richt=(-0.7, 0.1, -0.7), zwei='messer', rumpf=(46, 30), huefte=-8,
                  koerper=(0.38, -0.2), fuss_r=(0.5, 0.02))),
        (20, dict(hand=(-0.25, 0.32, 0.88), richt=(-0.62, 0.18, -0.76), zwei='messer', rumpf=(38, 24), huefte=-3,
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
                  fuss_l=(0.32, -0.04), fuss_r=(-0.12, 0.05), pol=(0.7, 0.2, -0.3))),
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
                 fuss_l=(0.14, -0.02), fuss_r=(-0.12, 0.05), pol=(0.6, -0.3, -0.6))),
        (8, dict(hand=(0.07, 0.34, 1.33), richt=(-0.65, 0.15, 0.74), zwei='messer', rumpf=(-6, 6), koerper=(-0.04, -0.1),
                 fuss_l=(0.14, -0.02), fuss_r=(-0.12, 0.05), pol=(0.6, -0.3, -0.6))),
    ]),
    # D414: Räucherkanne (Imker-Smoker, Baukasten §18) — die linke Hand hält die Kanne am Blasebalg und
    # drückt ihn, die rechte hält die einhändige Waffe tief rechts vorn — die Klinge kreuzt nicht vor der Kanne
    # (erste Fassung aus Klinge_Stand: im Prüfbild kreuzte sie). Ein Smoker wird
    # real mit einer Hand geführt: Balg in der Hand, Kanne daneben. Zwei Stösse je Sekunde; die Hand schiebt
    # dabei ein wenig vor und sinkt (Druck auf den Balg). Schleife, 1 s.
    'Geraet_Blasebalg': (KLINGE_BASIS, 'schleife', [
        (1, dict(hand=(0.3, 0.26, 1.05), richt=(0.1, 0.8, 0.59), rumpf=(-6, 6), koerper=(0, -0.07),
                 fuss_r=(0.14, 0.04), fuss_l=(-0.12, -0.03), links=(-0.14, 0.4, 1.24))),
        (7, dict(hand=(0.3, 0.26, 1.04), richt=(0.1, 0.8, 0.59), rumpf=(-6, 7), koerper=(0, -0.075),
                 fuss_r=(0.14, 0.04), fuss_l=(-0.12, -0.03), links=(-0.14, 0.44, 1.21))),
        (13, dict(hand=(0.3, 0.26, 1.05), richt=(0.1, 0.8, 0.59), rumpf=(-6, 6), koerper=(0, -0.07),
                  fuss_r=(0.14, 0.04), fuss_l=(-0.12, -0.03), links=(-0.14, 0.4, 1.24))),
        (19, dict(hand=(0.3, 0.26, 1.04), richt=(0.1, 0.8, 0.59), rumpf=(-6, 7), koerper=(0, -0.075),
                  fuss_r=(0.14, 0.04), fuss_l=(-0.12, -0.03), links=(-0.14, 0.44, 1.21))),
        (25, dict(hand=(0.3, 0.26, 1.05), richt=(0.1, 0.8, 0.59), rumpf=(-6, 6), koerper=(0, -0.07),
                  fuss_r=(0.14, 0.04), fuss_l=(-0.12, -0.03), links=(-0.14, 0.4, 1.24))),
    ]),
}
# D414: Treffer-Scheitel und Durchzug der Messerhiebe in Bildern (24/s), solange es keine Kampfwerte gibt —
# die Regel (`content/waffen/`, `hieb`) übernimmt sie, sobald D407 misst (`tests/waffenclips.test.ts` prüft).
TREFFER = {'Messer_Quer_A': (9, 13), 'Messer_Quer_B': (8, 12), 'Messer_Schwer': (12, 17), 'Messer_Lauf': (7, 11),
           # D429: die Axt — dieselben Bilder wie `hieb` in `content/waffen/axt.json` (unverändert seit vor D429).
           'Axt_Hieb': (12, 16), 'Axt_Quer': (10, 15), 'Axt_Schwer': (20, 25), 'Axt_Lauf': (7, 11)}
NAMEN = tuple(CLIPS)
ACHSE = {'Klinge_Stand': 'klinge', 'Klinge_Stich': 'klinge',
         'Axt_Stand': 'axt', 'Axt_Block': 'axt', 'Axt_Hieb': 'axt', 'Axt_Quer': 'axt', 'Axt_Schwer': 'axt', 'Axt_Lauf': 'axt',
         'Speer_Stand': 'speer', 'Speer_Stoss': 'speer', 'Speer_Weit': 'speer', 'Speer_Lauf': 'speer', 'Speer_Block': 'speer',
         'Messer_Stand': 'messer', 'Messer_Quer_A': 'messer', 'Messer_Quer_B': 'messer', 'Messer_Lauf': 'messer',
         'Messer_Schwer': 'messer', 'Messer_Block': 'messer', 'Geraet_Blasebalg': 'klinge'}


class Rig:
    """Das Rig in Weltmetern: Achsen, Standpunkt, Knochenlängen — gelesen aus der Grundhaltung."""

    def __init__(self, arm):
        self.arm = arm
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
        self.drehe_hin(ober, e1 - s, knie - s)
        e1 = self.w(unter)
        self.drehe_hin(unter, self.aus_lokal(unter, ende) - e1, (s + dn * dist) - e1)


RUMPF = (('Hips', 0.25), ('Abdomen', 0.25), ('Torso', 0.25), ('Chest', 0.25))
# Linke Hand entlang der Klinge/des Stiels von der rechten aus, Meter (+ = zur Spitze). D429: Axt −0,42 (am Stielende,
# hinter der rechten; bis D429 +0,22, die Hände vertauscht), je Schlüssel über das Posenfeld `griff`.
GRIFF = {'axt': -0.42, 'klinge': -0.09, 'speer': 0.5, 'messer': -0.13}
# D429: Lage der Axtkopfmitte vor dem rechten Handgelenk bei `griff` = −0,62 (rechte Hand an der vorderen
# Griffstelle, `tools/waffenmodelle.py`); gleitet die rechte Hand zurück, liegt der Kopf um so viel weiter vorn.
AXT_KOPF = 0.30
AXT_LINKS = 0.62
POL_R = (0.6, -0.2, -0.8)
POL_L = (-0.6, -0.2, -0.8)


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


def _pose(rig, basis, pose, bewegung):
    """Eine Pose aus der Grundhaltung. `bewegung`: Weltrichtung der Hand um diesen Schlüssel."""
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
    # Der Kopf dreht gegen: Der Blick bleibt beim Gegner.
    if dreh:
        rig.drehe('Neck', rig.oben, -0.4 * dreh)
        rig.drehe('Head', rig.oben, -0.35 * dreh)
    if neig:
        rig.drehe('Head', rig.rechts, 0.5 * neig)
    for s, feld, seite in (('R', 'fuss_r', 1), ('L', 'fuss_l', -1)):
        fv, fr = pose.get(feld, (0, 0))
        delta = rig.vorn * fv + rig.rechts * fr
        if fv or fr:
            rig.schiebe('Foot.' + s, delta)
            if 'PT.' + s in rig.pb:
                rig.schiebe('PT.' + s, delta)
        rig.zwei('UpperLeg.' + s, 'LowerLeg.' + s, knoechel[s] + delta, rig.vorn + rig.rechts * 0.15 * seite, ende[s])

    if 'hand' in pose:
        ziel = rig.punkt(*pose['hand'])
        rig.zwei('UpperArm.R', 'LowerArm.R', ziel, rig.richtung(*pose.get('pol', POL_R)), hand_ende['R'])
        klinge = rig.richtung(*pose['richt'])
        unterarm = (rig.w('Wrist.R') - rig.w('LowerArm.R')).normalized()
        y = bewegung - klinge * bewegung.dot(klinge)
        if y.length < 0.05:
            y = unterarm - klinge * unterarm.dot(klinge)
        elif pose.get('zwei') not in ('axt', 'speer', 'messer') and y.dot(unterarm) < 0:
            y = -y   # die Klinge hat zwei Schneiden: das Handgelenk knickt nicht nach hinten
            # (Messer und Axt haben eine: Die Schneide führt, auch wenn der Unterarm dafür drehen muss.)
        rig.lage('Wrist.R', -klinge, y)
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
                if abstand != pose.get('griff', GRIFF['axt']):
                    print(f'    Griff links: Arm reicht nicht, linke Hand {abstand:.2f} statt {pose.get("griff", GRIFF["axt"]):.2f}')
            rig.zwei('UpperArm.L', 'LowerArm.L', griff, rig.richtung(*pose.get('pol_l', POL_L)), hand_ende['L'])
            ua = (rig.w('Wrist.L') - rig.w('LowerArm.L')).normalized()
            rig.lage('Wrist.L', -klinge, ua - klinge * ua.dot(klinge) if abs(ua.dot(klinge)) < 0.95 else y)
    if 'links' in pose:
        rig.zwei('UpperArm.L', 'LowerArm.L', rig.punkt(*pose['links']), rig.richtung(*POL_L), hand_ende['L'])


def _handpunkt(rig, basis, pose):
    if pose != 'stand' and 'hand' in pose:
        return rig.punkt(*pose['hand'])
    _setze(rig, basis)
    return rig.w('Wrist.R')


def _kopfbahn(rig, basis, schluessel, grund):
    """D429: Mitte des Axtkopfs je Schlüssel — rechte Hand plus Stielrichtung mal Abstand (der Kopf liegt um so weiter
    vorn, je weiter die rechte Hand zum Stielende gleitet). 'stand' ist der erste Schlüssel der Grundhaltung."""
    aus = []
    for _, pose in schluessel:
        if pose == 'stand' and grund in CLIPS and CLIPS[grund][2][0][1] != 'stand':
            pose = CLIPS[grund][2][0][1]
        if pose != 'stand' and 'hand' in pose:
            r = rig.richtung(*pose['richt'])
            abstand = AXT_KOPF + AXT_LINKS + pose.get('griff', GRIFF['axt'])
            aus.append(rig.punkt(*pose['hand']) + r * abstand)
        else:
            aus.append(_handpunkt(rig, basis, pose))
    return aus


def baue_clip(rig, ad, name, basis):
    grund, art, schluessel = CLIPS[name]
    akt = bpy.data.actions.new(name)
    ad.action = akt
    vorige = {}
    punkte = [_handpunkt(rig, basis, p) for _, p in schluessel]
    # D429: Bei der Axt dreht das Handgelenk nach der Bahn des Kopfs — die Schneide führt dort, wo geschnitten wird.
    bahn = _kopfbahn(rig, basis, schluessel, grund) if ACHSE.get(name) == 'axt' else punkte
    bilder = [b for b, _ in schluessel]
    for i, (bild, pose) in enumerate(schluessel):
        a = bahn[max(0, i - 1)]
        b = bahn[min(len(bahn) - 1, i + 1)]
        if ACHSE.get(name) == 'axt' and name in TREFFER:
            # D429: Die Schneide zeigt schon beim Ausholen in die Richtung, in die der Schlag gehen wird (die Axt dreht
            # im Scheitel nicht um), im Schlag in die Bahn, im Nachschwung dorthin, wohin der Kopf weiterläuft.
            iS, iD = bilder.index(TREFFER[name][0]), bilder.index(TREFFER[name][1])
            if i <= iS:
                a, b = bahn[iS], bahn[iS + 1]
            elif i >= iD:
                a, b = bahn[i - 1], bahn[i]
        _pose(rig, basis, pose, b - a)
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
                _basis(Rig(arm), ad, aktionen['Idle'])
                rig = Rig(arm)
            basen[grund] = _basis(rig, ad, quelle)
        gebaut[name] = baue_clip(rig, ad, name, basen[grund])
    ad.action = None
    for t in ad.nla_tracks:
        t.mute = False
    bpy.context.scene.frame_set(1)
    return gebaut
