"""
BRACHLAND — Zielbild für die Waffen (Design-Runde 1, Flo 23.11.2026), Blender-Render, nichts davon im Spiel.

    blender --background --factory-startup --python tools/waffenframe.py -- bild <aus.png> <ansicht> [b h spp]
    python3 tools/waffenframe.py blatt <bilderordner> <referenzordner>
    python3 tools/waffenframe.py blatt2 <ordner-r2> <ordner-r1> <referenzordner>

`ansicht`: `gesamt` oder eine Waffe (`hirschfaenger`, `klinge`, `messer`, `axt`, `speer`). `WAFFE_ROH=1` rendert die
Modelle, wie sie im Spiel sind (flach schattiert, eine Farbe je Teil) — das Vorher-Bild an derselben Kamera.

Was passiert:
- Die Modelle baut `tools/waffenmodelle.py` selbst (hier nur ausgeführt, **nicht geändert**): dieselben Netze, Maße,
  Massen und Griffpunkte wie in `public/figuren/kampf/waffen.glb`. Länge, Griff und Gewicht sind Spielwerte (D403,
  D421, D429) — dieses Werkzeug fasst die Form nicht an, es gibt ihr nur Oberfläche.
- Substanz (ADR-0018: real, Darstellung gemalt) als prozedurale Materialien in Objektkoordinaten, also ohne UV und
  ohne fremde Texturen: Stahl mit Schmiedehaut (Zunder) auf den Flächen, blankem Schliff an den Kanten, Schleifriefen
  längs und Flugrost in Kehlen; Holz mit Maserung längs der Waffenachse, Handglanz und Schmutz an den Griffstellen,
  Druckstellen; Leder als Wicklung mit Rillen; Messing mit Patina; Hirschhorn mit Längsrillen.
- Kanten: 0,4 mm Fase an allen Kanten über 46° (im Spiel flach schattiert), der Rest weich — Licht fängt sich an der
  Kante wie an einem echten Stück.
- Szene: Werkbank aus Bohlen, die Waffen liegen darauf (Auflage aus der unteren Hülle gerechnet: Kopf und Stielende
  tragen, D398), Himmel und Sonnenfarbe aus `hausframe.py` (nur importiert), Sonne als Streiflicht von links vorn.
- Ausgabe direkt als PNG mit AgX: Der Stil-Durchgang von `hausframe.stil` lässt die Nähe unberührt (Pinsel erst in
  der Ferne), eine Waffe auf der Werkbank ist nur Nähe.

Runde 2 (Flo 23.11.2026: „realer darstellen, so wie Stahl auch aussieht und Holz, und die Waffen individueller
gestalten, passend zum Setting“) ist die Vorgabe; `WAFFE_RUNDE=1` rendert Runde 1. Runde 2 baut je Waffe eine
**eigene Zielbild-Geometrie** mit denselben Hauptmaßen (Spitze, Ende, Klingenansatz werden an den Spielmodellen
gemessen und im Protokoll verglichen) — Axt mit Nacken, gewölbten Wangen, Bart, Stiel mit Schwung und Keil im Auge;
Saufeder mit Blatt, Grat, konischer Tülle und Knebel an der Tülle; Klinge mit Hohlkehle und Scheibenknauf;
Hirschfänger einschneidig mit Kehle und Muschel; Langes Messer mit Wehrnagel und sichtbarer Angel. Dazu Stahl als
Kohlenstoffstahl (graue Patina, Anlaufflecken, Hammerschläge unter Zunder, blanker Anschliff), Holz mit Jahrringen um
die Markröhre (Hirnholz am Ende zeigt Ringe) und je Waffe Spuren ihrer Herkunft (`HERKUNFT`, Vorschlag — nicht von
Flo bestätigt). Ansicht `<waffe>-griff` zeigt den Griff nah.
"""
import sys, os, math

try:
    import bpy
except ImportError:
    bpy = None

HIER = os.path.dirname(os.path.abspath(__file__))
WAFFEN = ('hirschfaenger', 'klinge', 'messer', 'axt', 'speer')
OBJEKT = {'hirschfaenger': 'Hirschfaenger', 'klinge': 'Klinge', 'messer': 'Messer', 'axt': 'Axt', 'speer': 'Speer'}
NAMEN = {'hirschfaenger': 'Hirschfänger', 'klinge': 'Klinge (Seitschwert)', 'messer': 'Langes Messer', 'axt': 'Fällaxt', 'speer': 'Saufeder'}
# Blick fürs Nahbild: Punkt auf der Waffenachse (Modell-z, Meter; Klinge liegt bei −z) — Übergang Griff/Klinge bzw. Kopf
NAH = {'hirschfaenger': -0.07, 'klinge': -0.08, 'messer': -0.10, 'axt': -0.27, 'speer': -1.50}
# Griffstellen auf der Achse (Modell-z): rechte Hand im Ursprung; Axt linke Hand 0,62 m dahinter (D429), Saufeder vorn
NAH_GRIFF = {'hirschfaenger': 0.0, 'klinge': 0.03, 'messer': 0.09, 'axt': 0.50, 'speer': -1.42}
GRIFFE = {'hirschfaenger': (0.0,), 'klinge': (0.0,), 'messer': (0.0, 0.14), 'axt': (0.0, 0.62), 'speer': (0.0, -0.55)}
TISCH = 0.90     # Höhe der Werkbank, Meter
ROH = os.environ.get('WAFFE_ROH') == '1'


# ───────────────────────────── Materialien ─────────────────────────────
def _nt(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    return m, nt, nt.nodes['Principled BSDF']


class N:
    """Kleiner Knotenhelfer: Zahlen und Sockel mischen, ohne jede Verbindung von Hand zu ziehen."""
    def __init__(s, nt): s.nt = nt

    def k(s, typ, **kw):
        n = s.nt.nodes.new(typ)
        for a, w in kw.items(): setattr(n, a, w)
        return n

    def setze(s, sockel, w):
        if hasattr(w, 'default_value') or hasattr(w, 'links'): s.nt.links.new(w, sockel)
        elif isinstance(w, (tuple, list)) and len(w) == 3 and len(sockel.default_value) == 4: sockel.default_value = (*w, 1)
        else: sockel.default_value = w

    def math(s, op, a, b=None, clamp=False):
        n = s.k('ShaderNodeMath', operation=op, use_clamp=clamp); s.setze(n.inputs[0], a)
        if b is not None: s.setze(n.inputs[1], b)
        return n.outputs[0]

    def mix(s, f, a, b):
        n = s.k('ShaderNodeMix', data_type='RGBA'); s.setze(n.inputs['Factor'], f); s.setze(n.inputs['A'], a); s.setze(n.inputs['B'], b)
        return n.outputs['Result']

    def mixf(s, f, a, b):
        n = s.k('ShaderNodeMix', data_type='FLOAT'); s.setze(n.inputs['Factor'], f); s.setze(n.inputs['A'], a); s.setze(n.inputs['B'], b)
        return n.outputs['Result']

    def bereich(s, x, a, b, c=0.0, d=1.0):
        n = s.k('ShaderNodeMapRange', clamp=True, interpolation_type='SMOOTHSTEP'); s.setze(n.inputs['Value'], x)
        n.inputs['From Min'].default_value = a; n.inputs['From Max'].default_value = b; n.inputs['To Min'].default_value = c; n.inputs['To Max'].default_value = d
        return n.outputs['Result']

    def ort(s, skala=(1, 1, 1)):
        tc = s.k('ShaderNodeTexCoord'); mp = s.k('ShaderNodeMapping'); mp.inputs['Scale'].default_value = skala
        s.nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); return mp.outputs['Vector']

    def rauschen(s, skala, groesse=1.0, detail=4.0, rau=0.55):
        n = s.k('ShaderNodeTexNoise'); s.nt.links.new(s.ort(skala), n.inputs['Vector'])
        n.inputs['Scale'].default_value = groesse; n.inputs['Detail'].default_value = detail; n.inputs['Roughness'].default_value = rau
        return n.outputs['Fac']

    def z(s):
        tc = s.k('ShaderNodeTexCoord'); x = s.k('ShaderNodeSeparateXYZ'); s.nt.links.new(tc.outputs['Object'], x.inputs[0]); return x.outputs['Z']

    def kante(s, a=0.52, b=0.62):
        """Konvexe Kante (Pointiness über 0,5) — dort ist ein Werkzeug blank gegriffen und geschliffen."""
        return s.bereich(s.k('ShaderNodeNewGeometry').outputs['Pointiness'], a, b)

    def kehle(s, a=0.40, b=0.49):
        return s.math('SUBTRACT', 1.0, s.bereich(s.k('ShaderNodeNewGeometry').outputs['Pointiness'], a, b))

    def relief(s, bsdf, hoehe, staerke, abstand=0.002):
        n = s.k('ShaderNodeBump'); n.inputs['Strength'].default_value = staerke; n.inputs['Distance'].default_value = abstand
        s.setze(n.inputs['Height'], hoehe); s.nt.links.new(n.outputs['Normal'], bsdf.inputs['Normal'])

    def griff(s, stellen, breite=0.085):
        """1 an den Griffstellen (Gauss um jede Stelle auf der Achse), 0 sonst."""
        z = s.z(); summe = None
        for g in stellen:
            d = s.math('DIVIDE', s.math('SUBTRACT', z, g), breite)
            e = s.math('EXPONENT', s.math('MULTIPLY', s.math('MULTIPLY', d, d), -1.0))
            summe = e if summe is None else s.math('MAXIMUM', summe, e)
        return summe


