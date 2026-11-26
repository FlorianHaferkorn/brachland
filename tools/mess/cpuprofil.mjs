/** CPU-Profil desselben spielbaren Laufs wie vergleich.mjs, ohne Video.
 * node tools/mess/cpuprofil.mjs <neuer-name> [url-zusatz] [port] [build-verzeichnis] [x,z,grad|hofwest|ort:kennung] [ausreisser-ms]
 * MESS_GANG=1 misst denselben zehnsekündigen W-Gang wie bildrate.mjs, ohne zusätzliche Lookparameter.
 * MESS_FORMAT=1440x900 überschreibt die Auflösung (Vorgabe 960x540).
 * Fuer Zuordnung: Vite-Produktionsbuild mit Sourcemaps und passenden Preview-Port starten.
 * CPU-Profiling kostet selbst Zeit; Bildraten separat mit vergleich.mjs messen.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { playwright } from './pw.mjs';
import { messroute, bereiteHofwestroute, laufeHofwestroute } from './hofwestroute.mjs';

const [name, extra = '', port = '4174', build = '.cache/cpuprofil-build', strecke = '0,0,310', schwellenText = '100'] = process.argv.slice(2);
const weg = messroute(strecke);
const gang = !weg && process.env.MESS_GANG === '1';
const [width, height] = (process.env.MESS_FORMAT ?? '960x540').split('x').map(Number);
const ort = weg?.start ?? strecke;
const ausreisserMs = Number(schwellenText);
if (!name || !/^[a-z0-9_-]+$/i.test(name)) throw new Error('Neuen einfachen Namen angeben.');
if (!/^\d+$/.test(port)) throw new Error('Numerischen lokalen Preview-Port angeben.');
if (!/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(ort)) throw new Error('Ort als x,z,grad angeben.');
if (!Number.isFinite(ausreisserMs) || ausreisserMs < 16) throw new Error('Ausreisserschwelle ab 16 ms angeben.');
const gruenVerzug = process.env.MESS_GRUEN_VERZUG_MS ? Number(process.env.MESS_GRUEN_VERZUG_MS) : null;
if (gruenVerzug !== null && (strecke !== 'ort:milbinger' || !Number.isFinite(gruenVerzug) || gruenVerzug < 0)) {
  throw new Error('Für den Grünverzug sind ort:milbinger und eine nichtnegative Zeit in ms erforderlich.');
}
const ziel = `.cache/mess/${name}`;
if (existsSync(ziel)) throw new Error(`Ausgabe existiert bereits: ${ziel}`);
mkdirSync(ziel, { recursive: true });
const { chromium } = await playwright();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const seite = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1,
  ...(gruenVerzug !== null ? { serviceWorkers: 'block' } : {}) });
const fehler = [], anfragen = [];
// Den Fristfall unabhängig von Dateicache und Netz wiederholen. Die normale Messung
// behält alle Browserstandards. Die Verzögerung beginnt erst mit dem Ortsvorlauf.
let gruenFreigegebenMs = null;
if (gruenVerzug !== null) {
  await seite.route('**/stauwehr-gruen.glb', async route => {
    try {
      const antwort = await route.fetch();
      await seite.waitForFunction(() => performance.getEntriesByName('ortsvorlauf-milbinger-beginn').length > 0,
        null, { timeout: 60000 });
      await seite.waitForTimeout(gruenVerzug);
      gruenFreigegebenMs = await seite.evaluate(() => performance.now());
      await route.fulfill({ response: antwort });
    } catch (e) {
      fehler.push(String(e));
      await route.abort().catch(() => {});
    }
  });
}
let messen = false;
await seite.addInitScript(() => {
  const messung = { aufrufe: {}, tasten: [] };
  window.__cpuAudio = messung;
  window.__cpuUploads = [];
  window.__cpuProgramm = [];
  const webgl = WebGL2RenderingContext.prototype;
  for (const name of ['compileShader', 'linkProgram', 'getProgramParameter', 'getProgramInfoLog', 'getUniformLocation', 'texSubImage2D']) {
    const original = webgl[name];
    webgl[name] = function (...args) {
      if (!window.__cpuBildlauf?.aktiv) return original.apply(this, args);
      const beginnMs = performance.now();
      try { return original.apply(this, args); }
      finally {
        const dauerMs = performance.now() - beginnMs;
        if (dauerMs >= 2) {
          const programm = name === 'getProgramInfoLog'
            ? window.__cpuRenderer?.info.programs?.find(p => p.program === args[0])
            : undefined;
          const objekt = name === 'getProgramInfoLog' ? window.__cpuZeichnen : undefined;
          window.__cpuProgramm.push({ name, beginnMs, dauerMs,
            material: programm?.name, schluessel: programm?.cacheKey,
            objekt: objekt && { name: objekt.name, typ: objekt.type, instanzen: objekt.count,
              instanzfarbe: !!objekt.instanceColor, eltern: objekt.parent?.name } });
        }
      }
    };
  }
  for (const name of ['bufferData', 'bufferSubData']) {
    const original = webgl[name];
    webgl[name] = function (...args) {
      if (!window.__cpuBildlauf?.aktiv) return original.apply(this, args);
      const quelle = args[name === 'bufferData' ? 1 : 2];
      const offset = args[3] ?? 0;
      const anzahl = args[4] || (quelle?.length ?? 0) - offset;
      const byte = anzahl * (quelle?.BYTES_PER_ELEMENT ?? 0) || quelle?.byteLength || (typeof quelle === 'number' ? quelle : 0);
      if (byte < 256 * 1024) return original.apply(this, args);
      const beginn = performance.now();
      const ergebnis = original.apply(this, args);
      window.__cpuUploads.push({ beginnMs: beginn, name, byte, quelle, cpuMs: performance.now() - beginn });
      return ergebnis;
    };
  }
  window.__cpuLangzeit = [];
  if (PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
    const beobachter = new PerformanceObserver(liste => {
      for (const eintrag of liste.getEntries()) if (window.__cpuBildlauf?.aktiv) {
        window.__cpuLangzeit.push({ startMs: eintrag.startTime, dauerMs: eintrag.duration, blockiertMs: eintrag.blockingDuration,
          skripte: eintrag.scripts.map(s => ({ name: s.sourceFunctionName, dauerMs: s.duration, position: s.sourceCharPosition, quelle: s.sourceURL })) });
      }
    });
    beobachter.observe({ type: 'long-animation-frame' });
  }
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
  await seite.goto(`http://127.0.0.1:${port}/?absetzen=${ort}${gang ? '' : '&zeit=0.26&kontur=0'}${extra}`, { waitUntil: 'domcontentloaded' });
  await seite.waitForSelector('button[aria-label="Menü"]', { timeout: 240000 });
  await seite.waitForFunction(() => document.body.textContent.includes('Ladezeit'), undefined, { timeout: 120000 });
  await seite.waitForTimeout(15000);
  if (weg) await bereiteHofwestroute(seite, weg);
  await seite.evaluate(() => {
    const szene = window.__szene;
    if (!szene) return;
    const vorher = szene.onBeforeRender;
    szene.onBeforeRender = function (renderer, ...argumente) {
      if (!window.__cpuRenderer) {
        window.__cpuRenderer = renderer;
        const zeichne = renderer.renderBufferDirect;
        renderer.renderBufferDirect = function (kamera, welt, geometrie, material, objekt, gruppe) {
          const davor = window.__cpuZeichnen;
          window.__cpuZeichnen = objekt;
          try { return zeichne.call(this, kamera, welt, geometrie, material, objekt, gruppe); }
          finally { window.__cpuZeichnen = davor; }
        };
      }
      vorher.call(this, renderer, ...argumente);
    };
  });
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
  if (weg) await seite.waitForTimeout(750);
  messen = true;
  let route;
  if (weg) {
    route = await laufeHofwestroute(seite);
    if (route.fehler) fehler.push(route.fehler);
  } else {
    if (!gang) await seite.keyboard.down('Shift');
    await seite.keyboard.down('w');
    await seite.waitForTimeout(gang ? 10000 : 12000);
    await seite.keyboard.up('w');
    if (!gang) await seite.keyboard.up('Shift');
  }
  messen = false;
  const { profile } = await cdp.send('Profiler.stop');
  const { zeitpunkte, ursprung, audio, uploads, programme, langzeit, vorlauf } = await seite.evaluate(() => {
    window.__cpuBildlauf.aktiv = false;
    // Erst nach dem Lauf die gemessenen Arrays ihren Geometrien zuordnen. Auch
    // Instanz- und verschachtelte Attribute können denselben GPU-Puffer verwenden.
    const eigentuemer = new WeakMap();
    window.__szene?.traverse(objekt => {
      const g = objekt.geometry;
      if (!g) return;
      let gruppe = objekt;
      while (gruppe.parent && !gruppe.name) gruppe = gruppe.parent;
      for (const [attribut, wert] of Object.entries({ ...g.attributes, index: g.index,
        instanceMatrix: objekt.instanceMatrix, instanceColor: objekt.instanceColor })) {
        const array = wert?.array ?? wert?.data?.array;
        if (array && !eigentuemer.has(array)) eigentuemer.set(array, { objekt: gruppe.name, attribut });
      }
    });
    const uploads = window.__cpuUploads.map(({ quelle, ...messung }) => ({
      ...messung, ...eigentuemer.get(quelle),
    }));
    return { zeitpunkte: window.__cpuBildlauf.zeitpunkte, ursprung: performance.timeOrigin,
      vorlauf: performance.getEntriesByType('mark').filter(e => e.name.startsWith('ortsvorlauf-')).map(e => ({ name: e.name, ms: e.startTime })),
      audio: window.__cpuAudio, uploads, programme: window.__cpuProgramm, langzeit: window.__cpuLangzeit };
  });
  const bildzeitpunkte = route ? route.bilder.map(([zeit]) => zeit - ursprung) : zeitpunkte;
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
    if (ende - anfang < ausreisserMs || bildzeitpunkte[i] - bildzeitpunkte[0] < 250) continue;
    const anteile = new Map();
    for (const a of abtastungen) {
      const ueberlapp = Math.max(0, Math.min(ende, a.zeit) - Math.max(anfang, a.zeit - a.dauer));
      if (!ueberlapp) continue;
      const key = `${a.f.quelle}:${a.f.zeile}:${a.f.name}`;
      anteile.set(key, (anteile.get(key) ?? 0) + ueberlapp);
    }
    langeBilder.push({ abMs: +(bildzeitpunkte[i - 1] - bildzeitpunkte[0]).toFixed(1), dauerMs: +(ende - anfang).toFixed(1),
      ort: route?.bilder[i].slice(1),
      hauptthread: langzeit.filter(e => e.startMs + zeitVersatz < ende && e.startMs + e.dauerMs + zeitVersatz > anfang),
      uploads: uploads.filter(u => u.beginnMs + zeitVersatz >= anfang && u.beginnMs + zeitVersatz < ende),
      programme: programme.filter(u => u.beginnMs + zeitVersatz < ende && u.beginnMs + u.dauerMs + zeitVersatz > anfang),
      top: [...anteile].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([funktion, ms]) => ({ funktion, ms: +ms.toFixed(1) })) });
  }
  const bericht = { gruenVerzug, gruenFreigegebenMs, ort, extra, port, build, ausreisserMs, dauerMs: (profile.endTime - profile.startTime) / 1000,
    samples: profile.samples?.length ?? 0, topSelbst: [...rang].sort((a, b) => b.selbstMs - a.selbstMs).slice(0, 60),
    topInklusive: [...rang].sort((a, b) => b.inklusiveMs - a.inklusiveMs).slice(0, 60), langeBilder, audio, uploads, programme, vorlauf, route, hud, anfragen, fehler,
    hinweis: 'Sampling-Hauptthread, weder GPU-Zeit noch kausaler Beweis fuer Bildausreisser; Profiler erzeugt Eigenlast.' };
  writeFileSync(`${ziel}/profil.cpuprofile`, JSON.stringify(profile));
  writeFileSync(`${ziel}/bericht.json`, JSON.stringify(bericht, null, 2));
  console.log(JSON.stringify({ ziel, samples: bericht.samples, dauerMs: bericht.dauerMs, topSelbst: bericht.topSelbst.slice(0, 15), fehler }, null, 2));
  if (fehler.length || bericht.samples < 10) process.exitCode = 1;
} finally {
  await seite.keyboard.up('w').catch(() => {}); await seite.keyboard.up('Shift').catch(() => {});
  await browser.close();
}
