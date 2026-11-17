/** D302: Strauch-Fernwechsel synchron vergleichen, ohne historische Ergebnisse zu ersetzen.
 * node tools/mess/strauchgalerie.mjs <neuer-name> <vor-ordner> <nach-ordner> [normalspiel-ordner]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const [name, ...eingaben] = process.argv.slice(2);
if (!name || !/^[a-z0-9_-]+$/i.test(name) || ![2, 3].includes(eingaben.length)) {
  throw Error('Neuen Namen, Vorher-/Nachher-Ordner und optional einen normalen Spiellauf angeben.');
}
const ziel = resolve('.cache/bilder', name);
if (existsSync(ziel)) throw Error(`Ausgabe existiert bereits: ${ziel}`);
const ordner = eingaben.map(pfad => {
  const p = resolve(pfad);
  if (!existsSync(p) || !statSync(p).isDirectory()) throw Error(`Eingabeordner fehlt: ${pfad}`);
  return p;
});
const berichte = ordner.slice(0, 2).map((pfad, lauf) => {
  const b = JSON.parse(readFileSync(join(pfad, 'bericht.json'), 'utf8'));
  if (b.probe !== String(lauf) || !Array.isArray(b.proben) || b.proben.length !== 120 || !Array.isArray(b.luecken)
    || !Array.isArray(b.formen) || !Array.isArray(b.materialien) || !Array.isArray(b.fehler)
    || !Number.isInteger(b.eigenschaften) || b.eigenschaften < 0
    || b.proben.some((p, i) => p.index !== i || !Number.isFinite(p.abstand) || !Array.isArray(p.ziele))) {
    throw Error(`Bericht braucht 120 vollständige Strauchlauf-Proben: ${pfad}`);
  }
  return b;
});
if (berichte.some(b => b.fehler.length)) throw Error('Rendererberichte enthalten Fehler.');
if (berichte[0].darstellung !== berichte[1].darstellung || berichte[0].proben.some((p, i) => Math.abs(p.abstand - berichte[1].proben[i].abstand) > 1e-6)) throw Error('Gleiche Darstellung und Kamerafolge erwartet.');
const bildPfad = (lauf, bild) => join(ordner[lauf], `${String(bild).padStart(3, '0')}.png`);
for (let lauf = 0; lauf < 2; lauf++) for (let i = 0; i < 120; i++) {
  const m = await sharp(bildPfad(lauf, i)).metadata();
  if (m.format !== 'png' || m.width !== 960 || m.height !== 540) throw Error(`Erwartet PNG 960×540: ${bildPfad(lauf, i)}`);
}
let normalVideo = null;
if (ordner.length === 3) {
  const videos = readdirSync(ordner[2]).filter(n => /^page.*\.webm$/.test(n));
  if (videos.length !== 1) throw Error('Normaler Spiellauf braucht genau ein page*.webm.');
  normalVideo = join(ordner[2], videos[0]);
  const sekunden = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', normalVideo], { encoding: 'utf8' }).trim());
  if (!Number.isFinite(sekunden) || sekunden < 12.7) throw Error('Normaler Spiellauf ist kürzer als 12,7 Sekunden.');
}
execFileSync('ffmpeg', ['-version'], { stdio: 'pipe' });
mkdirSync(ziel, { recursive: true });
const film = (argumente, datei, verlustfrei) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-n',
  ...argumente, '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-deadline', 'realtime', '-cpu-used', '5', '-threads', '2',
  ...(verlustfrei ? ['-lossless', '1', '-crf', '0', '-pix_fmt', 'yuv444p'] : ['-crf', '30', '-pix_fmt', 'yuv420p']),
  join(ziel, datei)], { stdio: 'pipe' });
film(['-framerate', '12', '-start_number', '0', '-i', join(ordner[0], '%03d.png'),
  '-framerate', '12', '-start_number', '0', '-i', join(ordner[1], '%03d.png'),
  '-filter_complex', '[0:v]setsar=1,setpts=PTS-STARTPTS[a];[1:v]setsar=1,setpts=PTS-STARTPTS[b];[a][b]hstack=inputs=2:shortest=1[v]',
  '-map', '[v]', '-frames:v', '120'], 'fernvergleich.webm', true);
film(['-framerate', '12', '-i', join(ordner[0], '%03d.png'), '-framerate', '12', '-i', join(ordner[1], '%03d.png'),
  '-filter_complex', '[0:v]crop=240:200:360:170,scale=960:800:flags=neighbor[a];[1:v]crop=240:200:360:170,scale=960:800:flags=neighbor[b];[a][b]hstack=inputs=2:shortest=1[v]',
  '-map', '[v]', '-frames:v', '120'], 'detailvergleich.webm', true);
if (normalVideo) film(['-sseof', '-12.7', '-i', normalVideo, '-vf', 'fps=30', '-t', '12.7'], 'normalspiel.webm', false);

const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const svg = (text, breite, hoehe, groesse = 23) => Buffer.from(`<svg width="${breite}" height="${hoehe}"><rect width="100%" height="100%" fill="#151b20"/><text x="18" y="${Math.round(hoehe * 0.68)}" fill="#edf0ee" font-family="Arial,sans-serif" font-size="${groesse}">${esc(text)}</text></svg>`);
const fern = berichte[0].proben.reduce((best, p, i, a) => p.ziele.some(z => z.name?.includes(':fern'))
  && berichte[1].proben[i].ziele.some(z => z.name?.includes(':fern')) && (best < 0 || p.abstand < a[best].abstand) ? i : best, -1);
const nah = berichte[0].proben.reduce((best, p, i, a) => p.abstand < a[best].abstand ? i : best, 0);
const bilder = [fern < 0 ? 0 : fern, nah];
const lagen = [{ input: svg('BRACHLAND – Strauch-Fernwechsel: D301 / D302', 1920, 60, 29), left: 0, top: 0 }];
for (const [reihe, bild] of bilder.entries()) {
  const y = 60 + reihe * 584;
  for (let lauf = 0; lauf < 2; lauf++) {
    const abstand = berichte[lauf].proben[bild].abstand.toFixed(1).replace('.', ',');
    const text = `${lauf === 0 ? 'VORHER · D301' : 'NACHHER · D302'} · Bild ${String(bild).padStart(3, '0')} · XZ-Abstand ${abstand} m`;
    lagen.push({ input: svg(text, 960, 44, 21), left: lauf * 960, top: y },
      { input: readFileSync(bildPfad(lauf, bild)), left: lauf * 960, top: y + 44 });
  }
}
lagen.push({ input: svg('Erhöhte Telekamera mit 10° Sichtfeld; vergrößerte Fern-LOD-Prüfung, kein normaler Gameplay-/FPS-Lauf.', 1920, 48, 22), left: 0, top: 1228 });
await sharp({ create: { width: 1920, height: 1276, channels: 3, background: '#151b20' } }).composite(lagen).png().toFile(join(ziel, 'vergleich.png'));

const zeilen = [
  ['Proben', b => b.proben.length], ['Proben mit fehlendem oder doppeltem Zielstrauch', b => b.luecken.length],
  ['Geometrieformen des Zielstrauchs', b => b.formen.length], ['Materialien des Zielstrauchs', b => b.materialien.length],
  ['Kombinationen aus Transformation, Farbe und Schattenempfang', b => b.eigenschaften],
  ['Erfasste Browser-/Prüffehler', b => b.fehler.length],
];
if (berichte.every(b => Number.isFinite(b.maxFernMenge))) zeilen.push(['Maximal markierte Hof-Ferninstanzen', b => b.maxFernMenge]);
const zielDreiecke = b => [...new Set(b.proben.flatMap(p => p.ziele.map(z => z.dreiecke)).filter(Number.isFinite))].sort((a, c) => a - c);
if (berichte.every(b => zielDreiecke(b).length)) zeilen.push(['Beobachtete Dreiecke je Zielinstanz', b => zielDreiecke(b).join(' / ')]);
const tabelle = zeilen.map(([text, wert]) => `<tr><th scope="row">${esc(text)}</th>${berichte.map(b => `<td>${esc(wert(b))}</td>`).join('')}</tr>`).join('');
const normal = normalVideo ? '<h2>Zusätzlicher normaler Spiellauf · D302</h2><p>Die letzten 12,7 Sekunden der unabhängigen Spielaufzeichnung. Hier gelten normales Sichtfeld und Spielsteuerung. Die Videoaufnahme beeinflusst die Bildzeit; sie ist kein isolierter Performancevergleich.</p><video controls playsinline preload="metadata" src="normalspiel.webm"></video>' : '';
const freigestellt = berichte[0].darstellung === 'freigestellt' ? '<p>Für diese Diagnose sind große Prop-Bäume ausgeblendet, damit der Zielstrauch nicht von Kronen verdeckt wird. Das verändert auch deren Schatten und ist keine Gesamtbild-Abnahme. Der normale Spiellauf darunter zeigt die vollständige Szene.</p>' : '';
const html = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BRACHLAND – Strauch-Fernwechsel D301 / D302</title><style>
body{margin:0;background:#151b20;color:#edf0ee;font:16px/1.5 system-ui}main{max-width:1600px;margin:auto;padding:24px}h1{font-size:28px}p{max-width:1100px;color:#c4ced0}video,img{display:block;width:100%;height:auto;background:#080b0e}.spalten{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:12px 0;font-weight:650}.spalten span:last-child{text-align:right}table{border-collapse:collapse;width:100%;max-width:1200px}th,td{border-bottom:1px solid #3b4b4f;padding:9px 12px;text-align:left}thead th,td{text-align:right}th:first-child{text-align:left}a{color:#c8e5cd}</style><main>
<h1>Strauch-Fernwechsel – D301 gegen D302</h1><p>Die erhöhte Telekamera mit nur 10° Sichtfeld vergrößert den Fernwechsel gezielt. Sie fährt im XZ-Abstand von 235 auf 100 und wieder auf 235 Meter. Beide Varianten verwenden dieselbe Kamerafolge und Windphase je Bildnummer.</p>
<p>Dies ist der echte Spielrenderer mit seiner LOD-Verwaltung, aber kein normaler Gameplay- oder FPS-Lauf. Die 120 Bilder entsprechen fünf Sekunden bei 24 Schritten/s; das synchrone Video läuft bei halber Geschwindigkeit, 12 Bilder/s und zehn Sekunden. Geometrie- und Materialkonstanz sind technische Prüfwerte und keine pauschale Look- oder Übergangsfreigabe.</p>
${freigestellt}<h2>Detailvergleich · 4× Pixelvergrößerung</h2><p>Zentraler Bildausschnitt ohne zusätzliche Weichzeichnung; dieselbe Bildfolge. Der Strauch bleibt in der Bildmitte.</p><div class="spalten"><span>VORHER · D301</span><span>NACHHER · D302</span></div><video controls loop playsinline preload="metadata" src="detailvergleich.webm"></video>
<h2>Direkter Bewegungsvergleich · ganzes Bild</h2><div class="spalten"><span>VORHER · D301</span><span>NACHHER · D302</span></div><video controls loop playsinline preload="metadata" src="fernvergleich.webm"></video>
<h2>Erfasste Prüfwerte</h2><table><thead><tr><th>Prüfung</th><th>D301</th><th>D302</th></tr></thead><tbody>${tabelle}</tbody></table><p>Die Werte zählen den beobachteten Zielstrauch und die im Bericht erfasste Fernmenge. Objektkennungen werden nicht angezeigt. Erhaltene Form und Beleuchtung ersetzen nicht die Sichtprüfung in Bewegung.</p>
${normal}<h2>Fernansicht und Annäherung</h2><p>Standbilder zeigen Form, Deckung und Material; zeitliche Übergänge lassen sich nur in den Videos beurteilen.</p><img src="vergleich.png" alt="D301 links und D302 rechts: Fernansicht und Annäherung desselben Strauchs."><p><a href="fernvergleich.webm">Fernvergleich als Video öffnen</a> · <a href="vergleich.png">Vergleichstafel öffnen</a></p></main></html>`;
writeFileSync(join(ziel, 'vergleich.html'), html, { flag: 'wx' });
console.log(join(ziel, 'vergleich.html'));
console.log(join(ziel, 'vergleich.png'));
