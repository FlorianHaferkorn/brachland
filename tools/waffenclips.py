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
  * **Zweihändig**: Die linke Hand greift an den Stiel (Axt 0,22 m vor der rechten) oder an den Knauf.

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
    'Axt_Stand': ('Idle', 'schleife', [
        (1, dict(hand=(0.22, 0.24, 1.02), richt=(0.12, 0.3, 0.95), zwei='axt', koerper=(0, -0.03), rumpf=(-8, 3))),
        (25, dict(hand=(0.22, 0.25, 1.0), richt=(0.12, 0.33, 0.94), zwei='axt', koerper=(0, -0.045), rumpf=(-9, 5))),
        (49, dict(hand=(0.22, 0.24, 1.02), richt=(0.12, 0.3, 0.95), zwei='axt', koerper=(0, -0.03), rumpf=(-8, 3))),
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
    # D173: Axtblock — der Stiel quer vor dem Gesicht, beide Hände, Gewicht tief. Gehalten wird das
    # letzte Bild (die Szene klemmt den Clip), deshalb endet er nicht im Stand.
    'Axt_Block': ('Axt_Stand', 'einmal', [
        (1, 'stand'),
        (4, dict(hand=(0.26, 0.3, 1.38), richt=(-0.95, 0.1, 0.3), zwei='axt', rumpf=(-6, 4), koerper=(-0.03, -0.06),
                 fuss_r=(0.08, 0.05), fuss_l=(-0.12, -0.03), pol=(0.6, -0.3, -0.6))),
        (8, dict(hand=(0.28, 0.32, 1.42), richt=(-0.97, 0.1, 0.22), zwei='axt', rumpf=(-6, 6), koerper=(-0.04, -0.08),
                 fuss_r=(0.08, 0.05), fuss_l=(-0.12, -0.03), pol=(0.6, -0.3, -0.6))),
    ]),
    # Querhieb mit der Axt: von rechts hinten über vorn nach links, beide Hände, volle Drehung.
    'Axt_Quer': ('Axt_Stand', 'einmal', [
        (1, 'stand'),
        (5, dict(hand=(0.35, 0.08, 1.15), richt=(0.8, -0.45, 0.35), zwei='axt', rumpf=(-30, 0), pol=(0.5, -0.2, -0.8))),
        (10, dict(hand=(0.38, -0.1, 1.2), richt=(0.7, -0.7, 0.15), zwei='axt', rumpf=(-45, 0), koerper=(-0.03, -0.05), pol=(0.5, -0.3, -0.8))),
        (12, dict(hand=(0.35, 0.35, 1.15), richt=(0.6, 0.75, 0.0), zwei='axt', rumpf=(-12, 8), koerper=(0.03, -0.06))),
        (15, dict(hand=(-0.18, 0.5, 1.1), richt=(-0.5, 0.85, -0.05), zwei='axt', rumpf=(35, 12), koerper=(0.1, -0.08), fuss_r=(0.15, 0.05))),
        (21, dict(hand=(-0.38, 0.15, 1.05), richt=(-0.8, -0.2, -0.15), zwei='axt', rumpf=(50, 10), koerper=(0.08, -0.07), fuss_r=(0.15, 0.05))),
        (30, 'stand'),
    ]),
    # Spalthieb: tief ausholen, Axt hinter dem Rücken, über oben in den Boden.
    'Axt_Schwer': ('Axt_Stand', 'einmal', [
        (1, 'stand'),
        (6, dict(hand=(0.15, 0.22, 1.3), richt=(0.1, 0.3, 0.95), zwei='axt', koerper=(0, -0.06), rumpf=(-8, 5))),
        (12, dict(hand=(0.12, 0.05, 1.82), richt=(0.05, -0.4, 0.9), zwei='axt', rumpf=(-5, -10), pol=(0.7, 0.3, -0.3))),
        (17, dict(hand=(0.1, -0.12, 1.86), richt=(0.02, -0.95, 0.3), zwei='axt', rumpf=(-5, -18), koerper=(-0.08, 0), pol=(0.7, 0.2, -0.3))),
        (20, dict(hand=(0.1, -0.18, 1.82), richt=(0, -0.9, -0.4), zwei='axt', rumpf=(-5, -20), koerper=(-0.1, 0), pol=(0.7, 0.2, -0.3))),
        (22, dict(hand=(0.08, 0.18, 1.92), richt=(0, 0.1, 1), zwei='axt', rumpf=(0, -6), koerper=(-0.02, 0.02), pol=(0.7, 0.3, -0.3))),
        (23, dict(hand=(0.05, 0.5, 1.6), richt=(0, 0.9, 0.45), zwei='axt', rumpf=(0, 12), koerper=(0.06, -0.06))),
        (25, dict(hand=(0.02, 0.6, 0.78), richt=(0, 0.5, -0.85), zwei='axt', rumpf=(0, 35), koerper=(0.15, -0.2), fuss_r=(0.3, 0))),
        (31, dict(hand=(0.02, 0.55, 0.65), richt=(0, 0.45, -0.88), zwei='axt', rumpf=(0, 38), koerper=(0.15, -0.21), fuss_r=(0.3, 0))),
        (40, 'stand'),
    ]),
    # Laufhieb: schräg von rechts oben nach links unten, im Ausfall.
    'Axt_Lauf': ('Axt_Stand', 'einmal', [
        (1, dict(hand=(0.3, 0.05, 1.45), richt=(0.45, -0.3, 0.85), zwei='axt', rumpf=(-25, 12), koerper=(0, -0.05))),
        (4, dict(hand=(0.35, 0.0, 1.6), richt=(0.5, -0.4, 0.75), zwei='axt', rumpf=(-30, 10), koerper=(0, -0.05))),
        (7, dict(hand=(0.4, -0.1, 1.7), richt=(0.45, -0.6, 0.65), zwei='axt', rumpf=(-40, 10), koerper=(0, -0.05), pol=(0.6, 0.1, -0.6))),
        (9, dict(hand=(0.2, 0.45, 1.45), richt=(0.35, 0.8, 0.45), zwei='axt', rumpf=(-5, 20), koerper=(0.15, -0.08), fuss_r=(0.3, 0))),
        (11, dict(hand=(-0.25, 0.45, 0.9), richt=(-0.55, 0.6, -0.55), zwei='axt', rumpf=(35, 30), koerper=(0.3, -0.15), fuss_r=(0.5, 0))),
        (17, dict(hand=(-0.35, 0.25, 0.8), richt=(-0.7, 0.2, -0.65), zwei='axt', rumpf=(40, 28), koerper=(0.25, -0.12), fuss_r=(0.45, 0))),
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
}
NAMEN = tuple(CLIPS)
ACHSE = {'Klinge_Stand': 'klinge', 'Klinge_Stich': 'klinge',
         'Axt_Stand': 'axt', 'Axt_Block': 'axt', 'Axt_Quer': 'axt', 'Axt_Schwer': 'axt', 'Axt_Lauf': 'axt',
         'Speer_Stand': 'speer', 'Speer_Stoss': 'speer', 'Speer_Weit': 'speer', 'Speer_Lauf': 'speer', 'Speer_Block': 'speer'}


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
GRIFF = {'axt': 0.22, 'klinge': -0.09, 'speer': 0.5}   # linke Hand entlang der Klinge/des Stiels, Meter
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
    dreh, neig = pose.get('rumpf', (0, 0))
    for name, anteil in RUMPF:
        if name in rig.pb:
            if dreh: rig.drehe(name, rig.oben, dreh * anteil)
            if neig: rig.drehe(name, rig.rechts, -neig * anteil)
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
        elif pose.get('zwei') not in ('axt', 'speer') and y.dot(unterarm) < 0:
            y = -y   # die Klinge hat zwei Schneiden: das Handgelenk knickt nicht nach hinten
        rig.lage('Wrist.R', -klinge, y)
        if pose.get('zwei'):
            hand = rig.w('Wrist.R')
            griff = hand + klinge * GRIFF[pose['zwei']]
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


def baue_clip(rig, ad, name, basis):
    grund, art, schluessel = CLIPS[name]
    akt = bpy.data.actions.new(name)
    ad.action = akt
    vorige = {}
    punkte = [_handpunkt(rig, basis, p) for _, p in schluessel]
    for i, (bild, pose) in enumerate(schluessel):
        a = punkte[max(0, i - 1)]
        b = punkte[min(len(punkte) - 1, i + 1)]
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
