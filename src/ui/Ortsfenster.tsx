/**
 * BRACHLAND — Zuflucht und Bewohner
 *
 * Ein Fenster für beide Ortsarten, weil beide dasselbe leisten sollen: **einmal
 * hinsehen und wissen, was hier zu holen ist.**
 *
 * Kein Dialogbaum. Die Story-Struktur hat den bewusst ausgeschlossen, und das
 * Argument gilt hier genauso: Ein Dialogsystem ist die teuerste Art, Text
 * auszuliefern — Zustandsmaschine, Portraits, Vertonungserwartung, Lokalisierung.
 * Was ein NPC in BRACHLAND kann, ist einen Satz sagen und eine Liste zeigen.
 *
 * Die Reihenfolge der Liste ist die Botschaft: abholbereit oben, laufend in der
 * Mitte, neu unten. Wer vor jemandem steht, will zuerst wissen, was fertig ist.
 */
import type { Ort, Auftrag } from '../data/schema.js';
import { angebot, bezahlbar, type WaffenStufen , WAFFENNAME } from '../spiel/schmiede.js';
import { GEGENSTAENDE } from '../data/inhalte.js';
import { zielText, type Fortschritt, type Lage } from '../spiel/auftraege.js';

export interface Auftragszeile {
  auftrag: Auftrag;
  lage: Lage;
  fortschritt: Fortschritt;
}

const RAHMEN = '#2a3632';
const GRUEN = '#3fd9a0';

export function Ortsfenster({ ort, auftraege, onRasten, onAnnehmen, onAbholen, onSchliessen, beutel, waffenStufen, onSchmiede, abends, kopfgeld }: {
  ort: Ort;
  /** Abends spricht man die Bewohner im Wirtshaus an (D178). */
  abends?: boolean;
  /** Kopfgeld-Brett des Wirts (D178). */
  kopfgeld?: { name: string; stand: string; beute: string }[];
  /** Schmiede (D177). */
  beutel?: Record<string, number>;
  waffenStufen?: WaffenStufen;
  onSchmiede?: (waffe: 'klinge' | 'axt' | 'speer') => void;
  auftraege: Auftragszeile[];
  onRasten: () => void;
  onAnnehmen: (id: string) => void;
  onAbholen: (id: string) => void;
  onSchliessen: () => void;
}) {
  return (
    <div onClick={onSchliessen} style={{
      position: 'fixed', inset: 0, zIndex: 30, display: 'grid', placeItems: 'center',
      background: '#0a0f0dcc', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        maxWidth: 440, width: '100%', maxHeight: '80dvh', overflowY: 'auto',
        background: '#131c19', border: `1px solid ${RAHMEN}`, borderRadius: 12, padding: 18,
      }}>
        <div style={{ color: '#cfe0d8', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
          {ort.name}
        </div>
        <div style={{ color: '#8b9a93', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
          {abends && ort.textAbend ? ort.textAbend : ort.text}
        </div>

        {kopfgeld && kopfgeld.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: '#9b937f', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Kopfgeld am Brett</div>
            {kopfgeld.map(k => (
              <div key={k.name} style={{ borderLeft: `2px solid ${RAHMEN}`, padding: '4px 10px', marginBottom: 6, fontSize: 13, color: '#cfe0d8' }}>
                {k.name}<div style={{ fontSize: 11, color: '#8b9a93' }}>{k.stand} · {k.beute}</div>
              </div>
            ))}
          </div>
        )}

        {ort.schmied && beutel && waffenStufen && onSchmiede && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {(['klinge', 'axt', 'speer'] as const).map(w => {
              const a = angebot(w, waffenStufen[w] ?? 0);
              const kann = !!a && bezahlbar(a, beutel);
              const preis = a ? Object.entries(a.preis).map(([g, n]) => `${GEGENSTAENDE.get(g)?.name ?? g} ×${n} (${beutel[g] ?? 0})`).join(', ') : '';
              return (
                <button key={w} disabled={!kann} onClick={() => onSchmiede(w)} style={{
                  textAlign: 'left', minHeight: 44, borderRadius: 9, padding: '8px 12px', fontSize: 13,
                  background: 'transparent', border: `1px solid ${kann ? GRUEN : RAHMEN}`,
                  color: kann ? GRUEN : '#5c6b64', cursor: kann ? 'pointer' : 'default',
                }}>
                  {a ? <>{a.name}<div style={{ fontSize: 11, opacity: 0.8 }}>{preis}</div></>
                     : `${WAFFENNAME[w]}: meisterlich — mehr geht nicht`}
                </button>
              );
            })}
          </div>
        )}

        {ort.art === 'zuflucht' && (
          <button onClick={onRasten} style={{
            width: '100%', minHeight: 44, borderRadius: 9, fontSize: 14,
            background: 'transparent', border: `1px solid ${GRUEN}`, color: GRUEN,
          }}>Rasten — Team auf volle Kraft</button>
        )}

        {ort.art === 'bewohner' && (
          auftraege.length === 0 ? (
            <div style={{ color: '#5c6b64', fontSize: 12, fontStyle: 'italic' }}>
              Nichts weiter. Kommen Sie wieder, wenn Sie mehr gesehen haben.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {auftraege.map(({ auftrag: a, lage, fortschritt }) => (
                <div key={a.id} style={{
                  border: `1px solid ${lage === 'erfuellt' ? GRUEN : RAHMEN}`,
                  borderRadius: 9, padding: '10px 12px',
                }}>
                  <div style={{
                    color: lage === 'erfuellt' ? GRUEN : '#cfe0d8',
                    fontSize: 13, fontWeight: 600, marginBottom: 4,
                  }}>{a.titel}</div>

                  {/* Der Auftragstext steht nur, solange man ihn braucht. Wer den
                      Auftrag laufen hat, will die Zahl sehen, nicht die Erzählung. */}
                  {lage === 'offen' && (
                    <div style={{ color: '#8b9a93', fontSize: 12, lineHeight: 1.55, marginBottom: 8 }}>
                      {a.text}
                    </div>
                  )}

                  <div style={{
                    fontFamily: 'ui-monospace, monospace', fontSize: 11,
                    color: fortschritt.erfuellt ? GRUEN : '#7d8b85', marginBottom: 8,
                  }}>{zielText(a.ziel, fortschritt)}</div>

                  {lage === 'offen' && (
                    <button onClick={() => onAnnehmen(a.id)} style={{
                      minHeight: 36, padding: '0 16px', borderRadius: 8, fontSize: 12,
                      background: 'transparent', border: `1px solid ${RAHMEN}`, color: '#9fb0a8',
                    }}>Annehmen</button>
                  )}
                  {lage === 'erfuellt' && (
                    <button onClick={() => onAbholen(a.id)} style={{
                      minHeight: 36, padding: '0 16px', borderRadius: 8, fontSize: 12,
                      background: 'transparent', border: `1px solid ${GRUEN}`, color: GRUEN,
                    }}>Abschließen</button>
                  )}
                  {lage === 'angenommen' && (
                    <div style={{ color: '#5c6b64', fontSize: 11 }}>läuft</div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        <div style={{ color: '#5c6b64', fontSize: 11, marginTop: 14, textAlign: 'right' }}>
          daneben tippen zum Weitergehen
        </div>
      </div>
    </div>
  );
}
