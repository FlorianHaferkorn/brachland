"""
BRACHLAND — Bewegungen aus frei lizenzierten Videos (D430): Video → Posenerkennung → Schlüsselposen im Format der
Posenfelder von `tools/waffenclips.py`. **Nicht im Gate**, nichts ausgeliefert: Die Videos liegen nur lokal unter
`.cache/videos-d430/` (Quellen, Lizenzen und Urheber in `docs/design/BRACHLAND_Waffenbewegungen_v1.md` §7), die
abgeleiteten Schlüsselposen sind eigene Arbeit mit Quellenangabe (D430).

Läuft im eigenen venv mit MediaPipe Pose (Apache 2.0, CPU genügt; geprüft mit `mediapipe` 1.2.3, Modell
`pose_landmarker_heavy.task`) und OpenCV. MediaPipe lädt beim Start `libEGL.so.1`/`libGLESv2.so.2`, auch wenn es nur auf
der CPU rechnet; fehlen sie (Cloud ohne Grafiktreiber), genügen leere Ersatzbibliotheken, die die Namen der Funktionen
tragen (D430: je Name `long f(void){return 0;}`, mit `gcc -shared` gebaut, über `LD_LIBRARY_PATH`) — die CPU-Erkennung
ruft sie nicht auf. Heruntergeladene Videos nur in einen eigenen Ordner, Python mit `-I`.

  .cache/venv-d430/bin/python -I tools/videoposen.py erkennen <video> <ausdir> --name N --waffe axt|messer
        [--von s] [--bis s] [--ausschnitt x0,y0,x1,y1] [--zeitlupe f] [--modell <pose_landmarker_*.task>]
        [--hiebe 1,2] [--oben kamera|koerper] [--abwaerts] [--regel] [--eps 0.05]
  .cache/venv-d430/bin/python -I tools/videoposen.py stapeln <ausdir> --name N --hiebe K [--bilder 1,8,…]
        [--renders <dir> --render-name <Auftragname>]
  .cache/venv-d430/bin/python -I tools/videoposen.py vergleich <ausdir> --name N --clip <Bestandsclip>[,…]

Probeclip (nie in `held-clips.glb`): `PROBE=<ausdir>/N.json:<Clip> blender … --python tools/clipnachbau.py -- <figur-roh>
<probe.glb>`, dann `clipnachbau.mjs einfuegen` in eine **Kopie**, `figur`, `kontaktbogen.py` (Auftrag mit dem Clip).

**Kette** (`erkennen`):
  1. Bilder aus dem Video (OpenCV liest WebM/VP9), optional ein Ausschnitt um die eine Person (Anteile des Bilds).
  2. MediaPipe PoseLandmarker im Videomodus: 33 Punkte je Bild, 2D (Bildpunkte) und 3D (Weltschätzung in Metern,
     Ursprung Hüftmitte, Achsen der Kamera). Fehlende Bilder linear gefüllt.
  3. Glätten: Median über 3 Bilder (einzelne Sprünge der Erkennung), dann Savitzky–Golay (Ordnung 2, Fenster 5 Bilder) — kurz, damit der Hieb seine Spitze behält. Das Zittern
     (Rest roh − geglättet) wird in der Ruhe gemessen und ausgegeben.
  4. **Füsse am Boden:** MediaPipe legt jedes Bild auf die Hüftmitte, die Verschiebung des Körpers fehlt. Sie wird
     zurückgerechnet: Der Fuss, der im Bild (ruhige Kamera) stillsteht, steht auch in der Welt still; die Hüfte
     wandert um das Gegenteil seiner Bewegung im Hüftraum.
  5. Achsen des Körpers aus der Ruhe vor dem ersten Hieb: oben = Kamera-Senkrechte (`--oben kamera`, Kamera waagrecht
     angenommen) oder Knöchel→Schultern in der Ruhe (`koerper`, für eine geneigte Kamera); rechts = Hüftlinie; vorn =
     oben × rechts, zu den Zehen hin. Stimmen die Seiten der Erkennung nicht mit den Zehen überein, sind links/rechts
     vertauscht (Ansicht von hinten) und werden getauscht. Ein Linkshänder (bei der Axt: die **rechte** Hand am
     Stielende) wird gespiegelt — unsere Figur führt rechts.
  6. Maßstab auf die alte Wanderin, auf der `waffenclips.py` baut (Weltformel D414 trägt es von dort auf die
     Hauptfigur), je Glied: Becken und Füsse nach der Hüfthöhe über dem Knöchel (0,962 m), der Rumpf ist der der
     Wanderin (0,40 m, nur Neigung und Drehung aus dem Video), die Hände hängen an ihren Schultern mit dem Armweg des
     Videos auf ihre Armlänge (0,446 m) gebracht — sonst griffe die IK ins Leere.
  7. **Phasen** aus der Geschwindigkeit der Handmitte: Ruhe → Ausholen → **Scheitel** (Umkehrpunkt oben, Beginn des
     Schlags = `hieb.scheitel`) → schnellstes Bild → **Durchzug** (letztes Bild mit ≥ 50 % der Spitze =
     `hieb.durchzug`, wie D428 misst) → **Nachschwung** (bis unter 20 %) → Ruhe.
  8. **Die Waffe sieht die Erkennung nicht** — Regeln: Axt (D429): linke Hand fest am Stielende, der Stiel läuft von ihr
     durch die rechte zum Kopf; liegen beide Hände am Ende (Treffen) oder ist die ferne Hand verdeckt, gilt die Flucht
     Schultermitte → Hände. `griff` = Abstand der Hände am Stiel. Mit `--regel` (empfohlen) Stielwinkel und Griff nach
     dem Handbuch statt aus den Händen (`nachlauf`). Messer: Klinge von der linken (Knauf) durch die rechte (Gehilz).
     Die Schneide dreht `waffenclips.py` selbst in die Bahn (D429).
  9. Schlüsselbilder: die Phasenbilder plus so viele Zwischenbilder, dass Hand und Hüfte zwischen zwei Schlüsseln
     linear auf ≤ 5 cm folgen (Ramer–Douglas–Peucker, `--eps`), umgerechnet auf 24 Bilder/s Echtzeit (`--zeitlupe`: so viel
     langsamer läuft das Video als die Wirklichkeit).

Ausgabe in `<ausdir>`: `N_posen.json` (je Bild alle Punkte 2D, 3D roh und geglättet, Körperachsen), `N.json`
(Phasen, Messwerte, Schlüsselposen als `waffenclips`-Clip — `clipnachbau.py` baut ihn mit `PROBE=`), `N_bild_##.png`
(Videobild mit Skelett) und `N_skelett_##.png` (3D-Schätzung von der Seite, mit der Waffe nach Regel) je Schlüssel.
"""
import argparse, json, math, os, sys

