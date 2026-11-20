import * as THREE from 'three';
import { nachMetern, REGIONEN } from '../data/inhalte.js';
import type { Strassenkulisse } from '../data/schema.js';
import { baueStrassenbewuchs } from './strassenbewuchs.js';
import { baueStrassenmobiliar } from './strassenmobiliar.js';
import type { Strassenmobiliar } from './strassenmobiliar.js';
import { hoeheAufFlaeche } from './lod.js';
import type { HoehenFeld } from './lod.js';
import { imPolygon } from './osm.js';
import type { Weltdaten } from './osm.js';
import { STRASSENPROFIL_AN, WESTANSCHLUSS_AN, WOHNWEGQUERSCHNITT_AN } from './echt.js';
import { baueStrassenquerschnitt, querschnittGrenzen } from './strassenquerschnitt.js';

type Ort = [number, number];

function zumWeg([x, z]: Ort, punkte: readonly Ort[]): Ort {
  let dx = 0, dz = 0, abstand = Infinity;
  for (let i = 1; i < punkte.length; i++) {
    const [ax, az] = punkte[i - 1], [bx, bz] = punkte[i];
    const ex = bx - ax, ez = bz - az, quadrat = ex * ex + ez * ez;
    if (quadrat <= 0) continue;
    const t = THREE.MathUtils.clamp(((x - ax) * ex + (z - az) * ez) / quadrat, 0, 1);
    const px = ax + ex * t - x, pz = az + ez * t - z;
    const q = px * px + pz * pz;
    if (q < abstand) { dx = px; dz = pz; abstand = q; }
  }
  return [dx, dz];
}

export function baueStrassenkulissen(welt: Weltdaten, feld: HoehenFeld, abschnitte: readonly Strassenkulisse[]) {
  const zuWelt = (ort: Ort): Ort => nachMetern(ort, welt.bbox);
  const wegNachId = new Map(welt.wege.flatMap(weg => weg.quelle ? [[weg.quelle.osmId, weg] as const] : []));
  const boden = (x: number, z: number) => hoeheAufFlaeche(feld, x, z);
  const wohnwegZugaenge = WESTANSCHLUSS_AN
    ? [...REGIONEN.values()].find(r => r.bbox.every((wert, i) => wert === welt.bbox[i]))?.hausnutzung
      ?.filter(nutzung => nutzung.zustand === 'instandgesetzt').map(nutzung => zuWelt(nutzung.strasse))
    : undefined;
  const grundrisse = welt.gebaeude.map(g => {
    const ring = g.punkte.map(zuWelt);
    const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
    return { ring, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  });
  return abschnitte.map(abschnitt => {
    const querschnitte: THREE.BufferGeometry[] = [];
    const wege = abschnitt.wege.flatMap(({ osmWeg, verfall, profil, wohnwegrand, querschnitt }) => {
      const weg = wegNachId.get(osmWeg);
      if (!weg) return [];
      const belag = weg.quelle?.oberflaeche;
      const punkte = weg.punkte.map(zuWelt);
      const vermessen = WOHNWEGQUERSCHNITT_AN ? querschnitt : undefined;
      if (vermessen) querschnitte.push(baueStrassenquerschnitt(punkte, boden, vermessen, weg.breite));
      return [{
        punkte,
        breite: (STRASSENPROFIL_AN ? profil?.breite : undefined) ?? weg.breite,
        versatz: STRASSENPROFIL_AN ? profil?.versatz : undefined,
        saat: osmWeg, verfall,
        wohnwegrand: WESTANSCHLUSS_AN && wohnwegrand,
        querschnitt: vermessen && querschnittGrenzen(vermessen),
        wohnwegZugaenge: WESTANSCHLUSS_AN && wohnwegrand ? wohnwegZugaenge : undefined,
        fahrbahnprofil: STRASSENPROFIL_AN,
        markierungen: STRASSENPROFIL_AN ? profil?.markierungen : undefined,
        gebundenerBelag: belag === 'asphalt' || belag === 'concrete',
      }];
    });
    const objekte = abschnitt.objekte.flatMap<Strassenmobiliar>(eintrag => {
      const weg = wegNachId.get(eintrag.osmWeg);
      if (!weg) return [];
      const [x, z] = zuWelt(eintrag.ort);
      if (eintrag.art === 'laterne') {
        const [dx, dz] = zumWeg([x, z], weg.punkte.map(zuWelt));
        return [{ art: 'laterne', x, z, richtung: THREE.MathUtils.radToDeg(Math.atan2(dx, -dz)), verfall: eintrag.verfall }];
      }
      const winkel = THREE.MathUtils.degToRad(eintrag.richtung);
      const profil = STRASSENPROFIL_AN ? abschnitt.wege.find(w => w.osmWeg === eintrag.osmWeg)?.profil : undefined;
      const rand = eintrag.achsenpunkt ? (profil?.breite ?? weg.breite) / 2 + (profil?.versatz ?? 0) + .65 : 0;
      return [{
        art: 'ortstafel', x: x - Math.cos(winkel) * rand, z: z - Math.sin(winkel) * rand,
        richtung: eintrag.richtung, text: eintrag.text, verfall: eintrag.verfall,
      }];
    });
    const gruppe = new THREE.Group();
    gruppe.name = 'Straßenkulisse';
    const grenzen = new THREE.Box3();
    for (const weg of wege) for (const [x, z] of weg.punkte) grenzen.expandByPoint(new THREE.Vector3(x, 0, z));
    for (const { x, z } of objekte) grenzen.expandByPoint(new THREE.Vector3(x, 0, z));
    grenzen.expandByScalar(8);
    const lokal = grundrisse.filter(g =>
      g.maxX >= grenzen.min.x && g.minX <= grenzen.max.x && g.maxZ >= grenzen.min.z && g.minZ <= grenzen.max.z);
    const frei = (x: number, z: number) =>
      feld.wasserTiefe(x, z) < .04 && !lokal.some(g =>
        x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ && imPolygon([x, z], g.ring));
    const bewuchs = baueStrassenbewuchs(wege, boden, frei);
    const mobiliar = baueStrassenmobiliar(objekte, boden);
    gruppe.add(bewuchs.gruppe, mobiliar.gruppe);
    const clay = querschnitte.length ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .94 }) : null;
    for (const geometrie of querschnitte) {
      const mesh = new THREE.Mesh(geometrie, clay!);
      mesh.name = 'Vermessener Straßenkörper';
      mesh.receiveShadow = true;
      gruppe.add(mesh);
    }
    gruppe.userData.strassen = { wege: wege.length, objekte: objekte.length, querschnitte: querschnitte.length };
    return {
      gruppe, grenzen,
      entsorge: () => {
        bewuchs.entsorge(); mobiliar.freigeben();
        for (const geometrie of querschnitte) geometrie.dispose();
        clay?.dispose();
      },
    };
  });
}
