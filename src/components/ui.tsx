import { useEffect, type ReactNode, type CSSProperties } from 'react';
import { clamp } from '../color';

export function Card({ title, sub, right, children, className = '', style }: { title?: string; sub?: string; right?: ReactNode; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <section className={'card ' + className} style={style}>
      {(title || right) && (
        <header className="card-h">
          <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label?: string; hint?: string }) {
  return (
    <div className="row toggle-row">
      {(label || hint) && <span className="grow"><span className="lbl">{label}</span>{hint && <small className="hint">{hint}</small>}</span>}
      <button type="button" role="switch" aria-checked={on} aria-label={label} className={'toggle' + (on ? ' on' : '')} onClick={() => onChange(!on)}><i /></button>
    </div>
  );
}

export function Slider({ label, value, min = 0, max = 255, onChange, fmt, hue, disabled }: { label?: string; value: number; min?: number; max?: number; onChange: (v: number) => void; fmt?: (v: number) => string; hue?: boolean; disabled?: boolean }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="slider">
      {label && <div className="slider-h"><span>{label}</span><span className="val">{fmt ? fmt(value) : Math.round(value)}</span></div>}
      <input className={'rng' + (hue ? ' hue' : '')} type="range" min={min} max={max} value={value} disabled={disabled} onChange={(e) => onChange(+e.target.value)} style={{ ['--pct' as any]: (hue ? 0 : pct) + '%' }} />
    </label>
  );
}

export function Select({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group">
      {options.map(([v, l]) => <button key={v} type="button" className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

export function Btn({ children, onClick, kind = 'ghost', disabled, title, small, large }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; title?: string; small?: boolean; large?: boolean }) {
  return <button type="button" title={title} disabled={disabled} className={`btn ${kind}${small ? ' sm' : ''}${large ? ' lg' : ''}`} onClick={onClick}>{children}</button>;
}

export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

export function Meter({ value, color = 'var(--accent)', label }: { value: number; color?: string; label?: string }) {
  return (
    <div className="meter" title={label}>
      <i style={{ width: clamp(value) * 100 + '%', background: color }} />
    </div>
  );
}
