"""BRACHLAND — Kampfton schneiden (D427): CC0-Aufnahmen aus OpenGameArt (Herkunft je Datei in
assets/HERKUNFT.md, Abschnitt „Kampfton (D427)“) → public/ton/kampf/*.ogg.

Je Datei: Stille vorn weg (5 ms Vorlauf), Ende nach der Hüllkurve (2 % der Spitze + 30 ms, höchstens
`laengste`), 25 ms Abblende, 2 ms Einblende, Spitze auf −1 dBFS, mono 48 kHz, Opus 48 kbit/s in Ogg.

Aufruf: python3 -I tools/kampftonbau.py <roh-ordner> public/ton/kampf
<roh-ordner> enthält die entpackten Pakete (Namen wie unten, `x_<Paket>/…`): swoshes.7z, qubodupImpact.7z,
qubodupPunch.7z, „melee sounds.zip“, sfx_breaking_and_falling.zip, impact_-_starninjas.zip,
sword_clash_-_starninjas_0.zip, RPGsounds_Kenney.zip — alle von opengameart.org/sites/default/files/.
Braucht ffmpeg (libopus) und numpy."""
import os, subprocess, sys
import numpy as np

ROH, ZIEL = sys.argv[1], sys.argv[2]
SR = 48000
AUSWAHL = [
    # (Ziel, Quelle relativ zu ROH, längste Dauer s)
    ('schwung-leicht-1', 'x_swoshes/swosh-09.flac', 0.4),
    ('schwung-leicht-2', 'x_swoshes/swosh-02.flac', 0.4),
    ('schwung-leicht-3', 'x_swoshes/swosh-21.flac', 0.4),
    ('schwung-schwer-1', 'x_swoshes/swosh-43.flac', 0.5),
    ('schwung-schwer-2', 'x_swoshes/swosh-36.flac', 0.5),
    ('schwung-schwer-3', 'x_swoshes/swosh-40.flac', 0.5),
    ('treffer-fell-1', 'x_qubodupImpact/qubodupImpact/qubodupImpactMeat02.flac', 0.45),
    ('treffer-fell-2', 'x_melee_sounds/melee sounds/animal melee sound.wav', 0.45),
    ('treffer-fell-3', 'x_melee_sounds/melee sounds/melee sound.wav', 0.45),
    ('treffer-rinde-1', 'x_qubodupImpact/qubodupImpact/qubodupImpactWood.flac', 0.45),
    ('treffer-rinde-2', 'x_sfx_breaking_and_falling/bfh1_wood_hit_02.ogg', 0.45),
    ('treffer-rinde-3', 'x_sfx_breaking_and_falling/bfh1_wood_hit_03.ogg', 0.45),
    ('treffer-stoff-1', 'x_qubodupPunch/qubodupPunch/qubodupPunch02.flac', 0.4),
    ('treffer-stoff-2', 'x_qubodupPunch/qubodupPunch/qubodupPunch03.flac', 0.4),
    ('treffer-stoff-3', 'x_qubodupPunch/qubodupPunch/qubodupPunch04.flac', 0.4),
    ('treffer-metall-1', 'x_qubodupImpact/qubodupImpact/qubodupImpactMetal.flac', 0.5),
    ('treffer-metall-2', 'x_sfx_breaking_and_falling/bfh1_metal_hit_02.ogg', 0.5),
    ('treffer-metall-3', 'x_sfx_breaking_and_falling/bfh1_metal_hit_04.ogg', 0.5),
    ('block-1', 'x_impact_-_starninjas/impact.2.ogg', 0.4),
    ('block-2', 'x_impact_-_starninjas/impact.8.ogg', 0.4),
    ('block-3', 'x_impact_-_starninjas/impact.10.ogg', 0.4),
    ('parade-1', 'x_sword_clash_-_starninjas_0/sword_clash.2.ogg', 0.6),
    ('parade-2', 'x_sword_clash_-_starninjas_0/sword_clash.5.ogg', 0.6),
    ('parade-3', 'x_sword_clash_-_starninjas_0/sword_clash.8.ogg', 0.6),
    ('rolle-1', 'x_RPGsounds_Kenney/OGG/cloth1.ogg', 0.5),
    ('rolle-2', 'x_RPGsounds_Kenney/OGG/cloth3.ogg', 0.5),
    ('schritt-1', 'x_RPGsounds_Kenney/OGG/footstep00.ogg', 0.3),
    ('schritt-2', 'x_RPGsounds_Kenney/OGG/footstep05.ogg', 0.3),
    ('schritt-3', 'x_RPGsounds_Kenney/OGG/footstep06.ogg', 0.3),
    ('griff-1', 'x_RPGsounds_Kenney/OGG/cloth4.ogg', 0.4),
    ('griff-2', 'x_RPGsounds_Kenney/OGG/handleSmallLeather.ogg', 0.4),
]

def lade(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

os.makedirs(ZIEL, exist_ok=True)
bericht = []
for ziel, quelle, laengste in AUSWAHL:
    x = lade(os.path.join(ROH, quelle))
    a = np.abs(x); w = int(SR * 0.01)
    env = np.convolve(a, np.ones(w) / w, 'same')
    on = max(0, int(np.argmax(env > env.max() * 0.05)) - int(SR * 0.005))
    hinter = np.where(env > env.max() * 0.02)[0]
    ende = min(len(x), int(hinter[-1]) + int(SR * 0.03), on + int(SR * laengste))
    y = x[on:ende].astype(np.float64)
    n = len(y); fade = min(int(SR * 0.025), n // 3)
    y[-fade:] *= np.linspace(1, 0, fade) ** 2
    y[: int(SR * 0.002)] *= np.linspace(0, 1, int(SR * 0.002))
    spitze = np.abs(y).max()
    y *= 10 ** (-1 / 20) / spitze
    roh = y.astype(np.float32).tobytes()
    aus = os.path.join(ZIEL, ziel + '.ogg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'libopus', '-b:a', '48k', '-application', 'audio', '-map_metadata', '-1', aus],
                   input=roh, check=True)
    bericht.append({'datei': ziel + '.ogg', 'quelle': quelle, 'dauer': round(n / SR, 3), 'kb': round(os.path.getsize(aus) / 1024, 1)})
    print(f"{ziel:18s} {n / SR:5.2f} s {os.path.getsize(aus) / 1024:5.1f} KB  ← {quelle}")
print(f"zusammen {sum(b['kb'] for b in bericht):.0f} KB, {len(bericht)} Dateien")
