import { useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useUI, patchLight } from '../store';
import { Slider } from '../components/ui';
import { Keyboard } from '../components/Keyboard';
import { CATS, EFFECTS, effectById, type Effect } from '../catalog';
import { fromBytes, hsv2hex, hex2hsv, toBytes } from '../color';

const BLURB: Record<number, string> = {
  1: 'One steady colour across every key.', 2: 'Letters in your colour, modifiers in its complement.', 3: 'A soft vertical fade of your colour.', 4: 'A soft horizontal fade of your colour.',
  5: 'Slow fade in and out.', 7: 'A bright band sweeps across the board.', 12: 'Whole board cycles through the spectrum.', 13: 'A rainbow that travels sideways.',
  14: 'A rainbow that travels vertically.', 15: 'Chevron-shaped rainbow wave.', 19: 'Colours spiral out from the centre.', 23: 'Random keys twinkle like rain.',
  30: 'Colourful pixels fall down the board.', 31: 'Keys you use most glow hotter.', 32: 'Code rain in your colour.', 34: 'Keys light up when pressed and fade away.',
  42: 'Every keypress sends out a splash.', 27: 'Colour ripples from left to right.',
};
const CAT_BLURB: Record<string, string> = { static: 'A calm, steady look.', pulse: 'Gentle motion in your colour.', rainbow: 'Full-spectrum colour motion.', ambient: 'Ambient motion across the board.', reactive: 'Responds to every keystroke.' };
const SWATCHES = ['#ff3b30', '#ff7a3d', '#ffb300', '#46e08f', '#22d3ee', '#4f7dff', '#d046ff', '#ff3d8b'];

function swatch(fx: Effect, h: number, s: number) {
  const c = `hsl(${h} ${s}% 55%)`;
  if (!fx.color) return { cls: 'rb', style: {} };
  if (fx.cat === 'pulse') return { cls: 'pulse', style: { background: `radial-gradient(circle,${c},transparent 72%),#101116` } };
  if (fx.cat === 'ambient') return { cls: '', style: { background: `radial-gradient(circle at 20% 30%,${c} 0 8%,transparent 9%),radial-gradient(circle at 70% 60%,${c} 0 10%,transparent 11%),radial-gradient(circle at 45% 85%,${c} 0 7%,transparent 8%),#101116` } };
  if (fx.cat === 'reactive') return { cls: 'reactive', style: { background: `radial-gradient(circle,${c} 0 14%,transparent 55%),#101116` } };
  return { cls: '', style: { background: `linear-gradient(135deg,${c},hsl(${(h + 40) % 360} ${s}% 40%))` } };
}