import numpy as np

# Wanderin (Rig von `waffenclips.py`, Idle), gemessen in Blender 5.3 — Meter vom Standpunkt (rechts, vorn, hoch).
RIG = dict(huefte_h=0.962, schulter_h=1.362, arm=0.446, schulter_r=0.115, schulter_v=-0.018, huefte_v=-0.032,
           fuss_r=(0.095, -0.015), fuss_l=(-0.096, -0.015), neig0=-1.6)
# MediaPipe Pose: Indizes der 33 Punkte (links/rechts aus Sicht der Person).
P = dict(nase=0, schulter_l=11, schulter_r=12, ellbogen_l=13, ellbogen_r=14, hand_l=15, hand_r=16, huefte_l=23,
         huefte_r=24, knie_l=25, knie_r=26, knoechel_l=27, knoechel_r=28, ferse_l=29, ferse_r=30, zeh_l=31, zeh_r=32)
PAARE = [(1, 4), (2, 5), (3, 6), (7, 8), (9, 10)] + [(i, i + 1) for i in range(11, 33, 2)]
KNOCHEN = [(11, 12), (11, 13), (13, 15), (12, 14), (14, 16), (11, 23), (12, 24), (23, 24), (23, 25), (25, 27),
           (24, 26), (26, 28), (27, 29), (29, 31), (27, 31), (28, 30), (30, 32), (28, 32)]
GRIFF_GRENZEN = (-0.62, -0.11)   # D429: rechte Hand ¾ hinauf bis beide Hände am Ende


# ── Lesen und Erkennen ──────────────────────────────────────────────────────────────────────────────────────────────
def lies_bilder(pfad, von, bis, ausschnitt):
    import cv2
    cap = cv2.VideoCapture(pfad)
    fps = cap.get(cv2.CAP_PROP_FPS)
    breite, hoehe = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if von:
        cap.set(cv2.CAP_PROP_POS_MSEC, von * 1000)
    x0, y0, x1, y1 = ausschnitt
    box = (int(x0 * breite), int(y0 * hoehe), int(x1 * breite), int(y1 * hoehe))
    bilder, zeiten = [], []
    while True:
        ok, bild = cap.read()
        if not ok:
            break
        t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
        if bis and t > bis:
            break
        bilder.append(bild[box[1]:box[3], box[0]:box[2]].copy())
        zeiten.append(t)
    cap.release()
    return bilder, np.array(zeiten), fps, (breite, hoehe), box


def erkenne(bilder, fps, modell):
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision
    opt = vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=modell),
                                       running_mode=vision.RunningMode.VIDEO, num_poses=1,
                                       min_pose_detection_confidence=0.5, min_tracking_confidence=0.5)
    n = len(bilder)
    p2 = np.full((n, 33, 3), np.nan)   # x, y in Bildpunkten des Ausschnitts, Sichtbarkeit
    p3 = np.full((n, 33, 3), np.nan)   # Welt (Meter, Kameraachsen, y unten)
    with vision.PoseLandmarker.create_from_options(opt) as lm:
        for i, b in enumerate(bilder):
            rgb = b[:, :, ::-1].copy()
            img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            r = lm.detect_for_video(img, int(round(i * 1000 / fps)))
            if r.pose_landmarks:
                h, w = b.shape[:2]
                p2[i] = [(q.x * w, q.y * h, q.visibility if q.visibility is not None else 1) for q in r.pose_landmarks[0]]
                p3[i] = [(q.x, q.y, q.z) for q in r.pose_world_landmarks[0]]
    return p2, p3


def fuelle(a):
    """Fehlende Bilder linear füllen (je Punkt und Achse)."""
    a = a.copy()
    n = a.shape[0]
    t = np.arange(n)
    gut = ~np.isnan(a[:, 0, 0])
    if gut.sum() < 2:
        raise SystemExit('Posenerkennung fand die Person in weniger als zwei Bildern')
    for j in range(a.shape[1]):
        for k in range(a.shape[2]):
            a[:, j, k] = np.interp(t, t[gut], a[gut, j, k])
    return a, int((~gut).sum())


def median3(a):
    """Ausreisser eines einzelnen Bilds (die Erkennung springt für ein Bild auf den Stiel oder ins Laub) entfernen."""
    b = a.copy()
    b[1:-1] = np.median(np.stack([a[:-2], a[1:-1], a[2:]]), axis=0)
    return b


def glaette(a, fenster=5):
    """Savitzky–Golay, Ordnung 2: Koeffizienten aus kleinsten Quadraten, Ränder gespiegelt."""
    h = fenster // 2
    x = np.arange(-h, h + 1)
    A = np.vstack([x ** 0, x, x ** 2]).T
    c = np.linalg.pinv(A)[0]
    pad = np.concatenate([a[h:0:-1], a, a[-2:-h - 2:-1]], axis=0)
    aus = np.zeros_like(a)
    for i, ci in enumerate(c):
        aus += ci * pad[i:i + a.shape[0]]
    return aus


# ── Welt, Achsen, Maßstab ───────────────────────────────────────────────────────────────────────────────────────────
def verschiebung(w3, p2):
    """Füsse am Boden: Hüft-Raum (MediaPipe) → Welt. Je Bild wandert der Körper um das Gegenteil der Bewegung der
    Füsse im Hüftraum, gewichtet danach, wie still der Fuss im Bild steht (ruhige Kamera)."""
    n = w3.shape[0]
    T = np.zeros((n, 3))
    bein = (np.linalg.norm(p2[:, P['huefte_l'], :2] - p2[:, P['knoechel_l'], :2], axis=1).mean() +
            np.linalg.norm(p2[:, P['huefte_r'], :2] - p2[:, P['knoechel_r'], :2], axis=1).mean()) / 2
    gewichte = []
    for i in range(1, n):
        d, g = np.zeros(3), 0.0
        gi = []
        for s in ('l', 'r'):
            k = P['knoechel_' + s]
            v2 = np.linalg.norm(p2[i, k, :2] - p2[i - 1, k, :2]) / max(bein, 1)   # Beinlängen je Bild
            wgt = math.exp(-v2 / 0.01)
            gi.append(wgt)
            d += wgt * (w3[i, k] - w3[i - 1, k])
            g += wgt
        gewichte.append(gi)
        T[i] = T[i - 1] - (d / g if g > 1e-6 else 0)
    return w3 + T[:, None, :], T


