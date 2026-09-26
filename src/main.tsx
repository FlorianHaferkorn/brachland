import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { entpackeWelt, type Weltdaten } from './world/osm.js';
import { holeWeltdaten } from './world/weltladen.js';
import type { Fernland } from './world/fernland.js';
import { RegionsSzene, TAGESZEITEN, QUALITAET_STANDARD,
         type Messwerte, type Qualitaet, type Naehe } from './scenes/RegionsSzene.js';
import { Witterung } from './ui/Witterung.js';
import { Ausdaueranzeige } from './ui/Ausdaueranzeige.js';
import { Kampfanzeige, type KampfStand } from './ui/Kampfanzeige.js';
import { Stockanzeige } from './ui/Stockanzeige.js';
import { abgeschaltet } from './scenes/abschalter.js';
import type { Stoecke } from './spieler/steuerung.js';
import { neueAusdauer, type Ausdauer } from './spieler/ausdauer.js';
import type { Vorkommen } from './world/vorkommen.js';
import { KREATUREN, REGENTEN, GEGENSTAENDE, FRAGMENTE, ORTE, AUFTRAEGE, STREUNENDE,
         baueKaempfer, baueRegent, regentOrt, nachMetern, ausKaempferId } from './data/inhalte.js';
import { NARBE } from './data/schema.js';
import { Ortsfenster } from './ui/Ortsfenster.js';
import { beiGeber, type Taten } from './spiel/auftraege.js';
import { Menue } from './ui/Menue.js';
import { verschiebe } from './spiel/team.js';
import { besteReittier, warumNicht, type Reitkandidat } from './spiel/reiten.js';
import { gleiterFrei as gleiterOffen, GLEIT_VERHAELTNIS } from './spieler/gleiten.js';
import { reitsitz } from './world/kreaturgestalt.js';
import { erfahrungAusSieg, gutschrift, mutationBei } from './spiel/fortschritt.js';
import { beute } from './spiel/gegenstaende.js';
import { baueKreaturGeometrie, saatAusId } from './world/kreaturgestalt.js';
import { Kampfbildschirm, type KampfEnde } from './ui/BattleScreen.js';
import type { KaempferBild } from './ui/Kampfbuehne.js';
import type { Kaempfer, Team } from './engine/battle.js';
import { HeldEditor } from './ui/HeldEditor.js';
import type { GegnerArt } from './kampf/Kampfplatz.js';
import { setzeHeldWahl, STANDARD_HELD } from './spieler/held.js';
import { ladeStand, speichereStand, LEERER_STAND,
         type Spielstand, type TeamEintrag } from './spiel/spielstand.js';
import { benutzeBildrate } from './spiel/bildrate.js';

/**
 * Startkreatur.
 *
 * Das Grathorn ist das Wappentier der Region und die einzige Linie mit drei Stufen,
 * die von Anfang an im Œntal steht — es ist damit die Kreatur, an der ein Spieler
 * das Aufstufen zuerst sieht. Sobald es eine Anfangsszene gibt, wird das eine
 * Entscheidung des Spielers; bis dahin ist es gesetzt.
 */
const START_KREATUR = 'grathorn';
const TEAM_MAX = 6;
/** Regent der ersten Region. Später kommt der aus den Regionsdaten. */
const REGENT_ID = 'flussvater';
/**
 * Kampf Stufe 1 (ADR-0007): `?kampf=1` stellt zwei Übungsgegner vor den
 * Startpunkt. Hinter einem Schalter, bis Fassade und Gegnerbestand stehen.
 */
const KAMPF_PARAM = new URLSearchParams(location.search).get('kampf');
/**
 * Stufe 2 (D169–D171): `?kampf=1` stellt einen Keiler und einen Grathorn auf — zwei Baupläne,
 * zwei Telegrafe. `?kampf=keiler|grathorn|wolf|kapsel` stellt zwei derselben Art auf,
 * `?kampf=wolf,keiler` zwei verschiedene.
 */
const KAMPF_ARTEN = ['keiler', 'grathorn', 'wolf', 'fuchs', 'gams', 'wegelagerer', 'kapsel'] as const;
type KampfArt = typeof KAMPF_ARTEN[number];
const KAMPF_LISTE = (KAMPF_PARAM ?? '').split(',').filter((a): a is KampfArt => (KAMPF_ARTEN as readonly string[]).includes(a));
// `?kampf=rudel` (D172): drei Wölfe — sie stellen die Spielerin von mehreren Seiten.
const RUDEL = KAMPF_PARAM === 'rudel';
const KAMPFPLATZ = KAMPF_PARAM === '1' || RUDEL || KAMPF_LISTE.length > 0;
const KAMPF_AUFSTELLUNG: readonly KampfArt[] = RUDEL ? ['wolf', 'wolf', 'wolf']
  : KAMPF_LISTE.length === 1 ? [KAMPF_LISTE[0], KAMPF_LISTE[0]]
  : KAMPF_LISTE.length > 1 ? KAMPF_LISTE.slice(0, 3) : ['keiler', 'grathorn'];

/**
 * Absetzpunkt aus der Adresse: `?absetzen=x,z` in Weltmetern.
 *
 * Kein Cheat, sondern ein **Messwerkzeug**. Die Region ist 4 km breit, und in
 * SwiftShader läuft die Szene mit 2–5 Bildern je Sekunde: 23 s Rennen im
 * Messlauf ergaben 250 m. Alles, was nicht in der Startumgebung liegt — der
 * Kartenrand, die Siedlung, der Regentenort —, war damit nicht anschaubar, und
 * das ist die Ursache dafür, dass Fehler an diesen Stellen erst im Bild auf dem
 * Gerät auffielen. Drei Zeilen hier ersetzen jede Sonderbaustelle daneben.
 *
 * Ungültige Eingaben ergeben `null`, also den normalen Spielstand.
 */
const ABSETZEN: { ort: [number, number]; blick: number } | null = (() => {
  const roh = new URLSearchParams(location.search).get('absetzen');
  if (!roh) return null;
  const [x, z, grad] = roh.split(',').map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { ort: [x, z], blick: Number.isFinite(grad) ? (grad * Math.PI) / 180 : 0 };
})();

/** Mutation eines wilden Vorkommens — folgt aus seiner Stufe und der Länge der Linie. */
function mutationVon(v: Vorkommen): number {
  const k = KREATUREN.get(v.kreatur);
  return k ? mutationBei(v.stufe, k.stufen.length) : 0;
}

/**
 * Adressen der Messwerkzeuge (Bildtor, Kampfblick …): dort startet das Spiel ohne Editor mit der
 * Vorgabefigur. `?held=editor` erzwingt den Editor (D175).
 */
const MESSADRESSE = ['absetzen', 'kampf', 'stimmung', 'kamera', 'zeit', 'ansicht'].some(k => new URLSearchParams(location.search).has(k));
/** `?lager=1`: Wegelager auch bei Messadressen (Probe, D175). */
const LAGER_PROBE = new URLSearchParams(location.search).has('lager');
const HELD_EDITOR = new URLSearchParams(location.search).get('held') === 'editor';

