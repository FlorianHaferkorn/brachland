"""
Efeukarten, Schritt 2 (D358): die vier gebackenen Felder aus `tools/efeukarten.py` zu zwei Atlanten (2 × 2 Kacheln).

  python3 tools/efeukarten_pack.py .cache/efeukarten [kachel=1024]

- `public/material/efeu-karten-farbe.webp`: RGB Grundfarbe, A Deckung. Die Farbe wird unter dem Blattrand nach aussen
  gefüllt, sonst zieht das Mipmapping einen hellen Saum aus dem Hintergrund herein (wie `tools/laubbueschel/pack.py`).
- `public/material/efeu-karten-normal.webp`: RGB Normale im Tangentenraum der Wand, A Abstand zur Wand (0 = an der
  Wand, 1 = 25 cm davor) — der Shader dunkelt tiefe Blätter damit ab.
"""
import sys
import numpy as np
from PIL import Image

QUELLE = sys.argv[1] if len(sys.argv) > 1 else '.cache/efeukarten'
KACHEL = int(sys.argv[2]) if len(sys.argv) > 2 else 1024
# D361: dieselbe Packung für andere Kartenarten (`streu`): liest `<art><n>-*.png`, schreibt `<art>-karten-*.webp`.
ART = sys.argv[3] if len(sys.argv) > 3 else 'efeu'


def lade(n, art):
    return np.asarray(Image.open(f'{QUELLE}/{ART}{n}-{art}.png').convert('RGBA').resize((KACHEL, KACHEL), Image.LANCZOS)).astype(np.float32) / 255


def fuelle(rgb, deckung, schritte=24):
    """Farbe in die leeren Pixel ausbreiten (Mittel der gedeckten Nachbarn), damit Mipmaps keine Säume bekommen."""
    rgb = rgb.copy(); gedeckt = deckung > 0.02
    for _ in range(schritte):
        summe = np.zeros_like(rgb); zahl = np.zeros(gedeckt.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            g = np.roll(gedeckt, (dy, dx), (0, 1)); summe += np.roll(rgb, (dy, dx), (0, 1)) * g[..., None]; zahl += g
        neu = ~gedeckt & (zahl > 0)
        rgb[neu] = summe[neu] / zahl[neu][:, None]; gedeckt |= neu
    rgb[~gedeckt] = rgb[gedeckt].mean(0)
    return rgb


farbe = np.zeros((2 * KACHEL, 2 * KACHEL, 4), np.float32)
normal = np.zeros_like(farbe)
for n in range(4):
    y, x = divmod(n, 2); sy, sx = slice(y * KACHEL, (y + 1) * KACHEL), slice(x * KACHEL, (x + 1) * KACHEL)
    f, nm, ab = lade(n, 'farbe'), lade(n, 'normal'), lade(n, 'abstand')
    a = f[..., 3]
    farbe[sy, sx, :3] = fuelle(f[..., :3], a); farbe[sy, sx, 3] = a
    nrgb = fuelle(nm[..., :3], a); nrgb[a < 0.02] = (0.5, 0.5, 1.0)
    normal[sy, sx, :3] = nrgb; normal[sy, sx, 3] = ab[..., 0] * (a > 0.02)
for name, bild in (('farbe', farbe), ('normal', normal)):
    pfad = f'public/material/{ART}-karten-{name}.webp'
    Image.fromarray((bild * 255 + 0.5).clip(0, 255).astype(np.uint8), 'RGBA').save(pfad, 'WEBP', quality=88, method=6)
    print(pfad, Image.open(pfad).size)
