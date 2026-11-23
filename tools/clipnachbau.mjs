// BRACHLAND — Clips der Hauptfigur nachbauen ohne Quellpakete (D414). Gegenstück zu `tools/clipnachbau.py`.
//
// `tools/heldbau.py` braucht UAL2, UBC und `.cache/wanderin_alt.blend` — die liegen nicht auf jeder Maschine.
// Neue Waffenclips lassen sich trotzdem bauen: aus der alten Wanderin (`public/figuren/wanderin.glb`, mit Idle),
// über die Weltformel auf eine ausgelieferte Gestalt. Dieses Werkzeug liefert Blender die Eingaben und fügt das
// Ergebnis wieder in `held-clips.glb` ein.
//
//   node tools/clipnachbau.mjs roh <ein.glb> <aus.glb>                 Meshopt/Quantisierung entpacken (Blender liest sie nicht)
//   node tools/clipnachbau.mjs figur <gestalt.glb> <clips.glb> <aus.glb>  Gestalt mit allen Clips (entpackt) — Skelett für Blender
//   node tools/clipnachbau.mjs einfuegen <neu.glb> <held-clips.glb> [--weg=A,B]   neue Clips (Blender-Export) nach Knotennamen
//                                                                      einfügen; `--weg` nimmt ersetzte Clips heraus (D429: Axe_Overhead)
//
// `einfuegen` prüft zuerst, dass jeder Knoten in beiden Dateien dieselbe Ruhelage hat — sonst bedeuteten
// dieselben Quaternionen eine andere Haltung, und der Clip wäre verdreht. Gleichnamige Clips werden ersetzt.
// Danach wie `heldpack.ts`: konstante Skalen- und Verschiebungskanäle weg, `resample`, Meshopt.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, dequantize, meshopt, prune, resample } from '@gltf-transform/functions';
import { PropertyType } from '@gltf-transform/core';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { statSync } from 'node:fs';

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder,
});
const [modus, ...arg] = process.argv.slice(2);

function entpacke(doc) {
  for (const e of doc.getRoot().listExtensionsUsed()) {
    if (/meshopt|quantization/i.test(e.extensionName)) e.dispose();
  }
}

/**
 * Animationen aus `von` nach `nach` kopieren, Kanäle über die Knotennamen gebunden.
 * D460: `takt` = Map Clip → Bilder je Sekunde. Blender exportiert mit 24 Bildern/s und legt Bild 1 auf 1/24 s; ein Clip
 * mit eigenem Takt beginnt bei 0 s und läuft mit seiner Rate (Bild b liegt bei (b − 1) / Takt) — Schleifen ohne das
 * gehaltene erste Vierundzwanzigstel, Lauf und Sprint mit 48 Bildern/s. `als` = Map Clip → Name der Kopie.
 */
function kopiereClips(von, nach, namen = null, takt = null, als = null) {
  const knoten = new Map(nach.getRoot().listNodes().map(n => [n.getName(), n]));
  const puffer = nach.getRoot().listBuffers()[0] ?? nach.createBuffer();
  const neu = [];
  for (const a of von.getRoot().listAnimations()) {
    if (namen && !namen.has(a.getName())) continue;
    const b = nach.createAnimation(als?.get(a.getName()) ?? a.getName());
    const rate = takt?.get(a.getName());
    let t0 = Infinity;
    if (rate) for (const s of a.listSamplers()) t0 = Math.min(t0, s.getInput().getMin([])[0]);
    for (const c of a.listChannels()) {
      const ziel = knoten.get(c.getTargetNode()?.getName() ?? '');
      const s = c.getSampler();
      if (!ziel || !s) continue;
      // Immer als Float32: Meshopt legt Quaternionen normalisiert als Int16 ab, `getElement` rechnet zurück.
      const acc = (x, zeit = false) => {
        const n = x.getCount(), g = x.getElementSize(), f = new Float32Array(n * g), e = [];
        for (let i = 0; i < n; i++) { x.getElement(i, e); for (let j = 0; j < g; j++) f[i * g + j] = e[j]; }
        if (zeit && rate) for (let i = 0; i < f.length; i++) f[i] = Math.max(0, (f[i] - t0) * 24 / rate);
        return nach.createAccessor().setType(x.getType()).setArray(f).setBuffer(puffer);
      };
      const sn = nach.createAnimationSampler().setInput(acc(s.getInput(), true)).setOutput(acc(s.getOutput()))
        .setInterpolation(s.getInterpolation());
      b.addSampler(sn).addChannel(nach.createAnimationChannel().setTargetNode(ziel).setTargetPath(c.getTargetPath()).setSampler(sn));
    }
    neu.push(b.getName());
  }
  return neu;
}

