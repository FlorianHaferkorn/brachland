#!/usr/bin/env node
/**
 * BRACHLAND — Archetyp-Rigs erzeugen
 *
 * ## Warum erzeugt statt besorgt
 *
 * `assets/rigs/quadruped.glb` stammt aus einem Fremdmodell (three.js-Beispielfuchs,
 * G-65). Das ging, hat aber eine CC-BY-Pflicht an alles gehängt, was daraus sein
 * Skelett erbt. Für die restlichen Bauformen dasselbe zu tun, hätte die Abhängigkeit
 * verdreifacht — für Dateien, deren Mesh `autorig.py` ohnehin wegwirft.
 *
 * Denn genau das tut es: Es lädt das Rig, **löscht dessen Mesh** und behält Skelett
 * und Animationen. Gebraucht wird hier also kein Modell, sondern ein Knochengerüst
 * mit brauchbaren Bewegungen. Das lässt sich rechnen.
 *
 * Das Mesh in diesen Dateien ist trotzdem nötig, aber nur als Formalie: Blender
 * legt beim glTF-Import nur dann ein Armature an, wenn die Datei einen `skin`
 * enthält — und ein `skin` braucht ein Mesh. Ein Quader je Knochen reicht.
 *
 * ## Was NICHT hier steht
 *
 * `quadruped_small` fehlt mit Absicht. `autorig.py` skaliert das Skelett an die
 * Bounding Box des Zielmeshes, je Achse einzeln; ein Murmeltier bekommt damit das
 * gestauchte Steinbock-Skelett, und das ist richtig, weil beide dieselbe Topologie
 * haben. Die Unterscheidung der beiden Bauformen ist eine **Größenangabe fürs
 * Spiel** (`RIG_HOEHE`), keine Aussage über Knochen. `pipeline.sh` bildet sie ab.
 *
 * Aufruf: node rigbau.mjs [ziel-ordner]
 */
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ZIEL = process.argv[2] ?? 'assets/rigs';

// --------------------------------------------------------------- Bauformen

/**
 * Ein Knochen: Name, Elternteil und die Lage seines Kopfes **relativ zum Eltern-
 * knochen**. Die Bindepose hat überall die Ruhedrehung — dadurch ist die inverse
 * Bindematrix eine reine Verschiebung, und das spart die halbe Matrixrechnerei.
 */
const BAUFORMEN = {
  /**
   * Schlange. Eine Kette, sonst nichts — und genau deshalb der Fall, in dem ein
   * gerechnetes Rig einem geliehenen überlegen ist: Schlangenbewegung IST eine
   * Sinuswelle, die durch den Körper läuft. Ein Vierbeiner-Skelett auf eine
   * Kreuzotter zu stauchen, ergäbe vier Beine im Bauch.
   */
  serpent: {
    hoehe: 0.22,
    dicke: 0.09,
    knochen: [
      { name: 'wurzel', eltern: null, versatz: [0, 0.05, 0.7] },
      ...Array.from({ length: 9 }, (_, i) => ({
        name: `wirbel_${String(i).padStart(2, '0')}`,
        eltern: i === 0 ? 'wurzel' : `wirbel_${String(i - 1).padStart(2, '0')}`,
        versatz: [0, 0, -0.16],
      })),
    ],
    // Welle durch den Körper: gleiche Amplitude, wandernde Phase.
    welle: { achse: 'y', amplitude: 0.42, jeGlied: -0.9 },
  },

  /**
   * Zweibeiniger Vogel. Aufrechte Wirbelsäule, zwei Beine, zwei Flügel, kein
   * Vorderlauf. Ein Vierbeiner-Skelett würde hier die Flügel als Vorderbeine
   * binden und einen Viertakt auf ein Tier legen, das im Zweitakt geht.
   */
  biped_bird: {
    hoehe: 0.85,
    dicke: 0.07,
    knochen: [
      { name: 'wurzel', eltern: null, versatz: [0, 0.42, 0] },
      { name: 'rumpf', eltern: 'wurzel', versatz: [0, 0.13, -0.02] },
      { name: 'hals', eltern: 'rumpf', versatz: [0, 0.13, -0.04] },
      { name: 'kopf', eltern: 'hals', versatz: [0, 0.10, -0.06] },
      { name: 'schwanz', eltern: 'wurzel', versatz: [0, 0.06, 0.20] },
      { name: 'schenkel_l', eltern: 'wurzel', versatz: [0.07, -0.04, 0] },
      { name: 'lauf_l', eltern: 'schenkel_l', versatz: [0, -0.18, 0.02] },
      { name: 'fuss_l', eltern: 'lauf_l', versatz: [0, -0.18, -0.05] },
      { name: 'schenkel_r', eltern: 'wurzel', versatz: [-0.07, -0.04, 0] },
      { name: 'lauf_r', eltern: 'schenkel_r', versatz: [0, -0.18, 0.02] },
      { name: 'fuss_r', eltern: 'lauf_r', versatz: [0, -0.18, -0.05] },
      { name: 'fluegel_l', eltern: 'rumpf', versatz: [0.09, 0.02, 0.02] },
      { name: 'schwinge_l', eltern: 'fluegel_l', versatz: [0.16, -0.02, 0.04] },
      { name: 'fluegel_r', eltern: 'rumpf', versatz: [-0.09, 0.02, 0.02] },
      { name: 'schwinge_r', eltern: 'fluegel_r', versatz: [-0.16, -0.02, 0.04] },
    ],
    schritt: {
      links: ['schenkel_l', 'lauf_l'], rechts: ['schenkel_r', 'lauf_r'],
      rumpf: 'rumpf', kopf: 'hals', schwanz: 'schwanz',
      fluegel: ['fluegel_l', 'fluegel_r'],
    },
  },
};

