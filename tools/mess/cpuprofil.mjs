/** CPU-Profil desselben spielbaren Laufs wie vergleich.mjs, ohne Video.
 * node tools/mess/cpuprofil.mjs <neuer-name> [url-zusatz] [port] [build-verzeichnis]
 * Fuer Zuordnung: Vite-Produktionsbuild mit Sourcemaps und passenden Preview-Port starten.
 * CPU-Profiling kostet selbst Zeit; Bildraten separat mit vergleich.mjs messen.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { playwright } from './pw.mjs';

const [name, extra = '', port = '4174', build = '.cache/cpuprofil-build'] = process.argv.slice(2);
if (!name || !/^[a-z0-9_-]+$/i.test(name)) throw new Error('Neuen einfachen Namen angeben.');
if (!/^\d+$/.test(port)) throw new Error('Numerischen lokalen Preview-Port angeben.');
const ziel = `.cache/mess/${name}`;
if (existsSync(ziel)) throw new Error(`Ausgabe existiert bereits: ${ziel}`);
mkdirSync(ziel, { recursive: true });
const { chromium } = await playwright();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const seite = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
const fehler = [], anfragen = [];
let messen = false;
await seite.addInitScript(() => {
  const messung = { aufrufe: {}, tasten: [] };
  window.__cpuAudio = messung;
  const protokoll = (name, dauer, beginn) => {
    const e = messung.aufrufe[name] ?? { anzahl: 0, ms: 0, maximumMs: 0, ersterBeginnMs: beginn };
    e.anzahl++; e.ms += dauer; e.maximumMs = Math.max(e.maximumMs, dauer); messung.aufrufe[name] = e;
  };
  const basis = window.BaseAudioContext?.prototype;
  for (const name of ['createGain', 'createBuffer', 'createBufferSource', 'createBiquadFilter', 'createOscillator']) {
    const f = basis?.[name]; if (typeof f !== 'function') continue;
    basis[name] = function (...args) { const t = performance.now(); try { return f.apply(this, args); } finally { protokoll(name, performance.now() - t, t); } };
  }
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const klasse = window[name]; if (typeof klasse !== 'function') continue;
    window[name] = new Proxy(klasse, { construct(ziel, argumente, neu) {
      const t = performance.now(); try { return Reflect.construct(ziel, argumente, neu === window[name] ? ziel : neu); }
      finally { protokoll(name, performance.now() - t, t); }
    } });
  }
  window.addEventListener('keydown', e => { messung.tasten.push({ code: e.code, zeitMs: performance.now() }); }, { capture: true });
});
seite.on('pageerror', e => fehler.push(String(e)));
seite.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
seite.on('request', r => { if (messen && r.url().endsWith('.glb')) anfragen.push({ zeit: Date.now(), url: r.url() }); });
try {
  await seite.goto(`http://127.0.0.1:${port}/?absetzen=0,0,310&zeit=0.26&kontur=0${extra}`, { waitUntil: 'domcontentloaded' });
  await seite.waitForSelector('button[aria-label="Menü"]', { timeout: 240000 });
  await seite.waitForFunction(() => document.body.textContent.includes('Ladezeit'), undefined, { timeout: 120000 });
  await seite.waitForTimeout(15000);
  const cdp = await seite.context().newCDPSession(seite);
  await cdp.send('Performance.enable');
  await seite.evaluate(() => {
    window.__cpuBildlauf = { aktiv: true, zeitpunkte: [] };
    const schritt = t => { if (!window.__cpuBildlauf.aktiv) return; window.__cpuBildlauf.zeitpunkte.push(t); requestAnimationFrame(schritt); };
    requestAnimationFrame(schritt);
  });
  const seitenZeit = await seite.evaluate(() => performance.now());
  const metriken = await cdp.send('Performance.getMetrics');
  const zeitstempel = metriken.metrics.find(m => m.name === 'Timestamp')?.value;
  if (zeitstempel === undefined) throw new Error('CDP-Zeitbasis fehlt.');
  // Beide Aufrufe sind getrennt; die Zuordnung ist auf einige Millisekunden genau.
  const zeitVersatz = zeitstempel * 1000 - seitenZeit;
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await cdp.send('Profiler.start');
  messen = true;
  await seite.keyboard.down('Shift'); await seite.keyboard.down('w');
  await seite.waitForTimeout(12000);
  await seite.keyboard.up('w'); await seite.keyboard.up('Shift');
  messen = false;
  const { profile } = await cdp.send('Profiler.stop');
  const bildzeitpunkte = await seite.evaluate(() => { window.__cpuBildlauf.aktiv = false; return window.__cpuBildlauf.zeitpunkte; });
  const audio = await seite.evaluate(() => window.__cpuAudio);
  const hud = await seite.textContent('body');
  const maps = new Map();
  const abbilden = f => {
    const url = f.url;
    if (!url.startsWith(`http://127.0.0.1:${port}/`)) return { quelle: url || '(native)', name: f.functionName || '(anonym)', zeile: f.lineNumber + 1 };
    const lokal = path.join(build, new URL(url).pathname.slice(1) + '.map');
    if (!maps.has(lokal)) maps.set(lokal, existsSync(lokal) ? new TraceMap(JSON.parse(readFileSync(lokal, 'utf8'))) : null);
    const map = maps.get(lokal);
    const o = map && originalPositionFor(map, { line: f.lineNumber + 1, column: f.columnNumber });
    return { quelle: o?.source ?? url, name: o?.name ?? f.functionName ?? '(anonym)', zeile: o?.line ?? f.lineNumber + 1 };
  };
  const knoten = new Map(profile.nodes.map(n => [n.id, n]));
  const eltern = new Map();
  for (const n of profile.nodes) for (const kind of n.children ?? []) eltern.set(kind, n.id);
  const summen = new Map(), abtastungen = [];
  let profilZeit = profile.startTime / 1000;
  for (let i = 0; i < (profile.samples?.length ?? 0); i++) {
    const dauer = (profile.timeDeltas?.[i] ?? 0) / 1000;
    profilZeit += dauer;
    let id = profile.samples[i], selbst = true;
    const funktionsKnoten = knoten.get(id);
    if (funktionsKnoten) abtastungen.push({ zeit: profilZeit, dauer, f: abbilden(funktionsKnoten.callFrame) });
    const besuchte = new Set();
    while (id !== undefined) {
      const n = knoten.get(id); if (!n) break;
      const f = abbilden(n.callFrame), key = `${f.quelle}:${f.zeile}:${f.name}`;
      if (!besuchte.has(key)) {
        const z = summen.get(key) ?? { ...f, selbstMs: 0, inklusiveMs: 0 };
        z.inklusiveMs += dauer; if (selbst) z.selbstMs += dauer;
        summen.set(key, z); besuchte.add(key);
      }
      selbst = false; id = eltern.get(id);
    }
  }
  const rang = [...summen.values()].map(x => ({ ...x, selbstMs: +x.selbstMs.toFixed(1), inklusiveMs: +x.inklusiveMs.toFixed(1) }));
  const langeBilder = [];
  for (let i = 1; i < bildzeitpunkte.length; i++) {
    const anfang = bildzeitpunkte[i - 1] + zeitVersatz, ende = bildzeitpunkte[i] + zeitVersatz;
    if (ende - anfang < 100) continue;
    const anteile = new Map();
    for (const a of abtastungen) {
      const ueberlapp = Math.max(0, Math.min(ende, a.zeit) - Math.max(anfang, a.zeit - a.dauer));
      if (!ueberlapp) continue;
      const key = `${a.f.quelle}:${a.f.zeile}:${a.f.name}`;
      anteile.set(key, (anteile.get(key) ?? 0) + ueberlapp);
    }
    langeBilder.push({ abMs: +(bildzeitpunkte[i - 1] - bildzeitpunkte[0]).toFixed(1), dauerMs: +(ende - anfang).toFixed(1),
      top: [...anteile].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([funktion, ms]) => ({ funktion, ms: +ms.toFixed(1) })) });
  }
  const bericht = { extra, port, build, dauerMs: (profile.endTime - profile.startTime) / 1000,
    samples: profile.samples?.length ?? 0, topSelbst: [...rang].sort((a, b) => b.selbstMs - a.selbstMs).slice(0, 60),
    topInklusive: [...rang].sort((a, b) => b.inklusiveMs - a.inklusiveMs).slice(0, 60), langeBilder, audio, hud, anfragen, fehler,
    hinweis: 'Sampling-Hauptthread, weder GPU-Zeit noch kausaler Beweis fuer Bildausreisser; Profiler erzeugt Eigenlast.' };
  writeFileSync(`${ziel}/profil.cpuprofile`, JSON.stringify(profile));
  writeFileSync(`${ziel}/bericht.json`, JSON.stringify(bericht, null, 2));
  console.log(JSON.stringify({ ziel, samples: bericht.samples, dauerMs: bericht.dauerMs, topSelbst: bericht.topSelbst.slice(0, 15), fehler }, null, 2));
  if (fehler.length || bericht.samples < 10) process.exitCode = 1;
} finally {
  await seite.keyboard.up('w').catch(() => {}); await seite.keyboard.up('Shift').catch(() => {});
  await browser.close();
}
