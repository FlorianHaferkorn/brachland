import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { entpackeWelt, type Weltdaten } from './world/osm.js';
import { RegionsSzene, TAGESZEITEN, QUALITAET_STANDARD,
         type Messwerte, type Qualitaet, type Naehe } from './scenes/RegionsSzene.js';
import { Witterung } from './ui/Witterung.js';
import type { Vorkommen } from './world/vorkommen.js';
import { KREATUREN, REGENTEN, GEGENSTAENDE, FRAGMENTE, WILDLINGE,
         baueKaempfer, baueRegent, regentOrt, ausKaempferId } from './data/inhalte.js';
import { erfahrungAusSieg, gutschrift, mutationBei } from './spiel/fortschritt.js';
import { beute } from './spiel/gegenstaende.js';
import { baueKreaturGeometrie } from './world/kreaturgestalt.js';
import { Kampfbildschirm, type KampfEnde } from './ui/BattleScreen.js';
import type { KaempferBild } from './ui/Kampfbuehne.js';
import type { Kaempfer, Team } from './engine/battle.js';
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

/** Mutation eines wilden Vorkommens — folgt aus seiner Stufe und der Länge der Linie. */
function mutationVon(v: Vorkommen): number {
  const k = KREATUREN.get(v.kreatur);
  return k ? mutationBei(v.stufe, k.stufen.length) : 0;
}

function App() {
  const [welt, setWelt] = useState<Weltdaten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [tageszeit, setTageszeit] = useState(0.26);
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
  const [fragment, setFragment] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const spielerRef = useRef<THREE.Object3D>(null);
  const naehe = useRef<Naehe>({ abstand: Infinity, winkel: 0, kreatur: '' });
  /** Erfahrung je Teamplatz. Parallel zum Team, weil `Kaempfer` sie nicht kennt. */
  const erfahrungRef = useRef<number[]>([]);

  useEffect(() => {
    fetch('/world/oental.json')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => setWelt(entpackeWelt(d.welt)))
      .catch(e => setFehler(String(e)));
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
        karte.set(`${k.id}:${m}`, baueKreaturGeometrie(k.basisRig, k.elemente, m));
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
  const bild = useCallback((kaempferId: string): KaempferBild | null => {
    const a = ausKaempferId(kaempferId);
    const k = KREATUREN.get(a.kreatur);
    if (k) return { basisRig: k.basisRig, elemente: [...k.elemente], stufe: a.mutation };
    const r = REGENTEN.get(a.kreatur);
    // Der Regent trägt seine Phasenelemente — im Kampfbild wechselt damit die Farbe,
    // wenn er die Phase wechselt. Das ist die einzige Warnung, die der Spieler bekommt.
    return r ? { basisRig: 'serpent', elemente: [...r.phasen[0].elemente], stufe: 2 } : null;
  }, []);

  /**
   * Der Regent steht an einem festen Ort. Umrechnung von lat/lon in Meter braucht
   * die Ausdehnung der Region — die kommt aus derselben Formel wie das Terrain.
   */
  const regent = useMemo(() => {
    if (!welt) return undefined;
    const [sued, west, nord, ost] = welt.bbox;
    const METER_JE_GRAD = 111_320;
    const mittelLat = (sued + nord) / 2;
    const breite = (ost - west) * METER_JE_GRAD * Math.cos(mittelLat * Math.PI / 180);
    const tiefe = (nord - sued) * METER_JE_GRAD;
    const ort = regentOrt(REGENT_ID, welt.bbox, breite, tiefe);
    const r = REGENTEN.get(REGENT_ID);
    if (!ort || !r) return undefined;
    // Der Flussvater ist ein Riesenwels — die Schlangenform kommt dem am nächsten.
    return { ort, gestalt: baueKreaturGeometrie('serpent', r.phasen[0].elemente, 2) };
  }, [welt]);

  /**
   * Fundstellen in Weltkoordinaten. Dieselbe Umrechnung wie beim Regenten — sie
   * hängt an der Ausdehnung der Region, nicht am Inhalt.
   */
  const fundstellen = useMemo(() => {
    if (!welt) return [];
    const [sued, west, nord, ost] = welt.bbox;
    const METER_JE_GRAD = 111_320;
    const mittelLat = (sued + nord) / 2;
    const breite = (ost - west) * METER_JE_GRAD * Math.cos(mittelLat * Math.PI / 180);
    const tiefe = (nord - sued) * METER_JE_GRAD;
    return [...FRAGMENTE.values()].map(f => ({
      id: f.id,
      ort: [
        ((f.ort[1] - west) / (ost - west) - 0.5) * breite,
        ((nord - f.ort[0]) / (nord - sued) - 0.5) * tiefe,
      ] as [number, number],
    }));
  }, [welt]);

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

  const verbrauche = useCallback((id: string) => {
    setStand(alt => {
      if (!alt) return alt;
      const beutel = { ...alt.beutel, [id]: Math.max(0, (alt.beutel[id] ?? 0) - 1) };
      const neu = { ...alt, beutel };
      void speichereStand(neu);
      return neu;
    });
  }, []);

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

  const beendeRegent = useCallback((ende: KampfEnde) => {
    setRegentKampf(null);
    if (!stand) return;
    if (ende === 'sieg') {
      setHinweis('Der Flussvater ist besiegt. Das Stauwasser sinkt.');
      sichere({ besiegt: [...stand.besiegt, `regent:${REGENT_ID}`] }, team);
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
        kreaturen={WILDLINGE}
        gestalt={gestalt}
        verbraucht={verbraucht}
        onBegegnung={beginneKampf}
        naehe={naehe}
        regent={regent}
        onRegentNah={setRegentNah}
        fundstellen={fundstellen}
        gelesen={gelesen}
        onFund={findeFragment}
        startPosition={stand.position}
        angehalten={imKampf}
      />

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
              {messung.objekte.toLocaleString('de')} Objekte
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
            links wischen = gehen · rechts wischen = umsehen · rechts tippen = springen · dem Pfeil folgen
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
