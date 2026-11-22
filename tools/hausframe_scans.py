#!/usr/bin/env python3
"""BRACHLAND — Scans für das Zielbild mit Haus (D373): lädt die Poly-Haven-Quellen (alle CC0) für `tools/hausframe.py`.

    python3 tools/hausframe_scans.py [zielordner]

Ziel ist `.cache/cc0/hausframe/` im Haupt-Repo (nicht versioniert, gross). Je Asset ein Unterordner mit den
Dateinamen von Poly Haven, dazu `herkunft.json` (Asset, Autoren, Lizenz, Realmass, Quelle). Vorhandene Dateien
werden nicht neu geladen. Nichts davon landet in `public/` — das Zielbild ist ein Blender-Render (ADR-0006).
"""
import json, os, sys, urllib.request

TEXTUREN = ['white_rough_plaster', 'worn_mossy_plasterwall', 'plaster_stone_wall_02', 'old_stone_wall', 'moss_wood',
            'roof_09', 'rubble', 'brown_mud_leaves_01', 'forest_ground_04']
KARTEN = ['Diffuse', 'Displacement', 'Rough']
MODELLE = ['nettle_plant', 'shrub_02', 'shrub_03', 'weed_plant_02', 'shrub_sorrel_01', 'island_tree_01',
           'island_tree_02', 'fir_sapling_medium', 'grass_medium_01', 'grass_medium_02', 'dry_branches_medium_01']
HIMMEL = ['evening_road_01_puresky']


def cache():
    if len(sys.argv) > 1: return sys.argv[1]
    p = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    while True:   # nächstes `.cache/cc0` aufwärts: ein Worktree findet so den Cache des Haupt-Repos
        k = os.path.join(p, '.cache', 'cc0')
        if os.path.isdir(k): return os.path.join(k, 'hausframe')
        if os.path.dirname(p) == p: raise SystemExit('kein .cache/cc0 gefunden')
        p = os.path.dirname(p)


def hole(url, als_json=False):
    req = urllib.request.Request(url, headers={'User-Agent': 'blender-skript'})
    daten = urllib.request.urlopen(req, timeout=120).read()
    return json.loads(daten) if als_json else daten


def lade(url, pfad):
    if os.path.exists(pfad) and os.path.getsize(pfad) > 0: return 0
    os.makedirs(os.path.dirname(pfad), exist_ok=True)
    daten = hole(url)
    with open(pfad + '.teil', 'wb') as f: f.write(daten)
    os.replace(pfad + '.teil', pfad)
    return len(daten)


def alpha_karten(ziel):
    """Alpha-Karten der Pflanzen-Scans nachladen (D433, Befund D386): das glTF von Poly Haven liefert sein Farbbild als
    JPG ohne Alphakanal, die Maske liegt als eigene PNG-Datei daneben. Ohne sie sind alle Blattkarten deckend.
    Dazu der zweite Laubbaum `jacaranda_tree`, der eine Ebene höher im Cache liegt (aus D372)."""
    summe = 0
    for name, o in [(n, os.path.join(ziel, n)) for n in MODELLE] + [('jacaranda_tree', os.path.join(os.path.dirname(ziel), 'jacaranda_tree'))]:
        tex = os.path.join(o, 'textures')
        if not os.path.isdir(tex): continue
        stufe = next((f.split('_')[-1].split('.')[0] for f in sorted(os.listdir(tex)) if '_diff_' in f), '1k')
        for k, v in hole('https://api.polyhaven.com/files/' + name, True).items():
            if not k.lower().endswith('alpha') or stufe not in v or 'png' not in v[stufe]: continue
            url = v[stufe]['png']['url']; summe += lade(url, os.path.join(tex, os.path.basename(url)))
            print('alpha', name, os.path.basename(url))
    return summe


def main():
    ziel = cache(); os.makedirs(ziel, exist_ok=True)
    herkunft = {}; summe = 0
    for name in TEXTUREN + MODELLE + HIMMEL:
        info = hole('https://api.polyhaven.com/info/' + name, True)
        dateien = hole('https://api.polyhaven.com/files/' + name, True)
        o = os.path.join(ziel, name)
        if name in TEXTUREN:
            for k in KARTEN:
                url = dateien[k]['2k']['jpg']['url']
                summe += lade(url, os.path.join(o, os.path.basename(url)))
        elif name in MODELLE:
            stufe = '2k' if name.startswith(('tree', 'island', 'fir')) else '1k'
            g = dateien['gltf'][stufe]['gltf']
            summe += lade(g['url'], os.path.join(o, os.path.basename(g['url'])))
            for rel, d in g.get('include', {}).items():
                summe += lade(d['url'], os.path.join(o, rel))
        else:
            url = dateien['hdri']['4k']['hdr']['url']
            summe += lade(url, os.path.join(o, os.path.basename(url)))
        herkunft[name] = {'autoren': sorted(info.get('authors', {}).keys()), 'lizenz': 'CC0', 'mass_mm': info.get('dimensions'),
                          'quelle': 'https://polyhaven.com/a/' + name}
        print('ok', name)
    summe += alpha_karten(ziel)
    json.dump(herkunft, open(os.path.join(ziel, 'herkunft.json'), 'w'), indent=1, ensure_ascii=False)
    print('geladen %.1f MiB nach %s' % (summe / 2 ** 20, ziel))


if __name__ == '__main__':
    main()
