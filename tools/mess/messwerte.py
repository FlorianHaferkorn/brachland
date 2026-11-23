#!/usr/bin/env python3
"""Messwerte für das Messbild Spiel │ Zielbild (D445, UEBERGABE 2d) — dieselben Grössen wie in den Zielbild-Runden D382/D386:
mittlere Helligkeit, Fläche unter 0,2 und über 0,7, R−B in den Lichtern (hellste 10 %) und Schatten (dunkelste 10 %),
mittlere Sättigung, Anteil der Signalfarbe, Himmelsanteil.

    python3 tools/mess/messwerte.py <bild> [<bild> …]          → Tabelle (Markdown) auf stdout
    python3 tools/mess/messwerte.py --json <bild> [<bild> …]   → dieselben Werte als JSON {pfad: {…}}, Anteile 0…1 (D459,
                                                                 Eingabe für `tools/ortverfahren.ts abnahme`); dazu `magenta`
                                                                 = Anteil reinen Magentas (fehlende Textur, D448)

Helligkeit = Rec.-709-Gewichtung der angezeigten (sRGB-)Werte 0…1, wie im Bild zu sehen. Sättigung nach HSV.
Himmel: oberes Bilddrittel bis zur ersten Kante — Pixel, die hell (> 0,45), wenig gesättigt (< 0,35) und mit dem
oberen Bildrand verbunden sind (Flutfüllung). Für beide Bilder dieselbe Regel, damit die Zahl vergleichbar ist; sie
weicht von der Tiefenpass-Zahl der Zielbild-Runden ab (D386: 7,0 % aus dem Tiefenpass).
"""
import sys
import numpy as np
from PIL import Image
from collections import deque


def werte(pfad):
    im = np.asarray(Image.open(pfad).convert('RGB').resize((960, 540), Image.LANCZOS), dtype=np.float32) / 255.0
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    mx, mn = im.max(2), im.min(2); s = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)
    q10, q90 = np.quantile(y, 0.10), np.quantile(y, 0.90)
    licht, schatten = y >= q90, y <= q10
    # Signalfarbe #cfe9f2 (eisblau): Farbton 185–205°, gesättigt > 0,12, hell > 0,6
    h = np.zeros_like(y); d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    signal = (h > 185) & (h < 205) & (s > 0.12) & (mx > 0.6)
    # Himmel: Flutfüllung vom oberen Rand über helle, wenig gesättigte Pixel
    kandidat = (y > 0.45) & (s < 0.35); H, W = y.shape; himmel = np.zeros_like(kandidat)
    q = deque((0, x) for x in range(W) if kandidat[0, x])
    for _, x in q: himmel[0, x] = True
    while q:
        i, j = q.popleft()
        for a, c in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
            if 0 <= a < H and 0 <= c < W and kandidat[a, c] and not himmel[a, c]: himmel[a, c] = True; q.append((a, c))
    return dict(mittel=y.mean(), unter02=(y < 0.2).mean(), ueber07=(y > 0.7).mean(), rb_licht=(r - b)[licht].mean(), rb_schatten=(r - b)[schatten].mean(),
                saett=s.mean(), signal=signal.mean(), himmel=himmel.mean(), magenta=((r > 0.8) & (b > 0.8) & (g < 0.3)).mean())


if __name__ == '__main__':
    namen = [a for a in sys.argv[1:] if a != '--json']; w = [werte(p) for p in namen]
    if '--json' in sys.argv[1:]:
        import json
        print(json.dumps({n: {k: round(float(v), 5) for k, v in x.items()} for n, x in zip(namen, w)}, indent=1)); sys.exit(0)
    print('| Grösse | ' + ' | '.join(n.split('/')[-1] for n in namen) + ' |')
    print('|---|' + '---|' * len(namen))
    for k, t, f in (('mittel', 'mittlere Helligkeit', '%.2f'), ('unter02', 'Fläche unter 0,2', '%.0f %%'), ('ueber07', 'Fläche über 0,7', '%.1f %%'),
                    ('rb_licht', 'R−B Lichter', '%+.2f'), ('rb_schatten', 'R−B Schatten', '%+.2f'), ('saett', 'Sättigung', '%.2f'),
                    ('signal', 'Signalfarbe', '%.2f %%'), ('himmel', 'Himmel (Flutfüllung)', '%.1f %%')):
        prozent = '%%' in f
        print('| %s | %s |' % (t, ' | '.join((f % (x[k] * 100 if prozent else x[k])).replace('.', ',') for x in w)))
