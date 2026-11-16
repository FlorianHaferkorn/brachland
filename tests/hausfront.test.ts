/** D297: Raumkoordinaten nur auf Scheiben; Haus und Garten bleiben gemeinsam renderbar. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Weltdaten } from '../src/world/osm.js';
import type { Aufsatzboden } from '../src/world/terrain.js';

Object.defineProperty(globalThis, 'location', { value: { search: '?hausfront=1&bau=1' }, configurable: true });
const { baueGebaeude } = await import('../src/world/terrain.js');
const { baueGartenKachel } = await import('../src/world/baender.js');
const { baueHoehenfeld } = await import('../src/world/lod.js');
const { hausfrontPflegeTest } = await import('../src/world/props.js');
let ok = 0, fehler = 0;
function pruefe(name: string, gut: boolean, info = '') {
  console.log('  ' + (gut ? '✓' : '✗') + ' ' + name + ' ' + info); gut ? ok++ : fehler++;
}
const boden: Aufsatzboden = { breiteMeter: 1000, tiefeMeter: 1000, hoeheAn: () => 0, tiefsteFlaeche: () => 0 };
const welt: Weltdaten = { bbox: [0, 0, 1, 1], aufloesung: 2, hoehen: [[0, 0], [0, 0]], hoeheMin: 0, hoeheMax: 0,
  biome: [['wiese', 'wiese'], ['wiese', 'wiese']], flaechen: [], linien: [], gebaeude: [], wege: [], marker: [], attribution: 'Testfixture' };
const material = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
const strahl = new THREE.Raycaster();
for (const grad of [0, 37]) {
  const prefix = grad + '°: ';
  const a = grad * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const punkte: [number, number][] = ([[-6, -4], [6, -4], [6, 4], [-6, 4], [-6, -4]] as [number, number][]).map(([u, v]) =>
    [0.5 - (200 + u * s + v * c) / 1000, 0.5 + (200 + u * c - v * s) / 1000]);
  const haus: Weltdaten['gebaeude'][number] = { punkte, ebenen: 2, art: 'house',
    fassade: { fensterachsen: { traufe: 3, giebel: 2 }, laube: 'keine', hochlaube: false,
      putz: '#ddddcc', holz: '#665544', laeden: '#335533', malerei: null, stufe: 0 } };
  const g = baueGebaeude(welt, boden, [haus], [[200, 200]])!;
  pruefe(prefix + 'Haus erzeugt', !!g);
  if (!g) continue;
  const p = g.getAttribute('position'), uv = g.getAttribute('raumUv'), r = g.getAttribute('rolle'), glut = g.getAttribute('glut');
  pruefe(prefix + 'Raumkoordinaten an jeder Ecke', !!uv && uv.itemSize === 3 && uv.count === p.count);
  if (!uv) { g.dispose(); continue; }
  let andereNull = true, glutNurGlas = true, endlich = true;
  for (let i = 0; i < p.count; i++) {
    if (r.getX(i) !== 5 && (uv.getX(i) !== 0 || uv.getY(i) !== 0 || uv.getZ(i) !== 0)) andereNull = false;
    if (r.getX(i) !== 5 && glut.getX(i) !== 0) glutNurGlas = false;
    if (![uv.getX(i), uv.getY(i), uv.getZ(i)].every(Number.isFinite)) endlich = false;
  }
  pruefe(prefix + 'Andere Bauteile ohne Raumdaten', andereNull);
  pruefe(prefix + 'Fensterglut nur auf Glas', glutNurGlas);
  pruefe(prefix + 'Raumdaten endlich', endlich);
  const mesh = new THREE.Mesh(g, material); mesh.updateMatrixWorld();
  let scheiben = 0, gueltigeScheiben = 0, freieVorhaenge = 0, obereScheiben = 0;
  const seeds = new Set<number>();
  for (let i = 0; i < p.count; i++) {
    if (r.getX(i) !== 5) continue;
    scheiben++;
    const seed = uv.getZ(i); seeds.add(seed);
    const ecken = new Set<string>();
    let gut = i + 5 < p.count && seed >= 0 && seed < 1;
    for (let j = 0; j < 6 && i + j < p.count; j++) {
      const u = uv.getX(i + j), v = uv.getY(i + j);
      gut &&= r.getX(i + j) === 5 && Math.abs(uv.getZ(i + j) - seed) < 1e-7
        && (Math.abs(u) < 1e-5 || Math.abs(u - 1) < 1e-5)
        && (Math.abs(v) < 1e-5 || Math.abs(v - 1) < 1e-5);
      ecken.add(Math.round(u) + ',' + Math.round(v));
    }
    if (gut && ecken.size === 4) gueltigeScheiben++;
    // Im OG muss ein Strahl durchs obere, seitliche Scheibenviertel Glas treffen.
    // Ein verbliebenes opakes Vorhangquad läge 3 mm davor. Keine Farbprüfung.
    const mitte = new THREE.Vector3();
    for (let j = 0; j < 6; j++) mitte.add(new THREE.Vector3().fromBufferAttribute(p, i + j));
    mitte.multiplyScalar(1 / 6);
    if (mitte.y > 4) {
      obereScheiben++;
      const normal = new THREE.Vector3().fromBufferAttribute(g.getAttribute('normal'), i).normalize();
      const rechts = new THREE.Vector3(normal.z, 0, -normal.x);
      const ziel = mitte.clone().addScaledVector(rechts, -0.9 * 0.25).add(new THREE.Vector3(0, 1.15 * 0.35, 0));
      strahl.set(ziel.clone().addScaledVector(normal, 0.5), normal.clone().negate());
      const treffer = strahl.intersectObject(mesh, false)[0];
      if (treffer && r.getX(treffer.face!.a) === 5 && Math.abs(treffer.distance - 0.5) < 1e-4) freieVorhaenge++;
    }
    i += 5;
  }
  pruefe(prefix + 'Zwei UV-Dreiecke und konstanter Seed je Fenster', scheiben === 20 && gueltigeScheiben === scheiben, gueltigeScheiben + '/' + scheiben);
  pruefe(prefix + 'Räume zwischen Fenstern verschieden', seeds.size > 10, String(seeds.size));
  pruefe(prefix + 'Kein opaker Vorhang vor oberen Scheiben', obereScheiben === 10 && freieVorhaenge === obereScheiben, freieVorhaenge + '/' + obereScheiben);
  const wieder = baueGebaeude(welt, boden, [haus], [[200, 200]])!;
  const wiederUv = wieder.getAttribute('raumUv');
  pruefe(prefix + 'Raumkoordinaten beim Neubau deterministisch', wiederUv.count === uv.count && Array.from(uv.array).every((wert, i) => wert === wiederUv.array[i]));
  wieder.dispose();

  const feld = baueHoehenfeld(welt);
  const satz = { wege: new Map(), baeche: new Map(), faelle: new Map(), teiche: new Map(), gebaeude: new Map(),
    gaerten: new Map([['0:0', [{ ecken: [[180, 180], [190, 180], [190, 188], [180, 188]] as [number, number][], achse: 0 }]]]) };
  const garten = baueGartenKachel(feld, satz, { ix: 0, iz: 0, mitte: [185, 184], radius: 10 }, 0)!;
  pruefe(prefix + 'Garten erzeugt', !!garten);
  if (garten) {
    const gUv = garten.getAttribute('raumUv');
    pruefe(prefix + 'Garten mit vollständigen neutralen Raumdaten', !!gUv && gUv.count === garten.getAttribute('position').count && gUv.itemSize === 3 && Array.from(gUv.array).every(w => w === 0));
    const zusammen = mergeGeometries([g, garten]);
    pruefe(prefix + 'Haus und Garten zusammenführbar', !!zusammen && zusammen.getAttribute('raumUv').count === p.count + garten.getAttribute('position').count);
    zusammen?.dispose(); garten.dispose();
  }
  g.dispose();
}
// Pflegezone um ein bekanntes Rechteck (x=200…212, z=200…208).
// Die Punkte prüfen reale senkrechte und euklidische Eckabstände, kein Nachbau
// der Raster-/Segmentimplementierung in props.ts.
const pflegeWelt: Weltdaten = { ...welt,
  biome: [['siedlung', 'siedlung'], ['siedlung', 'siedlung']],
  gebaeude: [{ art: 'house', ebenen: 2, punkte: [[200, 200], [212, 200], [212, 208], [200, 208], [200, 200]]
    .map(([x, z]) => [0.5 - z / 1000, 0.5 + x / 1000] as [number, number]) }] };
const pflege = hausfrontPflegeTest(pflegeWelt, boden);
pruefe('Pflegezone: 1 m neben gerader Hauskante', pflege(199, 204));
pruefe('Pflegezone: 2 m neben Hauskante bleibt Bewuchs', !pflege(198, 204));
pruefe('Pflegezone: 1,2/1,2 m neben Ecke außerhalb (Abstand 1,697 m)', !pflege(198.8, 198.8));
pruefe('Pflegezone: 1/1 m neben Ecke innerhalb (Abstand 1,414 m)', pflege(199, 199));
pruefe('Pflegezone: 1,59 m neben Kante innerhalb', pflege(198.41, 204));
pruefe('Pflegezone: 1,61 m neben Kante außerhalb', !pflege(198.39, 204));
const waldPflege = hausfrontPflegeTest({ ...pflegeWelt, biome: [['wald', 'wald'], ['wald', 'wald']] }, boden);
pruefe('Pflegezone: gleicher Abstand im Wald bleibt unberührt', !waldPflege(199, 204));
material.dispose();
console.log('\n' + ok + ' bestanden, ' + fehler + ' fehlgeschlagen');
if (fehler) process.exitCode = 1;
