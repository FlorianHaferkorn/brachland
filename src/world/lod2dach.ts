import { ShapeUtils, Vector2 } from 'three';
import type { Color } from 'three';
import { baueBruchholz } from './bruchholz.js';
import { mulberry } from './props.js';
import { imPolygon } from './osm.js';
import type { LoD2Koerper } from './osm.js';

type Punkt = [number, number, number];
type Lage = [x: number, z: number];
type Dreieck = [Punkt, Punkt, Punkt];
type Dachrolle = 'deckung' | 'untersicht' | 'stirn' | 'wand' | 'rinne' | 'sparren' | 'hohlraum';
type Zeichner = (a: Punkt, b: Punkt, c: Punkt, rolle: Dachrolle, farbe?: Color) => void;
type Dachkante = { a: Punkt; b: Punkt; gefaelle: Lage };
type Ueberstand = { kante: Dachkante; aussen: Lage; tiefe: number; laenge: number; rinne: boolean };
export type LoD2Dachbruch = { flaeche: number; radius: number; saat: number };

/** Dachhaut und Überstand teilen sich die Stärke und Materialrollen. */
const tiefer = ([x, y, z]: Punkt): Punkt => [x, y - .14, z];
const grund = ([x, , z]: Punkt): Lage => [x, z];

function dachgefaelle(dreiecke: Dreieck[]): Lage {
  let besteFlaeche = 0;
  let gefaelle: Lage = [0, 0];
  for (const [a, b, c] of dreiecke) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const flaeche = ux * vz - uz * vx;
    if (Math.abs(flaeche) <= besteFlaeche) continue;
    besteFlaeche = Math.abs(flaeche);
    gefaelle = [(uy * vz - vy * uz) / flaeche, (ux * vy - vx * uy) / flaeche];
  }
  return gefaelle;
}

function anWand([x, z]: Lage, ring: Lage[]): boolean {
  for (let i = 1; i < ring.length; i++) {
    const [ax, az] = ring[i - 1], [bx, bz] = ring[i];
    const dx = bx - ax, dz = bz - az, d2 = dx * dx + dz * dz;
    if (d2 === 0) continue;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / d2));
    if ((x - ax - dx * t) ** 2 + (z - az - dz * t) ** 2 < .065 ** 2) return true;
  }
  return false;
}

function ziehe(a: Punkt, b: Punkt, t: number): Punkt {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function schliesseDachkante(a: Punkt, b: Punkt, zeichne: Zeichner): void {
  zeichne(b, a, tiefer(a), 'stirn');
  zeichne(b, tiefer(a), tiefer(b), 'stirn');
}

/** Zackige Öffnung in der Dachhaut mit Abstand zu den vermessenen Firsten und Traufen. */
function schneideDachbruch(ring: Punkt[], dreiecke: Dreieck[], gefaelle: Lage, bruch: LoD2Dachbruch):
  { rand: Punkt[]; stuecke: Dreieck[]; mitte: Punkt; a: Lage; b: Lage; radius: number } | undefined {
  const dachgrund = ring.map(grund);
  const flaeche = ([p, q, r]: Dreieck) => Math.abs((q[0] - p[0]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[0] - p[0]));
  const gross = dreiecke.reduce((bestes, dreieck) => flaeche(dreieck) > flaeche(bestes) ? dreieck : bestes);
  const mitte = gross[0].map((_, i) => (gross[0][i] + gross[1][i] + gross[2][i]) / 3) as Punkt;
  const l = Math.hypot(...gefaelle);
  if (l < .06) return;
  const a: Lage = [-gefaelle[1] / l, gefaelle[0] / l], b: Lage = [gefaelle[0] / l, gefaelle[1] / l];
  const zufall = mulberry(bruch.saat);
  const formen = Array.from({ length: 9 }, (_, i) => {
    const phi = 2 * Math.PI * (i + zufall() * .27) / 9;
    const r = .70 + zufall() * .30;
    return [Math.cos(phi) * r, Math.sin(phi) * r * .78] as Lage;
  });
  const randPunkt = (u: number, v: number): Punkt => {
    const dx = a[0] * u + b[0] * v, dz = a[1] * u + b[1] * v;
    return [mitte[0] + dx, mitte[1] + gefaelle[0] * dx + gefaelle[1] * dz, mitte[2] + dz];
  };
  const passt = (p: Punkt) => {
    const [x, z] = grund(p);
    if (!imPolygon([x, z], dachgrund)) return false;
    return dachgrund.every(([ax, az], i) => {
      const [bx, bz] = dachgrund[(i + 1) % dachgrund.length];
      const dx = bx - ax, dz = bz - az, d2 = dx * dx + dz * dz;
      if (d2 < 1e-9) return true;
      const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / d2));
      return (x - ax - t * dx) ** 2 + (z - az - t * dz) ** 2 > .28 ** 2;
    });
  };
  for (let radius = bruch.radius; radius >= .70; radius *= .83) {
    const rand = formen.map(([u, v]) => randPunkt(u * radius, v * radius));
    if (!rand.every((p, i) => passt(p) && passt(ziehe(p, rand[(i + 1) % rand.length], .5)))) continue;
    const vp = ([x, , z]: Punkt) => new Vector2(x - mitte[0], z - mitte[2]);
    if (ShapeUtils.area(rand.map(vp)) < 0) rand.reverse();
    const punkte = [...ring, ...rand];
    const stuecke = ShapeUtils.triangulateShape(ring.map(vp), [rand.map(vp)]).map(([i, j, k]): Dreieck => {
      const [p, q, r] = [punkte[i], punkte[j], punkte[k]];
      return (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]) > 0 ? [p, q, r] : [p, r, q];
    });
    return { rand, stuecke, mitte, a, b, radius };
  }
}

