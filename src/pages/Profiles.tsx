import { useState } from 'react';
import { Plus, Trash2, Download, Upload, Check, Save, AppWindow, Moon, Timer, Keyboard as Kb } from 'lucide-react';
import { useUI } from '../store';
import { Card, Btn, Toggle, Slider } from '../components/ui';
import { HeaderActions } from '../components/HeaderActions';
import { effectById } from '../catalog';

export default function Profiles() {
  const snap = useUI((s) => s.snap)!;
  const notify = useUI((s) => s.notify);
  const s = snap.settings;
  const [name, setName] = useState('');
  const [exe, setExe] = useState('');
  const [ruleProfile, setRuleProfile] = useState(snap.profiles[0]?.id ?? '');
  const set = (p: any) => window.lumen.settings(p);
  const rules = snap.appRules;

  return (
    <div className="page">
      <HeaderActions>
        <Btn onClick={async () => notify((await window.lumen.profile.importOne()) ? 'Profile imported' : 'Import cancelled or invalid file', 'ok')}><Upload size={14} />Import</Btn>
      </HeaderActions>

      <div className="prof-grid">
        {snap.profiles.map((p) => {
          const on = p.id === snap.activeProfileId;
          const sub = p.mode === 'hardware' ? effectById(p.hw.effect)?.name ?? 'Hardware' : snap.modes.find((m) => m.id === p.live.type)?.name ?? 'Live';
          return (
            <div key={p.id} className={'prof' + (on ? ' on' : '')} style={{ ['--chip' as any]: p.accent }}>
              <div className="prof-top">
                <i className="prof-dot" />
                <input className="prof-name" value={p.name} onChange={(e) => window.lumen.profile.update({ id: p.id, name: e.target.value })} aria-label="Profile name" />
                <input type="color" className="prof-color" value={p.accent} onChange={(e) => window.lumen.profile.update({ id: p.id, accent: e.target.value })} aria-label="Accent colour" />
              </div>
              <div className="sub">{p.mode === 'hardware' ? 'Hardware' : 'Live'} · {sub}</div>
              <div className="row gap8 wrap" style={{ marginTop: 12 }}>
                <Btn small kind={on ? 'primary' : 'ghost'} onClick={() => window.lumen.profile.apply(p.id)}>{on ? <><Check size={14} /> Active</> : 'Apply'}</Btn>
                <Btn small title="Overwrite with current lighting" onClick={async () => { await window.lumen.profile.save({ id: p.id }); notify(`“${p.name}” updated from current lighting`); }}><Save size={14} /></Btn>
                <Btn small title="Export" onClick={() => window.lumen.profile.exportOne(p.id)}><Download size={14} /></Btn>
                {snap.profiles.length > 1 && <Btn small kind="danger" title="Delete" onClick={() => window.lumen.profile.remove(p.id)}><Trash2 size={14} /></Btn>}
              </div>
            </div>
          );
        })}
        <div className="prof new">
          <b>Save current lighting</b>
          <input className="text" placeholder="Profile name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name && (window.lumen.profile.save({ name }), setName(''))} />
          <Btn kind="primary" small disabled={!name.trim()} onClick={() => { window.lumen.profile.save({ name: name.trim() }); setName(''); notify('Profile saved'); }}><Plus size={14} /> New profile</Btn>
        </div>
      </div>

      <div className="grid g2">
        <Card title="Per-app profiles" sub="Switch scene when a program is in the foreground" right={<AppWindow size={18} className="dim" />}>
          <div className="stack">
            {rules.length === 0 && <p className="hint">No rules yet. Example: <span className="mono">valorant.exe</span> → your Gaming profile.</p>}
            {rules.map((r, i) => (
              <div key={i} className="row gap8">
                <span className="mono grow">{r.exe}</span>
                <span className="dim">→</span>
                <span>{snap.profiles.find((p) => p.id === r.profileId)?.name ?? '—'}</span>
                <Btn small kind="danger" onClick={() => window.lumen.rules(rules.filter((_, j) => j !== i))}><Trash2 size={13} /></Btn>
              </div>
            ))}
            <div className="row gap8 wrap">
              <input className="text mono grow" placeholder="program.exe" value={exe} onChange={(e) => setExe(e.target.value)} />
              <select className="select" value={ruleProfile} onChange={(e) => setRuleProfile(e.target.value)}>{snap.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <Btn small kind="primary" disabled={!exe.trim()} onClick={() => { window.lumen.rules([...rules, { exe: exe.trim().toLowerCase(), profileId: ruleProfile }]); setExe(''); }}><Plus size={14} /></Btn>
            </div>
            <p className="hint">Foreground app right now: <button className="link mono" onClick={() => snap.activeApp && setExe(snap.activeApp)}>{snap.activeApp || 'unknown'}</button> (click to use)</p>
          </div>
        </Card>

        <Card title="Idle & sleep" sub="Save power and eyes when you step away" right={<Timer size={18} className="dim" />}>
          <div className="stack">
            <Slider label="Dim after idle" value={s.idleDimMin} min={0} max={60} fmt={(v) => (v ? v + ' min' : 'Never')} onChange={(v) => set({ idleDimMin: v })} />
            {s.idleDimMin > 0 && <Slider label="Dim level" value={s.idleDimLevel} min={0} max={80} fmt={(v) => v + '%'} onChange={(v) => set({ idleDimLevel: v })} />}
            <Slider label="Turn off after idle" value={s.idleOffMin} min={0} max={120} fmt={(v) => (v ? v + ' min' : 'Never')} onChange={(v) => set({ idleOffMin: v })} />
            <Toggle on={s.offOnLock} onChange={(v) => set({ offOnLock: v })} label="Lights off when PC locks or sleeps" />
          </div>
        </Card>

        <Card title="Night mode" sub="Automatically soften brightness on a schedule" right={<Moon size={18} className="dim" />}>
          <div className="stack">
            <Toggle on={s.nightEnabled} onChange={(v) => set({ nightEnabled: v })} label="Enable night schedule" />
            {s.nightEnabled && (
              <>
                <div className="row gap8"><span className="lbl grow">From</span><input type="time" className="text" value={s.nightFrom} onChange={(e) => set({ nightFrom: e.target.value })} /><span className="lbl">to</span><input type="time" className="text" value={s.nightTo} onChange={(e) => set({ nightTo: e.target.value })} /></div>
                <Slider label="Night brightness" value={s.nightLevel} min={0} max={100} fmt={(v) => v + '%'} onChange={(v) => set({ nightLevel: v })} />
              </>
            )}
          </div>
        </Card>

        <Card title="Global hotkeys" sub="Work from any app" right={<Kb size={18} className="dim" />}>
          <div className="stack">
            <Toggle on={s.hotkeys} onChange={(v) => set({ hotkeys: v })} label="Enable hotkeys" />
            <table className="keys-table"><tbody>
              <tr><td><kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>↑ / ↓</kbd></td><td>Brightness ±10%</td></tr>
              <tr><td><kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>← / →</kbd></td><td>Previous / next profile</td></tr>
              <tr><td><kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>L</kbd></td><td>Lights on / off</td></tr>
            </tbody></table>
          </div>
        </Card>
      </div>
    </div>
  );
}