/** Wegelager in der Welt (D175): an einem Ort festgemacht, Versatz in Metern (x, z). */
const WEGELAGER: {
  id: string; bei: string; versatz: [number, number]; aufstellung: readonly GegnerArt[]; meldung: string;
  /** Beute beim Sieg (D176): Gegenstand → Anzahl, landet im Beutel. */
  beute: Record<string, number>;
}[] = [
  { id: 'lager-bruchweg', bei: 'steinbruch-wart', versatz: [55, 40], aufstellung: ['wegelagerer', 'wolf'],
    meldung: 'Ein Mann mit Klinge tritt auf den Weg. Sein Hund knurrt.', beute: { kraeutersud: 1, harzverband: 1 } },
  { id: 'lager-hofgraben', bei: 'hof-tremmel', versatz: [-60, 35], aufstellung: ['wegelagerer', 'fuchs'],
    meldung: 'Hinter der Hecke steht einer, der auf jemanden wie dich gewartet hat.', beute: { koeder: 2, netzschlinge: 1 } },
  { id: 'lager-almsteig', bei: 'almhuette', versatz: [45, -50], aufstellung: ['wegelagerer', 'wegelagerer', 'wolf'],
    meldung: 'Zwei Klingen am Steig, und ein Wolf dazwischen. Das ist kein Zufall.', beute: { kraeutersud: 2, herzfunke: 1 } },
];

