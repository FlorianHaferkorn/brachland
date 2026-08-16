/**
 * BRACHLAND — Kampfbildschirm
 *
 * Reine Darstellungsschicht über der Engine. Die Engine kennt keine UI, die UI
 * enthält keine Regeln — alle Zahlen kommen aus src/engine/battle.ts.
 *
 * Bewusst für Handy gebaut: Daumenreichweite unten, große Trefferflächen,
 * kein Hover. Farbgebung folgt der Art Direction (gedämpft + eine Signalfarbe).
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import { BAND } from '../data/schema.js';
import {
  REGELN, schaden, waehleMove, elementFaktor, rng,
  type Kaempfer, type Team, type MoveDef,
} from '../engine/battle.js';
import { Kampfbuehne, type KaempferBild, type Buehnenzug } from './Kampfbuehne.js';
import { GEGENSTAENDE } from '../data/inhalte.js';
import { wendeAn, wirktAuf } from '../spiel/gegenstaende.js';
import type { Gegenstand } from '../data/schema.js';

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

/**
 * Fangchance.
 *
 * Bei voller KP 20 %, bei 10 % Rest-KP rund 74 %. Der Verlauf ist bewusst linear:
 * Der Spieler soll abschaetzen koennen, ob sich noch ein Schlag lohnt oder ob der
 * Wurf jetzt richtig ist. Eine versteckte Kurve macht daraus Gluecksspiel.
 *
 * Ein Fangversuch kostet den Zug — der Gegner greift trotzdem an. Sonst waere
 * Fangen die dominante Handlung in jeder Runde.
 */
export const FANG_BASIS = 0.20;
export const FANG_SPANNE = 0.60;

export function fangchance(gegner: Kaempfer): number {
  const anteil = Math.max(0, gegner.kp) / gegner.maxKp;
  const bonus = gegner.zustand === 'befallen' ? 0.1 : 0;
  return Math.min(0.95, FANG_BASIS + FANG_SPANNE * (1 - anteil) + bonus);
}

export type KampfEnde = 'sieg' | 'niederlage' | 'gefangen' | 'flucht';

export interface KampfProps {
  team: Team;
  gegner: Kaempfer;
  seed?: number;
  /** Fangbar? Verwachsene und Regenten sind es nicht. */
  fangbar?: boolean;
  /** Aussehen je Kämpfer-ID. Fehlt es, bleibt die Bühne leer und es gibt nur Text. */
  bild?: (kaempferId: string) => KaempferBild | null;
  /** Beutel: Gegenstand-ID zu Anzahl. Ohne Beutel gibt es keinen Gegenstand-Knopf. */
  beutel?: Record<string, number>;
  /** Wird gerufen, wenn ein Gegenstand verbraucht wurde. */
  onVerbraucht?: (id: string) => void;
  onEnde?: (ende: KampfEnde) => void;
}