def mat_stahl(name, hell, haut, rost, glanz=0.30, blau=None, schneide=0.0):
    """Stahl: `haut` = Anteil Schmiedehaut (Zunder) auf den Flächen, `rost` = Flugrost in Kehlen, `blau` = Anlassfarbe."""
    m, nt, b = _nt(name); k = N(nt)
    riefen = k.rauschen((700, 700, 9), 1.0, 3.0, 0.6)                 # Schleifriefen längs der Achse
    wolke = k.rauschen((9, 9, 9), 1.0, 6.0, 0.62)                   # grosse Flecken: wo die Haut stehen blieb
    korn = k.rauschen((900, 900, 900), 1.0, 2.0, 0.5)
    kante = k.kante(); kehle = k.kehle()
    hautmaske = k.math('MULTIPLY', k.bereich(wolke, 0.42, 0.62), k.math('SUBTRACT', 1.0, kante), clamp=True)
    hautmaske = k.math('MULTIPLY', hautmaske, haut)
    rostmaske = k.math('MULTIPLY', k.math('MULTIPLY', k.math('MAXIMUM', kehle, k.bereich(wolke, 0.60, 0.74)), k.bereich(korn, 0.35, 0.65)), rost, clamp=True)
    grund = hell if blau is None else blau
    farbe = k.mix(hautmaske, grund, (0.035, 0.034, 0.036))            # Zunder: blauschwarz, matt
    farbe = k.mix(k.math('MULTIPLY', kante, 0.85), farbe, (0.78, 0.79, 0.80))   # Schliff: blank
    schliff = 0.0
    if schneide:
        # Schneide: wo das Blatt dünn wird (|y| unter `schneide` m — die Klingen liegen symmetrisch um y = 0), ist es
        # geschliffen: blank, quer zur Schneide gerieft, mit einzelnen Scharten und Anlaufflecken
        tc = k.k('ShaderNodeTexCoord'); xyz = k.k('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], xyz.inputs[0])
        duenn = k.math('SUBTRACT', 1.0, k.bereich(k.math('ABSOLUTE', xyz.outputs['Y']), 0.0004, schneide))
        scharte = k.bereich(k.rauschen((60, 60, 420), 1.0, 2.0, 0.5), 0.66, 0.74)
        schliff = k.math('MULTIPLY', duenn, k.math('SUBTRACT', 1.0, k.math('MULTIPLY', scharte, 0.8)))
        farbe = k.mix(schliff, farbe, (0.86, 0.87, 0.88)); hautmaske = k.math('MULTIPLY', hautmaske, k.math('SUBTRACT', 1.0, duenn))
    farbe = k.mix(rostmaske, farbe, (0.20, 0.075, 0.025))
    k.setze(b.inputs['Base Color'], farbe)
    k.setze(b.inputs['Metallic'], k.math('SUBTRACT', 1.0, k.math('MULTIPLY', rostmaske, 0.85)))
    rau = k.math('ADD', glanz, k.math('MULTIPLY', k.bereich(riefen, 0.3, 0.7), 0.30))
    rau = k.mixf(hautmaske, rau, 0.62); rau = k.mixf(k.math('MULTIPLY', kante, 0.8), rau, 0.16); rau = k.mixf(rostmaske, rau, 0.85)
    if schneide: rau = k.mixf(schliff, rau, 0.14)
    k.setze(b.inputs['Roughness'], rau)
    hoehe = k.math('ADD', k.math('MULTIPLY', riefen, 0.25), k.math('ADD', k.math('MULTIPLY', hautmaske, k.math('MULTIPLY', korn, 0.9)), k.math('MULTIPLY', rostmaske, korn)))
    k.relief(b, hoehe, 0.35, 0.0006)
    return m


def mat_messing(name):
    m, nt, b = _nt(name); k = N(nt)
    wolke = k.rauschen((60, 60, 60), 1.0, 4.0, 0.6); kante = k.kante(); kehle = k.kehle()
    patina = k.math('MULTIPLY', k.math('MAXIMUM', kehle, k.bereich(wolke, 0.55, 0.75)), 0.8, clamp=True)
    farbe = k.mix(patina, (0.72, 0.50, 0.17), (0.10, 0.075, 0.035)); farbe = k.mix(k.math('MULTIPLY', kante, 0.7), farbe, (0.90, 0.72, 0.36))
    k.setze(b.inputs['Base Color'], farbe); b.inputs['Metallic'].default_value = 1.0
    k.setze(b.inputs['Roughness'], k.mixf(patina, 0.26, 0.65)); k.relief(b, wolke, 0.12, 0.0004)
    return m


def mat_holz(name, hell, dunkel, stellen, oel=0.0, alt=0.0, lang=1.0):
    """Holz mit Maserung längs der Achse (z). `stellen`: Griffstellen — dort dunkel vom Handschweiss und glänzend."""
    m, nt, b = _nt(name); k = N(nt)
    faser = k.rauschen((48, 48, 1.3 * lang), 1.0, 7.0, 0.66)          # Fasern: quer fein, längs lang gezogen
    ringe = k.rauschen((16, 16, 0.5 * lang), 1.0, 2.0, 0.5)                  # Jahrringe als breite Bänder
    band = k.math('FRACT', k.math('MULTIPLY', ringe, 9.0))
    poren = k.rauschen((600, 600, 14), 1.0, 2.0, 0.5)                 # ringporig (Esche, Hickory): dunkle Porenstriche
    f = k.math('ADD', k.math('MULTIPLY', k.bereich(band, 0.05, 0.75), 0.55), k.math('MULTIPLY', faser, 0.45))
    farbe = k.mix(k.bereich(f, 0.32, 0.68), dunkel, hell)
    farbe = k.mix(k.math('MULTIPLY', k.bereich(poren, 0.60, 0.72), 0.45), farbe, tuple(c * 0.45 for c in dunkel))
    hand = k.griff(stellen)
    farbe = k.mix(k.math('MULTIPLY', hand, 0.55), farbe, tuple(c * 0.55 for c in dunkel))     # Griffstelle: dunkel gegriffen
    dellen = k.k('ShaderNodeTexVoronoi', feature='F1'); nt.links.new(k.ort((38, 38, 38)), dellen.inputs['Vector'])
    delle = k.math('SUBTRACT', 1.0, k.bereich(dellen.outputs['Distance'], 0.0, 0.10))        # vereinzelte Druckstellen
    delle = k.math('MULTIPLY', delle, k.bereich(k.rauschen((9, 9, 9)), 0.55, 0.70))
    farbe = k.mix(k.math('MULTIPLY', delle, 0.5), farbe, tuple(c * 0.4 for c in dunkel))
    if alt: farbe = k.mix(alt * 0.35, farbe, (0.10, 0.095, 0.085))                             # vergraut (Werkbank)
    k.setze(b.inputs['Base Color'], farbe)
    rau = k.mixf(hand, 0.62 - 0.22 * oel, 0.30); k.setze(b.inputs['Roughness'], k.math('ADD', rau, k.math('MULTIPLY', faser, 0.10)))
    hoehe = k.math('SUBTRACT', k.math('ADD', k.math('MULTIPLY', faser, 0.5), k.math('MULTIPLY', k.bereich(poren, 0.60, 0.72), -0.6)), k.math('MULTIPLY', delle, 1.5))
    k.relief(b, hoehe, 0.30 + 0.5 * alt, 0.0008 + 0.002 * alt)
    return m


def mat_leder(name, farbe, neu=False):
    """Lederwicklung: Rillen quer zur Achse (ein Riemen, Windung an Windung), Poren, an den Graten abgegriffen."""
    m, nt, b = _nt(name); k = N(nt)
    z = k.z(); windung = k.math('FRACT', k.math('MULTIPLY', z, 1.0 / 0.006))                 # 6 mm je Windung
    rille = k.math('SUBTRACT', 1.0, k.bereich(k.math('ABSOLUTE', k.math('SUBTRACT', windung, 0.5)), 0.30, 0.50))
    poren = k.rauschen((1400, 1400, 1400), 1.0, 2.0, 0.5); fleck = k.rauschen((40, 40, 40), 1.0, 4.0, 0.6)
    grat = k.math('MULTIPLY', rille, k.bereich(fleck, 0.35, 0.65))
    c = k.mix(k.math('MULTIPLY', grat, 0.0 if neu else 0.55), farbe, tuple(min(1.0, x * 2.6) for x in farbe))   # abgegriffen: heller
    c = k.mix(k.math('MULTIPLY', k.math('SUBTRACT', 1.0, rille), 0.7), c, tuple(x * 0.35 for x in farbe))       # Rille: Schmutz
    k.setze(b.inputs['Base Color'], c)
    k.setze(b.inputs['Roughness'], k.mixf(grat, 0.62, 0.36 if not neu else 0.5))
    k.relief(b, k.math('ADD', k.math('MULTIPLY', rille, 1.0), k.math('MULTIPLY', poren, 0.12)), 0.6, 0.0012)
    return m


def mat_horn(name, hell, dunkel, rillen=1.0, glanz=0.45):
    """Hirschhorn (Griff) und Horn (Knebel): Längsrillen mit dunklem Grund, die Rücken hell und glatt gegriffen."""
    m, nt, b = _nt(name); k = N(nt)
    rille = k.rauschen((170, 170, 7), 1.0, 4.0, 0.65); perlen = k.rauschen((260, 260, 260), 1.0, 2.0, 0.5)
    tief = k.math('SUBTRACT', 1.0, k.bereich(rille, 0.38, 0.62))
    c = k.mix(k.math('MULTIPLY', tief, rillen), hell, dunkel); c = k.mix(k.math('MULTIPLY', k.kante(), 0.5), c, tuple(min(1.0, x * 1.25) for x in hell))
    k.setze(b.inputs['Base Color'], c); k.setze(b.inputs['Roughness'], k.mixf(tief, glanz - 0.1, 0.7))
    try: b.inputs['Subsurface Weight'].default_value = 0.08; b.inputs['Subsurface Radius'].default_value = (0.004, 0.002, 0.001)
    except Exception as e: print('Streuung', e)
    k.relief(b, k.math('ADD', k.math('MULTIPLY', tief, -1.0 * rillen), k.math('MULTIPLY', perlen, 0.2)), 0.5, 0.0015)
    return m


def material(waffe, alt):
    """Zielmaterial für ein Material aus `waffenmodelle.py` (nach Name), mit den Griffstellen der Waffe."""
    n = alt.name; g = GRIFFE[waffe]; name = '%s_%s' % (waffe, n)
    if n == 'Steel': return mat_stahl(name, (0.56, 0.57, 0.59), 0.8 if waffe in ('axt', 'speer') else 0.25, 0.5, schneide={'axt': 0.0065, 'speer': 0.0028}.get(waffe, 0.0019))
    if n == 'DarkSteel': return mat_stahl(name, (0.30, 0.30, 0.31), 0.85, 0.75, glanz=0.42)
    if n in ('Blank', 'Schneide'): return mat_stahl(name, (0.62, 0.63, 0.65), 0.05, 0.1, glanz=0.20, schneide=0.0019)
    if n == 'Geblaeut': return mat_stahl(name, (0.30, 0.30, 0.31), 0.2, 0.2, blau=(0.05, 0.07, 0.16))
    if n == 'Blech': return mat_stahl(name, (0.50, 0.50, 0.50), 0.2, 0.6)
    if n == 'Messing': return mat_messing(name)
    if n in ('Hickory', 'HickoryGeoelt'): return mat_holz(name, (0.44, 0.31, 0.18), (0.17, 0.10, 0.05), g, oel=float(n.endswith('Geoelt')))
    if n in ('Esche', 'EscheGeoelt', 'LightWood'): return mat_holz(name, (0.47, 0.38, 0.25), (0.19, 0.135, 0.075), g, oel=float(n.endswith('Geoelt')))
    if n == 'DarkWood': return mat_holz(name, (0.24, 0.12, 0.055), (0.085, 0.04, 0.02), g, oel=0.6)      # Buche, geölt und gegriffen
    if n in ('Leder', 'LederNeu'): return mat_leder(name, (0.085, 0.042, 0.02), neu=n == 'LederNeu')
    if n == 'Hirschhorn': return mat_horn(name, (0.62, 0.52, 0.36), (0.10, 0.06, 0.03))
    if n == 'Horn': return mat_horn(name, (0.20, 0.15, 0.10), (0.03, 0.022, 0.016), rillen=0.6, glanz=0.32)
    print('WAFFENFRAME unbekanntes Material', n); return alt



# ───────────────────────────── Runde 2: eigene Geometrie, Stahl und Holz, Herkunft ─────────────────────────────
RUNDE = int(os.environ.get('WAFFE_RUNDE', '2'))
# Herkunft je Waffe — Vorschlag aus Baukasten §„Aus der Welt: Forst, Jagd, Steinbruch, Hof, Werk“ und der
# Materialliste (Federstahl = Blattfedern und Sägeblätter der Betriebe); von Flo nicht bestätigt.
HERKUNFT = {
    'axt': 'Forstaxt aus dem Altbestand: alter Kopf, in Brannburg neu eingestielt (Esche, frischer Keil), Draht gegen Fehlschläge.',
    'messer': 'Von der Schmiedin aus einer Blattfeder geschmiedet: Federbohrung blieb stehen, Schmiedehaut am Rücken, Buchenschalen, ein Niet ersetzt.',
    'speer': 'Saufeder vom Försterhof: Jagdwaffe mit Hornknebel am Riemen, Brandzeichen im Eschenschaft, viel getragen.',
    'hirschfaenger': 'Erbstück eines Jägers: Messing blank gegriffen, Horngriff poliert, Klinge oft nachgeschliffen und gepflegt.',
    'klinge': 'Fundstück aus einem Spind: lange gelegen (Rostnarben), in der Enklave nachgeschliffen und neu mit Leder gewickelt.',
}
K_PROFIL = 12


def _theta(i, n): return math.pi * (1 - (i + 0.5) / n)


def profil_klinge(b, d, art='zwei', kehle=0.0, rs=0.0, n=K_PROFIL):
    """Klingenquerschnitt als 2n Punkte (oben von −x nach +x, unten zurück). `zwei`: linsenförmig mit Hohlkehle in der
    Mitte; `ein`: Schneide bei −x, Rücken bei +x mit voller Stärke, Kehle unter dem Rücken, `rs` = Rückenschliff."""
    oben = []
    for i in range(n):
        s = math.cos(_theta(i, n)); x = s * b / 2
        if art == 'zwei':
            t = d / 2 * (1 - abs(s) ** 1.7) - kehle * d / 2 * math.exp(-(s / 0.26) ** 2)
        else:
            u = (s + 1) / 2
            t = d / 2 * min(1.0, u / 0.62) ** 0.92 - kehle * d / 2 * math.exp(-((u - 0.80) / 0.09) ** 2)
            if rs: t *= 1 - rs * max(0.0, (u - 0.55) / 0.45) ** 1.5 * 0.93
        oben.append((x, max(t, 0.00012)))
    return oben + [(x, -t) for x, t in reversed(oben)]


def profil_ellipse(rx, ry, n=K_PROFIL, dx=0.0, dy=0.0, e=2.0):
    """Ellipse (oder Superellipse mit Exponent `e`) in derselben Punktfolge wie `profil_klinge` — damit lässt sich
    ein Blatt in eine Tülle überblenden."""
    pkt = []
    for k in range(2 * n):
        th = _theta(k, n) if k < n else -_theta(2 * n - 1 - k, n)
        c, si = math.cos(th), math.sin(th)
        pkt.append((dx + rx * math.copysign(abs(c) ** (2 / e), c), dy + ry * math.copysign(abs(si) ** (2 / e), si)))
    return pkt


def blende(p, q, w): return [(a[0] * (1 - w) + b[0] * w, a[1] * (1 - w) + b[1] * w) for a, b in zip(p, q)]


class Bau:
    """Ein Netz je Waffe, Teile mit eigenem Material (Flächenindex)."""
    def __init__(s, name):
        import bmesh
        s.name = name; s.bm = bmesh.new(); s.mats = []

    def mat(s, m):
        if m not in s.mats: s.mats.append(m)
        return s.mats.index(m)

    def haut(s, ringe, m, zu=(True, True), abb=None):
        """Ringe aus 3D-Punkten (gleiche Anzahl) zu einer Haut; `abb` bildet (x, y, z) vorher ab."""
        idx = s.mat(m); vr = []
        for r in ringe:
            vr.append([s.bm.verts.new(abb(q) if abb else q) for q in r])
        n = len(vr[0])
        for a, b in zip(vr, vr[1:]):
            for i in range(n):
                f = s.bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])); f.material_index = idx; f.smooth = True
        for ende, r in ((zu[0], vr[0]), (zu[1], vr[-1])):
            if ende:
                try: f = s.bm.faces.new(r); f.material_index = idx
                except ValueError: pass

    def stab(s, schnitte, m, zu=(True, True), abb=None):
        """Schnitte (z, [(x, y)…]) entlang z."""
        s.haut([[(x, y, z) for x, y in p] for z, p in schnitte], m, zu, abb)

    def fertig(s):
        import bmesh
        bmesh.ops.recalc_face_normals(s.bm, faces=s.bm.faces)
        me = bpy.data.meshes.new(s.name); s.bm.to_mesh(me); s.bm.free()
        for m in s.mats: me.materials.append(m)
        o = bpy.data.objects.new(s.name, me); bpy.context.scene.collection.objects.link(o)
        return o


