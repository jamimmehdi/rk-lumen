import { useEffect, useMemo, useRef, useState } from 'react';
import { LAYOUT, LAYOUT_H, LAYOUT_W, type KeyDef } from '../layout';
import { useUI } from '../store';
import { clamp, hsv2rgb, type HSV } from '../color';

const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

interface Ping { x: number; y: number; t: number }

/** Approximate preview of the firmware's QMK RGB Matrix effects. The real animation runs on the keyboard itself. */
function simulate(effect: number, k: KeyDef, t: number, base: HSV, v: number, speed: number, pings: Ping[]): HSV {
  const cx = k.x + k.w / 2, cy = k.y + 0.5;
  const sp = 0.25 + (speed / 255) * 2.2;
  const T = t * sp;
  const mx = LAYOUT_W / 2, my = LAYOUT_H / 2;
  const dx = cx - mx, dy = (cy - my) * 1.6, dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) / (Math.PI * 2);
  const wrap = (x: number) => ((x % 1) + 1) % 1;
  const sine = (x: number) => (Math.sin(x * Math.PI * 2) + 1) / 2;
  const rainbow = (h: number) => ({ h: wrap(h), s: 1, v });
  const react = (wide: number) => {
    let boost = 0;
    for (const p of pings) {
      const age = t - p.t; if (age > 1.4) continue;
      const d = Math.hypot(cx - p.x, (cy - p.y) * 1.3);
      boost = Math.max(boost, clamp(1 - Math.abs(d - age * 6 * wide) / (1.4 * wide)) * clamp(1 - age / 1.4));
    }
    return boost;
  };
  switch (effect) {
    case 1: return { ...base, v };
    case 2: return /^(Key|Digit)/.test(k.id) ? { ...base, v } : { h: wrap(base.h + 0.5), s: base.s, v: v * 0.8 };
    case 3: return { h: wrap(base.h + (k.y / 6) * 0.25), s: base.s, v };
    case 4: return { h: wrap(base.h + (cx / 16) * 0.25), s: base.s, v };
    case 5: return { ...base, v: v * (0.08 + 0.92 * sine(T * 0.4)) };
    case 6: case 7: { const b = sine(cx / 16 - T * 0.4); return e6(effect === 6, b); }
    case 8: case 9: { const b = sine(ang + T * 0.3); return e6(effect === 8, b); }
    case 10: case 11: { const b = sine(ang + dist / 14 - T * 0.3); return e6(effect === 10, b); }
    case 12: return rainbow(T * 0.12);
    case 13: return rainbow(cx / 16 - T * 0.15);
    case 14: return rainbow(cy / 6 - T * 0.15);
    case 15: return rainbow(cx / 24 + Math.abs(cy - 2.5) / 12 - T * 0.15);
    case 16: return rainbow(dist / 10 - T * 0.15);
    case 17: return rainbow(Math.abs(dx) / 10 - T * 0.15);
    case 18: case 22: return rainbow(ang + T * 0.12);
    case 19: return rainbow(ang + dist / 12 - T * 0.12);
    case 20: case 21: return rainbow(ang * 2 + T * 0.2);
    case 23: case 24: {
      const slot = Math.floor(T * 1.5), idx = k.row * 20 + k.col;
      const on = hash(idx * 7 + slot * 13) > 0.93;
      const f = on ? 1 - ((T * 1.5) % 1) : 0;
      return { h: effect === 24 ? hash(idx + slot) : base.h, s: base.s, v: v * (0.1 + 0.9 * f) };
    }
    case 25: return { h: wrap(base.h + 0.12 * sine(T * 0.3)), s: base.s, v: v * (0.1 + 0.9 * sine(T * 0.4)) };
    case 26: return { h: wrap(base.h + 0.15 * Math.sin(T + cx / 8)), s: base.s, v };
    case 27: return { h: wrap(base.h + 0.15 * Math.sin(cx / 3 - T * 1.5)), s: base.s, v };
    case 28: case 29: case 30: case 32: {
      const col = Math.floor(k.x);
      const speedC = 0.6 + hash(col) * 1.4;
      const head = ((T * speedC + hash(col * 3.3) * 6) % 10) - 1;
      const dd = head - k.y;
      const f = dd >= 0 && dd < 4 ? 1 - dd / 4 : 0;
      return effect === 30 ? { h: wrap(hash(col) + T * 0.05), s: 1, v: v * (0.08 + 0.92 * f) } : { h: effect === 32 ? 0.36 : base.h, s: base.s, v: v * (0.06 + 0.94 * f) };
    }
    case 31: { const h = hash(k.row * 31 + k.col * 7); return { h: wrap(0.6 - h * 0.6 * (0.5 + 0.5 * sine(T * 0.1))), s: 1, v: v * (0.2 + 0.8 * h) }; }
    default: {
      // reactive family: dim base (or dark) with flashes where keys were struck
      const solid = effect === 34 || effect === 35 || effect === 36 || effect === 37 || effect === 38 || effect === 39 || effect === 40 || effect === 43 || effect === 44;
      const wide = effect === 35 || effect === 36 ? 1.6 : effect >= 43 ? 1.3 : 0.7;
      const f = react(wide);
      return solid ? { h: base.h, s: base.s, v: v * (0.12 + 0.88 * f) } : { h: wrap(base.h + (1 - f) * 0.5), s: base.s, v: v * (0.1 + 0.9 * f) };
    }
  }
  function e6(sat: boolean, b: number): HSV { return sat ? { h: base.h, s: base.s * (0.15 + 0.85 * b), v } : { h: base.h, s: base.s, v: v * (0.1 + 0.9 * b) }; }
}

