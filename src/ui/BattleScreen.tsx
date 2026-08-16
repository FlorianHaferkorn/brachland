/**
 * BRACHLAND — Kampfbildschirm
 *
 * Reine Darstellungsschicht über der Engine. Die Engine kennt keine UI, die UI
 * enthält keine Regeln — alle Zahlen kommen aus src/engine/battle.ts.
 *
 * Bewusst für Handy gebaut: Daumenreichweite unten, große Trefferflächen,
 * kein Hover. Farbgebung folgt der Art Direction (gedämpft + eine Signalfarbe).
 */
import { useState, useCallback, useMemo } from 'react';
import { BAND } from '../data/schema.js';
import {
  REGELN, schaden, waehleMove, elementFaktor, rng,
  type Kaempfer, type Team, type MoveDef,
} from '../engine/battle.js';

const FARBE = {
  hintergrund: '#0d1210',
  flaeche:     '#161d1a',
  rand:        '#2a3632',
  text:        '#e4e8e4',
  gedaempft:   '#7d8b85',
  signal:      '#3fd9a0',   // Befall / Biolumineszenz — die eine Signalfarbe
  gefahr:      '#c4553f',
  kp:          '#6fb98a',
} as const;

const ELEMENT_KURZ: Record<string, string> = {
  holz: 'HLZ', stein: 'STN', 'alt-tech': 'TEC', sporen: 'SPO',
  wasser: 'WSR', brand: 'BRD', frost: 'FRS', faeulnis: 'FÄU',
};

function Balken({ wert, max, farbe, hoehe = 6 }: { wert: number; max: number; farbe: string; hoehe?: number }) {
  const anteil = Math.max(0, Math.min(1, wert / max));
  return (
    <div style={{ background: FARBE.rand, borderRadius: hoehe, height: hoehe, overflow: 'hidden' }}>
      <div style={{
        width: `${anteil * 100}%`, height: '100%', background: farbe,
        transition: 'width 260ms ease-out',
      }} />
    </div>
  );
}

function KaempferKarte({ k, gegner, oben }: { k: Kaempfer; gegner: Kaempfer; oben?: boolean }) {
  const faktor = useMemo(
    () => Math.max(...k.elemente.map(e => elementFaktor(e, gegner.elemente))),
    [k.elemente, gegner.elemente],
  );
  return (
    <div style={{
      background: FARBE.flaeche, border: `1px solid ${FARBE.rand}`,
      borderRadius: 10, padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ color: FARBE.text, fontWeight: 600, fontSize: 15 }}>{k.name}</span>
        <span style={{ display: 'flex', gap: 4 }}>
          {k.elemente.map(e => (
            <span key={e} style={{
              color: FARBE.gedaempft, fontSize: 10, letterSpacing: 0.5,
              border: `1px solid ${FARBE.rand}`, borderRadius: 4, padding: '1px 4px',
            }}>{ELEMENT_KURZ[e] ?? e}</span>
          ))}
          {k.zustand === 'befallen' && (
            <span style={{ color: FARBE.signal, fontSize: 10, border: `1px solid ${FARBE.signal}`,
                           borderRadius: 4, padding: '1px 4px' }}>BEFALLEN</span>
          )}
        </span>
      </div>

      <div style={{ marginTop: 6 }}>
        <Balken wert={k.kp} max={k.maxKp} farbe={k.kp / k.maxKp < 0.25 ? FARBE.gefahr : FARBE.kp} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: FARBE.gedaempft }}>
        <span>{Math.max(0, k.kp)} / {k.maxKp}</span>
        {/* Der Elementvorteil ist die wichtigste Information im Kampf — deshalb sichtbar,
            nicht versteckt. Der Spieler soll planen, nicht raten. */}
        {!oben && (
          <span style={{ color: faktor > 1 ? FARBE.signal : faktor < 1 ? FARBE.gefahr : FARBE.gedaempft }}>
            {faktor > 1 ? `stark gegen (×${faktor})` : faktor < 1 ? `schwach (×${faktor})` : 'neutral'}
          </span>
        )}
      </div>

      {!oben && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, color: FARBE.gedaempft, marginBottom: 3 }}>
            FOKUS {k.fokus} / {REGELN.FOKUS_MAX}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: REGELN.FOKUS_MAX }, (_, i) => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i < k.fokus ? FARBE.signal : FARBE.rand,
              }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export interface KampfProps {
  team: Team;
  gegner: Kaempfer;
  seed?: number;
  onEnde?: (sieg: boolean) => void;
}

