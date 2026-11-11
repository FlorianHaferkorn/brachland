/** Freie Blattkarten fuer die EZ-Baumprobe aus Poly-Haven-Farb- und Alphakarten.
 * Aufruf: node tools/eztexturen.mjs
 * Schreibt neue Dateien unter public/material, verweigert bestehende Ausgaben.
 * Herkunft/Version: assets/HERKUNFT.md. Die Quellkarten bleiben in .cache/eztexturen.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const quellen = [
  { datei: 'pine-diff.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/pine_tree_01/pine_tree_01_twig_diff_1k.jpg', md5: 'b6e5f4e8c228c275e5ff75cb165c2e1f' },
  { datei: 'pine-alpha.png', url: 'https://dl.polyhaven.org/file/ph-assets/Models/png/1k/pine_tree_01/pine_tree_01_twig_alpha_1k.png', md5: '641911a5a3f543911dad04ebb26e7bca' },
  { datei: 'laub-diff.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/tree_small_02/tree_small_02_leaves_diff_1k.jpg', md5: '315cbc2cebfb399e649ccd39112c109a' },
  { datei: 'laub-alpha.png', url: 'https://dl.polyhaven.org/file/ph-assets/Models/png/1k/tree_small_02/tree_small_02_leaves_alpha_1k.png', md5: '63199ba87a9e8928424bd8c3b8017bd0' },
];
const ziel = [
  { name: 'ez-nadel-cc0-v5.webp', farbe: 'pine-diff.jpg', alpha: 'pine-alpha.png', ausschnitt: { left: 40, top: 40, width: 150, height: 380 } },
  { name: 'ez-laub-cc0-v5.webp', farbe: 'laub-diff.jpg', alpha: 'laub-alpha.png', ausschnitt: { left: 570, top: 50, width: 220, height: 600 } },
];
for (const z of ziel) if (existsSync(`public/material/${z.name}`)) throw new Error(`Ausgabe existiert: ${z.name}`);
mkdirSync('.cache/eztexturen', { recursive: true });
for (const q of quellen) {
  const pfad = `.cache/eztexturen/${q.datei}`;
  if (!existsSync(pfad)) {
    const antwort = await fetch(q.url);
    if (!antwort.ok) throw new Error(`${q.url}: HTTP ${antwort.status}`);
    writeFileSync(pfad, Buffer.from(await antwort.arrayBuffer()), { flag: 'wx' });
  }
  const hash = createHash('md5').update(readFileSync(pfad)).digest('hex');
  if (hash !== q.md5) throw new Error(`${pfad}: Quellhash ${hash}, erwartet ${q.md5}`);
}
for (const z of ziel) {
  const alpha = await sharp(`.cache/eztexturen/${z.alpha}`).extract(z.ausschnitt)
    .resize(512, 512, { fit: 'fill' }).greyscale().raw().toBuffer();
  // Im Originalatlas liegen neben dem Zweig andere UV-Inseln. Zum unteren
  // Rand die Karte auf den mittigen Stiel begrenzen, statt diese Inseln als
  // grosse helle Flaechen in jede Krone zu uebernehmen.
  for (let y = 410; y < 512; y++) {
    const rand = ((y - 410) / 102) * 150;
    for (let x = 0; x < 512; x++) {
      const faktor = Math.max(0, Math.min(1, (Math.min(x, 511 - x) - rand) / 3));
      alpha[y * 512 + x] = Math.round(alpha[y * 512 + x] * faktor);
    }
  }
  const bild = await sharp(`.cache/eztexturen/${z.farbe}`).extract(z.ausschnitt)
    .resize(512, 512, { fit: 'fill' })
    .joinChannel(alpha, { raw: { width: 512, height: 512, channels: 1 } })
    .webp({ quality: 90, alphaQuality: 100 }).toBuffer();
  writeFileSync(`public/material/${z.name}`, bild, { flag: 'wx' });
  console.log(`${z.name}: ${bild.length} Byte, SHA-256 ${createHash('sha256').update(bild).digest('hex')}`);
}
