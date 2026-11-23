# BRACHLAND — Hof-Baukasten (D360): ein Inntaler Einfirsthof prozedural aus content/hofbaukasten.json.
#
#   blender --background --factory-startup --python tools/hofbaukasten.py -- <ausgabeordner> <saat> <stufe 0-3> [laenge breite]
#
# Schreibt je Lauf hof_s<saat>_v<stufe>.blend (prozedurale Materialien), .png (Cycles, 3/4-Ansicht, 1280 × 720,
# Dämmerung), .glb (Farbe gebacken, Principled) und _info.json (Maße, Dreiecke, Laufzeiten).
#
# Bautyp nach docs/design/BRACHLAND_Bauwelt_v1.md §A1: Wohnteil + Tenne/Stall unter einem First, EG gemauert und weiss
# gekalkt über Feldsteinsockel, OG Blockbau mit Vorköpfen, umlaufende Laube und Hochlaube, verbretterter Giebel, teils
# Giebelbundwerk, Flachsatteldach mit Pfetten und Sparren, Fenster mit Läden, Haustür, Tennentor. Kein Fachwerk.
# Verfallsstufen 0 bewohnt … 3 Ruine wie dort; was eine Stufe ändert, steht als Zahl in den Daten (`verfall`).
#
# Achsen: First entlang +x (0 … L), Breite entlang y (−B/2 … B/2), z nach oben, Boden z = 0. Der Wohngiebel liegt bei
# x = 0 und schaut nach −x, das Tennentor in der Traufseite y = −B/2. Die Sonnenseite ist −y (Holz dunkler).
# Alle Zufallswerte aus einem random.Random(saat) — gleiche Saat, gleicher Hof.
import bpy, bmesh, json, math, os, sys, time
import random as _zufall
from mathutils import Matrix, Vector

T0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)   # Würfel, Kamera, Licht der Vorgabeszene weg
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(argv) < 3:
    raise SystemExit('Aufruf: blender --background --factory-startup --python tools/hofbaukasten.py -- <ausgabe> <saat> <stufe 0-3> [laenge breite]')
AUSGABE = argv[0]
SAAT = int(argv[1])
STUFE = int(argv[2])
if STUFE not in (0, 1, 2, 3):
    raise SystemExit('stufe muss 0, 1, 2 oder 3 sein')
os.makedirs(AUSGABE, exist_ok=True)
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATEN = json.load(open(os.path.join(REPO, 'content/hofbaukasten.json'), encoding='utf-8'))
MASSE = DATEN['masse']
VERFALL = {k: (v['wert'] if isinstance(v, dict) else v) for k, v in DATEN['verfall'][STUFE].items()}
NAME = f'hof_s{SAAT}_v{STUFE}'
zr = _zufall.Random(SAAT)


def mass(k, streuung=0.5):
    """Wert aus der Spanne: um das Ziel gestreut, nie ausserhalb min/max."""
    m = MASSE[k]
    w = m['ziel'] + (zr.random() * 2 - 1) * streuung * (m['max'] - m['min']) / 2
    return min(m['max'], max(m['min'], w))


def wahr(p):
    return zr.random() < p


# ───────────────────────────── Maße dieses Hofs ─────────────────────────────
B = float(argv[4]) if len(argv) > 4 else mass('wohnteilbreite', 1.0)
L = float(argv[3]) if len(argv) > 3 else mass('gesamtlaenge', 1.0)
for k, w in (('wohnteilbreite', B), ('gesamtlaenge', L)):
    if not MASSE[k]['min'] <= w <= MASSE[k]['max']:
        print(f'WARNUNG {k} = {w:.2f} m liegt ausserhalb {MASSE[k]["min"]}–{MASSE[k]["max"]} m')
LW = round(L * mass('wohnteilanteil'), 2)          # Länge Wohnteil
H_EG, H_OG, KNIE = mass('geschosshoehe_eg'), mass('geschosshoehe_og'), mass('kniestock')
SOCKEL, T_EG = mass('sockelhoehe'), mass('mauerstaerke_eg')
NEIG = math.radians(mass('dachneigung'))
UE_T, UE_G, DACHD = mass('ueberstand_traufe'), mass('ueberstand_giebel'), mass('dachdicke')
LAUBE_T, BRUEST = mass('laubentiefe'), mass('bruestungshoehe')
HOCH_B = B * mass('hochlaube_anteil')
BH, BS, VK = mass('balken_hoehe'), mass('balken_staerke'), mass('vorkopf')
BW, BD = mass('brettbreite'), mass('brettstaerke')
FB, FH, FBR, FA = mass('fenster_breite'), mass('fenster_hoehe'), mass('fenster_bruestung'), mass('fensterachse')
TB, TH = mass('tuer_breite'), mass('tuer_hoehe')
TORB, TORH = mass('tennentor_breite'), mass('tennentor_hoehe')
PQ, SPA, SH = mass('pfette_querschnitt'), mass('sparrenabstand'), mass('sparren_hoehe')
TAN = math.tan(NEIG)

Z_OG = H_EG                                   # OG-Fussboden
Z_T = H_EG + H_OG + KNIE                      # Wandkrone = Unterkante Fusspfette
Z_TOP_OG = Z_T
# Blockbau in ganzen Balkenlagen: die Krone rastet auf die Lage ein.
LAGEN = max(6, round((Z_T - Z_OG) / BH))
BH = (Z_T - Z_OG) / LAGEN


def sparren_unten(y):
    """Unterkante der Sparren über der Stelle y (auf den Pfetten)."""
    return Z_T + PQ + (B / 2 - abs(y)) * TAN


Z_DACH0 = sparren_unten(0) + SH / math.cos(NEIG)     # Unterkante Dachhaut am First
Z_FIRST = Z_DACH0 + DACHD / math.cos(NEIG)

DECKUNG = zr.choice(['ziegel_rot', 'ziegel_anthrazit', 'schindel'])  # Bauwelt §A1: heute Ziegel, historisch Legschindeln
WIRT_BLECH = wahr(0.6)                                               # Bauwelt §A1: Blech am Wirtschaftsteil
BUNDWERK = wahr(0.5)                                                 # „teils Giebelbundwerk“

# ───────────────────────────── Geometrie-Sammler ─────────────────────────────
NETZE = {}   # Material → bmesh


def netz(mk):
    if mk not in NETZE:
        bm = bmesh.new()
        bm.faces.layers.float.new('ton')
        NETZE[mk] = bm
    return NETZE[mk]


def quader_m(mk, M, groesse, ton=None):
    """Quader der Grösse (sx, sy, sz) in der Lage M (4 × 4, Mitte + Drehung)."""
    sx, sy, sz = (max(1e-3, g) for g in groesse)
    bm = netz(mk)
    erg = bmesh.ops.create_cube(bm, size=1.0, matrix=M @ Matrix.Diagonal((sx, sy, sz, 1)))
    t = zr.random() if ton is None else ton
    lage = bm.faces.layers.float['ton']
    for f in {f for v in erg['verts'] for f in v.link_faces}:
        f[lage] = t


def quader(mk, mitte, groesse, ton=None):
    quader_m(mk, Matrix.Translation(Vector(mitte)), groesse, ton)


def quader_ab(mk, a, b, ton=None):
    """Achsparalleler Quader zwischen den Ecken a und b."""
    quader(mk, [(a[i] + b[i]) / 2 for i in range(3)], [abs(b[i] - a[i]) for i in range(3)], ton)


def stein(mk, ort, r, ton=None):
    bm = netz(mk)
    erg = bmesh.ops.create_icosphere(bm, subdivisions=2 if mk == 'laub' else 1, radius=r, matrix=Matrix.Translation(Vector(ort)))
    for v in erg['verts']:
        v.co.x += zr.uniform(-0.25, 0.25) * r; v.co.y += zr.uniform(-0.25, 0.25) * r; v.co.z += zr.uniform(-0.3, 0.1) * r
    t = zr.random() if ton is None else ton
    lage = bm.faces.layers.float['ton']
    for f in {f for v in erg['verts'] for f in v.link_faces}:
        f[lage] = t


def drehung(achse, winkel):
    return Matrix.Rotation(winkel, 4, achse)


