import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const palette = {
  sky: '#050a10', fog: '#0d1722', metal: '#2a333d', ground: '#0a1017', curb: '#18222d',
  obsidian: '#0b0f15', cyan: '#5ff4ff', mint: '#bfff91', amber: '#ffb35c', magenta: '#ff3fb4',
  white: '#e6f2ff', moon: '#9fb8ff', red: '#ff2a3a',
};
export const viewpoints = [
  { name: 'The Pyramid', sector: '01', position: [170, 108, 235], target: [0, 32, 0] },
  { name: 'Skyway', sector: '02', position: [115, 39, 170], target: [-40, 23, 0] },
  { name: 'Tower District', sector: '03', position: [-150, 95, 85], target: [-90, 47, -70] },
] as const;
export interface NavigationInput { x: number; y: number; lift: number; zoom: number; }

/** City grid: blocks of CELL with STREET-wide avenues between them. */
export const CELL = 60, STREET = 14, GRID = 5, PLAZA = 88;
const hash = (a: number, b: number) => { const r = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return r - Math.floor(r); };

export function cityTexture(kind: 'windows' | 'ground' | 'pyramid') {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  if (kind === 'windows') {
    ctx.fillStyle = '#05080d'; ctx.fillRect(0, 0, 256, 512);
    for (let y = 4; y < 512; y += 10) for (let x = 3; x < 256; x += 8) {
      // clusters: lit floors grouped by coarse noise
      const cluster = hash(Math.floor(x / 40), Math.floor(y / 30)), n = hash(x, y);
      let c = '#0d1520';
      if (cluster > 0.55 && n > 0.35) c = cluster > 0.9 ? '#ff3fb4' : cluster > 0.75 ? '#ffb35c' : '#5ff4ff';
      else if (n > 0.93) c = '#ffd9a0';
      ctx.fillStyle = c; ctx.fillRect(x, y, 5, 6);
    }
    ctx.fillStyle = '#121a24';
    for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 0, 2, 512);
  } else if (kind === 'ground') {
    canvas.height = 256;
    ctx.fillStyle = palette.ground; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const v = 10 + Math.floor(hash(i, 3) * 18);
      ctx.fillStyle = `rgb(${v},${v + 4},${v + 10})`;
      ctx.fillRect(hash(i, 1) * 256, hash(i, 2) * 256, 1.5, 1.5);
    }
  } else {
    ctx.fillStyle = palette.obsidian; ctx.fillRect(0, 0, 256, 512);
    ctx.fillStyle = '#141b24';
    for (let y = 0; y < 512; y += 32) ctx.fillRect(0, y, 256, 2);
    for (let x = 0; x < 256; x += 64) ctx.fillRect(x, 0, 1, 512);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  if (kind === 'ground') texture.repeat.set(40, 40);
  return texture;
}

const merge = (parts: THREE.BufferGeometry[]) => { const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); return g; };
const box = (list: THREE.BufferGeometry[], x: number, y: number, z: number, w: number, h: number, d: number) =>
  list.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));

/** Iterate block centres, skipping the central plaza. */
function forBlocks(fn: (cx: number, cz: number, gx: number, gz: number) => void) {
  for (let gx = -GRID; gx <= GRID; gx++) for (let gz = -GRID; gz <= GRID; gz++) {
    const cx = gx * CELL, cz = gz * CELL;
    if (Math.abs(cx) < PLAZA && Math.abs(cz) < PLAZA) continue;
    fn(cx, cz, gx, gz);
  }
}

export function buildStreets() {
  const curbs: THREE.BufferGeometry[] = [], marks: THREE.BufferGeometry[] = [];
  const block = CELL - STREET, extent = GRID * CELL + CELL / 2;
  forBlocks((cx, cz) => {
    box(curbs, cx, 0.25, cz, block, 0.5, block);
  });
  // central plaza with raised terraces
  box(curbs, 0, 0.3, 0, PLAZA * 2 - STREET, 0.6, PLAZA * 2 - STREET);
  box(curbs, 0, 0.9, 0, 140, 0.6, 140);
  // lane dividers along every avenue
  for (let g = -GRID; g < GRID; g++) {
    const line = g * CELL + CELL / 2;
    for (let s = -extent; s < extent; s += 8) {
      if (Math.abs(line) < PLAZA && Math.abs(s) < PLAZA) continue;
      box(marks, line, 0.02, s, 0.25, 0.02, 3.5);
      box(marks, s, 0.02, line, 3.5, 0.02, 0.25);
    }
  }
  return { curbs: merge(curbs), marks: merge(marks) };
}