export interface KeyboardProps {
  variant?: 'preview' | 'map' | 'heat';
  labels?: (k: KeyDef) => { text: string; title?: string; dim?: boolean; mod?: boolean };
  selected?: string | null;
  onSelect?: (k: KeyDef) => void;
  heat?: Record<string, number>;
  className?: string;
  maxUnit?: number;
  compact?: boolean;
}

export function Keyboard({ variant = 'preview', labels, selected, onSelect, heat, className = '', maxUnit = 50, compact = false }: KeyboardProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const els = useRef<Record<string, HTMLDivElement | null>>({});
  const [unit, setUnit] = useState(maxUnit);
  const live = useRef({ snap: useUI.getState().snap, frame: useUI.getState().frame });
  const pings = useRef<Ping[]>([]);

  useEffect(() => useUI.subscribe((s) => { live.current = { snap: s.snap, frame: s.frame }; }), []);
  useEffect(() => {
    if (!wrap.current) return;
    const pad = compact ? 28 : 40;
    const ro = new ResizeObserver(([e]) => setUnit(Math.max(24, Math.min(maxUnit, Math.floor((e.contentRect.width - pad - 4) / LAYOUT_W)))));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [maxUnit, compact]);
  // key flashes for reactive previews: real presses while the app is focused + occasional demo pings
  useEffect(() => {
    if (variant !== 'preview') return;
    const t0 = performance.now();
    const add = (x: number, y: number) => { pings.current = [...pings.current.filter((p) => (performance.now() - t0) / 1000 - p.t < 1.4), { x, y, t: (performance.now() - t0) / 1000 }]; };
    const demo = setInterval(() => { const k = LAYOUT[Math.floor(Math.random() * LAYOUT.length)]; add(k.x + k.w / 2, k.y + 0.5); }, 900);
    const kd = (e: KeyboardEvent) => { const k = LAYOUT.find((l) => l.id === e.code); if (k) add(k.x + k.w / 2, k.y + 0.5); };
    window.addEventListener('keydown', kd);
    return () => { clearInterval(demo); window.removeEventListener('keydown', kd); };
  }, [variant]);

  useEffect(() => {
    if (variant !== 'preview') return;
    let raf = 0, last = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return;
      last = now;
      const { snap, frame } = live.current;
      if (!snap) return;
      const t = (now - t0) / 1000;
      const c = snap.current;
      const raw = frame?.out ?? snap.out;
      // Preview is perceptually boosted so dim-but-visible keyboard settings still read clearly on screen.
      const o = { ...raw, v: raw.v < 0.01 ? 0 : 0.45 + raw.v * 0.55 };
      const pingT = pings.current.map((p) => p);
      for (const k of LAYOUT) {
        const el = els.current[k.id]; if (!el) continue;
        let col: HSV;
        if (!c.on || o.v < 0.01) col = { h: 0, s: 0, v: 0 };
        else if (c.mode === 'live') col = { h: o.h, s: o.s, v: o.v };
        else col = simulate(c.hw.effect, k, t, { h: c.hw.h / 255, s: c.hw.s / 255, v: 1 }, o.v, c.hw.speed, pingT);
        const [r, g, b] = hsv2rgb(col);
        el.style.setProperty('--c', `${r},${g},${b}`);
        el.style.setProperty('--p', String(Math.min(1, col.v * 1.15)));
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [variant]);

  const keys = useMemo(() => LAYOUT, []);
  const W = unit * LAYOUT_W - 5, H = unit * LAYOUT_H - 5;
  return (
    <div ref={wrap} className={'kbd-wrap ' + className} style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <div className={'kbd-plate' + (compact ? ' compact' : '')}>
        <div className={'kbd ' + variant + (compact ? ' compact' : '')} style={{ width: W, height: H }}>
          {keys.map((k) => {
            const lab = labels?.(k);
            const h = heat?.[k.id] ?? 0;
            const heatCol = variant === 'heat' ? `${Math.round(255 * Math.min(1, h * 1.6))},${Math.round(120 + 100 * (1 - h))},${Math.round(255 * (1 - h))}` : null;
            const text = variant === 'preview' ? k.label : lab?.text ?? k.label;
            const cls = 'key' + (k.knob ? ' knob' : '') + (selected === k.id ? ' sel' : '') + (onSelect ? ' click' : '') + (lab?.dim ? ' dim' : '') + (lab?.mod ? ' mod' : '');
            const style = { left: k.x * unit, top: k.y * unit, width: k.w * unit - 5, height: unit - 5, fontSize: Math.max(8, Math.round(unit * 0.22)), ...(heatCol ? { ['--c' as any]: heatCol, ['--p' as any]: String(0.15 + h * 0.85) } : {}) };
            const common = { className: cls, style, title: lab?.title, ref: (el: HTMLElement | null) => { els.current[k.id] = el as HTMLDivElement | null; } };
            return onSelect
              ? <button key={k.id} type="button" aria-label={lab?.title ?? k.label} onClick={() => onSelect(k)} {...common}><span className="cap">{text}</span></button>
              : <div key={k.id} {...common}><span className="cap">{text}</span></div>;
          })}
        </div>
      </div>
    </div>
  );
}
