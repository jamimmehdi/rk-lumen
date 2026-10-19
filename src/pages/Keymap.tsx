import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useUI } from '../store';
import { Btn, Modal } from '../components/ui';
import { HeaderActions } from '../components/HeaderActions';
import { Keyboard } from '../components/Keyboard';
import { KC_TABS, keyLabel, isDangerous } from '../catalog';
import type { KeyDef } from '../layout';
import type { Keymap } from '../types';

const MODS = [['Ctrl', 0x01], ['Shift', 0x02], ['Alt', 0x04], ['Win', 0x08]] as const;
const MOD_KEYS = /^(Escape|Tab|CapsLock|Shift|Control|Meta|Alt|Fn|Backspace|Enter)/;

export default function KeymapPage() {
  const snap = useUI((s) => s.snap)!;
  const notify = useUI((s) => s.notify);
  const [km, setKm] = useState<Keymap | null>(null);
  const [layer, setLayer] = useState(0);
  const [sel, setSel] = useState<KeyDef | null>(null);
  const [tab, setTab] = useState('basic');
  const [mods, setMods] = useState(0);
  const [hex, setHex] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [err, setErr] = useState('');
  const [target, setTarget] = useState<'press' | 'ccw' | 'cw'>('press');
  const [enc, setEnc] = useState<{ ccw: number; cw: number } | null>(null);
  const connected = snap.device.connected;
  const layers = snap.device.layers || 5;
  const clean = (e: any) => String(e?.message || e).replace(/^Error invoking remote method '[^']+': Error: /, '');

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try { setKm(await window.lumen.keymap.read()); } catch (e) { setErr(clean(e)); }
    setBusy(false);
  }, []);
  useEffect(() => { if (connected && !km) load(); }, [connected, km, load]);
  useEffect(() => {
    if (!connected) return;
    window.lumen.encoder.get(layer).then(setEnc).catch(() => setEnc(null));
  }, [connected, layer, km]);
  useEffect(() => { if (!sel?.knob) setTarget('press'); }, [sel]);

  const code = (k: KeyDef) => km?.layers[layer]?.[k.row]?.[k.col] ?? 0;
  const labels = useMemo(() => (k: KeyDef) => {
    const c = code(k), l = keyLabel(c);
    return { text: k.knob ? '⏺ ' + (l.short || '') : l.short, title: (k.knob ? 'Knob press · ' : '') + l.title, dim: c === 1 || c === 0, mod: layer === 0 && MOD_KEYS.test(k.id) };
  }, [km, layer]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async (c: number) => {
    if (!sel) return;
    if (sel.knob && target !== 'press') {
      try {
        const r = await window.lumen.encoder.set({ layer, clockwise: target === 'cw', code: c });
        setEnc(r);
        notify(`Knob turn ${target === 'cw' ? 'right' : 'left'} → ${keyLabel(target === 'cw' ? r.cw : r.ccw).short || 'None'} (layer ${layer})`);
      } catch (e) { notify(clean(e), 'err'); }
      return;
    }
    try {
      const got = await window.lumen.keymap.set({ layer, row: sel.row, col: sel.col, code: c });
      setKm((m) => { if (!m) return m; const copy = m.layers.map((l) => l.map((r) => [...r])); copy[layer][sel.row][sel.col] = got; return { ...m, layers: copy }; });
      notify(`${sel.knob ? 'Knob' : sel.label} → ${keyLabel(got).short || 'None'} (layer ${layer})`);
    } catch (e) { notify(clean(e), 'err'); }
  };

  if (!connected) return <div className="empty"><TriangleAlert size={28} /><h2>Keyboard not connected</h2><p>Plug in the R75 over USB to read and edit its keymap.</p></div>;

  const t = KC_TABS.find((x) => x.id === tab)!;
  const canMod = tab === 'basic' || tab === 'nav' || tab === 'fn';
  const cur = !sel ? -1 : sel.knob && target !== 'press' ? (target === 'cw' ? enc?.cw : enc?.ccw) ?? -1 : code(sel);
  const hexCode = parseInt(hex.replace(/^0x/i, ''), 16);
  const hexOk = hex !== '' && Number.isFinite(hexCode) && hexCode >= 0 && hexCode <= 0xffff;

  return (
    <div className="page">
      <HeaderActions>
        <Btn disabled={!km} onClick={async () => notify((await window.lumen.keymap.exportAll()) ? 'Keymap backed up' : 'Backup cancelled')}>Backup</Btn>
        <Btn onClick={async () => { try { setBusy(true); const r = await window.lumen.keymap.importAll(); if (r) { setKm(r); notify('Keymap restored'); } } catch (e) { notify(clean(e), 'err'); } setBusy(false); }}>Restore</Btn>
        <Btn onClick={() => setConfirmReset(true)}>Reset to defaults</Btn>
        <Btn onClick={load}><RefreshCw size={14} className={busy ? 'spin' : ''} />Reload</Btn>
      </HeaderActions>

      <div className="tabs layers" role="tablist" aria-label="Layers">
        {Array.from({ length: layers }, (_, i) => <button key={i} role="tab" aria-selected={i === layer} className={'tab' + (i === layer ? ' on' : '')} onClick={() => { setLayer(i); }}>Layer {i}</button>)}
        <span className="grow" />
        <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>Click a key to remap it · ▽ falls through to the layer below</span>
      </div>
      {confirmReset && (
        <Modal onClose={() => setConfirmReset(false)}>
          <h3>Reset keymap to the firmware defaults?</h3>
          <p className="sub">Every layer returns to the keyboard's built-in layout. Use Backup first if you want to keep your current keymap. This also fixes a shifted or scrambled layout after a firmware update.</p>
          <div className="row gap8" style={{ justifyContent: 'flex-end' }}>
            <Btn onClick={() => setConfirmReset(false)}>Cancel</Btn>
            <Btn kind="danger" onClick={async () => { setConfirmReset(false); setBusy(true); try { setKm(await window.lumen.keymap.reset()); notify('Keymap reset to defaults'); } catch (e) { notify(clean(e), 'err'); } setBusy(false); }}>Reset keymap</Btn>
          </div>
        </Modal>
      )}
      {err && <div className="note bad"><TriangleAlert size={15} />{err}</div>}

      <section className="panel" style={{ padding: '28px 26px' }}>
        {km ? <Keyboard variant="map" maxUnit={56} labels={labels} selected={sel?.id} onSelect={setSel} /> : <div className="empty small"><RefreshCw className="spin" />Reading keymap from the keyboard…</div>}
      </section>

      <section className="panel remap">
        <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">Remapping</div>
            <h2>{sel ? (sel.knob ? (target === 'press' ? 'Knob press' : target === 'cw' ? 'Knob turn right' : 'Knob turn left') : sel.label + ' key') : 'Select a key above'} {sel && <span>→ {keyLabel(cur).short || 'None'}</span>}</h2>
          </div>
          <span className="grow" />
          {sel?.knob && <div className="seg" role="group" aria-label="Knob action">{([['press', 'Press'], ['ccw', 'Turn left'], ['cw', 'Turn right']] as const).map(([v, l]) => <button key={v} className={v === target ? 'on' : ''} onClick={() => setTarget(v)}>{l}</button>)}</div>}
          {canMod && <div className="row gap8">{MODS.map(([n, b]) => <button key={n} className={'chip sm' + (mods & b ? ' on' : '')} onClick={() => setMods(mods ^ b)} aria-pressed={!!(mods & b)}>+ {n}</button>)}</div>}
          <div className="ctabs">{KC_TABS.map((x) => <button key={x.id} className={'ctab' + (x.id === tab ? ' on' : '')} onClick={() => setTab(x.id)}>{x.name}</button>)}</div>
        </div>
        <div className="kc-grid" style={{ opacity: sel ? 1 : 0.45, pointerEvents: sel ? 'auto' : 'none' }}>
          {t.items(layers).map((it) => <button key={it.code} className={'kc' + (it.code === cur ? ' on' : '')} title={'0x' + it.code.toString(16)} onClick={() => apply(canMod && mods && it.code < 0x100 ? it.code | (mods << 8) : it.code)}>{it.label}</button>)}
        </div>
        <div className="row gap8">
          <span className="dim" style={{ fontSize: 12.5 }}>Advanced · raw keycode</span>
          <input className="text mono" style={{ width: 120, height: 34 }} placeholder="0x0004" value={hex} onChange={(e) => setHex(e.target.value)} />
          <Btn small disabled={!sel || !hexOk || isDangerous(hexCode)} onClick={() => apply(hexCode)}>Apply</Btn>
          {hexOk && isDangerous(hexCode) && <span className="bad-t" style={{ fontSize: 12 }}>Bootloader / reset codes are blocked</span>}
        </div>
      </section>
    </div>
  );
}
