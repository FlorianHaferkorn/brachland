/**
 * Hofprobe: originale Scan-Albedo, OpenGL-Normalen und AO/Rauheit statt Farbmodulation.
 * node tools/hofscans.mjs — neue Ausgaben; bestehende historische Dateien bleiben erhalten.
 * Quellen: Poly Haven, CC0 (https://polyhaven.com/license), geprüft 17.11.2026.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';

const WURZEL = resolve(import.meta.dirname, '..');
const ROH = resolve(WURZEL, '.cache/hofscans');
const ZIEL = resolve(WURZEL, 'public/material');
const KACHEL = 1024;
const RAND = 8;
const INNEN = KACHEL - RAND * 2;
const GRENZE = 30 * 1024 * 1024;
let downloadGrenze = GRENZE;
const SATZ = [
  ['plastered_wall_03', 'putz'],
  ['weathered_planks', 'schalung'],
  ['grey_roof_tiles', 'dach'],
  ['old_stone_wall', 'sockel'],
  ['gravel_road', 'boden'],
];
const AUSGABEN = [
  'hof-scans.webp', 'hof-scans-nor.webp', 'hof-scans-arm.webp',
  'hof-boden-farbe.webp', 'hof-boden-normal.webp', 'hof-boden-arm.webp', 'hof-scans.json',
];
let rohBytes = 0;

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function holeJson(url) {
  const antwort = await fetch(url, { headers: { 'User-Agent': 'BRACHLAND-Hofprobe/1.0' } });
  if (!antwort.ok) throw new Error(`${antwort.status}: ${url}`);
  return antwort.json();
}

async function ladeKarte(id, art, dateien) {
  const auswahl = dateien[art]?.['1k'];
  const quelle = auswahl?.jpg ?? auswahl?.png;
  if (!quelle) throw new Error(`${id}: keine 1K-Karte für ${art}`);
  const datei = resolve(ROH, `${id}-${art}.${auswahl.jpg ? 'jpg' : 'png'}`);
  let bytes;
  try {
    bytes = await readFile(datei);
  } catch (fehler) {
    if (fehler.code !== 'ENOENT') throw fehler;
    if (rohBytes + quelle.size > downloadGrenze) throw new Error('Rohdownload überschreitet die Größengrenze.');
    const antwort = await fetch(quelle.url);
    if (!antwort.ok) throw new Error(`${antwort.status}: ${quelle.url}`);
    bytes = Buffer.from(await antwort.arrayBuffer());
    await writeFile(datei, bytes, { flag: 'wx' });
  }
  rohBytes += bytes.length;
  if (rohBytes > downloadGrenze) throw new Error('Rohsatz überschreitet die Größengrenze.');
  if (quelle.md5 && createHash('md5').update(bytes).digest('hex') !== quelle.md5) {
    throw new Error(`Prüfsumme stimmt nicht: ${datei}`);
  }
  return { bytes, beleg: { art, url: quelle.url, bytes: bytes.length, sha256: hash(bytes) } };
}

async function rgb(bytes, groesse) {
  return sharp(bytes).removeAlpha().toColourspace('srgb').resize(groesse, groesse).raw().toBuffer();
}

async function grau(bytes, groesse) {
  return sharp(bytes).removeAlpha().greyscale().resize(groesse, groesse).raw().toBuffer();
}

function polstere(bytes) {
  const aus = Buffer.alloc(KACHEL * KACHEL * 3);
  // Umlaufende Kopie: der Rand enthält die jeweils gegenüberliegende Texturkante.
  for (let y = 0; y < KACHEL; y++) {
    for (let x = 0; x < KACHEL; x++) {
      const sx = (x - RAND + INNEN) % INNEN;
      const sy = (y - RAND + INNEN) % INNEN;
      const von = (sy * INNEN + sx) * 3;
      bytes.copy(aus, (y * KACHEL + x) * 3, von, von + 3);
    }
  }
  return aus;
}

async function material(id, rolle) {
  const [info, dateien] = await Promise.all([
    holeJson(`https://api.polyhaven.com/info/${id}`),
    holeJson(`https://api.polyhaven.com/files/${id}`),
  ]);
  // Downloads bewusst sequenziell: die gemeinsame Größenbegrenzung bleibt verbindlich.
  const farbe = await ladeKarte(id, 'Diffuse', dateien);
  const normal = await ladeKarte(id, 'nor_gl', dateien);
  const rau = await ladeKarte(id, 'Rough', dateien);
  const ao = await ladeKarte(id, 'AO', dateien);
  const groesse = rolle === 'boden' ? KACHEL : INNEN;
  const [f, n, r, a] = await Promise.all([
    rgb(farbe.bytes, groesse), rgb(normal.bytes, groesse),
    grau(rau.bytes, groesse), grau(ao.bytes, groesse),
  ]);
  const arm = Buffer.alloc(groesse * groesse * 3);
  for (let i = 0; i < groesse * groesse; i++) {
    arm[i * 3] = a[i];
    arm[i * 3 + 1] = r[i];
    arm[i * 3 + 2] = 0; // Nichtmetall; kein aus der Farbe abgeleiteter Materialwert.
  }
  return {
    farbe: rolle === 'boden' ? f : polstere(f),
    normal: rolle === 'boden' ? n : polstere(n),
    arm: rolle === 'boden' ? arm : polstere(arm),
    beleg: {
      rolle, quelle: id, quelleUrl: `https://polyhaven.com/a/${id}`,
      meter: Number((info.dimensions[0] / 1000).toFixed(3)),
      autoren: info.authors, lizenz: 'CC0-1.0', lizenzUrl: 'https://polyhaven.com/license',
      karten: [farbe, normal, rau, ao].map(k => k.beleg),
    },
  };
}

async function webp(bytes, breite, hoehe, qualitaet) {
  return sharp(bytes, { raw: { width: breite, height: hoehe, channels: 3 } })
    .webp({ quality: qualitaet, effort: 6 }).toBuffer();
}

async function main() {
  await mkdir(ROH, { recursive: true });
  await mkdir(ZIEL, { recursive: true });
  for (const name of AUSGABEN) {
    try {
      await access(resolve(ZIEL, name));
      throw new Error(`Ausgabe existiert bereits: ${name}. Historische Ergebnisse bleiben erhalten.`);
    } catch (fehler) {
      if (fehler.code !== 'ENOENT') throw fehler;
    }
  }
  const materialien = [];
  for (const [id, rolle] of SATZ) {
    console.log('Lade', rolle, id);
    materialien.push(await material(id, rolle));
  }
  const ausgaben = {};
  for (const [kanal, name, q] of [
    ['farbe', 'hof-scans.webp', 94], ['normal', 'hof-scans-nor.webp', 96],
    ['arm', 'hof-scans-arm.webp', 96],
  ]) {
    const atlas = Buffer.alloc(KACHEL * 2 * KACHEL * 2 * 3);
    for (let i = 0; i < 4; i++) {
      for (let y = 0; y < KACHEL; y++) {
        const start = (((i >> 1) * KACHEL + y) * KACHEL * 2 + (i % 2) * KACHEL) * 3;
        materialien[i][kanal].copy(atlas, start, y * KACHEL * 3, (y + 1) * KACHEL * 3);
      }
    }
    ausgaben[name] = await webp(atlas, KACHEL * 2, KACHEL * 2, q);
  }
  for (const [kanal, name] of [
    ['farbe', 'hof-boden-farbe.webp'], ['normal', 'hof-boden-normal.webp'],
    ['arm', 'hof-boden-arm.webp'],
  ]) ausgaben[name] = await webp(materialien[4][kanal], KACHEL, KACHEL, kanal === 'farbe' ? 94 : 96);
  const beleg = {
    geprueft: '2026-11-17', kachel: KACHEL, rand: RAND, innen: INNEN,
    farbe: 'originale sRGB-Albedo; keine Mittelwertnormalisierung',
    normal: 'OpenGL, lineare Daten', arm: 'R=AO, G=Rauheit, B=Metallanteil 0; lineare Daten',
    rollen: materialien.slice(0, 4).map(m => m.beleg), boden: materialien[4].beleg,
    rohBytes,
    ausgaben: Object.fromEntries(Object.entries(ausgaben).map(([n, b]) => [n, { bytes: b.length, sha256: hash(b) }])),
  };
  for (const [name, bytes] of Object.entries(ausgaben)) await writeFile(resolve(ZIEL, name), bytes, { flag: 'wx' });
  await writeFile(resolve(ZIEL, 'hof-scans.json'), `${JSON.stringify(beleg, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify(beleg, null, 2));
}

/** Zusatzsatz: gleiche Bildorientierung und dieselben UV-Inseln wie D229/D230/D234. */
async function props() {
  await mkdir(ROH, { recursive: true });
  const satz = [
    ['rock_moss_set_01', 'fels-moos-1', false, ['findling_scan_d', 'findling_scan_e', 'findling_scan_f']],
    ['rock_moss_set_02', 'fels-moos-2', false, ['findling_scan_a', 'findling_scan_b', 'findling_scan_c']],
    ['fern_02', 'farn', true, ['farn_scan_a', 'farn_scan_b', 'farn_scan_c', 'farn_scan_d']],
    ['grass_medium_02', 'gras', true, ['gras_scan_a', 'gras_scan_b', 'gras_scan_c', 'gras_scan_d', 'gras_scan_e', 'gras_scan_f']],
  ];
  const namen = ['hof-props.json', ...satz.flatMap(([, name]) =>
    ['farbe', 'normal', 'arm'].map(k => `hof-${name}-${k}.webp`))];
  for (const name of namen) {
    try {
      await access(resolve(ZIEL, name));
      throw new Error(`Ausgabe existiert bereits: ${name}. Historische Ergebnisse bleiben erhalten.`);
    } catch (fehler) {
      if (fehler.code !== 'ENOENT') throw fehler;
    }
  }
  const io = new NodeIO();
  const eintraege = [];
  const ausgaben = {};
  for (const [id, name, transparent, modelle] of satz) {
    console.log('Lade Props', name, id);
    const [info, dateien] = await Promise.all([
      holeJson(`https://api.polyhaven.com/info/${id}`),
      holeJson(`https://api.polyhaven.com/files/${id}`),
    ]);
    const karten = {};
    for (const art of ['Diffuse', 'nor_gl', 'AO', 'Rough', ...(transparent ? ['Alpha'] : [])]) {
      karten[art] = await ladeKarte(id, art, dateien);
    }
    const farbe = await rgb(karten.Diffuse.bytes, KACHEL);
    const normal = await rgb(karten.nor_gl.bytes, KACHEL);
    const ao = await grau(karten.AO.bytes, KACHEL);
    const rau = await grau(karten.Rough.bytes, KACHEL);
    const arm = Buffer.alloc(KACHEL * KACHEL * 3);
    for (let i = 0; i < KACHEL * KACHEL; i++) {
      arm[i * 3] = ao[i]; arm[i * 3 + 1] = rau[i]; arm[i * 3 + 2] = 0;
    }
    if (transparent) {
      const alpha = await grau(karten.Alpha.bytes, KACHEL);
      const rgba = Buffer.alloc(KACHEL * KACHEL * 4);
      for (let i = 0; i < KACHEL * KACHEL; i++) {
        farbe.copy(rgba, i * 4, i * 3, i * 3 + 3); rgba[i * 4 + 3] = alpha[i];
      }
      ausgaben[`hof-${name}-farbe.webp`] = await sharp(rgba,
        { raw: { width: KACHEL, height: KACHEL, channels: 4 } })
        .webp({ quality: 94, alphaQuality: 100, effort: 6 }).toBuffer();
    } else ausgaben[`hof-${name}-farbe.webp`] = await webp(farbe, KACHEL, KACHEL, 94);
    ausgaben[`hof-${name}-normal.webp`] = await webp(normal, KACHEL, KACHEL, 96);
    ausgaben[`hof-${name}-arm.webp`] = await webp(arm, KACHEL, KACHEL, 96);
    const uvBelege = [];
    for (const modell of modelle) {
      const datei = `public/props/${modell}.glb`;
      const doc = await io.read(resolve(WURZEL, datei));
      for (const mesh of doc.getRoot().listMeshes()) {
        for (const primitiv of mesh.listPrimitives()) {
          const uv = primitiv.getAttribute('TEXCOORD_0');
          if (!uv || uv.getType() !== 'VEC2') throw new Error(`${datei}: UV fehlen`);
          const zahlen = uv.getArray();
          if (!zahlen || !Array.from(zahlen).every(Number.isFinite)) throw new Error(`${datei}: UV ungültig`);
          uvBelege.push({ datei, ecken: uv.getCount(),
            uvSha256: hash(Buffer.from(zahlen.buffer, zahlen.byteOffset, zahlen.byteLength)) });
        }
      }
    }
    eintraege.push({ name, quelle: id, quelleUrl: `https://polyhaven.com/a/${id}`,
      autoren: info.authors, lizenz: 'CC0-1.0', lizenzUrl: 'https://polyhaven.com/license',
      alpha: transparent, karten: Object.values(karten).map(k => k.beleg), uvBelege,
      uvKompatibilitaet: 'Unveränderte volle 1K-Bildfläche, keine Drehung/Spiegelung/Beschneidung; UV direkt übernommen in tools/phprops.ts bzw. tools/farnscan.ts.',
    });
  }
  const beleg = { geprueft: '2026-11-17', groesse: KACHEL, rohBytes,
    farbe: 'Originale sRGB-Albedo ohne Palettenmodulation; Originalalpha bei Farn und Gras.',
    normal: 'OpenGL, lineare Daten; dieselbe Bildorientierung wie vorhandene Texturen.',
    arm: 'R=AO, G=Rauheit, B=Metallanteil 0; lineare Daten', eintraege,
    ausgaben: Object.fromEntries(Object.entries(ausgaben).map(([n, b]) => [n, { bytes: b.length, sha256: hash(b) }])),
  };
  for (const [name, bytes] of Object.entries(ausgaben)) await writeFile(resolve(ZIEL, name), bytes, { flag: 'wx' });
  await writeFile(resolve(ZIEL, 'hof-props.json'), `${JSON.stringify(beleg, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify(beleg, null, 2));
}

/** Heller Hofkies als eigenständige, unverfälschte Alternative zur braunen gravel_road-Probe. */
async function kies() {
  downloadGrenze = 5_000_000;
  await mkdir(ROH, { recursive: true });
  await mkdir(ZIEL, { recursive: true });
  for (const name of ['hof-kies-farbe.webp', 'hof-kies-normal.webp', 'hof-kies-arm.webp', 'hof-kies.json']) {
    try {
      await access(resolve(ZIEL, name));
      throw new Error(`Ausgabe existiert bereits: ${name}. Historische Ergebnisse bleiben erhalten.`);
    } catch (fehler) {
      if (fehler.code !== 'ENOENT') throw fehler;
    }
  }
  const m = await material('gravel_floor_02', 'boden');
  const ausgaben = {};
  for (const [kanal, datei] of [['farbe', 'farbe'], ['normal', 'normal'], ['arm', 'arm']]) {
    ausgaben[`hof-kies-${datei}.webp`] = await webp(m[kanal], KACHEL, KACHEL, kanal === 'farbe' ? 94 : 96);
  }
  const beleg = { geprueft: '2026-11-17', groesse: KACHEL, rohBytes,
    ...m.beleg, farbe: 'Originale sRGB-Albedo ohne Neutralisierung oder Mittelwertmodulation.',
    normal: 'OpenGL, lineare Daten', arm: 'R=AO, G=Rauheit, B=Metallanteil 0; lineare Daten',
    auswahl: 'Thumbnail visuell geprüft: dichtes hellgraues Schotterbett statt rostbrauner Erde.',
    ausgaben: Object.fromEntries(Object.entries(ausgaben).map(([n, b]) => [n, { bytes: b.length, sha256: hash(b) }])),
  };
  for (const [name, bytes] of Object.entries(ausgaben)) await writeFile(resolve(ZIEL, name), bytes, { flag: 'wx' });
  await writeFile(resolve(ZIEL, 'hof-kies.json'), `${JSON.stringify(beleg, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify(beleg, null, 2));
}

(process.argv[2] === 'props' ? props() : process.argv[2] === 'kies' ? kies() : main())
  .catch(fehler => { console.error(fehler.message); process.exitCode = 1; });
