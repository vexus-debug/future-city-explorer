import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import * as THREE from 'three';
import { buildArchitecture, cityTexture, makeRoad, palette, viewpoints, type NavigationInput } from './world';

function Architecture() {
  const geometry = useMemo(buildArchitecture, []);
  const windows = useMemo(() => cityTexture('windows'), []);
  useEffect(() => () => { Object.values(geometry).forEach(g => g?.dispose()); windows.dispose(); }, [geometry, windows]);
  return <>
    {geometry.shells && <mesh geometry={geometry.shells}><meshStandardMaterial map={windows} emissiveMap={windows} emissive={palette.white} emissiveIntensity={0.7} metalness={0.65} roughness={0.4} /></mesh>}
    {geometry.crowns && <mesh geometry={geometry.crowns}><meshStandardMaterial color={palette.metal} metalness={0.8} roughness={0.32} /></mesh>}
    {geometry.lights && <mesh geometry={geometry.lights}><meshBasicMaterial color={palette.cyan} toneMapped={false} /></mesh>}
  </>;
}
function Pyramid() {
  const texture = useMemo(() => cityTexture('pyramid'), []);
  const ribs = useMemo(() => {
    const pos: number[] = [];
    const corners: [number, number][] = [[-58, -58], [58, -58], [58, 58], [-58, 58]];
    for (const [x,z] of corners) pos.push(x, 1, z, 0, 102, 0);
    for (let y = 5; y < 100; y += 6) {
      const s = 58 * (1 - y / 102);
      pos.push(-s,y,-s, s,y,-s, s,y,-s, s,y,s, s,y,s, -s,y,s, -s,y,s, -s,y,-s);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g;
  }, []);
  useEffect(() => () => { texture.dispose(); ribs.dispose(); }, [texture, ribs]);
  return <group>
    <mesh position-y={50.5} rotation-y={Math.PI / 4}><coneGeometry args={[82, 101, 4, 1]} /><meshStandardMaterial map={texture} color={palette.metal} metalness={0.8} roughness={0.33} /></mesh>
    <lineSegments geometry={ribs}><lineBasicMaterial color={palette.cyan} toneMapped={false} transparent opacity={0.65} /></lineSegments>
    <mesh position-y={2}><boxGeometry args={[121, 4, 121]} /><meshStandardMaterial color={palette.metal} metalness={0.8} /></mesh>
    <mesh position={[0, 6, 61]}><boxGeometry args={[19, 8, 0.6]} /><meshBasicMaterial color={palette.cyan} toneMapped={false} /></mesh>
    <mesh position={[0, 103, 0]}><octahedronGeometry args={[1.6]} /><meshBasicMaterial color={palette.mint} toneMapped={false} /></mesh>
  </group>;
}
const roadPoints = [
  [[-330,19,110],[-150,22,92],[-20,24,125],[110,30,110],[180,34,5],[170,29,-120],[290,24,-230]],
  [[-340,37,-180],[-160,38,-125],[-75,33,-65],[-94,28,32],[-180,22,125],[-180,18,280]],
  [[-260,13,230],[-70,15,202],[90,17,185],[270,20,210]],
];
function Skyways({ motion }: { motion: boolean }) {
  const roads = useMemo(() => roadPoints.map(p => makeRoad(p, 9)), []);
  const traffic = useRef<THREE.InstancedMesh>(null);
  const time = useRef(0), dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, rawDelta) => {
    if (motion) time.current += Math.min(rawDelta, 0.05);
    const mesh = traffic.current; if (!mesh) return;
    for (let i = 0; i < 42; i++) {
      const road = roads[i % 3], t = (i / 14 + time.current * (0.008 + (i % 4) * 0.002)) % 1;
      if (!road) continue;
      const p = road.curve.getPointAt(t), tangent = road.curve.getTangentAt(t);
      dummy.position.copy(p).add(new THREE.Vector3(-tangent.z * 2, 1, tangent.x * 2));
      dummy.rotation.y = Math.atan2(tangent.x, tangent.z); dummy.scale.set(0.7, 0.35, 2.8); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  useEffect(() => () => roads.forEach(r => { r.geometry.dispose(); r.supportGeometry?.dispose(); }), [roads]);
  return <>
    {roads.map((r, i) => <group key={i}>
      <mesh geometry={r.geometry}><meshStandardMaterial color={palette.ground} side={THREE.DoubleSide} roughness={0.42} metalness={0.7} /></mesh>
      {r.supportGeometry && <mesh geometry={r.supportGeometry}><meshStandardMaterial color={palette.metal} /></mesh>}
      {r.edges.map((edge, j) => <mesh key={j}><tubeGeometry args={[edge, 140, 0.22, 4, false]} /><meshBasicMaterial color={i === 1 ? palette.cyan : palette.amber} toneMapped={false} /></mesh>)}
      <mesh><tubeGeometry args={[r.curve, 140, 0.055, 3, false]} /><meshBasicMaterial color={palette.white} /></mesh>
    </group>)}
    <instancedMesh ref={traffic} args={[undefined, undefined, 42]}><boxGeometry /><meshBasicMaterial color={palette.amber} toneMapped={false} /></instancedMesh>
  </>;
}
function Ground() {
  const texture = useMemo(() => cityTexture('ground'), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh rotation-x={-Math.PI / 2} position-y={-0.2}><planeGeometry args={[1500, 1500]} /><meshStandardMaterial map={texture} roughness={0.55} metalness={0.6} /></mesh>;
}
export interface SceneProps {
  input: RefObject<NavigationInput>; preset: number; reset: number; tour: boolean; motion: boolean; quality: boolean;
  onPosition: (x: number, z: number, altitude: number) => void;
}
function Navigation({ input, preset, reset, tour, motion, onPosition }: SceneProps) {
  const controls = useRef<OrbitImpl>(null);
  const transitioning = useRef(true), timer = useRef(0);
  const forward = useMemo(() => new THREE.Vector3(), []), right = useMemo(() => new THREE.Vector3(), []), move = useMemo(() => new THREE.Vector3(), []);
  const keys = useRef(new Set<string>());
  useEffect(() => { transitioning.current = true; }, [preset, reset]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE'].includes(e.code)) { keys.current.add(e.code); e.preventDefault(); } };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); input.current.x = 0; input.current.y = 0; input.current.lift = 0; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [input]);
  useFrame(({ camera }, rawDelta) => {
    const c = controls.current; if (!c) return;
    const dt = Math.min(rawDelta, 0.05), k = keys.current, n = input.current;
    const x = n.x + (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const y = -n.y + (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const lift = n.lift + (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
    if (x || y || lift || n.zoom) transitioning.current = false;
    if (transitioning.current) {
      const view = viewpoints[preset] ?? viewpoints[0], p = new THREE.Vector3(...view.position), target = new THREE.Vector3(...view.target);
      if (camera instanceof THREE.PerspectiveCamera && camera.aspect < 0.8) p.sub(target).multiplyScalar(1.3).add(target);
      camera.position.lerp(p, 1 - Math.exp(-3 * dt)); c.target.lerp(target, 1 - Math.exp(-3 * dt));
      if (camera.position.distanceTo(p) < 0.1) transitioning.current = false;
    } else {
      camera.getWorldDirection(forward); forward.y = 0; forward.normalize(); right.crossVectors(forward, camera.up).normalize();
      move.copy(forward).multiplyScalar(y).addScaledVector(right, x);
      if (move.lengthSq() > 1) move.normalize(); move.multiplyScalar(55 * dt); move.y = lift * 40 * dt;
      const nextX = c.target.x + move.x, nextZ = c.target.z + move.z;
      if (Math.abs(nextX) < 330 && Math.abs(nextZ) < 330 && camera.position.y + move.y > 8 && camera.position.y + move.y < 250) { camera.position.add(move); c.target.add(move); }
      if (n.zoom) { camera.position.sub(c.target).multiplyScalar(n.zoom > 0 ? 0.8 : 1.25).add(c.target); n.zoom = 0; }
      if (tour && motion && !x && !y && !lift) {
        camera.position.sub(c.target).applyAxisAngle(camera.up, dt * 0.035).add(c.target);
      }
    }
    c.update(); timer.current += dt;
    if (timer.current > 0.5) { onPosition(camera.position.x, camera.position.z, camera.position.y); timer.current = 0; }
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.075} minDistance={22} maxDistance={500} maxPolarAngle={Math.PI / 2 - 0.035} minPolarAngle={0.2} rotateSpeed={0.45} panSpeed={0.65} onStart={() => { transitioning.current = false; }} touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }} />;
}
export function CityScene(props: SceneProps) {
  return <>
    <color attach="background" args={[palette.sky]} />
    <fog attach="fog" args={[palette.fog, 220, 730]} />
    <ambientLight intensity={0.7} color={palette.white} />
    <hemisphereLight args={[palette.white, palette.ground, 1.2]} />
    <directionalLight position={[100, 200, 100]} intensity={2} color={palette.white} />
    <Environment resolution={64}><Lightformer intensity={2} position={[0, 160, 0]} rotation-x={Math.PI / 2} scale={[400,400,1]} /><Lightformer color={palette.cyan} intensity={1} position={[-200,60,0]} rotation-y={Math.PI / 2} scale={[100,100,1]} /></Environment>
    <Ground /><Architecture /><Pyramid /><Skyways motion={props.motion} /><Navigation {...props} />
    {props.quality && <EffectComposer multisampling={0}><Bloom intensity={0.75} luminanceThreshold={0.8} luminanceSmoothing={0.4} mipmapBlur resolutionScale={0.5} /></EffectComposer>}
  </>;
}