def _glatt(punkte, n):
    """Stützstellen (t, wert…) mit Catmull-Rom auf n Schritte verfeinern — weiche Konturen statt Knicken."""
    aus = []
    P = [punkte[0]] + list(punkte) + [punkte[-1]]
    for i in range(1, len(P) - 2):
        for k in range(n):
            u = k / n; u2, u3 = u * u, u * u * u
            aus.append(tuple(0.5 * ((2 * P[i][j]) + (-P[i - 1][j] + P[i + 1][j]) * u + (2 * P[i - 1][j] - 5 * P[i][j] + 4 * P[i + 1][j] - P[i + 2][j]) * u2
                                    + (-P[i - 1][j] + 3 * P[i][j] - 3 * P[i + 1][j] + P[i + 2][j]) * u3) for j in range(len(P[i]))))
    aus.append(tuple(punkte[-1])); return aus


# ---- Stahl und Holz, Runde 2
def mat_stahl2(name, art='klinge', hell=(0.47, 0.48, 0.50), schneide=0.0, fase_x=None, ansatz=None, narben=0.0, rost=0.5, haut_x=None, blau=None):
    """Kohlenstoffstahl. `klinge`: geschliffen, graue Patina mit Anlaufflecken, Riefen längs, blanke Schneidenfase
    (`schneide` = halbe Blattstärke, unter der geschliffen ist), Rost am Ansatz (`ansatz` = z) und in Kehlen, `narben` =
    Rostnarben eines Fundstücks, `haut_x` = (x0, x1): dort bleibt Schmiedehaut stehen (Rücken). `schmiede`:
    Hammerschläge unter blauschwarzem Zunder, an Kanten und Graten braun-grau gegriffen, `fase_x` = (x0, x1) blanker
    Anschliff (Axt)."""
    m, nt, b = _nt(name); k = N(nt)
    tc = k.k('ShaderNodeTexCoord'); xyz = k.k('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], xyz.inputs[0])
    wolke = k.rauschen((7, 7, 5), 1.0, 5.0, 0.6); fleck = k.rauschen((38, 38, 24), 1.0, 4.0, 0.62); korn = k.rauschen((1100, 1100, 1100), 1.0, 2.0, 0.5)
    riefen = k.rauschen((1400, 1400, 6), 1.0, 3.0, 0.65); finger = k.bereich(k.rauschen((22, 22, 22), 1.0, 2.0, 0.5), 0.52, 0.60)
    kante = k.kante(); kehle = k.kehle()
    schlag = k.k('ShaderNodeTexVoronoi', feature='SMOOTH_F1'); nt.links.new(k.ort((30, 30, 30)), schlag.inputs['Vector'])   # Hammerbahn ~3 cm
    try: schlag.inputs['Smoothness'].default_value = 1.0
    except Exception: pass
    delle = k.bereich(schlag.outputs['Distance'], 0.0, 0.55)                       # 0 in der Delle, 1 am Grat
    if art == 'schmiede':
        # Zunder platzt in Schollen ab: wo er fehlt, liegt braungrauer, gegriffener Stahl; in den Dellen hält er sich
        scholle = k.math('ADD', k.math('MULTIPLY', wolke, 0.55), k.math('ADD', k.math('MULTIPLY', fleck, 0.45), k.math('MULTIPLY', k.math('SUBTRACT', 1.0, delle), 0.18)))
        zunder = k.math('MULTIPLY', k.math('SUBTRACT', 1.0, k.math('MULTIPLY', kante, 0.95)), k.bereich(scholle, 0.44, 0.54), clamp=True)
        blank_ = k.mix(k.bereich(fleck, 0.3, 0.7), (0.27, 0.25, 0.23), (0.17, 0.15, 0.135))                   # gegriffener Stahl, fleckig
        farbe = k.mix(zunder, blank_, k.mix(k.bereich(wolke, 0.3, 0.7), (0.040, 0.042, 0.050), (0.060, 0.048, 0.040)))   # Zunder blauschwarz bis braunschwarz
        farbe = k.mix(k.math('MULTIPLY', kante, 0.75), farbe, (0.50, 0.50, 0.51))
        rau = k.math('ADD', k.mixf(zunder, 0.36, 0.60), k.math('MULTIPLY', finger, 0.08)); metall = k.mixf(zunder, 1.0, 0.6)
        hoehe = k.math('ADD', k.math('MULTIPLY', delle, 1.0), k.math('ADD', k.math('MULTIPLY', zunder, 0.35), k.math('MULTIPLY', korn, 0.05))); staerke, abstand = 0.30, 0.0011
    else:
        zunder = 0.0
        farbe = k.mix(k.bereich(wolke, 0.34, 0.70), hell if blau is None else blau, (0.25, 0.245, 0.245))   # graue Patina in Wolken
        farbe = k.mix(k.math('MULTIPLY', k.bereich(fleck, 0.60, 0.76), 0.55), farbe, (0.17, 0.125, 0.095))   # Anlaufflecken, braun
        farbe = k.mix(k.math('MULTIPLY', k.math('SUBTRACT', 1.0, k.bereich(fleck, 0.20, 0.34)), 0.35), farbe, (0.20, 0.23, 0.30))     # bläulich angelaufen
        rau = k.math('ADD', 0.24, k.math('ADD', k.math('MULTIPLY', k.bereich(riefen, 0.3, 0.7), 0.16), k.math('ADD', k.math('MULTIPLY', wolke, 0.16), k.math('MULTIPLY', finger, 0.10))))
        metall = 1.0
        hoehe = k.math('MULTIPLY', riefen, 0.30); staerke, abstand = 0.22, 0.0004
        try: b.inputs['Anisotropic'].default_value = 0.55; tg = k.k('ShaderNodeTangent', direction_type='RADIAL', axis='Z'); nt.links.new(tg.outputs[0], b.inputs['Tangent'])
        except Exception as e: print('Anisotropie', e)
        if haut_x:   # Schmiedehaut am Rücken (Blattfeder): dunkel, matt, mit Hammerschlägen
            zunder = k.math('MULTIPLY', k.bereich(k.math('ADD', xyz.outputs['X'], k.math('MULTIPLY', k.math('SUBTRACT', wolke, 0.5), 0.012)), haut_x[0], haut_x[1]), 0.92)
            farbe = k.mix(zunder, farbe, (0.034, 0.035, 0.040)); rau = k.mixf(zunder, rau, 0.66)
            hoehe = k.math('ADD', hoehe, k.math('MULTIPLY', zunder, k.math('MULTIPLY', delle, 3.0)))
    blank = None
    if schneide:
        duenn = k.math('SUBTRACT', 1.0, k.bereich(k.math('ABSOLUTE', xyz.outputs['Y']), schneide * 0.25, schneide))
        scharte = k.bereich(k.rauschen((70, 70, 480), 1.0, 2.0, 0.5), 0.67, 0.74)
        blank = k.math('MULTIPLY', duenn, k.math('SUBTRACT', 1.0, k.math('MULTIPLY', scharte, 0.85)))
    if fase_x:
        f = k.math('SUBTRACT', 1.0, k.bereich(k.math('ADD', xyz.outputs['X'], k.math('MULTIPLY', k.math('SUBTRACT', fleck, 0.5), 0.006)), fase_x[0], fase_x[1]))
        # Anschliffzone: Zunder ist weggeschliffen, die Fläche grau angelaufen — blank bleibt nur die Schneide selbst
        zone = k.mix(k.bereich(wolke, 0.3, 0.7), (0.36, 0.36, 0.37), (0.24, 0.235, 0.23))
        farbe = k.mix(f, farbe, zone); rau = k.mixf(f, rau, k.math('ADD', 0.26, k.math('MULTIPLY', k.rauschen((9, 1500, 1500), 1.0, 2.0, 0.6), 0.18))); metall = k.mixf(f, metall, 1.0)
        hoehe = k.mixf(f, hoehe, 0.0)
    if blank is not None:
        quer = k.rauschen((9, 1500, 1500), 1.0, 2.0, 0.6)                           # Schleifstein: Riefen quer zur Schneide
        farbe = k.mix(blank, farbe, k.mix(k.bereich(quer, 0.3, 0.7), (0.62, 0.63, 0.65), (0.80, 0.81, 0.83)))
        rau = k.mixf(blank, rau, k.math('ADD', 0.13, k.math('MULTIPLY', quer, 0.14))); metall = k.mixf(blank, metall, 1.0)
        hoehe = k.mixf(blank, hoehe, k.math('MULTIPLY', quer, 0.3))
    rostmaske = k.math('MULTIPLY', k.math('MAXIMUM', kehle, k.bereich(fleck, 0.66, 0.80)), k.bereich(korn, 0.3, 0.7))
    if ansatz is not None:   # am Übergang zum Griff sammelt sich Feuchte
        nah = k.math('SUBTRACT', 1.0, k.bereich(k.math('ABSOLUTE', k.math('SUBTRACT', xyz.outputs['Z'], ansatz)), 0.004, 0.035))
        rostmaske = k.math('MAXIMUM', rostmaske, k.math('MULTIPLY', nah, k.bereich(fleck, 0.38, 0.62)))
    rostmaske = k.math('MULTIPLY', rostmaske, rost, clamp=True)
    if blank is not None: rostmaske = k.math('MULTIPLY', rostmaske, k.math('SUBTRACT', 1.0, k.math('MULTIPLY', blank, 0.9)))
    farbe = k.mix(rostmaske, farbe, k.mix(korn, (0.23, 0.085, 0.03), (0.11, 0.045, 0.02)))
    if narben:
        nb = k.k('ShaderNodeTexVoronoi', feature='F1'); nt.links.new(k.ort((420, 420, 420)), nb.inputs['Vector'])
        narbe = k.math('MULTIPLY', k.math('SUBTRACT', 1.0, k.bereich(nb.outputs['Distance'], 0.10, 0.30)), k.math('MULTIPLY', k.bereich(fleck, 0.42, 0.60), narben), clamp=True)
        if blank is not None: narbe = k.math('MULTIPLY', narbe, k.math('SUBTRACT', 1.0, k.math('MULTIPLY', blank, 0.6)))
        farbe = k.mix(narbe, farbe, (0.055, 0.04, 0.03)); rau = k.mixf(narbe, rau, 0.8); hoehe = k.math('SUBTRACT', hoehe, k.math('MULTIPLY', narbe, 4.0))
    k.setze(b.inputs['Base Color'], farbe)
    k.setze(b.inputs['Metallic'], k.math('MULTIPLY', metall, k.math('SUBTRACT', 1.0, k.math('MULTIPLY', rostmaske, 0.9))))
    k.setze(b.inputs['Roughness'], k.mixf(rostmaske, rau, 0.88))
    k.relief(b, k.math('ADD', hoehe, k.math('MULTIPLY', rostmaske, korn)), staerke, abstand)
    return m


def mat_holz2(name, hell, dunkel, stellen, mark=(0.004, 0.011), ringbreite=0.0021, oel=0.3, brand=(), risse_z=None, frisch=0.0):
    """Ringporiges Holz (Esche, Hickory) mit Jahrringen als Zylinder um die Markröhre `mark` (x, y) neben der Achse —
    der Stiel ist aus dem Stamm gespalten, also laufen die Ringe als Bänder längs und zeigen sich am Hirnholz als
    Bögen. Frühholz = dunkle Porenzeile, Spätholz dicht und hell. `brand` = z-Stellen mit eingebranntem Zeichen,
    `risse_z` = (z0, z1) Trockenrisse (am Auge), `frisch` = neues Holz (hell, matt, ohne Handglanz)."""
    m, nt, b = _nt(name); k = N(nt)
    tc = k.k('ShaderNodeTexCoord'); xyz = k.k('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], xyz.inputs[0])
    welle = k.rauschen((14, 14, 1.6), 1.0, 3.0, 0.5)
    dx = k.math('SUBTRACT', xyz.outputs['X'], mark[0]); dy = k.math('SUBTRACT', xyz.outputs['Y'], mark[1])
    r = k.math('SQRT', k.math('ADD', k.math('MULTIPLY', dx, dx), k.math('MULTIPLY', dy, dy)))
    r = k.math('ADD', r, k.math('ADD', k.math('MULTIPLY', k.math('SUBTRACT', welle, 0.5), 0.006), k.math('MULTIPLY', xyz.outputs['Z'], 0.004)))
    band = k.math('FRACT', k.math('MULTIPLY', r, 1.0 / ringbreite))
    frueh = k.math('SUBTRACT', 1.0, k.bereich(band, 0.10, 0.30))                    # Frühholzzone am Ringanfang
    faser = k.rauschen((900, 900, 9), 1.0, 4.0, 0.62); pore = k.bereich(k.rauschen((2600, 2600, 26), 1.0, 2.0, 0.5), 0.50, 0.62)
    strahl = k.bereich(k.rauschen((60, 1800, 30), 1.0, 2.0, 0.5), 0.64, 0.72)          # Markstrahlen: kurze helle Spiegel
    ton = k.rauschen((5, 5, 1.2), 1.0, 2.0, 0.5)
    farbe = k.mix(k.bereich(ton, 0.3, 0.7), hell, tuple(c * 0.86 for c in hell))
    farbe = k.mix(k.math('MULTIPLY', k.bereich(band, 0.30, 1.0), 0.45), farbe, tuple(c * 0.66 for c in hell))   # Spätholz satter
    farbe = k.mix(k.math('MULTIPLY', frueh, k.math('ADD', 0.55, k.math('MULTIPLY', pore, 0.45))), farbe, dunkel)
    farbe = k.mix(k.math('MULTIPLY', k.bereich(faser, 0.55, 0.8), 0.18), farbe, dunkel)
    farbe = k.mix(k.math('MULTIPLY', strahl, 0.25), farbe, tuple(min(1.0, c * 1.25) for c in hell))
    hand = k.math('MULTIPLY', k.griff(stellen, 0.10), 1.0 - frisch)
    schmutz = k.math('MULTIPLY', hand, k.math('ADD', 0.35, k.math('MULTIPLY', k.math('ADD', frueh, pore), 0.25)), clamp=True)
    farbe = k.mix(schmutz, farbe, tuple(c * 0.5 for c in dunkel))                    # Handschweiss sitzt in den Poren
    dl = k.k('ShaderNodeTexVoronoi', feature='F1'); nt.links.new(k.ort((30, 30, 30)), dl.inputs['Vector'])
    delle = k.math('MULTIPLY', k.math('SUBTRACT', 1.0, k.bereich(dl.outputs['Distance'], 0.0, 0.09)), k.bereich(k.rauschen((8, 8, 8)), 0.52, 0.66))
    delle = k.math('MULTIPLY', delle, 1.0 - 0.8 * frisch)
    farbe = k.mix(k.math('MULTIPLY', delle, 0.55), farbe, tuple(c * 0.42 for c in dunkel))
    hoehe = k.math('SUBTRACT', k.math('SUBTRACT', k.math('MULTIPLY', faser, 0.35), k.math('MULTIPLY', k.math('MULTIPLY', frueh, pore), 0.9)), k.math('MULTIPLY', delle, 1.6))
    rau = k.mixf(hand, 0.68 - 0.16 * oel + 0.08 * frisch, 0.36)
    if risse_z:
        riss = k.math('MULTIPLY', k.bereich(k.rauschen((70, 70, 1.2), 1.0, 0.0, 0.5), 0.735, 0.745), k.math('SUBTRACT', 1.0, k.bereich(xyz.outputs['Z'], risse_z[0], risse_z[1])))   # ein, zwei lange Trockenrisse
        farbe = k.mix(riss, farbe, (0.02, 0.014, 0.01)); hoehe = k.math('SUBTRACT', hoehe, k.math('MULTIPLY', riss, 5.0))
    for bz in brand:   # Brandzeichen: Ring mit Querstrich, in die Seite gebrannt (y > 0), verkohlt und eingesunken
        u = k.math('DIVIDE', xyz.outputs['X'], 0.009); v = k.math('DIVIDE', k.math('SUBTRACT', xyz.outputs['Z'], bz), 0.009)
        rr = k.math('SQRT', k.math('ADD', k.math('MULTIPLY', u, u), k.math('MULTIPLY', v, v)))
        ringm = k.math('SUBTRACT', 1.0, k.bereich(k.math('ABSOLUTE', k.math('SUBTRACT', rr, 1.0)), 0.10, 0.22))
        strich = k.math('MULTIPLY', k.math('SUBTRACT', 1.0, k.bereich(k.math('ABSOLUTE', u), 0.10, 0.20)), k.math('SUBTRACT', 1.0, k.bereich(k.math('ABSOLUTE', v), 0.9, 1.5)))
        zeichen = k.math('MULTIPLY', k.math('MAXIMUM', ringm, strich), k.bereich(xyz.outputs['Y'], 0.004, 0.009), clamp=True)
        farbe = k.mix(k.math('MULTIPLY', zeichen, 0.9), farbe, (0.022, 0.014, 0.01)); hoehe = k.math('SUBTRACT', hoehe, k.math('MULTIPLY', zeichen, 3.0)); rau = k.mixf(zeichen, rau, 0.8)
    k.setze(b.inputs['Base Color'], farbe); k.setze(b.inputs['Roughness'], k.math('ADD', rau, k.math('MULTIPLY', faser, 0.08)))
    k.relief(b, hoehe, 0.40, 0.0007)
    return m


def _wicklung(bau, z0, z1, r, mat, staerke=0.0016, rx_ry=1.0):
    """Draht- oder Riemenwicklung als echte Windungen (Ringe mit rundem Querschnitt, Windung an Windung)."""
    n = max(2, int((z1 - z0) / (staerke * 2)))
    schn = []
    for i in range(n * 4 + 1):
        z = z0 + (z1 - z0) * i / (n * 4); w = 0.5 - 0.5 * math.cos(2 * math.pi * i / 4)   # 0 Rille … 1 Rücken
        rr = r + staerke * (0.35 + 0.65 * w)
        schn.append((z, profil_ellipse(rr, rr * rx_ry, 16)))
    bau.stab(schn, mat)


def _quer(q):  # entlang z gebaut → quer legen (Achse x)
    return (q[2], q[1], q[0])


def bau_axt(o_z, e_z):
    """Fällaxt (Vorbild axt-01): Kopf mit Nacken, gewölbten Wangen und Bart, Schneide leicht gebaucht; Stiel mit Schwung
    und Knauf („Rehfuss“), oben im Auge verkeilt. `o_z` = Oberkante Kopf (Waffenende), `e_z` = Stielende."""
    b = Bau('Axt')
    kopf = mat_stahl2('axt_Kopf', 'schmiede', fase_x=(-0.128, -0.106), rost=0.6, schneide=0.0016)
    # Kontur des Kopfs entlang x (Nacken +x → Schneide −x): halbe Stärke, Oberkante, Höhe, Exponent des Querschnitts
    stuetz = [(0.036, 0.0128, 0.0075, 0.058, 5.0), (0.026, 0.0140, 0.0060, 0.061, 4.5), (0.0, 0.0150, 0.0050, 0.063, 3.4), (-0.028, 0.0140, 0.0052, 0.063, 3.0),
              (-0.060, 0.0088, 0.0040, 0.068, 2.6), (-0.100, 0.0046, 0.0018, 0.082, 2.3), (-0.135, 0.0021, 0.0002, 0.093, 2.1), (-0.152, 0.0007, 0.0, 0.096, 2.0), (-0.158, 0.00025, 0.0012, 0.0935, 2.0)]
    ringe = []
    for x, dy, oben, hoehe, e in _glatt(stuetz, 6):
        zt = o_z + 0.0005 + oben; zm = zt + hoehe / 2
        # Schneide gebaucht: zur Mitte der Höhe steht sie 3 mm weiter vor (über den Querschnitt verteilt)
        ringe.append([(x - 0.003 * max(0.0, (-x - 0.13) / 0.03) * (1 - ((qz - zm) / (hoehe / 2)) ** 2), qy, qz) for qy, qz in profil_ellipse(max(dy, 0.0002), hoehe / 2, 20, dy=zm, e=e)])
    b.haut(ringe, kopf)
    # Stiel: Mittellinie mit Schwung (x) — Bauch zur Schneide, Knauf nach vorn gezogen; Querschnitte wie ein Ersatzstiel 36"
    stiel = mat_holz2('axt_Stiel', (0.36, 0.25, 0.135), (0.13, 0.075, 0.035), GRIFFE['axt'], mark=(0.006, 0.019), ringbreite=0.0026, oel=0.3, risse_z=(o_z + 0.08, o_z + 0.19), frisch=0.3)
    zs = [(o_z + 0.0012, 0.0165, 0.0105, 0.0), (o_z + 0.006, 0.017, 0.011, 0.0), (o_z + 0.062, 0.0185, 0.0118, 0.0), (o_z + 0.085, 0.0225, 0.0152, 0.0), (o_z + 0.16, 0.021, 0.0146, -0.002),
          (o_z + 0.36, 0.0189, 0.013, -0.006), (e_z - 0.30, 0.0203, 0.0144, -0.004), (e_z - 0.10, 0.0205, 0.0146, 0.003), (e_z - 0.045, 0.0225, 0.0158, -0.004), (e_z - 0.018, 0.0250, 0.0173, -0.011), (e_z, 0.0205, 0.0145, -0.015)]
    b.stab([(z, profil_ellipse(rx, ry, 18, dx=dx, e=2.3)) for z, rx, ry, dx in _glatt(zs, 5)], stiel)
    # Keil im Auge: frisches Hartholz längs im Sägeschnitt, quer dazu ein Eisenkeil (Ringkeil wäre Baumarkt — hier Flachkeil)
    keil = mat_holz2('axt_Keil', (0.62, 0.50, 0.30), (0.30, 0.2, 0.1), (99.0,), frisch=1.0, ringbreite=0.0012)
    b.stab([(o_z + 0.0004, profil_ellipse(0.0145, 0.0019, 8, e=6)), (o_z + 0.004, profil_ellipse(0.0150, 0.0022, 8, e=6))], keil)
    eisen = mat_stahl2('axt_Eisenkeil', 'schmiede', rost=0.9)
    b.stab([(o_z + 0.0, profil_ellipse(0.0016, 0.0075, 8, e=6)), (o_z + 0.004, profil_ellipse(0.0019, 0.008, 8, e=6))], eisen)
    # Draht unter dem Kopf: Schutz gegen Fehlschläge, geglüht und angerostet (Herkunft)
    _wicklung(b, o_z + 0.094, o_z + 0.150, 0.0236, mat_stahl2('axt_Draht', 'schmiede', rost=0.8), 0.0013, rx_ry=0.70)
    return b.fertig()


def bau_speer(sp_z, e_z):
    """Saufeder (Vorbild Met 14.25.323): breites Blatt mit Grat, über einen Hals in die konische Tülle, Niet; Knebel
    aus Horn mit Riemen an der Tülle gebunden; Eschenschaft mit zwei Wicklungen."""
    b = Bau('Speer'); blatt_l = 0.25; basis = sp_z + blatt_l; tuelle = 0.11
    stahl = mat_stahl2('speer_Blatt', 'klinge', schneide=0.0026, rost=0.45, ansatz=basis)
    stuetz = [(0.0, 0.026, 0.021), (0.06, 0.036, 0.0125), (0.20, 0.058, 0.0100), (0.34, 0.064, 0.0092), (0.55, 0.054, 0.0078), (0.78, 0.034, 0.0058), (0.93, 0.014, 0.0042), (1.0, 0.0012, 0.0016)]
    schn = []
    for u, br, d in _glatt(stuetz, 5):
        pr = [(x, math.copysign(max(abs(y), 0.00012) * (1.0 + 0.55 * math.exp(-(x / (0.08 * br + 1e-6)) ** 2)), y)) for x, y in profil_klinge(br, d * 0.62, 'zwei')]   # Grat: Mitte verstärkt
        w = max(0.0, 1 - u / 0.07)                                                   # Hals: Blatt blendet in den Tüllenkreis
        schn.append((basis - u * blatt_l, blende(pr, profil_ellipse(0.0118, 0.0118), w)))
    b.stab(list(reversed(schn)), stahl, zu=(True, False))
    eisen = mat_stahl2('speer_Tuelle', 'schmiede', rost=0.55)
    b.stab([(z, profil_ellipse(r, r, 16)) for z, r in ((basis - 0.001, 0.0118), (basis + 0.03, 0.0132), (basis + tuelle - 0.006, 0.0176), (basis + tuelle - 0.002, 0.0186), (basis + tuelle, 0.0180))], eisen)
    b.stab([(0.0, profil_ellipse(0.0042, 0.0042, 8)), (0.0022, profil_ellipse(0.0036, 0.0036, 8)), (0.0032, profil_ellipse(0.0016, 0.0016, 8))], eisen,
           abb=lambda q: (q[0], 0.0158 + q[2], basis + tuelle - 0.028 + q[1]))            # Nietkopf seitlich
    esche = mat_holz2('speer_Schaft', (0.36, 0.25, 0.13), (0.12, 0.07, 0.035), GRIFFE['speer'], mark=(0.002, 0.019), oel=0.5, brand=(0.20,))
    b.stab([(z, profil_ellipse(r, r, 16)) for z, r in ((basis + 0.03, 0.0128), (basis + tuelle, 0.0148), (-0.5, 0.0150), (e_z - 0.012, 0.0158), (e_z - 0.003, 0.0150), (e_z, 0.0125))], esche)
    # Knebel: Hornstück (Sprosse), mit Riemen unter der Tülle angebunden — hängt am Riemen, liegt quer zum Blatt
    kz = basis + tuelle + 0.016
    horn = mat_horn('speer_Knebel', (0.34, 0.27, 0.19), (0.05, 0.035, 0.025), rillen=0.8, glanz=0.36)
    b.stab([(t, profil_ellipse(r, r * 0.9, 10)) for t, r in _glatt([(-0.048, 0.0038), (-0.040, 0.0062), (0.0, 0.0078), (0.040, 0.0066), (0.050, 0.0040)], 4)], horn,
           abb=lambda q: (q[0] + 0.0215, q[2], kz + q[1] + 0.022))                       # quer (y), dicht am Schaft
    leder = mat_leder('speer_Riemen', (0.075, 0.038, 0.018))
    _wicklung(b, kz + 0.006, kz + 0.036, 0.0150, leder, 0.0021)
    for z0, z1 in ((-0.08, 0.08), (-0.58, -0.42)): _wicklung(b, z0, z1, 0.0150, leder, 0.0026)
    return b.fertig()


def bau_klinge(sp_z, e_z):
    """Einhandschwert (Vorbild CMA 1916.1600): Klinge mit Hohlkehle über 55 %, Parierstange zu den Enden verjüngt,
    lederner Griff über Schnur, Scheibenknauf mit Vernietknopf."""
    b = Bau('Klinge'); unter = -0.085
    stahl = mat_stahl2('klinge_Klinge', 'klinge', schneide=0.0016, rost=0.55, ansatz=unter, narben=0.8)
    stuetz = [(0.0, 0.046, 0.0066, 0.55), (0.3, 0.041, 0.0056, 0.55), (0.55, 0.037, 0.0048, 0.35), (0.62, 0.0355, 0.0045, 0.0), (0.86, 0.030, 0.0034, 0.0), (0.95, 0.019, 0.0028, 0.0), (1.0, 0.0012, 0.0015, 0.0)]
    b.stab(list(reversed([(unter - u * (unter - sp_z), profil_klinge(br, d, 'zwei', kehle=max(0.0, ke))) for u, br, d, ke in _glatt(stuetz, 6)])), stahl, zu=(True, False))
    eisen = mat_stahl2('klinge_Gefaess', 'schmiede', rost=0.7)
    b.stab([(t, profil_ellipse(rx, ry, 10, e=3.2)) for t, rx, ry in _glatt([(-0.098, 0.0040, 0.0036), (-0.090, 0.0060, 0.0050), (-0.045, 0.0052, 0.0050), (0.0, 0.0080, 0.0068), (0.045, 0.0052, 0.0050), (0.090, 0.0060, 0.0050), (0.098, 0.0040, 0.0036)], 4)],
           eisen, abb=lambda q: (q[2], q[1], unter + 0.0068 + q[0]))
    knauf = 0.045; go = e_z - knauf
    leder = mat_leder('klinge_Griff', (0.11, 0.05, 0.022), neu=True)
    schn = []
    for i in range(41):                                   # Leder über Schnurwulsten: drei Wülste, an denen die Hand Halt findet
        t = i / 40; z = unter + 0.014 + t * (go - unter - 0.014)
        r = 0.0128 + 0.0022 * math.sin(math.pi * t) + 0.0011 * max(0.0, math.cos(2 * math.pi * (t * 4 - 0.5))) ** 6
        schn.append((z, profil_ellipse(r, r * 0.80, 14)))
    b.stab(schn, leder)
    # Scheibenknauf: Scheibe in der Klingenebene (x–z), 5 cm, mit erhabener Mitte; oben der Vernietknopf der Angel
    zk = go + knauf * 0.50; R = knauf * 0.50
    b.stab([(t, profil_ellipse(r, r, 20)) for t, r in ((-0.0085, R * 0.80), (-0.0060, R * 0.985), (-0.0030, R), (0.0030, R), (0.0060, R * 0.985), (0.0085, R * 0.80))], eisen,
           abb=lambda q: (q[0], q[2], zk + q[1]))
    for vz in (-1, 1):
        b.stab([(t, profil_ellipse(r, r, 16)) for t, r in ((0.0080, R * 0.52), (0.0105, R * 0.44), (0.0115, R * 0.2))], eisen, abb=lambda q, vz=vz: (q[0], vz * q[2], zk + q[1]))
    b.stab([(e_z - 0.0035, profil_ellipse(0.0050, 0.0042, 8, e=4)), (e_z, profil_ellipse(0.0036, 0.0030, 8, e=4))], eisen)
    return b.fertig()


def bau_hirschfaenger():
    """Hirschfänger (Vorbild CMA 1916.1626): einschneidige Klinge mit Rücken und schmaler Kehle, Rückenschliff an der
    Spitze; Messingkreuz mit Knöpfen und Muschel auf der Aussenseite; Griff aus Hirschhorn mit Perlung, Messingkappe."""
    b = Bau('Hirschfaenger'); L = 0.50; an = -0.07; sp = an - L - 0.012
    stahl = mat_stahl2('hirschfaenger_Klinge', 'klinge', hell=(0.55, 0.56, 0.58), schneide=0.0013, rost=0.25, ansatz=an)
    stuetz = [(0.0, 0.032, 0.0056, 0.0, 0.0), (0.05, 0.032, 0.0055, 0.30, 0.0), (0.5, 0.0295, 0.0044, 0.30, 0.0), (0.76, 0.0275, 0.0036, 0.25, 0.0), (0.82, 0.026, 0.0033, 0.0, 0.5), (0.93, 0.017, 0.0026, 0.0, 1.0), (1.0, 0.001, 0.0012, 0.0, 1.0)]
    schn = [(an - u * (an - sp), [(x + (0.5 * (0.032 - br)), y) for x, y in profil_klinge(br, d, 'ein', kehle=max(0.0, ke), rs=min(1.0, max(0.0, rs)))]) for u, br, d, ke, rs in _glatt(stuetz, 6)]
    b.stab(list(reversed(schn)), stahl, zu=(True, False))                      # Rücken bleibt gerade: Breite geht an der Schneide ab
    messing = mat_messing('hirschfaenger_Messing')
    b.stab([(t, profil_ellipse(rx, ry, 10)) for t, rx, ry in _glatt([(-0.050, 0.0030, 0.0030), (-0.046, 0.0062, 0.0062), (-0.040, 0.0040, 0.0040), (-0.012, 0.0048, 0.0052), (0.0, 0.0066, 0.0072), (0.012, 0.0048, 0.0052), (0.040, 0.0040, 0.0040), (0.046, 0.0062, 0.0062), (0.050, 0.0030, 0.0030)], 4)],
           messing, abb=lambda q: (q[2], q[1], -0.063 + q[0]))
    # Muschel: gewölbter Fächer mit Rippen, steht vom Kreuz auf der Aussenseite (+y) zur Klinge hin
    ringe = []
    for i in range(9):
        t = i / 8; rr = 0.004 + 0.024 * t; reihe = []
        for kx in range(25):
            a = math.pi * (kx / 24 - 0.5) * 0.92
            rippe = 1 + 0.07 * math.cos(9 * a) * t
            reihe.append((rr * rippe * math.sin(a), 0.0075 + 0.006 * math.sin(math.pi * t * 0.5) + 0.0012 * math.cos(9 * a) * t, -0.064 - rr * rippe * math.cos(a) * 0.82))
        ringe.append(reihe)
    for d in (0.0, -0.0014):
        idx = b.mat(messing); vr = [[b.bm.verts.new((x, y + d, z)) for x, y, z in r] for r in ringe]
        for a_, b_ in zip(vr, vr[1:]):
            for i in range(len(a_) - 1):
                f = b.bm.faces.new((a_[i], a_[i + 1], b_[i + 1], b_[i])); f.material_index = idx; f.smooth = True
    import random
    rnd = random.Random(414)
    horn = mat_horn('hirschfaenger_Griff', (0.66, 0.56, 0.40), (0.11, 0.065, 0.035), rillen=1.0, glanz=0.30)
    schn = []
    for i in range(33):
        u = i / 32; z = -0.058 + u * 0.118
        rx, ry = 0.0135 + 0.002 * math.sin(math.pi * u), 0.0115 + 0.0015 * math.sin(math.pi * u)
        pk = profil_ellipse(rx, ry, 16, dx=0.004 * math.sin(math.pi * u))
        schn.append((z, [(x * (1 + (0.085 * rnd.random() if 0.08 < u < 0.95 else 0)), y * (1 + (0.085 * rnd.random() if 0.08 < u < 0.95 else 0))) for x, y in pk]))
    b.stab(schn, horn)
    b.stab([(z, profil_ellipse(r, r * 0.9, 14)) for z, r in ((0.058, 0.0140), (0.061, 0.0146), (0.066, 0.0128), (0.070, 0.0085), (0.072, 0.0040))], messing)
    return b.fertig()


def bau_messer():
    """Langes Messer aus einer Blattfeder: breite einschneidige Klinge, Rücken vorn abgesetzt, Schmiedehaut am Rücken,
    die Bohrung des Federbolzens blieb am Ansatz stehen; kräftiges Kreuz mit Wehrnagel; Angel sichtbar zwischen
    Buchenschalen, drei Niete (einer durch einen Eisennagel ersetzt), Knaufkappe zur Schneide gebogen."""
    b = Bau('Messer'); L = 0.82; an = -0.065; sp = an - L - 0.014
    stahl = mat_stahl2('messer_Klinge', 'klinge', schneide=0.0015, rost=0.4, ansatz=an, haut_x=(0.004, 0.015))
    stuetz = [(0.0, 0.038, 0.0062, 0.0, 0.0), (0.4, 0.0362, 0.0052, 0.0, 0.0), (0.6, 0.0348, 0.0046, 0.0, 0.0), (0.78, 0.0330, 0.0039, 0.006, 0.0), (0.80, 0.0325, 0.0038, 0.008, 0.25), (0.92, 0.021, 0.0030, 0.011, 1.0), (1.0, 0.0012, 0.0014, 0.016, 1.0)]
    schn = [(an - u * (an - sp), [(x - bo, y) for x, y in profil_klinge(br, d, 'ein', rs=min(1.0, max(0.0, rs)))]) for u, br, d, bo, rs in _glatt(stuetz, 7)]
    b.stab(list(reversed(schn)), stahl, zu=(True, False))
    eisen = mat_stahl2('messer_Kreuz', 'schmiede', rost=0.6)
    b.stab([(t, profil_ellipse(rx, ry, 10, e=4.0)) for t, rx, ry in _glatt([(-0.092, 0.0038, 0.0050), (-0.085, 0.0052, 0.0066), (-0.03, 0.0056, 0.0070), (0.0, 0.0066, 0.0080), (0.03, 0.0056, 0.0070), (0.085, 0.0052, 0.0066), (0.092, 0.0038, 0.0050)], 4)],
           eisen, abb=lambda q: (q[2], q[1], -0.0605 + q[0]))
    # Wehrnagel: kräftiger Zapfen auf der Aussenseite, schützt die Knöchel (Lecküchner) — hier 3 cm, vorn breitgeschlagen
    b.stab([(t, profil_ellipse(rx, rz, 10)) for t, rx, rz in ((0.0, 0.0062, 0.0062), (0.006, 0.0050, 0.0048), (0.024, 0.0046, 0.0040), (0.029, 0.0064, 0.0030), (0.031, 0.0050, 0.0018))], eisen,
           abb=lambda q: (q[0], 0.006 + q[2], -0.0605 + q[1]))
    # Angel: Flachstahl durch den ganzen Griff, an den Schmalseiten zwischen den Schalen sichtbar
    angel = mat_stahl2('messer_Angel', 'klinge', rost=0.5, hell=(0.36, 0.36, 0.37))
    b.stab([(z, profil_ellipse(rx, 0.0030, 8, e=8)) for z, rx in ((-0.056, 0.0162), (0.05, 0.0164), (0.15, 0.0164), (0.236, 0.0168))], angel)
    buche = mat_holz2('messer_Griff', (0.30, 0.165, 0.085), (0.10, 0.05, 0.025), GRIFFE['messer'], mark=(0.03, 0.04), ringbreite=0.0016, oel=0.6)
    for sy in (1, -1):
        schn = []
        for z, br in _glatt([(-0.055, 0.0150), (0.0, 0.0158), (0.10, 0.0160), (0.20, 0.0158), (0.234, 0.0164)], 6):
            pk = [(x, y) for x, y in profil_ellipse(br, 0.0098, 12, e=3.0) if y >= -1e-9]
            schn.append((z, [(x, sy * (0.0030 + y)) for x, y in pk]))
        b.stab(schn, buche)
    messing = mat_messing('messer_Niet')
    for z, m_, r in ((-0.02, messing, 0.0036), (0.09, eisen, 0.0030), (0.2, messing, 0.0036)):      # mittlerer Niet ersetzt: Eisennagel, vernietet
        b.stab([(t, profil_ellipse(rr, rr, 8)) for t, rr in ((-0.0133, r * 0.6), (-0.0128, r), (0.0128, r), (0.0133, r * 0.6))], m_, abb=lambda q, z=z: (q[0], q[2], z + q[1]))
    b.stab([(z, profil_ellipse(rx, ry, 14, dx=dx, e=3.0)) for z, rx, ry, dx in _glatt([(0.234, 0.0172, 0.0132, 0.0), (0.246, 0.0170, 0.0130, -0.002), (0.257, 0.0150, 0.0118, -0.008), (0.2655, 0.0105, 0.0095, -0.017), (0.268, 0.0050, 0.0050, -0.021)], 4)], eisen)
    o = b.fertig()
    # Bohrung des Federbolzens (8 mm) am Ansatz, 3,5 cm vor dem Kreuz, nahe dem Rücken
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.004, depth=0.03, location=(0.006, 0.0, an - 0.035), rotation=(math.pi / 2, 0, 0))
    loch = bpy.context.active_object; loch.name = 'Federbohrung'
    md = o.modifiers.new('Bohrung', 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.object = loch
    try: md.solver = 'EXACT'
    except Exception: pass
    bpy.context.view_layer.objects.active = o
    try: bpy.ops.object.modifier_apply(modifier=md.name)
    except Exception as e: print('Bohrung', e)
    bpy.data.objects.remove(loch, do_unlink=True)
    return o


def baue_runde2(mass):
    """Die fünf Waffen neu bauen, an den Maßen der Spielmodelle (`mass`: Name → (z_min, z_max)) ausrichten und prüfen."""
    bau = {'Axt': lambda: bau_axt(*mass['Axt']), 'Speer': lambda: bau_speer(*mass['Speer']), 'Klinge': lambda: bau_klinge(*mass['Klinge']),
           'Hirschfaenger': bau_hirschfaenger, 'Messer': bau_messer}
    for name, f in bau.items():
        alt = bpy.data.objects.get(name)
        if alt: bpy.data.objects.remove(alt, do_unlink=True)
        o = f(); o.name = name
        zs = [v.co.z for v in o.data.vertices]
        print('WAFFENFRAME Runde 2 %-14s z %.3f…%.3f (Spiel %.3f…%.3f) Abweichung %.1f / %.1f mm, %d Flächen' %
              (name, min(zs), max(zs), mass[name][0], mass[name][1], (min(zs) - mass[name][0]) * 1000, (max(zs) - mass[name][1]) * 1000, len(o.data.polygons)))


# ───────────────────────────── Szene ─────────────────────────────
def baue_modelle():
    """`waffenmodelle.py` ausführen (baut alle Modelle in eine leere Szene und schreibt eine Kopie in den Cache)."""
    ziel = os.path.join(os.path.dirname(HIER), '.cache', 'bilder', 'waffen-r1', 'waffen-bau.glb')
    os.makedirs(os.path.dirname(ziel), exist_ok=True)
    argv = sys.argv[:]; sys.argv = [argv[0], '--', ziel]
    quelle = open(os.path.join(HIER, 'waffenmodelle.py'), encoding='utf-8').read()
    exec(compile(quelle, 'waffenmodelle.py', 'exec'), {'__name__': 'waffenmodelle'})
    sys.argv = argv


def untere_huelle(punkte):
    """Untere konvexe Hülle einer Punktmenge (x, z) — darauf liegt ein Körper auf einer Platte."""
    p = sorted(set(punkte)); h = []
    for q in p:
        while len(h) >= 2 and (h[-1][0] - h[-2][0]) * (q[1] - h[-2][1]) - (h[-1][1] - h[-2][1]) * (q[0] - h[-2][0]) <= 0: h.pop()
        h.append(q)
    return h


def lege(o, y):
    """Waffe auf die Werkbank legen: Achse nach x (Klinge nach links), Blatt flach; gekippt, bis die zwei tragenden
    Punkte der unteren Hülle unter dem Schwerpunkt beide aufliegen (Axt: Wange und Stielende)."""
    from mathutils import Matrix, Vector
    M = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))            # z→x, x→y, y→z
    pts = [M @ v.co for v in o.data.vertices]
    # Schwerpunkt auf der Achse: aus den Flächen (Fläche × Lage) — für die Auflage genügt das
    fl = sum(p.area for p in o.data.polygons) or 1.0
    sx = sum((M @ p.center).x * p.area for p in o.data.polygons) / fl
    h = untere_huelle([(round(p.x, 4), round(p.z, 4)) for p in pts])
    a, b = h[0], h[-1]
    for i in range(len(h) - 1):
        if h[i][0] <= sx <= h[i + 1][0]: a, b = h[i], h[i + 1]; break
    kipp = math.atan2(b[1] - a[1], b[0] - a[0])
    R = Matrix.Rotation(kipp, 4, 'Y')                                              # dreht die Auflagekante waagrecht
    pts2 = [R @ p for p in pts]
    mitte = (min(p.x for p in pts2) + max(p.x for p in pts2)) / 2
    T = Matrix.Translation(Vector((-mitte, y, TISCH - min(p.z for p in pts2))))
    o.matrix_world = T @ R @ M
    print('WAFFENFRAME liegt', o.name, 'Kipp %.2f°' % math.degrees(kipp), 'Länge %.3f m' % (max(p.x for p in pts2) - min(p.x for p in pts2)))


