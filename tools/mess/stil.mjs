/**
 * Stilmass (D152): dieselben Zahlen fuer Referenzbilder und Spielbilder.
 *   stil.mjs "x,z,grad" name "&zeit=0.26&stimmung=goldnebel"   -> Bild nach .cache/bilder/<name>.png, dann messen
 *   stil.mjs bild1.png bild2.png ...                             -> nur messen
 * Mass wie bildtor/linear (linear, Ausschnitt 14-78 % Hoehe = ohne HUD) plus: Drittel-Leuchtdichte
 * (oben/mitte/unten), Saettigung oben/unten, Lichtfarbe (hellste 10 %), Schattenfarbe (2-12 %),
 * mittlere Farbe je Drittel, lokaler Kontrast (Median der Std-Abw. in 8x8-Kacheln) je Drittel,
 * Farbtonfamilien in 30-Grad-Faechern (saettigungsgewichtet, Prozent).
 */
import { playwright } from './pw.mjs';
const { chromium } = await playwright();
import { readFileSync } from 'node:fs';

const MESSEN = async ([d, voll]) => {
  const bild = new Image(); bild.src = 'data:image/png;base64,' + d; await bild.decode();
  const W = 480, H = Math.round(480 * bild.height / bild.width);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); ctx.drawImage(bild, 0, 0, W, H);
  const y0 = voll ? 0 : Math.round(H * 0.14), y1 = voll ? H : Math.round(H * 0.78);
  const HH = y1 - y0; const px = ctx.getImageData(0, y0, W, HH).data; const n = W * HH;
  const lin = new Float32Array(256);
  for (let v = 0; v < 256; v++) { const q = v / 255; lin[v] = q <= 0.04045 ? q / 12.92 : ((q + 0.055) / 1.055) ** 2.4; }
  const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const rows = new Array(n); const ys = new Float32Array(n);
  let dunkel = 0, hell = 0, satSum = 0, satN = 0; const hue = new Array(12).fill(0);
  for (let k = 0; k < n; k++) {
    const r = px[k * 4], g = px[k * 4 + 1], b = px[k * 4 + 2];
    const y = 0.2126 * lin[r] + 0.7152 * lin[g] + 0.0722 * lin[b];
    rows[k] = { y, r, g, b, k }; ys[k] = y; if (y < 0.02) dunkel++; if (y > 0.30) hell++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 25) { const s = (mx - mn) / mx; satSum += s; satN++;
      if (s > 0.12) { let h; if (mx === r) h = ((g - b) / (mx - mn)) % 6; else if (mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4; h = (h * 60 + 360) % 360; hue[Math.floor(h / 30)] += s; } }
  }
  const sortedY = Float32Array.from(ys).sort();
  const sorted = [...rows].sort((a, b) => a.y - b.y);
  const mittel = arr => { const s = arr.reduce((a, p) => [a[0] + p.r, a[1] + p.g, a[2] + p.b], [0, 0, 0]); return hex(s[0] / arr.length, s[1] / arr.length, s[2] / arr.length); };
  const sat = arr => { let s = 0; for (const p of arr) { const mx = Math.max(p.r, p.g, p.b), mn = Math.min(p.r, p.g, p.b); s += mx ? (mx - mn) / mx : 0; } return +(s / arr.length).toFixed(3); };
  const lum = arr => +(arr.reduce((a, p) => a + p.y, 0) / arr.length).toFixed(3);
  const band = t => rows.filter(p => Math.floor(Math.floor(p.k / W) * 3 / HH) === t);
  const ob = band(0), mi = band(1), un = band(2);
  const kontrast = t => { const ks = []; const a0 = Math.round(HH * t / 3), a1 = Math.round(HH * (t + 1) / 3);
    for (let y = a0; y + 8 <= a1; y += 8) for (let x = 0; x + 8 <= W; x += 8) { let s = 0, s2 = 0; for (let dy = 0; dy < 8; dy++) for (let dx = 0; dx < 8; dx++) { const v = rows[(y + dy) * W + x + dx].y; s += v; s2 += v * v; } const m = s / 64; ks.push(Math.sqrt(Math.max(0, s2 / 64 - m * m))); }
    ks.sort((a, b) => a - b); return +ks[ks.length >> 1].toFixed(4); };
  const hs = hue.reduce((a, b) => a + b, 0) || 1;
  return { median: +sortedY[n >> 1].toFixed(3), p10: +sortedY[Math.floor(n * 0.1)].toFixed(3), p90: +sortedY[Math.floor(n * 0.9)].toFixed(3),
    dunkel: +(dunkel / n * 100).toFixed(1), hell: +(hell / n * 100).toFixed(1), sat: +(satSum / Math.max(1, satN)).toFixed(3),
    drittel: [lum(ob), lum(mi), lum(un)], satOben: sat(ob), satUnten: sat(un),
    licht: mittel(sorted.slice(Math.floor(n * 0.9))), schatten: mittel(sorted.slice(Math.floor(n * 0.02), Math.floor(n * 0.12))),
    oben: mittel(ob), mitte: mittel(mi), unten: mittel(un), k: [kontrast(0), kontrast(1), kontrast(2)],
    hue: hue.map(v => Math.round(v / hs * 100)) };
};