export function Kampfbildschirm({ team, gegner, seed = 1, onEnde }: KampfProps) {
  const [, neuZeichnen] = useState(0);
  const [meldungen, setMeldungen] = useState<string[]>(['Ein wilder Gegner stellt sich.']);
  const [wechselOffen, setWechselOffen] = useState(false);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const zufall = useMemo(() => rng(seed), [seed]);

  const aktiv = team.kaempfer[team.aktiv];
  const melde = (t: string) => setMeldungen(m => [...m.slice(-3), t]);

  /** Eine Runde: Spielerzug, Gegnerzug, Zehrung, Fokus. Reihenfolge nach Initiative. */
  const runde = useCallback((spielerMove: MoveDef | null, gewechselt: boolean) => {
    setBeschaeftigt(true);
    const ich = team.kaempfer[team.aktiv];

    if (gewechselt) {
      const gm = waehleMove(gegner, ich);
      const roh = gm ? schaden(gegner, ich, gm, zufall) : 0;
      const d = Math.round(roh * REGELN.SHIELD_DR);
      ich.kp -= d;
      melde(`${ich.name} tritt ein und fängt ${d} Schaden ab (Schild).`);
    } else if (spielerMove) {
      const zuerst = gegner.ini > ich.ini ? 'gegner' : 'ich';
      const zug = (a: Kaempfer, d: Kaempfer, m: MoveDef | null) => {
        if (!m || a.kp <= 0 || d.kp <= 0) return;
        a.fokus -= BAND[m.band].fokus;
        const s = schaden(a, d, m, zufall);
        d.kp -= s;
        const f = elementFaktor(m.element, d.elemente);
        melde(`${a.name}: ${m.name} → ${s}${f > 1 ? ' (sehr effektiv)' : f < 1 ? ' (kaum wirksam)' : ''}`);
      };
      if (zuerst === 'ich') { zug(ich, gegner, spielerMove); zug(gegner, ich, waehleMove(gegner, ich)); }
      else { zug(gegner, ich, waehleMove(gegner, ich)); zug(ich, gegner, spielerMove); }
    }

    for (const k of [ich, gegner]) {
      if (k.zustand === 'befallen' && k.kp > 0) {
        const z = Math.round(k.maxKp * REGELN.ZEHRUNG);
        k.kp -= z;
        melde(`${k.name} zehrt an sich selbst (−${z}).`);
      }
      k.fokus = Math.min(REGELN.FOKUS_MAX, k.fokus + REGELN.FOKUS_REGEN);
    }

    if (gegner.kp <= 0) { melde(`${gegner.name} ist besiegt.`); onEnde?.(true); }
    else if (ich.kp <= 0) {
      melde(`${ich.name} ist ausgefallen.`);
      const naechster = team.kaempfer.findIndex(k => k.kp > 0);
      if (naechster === -1) { melde('Kein Kämpfer mehr einsatzbereit.'); onEnde?.(false); }
      else { team.aktiv = naechster; team.kaempfer[naechster].fokus = REGELN.FOKUS_START; setWechselOffen(false); }
    }
    neuZeichnen(x => x + 1);
    setBeschaeftigt(false);
  }, [team, gegner, zufall, onEnde]);

  const vorbei = gegner.kp <= 0 || team.kaempfer.every(k => k.kp <= 0);

  return (
    <div style={{
      background: FARBE.hintergrund, color: FARBE.text, minHeight: '100dvh',
      display: 'flex', flexDirection: 'column', gap: 10, padding: 12,
      fontFamily: 'system-ui, sans-serif',
    }}>
      <KaempferKarte k={gegner} gegner={aktiv} oben />

      <div style={{
        flex: 1, background: FARBE.flaeche, border: `1px solid ${FARBE.rand}`,
        borderRadius: 10, padding: 12, fontSize: 13, color: FARBE.gedaempft,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4,
      }}>
        {meldungen.map((m, i) => (
          <div key={i} style={{ opacity: 0.4 + 0.2 * i }}>{m}</div>
        ))}
      </div>

      <KaempferKarte k={aktiv} gegner={gegner} />

      {/* Bedienung unten — Daumenreichweite. Trefferflächen mindestens 44 px. */}
      {!vorbei && !wechselOffen && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {aktiv.moves.map(m => {
            const kosten = BAND[m.band].fokus;
            const bezahlbar = aktiv.fokus >= kosten;
            const f = elementFaktor(m.element, gegner.elemente);
            return (
              <button key={m.id} disabled={!bezahlbar || beschaeftigt}
                onClick={() => runde(m, false)}
                style={{
                  minHeight: 56, borderRadius: 10, padding: '8px 10px', textAlign: 'left',
                  background: bezahlbar ? FARBE.flaeche : 'transparent',
                  border: `1px solid ${bezahlbar ? FARBE.rand : '#1d2522'}`,
                  color: bezahlbar ? FARBE.text : '#4a544f',
                  opacity: beschaeftigt ? 0.5 : 1,
                }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                <div style={{ fontSize: 10, color: FARBE.gedaempft, marginTop: 2 }}>
                  {ELEMENT_KURZ[m.element]} · {kosten} Fokus
                  {f > 1 && <span style={{ color: FARBE.signal }}> · ×{f}</span>}
                  {f < 1 && <span style={{ color: FARBE.gefahr }}> · ×{f}</span>}
                </div>
              </button>
            );
          })}
          <button onClick={() => setWechselOffen(true)} disabled={beschaeftigt}
            style={{
              gridColumn: '1 / -1', minHeight: 48, borderRadius: 10,
              background: 'transparent', border: `1px solid ${FARBE.rand}`, color: FARBE.gedaempft,
            }}>
            Wechseln — kostet den Zug, Schild {Math.round(REGELN.SHIELD_DR * 100)} %
          </button>
        </div>
      )}

      {wechselOffen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {team.kaempfer.map((k, i) => {
            const faktor = Math.max(...k.elemente.map(e => elementFaktor(e, gegner.elemente)));
            const waehlbar = k.kp > 0 && i !== team.aktiv;
            return (
              <button key={k.id} disabled={!waehlbar}
                onClick={() => { team.aktiv = i; setWechselOffen(false); runde(null, true); }}
                style={{
                  minHeight: 52, borderRadius: 10, padding: '8px 12px', textAlign: 'left',
                  background: FARBE.flaeche, border: `1px solid ${FARBE.rand}`,
                  color: waehlbar ? FARBE.text : '#4a544f',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                <span>{k.name} <span style={{ color: FARBE.gedaempft, fontSize: 11 }}>
                  {Math.max(0, k.kp)}/{k.maxKp}</span></span>
                <span style={{ fontSize: 11, color: faktor > 1 ? FARBE.signal : faktor < 1 ? FARBE.gefahr : FARBE.gedaempft }}>
                  ×{faktor}
                </span>
              </button>
            );
          })}
          <button onClick={() => setWechselOffen(false)}
            style={{ minHeight: 44, borderRadius: 10, background: 'transparent',
                     border: `1px solid ${FARBE.rand}`, color: FARBE.gedaempft }}>
            Zurück
          </button>
        </div>
      )}

      {vorbei && (
        <div style={{
          textAlign: 'center', padding: 16, color: gegner.kp <= 0 ? FARBE.signal : FARBE.gefahr,
          fontSize: 18, fontWeight: 600,
        }}>
          {gegner.kp <= 0 ? 'Gegner besiegt' : 'Niederlage'}
        </div>
      )}
    </div>
  );
}
