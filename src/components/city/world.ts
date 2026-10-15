import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const palette = {
  sky: '#101e28', fog: '#263945', metal: '#43505a', ground: '#17262d',
  cyan: '#68f4ec', mint: '#bfff91', amber: '#ffbd70', white: '#d2e5e9',
};
export const viewpoints = [
  { name: 'The Pyramid', sector: '01', position: [170, 108, 235], target: [0, 32, 0] },
  { name: 'Skyway', sector: '02', position: [115, 39, 170], target: [-40, 23, 0] },
  { name: 'Tower District', sector: '03', position: [-150, 95, 85], target: [-90, 47, -70] },
] as const;
export interface NavigationInput { x: number; y: number; lift: number; zoom: number; }

export function cityTexture(kind: 'windows' | 'ground' | 'pyramid') {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  ctx.fillStyle = kind === 'ground' ? palette.ground : '#152b35';
  ctx.fillRect(0, 0, 256, 512);
  if (kind === 'windows') {
    for (let y = 4; y < 512; y += 12) for (let x = 5; x < 256; x += 14) {
      const n = Math.sin(x * 32.1 + y * 5.7) * 0.5 + 0.5;
      ctx.fillStyle = n > 0.83 ? palette.amber : n > 0.36 ? '#73b8c4' : '#263d48';
      ctx.globalAlpha = n > 0.36 ? 0.7 : 0.6; ctx.fillRect(x, y, 3, 6);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#50616b';
    for (let x = 0; x < 256; x += 64) ctx.fillRect(x, 0, 2, 512);
  } else {
    ctx.strokeStyle = kind === 'pyramid' ? '#639295' : '#30444c';
    ctx.lineWidth = 1;
    for (let y = 0; y < 512; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
    for (let x = 0; x < 256; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
    if (kind === 'ground') { ctx.fillStyle = '#466268'; ctx.fillRect(0, 0, 4, 512); }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  if (kind === 'ground') texture.repeat.set(24, 24);
  return texture;
}

export function buildArchitecture() {
  const shells: THREE.BufferGeometry[] = [], crowns: THREE.BufferGeometry[] = [], lights: THREE.BufferGeometry[] = [];
  const addBox = (list: THREE.BufferGeometry[], x: number, y: number, z: number, w: number, h: number, d: number) => {
    list.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  };
  for (let i = 0; i < 210; i++) {
    const rand = (n: number) => { const r = Math.sin(i * 123.7 + n * 73.3) * 43758.54; return r - Math.floor(r); };
    const x = (rand(1) - 0.5) * 620, z = (rand(2) - 0.5) * 570 - 80;
    if (Math.abs(x) < 74 && Math.abs(z) < 76) continue;
    if (z > 40 && Math.abs(x) < 160) continue;
    const h = 15 + Math.pow(rand(3), 2) * 112;
    const w = 7 + rand(4) * 13, d = 7 + rand(5) * 15;
    addBox(shells, x, h / 2, z, w, h, d);
    addBox(crowns, x, h + 1, z, w + 0.8, 2, d + 0.8);
    if (h > 55) {
      addBox(shells, x, h + 6, z, w * 0.65, 10, d * 0.65);
      addBox(crowns, x, h + 12, z, w * 0.65 + 0.6, 1.5, d * 0.65 + 0.6);
      addBox(lights, x + w / 2 + 0.12, h / 2, z + d / 2, 0.35, h, 0.35);
      addBox(crowns, x, h + 19, z, 0.5, 14, 0.5);
    }
    if (i % 4 === 0) addBox(lights, x, h * 0.8, z + d / 2 + 0.1, w, 0.5, 0.3);
    addBox(shells, x, 2, z, w + 5, 4, d + 5);
  }
  const merge = (parts: THREE.BufferGeometry[]) => { const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); return g; };
  return { shells: merge(shells), crowns: merge(crowns), lights: merge(lights) };
}

export function makeRoad(points: number[][], width: number) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const edgeA: THREE.Vector3[] = [], edgeB: THREE.Vector3[] = [], supports: THREE.BufferGeometry[] = [];
  for (let i = 0; i <= 140; i++) {
    const t = i / 140, p = curve.getPointAt(t), tangent = curve.getTangentAt(t);
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const a = p.clone().addScaledVector(right, width / 2), b = p.clone().addScaledVector(right, -width / 2);
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z); uvs.push(0, t * 50, 1, t * 50);
    edgeA.push(a.clone().add(new THREE.Vector3(0, 0.6, 0))); edgeB.push(b.clone().add(new THREE.Vector3(0, 0.6, 0)));
    if (i < 140) { const v = i * 2; indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
    if (i % 14 === 0) supports.push(new THREE.BoxGeometry(2, p.y, 3).translate(p.x, p.y / 2, p.z));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const supportGeometry = mergeGeometries(supports); supports.forEach(s => s.dispose());
  return { curve, geometry, supportGeometry, edges: [new THREE.CatmullRomCurve3(edgeA), new THREE.CatmullRomCurve3(edgeB)] };
}
