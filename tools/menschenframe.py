"""
BRACHLAND — Zielbild für die Menschen (D383): Brachgänger, Schmiedin, Zähler vor Mauerwerk im Licht des Haus-Zielbilds
(ADR-0018: Substanz real, Darstellung gemalt; ADR-0004/0007: Mechanik-Vorbild ja, Gestalt fremder Vorbilder nein).
Ein Blender-Render (Cycles, CPU) — nichts davon liegt im Spiel.

    python3 tools/menschenframe.py quellen
    blender --background --factory-startup --python tools/menschenframe.py -- bau <präfix> [breite höhe samples] [kamera,…]
    blender --background --factory-startup --python tools/menschenframe.py -- schatten <präfix> [breite höhe samples] [kamera,…|-]
    blender --background --factory-startup --python tools/menschenframe.py -- vorher <präfix> <held.glb> [breite höhe samples] [kamera,…]
    blender --background --factory-startup --python tools/menschenframe.py -- stil <ein.exr> <aus.png> [breite höhe]
    python3 tools/menschenframe.py blatt <ordner>

`quellen` lädt alles nach `.cache/cc0/menschen/` (nichts davon liegt im Repo): MPFB2 (Add-on GPL-3, Grundnetz CC0),
die MakeHuman-System-Assets (CC0: Haut, Augen, Brauen, Wimpern, Zähne, Haar) und Stoff-/Leder-/Metall-Scans von
Poly Haven (CC0); `herkunft.json` nennt Autoren und Lizenz. MPFB muss einmal in Blender installiert sein (geht headless):
`blender --background --command extension install-file -r user_default -e .cache/cc0/menschen/mpfb/mpfb.zip`.

`bau` erzeugt je Figur einen MakeHuman-Körper (Makro-Ziele Alter/Gewicht/Muskel, Gesichtsziele), stellt ihn über das
Rig `game_engine` in Pose und zieht ihn an. Kleidung ist Geometrie: Hüllen aus den Helfernetzen des Grundkörpers
(`helper-tights`, `helper-skirt`), grösser als der Körper zugeschnitten und per Stoffsimulation auf den Körper
gefallen, während der in die Pose geht — die Falten kommen aus Gewicht und Übermass, nicht aus einer Textur. Was über
der Figur liegt (Wetterfleck, Schürze, Kopftuch, Gugel), fällt in einem zweiten Gang über die fertige Figur.
Nähte, Saum, Schmutz und Abrieb liegen als Attribute aus der Ruhelage am Netz (`ruhe`, `ruhe_n`, `rand`, `abrieb`),
das Gewebe selbst kommt aus Scans. Gürtel, Riemen, Wickel und Schnüre laufen als Umlauf um die fertige Figur (Strahlen
von der Körperachse nach aussen). Licht, Himmel und Stil kommen aus `tools/hausframe.py` (importiert, nicht geändert).
Kameras: `aufstellung`, `paar` (Brachgänger ganz), `brust-<figur>`, `gesicht-<figur>`, `ganz-<figur>`.
`schatten` rendert wie `bau` und danach den Schattenriss (schwarz vor Weiss, 30 m, 235 mm) nach `<präfix>-schatten.png`.
`vorher` stellt die heutigen Spielfiguren (`public/figuren`) in dieselbe Szene, dieselbe Kamera; der Held muss vorher
mit `node tools/menschenframe_entpacken.mjs` entpackt werden (Meshopt).
`blatt` setzt aus den fertigen Bildern das beschriftete Vorher/Nachher und das Schattenriss-Blatt zusammen (Pillow).

Schalter: `MENSCH_NUR=figur,…`, `MENSCH_NEU=figur,…|alle` (neu schneidern statt Zwischenspeicher
`.cache/cc0/menschen/zwischen/`), `MENSCH_SCHNELL=1` (kurze Simulation, grobes Würfeln), `MENSCH_OHNE=kraut,dunst,laube,moos`,
`MENSCH_FEIN` (Unterteilung beim Rendern, Vorgabe 1), `MENSCH_MARKE` (Leuchtstärke der Marke), `HAUS_EV` (Belichtung im Stil).
Der Brachgänger wird immer kurz simuliert (`kurz` in `FIGUREN`): bei der langen Simulation schlägt die Kante des
Wetterflecks vor dem Kinn um. Speicher: 2,6–3,4 GiB bei 1280 × 720; `rendern` bricht unter 3,5 GiB freiem Speicher ab.

Koordinaten: Blender, Z oben; die Figuren schauen nach −Y (linke Seite +X), die Mauer steht bei y = +1,6.
"""
import sys, os, json, math, random, time

HIER = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HIER)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
MODUS = ARGS[0] if ARGS else ''

MPFB_URL = 'https://extensions.blender.org/download/sha256:c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad/add-on-mpfb-v2.0.18.zip'
ASSETS_URL = 'https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip'
SCANS = ['caban', 'rough_linen', 'hessian_380', 'wool_boucle', 'brown_leather', 'fabric_leather_02', 'rusty_metal_02', 'poly_wool_herringbone']
KARTEN = ['Diffuse', 'Displacement', 'Rough', 'nor_gl']


def cache():
    """Nächstes `.cache/cc0` aufwärts — ein Worktree findet so den Cache des Haupt-Repos."""
    if os.environ.get('BRACHLAND_CC0'): return os.environ['BRACHLAND_CC0']
    p = REPO
    while True:
        k = os.path.join(p, '.cache', 'cc0')
        if os.path.isdir(k): return k
        if os.path.dirname(p) == p: raise SystemExit('kein .cache/cc0 gefunden')
        p = os.path.dirname(p)


def quellen():
    import urllib.request, zipfile
    ziel = os.path.join(cache(), 'menschen'); os.makedirs(ziel, exist_ok=True)

    def hole(url):
        return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'blender-skript'}), timeout=120).read()

    def lade(url, pfad):
        """Lädt mit Fortsetzen (Range): der MakeHuman-Spiegel ist langsam und bricht ab."""
        if os.path.exists(pfad): return 0
        os.makedirs(os.path.dirname(pfad), exist_ok=True)
        teil = pfad + '.teil'
        for _ in range(40):
            da = os.path.getsize(teil) if os.path.exists(teil) else 0
            req = urllib.request.Request(url, headers={'User-Agent': 'blender-skript', 'Range': 'bytes=%d-' % da})
            try:
                with urllib.request.urlopen(req, timeout=120) as r, open(teil, 'ab' if r.status == 206 else 'wb') as f:
                    while True:
                        b = r.read(1 << 20)
                        if not b: break
                        f.write(b)
                break
            except urllib.error.HTTPError as e:
                if e.code == 416: break
                print('Abbruch, setze fort:', e)
            except Exception as e:
                print('Abbruch, setze fort:', e)
        os.replace(teil, pfad)
        return os.path.getsize(pfad)

    herkunft = {
        'mpfb': {'lizenz': 'Add-on GPL-3.0-or-later; Grundnetz, Ziele, Rig und Ausgabe CC0 (MakeHuman-Team)', 'quelle': 'https://extensions.blender.org/add-ons/mpfb/', 'version': '2.0.18'},
        'makehuman_system_assets': {'lizenz': 'CC0', 'autoren': ['MakeHuman-Team'], 'quelle': 'https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html'},
    }
    print('MPFB', lade(MPFB_URL, os.path.join(ziel, 'mpfb', 'mpfb.zip')))
    z = os.path.join(ziel, 'sysassets.zip'); print('System-Assets', lade(ASSETS_URL, z))
    aus = os.path.join(ziel, 'sysassets')
    if not os.path.isdir(aus):
        with zipfile.ZipFile(z) as zf:
            for n in zf.namelist():
                if n.split('/')[0] in ('skins', 'eyes', 'eyebrows', 'eyelashes', 'teeth', 'hair', 'tongue', 'clothes'): zf.extract(n, aus)
    for name in SCANS:
        info = json.loads(hole('https://api.polyhaven.com/info/' + name)); dateien = json.loads(hole('https://api.polyhaven.com/files/' + name))
        for k in KARTEN:
            if k not in dateien: continue
            url = dateien[k]['2k']['jpg']['url']
            lade(url, os.path.join(ziel, name, os.path.basename(url)))
        herkunft[name] = {'autoren': list(info.get('authors', {}).keys()), 'lizenz': 'CC0', 'mass_mm': info.get('dimensions'), 'quelle': 'https://polyhaven.com/a/' + name}
        print(name, herkunft[name]['autoren'])
    with open(os.path.join(ziel, 'herkunft.json'), 'w') as f: json.dump(herkunft, f, ensure_ascii=False, indent=1)
    print('fertig →', ziel)