function zeichneDachbruch(schnitt: NonNullable<ReturnType<typeof schneideDachbruch>>, zeichne: Zeichner, saat: number): void {
  const { rand, mitte, a, b, radius } = schnitt;
  const lochU = ([x, , z]: Punkt) => (x - mitte[0]) * a[0] + (z - mitte[2]) * a[1];
  const lochV = ([x, , z]: Punkt) => (x - mitte[0]) * b[0] + (z - mitte[2]) * b[1];
  const tief = ([x, y, z]: Punkt): Punkt => [x, y - 1.34 - .073 * Math.sin(x * 1.7 + z * 2.3), z];
  for (let i = 0; i < rand.length; i++) {
    const p = rand[i], q = rand[(i + 1) % rand.length];
    schliesseDachkante(p, q, zeichne);
    zeichne(tief(mitte), tief(q), tief(p), 'hohlraum');
    // Durch die fehlende Haut geht der Blick bis in den dunklen Innenraum.
    // Die eingefallene Decke hat seitlich noch Tiefe, auch am flachen Blickwinkel.
    zeichne(tiefer(q), tiefer(p), tief(p), 'hohlraum');
    zeichne(tiefer(q), tief(p), tief(q), 'hohlraum');
  }
  for (const [i, offset] of [-.46, .03, .41].entries()) {
    const u = offset * radius;
    const trifft = rand.flatMap((p, j) => {
      const q = rand[(j + 1) % rand.length], pu = lochU(p), qu = lochU(q);
      return (pu > u) !== (qu > u) ? [ziehe(p, q, (u - pu) / (qu - pu))] : [];
    }).sort((p,q) => lochV(p) - lochV(q));
    if (trifft.length < 2) continue;
    const p = trifft[0], q = trifft[trifft.length - 1];
    const enden = i === 1 ? [p, q] : [i === 0 ? p : q, ziehe(p, q, i === 0 ? .51 : .54)];
    baueBruchholz((p0, p1, p2, farbe) => zeichne(p0, p1, p2, 'sparren', farbe),
      [enden[0][0], enden[0][1] - .22, enden[0][2]], [enden[1][0], enden[1][1] - (i === 1 ? .22 : .52), enden[1][2]],
      .105, .125, saat + 71 * i, true, i !== 1);
  }
}

