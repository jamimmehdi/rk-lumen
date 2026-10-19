import { useState } from 'react';
import { useUI, patchLight } from '../store';
import { Slider, Modal, Btn } from '../components/ui';
import { Keyboard } from '../components/Keyboard';
import { effectById } from '../catalog';
import type { Profile } from '../types';

const LIVE_GRAD: Record<string, string> = {
  breathe: '#7c5cff,#22d3ee', journey: '#ff3d71,#ffaa00,#00e096,#3366ff', audio: '#ff3d8b,#d046ff,#4f7dff', screen: '#22d3ee,#4f7dff,#ff3d8b',
  cpu: '#46e08f,#ffb23d,#ff4d4d', typing: '#4f7dff,#ff4d4d', pomodoro: '#46e08f,#ffb23d,#ff4d4d', circadian: '#ff8a3d,#9ecbff', rainbow: '#ff3b30,#ffb300,#7be04a,#22d3ee,#d046ff',
};
const sceneGrad = (p: Profile) => {
  if (p.mode === 'live') return `linear-gradient(135deg,${LIVE_GRAD[p.live.type] ?? '#ff7a3d,#22d3ee'})`;
  const h = Math.round((p.hw.h / 255) * 360);
  const fx = effectById(p.hw.effect);
  return fx && !fx.color ? 'linear-gradient(135deg,#ff7a3d,#ffb23d,#46e08f,#22d3ee)' : `linear-gradient(135deg,hsl(${h} 90% 58%),hsl(${(h + 50) % 360} 90% 50%))`;
};