export default function Lighting() {
  const snap = useUI((s) => s.snap)!;
  const notify = useUI((s) => s.notify);
  const [cat, setCat] = useState<string>('All');
  const [manage, setManage] = useState(false);
  const [saved, setSaved] = useState(false);
  const pad = useRef<HTMLDivElement>(null);
  const c = snap.current, hw = c.hw;
  const hidden = snap.settings.disabledEffects;
  const fx = effectById(hw.effect);
  const base = fromBytes(hw.h, hw.s);
  const hue = Math.round(base.h * 360), sat = Math.round(base.s * 100), bri = Math.round((hw.v / 255) * 100);
  const patch = (p: any) => { setSaved(false); patchLight({ mode: 'hardware', on: true, hw: p }); };
  const toggleHide = (id: number) => window.lumen.settings({ disabledEffects: hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id] });

  const onPad = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    patch({ s: Math.round(x * 255), v: Math.max(13, Math.round((1 - y) * 255)) });
  };

  const list = EFFECTS.filter((f) => (cat === 'All' || CATS.find((x) => x.id === f.cat)?.name.startsWith(cat)) && (manage || !hidden.includes(f.id)));
  const cats = ['All', ...CATS.map((x) => x.name.split(' ')[0])];
  const save = async () => {
    const r = await window.lumen.light.save();
    setSaved(r.ok);
    notify(r.ok ? 'Saved to keyboard memory — it keeps this look without the app.' : r.error || 'Could not save', r.ok ? 'ok' : 'err');
  };

  return (
    <div className="cols">
      <div className="col">
        <section className="panel pv">
          <div style={{ flex: 'none', width: 560, maxWidth: '55%' }}><Keyboard variant="preview" compact maxUnit={30} /></div>
          <div className="grow">
            <div className="eyebrow">{c.mode === 'hardware' ? 'Selected' : 'Selected · live mode is running'}</div>
            <h2>{fx?.name ?? `Effect ${hw.effect}`}</h2>
            <div className="sub">{BLURB[hw.effect] ?? CAT_BLURB[fx?.cat ?? 'static']}</div>
          </div>
        </section>

        <section className="panel" style={{ padding: '22px 24px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="tabs">
            {cats.map((n) => <button key={n} className={'tab' + (n === cat ? ' on' : '')} onClick={() => setCat(n)}>{n}</button>)}
            <span className="grow" />
            <button className="link" style={{ fontSize: 12, color: 'var(--faint)' }} onClick={() => setManage(!manage)}>
              {manage ? 'Done' : `44 effects · hide any your firmware lacks${hidden.length ? ` (${hidden.length} hidden)` : ''}`}
            </button>
          </div>
          <div className="fx-grid">
            {list.map((f) => {
              const sw = swatch(f, hue, sat);
              return (
                <div key={f.id} style={{ position: 'relative' }}>
                  <button className={'fx' + (c.mode === 'hardware' && hw.effect === f.id ? ' on' : '') + (hidden.includes(f.id) ? ' off' : '')} style={{ width: '100%' }} onClick={() => patch({ effect: f.id })}>
                    <i className={sw.cls} style={sw.style} /><span>{f.name}</span>
                  </button>
                  {manage && <button className="fx-eye" onClick={() => toggleHide(f.id)} aria-label={hidden.includes(f.id) ? 'Show effect' : 'Hide effect'}>{hidden.includes(f.id) ? <EyeOff size={13} /> : <Eye size={13} />}</button>}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22, alignSelf: 'stretch' }}>
        <div className="row"><div className="eyebrow grow">Inspector</div><span className="mono" style={{ fontSize: 11.5, color: 'var(--faint)' }}>H {hw.h} · S {hw.s} · V {hw.v}</span></div>
        {(fx?.color ?? true) ? (
          <>
            <div ref={pad} className="pad" role="slider" aria-label="Saturation and brightness" aria-valuetext={`Saturation ${sat}%, brightness ${bri}%`}
              style={{ background: `linear-gradient(0deg,#000,transparent),linear-gradient(90deg,#fff,hsl(${hue} 100% 50%))` }}
              onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); onPad(e); }}
              onPointerMove={(e) => e.buttons === 1 && onPad(e)}>
              <div className="knob" style={{ left: sat + '%', top: 100 - bri + '%', background: hsv2hex({ ...base, v: Math.max(0.3, hw.v / 255) }) }} />
            </div>
            <Slider label="Hue" hue value={hue} min={0} max={360} fmt={(v) => v + '°'} onChange={(v) => patch(toBytes({ h: v / 360, s: base.s, v: 1 }))} />
            <Slider label="Saturation" value={sat} min={0} max={100} fmt={(v) => v + '%'} onChange={(v) => patch({ s: Math.round((v / 100) * 255) })} />
          </>
        ) : <div className="note soft">This effect cycles the full spectrum, so it ignores hue and saturation.</div>}
        <Slider label="Brightness" value={bri} min={5} max={100} fmt={(v) => v + '%'} onChange={(v) => patch({ v: Math.round((v / 100) * 255) })} />
        {(fx?.speed ?? true) && <Slider label="Speed" value={Math.round((hw.speed / 255) * 100)} min={0} max={100} fmt={(v) => v + '%'} onChange={(v) => patch({ speed: Math.round((v / 100) * 255) })} />}
        {(fx?.color ?? true) && (
          <div className="swatches">
            {SWATCHES.map((s) => {
              const h = hex2hsv(s);
              return <button key={s} aria-label={`Colour ${s}`} className={Math.abs(h.h * 360 - hue) < 4 ? 'on' : ''} style={{ background: s }} onClick={() => patch({ h: Math.round(h.h * 255) % 256, s: 255 })} />;
            })}
          </div>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn pri lg" onClick={save}>{saved ? '✓ Saved to keyboard' : 'Save to keyboard'}</button>
          <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.5, textAlign: 'center' }}>Changes apply instantly and don’t wear the keyboard’s memory. Save writes them permanently.</div>
        </div>
      </aside>
    </div>
  );
}
