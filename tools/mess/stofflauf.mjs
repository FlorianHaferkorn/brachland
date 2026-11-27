/** Spielaufnahme des Gewands: dieselben Tasteneingaben in 40-ms-Schritten oder der Weg der Hofbesitzerin.
 * node tools/mess/stofflauf.mjs <Ausgabeordner> spielerin|bewohnerin vorher|nachher
 * MESS_URL kann auf einen eigenen Preview zeigen. Die feste Aufnahmeuhr dient dem Bildvergleich.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { playwright } from './pw.mjs';

const [ordner, figur, stand] = process.argv.slice(2);
if (!ordner || !['spielerin', 'bewohnerin'].includes(figur) || !['vorher', 'nachher'].includes(stand)) {
  throw new Error('Ausgabeordner, spielerin|bewohnerin und vorher|nachher angeben.');
}
const hof = figur === 'bewohnerin';
const start = hof ? '-195.4,406,180' : '1451,395.5,119.5';
const kamera = hof ? '&kamera=-194.3,255.55,417.5,-194.1,255.25,421.2&fov=36' : '&zoom=.48&umschau=72';
const url = (process.env.MESS_URL ?? 'http://127.0.0.1:4173') + '/?absetzen=' + start + kamera
  + '&hofbau=1&echt=1&zeit=.38' + (stand === 'vorher' ? '&kleiderfall=0' : '');
mkdirSync(ordner, { recursive: true });
const { chromium } = await playwright();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const zwischen = mkdtempSync(join(tmpdir(), 'brachland-stoff-'));
try {
  const seite = await browser.newPage({ viewport: { width: 960, height: 720 } });
  const fehler = [];
  seite.on('pageerror', e => fehler.push(e.message));
  const cdp = await seite.context().newCDPSession(seite);
  await seite.clock.install();
  await seite.goto(url, { waitUntil: 'domcontentloaded' });
  await seite.waitForFunction(() => document.body.textContent.includes('Ladezeit') && window.__szene, null, { timeout: 150000 });
  console.log('Szene geladen', figur, stand);
  await seite.waitForFunction(({ hof, stand }) => {
    let naechster, ab = 5;
    window.__szene.traverse(o => {
      if (!o.isSkinnedMesh || o.name !== (hof ? 'Female_Peasant_Body' : 'Female_Ranger_Body')) return;
      const p = o.getWorldPosition(o.position.clone());
      const d = Math.hypot(p.x - (hof ? -195.4 : 1451), p.z - (hof ? 421.9 : 395.5));
      if (d < ab) { naechster = o; ab = d; }
    });
    if (!naechster || (stand === 'nachher' && !naechster.morphTargetInfluences?.length)) return false;
    window.__messgewand = naechster;
    return true;
  }, { hof, stand }, { timeout: 120000 });
  await seite.addStyleTag({ content: '*{visibility:hidden!important}canvas{visibility:visible!important}' });
  if (!hof) {
    // In der niedrigen Spielkamera bleibt die Silhouette des Saums beim Seitenwechsel sichtbar.
    await seite.evaluate(() => {
      const ziel = document.querySelector('canvas');
      const maus = (o, typ, y) => o.dispatchEvent(new PointerEvent(typ, {
        pointerId: 741, pointerType: 'mouse', clientX: 520, clientY: y,
      }));
      maus(ziel, 'pointerdown', 270);
      maus(window, 'pointermove', 340);
      maus(window, 'pointerup', 340);
    });
  }
  await seite.waitForTimeout(2500);
  const zeit = await seite.evaluate(() => Date.now());
  await seite.clock.pauseAt(new Date(zeit + 150));
  if (hof) {
    // Beide Läufe auf dasselbe Wegende ausrichten. Die Dauer der Aufenthaltspause ist zufällig.
    const strecke = () => seite.evaluate(() => {
      const o = window.__messgewand, p = o.getWorldPosition(o.position.clone());
      return Math.hypot(p.x + 195.4, p.z - 421.9);
    });
    let amHaus = false, gestartet = false;
    for (let i = 0; i < 850; i++) {
      const s = await strecke();
      if (s < .12) amHaus = true;
      if (amHaus && s > .15) { gestartet = true; break; }
      await seite.clock.runFor(64);
    }
    if (!gestartet) throw new Error('Bewohnerin erreichte den Wegbeginn nicht.');
  }
  console.log('Aufnahme beginnt', figur, stand);
  const bilder = [];
  for (let i = 0; i < (hof ? 110 : 122); i++) {
    if (!hof) {
      if (i === 12) await seite.keyboard.down('w');
      if (i === 31) await seite.keyboard.down('Shift');
      if (i === 48) { await seite.keyboard.up('w'); await seite.keyboard.down('d'); }
      if (i === 65) { await seite.keyboard.up('d'); await seite.keyboard.up('Shift'); }
    }
    await seite.clock.runFor(40);
    const bild = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 96 });
    const jpg = Buffer.from(bild.data, 'base64');
    writeFileSync(join(zwischen, String(i).padStart(3, '0') + '.jpg'), jpg);
    if (i === (hof ? 44 : 56)) writeFileSync(join(ordner, 'bewegung.jpg'), jpg);
    bilder.push(await seite.evaluate(() => {
      const m = window.__messgewand;
      return { ort: m.getWorldPosition(m.position.clone()).toArray(), stoff: [...(m.morphTargetInfluences ?? [])] };
    }));
  }
  if (stand === 'nachher' && !bilder.some(b => b.stoff.some(w => Math.abs(w) > .015))) {
    throw new Error('Der Gewandsaum hat sich während der Aufnahme nicht bewegt.');
  }
  writeFileSync(join(ordner, 'bericht.json'), JSON.stringify({ url, bilder, fehler }));
  if (fehler.length) throw new Error(fehler.join('\n'));
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '25', '-i', join(zwischen, '%03d.jpg'),
    '-an', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(ordner, 'stoff.mp4')]);
} finally {
  await browser.close();
  rmSync(zwischen, { recursive: true, force: true });
}
