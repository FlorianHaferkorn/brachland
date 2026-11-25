#!/usr/bin/env python3
"""Bildpaar für Flo (D459, Pflicht aus CLAUDE.md): zwei oder mehr Bilder nebeneinander, gleiche Höhe, beschriftet.

    python3 tools/mess/bildpaar.py <aus.jpg> "<Beschriftung>=<bild>" "<Beschriftung>=<bild>" […] [--hoehe 540]

Jedes Bild wird auf dieselbe Höhe gebracht (Seitenverhältnis bleibt), darunter steht die Beschriftung auf dunklem
Balken. Die Beschriftung endet am letzten `=`. Kein Urteil, nur das Blatt: Kamera und Ladezeit müssen die Aufnahmen
selbst gleich halten (`tools/mess/messbild.mjs`).
"""
import sys
from PIL import Image, ImageDraw, ImageFont


def schrift(groesse):
    for name in ('DejaVuSans.ttf', '/System/Library/Fonts/Helvetica.ttc', 'Arial.ttf'):
        try: return ImageFont.truetype(name, groesse)
        except OSError: pass
    return ImageFont.load_default()


def paar(aus, felder, hoehe=540, balken=36, luecke=6):
    bilder = []
    for text, pfad in felder:
        im = Image.open(pfad).convert('RGB')
        bilder.append((text, im.resize((max(1, round(im.width * hoehe / im.height)), hoehe), Image.LANCZOS)))
    breite = sum(b.width for _, b in bilder) + luecke * (len(bilder) - 1)
    blatt = Image.new('RGB', (breite, hoehe + balken), (18, 18, 18)); z = ImageDraw.Draw(blatt); f = schrift(20); x = 0
    for text, b in bilder:
        blatt.paste(b, (x, 0)); z.text((x + 10, hoehe + 7), text, fill=(235, 235, 235), font=f); x += b.width + luecke
    blatt.save(aus, quality=90)
    return blatt.size


if __name__ == '__main__':
    args = sys.argv[1:]; hoehe = 540
    if '--hoehe' in args: i = args.index('--hoehe'); hoehe = int(args[i + 1]); del args[i:i + 2]
    if len(args) < 3: sys.exit('Aufruf: bildpaar.py <aus.jpg> "<Beschriftung>=<bild>" "<Beschriftung>=<bild>" […] [--hoehe 540]')
    felder = [(a[:a.rindex('=')], a[a.rindex('=') + 1:]) for a in args[1:]]
    print('BILDPAAR', args[0], '%d x %d' % paar(args[0], felder, hoehe))