def wandquader(mk, achse, ebene, innen, u0, u1, z0, z1, dicke, ton=None, vor=0.0):
    """Wandstück in der Ebene y = ebene (achse 'x') oder x = ebene (achse 'y'); innen = ±1 zeigt ins Haus."""
    e = ebene - innen * vor
    if achse == 'x':
        quader_ab(mk, (u0, e, z0), (u1, e + innen * dicke, z1), ton)
    else:
        quader_ab(mk, (e, u0, z0), (e + innen * dicke, u1, z1), ton)


def rechtecke(u0, u1, z0, z1, oeffnungen):
    """Zerlegt die Fläche [u0,u1] × [z0,z1] in volle Rechtecke um die Öffnungen (u_a, u_b, z_a, z_b) herum."""
    us = sorted({u0, u1, *[min(u1, max(u0, o[i])) for o in oeffnungen for i in (0, 1)]})
    for ua, ub in zip(us, us[1:]):
        if ub - ua < 1e-4:
            continue
        m = (ua + ub) / 2
        loch = sorted((o[2], o[3]) for o in oeffnungen if o[0] < m < o[1])
        z = z0
        for c, d in loch:
            if c > z:
                yield ua, ub, z, min(c, z1)
            z = max(z, d)
            if z >= z1:
                break
        if z < z1:
            yield ua, ub, z, z1


def punkt(achse, ebene, u, z, aus=0.0, innen=1):
    """Weltpunkt auf einer Wandebene, `aus` Meter nach aussen."""
    return Vector((u, ebene - innen * aus, z)) if achse == 'x' else Vector((ebene - innen * aus, u, z))


# ───────────────────────────── Öffnungen planen ─────────────────────────────
def achsen(u0, u1, abstand, breite):
    """Fensterachsen gleichmässig zwischen u0 und u1."""
    n = max(1, int((u1 - u0) / abstand))
    schritt = (u1 - u0) / n
    return [u0 + schritt * (i + 0.5) for i in range(n) if breite < schritt]


WAENDE = {   # Name → (achse, ebene, innen, u0, u1)
    'giebel': ('y', 0.0, 1, -B / 2, B / 2),
    'sued': ('x', -B / 2, 1, 0.0, L),
    'nord': ('x', B / 2, -1, 0.0, L),
    'rueck': ('y', L, -1, -B / 2, B / 2),
}
OEFF = {w: {'eg': [], 'og': [], 'brett': []} for w in WAENDE}   # (u_a, u_b, z_a, z_b, art)

# Wohngiebel: Haustür mittig, Fenster beidseits; OG mit Laubentür mittig.
for u in achsen(-B / 2 + 0.6, B / 2 - 0.6, FA, FB):
    if abs(u) < TB:
        continue
    OEFF['giebel']['eg'].append((u - FB / 2, u + FB / 2, FBR, FBR + FH, 'fenster'))
    OEFF['giebel']['og'].append((u - FB / 2, u + FB / 2, Z_OG + FBR, Z_OG + FBR + FH, 'fenster'))
OEFF['giebel']['eg'].append((-TB / 2, TB / 2, 0.0, TH, 'tuer'))
OEFF['giebel']['og'].append((-0.45, 0.45, Z_OG, Z_OG + min(1.95, H_OG - 0.2), 'laubentuer'))
# Traufseiten Wohnteil: Fenster in beiden Geschossen.
for w in ('sued', 'nord'):
    for u in achsen(0.9, LW - 0.9, FA, FB):
        OEFF[w]['eg'].append((u - FB / 2, u + FB / 2, FBR, FBR + FH, 'fenster'))
        OEFF[w]['og'].append((u - FB / 2, u + FB / 2, Z_OG + FBR, Z_OG + FBR + FH, 'fenster'))
    # Stall: kleine Fenster im Wirtschaftsteil, Tennentor auf der Südseite.
    torm = LW + (L - LW) * 0.55
    for u in achsen(LW + 0.8, L - 0.8, 2.6, 0.6):
        if w == 'sued' and abs(u - torm) < TORB / 2 + 0.6:
            continue
        OEFF[w]['eg'].append((u - 0.3, u + 0.3, 1.3, 1.8, 'stall'))
OEFF['sued']['eg'].append((torm - TORB / 2, torm + TORB / 2, 0.0, TORH, 'tor'))
# Hochlaubentür und kleine Giebelfenster im Brettergiebel.
OEFF['giebel']['brett'].append((-0.42, 0.42, Z_T + 0.08, Z_T + min(1.75, (B / 2 - 0.5) * TAN), 'laubentuer'))
for u in (-B * 0.3, B * 0.3):
    OEFF['giebel']['brett'].append((u - 0.25, u + 0.25, Z_T + 0.35, Z_T + 0.8, 'luke'))
    OEFF['rueck']['brett'].append((u - 0.25, u + 0.25, Z_T + 0.35, Z_T + 0.8, 'luke'))

# ───────────────────────────── Ruinenkrone (Stufe 3) ─────────────────────────────
PHASEN = [zr.uniform(0, 2 * math.pi) for _ in range(3)]


def kronenhoehe(u, z_voll, ecken=()):
    """Stufe 3: Mauerkrone als weiches Zufallsprofil; Ecken stehen länger (keine Wand höher als das EG)."""
    if STUFE < 3:
        return z_voll
    welle = (0.5 + 0.22 * math.sin(u * 0.45 + PHASEN[0]) + 0.13 * math.sin(u * 1.3 + PHASEN[1])
             + 0.05 * math.sin(u * 3.1 + PHASEN[2]))
    ecke = max([0.0] + [0.45 * math.exp(-abs(u - e) / 1.4) for e in ecken])
    return z_voll * min(1.0, max(0.18, welle + ecke + zr.uniform(-0.03, 0.03)))


# ───────────────────────────── EG: Sockel und Mauerwerk ─────────────────────────────
def mauer(wname, u0, u1, z0, z1):
    achse, ebene, innen, _, _ = WAENDE[wname]
    oeff = [o[:4] for o in OEFF[wname]['eg'] if u0 - 1e-6 <= (o[0] + o[1]) / 2 <= u1 + 1e-6]
    for ua, ub, za, zb in rechtecke(u0, u1, z0, z1, oeff):
        if STUFE == 3:   # Krone in 0,25-m-Streifen gebrochen
            n = max(1, round((ub - ua) / 0.25))
            for i in range(n):
                a, b = ua + (ub - ua) * i / n, ua + (ub - ua) * (i + 1) / n
                top = min(zb, kronenhoehe((a + b) / 2, z1, (WAENDE[wname][3], WAENDE[wname][4])))
                if top > za + 0.05:
                    wandquader('putz', achse, ebene, innen, a, b, za, top, T_EG)
        else:
            wandquader('putz', achse, ebene, innen, ua, ub, za, zb, T_EG)
    # Feldsteinsockel, 3 cm vor der Putzflucht
    rand = 0.03 if achse == 'x' else 0.0   # Traufseiten-Sockel um die Ecke ziehen, sonst bleibt eine Kerbe
    for ua, ub, za, zb in rechtecke(u0 - rand, u1 + rand, -0.1, SOCKEL, [o for o in oeff if o[2] < SOCKEL]):
        wandquader('stein', achse, ebene, innen, ua, ub, za, zb, T_EG + 0.03, vor=0.03)


mauer('sued', 0, L, 0, H_EG)
mauer('nord', 0, L, 0, H_EG)
mauer('giebel', -B / 2 + T_EG, B / 2 - T_EG, 0, H_EG)
mauer('rueck', -B / 2 + T_EG, B / 2 - T_EG, 0, H_EG)
# Trennwand Wohnteil | Tenne
wandquader('putz', 'y', LW, 1, -B / 2 + T_EG, B / 2 - T_EG, 0, H_EG * (0.4 if STUFE == 3 else 1.0), T_EG * 0.7)
# EG-Decke (von aussen durch die Fenster dunkel)
if STUFE < 3:
    quader_ab('holz_block', (T_EG, -B / 2 + T_EG, H_EG - 0.25), (L - T_EG, B / 2 - T_EG, H_EG), 0.2)


