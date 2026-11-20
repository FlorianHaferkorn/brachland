import * as THREE from 'three';
import type { WohnwegQuerschnitt } from '../data/schema.js';

type Ort = readonly [number, number];
type Punkt = [number, number, number];
export type QuerschnittVerwitterung = NonNullable<WohnwegQuerschnitt['verwitterung']>;
export const WEG_UEBER_GRUND = .12;
export const BORD_ABSENKUNG = .025;
export const DECKE_UEBER_GRUND = .018;
export const ZUFAHRT_UEBER_GRUND = .009;
type Bodenraster = { ursprung: Ort; schritt: number };

function achsabschnitte(punkte: readonly Ort[]) {
  let meter = 0;
  return punkte.slice(1).flatMap(([x, z], i) => {
    const [ax, az] = punkte[i], dx = x - ax, dz = z - az;
    const laenge = Math.hypot(dx, dz);
    if (!laenge) return [];
    const von = meter;
    meter += laenge;
    return [{ von, bis: meter, ax, az, tx: dx / laenge, tz: dz / laenge }];
  });
}

/** Anschlussrampen zur vorhandenen Breite, in OSM-Stationsmetern. */
export function querschnittGrenzen(profil: WohnwegQuerschnitt): readonly [number, number] {
  return [Math.max(0, profil.stationen[0][0] - 8), profil.stationen.at(-1)![0] + 8];
}

/** Über die beiden 8-m-Anschlüsse zur bestehenden Fahrbahnhöhe auslaufen. */
function deckenAuftrag(s: number, profil: WohnwegQuerschnitt) {
  const [start, ende] = querschnittGrenzen(profil);
  const anschluss = THREE.MathUtils.smoothstep(Math.min(s - start, ende - s), 0, 8);
  return THREE.MathUtils.lerp(WEG_UEBER_GRUND, DECKE_UEBER_GRUND, anschluss);
}

export function querschnittKanten(profil: WohnwegQuerschnitt, breiteAlt: number) {
  const [start, ende] = querschnittGrenzen(profil);
  const mess = profil.stationen;
  const stationen = [
    ...(start < mess[0][0] ? [[start, -breiteAlt/2, breiteAlt/2]] : []),
    ...mess, [ende, -breiteAlt/2, breiteAlt/2],
  ];
  return (s: number): Ort => {
    const index = stationen.findIndex((zeile, i) => i > 0 && s <= zeile[0]);
    const a = stationen[(index < 0 ? stationen.length - 1 : index) - 1];
    const b = stationen[index < 0 ? stationen.length - 1 : index];
    const t = THREE.MathUtils.clamp((s - a[0]) / (b[0] - a[0]), 0, 1);
    return [THREE.MathUtils.lerp(a[1], b[1], t), THREE.MathUtils.lerp(a[2], b[2], t)];
  };
}

const gehoertZu = (s: number, seite: number, bereich: { von: number; bis: number; seite: number }) =>
  bereich.seite === seite && s >= bereich.von && s <= bereich.bis;

function randbreite(s: number, seite: number, profil: WohnwegQuerschnitt) {
  const gehweg = profil.gehwege.find(g => gehoertZu(s, seite, g));
  const zufahrt = profil.zufahrten.find(z => gehoertZu(s, seite, z));
  return Math.max(gehweg?.breite ?? 0, zufahrt?.tiefe ?? 0);
}

function ortAnAchse(achse: ReturnType<typeof achsabschnitte>[number], s: number, q: number): Ort {
  return [
    achse.ax + (s - achse.von) * achse.tx - q * achse.tz,
    achse.az + (s - achse.von) * achse.tz + q * achse.tx,
  ];
}

