/** Opt-in-Himmelsprobe mit Three-Geospatial; ersetzt weder Licht noch Nebel der Welt. */
import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { PrecomputedTexturesGenerator, SkyMaterial } from '@takram/three-atmosphere';

export function TakramProbe({ sonnenstand, meldeBereit }: {
  sonnenstand: readonly [number, number, number];
  meldeBereit: (bereit: boolean) => void;
}) {
  const gl = useThree(s => s.gl);
  const [bereit, setzeBereit] = useState(false);
  const material = useMemo(() => {
    const m = new SkyMaterial({ moon: false, ground: false, correctAltitude: false });
    // Lokales Y ist die Erdradiale; Takram rechnet in erdzentrierten Metern.
    m.worldToECEFMatrix.set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 6360000, 0, 0, 0, 1);
    return m;
  }, []);
  useEffect(() => {
    material.sunDirection.set(sonnenstand[0], -sonnenstand[2], sonnenstand[1]).normalize();
  }, [material, sonnenstand]);
  useEffect(() => {
    let aktiv = true;
    const generator = new PrecomputedTexturesGenerator(gl);
    generator.update().then(texturen => {
      if (!aktiv) return;
      Object.assign(material, texturen);
      setzeBereit(true);
      meldeBereit(true);
    }).catch(fehler => console.error('Takram-Himmelsprobe:', fehler));
    return () => {
      aktiv = false;
      meldeBereit(false);
      generator.dispose();
      material.dispose();
    };
  }, [gl, material, meldeBereit]);
  if (!bereit) return null;
  return <mesh material={material} frustumCulled={false} renderOrder={-1000}>
    <planeGeometry args={[2, 2]} />
  </mesh>;
}
