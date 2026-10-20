import { Card, Toggle, Slider, Btn } from '../components/ui';
import { useUI, ACCENTS } from '../store';

export default function Settings() {
  const snap = useUI((s) => s.snap)!;
  const s = snap.settings;
  const set = (p: any) => window.lumen.settings(p);
  const accent = useUI((x) => x.accent);
  const setAccent = useUI((x) => x.setAccent);
  const u = snap.update;
  const busy = u.status === 'checking' || u.status === 'downloading';
  const statusText =
    u.status === 'checking' ? 'Checking for updates…'
    : u.status === 'available' ? `Version ${u.version} is available`
    : u.status === 'downloading' ? `Downloading version ${u.version}… ${u.percent}%`
    : u.status === 'ready' ? `Version ${u.version} is ready to install`
    : u.status === 'none' ? "You're up to date"
    : u.status === 'error' ? 'Could not check for updates'
    : u.supported ? 'Not checked yet' : 'Updates are manual for this build';
  return (
    <div className="page narrow">
      <Card title="Updates" sub={`RK Lumen v${u.current}`}>
        <div className="stack">
          <div className="row">
            <div className="grow">
              <div className="lbl">{statusText}</div>
              {u.status === 'error' && <small className="hint">{u.error}</small>}
              {u.status === 'none' && u.checkedAt > 0 && <small className="hint">Last checked {new Date(u.checkedAt).toLocaleTimeString()}</small>}
              {!u.supported && <small className="hint">{u.mode === 'portable' ? 'This is the portable build. Download the new version from GitHub and replace the folder.' : 'Updates install only in the installed app.'}</small>}
            </div>
            {u.supported && u.status === 'available' && <Btn kind="primary" onClick={() => window.lumen.update.download()}>Download</Btn>}
            {u.supported && u.status === 'ready' && <Btn kind="primary" onClick={() => window.lumen.update.install()}>Restart & install</Btn>}
            {u.supported && !['available', 'ready'].includes(u.status) && <Btn disabled={busy} onClick={() => window.lumen.update.check()}>Check for updates</Btn>}
            {!u.supported && <Btn onClick={() => window.lumen.openUrl(u.releasesUrl)}>Open releases</Btn>}
          </div>
          {u.status === 'downloading' && <div className="meter"><i style={{ width: u.percent + '%' }} /></div>}
          {u.notes && ['available', 'downloading', 'ready'].includes(u.status) && <pre className="notes">{u.notes}</pre>}
          {u.supported && <Toggle on={s.autoUpdateCheck} onChange={(v) => set({ autoUpdateCheck: v })} label="Check for updates automatically" hint="Contacts github.com/jamimmehdi/rk-lumen about every 6 hours. Nothing is downloaded until you click Download." />}
          <p className="hint">Keyboard firmware is never updated automatically. New firmware is published separately and is flashed manually with the safe flash script.</p>
        </div>
      </Card>
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