def kanten(o, breite=0.0004):
    """Fase an harten Kanten, alles andere weich — die Spielmodelle sind flach schattiert und haben keine Normalen."""
    for p in o.data.polygons: p.use_smooth = True
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    try: bpy.ops.object.shade_smooth()
    except Exception as e: print('weich', e)
    f = o.modifiers.new('Fase', 'BEVEL'); f.width = breite; f.segments = 2; f.limit_method = 'ANGLE'; f.angle_limit = math.radians(46)
    f.harden_normals = True
    w = o.modifiers.new('Normalen', 'WEIGHTED_NORMAL'); w.keep_sharp = False
    o.select_set(False)


def werkbank():
    """Bohlen 20 cm breit, 4,5 cm stark, mit Fugen; dahinter eine Bretterwand, darunter Lehmboden."""
    import random
    from mathutils import Vector
    rnd = random.Random(23)
    holz = mat_holz('Werkbank', (0.17, 0.115, 0.07), (0.055, 0.036, 0.022), (99.0,), alt=0.7, lang=5.0)
    wand = mat_holz('Wand', (0.12, 0.085, 0.055), (0.04, 0.028, 0.018), (99.0,), alt=0.8, lang=5.0)
    def brett(name, mitte, mass, mat, dreh=(0, 0, 0)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=mitte); o = bpy.context.active_object; o.name = name
        o.scale = mass; o.rotation_euler = dreh; o.data.materials.append(mat)
        f = o.modifiers.new('Fase', 'BEVEL'); f.width = 0.004; f.segments = 2
        return o
    y = -0.72
    while y < 0.72:
        b = rnd.uniform(0.17, 0.23)
        # Maserung längs: die Bohle ist um 90° um y gedreht gebaut (Achse z des Materials = Länge)
        brett('Bohle', (rnd.uniform(-0.02, 0.02), y + b / 2, TISCH - 0.0225 - rnd.uniform(0, 0.002)), (0.045, b - 0.004, 2.9), holz, (0, math.pi / 2, 0))
        y += b
    for x in (-1.25, 1.25):
        for yy in (-0.6, 0.6): brett('Bein', (x, yy, (TISCH - 0.045) / 2), (0.09, 0.09, TISCH - 0.045), holz)
    x = -2.2
    while x < 2.2:
        b = rnd.uniform(0.16, 0.24)
        brett('Wandbrett', (x + b / 2, 1.05 + rnd.uniform(0, 0.006), 1.3), (b - 0.006, 0.03, 2.6), wand); x += b
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0)); bd = bpy.context.active_object; bd.name = 'Boden'
    m, nt, bs = _nt('Lehm'); k = N(nt); k.setze(bs.inputs['Base Color'], k.mix(k.rauschen((3, 3, 3)), (0.10, 0.075, 0.05), (0.17, 0.13, 0.09)))
    bs.inputs['Roughness'].default_value = 0.9; bd.data.materials.append(m)


