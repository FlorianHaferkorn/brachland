// BRACHLAND — Einzelbilder aus `tools/kontaktbogen.py` zu einem beschrifteten Kontaktbogen legen (D414).
//
//   node tools/kontaktbogen.mjs <aus.png> "<Titel>" <bild.png>=<Beschriftung> …
//
// Oben der Titel, unter jedem Bild seine Beschriftung, unten der Pflichtsatz: Formprüfung, keine Look-Abnahme.
import sharp from 'sharp';

const [aus, titel, ...teile] = process.argv.slice(2);
if (!aus || !titel || !teile.length) { console.error('Aufruf: node tools/kontaktbogen.mjs <aus.png> "<Titel>" <bild>=<text> …'); process.exit(1); }
const FUSS = 'Formprüfung, keine Look-Abnahme, Bewegung nur am M1 — Blender Cycles (CPU), ohne Spiel-Shader und Szenenlicht';
const bilder = teile.map(t => { const i = t.indexOf('='); return { pfad: i < 0 ? t : t.slice(0, i), text: i < 0 ? '' : t.slice(i + 1) }; });
const metas = await Promise.all(bilder.map(b => sharp(b.pfad).metadata()));
const KOPF = 44, UNTER = 34, FUSSH = 30;
const breite = metas.reduce((s, m) => s + m.width, 0);
const hoehe = Math.max(...metas.map(m => m.height));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
let x = 0;
const texte = [];
const lagen = [];
for (let i = 0; i < bilder.length; i++) {
  lagen.push({ input: bilder[i].pfad, left: x, top: KOPF });
  texte.push(`<text x="${x + metas[i].width / 2}" y="${KOPF + hoehe + 23}" text-anchor="middle" font-size="15">${esc(bilder[i].text)}</text>`);
  x += metas[i].width;
}
const gesamtH = KOPF + hoehe + UNTER + FUSSH;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${breite}" height="${gesamtH}" font-family="DejaVu Sans, sans-serif" fill="#1d1d1b">
  <text x="12" y="29" font-size="20" font-weight="bold">${esc(titel)}</text>
  ${texte.join('\n  ')}
  <rect x="0" y="${gesamtH - FUSSH}" width="${breite}" height="${FUSSH}" fill="#1d1d1b"/>
  <text x="12" y="${gesamtH - 10}" font-size="14" fill="#f2f0ea">${esc(FUSS)}</text>
</svg>`;
await sharp({ create: { width: breite, height: gesamtH, channels: 3, background: '#e9e6df' } })
  .composite([...lagen, { input: Buffer.from(svg), left: 0, top: 0 }])
  .png().toFile(aus);
console.log(`${aus}: ${bilder.length} Bilder, ${breite} × ${gesamtH}`);
