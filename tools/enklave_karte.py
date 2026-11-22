#!/usr/bin/env python3
"""
BRACHLAND — Ortskarte des Œntals, alt gegen neu (D375)

Draufsicht aus dem Höhenraster `public/world/oental.json` mit der Flutfläche unter der `flutlinie`
(aus `content/regions/oental.json`), allen Orten, Fundstücken, verborgenen Orten und den Stationen der
Wanderfiguren. Links der Stand einer Git-Revision (Vorgabe: der Stand vor D375), rechts der Arbeitsstand.
Dazu auf der Konsole die Tabelle für `docs/design/BRACHLAND_Enklave_Lage_v2.md`.

Messung, kein Bauschritt: schreibt nur das Bild.

    python3 tools/enklave_karte.py [ausgabe.png] [revision]

Braucht numpy und matplotlib (nicht Teil des Gates).
"""
import base64, glob, json, math, subprocess, sys

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource

AUSGABE = sys.argv[1] if len(sys.argv) > 1 else '.cache/bilder/D375/d375-karte.png'
ALT = sys.argv[2] if len(sys.argv) > 2 else '1708347'
REGION = 'oental'

W = json.load(open(f'public/world/{REGION}.json'))['welt']
SUED, WEST, NORD, OST = W['bbox']
N = W['aufloesung']
BREITE = (OST - WEST) * 111_320 * math.cos((SUED + NORD) / 2 * math.pi / 180)
TIEFE = (NORD - SUED) * 111_320
H = np.frombuffer(base64.b64decode(W['hoehenB64']), dtype='<i2').reshape(N, N) / 10.0


def meter(ort):
    """Wie `nachMetern` in `src/data/inhalte.ts`: x nach Osten, z nach Süden, Mitte 0/0."""
    return ((ort[1] - WEST) / (OST - WEST) - 0.5) * BREITE, ((NORD - ort[0]) / (NORD - SUED) - 0.5) * TIEFE


def hoehe(ort):
    x, z = meter(ort)
    i = max(0, min(N - 1, round((z / TIEFE + 0.5) * (N - 1))))
    j = max(0, min(N - 1, round((x / BREITE + 0.5) * (N - 1))))
    return H[i, j]


def lies(ordner, revision=None):
    """Alle JSON eines Inhaltsordners — vom Arbeitsstand oder aus einer Revision."""
    if revision is None:
        return [json.load(open(f, encoding='utf8')) for f in sorted(glob.glob(f'content/{ordner}/*.json'))]
    namen = subprocess.run(['git', 'ls-tree', '--name-only', f'{revision}:content/{ordner}/'],
                           capture_output=True, text=True).stdout.split()
    return [json.loads(subprocess.run(['git', 'show', f'{revision}:content/{ordner}/{n}'], capture_output=True, text=True).stdout)
            for n in namen if n.endswith('.json')]


def stand(revision):
    region = (json.load(open(f'content/regions/{REGION}.json', encoding='utf8')) if revision is None else
              json.loads(subprocess.run(['git', 'show', f'{revision}:content/regions/{REGION}.json'], capture_output=True, text=True).stdout))
    hier = lambda liste: [o for o in liste if o.get('region') == REGION]
    regent = next(r for r in lies('regenten', revision) if r['id'] == region['regent'])
    auftraege = hier(lies('auftraege', revision))
    fragmente = hier(lies('fragmente', revision))
    # Reinkultur-Ort: das Fundstück, auf das der Auftrag zeigt, der die Komponente gibt.
    rein = {}
    for k in regent['reinkulturen']:
        a = next((a for a in auftraege if k in a['belohnung'] and a['ziel']['art'] == 'finde'), None)
        if a:
            rein[a['ziel']['fragment']] = k
    return dict(region=region, regent=regent, orte=hier(lies('orte', revision)), fragmente=fragmente, rein=rein,
                figuren=hier(lies('wanderfiguren', revision)))