def blatt():
    """Beschriftete Blätter aus den fertigen Bildern in ARGS[1]: `d383-vorher-nachher.png` (heutige Figur │ Zielbild, gleiche
    Kamera, gleiches Licht — oben der Held, unten die Aufstellung) und `d383-schattenriss.png` (gross und im Mass von 30 m)."""
    from PIL import Image, ImageDraw, ImageFont
    o = ARGS[1]
    def schrift(g):
        try: return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', g)
        except Exception: return ImageFont.load_default()
    def lade(n, b=960): im = Image.open(os.path.join(o, n)).convert('RGB'); return im.resize((b, b * im.height // im.width), Image.LANCZOS)
    paare = [('d383-vorher-held.png', 'd383-nachher-brachgaenger.png', 'Vorher: heutige Spielfigur (public/figuren/held/m-waldlaeufer.glb)', 'Zielbild D383: der Brachgänger'),
             ('d383-vorher-aufstellung.png', 'd383-zielbild-menschen.png', 'Vorher: Held, Werkfrau, Alte (public/figuren)', 'Zielbild D383: Schmiedin, Brachgänger, Zähler')]
    paare = [p_ for p_ in paare if all(os.path.exists(os.path.join(o, n)) for n in p_[:2])]
    if paare:
        bilder = [(lade(a), lade(b), ta, tb) for a, b, ta, tb in paare]; h = bilder[0][0].height; kopf = 40; fuss = 34
        bl = Image.new('RGB', (1920 + 6, len(bilder) * (h + kopf) + fuss), (18, 16, 14)); d = ImageDraw.Draw(bl)
        for i, (a, b, ta, tb) in enumerate(bilder):
            y = i * (h + kopf); bl.paste(a, (0, y + kopf)); bl.paste(b, (966, y + kopf))
            d.text((12, y + 9), ta, font=schrift(21), fill=(230, 222, 205)); d.text((978, y + 9), tb, font=schrift(21), fill=(230, 222, 205))
        d.text((12, bl.height - fuss + 6), 'Gleiche Kamera, gleiches Licht, Blender-Render (Cycles, CPU) mit gemalter Darstellung — kein Spielbild, keine Look-Abnahme am Zielgerät.',
               font=schrift(17), fill=(170, 160, 140))
        bl.save(os.path.join(o, 'd383-vorher-nachher.png')); print('Blatt', bl.size)
    sp = os.path.join(o, 'd383-schatten-roh.png')
    if os.path.exists(sp):
        im = Image.open(sp).convert('RGB'); b_, h_ = im.size
        px_m = h_ / (2 * 30.0 * (36.0 * h_ / b_ / 2) / 235.0)            # Pixel je Meter im Schattenriss (Kamera 235 mm aus 30 m)
        ziel = 720 / (2 * 30.0 * math.tan(math.radians(25)))             # Pixel je Meter im Spiel: 720p, 50° Blickwinkel, 30 m
        klein = im.resize((max(1, round(b_ * ziel / px_m)), max(1, round(h_ * ziel / px_m))), Image.LANCZOS)
        bl = Image.new('RGB', (b_, h_ + 60 + klein.height + 70), (255, 255, 255)); d = ImageDraw.Draw(bl)
        d.text((14, 10), 'Schattenriss D383: Schmiedin · Brachgänger · Zähler', font=schrift(24), fill=(0, 0, 0)); bl.paste(im, (0, 50))
        d.text((14, h_ + 58), 'Im Mass von 30 m (720p, 50° Blickwinkel: 1,80 m ≈ %d px), unvergrössert:' % round(1.8 * ziel), font=schrift(18), fill=(0, 0, 0))
        bl.paste(klein, (14, h_ + 90)); gross = klein.resize((klein.width * 3, klein.height * 3), Image.NEAREST)
        if 14 + klein.width + 40 + gross.width < b_ and gross.height <= klein.height + 60:
            bl.paste(gross, (14 + klein.width + 40, h_ + 90))
        bl.save(os.path.join(o, 'd383-schattenriss.png')); print('Schattenriss', bl.size)


if __name__ == '__main__' and MODUS == 'quellen':
    quellen(); sys.exit(0)
if __name__ == '__main__' and MODUS == 'blatt':
    blatt(); sys.exit(0)


# ═════════════════════════════ ab hier Blender ═════════════════════════════
if MODUS in ('bau', 'vorher', 'stil', 'schatten'):
    import bpy, bmesh
    import numpy as np
    from mathutils import Vector, Matrix, Euler, Quaternion
    from mathutils.bvhtree import BVHTree
    sys.path.insert(0, HIER)
    import hausframe as hf
    K, neues_material, abschluss = hf.K, hf.neues_material, hf.abschluss

SIGNAL = (0.62, 0.81, 0.89)                     # '#cfe9f2' linear — einziger Akzent: die Marke
SAAT = int(os.environ.get('MENSCH_SAAT', '383'))
SCHNELL = os.environ.get('MENSCH_SCHNELL') == '1'
KURZ = SCHNELL                                  # kurze Stoffsimulation (30 Bilder, Güte 5); je Figur über `kurz` erzwungen
OHNE = set(os.environ.get('MENSCH_OHNE', '').split(','))   # Prüfläufe: kraut, dunst
SONNE_EL, SONNE_AZ = 15.0, 248.0                # tief von links, leicht von vorn: Streiflicht über die Mauer, Gesichter im Dreiviertellicht
MAUER_Y = 1.6
PLATZ = {'brachgaenger': (-0.15, -0.25), 'schmiedin': (-1.55, 0.25), 'zaehler': (1.30, 0.20)}   # Standorte (x, y)
GROESSE = {'brachgaenger': 1.80, 'schmiedin': 1.67, 'zaehler': 1.74}                            # content/massstab.json `figur`: 1,60–1,95 m


def mscan(name, karte):
    """Scan aus `.cache/cc0/menschen/<name>` oder (über hausframe) aus dem Haus-Zielbild."""
    o = os.path.join(cache(), 'menschen', name)
    if os.path.isdir(o):
        for f in sorted(os.listdir(o)):
            if f.startswith((name + '_' + karte, name + '_' + {'diff': 'albedo'}.get(karte, karte))) and f.endswith('.jpg'): return os.path.join(o, f)
        raise SystemExit('Karte fehlt: %s %s — python3 tools/menschenframe.py quellen' % (name, karte))
    return hf.scan(name, karte)


def leeren():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    for c in list(bpy.data.collections): bpy.data.collections.remove(c)


def aktiv(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o


def mat_flaeche(name, scan_name, mass, versatz, tonung=(1, 1, 1), bump=0.5, dunkel=1.0):
    """Mauer/Boden: Scan in Objektkoordinaten (Box), echte Verschiebung."""
    m, k, b, out = neues_material(name)
    v = k.abbild(k.n('ShaderNodeTexCoord').outputs['Object'], (1 / mass,) * 3)
    farbe = k.mix(1.0, k.farbton(k.tex(v, mscan(scan_name, 'diff')), dunkel, 0.9), tonung, 'MULTIPLY')
    abschluss(k, b, out, farbe, k.tex(v, mscan(scan_name, 'rough'), False), k.tex(v, mscan(scan_name, 'disp'), False), versatz, bump)
    return m


def gitter(name, ecke, u, v, nu, nv):
    """Ebenes Gitter aus Ecke und zwei Kantenvektoren."""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    vs = [[bm.verts.new(Vector(ecke) + Vector(u) * (i / nu) + Vector(v) * (j / nv)) for i in range(nu + 1)] for j in range(nv + 1)]
    for j in range(nv):
        for i in range(nu): bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    return o


def szene(rnd):
    """Hofraum: Bruchsteinmauer mit abgeplatztem Putz, gestampfter Boden mit Laub, Kraut am Mauerfuss, ein Pfosten als
    dunkler Rahmen. Licht und Himmel aus dem Haus-Zielbild, Sonne gedreht (`SONNE_AZ`)."""
    hf.SONNE_EL, hf.SONNE_AZ = SONNE_EL, SONNE_AZ
    hf.himmel()
    mauer = gitter('Mauer', (-9, MAUER_Y, -0.3), (18, 0, 0), (0, 0, 4.6), 90, 23)
    mauer.data.materials.append(mat_flaeche('Mauer', 'plaster_stone_wall_02', 2.12, 0.07, (0.50, 0.46, 0.41)))
    hf.adaptiv(mauer, 3.0, True)
    boden = gitter('Boden', (-12, -14, 0), (24, 0, 0), (0, 14 + MAUER_Y + 0.2, 0), 80, 52)
    boden.data.materials.append(mat_flaeche('Boden', 'brown_mud_leaves_01', 1.6, 0.05, (0.62, 0.57, 0.50)))
    hf.adaptiv(boden, 3.0, True)
    # zwei Bretter lehnen rechts an der Mauer; das Holz trägt auch die Laube
    mh, k, b, out = neues_material('Pfosten')
    v = k.abbild(k.n('ShaderNodeTexCoord').outputs['Object'], (1.4, 1.4, 0.35))
    abschluss(k, b, out, k.mix(1.0, k.farbton(k.tex(v, hf.scan('moss_wood', 'diff')), 1.0, 0.35), (0.30, 0.24, 0.19), 'MULTIPLY'), 0.85, k.tex(v, hf.scan('moss_wood', 'disp'), False), 0.012, 0.6)
    for ort, mass, rot in (((3.25, 1.30, 1.15), (0.17, 0.045, 2.5), (0.22, 0.04, 0.1)), ((3.50, 1.26, 1.0), (0.21, 0.045, 2.2), (0.26, -0.03, 0.0))):
        bpy.ops.mesh.primitive_cube_add(size=1, location=ort); o = bpy.context.object; o.scale = mass; o.rotation_euler = rot
        bpy.ops.object.transform_apply(scale=True); o.data.materials.append(mh); hf.adaptiv(o, 3.0)
    if 'kraut' not in OHNE:
        for name, n, hoehen, streifen in (('nettle_plant', 16, (0.5, 1.05), (0.15, 0.55)), ('weed_plant_02', 12, (0.25, 0.5), (0.1, 1.0)), ('grass_medium_01', 46, (0.15, 0.4), (0.05, 1.6))):
            ms = hf.scan_modelle(name)
            for i in range(n):
                x = rnd.uniform(-6.5, 6.5)
                y = MAUER_Y - rnd.uniform(*streifen)
                if any(abs(x - p[0]) < 0.6 and abs(y - p[1]) < 0.9 for p in PLATZ.values()): continue
                hf.setze(rnd.choice(ms), name, (x, y, 0.0), rnd.uniform(*hoehen), rnd=rnd, kipp=0.12)
    # Laube über dem Hofraum (wie am Hof des Haus-Zielbilds): ihr Schatten legt die Mauer ab Schulterhöhe ins Dunkel, die
    # Figuren stehen davor im Streiflicht — helle Köpfe vor dunkler Wand (Regel 1), Balkenschatten als Rhythmus.
    if 'laube' not in OHNE:
        tiefe, hoehe = 1.55, 2.42
        teile = [((0.0, MAUER_Y - tiefe / 2, hoehe + 0.04), (18.0, tiefe, 0.05), (0, 0, 0))]
        for i in range(-6, 7): teile.append(((i * 1.42 + 0.35, MAUER_Y - tiefe / 2 - 0.06, hoehe - 0.07), (0.15, tiefe + 0.14, 0.17), (0, 0, 0)))
        teile.append(((0.0, MAUER_Y - tiefe - 0.02, hoehe + 0.42), (18.0, 0.05, 0.75), (0.04, 0, 0)))      # Brüstung
        for ort, mass, rot in teile:
            bpy.ops.mesh.primitive_cube_add(size=1, location=ort); o = bpy.context.object; o.name = 'Laube'; o.scale = mass; o.rotation_euler = rot
            bpy.ops.object.transform_apply(scale=True); o.data.materials.append(mh)
    if 'dunst' not in OHNE:
        hf.dunst('Hofdunst', (0.0, -4.0), 40.0, -0.5, 9.0, 0.012, 6.0, (1.0, 0.88, 0.70), 0.55)


def kameras():
    k = {}
    k['aufstellung'] = hf.kamera('aufstellung', (-0.95, -6.9, 1.32), (-0.12, 0.0, 1.02), 58)
    bx, by = PLATZ['brachgaenger']
    k['paar'] = hf.kamera('paar', (bx - 1.5, by - 4.6, 1.35), (bx, by, 0.98), 50)
    for name, (x, y) in PLATZ.items():
        h = GROESSE[name] - 0.13
        k['brust-' + name] = c = hf.kamera('brust-' + name, (x - 0.75, y - 1.9, h + 0.02), (x, y, h - 0.10), 85)
        c.data.dof.use_dof = True; c.data.dof.focus_distance = 2.0; c.data.dof.aperture_fstop = 4.0
    for name, (x, y) in PLATZ.items():
        h = GROESSE[name] - 0.115
        k['gesicht-' + name] = hf.kamera('gesicht-' + name, (x - 0.42, y - 1.15, h + 0.0), (x, y - 0.03, h), 110)
    for name, (x, y) in PLATZ.items():
        k['ganz-' + name] = hf.kamera('ganz-' + name, (x - 1.1, y - 3.9, 1.25), (x, y, 0.96), 50)
    k['schatten'] = hf.kamera('schatten', (-0.12, -30.0, 1.2), (-0.12, 0.0, 1.2), 235)
    return k


def render_einstellungen(breite, hoehe, samples):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
    sc.cycles.samples = samples; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 3; sc.cycles.glossy_bounces = 2
    sc.cycles.transmission_bounces = 4; sc.cycles.volume_bounces = 0; sc.cycles.transparent_max_bounces = 32
    sc.cycles.sample_clamp_indirect = 4.0; sc.cycles.caustics_reflective = sc.cycles.caustics_refractive = False
    sc.cycles.volume_step_rate = 4.0; sc.cycles.volume_max_steps = 64
    sc.cycles.dicing_rate = 1.5 if SCHNELL else 1.0; sc.cycles.offscreen_dicing_scale = 16.0; sc.cycles.max_subdivisions = 8
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = breite, hoehe, 100
    sc.view_settings.view_transform = 'AgX'
    try: sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    vl = sc.view_layers[0]
    vl.use_pass_z = vl.use_pass_normal = vl.use_pass_mist = vl.use_pass_object_index = vl.use_pass_position = True
    sc.world.mist_settings.start = 9.0; sc.world.mist_settings.depth = 60.0; sc.world.mist_settings.falloff = 'LINEAR'
    try: sc.render.image_settings.media_type = 'MULTI_LAYER_IMAGE'
    except Exception as e: print('media_type', e)
    sc.render.image_settings.file_format = 'OPEN_EXR_MULTILAYER'; sc.render.image_settings.color_depth = '16'


def rendern(praefix, kam, namen):
    sc = bpy.context.scene
    for name in namen:
        if int(open('/proc/meminfo').read().split('MemAvailable:')[1].split()[0]) < 3.5 * 2 ** 20:
            raise SystemExit('MENSCHENFRAME zu wenig freier Speicher (< 3,5 GiB) — nicht gerendert')
        sc.camera = kam[name]; sc.cycles.dicing_camera = kam[name]
        sc.render.filepath = os.path.abspath('%s-%s.exr' % (praefix, name))
        t1 = time.time(); bpy.ops.render.render(write_still=True)
        print('MENSCHENFRAME %s Renderzeit %.0f s, %s → %s' % (name, time.time() - t1, hf.speicher(), sc.render.filepath))


# ───────────────────────────── Vorher: die heutigen Spielfiguren ─────────────────────────────
def vorher():
    """Held (`public/figuren/held/m-waldlaeufer.glb`, mit `menschenframe_entpacken.mjs` entpackt → ARGS[2]) und zwei
    Bewohner (`werkfrau`, `alte`) an den Plätzen der neuen Figuren, Ruhepose, gleiche Kameras, gleiches Licht."""
    praefix, held = ARGS[1], ARGS[2]
    breite, hoehe, samples = (int(ARGS[3]), int(ARGS[4]), int(ARGS[5])) if len(ARGS) > 5 else (1280, 720, 64)
    namen = (ARGS[6] if len(ARGS) > 6 else 'aufstellung,paar').split(',')
    rnd = random.Random(SAAT); leeren(); szene(rnd)
    for pfad, platz, ziel in ((held, 'brachgaenger', 1.80), (os.path.join(REPO, 'public/figuren/werkfrau.glb'), 'schmiedin', 1.67), (os.path.join(REPO, 'public/figuren/alte.glb'), 'zaehler', 1.62)):
        vor = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=pfad)
        neu = [o for o in bpy.data.objects if o not in vor]
        for o in neu:
            if o.type != 'MESH': continue
            if o.name.startswith(('Hair_', 'Haar_')) and 'SimpleParted' not in o.name and 'Beard' not in o.name: o.hide_render = True
            for m in o.data.materials:   # Bewohner tragen ihre Farbe am Vertex (COLOR_0); das Spiel legt sie im Shader an
                if m and m.use_nodes and o.data.color_attributes and not any(n.type == 'TEX_IMAGE' for n in m.node_tree.nodes):
                    b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                    if b and not b.inputs['Base Color'].is_linked:
                        a = m.node_tree.nodes.new('ShaderNodeVertexColor'); a.layer_name = o.data.color_attributes[0].name
                        m.node_tree.links.new(a.outputs['Color'], b.inputs['Base Color'])
        for rig in [o for o in neu if o.type == 'ARMATURE' and 'upperarm_l' in o.pose.bones]:   # der Held kommt in T-Pose, seine Clips liegen in einer eigenen Datei
            for kn in ('upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r'):
                bpy.context.view_layer.update(); seite = 1.0 if (rig.matrix_world @ rig.pose.bones[kn].head).x > (rig.matrix_world @ rig.pose.bones['pelvis'].head).x else -1.0
                richte(rig, kn, (seite * (0.22 if 'upper' in kn else 0.10), -0.02 if 'upper' in kn else -0.25, -1.0))
        wurzeln = [o for o in neu if o.parent is None]

        def kasten():   # ausgewertete Netze: die Hüllkästen der Skin-Netze stimmen ohne Pose nicht
            dg = bpy.context.evaluated_depsgraph_get(); dg.update(); ps = []
            for o in neu:
                if o.type != 'MESH' or o.hide_render or o.find_armature() is None: continue   # ohne die Knochenform-Kugel des Importers
                oe = o.evaluated_get(dg); ps += [oe.matrix_world @ v.co for v in oe.data.vertices]
            ps = np.array(ps); return ps.min(0), ps.max(0)
        halter = bpy.data.objects.new('Vorher_' + platz, None); bpy.context.scene.collection.objects.link(halter)
        for w in wurzeln: w.parent = halter
        lo, hi = kasten(); s = ziel / (hi[2] - lo[2])
        halter.scale = (s, s, s)   # glTF schaut nach +Y: um 180° drehen, damit die Figur wie die neuen zur Kamera steht
        halter.rotation_euler.z = math.radians(180 + {'brachgaenger': 0, 'schmiedin': 18, 'zaehler': -20}[platz] + float(os.environ.get('MENSCH_DREH', '0')))
        lo, hi = kasten()
        halter.location = (PLATZ[platz][0] - (lo[0] + hi[0]) / 2, PLATZ[platz][1] - (lo[1] + hi[1]) / 2, -lo[2])
        tri = sum(len(p.vertices) - 2 for o in neu if o.type == 'MESH' and not o.hide_render for p in o.data.polygons)
        print('MENSCHENFRAME vorher %s: %d Dreiecke, %.2f m' % (os.path.basename(pfad), tri, ziel))
    kam = kameras(); render_einstellungen(breite, hoehe, samples); rendern(praefix, kam, namen)


# ───────────────────────────── Körper (MPFB2 / MakeHuman, CC0) ─────────────────────────────
def mpfb():
    import addon_utils
    if not addon_utils.enable('bl_ext.user_default.mpfb', default_set=True, persistent=True):
        raise SystemExit('MPFB fehlt — siehe Kopf dieser Datei (extension install-file)')
    from bl_ext.user_default.mpfb.services.humanservice import HumanService
    from bl_ext.user_default.mpfb.services.targetservice import TargetService
    return HumanService, TargetService


def asset(art, name):
    o = os.path.join(cache(), 'menschen', 'sysassets', art, name)
    return os.path.join(o, next(f for f in sorted(os.listdir(o)) if f.endswith('.mhclo')))


def koord(o):
    co = np.zeros(len(o.data.vertices) * 3, np.float32); o.data.vertices.foreach_get('co', co)
    return co.reshape(-1, 3)


def gruppe(o, name):
    """Indizes der Vertices einer Vertexgruppe."""
    gi = o.vertex_groups[name].index
    return np.array([v.index for v in o.data.vertices if any(g.group == gi and g.weight > 0.01 for g in v.groups)], np.int64)


def koerper(name, makro, ziele, groesse, zutaten):
    """MakeHuman-Grundnetz mit Makrozielen (Geschlecht, Alter, Muskel, Gewicht) und Einzelzielen fürs Gesicht, auf
    `groesse` skaliert, Rig `game_engine` (Knochennamen wie das heutige Heldenskelett), Augen/Brauen/Wimpern/Zähne."""
    HS, TS = mpfb()
    m = TS.get_default_macro_info_dict(); m.update({k: v for k, v in makro.items() if k != 'race'}); m['race'] = {'asian': 0.0, 'caucasian': 1.0, 'african': 0.0}
    b = HS.create_human(mask_helpers=False, detailed_helpers=True, extra_vertex_groups=True, feet_on_ground=True, scale=0.1, macro_detail_dict=m)
    b.name = name
    wurzel = os.path.join(os.path.dirname(sys.modules[HS.__module__].__file__), '..', 'data', 'targets')
    for z, w in ziele.items():
        for seite in (('l-', 'r-') if z.startswith('*') else ('',)):
            n = seite + z.lstrip('*')
            pfad = sorted((os.path.join(d, n + '.target.gz') for d, _, fs in os.walk(wurzel) if n + '.target.gz' in fs), key=lambda q: 'caucasian' not in q)[0]
            TS.load_target(b, pfad, weight=w)
    TS.bake_targets(b)
    co = koord(b); koerper_i = gruppe(b, 'body')
    z0, z1 = co[koerper_i, 2].min(), co[koerper_i, 2].max(); s = groesse / (z1 - z0)
    b.data.transform(Matrix.Scale(s, 4) @ Matrix.Translation((0, 0, -z0)))
    HS.add_builtin_rig(b, 'game_engine', import_weights=True)
    rig = b.parent
    teile = {}
    for art, n in zutaten.items():
        vor = set(bpy.data.objects)
        HS.add_mhclo_asset(asset(art, n), b, asset_type={'eyes': 'Eyes', 'eyebrows': 'Eyebrows', 'eyelashes': 'Eyelashes', 'teeth': 'Teeth', 'hair': 'Hair', 'tongue': 'Tongue', 'clothes': 'Clothes'}[art],
                           subdiv_levels=0, material_type='MAKESKIN')
        teile[art] = next(o for o in bpy.data.objects if o not in vor and o.type == 'MESH')
    print('MENSCHENFRAME %s: Körper %.2f m, %d Vertices im Grundnetz' % (name, groesse, len(b.data.vertices)))
    return b, rig, teile


def drehe(rig, knochen, achse, grad):
    """Dreht einen Posenknochen um eine Weltachse durch seinen Kopf. Reihenfolge: Eltern zuerst.
    Die Figur schaut nach −Y, ihre linke Seite ist +X."""
    pb = rig.pose.bones[knochen]; bpy.context.view_layer.update()
    M = rig.matrix_world @ pb.matrix; kopf = M.translation.copy()
    a = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}[achse] if isinstance(achse, str) else Vector(achse).normalized()
    pb.matrix = rig.matrix_world.inverted() @ (Matrix.Translation(kopf) @ Matrix.Rotation(math.radians(grad), 4, a) @ Matrix.Translation(-kopf) @ M)
    bpy.context.view_layer.update()


def richte(rig, knochen, richtung, roll=0.0):
    """Richtet einen Posenknochen (Kopf → Ende) auf eine Weltrichtung aus, kürzeste Drehung; `roll` dreht um die eigene Achse."""
    pb = rig.pose.bones[knochen]; bpy.context.view_layer.update()
    M = rig.matrix_world @ pb.matrix; kopf = M.translation.copy()
    y = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
    R = y.rotation_difference(Vector(richtung).normalized()).to_matrix().to_4x4()
    pb.matrix = rig.matrix_world.inverted() @ (Matrix.Translation(kopf) @ R @ Matrix.Translation(-kopf) @ M @ Matrix.Rotation(math.radians(roll), 4, 'Y'))
    bpy.context.view_layer.update()


FINGER = ('index', 'middle', 'ring', 'pinky')


def pose(rig, schritte, bild0=1, bild1=24):
    """Ruhelage auf `bild0`, Pose auf `bild1` — die Stoffsimulation läuft dazwischen mit. Schritte, Eltern zuerst:
    (Knochen, 'X'|'Y'|'Z', Grad) dreht um eine Weltachse, (Knochen, (x, y, z)[, Roll]) richtet aus,
    ('faust_l'|'faust_r', Grad[, Daumen]) krümmt die Finger um ihre lokale Beugeachse."""
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'; pb.keyframe_insert('rotation_quaternion', frame=bild0); pb.keyframe_insert('location', frame=bild0)
    bpy.context.scene.frame_set(bild1)
    for s in schritte:
        if s[0].startswith('faust_'):
            seite = s[0][-1]
            for f in FINGER:
                for i in (1, 2, 3):
                    pb = rig.pose.bones['%s_%02d_%s' % (f, i, seite)]
                    pb.rotation_quaternion = pb.rotation_quaternion @ Quaternion((1, 0, 0), math.radians(-s[1] * (0.9 if i == 1 else 1.0)))
            for i in (2, 3):
                pb = rig.pose.bones['thumb_%02d_%s' % (i, seite)]
                pb.rotation_quaternion = pb.rotation_quaternion @ Quaternion((1, 0, 0), math.radians(-(s[2] if len(s) > 2 else s[1] * 0.5)))
            bpy.context.view_layer.update()
        elif isinstance(s[1], str): drehe(rig, s[0], s[1], s[2])
        else: richte(rig, s[0], s[1], s[2] if len(s) > 2 else 0.0)
    for pb in rig.pose.bones:
        pb.keyframe_insert('rotation_quaternion', frame=bild1); pb.keyframe_insert('location', frame=bild1)
    bpy.context.scene.frame_set(bild0)


def gelenke(rig):
    """Weltlage der Knochenköpfe in der aktuellen Pose."""
    bpy.context.view_layer.update()
    return {pb.name: (rig.matrix_world @ pb.head).copy() for pb in rig.pose.bones} | {pb.name + '.ende': (rig.matrix_world @ pb.tail).copy() for pb in rig.pose.bones}


def mat_haut(name, textur, ton=(0.84, 0.78, 0.73), wetter=0.35, schmutz=0.25, bart=0.0, leder=0.25, falten=0.0):
    """Haut: MakeHuman-Farbkarte, Streuung unter der Oberfläche, Rauheit und feines Relief aus der Karte selbst.
    Wetter: gerötet und gebräunt, wo Rauschen und Karte es zulassen; Schmutz in grossen Flecken. Kein Porenrauschen."""
    m, k, b, out = neues_material(name, False)
    tc = k.n('ShaderNodeTexCoord')
    t = k.n('ShaderNodeTexImage'); t.image = hf.bild(textur); k.nt.links.new(tc.outputs['UV'], t.inputs['Vector'])
    f = k.mix(1.0, t.outputs['Color'], ton, 'MULTIPLY')
    gross = k.rauschen(tc.outputs['Object'], 9.0, 3.0, 0.6)
    f = k.mix(k.math('MULTIPLY', k.bereich(gross, 0.35, 0.75), wetter), f, k.mix(1.0, f, (0.80, 0.62, 0.54), 'MULTIPLY'))
    f = k.mix(k.math('MULTIPLY', k.bereich(k.rauschen(tc.outputs['Object'], 23.0, 4.0, 0.7), 0.52, 0.80), schmutz), f, (0.20, 0.15, 0.11))
    if bart: f = k.mix(k.math('MULTIPLY', k.attr('bart'), bart), f, (0.16, 0.14, 0.13))      # Bartschatten
    k.setze(b.inputs['Base Color'], f)
    g = k.grau(t.outputs['Color'])
    k.setze(b.inputs['Roughness'], k.bereich(g, 0.1, 0.8, 0.62, 0.46))
    b.inputs['Subsurface Weight'].default_value = 1.0; b.inputs['Subsurface Scale'].default_value = 0.0022
    b.inputs['Subsurface Radius'].default_value = (1.0, 0.36, 0.20); b.subsurface_method = 'RANDOM_WALK_SKIN'
    bp = k.n('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.45; bp.inputs['Distance'].default_value = 0.0012
    hoehe = k.math('ADD', g, k.math('MULTIPLY', k.rauschen(tc.outputs['Object'], 170.0, 3.0, 0.6), leder))   # Leder: wettergegerbte Haut, kein Porenkorn
    if falten:   # Altersfalten: verzogene Querbänder (Stirn, Hals) in Flecken, dazu ein feines Knitternetz
        wv = k.n('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'Z'; wv.wave_profile = 'SIN'
        wv.inputs['Scale'].default_value = 70.0; wv.inputs['Distortion'].default_value = 9.0; wv.inputs['Detail'].default_value = 2.0; wv.inputs['Detail Scale'].default_value = 0.6
        k.nt.links.new(tc.outputs['Object'], wv.inputs['Vector'])
        quer = k.math('MULTIPLY', k.bereich(wv.outputs['Fac'], 0.0, 0.35, 1.0, 0.0, True), k.bereich(k.rauschen(tc.outputs['Object'], 26.0, 2.0, 0.5), 0.50, 0.66))
        vo = k.n('ShaderNodeTexVoronoi'); vo.feature = 'DISTANCE_TO_EDGE'; vo.inputs['Scale'].default_value = 330.0; k.nt.links.new(tc.outputs['Object'], vo.inputs['Vector'])
        knitter = k.bereich(vo.outputs['Distance'], 0.0, 0.06, 1.0, 0.0, True)
        hoehe = k.math('SUBTRACT', hoehe, k.math('MULTIPLY', k.math('ADD', k.math('MULTIPLY', quer, 0.9), k.math('MULTIPLY', knitter, 0.35)), falten))
        bp.inputs['Distance'].default_value = 0.0018
    k.setze(bp.inputs['Height'], hoehe)
    k.nt.links.new(bp.outputs[0], b.inputs['Normal'])
    return m


def mat_karte(name, farbe, alpha=True, rau=0.6, ton=(1, 1, 1), hell=1.0, hebung=0.0):
    """Brauen, Wimpern, Haar: Farbkarte mit Alpha (Karten aus den MakeHuman-System-Assets)."""
    m, k, b, out = neues_material(name, False)
    t = k.n('ShaderNodeTexImage'); t.image = hf.bild(farbe); t.image.alpha_mode = 'CHANNEL_PACKED'
    if hell != 1.0: k.setze(b.inputs['Base Color'], k.mix(1.0, (*ton,), k.mix(1.0, (1, 1, 1), k.bereich(k.grau(t.outputs['Color']), 0.0, 0.22, 0.55, 1.7), 'MULTIPLY'), 'MULTIPLY'))
    else: k.setze(b.inputs['Base Color'], k.mix(1.0, t.outputs['Color'], ton, 'MULTIPLY'))
    b.inputs['Roughness'].default_value = rau
    if alpha: k.nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
    return m


def mat_auge(name):
    m, k, b, out = neues_material(name, False)
    o = os.path.join(cache(), 'menschen', 'sysassets', 'eyes', 'materials')
    t = k.n('ShaderNodeTexImage'); t.image = hf.bild(os.path.join(o, 'brown_eye.png'))
    t.image.alpha_mode = 'CHANNEL_PACKED'
    k.setze(b.inputs['Base Color'], k.mix(1.0, t.outputs['Color'], (0.80, 0.76, 0.72), 'MULTIPLY')); b.inputs['Roughness'].default_value = 0.12
    k.nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])     # die Hornhautschale liegt auf einem durchsichtigen Fleck der Karte
    return m


def hautteile(b, teile, haut, auge='brown', haar_ton=(1, 1, 1)):
    """Materialien für Körper und MakeHuman-Zutaten setzen."""
    sa = os.path.join(cache(), 'menschen', 'sysassets')
    b.data.materials.clear(); b.data.materials.append(haut)
    for art, o in teile.items():
        o.data.materials.clear()
        if art == 'eyes': o.data.materials.append(mat_auge(o.name + '_auge'))
        elif art == 'teeth': o.data.materials.append(mat_karte(o.name, os.path.join(sa, 'teeth', 'teeth_base', 'teeth.png'), False, 0.3, (0.85, 0.80, 0.70)))
        else:
            ordner = os.path.dirname(asset({'eyebrows': 'eyebrows', 'eyelashes': 'eyelashes', 'hair': 'hair'}[art], o.get('asset_name', '')) if o.get('asset_name') else '')
            png = next((os.path.join(ordner, f) for f in sorted(os.listdir(ordner)) if f.endswith('.png') and 'normal' not in f), None)
            o.data.materials.append(mat_karte(o.name, png, True, 0.72 if art == 'hair' else 0.5, haar_ton if art == 'hair' else (1, 1, 1), 3.0 if art == 'hair' else 1.0))


# ───────────────────────────── Kleidung als Geometrie ─────────────────────────────
RUMPF = ('pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'neck_01')


class Ruhe:
    """Ruhelage des Grundnetzes (Rig im Ursprung): Koordinaten, dominanter Knochen je Vertex, Gelenke, Helfergruppen."""
    def __init__(s, b, rig):
        s.b, s.rig = b, rig; s.co = koord(b).astype(np.float64)
        namen = {vg.index: vg.name for vg in b.vertex_groups if vg.name in rig.data.bones}
        s.dom = np.array([max(((g.weight, namen[g.group]) for g in v.groups if g.group in namen), default=(0, ''))[1] for v in b.data.vertices])
        s.G = {n: np.array(p) for n, p in gelenke(rig).items()}
        s.in_ = {}
        for n in ('helper-tights', 'helper-skirt', 'helper-hair', 'body'):
            s.in_[n] = np.zeros(len(s.co), bool); s.in_[n][gruppe(b, n)] = True
        s.m = float(s.G['head.ende'][2]) / 1.80          # Massstab gegen die 1,80-m-Figur

    def entlang(s, a, e):
        """Parameter 0…1 jedes Vertex entlang der Strecke Gelenk a → Gelenk e."""
        A, E = s.G[a], s.G[e]; d = E - A
        return ((s.co - A) @ d) / (d @ d)

    def knochen(s, *namen):
        return np.isin(s.dom, [n for n in namen] + [n[:-1] + x for n in namen if n.endswith('_*') for x in 'lr'])


def huelle(R, name, maske, abstand, glatt=3, teilen=2, form=None):
    """Kleidungsstück aus den Helfer-Vertices `maske` des Grundnetzes: entlang der Normalen um `abstand` (Zahl oder
    Feld je Vertex) aufgeblasen, geglättet (die Anatomie soll nicht durch Loden drücken), unterteilt. Gewichte bleiben."""
    o = R.b.copy(); o.data = R.b.data.copy(); o.name = name; bpy.context.scene.collection.objects.link(o)
    for m in list(o.modifiers):
        if m.type != 'ARMATURE': o.modifiers.remove(m)
    o.data.materials.clear()
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    ab = {v: (float(abstand) if np.isscalar(abstand) else float(abstand[v.index])) for v in bm.verts if maske[v.index]}
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not maske[v.index]], context='VERTS')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.normal_update()
    for v in bm.verts: v.co += v.normal * ab[v]
    for _ in range(glatt): bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    if form:
        for v in bm.verts: v.co = Vector(form(np.array(v.co)))
    bm.to_mesh(o.data); bm.free()
    if teilen:
        sd = o.modifiers.new('teilen', 'SUBSURF'); sd.levels = teilen
        aktiv(o)
        while o.modifiers[0].name != 'teilen': bpy.ops.object.modifier_move_up(modifier='teilen')
        bpy.ops.object.modifier_apply(modifier='teilen')
    return o


