"""
BRACHLAND — Menschenkette: Quaternius-Figuren (CC0) zu spielfertigen Menschen (D143)

    blender --background --python tools/menschbau.py -- .cache/quaternius [public/figuren] [name,name]

Schwester von `kreaturbau.py`, mit einem Unterschied, der alles andere bestimmt:
**das Rig bleibt.** Ein Tier atmet und geht im Shader (D136, D138); ein Mensch
braucht Huefte, Knie, Ellbogen — das ist im Shader nicht mehr billig, als
SkinnedMesh mit den Animationen des Pakets (Idle, Walk, Run, Wave, Interact)
ist es ein Draw Call und ein `AnimationMixer`.

Schritte je Figur:
1. Import; Beiwerk weg (`Sword`, die `Icosphere` des Pakets).
2. Nur die Animationen behalten, die die Szene spielt (6 von 24).
3. Finger raus: 40 der 62 Knochen sind Finger; auf 5 m sieht sie niemand, in
   der Datei sind sie zwei Drittel der Animationsdaten. Gewichte gehen ans
   Handgelenk.
4. Vier Teile (Kopf, Rumpf, Beine, Fuesse) zu **einem** Netz — ein Draw Call.
5. Farbe: jedes Material des Pakets bekommt eine **Rolle** aus `PALETTE.figur`
   (Haut, Jacke, Hose, Stiefel, Kapuze, Haar, Riemen …), Vertexfarbe wie bei den
   Tieren (D112), Materialien ohne Rolle werden ins Kreaturband gehoben.
6. Dezimieren auf `zielTris` — Gewichte ueberleben den Decimate.
7. Auf 1,80 m normen, Fuesse auf 0, Blick nach −Z (das Paket schaut nach +Z).
8. Export ohne Normalen und UV, mit Skin und Animationen.
"""
import bpy, sys, json, os, re, math
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:]
QUELLE = ARGS[0] if ARGS else '.cache/quaternius'
ZIEL = ARGS[1] if len(ARGS) > 1 else 'public/figuren'
NUR = set(ARGS[2].split(',')) if len(ARGS) > 2 else None
os.makedirs(ZIEL, exist_ok=True)

# --- Palette (dieselbe Quelle wie die Szene, D117) ---------------------------
_pal = open('src/world/palette.ts').read()
_m = re.search(r'kreaturBand:\s*\{\s*unten:\s*([0-9.]+),\s*oben:\s*([0-9.]+)', _pal)
BAND_UNTEN, BAND_OBEN = float(_m.group(1)), float(_m.group(2))


def palette_farbe(pfad):
    gruppe, name = pfad.split('.')
    block = re.search(r"\n  " + gruppe + r":\s*\{(.*?)\}", _pal, re.S)
    if not block:
        raise SystemExit(f'Palette: Gruppe {gruppe} fehlt')
    m = re.search(r"['\"]?" + re.escape(name) + r"['\"]?\s*:\s*'#([0-9a-fA-F]{6})'", block.group(1))
    if not m:
        raise SystemExit(f'Palette: {pfad} fehlt')
    h = m.group(1)
    def lin(v):
        c = int(v, 16) / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(h[0:2]), lin(h[2:4]), lin(h[4:6]))


