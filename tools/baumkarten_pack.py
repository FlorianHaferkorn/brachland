"""
BRACHLAND — Baumkarten packen (D364, D367).

    python3 tools/baumkarten_pack.py <scans> <impostor-png-ordner> public/material

1. Rinde je Art aus Poly-Haven-Scans (CC0, `assets/HERKUNFT.md`) in je zwei WebP:
   `rinde-<art>-farbe.webp`  RGB = Albedo (sRGB), A = Hoehe (disp)
   `rinde-<art>-normal.webp` RGB = Normale (OpenGL), A = Rauheit
   Buche (`chinese_hackberry_bark`, Zuergelbaum): glatt mit Flechtenflecken wie Rotbuche, aber braeunlicher —
   um 45 % zur Helligkeit entsaettigt und leicht kuehl verschoben, damit sie als silbergraue Buchenrinde liest.
   Fichte (`pine_bark`): schuppig rotbraun-grau, unveraendert.
2. Impostor-Atlanten aus `tools/baumbau.py` (PNG, RGBA) nach WebP.
"""
import os, sys
from PIL import Image, ImageEnhance

SCANS, IMP, ZIEL = sys.argv[1], sys.argv[2], sys.argv[3]
RINDE = {'buche': ('chinese_hackberry_bark', (1024, 2048)), 'fichte': ('pine_bark', (1024, 1024))}

for art, (scan, groesse) in RINDE.items():
    lies = lambda k, modus: Image.open(os.path.join(SCANS, f'{scan}_{k}_2k.jpg')).convert(modus).resize(groesse, Image.LANCZOS)
    farbe = lies('diff', 'RGB')
    if art == 'buche':
        farbe = ImageEnhance.Color(farbe).enhance(0.55)
        r, g, b = farbe.split()
        farbe = Image.merge('RGB', (r.point(lambda v: v * 0.97), g, b.point(lambda v: min(255, v * 1.04))))
    farbe.putalpha(lies('disp', 'L'))
    farbe.save(os.path.join(ZIEL, f'rinde-{art}-farbe.webp'), 'WEBP', quality=86, alpha_quality=90, method=6)
    normal = lies('nor_gl', 'RGB'); normal.putalpha(lies('rough', 'L'))
    normal.save(os.path.join(ZIEL, f'rinde-{art}-normal.webp'), 'WEBP', quality=88, alpha_quality=85, method=6)
    print('rinde', art, groesse)

for f in sorted(os.listdir(IMP)):
    if not f.endswith('.png'): continue
    bild = Image.open(os.path.join(IMP, f)).convert('RGBA')
    ziel = os.path.join(ZIEL, f[:-4] + '.webp')
    bild.save(ziel, 'WEBP', quality=88, alpha_quality=95, method=6)
    print('impostor', f, os.path.getsize(ziel) // 1024, 'KB')