/** Nur Wandfluchten dürfen überstehen. First, Kehle und angeschlossene Teile bleiben geometrisch unangetastet. */
function baueTraufe(kanten: Iterable<Dachkante>, ring: Lage[], nachbarn: Lage[][], zeichne: Zeichner): void {
  const ueberstaende: Ueberstand[] = [];
  const anschluesse = new Map<string, Ueberstand[]>();
  const belegt = (p: Lage) => nachbarn.some(n => imPolygon(p, n) || anWand(p, n));
  for (const kante of kanten) {
    const { a, b, gefaelle } = kante;
    const dx = b[0] - a[0], dz = b[2] - a[2], laenge = Math.hypot(dx, dz);
    const mitte = ziehe(a, b, .5);
    if (laenge < .035 || ![a, mitte, b].every(p => anWand(grund(p), ring))) {
      schliesseDachkante(a, b, zeichne);
      continue;
    }
    const nx = -dz / laenge, nz = dx / laenge;
    const rinne = Math.abs(b[1] - a[1]) / laenge < .10 && gefaelle[0] * nx + gefaelle[1] * nz < -.08;
    const tiefe = Math.min(rinne ? .47 : .32, .10 + laenge * .42);
    const aussenpunkt = (p: Punkt, abstand: number): Lage => [p[0] + nx * abstand, p[2] + nz * abstand];
    const randprobe = [ziehe(a, b, .08), mitte, ziehe(a, b, .92)];
    if (imPolygon(aussenpunkt(mitte, .09), ring)
      || randprobe.some(p => belegt(aussenpunkt(p, .06)) || belegt(aussenpunkt(p, tiefe + (rinne ? .17 : 0))))) {
      schliesseDachkante(a, b, zeichne);
      continue;
    }
    const ueberstand: Ueberstand = { kante, aussen: [nx, nz], tiefe, laenge, rinne };
    ueberstaende.push(ueberstand);
    for (const p of [a, b]) {
      const id = p.join(',');
      const liste = anschluesse.get(id);
      if (liste) liste.push(ueberstand);
      else anschluesse.set(id, [ueberstand]);
    }
  }

  const ecken = new Map<string, Punkt>();
  for (const [id, anschluss] of anschluesse) {
    if (anschluss.length !== 2) continue;
    const [a, b] = anschluss;
    const p = a.kante.a.join(',') === id ? a.kante.a : a.kante.b;
    const [nx, nz] = a.aussen, [mx, mz] = b.aussen;
    const cos = nx * mx + nz * mz;
    // Gehrung mit begrenztem Ausleger, damit spitze Winkel keine Nasen bilden.
    if (cos < -.60) continue;
    const d = Math.min(a.tiefe, b.tiefe) / (1 + cos);
    const dx = (nx + mx) * d, dz = (nz + mz) * d;
    const punkt: Lage = [p[0] + dx, p[2] + dz];
    const versatz = ({ kante: { a, b }, laenge }: Ueberstand) =>
      Math.abs(dx * (b[0] - a[0]) + dz * (b[2] - a[2])) / laenge;
    // Bei kurzen Versprüngen würde die Gehrung bis hinter den nächsten
    // Knick reichen. Dort endet der Überstand mit einem schrägen Rücksprung.
    if (versatz(a) > a.laenge * .31 || versatz(b) > b.laenge * .31
      || imPolygon(punkt, ring) || belegt(punkt)) continue;
    const dy = ((a.kante.gefaelle[0] + b.kante.gefaelle[0]) * dx
      + (a.kante.gefaelle[1] + b.kante.gefaelle[1]) * dz) / 2;
    ecken.set(id, [p[0] + dx, p[1] + dy, p[2] + dz]);
  }

  for (const { kante: { a, b, gefaelle }, aussen: [nx, nz], tiefe, laenge, rinne } of ueberstaende) {
    const anfang = ecken.get(a.join(',')), ende = ecken.get(b.join(','));
    const ruecksprung = Math.min(.24, .62 / laenge);
    const wandA = anfang ? a : ziehe(a, b, ruecksprung);
    const wandB = ende ? b : ziehe(a, b, 1 - ruecksprung);
    const ausladung = ([x, y, z]: Punkt): Punkt => [x + nx * tiefe, y + (gefaelle[0] * nx + gefaelle[1] * nz) * tiefe, z + nz * tiefe];
    const lippeA = anfang ?? ausladung(wandA), lippeB = ende ?? ausladung(wandB);
    const haut = (p: Punkt, q: Punkt, r: Punkt) => {
      zeichne(p, q, r, 'deckung');
      zeichne(tiefer(p), tiefer(r), tiefer(q), 'untersicht');
    };
    haut(wandA, lippeA, lippeB);
    haut(wandA, lippeB, wandB);
    schliesseDachkante(lippeA, lippeB, zeichne);
    // Auslaufen am Stoß mit einem Nachbardach, ohne Überkreuzen der Dachhäute.
    if (!anfang) { haut(a, lippeA, wandA); schliesseDachkante(a, lippeA, zeichne); }
    if (!ende) { haut(wandB, lippeB, b); schliesseDachkante(lippeB, b, zeichne); }
    if (rinne && laenge >= 1.55) {
      const punkt = ([x, y, z]: Punkt, [abstand, hoehe]: readonly [number, number]): Punkt =>
        [x + nx * abstand, y + hoehe, z + nz * abstand];
      const profil = [[-.024, -.065], [.012, -.132], [.097, -.146], [.157, -.113], [.171, -.065]] as const;
      for (let i = 1; i < profil.length; i++) {
        const p = punkt(lippeA, profil[i - 1]), q = punkt(lippeB, profil[i - 1]);
        const r = punkt(lippeB, profil[i]), s = punkt(lippeA, profil[i]);
        zeichne(p, q, r, 'rinne');
        zeichne(p, r, s, 'rinne');
        zeichne(p, r, q, 'rinne');
        zeichne(p, s, r, 'rinne');
      }
    }
  }
}

/**
 * Der amtliche Dachkörper ersetzt die rechteckige Dachhülle. Nur der obere
 * Wandabschluss kommt aus LoD2, die Fassadendetails darunter aus dem Hausgenerator.
 */