def kamera(name, ort, ziel, brennweite):
    from mathutils import Vector
    cam = bpy.data.cameras.new(name); cam.lens = brennweite; cam.sensor_width = 36; cam.clip_start = 0.02
    o = bpy.data.objects.new(name, cam); bpy.context.scene.collection.objects.link(o)
    o.location = ort; o.rotation_euler = (Vector(ziel) - Vector(ort)).to_track_quat('-Z', 'Y').to_euler()
    cam.dof.use_dof = True; cam.dof.focus_distance = (Vector(ziel) - Vector(ort)).length; cam.dof.aperture_fstop = 5.6 if name != 'gesamt' else 11
    return o


def bild():
    from mathutils import Vector
    args = sys.argv[sys.argv.index('--') + 1:]
    aus, ansicht = args[1], args[2]
    breite, hoehe, spp = (int(args[3]), int(args[4]), int(args[5])) if len(args) > 5 else (1200, 860, 64)
    baue_modelle()                                   # leert die Szene (factory settings) und baut alle Waffen
    sys.path.insert(0, HIER)
    import hausframe as H                            # Himmel und Sonnenfarbe wie im Haus-Zielbild
    for o in list(bpy.data.objects):
        if o.name not in OBJEKT.values(): bpy.data.objects.remove(o, do_unlink=True)
    lage = {'speer': 0.50, 'axt': 0.22, 'messer': -0.04, 'klinge': -0.28, 'hirschfaenger': -0.50}
    neu = RUNDE >= 2 and not ROH
    if neu:   # Hauptmaße an den Spielmodellen messen, dann die Zielbild-Geometrie an ihre Stelle setzen
        mass = {n: (min(v.co.z for v in bpy.data.objects[n].data.vertices), max(v.co.z for v in bpy.data.objects[n].data.vertices)) for n in OBJEKT.values()}
        baue_runde2(mass)
    for w in WAFFEN:
        o = bpy.data.objects[OBJEKT[w]]
        lege(o, lage[w])
        if neu: kanten(o, 0.00025)
        elif not ROH:
            for i, slot in enumerate(o.material_slots): slot.material = material(w, slot.material)
            kanten(o)
    werkbank()
    H.himmel()
    sonne = bpy.data.objects['Sonne']                # Streiflicht von links vorn, 28° hoch: Kanten und Riefen zeichnen
    richt = Vector((-0.62, -0.50, 0.53)).normalized()
    sonne.rotation_euler = (-richt).to_track_quat('-Z', 'Y').to_euler(); sonne.data.angle = math.radians(2.5)
    if ansicht == 'gesamt':
        kam = kamera('gesamt', (0.0, -1.35, 2.75), (0.0, 0.0, TISCH), 40)
    else:
        griff = ansicht.endswith('-griff'); waffe = ansicht.replace('-griff', '')
        o = bpy.data.objects[OBJEKT[waffe]]
        ziel = o.matrix_world @ Vector((0, 0, NAH_GRIFF[waffe] if griff else NAH[waffe]))
        nah = float(os.environ.get('WAFFE_NAH', '1.0'))      # < 1 rückt die Kamera heran
        kam = kamera(ansicht, (ziel.x + 0.04 * nah, ziel.y - 0.40 * nah, ziel.z + 0.58 * nah), ziel, 50)
    sc = bpy.context.scene; sc.camera = kam
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = spp
    sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 3; sc.cycles.sample_clamp_indirect = 4.0
    sc.render.threads_mode = 'FIXED'; sc.render.threads = int(os.environ.get('WAFFE_KERNE', '4'))
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = breite, hoehe, 100
    sc.view_settings.view_transform = 'AgX'
    try: sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception as e: print('Look', e)
    sc.view_settings.exposure = float(os.environ.get('WAFFE_EV', '0.1'))
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '8'
    sc.render.filepath = os.path.abspath(aus)
    bpy.ops.render.render(write_still=True)
    print('WAFFENFRAME Bild', aus, 'roh' if ROH else 'ziel')