def merkmale(o, abrieb=()):
    """Attribute aus der Ruhelage: `ruhe` (Ort), `ruhe_n` (Normale) für die Gewebeprojektion, `rand` (Weg zur offenen
    Kante in m, höchstens 0,15) für Saum und Schmutz, `abrieb` (0…1 um die genannten Punkte: Ellbogen, Knie, Schulter)."""
    me = o.data; co = koord(o); n = len(co)
    me.calc_loop_triangles()
    nr = np.zeros(n * 3, np.float32); me.vertices.foreach_get('normal', nr)
    for name, typ, werte in (('ruhe', 'FLOAT_VECTOR', co.ravel()), ('ruhe_n', 'FLOAT_VECTOR', nr)):
        a = me.attributes.get(name) or me.attributes.new(name, typ, 'POINT'); a.data.foreach_set('vector', werte)
    import heapq
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    d = np.full(n, 0.15); h = []
    for v in bm.verts:
        if v.is_boundary: d[v.index] = 0.0; h.append((0.0, v.index))
    heapq.heapify(h)
    while h:
        dv, i = heapq.heappop(h)
        if dv > d[i]: continue
        for e in bm.verts[i].link_edges:
            j = e.other_vert(bm.verts[i]).index; nd = dv + e.calc_length()
            if nd < d[j]: d[j] = nd; heapq.heappush(h, (nd, j))
    bm.free()
    a = me.attributes.get('rand') or me.attributes.new('rand', 'FLOAT', 'POINT'); a.data.foreach_set('value', d.astype(np.float32))
    w = np.zeros(n)
    for p, r in abrieb: w = np.maximum(w, np.exp(-(np.linalg.norm(co - np.array(p), axis=1) / r) ** 2))
    a = me.attributes.get('abrieb') or me.attributes.new('abrieb', 'FLOAT', 'POINT'); a.data.foreach_set('value', w.astype(np.float32))
    for p in me.polygons: p.use_smooth = True


def stoff(o, fest, masse=0.3, zug=15.0, biegung=0.5, uebermass=0.05, abstand=0.006, eigen=False):
    """Stoffsimulation: `fest` (Feld 0…1 je Vertex) folgt dem Rig, der Rest fällt. `uebermass` schneidet das Stück
    grösser zu, als die Hülle ist — daraus werden die Falten."""
    vg = o.vertex_groups.get('fest') or o.vertex_groups.new(name='fest')
    for i in np.nonzero(fest > 0.01)[0]: vg.add([int(i)], float(min(1.0, fest[i])), 'REPLACE')
    m = o.modifiers.new('Stoff', 'CLOTH'); s = m.settings
    s.quality = 5 if KURZ else 8; s.mass = masse
    s.tension_stiffness = s.compression_stiffness = zug; s.shear_stiffness = zug * 0.35; s.bending_stiffness = biegung
    s.tension_damping = s.compression_damping = s.shear_damping = 5.0; s.bending_damping = 0.5; s.air_damping = 2.0
    s.vertex_group_mass = 'fest'; s.pin_stiffness = 1.0; s.shrink_min = -uebermass
    c = m.collision_settings; c.use_collision = True; c.distance_min = abstand; c.collision_quality = 3
    c.use_self_collision = eigen; c.self_distance_min = 0.004
    return m


def simuliere(stoffe, hindernisse, bilder):
    sc = bpy.context.scene; sc.frame_start = 1; sc.frame_end = bilder
    for h in hindernisse:
        if not any(m.type == 'COLLISION' for m in h.modifiers):
            h.modifiers.new('Hindernis', 'COLLISION'); h.collision.thickness_outer = 0.002; h.collision.thickness_inner = 0.02
            h.collision.cloth_friction = 15.0; h.collision.damping = 0.6
    for o in stoffe:
        pc = o.modifiers['Stoff'].point_cache; pc.frame_start = 1; pc.frame_end = bilder
    t = time.time()
    for f in range(1, bilder + 1): sc.frame_set(f)
    print('MENSCHENFRAME Stoff: %s — %d Bilder, %.0f s' % (', '.join('%s (%d)' % (o.name, len(o.data.vertices)) for o in stoffe), bilder, time.time() - t))


def einfrieren(objs):
    """Ausgewertete Netze (Pose, Stoff, Maske) als feste Netze in Weltkoordinaten; die Vorlagen verschwinden."""
    dg = bpy.context.evaluated_depsgraph_get(); neu = {}
    for o in objs:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        me.transform(o.matrix_world)
        name = o.name; o.name = name + '.alt'
        n = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(n); neu[name] = n
    for o in objs: bpy.data.objects.remove(o)
    return neu


def weltnetz(objs):
    """BVH über mehrere feste Netze (Weltkoordinaten)."""
    vs, fs = [], []
    for o in objs:
        n0 = len(vs); M = o.matrix_world
        vs += [M @ v.co for v in o.data.vertices]; fs += [[n0 + i for i in p.vertices] for p in o.data.polygons]
    return BVHTree.FromPolygons(vs, fs, epsilon=0.0)


def aussen(bvh, mitte, richtung, grenze):
    """Äusserster Treffer eines Strahls von innen (`mitte`) nach aussen innerhalb von `grenze` — die oberste Stoffschicht."""
    p = Vector(mitte); d = Vector(richtung).normalized(); weg = 0.0; letzter = None
    while weg < grenze:
        ort, nrm, _, dist = bvh.ray_cast(p, d, grenze - weg)
        if ort is None: break
        weg += dist + 0.0015; letzter = ort.copy(); p = ort + d * 0.0015
    return letzter


def umlauf(bvh, mitte, normale, grenze, n=72, vorn=(0, -1, 0)):
    """Geschlossener Ring um die Figur in der Ebene (`mitte`, `normale`): je Winkel die äusserste Schicht. Ausreisser
    (Arm vor der Hüfte, Lücke) werden auf den Median der Nachbarn zurückgeholt, der Ring leicht geglättet."""
    nz = Vector(normale).normalized(); u = (Vector(vorn) - nz * nz.dot(Vector(vorn))).normalized(); v = nz.cross(u)
    rad = []
    for i in range(n):
        a = 2 * math.pi * i / n; d = u * math.cos(a) + v * math.sin(a)
        t = aussen(bvh, mitte, d, grenze); rad.append((t - Vector(mitte)).length if t else float('nan'))
    r = np.array(rad); med = np.nanmedian(r); r[np.isnan(r)] = med
    for _ in range(2):
        nb = np.median(np.stack([np.roll(r, k) for k in range(-4, 5)]), axis=0)
        r = np.where(np.abs(r - nb) > 0.25 * nb, nb, r)
    r = (np.roll(r, 1) + 2 * r + np.roll(r, -1)) / 4
    return [(Vector(mitte) + (u * math.cos(2 * math.pi * i / n) + v * math.sin(2 * math.pi * i / n)) * r[i], (u * math.cos(2 * math.pi * i / n) + v * math.sin(2 * math.pi * i / n))) for i in range(n)], nz


def netz(name, verts, faces, glatt=True):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    for p in me.polygons: p.use_smooth = glatt
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    return o


def band(name, ring, nz, breite, dicke, abheben=0.002, geschlossen=True, kippen=None):
    """Riemen entlang eines Rings/Wegs aus (Punkt, Aussenrichtung): Rechteckquerschnitt `breite` (entlang `nz`) × `dicke`."""
    vs, fs = [], []; n = len(ring)
    for i, (p, d) in enumerate(ring):
        h = (nz if kippen is None else kippen[i]) * (breite / 2)
        vs += [p + d * abheben - h, p + d * (abheben + dicke) - h, p + d * (abheben + dicke) + h, p + d * abheben + h]
    for i in range(n if geschlossen else n - 1):
        a, b_ = 4 * i, 4 * ((i + 1) % n)
        for k in range(4): fs.append((a + k, a + (k + 1) % 4, b_ + (k + 1) % 4, b_ + k))
    if not geschlossen: fs += [(3, 2, 1, 0), tuple(4 * (n - 1) + k for k in range(4))]
    o = netz(name, vs, fs, False)
    bv = o.modifiers.new('Kante', 'BEVEL'); bv.width = min(dicke, breite) * 0.3; bv.segments = 2; bv.limit_method = 'ANGLE'
    return o


def schlauch(name, weg, radius, n=10, kappen=True):
    """Rundes Profil entlang einer Punktfolge; `radius` Zahl oder Funktion des Wegparameters 0…1."""
    pts = [Vector(p) for p in weg]; vs, fs = [], []
    vor = None
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        if vor is None:
            a = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0)); vor = (a - t * a.dot(t)).normalized()
        else: vor = (vor - t * vor.dot(t)).normalized()
        w = t.cross(vor); r = radius(i / max(1, len(pts) - 1)) if callable(radius) else radius
        vs += [p + (vor * math.cos(2 * math.pi * k / n) + w * math.sin(2 * math.pi * k / n)) * r for k in range(n)]
    for i in range(len(pts) - 1):
        for k in range(n): fs.append((i * n + k, i * n + (k + 1) % n, (i + 1) * n + (k + 1) % n, (i + 1) * n + k))
    if kappen: fs += [tuple(reversed(range(n))), tuple((len(pts) - 1) * n + k for k in range(n))]
    return netz(name, vs, fs)