export function Kampfbildschirm({
  team, gegner, seed = 1, fangbar = true, bild, beutel, onVerbraucht, onEnde,
}: KampfProps) {
  const [, neuZeichnen] = useState(0);
  const [meldungen, setMeldungen] = useState<string[]>([`${gegner.name} stellt sich.`]);
  const [wechselOffen, setWechselOffen] = useState(false);
  const [beutelOffen, setBeutelOffen] = useState(false);
  /** Zuschlag aus einer ausgelegten Fanghilfe. Gilt für diesen Kampf. */
  const [fangBonus, setFangBonus] = useState(0);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [ende, setEnde] = useState<KampfEnde | null>(null);
  const zufall = useMemo(() => rng(seed), [seed]);
  // Zeitstempel des letzten Treffers je Seite. Als Ref, nicht als State: Die Bühne
  // liest sie in ihrer eigenen Bildschleife — ein Re-Render je Treffer wäre unnötig.
  const trefferSpieler = useRef(0);
  const trefferGegner = useRef(0);
  const zug = useRef<Buehnenzug>({ zeit: 0, seite: 0 });

  /** Einen Zug an die Bühne melden: Ausfallschritt und Kamerafahrt hängen daran. */
  const inszeniere = (angreiferIstSpieler: boolean) => {
    zug.current = { zeit: performance.now() / 1000, seite: angreiferIstSpieler ? -1 : 1 };
  };

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
      inszeniere(false);
      trefferSpieler.current = performance.now() / 1000;
      melde(`${ich.name} tritt ein und fängt ${d} Schaden ab (Schild).`);
    } else if (spielerMove) {
      const zuerst = gegner.ini > ich.ini ? 'gegner' : 'ich';
      const zug = (a: Kaempfer, d: Kaempfer, m: MoveDef | null) => {
        if (!m || a.kp <= 0 || d.kp <= 0) return;
        a.fokus -= BAND[m.band].fokus;
        const s = schaden(a, d, m, zufall);
        d.kp -= s;
        inszeniere(a !== gegner);
        (d === gegner ? trefferGegner : trefferSpieler).current = performance.now() / 1000;
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

    if (gegner.kp <= 0) { melde(`${gegner.name} ist besiegt.`); setEnde('sieg'); }
    else if (ich.kp <= 0) {
      melde(`${ich.name} ist ausgefallen.`);
      const naechster = team.kaempfer.findIndex(k => k.kp > 0);
      if (naechster === -1) { melde('Kein Kämpfer mehr einsatzbereit.'); setEnde('niederlage'); }
      else { team.aktiv = naechster; team.kaempfer[naechster].fokus = REGELN.FOKUS_START; setWechselOffen(false); }
    }
    neuZeichnen(x => x + 1);
    setBeschaeftigt(false);
  }, [team, gegner, zufall]);

  /**
   * Gegenstand benutzen. Kostet den Zug — der Gegner greift danach an.
   *
   * Ohne diese Kosten wäre Heilen in jeder Runde die dominante Handlung und der
   * Kampf ein Abnutzungsrennen, das man nur durch Vorratshaltung gewinnt.
   */
  const benutze = useCallback((g: Gegenstand, ziel: Kaempfer) => {
    const w = wendeAn(g, ziel);
    melde(w.meldung);
    if (!w.gewirkt) { neuZeichnen(x => x + 1); return; }
    onVerbraucht?.(g.id);
    setBeutelOffen(false);
    if (w.fangBonus) setFangBonus(b => Math.max(b, w.fangBonus!));

    // Der Gegnerzug als Preis. Bei einer Fanghilfe ebenso: Auslegen dauert.
    setBeschaeftigt(true);
    const ich = team.kaempfer[team.aktiv];
    const gm = waehleMove(gegner, ich);
    if (gm && ich.kp > 0) {
      const s = schaden(gegner, ich, gm, zufall);
      ich.kp -= s;
      inszeniere(false);
      trefferSpieler.current = performance.now() / 1000;
      melde(`${gegner.name}: ${gm.name} → ${s}`);
      if (ich.kp <= 0) {
        const naechster = team.kaempfer.findIndex(k => k.kp > 0);
        if (naechster === -1) { melde('Kein Kämpfer mehr einsatzbereit.'); setEnde('niederlage'); }
        else { team.aktiv = naechster; team.kaempfer[naechster].fokus = REGELN.FOKUS_START; }
      }
    }
    for (const k of [ich, gegner]) k.fokus = Math.min(REGELN.FOKUS_MAX, k.fokus + REGELN.FOKUS_REGEN);
    neuZeichnen(x => x + 1);
    setBeschaeftigt(false);
  }, [team, gegner, zufall, onVerbraucht]);

  /** Fangversuch. Schlaegt er fehl, hat der Gegner trotzdem seinen Zug. */
  const fangen = useCallback(() => {
    setBeschaeftigt(true);
    const ich = team.kaempfer[team.aktiv];
    const chance = Math.min(0.95, fangchance(gegner) + fangBonus);
    if (zufall() < chance) {
      melde(`${gegner.name} laesst sich fangen.`);
      setEnde('gefangen');
      setBeschaeftigt(false);
      neuZeichnen(x => x + 1);
      return;
    }
    melde(`${gegner.name} entwindet sich (${Math.round(chance * 100)} %).`);
    const gm = waehleMove(gegner, ich);
    if (gm) {
      const s = schaden(gegner, ich, gm, zufall);
      ich.kp -= s;
      inszeniere(false);
      trefferSpieler.current = performance.now() / 1000;
      melde(`${gegner.name}: ${gm.name} → ${s}`);
      if (ich.kp <= 0) {
        const naechster = team.kaempfer.findIndex(k => k.kp > 0);
        if (naechster === -1) { melde('Kein Kämpfer mehr einsatzbereit.'); setEnde('niederlage'); }
        else { team.aktiv = naechster; team.kaempfer[naechster].fokus = REGELN.FOKUS_START; }
      }
    }
    for (const k of [ich, gegner]) k.fokus = Math.min(REGELN.FOKUS_MAX, k.fokus + REGELN.FOKUS_REGEN);
    neuZeichnen(x => x + 1);
    setBeschaeftigt(false);
  }, [team, gegner, zufall, fangBonus]);

  const vorbei = ende !== null;
  const spielerBild = bild?.(aktiv.id) ?? null;
  const gegnerBild = bild?.(gegner.id) ?? null;

  return (
    <div style={{
      background: FARBE.hintergrund, color: FARBE.text, minHeight: '100dvh',
      display: 'flex', flexDirection: 'column', gap: 10, padding: 12,
      fontFamily: 'system-ui, sans-serif',
    }}>
      <KaempferKarte k={gegner} gegner={aktiv} oben />

      {/* Bühne: feste Höhe statt flex.
          `flex: 1` gab dem Canvas keine auflösbare Höhe — er blieb auf seiner
          Mindesthöhe stehen, während der Kasten darum herum wuchs. Ein Anteil der
          Sichthöhe ist auf dem Handy ohnehin das richtige Maß: Er hängt an der
          Bildschirmhöhe, nicht daran, wie viele Zeilen gerade im Protokoll stehen. */}
      {spielerBild && gegnerBild && (
        <div style={{
          height: 'clamp(170px, 30dvh, 320px)', flexShrink: 0,
          background: FARBE.flaeche, border: `1px solid ${FARBE.rand}`,
          borderRadius: 10, overflow: 'hidden',
        }}>
          <Kampfbuehne
            spieler={spielerBild} gegner={gegnerBild}
            trefferSpieler={trefferSpieler} trefferGegner={trefferGegner} zug={zug}
            hintergrund={FARBE.flaeche}
          />
        </div>
      )}

      <div style={{
        flex: 1, minHeight: 64, background: FARBE.flaeche,
        border: `1px solid ${FARBE.rand}`, borderRadius: 10,
        padding: 10, fontSize: 13, color: FARBE.gedaempft,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 3,
      }}>
        {meldungen.map((m, i) => (
          <div key={i} style={{ opacity: 0.4 + 0.2 * i }}>{m}</div>
        ))}
      </div>

      <KaempferKarte k={aktiv} gegner={gegner} />

      {/* Bedienung unten — Daumenreichweite. Trefferflächen mindestens 44 px. */}
      {!vorbei && !wechselOffen && !beutelOffen && (
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
          <button onClick={fangen} disabled={beschaeftigt || !fangbar}
            style={{
              minHeight: 48, borderRadius: 10, background: 'transparent',
              border: `1px solid ${fangbar ? FARBE.signal : FARBE.rand}`,
              color: fangbar ? FARBE.signal : '#4a544f',
            }}>
            {fangbar
              ? `Fangen — ${Math.round(Math.min(0.95, fangchance(gegner) + fangBonus) * 100)} %`
              : 'nicht fangbar'}
          </button>
          <button onClick={() => setBeutelOffen(true)}
            disabled={beschaeftigt || !beutel || Object.values(beutel).every(n => n <= 0)}
            style={{
              minHeight: 48, borderRadius: 10, background: 'transparent',
              border: `1px solid ${FARBE.rand}`, color: FARBE.gedaempft,
            }}>
            Beutel
          </button>
          <button onClick={() => setEnde('flucht')} disabled={beschaeftigt}
            style={{
              minHeight: 48, borderRadius: 10, background: 'transparent',
              border: `1px solid ${FARBE.rand}`, color: FARBE.gedaempft,
            }}>
            Zurückziehen
          </button>
        </div>
      )}

      {/* Beutel: ein Gegenstand, ein Ziel, ein Zug. Ziel ist immer der aktive
          Kämpfer — wer einen anderen versorgen will, wechselt erst. Das hält die
          Entscheidung im Kampf bei „womit", nicht bei „auf wen". */}
      {beutelOffen && beutel && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(beutel).filter(([, n]) => n > 0).map(([id, n]) => {
            const g = GEGENSTAENDE.get(id);
            if (!g) return null;
            const sinnvoll = wirktAuf(g, aktiv);
            return (
              <button key={id} disabled={!sinnvoll || beschaeftigt}
                onClick={() => benutze(g, aktiv)}
                style={{
                  minHeight: 52, borderRadius: 10, padding: '8px 12px', textAlign: 'left',
                  background: FARBE.flaeche, border: `1px solid ${FARBE.rand}`,
                  color: sinnvoll ? FARBE.text : '#4a544f',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                }}>
                <span>
                  {g.name}
                  <span style={{ color: FARBE.gedaempft, fontSize: 11, display: 'block' }}>
                    {g.beschreibung}
                  </span>
                </span>
                <span style={{ color: FARBE.gedaempft, fontSize: 12 }}>×{n}</span>
              </button>
            );
          })}
          <button onClick={() => setBeutelOffen(false)}
            style={{ minHeight: 44, borderRadius: 10, background: 'transparent',
                     border: `1px solid ${FARBE.rand}`, color: FARBE.gedaempft }}>
            Zurück
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
          <div style={{
            textAlign: 'center', color: ende === 'niederlage' ? FARBE.gefahr : FARBE.signal,
            fontSize: 18, fontWeight: 600,
          }}>
            {ende === 'sieg' ? 'Gegner besiegt'
              : ende === 'gefangen' ? `${gegner.name} ist jetzt bei dir`
              : ende === 'flucht' ? 'Zurückgezogen'
              : 'Niederlage'}
          </div>
          {/* Der Kampf endet nicht von selbst: Ohne Bestaetigung springt man aus dem
              Ergebnis heraus, bevor man es gelesen hat. */}
          <button onClick={() => onEnde?.(ende!)}
            style={{
              minHeight: 52, borderRadius: 10, background: FARBE.flaeche,
              border: `1px solid ${FARBE.rand}`, color: FARBE.text, fontSize: 15,
            }}>
            Weiter
          </button>
        </div>
      )}
    </div>
  );
}
