// D486: Der reale M1 führt den vollständigen Lauf nach der Testsuite seriell aus.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join } from 'node:path';
import { preview } from 'vite';
import { playwright } from './pw.mjs';
import { hofBefund } from './hofwertung.mjs';
import { messroute } from './hofwestroute.mjs';

if (process.argv.includes('--referenzgeraet') && !(process.platform === 'darwin' && cpus()[0]?.model === 'Apple M1')) {
  console.log('Hof-Bildzeiten werden auf dem Referenzgerät Apple M1 geprüft.');
  process.exit(0);
}

const name = 'hoftest-' + Date.now();
const ausgabe = '.cache/mess/' + name;
mkdirSync(ausgabe, { recursive: true });
async function messe(argumente) {
  await new Promise((ok, fehler) => {
    const kind = spawn(process.execPath, argumente, { stdio: 'inherit' });
    kind.once('error', fehler);
    kind.once('close', code => code === 0 ? ok() : fehler(new Error(argumente[0] + ' fehlgeschlagen: ' + code)));
  });
}
const laeufe = [];
const soll = JSON.parse(readFileSync(new URL('./hofdetails.json', import.meta.url)));
const bau = mkdtempSync(join(tmpdir(), 'brachland-hoftest-'));
let server;
try {
  // Der eigene Port schließt überlappende GPU-Läufe aus. Die normale Spielvorschau
  // verwendet weiterhin ihren eigenen Build; die Testdateien gehören nur diesem Lauf.
  server = await preview({ build: { outDir: bau }, preview: { host: '127.0.0.1', port: 4269, strictPort: true, open: false } });
  const port = String(server.httpServer.address().port);
  const adresse = 'http://127.0.0.1:' + port;
  execFileSync('npm', ['run', 'build', '--', '--outDir', bau], { stdio: 'inherit' });
  const { chromium } = await playwright();
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
  try {
    for (const { ort, gruppen } of soll) {
      const seite = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
      await seite.goto(adresse + '/?ziel=milbinger&zeit=0.26&absetzen=' + ort);
      await seite.waitForFunction(() => document.body.textContent.includes('Ladezeit'), null, { timeout: 150000 });
      await seite.waitForTimeout(3000);
      const ist = await seite.evaluate(async () => {
        const gruppen = [];
        window.__szene.traverse(o => {
          const art = o.material?.map?.image?.src?.match(/\/(streu|bodenflach|bodenbusch)-karten-farbe\.webp/)?.[1];
          if (!art || !o.isInstancedMesh || !o.visible || !o.count) return;
          const bytes = o.instanceMatrix.array.slice(0, o.count * 16);
          gruppen.push({ art, uv: Array.from(o.geometry.attributes.uv.array.slice(0, 4)), anzahl: o.count, bytes });
        });
        return Promise.all(gruppen.map(async ({ bytes, ...gruppe }) => {
          const digest = await crypto.subtle.digest('SHA-256', bytes);
          return { ...gruppe, hash: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('') };
        }));
      });
      await seite.screenshot({ path: ausgabe + '/detail-' + ort + '.png' });
      assert.deepEqual(ist.sort((a, b) => a.hash.localeCompare(b.hash)), gruppen, 'Streukarten abweichend bei ' + ort);
      await seite.close();
    }
  } finally { await browser.close(); }
  for (let i = 1; i <= 2; i++) {
    const lauf = name + '-' + i;
    await messe(['tools/mess/vergleich.mjs', lauf, '&ziel=milbinger', 'hofwest', port]);
    const d = JSON.parse(readFileSync('.cache/mess/' + lauf + '/bericht.json'));
    assert.deepEqual(d.fehler, []);
    assert.deepEqual(d.route.wegpunkte.map(p => p.nr), messroute('hofwest').punkte.slice(1).map((_, n) => n + 1));
    assert.ok(d.route.fertig && d.route.westMs && d.abschnitte.weststrasse.bilder > 0);
    const spitzen = d.route.bilder.slice(1).flatMap(([t, x, z], i) => {
      const ms = t - d.route.bilder[i][0];
      return ms > 50 ? [{ ms, x, z, abschnitt: t <= d.route.westMs ? 'Hof' : 'Weststraße' }] : [];
    });
    laeufe.push({ lauf, fps: d.fps, p95: d.p95Ms, max: d.maxMs, spitzen });
  }
  const befund = hofBefund(laeufe);
  if (laeufe.some(l => l.spitzen.length)) {
    await messe(['tools/mess/cpuprofil.mjs', name + '-profil', '&ziel=milbinger', port, bau, 'hofwest', '50']);
    const profil = JSON.parse(readFileSync('.cache/mess/' + name + '-profil/bericht.json'));
    const spaet = profil.programme.filter(e => e.name === 'texSubImage2D'
      && /\/(?:stumpf-2|rinde-fichte)-(?:farbe|normal)\.webp$/.test(e.bild ?? ''));
    if (spaet.length) befund.push('Verspätete Holztextur-Uploads ab 2 ms: ' + spaet.map(e => e.bild).join(', '));
  }
  console.table(laeufe.map(({ spitzen, ...rest }) => ({ ...rest, ueber50ms: spitzen.length })));
  console.log('Messbericht:', ausgabe, befund);
  writeFileSync(ausgabe + '/ergebnis.json', JSON.stringify({ laeufe, befund }, null, 2));
  assert.equal(befund.length, 0, befund.join(', '));
  // Der synchrone Pixelabruf gehört ausserhalb der beiden Bildzeitmessungen.
  await messe(['tools/mess/hofblitz.mjs', port, join(ausgabe, 'hofblitz')]);
} catch (e) {
  writeFileSync(ausgabe + '/fehler.txt', String(e) + '\n');
  throw e;
} finally {
  if (server) await new Promise((ok, fehler) => server.httpServer.close(e => e ? fehler(e) : ok()));
  rmSync(bau, { recursive: true, force: true });
}