def drehkoerper(name, profil, segmente, mitte=lambda t: (0.0, 0.0), offen=None, schlitz=None):
    """Fläche aus Ringen: `profil` = [(radius, z, ovalx, ovaly)], `mitte(i)` verschiebt den Ring; `offen(i, winkel)` lässt
    Flächen weg (Gesichtsöffnung), `schlitz` (Winkel) trennt die Ringe dort auf (vorn offener Umhang). Winkel 0 = −Y (vorn)."""
    vs, fs = [], []
    seg = segmente + (1 if schlitz is not None else 0)
    for i, (r, z, ox, oy) in enumerate(profil):
        mx, my = mitte(i)
        for k in range(seg):
            a = (schlitz or 0.0) + 2 * math.pi * k / segmente
            vs.append((mx + math.sin(a) * r * ox, my - math.cos(a) * r * oy, z))
    for i in range(len(profil) - 1):
        for k in range(seg - 1 if schlitz is not None else seg):
            a = (schlitz or 0.0) + 2 * math.pi * (k + 0.5) / segmente
            if offen and offen(i, (a + math.pi) % (2 * math.pi) - math.pi): continue
            k1 = (k + 1) % seg
            fs.append((i * seg + k, i * seg + k1, (i + 1) * seg + k1, (i + 1) * seg + k))
    o = netz(name, vs, fs)
    bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(o.data); bm.free()
    return o


# ───────────────────────────── Figuren ─────────────────────────────

def zuschnitt(R):
    """Gemeinsame Masken und Höhen der Ruhelage."""
    co, T, m = R.co, R.in_['helper-tights'], R.m
    mitte = T & R.knochen('pelvis') & (np.abs(co[:, 0]) < 0.02 * m)
    Z = dict(schritt=co[mitte, 2].min(), taille=R.G['spine_01'][2] + 0.03 * m, hals=R.G['neck_01'][2], schulter=R.G['upperarm_l'][2],
             knie=R.G['calf_l'][2], knoechel=R.G['foot_l'][2])
    links = co[:, 0] > 0
    t_ober = np.where(links, R.entlang('upperarm_l', 'lowerarm_l'), R.entlang('upperarm_r', 'lowerarm_r'))
    t_unter = np.where(links, R.entlang('lowerarm_l', 'hand_l'), R.entlang('lowerarm_r', 'hand_r'))
    t_wade = np.where(links, R.entlang('calf_l', 'foot_l'), R.entlang('calf_r', 'foot_r'))
    return co, T, m, Z, links, t_ober, t_unter, t_wade


def rock(R, name, saum_z, weite, falten, anzahl, abstand):
    """Rock/Kuttenunterteil aus dem Rockhelfer: bis `saum_z` verlängert, zum Saum um `weite` ausgestellt, mit `anzahl`
    Faltenanlagen (die Simulation legt sie um)."""
    S = R.in_['helper-skirt']; z1, z0 = R.co[S, 2].max(), R.co[S, 2].min(); yc = R.co[S, 1].mean()

    def form(p):
        t = (z1 - p[2]) / (z1 - z0); a = math.atan2(p[0], -(p[1] - yc))
        f = (1 + weite * t) * (1 + falten * t * math.sin(anzahl * a))
        return (p[0] * f, yc + (p[1] - yc) * f, z1 - t * (z1 - saum_z))
    o = huelle(R, name, S, abstand, glatt=0, teilen=2, form=form)
    return o, z1


def kleider_brachgaenger(R):
    co, T, m, Z, links, t_ober, t_unter, t_wade = zuschnitt(R); G = R.G
    rumpf = R.knochen(*RUMPF)
    # Leinenhemd: rechter Ärmel lang, linker über den Ellbogen gekrempelt (die Marke liegt frei)
    mh = T & ((rumpf & (co[:, 2] > Z['taille'] - 0.10 * m) & (co[:, 2] < Z['hals'] + 0.03 * m)) | R.knochen('upperarm_*')
              | (R.knochen('lowerarm_r') & (t_unter < 0.92)) | (R.knochen('lowerarm_l') & (t_unter < 0.22)))
    hemd = huelle(R, 'hemd', mh, 0.006 * m, glatt=2)
    merkmale(hemd, [(G['lowerarm_r'], 0.07 * m), (G['lowerarm_l'], 0.07 * m)])
    c = koord(hemd); stoff(hemd, ((c[:, 2] > Z['hals'] + 0.005 * m) | (c[:, 2] < Z['taille'] - 0.07 * m)).astype(float), 0.2, 12.0, 0.3, 0.06, 0.004)
    # Hose aus Wollköper, unten in die Wadenwickel gesteckt
    mho = T & ((R.knochen('pelvis', 'spine_01') & (co[:, 2] < Z['taille'] + 0.01 * m)) | R.knochen('thigh_*') | (R.knochen('calf_*') & (t_wade < 0.80)))
    hose = huelle(R, 'hose', mho, 0.012 * m + 0.014 * m * np.clip((Z['taille'] - 0.12 * m - co[:, 2]) / (0.15 * m), 0, 1))
    merkmale(hose, [(G['calf_l'] + np.array((0, -0.05, 0)), 0.08 * m), (G['calf_r'] + np.array((0, -0.05, 0)), 0.08 * m)])
    c = koord(hose); unten = Z['knoechel'] + 0.30 * (Z['knie'] - Z['knoechel'])
    stoff(hose, ((c[:, 2] > Z['taille'] - 0.03 * m) | (c[:, 2] < unten)).astype(float), 0.35, 20.0, 1.0, 0.11, 0.008)
    # Lodenweste, hüftlang, ärmellos
    mw = T & rumpf & (co[:, 2] > Z['schritt'] + 0.10 * m) & (co[:, 2] < Z['hals'] - 0.01 * m)
    ab = 0.016 * m + 0.006 * m * np.clip((Z['taille'] - co[:, 2]) / (0.2 * m), 0, 1)
    weste = huelle(R, 'weste', mw, ab, glatt=4)
    merkmale(weste, [(G['upperarm_l'], 0.09 * m), (G['upperarm_r'], 0.09 * m)])
    c = koord(weste)
    stoff(weste, ((c[:, 2] > Z['schulter'] - 0.005 * m) | (np.abs(c[:, 2] - Z['taille']) < 0.02 * m)).astype(float), 0.5, 30.0, 6.0, 0.03, 0.013)
    # Schuhe: Lederhülle um Fuss und Knöchel (kein Stoff, folgt dem Rig)
    ms = T & (R.knochen('foot_*', 'ball_*') | (R.knochen('calf_*') & (t_wade > 0.62)))
    schuhe = huelle(R, 'schuhe', ms, 0.009 * m, glatt=2, teilen=1, form=lambda p: (p[0], p[1], max(p[2], 0.003)))
    merkmale(schuhe, [(G['ball_l'], 0.07 * m), (G['ball_r'], 0.07 * m)])
    return [hemd, hose, weste], [schuhe]


def umhang(name, W, fest, r0, r1, ringe, segmente, neigung, oval=(1.0, 0.9), zurueck=0.05, schlitz=0.0):
    """Kegelfläche um den Hals (in Figur-Koordinaten gebaut, mit `W` in die Welt), die Halskante hängt fest."""
    prof = [(r0 + (r1 - r0) * i / ringe, -(r1 - r0) * i / ringe * neigung, oval[0], oval[1]) for i in range(ringe + 1)]
    o = drehkoerper(name, prof, segmente, mitte=lambda i: (0.0, zurueck * i / ringe), schlitz=schlitz)
    o.data.transform(W)
    merkmale(o)
    return o


def tuecher_brachgaenger(fest, G1, m):
    # Wetterfleck: kurzer Lodenumhang, vorn offen, hinten länger
    W = Matrix.Translation(Vector(G1['neck_01']) + Vector((0, 0, 0.045 * m))) @ Matrix.Rotation(G1['drehung'], 4, 'Z') @ Matrix.Translation((0, 0.012 * m, 0))
    fl = umhang('wetterfleck', W, None, 0.082 * m, 0.47 * m, 30, 120, 0.55)
    ring = np.arange(len(fl.data.vertices)) // 121
    w = (ring < 2).astype(float)
    stoff(fl, w, 0.5, 30.0, 5.0, 0.0, 0.010)
    return [fl]


def kleider_schmiedin(R):
    co, T, m, Z, links, t_ober, t_unter, t_wade = zuschnitt(R); G = R.G
    rumpf = R.knochen(*RUMPF)
    # Leinenbluse, Ärmel über den Ellbogen gekrempelt
    mb = T & ((rumpf & (co[:, 2] > Z['taille'] - 0.10 * m) & (co[:, 2] < Z['hals'] + 0.012 * m)) | (R.knochen('upperarm_*') & (t_ober < 0.86)))
    ab = 0.007 * m + 0.016 * m * np.clip(t_ober, 0, 1) * R.knochen('upperarm_*')
    bluse = huelle(R, 'bluse', mb, ab, glatt=2)
    merkmale(bluse, [(G['upperarm_l'], 0.08 * m), (G['upperarm_r'], 0.08 * m)])
    c = koord(bluse); stoff(bluse, ((c[:, 2] > Z['hals'] - 0.01 * m) | (c[:, 2] < Z['taille'] - 0.06 * m)).astype(float), 0.2, 12.0, 0.3, 0.08, 0.004)
    # Wollrock bis zur Wade, weit, in Falten
    r, z1 = rock(R, 'rock', 0.30 * m, 0.55, 0.07, 13, 0.012 * m)
    merkmale(r)
    c = koord(r); stoff(r, (c[:, 2] > z1 - 0.035 * m).astype(float), 0.4, 18.0, 1.5, 0.0, 0.008)
    # gestrickte Strümpfe und Schuhe (folgen dem Rig)
    st = huelle(R, 'struempfe', T & R.knochen('calf_*') & (t_wade > 0.05) & (t_wade < 0.80), 0.004 * m, glatt=1, teilen=1); merkmale(st)
    ms = T & (R.knochen('foot_*', 'ball_*') | (R.knochen('calf_*') & (t_wade > 0.70)))
    schuhe = huelle(R, 'schuhe', ms, 0.009 * m, glatt=2, teilen=1, form=lambda p: (p[0], p[1], max(p[2], 0.003)))
    merkmale(schuhe, [(G['ball_l'], 0.07 * m), (G['ball_r'], 0.07 * m)])
    return [bluse, r], [st, schuhe]


def richtungen(G1):
    d = G1['drehung']
    return Vector((math.sin(d), -math.cos(d), 0)), Vector((math.cos(d), math.sin(d), 0))


def tuecher_schmiedin(fest, G1, m):
    """Lederschürze: Latz und Schoss als ein Blatt vor der Figur, an den Latzecken (Nackenriemen) und in der Taille
    (Bindebänder) gehalten; fällt auf Bluse und Rock."""
    vorn, links = richtungen(G1); V_ = lambda n: Vector(G1[n])
    bvh = weltnetz(list(fest.values()))
    z_oben = V_('neck_01').z - 0.115 * m; z_taille = lerp(V_('pelvis'), V_('spine_01'), 0.85).z; z_unten = V_('calf_l').z + 0.04 * m
    mitte = V_('spine_02'); mitte.z = 0
    nz_, nx_ = 66, 30
    def halb(z):
        if z >= z_taille: return (0.105 + 0.045 * (z_oben - z) / (z_oben - z_taille)) * m
        t = min(1.0, (z_taille - z) / (0.05 * m)); return (0.15 + 0.10 * t + 0.03 * (z_taille - z) / (z_taille - z_unten)) * m
    tiefe = []
    for j in range(nz_ + 1):
        z = z_oben + (z_unten - z_oben) * j / nz_; hw = halb(z); best = None
        for i in range(9):
            o = mitte + links * (hw * (i / 4 - 1) * 0.8) + vorn * 0.7 + Vector((0, 0, z))
            t, _, _, dist = bvh.ray_cast(o, -vorn, 0.9)
            if t is not None: best = max(best, 0.7 - dist) if best is not None else 0.7 - dist
        tiefe.append(best if best is not None else 0.1)
    tiefe = np.array(tiefe); tiefe = np.maximum.reduce([np.roll(tiefe, k) for k in (-2, -1, 0, 1, 2)]); tiefe[:2] = tiefe[2]; tiefe[-2:] = tiefe[-3]
    vs, fs, fest_w = [], [], []
    for j in range(nz_ + 1):
        z = z_oben + (z_unten - z_oben) * j / nz_; hw = halb(z)
        for i in range(nx_ + 1):
            u = i / nx_ * 2 - 1
            vs.append(mitte + links * (hw * u) + vorn * (tiefe[j] + 0.014 - 0.035 * u * u * (1.0 if z < z_taille else 0.3)) + Vector((0, 0, z)))
            fest_w.append(1.0 if (j < 2 and abs(u) > 0.8) or (abs(z - z_taille) < 0.012 * m and abs(u) > 0.9) else 0.0)
    for j in range(nz_):
        for i in range(nx_): fs.append((j * (nx_ + 1) + i, j * (nx_ + 1) + i + 1, (j + 1) * (nx_ + 1) + i + 1, (j + 1) * (nx_ + 1) + i))
    sch = netz('schuerze', vs, fs); merkmale(sch, [(lerp(V_('pelvis'), V_('calf_l'), 0.5) + vorn * 0.12, 0.16 * m)])
    stoff(sch, np.array(fest_w), 0.8, 40.0, 14.0, 0.0, 0.007)
    # Kopftuch: liegt am Scheitel und im Nacken fest, dazwischen fällt es
    kt, prof = gugel('kopftuch', G1, m, False)
    sd = kt.modifiers.new('teilen', 'SUBSURF'); sd.levels = 1; aktiv(kt); bpy.ops.object.modifier_apply(modifier='teilen')
    merkmale(kt); c = koord(kt)
    stoff(kt, ((c[:, 2] > c[:, 2].max() - 0.05 * m) | (c[:, 2] < c[:, 2].min() + 0.012 * m)).astype(float), 0.2, 12.0, 0.4, 0.05, 0.004)
    return [sch, kt]


def kleider_zaehler(R):
    co, T, m, Z, links, t_ober, t_unter, t_wade = zuschnitt(R); G = R.G
    rumpf = R.knochen(*RUMPF)
    # Kutte, Oberteil: weit, Ärmel zum Handgelenk hin offen und lang
    arm = R.knochen('upperarm_*', 'lowerarm_*')
    mk = T & ((rumpf & (co[:, 2] > Z['schritt'] + 0.03 * m) & (co[:, 2] < Z['hals'] + 0.0 * m)) | R.knochen('upperarm_*') | (R.knochen('lowerarm_*') & (t_unter < 0.97)))
    t_arm = np.where(R.knochen('upperarm_*'), 0.5 * np.clip(t_ober, 0, 1), 0.5 + 0.5 * np.clip(t_unter, 0, 1)) * arm
    ob = huelle(R, 'kutte_oben', mk, 0.020 * m + 0.060 * m * t_arm ** 1.5, glatt=4)
    merkmale(ob, [(G['lowerarm_l'], 0.09 * m), (G['lowerarm_r'], 0.09 * m), (G['upperarm_l'], 0.08 * m), (G['upperarm_r'], 0.08 * m)])
    c = koord(ob)
    stoff(ob, ((c[:, 2] > Z['schulter'] + 0.0 * m) | (np.abs(c[:, 2] - Z['taille']) < 0.02 * m)).astype(float), 0.45, 18.0, 2.0, 0.05, 0.009)
    # Kutte, Unterteil: bis auf den Rist
    r, z1 = rock(R, 'kutte_unten', 0.045 * m, 0.38, 0.06, 11, 0.014 * m)
    merkmale(r)
    c = koord(r); stoff(r, (c[:, 2] > z1 - 0.035 * m).astype(float), 0.45, 18.0, 2.0, 0.0, 0.008)
    return [ob, r], []


def gugel(name, G1, m, kapuze=True):
    """Kapuze mit Schulterkragen als ein Stück (Gugel), in Ruhekoordinaten um Kopf und Hals gebaut; oben folgt sie dem
    Kopfknochen, unten der Brust. Ohne `kapuze`: nur das Kopftuch (eng, im Nacken gebunden)."""
    R0 = {k[2:]: Vector(v) for k, v in G1.items() if k.startswith('R:')}
    Wk, Wb = Matrix(G1['W:head']), Matrix(G1['W:spine_03'])
    zt, zh, zn = R0['head.ende'].z, R0['head'].z, R0['neck_01'].z
    prof = []    # (radius, z, ovalx, ovaly, mitte_y, anteil_kopf)
    if kapuze:
        zc = zt - 0.100 * m
        for th in (6, 16, 28, 40, 52, 64, 76, 88): prof.append((0.132 * m * math.sin(math.radians(th)), zc + 0.138 * m * math.cos(math.radians(th)), 0.84, 1.16, -0.034 * m, 1.0))
        for z_, r_, cy in ((zc - 0.035 * m, 0.132, -0.034), (zc - 0.07 * m, 0.128, -0.03), (zh - 0.02 * m, 0.122, -0.026), (zh - 0.055 * m, 0.116, -0.02), (zh - 0.085 * m, 0.112, -0.015)):
            prof.append((r_ * m, z_, 0.86, 1.14, cy * m, 1.0))
        for z_, r_, ox, w in ((zn + 0.035 * m, 0.118, 0.95, 0.6), (zn + 0.02 * m, 0.15, 1.08, 0.3), (zn + 0.008 * m, 0.19, 1.18, 0.0), (zn - 0.005 * m, 0.235, 1.24, 0.0),
                              (zn - 0.022 * m, 0.28, 1.27, 0.0), (zn - 0.045 * m, 0.325, 1.28, 0.0), (zn - 0.07 * m, 0.365, 1.28, 0.0), (zn - 0.10 * m, 0.40, 1.28, 0.0)):
            prof.append((r_ * m, z_, ox, 0.96, -0.012 * m, w))
        auf = lambda i, a: prof[i][1] < zt - 0.04 * m and prof[i + 1][1] > zh - 0.09 * m and abs(a) < math.radians(60)
    else:
        zc = zt - 0.102 * m
        for th in (6, 18, 30, 42, 54, 66, 78, 90): prof.append((0.106 * m * math.sin(math.radians(th)), zc + 0.118 * m * math.cos(math.radians(th)), 0.90, 1.10, -0.024 * m, 1.0))
        for z_, r_, w in ((zc - 0.03 * m, 0.108, 1.0), (zc - 0.06 * m, 0.110, 1.0), (zh - 0.035 * m, 0.106, 1.0), (zh - 0.07 * m, 0.094, 1.0), (zn + 0.05 * m, 0.080, 0.8), (zn + 0.03 * m, 0.072, 0.6)):
            prof.append((r_ * m, z_, 0.92, 1.06, -0.018 * m, w))
        auf = lambda i, a: prof[i][1] < zt - 0.045 * m and abs(a) < math.radians(63)
    o = drehkoerper(name, [(r, z, ox, oy) for r, z, ox, oy, cy, w in prof], 64, mitte=lambda i: (0.0, prof[i][4]), offen=auf)
    gew = {round(p_[1], 5): p_[5] for p_ in prof}
    for v in o.data.vertices:
        w = gew[min(gew, key=lambda z_: abs(z_ - v.co.z))]
        v.co = (Wk @ v.co) * w + (Wb @ v.co) * (1 - w)
    return o, prof