export function baueLoD2Dach(
  koerper: LoD2Koerper, nachWelt: (lat: number, lon: number) => [number, number],
  sockel: number, traufe: number,
  zeichne: Zeichner,
  nachbargrundrisse?: readonly LoD2Koerper['grundriss'][],
  bruch?: LoD2Dachbruch,
): void {
  const punkt = ([lat, lon, y]: Punkt): Punkt => {
    const [x, z] = nachWelt(lat, lon);
    return [x, sockel + y, z];
  };
  const flaeche = (roh: Punkt[], aufDach: boolean) => {
    const gleich = (a: Punkt, b: Punkt) => a.every((wert, i) => wert === b[i]);
    const offen = roh.length && gleich(roh[0], roh[roh.length - 1]) ? roh.slice(0, -1) : roh;
    const ring = offen.filter((p, i) => !i || !gleich(p, offen[i - 1])).map(punkt);
    if (ring.length < 3) return;
    const spannweite = (achse: number) => {
      const werte = ring.map(p => p[achse]);
      return Math.max(...werte) - Math.min(...werte);
    };
    const waagerecht = aufDach || spannweite(0) >= spannweite(2) ? 0 : 2;
    const senkrecht = aufDach ? 2 : 1;
    const flach = ring.map(p => new Vector2(p[waagerecht] - ring[0][waagerecht], p[senkrecht] - ring[0][senkrecht]));
    const seite = aufDach ? -1 : Math.sign(ShapeUtils.area(flach));
    if (!seite) return;
    const dreiecke = ShapeUtils.triangulateShape(flach, []).map(([a, b, c]): Dreieck => {
      const u = flach[b].clone().sub(flach[a]), v = flach[c].clone().sub(flach[a]);
      return u.cross(v) * seite > 0 ? [ring[a], ring[b], ring[c]] : [ring[a], ring[c], ring[b]];
    });
    if (aufDach && Math.sign(ShapeUtils.area(flach)) !== seite) ring.reverse();
    return { ring, dreiecke };
  };

  const dachkanten = new Map<string, Dachkante>();
  for (const [i, roh] of koerper.dachflaechen.entries()) {
    const dach = flaeche(roh, true);
    if (!dach) continue;
    const gefaelle: Lage = nachbargrundrisse || bruch ? dachgefaelle(dach.dreiecke) : [0, 0];
    const schnitt = bruch?.flaeche === i && dach.dreiecke.length
      ? schneideDachbruch(dach.ring, dach.dreiecke, gefaelle, bruch) : undefined;
    for (const [a, b, c] of schnitt?.stuecke ?? dach.dreiecke) {
      zeichne(a, b, c, 'deckung');
      zeichne(tiefer(a), tiefer(c), tiefer(b), 'untersicht');
    }
    if (schnitt && bruch) zeichneDachbruch(schnitt, zeichne, bruch.saat);
    for (const [i, a] of dach.ring.entries()) {
      const b = dach.ring[(i + 1) % dach.ring.length];
      const schluessel = [a.join(','), b.join(',')].sort().join('|');
      if (!dachkanten.delete(schluessel)) dachkanten.set(schluessel, { a, b, gefaelle });
    }
  }
  const ringWelt = (ring: LoD2Koerper['grundriss']) => ring.map(([lat, lon]) => nachWelt(lat, lon));
  if (nachbargrundrisse) baueTraufe(dachkanten.values(), ringWelt(koerper.grundriss), nachbargrundrisse.map(ringWelt), zeichne);
  else for (const { a, b } of dachkanten.values()) schliesseDachkante(a, b, zeichne);

  // Jedes Dreieck separat auf Traufhöhe abschneiden. Auch ein Giebel
  // mit zwei getrennten Spitzen bleibt dabei eine geschlossene Fläche.
  for (const roh of koerper.wandabschluesse) {
    const wand = flaeche(roh, false);
    for (const dreieck of wand?.dreiecke ?? []) {
      const oberhalb: Punkt[] = [];
      for (const [i, a] of dreieck.entries()) {
        const b = dreieck[(i + 1) % dreieck.length];
        if (a[1] >= traufe) oberhalb.push(a);
        if ((a[1] < traufe && b[1] > traufe) || (a[1] > traufe && b[1] < traufe)) {
          const t = (traufe - a[1]) / (b[1] - a[1]);
          oberhalb.push([a[0] + (b[0] - a[0]) * t, traufe, a[2] + (b[2] - a[2]) * t]);
        }
      }
      for (let i = 1; i + 1 < oberhalb.length; i++) {
        const a = oberhalb[0], b = oberhalb[i], c = oberhalb[i + 1];
        const uy = b[1] - a[1], vy = c[1] - a[1];
        const nx = uy * (c[2] - a[2]) - vy * (b[2] - a[2]);
        const nz = vy * (b[0] - a[0]) - uy * (c[0] - a[0]);
        if (nx * nx + nz * nz > 1e-10) zeichne(a, b, c, 'wand');
      }
    }
  }
}
