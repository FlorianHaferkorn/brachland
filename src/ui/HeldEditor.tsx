/**
 * Charakter-Editor vor dem ersten Schritt (D175): Name, Geschlecht, Körper, Kleidung, Frisur, Bart,
 * Haut- und Haarfarbe, mit drehbarer Vorschau. Die Wahl landet im Spielstand (`held`).
 *
 * Geschlecht und Körper sind getrennt (`spieler/held.ts`): männlich/weiblich setzen den Körper vor,
 * neutral lässt ihn frei und das Spiel verzichtet auf Pronomen.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as klonSkelett } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  HAARE, HAARNAMEN, HAARFARBEN, KLEIDNAMEN, STANDARD_HELD, gestaltPfad, HELD_CLIPS, legeWahlAn,
  type HeldWahl, type Geschlecht, type Kleid, type Haar,
} from '../spieler/held.js';

function Vorschau({ wahl, dreh }: { wahl: HeldWahl; dreh: React.RefObject<number> }) {
  const { scene } = useGLTF(gestaltPfad(wahl));
  const { animations } = useGLTF(HELD_CLIPS);
  const figur = useMemo(() => klonSkelett(scene), [scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(figur), [figur]);
  useEffect(() => {
    const idle = animations.find(a => a.name === 'Idle');
    if (idle) mixer.clipAction(idle).play();
    return () => { mixer.stopAllAction(); };
  }, [mixer, animations]);
  useEffect(() => { legeWahlAn(figur, wahl); }, [figur, wahl]);
  const gruppe = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    mixer.update(Math.min(dt, 0.1));
    if (gruppe.current) gruppe.current.rotation.y = dreh.current ?? 0;
  });
  return <group ref={gruppe}><primitive object={figur} /></group>;
}

const knopf = (an: boolean): React.CSSProperties => ({
  padding: '7px 11px', borderRadius: 6, border: `1px solid ${an ? '#d8c39a' : '#3a4640'}`,
  background: an ? '#3b3325' : '#141a17', color: '#e6ddc9', font: '13px system-ui, sans-serif', cursor: 'pointer',
});
const zeile: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' };
const titel: React.CSSProperties = { font: '11px system-ui, sans-serif', letterSpacing: 1, color: '#9b937f', textTransform: 'uppercase', marginTop: 10 };

export function HeldEditor({ start, onFertig }: { start?: HeldWahl | null; onFertig: (w: HeldWahl) => void }) {
  const [w, setW] = useState<HeldWahl>(start ?? STANDARD_HELD);
  // Die Figur schaut nach −Z, die Kamera steht auf +Z: halbe Drehung, damit man ins Gesicht sieht.
  const dreh = useRef(Math.PI);
  const ziehen = useRef<number | null>(null);
  const setze = <K extends keyof HeldWahl>(k: K, v: HeldWahl[K]) => setW(alt => ({ ...alt, [k]: v }));
  const geschlecht = (g: Geschlecht) => setW(alt => ({
    ...alt, geschlecht: g, koerper: g === 'n' ? alt.koerper : g,
    bart: g === 'w' ? false : alt.bart,
    name: alt.name === STANDARD_HELD.name || alt.name === 'Wanderer' || alt.name === 'Wandernde'
      ? (g === 'm' ? 'Wanderer' : g === 'w' ? 'Wanderin' : 'Wandernde') : alt.name,
  }));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 40, display: 'flex', flexWrap: 'wrap', background: '#0b0f0d',
      color: '#e6ddc9', overflow: 'auto',
    }}>
      <div
        style={{ flex: '1 1 340px', minHeight: 360, position: 'relative', touchAction: 'none' }}
        onPointerDown={e => { ziehen.current = e.clientX; }}
        onPointerMove={e => { if (ziehen.current !== null) { dreh.current += (e.clientX - ziehen.current) * 0.01; ziehen.current = e.clientX; } }}
        onPointerUp={() => { ziehen.current = null; }}
        onPointerLeave={() => { ziehen.current = null; }}
      >
        <Canvas camera={{ position: [0, 1.15, 3.6], fov: 30 }} dpr={[1, 2]} shadows
                onCreated={({ camera }) => camera.lookAt(0, 0.98, 0)}>
          <color attach="background" args={['#1a201d']} />
          <hemisphereLight args={['#c9c2b0', '#2a2620', 1.1]} />
          <directionalLight position={[2, 3, 2.5]} intensity={2.4} castShadow />
          <directionalLight position={[-2.5, 1.5, -2]} intensity={0.8} color="#9fb4c9" />
          <mesh rotation-x={-Math.PI / 2} receiveShadow><circleGeometry args={[1.2, 40]} /><meshStandardMaterial color="#2a2f2b" /></mesh>
          <Suspense fallback={null}><Vorschau wahl={w} dreh={dreh} /></Suspense>
        </Canvas>
        <div style={{ position: 'absolute', bottom: 10, width: '100%', textAlign: 'center', font: '11px system-ui', color: '#8d8674' }}>
          ziehen zum Drehen
        </div>
      </div>
      <div style={{ flex: '1 1 300px', maxWidth: 460, padding: '18px 18px 24px' }}>
        <div style={{ font: '600 20px Georgia, serif', letterSpacing: 0.5 }}>Wer geht ins Œntal?</div>
        <div style={titel}>Name</div>
        <input value={w.name} maxLength={24} onChange={e => setze('name', e.target.value)} style={{
          width: '100%', padding: '8px 10px', background: '#141a17', color: '#e6ddc9',
          border: '1px solid #3a4640', borderRadius: 6, font: '15px system-ui', boxSizing: 'border-box',
        }} />
        <div style={titel}>Geschlecht</div>
        <div style={zeile}>
          {([['w', 'weiblich'], ['m', 'männlich'], ['n', 'neutral']] as const).map(([g, t]) => (
            <button key={g} style={knopf(w.geschlecht === g)} onClick={() => geschlecht(g)}>{t}</button>))}
        </div>
        <div style={titel}>Körper</div>
        <div style={zeile}>
          {([['w', 'schmal'], ['m', 'breit']] as const).map(([k, t]) => (
            <button key={k} style={knopf(w.koerper === k)} onClick={() => setze('koerper', k)}>{t}</button>))}
        </div>
        <div style={titel}>Kleidung</div>
        <div style={zeile}>
          {(Object.keys(KLEIDNAMEN) as Kleid[]).map(k => (
            <button key={k} style={knopf(w.kleid === k)} onClick={() => setze('kleid', k)}>{KLEIDNAMEN[k]}</button>))}
        </div>
        <div style={titel}>Frisur</div>
        <div style={zeile}>
          {HAARE.map(h => (
            <button key={h} style={knopf(w.haar === h)} onClick={() => setze('haar', h as Haar)}>{HAARNAMEN[h]}</button>))}
          <button style={knopf(w.bart)} onClick={() => setze('bart', !w.bart)}>Bart</button>
        </div>
        <div style={titel}>Haarfarbe</div>
        <div style={zeile}>
          {HAARFARBEN.map(f => (
            <button key={f} aria-label={f} onClick={() => setze('haarfarbe', f)} style={{
              width: 28, height: 28, borderRadius: 14, background: f, cursor: 'pointer',
              border: `2px solid ${w.haarfarbe === f ? '#e6ddc9' : '#3a4640'}`,
            }} />))}
        </div>
        <div style={titel}>Haut</div>
        <input type="range" min={0} max={1} step={0.01} value={w.haut} onChange={e => setze('haut', Number(e.target.value))}
               style={{ width: '100%' }} />
        <button onClick={() => onFertig({ ...w, name: w.name.trim() || STANDARD_HELD.name })} style={{
          ...knopf(true), marginTop: 22, width: '100%', padding: '12px', font: '600 15px system-ui',
          background: '#5a4a2c',
        }}>Aufbrechen</button>
      </div>
    </div>
  );
}