# ───────────────────────────── Fenster, Türen, Läden ─────────────────────────────
def laden(achse, ebene, innen, ua, ub, za, zb, wand_d):
    """Zwei Ladenflügel, aufgeklappt an der Wand; schief oder fehlend nach Verfallsstufe."""
    breite = (ub - ua) / 2 + 0.03
    hoehe = zb - za + 0.06
    for seite, angel in ((-1, ua), (1, ub)):
        if wahr(VERFALL['laeden_fehlen']):
            continue
        schwenk, kipp = 0.0, 0.0
        if wahr(VERFALL['laeden_schief']):
            schwenk = math.radians(zr.uniform(25, 100))    # vom Wind halb zugeschlagen
            kipp = math.radians(abs(zr.uniform(-14, 14))) if wahr(0.5) else 0.0   # obere Angel gebrochen: Flügel dreht um die untere Angel, das freie Ende sinkt (D436)
        # Lokales System des Flügels: Angel ist die Drehachse (z), Flügel liegt flach an der Wand nach aussen.
        richtung = seite                       # entlang u weg von der Öffnung
        unten = Vector((0, 0, -(hoehe / 2 - 0.12)))   # Lage der unteren Angel
        aus = 0.025
        if achse == 'x':
            ang = Vector((angel, ebene - innen * aus, (za + zb) / 2))
            # flach an der Wand: Flügel entlang +u*richtung; Schwenk dreht um z zur Öffnung hin
            winkel = -innen * richtung * schwenk
            M = Matrix.Translation(ang) @ drehung('Z', winkel) @ Matrix.Translation(unten) @ drehung('Y', richtung * kipp) @ Matrix.Translation(-unten) @ Matrix.Translation((richtung * breite / 2, -innen * 0.02, 0))
        else:
            ang = Vector((ebene - innen * aus, angel, (za + zb) / 2))
            winkel = innen * richtung * schwenk
            M = Matrix.Translation(ang) @ drehung('Z', winkel) @ Matrix.Translation(unten) @ drehung('X', -richtung * kipp) @ Matrix.Translation(-unten) @ Matrix.Translation((-innen * 0.02, richtung * breite / 2, 0))
        g = (breite, 0.04, hoehe) if achse == 'x' else (0.04, breite, hoehe)
        quader_m('laeden', M, g)


def fuellung(achse, ebene, innen, o, wand_d, holzwand=False):
    """Fensterstock, Glas, Kreuz, Läden — oder Tür / Tor — in der Öffnung o."""
    ua, ub, za, zb, art = o
    tief = 0.12 if holzwand else min(0.18, wand_d * 0.3)
    ruine = STUFE == 3
    if art in ('fenster', 'stall', 'luke'):
        if ruine:
            return
        r = 0.06
        P = lambda u, z, a: punkt(achse, ebene, u, z, -a, innen)
        # Stock (vier Hölzer) und Glas zurückgesetzt
        for a, b in (((ua, za), (ub, za + r)), ((ua, zb - r), (ub, zb)), ((ua, za), (ua + r, zb)), ((ub - r, za), (ub, zb))):
            p0, p1 = P(a[0], a[1], tief - 0.03), P(b[0], b[1], tief + 0.05)
            quader_ab('rahmen', p0, p1, 0.7)
        verbrettert = STUFE == 0 and art == 'fenster' and wahr(VERFALL['fenster_verbrettert'])
        glas_weg = STUFE >= 1 and wahr(0.25 * STUFE)
        if not glas_weg:
            mk = 'licht' if (STUFE == 0 and art == 'fenster' and not verbrettert and wahr(VERFALL['fenster_licht'])) else 'glas'
            quader_ab(mk, P(ua + r, za + r, tief + 0.01), P(ub - r, zb - r, tief + 0.02), 0.5)
            um = (ua + ub) / 2; zm = za + (zb - za) * 0.62
            quader_ab('rahmen', P(um - 0.025, za + r, tief - 0.01), P(um + 0.025, zb - r, tief + 0.01), 0.7)
            quader_ab('rahmen', P(ua + r, zm - 0.025, tief - 0.01), P(ub - r, zm + 0.025, tief + 0.01), 0.7)
        # dunkler Innenraum hinter der Öffnung, damit der Blick nicht ins Leere geht
        quader_ab('dunkel', P(ua, za, tief + 0.25), P(ub, zb, tief + 0.27), 0.0)
        if verbrettert:
            for k in range(3):
                z = za + (zb - za) * (0.2 + 0.3 * k)
                M = Matrix.Translation(punkt(achse, ebene, (ua + ub) / 2, z, 0.03, innen)) @ drehung('Y' if achse == 'x' else 'X', math.radians(zr.uniform(-12, 12)))
                quader_m('holz_brett', M, (ub - ua + 0.3, 0.03, 0.16) if achse == 'x' else (0.03, ub - ua + 0.3, 0.16))
        elif art == 'fenster':
            laden(achse, ebene, innen, ua, ub, za, zb, wand_d)
    elif art in ('tuer', 'laubentuer', 'tor'):
        P = lambda u, z, a: punkt(achse, ebene, u, z, -a, innen)
        if ruine:
            return
        quader_ab('dunkel', P(ua, za, tief + 0.4), P(ub, zb, tief + 0.42), 0.0)
        if STUFE == 2 and wahr(0.5):
            return
        fluegel = 2 if art == 'tor' else 1
        breite = (ub - ua) / fluegel
        for i in range(fluegel):
            a = ua + i * breite
            offen = STUFE >= 1 and wahr(0.35 + 0.2 * STUFE)
            winkel = math.radians(zr.uniform(15, 70)) * (1 if i == 0 else -1) if offen else 0.0
            angel = a if i == 0 else a + breite
            hoehe = zb - za - 0.02
            # Flügel aus senkrechten Brettern, an der Angel gedreht
            for k in range(max(2, round(breite / BW))):
                bw = breite / max(2, round(breite / BW))
                off = (k + 0.5) * bw * (1 if i == 0 else -1)
                if achse == 'x':
                    M = (Matrix.Translation(P(angel, za + hoehe / 2 + 0.01, tief)) @ drehung('Z', -innen * winkel) @
                         Matrix.Translation((off, 0, 0)))
                    quader_m('holz_brett', M, (bw - 0.008, 0.05, hoehe))
                else:
                    M = (Matrix.Translation(P(angel, za + hoehe / 2 + 0.01, tief)) @ drehung('Z', innen * winkel) @
                         Matrix.Translation((0, off, 0)))
                    quader_m('holz_brett', M, (0.05, bw - 0.008, hoehe))
        # Türstock
        for a, b in (((ua - 0.08, zb), (ub + 0.08, zb + 0.12)), ((ua - 0.08, za), (ua, zb)), ((ub, za), (ub + 0.08, zb))):
            quader_ab('rahmen' if art != 'tor' else 'holz_block', P(a[0], a[1], -0.02), P(b[0], b[1], 0.08), 0.6)


for wname, (achse, ebene, innen, _, _) in WAENDE.items():
    for o in OEFF[wname]['eg']:
        fuellung(achse, ebene, innen, o, T_EG)


# ───────────────────────────── OG: Blockbau ─────────────────────────────
def einrasten(o, z0):
    """Öffnung im Blockbau auf ganze Balkenlagen setzen."""
    za = z0 + math.floor((o[2] - z0) / BH + 1e-6) * BH
    zb = z0 + math.ceil((o[3] - z0) / BH - 1e-6) * BH
    return (o[0], o[1], za, zb, o[4])


def blockwand(wname, u0, u1, versatz, oeff):
    """Balkenlagen von Z_OG bis Z_T; `versatz` verschiebt die Lagen der Querwände um eine halbe Balkenhöhe."""
    achse, ebene, innen, _, _ = WAENDE[wname]
    grenzen = [Z_OG] + [Z_OG + versatz + i * BH for i in range(LAGEN + 1) if Z_OG < Z_OG + versatz + i * BH < Z_T - 1e-4] + [Z_T]
    for unten, oben in zip(grenzen, grenzen[1:]):
        schnitte = [(o[0], o[1], unten, oben) for o in oeff if o[2] < oben - 1e-4 and o[3] > unten + 1e-4]
        for ua, ub, za, zb in rechtecke(u0, u1, unten, oben, schnitte):
            wandquader('holz_block', achse, ebene, innen, ua, ub, za + 0.006, zb - 0.006, BS, vor=zr.uniform(-0.008, 0.012))