def achsen(W, ruhe, oben_art):
    """Körperachsen aus den Ruhebildern: (rechts, vorn, oben), Ursprung über der Hüftmitte auf Knöchelhöhe."""
    R = W[ruhe].mean(axis=0)
    if oben_art == 'koerper':
        oben = (R[P['schulter_l']] + R[P['schulter_r']]) / 2 - (R[P['knoechel_l']] + R[P['knoechel_r']]) / 2
    else:
        oben = np.array([0.0, -1.0, 0.0])
    oben /= np.linalg.norm(oben)
    rechts = R[P['huefte_r']] - R[P['huefte_l']]
    rechts -= oben * rechts.dot(oben)
    rechts /= np.linalg.norm(rechts)
    vorn = np.cross(oben, rechts)
    zehen = (R[P['zeh_l']] - R[P['ferse_l']]) + (R[P['zeh_r']] - R[P['ferse_r']])
    getauscht = False
    if vorn.dot(zehen) < 0:
        # Hüftlinie und Zehen widersprechen sich: Die Erkennung hat links und rechts vertauscht (Ansicht von hinten).
        vorn = -vorn
        rechts = np.cross(vorn, oben)
        getauscht = True
    mitte = (R[P['huefte_l']] + R[P['huefte_r']]) / 2
    boden = min((R[P['knoechel_l']] - mitte).dot(oben), (R[P['knoechel_r']] - mitte).dot(oben))
    ursprung = mitte + oben * boden
    return np.vstack([rechts, vorn, oben]), ursprung, getauscht


def tausche(a):
    a = a.copy()
    for i, j in PAARE:
        a[:, [i, j]] = a[:, [j, i]]
    return a


def koerperraum(W, M, ursprung, spiegeln):
    K = (W - ursprung) @ M.T          # (rechts, vorn, hoch)
    if spiegeln:
        K = tausche(K)
        K[..., 0] *= -1
    return K


def bildtempo(p2, p3, fps_echt):
    """Tempo der Handmitte im Bild, in Metern des Videos je Sekunde Echtzeit: Bildpunkte je Meter aus der Strecke
    Schultermitte–Knöchelmitte (2D gegen 3D, Median über alle Bilder), dann zeitlich geglättet (Gauss, σ = 1 Bild)."""
    def strecke(a, dims):
        o = (a[:, P['schulter_l'], dims] + a[:, P['schulter_r'], dims]) / 2
        u = (a[:, P['knoechel_l'], dims] + a[:, P['knoechel_r'], dims]) / 2
        return np.linalg.norm(o - u, axis=1)
    px_je_m = np.median(strecke(p2, slice(0, 2))) / np.median(strecke(p3, slice(0, 3)))
    hm = (p2[:, P['hand_l'], :2] + p2[:, P['hand_r'], :2]) / 2
    v = np.r_[0, np.linalg.norm(np.diff(hm, axis=0), axis=1)] * fps_echt / px_je_m
    k = np.exp(-0.5 * np.arange(-3, 4) ** 2)
    k /= k.sum()
    return np.convolve(np.pad(v, 3, mode='edge'), k, mode='valid'), hm / px_je_m


# ── Phasen ──────────────────────────────────────────────────────────────────────────────────────────────────────────
def phasen(v, pos, fps_echt, min_abstand=0.5, schwelle=0.35, abwaerts=False):
    """Hiebe in der Geschwindigkeit der Handmitte `v` (m/s, Echtzeit) und ihrer Lage im Bild `pos` (Meter): Spitzen
    ≥ 50 % der grössten (mindestens `min_abstand` s auseinander). Je Spitze: **Durchzug** = letztes Bild danach mit
    ≥ 50 % (wie D428), **Scheitel** = das Bild in der Sekunde davor, in dem die Hände am weitesten vom Durchzug weg sind
    (Umkehrpunkt des Ausholens — geometrisch, weil das Tempo dort im Zittern untergeht), **Ausholbeginn** = langsamstes
    Bild vor dem schnellsten des Ausholens (bis 1,5 s vor dem Scheitel, nicht vor dem Halt des vorigen Hiebs),
    **Halt** = erstes Bild nach dem Durchzug unter 20 %."""
    n = len(v)
    vmax = float(np.percentile(v, 99))
    # Schwelle 35 % des 99. Perzentils: Die schnellste ist oft ein einzelnes Bild im Treffen (Bewegungsunschärfe).
    # `abwaerts`: nur Spitzen, in denen die Hände im Bild nach unten laufen (Hieb von oben — das Ausholen läuft hinauf).
    spitzen = [i for i in range(1, n - 1) if v[i] >= v[i - 1] and v[i] >= v[i + 1] and v[i] >= schwelle * vmax
               and (not abwaerts or pos[min(n - 1, i + 1), 1] - pos[max(0, i - 1), 1] > 0)]
    gewaehlt = []
    for i in sorted(spitzen, key=lambda i: -v[i]):
        if all(abs(i - j) > min_abstand * fps_echt for j in gewaehlt):
            gewaehlt.append(i)
    hiebe = []
    frei = 0
    for p in sorted(gewaehlt):
        if p <= frei:
            continue
        d = p
        while d + 1 < n and v[d + 1] >= 0.5 * v[p]:
            d += 1
        a = max(frei, p - int(1.0 * fps_echt))
        s = a + int(np.argmax(np.linalg.norm(pos[a:p + 1] - pos[d], axis=1)))
        a2 = max(frei, s - int(1.5 * fps_echt))
        h = a2 + int(np.argmax(v[a2:s + 1])) if s > a2 else s
        b = a2 + int(np.argmin(v[a2:h + 1])) if h > a2 else a2
        e = d
        while e + 1 < n and v[e] >= 0.2 * v[p]:
            e += 1
        hiebe.append(dict(ausholbeginn=b, ausholspitze=h, scheitel=s, schnellstes=p, durchzug=d, halt=e,
                          spitze_ms=round(float(v[p]), 2)))
        frei = e
    return hiebe


# ── Posenfelder ─────────────────────────────────────────────────────────────────────────────────────────────────────
def _n(x):
    l = np.linalg.norm(x)
    return x / l if l > 1e-9 else x