export default function Dashboard() {
  const snap = useUI((s) => s.snap)!;
  const frame = useUI((s) => s.frame);
  const notify = useUI((s) => s.notify);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const c = snap.current, s = snap.settings;
  const live = c.mode === 'live';
  const modeDef = snap.modes.find((m) => m.id === c.live.type);
  const title = !c.on ? 'Lights are off' : live ? modeDef?.name : effectById(c.hw.effect)?.name ?? `Effect ${c.hw.effect}`;
  const sys = frame?.sys ?? snap.sys;
  const wpm = frame?.wpm ?? snap.typing.wpm;
  const apps = snap.appRules.slice(0, 2).map((r) => `${r.exe} → ${snap.profiles.find((p) => p.id === r.profileId)?.name ?? '—'}`);

  const days = Array.from({ length: 14 }, (_, i) => snap.stats.daily[new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10)] || 0);
  const dmax = Math.max(1, ...days);

  const create = async () => {
    if (!name.trim()) return;
    await window.lumen.profile.save({ name: name.trim() });
    setName(''); setNaming(false); notify('Scene saved');
  };

  return (
    <div className="cols">
      <section className="panel hero">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <div className="eyebrow"><span className="b">●</span>{live ? 'Live effect' : 'Hardware effect'}</div>
            <h2>{title}</h2>
          </div>
          <button className={'btn' + (c.on ? ' on' : '')} onClick={() => patchLight({ on: !c.on })} aria-pressed={c.on} title="Toggle lights (Ctrl+Alt+L)">
            <svg className="ic sm" viewBox="0 0 24 24"><path d="M12 3v8" /><path d="M6.3 6.8a8 8 0 1 0 11.4 0" /></svg>{c.on ? 'Lights on' : 'Lights off'}
          </button>
        </div>

        <div style={{ opacity: c.on ? 1 : 0.28, transition: 'opacity .3s' }}><Keyboard variant="preview" maxUnit={50} /></div>

        <div className="ctrls">
          <Slider label="Brightness" value={s.maxBrightness} min={5} max={100} fmt={(v) => v + '%'} onChange={(v) => window.lumen.settings({ maxBrightness: v })} />
          <Slider label="Speed" value={Math.round((c.hw.speed / 255) * 100)} min={0} max={100} disabled={live} fmt={(v) => v + '%'} onChange={(v) => patchLight({ mode: 'hardware', hw: { speed: Math.round((v / 100) * 255) } })} />
          <Slider label="Hue" hue value={Math.round((c.hw.h / 255) * 360)} min={0} max={360} disabled={live} fmt={(v) => v + '°'} onChange={(v) => patchLight({ mode: 'hardware', hw: { h: Math.round((v / 360) * 255) } })} />
        </div>

        <div className="statusbar">
          {apps.map((a) => <span key={a} className="pill sm">{a}</span>)}
          {s.idleDimMin > 0 && <span className="pill sm">Dim after {s.idleDimMin} min idle</span>}
          {s.nightEnabled && <span className="pill sm">Night mode {s.nightFrom}–{s.nightTo}</span>}
          {!apps.length && !s.idleDimMin && !s.nightEnabled && <span className="pill sm">No automation yet — set rules in Profiles</span>}
          <span className="grow" />
          <span className="mono" style={{ fontSize: 11.5, color: 'var(--faint)' }}>Ctrl Alt ← → switch scene</span>
        </div>
      </section>

      <div className="col">
        <section className="panel" style={{ padding: '18px 14px 14px' }}>
          <div className="row" style={{ padding: '0 8px 10px' }}>
            <div className="eyebrow grow">Scenes</div>
            <button className="link" style={{ fontSize: 12, fontWeight: 600 }} onClick={() => setNaming(true)}>+ New</button>
          </div>
          {snap.profiles.map((p) => {
            const on = p.id === snap.activeProfileId;
            const sub = p.mode === 'live' ? `Live · ${snap.modes.find((m) => m.id === p.live.type)?.name}` : `Hardware · ${effectById(p.hw.effect)?.name ?? 'Effect'}`;
            return (
              <button key={p.id} className={'scene' + (on ? ' on' : '')} onClick={() => window.lumen.profile.apply(p.id)}>
                <span className="sw" style={{ background: sceneGrad(p) }} />
                <span className="grow"><b>{p.name}</b><small>{sub}</small></span>
                <span style={{ color: 'var(--accent)', fontWeight: 800, opacity: on ? 1 : 0 }}>✓</span>
              </button>
            );
          })}
        </section>

        <section className="panel" style={{ padding: '18px 22px' }}>
          <div className="stack">
            <div className="eyebrow">System</div>
            {([['CPU', sys.cpu], ['Memory', sys.ram]] as const).map(([n, v]) => (
              <div key={n}>
                <div className="row between" style={{ fontSize: 13, marginBottom: 8, alignItems: 'center' }}><span style={{ color: 'var(--dim)' }}>{n}</span><span className="mono">{v}%</span></div>
                <div className="meter"><i style={{ width: v + '%' }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel" style={{ padding: '18px 22px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row" style={{ alignItems: 'baseline' }}><div className="eyebrow grow">Typing today</div><span style={{ fontSize: 11.5, color: 'var(--faint)' }}>last 14 days</span></div>
          <div className="row" style={{ gap: 28, alignItems: 'baseline' }}>
            <div><span className="bigstat">{wpm}</span><span className="bigunit">WPM</span></div>
            <div><span className="bigstat">{s.trackKeys ? snap.stats.today.toLocaleString() : '—'}</span><span className="bigunit">keys</span></div>
          </div>
          {s.trackKeys ? (
            <div className="bars">{days.map((d, i) => <div key={i}><i style={{ height: Math.max(5, (d / dmax) * 100) + '%' }} /></div>)}</div>
          ) : (
            <p className="hint" style={{ marginTop: 'auto' }}>Turn on keystroke statistics in Insights to see daily totals. Only per-key counts are stored — never what you type.</p>
          )}
        </section>
      </div>

      {naming && (
        <Modal onClose={() => setNaming(false)}>
          <h3>Save current lighting as a scene</h3>
          <input className="text" autoFocus placeholder="Scene name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          <div className="row gap8" style={{ justifyContent: 'flex-end' }}><Btn onClick={() => setNaming(false)}>Cancel</Btn><Btn kind="primary" disabled={!name.trim()} onClick={create}>Save scene</Btn></div>
        </Modal>
      )}
    </div>
  );
}
