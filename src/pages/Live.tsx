import { Plus, X, RotateCcw, TriangleAlert } from 'lucide-react';
import { useUI, patchLight } from '../store';
import { Slider, Select } from '../components/ui';
import type { Param } from '../types';

const PATHS: Record<string, string> = {
  breathe: 'M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2M17.5 8a2.5 2.5 0 1 1 2 4H2',
  journey: 'M12 3a9 9 0 1 0 0 18 2.5 2.5 0 0 0 0-5h1.5a2 2 0 0 0 0-4A9 9 0 0 0 12 3z',
  audio: 'M2 10v3M6 6v11M10 3v18M14 8v8M18 5v14M22 10v3',
  screen: 'M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 21h8M12 17v4',
  cpu: 'M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3',
  typing: 'M13 2L4 14h7l-1 8 9-12h-7z',
  pomodoro: 'M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9v4l2.5 2M9 2h6',
  circadian: 'M12 3v3M4.2 8.2l2 2M19.8 8.2l-2 2M2 17h20M7 17a5 5 0 0 1 10 0',
  rainbow: 'M3 18a9 9 0 0 1 18 0M7 18a5 5 0 0 1 10 0',
};
const COLORS = ['#ff3d8b', '#ff7a3d', '#46e08f', '#22d3ee', '#4f7dff'];

function ColorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const custom = !COLORS.includes(value.toLowerCase());
  return (
    <div className="swatches">
      {COLORS.map((c) => <button key={c} aria-label={`Colour ${c}`} className={c === value.toLowerCase() ? 'on' : ''} style={{ background: c }} onClick={() => onChange(c)} />)}
      <label className={custom ? 'on' : ''} style={{ background: custom ? value : 'conic-gradient(#ff3b30,#ffb300,#7be04a,#22d3ee,#4f7dff,#d046ff,#ff3b30)' }} title="Custom colour">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Custom colour" />
      </label>
    </div>
  );
}

function ParamControl({ p, value, onChange }: { p: Param; value: any; onChange: (v: any) => void }) {
  const v = value ?? p.def;
  if (p.t === 'range') return <Slider label={p.label} value={v} min={p.min} max={p.max} fmt={(x) => (p.label.includes('%') ? x + '%' : String(Math.round(x)))} onChange={onChange} />;
  if (p.t === 'color') return <div className="row"><span className="lbl grow">{p.label}</span><ColorRow value={v} onChange={onChange} /></div>;
  if (p.t === 'select') {
    return (
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>{p.label}</div>
        {p.options!.length <= 3
          ? <div className="seg" role="group" aria-label={p.label}>{p.options!.map(([val, l]) => <button key={val} className={val === v ? 'on' : ''} onClick={() => onChange(val)}>{l}</button>)}</div>
          : <Select value={v} options={p.options!} onChange={onChange} />}
      </div>
    );
  }
  const cols: string[] = v;
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 10 }}>{p.label}</div>
      <div className="pal-row">
        {cols.map((c, i) => (
          <span key={i} className="pal">
            <label className="colorfield" style={{ background: c }}><input type="color" value={c} onChange={(e) => onChange(cols.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Palette colour ${i + 1}`} /></label>
            {cols.length > 2 && <button aria-label="Remove colour" onClick={() => onChange(cols.filter((_, j) => j !== i))}><X size={11} /></button>}
          </span>
        ))}
        {cols.length < 6 && <button className="addcol" aria-label="Add colour" onClick={() => onChange([...cols, '#ffffff'])}><Plus size={14} /></button>}
      </div>
    </div>
  );
}

export default function Live() {
  const snap = useUI((s) => s.snap)!;
  const frame = useUI((s) => s.frame);
  const notify = useUI((s) => s.notify);
  const c = snap.current;
  const def = snap.modes.find((m) => m.id === c.live.type)!;
  const running = c.mode === 'live' && c.on;
  const audio = frame?.audio;
  const eq = Array.from({ length: 16 }, (_, i) => {
    if (!audio || c.live.type !== 'audio' || !running) return 0.12;
    const band = i < 5 ? audio.bass : i < 11 ? audio.mid : audio.high;
    return Math.max(0.08, Math.min(1, band * (0.75 + 0.25 * Math.sin(i * 1.7 + (frame?.out.h ?? 0) * 9))));
  });
  const idle = !(c.live.type === 'audio' && running && audio);

  return (
    <div className="cols">
      <section className="mode-grid">
        {snap.modes.map((m) => (
          <button key={m.id} className={'mode' + (c.mode === 'live' && c.live.type === m.id ? ' on' : '')} onClick={() => patchLight({ mode: 'live', on: true, live: { type: m.id } })}>
            <span className="mi"><svg className="ic" viewBox="0 0 24 24"><path d={PATHS[m.id]} /></svg></span>
            <b>{m.name}</b><small>{m.desc}</small>
          </button>
        ))}
      </section>

      <aside className="panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, alignSelf: 'start' }}>
        <div>
          <div className="eyebrow row gap8"><span style={{ color: 'var(--accent)' }}>●</span>{running ? 'Running now' : c.mode === 'live' ? 'Paused' : 'Selected'}</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.03em', marginTop: 6 }}>{def.name}</div>
          <div className="sub" style={{ marginTop: 4 }}>{def.desc}</div>
        </div>
        <div className={'eq' + (idle ? ' idle' : '')} aria-hidden="true">
          {eq.map((v, i) => <i key={i} style={idle ? { animationDelay: `${((i * 0.37) % 1.1).toFixed(2)}s` } : { transform: `scaleY(${v})` }} />)}
        </div>
        {def.params.map((p) => <ParamControl key={p.k} p={p} value={c.live.params[p.k]} onChange={(v) => patchLight({ mode: 'live', live: { params: { [p.k]: v } } })} />)}
        {def.id === 'typing' && <div className="hint">Only keystroke timing is used — nothing you type is recorded. Live WPM: {frame?.wpm ?? 0}</div>}
        {snap.sensorError && (def.needs === 'audio' || def.needs === 'screen') && <div className="note bad"><TriangleAlert size={15} />{snap.sensorError}</div>}
        {!snap.device.connected && <div className="note bad"><TriangleAlert size={15} />Keyboard not connected — effects start when it is.</div>}
        <div className="row gap8" style={{ marginTop: 8 }}>
          {def.id === 'pomodoro'
            ? <button className="btn" style={{ flex: 1 }} onClick={() => window.lumen.pomodoroRestart()}><RotateCcw size={14} />Restart</button>
            : <button className="btn" style={{ flex: 1 }} onClick={() => patchLight({ on: !c.on, mode: 'live' })}>{running ? 'Pause' : 'Resume'}</button>}
          <button className="btn pri" style={{ flex: 1 }} onClick={async () => { await window.lumen.profile.save({ id: snap.activeProfileId }); notify('Saved to the active scene'); }}>Save to scene</button>
        </div>
      </aside>
    </div>
  );
}