def leuchtdichte(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


# --- Was bleibt, was geht ------------------------------------------------------
# Animationen je Figur: die Wanderin geht und rennt, ein NPC steht und winkt.
# Jede Animation kostet rund 12 KB Daten plus 15 KB JSON (72 Kanaele) — was die
# Szene nicht spielt, bleibt draussen.
ANIM_SPIELER = ('Idle', 'Idle_Neutral', 'Walk', 'Run')
ANIM_NPC = ('Idle', 'Idle_Neutral', 'Wave')
WEG = ('Sword', 'Icosphere')
# Winkelgrenze der planaren Dezimierung in Grad — gemessen an der Wanderin.
PLANAR_GRAD = float(os.environ.get('PLANAR_GRAD', '20'))
FINGER = re.compile(r'^(Index|Middle|Ring|Pinky|Thumb)\d\.(L|R)$')

# Quelle, Name, Hoehe in m, Ziel-Dreiecke, Animationen, Rolle je Paketmaterial, Rolle je Teil.
# Materialien ohne Rolle behalten ihre Farbe, ins Kreaturband gehoben.
FIGUREN = [
    ('w_hooded_adventurer', 'wanderin', 1.80, 2000, ANIM_SPIELER, {
        'Skin': 'figur.haut', 'White': 'figur.haar', 'DarkBrown': 'figur.kapuze',
        'Brown': 'figur.riemen', 'Black': 'figur.jacke', 'Metal': 'figur.jacke',
        'Metal_Dark': 'figur.riemen', 'LightBrown': 'figur.gepaeck', 'Gold': 'figur.riemen',
    }, {'Medieval_Legs': {'Black': 'figur.hose'}, 'Medieval_Feet': {'LightBrown': 'figur.stiefel', 'DarkBrown': 'figur.stiefel'},
        'Medieval_Head': {'Black': 'figur.riemen', 'Brown': 'figur.riemen'}}),
    ('m_farmer', 'bauer', 1.78, 1600, ANIM_NPC, {
        'Skin': 'figur.haut', 'Beige': 'figur.rolle', 'Red': 'figur.halstuch', 'Eyebrows': 'figur.riemen',
        'Eye': 'figur.riemen', 'LightBlue': 'figur.hose', 'Brown': 'figur.gepaeck', 'Brown2': 'figur.stiefel',
    }, {'Farmer_Feet': {'Brown': 'figur.stiefel'}}),
    ('m_worker', 'arbeiter', 1.78, 1600, ANIM_NPC, {
        'Skin': 'figur.haut', 'Worker_Yellow': 'kenney.colorYellow', 'Worker_Vest': 'kenney.colorRedDark',
        'Eyebrows': 'figur.riemen', 'Eye': 'figur.riemen', 'Moustache': 'figur.haar',
        'LightBrown': 'figur.rolle', 'Brown': 'figur.hose', 'Brown2': 'figur.hose',
        'Grey': 'figur.stiefel', 'Black': 'figur.stiefel',
    }, {}),
    # Die Bewohner aus `content/orte`: Tremmel (Hofbesitzerin) und die Frau am
    # Werkstor sind Frauen — aus dem Women-Pack die zwei CC0-Figuren ohne Fantasy.
    ('w_animated_woman', 'baeuerin', 1.70, 1600, ANIM_NPC, {
        'Skin': 'figur.haut', 'Red': 'figur.haar', 'Brown': 'figur.riemen',
        'LimeGreen': 'kenney.leafsDark', 'Gold': 'figur.riemen',
    }, {'Formal_Feet': {'Red': 'figur.stiefel', 'Skin': 'figur.stiefel'}, 'Formal_Legs': {'Skin': 'figur.hose'}}),
    ('w_animated_woman2', 'werkfrau', 1.70, 1600, ANIM_NPC, {
        'Skin': 'figur.haut', 'Hair_Blond': 'figur.haar', 'Hair_Brown': 'figur.haar', 'Brown': 'figur.riemen',
        'White': 'figur.rolle', 'Orange': 'figur.hose', 'Grey': 'figur.stiefel',
    }, {'Casual_Feet': {'Skin': 'figur.stiefel'}}),
    ('m_casual_character', 'wanderer', 1.78, 1600, ANIM_NPC, {
        'Skin': 'figur.haut', 'Skin_Darker': 'figur.haut', 'Hair': 'figur.haar', 'Eyebrows': 'figur.riemen',
        'Eye': 'figur.riemen', 'LightBrown': 'figur.jacke', 'LightBlue': 'figur.hose',
        'Red_Dark': 'figur.stiefel', 'White': 'figur.stiefel',
    }, {}),
]


def basisfarbe(mat):
    """Grundfarbe eines Paketmaterials, linear."""
    if mat and mat.use_nodes and 'Principled BSDF' in mat.node_tree.nodes:
        return tuple(mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value[:3])
    return (0.5, 0.5, 0.5)


register = {}
for quelle, name, hoehe, ziel_tris, BEHALTEN, rollen, je_objekt in FIGUREN:
    if NUR and name not in NUR:
        continue
    pfad = os.path.join(QUELLE, quelle + '.glb')
    if not os.path.exists(pfad):
        print(f'{name}: {pfad} fehlt'); continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=pfad)

    # 1. Beiwerk weg — und alles, was kein Skelett traegt.
    for o in list(bpy.context.scene.objects):
        if o.type == 'MESH' and (o.name in WEG or not any(m.type == 'ARMATURE' for m in o.modifiers)):
            bpy.data.objects.remove(o, do_unlink=True)
    arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    netze = [o for o in bpy.context.scene.objects if o.type == 'MESH']

    # 2. Animationen: nur die sechs, die die Szene spielt.
    def kurz(n): return n.split('|')[-1]
    for ad_obj in [arm] + netze:
        ad = ad_obj.animation_data
        if not ad: continue
        for tr in list(ad.nla_tracks):
            if not any(kurz(st.action.name) in BEHALTEN for st in tr.strips if st.action):
                ad.nla_tracks.remove(tr)
        if ad.action and kurz(ad.action.name) not in BEHALTEN:
            ad.action = None
    for a in list(bpy.data.actions):
        if kurz(a.name) not in BEHALTEN:
            bpy.data.actions.remove(a)
        else:
            a.name = kurz(a.name)

    # 3. Finger raus: Gewichte ans Handgelenk, Knochen loeschen, Kurven loeschen.
    for o in netze:
        wrist = {s: o.vertex_groups.get('Wrist.' + s) for s in 'LR'}
        for v in o.data.vertices:
            dazu = {}
            for g in v.groups:
                gn = o.vertex_groups[g.group].name
                if FINGER.match(gn):
                    dazu[gn[-1]] = dazu.get(gn[-1], 0.0) + g.weight
            for s, w in dazu.items():
                if wrist[s] and w > 0:
                    wrist[s].add([v.index], w, 'ADD')
        for vg in list(o.vertex_groups):
            if FINGER.match(vg.name):
                o.vertex_groups.remove(vg)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for b in list(arm.data.edit_bones):
        if FINGER.match(b.name):
            arm.data.edit_bones.remove(b)
    bpy.ops.object.mode_set(mode='OBJECT')
    # Blender 5: Kurven liegen in Slots (layers → strips → channelbags), nicht mehr an der Action.
    for a in bpy.data.actions:
        for layer in a.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    for fc in list(cb.fcurves):
                        mm = re.match(r'pose\.bones\["([^"]+)"\]', fc.data_path)
                        if mm and FINGER.match(mm.group(1)):
                            cb.fcurves.remove(fc)
    knochen = len(arm.data.bones)

    # 5. Farbe je Flaeche aus der Rolle — vor dem Join, solange der Objektname
    #    die Ueberschreibung je Teil (Kopf, Beine, Fuesse) noch tragen kann.
    ohne_rolle = set()
    for o in netze:
        m = o.data
        while m.color_attributes:
            m.color_attributes.remove(m.color_attributes[0])
        attr = m.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
        farben = []
        for mat in m.materials:
            mn = re.sub(r'\.\d{3}$', '', mat.name) if mat else '?'
            rolle = je_objekt.get(o.name, {}).get(mn) or rollen.get(mn)
            if rolle:
                farben.append(palette_farbe(rolle))
            else:
                ohne_rolle.add(f'{o.name}/{mn}')
                c = basisfarbe(mat); l = leuchtdichte(c)
                if l < 0.06: c = tuple(x * 0.3 + l * 0.7 for x in c)
                ziel = BAND_UNTEN + min(1.0, l / 0.5) * (BAND_OBEN - BAND_UNTEN)
                farben.append(tuple(min(1.0, x * ziel / max(1e-4, l)) for x in c))
        for pol in m.polygons:
            pol.use_smooth = False
            c = farben[min(pol.material_index, len(farben) - 1)] if farben else (0.5, 0.5, 0.5)
            for li in pol.loop_indices:
                attr.data[li].color = c + (1.0,)
    if ohne_rolle:
        print(f'  ohne Rolle (ins Band gehoben): {sorted(ohne_rolle)}')

    # 4. Ein Netz. Der Join haelt Vertexgruppen (Knochen) und den Armature-Modifier des aktiven Objekts.
    koerper = max(netze, key=lambda o: len(o.data.polygons))
    bpy.ops.object.select_all(action='DESELECT')
    for o in netze: o.select_set(True)
    bpy.context.view_layer.objects.active = koerper
    if len(netze) > 1:
        bpy.ops.object.join()
    koerper = bpy.context.view_layer.objects.active
    koerper.name = name
    m = koerper.data
    vorher = len(m.polygons)

    # Ein Material mit Vertexfarbe, damit der Export COLOR_0 schreibt.
    m.materials.clear()
    mat = bpy.data.materials.new(f'mensch_{name}')
    mat.use_nodes = True
    b = mat.node_tree.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 1.0
    b.inputs['Metallic'].default_value = 0.0
    kn = mat.node_tree.nodes.new('ShaderNodeVertexColor'); kn.layer_name = 'Color'
    mat.node_tree.links.new(kn.outputs['Color'], b.inputs['Base Color'])
    m.materials.append(mat)

    # 6. Dezimieren — Decimate an den Anfang des Stapels, dann anwenden; die
    #    Armature bleibt als Modifier (der Export darf sie NICHT anwenden).
    # **Planar, nicht Collapse.** Collapse auf 0,31 riss das Netz auf — Loecher in
    # den Beinen, Fransen an jeder Naht (die Paketfiguren sind schon low-poly, ihre
    # Teile liegen als offene Schalen uebereinander). Planar loest nur Kanten
    # zwischen fast koplanaren Flaechen auf und laesst die Form stehen.
    if vorher > ziel_tris:
        # Erst verschweissen: Die Paketnetze sind je Flaeche aufgetrennt (harte
        # Kanten ueber getrennte Ecken), und Dissolve findet dann keine Nachbarn —
        # 6.404 → 6.404. Gewichte ueberleben das Verschweissen.
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        # Das Rohnetz liegt in Hundertstel-Einheiten (Armature-Skalierung 100): 3e-6
        # lokal sind 0,3 mm in der Welt. 5e-4 lokal waren 5 cm — Finger und Gesicht weg.
        bpy.ops.mesh.remove_doubles(threshold=3e-6)
        bpy.ops.object.mode_set(mode='OBJECT')
        mod = koerper.modifiers.new('reduzieren', 'DECIMATE')
        mod.decimate_type = 'DISSOLVE'
        mod.angle_limit = math.radians(PLANAR_GRAD)
        mod.use_dissolve_boundaries = False
        bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        m = koerper.data
        # Dissolve laesst n-Ecke zurueck — der Export trianguliert, aber gezaehlt
        # wird hier: also selbst triangulieren.
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.quads_convert_to_tris(quad_method='BEAUTY', ngon_method='BEAUTY')
        bpy.ops.object.mode_set(mode='OBJECT')
        m = koerper.data
    for pol in m.polygons: pol.use_smooth = False

    # 7. Auf `hoehe` normen, Fuesse auf 0, Blick nach −Z — ueber den Wurzelknoten,
    #    nicht ueber das Netz: Die Rohdaten liegen in Millimetern und schief, erst
    #    die Armature stellt die Figur auf. Gemessen wird deshalb das ausgewertete Netz.
    wurzel = arm
    while wurzel.parent: wurzel = wurzel.parent
    dg = bpy.context.evaluated_depsgraph_get()
    ev = bpy.data.meshes.new_from_object(koerper.evaluated_get(dg)); ev.transform(koerper.matrix_world)
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for v in ev.vertices:
        for i in range(3):
            lo[i] = min(lo[i], v.co[i]); hi[i] = max(hi[i], v.co[i])
    bpy.data.meshes.remove(ev)
    s = hoehe / max(1e-6, hi.z - lo.z)
    mitte = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    # Erst drehen (180° um die Hochachse), dann skalieren, dann die gedrehte, skalierte Mitte auf 0.
    dreh = Matrix.Rotation(math.pi, 4, 'Z')
    wurzel.matrix_world = Matrix.Translation(-(dreh @ (mitte * s))) @ dreh @ Matrix.Scale(s, 4) @ wurzel.matrix_world

    # 8. Export: Skin und Animationen bleiben, Normalen und UV nicht (D107/G-131).
    aus = f'{ZIEL}/{name}.glb'
    bpy.ops.object.select_all(action='SELECT')
    opts = dict(filepath=aus, export_format='GLB', use_selection=False, export_apply=False,
                export_normals=False, export_texcoords=False, export_materials='EXPORT', export_yup=True,
                export_skins=True, export_animations=True, export_optimize_animation_size=True)
    try:
        bpy.ops.export_scene.gltf(**opts)
    except TypeError:
        opts.pop('export_optimize_animation_size', None)
        bpy.ops.export_scene.gltf(**opts)
    kb = os.path.getsize(aus) / 1024
    register[name] = round(kb, 1)
    print(f'{name:10} {quelle:22} {vorher:5} → {len(m.polygons):5} Dreiecke · {knochen} Knochen · '
          f'{len(bpy.data.actions)} Animationen ({", ".join(sorted(a.name for a in bpy.data.actions))}) · '
          f'{hi.z - lo.z:.2f} m roh → {hoehe} m · {kb:.0f} KB')

reg_pfad = f'{ZIEL}/register.json'
alt = (json.load(open(reg_pfad)).get('kb', {}) if os.path.exists(reg_pfad) else {})
alt.update(register)
json.dump({'figuren': sorted(alt), 'kb': alt}, open(reg_pfad, 'w'), indent=1, ensure_ascii=False)
print(f'{len(register)} Figuren · Register nach {reg_pfad}')