const VOLL = process.argv.includes('--voll');
const GPU = process.argv.includes('--gpu');
const BREIT = process.argv.includes('--format=16:9');
const args = process.argv.slice(2).filter(a => a !== '--voll' && a !== '--gpu' && a !== '--format=16:9');
// --gpu: echte GPU (Metal) statt SwiftShader — bei 1,5 M Dreiecken (Bauwerke) sonst 1 B/s und kein fertiges Bild
const b = await chromium.launch(GPU ? { args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] } : {});
const p = await b.newPage({ viewport: BREIT ? { width: 960, height: 540 } : { width: 900, height: 620 } });
let dateien = args;
if (!args[0].endsWith('.png')) {
  const [ort, name, extra] = [args[0], args[1], args[2] ?? ''];
  await p.goto(`http://127.0.0.1:4173/?absetzen=${ort}${extra}`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('button[aria-label="Menü"]', { timeout: 240000 });
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) { if ((await p.textContent('body')).includes('Ladezeit')) break; await p.waitForTimeout(500); }
  // Bauwerke (GLB, 20 MB) laden nach dem Gelaende: warten, bis die Dreieckszahl im HUD 4 s lang steht
  let letzte = '', seit = Date.now(); const t1 = Date.now();
  while (Date.now() - t1 < 45000) {
    const m = /([\d.]+)\s*Dreiecke/.exec(await p.textContent('body')); const jetzt = m ? m[1] : '';
    if (jetzt !== letzte) { letzte = jetzt; seit = Date.now(); }
    else if (Date.now() - seit > 4000) break;
    await p.waitForTimeout(500);
  }
  await p.waitForTimeout(1500);
  const pfad = `.cache/bilder/${name}.png`;
  await p.screenshot({ path: pfad });
  dateien = [pfad];
}
const q = await b.newPage();
for (const datei of dateien) {
  const w = await q.evaluate(MESSEN, [readFileSync(datei).toString('base64'), VOLL]);
  const kurz = datei.split('/').pop().padEnd(22);
  console.log(`${kurz} Median ${w.median.toFixed(3)} p10 ${w.p10.toFixed(3)} p90 ${w.p90.toFixed(3)} dunkel ${String(w.dunkel).padStart(4)} % hell ${String(w.hell).padStart(4)} % sat ${w.sat.toFixed(2)} | Drittel ${w.drittel.join('/')} satO/U ${w.satOben}/${w.satUnten} | Licht ${w.licht} Schatten ${w.schatten} oben ${w.oben} unten ${w.unten} | k ${w.k.join('/')} | hue ${w.hue.join(' ')}`);
}
await b.close();