def gierwinkel(vec):
    """Drehung einer Linie links→rechts um die Hochachse: + = rechte Seite vor (wie `rumpf`/`huefte`)."""
    return math.degrees(math.atan2(vec[1], vec[0]))


def massstab(K, ruhe):
    R = K[ruhe].mean(axis=0)
    hh = ((R[P['huefte_l']] + R[P['huefte_r']]) / 2)[2]
    sh = ((R[P['schulter_l']] + R[P['schulter_r']]) / 2)[2]
    s_koerper = RIG['huefte_h'] / hh          # Beinlänge: Becken und Füsse; der Rumpf ist der der Wanderin
    arm = np.median([np.linalg.norm(K[:, P['schulter_' + s]] - K[:, P['ellbogen_' + s]], axis=1) +
                     np.linalg.norm(K[:, P['ellbogen_' + s]] - K[:, P['hand_' + s]], axis=1) for s in 'lr'])
    return s_koerper, RIG['arm'] / (arm * s_koerper), dict(huefte_h=round(float(hh), 3), schulter_h=round(float(sh), 3),
                                                            arm=round(float(arm), 3))


def pose_aus(k, waffe, s, s_arm, sicht=None):
    """Ein Bild (33 Punkte im Körperraum, Meter des Videos) → Posenfelder von `waffenclips.py` (Meter der Wanderin)."""
    K = k * s
    sch_r, sch_l = K[P['schulter_r']], K[P['schulter_l']]
    hue_m = (K[P['huefte_r']] + K[P['huefte_l']]) / 2
    dreh = gierwinkel(sch_r - sch_l)
    becken = gierwinkel(K[P['huefte_r']] - K[P['huefte_l']])
    wirbel = (sch_r + sch_l) / 2 - hue_m
    neig_abs = math.degrees(math.atan2(wirbel[1], wirbel[2]))
    koerper = (float(hue_m[1] - RIG['huefte_v']), float(hue_m[2] - RIG['huefte_h']))
    # Die Schultern der **Wanderin** in dieser Haltung (Rumpf 0,40 m, um `neig` vorgebeugt, um `dreh` gedreht, auf dem
    # verschobenen Becken) — der Rumpf des Videos ist anders lang (MediaPipe: Hüfte–Schulter 0,53 m gegen Bein 0,73 m).
    # Hände und Ellbogen hängen an diesen Schultern, mit dem Arm des Videos auf die Armlänge der Wanderin gebracht —
    # sonst lägen sie im tiefen Bücken bis 26 cm ausser Reichweite (gemessen am ersten Probeclip).
    rumpf = RIG['schulter_h'] - RIG['huefte_h']
    n_, d_ = math.radians(neig_abs), math.radians(dreh)
    becken_rig = np.array([0.0, RIG['huefte_v'] + koerper[0], RIG['huefte_h'] + koerper[1]])
    mitte_rig = becken_rig + rumpf * np.array([0.0, math.sin(n_), math.cos(n_)])
    quer = RIG['schulter_r'] * np.array([math.cos(d_), math.sin(d_), 0.0])
    rig_r, rig_l = mitte_rig + quer, mitte_rig - quer
    hand_r = rig_r + (K[P['hand_r']] - sch_r) * s_arm
    hand_l = rig_l + (K[P['hand_l']] - sch_l) * s_arm
    ell_r = rig_r + (K[P['ellbogen_r']] - sch_r) * s_arm
    ell_l = rig_l + (K[P['ellbogen_l']] - sch_l) * s_arm
    sch_m = mitte_rig
    d = hand_r - hand_l
    # Verdeckte Hand (Seitenansicht: die ferne Hand hinter dem Körper, MediaPipe rät sie): Sichtbarkeit < 0,3 zählt
    # nicht, ab 0,7 voll. Ohne sie gilt die Flucht Schulter → sichtbare Hand und der Griff der Hut.
    vis = 1.0 if sicht is None else min(1.0, max(0.0, (min(sicht[P['hand_l']], sicht[P['hand_r']]) - 0.3) / 0.4))
    hm = (hand_r + hand_l) / 2 if vis > 0.5 else hand_r
    flucht = _n(hm - sch_m)
    if waffe == 'axt':
        w = vis * min(1.0, max(0.0, (np.linalg.norm(d) - 0.06) / 0.12))
        richt = _n(w * _n(d) + (1 - w) * flucht)
        griff = -float(abs(d.dot(richt))) if vis > 0.5 else -0.42
        griff = min(GRIFF_GRENZEN[1], max(GRIFF_GRENZEN[0], griff))
    else:
        w = vis * min(1.0, max(0.0, (np.linalg.norm(d) - 0.04) / 0.06))
        richt = _n(w * _n(d) + (1 - w) * flucht)
        griff = None
    neig = neig_abs - RIG['neig0']
    mitte_s = (sch_r + sch_l) / 2

    def pol(sch, ell, hand):
        p = ell - (sch + hand) / 2
        return tuple(round(float(x), 2) for x in _n(p))

    f = dict(hand=tuple(round(float(x), 3) for x in hand_r), richt=tuple(round(float(x), 3) for x in richt),
             zwei=waffe, rumpf=(round(dreh, 1), round(neig, 1)), huefte=round(becken - 0.25 * dreh, 1),
             koerper=(round(koerper[0], 3), round(koerper[1], 3)),
             fuss_l=(round(float(K[P['knoechel_l']][1] - RIG['fuss_l'][1]), 3), round(float(K[P['knoechel_l']][0] - RIG['fuss_l'][0]), 3)),
             fuss_r=(round(float(K[P['knoechel_r']][1] - RIG['fuss_r'][1]), 3), round(float(K[P['knoechel_r']][0] - RIG['fuss_r'][0]), 3)),
             pol=pol(rig_r, ell_r, hand_r), pol_l=pol(rig_l, ell_l, hand_l))
    if griff is not None:
        f['griff'] = round(griff, 3)
    mess = dict(hand_l=hand_l, hand_r=hand_r, huefte=hue_m, schulter=mitte_s, becken=becken, dreh=dreh)
    return f, mess


