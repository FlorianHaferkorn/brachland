/** D303: Hausvergleich aus gleicher Spielhöhe, mit synchronen Filmen und Bildreglern.
 * node tools/mess/hausgalerie.mjs <neuer-name> <vorher-ordner> <nachher-ordner> [spielvideo.webm]
 * Ordnernamen werden unter .cache/mess gesucht; absolute/relative Pfade gehen ebenfalls.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, constants, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const [name, vorher, nachher, spielvideo, ...rest] = process.argv.slice(2);
if (!name || !/^[a-z0-9_-]+$/i.test(name) || !vorher || !nachher || rest.length) {
  throw Error('Neuen Namen, zwei Messordner und optional ein Spielvideo angeben.');
}
if (spielvideo && (!/\.webm$/i.test(spielvideo) || !existsSync(spielvideo) || !statSync(spielvideo).isFile())) throw Error('Spielvideo muss eine vorhandene WebM-Datei sein.');
const ziel = resolve('.cache/bilder', name);
if (existsSync(ziel)) throw Error(`Ausgabe existiert bereits: ${ziel}`);
const ordner = [vorher, nachher].map(p => existsSync(p) ? resolve(p) : resolve('.cache/mess', p));
const berichte = ordner.map(p => JSON.parse(readFileSync(join(p, 'bericht.json'), 'utf8')));
if (berichte.some(b => !Array.isArray(b.fehler) || b.fehler.length)) throw Error('Beide Berichte müssen eine leere Fehlerliste enthalten.');
const folgen = ordner.map(p => readdirSync(p).filter(n => /^\d{3,}\.png$/.test(n)).sort((a, b) => Number(a.slice(0, -4)) - Number(b.slice(0, -4))));
const anzahl = folgen[0].length;
const hof=berichte[1].profil==='hof';
if (anzahl < 3 || folgen[1].length !== anzahl || folgen.some(f => f.some((n, i) => n !== `${String(i).padStart(3, '0')}.png`))) {
  throw Error('Gleich lange, lückenlose PNG-Folgen ab 000.png mit mindestens drei Bildern erwartet.');
}
for (let lauf = 0; lauf < 2; lauf++) for (const datei of folgen[lauf]) {
  const m = await sharp(join(ordner[lauf], datei)).metadata();
  if (m.format !== 'png' || m.width !== 1280 || m.height !== 720) throw Error(`PNG mit 1280×720 erwartet: ${join(ordner[lauf], datei)}`);
}
// Bekannte lokale Installationsorte sind ein Rückfall für Apps mit schmalem PATH.
let ffmpeg;
for (const kandidat of ['ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg']) {
  try { execFileSync(kandidat, ['-version'], { stdio: 'pipe' }); ffmpeg = kandidat; break; } catch { /* nächsten Ort prüfen */ }
}
if (!ffmpeg) throw Error('ffmpeg mit libvpx-vp9 fehlt.');
mkdirSync(ziel, { recursive: true });
const namen = ['vorher', 'nachher'];
for (let lauf = 0; lauf < 2; lauf++) {
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-n', '-framerate', '24', '-start_number', '0',
    '-i', join(ordner[lauf], '%03d.png'), '-frames:v', String(anzahl), '-an', '-c:v', 'libvpx-vp9', '-b:v', '0',
    '-lossless', '1', '-crf', '0', '-pix_fmt', 'yuv444p', '-deadline', 'realtime', '-cpu-used', '5', '-threads', '2',
    join(ziel, `${namen[lauf]}.webm`)], { stdio: 'pipe' });
  writeFileSync(join(ziel, `${namen[lauf]}-bericht.json`), JSON.stringify(berichte[lauf], null, 2), { flag: 'wx' });
}
if (spielvideo) copyFileSync(resolve(spielvideo), join(ziel, 'spieltest.webm'), constants.COPYFILE_EXCL);
const bilder = hof ? [0,71,143,anzahl-1] : [...new Set([0, anzahl > 47 ? 47 : Math.floor((anzahl - 1) / 3), anzahl > 95 ? 95 : Math.floor((anzahl - 1) * 2 / 3), anzahl - 1])];
for (const index of bilder) for (let lauf = 0; lauf < 2; lauf++) {
  writeFileSync(join(ziel, `${namen[lauf]}-${index}.png`), readFileSync(join(ordner[lauf], folgen[lauf][index])), { flag: 'wx' });
}
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const spielURL = berichte[1].spielURL;
let spiellink = '';
if (typeof spielURL === 'string') {
  try { const u = new URL(spielURL); if (hof) u.searchParams.set('absetzen', '1447,430,200'); if (['http:', 'https:'].includes(u.protocol)) spiellink = `<a href="${esc(u.href)}" target="_blank" rel="noopener">Nachher im Spiel öffnen</a> · `; } catch { /* kein Link bei ungültiger Adresse */ }
}
const regler = bilder.map((i, n) => `<section><h2>${(hof ? ['Hofansicht', 'Annäherung am Hof', 'Gegenüberliegende Häuser', 'Weitere Hoffassaden'] : ['Blick zum Hof', 'Annäherung', 'Hausfront aus Spielperspektive', 'Eingang aus Augenhöhe'])[n]} · Bild ${String(i).padStart(3, '0')}</h2>
<div class="vergleich" style="--anteil:50%"><img src="vorher-${i}.png" alt="Haus vor der Überarbeitung, Bild ${i}" width="1280" height="720"><img class="danach" src="nachher-${i}.png" alt="Haus nach der Überarbeitung, identische Kamera" width="1280" height="720"><span class="kante"></span><span class="schild links">VORHER</span><span class="schild rechts">NACHHER</span></div>
<label class="regler">Vergleichsgrenze <input type="range" min="0" max="100" value="50" aria-label="Vorher-Nachher-Grenze für Bild ${i}"></label>
<p class="klein"><a href="vorher-${i}.png">Vorher in voller Größe</a> · <a href="nachher-${i}.png">Nachher in voller Größe</a></p></section>`).join('');
const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BRACHLAND – Haus am Hof: Vorher / Nachher</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#151b20;color:#edf0ee;font:16px/1.5 system-ui,sans-serif}main{max-width:1700px;margin:auto;padding:24px}h1{font-size:clamp(24px,3vw,36px);margin-bottom:12px}h2{font-size:21px}p{max-width:1100px;color:#c5ced0}a{color:#c7e4cb}section{margin:36px 0}.filme{display:grid;grid-template-columns:1fr 1fr;gap:14px}.filme figure{margin:0}.filme figcaption{font-weight:650;padding:8px 0}video,img{display:block;width:100%;height:auto;background:#080b0e}video{aspect-ratio:16/9}.bedienung{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:14px 0}button,select{font:inherit;padding:8px 14px;border:1px solid #5a6c70;background:#263338;color:inherit;border-radius:5px;cursor:pointer}input[type=range]{accent-color:#b1d8b8;flex:1;min-width:120px}.vergleich{position:relative;overflow:hidden;aspect-ratio:16/9}.vergleich img{position:absolute;inset:0}.danach{clip-path:inset(0 0 0 var(--anteil))}.kante{position:absolute;top:0;bottom:0;left:var(--anteil);width:2px;background:white}.schild{position:absolute;top:12px;background:#10171ad9;padding:5px 10px;border-radius:3px;font-size:13px;font-weight:700}.links{left:12px}.rechts{right:12px}.regler{display:flex;align-items:center;gap:15px;margin:12px 0}.klein{font-size:14px}output{font-variant-numeric:tabular-nums}@media(max-width:760px){main{padding:16px}.filme{grid-template-columns:1fr}.regler{font-size:14px}.schild{top:6px;padding:3px 6px}}
</style></head><body><main><h1>${hof?'Die Häuser am Hof':'Das Haus am Hof'} – Vorher / Nachher</h1>
<p>Identische Kamerafolge mit 60° Sichtfeld und gleichem Licht. Beide Varianten zeigen die komplette Szene; keine Objekte sind für die Aufnahme freigestellt. Die reproduzierbare Kamerafahrt ist eine Sichtprüfung und kein FPS-Beleg.</p>
<p>${hof?'Drei Blicke auf den Hofverbund aus normaler Spielhöhe. Vorher: bisheriges Referenzhaus. Nachher: übertragene Bauteile an acht Wohnhäusern und korrigierte Eingänge. Die Schnitte bei drei und sechs Sekunden wechseln zwischen den Ansichten; beide Seiten verwenden dieselbe Kamerafolge.':'Die ersten 96 Bilder zeigen die Annäherung ans Gesamthaus aus der Verfolgerperspektive, Kamerahöhe 36,8 m in Weltkoordinaten. Nach vier Sekunden folgt ein Schnitt zur Eingangsannäherung aus Augenhöhe mit Kamerahöhe 36,2 m. Beide Abschnitte sind vor und nach der Überarbeitung identisch; der Schnitt ist kein LOD-Übergang.'}</p>
<p>${anzahl} Bilder je Variante, verlustfrei als VP9-WebM bei 24 Bildern/s gespeichert; Dauer ${(anzahl / 24).toFixed(2).replace('.', ',')} Sekunden. Die Video-Bildrate beschreibt die Wiedergabe der aufgenommenen Bildfolge.</p>
<h2>Direkter Vergleich in Bewegung</h2><div class="filme"><figure><figcaption>VORHER · bisheriger Hof</figcaption><video id="vorher" playsinline preload="auto" poster="vorher-0.png" src="vorher.webm"></video></figure><figure><figcaption>NACHHER · ${hof?'ausgearbeitete Hofhäuser':'ausgearbeitetes Referenzhaus'}</figcaption><video id="nachher" playsinline preload="auto" poster="nachher-0.png" src="nachher.webm"></video></figure></div>
<div class="bedienung"><button id="start" type="button">Beide abspielen</button><button id="anfang" type="button">Zum Anfang</button><label>Tempo <select id="tempo"><option value="1">1×</option><option value="0.5">0,5×</option><option value="0.25">0,25×</option></select></label><label><input id="schleife" type="checkbox" checked> Wiederholen</label></div>
<label class="regler">Position <input id="zeit" type="range" min="0" max="${Math.max(0, (anzahl - 1) / 24)}" step="${1 / 24}" value="0"><output id="anzeige">0,00 s</output></label><p id="status" class="klein" role="status">Beide Filme werden gemeinsam gesteuert.</p>
<p class="klein">${spiellink}<a href="vorher.webm">Vorher-Video einzeln öffnen</a> · <a href="nachher.webm">Nachher-Video einzeln öffnen</a></p>
${regler}${spielvideo ? '<section><h2>Zusätzlicher Spieltest mit echter Eingabe</h2><p>Unabhängige Aufzeichnung mit Spielsteuerung und anderer Windphase. Sie ergänzt die reproduzierbare Kameraprobe, ist aber kein exakt synchroner Vorher-Nachher- oder FPS-Vergleich.</p><video controls playsinline preload="metadata" src="spieltest.webm"></video><p class="klein"><a href="spieltest.webm">Spieltest einzeln öffnen</a></p></section>' : ''}<p class="klein">Standbilder zeigen Geometrie und Material. Die Wirkung bei Bewegung lässt sich im synchronen Vergleich oben beurteilen. <a href="vorher-bericht.json">Bericht vorher</a> · <a href="nachher-bericht.json">Bericht nachher</a></p>
</main><script>
const vor=document.querySelector('#vorher'),nach=document.querySelector('#nachher'),filme=[vor,nach];
const start=document.querySelector('#start'),zeit=document.querySelector('#zeit'),anzeige=document.querySelector('#anzeige'),status=document.querySelector('#status');
let spielt=false,busy=false;
function pause(){spielt=false;filme.forEach(v=>v.pause());start.textContent='Beide abspielen'}
async function spiele(){if(busy)return;busy=true;try{await Promise.all(filme.map(v=>v.play()));spielt=true;start.textContent='Beide pausieren';status.textContent='Synchroner Vergleich läuft.'}catch(e){pause();status.textContent='Video konnte nicht starten: '+e.message}finally{busy=false}}
function suche(t){filme.forEach(v=>{v.currentTime=t});zeit.value=t;anzeige.textContent=t.toFixed(2).replace('.',',')+' s'}
start.addEventListener('click',()=>spielt?pause():spiele());
document.querySelector('#anfang').addEventListener('click',()=>{pause();suche(0)});
zeit.addEventListener('input',()=>{pause();suche(Number(zeit.value))});
document.querySelector('#tempo').addEventListener('change',e=>filme.forEach(v=>{v.playbackRate=Number(e.target.value)}));
vor.addEventListener('ended',()=>{const wieder=document.querySelector('#schleife').checked;pause();if(wieder){suche(0);spiele()}});
filme.forEach(v=>v.addEventListener('error',()=>{pause();status.textContent='Das Video konnte nicht geladen werden. Die Einzelvideos sind direkt verlinkt.'}));
function aktualisiere(){if(spielt){const t=vor.currentTime;zeit.value=t;anzeige.textContent=t.toFixed(2).replace('.',',')+' s';if(Math.abs(nach.currentTime-t)>0.075&&!nach.seeking)nach.currentTime=t}requestAnimationFrame(aktualisiere)}aktualisiere();
document.querySelectorAll('.regler input:not(#zeit)').forEach(r=>r.addEventListener('input',()=>r.closest('section').querySelector('.vergleich').style.setProperty('--anteil',r.value+'%')));
</script></body></html>`;
writeFileSync(join(ziel, 'vergleich.html'), html, { flag: 'wx' });
console.log(join(ziel, 'vergleich.html'));
