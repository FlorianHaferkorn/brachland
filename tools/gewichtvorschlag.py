"""
BRACHLAND — Vorschlag (D420): Nachschwung und Erholung der **Bestandsclips** schwerer machen, ohne Scheitel,
Durchzug und Clipdauer zu verschieben. Nur Vorschlag mit Prüfbild, **nicht** in `waffenclips.CLIPS` und nicht in
`held-clips.glb`: Der Nachbau der Bestandsclips weicht auf diesem Weg 10–35 cm vom Ausgelieferten ab (D414 UNKLAR),
ein Ersetzen würde also mehr ändern als den Nachschwung.

Gebaut wird nur für den Kontaktbogen:

  VORSCHLAG=1 blender --background --factory-startup --python tools/clipnachbau.py -- <figur-roh.glb> <aus.glb>

`clipnachbau.py` hängt die Clips unten an `CLIPS` an und gibt sie zusammen mit den nachgebauten Originalen
(`<Name>_Nachbau`) aus — verglichen wird Nachbau gegen Nachbau, damit die Abweichung des Wegs beide trifft.

Jeder Vorschlag übernimmt die Schlüssel bis zum Durchzug **wörtlich** aus `waffenclips.CLIPS` und ersetzt nur die
danach. Die Regel der Masse (`src/kampf/gewicht.ts` `nachschwung`): Der letzte Schlüssel vor der Rückkehr liegt bei
mindestens (0,25 + 0,2 · Masse) der Erholung im Clip — Axt 62 %, Saufeder 54 %, Klinge 47 % —, und eine Schwungwaffe
läuft mindestens um ihren Bremsweg weiter (Axt 43°). Das Becken bremst gegen die Drehung (`huefte`).
"""
from waffenclips import CLIPS


def _bis(name, bild):
    """Die Schlüssel eines Bestandsclips bis einschliesslich `bild` (dem Durchzug)."""
    grund, art, schluessel = CLIPS[name]
    return grund, art, [k for k in schluessel if k[0] <= bild]


def _vorschlag(name, durchzug, danach):
    grund, art, vor = _bis(name, durchzug)
    return (grund, art, vor + danach)


VORSCHLAG = {
    # D429: Überholt — `Axt_Quer` ist seit D429 selbst aus Schlüsselbildern gebaut (Zweihand-Fällaxt) und hat seinen
    # Nachschwung (86°, Halt 73 %). Der Eintrag bleibt als Beleg der Prüfbilder von D420; er setzt die alten Schlüssel
    # nach dem Durchzug auf den neuen Clip und gehört nicht mehr gebaut.
    # Querhieb der Axt (1,85 kg, 0,65 kg·m²): Scheitel 10, Durchzug 15, Ende 30. Heute ist Bild 21 der letzte Schlüssel
    # (40 % der Erholung) — die Axt kehrt früh und gleichmässig zurück. Vorschlag: weiter links herum und tiefer, das
    # Becken bremst, das Gewicht bleibt auf dem rechten Fuss; zurück ab Bild 25 (67 %).
    'Axt_Quer_D420': _vorschlag('Axt_Quer', 15, [
        (20, dict(hand=(-0.358, 0.156, 1.053), richt=(-0.85, -0.3, -0.35), zwei='axt', rumpf=(62, 12), huefte=-10,
                  koerper=(0.12, -0.1), fuss_r=(0.15, 0.05))),
        (25, dict(hand=(-0.33, 0.16, 1.0), richt=(-0.72, -0.2, -0.62), zwei='axt', rumpf=(50, 10), huefte=-5,
                  koerper=(0.09, -0.09), fuss_r=(0.15, 0.05))),
        (30, 'stand'),
    ]),
    # Stoss der Saufeder (1,44 kg): Scheitel 9, Durchzug 13, Ende 24 — heute springt sie vom Durchzug direkt in die
    # Haltung (kein Schlüssel dazwischen). Vorschlag: Schaft und Ausfall tragen noch 4 cm weiter, dann zieht sie
    # die Arme zurück, der Fuss steht noch; zurück ab Bild 20 (64 %).
    'Speer_Stoss_D420': _vorschlag('Speer_Stoss', 13, [
        (17, dict(hand=(0.14, 0.6, 1.06), richt=(0, 1, 0.02), zwei='speer', rumpf=(-2, 13), koerper=(0.16, -0.1),
                  fuss_r=(0.3, 0.02))),
        (20, dict(hand=(0.17, 0.4, 1.04), richt=(0.02, 0.98, 0.12), zwei='speer', rumpf=(-8, 9), koerper=(0.1, -0.08),
                  fuss_r=(0.3, 0.02))),
        (24, dict(hand=(0.22, 0.02, 1.0), richt=(0.05, 0.95, 0.25), zwei='speer', rumpf=(-15, 4), koerper=(0, -0.05))),
    ]),
    # Stich der Klinge (1,1 kg): Scheitel 9, Durchzug 13, Ende 30 — heute Bild 20 (41 %). Vorschlag: der Ausfall hält
    # bis Bild 17 ganz, zurück ab Bild 22 (53 %).
    'Klinge_Stich_D420': _vorschlag('Klinge_Stich', 13, [
        (17, dict(hand=(0.04, 0.82, 1.22), richt=(0, 1, -0.03), rumpf=(27, 19), koerper=(0.27, -0.12), fuss_r=(0.42, 0),
                  links=(-0.32, -0.2, 1.05))),
        (22, dict(hand=(0.1, 0.55, 1.2), richt=(0.02, 1, 0.04), rumpf=(14, 13), koerper=(0.18, -0.08), fuss_r=(0.3, 0))),
        (30, 'stand'),
    ]),
}
