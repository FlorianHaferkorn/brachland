// Alterung für gebackene GLB-Baukastenhöfe. Meter aus dem tatsächlichen Knoten,
// die vorhandenen UV-Inseln und der CC0-Bruchsteinscan bleiben der Maßstab.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

function weich(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function rauschen(x, y) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = weich(0, 1, x - ix),
    fy = weich(0, 1, y - iy);
  const zahl = (i, j) => {
    const h = Math.imul(i, 1597334677) ^ Math.imul(j, 3812015801);
    return (Math.imul(h ^ (h >>> 16), 2246822519) >>> 0) / 4294967296;
  };
  return (
    (1 - fy) * ((1 - fx) * zahl(ix, iy) + fx * zahl(ix + 1, iy)) +
    fy * ((1 - fx) * zahl(ix, iy + 1) + fx * zahl(ix + 1, iy + 1))
  );
}

const ursprung = [0, 0, 0];
function punkteInMetern(knoten, p) {
  const m = knoten.getWorldMatrix(),
    a = p.getAttribute('POSITION');
  return Array.from({ length: a.getCount() }, (_, i) => {
    const [x, y, z] = a.getElement(i, ursprung);
    return [0, 1, 2].map((k) => m[k] * x + m[4 + k] * y + m[8 + k] * z + m[12 + k]);
  });
}

// Stabile Masken im Hausraum über die Materialgrenze hinweg. Feuchte steigt
// in breiten Inseln auf, an ihrem trockenen Rand liegt heller, mürber Kalk.
function verwittere(farbe, i, x, y, z, giebel, sockel, stein) {
  const u = giebel ? z : x;
  const lage = x + 0.73 * z,
    wolke = rauschen(lage * 0.5, y * 0.82 + 10);
  const fleck = rauschen(lage * 1.72 + 9, y * 2.5 + 20);
  const korn = rauschen(u * 7.6, y * 8.2);
  const wasserstand = 0.16 + 0.94 * wolke + 0.31 * fleck;
  const feucht = 1 - weich(wasserstand - 0.24, wasserstand + 0.36, y);
  const ausbruch = weich(0.54, 0.65, 0.4 * wolke + 0.31 * fleck + 0.16 * korn + 0.29 * feucht);
  const alge = feucht * weich(0.31, 0.75, 0.51 * wolke + 0.34 * fleck + 0.15 * korn);
  const sockelanteil = 1 - weich(1.05, 1.8, y);
  const spritzer = feucht * (0.13 + 0.18 * korn);
  const fr = (t) => t - Math.floor(t);
  const sx = Math.floor(stein.rand + fr(u / stein.meter + 0.19) * stein.innen);
  const sy = Math.floor(stein.rand + fr(-y / stein.meter + 0.37) * stein.innen);
  const si = (sy * stein.breite + sx) * 3;
  for (let k = 0; k < 3; k++) {
    // An einzelnen Stellen zieht die Kalkschlämme über die obersten Feldsteine.
    const kalk = sockel ? (155 + 28 * fleck) * [1, 0.98, 0.9][k] : farbe[i + k];
    const schlamm = [79, 73, 58][k];
    const kalt = kalk * (1 - 0.26 * feucht) * (1 - spritzer) + schlamm * spritzer;
    const bruch = stein.rgb[si + k] * (0.67 + 0.23 * wolke);
    const deckung = sockel ? Math.max(ausbruch, 0.36 + 0.51 * (1 - weich(0.03, 0.4, y))) : ausbruch;
    const mineral = kalt * (1 - deckung) + bruch * deckung;
    const patina = mineral * (1 - alge * 0.37) + [0.23, 0.26, 0.13][k] * 255 * alge * 0.37;
    farbe[i + k] = Math.round(farbe[i + k] + (patina - farbe[i + k]) * sockelanteil);
  }
}

