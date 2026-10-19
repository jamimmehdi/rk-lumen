import { useMemo } from 'react';
import { Trash2, ShieldCheck } from 'lucide-react';
import { useUI } from '../store';
import { Card, Btn, Toggle } from '../components/ui';
import { Keyboard } from '../components/Keyboard';
import { LAYOUT } from '../layout';

export default function Stats() {
  const snap = useUI((s) => s.snap)!;
  const frame = useUI((s) => s.frame);
  const on = snap.settings.trackKeys;
  const { keys, daily, total, today } = snap.stats;

  const heat = useMemo(() => {
    const max = Math.max(1, ...Object.values(keys));
    return Object.fromEntries(LAYOUT.map((k) => [k.id, (keys[k.id] || 0) / max]));
  }, [keys]);
  const top = useMemo(() => Object.entries(keys).sort((a, b) => b[1] - a[1]).slice(0, 8), [keys]);
  const days = useMemo(() => {
    const out: { d: string; n: number }[] = [];
    for (let i = 13; i >= 0; i--) { const dt = new Date(Date.now() - i * 864e5); const k = dt.toISOString().slice(0, 10); out.push({ d: k.slice(5), n: daily[k] || 0 }); }
    return out;
  }, [daily]);
  const dmax = Math.max(1, ...days.map((x) => x.n));
  const maxTop = top[0]?.[1] || 1;

  return (
    <div className="page">
      <div className="row gap8"><div className="note soft grow"><ShieldCheck size={15} /> Only per-key <b>counts</b> are stored locally on this PC — never the order or text you type, and nothing leaves your computer.</div><Toggle on={on} onChange={(v) => window.lumen.settings({ trackKeys: v })} label="Track keystrokes" /></div>

      <div className="grid g4">
        <Card className="stat"><b>{frame?.wpm ?? snap.typing.wpm}</b><span>live WPM</span></Card>
        <Card className="stat"><b>{today.toLocaleString()}</b><span>keystrokes today</span></Card>
        <Card className="stat"><b>{total.toLocaleString()}</b><span>total counted</span></Card>
        <Card className="stat"><b>{top[0] ? top[0][0].replace('Key', '') : '—'}</b><span>most-used key</span></Card>
      </div>

      <Card title="Heat-map" sub="Cool blue → hot orange by relative use" right={<Btn small kind="danger" onClick={() => window.lumen.resetStats()}><Trash2 size={14} /> Reset</Btn>}>
        <Keyboard variant="heat" heat={heat} />
      </Card>

      <div className="grid g2">
        <Card title="Top keys">
          <div className="stack">
            {top.length === 0 && <p className="hint">{on ? 'Start typing — stats will appear here.' : 'Turn on tracking to begin.'}</p>}
            {top.map(([k, n]) => (
              <div key={k} className="bar-row"><span className="mono">{k.replace(/^Key|^Digit/, '')}</span><div className="bar"><i style={{ width: (n / maxTop) * 100 + '%' }} /></div><span className="dim mono">{n.toLocaleString()}</span></div>
            ))}
          </div>
        </Card>
        <Card title="Last 14 days">
          <div className="bars tall">
            {days.map((d) => (<div key={d.d} title={`${d.d}: ${d.n.toLocaleString()}`}><i style={{ height: Math.max(3, (d.n / dmax) * 100) + '%' }} /><span>{d.d.slice(3)}</span></div>))}
          </div>
        </Card>
      </div>
    </div>
  );
}
