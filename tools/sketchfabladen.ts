/**
 * BRACHLAND — Gratis-Modelle von Sketchfab holen (D228, ADR-0013)
 *
 *   SKETCHFAB_TOKEN=… npx tsx tools/sketchfabladen.ts <uid> [<uid> …]
 *
 * In der Cloud-Umgebung zusätzlich `NODE_USE_ENV_PROXY=1`: Nodes `fetch` liest `HTTPS_PROXY` sonst
 * nicht ("fetch failed"). Die Lizenzprüfung filtert nur das Etikett; Modelle, deren Beschreibung
 * der Lizenz widerspricht, schliesst `docs/ASSET_KANDIDATEN.md` aus — nur von dort laden.
 *
 * Je uid: Lizenz prüfen (nur CC0 und CC-BY, `isDownloadable`), die glTF-Fassung über
 * `GET /v3/models/{uid}/download` laden, nach `.cache/sketchfab/<uid>/` entpacken und eine
 * Herkunftszeile samt Kennzahlen ausgeben (Flächen, Texturen, Grösse). **Nichts landet in
 * `public/`:** Was ins Spiel geht, wird erst angesehen, dann verkleinert (Texturen 1K–2K,
 * Flächen nach Budget) und mit Zeile in `assets/HERKUNFT.md` übernommen.
 *
 * Der Token kommt nur aus der Umgebung, nie aus dem Repo (CLAUDE.md, PII-/Geheimnis-Configs).
 * Kandidaten und Begründung: `docs/ASSET_KANDIDATEN.md`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://api.sketchfab.com/v3';
const ERLAUBT = new Set(['cc0', 'by']);

interface Modell {
  uid: string; name: string; isDownloadable: boolean; faceCount?: number;
  user: { displayName: string; username: string };
  license?: { slug: string; label: string; url?: string };
  viewerUrl: string;
}

async function hole<T>(pfad: string, token?: string): Promise<T> {
  const r = await fetch(API + pfad, { headers: token ? { Authorization: `Token ${token}` } : {} });
  if (!r.ok) throw new Error(`${pfad}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

function groesse(ordner: string): number {
  let s = 0;
  for (const f of readdirSync(ordner, { withFileTypes: true }))
    s += f.isDirectory() ? groesse(join(ordner, f.name)) : statSync(join(ordner, f.name)).size;
  return s;
}

async function lade(uid: string, token: string): Promise<void> {
  const m = await hole<Modell>(`/models/${uid}`);
  const lizenz = m.license?.slug ?? '?';
  if (!ERLAUBT.has(lizenz)) { console.log(`✗ ${uid} ${m.name}: Lizenz ${m.license?.label ?? lizenz} — nicht erlaubt (ADR-0013)`); return; }
  if (!m.isDownloadable) { console.log(`✗ ${uid} ${m.name}: nicht herunterladbar`); return; }

  const ziel = join('.cache', 'sketchfab', uid);
  if (existsSync(join(ziel, 'scene.gltf'))) { console.log(`· ${uid} ${m.name}: liegt schon in ${ziel}`); return; }
  mkdirSync(ziel, { recursive: true });

  const d = await hole<{ gltf?: { url: string; size: number } }>(`/models/${uid}/download`, token);
  if (!d.gltf) throw new Error(`${uid}: keine glTF-Fassung im Download`);
  // Die URL ist signiert und nur Minuten gültig: sofort ziehen.
  const zip = await fetch(d.gltf.url);
  if (!zip.ok) throw new Error(`${uid}: Archiv HTTP ${zip.status}`);
  const datei = join(ziel, 'archiv.zip');
  writeFileSync(datei, Buffer.from(await zip.arrayBuffer()));
  execFileSync('unzip', ['-q', '-o', datei, '-d', ziel]);

  const stand = new Date().toISOString().slice(0, 10);
  writeFileSync(join(ziel, 'herkunft.json'), JSON.stringify({
    uid, name: m.name, autor: m.user.displayName, nutzer: m.user.username,
    lizenz: m.license?.label, lizenzUrl: m.license?.url, quelle: m.viewerUrl, geprueft: stand,
  }, null, 2));
  console.log(`✓ ${uid} ${m.name} — ${m.user.displayName}, ${m.license?.label}, ${m.faceCount ?? '?'} Flächen, `
    + `${(groesse(ziel) / 1048576).toFixed(1)} MB entpackt → ${ziel}`);
  console.log(`  HERKUNFT: | <datei> | <rolle> | ${m.user.displayName} | ${lizenz === 'cc0' ? 'CC0-1.0' : 'CC-BY-4.0'} | Sketchfab ${m.viewerUrl}, geladen ${stand}, verändert: <was> |`);
}

const token = process.env.SKETCHFAB_TOKEN;
const uids = process.argv.slice(2);
if (!token) { console.error('SKETCHFAB_TOKEN fehlt (Umgebungsvariable, nie ins Repo).'); process.exit(1); }
if (!uids.length) { console.error('Aufruf: npx tsx tools/sketchfabladen.ts <uid> [<uid> …]'); process.exit(1); }
for (const uid of uids) {
  try { await lade(uid, token); } catch (e) { console.log(`✗ ${uid}: ${(e as Error).message}`); }
}