def nachlauf(posen, hb, i0, i1):
    """Axt (`--regel`): Stiel und Griff nach dem Handbuch statt aus den Händen, deren ferne in der Seitenansicht meist
    verdeckt ist und deren Fingerpunkte bei 20 Bildpunkten Hand zu grob sind (gemessen D430: Knöchellinie bis 125°
    daneben). **Lage** der Hände bleibt aus dem Video, der **Winkel** des Stiels gegen die Armflucht (Schulter → Hand)
    folgt dem Schwung: in der Ruhe in der Flucht, bis zur Spitze des Ausholens auf 90° angewinkelt, der Kopf auf der
    Seite gegenüber dem Ziel (hinter dem Durchzug), gehalten bis zum Scheitel, im Schlag gelöst (quadratisch, spät) bis zur Flucht im
    Durchzug (die Hände führen, der Kopf läuft nach — wie das Handgelenk beim Peitschen), danach in der Flucht.
    `griff` nach D429: Hut −0,42, im Scheitel −0,62 (rechte Hand am Kopf), im Durchzug −0,11 (beide am Ende)."""
    hS = np.array(posen[hb['scheitel']][0]['hand'])
    hD = np.array(posen[hb['durchzug']][0]['hand'])
    ziel = _n(hD - hS)
    a, h, sc, d = hb['ausholbeginn'], hb['ausholspitze'], hb['scheitel'], hb['durchzug']
    for i in range(i0, i1 + 1):
        f = posen[i][0]
        f.setdefault('richt_video', f['richt'])
        f.setdefault('griff_video', f.get('griff'))
        if i <= h:
            t = (i - a) / max(1, h - a)
            c, g = 90 * t, -0.42 + (-0.62 + 0.42) * t
        elif i <= sc:
            c, g = 90, -0.62
        elif i <= d:
            t = (i - sc) / max(1, d - sc)
            c, g = 90 * (1 - t * t), -0.62 + 0.51 * t   # spät gelöst: erst die Hände, dann der Kopf
        else:
            c, g = 0, -0.11 if i <= hb['halt'] else -0.13
        hand = np.array(f['hand'])
        mitte = np.array([0.0, RIG['huefte_v'] + f['koerper'][0], RIG['schulter_h'] + f['koerper'][1]])
        flucht = _n(hand - mitte)
        w = -ziel - flucht * (-ziel).dot(flucht)
        w = _n(w) if np.linalg.norm(w) > 1e-3 else np.array([0.0, -1.0, 0.0])
        r = math.radians(c)
        f['richt'] = tuple(round(float(x), 3) for x in _n(math.cos(r) * flucht + math.sin(r) * w))
        f['griff'] = round(g, 3)


def rdp(punkte, eps):
    """Ramer–Douglas–Peucker über Zeit: Indizes, zwischen denen alle Punkte linear auf ≤ eps folgen."""
    def rek(a, b):
        if b <= a + 1:
            return []
        t = np.arange(a + 1, b)
        lin = punkte[a] + (punkte[b] - punkte[a]) * ((t - a) / (b - a))[:, None]
        fehler = np.linalg.norm(punkte[a + 1:b] - lin, axis=1)
        i = int(np.argmax(fehler))
        if fehler[i] <= eps:
            return []
        m = a + 1 + i
        return rek(a, m) + [m] + rek(m, b)
    return [0] + rek(0, len(punkte) - 1) + [len(punkte) - 1]