if (modus === 'roh') {
  const doc = await io.read(arg[0]);
  await doc.transform(dequantize());
  entpacke(doc);
  await io.write(arg[1], doc);
  console.log(`${arg[0]} → ${arg[1]} (entpackt)`);
} else if (modus === 'figur') {
  const figur = await io.read(arg[0]);
  const clips = await io.read(arg[1]);
  await figur.transform(dequantize());
  const n = kopiereClips(clips, figur);
  entpacke(figur);
  await io.write(arg[2], figur);
  console.log(`${arg[2]}: Gestalt mit ${n.length} Clips`);
} else if (modus === 'einfuegen') {
  const neu = await io.read(arg[0]);
  const ziel = await io.read(arg[1]);
  const vorher = statSync(arg[1]).size / 1024;
  // Ruhelagen vergleichen: Drehung (|q·q'| ≈ 1) und Lage (1 mm).
  const zk = new Map(ziel.getRoot().listNodes().map(k => [k.getName(), k]));
  let geprueft = 0;
  const abweichend = [];
  for (const k of neu.getRoot().listNodes()) {
    const z = zk.get(k.getName());
    if (!z || !k.getName()) continue;
    geprueft++;
    const q1 = k.getRotation(), q2 = z.getRotation();
    const dot = Math.abs(q1.reduce((s, v, i) => s + v * q2[i], 0));
    const t1 = k.getTranslation(), t2 = z.getTranslation();
    const dt = Math.hypot(...t1.map((v, i) => v - t2[i]));
    if (dot < 0.9999 || dt > 0.001) abweichend.push(`${k.getName()} (q ${dot.toFixed(5)}, ${(dt * 1000).toFixed(1)} mm)`);
  }
  if (abweichend.length) {
    console.error(`Ruhelagen weichen ab — nichts eingefügt: ${abweichend.slice(0, 8).join(', ')}`);
    process.exit(1);
  }
  const namen = new Set(neu.getRoot().listAnimations().map(a => a.getName()));
  const weg = new Set((arg.find(a => a.startsWith('--weg='))?.slice(6) ?? '').split(',').filter(Boolean));
  // D460: `--takt=Clip:48,…` (Bilder je Sekunde, Beginn bei 0 s), `--um=Alt:Neu,…` (Bestandsclip umbenennen, bevor ein
  // neuer seinen Namen bekommt), `--auch=Clip:Name,…` (den neuen Clip zusätzlich unter einem Bestandsnamen ausliefern —
  // die Laufzeit greift ihn dann ohne Codeänderung; die Daten liegen nur einmal in der Datei, `dedup`).
  const paare = (schalter) => new Map((arg.find(a => a.startsWith(`--${schalter}=`))?.slice(schalter.length + 3) ?? '')
    .split(',').filter(Boolean).map(p => p.split(':')));
  const takt = new Map([...paare('takt')].map(([n, r]) => [n, Number(r)]));
  const um = paare('um'), auch = paare('auch');
  for (const a of ziel.getRoot().listAnimations()) {
    const neuerName = um.get(a.getName());
    if (!neuerName) continue;
    if (ziel.getRoot().listAnimations().some(x => x.getName() === neuerName)) { console.error(`--um: ${neuerName} gibt es schon`); process.exit(1); }
    console.log(`  umbenannt: ${a.getName()} → ${neuerName}`);
    a.setName(neuerName);
  }
  for (const n of auch.values()) weg.add(n);
  // D429: Kanäle und Sampler mit wegwerfen — sonst halten die Sampler ihre Zugriffe fest, `prune` lässt sie stehen,
  // und die Datei trägt die Daten der ersetzten Clips weiter (gemessen: 367 tote Zugriffe, rund 70 KB).
  for (const a of ziel.getRoot().listAnimations()) {
    if (!namen.has(a.getName()) && !weg.has(a.getName())) continue;
    for (const c of a.listChannels()) c.dispose();
    for (const s of a.listSamplers()) s.dispose();
    a.dispose();
  }
  if (weg.size) console.log(`  heraus: ${[...weg].join(', ')}`);
  // D429: nur die neuen Clips ausdünnen — `resample` über die ganze Datei nahm bei jedem Einfügen den Bestand noch einmal
  // mit (gemessen: Messer_Quer_B verlor einen Schlüssel); so bleiben die übrigen Clips Wert für Wert gleich.
  await neu.transform(resample({ tolerance: 5e-4 }));
  const drin = kopiereClips(neu, ziel, namen, takt);
  for (const [quelle, name] of auch) {
    if (!namen.has(quelle)) { console.error(`--auch: ${quelle} ist nicht unter den neuen Clips`); process.exit(1); }
    kopiereClips(neu, ziel, new Set([quelle]), takt, new Map([[quelle, name]]));
    namen.add(name);
    console.log(`  ${quelle} auch als ${name}`);
  }
  let leer = 0;
  for (const a of ziel.getRoot().listAnimations()) {
    if (!namen.has(a.getName())) continue;
    for (const c of a.listChannels()) {
      const p = c.getTargetPath();
      const out = c.getSampler()?.getOutput()?.getArray();
      const n = c.getTargetNode();
      if (!out || !n) continue;
      const konstant = p === 'scale' ? [...out].every(v => Math.abs(v - 1) < 1e-4)
        : p === 'translation' ? [...out].every((v, i) => Math.abs(v - n.getTranslation()[i % 3]) < 1e-4) : false;
      if (konstant) { c.getSampler()?.dispose(); c.dispose(); leer++; }
    }
  }
  // D429: gleiche Zugriffe (konstante Kanäle, gleiche Zeitachsen) zusammenlegen — wie in der Datei aus heldbau.py.
  await ziel.transform(dedup({ propertyTypes: [PropertyType.ACCESSOR] }), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(arg[1], ziel);
  console.log(`${arg[1]}: ${geprueft} Knoten mit gleicher Ruhelage, ${drin.length} Clips eingefügt (${drin.join(', ')}), ` +
    `${leer} konstante Kanäle weg, ${vorher.toFixed(0)} → ${(statSync(arg[1]).size / 1024).toFixed(0)} KB, ` +
    `${ziel.getRoot().listAnimations().length} Clips`);
} else {
  console.error('Aufruf: node tools/clipnachbau.mjs roh|figur|einfuegen …');
  process.exit(1);
}