def tuecher_zaehler(fest, G1, m):
    o, prof = gugel('gugel', G1, m)
    sd = o.modifiers.new('teilen', 'SUBSURF'); sd.levels = 1; aktiv(o); bpy.ops.object.modifier_apply(modifier='teilen')
    merkmale(o)
    c = koord(o); oben = c[:, 2].max()
    stoff(o, (c[:, 2] > oben - 0.075 * m).astype(float), 0.4, 18.0, 2.5, 0.03, 0.008)
    return [o]


def schneidern(name):
    """Körper, Pose, Kleidung in zwei Gängen (1: Hüllen aus dem Grundnetz, fallen während der Pose; 2: Tücher, die in
    der fertigen Pose über die Figur fallen). Ergebnis: feste Netze in Weltkoordinaten, Gelenke am Körper."""
    F = FIGUREN[name]; sc = bpy.context.scene
    b, rig, teile = koerper(name, F['makro'], F['ziele'], GROESSE[name], F['zutaten'])
    for art, o in teile.items(): o.name = name + '.' + art
    R = Ruhe(b, rig)
    globals()['KURZ'] = SCHNELL or F.get('kurz', False)
    stuecke, starr = F['kleider'](R)
    hz, m_ = R.G['head'][2], R.m; c = R.co        # Bartschatten: Kinn, Wangen, Oberlippe (Ruhelage), ohne Lippen
    bart = np.clip((hz + 0.012 * m_ - c[:, 2]) / (0.02 * m_), 0, 1) * np.clip((-0.035 * m_ - c[:, 1]) / (0.03 * m_), 0, 1) * np.clip((c[:, 2] - (hz - 0.10 * m_)) / (0.025 * m_), 0, 1)
    bart[gruppe(b, 'lips')] = 0.0
    b.data.attributes.new('bart', 'FLOAT', 'POINT').data.foreach_set('value', bart.astype(np.float32))
    b.modifiers.new('ohne Helfer', 'MASK').vertex_group = 'body'
    pose(rig, F['pose'])
    rig.location = (PLATZ[name][0], PLATZ[name][1], 0); rig.rotation_euler.z = math.radians(F['drehung'])
    simuliere(stuecke, [b], 30 if KURZ else 46)
    G1 = {k: list(v) for k, v in gelenke(rig).items()}; G1['drehung'] = math.radians(F['drehung'])
    for pb in rig.pose.bones:   # Ruhelage → Welt je Knochen: was in Ruhekoordinaten gebaut ist (Kapuze, Marke, Werkzeug), kommt so in die Pose
        G1['W:' + pb.name] = [list(r) for r in (rig.matrix_world @ pb.matrix @ pb.bone.matrix_local.inverted())]
    for k_, v_ in R.G.items(): G1['R:' + k_] = [float(x) for x in v_]
    for o in stuecke + starr: o.name = name + '.' + o.name
    fest = einfrieren([b] + list(teile.values()) + stuecke + starr)
    bpy.data.objects.remove(rig)
    tuecher = F['tuecher'](fest, G1, R.m) if F.get('tuecher') else []
    if tuecher:
        sc.frame_set(1); simuliere(tuecher, list(fest.values()), 30 if KURZ else 50)
        for o in tuecher: o.name = name + '.' + o.name
        fest.update(einfrieren(tuecher))
        for o in fest.values():
            for mo in list(o.modifiers): o.modifiers.remove(mo)
    fest[name]['gelenke'] = json.dumps(G1); fest[name]['massstab'] = float(R.m)
    return fest


def figur(name):
    """Geschneiderte Figur aus dem Zwischenspeicher (`MENSCH_ZWISCHEN`, je Figur eine .blend) oder neu (`MENSCH_NEU=name,…`)."""
    ordner = os.environ.get('MENSCH_ZWISCHEN', os.path.join(cache(), 'menschen', 'zwischen')); os.makedirs(ordner, exist_ok=True)
    pfad = os.path.join(ordner, name + '.blend')
    if os.path.exists(pfad) and name not in os.environ.get('MENSCH_NEU', '').split(',') and os.environ.get('MENSCH_NEU') != 'alle':
        with bpy.data.libraries.load(pfad) as (von, nach): nach.objects = list(von.objects)
        for o in nach.objects: bpy.context.scene.collection.objects.link(o)
        return {o.name: o for o in nach.objects}
    fest = schneidern(name)
    bpy.data.libraries.write(pfad, set(fest.values()), fake_user=True)
    return fest


# ───────────────────────────── Stoff, Leder, Metall, Holz ─────────────────────────────
class Gewebe:
    """Scan aus drei Richtungen der Ruhelage (Attribute `ruhe`, `ruhe_n`) überblendet: das Gewebe sitzt am Stoff und
    wandert nicht, wenn er fällt. Für feste Teile ohne Ruhelage: Objektkoordinaten und Normale."""
    def __init__(s, k, mass, ruhe=True):
        s.k = k
        if ruhe: p, n = k.attr('ruhe', 'Vector'), k.attr('ruhe_n', 'Vector')
        else: p, n = k.n('ShaderNodeTexCoord').outputs['Object'], k.n('ShaderNodeTexCoord').outputs['Normal']
        s.p = p
        x, y, z = k.xyz(k.abbild(p, (1 / mass,) * 3))
        nx, ny, nz = (k.math('POWER', k.math('ABSOLUTE', a), 4.0) for a in k.xyz(n))
        s.wyz = k.math('ADD', ny, nz)
        s.f1 = k.math('DIVIDE', s.wyz, k.math('ADD', k.math('ADD', nx, s.wyz), 1e-5))      # Anteil der beiden anderen gegen die x-Ansicht
        s.f2 = k.math('DIVIDE', nz, k.math('ADD', s.wyz, 1e-5))                            # Anteil z gegen y
        s.uv = []
        for a, b_ in ((y, z), (x, z), (x, y)):
            c = k.n('ShaderNodeCombineXYZ'); k.nt.links.new(a, c.inputs[0]); k.nt.links.new(b_, c.inputs[1]); s.uv.append(c.outputs[0])

    def tex(s, pfad, farbe=True):
        k = s.k; t = [k.tex(uv, pfad, farbe, box=False) for uv in s.uv]
        return k.mix(s.f1, t[0], k.mix(s.f2, t[1], t[2]))


def puls(k, x, mitte, halb, weich=0.0015):
    """1 in |x − mitte| < halb, weich auslaufend."""
    d = k.math('ABSOLUTE', k.math('SUBTRACT', x, mitte))
    return k.bereich(d, halb, halb + weich, 1.0, 0.0, True)


def heller(farbe, f, plus=0.05):
    return tuple(min(1.0, c * f + plus) for c in farbe)


def mat_stoff(name, scan, mass, farbe, rau=0.92, flaum=0.35, schmutz=0.6, saum=0.07, relief=0.5, naehte=(), stiche=False, ruhe=True, bleich=0.15, moos=None, flecken=0.45):
    """Gewebe: Helligkeit und Relief aus dem Scan, Farbe aus der Palette (`farbe` färbt den entsättigten Scan). Aus den
    Attributen: Schmutz am Saum (`rand`), Abrieb (`abrieb`), umgelegter Saum mit Stichlinie; `naehte` = [(Achse, Wert,
    Maskenachse, ab)] zieht Nähte als Rille entlang einer Ebene der Ruhelage. `moos` (Farbe) lässt Bewuchs auf nach
    oben zeigenden Flächen stehen (die Kutte des Zählers)."""
    m, k, b, out = neues_material(name, False)
    g = Gewebe(k, mass, ruhe)
    hell = k.grau(g.tex(mscan(scan, 'diff')))
    f = k.mix(1.0, (*farbe,), k.mix(1.0, (1, 1, 1), k.bereich(hell, 0.05, 0.75, 0.50, 1.35), 'MULTIPLY'), 'MULTIPLY')
    gross = k.rauschen(g.p, 6.0, 3.0, 0.6)
    f = k.mix(k.math('MULTIPLY', k.bereich(gross, 0.40, 0.75), bleich), f, k.mix(0.5, f, heller(farbe, 1.9, 0.04)))   # ausgeblichen
    fleck = k.bereich(k.rauschen(g.p, 19.0, 4.0, 0.65), 0.46, 0.72, 0.0, 1.0, True)
    f = k.mix(k.math('MULTIPLY', fleck, flecken), f, k.mix(1.0, f, (0.55, 0.50, 0.44), 'MULTIPLY'))                      # Gebrauchsflecken: dunkler, stumpfer
    hoehe = g.tex(mscan(scan, 'disp'), False)
    rauh = k.math('MULTIPLY', k.bereich(k.grau(g.tex(mscan(scan, 'rough'), False)), 0.0, 1.0, 0.8, 1.0), rau)
    if ruhe:
        rand = k.attr('rand'); ab = k.math('MULTIPLY', k.attr('abrieb'), k.bereich(k.rauschen(g.p, 38.0, 3.0, 0.7), 0.35, 0.65))
        f = k.mix(k.math('MULTIPLY', ab, 0.8), f, k.mix(0.7, f, heller(farbe, 2.4, 0.07)))          # durchgescheuert: heller, fadenscheinig
        rauh = k.math('SUBTRACT', rauh, k.math('MULTIPLY', ab, 0.12))
        dreck = k.math('MULTIPLY', k.bereich(rand, 0.0, saum, 1.0, 0.0, True), k.bereich(k.rauschen(g.p, 14.0, 4.0, 0.7), 0.25, 0.7))
        f = k.mix(k.math('MULTIPLY', dreck, schmutz), f, (0.085, 0.066, 0.050))
        kante = puls(k, rand, 0.0, 0.011, 0.002); stich = puls(k, rand, 0.0125, 0.0008, 0.0008)
        hoehe = k.math('ADD', hoehe, k.math('SUBTRACT', k.math('MULTIPLY', kante, 0.6), k.math('MULTIPLY', stich, 0.8)))   # umgelegter Saum steht auf, die Stichlinie zieht ein
        f = k.mix(k.math('MULTIPLY', stich, 0.5), f, (0.05, 0.04, 0.03))
        px = k.xyz(g.p)
        for achse, wert, maske, ab_ in naehte:
            mk = k.math('GREATER_THAN', k.math('ABSOLUTE', px['xyz'.index(maske)]), ab_) if ab_ >= 0 else k.math('LESS_THAN', k.math('ABSOLUTE', px['xyz'.index(maske)]), -ab_)
            n_ = k.math('MULTIPLY', puls(k, px['xyz'.index(achse)], wert, 0.0014, 0.0014), mk)
            hoehe = k.math('SUBTRACT', hoehe, k.math('MULTIPLY', n_, 0.9)); f = k.mix(k.math('MULTIPLY', n_, 0.45), f, (0.04, 0.035, 0.03))
        if stiche:   # Flicken: Stichreihe als Punkte nahe der Kante
            nah = puls(k, rand, 0.005, 0.0012, 0.0006)
            sx = k.math('GREATER_THAN', k.math('SINE', k.math('MULTIPLY', px[0], 900.0)), 0.0)
            sy = k.math('GREATER_THAN', k.math('SINE', k.math('MULTIPLY', px[1], 900.0)), 0.0)
            st = k.math('MULTIPLY', k.math('MAXIMUM', sx, sy), nah); f = k.mix(st, f, (0.52, 0.47, 0.38)); hoehe = k.math('ADD', hoehe, k.math('MULTIPLY', st, 0.7))
    if moos is not None:
        nz = k.xyz(k.n('ShaderNodeNewGeometry').outputs['Normal'])[2]
        mm = k.math('MULTIPLY', k.bereich(nz, 0.25, 0.75), k.bereich(k.rauschen(g.p, 11.0, 4.0, 0.65), 0.38, 0.62, 0.0, 1.0, True))
        mf_ = k.mix(k.rauschen(g.p, 60.0, 2.0, 0.5), (*moos,), tuple(c * 0.45 for c in moos))
        f = k.mix(mm, f, mf_); hoehe = k.math('ADD', hoehe, k.math('MULTIPLY', mm, k.math('MULTIPLY', k.rauschen(g.p, 130.0, 2.0, 0.5), 3.0)))
        rauh = k.mixf(mm, rauh, 1.0)
    k.setze(b.inputs['Base Color'], f); k.setze(b.inputs['Roughness'], rauh)
    try:
        b.inputs['Sheen Weight'].default_value = flaum * 0.35; b.inputs['Sheen Roughness'].default_value = 0.5; b.inputs['Sheen Tint'].default_value = (*heller(farbe, 1.6, 0.02), 1)
    except Exception as e: print('Sheen', e)
    b.inputs['Specular IOR Level'].default_value = 0.25
    bp = k.n('ShaderNodeBump'); bp.inputs['Strength'].default_value = min(1.0, relief * 1.5); bp.inputs['Distance'].default_value = 0.0022
    k.setze(bp.inputs['Height'], hoehe); k.nt.links.new(bp.outputs[0], b.inputs['Normal'])
    return m


