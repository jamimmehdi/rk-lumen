import { useState } from 'react';
import { ShieldAlert, Cpu, Save } from 'lucide-react';
import { useUI } from '../store';
import { Toggle, Btn } from '../components/ui';

const KEYS: Record<number, string> = { 0x52: '↑', 0x51: '↓', 0x50: '←', 0x4f: '→' };
'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((c, i) => (KEYS[0x04 + i] = c));
const keyName = (c: number) => KEYS[c] ?? '0x' + c.toString(16);
const pairName = (k: [number, number]) => `${keyName(k[0])} · ${keyName(k[1])}`;

const PRESETS: { name: string; v: [number, number]; h: [number, number] }[] = [
  { name: 'WASD', v: [0x1a, 0x16], h: [0x04, 0x07] },
  { name: 'Arrow keys', v: [0x52, 0x51], h: [0x50, 0x4f] },
  { name: 'ESDF', v: [0x08, 0x07], h: [0x16, 0x09] },
  { name: 'IJKL', v: [0x0c, 0x0e], h: [0x0d, 0x0f] },
];

const same = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];
const LAYERS = ['Base', 'Fn', 'Options', 'Mac', 'Numpad', 'Spare'];

export default function Gaming() {
  const snap = useUI((s) => s.snap)!;
  const notify = useUI((s) => s.notify);
  const g = snap.gaming;
  const [linked, setLinked] = useState(true);
  const [saving, setSaving] = useState(false);
  const locked = !g;

  const run = async (key: string, value: any) => {
    try { await window.lumen.fw.set({ key, value }); } catch (e: any) { notify(String(e?.message || e).replace(/^Error invoking remote method '[^']+': Error: /, ''), 'err'); }
  };
  const setMode = async (axis: 'V' | 'H', v: number) => {
    await run('mode' + axis, v);
    if (linked) await run('mode' + (axis === 'V' ? 'H' : 'V'), v);
  };
  const save = async () => {
    setSaving(true);
    try { await window.lumen.fw.save(); notify('Saved — SOCD settings will survive unplugging.'); } catch (e: any) { notify(String(e?.message || e), 'err'); }
    setSaving(false);
  };

  const modes = (k: [number, number]) => [
    { v: 1, name: 'Last input wins', sub: `Snap Tap style. Hold ${keyName(k[0])} then ${keyName(k[1])} and ${keyName(k[1])} wins; release it and ${keyName(k[0])} returns.` },
    { v: 2, name: 'Neutral', sub: 'Pressing both cancels them out — neither is sent.' },
    { v: 5, name: 'First input wins', sub: 'The key pressed first stays active; the opposite key is ignored.' },
    { v: 3, name: `${keyName(k[0])} always wins`, sub: `${keyName(k[0])} beats ${keyName(k[1])} whenever both are held.` },
    { v: 4, name: `${keyName(k[1])} always wins`, sub: `${keyName(k[1])} beats ${keyName(k[0])} whenever both are held.` },
  ];

  const axis = (axis: 'V' | 'H', title: string) => {
    const keys: [number, number] = g ? (axis === 'V' ? g.keysV : g.keysH) : axis === 'V' ? [0x1a, 0x16] : [0x04, 0x07];
    const mode = g ? (axis === 'V' ? g.modeV : g.modeH) : 1;
    return (
      <div className="axis">
        <div className="row"><div className="eyebrow grow">{title}</div><span className="mono dim" style={{ fontSize: 12 }}>{pairName(keys)}</span></div>
        <div className="radios" role="radiogroup" aria-label={title}>
          {modes(keys).map((m) => (
            <button key={m.v} role="radio" aria-checked={mode === m.v} className={'radio' + (mode === m.v ? ' on' : '')} onClick={() => setMode(axis, m.v)}>
              <i /><span><b>{m.name}</b><small>{m.sub}</small></span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="cols">
      <div className="col">
        {locked && (
          <div className="note bad"><ShieldAlert size={15} /><span>This keyboard is running its stock firmware, so these controls are locked. Flash the RK Lumen firmware to unlock SOCD, N-key rollover and Windows-key lock from this app. Already flashed? Try detecting again.</span><Btn small onClick={() => window.lumen.reconnect()}>Detect again</Btn></div>
        )}

        <section className={'panel soc' + (locked ? ' locked' : '')}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <div className="eyebrow"><span style={{ color: 'var(--accent)', marginRight: 8 }}>●</span>Firmware-level · no PC delay</div>
              <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em', marginTop: 6 }}>SOCD cleaner</h2>
              <p className="sub" style={{ marginTop: 6, maxWidth: 560 }}>When two opposite directions are held together, the keyboard itself decides which one counts — instantly, with no software running in the game.</p>
            </div>
            <button className={'bigsw' + (g?.socdOn ? ' on' : '')} role="switch" aria-checked={!!g?.socdOn} aria-label="SOCD cleaner" disabled={locked} onClick={() => run('socdOn', !g?.socdOn)}>
              <i /><span>{g?.socdOn ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="chips">
              {PRESETS.map((p) => {
                const on = !!g && same(g.keysV, p.v) && same(g.keysH, p.h);
                return <button key={p.name} className={'chip sm' + (on ? ' on' : '')} disabled={locked} onClick={async () => { await run('keysV', p.v); await run('keysH', p.h); }}>{p.name}</button>;
              })}
            </div>
            <Toggle on={linked} onChange={setLinked} label="Same mode for both axes" />
          </div>

          <div className="axes">
            {axis('V', 'Up / Down')}
            {axis('H', 'Left / Right')}
          </div>

          <div className="statusbar">
            <button className="btn pri" disabled={locked || saving} onClick={save}><Save size={15} />Remember after unplugging</button>
            <span className="hint grow" style={{ margin: 0 }}>Without this, the keyboard returns to SOCD <b>off</b> every time it loses power. Scenes can also switch SOCD per game — save a scene while SOCD is on.</span>
          </div>
        </section>
      </div>

      <div className="col">
        <section className="panel" style={{ padding: 22, ...(locked ? { opacity: 0.45, pointerEvents: 'none' as const } : {}) }}>
          <div className="stack">
            <div className="eyebrow">Game controls</div>
            <Toggle on={!!g?.nkro} onChange={(v) => run('nkro', v)} label="N-key rollover" hint="Every key registers at once — no ghosting in fast combos." />
            <Toggle on={!!g?.guiLock} onChange={(v) => run('guiLock', v)} label="Windows key lock" hint="Stops the Windows key from popping you out of a game." />
          </div>
        </section>

        <section className="panel" style={{ padding: 22 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Active layer</div>
          <div className="lyr-grid" aria-live="polite">
            {LAYERS.map((n, i) => (
              <div key={n} className={'lyr' + (g && g.layer === i ? ' on' : '') + (g && (g.layerMask >> i) & 1 ? ' held' : '')}><b>{i}</b><span>{n}</span></div>
            ))}
          </div>
          <p className="hint">Hold Fn + Right Shift for the Options layer (SOCD on/off is T, mode is Y).</p>
        </section>

        <section className="panel" style={{ padding: 22 }}>
          <div className="stack small">
            <div className="eyebrow row gap8"><Cpu size={13} />Firmware</div>
            <dl className="kv">
              <dt>Type</dt><dd>{g ? 'RK Lumen custom' : 'Stock'}</dd>
              <dt>Version</dt><dd>{g ? 'v' + g.version : '—'}</dd>
              <dt>VIA</dt><dd>{snap.device.protocol ? 'protocol ' + snap.device.protocol : '—'}</dd>
              <dt>Layers</dt><dd>{snap.device.layers || '—'}</dd>
            </dl>
          </div>
        </section>

        <div className="note soft"><ShieldAlert size={15} /><span><b>Competitive play:</b> some games and anti-cheats (Counter-Strike 2, Valorant, Faceit) ban or flag Snap Tap-style input. Check the rules before enabling it online.</span></div>
      </div>
    </div>
  );
}