export function buildArchitecture() {
  const shells: THREE.BufferGeometry[] = [], crowns: THREE.BufferGeometry[] = [];
  const lights: THREE.BufferGeometry[] = [], neon: THREE.BufferGeometry[] = [];
  const lot = (CELL - STREET) / 2;
  forBlocks((cx, cz, gx, gz) => {
    if (cz > 40 && Math.abs(cx) < 160) return; // keep skyway sightline open
    const dist = Math.hypot(cx, cz) / (GRID * CELL);
    for (let i = 0; i < 4; i++) {
      const r = (n: number) => hash(gx * 13 + i * 3.1 + n, gz * 7 + n * 1.7);
      if (r(9) < 0.12) continue; // occasional empty lot
      const x = cx + (i % 2 ? 1 : -1) * lot / 2, z = cz + (i < 2 ? -1 : 1) * lot / 2;
      const w = lot - 3 - r(1) * 3, d = lot - 3 - r(2) * 3;
      const core = Math.max(0, 1 - dist * 1.3);
      const h = 14 + core * 110 * (0.5 + r(3)) + r(4) * 18;
      // podium
      box(shells, x, 3, z, w, 6, d);
      box(neon, x, 6.3, z + d / 2 + 0.05, w * 0.9, 0.4, 0.1);
      // body with setbacks
      const tiers = h > 70 ? 3 : h > 35 ? 2 : 1;
      let y = 6, tw = w * 0.9, td = d * 0.9;
      for (let t = 0; t < tiers; t++) {
        const th = (h - 6) / tiers;
        box(shells, x, y + th / 2, z, tw, th, td);
        box(crowns, x, y + th + 0.4, z, tw + 0.6, 0.8, td + 0.6);
        if (t === tiers - 1 && r(5) > 0.5) box(lights, x + tw / 2 + 0.1, y + th / 2, z + td / 2 + 0.1, 0.3, th, 0.3);
        y += th; tw *= 0.78; td *= 0.78;
      }
      // rooftop bulkheads + masts
      box(crowns, x - tw * 0.2, y + 2, z, tw * 0.4, 4, td * 0.5);
      box(crowns, x + tw * 0.25, y + 1.2, z + td * 0.2, tw * 0.3, 2.4, td * 0.3);
      if (h > 60) { box(crowns, x, y + 10, z, 0.4, 16, 0.4); box(neon, x, y + 18.4, z, 0.9, 0.9, 0.9); }
    }
  });
  return { shells: merge(shells), crowns: merge(crowns), lights: merge(lights), neon: merge(neon) };
}

export function buildPyramid() {
  const body: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = [];
  const tiers = 10, base = 118, top = 14, height = 100;
  for (let t = 0; t < tiers; t++) {
    const s = base - (base - top) * (t / (tiers - 1)), th = height / tiers, y = t * th + th / 2 + 1.2;
    box(body, 0, y, 0, s, th, s);
    // recessed horizontal light channel near each terrace lip
    const ch = s + 0.2, cy = y + th / 2 - 1.6;
    box(glow, 0, cy, ch / 2, ch, 0.35, 0.2); box(glow, 0, cy, -ch / 2, ch, 0.35, 0.2);
    box(glow, ch / 2, cy, 0, 0.2, 0.35, ch); box(glow, -ch / 2, cy, 0, 0.2, 0.35, ch);
    // vertical channels at each face centre
    box(glow, 0, y, ch / 2, 0.5, th, 0.2); box(glow, 0, y, -ch / 2, 0.5, th, 0.2);
    box(glow, ch / 2, y, 0, 0.2, th, 0.5); box(glow, -ch / 2, y, 0, 0.2, th, 0.5);
  }
  return { body: merge(body), glow: merge(glow), apex: height + 1.2 };
}

export function makeRoad(points: number[][], width: number) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const edgeA: THREE.Vector3[] = [], edgeB: THREE.Vector3[] = [], supports: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= 140; i++) {
    const t = i / 140, p = curve.getPointAt(t), tangent = curve.getTangentAt(t);
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const a = p.clone().addScaledVector(right, width / 2), b = p.clone().addScaledVector(right, -width / 2);
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z); uvs.push(0, t * 50, 1, t * 50);
    edgeA.push(a.clone().add(new THREE.Vector3(0, 0.6, 0))); edgeB.push(b.clone().add(new THREE.Vector3(0, 0.6, 0)));
    if (i < 140) { const v = i * 2; indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
    const yaw = Math.atan2(tangent.x, tangent.z);
    if (i % 14 === 0) {
      const pier = new THREE.BoxGeometry(width * 0.5, p.y, 3).rotateY(yaw).translate(p.x, p.y / 2, p.z);
      const cap = new THREE.BoxGeometry(width + 2, 1.2, 4).rotateY(yaw).translate(p.x, p.y - 0.7, p.z);
      supports.push(pier, cap);
    }
    if (i % 35 === 17) { // overhead signage gantry
      for (const side of [1, -1]) supports.push(new THREE.BoxGeometry(0.6, 8, 0.6).translate(0, 4, 0).rotateY(yaw).translate(p.x + right.x * side * (width / 2 + 0.5), p.y, p.z + right.z * side * (width / 2 + 0.5)));
      supports.push(new THREE.BoxGeometry(width + 2, 1.6, 0.8).rotateY(yaw).translate(p.x, p.y + 8, p.z));
    }
  }
  void up;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const supportGeometry = merge(supports);
  return { curve, geometry, supportGeometry, edges: [new THREE.CatmullRomCurve3(edgeA), new THREE.CatmullRomCurve3(edgeB)] };
}