if STUFE < 3:
    for w in ('sued', 'nord'):
        oeff = [einrasten(o, Z_OG) for o in OEFF[w]['og']]
        OEFF[w]['og'] = oeff
        blockwand(w, -VK, LW, 0.0, oeff)
    oeff = [einrasten(o, Z_OG + BH / 2) for o in OEFF['giebel']['og']]
    OEFF['giebel']['og'] = oeff
    blockwand('giebel', -B / 2 - VK, B / 2 + VK, BH / 2, oeff)
    # Blockwand zur Tenne (innen, ohne Vorköpfe)
    WAENDE['trenn'] = ('y', LW, -1, -B / 2, B / 2)
    blockwand('trenn', -B / 2 + BS, B / 2 - BS, BH / 2, [])
    for wname in ('sued', 'nord', 'giebel'):
        achse, ebene, innen, _, _ = WAENDE[wname]
        for o in OEFF[wname]['og']:
            fuellung(achse, ebene, innen, o, BS, holzwand=True)


# ───────────────────────────── Bretterschalung (Tenne, Giebel) ─────────────────────────────
def bretter(wname, u0, u1, z0, oben, luecke, oeff, fehlen=0.0):
    """Senkrechte Bretter vor der Wandebene; `oben(u)` gibt die Oberkante."""
    achse, ebene, innen, _, _ = WAENDE[wname]
    n = max(1, round((u1 - u0) / BW))
    bw = (u1 - u0) / n
    for i in range(n):
        a, b = u0 + i * bw + luecke / 2, u0 + (i + 1) * bw - luecke / 2
        top = min(oben(a), oben(b))
        if top <= z0 + 0.05 or wahr(fehlen):
            continue
        t = zr.random()
        for ua, ub, za, zb in rechtecke(a, b, z0, top, [o[:4] for o in oeff]):
            wandquader('holz_brett', achse, ebene, innen, ua, ub, za, zb, BD, ton=t, vor=BD)


def giebel_oben(u):
    return sparren_unten(u) + SH / math.cos(NEIG) - 0.02


if STUFE < 3:
    # Wirtschaftsteil: über dem Stallmauerwerk verbrettert (D289), mit Luftfugen; Riegel dahinter.
    fehl = VERFALL['laubenbretter_fehlen'] * 0.4
    for w in ('sued', 'nord'):
        tor = [o for o in OEFF[w]['eg'] if o[4] == 'tor']
        bretter(w, LW, L, Z_OG, lambda u: Z_T, 0.025, tor, fehl)
        achse, ebene, innen, _, _ = WAENDE[w]
        for z in (Z_OG + 0.1, (Z_OG + Z_T) / 2, Z_T - 0.1):
            for ua, ub, za, zb in rechtecke(LW, L, z - 0.07, z + 0.07, [o[:4] for o in tor]):
                wandquader('holz_block', achse, ebene, innen, ua, ub, za, zb, 0.12)
        for u in [LW + k * (L - LW) / max(1, round((L - LW) / 2.5)) for k in range(round((L - LW) / 2.5) + 1)]:
            if not any(o[0] - 0.1 < u < o[1] + 0.1 for o in tor):
                wandquader('holz_block', achse, ebene, innen, u - 0.1, u + 0.1, Z_OG, Z_T, 0.18)
    bretter('rueck', -B / 2, B / 2, Z_OG, lambda u: Z_T, 0.025, [], fehl)
    wandquader('holz_block', 'y', L, -1, -B / 2, B / 2, Z_OG, Z_T, 0.04)   # Hinterwand gegen Durchblick
    for w in ('sued', 'nord'):
        achse, ebene, innen, _, _ = WAENDE[w]
        wandquader('holz_block', achse, ebene, innen, LW, L, Z_OG, Z_T, 0.04, ton=0.1, vor=-0.2)
    # Giebeldreiecke
    for w in ('giebel', 'rueck'):
        bretter(w, -B / 2, B / 2, Z_T, giebel_oben, 0.012, OEFF[w]['brett'], VERFALL['laubenbretter_fehlen'] * 0.3)
        achse, ebene, innen, _, _ = WAENDE[w]
        for i in range(6):   # dunkle Rückwand in Stufen unter der Dachschräge, gegen Durchblick
            yb = (B / 2 - 0.3) * (1 - i / 6)
            wandquader('dunkel', achse, ebene, innen, -yb, yb, Z_T + (B / 2 - yb) * TAN, Z_T + (B / 2 - yb) * TAN + (B / 2 - 0.3) / 6 * TAN + 0.02,
                       0.02, ton=0.0, vor=-0.35)
        for o in OEFF[w]['brett']:
            fuellung(achse, ebene, innen, o, 0.1, holzwand=True)
    # Giebelbundwerk: sichtbare Ständer, Riegel und Streben vor dem Rückgiebel (nur Zier, kein Fachwerk)
    if BUNDWERK:
        x = L + BD + 0.04
        for y in (-B / 4, 0.0, B / 4):
            top = sparren_unten(y)
            quader_ab('holz_block', (x - 0.06, y - 0.09, Z_T), (x + 0.06, y + 0.09, top), 0.3)
        zr_ = Z_T + (B / 4) * TAN * 0.55
        quader_ab('holz_block', (x - 0.06, -B / 4 - 0.6, zr_ - 0.08), (x + 0.06, B / 4 + 0.6, zr_ + 0.08), 0.3)
        for y0, s in ((-B / 4, 1), (B / 4, -1), (0.0, 1), (0.0, -1)):
            y1 = y0 + s * B / 4 * 0.9
            z0, z1 = Z_T + 0.05, min(sparren_unten(y0), sparren_unten(y1)) - 0.1
            lang = math.hypot(y1 - y0, z1 - z0)
            w = math.atan2(z1 - z0, y1 - y0)
            M = Matrix.Translation((x, (y0 + y1) / 2, (z0 + z1) / 2)) @ drehung('X', w)
            quader_m('holz_block', M, (0.1, lang, 0.14), 0.3)


# ───────────────────────────── Lauben ─────────────────────────────
TRUEMMER = []


def laubenlauf(p0, p1, aussen, z, tiefe, absturz=None):
    """Laube entlang der Aussenkante p0 → p1 (Vektoren auf Bodenhöhe z), `aussen` zeigt vom Haus weg."""
    p0, p1, aussen = Vector(p0), Vector(p1), Vector(aussen)
    p0.z = p1.z = 0.0   # Höhe kommt aus z
    richt = (p1 - p0); laenge = richt.length; richt.normalize()
    entlang_x = abs(richt.x) > 0.5
    gr = lambda l, q, h: (l, q, h) if entlang_x else (q, l, h)
    n_seg = max(1, round(laenge / 1.8))
    weg = set()
    if absturz:   # zusammenhängender Abschnitt abgestürzt
        k = max(1, round(n_seg * absturz))
        s = zr.randrange(0, n_seg - k + 1)
        weg = set(range(s, s + k))
    for i in range(n_seg):
        a, b = i / n_seg * laenge, (i + 1) / n_seg * laenge
        m = p0 + richt * ((a + b) / 2)
        if i in weg:
            for _ in range(4):   # Trümmer unter der Laube
                TRUEMMER.append((m + aussen * zr.uniform(0.2, 1.6) + richt * zr.uniform(-0.9, 0.9), b - a))
            continue
        innenkante = m - aussen * tiefe
        # Boden: Bretter längs, Konsolbalken quer
        for k in range(max(2, round(tiefe / 0.16))):
            q = (k + 0.5) / max(2, round(tiefe / 0.16)) * tiefe
            if wahr(VERFALL['laubenbretter_fehlen'] * 0.5):
                continue
            quader('holz_brett', m - aussen * q + Vector((0, 0, z - 0.025)), gr(b - a - 0.01, 0.15, 0.04))
        for k in (0, 1):
            km = p0 + richt * (a + (b - a) * k)
            quader('holz_block', km - aussen * (tiefe / 2 - 0.12) + Vector((0, 0, z - 0.14)), gr(0.14, tiefe + 0.2, 0.2), 0.4)
        # Säule, Handlauf, Unterholm
        quader('holz_block', p0 + richt * a - aussen * 0.06 + Vector((0, 0, z + BRUEST / 2)), (0.12, 0.12, BRUEST), 0.4)
        quader('holz_block', m - aussen * 0.06 + Vector((0, 0, z + BRUEST - 0.04)), gr(b - a, 0.14, 0.08), 0.4)
        quader('holz_block', m - aussen * 0.06 + Vector((0, 0, z + 0.1)), gr(b - a, 0.1, 0.07), 0.4)
        # ausgesägte Brüstungsbretter: oben und unten voll, in der Mitte tailliert
        nb = max(2, round((b - a) / 0.2))
        for k in range(nb):
            if wahr(VERFALL['laubenbretter_fehlen']):
                continue
            c = p0 + richt * (a + (k + 0.5) / nb * (b - a)) - aussen * 0.06
            h0, h1 = z + 0.13, z + BRUEST - 0.08
            t = zr.random()
            dh = h1 - h0
            for f0, f1, w in ((0.0, 0.32, 0.16), (0.32, 0.48, 0.07), (0.48, 0.62, 0.1), (0.62, 1.0, 0.16)):
                quader('holz_brett', c + Vector((0, 0, h0 + dh * (f0 + f1) / 2)), gr(w, BD, dh * (f1 - f0)), t)
    quader('holz_block', p1 - aussen * 0.06 + Vector((0, 0, z + BRUEST / 2)), (0.12, 0.12, BRUEST), 0.4)


