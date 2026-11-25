/** D298: eigenständig lesbare A/B-Galerie und Vergleichstafel aus abgeschlossenen Messläufen.
 * node tools/mess/hofgalerie.mjs <neuer-ordnername> [konfiguration.json]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const name = process.argv[2];
if (!name || !/^[a-z0-9_-]+$/i.test(name)) throw Error('Neuen Ordnernamen angeben.');
const ziel = `.cache/bilder/${name}`;
if (existsSync(ziel)) throw Error(`Ausgabe existiert: ${ziel}`);
const konfig = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : {};
const esc = t => String(t).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const titel = konfig.titel ?? 'BRACHLAND – Scan-Hof';
const probeTitel = konfig.probeTitel ?? 'Scanprobe';
const paare = konfig.paare ?? [
  { titel: 'Hof · gleiches Prüflicht', vor: '.cache/mess/d298-ende-1/start.png', nach: '.cache/mess/d298-ende-2/start.png' },
  { titel: 'Straße · ursprüngliches Szenenlicht', vor: '.cache/bilder/d298-strasse-final-0.png', nach: '.cache/bilder/d298-strasse-ende-1.png' },
];
const messungen = konfig.messungen ?? [1,2,3,4].map(i => `.cache/mess/d298-ende-${i}/bericht.json`);
const kosten = messungen.map(f => JSON.parse(readFileSync(f, 'utf8')));
if (kosten.length !== 4 || !paare.length) throw Error('Vier Kostenberichte und mindestens ein Bildpaar angeben.');
const spanne = a => `${Math.min(...a).toFixed(1)}–${Math.max(...a).toFixed(1)}`;
const fpsAlt = spanne([kosten[0].fps, kosten[3].fps]), fpsNeu = spanne([kosten[1].fps, kosten[2].fps]);
const hinweis = konfig.hinweis ?? `Gleiche Kamera und Lichtwerte je Bildpaar; Wind und Figuren nicht eingefroren. Vier isolierte 12-s-Läufe: bisher ${fpsAlt} FPS, Probe ${fpsNeu} FPS. Schwankende Systemlast; kein belastbarer FPS-Vorteil und kein AAA-Urteil.`;
const daten = paare.map(p => ({ ...p, vor: `data:image/png;base64,${readFileSync(p.vor).toString('base64')}`, nach: `data:image/png;base64,${readFileSync(p.nach).toString('base64')}` }));
const svg = (text, width, height, size = 24) => Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#151b20"/><text x="18" y="${height * 0.67}" fill="#edf0ee" font-family="Arial,sans-serif" font-size="${size}">${esc(text)}</text></svg>`);
const lagen = [{ input: svg(`${titel} – bisher / ${probeTitel}`, 1920, 52, 28), top: 0, left: 0 }];
for (let i = 0; i < paare.length; i++) {
  const y = 52 + i * 582;
  lagen.push({ input: svg(`${paare[i].titel} – BISHER`, 960, 36, 20), top: y, left: 0 },
    { input: svg(`${probeTitel.toUpperCase()} – gleiche Kamera und Lichtwerte`, 960, 36, 20), top: y, left: 960 },
    { input: readFileSync(paare[i].vor), top: y + 36, left: 0 },
    { input: readFileSync(paare[i].nach), top: y + 36, left: 960 });
}
lagen.push({ input: svg(`12-s-Läufe: bisher ${fpsAlt} FPS / Probe ${fpsNeu} FPS. Wind und Figuren variieren. Schwankende Systemlast; kein belastbarer FPS-Vorteil und kein AAA-Urteil.`, 1920, 44, 21), top: 52 + paare.length * 582, left: 0 });
const png = await sharp({ create: { width: 1920, height: 96 + paare.length * 582, channels: 3, background: '#151b20' } }).composite(lagen).png().toBuffer();
const videoPfad = konfig.videoPfad ?? '.cache/mess/d298-hof-bewegung';
const videoName = readdirSync(videoPfad).find(f => f.endsWith('.webm'));
if (!videoName) throw Error('Hof-Bewegungsvideo fehlt.');
const video = `data:video/webm;base64,${readFileSync(`${videoPfad}/${videoName}`).toString('base64')}`;
const spielUrl = konfig.spielUrl ?? 'http://127.0.0.1:4173/?absetzen=1444,419,150&zeit=0.26&stimmung=zielbild&scanhof=1&umgebung=6&sonne=0.8&umlichtstaerke=1.2&schatten=0.4';
const beschreibung = konfig.beschreibung ?? 'Originale Scanfarben für Holz, Putz, Dach, Kies und Pflanzen. Die vereinfachten Bäume und Gebäudeformen begrenzen weiterhin das Gesamtbild.';
const html = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(titel)}</title><style>
body{margin:0;background:#151b20;color:#edf0ee;font:16px system-ui;line-height:1.5}main{max-width:1500px;margin:auto;padding:24px}h1{font-size:28px}p{max-width:1000px;color:#bbc6c8}button,a{color:#edf0ee;background:#2a353b;border:1px solid #657c72;padding:10px 16px;border-radius:6px;margin:4px;cursor:pointer}button.aktiv{background:#3b5e49}.paar{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}img{width:100%;display:block}figcaption{padding:8px 0}.reglerbild{position:relative;aspect-ratio:16/9;overflow:hidden}.reglerbild img{position:absolute;inset:0}.reglerbild #vor{clip-path:inset(0 50% 0 0)}input{width:100%;margin:18px 0}@media(max-width:800px){.paar{grid-template-columns:1fr}}
</style><main><h1>${esc(titel)}</h1><p>${esc(hinweis)}</p><p>${esc(beschreibung)}</p><nav id="wahl"></nav><h2 id="titel"></h2><div class="paar"><figure><figcaption>Bisher</figcaption><img id="alt" alt="Bisheriger Stand"></figure><figure><figcaption>${esc(probeTitel)}</figcaption><img id="neu" alt="Scanprobe"></figure></div><h2>Direkt vergleichen</h2><p>Regler bewegen: links bisher, rechts ${esc(probeTitel)}.</p><div class="reglerbild"><img id="nach" alt="Scanprobe"><img id="vor" alt="Bisheriger Stand"></div><input id="regler" type="range" min="0" max="100" value="50" aria-label="Anteil des bisherigen Bildes"><h2>Bewegung am Hof</h2><p>12 Sekunden Lauf mit Kameraschwenk. Die Videoaufnahme beeinflusst die Bildzeiten; die Zeitmessung erfolgte separat.</p><video controls playsinline preload="metadata" style="width:100%" src="${video}"></video><p><a href="${esc(spielUrl)}" target="_blank" rel="noopener">Spielbare Probe öffnen</a></p></main><script>const daten=${JSON.stringify(daten)};function waehle(i){const p=daten[i];document.getElementById('titel').textContent=p.titel;for(const k of ['alt','vor'])document.getElementById(k).src=p.vor;for(const k of ['neu','nach'])document.getElementById(k).src=p.nach;document.querySelectorAll('button').forEach((b,j)=>b.classList.toggle('aktiv',i===j))}daten.forEach((p,i)=>{const b=document.createElement('button');b.textContent=p.titel;b.onclick=()=>waehle(i);document.getElementById('wahl').append(b)});document.getElementById('regler').oninput=e=>document.getElementById('vor').style.clipPath='inset(0 '+(100-e.target.value)+'% 0 0)';waehle(0);const v=document.querySelector('video');const startVideo=()=>{if(Number.isFinite(v.duration))v.currentTime=Math.max(0,v.duration-12.7)};v.addEventListener('loadedmetadata',startVideo,{once:true});if(v.readyState>0)startVideo();</script></html>`;
mkdirSync(ziel, { recursive: true });
writeFileSync(`${ziel}/vergleich.png`, png);
writeFileSync(`${ziel}/vergleich.html`, html);
console.log(`${ziel}/vergleich.html`, `${ziel}/vergleich.png`);