function App() {
  const [welt, setWelt] = useState<Weltdaten | null>(null);
  /** Kulisse jenseits der Region. `null` heisst „nicht da" und ist kein Fehler. */
  const [fernland, setFernland] = useState<Fernland | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  /**
   * Tageszeit, per Adresse setzbar: `?zeit=0.52`.
   *
   * Dieselbe Begründung wie beim Absetzpunkt (D86) und beim Abschalter: Wer
   * vier Stimmungen nebeneinander beurteilen will, braucht sie reproduzierbar
   * und in derselben Sekunde — ein Regler, den man von Hand schiebt, gibt vier
   * Bilder aus vier verschiedenen Zuständen. Ungültige Werte fallen still auf
   * den Standard zurück; ein Tippfehler soll die Szene nicht anhalten.
   */
  const [tageszeit, setTageszeit] = useState(() => {
    const roh = Number(new URLSearchParams(location.search).get('zeit'));
    return Number.isFinite(roh) && roh >= 0 && roh < 1 ? roh : 0.26;
  });
  const [messung, setMessung] = useState<Messwerte | null>(null);
  const [qualitaet, setQualitaet] = useState<Qualitaet>(QUALITAET_STANDARD);
  const [schalterOffen, setSchalterOffen] = useState(false);
  // Läuft immer — auch im Kampf, wenn die Szene steht. Der Vergleich beider Zahlen
  // sagt, ob die Grenze in der Szene liegt oder im Gerät.
  const seite = benutzeBildrate();

  const [stand, setStand] = useState<Spielstand | null>(null);
  const [team, setTeam] = useState<Kaempfer[]>([]);
  const [begegnung, setBegegnung] = useState<{ v: Vorkommen; gegner: Kaempfer } | null>(null);
  const [regentKampf, setRegentKampf] = useState<Kaempfer | null>(null);
  const [regentNah, setRegentNah] = useState(false);
  /** ID des Ortes, an dem man gerade steht — Zuflucht oder Bewohner. */
  const [ortNah, setOrtNah] = useState<string | null>(null);
  /** Offenes Ortsfenster. Getrennt von `ortNah`: Nähe ist kein Grund, etwas aufzumachen. */
  const [ortOffen, setOrtOffen] = useState<string | null>(null);
  /** Sitzt der Spieler auf? Nicht im Spielstand — beim Laden steht man wieder am Boden. */
  const [imSattel, setImSattel] = useState(false);
  /** Menü offen? Nicht im Spielstand — ein Spiel startet nie im Menü. */
  const [menueOffen, setMenueOffen] = useState(false);
  /** Charakter-Editor aus dem Menü heraus geöffnet (D175). */
  const [editorOffen, setEditorOffen] = useState(false);
  const [fragment, setFragment] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const spielerRef = useRef<THREE.Object3D>(null);
  const naehe = useRef<Naehe>({ abstand: Infinity, winkel: 0, kreatur: '' });
  // Ausdauer liegt hier und nicht in der Szene, weil beide sie brauchen: die Szene
  // zum Zehren, der Balken zum Anzeigen. Nicht im Spielstand — sie ist nach jeder
  // Pause wieder voll und wäre gespeichert nur eine Zahl, die immer 100 ist.
  const ausdauer = useRef<Ausdauer>(neueAusdauer());
  /** Was gerade unter den Daumen liegt. Nur die Anzeige liest das. */
  const stoecke = useRef<Stoecke>({ links: null, rechts: null });
  /** Stand des Echtzeitkampfs für die Anzeige. Nur mit `?kampf=1` belegt. */
  const kampfStand = useRef<KampfStand | null>(null);
  /** Erfahrung je Teamplatz. Parallel zum Team, weil `Kaempfer` sie nicht kennt. */
  const erfahrungRef = useRef<number[]>([]);

  useEffect(() => {
    // Nicht `fetch`: `holeWeltdaten` legt die Datei selbst in die Cache-API und
    // holt sie beim zweiten Mal von dort. Der Service-Worker-Precache trägt die
    // Weltdaten seit D82 nicht mehr — sie gingen sonst beim ersten Besuch
    // zweimal über die Leitung (G-92), und eine Laufzeitregel greift hier nicht,
    // weil diese Zeile läuft, bevor ein Service Worker die Seite kontrolliert.
    holeWeltdaten('/world/oental.json')
      .then(d => setWelt(entpackeWelt((d as { welt: unknown }).welt as never)))
      .catch(e => setFehler(String(e)));
  }, []);

  // Die Kulisse jenseits der Region. Eigener Ladevorgang und **ohne** `catch` in
  // den Fehlerzustand: 39 KB Bergrelief sind schön, aber kein Spielinhalt. Fehlt
  // die Datei, sieht der Rand aus wie vor D85, statt dass das Spiel nicht startet.
  useEffect(() => {
    holeWeltdaten('/world/oental-fern.json')
      .then(d => setFernland(d as Fernland))
      .catch(() => setFernland(null));
  }, []);

  /**
   * Rückmeldung an der Regionsgrenze.
   *
   * Der Aufruf kommt aus der Bildschleife, also bis zu 60-mal je Sekunde, solange
   * man gegen die Kante drückt. Ein `setHinweis` je Bild wäre ein Rerender je Bild.
   * Entprellt wird nicht über ein festes Intervall, sondern über die **Lücke**:
   * Liegt der letzte Anstoss mehr als zwei Sekunden zurück, ist man zwischendurch
   * weggewesen — nur das ist eine neue Ankunft am Rand und nur das meldet.
   */
  const randZuletzt = useRef(0);
  const meldeRand = useCallback(() => {
    const jetzt = performance.now();
    const neuAngekommen = jetzt - randZuletzt.current > 2000;
    randZuletzt.current = jetzt;
    if (neuAngekommen) setHinweis('Hier endet das Œntal. Weiter kommt ihr nicht.');
  }, []);

  // Spielstand laden, sonst neu anfangen. Beides ergibt am Ende ein Team.
  useEffect(() => {
    let abgebrochen = false;
    ladeStand().then(geladen => {
      if (abgebrochen) return;
      const s = geladen ?? {
        ...LEERER_STAND,
        team: [{ kreatur: START_KREATUR, stufe: 3, erfahrung: 0, kp: 0 }],
      };
      setStand(s);
      // D175: Figur aus dem Stand; bei Messadressen die Vorgabe, damit kein Editor den Lauf anhält.
      if (s.held) setzeHeldWahl(s.held);
      else if (MESSADRESSE) setzeHeldWahl(STANDARD_HELD);
      erfahrungRef.current = s.team.map(e => e.erfahrung ?? 0);
      setTeam(s.team.map(e => {
        const k = baueKaempfer(e.kreatur, e.stufe);
        if (e.kp > 0) k.kp = Math.min(e.kp, k.maxKp);
        return k;
      }));
    });
    return () => { abgebrochen = true; };
  }, []);

  // Silhouetten einmal je Kreatur — 19 Geometrien statt einer je Vorkommen.
  const gestalten = useMemo(() => {
    const karte = new Map<string, THREE.BufferGeometry>();
    // Je Kreatur eine Gestalt **je Mutation**: Der Pilzfächer wächst mit, und genau
    // daran soll man auf Entfernung sehen, wie weit eine Kreatur ist.
    for (const k of KREATUREN.values())
      for (let m = 0; m < k.stufen.length; m++)
        karte.set(`${k.id}:${m}`,
          baueKreaturGeometrie(k.basisRig, k.elemente, m, k.ursprung, saatAusId(k.id)));
    return karte;
  }, []);
  const gestalt = useCallback((id: string, mutation = 0) =>
    gestalten.get(`${id}:${mutation}`) ?? gestalten.get(`${id}:0`)
    ?? gestalten.values().next().value!,
    [gestalten],
  );

  /**
   * Aussehen je Kämpfer-ID für die Kampfbühne.
   *
   * Die Kämpfer-ID der Engine ist `<kreatur>-s<stufe>` (siehe `baueKaempfer`). Aus
   * ihr lässt sich die Kreatur zurückgewinnen — die Engine selbst kennt weder
   * Bauform noch Element-Optik und soll es auch nicht.
   */
  /**
   * Narbe je Kämpfer-ID.
   *
   * Sie hängt an der **Herkunft** (`NARBE` im Schema), und die kennt nur der Inhalt.
   * Die Engine bekommt sie als Funktion herein, damit sie weiter nichts über
   * Kreaturdaten wissen muss.
   */
  const narbeFuer = useCallback((kaempferId: string) => {
    const a = ausKaempferId(kaempferId);
    const k = KREATUREN.get(a.kreatur);
    return k ? NARBE[k.ursprung] : undefined;
  }, []);

  const bild = useCallback((kaempferId: string): KaempferBild | null => {
    const a = ausKaempferId(kaempferId);
    const k = KREATUREN.get(a.kreatur);
    if (k) return { basisRig: k.basisRig, elemente: [...k.elemente], stufe: a.mutation,
                    ursprung: k.ursprung, kreaturId: k.id };
    const r = REGENTEN.get(a.kreatur);
    // Der Regent trägt seine Phasenelemente — im Kampfbild wechselt damit die Farbe,
    // wenn er die Phase wechselt. Das ist die einzige Warnung, die der Spieler bekommt.
    // Herkunft `verwachsener`: Ein Regent ist ortsgebunden und massiv, das ist genau
    // die Bauweise, die das Blatt für Verwachsene beschreibt.
    return r ? { basisRig: 'serpent', elemente: [...r.phasen[0].elemente], stufe: 2,
                 ursprung: 'verwachsener' as const, kreaturId: r.id } : null;
  }, []);

  /**
   * Der Regent steht an einem festen Ort. Umrechnung von lat/lon in Meter braucht
   * die Ausdehnung der Region — die kommt aus derselben Formel wie das Terrain.
   */
  const regent = useMemo(() => {
    if (!welt) return undefined;
    const ort = regentOrt(REGENT_ID, welt.bbox);
    const r = REGENTEN.get(REGENT_ID);
    if (!ort || !r) return undefined;
    // Der Flussvater ist ein Riesenwels — die Schlangenform kommt dem am nächsten.
    return { ort, gestalt: baueKreaturGeometrie('serpent', r.phasen[0].elemente, 2,
                                                'verwachsener', saatAusId(r.id)) };
  }, [welt]);

  /**
   * Fundstellen in Weltkoordinaten. Dieselbe Umrechnung wie beim Regenten — sie
   * hängt an der Ausdehnung der Region, nicht am Inhalt.
   */
  const fundstellen = useMemo(
    () => (welt ? [...FRAGMENTE.values()].map(f => ({ id: f.id, ort: nachMetern(f.ort, welt.bbox) })) : []),
    [welt],
  );

  /**
   * Zufluchten und Bewohner in Weltkoordinaten.
   *
   * Beide sind dasselbe für die Szene: ein Punkt mit einer Marke und einem Radius.
   * Was beim Betreten passiert, entscheidet `main`, nicht die Szene — die kennt
   * weder Heilung noch Aufträge und soll es nicht.
   */
  const ortsmarken = useMemo(
    () => (welt
      ? [...ORTE.values()].map(o => ({ id: o.id, art: o.art, ort: nachMetern(o.ort, welt.bbox), figur: o.figur, blick: o.blick, gang: o.gang, farben: o.farben }))
      : []),
    [welt],
  );

  /**
   * Wegelager (D175): Echtzeitkämpfe in der Welt, nicht nur auf dem Übungsplatz. Wer näher als
   * 22 m kommt, wird gestellt; ein Sieg steht im Stand (`besiegt`), das Lager bleibt dann leer.
   * Eine Niederlage kostet nichts ausser dem Weg zurück — der Echtzeitkampf hat noch keine Folgen.
   */
  const lager = useMemo(() => (welt ? WEGELAGER.flatMap(l => {
    const o = ORTE.get(l.bei);
    if (!o) return [];
    const [x, z] = nachMetern(o.ort, welt.bbox);
    return [{ ...l, x: x + l.versatz[0], z: z + l.versatz[1] }];
  }) : []), [welt]);
  const [weltKampf, setWeltKampf] = useState<{ id: string; aufstellung: readonly GegnerArt[]; beute: Record<string, number> } | null>(null);
  useEffect(() => {
    if (KAMPFPLATZ || (MESSADRESSE && !LAGER_PROBE) || !stand) return;
    const id = setInterval(() => {
      const p = spielerRef.current?.position;
      if (!p || weltKampf) return;
      for (const l of lager) {
        const d = Math.hypot(p.x - l.x, p.z - l.z);
        // Nach einer Niederlage erst wieder, wenn man weg war (40 m) — sonst ginge es endlos weiter.
        if (lagerRuhe.current.has(l.id)) { if (d > 40) lagerRuhe.current.delete(l.id); continue; }
        if (stand.besiegt.includes(l.id) || d > 22) continue;
        setWeltKampf({ id: l.id, aufstellung: l.aufstellung, beute: l.beute });
        setHinweis(l.meldung);
        break;
      }
    }, 500);
    return () => clearInterval(id);
  }, [lager, stand, weltKampf]);
  const lagerRuhe = useRef(new Set<string>());
  const weltKampfRef = useRef(weltKampf);
  weltKampfRef.current = weltKampf;
  const kampfVorbei = useCallback((sieg: boolean) => {
    // Aus einer Ref gelesen, nicht im Updater: StrictMode ruft Updater doppelt — Beute und
    // `besiegt` kämen sonst zweimal in den Stand.
    const alt = weltKampfRef.current;
    setWeltKampf(null);
    if (!alt) return;
    if (!sieg) { lagerRuhe.current.add(alt.id); setHinweis('Zurückgeschlagen — sie warten noch.'); return; }
    setStand(st => {
      if (!st || st.besiegt.includes(alt.id)) return st;
      const beutel = { ...st.beutel };
      for (const [g, n] of Object.entries(alt.beute)) beutel[g] = (beutel[g] ?? 0) + n;
      const neu = { ...st, besiegt: [...st.besiegt, alt.id], beutel };
      void speichereStand(neu);
      return neu;
    });
    const liste = Object.entries(alt.beute).map(([g, n]) => `${GEGENSTAENDE.get(g)?.name ?? g} ×${n}`).join(', ');
    setHinweis(`Das Lager ist still. Du nimmst: ${liste}.`);
  }, []);

  /**
   * Das Team als Reitkandidaten — Bauform und Mutation je Platz.
   *
   * `Kaempfer` kennt beides nicht: Er weiß seine ID und seine Werte. Bauform und
   * Mutation stehen im Inhalt bzw. lassen sich aus der ID zurückrechnen.
   */
  const kandidaten = useMemo<Reitkandidat[]>(() => team.map((k, platz) => {
    const a = ausKaempferId(k.id);
    return {
      platz, kreatur: a.kreatur, name: k.name,
      basisRig: KREATUREN.get(a.kreatur)?.basisRig ?? '',
      mutation: a.mutation,
    };
  }), [team]);

  const reittierKandidat = useMemo(() => besteReittier(kandidaten), [kandidaten]);

  /**
   * Silhouette und Widerristhöhe des Reittiers.
   *
   * Die Höhe kommt aus `RIG_HOEHE` mal derselben Mutationsskalierung, die auch die
   * Kreaturen in der Welt benutzen — sonst sitzt der Reiter in der Luft oder im Tier.
   */
  const reittier = useMemo(() => {
    if (!imSattel || !reittierKandidat) return null;
    const skala = 1 + reittierKandidat.mutation * 0.2;
    const geo = gestalt(reittierKandidat.kreatur, reittierKandidat.mutation).clone();
    geo.scale(skala, skala, skala);
    // Sitz aus der Geometrie lesen, nicht aus einer Konstanten: `RIG_HOEHE`
    // stand auf 1, die Silhouette ist bei Mutation 2 gemessen 2,28 m hoch und
    // liegt waagerecht versetzt. Der Reiter stand damit neben seinem Tier.
    const sitz = reitsitz(geo);
    geo.translate(sitz.versatzX, 0, sitz.versatzZ);
    // Art und Stufe dazu (D145): Die Szene laedt damit das Modell; Silhouette
    // und Sitzhoehe bleiben der Rueckfall fuer Arten ohne Datei.
    return { geometrie: geo, hoehe: sitz.hoehe, kreatur: reittierKandidat.kreatur, mutation: reittierKandidat.mutation };
  }, [imSattel, reittierKandidat, gestalt]);

  // Wer sein Reittier verliert (Tausch, Niederlage), sitzt nicht weiter auf nichts.
  useEffect(() => { if (!reittierKandidat) setImSattel(false); }, [reittierKandidat]);

  const gelesen = useMemo(() => new Set(stand?.fragmente ?? []), [stand]);

  /** Ein Fundstück lesen: einmalig, sofort gespeichert, sichtbar bis zum Wegtippen. */
  const findeFragment = useCallback((id: string) => {
    setStand(alt => {
      if (!alt || alt.fragmente.includes(id)) return alt;
      const neu = { ...alt, fragmente: [...alt.fragmente, id] };
      void speichereStand(neu);
      return neu;
    });
    setFragment(id);
  }, []);

  const verbraucht = useMemo(
    () => new Set([...(stand?.gefangen ?? []), ...(stand?.besiegt ?? [])]),
    [stand],
  );

  const sichere = useCallback((aenderung: Partial<Spielstand>, teamJetzt: Kaempfer[]) => {
    setStand(alt => {
      if (!alt) return alt;
      const p = spielerRef.current?.position;
      const neu: Spielstand = {
        ...alt,
        ...aenderung,
        position: p ? [p.x, p.z] : alt.position,
        team: teamJetzt.map<TeamEintrag>((k, i) => {
          const a = ausKaempferId(k.id);
          return {
            kreatur: a.kreatur,
            stufe: a.stufe,
            // Erfahrung liegt neben dem Kämpfer, nicht in ihm: Die Engine kennt
            // keinen Fortschritt und soll ihn auch nicht kennen.
            erfahrung: erfahrungRef.current[i] ?? 0,
            kp: Math.max(0, k.kp),
          };
        }),
      };
      void speichereStand(neu);
      return neu;
    });
  }, []);

  /**
   * Ort aufmachen — und ihn dabei als besucht vermerken.
   *
   * Die Karte zeichnet nur besuchte Orte ein (`spielstand.orte`). Der Vermerk
   * hängt am **Aufmachen** und nicht an der Nähe: Vorbeilaufen ist kein Besuch,
   * und eine Karte, die sich beim Durchqueren von selbst füllt, nimmt dem Finden
   * seinen Wert.
   */
  const oeffneOrt = useCallback((id: string) => {
    setOrtOffen(id);
    setStand(alt => {
      if (!alt || alt.orte.includes(id)) return alt;
      const neu = { ...alt, orte: [...alt.orte, id] };
      void speichereStand(neu);
      return neu;
    });
  }, []);

  /**
   * Verfolgtes Auftragsziel für die Karte und die Peilung.
   *
   * Genommen wird der **erste angenommene** Auftrag mit einem Ziel, das einen Ort
   * in der Welt hat — heute sind das `finde` (Fundstück) und `regent`. `besiege`
   * und `fange` bekommen keine Marke: Kreaturen stehen nicht still, und eine
   * Marke, die ins Leere zeigt, ist schlimmer als keine.
   */
  const auftragsziel = useMemo(() => {
    if (!stand || !welt) return undefined;
    for (const a of AUFTRAEGE) {
      if (stand.auftraege[a.id] !== 'angenommen') continue;
      if (a.ziel.art === 'finde') {
        const f = FRAGMENTE.get(a.ziel.fragment);
        if (!f) continue;
        const [x, z] = nachMetern(f.ort, welt.bbox);
        return { x, z, name: a.titel };
      }
      if (a.ziel.art === 'regent') {
        const o = regentOrt(a.ziel.regent, welt.bbox);
        if (!o) continue;
        return { x: o[0], z: o[1], name: a.titel };
      }
    }
    return undefined;
  }, [stand, welt]);

  const verbrauche = useCallback((id: string) => {
    setStand(alt => {
      if (!alt) return alt;
      const beutel = { ...alt.beutel, [id]: Math.max(0, (alt.beutel[id] ?? 0) - 1) };
      const neu = { ...alt, beutel };
      void speichereStand(neu);
      return neu;
    });
  }, []);

  /**
   * Teamreihenfolge ändern.
   *
   * **Beide** Listen müssen dieselbe Bewegung machen: das Team und `erfahrungRef`,
   * das daneben liegt, weil die Engine keinen Fortschritt kennt. Getrennt bewegt,
   * trüge nach dem Umsortieren die falsche Kreatur die falsche Erfahrung — und
   * man sähe es erst beim nächsten Stufenaufstieg. Deshalb dieselbe Funktion für
   * beide (`spiel/team.ts`).
   */
  const ordneTeam = useCallback((neu: Kaempfer[], [von, nach]: [number, number]) => {
    erfahrungRef.current = verschiebe(erfahrungRef.current, von, nach);
    setTeam(neu);
    sichere({}, neu);
  }, [sichere]);

  /** Nach einer Gegenstandswirkung ausserhalb des Kampfes: KP festhalten. */
  const sichereTeam = useCallback(() => {
    setTeam(t => {
      const kopie = [...t];
      sichere({}, kopie);
      return kopie;
    });
  }, [sichere]);

  const beginneKampf = useCallback((v: Vorkommen) => {
    setBegegnung({ v, gegner: baueKaempfer(v.kreatur, v.stufe) });
  }, []);

  const beendeKampf = useCallback((ende: KampfEnde) => {
    const v = begegnung?.v;
    setBegegnung(null);
    if (!v || !stand) return;

    if (ende === 'gefangen') {
      if (team.length >= TEAM_MAX) {
        setHinweis('Team ist voll — die Kreatur bleibt frei.');
        sichere({ besiegt: [...stand.besiegt, v.id] }, team);
        return;
      }
      const neuesTeam = [...team, baueKaempfer(v.kreatur, v.stufe)];
      erfahrungRef.current[neuesTeam.length - 1] = 0;
      setTeam(neuesTeam);
      setHinweis(`${KREATUREN.get(v.kreatur)?.linie ?? v.kreatur} aufgenommen.`);
      sichere({ gefangen: [...stand.gefangen, v.id], gesehen: [...new Set([...stand.gesehen, v.kreatur])] }, neuesTeam);
      return;
    }

    if (ende === 'niederlage') {
      // Kein Verlust von Fortschritt, aber das Team muss zurück auf die Beine —
      // sonst steht man mit 0 KP in der Welt und jede Begegnung endet sofort.
      const geheilt = team.map(k => { k.kp = k.maxKp; return k; });
      setTeam([...geheilt]);
      setHinweis('Das Team ist erschöpft. Ihr habt euch zurückgezogen.');
      sichere({}, geheilt);
      return;
    }

    if (ende === 'sieg') {
      const meldungen = belohne(v);
      setHinweis(meldungen.length ? meldungen.join(' · ') : null);
      return;
    }
    sichere({ gesehen: [...new Set([...stand.gesehen, v.kreatur])] }, team);
  }, [begegnung, stand, team, sichere]);

  /**
   * Was ein Sieg einbringt: Erfahrung für den Kämpfer, der im Feld stand, und mit
   * Glück ein Gegenstand.
   *
   * Erfahrung bekommt **nur der aktive Kämpfer**. Sie auf das ganze Team zu verteilen
   * nimmt dem Wechseln seinen Preis — und der Preis ist die einzige Spannung, die
   * das Wechselsystem hat.
   */
  const belohne = useCallback((v: Vorkommen): string[] => {
    if (!stand) return [];
    const meldungen: string[] = [];
    const i = Math.max(0, team.findIndex(k => k.kp > 0));
    const k = team[i];
    if (k) {
      const a = ausKaempferId(k.id);
      const gewinn = erfahrungAusSieg(v.stufe, mutationVon(v));
      const kr = KREATUREN.get(a.kreatur);
      const auf = gutschrift(a.stufe, erfahrungRef.current[i] ?? 0, gewinn, kr?.stufen.length ?? 1);
      erfahrungRef.current[i] = auf.erfahrung;
      if (auf.gestiegen > 0) {
        // Neu bauen statt Werte nachziehen: Bei einer Mutation ändern sich Name,
        // Moveset und Gestalt mit — das ist kein Zahlenupdate, das ist ein anderes Wesen.
        const anteil = k.maxKp > 0 ? k.kp / k.maxKp : 1;
        const neu = baueKaempfer(a.kreatur, auf.stufe);
        neu.kp = Math.max(1, Math.round(neu.maxKp * anteil));
        const kopie = [...team]; kopie[i] = neu; setTeam(kopie);
        meldungen.push(auf.mutiert
          ? `${k.name} wird zu ${neu.name}`
          : `${neu.name} erreicht Stufe ${auf.stufe}`);
      }
    }
    // Beute. Der Wurf haengt an der Vorkommens-ID, ist also je Kreatur fest —
    // Neuladen und noch einmal kaempfen bringt nicht denselben Fund zweimal.
    let saat = v.id.length * 2654435761;
    const wurf = () => { saat = (saat * 1103515245 + 12345) & 0x7fffffff; return saat / 0x7fffffff; };
    const g = beute([...GEGENSTAENDE.values()], wurf);
    const beutelNeu = { ...stand.beutel };
    if (g) { beutelNeu[g.id] = (beutelNeu[g.id] ?? 0) + 1; meldungen.push(`${g.name} gefunden`); }

    sichere({
      besiegt: [...stand.besiegt, v.id],
      gesehen: [...new Set([...stand.gesehen, v.kreatur])],
      beutel: beutelNeu,
    }, team);
    return meldungen;
  }, [stand, team, sichere]);

  /**
   * Rasten: Team auf volle KP.
   *
   * Der Grund steht in G-35 — ohne Heilung außerhalb des Kampfes war die
   * **Niederlage** der zuverlässigste Weg zu vollen KP, weil sie vollständig
   * heilt. Gegenstände haben das entschärft; wer keinen Sud mehr hat, stand aber
   * weiterhin vor derselben Wahl. Der Preis der Zuflucht ist der Weg dorthin, und
   * das ist der richtige Preis: eine Entscheidung über die Route, keine Ressource.
   *
   * Kein Vorrat, kein Kochen, kein Zeitverbrauch. Was hier fehlt, fehlt bewusst.
   */
  const raste = useCallback(() => {
    if (!stand) return;
    const voll = team.map(k => { k.kp = k.maxKp; return k; });
    setTeam([...voll]);
    setHinweis(voll.length ? 'Ausgeruht. Das Team ist wieder bei Kräften.' : 'Ausgeruht.');
    setOrtOffen(null);
    sichere({}, voll);
  }, [stand, team, sichere]);

  /** Was der Spieler getan hat — die einzige Quelle für den Auftragsfortschritt. */
  const taten = useMemo<Taten>(() => ({
    besiegt: stand?.besiegt ?? [],
    gefangen: stand?.gefangen ?? [],
    fragmente: stand?.fragmente ?? [],
    regenten: stand?.regenten ?? [],
  }), [stand]);

  /**
   * Gleiter frei? Abgeleitet aus dem Weltzustand, nicht gespeichert (D56).
   *
   * Das Traversal-Dokument setzt Gleiten auf „Kapitel 2". Im Spielverlauf ist das
   * derselbe Moment: Kapitel 1 endet mit dem Flussvater. Ein eigenes Feld
   * `gleiterFrei` im Spielstand wäre eine zweite Wahrheit über denselben
   * Sachverhalt — und die driftet, sobald irgendwo ein Haken fehlt.
   */
  const gleiterFrei = useMemo(() => gleiterOffen(taten.regenten), [taten.regenten]);
  const [gleitet, setGleitet] = useState(false);

  const nimmAuftrag = useCallback((id: string) => {
    if (!stand) return;
    sichere({ auftraege: { ...stand.auftraege, [id]: 'angenommen' } }, team);
    setHinweis(`Auftrag angenommen: ${AUFTRAEGE.find(a => a.id === id)?.titel ?? id}`);
  }, [stand, team, sichere]);

  /** Belohnung abholen. Erst hier ist ein Auftrag zu Ende — nicht beim letzten Schlag. */
  const holeAuftrag = useCallback((id: string) => {
    if (!stand) return;
    const a = AUFTRAEGE.find(x => x.id === id);
    if (!a) return;
    const beutelNeu = { ...stand.beutel };
    const teile: string[] = [];
    for (const [gid, n] of Object.entries(a.belohnung)) {
      beutelNeu[gid] = (beutelNeu[gid] ?? 0) + n;
      teile.push(`${n}× ${GEGENSTAENDE.get(gid)?.name ?? gid}`);
    }
    sichere({ auftraege: { ...stand.auftraege, [id]: 'abgeholt' }, beutel: beutelNeu }, team);
    setHinweis(`${a.titel} erledigt · ${teile.join(', ')}`);
  }, [stand, team, sichere]);

  const beendeRegent = useCallback((ende: KampfEnde) => {
    setRegentKampf(null);
    if (!stand) return;
    if (ende === 'sieg') {
      setHinweis('Der Flussvater ist besiegt. Das Stauwasser sinkt.');
      // Zweimal notiert, und das mit Absicht: `besiegt` steuert, ob der Regent
      // noch in der Welt steht, `regenten` ist der Weltzustand, den Aufträge
      // abfragen. Ein Regent ist kein Vorkommen — er passt nicht in dieselbe Liste.
      sichere({
        besiegt: [...stand.besiegt, `regent:${REGENT_ID}`],
        regenten: [...new Set([...stand.regenten, REGENT_ID])],
      }, team);
      return;
    }
    if (ende === 'niederlage') {
      const geheilt = team.map(k => { k.kp = k.maxKp; return k; });
      setTeam([...geheilt]);
      setHinweis('Zu früh. Ihr habt euch aus dem Stauwasser zurückgezogen.');
      sichere({}, geheilt);
      return;
    }
    sichere({}, team);
  }, [stand, team, sichere]);

  if (fehler) return <Hinweis text={`Weltdaten fehlen: ${fehler} — erst "npm run world oental 96" ausführen.`} />;
  if (!welt || !stand) return <Hinweis text="Œntal wird geladen …" />;

  const imKampf = begegnung !== null || regentKampf !== null;
  const kampfTeam: Team = { kaempfer: team, aktiv: Math.max(0, team.findIndex(k => k.kp > 0)) };

  return (
    <>
      <RegionsSzene
        welt={welt} tageszeit={tageszeit} onMessung={setMessung}
        qualitaet={qualitaet}
        spielerRef={spielerRef}
        kreaturen={STREUNENDE}
        gestalt={gestalt}
        verbraucht={verbraucht}
        onBegegnung={beginneKampf}
        naehe={naehe}
        regent={regent}
        onRegentNah={setRegentNah}
        gleiterFrei={gleiterFrei}
        onGleiten={setGleitet}
        fundstellen={fundstellen}
        gelesen={gelesen}
        onFund={findeFragment}
        orte={ortsmarken}
        onOrtNah={setOrtNah}
        startPosition={ABSETZEN?.ort ?? stand.position}
        startBlick={ABSETZEN?.blick}
        ausdauer={ausdauer}
        reittier={reittier}
        angehalten={imKampf}
        fernland={fernland}
        meldeRand={meldeRand}
        stoecke={stoecke}
        kampfplatz={KAMPFPLATZ || !!weltKampf}
        kampfAufstellung={weltKampf?.aufstellung ?? KAMPF_AUFSTELLUNG}
        kampfStand={kampfStand}
        kampfEnde={weltKampf ? kampfVorbei : undefined}
      />
      {!imKampf && !menueOffen && <Stockanzeige stoecke={stoecke} />}

      {seite && (
        <div style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)',
          // Im Kampf ganz oben ueber der Gegnerkarte statt unten: Unten liegen die
          // Knoepfe, und die Anzeige lag genau auf „Fangen" und „Beutel".
          ...(imKampf
            ? { top: 0 }
            : { top: 'env(safe-area-inset-top, 8px)' }),
          zIndex: 50, pointerEvents: 'none',
          fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 1.4,
          color: seite.mittel > 20 ? '#d98b6b' : '#5c8f76', textAlign: 'center',
          background: '#0d1210cc', padding: '3px 8px', borderRadius: 6,
        }}>
          Seite {seite.bps.toFixed(0)} B/s · {seite.mittel.toFixed(1)} ms
          {' · p95 '}{seite.p95.toFixed(1)} ms{imKampf ? ' · Szene steht' : ''}
        </div>
      )}

      {imKampf && (begegnung || regentKampf) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, overflow: 'auto' }}>
          <Kampfbildschirm
            team={kampfTeam}
            gegner={regentKampf ?? begegnung!.gegner}
            fangbar={!regentKampf && (KREATUREN.get(begegnung!.v.kreatur)?.fangbar ?? false)}
            bild={bild}
            beutel={stand.beutel}
            onVerbraucht={verbrauche}
            narbeFuer={narbeFuer}
            seed={regentKampf ? 33 : begegnung!.v.id.length * 7919 + begegnung!.v.stufe}
            onEnde={regentKampf ? beendeRegent : beendeKampf}
          />
        </div>
      )}

      {!imKampf && (
        <>
          {/* Tageszeit als Regler statt als drei Knöpfe. Die interessanten Zustände
              liegen zwischen den Schlüsselbildern, nicht auf ihnen. Die Marken
              darunter springen zu den Schlüsseln — zum Wiederfinden, nicht als
              einzige Auswahl. */}
          <div style={{
            position: 'fixed', top: 'env(safe-area-inset-top, 8px)', left: 8,
            display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10,
            background: '#0d1210aa', border: '1px solid #2a3632',
            borderRadius: 10, padding: '6px 9px', width: 168,
          }}>
            <input type="range" min={0} max={0.999} step={0.002} value={tageszeit}
              onChange={e => setTageszeit(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#3fd9a0', height: 18 }} />
            <div style={{ display: 'flex', gap: 3, justifyContent: 'space-between' }}>
              {TAGESZEITEN.map(k => (
                <button key={k.name} onClick={() => setTageszeit(k.zeit)} style={{
                  flex: 1, minHeight: 24, padding: '2px 2px', borderRadius: 6, fontSize: 9,
                  background: Math.abs(tageszeit - k.zeit) < 0.02 ? '#1f2b27' : 'transparent',
                  border: '1px solid #2a3632',
                  color: Math.abs(tageszeit - k.zeit) < 0.02 ? '#3fd9a0' : '#7d8b85',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{k.name.slice(0, 5)}</button>
              ))}
            </div>
          </div>

          <Witterung naehe={naehe} />
          <Ausdaueranzeige ausdauer={ausdauer} />
          {(KAMPFPLATZ || weltKampf) && <Kampfanzeige stand={kampfStand} />}

          {/* Gleitflug. Nur sichtbar, solange er läuft — eine Anzeige, die immer
              da ist, erklärt nichts über einen Zustand, den man ohnehin spürt.
              Das Verhältnis steht dabei, weil es die einzige Zahl ist, aus der
              sich abschätzen lässt, ob der nächste Grat noch zu erreichen ist. */}
          {gleitet && (
            <div style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              background: '#131c19cc', border: '1px solid #3fd9a0', borderRadius: 4,
              color: '#3fd9a0', padding: '4px 12px', font: '12px/1.3 system-ui, sans-serif',
              letterSpacing: '.06em', pointerEvents: 'none',
            }}>
              GLEITFLUG · {GLEIT_VERHAELTNIS}:1 · tippen zum Einklappen
            </div>
          )}

          {/* Auf- und Absitzen. Der Knopf steht nur da, wenn es ein Reittier gibt —
              ein dauerhaft grauer Knopf erklärt nichts, ein Hinweis beim Versuch
              schon. Deshalb liegt die Erklärung (`warumNicht`) im Teamfenster,
              nicht hier. */}
          {reittierKandidat && (
            <button onClick={() => setImSattel(v => !v)} style={{
              position: 'fixed', right: 8, bottom: 'calc(env(safe-area-inset-bottom, 8px) + 34px)',
              zIndex: 12, minHeight: 34, padding: '0 12px', borderRadius: 8, fontSize: 11,
              background: '#131c19cc', border: `1px solid ${imSattel ? '#3fd9a0' : '#2a3632'}`,
              color: imSattel ? '#3fd9a0' : '#9fb0a8',
            }}>
              {imSattel ? 'absitzen' : `${reittierKandidat.name} reiten`}
            </button>
          )}

          {/* Ein Fundstück. Keine Karte, kein Log-Eintrag, kein Haken — man liest es
              und geht weiter. Die Leseliste steht im Beutel, falls jemand zurückwill. */}
          {fragment && FRAGMENTE.get(fragment) && (
            <div onClick={() => setFragment(null)} style={{
              position: 'fixed', inset: 0, zIndex: 30, display: 'grid', placeItems: 'center',
              background: '#0a0f0dcc', padding: 24,
            }}>
              <div style={{
                maxWidth: 420, background: '#131c19', border: '1px solid #2a3632',
                borderRadius: 12, padding: '18px 20px',
              }}>
                <div style={{ color: '#9db0a6', fontSize: 15, fontWeight: 600, marginBottom: 10 }}>
                  {FRAGMENTE.get(fragment)!.titel}
                </div>
                <div style={{ color: '#8b9a93', fontSize: 14, lineHeight: 1.6 }}>
                  {FRAGMENTE.get(fragment)!.text}
                </div>
                <div style={{ color: '#5c6b64', fontSize: 11, marginTop: 14, textAlign: 'right' }}>
                  {gelesen.size} von {FRAGMENTE.size} Fundstücken · tippen zum Weitergehen
                </div>
              </div>
            </div>
          )}

          {/* Menüknopf. Oben links, gross (44 px) und mit Abstand zum Rand: Die
              linke Bildhälfte ist der virtuelle Stick (`steuerung.ts`), und ein
              Knopf, den man beim Loslaufen trifft, wäre schlimmer als keiner.
              Oben wischt der Daumen nicht. */}
          {!menueOffen && (
            <button onClick={() => setMenueOffen(true)} aria-label="Menü" style={{
              position: 'fixed', top: 'calc(env(safe-area-inset-top, 8px) + 4px)', left: 8,
              zIndex: 20, width: 44, height: 44, borderRadius: 10,
              display: 'grid', placeItems: 'center', gap: 0,
              background: '#131c19cc', border: '1px solid #2a3632', color: '#9fb0a8',
            }}>
              <span style={{ display: 'block', lineHeight: 0 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    display: 'block', width: 17, height: 2, borderRadius: 1,
                    background: '#9fb0a8', marginTop: i ? 4 : 0,
                  }} />
                ))}
              </span>
            </button>
          )}

          {stand && (editorOffen || (!stand.held && !MESSADRESSE) || HELD_EDITOR) && (
            <HeldEditor start={stand.held} onFertig={w => {
              setzeHeldWahl(w);
              setEditorOffen(false);
              setStand(alt => { if (!alt) return alt; const neu = { ...alt, held: w }; void speichereStand(neu); return neu; });
            }} />
          )}

          {menueOffen && (
            <Menue
              onFigur={() => { setMenueOffen(false); setEditorOffen(true); }}
              welt={welt}
              team={team}
              beutel={stand.beutel}
              fragmente={stand.fragmente}
              gesehen={stand.gesehen}
              gefangen={stand.gefangen}
              besuchteOrte={stand.orte}
              spieler={[spielerRef.current?.position.x ?? 0, spielerRef.current?.position.z ?? 0]}
              ziel={auftragsziel}
              narbeFuer={narbeFuer}
              onTeam={ordneTeam}
              onVerbraucht={verbrauche}
              onGeaendert={sichereTeam}
              onSchliessen={() => setMenueOffen(false)}
            />
          )}

          {/* Ort in Reichweite. Ein Knopf, kein Automatismus — siehe `Orte` in der Szene. */}
          {ortNah && !ortOffen && ORTE.get(ortNah) && (
            <button onClick={() => oeffneOrt(ortNah)} style={{
              position: 'fixed', left: '50%', transform: 'translateX(-50%)',
              bottom: 'calc(env(safe-area-inset-bottom, 8px) + 76px)', zIndex: 20,
              minHeight: 40, padding: '0 18px', borderRadius: 9, fontSize: 13,
              background: '#131c19ee', border: '1px solid #3fd9a0', color: '#3fd9a0',
            }}>
              {ORTE.get(ortNah)!.art === 'zuflucht' ? 'Rasten' : 'Ansprechen'}
            </button>
          )}

          {ortOffen && ORTE.get(ortOffen) && (
            <Ortsfenster
              ort={ORTE.get(ortOffen)!}
              auftraege={beiGeber(AUFTRAEGE, ortOffen, stand.auftraege, taten)}
              onRasten={raste}
              onAnnehmen={nimmAuftrag}
              onAbholen={holeAuftrag}
              onSchliessen={() => setOrtOffen(null)}
            />
          )}

          {/* Der Bosskampf startet nicht von selbst. Wer im Vorbeigehen in einen
              Regenten läuft, erlebt keinen Höhepunkt, sondern einen Unfall. */}
          {regentNah && !stand.besiegt.includes(`regent:${REGENT_ID}`) && (
            <div style={{
              position: 'fixed', left: '50%', transform: 'translateX(-50%)',
              bottom: 'calc(env(safe-area-inset-bottom, 8px) + 76px)', zIndex: 20,
              background: '#131c19ee', border: '1px solid #2a3632', borderRadius: 10,
              padding: '10px 14px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 8, maxWidth: '86vw',
            }}>
              <div style={{ color: '#c4553f', fontSize: 13, fontWeight: 600 }}>
                {REGENTEN.get(REGENT_ID)?.name}
              </div>
              <div style={{ color: '#7d8b85', fontSize: 11, textAlign: 'center' }}>
                Das Wasser steht. Er wartet nicht, aber er kommt auch nicht.
              </div>
              <button onClick={() => setRegentKampf(baueRegent(REGENT_ID))} style={{
                minHeight: 40, padding: '0 20px', borderRadius: 9, fontSize: 13,
                background: 'transparent', border: '1px solid #c4553f', color: '#c4553f',
              }}>Stellen</button>
            </div>
          )}

          {/* Team — ohne diese Anzeige weiß niemand, womit er in den nächsten Kampf geht. */}
          <div style={{
            position: 'fixed', left: 8, bottom: 'calc(env(safe-area-inset-bottom, 8px) + 34px)',
            display: 'flex', flexDirection: 'column', gap: 3, zIndex: 10, pointerEvents: 'none',
          }}>
            {team.map((k, i) => (
              <div key={i} style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 11,
                color: k.kp > 0 ? '#9fb0a8' : '#6b5450',
                background: '#0d121099', padding: '2px 6px', borderRadius: 5,
              }}>
                {k.name} <span style={{ color: '#6f8079' }}>S{ausKaempferId(k.id).stufe}</span>
                {' '}{Math.max(0, k.kp)}/{k.maxKp}
              </div>
            ))}
            {/* Warum kein Reittier? Ein Satz, und nur solange es einen gibt. Eine
                Fähigkeit, die nicht auslöst und nicht sagt warum, liest sich als
                Fehler — deshalb steht der Grund da, wo das Team steht. */}
            {team.length > 0 && !reittierKandidat && warumNicht(kandidaten) && (
              <div style={{
                fontSize: 10, color: '#5c6b64', background: '#0d121099',
                padding: '2px 6px', borderRadius: 5, maxWidth: 220,
              }}>{warumNicht(kandidaten)}</div>
            )}
            {/* Beutel draussen: Was drin ist, und ob es sich lohnt stehenzubleiben. */}
            {Object.entries(stand.beutel).filter(([, n]) => n > 0).length > 0 && (
              <div style={{
                fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#6f8079',
                background: '#0d121099', padding: '2px 6px', borderRadius: 5, marginTop: 2,
              }}>
                {Object.entries(stand.beutel).filter(([, n]) => n > 0)
                  .map(([id, n]) => `${GEGENSTAENDE.get(id)?.name ?? id} ×${n}`).join(' · ')}
              </div>
            )}
          </div>

          {hinweis && (
            <div onClick={() => setHinweis(null)} style={{
              position: 'fixed', top: 'calc(env(safe-area-inset-top, 8px) + 44px)',
              left: '50%', transform: 'translateX(-50%)', zIndex: 20,
              background: '#131c19ee', border: '1px solid #2a3632', borderRadius: 8,
              padding: '7px 12px', color: '#3fd9a0', fontSize: 12, maxWidth: '80vw',
            }}>{hinweis}</div>
          )}

          {messung && (
            <div onClick={() => setSchalterOffen(o => !o)} style={{
              position: 'fixed', top: 'env(safe-area-inset-top, 8px)', right: 8, zIndex: 10,
              fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 1.5,
              color: messung.bps < 30 ? '#d98b6b' : '#5c8f76', textAlign: 'right',
              background: '#0d121099', padding: '4px 7px', borderRadius: 6,
            }}>
              {messung.bps.toFixed(0)} B/s<br />
              {Math.round(messung.dreiecke).toLocaleString('de')} Dreiecke<br />
              {messung.aufrufe} Aufrufe<br />
              {messung.objekte.toLocaleString('de')} Objekte<br />
              {messung.ladezeit === null ? 'lädt …' : `Ladezeit ${messung.ladezeit.toFixed(1)} s`}
              {/* Was fehlt, muss im Bildschirmfoto stehen: Safari zeigt nur den
                  Hostnamen, nicht die Abfrage — eine Messung ohne die Angabe,
                  was abgeschaltet war, ist keine Messung. */}
              {abgeschaltet().length > 0 && (
                <><br /><span style={{ color: '#d98b6b' }}>ohne {abgeschaltet().join(' ')}</span></>
              )}
            </div>
          )}

          {/* Qualitätsschalter liegen jetzt hinter der Messanzeige: Sie sind ein
              Diagnosewerkzeug, kein Teil des Spiels — siehe Ledger G-20. */}
          {schalterOffen && (
            <div style={{
              position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 8px) + 30px)',
              left: 0, right: 0, display: 'flex', gap: 6, justifyContent: 'center',
              flexWrap: 'wrap', zIndex: 10,
            }}>
              {([
                ['Pixel 1x', () => setQualitaet(q => ({ ...q, dpr: 1 })), qualitaet.dpr === 1],
                ['1,5x', () => setQualitaet(q => ({ ...q, dpr: 1.5 })), qualitaet.dpr === 1.5],
                ['2x', () => setQualitaet(q => ({ ...q, dpr: 2 })), qualitaet.dpr === 2],
                ['Schatten', () => setQualitaet(q => ({ ...q, schatten: !q.schatten })), qualitaet.schatten],
                ['Gras aus', () => setQualitaet(q => ({ ...q, gras: q.gras === 0 ? 1 : 0 })), qualitaet.gras === 0],
              ] as [string, () => void, boolean][]).map(([text, klick, an]) => (
                <button key={text} onClick={klick} style={{
                  minHeight: 30, padding: '3px 9px', borderRadius: 7, fontSize: 11,
                  background: an ? '#1f2b27' : 'transparent',
                  border: '1px solid #2a3632', color: an ? '#3fd9a0' : '#7d8b85',
                }}>{text}</button>
              ))}
            </div>
          )}

          <div style={{
            position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 8px) + 8px)', left: 0, right: 0,
            textAlign: 'center', pointerEvents: 'none', zIndex: 10,
            color: '#5c6b64', fontSize: 11, letterSpacing: 0.2,
          }}>
            links halten = gehen · rechts halten = umsehen · rechts tippen = springen · dem Pfeil folgen
          </div>
        </>
      )}
    </>
  );
}

const Hinweis = ({ text }: { text: string }) => (
  <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24,
                textAlign: 'center', color: '#7d8b85', fontSize: 14 }}>{text}</div>
);

createRoot(document.getElementById('app')!).render(<StrictMode><App /></StrictMode>);