if STUFE < 3:
    d = LAUBE_T
    zl = Z_OG + 0.02
    ab = lambda: VERFALL['laube_abgestuerzt'] if wahr(VERFALL['laube_abgestuerzt']) else None
    laubenlauf((-d, -B / 2 - d, zl), (-d, B / 2 + d, zl), (-1, 0, 0), zl, d, ab())             # Giebelseite
    laubenlauf((-d, -B / 2 - d, zl), (LW - 0.3, -B / 2 - d, zl), (0, -1, 0), zl, d, ab())       # Süd
    laubenlauf((-d, B / 2 + d, zl), (LW - 0.3, B / 2 + d, zl), (0, 1, 0), zl, d, ab())          # Nord
    # Hochlaube im Giebel
    dh = min(0.9, UE_G - 0.5)
    zh = Z_T + 0.06
    laubenlauf((-dh, -HOCH_B / 2, zh), (-dh, HOCH_B / 2, zh), (-1, 0, 0), zh, dh, ab() if STUFE == 2 else None)
    for tm, l in TRUEMMER:
        M = (Matrix.Translation((tm.x, tm.y, 0.06)) @ drehung('Z', zr.uniform(0, math.pi)) @ drehung('X', zr.uniform(-0.4, 0.4)))
        quader_m('holz_brett', M, (min(1.8, l), 0.16, 0.04))


# ───────────────────────────── Dachstuhl und Dachhaut ─────────────────────────────
X0, X1 = -UE_G, L + UE_G
YA = B / 2 + UE_T                  # horizontale Ausladung bis zur Traufkante
VLEN = YA / math.cos(NEIG)        # Länge der Dachfläche vom First zur Traufe
LOCH = None
if STUFE == 2:   # Dach eingesunken: ein elliptisches Loch auf der Sonnenseite, Rand abgesackt
    flaeche = VERFALL['dach_fehlstelle']
    lx = (X1 - X0) * math.sqrt(flaeche) * 1.1
    lv = VLEN * math.sqrt(flaeche) * 1.6
    LOCH = (zr.uniform(X0 + lx / 2 + 1, X1 - lx / 2 - 1), zr.uniform(lv / 2, VLEN - lv / 2), lx / 2, lv / 2)


def dachrahmen(s):
    """Ursprung am First (Unterkante Dachhaut) und Achsen u (x), v (hangab), w (Dachnormale) der Seite s = ±1."""
    v = Vector((0, s * math.cos(NEIG), -math.sin(NEIG)))
    w = Vector((0, s * math.sin(NEIG), math.cos(NEIG)))
    u = Vector((1, 0, 0)) if s > 0 else Vector((-1, 0, 0))
    R = Matrix((u, v, w)).transposed().to_4x4()
    return Vector((0, 0, Z_DACH0)), v, w, R


def im_loch(x, vv, s, rand=1.0):
    if LOCH is None or s > 0:
        return False
    return ((x - LOCH[0]) / (LOCH[2] * rand)) ** 2 + ((vv - LOCH[1]) / (LOCH[3] * rand)) ** 2 < 1


if STUFE < 3:
    # Pfetten: First, Mittel, Fuss — mit Köpfen über den Ortgang hinaus
    for y in (0.0, -B / 4, B / 4, -B / 2 + BS / 2, B / 2 - BS / 2):
        top = sparren_unten(y)
        quader_ab('holz_block', (X0 - 0.22, y - PQ / 2, top - PQ), (X1 + 0.22, y + PQ / 2, top), 0.3)
    # Pfettenträger in der Tenne (Ständer), sonst hängen die Pfetten 20 m frei
    for x in [LW + k * (L - LW) / max(1, round((L - LW) / 4.5)) for k in range(1, round((L - LW) / 4.5))]:
        for y in (0.0, -B / 4, B / 4):
            quader_ab('holz_block', (x - 0.1, y - 0.1, Z_OG), (x + 0.1, y + 0.1, sparren_unten(y) - PQ), 0.3)
    for s in (-1, 1):
        O, v, w, R = dachrahmen(s)
        # Sparren
        n = int((X1 - X0) / SPA)
        for i in range(n + 1):
            x = X0 + 0.06 + i * (X1 - X0 - 0.12) / n
            laenge = VLEN
            gebrochen = False
            if im_loch(x, VLEN / 2, s, 1.0) and wahr(0.35):
                continue
            if im_loch(x, LOCH[1] if LOCH else 0, s, 1.0) and wahr(0.4):
                laenge = LOCH[1] - LOCH[3] * 0.3 + zr.uniform(-0.5, 0.5); gebrochen = True
            M = Matrix.Translation(O + Vector((x, 0, 0)) + v * (laenge / 2) - w * (SH / 2)) @ R
            quader_m('holz_block', M, (SH * 0.7, laenge, SH), 0.35 if not gebrochen else 0.6)
        # Dachhaut in Feldern (Löcher, Absacken); Wohnteil und Wirtschaftsteil getrennt
        nv = max(2, round(VLEN / 1.1))
        for teil, xa, xb in (('wohn', X0, LW), ('wirt', LW, X1)):
            mk = ('blech' if WIRT_BLECH else DECKUNG) if teil == 'wirt' else DECKUNG
            if mk.startswith('ziegel'):
                mk = 'ziegel'
            nx = max(1, round((xb - xa) / 1.2))
            for i in range(nx):
                for j in range(nv):
                    x = xa + (i + 0.5) * (xb - xa) / nx
                    vv = (j + 0.5) * VLEN / nv
                    if im_loch(x, vv, s):
                        continue
                    sack = 0.0
                    if LOCH is not None and s < 0:
                        dist = math.sqrt(((x - LOCH[0]) / (LOCH[2] * 2.2)) ** 2 + ((vv - LOCH[1]) / (LOCH[3] * 2.2)) ** 2)
                        sack = max(0.0, 1 - dist) * 0.45
                    M = Matrix.Translation(O + Vector((x, 0, 0)) + v * vv + w * (DACHD / 2 - sack)) @ R
                    quader_m(mk, M, ((xb - xa) / nx + 0.002, VLEN / nv + 0.002, DACHD))
        # Lattung unter dem Loch sichtbar
        if LOCH is not None and s < 0:
            for k in range(int(LOCH[3] * 2 / 0.35) + 1):
                vv = LOCH[1] - LOCH[3] + k * 0.35
                if wahr(0.5):
                    continue
                M = Matrix.Translation(O + Vector((LOCH[0] + zr.uniform(-0.3, 0.3), 0, 0)) + v * vv + w * 0.015) @ R
                quader_m('holz_brett', M, (LOCH[2] * 2 * zr.uniform(0.5, 1.0), 0.05, 0.03))
        # Ortgang- und Traufbretter
        for x in (X0 - 0.02, X1 + 0.02):
            M = Matrix.Translation(O + Vector((x, 0, 0)) + v * (VLEN / 2) + w * (DACHD / 2 - SH / 2)) @ R
            quader_m('holz_brett', M, (0.04, VLEN + 0.05, SH + DACHD + 0.06), 0.5)
        M = Matrix.Translation(O + Vector(((X0 + X1) / 2, 0, 0)) + v * (VLEN + 0.01) + w * (DACHD / 2 - SH / 2)) @ R
        quader_m('holz_brett', M, (X1 - X0, 0.04, SH + DACHD), 0.5)
        # Schwersteine auf Legschindeln (Bauwelt §A1: „mit Steinen beschwert“)
        if DECKUNG == 'schindel':
            for j in range(1, int(VLEN / 1.3)):
                vv = j * 1.3
                x = X0 + 0.4
                while x < (LW if WIRT_BLECH else X1) - 0.3:
                    if not im_loch(x, vv, s, 1.15):
                        r = zr.uniform(0.06, 0.12)
                        stein('stein', O + Vector((x, 0, 0)) + v * (vv + zr.uniform(-0.1, 0.1)) + w * (DACHD + r * 0.55), r)
                    x += zr.uniform(0.6, 1.2)
        # Wellblechflicken (Stufe 0)
        for _ in range(int(VERFALL['dach_flicken']) if s < 0 else 0):
            x = zr.uniform(X0 + 1.5, X1 - 1.5); vv = zr.uniform(1.0, VLEN - 1.0)
            M = Matrix.Translation(O + Vector((x, 0, 0)) + v * vv + w * (DACHD + 0.02)) @ R @ drehung('Z', zr.uniform(-0.15, 0.15))
            quader_m('wellblech', M, (zr.uniform(1.4, 2.2), zr.uniform(0.9, 1.4), 0.02))
    # Firstabdeckung
    if True:
        quader_ab(DECKUNG if DECKUNG == 'schindel' else 'ziegel', (X0, -0.16, Z_FIRST - 0.08), (LW, 0.16, Z_FIRST + 0.06))
        quader_ab('blech' if WIRT_BLECH else (DECKUNG if DECKUNG == 'schindel' else 'ziegel'), (LW, -0.16, Z_FIRST - 0.08), (X1, 0.16, Z_FIRST + 0.06))


