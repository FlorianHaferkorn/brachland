import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { entpackeWelt, type Weltdaten } from './world/osm.js';
import { RegionsSzene, TAGESZEITEN, QUALITAET_STANDARD,
         type Messwerte, type Qualitaet, type Naehe } from './scenes/RegionsSzene.js';
import { Witterung } from './ui/Witterung.js';
import type { Vorkommen } from './world/vorkommen.js';
import { KREATUREN, REGENTEN, WILDLINGE, baueKaempfer, baueRegent, regentOrt } from './data/inhalte.js';
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
  const [hinweis, setHinweis] = useState<string | null>(null);
  const spielerRef = useRef<THREE.Object3D>(null);
  const naehe = useRef<Naehe>({ abstand: Infinity, winkel: 0, kreatur: '' });

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
      const s = geladen ?? { ...LEERER_STAND, team: [{ kreatur: START_KREATUR, stufe: 0, kp: 0 }] };
      setStand(s);
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
    for (const k of KREATUREN.values()) karte.set(k.id, baueKreaturGeometrie(k.basisRig, k.elemente));
    return karte;
  }, []);
  const gestalt = useCallback(
    (id: string) => gestalten.get(id) ?? gestalten.values().next().value!,
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
    const id = kaempferId.replace(/-s\d+$/, '');
    const stufe = Number(kaempferId.match(/-s(\d+)$/)?.[1] ?? 1) - 1;
    const k = KREATUREN.get(id);
    if (k) return { basisRig: k.basisRig, elemente: [...k.elemente], stufe };
    const r = REGENTEN.get(id);
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
    return { ort, gestalt: baueKreaturGeometrie('serpent', r.phasen[0].elemente) };
  }, [welt]);

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
        team: teamJetzt.map<TeamEintrag>(k => ({
          kreatur: k.id.replace(/-s\d+$/, ''),
          stufe: Number(k.id.match(/-s(\d+)$/)?.[1] ?? 1) - 1,
          kp: Math.max(0, k.kp),
        })),
      };
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
      setHinweis(null);
      sichere({ besiegt: [...stand.besiegt, v.id],
                gesehen: [...new Set([...stand.gesehen, v.kreatur])] }, team);
      return;
    }
    sichere({ gesehen: [...new Set([...stand.gesehen, v.kreatur])] }, team);
  }, [begegnung, stand, team, sichere]);

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
        startPosition={stand.position}
        angehalten={imKampf}
      />

      {seite && (
        <div style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)',
          // Im Kampf nach unten: oben steht dort der Gegnername.
          ...(imKampf
            ? { bottom: 'env(safe-area-inset-bottom, 4px)' }
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
                {k.name} {Math.max(0, k.kp)}/{k.maxKp}
              </div>
            ))}
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
            links wischen = gehen · rechts wischen = umsehen und neigen · dem Pfeil folgen
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
