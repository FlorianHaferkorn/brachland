"""
Laubbüschel-Atlas, Schritt 2 (D282): die dichtesten Ausschnitte aus `bake.mjs` zu `public/material/laub-bueschel.webp`.
  python3 tools/laubbueschel/pack.py [laub|nadel|weide]
Alpha = nicht Magenta; Farbe unter dem Rand nach aussen gefüllt (keine Säume), 1024 → 512 je Kachel, 4 × 4 Kacheln
(Reihenfolge egal, `laubkarten.ts` wählt je Karte zufällig). Farbe je Kanal auf das Mittel der bisherigen Laubkarte
`ez-laub-cc0-v5.webp` gebracht, damit Licht und Kronen-AO (erarbeitet, D262–D276) gleich bleiben.
"""
import glob
import json
import os
import sys
import numpy as np
from PIL import Image

AUS = '.cache/laubbueschel/out'
ART = sys.argv[1] if len(sys.argv) > 1 else 'laub'
# Je Baum so viele der dichtesten Ausschnitte (tree_small_02 wirkt mitteleuropäischer: kleines, rundes Blatt;
# Nadel: Kiefer überwiegt wie in der Region, Tanne für Abwechslung). Referenz = bisherige Karte derselben Art.
ARTEN = {
    'laub': ('public/material/laub-bueschel.webp', {'tree_small_02': 12, 'island_tree_02': 4}, 'public/material/ez-laub-cc0-v5.webp'),
    'nadel': ('public/material/nadel-bueschel.webp', {'pine_sapling_small': 12, 'fir_sapling': 4}, 'public/material/ez-nadel-cc0-v5.webp'),
    # D283: Weide prozedural (`weide.html`), Kachel 0,3 × 0,9 m → 256 × 768, 8 × 2 Kacheln.
    'weide': ('public/material/weide-bueschel.webp', {'weide': 16}, 'public/material/ez-laub-cc0-v5.webp'),
}
ZIEL, WAHL, REF = ARTEN[ART]
KB, KH, SP, ZE = (256, 768, 8, 2) if ART == 'weide' else (512, 512, 4, 4)


def fuelle(rgb, a, n=8):
    rgb = rgb.copy(); a = a.copy()
    for _ in range(n):
        acc = np.zeros(rgb.shape, float); cnt = np.zeros(a.shape)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            s = np.roll(np.roll(a, dy, 0), dx, 1); c = np.roll(np.roll(rgb, dy, 0), dx, 1)
            acc += c * s[..., None]; cnt += s
        neu = (~a) & (cnt > 0)
        rgb[neu] = (acc[neu] / cnt[neu][:, None]).astype(np.uint8); a = a | neu
    return rgb


def lade(f):
    im = np.asarray(Image.open(f).convert('RGB'))
    hg = (im[..., 0] > 200) & (im[..., 1] < 60) & (im[..., 2] > 200)
    return im, ~hg


kand = []
for baum, zahl in WAHL.items():
    fs = sorted(glob.glob(f'{AUS}/{baum}_[0-9]*.png'))
    bew = sorted(((lade(f)[1].mean(), f) for f in fs), reverse=True)[:zahl]
    kand += [(f, d) for d, f in bew]
assert len(kand) == SP * ZE, f'{len(kand)} Kacheln statt {SP * ZE}'

ref = np.asarray(Image.open(REF).convert('RGBA')).astype(float)
ref_mittel = ref[ref[..., 3] > 115][:, :3].mean(0)
roh = [lade(f) for f, _ in kand]
mittel = np.concatenate([im[m] for im, m in roh]).astype(float).mean(0)
gain = np.clip(ref_mittel / mittel, 0.6, 2.2)

atlas = np.zeros((ZE * KH, SP * KB, 4), np.uint8); quellen = []
for i, ((im, m), (f, d)) in enumerate(zip(roh, kand)):
    rgb = np.clip(im.astype(float) * gain, 0, 255).astype(np.uint8)
    rgb = fuelle(rgb, m)
    t = Image.fromarray(np.dstack([rgb, np.where(m, 255, 0).astype(np.uint8)]), 'RGBA')
    farbe = t.convert('RGB').resize((KB, KH), Image.LANCZOS)
    alpha = t.getchannel('A').resize((KB, KH), Image.BOX)
    y0, x0 = (i // SP) * KH, (i % SP) * KB
    atlas[y0:y0 + KH, x0:x0 + KB, :3] = np.asarray(farbe); atlas[y0:y0 + KH, x0:x0 + KB, 3] = np.asarray(alpha)
    quellen.append({'kachel': i, 'quelle': os.path.basename(f), 'deckung': round(float(d), 3)})
Image.fromarray(atlas, 'RGBA').save(ZIEL, quality=88, alpha_quality=100, method=6)
json.dump({'kacheln': quellen, 'gain': [round(float(g), 3) for g in gain]}, open(f'{AUS}/atlas-{ART}.json', 'w'), indent=1)
print('geschrieben', ZIEL, os.path.getsize(ZIEL) // 1024, 'KB · Deckung', [q['deckung'] for q in quellen], '· Farbfaktor', gain.round(2))
