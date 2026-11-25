/** Spielsteuerung für den zusammenhängenden Prüflauf vom Hof zur Weststraße (Weg 600). */
const punkte = [
  [1451, 395.5], [1434.4, 404.9], [1427.5, 406], [1418, 405.5], [1411, 407],
  [1396, 407], [1392, 412], [1388.5, 412], [1369, 412], [1362, 420],
  [1368.2, 434.5], [1375.7, 451], [1384.8, 471],
];
const weststrasse = 9;
const [start, erster] = punkte;
const blick = Math.atan2(start[0] - erster[0], start[1] - erster[1]);
export const HOFWEST_START = [...start, blick * 180 / Math.PI].join(',');

/** Beobachtet die Spielfigur und lenkt über denselben Mauspfad wie normale Eingabe.
 * Der Test bewegt weder Figur noch Kamera direkt. Wegpunkte und Bildzeiten
 * haben dieselbe Browser-Uhr wie die Echtzeitaufnahme.
 */
export async function bereiteHofwestroute(seite) {
  await seite.evaluate(({ punkte, blick, weststrasse }) => {
    const [sx, sz] = punkte[0];
    const kandidaten = window.__szene?.children.filter(o => o.type === 'Object3D'
      && Math.hypot(o.position.x - sx, o.position.z - sz) < 0.8);
    if (kandidaten?.length !== 1) throw new Error('Die Spielfigur am Routenstart ist nicht eindeutig.');
    const position = kandidaten[0].position;
    const leinwand = document.querySelector('canvas');
    if (!leinwand) throw new Error('Leinwand fehlt.');
    const id = 325;
    let mausX = 700;
    const mausY = 280;
    const maus = (ziel, typ, x) => ziel.dispatchEvent(new PointerEvent(typ, {
      pointerId: id, pointerType: 'mouse', clientX: x, clientY: mausY,
    }));
    const zustand = { fertig: false, fehler: null, startMs: null, endeMs: null,
      westMs: null, bilder: [], wegpunkte: [] };
    window.__hofwestroute = zustand;
    window.addEventListener('keydown', ereignis => {
      if (ereignis.code !== 'KeyW' || zustand.startMs !== null) return;
      zustand.startMs = performance.timeOrigin + performance.now();
      let ziel = 1, gier = blick;
      let letzterFortschritt = null;
      maus(leinwand, 'pointerdown', mausX);

      const ende = (fehler, zeit) => {
        zustand.fehler = fehler;
        zustand.endeMs = zeit;
        maus(window, 'pointerup', mausX);
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' }));
        zustand.fertig = true;
      };
      const schritt = zeit => {
        const jetzt = performance.timeOrigin + zeit;
        const { x, z } = position;
        zustand.bilder.push([jetzt, x, z]);
        if (Math.hypot(x - punkte[ziel][0], z - punkte[ziel][1]) < 0.9) {
          zustand.wegpunkte.push({ nr: ziel, zeitMs: jetzt, x, z });
          if (ziel === weststrasse) zustand.westMs = jetzt;
          if (++ziel === punkte.length) { ende(null, jetzt); return; }
        }
        letzterFortschritt ??= { x, z, zeit: jetzt };
        if (jetzt - letzterFortschritt.zeit > 900) {
          if (Math.hypot(x - letzterFortschritt.x, z - letzterFortschritt.z) < 1.35) {
            ende(`Zu wenig Bewegung vor Wegpunkt ${ziel} bei ${x.toFixed(2)}, ${z.toFixed(2)}.`, jetzt);
            return;
          }
          letzterFortschritt = { x, z, zeit: jetzt };
        }
        if (jetzt - zustand.startMs > 65000) { ende('Route nach 65 s unvollständig.', jetzt); return; }
        const [tx, tz] = punkte[ziel];
        const soll = Math.atan2(x - tx, z - tz);
        const delta = Math.atan2(Math.sin(soll - gier), Math.cos(soll - gier));
        // 320 px/rad wie in spieler/steuerung.ts. Begrenzen, damit Kurven in mehreren
        // Spielbildern ausgelenkt werden und in beiden Aufnahmen lesbar bleiben.
        const vorher = zustand.bilder.at(-2)?.[0] ?? zustand.startMs;
        const grenze = Math.max(1, Math.min(32, Math.round((jetzt - vorher) * 0.64)));
        const dx = Math.max(-grenze, Math.min(grenze, Math.round(-delta * 320)));
        if (dx) { mausX += dx; maus(window, 'pointermove', mausX); gier -= dx / 320; }
        requestAnimationFrame(schritt);
      };
      requestAnimationFrame(schritt);
    }, { capture: true });
  }, { punkte, blick, weststrasse });
}

export async function laufeHofwestroute(seite) {
  await seite.keyboard.down('w');
  try {
    await seite.waitForFunction(() => window.__hofwestroute.fertig, undefined, { polling: 250, timeout: 70000 });
    return await seite.evaluate(() => window.__hofwestroute);
  } finally {
    await seite.keyboard.up('w');
  }
}

export function hofwestZeiten(route) {
  const bilder = route.bilder.slice(1).map(([zeit], i) => ({ zeit, dt: zeit - route.bilder[i][0] }));
  return {
    gesamt: bilder.map(bild => bild.dt),
    hof: bilder.filter(bild => bild.zeit <= route.westMs).map(bild => bild.dt),
    weststrasse: bilder.filter(bild => bild.zeit > route.westMs).map(bild => bild.dt),
  };
}
