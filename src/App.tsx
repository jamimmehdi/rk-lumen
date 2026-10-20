import { useEffect, useRef } from 'react';
import { Check, TriangleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUI, initBridge, ACCENTS, type Page } from './store';
import { hsv2rgb } from './color';
import Dashboard from './pages/Dashboard';
import Lighting from './pages/Lighting';
import Live from './pages/Live';
import Gaming from './pages/Gaming';
import KeymapPage from './pages/Keymap';
import Profiles from './pages/Profiles';
import Stats from './pages/Stats';
import Lab from './pages/Lab';
import Settings from './pages/Settings';

const ICONS: Record<Page, string[]> = {
  dashboard: ['M4.5 3h4A1.5 1.5 0 0 1 10 4.5v4A1.5 1.5 0 0 1 8.5 10h-4A1.5 1.5 0 0 1 3 8.5v-4A1.5 1.5 0 0 1 4.5 3z', 'M15.5 3h4A1.5 1.5 0 0 1 21 4.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 14 8.5v-4A1.5 1.5 0 0 1 15.5 3z', 'M4.5 14h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 8.5 21h-4A1.5 1.5 0 0 1 3 19.5v-4A1.5 1.5 0 0 1 4.5 14z', 'M15.5 14h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5z'],
  lighting: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z'],
  live: ['M3 12h3l2-6 4 12 3-9 2 3h4'],
  gaming: ['M6 11h4M8 9v4M15 12h.01M18 10h.01M6.7 5h10.6a4 4 0 0 1 4 3.6l.5 6.5a2 2 0 0 1-3.4 1.6L17 14H7l-1.4 2.7a2 2 0 0 1-3.4-1.6l.5-6.5a4 4 0 0 1 4-3.6z'],
  keymap: ['M4.5 6h15A2.5 2.5 0 0 1 22 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 15.5v-7A2.5 2.5 0 0 1 4.5 6z', 'M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10'],
  profiles: ['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5'],
  stats: ['M5 20V10M12 20V4M19 20v-7'],
  lab: ['M9 3h6M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 19l-6-10V3'],
  settings: ['M4 7h10M18 7h2M4 17h2M10 17h10', 'M16 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'M8 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
};
const LABEL: Record<Page, string> = { dashboard: 'Dashboard', lighting: 'Hardware FX', live: 'Live FX', gaming: 'Gaming', keymap: 'Keymap', profiles: 'Profiles', stats: 'Insights', lab: 'Protocol Lab', settings: 'Settings' };
const MAIN: Page[] = ['dashboard', 'lighting', 'live', 'gaming', 'keymap', 'profiles', 'stats', 'lab'];

const PAGES: Record<Page, () => React.ReactElement> = {
  dashboard: Dashboard, lighting: Lighting, live: Live, gaming: Gaming, keymap: KeymapPage, profiles: Profiles, stats: Stats, lab: Lab, settings: Settings,
};

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const Nav = ({ id, page, set, badge }: { id: Page; page: Page; set: (p: Page) => void; badge?: boolean }) => (
  <button className={'ni' + (page === id ? ' on' : '')} onClick={() => set(id)} aria-label={LABEL[id]} title={LABEL[id]} aria-current={page === id ? 'page' : undefined}>
    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">{ICONS[id].map((d, i) => <path key={i} d={d} />)}</svg>
    {badge && <i className="badge" aria-label="Update available" />}
  </button>
);

export default function App() {
  const snap = useUI((s) => s.snap);
  const page = useUI((s) => s.page);
  const setPage = useUI((s) => s.setPage);
  const toast = useUI((s) => s.toast);
  const lastAccent = useRef('');

  useEffect(() => { initBridge(); }, []);

  // One toast per newly found version, pointing at Settings.
  const upd = snap?.update;
  const announced = useRef('');
  useEffect(() => {
    if (upd?.status === 'available' && upd.version && announced.current !== upd.version) {
      announced.current = upd.version;
      useUI.getState().notify(`RK Lumen ${upd.version} is available — open Settings to update.`);
    }
  }, [upd?.status, upd?.version]);

  // Accent: a fixed brand colour (default Ember) or "follow" = the keyboard's live colour.
  useEffect(() => {
    const apply = () => {
      const s = useUI.getState();
      let rgb = ACCENTS[s.accent];
      if (!rgb && s.snap) {
        const o = s.frame?.out ?? s.snap.out, c = s.snap.current;
        const hsv = c.mode === 'live' ? { h: o.h, s: Math.max(0.45, o.s), v: 1 } : { h: c.hw.h / 255, s: Math.max(0.45, c.hw.s / 255), v: 1 };
        rgb = hsv2rgb(hsv).join(',');
      }
      rgb = rgb || ACCENTS.ember;
      if (rgb !== lastAccent.current) { lastAccent.current = rgb; document.documentElement.style.setProperty('--accent-rgb', rgb); }
    };
    apply();
    return useUI.subscribe(apply);
  }, []);

  if (!snap) return <div className="boot">Starting…</div>;
  const Page = PAGES[page];
  const d = snap.device;
  const head: Record<Page, [string, string]> = {
    dashboard: [greeting(), 'Dashboard'],
    lighting: ['Runs on the keyboard · keeps going without the app', 'Hardware effects'],
    live: ['Animated from your PC · 30 fps · lives in the tray', 'Live effects'],
    gaming: ['Runs on the keyboard itself · works in every game', 'Gaming'],
    keymap: ['Written to the keyboard instantly · same as VIA', 'Keymap'],
    profiles: ['Scenes, per-app rules and schedules', 'Profiles & automation'],
    stats: ['Private · stored only on this PC', 'Typing insights'],
    lab: ['Raw HID console for the VIA interface', 'Protocol lab'],
    settings: [`RK Lumen v${snap.version}`, 'Settings'],
  };
  const active = snap.profiles.find((p) => p.id === snap.activeProfileId);

  return (
    <div className="app">
      <nav className="rail" aria-label="Main">
        <div className="logo" aria-hidden="true">
          {['#ff7a3d', '#ffb23d', '#46e08f', '#22d3ee', '#4f7dff', '#ff3d8b', '#ffb23d', '#46e08f', '#ff7a3d'].map((c, i) => <i key={i} style={{ background: c }} />)}
        </div>
        {MAIN.map((id) => <Nav key={id} id={id} page={page} set={setPage} />)}
        <div style={{ flex: 1 }} />
        <Nav id="settings" page={page} set={setPage} badge={['available', 'downloading', 'ready'].includes(snap.update.status)} />
      </nav>

      <div className="main">
        <header className="top">
          <div className="grow">
            <div className="eyebrow">{head[page][0]}</div>
            <h1>{head[page][1]}</h1>
          </div>
          <div id="hdr-actions" className="row gap8" />
          <div className="pill" role={d.connected ? undefined : 'button'} tabIndex={d.connected ? undefined : 0} title={d.connected ? undefined : 'Click to look for the keyboard again'} style={d.connected ? undefined : { cursor: 'pointer' }} onClick={() => { if (!d.connected) window.lumen.reconnect(); }}><span className={'dot' + (d.connected ? ' ok' : '')} />{d.connected ? d.info?.product ?? 'Keyboard' : 'No keyboard'}
            <span className="mono" style={{ color: '#7d8491', fontSize: 11.5 }}>{d.connected ? `USB · VIA v${d.protocol}` : 'plug in via USB'}</span></div>
          {page === 'dashboard' && active && <div className="pill" style={{ gap: 10 }}><span style={{ color: 'var(--mute)' }}>Profile</span><b>{active.name}</b></div>}
        </header>
        <AnimatePresence mode="wait">
          <motion.div key={page} className="scroll" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
            <Page />
          </motion.div>
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} className={'toast ' + toast.kind} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {toast.kind === 'ok' ? <Check size={16} /> : <TriangleAlert size={16} />} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
