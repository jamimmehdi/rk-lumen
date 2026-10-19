import { useEffect, useRef, useState } from 'react';
import { Send, Trash2, RefreshCw } from 'lucide-react';
import { useUI } from '../store';
import { Card, Btn } from '../components/ui';

interface Line { dir: 'in' | 'out' | 'err'; hex: string; t: number }
const PRESETS: [string, string][] = [
  ['Protocol version', '01'], ['Layer count', '11'], ['RGB brightness', '080301'], ['RGB effect', '080302'], ['RGB speed', '080303'], ['RGB colour', '080304'],
];

export default function Lab() {
  const snap = useUI((s) => s.snap)!;
  const [lines, setLines] = useState<Line[]>([]);
  const [hex, setHex] = useState('01');
  const [devs, setDevs] = useState<any[]>([]);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.lumen.raw.listen(true);
    const off = window.lumen.onRaw((m) => setLines((l) => [...l.slice(-200), m]));
    return () => { off(); window.lumen.raw.listen(false); };
  }, []);
  const scan = async () => setDevs(await window.lumen.raw.devices());
  useEffect(() => { scan(); }, [snap.device.connected]);
  useEffect(() => { box.current?.scrollTo({ top: 1e6 }); }, [lines]);

  const send = async (h = hex) => {
    try { const r = await window.lumen.raw.send(h); if (r === '(no reply)') setLines((l) => [...l, { dir: 'err', hex: 'no reply', t: Date.now() }]); }
    catch (e: any) { setLines((l) => [...l, { dir: 'err', hex: String(e.message).replace(/^Error invoking remote method '[^']+': Error: /, ''), t: Date.now() }]); }
  };

  return (
    <div className="cols">
      <div className="col">
        <Card title="Console" right={<Btn small onClick={() => setLines([])}><Trash2 size={13} /> Clear</Btn>}>
          <div className="console" ref={box}>
            {lines.length === 0 && <span className="dim">Send a command to see traffic…</span>}
            {lines.map((l, i) => (
              <div key={i} className={'ln ' + l.dir}><span>{l.dir === 'in' ? '◀' : l.dir === 'out' ? '▶' : '!'}</span><code>{l.hex}</code></div>
            ))}
          </div>
          <div className="row gap8">
            <input className="text mono grow" value={hex} spellCheck={false} onChange={(e) => setHex(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="hex bytes e.g. 08 03 01" />
            <Btn kind="primary" onClick={() => send()} disabled={!snap.device.connected}><Send size={14} /> Send</Btn>
          </div>
          <div className="chips" style={{ marginTop: 10 }}>{PRESETS.map(([n, h]) => <button key={n} className="chip sm" onClick={() => { setHex(h); send(h); }}>{n}</button>)}</div>
          <p className="hint">Safety: the keymap-reset (0x06) and bootloader commands are blocked from this console.</p>
        </Card>
      </div>
      <div className="col">
        <Card title="Device" right={<Btn small onClick={() => { window.lumen.reconnect(); scan(); }}><RefreshCw size={13} /> Rescan</Btn>}>
          <dl className="kv">
            <dt>Status</dt><dd>{snap.device.connected ? 'Connected' : 'Not found'}</dd>
            <dt>Product</dt><dd>{snap.device.info?.product ?? '—'}</dd>
            <dt>Maker</dt><dd>{snap.device.info?.manufacturer ?? '—'}</dd>
            <dt>USB ID</dt><dd className="mono">342D:{snap.device.info ? snap.device.info.pid.toString(16).toUpperCase() : '—'}</dd>
            <dt>Protocol</dt><dd>{snap.device.protocol ? 'VIA v' + snap.device.protocol : '—'}</dd>
            <dt>Layers</dt><dd>{snap.device.layers || '—'}</dd>
          </dl>
        </Card>
        <Card title="HID interfaces" sub="What Windows exposes for this keyboard">
          <div className="stack small">
            {devs.map((d, i) => (
              <div key={i} className="row"><span className="mono grow">if{d.interface} · {d.usagePage.toString(16).toUpperCase().padStart(4, '0')}:{d.usage.toString(16).toUpperCase().padStart(2, '0')}</span>{d.usagePage === 0xff60 && <span className="pill">Raw HID ✓</span>}</div>
            ))}
            {!devs.length && <span className="dim">None found</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}