# ───────────────────────────── Montage (ohne Blender) ─────────────────────────────
def blatt():
    """Bildpaare: je Waffe Foto │ heutiges Modell │ Zielbild, dazu Übersicht vorher │ nachher."""
    import json
    from PIL import Image, ImageDraw, ImageFont
    ordner, ref = sys.argv[2], sys.argv[3]
    quellen = json.load(open(os.path.join(ref, 'quellen.json'), encoding='utf-8'))
    def schrift(g, fett=False):
        for p in ('/System/Library/Fonts/Supplemental/Arial%s.ttf' % (' Bold' if fett else ''), '/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if fett else '')):
            if os.path.exists(p): return ImageFont.truetype(p, g)
        return ImageFont.load_default()
    def reihe(aus, unten, teile, h=640):
        bilder = [(t, Image.open(p).convert('RGB')) for t, p in teile if os.path.exists(p)]
        bilder = [(t, b.resize((round(b.width * h / b.height), h), Image.LANCZOS)) for t, b in bilder]
        w = sum(b.width for _, b in bilder) + 8 * (len(bilder) - 1)
        blatt_ = Image.new('RGB', (w, h + 44 + 36), (18, 18, 18)); d = ImageDraw.Draw(blatt_); x = 0
        for t, b in bilder:
            blatt_.paste(b, (x, 44)); d.text((x + 10, 10), t, font=schrift(24, True), fill=(235, 235, 235)); x += b.width + 8
        d.text((10, h + 52), unten, font=schrift(18), fill=(200, 200, 200)); blatt_.save(aus, quality=90); print('WAFFENFRAME Blatt', aus, blatt_.size)
    ref_name = {'speer': 'saufeder'}
    for w in WAFFEN:
        q = [x for x in quellen if x['waffe'] == ref_name.get(w, w)]
        if not q:      # ohne Foto (Abruf gesperrt): nur heute │ Zielbild, die Lücke steht in der Fusszeile
            reihe(os.path.join(ordner, 'paar-%s.jpg' % w), 'Kein Foto geladen (Abruf der Vorlage gesperrt) · Blender/Cycles, Standbild, keine Look-Abnahme',
                  [('heute im Spiel: %s' % NAMEN[w], os.path.join(ordner, 'roh-%s.png' % w)), ('Zielbild (Runde 1)', os.path.join(ordner, 'ziel-%s.png' % w))]); continue
        f = q[0]
        reihe(os.path.join(ordner, 'paar-%s.jpg' % w),
              'Foto: %s — %s, %s · Blender/Cycles, Standbild, keine Look-Abnahme · Maße und Gewicht unverändert (Spielwerte)' % (f['titel'].replace('File:', '')[:60], f['urheber'][:30], f['lizenz']),
              [('Foto', os.path.join(ref, f['datei'])), ('heute im Spiel: %s' % NAMEN[w], os.path.join(ordner, 'roh-%s.png' % w)), ('Zielbild (Runde 1)', os.path.join(ordner, 'ziel-%s.png' % w))])
    reihe(os.path.join(ordner, 'paar-gesamt.jpg'), 'Von oben: Saufeder, Fällaxt, Langes Messer, Klinge, Hirschfänger · Blender/Cycles, Standbild, keine Look-Abnahme',
          [('heute im Spiel', os.path.join(ordner, 'roh-gesamt.png')), ('Zielbild (Runde 1): Stahl, Holz, Leder, Horn mit Substanz', os.path.join(ordner, 'ziel-gesamt.png'))], h=760)


def blatt2():
    """Runde 2: je Waffe Foto │ Runde 1 │ Runde 2 (dazu das Griffbild, wo es eines gibt), Übersicht Runde 1 │ Runde 2
    und `herkunft.md`. Aufruf: `python3 tools/waffenframe.py blatt2 <ordner-r2> <ordner-r1> <referenzordner>`."""
    import json
    from PIL import Image, ImageDraw, ImageFont
    ordner, alt, ref = sys.argv[2], sys.argv[3], sys.argv[4]
    quellen = json.load(open(os.path.join(ref, 'quellen.json'), encoding='utf-8'))
    def schrift(g, fett=False):
        pf = '/System/Library/Fonts/Supplemental/Arial%s.ttf' % (' Bold' if fett else '')
        return ImageFont.truetype(pf, g) if os.path.exists(pf) else ImageFont.load_default()
    def reihe(aus, unten, teile, h=600):
        bilder = [(t, Image.open(pf).convert('RGB')) for t, pf in teile if os.path.exists(pf)]
        bilder = [(t, b.resize((round(b.width * h / b.height), h), Image.LANCZOS)) for t, b in bilder]
        w = sum(b.width for _, b in bilder) + 8 * (len(bilder) - 1)
        bl = Image.new('RGB', (w, h + 44 + 62), (18, 18, 18)); d = ImageDraw.Draw(bl); x = 0
        for t, b in bilder:
            bl.paste(b, (x, 44)); d.text((x + 10, 10), t, font=schrift(24, True), fill=(235, 235, 235)); x += b.width + 8
        for i, z in enumerate(unten): d.text((10, h + 50 + i * 26), z, font=schrift(18), fill=(200, 200, 200))
        bl.save(aus, quality=90); print('WAFFENFRAME Blatt', aus, bl.size)
    ref_name = {'speer': 'saufeder'}
    for w in WAFFEN:
        q = [x for x in quellen if x['waffe'] == ref_name.get(w, w)]
        foto = [('Foto', os.path.join(ref, q[0]['datei']))] if q else []
        fuss = ('Foto: %s — %s, %s' % (q[0]['titel'].replace('File:', '')[:60], q[0]['urheber'][:30], q[0]['lizenz'])) if q else 'Kein Foto geladen'
        reihe(os.path.join(ordner, 'paar-%s.jpg' % w),
              ['Herkunft (Vorschlag): ' + HERKUNFT[w], fuss + ' · Blender/Cycles, Standbild, keine Look-Abnahme · Hauptmaße wie im Spiel'],
              foto + [('Runde 1 (D465): %s' % NAMEN[w], os.path.join(alt, 'ziel-%s.png' % w)), ('Runde 2: eigene Form, Stahl, Holz', os.path.join(ordner, 'ziel-%s.png' % w)),
                      ('Runde 2: Griff', os.path.join(ordner, 'ziel-%s-griff.png' % w))])
    reihe(os.path.join(ordner, 'paar-gesamt.jpg'), ['Von oben: Saufeder, Fällaxt, Langes Messer, Klinge, Hirschfänger · Blender/Cycles, Standbild, keine Look-Abnahme', ''],
          [('Runde 1 (D465)', os.path.join(alt, 'ziel-gesamt.png')), ('Runde 2: eigene Zielbild-Geometrie', os.path.join(ordner, 'ziel-gesamt.png'))], h=760)
    with open(os.path.join(ordner, 'herkunft.md'), 'w', encoding='utf-8') as f:
        f.write('# Waffen Runde 2 — Herkunft je Waffe (Vorschlag, von Flo nicht bestätigt)\n\n')
        for w in WAFFEN: f.write('- **%s:** %s\n' % (NAMEN[w], HERKUNFT[w]))


if __name__ == '__main__':
    if bpy and '--' in sys.argv: bild()
    elif len(sys.argv) > 1 and sys.argv[1] == 'blatt': blatt()
    elif len(sys.argv) > 1 and sys.argv[1] == 'blatt2': blatt2()
    else: print(__doc__)
