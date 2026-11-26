/** Visueller A/B-Lauf mit normaler Spielkamera, fester Eingabe und echter Zeitbasis.
 * node tools/mess/echtzeitfahrt.mjs <name> [url-zusatz] [x,z,grad|hofwest|ort:<id>] [960x540|1280x720] [port]
 * Ausgabe: .cache/mess/<name>/fahrt.mp4 und bericht.json. Braucht Playwright und FFmpeg (libx264).
 * CDP liefert Unix-Zeitstempel am Bild. Der Clip beginnt bei W-down und endet bei W-up,
 * auf der gleichen Zeitachse wie die Browserereignisse. Bildlücken bleiben als Standzeit sichtbar.
 * Die Aufnahme beeinflusst die Bildrate. Für FPS und Perzentile separat vergleich.mjs verwenden.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { playwright } from './pw.mjs';
import { messroute, bereiteHofwestroute, laufeHofwestroute } from './hofwestroute.mjs';

const [name, extra = '', strecke = '1436,398,171', format = '960x540', port = '4173'] = process.argv.slice(2);
const weg = messroute(strecke);
const ort = weg?.start ?? strecke;
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Ungültiger Preview-Port.');
if (!name || !/^[a-z0-9_-]+$/i.test(name)) throw new Error('Neuen einfachen Namen angeben.');
if (extra && !extra.startsWith('&')) throw new Error('Zusatzparameter mit & beginnen und in Anführungszeichen setzen.');
if (!/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(ort)) throw new Error('Ort als x,z,grad angeben.');
if (format !== '960x540' && format !== '1280x720') throw new Error('Format als 960x540 oder 1280x720 angeben.');

const [width, height] = format.split('x').map(Number);
const url = `http://127.0.0.1:${port}/?absetzen=${ort}&zeit=0.26&kontur=0${extra}`;
const warmupMs = 15000;
const dauerZielMs = 12000;
const vorlaufMs = 600;
const nachlaufMs = 300;
const videoFps = 60;
const ziel = resolve('.cache/mess', name);
const videodatei = join(ziel, 'fahrt.mp4');
const { chromium } = await playwright();
mkdirSync(resolve('.cache/mess'), { recursive: true });
mkdirSync(ziel);

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
});
const bilder = [];
const fehler = [];
let marken, route;
try {
  const seite = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  seite.on('pageerror', fehlerobjekt => fehler.push(String(fehlerobjekt)));
  seite.on('console', meldung => { if (meldung.type() === 'error') fehler.push(meldung.text()); });
  await seite.goto(url, { waitUntil: 'domcontentloaded' });
  await seite.waitForSelector('button[aria-label="Menü"]', { timeout: 240000 });
  await seite.waitForFunction(() => document.body.textContent.includes('Ladezeit'), undefined, { timeout: 120000 });
  await seite.waitForTimeout(warmupMs);
  if (strecke.startsWith('ort:')) await seite.addStyleTag({ content: '* {visibility:hidden!important} canvas {visibility:visible!important}' });
  if (weg) await bereiteHofwestroute(seite, weg);
  else await seite.evaluate(() => {
    window.__echtzeitfahrtMarken = {};
    window.addEventListener('keydown', ereignis => {
      if (ereignis.code === 'KeyW') window.__echtzeitfahrtMarken.startMs = performance.timeOrigin + performance.now();
    }, { capture: true });
    window.addEventListener('keyup', ereignis => {
      if (ereignis.code === 'KeyW') window.__echtzeitfahrtMarken.endeMs = performance.timeOrigin + performance.now();
    }, { capture: true });
  });
  const cdp = await seite.context().newCDPSession(seite);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    // Empfang sofort bestätigen. Die MP4-Kodierung beginnt nach der Fahrt.
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(fehlerobjekt => fehler.push(String(fehlerobjekt)));
    if (Number.isFinite(metadata.timestamp)) bilder.push({ jpeg: data, zeitMs: metadata.timestamp * 1000 });
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  await seite.waitForTimeout(vorlaufMs);
  if (weg) {
    route = await laufeHofwestroute(seite);
    marken = route;
    if (route.fehler) fehler.push(route.fehler);
  } else {
    await seite.keyboard.down('Shift');
    await seite.keyboard.down('w');
    await seite.waitForTimeout(dauerZielMs);
    await seite.keyboard.up('w');
    await seite.keyboard.up('Shift');
    marken = await seite.evaluate(() => window.__echtzeitfahrtMarken);
  }
  await seite.waitForTimeout(nachlaufMs);
  await cdp.send('Page.stopScreencast');
} finally {
  await browser.close();
}

const { startMs, endeMs } = marken;
if (!Number.isFinite(startMs) || !Number.isFinite(endeMs) || endeMs <= startMs) {
  throw new Error('Die Browser-Zeitmarken für W-down und W-up fehlen.');
}
bilder.sort((a, b) => a.zeitMs - b.zeitMs);
const startbild = bilder.findLast(bild => bild.zeitMs <= startMs);
const fahrbilder = bilder.filter((bild, index) => bild.zeitMs > startMs && bild.zeitMs < endeMs
  && bild.zeitMs !== bilder[index - 1]?.zeitMs);
if (!startbild || fahrbilder.length < 2) throw new Error(`Zu wenige zeitlich zuordenbare Aufnahmen (${bilder.length} CDP-Bilder).`);

const dauerMs = endeMs - startMs;
const schnitt = [{ ...startbild, zeitMs: startMs }, ...fahrbilder];
const temp = mkdtempSync(join(tmpdir(), 'brachland-fahrt-'));
try {
  const liste = ['ffconcat version 1.0'];
  for (const [index, bild] of schnitt.entries()) {
    const datei = `${index}.jpg`;
    writeFileSync(join(temp, datei), Buffer.from(bild.jpeg, 'base64'));
    const naechsteZeit = schnitt[index + 1]?.zeitMs ?? endeMs;
    // Eine Millisekunde Eingabe-Zeitbasis erhält auch schnelle Bildwechsel im Manifest.
    liste.push(`file ${datei}`, 'option framerate 1000', `duration ${((naechsteZeit - bild.zeitMs) / 1000).toFixed(6)}`);
  }
  // Der letzte Eintrag gibt FFmpeg einen Zeitstempel am Ende der letzten Standzeit.
  liste.push(`file ${schnitt.length - 1}.jpg`, 'option framerate 1000');
  writeFileSync(join(temp, 'fahrt.ffconcat'), `${liste.join('\n')}\n`);
  const kodierung = spawnSync('ffmpeg', [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-n', '-f', 'concat', '-safe', '0', '-i', join(temp, 'fahrt.ffconcat'),
    '-t', (dauerMs / 1000).toFixed(6), '-vf', `fps=${videoFps}`, '-c:v', 'libx264', '-crf', '17',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', videodatei,
  ], { stdio: 'inherit' });
  if (kodierung.error) throw kodierung.error;
  if (kodierung.status !== 0) throw new Error('FFmpeg konnte fahrt.mp4 nicht erzeugen.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}

const bericht = {
  url, ort, format, warmupMs, dauerMs,
  ...(weg ? { eingabe: 'W und Maus', route } : { eingabe: 'Shift+W', dauerZielMs }),
  zeitbasis: 'Unix-Millisekunden, DOM-Tastenereignisse und CDP-Bildzeitstempel',
  schnittUnixMs: { startMs, endeMs },
  erstesCDPBildRelativMs: bilder[0].zeitMs - startMs,
  letztesCDPBildRelativMs: bilder.at(-1).zeitMs - startMs,
  cdpBilderImSchnitt: schnitt.length, videoFps, videodatei: 'fahrt.mp4', fehler,
};
writeFileSync(join(ziel, 'bericht.json'), `${JSON.stringify(bericht, null, 2)}\n`);
console.log(JSON.stringify(bericht, null, 2));
if (fehler.length) process.exitCode = 1;
