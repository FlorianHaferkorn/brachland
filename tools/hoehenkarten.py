"""
Höhenkarten für Parallax Occlusion Mapping an den Hauswänden (D365).
  python3 tools/hoehenkarten.py

Drei Graustufen-Atlanten im **selben Layout** wie die Farb- und Normalatlanten, die das Hausmaterial
(`src/world/hausmaterial.ts`) schon liest — dieselbe UV trifft dieselbe Stelle, nur in halber Auflösung
(Höhe braucht keine 1k, und die Kette tastet sie bis zu 29-mal je Pixel ab):

- `public/material/haus-scans-hoehe.webp` (512², 2 × 2 Kacheln à 256): Displacement der Poly-Haven-Quellen
  von `haus-scans.webp` (`tools/hausscans.py`): grey_plaster_02, old_planks_02, grey_roof_tiles, old_stone_wall.
- `public/material/hof-scans-hoehe.webp` (1024², 2 × 2 Kacheln à 512 mit 4 px umlaufendem Rand, Innen 504 —
  dasselbe Verhältnis 8/1024 wie `tools/hofscans.mjs`): plastered_wall_03, weathered_planks, grey_roof_tiles,
  old_stone_wall.
- `public/material/hof-ziel-hoehe.webp` (640²): aus der Helligkeit von `hof-ziel-farbe.webp` (projektintern,
  ImageGen, D317) — dieselbe Ableitung, aus der schon `hof-ziel-normal.webp` stammt: Fugen und Schatten
  sind dunkel, also tief. Hochpass gegen großflächige Farbverläufe.

Weiß = oben (Poly-Haven-Konvention), je Kachel auf 1.–99. Perzentil gestreckt. Alle Quellen CC0-1.0.
Rohdaten in `.cache/hoehenkarten/` (gitignored), Belege (URL, Bytes, SHA-256) in `public/material/hoehe.json`.
"""
import hashlib
import json
import os
import urllib.request

import numpy as np
from PIL import Image, ImageFilter

ROH = '.cache/hoehenkarten'
ZIEL = 'public/material'
SAETZE = {
    'haus-scans-hoehe.webp': {'kachel': 256, 'rand': 0,
                              'quellen': ['grey_plaster_02', 'old_planks_02', 'grey_roof_tiles', 'old_stone_wall']},
    'hof-scans-hoehe.webp': {'kachel': 512, 'rand': 4,
                             'quellen': ['plastered_wall_03', 'weathered_planks', 'grey_roof_tiles', 'old_stone_wall']},
}


def oeffne(url):
    # Die Poly-Haven-API lehnt Pythons Standardkennung ab (403); ein schlichter eigener Name genügt.
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'brachland-werkzeug/1.0'}))


def hole(id_):
    with oeffne(f'https://api.polyhaven.com/files/{id_}') as r:
        url = json.load(r)['Displacement']['1k']['png']['url']
    ziel = f'{ROH}/{id_}_disp_1k.png'
    if not os.path.exists(ziel):
        with oeffne(url) as r, open(ziel, 'wb') as f:
            f.write(r.read())
    roh = open(ziel, 'rb').read()
    bild = Image.open(ziel)
    a = np.asarray(bild).astype(np.float64)
    if a.ndim == 3:
        a = a[..., 0]
    beleg = {'quelle': id_, 'quelleUrl': f'https://polyhaven.com/a/{id_}', 'karte': url,
             'bytes': len(roh), 'sha256': hashlib.sha256(roh).hexdigest(), 'lizenz': 'CC0-1.0'}
    return a, beleg


def strecke(a):
    lo, hi = np.percentile(a, [1, 99])
    return np.clip((a - lo) / max(hi - lo, 1e-6), 0, 1)


def kachel(a, groesse, rand):
    innen = groesse - 2 * rand
    k = np.asarray(Image.fromarray(strecke(a).astype(np.float32), 'F').resize((innen, innen), Image.LANCZOS))
    if rand:
        # Umlaufende Kopie wie `polstere` in tools/hofscans.mjs: der Rand trägt die gegenüberliegende Kante.
        idx = (np.arange(groesse) - rand) % innen
        k = k[np.ix_(idx, idx)]
    return k


os.makedirs(ROH, exist_ok=True)
belege = {}
for datei, satz in SAETZE.items():
    g = satz['kachel']
    atlas = np.zeros((2 * g, 2 * g), np.float32)
    belege[datei] = []
    for i, id_ in enumerate(satz['quellen']):
        a, beleg = hole(id_)
        y0, x0 = (i // 2) * g, (i % 2) * g
        atlas[y0:y0 + g, x0:x0 + g] = kachel(a, g, satz['rand'])
        belege[datei].append(beleg)
    Image.fromarray((np.clip(atlas, 0, 1) * 255).round().astype(np.uint8), 'L').save(f'{ZIEL}/{datei}', quality=90, method=6)

# Zielbild-Atlas: Helligkeit, Hochpass (Radius ~ 1/20 Kachel), je Kachel gestreckt, halbe Auflösung.
farbe = Image.open(f'{ZIEL}/hof-ziel-farbe.webp').convert('L')
groesse = farbe.size[0] // 2
hell = farbe.resize((groesse, groesse), Image.LANCZOS)
weich = hell.filter(ImageFilter.GaussianBlur(groesse / 40))
fein = hell.filter(ImageFilter.GaussianBlur(0.8))
hp = np.asarray(fein).astype(np.float64) - np.asarray(weich).astype(np.float64)
k = groesse // 2
ziel = np.zeros_like(hp)
for i in range(4):
    y0, x0 = (i // 2) * k, (i % 2) * k
    ziel[y0:y0 + k, x0:x0 + k] = strecke(hp[y0:y0 + k, x0:x0 + k])
Image.fromarray((ziel * 255).round().astype(np.uint8), 'L').save(f'{ZIEL}/hof-ziel-hoehe.webp', quality=90, method=6)
belege['hof-ziel-hoehe.webp'] = [{'quelle': 'hof-ziel-farbe.webp', 'ableitung': 'Helligkeit, Hochpass, je Kachel gestreckt'}]

json.dump({'geprueft': '2026-11-21', 'weiss': 'oben', 'saetze': belege}, open(f'{ZIEL}/hoehe.json', 'w'),
          indent=1, ensure_ascii=False)
for d in [*SAETZE, 'hof-ziel-hoehe.webp']:
    print(d, os.path.getsize(f'{ZIEL}/{d}') // 1024, 'KB')
