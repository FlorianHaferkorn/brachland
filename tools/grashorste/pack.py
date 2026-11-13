"""
Grashorst-Atlas, Schritt 2 (D272): gewählte Kacheln aus `bake.mjs` zu `public/material/gras-horste.webp` packen.
  python3 tools/grashorste/pack.py
Alpha = nicht Magenta und nicht fast schwarz (Scan-Hintergrund); Farbe unter dem Rand nach aussen gefüllt
(keine dunklen Säume); Kacheln 384² mit 4 px Rand, unten bündig (Wurzel), Mass je Kachel in Metern in
`public/material/gras-horste.json`. Reihenfolge: 'gruen', 'stroh', 'kraut', 'blume' (`src/world/grashorst.ts`).
"""
import json
import numpy as np
from PIL import Image

AUS = '.cache/grashorste/out'
W, H, C, GUT = 1536, 1920, 384, 4
NUTZ = C - 2 * GUT
WAHL = [('grass_medium_01', 0, 'gruen'), ('grass_medium_01', 1, 'gruen'), ('grass_medium_01', 2, 'gruen'),
        ('grass_medium_01', 6, 'gruen'), ('grass_medium_01', 7, 'gruen'), ('grass_medium_01', 9, 'gruen'),
        ('grass_medium_01', 10, 'gruen'),
        ('grass_medium_02', 0, 'stroh'), ('grass_medium_02', 1, 'stroh'), ('grass_medium_02', 2, 'stroh'),
        ('grass_medium_02', 3, 'stroh'), ('grass_medium_02', 4, 'stroh'),
        ('weed_plant_02', 0, 'kraut'), ('weed_plant_02', 1, 'kraut'), ('nettle_plant', 4, 'kraut'),
        ('shrub_sorrel_01', 4, 'kraut'),
        ('dandelion_01', 0, 'blume'), ('dandelion_01', 1, 'blume'), ('periwinkle_plant', 0, 'blume')]


def fuelle(rgb, alpha, n=6):
    rgb = rgb.copy(); a = alpha > 0
    for _ in range(n):
        acc = np.zeros_like(rgb, dtype=float); cnt = np.zeros(a.shape)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            s = np.roll(np.roll(a, dy, 0), dx, 1); c = np.roll(np.roll(rgb, dy, 0), dx, 1)
            acc += c * s[..., None]; cnt += s
        neu = (~a) & (cnt > 0)
        rgb[neu] = (acc[neu] / cnt[neu][:, None]).astype(np.uint8); a = a | neu
    return rgb


atlas = np.zeros((H, W, 4), np.uint8); kacheln = []
for k, (mod, nr, art) in enumerate(WAHL):
    meta = json.load(open(f'{AUS}/{mod}_0.json'))[nr]
    im = np.asarray(Image.open(f"{AUS}/{meta['file']}").convert('RGB')).astype(int)
    hg = (im[..., 0] > 240) & (im[..., 1] < 20) & (im[..., 2] > 240)
    lum = (0.299 * im[..., 0] + 0.587 * im[..., 1] + 0.114 * im[..., 2]) / 255
    alpha = np.where(hg | (lum < 0.03), 0, 255).astype(np.uint8)
    t = Image.fromarray(np.dstack([fuelle(np.clip(im, 0, 255).astype(np.uint8), alpha), alpha]), 'RGBA')
    s = min(NUTZ / t.width, NUTZ / t.height)
    t = t.resize((max(1, round(t.width * s)), max(1, round(t.height * s))), Image.LANCZOS)
    zelle = Image.new('RGBA', (C, C), (0, 0, 0, 0)); zelle.alpha_composite(t, ((C - t.width) // 2, C - GUT - t.height))
    ca = np.asarray(zelle)
    ca = np.dstack([fuelle(ca[..., :3].copy(), ca[..., 3], 4), ca[..., 3]])
    x0, y0 = (k % 4) * C, (k // 4) * C
    atlas[y0:y0 + C, x0:x0 + C] = ca
    pxm = (meta['pxH'] / meta['h']) * s
    kacheln.append({'art': art, 'quelle': f'{mod}#{nr:02d}', 'rect': [x0 / W, 1 - (y0 + C) / H, C / W, C / H],
                    'groesse': round(C / pxm, 4), 'hoehe': round(meta['h'], 3), 'breite': round(meta['w'], 3)})
Image.fromarray(atlas, 'RGBA').save('public/material/gras-horste.webp', quality=90, alpha_quality=100, method=6)
json.dump({'atlas': 'gras-horste.webp', 'breite': W, 'hoehe': H, 'kachel': C, 'kacheln': kacheln},
          open('public/material/gras-horste.json', 'w'), indent=1, ensure_ascii=False)
print('geschrieben:', len(kacheln), 'Kacheln')