def mat_leder(name, farbe, scan='brown_leather', mass=0.35, rau=0.62, ruhe=False, risse=0.6, speck=0.3):
    """Leder: Narbung aus dem Scan, Risse als feines Zellnetz in den Knickzonen (grobes Rauschen), abgegriffene
    Stellen glatter und dunkler (Speck), offene Kanten rau und heller."""
    m, k, b, out = neues_material(name, False)
    g = Gewebe(k, mass, ruhe)
    hell = k.grau(g.tex(mscan(scan, 'diff')))
    f = k.mix(1.0, (*farbe,), k.mix(1.0, (1, 1, 1), k.bereich(hell, 0.02, 0.6, 0.45, 1.5), 'MULTIPLY'), 'MULTIPLY')
    zone = k.bereich(k.rauschen(g.p, 7.0, 3.0, 0.6), 0.42, 0.68)
    v = k.n('ShaderNodeTexVoronoi'); v.feature = 'DISTANCE_TO_EDGE'; v.inputs['Scale'].default_value = 190.0; k.nt.links.new(g.p, v.inputs['Vector'])
    riss = k.math('MULTIPLY', k.bereich(v.outputs['Distance'], 0.0, 0.035, 1.0, 0.0), k.math('MULTIPLY', zone, risse))
    f = k.mix(k.math('MULTIPLY', riss, 0.75), f, heller(farbe, 2.6, 0.08))         # Risse zeigen das helle Innere
    fett = k.bereich(k.rauschen(g.p, 4.0, 2.0, 0.5), 0.5, 0.8)
    f = k.mix(k.math('MULTIPLY', fett, speck), f, tuple(c * 0.45 for c in farbe))
    rauh = k.math('SUBTRACT', k.math('MULTIPLY', k.bereich(k.grau(g.tex(mscan(scan, 'rough'), False)), 0.0, 1.0, 0.75, 1.1), rau), k.math('MULTIPLY', fett, speck * 0.5))
    hoehe = k.math('SUBTRACT', g.tex(mscan(scan, 'disp'), False), k.math('MULTIPLY', riss, 1.2))
    if ruhe:
        kante = k.bereich(k.attr('rand'), 0.0, 0.006, 1.0, 0.0)
        f = k.mix(k.math('MULTIPLY', kante, 0.5), f, heller(farbe, 2.0))
    k.setze(b.inputs['Base Color'], f); k.setze(b.inputs['Roughness'], rauh); b.inputs['Specular IOR Level'].default_value = 0.45
    bp = k.n('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.6; bp.inputs['Distance'].default_value = 0.0015
    k.setze(bp.inputs['Height'], hoehe); k.nt.links.new(bp.outputs[0], b.inputs['Normal'])
    return m


def mat_metall(name, farbe=(0.20, 0.19, 0.18), rost=0.45, blank=0.25):
    """Angelaufenes Eisen: dunkle Zunderhaut, Rost aus dem Scan in Flecken, blanke Stellen an Schneide und Kanten."""
    m, k, b, out = neues_material(name, False)
    g = Gewebe(k, 0.5, False)
    r = g.tex(mscan('rusty_metal_02', 'diff'))
    fleck = k.bereich(k.math('ADD', k.rauschen(g.p, 9.0, 4.0, 0.7), k.math('MULTIPLY', k.grau(r), 0.4)), 0.62 - rost * 0.25, 0.80)
    f = k.mix(fleck, (*farbe,), k.mix(1.0, r, (0.62, 0.42, 0.30), 'MULTIPLY'))
    geo = k.n('ShaderNodeNewGeometry')
    schneide = k.math('MULTIPLY', k.bereich(geo.outputs['Pointiness'], 0.52, 0.62), blank * 3.0, clamp=True)
    f = k.mix(schneide, f, (0.52, 0.50, 0.47))
    k.setze(b.inputs['Base Color'], f); k.setze(b.inputs['Metallic'], k.mixf(fleck, 0.9, 0.15))
    k.setze(b.inputs['Roughness'], k.math('SUBTRACT', k.mixf(fleck, 0.48, 0.85), k.math('MULTIPLY', schneide, 0.2)))
    bp = k.n('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.5; bp.inputs['Distance'].default_value = 0.0015
    k.setze(bp.inputs['Height'], k.math('ADD', g.tex(mscan('rusty_metal_02', 'disp'), False), k.math('MULTIPLY', k.rauschen(g.p, 45.0, 3.0, 0.6), 0.6)))
    k.nt.links.new(bp.outputs[0], b.inputs['Normal'])
    return m


def mat_schaft(name, farbe=(0.30, 0.20, 0.13), mass=0.5, griff=0.3):
    """Schaftholz: Maserung längs (Scan entlang der Objekt-z-Achse gestreckt), handpoliert, wo man es greift."""
    m, k, b, out = neues_material(name, False)
    p = k.n('ShaderNodeTexCoord').outputs['Object']
    v = k.abbild(p, (1 / mass, 1 / mass, 0.22 / mass))
    hell = k.grau(k.tex(v, mscan('rough_wood', 'diff')))
    f = k.mix(1.0, (*farbe,), k.mix(1.0, (1, 1, 1), k.bereich(hell, 0.05, 0.7, 0.45, 1.5), 'MULTIPLY'), 'MULTIPLY')
    fett = k.bereich(k.rauschen(p, 3.0, 2.0, 0.5), 0.45, 0.75)
    f = k.mix(k.math('MULTIPLY', fett, griff), f, tuple(c * 0.5 for c in farbe))
    k.setze(b.inputs['Base Color'], f); k.setze(b.inputs['Roughness'], k.mixf(fett, 0.62, 0.40))
    bp = k.n('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.5; bp.inputs['Distance'].default_value = 0.002
    k.setze(bp.inputs['Height'], k.tex(v, mscan('rough_wood', 'disp'), False)); k.nt.links.new(bp.outputs[0], b.inputs['Normal'])
    return m


def mat_einfach(name, farbe, rau=0.5, metall=0.0, licht=None, staerke=0.0):
    m, k, b, out = neues_material(name, False)
    b.inputs['Base Color'].default_value = (*farbe, 1); b.inputs['Roughness'].default_value = rau; b.inputs['Metallic'].default_value = metall
    if licht: b.inputs['Emission Color'].default_value = (*licht, 1); b.inputs['Emission Strength'].default_value = staerke
    return m


# ───────────────────────────── Zubehör ─────────────────────────────
def kleid(o, mat, dicke=0.0025, fein=2):
    """Geschneidertes Stück fertig machen: Material, Unterteilung beim Rendern, Stoffdicke."""
    o.data.materials.clear(); o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth = True
    sd = o.modifiers.new('fein', 'SUBSURF'); sd.levels = 0; sd.render_levels = min(fein, int(os.environ.get('MENSCH_FEIN', '1')))
    if dicke:
        so = o.modifiers.new('Dicke', 'SOLIDIFY'); so.thickness = dicke; so.offset = -1.0
    return o


def fest_machen(o, mat, glatt=True):
    o.data.materials.clear(); o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth = glatt
    return o


def platte(name, umriss, dicke, W=None):
    """Flaches Teil aus einem Umriss (x, z) mit Dicke je Punkt (Funktion von x, z) — Klingen, Axtblatt."""
    bm = bmesh.new(); oben, unten = [], []
    for x, z in umriss:
        d = dicke(x, z) / 2
        oben.append(bm.verts.new((x, -d, z))); unten.append(bm.verts.new((x, d, z)))
    f1 = bm.faces.new(oben); f2 = bm.faces.new(list(reversed(unten)))
    n = len(umriss)
    for i in range(n): bm.faces.new((oben[i], unten[i], unten[(i + 1) % n], oben[(i + 1) % n]))
    bmesh.ops.triangulate(bm, faces=[f1, f2]); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if W is not None: me.transform(W)
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    return o


def quader(name, mass, W, rund=0.15, glatt=True):
    bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.object; o.name = name; o.scale = mass
    bpy.ops.object.transform_apply(scale=True); o.data.transform(W)
    bv = o.modifiers.new('Kante', 'BEVEL'); bv.width = min(mass) * rund; bv.segments = 3
    for p in o.data.polygons: p.use_smooth = glatt
    return o


def lage(ort, z, x=None):
    """Matrix: Ursprung `ort`, +Z entlang `z`, +X möglichst entlang `x`."""
    zz = Vector(z).normalized(); xx = Vector(x) if x is not None else zz.orthogonal()
    xx = (xx - zz * zz.dot(xx)).normalized(); yy = zz.cross(xx)
    M = Matrix((xx, yy, zz)).transposed().to_4x4(); M.translation = Vector(ort)
    return M


def wickel(name, bvh, a, e, t0, t1, windungen, breite, dicke, grenze, n=26):
    """Band in Schraubenlinie um ein Glied (Achse a → e), liegt auf der äussersten Schicht: Wadenwickel, Griffwicklung."""
    a, e = Vector(a), Vector(e); ax = (e - a).normalized()
    u = ax.orthogonal().normalized(); v = ax.cross(u); ring, kipp = [], []
    N = int(windungen * n)
    for i in range(N + 1):
        t = t0 + (t1 - t0) * i / N; w = 2 * math.pi * i / n; d = u * math.cos(w) + v * math.sin(w); c = a + (e - a) * t
        p = aussen(bvh, c, d, grenze) or (c + d * grenze * 0.5)
        ring.append((p, d)); kipp.append(ax)
    return band(name, ring, ax, breite, dicke, 0.0015, False, kipp)


def flicken(name, bvh, ort, normale, breite, hoehe, mat, dreh=0.0, n=9):
    """Aufgenähter Flicken: kleines Gitter, entlang der Normalen auf das Kleidungsstück gelegt, knapp darüber."""
    nz = Vector(normale).normalized(); u = nz.orthogonal().normalized(); v = nz.cross(u)
    u, v = u * math.cos(dreh) + v * math.sin(dreh), v * math.cos(dreh) - u * math.sin(dreh)
    vs, fs, ruhe, rand = [], [], [], []
    for j in range(n + 1):
        for i in range(n + 1):
            a, b_ = (i / n - 0.5) * breite, (j / n - 0.5) * hoehe
            p = Vector(ort) + u * a + v * b_ + nz * 0.04
            t, nn, _, _ = bvh.ray_cast(p, -nz, 0.09)
            vs.append((t + nz * 0.0018) if t else (p - nz * 0.04)); ruhe.append((a, b_, 0.0)); rand.append(min(breite / 2 - abs(a), hoehe / 2 - abs(b_)))
    for j in range(n):
        for i in range(n): fs.append((j * (n + 1) + i, j * (n + 1) + i + 1, (j + 1) * (n + 1) + i + 1, (j + 1) * (n + 1) + i))
    o = netz(name, vs, fs); me = o.data
    me.attributes.new('ruhe', 'FLOAT_VECTOR', 'POINT').data.foreach_set('vector', np.array(ruhe, np.float32).ravel())
    me.attributes.new('ruhe_n', 'FLOAT_VECTOR', 'POINT').data.foreach_set('vector', np.tile((0, 0, 1.0), len(vs)).astype(np.float32))
    me.attributes.new('rand', 'FLOAT', 'POINT').data.foreach_set('value', np.array(rand, np.float32))
    me.attributes.new('abrieb', 'FLOAT', 'POINT').data.foreach_set('value', np.zeros(len(vs), np.float32))
    return kleid(o, mat, 0.0012, 1)


def aufsatz(name, bvh, ort, normale, laengs, laenge, breite, mat, nx=14, ny=6, abheben=0.0008, ecke=0.25):
    """Kleines Teil, das der Haut folgt (Marke, Leiterbahn): Gitter mit runden Ecken, entlang −normale aufgelegt."""
    nz = Vector(normale).normalized(); u = (Vector(laengs) - nz * nz.dot(Vector(laengs))).normalized(); v = nz.cross(u)
    vs, fs = [], []
    for j in range(ny + 1):
        for i in range(nx + 1):
            a, b_ = (i / nx - 0.5), (j / ny - 0.5)
            if abs(a) * 2 > 1 - ecke and abs(b_) * 2 > 1 - ecke:   # Ecke einziehen
                ca, cb = math.copysign(0.5 - ecke / 2, a), math.copysign(0.5 - ecke / 2, b_)
                dv = Vector((a - ca, b_ - cb))
                if dv.length > ecke / 2: dv *= (ecke / 2) / dv.length; a, b_ = ca + dv.x, cb + dv.y
            p = Vector(ort) + u * a * laenge + v * b_ * breite + nz * 0.03
            t, nn, _, _ = bvh.ray_cast(p, -nz, 0.08)
            vs.append((t + nz * abheben) if t else (p - nz * 0.03))
    for j in range(ny):
        for i in range(nx): fs.append((j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i))
    o = netz(name, vs, fs); fest_machen(o, mat)
    so = o.modifiers.new('Dicke', 'SOLIDIFY'); so.thickness = abheben * 1.8; so.offset = 1.0
    return o


def lerp(a, b, t): return Vector(a) * (1 - t) + Vector(b) * t


def guertel(name, bvh, G, m, hoehe=0.7, breite=0.042, dicke=0.004, grenze=0.25, mat=None, schnalle=True):
    """Gürtel um die oberste Schicht, mit Schnalle vorn. Gibt (Objekte, Ring) zurück — am Ring hängt das Zubehör."""
    mitte = lerp(G['pelvis'], G['spine_01'], hoehe); nz = (G['spine_02'] - G['pelvis']).normalized()
    ring, nz = umlauf(bvh, mitte, nz, grenze * m, 72, G['vorn'])
    o = [fest_machen(band(name, ring, nz, breite * m, dicke, 0.001), mat or mat_leder(name, (0.085, 0.052, 0.032), ruhe=False), False)]
    if schnalle:
        p, dd = ring[0]
        bpy.ops.mesh.primitive_torus_add(major_radius=breite * m * 0.78, minor_radius=0.0032, major_segments=4, minor_segments=8)
        s = bpy.context.object; s.name = name + '_schnalle'; s.data.transform(lage(p + dd * (dicke + 0.004), dd, nz) @ Matrix.Rotation(math.pi / 4, 4, 'Z'))
        o.append(fest_machen(s, mat_metall(name + '_schnalle', rost=0.3)))
    return o, ring, nz


def tasche(name, ring, nz, i, mass, mat, klappe=True):
    """Gürteltasche am Ringpunkt `i`: Körper und Klappe aus gerundeten Quadern."""
    p, dd = ring[i % len(ring)]
    Wt = lage(p + dd * (mass[1] / 2 + 0.006) - nz * (mass[2] * 0.42), nz, dd.cross(nz))
    o = [fest_machen(quader(name, mass, Wt, 0.22), mat)]
    if klappe: o.append(fest_machen(quader(name + '_klappe', (mass[0] * 1.06, mass[1] * 1.12, mass[2] * 0.5), Wt @ Matrix.Translation((0, -0.002, mass[2] * 0.30)), 0.2), mat))
    return o


def marke(G, W, m, bvh_haut):
    """Die Marke am linken Unterarm: dunkle Platte in der Haut, drei Leiterbahnen in der Signalfarbe (Pass-Index 7)."""
    E, H = G['lowerarm_l'], G['hand_l']; ax = (H - E).normalized()
    Wr = W['lowerarm_l'].to_3x3(); ax0 = (Wr.inverted() @ ax).normalized()
    rueck0 = (Vector((0, 0, 1)) - ax0 * ax0.z).normalized()      # Handrücken-Seite: in der Ruhelage oben
    rueck = (Wr @ rueck0).normalized(); quer = ax.cross(rueck)
    c = lerp(E, H, 0.56); ort = aussen(bvh_haut, c, rueck, 0.08 * m) or c + rueck * 0.04
    o = [aufsatz('marke', bvh_haut, ort, rueck, ax, 0.044 * m, 0.020 * m, mat_einfach('Marke', (0.03, 0.04, 0.045), 0.32, 0.7), abheben=0.0012)]
    spur = mat_einfach('Markenspur', tuple(c_ * 0.25 for c_ in SIGNAL), 0.3, 0.0, SIGNAL, float(os.environ.get('MENSCH_MARKE', '2.5')))
    for versatz, entlang, lang in ((0.0, 0.050, 0.050), (0.0058, 0.042, 0.032), (-0.0058, -0.040, 0.030), (0.0, -0.046, 0.040)):
        s = aufsatz('markenspur', bvh_haut, ort + ax * entlang * m + quer * versatz * m, rueck, ax, lang * m, 0.0013, spur, nx=18, ny=1, abheben=0.0006, ecke=0.0)
        s.pass_index = 7; o.append(s)
    kern = aufsatz('markenkern', bvh_haut, ort + rueck * 0.0014, rueck, ax, 0.016 * m, 0.0022, spur, nx=8, ny=2, abheben=0.0022, ecke=0.6); kern.pass_index = 7; o.append(kern)
    return o


def ausweichen(o, bvh, mitte, luft=0.004, grenze=0.4):
    """Schiebt Vertices, die in der Figur stecken, entlang des Strahls von `mitte` nach aussen vor die oberste Schicht."""
    mitte = Vector(mitte); n = 0
    for v in o.data.vertices:
        d = v.co - mitte; l = d.length
        if l < 1e-6: continue
        t = aussen(bvh, mitte, d / l, min(grenze, l + 0.05))
        if t is not None and (t - mitte).length > l - luft: v.co = t + d / l * luft; n += 1
    return n


def hut(G, W, m, bvh_kopf, filz, leder):
    """Walkhut: weiche Krone, breite, verzogene Krempe — in Ruhekoordinaten um den Kopf gebaut, mit dem Kopfknochen in
    die Pose gebracht, dann vor Stirn und Haar geschoben."""
    zt = G['ruhe']['head.ende'].z; yc = -0.022 * m
    prof = [(0.002, 0.052), (0.040, 0.052), (0.074, 0.044), (0.090, 0.020), (0.096, -0.015), (0.099, -0.046), (0.118, -0.054), (0.150, -0.060), (0.185, -0.068), (0.210, -0.078)]

    def verzug(me, krempe_ab):
        for v in me.vertices:
            x, y, z = v.co.x, v.co.y - yc, v.co.z - zt
            r = math.hypot(x, y); a = math.atan2(x, -y); t = max(0.0, (r - krempe_ab * m) / (0.11 * m))
            z += t * m * (0.016 * math.sin(2 * a + 0.8) - 0.020 * math.cos(a) + 0.008 * math.sin(5 * a + 2.0)) - 0.006 * m * math.sin(a) * (1 - t)   # Krempe hängt vorn, schlägt seitlich
            if z > 0.02 * m: x += 0.010 * m * math.sin(3 * a) * (z / (0.05 * m)); z -= 0.012 * m * max(0.0, math.cos(a - 0.6))   # eingedrückte Krone
            v.co = (x, y + yc, z + zt)
    Wk = W['head'] @ Matrix.Translation((0, yc, zt - 0.006 * m)) @ Matrix.Rotation(math.radians(-5), 4, 'X') @ Matrix.Translation((0, -yc, -zt))
    o = drehkoerper('hut', [(r * m, zt + z * m, 0.90, 1.12) for r, z in prof], 56, mitte=lambda i: (0.0, yc))
    verzug(o.data, 0.099); o.data.transform(Wk)
    kopfmitte = W['head'] @ Vector((0, yc, zt - 0.10 * m))
    ausweichen(o, bvh_kopf, kopfmitte, 0.004, 0.25 * m)
    fest_machen(o, filz)
    sd = o.modifiers.new('fein', 'SUBSURF'); sd.levels = 0; sd.render_levels = 2
    so = o.modifiers.new('Dicke', 'SOLIDIFY'); so.thickness = 0.0035; so.offset = 1.0
    b_ = drehkoerper('hutband', [(0.1005 * m, zt - 0.044 * m, 0.90, 1.12), (0.0985 * m, zt - 0.022 * m, 0.90, 1.12)], 56, mitte=lambda i: (0.0, yc))
    verzug(b_.data, 0.099); b_.data.transform(Wk); fest_machen(b_, leder)
    so = b_.modifiers.new('Dicke', 'SOLIDIFY'); so.thickness = 0.002; so.offset = 1.0
    return [o, b_]


def zubehoer_brachgaenger(name, T, G, W, m):
    vorn, links, oben = G['vorn'], G['links'], G['oben']; neu = []
    seite = [('y', 0.0, 'x', 0.11 * m)]
    kleid(T['hemd'], mat_stoff('Leinenhemd', 'rough_linen', 0.46, (0.56, 0.47, 0.33), flaum=0.1, naehte=seite, schmutz=0.7), 0.0016)
    kleid(T['hose'], mat_stoff('Wollhose', 'poly_wool_herringbone', 0.40, (0.085, 0.064, 0.048), flaum=0.3, naehte=[('y', -0.01 * m, 'x', 0.03 * m)], schmutz=0.8, saum=0.0), 0.0025)
    kleid(T['weste'], mat_stoff('Lodenweste', 'caban', 0.42, (0.060, 0.098, 0.058), flaum=0.5, naehte=seite + [('x', 0.0, 'z', 0.0)], schmutz=0.35, saum=0.04), 0.004)
    kleid(T['wetterfleck'], mat_stoff('Wetterfleck', 'caban', 0.42, (0.062, 0.050, 0.038), flaum=0.6, schmutz=0.55, saum=0.09, bleich=0.35), 0.0045)
    kleid(T['schuhe'], mat_leder('Schuhleder', (0.060, 0.038, 0.024), ruhe=True, risse=0.8, speck=0.2), 0.0, 2)
    bvh = weltnetz([T[k] for k in ('koerper', 'hemd', 'hose', 'weste')])
    # Gürtel, Tasche, Axt
    g, ring, nz = guertel('guertel', bvh, G, m); neu += g
    leder = mat_leder('Taschenleder', (0.095, 0.058, 0.034), ruhe=False, risse=0.7)
    neu += tasche('tasche', ring, nz, 60, (0.105 * m, 0.045 * m, 0.125 * m), leder)
    neu += tasche('beutel', ring, nz, 51, (0.06 * m, 0.04 * m, 0.075 * m), mat_stoff('Beutel', 'hessian_380', 0.50, (0.20, 0.16, 0.11), ruhe=False), False)
    p, dd = ring[21]; kopf = p + dd * 0.030 + oben * 0.035 * m; hinten = (dd - vorn * 0.5).normalized()
    stiel = schlauch('axtstiel', [kopf + oben * 0.03, kopf - oben * 0.20 + dd * 0.012, kopf - oben * 0.44 * m + dd * 0.03 - vorn * 0.03], lambda t: 0.0135 + 0.002 * math.sin(t * 3.0), 12)
    neu.append(fest_machen(stiel, mat_schaft('Axtstiel', (0.22, 0.14, 0.085))))
    blatt = platte('axtblatt', [(-0.020, 0.022), (0.030, 0.018), (0.085, 0.042), (0.112, 0.030), (0.120, -0.020), (0.108, -0.072), (0.080, -0.062), (0.040, -0.022), (-0.020, -0.024)],
                   lambda x, z: max(0.0009, 0.028 * (1 - max(0.0, x - 0.012) / 0.108)), lage(kopf, oben, hinten))
    neu.append(fest_machen(blatt, mat_metall('Axteisen', rost=0.5, blank=0.5), False))
    # Quergurt aus altem Gurtband über die rechte Schulter
    S = G['upperarm_r'] + oben * 0.06 * m + links * 0.06 * m; H = ring[20][0]
    qr, qn = umlauf(bvh, lerp(G['spine_03'], G['spine_01'], 0.35), (S - H).cross(vorn), 0.30 * m, 80, vorn)
    neu.append(fest_machen(band('quergurt', qr, qn, 0.040 * m, 0.0022, 0.0015), mat_stoff('Gurtband', 'poly_wool_herringbone', 0.09, (0.045, 0.047, 0.045), flaum=0.0, rau=0.6, ruhe=False), False))
    # Wadenwickel über Hose und Schuh
    bvh2 = weltnetz([T[k] for k in ('koerper', 'hose', 'schuhe')])
    wolle = mat_stoff('Wickel', 'wool_boucle', 0.10, (0.16, 0.135, 0.10), flaum=0.5, ruhe=False, schmutz=0.0)
    for s in 'lr':
        neu.append(fest_machen(wickel('wickel_' + s, bvh2, G['foot_' + s], G['calf_' + s], 0.03, 0.74, 6.5, 0.074 * m, 0.003, 0.115 * m), wolle, False))
    # gekrempelter linker Ärmel
    bvh3 = weltnetz([T['koerper'], T['hemd']]); ax = (G['hand_l'] - G['lowerarm_l']).normalized()
    kr, kn = umlauf(bvh3, lerp(G['lowerarm_l'], G['hand_l'], 0.13), ax, 0.075 * m, 40, ax.orthogonal())
    neu.append(fest_machen(band('krempe', kr, kn, 0.042 * m, 0.008, 0.0), mat_stoff('Krempe', 'rough_linen', 0.46, (0.56, 0.47, 0.33), flaum=0.1, ruhe=False)))
    neu += marke(G, W, m, weltnetz([T['koerper']]))
    filz = mat_stoff('Hutfilz', 'caban', 0.5, (0.060, 0.050, 0.040), flaum=0.5, relief=0.25, ruhe=False, bleich=0.3)
    neu += hut(G, W, m, weltnetz([T['koerper'], T['hair']]), filz, leder)
    # Speer: Schaft durch die rechte Faust, Blatt aus einer umgeschmiedeten Blattfeder
    faust = griff(G, 'r')[0]
    fuss = Vector((faust.x - 0.02, faust.y - 0.05, 0.0)); ri = (faust - fuss).normalized(); spitze = fuss + ri * 2.02 * m
    neu.append(fest_machen(schlauch('speerschaft', [fuss + ri * (2.02 * m * i / 24) + Vector((math.sin(i * 0.9) * 0.003, math.cos(i * 0.6) * 0.003, 0)) for i in range(25)], lambda t: 0.0155 - 0.003 * t, 12),
                           mat_schaft('Speerschaft', (0.25, 0.165, 0.10))))
    Ws = lage(spitze, ri, vorn.cross(ri))
    neu.append(fest_machen(platte('speerblatt', [(0, 0.245), (0.018, 0.17), (0.026, 0.10), (0.019, 0.035), (0.012, -0.01), (-0.012, -0.01), (-0.019, 0.035), (-0.026, 0.10), (-0.018, 0.17)],
                                  lambda x, z: 0.0012 + 0.0075 * (1 - abs(x) / 0.031), Ws), mat_metall('Speereisen', rost=0.35, blank=0.6), False))
    neu.append(fest_machen(schlauch('speertuelle', [spitze - ri * 0.11, spitze + ri * 0.01], lambda t: 0.0165 - 0.004 * t, 12), mat_metall('Speertuelle', rost=0.6, blank=0.1)))
    wd = [spitze - ri * (0.13 + 0.05 * i / 90) + (Ws.to_3x3() @ Vector((math.cos(i * 0.7), math.sin(i * 0.7), 0))) * 0.0165 for i in range(91)]
    neu.append(fest_machen(schlauch('speerwicklung', wd, 0.0021, 6), mat_stoff('Schnur', 'hessian_380', 0.1, (0.26, 0.21, 0.14), ruhe=False)))
    # Hornknöpfe an der Weste, Flicken
    bw = weltnetz([T['weste']]); horn = mat_einfach('Horn', (0.10, 0.075, 0.05), 0.4)
    for i in range(4):
        c = lerp(G['spine_01'], G['spine_03'], 0.15 + i * 0.42) + links * 0.012 * m
        t = aussen(bw, c, vorn, 0.25 * m)
        if t:
            bpy.ops.mesh.primitive_cylinder_add(radius=0.0085 * m, depth=0.004, vertices=14); kn_ = bpy.context.object; kn_.name = 'knopf'
            kn_.data.transform(lage(t + vorn * 0.003, vorn)); neu.append(fest_machen(kn_, horn))
    bh = weltnetz([T['hose']])
    t = aussen(bh, G['calf_l'] + oben * 0.02, vorn, 0.12 * m)
    if t: neu.append(flicken('flicken_knie', bh, t, vorn, 0.095 * m, 0.12 * m, mat_leder('Flickleder', (0.11, 0.07, 0.04), ruhe=True, risse=0.9), 0.15))
    t = aussen(bw, lerp(G['spine_01'], G['spine_02'], 0.8) - links * 0.09 * m, (vorn - links * 0.5).normalized(), 0.25 * m)
    if t: neu.append(flicken('flicken_weste', bw, t, (vorn - links * 0.5).normalized(), 0.075 * m, 0.06 * m, mat_stoff('Flickloden', 'caban', 0.42, (0.15, 0.115, 0.075), stiche=True, schmutz=0.0), -0.2))
    return neu


def griff(G, seite):
    """Faust: (Punkt in der Faust, Achse quer durch die Hand vom kleinen Finger zum Zeigefinger)."""
    ax = (G['index_01_' + seite] - G['pinky_01_' + seite]).normalized()
    hand = (G['middle_01_' + seite] - G['hand_' + seite]).normalized()
    innen = ax.cross(hand) * (1 if seite == 'r' else -1)
    return lerp(G['hand_' + seite], G['middle_01_' + seite], 0.95) + innen * 0.028, ax, innen


def seil(name, ring, radius, mat, n=8):
    """Geschlossenes Seil entlang eines Rings."""
    pts = [p + d * radius for p, d in ring]
    return fest_machen(schlauch(name, pts + pts[:2], radius, n, False), mat)


def haengen(name, a, e, durchhang, radius, mat, n=14, knoten=()):
    """Schnur von a nach e mit Durchhang; `knoten` = Wegparameter, an denen ein Knoten sitzt."""
    a, e = Vector(a), Vector(e); pts = [lerp(a, e, i / n) - Vector((0, 0, durchhang * 4 * (i / n) * (1 - i / n))) for i in range(n + 1)]
    o = [fest_machen(schlauch(name, pts, radius, 6), mat)]
    for t in knoten:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius * 2.1, location=lerp(a, e, t) - Vector((0, 0, durchhang * 4 * t * (1 - t))))
        kn = bpy.context.object; kn.name = name + '_knoten'; kn.scale = (1, 1, 1.35); o.append(fest_machen(kn, mat))
    return o


def zubehoer_schmiedin(name, T, G, W, m):
    vorn, links, oben = G['vorn'], G['links'], G['oben']; neu = []
    seite = [('y', 0.0, 'x', 0.10 * m)]
    leinen = (0.60, 0.52, 0.38)
    kleid(T['bluse'], mat_stoff('Leinenbluse', 'rough_linen', 0.46, leinen, flaum=0.1, naehte=seite, schmutz=0.5), 0.0016)
    kleid(T['rock'], mat_stoff('Wollrock', 'poly_wool_herringbone', 0.40, (0.062, 0.078, 0.060), flaum=0.3, schmutz=0.85, saum=0.11, bleich=0.3), 0.003)
    kleid(T['struempfe'], mat_stoff('Strumpf', 'wool_boucle', 0.16, (0.25, 0.22, 0.17), flaum=0.4, schmutz=0.3), 0.0, 1)
    kleid(T['schuhe'], mat_leder('Schuhleder_s', (0.055, 0.036, 0.024), ruhe=True, risse=0.8, speck=0.2), 0.0, 2)
    kleid(T['schuerze'], mat_leder('Schurzleder', (0.17, 0.082, 0.036), 'brown_leather', 0.45, 0.6, True, 0.9, 0.55), 0.0035)
    alles = weltnetz([T[k] for k in ('koerper', 'bluse', 'rock', 'schuerze')])
    riemen = mat_leder('Riemen', (0.07, 0.045, 0.028), ruhe=False)
    # Bindeband der Schürze, Nackenriemen
    g, ring, nz = guertel('schurzband', alles, G, m, 0.85, 0.022, 0.003, 0.27, riemen, False); neu += g
    ob = weltnetz([T[k] for k in ('koerper', 'bluse')]); z_latz = G['neck_01'].z - 0.125 * m
    for sx in (-1, 1):
        tr, tn = umlauf(ob, lerp(G['spine_02'], G['spine_03'], 0.6) + links * sx * 0.082 * m, links, 0.30 * m, 96, vorn)
        bogen = [(p_, d_) for p_, d_ in tr if p_.z > z_latz]      # von der Latzecke über die Schulter bis zwischen die Schulterblätter
        i0 = next(i for i in range(len(tr)) if tr[i][0].z <= z_latz and tr[(i + 1) % len(tr)][0].z > z_latz)
        bogen = [tr[(i0 + 1 + j) % len(tr)] for j in range(len(bogen))]
        if len(bogen) > 3: neu.append(fest_machen(band('traeger%d' % sx, bogen, links, 0.022 * m, 0.003, 0.0015, False), riemen, False))
    # gekrempelte Ärmel
    bb = weltnetz([T['koerper'], T['bluse']]); kr_mat = mat_stoff('Krempe_s', 'rough_linen', 0.46, leinen, flaum=0.1, ruhe=False)
    for s_ in 'lr':
        ax = (G['lowerarm_' + s_] - G['upperarm_' + s_]).normalized()
        kr, kn = umlauf(bb, lerp(G['upperarm_' + s_], G['lowerarm_' + s_], 0.80), ax, 0.085 * m, 40, ax.orthogonal())
        neu.append(fest_machen(band('krempe_' + s_, kr, kn, 0.045 * m, 0.009, 0.0), kr_mat))
    # Kopftuch (fest gebunden, im Nacken geknotet)
    tuch_mat = mat_stoff('Tuchknoten', 'rough_linen', 0.46, (0.27, 0.105, 0.070), flaum=0.1, ruhe=False, bleich=0.4)
    kopfmitte = W['head'] @ Vector((0, -0.024 * m, G['ruhe']['head.ende'].z - 0.104 * m))
    if 'hair' in T:
        Wi = W['head'].inverted(); bm = bmesh.new(); bm.from_mesh(T['hair'].data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if (Wi @ v.co).y > -0.078 * m or (Wi @ v.co).z < G['ruhe']['head'].z + 0.035 * m], context='VERTS')
        bm.to_mesh(T['hair'].data); bm.free()
    kleid(T['kopftuch'], mat_stoff('Kopftuch', 'rough_linen', 0.46, (0.27, 0.105, 0.070), flaum=0.1, bleich=0.4, schmutz=0.3, saum=0.03), 0.0018)
    hinten = (W['head'].to_3x3() @ Vector((0, 1, 0))).normalized(); kn_ort = kopfmitte + hinten * 0.095 * m - oben * 0.105 * m
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.021 * m, location=kn_ort); kno = bpy.context.object; kno.name = 'tuchknoten'; kno.scale = (1.3, 0.8, 0.9); neu.append(fest_machen(kno, tuch_mat))
    for i, dx in enumerate((-1, 1)):
        zipfel = gitter('zipfel%d' % i, kn_ort, links * dx * 0.045 * m + hinten * 0.01, -oben * 0.13 * m + hinten * 0.03 * m + links * dx * 0.02, 3, 6)
        fest_machen(zipfel, tuch_mat); so = zipfel.modifiers.new('Dicke', 'SOLIDIFY'); so.thickness = 0.002; neu.append(zipfel)
    # Hammer in der Rechten, Zange am Band
    eisen = mat_metall('Schmiedeeisen', rost=0.35, blank=0.4); holz = mat_schaft('Hammerstiel', (0.24, 0.155, 0.095))
    pt, ax, innen = griff(G, 'r')
    neu.append(fest_machen(schlauch('hammerstiel', [pt - ax * 0.085 * m, pt + ax * 0.26 * m], lambda t: 0.0145 + 0.0015 * math.sin(t * 3.1), 12), holz))
    neu.append(fest_machen(quader('hammerkopf', (0.036 * m, 0.105 * m, 0.036 * m), lage(pt + ax * 0.255 * m, ax, innen), 0.12), eisen))
    p_, dd = ring[57]
    for i, kipp in enumerate((-0.05, 0.05)):
        a_ = p_ + dd * 0.012 + oben * 0.02
        neu.append(fest_machen(schlauch('zange%d' % i, [a_, a_ - oben * 0.16 * m + links * kipp * 0.4, a_ - oben * 0.20 * m - links * kipp * 0.6, a_ - oben * 0.26 * m - links * kipp * 0.2], 0.0045, 8), eisen))
    # Flicken auf dem Rock, Brandflecken trägt die Schürze im Material
    br = weltnetz([T['rock']])
    for i, (h, sx, gr) in enumerate(((0.35, 0.16, (0.11, 0.13)), (0.62, -0.19, (0.085, 0.075)))):
        ri = (vorn * 0.6 + links * sx * 4).normalized(); c = lerp(G['pelvis'], G['calf_l' if sx > 0 else 'calf_r'], h); c.x, c.y = G['pelvis'].x, G['pelvis'].y
        t = aussen(br, c, ri, 0.45 * m)
        if t: neu.append(flicken('flicken_rock%d' % i, br, t, ri, gr[0] * m, gr[1] * m, mat_stoff('Flickwolle%d' % i, 'caban', 0.42, ((0.16, 0.13, 0.09), (0.075, 0.085, 0.07))[i], stiche=True, schmutz=0.0), 0.2 * i))
    return neu