// ------------------------------------------------------------------ Hilfen

/** Quaternion aus Achse und Winkel. */
function quat(achse, winkel) {
  const h = winkel / 2, s = Math.sin(h);
  return [achse === 'x' ? s : 0, achse === 'y' ? s : 0, achse === 'z' ? s : 0, Math.cos(h)];
}

/** Weltposition jedes Knochens in der Bindepose — Versätze aufaddieren. */
function weltlagen(knochen) {
  const welt = new Map();
  for (const k of knochen) {
    const e = k.eltern ? welt.get(k.eltern) : [0, 0, 0];
    welt.set(k.name, [e[0] + k.versatz[0], e[1] + k.versatz[1], e[2] + k.versatz[2]]);
  }
  return welt;
}

/**
 * Ein Quader je Knochen, starr an ihn gebunden.
 *
 * Bewusst ohne weiche Übergänge: Diese Geometrie wird nie gezeigt. Sie existiert,
 * damit die Datei einen `skin` hat — sonst importiert Blender die Knochen als
 * einzelne Objekte statt als Armature, und `autorig.py` findet kein Skelett.
 */
function bauMesh(knochen, welt, dicke) {
  const pos = [], jnt = [], wgt = [], idx = [];
  const ECKEN = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
                 [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const FLAECHEN = [[0, 1, 2], [0, 2, 3], [5, 4, 7], [5, 7, 6], [4, 0, 3], [4, 3, 7],
                    [1, 5, 6], [1, 6, 2], [3, 2, 6], [3, 6, 7], [4, 5, 1], [4, 1, 0]];
  knochen.forEach((k, i) => {
    const [x, y, z] = welt.get(k.name);
    const basis = pos.length / 3;
    for (const [ex, ey, ez] of ECKEN) {
      pos.push(x + ex * dicke * 0.5, y + ey * dicke * 0.5, z + ez * dicke * 0.5);
      jnt.push(i, 0, 0, 0);
      wgt.push(1, 0, 0, 0);
    }
    for (const f of FLAECHEN) idx.push(basis + f[0], basis + f[1], basis + f[2]);
  });
  return {
    pos: new Float32Array(pos), jnt: new Uint16Array(jnt),
    wgt: new Float32Array(wgt), idx: new Uint32Array(idx),
  };
}

/**
 * Bewegungen. Drei Aktionen, weil `autorig.py` alles erbt, was da ist, und das
 * Spiel Leerlauf, Gehen und Rennen kennt.
 *
 * Die Kurven sind Sinus, nicht handgesetzte Schlüsselbilder. Das sieht man einem
 * Ergebnis an — es ist der Unterschied zwischen „bewegt sich" und „lebt". Als
 * Platzhalter ist es richtig; als Endstand wäre es faul, und das steht auch so
 * im Index.
 */
function bewegungen(form) {
  const BILDER = 24;
  const aktionen = [];
  for (const [name, tempo, weite] of [['Ruhe', 1, 0.25], ['Gehen', 1, 1], ['Rennen', 1, 1.7]]) {
    const dauer = name === 'Ruhe' ? 2.4 : name === 'Gehen' ? 0.9 : 0.55;
    const zeiten = Array.from({ length: BILDER + 1 }, (_, i) => (i / BILDER) * dauer);
    const spuren = new Map();
    const setze = (knochen, achse, f) => {
      spuren.set(knochen, zeiten.map((_, i) => quat(achse, f(i / BILDER))));
    };
    const ruhig = name === 'Ruhe';

    if (form.welle) {
      // Schlange: dieselbe Welle, je Glied um `jeGlied` phasenverschoben.
      form.knochen.forEach((k, i) => {
        if (k.eltern === null) return;
        setze(k.name, form.welle.achse, t =>
          Math.sin(t * Math.PI * 2 + i * form.welle.jeGlied)
          * form.welle.amplitude * weite * (ruhig ? 0.35 : 1));
      });
    } else {
      const s = form.schritt;
      // Vogel: Beine im Gegentakt, Rumpf nickt doppelt so schnell wie ein Schritt.
      s.links.forEach((b, n) => setze(b, 'x', t =>
        Math.sin(t * Math.PI * 2) * (n === 0 ? 0.55 : 0.35) * weite * (ruhig ? 0.06 : 1)));
      s.rechts.forEach((b, n) => setze(b, 'x', t =>
        Math.sin(t * Math.PI * 2 + Math.PI) * (n === 0 ? 0.55 : 0.35) * weite * (ruhig ? 0.06 : 1)));
      setze(s.rumpf, 'x', t => Math.sin(t * Math.PI * 4) * 0.06 * weite + (ruhig ? 0 : 0.12));
      setze(s.kopf, 'x', t => -Math.sin(t * Math.PI * 4) * 0.10 * weite + (ruhig ? 0.05 : -0.1));
      setze(s.schwanz, 'x', t => Math.sin(t * Math.PI * 2) * 0.08 * weite);
      // Im Leerlauf atmen die Flügel, im Lauf klappen sie an.
      s.fluegel.forEach((b, n) => setze(b, 'z', t =>
        (n === 0 ? 1 : -1) * (ruhig ? 0.10 + Math.sin(t * Math.PI * 2) * 0.05
                                    : 0.28 + Math.sin(t * Math.PI * 2) * 0.10 * weite)));
    }
    aktionen.push({ name, zeiten, spuren, tempo });
  }
  return aktionen;
}

// ------------------------------------------------------------------- Bauen

mkdirSync(ZIEL, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

for (const [id, form] of Object.entries(BAUFORMEN)) {
  const doc = new Document();
  const puffer = doc.createBuffer();
  const szene = doc.createScene(id);
  const welt = weltlagen(form.knochen);

  // Knochen als Knotenbaum
  const knoten = new Map();
  for (const k of form.knochen) {
    const n = doc.createNode(k.name).setTranslation(k.versatz);
    knoten.set(k.name, n);
    if (k.eltern) knoten.get(k.eltern).addChild(n); else szene.addChild(n);
  }

  // Inverse Bindematrizen: reine Verschiebung, weil die Bindepose ungedreht ist.
  const ibm = new Float32Array(form.knochen.length * 16);
  form.knochen.forEach((k, i) => {
    const [x, y, z] = welt.get(k.name);
    ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1], i * 16);
  });

  const haut = doc.createSkin(id)
    .setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(puffer));
  for (const k of form.knochen) haut.addJoint(knoten.get(k.name));

  const m = bauMesh(form.knochen, welt, form.dicke);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(m.pos).setBuffer(puffer))
    .setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(m.jnt).setBuffer(puffer))
    .setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(m.wgt).setBuffer(puffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(m.idx).setBuffer(puffer))
    .setMaterial(doc.createMaterial('rig').setBaseColorFactor([0.5, 0.55, 0.52, 1]));
  const mesh = doc.createMesh(`${id}_form`).addPrimitive(prim);
  szene.addChild(doc.createNode(`${id}_koerper`).setMesh(mesh).setSkin(haut));

  for (const a of bewegungen(form)) {
    const anim = doc.createAnimation(a.name);
    const eingang = doc.createAccessor()
      .setType('SCALAR').setArray(new Float32Array(a.zeiten)).setBuffer(puffer);
    for (const [knochenName, werte] of a.spuren) {
      const ausgang = doc.createAccessor().setType('VEC4')
        .setArray(new Float32Array(werte.flat())).setBuffer(puffer);
      const abtaster = doc.createAnimationSampler()
        .setInput(eingang).setOutput(ausgang).setInterpolation('LINEAR');
      anim.addSampler(abtaster);
      anim.addChannel(doc.createAnimationChannel()
        .setTargetNode(knoten.get(knochenName)).setTargetPath('rotation').setSampler(abtaster));
    }
  }

  const pfad = join(ZIEL, `${id}.glb`);
  await io.write(pfad, doc);
  const kb = (statSync(pfad).size / 1024).toFixed(1);
  console.log(`  ${id.padEnd(12)} ${String(form.knochen.length).padStart(2)} Knochen`
    + `  ${doc.getRoot().listAnimations().map(a => a.getName()).join('/')}`
    + `  ${kb.padStart(6)} KB  →  ${pfad}`);
}