# ── Bilder ──────────────────────────────────────────────────────────────────────────────────────────────────────────
def zeichne_bild(bild, p2, mess_waffe, pfad, titel):
    import cv2
    b = bild.copy()
    for i, j in KNOCHEN:
        cv2.line(b, tuple(int(x) for x in p2[i, :2]), tuple(int(x) for x in p2[j, :2]), (40, 220, 255), 2, cv2.LINE_AA)
    for i in range(11, 33):
        cv2.circle(b, tuple(int(x) for x in p2[i, :2]), 3, (0, 80, 255), -1, cv2.LINE_AA)
    for k in ('hand_l', 'hand_r'):
        cv2.circle(b, tuple(int(x) for x in p2[P[k], :2]), 6, (255, 60, 60) if k == 'hand_r' else (60, 200, 60), 2, cv2.LINE_AA)
    h = 420
    b = cv2.resize(b, (max(1, int(b.shape[1] * h / b.shape[0])), h), interpolation=cv2.INTER_AREA)
    if b.shape[1] > 520:   # breite Ausschnitte mittig auf 520 kürzen
        x0 = (b.shape[1] - 520) // 2
        b = b[:, x0:x0 + 520]
    cv2.putText(b, titel, (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(b, titel, (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)
    cv2.imwrite(pfad, b)


def zeichne_skelett(k, f, waffe, pfad, titel, s):
    """3D-Schätzung von der rechten Seite der Person (vorn nach rechts, hoch nach oben), Wanderin-Meter; die Waffe nach
    Regel als Linie (Axt: Stielende bis Kopf, Kopf als Punkt; Messer: Knauf bis Spitze)."""
    import cv2
    B, H = 300, 420
    b = np.full((H, B, 3), 238, np.uint8)
    m = 165  # Bildpunkte je Meter
    def xy(p):
        return (int(B / 2 + p[1] * m), int(H - 28 - p[2] * m))
    cv2.line(b, (0, H - 28), (B, H - 28), (120, 120, 120), 1)
    K = k * s
    for i, j in KNOCHEN:
        nah = (K[i][0] + K[j][0]) > 0  # rechte Körperseite (zur Betrachterin) dunkler
        cv2.line(b, xy(K[i]), xy(K[j]), (30, 30, 30) if nah else (150, 150, 150), 2, cv2.LINE_AA)
    hand = np.array(f['hand'])
    richt = np.array(f['richt'])
    if waffe == 'axt':
        ende = hand + richt * f.get('griff', -0.42)
        kopf = hand + richt * (0.30 + 0.62 + f.get('griff', -0.42))
        cv2.line(b, xy(ende), xy(kopf), (30, 90, 160), 3, cv2.LINE_AA)
        cv2.circle(b, xy(kopf), 7, (40, 40, 40), -1, cv2.LINE_AA)
    else:
        cv2.line(b, xy(hand - richt * 0.27), xy(hand + richt * 0.90), (90, 90, 90), 3, cv2.LINE_AA)
    cv2.circle(b, xy(hand), 5, (60, 60, 255), -1, cv2.LINE_AA)
    cv2.putText(b, titel, (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)
    cv2.putText(b, '3D-Schaetzung, von rechts', (6, H - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (60, 60, 60), 1, cv2.LINE_AA)
    cv2.imwrite(pfad, b)


# ── Befehle ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def befehl_erkennen(a):
    ausschnitt = tuple(float(x) for x in a.ausschnitt.split(',')) if a.ausschnitt else (0, 0, 1, 1)
    bilder, zeiten, fps, groesse, box = lies_bilder(a.video, a.von, a.bis, ausschnitt)
    print(f'  {len(bilder)} Bilder, {fps:.2f} Bilder/s, {groesse[0]}×{groesse[1]}, Ausschnitt {box}')
    p2r, p3r = erkenne(bilder, fps, a.modell)
    p2, fehlend = fuelle(p2r)
    p3, _ = fuelle(p3r)
    print(f'  Person in {len(bilder) - fehlend} von {len(bilder)} Bildern erkannt')
    p3g = glaette(median3(p3))
    p2g = glaette(median3(p2))
    W, T = verschiebung(p3g, p2g)
    fps_echt = fps * a.zeitlupe
    # Ruhe: vor dem ersten Hieb — erst grob mit Kameraachsen, dann die Achsen aus diesen Bildern.
    v_bild, pos_bild = bildtempo(p2g, p3g, fps_echt)
    hiebe0 = phasen(v_bild, pos_bild, fps_echt, abwaerts=a.abwaerts)
    # Ruhe = die ersten Bilder vor dem ersten Ausholen; sind es weniger als 5, die 10 langsamsten Bilder.
    erst = hiebe0[0]['ausholbeginn'] if hiebe0 else 5
    ruhe = list(range(0, erst + 1)) if erst >= 4 else sorted(np.argsort(v_bild)[:10].tolist())
    M, ursprung, getauscht = achsen(W, ruhe, a.oben)
    if getauscht:
        W = tausche(W)
        p2g = tausche(p2g)
        M, ursprung, _ = achsen(W, ruhe, a.oben)
    K = koerperraum(W, M, ursprung, False)
    # Händigkeit (unsere Figur führt rechts): Axt — die Hand am Stielende ist im Scheitel die näher an der Hüfte;
    # Messer — die Hand am Gehilz ist in der Ruhe die obere.
    spiegeln = False
    if hiebe0:
        s0 = hiebe0[0]['scheitel']
        if a.waffe == 'axt':
            hue = (K[s0, P['huefte_l']] + K[s0, P['huefte_r']]) / 2
            spiegeln = np.linalg.norm(K[s0, P['hand_r']] - hue) < np.linalg.norm(K[s0, P['hand_l']] - hue)
        else:
            spiegeln = K[ruhe, P['hand_l'], 2].mean() > K[ruhe, P['hand_r'], 2].mean()
    if spiegeln:
        K = koerperraum(W, M, ursprung, True)
    s, s_arm, roh = massstab(K, ruhe)
    print(f'  Seiten vertauscht: {getauscht}, gespiegelt (Linkshänder): {spiegeln}, Maßstab Körper {s:.3f}, Arm ×{s_arm:.3f}')
    # Phasen aus dem Tempo der Handmitte **im Bild** (die 3D-Schätzung zittert in der Tiefe von Bild zu Bild, gemessen
    # unten), in Wanderin-Meter umgerechnet; das 3D-Tempo wird nur mitgeschrieben.
    v = v_bild * s
    hm = (K[:, P['hand_l']] + K[:, P['hand_r']]) / 2 * s
    v3 = np.r_[0, np.linalg.norm(np.diff(hm, axis=0), axis=1)] * fps_echt
    hiebe = phasen(v, pos_bild * s, fps_echt, abwaerts=a.abwaerts)
    if a.hiebe:
        hiebe = [hiebe[i - 1] for i in (int(x) for x in a.hiebe.split(','))]
    # Zittern: Rest roh − geglättet in der Ruhe (Hände, 3D; Hüfte im Bild)
    zitter3 = float(np.sqrt(np.nanmean((p3r[ruhe][:, [15, 16]] - p3g[ruhe][:, [15, 16]]) ** 2)) * s)
    zitter2 = float(np.sqrt(np.nanmean((p2r[ruhe][:, [15, 16], :2] - p2g[ruhe][:, [15, 16], :2]) ** 2)))
    # Tiefe: Länge des Unterarms in 3D über den Clip (ein starrer Knochen — schwankt sie, schwankt die Tiefe)
    unterarm = np.linalg.norm(p3g[:, 14] - p3g[:, 16], axis=1)
    # Tiefe gegen Bild: Höhe der Hände über den Knöcheln aus 2D (Bildpunkte je Meter wie `bildtempo`) gegen 3D. Bei
    # seitlicher Kamera liegt die Höhe ganz in der Bildebene — der Unterschied ist dann Fehler der 3D-Schätzung.
    def _strecke(arr, dims):
        o = (arr[:, P['schulter_l'], dims] + arr[:, P['schulter_r'], dims]) / 2
        u = (arr[:, P['knoechel_l'], dims] + arr[:, P['knoechel_r'], dims]) / 2
        return np.linalg.norm(o - u, axis=1)
    px_je_m = np.median(_strecke(p2g, slice(0, 2))) / np.median(_strecke(p3g, slice(0, 3)))
    anker = (p2g[:, P['knoechel_l'], 1] + p2g[:, P['knoechel_r'], 1]) / 2
    h2 = np.stack([(anker - p2g[:, P['hand_' + x], 1]) / px_je_m for x in 'lr'], axis=1)
    h3 = np.stack([K[:, P['hand_' + x], 2] for x in 'lr'], axis=1) if not spiegeln else \
        np.stack([K[:, P['hand_' + x], 2] for x in 'rl'], axis=1)
    hoehe_2d_3d = (h2 - h3) * s
    sicht = p2g[:, :, 2:3]
    sicht = (tausche(sicht) if spiegeln else sicht)[:, :, 0]
    verdeckt = float(np.mean(np.minimum(sicht[:, P['hand_l']], sicht[:, P['hand_r']]) < 0.5))
    posen = [pose_aus(K[i], a.waffe, s, s_arm, sicht[i]) for i in range(len(K))]
    # Schlüssel je Hieb: von Ausholbeginn bis eine halbe Sekunde nach dem Halt
    clips = []
    for nr, hb in enumerate(hiebe, 1):
        i0 = hb['ausholbeginn']
        i1 = min(len(K) - 1, hb['halt'] + int(0.5 * fps_echt))
        if a.waffe == 'axt' and a.regel:
            nachlauf(posen, hb, i0, i1)
        zug = np.array([np.r_[np.array(posen[i][0]['hand']), np.array(posen[i][0]['richt']) * 0.3,
                              np.array(posen[i][0]['koerper']) * 1.0] for i in range(i0, i1 + 1)])
        wahl = set(i0 + j for j in rdp(zug, a.eps))
        wahl |= {hb[k] for k in ('ausholbeginn', 'ausholspitze', 'scheitel', 'durchzug', 'halt') if i0 <= hb[k] <= i1}
        wahl = sorted(wahl)
        schluessel, bild_von = [], {}
        for i in wahl:
            bild = 1 + int(round((i - i0) / fps_echt * 24))
            if schluessel and schluessel[-1][0] == bild:
                bild_von[i] = bild
                continue
            schluessel.append([bild, posen[i][0]])
            bild_von[i] = bild
        S = bild_von.get(hb['scheitel'])
        D = bild_von.get(hb['durchzug'])
        if D == S:
            D = S + 1
        name = f"{'Axt' if a.waffe == 'axt' else 'Messer'}_Video_{a.name}_{nr}"
        mess = [p[1] for p in posen[i0:i1 + 1]]
        becken = [m['becken'] for m in mess]
        dreh = [m['dreh'] for m in mess]
        hue = np.array([m['huefte'] for m in mess])
        fuesse = K[i0:i1 + 1][:, [P['knoechel_l'], P['knoechel_r']]] * s
        sek = lambda x, y: round((y - x) / fps_echt, 3)
        clips.append(dict(
            name=name, grund='Idle', art='einmal', achse=a.waffe, treffer=[S, D],
            bilder_video=dict((k, int(hb[k] - i0)) for k in ('ausholbeginn', 'ausholspitze', 'scheitel', 'schnellstes', 'durchzug', 'halt')),
            zeiten_s=dict(ausholen=sek(i0, hb['scheitel']), schlag=sek(hb['scheitel'], hb['durchzug']),
                          nachschwung=sek(hb['durchzug'], hb['halt']), schnellstes_nach_scheitel=sek(hb['scheitel'], hb['schnellstes'])),
            bilder_24=dict(scheitel=S, durchzug=D, ende=schluessel[-1][0]),
            spitze_handmitte_ms=hb['spitze_ms'],
            becken_grad=[round(min(becken), 1), round(max(becken), 1)], schultern_grad=[round(min(dreh), 1), round(max(dreh), 1)],
            becken_vor_m=[round(float(hue[:, 1].min() - hue[0, 1]), 3), round(float(hue[:, 1].max() - hue[0, 1]), 3)],
            becken_tiefer_m=round(float(hue[0, 2] - hue[:, 2].min()), 3),
            fuesse_m=dict(abstand_quer=round(float(abs(fuesse[0, 1, 0] - fuesse[0, 0, 0])), 3),
                          versatz_vor=round(float(fuesse[0, 0, 1] - fuesse[0, 1, 1]), 3),
                          weg_links=round(float(np.linalg.norm(fuesse[-1, 0, :2] - fuesse[0, 0, :2])), 3),
                          weg_rechts=round(float(np.linalg.norm(fuesse[-1, 1, :2] - fuesse[0, 1, :2])), 3)),
            schluessel=schluessel, video_start=int(i0), video_index={str(b): int(i) for i, b in bild_von.items()}))
        print(f'  HIEB {nr}: Ausholen {sek(i0, hb["scheitel"])} s, Schlag {sek(hb["scheitel"], hb["durchzug"])} s, '
              f'Nachschwung {sek(hb["durchzug"], hb["halt"])} s, Spitze {hb["spitze_ms"]} m/s, {len(schluessel)} Schlüssel, '
              f'Scheitel/Durchzug Bild {S}/{D} (24/s)')
    os.makedirs(a.ausdir, exist_ok=True)
    meta = dict(video=os.path.basename(a.video), fps=fps, zeitlupe=a.zeitlupe, groesse=groesse, ausschnitt=box,
                bilder=len(bilder), erkannt=len(bilder) - fehlend, getauscht=bool(getauscht), gespiegelt=bool(spiegeln),
                massstab=round(s, 3), massstab_arm=round(s_arm, 3), roh=roh, oben=a.oben,
                zittern_ruhe_hand_3d_cm=round(zitter3 * 100, 2), zittern_ruhe_hand_2d_px=round(zitter2, 2),
                hand_hoehe_2d_minus_3d_cm=[round(float(np.percentile(hoehe_2d_3d, 5)) * 100, 1),
                                           round(float(np.percentile(hoehe_2d_3d, 95)) * 100, 1)],
                hand_verdeckt_anteil=round(verdeckt, 2),
                unterarm_3d_cm=[round(float(np.percentile(unterarm, 5)) * 100, 1), round(float(np.percentile(unterarm, 95)) * 100, 1)],
                hiebe=clips)
    with open(os.path.join(a.ausdir, a.name + '.json'), 'w') as f:
        json.dump(meta, f, indent=1, ensure_ascii=False)
    with open(os.path.join(a.ausdir, a.name + '_posen.json'), 'w') as f:
        json.dump(dict(zeiten=zeiten.round(4).tolist(), p2_roh=np.round(p2r, 2).tolist(), p3_roh=np.round(p3r, 4).tolist(),
                       p3_glatt=np.round(p3g, 4).tolist(), koerper=np.round(K, 4).tolist(), achsen=M.round(4).tolist(),
                       geschwindigkeit=np.round(v, 3).tolist(), geschwindigkeit_3d=np.round(v3, 3).tolist()), f)
    # Bilder je Hieb und Bild des Clips (24/s): auf Schlüsseln deren Videobild, dazwischen das nächstgelegene
    for nr, c in enumerate(clips, 1):
        for b in range(1, c['bilder_24']['ende'] + 1):
            i = c['video_index'].get(str(b), min(len(K) - 1, c['video_start'] + int(round((b - 1) / 24 * fps_echt))))
            pose = posen[i][0]
            zeichne_bild(bilder[i], p2g[i], None, os.path.join(a.ausdir, f'{a.name}_{nr}_bild_{b:02d}.png'),
                         f'Video {zeiten[i]:.2f} s')
            zeichne_skelett(K[i], pose, a.waffe, os.path.join(a.ausdir, f'{a.name}_{nr}_skelett_{b:02d}.png'),
                            f'Bild {b} (24/s)', s)
    print(f'  → {a.ausdir}/{a.name}.json')


def befehl_stapeln(a):
    """Je Bild eine Spalte, 300 Bildpunkte breit: oben das Videobild mit Skelett, darunter die 3D-Schätzung, unten unsere
    Figur (Render aus `kontaktbogen.py`, Auftrag-Name `--render-name`). `tools/kontaktbogen.mjs` legt die Spalten
    nebeneinander und beschriftet sie."""
    import cv2
    meta = json.load(open(os.path.join(a.ausdir, a.name + '.json')))
    nr = int(a.hiebe or 1)
    c = meta['hiebe'][nr - 1]
    spalten = []
    wahl = [int(x) for x in a.bilder.split(',')] if a.bilder else sorted(int(x) for x in c['video_index'])
    for b in wahl:
        teile = [cv2.imread(os.path.join(a.ausdir, f'{a.name}_{nr}_bild_{b:02d}.png')),
                 cv2.imread(os.path.join(a.ausdir, f'{a.name}_{nr}_skelett_{b:02d}.png'))]
        if a.renders:
            r = cv2.imread(os.path.join(a.renders, f'{a.render_name or a.name}_{b:02d}.png'))
            if r is not None:
                teile.append(r)
        bw = 300
        teile = [cv2.resize(t, (bw, int(t.shape[0] * bw / t.shape[1]))) for t in teile if t is not None]
        reihe = cv2.vconcat(teile)
        p = os.path.join(a.ausdir, f'{a.name}_{nr}_spalte_{b:02d}.png')
        cv2.imwrite(p, reihe)
        spalten.append(p)
    print('\n'.join(spalten))


def befehl_vergleich(a):
    """Bestandsclip aus `waffenclips.py` (ohne Blender gelesen) gegen den Videohieb: Zeiten, Füsse, Hüfte, Gewicht."""
    import types, importlib.util
    for m in ('bpy', 'mathutils'):
        mod = types.ModuleType(m)
        mod.Vector = mod.Matrix = object
        sys.modules.setdefault(m, mod)
    spec = importlib.util.spec_from_file_location('waffenclips', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'waffenclips.py'))
    wc = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(wc)
    meta = json.load(open(os.path.join(a.ausdir, a.name + '.json')))
    zeilen = []
    for clip in a.clip.split(','):
        grund, _, sch = wc.CLIPS[clip]
        S, D = wc.TREFFER.get(clip, (None, None))
        posen = [p if p != 'stand' else wc.CLIPS[grund][2][0][1] for _, p in sch]
        bilder = [b for b, _ in sch]
        hu = [p.get('huefte', 0) for p in posen]
        dr = [p.get('rumpf', (0, 0))[0] for p in posen]
        kv = [p.get('koerper', (0, 0))[0] for p in posen]
        kh = [p.get('koerper', (0, 0))[1] for p in posen]
        fl = [p.get('fuss_l', (0, 0)) for p in posen]
        fr = [p.get('fuss_r', (0, 0)) for p in posen]
        letzter = max(b for b, p in sch if p != 'stand') if any(p != 'stand' for _, p in sch) else bilder[-1]
        zeilen.append(dict(clip=clip, scheitel=S, durchzug=D, ende=bilder[-1], ausholen_bilder=(S - 1) if S else None,
                           schlag_bilder=(D - S) if S else None, nachschwung_bis=letzter,
                           huefte=[min(hu), max(hu)], schultern=[min(dr), max(dr)], koerper_vor=[min(kv), max(kv)],
                           tiefer=round(-min(kh), 3),
                           fuss_l_weg=round(max(math.dist(fl[0], x) for x in fl), 3), fuss_r_weg=round(max(math.dist(fr[0], x) for x in fr), 3)))
    for c in meta['hiebe']:
        s = c['schluessel']
        hu = [p['huefte'] for _, p in s]
        dr = [p['rumpf'][0] for _, p in s]
        kv = [p['koerper'][0] for _, p in s]
        kh = [p['koerper'][1] for _, p in s]
        zeilen.append(dict(clip=c['name'], scheitel=c['bilder_24']['scheitel'], durchzug=c['bilder_24']['durchzug'],
                           ende=c['bilder_24']['ende'], ausholen_bilder=c['bilder_24']['scheitel'] - 1,
                           schlag_bilder=c['bilder_24']['durchzug'] - c['bilder_24']['scheitel'],
                           nachschwung_s=c['zeiten_s']['nachschwung'], huefte=[min(hu), max(hu)], schultern=[min(dr), max(dr)],
                           koerper_vor=[round(min(kv), 3), round(max(kv), 3)], tiefer=round(kh[0] - min(kh), 3),
                           fuesse=c['fuesse_m'], becken_grad=c['becken_grad']))
    for z in zeilen:
        print('  VERGLEICH', json.dumps(z, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('befehl', choices=['erkennen', 'stapeln', 'vergleich'])
    ap.add_argument('pfade', nargs='+')
    ap.add_argument('--name', required=True)
    ap.add_argument('--waffe', default='axt', choices=['axt', 'messer'])
    ap.add_argument('--von', type=float, default=0)
    ap.add_argument('--bis', type=float, default=0)
    ap.add_argument('--ausschnitt', default='')
    ap.add_argument('--zeitlupe', type=float, default=1.0, help='so viel langsamer läuft das Video als die Wirklichkeit')
    ap.add_argument('--modell', default='.cache/venv-d430/modelle/pose_landmarker_heavy.task')
    ap.add_argument('--hiebe', default='')
    ap.add_argument('--eps', type=float, default=0.05, help='Schlüssel: Hand und Hüfte folgen linear auf ≤ eps Meter')
    ap.add_argument('--regel', action='store_true', help='Axt: Stielwinkel und Griff nach Handbuch (`nachlauf`)')
    ap.add_argument('--abwaerts', action='store_true', help='nur Hiebe von oben (Hände laufen im Bild nach unten)')
    ap.add_argument('--oben', default='kamera', choices=['kamera', 'koerper'])
    ap.add_argument('--renders', default='')
    ap.add_argument('--render-name', dest='render_name', default='')
    ap.add_argument('--clip', default='')
    ap.add_argument('--bilder', default='', help='stapeln: nur diese Schlüsselbilder (24/s)')
    a = ap.parse_args()
    if a.befehl == 'erkennen':
        a.video, a.ausdir = a.pfade[:2]
        befehl_erkennen(a)
    elif a.befehl == 'stapeln':
        a.ausdir = a.pfade[0]
        befehl_stapeln(a)
    else:
        a.ausdir = a.pfade[0]
        befehl_vergleich(a)


if __name__ == '__main__':
    main()