def zubehoer_zaehler(name, T, G, W, m):
    vorn, links, oben = G['vorn'], G['links'], G['oben']; neu = []
    kutte = (0.185, 0.125, 0.070); moos = (0.085, 0.130, 0.030)
    for k_, dicke in (('kutte_oben', 0.0035), ('kutte_unten', 0.0035), ('gugel', 0.004)):
        kleid(T[k_], mat_stoff('Kutte_' + k_, 'hessian_380', 0.50, kutte if k_ != 'gugel' else (0.135, 0.098, 0.058), flaum=0.25, relief=0.7, schmutz=0.9, saum=0.14, bleich=0.4,
                               moos=moos, naehte=[('y', 0.0, 'x', 0.10 * m)] if k_ == 'kutte_oben' else ()), dicke)
    alles = weltnetz([T[k] for k in ('koerper', 'kutte_oben', 'kutte_unten')])
    hanf = mat_stoff('Hanfseil', 'hessian_380', 0.06, (0.30, 0.25, 0.16), flaum=0.3, relief=0.9, ruhe=False)
    mitte = lerp(G['pelvis'], G['spine_01'], 0.9); nz = (G['spine_02'] - G['pelvis']).normalized()
    ring, nz = umlauf(alles, mitte, nz, 0.27 * m, 72, vorn)
    neu.append(seil('strick', ring, 0.0075, hanf)); neu.append(seil('strick2', [(p_ - nz * 0.016, d_) for p_, d_ in ring], 0.0075, hanf))
    kp, kd = ring[6]; kpos = kp + kd * 0.018 - nz * 0.008
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.02, location=kpos); kn = bpy.context.object; kn.name = 'strickknoten'; kn.scale = (1.1, 0.9, 1.2); neu.append(fest_machen(kn, hanf))
    for i, (dx, lang) in enumerate(((0.012, 0.42), (-0.01, 0.33))):
        neu += haengen('strickende%d' % i, kpos, kpos - oben * lang * m + links * dx * 3 + kd * 0.02, -0.004, 0.0068, hanf, 10, (0.97,))
    # Zählschnur: Tragschnur von der rechten Faust zum Strick, daran Knotenschnüre (jede Schnur eine Zählung)
    pt, ax, innen = griff(G, 'r'); garn = mat_stoff('Zaehlgarn', 'rough_linen', 0.05, (0.36, 0.30, 0.20), flaum=0.2, ruhe=False)
    rot = mat_stoff('Zaehlgarn_rot', 'rough_linen', 0.05, (0.26, 0.085, 0.055), flaum=0.2, ruhe=False)
    a_ = pt + ax * 0.03; e_ = ring[66][0] + ring[66][1] * 0.02
    neu += haengen('zaehlschnur', a_, e_, 0.035 * m, 0.0032, garn, 18)
    rnd = random.Random(7)
    for i in range(9):
        t = 0.06 + 0.10 * i; o_ = lerp(a_, e_, t) - Vector((0, 0, 0.035 * m * 4 * t * (1 - t)))
        lang = rnd.uniform(0.18, 0.38) * m; kn_ = tuple(sorted(rnd.uniform(0.25, 0.95) for _ in range(rnd.randint(1, 4))))
        neu += haengen('knotenschnur%d' % i, o_, o_ - oben * lang + vorn * rnd.uniform(-0.01, 0.01) + links * rnd.uniform(-0.008, 0.008), -0.002, 0.0028, rot if i in (2, 6) else garn, 8, kn_)
    # Kerbholz: mannshoher Stab, Kerben in Fünfergruppen
    pl, axl, innenl = griff(G, 'l')
    fuss = Vector((pl.x + 0.02, pl.y - 0.04, 0.0)); ri = (pl - fuss).normalized(); lang = 1.86 * m; N = 460
    def radius(t):
        z = t * lang; r = 0.0185 - 0.004 * t + 0.0012 * math.sin(t * 23.0)
        if 0.55 * lang < z < 0.97 * lang:
            u = (z - 0.55 * lang) % 0.105
        return r
    def kerbe(i):
        z = i / N * lang; u = (z - 0.55 * lang) % 0.105
        return 0.55 * lang < z < 0.97 * lang and u < 0.075 and (u % 0.015) < 0.0065
    stab = schlauch('kerbholz', [fuss + ri * (lang * i / N) + Vector((math.sin(i * 0.021) * 0.008, math.cos(i * 0.017) * 0.006, 0)) for i in range(N + 1)], radius, 12)
    for i in range(N + 1):   # Kerben: Keile auf der dem Zähler zugewandten Seite, in Fünfergruppen
        if not kerbe(i): continue
        ring_ = [stab.data.vertices[i * 12 + k_] for k_ in range(12)]; mitte_ = sum((v.co for v in ring_), Vector()) / 12
        for v in ring_:
            c_ = (v.co - mitte_).normalized().dot((-vorn * 0.6 - links).normalized())
            if c_ > 0.2: v.co = v.co - (v.co - mitte_) * (0.42 * min(1.0, (c_ - 0.2) / 0.5))
    neu.append(fest_machen(stab, mat_schaft('Kerbholz', (0.30, 0.215, 0.135), 0.4, 0.4)))
    # Baumpilze am Stab, Flechtenbart
    pilz = mat_einfach('Baumpilz', (0.42, 0.30, 0.17), 0.85)
    for i, (h, w, gr) in enumerate(((0.36, 0.3, 0.036), (0.40, 1.1, 0.026), (0.455, -0.4, 0.030), (0.86, 2.0, 0.022))):
        d_ = (vorn * math.cos(w) + links * math.sin(w))
        bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=10, radius=gr * m); pz = bpy.context.object; pz.name = 'baumpilz%d' % i
        pz.data.transform(Matrix.Translation(fuss + ri * (h * lang) + d_ * (0.016 + gr * 0.55)) @ lage((0, 0, 0), oben, d_) @ Matrix.Scale(0.34, 4, (0, 0, 1)))
        neu.append(fest_machen(pz, pilz))
    # Moospolster auf Schultern und Kapuze: Geometrie aus dem Moos-Scan, gestreut nach dem Attribut `moos`
    if 'moos' not in OHNE:
        mm, km, bm_, out = neues_material('Moospolster', False); tcm = km.n('ShaderNodeTexCoord').outputs['Object']
        km.setze(bm_.inputs['Base Color'], km.mix(km.rauschen(tcm, 420.0, 2.0, 0.5), (0.050, 0.085, 0.018), (0.150, 0.190, 0.045))); bm_.inputs['Roughness'].default_value = 1.0
        bpm = km.n('ShaderNodeBump'); bpm.inputs['Strength'].default_value = 1.0; bpm.inputs['Distance'].default_value = 0.003
        km.setze(bpm.inputs['Height'], km.rauschen(tcm, 900.0, 2.0, 0.6)); km.nt.links.new(bpm.outputs[0], bm_.inputs['Normal'])
        ms = []
        for i in range(4):   # Polster: gedrückte, bucklige Kugeln (Durchmesser 1 m, die Streuung skaliert auf 2–5 cm)
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.5); po = bpy.context.object; rp = random.Random(40 + i)
            for v in po.data.vertices:
                f_ = 1 + 0.16 * math.sin(v.co.x * 9 + i) * math.cos(v.co.y * 11 + 2 * i) + 0.08 * rp.uniform(-1, 1); v.co = (v.co.x * f_, v.co.y * f_ * 0.85, max(-0.08, v.co.z * 0.42 * f_))
            for p_ in po.data.polygons: p_.use_smooth = True
            po.data.materials.append(mm); ms.append(po.data); bpy.data.objects.remove(po)
        col = hf.sammlung('Moos_' + name, ms)
        for k_ in ('gugel', 'kutte_oben'):
            o = T[k_]; me = o.data; nr = np.zeros(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('normal', nr); nr = nr.reshape(-1, 3); c = koord(o)
            w = np.clip((nr[:, 2] - 0.45) / 0.3, 0, 1) * (0.5 + 0.5 * np.sin(c[:, 0] * 31.0 + c[:, 1] * 17.0)) * (c[:, 2] > G['spine_03'].z + 0.12 * m)
            (me.attributes.get('moos') or me.attributes.new('moos', 'FLOAT', 'POINT')).data.foreach_set('value', w.astype(np.float32))
            ng = hf.streu_gn('Moos_%s_%s' % (name, k_), col, 'moos', 1100.0, 0.016, 0.05, 11, 0.4, False, True)
            md = o.modifiers.new('Moos', 'NODES'); md.node_group = ng
    return neu


FIGUREN = {
    'brachgaenger': dict(zubehoer=zubehoer_brachgaenger, kurz=True,   # lange Simulation: die Kante des Wetterflecks schlägt vor dem Kinn um
         haar_ton=(0.10, 0.085, 0.07), hautwerte=dict(wetter=0.55, schmutz=0.3, bart=0.6, leder=0.4, falten=0.12),
        makro={'gender': 1.0, 'age': 0.68, 'muscle': 0.72, 'weight': 0.42, 'proportions': 0.55, 'height': 0.6},
        ziele={'head-rectangular': 0.5, 'nose-hump-incr': 0.6, 'nose-scale-vert-incr': 0.3, '*cheek-bones-incr': 0.6, '*cheek-volume-decr': 0.6, 'chin-width-incr': 0.4,
               'chin-jaw-drop-incr': 0.3, 'eyebrows-trans-down': 0.5, 'eyebrows-angle-down': 0.3, '*eye-bag-incr': 0.5, 'mouth-angles-down': 0.4, 'mouth-scale-horiz-incr': 0.2, 'head-age-incr': 0.4,
               'eyebrows-left-down': 0.5, 'eyebrows-right-down': 0.6, 'eye-left-slit': 0.25, 'eye-right-slit': 0.3, 'mouth-compression': 0.4, 'nose-compression': 0.25},
        zutaten={'eyes': 'high-poly', 'eyebrows': 'eyebrow012', 'eyelashes': 'eyelashes01', 'teeth': 'teeth_base', 'hair': 'short04'},
        haut='middleage_caucasian_male', drehung=8, kleider=kleider_brachgaenger, tuecher=tuecher_brachgaenger,
        pose=[('spine_02', 'Z', -5), ('neck_01', 'Z', -9), ('head', 'Z', -12), ('head', 'X', 4),
              ('upperarm_r', (-0.22, 0.14, -0.96)), ('lowerarm_r', (-0.12, -0.90, 0.28)), ('faust_r', 86, 40),
              ('upperarm_l', (0.22, 0.12, -0.97)), ('lowerarm_l', (-0.49, -0.65, -0.58)), ('faust_l', 28),
              ('thigh_l', (0.10, -0.10, -1.0)), ('calf_l', (0.04, 0.07, -1.0)), ('foot_l', (0.20, -0.88, -0.44)),
              ('thigh_r', (-0.05, 0.0, -1.0)), ('calf_r', (-0.03, 0.0, -1.0)), ('foot_r', (-0.10, -0.89, -0.44))]),
    'schmiedin': dict(zubehoer=zubehoer_schmiedin, haar_ton=(0.13, 0.075, 0.04), hautwerte=dict(wetter=0.5, schmutz=0.45, leder=0.3, falten=0.10),
        makro={'gender': 0.0, 'age': 0.60, 'muscle': 0.75, 'weight': 0.66, 'proportions': 0.35, 'height': 0.5, 'cupsize': 0.45, 'firmness': 0.4},
        ziele={'head-round': 0.4, 'nose-width1-incr': 0.4, 'nose-scale-horiz-incr': 0.3, '*cheek-volume-incr': 0.4, 'chin-width-incr': 0.5, 'chin-prominent-decr': 0.2,
               'mouth-scale-horiz-incr': 0.3, 'mouth-lowerlip-volume-decr': 0.3, '*eye-bag-incr': 0.4, 'head-age-incr': 0.5, 'neck-double-incr': 0.3,
               'eyebrows-left-down': 0.3, 'eyebrows-right-down': 0.3, 'mouth-compression': 0.3, 'mouth-corner-puller': 0.2, 'measure-shoulder-dist-incr': 0.4},
        zutaten={'eyes': 'high-poly', 'eyebrows': 'eyebrow003', 'eyelashes': 'eyelashes01', 'teeth': 'teeth_base', 'hair': 'braid01'},
        haut='middleage_caucasian_female', drehung=20, kleider=kleider_schmiedin, tuecher=tuecher_schmiedin,
        pose=[('neck_01', 'Z', -6), ('head', 'Z', -10), ('head', 'X', 2),
              ('upperarm_l', (0.50, 0.22, -0.84)), ('lowerarm_l', (-0.60, -0.30, -0.74)), ('faust_l', 50),
              ('upperarm_r', (-0.17, 0.04, -0.98)), ('lowerarm_r', (-0.08, -0.34, -0.94)), ('faust_r', 84, 40),
              ('thigh_l', (0.14, -0.02, -1.0)), ('calf_l', (0.05, 0.03, -1.0)), ('foot_l', (0.28, -0.85, -0.44)),
              ('thigh_r', (-0.12, 0.0, -1.0)), ('calf_r', (-0.04, 0.02, -1.0)), ('foot_r', (-0.22, -0.87, -0.44))]),
    'zaehler': dict(zubehoer=zubehoer_zaehler, haar_ton=(0.8, 0.8, 0.8), hautwerte=dict(wetter=0.35, schmutz=0.5, bart=0.35, leder=0.45, ton=(0.80, 0.75, 0.71), falten=0.9),
        makro={'gender': 1.0, 'age': 0.92, 'muscle': 0.30, 'weight': 0.30, 'proportions': 0.45, 'height': 0.5},
        ziele={'head-oval': 0.5, 'nose-scale-vert-incr': 0.5, 'nose-point-down': 0.5, 'nose-hump-incr': 0.4, '*cheek-volume-decr': 0.9, '*cheek-bones-incr': 0.5,
               'chin-height-incr': 0.4, '*eye-bag-incr': 0.8, 'head-age-incr': 0.9, 'mouth-scale-horiz-decr': 0.2, 'mouth-upperlip-volume-decr': 0.5, 'mouth-lowerlip-volume-decr': 0.4,
               'eyebrows-left-inner-up': 0.4, 'eyebrows-right-inner-up': 0.4, 'eye-left-slit': 0.2, 'eye-right-slit': 0.2, 'mouth-corner-puller': 0.25, 'neck-platysma': 0.5},
        zutaten={'eyes': 'high-poly', 'eyebrows': 'eyebrow009', 'eyelashes': 'eyelashes01', 'teeth': 'teeth_base'},
        haut='old_caucasian_male', drehung=-24, kleider=kleider_zaehler, tuecher=tuecher_zaehler,
        pose=[('spine_01', 'X', 5), ('spine_03', 'X', 9), ('neck_01', 'X', 8), ('head', 'X', -12), ('head', 'Z', 8),
              ('upperarm_l', (0.22, -0.28, -0.93)), ('lowerarm_l', (0.02, -0.72, 0.62)), ('faust_l', 86, 40),
              ('upperarm_r', (-0.16, 0.02, -0.99)), ('lowerarm_r', (0.12, -0.84, -0.42)), ('faust_r', 72, 35),
              ('thigh_l', (0.06, -0.03, -1.0)), ('calf_l', (0.03, 0.05, -1.0)), ('foot_l', (0.18, -0.88, -0.44)),
              ('thigh_r', (-0.06, 0.0, -1.0)), ('calf_r', (-0.02, 0.03, -1.0)), ('foot_r', (-0.16, -0.89, -0.44))]),
}


def ausstatten(name, fest):
    """Materialien und Zubehör auf die geschneiderte Figur."""
    F = FIGUREN[name]; sa = os.path.join(cache(), 'menschen', 'sysassets')
    hd = os.path.join(sa, 'skins', F['haut'])
    T = {k.split('.', 1)[1]: o for k, o in fest.items() if '.' in k}; T['koerper'] = fest[name]
    for k, o in T.items(): o['asset_name'] = F['zutaten'].get(k, '')
    hautteile(fest[name], {k: T[k] for k in F['zutaten']}, mat_haut(name + '_haut', os.path.join(hd, next(f for f in os.listdir(hd) if f.endswith('diffuse.png'))), **F.get('hautwerte', {})),
              haar_ton=F.get('haar_ton', (1, 1, 1)))
    for o in [fest[name]] + [T[k] for k in F['zutaten']]:
        for p in o.data.polygons: p.use_smooth = True
        sd = o.modifiers.new('fein', 'SUBSURF'); sd.levels = 0; sd.render_levels = int(os.environ.get('MENSCH_FEIN', '1'))
    roh = json.loads(fest[name]['gelenke']); m = fest[name]['massstab']
    G = {k: Vector(v) for k, v in roh.items() if not k.startswith(('W:', 'R:')) and k != 'drehung'}
    G['ruhe'] = {k[2:]: Vector(v) for k, v in roh.items() if k.startswith('R:')}; G['roh'] = roh
    W = {k[2:]: Matrix(v) for k, v in roh.items() if k.startswith('W:')}
    d = roh['drehung']; G['vorn'] = Vector((math.sin(d), -math.cos(d), 0)); G['links'] = Vector((math.cos(d), math.sin(d), 0)); G['oben'] = Vector((0, 0, 1))
    neu = F['zubehoer'](name, T, G, W, m)
    for o in neu: o.name = name + '.' + o.name
    return list(T.values()) + neu


def bau():
    praefix = ARGS[1]
    breite, hoehe, samples = (int(ARGS[2]), int(ARGS[3]), int(ARGS[4])) if len(ARGS) > 4 else (1280, 720, 96)
    namen = [n for n in (ARGS[5] if len(ARGS) > 5 else 'aufstellung').split(',') if n and n != '-']
    nur = [n for n in os.environ.get('MENSCH_NUR', ','.join(FIGUREN)).split(',') if n in FIGUREN]
    t0 = time.time(); rnd = random.Random(SAAT); leeren()
    figuren = {name: figur(name) for name in nur}       # zuerst schneidern: die Simulation braucht eine leere Szene
    szene(rnd)
    for name, fest in figuren.items():
        teile = ausstatten(name, fest); bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
        tri = {o.name.split('.', 1)[-1]: sum(len(p_.vertices) - 2 for p_ in o.data.polygons) for o in teile}
        print('MENSCHENFRAME %s: %d Teile, %d Dreiecke im Arbeitsnetz (ohne Render-Unterteilung, ohne Stoffdicke); grösste: %s' % (
            name, len(teile), sum(tri.values()), ', '.join('%s %d' % kv for kv in sorted(tri.items(), key=lambda kv: -kv[1])[:6])))
    kam = kameras(); render_einstellungen(breite, hoehe, samples)
    print('MENSCHENFRAME Aufbau %.0f s, %s' % (time.time() - t0, hf.speicher()))
    if os.environ.get('MENSCH_BLEND'): bpy.ops.wm.save_as_mainfile(filepath=os.environ['MENSCH_BLEND'])
    rendern(praefix, kam, namen)
    if MODUS == 'schatten': schattenriss(praefix, breite, hoehe)


def schattenriss(praefix, breite, hoehe):
    """Schattenriss-Probe: nur die Figuren, schwarz vor Weiss, aus 30 m (lange Brennweite). Lesbarkeit auf Distanz."""
    sc = bpy.context.scene
    for o in sc.objects:
        if o.type == 'MESH' and o.name.split('.')[0] not in FIGUREN: o.hide_render = True
        if o.type == 'LIGHT': o.hide_render = True
    w = bpy.data.worlds.new('Weiss'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1); sc.world = w
    m, k, b, out = neues_material('Schwarz', False); e = k.n('ShaderNodeEmission'); e.inputs['Color'].default_value = (0, 0, 0, 1); k.nt.links.new(e.outputs[0], out.inputs['Surface'])
    sc.view_layers[0].material_override = m
    sc.camera = bpy.data.objects['schatten']; sc.cycles.samples = 16; sc.cycles.use_denoising = False
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    try: sc.render.image_settings.media_type = 'IMAGE'
    except Exception as e_: print('media_type', e_)
    sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = os.path.abspath(praefix + '-schatten.png')
    bpy.ops.render.render(write_still=True); print('MENSCHENFRAME Schattenriss →', sc.render.filepath)


def stil():
    """Gemalte Darstellung: der Stil des Haus-Zielbilds (`hausframe.stil`), Luftschichten auf Hofmass gestellt."""
    hf.ARGS = ARGS; os.environ.setdefault('HAUS_SICHT', '160'); os.environ.setdefault('HAUS_BODEN', '0.0'); os.environ.setdefault('HAUS_EV', '-1.0')
    hf.stil()


if __name__ == '__main__' and MODUS in ('vorher', 'stil', 'bau', 'schatten'):
    {'vorher': vorher, 'stil': stil, 'bau': bau, 'schatten': bau}[MODUS]()
