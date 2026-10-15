import { Suspense, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Canvas } from '@react-three/fiber';
import { ArrowDown, ArrowUp, Box, ChevronDown, Compass, Crosshair, Expand, Layers3, MapPin, Minus, Pause, Play, Plus, RotateCcw, Settings2, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CityScene } from './CityScene';
import { viewpoints, type NavigationInput } from './world';

function Joystick({ input }: { input: React.RefObject<NavigationInput> }) {
  const knob = useRef<HTMLSpanElement>(null);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const r = e.currentTarget.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / 38, y = (e.clientY - r.top - r.height / 2) / 38;
    const len = Math.hypot(x,y); if (len > 1) { x /= len; y /= len; }
    input.current.x = x; input.current.y = y;
    if (knob.current) knob.current.style.transform = `translate(${x * 29}px, ${y * 29}px)`;
  };
  const release = () => { input.current.x = 0; input.current.y = 0; if (knob.current) knob.current.style.transform = 'translate(0,0)'; };
  return <div className="joystick" role="slider" aria-label="Move through city" aria-valuemin={-1} aria-valuemax={1} aria-valuenow={0} tabIndex={0}
    onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
    <span className="joystick-ring" /><span className="joystick-tick tick-top" /><span className="joystick-tick tick-bottom" /><span className="joystick-tick tick-left" /><span className="joystick-tick tick-right" />
    <span className="joystick-knob" ref={knob}><Plus size={19} strokeWidth={1} /></span>
  </div>;
}
function MiniMap({ x, z }: { x: number; z: number }) {
  return <svg viewBox="0 0 160 140" className="minimap" aria-label="City map">
    <defs><pattern id="map-grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M 16 0 L 0 0 0 16" fill="none" className="map-grid" strokeWidth="0.6" /></pattern></defs>
    <rect width="160" height="140" fill="url(#map-grid)" />
    {Array.from({length: 42},(_,i) => { const bx = (i * 31 % 145) + 5, bz = (i * 47 % 122) + 6; return Math.abs(bx-80)<20 && Math.abs(bz-67)<20 ? null : <rect key={i} x={bx} y={bz} width={5+i%4} height={6+i%6} className="map-building" />; })}
    <path d="M-5 110 Q35 65 83 98 T145 54 T155 -5 M-5 34 Q40 38 51 65 T26 145" className="map-road" fill="none" strokeWidth="2" />
    <path d="M80 46 L98 66 L80 86 L62 66 Z" className="map-pyramid" fill="none" strokeWidth="1" />
    <circle cx={80+x/5} cy={65+z/5} r="4" className="map-player" />
    <text x="146" y="13" className="map-north">N</text>
  </svg>;
}
export function CityExplorer() {
  const [preset, setPreset] = useState(0), [reset, setReset] = useState(0), [tour, setTour] = useState(false);
  const [settings, setSettings] = useState(false), [quality, setQuality] = useState(true), [motion, setMotion] = useState(true);
  const [position, setPosition] = useState({ x:170, z:235, altitude:108 });
  const [ready, setReady] = useState(false), [fullscreen, setFullscreen] = useState(false);
  const input = useRef<NavigationInput>({x:0, y:0, lift:0, zoom:0});
  const selectedView = viewpoints[preset] ?? viewpoints[0];
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) setMotion(false);
    if (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 640) setQuality(false);
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        screen.orientation?.unlock?.();
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
        const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> };
        if (window.matchMedia('(pointer: coarse)').matches) {
          try { await orientation?.lock?.('landscape'); } catch { /* Manual rotation remains available where locking is unsupported. */ }
        }
      }
    } catch { setFullscreen(Boolean(document.fullscreenElement)); }
  };
  const liftProps = (direction: number) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => { e.currentTarget.setPointerCapture(e.pointerId); input.current.lift = direction; },
    onPointerUp: () => { input.current.lift = 0; }, onPointerCancel: () => { input.current.lift = 0; }, onLostPointerCapture: () => { input.current.lift = 0; },
  });
  return <main className="city-explorer">
    <section className="rotate-prompt" aria-label="Landscape orientation required">
      <Smartphone size={48} strokeWidth={1.25} />
      <h2>Turn to explore.</h2>
      <p>Rotate your phone horizontally.</p>
      <Button variant="outline" onClick={toggleFullscreen}><Expand /> Enter fullscreen</Button>
    </section>
    <div className="city-canvas"><Canvas camera={{position:[170,108,235], fov:48, near:1, far:1600}} dpr={quality ? [1,1.5] : 1} gl={{antialias:true, powerPreference:'high-performance'}} onCreated={() => setReady(true)} fallback={<div className="canvas-fallback">Your browser does not support 3D. Try a browser with WebGL enabled.</div>}>
      <Suspense fallback={null}><CityScene input={input} preset={preset} reset={reset} tour={tour} motion={motion} quality={quality} onPosition={(x,z,altitude) => setPosition({x,z,altitude})} /></Suspense>
    </Canvas></div>
    <div className="scene-shade" />
    <div className="city-hud">
      <header className="city-header">
        <div className="brand-group"><div className="brand-mark"><Box size={23} strokeWidth={1.25} /></div><div><div className="brand-name">FUTURE CITY <span>5.5</span></div><div className="brand-subtitle">WORLD EXPLORER</div></div></div>
        <div className="header-center"><span className="status-light" /> LIVE ENVIRONMENT <span className="header-separator">/</span> FREE ROAM</div>
        <div className="header-actions"><Button variant="ghost" size="icon" aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title="Fullscreen" onClick={toggleFullscreen}><Expand /></Button><Button variant="ghost" size="icon" aria-label="Settings" title="Settings" onClick={() => setSettings(!settings)}><Settings2 /></Button><span className="version-label">WEB / 01</span></div>
      </header>
      <section className="location-heading"><div className="eyebrow"><span /> NEO METROPOLIS <span className="eyebrow-line" /></div><h1>Future<br />City.</h1><p>Sector 01 — The new horizon</p></section>
      <div className="landmark-label"><span className="landmark-cross" /><span className="landmark-rule" /><div><span className="micro-label">SECTOR {selectedView.sector}</span><span className="landmark-name">{selectedView.name}</span></div></div>
      <aside className="world-status"><div className="eyebrow">ENVIRONMENT</div><div className="environment-row"><span className="status-light" /> ONLINE <span>22:48</span></div><div className="status-divider" /><div className="coordinates"><span>X {position.x.toFixed(0).padStart(3,'0')}</span><span>Z {position.z.toFixed(0).padStart(3,'0')}</span></div><div className="altitude">ALTITUDE <span>{position.altitude.toFixed(0)}<small> m</small></span></div></aside>
      <div className="view-toolbar"><Button variant="ghost" size="icon" title="Zoom in" aria-label="Zoom in" onClick={() => {input.current.zoom=1;}}><Plus /></Button><Button variant="ghost" size="icon" title="Zoom out" aria-label="Zoom out" onClick={() => {input.current.zoom=-1;}}><Minus /></Button><span /><Button variant="ghost" size="icon" title="Reset view" aria-label="Reset view" onClick={() => setReset(r=>r+1)}><RotateCcw /></Button><Button variant="ghost" size="icon" title="Focus landmark" aria-label="Focus landmark" onClick={() => setReset(r=>r+1)}><Crosshair /></Button></div>
      <div className="bottom-left"><div className="navigation-controls"><Joystick input={input} /><div className="lift-controls"><Button variant="ghost" size="icon" aria-label="Ascend" title="Ascend" {...liftProps(1)}><ArrowUp /></Button><Button variant="ghost" size="icon" aria-label="Descend" title="Descend" {...liftProps(-1)}><ArrowDown /></Button></div></div><div className="nav-caption"><Compass size={12} /> EXPLORATION MODE</div></div>
      <nav className="landmark-nav" aria-label="Landmark views"><div className="nav-heading"><span className="micro-label">DISCOVER THE CITY</span><span className="micro-label">03 LANDMARKS</span></div><div className="landmark-buttons">{viewpoints.map((v,i)=><Button key={v.name} variant="ghost" className={`landmark-button ${preset===i ? 'is-active' : ''}`} onClick={()=>{setPreset(i); setReset(r=>r+1); setTour(false);}}><span className="landmark-number">0{i+1}</span><span>{v.name}</span>{preset===i && <span className="selected-dot" />}</Button>)}<Button variant="ghost" size="icon" className={`tour-button ${tour ? 'is-active' : ''}`} title={tour ? 'Pause tour' : 'Start city tour'} aria-label={tour ? 'Pause city tour' : 'Start city tour'} onClick={()=>setTour(!tour)}>{tour ? <Pause /> : <Play />}</Button></div></nav>
      <aside className="map-panel"><div className="map-heading"><MapPin size={12} /><span>CITY OVERVIEW</span><span>01</span></div><MiniMap x={position.x} z={position.z} /><div className="map-footer"><span className="status-light" /> {selectedView.name}<Layers3 size={12} /></div></aside>
      <footer className="city-footer"><span><span className="status-light" /> {ready ? 'CITY CONNECTED' : 'CONNECTING'}</span><span>FUTURE CITY PROJECT <span className="footer-dot">·</span> EXPLORATION BUILD 0.1</span><span>DESIGNED FOR TOMORROW <ChevronDown size={11} /></span></footer>
      {settings && <section className="settings-panel" aria-label="City settings"><div className="settings-heading">Environment settings<Button variant="ghost" size="icon" aria-label="Close settings" onClick={()=>setSettings(false)}><X /></Button></div><label>Enhanced lighting<input type="checkbox" checked={quality} onChange={e=>setQuality(e.target.checked)} /></label><label>Moving traffic<input type="checkbox" checked={motion} onChange={e=>setMotion(e.target.checked)} /></label><div className="settings-note">{quality ? 'HIGH DETAIL' : 'MOBILE PERFORMANCE'}</div></section>}
    </div>
  </main>;
}