/** Abgetragene, bündige Erde und Bewuchs verwenden die äußere Profilkante. */
export function querschnittSaum(punkte: readonly Ort[], profil: WohnwegQuerschnitt, breite: number) {
  const abschnitte = achsabschnitte(punkte);
  const kantenAn = querschnittKanten(profil, breite);
  return (s: number, seite: -1 | 1, abstand: number, abFahrbahn = false): Ort | undefined => {
    const achse = abschnitte.find(a => s >= a.von && s <= a.bis);
    if (!achse) return undefined;
    const kant = kantenAn(s)[seite < 0 ? 0 : 1];
    const rand = abFahrbahn ? 0 : randbreite(s, seite, profil);
    return ortAnAchse(achse, s, kant + seite * (rand + abstand));
  };
}

function bordhoehe(s: number, seite: number, profil: WohnwegQuerschnitt) {
  const abstand = Math.min(.7, ...profil.zufahrten.filter(z => z.seite === seite)
    .map(z => Math.max(z.von - s, 0, s - z.bis)));
  return BORD_ABSENKUNG + .085 * THREE.MathUtils.smoothstep(abstand, 0, .7);
}

const grautoene = ['#565654', '#a6a59e', '#c4c0b6', '#85847f'].map(ton => new THREE.Color(ton));

/** Behält Farbe und Materialkoordinaten beim Schneiden einer Fläche am Höhenraster. */
function schneideEcke(umriss: readonly number[][], abstand: (ecke: number[]) => number) {
  const ergebnis: number[][] = [];
  for (let i = 0; i < umriss.length; i++) {
    const a = umriss[i], b = umriss[(i + 1) % umriss.length];
    const da = abstand(a), db = abstand(b);
    if (da >= 0) ergebnis.push(a);
    if (da * db < 0) ergebnis.push(a.map((wert, j) => THREE.MathUtils.lerp(wert, b[j], da / (da - db))));
  }
  return ergebnis;
}

/** Das Wegnetz teilt die Rasterkanten und Nebendiagonalen der jeweiligen LOD0-Bodenfläche. */
function aufBodenraster(
  netz: THREE.BufferGeometry, raster: Bodenraster, hoehe: (x: number, z: number) => number,
  stationen: readonly number[], start: number, ende: number,
): THREE.BufferGeometry {
  const position = netz.getAttribute('position');
  const attribute = Object.entries(netz.attributes).filter(([name]) => name !== 'position');
  const attributDaten = attribute.map((): number[] => []);
  const positionsDaten: number[] = [], indizes: number[] = [];
  const ecken = Array.from({ length: position.count }, (_, i) => {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    return [x, z, y - hoehe(x, z), y, stationen[i], ...attribute.flatMap(([, attr]) =>
      Array.from({ length: attr.itemSize }, (_, j) => attr.array[i * attr.itemSize + j]))];
  });
  const [ursprungX, ursprungZ] = raster.ursprung, meter = raster.schritt;
  const index = netz.index!;
  const sammle = (umriss: number[][]) => {
    if (umriss.length < 3) return;
    const i = positionsDaten.length / 3;
    for (const [x, z, auftrag, y, s, ...werte] of umriss) {
      const anteil = THREE.MathUtils.smoothstep(Math.min(s - start, ende - s), 0, 4);
      positionsDaten.push(x, THREE.MathUtils.lerp(y, hoehe(x, z) + auftrag, anteil), z);
      let offset = 0;
      attribute.forEach(([, a], j) => {
        attributDaten[j].push(...werte.slice(offset, offset + a.itemSize));
        offset += a.itemSize;
      });
    }
    for (let k = 1; k < umriss.length - 1; k++) {
      const a = i * 3, b = (i + k) * 3, c = (i + k + 1) * 3;
      const x1 = positionsDaten[b] - positionsDaten[a], x2 = positionsDaten[c] - positionsDaten[a];
      const y1 = positionsDaten[b + 1] - positionsDaten[a + 1], y2 = positionsDaten[c + 1] - positionsDaten[a + 1];
      const z1 = positionsDaten[b + 2] - positionsDaten[a + 2], z2 = positionsDaten[c + 2] - positionsDaten[a + 2];
      const flaeche2 = (y1 * z2 - z1 * y2) ** 2 + (z1 * x2 - x1 * z2) ** 2 + (x1 * y2 - y1 * x2) ** 2;
      if (flaeche2 > 1e-16) indizes.push(i, i + k, i + k + 1);
    }
  };
  const kachelX = (x: number) => Math.floor((x - ursprungX) / meter);
  const kachelZ = (z: number) => Math.floor((z - ursprungZ) / meter);
  for (let i = 0; i < index.count; i += 3) {
    const dreieck = [ecken[index.getX(i)], ecken[index.getX(i + 1)], ecken[index.getX(i + 2)]];
    const x = dreieck.map(e => e[0]), z = dreieck.map(e => e[1]);
    for (let ix = kachelX(Math.min(...x)); ix <= kachelX(Math.max(...x)); ix++) {
      const links = ursprungX + ix * meter;
      const spalte = schneideEcke(schneideEcke(dreieck, e => e[0] - links), e => links + meter - e[0]);
      for (let iz = kachelZ(Math.min(...z)); iz <= kachelZ(Math.max(...z)); iz++) {
        const oben = ursprungZ + iz * meter;
        const zelle = schneideEcke(schneideEcke(spalte, e => e[1] - oben), e => oben + meter - e[1]);
        const diagonale = ([px, pz]: readonly number[]) => meter - ((px - links) + (pz - oben));
        sammle(schneideEcke(zelle, diagonale));
        if (!zelle.every(e => Math.abs(diagonale(e)) < 1e-8)) sammle(schneideEcke(zelle, e => -diagonale(e)));
      }
    }
  }
  const ergebnis = new THREE.BufferGeometry();
  ergebnis.setAttribute('position', new THREE.Float32BufferAttribute(positionsDaten, 3));
  attribute.forEach(([name, attr], i) => ergebnis.setAttribute(name, new THREE.Float32BufferAttribute(attributDaten[i], attr.itemSize)));
  ergebnis.setIndex(indizes);
  ergebnis.computeVertexNormals();
  netz.dispose();
  return ergebnis;
}