async function backe(knoten, stein) {
  const p = knoten.getMesh().listPrimitives()[0],
    karte = p.getMaterial().getBaseColorTexture();
  const { data, info } = await sharp(karte.getImage()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info,
    maske = new Uint8Array(w * h);
  const ort = punkteInMetern(knoten, p),
    uv = p.getAttribute('TEXCOORD_0');
  const xy = ort.map((_, i) => {
    const [u, v] = uv.getElement(i, []);
    return [u * w - 0.5, v * h - 0.5];
  });
  const ind = p.getIndices().getArray(),
    sockel = knoten.getName() === 'stein';
  for (let j = 0; j < ind.length; j += 3) {
    const a = ind[j],
      b = ind[j + 1],
      c = ind[j + 2],
      [ax, ay] = xy[a],
      [bx, by] = xy[b],
      [cx, cy] = xy[c];
    const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(det) < 0.0001) continue;
    const [pa, pb, pc] = [ort[a], ort[b], ort[c]];
    const giebel =
      Math.abs((pb[1] - pa[1]) * (pc[2] - pa[2]) - (pc[1] - pa[1]) * (pb[2] - pa[2])) >
      Math.abs((pb[0] - pa[0]) * (pc[1] - pa[1]) - (pc[0] - pa[0]) * (pb[1] - pa[1]));
    for (let y = Math.max(0, Math.ceil(Math.min(ay, by, cy))); y <= Math.min(h - 1, Math.max(ay, by, cy)); y++) {
      for (let x = Math.max(0, Math.ceil(Math.min(ax, bx, cx))); x <= Math.min(w - 1, Math.max(ax, bx, cx)); x++) {
        const v = ((x - ax) * (cy - ay) - (cx - ax) * (y - ay)) / det,
          t = ((bx - ax) * (y - ay) - (x - ax) * (by - ay)) / det;
        if (v < 0 || t < 0 || v + t > 1) continue;
        const i = y * w + x;
        if (maske[i]) continue;
        maske[i] = 1;
        const punkt = pa.map((q, k) => q + (pb[k] - q) * v + (pc[k] - q) * t);
        // Zum Steinnetz gehören auch Dachlaststeine: die bleiben wie gebacken.
        if (punkt[1] < 1.8) verwittere(data, 3 * i, ...punkt, giebel, sockel, stein);
      }
    }
  }
  // Die Mipkette braucht dieselbe Farbe knapp außerhalb jeder UV-Insel.
  for (let r = 1; r <= 4; r++)
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (maske[i]) continue;
        const nachbar = [i - 1, i + 1, i - w, i + w].find((n) => maske[n] === r);
        if (nachbar === undefined) continue;
        data.copy(data, 3 * i, 3 * nachbar, 3 * nachbar + 3);
        maske[i] = r + 1;
      }
  return sharp(data, { raw: { width: w, height: h, channels: 3 } })
    .webp({ quality: 88 })
    .toBuffer();
}

/** Die Farbkarte jedes Materials ist vor diesem Schritt bereits auf ihre Spielauflösung gebracht.
 * Eingabe ist der frische Baukasten-Export. Der Standard-Renderer nutzt seine bisherigen UVs. */
export async function backeHofsockel(doc) {
  const herkunft = JSON.parse(
    await readFile(new URL('../public/material/hof-scans.json', import.meta.url), 'utf8')
  );
  const steinRolle = herkunft.rollen.findIndex((rolle) => rolle.quelle === 'old_stone_wall');
  if (steinRolle < 0) throw Error('Bruchstein fehlt im Hofatlas');
  const kachel = herkunft.kachel;
  const ausschnitt = {
    left: (steinRolle % 2) * kachel,
    top: Math.floor(steinRolle / 2) * kachel,
    width: kachel,
    height: kachel
  };
  const rgb = await sharp(fileURLToPath(new URL('../public/material/hof-scans.webp', import.meta.url)))
    .extract(ausschnitt)
    .removeAlpha()
    .raw()
    .toBuffer();
  const stein = {
    rgb,
    breite: kachel,
    rand: herkunft.rand,
    innen: herkunft.innen,
    meter: herkunft.rollen[steinRolle].meter
  };
  for (const name of ['putz', 'stein']) {
    const knoten = doc
      .getRoot()
      .listNodes()
      .find((o) => o.getName() === name);
    if (!knoten) throw Error('Hof-Baukastenteil fehlt: ' + name);
    const karte = knoten.getMesh().listPrimitives()[0].getMaterial().getBaseColorTexture();
    karte.setImage(await backe(knoten, stein));
  }
}