# ───────────────────────────── Umgebung (nicht im GLB) ─────────────────────────────
UMGEBUNG = {'boden', 'rinde', 'laub'}


def birke(x, y, hoehe):
    bm = netz('rinde')
    r = hoehe * 0.012
    erg = bmesh.ops.create_cone(bm, cap_ends=True, segments=7, radius1=r, radius2=r * 0.35, depth=hoehe,
                                matrix=Matrix.Translation((x, y, hoehe / 2)) @ drehung('X', zr.uniform(-0.06, 0.06)))
    for k in range(9):
        z = hoehe * zr.uniform(0.45, 0.97)
        rr = hoehe * zr.uniform(0.06, 0.1)
        stein('laub', (x + zr.uniform(-rr, rr), y + zr.uniform(-rr, rr), z), rr)


if STUFE >= 2:   # Bauwelt: Birken/Holunder im Haus (2), Bäume darin (3)
    if STUFE == 2 and LOCH is not None:   # eine Birke wächst durchs Dachloch
        yl = -min(B / 2 - 1.0, LOCH[1] * math.cos(NEIG) - 0.5)
        birke(LOCH[0], max(-B / 2 + 1.2, yl), Z_FIRST + zr.uniform(1.5, 4.0))
    if STUFE == 3:
        for _ in range(4):
            birke(zr.uniform(1.5, L - 1.5), zr.uniform(-B / 2 + 1.5, B / 2 - 1.5), zr.uniform(6, 12))
    for _ in range(2):   # Anflug an der Südseite
        birke(zr.uniform(0, L), -B / 2 - zr.uniform(2.5, 6.0), zr.uniform(3.5, 7.0))
    for _ in range(4):   # Holunder am Sockel
        stein('laub', (zr.uniform(-1, L), -B / 2 - zr.uniform(0.6, 2.0), 0.35), zr.uniform(0.5, 0.9))
if STUFE == 3:   # Schutt im Inneren
    for _ in range(60):
        stein('stein', (zr.uniform(0.8, L - 0.8), zr.uniform(-B / 2 + 0.8, B / 2 - 0.8), 0.05), zr.uniform(0.12, 0.35))
quader_ab('boden', (-400, -400, -0.2), (L + 400, 400, 0.0), 0.5)


