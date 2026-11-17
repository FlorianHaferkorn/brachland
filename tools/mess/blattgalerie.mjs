/** D300: eigenständiger Vergleich aus abgeschlossenen Blatt- und Spielläufen.
 * node tools/mess/blattgalerie.mjs <neuer-name> <detail-vor> <detail-nach> <lauf-vor> <lauf-nach> [<fahrt-vor> <fahrt-nach>]
 * Ordnerpfade sind relativ zum Arbeitsverzeichnis; historische Ausgaben werden nie überschrieben.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const argumente = process.argv.slice(2);
const staende = argumente.find(a => a.startsWith('--staende='))?.slice(10).split(',') ?? ['D299', 'D300'];
if (staende.length !== 2 || staende.some(s => !/^D[0-9]+$/.test(s))) throw Error('Zwei Stände als --staende=D300,D301 angeben.');
const [vorherStand, nachherStand] = staende;
const [name, ...eingaben] = argumente.filter(a => !a.startsWith('--staende='));
if (!name || !/^[a-z0-9_-]+$/i.test(name) || ![4, 6].includes(eingaben.length)) {
  throw Error('Neuen Namen und vier Eingabeordner angeben: Detail vor/nach, Lauf vor/nach; optional Fahrt vor/nach.');
}
const ziel = resolve('.cache/bilder', name);
if (existsSync(ziel)) throw Error(`Ausgabe existiert: ${ziel}`);
const ordner = eingaben.map(pfad => {
  const absolut = resolve(pfad);
  if (!existsSync(absolut) || !statSync(absolut).isDirectory()) throw Error(`Eingabeordner fehlt: ${pfad}`);
  return absolut;
});
const roi = { x: 20, y: 25, b: 550, h: 240 };
const berichte = ordner.slice(0, 2).map(pfad => {
  const b = JSON.parse(readFileSync(join(pfad, 'bericht.json'), 'utf8'));
  if (b.modus !== 'taa' || ![24, 48].includes(b.bilder) || !Number.isFinite(b.mittlereSchwankung) || b.mittlereSchwankung < 0
    || !Array.isArray(b.fehler) || b.fehler.length || Object.keys(roi).some(k => b.roi?.[k] !== roi[k])) {
    throw Error(`Detailbericht braucht 24 oder 48 fehlerfreie TAA-Bilder mit fester Kamera/Wind und passendem Kronenausschnitt: ${pfad}`);
  }
  return b;
});
if (berichte[0].bilder !== berichte[1].bilder) throw Error('Gleiche Bildanzahl für beide Detailfolgen erwartet.');
const detailAnzahl = berichte[0].bilder;
for (const pfad of ordner.slice(0, 2)) for (let i = 0; i < detailAnzahl; i++) {
  const bild = join(pfad, `${String(i).padStart(3, '0')}.png`);
  const m = await sharp(bild).metadata();
  if (m.format !== 'png' || m.width !== 960 || m.height !== 540) throw Error(`Erwartet PNG 960×540: ${bild}`);
}
for (const pfad of ordner.slice(4, 6)) for (let i = 0; i < 96; i++) {
  const bild = join(pfad, `${String(i).padStart(3, '0')}.png`);
  const m = await sharp(bild).metadata();
  if (m.format !== 'png' || m.width !== 960 || m.height !== 540) throw Error(`Erwartet Fahrt-PNG 960×540: ${bild}`);
}
const laufVideos = ordner.slice(2, 4).map(pfad => {
  const videos = readdirSync(pfad).filter(n => n.endsWith('.webm'));
  if (videos.length !== 1) throw Error(`Genau ein Laufvideo erwartet: ${pfad}`);
  return join(pfad, videos[0]);
});
// Vor jeder Ausgabe auch die Werkzeuge und die erforderliche Länge beider Laufvideos prüfen.
execFileSync('ffmpeg', ['-version'], { stdio: 'pipe' });
for (const video of laufVideos) {
  const sekunden = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', video], { encoding: 'utf8' }).trim());
  if (!Number.isFinite(sekunden) || sekunden < 12.7) throw Error(`Laufvideo kürzer als 12,7 s: ${video}`);
}
mkdirSync(ziel, { recursive: true });
const videoOptionen = ['-an', '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-pix_fmt', 'yuv420p', '-threads', '2'];
const film = (argumente, datei, verlustfrei = false) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-n', ...argumente,
  ...videoOptionen, '-deadline', 'realtime', '-cpu-used', '5', ...(verlustfrei ? ['-pix_fmt', 'yuv444p', '-lossless', '1', '-crf', '0'] : []), join(ziel, datei)], { stdio: 'pipe' });
film(['-framerate', '6', '-start_number', '0', '-i', join(ordner[0], '%03d.png'),
  '-framerate', '6', '-start_number', '0', '-i', join(ordner[1], '%03d.png'),
  '-filter_complex', '[0:v]crop=550:240:20:25,scale=1100:480:flags=neighbor,setpts=PTS-STARTPTS[a];[1:v]crop=550:240:20:25,scale=1100:480:flags=neighbor,setpts=PTS-STARTPTS[b];[a][b]hstack=inputs=2:shortest=1[v]',
  '-map', '[v]', '-frames:v', String(detailAnzahl)], 'blattvergleich.webm', true);
film(['-sseof', '-12.7', '-i', laufVideos[0], '-sseof', '-12.7', '-i', laufVideos[1],
  '-filter_complex', '[0:v]fps=30,scale=960:540,setsar=1,setpts=PTS-STARTPTS[a];[1:v]fps=30,scale=960:540,setsar=1,setpts=PTS-STARTPTS[b];[a][b]hstack=inputs=2:shortest=1[v]',
  '-map', '[v]', '-t', '12.7'], 'laufvergleich.webm');
if (ordner.length === 6) {
  film(['-framerate', '12', '-start_number', '0', '-i', join(ordner[4], '%03d.png'),
    '-framerate', '12', '-start_number', '0', '-i', join(ordner[5], '%03d.png'),
    '-filter_complex', '[0:v]setsar=1,setpts=PTS-STARTPTS[a];[1:v]setsar=1,setpts=PTS-STARTPTS[b];[a][b]hstack=inputs=2:shortest=1[v]',
    '-map', '[v]', '-frames:v', '96'], 'kronenfahrt.webm', true);
}

const esc = t => String(t).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const svg = (text, breite, hoehe, groesse = 25) => Buffer.from(`<svg width="${breite}" height="${hoehe}"><rect width="100%" height="100%" fill="#151b20"/><text x="20" y="${Math.round(hoehe * 0.68)}" fill="#edf0ee" font-family="Arial,sans-serif" font-size="${groesse}">${esc(text)}</text></svg>`);
const zahl = n => n.toFixed(3).replace('.', ',');
const metrik = `Isolierte mittlere RGB-Schwankung (0–255): ${zahl(berichte[0].mittlereSchwankung)} → ${zahl(berichte[1].mittlereSchwankung)}`;
const lagen = [{ input: svg(`BRACHLAND – Blattflimmern: ${vorherStand} / ${nachherStand}`, 2200, 64, 32), left: 0, top: 0 }];
for (let i = 0; i < 2; i++) {
  const links = i * 1100, bild = join(ordner[i], `${String(detailAnzahl - 1).padStart(3, '0')}.png`);
  lagen.push({ input: svg(i === 0 ? `VORHER · ${vorherStand}` : `NACHHER · ${nachherStand}`, 1100, 42), left: links, top: 64 },
    { input: await sharp(bild).png().toBuffer(), left: links + 70, top: 106 },
    { input: svg('Kronenausschnitt · 2× · letzte Probe der Bildfolge', 1100, 42, 22), left: links, top: 646 },
    { input: await sharp(bild).extract({ left: roi.x, top: roi.y, width: roi.b, height: roi.h }).resize(1100, 480, { kernel: 'nearest' }).png().toBuffer(), left: links, top: 688 });
}
lagen.push({ input: svg(metrik, 2200, 48), left: 0, top: 1168 },
  { input: svg(`${detailAnzahl} TAA-Bilder bei fester Kamera/Windphase; isolierter Messwert, kein allgemeiner Flimmerbeweis.`, 2200, 48, 24), left: 0, top: 1216 });
const tafel = await sharp({ create: { width: 2200, height: 1264, channels: 3, background: '#151b20' } }).composite(lagen).png().toBuffer();
writeFileSync(join(ziel, 'vergleich.png'), tafel, { flag: 'wx' });
// Relative Medien halten die Seite klein; der komplette Ausgabeordner bleibt transportabel.
const fahrtAbschnitt = ordner.length === 6 ? `<h2>Gleiche Kamerafahrt durch die Kronen</h2><p>96 schrittweise gezeichnete Bilder aus dem echten Spielrenderer, mit aktiver zeitlicher Kantenglättung (TAA). Kameraposition und Windphase sind für jede Bildnummer in beiden Varianten identisch. Die geskriptete Straßenfahrt umfasst vier Sekunden Spielbewegung und läuft hier bei halber Geschwindigkeit (12 Bilder/s, acht Sekunden). Sie zeigt diesen begrenzten Ausschnitt und ist kein allumfassender Flimmerbeweis oder Gameplay-FPS-Messlauf.</p><figure><figcaption><span>VORHER · ${vorherStand}</span><span>NACHHER · ${nachherStand}</span></figcaption><video controls loop playsinline preload="metadata" src="kronenfahrt.webm"></video></figure>` : '';
const html = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BRACHLAND – Blattflimmern ${vorherStand} / ${nachherStand}</title><style>
body{margin:0;background:#151b20;color:#edf0ee;font:16px/1.5 system-ui}main{max-width:1600px;margin:auto;padding:24px}h1{font-size:28px}p{max-width:1100px;color:#c8d0d1}img,video{display:block;width:100%;height:auto;background:#080b0e}figure{margin:24px 0}figcaption{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:10px 0;font-weight:650}figcaption span:last-child{text-align:right}.zahl{font-size:20px;color:#edf0ee}a{color:#c8e5cd}</style><main>
<h1>Blattflimmern – ${vorherStand} gegen ${nachherStand}</h1><p>Links steht der bisherige ${vorherStand}-Stand, rechts die ${nachherStand}-Korrektur. Beide Bildfolgen verwenden dieselbe Kamera, Auflösung, Beleuchtung und festgehaltene Winduniformen.</p>
<p class="zahl">${esc(metrik)}</p><p>Gemessen als mittlere absolute Abweichung jedes RGB-Kanals vom jeweiligen Pixelmittel über ${detailAnzahl} aufeinanderfolgende TAA-Bilder im Ausschnitt x20/y25, 550×240 Pixel. Die Einzelbilder wurden schrittweise ausgelöst. Das ist eine isolierte Schwankungsmessung und kein allgemeiner Beweis für flimmerfreie Vegetation oder eine Performanceaussage.</p>
<h2>Blattkanten in Zeitlupe</h2><p>${detailAnzahl} Einzelbilder bei 6 Bildern/s, identische Bildnummern nebeneinander; zweifach vergrößert ohne zusätzliche Weichzeichnung.</p><figure><figcaption><span>VORHER · ${vorherStand}</span><span>NACHHER · ${nachherStand}</span></figcaption><video controls loop playsinline preload="metadata" src="blattvergleich.webm"></video></figure>
${fahrtAbschnitt}
<h2>Lauf und Kameraschwenk am Hof</h2><p>Jeweils die letzten 12,7 Sekunden beider Spielaufzeichnungen, synchron nebeneinander. Der Bewegungsablauf ist gleich, Wind- und NPC-Phasen laufen unabhängig. Die Videos dienen der Sichtprüfung; ihre Aufzeichnung beeinflusst die Bildzeit.</p><figure><figcaption><span>VORHER · ${vorherStand}</span><span>NACHHER · ${nachherStand}</span></figcaption><video controls loop playsinline preload="metadata" src="laufvergleich.webm"></video></figure>
<h2>Standbild und Kronendetail</h2><p>Das Standbild zeigt Form und Deckung; zeitliche Ruhe lässt sich nur in den Videos beurteilen.</p><img src="vergleich.png" alt="Vergleichstafel: links ${vorherStand}, rechts ${nachherStand}, jeweils vollständiges Spielbild und zweifacher Kronenausschnitt."></main></html>`;
writeFileSync(join(ziel, 'vergleich.html'), html, { flag: 'wx' });
console.log(join(ziel, 'vergleich.html'));
console.log(join(ziel, 'vergleich.png'));
