"""
Hausscans (D284): vier Poly-Haven-Texturen (CC0) für Putz, Schalung, Dachziegel und Sockel als 2 × 2-Atlas.
  python3 tools/hausscans.py
Farbe als Modulation (je Kanal durch das Mittel geteilt, Mittel 0,5 → im Shader ×2): der Farbton bleibt die
Palette (`PALETTE.haus`, erarbeitet D119/D122), die Textur bringt Struktur, Flecken, Moos. Normale (OpenGL) als
zweiter Atlas. Kacheln 512², nahtlos (Poly-Haven-Texturen kacheln). Rohdaten in `.cache/hausscans/` (gitignored).
Ausgabe `public/material/haus-scans.webp`, `haus-scans-nor.webp` und Kantenlängen in `haus-scans.json`.
"""
import json
import os
import urllib.request
import numpy as np
from PIL import Image

ROH = '.cache/hausscans'
K = 512
# Reihenfolge = Rolle im Shader (`hausmaterial.ts`): 0 Putz, 1 Schalung, 2 Dach, 3 Sockel.
WAHL = [('grey_plaster_02', 'putz'), ('old_planks_02', 'schalung'), ('grey_roof_tiles', 'dach'), ('old_stone_wall', 'sockel')]


def oeffne(url):
    # Die Poly-Haven-API lehnt Pythons Standardkennung ab (403); ein schlichter eigener Name genügt.
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'brachland-werkzeug/1.0'}))


def hole(id_, art):
    ziel = f'{ROH}/{id_}_{art}.jpg'
    if not os.path.exists(ziel):
        with oeffne(f'https://api.polyhaven.com/files/{id_}') as r:
            d = json.load(r)
        url = d['Diffuse' if art == 'diff' else 'nor_gl']['1k']['jpg']['url']
        with oeffne(url) as r, open(ziel, 'wb') as f:
            f.write(r.read())
    return Image.open(ziel).convert('RGB').resize((K, K), Image.LANCZOS)


os.makedirs(ROH, exist_ok=True)
farbe = np.zeros((2 * K, 2 * K, 3), np.uint8)
normal = np.zeros((2 * K, 2 * K, 3), np.uint8)
kanten = []
for i, (id_, rolle) in enumerate(WAHL):
    with oeffne(f'https://api.polyhaven.com/info/{id_}') as r:
        info = json.load(r)
    d = np.asarray(hole(id_, 'diff')).astype(float)
    mod = np.clip(d / d.reshape(-1, 3).mean(0) * 0.5, 0, 1)   # Mittel 0,5 je Kanal
    y0, x0 = (i // 2) * K, (i % 2) * K
    farbe[y0:y0 + K, x0:x0 + K] = (mod * 255).round().astype(np.uint8)
    normal[y0:y0 + K, x0:x0 + K] = np.asarray(hole(id_, 'nor'))
    kanten.append({'rolle': rolle, 'quelle': id_, 'meter': round(info['dimensions'][0] / 1000, 3),
                   'autoren': list(info.get('authors', {}).keys())})
Image.fromarray(farbe).save('public/material/haus-scans.webp', quality=86, method=6)
Image.fromarray(normal).save('public/material/haus-scans-nor.webp', quality=90, method=6)
json.dump({'kachel': K, 'rollen': kanten}, open('public/material/haus-scans.json', 'w'), indent=1, ensure_ascii=False)
print('geschrieben', [(k['rolle'], k['meter']) for k in kanten],
      os.path.getsize('public/material/haus-scans.webp') // 1024, '+', os.path.getsize('public/material/haus-scans-nor.webp') // 1024, 'KB')