# ───────────────────────────── Materialien (prozedural) ─────────────────────────────
def lin(hexwert):
    """sRGB-Hex → lineares RGBA."""
    c = [int(hexwert[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (1.0,)


FARBE = {k: lin(v['hex']) for k, v in DATEN['farben'].items()}
VG, MOOS = VERFALL['vergrauung'], VERFALL['moos']
VERSATZ = (zr.uniform(0, 100), zr.uniform(0, 100), zr.uniform(0, 100))


class Knoten:
    """Kleiner Baukasten für Shader-Bäume."""

    def __init__(self, name):
        self.m = bpy.data.materials.new(name); self.m.use_nodes = True
        self.nt = self.m.node_tree; self.nt.nodes.clear()
        self.aus = self.nt.nodes.new('ShaderNodeOutputMaterial')
        self.bsdf = self.nt.nodes.new('ShaderNodeBsdfPrincipled')
        self.nt.links.new(self.bsdf.outputs[0], self.aus.inputs['Surface'])

    @staticmethod
    def _sock(seq, schluessel):
        for s in seq:
            if s.identifier == schluessel and s.enabled:
                return s
        for s in seq:
            if s.name == schluessel and s.enabled:
                return s
        return seq[schluessel]

    def n(self, typ, eing=None, **attr):
        k = self.nt.nodes.new(typ)
        for a, w in attr.items():
            setattr(k, a, w)
        for s, w in (eing or {}).items():
            ziel = self._sock(k.inputs, s)
            if isinstance(w, bpy.types.NodeSocket):
                self.nt.links.new(w, ziel)
            else:
                ziel.default_value = w
        return k

    def o(self, k, name=None):
        return k.outputs[0] if name is None else self._sock(k.outputs, name)

    def koord(self, skala=(1, 1, 1)):
        tc = self.n('ShaderNodeTexCoord')
        return self.o(self.n('ShaderNodeMapping', {'Vector': tc.outputs['Object'], 'Location': VERSATZ, 'Scale': skala}))

    def rauschen(self, vek, skala, detail=4.0, rauh=0.55):
        return self.o(self.n('ShaderNodeTexNoise', {'Vector': vek, 'Scale': skala, 'Detail': detail, 'Roughness': rauh}), 'Fac')

    def bereich(self, wert, a, b, c=0.0, d=1.0):
        return self.o(self.n('ShaderNodeMapRange', {'Value': wert, 'From Min': a, 'From Max': b, 'To Min': c, 'To Max': d}), 'Result')

    def _rechne(self, op, a, b):
        k = self.nt.nodes.new('ShaderNodeMath'); k.operation = op
        for i, w in ((0, a), (1, b)):
            if isinstance(w, bpy.types.NodeSocket):
                self.nt.links.new(w, k.inputs[i])
            else:
                k.inputs[i].default_value = w
        return k.outputs[0]

    def misch(self, fak, a, b):
        return self.o(self.n('ShaderNodeMix', {'Factor_Float': fak, 'A_Color': a, 'B_Color': b}, data_type='RGBA'), 'Result_Color')

    def rampe(self, fak, farben):
        k = self.n('ShaderNodeValToRGB', {'Fac': fak})
        el = k.color_ramp.elements
        el[0].position, el[0].color = farben[0]
        el[1].position, el[1].color = farben[-1]
        for p, c in farben[1:-1]:
            e = el.new(p); e.color = c
        return k.outputs['Color']

    def ton(self):
        return self.o(self.n('ShaderNodeAttribute', attribute_name='ton'), 'Fac')

    def normale(self):
        return self.n('ShaderNodeSeparateXYZ', {'Vector': self.n('ShaderNodeNewGeometry').outputs['Normal']})

    def hoehe(self):
        return self.o(self.n('ShaderNodeSeparateXYZ', {'Vector': self.n('ShaderNodeTexCoord').outputs['Object']}), 'Z')

    def fertig(self, farbe, rauh=0.8, metall=0.0, relief=None, staerke=0.3):
        self.nt.links.new(farbe, self._sock(self.bsdf.inputs, 'Base Color'))
        self._sock(self.bsdf.inputs, 'Roughness').default_value = rauh
        self._sock(self.bsdf.inputs, 'Metallic').default_value = metall
        if relief is not None:
            b = self.n('ShaderNodeBump', {'Height': relief, 'Strength': staerke, 'Distance': 0.02})
            self.nt.links.new(b.outputs['Normal'], self._sock(self.bsdf.inputs, 'Normal'))
        self.m['rauh'] = rauh; self.m['metall'] = metall
        return self.m


def dunkler(c, f):
    return tuple(x * f for x in c[:3]) + (1.0,)


def mische_c(a, b, t):
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(3)) + (1.0,)


MOOSGRUEN = lin('#4b5a2b')
DRECK = lin('#6f6656')


def mat_moos(k, farbe, staerke):
    """Moos und Flechten auf nach oben zeigenden Flächen."""
    if staerke <= 0:
        return farbe
    nz = k.o(k.normale(), 'Z')
    flecken = k.bereich(k.rauschen(k.koord(), 0.9, 5), 0.62 - 0.22 * staerke, 0.72 - 0.1 * staerke)
    fak = k._rechne('MULTIPLY', flecken, k.bereich(nz, 0.3, 0.9))
    return k.misch(k._rechne('MULTIPLY', fak, min(1.0, 0.4 + staerke)), farbe, MOOSGRUEN)


MATS = {}
# Putz: gekalkt, wolkig, Feuchte am Sockel, abgeplatzt bis aufs Feldsteinmauerwerk (ab Stufe 2)
k = Knoten('putz')
v = k.koord()
basis = k.rampe(k.rauschen(v, 3.0, 6), [(0.3, dunkler(FARBE['putz'], 0.86)), (0.7, FARBE['putz'])])
feucht = k._rechne('POWER', k.bereich(k.hoehe(), 0.0, 0.8 + 1.4 * MOOS, 1.0, 0.0), 1.6)
f = k.misch(k._rechne('MULTIPLY', feucht, 0.25 + 0.5 * MOOS), basis, DRECK)
schmutz = k.bereich(k.rauschen(k.koord((1, 1, 0.15)), 2.0, 3), 0.45, 0.8, 0, 0.15 + 0.35 * VG)
f = k.misch(schmutz, f, dunkler(DRECK, 0.8))
steine = k.rampe(k.o(k.n('ShaderNodeTexVoronoi', {'Vector': v, 'Scale': 4.5}), 'Distance'),
                 [(0.0, dunkler(FARBE['stein'], 0.6)), (0.25, FARBE['stein']), (0.6, mische_c(FARBE['stein'], FARBE['putz'], 0.3))])
schwelle = {0: 0.95, 1: 0.88, 2: 0.7, 3: 0.42}[STUFE]
ab = k.bereich(k.rauschen(k.koord(), 1.3, 5, 0.6), schwelle, schwelle + 0.03)
MATS['putz'] = k.fertig(k.misch(ab, f, steine), 0.9, relief=k._rechne('ADD', k.rauschen(v, 18, 3), k._rechne('MULTIPLY', ab, -0.6)), staerke=0.25)

k = Knoten('stein')
v = k.koord()
vor_ = k.n('ShaderNodeTexVoronoi', {'Vector': v, 'Scale': 5.0})
c = k.rampe(k.o(vor_, 'Distance'), [(0.0, dunkler(FARBE['stein'], 0.45)), (0.2, dunkler(FARBE['stein'], 0.9)), (0.7, FARBE['stein'])])
c = k.misch(k._rechne('MULTIPLY', k.ton(), 0.35), c, dunkler(FARBE['stein'], 0.7))
MATS['stein'] = k.fertig(mat_moos(k, c, MOOS), 0.85, relief=k.o(vor_, 'Distance'), staerke=0.6)


def holzmaterial(name, skala, grau_extra=0.0):
    k = Knoten(name)
    v = k.koord(skala)
    faser = k.rauschen(v, 2.5, 8, 0.65)
    # sonnenseitig (−y) dunkel nachgedunkelt, Wetterseite und Verfall vergraut (Bauwelt §A1)
    ny = k.o(k.normale(), 'Y')
    grau = k._rechne('ADD', k._rechne('ADD', VG + grau_extra, k._rechne('MULTIPLY', ny, 0.25)),
                     k._rechne('MULTIPLY', k._rechne('SUBTRACT', k.ton(), 0.5), 0.35))
    grau = k._rechne('MINIMUM', k._rechne('MAXIMUM', grau, 0.0), 1.0)
    roh = k.misch(grau, FARBE['holz_sonne'], FARBE['holz_grau'])
    c = k.misch(k.bereich(faser, 0.35, 0.65, 0.0, 0.45), roh, dunkler(FARBE['holz_sonne'], 0.55))
    return k.fertig(mat_moos(k, c, MOOS * 0.4), 0.75 + 0.15 * VG, relief=faser, staerke=0.35)


MATS['holz_block'] = holzmaterial('holz_block', (2, 2, 40))
MATS['holz_brett'] = holzmaterial('holz_brett', (30, 30, 1.5), 0.08)

k = Knoten('rahmen')   # Fensterstock, hell gestrichen, verwittert
abbl = k.bereich(k.rauschen(k.koord(), 6, 4), 0.6 - 0.25 * VG, 0.65 - 0.25 * VG)
MATS['rahmen'] = k.fertig(k.misch(abbl, lin('#d8d2c4'), FARBE['holz_grau']), 0.6)

k = Knoten('laeden')   # grün gestrichen, Farbe blättert mit der Stufe
v = k.koord((30, 30, 1.5))
abbl = k.bereich(k.rauschen(k.koord(), 4, 5), 0.62 - 0.35 * VG, 0.66 - 0.35 * VG)
gruen = k.misch(k._rechne('MULTIPLY', k.ton(), 0.4), FARBE['laeden'], dunkler(FARBE['laeden'], 0.7))
MATS['laeden'] = k.fertig(k.misch(abbl, gruen, FARBE['holz_grau']), 0.65, relief=k.rauschen(v, 3, 6))

for name, hexn in (('ziegel', DECKUNG if DECKUNG.startswith('ziegel') else 'ziegel_rot'), ('schindel', 'schindel')):
    k = Knoten(name)
    v = k.koord()
    if name == 'ziegel':   # Betonstein/Ziegel in Reihen parallel zum First
        z = k.n('ShaderNodeTexBrick', {'Vector': v, 'Scale': 1.0, 'Mortar Size': 0.012, 'Brick Width': 0.3, 'Row Height': 0.36,
                                       'Color1': FARBE[hexn], 'Color2': dunkler(FARBE[hexn], 0.78), 'Mortar': dunkler(FARBE[hexn], 0.4)})
    else:                  # Legschindeln: schmal, lang, unregelmässig
        z = k.n('ShaderNodeTexBrick', {'Vector': k.koord((1, 1, 1)), 'Scale': 1.0, 'Mortar Size': 0.01, 'Brick Width': 0.14, 'Row Height': 0.26,
                                       'Bias': 0.3, 'Color1': FARBE['schindel'], 'Color2': mische_c(FARBE['schindel'], FARBE['holz_grau'], 0.5 + 0.5 * VG),
                                       'Mortar': dunkler(FARBE['schindel'], 0.35)}, offset_frequency=2, squash=1.0)
    c = k.misch(k.bereich(k.rauschen(v, 0.5, 3), 0.4, 0.8, 0, 0.3 + 0.3 * VG), k.o(z, 'Color'), dunkler(DRECK, 0.6))
    MATS[name] = k.fertig(mat_moos(k, c, MOOS), 0.8, relief=k.o(z, 'Fac'), staerke=0.4)

for name, rost in (('blech', 0.25 * VG + 0.05), ('wellblech', 0.55)):
    k = Knoten(name)
    v = k.koord()
    welle = k.o(k.n('ShaderNodeTexWave', {'Vector': v, 'Scale': 18.0, 'Distortion': 0.0}, wave_type='BANDS', bands_direction='X'), 'Fac')
    r = k.bereich(k.rauschen(v, 1.8, 6), 0.65 - 0.4 * rost, 0.75 - 0.4 * rost)
    c = k.misch(r, FARBE['blech'], FARBE['rost'])
    MATS[name] = k.fertig(mat_moos(k, c, MOOS * 0.5), 0.6, metall=0.3, relief=welle, staerke=0.25)

def farbe_fest(k, rgba):
    rgb = k.n('ShaderNodeRGB')
    rgb.outputs[0].default_value = rgba
    return rgb.outputs[0]


k = Knoten('glas')
MATS['glas'] = k.fertig(farbe_fest(k, mische_c(lin('#0b0e10'), lin('#3a3d38'), VG * 0.6)), 0.08 + 0.5 * VG)
k = Knoten('licht')   # Fensterlicht in der Enklave (Glut D134)
MATS['licht'] = k.fertig(farbe_fest(k, lin('#c98a4a')), 0.4)
k._sock(k.bsdf.inputs, 'Emission Color').default_value = (1.0, 0.55, 0.22, 1)
k._sock(k.bsdf.inputs, 'Emission Strength').default_value = 4.0
k = Knoten('dunkel')
MATS['dunkel'] = k.fertig(farbe_fest(k, (0.012, 0.010, 0.008, 1)), 0.9)

k = Knoten('boden')
v = k.koord()
c = k.rampe(k.rauschen(v, 0.35, 6), [(0.3, lin('#3c4523')), (0.55, lin('#57602e')), (0.8, lin('#6c6339'))])
MATS['boden'] = k.fertig(c, 0.95, relief=k.rauschen(v, 25, 3), staerke=0.4)
k = Knoten('rinde')
c = k.misch(k.bereich(k.rauschen(k.koord((6, 6, 1.2)), 3, 3), 0.55, 0.6), lin('#d9d5cb'), lin('#26231f'))
MATS['rinde'] = k.fertig(c, 0.7)
k = Knoten('laub')
MATS['laub'] = k.fertig(k.rampe(k.ton(), [(0.0, lin('#26361a')), (1.0, lin('#3f5424'))]), 0.85, relief=k.rauschen(k.koord(), 9, 4), staerke=0.8)

# ───────────────────────────── Szene ─────────────────────────────
sz = bpy.context.scene
for mk, bm in NETZE.items():
    me = bpy.data.meshes.new(mk)
    bm.to_mesh(me); bm.free()
    me.materials.append(MATS[mk])
    for p in me.polygons:
        p.use_smooth = False
    ob = bpy.data.objects.new(mk, me)
    sz.collection.objects.link(ob)
    ob['umgebung'] = mk in UMGEBUNG

DREIECKE = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in sz.objects if o.type == 'MESH' and not o['umgebung'])

# Dämmerung: tiefe Sonne, Himmel nach derselben Richtung
SONNE_HOEHE, SONNE_AZI = math.radians(6), math.radians(215)
welt = bpy.data.worlds.new('Himmel'); sz.world = welt; welt.use_nodes = True
himmel = welt.node_tree.nodes.new('ShaderNodeTexSky')
himmel.sun_elevation = SONNE_HOEHE
himmel.sun_rotation = SONNE_AZI
himmel.sun_disc = False
welt.node_tree.links.new(himmel.outputs[0], welt.node_tree.nodes['Background'].inputs[0])
welt.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.22
sonne = bpy.data.objects.new('Sonne', bpy.data.lights.new('Sonne', 'SUN')); sz.collection.objects.link(sonne)
sonne.data.energy = 3.6; sonne.data.angle = math.radians(1.5); sonne.data.color = (1.0, 0.66, 0.4)
zu_sonne = Vector((math.sin(SONNE_AZI) * math.cos(SONNE_HOEHE), math.cos(SONNE_AZI) * math.cos(SONNE_HOEHE), math.sin(SONNE_HOEHE)))
sonne.rotation_euler = (-zu_sonne).to_track_quat('-Z', 'Y').to_euler()

# 3/4-Ansicht auf Wohngiebel und Südtraufe
ziel = Vector((L * 0.42, 0, Z_T * 0.55))
azi, hoch = math.radians(-38), math.radians(13)
abstand = 0.95 * L + 1.4 * B
cam = bpy.data.objects.new('Kamera', bpy.data.cameras.new('Kamera')); sz.collection.objects.link(cam); sz.camera = cam
cam.location = ziel + Vector((-math.cos(azi) * math.cos(hoch), math.sin(azi) * math.cos(hoch), math.sin(hoch))) * abstand
cam.rotation_euler = (ziel - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.lens = 35
sz.render.engine = 'CYCLES'; sz.cycles.device = 'CPU'
sz.cycles.samples = int(os.environ.get('HOF_SAMPLES', '64')); sz.cycles.use_denoising = True
sz.render.resolution_x, sz.render.resolution_y = 1280, 720
sz.view_settings.view_transform = 'AgX'; sz.view_settings.exposure = float(os.environ.get('HOF_BELICHTUNG', '0.0'))
sz.render.image_settings.file_format = 'PNG'
pfad = lambda endung: os.path.abspath(os.path.join(AUSGABE, NAME + endung))
sz.render.filepath = pfad('.png')

T_AUFBAU = time.time() - T0
bpy.ops.wm.save_as_mainfile(filepath=pfad('.blend'))
t = time.time()
if os.environ.get('HOF_RENDER', '1') != '0':
    bpy.ops.render.render(write_still=True)
T_RENDER = time.time() - t

# ───────────────────────────── Backen und glTF ─────────────────────────────
# Prozedurale Knoten kennt glTF nicht: je Material die Grundfarbe auf eine UV-Abwicklung backen und als Principled
# mit Bildtextur ausgeben. Normale/Relief wird nicht gebacken (offen, D360).
t = time.time()
BACKGROESSE = int(os.environ.get('HOF_BACKEN', '1024'))
OHNE_BACKEN = {'glas', 'licht', 'dunkel'}
sz.cycles.samples = 4; sz.cycles.use_denoising = False
os.makedirs(pfad('_backen'), exist_ok=True)
export = [o for o in sz.objects if o.type == 'MESH' and not o['umgebung']]
for ob in export:
    mat = ob.data.materials[0]
    if mat.name in OHNE_BACKEN or BACKGROESSE <= 0:
        continue
    for o in sz.objects:
        o.select_set(False)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003)
    bpy.ops.object.mode_set(mode='OBJECT')
    flaeche = sum(p.area for p in ob.data.polygons)
    groesse = BACKGROESSE * (2 if flaeche > 600 else 1)
    bild = bpy.data.images.new(f'{NAME}_{mat.name}', groesse, groesse)
    knoten = mat.node_tree.nodes.new('ShaderNodeTexImage'); knoten.image = bild
    mat.node_tree.nodes.active = knoten
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=4, use_clear=True)
    bild.filepath_raw = os.path.join(pfad('_backen'), f'{mat.name}.png'); bild.file_format = 'PNG'; bild.save()
    # Ausgabematerial: Principled mit der gebackenen Farbe
    neu = bpy.data.materials.new(f'{mat.name}_gltf'); neu.use_nodes = True
    nt = neu.node_tree; p = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bild
    nt.links.new(tex.outputs['Color'], p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = mat.get('rauh', 0.8); p.inputs['Metallic'].default_value = mat.get('metall', 0.0)
    ob.data.materials[0] = neu
T_BACKEN = time.time() - t
t = time.time()
for o in sz.objects:
    o.select_set(o in export)
bpy.ops.export_scene.gltf(filepath=pfad('.glb'), export_format='GLB', use_selection=True, export_apply=True,
                          export_image_format='JPEG', export_jpeg_quality=85, export_yup=True, export_attributes=False)
T_EXPORT = time.time() - t

info = {
    'saat': SAAT, 'stufe': STUFE, 'laenge': round(L, 2), 'breite': round(B, 2), 'wohnteil': LW,
    'dachneigung_grad': round(math.degrees(NEIG), 1), 'traufhoehe': round(Z_T, 2), 'firsthoehe': round(Z_FIRST, 2),
    'deckung': DECKUNG, 'wirtschaftsteil_blech': WIRT_BLECH, 'giebelbundwerk': BUNDWERK, 'dreiecke': DREIECKE,
    'sekunden': {'aufbau': round(T_AUFBAU, 1), 'render': round(T_RENDER, 1), 'backen': round(T_BACKEN, 1),
                 'export': round(T_EXPORT, 1), 'gesamt': round(time.time() - T0, 1)},
    'glb_bytes': os.path.getsize(pfad('.glb')),
}
json.dump(info, open(pfad('_info.json'), 'w'), indent=1, ensure_ascii=False)
print('HOF', json.dumps(info, ensure_ascii=False))