def zeichne(ax, s, titel):
    flut = s['region'].get('flutlinie', 499)
    rand = [-BREITE / 2, BREITE / 2, TIEFE / 2, -TIEFE / 2]
    ax.imshow(LightSource(315, 45).hillshade(H, vert_exag=2, dx=10, dy=10), cmap='gray', extent=rand, alpha=0.85)
    ax.imshow(np.ma.masked_where(H >= flut, H), extent=rand, cmap='Blues', alpha=0.6, vmin=430, vmax=520)
    xs, zs = np.linspace(-BREITE / 2, BREITE / 2, N), np.linspace(-TIEFE / 2, TIEFE / 2, N)
    ax.contour(xs, zs, H, levels=[flut], colors=['#1f5fa8'], linewidths=1.0)
    ax.contour(xs, zs, H, levels=[1000], colors=['#a33'], linewidths=0.8, linestyles='--')
    for g in W['gebaeude']:
        p = [meter(q) for q in g['punkte']]
        ax.fill([q[0] for q in p], [q[1] for q in p], color='#5a4632', alpha=0.55, lw=0)

    def marke(ort, form, farbe, text, gross=8, dy=0):
        x, z = meter(ort)
        ax.plot(x, z, form, color=farbe, ms=gross, mec='black', mew=0.6)
        ax.annotate(text, (x, z), xytext=(6, -3 + dy), textcoords='offset points', fontsize=6.5, color='black',
                    bbox=dict(boxstyle='round,pad=0.15', fc='white', ec='none', alpha=0.75))

    enklave = s['region'].get('enklave')
    if enklave:
        x, z = meter(enklave['ort'])
        ax.add_patch(plt.Circle((x, z), 900, fill=False, ec='#c22', lw=0.8, ls=':'))
        ax.add_patch(plt.Circle((x, z), 250, fill=False, ec='#c22', lw=1.6))
        ax.annotate(f'Enklave „{enklave["name"]}“', (x, z), xytext=(-70, -22), textcoords='offset points', fontsize=9, color='#c22', weight='bold')
    for o in s['orte']:
        if o['art'] == 'zuflucht':
            marke(o['ort'], '^', '#f2c230', o['name'])
        elif enklave and math.dist(meter(o['ort']), meter(enklave['ort'])) < 600:
            marke(o['ort'], 'o', '#e2574c', '', 5)
        else:
            marke(o['ort'], 'o', '#e2574c', o['name'], 6)
    verborgen = {v.get('fragment') for v in s['region'].get('verborgeneOrte', [])}
    for f in s['fragmente']:
        if f['id'] in s['rein']:
            marke(f['ort'], '*', '#3fd9a0', f'Reinkultur: {f["titel"]}', 14)
        elif f['id'] not in verborgen:
            marke(f['ort'], 's', 'white', '', 4)
    for v in s['region'].get('verborgeneOrte', []):
        marke(v['ort'], 'D', '#8e44ad', f'verborgen: {v["name"]}', 7)
    for f, farbe in zip(s['figuren'], ['#ff7f0e', '#2ca02c', '#17becf']):
        p = [meter(st['ort']) for st in f['stationen']]
        ax.plot([q[0] for q in p], [q[1] for q in p], '-', color=farbe, lw=1.2, alpha=0.9)
        for i, st in enumerate(f['stationen']):
            ax.plot(*meter(st['ort']), 'o', color=farbe, ms=9, mec='black', mew=0.5)
            ax.annotate(str(i + 1), meter(st['ort']), ha='center', va='center', fontsize=6, weight='bold')
        ax.plot([], [], 'o-', color=farbe, label=f'{f["name"]} ({f["fraktion"]}), {len(f["stationen"])} Stationen')
    marke(s['regent']['ort'], 'X', '#111', s['regent']['name'], 11, dy=10)
    ax.plot(0, 0, 'P', color='white', ms=10, mec='black')
    ax.annotate('Spielstart', (0, 0), xytext=(6, 5), textcoords='offset points', fontsize=7)
    ax.set_xlim(-BREITE / 2, BREITE / 2)
    ax.set_ylim(TIEFE / 2, -TIEFE / 2)
    ax.set_xticks(range(-1500, 2000, 500))
    ax.set_yticks(range(-2000, 2001, 500))
    ax.tick_params(labelsize=7)
    ax.grid(alpha=0.25)
    ax.set_xlabel('x in m (Osten →)', fontsize=8)
    ax.set_ylabel('z in m (Süden ↓)', fontsize=8)
    ax.set_title(titel, fontsize=11)
    if s['figuren']:
        ax.legend(loc='lower left', fontsize=7, framealpha=0.85)


def tabelle(s):
    enklave = s['region']['enklave']['ort']
    zeile = lambda typ, name, ort: (f'| {typ} | {name} | {meter(ort)[0]:.0f} | {meter(ort)[1]:.0f} | {hoehe(ort):.0f} | '
                                    f'{math.dist(meter(ort), meter(enklave)):.0f} | {math.hypot(*meter(ort)):.0f} |')
    print('| Typ | Ort | x | z | Höhe m | zur Enklave m | zum Start m |')
    print('|---|---|---|---|---|---|---|')
    for o in sorted(s['orte'], key=lambda o: math.dist(meter(o['ort']), meter(enklave))):
        print(zeile('Zuflucht' if o['art'] == 'zuflucht' else 'Bewohner', f'{o["name"]} (`{o["id"]}`)', o['ort']))
    for f in s['fragmente']:
        if f['id'] in s['rein']:
            print(zeile('Reinkultur', f'{f["titel"]} (`{f["id"]}` → `{s["rein"][f["id"]]}`)', f['ort']))
    for v in s['region'].get('verborgeneOrte', []):
        print(zeile('verborgen', f'{v["name"]} (`{v["id"]}`, {v["verhaerteter"]}, Spur: {v["spur"]})', v['ort']))
    for f in s['figuren']:
        for i, st in enumerate(f['stationen']):
            print(zeile(f'Figur {f["fraktion"]}', f'{f["name"]} {i + 1}: {st["wo"]}', st['ort']))
    print(zeile('Regent', s['regent']['name'], s['regent']['ort']))


neu, alt = stand(None), stand(ALT)
fig, (links, rechts) = plt.subplots(1, 2, figsize=(22, 11.4))
zeichne(links, alt, f'ALT (Stand {ALT}): Dorf im Talboden, 492–494 m — Flutfläche unter 499 m zum Vergleich eingezeichnet')
zeichne(rechts, neu, f'NEU (D375): Enklave auf der Hangterrasse, Flutlinie {neu["region"]["flutlinie"]} m')
fig.suptitle('BRACHLAND · Œntal · Ortsliste alt gegen neu — Draufsicht aus dem Höhenraster (10 m), Norden oben. '
             'Gelb ▲ Zuflucht · rot ● Bewohner · grün ★ Reinkultur-Ort · violett ◆ verborgener Ort · ✕ Regent · '
             'weiss ■ Fundstück · rot gepunktet 900 m um die Enklave · rot gestrichelt 1.000-m-Linie', fontsize=9)
fig.tight_layout(rect=(0, 0, 1, 0.97))
fig.savefig(AUSGABE, dpi=120)
print(f'Bild: {AUSGABE}\n')
tabelle(neu)
