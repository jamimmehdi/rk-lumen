import { Card, Toggle, Slider } from '../components/ui';
import { useUI, ACCENTS } from '../store';

export default function Settings() {
  const snap = useUI((s) => s.snap)!;
  const s = snap.settings;
  const set = (p: any) => window.lumen.settings(p);
  const accent = useUI((x) => x.accent);
  const setAccent = useUI((x) => x.setAccent);
  return (
    <div className="page narrow">
      <Card title="Appearance">
        <div className="row"><span className="lbl grow">Accent colour</span>
          <div className="swatches">
            {Object.entries(ACCENTS).map(([k, rgb]) => <button key={k} aria-label={k} title={k} className={accent === k ? 'on' : ''} style={{ background: `rgb(${rgb})` }} onClick={() => setAccent(k)} />)}
            <button aria-label="Follow keyboard colour" title="Follow keyboard colour" className={accent === 'follow' ? 'on' : ''} style={{ background: 'conic-gradient(#ff3b30,#ffb300,#7be04a,#22d3ee,#4f7dff,#d046ff,#ff3b30)' }} onClick={() => setAccent('follow')} />
          </div>
        </div>
      </Card>
      <Card title="Startup & tray">
        <div className="stack">
          <Toggle on={s.autostart} onChange={(v) => set({ autostart: v })} label="Start with Windows" hint="Launches hidden in the tray so your lighting applies at login." />
          <Toggle on={s.startMinimized} onChange={(v) => set({ startMinimized: v })} label="Start minimised" />
          <Toggle on={s.closeToTray} onChange={(v) => set({ closeToTray: v })} label="Keep running in tray when window is closed" hint="Required for live effects, per-app profiles and idle dimming." />
          <Toggle on={s.restoreOnExit} onChange={(v) => set({ restoreOnExit: v })} label="Restore hardware lighting on exit" hint="Live effects hand control back to the keyboard's own effect when you quit." />
        </div>
      </Card>
      <Card title="Brightness">
        <Slider label="Master brightness cap" value={s.maxBrightness} min={5} max={100} fmt={(v) => v + '%'} onChange={(v) => set({ maxBrightness: v })} />
      </Card>
      <Card title="Privacy">
        <Toggle on={s.trackKeys} onChange={(v) => set({ trackKeys: v })} label="Keystroke statistics" hint="Stores per-key counts locally for the heat-map. Never records what you type." />
      </Card>
      <Card title="About this keyboard">
        <p className="hint">Your R75 runs QMK with the VIA protocol over USB raw HID (usage 0xFF60). Lighting uses the firmware's RGB Matrix controls; the firmware does not expose per-key colour streaming, so per-key painting isn't available — live modes drive the whole board.</p>
      </Card>
    </div>
  );
}