/** Ein statischer Vertexfarben-Mesh für Fahrbahn, Gehweg, Bord und Zufahrten. */
export function baueStrassenquerschnitt(
  punkte: readonly Ort[], hoehe: (x: number, z: number) => number, profil: WohnwegQuerschnitt, breiteAlt: number,
  verwitterung?: QuerschnittVerwitterung,
  mitSchotterspuren = false,
  bodenraster?: Bodenraster,
): THREE.BufferGeometry {
  const abschnitte = achsabschnitte(punkte);
  const [start, ende] = querschnittGrenzen(profil);
  const kantenAn = querschnittKanten(profil, breiteAlt);
  const halte = [...profil.stationen.map(([s]) => s), ...profil.gehwege.flatMap(g => [g.von, g.bis]),
    ...profil.zufahrten.flatMap(z => [z.von - .7, z.von, z.bis, z.bis + .7])];
  const positionen: number[] = [], indizes: number[] = [], rollen: number[] = [], farben: number[] = [];
  const belagdaten: number[] = [];
  const spurdaten: number[] = [];
  const stationJeEcke: number[] = [];

  const viereck = (a: Punkt, b: Punkt, c: Punkt, d: Punkt, rolle: number, drehen = false) => {
    const i = positionen.length / 3;
    positionen.push(...a, ...b, ...c, ...d);
    const farbe = grautoene[rolle];
    for (let k = 0; k < 4; k++) { rollen.push(rolle); farben.push(farbe.r, farbe.g, farbe.b); }
    if (mitSchotterspuren) for (let k = 0; k < 16; k++) spurdaten.push(0);
    if (drehen) indizes.push(i, i+2, i+1, i, i+3, i+2);
    else indizes.push(i, i+1, i+2, i, i+2, i+3);
  };

  for (const achse of abschnitte) {
    const von = Math.max(start, achse.von), bis = Math.min(ende, achse.bis);
    if (bis <= von) continue;
    const teile = Math.ceil((bis - von) / 1.25);
    const stationen = [...new Set([...halte.filter(s => s > von && s < bis),
      ...Array.from({length: teile + 1}, (_, i) => i === teile ? bis : von + (bis - von)*i/teile)])].sort((a,b) => a-b);
    const punkt = (s: number, q: number, hub = 0, bodennah = false): Punkt => {
      const [x, z] = ortAnAchse(achse, s, q);
      const decke = bodenraster ? (bodennah ? ZUFAHRT_UEBER_GRUND : deckenAuftrag(s, profil)) : WEG_UEBER_GRUND;
      return [x, hoehe(x, z) + decke + hub, z];
    };
    const ersterVertex = positionen.length / 3;
    for (let i = 1; i < stationen.length; i++) {
      const s = stationen[i-1], t = stationen[i], mitte = (s+t)/2;
      if (t-s < 1e-5) continue;
      const a = kantenAn(s), b = kantenAn(t);
      viereck(punkt(s,a[0]),punkt(s,a[1]),punkt(t,b[1]),punkt(t,b[0]),0);
      for (const seite of [-1,1]) {
        const g = profil.gehwege.find(x => gehoertZu(mitte, seite, x));
        const z = profil.zufahrten.find(x => gehoertZu(mitte, seite, x));
        if (!g && !z) continue;
        const qa = a[seite < 0 ? 0 : 1], qb = b[seite < 0 ? 0 : 1];
        const ha = g ? bordhoehe(s,seite,profil) : 0, hb = g ? bordhoehe(t,seite,profil) : 0;
        const seitenband = (innere: number, aeussere: number, h: number, rolle: number) =>
          viereck(punkt(s,qa+seite*innere,ha*h),punkt(s,qa+seite*aeussere,ha*h),
            punkt(t,qb+seite*aeussere,hb*h),punkt(t,qb+seite*innere,hb*h),rolle,seite < 0);
        if (g) {
          viereck(punkt(s,qa),punkt(s,qa,ha),punkt(t,qb,hb),punkt(t,qb),2,seite < 0);
          const bord = Math.min(.12, g.breite/3);
          seitenband(0,bord,1,2);
          seitenband(bord,g.breite,1,z ? 3 : 1);
        }
        const ende = Math.max(z?.tiefe ?? 0, g?.breite ?? 0);
        const gehwegbreite = g?.breite ?? 0;
        if (z && ende > gehwegbreite) {
          viereck(punkt(s,qa+seite*gehwegbreite,ha),punkt(s,qa+seite*ende,0,true),
            punkt(t,qb+seite*ende,0,true),punkt(t,qb+seite*gehwegbreite,hb),3,seite < 0);
          if (mitSchotterspuren && z.schotterspuren) {
            // Quer zur Einfahrt läuft die OSM-Station. Die Spuren beginnen hinter dem Gehweg.
            const mitte = (z.von + z.bis) / 2, halb = (z.bis - z.von) / 2;
            const spur = z.schotterspuren.spurabstand / 2;
            spurdaten.splice(spurdaten.length - 16, 16,
              s - mitte, 0, spur, halb, s - mitte, 1, spur, halb,
              t - mitte, 1, spur, halb, t - mitte, 0, spur, halb);
          }
        }
        // Die äußere Stirn endet unter Gelände und schließt die Schicht am Hang.
        const xa = qa+seite*ende, xb = qb+seite*ende;
        const yA = g && ende === g.breite ? ha : 0, yB = g && ende === g.breite ? hb : 0;
        viereck(punkt(s,xa,-.17),punkt(t,xb,-.17),
          punkt(t,xb,yB,ende > gehwegbreite),punkt(s,xa,yA,ende > gehwegbreite),g && !z ? 1 : 3,seite < 0);
      }
    }
    if (verwitterung || bodenraster) {
      for (let i = ersterVertex * 3; i < positionen.length; i += 3) {
        const dx = positionen[i] - achse.ax, dz = positionen[i + 2] - achse.az;
        const s = achse.von + dx * achse.tx + dz * achse.tz;
        if (bodenraster) stationJeEcke.push(s);
        if (verwitterung) {
          const q = -dx * achse.tz + dz * achse.tx;
          const [links, rechts] = kantenAn(s);
          belagdaten.push(s, q - links, q - rechts, verwitterung.staerke);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positionen,3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(farben,3));
  geo.setAttribute('rolle', new THREE.Float32BufferAttribute(rollen,1));
  if (verwitterung) geo.setAttribute('querprofil', new THREE.Float32BufferAttribute(belagdaten, 4));
  if (mitSchotterspuren) geo.setAttribute('schotterspur', new THREE.Float32BufferAttribute(spurdaten, 4));
  geo.setIndex(indizes);
  if (bodenraster) return aufBodenraster(geo, bodenraster, hoehe, stationJeEcke, start, ende);
  geo.computeVertexNormals();
  return geo;
}

/** Gehweg und Zufahrten fließen in dieselbe freigehaltene Fläche ein. */
export function querschnittFreihaltung(punkte: readonly Ort[], profil: WohnwegQuerschnitt, breite: number) {
  const [von, bis] = querschnittGrenzen(profil);
  const kantenAn = querschnittKanten(profil, breite);
  const teile = achsabschnitte(punkte).filter(a => a.bis > von && a.von < bis);
  const ausladung = Math.max(breite/2, ...profil.stationen.flatMap(([, a, b]) => [Math.abs(a), Math.abs(b)]))
    + Math.max(0, ...profil.gehwege.map(g => g.breite), ...profil.zufahrten.map(z => z.tiefe)) + .3;
  const rahmen = new THREE.Box2();
  for (const a of teile) for (const s of [Math.max(von, a.von), Math.min(bis, a.bis)]) {
    const t = s - a.von;
    rahmen.expandByPoint(new THREE.Vector2(a.ax + t * a.tx, a.az + t * a.tz));
  }
  rahmen.expandByScalar(ausladung);
  const enthaelt = (x: number, z: number) => teile.some(a => {
    const dx = x-a.ax, dz = z-a.az, s = a.von+dx*a.tx+dz*a.tz, q = -dx*a.tz+dz*a.tx;
    if (s < Math.max(von,a.von) || s > Math.min(bis,a.bis) || Math.abs(q) > ausladung) return false;
    const [minus, plus] = kantenAn(s);
    const seite = q < (minus+plus)/2 ? -1 : 1;
    const aussen = randbreite(s, seite, profil) + .23;
    return seite < 0 ? q >= minus-aussen : q <= plus+aussen;
  });
  return { rahmen, enthaelt };
}

/** Der grobe Dichtefilter des Grasteppichs verwischt Kanten. Ein ortsfestes Raster hält sie scharf. */
export function baueQuerschnittGrasmaske(masken: readonly ReturnType<typeof querschnittFreihaltung>[]) {
  const rahmen = new THREE.Box2();
  for (const maske of masken) rahmen.union(maske.rahmen);
  if (rahmen.isEmpty()) return undefined;
  const { x: breite, y: tiefe } = rahmen.getSize(new THREE.Vector2());
  const spalten = Math.min(512, Math.ceil(breite / .2)), zeilen = Math.min(512, Math.ceil(tiefe / .2));
  const daten = new Uint8Array(spalten * zeilen);
  const enthaelt = (x: number, z: number) => x >= rahmen.min.x && x <= rahmen.max.x
    && z >= rahmen.min.y && z <= rahmen.max.y && masken.some(maske => maske.enthaelt(x, z));
  for (let iz = 0; iz < zeilen; iz++) for (let ix = 0; ix < spalten; ix++) {
    const x = rahmen.min.x + (ix + .5) * breite / spalten;
    const z = rahmen.min.y + (iz + .5) * tiefe / zeilen;
    if (enthaelt(x, z)) daten[iz * spalten + ix] = 255;
  }
  const textur = new THREE.DataTexture(daten, spalten, zeilen, THREE.RedFormat);
  textur.needsUpdate = true;
  return { enthaelt, textur, rahmen: new THREE.Vector4(rahmen.min.x, rahmen.min.y, 1 / breite, 1 / tiefe) };
}
export type QuerschnittGrasmaske = NonNullable<ReturnType<typeof baueQuerschnittGrasmaske>>;
