import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Lightweight hero ambience (design home.md §1):
 * ~300 drifting stars + a faint wireframe dome hemisphere rotating slowly.
 */
export default function HeroBackdrop() {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 3.2], fov: 55 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      <StarField />
      <DomeWireframe />
    </Canvas>
  );
}

function StarField() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const rng = mulberry32(1234);
    const arr = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      arr[i * 3] = (rng() - 0.5) * 8;
      arr[i * 3 + 1] = (rng() - 0.5) * 5;
      arr[i * 3 + 2] = (rng() - 0.5) * 4 - 1;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (ref.current) {
      // slow ambient drift (~0.02px/frame equivalent)
      ref.current.rotation.y += delta * 0.008;
      ref.current.position.x = Math.sin(Date.now() * 0.00005) * 0.08;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#F2EEFB"
        size={0.02}
        sizeAttenuation
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </points>
  );
}

function DomeWireframe() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.005;
  });
  return (
    <mesh ref={ref} position={[0, -0.9, -1]} rotation={[0, 0, 0]}>
      {/* half-sphere = dome */}
      <sphereGeometry args={[2.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshBasicMaterial color="#6B4FBB" wireframe transparent opacity={0.12} />
    </mesh>
  );
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
